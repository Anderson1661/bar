import { query, queryOne, execute, withTransaction } from '../database/connection'
import { auditLog } from '../utils/audit'
import type { CashSession } from '@shared/types/entities'
import type { OpenCashSessionDTO, CloseCashSessionDTO, ApiResult } from '@shared/types/dtos'
import type { TrustedActor } from '../types/actor'

export class CashService {
  async getCurrentSession(): Promise<CashSession | null> {
    const row = await queryOne(
      `SELECT cs.*, u.full_name AS opened_by_name, u2.full_name AS closed_by_name
       FROM cash_sessions cs
       JOIN users u ON u.id = cs.opened_by
       LEFT JOIN users u2 ON u2.id = cs.closed_by
       WHERE cs.status = 'open' ORDER BY cs.opened_at DESC LIMIT 1`
    )
    if (!row) return null
    const r = row as Record<string, unknown>
    return {
      id:               r.id as number,
      openedBy:         r.opened_by as number,
      openedByName:     r.opened_by_name as string,
      closedBy:         r.closed_by as number | null,
      closedByName:     r.closed_by_name as string | null,
      openingAmount:    Number(r.opening_amount),
      closingAmountReal:r.closing_amount_real ? Number(r.closing_amount_real) : null,
      status:           r.status as 'open' | 'closed',
      notes:            r.notes as string | null,
      openedAt:         r.opened_at as string,
      closedAt:         r.closed_at as string | null,
    }
  }

  async open(dto: OpenCashSessionDTO, actor: TrustedActor): Promise<ApiResult<CashSession>> {
    const existing = await this.getCurrentSession()
    if (existing) {
      return { success: false, error: 'Ya hay una sesión de caja abierta', code: 'SESSION_OPEN' }
    }

    const { insertId } = await execute(
      `INSERT INTO cash_sessions (opened_by, opening_amount, status) VALUES (?, ?, 'open')`,
      [actor.id, dto.openingAmount]
    )

    await auditLog({
      userId: actor.id, username: actor.username,
      action: 'OPEN', module: 'cash', recordId: String(insertId),
      description: `Caja abierta con base $${dto.openingAmount}`
    })

    const session = await this.getCurrentSession()
    return { success: true, data: session! }
  }

  async close(dto: CloseCashSessionDTO, actor: TrustedActor): Promise<ApiResult> {
    const session = await queryOne<{ id: number; status: string }>(
      'SELECT id, status FROM cash_sessions WHERE id = ?', [dto.sessionId]
    )
    if (!session || session.status !== 'open') {
      return { success: false, error: 'Sesión de caja no encontrada o ya cerrada', code: 'NOT_FOUND' }
    }

    // Calcular totales teóricos por método
    const theoretical = await query<{ payment_method_id: number; total: number }>(
      `SELECT p.payment_method_id, SUM(p.amount) AS total
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE o.cash_session_id = ?
       GROUP BY p.payment_method_id`,
      [dto.sessionId]
    )

    await withTransaction(async (conn) => {
      // Insertar detalles del cierre
      for (const detail of dto.detailsByMethod) {
        const theo = theoretical.find(
          t => (t as unknown as { payment_method_id: number }).payment_method_id === detail.paymentMethodId
        )
        const theoreticalAmount = theo ? Number((theo as unknown as { total: number }).total) : 0
        const difference = detail.realAmount - theoreticalAmount

        await conn.execute(
          `INSERT INTO cash_closure_details
             (cash_session_id, payment_method_id, theoretical_amount, real_amount, difference)
           VALUES (?, ?, ?, ?, ?)`,
          [dto.sessionId, detail.paymentMethodId, theoreticalAmount, detail.realAmount, difference]
        )
      }

      await conn.execute(
        `UPDATE cash_sessions
         SET status = 'closed', closed_by = ?, closing_amount_real = ?, closed_at = NOW(), notes = ?
         WHERE id = ?`,
        [actor.id, dto.closingAmountReal, dto.notes ?? null, dto.sessionId]
      )
    })

    await auditLog({
      userId: actor.id, username: actor.username,
      action: 'CLOSE', module: 'cash', recordId: String(dto.sessionId),
      description: `Caja cerrada. Real: $${dto.closingAmountReal}`
    })

    return { success: true }
  }

  async getSessionSummary(sessionId: number) {
    const [totals] = await query(
      `SELECT COUNT(DISTINCT o.id) AS orders,
              SUM(r.total) AS total_sales,
              SUM(r.service_charge) AS total_service
       FROM orders o
       JOIN receipts r ON r.order_id = o.id
       WHERE o.cash_session_id = ? AND r.voided = 0`,
      [sessionId]
    )

    const byMethod = await query(
      `SELECT pm.name, SUM(p.amount) AS total
       FROM payments p
       JOIN payment_methods pm ON pm.id = p.payment_method_id
       JOIN orders o ON o.id = p.order_id
       WHERE o.cash_session_id = ?
       GROUP BY pm.id, pm.name`,
      [sessionId]
    )

    const expenses = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE cash_session_id = ?`,
      [sessionId]
    )

    return { totals, byMethod, expenses }
  }
}

export const cashService = new CashService()

import { query, queryOne, execute } from '../database/connection'
import { auditLog } from '../utils/audit'
import type { BarTable, TableStatus } from '@shared/types/entities'
import type { ApiResult } from '@shared/types/dtos'

interface TableRow {
  id: number
  number: number
  name: string | null
  capacity: number
  zone: string | null
  position_x: number
  position_y: number
  status: TableStatus
  is_active: number
  current_order_id: number | null
  current_order_total: number | null
  current_waiter: string | null
}

function mapRow(row: TableRow): BarTable {
  return {
    id:               row.id,
    number:           row.number,
    name:             row.name,
    capacity:         row.capacity,
    zone:             row.zone,
    positionX:        row.position_x,
    positionY:        row.position_y,
    status:           row.status,
    isActive:         Boolean(row.is_active),
    currentOrderId:   row.current_order_id ?? undefined,
    currentOrderTotal:row.current_order_total ?? undefined,
    currentWaiter:    row.current_waiter ?? undefined,
  }
}

export class TablesService {
  async list(): Promise<BarTable[]> {
    const rows = await query<TableRow>(
      `SELECT t.*,
              o.id    AS current_order_id,
              o.total AS current_order_total,
              u.full_name AS current_waiter
       FROM bar_tables t
       LEFT JOIN orders o ON o.table_id = t.id AND o.status IN ('open','pending_payment')
       LEFT JOIN users  u ON u.id = o.waiter_id
       WHERE t.is_active = 1
       ORDER BY t.number`
    )
    return rows.map(mapRow)
  }

  async getById(id: number): Promise<BarTable | null> {
    const row = await queryOne<TableRow>(
      `SELECT t.*,
              o.id    AS current_order_id,
              o.total AS current_order_total,
              u.full_name AS current_waiter
       FROM bar_tables t
       LEFT JOIN orders o ON o.table_id = t.id AND o.status IN ('open','pending_payment')
       LEFT JOIN users  u ON u.id = o.waiter_id
       WHERE t.id = ?`,
      [id]
    )
    return row ? mapRow(row) : null
  }

  async create(
    data: { number: number; name?: string; capacity?: number; zone?: string; positionX?: number; positionY?: number },
    actorId: number,
    actorUsername: string
  ): Promise<ApiResult<BarTable>> {
    const existing = await queryOne('SELECT id FROM bar_tables WHERE number = ?', [data.number])
    if (existing) {
      return { success: false, error: `La mesa número ${data.number} ya existe`, code: 'DUPLICATE' }
    }

    const { insertId } = await execute(
      `INSERT INTO bar_tables (number, name, capacity, zone, position_x, position_y)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.number, data.name ?? null, data.capacity ?? 4, data.zone ?? null, data.positionX ?? 0, data.positionY ?? 0]
    )

    await auditLog({
      userId: actorId, username: actorUsername,
      action: 'CREATE', module: 'tables', recordId: String(insertId),
      description: `Mesa ${data.number} creada`
    })

    const table = await this.getById(insertId)
    return { success: true, data: table! }
  }

  async update(
    id: number,
    data: { name?: string; capacity?: number; zone?: string; positionX?: number; positionY?: number; isActive?: boolean },
    actorId: number,
    actorUsername: string
  ): Promise<ApiResult<BarTable>> {
    const current = await this.getById(id)
    if (!current) return { success: false, error: 'Mesa no encontrada', code: 'NOT_FOUND' }

    await execute(
      `UPDATE bar_tables
       SET name       = COALESCE(?, name),
           capacity   = COALESCE(?, capacity),
           zone       = COALESCE(?, zone),
           position_x = COALESCE(?, position_x),
           position_y = COALESCE(?, position_y),
           is_active  = COALESCE(?, is_active)
       WHERE id = ?`,
      [data.name, data.capacity, data.zone, data.positionX, data.positionY,
       data.isActive !== undefined ? (data.isActive ? 1 : 0) : null, id]
    )

    await auditLog({
      userId: actorId, username: actorUsername,
      action: 'UPDATE', module: 'tables', recordId: String(id),
      description: `Mesa ${current.number} actualizada`,
      newValues: data
    })

    const updated = await this.getById(id)
    return { success: true, data: updated! }
  }

  async updateStatus(id: number, status: TableStatus): Promise<void> {
    await execute('UPDATE bar_tables SET status = ? WHERE id = ?', [status, id])
  }
}

export const tablesService = new TablesService()

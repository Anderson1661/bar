import { query, queryOne, execute, withTransaction } from '../database/connection'
import { auditLog } from '../utils/audit'
import type { Promotion, PromotionItem } from '@shared/types/entities'
import type { CreatePromotionDTO, UpdatePromotionDTO, ApiResult } from '@shared/types/dtos'

function mapPromotion(row: Record<string, unknown>): Promotion {
  return {
    id:            row.id as number,
    name:          row.name as string,
    description:   row.description as string | null,
    type:          row.type as Promotion['type'],
    discountValue: row.discount_value as number,
    minQuantity:   row.min_quantity as number,
    appliesTo:     row.applies_to as Promotion['appliesTo'],
    startTime:     row.start_time as string | null,
    endTime:       row.end_time as string | null,
    daysOfWeek:    row.days_of_week as string | null,
    validFrom:     row.valid_from as string | null,
    validUntil:    row.valid_until as string | null,
    isActive:      Boolean(row.is_active),
    autoApply:     Boolean(row.auto_apply),
    priority:      row.priority as number,
    createdBy:     row.created_by as number,
    createdByName: row.created_by_name as string | null,
    updatedBy:     row.updated_by as number | null,
    createdAt:     row.created_at as string,
  }
}

export class PromotionsService {
  async list(includeInactive = false): Promise<Promotion[]> {
    const where = includeInactive ? '' : 'WHERE p.is_active = 1'
    const rows = await query<Record<string, unknown>>(
      `SELECT p.*, u.full_name AS created_by_name
       FROM promotions p
       LEFT JOIN users u ON u.id = p.created_by
       ${where}
       ORDER BY p.priority DESC, p.name`
    )
    return rows.map(mapPromotion)
  }

  async get(id: number): Promise<ApiResult<Promotion>> {
    const row = await queryOne<Record<string, unknown>>(
      `SELECT p.*, u.full_name AS created_by_name
       FROM promotions p
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.id = ?`,
      [id]
    )
    if (!row) return { success: false, error: 'Promoción no encontrada', code: 'NOT_FOUND' }
    return { success: true, data: mapPromotion(row) }
  }

  async listItems(promotionId: number): Promise<PromotionItem[]> {
    const rows = await query<Record<string, unknown>>(
      `SELECT pi.id, pi.promotion_id, pi.product_id, p.name AS product_name,
              pi.category_id, pc.name AS category_name
       FROM promotion_items pi
       LEFT JOIN products p   ON p.id  = pi.product_id
       LEFT JOIN product_categories pc ON pc.id = pi.category_id
       WHERE pi.promotion_id = ?`,
      [promotionId]
    )
    return rows.map((r) => ({
      id:           r.id as number,
      promotionId:  r.promotion_id as number,
      productId:    r.product_id as number | null,
      productName:  r.product_name as string | null,
      categoryId:   r.category_id as number | null,
      categoryName: r.category_name as string | null,
    }))
  }

  async create(
    dto: CreatePromotionDTO,
    actorId: number,
    actorUsername: string,
    roleName?: string,
    sessionId?: number
  ): Promise<ApiResult<Promotion>> {
    if (!dto.name?.trim()) {
      return { success: false, error: 'El nombre de la promoción es obligatorio', code: 'MISSING_NAME' }
    }
    if (dto.discountValue == null || dto.discountValue < 0) {
      return { success: false, error: 'El valor de descuento debe ser mayor o igual a 0', code: 'INVALID_DISCOUNT' }
    }

    const result = await withTransaction(async (conn) => {
      const [res] = await conn.execute(
        `INSERT INTO promotions (
           name, description, type, discount_value, min_quantity, applies_to,
           start_time, end_time, days_of_week, valid_from, valid_until,
           is_active, auto_apply, priority, created_by, updated_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dto.name.trim(),
          dto.description?.trim() ?? null,
          dto.type ?? 'percentage',
          dto.discountValue,
          dto.minQuantity ?? 1,
          dto.appliesTo ?? 'product',
          dto.startTime   ?? null,
          dto.endTime     ?? null,
          dto.daysOfWeek  ?? null,
          dto.validFrom   ?? null,
          dto.validUntil  ?? null,
          dto.isActive  !== false ? 1 : 0,
          dto.autoApply ?? false ? 1 : 0,
          dto.priority  ?? 0,
          actorId,
          actorId,
        ]
      )
      const id = (res as { insertId: number }).insertId

      if (dto.productIds?.length) {
        for (const pid of dto.productIds) {
          await conn.execute(
            'INSERT IGNORE INTO promotion_items (promotion_id, product_id) VALUES (?, ?)',
            [id, pid]
          )
        }
      }
      if (dto.categoryIds?.length) {
        for (const cid of dto.categoryIds) {
          await conn.execute(
            'INSERT IGNORE INTO promotion_items (promotion_id, category_id) VALUES (?, ?)',
            [id, cid]
          )
        }
      }

      return id
    })

    await auditLog({
      userId: actorId, username: actorUsername, roleName,
      action: 'CREATE', module: 'promotions',
      recordId: String(result), description: `Promoción "${dto.name}" creada`,
      newValues: dto, sessionId
    })

    return this.get(result)
  }

  async update(
    dto: UpdatePromotionDTO,
    actorId: number,
    actorUsername: string,
    roleName?: string,
    sessionId?: number
  ): Promise<ApiResult<Promotion>> {
    const existing = await this.get(dto.id)
    if (!existing.success || !existing.data) {
      return { success: false, error: 'Promoción no encontrada', code: 'NOT_FOUND' }
    }

    const updates: string[]  = []
    const params:  unknown[] = []

    const fields: Array<[string, string, unknown]> = [
      ['name',           'name',          dto.name?.trim()],
      ['description',    'description',   dto.description],
      ['type',           'type',          dto.type],
      ['discount_value', 'discountValue', dto.discountValue],
      ['min_quantity',   'minQuantity',   dto.minQuantity],
      ['applies_to',     'appliesTo',     dto.appliesTo],
      ['start_time',     'startTime',     dto.startTime],
      ['end_time',       'endTime',       dto.endTime],
      ['days_of_week',   'daysOfWeek',    dto.daysOfWeek],
      ['valid_from',     'validFrom',     dto.validFrom],
      ['valid_until',    'validUntil',    dto.validUntil],
      ['is_active',      'isActive',      dto.isActive],
      ['auto_apply',     'autoApply',     dto.autoApply],
      ['priority',       'priority',      dto.priority],
    ]

    for (const [col, , val] of fields) {
      if (val !== undefined) {
        if (col === 'is_active' || col === 'auto_apply') {
          updates.push(`${col} = ?`); params.push(val ? 1 : 0)
        } else {
          updates.push(`${col} = ?`); params.push(val ?? null)
        }
      }
    }

    if (updates.length === 0) {
      return { success: false, error: 'No hay campos para actualizar', code: 'NO_CHANGES' }
    }

    updates.push('updated_by = ?'); params.push(actorId)
    params.push(dto.id)

    await execute(`UPDATE promotions SET ${updates.join(', ')} WHERE id = ?`, params)

    // Update items if provided
    if (dto.productIds !== undefined || dto.categoryIds !== undefined) {
      await execute('DELETE FROM promotion_items WHERE promotion_id = ?', [dto.id])
      for (const pid of dto.productIds ?? []) {
        await execute('INSERT IGNORE INTO promotion_items (promotion_id, product_id) VALUES (?, ?)', [dto.id, pid])
      }
      for (const cid of dto.categoryIds ?? []) {
        await execute('INSERT IGNORE INTO promotion_items (promotion_id, category_id) VALUES (?, ?)', [dto.id, cid])
      }
    }

    await auditLog({
      userId: actorId, username: actorUsername, roleName,
      action: 'UPDATE', module: 'promotions',
      recordId: String(dto.id), description: `Promoción "${existing.data.name}" actualizada`,
      oldValues: existing.data as unknown as Record<string, unknown>,
      newValues: dto as unknown as Record<string, unknown>,
      sessionId
    })

    return this.get(dto.id)
  }

  async toggle(
    id: number,
    actorId: number,
    actorUsername: string,
    roleName?: string,
    sessionId?: number
  ): Promise<ApiResult<Promotion>> {
    const existing = await this.get(id)
    if (!existing.success || !existing.data) {
      return { success: false, error: 'Promoción no encontrada', code: 'NOT_FOUND' }
    }

    const newState = !existing.data.isActive
    await execute('UPDATE promotions SET is_active = ?, updated_by = ? WHERE id = ?', [newState ? 1 : 0, actorId, id])

    await auditLog({
      userId: actorId, username: actorUsername, roleName,
      action: newState ? 'ACTIVATE' : 'DEACTIVATE', module: 'promotions',
      recordId: String(id),
      description: `Promoción "${existing.data.name}" ${newState ? 'activada' : 'desactivada'}`,
      oldValues: { isActive: existing.data.isActive },
      newValues:  { isActive: newState },
      sessionId
    })

    return this.get(id)
  }
}

export const promotionsService = new PromotionsService()

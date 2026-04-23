import { ipcMain } from 'electron'
import { query, execute } from '../database/connection'
import { auditLog } from '../utils/audit'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { withAuthenticatedActor } from './authz'
import { createExpenseDTOSchema, expenseListFiltersSchema, wrappedDto } from '@shared/schemas/dtos'
import { parsePayload } from './validation'

export function registerExpensesIpc(): void {
  ipcMain.handle(IPC_CHANNELS.EXPENSES_CATEGORIES, async () => {
    return query('SELECT id, name, description FROM expense_categories WHERE is_active = 1 ORDER BY name')
  })

  ipcMain.handle(IPC_CHANNELS.EXPENSES_CREATE, async (event, payload) => {
    const parsed = parsePayload(wrappedDto(createExpenseDTOSchema), payload)
    if (!parsed.success) return parsed.result

    return withAuthenticatedActor(event, async (actor) => {
      const dto = parsed.data.dto
      const { insertId } = await execute(
        `INSERT INTO expenses (category_id, cash_session_id, description, amount, notes, registered_by, expense_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [dto.categoryId, dto.cashSessionId ?? null, dto.description, dto.amount, dto.notes ?? null, actor.id, dto.expenseDate]
      )

      await auditLog({
        userId: actor.id, username: actor.username,
        action: 'CREATE', module: 'expenses', recordId: String(insertId),
        description: `Gasto registrado: "${dto.description}" $${dto.amount}`
      })

      return { success: true, data: { id: insertId } }
    })
  })

  ipcMain.handle(IPC_CHANNELS.EXPENSES_LIST, async (_, payload) => {
    const parsed = parsePayload(expenseListFiltersSchema, payload)
    if (!parsed.success) return parsed.result

    const { from, to, categoryId } = parsed.data
    const conditions = ['1=1']
    const params: unknown[] = []

    if (from) { conditions.push('e.expense_date >= ?'); params.push(from) }
    if (to) { conditions.push('e.expense_date <= ?'); params.push(to) }
    if (categoryId) { conditions.push('e.category_id = ?'); params.push(categoryId) }

    return query(
      `SELECT e.*, ec.name AS category_name, u.full_name AS registered_by_name
       FROM expenses e
       JOIN expense_categories ec ON ec.id = e.category_id
       JOIN users u ON u.id = e.registered_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.expense_date DESC, e.created_at DESC`,
      params
    )
  })
}

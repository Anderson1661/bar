import { execute } from '../database/connection'

interface AuditEntry {
  userId:      number
  username:    string
  action:      string
  module:      string
  recordId?:   string
  entityType?: string
  entityId?: string
  description?: string
  details?:    Record<string, unknown>
  oldValues?:  Record<string, unknown>
  newValues?:  Record<string, unknown>
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await execute(
      `INSERT INTO audit_logs (
         user_id, username, action, module, record_id, entity_type, entity_id,
         description, details_json, old_values, new_values
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId,
        entry.username,
        entry.action.toUpperCase(),
        entry.module,
        entry.recordId ?? null,
        entry.entityType ?? entry.module,
        entry.entityId ?? entry.recordId ?? null,
        entry.description ?? null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.oldValues ? JSON.stringify(entry.oldValues) : null,
        entry.newValues ? JSON.stringify(entry.newValues) : null,
      ]
    )
  } catch (err) {
    // No dejar caer la operación por un fallo de auditoría
    console.error('[Audit] Error registrando evento:', err)
  }
}

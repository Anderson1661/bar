import { execute } from '../database/connection'
import type mysql from 'mysql2/promise'

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

type AuditMode = 'critical' | 'best_effort'

interface AuditLogOptions {
  conn?: mysql.Connection
  mode?: AuditMode
}

interface AuditFailureMetric {
  count: number
  lastFailureAt: string
  lastError: string
}

const AUDIT_ALERT_THRESHOLD = 3
const auditFailureMetrics = new Map<string, AuditFailureMetric>()

function registerAuditFailure(metricKey: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  const current = auditFailureMetrics.get(metricKey)
  const next: AuditFailureMetric = {
    count: (current?.count ?? 0) + 1,
    lastFailureAt: new Date().toISOString(),
    lastError: message,
  }
  auditFailureMetrics.set(metricKey, next)

  console.error(`[Audit][Metric] failure_count{key="${metricKey}"}=${next.count}`)
  if (next.count >= AUDIT_ALERT_THRESHOLD) {
    console.error(
      `[Audit][ALERT] Fallos consecutivos de auditoría para "${metricKey}" (count=${next.count})`
    )
  }
}

export async function auditLog(entry: AuditEntry, options?: AuditLogOptions): Promise<void> {
  const mode = options?.mode ?? 'best_effort'
  const metricKey = `${entry.module}:${entry.action.toUpperCase()}:${mode}`

  try {
    const sql = `INSERT INTO audit_logs (
      user_id, username, action, module, record_id, entity_type, entity_id,
      description, details_json, old_values, new_values
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    const params = [
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

    if (options?.conn) {
      await options.conn.execute(sql, params)
    } else {
      await execute(sql, params)
    }
  } catch (err) {
    registerAuditFailure(metricKey, err)
    console.error('[Audit] Error registrando evento:', err)

    if (mode === 'critical') {
      throw err
    }
  }
}

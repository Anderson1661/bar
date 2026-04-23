import { query, execute, queryOne } from '../database/connection'
import type { SystemSetting } from '@shared/types/entities'
import { SERVICE_CHARGE_PCT } from '@shared/constants'

export class SettingsService {
  private cache: Map<string, string> = new Map()

  async get(key: string): Promise<string | null> {
    if (this.cache.has(key)) return this.cache.get(key)!

    const row = await queryOne<{ value: string }>(
      'SELECT value FROM system_settings WHERE key_name = ?', [key]
    )
    const val = row?.value ?? null
    if (val !== null) this.cache.set(key, val)
    return val
  }

  async getBool(key: string): Promise<boolean> {
    const val = await this.get(key)
    return val === 'true' || val === '1'
  }

  async getNumber(key: string): Promise<number> {
    const val = await this.get(key)
    return Number(val ?? 0)
  }

  async getServiceChargeConfig(): Promise<{ pct: number; active: boolean }> {
    const [pctRaw, activeRaw] = await Promise.all([
      this.getNumber('service_charge_pct'),
      this.getBool('service_charge_active'),
    ])
    const pct = Number.isFinite(pctRaw) && pctRaw >= 0 ? pctRaw : SERVICE_CHARGE_PCT
    return { pct, active: activeRaw }
  }

  async set(key: string, value: string, updatedBy?: number): Promise<void> {
    await execute(
      `INSERT INTO system_settings (key_name, value, updated_by) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by)`,
      [key, value, updatedBy ?? null]
    )
    this.cache.set(key, value)
  }

  async getAll(): Promise<SystemSetting[]> {
    return query<SystemSetting>(
      `SELECT id, key_name, value, description, updated_at FROM system_settings ORDER BY key_name`
    ).then(rows => rows.map(r => {
      const row = r as unknown as Record<string, unknown>
      return {
        id: row.id as number,
        keyName: row.key_name as string,
        value: row.value as string,
        description: row.description as string | null,
        updatedAt: row.updated_at as string,
      }
    }))
  }

  invalidateCache(): void {
    this.cache.clear()
  }
}

export const settingsService = new SettingsService()

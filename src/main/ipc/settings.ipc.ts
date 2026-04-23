import { ipcMain } from 'electron'
import { settingsService } from '../services/settings.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { requirePermission, withAuthenticatedActor } from './authz'
import { parsePayload } from './validation'
import { z } from 'zod'

const getKeySchema = z.string().trim().min(1)
const updateSchema = z.object({ key: z.string().trim().min(1), value: z.string() })
const SERVICE_CHARGE_PCT_RANGE = { min: 0, max: 100 }

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (event, payload) => {
    const parsed = parsePayload(getKeySchema, payload)
    if (!parsed.success) return parsed.result
    return withAuthenticatedActor(event, async () => settingsService.get(parsed.data))
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, async (event) => withAuthenticatedActor(event, async () => settingsService.getAll()))

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_UPDATE,
    requirePermission('settings.manage', async (_, actor, payload) => {
      const parsed = parsePayload(updateSchema, payload)
      if (!parsed.success) return parsed.result

      const { key, value } = parsed.data
      if (key === 'service_charge_pct') {
        const numericValue = Number(value)
        const withinRange = Number.isFinite(numericValue) &&
          numericValue >= SERVICE_CHARGE_PCT_RANGE.min &&
          numericValue <= SERVICE_CHARGE_PCT_RANGE.max
        if (!withinRange) {
          return {
            success: false,
            error: `service_charge_pct debe estar entre ${SERVICE_CHARGE_PCT_RANGE.min} y ${SERVICE_CHARGE_PCT_RANGE.max}`,
            code: 'VALIDATION_ERROR',
          }
        }
      }
      await settingsService.set(key, value, actor.id)
      return { success: true }
    })
  )
}

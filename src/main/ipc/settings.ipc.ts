import { ipcMain } from 'electron'
import { settingsService } from '../services/settings.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { requirePermission, withAuthenticatedActor } from './authz'

const SERVICE_CHARGE_PCT_RANGE = { min: 0, max: 100 }

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (event, key: string) =>
    withAuthenticatedActor(event, async () => settingsService.get(key))
  )

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, async (event) =>
    withAuthenticatedActor(event, async () => settingsService.getAll())
  )

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_UPDATE,
    requirePermission('settings.manage', async (_, actor, { key, value }) => {
      if (key === 'service_charge_pct') {
        const numericValue = Number(value)
        const withinRange = Number.isFinite(numericValue) &&
          numericValue >= SERVICE_CHARGE_PCT_RANGE.min &&
          numericValue <= SERVICE_CHARGE_PCT_RANGE.max
        if (!withinRange) {
          return {
            success: false,
            error: `service_charge_pct debe estar entre ${SERVICE_CHARGE_PCT_RANGE.min} y ${SERVICE_CHARGE_PCT_RANGE.max}`,
            code: 'OUT_OF_RANGE',
          }
        }
      }
      await settingsService.set(key, value, actor.id)
      return { success: true }
    })
  )
}

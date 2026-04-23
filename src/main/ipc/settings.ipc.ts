import { ipcMain } from 'electron'
import { settingsService } from '../services/settings.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { requirePermission, withAuthenticatedActor } from './authz'

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
      await settingsService.set(key, value, actor.id)
      return { success: true }
    })
  )
}

import { ipcMain } from 'electron'
import { settingsService } from '../services/settings.service'
import { IPC_CHANNELS } from '@shared/types/ipc'

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_, key: string) => {
    return settingsService.get(key)
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, async () => {
    return settingsService.getAll()
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, async (_, { key, value, updatedBy }) => {
    await settingsService.set(key, value, updatedBy)
    return { success: true }
  })
}

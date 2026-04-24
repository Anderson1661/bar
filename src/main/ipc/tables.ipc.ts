import { ipcMain } from 'electron'
import { tablesService } from '../services/tables.service'
import { IPC_CHANNELS } from '@shared/types/ipc'

export function registerTablesIpc(): void {
  ipcMain.handle(IPC_CHANNELS.TABLES_LIST, async () => {
    return tablesService.list()
  })

  ipcMain.handle(IPC_CHANNELS.TABLES_GET, async (_, id: number) => {
    return tablesService.getById(id)
  })

  ipcMain.handle(IPC_CHANNELS.TABLES_CREATE, async (_, { data, actorId, actorUsername }) => {
    return tablesService.create(data, actorId, actorUsername)
  })

  ipcMain.handle(IPC_CHANNELS.TABLES_UPDATE, async (_, { id, data, actorId, actorUsername }) => {
    return tablesService.update(id, data, actorId, actorUsername)
  })

  ipcMain.handle(IPC_CHANNELS.TABLES_STATUS, async (_, { id, status }) => {
    await tablesService.updateStatus(id, status)
    return { success: true }
  })
}

import { ipcMain } from 'electron'
import { tablesService } from '../services/tables.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { withAuthenticatedActor } from './authz'

export function registerTablesIpc(): void {
  ipcMain.handle(IPC_CHANNELS.TABLES_LIST, async () => {
    return tablesService.list()
  })

  ipcMain.handle(IPC_CHANNELS.TABLES_GET, async (_, id: number) => {
    return tablesService.getById(id)
  })

  ipcMain.handle(IPC_CHANNELS.TABLES_CREATE, async (event, { data }) =>
    withAuthenticatedActor(event, async (actor) => tablesService.create(data, actor.id, actor.username))
  )

  ipcMain.handle(IPC_CHANNELS.TABLES_UPDATE, async (event, { id, data }) =>
    withAuthenticatedActor(event, async (actor) => tablesService.update(id, data, actor.id, actor.username))
  )

  ipcMain.handle(IPC_CHANNELS.TABLES_STATUS, async (_, { id, status }) => {
    await tablesService.updateStatus(id, status)
    return { success: true }
  })
}

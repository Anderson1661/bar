import { ipcMain } from 'electron'
import { tablesService } from '../services/tables.service'
import { validateSessionToken } from '../services/session.service'
import { IPC_CHANNELS } from '@shared/types/ipc'

export function registerTablesIpc(): void {
  ipcMain.handle(IPC_CHANNELS.TABLES_LIST, async () => {
    return tablesService.list()
  })

  ipcMain.handle(IPC_CHANNELS.TABLES_GET, async (_, id: number) => {
    return tablesService.getById(id)
  })

  ipcMain.handle(IPC_CHANNELS.TABLES_CREATE, async (_, { data, sessionToken, actorId, actorUsername }) => {
    // Support both sessionToken (new) and actorId/actorUsername (legacy)
    if (sessionToken) {
      const ctx = await validateSessionToken(sessionToken)
      if (!ctx) return { success: false, error: 'Sesión inválida', code: 'UNAUTHORIZED' }
      if (ctx.roleName !== 'admin') return { success: false, error: 'Se requiere rol administrador', code: 'FORBIDDEN' }
      return tablesService.create(data, ctx.userId, ctx.username)
    }
    return tablesService.create(data, actorId, actorUsername)
  })

  ipcMain.handle(IPC_CHANNELS.TABLES_UPDATE, async (_, { id, data, sessionToken, actorId, actorUsername }) => {
    if (sessionToken) {
      const ctx = await validateSessionToken(sessionToken)
      if (!ctx) return { success: false, error: 'Sesión inválida', code: 'UNAUTHORIZED' }
      if (ctx.roleName !== 'admin') return { success: false, error: 'Se requiere rol administrador', code: 'FORBIDDEN' }
      return tablesService.update(id, data, ctx.userId, ctx.username)
    }
    return tablesService.update(id, data, actorId, actorUsername)
  })

  ipcMain.handle(IPC_CHANNELS.TABLES_STATUS, async (_, { id, status }) => {
    await tablesService.updateStatus(id, status)
    return { success: true }
  })
}

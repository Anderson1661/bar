import { ipcMain } from 'electron'
import { usersService } from '../services/users.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { requirePermission } from './authz'

export function registerUsersIpc(): void {
  ipcMain.handle(IPC_CHANNELS.USERS_LIST, async () => {
    return usersService.list()
  })

  ipcMain.handle(
    IPC_CHANNELS.USERS_CREATE,
    requirePermission('users.manage', async (_, actor, { dto }) => usersService.create(dto, actor))
  )

  ipcMain.handle(
    IPC_CHANNELS.USERS_UPDATE,
    requirePermission('users.manage', async (_, actor, { dto }) => usersService.update(dto, actor))
  )
}

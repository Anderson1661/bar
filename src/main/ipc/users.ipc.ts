import { ipcMain } from 'electron'
import { usersService } from '../services/users.service'
import { IPC_CHANNELS } from '@shared/types/ipc'

export function registerUsersIpc(): void {
  ipcMain.handle(IPC_CHANNELS.USERS_LIST, async () => {
    return usersService.list()
  })

  ipcMain.handle(IPC_CHANNELS.USERS_CREATE, async (_, { dto, actorId, actorUsername }) => {
    return usersService.create(dto, actorId, actorUsername)
  })

  ipcMain.handle(IPC_CHANNELS.USERS_UPDATE, async (_, { dto, actorId, actorUsername }) => {
    return usersService.update(dto, actorId, actorUsername)
  })
}

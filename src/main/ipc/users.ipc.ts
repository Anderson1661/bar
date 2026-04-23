import { ipcMain } from 'electron'
import { usersService } from '../services/users.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { requirePermission } from './authz'
import { createUserDTOSchema, updateUserDTOSchema, wrappedDto } from '@shared/schemas/dtos'
import { parsePayload } from './validation'

export function registerUsersIpc(): void {
  ipcMain.handle(IPC_CHANNELS.USERS_LIST, async () => usersService.list())

  ipcMain.handle(
    IPC_CHANNELS.USERS_CREATE,
    requirePermission('users.manage', async (_, actor, payload) => {
      const parsed = parsePayload(wrappedDto(createUserDTOSchema), payload)
      if (!parsed.success) return parsed.result
      return usersService.create(parsed.data.dto, actor)
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.USERS_UPDATE,
    requirePermission('users.manage', async (_, actor, payload) => {
      const parsed = parsePayload(wrappedDto(updateUserDTOSchema), payload)
      if (!parsed.success) return parsed.result
      return usersService.update(parsed.data.dto, actor)
    })
  )
}

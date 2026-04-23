import { ipcMain } from 'electron'
import { authService } from '../services/auth.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import type { LoginDTO, ChangePasswordDTO } from '@shared/types/dtos'
import { clearSession, createSession, requireSessionActor } from './session'

export function registerAuthIpc(): void {
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (event, dto: LoginDTO) => {
    const result = await authService.login(dto)
    if (result.success && result.data) {
      createSession(event, {
        ...result.data.user,
        token: result.data.token,
      })
    }
    return result
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async (event) => {
    clearSession(event)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_CHANGE_PASSWORD, async (event, dto: ChangePasswordDTO) => {
    const actor = requireSessionActor(event)
    return authService.changePassword({ ...dto, userId: actor.id })
  })
}

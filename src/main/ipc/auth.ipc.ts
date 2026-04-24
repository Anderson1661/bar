import { ipcMain } from 'electron'
import { authService } from '../services/auth.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import type { LoginDTO, ChangePasswordDTO } from '@shared/types/dtos'

export function registerAuthIpc(): void {
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (_, dto: LoginDTO) => {
    return authService.login(dto)
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_CHANGE_PASSWORD, async (_, dto: ChangePasswordDTO) => {
    return authService.changePassword(dto)
  })
}

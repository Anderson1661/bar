import { ipcMain } from 'electron'
import { authService } from '../services/auth.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { clearSession, createSession, getSessionActor, requireSessionActor } from './session'
import { changePasswordDTOSchema, loginDTOSchema } from '@shared/schemas/dtos'
import { parsePayload } from './validation'

export function registerAuthIpc(): void {
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (event, payload) => {
    const parsed = parsePayload(loginDTOSchema, payload)
    if (!parsed.success) return parsed.result

    const result = await authService.login(parsed.data)
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

  ipcMain.handle(IPC_CHANNELS.AUTH_VERIFY_TOKEN, async (event) => {
    const actor = getSessionActor(event)
    if (!actor) {
      return { success: false, error: 'Sesión inválida o expirada', code: 'UNAUTHENTICATED' }
    }

    return {
      success: true,
      data: {
        user: {
          id: actor.id,
          username: actor.username,
          fullName: actor.fullName,
          roleName: actor.roleName,
          permissions: actor.permissions,
        },
        token: actor.token,
      },
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_CHANGE_PASSWORD, async (event, payload) => {
    const parsed = parsePayload(changePasswordDTOSchema, payload)
    if (!parsed.success) return parsed.result

    const actor = requireSessionActor(event)
    return authService.changePassword({ ...parsed.data, userId: actor.id })
  })
}

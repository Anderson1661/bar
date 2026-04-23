import { ipcMain } from 'electron'
import { cashService } from '../services/cash.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { requirePermission, withAuthenticatedActor } from './authz'

export function registerCashIpc(): void {
  ipcMain.handle(IPC_CHANNELS.CASH_CURRENT_SESSION, async () => {
    return cashService.getCurrentSession()
  })

  ipcMain.handle(IPC_CHANNELS.CASH_OPEN_SESSION, async (event, { dto }) =>
    withAuthenticatedActor(event, async (actor) => cashService.open(dto, actor))
  )

  ipcMain.handle(
    IPC_CHANNELS.CASH_CLOSE_SESSION,
    requirePermission('cash.close', async (_, actor, { dto }) => cashService.close(dto, actor))
  )

  ipcMain.handle(IPC_CHANNELS.CASH_SESSION_SUMMARY, async (_, sessionId: number) => {
    return cashService.getSessionSummary(sessionId)
  })
}

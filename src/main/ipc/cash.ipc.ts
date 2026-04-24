import { ipcMain } from 'electron'
import { cashService } from '../services/cash.service'
import { IPC_CHANNELS } from '@shared/types/ipc'

export function registerCashIpc(): void {
  ipcMain.handle(IPC_CHANNELS.CASH_CURRENT_SESSION, async () => {
    return cashService.getCurrentSession()
  })

  ipcMain.handle(IPC_CHANNELS.CASH_OPEN_SESSION, async (_, { dto, actorUsername }) => {
    return cashService.open(dto, actorUsername)
  })

  ipcMain.handle(IPC_CHANNELS.CASH_CLOSE_SESSION, async (_, { dto, actorUsername }) => {
    return cashService.close(dto, actorUsername)
  })

  ipcMain.handle(IPC_CHANNELS.CASH_SESSION_SUMMARY, async (_, sessionId: number) => {
    return cashService.getSessionSummary(sessionId)
  })
}

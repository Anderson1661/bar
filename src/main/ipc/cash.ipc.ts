import { ipcMain } from 'electron'
import { cashService } from '../services/cash.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { requirePermission, withAuthenticatedActor } from './authz'
import { closeCashSessionDTOSchema, idParamSchema, openCashSessionDTOSchema, wrappedDto } from '@shared/schemas/dtos'
import { parsePayload } from './validation'

export function registerCashIpc(): void {
  ipcMain.handle(IPC_CHANNELS.CASH_CURRENT_SESSION, async () => cashService.getCurrentSession())

  ipcMain.handle(IPC_CHANNELS.CASH_OPEN_SESSION, async (event, payload) => {
    const parsed = parsePayload(wrappedDto(openCashSessionDTOSchema), payload)
    if (!parsed.success) return parsed.result
    return withAuthenticatedActor(event, async (actor) => cashService.open({ ...parsed.data.dto, openedBy: actor.id }, actor))
  })

  ipcMain.handle(
    IPC_CHANNELS.CASH_CLOSE_SESSION,
    requirePermission('cash.close', async (_, actor, payload) => {
      const parsed = parsePayload(wrappedDto(closeCashSessionDTOSchema), payload)
      if (!parsed.success) return parsed.result
      return cashService.close({ ...parsed.data.dto, closedBy: actor.id }, actor)
    })
  )

  ipcMain.handle(IPC_CHANNELS.CASH_SESSION_SUMMARY, async (_, payload) => {
    const parsed = parsePayload(idParamSchema, payload)
    if (!parsed.success) return parsed.result
    return cashService.getSessionSummary(parsed.data)
  })
}

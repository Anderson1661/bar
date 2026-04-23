import { ipcMain } from 'electron'
import { paymentsService } from '../services/payments.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { requirePermission, withAuthenticatedActor } from './authz'
import { closeOrderDTOSchema, idParamSchema, registerPaymentDTOSchema, wrappedDto } from '@shared/schemas/dtos'
import { parsePayload } from './validation'

export function registerPaymentsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.PAYMENTS_GET_BY_ORDER, async (_, payload) => {
    const parsed = parsePayload(idParamSchema, payload)
    if (!parsed.success) return parsed.result
    return paymentsService.getByOrder(parsed.data)
  })

  ipcMain.handle(IPC_CHANNELS.PAYMENTS_METHODS, async () => paymentsService.getPaymentMethods())

  ipcMain.handle(IPC_CHANNELS.PAYMENTS_REGISTER, async (event, payload) => {
    const parsed = parsePayload(wrappedDto(registerPaymentDTOSchema), payload)
    if (!parsed.success) return parsed.result
    return withAuthenticatedActor(event, async (actor) => paymentsService.registerPayment({ ...parsed.data.dto, receivedBy: actor.id }, actor))
  })

  ipcMain.handle(
    IPC_CHANNELS.PAYMENTS_CLOSE_ORDER,
    requirePermission('payments.close', async (_, actor, payload) => {
      const parsed = parsePayload(wrappedDto(closeOrderDTOSchema), payload)
      if (!parsed.success) return parsed.result
      return paymentsService.closeOrder({ ...parsed.data.dto, closedBy: actor.id }, actor)
    })
  )
}

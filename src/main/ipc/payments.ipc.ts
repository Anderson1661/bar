import { ipcMain } from 'electron'
import { paymentsService } from '../services/payments.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { requirePermission, withAuthenticatedActor } from './authz'

export function registerPaymentsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.PAYMENTS_GET_BY_ORDER, async (_, orderId: number) => {
    return paymentsService.getByOrder(orderId)
  })

  ipcMain.handle(IPC_CHANNELS.PAYMENTS_METHODS, async () => {
    return paymentsService.getPaymentMethods()
  })

  ipcMain.handle(IPC_CHANNELS.PAYMENTS_REGISTER, async (event, { dto }) =>
    withAuthenticatedActor(event, async (actor) => paymentsService.registerPayment(dto, actor))
  )

  ipcMain.handle(
    IPC_CHANNELS.PAYMENTS_CLOSE_ORDER,
    requirePermission('payments.close', async (_, actor, { dto }) => paymentsService.closeOrder(dto, actor))
  )
}

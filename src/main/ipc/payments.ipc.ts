import { ipcMain } from 'electron'
import { paymentsService } from '../services/payments.service'
import { IPC_CHANNELS } from '@shared/types/ipc'

export function registerPaymentsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.PAYMENTS_GET_BY_ORDER, async (_, orderId: number) => {
    return paymentsService.getByOrder(orderId)
  })

  ipcMain.handle(IPC_CHANNELS.PAYMENTS_METHODS, async () => {
    return paymentsService.getPaymentMethods()
  })

  ipcMain.handle(IPC_CHANNELS.PAYMENTS_REGISTER, async (_, { dto, actorUsername }) => {
    return paymentsService.registerPayment(dto, actorUsername)
  })

  ipcMain.handle(IPC_CHANNELS.PAYMENTS_CLOSE_ORDER, async (_, { dto, actorUsername }) => {
    return paymentsService.closeOrder(dto, actorUsername)
  })
}

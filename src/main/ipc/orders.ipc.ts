import { ipcMain } from 'electron'
import { ordersService } from '../services/orders.service'
import { IPC_CHANNELS } from '@shared/types/ipc'

export function registerOrdersIpc(): void {
  ipcMain.handle(IPC_CHANNELS.ORDERS_CREATE, async (_, { dto }) => {
    return ordersService.create(dto)
  })

  ipcMain.handle(IPC_CHANNELS.ORDERS_GET, async (_, id: number) => {
    return ordersService.getById(id)
  })

  ipcMain.handle(IPC_CHANNELS.ORDERS_LIST_ACTIVE, async () => {
    return ordersService.listActive()
  })

  ipcMain.handle(IPC_CHANNELS.ORDERS_CREATE_SUBORDER, async (_, { dto, actorUsername }) => {
    return ordersService.createSubOrder(dto, actorUsername)
  })

  ipcMain.handle(IPC_CHANNELS.ORDERS_ADD_ITEM, async (_, { dto, actorId, actorUsername }) => {
    return ordersService.addItem(dto, actorId, actorUsername)
  })

  ipcMain.handle(IPC_CHANNELS.ORDERS_CANCEL_ITEM, async (_, { dto, actorId, actorUsername }) => {
    return ordersService.cancelItem(dto, actorId, actorUsername)
  })

  ipcMain.handle(IPC_CHANNELS.ORDERS_SEND_TO_BAR, async (_, { dto, actorId, actorUsername }) => {
    return ordersService.sendToBar(dto, actorId, actorUsername)
  })

  ipcMain.handle(IPC_CHANNELS.ORDERS_REQUEST_BILL, async (_, orderId: number) => {
    return ordersService.requestBill(orderId)
  })

  ipcMain.handle(IPC_CHANNELS.ORDERS_RELEASE_EMPTY, async (_, { orderId, actorId, actorUsername }) => {
    return ordersService.releaseEmpty(orderId, actorId, actorUsername)
  })
}

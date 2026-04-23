import { ipcMain } from 'electron'
import { ordersService } from '../services/orders.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { withAuthenticatedActor } from './authz'

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

  ipcMain.handle(IPC_CHANNELS.ORDERS_CREATE_SUBORDER, async (event, { dto }) =>
    withAuthenticatedActor(event, async (actor) => ordersService.createSubOrder({ ...dto, createdBy: actor.id }, actor.username))
  )

  ipcMain.handle(IPC_CHANNELS.ORDERS_ADD_ITEM, async (event, { dto }) =>
    withAuthenticatedActor(event, async (actor) => ordersService.addItem(dto, actor.id, actor.username))
  )

  ipcMain.handle(IPC_CHANNELS.ORDERS_CANCEL_ITEM, async (event, { dto }) =>
    withAuthenticatedActor(event, async (actor) => ordersService.cancelItem(dto, actor.id, actor.username))
  )

  ipcMain.handle(IPC_CHANNELS.ORDERS_SEND_TO_BAR, async (event, { dto }) =>
    withAuthenticatedActor(event, async (actor) => ordersService.sendToBar(dto, actor.id, actor.username))
  )

  ipcMain.handle(IPC_CHANNELS.ORDERS_REQUEST_BILL, async (_, orderId: number) => {
    return ordersService.requestBill(orderId)
  })

  ipcMain.handle(IPC_CHANNELS.ORDERS_RELEASE_EMPTY, async (event, { orderId }) =>
    withAuthenticatedActor(event, async (actor) => ordersService.releaseEmpty(orderId, actor.id, actor.username))
  )
}

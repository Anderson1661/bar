import { ipcMain } from 'electron'
import { ordersService } from '../services/orders.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { withAuthenticatedActor } from './authz'
import {
  addOrderItemDTOSchema,
  cancelOrderItemDTOSchema,
  createOrderDTOSchema,
  createSubOrderDTOSchema,
  idParamSchema,
  sendToBarDTOSchema,
  wrappedDto,
} from '@shared/schemas/dtos'
import { z } from 'zod'
import { parsePayload } from './validation'

export function registerOrdersIpc(): void {
  ipcMain.handle(IPC_CHANNELS.ORDERS_CREATE, async (_, payload) => {
    const parsed = parsePayload(wrappedDto(createOrderDTOSchema), payload)
    if (!parsed.success) return parsed.result
    return ordersService.create(parsed.data.dto)
  })

  ipcMain.handle(IPC_CHANNELS.ORDERS_GET, async (_, payload) => {
    const parsed = parsePayload(idParamSchema, payload)
    if (!parsed.success) return parsed.result
    return ordersService.getById(parsed.data)
  })

  ipcMain.handle(IPC_CHANNELS.ORDERS_LIST_ACTIVE, async () => ordersService.listActive())

  ipcMain.handle(IPC_CHANNELS.ORDERS_CREATE_SUBORDER, async (event, payload) => {
    const parsed = parsePayload(wrappedDto(createSubOrderDTOSchema), payload)
    if (!parsed.success) return parsed.result
    return withAuthenticatedActor(event, async (actor) =>
      ordersService.createSubOrder({ ...parsed.data.dto, createdBy: actor.id }, actor.username)
    )
  })

  ipcMain.handle(IPC_CHANNELS.ORDERS_ADD_ITEM, async (event, payload) => {
    const parsed = parsePayload(wrappedDto(addOrderItemDTOSchema), payload)
    if (!parsed.success) return parsed.result
    return withAuthenticatedActor(event, async (actor) => ordersService.addItem(parsed.data.dto, actor.id, actor.username))
  })

  ipcMain.handle(IPC_CHANNELS.ORDERS_CANCEL_ITEM, async (event, payload) => {
    const parsed = parsePayload(wrappedDto(cancelOrderItemDTOSchema), payload)
    if (!parsed.success) return parsed.result
    return withAuthenticatedActor(event, async (actor) =>
      ordersService.cancelItem({ ...parsed.data.dto, cancelledBy: actor.id }, actor.id, actor.username)
    )
  })

  ipcMain.handle(IPC_CHANNELS.ORDERS_SEND_TO_BAR, async (event, payload) => {
    const parsed = parsePayload(wrappedDto(sendToBarDTOSchema), payload)
    if (!parsed.success) return parsed.result
    return withAuthenticatedActor(event, async (actor) => ordersService.sendToBar(parsed.data.dto, actor.id, actor.username))
  })

  ipcMain.handle(IPC_CHANNELS.ORDERS_REQUEST_BILL, async (_, payload) => {
    const parsed = parsePayload(idParamSchema, payload)
    if (!parsed.success) return parsed.result
    return ordersService.requestBill(parsed.data)
  })

  ipcMain.handle(IPC_CHANNELS.ORDERS_RELEASE_EMPTY, async (event, payload) => {
    const parsed = parsePayload(zOrderId, payload)
    if (!parsed.success) return parsed.result
    return withAuthenticatedActor(event, async (actor) => ordersService.releaseEmpty(parsed.data.orderId, actor.id, actor.username))
  })
}

const zOrderId = z.object({ orderId: idParamSchema })

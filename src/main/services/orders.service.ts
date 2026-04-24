import type mysql from 'mysql2/promise'
import { asNullableTrimmed, withTransaction } from '../database/connection'
import { auditLog } from '../utils/audit'
import { settingsService } from './settings.service'
import type { Order, OrderItem, SubOrder } from '@shared/types/entities'
import type {
  AddOrderItemDTO,
  ApiResult,
  CancelOrderItemDTO,
  CreateOrderDTO,
  CreateSubOrderDTO,
  SendToBarDTO,
  SendToBarResponse,
} from '@shared/types/dtos'
import { ordersRepository } from '../repositories/orders.repository'


class TableBusyError extends Error {
  constructor() {
    super('TABLE_BUSY')
    this.name = 'TableBusyError'
  }
}

function isTableBusyConstraintError(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null
  if (!err) return false
  return err.code === 'ER_DUP_ENTRY' && Boolean(err.message?.includes('uq_orders_table_open'))
}


export class OrdersService {
  async getById(id: number): Promise<Order | null> {
    const order = await ordersRepository.getById(id)
    if (!order) return null
    const [items, subOrders] = await Promise.all([
      this.getItems(id),
      this.getSubOrders(id),
    ])

    order.items = items
    order.subOrders = subOrders.map((subOrder) => ({
      ...subOrder,
      items: items.filter((item) => item.subOrderId === subOrder.id),
    }))

    return order
  }

  async listActive(): Promise<Order[]> {
    return ordersRepository.listActive()
  }

  async getByTable(tableId: number): Promise<Order | null> {
    const order = await ordersRepository.getByTable(tableId)
    if (!order) return null
    return this.getById(order.id)
  }

  async getItems(orderId: number): Promise<OrderItem[]> {
    return ordersRepository.getItems(orderId)
  }

  async getSubOrders(orderId: number): Promise<SubOrder[]> {
    return ordersRepository.getSubOrders(orderId)
  }

  async create(dto: CreateOrderDTO): Promise<ApiResult<Order>> {
    try {
      const orderId = await withTransaction(async (conn) => {
        await ordersRepository.lockTableById(conn, dto.tableId)
        const existing = await ordersRepository.findOpenOrderByTable(conn, dto.tableId)
        if (existing) {
          throw new TableBusyError()
        }

        const orderId = await ordersRepository.createOrder(conn, dto.tableId, dto.waiterId, dto.notes)
        await ordersRepository.updateTableStatus(conn, dto.tableId, 'occupied')
        await ordersRepository.createSubOrder(conn, orderId, 1, 'Tanda 1', dto.waiterId)
        return orderId
      })

      await auditLog({
        userId: dto.waiterId,
        username: 'system',
        action: 'CREATE',
        module: 'orders',
        recordId: String(orderId),
        entityType: 'order',
        entityId: String(orderId),
        description: `Orden abierta en mesa ${dto.tableId}`,
        details: { tableId: dto.tableId, waiterId: dto.waiterId },
      })

      const order = await this.getById(orderId)
      return { success: true, data: order! }
    } catch (error) {
      if (error instanceof TableBusyError || isTableBusyConstraintError(error)) {
        return { success: false, error: 'La mesa ya tiene una cuenta abierta', code: 'TABLE_BUSY' }
      }
      throw error
    }
  }

  async createSubOrder(dto: CreateSubOrderDTO, actorUsername: string): Promise<ApiResult<SubOrder>> {
    const order = await ordersRepository.getOrderState(dto.orderId)
    if (!order) return { success: false, error: 'Orden no encontrada', code: 'NOT_FOUND' }
    if (!['open', 'pending_payment'].includes(order.status)) {
      return { success: false, error: 'No se pueden crear tandas en una orden cerrada', code: 'ORDER_LOCKED' }
    }

    const roundNumber = await ordersRepository.getLastRound(dto.orderId) + 1
    const insertId = await ordersRepository.createSubOrder(
      undefined,
      dto.orderId,
      roundNumber,
      asNullableTrimmed(dto.label) ?? `Tanda ${roundNumber}`,
      dto.createdBy
    )

    await auditLog({
      userId: dto.createdBy,
      username: actorUsername,
      action: 'CREATE_SUBORDER',
      module: 'orders',
      recordId: String(insertId),
      entityType: 'sub_order',
      entityId: String(insertId),
      description: `Tanda ${roundNumber} creada en orden ${dto.orderId}`,
      details: { orderId: dto.orderId, roundNumber },
    })

    const subOrders = await this.getSubOrders(dto.orderId)
    return { success: true, data: subOrders.find((subOrder) => subOrder.id === insertId)! }
  }

  async addItem(dto: AddOrderItemDTO, actorId: number, actorUsername: string): Promise<ApiResult<OrderItem>> {
    const quantity = Number(dto.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { success: false, error: 'La cantidad debe ser mayor a cero', code: 'INVALID_QUANTITY' }
    }

    const order = await ordersRepository.getOrderState(dto.orderId)
    if (!order) return { success: false, error: 'Orden no encontrada', code: 'NOT_FOUND' }
    if (order.status !== 'open') {
      return { success: false, error: 'No se pueden agregar ítems a una orden en cobro o cerrada', code: 'ORDER_LOCKED' }
    }

    const product = await ordersRepository.getProductForOrderItem(dto.productId)
    if (!product || !product.is_active) {
      return { success: false, error: 'Producto no disponible', code: 'PRODUCT_UNAVAILABLE' }
    }

    const targetSubOrderId = await this.resolveSubOrderId(dto.orderId, dto.subOrderId)
    if (!targetSubOrderId) {
      return { success: false, error: 'No se encontró una tanda válida para agregar el producto', code: 'SUBORDER_NOT_FOUND' }
    }

    const strictStock = await settingsService.getBool('strict_stock_control')
    if (strictStock && product.track_inventory && Number(product.stock) < quantity) {
      return { success: false, error: `Stock insuficiente. Disponible: ${product.stock}`, code: 'INSUFFICIENT_STOCK' }
    }

    const unitPrice = Number(product.sale_price)
    const subtotal = unitPrice * quantity

    const insertId = await ordersRepository.insertOrderItem({
      orderId: dto.orderId,
      subOrderId: targetSubOrderId,
      productId: dto.productId,
      quantity,
      unitPrice,
      subtotal,
      notes: dto.notes,
      actorId,
    })

    await this.recalcOrder(dto.orderId)

    await auditLog({
      userId: actorId,
      username: actorUsername,
      action: 'ADD_ITEM',
      module: 'orders',
      recordId: String(insertId),
      entityType: 'order_item',
      entityId: String(insertId),
      description: `Producto "${product.name}" agregado a orden ${dto.orderId}`,
      details: { orderId: dto.orderId, subOrderId: targetSubOrderId, productId: dto.productId, quantity },
    })

    return { success: true, data: (await this.getItems(dto.orderId)).find((item) => item.id === insertId)! }
  }

  async cancelItem(dto: CancelOrderItemDTO, actorId: number, actorUsername: string): Promise<ApiResult> {
    const item = await ordersRepository.getOrderItemState(dto.orderItemId)
    if (!item) return { success: false, error: 'Ítem no encontrado', code: 'NOT_FOUND' }
    if (item.status === 'cancelled') {
      return { success: false, error: 'El ítem ya está cancelado', code: 'ALREADY_CANCELLED' }
    }

    await withTransaction(async (conn) => {
      await ordersRepository.cancelOrderItem(conn, dto.orderItemId, dto.cancelledBy, dto.reason)

      await this.recalcOrder(item.order_id, conn)

      await auditLog({
        userId: actorId,
        username: actorUsername,
        action: 'CANCEL',
        module: 'orders',
        recordId: String(dto.orderItemId),
        entityType: 'order_item',
        entityId: String(dto.orderItemId),
        description: `Ítem cancelado en orden ${item.order_id}`,
        details: { orderId: item.order_id, subOrderId: item.sub_order_id, reason: dto.reason },
        oldValues: { status: item.status },
        newValues: { status: 'cancelled' },
      }, { conn, mode: 'critical' })
    })

    return { success: true }
  }

  async sendToBar(dto: SendToBarDTO, actorId: number, actorUsername: string): Promise<ApiResult<SendToBarResponse>> {
    const orderMeta = await ordersRepository.getOrderMeta(dto.orderId)
    if (!orderMeta) return { success: false, error: 'Orden no encontrada', code: 'NOT_FOUND' }

    const ids = await ordersRepository.getPendingItemsToSend(dto.orderId, dto.itemIds)
    if (!ids.length) {
      return { success: false, error: 'No hay ítems pendientes de envío a barra', code: 'NOTHING_TO_SEND' }
    }
    await ordersRepository.markItemsAsSent(ids)
    const sent = await ordersRepository.getItemsByIds(ids)

    await auditLog({
      userId: actorId,
      username: actorUsername,
      action: 'SEND_TO_BAR',
      module: 'orders',
      recordId: String(dto.orderId),
      entityType: 'order',
      entityId: String(dto.orderId),
      description: `${ids.length} ítem(s) enviados a barra`,
      details: { orderId: dto.orderId, itemIds: ids },
    })

    return {
      success: true,
      data: {
        items: sent,
        order: {
          id: orderMeta.id,
          tableId: orderMeta.table_id,
          tableNumber: orderMeta.table_number,
          tableName: orderMeta.table_name,
          waiterId: orderMeta.waiter_id,
          waiterName: orderMeta.waiter_name,
        },
      },
    }
  }

  async requestBill(orderId: number): Promise<ApiResult> {
    const status = await ordersRepository.getOrderStatus(orderId)
    if (!status) return { success: false, error: 'Orden no encontrada', code: 'NOT_FOUND' }
    if (status !== 'open') {
      return { success: false, error: 'La cuenta ya está en proceso de cobro', code: 'INVALID_STATUS' }
    }

    await ordersRepository.setOrderPendingPayment(orderId)
    await ordersRepository.syncSubOrderStatusForBilling(orderId)
    await ordersRepository.setTablePendingPaymentByOrder(orderId)

    return { success: true }
  }

  async releaseEmpty(orderId: number, actorId: number, actorUsername: string): Promise<ApiResult> {
    const order = await ordersRepository.getOrderForRelease(orderId)
    if (!order) return { success: false, error: 'Orden no encontrada', code: 'NOT_FOUND' }
    if (order.status !== 'open') {
      return { success: false, error: 'Solo se puede liberar una orden abierta', code: 'INVALID_STATUS' }
    }

    const [itemCount, paymentCount] = await Promise.all([
      ordersRepository.getOrderActiveItemCount(orderId),
      ordersRepository.getOrderPaymentsCount(orderId),
    ])

    if (
      itemCount > 0 ||
      paymentCount > 0 ||
      Number(order.subtotal ?? 0) > 0 ||
      Number(order.total_paid ?? 0) > 0
    ) {
      return { success: false, error: 'La mesa ya tiene consumo o pagos y no se puede liberar', code: 'ORDER_NOT_EMPTY' }
    }

    await withTransaction(async (conn) => {
      await ordersRepository.deleteEmptyOrderCascade(conn, orderId, order.table_id)
    })

    await auditLog({
      userId: actorId,
      username: actorUsername,
      action: 'RELEASE_EMPTY',
      module: 'orders',
      recordId: String(orderId),
      entityType: 'order',
      entityId: String(orderId),
      description: `Orden vacÃ­a liberada en mesa ${order.table_number}`,
      details: { orderId, tableId: order.table_id },
    })

    return { success: true }
  }

  async recalcOrder(orderId: number, conn?: mysql.Connection): Promise<void> {
    const { pct: servicePct, active: serviceChargeActive } = await settingsService.getServiceChargeConfig()

    const subOrderRows = await ordersRepository.getSubOrderAggregates(orderId, conn)

    for (const row of subOrderRows) {
      const subtotal = Number(row.subtotal ?? 0)
      const totalPaid = Number(row.total_paid ?? 0)
      const balanceDue = Math.max(0, subtotal - totalPaid)
      const status = balanceDue <= 0
        ? 'paid'
        : totalPaid > 0
          ? 'partial'
          : 'pending'

      await ordersRepository.updateSubOrderTotals(conn, row.id, { subtotal, totalPaid, balanceDue, status })
    }

    const aggregate = await ordersRepository.getOrderAggregate(orderId, conn)
    if (!aggregate) return

    const subtotal = Number(aggregate.subtotal ?? 0)
    const serviceApplied = aggregate.service_accepted === null
      ? serviceChargeActive
      : Boolean(aggregate.service_accepted)
    const serviceCharge = serviceApplied ? Math.round(subtotal * servicePct / 100) : 0
    const total = subtotal + serviceCharge
    const totalPaid = Number(aggregate.total_paid ?? 0)
    const balanceDue = Math.max(0, total - totalPaid)

    await ordersRepository.updateOrderTotals(conn, orderId, { subtotal, serviceCharge, total, totalPaid, balanceDue })
  }

  private async resolveSubOrderId(orderId: number, requestedSubOrderId?: number): Promise<number | null> {
    if (requestedSubOrderId) {
      const subOrder = await ordersRepository.getSubOrderForOrder(requestedSubOrderId, orderId)
      if (!subOrder || subOrder.status === 'paid') return null
      return subOrder.id
    }

    return ordersRepository.getLatestOpenSubOrder(orderId)
  }
}

export const ordersService = new OrdersService()

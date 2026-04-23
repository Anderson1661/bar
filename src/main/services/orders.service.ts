import type mysql from 'mysql2/promise'
import { asNullableTrimmed, execute, query, queryOne, withTransaction } from '../database/connection'
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

interface OrderRow {
  id: number
  table_id: number
  table_number: number
  table_name: string | null
  waiter_id: number
  waiter_name: string
  cash_session_id: number | null
  status: string
  subtotal: number
  service_charge: number
  service_accepted: number | null
  total: number
  total_paid: number
  balance_due: number
  notes: string | null
  opened_at: string
  closed_at: string | null
}

interface ItemRow {
  id: number
  order_id: number
  sub_order_id: number | null
  product_id: number
  product_name: string
  category_name: string
  promotion_id: number | null
  quantity: number
  unit_price: number
  original_price: number
  discount_amount: number
  subtotal: number
  notes: string | null
  status: string
  sent_to_bar: number
  sent_at: string | null
  created_at: string
}

interface SubOrderRow {
  id: number
  order_id: number
  round_number: number
  label: string | null
  subtotal: number
  total_paid: number
  balance_due: number
  status: string
  created_by: number
  created_at: string
  closed_at: string | null
}


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

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    tableId: row.table_id,
    tableNumber: row.table_number,
    tableName: row.table_name,
    waiterId: row.waiter_id,
    waiterName: row.waiter_name,
    cashSessionId: row.cash_session_id,
    status: row.status as Order['status'],
    subtotal: Number(row.subtotal),
    serviceCharge: Number(row.service_charge),
    serviceAccepted: row.service_accepted === null ? null : Boolean(row.service_accepted),
    total: Number(row.total),
    totalPaid: Number(row.total_paid),
    balanceDue: Number(row.balance_due),
    notes: row.notes,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  }
}

function mapItem(row: ItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    subOrderId: row.sub_order_id,
    productId: row.product_id,
    productName: row.product_name,
    categoryName: row.category_name,
    promotionId: row.promotion_id,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    originalPrice: Number(row.original_price),
    discountAmount: Number(row.discount_amount),
    subtotal: Number(row.subtotal),
    notes: row.notes,
    status: row.status as OrderItem['status'],
    sentToBar: Boolean(row.sent_to_bar),
    sentAt: row.sent_at,
    createdAt: row.created_at,
  }
}

function mapSubOrder(row: SubOrderRow): SubOrder {
  return {
    id: row.id,
    orderId: row.order_id,
    roundNumber: row.round_number,
    label: row.label,
    subtotal: Number(row.subtotal),
    totalPaid: Number(row.total_paid),
    balanceDue: Number(row.balance_due),
    status: row.status as SubOrder['status'],
    createdBy: row.created_by,
    createdAt: row.created_at,
    closedAt: row.closed_at,
  }
}

const ORDER_SELECT = `
  SELECT o.*, t.number AS table_number, t.name AS table_name, u.full_name AS waiter_name
  FROM orders o
  JOIN bar_tables t ON t.id = o.table_id
  JOIN users u ON u.id = o.waiter_id`

async function executeSql(
  conn: mysql.Connection | undefined,
  sql: string,
  params: unknown[]
): Promise<{ insertId: number; affectedRows: number }> {
  if (conn) {
    const [result] = await conn.execute(sql, params)
    const normalized = result as { insertId: number; affectedRows: number }
    return { insertId: normalized.insertId, affectedRows: normalized.affectedRows }
  }

  return execute(sql, params)
}

export class OrdersService {
  async getById(id: number): Promise<Order | null> {
    const row = await queryOne<OrderRow>(`${ORDER_SELECT} WHERE o.id = ?`, [id])
    if (!row) return null

    const order = mapOrder(row)
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
    const rows = await query<OrderRow>(
      `${ORDER_SELECT} WHERE o.status IN ('open','pending_payment') ORDER BY o.opened_at`
    )
    return rows.map(mapOrder)
  }

  async getByTable(tableId: number): Promise<Order | null> {
    const row = await queryOne<OrderRow>(
      `${ORDER_SELECT} WHERE o.table_id = ? AND o.status IN ('open','pending_payment') LIMIT 1`,
      [tableId]
    )
    if (!row) return null
    return this.getById(row.id)
  }

  async getItems(orderId: number): Promise<OrderItem[]> {
    const rows = await query<ItemRow>(
      `SELECT oi.*, p.name AS product_name, pc.name AS category_name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN product_categories pc ON pc.id = p.category_id
       WHERE oi.order_id = ?
       ORDER BY COALESCE(oi.sub_order_id, 0), oi.created_at, oi.id`,
      [orderId]
    )
    return rows.map(mapItem)
  }

  async getSubOrders(orderId: number): Promise<SubOrder[]> {
    const rows = await query<SubOrderRow>(
      `SELECT so.*
       FROM sub_orders so
       WHERE so.order_id = ?
       ORDER BY so.round_number, so.id`,
      [orderId]
    )
    return rows.map(mapSubOrder)
  }

  async create(dto: CreateOrderDTO): Promise<ApiResult<Order>> {
    try {
      const orderId = await withTransaction(async (conn) => {
        await conn.execute('SELECT id FROM bar_tables WHERE id = ? FOR UPDATE', [dto.tableId])

        const [existingRows] = await conn.execute(
          `SELECT id
           FROM orders
           WHERE table_id = ? AND status IN ('open','pending_payment')
           LIMIT 1
           FOR UPDATE`,
          [dto.tableId]
        )
        if ((existingRows as { id: number }[]).length > 0) {
          throw new TableBusyError()
        }

        const orderResult = await executeSql(
          conn,
          `INSERT INTO orders (table_id, waiter_id, status, subtotal, service_charge, total, total_paid, balance_due, notes)
           VALUES (?, ?, 'open', 0, 0, 0, 0, 0, ?)`,
          [dto.tableId, dto.waiterId, asNullableTrimmed(dto.notes)]
        )

        await conn.execute('UPDATE bar_tables SET status = ? WHERE id = ?', ['occupied', dto.tableId])

        await executeSql(
          conn,
          `INSERT INTO sub_orders (order_id, round_number, label, subtotal, total_paid, balance_due, status, created_by)
           VALUES (?, 1, ?, 0, 0, 0, 'pending', ?)`,
          [orderResult.insertId, 'Tanda 1', dto.waiterId]
        )

        return orderResult.insertId
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
    const order = await queryOne<{ id: number; status: string }>(
      'SELECT id, status FROM orders WHERE id = ?',
      [dto.orderId]
    )
    if (!order) return { success: false, error: 'Orden no encontrada', code: 'NOT_FOUND' }
    if (!['open', 'pending_payment'].includes(order.status)) {
      return { success: false, error: 'No se pueden crear tandas en una orden cerrada', code: 'ORDER_LOCKED' }
    }

    const lastRound = await queryOne<{ round_number: number }>(
      'SELECT round_number FROM sub_orders WHERE order_id = ? ORDER BY round_number DESC LIMIT 1',
      [dto.orderId]
    )
    const roundNumber = Number(lastRound?.round_number ?? 0) + 1

    const { insertId } = await execute(
      `INSERT INTO sub_orders (order_id, round_number, label, subtotal, total_paid, balance_due, status, created_by)
       VALUES (?, ?, ?, 0, 0, 0, 'pending', ?)`,
      [dto.orderId, roundNumber, asNullableTrimmed(dto.label) ?? `Tanda ${roundNumber}`, dto.createdBy]
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

    const order = await queryOne<{ id: number; status: string }>(
      'SELECT id, status FROM orders WHERE id = ?',
      [dto.orderId]
    )
    if (!order) return { success: false, error: 'Orden no encontrada', code: 'NOT_FOUND' }
    if (order.status !== 'open') {
      return { success: false, error: 'No se pueden agregar ítems a una orden en cobro o cerrada', code: 'ORDER_LOCKED' }
    }

    const product = await queryOne<{ id: number; name: string; sale_price: number; stock: number; track_inventory: number; is_active: number }>(
      'SELECT id, name, sale_price, stock, track_inventory, is_active FROM products WHERE id = ?',
      [dto.productId]
    )
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

    const { insertId } = await execute(
      `INSERT INTO order_items
         (order_id, sub_order_id, product_id, quantity, unit_price, original_price, discount_amount, subtotal, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [dto.orderId, targetSubOrderId, dto.productId, quantity, unitPrice, unitPrice, subtotal, asNullableTrimmed(dto.notes), actorId]
    )

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
    const item = await queryOne<{ id: number; order_id: number; status: string; sub_order_id: number | null }>(
      'SELECT id, order_id, status, sub_order_id FROM order_items WHERE id = ?',
      [dto.orderItemId]
    )
    if (!item) return { success: false, error: 'Ítem no encontrado', code: 'NOT_FOUND' }
    if (item.status === 'cancelled') {
      return { success: false, error: 'El ítem ya está cancelado', code: 'ALREADY_CANCELLED' }
    }

    await withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE order_items SET status = 'cancelled', cancelled_by = ?, cancel_reason = ? WHERE id = ?`,
        [dto.cancelledBy, asNullableTrimmed(dto.reason), dto.orderItemId]
      )

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
    const orderMeta = await queryOne<{
      id: number
      table_id: number
      table_number: number
      table_name: string | null
      waiter_id: number
      waiter_name: string
    }>(
      `SELECT o.id, o.table_id, t.number AS table_number, t.name AS table_name, o.waiter_id, u.full_name AS waiter_name
       FROM orders o
       JOIN bar_tables t ON t.id = o.table_id
       JOIN users u ON u.id = o.waiter_id
       WHERE o.id = ?`,
      [dto.orderId]
    )
    if (!orderMeta) return { success: false, error: 'Orden no encontrada', code: 'NOT_FOUND' }

    const conditions = dto.itemIds?.length
      ? `oi.order_id = ? AND oi.id IN (${dto.itemIds.map(() => '?').join(',')}) AND oi.sent_to_bar = 0 AND oi.status = 'active'`
      : `oi.order_id = ? AND oi.sent_to_bar = 0 AND oi.status = 'active'`

    const params = dto.itemIds?.length ? [dto.orderId, ...dto.itemIds] : [dto.orderId]

    const items = await query<{ id: number }>(`SELECT oi.id FROM order_items oi WHERE ${conditions}`, params)
    if (!items.length) {
      return { success: false, error: 'No hay ítems pendientes de envío a barra', code: 'NOTHING_TO_SEND' }
    }

    const ids = items.map((item) => item.id)
    await execute(
      `UPDATE order_items SET sent_to_bar = 1, sent_at = NOW() WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    )

    const sent = await query<ItemRow>(
      `SELECT oi.*, p.name AS product_name, pc.name AS category_name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN product_categories pc ON pc.id = p.category_id
       WHERE oi.id IN (${ids.map(() => '?').join(',')})`,
      ids
    )

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
        items: sent.map(mapItem),
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
    const order = await queryOne<{ status: string }>('SELECT status FROM orders WHERE id = ?', [orderId])
    if (!order) return { success: false, error: 'Orden no encontrada', code: 'NOT_FOUND' }
    if (order.status !== 'open') {
      return { success: false, error: 'La cuenta ya está en proceso de cobro', code: 'INVALID_STATUS' }
    }

    await execute(`UPDATE orders SET status = 'pending_payment' WHERE id = ?`, [orderId])
    await execute(
      `UPDATE sub_orders
       SET status = CASE
         WHEN balance_due <= 0 THEN 'paid'
         WHEN total_paid > 0 THEN 'partial'
         ELSE 'pending'
       END,
       closed_at = CASE WHEN balance_due <= 0 THEN COALESCE(closed_at, NOW()) ELSE NULL END
       WHERE order_id = ?`,
      [orderId]
    )
    await execute(
      `UPDATE bar_tables SET status = 'pending_payment'
       WHERE id = (SELECT table_id FROM orders WHERE id = ?)`,
      [orderId]
    )

    return { success: true }
  }

  async releaseEmpty(orderId: number, actorId: number, actorUsername: string): Promise<ApiResult> {
    const order = await queryOne<{ id: number; table_id: number; table_number: number; status: string; subtotal: number; total_paid: number }>(
      `SELECT o.id, o.table_id, t.number AS table_number, o.status, o.subtotal, o.total_paid
       FROM orders o
       JOIN bar_tables t ON t.id = o.table_id
       WHERE o.id = ?`,
      [orderId]
    )
    if (!order) return { success: false, error: 'Orden no encontrada', code: 'NOT_FOUND' }
    if (order.status !== 'open') {
      return { success: false, error: 'Solo se puede liberar una orden abierta', code: 'INVALID_STATUS' }
    }

    const [itemCountRow, paymentCountRow] = await Promise.all([
      queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM order_items WHERE order_id = ? AND status = 'active'`, [orderId]),
      queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM payments WHERE order_id = ?', [orderId]),
    ])

    if (
      Number(itemCountRow?.count ?? 0) > 0 ||
      Number(paymentCountRow?.count ?? 0) > 0 ||
      Number(order.subtotal ?? 0) > 0 ||
      Number(order.total_paid ?? 0) > 0
    ) {
      return { success: false, error: 'La mesa ya tiene consumo o pagos y no se puede liberar', code: 'ORDER_NOT_EMPTY' }
    }

    await withTransaction(async (conn) => {
      await conn.execute('DELETE FROM order_items WHERE order_id = ?', [orderId])
      await conn.execute('DELETE FROM sub_orders WHERE order_id = ?', [orderId])
      await conn.execute('DELETE FROM orders WHERE id = ?', [orderId])
      await conn.execute(`UPDATE bar_tables SET status = 'available' WHERE id = ?`, [order.table_id])
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

    const subOrderRows = conn
      ? (await conn.execute(
          `SELECT so.id,
                  COALESCE(SUM(CASE WHEN oi.status = 'active' THEN oi.subtotal ELSE 0 END), 0) AS subtotal,
                  COALESCE((
                    SELECT SUM(p.amount) FROM payments p WHERE p.sub_order_id = so.id
                  ), 0) AS total_paid
           FROM sub_orders so
           LEFT JOIN order_items oi ON oi.sub_order_id = so.id
           WHERE so.order_id = ?
           GROUP BY so.id`,
          [orderId]
        ))[0] as { id: number; subtotal: number; total_paid: number }[]
      : await query<{ id: number; subtotal: number; total_paid: number }>(
          `SELECT so.id,
                  COALESCE(SUM(CASE WHEN oi.status = 'active' THEN oi.subtotal ELSE 0 END), 0) AS subtotal,
                  COALESCE((
                    SELECT SUM(p.amount) FROM payments p WHERE p.sub_order_id = so.id
                  ), 0) AS total_paid
           FROM sub_orders so
           LEFT JOIN order_items oi ON oi.sub_order_id = so.id
           WHERE so.order_id = ?
           GROUP BY so.id`,
          [orderId]
        )

    for (const row of subOrderRows) {
      const subtotal = Number(row.subtotal ?? 0)
      const totalPaid = Number(row.total_paid ?? 0)
      const balanceDue = Math.max(0, subtotal - totalPaid)
      const status = balanceDue <= 0
        ? 'paid'
        : totalPaid > 0
          ? 'partial'
          : 'pending'

      await executeSql(
        conn,
        `UPDATE sub_orders
         SET subtotal = ?, total_paid = ?, balance_due = ?, status = ?,
             closed_at = CASE WHEN ? = 'paid' THEN COALESCE(closed_at, NOW()) ELSE NULL END
         WHERE id = ?`,
        [subtotal, totalPaid, balanceDue, status, status, row.id]
      )
    }

    const orderAggregate = conn
      ? (await conn.execute(
          `SELECT
             COALESCE((SELECT SUM(subtotal) FROM sub_orders WHERE order_id = ?), 0) AS subtotal,
             COALESCE((SELECT SUM(amount) FROM payments WHERE order_id = ?), 0) AS total_paid,
             service_accepted
           FROM orders
           WHERE id = ?`,
          [orderId, orderId, orderId]
        ))[0] as { subtotal: number; total_paid: number; service_accepted: number | null }[]
      : await query<{ subtotal: number; total_paid: number; service_accepted: number | null }>(
          `SELECT
             COALESCE((SELECT SUM(subtotal) FROM sub_orders WHERE order_id = ?), 0) AS subtotal,
             COALESCE((SELECT SUM(amount) FROM payments WHERE order_id = ?), 0) AS total_paid,
             service_accepted
           FROM orders
           WHERE id = ?`,
          [orderId, orderId, orderId]
        )

    const aggregate = orderAggregate[0]
    if (!aggregate) return

    const subtotal = Number(aggregate.subtotal ?? 0)
    const serviceApplied = aggregate.service_accepted === null
      ? serviceChargeActive
      : Boolean(aggregate.service_accepted)
    const serviceCharge = serviceApplied ? Math.round(subtotal * servicePct / 100) : 0
    const total = subtotal + serviceCharge
    const totalPaid = Number(aggregate.total_paid ?? 0)
    const balanceDue = Math.max(0, total - totalPaid)

    await executeSql(
      conn,
      `UPDATE orders SET subtotal = ?, service_charge = ?, total = ?, total_paid = ?, balance_due = ? WHERE id = ?`,
      [subtotal, serviceCharge, total, totalPaid, balanceDue, orderId]
    )
  }

  private async resolveSubOrderId(orderId: number, requestedSubOrderId?: number): Promise<number | null> {
    if (requestedSubOrderId) {
      const subOrder = await queryOne<{ id: number; status: string }>(
        'SELECT id, status FROM sub_orders WHERE id = ? AND order_id = ?',
        [requestedSubOrderId, orderId]
      )
      if (!subOrder || subOrder.status === 'paid') return null
      return subOrder.id
    }

    const latestOpen = await queryOne<{ id: number }>(
      `SELECT id FROM sub_orders
       WHERE order_id = ? AND status IN ('pending', 'partial')
       ORDER BY round_number DESC, id DESC
       LIMIT 1`,
      [orderId]
    )

    return latestOpen?.id ?? null
  }
}

export const ordersService = new OrdersService()

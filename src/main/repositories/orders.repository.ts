import type mysql from 'mysql2/promise'
import { asNullableTrimmed, execute, query, queryOne } from '../database/connection'
import type { Order, OrderItem, SubOrder } from '@shared/types/entities'

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

const ORDER_SELECT = `
  SELECT o.*, t.number AS table_number, t.name AS table_name, u.full_name AS waiter_name
  FROM orders o
  JOIN bar_tables t ON t.id = o.table_id
  JOIN users u ON u.id = o.waiter_id`

const mapOrder = (row: OrderRow): Order => ({
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
})

const mapItem = (row: ItemRow): OrderItem => ({
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
})

const mapSubOrder = (row: SubOrderRow): SubOrder => ({
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
})

export class OrdersRepository {
  async getById(id: number): Promise<Order | null> {
    const row = await queryOne<OrderRow>(`${ORDER_SELECT} WHERE o.id = ?`, [id])
    return row ? mapOrder(row) : null
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
    return row ? mapOrder(row) : null
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

  async lockTableById(conn: mysql.Connection, tableId: number): Promise<void> {
    await conn.execute('SELECT id FROM bar_tables WHERE id = ? FOR UPDATE', [tableId])
  }

  async findOpenOrderByTable(conn: mysql.Connection, tableId: number): Promise<{ id: number } | null> {
    const [rows] = await conn.execute(
      `SELECT id FROM orders WHERE table_id = ? AND status IN ('open','pending_payment') LIMIT 1 FOR UPDATE`,
      [tableId]
    )
    return ((rows as { id: number }[])[0] ?? null)
  }

  async createOrder(conn: mysql.Connection, tableId: number, waiterId: number, notes?: string): Promise<number> {
    const [result] = await conn.execute(
      `INSERT INTO orders (table_id, waiter_id, status, subtotal, service_charge, total, total_paid, balance_due, notes)
       VALUES (?, ?, 'open', 0, 0, 0, 0, 0, ?)`,
      [tableId, waiterId, asNullableTrimmed(notes)]
    )
    return (result as { insertId: number }).insertId
  }

  async updateTableStatus(conn: mysql.Connection, tableId: number, status: string): Promise<void> {
    await conn.execute('UPDATE bar_tables SET status = ? WHERE id = ?', [status, tableId])
  }

  async createSubOrder(conn: mysql.Connection | undefined, orderId: number, roundNumber: number, label: string | null, createdBy: number): Promise<number> {
    const sql = `INSERT INTO sub_orders (order_id, round_number, label, subtotal, total_paid, balance_due, status, created_by)
       VALUES (?, ?, ?, 0, 0, 0, 'pending', ?)`
    const params = [orderId, roundNumber, label, createdBy]
    if (conn) {
      const [result] = await conn.execute(sql, params)
      return (result as { insertId: number }).insertId
    }
    const { insertId } = await execute(sql, params)
    return insertId
  }

  async getOrderState(orderId: number): Promise<{ id: number; status: string } | null> {
    return queryOne<{ id: number; status: string }>('SELECT id, status FROM orders WHERE id = ?', [orderId])
  }

  async getLastRound(orderId: number): Promise<number> {
    const row = await queryOne<{ round_number: number }>(
      'SELECT round_number FROM sub_orders WHERE order_id = ? ORDER BY round_number DESC LIMIT 1',
      [orderId]
    )
    return Number(row?.round_number ?? 0)
  }

  async getProductForOrderItem(productId: number) {
    return queryOne<{ id: number; name: string; sale_price: number; stock: number; track_inventory: number; is_active: number }>(
      'SELECT id, name, sale_price, stock, track_inventory, is_active FROM products WHERE id = ?',
      [productId]
    )
  }

  async insertOrderItem(input: {
    orderId: number
    subOrderId: number
    productId: number
    quantity: number
    unitPrice: number
    subtotal: number
    notes?: string
    actorId: number
  }): Promise<number> {
    const { insertId } = await execute(
      `INSERT INTO order_items
         (order_id, sub_order_id, product_id, quantity, unit_price, original_price, discount_amount, subtotal, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        input.orderId,
        input.subOrderId,
        input.productId,
        input.quantity,
        input.unitPrice,
        input.unitPrice,
        input.subtotal,
        asNullableTrimmed(input.notes),
        input.actorId,
      ]
    )
    return insertId
  }

  async getOrderItemState(orderItemId: number) {
    return queryOne<{ id: number; order_id: number; status: string; sub_order_id: number | null }>(
      'SELECT id, order_id, status, sub_order_id FROM order_items WHERE id = ?',
      [orderItemId]
    )
  }

  async cancelOrderItem(conn: mysql.Connection, orderItemId: number, cancelledBy: number, reason?: string): Promise<void> {
    await conn.execute(
      `UPDATE order_items SET status = 'cancelled', cancelled_by = ?, cancel_reason = ? WHERE id = ?`,
      [cancelledBy, asNullableTrimmed(reason), orderItemId]
    )
  }

  async getOrderMeta(orderId: number) {
    return queryOne<{
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
      [orderId]
    )
  }

  async getPendingItemsToSend(orderId: number, itemIds?: number[]): Promise<number[]> {
    const conditions = itemIds?.length
      ? `oi.order_id = ? AND oi.id IN (${itemIds.map(() => '?').join(',')}) AND oi.sent_to_bar = 0 AND oi.status = 'active'`
      : `oi.order_id = ? AND oi.sent_to_bar = 0 AND oi.status = 'active'`
    const params = itemIds?.length ? [orderId, ...itemIds] : [orderId]
    const rows = await query<{ id: number }>(`SELECT oi.id FROM order_items oi WHERE ${conditions}`, params)
    return rows.map((item) => item.id)
  }

  async markItemsAsSent(itemIds: number[]): Promise<void> {
    await execute(
      `UPDATE order_items SET sent_to_bar = 1, sent_at = NOW() WHERE id IN (${itemIds.map(() => '?').join(',')})`,
      itemIds
    )
  }

  async getItemsByIds(itemIds: number[]): Promise<OrderItem[]> {
    const rows = await query<ItemRow>(
      `SELECT oi.*, p.name AS product_name, pc.name AS category_name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN product_categories pc ON pc.id = p.category_id
       WHERE oi.id IN (${itemIds.map(() => '?').join(',')})`,
      itemIds
    )
    return rows.map(mapItem)
  }

  async getOrderStatus(orderId: number): Promise<string | null> {
    const row = await queryOne<{ status: string }>('SELECT status FROM orders WHERE id = ?', [orderId])
    return row?.status ?? null
  }

  async setOrderPendingPayment(orderId: number): Promise<void> {
    await execute(`UPDATE orders SET status = 'pending_payment' WHERE id = ?`, [orderId])
  }

  async syncSubOrderStatusForBilling(orderId: number): Promise<void> {
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
  }

  async setTablePendingPaymentByOrder(orderId: number): Promise<void> {
    await execute(
      `UPDATE bar_tables SET status = 'pending_payment'
       WHERE id = (SELECT table_id FROM orders WHERE id = ?)`,
      [orderId]
    )
  }

  async getOrderForRelease(orderId: number) {
    return queryOne<{ id: number; table_id: number; table_number: number; status: string; subtotal: number; total_paid: number }>(
      `SELECT o.id, o.table_id, t.number AS table_number, o.status, o.subtotal, o.total_paid
       FROM orders o
       JOIN bar_tables t ON t.id = o.table_id
       WHERE o.id = ?`,
      [orderId]
    )
  }

  async getOrderActiveItemCount(orderId: number): Promise<number> {
    const row = await queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM order_items WHERE order_id = ? AND status = 'active'`, [orderId])
    return Number(row?.count ?? 0)
  }

  async getOrderPaymentsCount(orderId: number): Promise<number> {
    const row = await queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM payments WHERE order_id = ?', [orderId])
    return Number(row?.count ?? 0)
  }

  async deleteEmptyOrderCascade(conn: mysql.Connection, orderId: number, tableId: number): Promise<void> {
    await conn.execute('DELETE FROM order_items WHERE order_id = ?', [orderId])
    await conn.execute('DELETE FROM sub_orders WHERE order_id = ?', [orderId])
    await conn.execute('DELETE FROM orders WHERE id = ?', [orderId])
    await conn.execute(`UPDATE bar_tables SET status = 'available' WHERE id = ?`, [tableId])
  }

  async getSubOrderForOrder(subOrderId: number, orderId: number): Promise<{ id: number; status: string } | null> {
    return queryOne<{ id: number; status: string }>(
      'SELECT id, status FROM sub_orders WHERE id = ? AND order_id = ?',
      [subOrderId, orderId]
    )
  }

  async getLatestOpenSubOrder(orderId: number): Promise<number | null> {
    const row = await queryOne<{ id: number }>(
      `SELECT id FROM sub_orders
       WHERE order_id = ? AND status IN ('pending', 'partial')
       ORDER BY round_number DESC, id DESC
       LIMIT 1`,
      [orderId]
    )
    return row?.id ?? null
  }

  async getSubOrderAggregates(orderId: number, conn?: mysql.Connection) {
    if (conn) {
      const [rows] = await conn.execute(
        `SELECT so.id,
                COALESCE(SUM(CASE WHEN oi.status = 'active' THEN oi.subtotal ELSE 0 END), 0) AS subtotal,
                COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.sub_order_id = so.id), 0) AS total_paid
         FROM sub_orders so
         LEFT JOIN order_items oi ON oi.sub_order_id = so.id
         WHERE so.order_id = ?
         GROUP BY so.id`,
        [orderId]
      )
      return rows as { id: number; subtotal: number; total_paid: number }[]
    }

    return query<{ id: number; subtotal: number; total_paid: number }>(
      `SELECT so.id,
              COALESCE(SUM(CASE WHEN oi.status = 'active' THEN oi.subtotal ELSE 0 END), 0) AS subtotal,
              COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.sub_order_id = so.id), 0) AS total_paid
       FROM sub_orders so
       LEFT JOIN order_items oi ON oi.sub_order_id = so.id
       WHERE so.order_id = ?
       GROUP BY so.id`,
      [orderId]
    )
  }

  async updateSubOrderTotals(conn: mysql.Connection | undefined, subOrderId: number, data: {
    subtotal: number
    totalPaid: number
    balanceDue: number
    status: 'pending' | 'partial' | 'paid'
  }): Promise<void> {
    const sql = `UPDATE sub_orders
       SET subtotal = ?, total_paid = ?, balance_due = ?, status = ?,
           closed_at = CASE WHEN ? = 'paid' THEN COALESCE(closed_at, NOW()) ELSE NULL END
       WHERE id = ?`
    const params = [data.subtotal, data.totalPaid, data.balanceDue, data.status, data.status, subOrderId]
    if (conn) {
      await conn.execute(sql, params)
      return
    }
    await execute(sql, params)
  }

  async getOrderAggregate(orderId: number, conn?: mysql.Connection) {
    if (conn) {
      const [rows] = await conn.execute(
        `SELECT
           COALESCE((SELECT SUM(subtotal) FROM sub_orders WHERE order_id = ?), 0) AS subtotal,
           COALESCE((SELECT SUM(amount) FROM payments WHERE order_id = ?), 0) AS total_paid,
           service_accepted
         FROM orders
         WHERE id = ?`,
        [orderId, orderId, orderId]
      )
      return (rows as { subtotal: number; total_paid: number; service_accepted: number | null }[])[0] ?? null
    }

    const rows = await query<{ subtotal: number; total_paid: number; service_accepted: number | null }>(
      `SELECT
         COALESCE((SELECT SUM(subtotal) FROM sub_orders WHERE order_id = ?), 0) AS subtotal,
         COALESCE((SELECT SUM(amount) FROM payments WHERE order_id = ?), 0) AS total_paid,
         service_accepted
       FROM orders
       WHERE id = ?`,
      [orderId, orderId, orderId]
    )
    return rows[0] ?? null
  }

  async updateOrderTotals(conn: mysql.Connection | undefined, orderId: number, data: {
    subtotal: number
    serviceCharge: number
    total: number
    totalPaid: number
    balanceDue: number
  }): Promise<void> {
    const sql = `UPDATE orders SET subtotal = ?, service_charge = ?, total = ?, total_paid = ?, balance_due = ? WHERE id = ?`
    const params = [data.subtotal, data.serviceCharge, data.total, data.totalPaid, data.balanceDue, orderId]
    if (conn) {
      await conn.execute(sql, params)
      return
    }
    await execute(sql, params)
  }
}

export const ordersRepository = new OrdersRepository()

import type mysql from 'mysql2/promise'
import { asNullableTrimmed, execute, query, queryOne } from '../database/connection'
import type { Payment, Receipt } from '@shared/types/entities'

interface PaymentRow {
  id: number
  order_id: number
  sub_order_id: number | null
  sub_order_label: string | null
  payment_method_id: number
  payment_method_name: string
  amount: number
  tendered_amount: number
  change_given: number
  reference: string | null
  received_by: number
  received_by_name: string
  notes: string | null
  created_at: string
}

const mapPayment = (row: PaymentRow): Payment => ({
  id: row.id,
  orderId: row.order_id,
  subOrderId: row.sub_order_id,
  subOrderLabel: row.sub_order_label,
  paymentMethodId: row.payment_method_id,
  paymentMethodName: row.payment_method_name,
  amount: Number(row.amount),
  tenderedAmount: Number(row.tendered_amount),
  changeGiven: Number(row.change_given),
  reference: row.reference,
  receivedBy: row.received_by,
  receivedByName: row.received_by_name,
  notes: row.notes,
  createdAt: row.created_at,
})

export class PaymentsRepository {
  async getByOrder(orderId: number): Promise<Payment[]> {
    const rows = await query<PaymentRow>(
      `SELECT p.*, pm.name AS payment_method_name, u.full_name AS received_by_name, so.label AS sub_order_label
       FROM payments p
       JOIN payment_methods pm ON pm.id = p.payment_method_id
       JOIN users u ON u.id = p.received_by
       LEFT JOIN sub_orders so ON so.id = p.sub_order_id
       WHERE p.order_id = ?
       ORDER BY p.created_at, p.id`,
      [orderId]
    )

    return rows.map(mapPayment)
  }

  async getOrderPaymentState(orderId: number) {
    return queryOne<{ id: number; status: string; subtotal: number; total: number; total_paid: number; balance_due: number }>(
      'SELECT id, status, subtotal, total, total_paid, balance_due FROM orders WHERE id = ?',
      [orderId]
    )
  }

  async getActivePaymentMethod(paymentMethodId: number) {
    return queryOne<{ id: number; code: string; name: string }>(
      'SELECT id, code, name FROM payment_methods WHERE id = ? AND is_active = 1',
      [paymentMethodId]
    )
  }

  async updateOrderService(orderId: number, serviceAccepted: boolean, serviceCharge: number, total: number): Promise<void> {
    await execute(
      `UPDATE orders
       SET service_accepted = ?, service_charge = ?, total = ?, balance_due = GREATEST(0, ? - total_paid)
       WHERE id = ?`,
      [serviceAccepted ? 1 : 0, serviceCharge, total, total, orderId]
    )
  }

  async getOrderBalanceDue(orderId: number): Promise<number> {
    const row = await queryOne<{ balance_due: number }>('SELECT balance_due FROM orders WHERE id = ?', [orderId])
    return Number(row?.balance_due ?? 0)
  }

  async getSubOrderInfo(subOrderId: number, orderId: number) {
    return queryOne<{ id: number; balance_due: number; label: string | null }>(
      'SELECT id, balance_due, label FROM sub_orders WHERE id = ? AND order_id = ?',
      [subOrderId, orderId]
    )
  }

  async insertPayment(conn: mysql.Connection, data: {
    orderId: number
    subOrderId: number | null
    paymentMethodId: number
    appliedAmount: number
    tenderedAmount: number
    changeGiven: number
    reference?: string
    receivedBy: number
    notes?: string
  }): Promise<number> {
    const [insertResult] = await conn.execute(
      `INSERT INTO payments (order_id, sub_order_id, payment_method_id, amount, tendered_amount, change_given, reference, received_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.orderId,
        data.subOrderId,
        data.paymentMethodId,
        data.appliedAmount,
        data.tenderedAmount,
        data.changeGiven,
        asNullableTrimmed(data.reference),
        data.receivedBy,
        asNullableTrimmed(data.notes),
      ]
    )
    return (insertResult as { insertId: number }).insertId
  }

  async getOrderTotals(conn: mysql.Connection, orderId: number) {
    const [rows] = await conn.execute(
      'SELECT total, service_charge, total_paid, balance_due FROM orders WHERE id = ?',
      [orderId]
    )
    return (rows as { total: number; service_charge: number; total_paid: number; balance_due: number }[])[0]
  }

  async getOrderServiceAccepted(conn: mysql.Connection, orderId: number): Promise<boolean | null> {
    const [rows] = await conn.execute('SELECT service_accepted FROM orders WHERE id = ?', [orderId])
    const serviceAccepted = (rows as { service_accepted: number | null }[])[0]?.service_accepted
    return serviceAccepted === null ? null : Boolean(serviceAccepted)
  }

  async getOrderForClose(orderId: number) {
    return queryOne<{
      id: number
      table_id: number
      status: string
      subtotal: number
      service_charge: number
      service_accepted: number | null
      total: number
      total_paid: number
      balance_due: number
    }>(
      `SELECT id, table_id, status, subtotal, service_charge, service_accepted, total, total_paid, balance_due
       FROM orders
       WHERE id = ?`,
      [orderId]
    )
  }

  async getUpdatedOrder(orderId: number) {
    return queryOne<{ total_paid: number; balance_due: number; total: number }>(
      'SELECT total_paid, balance_due, total FROM orders WHERE id = ?',
      [orderId]
    )
  }

  async nextReceiptSequence(conn: mysql.Connection): Promise<{ prefix: string; lastNumber: number }> {
    await conn.execute('UPDATE receipt_sequence SET last_number = last_number + 1 WHERE id = 1')
    const [seqRows] = await conn.execute('SELECT prefix, last_number FROM receipt_sequence WHERE id = 1')
    const seq = (seqRows as { prefix: string; last_number: number }[])[0]
    return { prefix: seq.prefix, lastNumber: seq.last_number }
  }

  async getTotalChangeGiven(conn: mysql.Connection, orderId: number): Promise<number> {
    const [rows] = await conn.execute(
      'SELECT COALESCE(SUM(change_given), 0) AS change_given FROM payments WHERE order_id = ?',
      [orderId]
    )
    return Number(((rows as { change_given: number }[])[0]?.change_given) ?? 0)
  }

  async createReceipt(conn: mysql.Connection, data: {
    receiptNumber: string
    orderId: number
    subtotal: number
    serviceCharge: number
    total: number
    totalPaid: number
    changeGiven: number
    issuedBy: number
  }): Promise<number> {
    const [result] = await conn.execute(
      `INSERT INTO receipts (receipt_number, order_id, subtotal, service_charge, total, total_paid, change_given, issued_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.receiptNumber, data.orderId, data.subtotal, data.serviceCharge, data.total, data.totalPaid, data.changeGiven, data.issuedBy]
    )
    return (result as { insertId: number }).insertId
  }

  async closeOrderAsPaid(conn: mysql.Connection, orderId: number, tableId: number): Promise<void> {
    await conn.execute(`UPDATE orders SET status = 'paid', closed_at = NOW() WHERE id = ?`, [orderId])
    await conn.execute(
      `UPDATE sub_orders
       SET total_paid = subtotal,
           balance_due = 0,
           status = 'paid',
           closed_at = COALESCE(closed_at, NOW())
       WHERE order_id = ?`,
      [orderId]
    )
    await conn.execute(`UPDATE bar_tables SET status = 'available' WHERE id = ?`, [tableId])
  }

  async getOrderItemsForInventory(conn: mysql.Connection, orderId: number) {
    const [rows] = await conn.execute(
      `SELECT oi.product_id, oi.quantity, p.track_inventory
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ? AND oi.status = 'active'`,
      [orderId]
    )
    return rows as { product_id: number; quantity: number; track_inventory: number }[]
  }

  async getReceiptById(receiptId: number): Promise<Receipt | null> {
    return queryOne<Receipt>(
      `SELECT r.*, u.full_name AS issued_by_name
       FROM receipts r
       JOIN users u ON u.id = r.issued_by
       WHERE r.id = ?`,
      [receiptId]
    )
  }

  async getPaymentMethods(): Promise<{ id: number; name: string; code: string }[]> {
    return query<{ id: number; name: string; code: string }>(
      'SELECT id, name, code FROM payment_methods WHERE is_active = 1 ORDER BY sort_order, name'
    )
  }
}

export const paymentsRepository = new PaymentsRepository()

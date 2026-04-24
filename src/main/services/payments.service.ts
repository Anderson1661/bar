import type mysql from 'mysql2/promise'
import { asNullableTrimmed, execute, query, queryOne, withTransaction } from '../database/connection'
import { auditLog } from '../utils/audit'
import { inventoryService } from './inventory.service'
import { ordersService } from './orders.service'
import { settingsService } from './settings.service'
import type { Payment, Receipt } from '@shared/types/entities'
import type { ApiResult, CloseOrderDTO, RegisterPaymentDTO, RegisterPaymentResponseV2 } from '@shared/types/dtos'
import { RECEIPT_NUMBER_FORMAT } from '@shared/constants'
import type { TrustedActor } from '../types/actor'

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

function mapPayment(row: PaymentRow): Payment {
  return {
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
  }
}

export class PaymentsService {
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

  async registerPayment(
    dto: RegisterPaymentDTO,
    actor: TrustedActor
  ): Promise<ApiResult<RegisterPaymentResponseV2>> {
    const tenderedAmount = Number(dto.amount)
    if (!Number.isFinite(tenderedAmount) || tenderedAmount <= 0) {
      return { success: false, error: 'El monto del pago debe ser mayor a cero', code: 'INVALID_AMOUNT' }
    }

    const order = await queryOne<{ id: number; status: string; subtotal: number; total: number; total_paid: number; balance_due: number }>(
      'SELECT id, status, subtotal, total, total_paid, balance_due FROM orders WHERE id = ?',
      [dto.orderId]
    )
    if (!order) return { success: false, error: 'Orden no encontrada', code: 'NOT_FOUND' }
    if (!['open', 'pending_payment'].includes(order.status)) {
      return { success: false, error: 'No se pueden registrar pagos en una orden cerrada', code: 'ORDER_CLOSED' }
    }

    const method = await queryOne<{ id: number; code: string; name: string }>(
      'SELECT id, code, name FROM payment_methods WHERE id = ? AND is_active = 1',
      [dto.paymentMethodId]
    )
    if (!method) {
      return { success: false, error: 'Método de pago no válido', code: 'INVALID_PAYMENT_METHOD' }
    }

    const { pct: servicePct } = await settingsService.getServiceChargeConfig()

    if (dto.serviceAccepted !== undefined && dto.serviceAccepted !== null) {
      const subtotal = Number(order.subtotal)
      const serviceCharge = dto.serviceAccepted ? Math.round(subtotal * servicePct / 100) : 0
      const total = subtotal + serviceCharge
      await execute(
        `UPDATE orders
         SET service_accepted = ?, service_charge = ?, total = ?, balance_due = GREATEST(0, ? - total_paid)
         WHERE id = ?`,
        [dto.serviceAccepted ? 1 : 0, serviceCharge, total, total, dto.orderId]
      )
      await ordersService.recalcOrder(dto.orderId)
    }

    const currentOrder = await queryOne<{ balance_due: number }>(
      'SELECT balance_due FROM orders WHERE id = ?',
      [dto.orderId]
    )

    let targetBalance = Number(currentOrder?.balance_due ?? order.balance_due)
    let subOrderInfo: { id: number; balance_due: number; label: string | null } | null = null

    if (dto.subOrderId) {
      subOrderInfo = await queryOne<{ id: number; balance_due: number; label: string | null }>(
        'SELECT id, balance_due, label FROM sub_orders WHERE id = ? AND order_id = ?',
        [dto.subOrderId, dto.orderId]
      )
      if (!subOrderInfo) {
        return { success: false, error: 'La tanda seleccionada no existe en la orden', code: 'SUBORDER_NOT_FOUND' }
      }
      targetBalance = Number(subOrderInfo.balance_due)
    }

    if (targetBalance <= 0) {
      return { success: false, error: 'No hay saldo pendiente para registrar en este destino', code: 'NO_BALANCE_DUE' }
    }

    const isCash = method.code === 'cash'
    if (!isCash && tenderedAmount > targetBalance) {
      return { success: false, error: 'Los pagos electrónicos o con tarjeta no pueden exceder el saldo', code: 'OVERPAY_NOT_ALLOWED' }
    }

    const appliedAmount = isCash ? Math.min(targetBalance, tenderedAmount) : tenderedAmount
    const changeGiven = isCash ? Math.max(0, tenderedAmount - appliedAmount) : 0

    const paymentResult = await withTransaction(async (conn) => {
      const [insertResult] = await conn.execute(
        `INSERT INTO payments (order_id, sub_order_id, payment_method_id, amount, tendered_amount, change_given, reference, received_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dto.orderId,
          dto.subOrderId ?? null,
          dto.paymentMethodId,
          appliedAmount,
          tenderedAmount,
          changeGiven,
          asNullableTrimmed(dto.reference),
          actor.id,
          asNullableTrimmed(dto.notes),
        ]
      )
      const insertId = (insertResult as { insertId: number }).insertId

      await ordersService.recalcOrder(dto.orderId, conn)

      const [updatedRows] = await conn.execute(
        'SELECT total, service_charge, total_paid, balance_due FROM orders WHERE id = ?',
        [dto.orderId]
      )
      const updatedOrder = (updatedRows as { total: number; service_charge: number; total_paid: number; balance_due: number }[])[0]

      await auditLog({
        userId: actor.id,
        username: actor.username,
        action: 'PAYMENT',
        module: 'payments',
        recordId: String(insertId),
        entityType: 'payment',
        entityId: String(insertId),
        description: `Pago registrado en orden ${dto.orderId}`,
        details: {
          orderId: dto.orderId,
          subOrderId: dto.subOrderId ?? null,
          paymentMethodId: dto.paymentMethodId,
          paymentMethodCode: method.code,
          paymentMethodName: method.name,
          tenderedAmount,
          appliedAmount,
          changeGiven,
        },
      }, { conn, mode: 'critical' })

      const [serviceRows] = await conn.execute(
        'SELECT service_accepted FROM orders WHERE id = ?',
        [dto.orderId]
      )
      const serviceInfo = (serviceRows as { service_accepted: number | null }[])[0]

      return {
        insertId,
        total: Number(updatedOrder?.total ?? 0),
        serviceCharge: Number(updatedOrder?.service_charge ?? 0),
        totalPaid: Number(updatedOrder?.total_paid ?? 0),
        balanceDue: Number(updatedOrder?.balance_due ?? 0),
        serviceAccepted: serviceInfo?.service_accepted === null ? null : Boolean(serviceInfo.service_accepted),
      }
    })

    const payments = await this.getByOrder(dto.orderId)
    const payment = payments.find((entry) => entry.id === paymentResult.insertId)!

    return {
      success: true,
      data: {
        payment,
        order: {
          total: paymentResult.total,
          serviceCharge: paymentResult.serviceCharge,
          totalPaid: paymentResult.totalPaid,
          balanceDue: paymentResult.balanceDue,
          changeGiven,
        },
        serviceChargeApplied: paymentResult.serviceCharge,
        serviceAccepted: paymentResult.serviceAccepted,
        servicePct,
        version: 2,
      }
    }
  }

  async closeOrder(dto: CloseOrderDTO, actor: TrustedActor): Promise<ApiResult<Receipt>> {
    const order = await queryOne<{
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
      [dto.orderId]
    )

    if (!order) return { success: false, error: 'Orden no encontrada', code: 'NOT_FOUND' }
    if (order.status === 'paid') return { success: false, error: 'La orden ya está cerrada', code: 'ALREADY_CLOSED' }

    const { pct: servicePct } = await settingsService.getServiceChargeConfig()
    const subtotal = Number(order.subtotal)
    const serviceCharge = dto.serviceAccepted ? Math.round(subtotal * servicePct / 100) : 0
    const total = subtotal + serviceCharge

    await execute(
      `UPDATE orders
       SET service_accepted = ?, service_charge = ?, total = ?, balance_due = GREATEST(0, ? - total_paid)
       WHERE id = ?`,
      [dto.serviceAccepted ? 1 : 0, serviceCharge, total, total, dto.orderId]
    )

    await ordersService.recalcOrder(dto.orderId)

    const updatedOrder = await queryOne<{ total_paid: number; balance_due: number; total: number }>(
      'SELECT total_paid, balance_due, total FROM orders WHERE id = ?',
      [dto.orderId]
    )
    if (!updatedOrder || Number(updatedOrder.balance_due) > 0) {
      return {
        success: false,
        error: `Saldo pendiente: $${Number(updatedOrder?.balance_due ?? 0).toFixed(2)}. No se puede cerrar la cuenta.`,
        code: 'BALANCE_DUE'
      }
    }

    return withTransaction(async (conn) => {
      await conn.execute('UPDATE receipt_sequence SET last_number = last_number + 1 WHERE id = 1')
      const [seqRows] = await conn.execute('SELECT prefix, last_number FROM receipt_sequence WHERE id = 1')
      const seq = (seqRows as { prefix: string; last_number: number }[])[0]
      const receiptNumber = RECEIPT_NUMBER_FORMAT(seq.prefix, seq.last_number)

      const [changeRows] = await conn.execute(
        'SELECT COALESCE(SUM(change_given), 0) AS change_given FROM payments WHERE order_id = ?',
        [dto.orderId]
      )
      const totalChangeGiven = Number(((changeRows as { change_given: number }[])[0]?.change_given) ?? 0)

      const [receiptResult] = await conn.execute(
        `INSERT INTO receipts (receipt_number, order_id, subtotal, service_charge, total, total_paid, change_given, issued_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [receiptNumber, dto.orderId, subtotal, serviceCharge, Number(updatedOrder.total), Number(updatedOrder.total_paid), totalChangeGiven, actor.id]
      )
      const receiptId = (receiptResult as { insertId: number }).insertId

      await conn.execute(`UPDATE orders SET status = 'paid', closed_at = NOW() WHERE id = ?`, [dto.orderId])
      await conn.execute(
        `UPDATE sub_orders
         SET total_paid = subtotal,
             balance_due = 0,
             status = 'paid',
             closed_at = COALESCE(closed_at, NOW())
         WHERE order_id = ?`,
        [dto.orderId]
      )
      await conn.execute(`UPDATE bar_tables SET status = 'available' WHERE id = ?`, [order.table_id])

      const [itemRows] = await conn.execute(
        `SELECT oi.product_id, oi.quantity, p.track_inventory
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ? AND oi.status = 'active'`,
        [dto.orderId]
      )
      const items = itemRows as { product_id: number; quantity: number; track_inventory: number }[]

      for (const item of items) {
        if (item.track_inventory) {
          await inventoryService.registerMovement({
            productId: item.product_id,
            type: 'sale',
            quantity: Number(item.quantity),
            referenceId: dto.orderId,
            referenceType: 'order',
            reason: `Venta en comprobante ${receiptNumber}`,
            performedBy: actor.id,
            adminVerified: false,
            verifiedBy: null,
          }, conn as mysql.Connection)
        }
      }

      const receipt = await queryOne<Receipt>(
        `SELECT r.*, u.full_name AS issued_by_name
         FROM receipts r
         JOIN users u ON u.id = r.issued_by
         WHERE r.id = ?`,
        [receiptId]
      )

      await auditLog({
        userId: actor.id,
        username: actor.username,
        action: 'CLOSE',
        module: 'orders',
        recordId: String(dto.orderId),
        entityType: 'order',
        entityId: String(dto.orderId),
        description: `Orden cerrada con comprobante ${receiptNumber}`,
        details: {
          orderId: dto.orderId,
          receiptId,
          receiptNumber,
          subtotal,
          serviceCharge,
          total: Number(updatedOrder.total),
          totalPaid: Number(updatedOrder.total_paid),
          changeGiven: totalChangeGiven,
        },
      }, { conn, mode: 'critical' })

      return { success: true, data: receipt! }
    })
  }

  async getPaymentMethods(): Promise<{ id: number; name: string; code: string }[]> {
    return query<{ id: number; name: string; code: string }>(
      'SELECT id, name, code FROM payment_methods WHERE is_active = 1 ORDER BY sort_order, name'
    )
  }
}

export const paymentsService = new PaymentsService()

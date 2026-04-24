import type mysql from 'mysql2/promise'
import { withTransaction } from '../database/connection'
import { auditLog } from '../utils/audit'
import { inventoryService } from './inventory.service'
import { ordersService } from './orders.service'
import { settingsService } from './settings.service'
import type { Payment, Receipt } from '@shared/types/entities'
import type { ApiResult, CloseOrderDTO, RegisterPaymentDTO, RegisterPaymentResponseV2 } from '@shared/types/dtos'
import { RECEIPT_NUMBER_FORMAT } from '@shared/constants'
import type { TrustedActor } from '../types/actor'
import { paymentsRepository } from '../repositories/payments.repository'

export class PaymentsService {
  async getByOrder(orderId: number): Promise<Payment[]> {
    return paymentsRepository.getByOrder(orderId)
  }

  async registerPayment(
    dto: RegisterPaymentDTO,
    actor: TrustedActor
  ): Promise<ApiResult<RegisterPaymentResponseV2>> {
    const tenderedAmount = Number(dto.amount)
    if (!Number.isFinite(tenderedAmount) || tenderedAmount <= 0) {
      return { success: false, error: 'El monto del pago debe ser mayor a cero', code: 'INVALID_AMOUNT' }
    }

    const order = await paymentsRepository.getOrderPaymentState(dto.orderId)
    if (!order) return { success: false, error: 'Orden no encontrada', code: 'NOT_FOUND' }
    if (!['open', 'pending_payment'].includes(order.status)) {
      return { success: false, error: 'No se pueden registrar pagos en una orden cerrada', code: 'ORDER_CLOSED' }
    }

    const method = await paymentsRepository.getActivePaymentMethod(dto.paymentMethodId)
    if (!method) {
      return { success: false, error: 'Método de pago no válido', code: 'INVALID_PAYMENT_METHOD' }
    }

    const { pct: servicePct } = await settingsService.getServiceChargeConfig()

    if (dto.serviceAccepted !== undefined && dto.serviceAccepted !== null) {
      const subtotal = Number(order.subtotal)
      const serviceCharge = dto.serviceAccepted ? Math.round(subtotal * servicePct / 100) : 0
      const total = subtotal + serviceCharge
      await paymentsRepository.updateOrderService(dto.orderId, dto.serviceAccepted, serviceCharge, total)
      await ordersService.recalcOrder(dto.orderId)
    }

    let targetBalance = await paymentsRepository.getOrderBalanceDue(dto.orderId)
    let subOrderInfo: { id: number; balance_due: number; label: string | null } | null = null

    if (dto.subOrderId) {
      subOrderInfo = await paymentsRepository.getSubOrderInfo(dto.subOrderId, dto.orderId)
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
      const insertId = await paymentsRepository.insertPayment(conn, {
        orderId: dto.orderId,
        subOrderId: dto.subOrderId ?? null,
        paymentMethodId: dto.paymentMethodId,
        appliedAmount,
        tenderedAmount,
        changeGiven,
        reference: dto.reference,
        receivedBy: actor.id,
        notes: dto.notes,
      })

      await ordersService.recalcOrder(dto.orderId, conn)

      const updatedOrder = await paymentsRepository.getOrderTotals(conn, dto.orderId)

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

      const serviceAccepted = await paymentsRepository.getOrderServiceAccepted(conn, dto.orderId)

      return {
        insertId,
        total: Number(updatedOrder?.total ?? 0),
        serviceCharge: Number(updatedOrder?.service_charge ?? 0),
        totalPaid: Number(updatedOrder?.total_paid ?? 0),
        balanceDue: Number(updatedOrder?.balance_due ?? 0),
        serviceAccepted,
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
    const order = await paymentsRepository.getOrderForClose(dto.orderId)

    if (!order) return { success: false, error: 'Orden no encontrada', code: 'NOT_FOUND' }
    if (order.status === 'paid') return { success: false, error: 'La orden ya está cerrada', code: 'ALREADY_CLOSED' }

    const { pct: servicePct } = await settingsService.getServiceChargeConfig()
    const subtotal = Number(order.subtotal)
    const serviceCharge = dto.serviceAccepted ? Math.round(subtotal * servicePct / 100) : 0
    const total = subtotal + serviceCharge

    await paymentsRepository.updateOrderService(dto.orderId, dto.serviceAccepted, serviceCharge, total)

    await ordersService.recalcOrder(dto.orderId)

    const updatedOrder = await paymentsRepository.getUpdatedOrder(dto.orderId)
    if (!updatedOrder || Number(updatedOrder.balance_due) > 0) {
      return {
        success: false,
        error: `Saldo pendiente: $${Number(updatedOrder?.balance_due ?? 0).toFixed(2)}. No se puede cerrar la cuenta.`,
        code: 'BALANCE_DUE'
      }
    }

    return withTransaction(async (conn) => {
      const seq = await paymentsRepository.nextReceiptSequence(conn)
      const receiptNumber = RECEIPT_NUMBER_FORMAT(seq.prefix, seq.lastNumber)
      const totalChangeGiven = await paymentsRepository.getTotalChangeGiven(conn, dto.orderId)

      const receiptId = await paymentsRepository.createReceipt(conn, {
        receiptNumber,
        orderId: dto.orderId,
        subtotal,
        serviceCharge,
        total: Number(updatedOrder.total),
        totalPaid: Number(updatedOrder.total_paid),
        changeGiven: totalChangeGiven,
        issuedBy: actor.id,
      })

      await paymentsRepository.closeOrderAsPaid(conn, dto.orderId, order.table_id)
      const items = await paymentsRepository.getOrderItemsForInventory(conn, dto.orderId)

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

      const receipt = await paymentsRepository.getReceiptById(receiptId)

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
    return paymentsRepository.getPaymentMethods()
  }
}

export const paymentsService = new PaymentsService()

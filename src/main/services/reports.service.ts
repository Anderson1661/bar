import { query } from '../database/connection'
import type { ReportFilters } from '@shared/types/dtos'

function buildRange(filters: ReportFilters): [string, string] {
  return [`${filters.from} 00:00:00`, `${filters.to} 23:59:59`]
}

export class ReportsService {
  async getDashboard(): Promise<{
    salesToday: number
    ordersToday: number
    openTables: number
    lowStockCount: number
    topProducts: { name: string; qty: number; total: number }[]
    salesByHour: { hour: number; total: number }[]
    recentPayments: { method: string; amount: number }[]
  }> {
    const today = new Date().toISOString().slice(0, 10)

    const [salesRow] = await query<{ total: number; orders: number }>(
      `SELECT COALESCE(SUM(r.total), 0) AS total, COUNT(*) AS orders
       FROM receipts r
       WHERE DATE(r.issued_at) = ? AND r.voided = 0`,
      [today]
    )

    const [openTablesRow] = await query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM bar_tables WHERE status IN ('occupied', 'pending_payment')`
    )

    const [lowStockRow] = await query<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM products
       WHERE track_inventory = 1 AND stock <= min_stock AND is_active = 1`
    )

    const topProducts = await query<{ name: string; qty: number; total: number }>(
      `SELECT p.name, SUM(oi.quantity) AS qty, SUM(oi.subtotal) AS total
       FROM receipts r
       JOIN orders o ON o.id = r.order_id
       JOIN order_items oi ON oi.order_id = o.id AND oi.status = 'active'
       JOIN products p ON p.id = oi.product_id
       WHERE DATE(r.issued_at) = ? AND r.voided = 0
       GROUP BY p.id, p.name
       ORDER BY total DESC
       LIMIT 5`,
      [today]
    )

    const salesByHour = await query<{ hour: number; total: number }>(
      `SELECT HOUR(r.issued_at) AS hour, SUM(r.total) AS total
       FROM receipts r
       WHERE DATE(r.issued_at) = ? AND r.voided = 0
       GROUP BY HOUR(r.issued_at)
       ORDER BY hour`,
      [today]
    )

    const recentPayments = await query<{ method: string; amount: number }>(
      `SELECT pm.name AS method, SUM(p.amount) AS amount
       FROM payments p
       JOIN payment_methods pm ON pm.id = p.payment_method_id
       JOIN orders o ON o.id = p.order_id
       WHERE DATE(p.created_at) = ? AND o.status = 'paid'
       GROUP BY pm.id, pm.name
       ORDER BY amount DESC`,
      [today]
    )

    return {
      salesToday: Number(salesRow?.total ?? 0),
      ordersToday: Number(salesRow?.orders ?? 0),
      openTables: Number(openTablesRow?.count ?? 0),
      lowStockCount: Number(lowStockRow?.count ?? 0),
      topProducts: topProducts.map((row) => ({
        name: row.name,
        qty: Number(row.qty),
        total: Number(row.total),
      })),
      salesByHour: salesByHour.map((row) => ({
        hour: Number(row.hour),
        total: Number(row.total),
      })),
      recentPayments: recentPayments.map((row) => ({
        method: row.method,
        amount: Number(row.amount),
      })),
    }
  }

  async getSales(filters: ReportFilters) {
    const [from, to] = buildRange(filters)
    const params: unknown[] = [from, to]
    let extra = ''

    if (filters.waiterId) {
      extra += ' AND o.waiter_id = ?'
      params.push(filters.waiterId)
    }
    if (filters.tableId) {
      extra += ' AND o.table_id = ?'
      params.push(filters.tableId)
    }

    return query(
      `SELECT DATE(r.issued_at) AS date,
              COUNT(r.id) AS receipts,
              SUM(r.subtotal) AS subtotal,
              SUM(r.service_charge) AS service,
              SUM(r.total) AS total,
              SUM(r.change_given) AS change_given
       FROM receipts r
       JOIN orders o ON o.id = r.order_id
       WHERE r.issued_at BETWEEN ? AND ? AND r.voided = 0
       ${extra}
       GROUP BY DATE(r.issued_at)
       ORDER BY date`,
      params
    )
  }

  async getProductSales(filters: ReportFilters) {
    const [from, to] = buildRange(filters)
    const params: unknown[] = [from, to]
    let extra = ''

    if (filters.categoryId) {
      extra += ' AND p.category_id = ?'
      params.push(filters.categoryId)
    }

    return query(
      `SELECT p.name,
              pc.name AS category,
              SUM(oi.quantity) AS qty_sold,
              AVG(oi.unit_price) AS avg_price,
              SUM(oi.subtotal) AS total_sales,
              SUM(oi.quantity * p.cost_price) AS total_cost,
              SUM(oi.subtotal) - SUM(oi.quantity * p.cost_price) AS gross_profit
       FROM receipts r
       JOIN orders o ON o.id = r.order_id
       JOIN order_items oi ON oi.order_id = o.id AND oi.status = 'active'
       JOIN products p ON p.id = oi.product_id
       JOIN product_categories pc ON pc.id = p.category_id
       WHERE r.issued_at BETWEEN ? AND ? AND r.voided = 0
       ${extra}
       GROUP BY p.id, p.name, pc.name
       ORDER BY total_sales DESC`,
      params
    )
  }

  async getPaymentSummary(filters: ReportFilters) {
    const [from, to] = buildRange(filters)
    const params: unknown[] = [from, to]
    let extra = ''

    if (filters.paymentMethodId) {
      extra += ' AND p.payment_method_id = ?'
      params.push(filters.paymentMethodId)
    }

    return query(
      `SELECT pm.name AS method,
              pm.code,
              COUNT(p.id) AS transactions,
              SUM(p.amount) AS total,
              SUM(p.change_given) AS change_given
       FROM payments p
       JOIN payment_methods pm ON pm.id = p.payment_method_id
       JOIN orders o ON o.id = p.order_id
       WHERE p.created_at BETWEEN ? AND ? AND o.status = 'paid'
       ${extra}
       GROUP BY pm.id, pm.name, pm.code
       ORDER BY total DESC`,
      params
    )
  }

  async getExpenseReport(filters: ReportFilters) {
    return query(
      `SELECT ec.name AS category,
              COUNT(e.id) AS count,
              SUM(e.amount) AS total
       FROM expenses e
       JOIN expense_categories ec ON ec.id = e.category_id
       WHERE e.expense_date BETWEEN ? AND ?
       GROUP BY ec.id, ec.name
       ORDER BY total DESC`,
      [filters.from, filters.to]
    )
  }

  async getProfitReport(filters: ReportFilters) {
    const [from, to] = buildRange(filters)

    const [sales] = await query<{ total_sales: number; total_cost: number }>(
      `SELECT COALESCE(SUM(oi.subtotal), 0) AS total_sales,
              COALESCE(SUM(oi.quantity * p.cost_price), 0) AS total_cost
       FROM receipts r
       JOIN orders o ON o.id = r.order_id
       JOIN order_items oi ON oi.order_id = o.id AND oi.status = 'active'
       JOIN products p ON p.id = oi.product_id
       WHERE r.issued_at BETWEEN ? AND ? AND r.voided = 0`,
      [from, to]
    )

    const [expenses] = await query<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE expense_date BETWEEN ? AND ?`,
      [filters.from, filters.to]
    )

    const totalSales = Number(sales?.total_sales ?? 0)
    const totalCost = Number(sales?.total_cost ?? 0)
    const totalExpenses = Number(expenses?.total ?? 0)
    const grossProfit = totalSales - totalCost
    const netProfit = grossProfit - totalExpenses
    const grossMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0

    return { totalSales, totalCost, grossProfit, totalExpenses, netProfit, grossMargin }
  }
}

export const reportsService = new ReportsService()

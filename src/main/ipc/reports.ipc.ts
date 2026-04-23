import { ipcMain } from 'electron'
import { reportsService } from '../services/reports.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { parsePayload } from './validation'
import { reportFiltersSchema } from '@shared/schemas/dtos'

export function registerReportsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.REPORTS_DASHBOARD, async () => reportsService.getDashboard())

  ipcMain.handle(IPC_CHANNELS.REPORTS_SALES, async (_, payload) => {
    const parsed = parsePayload(reportFiltersSchema, payload)
    if (!parsed.success) return parsed.result
    return reportsService.getSales(parsed.data)
  })

  ipcMain.handle(IPC_CHANNELS.REPORTS_PRODUCTS, async (_, payload) => {
    const parsed = parsePayload(reportFiltersSchema, payload)
    if (!parsed.success) return parsed.result
    return reportsService.getProductSales(parsed.data)
  })

  ipcMain.handle(IPC_CHANNELS.REPORTS_PAYMENTS, async (_, payload) => {
    const parsed = parsePayload(reportFiltersSchema, payload)
    if (!parsed.success) return parsed.result
    return reportsService.getPaymentSummary(parsed.data)
  })

  ipcMain.handle(IPC_CHANNELS.REPORTS_PROFIT, async (_, payload) => {
    const parsed = parsePayload(reportFiltersSchema, payload)
    if (!parsed.success) return parsed.result
    return reportsService.getProfitReport(parsed.data)
  })

  ipcMain.handle(IPC_CHANNELS.REPORTS_EXPENSES, async (_, payload) => {
    const parsed = parsePayload(reportFiltersSchema, payload)
    if (!parsed.success) return parsed.result
    return reportsService.getExpenseReport(parsed.data)
  })
}

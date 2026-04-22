import { ipcMain } from 'electron'
import { reportsService } from '../services/reports.service'
import { IPC_CHANNELS } from '@shared/types/ipc'

export function registerReportsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.REPORTS_DASHBOARD, async () => {
    return reportsService.getDashboard()
  })

  ipcMain.handle(IPC_CHANNELS.REPORTS_SALES, async (_, filters) => {
    return reportsService.getSales(filters)
  })

  ipcMain.handle(IPC_CHANNELS.REPORTS_PRODUCTS, async (_, filters) => {
    return reportsService.getProductSales(filters)
  })

  ipcMain.handle(IPC_CHANNELS.REPORTS_PAYMENTS, async (_, filters) => {
    return reportsService.getPaymentSummary(filters)
  })

  ipcMain.handle(IPC_CHANNELS.REPORTS_PROFIT, async (_, filters) => {
    return reportsService.getProfitReport(filters)
  })

  ipcMain.handle(IPC_CHANNELS.REPORTS_EXPENSES, async (_, filters) => {
    return reportsService.getExpenseReport(filters)
  })
}

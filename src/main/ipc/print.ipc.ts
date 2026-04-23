import { ipcMain } from 'electron'
import { printBarTicket, printReceipt } from '../utils/print'
import { settingsService } from '../services/settings.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { parsePayload } from './validation'
import { z } from 'zod'

const barTicketSchema = z.object({ order: z.unknown() })
const receiptSchema = z.object({ receipt: z.unknown(), order: z.unknown() })

export function registerPrintIpc(): void {
  ipcMain.handle(IPC_CHANNELS.PRINT_BAR_TICKET, async (_, payload) => {
    const parsed = parsePayload(barTicketSchema, payload)
    if (!parsed.success) return parsed.result

    try {
      await printBarTicket(parsed.data.order)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err), code: 'PRINT_ERROR' }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PRINT_RECEIPT, async (_, payload) => {
    const parsed = parsePayload(receiptSchema, payload)
    if (!parsed.success) return parsed.result

    try {
      const businessName = (await settingsService.get('business_name')) ?? 'Full Gas Gastrobar'
      await printReceipt(parsed.data.receipt, parsed.data.order, businessName)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err), code: 'PRINT_ERROR' }
    }
  })
}

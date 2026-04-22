import { ipcMain } from 'electron'
import { registerAuthIpc }      from './auth.ipc'
import { registerTablesIpc }    from './tables.ipc'
import { registerOrdersIpc }    from './orders.ipc'
import { registerPaymentsIpc }  from './payments.ipc'
import { registerProductsIpc }  from './products.ipc'
import { registerInventoryIpc } from './inventory.ipc'
import { registerCashIpc }      from './cash.ipc'
import { registerUsersIpc }     from './users.ipc'
import { registerReportsIpc }   from './reports.ipc'
import { registerSettingsIpc }  from './settings.ipc'
import { registerAuditIpc }     from './audit.ipc'
import { registerExpensesIpc }  from './expenses.ipc'
import { registerPrintIpc }     from './print.ipc'

export function registerAllIpcHandlers(): void {
  registerAuthIpc()
  registerTablesIpc()
  registerOrdersIpc()
  registerPaymentsIpc()
  registerProductsIpc()
  registerInventoryIpc()
  registerCashIpc()
  registerUsersIpc()
  registerReportsIpc()
  registerSettingsIpc()
  registerAuditIpc()
  registerExpensesIpc()
  registerPrintIpc()

  console.log('[IPC] Todos los handlers registrados')
}

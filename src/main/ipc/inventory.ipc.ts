import { ipcMain } from 'electron'
import { inventoryService } from '../services/inventory.service'
import { IPC_CHANNELS } from '@shared/types/ipc'

export function registerInventoryIpc(): void {
  ipcMain.handle(IPC_CHANNELS.INVENTORY_ADJUST, async (_, { dto, actorUsername }) => {
    return inventoryService.adjust(dto, actorUsername)
  })

  ipcMain.handle(IPC_CHANNELS.INVENTORY_MOVEMENTS, async (_, { productId, limit }) => {
    return inventoryService.getMovements(productId, limit)
  })

  ipcMain.handle(IPC_CHANNELS.INVENTORY_LOW_STOCK, async () => {
    return inventoryService.getLowStock()
  })
}

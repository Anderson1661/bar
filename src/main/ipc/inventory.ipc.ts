import { ipcMain } from 'electron'
import { inventoryService } from '../services/inventory.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { requirePermission, withAuthenticatedActor } from './authz'

export function registerInventoryIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.INVENTORY_ADJUST,
    requirePermission('inventory.adjust', async (_, actor, { dto }) => inventoryService.adjust(dto, actor))
  )

  ipcMain.handle(
    IPC_CHANNELS.INVENTORY_MOVEMENTS,
    async (event, { productId, limit }) => withAuthenticatedActor(event, async () => inventoryService.getMovements(productId, limit))
  )

  ipcMain.handle(IPC_CHANNELS.INVENTORY_LOW_STOCK, async (event) => withAuthenticatedActor(event, async () => inventoryService.getLowStock()))
}

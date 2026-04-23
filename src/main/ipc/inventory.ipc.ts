import { ipcMain } from 'electron'
import { inventoryService } from '../services/inventory.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { requirePermission, withAuthenticatedActor } from './authz'
import { adjustInventoryDTOSchema, idParamSchema, wrappedDto } from '@shared/schemas/dtos'
import { parsePayload } from './validation'
import { z } from 'zod'

const movementFiltersSchema = z.object({ productId: idParamSchema.optional(), limit: z.number().int().positive().max(500).optional() })

export function registerInventoryIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.INVENTORY_ADJUST,
    requirePermission('inventory.adjust', async (_, actor, payload) => {
      const parsed = parsePayload(wrappedDto(adjustInventoryDTOSchema), payload)
      if (!parsed.success) return parsed.result
      return inventoryService.adjust({ ...parsed.data.dto, performedBy: actor.id }, actor)
    })
  )

  ipcMain.handle(IPC_CHANNELS.INVENTORY_MOVEMENTS, async (event, payload) => {
    const parsed = parsePayload(movementFiltersSchema, payload)
    if (!parsed.success) return parsed.result
    return withAuthenticatedActor(event, async () => inventoryService.getMovements(parsed.data.productId, parsed.data.limit))
  })

  ipcMain.handle(IPC_CHANNELS.INVENTORY_LOW_STOCK, async (event) => withAuthenticatedActor(event, async () => inventoryService.getLowStock()))
}

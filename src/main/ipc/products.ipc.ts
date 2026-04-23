import { ipcMain } from 'electron'
import { productsService } from '../services/products.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { requirePermission } from './authz'
import {
  createProductDTOSchema,
  idParamSchema,
  optionalBooleanSchema,
  searchTermSchema,
  updateProductDTOSchema,
  wrappedDto,
} from '@shared/schemas/dtos'
import { parsePayload } from './validation'
import { z } from 'zod'

const categoryPayloadSchema = z.object({ data: z.object({ name: z.string().trim().min(1), description: z.string().optional() }) })

export function registerProductsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.PRODUCTS_LIST, async (_, payload) => {
    const parsed = parsePayload(optionalBooleanSchema, payload)
    if (!parsed.success) return parsed.result
    return productsService.list(parsed.data)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTS_SEARCH, async (_, payload) => {
    const parsed = parsePayload(searchTermSchema, payload)
    if (!parsed.success) return parsed.result
    return productsService.search(parsed.data)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTS_GET, async (_, payload) => {
    const parsed = parsePayload(idParamSchema, payload)
    if (!parsed.success) return parsed.result
    return productsService.getById(parsed.data)
  })

  ipcMain.handle(
    IPC_CHANNELS.PRODUCTS_CREATE,
    requirePermission('products.manage', async (_, actor, payload) => {
      const parsed = parsePayload(wrappedDto(createProductDTOSchema), payload)
      if (!parsed.success) return parsed.result
      return productsService.create(parsed.data.dto, actor)
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.PRODUCTS_UPDATE,
    requirePermission('products.manage', async (_, actor, payload) => {
      const parsed = parsePayload(wrappedDto(updateProductDTOSchema), payload)
      if (!parsed.success) return parsed.result
      return productsService.update(parsed.data.dto, actor)
    })
  )

  ipcMain.handle(IPC_CHANNELS.CATEGORIES_LIST, async () => productsService.getCategories())

  ipcMain.handle(
    IPC_CHANNELS.CATEGORIES_CREATE,
    requirePermission('products.manage', async (_, actor, payload) => {
      const parsed = parsePayload(categoryPayloadSchema, payload)
      if (!parsed.success) return parsed.result
      return productsService.createCategory(parsed.data.data, actor)
    })
  )
}

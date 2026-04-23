import { ipcMain } from 'electron'
import { productsService } from '../services/products.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { requirePermission } from './authz'

export function registerProductsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.PRODUCTS_LIST, async (_, includeInactive?: boolean) => {
    return productsService.list(includeInactive)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTS_SEARCH, async (_, term: string) => {
    return productsService.search(term)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTS_GET, async (_, id: number) => {
    return productsService.getById(id)
  })

  ipcMain.handle(
    IPC_CHANNELS.PRODUCTS_CREATE,
    requirePermission('products.manage', async (_, actor, { dto }) => productsService.create(dto, actor))
  )

  ipcMain.handle(
    IPC_CHANNELS.PRODUCTS_UPDATE,
    requirePermission('products.manage', async (_, actor, { dto }) => productsService.update(dto, actor))
  )

  ipcMain.handle(IPC_CHANNELS.CATEGORIES_LIST, async () => {
    return productsService.getCategories()
  })

  ipcMain.handle(
    IPC_CHANNELS.CATEGORIES_CREATE,
    requirePermission('products.manage', async (_, actor, { data }) => productsService.createCategory(data, actor))
  )
}

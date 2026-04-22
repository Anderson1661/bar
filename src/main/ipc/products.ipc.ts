import { ipcMain } from 'electron'
import { productsService } from '../services/products.service'
import { IPC_CHANNELS } from '@shared/types/ipc'

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

  ipcMain.handle(IPC_CHANNELS.PRODUCTS_CREATE, async (_, { dto, actorId, actorUsername }) => {
    return productsService.create(dto, actorId, actorUsername)
  })

  ipcMain.handle(IPC_CHANNELS.PRODUCTS_UPDATE, async (_, { dto, actorId, actorUsername }) => {
    return productsService.update(dto, actorId, actorUsername)
  })

  ipcMain.handle(IPC_CHANNELS.CATEGORIES_LIST, async () => {
    return productsService.getCategories()
  })

  ipcMain.handle(IPC_CHANNELS.CATEGORIES_CREATE, async (_, { data, actorId, actorUsername }) => {
    return productsService.createCategory(data, actorId, actorUsername)
  })
}

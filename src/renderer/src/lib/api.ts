import type { IpcEventChannel } from '@shared/types/ipc'

type RendererListener = (...args: unknown[]) => void

declare global {
  interface Window {
    api: {
      auth: {
        login: (dto: unknown) => Promise<unknown>
        verifyToken: () => Promise<unknown>
        logout: () => Promise<unknown>
        changePassword: (dto: unknown) => Promise<unknown>
      }
      tables: {
        list: () => Promise<unknown>
        get: (id: number) => Promise<unknown>
        create: (data: unknown, actorId: number, actorUsername: string) => Promise<unknown>
        update: (id: number, data: unknown, actorId: number, actorUsername: string) => Promise<unknown>
        updateStatus: (id: number, status: string) => Promise<unknown>
      }
      orders: {
        create: (dto: unknown) => Promise<unknown>
        get: (id: number) => Promise<unknown>
        listActive: () => Promise<unknown>
        createSubOrder: (dto: unknown, actorId: number, actorUsername: string) => Promise<unknown>
        addItem: (dto: unknown, actorId: number, actorUsername: string) => Promise<unknown>
        cancelItem: (dto: unknown, actorId: number, actorUsername: string) => Promise<unknown>
        sendToBar: (dto: unknown, actorId: number, actorUsername: string) => Promise<unknown>
        requestBill: (orderId: number) => Promise<unknown>
        releaseEmpty: (orderId: number, actorId: number, actorUsername: string) => Promise<unknown>
      }
      payments: {
        getByOrder: (orderId: number) => Promise<unknown>
        methods: () => Promise<unknown>
        register: (dto: unknown) => Promise<unknown>
        closeOrder: (dto: unknown) => Promise<unknown>
      }
      products: {
        list: (includeInactive?: boolean) => Promise<unknown>
        search: (term: string) => Promise<unknown>
        get: (id: number) => Promise<unknown>
        create: (dto: unknown, actorId: number, actorUsername: string) => Promise<unknown>
        update: (dto: unknown, actorId: number, actorUsername: string) => Promise<unknown>
        categories: () => Promise<unknown>
        createCategory: (data: unknown, actorId: number, actorUsername: string) => Promise<unknown>
      }
      inventory: {
        adjust: (dto: unknown) => Promise<unknown>
        movements: (productId?: number, limit?: number) => Promise<unknown>
        lowStock: () => Promise<unknown>
      }
      cash: {
        current: () => Promise<unknown>
        open: (dto: unknown, actorUsername: string) => Promise<unknown>
        close: (dto: unknown, actorUsername: string) => Promise<unknown>
        summary: (sessionId: number) => Promise<unknown>
      }
      expenses: {
        categories: () => Promise<unknown>
        create: (dto: unknown, actorUsername: string) => Promise<unknown>
        list: (filters: unknown) => Promise<unknown>
      }
      users: {
        list: () => Promise<unknown>
        create: (dto: unknown) => Promise<unknown>
        update: (dto: unknown) => Promise<unknown>
      }
      reports: {
        dashboard: () => Promise<unknown>
        sales: (filters: unknown) => Promise<unknown>
        products: (filters: unknown) => Promise<unknown>
        payments: (filters: unknown) => Promise<unknown>
        profit: (filters: unknown) => Promise<unknown>
        expenses: (filters: unknown) => Promise<unknown>
      }
      audit: {
        list: (filters: unknown) => Promise<unknown>
      }
      settings: {
        get: (key: string) => Promise<unknown>
        getAll: () => Promise<unknown>
        update: (key: string, value: string) => Promise<unknown>
      }
      print: {
        barTicket: (order: unknown) => Promise<unknown>
        receipt: (receipt: unknown, order: unknown) => Promise<unknown>
      }
      events: {
        on: (channel: IpcEventChannel, listener: RendererListener) => void
        once: (channel: IpcEventChannel, listener: RendererListener) => void
        off: (channel: IpcEventChannel, listener: RendererListener) => void
      }
    }
  }
}

export const authApi = window.api.auth
export const tablesApi = window.api.tables
export const ordersApi = window.api.orders
export const paymentsApi = window.api.payments
export const productsApi = window.api.products
export const inventoryApi = window.api.inventory
export const cashApi = window.api.cash
export const expensesApi = window.api.expenses
export const usersApi = window.api.users
export const reportsApi = window.api.reports
export const auditApi = window.api.audit
export const settingsApi = window.api.settings
export const printApi = window.api.print
export const eventsApi = window.api.events

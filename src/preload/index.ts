import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/types/ipc'
import type { IpcChannel, IpcEventChannel } from '@shared/types/ipc'

type RendererListener = (...args: unknown[]) => void
type ElectronListener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => void

type ListenerMapByChannel = Map<IpcEventChannel, Map<RendererListener, ElectronListener>>

const wrappedListeners: ListenerMapByChannel = new Map()

const setWrappedListener = (
  channel: IpcEventChannel,
  listener: RendererListener,
  wrapped: ElectronListener
): void => {
  const byOriginal = wrappedListeners.get(channel) ?? new Map<RendererListener, ElectronListener>()

  byOriginal.set(listener, wrapped)
  wrappedListeners.set(channel, byOriginal)
}

const getWrappedListener = (
  channel: IpcEventChannel,
  listener: RendererListener
): ElectronListener | undefined => wrappedListeners.get(channel)?.get(listener)

const deleteWrappedListener = (channel: IpcEventChannel, listener: RendererListener): void => {
  const byOriginal = wrappedListeners.get(channel)
  if (!byOriginal) return

  byOriginal.delete(listener)
  if (byOriginal.size === 0) {
    wrappedListeners.delete(channel)
  }
}

const invoke = <T = unknown>(channel: IpcChannel, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args)

const eventsApi = {
  on: (channel: IpcEventChannel, listener: RendererListener) => {
    const previousWrapped = getWrappedListener(channel, listener)
    if (previousWrapped) {
      ipcRenderer.removeListener(channel, previousWrapped)
    }

    const wrapped: ElectronListener = (_event, ...args) => listener(...args)
    setWrappedListener(channel, listener, wrapped)
    ipcRenderer.on(channel, wrapped)
  },
  once: (channel: IpcEventChannel, listener: RendererListener) => {
    const previousWrapped = getWrappedListener(channel, listener)
    if (previousWrapped) {
      ipcRenderer.removeListener(channel, previousWrapped)
    }

    const wrapped: ElectronListener = (_event, ...args) => {
      listener(...args)
      deleteWrappedListener(channel, listener)
    }

    setWrappedListener(channel, listener, wrapped)
    ipcRenderer.once(channel, wrapped)
  },
  off: (channel: IpcEventChannel, listener: RendererListener) => {
    const wrapped = getWrappedListener(channel, listener)
    if (!wrapped) return

    ipcRenderer.removeListener(channel, wrapped)
    deleteWrappedListener(channel, listener)
  },
}

// API expuesta al renderer de forma segura y mínima por dominio.
const api = {
  auth: {
    login: (dto: unknown) => invoke(IPC_CHANNELS.AUTH_LOGIN, dto),
    changePassword: (dto: unknown) => invoke(IPC_CHANNELS.AUTH_CHANGE_PASSWORD, dto),
  },
  tables: {
    list: () => invoke(IPC_CHANNELS.TABLES_LIST),
    get: (id: number) => invoke(IPC_CHANNELS.TABLES_GET, id),
    create: (data: unknown, actorId: number, actorUsername: string) =>
      invoke(IPC_CHANNELS.TABLES_CREATE, { data, actorId, actorUsername }),
    update: (id: number, data: unknown, actorId: number, actorUsername: string) =>
      invoke(IPC_CHANNELS.TABLES_UPDATE, { id, data, actorId, actorUsername }),
    updateStatus: (id: number, status: string) => invoke(IPC_CHANNELS.TABLES_STATUS, { id, status }),
  },
  orders: {
    create: (dto: unknown) => invoke(IPC_CHANNELS.ORDERS_CREATE, { dto }),
    get: (id: number) => invoke(IPC_CHANNELS.ORDERS_GET, id),
    listActive: () => invoke(IPC_CHANNELS.ORDERS_LIST_ACTIVE),
    createSubOrder: (dto: unknown, actorId: number, actorUsername: string) =>
      invoke(IPC_CHANNELS.ORDERS_CREATE_SUBORDER, { dto, actorId, actorUsername }),
    addItem: (dto: unknown, actorId: number, actorUsername: string) =>
      invoke(IPC_CHANNELS.ORDERS_ADD_ITEM, { dto, actorId, actorUsername }),
    cancelItem: (dto: unknown, actorId: number, actorUsername: string) =>
      invoke(IPC_CHANNELS.ORDERS_CANCEL_ITEM, { dto, actorId, actorUsername }),
    sendToBar: (dto: unknown, actorId: number, actorUsername: string) =>
      invoke(IPC_CHANNELS.ORDERS_SEND_TO_BAR, { dto, actorId, actorUsername }),
    requestBill: (orderId: number) => invoke(IPC_CHANNELS.ORDERS_REQUEST_BILL, orderId),
    releaseEmpty: (orderId: number, actorId: number, actorUsername: string) =>
      invoke(IPC_CHANNELS.ORDERS_RELEASE_EMPTY, { orderId, actorId, actorUsername }),
  },
  payments: {
    getByOrder: (orderId: number) => invoke(IPC_CHANNELS.PAYMENTS_GET_BY_ORDER, orderId),
    methods: () => invoke(IPC_CHANNELS.PAYMENTS_METHODS),
    register: (dto: unknown) => invoke(IPC_CHANNELS.PAYMENTS_REGISTER, { dto }),
    closeOrder: (dto: unknown) => invoke(IPC_CHANNELS.PAYMENTS_CLOSE_ORDER, { dto }),
  },
  products: {
    list: (includeInactive?: boolean) => invoke(IPC_CHANNELS.PRODUCTS_LIST, includeInactive),
    search: (term: string) => invoke(IPC_CHANNELS.PRODUCTS_SEARCH, term),
    get: (id: number) => invoke(IPC_CHANNELS.PRODUCTS_GET, id),
    create: (dto: unknown, actorId: number, actorUsername: string) =>
      invoke(IPC_CHANNELS.PRODUCTS_CREATE, { dto, actorId, actorUsername }),
    update: (dto: unknown, actorId: number, actorUsername: string) =>
      invoke(IPC_CHANNELS.PRODUCTS_UPDATE, { dto, actorId, actorUsername }),
    categories: () => invoke(IPC_CHANNELS.CATEGORIES_LIST),
    createCategory: (data: unknown, actorId: number, actorUsername: string) =>
      invoke(IPC_CHANNELS.CATEGORIES_CREATE, { data, actorId, actorUsername }),
  },
  inventory: {
    adjust: (dto: unknown) => invoke(IPC_CHANNELS.INVENTORY_ADJUST, { dto }),
    movements: (productId?: number, limit?: number) => invoke(IPC_CHANNELS.INVENTORY_MOVEMENTS, { productId, limit }),
    lowStock: () => invoke(IPC_CHANNELS.INVENTORY_LOW_STOCK),
  },
  cash: {
    current: () => invoke(IPC_CHANNELS.CASH_CURRENT_SESSION),
    open: (dto: unknown, actorUsername: string) => invoke(IPC_CHANNELS.CASH_OPEN_SESSION, { dto, actorUsername }),
    close: (dto: unknown, actorUsername: string) => invoke(IPC_CHANNELS.CASH_CLOSE_SESSION, { dto, actorUsername }),
    summary: (sessionId: number) => invoke(IPC_CHANNELS.CASH_SESSION_SUMMARY, sessionId),
  },
  expenses: {
    categories: () => invoke(IPC_CHANNELS.EXPENSES_CATEGORIES),
    create: (dto: unknown, actorUsername: string) => invoke(IPC_CHANNELS.EXPENSES_CREATE, { dto, actorUsername }),
    list: (filters: unknown) => invoke(IPC_CHANNELS.EXPENSES_LIST, filters),
  },
  users: {
    list: () => invoke(IPC_CHANNELS.USERS_LIST),
    create: (dto: unknown) => invoke(IPC_CHANNELS.USERS_CREATE, { dto }),
    update: (dto: unknown) => invoke(IPC_CHANNELS.USERS_UPDATE, { dto }),
  },
  reports: {
    dashboard: () => invoke(IPC_CHANNELS.REPORTS_DASHBOARD),
    sales: (filters: unknown) => invoke(IPC_CHANNELS.REPORTS_SALES, filters),
    products: (filters: unknown) => invoke(IPC_CHANNELS.REPORTS_PRODUCTS, filters),
    payments: (filters: unknown) => invoke(IPC_CHANNELS.REPORTS_PAYMENTS, filters),
    profit: (filters: unknown) => invoke(IPC_CHANNELS.REPORTS_PROFIT, filters),
    expenses: (filters: unknown) => invoke(IPC_CHANNELS.REPORTS_EXPENSES, filters),
  },
  audit: {
    list: (filters: unknown) => invoke(IPC_CHANNELS.AUDIT_LIST, filters),
  },
  settings: {
    get: (key: string) => invoke(IPC_CHANNELS.SETTINGS_GET, key),
    getAll: () => invoke(IPC_CHANNELS.SETTINGS_GET_ALL),
    update: (key: string, value: string) => invoke(IPC_CHANNELS.SETTINGS_UPDATE, { key, value }),
  },
  print: {
    barTicket: (order: unknown) => invoke(IPC_CHANNELS.PRINT_BAR_TICKET, { order }),
    receipt: (receipt: unknown, order: unknown) => invoke(IPC_CHANNELS.PRINT_RECEIPT, { receipt, order }),
  },
  events: eventsApi,
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronApi = typeof api

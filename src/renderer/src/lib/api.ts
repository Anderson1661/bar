import { IPC_CHANNELS } from '@shared/types/ipc'
import type { IpcChannel } from '@shared/types/ipc'

declare global {
  interface Window {
    api: {
      invoke: <T = unknown>(channel: IpcChannel, ...args: unknown[]) => Promise<T>
      on:     (channel: string, listener: (...args: unknown[]) => void) => void
      off:    (channel: string, listener: (...args: unknown[]) => void) => void
    }
  }
}

export async function ipc<T = unknown>(channel: IpcChannel, ...args: unknown[]): Promise<T> {
  return window.api.invoke<T>(channel, ...args)
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login:          (dto: unknown)                              => ipc(IPC_CHANNELS.AUTH_LOGIN, dto),
  logout:         (sessionToken: string)                      => ipc(IPC_CHANNELS.AUTH_LOGOUT, { sessionToken }),
  changePassword: (dto: unknown, sessionToken: string)        => ipc(IPC_CHANNELS.AUTH_CHANGE_PASSWORD, { dto, sessionToken }),
}

// ── Security questions ────────────────────────────────────────────────────────

export const securityApi = {
  listQuestions:    ()                                                   => ipc(IPC_CHANNELS.SECURITY_LIST_QUESTIONS),
  getUserQuestions: (username: string)                                   => ipc(IPC_CHANNELS.SECURITY_GET_USER_QUESTIONS, { username }),
  hasQuestions:     (sessionToken: string)                               => ipc(IPC_CHANNELS.SECURITY_HAS_QUESTIONS, { sessionToken }),
  setupAnswers:     (userId: number, answers: unknown, sessionToken: string) =>
    ipc(IPC_CHANNELS.SECURITY_SETUP_ANSWERS, { userId, answers, sessionToken }),
  verifyAnswers:    (username: string, answers: unknown)                 => ipc(IPC_CHANNELS.SECURITY_VERIFY_ANSWERS, { username, answers }),
  recoverPassword:  (username: string, answers: unknown, newPassword: string) =>
    ipc(IPC_CHANNELS.SECURITY_RECOVER_PASSWORD, { username, answers, newPassword }),
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export const sessionsApi = {
  list:   (sessionToken: string, userId?: number)                                   => ipc(IPC_CHANNELS.SESSIONS_LIST, { sessionToken, userId }),
  revoke: (sessionToken: string, targetSessionId: number, reason: string)           => ipc(IPC_CHANNELS.SESSIONS_REVOKE, { sessionToken, targetSessionId, reason }),
}

// ── Tables ────────────────────────────────────────────────────────────────────

export const tablesApi = {
  list:         ()                                                           => ipc(IPC_CHANNELS.TABLES_LIST),
  get:          (id: number)                                                 => ipc(IPC_CHANNELS.TABLES_GET, id),
  create:       (data: unknown, sessionToken: string)                        => ipc(IPC_CHANNELS.TABLES_CREATE, { data, sessionToken }),
  update:       (id: number, data: unknown, sessionToken: string)            => ipc(IPC_CHANNELS.TABLES_UPDATE, { id, data, sessionToken }),
  updateStatus: (id: number, status: string)                                 => ipc(IPC_CHANNELS.TABLES_STATUS, { id, status }),
}

// ── Orders ────────────────────────────────────────────────────────────────────

export const ordersApi = {
  create:        (dto: unknown)                                          => ipc(IPC_CHANNELS.ORDERS_CREATE, { dto }),
  get:           (id: number)                                            => ipc(IPC_CHANNELS.ORDERS_GET, id),
  listActive:    ()                                                      => ipc(IPC_CHANNELS.ORDERS_LIST_ACTIVE),
  createSubOrder:(dto: unknown, actorId: number, actorUsername: string)  =>
    ipc(IPC_CHANNELS.ORDERS_CREATE_SUBORDER, { dto, actorId, actorUsername }),
  addItem:       (dto: unknown, actorId: number, actorUsername: string)  =>
    ipc(IPC_CHANNELS.ORDERS_ADD_ITEM, { dto, actorId, actorUsername }),
  cancelItem:    (dto: unknown, actorId: number, actorUsername: string)  =>
    ipc(IPC_CHANNELS.ORDERS_CANCEL_ITEM, { dto, actorId, actorUsername }),
  sendToBar:     (dto: unknown, actorId: number, actorUsername: string)  =>
    ipc(IPC_CHANNELS.ORDERS_SEND_TO_BAR, { dto, actorId, actorUsername }),
  requestBill:   (orderId: number)                                       => ipc(IPC_CHANNELS.ORDERS_REQUEST_BILL, orderId),
  releaseEmpty:  (orderId: number, actorId: number, actorUsername: string) =>
    ipc(IPC_CHANNELS.ORDERS_RELEASE_EMPTY, { orderId, actorId, actorUsername }),
}

// ── Payments ──────────────────────────────────────────────────────────────────

export const paymentsApi = {
  getByOrder: (orderId: number)                                => ipc(IPC_CHANNELS.PAYMENTS_GET_BY_ORDER, orderId),
  methods:    ()                                               => ipc(IPC_CHANNELS.PAYMENTS_METHODS),
  register:   (dto: unknown, actorUsername: string)            => ipc(IPC_CHANNELS.PAYMENTS_REGISTER, { dto, actorUsername }),
  closeOrder: (dto: unknown, actorUsername: string)            => ipc(IPC_CHANNELS.PAYMENTS_CLOSE_ORDER, { dto, actorUsername }),
}

// ── Products ──────────────────────────────────────────────────────────────────

export const productsApi = {
  list:           (includeInactive?: boolean) => ipc(IPC_CHANNELS.PRODUCTS_LIST, includeInactive),
  search:         (term: string)              => ipc(IPC_CHANNELS.PRODUCTS_SEARCH, term),
  get:            (id: number)                => ipc(IPC_CHANNELS.PRODUCTS_GET, id),
  create:         (dto: unknown, actorId: number, actorUsername: string) =>
    ipc(IPC_CHANNELS.PRODUCTS_CREATE, { dto, actorId, actorUsername }),
  update:         (dto: unknown, actorId: number, actorUsername: string) =>
    ipc(IPC_CHANNELS.PRODUCTS_UPDATE, { dto, actorId, actorUsername }),
  categories:     ()                                                      => ipc(IPC_CHANNELS.CATEGORIES_LIST),
  createCategory: (data: unknown, actorId: number, actorUsername: string) =>
    ipc(IPC_CHANNELS.CATEGORIES_CREATE, { data, actorId, actorUsername }),
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export const inventoryApi = {
  adjust:    (dto: unknown, actorUsername: string) => ipc(IPC_CHANNELS.INVENTORY_ADJUST, { dto, actorUsername }),
  movements: (productId?: number, limit?: number)  => ipc(IPC_CHANNELS.INVENTORY_MOVEMENTS, { productId, limit }),
  lowStock:  ()                                    => ipc(IPC_CHANNELS.INVENTORY_LOW_STOCK),
}

// ── Cash ──────────────────────────────────────────────────────────────────────

export const cashApi = {
  current: ()                                           => ipc(IPC_CHANNELS.CASH_CURRENT_SESSION),
  open:    (dto: unknown, actorUsername: string)        => ipc(IPC_CHANNELS.CASH_OPEN_SESSION, { dto, actorUsername }),
  close:   (dto: unknown, actorUsername: string)        => ipc(IPC_CHANNELS.CASH_CLOSE_SESSION, { dto, actorUsername }),
  summary: (sessionId: number)                          => ipc(IPC_CHANNELS.CASH_SESSION_SUMMARY, sessionId),
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export const expensesApi = {
  categories: ()                                        => ipc(IPC_CHANNELS.EXPENSES_CATEGORIES),
  create:     (dto: unknown, actorUsername: string)     => ipc(IPC_CHANNELS.EXPENSES_CREATE, { dto, actorUsername }),
  list:       (filters: unknown)                        => ipc(IPC_CHANNELS.EXPENSES_LIST, filters),
}

// ── Users ─────────────────────────────────────────────────────────────────────

export const usersApi = {
  list:       ()                                                              => ipc(IPC_CHANNELS.USERS_LIST),
  create:     (dto: unknown, sessionToken: string)                            => ipc(IPC_CHANNELS.USERS_CREATE, { dto, sessionToken }),
  update:     (dto: unknown, sessionToken: string)                            => ipc(IPC_CHANNELS.USERS_UPDATE, { dto, sessionToken }),
  updateSelf: (dto: unknown, sessionToken: string)                            => ipc(IPC_CHANNELS.ADMIN_UPDATE_SELF, { dto, sessionToken }),
}

// ── Promotions ────────────────────────────────────────────────────────────────

export const promotionsApi = {
  list:      (includeInactive?: boolean, sessionToken?: string) => ipc(IPC_CHANNELS.PROMOTIONS_LIST, { includeInactive, sessionToken }),
  get:       (id: number)                                        => ipc(IPC_CHANNELS.PROMOTIONS_GET, { id }),
  listItems: (promotionId: number)                               => ipc(IPC_CHANNELS.PROMOTIONS_LIST_ITEMS, { promotionId }),
  create:    (dto: unknown, sessionToken: string)                => ipc(IPC_CHANNELS.PROMOTIONS_CREATE, { dto, sessionToken }),
  update:    (dto: unknown, sessionToken: string)                => ipc(IPC_CHANNELS.PROMOTIONS_UPDATE, { dto, sessionToken }),
  toggle:    (id: number, sessionToken: string)                  => ipc(IPC_CHANNELS.PROMOTIONS_TOGGLE, { id, sessionToken }),
}

// ── Reports ───────────────────────────────────────────────────────────────────

export const reportsApi = {
  dashboard: ()                 => ipc(IPC_CHANNELS.REPORTS_DASHBOARD),
  sales:     (filters: unknown) => ipc(IPC_CHANNELS.REPORTS_SALES, filters),
  products:  (filters: unknown) => ipc(IPC_CHANNELS.REPORTS_PRODUCTS, filters),
  payments:  (filters: unknown) => ipc(IPC_CHANNELS.REPORTS_PAYMENTS, filters),
  profit:    (filters: unknown) => ipc(IPC_CHANNELS.REPORTS_PROFIT, filters),
  expenses:  (filters: unknown) => ipc(IPC_CHANNELS.REPORTS_EXPENSES, filters),
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export const auditApi = {
  list: (filters: unknown) => ipc(IPC_CHANNELS.AUDIT_LIST, filters),
}

// ── Settings ──────────────────────────────────────────────────────────────────

export const settingsApi = {
  get:    (key: string)                                         => ipc(IPC_CHANNELS.SETTINGS_GET, key),
  getAll: ()                                                    => ipc(IPC_CHANNELS.SETTINGS_GET_ALL),
  update: (key: string, value: string, updatedBy: number)      => ipc(IPC_CHANNELS.SETTINGS_UPDATE, { key, value, updatedBy }),
}

// ── Print ─────────────────────────────────────────────────────────────────────

export const printApi = {
  barTicket: (order: unknown)                   => ipc(IPC_CHANNELS.PRINT_BAR_TICKET, { order }),
  receipt:   (receipt: unknown, order: unknown) => ipc(IPC_CHANNELS.PRINT_RECEIPT, { receipt, order }),
}

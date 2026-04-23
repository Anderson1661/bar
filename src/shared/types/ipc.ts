// =============================================
// Canales IPC - contratos type-safe
// =============================================

export const IPC_CHANNELS = {
  // Auth
  AUTH_LOGIN:           'auth:login',
  AUTH_LOGOUT:          'auth:logout',
  AUTH_CHANGE_PASSWORD: 'auth:change-password',
  AUTH_VERIFY_TOKEN:    'auth:verify-token',

  // Tables
  TABLES_LIST:          'tables:list',
  TABLES_GET:           'tables:get',
  TABLES_CREATE:        'tables:create',
  TABLES_UPDATE:        'tables:update',
  TABLES_STATUS:        'tables:status',

  // Orders
  ORDERS_CREATE:        'orders:create',
  ORDERS_GET:           'orders:get',
  ORDERS_LIST_ACTIVE:   'orders:list-active',
  ORDERS_CREATE_SUBORDER:'orders:create-suborder',
  ORDERS_ADD_ITEM:      'orders:add-item',
  ORDERS_CANCEL_ITEM:   'orders:cancel-item',
  ORDERS_SEND_TO_BAR:   'orders:send-to-bar',
  ORDERS_REQUEST_BILL:  'orders:request-bill',
  ORDERS_RELEASE_EMPTY: 'orders:release-empty',

  // Payments
  PAYMENTS_REGISTER:    'payments:register',
  PAYMENTS_CLOSE_ORDER: 'payments:close-order',
  PAYMENTS_GET_BY_ORDER:'payments:get-by-order',
  PAYMENTS_METHODS:     'payments:methods',

  // Products
  PRODUCTS_LIST:        'products:list',
  PRODUCTS_GET:         'products:get',
  PRODUCTS_CREATE:      'products:create',
  PRODUCTS_UPDATE:      'products:update',
  PRODUCTS_SEARCH:      'products:search',
  CATEGORIES_LIST:      'products:categories-list',
  CATEGORIES_CREATE:    'products:categories-create',

  // Inventory
  INVENTORY_ADJUST:     'inventory:adjust',
  INVENTORY_MOVEMENTS:  'inventory:movements',
  INVENTORY_LOW_STOCK:  'inventory:low-stock',

  // Cash
  CASH_OPEN_SESSION:    'cash:open-session',
  CASH_CLOSE_SESSION:   'cash:close-session',
  CASH_CURRENT_SESSION: 'cash:current-session',
  CASH_SESSION_SUMMARY: 'cash:session-summary',

  // Expenses
  EXPENSES_CREATE:      'expenses:create',
  EXPENSES_LIST:        'expenses:list',
  EXPENSES_CATEGORIES:  'expenses:categories',

  // Promotions
  PROMOTIONS_LIST:      'promotions:list',
  PROMOTIONS_CREATE:    'promotions:create',
  PROMOTIONS_UPDATE:    'promotions:update',

  // Users
  USERS_LIST:           'users:list',
  USERS_CREATE:         'users:create',
  USERS_UPDATE:         'users:update',

  // Reports
  REPORTS_SALES:        'reports:sales',
  REPORTS_PRODUCTS:     'reports:products',
  REPORTS_PAYMENTS:     'reports:payments',
  REPORTS_INVENTORY:    'reports:inventory',
  REPORTS_EXPENSES:     'reports:expenses',
  REPORTS_PROFIT:       'reports:profit',
  REPORTS_CASH_CLOSURE: 'reports:cash-closure',
  REPORTS_DASHBOARD:    'reports:dashboard',

  // Audit
  AUDIT_LIST:           'audit:list',

  // Settings
  SETTINGS_GET:         'settings:get',
  SETTINGS_UPDATE:      'settings:update',
  SETTINGS_GET_ALL:     'settings:get-all',

  // Print
  PRINT_BAR_TICKET:     'print:bar-ticket',
  PRINT_RECEIPT:        'print:receipt',
  PRINT_BILL:           'print:bill',

  // Suppliers
  SUPPLIERS_LIST:       'suppliers:list',
  SUPPLIERS_CREATE:     'suppliers:create',
  SUPPLIERS_UPDATE:     'suppliers:update',
} as const

// Canales emitidos desde main hacia renderer permitidos para `on/off`.
// Mantener esta lista mínima para no exponer canales IPC de request/response.
export const IPC_EVENT_CHANNELS = {} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
export type IpcEventChannel = (typeof IPC_EVENT_CHANNELS)[keyof typeof IPC_EVENT_CHANNELS]

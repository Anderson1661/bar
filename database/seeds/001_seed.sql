-- =============================================
-- Full Gas Gastrobar - Datos iniciales
-- =============================================

USE fullgas_db;

-- Roles
INSERT INTO roles (name, description) VALUES
  ('admin',     'Administrador con acceso total al sistema'),
  ('mesero',    'Mesero con acceso operativo a mesas y pedidos'),
  ('developer', 'Acceso técnico para soporte y mantenimiento');

-- Permisos base
INSERT INTO permissions (name, module, description) VALUES
  ('tables.view',         'tables',    'Ver mapa de mesas'),
  ('tables.manage',       'tables',    'Crear y editar mesas'),
  ('orders.create',       'orders',    'Crear pedidos'),
  ('orders.edit',         'orders',    'Editar pedidos propios'),
  ('orders.cancel',       'orders',    'Cancelar ítems de pedido'),
  ('orders.view_all',     'orders',    'Ver todos los pedidos'),
  ('payments.create',     'payments',  'Registrar pagos'),
  ('payments.close',      'payments',  'Cerrar cuentas'),
  ('products.view',       'products',  'Ver productos'),
  ('products.manage',     'products',  'Crear y editar productos'),
  ('inventory.view',      'inventory', 'Ver inventario'),
  ('inventory.adjust',    'inventory', 'Hacer ajustes de inventario'),
  ('inventory.purchase',  'inventory', 'Registrar entradas de inventario'),
  ('expenses.create',     'expenses',  'Registrar gastos'),
  ('expenses.view',       'expenses',  'Ver gastos'),
  ('promotions.manage',   'promotions','Gestionar promociones'),
  ('users.manage',        'users',     'Gestionar usuarios'),
  ('reports.view',        'reports',   'Ver reportes'),
  ('cash.open',           'cash',      'Abrir sesión de caja'),
  ('cash.close',          'cash',      'Cerrar sesión de caja'),
  ('audit.view',          'audit',     'Ver logs de auditoría'),
  ('settings.manage',     'settings',  'Modificar configuración');

-- Permisos admin (todos)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin';

-- Permisos mesero
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'tables.view',
  'orders.create',
  'orders.edit',
  'orders.cancel',
  'payments.create',
  'products.view',
  'inventory.view'
)
WHERE r.name = 'mesero';

-- Permisos developer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'reports.view',
  'audit.view',
  'tables.view'
)
WHERE r.name = 'developer';

INSERT INTO users (
  username,
  full_name,
  email,
  password_hash,
  role_id,
  is_active
)
VALUES (
  'admin2',
  'Administrador 2',
  'admin2@fullgas.com',
  '$2b$10$pG8Csmj1LQIjPOKhmt7hHeXPaRYbE8kbsN47K6FFZZg7p8i8A0LgC',
  1,
  TRUE
);

-- Métodos de pago
INSERT INTO payment_methods (name, code, sort_order) VALUES
  ('Efectivo',          'cash',     1),
  ('Transferencia',     'transfer', 2),
  ('Tarjeta Débito',    'debit',    3),
  ('Tarjeta Crédito',   'credit',   4),
  ('Otro',              'other',    5);

-- Categorías de productos típicos de un gastrobar
INSERT INTO product_categories (name, description, color, icon, sort_order) VALUES
  ('Cerveza',     'Cervezas nacionales e importadas', '#F59E0B', 'beer',        1),
  ('Licor',       'Aguardiente, ron, whisky, vodka',  '#7C3AED', 'wine',        2),
  ('Cóctel',      'Tragos preparados y mezclados',    '#EC4899', 'cocktail',    3),
  ('Gaseosa',     'Refrescos y bebidas sin alcohol',  '#10B981', 'coffee',      4),
  ('Snack',       'Pasabocas y aperitivos',           '#6366F1', 'sandwich',    5),
  ('Agua',        'Agua natural y saborizada',        '#06B6D4', 'droplets',    6);

-- Productos base (inventario inicial 0)
INSERT INTO products (category_id, name, cost_price, sale_price, stock, min_stock, unit, track_inventory)
SELECT c.id, 'Águila 330ml',    2500, 4000,  0, 10, 'und', TRUE  FROM product_categories c WHERE c.name = 'Cerveza'
UNION ALL
SELECT c.id, 'Águila Light',    2500, 4000,  0, 10, 'und', TRUE  FROM product_categories c WHERE c.name = 'Cerveza'
UNION ALL
SELECT c.id, 'Corona 355ml',    4000, 6500,  0, 6,  'und', TRUE  FROM product_categories c WHERE c.name = 'Cerveza'
UNION ALL
SELECT c.id, 'Heineken 330ml',  4500, 7000,  0, 6,  'und', TRUE  FROM product_categories c WHERE c.name = 'Cerveza'
UNION ALL
SELECT c.id, 'Aguardiente Antioqueño', 22000, 35000, 0, 2, 'bot', TRUE FROM product_categories c WHERE c.name = 'Licor'
UNION ALL
SELECT c.id, 'Ron Medellín 750ml', 28000, 45000, 0, 2, 'bot', TRUE FROM product_categories c WHERE c.name = 'Licor'
UNION ALL
SELECT c.id, 'Shots Aguardiente', 3000, 5000, 0, 0, 'und', FALSE FROM product_categories c WHERE c.name = 'Licor'
UNION ALL
SELECT c.id, 'Mojito',          5000, 12000, 0, 0, 'und', FALSE FROM product_categories c WHERE c.name = 'Cóctel'
UNION ALL
SELECT c.id, 'Margarita',       5000, 12000, 0, 0, 'und', FALSE FROM product_categories c WHERE c.name = 'Cóctel'
UNION ALL
SELECT c.id, 'Coca-Cola 350ml', 1200, 3000,  0, 6, 'und', TRUE  FROM product_categories c WHERE c.name = 'Gaseosa'
UNION ALL
SELECT c.id, 'Agua 600ml',       800, 2500,  0, 6, 'und', TRUE  FROM product_categories c WHERE c.name = 'Agua';

-- Mesas del bar
INSERT INTO bar_tables 
(number, name, capacity, zone, position_x, position_y, status)
VALUES
(1,  'Mesa 1', 4,  'Salón',   50,  50, 'available'),
(2,  'Mesa 2', 4,  'Salón',   200, 50, 'available'),
(3,  'Mesa 3', 4,  'Salón',   350, 50, 'available'),
(4,  'Mesa 4', 4,  'Salón',   50,  200, 'available'),
(5,  'Mesa 5', 4,  'Salón',   200, 200, 'available'),
(6,  'Mesa 6', 6,  'Terraza', 400, 200, 'available'),
(7,  'Mesa 7', 6,  'Terraza', 550, 200, 'available'),
(8,  'Barra 1', 2, 'Barra',   50,  350, 'available'),
(9,  'Barra 2', 2, 'Barra',   150, 350, 'available'),
(10, 'VIP', 8,     'VIP',     400, 50,  'available');

-- Categorías de gastos
INSERT INTO expense_categories (name, description) VALUES
  ('Insumos',         'Compra de productos para venta'),
  ('Servicios',       'Agua, luz, internet, gas'),
  ('Arriendo',        'Arriendo del local'),
  ('Personal',        'Pagos a empleados, comisiones'),
  ('Mantenimiento',   'Reparaciones y mantenimiento'),
  ('Marketing',       'Publicidad y promoción'),
  ('Transporte',      'Fletes y desplazamiento'),
  ('Imprevistos',     'Gastos no planificados');

-- Configuración inicial del sistema
INSERT INTO system_settings (key_name, value, description) VALUES
  ('business_name',        'Full Gas Gastrobar',  'Nombre del negocio'),
  ('business_nit',         'NIT',                 'NIT o identificación'),
  ('business_address',     'Centro Mayor',        'Dirección del negocio'),
  ('business_phone',       '',                    'Teléfono de contacto'),
  ('service_charge_pct',   '5',                   'Porcentaje de cargo por servicio'),
  ('service_charge_active','false',               'Activar cobro de servicio por defecto'),
  ('strict_stock_control', 'true',                'Impedir ventas sin stock suficiente'),
  ('receipt_prefix',       'FG',                  'Prefijo de comprobantes'),
  ('currency_symbol',      '$',                   'Símbolo de moneda'),
  ('currency_decimals',    '0',                   'Decimales en precios (0 = sin centavos)'),
  ('print_bar_ticket',     'true',                'Imprimir ticket de barra al enviar comanda'),
  ('low_stock_alert',      'true',                'Alertar productos con stock mínimo'),
  ('session_timeout_min',  '480',                 'Minutos hasta cierre de sesión inactiva');

-- Secuencia inicial para comprobantes
INSERT INTO receipt_sequence (prefix, last_number) VALUES ('FG', 0);

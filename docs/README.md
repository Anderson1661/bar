# Full Gas Gastrobar — Sistema POS de Escritorio

Sistema de gestión operativa para Full Gas Gastrobar, desarrollado como aplicación de escritorio con Electron + React + TypeScript + MySQL.

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Desktop shell | Electron 33 |
| Frontend | React 18 + TypeScript |
| UI | TailwindCSS + shadcn/ui (Radix) |
| Estado | Zustand + TanStack Query |
| Gráficos | Recharts |
| Build | electron-vite + Vite 5 |
| Base de datos | MySQL 8+ (mysql2/promise) |
| Seguridad | bcryptjs (hash contraseñas) |
| Validación | Zod |

## Arquitectura

```
Renderer (React) ←→ IPC bridge ←→ Main (Node.js)
                                       ↓
                                  Services → Repositories → MySQL
```

- **Main process**: conexión MySQL, servicios de negocio, IPC handlers
- **Renderer process**: UI React, estado con Zustand, llamadas via IPC
- **Shared**: tipos TypeScript y constantes compartidos
- **Preload**: bridge seguro entre main y renderer

## Requisitos

- Node.js 18+
- MySQL 8.0+
- npm 9+

## Instalación

```bash
# 1. Clonar y entrar al directorio
cd fullgas

# 2. Instalar dependencias
npm install

# 3. Configurar base de datos
# Copiar .env.example a .env y configurar credenciales MySQL
cp .env.example .env

# 4. Crear base de datos y esquema
mysql -u root -p < database/migrations/001_initial.sql

# 5. Cargar datos iniciales
mysql -u root -p fullgas_db < database/seeds/001_seed.sql

# 6. Ejecutar en modo desarrollo
npm run dev

# 7. Build para producción
npm run build

# 8. Empaquetar instalador Windows
npm run package
```

## Credenciales iniciales

| Campo | Valor |
|-------|-------|
| Usuario | `admin` |
| Contraseña | `admin123` |

**⚠️ Cambiar inmediatamente en producción.**

## Módulos principales

| Módulo | Descripción |
|--------|-------------|
| Dashboard | KPIs, ventas por hora, top productos |
| Mesas | Mapa de mesas, apertura, estado visual |
| Pedidos | Toma de pedidos, envío a barra, cancelaciones |
| Caja/Pagos | Pagos parciales, mixtos, cierre de cuenta |
| Productos | CRUD de productos y categorías |
| Inventario | Stock, ajustes, kardex de movimientos |
| Gastos | Registro de egresos operativos |
| Usuarios | Gestión de usuarios por rol |
| Reportes | Ventas, productos, pagos, utilidad, gastos |
| Auditoría | Trazabilidad de acciones críticas |
| Configuración | Parámetros del sistema, sesión de caja |

## Roles

| Rol | Acceso |
|-----|--------|
| admin | Acceso total |
| mesero | Mesas, pedidos, pagos básicos |
| developer | Consulta técnica |

## Reglas de negocio críticas

1. Una mesa solo puede tener una orden activa simultanea
2. Una cuenta no puede cerrarse con saldo pendiente
3. El cargo del 5% de servicio es opcional y debe registrarse la aceptación
4. Todo ítem cancelado queda auditado con motivo y usuario
5. Las ventas descuentan inventario automáticamente al cierre
6. El consecutivo de comprobantes es único e incremental (FG-00001)
7. Control de stock estricto impide vender si no hay suficiente unidades

## Estructura de carpetas

```
src/
├── main/           # Electron main process
│   ├── ipc/        # Handlers IPC por módulo
│   ├── services/   # Lógica de negocio
│   ├── database/   # Conexión y migraciones
│   └── utils/      # Auditoría, impresión
├── preload/        # Bridge seguro IPC
├── renderer/       # React frontend
│   └── src/
│       ├── pages/  # Páginas de la app
│       ├── components/
│       ├── store/  # Estado Zustand
│       ├── lib/    # API client, utils
│       └── styles/
└── shared/         # Tipos y constantes compartidos
    └── types/
        ├── entities.ts  # Entidades del dominio
        ├── dtos.ts      # Data transfer objects
        └── ipc.ts       # Canales IPC
database/
├── migrations/     # Schema SQL
└── seeds/          # Datos iniciales
```

## Próximas fases (roadmap)

### Fase 2
- Módulo de promociones completo con UI
- Cierre de caja con form de conteo por método
- Reporte de cierre diario imprimible
- Modo offline básico

### Fase 3
- Impresora térmica (ESC/POS) real
- Múltiples sucursales
- App web complementaria para reportes
- Módulo de reservas
- Notificaciones de stock bajo

### Fase 4
- Integración facturación electrónica DIAN
- API pública para integraciones
- Dashboard en tiempo real multiusuario

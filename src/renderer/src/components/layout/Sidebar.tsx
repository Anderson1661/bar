import React from 'react'
import {
  LayoutDashboard, UtensilsCrossed, Package, Warehouse,
  Receipt, Users, BarChart3, ClipboardList, Settings, LogOut,
  Flame, Coffee
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useAppStore }  from '../../store/app.store'
import { cn } from '../../lib/utils'
import type { PageKey } from './MainLayout'

interface NavItem {
  key:     PageKey
  label:   string
  icon:    React.ReactNode
  perm?:   string
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard',  label: 'Dashboard',   icon: <LayoutDashboard size={18} /> },
  { key: 'tables',     label: 'Mesas',        icon: <Coffee size={18} /> },
  { key: 'products',   label: 'Productos',    icon: <UtensilsCrossed size={18} />, adminOnly: true },
  { key: 'inventory',  label: 'Inventario',   icon: <Warehouse size={18} />, perm: 'inventory.view' },
  { key: 'expenses',   label: 'Gastos',       icon: <Receipt size={18} />, perm: 'expenses.view' },
  { key: 'users',      label: 'Usuarios',     icon: <Users size={18} />, adminOnly: true },
  { key: 'reports',    label: 'Reportes',     icon: <BarChart3 size={18} />, perm: 'reports.view' },
  { key: 'audit',      label: 'Auditoría',    icon: <ClipboardList size={18} />, adminOnly: true },
  { key: 'settings',   label: 'Configuración',icon: <Settings size={18} />, adminOnly: true },
]

interface SidebarProps {
  currentPage: PageKey
  onNavigate:  (page: PageKey) => void
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps): JSX.Element {
  const { user, logout, hasPermission, isAdmin } = useAuthStore()
  const cashSessionId = useAppStore((s) => s.cashSessionId)

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly) return isAdmin()
    if (item.perm) return hasPermission(item.perm)
    return true
  })

  return (
    <aside className="w-56 flex flex-col bg-card border-r border-border">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Flame size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">Full Gas</p>
            <p className="text-xs text-muted-foreground">Gastrobar</p>
          </div>
        </div>
      </div>

      {/* Session badge */}
      {cashSessionId && (
        <div className="mx-3 mt-3 px-2 py-1 rounded bg-green-500/20 border border-green-500/30">
          <p className="text-xs text-green-400 font-medium">Caja abierta</p>
        </div>
      )}
      {!cashSessionId && (
        <div className="mx-3 mt-3 px-2 py-1 rounded bg-amber-500/20 border border-amber-500/30">
          <p className="text-xs text-amber-400 font-medium">Sin sesión de caja</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left',
              currentPage === item.key
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs text-primary font-bold">
              {user?.fullName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{user?.fullName}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.roleName}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut size={13} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}

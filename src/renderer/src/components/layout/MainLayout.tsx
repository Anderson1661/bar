import React, { useState } from 'react'
import Sidebar from './Sidebar'
import { useAppStore } from '../../store/app.store'

// Pages
import DashboardPage    from '../../pages/Dashboard/DashboardPage'
import TablesPage       from '../../pages/Tables/TablesPage'
import ProductsPage     from '../../pages/Products/ProductsPage'
import InventoryPage    from '../../pages/Inventory/InventoryPage'
import ExpensesPage     from '../../pages/Expenses/ExpensesPage'
import UsersPage        from '../../pages/Users/UsersPage'
import ReportsPage      from '../../pages/Reports/ReportsPage'
import AuditPage        from '../../pages/Audit/AuditPage'
import SettingsPage     from '../../pages/Settings/SettingsPage'
import NotificationBar  from './NotificationBar'

export type PageKey =
  | 'dashboard' | 'tables' | 'products'
  | 'inventory' | 'expenses' | 'users'
  | 'reports' | 'audit' | 'settings'

export default function MainLayout(): JSX.Element {
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard')
  const notifications = useAppStore((s) => s.notifications)
  const dismiss       = useAppStore((s) => s.dismissNotification)

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':  return <DashboardPage />
      case 'tables':     return <TablesPage />
      case 'products':   return <ProductsPage />
      case 'inventory':  return <InventoryPage />
      case 'expenses':   return <ExpensesPage />
      case 'users':      return <UsersPage />
      case 'reports':    return <ReportsPage />
      case 'audit':      return <AuditPage />
      case 'settings':   return <SettingsPage />
      default:           return <DashboardPage />
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

      <main className="flex-1 flex flex-col overflow-hidden">
        {notifications.length > 0 && (
          <NotificationBar notifications={notifications} onDismiss={dismiss} />
        )}
        <div className="flex-1 overflow-auto p-6">
          {renderPage()}
        </div>
      </main>
    </div>
  )
}

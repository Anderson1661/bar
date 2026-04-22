import React, { useEffect } from 'react'
import { useAuthStore } from './store/auth.store'
import { useAppStore } from './store/app.store'
import { cashApi } from './lib/api'
import LoginPage from './pages/Login/LoginPage'
import MainLayout from './components/layout/MainLayout'
import { Toaster } from './components/ui/toaster'

export default function App(): JSX.Element {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setCashSession  = useAppStore((s) => s.setCashSession)

  useEffect(() => {
    if (isAuthenticated) {
      cashApi.current().then((session: unknown) => {
        const s = session as { id?: number } | null
        setCashSession(s?.id ?? null)
      })
    }
  }, [isAuthenticated, setCashSession])

  return (
    <>
      {isAuthenticated ? <MainLayout /> : <LoginPage />}
      <Toaster />
    </>
  )
}

import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { settingsApi } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import { useAppStore }  from '../../store/app.store'
import { cashApi } from '../../lib/api'
import { formatCurrency } from '../../lib/utils'
import type { SystemSetting } from '@shared/types/entities'
import { Settings, Database, CreditCard } from 'lucide-react'

export default function SettingsPage(): JSX.Element {
  const { user } = useAuthStore()
  const { notify, cashSessionId, setCashSession } = useAppStore()
  const qc = useQueryClient()

  const [saving, setSaving] = useState<string | null>(null)

  const { data: settings = [] } = useQuery<SystemSetting[]>({
    queryKey: ['settings'],
    queryFn:  () => settingsApi.getAll() as Promise<SystemSetting[]>
  })

  const { data: currentSession } = useQuery({
    queryKey: ['cash-session'],
    queryFn:  () => cashApi.current()
  })

  async function updateSetting(key: string, value: string): Promise<void> {
    if (!user) return
    setSaving(key)
    await settingsApi.update(key, value, user.id)
    qc.invalidateQueries({ queryKey: ['settings'] })
    notify('success', 'Configuración guardada')
    setSaving(null)
  }

  async function openCashSession(): Promise<void> {
    if (!user) return
    const result = await cashApi.open({ openedBy: user.id, openingAmount: 0 }, user.username) as { success: boolean; data?: { id: number }; error?: string }
    if (result.success && result.data) {
      setCashSession(result.data.id)
      qc.invalidateQueries({ queryKey: ['cash-session'] })
      notify('success', 'Sesión de caja abierta')
    } else {
      notify('error', result.error ?? 'Error abriendo caja')
    }
  }

  const displayKeys = [
    'business_name', 'business_address', 'business_phone',
    'service_charge_pct', 'strict_stock_control', 'receipt_prefix',
    'currency_symbol', 'low_stock_alert', 'print_bar_ticket'
  ]

  const visibleSettings = settings.filter(s => displayKeys.includes(s.keyName))

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">Configuración</h1>

      {/* Caja */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={16} className="text-primary" />
          <h3 className="font-semibold text-foreground">Sesión de caja</h3>
        </div>
        {cashSessionId ? (
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <p className="text-sm text-foreground">Caja abierta (sesión #{cashSessionId})</p>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">No hay sesión de caja activa</p>
            <button onClick={openCashSession}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
              Abrir caja
            </button>
          </div>
        )}
      </div>

      {/* Configuración del sistema */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings size={16} className="text-primary" />
          <h3 className="font-semibold text-foreground">Configuración del sistema</h3>
        </div>
        <div className="space-y-3">
          {visibleSettings.map(s => (
            <SettingRow
              key={s.keyName}
              setting={s}
              saving={saving === s.keyName}
              onSave={updateSetting}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function SettingRow({ setting, saving, onSave }: {
  setting: SystemSetting
  saving:  boolean
  onSave:  (key: string, value: string) => Promise<void>
}): JSX.Element {
  const [value, setValue] = useState(setting.value)
  const isBool = setting.value === 'true' || setting.value === 'false'

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-foreground">{setting.description ?? setting.keyName}</p>
        <p className="text-xs text-muted-foreground">{setting.keyName}</p>
      </div>
      <div className="flex items-center gap-2">
        {isBool ? (
          <button
            onClick={() => {
              const newVal = value === 'true' ? 'false' : 'true'
              setValue(newVal)
              onSave(setting.keyName, newVal)
            }}
            className={`w-12 h-6 rounded-full transition-colors relative ${value === 'true' ? 'bg-primary' : 'bg-secondary border border-border'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${value === 'true' ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        ) : (
          <>
            <input
              value={value}
              onChange={e => setValue(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm text-foreground w-40 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={() => onSave(setting.keyName, value)}
              disabled={saving || value === setting.value}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-40"
            >
              {saving ? '...' : 'Guardar'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { promotionsApi } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import { useAppStore }  from '../../store/app.store'
import type { Promotion } from '@shared/types/entities'
import {
  Plus, Pencil, Power, PowerOff, Tag, Percent, DollarSign,
  Clock, Calendar, ChevronDown, ChevronUp
} from 'lucide-react'
import { cn } from '../../lib/utils'

const TYPE_LABELS: Record<string, string> = {
  percentage:   'Porcentaje',
  fixed_amount: 'Monto fijo',
  fixed_price:  'Precio fijo',
  combo:        'Combo',
  happy_hour:   'Happy Hour',
}

const TYPE_COLORS: Record<string, string> = {
  percentage:   'text-blue-400 bg-blue-500/20',
  fixed_amount: 'text-green-400 bg-green-500/20',
  fixed_price:  'text-violet-400 bg-violet-500/20',
  combo:        'text-orange-400 bg-orange-500/20',
  happy_hour:   'text-pink-400 bg-pink-500/20',
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function formatDiscount(promo: Promotion): string {
  if (promo.type === 'percentage')   return `${promo.discountValue}%`
  if (promo.type === 'fixed_amount') return `$${promo.discountValue.toLocaleString()}`
  if (promo.type === 'fixed_price')  return `Precio: $${promo.discountValue.toLocaleString()}`
  if (promo.type === 'combo')        return 'Combo'
  if (promo.type === 'happy_hour')   return `${promo.discountValue}% Happy Hour`
  return String(promo.discountValue)
}

function getDays(daysOfWeek: string | null): string {
  if (!daysOfWeek) return 'Todos los días'
  return daysOfWeek.split(',').map((d) => DAY_LABELS[Number(d)] ?? d).join(', ')
}

export default function PromotionsPage(): JSX.Element {
  const { sessionToken } = useAuthStore()
  const { notify }       = useAppStore()
  const qc               = useQueryClient()

  const [showForm,  setShowForm]  = useState(false)
  const [editing,   setEditing]   = useState<Promotion | null>(null)
  const [showAll,   setShowAll]   = useState(false)

  const { data: promotions = [], isLoading } = useQuery<Promotion[]>({
    queryKey: ['promotions', showAll],
    queryFn:  () =>
      promotionsApi.list(showAll, sessionToken ?? undefined).then((r) => {
        const res = r as { success?: boolean; data?: Promotion[] } | Promotion[]
        if (Array.isArray(res)) return res
        return (res as { data?: Promotion[] }).data ?? []
      }),
  })

  async function toggle(p: Promotion): Promise<void> {
    if (!sessionToken) return
    const result = await promotionsApi.toggle(p.id, sessionToken) as { success: boolean; error?: string }
    if (result.success) {
      notify('success', `Promoción ${p.isActive ? 'desactivada' : 'activada'}`)
      qc.invalidateQueries({ queryKey: ['promotions'] })
    } else {
      notify('error', result.error ?? 'Error')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Promociones</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestión de descuentos y promociones del gastrobar</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAll(!showAll)}
            className="px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
          >
            {showAll ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showAll ? 'Solo activas' : 'Ver todas'}
          </button>
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
          >
            <Plus size={16} /> Nueva promoción
          </button>
        </div>
      </div>

      {/* Grid */}
      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Cargando...</div>
      )}

      {!isLoading && promotions.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Tag size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay promociones {showAll ? '' : 'activas'}.</p>
          <p className="text-sm mt-1">Crea tu primera promoción con el botón de arriba.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {promotions.map((p) => (
          <PromotionCard
            key={p.id}
            promotion={p}
            onEdit={() => { setEditing(p); setShowForm(true) }}
            onToggle={() => toggle(p)}
          />
        ))}
      </div>

      {showForm && (
        <PromotionForm
          promotion={editing}
          sessionToken={sessionToken ?? ''}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['promotions'] }) }}
          notify={notify}
        />
      )}
    </div>
  )
}

function PromotionCard({
  promotion: p,
  onEdit,
  onToggle,
}: {
  promotion: Promotion
  onEdit:    () => void
  onToggle:  () => void
}): JSX.Element {
  return (
    <div className={cn('bg-card border border-border rounded-xl p-4 space-y-3', !p.isActive && 'opacity-60')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{p.name}</p>
          {p.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>}
        </div>
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', TYPE_COLORS[p.type])}>
          {TYPE_LABELS[p.type]}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-foreground font-medium">
          <Percent size={14} className="text-primary" />
          {formatDiscount(p)}
        </div>
        {p.priority > 0 && (
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <Tag size={12} />
            Prioridad {p.priority}
          </div>
        )}
      </div>

      {(p.startTime || p.endTime || p.daysOfWeek) && (
        <div className="text-xs text-muted-foreground space-y-0.5">
          {(p.startTime || p.endTime) && (
            <div className="flex items-center gap-1">
              <Clock size={11} />
              {p.startTime ?? '--:--'} – {p.endTime ?? '--:--'}
            </div>
          )}
          <div className="flex items-center gap-1">
            <Calendar size={11} />
            {getDays(p.daysOfWeek)}
          </div>
        </div>
      )}

      {(p.validFrom || p.validUntil) && (
        <p className="text-xs text-muted-foreground">
          Vigencia: {p.validFrom ?? '?'} → {p.validUntil ?? '∞'}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground"
        >
          <Pencil size={12} /> Editar
        </button>
        <button
          onClick={onToggle}
          className={cn(
            'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border text-xs',
            p.isActive
              ? 'border-destructive/50 text-destructive/80 hover:bg-destructive/10'
              : 'border-green-500/50 text-green-500 hover:bg-green-500/10'
          )}
        >
          {p.isActive ? <PowerOff size={12} /> : <Power size={12} />}
          {p.isActive ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </div>
  )
}

const PROMOTION_TYPES = [
  { value: 'percentage',   label: 'Descuento porcentual' },
  { value: 'fixed_amount', label: 'Descuento monto fijo' },
  { value: 'fixed_price',  label: 'Precio fijo' },
  { value: 'combo',        label: 'Combo' },
  { value: 'happy_hour',   label: 'Happy Hour' },
]

const APPLIES_TO_OPTIONS = [
  { value: 'product',  label: 'Producto' },
  { value: 'category', label: 'Categoría' },
  { value: 'order',    label: 'Orden completa' },
]

const ALL_DAYS = [
  { value: '0', label: 'Dom' }, { value: '1', label: 'Lun' },
  { value: '2', label: 'Mar' }, { value: '3', label: 'Mié' },
  { value: '4', label: 'Jue' }, { value: '5', label: 'Vie' },
  { value: '6', label: 'Sáb' },
]

interface FormState {
  name:          string
  description:   string
  type:          string
  discountValue: string
  minQuantity:   string
  appliesTo:     string
  startTime:     string
  endTime:       string
  validFrom:     string
  validUntil:    string
  isActive:      boolean
  autoApply:     boolean
  priority:      string
  daysOfWeek:    string[]
}

function PromotionForm({
  promotion,
  sessionToken,
  onClose,
  onSaved,
  notify,
}: {
  promotion:    Promotion | null
  sessionToken: string
  onClose:      () => void
  onSaved:      () => void
  notify:       (type: 'success' | 'error', msg: string) => void
}): JSX.Element {
  const [form, setForm] = useState<FormState>({
    name:          promotion?.name          ?? '',
    description:   promotion?.description   ?? '',
    type:          promotion?.type          ?? 'percentage',
    discountValue: String(promotion?.discountValue ?? ''),
    minQuantity:   String(promotion?.minQuantity   ?? '1'),
    appliesTo:     promotion?.appliesTo     ?? 'product',
    startTime:     promotion?.startTime     ?? '',
    endTime:       promotion?.endTime       ?? '',
    validFrom:     promotion?.validFrom     ?? '',
    validUntil:    promotion?.validUntil    ?? '',
    isActive:      promotion?.isActive      ?? true,
    autoApply:     promotion?.autoApply     ?? false,
    priority:      String(promotion?.priority ?? '0'),
    daysOfWeek:    promotion?.daysOfWeek?.split(',').filter(Boolean) ?? [],
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  function toggleDay(d: string): void {
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(d)
        ? prev.daysOfWeek.filter((x) => x !== d)
        : [...prev.daysOfWeek, d].sort(),
    }))
  }

  function field(k: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }))
  }

  async function save(): Promise<void> {
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError(null)

    const dto = {
      name:          form.name.trim(),
      description:   form.description.trim() || undefined,
      type:          form.type as Promotion['type'],
      discountValue: Number(form.discountValue) || 0,
      minQuantity:   Number(form.minQuantity)   || 1,
      appliesTo:     form.appliesTo as Promotion['appliesTo'],
      startTime:     form.startTime  || undefined,
      endTime:       form.endTime    || undefined,
      daysOfWeek:    form.daysOfWeek.length ? form.daysOfWeek.join(',') : undefined,
      validFrom:     form.validFrom  || undefined,
      validUntil:    form.validUntil || undefined,
      isActive:      form.isActive,
      autoApply:     form.autoApply,
      priority:      Number(form.priority) || 0,
    }

    const result = promotion
      ? await promotionsApi.update({ ...dto, id: promotion.id }, sessionToken)
      : await promotionsApi.create(dto, sessionToken)

    setSaving(false)
    const r = result as { success: boolean; error?: string }
    if (r.success) {
      notify('success', promotion ? 'Promoción actualizada' : 'Promoción creada')
      onSaved()
    } else {
      setError(r.error ?? 'Error guardando')
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary'
  const labelCls = 'text-xs text-muted-foreground mb-1 block'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h3 className="font-semibold text-foreground">
            {promotion ? 'Editar promoción' : 'Nueva promoción'}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Nombre *</label>
              <input className={inputCls} value={form.name} onChange={field('name')} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Descripción</label>
              <textarea className={inputCls} rows={2} value={form.description} onChange={field('description')} />
            </div>
            <div>
              <label className={labelCls}>Tipo de promoción *</label>
              <select className={inputCls} value={form.type} onChange={field('type')}>
                {PROMOTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>
                {form.type === 'percentage' ? 'Descuento (%)' : 'Valor ($)'}
              </label>
              <input type="number" min="0" className={inputCls} value={form.discountValue} onChange={field('discountValue')} />
            </div>
            <div>
              <label className={labelCls}>Aplica a</label>
              <select className={inputCls} value={form.appliesTo} onChange={field('appliesTo')}>
                {APPLIES_TO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cantidad mínima</label>
              <input type="number" min="1" className={inputCls} value={form.minQuantity} onChange={field('minQuantity')} />
            </div>
          </div>

          {/* Schedule */}
          <div>
            <p className="text-xs font-medium text-foreground mb-2">Horario (Happy Hour / rangos)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Hora inicio</label>
                <input type="time" className={inputCls} value={form.startTime} onChange={field('startTime')} />
              </div>
              <div>
                <label className={labelCls}>Hora fin</label>
                <input type="time" className={inputCls} value={form.endTime} onChange={field('endTime')} />
              </div>
            </div>
          </div>

          {/* Days */}
          <div>
            <p className="text-xs font-medium text-foreground mb-2">Días aplicables</p>
            <div className="flex gap-2 flex-wrap">
              {ALL_DAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    form.daysOfWeek.includes(d.value)
                      ? 'bg-primary text-white border-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {d.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, daysOfWeek: [] }))}
                className="px-3 py-1.5 rounded-lg text-xs border border-border text-muted-foreground hover:text-foreground"
              >
                Todos
              </button>
            </div>
          </div>

          {/* Validity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Válida desde</label>
              <input type="date" className={inputCls} value={form.validFrom} onChange={field('validFrom')} />
            </div>
            <div>
              <label className={labelCls}>Válida hasta</label>
              <input type="date" className={inputCls} value={form.validUntil} onChange={field('validUntil')} />
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Prioridad (mayor = primero)</label>
              <input type="number" min="0" className={inputCls} value={form.priority} onChange={field('priority')} />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                id="isActive" type="checkbox" checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="accent-primary"
              />
              <label htmlFor="isActive" className="text-sm text-foreground">Activa</label>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                id="autoApply" type="checkbox" checked={form.autoApply}
                onChange={(e) => setForm((p) => ({ ...p, autoApply: e.target.checked }))}
                className="accent-primary"
              />
              <label htmlFor="autoApply" className="text-sm text-foreground">Aplicar automáticamente</label>
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 rounded bg-destructive/15 border border-destructive/30 text-destructive text-xs">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || !form.name.trim()}
            className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving && <DollarSign size={14} className="animate-spin" />}
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

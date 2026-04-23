import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ordersApi, paymentsApi, printApi, productsApi, tablesApi } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import { useAppStore } from '../../store/app.store'
import { cn, formatCurrency } from '../../lib/utils'
import type { BarTable, Order, OrderItem, Payment, PaymentMethod, Product, ProductCategory, SubOrder } from '@shared/types/entities'
import type { RegisterPaymentResponseV2 } from '@shared/types/dtos'
import { CheckCircle, DollarSign, Loader2, Plus, Receipt, RefreshCw, Search, Send, X } from 'lucide-react'
import { TABLE_STATUS_COLORS, TABLE_STATUS_LABELS } from '@shared/constants'

type View = 'map' | 'order' | 'payment'

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export default function TablesPage(): JSX.Element {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const { notify } = useAppStore()
  const [view, setView] = useState<View>('map')
  const [selectedTable, setSelectedTable] = useState<BarTable | null>(null)
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)

  const { data: tables = [], isLoading, refetch } = useQuery<BarTable[]>({
    queryKey: ['tables'],
    queryFn: () => tablesApi.list() as Promise<BarTable[]>,
    refetchInterval: 30_000,
  })

  async function reloadOrder(orderId: number): Promise<void> {
    const updated = await ordersApi.get(orderId) as Order
    setActiveOrder(updated)
    await qc.invalidateQueries({ queryKey: ['tables'] })
  }

  async function openTable(table: BarTable): Promise<void> {
    if (!user) return

    if (['available', 'reserved'].includes(table.status)) {
      const result = await ordersApi.create({ tableId: table.id, waiterId: user.id }) as { success: boolean; data?: Order; error?: string }
      if (!result.success || !result.data) {
        notify('error', result.error ?? 'No se pudo abrir la mesa')
        return
      }

      setSelectedTable(table)
      setActiveOrder(result.data)
      setView('order')
      await qc.invalidateQueries({ queryKey: ['tables'] })
      return
    }

    if (table.currentOrderId) {
      const order = await ordersApi.get(table.currentOrderId) as Order
      setSelectedTable(table)
      setActiveOrder(order)
      setView(table.status === 'pending_payment' ? 'payment' : 'order')
    }
  }

  async function toggleReservation(table: BarTable): Promise<void> {
    if (!user) return
    if (!['available', 'reserved'].includes(table.status)) return

    const nextStatus = table.status === 'reserved' ? 'available' : 'reserved'
    const result = await tablesApi.updateStatus(table.id, nextStatus) as { success?: boolean; error?: string }

    if (result?.success === false) {
      notify('error', result.error ?? 'No se pudo actualizar la reserva')
      return
    }

    notify('success', nextStatus === 'reserved' ? `Mesa #${table.number} reservada` : `Mesa #${table.number} liberada`)
    await qc.invalidateQueries({ queryKey: ['tables'] })
  }

  if (view === 'order' && selectedTable && activeOrder) {
    return (
      <OrderView
        table={selectedTable}
        order={activeOrder}
        onOrderUpdate={setActiveOrder}
        onReload={reloadOrder}
        onGoToPayment={() => setView('payment')}
        onBack={() => {
          setView('map')
          qc.invalidateQueries({ queryKey: ['tables'] })
        }}
      />
    )
  }

  if (view === 'payment' && selectedTable && activeOrder) {
    return (
      <PaymentView
        table={selectedTable}
        order={activeOrder}
        onOrderUpdate={setActiveOrder}
        onReload={reloadOrder}
        onBack={() => {
          setView('map')
          qc.invalidateQueries({ queryKey: ['tables'] })
        }}
        onViewOrder={() => setView('order')}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mesas</h1>
          <p className="text-sm text-muted-foreground">
            {tables.filter((table) => !['available', 'inactive'].includes(table.status)).length} ocupadas de {tables.filter((table) => table.isActive).length} activas
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      <div className="flex flex-wrap gap-4">
        {Object.entries(TABLE_STATUS_LABELS).filter(([status]) => status !== 'inactive').map(([status, label]) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-3 w-3 rounded-full" style={{ background: TABLE_STATUS_COLORS[status] }} />
            {label}
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {tables.filter((table) => table.isActive).map((table) => (
            <div
              key={table.id}
              onClick={() => openTable(table)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  void openTable(table)
                }
              }}
              role="button"
              tabIndex={0}
              className={cn(
                'rounded-xl border-2 p-4 text-left transition-all hover:scale-[1.02]',
                table.status === 'available' && 'table-available',
                table.status === 'occupied' && 'table-occupied',
                table.status === 'pending_payment' && 'table-pending',
                table.status === 'reserved' && 'table-reserved',
              )}
            >
              <div className="mb-2 flex items-start justify-between">
                <span className="text-lg font-bold text-foreground">#{table.number}</span>
                <div className="mt-1 h-2.5 w-2.5 rounded-full" style={{ background: TABLE_STATUS_COLORS[table.status] }} />
              </div>
              <p className="text-xs text-muted-foreground">{TABLE_STATUS_LABELS[table.status]}</p>
              {table.currentOrderTotal !== undefined && table.currentOrderTotal > 0 && (
                <p className="mt-2 text-base font-bold text-foreground">{formatCurrency(table.currentOrderTotal)}</p>
              )}
              {table.currentWaiter && <p className="mt-1 text-xs text-muted-foreground">{table.currentWaiter}</p>}
              {['available', 'reserved'].includes(table.status) && (
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    void toggleReservation(table)
                  }}
                  className="mt-3 rounded-lg border border-border bg-card/60 px-2 py-1 text-xs text-foreground hover:bg-card"
                >
                  {table.status === 'reserved' ? 'Liberar' : 'Reservar'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface OrderViewProps {
  table: BarTable
  order: Order
  onOrderUpdate: (order: Order) => void
  onReload: (orderId: number) => Promise<void>
  onGoToPayment: () => void
  onBack: () => void
}


function OrderView({ table, order, onOrderUpdate, onReload, onGoToPayment, onBack }: OrderViewProps): JSX.Element {
  const { user } = useAuthStore()
  const { notify } = useAppStore()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [selectedSubOrderId, setSelectedSubOrderId] = useState<number | null>(order.subOrders?.[0]?.id ?? null)
  const [cancelTarget, setCancelTarget] = useState<number | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [lastSentBatch, setLastSentBatch] = useState<OrderItem[]>([])

  const { data: categories = [] } = useQuery<ProductCategory[]>({
    queryKey: ['categories'],
    queryFn: () => productsApi.categories() as Promise<ProductCategory[]>,
  })

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ['products-active'],
    queryFn: () => productsApi.list(false) as Promise<Product[]>,
  })

  const filteredProducts = useMemo(() => allProducts.filter((product) => {
    const normalizedSearch = normalizeSearchText(search)
    const matchesCategory = !selectedCategory || product.categoryId === selectedCategory
    const matchesSearch = !normalizedSearch || normalizeSearchText(product.name).includes(normalizedSearch)
    return matchesCategory && matchesSearch
  }), [allProducts, search, selectedCategory])

  const subOrders = order.subOrders ?? []
  const selectedSubOrder = subOrders.find((subOrder) => subOrder.id === selectedSubOrderId) ?? subOrders[subOrders.length - 1] ?? null
  const activeItems = (selectedSubOrder?.items ?? []).filter((item) => item.status === 'active')
  const hasActiveItems = (order.items ?? []).some((item) => item.status === 'active')
  const canReleaseEmptyOrder = !hasActiveItems && order.totalPaid <= 0 && order.subtotal <= 0

  function getProductQuantity(productId: number): number {
    const raw = quantities[productId]
    const parsed = Number(raw ?? '1')
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  }

  async function handleAddItem(product: Product): Promise<void> {
    if (!user || !selectedSubOrder) return
    const quantity = getProductQuantity(product.id)
    setLoading(true)
    const result = await ordersApi.addItem(
      { orderId: order.id, subOrderId: selectedSubOrder.id, productId: product.id, quantity },
      user.id,
      user.username
    ) as { success: boolean; error?: string }
    setLoading(false)

    if (!result.success) {
      notify('error', result.error ?? 'No se pudo agregar el producto')
      return
    }

    setQuantities((current) => ({ ...current, [product.id]: '1' }))
    await onReload(order.id)
  }

  async function handleCreateSubOrder(): Promise<void> {
    if (!user) return
    const result = await ordersApi.createSubOrder(
      { orderId: order.id, createdBy: user.id },
      user.id,
      user.username
    ) as { success: boolean; data?: SubOrder; error?: string }

    if (!result.success || !result.data) {
      notify('error', result.error ?? 'No se pudo crear la tanda')
      return
    }

    await onReload(order.id)
    setSelectedSubOrderId(result.data.id)
  }

  async function handleCancelItem(): Promise<void> {
    if (!user || !cancelTarget || !cancelReason.trim()) return
    const result = await ordersApi.cancelItem(
      { orderItemId: cancelTarget, reason: cancelReason, cancelledBy: user.id },
      user.id,
      user.username
    ) as { success: boolean; error?: string }

    if (!result.success) {
      notify('error', result.error ?? 'No se pudo cancelar el ítem')
      return
    }

    setCancelTarget(null)
    setCancelReason('')
    await onReload(order.id)
  }

  async function handleSendToBar(): Promise<void> {
    if (!user) return
    const pendingIds = activeItems.filter((item) => !item.sentToBar).map((item) => item.id)
    const result = await ordersApi.sendToBar({ orderId: order.id, itemIds: pendingIds }, user.id, user.username) as { success: boolean; data?: OrderItem[]; error?: string }
    if (!result.success) {
      notify('error', result.error ?? 'No se pudo enviar a barra')
      return
    }

    const sentBatch = result.data ?? []
    setLastSentBatch(sentBatch)
    await onReload(order.id)
    notify('success', 'Tanda enviada a barra')

    // Impresión opcional y NO bloqueante
    void printBatch(sentBatch, true)
  }

  async function printBatch(batch: OrderItem[], warnOnError = true): Promise<void> {
    if (batch.length === 0) return

    setPrinting(true)
    try {
      const printableOrder: Order = {
        ...order,
        items: batch.map((item) => ({ ...item, sentToBar: false }))
      }
      await printApi.barTicket(printableOrder)
      notify('success', 'Comanda impresa')
    } catch (error) {
      if (warnOnError) {
        notify('warning', 'Tanda enviada, pero no se pudo imprimir. Puedes reintentar.')
      }
      console.error('[Tables] Error imprimiendo tanda:', error)
    } finally {
      setPrinting(false)
    }
  }

  async function handleRequestBill(): Promise<void> {
    const result = await ordersApi.requestBill(order.id) as { success: boolean; error?: string }
    if (!result.success) {
      notify('error', result.error ?? 'No se pudo pasar a cobro')
      return
    }

    await onReload(order.id)
    onGoToPayment()
  }

  async function handleReleaseEmptyOrder(): Promise<void> {
    if (!user || !canReleaseEmptyOrder) return
    const result = await ordersApi.releaseEmpty(order.id, user.id, user.username) as { success: boolean; error?: string }
    if (!result.success) {
      notify('error', result.error ?? 'No se pudo liberar la mesa')
      return
    }

    notify('success', 'Mesa liberada')
    onBack()
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
          <div>
            <h2 className="font-semibold text-foreground">Mesa #{table.number}</h2>
            <p className="text-xs text-muted-foreground">{order.waiterName}</p>
          </div>
        </div>

        <div className="border-b border-border px-4 py-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {subOrders.map((subOrder) => (
                <button
                  key={subOrder.id}
                  onClick={() => setSelectedSubOrderId(subOrder.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium',
                    selectedSubOrder?.id === subOrder.id
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                  )}
                >
                  {subOrder.label ?? `Tanda ${subOrder.roundNumber}`} · {formatCurrency(subOrder.balanceDue)}
                </button>
              ))}
            </div>
            <button
              onClick={handleCreateSubOrder}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Plus size={14} />
              Nueva tanda
            </button>
          </div>

          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar producto..."
              className="w-full rounded-lg border border-border bg-secondary py-2 pl-9 pr-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium',
                !selectedCategory ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'
              )}
            >
              Todos
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id === selectedCategory ? null : category.id)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium',
                  selectedCategory === category.id ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'
                )}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 content-start gap-3 overflow-y-auto p-4 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="rounded-lg border border-border bg-secondary p-3 transition-colors hover:border-primary/50"
            >
              <p className="text-sm font-medium text-foreground">{product.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{product.categoryName}</p>
              {product.trackInventory && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Quedan: {product.stock} {product.unit}
                </p>
              )}
              <p className="mt-2 text-base font-bold text-primary">{formatCurrency(product.salePrice)}</p>
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantities[product.id] ?? '1'}
                  onChange={(event) => setQuantities((current) => ({ ...current, [product.id]: event.target.value }))}
                  className="w-20 rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={() => handleAddItem(product)}
                  disabled={!selectedSubOrder || loading}
                  className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  Agregar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex w-96 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-semibold text-foreground">{selectedSubOrder?.label ?? 'Sin tanda'}</h3>
          <p className="text-xs text-muted-foreground">{activeItems.length} ítem(s) activos</p>
        </div>

        <div className="flex-1 divide-y divide-border overflow-y-auto">
          {activeItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Sin productos en esta tanda</div>
          ) : (
            activeItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} × {formatCurrency(item.unitPrice)} {item.sentToBar ? '· enviado' : '· pendiente'}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground">{formatCurrency(item.subtotal)}</p>
                <button onClick={() => setCancelTarget(item.id)} className="text-muted-foreground hover:text-destructive">
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="space-y-1 border-t border-border px-4 py-3">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Tanda</span>
            <span>{formatCurrency(selectedSubOrder?.subtotal ?? 0)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Total orden</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
          <div className="flex justify-between text-sm text-green-400">
            <span>Pagado</span>
            <span>{formatCurrency(order.totalPaid)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-foreground">
            <span>Saldo</span>
            <span>{formatCurrency(order.balanceDue)}</span>
          </div>
        </div>

        <div className="space-y-2 px-4 pb-4">
          {canReleaseEmptyOrder && (
            <button
              onClick={handleReleaseEmptyOrder}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary py-2.5 text-sm font-medium text-foreground"
            >
              <X size={14} />
              Liberar mesa
            </button>
          )}
          <button
            onClick={handleSendToBar}
            disabled={activeItems.filter((item) => !item.sentToBar).length === 0 || loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary py-2.5 text-sm font-medium text-foreground disabled:opacity-40"
          >
            <Send size={14} />
            Enviar tanda
          </button>
          <button
            onClick={() => void printBatch(lastSentBatch, true)}
            disabled={lastSentBatch.length === 0 || printing}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary py-2.5 text-sm font-medium text-foreground disabled:opacity-40"
          >
            {printing ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
            Reimprimir última tanda
          </button>
          <button
            onClick={handleRequestBill}
            disabled={(order.items ?? []).filter((item) => item.status === 'active').length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            <Receipt size={14} />
            Pasar a cobro
          </button>
        </div>
      </div>

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6">
            <h3 className="mb-3 font-semibold text-foreground">Cancelar ítem</h3>
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              rows={3}
              placeholder="Motivo de la cancelación"
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="mt-4 flex gap-3">
              <button onClick={() => { setCancelTarget(null); setCancelReason('') }} className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground">
                Cancelar
              </button>
              <button onClick={handleCancelItem} className="flex-1 rounded-lg bg-destructive py-2 text-sm font-medium text-white">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface PaymentViewProps {
  table: BarTable
  order: Order
  onOrderUpdate: (order: Order) => void
  onReload: (orderId: number) => Promise<void>
  onBack: () => void
  onViewOrder: () => void
}

function PaymentView({ table, order, onReload, onBack, onViewOrder }: PaymentViewProps): JSX.Element {
  const { user } = useAuthStore()
  const { notify } = useAppStore()
  const qc = useQueryClient()
  const [methodId, setMethodId] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [serviceAccepted, setServiceAccepted] = useState<boolean | null>(order.serviceAccepted)
  const [paymentTarget, setPaymentTarget] = useState<'order' | number>('order')
  const [loading, setLoading] = useState(false)

  const { data: methods = [] } = useQuery<PaymentMethod[]>({
    queryKey: ['payment-methods'],
    queryFn: () => paymentsApi.methods() as Promise<PaymentMethod[]>,
  })

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ['payments', order.id],
    queryFn: () => paymentsApi.getByOrder(order.id) as Promise<Payment[]>,
  })

  const subOrders = order.subOrders ?? []
  const subtotal = order.subtotal
  const serviceCharge = order.serviceCharge
  const targetSubOrder = typeof paymentTarget === 'number' ? subOrders.find((subOrder) => subOrder.id === paymentTarget) ?? null : null
  const targetBalance = targetSubOrder ? targetSubOrder.balanceDue : order.balanceDue
  const receivedAmount = Number(amount)
  const changePreview = Number.isFinite(receivedAmount) ? Math.max(0, receivedAmount - targetBalance) : 0

  async function registerPayment(): Promise<void> {
    if (!user || !methodId || !amount) return
    setLoading(true)
    const result = await paymentsApi.register({
      orderId: order.id,
      subOrderId: typeof paymentTarget === 'number' ? paymentTarget : undefined,
      paymentMethodId: methodId,
      amount: Number(amount),
      serviceAccepted,
      reference: reference || undefined,
      receivedBy: user.id,
    }, user.username) as { success: boolean; data?: RegisterPaymentResponseV2; error?: string }
    setLoading(false)

    if (!result.success) {
      notify('error', result.error ?? 'No se pudo registrar el pago')
      return
    }

    notify('success', `Pago registrado${result.data?.order.changeGiven ? ` · cambio ${formatCurrency(result.data.order.changeGiven)}` : ''}`)
    setAmount('')
    setReference('')
    await onReload(order.id)
    await qc.invalidateQueries({ queryKey: ['payments', order.id] })
  }

  async function closeOrder(): Promise<void> {
    if (!user || serviceAccepted === null) {
      notify('warning', 'Debes confirmar el servicio antes de cerrar')
      return
    }
    setLoading(true)
    const result = await paymentsApi.closeOrder({
      orderId: order.id,
      serviceAccepted,
      closedBy: user.id,
    }, user.username) as { success: boolean; data?: unknown; error?: string }
    setLoading(false)

    if (!result.success) {
      notify('error', result.error ?? 'No se pudo cerrar la cuenta')
      return
    }

    if (result.data) await printApi.receipt(result.data, order)
    notify('success', 'Cuenta cerrada')
    onBack()
    await qc.invalidateQueries({ queryKey: ['tables'] })
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={onViewOrder} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
          <div>
            <h2 className="font-semibold text-foreground">Cobro · Mesa #{table.number}</h2>
            <p className="text-xs text-muted-foreground">{order.waiterName}</p>
          </div>
        </div>

        <div className="border-b border-border px-4 py-3">
          <p className="mb-2 text-sm font-medium text-foreground">Destino del pago</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPaymentTarget('order')}
              className={cn(
                'rounded-full border px-3 py-1 text-xs',
                paymentTarget === 'order' ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-secondary text-muted-foreground'
              )}
            >
              Orden completa · {formatCurrency(order.balanceDue)}
            </button>
            {subOrders.map((subOrder) => (
              <button
                key={subOrder.id}
                onClick={() => setPaymentTarget(subOrder.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs',
                  paymentTarget === subOrder.id ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-secondary text-muted-foreground'
                )}
              >
                {subOrder.label ?? `Tanda ${subOrder.roundNumber}`} · {formatCurrency(subOrder.balanceDue)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 rounded-xl border border-border bg-secondary/30 p-4">
            <p className="text-sm font-medium text-foreground">Servicio</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setServiceAccepted(true)}
                className={cn('flex-1 rounded-lg py-2 text-sm', serviceAccepted === true ? 'bg-green-500/15 text-green-400' : 'bg-secondary text-muted-foreground')}
              >
                Sí
              </button>
              <button
                onClick={() => setServiceAccepted(false)}
                className={cn('flex-1 rounded-lg py-2 text-sm', serviceAccepted === false ? 'bg-red-500/15 text-red-400' : 'bg-secondary text-muted-foreground')}
              >
                No
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border">
            <div className="border-b border-border px-4 py-3">
              <h3 className="font-semibold text-foreground">Historial de pagos</h3>
            </div>
            <div className="divide-y divide-border">
              {payments.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Sin pagos registrados</div>
              ) : (
                payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <div>
                      <p className="text-foreground">{payment.paymentMethodName}</p>
                      <p className="text-xs text-muted-foreground">{payment.subOrderLabel ?? 'Orden general'} {payment.changeGiven > 0 ? `· cambio ${formatCurrency(payment.changeGiven)}` : ''}</p>
                    </div>
                    <p className="font-semibold text-foreground">{formatCurrency(payment.amount)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-1 border-t border-border px-4 py-3">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Servicio</span>
            <span>{formatCurrency(serviceCharge)}</span>
          </div>
          <div className="flex justify-between text-sm text-green-400">
            <span>Pagado</span>
            <span>{formatCurrency(order.totalPaid)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-foreground">
            <span>Saldo objetivo</span>
            <span>{formatCurrency(targetBalance)}</span>
          </div>
        </div>
      </div>

      <div className="flex w-80 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-semibold text-foreground">Registrar pago</h3>
        </div>

        <div className="flex-1 space-y-4 p-4">
          <div className="grid grid-cols-2 gap-2">
            {methods.map((method) => (
              <button
                key={method.id}
                onClick={() => setMethodId(method.id)}
                className={cn(
                  'rounded-lg border py-2 text-xs font-medium',
                  methodId === method.id ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-secondary text-muted-foreground'
                )}
              >
                {method.name}
              </button>
            ))}
          </div>

          <div>
            <p className="mb-1 text-xs text-muted-foreground">Monto recibido</p>
            <input
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={String(targetBalance)}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-lg font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <p className="mb-1 text-xs text-muted-foreground">Referencia</p>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <p className="mb-1 text-xs text-muted-foreground">Cambio a devolver</p>
            <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-semibold text-foreground">
              {formatCurrency(changePreview)}
            </div>
          </div>
        </div>

        <div className="space-y-2 px-4 pb-4">
          <button
            onClick={registerPayment}
            disabled={!methodId || !amount || loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary py-2.5 text-sm font-medium text-foreground disabled:opacity-40"
          >
            <DollarSign size={14} />
            Registrar pago
          </button>
          <button
            onClick={closeOrder}
            disabled={order.balanceDue > 0 || loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Cerrar cuenta
          </button>
        </div>
      </div>
    </div>
  )
}

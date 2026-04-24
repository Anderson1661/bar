import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../../lib/api'
import { useAuthStore } from '../../store/auth.store'
import { useAppStore }  from '../../store/app.store'
import type { User } from '@shared/types/entities'
import { Plus, Pencil, ToggleLeft, ToggleRight, ShieldCheck } from 'lucide-react'
import { cn } from '../../lib/utils'
import { formatDateTime } from '../../lib/utils'

const ROLE_LABELS: Record<string, string> = { admin: 'Administrador', mesero: 'Mesero', developer: 'Desarrollador' }
const ROLE_COLORS: Record<string, string> = {
  admin:     'text-primary bg-primary/20',
  mesero:    'text-blue-400 bg-blue-500/20',
  developer: 'text-violet-400 bg-violet-500/20',
}

export default function UsersPage(): JSX.Element {
  const { user: currentUser } = useAuthStore()
  const { notify } = useAppStore()
  const qc = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState<User | null>(null)

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn:  () => usersApi.list() as Promise<User[]>
  })

  async function toggleUser(u: User): Promise<void> {
    if (!currentUser || u.id === currentUser.id) return
    const result = await usersApi.update(
      { id: u.id, isActive: !u.isActive }, currentUser.id, currentUser.username
    ) as { success: boolean; error?: string }
    if (result.success) {
      notify('success', `Usuario ${u.isActive ? 'desactivado' : 'activado'}`)
      qc.invalidateQueries({ queryKey: ['users'] })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(u => (
          <div key={u.id} className={cn('bg-card border border-border rounded-xl p-4', !u.isActive && 'opacity-50')}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold">{u.fullName.charAt(0).toUpperCase()}</span>
              </div>
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', ROLE_COLORS[u.roleName] ?? '')}>
                {ROLE_LABELS[u.roleName] ?? u.roleName}
              </span>
            </div>
            <p className="font-semibold text-foreground">{u.fullName}</p>
            <p className="text-sm text-muted-foreground">@{u.username}</p>
            {u.email && <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>}
            {u.lastLoginAt && (
              <p className="text-xs text-muted-foreground mt-1">Último acceso: {formatDateTime(u.lastLoginAt)}</p>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setEditing(u); setShowForm(true) }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground">
                <Pencil size={12} /> Editar
              </button>
              {u.id !== currentUser?.id && (
                <button onClick={() => toggleUser(u)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground">
                  {u.isActive ? <ToggleRight size={13} className="text-green-400" /> : <ToggleLeft size={13} />}
                  {u.isActive ? 'Desactivar' : 'Activar'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <UserForm
          user={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['users'] }) }}
        />
      )}
    </div>
  )
}

function UserForm({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => void }): JSX.Element {
  const { user: currentUser } = useAuthStore()
  const { notify } = useAppStore()

  const [form, setForm] = useState({
    username: user?.username ?? '',
    fullName: user?.fullName ?? '',
    email:    user?.email    ?? '',
    roleId:   user?.roleId   ?? 2,
    password: '',
  })
  const [saving, setSaving] = useState(false)

  async function save(): Promise<void> {
    if (!currentUser) return
    setSaving(true)
    const result = user
      ? await usersApi.update({ id: user.id, fullName: form.fullName, email: form.email, roleId: form.roleId }, currentUser.id, currentUser.username)
      : await usersApi.create(form, currentUser.id, currentUser.username)

    setSaving(false)
    const r = result as { success: boolean; error?: string }
    if (r.success) {
      notify('success', user ? 'Usuario actualizado' : 'Usuario creado')
      onSaved()
    } else {
      notify('error', r.error ?? 'Error guardando usuario')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-semibold text-foreground">{user ? 'Editar usuario' : 'Nuevo usuario'}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Usuario *</label>
            <input value={form.username} onChange={e => setForm({...form, username: e.target.value})}
              disabled={!!user}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nombre completo *</label>
            <input value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Rol *</label>
            <select value={form.roleId} onChange={e => setForm({...form, roleId: Number(e.target.value)})}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none">
              <option value={1}>Administrador</option>
              <option value={2}>Mesero</option>
              <option value={3}>Desarrollador</option>
            </select>
          </div>
          {!user && (
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Contraseña * (mín. 6 caracteres)</label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground">Cancelar</button>
          <button onClick={save} disabled={saving || !form.username || !form.fullName}
            className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-40">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { query, queryOne, execute } from '../database/connection'
import { auditLog } from '../utils/audit'
import { authService } from './auth.service'
import type { User } from '@shared/types/entities'
import type { CreateUserDTO, UpdateUserDTO, ApiResult } from '@shared/types/dtos'

function mapUser(row: Record<string, unknown>): User {
  return {
    id:          row.id as number,
    username:    row.username as string,
    fullName:    row.full_name as string,
    email:       row.email as string | null,
    roleId:      row.role_id as number,
    roleName:    row.role_name as User['roleName'],
    isActive:    Boolean(row.is_active),
    lastLoginAt: row.last_login_at as string | null,
    createdAt:   row.created_at as string,
  }
}

export class UsersService {
  async list(): Promise<User[]> {
    const rows = await query(
      `SELECT u.*, r.name AS role_name
       FROM users u JOIN roles r ON r.id = u.role_id
       ORDER BY u.full_name`
    )
    return rows.map(r => mapUser(r as Record<string, unknown>))
  }

  async create(dto: CreateUserDTO, actorId: number, actorUsername: string): Promise<ApiResult<User>> {
    const existing = await queryOne('SELECT id FROM users WHERE username = ?', [dto.username])
    if (existing) return { success: false, error: 'El nombre de usuario ya existe', code: 'DUPLICATE' }

    if (dto.password.length < 6) {
      return { success: false, error: 'La contraseña debe tener al menos 6 caracteres', code: 'WEAK_PASSWORD' }
    }

    const hash = await authService.hashPassword(dto.password)
    const { insertId } = await execute(
      `INSERT INTO users (username, full_name, email, password_hash, role_id)
       VALUES (?, ?, ?, ?, ?)`,
      [dto.username, dto.fullName, dto.email ?? null, hash, dto.roleId]
    )

    await auditLog({
      userId: actorId, username: actorUsername,
      action: 'CREATE', module: 'users', recordId: String(insertId),
      description: `Usuario "${dto.username}" creado`
    })

    const users = await this.list()
    return { success: true, data: users.find(u => u.id === insertId)! }
  }

  async update(dto: UpdateUserDTO, actorId: number, actorUsername: string): Promise<ApiResult<User>> {
    const current = await queryOne<{ username: string }>(
      'SELECT username FROM users WHERE id = ?', [dto.id]
    )
    if (!current) return { success: false, error: 'Usuario no encontrado', code: 'NOT_FOUND' }

    await execute(
      `UPDATE users SET
         full_name = COALESCE(?, full_name),
         email     = COALESCE(?, email),
         role_id   = COALESCE(?, role_id),
         is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [dto.fullName, dto.email, dto.roleId,
       dto.isActive !== undefined ? (dto.isActive ? 1 : 0) : null, dto.id]
    )

    await auditLog({
      userId: actorId, username: actorUsername,
      action: 'UPDATE', module: 'users', recordId: String(dto.id),
      description: `Usuario "${current.username}" actualizado`,
      newValues: dto
    })

    const users = await this.list()
    return { success: true, data: users.find(u => u.id === dto.id)! }
  }

  async getRoles() {
    return query('SELECT id, name, description FROM roles WHERE is_active = 1 ORDER BY name')
  }
}

export const usersService = new UsersService()

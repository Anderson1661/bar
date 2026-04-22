import bcrypt from 'bcryptjs'
import { query, queryOne, execute } from '../database/connection'
import { auditLog } from '../utils/audit'
import type { LoginDTO, AuthResponse, ChangePasswordDTO, ApiResult } from '@shared/types/dtos'

interface UserRow {
  id: number
  username: string
  full_name: string
  email: string | null
  password_hash: string
  role_id: number
  role_name: string
  is_active: number
  last_login_at: string | null
}

interface PermissionRow {
  name: string
}

export class AuthService {
  async verifyAdminCredentials(username: string, password: string): Promise<ApiResult<{ id: number; username: string; fullName: string }>> {
    const normalizedUsername = String(username ?? '').trim()
    const normalizedPassword = String(password ?? '')

    if (!normalizedUsername || !normalizedPassword) {
      return { success: false, error: 'Credenciales de administrador requeridas', code: 'ADMIN_AUTH_REQUIRED' }
    }

    const user = await queryOne<UserRow>(
      `SELECT u.id, u.username, u.full_name, u.email, u.password_hash,
              u.role_id, r.name AS role_name, u.is_active, u.last_login_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.username = ? LIMIT 1`,
      [normalizedUsername]
    )

    if (!user || !user.is_active || user.role_name !== 'admin') {
      return { success: false, error: 'Administrador no autorizado', code: 'ADMIN_INVALID' }
    }

    const passwordValid = await bcrypt.compare(normalizedPassword, user.password_hash)
    if (!passwordValid) {
      return { success: false, error: 'Contraseña de administrador incorrecta', code: 'ADMIN_INVALID_PASSWORD' }
    }

    return {
      success: true,
      data: { id: user.id, username: user.username, fullName: user.full_name }
    }
  }

  async login(dto: LoginDTO): Promise<ApiResult<AuthResponse>> {
    const user = await queryOne<UserRow>(
      `SELECT u.id, u.username, u.full_name, u.email, u.password_hash,
              u.role_id, r.name AS role_name, u.is_active, u.last_login_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.username = ? LIMIT 1`,
      [dto.username]
    )

    if (!user) {
      return { success: false, error: 'Usuario o contraseña incorrectos', code: 'INVALID_CREDENTIALS' }
    }

    if (!user.is_active) {
      return { success: false, error: 'Usuario inactivo. Contacte al administrador.', code: 'USER_INACTIVE' }
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password_hash)
    if (!passwordValid) {
      return { success: false, error: 'Usuario o contraseña incorrectos', code: 'INVALID_CREDENTIALS' }
    }

    // Cargar permisos del rol
    const permissions = await query<PermissionRow>(
      `SELECT p.name
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = ?`,
      [user.role_id]
    )

    await execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id])

    await auditLog({
      userId:      user.id,
      username:    user.username,
      action:      'LOGIN',
      module:      'auth',
      recordId:    String(user.id),
      description: `Inicio de sesión exitoso`
    })

    return {
      success: true,
      data: {
        user: {
          id:          user.id,
          username:    user.username,
          fullName:    user.full_name,
          roleName:    user.role_name,
          permissions: permissions.map((p) => p.name)
        },
        token: `session_${user.id}_${Date.now()}`
      }
    }
  }

  async changePassword(dto: ChangePasswordDTO): Promise<ApiResult> {
    const user = await queryOne<{ id: number; password_hash: string; username: string }>(
      'SELECT id, password_hash, username FROM users WHERE id = ? AND is_active = 1',
      [dto.userId]
    )

    if (!user) return { success: false, error: 'Usuario no encontrado', code: 'NOT_FOUND' }

    const valid = await bcrypt.compare(dto.currentPassword, user.password_hash)
    if (!valid) {
      return { success: false, error: 'Contraseña actual incorrecta', code: 'INVALID_PASSWORD' }
    }

    if (dto.newPassword.length < 6) {
      return { success: false, error: 'La nueva contraseña debe tener al menos 6 caracteres', code: 'WEAK_PASSWORD' }
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12)
    await execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, dto.userId])

    await auditLog({
      userId:      dto.userId,
      username:    user.username,
      action:      'CHANGE_PASSWORD',
      module:      'auth',
      recordId:    String(dto.userId),
      description: 'Cambio de contraseña'
    })

    return { success: true }
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 12)
  }
}

export const authService = new AuthService()

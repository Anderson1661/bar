import type { IpcMainInvokeEvent } from 'electron'
import { auditLog } from '../utils/audit'
import { getSessionActor, requireSessionActor } from './session'
import { IPC_ERROR_CODES, errorResult } from './validation'

interface AuthzErrorResult {
  success: false
  error: string
  code: typeof IPC_ERROR_CODES.AUTH_REQUIRED | typeof IPC_ERROR_CODES.AUTHZ_DENY
}

export async function withAuthenticatedActor<T>(
  event: IpcMainInvokeEvent,
  handler: (actor: ReturnType<typeof requireSessionActor>) => Promise<T>
): Promise<T | AuthzErrorResult> {
  const actor = getSessionActor(event)
  if (!actor) return errorResult(IPC_ERROR_CODES.AUTH_REQUIRED, 'Sesión no válida. Inicia sesión nuevamente.')
  return handler(actor)
}

export function requirePermission<TArgs extends unknown[], TResult>(
  permission: string,
  handler: (event: IpcMainInvokeEvent, actor: ReturnType<typeof requireSessionActor>, ...args: TArgs) => Promise<TResult>
) {
  return async (event: IpcMainInvokeEvent, ...args: TArgs): Promise<TResult | AuthzErrorResult> => {
    const actor = getSessionActor(event)
    if (!actor) return errorResult(IPC_ERROR_CODES.AUTH_REQUIRED, 'Sesión no válida. Inicia sesión nuevamente.')

    const allowed = actor.roleName === 'admin' || actor.permissions.includes(permission)
    if (!allowed) {
      await auditLog({
        userId: actor.id,
        username: actor.username,
        action: 'AUTHZ_DENY',
        module: permission.split('.')[0] ?? 'authz',
        description: `Acceso denegado: permiso requerido "${permission}"`,
        details: { permission, actorRole: actor.roleName }
      })
      return errorResult(IPC_ERROR_CODES.AUTHZ_DENY, 'No tienes permisos para ejecutar esta acción.')
    }

    return handler(event, actor, ...args)
  }
}

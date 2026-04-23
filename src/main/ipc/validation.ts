import type { ZodType } from 'zod'

export const IPC_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTHZ_DENY: 'AUTHZ_DENY',
} as const

export type IpcErrorCode = typeof IPC_ERROR_CODES[keyof typeof IPC_ERROR_CODES] | string

export interface IpcErrorResult {
  success: false
  error: string
  code: IpcErrorCode
  details?: unknown
}

export function errorResult(code: IpcErrorCode, error: string, details?: unknown): IpcErrorResult {
  return { success: false, code, error, details }
}

export function parsePayload<T>(schema: ZodType<T>, payload: unknown): { success: true; data: T } | { success: false; result: IpcErrorResult } {
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    return {
      success: false,
      result: errorResult(IPC_ERROR_CODES.VALIDATION_ERROR, 'Payload inválido', parsed.error.flatten()),
    }
  }
  return { success: true, data: parsed.data }
}

import type { IpcMainInvokeEvent } from 'electron'

export interface SessionActor {
  id: number
  username: string
  fullName: string
  roleName: string
  permissions: string[]
  token: string
}

const sessionsByWebContentsId = new Map<number, SessionActor>()

export function createSession(event: IpcMainInvokeEvent, actor: SessionActor): void {
  sessionsByWebContentsId.set(event.sender.id, actor)
}

export function clearSession(event: IpcMainInvokeEvent): void {
  sessionsByWebContentsId.delete(event.sender.id)
}

export function getSessionActor(event: IpcMainInvokeEvent): SessionActor | null {
  return sessionsByWebContentsId.get(event.sender.id) ?? null
}

export function requireSessionActor(event: IpcMainInvokeEvent): SessionActor {
  const actor = getSessionActor(event)
  if (!actor) throw new Error('UNAUTHENTICATED')
  return actor
}


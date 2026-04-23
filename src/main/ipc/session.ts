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

function isTokenValidForActor(token: string, actorId: number): boolean {
  const match = /^session_(\d+)_(\d+)$/.exec(token)
  if (!match) return false

  const tokenActorId = Number(match[1])
  const issuedAt = Number(match[2])
  return Number.isInteger(tokenActorId) && tokenActorId === actorId && Number.isFinite(issuedAt) && issuedAt > 0
}

export function createSession(event: IpcMainInvokeEvent, actor: SessionActor): void {
  sessionsByWebContentsId.set(event.sender.id, actor)
}

export function clearSession(event: IpcMainInvokeEvent): void {
  sessionsByWebContentsId.delete(event.sender.id)
}

export function getSessionActor(event: IpcMainInvokeEvent): SessionActor | null {
  const actor = sessionsByWebContentsId.get(event.sender.id)
  if (!actor) return null

  if (!isTokenValidForActor(actor.token, actor.id)) {
    sessionsByWebContentsId.delete(event.sender.id)
    return null
  }

  return actor
}

export function requireSessionActor(event: IpcMainInvokeEvent): SessionActor {
  const actor = getSessionActor(event)
  if (!actor) throw new Error('UNAUTHENTICATED')
  return actor
}

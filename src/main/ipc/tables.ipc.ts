import { ipcMain } from 'electron'
import { tablesService } from '../services/tables.service'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { withAuthenticatedActor } from './authz'
import { idParamSchema, wrappedDto } from '@shared/schemas/dtos'
import { parsePayload } from './validation'
import { z } from 'zod'

const tableCreateSchema = z.object({ data: z.object({ number: z.number().int().positive(), name: z.string().optional() }) })
const tableUpdateSchema = z.object({ id: idParamSchema, data: z.object({ number: z.number().int().positive().optional(), name: z.string().optional() }) })
const tableStatusSchema = z.object({ id: idParamSchema, status: z.enum(['available', 'occupied', 'reserved']) })

export function registerTablesIpc(): void {
  ipcMain.handle(IPC_CHANNELS.TABLES_LIST, async () => tablesService.list())

  ipcMain.handle(IPC_CHANNELS.TABLES_GET, async (_, payload) => {
    const parsed = parsePayload(idParamSchema, payload)
    if (!parsed.success) return parsed.result
    return tablesService.getById(parsed.data)
  })

  ipcMain.handle(IPC_CHANNELS.TABLES_CREATE, async (event, payload) => {
    const parsed = parsePayload(tableCreateSchema, payload)
    if (!parsed.success) return parsed.result
    return withAuthenticatedActor(event, async (actor) => tablesService.create(parsed.data.data, actor.id, actor.username))
  })

  ipcMain.handle(IPC_CHANNELS.TABLES_UPDATE, async (event, payload) => {
    const parsed = parsePayload(tableUpdateSchema, payload)
    if (!parsed.success) return parsed.result
    return withAuthenticatedActor(event, async (actor) =>
      tablesService.update(parsed.data.id, parsed.data.data, actor.id, actor.username)
    )
  })

  ipcMain.handle(IPC_CHANNELS.TABLES_STATUS, async (_, payload) => {
    const parsed = parsePayload(tableStatusSchema, payload)
    if (!parsed.success) return parsed.result
    await tablesService.updateStatus(parsed.data.id, parsed.data.status)
    return { success: true }
  })
}

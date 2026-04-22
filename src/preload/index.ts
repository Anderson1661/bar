import { contextBridge, ipcRenderer } from 'electron'
import type { IpcChannel } from '@shared/types/ipc'

// API expuesta al renderer de forma segura
const api = {
  invoke: <T = unknown>(channel: IpcChannel, ...args: unknown[]): Promise<T> =>
    ipcRenderer.invoke(channel, ...args),
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => listener(...args))
  },
  off: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, listener)
  },
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronApi = typeof api

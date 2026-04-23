import { contextBridge, ipcRenderer } from 'electron'
import type { IpcChannel, IpcEventChannel } from '@shared/types/ipc'

type RendererListener = (...args: unknown[]) => void
type ElectronListener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => void

// API expuesta al renderer de forma segura
const wrappedListeners = new Map<RendererListener, Map<IpcEventChannel, ElectronListener>>()

const api = {
  invoke: <T = unknown>(channel: IpcChannel, ...args: unknown[]): Promise<T> =>
    ipcRenderer.invoke(channel, ...args),
  on: (channel: IpcEventChannel, listener: RendererListener) => {
    const wrapped: ElectronListener = (_event, ...args) => listener(...args)
    const byChannel = wrappedListeners.get(listener) ?? new Map<IpcEventChannel, ElectronListener>()

    byChannel.set(channel, wrapped)
    wrappedListeners.set(listener, byChannel)

    ipcRenderer.on(channel, wrapped)
  },
  off: (channel: IpcEventChannel, listener: RendererListener) => {
    const wrapped = wrappedListeners.get(listener)?.get(channel)
    if (!wrapped) return

    ipcRenderer.removeListener(channel, wrapped)

    const byChannel = wrappedListeners.get(listener)
    if (!byChannel) return

    byChannel.delete(channel)
    if (byChannel.size === 0) {
      wrappedListeners.delete(listener)
    }
  },
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronApi = typeof api

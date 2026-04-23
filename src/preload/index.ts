import { contextBridge, ipcRenderer } from 'electron'
import type { IpcChannel, IpcEventChannel } from '@shared/types/ipc'

type RendererListener = (...args: unknown[]) => void
type ElectronListener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => void

// API expuesta al renderer de forma segura
const wrappedListeners = new Map<RendererListener, Map<IpcEventChannel, ElectronListener>>()

const setWrappedListener = (
  channel: IpcEventChannel,
  listener: RendererListener,
  wrapped: ElectronListener
): void => {
  const byChannel = wrappedListeners.get(listener) ?? new Map<IpcEventChannel, ElectronListener>()

  byChannel.set(channel, wrapped)
  wrappedListeners.set(listener, byChannel)
}

const getWrappedListener = (
  channel: IpcEventChannel,
  listener: RendererListener
): ElectronListener | undefined => wrappedListeners.get(listener)?.get(channel)

const deleteWrappedListener = (channel: IpcEventChannel, listener: RendererListener): void => {
  const byChannel = wrappedListeners.get(listener)
  if (!byChannel) return

  byChannel.delete(channel)
  if (byChannel.size === 0) {
    wrappedListeners.delete(listener)
  }
}

const api = {
  invoke: <T = unknown>(channel: IpcChannel, ...args: unknown[]): Promise<T> =>
    ipcRenderer.invoke(channel, ...args),
  on: (channel: IpcEventChannel, listener: RendererListener) => {
    const previousWrapped = getWrappedListener(channel, listener)
    if (previousWrapped) {
      ipcRenderer.removeListener(channel, previousWrapped)
    }

    const wrapped: ElectronListener = (_event, ...args) => listener(...args)
    setWrappedListener(channel, listener, wrapped)
    ipcRenderer.on(channel, wrapped)
  },
  once: (channel: IpcEventChannel, listener: RendererListener) => {
    const previousWrapped = getWrappedListener(channel, listener)
    if (previousWrapped) {
      ipcRenderer.removeListener(channel, previousWrapped)
    }

    const wrapped: ElectronListener = (_event, ...args) => {
      listener(...args)
      deleteWrappedListener(channel, listener)
    }

    setWrappedListener(channel, listener, wrapped)
    ipcRenderer.once(channel, wrapped)
  },
  off: (channel: IpcEventChannel, listener: RendererListener) => {
    const wrapped = getWrappedListener(channel, listener)
    if (!wrapped) return

    ipcRenderer.removeListener(channel, wrapped)
    deleteWrappedListener(channel, listener)
  },
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronApi = typeof api

import type { ElectronApi } from '../index'

const exposeInMainWorld = jest.fn()
const on = jest.fn()
const once = jest.fn()
const removeListener = jest.fn()
const invoke = jest.fn()

jest.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { on, once, removeListener, invoke },
}))

describe('preload api event wrappers', () => {
  let api: ElectronApi

  beforeEach(async () => {
    jest.resetModules()
    exposeInMainWorld.mockClear()
    on.mockClear()
    once.mockClear()
    removeListener.mockClear()
    invoke.mockClear()

    await import('../index')
    api = exposeInMainWorld.mock.calls[0][1] as ElectronApi
  })

  it('suscribe y desuscribe usando el wrapper correcto', () => {
    const listener = jest.fn()
    const channel = 'event:test' as never

    api.on(channel, listener)

    expect(on).toHaveBeenCalledTimes(1)
    const wrappedListener = on.mock.calls[0][1]

    api.off(channel, listener)

    expect(removeListener).toHaveBeenCalledWith(channel, wrappedListener)
  })

  it('expone once seguro y permite remover antes de disparar', () => {
    const listener = jest.fn()
    const channel = 'event:test-once' as never

    api.once(channel, listener)

    expect(once).toHaveBeenCalledTimes(1)
    const wrappedListener = once.mock.calls[0][1]

    api.off(channel, listener)

    expect(removeListener).toHaveBeenCalledWith(channel, wrappedListener)
  })
})

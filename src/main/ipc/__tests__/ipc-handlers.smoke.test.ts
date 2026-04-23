jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}))

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types/ipc'
import { registerAllIpcHandlers } from '../index'

describe('IPC smoke: canales públicos', () => {
  it('registra un handler por cada canal público', () => {
    registerAllIpcHandlers()

    const handleMock = ipcMain.handle as jest.Mock
    const registeredChannels = new Set(handleMock.mock.calls.map(([channel]) => channel))
    const publicChannels = Object.values(IPC_CHANNELS)

    expect(registeredChannels).toEqual(new Set(publicChannels))
  })
})

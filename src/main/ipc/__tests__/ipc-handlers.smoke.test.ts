jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}))

import { ipcMain } from 'electron'
import { IPC_CHANNELS, IPC_CHANNEL_STATUS } from '@shared/types/ipc'
import { registerAllIpcHandlers } from '../index'

describe('IPC smoke: canales públicos', () => {
  it('registra un handler por cada canal público declarado como implemented', () => {
    registerAllIpcHandlers()

    const handleMock = ipcMain.handle as jest.Mock
    const registeredChannels = new Set(handleMock.mock.calls.map(([channel]) => channel))
    const publicChannels = Object.values(IPC_CHANNELS).filter(
      (channel) => IPC_CHANNEL_STATUS[channel] === 'implemented'
    )

    for (const publicChannel of publicChannels) {
      expect(registeredChannels.has(publicChannel)).toBe(true)
    }
  })
})

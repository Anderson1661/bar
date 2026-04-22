import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { config } from 'dotenv'
import { closeDatabase } from './database/connection'
import { runMigrations } from './database/migrate'
import { registerAllIpcHandlers } from './ipc'

// Cargar variables de entorno
config({ path: join(app.getPath('userData'), '.env') })
// Fallback a .env local en desarrollo
if (is.dev) config()

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width:             1280,
    height:            800,
    minWidth:          1024,
    minHeight:         700,
    show:              false,
    autoHideMenuBar:   true,
    title:             'Full Gas Gastrobar',
    webPreferences: {
      preload:          join(__dirname, '../preload/index.js'),
      sandbox:          false,
      contextIsolation: true,
      nodeIntegration:  false,
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.fullgas.gastrobar')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  try {
    await runMigrations()
    console.log('[App] Base de datos inicializada y migrada')
  } catch (err) {
    console.error('[App] Error conectando a MySQL:', err)
    // Mostrar ventana de error de conexión si falla
  }

  registerAllIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  await closeDatabase()
  if (process.platform !== 'darwin') app.quit()
})

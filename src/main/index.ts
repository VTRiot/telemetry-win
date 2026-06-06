import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc'
import { closeAllClients } from './services/sshClient'
import { closeAllPty } from './services/ptySession'
import { SPLASH_HEIGHT, SPLASH_MIN_DURATION_MS, SPLASH_WIDTH } from './services/constants'

function getSplashHtmlPath(): string {
  if (is.dev) {
    return join(__dirname, '../../resources/splash.html')
  }
  return join(process.resourcesPath, 'splash.html')
}

function createSplashWindow(): BrowserWindow {
  const splash = new BrowserWindow({
    width: SPLASH_WIDTH,
    height: SPLASH_HEIGHT,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    icon,
    webPreferences: {
      sandbox: true
    }
  })
  splash.loadFile(getSplashHtmlPath())
  return splash
}

function createMainWindow(splash: BrowserWindow, splashStart: number): BrowserWindow {
  const win = new BrowserWindow({
    title: 'CCPIT-R — Remote Operator',
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  win.on('ready-to-show', () => {
    const elapsed = Date.now() - splashStart
    const remaining = Math.max(0, SPLASH_MIN_DURATION_MS - elapsed)
    setTimeout(() => {
      if (!splash.isDestroyed()) splash.destroy()
      win.show()
    }, remaining)
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.vtriot.ccpit-r')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()

  // Splash → Main の起動フロー (v1.0.2 で導入、既知の splash パターン最小抽出、appConfig 依存除去)
  const splash = createSplashWindow()
  const splashStart = Date.now()
  createMainWindow(splash, splashStart)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const s = createSplashWindow()
      createMainWindow(s, Date.now())
    }
  })
})

app.on('window-all-closed', () => {
  closeAllPty()
  closeAllClients()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  closeAllPty()
  closeAllClients()
})

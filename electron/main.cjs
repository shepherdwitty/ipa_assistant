/**
 * Electron 主进程：内嵌 Edge TTS（+ 生产环境静态站），加载本机页面。
 * 支持打包 arm64 / x64 macOS。
 */
const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

const WEB_PORT = Number(process.env.WEB_PORT || 17321)
const TTS_PORT = Number(process.env.TTS_PORT || 17322)
const isDev = !app.isPackaged

/** @type {import('http').Server | null} */
let ttsHttpServer = null
/** @type {BrowserWindow | null} */
let mainWindow = null

function resolveDistDir() {
  // 打包后 resources/app.asar 或 app 目录旁
  const candidates = [
    path.join(process.resourcesPath, 'app', 'dist'),
    path.join(process.resourcesPath, 'dist'),
    path.join(app.getAppPath(), 'dist'),
    path.join(__dirname, '..', 'dist'),
  ]
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir
  }
  return path.join(__dirname, '..', 'dist')
}

async function startEmbeddedTts() {
  const serverPath = path.join(__dirname, '..', 'scripts', 'edge-tts-server.mjs')
  const mod = await import(pathToFileURL(serverPath).href)

  const cacheDir = path.join(app.getPath('userData'), 'tts-cache')
  const staticDir = isDev ? null : resolveDistDir()

  ttsHttpServer = await mod.startTtsServer({
    port: TTS_PORT,
    host: '127.0.0.1',
    cacheDir,
    staticDir,
    quiet: false,
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 560,
    title: '音标小助手',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    // 开发：Vite 页面 + 代理到 TTS
    const url = process.env.ELECTRON_START_URL || `http://127.0.0.1:${WEB_PORT}/`
    void mainWindow.loadURL(url)
    if (process.env.ELECTRON_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    // 生产：同源本地服务（静态 + /api/tts）
    void mainWindow.loadURL(`http://127.0.0.1:${TTS_PORT}/`)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

async function bootstrap() {
  // 单实例
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return
  }
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  await app.whenReady()

  try {
    await startEmbeddedTts()
  } catch (err) {
    console.error('[electron] TTS 启动失败', err)
    // 开发时仍可开窗（靠外部 tts）；生产则尽量继续
    if (!isDev) {
      // 再试一次不挂静态
      try {
        const serverPath = path.join(__dirname, '..', 'scripts', 'edge-tts-server.mjs')
        const mod = await import(pathToFileURL(serverPath).href)
        ttsHttpServer = await mod.startTtsServer({
          port: TTS_PORT,
          host: '127.0.0.1',
          cacheDir: path.join(app.getPath('userData'), 'tts-cache'),
        })
      } catch (e2) {
        console.error('[electron] TTS 二次启动失败', e2)
      }
    }
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (ttsHttpServer) {
    try {
      ttsHttpServer.close()
    } catch {
      /* ignore */
    }
    ttsHttpServer = null
  }
})

bootstrap().catch((err) => {
  console.error(err)
  app.quit()
})

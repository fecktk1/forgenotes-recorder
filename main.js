// ForgeNotes Recorder — Electron main process.
//
// Responsibilities (capture + auth live in the renderer; main is the trusted shell):
//  - create the window with a locked-down preload bridge
//  - answer getDisplayMedia() with SYSTEM LOOPBACK audio (Windows WASAPI loopback /
//    macOS loopback) so the renderer can record system/call audio as its own track
//  - persist the Supabase refresh token encrypted at rest (OS safeStorage)
//  - persist recordings locally so a network failure never loses a capture (offline queue)
const { app, BrowserWindow, ipcMain, shell, session, desktopCapturer, safeStorage } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')

// macOS system-audio-for-screenshare (harmless on Windows; needed for the Mac phase).
app.commandLine.appendSwitch('enable-features', 'MacLoopbackAudioForScreenShare')

const USER_DATA = () => app.getPath('userData')
const AUTH_FILE = () => path.join(USER_DATA(), 'auth.bin')
const REC_DIR = () => path.join(USER_DATA(), 'recordings')

let mainWindow = null

async function loadConfig() {
  // Priority: user config in userData (packaged installs) → repo config.json (dev) → example.
  const candidates = [
    path.join(USER_DATA(), 'config.json'),
    path.join(__dirname, 'config.json'),
    path.join(__dirname, 'config.example.json'),
  ]
  for (const file of candidates) {
    try {
      const raw = await fs.readFile(file, 'utf8')
      const cfg = JSON.parse(raw)
      if (cfg && cfg.supabaseUrl) return { ...cfg, _source: file }
    } catch {
      // try next
    }
  }
  return { supabaseUrl: '', supabaseAnonKey: '', forgenotesHost: '', _source: null }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 760,
    minWidth: 420,
    minHeight: 640,
    title: 'ForgeNotes Recorder',
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload needs require() for the IPC bridge
    },
  })

  mainWindow.setMenuBarVisibility(false)

  // System-audio loopback: when the renderer calls getDisplayMedia({audio:true}),
  // hand back a screen source for video (discarded) + the loopback audio stream.
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen'] })
        .then((sources) => {
          callback({ video: sources[0], audio: 'loopback' })
        })
        .catch(() => callback({}))
    },
    { useSystemPicker: false },
  )

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

// ---------- IPC: config ----------
ipcMain.handle('config:get', async () => {
  const cfg = await loadConfig()
  return {
    supabaseUrl: cfg.supabaseUrl || '',
    supabaseAnonKey: cfg.supabaseAnonKey || '',
    forgenotesHost: cfg.forgenotesHost || 'https://notes.thecontentforge.io',
  }
})

// ---------- IPC: encrypted token storage ----------
ipcMain.handle('secure:get', async () => {
  try {
    const buf = await fs.readFile(AUTH_FILE())
    if (!safeStorage.isEncryptionAvailable()) return buf.toString('utf8')
    return safeStorage.decryptString(buf)
  } catch {
    return null
  }
})

ipcMain.handle('secure:set', async (_e, token) => {
  if (!token) return false
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(String(token))
    : Buffer.from(String(token), 'utf8')
  await fs.mkdir(USER_DATA(), { recursive: true })
  await fs.writeFile(AUTH_FILE(), data)
  return true
})

ipcMain.handle('secure:clear', async () => {
  try {
    await fs.unlink(AUTH_FILE())
  } catch {
    // already gone
  }
  return true
})

// ---------- IPC: external links ----------
ipcMain.handle('open:external', async (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) await shell.openExternal(url)
  return true
})

// ---------- IPC: local recording fallback / offline queue ----------
function safeId(id) {
  return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '')
}

ipcMain.handle('rec:save', async (_e, { localId, meta, tracks }) => {
  const id = safeId(localId)
  if (!id) throw new Error('invalid_local_id')
  const dir = path.join(REC_DIR(), id)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta ?? {}, null, 2), 'utf8')
  for (const t of tracks || []) {
    if (!t || !t.track || !t.data) continue
    await fs.writeFile(path.join(dir, `${safeId(t.track)}.webm`), Buffer.from(t.data))
  }
  return true
})

ipcMain.handle('rec:list', async () => {
  const out = []
  let entries = []
  try {
    entries = await fs.readdir(REC_DIR(), { withFileTypes: true })
  } catch {
    return out
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue
    try {
      const meta = JSON.parse(await fs.readFile(path.join(REC_DIR(), ent.name, 'meta.json'), 'utf8'))
      out.push({ localId: ent.name, meta })
    } catch {
      // skip corrupt/partial dir
    }
  }
  // newest first
  out.sort((a, b) => String(b.meta?.createdAt || '').localeCompare(String(a.meta?.createdAt || '')))
  return out
})

ipcMain.handle('rec:read', async (_e, localId) => {
  const id = safeId(localId)
  const dir = path.join(REC_DIR(), id)
  const meta = JSON.parse(await fs.readFile(path.join(dir, 'meta.json'), 'utf8'))
  const tracks = []
  for (const track of meta.tracks || []) {
    try {
      const buf = await fs.readFile(path.join(dir, `${safeId(track)}.webm`))
      // Return a fresh ArrayBuffer slice so structured-clone sends bytes, not the Buffer pool.
      tracks.push({ track, data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) })
    } catch {
      // missing track file
    }
  }
  return { meta, tracks }
})

ipcMain.handle('rec:delete', async (_e, localId) => {
  const id = safeId(localId)
  if (!id) return false
  await fs.rm(path.join(REC_DIR(), id), { recursive: true, force: true })
  return true
})

// ---------- lifecycle ----------
app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

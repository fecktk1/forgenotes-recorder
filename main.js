// ForgeNotes Recorder — Electron main process.
//
// Responsibilities (capture + auth live in the renderer; main is the trusted shell):
//  - create the window with a locked-down, sandboxed preload bridge
//  - answer getDisplayMedia() with SYSTEM LOOPBACK audio (Windows WASAPI loopback /
//    macOS loopback) so the renderer can record system/call audio as its own track
//  - persist the Supabase refresh token encrypted at rest (OS safeStorage), or keep it in
//    memory only when encryption is unavailable (never plaintext on disk)
//  - persist recordings locally so a network failure never loses a capture (offline queue)
//  - refuse navigation/new windows away from the app's own page, and answer IPC only for it
//  - tell the renderer when the computer goes to sleep and wakes (the recording's clock
//    leaves the sleep out), and raise the "Still there?" question outside the window
const { app, BrowserWindow, ipcMain, shell, session, desktopCapturer, safeStorage, powerMonitor, Notification } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const { fileURLToPath } = require('node:url')
const { createTokenStore } = require('./token-store')

// Auto-update from GitHub Releases (packaged Windows only). Wrapped so a dev run or a
// missing module never crashes startup.
let autoUpdater = null
try {
  ;({ autoUpdater } = require('electron-updater'))
} catch {
  autoUpdater = null
}

// macOS system-audio-for-screenshare (harmless on Windows; needed for the Mac phase).
app.commandLine.appendSwitch('enable-features', 'MacLoopbackAudioForScreenShare')

const USER_DATA = () => app.getPath('userData')
const AUTH_FILE = () => path.join(USER_DATA(), 'auth.bin')
const REC_DIR = () => path.join(USER_DATA(), 'recordings')

let mainWindow = null

// ---------- shell hardening ----------
// The only page this app shows is its own renderer/index.html. A navigation or a new window
// to anything else is refused, and IPC is answered only when it comes from that page (top
// frame), so a page that somehow got the preload cannot reach the token or the recordings.
const APP_PAGE = path.join(__dirname, 'renderer', 'index.html')

function isAppPage(url) {
  try {
    const u = new URL(String(url || ''))
    if (u.protocol !== 'file:') return false
    const file = path.normalize(fileURLToPath(u)) // ignores ?query and #hash
    return process.platform === 'win32' ? file.toLowerCase() === APP_PAGE.toLowerCase() : file === APP_PAGE
  } catch {
    return false
  }
}

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (isAppPage(url)) return
    event.preventDefault()
    console.warn(`[forgenotes] blocked navigation to ${url}`)
  })
  contents.on('will-attach-webview', (event) => event.preventDefault())
  contents.setWindowOpenHandler(({ url }) => {
    // External links go through the open:external IPC (http/https only); the app never
    // opens windows of its own.
    console.warn(`[forgenotes] blocked new window for ${url}`)
    return { action: 'deny' }
  })
})

function handle(channel, listener) {
  ipcMain.handle(channel, (event, ...args) => {
    const frame = event.senderFrame
    if (!frame || frame.parent || !isAppPage(frame.url)) {
      console.warn(`[forgenotes] refused IPC ${channel} from ${frame ? frame.url : 'a destroyed frame'}`)
      throw new Error('ipc_sender_rejected')
    }
    return listener(event, ...args)
  })
}

async function loadConfig() {
  // A real user config (userData for packaged installs, repo config.json for dev) wins.
  // If it EXISTS but is malformed, surface that loudly instead of silently falling back to
  // the example — otherwise a typo (e.g. an unquoted anon key) just looks like "key not set".
  for (const file of [path.join(USER_DATA(), 'config.json'), path.join(__dirname, 'config.json')]) {
    let raw
    try {
      raw = await fs.readFile(file, 'utf8')
    } catch {
      continue // no config at this location
    }
    try {
      return { ...JSON.parse(raw), _source: file }
    } catch (e) {
      return {
        supabaseUrl: '',
        supabaseAnonKey: '',
        forgenotesHost: '',
        _source: file,
        _parseError: `${path.basename(file)} is not valid JSON (${e.message})`,
      }
    }
  }
  // No user config anywhere → committed example (URL/host defaults, empty key = "Setup needed").
  try {
    const example = JSON.parse(await fs.readFile(path.join(__dirname, 'config.example.json'), 'utf8'))
    return { ...example, _source: 'config.example.json' }
  } catch {
    return { supabaseUrl: '', supabaseAnonKey: '', forgenotesHost: '', _source: null }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 760,
    minWidth: 420,
    minHeight: 640,
    title: 'ForgeNotes Recorder',
    backgroundColor: '#09090b',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // The preload only uses contextBridge and ipcRenderer, which sandboxed preloads
      // provide; it needs no Node.js access (same as the macOS recorder).
      sandbox: true,
      // A recorder is mostly used minimized, behind the call. Chromium slows the timers of
      // a hidden page (down to one wake-up a minute after a few minutes), and the
      // recording's timers must keep time: segment rotation, the sleep heartbeat and the
      // stop-on-silence readings.
      backgroundThrottling: false,
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
          console.log(`[forgenotes:main] loopback request — ${sources.length} screen source(s)`)
          // Windows system-audio loopback needs a video source alongside audio:'loopback'.
          // If none enumerated, still try audio-only loopback rather than returning nothing.
          callback(sources.length ? { video: sources[0], audio: 'loopback' } : { audio: 'loopback' })
        })
        .catch((err) => {
          console.error('[forgenotes:main] desktopCapturer.getSources failed:', err)
          callback({ audio: 'loopback' })
        })
    },
    { useSystemPicker: false },
  )

  mainWindow.loadFile(APP_PAGE)
}

// ---------- IPC: config ----------
handle('config:get', async () => {
  const cfg = await loadConfig()
  return {
    supabaseUrl: cfg.supabaseUrl || '',
    supabaseAnonKey: cfg.supabaseAnonKey || '',
    forgenotesHost: cfg.forgenotesHost || 'https://notes.thecontentforge.io',
    version: app.getVersion(),
    _parseError: cfg._parseError || null,
  }
})

// ---------- IPC: recording-announcement voices ----------
// renderer/announce/voices.json lists the voice clips that ship with the app and names the
// default. The page's CSP only lets the renderer connect to https:, so it cannot fetch the
// file itself; main reads it (this also works from inside app.asar). null = no list, and
// the renderer then reports that the announcement could not be played.
handle('announce:voices', async () => {
  try {
    return JSON.parse(await fs.readFile(path.join(__dirname, 'renderer', 'announce', 'voices.json'), 'utf8'))
  } catch (e) {
    console.warn('[forgenotes] could not read the announcement voices:', (e && e.message) || e)
    return null
  }
})

// ---------- IPC: encrypted token storage ----------
// Encrypted on disk when safeStorage can encrypt; otherwise memory-only for this run (the
// reason is logged to the console and upload-log.txt). See token-store.js.
let tokenStore = null
const tokens = () =>
  tokenStore ||
  (tokenStore = createTokenStore({
    file: AUTH_FILE(),
    safeStorage,
    log: (line) => {
      console.warn(`[forgenotes] ${line}`)
      void appendLog(line)
    },
  }))

handle('secure:get', async () => {
  try {
    return await tokens().get()
  } catch {
    return null
  }
})

handle('secure:set', async (_e, token) => tokens().set(token))

handle('secure:clear', async () => tokens().clear())

// ---------- IPC: external links ----------
handle('open:external', async (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) await shell.openExternal(url)
  return true
})

// Free disk space on the recordings volume (preflight). statfs is Node 18.15+/Electron;
// returns null if unavailable so the renderer degrades gracefully (recording still works).
handle('disk:free', async () => {
  try {
    if (typeof fs.statfs !== 'function') return null
    const s = await fs.statfs(USER_DATA())
    return { freeBytes: s.bavail * s.bsize }
  } catch {
    return null
  }
})

// ---------- IPC: upload diagnostics log ----------
// Failed uploads used to leave only a transient status line; this keeps the real error
// (status, chunk, attempt) on disk at userData/upload-log.txt for support/debugging.
const LOG_FILE = () => path.join(USER_DATA(), 'upload-log.txt')
const LOG_MAX_BYTES = 512 * 1024

async function appendLog(line) {
  try {
    const file = LOG_FILE()
    try {
      const stat = await fs.stat(file)
      if (stat.size > LOG_MAX_BYTES) await fs.rename(file, `${file}.1`) // keep one rotation
    } catch {
      // no log yet
    }
    await fs.appendFile(file, `${new Date().toISOString()} ${String(line ?? '')}\n`, 'utf8')
  } catch {
    // diagnostics only — never fail the caller
  }
  return true
}

handle('log:append', async (_e, line) => appendLog(line))

// ---------- IPC: local recording fallback / offline queue ----------
const { recordingStore } = require('./recording-store')
const store = () => recordingStore(REC_DIR())
let recordings
const localStore = () => recordings || (recordings = store())
handle('rec:checkpoint', (_e, { localId, meta, segment }) => localStore().checkpoint(localId, meta, segment))
// details: { endedAt, stopReason }, filtered by recording-store's finishDetails.
handle('rec:finish', (_e, { localId, details } = {}) => localStore().finish(localId, details))
handle('rec:uploaded', (_e, { localId, sessionId }) => localStore().update(localId, { state: 'uploaded', sessionId }))
handle('rec:segment', (_e, { localId, segment }) => localStore().readSegment(localId, segment))
handle('rec:playback', (_e, localId) => localStore().playback(localId))
handle('rec:folder', async (_e, localId) => {
  const dir = localStore().directory(localId)
  if (!(await fs.stat(dir)).isDirectory()) throw new Error('recording_folder_missing')
  const error = await shell.openPath(dir)
  if (error) throw new Error(error)
})

function safeId(id) {
  if (!/^[a-zA-Z0-9_-]+$/.test(String(id || ''))) throw new Error('invalid_local_id')
  return id
}

handle('rec:save', async (_e, { localId, meta, segments }) => {
  const id = safeId(localId)
  if (!id) throw new Error('invalid_local_id')
  const dir = path.join(REC_DIR(), id)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta ?? {}, null, 2), 'utf8')
  for (const s of segments || []) {
    if (!s || !s.track || s.data == null) continue
    const name = `${safeId(s.track)}-${String(s.seq ?? 0).padStart(4, '0')}.webm`
    await fs.writeFile(path.join(dir, name), Buffer.from(s.data))
  }
  return true
})

handle('rec:list', async () => {
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
      out.push({ localId: ent.name, meta: { title: 'Interrupted recording — inspect saved files', state: 'damaged' } })
    }
  }
  // newest first
  out.sort((a, b) => String(b.meta?.createdAt || '').localeCompare(String(a.meta?.createdAt || '')))
  return out
})

handle('rec:read', async (_e, localId) => {
  const id = safeId(localId)
  const dir = path.join(REC_DIR(), id)
  const meta = JSON.parse(await fs.readFile(path.join(dir, 'meta.json'), 'utf8'))
  const segments = []
  for (const seg of meta.segments || []) {
    try {
      const name = `${safeId(seg.track)}-${String(seg.seq ?? 0).padStart(4, '0')}.webm`
      const buf = await fs.readFile(path.join(dir, name))
      // Fresh ArrayBuffer slice so structured-clone sends bytes, not the Buffer pool.
      segments.push({ track: seg.track, seq: seg.seq ?? 0, data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) })
    } catch {
      throw new Error('Recording is incomplete: a saved audio segment is missing.')
    }
  }
  return { meta, segments }
})

handle('rec:delete', async (_e, localId) => {
  const id = safeId(localId)
  if (!id) return false
  const target = localStore().directory(id)
  await fs.rm(target, { recursive: true, force: true })
  return true
})

// ---------- sleep and wake ----------
// Nothing is captured while the computer sleeps, but the wall clock keeps going. The
// renderer is told when the computer suspends and resumes, with the time each event fired
// here, so it can end the segment at suspend, start a new one at resume and keep the sleep
// out of the recording's clock (renderer/capture-clock.js). Logged for support as well.
function sendPower(state) {
  const at = Date.now()
  void appendLog(`power: ${state}`)
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('power:state', { state, at })
}

// ---------- "Still there?" ----------
// Stop on silence (renderer/silence.js) asks before it stops a recording, and the question
// has to be noticed by someone who is not looking at this window: the renderer chimes and
// changes the window title, and main adds a system notification and flashes the taskbar
// button (Windows) or bounces the Dock icon (macOS). Answering the notification is
// answering "Keep recording".
let silenceNotice = null // kept referenced so its click handler is not collected
let dockBounce = null

function clearSilenceAttention() {
  if (silenceNotice) {
    const note = silenceNotice
    silenceNotice = null
    try { note.close() } catch { /* already gone */ }
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.flashFrame(false) } catch { /* not supported */ }
  }
  if (dockBounce !== null && app.dock) {
    try { app.dock.cancelBounce(dockBounce) } catch { /* not supported */ }
  }
  dockBounce = null
}

handle('silence:ask', async (_e, { body } = {}) => {
  clearSilenceAttention()
  const text = typeof body === 'string' ? body.slice(0, 240) : ''
  try {
    if (Notification.isSupported()) {
      const note = new Notification({ title: 'Still there?', body: text, silent: true, timeoutType: 'never' })
      note.on('click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.show()
          mainWindow.focus()
          mainWindow.webContents.send('silence:keep')
        }
      })
      note.show()
      silenceNotice = note
    }
  } catch (e) {
    console.warn('[forgenotes] could not show the silence notification:', (e && e.message) || e)
  }
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFocused()) {
    try { mainWindow.flashFrame(true) } catch { /* not supported */ }
    if (app.dock) {
      try { dockBounce = app.dock.bounce('critical') } catch { dockBounce = null }
    }
  }
  return true
})

handle('silence:clear', async () => {
  clearSilenceAttention()
  return true
})

// ---------- lifecycle ----------
// Windows shows a notification only for an app with an Application User Model ID that
// matches its Start-menu shortcut; the installer creates that shortcut with the appId. A
// Store install has its identity from the package and needs none.
if (process.platform === 'win32' && !process.windowsStore) app.setAppUserModelId('io.thecontentforge.forgenotes.recorder')

app.whenReady().then(() => {
  createWindow()
  powerMonitor.on('suspend', () => sendPower('suspend'))
  powerMonitor.on('resume', () => sendPower('resume'))
  // Check GitHub Releases for a newer version, download it, and install on next quit.
  // Unsigned is fine on Windows: electron-updater verifies the download by sha512.
  // NOT in the Store build: a Store-installed app is updated by the Store, and an app that
  // tries to update itself out from under the Store fails certification.
  if (autoUpdater && app.isPackaged && !process.windowsStore) {
    autoUpdater.checkForUpdatesAndNotify().catch((e) => {
      console.warn('[forgenotes] update check failed:', (e && e.message) || e)
    })
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

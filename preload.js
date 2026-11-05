// Preload — exposes a narrow, safe bridge to the sandboxed renderer. The renderer
// never gets Node/fs/ipc directly; only these typed calls.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  getConfig: () => ipcRenderer.invoke('config:get'),

  // The shipped recording-announcement voices (renderer/announce/voices.json); null if unreadable.
  announceVoices: () => ipcRenderer.invoke('announce:voices'),

  // Auth token persistence (encrypted at rest via OS safeStorage in main).
  secureGet: () => ipcRenderer.invoke('secure:get'),
  secureSet: (token) => ipcRenderer.invoke('secure:set', token),
  secureClear: () => ipcRenderer.invoke('secure:clear'),

  openExternal: (url) => ipcRenderer.invoke('open:external', url),

  // Sign in with SSO. ssoStart opens the identity provider in the browser and resolves
  // { ok, message }; the outcome comes later on onSsoResult: { ok: true, session } or
  // { ok: false, message }. The PKCE verifier never reaches the page.
  ssoAvailable: () => ipcRenderer.invoke('sso:available'),
  ssoStart: (email) => ipcRenderer.invoke('sso:start', email),
  ssoCancel: () => ipcRenderer.invoke('sso:cancel'),
  onSsoResult: (cb) => {
    const handler = (_e, result) => cb(result)
    ipcRenderer.on('sso:result', handler)
    return () => ipcRenderer.removeListener('sso:result', handler)
  },

  // This install's opaque id for ForgeNotes (device-id.js in main); null when it cannot be kept.
  deviceId: () => ipcRenderer.invoke('device:id'),

  // Free disk space on the recordings volume (preflight); null if unavailable.
  diskFree: () => ipcRenderer.invoke('disk:free'),

  // Append a line to the upload diagnostics log (userData/upload-log.txt).
  appendLog: (line) => ipcRenderer.invoke('log:append', line),

  // The computer going to sleep and waking: { state: 'suspend' | 'resume', at: ms }.
  onPower: (cb) => {
    const handler = (_e, event) => cb(event)
    ipcRenderer.on('power:state', handler)
    return () => ipcRenderer.removeListener('power:state', handler)
  },

  // Stop on silence: raise and clear the "Still there?" notification; onSilenceKeep fires
  // when the person answers it.
  silenceAsk: (body) => ipcRenderer.invoke('silence:ask', { body }),
  silenceClear: () => ipcRenderer.invoke('silence:clear'),
  onSilenceKeep: (cb) => {
    const handler = () => cb()
    ipcRenderer.on('silence:keep', handler)
    return () => ipcRenderer.removeListener('silence:keep', handler)
  },

  // Local recording fallback / offline queue. Blobs cross IPC as ArrayBuffers.
  saveRecording: (localId, meta, segments) => ipcRenderer.invoke('rec:save', { localId, meta, segments }),
  checkpoint: (localId, meta, segment) => ipcRenderer.invoke('rec:checkpoint', { localId, meta, segment }),
  // details: { endedAt (ISO), stopReason }.
  finishRecording: (localId, details) => ipcRenderer.invoke('rec:finish', { localId, details }),
  markUploaded: (localId, sessionId) => ipcRenderer.invoke('rec:uploaded', { localId, sessionId }),
  readSegment: (localId, segment) => ipcRenderer.invoke('rec:segment', { localId, segment }),
  playback: (localId) => ipcRenderer.invoke('rec:playback', localId),
  openRecordingFolder: (localId) => ipcRenderer.invoke('rec:folder', localId),
  listPending: () => ipcRenderer.invoke('rec:list'),
  readRecording: (localId) => ipcRenderer.invoke('rec:read', localId),
  deleteRecording: (localId) => ipcRenderer.invoke('rec:delete', localId),
})

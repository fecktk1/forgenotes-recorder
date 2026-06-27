# ForgeNotes Recorder (desktop)

A tiny Electron app that records a meeting as **two separate tracks** — your microphone
(`mic`) and the system/call audio (`system`) — and uploads them straight into the ForgeNotes
pipeline (the same `create-session → upload-file → finalize-session` flow the web app uses).
Two clean tracks transcribe far better than one mixed track when people talk over each other.

> **Phase status:** Windows is the build/test target first; the macOS (BlackHole) capture path
> lands in the next phase. The code already enables the macOS loopback Chromium feature, so the
> renderer logic is shared — only packaging/device guidance differs.

## How audio capture works

- **Microphone** → `getUserMedia` on the selected input device.
- **System / call audio** → `getDisplayMedia({ audio: true })`, which the Electron main process
  answers with **system loopback audio** (`setDisplayMediaRequestHandler` → `audio: 'loopback'`).
  On Windows this is the WASAPI loopback of everything playing out of your default output — so
  whatever you hear on the call is captured. No virtual cable or native addon required.
- If system capture is blocked or returns no audio track, the app records **mic-only** and shows a
  visible warning (never a silent failure).

The video track that `getDisplayMedia` returns is stopped immediately — only audio is recorded.

## First-time setup (dev run)

1. Install [Node.js](https://nodejs.org) (18+).
2. From this folder:
   ```sh
   npm install
   ```
3. Create your config:
   ```sh
   copy config.example.json config.json   # Windows
   # cp config.example.json config.json   # macOS/Linux
   ```
   Then open `config.json` and paste the **public Supabase anon key** into `supabaseAnonKey`.
   It's the same key the web app ships — copy it from Netlify (`VITE_SUPABASE_ANON_KEY`) or from
   the web app's network requests. **Never** put the service-role key here. `config.json` is
   git-ignored.
4. Start it:
   ```sh
   npm start
   ```

## Using it

1. **Sign in** with your ForgeNotes account (the email must be on the ForgeNotes allowlist — e.g.
   `support@thecontentforge.io`). The session is stored encrypted on this device (OS safeStorage),
   so you stay signed in.
2. Enter a title, pick the **source** and **visibility**, choose your **microphone**, and leave
   **Capture system / call audio** checked.
3. **Start recording.** System audio is captured automatically — the app supplies the loopback
   source itself, so **no screen-picker dialog appears**. A red indicator + timer shows while
   recording. Pause/resume as needed. (If you ever record mic-only unexpectedly, the status line
   says so — that's the visible fallback, not a silent failure.)
4. **Stop & upload.** The recording is saved locally first, then uploaded. On success you get an
   **Open in ForgeNotes** link; the meeting transcribes/​summarizes automatically.

## Offline / failed uploads

Every recording is written to disk before upload (under the app's userData folder). If the upload
fails (offline, token expired, server hiccup), it appears under **Pending uploads** with **Retry**
and **Discard**. Nothing is lost on a network blip. A successful upload deletes the local copy.

## Building an installer

```sh
npm run dist:win     # Windows NSIS installer in release/
npm run dist:mac     # macOS .dmg (next phase; ad-hoc signed, identity: null)
```

For distribution to other machines, bundle a `config.json` (or have each user create one). Code
signing (Authenticode on Windows) is a later step — for now the installer is unsigned and intended
for internal use.

## Notes / limitations (v1)

- Each track uploads as a single complete `*.webm` (Opus) file (`seq: 0`), exactly like a web
  manual upload — the transcription worker handles `mic` + `system` per-track speaker labelling.
- Recording controls live in the app window; there's no global hotkey or tray recorder yet.
- macOS multi-track via **BlackHole 2ch** + ad-hoc packaging is the next phase.

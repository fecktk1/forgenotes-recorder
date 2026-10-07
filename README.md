# ForgeNotes Recorder (desktop)

A tiny Electron app with two recording setups: **Online call** records your microphone and
system/call audio as separate tracks; **In person / room** records one room microphone and asks
ForgeNotes to separate the speakers during transcription. Both use the same
`create-session → upload-file → finalize-session` flow as the web app.

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

1. Choose **Record locally** or sign in to your ForgeNotes account.
2. Select Online call or In person / room, choose your microphone, and check the input meters.
3. Start recording. With **Announce recording aloud** on (the default), the app plays a recorded voice saying “This meeting is being recorded.” once through your default audio output, right after capture starts. Pick the voice under the checkbox; **Preview** plays it. It is not injected into the call: remote participants only hear it if your speakers are on. Pause/resume when needed; resuming does not repeat it.
4. **Stop & save** keeps the recording on this device. Use **Play recording**, **Open folder**, or **Upload & transcribe** in the local library. Upload requires an authorized account. Automatic upload is opt-in.

Completed one-minute segments are checkpointed to disk during capture. Restarting after a crash exposes committed checkpoints; the current segment and any disk write still in flight can be lost. Successful upload retains the local copy until you choose Discard.

**Stop a recording by itself** is off unless you choose a time (Never, 5, 10 or 20 minutes). It is the
same setting as on the web: it is kept with your account and this app uses the last value it saw (signed
out, it is kept on this computer). When every captured track (microphone and call audio) has been quiet
for that long minus a minute, the app asks “Still there?” with a chime, a notification, a flashing taskbar
button and the window title, and stops a minute later if nobody chooses **Keep recording**. Nothing is
trimmed: the quiet part is kept and uploaded like the rest.

**Times.** A meeting's start and end are the recording's own (`started_at` / `ended_at`, kept in
`meta.json`), however late it is uploaded. Segment offsets and durations, and the length sent at
upload, count captured audio only: the recording's clock stops while paused and while the computer
sleeps. A sleep ends the current segment and waking starts a new one.

## Building an installer

```sh
npm run dist:win
```
Produces `release/ForgeNotes-Recorder-Setup.exe` — an NSIS installer branded with the
ForgeNotes icon (Start-menu shortcut + uninstaller, choose-install-dir).

For distribution to other machines, bundle a `config.json` (or have each user create one). Code
signing (Authenticode) is a later step — for now the installer is unsigned (SmartScreen may warn;
"More info → Run anyway"), intended for internal use. The **macOS** build lives in its own repo:
[forgenotes-recorder-mac](https://github.com/fecktk1/forgenotes-recorder-mac).

## Troubleshooting

**`Cannot create symbolic link … A required privilege is not held by the client`** during
`npm run dist:win` — electron-builder unpacks its `winCodeSign` tooling, which contains macOS
symlinks that Windows only lets you create with extra privilege. The app itself packages fine
(`release/win-unpacked/`); only the NSIS installer step needs this. Fix either way:
- Run `npm run dist:win` from an **Administrator** PowerShell, **or**
- Turn on **Developer Mode** (Settings → System → For developers → Developer Mode → On), then build normally.

## Recording and playback notes

- Long recordings upload as private one-minute WebM segments for reliability. ForgeNotes creates
  one normalized playback file after upload, so owners and shared-link viewers never see segments.
- In-person mode sends `room_single_mic`; the transcription worker diarizes that microphone rather
  than labeling every voice as the owner.
- Recording controls live in the app window; there's no global hotkey or tray recorder yet.
- Announcement voices: the clips are pre-rendered files in `renderer/announce/` (made with Kokoro-82M, Apache-2.0), listed in
  `renderer/announce/voices.json` together with the default voice. To change the voices, edit that file and
  add or remove the matching `<id>.mp3`; `npm run verify` checks the list against the files. No system
  speech voice is used.
- The macOS build is a separate app: [forgenotes-recorder-mac](https://github.com/fecktk1/forgenotes-recorder-mac).

## GitHub release workflow

The repository secret `FORGENOTES_SUPABASE_ANON_KEY` must contain only the public Supabase anon
JWT. Pushing a version tag (for example `v0.4.0`) builds the x64 installer on Windows, publishes
the installer plus SHA-256 checksum, and keeps the runtime service-role credential out of the app.

See [RELEASE.md](RELEASE.md) for Windows 1.0.0 builds, GitHub publication and Microsoft Store submission.

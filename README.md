# ForgeNotes Recorder (desktop)

A tiny Electron app with two recording setups: **Online call** records your microphone and
system/call audio as separate tracks; **In person / room** records one room microphone and asks
ForgeNotes to separate the speakers during transcription. Both use the same
`create-session â†’ upload-file â†’ finalize-session` flow as the web app.

## How audio capture works

- **Microphone** â†’ `getUserMedia` on the selected input device.
- **System / call audio** â†’ `getDisplayMedia({ audio: true })`, which the Electron main process
  answers with **system loopback audio** (`setDisplayMediaRequestHandler` â†’ `audio: 'loopback'`).
  On Windows this is the WASAPI loopback of everything playing out of your default output â€” so
  whatever you hear on the call is captured. No virtual cable or native addon required.
- If system capture is blocked or returns no audio track, the app records **mic-only** and shows a
  visible warning (never a silent failure).

The video track that `getDisplayMedia` returns is stopped immediately â€” only audio is recorded.

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
   It's the same key the web app ships â€” copy it from Netlify (`VITE_SUPABASE_ANON_KEY`) or from
   the web app's network requests. **Never** put the service-role key here. `config.json` is
   git-ignored.
4. Start it:
   ```sh
   npm start
   ```

## Using it

1. Choose **Record locally** or sign in to your ForgeNotes account.
2. Select Online call or In person / room, choose your microphone, and check the input meters.
3. Start recording. Pause/resume when needed.
4. **Stop & save** keeps the recording on this device. Use **Play recording**, **Open folder**, or **Upload & transcribe** in the local library. Upload requires an authorized account. Automatic upload is opt-in.

Completed one-minute segments are checkpointed to disk during capture. Restarting after a crash exposes committed checkpoints; the current segment and any disk write still in flight can be lost. Successful upload retains the local copy until you choose Discard.

## Building an installer

```sh
npm run dist:win
```
Produces `release/ForgeNotes-Recorder-Setup.exe` â€” an NSIS installer branded with the
ForgeNotes icon (Start-menu shortcut + uninstaller, choose-install-dir).

For distribution to other machines, bundle a `config.json` (or have each user create one). Code
signing (Authenticode) is a later step â€” for now the installer is unsigned (SmartScreen may warn;
"More info â†’ Run anyway"), intended for internal use. The **macOS** build lives in its own repo:
[forgenotes-recorder-mac](https://github.com/fecktk1/forgenotes-recorder-mac).

## Troubleshooting

**`Cannot create symbolic link â€¦ A required privilege is not held by the client`** during
`npm run dist:win` â€” electron-builder unpacks its `winCodeSign` tooling, which contains macOS
symlinks that Windows only lets you create with extra privilege. The app itself packages fine
(`release/win-unpacked/`); only the NSIS installer step needs this. Fix either way:
- Run `npm run dist:win` from an **Administrator** PowerShell, **or**
- Turn on **Developer Mode** (Settings â†’ System â†’ For developers â†’ Developer Mode â†’ On), then build normally.

## Recording and playback notes

- Long recordings upload as private one-minute WebM segments for reliability. ForgeNotes creates
  one normalized playback file after upload, so owners and shared-link viewers never see segments.
- In-person mode sends `room_single_mic`; the transcription worker diarizes that microphone rather
  than labeling every voice as the owner.
- Recording controls live in the app window; there's no global hotkey or tray recorder yet.
- The macOS build is a separate app: [forgenotes-recorder-mac](https://github.com/fecktk1/forgenotes-recorder-mac).

## GitHub release workflow

The repository secret `FORGENOTES_SUPABASE_ANON_KEY` must contain only the public Supabase anon
JWT. Pushing a version tag (for example `v0.4.0`) builds the x64 installer on Windows, publishes
the installer plus SHA-256 checksum, and keeps the runtime service-role credential out of the app.

See [RELEASE.md](RELEASE.md) for Windows 1.0.0 builds, GitHub publication and Microsoft Store submission.

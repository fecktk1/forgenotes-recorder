# October 2026 security release

Electron 44.6.0 updates the browser/media engine (Chromium 152, Node 24.18). The renderer now runs sandboxed; the window only shows the app's own page (navigation and new windows elsewhere are refused) and IPC is answered only for that page. The sign-in token is stored only when Windows can encrypt it (safeStorage/DPAPI); otherwise it is kept in memory for that run, the reason is written to `upload-log.txt`, and the user signs in again on the next launch. Plaintext tokens are never written, and one left by an older version is deleted.

Dependency audits must pass without exceptions. Native CI checks microphone encoding, separate synthesized system audio, room capture, pause/resume, and decoded output, plus recording recovery contracts, token storage, and the sandboxed shell (`npm run test:shell`). These are synthetic checks and do not validate physical devices or routing.

Manual workflow dispatch defaults to a draft release. Promote only after testing physical microphone and system audio separately and together, a long recording, pause/resume, sleep/wake, authentication (sign in, quit, relaunch: still signed in), upload and retry, playback of a saved recording, opening a meeting in the browser, and installation/update on the supported OS. Store APPX submission is a separate release step; do not replace a pending submission automatically.

Record the tested OS, device/routing, version, and results with the release before promotion. A draft's auto-update metadata is not served as the latest public release.

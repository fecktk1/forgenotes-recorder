# Windows recorder release and Store submission

This repository ships Windows only. macOS ships separately from `fecktk1/forgenotes-recorder-mac`.

## Version 1.1.0 (release candidate, not published)

Changes since v1.0.1:

- **Recording announcement** (#15). When a recording starts, the app plays a recorded voice saying "This meeting is being recorded." once through the default audio output. On by default; **Announce recording aloud** turns it off, and a voice picker with **Preview** sits under it. It plays through the speakers and is not injected into the call, so remote participants only hear it if the speakers are on. Resuming from pause does not repeat it. If the clip cannot play, a note says so and the recording continues.
- **Security hardening** (#17). The renderer runs sandboxed; the window only shows the app's own page (other navigation, new windows and webviews are refused) and IPC is answered only for that page. The sign-in token is written to disk only when Windows can encrypt it; otherwise it is kept in memory for that run and the user signs in again on the next launch. A plaintext token left by an older version is deleted.
- **Electron 43.6.0 to 44.6.0** (Chromium 152, Node 24.18) (#17).
- **Dependencies.** `npm audit --audit-level=low` reports 0 advisories. In the installed app this updates js-yaml (used by the updater) to 4.3.2; the rest are build tools.
- Release documentation: draft-first build handoff (2b1de43) and this section.

Upgrade note: users whose Windows profile cannot encrypt with DPAPI (rare) are signed out once after updating and must sign in on every launch. Everyone else stays signed in.

Notes for the GitHub release (paste-ready):

```
ForgeNotes Recorder 1.1.0 for Windows

- Recording announcement: when you start recording, the app says "This meeting is being recorded." through your speakers. Turn it off or pick another voice under "Announce recording aloud". People on a call only hear it if your speakers are on.
- Security: the app's window is sandboxed and only shows its own page, and your sign-in is stored on disk only when Windows can encrypt it.
- Electron 44.6.0 (Chromium 152).

Internal unsigned Windows build. Windows SmartScreen may require More info, then Run anyway.
```

Status: not tagged, not released, not submitted to the Store. Before promotion, run the full [SECURITY_RELEASE_QA.md](SECURITY_RELEASE_QA.md) hardware pass on the exact draft artifacts, including the announcement (heard through the speakers and present in the saved recording) and an update from an installed 1.0.1. Then record the delivery here as was done for 1.0.1 below.

## September 8, 2026 delivery

- [Windows v1.0.1](https://github.com/fecktk1/forgenotes-recorder/releases/tag/v1.0.1) is published from `b8673cd63f22ae48157f5ea854d04bd33f7a7730`. Its EXE, blockmap, checksum and `latest.yml` are public.
- Native workflow run `34260281736` passed. The maintainer confirmed successful physical capture, sleep/wake, upload/retry and install/update tests. Exact device/OS details were not recorded.
- Microsoft Store version **1.0.1.0** is submitted for product **9P45688V8XJJ**, submission **1152921505701837283**. Partner Center shows certification in progress and automatic publishing after approval. Do not submit this version again while certification is running.
- APPX SHA256: `86B4A0B9221AEF32A34ED34D0E71B177E8CC01EDD8F54EB5B13BD6B1895C67FD`.
- No WACK report was obtained; successful packaging is not a WACK pass. The direct NSIS installer remains unsigned. Store signing/publication is separate.

For users: install `ForgeNotes-Recorder-Setup.exe` from the release above, or wait for the Microsoft Store update if using the Store edition. GitHub installations use the GitHub updater; Store installations use Store updates. After Store certification, verify the Store-installed version and repeat capture/upload on that actual build.

## Prepare a future version

Start from a clean, current `main` in this repository. Make changes on a branch, bump `package.json` and `package-lock.json` together to a **new, unused version**, and merge after review. Never move an existing distributed tag or rebuild over v1.0.1.

Local checks and packaging, without publication:

```powershell
Set-Location 'C:\Users\feckt\Projects\forgenotes-recorder'
git fetch origin
git switch main
git pull --ff-only
npm.cmd ci
npm.cmd run verify
npm.cmd test
npm.cmd run test:media-runtime
npm.cmd run dist:win
npm.cmd run dist:store
```

The build reads the existing public anon configuration from ignored `config.json` or `FORGENOTES_SUPABASE_ANON_KEY`. Do not commit privileged keys. Packaging validates the app identity and version. If Windows rejects symbolic-link creation during packaging, use the existing authorized Developer Mode/elevated build setup.

## Build a draft through GitHub

Only run this after merging the new, unused package version:

```powershell
gh workflow run release-windows.yml --repo fecktk1/forgenotes-recorder --ref main -f draft=true
gh run list --repo fecktk1/forgenotes-recorder --workflow release-windows.yml --limit 5
# Replace RUN_ID with that run's ID:
gh run watch RUN_ID --repo fecktk1/forgenotes-recorder --exit-status
gh run download RUN_ID --repo fecktk1/forgenotes-recorder --name forgenotes-recorder-appx --dir release/store-submission
```

Manual dispatch defaults to a draft and creates `v<package.json version>` at the workflow commit. A tag push publishes immediately; do not use both triggers. Inspect a failed/partial run before retrying. Keep the release draft until [SECURITY_RELEASE_QA.md](SECURITY_RELEASE_QA.md) passes on the exact artifacts. Native CI cannot verify a physical microphone, Windows loopback or sleep/wake behavior.

Verify the draft has the EXE, EXE blockmap, EXE checksum and `latest.yml`. After acceptance, replace VERSION with the new package version:

```powershell
gh release edit vVERSION --repo fecktk1/forgenotes-recorder --draft=false --latest
gh release view vVERSION --repo fecktk1/forgenotes-recorder
```

The APPX belongs in Partner Center, not among the direct installer assets.

## Build a draft locally (when GitHub Actions cannot run)

The same steps as the workflow, on this machine, from the merged `main`. Use the public anon JWT (role `anon`) or the existing ignored `config.json`, never a service key. Save the paste-ready release notes as `release\notes.txt` first, and replace VERSION:

```powershell
Set-Location 'C:\Users\feckt\Projects\forgenotes-recorder'
git fetch origin
git switch main
git pull --ff-only
npm.cmd ci
npm.cmd audit --audit-level=low
npm.cmd run verify
npm.cmd test
npm.cmd run test:media-runtime
npm.cmd run test:shell
npm.cmd run dist:win
npm.cmd run dist:store
'release\ForgeNotes-Recorder-Setup.exe', 'release\ForgeNotes-Recorder-Setup.exe.blockmap', 'release\latest.yml' |
  ForEach-Object { if (-not (Test-Path $_)) { throw "Missing $_" } }
(Get-FileHash release\ForgeNotes-Recorder-Setup.exe -Algorithm SHA256).Hash.ToLower() + '  ForgeNotes-Recorder-Setup.exe' |
  Set-Content release\ForgeNotes-Recorder-Setup.exe.sha256 -Encoding ascii
gh release create vVERSION release\ForgeNotes-Recorder-Setup.exe release\ForgeNotes-Recorder-Setup.exe.blockmap release\latest.yml release\ForgeNotes-Recorder-Setup.exe.sha256 `
  --repo fecktk1/forgenotes-recorder --draft --target (git rev-parse HEAD) --title "vVERSION — internal Windows build" --notes-file release\notes.txt
```

A draft creates no tag and is not served to the updater. Publishing it with the `gh release edit` commands above creates the tag at `--target`. That tag matches the workflow's `v*` trigger; if Actions run then, the workflow's own `gh release create` fails because the release exists, and nothing is replaced.

## Submit a future Store update

1. Open [ForgeNotes in Partner Center](https://partner.microsoft.com/en-us/dashboard/products/9P45688V8XJJ/overview). Finish or resolve any existing certification before starting another update.
2. Start an update of this existing product. Upload the **APPX** from the successful run's `forgenotes-recorder-appx` artifact under Packages.
3. Verify the new four-part package version is higher, identity is `TheContentForge.ForgeNotes`, publisher is `CN=A84C1C04-6C8F-437D-9CBF-B6FF012AA829`, and architecture is x64. Wait for package validation.
4. Update version-specific release/certification notes, including local room recording without login, optional authenticated upload, microphone access and desktop loopback capture. Put any required reviewer credentials privately in Partner Center, never in Git or public release notes. Keep the runFullTrust explanation accurate.
5. Review each submission section, preserve intended pricing/markets, and submit for certification with the desired publishing timing.
6. Check the certification result. If accepted with automatic publication selected, Microsoft publishes it. If rejected, address the actual report and use an appropriate new build/version. After publication, test installation/update through Microsoft Store.

Reference: [Microsoft Store update submissions](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/publish-update-to-your-app-on-store) and [package requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements).

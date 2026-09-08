# Windows 1.0.0 release and Microsoft Store submission

This repository ships Windows only. macOS ships from `fecktk1/forgenotes-recorder-mac` as version 0.10.0. The source changes are on `codex/forgenotes-reliability-20260908`; merge the reviewed pull request into `main` before following the publication steps below.

## Build locally without publishing

Use Node.js 22 or 24 and PowerShell:

```powershell
Set-Location 'C:\Users\feckt\Projects\forgenotes-recorder'
git fetch origin
git switch codex/forgenotes-reliability-20260908
git pull --ff-only
npm.cmd ci
npm.cmd run verify
npm.cmd test
npm.cmd run dist:win
npm.cmd run dist:store
```

The build reads the public anon JWT from ignored `config.json` or `FORGENOTES_SUPABASE_ANON_KEY`. It rejects a missing or privileged key. Keep the existing configuration; never commit a service-role key. If packaging reports a symbolic-link privilege error, use Windows Developer Mode or run the build in an elevated PowerShell.

Artifacts under `release`:

| File | Destination |
|---|---|
| `ForgeNotes-Recorder-Setup.exe` | Direct Windows installation / GitHub release |
| `ForgeNotes-Recorder-Setup.exe.blockmap` | GitHub automatic-update support |
| `latest.yml` | GitHub automatic-update feed |
| `ForgeNotes-Recorder-Setup.appx` | Microsoft Partner Center, not a GitHub installer asset |

The Store manifest must read `1.0.0.0`, x64, identity `TheContentForge.ForgeNotes`, publisher `CN=A84C1C04-6C8F-437D-9CBF-B6FF012AA829`. The build now verifies these values. Check the existing Partner Center package version before submission: the update must be newer for the same supported devices. If the Store already has a higher version, bump package.json and package-lock.json together and rebuild; do not edit the packaged manifest manually.

## Native acceptance check

Install the EXE on a test Windows profile. Record in room mode without signing in, pause/resume, stop, play locally, and open the folder. Record an online call and verify both microphone and actual Windows loopback audio. Record longer than one minute, close/restart after a checkpoint, and verify recovered audio. Sign in with an authorized test account, upload, confirm the meeting finishes, and confirm the local recording remains. Auto-upload must be off unless selected. Run the Windows App Certification Kit against the Store package before submitting. The automated storage/browser tests do not cover physical devices, Store certification or authenticated production upload.

## Publish the direct-download release

The repository secret `FORGENOTES_SUPABASE_ANON_KEY` already exists; only its name was verified, not its value. In GitHub open **Actions → Build Windows internal release → Run workflow**, select merged `main`, and run it once. **Manual dispatch publishes v1.0.0**, including creating its tag. It is not a preview-only build. Alternatively push the matching `v1.0.0` tag once; do not use both methods.

After merge, the CLI equivalent is:

```powershell
gh workflow run release-windows.yml --repo fecktk1/forgenotes-recorder --ref main
gh run list --repo fecktk1/forgenotes-recorder --workflow release-windows.yml --limit 5
# Replace RUN_ID with the new run's numeric ID:
gh run watch RUN_ID --repo fecktk1/forgenotes-recorder --exit-status
gh run download RUN_ID --repo fecktk1/forgenotes-recorder --name forgenotes-recorder-appx --dir release/store-submission
gh release view v1.0.0 --repo fecktk1/forgenotes-recorder
```

The release must contain the EXE, blockmap, `latest.yml`, and EXE SHA-256 checksum. Existing non-Store installations use those update assets; Store installations use Microsoft Store updates. A published direct installer remains unsigned under the existing workflow. If a run fails, inspect it before retrying; do not delete or overwrite an already distributed version tag. Fix and use a new version when necessary.

## Submit the Microsoft Store update

1. Sign in to [Partner Center](https://partner.microsoft.com/dashboard) and open the existing ForgeNotes product.
2. Under Product release, choose **Start update** (or the equivalent update/new-submission action). Reuse the existing product identity.
3. Open **Packages** and upload `ForgeNotes-Recorder-Setup.appx` from the successful build or the `forgenotes-recorder-appx` workflow artifact. Do not upload the EXE into the APPX submission. Wait for validation and resolve any version, identity or capability errors.
4. Update the Store listing's release notes. Suggested text: “Record and play meetings locally without signing in. Upload for transcription when ready, or enable automatic upload. Completed recording segments are saved during capture for recovery after interruptions. Uploaded recordings remain on your device until deleted.”
5. In certification notes, describe local room recording without login. Provide a working reviewer account privately in Partner Center for the optional upload/transcription path; verify its access before submission. Never add reviewer credentials to release notes or public Git commits. Explain the microphone permission and online-call loopback test.
6. Review availability, listing, privacy details and publishing timing; save each changed section. Choose **Submit for certification** from the overview. Monitor the certification result and any reviewer feedback. GitHub publication alone does not submit to the Store.
7. Once published, install/update through the Store and repeat local capture and upload checks on the actual Store build.

Microsoft documents the [update submission flow](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/publish-update-to-your-app-on-store) and [package identity, signing and version requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements). APPX packages are re-signed by Microsoft after certification; this is separate from direct EXE signing.

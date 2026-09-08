# Windows recorder release and Store submission

This repository ships Windows only. macOS ships separately from `fecktk1/forgenotes-recorder-mac`.

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

## Submit a future Store update

1. Open [ForgeNotes in Partner Center](https://partner.microsoft.com/en-us/dashboard/products/9P45688V8XJJ/overview). Finish or resolve any existing certification before starting another update.
2. Start an update of this existing product. Upload the **APPX** from the successful run's `forgenotes-recorder-appx` artifact under Packages.
3. Verify the new four-part package version is higher, identity is `TheContentForge.ForgeNotes`, publisher is `CN=A84C1C04-6C8F-437D-9CBF-B6FF012AA829`, and architecture is x64. Wait for package validation.
4. Update version-specific release/certification notes, including local room recording without login, optional authenticated upload, microphone access and desktop loopback capture. Put any required reviewer credentials privately in Partner Center, never in Git or public release notes. Keep the runFullTrust explanation accurate.
5. Review each submission section, preserve intended pricing/markets, and submit for certification with the desired publishing timing.
6. Check the certification result. If accepted with automatic publication selected, Microsoft publishes it. If rejected, address the actual report and use an appropriate new build/version. After publication, test installation/update through Microsoft Store.

Reference: [Microsoft Store update submissions](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/publish-update-to-your-app-on-store) and [package requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements).

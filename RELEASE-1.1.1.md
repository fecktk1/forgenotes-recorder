# ForgeNotes Windows 1.1.1

Separate product analytics update. The previous published Windows release is 1.1.0.

## Release notes

- Adds an optional account-wide analytics setting to help improve ForgeNotes.
- When allowed, measures app opens, recording/upload results and feature outcomes.
- Meeting audio, transcripts, questions and raw error text are excluded from analytics.
- Turning the setting off stops new analytics capture and clears queued backend events.

The shared analytics service is deployed. No new OS permissions or PostHog credentials are added to the app. Shared ForgeNotes backend job analytics remain disabled during the pending iOS review; this Windows client update has its own explicit event contract.

## Artifacts and acceptance

Build the NSIS installer with `npm run dist:win` and the Microsoft Store package with `npm run dist:store`. Keep `latest.yml`, the installer blockmap and SHA-256 file together with the installer for a future GitHub release. A draft release is preparation only and must not be described as an update delivered to installed copies.

The analytics implementation passed 62 unit tests, static verification and Electron media/shell/capture tests. Runtime capture used synthetic silent audio in a temporary profile. Physical microphone/loopback acceptance and a signed-in production analytics journey are separate from those checks. The internal NSIS installer is unsigned; Microsoft signs the Store package after certification.

ForgeNotes iOS and its existing submission are unchanged. macOS work is deferred by the owner.

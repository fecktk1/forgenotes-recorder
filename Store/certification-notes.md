# Microsoft Store — Notes for certification

Paste-ready content for Partner Center → submission → **Notes for certification**.
Microsoft has no structured credentials field; testers read this text.

```
TEST ACCOUNT
Email: qa+forgenotes@thecontentforge.io
Password: TestPassword

WHAT THIS APP IS
ForgeNotes Recorder is the Windows capture client for ForgeNotes, a meeting
recording/transcription service. The app records meetings locally and uploads
them to the user's ForgeNotes account; transcripts and notes are then reviewed
on the web dashboard (https://notes.thecontentforge.io) — the desktop app is
deliberately capture-only.

HOW TO TEST
1. Launch the app and sign in with the test account above.
2. Choose "In person / room" mode (records the microphone only — no extra
   audio-device setup needed), allow microphone access when prompted.
3. Type any title, click "Start recording", speak for ~30 seconds, then
   "Stop & save". The recording is saved on the device; choose
   "Upload & transcribe" in the list below it. It uploads in segments; on
   success the app shows "Uploaded. ForgeNotes is transcribing it now."
   with an "Open in ForgeNotes" link.
4. Optional: the same test account signs into the web dashboard at
   https://notes.thecontentforge.io to see the account's processed meetings
   (two sample meetings with transcripts and notes are pre-loaded).

NOTES
- When a recording starts, the app says "This meeting is being recorded."
  once through the speakers (a bundled voice clip). "Announce recording
  aloud" turns it off. "Record locally without signing in" records without
  an account; uploading needs one.
- "Online call" mode captures a user-selected system-audio device in addition
  to the mic; if no such device exists on the test machine the app records
  mic-only and says so. "In person / room" mode is sufficient for testing.
- The Store build does not self-update (updates come from the Store); the
  GitHub-distributed build of the same app updates itself, which is why
  update code exists in the binary.
- The account is a standard user account on our production service; recordings
  made during testing are fine to leave behind.
- Privacy policy: https://notes.thecontentforge.io/privacy
```

The test account is the same one Apple's App Review uses (see the iOS repo's
AppStore/review-notes.md); it is allowlisted, unmetered, and pre-seeded with
two processed demo meetings. If its password ever rotates, both stores'
submission notes rotate with it.

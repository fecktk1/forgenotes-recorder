; Sign in with SSO returns to the app on forgenotes-recorder://sso-callback. electron-builder writes
; the scheme into the Store package manifest from "protocols", but its NSIS installer does not
; register it, so the installer does here (SHCTX: the current user, or the machine for an
; all-users install) and the uninstaller removes it. main.js also registers it at each start.
!macro customInstall
  WriteRegStr SHCTX "Software\Classes\forgenotes-recorder" "" "URL:ForgeNotes Recorder sign-in"
  WriteRegStr SHCTX "Software\Classes\forgenotes-recorder" "URL Protocol" ""
  WriteRegStr SHCTX "Software\Classes\forgenotes-recorder\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr SHCTX "Software\Classes\forgenotes-recorder\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey SHCTX "Software\Classes\forgenotes-recorder"
  DeleteRegKey HKCU "Software\Classes\forgenotes-recorder"
!macroend

!ifndef BUILD_UNINSTALLER
Var /GLOBAL promptikVenvBackup

!macro customInit
  ${if} ${isUpdated}
    SetSilent silent
  ${endif}

  StrCpy $promptikVenvBackup "$PLUGINSDIR\promptik-python-venv"

  ${if} ${FileExists} "$INSTDIR\python\.venv\Scripts\python.exe"
    DetailPrint "Preserving Promptik ML environment..."
    RMDir /r "$promptikVenvBackup"
    ClearErrors
    Rename "$INSTDIR\python\.venv" "$promptikVenvBackup"

    ${if} ${Errors}
      ClearErrors
      CreateDirectory "$promptikVenvBackup"
      nsExec::ExecToLog '"$SYSDIR\robocopy.exe" "$INSTDIR\python\.venv" "$promptikVenvBackup" /E /NFL /NDL /NJH /NJS /NC /NS /NP'
      Pop $0
      RMDir /r "$INSTDIR\python\.venv"
    ${endif}
  ${endif}
!macroend
!endif

!macro customInstall
  StrCpy $promptikVenvBackup "$PLUGINSDIR\promptik-python-venv"

  ${if} ${FileExists} "$promptikVenvBackup\Scripts\python.exe"
    DetailPrint "Restoring Promptik ML environment..."
    CreateDirectory "$INSTDIR\python"
    RMDir /r "$INSTDIR\python\.venv"
    ClearErrors
    Rename "$promptikVenvBackup" "$INSTDIR\python\.venv"

    ${if} ${Errors}
      ClearErrors
      nsExec::ExecToLog '"$SYSDIR\robocopy.exe" "$promptikVenvBackup" "$INSTDIR\python\.venv" /E /NFL /NDL /NJH /NJS /NC /NS /NP'
      Pop $0
      RMDir /r "$promptikVenvBackup"
    ${endif}
  ${endif}
!macroend

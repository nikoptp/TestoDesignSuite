!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "Sections.nsh"

!ifndef APP_VERSION
  !define APP_VERSION "1.0.0"
!endif

!define APP_NAME "Testo Design Suite"
!define APP_EXE "testo-design-suite.exe"
!define APP_ID "TestoDesignSuite"
!define APP_DIR_NAME "TestoDesignSuite"
!define SOURCE_DIR "..\..\out\testo-design-suite-win32-x64"
!define PROJECT_ICON_SOURCE "..\..\images\file-icons\file-icon-project.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "assets\mui-welcome.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "assets\mui-header.bmp"
!define MUI_HEADERIMAGE_RIGHT
!define MUI_ICON "..\..\images\icon.ico"
!define MUI_UNICON "..\..\images\icon.ico"
!define MUI_BGCOLOR "0B1018"
!define MUI_TEXTCOLOR "E8ECFF"
!define MUI_WELCOMEPAGE_TITLE "Welcome to the ${APP_NAME} Setup Wizard"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of ${APP_NAME}.$\r$\n$\r$\nSet your default project folder and select optional startup shortcuts."
!define MUI_FINISHPAGE_TITLE "Completing the ${APP_NAME} Setup Wizard"
!define MUI_FINISHPAGE_TEXT "Setup has finished installing ${APP_NAME} on your computer."

Name "${APP_NAME}"
OutFile "..\..\out\custom-installer\testo-design-suite-${APP_VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\${APP_DIR_NAME}"
InstallDirRegKey HKCU "Software\${APP_ID}" "InstallDir"
RequestExecutionLevel user
SetShellVarContext current
Unicode true
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUninstDetails show
Icon "..\..\images\icon.ico"
UninstallIcon "..\..\images\icon.ico"

Var ProjectDirControl
Var ProjectDirPath

!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
Page custom ProjectDirPageCreate ProjectDirPageLeave
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Core Application Files (required)" SecCore
  SectionIn RO
  SetOutPath "$INSTDIR"
  File /r "${SOURCE_DIR}\*.*"
  SetOutPath "$INSTDIR\assets"
  File "${PROJECT_ICON_SOURCE}"

  WriteRegStr HKCU "Software\${APP_ID}" "InstallDir" "$INSTDIR"
  Call WriteInstallConfig
  Call RegisterFileAssociations

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "UninstallString" '"$INSTDIR\Uninstall ${APP_NAME}.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "NoRepair" 1

  WriteUninstaller "$INSTDIR\Uninstall ${APP_NAME}.exe"
SectionEnd

Section "Desktop Shortcut" SecDesktop
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
SectionEnd

Section "Start Menu Shortcut" SecStartMenu
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
SectionEnd

Section "Run on Windows Startup" SecStartup
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_ID}" '"$INSTDIR\${APP_EXE}"'
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\${APP_NAME}"

  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_ID}"
  DeleteRegValue HKCU "Software\${APP_ID}" "InstallDir"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"
  Call un.UnregisterFileAssociations

  IfFileExists "$INSTDIR\${APP_EXE}" 0 done
  RMDir /r "$INSTDIR"
  done:
SectionEnd

Function .onInstSuccess
  IfSilent done
  Exec '"$INSTDIR\${APP_EXE}"'
  done:
FunctionEnd

Function ProjectDirPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${If} $ProjectDirPath == ""
    StrCpy $ProjectDirPath "$INSTDIR\Projects"
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "Choose where projects and workspace data are stored by default.$\r$\nYou can still save/open .prjt files anywhere."
  Pop $0
  ${NSD_CreateDirRequest} 0 30u 78% 14u "$ProjectDirPath"
  Pop $ProjectDirControl
  ${NSD_OnChange} $ProjectDirControl OnProjectDirChanged

  ${NSD_CreateBrowseButton} 82% 30u 18% 14u "Browse..."
  Pop $1
  ${NSD_OnClick} $1 OnBrowseProjectDir

  nsDialogs::Show
FunctionEnd

Function OnProjectDirChanged
  Pop $ProjectDirControl
  ${NSD_GetText} $ProjectDirControl $ProjectDirPath
FunctionEnd

Function OnBrowseProjectDir
  nsDialogs::SelectFolderDialog "Select default project folder" "$ProjectDirPath"
  Pop $0
  ${If} $0 != error
    StrCpy $ProjectDirPath $0
    ${NSD_SetText} $ProjectDirControl $ProjectDirPath
  ${EndIf}
FunctionEnd

Function ProjectDirPageLeave
  ${If} $ProjectDirPath == ""
    MessageBox MB_ICONEXCLAMATION|MB_OK "Please choose a default project folder."
    Abort
  ${EndIf}
FunctionEnd

Function JsonEscape
  Exch $0
  StrCpy $1 ""
  StrLen $2 $0
  StrCpy $3 0

  loop:
    IntCmp $3 $2 done
    StrCpy $4 $0 1 $3
    StrCmp $4 "\" is_backslash
    StrCmp $4 '"' is_quote
    StrCpy $1 "$1$4"
    Goto next_char

  is_backslash:
    StrCpy $1 "$1\\"
    Goto next_char

  is_quote:
    StrCpy $1 '$1\"'

  next_char:
    IntOp $3 $3 + 1
    Goto loop

  done:
  StrCpy $0 $1
  Exch $0
FunctionEnd

Function WriteInstallConfig
  CreateDirectory "$LOCALAPPDATA\testo-design-suite"
  CreateDirectory "$LOCALAPPDATA\testo-design-suite\data"

  Push $ProjectDirPath
  Call JsonEscape
  Pop $0

  FileOpen $1 "$LOCALAPPDATA\testo-design-suite\data\install-config.json" w
  FileWrite $1 "{$\r$\n"
  FileWrite $1 '  "workspaceRoot": "'
  FileWrite $1 "$0"
  FileWrite $1 '"$\r$\n'
  FileWrite $1 "}$\r$\n"
  FileClose $1
FunctionEnd

Function RegisterFileAssociations
  WriteRegStr HKCU "Software\Classes\.prjt" "" "Testo.Project.PRJT"
  WriteRegStr HKCU "Software\Classes\Testo.Project.PRJT" "" "Testo Project File"
  WriteRegStr HKCU "Software\Classes\Testo.Project.PRJT\DefaultIcon" "" "$INSTDIR\assets\file-icon-project.ico,0"
  WriteRegStr HKCU "Software\Classes\Testo.Project.PRJT\shell\open\command" "" '"$INSTDIR\${APP_EXE}" "%1"'

  WriteRegStr HKCU "Software\Classes\.testo" "" "Testo.Project.TESTO"
  WriteRegStr HKCU "Software\Classes\Testo.Project.TESTO" "" "Legacy Testo Project File"
  WriteRegStr HKCU "Software\Classes\Testo.Project.TESTO\DefaultIcon" "" "$INSTDIR\assets\file-icon-project.ico,0"
  WriteRegStr HKCU "Software\Classes\Testo.Project.TESTO\shell\open\command" "" '"$INSTDIR\${APP_EXE}" "%1"'

  System::Call 'shell32::SHChangeNotify(i, i, p, p) v (0x08000000, 0, 0, 0)'
FunctionEnd

Function un.UnregisterFileAssociations
  DeleteRegKey HKCU "Software\Classes\.prjt"
  DeleteRegKey HKCU "Software\Classes\.testo"
  DeleteRegKey HKCU "Software\Classes\Testo.Project.PRJT"
  DeleteRegKey HKCU "Software\Classes\Testo.Project.TESTO"
  System::Call 'shell32::SHChangeNotify(i, i, p, p) v (0x08000000, 0, 0, 0)'
FunctionEnd

LangString DESC_SecCore ${LANG_ENGLISH} "Install required app files and enforce .prjt file association."
LangString DESC_SecDesktop ${LANG_ENGLISH} "Add a desktop shortcut for quick access."
LangString DESC_SecStartMenu ${LANG_ENGLISH} "Create a Start Menu shortcut entry."
LangString DESC_SecStartup ${LANG_ENGLISH} "Launch ${APP_NAME} automatically when you sign in to Windows."

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecCore} $(DESC_SecCore)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} $(DESC_SecDesktop)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecStartMenu} $(DESC_SecStartMenu)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecStartup} $(DESC_SecStartup)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

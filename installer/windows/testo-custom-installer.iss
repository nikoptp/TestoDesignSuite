#define AppName "Testo Design Suite"
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#define AppPublisher "Testo Design Suite"
#define AppExeName "testo-design-suite.exe"
#define AppDirName "TestoDesignSuite"
#define AppId "TestoDesignSuite"
#define SourceDir "..\\..\\out\\testo-design-suite-win32-x64"

[Setup]
AppId={{#AppId}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\{#AppDirName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=..\..\out\custom-installer
OutputBaseFilename=testo-design-suite-custom-{#AppVersion}
SetupIconFile=..\..\images\icon.ico
UninstallDisplayIcon={app}\{#AppExeName}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
ChangesAssociations=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked
Name: "startup"; Description: "Run {#AppName} when Windows starts"; GroupDescription: "Runtime options:"; Flags: unchecked
Name: "associatefiles"; Description: "Associate .prjt and .testo files with {#AppName}"; GroupDescription: "File associations:"; Flags: checkedonce

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "..\..\images\file-icons\file-icon-project.ico"; DestDir: "{app}\assets"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "{#AppId}"; ValueData: """{app}\{#AppExeName}"""; Tasks: startup; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\.prjt"; ValueType: string; ValueData: "Testo.Project.PRJT"; Tasks: associatefiles; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\.testo"; ValueType: string; ValueData: "Testo.Project.TESTO"; Tasks: associatefiles; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\Testo.Project.PRJT"; ValueType: string; ValueData: "Testo Project File"; Tasks: associatefiles; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Testo.Project.PRJT\DefaultIcon"; ValueType: string; ValueData: "{app}\assets\file-icon-project.ico,0"; Tasks: associatefiles; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Testo.Project.PRJT\shell\open\command"; ValueType: string; ValueData: """{app}\{#AppExeName}"" ""%1"""; Tasks: associatefiles; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Testo.Project.TESTO"; ValueType: string; ValueData: "Legacy Testo Project File"; Tasks: associatefiles; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Testo.Project.TESTO\DefaultIcon"; ValueType: string; ValueData: "{app}\assets\file-icon-project.ico,0"; Tasks: associatefiles; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Testo.Project.TESTO\shell\open\command"; ValueType: string; ValueData: """{app}\{#AppExeName}"" ""%1"""; Tasks: associatefiles; Flags: uninsdeletekey

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Launch {#AppName}"; Flags: nowait postinstall skipifsilent

[Code]
var
  ProjectDirPage: TInputDirWizardPage;

function JsonEscape(const S: string): string;
var
  I: Integer;
  Ch: Char;
begin
  Result := '';
  for I := 1 to Length(S) do
  begin
    Ch := S[I];
    if Ch = '\' then
      Result := Result + '\\'
    else if Ch = '"' then
      Result := Result + '\"'
    else
      Result := Result + Ch;
  end;
end;

procedure InitializeWizard;
begin
  ProjectDirPage := CreateInputDirPage(
    wpSelectDir,
    'Default Project Folder',
    'Choose where projects and workspace data are stored by default',
    'You can still save/open .prjt files anywhere. This sets the default workspace root for local data and Save As defaults.',
    False,
    ''
  );
  ProjectDirPage.Add('');
  ProjectDirPage.Values[0] := ExpandConstant('{userdocs}\TestoDesignSuite\Projects');
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigPath: string;
  ConfigDir: string;
  Content: string;
begin
  if CurStep <> ssInstall then
    Exit;

  ConfigPath := ExpandConstant('{localappdata}\testo-design-suite\data\install-config.json');
  ConfigDir := ExtractFileDir(ConfigPath);
  if not DirExists(ConfigDir) then
    ForceDirectories(ConfigDir);

  Content :=
    '{' + #13#10 +
    '  "workspaceRoot": "' + JsonEscape(ProjectDirPage.Values[0]) + '"' + #13#10 +
    '}';
  SaveStringToFile(ConfigPath, Content, False);
end;

#ifndef ProductVersion
  #error ProductVersion is required
#endif
#ifndef ProductNumericVersion
  #error ProductNumericVersion is required
#endif
#ifndef TargetArch
  #error TargetArch is required
#endif
#ifndef PayloadDir
  #error PayloadDir is required
#endif
#ifndef OutputDir
  #error OutputDir is required
#endif
#ifndef PayloadChecks
  #error PayloadChecks is required
#endif

[Setup]
AppId=com.dpokluda.folio
AppName=Folio
AppVersion={#ProductVersion}
AppVerName=Folio {#ProductVersion}
AppPublisher=David Pokluda
AppPublisherURL=https://github.com/dpokluda/folio
DefaultDirName={localappdata}\Programs\Folio
DefaultGroupName=Folio
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
MinVersion=10.0
#if TargetArch == "x64"
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
#elif TargetArch == "arm64"
ArchitecturesAllowed=arm64
ArchitecturesInstallIn64BitMode=arm64
#else
  #error Unsupported TargetArch
#endif
VersionInfoVersion={#ProductNumericVersion}
OutputDir={#OutputDir}
OutputBaseFilename=Folio-{#ProductVersion}-windows-{#TargetArch}-setup
SetupIconFile=..\icons\icon.ico
UninstallDisplayIcon={app}\Folio.exe
Compression=lzma2
SolidCompression=yes
; Require normal app closure instead of session shutdown that can bypass an asynchronous save dialog.
CloseApplications=no
RestartApplications=no
ChangesAssociations=yes
SetupLogging=yes
WizardStyle=modern

[Files]
Source: "{#PayloadDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userprograms}\Folio"; Filename: "{app}\Folio.exe"; WorkingDir: "{app}"; AppUserModelID: "com.dpokluda.folio"

[Registry]
Root: HKCU; Subkey: "Software\Classes\Folio.Markdown"; ValueType: string; ValueData: "Markdown Document"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Folio.Markdown\DefaultIcon"; ValueType: string; ValueData: """{app}\resources\document.ico"""
Root: HKCU; Subkey: "Software\Classes\Folio.Markdown\shell\open\command"; ValueType: string; ValueData: """{app}\Folio.exe"" ""%1"""
Root: HKCU; Subkey: "Software\Classes\.md\OpenWithProgids"; ValueType: string; ValueName: "Folio.Markdown"; ValueData: ""; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\.markdown\OpenWithProgids"; ValueType: string; ValueName: "Folio.Markdown"; ValueData: ""; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\.mdown\OpenWithProgids"; ValueType: string; ValueName: "Folio.Markdown"; ValueData: ""; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\.mkd\OpenWithProgids"; ValueType: string; ValueName: "Folio.Markdown"; ValueData: ""; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\.mkdn\OpenWithProgids"; ValueType: string; ValueName: "Folio.Markdown"; ValueData: ""; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\com.dpokluda.folio\Capabilities"; ValueType: string; ValueName: "ApplicationName"; ValueData: "Folio"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\com.dpokluda.folio\Capabilities"; ValueType: string; ValueName: "ApplicationDescription"; ValueData: "Markdown viewer and editor"
Root: HKCU; Subkey: "Software\com.dpokluda.folio\Capabilities"; ValueType: string; ValueName: "ApplicationIcon"; ValueData: """{app}\Folio.exe"",0"
Root: HKCU; Subkey: "Software\com.dpokluda.folio\Capabilities\FileAssociations"; ValueType: string; ValueName: ".md"; ValueData: "Folio.Markdown"
Root: HKCU; Subkey: "Software\com.dpokluda.folio\Capabilities\FileAssociations"; ValueType: string; ValueName: ".markdown"; ValueData: "Folio.Markdown"
Root: HKCU; Subkey: "Software\com.dpokluda.folio\Capabilities\FileAssociations"; ValueType: string; ValueName: ".mdown"; ValueData: "Folio.Markdown"
Root: HKCU; Subkey: "Software\com.dpokluda.folio\Capabilities\FileAssociations"; ValueType: string; ValueName: ".mkd"; ValueData: "Folio.Markdown"
Root: HKCU; Subkey: "Software\com.dpokluda.folio\Capabilities\FileAssociations"; ValueType: string; ValueName: ".mkdn"; ValueData: "Folio.Markdown"
Root: HKCU; Subkey: "Software\RegisteredApplications"; ValueType: string; ValueName: "com.dpokluda.folio"; ValueData: "Software\com.dpokluda.folio\Capabilities"; Flags: uninsdeletevalue

[Run]
Filename: "{app}\Folio.exe"; Description: "Open Folio"; Flags: nowait postinstall skipifsilent

[Code]
var
  PayloadVerified: Boolean;

function InitializeSetup: Boolean;
var
  LegacyKey: String;
  LegacyInstalled: Boolean;
begin
  LegacyKey := 'Software\Microsoft\Windows\CurrentVersion\Uninstall\9f5ff8db-51b6-575b-9468-75de01a1e384';
  LegacyInstalled := RegKeyExists(HKCU32, LegacyKey) or RegKeyExists(HKLM32, LegacyKey);
  if IsWin64 then
    LegacyInstalled := LegacyInstalled or RegKeyExists(HKCU64, LegacyKey) or RegKeyExists(HKLM64, LegacyKey);
  Result := not LegacyInstalled;
  if not Result then
    SuppressibleMsgBox('An earlier NSIS-based Folio installation is present.' + #13#10 +
      'Close Folio and uninstall that copy in Windows Settings > Apps, then run this setup again.' + #13#10 +
      'Keep your documents and preferences. This setup will not remove the earlier installation automatically.',
      mbError, MB_OK, IDOK);
end;

procedure VerifyPayloadFile(RelativePath, ExpectedHash: String);
var
  FileName: String;
begin
  FileName := AddBackslash(ExpandConstant('{app}')) + RelativePath;
  if not FileExists(FileName) then
    RaiseException('Folio installation is incomplete: ' + RelativePath);
  if CompareText(GetSHA256OfFile(FileName), ExpectedHash) <> 0 then
    RaiseException('Folio installation could not replace or verify: ' + RelativePath);
end;

function OpenPayloadFile(FileName: String; DesiredAccess, ShareMode, SecurityAttributes,
  CreationDisposition, FlagsAndAttributes: LongWord; TemplateFile: THandle): THandle;
  external 'CreateFileW@kernel32.dll stdcall';

function ClosePayloadHandle(Handle: THandle): Integer;
  external 'CloseHandle@kernel32.dll stdcall';

function CanReplacePayloadFile(RelativePath: String): Boolean;
var
  FileName: String;
  Handle: THandle;
begin
  FileName := AddBackslash(ExpandConstant('{app}')) + RelativePath;
  if DirExists(FileName) then
  begin
    Result := False;
    Exit;
  end;
  if not FileExists(FileName) then
  begin
    Result := True;
    Exit;
  end;
  Handle := OpenPayloadFile(FileName, $C0000000, 0, 0, 3, $80, 0);
  Result := Handle <> $FFFFFFFF;
  if Result then
    if ClosePayloadHandle(Handle) = 0 then
      RaiseException('Could not close installation preflight handle: ' + RelativePath);
end;

#include PayloadChecks

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  LockedFile: String;
begin
  LockedFile := LockedPayloadFile;
  Result := '';
  if LockedFile <> '' then
    Result := 'Close Folio and any application using its installed files, then retry.' + #13#10 +
      'Make sure your current user can write the application folder.' + #13#10 +
      'The following file cannot be replaced: ' + LockedFile;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    { Ignoring a locked file must not turn a partial replacement into reported success. }
    VerifyInstalledPayload;
    PayloadVerified := True;
  end;
end;

function GetCustomSetupExitCode: Integer;
begin
  if PayloadVerified then
    Result := 0
  else
    Result := 1;
end;

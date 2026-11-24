# Creates a Desktop shortcut for utterance-clips on Windows.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/create-desktop-shortcut.ps1

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ElectronExe = Join-Path $RepoRoot "node_modules\electron\dist\electron.exe"
$IconPath = Join-Path $RepoRoot "assets\icon.ico"
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "utterance-clips.lnk"

if (-not (Test-Path $ElectronExe)) {
  Write-Host "electron.exe not found. Run npm install first:"
  Write-Host ("  cd `"{0}`"" -f $RepoRoot)
  Write-Host "  npm install"
  exit 1
}

$Wsh = New-Object -ComObject WScript.Shell
$Sc = $Wsh.CreateShortcut($ShortcutPath)
$Sc.TargetPath = $ElectronExe
$Sc.Arguments = ("`"{0}`"" -f $RepoRoot)
$Sc.WorkingDirectory = "$RepoRoot"
$Sc.WindowStyle = 1
$Sc.Description = "utterance-clips"
if (Test-Path $IconPath) {
  $Sc.IconLocation = ("{0},0" -f $IconPath)
}
$Sc.Save()

Write-Host "Desktop shortcut created:"
Write-Host ("  {0}" -f $ShortcutPath)
if (Test-Path $IconPath) {
  Write-Host ("Icon: {0}" -f $IconPath)
} else {
  Write-Host "Icon: Electron default"
}

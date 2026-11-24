# Creates a Desktop shortcut for utterance-clips on Windows.
# Run from the repo root, or: powershell -ExecutionPolicy Bypass -File scripts/create-desktop-shortcut.ps1

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ElectronExe = Join-Path $RepoRoot "node_modules\electron\dist\electron.exe"
$IconPath = Join-Path $RepoRoot "assets\icon.ico"
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "utterance-clips.lnk"

if (-not (Test-Path $ElectronExe)) {
  Write-Host "electron.exe が見つかりません。先にリポジトリで npm install を実行してください:"
  Write-Host "  cd `"$RepoRoot`""
  Write-Host "  npm install"
  exit 1
}

$Wsh = New-Object -ComObject WScript.Shell
$Sc = $Wsh.CreateShortcut($ShortcutPath)
$Sc.TargetPath = $ElectronExe
$Sc.Arguments = "`"$RepoRoot`""
$Sc.WorkingDirectory = "$RepoRoot"
$Sc.WindowStyle = 1
$Sc.Description = "utterance-clips - 発話クリップ"
if (Test-Path $IconPath) {
  $Sc.IconLocation = "$IconPath,0"
}
$Sc.Save()

Write-Host "デスクトップにショートカットを作成しました:"
Write-Host "  $ShortcutPath"
Write-Host "アイコン: $(if (Test-Path $IconPath) { $IconPath } else { 'Electron 既定' })"

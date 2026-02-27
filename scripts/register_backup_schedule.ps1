param(
  [string]$TaskName = "ARCHIVIA_DailyBackup",
  [string]$ScriptPath = "C:\\xampp\\htdocs\\ARCHIVA\\scripts\\backup_archivia.ps1",
  [string]$StartTime = "08:00",
  [int]$IntervalMinutes = 60,
  [int]$DurationHours = 9
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ScriptPath)) {
  throw "Backup script not found: $ScriptPath"
}

$durationText = "{0:D2}:00" -f $DurationHours
$taskCommand = "PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""

# Create or replace a daily task that starts at StartTime and repeats every IntervalMinutes.
& schtasks.exe /Create /F /TN $TaskName /TR $taskCommand /SC DAILY /ST $StartTime /RI $IntervalMinutes /DU $durationText | Out-Null

Write-Output "Scheduled task '$TaskName' registered for daily runs from $StartTime every $IntervalMinutes minutes for $DurationHours hours."

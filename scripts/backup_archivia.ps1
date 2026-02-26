param(
  [string]$MysqlDump = "C:\\xampp\\mysql\\bin\\mysqldump.exe",
  [string]$DbName = "archivia_db",
  [string]$User = "archivia_user",
  [string]$Password = "your_password",
  [string]$LocalDir = "C:\\ARCHIVIA_BACKUPS\\LOCAL",
  [string]$ExternalDir = "E:\\ARCHIVIA_BACKUPS",
  [string]$LogFile = "C:\\ARCHIVIA_BACKUPS\\backup_log.txt",
  [switch]$ZipWeekly
)

if (-not (Test-Path -LiteralPath $LocalDir)) {
  New-Item -ItemType Directory -Force -Path $LocalDir | Out-Null
}
if (-not (Test-Path -LiteralPath (Split-Path -Path $LogFile -Parent))) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Path $LogFile -Parent) | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $LocalDir ("archivia_backup_{0}.sql" -f $timestamp)

$passArg = ""
if ($Password -ne "") {
  $passArg = "-p$Password"
}

& $MysqlDump --routines --single-transaction --quick --skip-lock-tables -u $User $passArg $DbName |
  Out-File -FilePath $backupFile -Encoding utf8

if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $backupFile)) {
  Add-Content $LogFile ("{0} - Backup SUCCESS: {1}" -f (Get-Date), $backupFile)

  if (Test-Path -LiteralPath $ExternalDir) {
    Copy-Item -Path $backupFile -Destination $ExternalDir -Force
    Add-Content $LogFile ("{0} - External copy SUCCESS" -f (Get-Date))
  } else {
    Add-Content $LogFile ("{0} - WARNING: External HDD not detected" -f (Get-Date))
  }

  if ($ZipWeekly -and (Get-Date).DayOfWeek -eq 'Sunday') {
    $zipFile = "$backupFile.zip"
    Compress-Archive -Path $backupFile -DestinationPath $zipFile -Force
    if (Test-Path -LiteralPath $zipFile) {
      Add-Content $LogFile ("{0} - Weekly ZIP created: {1}" -f (Get-Date), $zipFile)
      if (Test-Path -LiteralPath $ExternalDir) {
        Copy-Item -Path $zipFile -Destination $ExternalDir -Force
        Add-Content $LogFile ("{0} - Weekly ZIP external copy SUCCESS" -f (Get-Date))
      }
    }
  }
} else {
  Add-Content $LogFile ("{0} - Backup FAILED" -f (Get-Date))
  Write-Error "Backup failed."
  exit 1
}

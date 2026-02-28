param(
  [string]$MysqlDump = "C:\\xampp\\mysql\\bin\\mysqldump.exe",
  [string]$DbName = "archivia_db",
  [string]$User = "root",
  [string]$Password = "",
  [string]$LocalDir = "C:\\ARCHIVIA_BACKUPS\\LOCAL",
  [string]$ExternalDir = "D:\\ARCHIVIA_BACKUPS",
  [string]$UploadsDir = "C:\\xampp\\htdocs\\ARCHIVA\\storage\\uploads",
  [string]$ExternalDriveLabel = "My Passport",
  [string]$LogFile = "C:\\ARCHIVIA_BACKUPS\\backup_log.txt",
  [int]$WindowStartHour = 8,
  [int]$WindowEndHour = 17,
  [switch]$ZipWeekly
)

function Write-BackupLog {
  param([string]$Message)
  Add-Content $LogFile ("{0} - {1}" -f (Get-Date), $Message)
}

function Test-ExternalBackupTarget {
  param(
    [string]$TargetDir,
    [string]$ExpectedLabel
  )

  $driveRoot = Split-Path -Path $TargetDir -Qualifier
  if ([string]::IsNullOrWhiteSpace($driveRoot)) {
    return @{ IsValid = $false; Reason = "External path has no drive qualifier: $TargetDir" }
  }

  if (-not (Test-Path -LiteralPath $driveRoot)) {
    return @{ IsValid = $false; Reason = "External drive not detected: $driveRoot" }
  }

  $driveLetter = $driveRoot.TrimEnd('\',':')
  $volume = Get-Volume -DriveLetter $driveLetter -ErrorAction SilentlyContinue
  if (-not $volume) {
    return @{ IsValid = $false; Reason = "Unable to read drive metadata for $driveRoot" }
  }
  if ($volume.FileSystemLabel -ne $ExpectedLabel) {
    return @{ IsValid = $false; Reason = "External drive label mismatch. Expected '$ExpectedLabel' but found '$($volume.FileSystemLabel)'" }
  }

  $bitLockerCmd = Get-Command -Name Get-BitLockerVolume -ErrorAction SilentlyContinue
  if (-not $bitLockerCmd) {
    return @{ IsValid = $false; Reason = "Get-BitLockerVolume is unavailable; cannot verify encryption state." }
  }

  $bitLocker = Get-BitLockerVolume -MountPoint $driveRoot -ErrorAction SilentlyContinue
  if (-not $bitLocker) {
    return @{ IsValid = $false; Reason = "BitLocker metadata unavailable for $driveRoot." }
  }

  if ($bitLocker.ProtectionStatus -ne 'On') {
    return @{ IsValid = $false; Reason = "BitLocker protection is not enabled on $driveRoot." }
  }

  if ($bitLocker.LockStatus -ne 'Unlocked') {
    return @{ IsValid = $false; Reason = "BitLocker drive is locked: $driveRoot." }
  }

  return @{ IsValid = $true; Reason = "External drive verified: $driveRoot ($ExpectedLabel)" }
}

function Is-WithinRunWindow {
  param(
    [int]$StartHour,
    [int]$EndHour
  )

  if ($StartHour -lt 0 -or $StartHour -gt 23 -or $EndHour -lt 0 -or $EndHour -gt 23) {
    return @{ IsValid = $false; Reason = "Invalid run window hours. Use 0-23." }
  }
  if ($StartHour -gt $EndHour) {
    return @{ IsValid = $false; Reason = "WindowStartHour cannot be greater than WindowEndHour." }
  }

  $nowHour = (Get-Date).Hour
  $within = ($nowHour -ge $StartHour -and $nowHour -le $EndHour)
  return @{
    IsValid = $true
    InWindow = $within
    Reason = "Current hour $nowHour outside allowed window ${StartHour}:00-${EndHour}:00."
  }
}

if (-not (Test-Path -LiteralPath $LocalDir)) {
  New-Item -ItemType Directory -Force -Path $LocalDir | Out-Null
}
if (-not (Test-Path -LiteralPath (Split-Path -Path $LogFile -Parent))) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Path $LogFile -Parent) | Out-Null
}

$windowCheck = Is-WithinRunWindow -StartHour $WindowStartHour -EndHour $WindowEndHour
if (-not $windowCheck.IsValid) {
  Write-BackupLog ("Backup window config FAILED: {0}" -f $windowCheck.Reason)
  Write-Error $windowCheck.Reason
  exit 1
}
if (-not $windowCheck.InWindow) {
  Write-BackupLog ("Backup skipped: {0}" -f $windowCheck.Reason)
  exit 0
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $LocalDir ("archivia_backup_{0}.sql" -f $timestamp)
$uploadsZip = Join-Path $LocalDir ("archivia_uploads_{0}.zip" -f $timestamp)

$passArg = ""
if ($Password -ne "") {
  $passArg = "-p$Password"
}

& $MysqlDump --routines --single-transaction --quick --skip-lock-tables -u $User $passArg $DbName |
  Out-File -FilePath $backupFile -Encoding utf8

if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $backupFile)) {
  if (-not (Test-Path -LiteralPath $UploadsDir)) {
    Write-BackupLog ("Uploads backup FAILED: directory not found: {0}" -f $UploadsDir)
    Write-Error "Uploads directory not found: $UploadsDir"
    exit 1
  }

  if (Test-Path -LiteralPath $uploadsZip) {
    Remove-Item -LiteralPath $uploadsZip -Force
  }
  Compress-Archive -Path $UploadsDir -DestinationPath $uploadsZip -Force
  if (-not (Test-Path -LiteralPath $uploadsZip)) {
    Write-BackupLog "Uploads archive FAILED"
    Write-Error "Uploads archive failed."
    exit 1
  }

  Write-BackupLog ("Backup SUCCESS: {0}" -f $backupFile)
  Write-BackupLog ("Uploads archive SUCCESS: {0}" -f $uploadsZip)

  $externalCheck = Test-ExternalBackupTarget -TargetDir $ExternalDir -ExpectedLabel $ExternalDriveLabel
  if (-not $externalCheck.IsValid) {
    Write-BackupLog ("External backup validation FAILED: {0}" -f $externalCheck.Reason)
    Write-Error $externalCheck.Reason
    exit 1
  }

  if (-not (Test-Path -LiteralPath $ExternalDir)) {
    New-Item -ItemType Directory -Force -Path $ExternalDir | Out-Null
  }

  Copy-Item -Path $backupFile -Destination $ExternalDir -Force
  Copy-Item -Path $uploadsZip -Destination $ExternalDir -Force
  Write-BackupLog "External copy SUCCESS"

  if ($ZipWeekly -and (Get-Date).DayOfWeek -eq 'Sunday') {
    $zipFile = "$backupFile.zip"
    Compress-Archive -Path $backupFile -DestinationPath $zipFile -Force
    if (Test-Path -LiteralPath $zipFile) {
      Write-BackupLog ("Weekly ZIP created: {0}" -f $zipFile)
      Copy-Item -Path $zipFile -Destination $ExternalDir -Force
      Write-BackupLog "Weekly ZIP external copy SUCCESS"
    }
  }
} else {
  Write-BackupLog "Backup FAILED"
  Write-Error "Backup failed."
  exit 1
}

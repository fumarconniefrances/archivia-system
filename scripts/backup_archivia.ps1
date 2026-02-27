param(
  [string]$MysqlDump = "C:\\xampp\\mysql\\bin\\mysqldump.exe",
  [string]$DbName = "archivia_db",
  [string]$User = "root",
  [string]$Password = "",
  [string]$LocalDir = "C:\\ARCHIVIA_BACKUPS\\LOCAL",
  [string]$ExternalDir = "D:\\ARCHIVIA_BACKUPS",
  [string]$ExternalDriveLabel = "My Passport",
  [string]$LogFile = "C:\\ARCHIVIA_BACKUPS\\backup_log.txt",
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
  Write-BackupLog ("Backup SUCCESS: {0}" -f $backupFile)

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

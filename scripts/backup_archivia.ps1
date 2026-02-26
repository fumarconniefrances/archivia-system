param(
  [string]$MysqlDump = "C:\\xampp\\mysql\\bin\\mysqldump.exe",
  [string]$DbName = "archivia_db",
  [string]$User = "root",
  [string]$Password = "",
  [string]$OutputDir = "C:\\ARCHIVIA_BACKUPS"
)

if (-not (Test-Path -LiteralPath $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$file = Join-Path $OutputDir ("archivia_backup_{0}.sql" -f $timestamp)

$passArg = ""
if ($Password -ne "") {
  $passArg = "-p$Password"
}

& $MysqlDump --routines --single-transaction --quick --skip-lock-tables -u $User $passArg $DbName |
  Out-File -FilePath $file -Encoding utf8

if (-not (Test-Path -LiteralPath $file)) {
  Write-Error "Backup failed."
  exit 1
}

Write-Output ("Backup created: {0}" -f $file)

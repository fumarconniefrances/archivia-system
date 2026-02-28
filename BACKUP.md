# ARCHIVIA Backup Procedure (Localhost + External HDD)

## Daily Backup Script

Use the PowerShell script:

`scripts/backup_archivia.ps1`

Default local output directory:
`C:\ARCHIVIA_BACKUPS\LOCAL\`

Default external output directory:
`E:\ARCHIVIA_BACKUPS\`

File format:
`archivia_backup_YYYYMMDD_HHMMSS.sql`

## Task Scheduler (Daily 6:30 PM)

1. Open Task Scheduler.
2. Create Task → Name: `ARCHIVIA_DAILY_BACKUP`
3. Trigger: Daily → 6:30 PM
4. Action: Start a program
   - Program/script: `powershell.exe`
   - Add arguments:
     `-NoProfile -ExecutionPolicy Bypass -File "C:\xampp\htdocs\ARCHIVA\scripts\backup_archivia.ps1"`
5. General:
   - Run whether user is logged in or not
   - Run with highest privileges
6. Settings: Allow task to be run on demand.

## Manual Backup Test

Run:
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\xampp\htdocs\ARCHIVA\scripts\backup_archivia.ps1"`

Confirm file created in `C:\ARCHIVIA_BACKUPS\LOCAL\`.

Check log:
`C:\ARCHIVIA_BACKUPS\backup_log.txt`

## Restore Validation

1. Restore:
   `C:\xampp\mysql\bin\mysql.exe -u archivia_user -p archivia_db < C:\ARCHIVIA_BACKUPS\LOCAL\archivia_backup_YYYYMMDD_HHMMSS.sql`
2. Validate row counts and critical tables.

## Weekly Compression (Optional)

Add `-ZipWeekly` when you want Sunday ZIP archives:

`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\xampp\htdocs\ARCHIVA\scripts\backup_archivia.ps1" -ZipWeekly`

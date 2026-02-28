# ARCHIVIA Backup Procedure (Localhost + External HDD)

## What Is Backed Up

Each run now creates two backups:

1. Database dump (`.sql`)
2. Upload storage archive (`.zip`) from `storage/uploads`

This is required because documents and profile pictures are stored as files in `storage/uploads`, while DB stores metadata/path references.

## Daily Backup Script

Use:

`scripts/backup_archivia.ps1`

Default local output:

`C:\ARCHIVIA_BACKUPS\LOCAL\`

Default external output:

`D:\ARCHIVIA_BACKUPS\`

Output files:

- `archivia_backup_YYYYMMDD_HHMMSS.sql`
- `archivia_uploads_YYYYMMDD_HHMMSS.zip`

## Task Scheduler (Daily 6:30 PM)

1. Open Task Scheduler.
2. Create Task -> Name: `ARCHIVIA_DAILY_BACKUP`
3. Trigger: Daily -> 6:30 PM
4. Action: Start a program
   - Program/script: `powershell.exe`
   - Add arguments:
     `-NoProfile -ExecutionPolicy Bypass -File "C:\xampp\htdocs\ARCHIVIA\scripts\backup_archivia.ps1"`
5. General:
   - Run whether user is logged in or not
   - Run with highest privileges
6. Settings:
   - Allow task to be run on demand.

## Manual Backup Test

Run:

`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\xampp\htdocs\ARCHIVIA\scripts\backup_archivia.ps1"`

Confirm both files exist in `C:\ARCHIVIA_BACKUPS\LOCAL\`.

Check log:

`C:\ARCHIVIA_BACKUPS\backup_log.txt`

## Restore Validation

1. Restore SQL dump:
   `C:\xampp\mysql\bin\mysql.exe -u archivia_user -p archivia_db < C:\ARCHIVIA_BACKUPS\LOCAL\archivia_backup_YYYYMMDD_HHMMSS.sql`
2. Restore uploads archive:
   Extract `archivia_uploads_YYYYMMDD_HHMMSS.zip` back to:
   `C:\xampp\htdocs\ARCHIVIA\storage\uploads\`
3. Validate row counts and sample file previews.

## Weekly Compression (Optional)

Use:

`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\xampp\htdocs\ARCHIVIA\scripts\backup_archivia.ps1" -ZipWeekly`

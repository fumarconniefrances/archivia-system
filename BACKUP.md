# ARCHIVIA Backup Procedure (Localhost)

## Daily Backup Script

Use the PowerShell script:

`scripts/backup_archivia.ps1`

Default output directory:
`C:\ARCHIVIA_BACKUPS\`

File format:
`archivia_backup_YYYYMMDD_HHMMSS.sql`

## Task Scheduler (Daily 6:30 PM)

1. Open Task Scheduler.
2. Create Task → Name: `ARCHIVIA Daily Backup`
3. Trigger: Daily → 6:30 PM
4. Action: Start a program
   - Program/script: `powershell.exe`
   - Add arguments:
     `-NoProfile -ExecutionPolicy Bypass -File "C:\xampp\htdocs\ARCHIVA\scripts\backup_archivia.ps1"`
5. Conditions: Uncheck “Start the task only if the computer is on AC power” if needed.
6. Settings: Allow task to be run on demand.

## Manual Backup Test

Run:
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\xampp\htdocs\ARCHIVA\scripts\backup_archivia.ps1"`

Confirm file created in `C:\ARCHIVIA_BACKUPS\`.

## Restore Test (Use Test DB)

1. Create test database: `archivia_db_test`
2. Restore:
   `C:\xampp\mysql\bin\mysql.exe -u root archivia_db_test < C:\ARCHIVIA_BACKUPS\archivia_backup_YYYYMMDD_HHMMSS.sql`
3. Validate row counts and critical tables.

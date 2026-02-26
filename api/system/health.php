<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../utils.php';

$dbOk = false;
$dbVersion = null;
$dbError = null;
try {
  $stmt = $pdo->query('SELECT VERSION() AS version');
  $dbVersion = $stmt->fetch()['version'] ?? null;
  $dbOk = true;
} catch (Exception $e) {
  $dbError = $e->getMessage();
}

$uploadDir = ARCHIVIA_UPLOAD_DIR;
$backupDir = ARCHIVIA_BACKUP_DIR;

$uploadWritable = is_dir($uploadDir) && is_writable($uploadDir);
$backupWritable = is_dir($backupDir) && is_writable($backupDir);

$healthy = $dbOk && $uploadWritable && $backupWritable;

json_response([
  'success' => true,
  'healthy' => $healthy,
  'checks' => [
    'db_connected' => $dbOk,
    'db_version' => $dbVersion,
    'db_error' => $dbError,
    'php_version' => PHP_VERSION,
    'upload_dir' => $uploadDir,
    'upload_writable' => $uploadWritable,
    'backup_dir' => $backupDir,
    'backup_writable' => $backupWritable
  ]
]);
?>

<?php
// PDO configuration for MariaDB.
$dbHost = getenv('ARCHIVIA_DB_HOST') ?: '127.0.0.1';
$dbName = getenv('ARCHIVIA_DB_NAME') ?: 'archivia_db';
$dbUser = getenv('ARCHIVIA_DB_USER') ?: 'root';
$dbPass = getenv('ARCHIVIA_DB_PASS') ?: '';
$backupDir = getenv('ARCHIVIA_BACKUP_DIR') ?: 'C:\\ARCHIVIA_BACKUPS';
$uploadDir = realpath(__DIR__ . '/../storage/uploads');

ini_set('display_errors', '0');
ini_set('log_errors', '1');

$dsn = "mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4";
$options = [
  PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  PDO::ATTR_EMULATE_PREPARES => false
];

try {
  $pdo = new PDO($dsn, $dbUser, $dbPass, $options);
} catch (PDOException $e) {
  http_response_code(500);
  header('Content-Type: application/json');
  echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
  exit;
}

define('ARCHIVIA_BACKUP_DIR', $backupDir);
define('ARCHIVIA_UPLOAD_DIR', $uploadDir ? $uploadDir : (__DIR__ . '/../storage/uploads'));
?>

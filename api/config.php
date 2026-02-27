<?php
// PDO configuration for MariaDB.
$dbHost = getenv('ARCHIVIA_DB_HOST') ?: '127.0.0.1';
$dbName = getenv('ARCHIVIA_DB_NAME') ?: 'archivia_db';
$dbUser = getenv('ARCHIVIA_DB_USER') ?: 'archivia_app';
$dbPass = getenv('ARCHIVIA_DB_PASS') ?: '';
$backupDir = getenv('ARCHIVIA_BACKUP_DIR') ?: 'C:\\ARCHIVIA_BACKUPS';
$uploadDir = realpath(__DIR__ . '/../storage/uploads');

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/../storage/logs/php_error.log');

function is_https_request() {
  if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') return true;
  if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string)$_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https') return true;
  if (!empty($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) return true;
  return false;
}

function apply_security_headers() {
  header("Content-Security-Policy: default-src 'self'; img-src 'self' data: https:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  header('X-Content-Type-Options: nosniff');
  header('X-Frame-Options: DENY');
  header('Referrer-Policy: no-referrer');
  header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
  if (is_https_request()) {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
  }
}

apply_security_headers();

set_exception_handler(function ($e) {
  error_log($e);
  http_response_code(500);
  header('Content-Type: application/json');
  echo json_encode(['success' => false, 'message' => 'Internal server error']);
  exit;
});

set_error_handler(function ($severity, $message, $file, $line) {
  if (!(error_reporting() & $severity)) {
    return false;
  }
  error_log(sprintf('PHP Error [%s]: %s in %s:%d', $severity, $message, $file, $line));
  http_response_code(500);
  header('Content-Type: application/json');
  echo json_encode(['success' => false, 'message' => 'Internal server error']);
  exit;
});

register_shutdown_function(function () {
  $error = error_get_last();
  if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
    error_log(sprintf('PHP Fatal Error [%s]: %s in %s:%d', $error['type'], $error['message'], $error['file'], $error['line']));
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Internal server error']);
    exit;
  }
});

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

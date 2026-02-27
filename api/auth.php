<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/middleware.php';

start_secure_session();

$action = $_GET['action'] ?? '';

function ensure_login_attempts_table($pdo) {
  $pdo->exec('
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
      login_key VARCHAR(190) NOT NULL,
      ip_address VARCHAR(45) NOT NULL,
      attempt_count INT(10) UNSIGNED NOT NULL DEFAULT 0,
      first_attempt_ts INT(10) UNSIGNED NOT NULL DEFAULT 0,
      last_attempt_ts INT(10) UNSIGNED NOT NULL DEFAULT 0,
      blocked_until_ts INT(10) UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY uq_login_attempts_key_ip (login_key, ip_address),
      KEY idx_login_attempts_last_attempt (last_attempt_ts),
      KEY idx_login_attempts_blocked_until (blocked_until_ts)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  ');
}

function client_ip_address() {
  return trim((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
}

function login_attempt_record($pdo, $loginKey, $ip) {
  $stmt = $pdo->prepare('SELECT * FROM login_attempts WHERE login_key = :login_key AND ip_address = :ip LIMIT 1');
  $stmt->execute([
    ':login_key' => $loginKey,
    ':ip' => $ip
  ]);
  return $stmt->fetch();
}

function login_is_blocked($record, $nowTs) {
  if (!$record) return false;
  return ((int)($record['blocked_until_ts'] ?? 0)) > $nowTs;
}

function register_login_failure($pdo, $loginKey, $ip, $windowSec = 900, $maxAttempts = 5, $blockSec = 900) {
  $now = time();
  $record = login_attempt_record($pdo, $loginKey, $ip);

  $attemptCount = 1;
  $firstTs = $now;
  if ($record && ($now - (int)$record['last_attempt_ts']) <= $windowSec) {
    $attemptCount = ((int)$record['attempt_count']) + 1;
    $firstTs = (int)$record['first_attempt_ts'];
  }

  $blockedUntil = $attemptCount >= $maxAttempts ? ($now + $blockSec) : 0;

  $stmt = $pdo->prepare('
    INSERT INTO login_attempts (login_key, ip_address, attempt_count, first_attempt_ts, last_attempt_ts, blocked_until_ts)
    VALUES (:login_key, :ip, :attempt_count, :first_ts, :last_ts, :blocked_until)
    ON DUPLICATE KEY UPDATE
      attempt_count = VALUES(attempt_count),
      first_attempt_ts = VALUES(first_attempt_ts),
      last_attempt_ts = VALUES(last_attempt_ts),
      blocked_until_ts = VALUES(blocked_until_ts)
  ');
  $stmt->execute([
    ':login_key' => $loginKey,
    ':ip' => $ip,
    ':attempt_count' => $attemptCount,
    ':first_ts' => $firstTs,
    ':last_ts' => $now,
    ':blocked_until' => $blockedUntil
  ]);
}

function clear_login_failures($pdo, $loginKey, $ip) {
  $stmt = $pdo->prepare('DELETE FROM login_attempts WHERE login_key = :login_key AND ip_address = :ip');
  $stmt->execute([
    ':login_key' => $loginKey,
    ':ip' => $ip
  ]);
}

if ($action === 'csrf' && $_SERVER['REQUEST_METHOD'] === 'GET') {
  json_response(['success' => true, 'data' => ['token' => get_csrf_token()]]);
}

function users_has_department_column($pdo) {
  static $hasDepartment = null;
  if ($hasDepartment !== null) {
    return $hasDepartment;
  }
  try {
    $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'department'");
    $hasDepartment = (bool)$stmt->fetch();
  } catch (Exception $e) {
    $hasDepartment = false;
  }
  return $hasDepartment;
}

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  verify_csrf_token();
  ensure_login_attempts_table($pdo);

  $data = get_json_input();
  $login = trim((string)($data['email'] ?? $data['login'] ?? ''));
  $password = $data['password'] ?? '';
  $ip = client_ip_address();
  $loginKey = strtolower($login);

  if ($login === '' || $password === '') {
    error_response('Login and password are required.', 422);
  }

  $attemptRecord = login_attempt_record($pdo, $loginKey, $ip);
  if (login_is_blocked($attemptRecord, time())) {
    error_response('Too many login attempts. Try again later.', 429);
  }

  $departmentSelect = users_has_department_column($pdo) ? 'department' : "'' AS department";
  $stmt = $pdo->prepare("
    SELECT id, name, email, password, role, status, {$departmentSelect}
    FROM users
    WHERE email = :login_email OR name = :login_name
    LIMIT 1
  ");
  $stmt->execute([
    ':login_email' => $login,
    ':login_name' => $login
  ]);
  $user = $stmt->fetch();
  if (!$user || $user['status'] !== 'ACTIVE' || !password_verify($password, $user['password'])) {
    register_login_failure($pdo, $loginKey, $ip);
    error_response('Invalid credentials.', 401);
  }
  if (!in_array($user['role'], ['ADMIN', 'RECORD_OFFICER'], true)) {
    register_login_failure($pdo, $loginKey, $ip);
    error_response('Invalid role.', 403);
  }

  clear_login_failures($pdo, $loginKey, $ip);
  session_regenerate_id(true);
  $_SESSION['user_id'] = (int)$user['id'];
  $_SESSION['role'] = $user['role'];
  $_SESSION['name'] = $user['name'];
  $_SESSION['last_activity'] = time();
  $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

  json_response([
    'success' => true,
    'data' => [
      'id' => (int)$user['id'],
      'name' => $user['name'],
      'email' => $user['email'],
      'role' => $user['role'],
      'department' => $user['department'] ?? ''
    ]
  ]);
}

if ($action === 'logout' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  verify_csrf_token();
  if (empty($_SESSION['user_id'])) {
    error_response('Unauthorized', 401);
  }
  $_SESSION = [];
  if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
  }
  session_destroy();
  json_response(['success' => true, 'data' => true]);
}

if ($action === 'me' && $_SERVER['REQUEST_METHOD'] === 'GET') {
  if (empty($_SESSION['user_id'])) {
    error_response('Unauthorized', 401);
  }
  $departmentSelect = users_has_department_column($pdo) ? 'department' : "'' AS department";
  $stmt = $pdo->prepare("SELECT id, name, email, role, {$departmentSelect} FROM users WHERE id = :id LIMIT 1");
  $stmt->execute([':id' => $_SESSION['user_id']]);
  $user = $stmt->fetch();
  if (!$user) error_response('Unauthorized', 401);
  json_response(['success' => true, 'data' => $user]);
}

error_response('Not found', 404);
?>

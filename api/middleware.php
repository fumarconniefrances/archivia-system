<?php
require_once __DIR__ . '/utils.php';

function session_timeout_seconds() {
  $raw = getenv('ARCHIVIA_SESSION_TIMEOUT');
  if ($raw === false || $raw === '') return 1800;
  $value = (int)$raw;
  return $value > 0 ? $value : 1800;
}

function start_secure_session() {
  if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    $isHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_set_cookie_params([
      'lifetime' => 0,
      'path' => '/',
      'secure' => $isHttps,
      'httponly' => true,
      'samesite' => 'Lax'
    ]);
    session_start();
  }

  $timeout = session_timeout_seconds();
  $now = time();
  $GLOBALS['archivia_session_timed_out'] = false;
  if (!empty($_SESSION['last_activity']) && ($now - (int)$_SESSION['last_activity']) > $timeout) {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
      $params = session_get_cookie_params();
      setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
    $GLOBALS['archivia_session_timed_out'] = true;
    return;
  }
  $_SESSION['last_activity'] = $now;
}

function get_csrf_token() {
  start_secure_session();
  if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
  }
  return $_SESSION['csrf_token'];
}

function get_request_csrf_token() {
  return trim((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
}

function verify_csrf_token() {
  start_secure_session();
  $sessionToken = (string)($_SESSION['csrf_token'] ?? '');
  $requestToken = get_request_csrf_token();
  if ($sessionToken === '' || $requestToken === '' || !hash_equals($sessionToken, $requestToken)) {
    error_response('Invalid CSRF token.', 403);
  }
}

function enforce_csrf_for_request($methods = null) {
  if ($methods === null) {
    $methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  }
  $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
  if (in_array($method, $methods, true)) {
    verify_csrf_token();
  }
}

function require_login() {
  start_secure_session();
  if (!empty($GLOBALS['archivia_session_timed_out'])) {
    error_response('Session expired.', 401);
  }
  if (empty($_SESSION['user_id'])) {
    error_response('Unauthorized', 401);
  }
}

function require_admin() {
  require_login();
  if (empty($_SESSION['role']) || $_SESSION['role'] !== 'ADMIN') {
    error_response('Forbidden', 403);
  }
}

function require_role($roles) {
  require_login();
  if (!is_array($roles)) {
    $roles = [$roles];
  }
  if (empty($_SESSION['role']) || !in_array($_SESSION['role'], $roles, true)) {
    error_response('Forbidden', 403);
  }
}

function require_record_officer() {
  require_role(['ADMIN', 'RECORD_OFFICER']);
}

function soft_delete_filter() {
  return 'deleted_at IS NULL';
}

function validate_input($rules, $data) {
  $errors = [];
  foreach ($rules as $field => $rule) {
    if ($rule === 'required' && (!isset($data[$field]) || trim((string)$data[$field]) === '')) {
      $errors[] = $field . ' is required';
    }
  }
  return $errors;
}
?>

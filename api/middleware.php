<?php
require_once __DIR__ . '/utils.php';

function start_secure_session() {
  if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.use_strict_mode', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.use_only_cookies', '1');
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
      ini_set('session.cookie_secure', '1');
    }
    session_start();
  }
}

function require_login() {
  start_secure_session();
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

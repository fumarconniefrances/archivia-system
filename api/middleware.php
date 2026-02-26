<?php
require_once __DIR__ . '/utils.php';

function require_login() {
  if (session_status() === PHP_SESSION_NONE) {
    session_start();
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

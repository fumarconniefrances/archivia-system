<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/middleware.php';

start_secure_session();

$action = $_GET['action'] ?? '';

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
  $data = get_json_input();
  $login = trim((string)($data['email'] ?? $data['login'] ?? ''));
  $password = $data['password'] ?? '';

  if ($login === '' || $password === '') {
    error_response('Login and password are required.', 422);
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
    error_response('Invalid credentials.', 401);
  }
  if (!in_array($user['role'], ['ADMIN', 'RECORD_OFFICER'], true)) {
    error_response('Invalid role.', 403);
  }

  session_regenerate_id(true);
  $_SESSION['user_id'] = (int)$user['id'];
  $_SESSION['role'] = $user['role'];
  $_SESSION['name'] = $user['name'];

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

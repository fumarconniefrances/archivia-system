<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/middleware.php';

if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  require_admin();
  $stmt = $pdo->prepare('SELECT id, name, email, role, department, created_at FROM users WHERE role = "TEACHER" AND status = "ACTIVE" ORDER BY name ASC');
  $stmt->execute();
  json_response(['success' => true, 'data' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
  require_admin();
  $data = get_json_input();
  $errors = validate_input([
    'name' => 'required',
    'email' => 'required',
    'password' => 'required'
  ], $data);
  if (!empty($errors)) error_response(implode(', ', $errors), 422);

  $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
  $stmt->execute([':email' => $data['email']]);
  if ($stmt->fetch()) error_response('Email already exists.', 409);

  $hash = password_hash($data['password'], PASSWORD_DEFAULT);
  $stmt = $pdo->prepare('
    INSERT INTO users (name, email, password, role, status, department)
    VALUES (:name, :email, :password, "TEACHER", "ACTIVE", :department)
  ');
  $stmt->execute([
    ':name' => $data['name'],
    ':email' => $data['email'],
    ':password' => $hash,
    ':department' => $data['department'] ?? null
  ]);

  $id = (int)$pdo->lastInsertId();
  log_action($pdo, $_SESSION['user_id'], 'create', 'USER', $id, null, $data);
  json_response(['success' => true, 'data' => ['id' => $id]], 201);
}

error_response('Method not allowed', 405);
?>

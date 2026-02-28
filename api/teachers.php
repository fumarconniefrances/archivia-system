<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/middleware.php';

start_secure_session();
enforce_csrf_for_request();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  require_record_officer();
  $stmt = $pdo->prepare('SELECT id, name, email, role, department, created_at FROM users WHERE role = "RECORD_OFFICER" AND status = "ACTIVE" ORDER BY name ASC');
  $stmt->execute();
  json_response(['success' => true, 'data' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
  require_admin();
  $data = get_json_input();
  $name = trim((string)($data['name'] ?? ''));
  $email = trim((string)($data['email'] ?? ''));
  $password = (string)($data['password'] ?? '');
  $department = isset($data['department']) ? trim((string)$data['department']) : null;
  $errors = [];
  if ($name === '') $errors['name'] = 'name is required';
  if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'valid email is required';
  if ($password === '') $errors['password'] = 'password is required';
  check_max_length('name', $name, 100, $errors);
  check_max_length('email', $email, 150, $errors);
  check_max_length('password', $password, 255, $errors);
  check_max_length('department', $department, 100, $errors);
  if (!empty($errors)) validation_error_response($errors);

  $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
  $stmt->execute([':email' => $email]);
  if ($stmt->fetch()) error_response('Email already exists.', 409);

  $hash = password_hash($data['password'], PASSWORD_DEFAULT);
  $stmt = $pdo->prepare('
    INSERT INTO users (name, email, password, role, status, department)
    VALUES (:name, :email, :password, "RECORD_OFFICER", "ACTIVE", :department)
  ');
  $stmt->execute([
    ':name' => $name,
    ':email' => $email,
    ':password' => $hash,
    ':department' => $department
  ]);

  $id = (int)$pdo->lastInsertId();
  log_action($pdo, $_SESSION['user_id'], 'create', 'USER', $id, null, [
    'name' => $name,
    'email' => $email,
    'role' => 'RECORD_OFFICER',
    'department' => $department
  ]);
  json_response(['success' => true, 'data' => ['id' => $id]], 201);
}

error_response('Method not allowed', 405);
?>

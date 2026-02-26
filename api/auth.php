<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';

if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

$action = $_GET['action'] ?? '';

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $data = get_json_input();
  $email = trim($data['email'] ?? '');
  $password = $data['password'] ?? '';

  if ($email === '' || $password === '') {
    error_response('Email and password are required.', 422);
  }

  $stmt = $pdo->prepare('SELECT id, name, email, password, role, status, department FROM users WHERE email = :email LIMIT 1');
  $stmt->execute([':email' => $email]);
  $user = $stmt->fetch();
  if (!$user || $user['status'] !== 'ACTIVE' || !password_verify($password, $user['password'])) {
    error_response('Invalid credentials.', 401);
  }

  $_SESSION['user_id'] = (int)$user['id'];
  $_SESSION['role'] = $user['role'];

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
  session_destroy();
  json_response(['success' => true, 'data' => true]);
}

if ($action === 'me' && $_SERVER['REQUEST_METHOD'] === 'GET') {
  if (empty($_SESSION['user_id'])) {
    error_response('Unauthorized', 401);
  }
  $stmt = $pdo->prepare('SELECT id, name, email, role, department FROM users WHERE id = :id LIMIT 1');
  $stmt->execute([':id' => $_SESSION['user_id']]);
  $user = $stmt->fetch();
  if (!$user) error_response('Unauthorized', 401);
  json_response(['success' => true, 'data' => $user]);
}

error_response('Not found', 404);
?>

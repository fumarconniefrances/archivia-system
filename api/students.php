<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/middleware.php';

if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  require_login();
  $params = [];
  $where = ['deleted_at IS NULL'];

  $q = trim($_GET['q'] ?? '');
  $sex = trim($_GET['sex'] ?? '');
  $sy = trim($_GET['sy'] ?? '');

  if ($q !== '') {
    $where[] = '(student_id LIKE :q OR first_name LIKE :q OR last_name LIKE :q)';
    $params[':q'] = '%' . $q . '%';
  }

  if ($sex !== '') {
    $where[] = 'sex = :sex';
    $params[':sex'] = $sex;
  }

  if ($sy !== '') {
    $start = 0;
    if (preg_match('/(\d{4})\s*-\s*\d{4}/', $sy, $m)) {
      $start = (int)$m[1];
    } elseif (preg_match('/\d{4}/', $sy, $m)) {
      $start = (int)$m[0];
    }
    if ($start >= 1988) {
      $where[] = '(batch_year = :sy OR batch_year = :sy2)';
      $params[':sy'] = $start;
      $params[':sy2'] = $start + 1;
    }
  }

  $sql = 'SELECT id, student_id, first_name, last_name, sex, batch_year, grade_level, section, created_at
          FROM students WHERE ' . implode(' AND ', $where) . ' ORDER BY last_name ASC, first_name ASC';
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $rows = $stmt->fetchAll();
  json_response(['success' => true, 'data' => $rows]);
}

if ($method === 'POST') {
  require_admin();
  $data = get_json_input();
  $errors = validate_input([
    'student_id' => 'required',
    'first_name' => 'required',
    'last_name' => 'required',
    'batch_year' => 'required',
    'sex' => 'required'
  ], $data);
  if (!empty($errors)) error_response(implode(', ', $errors), 422);

  $stmt = $pdo->prepare('SELECT id FROM students WHERE student_id = :student_id LIMIT 1');
  $stmt->execute([':student_id' => $data['student_id']]);
  if ($stmt->fetch()) error_response('LRN already exists.', 409);

  $stmt = $pdo->prepare('
    INSERT INTO students (student_id, first_name, last_name, sex, batch_year, grade_level, section)
    VALUES (:student_id, :first_name, :last_name, :sex, :batch_year, :grade_level, :section)
  ');
  $stmt->execute([
    ':student_id' => $data['student_id'],
    ':first_name' => $data['first_name'],
    ':last_name' => $data['last_name'],
    ':sex' => $data['sex'],
    ':batch_year' => (int)$data['batch_year'],
    ':grade_level' => $data['grade_level'] ?? null,
    ':section' => $data['section'] ?? null
  ]);
  $id = (int)$pdo->lastInsertId();
  log_action($pdo, $_SESSION['user_id'], 'create', 'STUDENT', $id, null, $data);
  json_response(['success' => true, 'data' => ['id' => $id]], 201);
}

if ($method === 'PUT') {
  require_admin();
  $data = get_json_input();
  $id = (int)($data['id'] ?? 0);
  if ($id <= 0) error_response('Invalid student id.', 422);

  $stmt = $pdo->prepare('SELECT * FROM students WHERE id = :id AND deleted_at IS NULL LIMIT 1');
  $stmt->execute([':id' => $id]);
  $existing = $stmt->fetch();
  if (!$existing) error_response('Student not found.', 404);

  $errors = validate_input([
    'student_id' => 'required',
    'first_name' => 'required',
    'last_name' => 'required',
    'batch_year' => 'required',
    'sex' => 'required'
  ], $data);
  if (!empty($errors)) error_response(implode(', ', $errors), 422);

  $stmt = $pdo->prepare('
    UPDATE students
    SET student_id = :student_id,
        first_name = :first_name,
        last_name = :last_name,
        sex = :sex,
        batch_year = :batch_year,
        grade_level = :grade_level,
        section = :section
    WHERE id = :id
  ');
  $stmt->execute([
    ':student_id' => $data['student_id'],
    ':first_name' => $data['first_name'],
    ':last_name' => $data['last_name'],
    ':sex' => $data['sex'],
    ':batch_year' => (int)$data['batch_year'],
    ':grade_level' => $data['grade_level'] ?? null,
    ':section' => $data['section'] ?? null,
    ':id' => $id
  ]);
  log_action($pdo, $_SESSION['user_id'], 'update', 'STUDENT', $id, $existing, $data);
  json_response(['success' => true, 'data' => ['id' => $id]]);
}

if ($method === 'DELETE') {
  require_admin();
  $id = (int)($_GET['id'] ?? 0);
  if ($id <= 0) error_response('Invalid student id.', 422);

  $stmt = $pdo->prepare('SELECT * FROM students WHERE id = :id AND deleted_at IS NULL LIMIT 1');
  $stmt->execute([':id' => $id]);
  $existing = $stmt->fetch();
  if (!$existing) error_response('Student not found.', 404);

  $stmt = $pdo->prepare('UPDATE students SET deleted_at = NOW() WHERE id = :id');
  $stmt->execute([':id' => $id]);
  log_action($pdo, $_SESSION['user_id'], 'delete', 'STUDENT', $id, $existing, null);
  json_response(['success' => true, 'data' => true]);
}

error_response('Method not allowed', 405);
?>

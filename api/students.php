<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/middleware.php';

if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  require_record_officer();
  $params = [];
  $where = ['deleted_at IS NULL'];

  $q = trim($_GET['q'] ?? '');
  $sex = strtoupper(trim($_GET['sex'] ?? ''));
  $sy = trim($_GET['sy'] ?? '');

  if ($q !== '') {
    $where[] = '(student_id LIKE :q OR first_name LIKE :q OR last_name LIKE :q)';
    $params[':q'] = '%' . $q . '%';
  }

  if ($sex !== '' && in_array($sex, ['MALE', 'FEMALE'], true)) {
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

  [$page, $limit, $offset] = get_pagination_params(50, 200);
  $countSql = 'SELECT COUNT(*) AS total FROM students WHERE ' . implode(' AND ', $where);
  $countStmt = $pdo->prepare($countSql);
  $countStmt->execute($params);
  $total = (int)($countStmt->fetch()['total'] ?? 0);

  $sql = 'SELECT id, student_id, first_name, last_name, sex, batch_year, grade_level, section, created_at
          FROM students WHERE ' . implode(' AND ', $where) . ' ORDER BY last_name ASC, first_name ASC
          LIMIT :limit OFFSET :offset';
  $stmt = $pdo->prepare($sql);
  foreach ($params as $k => $v) {
    $stmt->bindValue($k, $v);
  }
  $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
  $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
  $stmt->execute();
  $rows = $stmt->fetchAll();
  json_response(['success' => true, 'data' => $rows, 'page' => $page, 'limit' => $limit, 'total' => $total]);
}

if ($method === 'POST') {
  require_record_officer();
  $data = get_json_input();
  $studentId = trim((string)($data['student_id'] ?? ''));
  $firstName = trim((string)($data['first_name'] ?? ''));
  $lastName = trim((string)($data['last_name'] ?? ''));
  $sex = strtoupper(trim((string)($data['sex'] ?? '')));
  $batchYearRaw = $data['batch_year'] ?? null;
  $batchYear = filter_var($batchYearRaw, FILTER_VALIDATE_INT);

  $errors = [];
  if ($studentId === '') $errors['student_id'] = 'student_id is required';
  if ($firstName === '') $errors['first_name'] = 'first_name is required';
  if ($lastName === '') $errors['last_name'] = 'last_name is required';
  if (!in_array($sex, ['MALE', 'FEMALE'], true)) $errors['sex'] = 'sex must be MALE or FEMALE';
  if ($batchYear === false) $errors['batch_year'] = 'batch_year must be an integer';
  if (!empty($errors)) validation_error_response($errors);

  $pdo->beginTransaction();
  try {
    $stmt = $pdo->prepare('SELECT id FROM students WHERE student_id = :student_id LIMIT 1');
    $stmt->execute([':student_id' => $studentId]);
    if ($stmt->fetch()) {
      $pdo->rollBack();
      error_response('student_id already exists.', 409);
    }

    $stmt = $pdo->prepare('
      INSERT INTO students (student_id, first_name, last_name, sex, batch_year, grade_level, section)
      VALUES (:student_id, :first_name, :last_name, :sex, :batch_year, :grade_level, :section)
    ');
    $stmt->execute([
      ':student_id' => $studentId,
      ':first_name' => $firstName,
      ':last_name' => $lastName,
      ':sex' => $sex,
      ':batch_year' => (int)$batchYear,
      ':grade_level' => isset($data['grade_level']) ? trim((string)$data['grade_level']) : null,
      ':section' => isset($data['section']) ? trim((string)$data['section']) : null
    ]);
    $id = (int)$pdo->lastInsertId();
    log_action($pdo, $_SESSION['user_id'], 'create', 'STUDENT', $id, null, [
      'student_id' => $studentId,
      'first_name' => $firstName,
      'last_name' => $lastName,
      'sex' => $sex,
      'batch_year' => (int)$batchYear,
      'grade_level' => isset($data['grade_level']) ? trim((string)$data['grade_level']) : null,
      'section' => isset($data['section']) ? trim((string)$data['section']) : null
    ]);
    $pdo->commit();
    json_response(['success' => true, 'data' => ['id' => $id]], 201);
  } catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_response('Student create failed.', 500);
  }
}

if ($method === 'PUT') {
  require_record_officer();
  $data = get_json_input();
  $id = (int)($data['id'] ?? 0);
  if ($id <= 0) error_response('Invalid student id.', 422);

  $studentId = trim((string)($data['student_id'] ?? ''));
  $firstName = trim((string)($data['first_name'] ?? ''));
  $lastName = trim((string)($data['last_name'] ?? ''));
  $sex = strtoupper(trim((string)($data['sex'] ?? '')));
  $batchYearRaw = $data['batch_year'] ?? null;
  $batchYear = filter_var($batchYearRaw, FILTER_VALIDATE_INT);

  $errors = [];
  if ($studentId === '') $errors['student_id'] = 'student_id is required';
  if ($firstName === '') $errors['first_name'] = 'first_name is required';
  if ($lastName === '') $errors['last_name'] = 'last_name is required';
  if (!in_array($sex, ['MALE', 'FEMALE'], true)) $errors['sex'] = 'sex must be MALE or FEMALE';
  if ($batchYear === false) $errors['batch_year'] = 'batch_year must be an integer';
  if (!empty($errors)) validation_error_response($errors);

  $pdo->beginTransaction();
  try {
    $stmt = $pdo->prepare('SELECT * FROM students WHERE id = :id AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([':id' => $id]);
    $existing = $stmt->fetch();
    if (!$existing) {
      $pdo->rollBack();
      error_response('Student not found.', 404);
    }

    $stmt = $pdo->prepare('SELECT id FROM students WHERE student_id = :student_id AND id != :id LIMIT 1');
    $stmt->execute([':student_id' => $studentId, ':id' => $id]);
    if ($stmt->fetch()) {
      $pdo->rollBack();
      error_response('student_id already exists.', 409);
    }

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
      ':student_id' => $studentId,
      ':first_name' => $firstName,
      ':last_name' => $lastName,
      ':sex' => $sex,
      ':batch_year' => (int)$batchYear,
      ':grade_level' => isset($data['grade_level']) ? trim((string)$data['grade_level']) : null,
      ':section' => isset($data['section']) ? trim((string)$data['section']) : null,
      ':id' => $id
    ]);
    log_action($pdo, $_SESSION['user_id'], 'update', 'STUDENT', $id, $existing, [
      'student_id' => $studentId,
      'first_name' => $firstName,
      'last_name' => $lastName,
      'sex' => $sex,
      'batch_year' => (int)$batchYear,
      'grade_level' => isset($data['grade_level']) ? trim((string)$data['grade_level']) : null,
      'section' => isset($data['section']) ? trim((string)$data['section']) : null
    ]);
    $pdo->commit();
    json_response(['success' => true, 'data' => ['id' => $id]]);
  } catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_response('Student update failed.', 500);
  }
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

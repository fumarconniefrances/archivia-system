<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/middleware.php';

start_secure_session();
enforce_csrf_for_request();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  require_record_officer();
  try {
    $params = [];
    $where = ['deleted_at IS NULL'];

    $q = trim($_GET['q'] ?? '');
    $sex = strtoupper(trim($_GET['sex'] ?? ''));
    $sy = trim($_GET['sy'] ?? '');

    if ($q !== '') {
      $where[] = '(first_name LIKE ? OR last_name LIKE ? OR student_id LIKE ?)';
      $qLike = '%' . $q . '%';
      $params[] = $qLike;
      $params[] = $qLike;
      $params[] = $qLike;
    }

    if ($sex !== '' && in_array($sex, ['MALE', 'FEMALE'], true)) {
      $where[] = 'sex = ?';
      $params[] = $sex;
    }

    if ($sy !== '') {
      $start = 0;
      if (preg_match('/(\d{4})\s*-\s*\d{4}/', $sy, $m)) {
        $start = (int)$m[1];
      } elseif (preg_match('/\d{4}/', $sy, $m)) {
        $start = (int)$m[0];
      }
      if ($start >= 1988) {
        $where[] = '(batch_year = ? OR batch_year = ?)';
        $params[] = $start;
        $params[] = $start + 1;
      }
    }

    [$page, $limit, $offset] = get_pagination_params(50, 200);
    $countSql = 'SELECT COUNT(*) AS total FROM students WHERE ' . implode(' AND ', $where);
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $i => $value) {
      $countStmt->bindValue($i + 1, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $countStmt->execute();
    $total = (int)($countStmt->fetch()['total'] ?? 0);

    $sql = 'SELECT id, student_id, first_name, last_name, sex, batch_year, grade_level, section, adviser_name, created_at
            FROM students WHERE ' . implode(' AND ', $where) . ' ORDER BY last_name ASC, first_name ASC
            LIMIT ? OFFSET ?';
    $stmt = $pdo->prepare($sql);
    $bindIndex = 1;
    foreach ($params as $value) {
      $stmt->bindValue($bindIndex, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
      $bindIndex += 1;
    }
    $stmt->bindValue($bindIndex, (int)$limit, PDO::PARAM_INT);
    $stmt->bindValue($bindIndex + 1, (int)$offset, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll();
    json_response(['success' => true, 'data' => $rows, 'page' => $page, 'limit' => $limit, 'total' => $total]);
  } catch (Exception $e) {
    error_log($e);
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
      'success' => false,
      'message' => 'Search operation failed.'
    ]);
    exit;
  }
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
  $adviserName = trim((string)($data['adviser_name'] ?? ''));

  $errors = [];
  if ($studentId === '') $errors['student_id'] = 'student_id is required';
  if ($firstName === '') $errors['first_name'] = 'first_name is required';
  if ($lastName === '') $errors['last_name'] = 'last_name is required';
  if (!in_array($sex, ['MALE', 'FEMALE'], true)) $errors['sex'] = 'sex must be MALE or FEMALE';
  if ($batchYear === false) $errors['batch_year'] = 'batch_year must be an integer';
  check_max_length('student_id', $studentId, 50, $errors);
  check_max_length('first_name', $firstName, 100, $errors);
  check_max_length('last_name', $lastName, 100, $errors);
  check_max_length('grade_level', isset($data['grade_level']) ? trim((string)$data['grade_level']) : null, 50, $errors);
  check_max_length('section', isset($data['section']) ? trim((string)$data['section']) : null, 50, $errors);
  check_max_length('adviser_name', $adviserName !== '' ? $adviserName : null, 100, $errors);
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
      INSERT INTO students (student_id, first_name, last_name, sex, batch_year, grade_level, section, adviser_name)
      VALUES (:student_id, :first_name, :last_name, :sex, :batch_year, :grade_level, :section, :adviser_name)
    ');
    $stmt->execute([
      ':student_id' => $studentId,
      ':first_name' => $firstName,
      ':last_name' => $lastName,
      ':sex' => $sex,
      ':batch_year' => (int)$batchYear,
      ':grade_level' => isset($data['grade_level']) ? trim((string)$data['grade_level']) : null,
      ':section' => isset($data['section']) ? trim((string)$data['section']) : null,
      ':adviser_name' => $adviserName !== '' ? $adviserName : null
    ]);
    $id = (int)$pdo->lastInsertId();

    log_action($pdo, $_SESSION['user_id'], 'create', 'STUDENT', $id, null, [
      'student_id' => $studentId,
      'first_name' => $firstName,
      'last_name' => $lastName,
      'sex' => $sex,
      'batch_year' => (int)$batchYear,
      'grade_level' => isset($data['grade_level']) ? trim((string)$data['grade_level']) : null,
      'section' => isset($data['section']) ? trim((string)$data['section']) : null,
      'adviser_name' => $adviserName !== '' ? $adviserName : null
    ]);
    $pdo->commit();
    json_response(['success' => true, 'data' => ['id' => $id]], 201);
  } catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log($e);
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
  $adviserName = trim((string)($data['adviser_name'] ?? ''));

  $errors = [];
  if ($studentId === '') $errors['student_id'] = 'student_id is required';
  if ($firstName === '') $errors['first_name'] = 'first_name is required';
  if ($lastName === '') $errors['last_name'] = 'last_name is required';
  if (!in_array($sex, ['MALE', 'FEMALE'], true)) $errors['sex'] = 'sex must be MALE or FEMALE';
  if ($batchYear === false) $errors['batch_year'] = 'batch_year must be an integer';
  check_max_length('student_id', $studentId, 50, $errors);
  check_max_length('first_name', $firstName, 100, $errors);
  check_max_length('last_name', $lastName, 100, $errors);
  check_max_length('grade_level', isset($data['grade_level']) ? trim((string)$data['grade_level']) : null, 50, $errors);
  check_max_length('section', isset($data['section']) ? trim((string)$data['section']) : null, 50, $errors);
  check_max_length('adviser_name', $adviserName !== '' ? $adviserName : null, 100, $errors);
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
          section = :section,
          adviser_name = :adviser_name
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
      ':adviser_name' => $adviserName !== '' ? $adviserName : null,
      ':id' => $id
    ]);

    log_action($pdo, $_SESSION['user_id'], 'update', 'STUDENT', $id, $existing, [
      'student_id' => $studentId,
      'first_name' => $firstName,
      'last_name' => $lastName,
      'sex' => $sex,
      'batch_year' => (int)$batchYear,
      'grade_level' => isset($data['grade_level']) ? trim((string)$data['grade_level']) : null,
      'section' => isset($data['section']) ? trim((string)$data['section']) : null,
      'adviser_name' => $adviserName !== '' ? $adviserName : null
    ]);
    $pdo->commit();
    json_response(['success' => true, 'data' => ['id' => $id]]);
  } catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log($e);
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

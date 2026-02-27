<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/middleware.php';

start_secure_session();
enforce_csrf_for_request();

function normalize_photo_data($value) {
  if ($value === null) return null;
  $text = trim((string)$value);
  if ($text === '') return null;
  if (strpos($text, 'data:image/') !== 0) {
    error_response('photo_data must be a data:image value.', 422);
  }
  if (strlen($text) > 2 * 1024 * 1024) {
    error_response('photo_data is too large.', 422);
  }
  return $text;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  require_role(['ADMIN', 'RECORD_OFFICER']);
  $stmt = $pdo->prepare('
    SELECT id, name, position_title, photo_data, sort_order, created_at, updated_at
    FROM organization_chart_members
    WHERE is_active = 1
    ORDER BY sort_order ASC, id ASC
  ');
  $stmt->execute();
  json_response(['success' => true, 'data' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
  require_admin();
  $data = get_json_input();
  $name = trim((string)($data['name'] ?? ''));
  $position = trim((string)($data['position_title'] ?? ''));
  $sortOrder = isset($data['sort_order']) ? (int)$data['sort_order'] : 0;
  $photoData = normalize_photo_data($data['photo_data'] ?? null);

  $errors = [];
  if ($name === '') $errors['name'] = 'name is required';
  if ($position === '') $errors['position_title'] = 'position_title is required';
  check_max_length('name', $name, 120, $errors);
  check_max_length('position_title', $position, 120, $errors);
  if (!empty($errors)) validation_error_response($errors);

  $stmt = $pdo->prepare('
    INSERT INTO organization_chart_members (name, position_title, photo_data, sort_order, created_by)
    VALUES (:name, :position_title, :photo_data, :sort_order, :created_by)
  ');
  $stmt->execute([
    ':name' => $name,
    ':position_title' => $position,
    ':photo_data' => $photoData,
    ':sort_order' => $sortOrder,
    ':created_by' => $_SESSION['user_id']
  ]);
  $id = (int)$pdo->lastInsertId();
  log_action($pdo, $_SESSION['user_id'], 'create', 'ORGANIZATION_CHART', $id, null, [
    'name' => $name,
    'position_title' => $position
  ]);
  json_response(['success' => true, 'data' => ['id' => $id]], 201);
}

if ($method === 'PUT') {
  require_admin();
  $data = get_json_input();
  $id = (int)($data['id'] ?? 0);
  if ($id <= 0) error_response('Invalid member id.', 422);

  $name = trim((string)($data['name'] ?? ''));
  $position = trim((string)($data['position_title'] ?? ''));
  $sortOrder = isset($data['sort_order']) ? (int)$data['sort_order'] : 0;
  $photoData = normalize_photo_data($data['photo_data'] ?? null);

  $errors = [];
  if ($name === '') $errors['name'] = 'name is required';
  if ($position === '') $errors['position_title'] = 'position_title is required';
  check_max_length('name', $name, 120, $errors);
  check_max_length('position_title', $position, 120, $errors);
  if (!empty($errors)) validation_error_response($errors);

  $stmt = $pdo->prepare('SELECT * FROM organization_chart_members WHERE id = :id AND is_active = 1 LIMIT 1');
  $stmt->execute([':id' => $id]);
  $existing = $stmt->fetch();
  if (!$existing) error_response('Member not found.', 404);

  $stmt = $pdo->prepare('
    UPDATE organization_chart_members
    SET name = :name,
        position_title = :position_title,
        photo_data = :photo_data,
        sort_order = :sort_order
    WHERE id = :id
  ');
  $stmt->execute([
    ':name' => $name,
    ':position_title' => $position,
    ':photo_data' => $photoData,
    ':sort_order' => $sortOrder,
    ':id' => $id
  ]);

  log_action($pdo, $_SESSION['user_id'], 'update', 'ORGANIZATION_CHART', $id, $existing, [
    'name' => $name,
    'position_title' => $position,
    'sort_order' => $sortOrder
  ]);
  json_response(['success' => true, 'data' => ['id' => $id]]);
}

if ($method === 'DELETE') {
  require_admin();
  $id = (int)($_GET['id'] ?? 0);
  if ($id <= 0) error_response('Invalid member id.', 422);

  $stmt = $pdo->prepare('SELECT * FROM organization_chart_members WHERE id = :id AND is_active = 1 LIMIT 1');
  $stmt->execute([':id' => $id]);
  $existing = $stmt->fetch();
  if (!$existing) error_response('Member not found.', 404);

  $stmt = $pdo->prepare('UPDATE organization_chart_members SET is_active = 0 WHERE id = :id');
  $stmt->execute([':id' => $id]);
  log_action($pdo, $_SESSION['user_id'], 'delete', 'ORGANIZATION_CHART', $id, $existing, null);
  json_response(['success' => true, 'data' => true]);
}

error_response('Method not allowed', 405);
?>

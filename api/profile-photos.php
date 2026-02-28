<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/middleware.php';

start_secure_session();
enforce_csrf_for_request(['PUT', 'DELETE']);
require_login();

function is_supported_photo_mime($mime) {
  return in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true);
}

function profile_photo_extension_by_mime($mime) {
  if ($mime === 'image/jpeg') return 'jpg';
  if ($mime === 'image/png') return 'png';
  if ($mime === 'image/webp') return 'webp';
  if ($mime === 'image/gif') return 'gif';
  return '';
}

function parse_base64_photo_data($value) {
  $text = trim((string)$value);
  if ($text === '') return [null, null];
  if (!preg_match('/^data:(image\/[a-z0-9\+\-\.]+);base64,(.+)$/i', $text, $m)) {
    error_response('photo_data must be a valid base64 image.', 422);
  }
  $mime = strtolower($m[1]);
  if (!is_supported_photo_mime($mime)) {
    error_response('Unsupported image type. Use JPG, PNG, WEBP, or GIF.', 422);
  }
  $binary = base64_decode($m[2], true);
  if ($binary === false) {
    error_response('Invalid image data.', 422);
  }
  if (strlen($binary) > 2 * 1024 * 1024) {
    error_response('photo_data is too large.', 422);
  }
  return [$mime, $binary];
}

function resolve_target($data) {
  $target = strtolower(trim((string)($data['target'] ?? $_GET['target'] ?? '')));
  if (!in_array($target, ['student', 'user'], true)) {
    error_response('Invalid target.', 422);
  }
  $idRaw = $data['id'] ?? ($_GET['id'] ?? null);
  $id = (int)$idRaw;
  if ($id <= 0) {
    if ($target === 'user') {
      $id = (int)($_SESSION['user_id'] ?? 0);
    }
    if ($id <= 0) error_response('Invalid id.', 422);
  }
  return [$target, $id];
}

function ensure_profile_photo_dir() {
  $year = date('Y');
  $relativeDir = 'storage/uploads/profile_photos/' . $year;
  $absoluteDir = realpath(__DIR__ . '/../storage/uploads');
  if ($absoluteDir === false) {
    error_response('Upload directory is not available.', 500);
  }
  $absoluteDir = $absoluteDir . DIRECTORY_SEPARATOR . 'profile_photos' . DIRECTORY_SEPARATOR . $year;
  if (!is_dir($absoluteDir) && !mkdir($absoluteDir, 0755, true)) {
    error_response('Failed to prepare upload directory.', 500);
  }
  return [$relativeDir, $absoluteDir];
}

function remove_existing_photo_file($relativePath) {
  $text = trim((string)$relativePath);
  if ($text === '') return;
  if (strpos($text, 'storage/uploads/profile_photos/') !== 0) return;
  $absolute = realpath(__DIR__ . '/../');
  if ($absolute === false) return;
  $path = $absolute . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $text);
  if (is_file($path)) @unlink($path);
}

function output_photo_file($relativePath) {
  $text = trim((string)$relativePath);
  if ($text === '') {
    http_response_code(404);
    exit;
  }
  if (strpos($text, 'storage/uploads/profile_photos/') !== 0) {
    http_response_code(404);
    exit;
  }
  $root = realpath(__DIR__ . '/../');
  if ($root === false) {
    http_response_code(404);
    exit;
  }
  $absolute = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $text);
  if (!is_file($absolute)) {
    http_response_code(404);
    exit;
  }
  $finfo = finfo_open(FILEINFO_MIME_TYPE);
  $mime = finfo_file($finfo, $absolute) ?: 'application/octet-stream';
  finfo_close($finfo);
  if (!is_supported_photo_mime($mime)) {
    http_response_code(404);
    exit;
  }
  header('Content-Type: ' . $mime);
  header('Content-Length: ' . filesize($absolute));
  header('Cache-Control: private, max-age=300');
  readfile($absolute);
  exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = strtolower(trim((string)($_GET['action'] ?? '')));

if ($method === 'GET' && $action === 'view') {
  [$target, $id] = resolve_target([]);
  if ($target === 'student') {
    require_record_officer();
    $stmt = $pdo->prepare('SELECT photo_data FROM students WHERE id = :id AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();
    if (!$row) {
      http_response_code(404);
      exit;
    }
    output_photo_file($row['photo_data'] ?? '');
  }

  $selfId = (int)($_SESSION['user_id'] ?? 0);
  if ($_SESSION['role'] !== 'ADMIN' && $id !== $selfId) {
    error_response('Forbidden', 403);
  }
  $stmt = $pdo->prepare('SELECT photo_data FROM users WHERE id = :id LIMIT 1');
  $stmt->execute([':id' => $id]);
  $row = $stmt->fetch();
  if (!$row) {
    http_response_code(404);
    exit;
  }
  output_photo_file($row['photo_data'] ?? '');
}

if ($method === 'GET') {
  [$target, $id] = resolve_target([]);
  if ($target === 'student') {
    require_record_officer();
    $stmt = $pdo->prepare('SELECT id, photo_data FROM students WHERE id = :id AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();
    if (!$row) error_response('Student not found.', 404);
    json_response(['success' => true, 'data' => ['target' => 'student', 'id' => (int)$row['id'], 'photo_data' => $row['photo_data'] ?? null]]);
  }

  $selfId = (int)($_SESSION['user_id'] ?? 0);
  if ($_SESSION['role'] !== 'ADMIN' && $id !== $selfId) {
    error_response('Forbidden', 403);
  }
  $stmt = $pdo->prepare('SELECT id, photo_data FROM users WHERE id = :id LIMIT 1');
  $stmt->execute([':id' => $id]);
  $row = $stmt->fetch();
  if (!$row) error_response('User not found.', 404);
  json_response(['success' => true, 'data' => ['target' => 'user', 'id' => (int)$row['id'], 'photo_data' => $row['photo_data'] ?? null]]);
}

if ($method === 'PUT') {
  $data = get_json_input();
  [$target, $id] = resolve_target($data);
  [$mime, $binary] = parse_base64_photo_data($data['photo_data'] ?? null);
  if ($binary === null) error_response('photo_data is required.', 422);

  [$relativeDir, $absoluteDir] = ensure_profile_photo_dir();
  $extension = profile_photo_extension_by_mime($mime);
  if ($extension === '') error_response('Unsupported image type.', 422);
  $fileName = 'photo_' . $target . '_' . $id . '_' . uniqid('', true) . '.' . $extension;
  $relativePath = $relativeDir . '/' . $fileName;
  $absolutePath = $absoluteDir . DIRECTORY_SEPARATOR . $fileName;

  if ($target === 'student') {
    require_record_officer();
    $stmt = $pdo->prepare('SELECT id, photo_data FROM students WHERE id = :id AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([':id' => $id]);
    $existing = $stmt->fetch();
    if (!$existing) error_response('Student not found.', 404);

    $pdo->beginTransaction();
    try {
      if (file_put_contents($absolutePath, $binary) === false) {
        throw new Exception('Failed to save photo file.');
      }
      $stmt = $pdo->prepare('UPDATE students SET photo_data = :photo_data WHERE id = :id');
      $stmt->execute([
        ':photo_data' => $relativePath,
        ':id' => $id
      ]);
      $pdo->commit();
      remove_existing_photo_file($existing['photo_data'] ?? '');
      log_action($pdo, $_SESSION['user_id'], 'update', 'STUDENT_PHOTO', $id, ['photo_data' => $existing['photo_data'] ?? null], ['photo_data' => $relativePath]);
      json_response(['success' => true, 'data' => ['photo_data' => $relativePath]]);
    } catch (Exception $e) {
      if ($pdo->inTransaction()) $pdo->rollBack();
      if (is_file($absolutePath)) @unlink($absolutePath);
      error_log($e);
      error_response('Failed to save student photo.', 500);
    }
  }

  $selfId = (int)($_SESSION['user_id'] ?? 0);
  if ($_SESSION['role'] !== 'ADMIN' && $id !== $selfId) {
    error_response('Forbidden', 403);
  }
  if ($_SESSION['role'] === 'ADMIN' && $id === $selfId) {
    error_response('Admin profile picture upload is disabled.', 403);
  }

  $stmt = $pdo->prepare('SELECT id, photo_data FROM users WHERE id = :id LIMIT 1');
  $stmt->execute([':id' => $id]);
  $existing = $stmt->fetch();
  if (!$existing) error_response('User not found.', 404);

  $pdo->beginTransaction();
  try {
    if (file_put_contents($absolutePath, $binary) === false) {
      throw new Exception('Failed to save photo file.');
    }
    $stmt = $pdo->prepare('UPDATE users SET photo_data = :photo_data WHERE id = :id');
    $stmt->execute([
      ':photo_data' => $relativePath,
      ':id' => $id
    ]);
    $pdo->commit();
    remove_existing_photo_file($existing['photo_data'] ?? '');
    log_action($pdo, $_SESSION['user_id'], 'update', 'USER_PHOTO', $id, ['photo_data' => $existing['photo_data'] ?? null], ['photo_data' => $relativePath]);
    json_response(['success' => true, 'data' => ['photo_data' => $relativePath]]);
  } catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if (is_file($absolutePath)) @unlink($absolutePath);
    error_log($e);
    error_response('Failed to save user photo.', 500);
  }
}

if ($method === 'DELETE') {
  $data = get_json_input();
  [$target, $id] = resolve_target($data);

  if ($target === 'student') {
    require_record_officer();
    $stmt = $pdo->prepare('SELECT id, photo_data FROM students WHERE id = :id AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([':id' => $id]);
    $existing = $stmt->fetch();
    if (!$existing) error_response('Student not found.', 404);
    $stmt = $pdo->prepare('UPDATE students SET photo_data = NULL WHERE id = :id');
    $stmt->execute([':id' => $id]);
    remove_existing_photo_file($existing['photo_data'] ?? '');
    log_action($pdo, $_SESSION['user_id'], 'delete', 'STUDENT_PHOTO', $id, ['photo_data' => $existing['photo_data'] ?? null], null);
    json_response(['success' => true, 'data' => true]);
  }

  $selfId = (int)($_SESSION['user_id'] ?? 0);
  if ($_SESSION['role'] !== 'ADMIN' && $id !== $selfId) {
    error_response('Forbidden', 403);
  }
  if ($_SESSION['role'] === 'ADMIN' && $id === $selfId) {
    error_response('Admin profile picture update is disabled.', 403);
  }

  $stmt = $pdo->prepare('SELECT id, photo_data FROM users WHERE id = :id LIMIT 1');
  $stmt->execute([':id' => $id]);
  $existing = $stmt->fetch();
  if (!$existing) error_response('User not found.', 404);
  $stmt = $pdo->prepare('UPDATE users SET photo_data = NULL WHERE id = :id');
  $stmt->execute([':id' => $id]);
  remove_existing_photo_file($existing['photo_data'] ?? '');
  log_action($pdo, $_SESSION['user_id'], 'delete', 'USER_PHOTO', $id, ['photo_data' => $existing['photo_data'] ?? null], null);
  json_response(['success' => true, 'data' => true]);
}

error_response('Method not allowed', 405);
?>

<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/middleware.php';

start_secure_session();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET' && ($_GET['action'] ?? '') === 'download') {
  require_record_officer();
  $id = (int)($_GET['id'] ?? 0);
  if ($id <= 0) error_response('Invalid document id.', 422);

  $stmt = $pdo->prepare('SELECT id, original_name, stored_name, file_path, mime_type, file_size
                         FROM documents WHERE id = :id AND deleted_at IS NULL LIMIT 1');
  $stmt->execute([':id' => $id]);
  $doc = $stmt->fetch();
  if (!$doc) error_response('Document not found.', 404);

  $path = __DIR__ . '/../' . $doc['file_path'];
  $real = realpath($path);
  $base = realpath(ARCHIVIA_UPLOAD_DIR);
  if (!$real || !$base || strpos($real, $base) !== 0) {
    error_response('Invalid document path.', 400);
  }
  if (!is_file($real)) error_response('File missing.', 404);

  header('Content-Type: ' . $doc['mime_type']);
  header('Content-Length: ' . $doc['file_size']);
  header('Content-Disposition: inline; filename="' . basename($doc['original_name']) . '"');
  readfile($real);
  exit;
}

if ($method === 'GET') {
  require_record_officer();
  $studentId = (int)($_GET['student_id'] ?? 0);
  $params = [];
  $where = ['deleted_at IS NULL'];
  if ($studentId > 0) {
    $where[] = 'student_id = :student_id';
    $params[':student_id'] = $studentId;
  }
  $sql = 'SELECT id, student_id, document_group_id, original_name, file_path, mime_type, file_size, version_number, is_current, uploaded_by, created_at
          FROM documents WHERE ' . implode(' AND ', $where) . ' ORDER BY created_at DESC';
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  json_response(['success' => true, 'data' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
  require_record_officer();

  $studentId = (int)($_POST['student_id'] ?? 0);
  if ($studentId <= 0) error_response('Invalid student id.', 422);

  if (empty($_FILES['file'])) error_response('File is required.', 422);
  $file = $_FILES['file'];
  if ($file['error'] !== UPLOAD_ERR_OK) error_response('File upload failed.', 400);
  if ($file['size'] > 10 * 1024 * 1024) error_response('File too large (max 10MB).', 422);
  $finfo = new finfo(FILEINFO_MIME_TYPE);
  $mime = $finfo->file($file['tmp_name']);
  if ($mime !== 'application/pdf') error_response('Only PDF files are allowed.', 422);

  $stmt = $pdo->prepare('SELECT id, batch_year FROM students WHERE id = :id AND deleted_at IS NULL LIMIT 1');
  $stmt->execute([':id' => $studentId]);
  $student = $stmt->fetch();
  if (!$student) error_response('Student not found.', 404);

  $pdo->beginTransaction();
  try {
    $groupId = (int)($_POST['document_group_id'] ?? 0);
    if ($groupId <= 0) {
      $stmt = $pdo->prepare('INSERT INTO document_groups (student_id) VALUES (:student_id)');
      $stmt->execute([':student_id' => $studentId]);
      $groupId = (int)$pdo->lastInsertId();
    }

    $stmt = $pdo->prepare('SELECT MAX(version_number) AS max_version FROM documents WHERE document_group_id = :group_id FOR UPDATE');
    $stmt->execute([':group_id' => $groupId]);
    $maxVersion = (int)($stmt->fetch()['max_version'] ?? 0);
    $nextVersion = $maxVersion + 1;

    $stmt = $pdo->prepare('UPDATE documents SET is_current = 0 WHERE document_group_id = :group_id');
    $stmt->execute([':group_id' => $groupId]);

    $originalName = $file['name'];
    $storedName = uniqid('doc_', true) . '.pdf';
    $batchYear = (int)$student['batch_year'];
    $dir = ARCHIVIA_UPLOAD_DIR . '/' . $batchYear;
    if (!is_dir($dir)) {
      mkdir($dir, 0775, true);
    }
    $safeName = sanitize_filename($storedName);
    $relativePath = 'storage/uploads/' . $batchYear . '/' . $safeName;
    $targetPath = ARCHIVIA_UPLOAD_DIR . '/' . $batchYear . '/' . $safeName;

    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
      throw new Exception('Failed to move uploaded file.');
    }

    $stmt = $pdo->prepare('
      INSERT INTO documents (student_id, document_group_id, original_name, stored_name, file_path, mime_type, file_size, version_number, is_current, uploaded_by)
      VALUES (:student_id, :group_id, :original_name, :stored_name, :file_path, :mime_type, :file_size, :version_number, 1, :uploaded_by)
    ');
    $stmt->execute([
      ':student_id' => $studentId,
      ':group_id' => $groupId,
      ':original_name' => $originalName,
      ':stored_name' => $safeName,
      ':file_path' => $relativePath,
      ':mime_type' => $mime,
      ':file_size' => (int)$file['size'],
      ':version_number' => $nextVersion,
      ':uploaded_by' => $_SESSION['user_id']
    ]);
    $docId = (int)$pdo->lastInsertId();

    log_action($pdo, $_SESSION['user_id'], 'upload', 'DOCUMENT', $docId, null, [
      'student_id' => $studentId,
      'document_group_id' => $groupId,
      'original_name' => $originalName
    ]);

    $pdo->commit();
    json_response(['success' => true, 'data' => ['id' => $docId]]);
  } catch (Exception $e) {
    $pdo->rollBack();
    if (isset($targetPath) && is_file($targetPath)) {
      unlink($targetPath);
    }
    error_response('Upload failed.', 500);
  }
}

error_response('Method not allowed', 405);
?>

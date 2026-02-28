<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/middleware.php';

start_secure_session();
enforce_csrf_for_request();

$method = $_SERVER['REQUEST_METHOD'];

function resolve_document_file_path($doc) {
  $path = __DIR__ . '/../' . $doc['file_path'];
  $real = realpath($path);
  $base = realpath(ARCHIVIA_UPLOAD_DIR);
  if (!$real || !$base || strpos($real, $base) !== 0) {
    error_response('Invalid document path.', 400);
  }
  if (!is_file($real)) {
    error_response('File missing.', 404);
  }
  return $real;
}

function reject_invalid_document() {
  http_response_code(400);
  header('Content-Type: application/json');
  echo json_encode([
    'success' => false,
    'message' => 'Invalid document file.'
  ]);
  exit;
}

function validate_uploaded_document($file) {
  if ($file['error'] !== UPLOAD_ERR_OK) {
    reject_invalid_document();
  }
  if ($file['size'] > 10 * 1024 * 1024) {
    reject_invalid_document();
  }

  $ext = strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION));
  $allowedExt = [
    'pdf' => ['application/pdf'],
    'jpg' => ['image/jpeg'],
    'jpeg' => ['image/jpeg'],
    'png' => ['image/png'],
    'webp' => ['image/webp'],
    'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip']
  ];
  if (!isset($allowedExt[$ext])) {
    reject_invalid_document();
  }

  $finfo = finfo_open(FILEINFO_MIME_TYPE);
  $mime = $finfo ? (string)finfo_file($finfo, $file['tmp_name']) : '';
  if ($finfo) {
    finfo_close($finfo);
  }
  if (!in_array($mime, $allowedExt[$ext], true)) {
    reject_invalid_document();
  }

  $handle = fopen($file['tmp_name'], 'rb');
  if ($handle === false) {
    reject_invalid_document();
  }
  $head = (string)fread($handle, 16);
  fclose($handle);

  if ($mime === 'application/pdf') {
    if (substr($head, 0, 4) !== '%PDF') {
      reject_invalid_document();
    }
    $tailSampleSize = min((int)$file['size'], 2048);
    $tailHandle = fopen($file['tmp_name'], 'rb');
    if ($tailHandle === false) {
      reject_invalid_document();
    }
    if ($tailSampleSize > 0) {
      fseek($tailHandle, -$tailSampleSize, SEEK_END);
    }
    $tailChunk = (string)fread($tailHandle, $tailSampleSize);
    fclose($tailHandle);
    if (strpos($tailChunk, '%%EOF') === false) {
      reject_invalid_document();
    }
  }

  if ($mime === 'image/jpeg' && !(isset($head[0], $head[1]) && ord($head[0]) === 0xFF && ord($head[1]) === 0xD8)) {
    reject_invalid_document();
  }
  if ($mime === 'image/png' && substr($head, 0, 8) !== "\x89PNG\x0D\x0A\x1A\x0A") {
    reject_invalid_document();
  }
  if ($mime === 'image/webp' && !(substr($head, 0, 4) === 'RIFF' && substr($head, 8, 4) === 'WEBP')) {
    reject_invalid_document();
  }
  if ($ext === 'docx') {
    if (substr($head, 0, 2) !== 'PK') {
      reject_invalid_document();
    }
    $zip = new ZipArchive();
    if ($zip->open($file['tmp_name']) !== true) {
      reject_invalid_document();
    }
    $hasContentTypes = $zip->locateName('[Content_Types].xml') !== false;
    $hasMainDoc = $zip->locateName('word/document.xml') !== false;
    $zip->close();
    if (!$hasContentTypes || !$hasMainDoc) {
      reject_invalid_document();
    }
  }

  return ['ext' => $ext, 'mime' => $mime];
}

function image_to_jpeg_data($path, $mime) {
  $size = @getimagesize($path);
  if (!$size || empty($size[0]) || empty($size[1])) {
    return null;
  }
  $width = (int)$size[0];
  $height = (int)$size[1];

  if ($mime === 'image/jpeg') {
    $jpegData = @file_get_contents($path);
    if ($jpegData === false) return null;
    return ['jpeg' => $jpegData, 'width' => $width, 'height' => $height];
  }

  if (!function_exists('imagecreatetruecolor')) {
    return null;
  }
  if ($mime === 'image/png' && !function_exists('imagecreatefrompng')) {
    return null;
  }
  if ($mime === 'image/webp' && !function_exists('imagecreatefromwebp')) {
    return null;
  }

  if ($mime === 'image/png') {
    $src = @imagecreatefrompng($path);
  } else {
    $src = @imagecreatefromwebp($path);
  }
  if (!$src) {
    return null;
  }

  $canvas = imagecreatetruecolor($width, $height);
  $white = imagecolorallocate($canvas, 255, 255, 255);
  imagefill($canvas, 0, 0, $white);
  imagecopy($canvas, $src, 0, 0, 0, 0, $width, $height);

  ob_start();
  imagejpeg($canvas, null, 90);
  $jpegData = (string)ob_get_clean();
  imagedestroy($canvas);
  imagedestroy($src);

  return ['jpeg' => $jpegData, 'width' => $width, 'height' => $height];
}

function image_blob_to_jpeg_data($blob, $mime) {
  $size = @getimagesizefromstring($blob);
  if (!$size || empty($size[0]) || empty($size[1])) {
    return null;
  }
  $width = (int)$size[0];
  $height = (int)$size[1];
  if ($mime === 'image/jpeg') {
    return ['jpeg' => $blob, 'width' => $width, 'height' => $height];
  }
  if (!function_exists('imagecreatefromstring') || !function_exists('imagecreatetruecolor')) {
    return null;
  }
  $src = @imagecreatefromstring($blob);
  if (!$src) return null;
  $canvas = imagecreatetruecolor($width, $height);
  $white = imagecolorallocate($canvas, 255, 255, 255);
  imagefill($canvas, 0, 0, $white);
  imagecopy($canvas, $src, 0, 0, 0, 0, $width, $height);
  ob_start();
  imagejpeg($canvas, null, 90);
  $jpeg = (string)ob_get_clean();
  imagedestroy($canvas);
  imagedestroy($src);
  return ['jpeg' => $jpeg, 'width' => $width, 'height' => $height];
}

function extract_docx_images_as_jpegs($path) {
  $zip = new ZipArchive();
  if ($zip->open($path) !== true) return [];
  $pages = [];
  for ($i = 0; $i < $zip->numFiles; $i++) {
    $name = $zip->getNameIndex($i);
    if (strpos($name, 'word/media/') !== 0) continue;
    $blob = $zip->getFromIndex($i);
    if ($blob === false) continue;
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = $finfo ? (string)finfo_buffer($finfo, $blob) : '';
    if ($finfo) finfo_close($finfo);
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) continue;
    $img = image_blob_to_jpeg_data($blob, $mime);
    if ($img) $pages[] = $img;
  }
  $zip->close();
  return $pages;
}

function build_pdf_from_jpeg_pages($pages) {
  if (!$pages || !count($pages)) return null;
  $objects = [];
  $pageRefs = [];
  $objId = 3;
  foreach ($pages as $page) {
    $imgObj = $objId++;
    $contentObj = $objId++;
    $pageObj = $objId++;
    $widthPt = max(1, (float)$page['width']);
    $heightPt = max(1, (float)$page['height']);
    $content = "q\n{$widthPt} 0 0 {$heightPt} 0 0 cm\n/Im0 Do\nQ\n";
    $objects[$imgObj] = '<< /Type /XObject /Subtype /Image /Width ' . (int)$page['width'] . ' /Height ' . (int)$page['height'] . ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' . strlen($page['jpeg']) . " >>\nstream\n" . $page['jpeg'] . "\nendstream";
    $objects[$contentObj] = '<< /Length ' . strlen($content) . " >>\nstream\n" . $content . "endstream";
    $objects[$pageObj] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {$widthPt} {$heightPt}] /Resources << /XObject << /Im0 {$imgObj} 0 R >> >> /Contents {$contentObj} 0 R >>";
    $pageRefs[] = "{$pageObj} 0 R";
  }
  $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  $objects[2] = '<< /Type /Pages /Kids [' . implode(' ', $pageRefs) . '] /Count ' . count($pageRefs) . ' >>';
  ksort($objects);

  $pdf = "%PDF-1.4\n";
  $offsets = [0];
  $maxObj = max(array_keys($objects));
  for ($i = 1; $i <= $maxObj; $i++) {
    if (!isset($objects[$i])) continue;
    $offsets[$i] = strlen($pdf);
    $pdf .= $i . " 0 obj\n" . $objects[$i] . "\nendobj\n";
  }
  $xrefPos = strlen($pdf);
  $pdf .= "xref\n0 " . ($maxObj + 1) . "\n0000000000 65535 f \n";
  for ($i = 1; $i <= $maxObj; $i++) {
    $off = isset($offsets[$i]) ? $offsets[$i] : 0;
    $flag = isset($offsets[$i]) ? 'n' : 'f';
    $gen = isset($offsets[$i]) ? '00000' : '65535';
    $pdf .= sprintf('%010d %s %s ' . "\n", $off, $gen, $flag);
  }
  $pdf .= "trailer\n<< /Size " . ($maxObj + 1) . " /Root 1 0 R >>\nstartxref\n{$xrefPos}\n%%EOF";
  return $pdf;
}

if ($method === 'GET' && ($_GET['action'] ?? '') === 'download') {
  require_record_officer();
  $id = (int)($_GET['id'] ?? 0);
  if ($id <= 0) error_response('Invalid document id.', 422);

  $stmt = $pdo->prepare('SELECT id, original_name, stored_name, file_path, mime_type, file_size
                         FROM documents WHERE id = :id AND deleted_at IS NULL LIMIT 1');
  $stmt->execute([':id' => $id]);
  $doc = $stmt->fetch();
  if (!$doc) error_response('Document not found.', 404);

  $real = resolve_document_file_path($doc);
  header('Content-Type: ' . $doc['mime_type']);
  header('Content-Length: ' . filesize($real));
  header('Content-Disposition: inline; filename="' . basename($doc['original_name']) . '"');
  readfile($real);
  exit;
}

if ($method === 'GET' && ($_GET['action'] ?? '') === 'export_pdf') {
  require_admin();
  $id = (int)($_GET['id'] ?? 0);
  if ($id <= 0) error_response('Invalid document id.', 422);

  $stmt = $pdo->prepare('SELECT id, original_name, file_path, mime_type
                         FROM documents WHERE id = :id AND deleted_at IS NULL LIMIT 1');
  $stmt->execute([':id' => $id]);
  $doc = $stmt->fetch();
  if (!$doc) error_response('Document not found.', 404);

  $real = resolve_document_file_path($doc);
  $baseName = pathinfo((string)$doc['original_name'], PATHINFO_FILENAME);
  if ($baseName === '') $baseName = 'document_' . $id;
  $exportName = sanitize_filename($baseName) . '.pdf';

  if ($doc['mime_type'] === 'application/pdf') {
    header('Content-Type: application/pdf');
    header('Content-Length: ' . filesize($real));
    header('Content-Disposition: attachment; filename="' . $exportName . '"');
    readfile($real);
    exit;
  }

  if (in_array($doc['mime_type'], ['image/jpeg', 'image/png', 'image/webp'], true)) {
    $img = image_to_jpeg_data($real, $doc['mime_type']);
    if (!$img) {
      error_response('PDF export failed.', 500);
    }
    $pdf = build_pdf_from_jpeg_pages([$img]);
    if ($pdf === null) error_response('PDF export failed.', 500);
    header('Content-Type: application/pdf');
    header('Content-Length: ' . strlen($pdf));
    header('Content-Disposition: attachment; filename="' . $exportName . '"');
    echo $pdf;
    exit;
  }

  if ($doc['mime_type'] === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || pathinfo((string)$doc['original_name'], PATHINFO_EXTENSION) === 'docx') {
    $pages = extract_docx_images_as_jpegs($real);
    if (!count($pages)) {
      error_response('PDF export failed.', 422);
    }
    $pdf = build_pdf_from_jpeg_pages($pages);
    if ($pdf === null) error_response('PDF export failed.', 500);
    header('Content-Type: application/pdf');
    header('Content-Length: ' . strlen($pdf));
    header('Content-Disposition: attachment; filename="' . $exportName . '"');
    echo $pdf;
    exit;
  }

  error_response('Unsupported export format.', 422);
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
  $validated = validate_uploaded_document($file);
  $mime = $validated['mime'];
  $ext = $validated['ext'];

  $stmt = $pdo->prepare('SELECT id, batch_year FROM students WHERE id = :id AND deleted_at IS NULL LIMIT 1');
  $stmt->execute([':id' => $studentId]);
  $student = $stmt->fetch();
  if (!$student) error_response('Student not found.', 404);

  $targetPath = null;
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
    $storedName = uniqid('doc_', true) . '.' . $ext;
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
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    if ($targetPath && is_file($targetPath)) {
      unlink($targetPath);
    }
    error_log($e);
    reject_invalid_document();
  }
}

error_response('Method not allowed', 405);
?>

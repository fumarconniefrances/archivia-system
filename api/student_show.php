<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/middleware.php';

start_secure_session();

require_record_officer();

$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) error_response('Invalid student id.', 422);

$stmt = $pdo->prepare('
  SELECT
    s.id,
    s.student_id,
    s.first_name,
    s.last_name,
    s.sex,
    s.batch_year,
    s.grade_level,
    s.section,
    s.created_at,
    COALESCE(s.adviser_name, "") AS adviser_name
  FROM students s
  WHERE s.id = :id AND s.deleted_at IS NULL
  LIMIT 1
');
$stmt->execute([':id' => $id]);
$student = $stmt->fetch();
if (!$student) error_response('Student not found.', 404);

json_response(['success' => true, 'data' => $student]);
?>

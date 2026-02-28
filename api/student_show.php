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
    COALESCE(u.name, "") AS adviser_name
  FROM students s
  LEFT JOIN teacher_assignments ta ON ta.id = (
    SELECT ta2.id
    FROM teacher_assignments ta2
    WHERE ta2.student_id = s.id
    ORDER BY ta2.assigned_at DESC, ta2.id DESC
    LIMIT 1
  )
  LEFT JOIN users u ON u.id = ta.teacher_id
  WHERE s.id = :id AND s.deleted_at IS NULL
  LIMIT 1
');
$stmt->execute([':id' => $id]);
$student = $stmt->fetch();
if (!$student) error_response('Student not found.', 404);

json_response(['success' => true, 'data' => $student]);
?>

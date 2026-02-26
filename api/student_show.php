<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/middleware.php';

if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

require_login();

$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) error_response('Invalid student id.', 422);

$stmt = $pdo->prepare('SELECT id, student_id, first_name, last_name, sex, batch_year, grade_level, section, created_at
                       FROM students WHERE id = :id AND deleted_at IS NULL LIMIT 1');
$stmt->execute([':id' => $id]);
$student = $stmt->fetch();
if (!$student) error_response('Student not found.', 404);

json_response(['success' => true, 'data' => $student]);
?>

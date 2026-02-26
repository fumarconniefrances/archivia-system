<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/middleware.php';

if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

require_admin();

$stmt = $pdo->prepare('SELECT id, user_id, action, entity_type, entity_id, created_at FROM logs ORDER BY created_at DESC LIMIT 200');
$stmt->execute();
json_response(['success' => true, 'data' => $stmt->fetchAll()]);
?>

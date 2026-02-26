<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/middleware.php';

start_secure_session();

require_admin();

[$page, $limit, $offset] = get_pagination_params(50, 200);
$countStmt = $pdo->prepare('SELECT COUNT(*) AS total FROM logs');
$countStmt->execute();
$total = (int)($countStmt->fetch()['total'] ?? 0);

$stmt = $pdo->prepare('SELECT id, user_id, action, entity_type, entity_id, created_at FROM logs ORDER BY created_at DESC LIMIT :limit OFFSET :offset');
$stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();
json_response(['success' => true, 'data' => $stmt->fetchAll(), 'page' => $page, 'limit' => $limit, 'total' => $total]);
?>

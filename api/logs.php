<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/middleware.php';

start_secure_session();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_GET['action'] ?? '') === 'track') {
  require_role(['ADMIN', 'RECORD_OFFICER']);
  $data = get_json_input();
  $event = trim((string)($data['event'] ?? 'page_view'));
  $page = trim((string)($data['page'] ?? ''));
  $title = trim((string)($data['title'] ?? ''));

  if ($event === '') $event = 'page_view';
  if (strlen($event) > 60) $event = substr($event, 0, 60);
  if (strlen($page) > 120) $page = substr($page, 0, 120);
  if (strlen($title) > 200) $title = substr($title, 0, 200);

  log_action($pdo, $_SESSION['user_id'], $event, 'PAGE', null, null, [
    'page' => $page,
    'title' => $title
  ]);

  json_response(['success' => true, 'data' => true], 201);
}

require_admin();

[$page, $limit, $offset] = get_pagination_params(50, 200);
$countStmt = $pdo->prepare('SELECT COUNT(*) AS total FROM logs');
$countStmt->execute();
$total = (int)($countStmt->fetch()['total'] ?? 0);

$stmt = $pdo->prepare('
  SELECT l.id, l.user_id, l.action, l.entity_type, l.entity_id, l.created_at, u.name AS user_name
  FROM logs l
  LEFT JOIN users u ON u.id = l.user_id
  ORDER BY l.created_at DESC
  LIMIT :limit OFFSET :offset
');
$stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();
json_response(['success' => true, 'data' => $stmt->fetchAll(), 'page' => $page, 'limit' => $limit, 'total' => $total]);
?>

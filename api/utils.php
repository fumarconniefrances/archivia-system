<?php
function json_response($data, $code = 200) {
  http_response_code($code);
  header('Content-Type: application/json');
  echo json_encode($data);
  exit;
}

function error_response($message, $code = 400) {
  json_response(['success' => false, 'message' => $message], $code);
}

function validation_error_response($errors) {
  json_response(['success' => false, 'message' => 'Validation failed.', 'errors' => $errors], 422);
}

function get_json_input() {
  $raw = file_get_contents('php://input');
  if (!$raw) return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function sanitize_filename($name) {
  $name = preg_replace('/[^A-Za-z0-9\.\-_]/', '_', $name);
  return trim($name, '_');
}

function log_action($pdo, $userId, $action, $entityType, $entityId, $oldValue, $newValue) {
  $stmt = $pdo->prepare('
    INSERT INTO logs (user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (:user_id, :action, :entity_type, :entity_id, :old_value, :new_value)
  ');
  $stmt->execute([
    ':user_id' => $userId,
    ':action' => $action,
    ':entity_type' => $entityType,
    ':entity_id' => $entityId,
    ':old_value' => $oldValue ? json_encode($oldValue) : null,
    ':new_value' => $newValue ? json_encode($newValue) : null
  ]);
}

function get_pagination_params($defaultLimit = 50, $maxLimit = 200) {
  $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
  $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : $defaultLimit;
  if ($page < 1) $page = 1;
  if ($limit < 1) $limit = $defaultLimit;
  if ($limit > $maxLimit) $limit = $maxLimit;
  $offset = ($page - 1) * $limit;
  return [$page, $limit, $offset];
}
?>

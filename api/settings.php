<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/middleware.php';

start_secure_session();
enforce_csrf_for_request(['PUT']);
require_admin();

function default_settings() {
  return [
    'school_name' => 'Archivia Integrated School',
    'data_retention_years' => '7',
    'audit_log_level' => 'Detailed'
  ];
}

function load_settings_map($pdo) {
  $stmt = $pdo->prepare('SELECT setting_key, setting_value FROM system_settings');
  $stmt->execute();
  $rows = $stmt->fetchAll();
  $map = [];
  foreach ($rows as $row) {
    $map[$row['setting_key']] = (string)($row['setting_value'] ?? '');
  }
  return $map;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  $defaults = default_settings();
  $map = load_settings_map($pdo);
  $result = [
    'school_name' => $map['school_name'] ?? $defaults['school_name'],
    'data_retention_years' => $map['data_retention_years'] ?? $defaults['data_retention_years'],
    'audit_log_level' => $map['audit_log_level'] ?? $defaults['audit_log_level']
  ];
  json_response(['success' => true, 'data' => $result]);
}

if ($method === 'PUT') {
  $data = get_json_input();
  $schoolName = trim((string)($data['school_name'] ?? ''));
  $retention = trim((string)($data['data_retention_years'] ?? ''));
  $logLevel = trim((string)($data['audit_log_level'] ?? ''));

  $errors = [];
  if ($schoolName === '') $errors['school_name'] = 'school_name is required';
  if (!in_array($retention, ['5', '7', '10'], true)) $errors['data_retention_years'] = 'data_retention_years must be 5, 7, or 10';
  if (!in_array($logLevel, ['Detailed', 'Standard'], true)) $errors['audit_log_level'] = 'audit_log_level must be Detailed or Standard';
  check_max_length('school_name', $schoolName, 150, $errors);
  if (!empty($errors)) validation_error_response($errors);

  $existing = load_settings_map($pdo);
  $newValues = [
    'school_name' => $schoolName,
    'data_retention_years' => $retention,
    'audit_log_level' => $logLevel
  ];

  $pdo->beginTransaction();
  try {
    $stmt = $pdo->prepare('
      INSERT INTO system_settings (setting_key, setting_value, updated_by)
      VALUES (:setting_key, :setting_value, :updated_by)
      ON DUPLICATE KEY UPDATE
        setting_value = VALUES(setting_value),
        updated_by = VALUES(updated_by),
        updated_at = CURRENT_TIMESTAMP
    ');

    foreach ($newValues as $key => $value) {
      $stmt->execute([
        ':setting_key' => $key,
        ':setting_value' => $value,
        ':updated_by' => $_SESSION['user_id']
      ]);
    }

    log_action($pdo, $_SESSION['user_id'], 'update', 'SETTINGS', 0, $existing, $newValues);
    $pdo->commit();
    json_response(['success' => true, 'data' => true]);
  } catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_response('Failed to save settings.', 500);
  }
}

error_response('Method not allowed', 405);
?>

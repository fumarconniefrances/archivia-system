document.addEventListener('DOMContentLoaded', async function () {
  var schoolNameInput = document.getElementById('schoolName');
  var retentionInput = document.getElementById('retention');
  var logLevelInput = document.getElementById('logLevel');
  var saveBtn = document.getElementById('saveSettingsBtn');
  var securityCard = document.getElementById('securityStatus');
  var dataSafetyCard = document.getElementById('dataSafety');

  function setCardLines(root, lines) {
    if (!root) return;
    root.innerHTML = '';
    lines.forEach(function (line) {
      var item = document.createElement('div');
      item.className = 'detail-item';
      item.textContent = line;
      root.appendChild(item);
    });
  }

  function renderHealth(health) {
    var checks = (health && health.checks) || {};
    var dbStatus = checks.db_connected ? 'Connected' : 'Disconnected';
    var dbVersion = checks.db_version ? (' (' + checks.db_version + ')') : '';
    var uploadStatus = checks.upload_writable ? 'Writable' : 'Not writable';
    var backupStatus = checks.backup_writable ? 'Writable' : 'Not writable';

    setCardLines(securityCard, [
      'Role-based access control: Enabled',
      'Daily audit capture: Enabled',
      'Database: ' + dbStatus + dbVersion
    ]);

    setCardLines(dataSafetyCard, [
      'Automatic backup directory: ' + backupStatus,
      'Upload directory: ' + uploadStatus,
      'System health: ' + (health.healthy ? 'Healthy' : 'Attention required')
    ]);
  }

  async function loadSettings() {
    window.ArchiviaUI.clearPageError();
    try {
      var settings = await window.ArchiviaApi.withRetry(function () {
        return window.ArchiviaApi.getSettings();
      }, 1);

      if (schoolNameInput) schoolNameInput.value = settings.school_name || '';
      if (retentionInput) retentionInput.value = String(settings.data_retention_years || '7');
      if (logLevelInput) logLevelInput.value = settings.audit_log_level || 'Detailed';

      var health = await window.ArchiviaApi.withRetry(function () {
        return window.ArchiviaApi.getSystemHealth();
      }, 1);
      renderHealth(health);
    } catch (error) {
      window.ArchiviaUI.showPageError(error.message, loadSettings);
    }
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async function () {
      if (!schoolNameInput || !retentionInput || !logLevelInput) return;
      var retentionYears = String(retentionInput.value || '').trim();

      saveBtn.disabled = true;
      try {
        await window.ArchiviaApi.withRetry(function () {
          return window.ArchiviaApi.saveSettings({
            school_name: schoolNameInput.value.trim(),
            data_retention_years: retentionYears,
            audit_log_level: logLevelInput.value
          });
        }, 1);
        window.ArchiviaUI.showToast('Settings updated successfully.');
        await loadSettings();
      } catch (error) {
        window.ArchiviaUI.showToast(error.message || 'Failed to save settings.');
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  await loadSettings();
});

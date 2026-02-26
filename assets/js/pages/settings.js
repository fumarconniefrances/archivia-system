document.addEventListener('DOMContentLoaded', async function () {
  async function verify() {
    try {
      if (!window.ArchiviaApi || typeof window.ArchiviaApi.getLogs !== 'function') return;
      await window.ArchiviaApi.withRetry(function () {
        return window.ArchiviaApi.getLogs();
      }, 1);
      window.ArchiviaUI.clearPageError();
    } catch (error) {
      window.ArchiviaUI.showPageError(error.message, verify);
    }
  }

  document.getElementById('saveSettingsBtn').addEventListener('click', function () {
    window.ArchiviaUI.showToast('Settings updated successfully.');
  });

  await verify();
});

document.addEventListener('DOMContentLoaded', function () {
  var params = new URLSearchParams(window.location.search);
  var redirect = params.get('redirect') || '';
  var allowedPages = {
    'dashboard-admin.html': true,
    'dashboard-teacher.html': true,
    'students.html': true,
    'student-profile.html': true,
    'documents.html': true,
    'teacher-management.html': true,
    'activity-logs.html': true,
    'settings.html': true
  };

  function sanitizeRedirect(value) {
    if (!value) return '';
    if (/^https?:\/\//i.test(value) || value.startsWith('//')) return '';
    var clean = value.replace(/^\.\//, '').split('?')[0].split('#')[0];
    return allowedPages[clean] ? clean : '';
  }

  var safeRedirect = sanitizeRedirect(redirect);
  var roleInput = document.getElementById('role');

  function normalizeRole(value) {
    var role = String(value || '').trim().toLowerCase();
    if (role === 'teacher') return 'record_officer';
    return role;
  }

  var form = document.getElementById('loginForm');
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    var email = document.getElementById('username').value.trim();
    var password = document.getElementById('password').value;

    var selectedRole = normalizeRole(roleInput ? roleInput.value : '');

    try {
      var profile = await window.ArchiviaApi.login(email, password);
      var userRole = normalizeRole(profile.role);

      if (selectedRole && selectedRole !== userRole) {
        try {
          await window.ArchiviaApi.logout();
        } catch (_error) {
          // Ignore logout errors for mismatch flow.
        }
        window.ArchiviaUI.showToast('Selected role does not match your account.');
        return;
      }

      sessionStorage.setItem('archivia_role', userRole);
      localStorage.removeItem('archivia_role');
      sessionStorage.setItem('archivia_demo_mode', '0');
      window.ArchiviaUI.showToast('Authentication successful. Redirecting...');

      setTimeout(function () {
        if (safeRedirect) {
          window.location.href = safeRedirect;
          return;
        }
        window.location.href = userRole === 'admin' ? 'dashboard-admin.html' : 'dashboard-teacher.html';
      }, 400);
    } catch (error) {
      window.ArchiviaUI.showToast(error.message || 'Login failed.');
    }
  });
});

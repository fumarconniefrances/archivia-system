(function () {
  var ALLOWED_ROLES = { admin: true, record_officer: true, teacher: true };

  function normalizeRole(role) {
    var raw = String(role || '').trim().toLowerCase();
    if (raw === 'teacher') return 'record_officer';
    return raw;
  }

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function statusClass(status) {
    var value = String(status || '').toLowerCase();
    if (value.includes('active') || value.includes('complete')) return 'status status-active';
    if (value.includes('pending') || value.includes('warning')) return 'status status-pending';
    if (value.includes('inactive')) return 'status status-inactive';
    return 'status status-archived';
  }

  function showToast(message) {
    var stack = qs('#toastStack');
    if (!stack) return;
    var item = document.createElement('div');
    item.className = 'toast';
    item.textContent = message;
    stack.appendChild(item);
    setTimeout(function () {
      item.remove();
    }, 3200);
  }

  function openModal(id) {
    var modal = qs(id);
    if (!modal) return;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    trapModalFocus(modal);
  }

  function closeModal(id) {
    var modal = qs(id);
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }

  function trapModalFocus(modal) {
    var focusable = qsa('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', modal);
    if (!focusable.length) return;
    focusable[0].focus();
    modal.onkeydown = function (event) {
      if (event.key === 'Escape') {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
      }
      if (event.key !== 'Tab') return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
  }

  function bindModalDismiss() {
    qsa('.modal').forEach(function (modal) {
      modal.setAttribute('aria-hidden', 'true');
      modal.addEventListener('click', function (event) {
        if (event.target === modal) {
          modal.classList.remove('show');
          modal.setAttribute('aria-hidden', 'true');
        }
      });
    });

    qsa('[data-modal-close]').forEach(function (button) {
      button.addEventListener('click', function () {
        closeModal(button.getAttribute('data-modal-close'));
      });
    });
  }

  function createElement(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function createStatusBadge(text) {
    var badge = createElement('span', statusClass(text), String(text || 'Unknown'));
    return badge;
  }

  function safeImageSrc(value) {
    if (!value) return '';
    var src = String(value).trim();
    if (src.startsWith('data:image/')) return src;
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    if (src.startsWith('assets/')) return src;
    return '';
  }

  function createPhotoVisual(photoValue, name, large) {
    var safeSrc = safeImageSrc(photoValue);
    if (safeSrc) {
      var imgClass = large ? 'person-avatar person-avatar-lg' : 'person-avatar';
      var img = createElement('img', imgClass);
      img.src = safeSrc;
      img.alt = (name || 'Profile') + ' photo';
      return img;
    }
    return createElement('span', large ? 'no-photo no-photo-lg' : 'no-photo', 'No Photo');
  }

  function createPersonCell(name, photoValue, large) {
    var wrap = createElement('div', 'person-cell');
    wrap.appendChild(createPhotoVisual(photoValue, name, large));
    var label = createElement('span', '', name || '');
    wrap.appendChild(label);
    return wrap;
  }

  function createActionLinkButton(label, href) {
    var link = createElement('a', 'btn btn-secondary', label || 'Open');
    link.href = href || '#';
    return link;
  }

  function createActionButton(label, className, attrs) {
    var btn = createElement('button', className || 'btn btn-secondary', label || 'Open');
    btn.type = 'button';
    Object.keys(attrs || {}).forEach(function (key) {
      btn.setAttribute(key, attrs[key]);
    });
    return btn;
  }

  function renderRows(tableBodyId, rows, columns, emptyMessage) {
    var body = qs(tableBodyId);
    if (!body) return;
    body.innerHTML = '';
    if (!rows.length) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = columns.length;
      td.appendChild(createElement('div', 'empty-state', emptyMessage || 'No records found.'));
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }

    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      columns.forEach(function (col) {
        var td = document.createElement('td');
        if (col.type === 'status') {
          td.appendChild(createStatusBadge(row[col.key]));
        } else if (typeof col.render === 'function') {
          var rendered = col.render(row);
          if (rendered instanceof Node) td.appendChild(rendered);
          else td.textContent = rendered == null ? '' : String(rendered);
        } else {
          td.textContent = row[col.key] == null ? '' : String(row[col.key]);
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }

  function renderMetricCards(rootId, metrics) {
    var root = qs(rootId);
    if (!root) return;
    root.innerHTML = '';
    metrics.forEach(function (item) {
      var card = createElement('article', 'card');
      card.appendChild(createElement('p', 'muted', String(item.title || '')));
      card.appendChild(createElement('p', 'metric', String(item.value == null ? '' : item.value)));
      if (item.hint) {
        card.appendChild(createElement('p', 'metric-meta', String(item.hint)));
      }
      root.appendChild(card);
    });
  }

  function showSkeleton(containerId, lines) {
    var root = qs(containerId);
    if (!root) return;
    root.innerHTML = '';
    for (var i = 0; i < (lines || 3); i += 1) {
      root.appendChild(createElement('div', 'skeleton-line'));
    }
  }

  function showPageError(message, retryFn) {
    var banner = qs('#pageErrorBanner');
    if (!banner) {
      banner = createElement('div', 'error-banner');
      banner.id = 'pageErrorBanner';
      var content = qs('.content');
      if (content) content.prepend(banner);
      else document.body.prepend(banner);
    }

    banner.innerHTML = '';
    var messageText = createElement('span', '', 'Something went wrong. ' + (message || 'Please try again.'));
    banner.appendChild(messageText);
    if (retryFn) {
      var retry = createActionButton('Retry', 'btn btn-secondary', { id: 'retryAction' });
      retry.onclick = retryFn;
      banner.appendChild(retry);
    }
  }

  function clearPageError() {
    var banner = qs('#pageErrorBanner');
    if (banner) banner.remove();
  }

  function setupGlobalSearch() {
    var input = qs('#globalSearch');
    if (!input) return;
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') showToast('Global search for: ' + input.value);
    });
  }

  function getCurrentRole() {
    var role = normalizeRole(sessionStorage.getItem('archivia_role') || '');
    return ALLOWED_ROLES[role] ? role : '';
  }

  function setCurrentRole(role) {
    var normalizedRole = normalizeRole(role);
    if (ALLOWED_ROLES[normalizedRole]) sessionStorage.setItem('archivia_role', normalizedRole);
  }

  function getPhotoStore() {
    try {
      return JSON.parse(localStorage.getItem('archivia_student_photos') || '{}');
    } catch (_e) {
      return {};
    }
  }

  function setPhotoStore(data) {
    localStorage.setItem('archivia_student_photos', JSON.stringify(data));
  }

  function getStudentPhoto(studentId, fallback) {
    var store = getPhotoStore();
    return store[studentId] || fallback || '';
  }

  function getTeacherPhoto(teacherId, fallback) {
    try {
      var store = JSON.parse(localStorage.getItem('archivia_teacher_photos') || '{}');
      return store[teacherId] || fallback || '';
    } catch (_e) {
      return fallback || '';
    }
  }

  function setTeacherPhoto(teacherId, value) {
    var store;
    try {
      store = JSON.parse(localStorage.getItem('archivia_teacher_photos') || '{}');
    } catch (_e) {
      store = {};
    }
    store[teacherId] = value;
    localStorage.setItem('archivia_teacher_photos', JSON.stringify(store));
  }

  function clearTeacherPhoto(teacherId) {
    var store;
    try {
      store = JSON.parse(localStorage.getItem('archivia_teacher_photos') || '{}');
    } catch (_e) {
      store = {};
    }
    delete store[teacherId];
    localStorage.setItem('archivia_teacher_photos', JSON.stringify(store));
  }

  function setStudentPhoto(studentId, value) {
    var store = getPhotoStore();
    store[studentId] = value;
    setPhotoStore(store);
  }

  function clearStudentPhoto(studentId) {
    var store = getPhotoStore();
    delete store[studentId];
    setPhotoStore(store);
  }

  function getRequiredRoles() {
    var raw = document.body.getAttribute('data-required-role');
    if (!raw) return [];
    return raw.split(',').map(function (item) {
      return normalizeRole(item.trim().toLowerCase());
    }).filter(function (item) {
      return ALLOWED_ROLES[item];
    });
  }

  async function resolveCurrentRoleFromSession() {
    if (!window.ArchiviaApi || typeof window.ArchiviaApi.me !== 'function') return getCurrentRole();
    try {
      var profile = await window.ArchiviaApi.me();
      var role = normalizeRole(profile && profile.role);
      if (ALLOWED_ROLES[role]) {
        setCurrentRole(role);
        return role;
      }
    } catch (_error) {
      // Fall back to no role when session validation fails.
    }
    return '';
  }

  async function guardRouteByRole() {
    var required = getRequiredRoles();
    if (!required.length) return true;

    var currentRole = await resolveCurrentRoleFromSession();
    if (!currentRole) {
      var target = window.location.pathname.split('/').pop() || 'dashboard-teacher.html';
      window.location.href = 'index.html?redirect=' + encodeURIComponent(target);
      return false;
    }

    if (required.indexOf(currentRole) === -1) {
      var fallback = currentRole === 'admin' ? 'dashboard-admin.html?denied=1' : 'dashboard-teacher.html?denied=1';
      window.location.href = fallback;
      return false;
    }
    return true;
  }

  function applyRoleViewMode() {
    var role = getCurrentRole();
    if (!role) return;

    qsa('[data-role]').forEach(function (node) {
      var raw = node.getAttribute('data-role') || '';
      var allowed = raw.split(',').map(function (item) { return normalizeRole(item.trim().toLowerCase()); }).filter(Boolean);
      if (allowed.length && allowed.indexOf(role) === -1) node.classList.add('hidden');
    });

    if (role !== 'record_officer') return;
    var actionIds = ['addStudentBtn', 'newTeacherBtn', 'editProfileBtn', 'uploadProfileDocBtn', 'uploadDocBtn', 'saveSettingsBtn', 'backupBtn'];
    actionIds.forEach(function (id) {
      var node = qs('#' + id);
      if (node) node.classList.add('hidden');
    });
  }

  async function logout() {
    try {
      if (window.ArchiviaApi && typeof window.ArchiviaApi.logout === 'function') {
        await window.ArchiviaApi.logout();
      }
    } catch (_error) {
      // Continue local cleanup even if network logout fails.
    } finally {
      sessionStorage.removeItem('archivia_role');
      sessionStorage.removeItem('archivia_demo_mode');
      localStorage.removeItem('archivia_role');
      window.location.href = 'index.html';
    }
  }

  function injectPageLoader() {
    var loader = createElement('div', 'app-loader');
    loader.id = 'appLoader';
    var core = createElement('div', 'app-loader-core');
    core.setAttribute('aria-label', 'Loading');
    var logo = createElement('img', 'app-loader-logo-flip');
    logo.src = 'assets/images/SPEDlogo.jpg';
    logo.alt = 'ARCHIVIA official logo';
    logo.loading = 'eager';
    core.appendChild(logo);
    core.appendChild(createElement('p', 'app-loader-title', 'ARCHIVIA'));
    loader.appendChild(core);
    document.body.prepend(loader);

    function hideLoader() {
      loader.classList.add('hidden');
      setTimeout(function () { loader.remove(); }, 320);
    }

    var minShow = setTimeout(hideLoader, 700);
    window.addEventListener('load', function () {
      clearTimeout(minShow);
      setTimeout(hideLoader, 220);
    }, { once: true });
  }

  function setupLazySections() {
    var sections = qsa('.content > section');
    if (!sections.length || !window.IntersectionObserver) return;
    sections.forEach(function (section) { section.classList.add('lazy-section'); });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '40px 0px' });
    sections.forEach(function (section) { observer.observe(section); });
  }

  function setupSidebarMobileToggle() {
    var sidebar = qs('.sidebar');
    var topbar = qs('.topbar');
    if (!sidebar || !topbar) return;

    sidebar.setAttribute('role', 'navigation');
    sidebar.setAttribute('aria-label', 'Main navigation');

    var overlay = qs('.sidebar-overlay');
    if (!overlay) {
      overlay = createActionButton('', 'sidebar-overlay', { 'aria-label': 'Close navigation' });
      document.body.appendChild(overlay);
      overlay.addEventListener('click', function () {
        document.body.classList.remove('sidebar-open');
        var toggle = qs('#menuToggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    }

    var existingLeft = qs('.topbar-left', topbar);
    if (!existingLeft) {
      var left = createElement('div', 'topbar-left');
      var search = qs('.search-wrap', topbar);
      if (search) {
        topbar.insertBefore(left, topbar.firstChild);
        left.appendChild(search);
      }
    }

    var leftNode = qs('.topbar-left', topbar);
    if (leftNode && !qs('#menuToggle', topbar)) {
      var button = createActionButton(String.fromCharCode(9776), 'menu-toggle', {
        id: 'menuToggle',
        'aria-label': 'Open navigation',
        'aria-controls': 'sideNav',
        'aria-expanded': 'false'
      });
      leftNode.prepend(button);
      button.addEventListener('click', function () {
        document.body.classList.toggle('sidebar-open');
        button.setAttribute('aria-expanded', document.body.classList.contains('sidebar-open') ? 'true' : 'false');
      });
    }

    var nav = qs('.nav', sidebar);
    if (nav) nav.id = 'sideNav';

    qsa('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        document.body.classList.remove('sidebar-open');
        var toggle = qs('#menuToggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function setupLogoutActions() {
    qsa('[data-logout]').forEach(function (button) {
      button.addEventListener('click', function () {
        logout();
      });
    });
  }

  function enhanceShell() {
    var sidebar = qs('.sidebar');
    if (sidebar) {
      var brand = qs('.brand', sidebar);
      if (brand) {
        brand.innerHTML = '';
        var block = createElement('div', 'brand-block');
        var logo = createElement('img', 'brand-logo');
        logo.src = 'assets/images/SPEDlogo.jpg';
        logo.alt = 'ARCHIVIA logo';
        logo.loading = 'lazy';
        block.appendChild(logo);
        var copy = createElement('div');
        copy.appendChild(createElement('div', 'brand-title', 'ARCHIVIA'));
        copy.appendChild(createElement('div', 'brand-subtitle', 'Internal System'));
        block.appendChild(copy);
        brand.appendChild(block);
      }
    }

    var topbar = qs('.topbar');
    if (topbar) {
      var roleLabel = qs('.topbar > .muted');
      var right = createElement('div', 'topbar-right');
      var roleText = roleLabel ? roleLabel.textContent : 'Session';
      var today = new Date();
      var dateText = today.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      right.appendChild(createElement('span', 'badge-role', roleText));
      right.appendChild(createElement('span', 'date-chip', dateText));
      if (roleLabel) roleLabel.remove();
      topbar.appendChild(right);
    }

    var pageHead = qs('.page-head');
    if (pageHead && !qs('.breadcrumb')) {
      var title = document.title.split('|')[0].trim();
      var left = qs('.page-head > div');
      if (left) {
        var crumb = createElement('p', 'breadcrumb', 'ARCHIVIA / ' + title);
        left.prepend(crumb);
      }
    }
  }

  function setupDemoMode() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('demo') !== '1') return;
    var steps = [
      'Demo mode enabled.',
      'Open Students to show 2-click profile access.',
      'Open Document Archive and preview a file.',
      'Show Activity Logs for audit traceability.'
    ];
    var idx = 0;
    var panel = createElement('div', 'demo-guide');
    panel.appendChild(createElement('strong', '', 'Presentation Guide'));
    var stepText = createElement('p', '');
    stepText.id = 'demoStep';
    panel.appendChild(stepText);
    var next = createActionButton('Next', 'btn btn-secondary', { id: 'nextDemoStep' });
    panel.appendChild(next);
    document.body.appendChild(panel);

    function drawStep() {
      stepText.textContent = steps[idx] || 'Demo complete. Continue free navigation.';
      next.textContent = idx >= steps.length ? 'Close' : 'Next';
    }

    next.addEventListener('click', function () {
      idx += 1;
      if (idx > steps.length) {
        panel.remove();
        return;
      }
      drawStep();
    });
    drawStep();
  }

  function showRouteMessages() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('denied') === '1') showToast('Access denied for this role.');
  }

  function setupGlobalErrorBoundary() {
    window.addEventListener('error', function () {
      showPageError('Unexpected application error detected.');
    });
    window.addEventListener('unhandledrejection', function () {
      showPageError('Network or async operation failed.');
    });
  }

  function trackPageActivity() {
    if (!window.ArchiviaApi || typeof window.ArchiviaApi.trackActivity !== 'function') return;
    if (!getRequiredRoles().length) return;
    var page = window.location.pathname.split('/').pop() || 'unknown';
    var title = document.title || page;
    window.ArchiviaApi.trackActivity({
      event: 'page_view',
      page: page,
      title: title
    }).catch(function () {
      // Activity tracking should never block page use.
    });
  }

  document.addEventListener('DOMContentLoaded', async function () {
    var canContinue = await guardRouteByRole();
    if (!canContinue) return;
    trackPageActivity();
    injectPageLoader();
    bindModalDismiss();
    setupGlobalSearch();
    setupGlobalErrorBoundary();
    enhanceShell();
    setupSidebarMobileToggle();
    setupLazySections();
    setupDemoMode();
    showRouteMessages();
    applyRoleViewMode();
    setupLogoutActions();
  });

  window.ArchiviaUI = {
    qs: qs,
    qsa: qsa,
    createElement: createElement,
    createPersonCell: createPersonCell,
    createPhotoVisual: createPhotoVisual,
    createActionLinkButton: createActionLinkButton,
    createActionButton: createActionButton,
    renderRows: renderRows,
    renderMetricCards: renderMetricCards,
    showToast: showToast,
    openModal: openModal,
    closeModal: closeModal,
    showSkeleton: showSkeleton,
    showPageError: showPageError,
    clearPageError: clearPageError,
    getStudentPhoto: getStudentPhoto,
    setStudentPhoto: setStudentPhoto,
    clearStudentPhoto: clearStudentPhoto,
    getTeacherPhoto: getTeacherPhoto,
    setTeacherPhoto: setTeacherPhoto,
    clearTeacherPhoto: clearTeacherPhoto,
    getCurrentRole: getCurrentRole
  };
})();

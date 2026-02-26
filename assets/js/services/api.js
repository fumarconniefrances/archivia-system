(function () {
  var DEFAULT_API_BASE = 'http://127.0.0.1:4000';
  var REQUEST_TIMEOUT_MS = Number(window.ARCHIVIA_API_TIMEOUT_MS) > 0 ? Number(window.ARCHIVIA_API_TIMEOUT_MS) : 10000;
  var API_BASE = sanitizeApiBase(window.ARCHIVIA_API_BASE || DEFAULT_API_BASE);
  var USE_MOCK = window.ARCHIVIA_USE_MOCK === true;
  var MOCK_USER_KEY = 'archivia_mock_user';
  var csrfToken = null;

  function sanitizeApiBase(value) {
    var text = String(value || '').trim();
    if (!/^https?:\/\//i.test(text)) return DEFAULT_API_BASE;
    return text.replace(/\/+$/, '');
  }

  function normalizeError(payload, fallbackStatus) {
    if (!payload || typeof payload !== 'object') {
      return new Error('Request failed');
    }
    var message = payload.message || 'Request failed';
    var error = new Error(message);
    error.code = payload.code || 'REQUEST_ERROR';
    error.status = fallbackStatus || 400;
    return error;
  }

  function formatDate(isoString) {
    if (!isoString) return '';
    var d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '';
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  async function ensureCsrfToken() {
    if (csrfToken) return csrfToken;
    var response = await fetchWithTimeout(API_BASE + '/auth/csrf-token', {
      method: 'GET',
      credentials: 'include'
    });
    var payload = await response.json();
    if (!response.ok || !payload.success) {
      throw normalizeError(payload, response.status);
    }
    csrfToken = payload.data.csrfToken;
    return csrfToken;
  }

  async function fetchWithTimeout(url, options) {
    var config = options || {};
    if (!window.AbortController) return fetch(url, config);
    var controller = new AbortController();
    var timeoutRef = setTimeout(function () {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, Object.assign({}, config, { signal: controller.signal }));
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutRef);
    }
  }

  async function http(path, options) {
    var config = options || {};
    var method = config.method || 'GET';
    var headers = Object.assign({}, config.headers || {});
    var body = config.body;

    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      var token = await ensureCsrfToken();
      headers['x-csrf-token'] = token;
    }

    if (body && !(body instanceof FormData)) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(body);
    }

    var response = await fetchWithTimeout(API_BASE + path, {
      method: method,
      headers: headers,
      body: body,
      credentials: 'include'
    });

    var data;
    try {
      data = await response.json();
    } catch (_error) {
      throw new Error('Invalid server response');
    }

    if (!response.ok || !data.success) {
      throw normalizeError(data, response.status);
    }
    return data.data;
  }

  function mapStudent(item) {
    var status = String(item.status || '').toUpperCase();
    return {
      id: Number(item.id),
      studentId: item.studentId || item.lrn || '',
      firstName: item.firstName || '',
      lastName: item.lastName || '',
      batchYear: Number(item.batchYear) || Number(formatDate(item.createdAt).slice(0, 4)) || 0,
      gradeLevel: item.gradeLevel || 'N/A',
      section: item.section || 'N/A',
      disabilityType: item.disabilityType || 'N/A',
      status: status === 'ARCHIVED' || status === 'INACTIVE' ? 'ARCHIVED' : 'ACTIVE',
      createdAt: item.createdAt || null
    };
  }

  function mapDocument(item) {
    return {
      id: Number(item.id),
      studentId: Number(item.studentId),
      originalName: item.originalName || 'Document',
      filePath: item.filePath || '',
      mimeType: item.mimeType || 'application/octet-stream',
      fileSize: Number(item.fileSize) || 0,
      uploadedBy: Number(item.uploadedBy) || 0,
      createdAt: item.createdAt || null
    };
  }

  function mapUser(item) {
    var role = String(item.role || '').toUpperCase();
    return {
      id: Number(item.id),
      name: item.name || 'Unknown',
      email: item.email || '',
      role: role === 'ADMIN' ? 'ADMIN' : 'TEACHER',
      createdAt: item.createdAt || null
    };
  }

  function mapLog(item) {
    var rawTime = item.timestamp || item.createdAt || item.created_at || item.time || '';
    return {
      time: formatDate(rawTime),
      actor: item.userName || item.user_name || item.name || 'System',
      userName: item.userName || item.user_name || item.name || 'System',
      action: item.action || 'N/A',
      target: item.entityId || item.entity_id || item.entityType || item.entity_type || '-',
      entityType: item.entityType || item.entity_type || 'UNKNOWN'
    };
  }

  function mockData() {
    return window.ArchiviaData || { students: [], documents: [], users: [], logs: [] };
  }

  function parseStoredUser() {
    try {
      return JSON.parse(sessionStorage.getItem(MOCK_USER_KEY) || 'null');
    } catch (_error) {
      return null;
    }
  }

  function storeUser(user) {
    sessionStorage.setItem(MOCK_USER_KEY, JSON.stringify(user));
  }

  function clearUser() {
    sessionStorage.removeItem(MOCK_USER_KEY);
  }

  function mockLogin(email, password) {
    var cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !String(password || '').trim()) {
      throw new Error('Email and password are required.');
    }
    var users = mockData().users || [];
    var user = users.find(function (item) {
      return String(item.email || '').toLowerCase() === cleanEmail;
    });
    if (!user) {
      throw new Error('Invalid credentials.');
    }
    user = mapUser(user);
    storeUser(user);
    return user;
  }

  function mockMe() {
    var user = parseStoredUser();
    if (!user) throw new Error('Session expired. Please log in again.');
    return user;
  }

  async function withRetry(fn, retries) {
    var count = typeof retries === 'number' ? retries : 2;
    var lastError;
    for (var i = 0; i <= count; i += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  if (USE_MOCK) {
    window.ArchiviaApi = {
      login: async function (email, password) {
        return mockLogin(email, password);
      },
      logout: async function () {
        clearUser();
      },
      me: async function () {
        return mockMe();
      },
      getStudents: async function () {
        return (mockData().students || []).map(mapStudent);
      },
      getDocuments: async function () {
        return (mockData().documents || []).map(mapDocument);
      },
      getTeachers: async function () {
        return (mockData().users || []).map(mapUser).filter(function (item) {
          return item.role === 'TEACHER';
        });
      },
      getLogs: async function () {
        return (mockData().logs || []).slice();
      },
      withRetry: withRetry
    };
    return;
  }

  window.ArchiviaApi = {
    login: function (email, password) {
      return http('/auth/login', {
        method: 'POST',
        body: { email: email, password: password }
      });
    },
    logout: function () {
      return http('/auth/logout', { method: 'POST' });
    },
    me: function () {
      return http('/auth/me');
    },
    getStudents: async function () {
      var items = await http('/students?page=1&limit=200');
      return items.map(mapStudent);
    },
    getDocuments: async function () {
      var students = await http('/students?page=1&limit=200');
      var docBatches = await Promise.all(students.map(function (student) {
        return http('/documents/' + encodeURIComponent(student.id));
      }));
      var allDocs = docBatches.reduce(function (acc, batch) {
        return acc.concat(batch || []);
      }, []);
      return allDocs.map(mapDocument);
    },
    getTeachers: async function () {
      var users = await http('/users?role=TEACHER');
      return users.map(mapUser).filter(function (item) {
        return item.role === 'TEACHER';
      });
    },
    getLogs: async function () {
      var items = await http('/logs?page=1&limit=200');
      return items.map(mapLog);
    },
    withRetry: withRetry
  };
})();

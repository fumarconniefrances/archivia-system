(() => {
  const REQUEST_TIMEOUT_MS = Number(window.ARCHIVIA_API_TIMEOUT_MS) > 0 ? Number(window.ARCHIVIA_API_TIMEOUT_MS) : 10000;
  const API_BASE = '/api';

  function normalizeError(payload, fallbackStatus) {
    if (!payload || typeof payload !== 'object') {
      return new Error('Request failed');
    }
    const message = payload.message || 'Request failed';
    const error = new Error(message);
    error.code = payload.code || 'REQUEST_ERROR';
    error.status = fallbackStatus || 400;
    return error;
  }

  async function fetchWithTimeout(url, options) {
    const config = options || {};
    if (!window.AbortController) return fetch(url, config);
    const controller = new AbortController();
    const timeoutRef = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, Object.assign({}, config, { signal: controller.signal }));
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('Request timed out');
      throw error;
    } finally {
      clearTimeout(timeoutRef);
    }
  }

  async function http(path, options) {
    const config = options || {};
    let body = config.body;
    const headers = Object.assign({}, config.headers || {});

    if (body && !(body instanceof FormData)) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(body);
    }

    const response = await fetchWithTimeout(API_BASE + path, {
      method: config.method || 'GET',
      headers,
      body,
      credentials: 'include'
    });

    let data;
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
    return {
      id: Number(item.id),
      studentId: item.student_id || item.studentId || item.lrn || '',
      firstName: item.first_name || item.firstName || '',
      lastName: item.last_name || item.lastName || '',
      sex: item.sex || item.gender || '',
      batchYear: Number(item.batch_year || item.batchYear) || 0,
      gradeLevel: item.grade_level || item.gradeLevel || 'N/A',
      section: item.section || 'N/A',
      createdAt: item.created_at || item.createdAt || null
    };
  }

  function mapDocument(item) {
    return {
      id: Number(item.id),
      studentId: Number(item.student_id || item.studentId),
      originalName: item.original_name || item.originalName || 'Document',
      filePath: item.file_path || item.filePath || '',
      mimeType: item.mime_type || item.mimeType || 'application/octet-stream',
      fileSize: Number(item.file_size || item.fileSize) || 0,
      uploadedBy: Number(item.uploaded_by || item.uploadedBy) || 0,
      createdAt: item.created_at || item.createdAt || null
    };
  }

  function mapUser(item) {
    return {
      id: Number(item.id),
      name: item.name || 'Unknown',
      email: item.email || '',
      role: item.role || '',
      department: item.department || '',
      createdAt: item.created_at || item.createdAt || null
    };
  }

  function mapLog(item) {
    return {
      time: item.created_at || item.createdAt || item.time || '',
      actor: item.user_name || item.userName || item.name || 'System',
      userName: item.user_name || item.userName || item.name || 'System',
      action: item.action || 'N/A',
      target: item.entity_id || item.entityId || item.entityType || '-',
      entityType: item.entity_type || item.entityType || 'UNKNOWN'
    };
  }

  async function withRetry(fn, retries) {
    const count = typeof retries === 'number' ? retries : 2;
    let lastError;
    for (let i = 0; i <= count; i += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  window.ArchiviaApi = {
    login(email, password) {
      return http('/auth.php?action=login', { method: 'POST', body: { email, password } });
    },
    logout() {
      return http('/auth.php?action=logout', { method: 'POST' });
    },
    me() {
      return http('/auth.php?action=me');
    },
    getStudents(params) {
      const query = params ? new URLSearchParams(params).toString() : '';
      return http('/students.php' + (query ? `?${query}` : '')).then(items => items.map(mapStudent));
    },
    createStudent(payload) {
      return http('/students.php', { method: 'POST', body: payload });
    },
    updateStudent(payload) {
      return http('/students.php', { method: 'PUT', body: payload });
    },
    deleteStudent(id) {
      return http(`/students.php?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    getDocuments(params) {
      const query = params ? new URLSearchParams(params).toString() : '';
      return http('/documents.php' + (query ? `?${query}` : '')).then(items => items.map(mapDocument));
    },
    uploadDocument(formData) {
      return http('/documents.php', { method: 'POST', body: formData });
    },
    getTeachers() {
      return http('/teachers.php').then(items => items.map(mapUser));
    },
    addTeacher(payload) {
      return http('/teachers.php', { method: 'POST', body: payload });
    },
    getLogs() {
      return http('/logs.php').then(items => items.map(mapLog));
    },
    withRetry
  };
})();

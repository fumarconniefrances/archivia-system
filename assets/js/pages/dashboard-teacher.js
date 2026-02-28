document.addEventListener('DOMContentLoaded', async function () {
  var searchInput = document.getElementById('globalSearch');
  var allStudents = [];
  var allDocs = [];

  function getStudentYear(student) {
    if (typeof student.batchYear === 'number' && student.batchYear >= 1988) return student.batchYear;
    var raw = student.createdAt || '';
    var year = Number(String(raw).slice(0, 4)) || 0;
    return year >= 1988 ? year : 0;
  }

  function filterStudents(students, query) {
    if (!query) return students.slice();
    var text = String(query || '').trim().toLowerCase();
    if (!text) return students.slice();
    var yearMatch = parseSchoolYear(text);
    return students.filter(function (student) {
      var name = [student.firstName, student.lastName].filter(Boolean).join(' ').toLowerCase();
      var batchYear = getStudentYear(student);
      if (yearMatch >= 1988) return batchYear === yearMatch;
      return name.includes(text);
    });
  }

  function parseSchoolYear(value) {
    var text = String(value || '').toLowerCase();
    var match = text.match(/(\d{4})\s*-\s*\d{4}/) || text.match(/(\d{4})/);
    return match ? Number(match[1]) : 0;
  }

  function filterDocsByStudents(docs, students) {
    if (!students.length) return [];
    var idSet = new Set(students.map(function (s) { return s.id; }));
    return docs.filter(function (doc) {
      return idSet.has(doc.studentId);
    });
  }

  function renderTeacherState(students, documents) {
    var root = document.getElementById('teacherState');
    if (!root) return;
    var today = new Date().toLocaleString();
    root.innerHTML = '';
    var title = window.ArchiviaUI.createElement('h2', '', 'Session State');
    root.appendChild(title);
    var wrap = window.ArchiviaUI.createElement('div', 'state-grid table-top-gap');
    [
      'Role Permissions: Read-Only',
      'Assigned Data: ' + students.length + ' students / ' + documents.length + ' documents',
      'Last Refreshed: ' + today
    ].forEach(function (text) {
      wrap.appendChild(window.ArchiviaUI.createElement('div', 'state-chip', text));
    });
    root.appendChild(wrap);
  }

  function renderDashboard(students, documents) {
    var pendingDocs = 0;
    var studentsSorted = students.slice().sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    renderTeacherState(students, documents);

    window.ArchiviaUI.renderMetricCards('#teacherMetrics', [
      { title: 'Assigned Students', value: students.length, hint: 'Profiles currently available to you' },
      { title: 'Documents Available', value: documents.length, hint: 'Accessible supporting records' },
      { title: 'Pending Reviews', value: pendingDocs, hint: 'Items requiring attention today' },
      { title: 'Read-only Access', value: 'Enabled', hint: 'Edit actions are intentionally restricted' }
    ]);

    window.ArchiviaUI.renderRows('#teacherStudentBody', studentsSorted, [
      { key: 'studentId' },
      {
        key: 'firstName',
        render: function (row) {
          var fullName = [row.firstName, row.lastName].filter(Boolean).join(' ');
          var photo = row.photoData || '';
          return window.ArchiviaUI.createPersonCell(fullName, photo, false);
        }
      },
      { key: 'gradeLevel' },
      { key: 'section' },
      {
        key: 'createdAt',
        render: function (row) {
          return new Date(row.createdAt).toLocaleDateString();
        }
      },
      {
        key: 'id',
        render: function (row) {
          return window.ArchiviaUI.createActionLinkButton('View', 'student-profile.html?id=' + encodeURIComponent(row.id));
        }
      }
    ], 'No assigned students found.');

    var alerts = [
      '2 student profiles were updated by admin today.',
      pendingDocs + ' documents are pending teacher review.',
      'Audit logging is active for all viewed records.'
    ];
    var alertRoot = document.getElementById('teacherAlerts');
    if (alertRoot) {
      alertRoot.innerHTML = '';
      alerts.forEach(function (item) {
        var row = document.createElement('div');
        row.className = 'detail-item';
        row.textContent = item;
        alertRoot.appendChild(row);
      });
    }
  }

  function applySearch() {
    var query = searchInput ? searchInput.value : '';
    var filteredStudents = filterStudents(allStudents, query);
    var filteredDocs = filterDocsByStudents(allDocs, filteredStudents);
    renderDashboard(filteredStudents, filteredDocs);
  }

  async function load() {
    window.ArchiviaUI.clearPageError();
    try {
      allStudents = await window.ArchiviaApi.withRetry(function () {
        return window.ArchiviaApi.getStudents();
      }, 1);

      allDocs = await window.ArchiviaApi.withRetry(function () {
        return window.ArchiviaApi.getDocuments();
      }, 1);
      applySearch();
    } catch (error) {
      window.ArchiviaUI.showPageError(error.message, load);
    }
  }

  if (searchInput) searchInput.addEventListener('input', applySearch);
  await load();
});

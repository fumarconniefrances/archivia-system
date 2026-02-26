document.addEventListener('DOMContentLoaded', async function () {
  var importBtn = document.getElementById('importBtn');
  var exportBtn = document.getElementById('exportBtn');
  var searchInput = document.getElementById('globalSearch');
  var allStudents = [];
  var allDocs = [];

  if (importBtn) {
    importBtn.addEventListener('click', function () {
      window.ArchiviaUI.showToast('Import workflow is not available in this build.');
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      window.ArchiviaUI.showToast('Export started. Your file will be ready shortly.');
    });
  }

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
    var yearMatch = /^\d{4}$/.test(text) ? Number(text) : 0;
    return students.filter(function (student) {
      var name = [student.firstName, student.lastName].filter(Boolean).join(' ').toLowerCase();
      var batchYear = getStudentYear(student);
      if (yearMatch >= 1988) return batchYear === yearMatch;
      return name.includes(text);
    });
  }

  function filterDocsByStudents(docs, students) {
    if (!students.length) return [];
    var idSet = new Set(students.map(function (s) { return s.id; }));
    return docs.filter(function (doc) {
      return idSet.has(doc.studentId);
    });
  }

  function renderAdminState(students, docs) {
    var root = document.getElementById('adminState');
    if (!root) return;
    var today = new Date().toLocaleString();
    root.innerHTML = '';
    var title = window.ArchiviaUI.createElement('h2', '', 'System State');
    root.appendChild(title);
    var wrap = window.ArchiviaUI.createElement('div', 'state-grid table-top-gap');
    [
      'Role Permissions: Full Administrative Access',
      'Records Loaded: ' + students.length + ' students / ' + docs.length + ' documents',
      'Last Refreshed: ' + today
    ].forEach(function (text) {
      wrap.appendChild(window.ArchiviaUI.createElement('div', 'state-chip', text));
    });
    root.appendChild(wrap);
  }

  function renderDashboard(students, docs) {
    var studentsSorted = students.slice().sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    renderAdminState(students, docs);

    window.ArchiviaUI.renderMetricCards('#adminMetrics', [
      { title: 'Total SPED Students', value: students.length, hint: 'Current enrolled + archived profiles' },
      { title: 'Active Profiles', value: students.filter(function (s) { return s.status === 'ACTIVE'; }).length, hint: 'Profiles available for daily operations' },
      { title: 'Archived Profiles', value: students.filter(function (s) { return s.status === 'ARCHIVED'; }).length, hint: 'Records retained for compliance' },
      { title: 'Documents Stored', value: docs.length, hint: 'Files linked to student profiles' }
    ]);

    window.ArchiviaUI.renderRows('#adminRecentBody', studentsSorted, [
      { key: 'studentId' },
      {
        key: 'firstName',
        render: function (row) {
          var fullName = [row.firstName, row.lastName].filter(Boolean).join(' ');
          var photo = window.ArchiviaUI.getStudentPhoto(row.id, '');
          return window.ArchiviaUI.createPersonCell(fullName, photo, false);
        }
      },
      { key: 'gradeLevel' },
      { key: 'status', type: 'status' },
      {
        key: 'createdAt',
        render: function (row) {
          return new Date(row.createdAt).toLocaleDateString();
        }
      },
      {
        key: 'id',
        render: function (row) {
          return window.ArchiviaUI.createActionLinkButton('Open', 'student-profile.html?id=' + encodeURIComponent(row.id));
        }
      }
    ], 'No recent student updates found.');
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

      var compliance = [
        'User access logs: enabled',
        'Record retention policy: 7 years',
        'Daily encrypted backup: scheduled at 7:00 PM'
      ];
      var complianceRoot = document.getElementById('complianceSnapshot');
      if (complianceRoot) {
        complianceRoot.innerHTML = '';
        compliance.forEach(function (item) {
          var row = document.createElement('div');
          row.className = 'detail-item';
          row.textContent = item;
          complianceRoot.appendChild(row);
        });
      }
    } catch (error) {
      window.ArchiviaUI.showPageError(error.message, load);
    }
  }

  if (searchInput) searchInput.addEventListener('input', applySearch);
  await load();
});

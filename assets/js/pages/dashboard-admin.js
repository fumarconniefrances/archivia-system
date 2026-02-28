document.addEventListener('DOMContentLoaded', async function () {
  var searchInput = document.getElementById('globalSearch');
  var allStudents = [];
  var allDocs = [];
  var allLogs = [];

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

  function getTodaysActivityCount(logs) {
    var today = new Date();
    var y = today.getFullYear();
    var m = String(today.getMonth() + 1).padStart(2, '0');
    var d = String(today.getDate()).padStart(2, '0');
    var todayKey = y + '-' + m + '-' + d;
    return logs.filter(function (entry) {
      return String(entry.time || '').indexOf(todayKey) === 0;
    }).length;
  }

  function renderDashboard(students, docs, logs) {
    var studentsSorted = students.slice().sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    var todayActivityCount = getTodaysActivityCount(logs || []);

      window.ArchiviaUI.renderMetricCards('#adminMetrics', [
        { title: 'Total SPED Students', value: students.length, hint: 'Current enrolled profiles' },
        { title: 'School Years', value: Array.from(new Set(students.map(getStudentYear).filter(function (y) { return y >= 1988; }))).length, hint: 'Available batch years' },
        { title: 'Documents Stored', value: docs.length, hint: 'Files linked to student profiles' },
        { title: "Today's Activity", value: todayActivityCount, hint: 'Audit events recorded today' }
      ]);

    window.ArchiviaUI.renderRows('#adminRecentBody', studentsSorted, [
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
    renderDashboard(filteredStudents, filteredDocs, allLogs);
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
      try {
        var logsPayload = await window.ArchiviaApi.withRetry(function () {
          return window.ArchiviaApi.getLogs({ page: 1, limit: 200 });
        }, 1);
        allLogs = Array.isArray(logsPayload && logsPayload.items) ? logsPayload.items : [];
      } catch (_logsError) {
        allLogs = [];
      }
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

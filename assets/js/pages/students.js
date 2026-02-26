document.addEventListener('DOMContentLoaded', async function () {
  var searchInput = document.getElementById('globalSearch');
  var loading = document.getElementById('studentsLoading');
  var all = [];

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
    return students.filter(function (row) {
      var name = [row.firstName, row.lastName].filter(Boolean).join(' ').toLowerCase();
      var batchYear = getStudentYear(row);
      if (yearMatch >= 1988) return batchYear === yearMatch;
      return name.includes(text);
    });
  }

  function draw() {
    var keyword = searchInput ? searchInput.value : '';
    var filtered = filterStudents(all, keyword);

    window.ArchiviaUI.renderRows('#studentTableBody', filtered, [
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
      { key: 'section' },
      { key: 'disabilityType' },
      { key: 'status', type: 'status' },
      {
        key: 'id',
        render: function (row) {
          return window.ArchiviaUI.createActionLinkButton('Open Profile', 'student-profile.html?id=' + encodeURIComponent(row.id));
        }
      }
    ], 'No student records match the selected filters.');
  }

  async function load() {
    window.ArchiviaUI.clearPageError();
    loading.classList.remove('hidden');
    window.ArchiviaUI.showSkeleton('#studentSummary', 3);
    try {
      all = await window.ArchiviaApi.withRetry(function () {
        return window.ArchiviaApi.getStudents();
      }, 1);
      window.ArchiviaUI.renderMetricCards('#studentSummary', [
        { title: 'Total Records', value: all.length },
        { title: 'Active Profiles', value: all.filter(function (s) { return s.status === 'ACTIVE'; }).length },
        { title: 'Archived Profiles', value: all.filter(function (s) { return s.status === 'ARCHIVED'; }).length }
      ]);
      draw();
      loading.classList.add('hidden');
    } catch (error) {
      loading.classList.add('hidden');
      window.ArchiviaUI.showPageError(error.message, load);
    }
  }

  if (searchInput) searchInput.addEventListener('input', draw);
  document.getElementById('addStudentBtn').addEventListener('click', function () {
    window.ArchiviaUI.showToast('Create student workflow is not available in this build.');
  });

  await load();
});

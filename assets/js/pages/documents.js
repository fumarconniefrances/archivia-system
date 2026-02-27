document.addEventListener('DOMContentLoaded', async function () {
  var searchInput = document.getElementById('globalSearch');
  var docArchiveBody = document.getElementById('docArchiveBody');
  var docSummary = document.getElementById('docSummary');
  var all = [];
  var students = [];

  function buildArchiveRows(list) {
    if (!docArchiveBody) return;
    docArchiveBody.innerHTML = '';
    if (!list.length) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 5;
      td.appendChild(window.ArchiviaUI.createElement('div', 'empty-state', 'No documents found.'));
      tr.appendChild(td);
      docArchiveBody.appendChild(tr);
      return;
    }

    list.forEach(function (row) {
      var tr = document.createElement('tr');
      var tdStudentId = document.createElement('td');
      tdStudentId.textContent = row.studentId || '-';
      var tdName = document.createElement('td');
      tdName.textContent = row.name || '';
      var tdTotal = document.createElement('td');
      tdTotal.textContent = String(row.totalDocs);
      var tdAction = document.createElement('td');
      tdAction.appendChild(window.ArchiviaUI.createActionLinkButton('Open Profile', 'student-profile.html?id=' + encodeURIComponent(row.id)));
      tr.appendChild(tdStudentId);
      tr.appendChild(tdName);
      tr.appendChild(tdTotal);
      tr.appendChild(tdAction);
      docArchiveBody.appendChild(tr);
    });
  }

  function draw() {
    var keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var yearMatch = parseSchoolYear(keyword);
    var rows = students.map(function (student) {
      var studentDocs = all.filter(function (doc) { return doc.studentId === student.id; });
      return {
        id: student.id,
        studentId: student.studentId || '',
        name: [student.firstName, student.lastName].filter(Boolean).join(' '),
        batchYear: student.batchYear || 0,
        totalDocs: studentDocs.length
      };
    });

    var filtered = rows.filter(function (row) {
      if (!keyword) return true;
      if (yearMatch >= 1988) return Number(row.batchYear) === yearMatch;
      var name = String(row.name || '').toLowerCase();
      return name.includes(keyword) || String(row.studentId || '').toLowerCase().includes(keyword);
    });

    buildArchiveRows(filtered);
  }

  async function load() {
    window.ArchiviaUI.clearPageError();
    window.ArchiviaUI.showSkeleton('#docSummary', 3);
    try {
      var docs = await window.ArchiviaApi.withRetry(function () {
        return window.ArchiviaApi.getDocuments();
      }, 1);
      var studentList = await window.ArchiviaApi.withRetry(function () {
        return window.ArchiviaApi.getStudents();
      }, 1);
      all = docs;
      students = studentList;
      if (docSummary) {
        window.ArchiviaUI.renderMetricCards('#docSummary', [
          { title: 'Total Documents', value: all.length },
          { title: 'Profiles with Documents', value: Array.from(new Set(all.map(function (d) { return d.studentId; }))).length }
        ]);
      }
      draw();
    } catch (error) {
      window.ArchiviaUI.showPageError(error.message, load);
    }
  }

  if (searchInput) searchInput.addEventListener('input', draw);
  await load();
});
  function parseSchoolYear(value) {
    var text = String(value || '').toLowerCase();
    var match = text.match(/(\d{4})\s*-\s*\d{4}/) || text.match(/(\d{4})/);
    return match ? Number(match[1]) : 0;
  }

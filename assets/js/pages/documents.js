document.addEventListener('DOMContentLoaded', async function () {
  var searchInput = document.getElementById('globalSearch');
  var all = [];
  var students = [];

  function bindViewButtons() {
    window.ArchiviaUI.qsa('[data-view-doc]').forEach(function (button) {
      button.addEventListener('click', function () {
        var id = Number(button.getAttribute('data-view-doc'));
        var doc = all.find(function (item) { return item.id === id; });
        document.getElementById('viewerDocName').textContent = doc ? doc.originalName : String(id);
        window.ArchiviaUI.openModal('#documentViewerModal');
      });
    });
  }

  function draw() {
    var keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var yearMatch = /^\d{4}$/.test(keyword) ? Number(keyword) : 0;
    var filtered = all.filter(function (row) {
      var student = students.find(function (s) { return s.id === row.studentId; });
      var studentName = student ? [student.firstName, student.lastName].filter(Boolean).join(' ').toLowerCase() : '';
      var batchYear = student && typeof student.batchYear === 'number' ? student.batchYear : 0;
      var matchKeyword = !keyword;
      if (yearMatch >= 1988) {
        matchKeyword = batchYear === yearMatch;
      } else {
        matchKeyword = studentName.includes(keyword) || String(row.originalName || '').toLowerCase().includes(keyword);
      }
      return matchKeyword;
    });

    window.ArchiviaUI.renderRows('#docTableBody', filtered, [
      { key: 'id' },
      { key: 'studentId' },
      { key: 'originalName' },
      { key: 'mimeType' },
      {
        key: 'createdAt',
        render: function (row) {
          return new Date(row.createdAt).toLocaleDateString();
        }
      },
      {
        key: 'id',
        render: function (row) {
          return row.filePath ? 'Stored' : 'Missing';
        }
      },
      {
        key: 'id',
        render: function (row) {
          return window.ArchiviaUI.createActionButton('View', 'btn btn-secondary', { 'data-view-doc': row.id });
        }
      }
    ], 'No documents match the selected filters.');

    bindViewButtons();
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
      window.ArchiviaUI.renderMetricCards('#docSummary', [
        { title: 'Total Documents', value: all.length },
        { title: 'Total File Size', value: all.reduce(function (sum, item) { return sum + (item.fileSize || 0); }, 0) + ' B' },
        { title: 'PDF Files', value: all.filter(function (d) { return d.mimeType === 'application/pdf'; }).length }
      ]);
      draw();
    } catch (error) {
      window.ArchiviaUI.showPageError(error.message, load);
    }
  }

  if (searchInput) searchInput.addEventListener('input', draw);
  document.getElementById('uploadDocBtn').addEventListener('click', function () {
    window.ArchiviaUI.showToast('Document upload queued.');
  });

  await load();
});

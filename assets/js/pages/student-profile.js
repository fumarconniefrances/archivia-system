document.addEventListener('DOMContentLoaded', async function () {
  var query = new URLSearchParams(window.location.search);
  var id = Number(query.get('id')) || 0;

  function renderProfileCard(student) {
    var profileCard = document.getElementById('profileCard');
    profileCard.innerHTML = '';

    var fullName = [student.firstName, student.lastName].filter(Boolean).join(' ');
    var photo = window.ArchiviaUI.getStudentPhoto(student.id, '');
    profileCard.appendChild(window.ArchiviaUI.createPhotoVisual(photo, fullName, true));
    profileCard.appendChild(window.ArchiviaUI.createElement('h2', 'table-top-gap', fullName));
    profileCard.appendChild(window.ArchiviaUI.createElement('p', 'muted', student.studentId));

    var actions = window.ArchiviaUI.createElement('div', 'profile-photo-actions');
    var input = window.ArchiviaUI.createElement('input', 'hidden');
    input.id = 'studentPhotoInput';
    input.type = 'file';
    input.accept = 'image/*';
    actions.appendChild(input);
    actions.appendChild(window.ArchiviaUI.createActionButton('Upload Picture', 'btn btn-secondary', { id: 'uploadStudentPhotoBtn' }));
    actions.appendChild(window.ArchiviaUI.createActionButton('Remove Picture', 'btn btn-danger', { id: 'removeStudentPhotoBtn' }));
    profileCard.appendChild(actions);
  }

  function renderDetails(student) {
    var details = [
      ['Grade', student.gradeLevel],
      ['School Year', formatSchoolYear(student.batchYear)],
      ['Section', student.section],
      ['Created At', new Date(student.createdAt).toLocaleString()]
    ];
    var detailRoot = document.getElementById('profileDetails');
    detailRoot.innerHTML = '';
    details.forEach(function (item) {
      var box = window.ArchiviaUI.createElement('div', 'detail-item');
      box.appendChild(window.ArchiviaUI.createElement('p', 'muted', item[0]));
      var value = window.ArchiviaUI.createElement('p');
      var strong = window.ArchiviaUI.createElement('strong', '', item[1]);
      value.appendChild(strong);
      box.appendChild(value);
      detailRoot.appendChild(box);
    });
  }

  async function load() {
    window.ArchiviaUI.clearPageError();
    window.ArchiviaUI.showSkeleton('#profileSummary', 3);
    try {
      var students = await window.ArchiviaApi.withRetry(function () {
        return window.ArchiviaApi.getStudents();
      }, 1);
      var docsAll = await window.ArchiviaApi.withRetry(function () {
        return window.ArchiviaApi.getDocuments();
      }, 1);

      if (!students.length) {
        window.ArchiviaUI.renderMetricCards('#profileSummary', [
          { title: 'Documents Linked', value: 0 },
          { title: 'Total File Size', value: '0 B' },
          { title: 'Profile Status', value: 'N/A' }
        ]);
        window.ArchiviaUI.renderRows('#profileDocsBody', [], [
          { key: 'id' },
          { key: 'originalName' },
          { key: 'mimeType' },
          { key: 'uploadedBy' },
          { key: 'id' },
          { key: 'id' }
        ], 'No documents available for this student.');
        window.ArchiviaUI.showPageError('No student records are available.');
        return;
      }

      var student = students.find(function (s) { return s.id === id; }) || students[0];
      renderProfileCard(student);
      renderDetails(student);

      var docs = docsAll.filter(function (d) { return d.studentId === student.id; });
      window.ArchiviaUI.renderMetricCards('#profileSummary', [
        { title: 'Documents Linked', value: docs.length },
        { title: 'Total File Size', value: docs.reduce(function (sum, item) { return sum + (item.fileSize || 0); }, 0) + ' B' }
      ]);

      window.ArchiviaUI.renderRows('#profileDocsBody', docs, [
        { key: 'id' },
        { key: 'originalName' },
        { key: 'mimeType' },
        { key: 'uploadedBy' },
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
      ], 'No documents available for this student.');

      window.ArchiviaUI.qsa('[data-view-doc]').forEach(function (button) {
        button.addEventListener('click', function () {
          var docId = Number(button.getAttribute('data-view-doc'));
          var doc = docs.find(function (item) { return item.id === docId; });
          var label = doc ? doc.originalName : String(docId);
          var target = document.getElementById('profileViewerDocName');
          if (target) target.textContent = label;
          window.ArchiviaUI.openModal('#profileDocViewerModal');
        });
      });

      document.getElementById('editProfileBtn').onclick = function () {
        document.getElementById('profileFirstName').value = student.firstName;
        document.getElementById('profileLastName').value = student.lastName;
        document.getElementById('profileBatchYear').value = formatSchoolYear(student.batchYear);
        document.getElementById('profileGradeLevel').value = student.gradeLevel;
        window.ArchiviaUI.openModal('#editProfileModal');
      };

      document.getElementById('saveProfileBtn').onclick = function () {
        window.ArchiviaUI.closeModal('#editProfileModal');
        window.ArchiviaUI.showToast('Profile changes saved.');
      };

      document.getElementById('uploadProfileDocBtn').onclick = function () {
        var input = document.getElementById('profileDocInput');
        if (input) input.click();
      };

      var docInput = document.getElementById('profileDocInput');
      if (docInput) {
        docInput.onchange = function (event) {
          var file = event.target.files && event.target.files[0];
          if (!file) return;
          var formData = new FormData();
          formData.append('student_id', String(student.id));
          formData.append('file', file);
          window.ArchiviaApi.uploadDocument(formData).then(function () {
            window.ArchiviaUI.showToast('Document uploaded to this student profile.');
            docInput.value = '';
            load();
          }).catch(function (error) {
            window.ArchiviaUI.showToast(error.message || 'Upload failed.');
          });
        };
      }

      document.getElementById('uploadStudentPhotoBtn').onclick = function () {
        document.getElementById('studentPhotoInput').click();
      };

      document.getElementById('studentPhotoInput').onchange = function (event) {
        var file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
          window.ArchiviaUI.showToast('Please select an image file.');
          return;
        }
        var reader = new FileReader();
        reader.onload = function (e) {
          window.ArchiviaUI.setStudentPhoto(student.id, e.target.result);
          window.ArchiviaUI.showToast('Student photo uploaded.');
          load();
        };
        reader.readAsDataURL(file);
      };

      document.getElementById('removeStudentPhotoBtn').onclick = function () {
        window.ArchiviaUI.clearStudentPhoto(student.id);
        window.ArchiviaUI.showToast('Student photo removed.');
        load();
      };
    } catch (error) {
      window.ArchiviaUI.showPageError(error.message, load);
    }
  }

  await load();
});
  function formatSchoolYear(value) {
    var year = 0;
    if (typeof value === 'number') year = value;
    if (typeof value === 'string') {
      var match = value.match(/(\d{4})/);
      year = match ? Number(match[1]) : 0;
    }
    if (year < 1988) return '-';
    return 'SY ' + year + '-' + (year + 1);
  }

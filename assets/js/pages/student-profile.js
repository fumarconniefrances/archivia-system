document.addEventListener('DOMContentLoaded', async function () {
  var query = new URLSearchParams(window.location.search);
  var id = Number(query.get('id')) || 0;
  var currentRole = window.ArchiviaUI.getCurrentRole ? window.ArchiviaUI.getCurrentRole() : '';
  var activeDoc = null;

  function getDocPreviewUrl(docId) {
    if (window.ArchiviaApi && typeof window.ArchiviaApi.getDocumentPreviewUrl === 'function') {
      return window.ArchiviaApi.getDocumentPreviewUrl(docId);
    }
    return 'api/documents.php?action=preview&id=' + encodeURIComponent(docId);
  }

  function getDocExportPdfUrl(docId) {
    if (window.ArchiviaApi && typeof window.ArchiviaApi.getDocumentExportPdfUrl === 'function') {
      return window.ArchiviaApi.getDocumentExportPdfUrl(docId);
    }
    return 'api/documents.php?action=export_pdf&id=' + encodeURIComponent(docId);
  }

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
    var gradYear = Number(student.batchYear) || 0;
    var yearsSinceGraduation = gradYear >= 1900 ? Math.max(0, (new Date().getFullYear() - gradYear)) : 0;
    var details = [
      ['Grade', student.gradeLevel],
      ['Adviser', student.adviserName || '-'],
      ['School Year', formatSchoolYear(student.batchYear)],
      ['Years Since Graduation', gradYear >= 1900 ? String(yearsSinceGraduation) + ' year(s)' : '-'],
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

      var fallbackStudent = students.find(function (s) { return s.id === id; }) || students[0];
      var student = fallbackStudent;
      if (fallbackStudent && fallbackStudent.id) {
        try {
          student = await window.ArchiviaApi.withRetry(function () {
            return window.ArchiviaApi.getStudent(fallbackStudent.id);
          }, 1);
        } catch (_studentError) {
          student = fallbackStudent;
        }
      }
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
            return window.ArchiviaUI.createActionButton('Preview', 'btn btn-secondary', { 'data-view-doc': row.id });
          }
        }
      ], 'No documents available for this student.');

      var previewFrame = document.getElementById('profileDocPreviewFrame');
      var requestCopyBtn = document.getElementById('profileRequestCopyBtn');
      var exportDocBtn = document.getElementById('profileExportDocBtn');
      if (requestCopyBtn) requestCopyBtn.classList.toggle('hidden', currentRole === 'admin');
      if (exportDocBtn) exportDocBtn.classList.toggle('hidden', currentRole !== 'admin');

      window.ArchiviaUI.qsa('[data-view-doc]').forEach(function (button) {
        button.addEventListener('click', function () {
          var docId = Number(button.getAttribute('data-view-doc'));
          var doc = docs.find(function (item) { return item.id === docId; });
          var label = doc ? doc.originalName : String(docId);
          activeDoc = doc || null;
          var target = document.getElementById('profileViewerDocName');
          if (target) target.textContent = label;
          if (previewFrame) {
            previewFrame.src = activeDoc ? getDocPreviewUrl(activeDoc.id) : 'about:blank';
          }
          window.ArchiviaUI.openModal('#profileDocViewerModal');
        });
      });

      if (requestCopyBtn) {
        requestCopyBtn.onclick = function () {
          if (!activeDoc) {
            window.ArchiviaUI.showToast('Select a document preview first.');
            return;
          }
          window.ArchiviaUI.showToast('Copy request submitted. Please coordinate with admin for PDF export.');
        };
      }

      if (exportDocBtn) {
        exportDocBtn.onclick = function () {
          if (!activeDoc) {
            window.ArchiviaUI.showToast('Select a document preview first.');
            return;
          }
          window.open(getDocExportPdfUrl(activeDoc.id), '_blank', 'noopener');
        };
      }

      document.getElementById('editProfileBtn').onclick = function () {
        document.getElementById('profileFirstName').value = student.firstName;
        document.getElementById('profileLastName').value = student.lastName;
        document.getElementById('profileBatchYear').value = formatSchoolYear(student.batchYear);
        document.getElementById('profileGradeLevel').value = student.gradeLevel;
        window.ArchiviaUI.openModal('#editProfileModal');
      };

      document.getElementById('saveProfileBtn').onclick = function () {
        var firstNameInput = document.getElementById('profileFirstName');
        var lastNameInput = document.getElementById('profileLastName');
        var batchYearInput = document.getElementById('profileBatchYear');
        var gradeLevelInput = document.getElementById('profileGradeLevel');

        var firstName = firstNameInput ? firstNameInput.value.trim() : '';
        var lastName = lastNameInput ? lastNameInput.value.trim() : '';
        var parsedYear = parseSchoolYearToStartYear(batchYearInput ? batchYearInput.value : '');
        var gradeLevel = gradeLevelInput ? gradeLevelInput.value.trim() : '';

        if (!firstName || !lastName || !gradeLevel || parsedYear < 1988) {
          window.ArchiviaUI.showToast('Please provide valid profile details.');
          return;
        }

        window.ArchiviaApi.updateStudent({
          id: student.id,
          student_id: student.studentId,
          first_name: firstName,
          last_name: lastName,
          sex: String(student.sex || '').toUpperCase(),
          batch_year: parsedYear,
          grade_level: gradeLevel,
          section: student.section || ''
        }).then(function () {
          window.ArchiviaUI.closeModal('#editProfileModal');
          window.ArchiviaUI.showToast('Profile changes saved to database.');
          load();
        }).catch(function (error) {
          window.ArchiviaUI.showToast(error.message || 'Failed to save profile.');
        });
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

function parseSchoolYearToStartYear(value) {
  var text = String(value || '').toLowerCase();
  var match = text.match(/(\d{4})\s*-\s*\d{4}/) || text.match(/(\d{4})/);
  return match ? Number(match[1]) : 0;
}

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

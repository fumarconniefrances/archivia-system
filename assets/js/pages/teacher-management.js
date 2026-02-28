document.addEventListener('DOMContentLoaded', async function () {
  var searchInput = document.getElementById('globalSearch');
  var userHasTypedSearch = false;
  function clearSearchInput() {
    if (!searchInput || userHasTypedSearch) return;
    searchInput.value = '';
  }
  clearSearchInput();
  // Some browsers restore autofill/text on refresh or bfcache navigation.
  window.addEventListener('pageshow', clearSearchInput);
  [0, 80, 250, 600, 1200].forEach(function (delay) {
    setTimeout(clearSearchInput, delay);
  });
  var all = [];
  var selectedTeacherId = 0;
  var newTeacherBtn = document.getElementById('newTeacherBtn');
  var saveTeacherBtn = document.getElementById('saveTeacherBtn');
  var teacherFullNameInput = document.getElementById('teacherFullName');
  var teacherEmailInput = document.getElementById('teacherEmail');
  var teacherPasswordInput = document.getElementById('teacherPassword');
  var teacherDepartmentInput = document.getElementById('teacherDepartment');

  function photoCell(name, teacherId, fallback) {
    var photo = window.ArchiviaUI.getTeacherPhoto(teacherId, fallback);
    return window.ArchiviaUI.createPersonCell(name, photo, false);
  }

  function bindManageButtons() {
    window.ArchiviaUI.qsa('[data-manage-teacher]').forEach(function (button) {
      button.onclick = function () {
        selectedTeacherId = Number(button.getAttribute('data-manage-teacher')) || 0;
        renderTeacherPhotoPreview();
        window.ArchiviaUI.openModal('#teacherPhotoModal');
      };
    });
  }

  function renderTeacherPhotoPreview() {
    var teacher = all.find(function (t) { return t.id === selectedTeacherId; });
    var root = document.getElementById('teacherPhotoPreview');
    if (!teacher || !root) return;

    root.innerHTML = '';
    var wrap = window.ArchiviaUI.createElement('div', 'person-cell');
    var photo = window.ArchiviaUI.getTeacherPhoto(teacher.id, '');
    wrap.appendChild(window.ArchiviaUI.createPhotoVisual(photo, teacher.name, true));
    var content = window.ArchiviaUI.createElement('div');
    var nameLine = window.ArchiviaUI.createElement('p');
    nameLine.appendChild(window.ArchiviaUI.createElement('strong', '', teacher.name));
    content.appendChild(nameLine);
    content.appendChild(window.ArchiviaUI.createElement('p', 'muted', teacher.id));
    wrap.appendChild(content);
    root.appendChild(wrap);
  }

  function draw() {
    var keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var filtered = all.filter(function (row) {
      var rowName = row.name.toLowerCase();
      var rowEmail = row.email.toLowerCase();
      if (!keyword) return true;
      return rowName.includes(keyword) || rowEmail.includes(keyword);
    });

    window.ArchiviaUI.renderRows('#teacherTableBody', filtered, [
      { key: 'id' },
      {
        key: 'name',
        render: function (row) {
          return photoCell(row.name, row.id, '');
        }
      },
      { key: 'email' },
      { key: 'department' },
      {
        key: 'id',
        render: function (row) {
          return window.ArchiviaUI.createActionButton('Manage', 'btn btn-secondary', { 'data-manage-teacher': row.id });
        }
      }
    ], 'No teacher accounts match the selected filters.');

    bindManageButtons();
  }

  async function load() {
    window.ArchiviaUI.clearPageError();
    window.ArchiviaUI.showSkeleton('#teacherSummary', 3);
    try {
      all = await window.ArchiviaApi.withRetry(function () {
        return window.ArchiviaApi.getTeachers();
      }, 1);
      window.ArchiviaUI.renderMetricCards('#teacherSummary', [
        { title: 'Total Teachers', value: all.length },
        { title: 'Active Accounts', value: all.length },
        { title: 'Inactive Accounts', value: 0 }
      ]);
      draw();
    } catch (error) {
      window.ArchiviaUI.showPageError(error.message, load);
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      userHasTypedSearch = true;
      draw();
    });
    searchInput.addEventListener('focus', clearSearchInput);
  }

  if (newTeacherBtn) {
    newTeacherBtn.addEventListener('click', function () {
      window.ArchiviaUI.openModal('#addTeacherModal');
    });
  }

  if (saveTeacherBtn) {
    saveTeacherBtn.addEventListener('click', function () {
      var fullName = teacherFullNameInput ? teacherFullNameInput.value.trim() : '';
      var email = teacherEmailInput ? teacherEmailInput.value.trim() : '';
      var password = teacherPasswordInput ? teacherPasswordInput.value : '';
      var department = teacherDepartmentInput ? teacherDepartmentInput.value.trim() : '';
      if (!fullName || !email || !password || !department) {
        window.ArchiviaUI.showToast('Please complete all required fields.');
        return;
      }
      window.ArchiviaApi.withRetry(function () {
        return window.ArchiviaApi.addTeacher({
          name: fullName,
          email: email,
          password: password,
          department: department
        });
      }, 1).then(function () {
        if (teacherFullNameInput) teacherFullNameInput.value = '';
        if (teacherEmailInput) teacherEmailInput.value = '';
        if (teacherPasswordInput) teacherPasswordInput.value = '';
        if (teacherDepartmentInput) teacherDepartmentInput.value = '';
        window.ArchiviaUI.closeModal('#addTeacherModal');
        load();
        window.ArchiviaUI.showToast('Teacher record saved.');
      }).catch(function (error) {
        window.ArchiviaUI.showToast(error.message || 'Failed to save teacher.');
      });
    });
  }

  document.getElementById('uploadTeacherPhotoBtn').addEventListener('click', function () {
    document.getElementById('teacherPhotoInput').click();
  });

  document.getElementById('teacherPhotoInput').addEventListener('change', function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file || !selectedTeacherId) return;
    if (!file.type.startsWith('image/')) {
      window.ArchiviaUI.showToast('Please select an image file.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      window.ArchiviaUI.setTeacherPhoto(selectedTeacherId, e.target.result);
      window.ArchiviaUI.showToast('Teacher photo uploaded.');
      renderTeacherPhotoPreview();
      draw();
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('removeTeacherPhotoBtn').addEventListener('click', function () {
    if (!selectedTeacherId) return;
    window.ArchiviaUI.clearTeacherPhoto(selectedTeacherId);
    window.ArchiviaUI.showToast('Teacher photo removed.');
    renderTeacherPhotoPreview();
    draw();
  });

  await load();
});

document.addEventListener('DOMContentLoaded', async function () {
  var searchInput = document.getElementById('globalSearch');
  var loading = document.getElementById('studentsLoading');
  var all = [];
  var addStudentBtn = document.getElementById('addStudentBtn');
  var saveStudentBtn = document.getElementById('saveStudentBtn');
  var studentLrnInput = document.getElementById('studentLrn');
  var studentNameInput = document.getElementById('studentName');
  var studentGradeInput = document.getElementById('studentGrade');
  var studentSectionInput = document.getElementById('studentSection');
  var studentSexInput = document.getElementById('studentSex');
  var studentSchoolYearInput = document.getElementById('studentSchoolYear');
  var schoolYearSection = document.getElementById('schoolYearSection');
  var yearStudentsSection = document.getElementById('yearStudentsSection');
  var schoolYearTableBody = document.getElementById('schoolYearTableBody');
  var yearStudentsTitle = document.getElementById('yearStudentsTitle');
  var backToYearsBtn = document.getElementById('backToYearsBtn');
  var sexFilter = document.getElementById('sexFilter');
  var activeYearStudents = [];
  var yearsSet = new Set();

  function getStudentYear(student) {
    if (typeof student.batchYear === 'number' && student.batchYear >= 1988) return student.batchYear;
    if (typeof student.batchYear === 'string') {
      var parsed = parseSchoolYear(student.batchYear);
      if (parsed >= 1988) return parsed;
    }
    var raw = student.createdAt || '';
    var year = Number(String(raw).slice(0, 4)) || 0;
    return year >= 1988 ? year : 0;
  }

  function parseSchoolYear(value) {
    var text = String(value || '').toLowerCase();
    var match = text.match(/(\d{4})\s*-\s*\d{4}/) || text.match(/(\d{4})/);
    return match ? Number(match[1]) : 0;
  }

  function buildYearsSet(students) {
    yearsSet = new Set();
    students.forEach(function (student) {
      var year = getStudentYear(student);
      if (year >= 1988) yearsSet.add(year);
    });
  }

  function getSchoolYearStart(year) {
    var numericYear = Number(year) || 0;
    if (numericYear < 1988) return 0;
    if (yearsSet.has(numericYear - 1)) return numericYear - 1;
    return numericYear;
  }

  function formatSchoolYear(startYear) {
    var year = Number(startYear) || 0;
    if (year < 1988) return '-';
    return 'SY ' + year + '-' + (year + 1);
  }

  function filterStudents(students, query) {
    if (!query) return students.slice();
    var text = String(query || '').trim().toLowerCase();
    if (!text) return students.slice();
    var yearMatch = parseSchoolYear(text);
    return students.filter(function (row) {
      var name = [row.firstName, row.lastName].filter(Boolean).join(' ').toLowerCase();
      var batchYear = getStudentYear(row);
      if (yearMatch >= 1988) return batchYear === yearMatch || batchYear === yearMatch + 1;
      return name.includes(text);
    });
  }

  function renderStudentRows(students) {
    var sorted = students.slice().sort(function (a, b) {
      var nameA = [a.firstName, a.lastName].filter(Boolean).join(' ').toLowerCase();
      var nameB = [b.firstName, b.lastName].filter(Boolean).join(' ').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    window.ArchiviaUI.renderRows('#studentTableBody', sorted, [
      { key: 'studentId' },
      {
        key: 'firstName',
        render: function (row) {
          var fullName = [row.firstName, row.lastName].filter(Boolean).join(' ');
          var photo = window.ArchiviaUI.getStudentPhoto(row.id, '');
          return window.ArchiviaUI.createPersonCell(fullName, photo, false);
        }
      },
      {
        key: 'sex',
        render: function (row) {
          return row.sex || '-';
        }
      },
      {
        key: 'batchYear',
        render: function (row) {
          var year = getStudentYear(row);
          return year >= 1988 ? String(year) : '-';
        }
      },
      { key: 'gradeLevel' },
      { key: 'section' },
      {
        key: 'id',
        render: function (row) {
          return window.ArchiviaUI.createActionLinkButton('View Students', 'student-profile.html?id=' + encodeURIComponent(row.id));
        }
      }
    ], 'No students found for this school year.');
  }

  function showSchoolYears() {
    if (schoolYearSection) schoolYearSection.classList.remove('hidden');
    if (yearStudentsSection) yearStudentsSection.classList.add('hidden');
  }

  function showYearStudents(year, students) {
    activeYearStudents = students.slice();
    if (yearStudentsTitle) {
      if (typeof year === 'number' && year >= 1988) {
        yearStudentsTitle.textContent = 'Students - ' + formatSchoolYear(year);
      } else {
        yearStudentsTitle.textContent = 'Students - Search';
      }
    }
    if (schoolYearSection) schoolYearSection.classList.add('hidden');
    if (yearStudentsSection) yearStudentsSection.classList.remove('hidden');
    applySexFilter();
  }

  function applySexFilter() {
    var value = sexFilter ? sexFilter.value : '';
    var filtered = activeYearStudents.slice();
    if (value) {
      filtered = filtered.filter(function (s) {
        return String(s.sex || '').toLowerCase() === value.toLowerCase();
      });
    }
    renderStudentRows(filtered);
  }

  function renderSchoolYears(students) {
    if (!schoolYearTableBody) return;
    buildYearsSet(students);
    var yearMap = {};
    students.forEach(function (student) {
      var year = getStudentYear(student);
      if (!year || year < 1988) return;
      var bucketStart = getSchoolYearStart(year);
      if (!bucketStart) return;
      if (!yearMap[bucketStart]) yearMap[bucketStart] = [];
      yearMap[bucketStart].push(student);
    });

    var years = Object.keys(yearMap).map(function (y) { return Number(y); }).sort(function (a, b) { return b - a; });
    schoolYearTableBody.innerHTML = '';
    if (!years.length) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 3;
      td.appendChild(window.ArchiviaUI.createElement('div', 'empty-state', 'No school years available.'));
      tr.appendChild(td);
      schoolYearTableBody.appendChild(tr);
      return;
    }

    years.forEach(function (year) {
      var tr = document.createElement('tr');
      var tdYear = document.createElement('td');
      tdYear.textContent = formatSchoolYear(year);
      var tdCount = document.createElement('td');
      tdCount.textContent = String(yearMap[year].length);
      var tdAction = document.createElement('td');
      var btn = window.ArchiviaUI.createActionButton('View Students', 'btn btn-secondary', { 'data-year': String(year) });
      btn.addEventListener('click', function () {
        showYearStudents(year, yearMap[year]);
      });
      tdAction.appendChild(btn);
      tr.appendChild(tdYear);
      tr.appendChild(tdCount);
      tr.appendChild(tdAction);
      schoolYearTableBody.appendChild(tr);
    });
  }


  async function load() {
    window.ArchiviaUI.clearPageError();
    loading.classList.remove('hidden');
    window.ArchiviaUI.showSkeleton('#studentSummary', 3);
    try {
      all = await window.ArchiviaApi.withRetry(function () {
        return window.ArchiviaApi.getStudents();
      }, 1);
      buildYearsSet(all);
      var bucketCount = Array.from(new Set(all.map(function (s) {
        return getSchoolYearStart(getStudentYear(s));
      }).filter(function (y) { return y >= 1988; }))).length;
      window.ArchiviaUI.renderMetricCards('#studentSummary', [
        { title: 'Total Records', value: all.length },
        { title: 'School Years', value: bucketCount }
      ]);
      renderSchoolYears(all);
      showSchoolYears();
      loading.classList.add('hidden');
    } catch (error) {
      loading.classList.add('hidden');
      window.ArchiviaUI.showPageError(error.message, load);
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      var keyword = searchInput.value.trim().toLowerCase();
      if (!keyword) {
        renderSchoolYears(all);
        showSchoolYears();
        return;
      }
      var filtered = filterStudents(all, keyword);
      showYearStudents(parseSchoolYear(keyword) || 'Search', filtered);
    });
  }
  if (addStudentBtn) {
    addStudentBtn.addEventListener('click', function () {
      window.ArchiviaUI.openModal('#addStudentModal');
    });
  }
  if (saveStudentBtn) {
    saveStudentBtn.addEventListener('click', function () {
      var studentId = studentLrnInput ? studentLrnInput.value.trim() : '';
      var fullName = studentNameInput ? studentNameInput.value.trim() : '';
      var gradeLevel = studentGradeInput ? studentGradeInput.value.trim() : '';
      var section = studentSectionInput ? studentSectionInput.value.trim() : '';
      var schoolYear = studentSchoolYearInput ? parseSchoolYear(studentSchoolYearInput.value) : 0;
      var sex = studentSexInput ? studentSexInput.value : '';

      if (!studentId || !fullName || !gradeLevel || !section || !schoolYear || !sex) {
        window.ArchiviaUI.showToast('Please complete all required fields.');
        return;
      }
      if (schoolYear < 1988) {
        window.ArchiviaUI.showToast('School year must be 1988 or later.');
        return;
      }

      var nameParts = fullName.split(' ').filter(Boolean);
      var firstName = nameParts.shift() || '';
      var lastName = nameParts.join(' ');

      window.ArchiviaApi.withRetry(function () {
        return window.ArchiviaApi.createStudent({
          student_id: studentId,
          first_name: firstName,
          last_name: lastName,
          sex: sex,
          batch_year: schoolYear,
          grade_level: gradeLevel,
          section: section
        });
      }, 1).then(function () {
        if (studentLrnInput) studentLrnInput.value = '';
        if (studentNameInput) studentNameInput.value = '';
        if (studentGradeInput) studentGradeInput.value = '';
        if (studentSectionInput) studentSectionInput.value = '';
        if (studentSexInput) studentSexInput.value = '';
        if (studentSchoolYearInput) studentSchoolYearInput.value = '';
        window.ArchiviaUI.closeModal('#addStudentModal');
        load();
        window.ArchiviaUI.showToast('Student record saved.');
      }).catch(function (error) {
        window.ArchiviaUI.showToast(error.message || 'Failed to save student.');
      });
    });
  }
  if (backToYearsBtn) {
    backToYearsBtn.addEventListener('click', function () {
      renderSchoolYears(all);
      showSchoolYears();
    });
  }
  if (sexFilter) {
    sexFilter.addEventListener('change', applySexFilter);
  }

  await load();
});

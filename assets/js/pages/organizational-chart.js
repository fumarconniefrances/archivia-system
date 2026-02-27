document.addEventListener('DOMContentLoaded', async function () {
  var searchInput = document.getElementById('globalSearch');
  var grid = document.getElementById('orgChartGrid');
  var addBtn = document.getElementById('addOrgMemberBtn');
  var saveBtn = document.getElementById('saveOrgMemberBtn');
  var deleteBtn = document.getElementById('deleteOrgMemberBtn');
  var nameInput = document.getElementById('orgName');
  var positionInput = document.getElementById('orgPosition');
  var sortInput = document.getElementById('orgSortOrder');
  var photoInput = document.getElementById('orgPhotoInput');
  var summaryRoot = document.getElementById('orgChartSummary');

  var members = [];
  var editingId = 0;
  var editingPhotoData = '';
  var role = window.ArchiviaUI.getCurrentRole();
  var isAdmin = role === 'admin';

  function clearForm() {
    editingId = 0;
    editingPhotoData = '';
    if (nameInput) nameInput.value = '';
    if (positionInput) positionInput.value = '';
    if (sortInput) sortInput.value = '0';
    if (photoInput) photoInput.value = '';
    if (deleteBtn) deleteBtn.classList.add('hidden');
  }

  function openCreateModal() {
    clearForm();
    window.ArchiviaUI.openModal('#orgMemberModal');
  }

  function openEditModal(member) {
    if (!isAdmin || !member) return;
    editingId = member.id;
    editingPhotoData = member.photoData || '';
    if (nameInput) nameInput.value = member.name || '';
    if (positionInput) positionInput.value = member.positionTitle || '';
    if (sortInput) sortInput.value = String(member.sortOrder || 0);
    if (photoInput) photoInput.value = '';
    if (deleteBtn) deleteBtn.classList.remove('hidden');
    window.ArchiviaUI.openModal('#orgMemberModal');
  }

  function drawSummary(rows) {
    if (!summaryRoot) return;
    window.ArchiviaUI.renderMetricCards('#orgChartSummary', [
      { title: 'Total Members', value: rows.length },
      { title: 'Positions', value: Array.from(new Set(rows.map(function (m) { return m.positionTitle; }).filter(Boolean))).length }
    ]);
  }

  function draw() {
    if (!grid) return;
    var keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var filtered = members.filter(function (member) {
      if (!keyword) return true;
      var name = String(member.name || '').toLowerCase();
      var position = String(member.positionTitle || '').toLowerCase();
      return name.includes(keyword) || position.includes(keyword);
    });

    drawSummary(filtered);
    grid.innerHTML = '';
    if (!filtered.length) {
      grid.appendChild(window.ArchiviaUI.createElement('div', 'empty-state', 'No chart members found.'));
      return;
    }

    filtered.forEach(function (member) {
      var card = window.ArchiviaUI.createElement('article', 'card org-card');
      var photo = window.ArchiviaUI.createPhotoVisual(member.photoData, member.name, true);
      card.appendChild(photo);
      card.appendChild(window.ArchiviaUI.createElement('h3', 'org-name', member.name || 'Unnamed'));
      card.appendChild(window.ArchiviaUI.createElement('p', 'org-position', member.positionTitle || 'Position not set'));
      if (isAdmin) {
        card.classList.add('org-editable');
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.addEventListener('click', function () {
          openEditModal(member);
        });
        card.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openEditModal(member);
          }
        });
      }
      grid.appendChild(card);
    });
  }

  async function load() {
    window.ArchiviaUI.clearPageError();
    window.ArchiviaUI.showSkeleton('#orgChartGrid', 4);
    try {
      members = await window.ArchiviaApi.withRetry(function () {
        return window.ArchiviaApi.getOrganizationChart();
      }, 1);
      draw();
    } catch (error) {
      window.ArchiviaUI.showPageError(error.message, load);
    }
  }

  if (photoInput) {
    photoInput.addEventListener('change', function (event) {
      var file = event.target.files && event.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        window.ArchiviaUI.showToast('Please choose an image file.');
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        editingPhotoData = String(e.target.result || '');
      };
      reader.readAsDataURL(file);
    });
  }

  if (addBtn) {
    addBtn.addEventListener('click', function () {
      openCreateModal();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async function () {
      var name = nameInput ? nameInput.value.trim() : '';
      var positionTitle = positionInput ? positionInput.value.trim() : '';
      var sortOrder = sortInput ? Number(sortInput.value) : 0;

      if (!name || !positionTitle) {
        window.ArchiviaUI.showToast('Name and position are required.');
        return;
      }

      var payload = {
        name: name,
        position_title: positionTitle,
        sort_order: Number.isNaN(sortOrder) ? 0 : sortOrder,
        photo_data: editingPhotoData || null
      };

      try {
        if (editingId > 0) {
          payload.id = editingId;
          await window.ArchiviaApi.updateOrganizationMember(payload);
          window.ArchiviaUI.showToast('Member updated.');
        } else {
          await window.ArchiviaApi.createOrganizationMember(payload);
          window.ArchiviaUI.showToast('Member added.');
        }
        window.ArchiviaUI.closeModal('#orgMemberModal');
        clearForm();
        await load();
      } catch (error) {
        window.ArchiviaUI.showToast(error.message || 'Save failed.');
      }
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async function () {
      if (!editingId) return;
      try {
        await window.ArchiviaApi.deleteOrganizationMember(editingId);
        window.ArchiviaUI.closeModal('#orgMemberModal');
        clearForm();
        window.ArchiviaUI.showToast('Member deleted.');
        await load();
      } catch (error) {
        window.ArchiviaUI.showToast(error.message || 'Delete failed.');
      }
    });
  }

  if (searchInput) searchInput.addEventListener('input', draw);
  if (!isAdmin) clearForm();
  await load();
});

document.addEventListener('DOMContentLoaded', async function () {
  const searchInput = document.getElementById('globalSearch');
  const paginationRoot = document.getElementById('logsPagination');
  const pageSize = 10;
  let all = [];
  let currentPage = 1;
  let totalItems = 0;
  let totalPages = 1;

  function renderPagination() {
    if (!paginationRoot) return;
    paginationRoot.innerHTML = '';
    if (totalPages <= 1) return;

    const maxButtons = 7;
    let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }

    for (let page = start; page <= end; page += 1) {
      if (page === currentPage) {
        const current = document.createElement('strong');
        current.textContent = String(page);
        paginationRoot.appendChild(current);
      } else {
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = String(page);
        link.setAttribute('data-page', String(page));
        link.addEventListener('click', function (event) {
          event.preventDefault();
          load(page);
        });
        paginationRoot.appendChild(link);
      }

      if (page < end) {
        paginationRoot.appendChild(document.createTextNode(' '));
      }
    }
  }

  function draw() {
    const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const yearMatch = /^\d{4}$/.test(keyword) ? Number(keyword) : 0;
    const filtered = all.filter(function (row) {
      const action = String(row.action || '').toLowerCase();
      const entityTypeValue = String(row.entityType || row.target || '').toLowerCase();
      const userName = String(row.userName || row.actor || '').toLowerCase();
      const target = String(row.target || '').toLowerCase();
      const time = String(row.time || '').toLowerCase();
      if (!keyword) return true;
      if (yearMatch >= 1988) return time.startsWith(String(yearMatch));
      return action.includes(keyword) ||
        entityTypeValue.includes(keyword) ||
        userName.includes(keyword) ||
        target.includes(keyword);
    });

    window.ArchiviaUI.renderRows(
      '#logsTableBody',
      filtered,
      [
        { key: 'time' },
        { key: 'actor' },
        { key: 'action' },
        { key: 'target' }
      ],
      'No activity logs found for this query.'
    );

    renderPagination();
  }

  async function load(page) {
    window.ArchiviaUI.clearPageError();
    window.ArchiviaUI.showSkeleton('#logSummary', 3);
    try {
      currentPage = Math.max(1, Number(page) || 1);
      const payload = await window.ArchiviaApi.withRetry(function () {
        return window.ArchiviaApi.getLogs({ page: currentPage, limit: pageSize });
      }, 1);

      if (Array.isArray(payload)) {
        all = payload;
        totalItems = payload.length;
      } else {
        all = Array.isArray(payload.items) ? payload.items : [];
        totalItems = Number(payload.total) || all.length;
      }
      totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

      const uniqueActors = {};
      all.forEach(function (item) { uniqueActors[item.actor] = true; });
      const latestDay = all.length ? all[0].time.split(' ')[0] : '';
      window.ArchiviaUI.renderMetricCards('#logSummary', [
        { title: 'Total Log Entries', value: totalItems },
        { title: 'Unique Actors', value: Object.keys(uniqueActors).length },
        { title: 'Latest Day Entries', value: all.filter(function (l) { return l.time.indexOf(latestDay) === 0; }).length }
      ]);
      draw();
    } catch (error) {
      window.ArchiviaUI.showPageError(error.message, function () { load(currentPage); });
    }
  }

  if (searchInput) searchInput.addEventListener('input', draw);
  await load(1);
});

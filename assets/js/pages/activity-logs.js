document.addEventListener('DOMContentLoaded', async function () {
  const searchInput = document.getElementById('globalSearch');
  const prevBtn = document.getElementById('logsPrevBtn');
  const nextBtn = document.getElementById('logsNextBtn');
  const pageInfo = document.getElementById('logsPageInfo');
  const pageSize = 10;
  let all = [];
  let currentPage = 1;
  let totalItems = 0;

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

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  }

  async function load(page) {
    window.ArchiviaUI.clearPageError();
    window.ArchiviaUI.showSkeleton('#logSummary', 3);
    try {
      currentPage = Math.max(1, Number(page) || 1);
      all = await window.ArchiviaApi.withRetry(function () {
        return window.ArchiviaApi.getLogs({ page: currentPage, limit: pageSize });
      }, 1);
      totalItems = all.total || 0;
      all = all.items || [];
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
  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      if (currentPage <= 1) return;
      load(currentPage - 1);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      if (currentPage >= totalPages) return;
      load(currentPage + 1);
    });
  }
  await load(1);
});

document.addEventListener('DOMContentLoaded', async function () {
  const searchInput = document.getElementById('globalSearch');
  let all = [];

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
  }

  async function load() {
    window.ArchiviaUI.clearPageError();
    window.ArchiviaUI.showSkeleton('#logSummary', 3);
    try {
      all = await window.ArchiviaApi.withRetry(function () {
        return window.ArchiviaApi.getLogs();
      }, 1);
      const uniqueActors = {};
      all.forEach(function (item) { uniqueActors[item.actor] = true; });
      const latestDay = all.length ? all[0].time.split(' ')[0] : '';
      window.ArchiviaUI.renderMetricCards('#logSummary', [
        { title: 'Total Log Entries', value: all.length },
        { title: 'Unique Actors', value: Object.keys(uniqueActors).length },
        { title: 'Latest Day Entries', value: all.filter(function (l) { return l.time.indexOf(latestDay) === 0; }).length }
      ]);
      draw();
    } catch (error) {
      window.ArchiviaUI.showPageError(error.message, load);
    }
  }

  if (searchInput) searchInput.addEventListener('input', draw);
  await load();
});

/* boot.js — 从后端加载真实数据(同步,确保 app.js 渲染前就绪) */
(function () {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', '/api/bootstrap', false);
  xhr.send();
  if (xhr.status !== 200) {
    window.BOOT_ERROR = 'API 不可用,请通过 node server.js 启动 Lumo 服务。';
    return;
  }
  var d = JSON.parse(xhr.responseText);
  window.CATEGORIES = d.categories;
  window.ITEMS = d.items;
  window.LIVE = d.live || {};
  window.CHECKED = d.checked || '2026-09-05';
  window.BOOT_USER = d.user || null;
  window.BOOT_MY_RATES = d.myRates || {};
})();

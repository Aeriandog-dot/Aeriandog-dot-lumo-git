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

// static copy used by About etc. (English)
window.SOURCES = window.SOURCES || [
  { name: 'Public records', note: 'official sites, registries, licences, media' },
  { name: 'Security blacklists', note: 'ScamAdviser, ScamDoc, Google Safe Browsing' },
  { name: 'Domain & operator', note: 'registration age, registrant, operator' },
  { name: 'User reports', note: 'ratings and complaints on Lumo' },
  { name: 'Community discussion', note: 'public forums and social chatter' },
  { name: 'Human review', note: 'editors verify each conclusion' }
];
window.METHOD = window.METHOD || [
  { name: 'Public records', desc: 'how verifiable official info is.', val: '30%' },
  { name: 'Risk & blacklists', desc: 'scanner blacklists and fraud complaints.', val: '25%' },
  { name: 'User feedback', desc: 'ratings, complaint volume and handling.', val: '25%' },
  { name: 'Operating transparency', desc: 'public entity, clear fees, refunds & support.', val: '20%' }
];
window.STATS = window.STATS || { websites: '1,204', categories: '8', ratings: '38,621' };

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

// 关于页等所需静态文案数据(由服务端种子定义,此处补齐避免变量缺失)
window.SOURCES = window.SOURCES || [
  { name: '公开信息核验', note: '官网、工商、牌照与媒体报道' },
  { name: '安全黑名单', note: 'ScamAdviser、ScamDoc、Google 安全浏览等' },
  { name: '域名与主体', note: '注册时间、注册人与运营方' },
  { name: '用户评价投诉', note: '平台内评分与投诉记录' },
  { name: '社区讨论', note: '论坛、社交媒体的公开讨论' },
  { name: '人工复核', note: '编辑对关键结论逐条复核' }
];
window.METHOD = window.METHOD || [
  { name: '公开信息核验', desc: '官网、工商、牌照、媒体报道等可核实程度。', val: '30%' },
  { name: '风险与黑名单记录', desc: '安全检测站黑名单、诈骗投诉记录。', val: '25%' },
  { name: '用户评价与投诉', desc: '平台内用户评分、投诉数量与处理情况。', val: '25%' },
  { name: '运营透明度', desc: '主体公开、收费透明、退款与客服机制。', val: '20%' }
];
window.STATS = window.STATS || { websites: '1,204', categories: '8', ratings: '38,621' };

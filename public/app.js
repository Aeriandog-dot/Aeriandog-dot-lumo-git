/* Lumo prototype — 前端逻辑(示例数据)。 */

(function () {
  'use strict';

  var state = {
    signedIn: false,
    user: null,
    sort: 'combined',
    live: 'on',
    query: '',
    lastSearch: null,
    userRates: {},
    pendingSubmit: false,
    history: [],
    submissions: [],
    subTimer: null,
    pendingRate: null
  };

  var view = document.getElementById('view');
  var siteNav = document.getElementById('siteNav');
  var authBtn = document.getElementById('authBtn');
  var menuBtn = document.getElementById('menuBtn');

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function level(r) {
    if (r >= 7.5) return { c: 'lv-good', label: '表现良好', color: '#34d399' };
    if (r >= 4.5) return { c: 'lv-mid', label: '需谨慎', color: '#fbbf24' };
    return { c: 'lv-bad', label: '高风险', color: '#f87171' };
  }

  function ringHTML(p, lg, sm) {
    var lv = level(p);
    var cls = (lg ? 'score-ring lg' : (sm ? 'score-ring sm' : 'score-ring'));
    var v = Math.round(p * 10) / 10;
    return '<div class="' + cls + '" style="--p:' + (p * 10) + ';--c:' + lv.color + '"><div class="inner"><span class="val">' + v + '</span><span class="of">/10</span></div></div>';
  }

  function stars(score) {
    var full = Math.round(score);
    var s = '';
    for (var i = 0; i < 5; i++) s += i < full ? '★' : '☆';
    return s;
  }

  function starsRowHTML(score, size) {
    var full = Math.round(score);
    var s = '';
    for (var i = 0; i < 5; i++) s += '<span class="' + (i < full ? '' : 'off') + '">★</span>';
    return '<span class="stars-row">' + s + '</span>';
  }

  function badge(status) {
    if (status === 'ok') return '<span class="badge bd-ok">正常收录</span>';
    if (status === 'risk') return '<span class="badge bd-risk">风险提示</span>';
    return '<span class="badge bd-review">核实中</span>';
  }

  function catById(id) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === id) return CATEGORIES[i];
    return null;
  }

  function itemById(id) {
    for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) return ITEMS[i];
    return null;
  }

  function userScoreOf(it) { return Math.round((it.userScore || 0) * 10) / 10; }
  function userCountOf(it) { return it.userCount || 0; }

    function catStats(id) {
    var list = ITEMS.filter(function (i) { return i.cat === id && i.phase !== 'pending'; });
    var dead = list.filter(function (i) { return liveInfo(i).key === 'off'; }).length;
    var alive = list.filter(function (i) { return liveInfo(i).key !== 'off'; });
    var avg = 0;
    alive.forEach(function (i) { avg += i.rating; });
    avg = alive.length ? Math.round(avg / alive.length * 10) / 10 : 0;
    var risk = alive.filter(function (i) { return i.status === 'risk'; }).length;
    return { count: alive.length, avg: avg, risk: risk, dead: dead };
  }


  function liveArr(it) {
    var a = LIVE[it.id] || [1, 1, 1];
    return { online: a[0] === 1, signup: a[1] === 1, promo: a[2] === 1 };
  }

  function liveInfo(it) {
    var l = liveArr(it);
    if (!l.online) return { key: 'off', label: '已停运' };
    if (l.signup && l.promo) return { key: 'on', label: '运营中' };
    return { key: 'part', label: '部分活跃' };
  }

  function liveBadge(it) {
    var info = liveInfo(it);
    return '<span class="live-tag ' + info.key + '"><span class="dot"></span>' + info.label + '</span>';
  }

  function liveMatch(it) {
    var info = liveInfo(it);
    if (state.live === 'all') return true;
    return info.key === state.live;
  }

  function liveChipsHTML(list) {
    var cnt = { on: 0, part: 0, off: 0 };
    list.forEach(function (i) { cnt[liveInfo(i).key]++; });
    var items = [
      ['all', '全部状态', list.length],
      ['on', '运营中', cnt.on],
      ['part', '部分活跃', cnt.part],
      ['off', '已停运', cnt.off]
    ];
    var html = '<div class="chipbar" id="liveChips">';
    items.forEach(function (it) {
      html += '<button class="chip' + (state.live === it[0] ? ' on' : '') + '" data-livefilter="' + it[0] + '">' + it[1] + ' <span class="cnt">' + it[2] + '</span></button>';
    });
    return html + '</div><p class="filter-hint">“运营中”= 网站可访问 + 可注册/开户 + 仍在推广 · 最近核验 ' + CHECKED + '</p>';
  }
  function combinedScore(it) {
    var u = userScoreOf(it);
    return Math.round((it.rating * 0.6 + (u * 2) * 0.4) * 10) / 10;
  }

  function rowItemHTML(it, dead) {
    var lv = level(it.rating);
    var link = domainMarkup(it, dead);
    var stamp = dead ? '<span class="dead-stamp">DEAD</span>' : '';
    var intro = (it.intro && it.intro.length > 30) ? it.intro : it.tagline;
    return '<article class="row-item' + (dead ? ' dead-row' : '') + '" data-item="' + it.id + '" tabindex="0" role="link">' +
      '<div class="score-badge">' + ringHTML(it.rating, false, true) +
      '<span class="score-label ' + lv.c + '" style="font-size:10px">' + lv.label + '</span></div>' +
      '<div class="item-main">' +
        '<div class="item-title"><span class="item-name">' + esc(it.name) + '</span>' + link + (dead ? '<span class="badge dead">DEAD</span>' : badge(it.status)) + '</div>' +
        '<p class="item-intro">' + esc(intro) + '</p>' +
        '<div class="item-meta"><span class="tag">' + esc(catById(it.cat).title) + '</span>' + (dead ? '' : liveBadge(it)) + '<span class="tag comb">综合 ' + combinedScore(it) + '</span></div>' +
      '</div>' +
      '<div class="user-score"><b>' + userScoreOf(it) + '</b><span class="stars">' + stars(userScoreOf(it)) + '</span><span>' + userCountOf(it) + ' 人评分</span></div>' +
      stamp +
    '</article>';
  }

  function showToast(msg) {
    var wrap = document.getElementById('toasts');
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 2600);
    setTimeout(function () { el.remove(); }, 2950);
  }

  function userHandle() {
    if (!state.user) return '访客';
    return state.user.split('@')[0] || '用户';
  }

  function setActiveNav(route) {
    var links = siteNav.querySelectorAll('a[data-route]');
    links.forEach(function (a) {
      var href = a.getAttribute('href');
      var homeish = route === 'home' || route === 'cat' || route === 'item' || route === 'search';
      var active = (homeish && href === '#/') || (href === '#/' + route);
      a.classList.toggle('active', !!active);
    });
    siteNav.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  function updateAuthButton() {
    authBtn.textContent = state.signedIn ? '退出 (' + userHandle() + ')' : '登录';
  }

  function openAuth(subText) {
    var sub = document.getElementById('authSub');
    if (sub) sub.textContent = subText || '登录后即可查看完整域名、给网站打分与提交收录。';
    var em = document.getElementById('authEmailForm');
    var cs = document.getElementById('authStepCode');
    var hint = document.getElementById('authHint');
    if (em) em.style.display = '';
    if (cs) cs.hidden = true;
    var ac = document.getElementById('authCode');
    if (ac) ac.value = '';
    if (hint) hint.textContent = '演示环境:任意邮箱均可,验证码统一为 123456。';
    var m = document.getElementById('authModal');
    if (m) m.hidden = false;
    setTimeout(function () {
      var inp = document.getElementById('authEmail');
      if (inp) inp.focus();
    }, 50);
  }

  function finalizeLogin(email) {
    state.signedIn = true;
    state.user = email;
    var ud = userData(email);
    state.userRates = ud.rates || {};
    state.history = ud.history || [];
    state.submissions = ud.submissions || [];
    closeModals();
    updateAuthButton();
    saveSession();
    showToast('已登录 ' + email + (isAdmin() ? ' · 管理员模式' : ''));
    if (state.pendingRate) {
      var pr = state.pendingRate;
      state.pendingRate = null;
      applyRate(pr.id, pr.stars);
      render();
      showToast('已为该网站评 ' + pr.stars + ' 星,感谢参与!');
    } else if (state.pendingSubmit) {
      state.pendingSubmit = null;
      showToast('已登录 — 请再次点击「提交收录」完成提交。');
    } else {
      render();
    }
  }

  function closeModals() {
    document.querySelectorAll('.modal-backdrop').forEach(function (m) { m.hidden = true; });
  }

  var SESSION_KEY = 'lumo_v2';
  function store() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || '{"byEmail":{}}'); } catch (e) { return { byEmail: {} }; }
  }
  function persist(obj) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(obj)); } catch (e) {}
  }
  function userData(email) {
    var st = store();
    if (!st.byEmail) st.byEmail = {};
    if (!st.byEmail[email]) st.byEmail[email] = { rates: {}, history: [], submissions: [] };
    return st.byEmail[email];
  }
  function loadSession() { /* 会话由后端 cookie 管理 */ }
  function saveSession() { /* 数据持久化由后端完成 */ }
  function isAdmin() { return state.signedIn && state.user === 'admin@lumo.local'; }
  function maskDomain(d) {
    var s = String(d || '');
    if (s.length <= 4) return '••••';
    var dot = s.lastIndexOf('.');
    var tld = dot > 1 ? s.slice(dot) : '';
    return s.slice(0, 3) + '••••••' + tld;
  }
  function domainMarkup(it, dead) {
    if (dead) return state.signedIn ? '<span class="item-domain dead-link">' + esc(it.domain) + '</span>' : '<span class="item-domain dead-link" title="登录后查看完整域名">' + esc(maskDomain(it.domain)) + '</span>';
    if (!state.signedIn) return '<span class="mask-domain" data-need-login title="登录后查看完整域名">' + esc(maskDomain(it.domain)) + '</span>';
    var extra = it.status === 'risk' ? ' data-risk-external="1"' : '';
    return '<a class="item-domain" href="https://' + esc(it.domain) + '" target="_blank" rel="noopener nofollow"' + (it.status === 'risk' ? ' title="风险网站,访问需谨慎"' : '') + extra + '>' + esc(it.domain) + ' <span class="ext">&#8599;</span></a>';
  }
  function pushHistory(id) {
    if (!state.signedIn) return;
    var h = (state.history || []).filter(function (x) { return x !== id; });
    h.unshift(id);
    state.history = h.slice(0, 8);
    saveSession();
  }

  
  function catIcon(id) {
    var icons = {
      crypto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2l6.9 4v9.6l-6.9 4-6.9-4V7.2z"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>',
      trading: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 17.5l5-4.5 3.2 2.6L19 6.5"/><path d="M15 6.5h4v4"/></svg>',
      shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1.1 10.2a2 2 0 0 1-2 1.8H9.1a2 2 0 0 1-2-1.8z"/><path d="M9 10V6.8a3 3 0 0 1 6 0V10"/></svg>',
      loan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 9L12 4l8.5 5"/><path d="M5.5 10v6M10 10v6M14 10v6M18.5 10v6"/><path d="M4 18.5h16"/></svg>',
      job: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="8" width="17" height="11" rx="2.2"/><path d="M9 8V6.8A1.8 1.8 0 0 1 10.8 5h2.4A1.8 1.8 0 0 1 15 6.8V8"/><path d="M3.5 13.5h17"/></svg>',
      dating: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19.5S4 14.9 4 9.7A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 8 2.1c0 5.2-8 9.8-8 9.8z"/></svg>',
      news: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H16a1.5 1.5 0 0 1 1.5 1.5V15H6.5A1.5 1.5 0 0 0 5 16.5"/><path d="M5 16.5A1.5 1.5 0 0 0 6.5 18H19v-8.5H17.5"/><path d="M8.5 8h6.5M8.5 11h6.5M8.5 14H14"/></svg>',
      game: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 6h9A6 6 0 0 1 22.4 12l-1 6a3 3 0 0 1-5.1 1.4L14.7 18H9.3l-1.6 1.4A3 3 0 0 1 2.6 18l-1-6A6 6 0 0 1 7.5 6z"/><path d="M8 10.5h4M10 8.5v4"/><circle cx="16.3" cy="10.8" r=".6"/><circle cx="18.2" cy="12.8" r=".6"/></svg>'
    };
    return icons[id] || '';
  }
  function renderHome() {
    var catCards = CATEGORIES.map(function (c) {
      var st = catStats(c.id);
      var avgHtml = st.avg ? '<span class="avg">均分 <b>' + st.avg + '</b></span>' : '';
      var riskHtml = st.risk ? '<span class="risk">风险 <b>' + st.risk + '</b></span>' : '';
      var deadHtml = st.dead ? '<span class="dead">DEAD <b>' + st.dead + '</b></span>' : '';
      return '<div class="cat-card" data-catnav="' + c.id + '" tabindex="0" role="link">' +
        '<div class="cat-ico">' + catIcon(c.id) + '</div>' +
        '<h3>' + esc(c.title) + '</h3>' +
        '<span class="cat-en">' + esc(c.en) + '</span>' +
        '<div class="cat-meta"><span>收录 <b>' + st.count + '</b></span>' + avgHtml + riskHtml + deadHtml + '</div>' +
      '</div>';
    }).join('');

    var recentHtml = '';
    if (state.signedIn && state.history && state.history.length) {
      var hist = state.history.map(function (hid) {
        var hit = itemById(hid);
        if (!hit) return null;
        return '<div class="recent-row" data-item="' + hid + '"><span class="rn">' + esc(hit.name) + '</span><span class="rd">' + esc(hit.domain) + '</span><span class="rt">' + combinedScore(hit) + ' 分</span></div>';
      }).filter(Boolean).join('');
      if (hist) recentHtml = '<div class="recent-strip"><div class="recent-head"><h2>最近浏览</h2><span class="clear" data-clear-history>清空</span></div>' + hist + '</div>';
    }

    view.innerHTML =
      '<section class="hero">' +
        '<span class="kicker">Lumo</span>' +
        '<h1>找你想找的</h1>' +
        '<form class="search-wrap" id="searchForm">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>' +
          '<input class="search-input" id="searchInput" type="search" placeholder="输入网址或名称,如 shark-trades.com" autocomplete="off">' +
          '<button class="btn btn-primary search-go" type="submit">搜索</button>' +
        '</form>' +
  
      '</section>' +
      '<div class="cat-grid">' + catCards + '</div>' + recentHtml;
  }

  function sortedItems(list) {
    var s = state.sort;
    var out = list.slice();
    out.sort(function (a, b) {
      if (s === 'rating') return b.rating - a.rating;
      if (s === 'user') return userScoreOf(b) - userScoreOf(a);
      if (s === 'newest') return b.added.localeCompare(a.added);
      return combinedScore(b) - combinedScore(a);
    });
    return out;
  }

  
  function deadPanelHTML(dead) {
    var lines = dead.map(function (it) {
      var dom = state.signedIn ? it.domain : maskDomain(it.domain);
      var c = catById(it.cat);
      return '<div class="dead-line" data-item="' + it.id + '" role="link" tabindex="0">' +
        '<span class="badge dead">DEAD</span>' +
        '<div class="dl-main"><div class="dname">' + esc(it.name) + '</div>' +
        '<div class="ddom">' + esc(dom) + '</div></div>' +
        '<div class="dl-meta"><span class="tag">' + esc(c ? c.title : it.cat) + '</span><span class="tag">收录 ' + esc(it.added) + '</span></div>' +
        '<span class="dl-note">已下线 · 点击查看归档详情 &#8599;</span>' +
        '<span class="stamp-mini">DEAD</span>' +
      '</div>';
    }).join('');
    return '<section class="dead-panel">' +
      '<header class="dead-panel-head"><span class="dead-badge">DEAD</span><h2>死亡名单</h2>' +
      '<span class="dead-note">已确认无法打开 / 停止运营 · ' + dead.length + ' 个 · 仅归档,不参与排序</span></header>' +
      '<div class="dead-list">' + lines + '</div></section>';
  }

  function deadLineHTML(it) {
    var dom = state.signedIn ? it.domain : maskDomain(it.domain);
    var c = catById(it.cat);
    return '<div class="dead-line" data-item="' + it.id + '" role="link" tabindex="0">' +
      '<span class="badge dead">DEAD</span>' +
      '<div class="dl-main"><div class="dname">' + esc(it.name) + '</div><div class="ddom">' + esc(dom) + '</div></div>' +
      '<div class="dl-meta"><span class="tag">' + esc(c ? c.title : it.cat) + '</span><span class="tag">收录 ' + esc(it.added) + '</span></div>' +
      '<span class="dl-note">已下线 · 点击查看归档详情</span>' +
      '<span class="stamp-mini">DEAD</span></div>';
  }
  function renderCat(id) {
    var c = catById(id);
    if (!c) { location.hash = '#/'; return; }
    var base = ITEMS.filter(function (i) { return i.cat === id && i.phase !== 'pending'; });
    var dead = base.filter(function (i) { return liveInfo(i).key === 'off'; });
    var alive = sortedItems(base.filter(function (i) { return liveInfo(i).key !== 'off'; }));
    var st = catStats(id);
    var liveSec = '<div class="live-sec-title"><h2>运营名单</h2><span class="cnt">' + alive.length + ' 个 · 可访问 · 可注册 · 仍在推广</span></div>';
    var liveList = alive.length
      ? '<div class="proj-list" id="itemList">' + alive.map(rowItemHTML).join('') + '</div>'
      : '<div class="empty"><div class="big">&#128269;</div><h3>该分类暂无运营中的网站</h3></div>';
    var deadSec = dead.length
      ? '<section class="dead-sec">' +
        '<div class="dead-sec-head"><span class="dead-badge">DEAD</span><h2>死亡名单</h2>' +
        '<span class="dead-note">已确认无法打开 / 停止运营 · ' + dead.length + ' 个 · 仅归档,不参与排序</span></div>' +
        '<div class="dead-cardlist">' + dead.map(function (it) { return rowItemHTML(it, true); }).join('') + '</div>' +
        '</section>'
      : '';
    view.innerHTML =
      '<div class="page-head">' +
        '<div class="crumb"><a href="#/">首页</a><span class="sep">/</span><span>' + esc(c.title) + '</span></div>' +
        '<h1>' + c.icon + ' ' + esc(c.title) + ' <span style="font-size:14px;color:var(--dim);font-weight:400">' + esc(c.en) + '</span></h1>' +
        '<p class="lede">' + esc(c.desc) + ' · 运营名单 ' + alive.length + ' 个 · 死亡名单 ' + dead.length + ' 个</p>' +
      '</div>' +
      '<div class="toolbar">' +
        '<select class="select" id="sortSel" aria-label="排序">' +
          '<option value="combined">综合排序(网站评分+用户打分)</option>' +
          '<option value="rating">按 Lumo 网站评分</option>' +
          '<option value="user">按用户打分</option>' +
          '<option value="newest">最新收录</option>' +
        '</select>' +
        '<span class="grow"></span>' +
        '<span class="result-count">' + alive.length + ' 个可访问收录</span>' +
      '</div>' +
      liveSec + liveList +
      deadSec;
    var ss = document.getElementById('sortSel');
    if (ss) ss.value = state.sort;
  }

  function renderItem(id) {
    var it = itemById(id);
    if (!it) { location.hash = '#/'; return; }
    var c = catById(it.cat);
    pushHistory(id);
    var deadIt = liveInfo(it).key === 'off';
    var officialBtn = '';
    if (!deadIt) {
      if (!state.signedIn) officialBtn = '<button class="btn btn-primary" type="button" data-need-login>登录查看官网</button>';
      else officialBtn = '<a class="btn btn-primary" href="https://' + esc(it.domain) + '" target="_blank" rel="noopener nofollow"' + (it.status === 'risk' ? ' data-risk-external="1"' : '') + '>访问官网</a>';
    }
    var lv = level(it.rating);
    var us = userScoreOf(it);
    var uc = userCountOf(it);

    var kv = it.facts.map(function (f) {
      return '<div class="row"><div class="k">' + esc(f[0]) + '</div><div class="v">' + esc(f[1]) + '</div></div>';
    }).join('');

    var la = liveArr(it);
    var cells = [
      ['&#127760;', '网站可访问', la.online ? '可以打开' : '无法访问', la.online],
      ['&#128221;', '可注册 / 开户', la.signup ? '开放注册' : '已暂停注册', la.signup],
      ['&#128227;', '仍在推广', la.promo ? '仍在推广' : '未见推广', la.promo]
    ].map(function (cell) {
      return '<div class="live-cell ' + (cell[3] ? 'ok' : 'no') + '"><div class="ic">' + cell[0] + '</div><b>' + cell[1] + '</b><p>' + cell[2] + '</p></div>';
    }).join('');
    var liveCard = '<div class="card"><h2>运营状态核验 <span class="h2-note">最近核验 ' + CHECKED + '</span></h2>' +
      '<div class="live-check">' + cells + '</div>' +
      '<div style="display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap">' + liveBadge(it) +
      '<span style="color:var(--dim);font-size:12.5px">仅“运营中”表示三项全部通过</span>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-recheck style="margin-left:auto">重新检测</button></div></div>';

    var icons = { good: ['✓', 'lv-good'], info: ['✓', 'lv-good'], warn: ['!', 'lv-mid'], bad: ['⚠', 'lv-bad'] };
    var reasons = it.reasons.map(function (r) {
      var ic = icons[r.t];
      return '<div class="signal t-' + (r.t === 'good' ? 'info' : (r.t === 'warn' ? 'warn' : 'alert')) + '"><span class="ic">' + ic[0] + '</span><span class="stxt">' + esc(r.txt) + '</span></div>';
    }).join('');

    var dist = it.dist;
    var maxD = Math.max.apply(null, dist);
    var distRows = '';
    for (var s = 5; s >= 1; s--) {
      var v = dist[s - 1];
      distRows += '<div class="dist-row"><span>' + s + ' 星</span><div class="bar"><i style="width:' + (maxD ? Math.round(v / maxD * 100) : 0) + '%"></i></div><span class="n">' + v + ' 人</span></div>';
    }

    var evid = it.evid ? '<div class="card"><h2>外部证据 <span class="h2-note">可点击查看</span></h2><div class="evidence">' +
      it.evid.map(function (e) { return '<a href="' + esc(e.url) + '" target="_blank" rel="noopener"><span class="dot"></span><span class="src-name">' + esc(e.label) + '</span><span class="ext-ic">&#8599;</span></a>'; }).join('') +
      '</div></div>' : '';

    var myRate = state.userRates[it.id];
    var rateBtns = '';
    for (var st = 1; st <= 5; st++) {
      rateBtns += '<button class="rate-btn' + (myRate && st <= myRate ? ' self' : '') + '" data-rate="' + st + '" title="' + st + ' 星">★</button>';
    }

    var banner = '';
    if (it.status === 'risk') {
      banner = '<div class="big-alert"><span class="ba-ic red">&#9888;</span><div><b>风险提示:请勿向其转账或连接钱包</b><p>该网站存在多项高风险信号,详情见下方收录依据与外部证据。</p></div></div>';
    } else if (it.status === 'review') {
      banner = '<div class="big-alert amber"><span class="ba-ic amber">&#9888;</span><div><b>核实中:信息尚不完整</b><p>当前证据不足以定性,正在人工复核。</p></div></div>';
    }

    view.innerHTML =
      '<div class="page-head">' +
        '<div class="crumb"><a href="#/">首页</a><span class="sep">/</span><a href="#/cat/' + c.id + '">' + esc(c.title) + '</a><span class="sep">/</span><span>' + esc(it.name) + '</span></div>' +
      '</div>' +
      banner +
      '<section class="detail-head"><div class="item-detail-head' + (deadIt ? ' detail-dead-wrap' : '') + '">' + (deadIt ? '<span class="dead-stamp">DEAD</span>' : '') +
        '<div class="detail-score">' + ringHTML(it.rating, true) + '<span class="score-label ' + lv.c + '">Lumo 评分 · ' + lv.label + '</span></div>' +
        '<div class="detail-titles" style="flex:1;min-width:240px">' +
          '<h1>' + esc(it.name) + '<span class="tkr" style="font-family:var(--font);font-weight:400">' + esc(state.signedIn ? it.domain : maskDomain(it.domain)) + '</span></h1>' +
          '<p class="detail-tagline">' + esc(it.tagline) + '</p>' +
          '<div class="detail-tags">' + badge(it.status) + (liveInfo(it).key === 'off' ? '<span class="badge dead">DEAD</span>' : liveBadge(it)) + '<span class="tag comb">综合 ' + combinedScore(it) + '</span><span class="tag">' + esc(c.title) + '</span><span class="tag">收录于 ' + esc(it.added) + '</span></div>' +
        '</div>' +
        '<div class="detail-actions">' + officialBtn +
          '<button class="btn btn-ghost" type="button" data-report>报告问题</button>' +
          '<a class="btn btn-ghost" href="#/submit">建议收录</a>' +
        '</div>' +
      '</div></section>' +
      '<div class="layout">' +
        '<div class="main-col">' +
          '<div class="card overview"><h2>项目简介</h2><p>' + esc(it.intro) + '</p></div>' +
          '<div class="card"><h2>关键信息</h2><div class="kv">' + kv + '</div></div>' +
          liveCard +
          '<div class="card"><h2>收录依据</h2>' + reasons + '</div>' +
          evid +
          '<div class="card"><h2>用户评价</h2>' +
            '<div class="big-score">' +
              '<div class="detail-score" style="padding-top:0">' +
                '<div class="score-ring lg" style="--p:' + (us * 20) + ';--c:#f5c044"><div class="inner"><span class="val" style="font-size:24px">' + us + '</span><span class="of">/5</span></div></div>' +
              '</div>' +
              '<div class="txt"><b style="font-size:18px">' + stars(us) + '</b><p>' + uc + ' 位用户打分 · 满分 5 星</p>' +
                '<div class="rate-widget">' + rateBtns + '<span style="color:var(--dim);font-size:12.5px;margin-left:8px">' + (myRate ? '你已评 ' + myRate + ' 星' : '点星打分') + '</span></div>' +
              '</div>' +
            '</div>' +
            '<div style="margin-top:18px">' + distRows + '</div>' +
          '</div>' +
        '</div>' +
        '<aside class="side-col">' +
          '<div class="side-card"><h3>Lumo 评分说明</h3>' +
            '<p style="color:var(--muted);font-size:13px">Lumo 评分(0–10)综合公开信息核验、风险记录、用户评价与运营透明度得出,与用户打分相互独立。</p>' +
            '<div class="quote-block" style="margin-top:10px"><p style="font-size:12.5px;color:var(--muted)">评分会随新证据更新。</p></div>' +
          '</div>' +
          '<div class="side-card"><h3>评分规则</h3>' +
            '<div class="steps">' +
              '<div class="step"><span class="n">1</span><div><b>公开信息核验</b><p>官网、工商、牌照、报道。</p></div></div>' +
              '<div class="step"><span class="n">2</span><div><b>风险记录比对</b><p>黑名单与投诉记录。</p></div></div>' +
              '<div class="step"><span class="n">3</span><div><b>人工复核</b><p>关键结论逐条确认。</p></div></div>' +
            '</div>' +
            '<a class="pick-link" href="#/about" data-scroll-to="method">查看完整规则 &rarr;</a>' +
          '</div>' +
          '<div class="side-card"><h3>遇到问题?</h3>' +
            '<p style="color:var(--muted);font-size:13px;margin-bottom:12px">发现信息有误或疑似诈骗?告诉我们,编辑会复核。</p>' +
            '<button class="btn btn-ghost btn-block" type="button" data-report>报告问题</button>' +
          '</div>' +
          '<div class="side-card disclaimer-box"><strong style="color:var(--muted)">免责声明.</strong>评分基于公开信息与用户反馈,仅供参考,不构成投资、交易或任何决策建议。请自行核实并谨慎判断。</div>' +
        '</aside>' +
      '</div>';
  }
    function searchItems(q) {
    var ql = q.trim().toLowerCase();
    if (!ql) return [];
    return ITEMS.filter(function (i) {
      if (i.phase === 'pending') return false;
      var c = catById(i.cat);
      var hay = (i.name + ' ' + i.domain + ' ' + i.tagline + ' ' + (c ? c.title + ' ' + c.en : '')).toLowerCase();
      return hay.indexOf(ql) !== -1;
    });
  }


  function renderResults(mode) {
    var title, lede, base, deadNames = [];
    if (mode === 'all') {
      title = '全部收录';
      lede = '当前收录的全部网站与平台,按综合分排序,不含 DEAD 死亡名单。';
      base = ITEMS.filter(function (i) { return i.phase !== 'pending' && liveInfo(i).key !== 'off'; });
    } else {
      var q = state.lastSearch || '';
      title = '“' + esc(q) + '” 的搜索结果';
      var matched = searchItems(q);
      deadNames = matched.filter(function (i) { return liveInfo(i).key === 'off'; }).map(function (i) { return i.name; });
      base = matched.filter(function (i) { return liveInfo(i).key !== 'off'; });
      lede = base.length ? '找到 ' + base.length + ' 个可访问收录。' : '';
    }
    var list = sortedItems(base);
    var body = '';
    if (list.length) {
      body = '<div class="toolbar"><span class="result-count">' + list.length + ' 个结果 · 按综合分排序</span></div>' +
        '<div class="proj-list">' + list.map(rowItemHTML).join('') + '</div>';
    } else if (deadNames.length) {
      body = '<div class="empty-state"><div style="font-size:34px">&#128477;</div><h3>仅在死亡名单中找到</h3>' +
        '<p>这些网站已确认无法打开或停止运营:' + esc(deadNames.join('、')) + '。请到对应分类的 DEAD 死亡名单查看归档。</p>' +
        '<div class="lookup-actions" style="justify-content:center;margin-top:16px"><a class="btn btn-primary" href="#/">返回首页</a></div></div>';
    } else {
      body = '<div class="empty-state"><div style="font-size:34px">&#128269;</div><h3>暂未收录该网站</h3>' +
        '<p>它可能还没有进入我们的信息库。你可以换个关键词,或告诉我们帮你核实收录。</p>' +
        '<div class="lookup-actions" style="justify-content:center;margin-top:16px">' +
        '<a class="btn btn-primary" href="#/">返回首页</a>' +
        '<a class="btn btn-ghost" href="#/submit">提交收录</a></div></div>';
    }
    view.innerHTML =
      '<div class="page-head"><div class="crumb"><a href="#/">首页</a><span class="sep">/</span><span>' + title + '</span></div>' +
      '<h1>' + title + '</h1>' + (lede ? '<p class="lede">' + lede + '</p>' : '') + '</div>' + body;
  }

  function applyRate(id, starsN) {
    var it = itemById(id);
    if (!it) return;
    if (state.userRates[id]) {
      var old = state.userRates[id];
      it.dist[old - 1] = Math.max(0, it.dist[old - 1] - 1);
    }
    it.dist[starsN - 1] += 1;
    state.userRates[id] = starsN;
    saveSession();
    var total = 0, n = 0;
    for (var s = 0; s < 5; s++) { total += it.dist[s] * (s + 1); n += it.dist[s]; }
    it.userScore = n ? Math.round(total / n * 10) / 10 : 0;
  }

  function renderAbout() {
    var sources = SOURCES.map(function (s) { return '<div class="source-tile"><b>' + esc(s.name) + '</b><span>' + esc(s.note) + '</span></div>'; }).join('');
    var method = METHOD.map(function (m) {
      return '<div class="method-row"><div class="mname">' + esc(m.name) + '</div><div class="mdesc">' + esc(m.desc) + '</div><div class="mval">' + m.val + '</div></div>';
    }).join('');
    var cats = CATEGORIES.map(function (c) { return '<span class="tag">' + c.icon + ' ' + esc(c.title) + '</span>'; }).join('');

    view.innerHTML =
      '<section class="about-hero">' +
        '<h1>关于 Lumo</h1>' +
        '<p class="lede">Lumo 是一个网站与平台信息库:收录不同网站类型的项目与平台,提供简单的项目介绍、平台评分和用户打分,帮你快速判断"它是什么、值不值得信"。</p>' +
      '</section>' +
      '<div class="about-grid">' +
        '<div class="main-col about-body">' +
          '<h2>Lumo 是什么</h2>' +
          '<p>你可以把 Lumo 理解为一本"网站黄页 + 大众点评":搜索一个网址或名称,就能看到它的简介、关键信息、Lumo 平台评分,以及真实用户打出的分数和评价分布。对风险较高的平台,我们会给出明确的风险提示与依据。</p>' +
          '<ul><li><span class="tick">&#10003;</span><span><b>简单介绍。</b>每个收录都有易懂的项目简介。</span></li>' +
          '<li><span class="tick">&#10003;</span><span><b>双轨评分。</b>Lumo 平台评分 + 用户打分相互独立。</span></li>' +
          '<li><span class="tick">&#10003;</span><span><b>风险提示。</b>可疑平台会标注依据与外部证据。</span></li>' +
          '<li><span class="warn">&#9888;</span><span><b>仅供参考。</b>评分不是官方认证,请自行核实。</span></li></ul>' +

          '<h2>覆盖的类型</h2>' +
          '<div class="proj-meta" style="margin-top:6px">' + cats + '</div>' +

          '<h2 id="submit">网站如何被收录</h2>' +
          '<p>网站通过自动发现(公开来源)与用户建议进入候选池,由编辑核验后收录并给出首轮评分。收录时会同时核验<b>运营状态</b>——网站是否可访问、是否开放注册、是否仍在推广;列表中默认只展示“运营中”的网站,已停运或失联的会标注并归档。你可以点击顶部或搜索结果页的「提交收录」提交,提交后进入人工审核,通过后收录到对应类目。</p>' +

          '<h2 id="sources">信息从哪里来</h2>' +
          '<div class="source-grid">' + sources + '</div>' +

          '<h2 id="method">评分规则</h2>' +
          '<p><b>Lumo 平台评分(0–10)</b>:由编辑综合以下维度得出,与用户打分相互独立:</p>' +
          '<div>' + method + '</div>' +
          '<div class="note" style="margin:16px 0"><b>分级:</b>7.5 分及以上为"表现良好" · 4.5–7.4 为"需谨慎" · 低于 4.5 为"高风险"。</div>' +
          '<p><b>用户打分(1–5 星)</b>:登录后即可打分,一个账号对同一网站只计一次,可修改。用户打分仅代表用户个人体验。</p>' +
          '<p><b>排序(综合分)</b>:分类与搜索结果按综合分从高到低排列。综合分 = Lumo 网站评分 × 60% + 用户打分(换算为 10 分制)× 40%。</p>' +
          '<p><b>DEAD 死亡名单</b>:经核验已无法打开或停止运营的网站,会移出正常列表,放入所在分类的“死亡名单”并打上 DEAD 标签,仅作归档、不参与排序。</p>' +

          '<h2 id="disclaimer">免责声明</h2>' +
          '<div class="note"><b>仅供参考。</b>Lumo 上的评分、简介与风险提示基于公开信息和用户反馈,可能不完整或有误,不构成投资、交易、借贷或其他任何决策建议。使用任何网站或平台前,请自行核实其资质与条款。如遇疑似诈骗,请立即停止转账并联系银行、支付平台或当地警方。</div>' +

          '<h2>联系我们</h2>' +
          '<p>纠错、收录建议或合作:<a href="#" data-demo="联系邮箱" style="color:var(--info)">hello@lumo.example</a></p>' +
        '</div>' +
        '<aside class="side-col">' +
          '<div class="side-card"><h3>原型说明</h3>' +
            '<p style="color:var(--muted);font-size:13px">本原型为演示用,除 shark-trades.com(真实高危示例)外,收录网站均为虚构。正式版将接入实时收录、真实评分与审核后台。</p>' +
          '</div>' +
          '<div class="side-card"><h3>路线图</h3>' +
            '<div class="steps">' +
              '<div class="step"><span class="n">1</span><div><b>原型(本版)</b><p>搜索、分类、详情与双轨评分体验。</p></div></div>' +
              '<div class="step"><span class="n">2</span><div><b>实时收录</b><p>真实数据源、自动发现与人工审核。</p></div></div>' +
              '<div class="step"><span class="n">3</span><div><b>成长社区</b><p>账号体系、评价、举报与申诉流程。</p></div></div>' +
            '</div>' +
          '</div>' +
        '</aside>' +
      '</div>';
  }
  function doLogout() {
    fetch('/api/auth/logout', { method: 'POST' }).catch(function () {});
    state.signedIn = false; state.user = null; state.submissions = [];
    updateAuthButton();
    render();
    showToast('已退出登录');
  }

  function serverRate(id, starsN) {
    fetch('/api/items/' + id + '/rate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stars: starsN }) })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (json.error) {
          if (json.error === '请先登录') { state.pendingRate = { id: id, stars: starsN }; openAuth('登录后即可为该网站打分。'); }
          else showToast(json.error);
          return;
        }
        var it = itemById(id);
        if (it) { it.userScore = json.userScore; it.userCount = json.userCount; it.dist = json.dist; }
        state.userRates[id] = json.my;
        render();
        showToast('已为该网站评 ' + starsN + ' 星,感谢参与!');
      });
  }

  function doSearch() {
    var inp = document.getElementById('searchInput');
    var q = inp ? inp.value.trim() : '';
    if (!q) { showToast('请输入网址或名称'); return; }
    var ql = q.toLowerCase();
    var exact = null;
    for (var i = 0; i < ITEMS.length; i++) {
      if (ITEMS[i].domain.toLowerCase() === ql || ITEMS[i].name === q) { exact = ITEMS[i]; break; }
    }
    if (exact) { location.hash = '#/item/' + exact.id; return; }
    state.lastSearch = q;
    location.hash = '#/search';
  }


  function normalizeDomain(u) {
    var s = String(u || '').trim().toLowerCase();
    s = s.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    return s;
  }

  function normalizeSubmissions() { /* 状态由后台审核驱动 */ }

  function renderSubmit() {
    var opts = CATEGORIES.map(function (c) { return '<option value="' + c.id + '">' + c.icon + ' ' + esc(c.title) + '</option>'; }).join('');
    var subsHtml = '';
    if (state.signedIn && state.submissions && state.submissions.length) {
      subsHtml = '<div class="section-head" style="margin-top:4px"><h2>我的提交进度</h2><span style="font-size:12px;color:var(--dim)">只对提交者本人可见</span></div>' +
        '<div class="my-sub">' + state.submissions.map(function (x) {
          var pill, line = '';
          if (x.status === 'pending') {
            pill = '<span class="st-pill pending"><span class="dot"></span>正在审核<span class="subnote">预计 1–2 个工作日</span></span>';
            line = '<div class="progress-line">管理员审核通过后,此处会自动更新为「已收录」</div>';
          } else if (x.status === 'approved' || x.status === 'done') {
            pill = '<span class="st-pill done"><span class="dot"></span>审核完成 · 已收录<span class="subnote"></span></span>';
            line = '<div class="progress-line" style="color:var(--good)">已通过人工审核,可在对应分类中查看</div>';
          } else {
            pill = '<span class="st-pill off"><span class="dot"></span>未通过<span class="subnote"></span></span>';
            line = '<div class="progress-line" style="color:var(--bad)">' + (x.reason ? esc(x.reason) : '未通过审核') + '</div>';
          }
          return '<div class="sub-row"><div><div class="sn">' + esc(x.name) + ' <span class="sd">' + esc(x.domain) + '</span></div>' +
            '<div class="sc">提交至「' + esc(x.catTitle || x.cat) + '」 · ' + esc(new Date(x.at).toLocaleString('zh-CN', { hour12: false })) + '</div></div>' + pill + '</div>' + line;
        }).join('') + '</div>';
    }
    view.innerHTML =
      '<div class="page-head">' +
        '<h1>提交收录</h1>' +
        '<p class="lede">没找到你想找的网站?把它提交给我们。审核通过后,会收录到对应的分类,并参与综合评分排序。</p>' +
      '</div>' + subsHtml +
      '<div class="submit-grid">' +
        '<div class="form-card">' +
          '<h2>网站信息</h2>' +
          '<p class="fc-sub">带 <span style="color:var(--bad)">*</span> 为必填。请尽量提供真实、可核实的信息。</p>' +
          '<form id="submitForm">' +
            '<div class="form-grid">' +
              '<label class="field"><span>网站 / 项目名称 <span class="req">*</span></span><input name="name" required placeholder="例如:萤火钱包"></label>' +
              '<label class="field"><span>网址链接 <span class="req">*</span></span><input name="website" type="url" required placeholder="https://…"></label>' +
              '<label class="field full"><span>所属类目 <span class="req">*</span></span><select name="cat" required><option value="">请选择类目…</option>' + opts + '</select></label>' +
              '<label class="field full"><span>一句话简介 <span class="req">*</span></span><input name="tagline" required maxlength="160" placeholder="这个网站是做什么的?"></label>' +
              '<label class="field full"><span>详细介绍</span><textarea name="intro" rows="5" placeholder="它解决什么问题、有什么风险或亮点、你从哪得知它…"></textarea></label>' +
              '<label class="field full"><span>信息来源 / 证据链接(可选)</span><textarea name="evidence" rows="2" placeholder="官网、报道、应用商店链接等,一行一个"></textarea></label>' +
            '</div>' +
            '<div class="form-foot">' +
              '<label class="check"><input type="checkbox" required><span>我确认以上信息真实,并理解提交后会经过人工审核,通过后才公开展示。</span></label>' +
              '<button class="btn btn-primary btn-block" type="submit">提交,进入审核</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
        '<aside class="side-col">' +
          '<div class="side-card"><h3>流程</h3>' +
            '<div class="steps">' +
              '<div class="step"><span class="n">1</span><div><b>提交</b><p>填写名称、链接与简介(需登录)。</p></div></div>' +
              '<div class="step"><span class="n">2</span><div><b>人工审核</b><p>编辑核实信息与运营状态。</p></div></div>' +
              '<div class="step"><span class="n">3</span><div><b>收录上线</b><p>通过后进入对应分类参与排序。</p></div></div>' +
            '</div>' +
          '</div>' +
          '<div class="side-card disclaimer-box"><strong style="color:var(--muted)">提示.</strong>审核通过不等于背书;未通过或长期无法核实的提交会被拒绝或标注"核实中"。</div>' +
        '</aside>' +
      '</div>';
  }

  

      function handleSubmitNew(e) {
    if (!state.signedIn) {
      state.pendingSubmit = true;
      openAuth('登录后即可提交收录。');
      return;
    }
    var fd = new FormData(e.target);
    var name = (fd.get('name') || '').trim();
    var web = (fd.get('website') || '').trim();
    var cat = fd.get('cat') || '';
    var tagline = (fd.get('tagline') || '').trim();
    if (!name || !web || !cat || !tagline) { showToast('请填写必填项。'); return; }
    fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, website: web, cat: cat, tagline: tagline, intro: (fd.get('intro') || '').trim() })
    }).then(function (r) { return r.json(); }).then(function (json) {
      if (json.error) { showToast(json.error); return; }
      if (!state.submissions) state.submissions = [];
      state.submissions = [json.submission].concat(state.submissions);
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showToast('已提交,进入人工审核 —— 进度见上方「我的提交进度」');
    }).catch(function () { showToast('提交失败,请重试'); });
  }



  

  


  function legalPage(title, intro, sections, updated) {
    var body = sections.map(function (sec) {
      return '<h2>' + esc(sec.h) + '</h2>' + (sec.p || []).map(function (pp) { return '<p>' + pp + '</p>'; }).join('') +
        (sec.ul ? '<ul>' + sec.ul.map(function (li) { return '<li><span class="tick">&#10003;</span><span>' + li + '</span></li>'; }).join('') + '</ul>' : '');
    }).join('');
    view.innerHTML =
      '<div class="page-head"><div class="crumb"><a href="#/">首页</a><span class="sep">/</span><span>' + esc(title) + '</span></div>' +
      '<h1>' + esc(title) + '</h1><p class="lede">' + intro + '</p></div>' +
      '<div class="about-grid"><div class="main-col about-body">' + body +
      '<p style="color:var(--dim);font-size:12px;margin-top:26px">最后更新:' + updated + '</p></div>' +
      '<aside class="side-col"><div class="side-card disclaimer-box">' +
      '<strong style="color:var(--muted)">提示.</strong>Lumo 定位为公开信息聚合与风险提示平台,不是官方机构,也不替代任何监管或司法认定。请以官方来源为准,并自行核实。</div></aside></div>';
  }

  function renderTerms() {
    legalPage('服务条款', '使用 Lumo 即表示你同意以下条款。本平台用于信息检索与风险提示,不构成任何投资、交易或法律建议。', [
      { h: '1. 平台定位', p: ['Lumo 聚合公开来源(监管黑名单、媒体报道、安全检测、用户提交等)形成网站/平台信息库,并对收录条目给出基于公开证据的风险提示与评分。'] },
      { h: '2. 你的使用', ul: ['不得利用本站信息骚扰、威胁或中伤任何个人或组织;', '不得恶意提交虚假收录、批量刷分或滥用举报;', '不得抓取、复制本站全部数据用于商业用途(引用请注明来源)。'] },
      { h: '3. 内容与责任', p: ['收录条目与评分基于可核实证据并附来源,但因公开信息存在滞后或不完整,我们不对其绝对准确或完整作保证。', '我们不对任何依据本站信息作出的决策承担责任。'] },
      { h: '4. 修改与终止', p: ['我们可因合规、安全或运营原因更新条款、调整或移除收录内容,并在合理范围内提前通知。'] }
    ], '2026-09-05');
  }

  function renderPrivacy() {
    legalPage('隐私政策', '我们只收集提供服务所必需的信息,并说明其用途、存储与你的权利。', [
      { h: '1. 我们收集什么', ul: ['登录邮箱(用于发送验证码、识别身份与评分记账);', '你主动提交的内容(收录建议、评价、评分、留言);', '必要运行数据(IP、访问日志、会话状态,用于安全与防滥用);'] },
      { h: '2. 如何使用', p: ['验证码登录与会话保持、按“一账号一票”统计评分、展示你提交的进度、防垃圾与滥用、保障网站安全。我们不会出售你的数据。'] },
      { h: '3. 存储与第三方', p: ['数据存储于我们配置的服务器/持久磁盘;登录验证码邮件通过第三方邮件服务(如 Resend)发送;收录证据存档可能查询互联网档案馆(Wayback)。各第三方仅按其自身政策处理必要数据。'] },
      { h: '4. 你的权利', p: ['你可通过页面“退出”注销会话;如需更正或删除账号与个人数据,可联系我们(见联系方式),我们会在核实身份后处理。'] },
      { h: '5. 安全与儿童', p: ['我们采用 HTTPS、会话 Cookie、限流等措施保护数据;本服务不面向儿童,不故意收集未成年人信息。'] }
    ], '2026-09-05');
  }

  function renderAppeals() {
    legalPage('收录申诉', '如你(或你代表的组织)认为某条收录信息有误、存在遗漏证据,或被错误标记为风险/DEAD,可提交申诉。', [
      { h: '1. 什么情况可申诉', ul: ['收录内容与事实不符、来源引用错误;', '被错误标记为“风险提示”或 DEAD,且你能提供反向证据;', '身份/主体被冒用,或涉及你方知识产权的材料。'] },
      { h: '2. 如何申诉', p: ['请准备:(a) 你的身份/主体说明;(b) 涉及的收录链接或域名;(c) 逐条反驳的证据(官网、工商、牌照、审计、官方声明等)。', '将上述材料通过页面“联系我们”邮箱发送,标题注明【申诉】。'] },
      { h: '3. 处理流程', ul: ['收到后我们进行人工复核(非自动判定);', '需要补充证据时会通过你提供的邮箱联系;', '复核结论(更正/降级/移除/维持)将回信告知,并在条目修订记录中留痕;'] },
      { h: '4. 说明', p: ['申诉不保证必然移除。为平衡公信力与公平,我们优先“以证据纠正”,仅在证据充分时移除或降级。恶意申诉会被拒绝。'] }
    ], '2026-09-05');
  }
  function render() {
    var raw = (location.hash || '#/').slice(2);
    var qIdx = raw.indexOf('?');
    var queryStr = qIdx >= 0 ? raw.slice(qIdx + 1) : '';
    var base = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
    var parts = base.split('/');
    var route = 'home';
    var arg = null;

    if (parts[0] === 'cat' && parts[1]) { route = 'cat'; arg = parts[1]; }
    else if (parts[0] === 'item' && parts[1]) { route = 'item'; arg = parts[1]; }
    else if (parts[0] === 'search' || parts[0] === 'all') { route = 'results'; arg = queryStr.indexOf('all=1') !== -1 ? 'all' : 'query'; }
    else if (parts[0] === 'submit') route = 'submit';
    else if (parts[0] === 'terms') route = 'terms';
    else if (parts[0] === 'privacy') route = 'privacy';
    else if (parts[0] === 'appeals') route = 'appeals';
    else if (parts[0] === 'about') route = 'about';

    if (route === 'home') renderHome();
    else if (route === 'cat') renderCat(arg);
    else if (route === 'item') { state.currentItemId = arg; renderItem(arg); }
    else if (route === 'results') renderResults(arg);
    else if (route === 'submit') renderSubmit();
    else if (route === 'terms') renderTerms();
    else if (route === 'privacy') renderPrivacy();
    else if (route === 'appeals') renderAppeals();
    else if (route === 'about') renderAbout();

    setActiveNav(route);
    updateAuthButton();
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', function (e) {
    var t = e.target;

    var demo = t.closest('[data-demo]');
    if (demo) { e.preventDefault(); showToast(demo.getAttribute('data-demo') + ' — 原型中为示例,正式版会接通真实流程。'); return; }

    var dismiss = t.closest('[data-dismiss-banner]');
    if (dismiss) { var b = document.getElementById('demoBanner'); if (b) b.classList.add('hidden'); return; }

    var report = t.closest('[data-report]');
    if (report) { showToast('已记录 — 报告/收录建议功能将在正式版上线。'); return; }

    var catnav = t.closest('[data-catnav]');
    if (catnav) { location.hash = '#/cat/' + catnav.getAttribute('data-catnav'); return; }

    var extRisk = t.closest('a[data-risk-external]');
    if (extRisk) {
      e.preventDefault();
      state.riskUrl = extRisk.href;
      var rm = document.getElementById('riskModal');
      var ru = document.getElementById('riskUrl');
      if (rm) rm.hidden = false;
      if (ru) ru.textContent = state.riskUrl;
      return;
    }
    var extA = t.closest('a.item-domain');
    if (extA) { return; }

    var item = t.closest('[data-item]');
    if (item) {
      var iid = item.getAttribute('data-item');
      if (location.hash === '#/item/' + iid) return;
      location.hash = '#/item/' + iid;
      return;
    }

    var rate = t.closest('[data-rate]');
    if (rate) {
      var starsN = parseInt(rate.getAttribute('data-rate'), 10);
      var iid2 = state.currentItemId;
      if (!iid2) return;
      if (!state.signedIn) {
        state.pendingRate = { id: iid2, stars: starsN };
        openAuth('登录后即可为该网站打分。');
        return;
      }
      serverRate(iid2, starsN);
      return;
    }

    var livef = t.closest('[data-livefilter]');
    if (livef) { state.live = livef.getAttribute('data-livefilter'); render(); return; }

    var recheck = t.closest('[data-recheck]');
    if (recheck) { showToast('正在重新检测运营状态(原型演示)——正式版将实时检查网站可访问性、注册页与推广记录。'); return; }

    var need = t.closest('[data-need-login]');
    if (need) { e.preventDefault(); openAuth('登录后即可查看完整域名与访问官网。'); return; }

    var back = t.closest('[data-auth-back]');
    if (back) {
      var ef = document.getElementById('authEmailForm');
      var cs = document.getElementById('authStepCode');
      var hint = document.getElementById('authHint');
      if (ef) ef.style.display = '';
      if (cs) cs.hidden = true;
      if (hint) hint.textContent = '演示环境:任意邮箱均可,验证码统一为 123456。';
      return;
    }

    var stp = t.closest('[data-scroll-top]');
    if (stp) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }

    var clearHist = t.closest('[data-clear-history]');
    if (clearHist) { state.history = []; saveSession(); render(); return; }

    var riskGo = t.closest('[data-risk-go]');
    if (riskGo) {
      var rm2 = document.getElementById('riskModal');
      if (rm2) rm2.hidden = true;
      if (state.riskUrl) window.open(state.riskUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    var riskCancel = t.closest('[data-risk-cancel]');
    if (riskCancel) { var rm3 = document.getElementById('riskModal'); if (rm3) rm3.hidden = true; return; }

    if (t.closest('#authBtn')) {
      if (state.signedIn) { doLogout(); } else { openAuth(); }
      return;
    }

    if (t.closest('#menuBtn')) {
      var open = siteNav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }

    if (t.closest('[data-close-modal]')) { closeModals(); return; }
    if (t.classList && t.classList.contains('modal-backdrop')) { closeModals(); return; }

    var scrollTo = t.closest('[data-scroll-to]');
    if (scrollTo) {
      e.preventDefault();
      var targetId = scrollTo.getAttribute('data-scroll-to');
      if (location.hash !== '#/about') {
        location.hash = '#/about';
        setTimeout(function () { var el = document.getElementById(targetId); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 90);
      } else {
        var el2 = document.getElementById(targetId);
        if (el2) el2.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }
  });

  document.addEventListener('change', function (e) {
    if (e.target.id === 'sortSel') {
      state.sort = e.target.value;
      render();
    }
  });

  document.addEventListener('submit', function (e) {
    if (e.target.id === 'searchForm') { e.preventDefault(); doSearch(); }
    if (e.target.id === 'submitForm') { e.preventDefault(); handleSubmitNew(e); }
    if (e.target.id === 'authEmailForm') {
      e.preventDefault();
      var email = document.getElementById('authEmail').value.trim();
      if (!email || email.indexOf('@') === -1) { showToast('请输入有效邮箱'); return; }
      fetch('/api/auth/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var hint = document.getElementById('authHint');
          if (hint && j && j.hint) hint.textContent = j.hint;
          else if (hint) hint.textContent = '验证码已发送,请查收邮箱。';
        }).catch(function () {});
      var mshow = document.getElementById('authMailShow');
      var cs = document.getElementById('authStepCode');
      var ef = document.getElementById('authEmailForm');
      var hint = document.getElementById('authHint');
      if (mshow) mshow.textContent = email;
      if (ef) ef.style.display = 'none';
      if (cs) cs.hidden = false;
      setTimeout(function () { var ac = document.getElementById('authCode'); if (ac) ac.focus(); }, 60);
    }
    if (e.target.id === 'authCodeForm') {
      e.preventDefault();
      var code = document.getElementById('authCode').value.trim();
      var email = document.getElementById('authMailShow').textContent;
      fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, code: code }) })
        .then(function (r) { return r.json(); })
        .then(function (json) {
          if (json.error) { showToast(json.error); return; }
          state.signedIn = true; state.user = json.user;
          state.userRates = json.rates || {};
          state.submissions = json.submissions || [];
          state.history = state.history || [];
          closeModals();
          updateAuthButton();
          showToast('已登录 ' + json.user);
          if (state.pendingRate) {
            var pr = state.pendingRate; state.pendingRate = null;
            serverRate(pr.id, pr.stars);
          } else if (state.pendingSubmit) {
            state.pendingSubmit = null;
            showToast('已登录 — 请再次点击「提交收录」完成提交。');
          } else {
            render();
          }
        });
    }
  });

  window.addEventListener('hashchange', render);

  state.signedIn = !!window.BOOT_USER;
  state.user = window.BOOT_USER || null;
  state.userRates = window.BOOT_MY_RATES || {};
  render();
  fetch('/api/me').then(function (r) { return r.ok ? r.json() : null; }).then(function (me) {
    if (me && me.user) {
      state.signedIn = true; state.user = me.user;
      state.userRates = me.rates || {};
      state.submissions = me.submissions || [];
      updateAuthButton();
      render();
    }
  }).catch(function () {});
})();
/* Lumo — front-end application logic. */

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


  var EN_DICT = {
  '提交平台需要登录用户':'Sign-in required',
  '没找到你想找的网站?告诉我们,审核通过后会收录到对应分类。':'Missing a site? Submit it — it appears after human review.',
  '审核通过后,会收录到对应的分类,并参与综合评分排序。':'After approval it is listed in its category and ranked.',
  '我的提交进度':'My submissions',
  '只对提交者本人可见':'visible only to you',
  '提交至':'Submitted to',
  '正在审核':'Under review',
  '审核完成 · 已收录':'Approved · listed',
  '审核完成':'Approved',
  '预计 1–2 个工作日':'usually 1–2 business days',
  '未通过审核':'Rejected',
  '未通过':'Rejected',
  '管理员审核通过后,此处会自动更新为「已收录」':'Updates automatically after an admin approves it.',
  '已通过人工审核,可在对应分类中查看':'Approved — find it in its category.',
  '综合排序(网站评分+用户打分)':'Ranked (site score + user rating)',
  '按 Lumo 网站评分':'By Lumo score',
  '按用户打分':'By user rating',
  '最新收录':'Newest',
  '可访问收录':'active listings',
  '个结果':' results',
  '该状态下暂无收录':'Nothing here yet',
  '试试切换上方的状态筛选。':'Try a different filter.',
  '运营名单':'Live listings',
  '死亡名单':'Dead list',
  '已确认无法打开 / 停止运营':'Confirmed offline / shut down',
  '仅归档,不参与排序':'archived — not ranked',
  '可访问 · 可注册 · 仍在推广':'reachable · registrable · still promoted',
  'DEAD':'DEAD',
  '正常收录':'Official reference','官方参考':'Official reference',
  '风险提示':'High risk',
  '核实中':'Under review',
  '运营中':'Live',
  '部分活跃':'Partially active',
  '已停运':'Offline',
  '表现良好':'Trusted',
  '需谨慎':'Caution',
  '高风险':'High risk',
  '收录于 ':'Added ',
  '综合 ':'Score ',
  '人评分':' ratings',
  '满分 5 星':'out of 5',
  '点星打分':'Tap a star to rate',
  '你已评 ':'You rated ',
  ' 星':' stars',
  '人':' people',
  '项目简介':'About this site',
  '关键信息':'Key information',
  '收录依据':'Listing basis',
  '用户评价':'User ratings',
  '运营状态核验':'Operational check',
  '最近核验 ':'Last checked ',
  '仅“运营中”表示三项全部通过':'Live = all three checks pass',
  '重新检测':'Re-check',
  '网站可访问':'Reachable','可以打开':'Yes','无法访问':'No',
  '可注册 / 开户':'Registrable','开放注册':'Yes','已暂停注册':'No',
  '仍在推广':'Still promoted','未见推广':'No',
  '外部证据':'External evidence',
  '可点击查看':'click to view',
  '低信任分':'low trust score',
  '信任分':'trust score',
  '黑名单警告':'blacklist warning',
  'ScamAdviser 低信任分':'ScamAdviser: low trust',
  'ScamDoc 8% 信任分':'ScamDoc: 8% trust',
  'Gridinsoft 黑名单警告':'Gridinsoft: blacklist',
  'Trustpilot 提现投诉':'Trustpilot: withdrawal complaints',
  '请勿向其转账或连接钱包':'Do not send money or connect a wallet',
  '该网站存在多项风险信号,详情见下方收录依据与外部证据。':'Multiple risk signals — see the listing basis and external evidence below.',
  '证据不足,正在人工复核。':'Insufficient evidence — under human review.',
  '当前证据不足以定性,正在人工复核。':'Current evidence is inconclusive — under human review.',
  '风险与运营状态仍在核实中':'Risk and operational status still under review',
  '报告问题':'Report issue',
  '建议收录':'Suggest listing',
  '分享卡':'Share card',
  '复制链接':'Copy link',
  '链接已复制':'Link copied',
  '生成可转发给朋友的风险提示卡片':'Make a card you can forward to warn others.',
  '下载图片':'Download image',
  '复制图片':'Copy image',
  '已复制':'Copied',
  '复制失败':'Copy failed',
  '仅作参考,不构成投资建议':'For reference only - not investment advice.',
  '访问官网':'Visit website',
  '登录查看官网':'View website',
  '查看完整域名':'view full domain',
  '登录后即可访问官网。':'Sign in to visit official sites.',
  '登录后即可为该网站打分。':'Sign in to rate this site.',
  '登录后即可提交收录。':'Sign in to submit.',
  '请输入有效邮箱':'Enter a valid email',
  '验证码错误':'Wrong code',
  '验证码已过期,请重新发送':'Code expired — please resend',
  '已登录 ':'Signed in ',
  '已退出登录':'Signed out',
  'Sign out (':'Sign out (',
  '验证码':'Code',
  '发送验证码':'Send code',
  '演示验证码:123456':'Demo code: 123456',
  '演示环境:任意邮箱均可,验证码统一为 123456。':'Demo: any email; the code is shown below.',
  '网站信息':'Site details',
  '带 * 为必填。请尽量提供真实、可核实的信息。':'Required fields are marked *. Please provide real, verifiable information.',
  '网站 / 项目名称 *':'Site / project name *',
  '网站名称 *':'Site name *',
  '所属类目 *':'Category *',
  '请选择类目…':'Select a category…',
  '请选择分类…':'Select a category…',
  '一句话简介 *':'One-line summary *',
  '介绍这个网站是做什么的?':'What does this site do?',
  '详细介绍':'Full description',
  '信息来源 / 证据链接(可选)':'Sources / evidence links (optional)',
  '官网、报道、应用商店链接等,一行一个':'Official site, articles, store links — one per line',
  '我确认以上信息真实,并理解提交后会经过人工审核,通过后才公开展示。':'I confirm this is accurate and understand it is reviewed before publishing.',
  '提交,进入审核':'Submit for review',
  '提交,进入人工审核':'Submit for review',
  '请填写必填项。':'Please fill in the required fields.',
  '提交失败,请重试':'Submission failed, please retry.',
  '已提交,进入人工审核':'Submitted — under review',
  '已提交':'Submitted',
  '进入人工审核':'for review',
  '管理员审核通过后,此处将自动更新':'Updates after admin approval',
  '返回首页':'Back to home',
  '编号':'Ref',
  '全部收录':'All listings',
  '当前收录的全部网站与平台':'All listed sites and platforms',
  '不含 DEAD 死亡名单':'excluding the Dead list',
  '的搜索结果':' — search results',
  '找到 ':'Found ',
  '个相关收录':'related listings',
  '暂未收录该网站':'Not in the directory yet',
  '它可能还没有进入我们的信息库。你可以换个关键词,或告诉我们帮你核实收录。':'It may not be in our database yet. Try another keyword, or tell us and we will look into it.',
  '仅在死亡名单中找到':'Only in the Dead list',
  '这些网站已确认无法打开或停止运营:':'These sites are confirmed offline:',
  '请到对应分类的 DEAD 死亡名单查看归档。':'See the Dead list in its category for the archive.',
  '首页':'Home',
  '关于 Lumo':'About Lumo',
  '关于':'About',
  'Lumo 是什么':'What is Lumo',
  '覆盖的类型':'Categories we cover',
  '网站如何被收录':'How sites are listed',
  '信息从哪里来':'Where data comes from',
  '评分规则':'Scoring method',
  '复核与申诉':'Review & appeals',
  '申诉':'Appeals',
  '联系方式':'Contact',
  '提交':'Submit',
  '收录':'Listings',
  '均分':'Avg',
  '风险':'Risky',
  '已收录':'Listed',
  '网址':'Website',
  '名称':'Name',
  '类目':'Category',
  '分类':'Category',
  '类型':'Type',
  '来源':'Source',
  '状态':'Status',
  '收录时间':'Added',
  '数据':'Data',
  '暂无':'No',
  '全部':'All',
  '返回':'Back',
  '查看':'View',
  '详情':'Details',
  '评分':'Score',
  '用户评分':'User rating',
  '简介':'About',
  '内容':'Content',
  '我的':'My',
  '最近浏览':'Recently viewed',
  '清空':'Clear',
  '位用户打分':' users rated',
  '个':'',
  '综合公开信息核验、Risky记录、User ratings与运营透明度得出,与用户打分相互独立。':'combines public-record checks, risk records, user ratings and operating transparency — separate from user votes.',
  '公开信息核验':'Public records',
  '官网、工商、牌照、报道。':'Official site, registrations, licences, media.',
  'Risky记录比对':'Risk-record checks',
  '人工复核':'Human review',
  '关键结论逐条确认':'each conclusion is verified',
  'LUMO SCORE说明':'About the Lumo score',
  'Lumo Score(0–10)综合公开信息核验、Risky记录、User ratings与运营透明度得出,与用户打分相互独立。':'The Lumo score (0–10) combines public-record checks, risk records, user ratings and operating transparency — it is independent of user votes.',
  'Score会随新证据更新。':'Scores update as new evidence appears.',
  'Details见下方Listing basis与External evidence。':'See the listing basis and external evidence below.',
  '该网站存在多项High risk信号,Details见下方Listing basis与External evidence。':'Multiple high-risk signals — details in the listing basis and external evidence below.',
  'Lumo 是一个网站与平台信息库:Listings不同网站Type的项目与平台,提供简单的项目介绍、平台Score和用户打分,帮你快速判断"它是什么、值不值得信"。':'Lumo is a directory of websites and platforms across different types, with a simple intro, a platform score and user votes, so you can quickly judge what a site is and whether to trust it.',
  '你可以把 Lumo 理解为一本"网站黄页 + 大众点评":搜索一个Website或Name,就能看到它的About、Key information、Lumo 平台Score,以及真实用户打出的分数和评价分布。对Risky较高的平台,我们会给出明确的High risk与依据。':'Think of Lumo as a website directory plus reviews: search a site or name to see its intro, key facts, Lumo score, real user votes and rating distribution. Higher-risk platforms get clear warnings with evidence.',
  '简单介绍。每个Listings都有易懂的About this site。':'Simple intros — every listing includes an easy-to-read overview.',
  '双轨Score。Lumo 平台Score + 用户打分相互独立。':'Two independent signals: the Lumo score and user votes.',
  'High risk。可疑平台会标注依据与External evidence。':'High-risk platforms show their evidence and external sources.',
  '仅供参考。Score不是官方认证,请自行核实。':'For reference only. Scores are not official certifications — always verify yourself.',
  '网站通过自动发现(公开Source)与用户建议进入候选池,由编辑核验后Listings并给出首轮Score。':'Sites enter via automated discovery and user suggestions, are reviewed by editors, then listed with an initial score.',
  'Listings时会同时核验运营Status——网站是否可访问、是否Yes、是否Still promoted;列表中默认只展示“Live”的网站,Offline或失联的会标注并归档。':'Each listing also checks whether the site is reachable, registrable and still promoted; only live sites show by default, and offline ones are archived with a label.',
  '你可以点击顶部或搜索结果页的「SubmitListings」Submit,Submit后for review,通过后Listings到对应Category。':'Use “Submit a site” to submit; entries go through human review before being listed in their category.',
  '使用 Lumo 即表示你同意以下条款。本平台用于信息检索与High risk,不构成任何投资、交易或法律建议。':'By using Lumo you agree to these terms. Lumo is an information and risk-signal platform — not investment, trading or legal advice.',
  '1. 平台定位':'1. What Lumo is',
  'Lumo 聚合公开Source(监管黑名单、媒体报道、安全检测、用户Submit等)形成网站/平台信息库,并对Listings条目给出基于公开证据的High risk与Score。':'Lumo aggregates public sources (regulator blacklists, media, security scanners, user submissions) into a directory and gives evidence-based risk signals and scores.',
  '2. 你的使用':'2. Your use',
  '不得利用本站信息骚扰、威胁或中伤任何个 people或组织;':'You may not use Lumo to harass, threaten or defame anyone;',
  '服务条款':'Terms of Service',
  'Home/服务条款':'Home / Terms',
  '隐私政策':'Privacy Policy',
  'Home/隐私政策':'Home / Privacy',
  '收录申诉':'Appeals',
  'Home/Listings申诉':'Home / Appeals',
  '如你(或你代表的组织)认为某条Listings信息有误、存在遗漏证据,或被错误标记为Risky/DEAD,可SubmitAppeals。':'If you or your organization believe a listing is wrong, misses evidence, or was wrongly marked risky/DEAD, you can appeal.',
  '1. 什么情况可Appeals':'1. When to appeal',
  'ListingsContent与事实不符、Source引用错误;':'Listing content conflicts with facts or misquotes a source;',
  '被错误标记为“High risk”或 DEAD,且你能提供反向证据;':'Wrongly marked “high risk” or DEAD, and you can provide counter-evidence;',
  '身份/主体被冒用,或涉及你方知识产权的材料。':'Identity misuse, or material that infringes your rights.',
  '2. 如何Appeals':'2. How to appeal',
  '请准备:(a) 你的身份/主体说明;(b) 涉及的Listings链接或域名;(c) 逐条反驳的证据(官网、工商、牌照、审计、官方声明等)。':'Prepare: (a) who you are; (b) the listing link or domain; (c) point-by-point evidence (official sites, registrations, licences, audits, statements).',
  '我们只收集提供服务所必需的信息,并说明其用途、存储与你的权利。':'We only collect what is needed to run the service, and explain how it is used and stored.',
  '1. 我们收集什么':'1. What we collect',
  '登录邮箱(用于Send code、识别身份与Score记账);':'Login email (to send codes, identify you and record votes);',
  '你主动Submit的Content(Listings建议、评价、Score、留言);':'Content you submit (suggestions, ratings, scores, reports, messages);',
  '必要运行Data(IP、访问日志、会话Status,用于安全与防滥用);':'Necessary operational data (IP, access logs, session state) for security and anti-abuse;',
  '2. 如何使用':'2. How it is used',
  '3. 存储与第三方':'3. Storage & third parties',
  '4. 你的权利':'4. Your rights',
  '5. 安全与儿童':'5. Security & children',
  '流程':'Process',
  '没找到你想找的网站?把它Submit给我们。':'Can’t find a site? Submit it to us.',
  'After approval it is listed in its category and ranked.':'After approval it is listed in its category and ranked.',
  '网站 / 项目Name *':'Site / project name *',
  'Website链接 *':'Website URL *',
  '所属Category *':'Category *',
  '一句话About *':'One-line summary *',
  '清空':'Clear',
  '最后更新:2026-09-05':'Last updated: 2026-09-05',
  '提示.Lumo 定位为公开信息聚合与High risk平台,不是官方机构,也不替代任何监管或司法认定。请以官方Source为准,并自行核实。':'Note: Lumo aggregates public risk signals. It is not an official body and does not replace regulators or courts — verify against official sources.',
  'LUMO SCORE说明':'About the Lumo score',
  'Lumo Score(0–10)综合Public records、Risky记录、User ratings与运营透明度得出,与用户打分相互独立。':'The Lumo score (0–10) combines public records, risk records, user ratings and operating transparency — separate from user votes.',
  '黑名单与投诉记录。':'Blacklists and complaints.',
  'View完整规则 →':'View full method →',
  '遇到问题?':'Found a problem?',
  '发现信息有误或疑似诈骗?告诉我们,编辑会复核。':'See an error or a suspected scam? Tell us — an editor will review it.',
  '免责声明.Score基于公开信息与用户反馈,仅供参考,不构成投资、交易或任何决策建议。请自行核实并谨慎判断。':'Disclaimer. Scores are based on public information and user feedback — for reference only. Verify independently.',
  '按综合分排序':'sorted by combined score',
  'excluding the Dead list。':'excluding the Dead list.',
  '个 active listings':' active listings',
  '输入网址或名称,如 shark-trades.com':'Enter a website or name, e.g. shark-trades.com',
  '请输入网址或名称':'Please enter a website or name'
};


  function enHtml(html) {
    if (!html) return html;
    var keys = Object.keys(EN_DICT);
    keys.sort(function (a, b) { return b.length - a.length; });
    for (var pass = 0; pass < 4; pass++) {
      for (var i = 0; i < keys.length; i++) {
        html = html.split(keys[i]).join(EN_DICT[keys[i]]);
      }
    }
    html = html
      .replace(/[\u3002\uff61\uff0e]/g, '.')
      .replace(/[\uff0c\u3001]/g, ', ')
      .replace(/\uff1f/g, '?')
      .replace(/\uff1a/g, ':')
      .replace(/\uff1b/g, ';')
      .replace(/[\u201c\u201d\u300c\u300d]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/\uff08/g, '(')
      .replace(/\uff09/g, ')')
      .replace(/\u3000/g, ' ');
    return html;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function level(r) {
    if (r >= 7.5) return { c: 'lv-good', label: 'Trusted', color: '#34d399' };
    if (r >= 4.5) return { c: 'lv-mid', label: 'Caution', color: '#fbbf24' };
    return { c: 'lv-bad', label: 'High risk', color: '#f87171' };
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
    if (status === 'ok') return '<span class="badge bd-official">Official reference</span>';
    if (status === 'risk') return '<span class="badge bd-risk">风险提示</span>';
    return '<span class="badge bd-review">Under review</span>';
  }

  function catById(id) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === id) return CATEGORIES[i];
    return null;
  }

  function itemById(id) {
    if (!id) return null;
    for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id || (ITEMS[i].domain||'').toLowerCase() === String(id).toLowerCase()) return ITEMS[i];
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
    if (!l.online) return { key: 'off', label: 'Offline' };
    if (l.signup && l.promo) return { key: 'on', label: 'Live' };
    return { key: 'part', label: 'Partially active' };
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
    el.textContent = enHtml(msg);
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
    authBtn.textContent = state.signedIn ? 'Sign out (' + userHandle() + ')' : 'Sign in';
    var ct = document.getElementById('contactTop');
    if (ct) ct.hidden = !state.signedIn;
  }


  function cardStatusOf(it){
    var dead = liveInfo(it).key === 'off';
    if (dead) return { label: 'Offline / DEAD', cls: 'dead' };
    if (it.status === 'risk') return { label: 'Risk warning', cls: 'risk' };
    if (it.status === 'ok') return { label: 'Official reference', cls: 'ok' };
    return { label: 'Under review', cls: 'review' };
  }
  function wrapLines2(g, text, maxW, font, maxLines){
    // Greedy word wrap that never lets a line exceed maxW, caps at maxLines,
    // splits oversized single words by character and appends an ellipsis when truncated.
    g.font = font;
    var src = String(text == null ? '' : text).replace(/\s+/g, ' ').replace(/^ | $/g, '');
    var words = src ? src.split(' ') : [];
    var lines = [], cur = '', overflow = false;
    function placeWord(w){
      var cand = cur === '' ? w : cur + ' ' + w;
      if (g.measureText(cand).width <= maxW) { cur = cand; return true; }
      if (cur !== '') {
        lines.push(cur); cur = '';
        if (lines.length >= maxLines) { overflow = true; return false; }
      }
      if (g.measureText(w).width <= maxW) { cur = w; return true; }
      // single word wider than a full line -> split by characters
      var k = 0;
      while (k < w.length) {
        var best = '';
        for (var j = k; j < w.length; j++) {
          var c = w.slice(k, j + 1);
          if (g.measureText(c).width > maxW) break;
          best = c;
        }
        if (!best) best = w.charAt(k);
        if (cur !== '') {
          lines.push(cur); cur = '';
          if (lines.length >= maxLines) { overflow = true; return false; }
        }
        cur = best; k += best.length;
      }
      return true;
    }
    for (var i = 0; i < words.length; i++) {
      if (!placeWord(words[i])) break;
    }
    if (cur !== '') {
      if (lines.length < maxLines) lines.push(cur);
      else overflow = true;
    }
    if (overflow && lines.length) {
      var last = lines[lines.length - 1], ell = '\u2026';
      while (last !== '' && g.measureText(last + ell).width > maxW) last = last.slice(0, -1);
      lines[lines.length - 1] = last === '' ? ell : last + ell;
    }
    return lines;
  }
  function fitOneLine(g, text, maxW, font){
    g.font = font;
    var t = String(text == null ? '' : text);
    if (g.measureText(t).width <= maxW) return t;
    var ell = '\u2026', a = 0, b = t.length;
    while (a < b) {
      var m = Math.ceil((a + b) / 2);
      if (g.measureText(t.slice(0, m) + ell).width <= maxW) a = m;
      else b = m - 1;
    }
    return t.slice(0, a) + ell;
  }
  function drawShareCard(it){
    var cv = document.getElementById('shareCanvas');
    if (!cv) return;
    var W = 1080, H = 1350;
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    var dead = liveInfo(it).key === 'off';
    var url = shareItemUrl(it);
    var st = cardStatusOf(it);
    var accent = st.cls === 'dead' ? '#ff8a8a' : st.cls === 'risk' ? '#ff9d9d' : st.cls === 'ok' ? '#67e8b0' : '#f5d06b';
    var gold = '#e8c166';
    var glowCol = st.cls === 'dead' ? 'rgba(210,60,70,.38)' : st.cls === 'risk' ? 'rgba(215,90,95,.3)' : st.cls === 'ok' ? 'rgba(60,210,140,.22)' : 'rgba(235,185,90,.22)';
    var X0 = 66, CW = W - 2 * X0;

    // ---- background ----
    var grad = g.createLinearGradient(0, 0, W, H);
    if (dead) { grad.addColorStop(0, '#2c1016'); grad.addColorStop(.5, '#190a10'); grad.addColorStop(1, '#0c0508'); }
    else if (it.status === 'risk') { grad.addColorStop(0, '#2b1016'); grad.addColorStop(.5, '#18080c'); grad.addColorStop(1, '#0c0508'); }
    else if (it.status === 'ok') { grad.addColorStop(0, '#0e1c15'); grad.addColorStop(.5, '#0a130f'); grad.addColorStop(1, '#060a07'); }
    else { grad.addColorStop(0, '#1a1419'); grad.addColorStop(.5, '#120c13'); grad.addColorStop(1, '#08060c'); }
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.05)';
    for (var gx = 46; gx < W; gx += 74) for (var gy = 46; gy < H; gy += 74) { g.beginPath(); g.arc(gx, gy, 1.5, 0, 7); g.fill(); }
    var orb = function (x, y, r, col) { var rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
    orb(W - 120, 110, 250, glowCol); orb(70, H - 150, 290, st.cls === 'ok' ? 'rgba(70,210,150,.12)' : 'rgba(150,110,230,.12)'); orb(W - 90, H - 100, 190, 'rgba(0,0,0,.3)');
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 2; roundRect(g, 22, 22, W - 44, H - 44, 28); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.03)'; g.lineWidth = 1; roundRect(g, 34, 34, W - 68, H - 68, 18); g.stroke();
    g.fillStyle = accent; g.fillRect(40, 22, 170, 7);

    // ---- header ----
    g.fillStyle = gold; g.font = '900 54px "Segoe UI", system-ui, "Microsoft YaHei", sans-serif';
    g.fillText('LUMO', X0, 94);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '600 19px "Segoe UI", system-ui, sans-serif';
    g.fillText('A N T I - S C A M   D I R E C T O R Y', X0 + 4, 130);
    g.font = '700 26px "Segoe UI", system-ui, "Microsoft YaHei", sans-serif';
    var bw = g.measureText(st.label).width + 64, bx = W - X0 - bw;
    g.fillStyle = st.cls === 'dead' ? 'rgba(220,60,70,.15)' : st.cls === 'risk' ? 'rgba(220,80,85,.13)' : st.cls === 'ok' ? 'rgba(60,200,140,.12)' : 'rgba(235,180,80,.12)';
    roundRect(g, bx, 62, bw, 60, 16); g.fill();
    g.strokeStyle = st.cls === 'dead' ? 'rgba(255,140,145,.6)' : st.cls === 'risk' ? 'rgba(255,140,140,.5)' : st.cls === 'ok' ? 'rgba(110,235,175,.5)' : 'rgba(240,195,110,.5)';
    g.lineWidth = 2.5; g.stroke();
    g.fillStyle = accent; g.textBaseline = 'middle'; g.fillText(st.label, bx + 32, 62 + 30); g.textBaseline = 'alphabetic';

    // ---- measure content (top-packed from first name baseline NB) ----
    var name = String(it.name || '').trim() || (it.domain || '');
    var nsize = name.length > 26 ? 56 : name.length > 15 ? 66 : name.length > 8 ? 80 : 92;
    var lineH = Math.round(nsize * 1.16);
    var nameFont = '800 ' + nsize + 'px "Segoe UI", system-ui, "Microsoft YaHei", sans-serif';
    var nameLines = wrapLines2(g, name, CW, nameFont, 2);
    if (!nameLines.length) nameLines = [''];
    var NB = 250;
    var domFont = '600 38px ui-monospace,Consolas,monospace';
    var domRaw = String(it.domain || '').replace(/^https?:\/\//, '');
    var domText = fitOneLine(g, domRaw, CW - 60, domFont);
    var domY = NB + (nameLines.length - 1) * lineH + 58;
    var domW = Math.min(g.measureText(domText).width + 60, CW);
    var tagY0 = domY + 64;
    var tagFont = '400 34px "Segoe UI", system-ui, "Microsoft YaHei", sans-serif';
    var tagSrc = it.tagline || ''; if (it.intro && tagSrc.length < 110) tagSrc = it.intro;
    var tagLines = wrapLines2(g, tagSrc, CW, tagFont, 2);
    var tagY1 = tagY0 + 66;
    var scoreH = 190, panelH = 226, captionH = 46;
    var scoreTop = tagY1 + (tagLines.length ? (tagLines.length - 1) * 46 + 102 : 102);
    var capY = scoreTop + scoreH + 30;
    var panelTop = scoreTop + scoreH + captionH + 76;
    var panelBottom = panelTop + panelH;

    // vertical balance: centre content block between the header zone and the footer
    var ascent = Math.round(nsize * 0.76);
    var contentTop = NB - ascent;
    var TOP = 184, BOT = H - 120;
    var avail = BOT - TOP, groupH = panelBottom - contentTop;
    var dy = groupH < avail ? Math.round((avail - groupH) / 2) : Math.max(0, TOP - contentTop);

    // ---- name ----
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 14; g.shadowOffsetY = 3;
    g.fillStyle = '#fbfafd'; g.font = nameFont;
    for (var ni = 0; ni < nameLines.length; ni++) g.fillText(nameLines[ni], X0, NB + dy + ni * lineH);
    g.shadowBlur = 0; g.shadowOffsetY = 0;
    // ---- domain pill ----
    var dY = domY + dy;
    g.fillStyle = 'rgba(255,255,255,.05)'; roundRect(g, X0, dY - 38, domW, 62, 18); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1.5; roundRect(g, X0, dY - 38, domW, 62, 18); g.stroke();
    g.fillStyle = 'rgba(226,224,240,.94)'; g.font = domFont;
    g.fillText(domText, X0 + 30, dY);
    // ---- divider + tagline ----
    var tY0 = tagY0 + dy;
    var dg2 = g.createLinearGradient(X0, 0, W - X0, 0); dg2.addColorStop(0, accent); dg2.addColorStop(.5, 'rgba(255,255,255,.2)'); dg2.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = dg2; g.lineWidth = 2; g.beginPath(); g.moveTo(X0, tY0); g.lineTo(W - X0, tY0); g.stroke();
    var tY1 = tagY1 + dy;
    g.fillStyle = 'rgba(255,255,255,.6)'; g.font = tagFont;
    for (var ti = 0; ti < tagLines.length; ti++) g.fillText(tagLines[ti], X0, tY1 + ti * 46);
    // ---- score cards ----
    var sTop = scoreTop + dy, pad = 40, gap = 24, cardW = (W - 2 * pad - gap) / 2;
    function scoreCard(x, y, label, val, denom, colorTop) {
      g.fillStyle = 'rgba(255,255,255,.045)'; roundRect(g, x, y, cardW, scoreH, 22); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1.5; roundRect(g, x, y, cardW, scoreH, 22); g.stroke();
      g.fillStyle = colorTop; g.fillRect(x + 30, y + 26, 46, 6);
      g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '600 22px "Segoe UI", system-ui, sans-serif';
      g.fillText(label, x + 30, y + 64);
      g.fillStyle = '#faf6ea'; g.font = '800 80px "Segoe UI", system-ui, sans-serif';
      var v = String(val);
      var vw = g.measureText(v).width;
      g.fillText(v, x + 30, y + 150);
      g.fillStyle = 'rgba(255,255,255,.42)'; g.font = '600 28px "Segoe UI", system-ui, sans-serif';
      g.fillText(denom, x + 30 + vw + 18, y + 146);
    }
    scoreCard(pad, sTop, 'LUMO SCORE', it.rating, '/10', '#e8c166');
    scoreCard(pad + cardW + gap, sTop, 'USER RATING', userScoreOf(it), '/5', '#f0cd7a');
    // ---- community caption ----
    var cY = capY + dy;
    g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '400 22px "Segoe UI", system-ui, sans-serif';
    g.fillText(userCountOf(it) + ' community ratings', pad + cardW + gap + 30, cY);
    // ---- QR panel ----
    var pTop = panelTop + dy;
    roundRect(g, X0, pTop, CW, panelH, 24); g.fillStyle = 'rgba(255,255,255,.03)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.13)'; g.lineWidth = 2; roundRect(g, X0, pTop, CW, panelH, 24); g.stroke();
    var qrS = panelH - 92, qrX = X0 + 52, qrY = pTop + (panelH - qrS) / 2;
    drawQr(g, url, qrX, qrY, qrS, dead);
    var tx = qrX + qrS + 50, tw = (W - X0) - tx - 44;
    g.fillStyle = accent; g.font = '700 40px "Segoe UI", system-ui, sans-serif';
    g.fillText('Scan to open', tx, pTop + 62);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '400 24px "Segoe UI", system-ui, sans-serif';
    g.fillText('Share this listing', tx, pTop + 104);
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1; g.beginPath(); g.moveTo(tx, pTop + 128); g.lineTo(tx + Math.min(tw, 320), pTop + 128); g.stroke();
    var linkFont = '500 26px ui-monospace,Consolas,monospace';
    var linkLine = fitOneLine(g, url.replace(/^https?:\/\//, ''), tw, linkFont);
    g.fillStyle = '#eccf82'; g.font = linkFont;
    g.fillText(linkLine, tx, pTop + 178);
    // ---- footer (not shifted) ----
    var yb = H - 50;
    g.fillStyle = 'rgba(232,193,102,.9)'; g.font = '700 26px "Segoe UI", system-ui, sans-serif';
    g.fillText('lumoagi.com', X0, yb);
    g.fillStyle = 'rgba(255,255,255,.34)'; g.font = '400 20px "Segoe UI", system-ui, sans-serif';
    g.fillText('For reference only - not investment advice', 330, yb);
  }
  function scoreBlock2(g, label, val, maxStr, x, y, color){
    g.fillStyle='#8a8894'; g.font='600 30px "Segoe UI", system-ui, sans-serif';
    g.fillText(label.toUpperCase(), x, y);
    g.fillStyle='#f5f5f7'; g.font='700 92px "Segoe UI", system-ui, sans-serif';
    var v = String(val);
    g.fillText(v, x, y+104);
    g.fillStyle='#6f6d7a'; g.font='500 36px "Segoe UI", system-ui, sans-serif';
    g.fillText(maxStr, x+ (v.length>=2?118:88), y+86);
    g.fillStyle=color; g.fillRect(x, y+128, 150, 8);
  }
  function wrapText2(g, text, x, y, maxW, lineH, size, maxLines){
    var words = String(text||'').split(/(\s+)/), line='', n=0;
    for (var i=0;i<words.length;i++){
      var test=line+words[i];
      if (g.measureText(test).width>maxW && line!==''){
        g.fillText(line, x, y); line=words[i]; y+=lineH; n++;
        if (n>=maxLines-1){ break; }
      } else line=test;
    }
    if (n<maxLines){ g.fillText(line, x, y); }
    return Math.min(n+1, maxLines);
  }
  function drawQr(g, text, x, y, size, dead){
    if (!window.qrcode) return;
    var qr;
    try { qr = qrcode(0, 'M'); qr.addData(text); qr.make(); } catch(e){ return; }
    var n = qr.getModuleCount();
    var quiet = 2;               // quiet zone in modules
    var cell = Math.floor(size / (n + quiet*2));
    var offX = x + Math.floor((size - cell*(n+quiet*2))/2);
    var offY = y + Math.floor((size - cell*(n+quiet*2))/2);
    // white rounded bg
    g.fillStyle='#ffffff';
    roundRect(g, x-14, y-14, size+28, size+28, 16); g.fill();
    g.fillStyle = dead ? '#151015' : '#101018';
    for (var r=0; r<n; r++) for (var c=0; c<n; c++){
      if (qr.isDark(r,c)) g.fillRect(offX+(c+quiet)*cell, offY+(r+quiet)*cell, cell+0.5, cell+0.5);
    }
  }
  function scoreBlock(g, label, val, maxStr, x, y, color){
    g.fillStyle='#8a8894'; g.font='600 38px "Segoe UI", system-ui, "Microsoft YaHei", sans-serif';
    g.fillText(label.toUpperCase(), x, y);
    g.fillStyle='#f5f5f7'; g.font='700 116px "Segoe UI", system-ui, sans-serif';
    g.fillText(String(val), x, y+128);
    g.fillStyle='#6f6d7a'; g.font='500 44px "Segoe UI", system-ui, sans-serif';
    g.fillText(maxStr, x+ (String(val).length>=2?150:110), y+104);
    g.fillStyle=color; g.fillRect(x, y+164, 170, 10);
  }
  function roundRect(g,x,y,w,h,r){
    g.beginPath();
    g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath();
  }
  function countLines(g, text, maxW, size){
    g.font = '400 ' + size + 'px "Segoe UI", system-ui, "Microsoft YaHei", sans-serif';
    var words=String(text||'').split(/(\s+)/), line='', n=1;
    for (var i=0;i<words.length;i++){ var test=line+words[i]; if (g.measureText(test).width>maxW && line!==''){ line=words[i]; n++; if(n>=4) return n; } else line=test; }
    return n;
  }
  function wrapText(g, text, x, y, maxW, lineH, size, countOnly){
    var words = String(text||'').split(/(\s+)/), line='', n=0, linesArr=[];
    for (var i=0;i<words.length;i++){
      var test=line+words[i];
      if (g.measureText(test).width>maxW && line!==''){
        if (!countOnly) g.fillText(line, x, y); else linesArr.push(line);
        line=words[i]; y+=lineH; n++;
        if (!countOnly && n>=3) { g.fillText((String(text).length>line.length?'…':''), x, y); return n+1; }
        if (countOnly && n>=3) { linesArr.push('…'); return linesArr.length; }
      } else line=test;
    }
    if (!countOnly) g.fillText(line, x, y);
    else if (line) linesArr.push(line);
    return countOnly ? linesArr.length : n+1;
  }
  function shareItemUrl(it){
    var dom = (it && it.domain) ? it.domain : '';
    return location.origin + '/item/' + encodeURIComponent(dom);
  }
  function copyShareLink(){
    var it = itemById(state.currentItemId) || {};
    var url = shareItemUrl(it);
    function done(msg){ var hx=document.getElementById('shareHint'); if(hx) hx.textContent = msg; }
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(function(){ done('Link copied'); }).catch(function(){ fallbackCopy(url, done); });
    } else fallbackCopy(url, done);
  }
  function fallbackCopy(text, done){
    var ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done('Link copied'); } catch(e){ done('Copy failed - select manually'); }
    ta.remove();
  }
  function openShareCard(id){
    var it = id ? itemById(id) : null;
    if (!it) return;
    state.currentItemId = it.id;
    var m = document.getElementById('shareModal');
    if (m) m.hidden = false;
    var h = document.getElementById('shareHint'); if (h) h.textContent='';
    drawShareCard(it);
    var cv = document.getElementById('shareCanvas');
    if (cv) cv.dataset.item = it.id;
  }
  function shareCanvasBlob(){
    return new Promise(function(res, rej){
      var cv = document.getElementById('shareCanvas');
      if (!cv) return rej(new Error('no canvas'));
      if (cv.toBlob) cv.toBlob(function(b){ b?res(b):rej(new Error('blob empty')); }, 'image/png');
      else { var url=cv.toDataURL('image/png'); res(dataURLToBlob(url)); }
    });
  }
  function dataURLToBlob(durl){
    var parts=durl.split(','); var mime=parts[0].match(/:(.*?);/)[1];
    var bin=atob(parts[1]); var arr=new Uint8Array(bin.length);
    for (var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
    return new Blob([arr],{type:mime});
  }
  function downloadShareCard(){
    shareCanvasBlob().then(function(blob){
      var a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      var it=itemById(state.currentItemId)||{};
      a.download='lumo-'+(it.domain||'card').replace(/[^a-z0-9.-]+/gi,'-')+'.png';
      document.body.appendChild(a); a.click();
      setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
      var h=document.getElementById('shareHint'); if(h) h.textContent='Saved as PNG';
    }).catch(function(e){ var h=document.getElementById('shareHint'); if(h) h.textContent='Download failed'; });
  }
  function copyShareCard(){
    shareCanvasBlob().then(function(blob){
      if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem){
        return navigator.clipboard.write([new ClipboardItem({'image/png': blob})]).then(function(){
          var h=document.getElementById('shareHint'); if(h) h.textContent='Copied — paste in chat';
        });
      }
      var url=document.getElementById('shareCanvas').toDataURL('image/png');
      var ta=document.createElement('textarea');
      ta.value=url; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); var h=document.getElementById('shareHint'); if(h) h.textContent='Copied (data URL)'; }
      catch(e){ var h2=document.getElementById('shareHint'); if(h2) h2.textContent='Copy failed — use Download'; }
      ta.remove();
    }).catch(function(){ var h=document.getElementById('shareHint'); if(h) h.textContent='Copy failed — use Download'; });
  }

  function openAuth(subText) {
    var sub = document.getElementById('authSub');
    if (sub) sub.textContent = enHtml(subText) || 'Sign in to rate sites, submit entries and report issues.';
    var em = document.getElementById('authEmailForm');
    var cs = document.getElementById('authStepCode');
    var hint = document.getElementById('authHint');
    if (em) em.style.display = '';
    if (cs) cs.hidden = true;
    var ac = document.getElementById('authCode');
    if (ac) ac.value = '';
    if (hint) hint.textContent = 'We\u2019ll email you a 6-digit code.';
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

  function domainMarkup(it, dead) {
    if (dead) return '<span class="item-domain dead-link">' + esc(it.domain) + '</span>';

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
        '<h1>Find what you are looking for</h1>' +
        '<form class="search-wrap" id="searchForm">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>' +
          '<input class="search-input" id="searchInput" type="search" placeholder="输入网址或名称,如 shark-trades.com" autocomplete="off">' +
          '<button class="btn btn-primary search-go" type="submit">Search</button>' +
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
      var dom = esc(it.domain);
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
    var dom = esc(it.domain);
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
    var liveSec = '<div class="live-sec-title"><h2>Live listings</h2><span class="cnt">' + alive.length + ' active — reachable, registrable, still promoted</span></div>';
    var liveList = alive.length
      ? '<div class="proj-list" id="itemList">' + alive.map(function (i) { return rowItemHTML(i); }).join('') + '</div>'
      : '<div class="empty"><div class="big">&#128269;</div><h3>该分类暂无运营中的网站</h3></div>';
    var deadSec = dead.length
      ? '<section class="dead-sec">' +
        '<div class="dead-sec-head"><span class="dead-badge">DEAD</span><h2>Dead list</h2>' +
        '<span class="dead-note">已确认无法打开 / 停止运营 · ' + dead.length + ' archived — not ranked</span></div>' +
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
      officialBtn = '<a class="btn btn-primary" href="https://' + esc(it.domain) + '" target="_blank" rel="noopener nofollow"' + (it.status === 'risk' ? ' data-risk-external="1"' : '') + '>访问官网</a>';
    }
    var lv = level(it.rating);
    var us = userScoreOf(it);
    var uc = userCountOf(it);

    var kv = it.facts.map(function (f) {
      return '<div class="row"><div class="k">' + esc(f[0]) + '</div><div class="v">' + esc(f[1]) + '</div></div>';
    }).join('') + (it.creditName ? '<div class="row"><div class="k">Lead by</div><div class="v">' + esc('@' + it.creditName) + '</div></div>' : '');

    var la = liveArr(it);
    var lchk = (window.CHECKS || {})[it.id];
    var lchkTxt = lchk ? new Date(lchk.at).toLocaleString('en-GB', { hour12: false, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : String(CHECKED);
    var noteHtml;
    if (lchk) {
      noteHtml = lchk.online
        ? '<div id="checkNote" class="check-note ok">Last live check: reachable' + (lchk.status ? ' (HTTP ' + lchk.status + ')' : '') + '.</div>'
        : '<div id="checkNote" class="check-note bad">Last live check: unreachable' + (lchk.note ? ' \u2014 ' + esc(lchk.note) : '') + '. If this persists, report it or flag it for review.</div>';
    } else {
      noteHtml = '<div id="checkNote" class="check-note dim">Confirmed status last checked ' + esc(String(CHECKED)) + '. Run a live check to verify it still opens.</div>';
    }
    var cells = [
      ['&#127760;', 'Website opens', la.online ? 'Yes' : 'No', la.online],
      ['&#128221;', 'Registration open', la.signup ? 'Yes' : 'No', la.signup],
      ['&#128227;', 'Still promoted', la.promo ? 'Yes' : 'No', la.promo]
    ].map(function (cell) {
      return '<div class="live-cell ' + (cell[3] ? 'ok' : 'no') + '"><div class="ic">' + cell[0] + '</div><b>' + cell[1] + '</b><p>' + cell[2] + '</p></div>';
    }).join('');
    var liveCard = '<div class="card"><h2>Operational check <span class="h2-note" id="liveLastChecked">' + lchkTxt + '</span></h2>' +
      '<div class="live-check">' + cells + '</div>' + noteHtml +
      '<div style="display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap">' + liveBadge(it) +
      '<span style="color:var(--dim);font-size:12.5px">Live = website opens + registration open + still promoted</span>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-recheck style="margin-left:auto">Run live check</button></div></div>';

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
          '<h1>' + esc(it.name) + '<span class="tkr" style="font-family:var(--font);font-weight:400">' + esc(it.domain) + '</span></h1>' +
          '<p class="detail-tagline">' + esc(it.tagline) + '</p>' +
          '<div class="detail-tags">' + badge(it.status) + (liveInfo(it).key === 'off' ? '<span class="badge dead">DEAD</span>' : liveBadge(it)) + '<span class="tag comb">综合 ' + combinedScore(it) + '</span><span class="tag">' + esc(c.title) + '</span><span class="tag">收录于 ' + esc(it.added) + '</span></div>' +
        '</div>' +
        '<div class="detail-actions">' + officialBtn +
          '<button class="btn btn-ghost" type="button" data-share>分享卡</button>' +
          '<button class="btn btn-ghost" type="button" data-copylink title="Copy share link">复制链接</button>' +
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
          '<div class="side-card"><h3>About the Lumo score</h3>' +
            '<p style="color:var(--muted);font-size:13px">The Lumo score (0–10) combines public records, risk records, user ratings and operating transparency. It is separate from user votes.</p>' +
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
          '<div class="side-card disclaimer-box"><strong style="color:var(--muted)">Disclaimer.</strong> Scores are based on public information and user feedback — for reference only. Verify independently before acting.</div>' +
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
      title = 'All listings';
      lede = 'Every website and platform we list, ranked by combined score. The Dead list is excluded.';
      base = ITEMS.filter(function (i) { return i.phase !== 'pending' && liveInfo(i).key !== 'off'; });
    } else {
      var q = state.lastSearch || '';
      title = 'Results for "' + esc(q) + '"';
      var matched = searchItems(q);
      deadNames = matched.filter(function (i) { return liveInfo(i).key === 'off'; }).map(function (i) { return i.name; });
      base = matched.filter(function (i) { return liveInfo(i).key !== 'off'; });
      lede = base.length ? 'Found ' + base.length + (base.length === 1 ? ' active listing.' : ' active listings.') : '';
    }
    var list = sortedItems(base);
    var body = '';
    if (list.length) {
      body = '<div class="toolbar"><span class="result-count">' + list.length + (list.length === 1 ? ' result' : ' results') + ' · sorted by combined score</span></div>' +
        '<div class="proj-list">' + list.map(function (i) { return rowItemHTML(i); }).join('') + '</div>';
    } else if (deadNames.length) {
      body = '<div class="empty-state"><div style="font-size:34px">&#128477;</div><h3>Only in the Dead list</h3>' +
        '<p>These sites are confirmed offline or shut down: ' + esc(deadNames.join(', ')) + '. See the DEAD archive in their category.</p>' +
        '<div class="lookup-actions" style="justify-content:center;margin-top:16px"><a class="btn btn-primary" href="#/">Back to home</a></div></div>';
    } else {
      body = '<div class="empty-state"><div style="font-size:34px">&#128269;</div><h3>Not listed yet</h3>' +
        '<p>It may not be in our directory yet. Try another keyword, or tell us and we will verify it for you.</p>' +
        '<div class="lookup-actions" style="justify-content:center;margin-top:16px">' +
        '<a class="btn btn-primary" href="#/">Back to home</a>' +
        '<a class="btn btn-ghost" href="#/submit">Submit a site</a></div></div>';
    }
    view.innerHTML =
      '<div class="page-head"><div class="crumb"><a href="#/">Home</a><span class="sep">/</span><span>' + title + '</span></div>' +
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

  function openReport(itemId) {
    var it = itemId ? itemById(itemId) : null;
    if (!it) { showToast('Open a listing to report it.'); return; }
    state.reportItemId = itemId;
    var m = document.getElementById('reportModal');
    if (m) m.hidden = false;
    var ri = document.getElementById('reportItem');
    if (ri) ri.textContent = it.name + ' \u2014 ' + it.domain;
    var rd = document.getElementById('reportDetail');
    if (rd) rd.value = '';
    var rk = document.getElementById('reportKind');
    if (rk) rk.value = 'wrong';
  }
  function submitReport(e) {
    e.preventDefault();
    var id = state.reportItemId;
    if (!id) { showToast('Open a listing to report it.'); return; }
    var kind = document.getElementById('reportKind').value;
    var detail = document.getElementById('reportDetail').value.trim();
    if (!detail) { showToast('Please describe the issue.'); return; }
    fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: id, kind: kind, detail: detail }) })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (json.error) { showToast(json.error); return; }
        closeModals();
        showToast('Report received \u2014 our team will review it.');
      }).catch(function () { showToast('Report failed \u2014 try again.'); });
  }
  function runRecheck(id, btn) {
    if (!id) return;
    var oldTxt = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Checking\u2026';
    fetch('/api/items/' + encodeURIComponent(id) + '/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        btn.disabled = false;
        btn.textContent = oldTxt;
        if (json.error) { showToast(json.error); return; }
        if (!window.CHECKS) window.CHECKS = {};
        window.CHECKS[id] = { at: json.at || Date.now(), online: json.online, status: json.status, note: json.note || '' };
        var note = document.getElementById('checkNote');
        if (note) {
          if (json.online) { note.textContent = 'Last live check: reachable' + (json.status ? ' (HTTP ' + json.status + ')' : '') + '.'; note.className = 'check-note ok'; }
          else { note.textContent = 'Last live check: unreachable' + (json.note ? ' \u2014 ' + json.note : '') + '. If this persists, report it.'; note.className = 'check-note bad'; }
        }
        var lc = document.getElementById('liveLastChecked');
        if (lc) lc.textContent = new Date(json.at).toLocaleString('en-GB', { hour12: false, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        showToast(json.online ? 'Live check: reachable \u2014 it opens.' : 'Live check: unreachable right now.');
      }).catch(function () { btn.disabled = false; btn.textContent = oldTxt; showToast('Live check failed \u2014 try again later.'); });
  }

    function renderAbout() {
    var sources = SOURCES.map(function (s2) { return '<div class="source-tile"><b>' + esc(s2.name) + '</b><span>' + esc(s2.note) + '</span></div>'; }).join('');
    var method = METHOD.map(function (m) {
      return '<div class="method-row"><div class="mname">' + esc(m.name) + '</div><div class="mdesc">' + esc(m.desc) + '</div><div class="mval">' + m.val + '</div></div>';
    }).join('');
    var cats = CATEGORIES.map(function (c) { return '<span class="tag">' + esc(c.title) + '</span>'; }).join('');
    view.innerHTML =
      '<section class="about-hero">' +
        '<h1>About Lumo</h1>' +
        '<p class="lede">Lumo is a directory of websites and platforms across different types — with a simple intro, a platform score and independent user votes, so you can quickly judge what a site is and whether to trust it.</p>' +
      '</section>' +
      '<div class="about-grid">' +
        '<div class="main-col about-body">' +
          '<h2>What Lumo is</h2>' +
          '<p>Think of Lumo as a website directory plus reviews. Search a site or name to see its overview, key facts, Lumo score, real user votes and rating distribution. Higher-risk platforms get clear warnings with evidence.</p>' +
          '<ul><li><span class="tick">&#10003;</span><span><b>Simple intros.</b> Every listing includes an easy-to-read overview.</span></li>' +
          '<li><span class="tick">&#10003;</span><span><b>Two independent signals.</b> The Lumo score and user votes are separate.</span></li>' +
          '<li><span class="tick">&#10003;</span><span><b>High-risk flags.</b> Suspicious platforms show their evidence and external sources.</span></li>' +
          '<li><span class="warn">&#9888;</span><span><b>For reference only.</b> Scores are not official certifications — always verify yourself.</span></li></ul>' +
          '<h2>Categories we cover</h2>' +
          '<div class="proj-meta" style="margin-top:6px">' + cats + '</div>' +
          '<h2 id="submit">How sites are listed</h2>' +
          '<p>Sites enter via automated discovery of public sources and via user suggestions. Editors verify each entry, run an operational check (reachable, registrable, still promoted), and only live sites show by default — offline ones are archived with a label. Every listing is human-reviewed before it is published; no automatic approve/reject is used.</p>' +
          '<h2 id="sources">Where data comes from</h2>' +
          '<div class="source-grid">' + sources + '</div>' +
          '<h2 id="method">How the score works</h2>' +
          '<p><b>Lumo score (0–10):</b> produced by editors from the dimensions below and independent of user votes:</p>' +
          '<div>' + method + '</div>' +
          '<div class="note" style="margin:16px 0"><b>Bands:</b> 7.5+ Trusted · 4.5–7.4 Caution · below 4.5 High risk.</div>' +
          '<p><b>User rating (1–5 stars):</b> logged-in users vote once per account; Lumo only tallies the results.</p>' +
          '<h2 id="disclaimer">Disclaimer</h2>' +
          '<div class="note"><b>For reference only.</b> Lumo aggregates publicly available information for research purposes. Scores and listings are not endorsements, offers, certifications or investment/trading/legal advice. Always verify contract addresses and primary sources, and do your own research before making any decision.</div>' +
          '<h2 id="contact">Contact &amp; corrections</h2>' +
          '<p>Spot a mistake or want to appeal a listing? Use the <b>Report issue</b> button on any listing — it goes straight to our review queue.</p>' +
          '<p><b>Contact us on Telegram:</b> <a href="https://t.me/aerian00123" target="_blank" rel="noopener nofollow" style="color:var(--info)">@aerian00123</a> — fastest for questions, corrections and appeals.</p>' +
          (window.CONTACT ? '<p>Prefer email? Write to <a href="mailto:' + esc(window.CONTACT) + '" style="color:var(--info)">' + esc(window.CONTACT) + '</a>.</p>' : '') +
        '</div>' +
        '<aside class="side-col">' +
          '<div class="side-card"><h3>How listings are verified</h3>' +
            '<p style="color:var(--muted);font-size:13px">Every entry is researched from public sources and checked for reachability from our servers before it is published. High-risk and DEAD listings carry their evidence. Spot something wrong? Use Report issue on the entry — it goes straight to our human review queue.</p>' +
          '</div>' +
          '<div class="side-card"><h3>Review workflow</h3>' +
            '<div class="steps">' +
              '<div class="step"><span class="n">1</span><div><b>Submit or report</b><p>Anyone can suggest a site or report an issue.</p></div></div>' +
              '<div class="step"><span class="n">2</span><div><b>Human review</b><p>Editors verify evidence; no automatic pass or fail.</p></div></div>' +
              '<div class="step"><span class="n">3</span><div><b>Published with a score</b><p>Approved entries list with an editor score and live status.</p></div></div>' +
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
    var opts = CATEGORIES.map(function (c) { return '<option value="' + c.id + '">' + esc(c.title) + '</option>'; }).join('');
    var subsHtml = '';
    var profHtml = state.signedIn ? '<div class="contrib-banner"><span>Accepted submissions earn contributor points — accepted +10 · confirmed high-risk +20 · dead +15.</span> <a href="#/me">My profile &amp; points &rarr;</a></div>' : '';
    if (state.signedIn && state.submissions && state.submissions.length) {
      subsHtml = '<div class="section-head" style="margin-top:4px"><h2>My submissions</h2><span style="font-size:12px;color:var(--dim)">visible only to you</span></div>' +
        '<div class="my-sub">' + state.submissions.map(function (x) {
          var pill, line = '';
          if (x.status === 'pending') {
            pill = '<span class="st-pill pending"><span class="dot"></span>Under review<span class="subnote">usually 1–2 business days</span></span>';
            line = '<div class="progress-line">Updates automatically after an admin approves it.</div>';
          } else if (x.status === 'approved' || x.status === 'done') {
            pill = '<span class="st-pill done"><span class="dot"></span>Approved · listed</span>';
            line = '<div class="progress-line" style="color:var(--good)">Approved — find it in its category.</div>';
          } else {
            pill = '<span class="st-pill off"><span class="dot"></span>Rejected</span>';
            line = '<div class="progress-line" style="color:var(--bad)">' + (x.reason ? esc(x.reason) : 'Rejected') + '</div>';
          }
          return '<div class="sub-row"><div><div class="sn">' + esc(x.name) + ' <span class="sd">' + esc(x.domain) + '</span></div>' +
            '<div class="sc">Submitted to: ' + esc(x.catTitle || x.cat) + ' · ' + esc(new Date(x.at).toLocaleString('en-GB', { hour12: false })) + '</div></div>' + pill + '</div>' + line;
        }).join('') + '</div>';
    }
    view.innerHTML =
      '<div class="page-head">' +
        '<h1>Submit a site</h1>' +
        '<p class="lede">Can’t find a site? Submit it — after human review it is listed in its category and ranked.</p>' +
      '</div>' + profHtml + subsHtml +
      '<div class="submit-grid">' +
        '<div class="form-card">' +
          '<h2>Site details</h2>' +
          '<p class="fc-sub">Required fields are marked <span style="color:var(--bad)">*</span>. Please provide real, verifiable information.</p>' +
          '<form id="submitForm">' +
            '<div class="form-grid">' +
              '<label class="field"><span>Site / project name <span class="req">*</span></span><input name="name" required placeholder="e.g. Firefly Wallet"></label>' +
              '<label class="field"><span>Website URL <span class="req">*</span></span><input name="website" type="url" required placeholder="https://…"></label>' +
              '<label class="field full"><span>Category <span class="req">*</span></span><select name="cat" required><option value="">Select a category…</option>' + opts + '</select></label>' +
              '<label class="field full"><span>One-line summary <span class="req">*</span></span><input name="tagline" required maxlength="160" placeholder="What does this site do?"></label>' +
              '<label class="field full"><span>Full description</span><textarea name="intro" rows="5" placeholder="What problem it solves, its risks or highlights, and where you heard about it…"></textarea></label>' +
              '<label class="field full"><span>Sources / evidence links (optional)</span><textarea name="evidence" rows="2" placeholder="Official site, articles, store links — one per line"></textarea></label>' +
            '</div>' +
            '<div class="form-foot">' +
              '<label class="check"><input type="checkbox" required><span>I confirm this is accurate and understand it is reviewed by humans before it is published.</span></label>' +
              '<button class="btn btn-primary btn-block" type="submit">Submit for review</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
        '<aside class="side-col">' +
          '<div class="side-card"><h3>Process</h3>' +
            '<div class="steps">' +
              '<div class="step"><span class="n">1</span><div><b>Submit</b><p>Name, URL and a short summary (sign-in required).</p></div></div>' +
              '<div class="step"><span class="n">2</span><div><b>Human review</b><p>Editors verify the information.</p></div></div>' +
              '<div class="step"><span class="n">3</span><div><b>Listed</b><p>Approved sites appear in their category and are ranked.</p></div></div>' +
            '</div>' +
          '</div>' +
          '<div class="side-card disclaimer-box"><strong style="color:var(--muted)">Note.</strong> Being listed is not an endorsement. Unverifiable submissions may be rejected or marked “under review”.</div>' +
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
      '<strong style="color:var(--muted)">Note.</strong> Lumo aggregates public risk signals. It is not an official body and does not replace regulators or courts — verify against official sources.</div></aside></div>';
  }

    function renderTerms() {
    legalPage('Terms of Service', 'By using Lumo you agree to these terms. Lumo is an information and risk-signal platform — not investment, trading or legal advice.', [
      { h: '1. What Lumo is', p: ['Lumo aggregates public sources (regulator blacklists, media, security scanners, user submissions) into a directory and gives evidence-based risk signals and scores.'] },
      { h: '2. Your use', ul: ['You may not use Lumo to harass, threaten or defame anyone;', 'You may not submit false listings, mass-vote, or abuse reports;', 'You may not scrape or copy the full database for commercial use without attribution.'] },
      { h: '3. Content & liability', p: ['Listings and scores are based on verifiable evidence with sources, but public information can be late or incomplete — we do not guarantee absolute accuracy.', 'We are not liable for decisions made based on this information.'] },
      { h: '4. Changes', p: ['We may update these terms, adjust or remove listings for compliance, safety or operational reasons, with reasonable notice where possible.'] }
    ], '2026-09-05');
  }
  function renderPrivacy() {
    legalPage('Privacy Policy', 'We only collect what is needed to run the service, and we explain how it is used and stored.', [
      { h: '1. What we collect', ul: ['Login email (to send codes, identify you and record votes);', 'Content you submit (suggestions, ratings, scores, reports, messages);', 'Necessary operational data (IP, access logs, session state) for security and anti-abuse;'] },
      { h: '2. How it is used', p: ['Code login and sessions, one-vote-per-account tallies, submission progress, spam prevention and site security. We never sell your data.'] },
      { h: '3. Storage & third parties', p: ['Data is stored on our servers/persistent disk. Verification emails are sent via a third-party mail service (e.g. Resend). Evidence archiving may query the Internet Archive (Wayback). Each third party processes only what is necessary under its own policy.'] },
      { h: '4. Your rights', p: ['Use “Sign out” to end your session. To correct or delete your account data, contact us and we will act after verifying your identity.'] },
      { h: '5. Security & children', p: ['We use HTTPS, session cookies and rate limits to protect data. This service is not directed at children and does not knowingly collect their information.'] }
    ], '2026-09-05');
  }
  function renderAppeals() {
    legalPage('Appeals', 'If you or your organization believe a listing is wrong, misses evidence, or was wrongly marked high risk or DEAD, you can appeal.', [
      { h: '1. When to appeal', ul: ['Listing content conflicts with facts or misquotes a source;', 'Wrongly marked high risk or DEAD and you can provide counter-evidence;', 'Identity misuse, or material that infringes your rights.'] },
      { h: '2. How to appeal', p: ['Prepare: (a) who you are; (b) the listing link or domain; (c) point-by-point evidence (official sites, registrations, licences, audits, statements).', 'Submit these through the “Report issue” button on the listing and choose “Appeal this listing”.'] },
      { h: '3. Process', ul: ['Your appeal is reviewed by humans (no automatic decisions);', 'We contact you via the email you provide if more evidence is needed;', 'The outcome (correction / downgrade / removal / keep) is confirmed by email and logged on the entry.'] },
      { h: '4. Notes', p: ['An appeal does not guarantee removal. To balance credibility and fairness we prefer correcting with evidence and only remove or downgrade when the evidence is sufficient. Abusive appeals are rejected.'] }
    ], '2026-09-05');
  }

  function renderWatchlist() {
    view.innerHTML = '<div class="page-head"><h1>Risk watchlist</h1>' +
      '<p class="lede">Telegram / social-only projects flagged as high risk. They have no website to check, so they are tracked here instead of the Live or Dead lists.</p>' +
      '<p class="filter-hint">For reference only — not an official judgement. Open with care; never send money to these channels.</p></div>' +
      '<div id="watchBox" class="watch-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px"><p style="color:var(--dim)">Loading…</p></div>';
    fetch('/api/watch').then(function (r) { return r.json(); }).then(function (j) {
      var list = j.watch || [];
      var box = document.getElementById('watchBox');
      if (!box) return;
      if (!list.length) { box.innerHTML = '<p style="color:var(--dim)">No flagged channels yet.</p>'; return; }
      var catLabel = { crypto: 'Crypto & Exchanges', trading: 'Trading & Investment Platforms', shop: 'E-commerce', loan: 'Finance & Lending', job: 'Jobs & Gig Work', dating: 'Dating & Social', news: 'News & Content', game: 'Games & Entertainment' };
      box.innerHTML = list.map(function (w) {
        var added = w.added ? String(w.added).slice(0, 10) : (w.at ? new Date(w.at).toISOString().slice(0, 10) : '');
        return '<div class="card" style="margin:0">' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b>' + esc(w.name) + '</b><span class="live-tag off">Flagged</span><span class="tag">' + esc(catLabel[w.cat] || w.cat) + '</span></div>' +
          '<p style="margin:9px 0;font-size:13.5px;color:var(--muted)">' + esc(w.reason) + '</p>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">' +
          '<a class="btn btn-ghost btn-sm" href="' + esc(w.url) + '" target="_blank" rel="noopener nofollow">Open Telegram @' + esc(w.handle) + ' &#8599;</a>' +
          '<span style="color:var(--dim);font-size:12px">added ' + esc(added) + '</span></div></div>';
      }).join('');
    }).catch(function () { var box = document.getElementById('watchBox'); if (box) box.innerHTML = '<p style="color:var(--bad)">Failed to load.</p>'; });
  }

  var LB_PERIOD = 'all';
  var EVENT_LABEL = {
    submission_accepted: 'Submission accepted (+10)',
    risk_flag: 'Lead confirmed high risk (+10)',
    dead_flag: 'Confirmed dead / shut down (+15)',
    report_valid: 'Report verified (+10)',
    admin: 'Admin adjustment'
  };
  function levelChip(level) {
    var cls = 'lv-chip';
    if (level === 'Top Contributor') cls += ' lv-top';
    else if (level === 'Verified Hunter') cls += ' lv-vh';
    else if (level === 'Hunter') cls += ' lv-h';
    else if (level === 'Scout') cls += ' lv-s';
    return '<span class="' + cls + '">' + esc(level) + '</span>';
  }
  function renderContributors(period) {
    if (period) LB_PERIOD = period;
    view.innerHTML =
      '<div class="page-head">' +
        '<h1>Top contributors</h1>' +
        '<p class="lede">Community members who help keep Lumo accurate — by submitting sites and flagging scams. Accepted listings earn points; confirmed high-risk and dead leads earn more.</p>' +
      '</div>' +
      '<div class="lb-welcome">' +
        '<div class="lbw-txt"><b>Be part of the community — everyone is welcome.</b>' +
        '<p>Submit a site you know, flag a suspicious project, or correct an entry. Every accepted lead and confirmed risk earns points and a place on this board.</p></div>' +
        '<div class="lbw-cta"><a class="btn btn-primary btn-sm" href="#/submit">Submit a site</a><a class="btn btn-ghost btn-sm" href="#/about" data-scroll-to="method">How scoring works</a></div>' +
      '</div>' +
      
      '<div class="seg" id="lbSeg">' +
        '<button class="seg-btn' + (LB_PERIOD === 'all' ? ' on' : '') + '" data-lb="all">All time</button>' +
        '<button class="seg-btn' + (LB_PERIOD === 'month' ? ' on' : '') + '" data-lb="month">This month</button>' +
      '</div>' +
      '<div id="lbList" class="lb-list"><p style="color:var(--dim)">Loading…</p></div>' +
      '<div class="note" style="margin-top:18px"><b>Want to be here?</b> Submit a site you know, or flag a project you suspect. Every accepted lead scores points — human-reviewed before anything is published.</div>';
    document.querySelectorAll('[data-lb]').forEach(function (b) {
      b.onclick = function () { renderContributors(b.getAttribute('data-lb')); };
    });
    fetch('/api/contrib/top').then(function (r) { return r.json(); }).then(function (j) {
      var rows = (LB_PERIOD === 'month' ? j.month : j.all) || [];
      var box = document.getElementById('lbList');
      if (!box) return;
      box.innerHTML = rows.length
        ? rows.map(function (x) {
            return '<div class="lb-row"><div class="lb-rank">' + x.rank + '</div>' +
              '<div class="lb-main"><div class="lb-name">' + esc(x.name) + ' ' + levelChip(x.level) + '</div>' +
              '<div class="lb-sub"><span class="ok">' + x.accepted + ' accepted</span> · <span class="warn">' + x.risk + ' risk</span> · <span class="dead">' + x.dead + ' dead</span></div></div>' +
              '<div class="lb-pts">' + x.points + ' pts</div></div>';
          }).join('')
        : '<p style="color:var(--dim)">No contributors yet this month — be the first.</p>';
    }).catch(function () { var box = document.getElementById('lbList'); if (box) box.innerHTML = '<p style="color:var(--bad)">Failed to load.</p>'; });
  }
  function renderMe() {
    if (!state.signedIn) {
      view.innerHTML =
        '<div class="page-head"><h1>My profile</h1><p class="lede">Sign in to see your contributor points, level and submission history.</p></div>' +
        '<p><button class="btn btn-primary" id="meSignin" type="button">Sign in</button></p>';
      var sb = document.getElementById('meSignin');
      if (sb) sb.onclick = function () { openAuth('Sign in to view your contributor profile.'); };
      return;
    }
    view.innerHTML =
      '<div class="page-head"><h1>My profile</h1><p class="lede">Your contributor points, level and submission history.</p></div>' +
      '<div class="submit-grid"><div class="form-card">' +
        '<div id="meTop" class="me-top"><span>Loading…</span></div>' +
        '<div id="meForm" class="me-form">' +
          '<label class="field"><span>Public name</span><input id="meAlias" maxlength="24" placeholder="How your name appears on listings"></label>' +
          '<label class="check"><input type="checkbox" id="mePublic"><span>Show my name on listings I contributed</span></label>' +
          '<button class="btn btn-primary" id="meSave" type="button">Save profile</button>' +
        '</div>' +
        '<div id="meEvents"></div>' +
      '</div>' +
      '<aside class="side-col"><div class="side-card"><h3>How points work</h3>' +
        '<div class="steps">' +
          '<div class="step"><span class="n">+10</span><div><b>Accepted</b><p>A submission that passes human review.</p></div></div>' +
          '<div class="step"><span class="n">+20</span><div><b>High risk</b><p>A lead confirmed as risky or a scam (10 + 10 bonus).</p></div></div>' +
          '<div class="step"><span class="n">+15</span><div><b>Dead</b><p>A confirmed dead / shut-down lead.</p></div></div>' +
          '<div class="step"><span class="n">+10</span><div><b>Verified report</b><p>Reports that lead to a correction.</p></div></div>' +
        '</div></div></aside></div>';
    var meSave = document.getElementById('meSave');
    if (meSave) meSave.onclick = function () {
      fetch('/api/contrib/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alias: document.getElementById('meAlias').value, creditPublic: document.getElementById('mePublic').checked }) })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j.error) showToast(j.error); else { showToast('Profile saved'); renderMe(); } })
        .catch(function () { showToast('Save failed'); });
    };
    fetch('/api/contrib/me').then(function (r) { return r.json(); }).then(function (j) {
      if (!j.user) return;
      var u = j.user;
      var top = document.getElementById('meTop');
      if (top) top.innerHTML = '<div class="me-identity"><div class="me-alias">' + esc('@' + u.alias) + ' ' + levelChip(u.level) + (u.trusted ? ' <span class="lv-chip lv-t">Trusted</span>' : '') + '</div>' +
        '<div class="me-stats"><div class="ms"><b>' + u.points + '</b><span>points</span></div>' +
        '<div class="ms"><b>' + (u.counts.accepted || 0) + '</b><span>accepted</span></div>' +
        '<div class="ms"><b>' + (u.counts.risk || 0) + '</b><span>risk</span></div>' +
        '<div class="ms"><b>' + (u.counts.dead || 0) + '</b><span>dead</span></div></div></div>' +
        '<div class="note" style="margin-top:12px"><b>Priority review:</b> ' + (u.trusted || u.points >= 200 ? 'your submissions jump the queue.' : 'reach 200 points or get trusted status and your submissions jump the queue.') + '</div>';
      var aliasEl = document.getElementById('meAlias');
      if (aliasEl) aliasEl.value = u.alias || '';
      var pub = document.getElementById('mePublic');
      if (pub) pub.checked = !!u.creditPublic;
      var ev = document.getElementById('meEvents');
      if (ev) {
        ev.innerHTML = '<h2 style="font-size:16px;margin:20px 0 10px">Recent activity</h2>' +
          ((u.events && u.events.length) ? '<div class="my-sub">' + u.events.map(function (e) {
            return '<div class="sub-row"><div><div class="sn">' + esc(EVENT_LABEL[e.reason] || e.reason) + ' <span class="sd">' + (e.delta > 0 ? '+' + e.delta + ' pts' : e.delta + ' pts') + '</span></div>' +
              '<div class="sc">' + (e.target ? esc(e.target) : '') + ' · ' + esc(new Date(e.at).toLocaleString('en-GB', { hour12: false })) + '</div></div></div>';
          }).join('') + '</div>' : '<p style="color:var(--dim)">No activity yet — submit a site to start earning points.</p>');
      }
    }).catch(function () {});
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
    else if (parts[0] === 'watchlist') route = 'watchlist';
    else if (parts[0] === 'about') route = 'about';
    else if (parts[0] === 'contributors') route = 'contributors';
    else if (parts[0] === 'me') route = 'me';

    if (route === 'home') renderHome();
    else if (route === 'cat') renderCat(arg);
    else if (route === 'item') { state.currentItemId = arg; renderItem(arg); }
    else if (route === 'results') renderResults(arg);
    else if (route === 'submit') renderSubmit();
    else if (route === 'terms') renderTerms();
    else if (route === 'privacy') renderPrivacy();
    else if (route === 'appeals') renderAppeals();
    else if (route === 'watchlist') renderWatchlist();
    else if (route === 'about') renderAbout();
    else if (route === 'contributors') renderContributors('all');
    else if (route === 'me') renderMe();

    setActiveNav(route);
    updateAuthButton();
    view.innerHTML = enHtml(view.innerHTML);
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', function (e) {
    var t = e.target;

    var copyLinkBtn = t.closest('[data-copylink]');
    if (copyLinkBtn) { e.preventDefault(); copyShareLink(); return; }
    var shareBtn = t.closest('[data-share]');
    if (shareBtn) { e.preventDefault(); openShareCard(state.currentItemId); return; }

    var report = t.closest('[data-report]');
    if (report) {
      e.preventDefault();
      if (!state.signedIn) { openAuth('Sign in to report an issue.'); return; }
      openReport(state.currentItemId);
      return;
    }

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
    if (recheck) {
      e.preventDefault();
      if (!state.signedIn) { openAuth('Sign in to run a live check.'); return; }
      runRecheck(state.currentItemId, recheck);
      return;
    }

    var need = t.closest('[data-need-login]');
    if (need) { e.preventDefault(); openAuth('Sign in to rate, submit or report.'); return; }

    var back = t.closest('[data-auth-back]');
    if (back) {
      var ef = document.getElementById('authEmailForm');
      var cs = document.getElementById('authStepCode');
      var hint = document.getElementById('authHint');
      if (ef) ef.style.display = '';
      if (cs) cs.hidden = true;
      if (hint) hint.textContent = 'We\u2019ll email you a 6-digit code.';
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

    if (t.closest('[data-share-download]')) { e.preventDefault(); downloadShareCard(); return; }
    if (t.closest('[data-share-link]')) { e.preventDefault(); copyShareLink(); return; }
    if (t.closest('[data-share-copy]')) { e.preventDefault(); copyShareCard(); return; }

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
    if (e.target.id === 'reportForm') { submitReport(e); }
    if (e.target.id === 'authEmailForm') {
      e.preventDefault();
      var email = document.getElementById('authEmail').value.trim();
      if (!email || email.indexOf('@') === -1) { showToast('请输入有效邮箱'); return; }
      fetch('/api/auth/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var hint = document.getElementById('authHint');
          if (hint && j && j.hint) hint.textContent = j.hint;
          else if (hint) hint.textContent = 'Code sent \u2014 check your inbox.';
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

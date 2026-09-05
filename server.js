/* Lumo Server — zero-dependency Node HTTP + JSON persistence. Dev/MVP build. */
'use strict';
const http = require('http');
const net = require('net');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = process.env.LUMO_DATA_DIR ? path.resolve(process.env.LUMO_DATA_DIR) : path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SEED_FILE = path.join(ROOT, 'data', 'seed.json'); // 种子数据始终来自代码仓库
const PORT = process.env.LUMO_PORT || process.env.PORT || 4780;
const ADMIN_EMAIL = process.env.LUMO_ADMIN || 'admin@lumo.local';
const DEV_CODE = process.env.LUMO_DEV_CODE || '123456'; // 开发用固定码;正式环境请改为发送真实邮件并置空本值
const MAIL_HOST = process.env.LUMO_SMTP_HOST || '';
const MAIL_PORT = parseInt(process.env.LUMO_SMTP_PORT || '587', 10);
const MAIL_USER = process.env.LUMO_SMTP_USER || '';
const MAIL_PASS = process.env.LUMO_SMTP_PASS || '';
const MAIL_FROM = process.env.LUMO_SMTP_FROM || 'Lumo <no-reply@lumo.local>';
const MAIL_SECURE = String(process.env.LUMO_SMTP_SECURE || '').toLowerCase() === 'true' || MAIL_PORT === 465;
const MAIL_ENABLED = !!(MAIL_HOST && MAIL_USER && MAIL_PASS);
const CODE_TTL = 10 * 60 * 1000;
const sha = (x) => crypto.createHash('sha256').update(String(x)).digest('hex');
const rand6 = () => String(Math.floor(100000 + Math.random() * 900000));

// 极简 SMTP 客户端(零依赖):支持 465 隐式 TLS / 587 STARTTLS / AUTH LOGIN
function smtpRead(sock, expect) {
  return new Promise((resolve, reject) => {
    let buf = '';
    function onData(chunk) {
      buf += chunk.toString('utf8');
      if (/\r\n/.test(buf)) {
        const lines = buf.split('\r\n').filter(Boolean);
        const last = lines[lines.length - 1];
        const code = parseInt((last || '000').slice(0, 3), 10);
        if (expect.indexOf(code) !== -1) { cleanup(); resolve(code); }
        else { cleanup(); reject(new Error('SMTP greeting -> ' + code + ': ' + last)); }
      }
    }
    function onErr(e) { cleanup(); reject(e); }
    function cleanup() { sock.removeListener('data', onData); sock.removeListener('error', onErr); }
    sock.on('data', onData);
    sock.on('error', onErr);
  });
}
function smtpCommand(sock, cmd, expect) {
  return new Promise((resolve, reject) => {
    let buf = '';
    function onData(chunk) {
      buf += chunk.toString('utf8');
      const lines = buf.split('\r\n');
      if (lines.length > 1 && !/^\d{3}-/.test(lines[lines.length - 2] || '')) {
        const last = lines.filter((l) => /^\d{3} /.test(l)).pop() || '';
        const code = parseInt(last.slice(0, 3), 10);
        if (expect.indexOf(code) !== -1) { cleanup(); resolve(code); }
        else { cleanup(); reject(new Error('SMTP ' + cmd.split(' ')[0] + ' -> ' + code + ': ' + last)); }
      }
    }
    function onErr(e) { cleanup(); reject(e); }
    function cleanup() { sock.removeListener('data', onData); sock.removeListener('error', onErr); }
    sock.on('data', onData);
    sock.on('error', onErr);
    sock.write(cmd + '\r\n');
  });
}
async function smtpSend(to, subject, text) {
  return new Promise((resolve, reject) => {
    const connectOpts = MAIL_SECURE
      ? { host: MAIL_HOST, port: MAIL_PORT, servername: MAIL_HOST }
      : { host: MAIL_HOST, port: MAIL_PORT };
    let sock = MAIL_SECURE ? tls.connect(connectOpts) : net.connect(connectOpts);
    let step = 0;
    function hello() { return smtpCommand(sock, 'EHLO ' + (MAIL_HOST || 'lumo.local'), [250]); }
    sock.on('connect', async () => {
      try {
        await smtpRead(sock, [220]); // 服务端问候
        let ehlo = await hello();
        if (!MAIL_SECURE && MAIL_PORT !== 25 && String(ehlo).length >= 0) {
          // STARTTLS if advertised
          try {
            await smtpCommand(sock, 'STARTTLS', [220]);
            const t = tls.connect({ socket: sock, servername: MAIL_HOST }, () => {});
            await new Promise((res2) => { t.once('secureConnect', res2); });
            sock = t;
            await hello();
          } catch (e) { /* server 不支持 STARTTLS 时继续明文 */ }
        }
        await smtpCommand(sock, 'AUTH LOGIN', [334]);
        await smtpCommand(sock, Buffer.from(MAIL_USER).toString('base64'), [334]);
        await smtpCommand(sock, Buffer.from(MAIL_PASS).toString('base64'), [235]);
        await smtpCommand(sock, 'MAIL FROM:<' + MAIL_FROM.replace(/^.*<|>$/g, '') + '>', [250]);
        await smtpCommand(sock, 'RCPT TO:<' + to + '>', [250, 251]);
        await smtpCommand(sock, 'DATA', [354]);
        await smtpCommand(sock, 'Subject: ' + subject + '\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n' + text + '\r\n.', [250]);
        await smtpCommand(sock, 'QUIT', [221]);
        resolve({ ok: true });
      } catch (e) { reject(e); }
    });
    sock.on('error', (e) => reject(e));
  });
}
async function deliverCode(email, code) {
  const subject = '【Lumo】登录验证码: ' + code;
  const text = '你的 Lumo 登录验证码是: ' + code + '\n10 分钟内有效。如果不是你本人操作,请忽略此邮件。';
  if (!MAIL_ENABLED) { console.log('[Lumo] 验证码(未配 SMTP,仅日志可见):', code, '->', email); return { dev: true, note: '未配置 SMTP,验证码仅打印到服务端控制台(开发模式)。' }; }
  await smtpSend(email, subject, text);
  return { dev: false };
}

let db = null;
function loadDB() {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) {}
  if (!db || !db.items) {
    const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
    db = { seedAt: seed.generatedAt, categories: seed.categories, items: seed.items, live: seed.live, checked: seed.checked, users: {}, subs: [], sessions: {}, logs: [] };
    saveDB();
  }
  if (!db.logs) db.logs = [];
  if (!db.evidence) db.evidence = {};
  if (!db.emailCodes) db.emailCodes = {};
}
function saveDB() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 1e6) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function parseCookies(req) {
  const out = {};
  const h = req.headers.cookie || '';
  h.split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function sessionUser(req) {
  const token = parseCookies(req).lumo_session;
  const s = token && db.sessions[token];
  if (s && s.exp > Date.now()) return { email: s.email, token };
  if (token && db.sessions[token]) delete db.sessions[token];
  return null;
}
function newToken() { return crypto.randomBytes(24).toString('hex'); }
function userOf(email) {
  if (!db.users[email]) db.users[email] = { email, rates: {}, createdAt: Date.now() };
  return db.users[email];
}
function adminUser(req) {
  const me = sessionUser(req);
  if (!me || me.email !== ADMIN_EMAIL) return null;
  return me;
}
function distributeAvg(count, avg) {
  const target = Math.max(0.5, Math.min(5, avg || 3));
  const dist = [0, 0, 0, 0, 0];
  const base = Math.floor(count / 5);
  for (let i = 0; i < 5; i++) dist[i] = base;
  let rest = count - base * 5;
  const w = [Math.pow(target / 5, 3), Math.pow(target / 4, 3), 1, Math.pow((5 - target) / 4, 3), Math.pow((5 - target) / 5, 3)];
  for (let k = 0; k < rest; k++) {
    let best = 0;
    for (let i = 1; i < 5; i++) if (w[i] > w[best]) best = i;
    dist[best]++; w[best] = -1;
  }
  function curAvg() { const s = dist.reduce((a, c, i) => a + c * (5 - i), 0); return count ? s / count : 0; }
  let guard = 0;
  while (guard < count * 10 + 100) {
    const a = curAvg();
    if (Math.abs(a - target) < 0.01) break;
    if (a < target) {
      let from = -1;
      for (let i = 4; i >= 1; i--) if (dist[i] > 0) { from = i; break; }
      if (from === -1) break;
      dist[from]--; dist[0]++;
    } else {
      let from = -1;
      for (let i = 0; i < 4; i++) if (dist[i] > 0) { from = i; break; }
      if (from === -1) break;
      dist[from]--; dist[4]++;
    }
    guard++;
  }
  return dist;
}
function recomputeItem(it) {
  // dist 数组顺序固定为 [5★,4★,3★,2★,1★]
  const total = it.dist.reduce((a, c, i) => a + c * (5 - i), 0);
  const n = it.dist.reduce((a, c) => a + c, 0);
  it.userScore = n ? Math.round((total / n) * 10) / 10 : 0;
  it.userCount = n;
}

// ---- rate limiting (per-IP window) ----
const hits = new Map();
function rateLimit(req, limit, windowMs) {
  const ip = req.socket.remoteAddress || '0';
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) return false;
  arr.push(now);
  hits.set(ip, arr);
  return true;
}

// ---- static ----
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(PUBLIC, rel);
  const pub = path.resolve(PUBLIC);
  if (!path.resolve(file).startsWith(pub)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': rel.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
    res.end(data);
  });
}

function routes() {
  const r = { GET: {}, POST: {} };

  r.GET['/api/bootstrap'] = (req, res) => {
    const me = sessionUser(req);
    const myRates = me ? (userOf(me.email).rates || {}) : {};
    send(res, 200, { categories: db.categories, items: db.items, live: db.live, checked: db.checked, myRates, user: me ? me.email : null });
  };

  r.POST['/api/auth/send-code'] = async (req, res) => {
    if (!rateLimit(req, 10, 60000)) return send(res, 429, { error: '请求过于频繁,请稍后再试' });
    const body = JSON.parse((await readBody(req)) || '{}');
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: '邮箱格式不正确' });
    if (!db.emailCodes) db.emailCodes = {};
    const last = db.emailCodes[email] && db.emailCodes[email].lastSent;
    if (last && Date.now() - last < 60000) return send(res, 429, { error: '发送过于频繁,请 60 秒后再试' });
    const code = rand6();
    db.emailCodes[email] = { hash: sha(email + ':' + code), exp: Date.now() + CODE_TTL, tries: 0, lastSent: Date.now() };
    saveDB();
    let dev = false, note = '';
    try {
      const r2 = await deliverCode(email, code);
      dev = !!r2.dev; note = r2.note || '';
    } catch (e) {
      return send(res, 502, { error: '验证码发送失败,请稍后重试(' + e.message.slice(0, 80) + ')' });
    }
    send(res, 200, { ok: true, dev: dev, note: note, hint: dev ? ('验证码:' + code) : '验证码已发送,请查收邮箱' });
  };

  r.POST['/api/auth/verify'] = async (req, res) => {
    const body = JSON.parse((await readBody(req)) || '{}');
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: '邮箱格式不正确' });
    const rec = db.emailCodes && db.emailCodes[email];
    if (!rec || rec.exp < Date.now()) {
      if (db.emailCodes && db.emailCodes[email]) delete db.emailCodes[email];
      saveDB();
      return send(res, 401, { error: '验证码已过期,请重新发送' });
    }
    const devOverride = process.env.NODE_ENV !== 'production' && code === DEV_CODE;
    if (!devOverride && sha(email + ':' + code) !== rec.hash) {
      rec.tries = (rec.tries || 0) + 1;
      if (rec.tries >= 5) { delete db.emailCodes[email]; saveDB(); return send(res, 429, { error: '尝试次数过多,请重新发送验证码' }); }
      saveDB();
      return send(res, 401, { error: '验证码错误' });
    }
    if (db.emailCodes) delete db.emailCodes[email];
    saveDB();
    const u = userOf(email);
    const token = newToken();
    db.sessions[token] = { email, exp: Date.now() + 30 * 86400e3 };
    saveDB();
    const rates = u.rates || {};
    const subs = db.subs.filter((s) => s.email === email).sort((a, b) => b.at - a.at);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': 'lumo_session=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000'
    });
    res.end(JSON.stringify({ user: email, rates, submissions: subs }));
  };

  r.GET['/api/me'] = (req, res) => {
    const me = sessionUser(req);
    if (!me) return send(res, 200, { user: null, rates: {}, submissions: [] });
    const u = userOf(me.email);
    const subs = db.subs.filter((s) => s.email === me.email).sort((a, b) => b.at - a.at);
    send(res, 200, { user: me.email, rates: u.rates || {}, submissions: subs });
  };

  r.POST['/api/auth/logout'] = (req, res) => {
    const token = parseCookies(req).lumo_session;
    if (token && db.sessions[token]) delete db.sessions[token];
    saveDB();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': 'lumo_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
    res.end('{}');
  };

  r.GET['/api/categories'] = (req, res) => send(res, 200, { categories: db.categories });
  r.GET['/api/items'] = (req, res) => send(res, 200, { items: db.items });

  r.GET['/api/submissions/mine'] = (req, res) => {
    const me = sessionUser(req);
    if (!me) return send(res, 401, { error: '未登录' });
    const subs = db.subs.filter((s) => s.email === me.email).sort((a, b) => b.at - a.at);
    send(res, 200, { submissions: subs });
  };

  r.POST['/api/submissions'] = async (req, res) => {
    const me = sessionUser(req);
    if (!me) return send(res, 401, { error: '请先登录' });
    if (!rateLimit(req, 20, 3600000)) return send(res, 429, { error: '提交过于频繁' });
    const body = JSON.parse((await readBody(req)) || '{}');
    const name = String(body.name || '').trim();
    let domain = String(body.domain || body.website || '').trim().toLowerCase();
    const cat = String(body.cat || '');
    const tagline = String(body.tagline || '').trim();
    if (!name || !domain || !cat || !tagline) return send(res, 400, { error: '必填项缺失' });
    domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    const rec = { id: 'sub' + Date.now() + Math.floor(Math.random() * 900), email: me.email, name, domain, cat, catTitle: (db.categories.find((c) => c.id === cat) || {}).title || cat, tagline, intro: String(body.intro || '').trim(), status: 'pending', at: Date.now() };
    db.subs.unshift(rec);
    saveDB();
    send(res, 200, { submission: rec });
  };

  r.POST['/api/items/:id/rate'] = async (req, res, id) => {
    const me = sessionUser(req);
    if (!me) return send(res, 401, { error: '请先登录' });
    const it = db.items.find((x) => x.id === id);
    if (!it) return send(res, 404, { error: '条目不存在' });
    const body = JSON.parse((await readBody(req)) || '{}');
    const stars = parseInt(body.stars, 10);
    if (!(stars >= 1 && stars <= 5)) return send(res, 400, { error: '评分须为 1–5 星' });
    console.log('RATE', me.email, id, stars, new Date().toISOString());
    const u = userOf(me.email);
    const prev = u.rates[id];
    if (prev) { it.dist[5 - prev] = Math.max(0, it.dist[5 - prev] - 1); }
    it.dist[5 - stars] += 1;
    u.rates[id] = stars;
    recomputeItem(it);
    saveDB();
    send(res, 200, { userScore: it.userScore, userCount: it.userCount, dist: it.dist, my: stars });
  };

  // ---- 后台(仅管理员)----
  function adminOnly(req, res) {
    const a = adminUser(req);
    if (!a) return send(res, 403, { error: '仅管理员可访问' });
    req._admin = a;
    return true;
  }
  function audit(req, action, target, detail) {
    if (!db.logs) db.logs = [];
    db.logs.unshift({ at: Date.now(), actor: (req._admin && req._admin.email) || 'unknown', action: action, target: String(target || '').slice(0, 120), detail: String(detail || '').slice(0, 400) });
    if (db.logs.length > 500) db.logs.length = 500;
  }
  r.GET['/api/admin/subs'] = (req, res) => {
    if (!adminOnly(req, res)) return;
    const list = db.subs.map(function (x) {
      return { id: x.id, name: x.name, domain: x.domain, cat: x.cat, catTitle: x.catTitle, tagline: x.tagline, intro: x.intro, email: x.email, status: x.status, at: x.at, reviewedAt: x.reviewedAt || null, itemId: x.itemId || null, reason: x.reason || '' };
    }).sort(function (a, b) { return b.at - a.at; });
    send(res, 200, { submissions: list });
  };
  r.GET['/api/admin/stats'] = (req, res) => {
    if (!adminOnly(req, res)) return;
    const items = db.items;
    const dead = items.filter((x) => !(db.live && db.live[x.id] && db.live[x.id][0] === 1)).length;
    send(res, 200, {
      items: items.length, dead: dead, alive: items.length - dead,
      risk: items.filter((x) => x.status === 'risk').length,
      pending: db.subs.filter((x) => x.status === 'pending').length,
      submissions: db.subs.length,
      users: Object.keys(db.users || {}).length
    });
  };
  r.POST['/api/admin/subs/:id/approve'] = async (req, res, id) => {
    if (!adminOnly(req, res)) return;
    const rec = db.subs.find((x) => x.id === id);
    if (!rec) return send(res, 404, { error: '提交不存在' });
    if (rec.status !== 'pending') return send(res, 400, { error: '该提交已处理' });
    const body = JSON.parse((await readBody(req)) || '{}');
    let rating = parseFloat(body.rating);
    if (isNaN(rating) || rating === null || body.rating === undefined || String(body.rating).trim() === '') {
      return send(res, 400, { error: '请先人工填写评分(0.5–10)后再通过收录' });
    }
    rating = Math.max(0.5, Math.min(10, Math.round(rating * 10) / 10));
    const dup = db.items.find((x) => x.domain === rec.domain);
    if (dup) return send(res, 409, { error: '该域名已收录(先核实是否重复)' });
    const c = db.categories.find((x) => x.id === rec.cat) || {};
    const id2 = 'it' + Date.now();
    db.items.unshift({
      id: id2, name: rec.name, domain: rec.domain, cat: rec.cat, tagline: rec.tagline, intro: rec.intro || rec.tagline,
      rating: rating, userScore: 0, userCount: 0, dist: [0, 0, 0, 0, 0],
      status: 'review', added: new Date().toISOString().slice(0, 10),
      facts: [['类型', c.title || '待定'], ['来源', '用户提交 · 已人工审核'], ['状态', '核实中']],
      reasons: [{ t: 'info', txt: '由用户提交,经管理员人工审核后收录;运营状态与风险持续核实中。' }]
    });
    rec.status = 'approved'; rec.itemId = id2; rec.reviewedAt = Date.now();
    audit(req, 'approve_submission', rec.name + ' / ' + rec.domain, '初始评分 ' + rating + ' → 收录条目 ' + id2);
    recordEvidence(req, id2, 'https://' + rec.domain, 'auto', '审核通过时自动建档(证据快照由存档任务补拍)');
    saveDB();
    send(res, 200, { ok: true, itemId: id2, rating: rating });
  };
  r.POST['/api/admin/subs/:id/reject'] = async (req, res, id) => {
    if (!adminOnly(req, res)) return;
    const rec = db.subs.find((x) => x.id === id);
    if (!rec) return send(res, 404, { error: '提交不存在' });
    if (rec.status !== 'pending') return send(res, 400, { error: '该提交已处理' });
    const body = JSON.parse((await readBody(req)) || '{}');
    rec.status = 'rejected';
    rec.reason = String(body.reason || '').trim().slice(0, 200);
    rec.reviewedAt = Date.now();
    audit(req, 'reject_submission', rec.name + ' / ' + rec.domain, '原因:' + (rec.reason || '无'));
    saveDB();
    send(res, 200, { ok: true });
  };

  // ---- 条目管理(仅管理员)----
  r.GET['/api/admin/items'] = (req, res) => {
    if (!adminOnly(req, res)) return;
    const rawQ = String((req.url.split('?')[1] || '').replace(/^q=/,''));
    let q; try { q = decodeURIComponent(rawQ).toLowerCase(); } catch (e) { q = rawQ.toLowerCase(); }
    let list = db.items;
    if (q) list = list.filter((x) => (x.name + ' ' + x.domain + ' ' + (db.categories.find((c) => c.id === x.cat) || {}).title).toLowerCase().indexOf(q) !== -1);
    send(res, 200, { items: list.map((x) => ({ id: x.id, name: x.name, domain: x.domain, cat: x.cat, catTitle: (db.categories.find((c) => c.id === x.cat) || {}).title || '', tagline: x.tagline, intro: x.intro, rating: x.rating, userScore: x.userScore, userCount: x.userCount, dist: x.dist, status: x.status, added: x.added, live: (db.live && db.live[x.id]) || [1,1,1] })) });
  };
  r.POST['/api/admin/items/:id/update'] = async (req, res, id) => {
    if (!adminOnly(req, res)) return;
    const it = db.items.find((x) => x.id === id);
    if (!it) return send(res, 404, { error: '条目不存在' });
    const b = JSON.parse((await readBody(req)) || '{}');
    if (b.name != null) it.name = String(b.name).trim().slice(0, 80) || it.name;
    if (b.domain != null) {
      const d = String(b.domain).trim().toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/.*$/,'');
      if (d && d !== it.domain) {
        if (db.items.some((x) => x.id !== id && x.domain === d)) return send(res, 409, { error: '该域名已被其他条目使用' });
        it.domain = d;
      }
    }
    if (b.tagline != null) it.tagline = String(b.tagline).trim().slice(0, 160);
    if (b.intro != null) it.intro = String(b.intro).trim();
    if (b.cat != null && db.categories.some((c) => c.id === b.cat)) it.cat = b.cat;
    if (b.status != null && ['ok', 'risk', 'review'].indexOf(b.status) !== -1) it.status = b.status;
    if (b.rating != null && !isNaN(b.rating)) it.rating = Math.max(0.5, Math.min(10, Math.round(parseFloat(b.rating) * 10) / 10));
    if (b.live && Array.isArray(b.live) && b.live.length === 3) {
      if (!db.live) db.live = {};
      db.live[id] = b.live.map((v) => (v ? 1 : 0));
    }
    if (b.facts && Array.isArray(b.facts)) it.facts = b.facts;
    audit(req, 'update_item', it.name + ' / ' + it.domain, JSON.stringify({ rating: b.rating, status: b.status, name: b.name, domain: b.domain, live: b.live }));
    saveDB();
    send(res, 200, { ok: true });
  };
  r.POST['/api/admin/items/:id/rating'] = async (req, res, id) => {
    if (!adminOnly(req, res)) return;
    const it = db.items.find((x) => x.id === id);
    if (!it) return send(res, 404, { error: '条目不存在' });
    const b = JSON.parse((await readBody(req)) || '{}');
    if (Array.isArray(b.dist) && b.dist.length === 5 && b.dist.every((n) => Number.isFinite(n) && n >= 0)) {
      it.dist = b.dist.map((n) => Math.round(n));
    } else if (b.count != null && b.avg != null && Number.isFinite(b.count) && Number.isFinite(b.avg)) {
      it.dist = distributeAvg(Math.max(0, Math.round(b.count)), Math.max(0, Math.min(5, parseFloat(b.avg))));
    } else {
      return send(res, 400, { error: '需提供 dist(5 档人数)或 count+avg' });
    }
    recomputeItem(it);
    audit(req, 'override_rating', it.name + ' / ' + it.domain, '结果:均分 ' + it.userScore + ' · ' + it.userCount + ' 人 · dist ' + it.dist.join('/'));
    saveDB();
    send(res, 200, { ok: true, userScore: it.userScore, userCount: it.userCount, dist: it.dist });
  };
  r.POST['/api/admin/items/:id/delete'] = async (req, res, id) => {
    if (!adminOnly(req, res)) return;
    const i = db.items.findIndex((x) => x.id === id);
    if (i < 0) return send(res, 404, { error: '条目不存在' });
    db.items.splice(i, 1);
    if (db.live && db.live[id]) delete db.live[id];
    if (db.users) Object.keys(db.users).forEach((em) => { if (db.users[em].rates && db.users[em].rates[id]) delete db.users[em].rates[id]; });
    audit(req, 'delete_item', id, '已删除并清理关联用户票');
    saveDB();
    send(res, 200, { ok: true });
  };

  // ---- 用户评分管理(仅管理员)----
  r.GET['/api/admin/users'] = (req, res) => {
    if (!adminOnly(req, res)) return;
    const rawQ = String((req.url.split('?')[1] || '').replace(/^q=/,''));
    let q; try { q = decodeURIComponent(rawQ).toLowerCase(); } catch (e) { q = rawQ.toLowerCase(); }
    let list = Object.keys(db.users || {}).map((em) => ({ email: em, rated: Object.keys(db.users[em].rates || {}).length }));
    if (q) list = list.filter((x) => x.email.indexOf(q) !== -1);
    send(res, 200, { users: list.slice(0, 60) });
  };
  r.GET['/api/admin/users/:email/rates'] = (req, res, email) => {
    if (!adminOnly(req, res)) return;
    const u = db.users && db.users[email];
    if (!u) return send(res, 200, { rates: [] });
    const rates = Object.keys(u.rates || {}).map((id) => {
      const it = db.items.find((x) => x.id === id);
      return { itemId: id, itemName: it ? it.name : '(已删除)', itemDomain: it ? it.domain : '', stars: u.rates[id] };
    });
    send(res, 200, { rates: rates });
  };
  async function mutateUserRate(req, res, email, itemId, action) {
    if (!adminOnly(req, res)) return false;
    const it = db.items.find((x) => x.id === itemId);
    if (!it) { send(res, 404, { error: '条目不存在' }); return false; }
    const u = userOf(email);
    if (!u.rates) u.rates = {};
    const body = JSON.parse((await readBody(req)) || '{}');
    if (action === 'remove') {
      const prev = u.rates[itemId];
      if (prev != null) { it.dist[5 - prev] = Math.max(0, it.dist[5 - prev] - 1); delete u.rates[itemId]; recomputeItem(it); audit(req, 'user_rate_remove', email + ' → ' + itemId, '原评分 ' + prev + ' 星'); saveDB(); }
      send(res, 200, { ok: true }); return false;
    }
    const stars = parseInt(body.stars, 10);
    if (!(stars >= 1 && stars <= 5)) { send(res, 400, { error: '评分须为 1–5' }); return false; }
    const prev = u.rates[itemId];
    if (prev) it.dist[5 - prev] = Math.max(0, it.dist[5 - prev] - 1);
    it.dist[5 - stars] += 1;
    u.rates[itemId] = stars;
    recomputeItem(it);
    audit(req, 'user_rate_set', email + ' → ' + itemId, (prev ? prev + ' 星 → ' : '新增 ') + stars + ' 星');
    saveDB();
    send(res, 200, { ok: true });
    return false;
  }
  r.POST['/api/admin/users/:email/rates/:itemId'] = (req, res, email, itemId) => mutateUserRate(req, res, decodeURIComponent(email), itemId, 'set');
  r.POST['/api/admin/users/:email/rates/:itemId/remove'] = (req, res, email, itemId) => mutateUserRate(req, res, decodeURIComponent(email), itemId, 'remove');


  // ---- 数据导出 / 备份(仅管理员)----
  function csvEsc(v) { const t = String(v == null ? '' : v); return '"' + t.replace(/"/g, '""') + '"'; }
  function csvDownload(res, filename, header, rows) {
    const lines = [header.map(csvEsc).join(',')].concat(rows.map(function (r) { return r.map(csvEsc).join(','); }));
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="' + filename + '"' });
    res.end('﻿' + lines.join('\r\n'));
  }
  r.GET['/api/admin/export/items.csv'] = (req, res) => {
    if (!adminOnly(req, res)) return;
    const header = ['id', 'name', 'domain', 'category', 'status', 'lumo_rating', 'user_score', 'user_count', 'dist_5_4_3_2_1', 'added', 'live_online', 'live_signup', 'live_promo'];
    const rows = db.items.map(function (it) {
      const c = db.categories.find((x) => x.id === it.cat) || {};
      const live = (db.live && db.live[it.id]) || [1, 1, 1];
      return [it.id, it.name, it.domain, c.title || it.cat, it.status, it.rating, it.userScore, it.userCount, (it.dist || []).join('/'), it.added, live[0], live[1], live[2]];
    });
    csvDownload(res, 'lumo-items.csv', header, rows);
  };
  r.GET['/api/admin/export/subs.csv'] = (req, res) => {
    if (!adminOnly(req, res)) return;
    const header = ['id', 'name', 'domain', 'category', 'submitter', 'status', 'reason', 'submitted_at', 'reviewed_at', 'item_id'];
    const rows = db.subs.map(function (x) {
      return [x.id, x.name, x.domain, x.catTitle || x.cat, x.email, x.status, x.reason || '', x.at ? new Date(x.at).toISOString() : '', x.reviewedAt ? new Date(x.reviewedAt).toISOString() : '', x.itemId || ''];
    });
    csvDownload(res, 'lumo-submissions.csv', header, rows);
  };
  r.POST['/api/admin/backup'] = (req, res) => {
    if (!adminOnly(req, res)) return;
    const dir = path.join(DATA_DIR, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    const name = 'lumo-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '.json';
    fs.writeFileSync(path.join(dir, name), JSON.stringify(db, null, 1), 'utf8');
    audit(req, 'backup', name, '全量数据快照');
    saveDB();
    send(res, 200, { ok: true, name: name });
  };
  r.GET['/api/admin/backups'] = (req, res) => {
    if (!adminOnly(req, res)) return;
    const dir = path.join(DATA_DIR, 'backups');
    let list = [];
    try {
      list = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse().map(function (f) {
        const st = fs.statSync(path.join(dir, f));
        return { name: f, size: st.size, time: st.mtimeMs };
      });
    } catch (e) {}
    send(res, 200, { backups: list });
  };
  r.POST['/api/admin/restore'] = async (req, res) => {
    if (!adminOnly(req, res)) return;
    const body = JSON.parse((await readBody(req)) || '{}');
    const name = path.basename(String(body.name || ''));
    const dir = path.join(DATA_DIR, 'backups');
    const file = path.join(dir, name);
    if (!/^lumo-[0-9-]+\.json$/.test(name) || !fs.existsSync(file)) return send(res, 400, { error: '备份文件不存在或名称非法' });
    // 恢复前先自动备份当前状态
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    const safe = 'pre-restore-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '.json';
    fs.writeFileSync(path.join(dir, safe), JSON.stringify(db, null, 1), 'utf8');
    const restored = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!restored.items || !restored.categories) return send(res, 400, { error: '备份文件格式无效' });
    restored.logs = (restored.logs || []);
    restored.logs.unshift({ at: Date.now(), actor: req._admin.email, action: 'restore', target: name, detail: '已恢复到该备份(当前状态已自动备份为 ' + safe + ')' });
    if (restored.logs.length > 500) restored.logs.length = 500;
    db = restored;
    saveDB();
    send(res, 200, { ok: true, safe: safe });
  };
  function recordEvidence(req, itemId, url, kind, note, extra) {
    if (!db.evidence) db.evidence = {};
    if (!db.evidence[itemId]) db.evidence[itemId] = [];
    const rec = { at: Date.now(), by: req ? (req._admin ? req._admin.email : 'system') : 'system', kind: kind, url: url, note: String(note || '').slice(0, 300), archiveStatus: 'pending', archiveUrl: null };
    if (extra) Object.assign(rec, extra);
    db.evidence[itemId].push(rec);
    if (db.evidence[itemId].length > 20) db.evidence[itemId] = db.evidence[itemId].slice(-20);
  }
  r.GET['/api/admin/items/:id/evidence'] = (req, res, id) => {
    if (!adminOnly(req, res)) return;
    send(res, 200, { evidence: (db.evidence && db.evidence[id]) || [] });
  };
  r.POST['/api/admin/items/:id/snapshot'] = async (req, res, id) => {
    if (!adminOnly(req, res)) return;
    const it = db.items.find((x) => x.id === id);
    if (!it) return send(res, 404, { error: '条目不存在' });
    const body = JSON.parse((await readBody(req)) || '{}');
    const url = 'https://' + it.domain;
    const rec = { at: Date.now(), by: req._admin.email, kind: 'manual', url: url, note: String(body.note || '人工生成证据快照').slice(0, 300), archiveStatus: 'pending', archiveUrl: null };
    if (!db.evidence) db.evidence = {};
    if (!db.evidence[id]) db.evidence[id] = [];
    db.evidence[id].push(rec);
    // 尝试查询互联网档案馆的存档(超时 6s;失败保留 pending,由生产侧存档任务补拍)
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const r2 = await fetch('https://archive.org/wayback/available?url=' + encodeURIComponent(url), { signal: ctrl.signal });
      clearTimeout(timer);
      const j = await r2.json();
      const cl = j && j.archived_snapshots && j.archived_snapshots.closest;
      if (cl && cl.url) { rec.archiveStatus = 'archived'; rec.archiveUrl = cl.url; rec.archiveTime = cl.timestamp || null; }
      else rec.archiveStatus = 'no_archive';
    } catch (e) { rec.archiveStatus = 'pending'; }
    saveDB();
    send(res, 200, { ok: true, record: rec });
  };

  r.GET['/api/admin/logs'] = (req, res) => {
    if (!adminOnly(req, res)) return;
    send(res, 200, { logs: (db.logs || []).slice(0, 200) });
  };

  return r;
}

const R = routes();
fs.mkdirSync(DATA_DIR, { recursive: true });
loadDB();

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const method = req.method;
  try {
    function matchDynamic(table) {
      for (const key of Object.keys(table)) {
        if (key.indexOf(':') === -1) continue;
        const parts = key.split('/');
        const reqParts = p.split('/');
        if (parts.length !== reqParts.length) continue;
        const args = [];
        let ok = true;
        for (let i = 0; i < parts.length; i++) {
          if (parts[i].startsWith(':')) args.push(decodeURIComponent(reqParts[i]));
          else if (parts[i] !== reqParts[i]) { ok = false; break; }
        }
        if (ok) return { key: key, args: args };
      }
      return null;
    }
    if (method === 'GET') {
      if (R.GET[p]) return R.GET[p](req, res);
      const dm = matchDynamic(R.GET);
      if (dm) return R.GET[dm.key](req, res, ...dm.args);
    }
    if (method === 'POST') {
      if (R.POST[p]) return await R.POST[p](req, res);
      const dm = matchDynamic(R.POST);
      if (dm) return await R.POST[dm.key](req, res, ...dm.args);
    }
    if (method === 'GET' || method === 'HEAD') return serveStatic(req, res, p);
    send(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    send(res, 400, { error: '请求无效' });
  }
});

server.listen(PORT, () => {
  console.log('Lumo 服务已启动: http://localhost:' + PORT);
  console.log('演示登录:任意邮箱,验证码 123456');
});
/* Lumo Server — zero-dependency Node HTTP + JSON persistence. Dev/MVP build. */
'use strict';
const http = require('http');
const net = require('net');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = process.env.LUMO_DATA_DIR ? path.resolve(process.env.LUMO_DATA_DIR) : path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SEED_FILE = path.join(ROOT, 'data', 'seed.json'); // 种子数据始终来自代码仓库
const PORT = process.env.LUMO_PORT || process.env.PORT || 4780;
const ADMIN_EMAIL = process.env.LUMO_ADMIN || 'admin@lumo.local';
function FAKE_CONTRIB_SEEDS() {
  const seed = [
    ['@ChainSleuth', 1860, 420, 46, 12, 3],
    ['@RugAlertX', 1240, 310, 31, 9, 2],
    ['@CryptoWhistle', 980, 240, 24, 7, 2],
    ['@DegenDebunker', 720, 190, 18, 5, 1],
    ['@TokenSheriff', 560, 150, 14, 4, 1],
    ['@ApeAuditor', 410, 120, 11, 3, 1],
    ['@WhaleWatcherK', 300, 90, 9, 2, 0],
    ['@AltcoinScope', 210, 70, 6, 1, 0],
    ['@SatoshiScout', 130, 45, 4, 0, 0]
  ];
  return seed.map((s, i) => ({ id: 'fake' + (i + 1), name: s[0], points: s[1], month: s[2], accepted: s[3], risk: s[4], dead: s[5] }));
}
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
    const fromAddr = (String(MAIL_FROM).match(/<([^>]+)>/) || [])[1] || String(MAIL_FROM).trim() || ('no-reply@' + (MAIL_HOST || 'localhost'));
    const fromHeader = 'Lumo <' + fromAddr + '>';
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
        await smtpCommand(sock, 'MAIL FROM:<' + fromAddr + '>', [250]);
        await smtpCommand(sock, 'RCPT TO:<' + to + '>', [250, 251]);
        await smtpCommand(sock, 'DATA', [354]);
        await smtpCommand(sock, 'From: ' + fromHeader + '\r\nTo: ' + to + '\r\nSubject: ' + subject + '\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n' + text + '\r\n.', [250]);
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
  if (!db.reports) db.reports = [];
  if (!db.checks) db.checks = {};
  if (!db.watch) db.watch = [];
  if (!Array.isArray(db.fakes) || !db.fakes.length) db.fakes = FAKE_CONTRIB_SEEDS();
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
  const u = db.users[email];
  if (u.points == null) u.points = 0;
  if (!u.counts) u.counts = { accepted: 0, risk: 0, dead: 0, reports: 0 };
  if (!u.events) u.events = [];
  if (u.alias == null) u.alias = String(email.split('@')[0] || email).replace(/[^\w.-]+/g, '').slice(0, 20) || 'user';
  if (u.creditPublic == null) u.creditPublic = true;
  return u;
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

// ---- reachability probe (zero-dependency; used by /api/items/:id/check) ----
function isPrivateIp(ip) {
  const parts = String(ip || '').split('.');
  if (parts.length !== 4) return false;
  const a = parseInt(parts[0], 10), b = parseInt(parts[1], 10), c = parseInt(parts[2], 10);
  if (a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0 || a >= 224) return true;
  return c === undefined;
}
function probeHttps(host, timeoutMs) {
  return new Promise((resolve) => {
    const req = require('https').get({
      host: host, servername: host, path: '/', method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LumoBot/1.0)', 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en', 'Connection': 'close' },
      timeout: timeoutMs, agent: false
    }, (res) => {
      const code = res.statusCode || 0;
      res.resume();
      res.destroy();
      resolve({ reachable: code >= 100 && code < 500, status: code, scheme: 'https' });
    });
    req.on('timeout', () => { req.destroy(); });
    req.on('error', () => { resolve({ reachable: false, status: 0 }); });
  });
}
function probeHttp(host, timeoutMs) {
  return new Promise((resolve) => {
    const req = require('http').get({
      host: host, path: '/', method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LumoBot/1.0)', 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en', 'Connection': 'close' },
      timeout: timeoutMs, agent: false
    }, (res) => {
      const code = res.statusCode || 0;
      res.resume();
      res.destroy();
      resolve({ reachable: code >= 100 && code < 500, status: code, scheme: 'http' });
    });
    req.on('timeout', () => { req.destroy(); });
    req.on('error', () => { resolve({ reachable: false, status: 0 }); });
  });
}
function probeDomain(domain, timeoutMs) {
  return new Promise((resolve) => {
    const host = String(domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return resolve({ online: false, reason: 'invalid host' });
    dns.lookup(host, { family: 4 }, (err, addr) => {
      if (err) return resolve({ online: false, reason: 'dns lookup failed' });
      if (isPrivateIp(addr)) return resolve({ online: false, reason: 'non-public address' });
      const t = timeoutMs || 12000;
      probeHttps(host, t).then((r) => {
        if (r.reachable) return resolve({ online: true, status: r.status, scheme: r.scheme });
        probeHttp(host, t).then((r2) => {
          if (r2.reachable) return resolve({ online: true, status: r2.status, scheme: r2.scheme });
          resolve({ online: false, reason: 'no response over https/http' });
        });
      });
    });
  });
}

function routes() {
  const r = { GET: {}, POST: {} };

  r.GET['/api/bootstrap'] = (req, res) => {
    const me = sessionUser(req);
    const myRates = me ? (userOf(me.email).rates || {}) : {};
    send(res, 200, { categories: db.categories, items: db.items, live: db.live, checked: db.checked, myRates: myRates, user: me ? me.email : null, contact: process.env.LUMO_CONTACT || '', checks: db.checks || {} });
  };

  // ---- 贡献者积分 / 排行榜(公开读 + 本人写)----
  function levelOf(p) { p = +p || 0; if (p >= 1000) return 'Top Contributor'; if (p >= 500) return 'Verified Hunter'; if (p >= 200) return 'Hunter'; if (p >= 50) return 'Scout'; return 'New Explorer'; }
  function contribKind(reason) { if (reason === 'submission_accepted') return 'accepted'; if (reason === 'risk_flag') return 'risk'; if (reason === 'dead_flag') return 'dead'; if (reason === 'report_valid') return 'reports'; return 'other'; }
  function awardContrib(email, delta, reason, target, itemId) {
    if (!email || email === '(bulk)' || String(email).indexOf('bulk') === 0 || String(email).indexOf('(system)') === 0) return;
    const u = userOf(email);
    const kind = contribKind(reason);
    u.points = Math.max(0, (+u.points || 0) + delta);
    if (!u.counts) u.counts = { accepted: 0, risk: 0, dead: 0, reports: 0 };
    u.counts[kind] = (u.counts[kind] || 0) + 1;
    if (!u.events) u.events = [];
    u.events.unshift({ at: Date.now(), delta: delta, reason: reason, target: String(target || '').slice(0, 90), itemId: itemId || '' });
    if (u.events.length > 200) u.events.length = 200;
    saveDB();
  }
  function contribRows(period) {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0); const ms = monthStart.getTime();
    const real = [];
    for (const em of Object.keys(db.users || {})) {
      const u = db.users[em];
      if (!u || u.creditPublic === false) continue;
      let pts = +u.points || 0, accepted = (u.counts && u.counts.accepted) || 0, risk = (u.counts && u.counts.risk) || 0, dead = (u.counts && u.counts.dead) || 0;
      if (period === 'month') {
        pts = 0; accepted = risk = dead = 0;
        for (const e of (u.events || [])) {
          if (e.at >= ms && (e.reason === 'submission_accepted' || e.reason === 'risk_flag' || e.reason === 'dead_flag')) {
            pts += e.delta;
            if (e.reason === 'submission_accepted') accepted++; else if (e.reason === 'risk_flag') risk++; else dead++;
          }
        }
      }
      if (pts > 0) real.push({ name: u.alias || String(em.split('@')[0] || em), points: pts, accepted: accepted, risk: risk, dead: dead, level: levelOf(pts), fake: false });
    }
    const fakes = (db.fakes || []).map(f => {
      const pts = period === 'month' ? (+f.month || 0) : (+f.points || 0);
      return { name: f.name, points: pts, accepted: +f.accepted || 0, risk: +f.risk || 0, dead: +f.dead || 0, level: levelOf(pts), fake: true, id: f.id };
    });
    return [...real, ...fakes].filter(x => x.points > 0).sort((a, b) => b.points - a.points).slice(0, 25).map((x, i) => ({ rank: i + 1, name: x.name, points: x.points, accepted: x.accepted, risk: x.risk, dead: x.dead, level: x.level, fake: !!x.fake }));
  }
  r.GET['/api/contrib/top'] = (req, res) => { send(res, 200, { all: contribRows('all'), month: contribRows('month') }); };
  r.GET['/api/contrib/me'] = (req, res) => {
    const me = sessionUser(req);
    if (!me) return send(res, 200, { user: null });
    const u = userOf(me.email);
    send(res, 200, { user: { alias: u.alias, points: +u.points || 0, level: levelOf(u.points), creditPublic: u.creditPublic !== false, trusted: !!u.trusted, counts: u.counts || {}, events: (u.events || []).slice(0, 60) } });
  };
  r.POST['/api/contrib/profile'] = async (req, res) => {
    const me = sessionUser(req);
    if (!me) return send(res, 401, { error: 'Sign in required' });
    const b = JSON.parse((await readBody(req)) || '{}');
    const u = userOf(me.email);
    const alias = String(b.alias || '').trim().replace(/^@/, '').slice(0, 24).replace(/[<>"'&]/g, '');
    if (alias) u.alias = alias;
    if (b.creditPublic !== undefined) u.creditPublic = !!b.creditPublic;
    saveDB();
    send(res, 200, { ok: true, alias: u.alias, creditPublic: u.creditPublic !== false });
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
    send(res, 200, { ok: true, dev: dev, note: note, hint: dev ? ('Code: ' + code) : 'Code sent — check your inbox.' });
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

  r.GET['/api/watch'] = (req, res) => {
    send(res, 200, { watch: (db.watch || []).slice(0, 300) });
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

  // ---- 报告 / 反馈(登录用户)----
  const REPORT_KINDS = ['wrong', 'scam', 'offline', 'appeal', 'other'];
  r.POST['/api/reports'] = async (req, res) => {
    const me = sessionUser(req);
    if (!me) return send(res, 401, { error: '请先登录' });
    if (!rateLimit(req, 6, 3600000)) return send(res, 429, { error: '提交过于频繁,请稍后再试' });
    const body = JSON.parse((await readBody(req)) || '{}');
    const kind = String(body.kind || 'other');
    if (REPORT_KINDS.indexOf(kind) === -1) return send(res, 400, { error: '报告类型无效' });
    const detail = String(body.detail || '').trim().slice(0, 1000);
    const itemId = String(body.itemId || '').trim();
    let it = itemId ? db.items.find((x) => x.id === itemId) : null;
    if (!it) {
      const rawUrl = String(body.url || '').trim();
      if (!rawUrl) return send(res, 400, { error: '请提供条目或网址' });
      it = { id: '', name: rawUrl, domain: rawUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '') };
    }
    if (!db.reports) db.reports = [];
    const rec = { id: 'rep' + Date.now() + Math.floor(Math.random() * 900), at: Date.now(), email: me.email, kind: kind, itemId: it.id, itemName: it.name || it.domain, domain: it.domain, detail: detail, status: 'open', note: '' };
    db.reports.unshift(rec);
    if (!db.logs) db.logs = [];
    db.logs.unshift({ at: Date.now(), actor: me.email, action: 'report', target: rec.domain, detail: kind + (detail ? ' — ' + detail.slice(0, 160) : '') });
    if (db.logs.length > 500) db.logs.length = 500;
    saveDB();
    send(res, 200, { report: rec });
  };
  r.GET['/api/reports/mine'] = (req, res) => {
    const me = sessionUser(req);
    if (!me) return send(res, 401, { error: '请先登录' });
    send(res, 200, { reports: (db.reports || []).filter((x) => x.email === me.email).slice(0, 50) });
  };

  // ---- 实时可访问性检测(登录用户)----
  r.POST['/api/items/:id/check'] = async (req, res, id) => {
    const me = sessionUser(req);
    if (!me) return send(res, 401, { error: '请先登录' });
    if (!rateLimit(req, 12, 60000)) return send(res, 429, { error: '检测过于频繁,请稍后再试' });
    const it = db.items.find((x) => x.id === id);
    if (!it) return send(res, 404, { error: '条目不存在' });
    const out = await probeDomain(it.domain, 12000);
    if (!db.checks) db.checks = {};
    db.checks[id] = { at: Date.now(), online: !!out.online, status: out.status || 0, scheme: out.scheme || '', note: out.reason || '', by: me.email };
    if (!db.logs) db.logs = [];
    db.logs.unshift({ at: Date.now(), actor: me.email, action: 'recheck', target: it.name + ' / ' + it.domain, detail: (out.online ? 'reachable' : 'unreachable') + (out.status ? ' HTTP ' + out.status : '') + (out.reason ? ' (' + out.reason + ')' : '') });
    if (db.logs.length > 500) db.logs.length = 500;
    saveDB();
    send(res, 200, { online: !!out.online, status: out.status || 0, scheme: out.scheme || '', note: out.reason || '', at: db.checks[id].at });
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
  // ---- 贡献者管理(仅管理员)----
  r.GET['/api/admin/contrib'] = (req, res) => {
    if (!adminOnly(req, res)) return;
    const users = Object.keys(db.users || {}).map(function (em) {
      const u = db.users[em];
      return { email: em, alias: (u && u.alias) || String(em.split('@')[0] || em), points: (u && +u.points) || 0, creditPublic: u ? u.creditPublic !== false : true, trusted: !!(u && u.trusted), counts: (u && u.counts) || {}, level: levelOf((u && u.points) || 0), createdAt: (u && u.createdAt) || 0 };
    }).sort(function (a, b) { return b.points - a.points; });
    send(res, 200, { users: users, fakes: db.fakes || [] });
  };
  r.POST['/api/admin/contrib/fake'] = async (req, res) => {
    if (!adminOnly(req, res)) return;
    const b = JSON.parse((await readBody(req)) || '{}');
    const name = String(b.name || '').trim().slice(0, 40);
    if (!name) return send(res, 400, { error: '缺少名称' });
    if (!db.fakes) db.fakes = [];
    db.fakes.push({ id: 'f' + Date.now() + Math.floor(Math.random() * 900), name: name, points: Math.max(0, Math.round(+b.points || 0)), month: Math.max(0, Math.round(+b.month || 0)), accepted: Math.max(0, Math.round(+b.accepted || 0)), risk: Math.max(0, Math.round(+b.risk || 0)), dead: Math.max(0, Math.round(+b.dead || 0)) });
    audit(req, 'add_fake_contrib', name, 'points ' + (b.points || 0));
    saveDB();
    send(res, 200, { ok: true });
  };
  r.POST['/api/admin/contrib/fake/:id/delete'] = (req, res, id) => {
    if (!adminOnly(req, res)) return;
    if (!db.fakes) db.fakes = [];
    const i = db.fakes.findIndex(x => x.id === id);
    if (i < 0) return send(res, 404, { error: '不存在' });
    const nm = db.fakes[i].name;
    db.fakes.splice(i, 1);
    audit(req, 'delete_fake_contrib', nm, '');
    saveDB();
    send(res, 200, { ok: true });
  };
  r.POST['/api/admin/contrib/user'] = async (req, res) => {
    if (!adminOnly(req, res)) return;
    const b = JSON.parse((await readBody(req)) || '{}');
    const email = String(b.email || '').trim().toLowerCase();
    if (!email) return send(res, 400, { error: '缺少邮箱' });
    const u = userOf(email);
    if (b.alias !== undefined) { const al = String(b.alias || '').trim().replace(/^@/, '').slice(0, 24).replace(/[<>"'&]/g, ''); if (al) u.alias = al; }
    if (b.creditPublic !== undefined) u.creditPublic = !!b.creditPublic;
    if (b.trusted !== undefined) u.trusted = !!b.trusted;
    if (b.points !== undefined && !isNaN(b.points)) {
      const np = Math.max(0, Math.round(+b.points));
      if (np !== (+u.points || 0)) {
        if (!u.events) u.events = [];
        u.events.unshift({ at: Date.now(), delta: np - (+u.points || 0), reason: 'admin', target: 'Manual adjustment by admin', itemId: '' });
        if (u.events.length > 200) u.events.length = 200;
        u.points = np;
      }
    }
    audit(req, 'update_contrib', email, 'alias/credit/trusted/points');
    saveDB();
    send(res, 200, { ok: true });
  };

  r.GET['/api/admin/subs'] = (req, res) => {
    if (!adminOnly(req, res)) return;
    const list = db.subs.map(function (x) {
      return { id: x.id, name: x.name, domain: x.domain, cat: x.cat, catTitle: x.catTitle, tagline: x.tagline, intro: x.intro, email: x.email, status: x.status, at: x.at, reviewedAt: x.reviewedAt || null, itemId: x.itemId || null, reason: x.reason || '', priority: x.status === 'pending' ? !!(db.users[x.email] && (db.users[x.email].trusted || (+db.users[x.email].points || 0) >= 200)) : false, draftRating: x.draftRating == null ? null : x.draftRating, draftAt: x.draftAt || null };
    }).sort(function (a, b) { return b.at - a.at; });
    send(res, 200, { submissions: list });
  };
  r.GET['/api/admin/stats'] = (req, res) => {
    if (!adminOnly(req, res)) return;
    const items = db.items;
    const dead = items.filter((x) => db.live && db.live[x.id] && db.live[x.id][0] === 0).length;
    send(res, 200, {
      items: items.length, dead: dead, alive: items.length - dead,
      risk: items.filter((x) => x.status === 'risk').length,
      pending: db.subs.filter((x) => x.status === 'pending').length,
      submissions: db.subs.length,
      users: Object.keys(db.users || {}).length,
      reports: (db.reports || []).length,
      openReports: (db.reports || []).filter((x) => x.status === 'open').length
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
      facts: [['Type', c.title || '—'], ['Source', 'User / bulk submission · human-reviewed'], ['Status', 'Live — verified reachable']],
      reasons: [{ t: 'info', txt: 'Submitted and human-reviewed before listing; reachability was verified at approval time.' }]
    });
    rec.status = 'approved'; rec.itemId = id2; rec.reviewedAt = Date.now();
    delete rec.draftRating; delete rec.draftAt;
    {
      const nw = db.items[0];
      if (nw && nw.id === id2 && rec.email && rec.email !== '(bulk)' && db.users[rec.email]) {
        const su = userOf(rec.email);
        nw.creditName = (su.creditPublic !== false && su.alias) ? su.alias : null;
        awardContrib(rec.email, 10, 'submission_accepted', rec.name + ' / ' + rec.domain, id2);
      }
    }
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
    delete rec.draftRating; delete rec.draftAt;
    rec.reason = String(body.reason || '').trim().slice(0, 200);
    rec.reviewedAt = Date.now();
    audit(req, 'reject_submission', rec.name + ' / ' + rec.domain, '原因:' + (rec.reason || '无'));
    saveDB();
    send(res, 200, { ok: true });
  };

  // ---- 待审核评分草稿(仅管理员):人工填了分但未点通过时自动保存,用于把“已评分”项沉底 ----
  r.POST['/api/admin/subs/:id/draft'] = async (req, res, id) => {
    if (!adminOnly(req, res)) return;
    const rec = db.subs.find((x) => x.id === id);
    if (!rec) return send(res, 404, { error: '提交不存在' });
    if (rec.status !== 'pending') return send(res, 400, { error: '该提交已处理' });
    const body = JSON.parse((await readBody(req)) || '{}');
    const raw = body.rating;
    const cleared = raw === '' || raw === null || raw === undefined;
    if (!cleared) {
      const r = parseFloat(raw);
      if (isNaN(r)) return send(res, 400, { error: '评分格式不正确' });
      rec.draftRating = Math.max(0.5, Math.min(10, Math.round(r * 10) / 10));
      rec.draftAt = Date.now();
    } else {
      delete rec.draftRating; delete rec.draftAt;
    }
    saveDB();
    send(res, 200, { ok: true, draftRating: rec.draftRating || null });
  };
  // ---- 举报 / 反馈管理(仅管理员)----
  r.GET['/api/admin/reports'] = (req, res) => {
    if (!adminOnly(req, res)) return;
    const list = (db.reports || []).map(function (x) {
      const it = x.itemId ? db.items.find((y) => y.id === x.itemId) : null;
      return { id: x.id, at: x.at, email: x.email, kind: x.kind, itemId: x.itemId, itemName: x.itemName, domain: x.domain, detail: x.detail, status: x.status, note: x.note || '', linked: !!(it && it.id) };
    }).sort((a, b) => b.at - a.at);
    send(res, 200, { reports: list.slice(0, 200) });
  };
  r.POST['/api/admin/reports/:id/resolve'] = async (req, res, id) => {
    if (!adminOnly(req, res)) return;
    const rec = (db.reports || []).find((x) => x.id === id);
    if (!rec) return send(res, 404, { error: '报告不存在' });
    const b = JSON.parse((await readBody(req)) || '{}');
    rec.status = b.status === 'dismissed' ? 'dismissed' : 'resolved';
    rec.note = String(b.note || '').trim().slice(0, 500);
    rec.updatedAt = Date.now();
    if (rec.status === 'resolved' && b.action === 'valid' && rec.email) awardContrib(rec.email, 10, 'report_valid', rec.domain + ' / ' + rec.kind, rec.itemId || '');
    audit(req, 'resolve_report', rec.domain + ' / ' + rec.id, rec.status + (rec.note ? ' — ' + rec.note : ''));
    saveDB();
    send(res, 200, { ok: true });
  };

  // ---- 收录前域名探测(仅管理员,走服务器出口,避免在无法访问时误收录)----
  // ---- 服务器端抓取(仅管理员):真实出口抓任意公开页面/接口,供自动收集分析 ----
  const COLLECT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
  r.POST['/api/admin/fetch'] = async (req, res) => {
    if (!adminOnly(req, res)) return;
    if (!rateLimit(req, 30, 60000)) return send(res, 429, { error: '请求过于频繁' });
    const b = JSON.parse((await readBody(req)) || '{}');
    let url = String(b.url || '').trim();
    if (!/^https?:\/\//i.test(url)) return send(res, 400, { error: '仅支持 http(s) 地址' });
    url = url.replace(/^http:\/\//i, 'https://');
    const ctl = new AbortController();
    const timer = setTimeout(function () { ctl.abort(); }, 25000);
    try {
      const r = await fetch(url, {
        redirect: 'follow',
        signal: ctl.signal,
        headers: { 'User-Agent': COLLECT_UA, 'Accept': 'text/html,application/xhtml+xml,application/json,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.8' }
      });
      const raw = await r.text();
      const txt = String(raw || '').slice(0, 400000);
      audit(req, 'collect_fetch', String(url).slice(0, 160), 'HTTP ' + r.status + ' len ' + txt.length);
      send(res, 200, { ok: true, url: r.url || url, status: r.status, type: (r.headers.get('content-type') || '').slice(0, 120), len: txt.length, text: txt });
    } catch (e) {
      audit(req, 'collect_fetch', String(url).slice(0, 160), 'ERR ' + String(e.message || e).slice(0, 120));
      send(res, 502, { ok: false, error: String(e.message || e).slice(0, 200) });
    } finally { clearTimeout(timer); }
  };

  r.POST['/api/admin/probe'] = async (req, res) => {
    if (!adminOnly(req, res)) return;
    if (!rateLimit(req, 30, 60000)) return send(res, 429, { error: '检测过于频繁,请稍后再试' });
    const b = JSON.parse((await readBody(req)) || '{}');
    const domain = String(b.domain || '').trim();
    if (!domain) return send(res, 400, { error: '缺少域名' });
    const out = await probeDomain(domain, 12000);
    audit(req, 'probe_domain', domain, (out.online ? 'reachable' : 'unreachable') + (out.status ? ' HTTP ' + out.status : '') + (out.reason ? ' (' + out.reason + ')' : ''));
    send(res, 200, { online: !!out.online, status: out.status || 0, scheme: out.scheme || '', note: out.reason || '' });
  };

  // ---- 批量导入候选(仅管理员):每行 名称|域名|类目(可省),先探活,可达的进待审核队列 ----
  r.POST['/api/admin/bulk-import'] = async (req, res) => {
    if (!adminOnly(req, res)) return;
    if (!rateLimit(req, 60, 60000)) return send(res, 429, { error: '操作过于频繁,请稍后再试' });
    const b = JSON.parse((await readBody(req)) || '{}');
    const raw = Array.isArray(b.entries) ? b.entries : [];
    const defCat = String(b.cat || 'crypto');
    if (!db.categories.some((c) => c.id === defCat)) return send(res, 400, { error: '默认类目无效' });
    const catById = (id) => db.categories.find((c) => c.id === id) || {};
    const out = { queued: [], duplicate: [], offline: [], invalid: [] };
    if (!db.subs) db.subs = [];
    for (const e of raw) {
      const name = String(e.name || '').trim().slice(0, 80);
      let domain = String(e.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
      const cat = catById(String(e.cat || defCat)).id || defCat;
      if (!name || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) { out.invalid.push(name || domain || '(empty)'); continue; }
      if (db.items.some((x) => x.domain === domain) || db.subs.some((x) => x.domain === domain && x.status === 'pending')) { out.duplicate.push(name + ' (' + domain + ')'); continue; }
      const pr = await probeDomain(domain, 10000);
      if (!pr.online) { out.offline.push(name + ' (' + domain + ')'); continue; }
      const rec = { id: 'sub' + Date.now() + Math.floor(Math.random() * 900), email: '(bulk)', name: name, domain: domain, cat: cat, catTitle: catById(cat).title || cat, tagline: name, intro: 'Candidate added by batch import; awaiting human scoring.', status: 'pending', at: Date.now(), source: 'bulk', probe: { online: true, status: pr.status, scheme: pr.scheme } };
      db.subs.unshift(rec);
      out.queued.push(name + ' (' + domain + ')');
    }
    if (db.logs) db.logs.unshift({ at: Date.now(), actor: req._admin.email, action: 'bulk_import', target: String(raw.length), detail: 'queued ' + out.queued.length + ' / duplicate ' + out.duplicate.length + ' / offline ' + out.offline.length + ' / invalid ' + out.invalid.length });
    if (db.logs.length > 500) db.logs.length = 500;
    saveDB();
    send(res, 200, out);
  };

  // ---- 风险线索 Watchlist(仅管理员)----
  r.POST['/api/admin/watch'] = async (req, res) => {
    if (!adminOnly(req, res)) return;
    const b = JSON.parse((await readBody(req)) || '{}');
    const name = String(b.name || '').trim().slice(0, 120);
    const handle = String(b.handle || '').trim().replace(/^@/, '').replace(/^t\.me\//, '').slice(0, 80);
    const cat = String(b.cat || 'crypto').slice(0, 30);
    const reason = String(b.reason || '').trim().slice(0, 800);
    if (!name || !handle || !reason) return send(res, 400, { error: '名称/账号/理由必填' });
    if (!db.watch) db.watch = [];
    db.watch.unshift({ id: 'w' + Date.now() + Math.floor(Math.random() * 900), at: Date.now(), name: name, handle: handle, cat: cat, url: 'https://t.me/' + handle, reason: reason, status: 'flagged' });
    audit(req, 'add_watch', name + ' (@' + handle + ')', reason.slice(0, 160));
    saveDB();
    send(res, 200, { ok: true });
  };
  r.POST['/api/admin/watch/:id/delete'] = (req, res, id) => {
    if (!adminOnly(req, res)) return;
    const i = (db.watch || []).findIndex((x) => x.id === id);
    if (i < 0) return send(res, 404, { error: '记录不存在' });
    const rec = db.watch[i];
    db.watch.splice(i, 1);
    audit(req, 'delete_watch', rec.name + ' (@' + rec.handle + ')', '');
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
    const prevStatus = it.status;
    const prevLive0 = (db.live && db.live[id] && db.live[id][0]);
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
    if (b.reasons && Array.isArray(b.reasons)) it.reasons = b.reasons;
    {
      const origin = (db.subs || []).find(x => x.itemId === id && x.status === 'approved' && x.email && x.email !== '(bulk)');
      if (origin && db.users[origin.email]) {
        const nowLive0 = (db.live && db.live[id] && db.live[id][0]);
        if (b.status === 'risk' && prevStatus !== 'risk') awardContrib(origin.email, 10, 'risk_flag', it.name + ' / ' + it.domain, id);
        if (Array.isArray(b.live) && b.live.length === 3 && b.live[0] === 0 && prevLive0 !== 0) awardContrib(origin.email, 15, 'dead_flag', it.name + ' / ' + it.domain, id);
      }
    }
    audit(req, 'update_item', it.name + ' / ' + it.domain, JSON.stringify({ rating: b.rating, status: b.status, name: b.name, domain: b.domain, live: b.live }));
    saveDB();
    send(res, 200, { ok: true });
  };
  r.POST['/api/admin/items/:id/rating'] = async (req, res, id) => {
    if (!adminOnly(req, res)) return;
    const it = db.items.find((x) => x.id === id);
    if (!it) return send(res, 404, { error: '条目不存在' });
    const b = JSON.parse((await readBody(req)) || '{}');
    if (Array.isArray(b.dist) && b.dist.length === 5 && b.dist.every((n) => Number.isFinite(Number(n)) && Number(n) >= 0)) {
      it.dist = b.dist.map((n) => Math.max(0, Math.round(Number(n))));
    } else if (b.count != null && b.avg != null) {
      const cnt = Number(b.count);
      const avg = Number(b.avg);
      if (!Number.isFinite(cnt) || !Number.isFinite(avg)) return send(res, 400, { error: '人数与均分格式不正确' });
      it.dist = distributeAvg(Math.max(0, Math.round(cnt)), Math.max(0, Math.min(5, avg)));
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

  r.POST['/api/admin/localize'] = (req, res) => {
    if (!adminOnly(req, res)) return;
    try {
      const en = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
      db.categories = en.categories;
      db.items = en.items;
      if (en.live) db.live = en.live;
      audit(req, 'localize_en', 'all', '重设为英文种子内容(' + en.items.length + ' items)');
      saveDB();
      send(res, 200, { ok: true, items: en.items.length });
    } catch (e) { send(res, 500, { error: 'localize failed: ' + e.message }); }
  };
  r.GET['/api/admin/logs'] = (req, res) => {
    if (!adminOnly(req, res)) return;
    send(res, 200, { logs: (db.logs || []).slice(0, 200) });
  };

  return r;
}

function runBackupSnapshot(reason) {
  try {
    const dir = path.join(DATA_DIR, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    const name = 'lumo-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '.json';
    fs.writeFileSync(path.join(dir, name), JSON.stringify(db, null, 1), 'utf8');
    if (!db.logs) db.logs = [];
    db.logs.unshift({ at: Date.now(), actor: 'system', action: 'auto_backup', target: name, detail: reason || '定时自动备份' });
    if (db.logs.length > 500) db.logs.length = 500;
    const keep = Number(process.env.LUMO_BACKUP_KEEP || 14);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse();
    files.slice(keep).forEach((f) => { try { fs.unlinkSync(path.join(dir, f)); } catch (e) {} });
    saveDB();
    console.log('[Lumo] 自动备份完成:', name, '(' + reason + ')');
  } catch (e) { console.log('[Lumo] 自动备份失败:', e.message); }
}
async function runEvidenceArchive() {
  try {
    if (!db.evidence) db.evidence = {};
    let pending = [];
    Object.keys(db.evidence).forEach((id) => {
      (db.evidence[id] || []).forEach((rec) => { if (rec.archiveStatus === 'pending') pending.push({ id: id, rec: rec }); });
    });
    if (!pending.length) return;
    let done = 0;
    for (const item of pending.slice(0, 8)) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6000);
        const r = await fetch('https://archive.org/wayback/available?url=' + encodeURIComponent(item.rec.url), { signal: ctrl.signal });
        clearTimeout(timer);
        const j = await r.json();
        const cl = j && j.archived_snapshots && j.archived_snapshots.closest;
        if (cl && cl.url) { item.rec.archiveStatus = 'archived'; item.rec.archiveUrl = cl.url; item.rec.archiveTime = cl.timestamp || null; }
        else item.rec.archiveStatus = 'no_archive';
        done++;
      } catch (e) { /* 网络失败:保留 pending 下轮再试 */ }
    }
    if (done) { saveDB(); console.log('[Lumo] 证据快照自动补拍完成:', done + '/' + pending.length); }
  } catch (e) { console.log('[Lumo] 证据快照补拍异常:', e.message); }
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

const BACKUP_INIT_SEC = Number(process.env.LUMO_BACKUP_INIT_SECONDS || 60);
const BACKUP_HOURS = Number(process.env.LUMO_BACKUP_HOURS || 24);
const ARCHIVE_INIT_SEC = Number(process.env.LUMO_ARCHIVE_INIT_SECONDS || 20);
const ARCHIVE_MIN = Number(process.env.LUMO_ARCHIVE_MINUTES || 10);

server.listen(PORT, () => {
  console.log('Lumo 服务已启动: http://localhost:' + PORT);
  console.log('演示登录:任意邮箱,验证码 123456');
  if (BACKUP_INIT_SEC > 0) {
    setTimeout(function () { runBackupSnapshot('启动后首次自动备份'); }, BACKUP_INIT_SEC * 1000);
    setInterval(function () { runBackupSnapshot('每日定时自动备份'); }, BACKUP_HOURS * 3600 * 1000);
    console.log('[Lumo] 已启用自动备份(首次 ' + BACKUP_INIT_SEC + 's,每 ' + BACKUP_HOURS + 'h)');
  }
  if (ARCHIVE_INIT_SEC > 0) {
    setTimeout(runEvidenceArchive, ARCHIVE_INIT_SEC * 1000);
    setInterval(runEvidenceArchive, ARCHIVE_MIN * 60 * 1000);
    console.log('[Lumo] 已启用证据快照自动补拍(每 ' + ARCHIVE_MIN + ' 分钟)');
  }
});

/* Lumo 管理后台 — 队列 / 条目管理 / 用户评分(独立于用户端,不对外公开) */
(function () {
  'use strict';
  var box = document.getElementById('box');
  var who = document.getElementById('who');
  var curTab = 'queue';
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function wait(ms){ return new Promise(function(r){ setTimeout(r, ms||150); }); }
  function jget(url){ return fetch(url).then(function(r){ return r.json(); }); }
  function jpost(url, body){ return fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body||{}) }).then(function(r){ return r.json(); }); }
  function fmt(t){ return t ? new Date(t).toLocaleString('zh-CN', { hour12:false }) : '-'; }

  function loginView() {
    box.innerHTML =
      '<div class="admin-login"><h3 style="font-size:18px;margin-bottom:6px">管理员登录</h3>' +
      '<p style="color:var(--dim);font-size:13px;margin-bottom:16px">仅限 Lumo 管理员(admin@lumo.local)。</p>' +
      '<label class="field"><span>邮箱</span><input id="admEmail" type="email" placeholder="admin@lumo.local 或你配置的管理员邮箱"></label>' +
      '<label class="field" style="margin-top:12px"><span>验证码</span><input id="admCode" inputmode="numeric" maxlength="6" placeholder="123456"></label>' +
      '<button class="btn btn-primary btn-block" id="admLogin" style="margin-top:16px">登录</button>' +
      '<p style="color:var(--dim);font-size:12px;margin-top:12px">演示验证码:123456 · 正式版将改为真实邮件 + 2FA</p></div>';
    document.getElementById('admLogin').onclick = function () {
      var email = document.getElementById('admEmail').value.trim();
      var code = document.getElementById('admCode').value.trim();
      jpost('/api/auth/verify', { email: email, code: code }).then(function (j) { if (j.error) alert(j.error); else location.reload(); });
    };
  }

  function renderShell() {
    box.innerHTML =
      '<div class="queue-head" style="margin-top:0"><h2 id="statTitle"></h2><span id="statSub"></span></div>' +
      '<div class="bar" style="margin:2px 0 0">' +
      '<a class="btn btn-ghost btn-sm" href="/api/admin/export/items.csv" download>导出条目 CSV</a>' +
      '<a class="btn btn-ghost btn-sm" href="/api/admin/export/subs.csv" download>导出提交 CSV</a>' +
      '<button class="btn btn-ghost btn-sm" id="backupBtn">一键备份</button>' +
      '<button class="btn btn-ghost btn-sm" id="restoreBtn">恢复备份</button>' +
      '<span class="mini" id="backupInfo" style="margin-left:auto"></span></div>' +
      '<div id="restoreBox" style="display:none"></div>' +
      '<div class="tabs" id="tabs">' +
      '<button data-tab="queue">审核队列</button>' +
      '<button data-tab="items">条目管理</button>' +
      '<button data-tab="users">用户评分</button>' +
      '<button data-tab="logs">操作日志</button>' +
      '</div><div id="body"></div>';
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.onclick = function () { curTab = b.getAttribute('data-tab'); render(); };
    });
    var bb = document.getElementById('backupBtn');
    if (bb) bb.onclick = function () {
      jpost('/api/admin/backup', {}).then(function (j) {
        var info = document.getElementById('backupInfo');
        if (info) info.textContent = j.error || ('已备份:' + j.name);
        loadBackups();
      });
    };
    var rb = document.getElementById('restoreBtn');
    if (rb) rb.onclick = function () {
      var boxEl = document.getElementById('restoreBox');
      var shown = boxEl.style.display !== 'none';
      boxEl.style.display = shown ? 'none' : 'block';
      if (!shown) loadBackups();
    };
  }
  function loadBackups() {
    var boxEl = document.getElementById('restoreBox');
    if (!boxEl) return;
    jget('/api/admin/backups').then(function (d) {
      var list = d.backups || [];
      boxEl.innerHTML =
        '<div class="queue-head" style="margin:6px 0 4px"><h2>备份列表</h2><span>选择快照一键恢复(恢复前会自动再备份当前状态)</span></div>' +
        (list.length
          ? '<div class="adm-sub">' + list.map(function (b) {
              return '<div class="adm-sub-row"><div class="g"><div class="an" style="font-family:var(--mono);font-size:13px">' + esc(b.name) + '</div>' +
                '<div class="ac">' + Math.round(b.size / 1024) + ' KB · ' + fmt(b.time) + '</div></div>' +
                '<button class="btn btn-ghost btn-sm" data-restore="' + esc(b.name) + '">恢复此备份</button></div>';
            }).join('') + '</div>'
          : '<p style="color:var(--dim)">暂无备份,先点「一键备份」。</p>');
      document.querySelectorAll('[data-restore]').forEach(function (x) {
        x.onclick = function () {
          var name = x.getAttribute('data-restore');
          if (!confirm('确认恢复到 ' + name + '?当前数据会先自动备份。')) return;
          jpost('/api/admin/restore', { name: name }).then(function (j) {
            if (j.error) alert(j.error); else { alert('已恢复完成(安全备份:' + j.safe + '),页面将刷新。'); location.reload(); }
          });
        };
      });
    });
  }

  function render() {
    renderShell();
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === curTab);
    });
    jget('/api/admin/stats').then(function (s) {
      document.getElementById('statTitle').textContent = '运营数据';
      document.getElementById('statSub').textContent = '条目 ' + s.items + ' · 活跃 ' + s.alive + ' · DEAD ' + s.dead + ' · 风险 ' + s.risk + ' · 待审核 ' + s.pending + ' · 注册用户 ' + s.users;
    });
    if (curTab === 'queue') renderQueue();
    else if (curTab === 'items') renderItems();
    else if (curTab === 'users') renderUsers();
    else renderLogs();
  }

  /* ---------- 审核队列 ---------- */
  function renderQueue() {
    var body = document.getElementById('body');
    jget('/api/admin/subs').then(function (data) {
      var list = data.submissions || [];
      var pending = list.filter(function (x) { return x.status === 'pending'; });
      var rest = list.filter(function (x) { return x.status !== 'pending'; });
      function row(sub) {
        var st = sub.status;
        var statusHtml = '<span class="st ' + st + '">' + (st === 'pending' ? '待审核' : (st === 'approved' ? '已收录' : '未通过')) + '</span>';
        var actions;
        if (st === 'pending') {
          actions = '<label style="font-size:12px;color:var(--dim)">人工评分(必填)<input id="rate_' + sub.id + '" type="number" min="0.5" max="10" step="0.1" placeholder="如 8.2" required></label>' +
            '<button class="btn btn-primary btn-sm" data-ok="' + sub.id + '" disabled>通过并上架</button>' +
            '<button class="btn btn-ghost btn-sm" data-no="' + sub.id + '">拒绝</button>';
        } else if (st === 'approved') {
          actions = '<span style="font-size:12px;color:var(--dim)">已收录 → <a href="#/item/' + esc(sub.itemId) + '">查看条目</a></span>';
        } else {
          actions = '<span style="font-size:12px;color:var(--dim)">' + esc(sub.reason || '未通过') + '</span>';
        }
        return '<div class="adm-sub-row ' + (st !== 'pending' ? 'done' : '') + '"><div class="g"><div class="an">' + esc(sub.name) + ' <span class="ad">' + esc(sub.domain) + '</span> ' + statusHtml + '</div>' +
          '<div class="ac">类目:' + esc(sub.catTitle || sub.cat) + ' · 提交人:' + esc(sub.email) + ' · ' + fmt(sub.at) + '</div>' +
          '<div class="ac">' + esc(sub.intro || sub.tagline || '') + '</div></div>' + actions + '</div>';
      }
      body.innerHTML =
        '<div class="queue-head"><h2>待审核提交</h2><span>' + pending.length + ' 条 · 全部人工审核(系统不做自动判定)</span></div>' +
        (pending.length ? '<div class="adm-sub">' + pending.map(row).join('') + '</div>' : '<p style="color:var(--dim)">暂无待审核提交。</p>') +
        (rest.length ? '<div class="queue-head" style="margin-top:26px"><h2>已处理记录</h2><span>' + rest.length + ' 条</span></div><div class="adm-sub">' + rest.map(row).join('') + '</div>' : '');
      document.querySelectorAll('[data-ok]').forEach(function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-ok');
          var rateEl = document.getElementById('rate_' + id);
          jpost('/api/admin/subs/' + id + '/approve', { rating: rateEl ? rateEl.value : '' }).then(function (j) { if (j.error) alert(j.error); else render(); });
        };
      });
      document.querySelectorAll('[data-ok]').forEach(function (b) {
        var id = b.getAttribute('data-ok');
        var input = document.getElementById('rate_' + id);
        var refresh = function () {
          var v = parseFloat(input ? input.value : NaN);
          b.disabled = !(v >= 0.5 && v <= 10);
        };
        if (input) input.oninput = refresh;
        refresh();
      });
      document.querySelectorAll('[data-no]').forEach(function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-no');
          var reason = prompt('拒绝原因(可选):');
          if (reason === null) return;
          jpost('/api/admin/subs/' + id + '/reject', { reason: reason }).then(function (j) { if (j.error) alert(j.error); else render(); });
        };
      });
    });
  }

  /* ---------- 条目管理 ---------- */
  function itemCard(it) {
    var stMap = { ok: '正常收录', risk: '风险提示', review: '核实中' };
    return '<div class="it-row" data-id="' + it.id + '">' +
      '<div class="it-top"><span class="nm">' + esc(it.name) + '</span> <span class="dm">' + esc(it.domain) + '</span>' +
      '<span class="badge ' + (it.status === 'risk' ? 'bd-risk' : (it.status === 'review' ? 'bd-review' : 'bd-ok')) + '">' + stMap[it.status] + '</span>' +
      '<span class="mt">Lumo ' + it.rating + ' · 用户 ' + it.userScore + ' (' + it.userCount + ' 人) · 收录 ' + it.added + '</span>' +
      '<button class="btn btn-ghost btn-sm" data-edit="' + it.id + '">编辑资料 / 状态</button>' +
      '<button class="btn btn-ghost btn-sm" data-rating="' + it.id + '">改人数 / 打分</button>' +
      '<button class="btn btn-ghost btn-sm" data-snap="' + it.id + '">证据快照</button>' +
      '<button class="btn btn-ghost btn-sm" data-del="' + it.id + '" style="color:var(--bad)">删除</button></div>' +
      '<div class="it-forms" data-editform="' + it.id + '"></div>' +
      '<div class="it-forms" data-ratingform="' + it.id + '"></div>' +
    '</div>';
  }
  function renderItems() {
    var body = document.getElementById('body');
    body.innerHTML =
      '<div class="bar"><input id="itQ" placeholder="按名称 / 域名 / 类目搜索…"><button class="btn btn-ghost btn-sm" id="itSearch">搜索</button>' +
      '<span class="mini" style="margin-left:auto" id="itCount"></span></div><div id="itList"></div>';
    var load = function () {
      var q = document.getElementById('itQ').value.trim();
      jget('/api/admin/items?q=' + encodeURIComponent(q)).then(function (d) {
        document.getElementById('itList').innerHTML = (d.items || []).map(itemCard).join('');
        document.getElementById('itCount').textContent = (d.items || []).length + ' 条';
        wireItems();
      });
    };
    document.getElementById('itSearch').onclick = load;
    document.getElementById('itQ').onkeydown = function (e) { if (e.key === 'Enter') load(); };
    load();
  }
  function wireItems() {
    document.querySelectorAll('[data-edit]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-edit');
        jget('/api/admin/items').then(function (d) {
          var it = d.items.find(function (x) { return x.id === id; });
          if (!it) return;
          var cats = window.CATS_HTML || '';
          var box = document.querySelector('[data-editform="' + id + '"]');
          box.innerHTML =
            '<div class="frow">' +
            '<label>名称<input id="e_name_' + id + '" value="' + esc(it.name) + '"></label>' +
            '<label>域名<input id="e_domain_' + id + '" value="' + esc(it.domain) + '"></label>' +
            '<label>类目<select id="e_cat_' + id + '">' + it.cat + '</select></label>' +
            '<label>Lumo 评分<input id="e_rating_' + id + '" type="number" min="0.5" max="10" step="0.1" value="' + it.rating + '"></label>' +
            '<label>状态<select id="e_status_' + id + '">' +
            '<option value="ok"' + (it.status === 'ok' ? ' selected' : '') + '>正常收录</option>' +
            '<option value="risk"' + (it.status === 'risk' ? ' selected' : '') + '>风险提示</option>' +
            '<option value="review"' + (it.status === 'review' ? ' selected' : '') + '>核实中</option></select></label></div>' +
            '<label class="field">一句话简介<input id="e_tag_' + id + '" value="' + esc(it.tagline || '') + '"></label>' +
            '<label class="field">详细介绍<textarea id="e_intro_' + id + '">' + esc(it.intro || '') + '</textarea></label>' +
            '<div class="live-box" style="margin:8px 0">运营核验:' +
            '<label><input type="checkbox" id="e_l0_' + id + '"' + (it.live[0] ? ' checked' : '') + '> 可访问</label>' +
            '<label><input type="checkbox" id="e_l1_' + id + '"' + (it.live[1] ? ' checked' : '') + '> 可注册</label>' +
            '<label><input type="checkbox" id="e_l2_' + id + '"' + (it.live[2] ? ' checked' : '') + '> 仍在推广</label></div>' +
            '<button class="btn btn-primary btn-sm" data-save="' + id + '">保存修改</button>';
          fetch('/api/categories').then(function (r) { return r.json(); }).then(function (d2) {
            var sel = document.getElementById('e_cat_' + id);
            var opts = (d2.categories || []).map(function (c) { return '<option value="' + c.id + '"' + (c.id === it.cat ? ' selected' : '') + '>' + esc(c.title) + '</option>'; }).join('');
            sel.innerHTML = opts;
          });
          box.classList.add('show');
          document.querySelector('[data-save="' + id + '"]').onclick = function () {
            var live = [document.getElementById('e_l0_' + id).checked, document.getElementById('e_l1_' + id).checked, document.getElementById('e_l2_' + id).checked];
            jpost('/api/admin/items/' + id + '/update', {
              name: document.getElementById('e_name_' + id).value,
              domain: document.getElementById('e_domain_' + id).value,
              cat: document.getElementById('e_cat_' + id).value,
              rating: document.getElementById('e_rating_' + id).value,
              status: document.getElementById('e_status_' + id).value,
              tagline: document.getElementById('e_tag_' + id).value,
              intro: document.getElementById('e_intro_' + id).value,
              live: live
            }).then(function (j) { alert(j.error || '已保存'); renderItems(); });
          };
        });
      };
    });
    document.querySelectorAll('[data-rating]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-rating');
        jget('/api/admin/items').then(function (d) {
          var it = d.items.find(function (x) { return x.id === id; });
          if (!it) return;
          var box = document.querySelector('[data-ratingform="' + id + '"]');
          box.innerHTML =
            '<div class="frow">' +
            '<label>参与打分人数<input id="r_cnt_' + id + '" type="number" min="0" value="' + it.userCount + '"></label>' +
            '<label>平均用户打分(0–5)<input id="r_avg_' + id + '" type="number" min="0" max="5" step="0.1" value="' + it.userScore + '"></label></div>' +
            '<p class="mini">当前分布(5★~1★):' + (it.dist || []).join(' / ') + ' · 保存后按"人数+均分"重排分布。</p>' +
            '<button class="btn btn-primary btn-sm" data-saverating="' + id + '">保存评分</button>';
          box.classList.add('show');
          document.querySelector('[data-saverating="' + id + '"]').onclick = function () {
            jpost('/api/admin/items/' + id + '/rating', {
              count: document.getElementById('r_cnt_' + id).value,
              avg: document.getElementById('r_avg_' + id).value
            }).then(function (j) { if (j.error) alert(j.error); else { alert('已保存:均分 ' + j.userScore + ' · ' + j.userCount + ' 人'); renderItems(); } });
          };
        });
      };
    });
    document.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-del');
        if (!confirm('确认删除该条目?')) return;
        jpost('/api/admin/items/' + id + '/delete', {}).then(function (j) { if (j.error) alert(j.error); else renderItems(); });
      };
    });
    document.querySelectorAll('[data-snap]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-snap');
        if (!confirm('为该条目生成一份证据快照(会查询互联网档案馆存档)?')) return;
        jpost('/api/admin/items/' + id + '/snapshot', {}).then(function (j) {
          if (j.error) { alert(j.error); return; }
          var r = j.record || {};
          alert('证据快照已生成\n存档状态:' + (r.archiveStatus === 'archived' ? '已在互联网档案馆找到存档' : (r.archiveStatus === 'no_archive' ? '暂无公开存档(生产中由存档任务补拍)' : '待存档任务处理')) + (r.archiveUrl ? '\n' + r.archiveUrl : ''));
        });
      };
    });
  }

  /* ---------- 用户评分 ---------- */
  function renderUsers() {
    var body = document.getElementById('body');
    body.innerHTML = '<div class="bar"><input id="uQ" placeholder="输入邮箱搜索用户…"><button class="btn btn-ghost btn-sm" id="uSearch">搜索</button></div><div id="uList"></div>';
    var load = function () {
      var q = document.getElementById('uQ').value.trim();
      jget('/api/admin/users?q=' + encodeURIComponent(q)).then(function (d) {
        var list = d.users || [];
        document.getElementById('uList').innerHTML = list.length
          ? list.map(function (u) {
              return '<div class="it-row"><div class="it-top"><span class="nm" style="font-family:var(--mono)">' + esc(u.email) + '</span>' +
                '<span class="mt">已打分项目 ' + u.rated + '</span>' +
                '<button class="btn btn-ghost btn-sm" data-urates="' + esc(u.email) + '">查看 / 修改打分</button></div>' +
                '<div class="it-forms" data-uratesform="' + esc(u.email) + '"></div></div>';
            }).join('')
          : '<p style="color:var(--dim)">没有匹配的用户(评分必须先由用户产生)。</p>';
        document.querySelectorAll('[data-urates]').forEach(function (b) {
          b.onclick = function () {
            var email = b.getAttribute('data-urates');
            var box = document.querySelector('[data-uratesform="' + CSS.escape(email) + '"]');
            if (!box) return;
            jget('/api/admin/users/' + encodeURIComponent(email) + '/rates').then(function (d2) {
              var rates = d2.rates || [];
              box.innerHTML = rates.length
                ? rates.map(function (r) {
                    return '<div class="it-row" style="margin-bottom:6px"><div class="it-top"><span class="nm">' + esc(r.itemName) + '</span> <span class="dm">' + esc(r.itemDomain) + '</span>' +
                      '<select id="ustar_' + esc(r.itemId) + '" style="background:var(--panel-2);border:1px solid var(--line);border-radius:8px;color:var(--text);padding:5px">' +
                      [1,2,3,4,5].map(function (s) { return '<option value="' + s + '"' + (s === r.stars ? ' selected' : '') + '>' + s + ' 星</option>'; }).join('') + '</select>' +
                      '<button class="btn btn-primary btn-sm" data-usave="' + esc(r.itemId) + '|' + esc(email) + '">保存</button>' +
                      '<button class="btn btn-ghost btn-sm" data-uremove="' + esc(r.itemId) + '|' + esc(email) + '" style="color:var(--bad)">移除该票</button></div></div>';
                  }).join('')
                : '<p class="mini">该用户暂无打分记录。</p>';
              box.classList.add('show');
              document.querySelectorAll('[data-usave]').forEach(function (sb) {
                sb.onclick = function () {
                  var parts = sb.getAttribute('data-usave').split('|');
                  jpost('/api/admin/users/' + encodeURIComponent(parts[1]) + '/rates/' + parts[0], { stars: document.getElementById('ustar_' + parts[0]).value }).then(function (j) { alert(j.error || '已更新'); renderUsers(); });
                };
              });
              document.querySelectorAll('[data-uremove]').forEach(function (rb) {
                rb.onclick = function () {
                  var parts = rb.getAttribute('data-uremove').split('|');
                  if (!confirm('移除该用户的这一票?')) return;
                  jpost('/api/admin/users/' + encodeURIComponent(parts[1]) + '/rates/' + parts[0] + '/remove', {}).then(function (j) { alert(j.error || '已移除'); renderUsers(); });
                };
              });
            });
          };
        });
      });
    };
    document.getElementById('uSearch').onclick = load;
    document.getElementById('uQ').onkeydown = function (e) { if (e.key === 'Enter') load(); };
  }

  var ACTION_LABEL = { approve_submission: '审核通过', reject_submission: '审核拒绝', update_item: '修改条目', override_rating: '覆盖评分', delete_item: '删除条目', user_rate_set: '修改用户票', user_rate_remove: '移除用户票', backup: '数据备份' };
  function renderLogs() {
    var body = document.getElementById('body');
    body.innerHTML = '<div class="queue-head"><h2>操作日志</h2><span>管理员操作留痕(最近 200 条)</span></div><div class="adm-sub" id="logList"></div>';
    jget('/api/admin/logs').then(function (d) {
      var logs = d.logs || [];
      document.getElementById('logList').innerHTML = logs.length
        ? logs.map(function (l) {
            return '<div class="adm-sub-row"><div class="g">' +
              '<div class="an"><span class="st" style="color:var(--info);background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.3)">' + esc(ACTION_LABEL[l.action] || l.action) + '</span> ' + esc(l.target) + '</div>' +
              '<div class="ac">' + esc(l.actor) + ' · ' + fmt(l.at) + '</div>' +
              (l.detail ? '<div class="ac" style="color:var(--dim)">' + esc(l.detail) + '</div>' : '') +
              '</div></div>';
          }).join('')
        : '<p style="color:var(--dim)">暂无操作记录。</p>';
    });
  }

  document.getElementById('logoutBtn').onclick = function (e) {
    e.preventDefault();
    fetch('/api/auth/logout', { method: 'POST' }).then(function () { location.reload(); });
  };

  function start() {
    // 鉴权由服务端判定:能取到管理数据即管理员(邮箱可配置,不写死)
    jget('/api/admin/stats').then(function () {
      jget('/api/me').then(function (me) {
        who.textContent = '管理员:' + (me.user || '');
        document.getElementById('logoutBtn').style.display = 'inline-flex';
        render();
      });
    }).catch(function () { loginView(); });
  }
  start();
})();
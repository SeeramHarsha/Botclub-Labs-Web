/* Admin > App usage: how the Botclub Labs apps (Windows, Android, Linux) are used in schools. One school = one combined progress. */
(function () {
  'use strict';
  var A = window.BLA, h = A.h, F = { days: 30, cls: '', platform: '' };
  var PLAT = { windows: 'Windows', android: 'Android', linux: 'Linux', other: 'Other' };

  function dayStr(d) { return d.toISOString().slice(0, 10); }
  function qs(extra) {
    var p = new URLSearchParams(extra || {});
    p.set('from', dayStr(new Date(Date.now() - (F.days - 1) * 864e5)));
    if (F.cls) p.set('cls', F.cls);
    if (F.platform) p.set('platform', F.platform);
    return '?' + p.toString();
  }
  function get(path, extra) { return BL.api('/admin/usage' + path + qs(extra)); }
  function hrs(n) { return (n || 0) + ' h'; }
  function ago(d) {
    if (!d) return 'never';
    var m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
    return m < 2 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago';
  }
  function status(s) { return h('span', { class: 'badge ' + (s === 'online' ? 'green' : s === 'offline' ? 'grey' : 'red'), text: s }); }
  function sel(opts, val, on, label) {
    return h('select', { 'aria-label': label, class: 'flt', onchange: function (e) { on(e.target.value); } }, opts.map(function (o) { var op = h('option', { value: o[0], text: o[1] }); if (String(o[0]) === String(val)) op.selected = true; return op; }));
  }
  function frame(active, title, nodes, noFilters) {
    var tabs = [['#/usage', 'Overview'], ['#/usage/schools', 'Schools'], ['#/usage/screens', 'Screens'], ['#/usage/chapters', 'Chapters']];
    var flt = noFilters ? null : h('div', { class: 'filters' },
      sel([[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [365, 'Last year']], F.days, function (v) { F.days = Number(v); A.routes.usage(location.hash.slice(1)); }, 'Period'),
      sel([['', 'All classes'], [6, 'Class 6'], [7, 'Class 7'], [8, 'Class 8'], [9, 'Class 9'], [10, 'Class 10']], F.cls, function (v) { F.cls = v; A.routes.usage(location.hash.slice(1)); }, 'Class'),
      sel([['', 'All devices'], ['windows', 'Windows'], ['android', 'Android'], ['linux', 'Linux']], F.platform, function (v) { F.platform = v; A.routes.usage(location.hash.slice(1)); }, 'Platform'),
      h('a', { class: 'btn ghost small', href: '/api/admin/usage/export.csv' + qs(), text: 'Download CSV' }));
    A.show('#/usage', title, [h('div', { class: 'subnav', style: 'margin-top:0' }, tabs.map(function (t) { return h('a', { href: t[0], class: t[0] === active ? 'on' : '', text: t[1] }); })), flt].concat(nodes));
  }
  function loading() { return h('div', { class: 'empty', text: 'Loading…' }); }
  function barRows(rows, key, label, sub, max) {
    max = Math.max.apply(null, rows.map(function (r) { return r[key]; }).concat([max || 0.01]));
    return h('div', { style: 'display:grid;gap:9px' }, rows.map(function (r) {
      return h('div', null, h('div', { style: 'display:flex;justify-content:space-between;font-size:13px;gap:10px' }, h('span', { text: label(r) }), h('span', { class: 'micro', text: sub(r) })),
        h('div', { class: 'bar', style: 'margin-top:3px' }, h('i', { style: 'width:' + Math.max(1, r[key] / max * 100) + '%' })));
    }));
  }
  function chLabel(r) { return 'Class ' + r.cls + ' · Ch ' + r.chapter + (r.title ? ' · ' + r.title : ''); }

  // -------------------------------------------------------------- overview
  function overview() {
    frame('#/usage', 'App usage', [loading()]);
    Promise.all([get('/overview'), BL.api('/admin/usage/web')]).then(function (r) {
      var o = r[0], k = o.kpis, w = r[1];
      frame('#/usage', 'App usage', [
        h('div', { class: 'stats' }, A.stat('Hours learned', hrs(k.totalHours), k.lessonHours + ' h inside lessons', 'var(--blue)'), A.stat('Active schools', String(k.activeSchools || 0), null, 'var(--cyan)'),
          A.stat('Active screens', String(k.activeDevices || 0), (k.registeredDevices || 0) + ' registered', 'var(--green)'), A.stat('Online now', String(k.onlineNow || 0), 'synced in the last 15 min', 'var(--yellow)'),
          A.stat('Access ends soon', String(k.expiringSoon || 0), 'within 30 days', 'var(--red)'), A.stat('Sessions', String(k.sessions || 0), 'who-is-learning choices', 'var(--navy-3)')),
        h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px;margin-bottom:18px' },
          h('div', { class: 'card' }, h('h2', { style: 'font-size:16px;margin-bottom:12px', text: 'Hours per day' }), A.bars(o.daily, 'hours', 'var(--blue)', function (n) { return n + ' h'; })),
          h('div', { class: 'card' }, h('h2', { style: 'font-size:16px;margin-bottom:12px', text: 'Hours by class' }), barRows(o.byClass, 'hours', function (r) { return 'Class ' + r.cls; }, function (r) { return r.hours + ' h · ' + r.devices + ' screens'; }))),
        h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px' },
          h('div', { class: 'card' }, h('h2', { style: 'font-size:16px;margin-bottom:12px', text: 'Most used chapters' }), o.topChapters.length ? barRows(o.topChapters, 'hours', chLabel, function (r) { return r.hours + ' h · ' + r.devices + ' screens'; }) : h('div', { class: 'micro', text: 'No usage yet.' })),
          h('div', { class: 'card' }, h('h2', { style: 'font-size:16px;margin-bottom:12px', text: 'Top schools' }), o.bySchool.length ? barRows(o.bySchool, 'hours', function (r) { return r.school; }, function (r) { return r.hours + ' h · ' + r.devices + ' screens'; }) : h('div', { class: 'micro', text: 'No usage yet.' }),
            h('h2', { style: 'font-size:16px;margin:18px 0 10px', text: 'By device' }), o.byPlatform.length ? barRows(o.byPlatform, 'hours', function (r) { return PLAT[r.platform] || r.platform; }, function (r) { return r.hours + ' h · ' + r.devices + ' screens'; }) : null)),
        h('h2', { style: 'font-size:18px;margin:30px 0 12px', text: 'Students on the website' }),
        h('div', { class: 'stats' }, A.stat('Students', String(w.students), null, 'var(--cyan)'), A.stat('Active this week', String(w.activeStudents7d), null, 'var(--green)'), A.stat('Hours learned', hrs(w.hours), null, 'var(--blue)'), A.stat('Chapters done', String(w.chaptersDone), null, 'var(--yellow)')),
        h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px' },
          h('div', { class: 'card' }, h('h2', { style: 'font-size:16px;margin-bottom:12px', text: 'Student hours, last 14 days' }), A.bars(w.daily, 'hours', 'var(--cyan)', function (n) { return n + ' h'; })),
          h('div', { class: 'card' }, h('h2', { style: 'font-size:16px;margin-bottom:12px', text: 'Most used chapters (website)' }), w.topChapters.length ? barRows(w.topChapters, 'hours', chLabel, function (r) { return r.hours + ' h · ' + r.students + ' students'; }) : h('div', { class: 'micro', text: 'No student activity yet.' }))),
      ]);
    }).catch(A.fail);
  }

  // -------------------------------------------------------------- schools
  function schools() {
    frame('#/usage/schools', 'App usage', [loading()]);
    get('/schools').then(function (r) {
      frame('#/usage/schools', 'App usage', [r.schools.length ? A.table(['School', 'Screens', 'Online', 'Hours', 'Devices', 'Last seen', 'Access ends'], r.schools.map(function (s) {
        return h('tr', null, h('td', null, h('a', { href: '#/usage/school/' + encodeURIComponent(s.school), text: s.school })), h('td', { text: s.devices + (s.revoked ? ' (' + s.revoked + ' blocked)' : '') }), h('td', { text: String(s.online) }), h('td', { text: String(s.hours) }),
          h('td', { text: s.platforms.map(function (p) { return PLAT[p] || p; }).join(', ') }), h('td', { text: ago(s.lastSeen) }), h('td', { text: s.expiry ? BL.fmtDate(s.expiry) : '—' }));
      })) : h('div', { class: 'empty', text: 'No schools have connected yet.' })]);
    }).catch(A.fail);
  }

  function school(name) {
    frame('#/usage/schools', name, [loading()]);
    get('/school', { name: name }).then(function (r) {
      var k = r.kpis;
      frame('#/usage/schools', r.school, [
        h('div', { class: 'crumbs' }, h('a', { href: '#/usage/schools', text: '← All schools' })),
        h('div', { class: 'stats' }, A.stat('Hours learned', hrs(k.totalHours), k.lessonHours + ' h inside lessons', 'var(--blue)'), A.stat('Screens', String(k.screens), k.activeScreens + ' active · ' + k.onlineNow + ' online', 'var(--green)'),
          A.stat('Active days', String(k.activeDays), k.avgMinutesPerScreenPerDay + ' min per screen a day', 'var(--cyan)'), A.stat('Sessions', String(k.sessions), null, 'var(--yellow)'), A.stat('Access ends', k.accessEnds ? BL.fmtDate(k.accessEnds) : '—', 'last active ' + (k.lastActive || '—'), 'var(--red)')),
        h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px;margin-bottom:18px' },
          h('div', { class: 'card' }, h('h2', { style: 'font-size:16px;margin-bottom:4px', text: 'Curriculum progress' }), h('div', { class: 'micro', style: 'margin-bottom:12px', text: 'Chapters opened at least once on any screen of this school (all time)' }),
            h('div', { style: 'display:grid;gap:12px' }, r.byClass.map(function (c) {
              return h('div', null, h('div', { style: 'display:flex;justify-content:space-between;font-size:13px' }, h('b', { text: 'Class ' + c.cls }), h('span', { class: 'micro', text: c.chaptersUsed + ' of ' + c.chaptersTotal + ' chapters · ' + c.hours + ' h' })),
                h('div', { class: 'bar', style: 'margin-top:4px;height:10px' }, h('i', { style: 'width:' + Math.round(c.chaptersUsed / c.chaptersTotal * 100) + '%' })));
            }))),
          h('div', { class: 'card' }, h('h2', { style: 'font-size:16px;margin-bottom:12px', text: 'Hours per day' }), A.bars(r.daily, 'hours', 'var(--blue)', function (n) { return n + ' h'; }))),
        h('h2', { style: 'font-size:17px;margin:8px 0 10px', text: 'Screens of this school' }),
        A.table(['Screen', 'Type', 'Device', 'Classes', 'Status', 'Last seen', 'Hours', 'Days used'], r.screens.map(function (s) {
          return h('tr', null, h('td', null, h('a', { href: '#/usage/screen/' + s.id, text: s.label || s.id.slice(0, 8) })), h('td', { text: s.kind === 'classroom' ? 'Classroom' : 'Student' + (s.section ? ' ' + s.section : '') }), h('td', { text: PLAT[s.platform] || s.platform }),
            h('td', { text: (s.classes || []).join(', ') || 'all' }), h('td', null, status(s.status)), h('td', { text: ago(s.lastSeen) }), h('td', { text: String(s.hours) }), h('td', { text: String(s.activeDays) }));
        })),
        h('h2', { style: 'font-size:17px;margin:22px 0 10px', text: 'Chapters used in this period' }),
        r.chapters.length ? A.table(['Chapter', 'Hours', 'Screens', 'Opened'], r.chapters.map(function (c) { return h('tr', null, h('td', { text: chLabel(c) }), h('td', { text: String(c.hours) }), h('td', { text: String(c.screens) }), h('td', { text: String(c.opens) })); })) : h('div', { class: 'empty', text: 'Nothing used in this period.' }),
      ], true);
    }).catch(A.fail);
  }

  // -------------------------------------------------------------- screens
  function screens() {
    frame('#/usage/screens', 'App usage', [loading()]);
    get('/devices').then(function (r) {
      frame('#/usage/screens', 'App usage', [r.devices.length ? A.table(['School', 'Screen', 'Device', 'Version', 'Status', 'Last seen', 'Hours', 'Access ends'], r.devices.map(function (d) {
        return h('tr', null, h('td', null, h('a', { href: '#/usage/school/' + encodeURIComponent(d.school), text: d.school })), h('td', null, h('a', { href: '#/usage/screen/' + d.id, text: d.label || d.id.slice(0, 8) })), h('td', { text: PLAT[d.platform] || d.platform }),
          h('td', { text: d.appVersion || '—' }), h('td', null, status(d.status)), h('td', { text: ago(d.lastSeen) }), h('td', { text: String(d.hours) }), h('td', { text: d.expiry ? BL.fmtDate(d.expiry) : '—' }));
      })) : h('div', { class: 'empty', text: 'No screens have registered yet.' })]);
    }).catch(A.fail);
  }

  function screen(id) {
    frame('#/usage/screens', 'Screen', [loading()]);
    get('/device', { id: id }).then(function (r) {
      var d = r.device;
      frame('#/usage/screens', (d.label || 'Screen') + ' · ' + d.school, [
        h('div', { class: 'crumbs' }, h('a', { href: '#/usage/school/' + encodeURIComponent(d.school), text: '← ' + d.school })),
        h('div', { class: 'stats' }, A.stat('Status', d.status, 'last seen ' + ago(d.lastSeen), 'var(--green)'), A.stat('Device', (PLAT[d.platform] || d.platform) + (d.appVersion ? ' · v' + d.appVersion : ''), 'registered ' + BL.fmtDate(d.registeredAt), 'var(--blue)'),
          A.stat('All time', hrs(r.allTime.hours), r.allTime.chapters + ' chapters · ' + r.allTime.opens + ' opens', 'var(--cyan)'), A.stat('Access ends', d.expiry ? BL.fmtDate(d.expiry) : '—', null, 'var(--red)')),
        h('div', { class: 'card', style: 'margin-bottom:18px' }, h('h2', { style: 'font-size:16px;margin-bottom:12px', text: 'Hours per day' }), A.bars(r.daily, 'hours', 'var(--blue)', function (n) { return n + ' h'; })),
        h('h2', { style: 'font-size:17px;margin:8px 0 10px', text: 'Chapters used' }),
        r.topChapters.length ? A.table(['Chapter', 'Hours', 'Opened'], r.topChapters.map(function (c) { return h('tr', null, h('td', { text: chLabel(c) }), h('td', { text: String(c.hours) }), h('td', { text: String(c.opens) })); })) : h('div', { class: 'empty', text: 'Nothing used in this period.' }),
        h('h2', { style: 'font-size:17px;margin:22px 0 10px', text: 'Recent sessions' }),
        r.sessions.length ? A.table(['Started', 'Class', 'Section', 'Minutes'], r.sessions.map(function (s) { return h('tr', null, h('td', { text: new Date(s.start).toLocaleString('en-IN') }), h('td', { text: String(s.cls) }), h('td', { text: s.section || '—' }), h('td', { text: String(s.minutes) })); })) : h('div', { class: 'empty', text: 'No sessions recorded.' }),
        h('div', { style: 'margin-top:22px;display:flex;gap:10px;flex-wrap:wrap' },
          h('button', { class: 'btn ghost', type: 'button', text: d.status === 'revoked' ? 'Allow this screen again' : 'Block this screen', onclick: function () {
            if (d.status !== 'revoked' && !confirm('Block this screen from sending data?')) return;
            BL.api('/admin/usage/devices/' + encodeURIComponent(d.id) + '/revoke', { method: 'POST', body: { revoked: d.status !== 'revoked' } }).then(function () { screen(id); }).catch(function (e) { BL.toast(e.message); });
          } }),
          h('button', { class: 'btn ghost', type: 'button', text: 'Delete this screen and its data', onclick: function () {
            if (!confirm('Delete this screen and ALL of its usage records? This cannot be undone.')) return;
            BL.api('/admin/usage/devices/' + encodeURIComponent(d.id), { method: 'DELETE' }).then(function () { location.hash = '#/usage/screens'; }).catch(function (e) { BL.toast(e.message); });
          } })),
      ], true);
    }).catch(A.fail);
  }

  // -------------------------------------------------------------- chapters
  function chapters() {
    frame('#/usage/chapters', 'App usage', [loading()]);
    get('/chapters').then(function (r) {
      frame('#/usage/chapters', 'App usage', [r.chapters.length ? A.table(['Chapter', 'Hours', 'Avg min per screen', 'Screens', 'Schools', 'Opened (all time)'], r.chapters.map(function (c) {
        return h('tr', null, h('td', { text: chLabel(c) }), h('td', { text: String(c.hours) }), h('td', { text: String(c.avgMinutesPerDevice) }), h('td', { text: String(c.devices) }), h('td', { text: String(c.schools) }), h('td', { text: String(c.opensAllTime) }));
      })) : h('div', { class: 'empty', text: 'No chapter usage in this period.' })]);
    }).catch(A.fail);
  }

  A.routes.usage = function (p) {
    var m;
    if ((m = /^\/usage\/school\/(.+)$/.exec(p))) return school(decodeURIComponent(m[1]));
    if ((m = /^\/usage\/screen\/(.+)$/.exec(p))) return screen(m[1]);
    if (p === '/usage/schools') return schools();
    if (p === '/usage/screens') return screens();
    if (p === '/usage/chapters') return chapters();
    overview();
  };
})();

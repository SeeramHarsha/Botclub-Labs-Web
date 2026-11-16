/* Owner's admin: overview, students, orders, plans. Hash routes: #/ #/students #/student/ID #/orders #/plans */
(function () {
  'use strict';
  var h = BL.h, view = document.getElementById('view');

  function render(a) { view.replaceChildren.apply(view, a.filter(Boolean)); }
  function head(active, title) {
    var tabs = [['#/', 'Overview'], ['#/students', 'Students'], ['#/orders', 'Payments'], ['#/plans', 'Plans'], ['#/enquiries', 'Enquiries'], ['#/usage', 'App usage']];
    return [h('div', { class: 'app-top' }, h('h1', { text: title })),
      h('div', { class: 'subnav' }, tabs.map(function (t) { return h('a', { href: t[0], class: t[0] === active ? 'on' : '', text: t[1] }); }), h('a', { href: '/app', text: 'Student view' }))];
  }
  function show(active, title, nodes) { render(head(active, title).concat(nodes)); }
  function fail(e) { view.replaceChildren(h('div', { class: 'empty', text: e.message })); }
  function stat(l, v, s, c) { return h('div', { class: 'stat', style: '--c:' + c }, h('div', { class: 'l', text: l }), h('div', { class: 'v', text: v }), s ? h('div', { class: 's', text: s }) : null); }
  function table(cols, rows) { return h('div', { class: 'tw' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, cols.map(function (c) { return h('th', { text: c }); }))), h('tbody', null, rows))); }
  function statusBadge(s) { return h('span', { class: 'badge ' + (s === 'paid' ? 'green' : s === 'failed' ? 'red' : 'grey'), text: s === 'created' ? 'not completed' : s }); }

  function bars(series, key, color, fmt) {
    var max = Math.max.apply(null, series.map(function (d) { return d[key]; }).concat([1]));
    return h('div', { style: 'display:flex;align-items:flex-end;gap:3px;height:90px' }, series.map(function (d) {
      return h('div', { title: d.date + ': ' + fmt(d[key]), style: 'flex:1;border-radius:3px 3px 0 0;min-height:2px;background:' + color + ';height:' + Math.max(2, d[key] / max * 100) + '%;opacity:' + (d[key] ? 1 : .25) });
    }));
  }

  function overview() {
    BL.api('/admin/summary').then(function (s) {
      show('#/', 'Overview', [
        h('div', { class: 'stats' }, stat('Students', String(s.students), null, 'var(--cyan)'), stat('Paying now', String(s.payingStudents), 'active paid plans', 'var(--green)'), stat('Paid orders', String(s.paidOrders), null, 'var(--blue)'), stat('Revenue', BL.fmtInr(s.revenueInr), 'all time', 'var(--yellow)'), stat('New enquiries', String(s.newEnquiries || 0), 'from Talk to sales', 'var(--red)')),
        h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px' },
          h('div', { class: 'card' }, h('h2', { style: 'font-size:16px;margin-bottom:12px', text: 'Sign-ups, last 30 days' }), bars(s.series, 'signups', 'var(--cyan)', String)),
          h('div', { class: 'card' }, h('h2', { style: 'font-size:16px;margin-bottom:12px', text: 'Revenue, last 30 days' }), bars(s.series, 'revenueInr', 'var(--yellow)', BL.fmtInr))),
      ]);
    }).catch(fail);
  }

  function students() {
    var q = '', page = 0, box = h('div');
    var input = h('input', { placeholder: 'Search name, email or school', 'aria-label': 'Search', style: 'width:100%;max-width:360px;padding:10px 14px;border-radius:10px;border:1px solid var(--line-2);background:var(--field);color:var(--text)', oninput: function () { q = input.value; page = 0; clearTimeout(students.t); students.t = setTimeout(load, 250); } });
    function load() {
      BL.api('/admin/students?q=' + encodeURIComponent(q) + '&page=' + page).then(function (r) {
        var pages = Math.ceil(r.total / r.size);
        box.replaceChildren(r.students.length ? table(['Name', 'Class', 'School', 'Joined', 'Plan', ''], r.students.map(function (u) {
          return h('tr', null, h('td', null, h('a', { href: '#/student/' + u.id, text: u.name }), h('div', { class: 'micro', text: u.email })), h('td', { text: u.cls || '—' }), h('td', { text: u.school || '—' }), h('td', { text: BL.fmtDate(u.createdAt) }),
            h('td', null, u.plans.length ? u.plans.map(function (p) { return h('span', { class: 'badge blue', style: 'margin-right:4px', text: (p.classes.length >= 5 ? 'All' : 'Class ' + p.classes.join(',')) + ' to ' + BL.fmtDate(p.endsAt) }); }) : h('span', { class: 'micro', text: 'Free' })),
            h('td', null, u.disabled ? h('span', { class: 'badge red', text: 'disabled' }) : null));
        })) : h('div', { class: 'empty', text: 'No students found.' }),
          pages > 1 ? h('div', { style: 'display:flex;gap:10px;align-items:center;margin-top:14px' }, h('button', { class: 'btn ghost small', disabled: page === 0, text: '← Prev', onclick: function () { page--; load(); } }), h('span', { class: 'micro', text: 'Page ' + (page + 1) + ' of ' + pages + ' · ' + r.total + ' students' }), h('button', { class: 'btn ghost small', disabled: page + 1 >= pages, text: 'Next →', onclick: function () { page++; load(); } })) : null);
      }).catch(function (e) { box.replaceChildren(h('div', { class: 'empty', text: e.message })); });
    }
    show('#/students', 'Students', [h('div', { style: 'margin-bottom:14px' }, input), box]); load();
  }

  function student(id) {
    BL.api('/admin/students/' + encodeURIComponent(id)).then(function (r) {
      var s = r.student, err = h('p', { class: 'err' }), ok = h('p', { class: 'okmsg' });
      var cls = [6, 7, 8, 9, 10, 11, 12].map(function (n) { return h('label', { style: 'margin-right:12px;font-size:14px' }, h('input', { type: 'checkbox', value: n, style: 'margin-right:5px' }), 'Class ' + n); });
      var subjSel = h('select', { 'aria-label': 'Subject', style: 'padding:8px;border-radius:8px;border:1px solid var(--line-2);background:var(--field);color:var(--text)' }, [['', 'All subjects'], ['Physics', 'Physics only'], ['Chemistry', 'Chemistry only'], ['Mathematics', 'Mathematics only']].map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
      var days = h('input', { type: 'number', value: 365, min: 1, max: 1095, 'aria-label': 'Days', style: 'width:90px;padding:8px;border-radius:8px;border:1px solid var(--line-2);background:var(--field);color:var(--text)' });
      show('#/students', s.name, [
        h('div', { class: 'crumbs' }, h('a', { href: '#/students', text: '← Students' })),
        h('div', { class: 'stats' }, stat('Email', s.email, s.phone || null, 'var(--cyan)'), stat('Class / school', (s.cls || '—') + ' · ' + (s.school || '—'), 'joined ' + BL.fmtDate(s.createdAt), 'var(--blue)'),
          stat('Learning', r.learning.hours + ' h', r.learning.chapters + ' chapters opened', 'var(--green)'), stat('Last login', BL.fmtDate(s.lastLoginAt), s.consentAt ? 'consent ' + BL.fmtDate(s.consentAt) : null, 'var(--yellow)')),
        h('h2', { style: 'font-size:17px;margin:8px 0 10px', text: 'Access' }),
        r.access.length ? table(['Type', 'Classes', 'Chapters', 'From', 'Until', ''], r.access.map(function (a) {
          return h('tr', null, h('td', { text: a.source }), h('td', { text: a.classes.join(', ') }), h('td', { text: a.chapters }), h('td', { text: BL.fmtDate(a.startsAt) }), h('td', { text: a.endsAt ? BL.fmtDate(a.endsAt) : 'no end' }),
            h('td', null, a.source === 'trial' ? null : h('button', { class: 'btn ghost small', type: 'button', text: 'Remove', onclick: function () { if (!confirm('Remove this access?')) return; BL.api('/admin/entitlements/' + encodeURIComponent(a.id), { method: 'DELETE' }).then(function () { student(id); }).catch(function (e) { BL.toast(e.message); }); } })));
        })) : h('div', { class: 'empty', text: 'No access records.' }),
        h('div', { class: 'card', style: 'margin:18px 0' }, h('h3', { style: 'font-size:15px;margin-bottom:10px', text: 'Give access (free, e.g. for a school or a support fix)' }),
          h('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:6px' }, cls, h('span', { class: 'micro', text: 'subject (one class of 11 or 12 only)' }), subjSel, h('span', { class: 'micro', text: 'for' }), days, h('span', { class: 'micro', text: 'days' }),
            h('button', { class: 'btn primary small', type: 'button', text: 'Give access', onclick: function () {
              err.textContent = ''; ok.textContent = '';
              var picked = cls.map(function (l) { return l.firstChild; }).filter(function (i) { return i.checked; }).map(function (i) { return Number(i.value); });
              BL.api('/admin/students/' + encodeURIComponent(id) + '/grant', { method: 'POST', body: { classes: picked, days: Number(days.value), subject: subjSel.value || undefined } }).then(function () { student(id); BL.toast('Access given.'); }).catch(function (e) { err.textContent = e.message; });
            } })), err, ok),
        h('h2', { style: 'font-size:17px;margin:8px 0 10px', text: 'Payments' }),
        r.orders.length ? table(['Date', 'Plan', 'Amount', 'Status', 'Payment id'], r.orders.map(function (o) { return h('tr', null, h('td', { text: BL.fmtDate(o.paidAt || o.createdAt) }), h('td', { text: o.planName + (o.label ? ' · ' + o.label : '') }), h('td', { text: BL.fmtInr(o.amountInr) }), h('td', null, statusBadge(o.status)), h('td', { style: 'font-size:12px;color:var(--muted)', text: o.paymentId || '—' })); })) : h('div', { class: 'empty', text: 'No payments.' }),
        h('div', { style: 'margin-top:22px' }, h('button', { class: 'btn ghost', type: 'button', text: s.disabled ? 'Enable this account' : 'Disable this account', onclick: function () {
          if (!s.disabled && !confirm('Disable this account? The student will not be able to log in.')) return;
          BL.api('/admin/students/' + encodeURIComponent(id) + '/disable', { method: 'POST', body: { disabled: !s.disabled } }).then(function () { student(id); }).catch(function (e) { BL.toast(e.message); });
        } })),
      ]);
    }).catch(fail);
  }

  function orders() {
    var status = '', box = h('div');
    var sel = h('select', { 'aria-label': 'Status', style: 'padding:9px 12px;border-radius:10px;border:1px solid var(--line-2);background:var(--field);color:var(--text)', onchange: function () { status = sel.value; load(); } },
      [['', 'All'], ['paid', 'Paid'], ['created', 'Not completed'], ['failed', 'Failed']].map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    function load() {
      BL.api('/admin/orders' + (status ? '?status=' + status : '')).then(function (r) {
        box.replaceChildren(r.orders.length ? table(['Date', 'Student', 'Plan', 'Amount', 'Status', 'Payment id'], r.orders.map(function (o) {
          return h('tr', null, h('td', { text: BL.fmtDate(o.paidAt || o.createdAt) }), h('td', { text: o.studentName }, h('div', { class: 'micro', text: o.student })), h('td', { text: o.planName + (o.label ? ' · ' + o.label : '') }), h('td', { text: BL.fmtInr(o.amountInr) }), h('td', null, statusBadge(o.status)), h('td', { style: 'font-size:12px;color:var(--muted)', text: o.paymentId || '—' }));
        })) : h('div', { class: 'empty', text: 'No payments.' }));
      }).catch(function (e) { box.replaceChildren(h('div', { class: 'empty', text: e.message })); });
    }
    show('#/orders', 'Payments', [h('div', { style: 'margin-bottom:14px' }, sel), box]); load();
  }

  function plans() {
    var box = h('div');
    function field(label, el) { return h('label', { class: 'f' }, h('span', { text: label }), el); }
    function planForm(p) {
      var isNew = !p, err = h('p', { class: 'err' });
      var f = h('form', { class: 'card', style: 'margin-bottom:16px', onsubmit: function (e) {
        e.preventDefault(); err.textContent = '';
        var body = { name: f.name.value, tagline: f.tagline.value, priceInr: Number(f.price.value), durationDays: Number(f.days.value), scope: f.scope.value, track: f.track.value, classCount: Number(f.classCount.value), badge: f.badge.value, active: f.active.checked, features: f.features.value.split('\n') };
        BL.api(isNew ? '/admin/plans' : '/admin/plans/' + encodeURIComponent(p._id), { method: isNew ? 'POST' : 'PATCH', body: body }).then(function () { BL.toast('Saved.'); load(); }).catch(function (x) { err.textContent = x.message; });
      } },
        h('div', { class: 'two' }, field('Name', h('input', { name: 'name', value: p ? p.name : '', maxlength: 40, required: true })), field('Price (₹)', h('input', { name: 'price', type: 'number', min: 1, value: p ? p.priceInr : '', required: true }))),
        field('One-line description', h('input', { name: 'tagline', value: p ? p.tagline : '', maxlength: 100 })),
        h('div', { class: 'two' }, field('Length (days)', h('input', { name: 'days', type: 'number', min: 1, max: 1095, value: p ? p.durationDays : 365, required: true })),
          field('Covers', h('select', { name: 'scope' }, [['one-class', 'One class (student picks)'], ['multi-class', 'Several classes (student picks, Classes 6 to 10)'], ['subject', 'One subject of a class (student picks, Classes 11 and 12)'], ['all-classes', 'All classes of the group']].map(function (o) { var op = h('option', { value: o[0], text: o[1] }); if (p && p.scope === o[0]) op.selected = true; return op; })))),
        field('Who is it for', h('select', { name: 'track' }, [['junior', 'Classes 6 to 10'], ['senior', 'Classes 11 and 12']].map(function (o) { var op = h('option', { value: o[0], text: o[1] }); if ((p && (p.track || 'junior')) === o[0]) op.selected = true; return op; }))),
        field('How many classes for a "several classes" plan', h('input', { name: 'classCount', type: 'number', min: 2, max: 4, value: p && p.classCount ? p.classCount : 2 })),
        field('Badge (optional)', h('input', { name: 'badge', value: p ? p.badge : '', maxlength: 20 })),
        field('What is included (one per line)', h('textarea', { name: 'features', rows: 4, style: 'width:100%;padding:10px;border-radius:10px;border:1px solid var(--line-2);background:var(--field);color:var(--text);font-family:inherit' }, (p ? p.features : []).join('\n'))),
        h('label', { class: 'check' }, h('input', { name: 'active', type: 'checkbox', checked: p ? !!p.active : true }), h('span', { text: 'Shown to students and can be bought' })), err,
        h('button', { class: 'btn primary small', type: 'submit', style: 'margin-top:14px', text: isNew ? 'Add plan' : 'Save changes' }));
      if (!isNew) {   // a switch at the top: show or hide this plan on the website straight away
        var sw = h('input', { type: 'checkbox', checked: !!p.active, 'aria-label': 'Show this plan on the website' });
        var state = h('span', { class: 'micro', text: p.active ? 'Shown on the website' : 'Hidden' });
        sw.addEventListener('change', function () {
          BL.api('/admin/plans/' + encodeURIComponent(p._id), { method: 'PATCH', body: { active: sw.checked } })
            .then(function () { state.textContent = sw.checked ? 'Shown on the website' : 'Hidden'; f.active.checked = sw.checked; BL.toast(p.name + (sw.checked ? ' is now shown.' : ' is now hidden.')); })
            .catch(function (x) { sw.checked = !sw.checked; BL.toast(x.message); });
        });
        f.insertBefore(h('div', { class: 'plan-head' }, h('b', { text: p.name + ' · ' + ((p.track || 'junior') === 'senior' ? 'Classes 11 and 12' : 'Classes 6 to 10') }), h('label', { class: 'switch' }, state, sw, h('i'))), f.firstChild);
      }
      return f;
    }
    function load() {
      BL.api('/admin/plans').then(function (r) {
        box.replaceChildren.apply(box, [h('p', { class: 'micro', style: 'margin-bottom:14px', text: 'Changing a price affects new purchases only. Students who already paid keep what they bought.' })]
          .concat(r.plans.map(function (p) { return planForm(p); }), [h('h2', { style: 'font-size:17px;margin:22px 0 10px', text: 'Add a new plan' }), planForm(null)]));
      }).catch(function (e) { box.replaceChildren(h('div', { class: 'empty', text: e.message })); });
    }
    show('#/plans', 'Plans', [box]); load();
  }

  window.BLA = { h: h, show: show, table: table, stat: stat, bars: bars, fail: fail, statusBadge: statusBadge, routes: {} };

  function enquiries() {
    var status = '', box = h('div');
    var sel = h('select', { 'aria-label': 'Status', style: 'padding:9px 12px;border-radius:10px;border:1px solid var(--line-2);background:var(--field);color:var(--text)', onchange: function () { status = sel.value; load(); } },
      [['', 'All'], ['new', 'New'], ['contacted', 'Contacted'], ['won', 'Won'], ['closed', 'Closed']].map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    function load() {
      BL.api('/admin/enquiries' + (status ? '?status=' + status : '')).then(function (r) {
        box.replaceChildren.apply(box, r.enquiries.length ? r.enquiries.map(function (e) {
          var st = h('select', { 'aria-label': 'Status', style: 'padding:7px 10px;border-radius:8px;border:1px solid var(--line-2);background:var(--field);color:var(--text)', onchange: function () { BL.api('/admin/enquiries/' + encodeURIComponent(e.id), { method: 'PATCH', body: { status: st.value } }).then(function () { BL.toast('Saved.'); }).catch(function (x) { BL.toast(x.message); }); } },
            ['new', 'contacted', 'won', 'closed'].map(function (v) { var o = h('option', { value: v, text: v[0].toUpperCase() + v.slice(1) }); if (v === e.status) o.selected = true; return o; }));
          return h('div', { class: 'card', style: 'margin-bottom:12px' },
            h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between' }, h('div', null, h('b', { style: 'font-size:16px', text: e.institute }), h('div', { class: 'micro', text: e.name + ' · ' + e.role + (e.city ? ' · ' + e.city : '') + ' · ' + new Date(e.createdAt).toLocaleString('en-IN') })), st),
            h('div', { style: 'margin-top:10px;font-size:14px;display:flex;gap:16px;flex-wrap:wrap' }, h('a', { href: 'mailto:' + e.email, text: e.email }), h('a', { href: 'tel:' + e.phone, text: e.phone }), h('span', { text: 'Students: ' + (e.students || '—') }), h('span', { text: 'Classes: ' + (e.classes.length ? e.classes.join(', ') : '—') })),
            e.message ? h('p', { style: 'margin-top:10px;color:var(--muted);font-size:14px', text: e.message }) : null);
        }) : [h('div', { class: 'empty', text: 'No enquiries yet. They appear here when a school uses Talk to sales.' })]);
      }).catch(fail);
    }
    show('#/enquiries', 'Enquiries', [h('div', { style: 'margin-bottom:14px' }, sel), box]); load();
  }

  function route() {
    var p = location.hash.slice(1) || '/', m = /^\/student\/(.+)$/.exec(p);
    window.scrollTo(0, 0);
    if (m) return student(m[1]);
    if (p === '/students') return students();
    if (p === '/orders') return orders();
    if (p === '/plans') return plans();
    if (p === '/enquiries') return enquiries();
    if (p === '/usage' || p.indexOf('/usage/') === 0) return window.BLA.routes.usage(p);
    overview();
  }
  window.addEventListener('hashchange', route);
  BL.me().then(function (m) {
    if (!m || !m.user) { location.href = '/login.html?next=/admin'; return; }
    if (m.user.role !== 'admin') { location.href = '/app'; return; }
    route();
  });
})();

/* Loaded inside every lesson page (added by the server). Counts the time the student is really looking at the lesson,
   reports it every ~15 s, and shows a small bar to go back or mark the chapter done. window.__BL = {cls, chapter}. */
(function () {
  'use strict';
  var meta = window.__BL; if (!meta) return;
  var PING_MS = 15000, IDLE_MS = 60000, pending = 0, lastTick = Date.now(), lastAct = Date.now(), timer = null;

  function call(path, body, beacon) {
    var data = JSON.stringify(body);
    if (beacon && navigator.sendBeacon) { /* beacon cannot set headers, so fall through to keepalive fetch */ }
    return fetch('/api' + path, { method: 'POST', credentials: 'same-origin', keepalive: !!beacon, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'botclub' }, body: data }).then(function (r) { return r.json().catch(function () { return {}; }); });
  }
  function active() { return !document.hidden && Date.now() - lastAct < IDLE_MS; }
  function tick() { var now = Date.now(); if (active()) pending += Math.min(now - lastTick, 2000) / 1000; lastTick = now; }
  function flush(final) {
    tick();
    var sec = Math.round(pending); if (sec < 1 && !meta.first) return;
    var body = { cls: meta.cls, chapter: meta.chapter, sec: Math.min(sec, 30), open: !!meta.first };
    pending = Math.max(0, pending - body.sec); meta.first = false;
    call('/progress/ping', body, final).catch(function () { pending += body.sec; });
  }
  ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'].forEach(function (e) { window.addEventListener(e, function () { lastAct = Date.now(); }, { passive: true, capture: true }); });
  meta.first = true;
  setInterval(tick, 1000); timer = setInterval(function () { flush(false); }, PING_MS);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(true); });
  window.addEventListener('pagehide', function () { flush(true); });

  // phones: the lessons are made for a wide screen, so ask for landscape. A page cannot rotate a phone without a tap, so the first screen
  // has one button that goes full screen and locks landscape (Android). iPhones cannot be forced: the screen asks to turn the phone and goes away when it is turned.
  (function () {
    var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    if (!coarse || Math.min(screen.width, screen.height) > 820) return;
    var portrait = matchMedia('(orientation: portrait)'), dismissed = false;
    var st = document.createElement('style');
    st.textContent = '#bl-rot{position:fixed;inset:0;z-index:2147483600;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:28px;text-align:center;color:#f2f7fc;background:linear-gradient(135deg,#0f2640,#1a3a5c 60%,#234a73);font-family:Poppins,system-ui,sans-serif}'
      + '#bl-rot h2{font-size:22px;margin:0}#bl-rot p{margin:0;font-size:14px;opacity:.8;max-width:290px;line-height:1.5}'
      + '#bl-rot svg{width:84px;height:84px;animation:bl-turn 2.4s ease-in-out infinite}@keyframes bl-turn{0%,25%{transform:rotate(0)}60%,100%{transform:rotate(-90deg)}}'
      + '#bl-rot button{all:unset;cursor:pointer;background:#2f8fe0;color:#fff;font:600 15px Poppins,system-ui,sans-serif;padding:13px 26px;border-radius:12px;margin-top:6px}'
      + '#bl-rot a{color:rgba(242,247,252,.65);font-size:13px;text-decoration:underline;cursor:pointer}'
      + '@media (orientation:landscape) and (max-height:480px){#bl-bar{bottom:6px!important;padding:3px!important}#bl-bar a,#bl-bar button{padding:6px 12px!important;font-size:12px!important}}';
    document.head.appendChild(st);
    var ov = document.createElement('div'); ov.id = 'bl-rot';
    ov.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#5cc8ff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/></svg>';
    var t = document.createElement('h2'); t.textContent = 'Turn your phone sideways';
    var p = document.createElement('p'); p.textContent = 'This lesson is made for a wide screen, so the activity fits and is easy to use.';
    var go = document.createElement('button'); go.type = 'button'; go.textContent = 'Full screen and landscape';
    var skip = document.createElement('a'); skip.textContent = 'Continue anyway';
    ov.appendChild(t); ov.appendChild(p); ov.appendChild(go); ov.appendChild(skip); document.body.appendChild(ov);
    function sync() { ov.style.display = portrait.matches && !dismissed ? 'flex' : 'none'; }
    function lock() {
      var d = document.documentElement, full = d.requestFullscreen || d.webkitRequestFullscreen;
      var rot = function () { try { var r = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (r && r.catch) r.catch(function () {}); } catch (e) { /* not supported: the screen asks to turn the phone */ } };
      try { if (full && !document.fullscreenElement) { var r = full.call(d); if (r && r.then) r.then(rot, rot); else rot(); } else rot(); } catch (e) { rot(); }
    }
    go.addEventListener('click', function () { lock(); setTimeout(function () { if (portrait.matches) { t.textContent = 'Now turn your phone sideways'; p.textContent = 'Your phone is set to stay upright. Turn it, or switch off rotation lock, and the lesson will open.'; } }, 900); });
    skip.addEventListener('click', function () { dismissed = true; sync(); });
    if (portrait.addEventListener) portrait.addEventListener('change', sync); else portrait.addListener(sync);
    sync();
  })();

  // the little bar
  var css = document.createElement('style');
  css.textContent = '#bl-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483000;display:flex;gap:8px;align-items:center;padding:6px;border-radius:99px;background:rgba(15,38,64,.94);border:1px solid rgba(92,200,255,.35);box-shadow:0 8px 28px rgba(0,0,0,.4);font:600 13px Poppins,system-ui,sans-serif}#bl-bar a,#bl-bar button{all:unset;cursor:pointer;color:#fff;padding:8px 16px;border-radius:99px;font:600 13px Poppins,system-ui,sans-serif}#bl-bar a:hover{background:rgba(255,255,255,.1)}#bl-bar button{background:#1f9d55;color:#fff}#bl-bar button[disabled]{background:rgba(31,157,85,.35);color:#d6f5e3;cursor:default}@media print{#bl-bar{display:none}}';
  document.head.appendChild(css);
  var bar = document.createElement('div'); bar.id = 'bl-bar';
  var back = document.createElement('a'); back.href = '/app#/class/' + meta.cls; back.textContent = '← Class ' + meta.cls;
  var done = document.createElement('button'); done.type = 'button'; done.textContent = 'Mark as done';
  done.addEventListener('click', function () {
    done.disabled = true; done.textContent = 'Saving…'; flush(false);
    call('/progress/done', { cls: meta.cls, chapter: meta.chapter, done: true }).then(function (r) { if (r && r.error) throw new Error(r.error); done.textContent = '✓ Done'; }).catch(function () { done.disabled = false; done.textContent = 'Mark as done'; });
  });
  bar.appendChild(back); bar.appendChild(done); (document.body || document.documentElement).appendChild(bar);
})();

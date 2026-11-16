'use strict';
/**
 * Adds Class 11 and Class 12 (Physics, Chemistry, Mathematics) to content/ from the folder you were given:
 *
 *   node scripts/import-class-11-12.js --from "<folder that holds '11th Class' and '12th Class'>" [--dry]
 *
 * For each chapter it writes content/Class - N/Chapter - K/index.html (K counts 1, 2, 3 ... through Physics, then Chemistry, then Mathematics,
 * Part 1 before Part 2), fixes the page for the web (local fonts instead of Google Fonts, the Botclub Labs name, the "back" button), and writes
 * content/titles-extra.json (chapter names) and content/groups.json ("Physics · Part 1" etc.), then content/activities.json is refreshed.
 */
const fs = require('fs');
const path = require('path');

const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const FROM = path.resolve(arg('--from', ''));
const DRY = process.argv.includes('--dry');
const OUT = path.join(__dirname, '..', 'content');
if (!arg('--from') || !fs.existsSync(FROM)) { console.error('Pass --from "<folder with 11th Class and 12th Class>".'); process.exit(1); }

const SUBJECTS = [['Physics', /phys/i], ['Chemistry', /chem/i], ['Mathematics', /math/i]];
// a few page titles are shorter than the book's chapter name
const FULL_TITLE = { 'Organic Chemistry: Basic Principles and Techniques': 'Organic Chemistry: Some Basic Principles and Techniques', 'Semiconductor Electronics': 'Semiconductor Electronics: Materials, Devices and Simple Circuits' };

const dirs = (d) => fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const lead = (name) => { const m = /^(\d+)\./.exec(name); return m ? Number(m[1]) : 999; };
const byLead = (a, b) => lead(a) - lead(b) || a.localeCompare(b);

function findHtml(dir) {                                       // the chapter page: the biggest .html outside "parts" folders
  let best = null;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!/^parts$/i.test(e.name)) walk(path.join(d, e.name)); continue; }
      if (/\.html?$/i.test(e.name)) { const f = path.join(d, e.name), n = fs.statSync(f).size; if (!best || n > best.n) best = { f, n }; }
    }
  })(dir);
  return best && best.f;
}

function titleOf(html, fallback) {
  const t = /<title>([^<]*)<\/title>/i.exec(html);
  const m = t && /[—–-]\s*([^|]+?)\s*(?:\||$)/.exec(t[1].replace(/^[^—–]*(?=[—–])/, (x) => x));
  let name = m ? m[1].trim() : fallback;
  name = name.replace(/\s+/g, ' ');
  return FULL_TITLE[name] || name;
}

function fixPage(html, cls, k) {
  let h = html;
  // fonts: the lessons may only load files from this site
  h = h.replace(/<link[^>]+rel=["']preconnect["'][^>]*fonts\.g[a-z.]*[^>]*>\s*/gi, '');
  h = h.replace(/<link[^>]+fonts\.googleapis\.com[^>]*>\s*/gi, '');
  if (!/vendor\/fonts\/fonts\.css/.test(h)) h = h.replace(/<\/head>/i, '<link href="../../vendor/fonts/fonts.css" rel="stylesheet">\n</head>');
  // name
  h = h.replace(/SkolAR Labs?/g, 'Botclub Labs').replace(/SkolAR/g, 'Botclub');
  // the lessons may not use eval (the site's content security policy forbids it): one page looks its build functions up by name
  h = h.split("(()=>{ try{ return typeof eval(a.build)==='function'; }catch(e){ return false; } })()").join('false').split('a.fn = eval(a.build)').join('a.fn = window[a.build]');
  // one page defines everything but never starts it: add the missing start call
  if (/function render\(\)\{/.test(h) && /function buildNav\(\)/.test(h) && /const activities\s*=/.test(h) && !/^\s*render\(\);\s*$/m.test(h)) {
    const i = h.lastIndexOf('</script>', h.indexOf('back-button') > 0 ? h.indexOf('back-button') : h.length);
    if (i > 0) h = h.slice(0, i) + 'render();\n' + h.slice(i);
  }
  // phones held sideways keep the side-by-side layout (canvas + controls), like the Class 6 to 10 chapters; only portrait or tall screens stack it
  h = h.replace(/@media \(max-width:1000px\)\{(\s*\.body-wrap\{flex-direction:column;\})/, '@media (max-width:1000px) and (orientation:portrait), (max-width:1000px) and (min-height:601px){$1');
  // the "back" button used by every other chapter
  if (!/nav\/back-button\.js/.test(h)) h = h.replace(/<\/body>/i, '<script src="../../nav/back-button.js"></script>\n</body>');
  return h;
}

const titles = {}, groups = {}, report = [], skipped = [];
for (const cls of [11, 12]) {
  const classDir = path.join(FROM, `${cls}th Class`);
  if (!fs.existsSync(classDir)) { console.error('Missing ' + classDir); process.exit(1); }
  titles[cls] = {}; groups[cls] = {};
  let k = 0;
  const subjDirs = dirs(classDir);
  for (const [subject, re] of SUBJECTS) {
    const sd = subjDirs.find((d) => re.test(d));
    if (!sd) { console.error(`Class ${cls}: no ${subject} folder`); process.exit(1); }
    const sPath = path.join(classDir, sd), parts = dirs(sPath).filter((d) => /^part/i.test(d)).sort((a, b) => Number(/(\d)/.exec(a)[1]) - Number(/(\d)/.exec(b)[1]));
    const units = parts.length ? parts.map((p) => [path.join(sPath, p), `${subject} · Part ${/(\d)/.exec(p)[1]}`]) : [[sPath, subject]];
    for (const [uPath, group] of units) {
      for (const ch of dirs(uPath).sort(byLead)) {
        const file = findHtml(path.join(uPath, ch));
        if (!file) { console.warn('SKIPPED (no activity file in the folder): Class ' + cls + ' · ' + group + ' · ' + ch); skipped.push(cls + ' ' + group + ' ' + ch); continue; }
        k++;
        const html = fs.readFileSync(file, 'utf8'), title = titleOf(html, ch.replace(/^\d+\.\s*/, ''));
        titles[cls][k] = title; groups[cls][k] = group;
        report.push(`Class ${cls} · Ch ${String(k).padStart(2)} · ${group.padEnd(18)} · ${title}   <- ${path.relative(FROM, file)}`);
        if (!DRY) {
          const out = path.join(OUT, `Class - ${cls}`, `Chapter - ${k}`);
          fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
          fs.writeFileSync(path.join(out, 'index.html'), fixPage(html, cls, k));
        }
      }
    }
  }
}
console.log(report.join('\n'));
console.log(`\n${report.length} chapters (${Object.values(titles).map((t) => Object.keys(t).length).join(' + ')})`);
if (!DRY) {
  fs.writeFileSync(path.join(OUT, 'titles-extra.json'), JSON.stringify(titles));
  fs.writeFileSync(path.join(OUT, 'groups.json'), JSON.stringify(groups));
  require('./count-activities').countAll; // (loaded to make sure it exists)
  const { countAll } = require('./count-activities');
  fs.writeFileSync(path.join(OUT, 'activities.json'), JSON.stringify(countAll(OUT)));
  console.log('written to content/ (titles-extra.json, groups.json, activities.json refreshed)');
}

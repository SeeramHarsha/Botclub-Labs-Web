'use strict';
/** How many numbered activities (1.1, 1.2 ...) each chapter has: counted from the chapter pages. Run: node scripts/count-activities.js */
const fs = require('fs');
const path = require('path');

// the chapters list their activities as { num: '1.1', title: '...' }; Class 11 and 12 pages also use labels such as 'A3', 'Ex 5.8' or '§5.9'
function scan(html, numPattern) {
  const set = new Set();
  const re = new RegExp('num\\s*:\\s*[\'"](' + numPattern + ')[\'"]([^}]{0,160})', 'g');
  for (const x of html.matchAll(re)) {
    const t = /title\s*:\s*['"]([^'"]+)/.exec(x[2]);
    set.add(x[1] + '|' + (t ? t[1] : ''));
  }
  return set.size;
}

/** a few pages build the list another way: act('6.1', ...) calls, an ACT_DEF = [['5.1', ...], ...] table, or ACTS = [{ id: 'A1', ... }, ...] */
function other(html) {
  const calls = new Set([...html.matchAll(/\bact\(\s*['"]([^'"]+)['"]/g)].map((x) => x[1])).size;
  if (calls) return calls;
  const block = (name) => {
    const i = html.search(new RegExp('\\b' + name + '\\s*=\\s*\\['));
    if (i < 0) return '';
    const j = html.indexOf('];', i);
    return html.slice(i, j < 0 ? i + 6000 : j);
  };
  const def = block('ACT_DEF');
  if (def) return (def.match(/\[\s*['"]/g) || []).length;
  let best = 0;                                                  // "let ACTS=[];" comes first and is empty: take the longest list
  for (const m of html.matchAll(/\bACTS\s*=\s*\[/g)) {
    const j = html.indexOf('];', m.index), b = html.slice(m.index, j < 0 ? m.index + 6000 : j);
    best = Math.max(best, new Set([...b.matchAll(/\bid\s*:\s*['"]([^'"]+)['"]/g)].map((x) => x[1])).size);
  }
  return best;
}

function countIn(html, senior) {
  const numeric = scan(html, '\\d+\\.\\d+'), any = scan(html, '[^\'"]{1,12}');
  // Class 11 and 12 pages mix label styles in one list, so the larger count is the true one (checked against the activity buttons on each page)
  return (senior ? Math.max(numeric, any) : numeric || any) || other(html);
}

function countAll(contentDir) {
  const out = {};
  for (const c of [6, 7, 8, 9, 10, 11, 12]) {
    const dir = path.join(contentDir, 'Class - ' + c);
    if (!fs.existsSync(dir)) continue;
    for (const d of fs.readdirSync(dir)) {
      const m = /^Chapter - (\d+)$/.exec(d), f = m && path.join(dir, d, 'index.html');
      if (m && fs.existsSync(f)) (out[c] = out[c] || {})[Number(m[1])] = countIn(fs.readFileSync(f, 'utf8'), c >= 11);
    }
  }
  return out;
}

module.exports = { countAll, countIn };
if (require.main === module) {
  const content = path.join(__dirname, '..', 'content'), out = countAll(content);
  fs.writeFileSync(path.join(content, 'activities.json'), JSON.stringify(out));
  const total = Object.values(out).reduce((a, c) => a + Object.values(c).reduce((x, y) => x + y, 0), 0);
  console.log('activities.json written: ' + total + ' activities');
}

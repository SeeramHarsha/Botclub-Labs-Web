'use strict';
/** How many numbered activities (1.1, 1.2 ...) each chapter has: counted from the chapter pages. Run: node scripts/count-activities.js */
const fs = require('fs');
const path = require('path');

function countIn(html) {
  const set = new Set();
  for (const x of html.matchAll(/num\s*:\s*['"](\d+\.\d+)['"]([^}]{0,160})/g)) {
    const t = /title\s*:\s*['"]([^'"]+)/.exec(x[2]);
    set.add(x[1] + '|' + (t ? t[1] : ''));
  }
  return set.size;
}

function countAll(contentDir) {
  const out = {};
  for (const c of [6, 7, 8, 9, 10]) {
    const dir = path.join(contentDir, 'Class - ' + c);
    if (!fs.existsSync(dir)) continue;
    for (const d of fs.readdirSync(dir)) {
      const m = /^Chapter - (\d+)$/.exec(d), f = m && path.join(dir, d, 'index.html');
      if (m && fs.existsSync(f)) (out[c] = out[c] || {})[Number(m[1])] = countIn(fs.readFileSync(f, 'utf8'));
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

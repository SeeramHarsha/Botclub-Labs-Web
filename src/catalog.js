'use strict';
/** The lessons: which classes and chapters exist and what they are called. Built from content/ by scripts/build-content.js. */
const fs = require('fs');
const path = require('path');

const CONTENT = process.env.CONTENT_DIR ? path.resolve(process.env.CONTENT_DIR) : path.join(__dirname, '..', 'content');

let cache = null;
function load() {
  if (cache) return cache;
  let titles = {};
  try { titles = JSON.parse(fs.readFileSync(path.join(CONTENT, 'titles.json'), 'utf8')); } catch (e) { /* no content yet */ }
  let extra = {}, groups = {};      // Class 11 and 12: chapter names, and "Physics · Part 1" style groups
  try { extra = JSON.parse(fs.readFileSync(path.join(CONTENT, 'titles-extra.json'), 'utf8')); } catch (e) { /* none */ }
  try { groups = JSON.parse(fs.readFileSync(path.join(CONTENT, 'groups.json'), 'utf8')); } catch (e) { /* none */ }
  let acts = {};
  try { acts = JSON.parse(fs.readFileSync(path.join(CONTENT, 'activities.json'), 'utf8')); } catch (e) { /* counts not built yet */ }
  const classes = {};
  for (const c of [6, 7, 8, 9, 10, 11, 12]) {
    const dir = path.join(CONTENT, `Class - ${c}`);
    let chapters = [];
    try { chapters = fs.readdirSync(dir).map((d) => /^Chapter - (\d+)$/.exec(d)).filter(Boolean).map((m) => Number(m[1])).filter((n) => fs.existsSync(path.join(dir, `Chapter - ${n}`, 'index.html'))).sort((a, b) => a - b); } catch (e) { /* none */ }
    classes[c] = chapters.map((n) => ({ chapter: n, title: (titles[c] && titles[c][n]) || (extra[c] && extra[c][n]) || `Chapter ${n}`, group: (groups[c] && groups[c][n]) || '', activities: (acts[c] && acts[c][n]) || 0 }));
  }
  cache = { classes, dir: CONTENT };
  return cache;
}
const has = (c, n) => !!load().classes[c] && load().classes[c].some((x) => x.chapter === n);
const total = () => Object.values(load().classes).reduce((a, l) => a + l.length, 0);
const totalActivities = () => Object.values(load().classes).reduce((a, l) => a + l.reduce((x, y) => x + y.activities, 0), 0);
/** the chapter keys ("11/3") of one subject of a class, e.g. Physics of Class 11 */
const subjectChapters = (c, subject) => (load().classes[c] || []).filter((x) => (x.group || '').split(' · ')[0] === subject).map((x) => `${c}/${x.chapter}`);
/** the first chapter of every subject of Class 11 and 12 (Physics, Chemistry, Mathematics): free for everyone */
const firstOfEachSubject = () => [11, 12].flatMap((c) => { const seen = new Set(); return (load().classes[c] || []).filter((x) => { const s = (x.group || '').split(' · ')[0]; if (!s || seen.has(s)) return false; seen.add(s); return true; }).map((x) => `${c}/${x.chapter}`); });
const reset = () => { cache = null; };

module.exports = { load, has, total, totalActivities, subjectChapters, firstOfEachSubject, reset, CONTENT };

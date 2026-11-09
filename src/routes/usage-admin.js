'use strict';
/** Admin-only numbers: how the Botclub Labs apps (Windows, Android, Linux) are used in schools, and how the website itself is used. */
const express = require('express');
const db = require('../db');
const Q = require('../usage/queries');
const catalog = require('../catalog');
const { wrap } = require('../lib');

const router = express.Router();                       // mounted behind requireAdmin
const ADMIN = { role: 'admin', schools: [] };
const dayKey = (d) => d.toISOString().slice(0, 10);

function titleOf(c, n) {
  const ch = (catalog.load().classes[c] || []).find((x) => x.chapter === n);
  return ch ? ch.title : '';
}
const withTitles = (rows) => rows.map((r) => ({ ...r, title: r.cls ? titleOf(r.cls, r.chapter) : '' }));

router.get('/overview', wrap(async (req, res) => {
  const r = await Q.overview(ADMIN, req.query);
  res.json({ ...r, topChapters: withTitles(r.topChapters || []) });
}));
router.get('/schools', wrap(async (req, res) => res.json(await Q.schools(ADMIN, req.query))));
router.get('/school', wrap(async (req, res) => {
  const r = await Q.schoolDetail(ADMIN, String(req.query.name || ''), req.query);
  if (!r) return res.status(404).json({ error: 'School not found.' });
  res.json({ ...r, chapters: withTitles(r.chapters) });
}));
router.get('/devices', wrap(async (req, res) => res.json(await Q.devices(ADMIN, req.query))));
router.get('/device', wrap(async (req, res) => {
  const r = await Q.deviceDetail(ADMIN, String(req.query.id || ''), req.query);
  if (!r) return res.status(404).json({ error: 'Screen not found.' });
  res.json({ ...r, topChapters: withTitles(r.topChapters) });
}));
router.get('/chapters', wrap(async (req, res) => {
  const r = await Q.chapters(ADMIN, req.query);
  res.json({ ...r, chapters: withTitles(r.chapters) });
}));

const csvCell = (v) => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
router.get('/export.csv', wrap(async (req, res) => {
  const rows = await Q.exportRows(ADMIN, req.query);
  const head = ['date', 'school', 'screen', 'device_id', 'platform', 'type', 'class', 'chapter', 'active_minutes'];
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="botclub-usage.csv"' });
  res.send('﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n');
}));

router.post('/devices/:id/revoke', wrap(async (req, res) => {
  const r = await db.usage().collection('devices').updateOne({ _id: String(req.params.id) }, { $set: { revoked: !(req.body && req.body.revoked === false) } });
  r.matchedCount ? res.json({ ok: true }) : res.status(404).json({ error: 'Screen not found.' });
}));
router.delete('/devices/:id', wrap(async (req, res) => {
  const id = String(req.params.id), d = db.usage();
  const r = await d.collection('devices').deleteOne({ _id: id });
  if (!r.deletedCount) return res.status(404).json({ error: 'Screen not found.' });
  await Promise.all(['usage_daily', 'chapters', 'sessions'].map((c) => d.collection(c).deleteMany({ deviceId: id })));
  res.json({ ok: true });
}));

/** the website's own learning numbers (students using the portal) */
router.get('/web', wrap(async (req, res) => {
  const d = db.get(), since = new Date(Date.now() - 13 * 864e5), sinceKey = dayKey(since);
  const [students, active7, perDay, top, totals] = await Promise.all([
    d.collection('users').countDocuments({ role: 'student' }),
    d.collection('daily_usage').distinct('userId', { date: { $gte: dayKey(new Date(Date.now() - 6 * 864e5)) } }),
    d.collection('daily_usage').aggregate([{ $match: { date: { $gte: sinceKey } } }, { $group: { _id: '$date', sec: { $sum: '$sec' }, users: { $addToSet: '$userId' } } }]).toArray(),
    d.collection('progress').aggregate([{ $match: { sec: { $gt: 0 } } }, { $group: { _id: { cls: '$cls', chapter: '$chapter' }, sec: { $sum: '$sec' }, students: { $sum: 1 }, done: { $sum: { $cond: ['$done', 1, 0] } } } }, { $sort: { sec: -1 } }, { $limit: 10 }]).toArray(),
    d.collection('progress').aggregate([{ $group: { _id: null, sec: { $sum: '$sec' }, done: { $sum: { $cond: ['$done', 1, 0] } } } }]).toArray(),
  ]);
  const by = new Map(perDay.map((x) => [x._id, x]));
  const daily = []; for (let i = 13; i >= 0; i--) { const k = dayKey(new Date(Date.now() - i * 864e5)), x = by.get(k); daily.push({ date: k, hours: x ? Math.round(x.sec / 36) / 100 : 0, students: x ? x.users.length : 0 }); }
  res.json({ students, activeStudents7d: active7.length, hours: totals[0] ? Math.round(totals[0].sec / 36) / 100 : 0, chaptersDone: totals[0] ? totals[0].done : 0, daily,
    topChapters: top.map((r) => ({ cls: r._id.cls, chapter: r._id.chapter, title: titleOf(r._id.cls, r._id.chapter), hours: Math.round(r.sec / 36) / 100, students: r.students, done: r.done })) });
}));

module.exports = router;

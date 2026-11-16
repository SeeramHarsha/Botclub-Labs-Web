'use strict';
const crypto = require('crypto');
const db = require('./db');
const config = require('./config');
const catalog = require('./catalog');

const col = () => db.get().collection('entitlements');

/** active entitlements of a student */
async function active(userId, now = new Date()) {
  return col().find({ userId: String(userId), startsAt: { $lte: now }, $or: [{ endsAt: null }, { endsAt: { $gt: now } }] }).toArray();
}

/** everything not yet ended, including a renewal that starts later (for "valid until" in the account summary) */
async function current(userId, now = new Date()) {
  return col().find({ userId: String(userId), $or: [{ endsAt: null }, { endsAt: { $gt: now } }] }).toArray();
}

/** can this student open class c chapter n? */
function allows(ents, c, n) {
  return ents.some((e) => e.classes.includes(c) && (e.chapters === 'all' || (Array.isArray(e.chapters) && e.chapters.includes(`${c}/${n}`))));
}

/** the free trial: a few chapters for every registered student, no end date */
async function ensureTrial(userId) {
  const chapters = config.trialChapters.filter((k) => { const [c, n] = k.split('/').map(Number); return catalog.has(c, n) || !catalog.total(); });
  if (!chapters.length) return null;
  const have = await col().findOne({ userId: String(userId), source: 'trial' });
  if (have) {                                  // chapters added to the free trial later (a new class, say) reach existing students too
    const missing = chapters.filter((k) => !have.chapters.includes(k));
    if (!missing.length) return have;
    const all = [...have.chapters, ...missing], classes = [...new Set(all.map((k) => Number(k.split('/')[0])))];
    await col().updateOne({ _id: have._id }, { $set: { chapters: all, classes } });
    return { ...have, chapters: all, classes };
  }
  const doc = { _id: crypto.randomUUID(), userId: String(userId), source: 'trial', planId: 'trial', orderId: null, classes: [...new Set(chapters.map((k) => Number(k.split('/')[0])))], chapters, startsAt: new Date(), endsAt: null };
  await col().insertOne(doc);
  return doc;
}

/** give access. Buying again while still active extends the same access instead of overlapping it. */
async function grant({ userId, source, planId, orderId = null, classes, chapters = 'all', subject = null, days }) {
  const now = new Date();
  let startsAt = now;
  if (days) {          // the same classes (and the same chapters, for a one-subject plan) bought again start when the first one ends
    const same = await col().find({ userId: String(userId), source: { $ne: 'trial' }, endsAt: { $gt: now } }).toArray();
    const key = (cl, ch) => [...cl].sort().join(',') + '|' + (ch === 'all' ? 'all' : [...ch].sort().join(','));
    for (const e of same) if (key(e.classes, e.chapters) === key(classes, chapters) && e.endsAt > startsAt) startsAt = e.endsAt;
  }
  const endsAt = days ? new Date(startsAt.getTime() + days * 864e5) : null;
  const doc = { _id: crypto.randomUUID(), userId: String(userId), source, planId, orderId, classes: [...classes], chapters, subject, startsAt, endsAt };
  await col().insertOne(doc);
  return doc;
}

/** summary the app shows: which classes are fully open, until when, and the free chapters */
function summarize(ents) {
  const full = {};
  for (const e of ents) if (e.chapters === 'all') for (const c of e.classes) if (!full[c] || (e.endsAt === null) || (full[c] !== null && e.endsAt > full[c])) full[c] = e.endsAt;
  const free = [...new Set(ents.flatMap((e) => (Array.isArray(e.chapters) ? e.chapters : [])))];
  const subjects = ents.filter((e) => e.source !== 'trial' && e.subject && Array.isArray(e.chapters)).map((e) => ({ cls: e.classes[0], subject: e.subject, endsAt: e.endsAt }));
  return { fullClasses: Object.entries(full).map(([c, end]) => ({ cls: Number(c), endsAt: end })), subjects, freeChapters: free };
}

module.exports = { active, current, allows, ensureTrial, grant, summarize };

'use strict';
const { MongoClient } = require('mongodb');

let client = null, db = null, usageDb = null;

/**
 * users          { _id: ObjectId, email, name, passwordHash, role: 'student'|'admin', cls, school, phone, consentAt, createdAt, lastLoginAt,
 *                  disabled, failedLogins, lockUntil, resetHash, resetExpires }
 * plans          { _id: 'class-year', name, tagline, priceInr, durationDays, scope: 'one-class'|'all-classes', features[], badge, active, sort }
 * orders         { _id: uuid, userId, planId, planName, cls, amountPaise, currency, status: 'created'|'paid'|'failed', provider, providerOrderId,
 *                  paymentId, createdAt, paidAt }
 * entitlements   { _id: uuid, userId, source: 'trial'|'purchase'|'admin', planId, orderId, classes[], chapters: 'all'|['6/1'..], startsAt, endsAt|null }
 * progress       { _id: "user|cls/ch", userId, cls, chapter, sec, opens, firstAt, lastAt, done }
 * (apps' usage data lives in the USAGE_DB database: devices, usage_daily, chapters, sessions; see usage/queries.js)
 * daily_usage    { _id: "user|YYYY-MM-DD", userId, date, sec }
 */
async function connect(uri, dbName, usageName) {
  client = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 10000 });
  await client.connect();
  db = client.db(dbName);
  usageDb = client.db(usageName || 'skolar');
  const ci = { collation: { locale: 'en', strength: 2 } };
  await Promise.all([
    db.collection('users').createIndexes([{ key: { email: 1 }, unique: true, ...ci }, { key: { createdAt: -1 } }, { key: { role: 1 } }]),
    db.collection('orders').createIndexes([{ key: { userId: 1, createdAt: -1 } }, { key: { providerOrderId: 1 } }, { key: { status: 1, createdAt: -1 } }]),
    db.collection('entitlements').createIndexes([{ key: { userId: 1 } }]),
    db.collection('progress').createIndexes([{ key: { userId: 1 } }]),
    db.collection('daily_usage').createIndexes([{ key: { userId: 1, date: -1 } }]),
    usageDb.collection('devices').createIndexes([{ key: { school: 1 } }, { key: { lastSeen: -1 } }, { key: { platform: 1 } },
      { key: { clientId: 1 }, unique: true, partialFilterExpression: { clientId: { $type: 'string' } } }]),
    usageDb.collection('usage_daily').createIndexes([{ key: { date: 1, school: 1 } }, { key: { deviceId: 1, date: 1 } }, { key: { date: 1, cls: 1 } }, { key: { page: 1, date: 1 } }]),
    usageDb.collection('chapters').createIndexes([{ key: { deviceId: 1 } }, { key: { page: 1 } }]),
    usageDb.collection('sessions').createIndexes([{ key: { deviceId: 1, start: -1 } }, { key: { start: -1 } }]),
  ]);
  return db;
}

const get = () => { if (!db) throw new Error('database not connected'); return db; };
const usage = () => { if (!usageDb) throw new Error('database not connected'); return usageDb; };
const close = async () => { if (client) await client.close(); client = null; db = null; usageDb = null; };
const ping = async () => { await get().command({ ping: 1 }); };

module.exports = { connect, get, usage, close, ping };

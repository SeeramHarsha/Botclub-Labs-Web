'use strict';
/**
 * Try the portal on your own computer, no MongoDB install needed:   npm run demo   then open http://localhost:8095
 * It starts a temporary MongoDB and FAKE payments (nobody is charged). Everything is thrown away when you stop it.
 * Admin login for the demo: admin@demo.local / demo-admin-password. DEMO ONLY: never use these settings on the internet.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

/** a few pretend schools and screens, so the admin "App usage" pages have something to show */
async function seedUsage() {
  const d = require('../src/db').usage(), now = new Date(), day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const schools = [['Greenfield Public School', [['Panel 1', 'windows', [8, 9]], ['Panel 2', 'windows', [8]], ['Tablet lab', 'android', [6, 7]]]], ['Sunrise Vidyalaya', [['Smart board', 'linux', [8, 10]]]]];
  const pages = ['8/1', '8/2', '8/3', '9/1', '9/2', '6/1', '7/1', '10/1'];
  let n = 0;
  for (const [school, screens] of schools) for (const [label, platform, classes] of screens) {
    const id = 'demo-device-' + (++n), docs = [], chs = new Map();
    for (let i = 0; i < 20; i++) for (const p of pages) {
      const [cls, chapter] = p.split('/').map(Number);
      if (!classes.includes(cls) || (i + chapter + n) % 3 === 0) continue;
      const sec = 300 + ((i * 97 + chapter * 53 + n * 31) % 1500);
      docs.push({ _id: id + '|' + day(i) + '|' + p, deviceId: id, school, platform, date: day(i), page: p, cls, chapter, sec });
      const c = chs.get(p) || { _id: id + '|' + p, deviceId: id, school, page: p, cls, chapter, sec: 0, opens: 0 }; c.sec += sec; c.opens++; chs.set(p, c);
    }
    await d.collection('devices').insertOne({ _id: id, school, label, platform, appVersion: '2.0', kind: 'classroom', section: '', classes, expiry: '2027-06-30', tokenHash: 'x', registeredAt: now, lastSeen: new Date(Date.now() - n * 7 * 60e3), revoked: false });
    if (docs.length) await d.collection('usage_daily').insertMany(docs);
    if (chs.size) await d.collection('chapters').insertMany([...chs.values()]);
  }
}

(async () => {
  const mongod = await MongoMemoryServer.create();
  Object.assign(process.env, { MONGODB_URI: mongod.getUri(), MONGODB_DB: 'portal_demo', JWT_SECRET: 'demo-only-secret-demo-only-secret-123', PAYMENT_MODE: 'demo',
    ADMIN_EMAIL: 'admin@demo.local', ADMIN_PASSWORD: 'demo-admin-password', PORT: process.env.PORT || '8095' });
  const server = await require('../src/server').start();
  await server.ready;
  await seedUsage();
  console.log(`\nDemo ready:  http://localhost:${process.env.PORT}   (admin: admin@demo.local / demo-admin-password, payments are FAKE)\nCtrl+C to stop`);
  const stop = async () => { await mongod.stop(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
})().catch((e) => { console.error(e); process.exit(1); });

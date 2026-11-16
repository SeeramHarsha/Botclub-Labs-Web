'use strict';
const express = require('express');
const config = require('../config');
const plans = require('../plans');
const catalog = require('../catalog');
const { wrap, text, isEmail, cleanEmail, CLASSES } = require('../lib');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const db = require('../db');
const mailer = require('../mailer');

const router = express.Router();

router.get('/plans', wrap(async (req, res) => res.json({ plans: (await plans.list()).map(plans.pub), trialChapters: config.trialChapters })));

router.get('/config', (req, res) => {
  const cat = catalog.load();
  res.json({
    brand: config.brand, paymentMode: config.paymentMode, razorpayKeyId: config.paymentMode === 'razorpay' ? config.razorpayKeyId : '', supportEmail: config.supportEmail,
    totalChapters: catalog.total(), totalActivities: catalog.totalActivities(),
    classActivities: Object.fromEntries(Object.entries(cat.classes).map(([c, l]) => [c, l.reduce((a, x) => a + x.activities, 0)])), classes: Object.fromEntries(Object.entries(cat.classes).map(([c, l]) => [c, l.length])),
  });
});

/** Class 11 and 12 syllabus (Physics, Chemistry, Mathematics) for the home page: groups, chapter names and activity counts */
router.get('/syllabus', (req, res) => {
  const cat = catalog.load(), out = {};
  for (const c of [11, 12]) {
    const list = cat.classes[c] || [], subjects = [];
    for (const x of list) {
      const name = (x.group || 'Other').split(' · ')[0];
      let s = subjects.find((y) => y.name === name); if (!s) subjects.push(s = { name, chapters: 0, activities: 0, groups: [] });
      let g = s.groups.find((y) => y.name === (x.group || name)); if (!g) s.groups.push(g = { name: x.group || name, chapters: [] });
      g.chapters.push({ chapter: x.chapter, title: x.title, activities: x.activities }); s.chapters++; s.activities += x.activities;
    }
    out[c] = { chapters: list.length, activities: list.reduce((a, x) => a + x.activities, 0), subjects };
  }
  res.json({ classes: out });
});

// ---------------------------------------------------------------- "Talk to sales": schools and institutes leave their details
const enquiryLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 6, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests from this network. Please try again in an hour, or write to us by email.' } });
const SIZES = ['Under 100', '100 to 500', '500 to 1,000', 'Over 1,000'], ROLES = ['Principal / Head', 'Teacher', 'Administrator / Management', 'Other'];
router.post('/enquiry', enquiryLimit, wrap(async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.status(201).json({ ok: true });                       // hidden field only a bot fills in: pretend it worked
  const institute = text(b.institute, 100), name = text(b.name, 80), email = cleanEmail(b.email), phone = text(b.phone, 20).replace(/[^\d+ ()-]/g, '');
  if (institute.length < 2) return res.status(400).json({ error: 'Please enter the name of the school or institute.' });
  if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (phone.replace(/\D/g, '').length < 7) return res.status(400).json({ error: 'Please enter a phone number we can call.' });
  const doc = { _id: crypto.randomUUID(), institute, name, role: ROLES.includes(b.role) ? b.role : 'Other', email, phone, city: text(b.city, 60), students: SIZES.includes(b.students) ? b.students : '',
    classes: [...new Set((Array.isArray(b.classes) ? b.classes : []).map(Number).filter((c) => CLASSES.includes(c)))].sort((x, y) => x - y), message: text(b.message, 1000), status: 'new', note: '', createdAt: new Date() };
  await db.get().collection('enquiries').insertOne(doc);
  if (config.salesEmail) {                                                           // a copy by e-mail when e-mail is set up; the enquiry is saved either way
    mailer.send({ to: config.salesEmail, subject: 'Botclub Labs: new institute enquiry from ' + institute,
      text: ['Institute: ' + institute, 'Name: ' + name + ' (' + doc.role + ')', 'Email: ' + email, 'Phone: ' + phone, 'City: ' + (doc.city || '-'), 'Students: ' + (doc.students || '-'), 'Classes: ' + (doc.classes.join(', ') || '-'), '', doc.message || '(no message)'].join('\n') }).catch(() => {});
  }
  res.status(201).json({ ok: true });
}));

module.exports = router;

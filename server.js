const express = require('express'), Realm = require('realm'), crypto = require('crypto'), path = require('path');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- 1) Realm schemas ---------- */
const schema = [
  { name: 'User', primaryKey: '_id', properties: {
    _id: 'objectId', studentName: 'string', studentPhone: 'string',
    parentName: 'string', parentPhone: 'string', salt: 'string', hash: 'string', createdAt: 'date' } },
  { name: 'ExamResult', primaryKey: '_id', properties: {
    _id: 'objectId', userId: 'objectId', studentName: 'string', examName: 'string',
    score: 'int', total: 'int', date: 'date', evaluation: 'string' } },
  // A Progress record exists only once an item is done (video watched / PDF downloaded)
  { name: 'Progress', primaryKey: '_id', properties: {
    _id: 'objectId', userId: 'objectId', itemId: 'string', type: 'string', updatedAt: 'date' } },
  { name: 'Post', primaryKey: '_id', properties: {
    _id: 'objectId', author: 'string', text: 'string', createdAt: 'date' } },
];
const ready = Realm.open({ schema, path: path.join(__dirname, 'ard-alahyaa.realm') });
const O = Realm.BSON.ObjectId;

/* ---------- 2) Course content (replace URLs / PDFs with your own) ---------- */
const UNITS = [
  { unit: 'الباب الأول: الوراثة', items: [
    { id: 'l1', title: 'قوانين مندل', url: 'https://www.youtube.com/watch?v=REPLACE_ID' },
    { id: 'l2', title: 'الوراثة المرتبطة بالجنس', url: 'https://www.youtube.com/watch?v=REPLACE_ID' } ] },
  { unit: 'الباب الثاني: الخلية', items: [
    { id: 'l3', title: 'تركيب الخلية', url: 'https://www.youtube.com/watch?v=REPLACE_ID' },
    { id: 'l4', title: 'الانقسام الميتوزي والميوزي', url: 'https://www.youtube.com/watch?v=REPLACE_ID' } ] },
];
const NOTES = [
  { id: 'n1', title: 'ملخص الوراثة', file: '/pdfs/genetics.pdf' },
  { id: 'n2', title: 'ملخص الخلية', file: '/pdfs/cell.pdf' },
];
const EXAMS = [
  { id: 'e1', name: 'كويز الوراثة', q: [
    { t: 'من هو أبو علم الوراثة؟', o: ['داروين', 'مندل', 'باستور'], a: 1 },
    { t: 'الصفة التي تظهر في الجيل الأول تسمى:', o: ['متنحية', 'سائدة', 'متوسطة'], a: 1 },
    { t: 'عدد الكروموسومات في الخلية الجسدية للإنسان:', o: ['23', '46', '48'], a: 1 } ] },
  { id: 'e2', name: 'كويز أحياء خلية', q: [
    { t: 'مركز التحكم في الخلية:', o: ['النواة', 'الريبوسوم', 'الجولجي'], a: 0 },
    { t: 'مصنع الطاقة في الخلية:', o: ['الميتوكوندريا', 'الليسوسوم', 'الفجوة'], a: 0 },
    { t: 'الانقسام الذي ينتج الأمشاج:', o: ['الميتوزي', 'الميوزي', 'المباشر'], a: 1 } ] },
];
const ACTIVITIES = [
  { t: 'محاضرة وراثة', s: 'د. أحمد - 10:00 ص' }, { t: 'كويز أحياء خلية', s: 'سارة حسن - 12:00 م' },
  { t: 'حلقة نقاشية', s: 'قلها أنت - 1:30 م', dark: 1 }, { t: 'مراجعة عامة', s: 'د. أحمد - 3:00 م' },
];

/* ---------- 3) Helpers ---------- */
const hashPw = (p, s) => crypto.scryptSync(p, s, 32).toString('hex');
const sessions = new Map(); // token -> userId
const newToken = u => { const t = crypto.randomBytes(24).toString('hex'); sessions.set(t, String(u._id)); return t; };
const evalOf = p => p >= 90 ? 'ممتاز' : p >= 75 ? 'جيد جداً' : p >= 50 ? 'جيد' : 'يحتاج مراجعة';
const wrap = f => async (req, res) => {
  try { await f(req, res, await ready); } catch (e) { console.error(e); res.status(500).json({ error: 'حدث خطأ في الخادم' }); }
};
const guard = (req, res, next) => {
  const id = sessions.get(req.headers.authorization);
  if (!id) return res.status(401).json({ error: 'سجّل الدخول أولاً' });
  req.uid = id; next();
};
const me = (realm, req) => realm.objectForPrimaryKey('User', new O(req.uid));
const doneIds = (realm, uid, type) =>
  new Set(realm.objects('Progress').filtered('userId == $0 AND type == $1', new O(uid), type).map(p => p.itemId));
const heroOf = realm => {
  const since = new Date(Date.now() - 7 * 864e5), m = {};
  realm.objects('ExamResult').filtered('date >= $0', since).forEach(r => {
    const x = m[r.userId] ??= { name: r.studentName, sum: 0, n: 0 };
    x.sum += r.score / r.total * 100; x.n++;
  });
  const top = Object.values(m).sort((a, b) => b.sum / b.n - a.sum / a.n)[0];
  return top ? { name: top.name, pct: Math.round(top.sum / top.n), exams: top.n } : null;
};

/* ---------- 4) Auth ---------- */
app.post('/api/signup', wrap(async (req, res, realm) => {
  const { studentName = '', studentPhone = '', parentName = '', parentPhone = '', password = '' } = req.body;
  if (studentName.trim().split(/\s+/).length < 3) return res.status(400).json({ error: 'اكتب اسم الطالب الثلاثي' });
  if (!parentName.trim()) return res.status(400).json({ error: 'اكتب اسم ولي الأمر' });
  if (!/^\d{8,15}$/.test(studentPhone) || !/^\d{8,15}$/.test(parentPhone)) return res.status(400).json({ error: 'رقم الهاتف غير صحيح' });
  if (password.length < 6) return res.status(400).json({ error: 'كلمة المرور 6 أحرف على الأقل' });
  if (realm.objects('User').filtered('studentPhone == $0', studentPhone).length) return res.status(409).json({ error: 'هذا الرقم مسجل بالفعل' });
  const salt = crypto.randomBytes(16).toString('hex');
  let u;
  realm.write(() => { u = realm.create('User', { _id: new O(), studentName: studentName.trim(), studentPhone,
    parentName: parentName.trim(), parentPhone, salt, hash: hashPw(password, salt), createdAt: new Date() }); });
  res.json({ token: newToken(u) });
}));

app.post('/api/login', wrap(async (req, res, realm) => {
  const { studentPhone = '', password = '' } = req.body;
  const u = realm.objects('User').filtered('studentPhone == $0', studentPhone)[0];
  if (!u || hashPw(password, u.salt) !== u.hash) return res.status(401).json({ error: 'رقم الهاتف أو كلمة المرور غير صحيحة' });
  res.json({ token: newToken(u) });
}));

app.get('/api/me', guard, wrap(async (req, res, realm) => {
  const u = me(realm, req);
  if (!u) return res.status(401).json({ error: 'سجّل الدخول أولاً' });
  res.json({ studentName: u.studentName, studentPhone: u.studentPhone, parentName: u.parentName, parentPhone: u.parentPhone });
}));

/* ---------- 5) Sections ---------- */
app.get('/api/dashboard', guard, wrap(async (req, res, realm) => {
  const chart = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 6 + i);
    const n = new Date(d); n.setDate(n.getDate() + 1);
    return { label: d.toLocaleDateString('ar-EG', { weekday: 'short' }),
      value: realm.objects('Progress').filtered('updatedAt >= $0 AND updatedAt < $1', d, n).length +
             realm.objects('ExamResult').filtered('date >= $0 AND date < $1', d, n).length };
  });
  const since = new Date(Date.now() - 864e5);
  const active = new Set([
    ...realm.objects('Progress').filtered('updatedAt >= $0', since).map(p => String(p.userId)),
    ...realm.objects('ExamResult').filtered('date >= $0', since).map(r => String(r.userId))]).size;
  res.json({ newLectures: UNITS.flatMap(u => u.items).length, active, upcomingExams: EXAMS.length,
    chart, activities: ACTIVITIES, hero: heroOf(realm) });
}));

app.get('/api/lectures', guard, wrap(async (req, res, realm) => {
  const d = doneIds(realm, req.uid, 'lecture');
  res.json(UNITS.map(u => ({ ...u, items: u.items.map(i => ({ ...i, done: d.has(i.id) })) })));
}));
app.get('/api/notes', guard, wrap(async (req, res, realm) => {
  const d = doneIds(realm, req.uid, 'note');
  res.json(NOTES.map(n => ({ ...n, done: d.has(n.id) })));
}));
app.post('/api/progress', guard, wrap(async (req, res, realm) => {
  const { itemId, type } = req.body, uid = new O(req.uid);
  if (!['lecture', 'note'].includes(type)) return res.status(400).json({ error: 'نوع غير صحيح' });
  if (!realm.objects('Progress').filtered('userId == $0 AND itemId == $1', uid, itemId).length)
    realm.write(() => realm.create('Progress', { _id: new O(), userId: uid, itemId, type, updatedAt: new Date() }));
  res.json({ ok: true });
}));

app.get('/api/exams', guard, (req, res) => res.json(EXAMS.map(e => ({ id: e.id, name: e.name, count: e.q.length }))));
app.get('/api/exam/:id', guard, (req, res) => {
  const e = EXAMS.find(x => x.id === req.params.id);
  if (!e) return res.status(404).json({ error: 'الاختبار غير موجود' });
  res.json({ id: e.id, name: e.name, q: e.q.map(({ t, o }) => ({ t, o })) }); // answers stay on the server
});
app.post('/api/exam/:id/submit', guard, wrap(async (req, res, realm) => {
  const e = EXAMS.find(x => x.id === req.params.id), u = me(realm, req);
  if (!e) return res.status(404).json({ error: 'الاختبار غير موجود' });
  const ans = req.body.answers || [];
  const score = e.q.filter((q, i) => ans[i] === q.a).length, pct = Math.round(score / e.q.length * 100);
  const evaluation = evalOf(pct);
  realm.write(() => realm.create('ExamResult', { _id: new O(), userId: u._id, studentName: u.studentName,
    examName: e.name, score, total: e.q.length, date: new Date(), evaluation }));
  res.json({ score, total: e.q.length, pct, evaluation, correct: e.q.map(q => q.a) });
}));

app.get('/api/hero', guard, wrap(async (req, res, realm) => res.json(heroOf(realm) || {})));

app.get('/api/posts', guard, wrap(async (req, res, realm) =>
  res.json(realm.objects('Post').sorted('createdAt', true).slice(0, 30)
    .map(p => ({ author: p.author, text: p.text, at: p.createdAt })))));
app.post('/api/posts', guard, wrap(async (req, res, realm) => {
  const text = (req.body.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'اكتب نصاً أولاً' });
  realm.write(() => realm.create('Post', { _id: new O(), author: me(realm, req).studentName, text, createdAt: new Date() }));
  res.json({ ok: true });
}));

app.get('/api/results', guard, wrap(async (req, res, realm) => {
  const rows = realm.objects('ExamResult').filtered('userId == $0', new O(req.uid)).sorted('date', true)
    .map(r => ({ examName: r.examName, score: r.score, total: r.total, date: r.date, evaluation: r.evaluation }));
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.score / r.total * 100, 0) / rows.length) : 0;
  res.json({ rows, avg, level: rows.length ? evalOf(avg) : '—',
    watched: doneIds(realm, req.uid, 'lecture').size, downloaded: doneIds(realm, req.uid, 'note').size,
    totalLectures: UNITS.flatMap(u => u.items).length, totalNotes: NOTES.length });
}));

app.listen(3000, () => console.log('أرض الأحياء تعمل على http://localhost:3000'));

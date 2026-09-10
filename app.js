const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./src/routes/auth.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const userRoutes = require('./src/routes/user.routes');
const studentRoutes = require('./src/routes/student.routes');
const monitoringRoutes = require('./src/routes/monitoring.routes');
const uploadRoutes = require('./src/routes/upload.routes');
const auditRoutes = require('./src/routes/audit.routes');
const analyticsRoutes = require('./src/routes/analytics.routes');
const modulesRoutes = require('./src/routes/modules.routes');
const structureRoutes = require('./src/routes/structure.routes');
const controlRoutes = require('./src/routes/control.routes');
const submissionRoutes = require('./src/routes/submission.routes');
const notificationRoutes = require('./src/routes/notification.routes');
const insightsRoutes = require('./src/routes/insights.routes');
const milestoneRoutes = require('./src/routes/milestone.routes');
const hemisRoutes = require('./src/routes/hemis.routes');
const profileRoutes = require('./src/routes/profile.routes');
const displayRoutes = require('./src/routes/display.routes');
const mdRoutes = require('./src/routes/md.routes');
const { attachUser } = require('./src/middleware/auth');
const { ROLE_LABELS } = require('./src/config/roles');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  maxAge: 0,
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
}));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/md' }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 10
  }
}));

app.use(attachUser);
app.use((req, res, next) => {
  const allowed = ['/login','/logout','/password','/sw.js','/manifest.webmanifest','/offline'];
  if (req.user && req.user.mustChangePassword && !allowed.includes(req.path) && !req.path.startsWith('/static/') && !req.path.startsWith('/display')) {
    return res.redirect('/password');
  }
  next();
});
app.use((req, res, next) => {
  res.locals.path = req.path;
  res.locals.uiVersion = '3.0.0';
  res.locals.roleLabels = ROLE_LABELS;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

app.get('/manifest.webmanifest', (req,res) => res.sendFile(path.join(__dirname,'public','manifest.webmanifest')));
app.get('/sw.js', (req,res) => { res.setHeader('Service-Worker-Allowed','/'); res.setHeader('Cache-Control','no-cache'); res.type('application/javascript'); res.sendFile(path.join(__dirname,'public','sw.js')); });
app.get('/offline', (req,res) => res.sendFile(path.join(__dirname,'public','offline.html')));
app.get('/', (req, res) => res.redirect(req.user ? '/dashboard' : '/login'));
app.use('/display', displayRoutes);
app.use('/md', mdRoutes);
app.use(authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/profile', profileRoutes);
app.use('/users', userRoutes);
app.use('/students', studentRoutes);
app.use('/monitoring', monitoringRoutes);
app.use('/uploads', uploadRoutes);
app.use('/audit', auditRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/structure', structureRoutes);
app.use('/control', controlRoutes);
app.use('/submissions', submissionRoutes);
app.use('/notifications', notificationRoutes);
app.use('/insights', insightsRoutes);
app.use('/milestones', milestoneRoutes);
app.use('/integrations/hemis', hemisRoutes);
app.use(modulesRoutes);

app.use((req, res) => res.status(404).render('errors/404', { title: 'Sahifa topilmadi' }));
app.use((err, req, res, next) => {
  console.error(err);
  if (err?.name === 'MulterError' || /fayl turi|file too large/i.test(err?.message || '')) {
    let redirectTo = req.originalUrl?.startsWith('/submissions') ? '/submissions' : '/uploads';
    if (req.originalUrl?.startsWith('/profile/avatar')) redirectTo = '/profile/edit';
    if (req.originalUrl === '/submissions') redirectTo = '/submissions/new';
    const match = req.originalUrl?.match(/^\/submissions\/([a-f0-9]{24})\//i);
    if (match) redirectTo = `/submissions/${match[1]}`;
    const text = err.code === 'LIMIT_FILE_SIZE'
      ? (req.originalUrl?.startsWith('/profile/avatar') ? 'Profil rasmi 3 MB limitdan oshgan.' : `Fayl hajmi ${process.env.SUBMISSION_FILE_LIMIT_MB || process.env.UPLOAD_LIMIT_MB || 25} MB limitdan oshgan.`)
      : err.code === 'LIMIT_FILE_COUNT'
        ? `Bir urinishda ko‘pi bilan ${process.env.SUBMISSION_MAX_FILES || 5} ta fayl yuklang.`
        : (err.message || 'Faylni yuklashda xato yuz berdi.');
    req.session.flash = { type: 'error', text };
    return res.redirect(redirectTo);
  }
  res.status(err.status || 500).render('errors/500', { title: 'Server xatosi', error: process.env.NODE_ENV === 'development' ? err : null });
});

module.exports = app;

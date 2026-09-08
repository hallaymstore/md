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
const { pendingCountForUser } = require('./src/services/submissionWorkflow');
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
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/qdt_monitor' }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 10
  }
}));

app.use(attachUser);
app.use((req, res, next) => {
  const allowed = ['/login','/logout','/password'];
  if (req.user && req.user.mustChangePassword && !allowed.includes(req.path) && !req.path.startsWith('/static/')) {
    return res.redirect('/password');
  }
  next();
});
app.use(async (req, res, next) => {
  res.locals.submissionInboxCount = req.user ? await pendingCountForUser(req.user) : 0;
  next();
});
app.use((req, res, next) => {
  res.locals.path = req.path;
  res.locals.uiVersion = '2.5.0-APPROVAL-WORKFLOW';
  res.locals.roleLabels = ROLE_LABELS;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

app.get('/', (req, res) => res.redirect(req.user ? '/dashboard' : '/login'));
app.use(authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/users', userRoutes);
app.use('/students', studentRoutes);
app.use('/monitoring', monitoringRoutes);
app.use('/uploads', uploadRoutes);
app.use('/audit', auditRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/structure', structureRoutes);
app.use('/control', controlRoutes);
app.use('/submissions', submissionRoutes);
app.use(modulesRoutes);

app.use((req, res) => res.status(404).render('errors/404', { title: 'Sahifa topilmadi' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).render('errors/500', { title: 'Server xatosi', error: process.env.NODE_ENV === 'development' ? err : null });
});

module.exports = app;

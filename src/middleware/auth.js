const User = require('../models/User');

async function attachUser(req, res, next) {
  try {
    if (!req.session.userId) {
      req.user = null;
      res.locals.currentUser = null;
      return next();
    }
    const user = await User.findById(req.session.userId).lean();
    if (!user || !user.active) {
      req.session.destroy(() => {});
      req.user = null;
      res.locals.currentUser = null;
      return next();
    }
    req.user = user;
    res.locals.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

function requireAuth(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (!roles.includes(req.user.role)) return res.status(403).render('errors/403', { title: 'Ruxsat yo‘q' });
    next();
  };
}

function scopeQueryForUser(user, query = {}) {
  if (!user) return { _id: null };
  if (['superadmin','tech','management','magistracy'].includes(user.role)) return query;
  if (user.role === 'dean') return { ...query, faculty: user.faculty };
  if (user.role === 'department') return { ...query, department: user.department };
  if (user.role === 'supervisor') return { ...query, supervisor: user._id };
  if (user.role === 'teacher') return user.department ? { ...query, department: user.department } : { ...query, _id: null };
  if (user.role === 'student') return { ...query, user: user._id };
  return { ...query, _id: null };
}

module.exports = { attachUser, requireAuth, requireRole, scopeQueryForUser };

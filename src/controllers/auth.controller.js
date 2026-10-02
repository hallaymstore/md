const User = require('../models/User');
const Student = require('../models/Student');
const audit = require('../services/audit');

const normalizePhone = value => String(value || '').replace(/[^0-9+]/g, '');
const buildLookup = identifier => {
  const raw = String(identifier || '').trim();
  const lowered = raw.toLowerCase();
  const phone = normalizePhone(raw);
  const or = [
    { login: lowered },
    { email: lowered },
    { employeeId: raw }
  ];
  if (phone) or.push({ phone });
  return { raw, lowered, phone, or };
};

exports.showLogin = (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Tizimga kirish' });
};

exports.login = async (req, res, next) => {
  try {
    const identifier = req.body.identifier ?? req.body.login;
    const password = String(req.body.password || '');
    const lookup = buildLookup(identifier);

    let user = await User.findOne({ $or: lookup.or });
    if (!user && lookup.raw) {
      const student = await Student.findOne({ studentId: lookup.raw }).select('user').lean();
      if (student?.user) user = await User.findById(student.user);
    }

    if (!user || !user.active || !(await user.verifyPassword(password))) {
      req.session.flash = { type: 'error', text: 'Kirish ma’lumoti yoki parol noto‘g‘ri.' };
      return res.redirect('/login');
    }

    req.session.userId = user._id.toString();
    req.session.cookie.maxAge = req.body.remember === '1'
      ? 1000 * 60 * 60 * 24 * 30
      : 1000 * 60 * 60 * 10;

    user.lastLoginAt = new Date();
    await user.save();
    req.user = user;
    await audit(req, 'AUTH_LOGIN', 'User', user._id, { remember: req.body.remember === '1' });
    res.redirect('/dashboard');
  } catch (e) { next(e); }
};

exports.logout = async (req, res) => {
  if (req.user) await audit(req, 'AUTH_LOGOUT', 'User', req.user._id);
  req.session.destroy(() => res.redirect('/login'));
};

exports.showPassword = (req, res) => res.render('auth/password', { title: 'Parolni almashtirish' });

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!(await user.verifyPassword(currentPassword))) {
      req.session.flash = { type: 'error', text: 'Joriy parol noto‘g‘ri.' };
      return res.redirect('/password');
    }
    if (!newPassword || newPassword.length < 8 || newPassword !== confirmPassword) {
      req.session.flash = { type: 'error', text: 'Yangi parol kamida 8 belgi bo‘lsin va tasdiq bilan bir xil bo‘lsin.' };
      return res.redirect('/password');
    }
    await user.setPassword(newPassword);
    user.mustChangePassword = false;
    await user.save();
    await audit(req, 'PASSWORD_CHANGED', 'User', user._id);
    req.session.flash = { type: 'success', text: 'Parol yangilandi.' };
    res.redirect('/dashboard');
  } catch (e) { next(e); }
};

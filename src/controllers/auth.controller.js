const User = require('../models/User');
const audit = require('../services/audit');

exports.showLogin = (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Tizimga kirish' });
};

exports.login = async (req, res, next) => {
  try {
    const login = String(req.body.login || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ login });
    if (!user || !user.active || !(await user.verifyPassword(password))) {
      req.session.flash = { type: 'error', text: 'Login yoki parol noto‘g‘ri.' };
      return res.redirect('/login');
    }
    req.session.userId = user._id.toString();
    user.lastLoginAt = new Date();
    await user.save();
    req.user = user;
    await audit(req, 'AUTH_LOGIN', 'User', user._id);
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

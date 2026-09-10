const Notification = require('../models/Notification');

exports.index = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('createdBy', 'fullName role')
      .sort({ readAt: 1, createdAt: -1 })
      .limit(150)
      .lean();
    res.render('notifications/index', { title: 'Bildirishnomalar', notifications });
  } catch (error) { next(error); }
};

exports.readOne = async (req, res, next) => {
  try {
    const item = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { $set: { readAt: new Date() } }, { new: true });
    res.redirect(item?.link && item.link.startsWith('/') ? item.link : '/notifications');
  } catch (error) { next(error); }
};

exports.readAll = async (req, res, next) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
    req.session.flash = { type: 'success', text: 'Barcha bildirishnomalar o‘qilgan deb belgilandi.' };
    res.redirect('/notifications');
  } catch (error) { next(error); }
};

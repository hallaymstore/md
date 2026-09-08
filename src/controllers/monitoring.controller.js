const Student = require('../models/Student');
const MonitoringItem = require('../models/MonitoringItem');
const { scopeQueryForUser } = require('../middleware/auth');
const audit = require('../services/audit');

exports.index = async (req, res, next) => {
  try {
    const students = await Student.find(scopeQueryForUser(req.user, {})).select('fullName faculty department group status attendance individualPlan dissertationProgress scientificActivity').lean();
    const ids = students.map(s => s._id);
    const items = await MonitoringItem.find({ student: { $in: ids } }).populate('student','fullName group').sort({ updatedAt: -1 }).limit(100).lean();
    const alerts = students.filter(s => s.status === 'red' || s.attendance < 75 || s.individualPlan < 60 || s.dissertationProgress < 60);
    res.render('monitoring/index', { title: 'Monitoring markazi', students, items, alerts });
  } catch (e) { next(e); }
};

exports.createItem = async (req, res, next) => {
  try {
    const student = await Student.findOne(scopeQueryForUser(req.user, { _id: req.body.student }));
    if (!student) return res.status(403).render('errors/403', { title: 'Ruxsat yo‘q' });
    const percent = Math.max(0, Math.min(100, Number(req.body.percent || 0)));
    const status = percent >= 80 ? 'green' : percent >= 60 ? 'yellow' : 'red';
    const item = await MonitoringItem.create({
      student: student._id,
      type: req.body.type,
      title: req.body.title,
      planned: Number(req.body.planned || 0),
      completed: Number(req.body.completed || 0),
      percent,
      dueDate: req.body.dueDate || undefined,
      status,
      comment: req.body.comment,
      updatedBy: req.user._id
    });
    await audit(req, 'MONITORING_ITEM_CREATED', 'MonitoringItem', item._id, { type: item.type });
    res.redirect('/monitoring');
  } catch (e) { next(e); }
};

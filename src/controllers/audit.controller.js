const AuditLog = require('../models/AuditLog');
exports.index = async (req, res, next) => {
  try {
    const logs = await AuditLog.find().populate('actor','fullName login role').sort({ createdAt: -1 }).limit(300).lean();
    res.render('audit/index', { title: 'Audit jurnali', logs });
  } catch (e) { next(e); }
};

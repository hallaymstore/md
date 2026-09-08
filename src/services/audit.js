const AuditLog = require('../models/AuditLog');

async function audit(req, action, entity, entityId, meta = {}) {
  try {
    await AuditLog.create({
      actor: req.user?._id,
      action,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      meta,
      ip: req.ip,
      userAgent: req.get('user-agent') || ''
    });
  } catch (error) {
    console.error('Audit error:', error.message);
  }
}
module.exports = audit;

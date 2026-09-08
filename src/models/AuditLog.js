const mongoose = require('mongoose');
const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  action: { type: String, required: true, index: true },
  entity: { type: String, index: true },
  entityId: String,
  meta: mongoose.Schema.Types.Mixed,
  ip: String,
  userAgent: String
}, { timestamps: true });
module.exports = mongoose.model('AuditLog', auditLogSchema);

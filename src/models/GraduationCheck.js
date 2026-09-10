const mongoose = require('mongoose');

const graduationCheckSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  key: { type: String, required: true, trim: true },
  status: { type: String, enum: ['auto','pending','done','not_required'], default: 'auto', index: true },
  note: { type: String, trim: true, maxlength: 3000 },
  evidenceLink: { type: String, trim: true, maxlength: 1200 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

graduationCheckSchema.index({ student: 1, key: 1 }, { unique: true });
module.exports = mongoose.model('GraduationCheck', graduationCheckSchema);

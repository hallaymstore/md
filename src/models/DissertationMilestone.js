const mongoose = require('mongoose');

const dissertationMilestoneSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  stage: { type: Number, min: 1, max: 12, required: true },
  title: { type: String, required: true, trim: true, maxlength: 240 },
  status: { type: String, enum: ['not_started','in_progress','submitted','approved','delayed'], default: 'not_started', index: true },
  percent: { type: Number, min: 0, max: 100, default: 0 },
  dueDate: { type: Date, index: true },
  completedAt: Date,
  evidenceLink: { type: String, trim: true, maxlength: 1200 },
  note: { type: String, trim: true, maxlength: 4000 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

dissertationMilestoneSchema.index({ student: 1, stage: 1 }, { unique: true });
module.exports = mongoose.model('DissertationMilestone', dissertationMilestoneSchema);

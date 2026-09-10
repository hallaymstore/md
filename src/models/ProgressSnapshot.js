const mongoose = require('mongoose');

const progressSnapshotSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  day: { type: String, required: true, index: true },
  attendance: { type: Number, min: 0, max: 100, default: 0 },
  plan: { type: Number, min: 0, max: 100, default: 0 },
  dissertation: { type: Number, min: 0, max: 100, default: 0 },
  science: { type: Number, min: 0, max: 100, default: 0 },
  documents: { type: Number, min: 0, max: 100, default: 0 },
  readiness: { type: Number, min: 0, max: 100, default: 0 },
  status: { type: String, enum: ['green','yellow','red'], default: 'yellow' }
}, { timestamps: true });

progressSnapshotSchema.index({ student: 1, day: 1 }, { unique: true });
module.exports = mongoose.model('ProgressSnapshot', progressSnapshotSchema);

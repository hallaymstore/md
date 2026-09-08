const mongoose = require('mongoose');

const documentRecordSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  type: { type: String, enum: ['individual_plan','dissertation_topic','supervisor_info','seminar_minutes','report','publication','conference','attestation','defense','other'], required: true, index: true },
  title: { type: String, required: true, trim: true },
  status: { type: String, enum: ['present','update','missing'], default: 'missing', index: true },
  upload: { type: mongoose.Schema.Types.ObjectId, ref: 'Upload' },
  issueDate: Date,
  expiresAt: Date,
  notes: { type: String, trim: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('DocumentRecord', documentRecordSchema);

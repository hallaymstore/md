const mongoose = require('mongoose');

const seminarSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  date: { type: Date, required: true, index: true },
  faculty: { type: String, trim: true, index: true },
  department: { type: String, trim: true, index: true },
  responsible: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  participantCount: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ['planned','held','cancelled'], default: 'planned', index: true },
  minutesUploaded: { type: Boolean, default: false },
  materialsUploaded: { type: Boolean, default: false },
  photoUploaded: { type: Boolean, default: false },
  result: { type: String, trim: true },
  notes: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Seminar', seminarSchema);

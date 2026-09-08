const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema({
  originalName: String,
  storedName: String,
  path: String,
  mimeType: String,
  size: Number,
  category: { type: String, enum: ['source','document','seminar','report','publication','conference','attestation','defense','protocol','thesis','other'], default: 'source', index: true },
  description: String,
  faculty: String,
  department: String,
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }
}, { timestamps: true });

module.exports = mongoose.model('Upload', uploadSchema);

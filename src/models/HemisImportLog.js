const mongoose = require('mongoose');
const hemisImportLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  filename: String,
  mode: { type: String, enum: ['preview','import'], default: 'import' },
  totalRows: { type: Number, default: 0 },
  created: { type: Number, default: 0 },
  updated: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  errors: { type: [String], default: [] }
}, { timestamps: true });
module.exports = mongoose.model('HemisImportLog', hemisImportLogSchema);

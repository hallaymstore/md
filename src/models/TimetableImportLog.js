const mongoose = require('mongoose');

const timetableImportLogSchema = new mongoose.Schema({
  filename: { type: String, trim: true },
  sheetName: { type: String, trim: true },
  mode: { type: String, enum: ['merge', 'replace_groups'], default: 'merge' },
  totalRows: { type: Number, default: 0 },
  validRows: { type: Number, default: 0 },
  importedRows: { type: Number, default: 0 },
  skippedRows: { type: Number, default: 0 },
  errorRows: { type: Number, default: 0 },
  warningRows: { type: Number, default: 0 },
  affectedGroups: [{ type: String, trim: true }],
  academicYears: [{ type: String, trim: true }],
  semesters: [{ type: Number }],
  status: { type: String, enum: ['previewed', 'completed', 'failed', 'cancelled'], default: 'previewed', index: true },
  summary: { type: mongoose.Schema.Types.Mixed },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }
}, { timestamps: true });

module.exports = mongoose.model('TimetableImportLog', timetableImportLogSchema);

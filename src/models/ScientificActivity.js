const mongoose = require('mongoose');

const scientificActivitySchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  type: { type: String, enum: ['publication','conference','research','seminar'], required: true, index: true },
  title: { type: String, required: true, trim: true },
  organization: { type: String, trim: true },
  date: { type: Date, index: true },
  status: { type: String, enum: ['planned','submitted','accepted','published','completed'], default: 'planned', index: true },
  score: { type: Number, min: 0, max: 100, default: 0 },
  link: { type: String, trim: true },
  notes: { type: String, trim: true },
  submission: { type: mongoose.Schema.Types.ObjectId, ref: 'ResearchSubmission', index: true, unique: true, sparse: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('ScientificActivity', scientificActivitySchema);

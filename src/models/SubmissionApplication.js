const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  stage: { type: String, enum: ['student','supervisor','department','dean','magistracy','management','completed'], required: true },
  actorRole: { type: String, required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, enum: ['submitted','comment','approved','revision','rejected','resubmitted','forwarded','admin_edit'], required: true },
  comment: { type: String, trim: true },
  fromStage: String,
  toStage: String,
  revision: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const submissionApplicationSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  faculty: { type: String, trim: true, index: true },
  department: { type: String, trim: true, index: true },
  group: { type: String, trim: true, index: true },
  specialty: { type: String, trim: true },

  type: {
    type: String,
    enum: ['publication','conference','research','seminar','dissertation','thesis','defense','report','source','document','other'],
    required: true,
    index: true
  },
  title: { type: String, required: true, trim: true, index: true },
  description: { type: String, required: true, trim: true },
  organization: { type: String, trim: true },
  eventDate: Date,
  link: { type: String, trim: true },
  keywords: { type: String, trim: true },
  attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Upload' }],

  status: { type: String, enum: ['in_review','needs_revision','rejected','approved'], default: 'in_review', index: true },
  currentStage: { type: String, enum: ['student','supervisor','department','dean','magistracy','management','completed'], default: 'supervisor', index: true },
  returnStage: { type: String, enum: ['supervisor','department','dean','magistracy','management'] },
  revision: { type: Number, min: 1, default: 1 },
  submittedAt: { type: Date, default: Date.now },
  finalApprovedAt: Date,
  rejectedAt: Date,
  lastDecisionAt: Date,
  history: [historySchema],
  scientificActivity: { type: mongoose.Schema.Types.ObjectId, ref: 'ScientificActivity' }
}, { timestamps: true });

submissionApplicationSchema.index({ currentStage: 1, status: 1, faculty: 1, department: 1 });
submissionApplicationSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model('SubmissionApplication', submissionApplicationSchema);

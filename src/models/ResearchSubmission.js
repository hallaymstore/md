const mongoose = require('mongoose');
const { WORKFLOW_STAGES, SUBMISSION_TYPES } = require('../config/submissionWorkflow');

const stageProgressSchema = new mongoose.Schema({
  stage: { type: String, enum: WORKFLOW_STAGES, required: true },
  status: { type: String, enum: ['waiting', 'pending', 'approved', 'changes_requested', 'rejected', 'skipped'], default: 'waiting' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actedAt: Date,
  comment: { type: String, trim: true, maxlength: 4000 }
}, { _id: false });

const historySchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['created', 'edited', 'submitted', 'resubmitted', 'approved', 'changes_requested', 'rejected', 'commented', 'withdrawn', 'reopened', 'rerouted', 'archived', 'supervisor_reassigned', 'attachment_added', 'attachment_removed'],
    required: true
  },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actorRole: String,
  fromStage: String,
  toStage: String,
  comment: { type: String, trim: true, maxlength: 4000 },
  revision: { type: Number, min: 1, default: 1 },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const researchSubmissionSchema = new mongoose.Schema({
  applicationNo: { type: String, unique: true, sparse: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  faculty: { type: String, required: true, trim: true, index: true },
  department: { type: String, required: true, trim: true, index: true },
  specialty: { type: String, trim: true, index: true },
  group: { type: String, trim: true, index: true },
  type: { type: String, enum: Object.keys(SUBMISSION_TYPES), required: true, index: true },
  title: { type: String, required: true, trim: true, minlength: 5, maxlength: 300 },
  abstract: { type: String, required: true, trim: true, minlength: 20, maxlength: 8000 },
  keywords: [{ type: String, trim: true, maxlength: 60 }],
  externalLink: { type: String, trim: true, maxlength: 1000 },
  studentNote: { type: String, trim: true, maxlength: 4000 },
  priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal', index: true },
  targetDate: { type: Date, index: true },
  status: { type: String, enum: ['draft', 'under_review', 'changes_requested', 'rejected', 'approved', 'withdrawn', 'archived'], default: 'draft', index: true },
  currentStage: { type: String, enum: ['student', ...WORKFLOW_STAGES, 'completed'], default: 'student', index: true },
  resumeStage: { type: String, enum: WORKFLOW_STAGES },
  revision: { type: Number, min: 1, default: 1 },
  attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Upload' }],
  stageProgress: { type: [stageProgressSchema], default: [] },
  history: { type: [historySchema], default: [] },
  submittedAt: Date,
  lastActionAt: { type: Date, default: Date.now, index: true },
  completedAt: Date,
  withdrawnAt: Date,
  archivedAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, optimisticConcurrency: true });

researchSubmissionSchema.index({ status: 1, currentStage: 1, lastActionAt: -1 });
researchSubmissionSchema.index({ faculty: 1, department: 1, status: 1 });
researchSubmissionSchema.index({ student: 1, createdAt: -1 });

researchSubmissionSchema.pre('validate', function(next) {
  if (!this.applicationNo && this._id) {
    this.applicationNo = `MD-${new Date().getFullYear()}-${String(this._id).slice(-10).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('ResearchSubmission', researchSubmissionSchema);

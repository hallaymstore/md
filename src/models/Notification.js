const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['submission', 'decision', 'comment', 'system'], default: 'submission', index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  link: { type: String, trim: true, default: '/dashboard' },
  submission: { type: mongoose.Schema.Types.ObjectId, ref: 'ResearchSubmission', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  readAt: { type: Date, default: null, index: true }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

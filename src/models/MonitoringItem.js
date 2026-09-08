const mongoose = require('mongoose');

const monitoringItemSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  type: { type: String, enum: ['attendance','plan','dissertation','seminar','publication','conference','research','document','academic','supervision'], required: true, index: true },
  title: { type: String, required: true },
  planned: { type: Number, default: 0 },
  completed: { type: Number, default: 0 },
  percent: { type: Number, min: 0, max: 100, default: 0 },
  dueDate: Date,
  status: { type: String, enum: ['green','yellow','red'], default: 'yellow', index: true },
  comment: String,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('MonitoringItem', monitoringItemSchema);

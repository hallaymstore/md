const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  type: { type: String, enum: ['attendance','plan','dissertation','seminar','document','academic','publication','conference','research','other'], default: 'other', index: true },
  priority: { type: String, enum: ['low','medium','high','critical'], default: 'medium', index: true },
  status: { type: String, enum: ['new','in_progress','resolved','cancelled'], default: 'new', index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', index: true },
  faculty: { type: String, trim: true, index: true },
  department: { type: String, trim: true, index: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  dueDate: { type: Date, index: true },
  resolvedAt: Date,
  resolution: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);

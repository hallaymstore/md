const mongoose = require('mongoose');

const timetableEntrySchema = new mongoose.Schema({
  academicYear: { type: String, required: true, trim: true, index: true },
  semester: { type: Number, enum: [1, 2], default: 1, index: true },
  weekType: { type: String, enum: ['all', 'odd', 'even'], default: 'all', index: true },
  day: { type: Number, min: 1, max: 6, required: true, index: true },
  period: { type: Number, min: 1, max: 7, required: true, index: true },
  startTime: { type: String, trim: true },
  endTime: { type: String, trim: true },
  subject: { type: String, required: true, trim: true, index: true },
  lessonType: { type: String, enum: ['lecture', 'practice', 'lab', 'seminar', 'online'], default: 'lecture' },
  group: { type: String, required: true, trim: true, index: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  teacherName: { type: String, trim: true },
  room: { type: String, trim: true, index: true },
  faculty: { type: String, trim: true, index: true },
  department: { type: String, trim: true, index: true },
  note: { type: String, trim: true, maxlength: 500 },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

timetableEntrySchema.index({ academicYear: 1, semester: 1, day: 1, period: 1, group: 1 });
timetableEntrySchema.index({ academicYear: 1, semester: 1, day: 1, period: 1, teacher: 1 });
timetableEntrySchema.index({ academicYear: 1, semester: 1, day: 1, period: 1, room: 1 });

module.exports = mongoose.model('TimetableEntry', timetableEntrySchema);

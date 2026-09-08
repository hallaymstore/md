const mongoose = require('mongoose');

const academicStructureSchema = new mongoose.Schema({
  faculty: { type: String, required: true, trim: true, index: true },
  department: { type: String, required: true, trim: true, index: true },
  specialty: { type: String, required: true, trim: true, index: true },
  group: { type: String, required: true, trim: true, index: true },
  course: { type: Number, min: 1, max: 3, default: 1 },
  admissionYear: { type: Number, min: 2000, max: 2100 },
  educationForm: { type: String, trim: true, default: 'Magistratura' },
  defaultSupervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

academicStructureSchema.index({ faculty: 1, department: 1, specialty: 1, group: 1 }, { unique: true });

module.exports = mongoose.model('AcademicStructure', academicStructureSchema);

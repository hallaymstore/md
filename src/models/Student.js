const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  fullName: { type: String, required: true, trim: true, index: true },
  studentId: { type: String, trim: true, unique: true, sparse: true },
  hemisSyncedAt: Date,
  hemisSource: { type: String, trim: true },
  faculty: { type: String, trim: true, index: true },
  department: { type: String, trim: true, index: true },
  specialty: { type: String, trim: true, index: true },
  educationForm: { type: String, default: 'Magistratura' },
  admissionYear: { type: Number, min: 2000, max: 2100 },
  studyStatus: { type: String, enum: ['active','academic_leave','graduated','expelled'], default: 'active', index: true },
  course: { type: Number, min: 1, max: 3, default: 1, index: true },
  group: { type: String, trim: true, index: true },
  supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  dissertationTitle: { type: String, trim: true },
  phone: { type: String, trim: true },
  alternatePhone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  telegram: { type: String, trim: true },
  region: { type: String, trim: true },
  district: { type: String, trim: true },
  currentAddress: { type: String, trim: true },
  permanentAddress: { type: String, trim: true },
  birthDate: Date,
  emergencyContactName: { type: String, trim: true },
  emergencyContactPhone: { type: String, trim: true },
  researchInterests: { type: String, trim: true },
  orcid: { type: String, trim: true },
  scholarUrl: { type: String, trim: true },
  secondaryEmail: { type: String, trim: true, lowercase: true },
  linkedinUrl: { type: String, trim: true },
  previousUniversity: { type: String, trim: true },
  bachelorSpecialty: { type: String, trim: true },
  languages: { type: String, trim: true },
  employmentStatus: { type: String, enum: ['not_working','working','self_employed','other'], default: 'not_working' },
  employer: { type: String, trim: true },
  jobTitle: { type: String, trim: true },
  emergencyContactRelation: { type: String, trim: true },
  profileCompleteness: { type: Number, min: 0, max: 100, default: 0 },
  profileUpdatedAt: Date,
  academicScore: { type: Number, min: 0, max: 100, default: 0 },
  attendance: { type: Number, min: 0, max: 100, default: 100 },
  individualPlan: { type: Number, min: 0, max: 100, default: 0 },
  dissertationProgress: { type: Number, min: 0, max: 100, default: 0 },
  scientificActivity: { type: Number, min: 0, max: 100, default: 0 },
  academicDebtCount: { type: Number, min: 0, default: 0 },
  documentsCompleteness: { type: Number, min: 0, max: 100, default: 0 },
  graduationReadiness: { type: Number, min: 0, max: 100, default: 0 },
  dissertationStage: { type: Number, min: 1, max: 12, default: 1 },
  status: { type: String, enum: ['green', 'yellow', 'red'], default: 'yellow', index: true },
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

studentSchema.methods.recalculateProfileCompleteness = function() {
  const fields = ['phone','email','telegram','region','district','currentAddress','birthDate','researchInterests','previousUniversity','bachelorSpecialty','languages'];
  const filled = fields.filter(k => { const v = this[k]; return v !== undefined && v !== null && String(v).trim() !== ''; }).length;
  this.profileCompleteness = Math.round(filled / fields.length * 100);
  return this.profileCompleteness;
};

studentSchema.methods.recalculateStatus = function() {
  const avg = (this.attendance + this.individualPlan + this.dissertationProgress + this.academicScore + this.scientificActivity + this.documentsCompleteness) / 6;
  this.graduationReadiness = Math.round((this.individualPlan + this.dissertationProgress + this.documentsCompleteness + this.academicScore) / 4);
  this.recalculateProfileCompleteness();
  if (this.attendance < 65 || this.dissertationProgress < 45 || Number(this.academicDebtCount || 0) >= 2) this.status = 'red';
  else this.status = avg >= 80 ? 'green' : avg >= 60 ? 'yellow' : 'red';
};

module.exports = mongoose.model('Student', studentSchema);

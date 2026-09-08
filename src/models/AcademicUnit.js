const mongoose = require('mongoose');

const academicUnitSchema = new mongoose.Schema({
  level: { type:String, enum:['faculty','department','specialty','group'], required:true, index:true },
  name: { type:String, required:true, trim:true },
  parent: { type:mongoose.Schema.Types.ObjectId, ref:'AcademicUnit', default:null, index:true },
  active: { type:Boolean, default:true, index:true },
  course: { type:Number, min:1, max:3, default:1 },
  admissionYear: { type:Number, min:2000, max:2100 },
  educationForm: { type:String, default:'Magistratura', trim:true },
  defaultSupervisor: { type:mongoose.Schema.Types.ObjectId, ref:'User' },
  createdBy: { type:mongoose.Schema.Types.ObjectId, ref:'User' }
}, { timestamps:true });

academicUnitSchema.index({ level:1, parent:1, name:1 }, { unique:true });
module.exports = mongoose.model('AcademicUnit', academicUnitSchema);

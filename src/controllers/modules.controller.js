const Student = require('../models/Student');
const User = require('../models/User');
const Seminar = require('../models/Seminar');
const ScientificActivity = require('../models/ScientificActivity');
const DocumentRecord = require('../models/DocumentRecord');
const Task = require('../models/Task');
const { scopeQueryForUser } = require('../middleware/auth');
const audit = require('../services/audit');

async function scopedStudents(user) {
  return Student.find(scopeQueryForUser(user, {})).select('fullName group faculty department specialty supervisor').sort({ fullName: 1 }).lean();
}
function orgFilter(user) {
  if (user.role === 'dean') return { faculty: user.faculty };
  if (['department','teacher','supervisor'].includes(user.role)) return { department: user.department };
  return {};
}

exports.seminars = async (req, res, next) => {
  try {
    let filter = orgFilter(req.user);
    if (req.user.role === 'student') {
      const mine = await Student.findOne(scopeQueryForUser(req.user, {})).lean();
      filter = mine?.department ? { department: mine.department } : mine?.faculty ? { faculty: mine.faculty } : { _id: null };
    }
    if (req.user.role === 'supervisor' && req.user.department) filter = { department: req.user.department };
    const seminars = await Seminar.find(filter).populate('responsible','fullName role').sort({ date: -1 }).lean();
    const uq={ active:true, role:{ $in:['magistracy','dean','department','supervisor','teacher'] } };
    if(req.user.role==='dean') uq.faculty=req.user.faculty;
    if(['department','teacher','supervisor'].includes(req.user.role)&&req.user.department) uq.department=req.user.department;
    const users = await User.find(uq).select('fullName role faculty department').sort({fullName:1}).lean();
    res.render('modules/seminars', { title:'Seminarlar monitoringi', seminars, users });
  } catch(e){ next(e); }
};
exports.createSeminar = async (req,res,next) => {
  try {
    const body = { ...req.body };
    if (req.user.role === 'dean') body.faculty = req.user.faculty;
    if (['department','teacher','supervisor'].includes(req.user.role)) { body.faculty = req.user.faculty; body.department = req.user.department; }
    const item = await Seminar.create({
      title:body.title,date:body.date,faculty:body.faculty,department:body.department,
      responsible:body.responsible||undefined,participantCount:Number(body.participantCount||0),
      status:body.status||'planned',minutesUploaded:body.minutesUploaded==='on',materialsUploaded:body.materialsUploaded==='on',photoUploaded:body.photoUploaded==='on',
      result:body.result,notes:body.notes,createdBy:req.user._id
    });
    await audit(req,'SEMINAR_CREATED','Seminar',item._id,{title:item.title});
    res.redirect('/seminars');
  } catch(e){ next(e); }
};
exports.updateSeminar = async (req,res,next) => {
  try {
    const item = await Seminar.findById(req.params.id);
    if (!item) return res.status(404).render('errors/404',{title:'Seminar topilmadi'});
    const filter=orgFilter(req.user);
    if (filter.faculty && item.faculty!==filter.faculty) return res.status(403).render('errors/403',{title:'Ruxsat yo‘q'});
    if (filter.department && item.department!==filter.department) return res.status(403).render('errors/403',{title:'Ruxsat yo‘q'});
    ['status','result','notes'].forEach(k=>{ if(req.body[k]!==undefined)item[k]=req.body[k]; });
    item.minutesUploaded=req.body.minutesUploaded==='on'; item.materialsUploaded=req.body.materialsUploaded==='on'; item.photoUploaded=req.body.photoUploaded==='on';
    await item.save(); await audit(req,'SEMINAR_UPDATED','Seminar',item._id,{status:item.status});
    res.redirect('/seminars');
  } catch(e){next(e);}
};

exports.science = async (req,res,next) => {
  try {
    const students=await scopedStudents(req.user); const ids=students.map(s=>s._id);
    const activities=await ScientificActivity.find({student:{$in:ids}}).populate('student','fullName group specialty').sort({date:-1,createdAt:-1}).lean();
    res.render('modules/science',{title:'Ilmiy faoliyat',students,activities});
  }catch(e){next(e);}
};
exports.createScience = async (req,res,next) => {
  try {
    const student=await Student.findOne(scopeQueryForUser(req.user,{_id:req.body.student}));
    if(!student)return res.status(403).render('errors/403',{title:'Ruxsat yo‘q'});
    const ownSubmission=req.user.role==='student';
    const item=await ScientificActivity.create({student:student._id,type:req.body.type,title:req.body.title,organization:req.body.organization,date:req.body.date||undefined,status:ownSubmission?'submitted':(req.body.status||'planned'),score:ownSubmission?0:Number(req.body.score||0),link:req.body.link,notes:req.body.notes,createdBy:req.user._id});
    const rows=await ScientificActivity.find({student:student._id}).lean();
    const score=rows.length?Math.min(100,Math.round(rows.reduce((n,x)=>n+Number(x.score||0),0)/rows.length)):0;
    student.scientificActivity=score; student.recalculateStatus(); await student.save();
    await audit(req,'SCIENCE_ACTIVITY_CREATED','ScientificActivity',item._id,{type:item.type});
    res.redirect('/science');
  }catch(e){next(e);}
};

exports.updateScience=async(req,res,next)=>{
  try{
    const item=await ScientificActivity.findById(req.params.id); if(!item)return res.status(404).render('errors/404',{title:'Ilmiy faoliyat topilmadi'});
    const student=await Student.findOne(scopeQueryForUser(req.user,{_id:item.student}));
    if(!student&&!['superadmin','tech','management','magistracy'].includes(req.user.role))return res.status(403).render('errors/403',{title:'Ruxsat yo‘q'});
    if(req.body.status)item.status=req.body.status; if(req.body.score!==undefined)item.score=Math.max(0,Math.min(100,Number(req.body.score||0))); if(req.body.notes!==undefined)item.notes=req.body.notes;
    await item.save(); const rows=await ScientificActivity.find({student:item.student}).lean(); const score=rows.length?Math.min(100,Math.round(rows.reduce((n,x)=>n+Number(x.score||0),0)/rows.length)):0;
    const st=student||await Student.findById(item.student); if(st){st.scientificActivity=score;st.recalculateStatus();await st.save();}
    await audit(req,'SCIENCE_ACTIVITY_UPDATED','ScientificActivity',item._id,{status:item.status});res.redirect('/science');
  }catch(e){next(e);}
};

exports.documents = async (req,res,next) => {
  try{
    const students=await scopedStudents(req.user); const ids=students.map(s=>s._id);
    const documents=await DocumentRecord.find({student:{$in:ids}}).populate('student','fullName group').populate('upload','originalName path').sort({updatedAt:-1}).lean();
    res.render('modules/documents',{title:'Hujjatlar monitoringi',students,documents});
  }catch(e){next(e);}
};
exports.saveDocument = async(req,res,next)=>{
  try{
    const student=await Student.findOne(scopeQueryForUser(req.user,{_id:req.body.student}));
    if(!student)return res.status(403).render('errors/403',{title:'Ruxsat yo‘q'});
    const item=await DocumentRecord.findOneAndUpdate({student:student._id,type:req.body.type},{student:student._id,type:req.body.type,title:req.body.title||req.body.type,status:req.body.status||'missing',issueDate:req.body.issueDate||undefined,expiresAt:req.body.expiresAt||undefined,notes:req.body.notes,updatedBy:req.user._id},{upsert:true,new:true,setDefaultsOnInsert:true});
    const docs=await DocumentRecord.find({student:student._id}).lean();
    const required=['individual_plan','dissertation_topic','supervisor_info','seminar_minutes','report','publication','conference','attestation','defense'];
    const ok=docs.filter(d=>required.includes(d.type)&&d.status==='present').length;
    student.documentsCompleteness=Math.round(ok/required.length*100); student.recalculateStatus(); await student.save();
    await audit(req,'DOCUMENT_STATUS_UPDATED','DocumentRecord',item._id,{type:item.type,status:item.status});
    res.redirect('/documents');
  }catch(e){next(e);}
};

exports.tasks=async(req,res,next)=>{
  try{
    const students=await scopedStudents(req.user); const ids=students.map(s=>s._id); const filter=orgFilter(req.user);
    let q={ $or:[{student:{$in:ids}}, ...(Object.keys(filter).length?[filter]:[]), {assignedTo:req.user._id}] };
    if(req.user.role==='student') q={student:{$in:ids}};
    if(req.user.role==='supervisor') q={$or:[{student:{$in:ids}},{assignedTo:req.user._id}]};
    const tasks=await Task.find(q).populate('student','fullName group').populate('assignedTo','fullName role').populate('createdBy','fullName').sort({status:1,dueDate:1,createdAt:-1}).lean();
    const aq={active:true,role:{$in:['magistracy','dean','department','supervisor','teacher','student']}};
    if(req.user.role==='dean')aq.faculty=req.user.faculty;
    if(['department','teacher','supervisor'].includes(req.user.role)&&req.user.department)aq.department=req.user.department;
    const assignees=await User.find(aq).select('fullName role faculty department').sort({fullName:1}).lean();
    res.render('modules/tasks',{title:'Muammolar va topshiriqlar',students,tasks,assignees});
  }catch(e){next(e);}
};
exports.createTask=async(req,res,next)=>{
  try{
    let student=null; if(req.body.student){student=await Student.findOne(scopeQueryForUser(req.user,{_id:req.body.student})); if(!student)return res.status(403).render('errors/403',{title:'Ruxsat yo‘q'});}
    const item=await Task.create({title:req.body.title,description:req.body.description,type:req.body.type||'other',priority:req.body.priority||'medium',student:student?._id,faculty:student?.faculty||req.body.faculty||req.user.faculty,department:student?.department||req.body.department||req.user.department,assignedTo:req.body.assignedTo||undefined,dueDate:req.body.dueDate||undefined,createdBy:req.user._id});
    await audit(req,'TASK_CREATED','Task',item._id,{priority:item.priority}); res.redirect('/tasks');
  }catch(e){next(e);}
};
exports.updateTask=async(req,res,next)=>{
  try{
    const item=await Task.findById(req.params.id); if(!item)return res.status(404).render('errors/404',{title:'Topshiriq topilmadi'});
    let allowed=['superadmin','tech','management','magistracy'].includes(req.user.role);
    if(!allowed && item.student){ allowed=!!(await Student.exists(scopeQueryForUser(req.user,{_id:item.student}))); }
    if(!allowed && String(item.assignedTo||'')===String(req.user._id)) allowed=true;
    if(!allowed && req.user.role==='dean' && item.faculty===req.user.faculty) allowed=true;
    if(!allowed && ['department','teacher'].includes(req.user.role) && item.department===req.user.department) allowed=true;
    if(!allowed)return res.status(403).render('errors/403',{title:'Ruxsat yo‘q'});
    if(req.body.status)item.status=req.body.status; if(req.body.resolution!==undefined)item.resolution=req.body.resolution;
    if(item.status==='resolved')item.resolvedAt=new Date(); await item.save();
    await audit(req,'TASK_UPDATED','Task',item._id,{status:item.status}); res.redirect('/tasks');
  }catch(e){next(e);}
};

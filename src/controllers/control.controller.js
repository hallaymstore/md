const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Student = require('../models/Student');
const Upload = require('../models/Upload');
const MonitoringItem = require('../models/MonitoringItem');
const Task = require('../models/Task');
const Seminar = require('../models/Seminar');
const ScientificActivity = require('../models/ScientificActivity');
const DocumentRecord = require('../models/DocumentRecord');
const AuditLog = require('../models/AuditLog');
const AcademicStructure = require('../models/AcademicStructure');
const AcademicUnit = require('../models/AcademicUnit');
const SubmissionApplication = require('../models/SubmissionApplication');
const audit = require('../services/audit');

const ENTITY = {
  task: { Model:Task, label:'Topshiriq', title:'title', fields:['title','description','type','priority','status','dueDate','resolution'] },
  seminar: { Model:Seminar, label:'Seminar', title:'title', fields:['title','date','faculty','department','participantCount','status','minutesUploaded','materialsUploaded','photoUploaded','result','notes'] },
  science: { Model:ScientificActivity, label:'Ilmiy faoliyat', title:'title', fields:['type','title','organization','date','status','score','link','notes'] },
  document: { Model:DocumentRecord, label:'Hujjat', title:'title', fields:['type','title','status','issueDate','expiresAt','notes'] },
  upload: { Model:Upload, label:'Fayl', title:'originalName', fields:['category','description','faculty','department'] },
  monitoring: { Model:MonitoringItem, label:'Monitoring', title:'title', fields:['type','title','planned','completed','percent','dueDate','status','comment'] }
};
const DATE_FIELDS=new Set(['date','dueDate','issueDate','expiresAt']);
const NUMBER_FIELDS=new Set(['participantCount','score','planned','completed','percent']);
const BOOL_FIELDS=new Set(['minutesUploaded','materialsUploaded','photoUploaded']);
const ENUMS={
  type:{task:['attendance','plan','dissertation','seminar','document','academic','publication','conference','research','other'],science:['publication','conference','research','seminar'],document:['individual_plan','dissertation_topic','supervisor_info','seminar_minutes','report','publication','conference','attestation','defense','other'],monitoring:['attendance','plan','dissertation','seminar','publication','conference','research','document','academic','supervision']},
  priority:{task:['low','medium','high','critical']},
  status:{task:['new','in_progress','resolved','cancelled'],seminar:['planned','held','cancelled'],science:['planned','submitted','accepted','published','completed'],document:['present','update','missing'],monitoring:['green','yellow','red']},
  category:{upload:['source','document','seminar','report','publication','conference','attestation','defense','protocol','thesis','other']}
};
const clean=v=>String(v??'').trim();
const rx=v=>new RegExp(String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');

async function counts(){
  const now=new Date(); const day=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const [users,activeUsers,students,redStudents,uploads,tasks,openTasks,seminars,science,documents,monitoring,structures,academicUnits,submissions,pendingSubmissions,auditToday]=await Promise.all([
    User.countDocuments(),User.countDocuments({active:true}),Student.countDocuments(),Student.countDocuments({status:'red'}),Upload.countDocuments(),Task.countDocuments(),Task.countDocuments({status:{$in:['new','in_progress']}}),Seminar.countDocuments(),ScientificActivity.countDocuments(),DocumentRecord.countDocuments(),MonitoringItem.countDocuments(),AcademicStructure.countDocuments(),AcademicUnit.countDocuments(),SubmissionApplication.countDocuments(),SubmissionApplication.countDocuments({status:'in_review'}),AuditLog.countDocuments({createdAt:{$gte:day}})
  ]);
  return {users,activeUsers,students,redStudents,uploads,tasks,openTasks,seminars,science,documents,monitoring,structures,academicUnits,submissions,pendingSubmissions,auditToday};
}

async function searchAll(q,user){
  if(!q)return [];
  const re=rx(q);
  const [users,students,tasks,seminars,science,documents,uploads,monitoring,submissions]=await Promise.all([
    User.find(user?.role==='tech'?{$or:[{fullName:re},{email:re},{phone:re},{$and:[{role:{$nin:['superadmin','management']}},{login:re}]}]}:{$or:[{fullName:re},{login:re},{email:re},{phone:re}]}).select('fullName login role active').limit(12).lean(),
    Student.find({$or:[{fullName:re},{studentId:re},{faculty:re},{department:re},{group:re},{specialty:re},{phone:re},{email:re}]}).select('fullName studentId faculty group status').limit(15).lean(),
    Task.find({$or:[{title:re},{description:re},{faculty:re},{department:re}]}).select('title status priority dueDate').limit(10).lean(),
    Seminar.find({$or:[{title:re},{faculty:re},{department:re},{result:re}]}).select('title status date faculty department').limit(10).lean(),
    ScientificActivity.find({$or:[{title:re},{organization:re},{link:re}]}).select('title type status date').limit(10).lean(),
    DocumentRecord.find({$or:[{title:re},{notes:re}]}).select('title type status').limit(10).lean(),
    Upload.find({$or:[{originalName:re},{description:re},{faculty:re},{department:re}]}).select('originalName category createdAt').limit(10).lean(),
    MonitoringItem.find({$or:[{title:re},{comment:re}]}).select('title type status percent').limit(10).lean(),
    SubmissionApplication.find({$or:[{title:re},{description:re},{faculty:re},{department:re},{group:re}]}).select('title type status currentStage revision').limit(12).lean()
  ]);
  const out=[];
  users.forEach(x=>out.push({entity:'user',id:x._id,title:x.fullName,meta:`${x.role} · ${x.active?'faol':'blok'}`,href:`/users/${x._id}/edit`}));
  students.forEach(x=>out.push({entity:'student',id:x._id,title:x.fullName,meta:`${x.studentId||'ID yo‘q'} · ${x.faculty||'—'} · ${x.group||'—'}`,href:`/students/${x._id}`}));
  for(const [type,rows] of Object.entries({task:tasks,seminar:seminars,science,document:documents,upload:uploads,monitoring})) rows.forEach(x=>out.push({entity:type,id:x._id,title:x.title||x.originalName,meta:`${x.status||x.category||x.type||''}`,href:`/control/${type}/${x._id}`}));
  submissions.forEach(x=>out.push({entity:'submission',id:x._id,title:x.title,meta:`${x.status} · ${x.currentStage} · rev.${x.revision}`,href:`/submissions/${x._id}`}));
  return out;
}

exports.index=async(req,res,next)=>{
  try{
    const q=clean(req.query.q);
    const [stats,recentAudit,recentStudents,recentUploads,results]=await Promise.all([
      counts(),
      AuditLog.find({}).populate('actor','fullName role').sort({createdAt:-1}).limit(25).lean(),
      Student.find({}).sort({updatedAt:-1}).select('fullName faculty department group status profileCompleteness updatedAt').limit(12).lean(),
      Upload.find({}).populate('uploadedBy','fullName').sort({createdAt:-1}).limit(10).lean(),
      searchAll(q,req.user)
    ]);
    const quality={
      noSupervisor:await Student.countDocuments({$or:[{supervisor:null},{supervisor:{$exists:false}}]}),
      noPhone:await Student.countDocuments({$or:[{phone:''},{phone:null},{phone:{$exists:false}}]}),
      noEmail:await Student.countDocuments({$or:[{email:''},{email:null},{email:{$exists:false}}]}),
      lowProfile:await Student.countDocuments({profileCompleteness:{$lt:50}}),
      noDissertation:await Student.countDocuments({$or:[{dissertationTitle:''},{dissertationTitle:null},{dissertationTitle:{$exists:false}}]}),
      missingDocs:await DocumentRecord.countDocuments({status:'missing'})
    };
    res.render('control/index',{title:req.user.role==='superadmin'?'Bosh administrator markazi':'Texnik boshqaruv markazi',stats,recentAudit,recentStudents,recentUploads,quality,q,results,isSuperadmin:req.user.role==='superadmin'});
  }catch(e){next(e);}
};

exports.editor=async(req,res,next)=>{
  try{
    if(!['superadmin','tech'].includes(req.user.role))return res.status(403).render('errors/403',{title:'Ruxsat yo‘q'});
    const cfg=ENTITY[req.params.entity]; if(!cfg)return res.status(404).render('errors/404',{title:'Ma’lumot turi topilmadi'});
    const item=await cfg.Model.findById(req.params.id).lean(); if(!item)return res.status(404).render('errors/404',{title:'Yozuv topilmadi'});
    const fields=cfg.fields.map(name=>({name,value:item[name],kind:BOOL_FIELDS.has(name)?'boolean':DATE_FIELDS.has(name)?'date':NUMBER_FIELDS.has(name)?'number':ENUMS[name]?.[req.params.entity]?'select':(['description','notes','comment','result','resolution'].includes(name)?'textarea':'text'),options:ENUMS[name]?.[req.params.entity]||[]}));
    res.render('control/editor',{title:`${cfg.label} — tahrirlash`,entity:req.params.entity,item,cfg,fields});
  }catch(e){next(e);}
};

exports.update=async(req,res,next)=>{
  try{
    if(!['superadmin','tech'].includes(req.user.role))return res.status(403).render('errors/403',{title:'Ruxsat yo‘q'});
    const cfg=ENTITY[req.params.entity]; if(!cfg)return res.status(404).render('errors/404',{title:'Ma’lumot turi topilmadi'});
    const item=await cfg.Model.findById(req.params.id); if(!item)return res.status(404).render('errors/404',{title:'Yozuv topilmadi'});
    cfg.fields.forEach(k=>{
      if(BOOL_FIELDS.has(k)) item[k]=req.body[k]==='on';
      else if(req.body[k]!==undefined){
        if(DATE_FIELDS.has(k)) item[k]=req.body[k]?new Date(req.body[k]):undefined;
        else if(NUMBER_FIELDS.has(k)) item[k]=Number(req.body[k]||0);
        else item[k]=clean(req.body[k]);
      }
    });
    await item.save();
    if(req.params.entity==='science'&&item.student){
      const rows=await ScientificActivity.find({student:item.student}).lean(); const score=rows.length?Math.min(100,Math.round(rows.reduce((n,x)=>n+Number(x.score||0),0)/rows.length)):0;
      const st=await Student.findById(item.student); if(st){st.scientificActivity=score;st.recalculateStatus();await st.save();}
    }
    if(req.params.entity==='document'&&item.student){
      const docs=await DocumentRecord.find({student:item.student}).lean(); const required=['individual_plan','dissertation_topic','supervisor_info','seminar_minutes','report','publication','conference','attestation','defense']; const ok=docs.filter(d=>required.includes(d.type)&&d.status==='present').length;
      const st=await Student.findById(item.student); if(st){st.documentsCompleteness=Math.round(ok/required.length*100);st.recalculateStatus();await st.save();}
    }
    await audit(req,'ADMIN_ENTITY_UPDATED',cfg.label,item._id,{entity:req.params.entity});
    req.session.flash={type:'success',text:`${cfg.label} yozuvi yangilandi.`}; res.redirect(`/control/${req.params.entity}/${item._id}`);
  }catch(e){next(e);}
};

exports.remove=async(req,res,next)=>{
  try{
    if(!['superadmin','tech'].includes(req.user.role))return res.status(403).render('errors/403',{title:'Ruxsat yo‘q'});
    const entity=req.params.entity;
    if(entity==='student'){
      const student=await Student.findById(req.params.id); if(!student)return res.redirect('/control');
      await Promise.all([MonitoringItem.deleteMany({student:student._id}),Task.deleteMany({student:student._id}),ScientificActivity.deleteMany({student:student._id}),DocumentRecord.deleteMany({student:student._id}),SubmissionApplication.deleteMany({student:student._id})]);
      const uploads=await Upload.find({student:student._id});
      for(const u of uploads){if(u.storedName){const fp=path.join(__dirname,'../../public/uploads',u.storedName);try{fs.unlinkSync(fp)}catch(_){}}}
      await Upload.deleteMany({student:student._id}); await student.deleteOne();
      await audit(req,'ADMIN_STUDENT_DELETED','Student',req.params.id,{cascade:true});
      req.session.flash={type:'success',text:'Magistrant va unga bog‘langan monitoring/hujjat yozuvlari o‘chirildi.'};return res.redirect('/control');
    }
    const cfg=ENTITY[entity]; if(!cfg)return res.status(404).render('errors/404',{title:'Ma’lumot turi topilmadi'});
    const item=await cfg.Model.findById(req.params.id); if(!item)return res.redirect('/control');
    const relatedStudent=item.student;
    if(entity==='upload'&&item.storedName){const fp=path.join(__dirname,'../../public/uploads',item.storedName);try{fs.unlinkSync(fp)}catch(_){} await DocumentRecord.updateMany({upload:item._id},{$unset:{upload:1}});}
    await item.deleteOne();
    if(entity==='science'&&relatedStudent){const rows=await ScientificActivity.find({student:relatedStudent}).lean();const score=rows.length?Math.min(100,Math.round(rows.reduce((n,x)=>n+Number(x.score||0),0)/rows.length)):0;const st=await Student.findById(relatedStudent);if(st){st.scientificActivity=score;st.recalculateStatus();await st.save();}}
    if(entity==='document'&&relatedStudent){const docs=await DocumentRecord.find({student:relatedStudent}).lean();const required=['individual_plan','dissertation_topic','supervisor_info','seminar_minutes','report','publication','conference','attestation','defense'];const ok=docs.filter(d=>required.includes(d.type)&&d.status==='present').length;const st=await Student.findById(relatedStudent);if(st){st.documentsCompleteness=Math.round(ok/required.length*100);st.recalculateStatus();await st.save();}}
    await audit(req,'ADMIN_ENTITY_DELETED',cfg.label,req.params.id,{entity});
    req.session.flash={type:'success',text:`${cfg.label} yozuvi o‘chirildi.`};res.redirect('/control');
  }catch(e){next(e);}
};

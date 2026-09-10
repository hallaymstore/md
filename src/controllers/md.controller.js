const Student = require('../models/Student');
const User = require('../models/User');
const Task = require('../models/Task');
const DissertationMilestone = require('../models/DissertationMilestone');
const ResearchSubmission = require('../models/ResearchSubmission');
const DocumentRecord = require('../models/DocumentRecord');
const ScientificActivity = require('../models/ScientificActivity');
const GraduationCheck = require('../models/GraduationCheck');
const ProgressSnapshot = require('../models/ProgressSnapshot');
const { scopeQueryForUser } = require('../middleware/auth');
const audit = require('../services/audit');

const DAY = 86400000;
const todayKey = () => new Date().toISOString().slice(0,10);
const editors = ['superadmin','tech','management','magistracy','dean','department','supervisor','teacher'];

async function scopedStudents(user) {
  return Student.find(scopeQueryForUser(user, {})).populate('supervisor','fullName role avatarPath').sort({group:1,fullName:1}).lean();
}
function taskScope(user, ids) {
  if (user.role === 'student') return { student: { $in: ids } };
  if (user.role === 'supervisor') return { $or:[{ student:{ $in:ids } },{ assignedTo:user._id }] };
  if (user.role === 'dean') return { $or:[{ student:{ $in:ids } },{ faculty:user.faculty }] };
  if (['department','teacher'].includes(user.role)) return { $or:[{ student:{ $in:ids } },{ department:user.department },{ assignedTo:user._id }] };
  return {};
}
function escalation(dueDate, status) {
  if (!dueDate || ['resolved','cancelled'].includes(status)) return {level:0,label:'Nazoratda'};
  const days = Math.floor((Date.now() - new Date(dueDate).getTime()) / DAY);
  if (days < 0) return {level:0,label:'Muddat ichida'};
  if (days <= 2) return {level:1,label:'Mas’ul eslatmasi'};
  if (days <= 6) return {level:2,label:'Kuchaytirilgan nazorat'};
  return {level:3,label:'Rahbariyat nazorati'};
}

exports.advantages = async (req,res,next) => {
  try { res.render('md/advantages',{title:'MD imkoniyatlari'}); } catch(e){next(e);}
};

exports.deadlines = async (req,res,next) => {
  try {
    const students = await scopedStudents(req.user); const ids=students.map(s=>s._id);
    const tq=taskScope(req.user,ids);
    const [tasks,milestones,submissions,documents] = await Promise.all([
      Task.find(tq).populate('student','fullName group').populate('assignedTo','fullName role').lean(),
      DissertationMilestone.find({student:{$in:ids},dueDate:{$ne:null}}).populate('student','fullName group').lean(),
      ResearchSubmission.find({student:{$in:ids},targetDate:{$ne:null},status:{$nin:['approved','rejected','withdrawn','archived']}}).populate('student','fullName group').lean(),
      DocumentRecord.find({student:{$in:ids},expiresAt:{$ne:null}}).populate('student','fullName group').lean()
    ]);
    const items=[];
    tasks.filter(x=>!['resolved','cancelled'].includes(x.status) && x.dueDate).forEach(x=>items.push({kind:'Topshiriq',title:x.title,student:x.student,dueDate:x.dueDate,status:x.status,url:'/tasks',...escalation(x.dueDate,x.status)}));
    milestones.filter(x=>x.status!=='approved').forEach(x=>items.push({kind:'Dissertatsiya',title:`${x.stage}-bosqich: ${x.title}`,student:x.student,dueDate:x.dueDate,status:x.status,url:`/milestones?student=${x.student?._id||''}`,...escalation(x.dueDate,x.status)}));
    submissions.forEach(x=>items.push({kind:'Ilmiy ariza',title:x.title,student:x.student,dueDate:x.targetDate,status:x.status,url:`/submissions/${x._id}`,...escalation(x.targetDate,x.status)}));
    documents.forEach(x=>items.push({kind:'Hujjat',title:x.title||x.type,student:x.student,dueDate:x.expiresAt,status:x.status,url:'/documents',...escalation(x.expiresAt,x.status)}));
    items.sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
    const now=new Date(); const in7=new Date(Date.now()+7*DAY); const in30=new Date(Date.now()+30*DAY);
    res.render('md/deadlines',{title:'Muddatlar markazi',items,counts:{overdue:items.filter(x=>new Date(x.dueDate)<now).length,week:items.filter(x=>new Date(x.dueDate)>=now&&new Date(x.dueDate)<=in7).length,month:items.filter(x=>new Date(x.dueDate)>=now&&new Date(x.dueDate)<=in30).length,escalated:items.filter(x=>x.level>=2).length}});
  } catch(e){next(e);}
};

exports.interventions = async(req,res,next)=>{
  try{
    const students=await scopedStudents(req.user); const ids=students.map(s=>s._id);
    const tasks=await Task.find(taskScope(req.user,ids)).populate('student','fullName group status attendance individualPlan dissertationProgress').populate('assignedTo','fullName role avatarPath').populate('createdBy','fullName').sort({status:1,dueDate:1,createdAt:-1}).lean();
    const aq={active:true,role:{$in:['magistracy','dean','department','supervisor','teacher']}};
    if(req.user.role==='dean')aq.faculty=req.user.faculty;
    if(['department','teacher','supervisor'].includes(req.user.role)&&req.user.department)aq.department=req.user.department;
    const assignees=await User.find(aq).select('fullName role faculty department').sort({fullName:1}).lean();
    const enriched=tasks.map(t=>({...t,escalation:escalation(t.dueDate,t.status)}));
    res.render('md/interventions',{title:'Muammo va chora',students,tasks:enriched,assignees,canEdit:editors.includes(req.user.role)});
  }catch(e){next(e);}
};

exports.createIntervention=async(req,res,next)=>{
  try{
    let student=null;
    if(req.body.student){student=await Student.findOne(scopeQueryForUser(req.user,{_id:req.body.student})); if(!student)return res.status(403).render('errors/403',{title:'Ruxsat yo‘q'});}
    const item=await Task.create({
      title:req.body.title, description:req.body.description, issueReason:req.body.issueReason, actionPlan:req.body.actionPlan,
      expectedResult:req.body.expectedResult, type:req.body.type||'other', priority:req.body.priority||'medium', student:student?._id,
      faculty:student?.faculty||req.user.faculty, department:student?.department||req.user.department, assignedTo:req.body.assignedTo||undefined,
      dueDate:req.body.dueDate||undefined, followUpDate:req.body.followUpDate||undefined, createdBy:req.user._id
    });
    await audit(req,'INTERVENTION_CREATED','Task',item._id,{priority:item.priority});
    req.session.flash={type:'success',text:'Muammo va chora rejasi yaratildi.'}; res.redirect('/md/interventions');
  }catch(e){next(e);}
};

exports.updateIntervention=async(req,res,next)=>{
  try{
    const item=await Task.findById(req.params.id); if(!item)return res.status(404).render('errors/404',{title:'Yozuv topilmadi'});
    let allowed=['superadmin','tech','management','magistracy'].includes(req.user.role) || String(item.assignedTo||'')===String(req.user._id);
    if(!allowed&&item.student) allowed=!!(await Student.exists(scopeQueryForUser(req.user,{_id:item.student})));
    if(!allowed)return res.status(403).render('errors/403',{title:'Ruxsat yo‘q'});
    ['status','resolution','outcome','actionPlan','expectedResult'].forEach(k=>{if(req.body[k]!==undefined)item[k]=req.body[k]});
    if(req.body.followUpDate!==undefined)item.followUpDate=req.body.followUpDate||null;
    const esc=escalation(item.dueDate,item.status); item.escalationLevel=esc.level;
    if(item.status==='resolved')item.resolvedAt=new Date();
    await item.save(); await audit(req,'INTERVENTION_UPDATED','Task',item._id,{status:item.status,escalation:item.escalationLevel});
    req.session.flash={type:'success',text:'Chora holati yangilandi.'}; res.redirect('/md/interventions');
  }catch(e){next(e);}
};

const checks=[
  ['topic','Dissertatsiya mavzusi'],['supervisor','Ilmiy rahbar'],['plan','Individual reja'],['academic','Akademik qarzdorlik yo‘q'],
  ['publication','Ilmiy maqola'],['conference','Konferensiya ishtiroki'],['documents','Hujjatlar to‘liqligi'],['dissertation','Dissertatsiya tayyorligi'],
  ['predefense','Dastlabki himoya bosqichi'],['defense','Yakuniy himoya']
];
async function autoChecks(student){
  const [science,milestones]=await Promise.all([ScientificActivity.find({student:student._id}).lean(),DissertationMilestone.find({student:student._id}).lean()]);
  const has=(type)=>science.some(x=>x.type===type&&['accepted','published','completed'].includes(x.status));
  const stage=(n)=>milestones.find(x=>x.stage===n&&x.status==='approved');
  return {topic:!!student.dissertationTitle,supervisor:!!student.supervisor,plan:Number(student.individualPlan)>=90,academic:Number(student.academicDebtCount||0)===0,publication:has('publication'),conference:has('conference'),documents:Number(student.documentsCompleteness)>=90,dissertation:Number(student.dissertationProgress)>=90,predefense:!!stage(11),defense:!!stage(12)};
}
exports.graduation=async(req,res,next)=>{
  try{
    const students=await scopedStudents(req.user); const id=String(req.query.student||(req.user.role==='student'?students[0]?._id:'')||''); const selected=students.find(s=>String(s._id)===id)||students[0]||null;
    let rows=[]; let readiness=0;
    if(selected){const [manual,auto]=await Promise.all([GraduationCheck.find({student:selected._id}).lean(),autoChecks(selected)]); const map=new Map(manual.map(x=>[x.key,x])); rows=checks.map(([key,label])=>{const m=map.get(key); const done=m?.status==='done'||m?.status==='not_required'||(m?.status!=='pending'&&auto[key]); return {key,label,done,status:m?.status||'auto',note:m?.note||'',evidenceLink:m?.evidenceLink||'',automatic:!!auto[key]};}); readiness=Math.round(rows.filter(x=>x.done||x.status==='not_required').length/rows.length*100);}
    res.render('md/graduation',{title:'Bitiruvga tayyorlik',students,selected,rows,readiness,canEdit:['superadmin','tech','magistracy','dean','department','supervisor'].includes(req.user.role)});
  }catch(e){next(e);}
};
exports.saveGraduation=async(req,res,next)=>{
  try{
    const student=await Student.findOne(scopeQueryForUser(req.user,{_id:req.params.studentId})); if(!student)return res.status(404).render('errors/404',{title:'Magistrant topilmadi'});
    const key=String(req.params.key||''); if(!checks.some(x=>x[0]===key))return res.status(400).send('Noto‘g‘ri band');
    await GraduationCheck.findOneAndUpdate({student:student._id,key},{status:['auto','pending','done','not_required'].includes(req.body.status)?req.body.status:'auto',note:req.body.note||'',evidenceLink:req.body.evidenceLink||'',updatedBy:req.user._id},{upsert:true,new:true,setDefaultsOnInsert:true});
    await audit(req,'GRADUATION_CHECK_UPDATED','GraduationCheck',student._id,{key,status:req.body.status}); res.redirect(`/md/graduation?student=${student._id}`);
  }catch(e){next(e);}
};

exports.trends=async(req,res,next)=>{
  try{
    const students=await scopedStudents(req.user); const day=todayKey();
    await Promise.all(students.map(s=>ProgressSnapshot.findOneAndUpdate({student:s._id,day},{attendance:s.attendance,plan:s.individualPlan,dissertation:s.dissertationProgress,science:s.scientificActivity,documents:s.documentsCompleteness,readiness:s.graduationReadiness,status:s.status},{upsert:true,setDefaultsOnInsert:true})));
    const since=new Date(Date.now()-45*DAY);
    const snaps=await ProgressSnapshot.find({student:{$in:students.map(s=>s._id)},createdAt:{$gte:since}}).sort({day:1}).lean();
    const byDay=new Map(); snaps.forEach(x=>{if(!byDay.has(x.day))byDay.set(x.day,[]);byDay.get(x.day).push(x)});
    const avg=(arr,k)=>arr.length?Math.round(arr.reduce((n,x)=>n+Number(x[k]||0),0)/arr.length):0;
    const trend=[...byDay.entries()].map(([day,arr])=>({day,attendance:avg(arr,'attendance'),plan:avg(arr,'plan'),dissertation:avg(arr,'dissertation'),readiness:avg(arr,'readiness'),red:arr.filter(x=>x.status==='red').length}));
    const first=trend[0],last=trend.at(-1); const delta=first&&last?{attendance:last.attendance-first.attendance,plan:last.plan-first.plan,dissertation:last.dissertation-first.dissertation,readiness:last.readiness-first.readiness,red:last.red-first.red}:{attendance:0,plan:0,dissertation:0,readiness:0,red:0};
    res.render('md/trends',{title:'O‘zgarishlar dinamikasi',trend,delta,days:trend.length});
  }catch(e){next(e);}
};

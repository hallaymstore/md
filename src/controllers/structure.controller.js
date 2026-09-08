const AcademicStructure = require('../models/AcademicStructure');
const AcademicUnit = require('../models/AcademicUnit');
const Student = require('../models/Student');
const User = require('../models/User');
const Seminar = require('../models/Seminar');
const Task = require('../models/Task');
const Upload = require('../models/Upload');
const audit = require('../services/audit');

function normalize(v){ return String(v || '').trim().replace(/\s+/g, ' '); }
function expectedParentLevel(level){ return ({department:'faculty',specialty:'department',group:'specialty'})[level] || null; }
async function unitPath(unit){
  const chain=[]; let cur=unit;
  while(cur){ chain.unshift(cur); if(!cur.parent) break; cur=await AcademicUnit.findById(cur.parent); }
  const out={}; chain.forEach(x=>out[x.level]=x.name); return out;
}
async function syncGroupUnit(groupUnit){
  const path=await unitPath(groupUnit);
  if(!path.faculty||!path.department||!path.specialty||!path.group) return;
  await AcademicStructure.findOneAndUpdate(
    {faculty:path.faculty,department:path.department,specialty:path.specialty,group:path.group},
    {$set:{course:groupUnit.course||1,admissionYear:groupUnit.admissionYear,educationForm:groupUnit.educationForm||'Magistratura',defaultSupervisor:groupUnit.defaultSupervisor,active:groupUnit.active,createdBy:groupUnit.createdBy}},
    {upsert:true,new:true,setDefaultsOnInsert:true}
  );
}

function buildRenameQuery(level, body) {
  const oldValue = normalize(body.oldValue);
  if (!oldValue) return null;
  const q = {};
  if (level === 'faculty') q.faculty = oldValue;
  else if (level === 'department') { q.department = oldValue; if (normalize(body.faculty)) q.faculty = normalize(body.faculty); }
  else if (level === 'specialty') { q.specialty = oldValue; if (normalize(body.faculty)) q.faculty = normalize(body.faculty); if (normalize(body.department)) q.department = normalize(body.department); }
  else if (level === 'group') { q.group = oldValue; if (normalize(body.faculty)) q.faculty = normalize(body.faculty); if (normalize(body.department)) q.department = normalize(body.department); if (normalize(body.specialty)) q.specialty = normalize(body.specialty); }
  else return null;
  return q;
}

exports.index = async (req, res, next) => {
  try {
    const structures = await AcademicStructure.find({}).populate('defaultSupervisor','fullName').sort({faculty:1,department:1,specialty:1,group:1}).lean();
    const units = await AcademicUnit.find({}).populate('parent','name level').populate('defaultSupervisor','fullName').sort({level:1,name:1}).lean();
    const supervisors = await User.find({ role: { $in: ['supervisor','teacher'] }, active: true }).select('fullName faculty department').sort({fullName:1}).lean();
    const faculties = [...new Set(structures.map(x => x.faculty).filter(Boolean))].sort();
    const departments = [...new Set(structures.map(x => x.department).filter(Boolean))].sort();
    const specialties = [...new Set(structures.map(x => x.specialty).filter(Boolean))].sort();
    const groups = [...new Set(structures.map(x => x.group).filter(Boolean))].sort();
    const usage = await Student.aggregate([
      { $group: { _id: { faculty:'$faculty', department:'$department', specialty:'$specialty', group:'$group' }, count:{ $sum:1 } } }
    ]);
    const usageMap = Object.fromEntries(usage.map(x => [[x._id.faculty,x._id.department,x._id.specialty,x._id.group].join('||'),x.count]));
    res.render('structure/index', {
      title: 'Akademik nomlar va tuzilma', structures, units, supervisors, faculties, departments, specialties, groups, usageMap,
      canWriteMaster: req.user.role === 'superadmin'
    });
  } catch (e) { next(e); }
};

exports.createUnit = async (req,res,next) => {
  try{
    const level=normalize(req.body.level); const name=normalize(req.body.name); const parentId=req.body.parent||null;
    if(!['faculty','department','specialty','group'].includes(level)||!name){req.session.flash={type:'error',text:'Daraja va nom majburiy.'};return res.redirect('/structure');}
    let parent=null;
    const expected=expectedParentLevel(level);
    if(expected){ parent=await AcademicUnit.findById(parentId); if(!parent||parent.level!==expected){req.session.flash={type:'error',text:`${level} uchun to‘g‘ri ota daraja tanlang.`};return res.redirect('/structure');} }
    const unit=await AcademicUnit.create({level,name,parent:parent?parent._id:null,course:Number(req.body.course||1),admissionYear:req.body.admissionYear?Number(req.body.admissionYear):undefined,educationForm:normalize(req.body.educationForm)||'Magistratura',defaultSupervisor:req.body.defaultSupervisor||undefined,createdBy:req.user._id});
    if(level==='group') await syncGroupUnit(unit);
    await audit(req,'ACADEMIC_UNIT_CREATED','AcademicUnit',unit._id,{level,name});
    req.session.flash={type:'success',text:`${name} master katalogga qo‘shildi.`};res.redirect('/structure');
  }catch(e){if(e?.code===11000){req.session.flash={type:'warning',text:'Bu nom shu daraja va ota bo‘lim ichida allaqachon mavjud.'};return res.redirect('/structure');}next(e);}
};

exports.updateUnit = async (req,res,next) => {
  try{
    const unit=await AcademicUnit.findById(req.params.id); if(!unit)return res.status(404).render('errors/404',{title:'Akademik nom topilmadi'});
    const oldName=unit.name; const oldPath=await unitPath(unit); const nextName=normalize(req.body.name);
    if(!nextName){req.session.flash={type:'error',text:'Nom bo‘sh qolmaydi.'};return res.redirect('/structure');}
    unit.name=nextName;
    if(unit.level==='group'){unit.course=Number(req.body.course||unit.course||1);unit.admissionYear=req.body.admissionYear?Number(req.body.admissionYear):undefined;unit.educationForm=normalize(req.body.educationForm)||unit.educationForm;unit.defaultSupervisor=req.body.defaultSupervisor||undefined;}
    await unit.save();
    if(oldName!==nextName){
      const scope={}; if(oldPath.faculty&&unit.level!=='faculty')scope.faculty=oldPath.faculty;if(oldPath.department&&['specialty','group'].includes(unit.level))scope.department=oldPath.department;if(oldPath.specialty&&unit.level==='group')scope.specialty=oldPath.specialty;
      const field=unit.level==='faculty'?'faculty':unit.level==='department'?'department':unit.level==='specialty'?'specialty':'group';
      const q={...scope,[field]:oldName}; const set={[field]:nextName};
      await Promise.all([Student.updateMany(q,{$set:set}),User.updateMany(q,{$set:set}),Seminar.updateMany(q,{$set:set}),Task.updateMany(q,{$set:set}),Upload.updateMany(q,{$set:set}),AcademicStructure.updateMany(q,{$set:set})]);
    }
    if(unit.level==='group') await syncGroupUnit(unit);
    await audit(req,'ACADEMIC_UNIT_UPDATED','AcademicUnit',unit._id,{oldName,nextName});req.session.flash={type:'success',text:'Master nom yangilandi va bog‘langan yozuvlarga tarqatildi.'};res.redirect('/structure');
  }catch(e){if(e?.code===11000){req.session.flash={type:'warning',text:'Bunday nom allaqachon mavjud.'};return res.redirect('/structure');}next(e);}
};

exports.toggleUnit = async (req,res,next) => {
  try{const unit=await AcademicUnit.findById(req.params.id);if(!unit)return res.redirect('/structure');unit.active=!unit.active;await unit.save();if(unit.level==='group')await syncGroupUnit(unit);await audit(req,'ACADEMIC_UNIT_TOGGLED','AcademicUnit',unit._id,{active:unit.active});res.redirect('/structure');}catch(e){next(e);}
};

exports.removeUnit = async (req,res,next) => {
  try{const unit=await AcademicUnit.findById(req.params.id);if(!unit)return res.redirect('/structure');const child=await AcademicUnit.exists({parent:unit._id});if(child){req.session.flash={type:'warning',text:'Avval ushbu bo‘lim ichidagi quyi darajalarni o‘chiring.'};return res.redirect('/structure');}
    const path=await unitPath(unit);let used=0;if(unit.level==='faculty')used=await Student.countDocuments({faculty:unit.name});else if(unit.level==='department')used=await Student.countDocuments({faculty:path.faculty,department:unit.name});else if(unit.level==='specialty')used=await Student.countDocuments({faculty:path.faculty,department:path.department,specialty:unit.name});else used=await Student.countDocuments({faculty:path.faculty,department:path.department,specialty:path.specialty,group:unit.name});
    if(used){req.session.flash={type:'warning',text:`Bu master nom ${used} ta magistrantda ishlatilmoqda. O‘chirishdan oldin ularni boshqa tuzilmaga ko‘chiring.`};return res.redirect('/structure');}
    if(unit.level==='group')await AcademicStructure.deleteMany({faculty:path.faculty,department:path.department,specialty:path.specialty,group:path.group});await unit.deleteOne();await audit(req,'ACADEMIC_UNIT_DELETED','AcademicUnit',req.params.id,{level:unit.level,name:unit.name});req.session.flash={type:'success',text:'Master nom o‘chirildi.'};res.redirect('/structure');
  }catch(e){next(e);}
};

exports.create = async (req, res, next) => {
  try {
    const payload = {
      faculty: normalize(req.body.faculty),
      department: normalize(req.body.department),
      specialty: normalize(req.body.specialty),
      group: normalize(req.body.group),
      course: Number(req.body.course || 1),
      admissionYear: req.body.admissionYear ? Number(req.body.admissionYear) : undefined,
      educationForm: normalize(req.body.educationForm) || 'Magistratura',
      defaultSupervisor: req.body.defaultSupervisor || undefined,
      createdBy: req.user._id
    };
    if (!payload.faculty || !payload.department || !payload.specialty || !payload.group) {
      req.session.flash = { type: 'error', text: 'Fakultet, kafedra, mutaxassislik va guruh majburiy.' };
      return res.redirect('/structure');
    }
    const exists = await AcademicStructure.findOne({ faculty: payload.faculty, department: payload.department, specialty: payload.specialty, group: payload.group });
    if (exists) {
      exists.course = payload.course;
      exists.admissionYear = payload.admissionYear;
      exists.educationForm = payload.educationForm;
      exists.defaultSupervisor = payload.defaultSupervisor;
      exists.active = true;
      await exists.save();
      await audit(req, 'STRUCTURE_UPDATED', 'AcademicStructure', exists._id, { masterData:true });
      req.session.flash = { type: 'success', text: 'Mavjud akademik yo‘nalish yangilandi.' };
      return res.redirect('/structure');
    }
    const item = await AcademicStructure.create(payload);
    await audit(req, 'STRUCTURE_CREATED', 'AcademicStructure', item._id, { masterData:true });
    req.session.flash = { type: 'success', text: 'Akademik yo‘nalish qo‘shildi. Endi formalar shu nomni select orqali ishlatadi.' };
    res.redirect('/structure');
  } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const item = await AcademicStructure.findById(req.params.id);
    if (!item) return res.status(404).render('errors/404',{title:'Tuzilma topilmadi'});
    const old = { faculty:item.faculty, department:item.department, specialty:item.specialty, group:item.group };
    const nextValues = {
      faculty:normalize(req.body.faculty), department:normalize(req.body.department), specialty:normalize(req.body.specialty), group:normalize(req.body.group)
    };
    if (!nextValues.faculty || !nextValues.department || !nextValues.specialty || !nextValues.group) {
      req.session.flash={type:'error',text:'Asosiy 4 ta akademik nom bo‘sh qolmasligi kerak.'}; return res.redirect('/structure');
    }
    Object.assign(item,nextValues);
    item.course=Number(req.body.course||item.course||1);
    item.admissionYear=req.body.admissionYear?Number(req.body.admissionYear):undefined;
    item.educationForm=normalize(req.body.educationForm)||'Magistratura';
    item.defaultSupervisor=req.body.defaultSupervisor||undefined;
    await item.save();

    // Exact row rename propagates to current records, so names stay canonical.
    const exact = old;
    const patch = nextValues;
    await Promise.all([
      Student.updateMany(exact,{$set:patch}),
      AcademicStructure.updateMany({ _id:{ $ne:item._id }, ...exact },{$set:patch})
    ]);
    await audit(req,'STRUCTURE_ROW_UPDATED','AcademicStructure',item._id,{old,next:nextValues});
    req.session.flash={type:'success',text:'Akademik yo‘nalish va unga bog‘langan talabalar yangilandi.'};
    res.redirect('/structure');
  } catch(e){
    if (e?.code===11000) { req.session.flash={type:'warning',text:'Bu kombinatsiya allaqachon mavjud. Ommaviy nom almashtirish vositasidan foydalaning.'}; return res.redirect('/structure'); }
    next(e);
  }
};

exports.rename = async (req,res,next) => {
  try {
    const level = String(req.body.level || '');
    const q = buildRenameQuery(level, req.body);
    const newValue = normalize(req.body.newValue);
    if (!q || !newValue) { req.session.flash={type:'error',text:'Daraja, eski nom va yangi nomni to‘liq kiriting.'}; return res.redirect('/structure'); }
    const field = level;
    const rows = await AcademicStructure.find(q);
    if (!rows.length) { req.session.flash={type:'warning',text:'Ko‘rsatilgan eski nom topilmadi.'}; return res.redirect('/structure'); }

    let changed=0, merged=0;
    for (const row of rows) {
      const targetKey = { faculty:row.faculty, department:row.department, specialty:row.specialty, group:row.group, [field]:newValue };
      const dup = await AcademicStructure.findOne({ _id:{ $ne:row._id }, faculty:targetKey.faculty, department:targetKey.department, specialty:targetKey.specialty, group:targetKey.group });
      if (dup) {
        if (!dup.defaultSupervisor && row.defaultSupervisor) dup.defaultSupervisor=row.defaultSupervisor;
        if (!dup.admissionYear && row.admissionYear) dup.admissionYear=row.admissionYear;
        dup.active = dup.active || row.active;
        await dup.save(); await row.deleteOne(); merged++;
      } else { row[field]=newValue; await row.save(); changed++; }
    }

    const patch = { [field]:newValue };
    const jobs = [Student.updateMany(q,{$set:patch})];
    if (level==='faculty') jobs.push(User.updateMany({faculty:q.faculty},{$set:{faculty:newValue}}),Seminar.updateMany({faculty:q.faculty},{$set:{faculty:newValue}}),Task.updateMany({faculty:q.faculty},{$set:{faculty:newValue}}),Upload.updateMany({faculty:q.faculty},{$set:{faculty:newValue}}));
    if (level==='department') {
      const f={department:q.department,...(q.faculty?{faculty:q.faculty}:{})};
      jobs.push(User.updateMany(f,{$set:{department:newValue}}),Seminar.updateMany(f,{$set:{department:newValue}}),Task.updateMany(f,{$set:{department:newValue}}),Upload.updateMany(f,{$set:{department:newValue}}));
    }
    await Promise.all(jobs);
    await audit(req,'MASTER_NAME_RENAMED','AcademicStructure',null,{level,from:q[field],to:newValue,scope:q,changed,merged});
    req.session.flash={type:'success',text:`“${q[field]}” → “${newValue}” almashtirildi. ${changed} ta yo‘nalish yangilandi${merged?`, ${merged} ta dublikat birlashtirildi`:''}.`};
    res.redirect('/structure');
  } catch(e){ next(e); }
};

exports.toggle = async (req, res, next) => {
  try {
    const item = await AcademicStructure.findById(req.params.id);
    if (!item) return res.redirect('/structure');
    item.active = !item.active;
    await item.save();
    await audit(req, item.active ? 'STRUCTURE_ENABLED' : 'STRUCTURE_DISABLED', 'AcademicStructure', item._id, { masterData:true });
    res.redirect('/structure');
  } catch (e) { next(e); }
};

exports.remove = async(req,res,next)=>{
  try{
    const item=await AcademicStructure.findById(req.params.id); if(!item)return res.redirect('/structure');
    const used=await Student.countDocuments({faculty:item.faculty,department:item.department,specialty:item.specialty,group:item.group});
    if(used){ req.session.flash={type:'warning',text:`Bu yo‘nalishda ${used} ta magistrant bor. Avval ularni boshqa guruhga ko‘chiring yoki yo‘nalishni faolsizlantiring.`}; return res.redirect('/structure'); }
    await item.deleteOne(); await audit(req,'STRUCTURE_DELETED','AcademicStructure',req.params.id,{masterData:true});
    req.session.flash={type:'success',text:'Foydalanilmayotgan akademik yo‘nalish o‘chirildi.'}; res.redirect('/structure');
  }catch(e){next(e);}
};

exports.syncFromStudents = async (req, res, next) => {
  try {
    const rows = await Student.find({
      faculty: { $nin: [null, ''] }, department: { $nin: [null, ''] }, specialty: { $nin: [null, ''] }, group: { $nin: [null, ''] }
    }).select('faculty department specialty group course admissionYear educationForm supervisor').lean();
    let created = 0, updated = 0, unitsCreated = 0;
    for (const s of rows) {
      const key = { faculty: s.faculty, department: s.department, specialty: s.specialty, group: s.group };
      const found = await AcademicStructure.findOne(key);
      if (!found) {
        await AcademicStructure.create({ ...key, course: s.course || 1, admissionYear: s.admissionYear, educationForm: s.educationForm || 'Magistratura', defaultSupervisor: s.supervisor || undefined, createdBy: req.user._id });
        created++;
      } else {
        let changed = false;
        if (!found.admissionYear && s.admissionYear) { found.admissionYear = s.admissionYear; changed = true; }
        if (!found.defaultSupervisor && s.supervisor) { found.defaultSupervisor = s.supervisor; changed = true; }
        if (changed) { await found.save(); updated++; }
      }
      let faculty = await AcademicUnit.findOne({level:'faculty',parent:null,name:s.faculty});
      if(!faculty){ faculty=await AcademicUnit.create({level:'faculty',name:s.faculty,createdBy:req.user._id}); unitsCreated++; }
      let department = await AcademicUnit.findOne({level:'department',parent:faculty._id,name:s.department});
      if(!department){ department=await AcademicUnit.create({level:'department',name:s.department,parent:faculty._id,createdBy:req.user._id}); unitsCreated++; }
      let specialty = await AcademicUnit.findOne({level:'specialty',parent:department._id,name:s.specialty});
      if(!specialty){ specialty=await AcademicUnit.create({level:'specialty',name:s.specialty,parent:department._id,createdBy:req.user._id}); unitsCreated++; }
      let group = await AcademicUnit.findOne({level:'group',parent:specialty._id,name:s.group});
      if(!group){ group=await AcademicUnit.create({level:'group',name:s.group,parent:specialty._id,course:s.course||1,admissionYear:s.admissionYear,educationForm:s.educationForm||'Magistratura',defaultSupervisor:s.supervisor||undefined,createdBy:req.user._id}); unitsCreated++; }
    }
    await audit(req, 'STRUCTURE_SYNCED', 'AcademicStructure', null, { created, updated, unitsCreated, masterData:true });
    req.session.flash = { type: 'success', text: `Bazadan master katalog yig‘ildi: ${unitsCreated} ta master nom, ${created} ta yo‘nalish yangi, ${updated} ta yangilandi.` };
    res.redirect('/structure');
  } catch (e) { next(e); }
};

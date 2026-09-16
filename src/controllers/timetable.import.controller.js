const ExcelJS = require('exceljs');
const TimetableEntry = require('../models/TimetableEntry');
const TimetableImportLog = require('../models/TimetableImportLog');
const Student = require('../models/Student');
const User = require('../models/User');
const audit = require('../services/audit');
const { PERIODS, DAYS, LESSON_TYPES } = require('../config/timetable');

const MAX_IMPORT_ROWS = 2500;
const IMPORT_ROLES = ['superadmin','tech'];

function clean(v){ return String(v==null?'':v).replace(/\s+/g,' ').trim(); }
function token(v){ return clean(v).toLowerCase().replace(/[ʻ’‘`´']/g,'').replace(/ё/g,'е').replace(/[^a-z0-9а-яқғҳў]+/gi,''); }
function normName(v){ return token(v); }
function weekHit(a,b){ return a==='all'||b==='all'||a===b; }
function pairKey(r){ return `${r.academicYear}|${r.semester}`; }
function slotKey(r){ return `${r.academicYear}|${r.semester}|${r.day}|${r.period}`; }
function canImport(user){ return user && IMPORT_ROLES.includes(user.role); }

const ALIASES={
  academicYear:['oquvyili','academicyear','учебныйгод','yil'], semester:['semestr','semester','семестр'],
  weekType:['haftaturi','hafta','weektype','week','неделя','типнедели'], day:['kun','day','день','haftakuni'],
  period:['para','juftlik','period','пара','darsraqami'], startTime:['boshlanish','boshlanishvaqti','start','starttime','начало'],
  endTime:['tugash','tugashvaqti','end','endtime','конец','окончание'], subject:['fan','subject','предмет','fannomi'],
  lessonType:['mashgulotturi','darsturi','lessontype','type','типзанятия'], group:['guruh','group','группа'],
  teacherLogin:['oqituvchilogin','teacherlogin','login','логинпреподавателя'], teacherName:['oqituvchi','oqituvchifish','teacher','teachername','преподаватель','fio'],
  room:['xona','auditoriya','room','аудитория','кабинет'], faculty:['fakultet','faculty','факультет'],
  department:['kafedra','department','кафедра'], note:['izoh','note','comment','примечание','комментарий']
};
function remap(raw){
  const n={}; Object.entries(raw||{}).forEach(([k,v])=>n[token(k)]=v);
  const out={}; Object.entries(ALIASES).forEach(([field,a])=>{ const hit=a.map(token).find(x=>Object.prototype.hasOwnProperty.call(n,x)); out[field]=hit?n[hit]:''; });
  return out;
}
function normDay(v){
  const n=Number(clean(v)); if(n>=1&&n<=6) return n;
  return ({dushanba:1,monday:1,понедельник:1,seshanba:2,tuesday:2,вторник:2,chorshanba:3,wednesday:3,среда:3,payshanba:4,thursday:4,четверг:4,juma:5,friday:5,пятница:5,shanba:6,saturday:6,суббота:6})[token(v)]||0;
}
function normWeek(v){ const x=token(v); if(!x||['all','harhafta','barcha','every','все','каждуюнеделю'].includes(x)) return 'all'; if(['odd','toq','нечет','нечетная','1'].includes(x)) return 'odd'; if(['even','juft','чет','четная','2'].includes(x)) return 'even'; return null; }
function normType(v){
  const x=token(v); if(!x) return 'lecture';
  const map={lecture:['lecture','maruza','maaruza','лекция'],practice:['practice','amaliyot','amaliy','практика','практическое'],lab:['lab','laboratoriya','лаборатория','лабораторная'],seminar:['seminar','семинар'],online:['online','onlayn','онлайн']};
  return Object.entries(map).find(([,a])=>a.includes(x))?.[0]||null;
}
function normTime(v,fallback){
  if(v instanceof Date) return `${String(v.getUTCHours()).padStart(2,'0')}:${String(v.getUTCMinutes()).padStart(2,'0')}`;
  if(typeof v==='number' && v>=0 && v<1){ const mins=Math.round(v*24*60); return `${String(Math.floor(mins/60)%24).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`; }
  const s=clean(v); if(!s) return fallback; const m=s.match(/^(\d{1,2})[:.]([0-5]\d)/); if(!m) return null; const h=Number(m[1]); return h<=23?`${String(h).padStart(2,'0')}:${m[2]}`:null;
}
function cellValue(cell){ if(cell.value instanceof Date) return cell.value; if(cell.value&&typeof cell.value==='object'&&'result' in cell.value) return cell.value.result; return cell.text||cell.value||''; }
function conflictReasons(a,b){
  if(slotKey(a)!==slotKey(b)||!weekHit(a.weekType,b.weekType)) return [];
  const r=[]; if(a.group&&b.group&&a.group===b.group) r.push(`guruh ${a.group}`);
  if(a.teacher&&b.teacher&&String(a.teacher)===String(b.teacher)) r.push('o‘qituvchi');
  if(a.room&&b.room&&token(a.room)===token(b.room)) r.push(`xona ${a.room}`);
  return r;
}
function exactSame(a,b){ return slotKey(a)===slotKey(b)&&a.weekType===b.weekType&&a.group===b.group&&token(a.subject)===token(b.subject)&&String(a.teacher||'')===String(b.teacher||'')&&token(a.room)===token(b.room); }

async function parseWorkbook(buffer,filename,user,mode){
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
  const ws=wb.worksheets[0]; if(!ws) throw new Error('Excel ichida ishchi varaq topilmadi.');
  const headers={}; ws.getRow(1).eachCell((cell,col)=>{ headers[col]=clean(cellValue(cell)); });
  if(!Object.values(headers).some(Boolean)) throw new Error('1-qator ustun nomlari bo‘lishi kerak.');
  const rawRows=[];
  for(let rn=2;rn<=ws.rowCount;rn++){
    const row=ws.getRow(rn), raw={}; let has=false;
    Object.entries(headers).forEach(([col,name])=>{ const val=cellValue(row.getCell(Number(col))); raw[name]=val; if(clean(val)) has=true; });
    if(has) rawRows.push({excelRow:rn,...remap(raw)});
    if(rawRows.length>MAX_IMPORT_ROWS) throw new Error(`Bir importda maksimum ${MAX_IMPORT_ROWS} ta ma’lumot qatori mumkin.`);
  }
  if(!rawRows.length) throw new Error('Excelda import qilinadigan satr topilmadi.');

  const groups=[...new Set(rawRows.map(r=>clean(r.group)).filter(Boolean))];
  const [users,studentSamples]=await Promise.all([
    User.find({active:true,role:{$in:['teacher','supervisor','department']}}).select('_id login employeeId fullName faculty department').lean(),
    Student.find({group:{$in:groups},studyStatus:'active'}).select('group faculty department').lean()
  ]);
  const groupMap=new Map(); studentSamples.forEach(s=>{ if(!groupMap.has(s.group)) groupMap.set(s.group,s); });
  const byLogin=new Map(), byEmployee=new Map(), byName=new Map();
  users.forEach(u=>{ byLogin.set(token(u.login),u); if(u.employeeId) byEmployee.set(token(u.employeeId),u); const k=normName(u.fullName); const a=byName.get(k)||[]; a.push(u); byName.set(k,a); });

  const rows=rawRows.map(r=>{
    const period=Math.max(0,Number(clean(r.period))||0), def=PERIODS.find(p=>p.no===period);
    let teacher=null, teacherIssue=''; const login=token(r.teacherLogin), name=normName(r.teacherName);
    if(login) teacher=byLogin.get(login)||byEmployee.get(login)||null;
    if(!teacher&&name){ const hits=byName.get(name)||[]; if(hits.length===1) teacher=hits[0]; else if(hits.length>1) teacherIssue='O‘qituvchi F.I.Sh. bir nechta akkauntga mos keldi; login kiriting.'; }
    if(!teacher&&clean(r.teacherLogin)) teacherIssue='O‘qituvchi login/ID topilmadi.';
    else if(!teacher&&clean(r.teacherName)) teacherIssue=teacherIssue||'O‘qituvchi akkaunti topilmadi.';
    const g=clean(r.group), gm=groupMap.get(g), academicYear=clean(r.academicYear), semester=Number(clean(r.semester));
    const out={excelRow:r.excelRow,academicYear,semester,weekType:normWeek(r.weekType),day:normDay(r.day),period,startTime:normTime(r.startTime,def?.start||''),endTime:normTime(r.endTime,def?.end||''),subject:clean(r.subject),lessonType:normType(r.lessonType),group:g,teacher:teacher?._id?String(teacher._id):'',teacherName:teacher?.fullName||clean(r.teacherName),room:clean(r.room),faculty:clean(r.faculty)||gm?.faculty||'',department:clean(r.department)||gm?.department||'',note:clean(r.note),status:'ready',messages:[]};
    if(!/^\d{4}\s*[\/-]\s*\d{4}$/.test(academicYear)) out.messages.push('O‘quv yili 2026/2027 ko‘rinishida bo‘lsin.');
    else out.academicYear=academicYear.replace(/\s/g,'').replace('-','/');
    if(![1,2].includes(semester)) out.messages.push('Semestr 1 yoki 2 bo‘lishi kerak.');
    if(!out.weekType) out.messages.push('Hafta turi: Har hafta / Toq / Juft.');
    if(!out.day) out.messages.push('Kun noto‘g‘ri.'); if(!def) out.messages.push('Para 1–7 oralig‘ida bo‘lishi kerak.');
    if(!out.startTime||!out.endTime) out.messages.push('Boshlanish/tugash vaqti HH:MM formatida bo‘lsin.');
    if(!out.subject) out.messages.push('Fan nomi majburiy.'); if(!out.lessonType) out.messages.push('Mashg‘ulot turi noto‘g‘ri.'); if(!g) out.messages.push('Guruh majburiy.');
    if(g&&!gm) out.messages.push('Guruh faol talabalar bazasida topilmadi.'); if(teacherIssue) out.messages.push(teacherIssue);
    if(out.messages.length) out.status='error'; return out;
  });

  const valid=rows.filter(r=>r.status==='ready');
  const scopes=[...new Set(valid.map(pairKey))].map(k=>{const [academicYear,semester]=k.split('|');return {academicYear,semester:Number(semester)};});
  const ors=scopes.map(s=>({academicYear:s.academicYear,semester:s.semester}));
  let existing=ors.length?await TimetableEntry.find({active:true,$or:ors}).select('academicYear semester weekType day period subject group teacher teacherName room').lean():[];
  existing=existing.map(x=>({...x,teacher:x.teacher?String(x.teacher):''}));
  if(mode==='replace_groups') existing=existing.filter(x=>!groups.includes(x.group));

  const accepted=[];
  for(const r of rows){
    if(r.status!=='ready') continue;
    const dup=existing.find(x=>exactSame(r,x))||accepted.find(x=>exactSame(r,x));
    if(dup){ r.status='duplicate'; r.messages=['Aynan shu dars jadvalda yoki faylning oldingi satrida mavjud.']; continue; }
    const reasons=[];
    existing.forEach(x=>reasons.push(...conflictReasons(r,x))); accepted.forEach(x=>reasons.push(...conflictReasons(r,x)));
    const unique=[...new Set(reasons)]; if(unique.length){ r.status='conflict'; r.messages=[`To‘qnashuv: ${unique.join(', ')} shu vaqtda band.`]; continue; }
    accepted.push(r);
  }
  const counts={total:rows.length,ready:rows.filter(r=>r.status==='ready').length,duplicate:rows.filter(r=>r.status==='duplicate').length,conflict:rows.filter(r=>r.status==='conflict').length,error:rows.filter(r=>r.status==='error').length};
  return {originalname:filename,sheetName:ws.name,mode,rows,counts};
}

exports.importPage=async(req,res,next)=>{
  try{
    if(!canImport(req.user)) return res.status(403).render('errors/403',{title:'Ruxsat yo‘q'});
    const draft=req.session.timetableImportDraft&&String(req.session.timetableImportDraft.owner)===String(req.user._id)?req.session.timetableImportDraft:null;
    const history=await TimetableImportLog.find({createdBy:req.user._id}).sort({createdAt:-1}).limit(10).lean();
    res.render('timetable/import',{title:'Jadvalni Excel orqali import qilish',draft,history,PERIODS,DAYS,LESSON_TYPES});
  }catch(e){next(e);}
};

exports.downloadTemplate=async(req,res,next)=>{
  try{
    const wb=new ExcelJS.Workbook(); wb.creator='MD KSTU'; wb.created=new Date();
    const ws=wb.addWorksheet('Jadval',{views:[{state:'frozen',ySplit:1}]});
    ws.columns=[
      ['O‘quv yili',15],['Semestr',10],['Hafta turi',14],['Kun',14],['Para',8],['Boshlanish',12],['Tugash',12],['Fan',34],['Mashg‘ulot turi',18],['Guruh',18],['O‘qituvchi login',20],['O‘qituvchi F.I.Sh.',28],['Xona',13],['Fakultet',24],['Kafedra',24],['Izoh',32]
    ].map(([header,width])=>({header,key:header,width}));
    ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}}; ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF14532D'}}; ws.getRow(1).alignment={vertical:'middle'}; ws.getRow(1).height=26;
    ws.addRow(['2026/2027',1,'Har hafta','Dushanba',1,'08:30','09:50','Ilmiy tadqiqot metodologiyasi','Ma’ruza','M-101-26','ustoz.login','O‘qituvchi F.I.Sh.','B-204','','','Namuna satr — o‘chirib o‘zingiznikini kiriting']);
    for(let r=2;r<=200;r++){
      ws.getCell(`B${r}`).dataValidation={type:'list',allowBlank:false,formulae:['"1,2"']};
      ws.getCell(`C${r}`).dataValidation={type:'list',allowBlank:false,formulae:['"Har hafta,Toq,Juft"']};
      ws.getCell(`D${r}`).dataValidation={type:'list',allowBlank:false,formulae:['"Dushanba,Seshanba,Chorshanba,Payshanba,Juma,Shanba"']};
      ws.getCell(`E${r}`).dataValidation={type:'whole',operator:'between',formulae:[1,7]};
      ws.getCell(`I${r}`).dataValidation={type:'list',allowBlank:false,formulae:['"Ma’ruza,Amaliyot,Laboratoriya,Seminar,Onlayn"']};
    }
    ws.autoFilter={from:'A1',to:'P1'};
    const help=wb.addWorksheet('Yo‘riqnoma'); help.columns=[{width:26},{width:86}];
    [
      ['Qadam','Tushuntirish'],['1','Jadval varag‘idagi 1-qator ustun nomlarini o‘zgartirmang.'],['2','Har bir dars alohida qatorda bo‘lsin.'],['3','O‘qituvchini aniq bog‘lash uchun login ustuni tavsiya etiladi.'],['4','Preview bosqichida xato, dublikat va guruh/o‘qituvchi/xona to‘qnashuvlari ko‘rsatiladi.'],['5','Birlashtirish mavjud jadvalni saqlaydi; Almashtirish faqat Excelda kelgan guruhlarning shu semestr jadvalini yangilaydi.'],['6','Xatoli yoki konfliktli almashtirish tasdiqlanmaydi — avval Excelni tuzating.']
    ].forEach(x=>help.addRow(x)); help.getRow(1).font={bold:true};
    const buf=await wb.xlsx.writeBuffer(); res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.setHeader('Content-Disposition','attachment; filename="MD-Dars-Jadvali-Shablon.xlsx"'); res.send(Buffer.from(buf));
  }catch(e){next(e);}
};

exports.previewImport=async(req,res)=>{
  try{
    if(!req.file?.buffer){ req.session.flash={type:'error',text:'Excel faylini tanlang.'}; return res.redirect('/timetable/import'); }
    const mode=req.body.mode==='replace_groups'?'replace_groups':'merge', parsed=await parseWorkbook(req.file.buffer,req.file.originalname,req.user,mode);
    const groups=[...new Set(parsed.rows.map(r=>r.group).filter(Boolean))], years=[...new Set(parsed.rows.map(r=>r.academicYear).filter(Boolean))], semesters=[...new Set(parsed.rows.map(r=>r.semester).filter(x=>[1,2].includes(Number(x))))];
    const log=await TimetableImportLog.create({filename:parsed.originalname,sheetName:parsed.sheetName,mode,totalRows:parsed.counts.total,validRows:parsed.counts.ready,skippedRows:parsed.counts.duplicate,errorRows:parsed.counts.error+parsed.counts.conflict,warningRows:parsed.counts.conflict,affectedGroups:groups,academicYears:years,semesters,status:'previewed',summary:parsed.counts,createdBy:req.user._id});
    req.session.timetableImportDraft={...parsed,logId:String(log._id),createdAt:new Date().toISOString(),owner:String(req.user._id)};
    res.redirect('/timetable/import');
  }catch(e){ req.session.flash={type:'error',text:e.message||'Excel preview xatosi.'}; res.redirect('/timetable/import'); }
};

exports.confirmImport=async(req,res,next)=>{
  try{
    const d=req.session.timetableImportDraft; if(!d||String(d.owner)!==String(req.user._id)){req.session.flash={type:'error',text:'Import preview topilmadi. Excelni qayta yuklang.'};return res.redirect('/timetable/import');}
    const ready=(d.rows||[]).filter(r=>r.status==='ready'); if(!ready.length){req.session.flash={type:'error',text:'Import qilish uchun xatosiz satr yo‘q.'};return res.redirect('/timetable/import');}
    const mode=d.mode==='replace_groups'?'replace_groups':'merge';
    if(mode==='replace_groups'&&((d.counts?.error||0)+(d.counts?.conflict||0)>0)){req.session.flash={type:'error',text:'Almashtirish rejimida barcha xato va konfliktlarni avval tuzating. Hech narsa o‘zgartirilmadi.'};return res.redirect('/timetable/import');}
    const groups=[...new Set(ready.map(r=>r.group))], scopes=[...new Map(ready.map(r=>[pairKey(r),{academicYear:r.academicYear,semester:Number(r.semester)}])).values()];
    if(mode==='replace_groups') for(const s of scopes) await TimetableEntry.deleteMany({...s,group:{$in:groups}});
    const docs=ready.map(r=>({academicYear:r.academicYear,semester:Number(r.semester),weekType:r.weekType,day:Number(r.day),period:Number(r.period),startTime:r.startTime,endTime:r.endTime,subject:r.subject,lessonType:r.lessonType,group:r.group,teacher:r.teacher||undefined,teacherName:r.teacherName,room:r.room,faculty:r.faculty,department:r.department,note:r.note,active:true,createdBy:req.user._id,updatedBy:req.user._id}));
    const inserted=await TimetableEntry.insertMany(docs,{ordered:true}); await audit(req,'timetable_excel_import','TimetableEntry',null,{filename:d.originalname,mode,rows:inserted.length,groups});
    const patch={filename:d.originalname,sheetName:d.sheetName,mode,totalRows:d.counts.total,validRows:d.counts.ready,importedRows:inserted.length,skippedRows:d.counts.duplicate,errorRows:(d.counts.error||0)+(d.counts.conflict||0),warningRows:d.counts.conflict||0,affectedGroups:groups,academicYears:[...new Set(ready.map(r=>r.academicYear))],semesters:[...new Set(ready.map(r=>Number(r.semester)))],status:'completed',summary:d.counts,createdBy:req.user._id};
    if(d.logId) await TimetableImportLog.findByIdAndUpdate(d.logId,patch); else await TimetableImportLog.create(patch);
    delete req.session.timetableImportDraft; req.session.flash={type:'success',text:`Excel import yakunlandi: ${inserted.length} ta dars jadvalga yozildi.`}; res.redirect('/timetable');
  }catch(e){
    try{const d=req.session.timetableImportDraft;if(d?.logId)await TimetableImportLog.findByIdAndUpdate(d.logId,{status:'failed',summary:{...(d.counts||{}),error:e.message}});}catch(_){}
    next(e);
  }
};
exports.cancelImport=async(req,res,next)=>{
  try{ const d=req.session.timetableImportDraft; if(d?.logId) await TimetableImportLog.findByIdAndUpdate(d.logId,{status:'cancelled'}); delete req.session.timetableImportDraft; req.session.flash={type:'success',text:'Import preview bekor qilindi.'}; res.redirect('/timetable/import'); }catch(e){next(e);}
};

const Student = require('../models/Student');
const HemisImportLog = require('../models/HemisImportLog');
const audit = require('../services/audit');

function parseLine(line, delimiter) {
  const out=[]; let cur=''; let quoted=false;
  for (let i=0;i<line.length;i++) {
    const ch=line[i];
    if (ch==='"') {
      if (quoted && line[i+1]==='"') { cur+='"'; i++; }
      else quoted=!quoted;
    } else if (ch===delimiter && !quoted) { out.push(cur.trim()); cur=''; }
    else cur+=ch;
  }
  out.push(cur.trim());
  return out;
}
function normalizeHeader(x){return String(x||'').toLowerCase().replace(/[ʻ’‘`']/g,'').replace(/[^a-z0-9а-яёқғҳў]+/gi,' ').trim();}
function detectDelimiter(first){const choices=[',',';','\t'];return choices.sort((a,b)=>(first.split(b).length-first.split(a).length))[0];}
const aliases={
  studentId:['talaba id','student id','studentid','id','hemis id','talaba kodi'],
  fullName:['fio','f i sh','fish','full name','fullname','talaba','talaba fio','talaba fish'],
  faculty:['fakultet','faculty'],
  department:['kafedra','department'],
  specialty:['mutaxassislik','specialty','yonalish','ta lim yonalishi'],
  group:['guruh','group'],
  course:['kurs','course'],
  educationForm:['ta lim shakli','talim shakli','education form'],
  academicScore:['ozlashtirish','o zlashtirish','academic score','reyting','gpa'],
  attendance:['davomat','attendance'],
  studyStatus:['talaba holati','study status','status']
};
function colIndex(headers,key){const options=aliases[key]||[];return headers.findIndex(h=>options.includes(h));}
function numberPercent(v){const n=Number(String(v||'').replace(',','.').replace('%','').trim());return Number.isFinite(n)?Math.max(0,Math.min(100,n)):undefined;}
function normalizeStatus(v){const x=normalizeHeader(v);if(/bitir|graduat/.test(x))return'graduated';if(/akadem|leave/.test(x))return'academic_leave';if(/chetlat|expell/.test(x))return'expelled';return'active';}
function parseCsv(buffer){
  const text=buffer.toString('utf8').replace(/^\uFEFF/,'');
  const lines=text.split(/\r?\n/).filter(x=>x.trim());
  if(!lines.length) throw new Error('CSV fayl bo‘sh.');
  const delimiter=detectDelimiter(lines[0]);
  const rawHeaders=parseLine(lines[0],delimiter); const headers=rawHeaders.map(normalizeHeader);
  const idx={};Object.keys(aliases).forEach(k=>idx[k]=colIndex(headers,k));
  if(idx.fullName<0) throw new Error('F.I.Sh. ustuni topilmadi. Header misoli: F.I.Sh., Talaba ID, Fakultet, Kafedra, Mutaxassislik, Guruh, Kurs.');
  const rows=[]; const errors=[];
  for(let i=1;i<lines.length;i++){
    const cells=parseLine(lines[i],delimiter); const get=k=>idx[k]>=0?String(cells[idx[k]]||'').trim():'';
    const fullName=get('fullName'); if(!fullName){errors.push(`${i+1}-qator: F.I.Sh. bo‘sh`);continue;}
    const courseRaw=Number(get('course'));
    rows.push({
      studentId:get('studentId')||undefined, fullName,
      faculty:get('faculty')||undefined, department:get('department')||undefined,
      specialty:get('specialty')||undefined, group:get('group')||undefined,
      course:Number.isFinite(courseRaw)&&courseRaw>0?Math.min(3,courseRaw):undefined,
      educationForm:get('educationForm')||undefined,
      academicScore:numberPercent(get('academicScore')),
      attendance:numberPercent(get('attendance')),
      studyStatus:normalizeStatus(get('studyStatus')),
      hemisSyncedAt:new Date(), hemisSource:'csv'
    });
  }
  return { rows, errors, headers:rawHeaders };
}

exports.index=async(req,res,next)=>{try{
  const logs=await HemisImportLog.find({}).populate('actor','fullName').sort({createdAt:-1}).limit(15).lean();
  res.render('integrations/hemis',{title:'HEMIS ma’lumotlari',logs,preview:null});
}catch(e){next(e);}};

exports.upload=async(req,res,next)=>{try{
  if(!req.file) throw new Error('CSV fayl tanlanmagan.');
  const parsed=parseCsv(req.file.buffer);
  const mode=req.body.mode==='import'?'import':'preview';
  if(mode==='preview'){
    const logs=await HemisImportLog.find({}).populate('actor','fullName').sort({createdAt:-1}).limit(15).lean();
    return res.render('integrations/hemis',{title:'HEMIS ma’lumotlari',logs,preview:{...parsed,filename:req.file.originalname}});
  }
  let created=0,updated=0,skipped=0; const errors=[...parsed.errors];
  for(const row of parsed.rows){
    try{
      let student=row.studentId?await Student.findOne({studentId:row.studentId}):null;
      if(!student) student=await Student.findOne({fullName:row.fullName,group:row.group||''});
      const clean=Object.fromEntries(Object.entries(row).filter(([,v])=>v!==undefined&&v!==''));
      if(student){
        const preserve=['supervisor','dissertationTitle','researchInterests','orcid','scholarUrl','linkedinUrl','notes','scientificActivity','individualPlan','dissertationProgress','documentsCompleteness','dissertationStage'];
        preserve.forEach(k=>delete clean[k]);
        Object.assign(student,clean);student.recalculateStatus();await student.save();updated++;
      }else{
        student=new Student(clean);student.recalculateStatus();await student.save();created++;
      }
    }catch(err){skipped++;errors.push(`${row.studentId||row.fullName}: ${err.message}`);}
  }
  const log=await HemisImportLog.create({actor:req.user._id,filename:req.file.originalname,mode,totalRows:parsed.rows.length,created,updated,skipped,errors:errors.slice(0,80)});
  await audit(req,'hemis_csv_import','HemisImportLog',log._id,{totalRows:parsed.rows.length,created,updated,skipped});
  req.session.flash={type:'success',text:`HEMIS import tugadi: ${created} yangi, ${updated} yangilandi, ${skipped} o‘tkazib yuborildi.`};
  res.redirect('/integrations/hemis');
}catch(e){next(e);}};

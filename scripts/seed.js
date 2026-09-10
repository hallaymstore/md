require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Student = require('../src/models/Student');
const MonitoringItem = require('../src/models/MonitoringItem');
const Task = require('../src/models/Task');
const Seminar = require('../src/models/Seminar');
const ScientificActivity = require('../src/models/ScientificActivity');
const DocumentRecord = require('../src/models/DocumentRecord');
const AcademicStructure = require('../src/models/AcademicStructure');
const ResearchSubmission = require('../src/models/ResearchSubmission');
const Notification = require('../src/models/Notification');
const DissertationMilestone = require('../src/models/DissertationMilestone');
const ProgressSnapshot = require('../src/models/ProgressSnapshot');
const DISSERTATION_STAGES = require('../src/utils/dissertationStages');
const { buildStageProgress } = require('../src/config/submissionWorkflow');

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/md';
async function ensureUser(data,password){let u=await User.findOne({login:data.login});if(!u){u=new User({...data,passwordHash:'pending'});await u.setPassword(password);await u.save();}return u;}
const clamp=n=>Math.max(0,Math.min(100,n));

async function seedAux(students, actors){
  const {mag, supervisors, dept, teacher}=actors;
  if(await ScientificActivity.countDocuments()===0){
    for(let i=0;i<students.length;i++){
      const s=students[i];
      if(i%2===0) await ScientificActivity.create({student:s._id,type:'publication',title:`${s.specialty} bo‘yicha ilmiy maqola ${i+1}`,organization:i%4===0?'Respublika ilmiy jurnali':'Ilmiy to‘plam',date:new Date(Date.now()-(i+2)*86400000),status:i%3===0?'published':'submitted',score:clamp(55+(i*7)%45),createdBy:mag._id});
      if(i%3===0) await ScientificActivity.create({student:s._id,type:'conference',title:'Yosh olimlar ilmiy-amaliy konferensiyasi',organization:'MD',date:new Date(Date.now()-(i+4)*86400000),status:'completed',score:75,createdBy:mag._id});
      if(i%5===0) await ScientificActivity.create({student:s._id,type:'research',title:'Tadqiqot natijalarini tahlil qilish',date:new Date(),status:'completed',score:80,createdBy:supervisors[i%supervisors.length]._id});
    }
  }
  if(await DocumentRecord.countDocuments()===0){
    const types=['individual_plan','dissertation_topic','supervisor_info','seminar_minutes','report','publication','conference','attestation','defense'];
    for(let i=0;i<students.length;i++){
      for(let j=0;j<types.length;j++){
        const score=(i*13+j*7)%100; const status=score<70?'present':score<86?'update':'missing';
        await DocumentRecord.create({student:students[i]._id,type:types[j],title:types[j].replace(/_/g,' '),status,issueDate:status==='present'?new Date(Date.now()-(j+1)*86400000):undefined,notes:status==='missing'?'Taqdim etilishi kerak':'',updatedBy:mag._id});
      }
      const docs=await DocumentRecord.find({student:students[i]._id}).lean();
      students[i].documentsCompleteness=Math.round(docs.filter(d=>d.status==='present').length/types.length*100);students[i].recalculateStatus();await students[i].save();
    }
  }
  if(await Seminar.countDocuments()===0){
    const deps=[['Muhandislik fakulteti','Axborot texnologiyalari'],['Energetika fakulteti','Energetika tizimlari'],['Iqtisodiyot fakulteti','Menejment']];
    for(let i=0;i<9;i++){
      const [faculty,department]=deps[i%deps.length];
      await Seminar.create({title:`Magistrlar ilmiy seminari №${i+1}`,date:new Date(Date.now()+(i-4)*7*86400000),faculty,department,responsible:i%2?teacher._id:dept._id,participantCount:18+i,status:i<5?'held':'planned',minutesUploaded:i<4,materialsUploaded:i<5,photoUploaded:i<3,result:i<5?'Muhokama va tavsiyalar qayd etildi':'',createdBy:mag._id});
    }
  }
  if(await Task.countDocuments()===0){
    for(let i=0;i<students.length;i++){
      const s=students[i];
      if(s.attendance<75) await Task.create({title:'Davomat ko‘rsatkichini yaxshilash',description:'Davomat sabablari bo‘yicha tushuntirish va chora rejasini kiriting.',issueReason:'Davomat belgilangan nazorat chegarasidan past.',actionPlan:'Ilmiy rahbar bilan suhbat, sabablarni aniqlash va bir haftalik davomat rejasini belgilash.',expectedResult:'Davomatning barqaror o‘sishi va keyingi nazoratda yaxshilanish.',type:'attendance',priority:s.attendance<65?'critical':'high',student:s._id,faculty:s.faculty,department:s.department,assignedTo:s.supervisor,dueDate:new Date(Date.now()+(5+i%4)*86400000),followUpDate:new Date(Date.now()+(9+i%4)*86400000),createdBy:mag._id});
      if(s.dissertationProgress<60) await Task.create({title:'Dissertatsiya jadvalidan ortda qolish',description:'Joriy bob bo‘yicha ishni yakunlash va rahbarga topshirish.',issueReason:'Dissertatsiya bajarilishi rejalashtirilgan sur’atdan ortda qolgan.',actionPlan:'Joriy bob uchun aniq haftalik vazifalar va rahbar bilan qayta ko‘rib chiqish sanasini belgilash.',expectedResult:'Keyingi bosqich muddatiga qadar joriy bobni yakunlash.',type:'dissertation',priority:'high',student:s._id,faculty:s.faculty,department:s.department,assignedTo:s.supervisor,dueDate:new Date(Date.now()+(8+i%6)*86400000),followUpDate:new Date(Date.now()+(12+i%6)*86400000),createdBy:mag._id});
      if(s.documentsCompleteness<60) await Task.create({title:'Yetishmayotgan hujjatlarni to‘ldirish',type:'document',priority:'medium',student:s._id,faculty:s.faculty,department:s.department,dueDate:new Date(Date.now()+(12+i%5)*86400000),createdBy:mag._id});
    }
  }
  if(await MonitoringItem.countDocuments()===0){
    for(const s of students){
      for(const [type,title,percent] of [['attendance','Davomat monitoringi',s.attendance],['plan','Individual reja',s.individualPlan],['dissertation','Dissertatsiya progressi',s.dissertationProgress],['academic','O‘zlashtirish',s.academicScore]]){
        await MonitoringItem.create({student:s._id,type,title,percent,status:percent>=80?'green':percent>=60?'yellow':'red',updatedBy:mag._id});
      }
    }
  }
}

async function seedWorkflow(students, actors){
  if(await ResearchSubmission.countDocuments()) return;
  const student=students.find(item=>item.user)||await Student.findOne({user:{$exists:true,$ne:null}});
  if(!student?.user||!student.supervisor) return;
  const applicant=await User.findById(student.user); if(!applicant)return;
  const {supervisors,dept,dean,mag,management}=actors;
  const supervisor=supervisors.find(item=>String(item._id)===String(student.supervisor))||supervisors[0];
  const now=Date.now();

  async function createSample(data){
    const item=new ResearchSubmission({
      student:student._id,applicant:applicant._id,supervisor:supervisor._id,faculty:student.faculty,department:student.department,specialty:student.specialty,group:student.group,
      type:data.type,title:data.title,abstract:data.abstract,keywords:data.keywords||['magistratura','ilmiy tadqiqot'],externalLink:'https://example.com/ilmiy-manba',priority:data.priority||'normal',
      targetDate:new Date(now+14*86400000),status:data.status,currentStage:data.currentStage,resumeStage:data.resumeStage,revision:data.revision||1,stageProgress:buildStageProgress(supervisor._id),submittedAt:new Date(now-5*86400000),lastActionAt:new Date(now-(data.age||1)*86400000),completedAt:data.status==='approved'?new Date(now-86400000):undefined,createdBy:applicant._id
    });
    item.history.push({action:'created',actor:applicant._id,actorRole:'student',toStage:'student',comment:'Demo qoralama yaratildi.',revision:1,createdAt:new Date(now-6*86400000)});
    item.history.push({action:'submitted',actor:applicant._id,actorRole:'student',fromStage:'student',toStage:'supervisor',comment:'Ilmiy rahbarga ko‘rib chiqish uchun yuborildi.',revision:1,createdAt:new Date(now-5*86400000)});
    const set=(stage,status,actor,comment)=>{const row=item.stageProgress.find(x=>x.stage===stage);row.status=status;if(actor)row.actedBy=actor._id;if(actor)row.actedAt=new Date(now-2*86400000);if(comment)row.comment=comment;};
    set('supervisor',data.supervisorStatus||'pending',data.supervisorStatus&&data.supervisorStatus!=='pending'?supervisor:null,data.supervisorComment);
    if(data.supervisorStatus==='approved')item.history.push({action:'approved',actor:supervisor._id,actorRole:'supervisor',fromStage:'supervisor',toStage:'department',comment:'Ilmiy mazmuni tekshirildi, kafedraga tavsiya qilindi.',revision:1,createdAt:new Date(now-4*86400000)});
    if(data.supervisorStatus==='changes_requested')item.history.push({action:'changes_requested',actor:supervisor._id,actorRole:'supervisor',fromStage:'supervisor',toStage:'student',comment:data.supervisorComment,revision:1,createdAt:new Date(now-2*86400000)});
    if(data.departmentStatus){set('department',data.departmentStatus,data.departmentStatus==='pending'?null:dept,'Kafedra qarori');}
    if(data.deanStatus){set('dean',data.deanStatus,data.deanStatus==='pending'?null:dean,'Dekanat qarori');}
    if(data.magistracyStatus){set('magistracy',data.magistracyStatus,data.magistracyStatus==='pending'?null:mag,'Magistratura bo‘limi qarori');}
    if(data.managementStatus){set('management',data.managementStatus,data.managementStatus==='pending'?null:management,'Yakuniy qaror');}
    if(data.status==='approved'){
      for(const [stage,actor] of [['department',dept],['dean',dean],['magistracy',mag],['management',management]]){const row=item.stageProgress.find(x=>x.stage===stage);if(row.status!=='approved'){row.status='approved';row.actedBy=actor._id;row.actedAt=new Date(now-86400000);}}
      item.history.push({action:'approved',actor:management._id,actorRole:'management',fromStage:'management',toStage:'completed',comment:'Yakuniy tasdiq berildi.',revision:item.revision,createdAt:new Date(now-86400000)});
    }
    await item.save(); return item;
  }

  const waiting=await createSample({type:'dissertation_chapter',title:'Dissertatsiya 2-bobi: tajriba natijalari',abstract:'Tajriba natijalari, ularning statistik tahlili va ilmiy xulosalar ko‘rib chiqish uchun taqdim etildi.',status:'under_review',currentStage:'supervisor',supervisorStatus:'pending',priority:'high',age:1});
  const revision=await createSample({type:'article',title:'Raqamli ta’lim samaradorligini oshirish modeli',abstract:'Ilmiy maqolaning tahrirlangan qo‘lyozmasi va asosiy natijalari ilmiy rahbar tavsiyasi uchun yuborilgan.',status:'changes_requested',currentStage:'student',resumeStage:'supervisor',supervisorStatus:'changes_requested',supervisorComment:'Adabiyotlar sharhini kengaytiring va 3-jadval manbasini aniq ko‘rsating.',age:2});
  const departmentQueue=await createSample({type:'research_report',title:'Yarim yillik ilmiy-tadqiqot hisoboti',abstract:'Individual reja bo‘yicha bajarilgan tadqiqot ishlari, chop etilgan tezis va navbatdagi vazifalar hisoboti.',status:'under_review',currentStage:'department',supervisorStatus:'approved',departmentStatus:'pending',age:3});
  await createSample({type:'conference_material',title:'Yosh olimlar konferensiyasi uchun tezis',abstract:'Konferensiya tashkiliy qo‘mitasiga yuboriladigan tezis yakuniy ichki tasdiqlashdan o‘tkazildi.',status:'approved',currentStage:'completed',supervisorStatus:'approved',departmentStatus:'approved',deanStatus:'approved',magistracyStatus:'approved',managementStatus:'approved',revision:2,age:4});
  await Notification.insertMany([
    {recipient:supervisor._id,type:'submission',title:'Ilmiy rahbar: yangi ariza',message:`${waiting.applicationNo} ko‘rib chiqishingizni kutmoqda.`,link:`/submissions/${waiting._id}`,submission:waiting._id,createdBy:applicant._id},
    {recipient:applicant._id,type:'decision',title:`${revision.applicationNo}: tuzatish kerak`,message:'Ilmiy rahbar sharh qoldirdi. Arizani tuzatib qayta yuboring.',link:`/submissions/${revision._id}`,submission:revision._id,createdBy:supervisor._id},
    {recipient:dept._id,type:'submission',title:'Kafedra: yangi ilmiy ariza',message:`${departmentQueue.applicationNo} ilmiy rahbar tomonidan ma’qullandi.`,link:`/submissions/${departmentQueue._id}`,submission:departmentQueue._id,createdBy:supervisor._id}
  ]);
}

async function run(){
  await mongoose.connect(uri);
  const adminLogin=process.env.SUPERADMIN_LOGIN||'admin'; const adminPassword=process.env.SUPERADMIN_PASSWORD||'Admin123!';
  const admin=await ensureUser({login:adminLogin,role:'superadmin',fullName:'MD Bosh Administrator',email:'internal@md.local',active:true,mustChangePassword:false},adminPassword);
  if(process.env.NODE_ENV!=='production'){
    const tech=await ensureUser({login:'texnik01',role:'tech',fullName:'Texnik xodim Demo',active:true,mustChangePassword:false,createdBy:admin._id},'Demo123!');
    const management=await ensureUser({login:'rahbariyat',role:'management',fullName:'Rahbariyat Demo',active:true,mustChangePassword:false,createdBy:admin._id},'Demo123!');
    const mag=await ensureUser({login:'magistratura',role:'magistracy',fullName:'Magistratura bo‘limi Demo',active:true,mustChangePassword:false,createdBy:tech._id},'Demo123!');
    const dean=await ensureUser({login:'dekan01',role:'dean',fullName:'Muhandislik fakulteti dekani',faculty:'Muhandislik fakulteti',active:true,mustChangePassword:false,createdBy:mag._id},'Demo123!');
    const dept=await ensureUser({login:'kafedra01',role:'department',fullName:'AT kafedrasi mudiri',faculty:'Muhandislik fakulteti',department:'Axborot texnologiyalari',active:true,mustChangePassword:false,createdBy:dean._id},'Demo123!');
    const teacher=await ensureUser({login:'oqituvchi01',role:'teacher',fullName:'O‘qituvchi Demo',faculty:'Muhandislik fakulteti',department:'Axborot texnologiyalari',active:true,mustChangePassword:false,createdBy:dept._id},'Demo123!');
    const sup1=await ensureUser({login:'rahbar01',role:'supervisor',fullName:'Prof. A. Rahimov',faculty:'Muhandislik fakulteti',department:'Axborot texnologiyalari',active:true,mustChangePassword:false,createdBy:dept._id},'Demo123!');
    const sup2=await ensureUser({login:'rahbar02',role:'supervisor',fullName:'Dots. D. Karimova',faculty:'Muhandislik fakulteti',department:'Axborot texnologiyalari',active:true,mustChangePassword:false,createdBy:dept._id},'Demo123!');
    const sup3=await ensureUser({login:'rahbar03',role:'supervisor',fullName:'PhD B. Saidov',faculty:'Energetika fakulteti',department:'Energetika tizimlari',active:true,mustChangePassword:false,createdBy:mag._id},'Demo123!');
    const sup4=await ensureUser({login:'rahbar04',role:'supervisor',fullName:'Prof. M. Xolmatov',faculty:'Iqtisodiyot fakulteti',department:'Menejment',active:true,mustChangePassword:false,createdBy:mag._id},'Demo123!');
    const supervisors=[sup1,sup2,sup3,sup4];
    let students=await Student.find().sort({createdAt:1});
    if(students.length===0){
      const firstNames=['Aziz','Dilnoza','Bekzod','Mohira','Alisher','Shahnoza','Javohir','Madina','Sardor','Nargiza','Diyor','Maftuna','Akmal','Zilola','Islom','Rayhona','Otabek','Sevara','Kamron','Nilufar','Sherzod','Munisa','Bobur','Gulnoza','Ibrohim','Farangiz','Temur','Malika','Sanjar','Laylo'];
      const lastNames=['Abdullayev','Karimova','Rasulov','Saidova','Nazarov','Yusupova','Ergashev','Tursunova','Qodirov','Rustamova'];
      const orgs=[{faculty:'Muhandislik fakulteti',department:'Axborot texnologiyalari',specialty:'Axborot tizimlari',group:'M-AT'},{faculty:'Muhandislik fakulteti',department:'Axborot texnologiyalari',specialty:'Kompyuter injiniringi',group:'M-KI'},{faculty:'Energetika fakulteti',department:'Energetika tizimlari',specialty:'Elektr energetikasi',group:'M-EE'},{faculty:'Iqtisodiyot fakulteti',department:'Menejment',specialty:'Menejment',group:'M-MN'}];
      for(let i=0;i<30;i++){
        const o=orgs[i%orgs.length]; const attendance=clamp(62+(i*11)%39), plan=clamp(48+(i*9)%53), diss=clamp(35+(i*13)%66), academic=clamp(55+(i*7)%46), science=clamp(38+(i*17)%63);
        let sup=supervisors[i%4]; if(o.faculty==='Energetika fakulteti')sup=sup3;if(o.faculty==='Iqtisodiyot fakulteti')sup=sup4;
        const st=new Student({fullName:`${lastNames[i%lastNames.length]} ${firstNames[i]}`,studentId:`MAG-${2026001+i}`,group:`${o.group}-${101+i%5}`,faculty:o.faculty,department:o.department,specialty:o.specialty,educationForm:'Magistratura',admissionYear:i%2?2025:2026,course:i%2?2:1,supervisor:sup._id,attendance,individualPlan:plan,dissertationProgress:diss,academicScore:academic,scientificActivity:science,academicDebtCount:academic<65?1+(i%2):0,documentsCompleteness:0,dissertationTitle:`${o.specialty} yo‘nalishida zamonaviy tadqiqot va amaliy yechimlar`,dissertationStage:Math.max(1,Math.min(12,Math.ceil(diss/8.34))),createdBy:mag._id});st.recalculateStatus();await st.save();students.push(st);
      }
      const studentUser=await ensureUser({login:'mag001',role:'student',fullName:students[0].fullName,faculty:students[0].faculty,department:students[0].department,active:true,mustChangePassword:false,createdBy:dept._id},'Demo123!');
      students[0].user=studentUser._id;students[0].phone='+998 90 123 45 67';students[0].email='mag001@md.local';students[0].telegram='@mag001';students[0].region='Qashqadaryo viloyati';students[0].district='Qarshi shahri';students[0].researchInterests='Raqamli texnologiyalar, ma’lumotlar tahlili';students[0].recalculateProfileCompleteness();await students[0].save();
    }
    // Mavjud yozuvlarda ham v2.4 profile completeness ni hisoblab qo‘yamiz.
    for (const st of students) { st.recalculateProfileCompleteness(); await st.save(); }
    // Tez kiritish katalogini mavjud magistrantlardan yig‘ish.
    for (const st of students) {
      if (!st.faculty || !st.department || !st.specialty || !st.group) continue;
      await AcademicStructure.findOneAndUpdate(
        { faculty:st.faculty, department:st.department, specialty:st.specialty, group:st.group },
        { $setOnInsert:{ faculty:st.faculty, department:st.department, specialty:st.specialty, group:st.group, course:st.course||1, admissionYear:st.admissionYear, educationForm:st.educationForm||'Magistratura', defaultSupervisor:st.supervisor||undefined, active:true, createdBy:mag._id } },
        { upsert:true, new:true }
      );
    }
    await seedAux(students,{mag,supervisors,dept,teacher});
    await seedWorkflow(students,{supervisors,dept,dean,mag,management});

    if (await ProgressSnapshot.countDocuments() === 0) {
      const now = Date.now();
      for (let d = 9; d >= 0; d--) {
        const day = new Date(now - d*86400000).toISOString().slice(0,10);
        for (let i=0;i<students.length;i++) {
          const st=students[i]; const gain=9-d;
          await ProgressSnapshot.create({
            student:st._id, day,
            attendance:clamp(Number(st.attendance||0)-Math.max(0,5-gain)+((i%3)-1)),
            plan:clamp(Number(st.individualPlan||0)-Math.max(0,7-gain)),
            dissertation:clamp(Number(st.dissertationProgress||0)-Math.max(0,9-gain)),
            science:clamp(Number(st.scientificActivity||0)-Math.max(0,4-gain)),
            documents:clamp(Number(st.documentsCompleteness||0)-Math.max(0,5-gain)),
            readiness:clamp(Number(st.graduationReadiness||0)-Math.max(0,6-gain)),
            status:st.status
          });
        }
      }
    }
    if (await DissertationMilestone.countDocuments() === 0) {
      for (const st of students.slice(0, 12)) {
        const maxStage = Math.max(1, Math.min(12, Number(st.dissertationStage || 1)));
        for (let stage = 1; stage <= maxStage; stage++) {
          const approved = stage < maxStage;
          await DissertationMilestone.create({
            student: st._id, stage, title: DISSERTATION_STAGES[stage-1],
            status: approved ? 'approved' : 'in_progress',
            percent: approved ? 100 : Math.max(20, Math.min(90, Number(st.dissertationProgress || 40))),
            dueDate: new Date(Date.now() + (stage-maxStage+2)*14*86400000),
            note: approved ? 'Demo: bosqich tasdiqlangan.' : 'Demo: joriy ish bosqichi.',
            updatedBy: st.supervisor || mag._id
          });
        }
      }
    }
    console.log('\nDemo hisoblar:');
    console.log('admin / env SUPERADMIN_PASSWORD');
    console.log('texnik01, rahbariyat, magistratura, dekan01, kafedra01, oqituvchi01, rahbar01, mag001 / Demo123!');
  }
  console.log('Seed complete.');await mongoose.disconnect();
}
run().catch(async e=>{console.error(e);await mongoose.disconnect();process.exit(1);});

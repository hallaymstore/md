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
const SubmissionApplication = require('../src/models/SubmissionApplication');

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/qdt_monitor';
async function ensureUser(data,password){let u=await User.findOne({login:data.login});if(!u){u=new User({...data,passwordHash:'pending'});await u.setPassword(password);await u.save();}return u;}
const clamp=n=>Math.max(0,Math.min(100,n));

async function seedAux(students, actors){
  const {mag, supervisors, dept, teacher}=actors;
  if(await ScientificActivity.countDocuments()===0){
    for(let i=0;i<students.length;i++){
      const s=students[i];
      if(i%2===0) await ScientificActivity.create({student:s._id,type:'publication',title:`${s.specialty} bo‘yicha ilmiy maqola ${i+1}`,organization:i%4===0?'Respublika ilmiy jurnali':'Universitet ilmiy to‘plami',date:new Date(Date.now()-(i+2)*86400000),status:i%3===0?'published':'submitted',score:clamp(55+(i*7)%45),createdBy:mag._id});
      if(i%3===0) await ScientificActivity.create({student:s._id,type:'conference',title:'Yosh olimlar ilmiy-amaliy konferensiyasi',organization:'QDTU',date:new Date(Date.now()-(i+4)*86400000),status:'completed',score:75,createdBy:mag._id});
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
      if(s.attendance<75) await Task.create({title:'Davomat ko‘rsatkichini yaxshilash',description:'Davomat sabablari bo‘yicha tushuntirish va chora rejasini kiriting.',type:'attendance',priority:s.attendance<65?'critical':'high',student:s._id,faculty:s.faculty,department:s.department,assignedTo:s.supervisor,dueDate:new Date(Date.now()+(5+i%4)*86400000),createdBy:mag._id});
      if(s.dissertationProgress<60) await Task.create({title:'Dissertatsiya jadvalidan ortda qolish',description:'Joriy bob bo‘yicha ishni yakunlash va rahbarga topshirish.',type:'dissertation',priority:'high',student:s._id,faculty:s.faculty,department:s.department,assignedTo:s.supervisor,dueDate:new Date(Date.now()+(8+i%6)*86400000),createdBy:mag._id});
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

async function run(){
  await mongoose.connect(uri);
  const adminLogin=process.env.SUPERADMIN_LOGIN||'admin'; const adminPassword=process.env.SUPERADMIN_PASSWORD||'Admin123!';
  const admin=await ensureUser({login:adminLogin,role:'superadmin',fullName:'QDTU Bosh Administrator',email:'internal@qdt.uz',active:true,mustChangePassword:false},adminPassword);
  if(process.env.NODE_ENV!=='production'){
    const tech=await ensureUser({login:'texnik01',role:'tech',fullName:'Texnik xodim Demo',active:true,mustChangePassword:false,createdBy:admin._id},'Demo123!');
    const management=await ensureUser({login:'rahbariyat',role:'management',fullName:'Universitet rahbariyati Demo',active:true,mustChangePassword:false,createdBy:admin._id},'Demo123!');
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
      students[0].user=studentUser._id;students[0].phone='+998 90 123 45 67';students[0].email='mag001@qdt.uz';students[0].telegram='@mag001';students[0].region='Qashqadaryo viloyati';students[0].district='Qarshi shahri';students[0].researchInterests='Raqamli texnologiyalar, ma’lumotlar tahlili';students[0].recalculateProfileCompleteness();await students[0].save();
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
    if(await SubmissionApplication.countDocuments()===0){
      const demoStudent=await Student.findOne({user:{$exists:true,$ne:null}});
      if(demoStudent&&demoStudent.supervisor){
        await SubmissionApplication.create({
          student:demoStudent._id,createdBy:demoStudent.user,supervisor:demoStudent.supervisor,faculty:demoStudent.faculty,department:demoStudent.department,group:demoStudent.group,specialty:demoStudent.specialty,
          type:'publication',title:'Demo: magistrant ilmiy maqolasi — approval workflow',description:'Bu demo yozuv supervisor → kafedra → dekanat → magistratura zanjirini darhol ko‘rish va sinash uchun seed orqali yaratilgan.',organization:'QDTU ilmiy to‘plami',keywords:'demo, workflow, magistratura',status:'in_review',currentStage:'supervisor',revision:1,
          history:[{stage:'student',actorRole:'student',actor:demoStudent.user,action:'submitted',comment:'Demo ariza ilmiy rahbar ko‘rib chiqishi uchun yuborildi.',fromStage:'student',toStage:'supervisor',revision:1}]
        });
      }
    }
    console.log('\nDemo hisoblar:');
    console.log('admin / env SUPERADMIN_PASSWORD');
    console.log('texnik01, rahbariyat, magistratura, dekan01, kafedra01, oqituvchi01, rahbar01, mag001 / Demo123!');
  }
  console.log('Seed complete.');await mongoose.disconnect();
}
run().catch(async e=>{console.error(e);await mongoose.disconnect();process.exit(1);});

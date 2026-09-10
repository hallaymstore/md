const path = require('path');
const ejs = require('ejs');
const workflow = require('../src/config/submissionWorkflow');
const { ROLE_LABELS } = require('../src/config/roles');
const dissertationStages = require('../src/utils/dissertationStages');

const root = path.join(__dirname, '..');
const now = new Date();
const studentUser = { _id:'user-student', role:'student', fullName:'Demo Magistrant' };
const supervisorUser = { _id:'user-supervisor', role:'supervisor', fullName:'Demo Ilmiy Rahbar', department:'Axborot texnologiyalari' };
const student = {
  _id:'student-1', user:'user-student', fullName:'Demo Magistrant', studentId:'MAG-001', faculty:'Muhandislik fakulteti', department:'Axborot texnologiyalari', specialty:'Axborot tizimlari', group:'M-AT-101', course:1, admissionYear:2026, educationForm:'Magistratura', studyStatus:'active', supervisor:supervisorUser,
  status:'green', attendance:92, academicScore:88, individualPlan:82, dissertationProgress:76, scientificActivity:85, documentsCompleteness:80, graduationReadiness:80, profileCompleteness:70, dissertationStage:8, academicDebtCount:0, dissertationTitle:'Raqamli ta’lim modeli'
};
const stageProgress = workflow.buildStageProgress(supervisorUser._id).map((row,index)=>({ ...row, status:index===0?'pending':'waiting' }));
const submission = {
  _id:'submission-1', __v:2, applicationNo:'MD-2026-ABC1234', student, applicant:studentUser, supervisor:supervisorUser,
  faculty:student.faculty, department:student.department, specialty:student.specialty, group:student.group,
  type:'dissertation_chapter', title:'Dissertatsiya tajriba natijalari', abstract:'Tajriba natijalari va ilmiy xulosalar ko‘rib chiqish uchun batafsil taqdim qilindi.',
  keywords:['tajriba','tahlil'], externalLink:'https://example.com/source', studentNote:'Jadval va ilovalar biriktirildi.', priority:'high', targetDate:now,
  status:'under_review', currentStage:'supervisor', resumeStage:'supervisor', revision:1, attachments:[], stageProgress,
  history:[{action:'created',actor:studentUser,actorRole:'student',toStage:'student',comment:'Qoralama yaratildi.',revision:1,createdAt:now},{action:'submitted',actor:studentUser,actorRole:'student',fromStage:'student',toStage:'supervisor',comment:'Ko‘rib chiqishga yuborildi.',revision:1,createdAt:now}],
  submittedAt:now,lastActionAt:now,createdAt:now,updatedAt:now
};

const common = { path:'/submissions', roleLabels:ROLE_LABELS, unreadNotifications:2, flash:null, ...workflow };

async function render(relative, locals) {
  const html = await ejs.renderFile(path.join(root, 'views', relative), locals, { async:false });
  if (!html.includes('<!doctype html>') || !html.includes('</html>')) throw new Error(`${relative}: incomplete HTML`);
}

(async()=>{
  await render('submissions/index.ejs',{...common,currentUser:supervisorUser,title:'Arizalar',submissions:[submission],stats:{total:1,pending:1,approved:0,changes:0,rejected:0,drafts:0,reviewing:1,overdue:0},filters:{status:'',stage:'',type:'',q:''},pagination:{page:1,pages:1,total:1}});
  await render('submissions/new.ejs',{...common,currentUser:studentUser,title:'Yangi ariza',student});
  await render('submissions/show.ejs',{...common,currentUser:supervisorUser,title:'Ariza',submission,permissions:{canEdit:false,canSubmit:false,canWithdraw:false,canReview:true,canComment:true,canAdmin:false},supervisors:[]});
  await render('notifications/index.ejs',{...common,currentUser:studentUser,title:'Bildirishnomalar',notifications:[{_id:'notice-1',type:'decision',title:'Qaror',message:'Ariza ko‘rib chiqildi.',link:'/submissions/submission-1',createdAt:now,readAt:null,createdBy:supervisorUser}]});
  const groupMetric={name:student.group,total:1,course1:1,course2:0,attendance:92,plan:82,dissertation:76,science:85,academic:88,documents:80,readiness:80,red:0};
  const portfolio={count:1,latest:{title:'Demo ilmiy maqola',type:'Ilmiy maqola',date:now}};
  await render('dashboard/index.ejs',{
    ...common,currentUser:studentUser,title:'Bosh panel',dashboardView:'roles/student',students:[student],
    kpis:{total:1,course1:1,course2:0},groupStats:[groupMetric],docStats:{missing:0},science:[{title:'Demo'}],scienceStats:{publications:1,conferences:0},openTasks:[],
    submissionStats:{total:1,pending:0,approved:1,reviewing:0},submissionRecent:[submission],submissionTypeLabels:workflow.SUBMISSION_TYPES,submissionStatusLabels:workflow.STATUS_LABELS,submissionStatusTones:workflow.STATUS_TONES
  });
  await render('dashboard/group.ejs',{...common,currentUser:supervisorUser,title:'M-AT-101 guruhi',groupName:'M-AT-101',students:[{...student,portfolio}],metrics:groupMetric});
  await render('students/view.ejs',{
    ...common,currentUser:supervisorUser,title:student.fullName,student,stages:dissertationStages,profileAccess:{self:false,full:false,limited:true,academic:true},
    activityFeed:[{key:'work-1',kind:'science',typeLabel:'Ilmiy maqola',title:'Demo ilmiy maqola',summary:'Ilmiy natijalar tavsifi.',organization:'MD',date:now,statusLabel:'Chop etilgan',statusTone:'green',score:90,externalUrl:'https://example.com',detailUrl:'/science',applicationNo:''}],
    portfolioStats:{total:1,publications:1,conferences:0,approved:0}
  });
  console.log('OK: workflow, live dashboard, group statistics and student portfolio pages rendered.');
})().catch(error=>{console.error(error);process.exit(1);});

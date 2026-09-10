const assert = require('assert');
const mongoose = require('mongoose');
const { WORKFLOW_STAGES, nextStage, buildStageProgress, canReview } = require('../src/config/submissionWorkflow');
const ResearchSubmission = require('../src/models/ResearchSubmission');

assert.deepStrictEqual(WORKFLOW_STAGES, ['supervisor','department','dean','magistracy','management']);
assert.strictEqual(nextStage('supervisor'), 'department');
assert.strictEqual(nextStage('department'), 'dean');
assert.strictEqual(nextStage('dean'), 'magistracy');
assert.strictEqual(nextStage('magistracy'), 'management');
assert.strictEqual(nextStage('management'), null);

const progress=buildStageProgress('supervisor-1');
assert.strictEqual(progress.length, 5);
assert.strictEqual(progress[0].assignedTo, 'supervisor-1');
assert.ok(progress.every(item=>item.status==='waiting'));

const base={status:'under_review',currentStage:'supervisor',supervisor:'supervisor-1',faculty:'Muhandislik',department:'AT'};
assert.strictEqual(canReview({_id:'supervisor-1',role:'supervisor'},base),true);
assert.strictEqual(canReview({_id:'supervisor-2',role:'supervisor'},base),false);
assert.strictEqual(canReview({_id:'supervisor-1',role:'teacher'},base),true);
assert.strictEqual(canReview({_id:'admin',role:'superadmin'},base),true);
assert.strictEqual(canReview({_id:'dept',role:'department',department:'AT'},{...base,currentStage:'department'}),true);
assert.strictEqual(canReview({_id:'dean',role:'dean',faculty:'Boshqa'},{...base,currentStage:'dean'}),false);
assert.strictEqual(canReview({_id:'mag',role:'magistracy'},{...base,currentStage:'magistracy'}),true);
assert.strictEqual(canReview({_id:'management',role:'management'},{...base,currentStage:'management',status:'approved'}),false);

(async()=>{
  const ids=Array.from({length:3},()=>new mongoose.Types.ObjectId());
  const document=new ResearchSubmission({student:ids[0],applicant:ids[1],supervisor:ids[2],faculty:'Fakultet',department:'Kafedra',type:'article',title:'Sinov ilmiy maqolasi',abstract:'Ilmiy arizaning model validatsiyasi uchun yetarli uzunlikdagi sinov mazmuni.',stageProgress:buildStageProgress(ids[2])});
  await document.validate();
  assert.match(document.applicationNo,/^MD-\d{4}-[A-F0-9]{10}$/);
  assert.strictEqual(document.stageProgress.length,5);
  console.log('OK: research workflow stage order, permissions and model validation passed.');
})().catch(error=>{console.error(error);process.exit(1);});

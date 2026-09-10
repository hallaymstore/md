const ProgressSnapshot = require('../models/ProgressSnapshot');

async function captureSnapshots(students=[]) {
  const day = new Date().toISOString().slice(0,10);
  if (!students.length) return;
  const ops = students.map(s => ({
    updateOne: {
      filter: { student:s._id, day },
      update: { $set: {
        attendance:Number(s.attendance||0), plan:Number(s.individualPlan||0), dissertation:Number(s.dissertationProgress||0),
        science:Number(s.scientificActivity||0), documents:Number(s.documentsCompleteness||0), readiness:Number(s.graduationReadiness||0), status:s.status||'yellow'
      } },
      upsert:true
    }
  }));
  await ProgressSnapshot.bulkWrite(ops,{ordered:false});
}
module.exports={captureSnapshots};

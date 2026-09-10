const assert = require('assert');
const { groupStudentMetrics } = require('../src/services/dashboardData');
const { scopeQueryForUser } = require('../src/middleware/auth');
const dashboardController = require('../src/controllers/dashboard.controller');

const rows = [
  { group:'M-AT-101', course:1, status:'green', attendance:90, individualPlan:80, dissertationProgress:70, scientificActivity:60, academicScore:85, documentsCompleteness:75, graduationReadiness:78 },
  { group:'M-AT-101', course:2, status:'red', attendance:70, individualPlan:60, dissertationProgress:50, scientificActivity:40, academicScore:65, documentsCompleteness:55, graduationReadiness:58 },
  { group:'M-KI-201', course:2, status:'yellow', attendance:80, individualPlan:75, dissertationProgress:72, scientificActivity:70, academicScore:78, documentsCompleteness:68, graduationReadiness:73 }
];

const groups = groupStudentMetrics(rows, 'group');
assert.strictEqual(groups.length, 2);
assert.deepStrictEqual(
  { total:groups[0].total, course1:groups[0].course1, course2:groups[0].course2, red:groups[0].red, readiness:groups[0].readiness },
  { total:2, course1:1, course2:1, red:1, readiness:68 }
);

assert.deepStrictEqual(scopeQueryForUser({ role:'management' }, { group:'M-AT-101' }), { group:'M-AT-101' });
assert.deepStrictEqual(scopeQueryForUser({ role:'dean', faculty:'Muhandislik' }, { group:'M-AT-101' }), { group:'M-AT-101', faculty:'Muhandislik' });
assert.deepStrictEqual(scopeQueryForUser({ role:'department', department:'AT' }, { group:'M-AT-101' }), { group:'M-AT-101', department:'AT' });
assert.deepStrictEqual(scopeQueryForUser({ role:'supervisor', _id:'sup-1' }, { group:'M-AT-101' }), { group:'M-AT-101', supervisor:'sup-1' });
assert.deepStrictEqual(scopeQueryForUser({ role:'student', _id:'student-user-1' }, { group:'M-AT-101' }), { group:'M-AT-101', user:'student-user-1' });
assert.strictEqual(typeof dashboardController.live, 'function');
assert.strictEqual(typeof dashboardController.group, 'function');

console.log('OK: live group metrics, course split and role-scoped group access passed.');

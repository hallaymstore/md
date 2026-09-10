const ROLES = {
  SUPERADMIN: 'superadmin',
  TECH: 'tech',
  MANAGEMENT: 'management',
  MAGISTRACY: 'magistracy',
  DEAN: 'dean',
  DEPARTMENT: 'department',
  SUPERVISOR: 'supervisor',
  TEACHER: 'teacher',
  STUDENT: 'student'
};

const ROLE_LABELS = {
  superadmin: 'Bosh administrator',
  tech: 'Texnik xodim',
  management: 'Rahbariyat',
  magistracy: 'Magistratura bo‘limi',
  dean: 'Dekanat / fakultet',
  department: 'Kafedra',
  supervisor: 'Ilmiy rahbar',
  teacher: 'O‘qituvchi',
  student: 'Magistrant'
};

/*
 * Governance v2.4:
 * - Superadmin: master-data, credentials, destructive operations and global governance.
 * - Tech: almost all operational work, but cannot create/change credentials of
 *   superadmin or management accounts and cannot alter master academic names.
 */
const CAN_CREATE = {
  superadmin: ['tech','management','magistracy','dean','department','supervisor','teacher','student'],
  tech: ['magistracy','dean','department','supervisor','teacher','student'],
  magistracy: ['dean','department','supervisor','teacher','student'],
  dean: ['department','supervisor','teacher','student'],
  department: ['supervisor','teacher','student']
};

const PROTECTED_CREDENTIAL_ROLES = ['superadmin','management'];
const OPERATIONAL_ADMIN_ROLES = ['superadmin','tech'];
const DATA_EDITOR_ROLES = ['superadmin','tech','magistracy','dean','department'];

module.exports = {
  ROLES,
  ROLE_LABELS,
  CAN_CREATE,
  PROTECTED_CREDENTIAL_ROLES,
  OPERATIONAL_ADMIN_ROLES,
  DATA_EDITOR_ROLES
};

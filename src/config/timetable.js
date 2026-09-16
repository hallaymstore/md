const PERIODS = [
  { no: 1, start: '08:30', end: '09:50' },
  { no: 2, start: '10:00', end: '11:20' },
  { no: 3, start: '11:30', end: '12:50' },
  { no: 4, start: '13:30', end: '14:50' },
  { no: 5, start: '15:00', end: '16:20' },
  { no: 6, start: '16:30', end: '17:50' },
  { no: 7, start: '18:00', end: '19:20' }
];

const DAYS = [
  { no: 1, short: 'Du', name: 'Dushanba' },
  { no: 2, short: 'Se', name: 'Seshanba' },
  { no: 3, short: 'Ch', name: 'Chorshanba' },
  { no: 4, short: 'Pa', name: 'Payshanba' },
  { no: 5, short: 'Ju', name: 'Juma' },
  { no: 6, short: 'Sh', name: 'Shanba' }
];

const LESSON_TYPES = {
  lecture: 'Ma’ruza',
  practice: 'Amaliyot',
  lab: 'Laboratoriya',
  seminar: 'Seminar',
  online: 'Onlayn'
};

module.exports = { PERIODS, DAYS, LESSON_TYPES };

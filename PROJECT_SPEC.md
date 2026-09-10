# QDTU Magistratura 360 v2.7 — Magistracy Intelligence Architecture

## Platforma chegarasi

HEMIS bilan raqobatlashuvchi umumiy LMS emas. Platforma magistratura bo‘limining operatsion qaror, nazorat va ilmiy workflow tizimi sifatida qurilgan.

### HEMISdan olinadigan asosiy ma’lumotlar
- magistrant kontingenti;
- akademik struktura;
- kurs/guruh;
- davomat va o‘zlashtirish kabi bazaviy indikatorlar.

### QDTU 360da boshqariladigan magistratura-specific ma’lumotlar
- ilmiy rahbar yuklamasi;
- dissertatsiya 12 bosqich timeline;
- ilmiy ariza approval chain;
- reviewer sharhlari, revision va audit history;
- risk/intervention registri;
- social academic portfolio;
- evidence/source fayllar;
- muammo → task → deadline → resolution;
- bitiruv readiness;
- guruh live drill-down.

## Role matrix

| Rol | Scope | Asosiy panel |
|---|---|---|
| Superadmin | Global | Governance + control + audit |
| Tech | Global operational | Texnik boshqaruv |
| Management | Global read/approval | Executive analytics |
| Magistracy | Global magistratura | 360 operations |
| Dean | Faculty | Fakultet dashboard |
| Department | Department | Kafedra dashboard |
| Supervisor | Assigned students | Ilmiy rahbar dashboard |
| Teacher | Department | O‘quv/monitoring dashboard |
| Student | Self | Self-service + portfolio |

## Research approval
Magistrant → Ilmiy rahbar → Kafedra → Dekanat → Magistratura → Rahbariyat → Approved.

`changes_requested` arizani studentga qaytaradi va `resumeStage` orqali aynan qaytargan bosqichdan davom etadi. Har qaror audit/historyga yoziladi.

## Risk engine
Risk score rules are explainable, not opaque AI. Har bir risk sababi foydalanuvchiga ko‘rsatiladi. Bu keyinchalik ML model bilan almashtirilishi mumkin, lekin operatsion qaror uchun hozir ham tushunarli.

## HEMIS Bridge
CSV preview/import. Upsert student ID bo‘yicha, fallback F.I.Sh.+guruh. HEMIS yangilanishi platformaga xos ilmiy va workflow ma’lumotlarini overwrite qilmaydi.

## Production roadmap
- rasmiy HEMIS API bo‘lsa API sync adapter;
- R2/S3/MinIO protected object storage;
- CSRF + rate limit + antivirus scanning;
- scheduled snapshot/trend analytics;
- Telegram/e-mail notification adapter;
- rector/prorector KPI wallboard;
- data retention va backup policy.

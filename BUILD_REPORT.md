# v2.7 Build Report — eski paketlar tahlili

## 1. v2.6.1 ATLAS-FIX
Bu paket juda qisqartirilgan edi: faqat Student/Group/Activity va oddiy dashboard yo‘nalishi qolgan. Governance, 9-role RBAC, approval, audit, notifications, monitoring, structure, seminar/doc/task modullari yo‘qolgan. Shu sabab **yangi build uchun base sifatida olinmadi**.

## 2. MD-QDTU-v2.5-APPROVAL-WORKFLOW
Kuchli tomoni — magistrantdan rahbariyatgacha approval zanjiri, revision/history va role scope. Lekin LIVE versiyaga nisbatan guruh live analytics, social portfolio va yangi ResearchSubmission modeli keyinroq rivojlantirilgan.

## 3. QDTU v2.6 LIVE-GROUP-SOCIAL
Eng to‘liq base: 9 rol, role dashboards, control, audit, notifications, analytics, monitoring, science, seminars, docs, tasks, master structure, protected submissions, live group drill-down va student portfolio mavjud. **v2.7 aynan shu paket ustiga qurildi.**

## v2.7 da qo‘shilganlar
- explainable Early Warning / Risk Center;
- Supervisor Capacity / Load dashboard;
- 12-stage dissertation milestones;
- HEMIS CSV bridge with preview/import history;
- Atlas URI compatibility (`MONGODB_URI` + `MONGO_URI`);
- Windows start/seed/verify scripts;
- preserved live dashboard + approval + social portfolio.

## HEMIS bilan pozitsiyalash
HEMISning umumiy akademik/ma’muriy funksiyalarini nusxalash o‘rniga, platforma magistraturaga xos workflow va operatsion nazoratga urg‘u beradi:
- dissertatsiya stage evidence;
- multilevel academic approval;
- supervisor workload;
- explainable risk reasons;
- intervention tasks;
- verified research portfolio;
- real-time group command center.

Kelajakda rasmiy HEMIS API mavjud va ruxsat etilgan bo‘lsa CSV bridge o‘rniga API adapter qo‘shish uchun controller alohida ajratilgan.

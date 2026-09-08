# MD QDTU — v2.5 approval workflow xaritasi

## Asosiy tamoyil
Magistratura bo‘limi xodimlari barcha source va ilmiy ishlarni qo‘lda yig‘ib yurmaydi. Magistrant o‘z materialini o‘zi ariza qilib yuboradi; akademik tasdiqlash tizim bo‘ylab rol va tashkilot scope asosida yuradi.

## Approval pipeline

### Oddiy ilmiy material
1. Magistrant yuboradi.
2. Ilmiy rahbar ko‘radi, sharh beradi: approve / revision / reject.
3. Approve bo‘lsa kafedra mudiriga.
4. Kafedra mudiri approve / revision / reject.
5. Approve bo‘lsa dekanatga.
6. Dekanat approve / revision / reject.
7. Approve bo‘lsa Magistratura bo‘limiga.
8. Magistratura approve qilsa yakuniy `approved`.

### Yuqori darajadagi material
`dissertation`, `thesis`, `defense` turlari Magistratura tasdig‘idan keyin **Universitet rahbariyati** bosqichiga o‘tadi.

## Revision mexanizmi
Reviewer `Qayta ishlashga qaytarish` qilganda:
- `returnStage` saqlanadi;
- ariza `student / needs_revision` holatiga o‘tadi;
- magistrant tavsiyalarni ko‘radi;
- yangi fayl(lar) qo‘shishi, nom/mazmun/havolani yangilashi mumkin;
- revision +1 bo‘ladi;
- ariza boshidan emas, aynan qaytargan reviewer bosqichiga boradi.

Eski fayllar revision tarixi uchun saqlanadi.

## Approval visibility
| Rol | Ko‘rish | Qaror |
|---|---|---|
| Superadmin | Barcha ariza | Har qanday joriy bosqichda override + metadata/delete |
| Tech | Barcha ariza | Yo‘q; operatsion kuzatuv/sharh |
| Management | Barcha, executive | Faqat `management` bosqichi |
| Magistracy | Barcha magistratura arizalari | Faqat `magistracy` bosqichi |
| Dean | O‘z fakulteti | Faqat `dean` bosqichi |
| Department | O‘z kafedrasi | Faqat `department` bosqichi |
| Supervisor | O‘z magistrantlari | Faqat `supervisor` bosqichi |
| Teacher | Approval workflow yo‘q | Yo‘q |
| Student | Faqat o‘zi yaratgan | Yangi/resubmit; akademik qaror yo‘q |

## Audit trail
Har event:
- actor user + role;
- stage;
- action;
- comment;
- fromStage / toStage;
- revision;
- timestamp.

## Student-first source upload
Ariza yaratishda:
- material turi;
- nomi;
- mazmuni;
- jurnal/tashkilot;
- sana;
- kalit so‘zlar;
- link;
- 1–5 ta source/hujjat;
- ilmiy rahbarga izoh.

Fayllar mavjud `Upload` repositoryga ham yoziladi va student/faculty/department bilan bog‘lanadi.

## Dashboard integratsiyasi
Student, supervisor, department, dean, magistracy, management, tech va superadmin dashboardlarida ariza navbati va statistikasi ko‘rinadi. Sidebar/topbar pending badge mavjud.

## Global admin control
`/control` ichida SubmissionApplication soni va pending soni ko‘rinadi. Global qidiruv ariza nomi, description, fakultet, kafedra va guruhdan ham topadi. Student delete cascade arizalarni ham tozalaydi.

## Saqlangan modullar
- Master academic data
- Magistrantlar bazasi va quick-entry
- Self-profile va privacy visibility
- Davomat/o‘zlashtirish/individual reja
- Dissertatsiya 12 bosqich
- Seminar/hujjat/task monitoring
- Ilmiy portfel
- Global control/audit/data quality
- Kunduzgi/tungi theme
- Responsive compact premium UI

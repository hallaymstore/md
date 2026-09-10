# v2.7.1 Action Cards + Live Animated Dashboard

## Bosiladigan asosiy kartalar
- Jami magistrant -> `/students`
- 1-kurs -> `/students?course=1`
- 2-kurs -> `/students?course=2`
- Guruhlar -> dashboarddagi guruhlar kesimiga smooth-scroll
- Har bir guruh -> `/dashboard/groups/:group`

## Administrator kartalari
- Foydalanuvchilar -> `/users`
- Magistrantlar -> `/students`
- Bugungi audit -> `/audit`
- Fayllar -> `/uploads`
- Ochiq topshiriq -> `/tasks`
- Bitiruv tayyorgarligi -> `/analytics`

## Boshqa rollardagi KPI mapping
Davomat/Reja/O‘zlashtirish -> Monitoring; Dissertatsiya -> Milestones; Hujjatlar -> Documents; Ilmiy faoliyat/Maqola/Konferensiya -> Science; Seminar -> Seminars; Muammoli -> Risk markazi; Rahbar -> Supervisor workload.

## Animatsiya
- GPU-friendly wave/pulse (transform + opacity)
- Hover lift + glow
- Progress flow
- SSE yangilanganda sync pulse
- Keyboard Enter/Space navigation
- `prefers-reduced-motion` qo‘llab-quvvatlanadi

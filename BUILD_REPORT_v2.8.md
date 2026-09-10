# Build report — v2.8 SOCIAL PROFILES ULTRA MOTION

## Base
- QDTU Magistratura 360 v2.7.1 ACTION-CARDS-LIVE-ANIMATED.
- Mavjud role panels, monitoring, analytics, approval workflow, risk intelligence, dissertation timeline va HEMIS bridge saqlandi.

## Qo‘shilgan funksiyalar
- Universal `/profile` va `/profile/:id` ichki profil sahifalari.
- Barcha 9 rol uchun avatar upload va rolga mos default avatar.
- Magistrant profilida tasdiqlangan ilmiy portfolio; boshqa rollarga permission asosida cheklangan ko‘rinish.
- Dashboardlarda cross-role community statistikasi va bosiladigan profile ribbon.
- Student dashboard headline KPI: Davomat, Individual reja, Dissertatsiya, Ilmiy faollik.
- Aylanuvchi `%` token, aurora/wave/sweep, progress shine, avatar aura va micro-card animatsiyalari.
- Low-end adaptive motion: save-data, deviceMemory/hardwareConcurrency, IntersectionObserver off-screen pause, hidden-tab pause.

## Tekshiruv
- Barcha JavaScript fayllar `node --check` orqali syntax tekshiruvdan o‘tdi.
- 57 ta EJS fayl uchun delimiter va static include path tekshiruvi o‘tdi.
- CSS brace balansi tekshirildi.
- `node_modules` ZIP ichiga kiritilmadi; Windowsda `npm install` bajariladi.
- Konteyner registry ulanishi sekinligi sabab `npm ci` yakuniy dependency testini shu muhitda tugata olmadi.

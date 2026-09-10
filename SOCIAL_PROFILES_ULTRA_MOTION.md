# v2.8 — Social Profiles + Ultra Motion

v2.7.1 ACTION-CARDS-LIVE-ANIMATED asosida kengaytirildi.

## Yangi imkoniyatlar
- Barcha rollar uchun profil rasmi yuklash (JPG/PNG/WEBP, 3 MB).
- Rasm bo‘lmasa rolga mos avtomatik default ikon.
- `/profile` — o‘z ichki profili; `/profile/:id` — boshqa foydalanuvchining rol bo‘yicha cheklangan profili.
- Magistrant profillarida tasdiqlangan ilmiy portfel, guruh/mutaxassislik va vakolatga qarab akademik ko‘rsatkichlar.
- Telefon/e-mail shaxsiy bo‘lib qoladi va faqat tegishli vakolatga ega rollarga ko‘rsatiladi.
- Dashboardlarda cross-role “Tizimdagi faol hamjamiyat” statistikasi va bosiladigan profil chiplar.
- Magistrant dashboardidagi birinchi 4 kartochka endi o‘ziga tegishli: Davomat / Individual reja / Dissertatsiya / Ilmiy faollik.
- `%` belgisi avtomatik aylanuvchi mini-indikatorga aylanadi.
- Panel wave, sweep, progress shine, live pulse, avatar aura va micro-card animatsiyalari.
- Low-end qurilma aniqlansa `lite-motion` avtomatik yoqiladi; off-screen animatsiyalar IntersectionObserver orqali pauza qilinadi.
- Brauzer backgroundga o‘tsa barcha animatsiyalar avtomatik pause bo‘ladi.

## Ishga tushirish
`npm install` va `npm start` yoki `START_WINDOWS.bat`.

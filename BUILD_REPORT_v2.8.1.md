# QDTU Magistratura 360 v2.8.1 — Build report

## Patch maqsadi
Foiz belgisi yonidagi alohida aylanuvchi `%` ikonini olib tashlash va foizli asosiy kartalarni haqiqiy SVG progress indikatorga aylantirish.

## Bajarildi
- Dashboard headline KPI foizlari — SVG ring.
- Barcha role dashboard `kpi` foizlari — SVG ring.
- Analytics asosiy KPI foizlari — SVG ring.
- Student bitiruv tayyorgarligi eski conic ring — SVG ring.
- Dissertation timeline / milestone ko‘rinimli foizlari — SVG ring.
- Overview va metric visual foizlari — ixcham SVG ring.
- Live SSE yangilanishida ring stroke va raqam yangilanadi.
- Karta/panel orqasidagi doimiy wave/aurora/shimmer animatsiyalar o‘chirildi.
- Jadval va matn ichidagi foizlar oddiy matn ko‘rinishida qoldi.
- Low-end qurilmada uzluksiz SVG orbit o‘chadi; progress qiymati ko‘rinishda qoladi.
- Off-screen ringlarning orbit animatsiyasi pause qilinadi.

## Tekshiruv
- 68 ta JavaScript fayl `node --check` bilan tekshirildi: OK.
- 57 ta EJS faylda delimiter va local include tekshirildi: OK.
- `node_modules` ZIP ichiga kiritilmadi; Windowsda `npm install` bajariladi.
- Konteynerdagi `npm install` transport timeout sabab yakunlanmadi, shuning uchun dependency-ga bog‘liq to‘liq `npm test` bu muhitda bajarilmadi.

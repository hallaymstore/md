# MD QDTU — APPROVAL WORKFLOW v2.5.0

Qarshi davlat texnika universiteti magistratura bo‘limi uchun Node.js + Express + MongoDB asosidagi ichki monitoring, boshqaruv va ilmiy ishlarni bosqichma-bosqich tasdiqlash platformasi.

## v2.5 — Student-first ilmiy ariza workflow

Asosiy yuk magistrantning o‘ziga berildi. Magistrant maqola, konferensiya materiali, tadqiqot, dissertatsiya, tezis, himoya materiali, hisobot, source yoki boshqa ilmiy materialni **ariza shaklida** yuboradi va 5 tagacha fayl biriktiradi.

### Standart tasdiqlash zanjiri

**Magistrant → Ilmiy rahbar → Kafedra mudiri → Dekanat → Magistratura bo‘limi → Yakun**

Dissertatsiya, tezis va himoya materiallari uchun yuqori zanjir ishlaydi:

**Magistrant → Ilmiy rahbar → Kafedra mudiri → Dekanat → Magistratura bo‘limi → Universitet rahbariyati → Yakun**

### Har bosqichdagi qarorlar
- **Ma’qullash** — sharh bilan keyingi bosqichga yuboradi.
- **Qayta ishlashga qaytarish** — magistrantga sharh bilan qaytadi; magistrant yangi revision/fayl bilan aynan qaytargan bosqichga qayta yuboradi.
- **Rad etish** — arizani yakuniy rad holatiga o‘tkazadi.
- **Qarorsiz sharh** — savol yoki tavsiya qoldirish mumkin.

Har bir qaror uchun sharh majburiy. Actor, rol, vaqt, revision, oldingi/keyingi bosqich va sharh audit tarixida saqlanadi.

### Rol bo‘yicha navbat
- **Magistrant:** faqat o‘z arizalari; yangi ariza va qayta yuborish.
- **Ilmiy rahbar:** faqat o‘ziga biriktirilgan magistrantlar va o‘z bosqichidagi arizalar.
- **Kafedra mudiri:** faqat o‘z kafedrasi.
- **Dekanat:** faqat o‘z fakulteti.
- **Magistratura:** universitet magistraturasi bo‘yicha tegishli bosqich.
- **Rahbariyat:** faqat yuqori darajali dissertatsiya/tezis/himoya final navbati va executive kuzatuv.
- **Tech:** barcha arizalarni operatsion kuzatadi, lekin akademik approve/reject bermaydi.
- **Superadmin:** barcha arizalarni ko‘radi, metadata tahriri/o‘chirish va zarur holatda approval override vakolatiga ega.
- **O‘qituvchi:** approval workflow ko‘rinmaydi.

### Avtomatlashtirish
Yakuniy ma’qullangan maqola, konferensiya, tadqiqot va ilmiy seminar arizalari avtomatik ravishda `ScientificActivity` portfeliga tushadi. Shuning uchun magistrant ilmiy faoliyatni ikkinchi marta qo‘lda kiritmaydi.

## v2.4 dan saqlangan governance

- Superadmin master-data: fakultet → kafedra → mutaxassislik → guruh.
- Talaba kiritishda cascading select va quick-entry.
- Global `/control` markazi, audit, data-quality, edit/delete.
- Tech qisman vakolatli operatsion admin; superadmin/rahbariyat credentiallari himoyalangan.
- Magistrant self-profile: aloqa, manzil, ilmiy profil, ORCID, ish joyi va boshqa ma’lumotlar.
- Rolga asoslangan ma’lumot visibility.
- Kunduzgi/tungi tema, readable compact typography va mobil responsive UI.

## Yangi sahifalar
- `/submissions` — ilmiy arizalar markazi va rolga mos work queue.
- `/submissions/new` — magistrantning yangi arizasi.
- `/submissions/:id` — fayllar, workflow, sharhlar, approve/revision/reject va audit timeline.

## Ishga tushirish

```bash
npm install
cp .env.example .env
npm run seed
npm run dev
```

Windowsda `START_WINDOWS.bat` ni ishga tushirish mumkin.

Brauzer: `http://localhost:3001/login`

## Demo hisoblar
Development rejimida seed ishlatilsa parol: `Demo123!`

- `texnik01`
- `rahbariyat`
- `magistratura`
- `dekan01`
- `kafedra01`
- `oqituvchi01`
- `rahbar01`
- `mag001`

Superadmin login/paroli `.env` orqali belgilanadi.

## Tekshiruv

```bash
npm run check
```

JS syntax va EJS delimiter tekshiradi.

## Production uchun tavsiya
HTTPS, kuchli `SESSION_SECRET`, MongoDB auth/backup, CSRF, rate-limit, virus scan, R2/S3/MinIO, approval notification/email/Telegram integratsiyasi va audit retention tavsiya qilinadi.

(() => {
  const normalize = value => String(value || '').replace(/\s+/g,' ').trim().toLocaleLowerCase('uz-UZ');
  const catalog = [
    [/davomat/, 'Magistrantning dars va mashg‘ulotlarda qatnashish ko‘rsatkichi. Past qiymatlar qo‘shimcha nazorat talab qilishi mumkin.'],
    [/individual reja|\breja\b/, 'Magistrantning tasdiqlangan individual rejasidagi ishlar qay darajada bajarilganini ko‘rsatadi.'],
    [/dissertatsiya/, 'Magistrlik dissertatsiyasining mavzu, bosqich, muddat va bajarilish holati shu qismda kuzatiladi.'],
    [/ilmiy faollik|ilmiy portfel|maqola|konferensiya|tadqiqot/, 'Magistrantning tasdiqlangan ilmiy ishlari, maqolalari, konferensiya va tadqiqot faoliyati jamlanadi.'],
    [/bitiruv tayyorligi/, 'Bitiruv uchun zarur asosiy ko‘rsatkichlar umumlashtirilib, tayyorgarlik darajasi sifatida ko‘rsatiladi.'],
    [/o‘zlashtirish/, 'O‘quv natijalari va akademik ko‘rsatkichlarning umumiy holatini bildiradi.'],
    [/hujjat/, 'Magistrant yoki bo‘limga tegishli hujjatlarning mavjudligi, to‘liqligi va holati shu yerda ko‘riladi.'],
    [/akademik qarz|qarz/, 'Magistrantda yopilmagan akademik majburiyatlar mavjud bo‘lsa, ularning soni shu yerda ko‘rsatiladi.'],
    [/magistrant/, 'Magistratura bosqichida tahsil olayotgan talabalar va ularga tegishli asosiy ma’lumotlar.'],
    [/1-kurs/, 'Birinchi bosqichda tahsil olayotgan magistrantlar soni yoki ularga tegishli ko‘rsatkichlar.'],
    [/2-kurs/, 'Ikkinchi bosqichda tahsil olayotgan magistrantlar soni yoki ularga tegishli ko‘rsatkichlar.'],
    [/guruh/, 'Magistrantlar biriktirilgan akademik guruhlar kesimidagi ma’lumot va statistika.'],
    [/mutaxassislik|yo‘nalish/, 'Magistratura ta’lim yo‘nalishi yoki mutaxassisligi bo‘yicha ma’lumot.'],
    [/fakultet/, 'Ma’lumotlarni fakultetlar kesimida ko‘rish va taqqoslash uchun ishlatiladi.'],
    [/kafedra/, 'Magistrant, rahbar va ilmiy faoliyatni kafedra kesimida kuzatish imkonini beradi.'],
    [/ilmiy rahbar/, 'Magistrantning ilmiy ishiga rahbarlik qiluvchi xodim va unga biriktirilgan magistrantlar haqidagi ma’lumot.'],
    [/ariza/, 'Ilmiy ish yoki boshqa tasdiqlash talab qiladigan ma’lumotni tegishli mas’ullarga yuborish va holatini kuzatish bo‘limi.'],
    [/tasdiqlash|tasdiqlangan/, 'Ma’lumot yoki ariza vakolatli shaxs tomonidan ko‘rib chiqilganini va qaror holatini bildiradi.'],
    [/topshiriq|vazifa|muddat/, 'Bajarilishi kerak bo‘lgan ishlar, mas’ul shaxs va belgilangan muddat shu qismda nazorat qilinadi.'],
    [/seminar/, 'Ilmiy yoki o‘quv seminarlarining reja, ishtirok va natija ma’lumotlari.'],
    [/erta ogohlantirish|xavf|muammoli|diqqat talab/, 'Past ko‘rsatkich yoki kechikish aniqlangan holatlarni erta ko‘rsatib, mas’ullarga chora ko‘rishga yordam beradi.'],
    [/boshqaruv paneli|bosh sahifa/, 'Sizning vakolatingizga mos eng muhim ko‘rsatkichlar, tezkor havolalar va joriy holat bir ekranda ko‘rsatiladi.'],
    [/bildirishnoma/, 'Sizga tegishli yangi ariza, qaror, topshiriq va muhim o‘zgarishlar haqidagi xabarlar shu yerda jamlanadi.'],
    [/akademik profil/, 'Magistrantning o‘qish, guruh, mutaxassislik, rahbar va asosiy o‘quv ko‘rsatkichlari jamlangan profil.'],
    [/aloqa|kontakt/, 'Foydalanuvchi bilan bog‘lanish uchun ruxsat etilgan aloqa ma’lumotlari ko‘rsatiladi.'],
    [/bajarilish nazorati/, 'Rejalashtirilgan ishlarning qancha qismi bajarilgani va qaysi bandlar e’tibor talab qilishi ko‘rsatiladi.'],
    [/umumiy tanlov|tanlang/, 'Keyingi ma’lumotlarni tez va to‘g‘ri kiritish uchun kerakli variantni tanlang.'],
    [/faoliyat lentasi/, 'Tasdiqlangan ilmiy va akademik ishlar vaqt ketma-ketligida ko‘rsatiladi.'],
    [/monitoring|nazorat/, 'Joriy holatni muntazam kuzatish, muammolarni aniqlash va keyingi choralarni belgilash uchun ishlatiladi.'],
    [/analitika|tahlil|ko‘rsatkich/, 'Yig‘ilgan ma’lumotlarni umumlashtirib, fakultet, kafedra, kurs yoki boshqa kesimlarda tahlil qiladi.'],
    [/profil/, 'Foydalanuvchining roli, lavozimi, akademik yoki ilmiy ma’lumotlari vakolat doirasida ko‘rsatiladi.'],
    [/foydalanuvchi|hisob|vakolat/, 'Tizimga kiruvchi shaxslar, ularning roli va ko‘rish yoki boshqarish huquqlari shu bo‘limda boshqariladi.'],
    [/faoliyat tarixi/, 'Tizimda kim tomonidan qachon muhim o‘zgarish qilinganini kuzatish uchun qaydlar.'],
    [/hemis/, 'HEMISdan olingan talabalar ro‘yxatini tekshirish va mavjud magistratura ma’lumotlarini saqlagan holda yangilash uchun xizmat qiladi.'],
    [/material|fayl/, 'Ilmiy ish, hujjat, hisobot va boshqa ichki materiallarni saqlash hamda kerakli shaxs bilan bog‘lash bo‘limi.'],
    [/katta ekran/, 'Katta monitor uchun shaxsiy ma’lumotlarsiz umumiy magistratura ko‘rsatkichlarini jonli ko‘rsatadi.'],
    [/umumiy boshqaruv|umumiy nazorat/, 'Asosiy ko‘rsatkichlar, foydalanuvchilar va boshqaruv holatini bir joyda ko‘rsatadi.'],
    [/akademik birlik|akademik nom/, 'Fakultet, kafedra, mutaxassislik va guruh nomlarini yagona tartibda yuritish uchun ishlatiladi.'],
    [/telefon/, 'Bog‘lanish uchun telefon raqami. Ko‘rinishi foydalanuvchi vakolatiga qarab cheklanadi.'],
    [/e-mail|email/, 'Rasmiy elektron pochta manzili. Ko‘rinishi foydalanuvchi vakolatiga qarab cheklanadi.'],
    [/foiz/, 'Bajarilish yoki holat darajasini 0 dan 100 gacha bo‘lgan qiymatda ko‘rsatadi.'],
    [/izoh/, 'Qo‘shimcha tushuntirish, eslatma yoki qaror sababini yozish uchun maydon.'],
    [/tur/, 'Qayd etilayotgan ma’lumot yoki faoliyat turini tanlash uchun ishlatiladi.'],
    [/bajarildi/, 'Rejalashtirilgan ishning amalda bajarilgan qismini kiriting.'],
  ];

  const fallback = (text, kind) => {
    if (kind === 'field') return `“${text}” maydoniga ushbu bo‘lim uchun kerakli ma’lumotni kiriting yoki tanlang.`;
    if (kind === 'metric') return `“${text}” ko‘rsatkichi joriy ma’lumotlar asosida shakllanadi. Kartani bosish mumkin bo‘lsa, batafsil sahifa ochiladi.`;
    return `“${text}” bo‘limida shu yo‘nalishga tegishli ma’lumotlar, holat va amallar jamlangan.`;
  };

  const explain = (text, kind) => {
    const n = normalize(text);
    for (const [rule, help] of catalog) if (rule.test(n)) return help;
    return fallback(String(text || 'Ushbu qism').trim(), kind);
  };

  const popover = document.createElement('div');
  popover.className = 'context-help-popover';
  popover.hidden = true;
  popover.setAttribute('role', 'tooltip');
  document.body.appendChild(popover);
  let active = null;
  let hideTimer = null;

  const position = button => {
    const r = button.getBoundingClientRect();
    const width = Math.min(330, window.innerWidth - 24);
    popover.style.width = `${width}px`;
    let left = Math.min(window.innerWidth - width - 12, Math.max(12, r.left + r.width / 2 - width / 2));
    let top = r.bottom + 9;
    popover.classList.remove('is-above');
    if (top + 150 > window.innerHeight) {
      top = Math.max(12, r.top - 9);
      popover.classList.add('is-above');
    }
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  };
  const show = button => {
    clearTimeout(hideTimer);
    active = button;
    popover.textContent = button.dataset.help || '';
    popover.hidden = false;
    position(button);
  };
  const hide = delay => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { popover.hidden = true; active = null; }, delay || 0);
  };

  const attach = (host, text, kind='section') => {
    if (!host || host.querySelector(':scope > .context-info')) return;
    const clean = String(text || '').replace(/\s+/g,' ').trim();
    if (!clean || clean.length > 90) return;
    const button = document.createElement('span');
    button.setAttribute('role', 'button');
    button.tabIndex = 0;
    button.className = 'context-info';
    button.textContent = 'i';
    button.dataset.help = explain(clean, kind);
    button.setAttribute('aria-label', `${clean} haqida ma’lumot`);
    button.addEventListener('mouseenter', () => show(button));
    button.addEventListener('mouseleave', () => hide(180));
    button.addEventListener('focus', () => show(button));
    button.addEventListener('blur', () => hide(120));
    button.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (active === button && !popover.hidden) hide(); else show(button);
    });
    button.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (active === button && !popover.hidden) hide(); else show(button); }
    });
    host.appendChild(button);
  };

  document.querySelectorAll('main.content h1,main.content .panel h2,.live-overview-head h1,.group-overview-head h2,.role-profile-heading h2,.network-pulse-head h2,.profile-visibility-note b,.login-card h2').forEach(el => attach(el, el.textContent, 'section'));
  document.querySelectorAll('.login-feature-grid > div > b,details summary b').forEach(el => attach(el, el.textContent, 'section'));
  document.querySelectorAll('.login-form-v21 label > span').forEach(el => attach(el, el.textContent, 'field'));
  document.querySelectorAll('.kpi > span,.headline-kpi > span,.network-stat > span,.overview-grid > div > span,.student-pulse > div > span,.bucket-grid > div > span,.science-grid > div > span,.health-item span').forEach(el => attach(el, el.textContent, 'metric'));
  document.querySelectorAll('main.content table th').forEach(el => attach(el, el.textContent, 'field'));
  document.querySelectorAll('main.content form label').forEach(label => {
    const clone = label.cloneNode(true);
    clone.querySelectorAll('input,select,textarea,button,.context-info').forEach(x => x.remove());
    const text = clone.textContent.trim();
    if (text) attach(label, text, 'field');
  });

  popover.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  popover.addEventListener('mouseleave', () => hide(120));
  window.addEventListener('scroll', () => active && position(active), { passive:true });
  window.addEventListener('resize', () => active && position(active));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  document.addEventListener('pointerdown', e => { if (active && !e.target.closest('.context-info,.context-help-popover')) hide(); }, { passive:true });

  // Human-readable labels for values that are stored internally as short codes.
  const dictionary = {
    green:'Barqaror', yellow:'Nazoratda', red:'Muammoli',
    active:'Faol', inactive:'Nofaol', planned:'Rejada', submitted:'Ko‘rib chiqilmoqda', approved:'Tasdiqlangan', rejected:'Rad etilgan', missing:'Mavjud emas', present:'Mavjud', expiring:'Muddati yaqin',
    low:'Past', medium:'O‘rta', high:'Yuqori', urgent:'Shoshilinch', open:'Ochiq', in_progress:'Jarayonda', completed:'Bajarilgan', closed:'Yopilgan',
    attendance:'Davomat', plan:'Individual reja', dissertation:'Dissertatsiya', seminar:'Seminar', publication:'Maqola', conference:'Konferensiya', research:'Tadqiqot', supervision:'Rahbar uchrashuvi', document:'Hujjat', academic:'O‘zlashtirish',
    user:'Foydalanuvchi', student:'Magistrant', task:'Topshiriq', science:'Ilmiy faoliyat', upload:'Fayl', monitoring:'Nazorat qaydi', submission:'Ilmiy ariza'
  };
  document.querySelectorAll('.status,.priority,.chip').forEach(el => {
    const key = normalize(el.textContent).replace(/\s+/g,'_');
    if (dictionary[key]) el.textContent = dictionary[key];
  });
  document.querySelectorAll('code').forEach(el => {
    const raw = el.textContent.trim();
    const actionNames = {
      USER_CREATED:'Foydalanuvchi yaratildi', USER_UPDATED:'Foydalanuvchi yangilandi', USER_BLOCKED:'Foydalanuvchi faolligi o‘zgartirildi',
      LOGIN:'Tizimga kirildi', LOGIN_SUCCESS:'Tizimga kirildi', PASSWORD_RESET:'Parol tiklandi', PASSWORD_CHANGED:'Parol o‘zgartirildi',
      STUDENT_CREATED:'Magistrant qo‘shildi', STUDENT_UPDATED:'Magistrant ma’lumoti yangilandi', STUDENT_DELETED:'Magistrant o‘chirildi',
      FILE_UPLOADED:'Fayl yuklandi', MONITORING_CREATED:'Nazorat qaydi yaratildi', SEMINAR_CREATED:'Seminar qo‘shildi'
    };
    if (actionNames[raw]) el.textContent = actionNames[raw];
  });
})();

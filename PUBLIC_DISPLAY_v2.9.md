# Public Entrance Live Display — v2.9

Route: `/display`
Live SSE: `/display/live`
Kiosk: `/display?kiosk=1`

Katta monitor uchun maxsus standalone UI. Faqat agregat statistika olinadi; shaxsiy talaba profillari display endpointiga kiritilmaydi.

Ko‘rsatkichlar:
- jami, 1-kurs, 2-kurs, guruhlar;
- mutaxassisliklar va ilmiy rahbarlar;
- davomat, individual reja, dissertatsiya, ilmiy faollik, bitiruv tayyorgarligi SVG ringlari;
- barqaror / nazoratda / muammoli holatlar;
- maqola, konferensiya, tadqiqot, ilmiy seminar;
- ilmiy workflow holati;
- eng faol 8 guruhning agregat indeksi.

Performance:
- Canvas/WebGL yo‘q;
- transform/opacity asosidagi dekorativ animatsiyalar;
- SVG stroke transition;
- low-end qurilmalarda avtomatik sekinlashtirish;
- EventSource native reconnect.

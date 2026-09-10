(() => {
  const root = document.querySelector('[data-display-root]');
  if (!root) return;
  const $ = (selector, ctx=document) => ctx.querySelector(selector);
  const $$ = (selector, ctx=document) => [...ctx.querySelectorAll(selector)];
  const get = (obj, path) => path.split('.').reduce((value, key) => value?.[key], obj);
  const fmtTime = date => new Intl.DateTimeFormat('uz-UZ',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date);
  const fmtDate = date => new Intl.DateTimeFormat('uz-UZ',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(date);

  const nav = navigator;
  const lite = (nav.connection?.saveData === true) || (Number(nav.hardwareConcurrency || 8) <= 2) || (Number(nav.deviceMemory || 8) <= 2);
  document.documentElement.classList.toggle('display-lite', lite);

  let initial = {};
  try { initial = JSON.parse($('#displayInitialData')?.textContent || '{}'); } catch (_) {}

  const clockEl = $('[data-display-clock]');
  const dateEl = $('[data-display-date]');
  const tickClock = () => {
    const now = new Date();
    if (clockEl) clockEl.textContent = fmtTime(now).slice(0,5);
    if (dateEl) dateEl.textContent = fmtDate(now);
  };
  tickClock();
  setInterval(tickClock, 1000);

  const hit = el => {
    if (!el) return;
    el.classList.remove('value-hit');
    void el.offsetWidth;
    el.classList.add('value-hit');
    setTimeout(() => el.classList.remove('value-hit'), 560);
  };

  const setRing = (ring, value, animate=true) => {
    const v = Math.max(0, Math.min(100, Number(value || 0)));
    const progress = $('.display-ring-progress', ring);
    const number = $('.display-ring-value strong', ring);
    const card = ring.closest('.display-ring-card');
    const caption = $('[data-ring-caption]', card);
    if (progress) {
      const circumference = 2 * Math.PI * 48;
      progress.style.strokeDasharray = String(circumference);
      progress.style.strokeDashoffset = String(circumference * (1 - v / 100));
      progress.style.stroke = v >= 80 ? 'var(--green)' : v >= 60 ? 'var(--blue)' : v >= 40 ? 'var(--yellow)' : 'var(--red)';
    }
    if (number && Number(number.textContent) !== v) { number.textContent = String(Math.round(v)); if (animate) hit(number); }
    if (caption) caption.textContent = `${Math.round(v)}%`;
    ring.dataset.value = String(v);
  };

  const setHealth = data => {
    const total = Number(data.total || 0);
    ['green','yellow','red'].forEach(key => {
      const value = Number(data.statuses?.[key] || 0);
      const pct = total ? Math.round(value / total * 100) : 0;
      const pctEl = document.querySelector(`[data-health-pct="${key}"]`);
      const barEl = document.querySelector(`[data-health-bar="${key}"]`);
      if (pctEl) pctEl.textContent = `${pct}%`;
      if (barEl) barEl.style.width = `${pct}%`;
    });
  };

  const renderGroups = data => {
    const grid = $('[data-group-grid]');
    if (!grid || !Array.isArray(data.groupStats)) return;
    const existing = new Map($$('[data-group]', grid).map(el => [el.dataset.group, el]));
    data.groupStats.slice(0,8).forEach(group => {
      let card = existing.get(String(group.name));
      if (!card) {
        card = document.createElement('article');
        card.className = 'display-group-card';
        card.dataset.group = String(group.name);
        card.innerHTML = '<div class="group-card-head"><strong></strong><span><b data-group-key="total">0</b> talaba</span></div><div class="group-score"><b data-group-key="score">0</b><small>%</small></div><div class="group-track"><i data-group-progress></i></div><div class="group-meta"><span>Davomat <b data-group-key="attendance">0%</b></span><span>Dissertatsiya <b data-group-key="dissertation">0%</b></span><span>Risk <b data-group-key="risk">0</b></span></div>';
        grid.appendChild(card);
      }
      $('.group-card-head>strong', card).textContent = group.name;
      $$('[data-group-key]', card).forEach(el => {
        const key = el.dataset.groupKey;
        const raw = group[key];
        const next = ['attendance','dissertation'].includes(key) ? `${raw}%` : String(raw ?? 0);
        if (el.textContent !== next) { el.textContent = next; hit(el); }
      });
      const bar = $('[data-group-progress]', card);
      if (bar) bar.style.setProperty('--group-progress', `${Math.max(0,Math.min(100,Number(group.score||0)))}%`);
      existing.delete(String(group.name));
    });
    existing.forEach(card => card.remove());
  };

  const render = data => {
    $$('[data-key]').forEach(el => {
      const value = get(data, el.dataset.key);
      if (value === undefined || value === null) return;
      const next = String(value);
      if (el.textContent !== next) { el.textContent = next; hit(el); }
    });
    $$('[data-ring-key]').forEach(ring => setRing(ring, get(data, ring.dataset.ringKey), true));
    setHealth(data);
    renderGroups(data);
    const updated = data.updatedAt ? new Date(data.updatedAt) : new Date();
    const updatedEl = $('[data-display-updated]');
    if (updatedEl) updatedEl.textContent = fmtTime(updated);
    const footer = $('[data-footer-updated]');
    if (footer) footer.textContent = `yangilandi ${fmtTime(updated)}`;
  };

  $$('[data-ring-key]').forEach(ring => {
    const finalValue = Number(ring.dataset.value || 0);
    setRing(ring, 0, false);
    requestAnimationFrame(() => requestAnimationFrame(() => setRing(ring, finalValue, false)));
  });
  setHealth(initial);

  const status = $('[data-display-status]');
  if ('EventSource' in window) {
    const source = new EventSource(root.dataset.liveUrl || '/display/live');
    source.addEventListener('open', () => {
      document.body.classList.remove('display-offline');
      status?.classList.remove('is-waiting');
      status?.classList.add('is-online');
      const b = $('b', status); const em = $('em', status);
      if (b) b.textContent = 'JONLI';
      if (em) em.textContent = 'ma’lumotlar yangilanmoqda';
    });
    source.addEventListener('stats', event => {
      try { render(JSON.parse(event.data || '{}')); } catch (_) {}
    });
    source.addEventListener('stats-error', () => {
      status?.classList.add('is-waiting');
      const b = $('b', status); const em = $('em', status);
      if (b) b.textContent = 'KUTILMOQDA';
      if (em) em.textContent = 'server qayta tekshirilmoqda';
    });
    source.onerror = () => {
      document.body.classList.add('display-offline');
      status?.classList.add('is-waiting');
      const b = $('b', status); const em = $('em', status);
      if (b) b.textContent = 'QAYTA ULANISH';
      if (em) em.textContent = 'avtomatik reconnect';
    };
  }

  let spotlight = 0;
  setInterval(() => {
    const cards = $$('[data-group]');
    if (!cards.length) return;
    cards.forEach(card => card.classList.remove('is-spotlight'));
    spotlight = (spotlight + 1) % cards.length;
    cards[spotlight].classList.add('is-spotlight');
  }, lite ? 9000 : 6000);

  $('[data-fullscreen]')?.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (_) {}
  });
  $('[data-theme-display]')?.addEventListener('click', () => {
    document.documentElement.dataset.displayTheme = document.documentElement.dataset.displayTheme === 'light' ? 'dark' : 'light';
  });

  let pointerTimer;
  const showPointer = () => {
    document.body.classList.remove('hide-pointer');
    clearTimeout(pointerTimer);
    pointerTimer = setTimeout(() => document.body.classList.add('hide-pointer'), 3500);
  };
  document.addEventListener('mousemove', showPointer, { passive:true });
  showPointer();
})();

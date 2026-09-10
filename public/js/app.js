(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];

  // Persistent light/dark theme. Applied before CSS in <head> to avoid flash.
  const THEME_KEY = 'md-theme';
  const applyTheme = (theme) => {
    const t = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
    document.documentElement.style.colorScheme = t;
    const meta = document.querySelector('meta[name=\"theme-color\"]');
    if (meta) meta.content = t === 'dark' ? '#0b241a' : '#f4fbf7';
    $$('[data-theme-toggle]').forEach(btn => {
      const icon = $('.theme-icon', btn); const label = $('.theme-label', btn);
      if (icon) icon.textContent = t === 'dark' ? '☀' : '☾';
      if (label) label.textContent = t === 'dark' ? 'Kunduzgi' : 'Tungi';
      btn.setAttribute('aria-label', t === 'dark' ? 'Kunduzgi mavzuga o‘tish' : 'Tungi mavzuga o‘tish');
    });
  };
  applyTheme(document.documentElement.dataset.theme || 'light');
  $$('[data-theme-toggle]').forEach(btn => btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
    applyTheme(next);
  }));

  const sidebar = $('#sidebar');
  const menuBtn = $('#menuBtn');
  menuBtn?.addEventListener('click', () => sidebar?.classList.toggle('open'));
  document.addEventListener('click', e => {
    if (innerWidth <= 720 && sidebar?.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menuBtn) sidebar.classList.remove('open');
  });

  // User-creation wizard.
  const steps = $$('.wizard-step');
  const markers = $$('.steps span');
  let current = 0;
  function show(i){
    current = Math.max(0, Math.min(i, steps.length - 1));
    steps.forEach((s, idx) => s.classList.toggle('active', idx === current));
    markers.forEach((m, idx) => m.classList.toggle('active', idx <= current));
  }
  $$('.next').forEach(btn => btn.addEventListener('click', () => {
    const section = steps[current];
    const fields = [...section.querySelectorAll('input[required],select[required]')];
    if (fields.every(f => f.reportValidity())) show(current + 1);
  }));
  $$('.prev').forEach(btn => btn.addEventListener('click', () => show(current - 1)));

  // Academic structure cascading selects.
  let academicRows = [];
  try {
    const dataEl = $('#academicStructureData');
    if (dataEl) academicRows = JSON.parse(dataEl.textContent || '[]');
  } catch (_) { academicRows = []; }
  const uniq = arr => [...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'uz'));
  const putOptions = (select, values, selected='') => {
    if (!select) return;
    const old = selected || select.value || select.dataset.current || '';
    select.innerHTML = '<option value="">Tanlang</option>' + values.map(v => `<option value="${String(v).replace(/"/g,'&quot;')}">${v}</option>`).join('');
    if (values.includes(old)) select.value = old;
    select.dataset.current = '';
  };
  function initCascade(root){
    const faculty = $('[data-academic="faculty"]', root);
    const department = $('[data-academic="department"]', root);
    const specialty = $('[data-academic="specialty"]', root);
    const group = $('[data-academic="group"]', root);
    if (!faculty || !department || !specialty || !group) return;

    const refreshDepartment = (keep='') => {
      const rows = academicRows.filter(x => x.faculty === faculty.value);
      putOptions(department, uniq(rows.map(x=>x.department)), keep || department.value);
      refreshSpecialty();
    };
    const refreshSpecialty = (keep='') => {
      const rows = academicRows.filter(x => x.faculty === faculty.value && x.department === department.value);
      putOptions(specialty, uniq(rows.map(x=>x.specialty)), keep || specialty.value);
      refreshGroup();
    };
    const refreshGroup = (keep='') => {
      const rows = academicRows.filter(x => x.faculty === faculty.value && x.department === department.value && x.specialty === specialty.value);
      putOptions(group, uniq(rows.map(x=>x.group)), keep || group.value);
    };
    const applyGroupMeta = () => {
      const row = academicRows.find(x => x.faculty === faculty.value && x.department === department.value && x.specialty === specialty.value && x.group === group.value);
      if (!row) return;
      const course = $('[data-academic-meta="course"]', root);
      const year = $('[data-academic-meta="admissionYear"]', root);
      const form = $('[data-academic-meta="educationForm"]', root);
      const sup = $('[data-academic-meta="supervisor"]', root);
      if (course && row.course) course.value = String(row.course);
      if (year && row.admissionYear) year.value = row.admissionYear;
      if (form && row.educationForm) form.value = row.educationForm;
      if (sup && row.defaultSupervisor) {
        const id = typeof row.defaultSupervisor === 'object' ? row.defaultSupervisor._id : row.defaultSupervisor;
        if (id && [...sup.options].some(o => o.value === String(id))) sup.value = String(id);
      }
    };

    const initialDepartment = department.dataset.current || department.value;
    const initialSpecialty = specialty.dataset.current || specialty.value;
    const initialGroup = group.dataset.current || group.value;
    const rowsForFaculty = academicRows.filter(x=>x.faculty===faculty.value);
    putOptions(department, uniq(rowsForFaculty.map(x=>x.department)), initialDepartment);
    const rowsForDept = academicRows.filter(x=>x.faculty===faculty.value && x.department===department.value);
    putOptions(specialty, uniq(rowsForDept.map(x=>x.specialty)), initialSpecialty);
    const rowsForSpec = academicRows.filter(x=>x.faculty===faculty.value && x.department===department.value && x.specialty===specialty.value);
    putOptions(group, uniq(rowsForSpec.map(x=>x.group)), initialGroup);

    faculty.addEventListener('change', () => { refreshDepartment(); });
    department.addEventListener('change', () => { refreshSpecialty(); });
    specialty.addEventListener('change', () => { refreshGroup(); });
    group.addEventListener('change', applyGroupMeta);

    root._setAcademic = (key, value) => {
      if (!value) return;
      if (key === 'faculty') {
        faculty.value = value; refreshDepartment();
      } else if (key === 'department') {
        department.value = value; refreshSpecialty();
      } else if (key === 'specialty') {
        specialty.value = value; refreshGroup();
      } else if (key === 'group') {
        group.value = value; applyGroupMeta();
      }
    };
  }
  $$('.academic-cascade').forEach(initCascade);

  // Auto-fill from an already-created student login account.
  const linked = $('[data-linked-user]');
  linked?.addEventListener('change', () => {
    const opt = linked.selectedOptions[0];
    if (!opt?.value) return;
    const form = linked.closest('form');
    const setIfEmpty = (name,val) => { const el = form?.elements?.[name]; if (el && val && !el.value) el.value = val; };
    setIfEmpty('fullName', opt.dataset.fullname);
    setIfEmpty('phone', opt.dataset.phone);
    setIfEmpty('email', opt.dataset.email);
    setIfEmpty('studentId', opt.dataset.id);
    const cascade = $('.academic-cascade', form);
    if (cascade?._setAcademic) {
      cascade._setAcademic('faculty', opt.dataset.faculty);
      setTimeout(()=>cascade._setAcademic('department', opt.dataset.department),0);
    }
  });

  // Duplicate student ID warning (non-blocking; server re-checks on save).
  const duplicateField = $('[data-duplicate-field]');
  const duplicateHint = $('[data-duplicate-hint]');
  duplicateField?.addEventListener('blur', async () => {
    const value = duplicateField.value.trim();
    if (!value || !duplicateHint) { if (duplicateHint) duplicateHint.textContent=''; return; }
    try {
      const exclude = duplicateField.dataset.excludeId ? `&exclude=${encodeURIComponent(duplicateField.dataset.excludeId)}` : '';
      const r = await fetch(`/students/check-duplicate?studentId=${encodeURIComponent(value)}${exclude}`, { headers:{'Accept':'application/json'} });
      const data = await r.json();
      duplicateHint.className = 'duplicate-hint ' + (data.exists ? 'bad' : 'good');
      duplicateHint.textContent = data.exists ? `⚠ Bu ID bazada bor: ${data.student.fullName}` : '✓ ID bo‘sh';
    } catch (_) { duplicateHint.textContent = ''; }
  });

  // Keyboard shortcuts for single-entry workflow.
  document.addEventListener('keydown', e => {
    if (!e.altKey) return;
    if (e.key.toLowerCase() === 'n') { e.preventDefault(); $('[data-save-next]')?.click(); }
    if (e.key.toLowerCase() === 's') {
      const form = $('[data-student-entry]');
      const btn = form?.querySelector('button[name="submitAction"][value="save-list"]');
      if (btn) { e.preventDefault(); btn.click(); }
    }
  });

  // Quick-entry table: paste from Excel, add/remove rows, Enter navigation.
  const quickRows = $('#quickRows');
  function renumberQuickRows(){
    $$('[data-quick-row]', quickRows || document).forEach((tr, i) => {
      $('.row-no',tr).textContent = i+1;
      $$('input',tr).forEach(inp => { inp.name = inp.name.replace(/rows\[\d+\]/, `rows[${i}]`); });
    });
  }
  function addQuickRow(values={}){
    if (!quickRows) return;
    const i = $$('[data-quick-row]', quickRows).length;
    const tr = document.createElement('tr'); tr.dataset.quickRow='';
    tr.innerHTML = `<td class="row-no">${i+1}</td><td><input name="rows[${i}][fullName]" placeholder="F.I.Sh."></td><td><input name="rows[${i}][studentId]" placeholder="ID"></td><td><input name="rows[${i}][phone]" placeholder="+998"></td><td><input type="email" name="rows[${i}][email]" placeholder="email"></td><td><input name="rows[${i}][dissertationTitle]" placeholder="ixtiyoriy"></td><td><button type="button" class="icon-remove" data-remove-row>×</button></td>`;
    quickRows.appendChild(tr);
    const keys=['fullName','studentId','phone','email','dissertationTitle'];
    $$('input',tr).forEach((inp,idx)=>{ if(values[keys[idx]]) inp.value=values[keys[idx]]; });
  }
  $('#addQuickRow')?.addEventListener('click', () => addQuickRow());
  quickRows?.addEventListener('click', e => {
    const btn = e.target.closest('[data-remove-row]');
    if (!btn) return;
    const rows = $$('[data-quick-row]', quickRows);
    if (rows.length <= 1) return;
    btn.closest('tr').remove(); renumberQuickRows();
  });
  quickRows?.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const inputs = $$('input', quickRows);
    const idx = inputs.indexOf(e.target);
    if (idx >= 0 && idx < inputs.length - 1) { e.preventDefault(); inputs[idx+1].focus(); inputs[idx+1].select(); }
  });
  $('#applyPaste')?.addEventListener('click', () => {
    const text = $('#pasteStudents')?.value.trim();
    if (!text || !quickRows) return;
    const parsed = text.split(/\r?\n/).filter(Boolean).map(line => {
      let cols = line.split('\t');
      if (cols.length === 1) cols = line.split(/\s{2,}|\s*;\s*/);
      return { fullName:(cols[0]||'').trim(), studentId:(cols[1]||'').trim(), phone:(cols[2]||'').trim(), email:(cols[3]||'').trim(), dissertationTitle:(cols[4]||'').trim() };
    });
    if (parsed[0] && /f\.?i\.?sh|fio|full.?name/i.test(parsed[0].fullName)) parsed.shift();
    const rows = $$('[data-quick-row]', quickRows);
    parsed.forEach((item,i) => {
      const tr = rows[i] || (()=>{ addQuickRow(); return $$('[data-quick-row]', quickRows).at(-1); })();
      const inputs = $$('input',tr);
      [item.fullName,item.studentId,item.phone,item.email,item.dissertationTitle].forEach((v,j)=>{ if(inputs[j]) inputs[j].value=v; });
    });
    const firstEmpty = $$('[data-quick-row] input[name$="[fullName]"]', quickRows).find(i=>!i.value);
    firstEmpty?.focus();
  });

  // Bulk actions on student list.
  const checks = $$('[data-student-check]');
  const selectAll = $('[data-select-all]');
  const countEl = $('[data-selected-count]');
  const updateCount = () => { if (countEl) countEl.textContent = checks.filter(c=>c.checked).length; };
  selectAll?.addEventListener('change', () => { checks.forEach(c=>c.checked=selectAll.checked); updateCount(); });
  checks.forEach(c=>c.addEventListener('change', updateCount)); updateCount();
  const bulkAction = $('#bulkAction'); const bulkValue = $('#bulkValue');
  let bulkData = {};
  try { const el=$('#bulkOptions'); if(el) bulkData=JSON.parse(el.textContent||'{}'); } catch(_){}
  bulkAction?.addEventListener('change', () => {
    if (!bulkValue) return;
    const map = { supervisor:bulkData.supervisors||[], structure:bulkData.structures||[], studyStatus:bulkData.statuses||[] };
    const arr = map[bulkAction.value] || [];
    bulkValue.innerHTML = '<option value="">Qiymatni tanlang</option>' + arr.map(x=>`<option value="${x.id}">${x.name}</option>`).join('');
  });

  // Research workflow: safe confirmations and selected-file summary.
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-confirm]');
    if (!trigger || trigger.disabled) return;
    if (!window.confirm(trigger.dataset.confirm || 'Amalni tasdiqlaysizmi?')) event.preventDefault();
  });
  $$('[data-file-zone] input[type="file"]').forEach(input => input.addEventListener('change', () => {
    const summary = $('[data-file-summary]', input.closest('[data-file-zone]'));
    if (!summary) return;
    const files = [...input.files];
    const size = files.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024;
    summary.textContent = files.length ? `${files.length} ta fayl · ${size.toFixed(2)} MB: ${files.map(file => file.name).join(', ')}` : 'Hali fayl tanlanmagan';
  }));

  const adminAction = $('[data-admin-action]');
  const refreshAdminFields = () => {
    const value = adminAction?.value;
    $$('[data-admin-stage]').forEach(element => { element.hidden = value !== 'reroute'; });
    $$('[data-admin-supervisor]').forEach(element => { element.hidden = value !== 'reassign_supervisor'; });
  };
  adminAction?.addEventListener('change', refreshAdminFields);
  refreshAdminFields();

  // v2.7.1: turn statistical tiles into keyboard-accessible navigation cards.
  const normalizeCardLabel = value => String(value || '')
    .trim().toLocaleUpperCase('uz-UZ').replace(/\s+/g, ' ');
  const dashboardCardRoutes = new Map([
    ['JAMI','/students'], ['JAMI MAGISTRANT','/students'], ['MAGISTRANT','/students'], ['MAGISTRANTLAR','/students'], ['BIRIKTIRILGAN','/students'],
    ['1-KURS','/students?course=1'], ['2-KURS','/students?course=2'], ['GURUHLAR','#live-groups'],
    ['FOYDALANUVCHILAR','/users'], ['BUGUNGI AUDIT','/audit'], ['FAYLLAR','/uploads'],
    ['OCHIQ TOPSHIRIQ','/md/deadlines'], ['BITIRUV TAYYORLIGI','/md/graduation'], ['MUTAXASSISLIK','/analytics'],
    ['DAVOMAT','/monitoring'], ['O‘ZLASHTIRISH','/monitoring'], ["O'ZLASHTIRISH",'/monitoring'],
    ['INDIVIDUAL REJA','/monitoring'], ['REJA','/monitoring'], ['AKAD. QARZ','/monitoring'], ['NAZORATDA','/monitoring'],
    ['DISSERTATSIYA','/milestones'], ['HUJJATLAR','/documents'], ['YO‘Q HUJJAT','/documents'], ["YO'Q HUJJAT",'/documents'],
    ['ILMIY FAOLLIK','/science'], ['MAQOLA','/science'], ['KONFERENSIYA','/science'], ['SEMINAR','/seminars'],
    ['MUAMMOLI','/md/interventions'], ['BARQAROR HOLAT','/students?status=green'], ['KECHIKKAN TOPSHIRIQ','/tasks'], ['MONITORING YOZUVI','/monitoring'], ['SOURCE / FAYL','/uploads'], ['RAHBAR','/insights/supervisors'], ['PROFIL TO‘LIQLIGI','/control'], ["PROFIL TO'LIQLIGI",'/control']
  ]);
  const addOpenCue = card => {
    if ($('.card-open-cue', card)) return;
    const cue = document.createElement('span');
    cue.className = 'card-open-cue';
    cue.setAttribute('aria-hidden','true');
    cue.textContent = '→';
    card.appendChild(cue);
  };
  const enhanceDashboardCard = (card, mini = false) => {
    if (!card || card.dataset.actionCardReady === '1') return;
    const label = normalizeCardLabel($('span', card)?.textContent);
    const href = card.dataset.cardHref || dashboardCardRoutes.get(label);
    if (!href) return;
    card.dataset.actionCardReady = '1';
    card.dataset.cardHref = href;
    card.classList.add(mini ? 'mini-action-card' : 'is-action-card');
    card.setAttribute('role','link');
    card.setAttribute('tabindex','0');
    card.setAttribute('aria-label', `${label || 'Statistika'} — ochish`);
    addOpenCue(card);
    const go = () => {
      if (href.startsWith('#')) {
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior:'smooth', block:'start' });
          history.replaceState(null,'',href);
          target.querySelector('input')?.focus({ preventScroll:true });
          return;
        }
      }
      window.location.assign(href);
    };
    card.addEventListener('click', event => {
      if (event.target.closest('a,button,input,select,textarea,label')) return;
      go();
    });
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        go();
      }
    });
  };
  $$('.headline-kpi,.kpi').forEach(card => enhanceDashboardCard(card));
  $$('.overview-grid>div').forEach(card => enhanceDashboardCard(card, true));

  // Live dashboard statistics (server-sent events, automatic browser reconnect).
  const valueAt = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
  const paintLiveStats = (root, data) => {
    root.classList.remove('live-sync-pulse');
    void root.offsetWidth;
    root.classList.add('live-sync-pulse');
    window.setTimeout(() => root.classList.remove('live-sync-pulse'), 720);
    $$('[data-live-ring-key]', root).forEach(ring => {
      const key = ring.dataset.liveRingKey;
      const value = valueAt(data, key);
      if (value === undefined || value === null) return;
      const previous = Number(ring.dataset.progressValue);
      setProgressRingValue(ring, value, true);
      if (previous !== Number(value)) {
        const card = ring.closest('.headline-kpi,.kpi,.group-stat-card');
        if (card) {
          card.classList.remove('card-value-updated');
          void card.offsetWidth;
          card.classList.add('card-value-updated');
          window.setTimeout(() => card.classList.remove('card-value-updated'), 650);
        }
      }
    });
    $$('[data-live-key]', root).forEach(element => {
      const key = element.dataset.liveKey;
      const value = valueAt(data, key);
      if (value === undefined || value === null) return;
      const next = key.startsWith('averages.') ? `${value}%` : String(value);
      if (element.textContent !== next) {
        element.textContent = next;
        element.classList.remove('live-value-change');
        void element.offsetWidth;
        element.classList.add('live-value-change');
        const card = element.closest('.headline-kpi,.kpi,.group-stat-card');
        if (card) {
          card.classList.remove('card-value-updated');
          void card.offsetWidth;
          card.classList.add('card-value-updated');
          window.setTimeout(() => card.classList.remove('card-value-updated'), 650);
        }
      }
    });
    $$('[data-live-progress]', root).forEach(element => {
      const value = Number(valueAt(data, element.dataset.liveProgress));
      if (Number.isFinite(value)) element.style.width = `${Math.max(0, Math.min(100, value))}%`;
    });
    $$('[data-live-group]', root).forEach(card => {
      const group = data.groupStats?.find(item => item.name === card.dataset.liveGroup);
      if (!group) return;
      $$('[data-group-key]', card).forEach(element => {
        const key = element.dataset.groupKey;
        const value = group[key];
        if (value !== undefined) element.textContent = key === 'readiness' ? `${value}%` : value;
      });
      const progress = $('[data-group-progress]', card);
      if (progress) progress.style.width = `${Math.max(0, Math.min(100, Number(group.readiness) || 0))}%`;
      card.classList.toggle('has-risk', Number(group.red) > 0);
      const badge = $('.status', card);
      badge?.classList.toggle('red', Number(group.red) > 0);
      badge?.classList.toggle('green', Number(group.red) === 0);
    });
    const status = $('[data-live-status]', root);
    if (status) {
      const time = new Date(data.updatedAt);
      const label = Number.isNaN(time.getTime()) ? 'Jonli' : `Jonli · ${time.toLocaleTimeString('uz-UZ', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}`;
      const text = $('span', status);
      if (text) text.textContent = label;
      status.classList.add('is-online');
      status.classList.remove('is-waiting');
    }
  };
  $$('[data-live-stats]').forEach(root => {
    if (!window.EventSource || !root.dataset.liveUrl) return;
    const status = $('[data-live-status]', root);
    const source = new EventSource(root.dataset.liveUrl);
    source.addEventListener('stats', event => {
      try { paintLiveStats(root, JSON.parse(event.data)); } catch (_) {}
    });
    const reconnecting = () => {
      if (!status) return;
      status.classList.remove('is-online');
      status.classList.add('is-waiting');
      const label = $('span', status);
      if (label) label.textContent = 'Qayta ulanmoqda…';
    };
    source.addEventListener('stats-error', reconnecting);
    source.onerror = reconnecting;
    window.addEventListener('beforeunload', () => source.close(), { once:true });
  });

  // Small, instant filters for group cards and the students inside a group.
  $('[data-group-search]')?.addEventListener('input', event => {
    const query = event.target.value.trim().toLocaleLowerCase('uz-UZ');
    $$('[data-group-search-item]').forEach(item => { item.hidden = !item.dataset.groupSearchItem.includes(query); });
  });
  $('[data-student-search]')?.addEventListener('input', event => {
    const query = event.target.value.trim().toLocaleLowerCase('uz-UZ');
    const items = $$('[data-student-search-item]');
    let visible = 0;
    items.forEach(item => {
      const show = item.dataset.studentSearchItem.includes(query);
      item.hidden = !show;
      if (show) visible += 1;
    });
    const count = $('[data-group-result-count]');
    if (count) count.textContent = visible;
    const empty = $('[data-student-empty]');
    if (empty) empty.hidden = visible !== 0;
  });


  // v2.8: adaptive motion engine. Low-end devices keep the same design with fewer concurrent layers.
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const cpuCores = Number(navigator.hardwareConcurrency || 8);
  const deviceMemory = Number(navigator.deviceMemory || 8);
  // Lite mode is now intentionally conservative: a normal 4-core PC/phone must still animate.
  // Only explicit Save-Data or genuinely very low-end devices are simplified.
  const lowPowerDevice = Boolean(
    connection?.saveData ||
    (cpuCores <= 2 && deviceMemory <= 2)
  );
  document.documentElement.classList.toggle('lite-motion', lowPowerDevice);
  document.addEventListener('visibilitychange', () => {
    document.documentElement.classList.toggle('motion-paused', document.hidden);
  });

  // All dashboard/panel surfaces receive the same aurora motion. Off-screen panels are paused.
  const movingPanels = $$('.panel');
  movingPanels.forEach(panel => panel.classList.add('motion-panel'));
  if ('IntersectionObserver' in window) {
    const motionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.target.classList.toggle('motion-offscreen', !entry.isIntersecting));
    }, { rootMargin:'100px 0px' });
    movingPanels.forEach(panel => motionObserver.observe(panel));
  }

  // v2.8.1: percentage values in visual KPI surfaces use a real SVG progress ring.
  // Plain percentages in tables/text remain plain text; no rotating '%' punctuation.
  const clampPercent = value => Math.max(0, Math.min(100, Number(value) || 0));
  const ringTone = value => value >= 85 ? 'ring-good' : value >= 65 ? 'ring-blue' : value >= 45 ? 'ring-watch' : 'ring-risk';

  const setProgressRingValue = (ring, rawValue, animate = true) => {
    if (!ring) return;
    const value = clampPercent(rawValue);
    ring.dataset.progressValue = String(value);
    ring.classList.remove('ring-good','ring-blue','ring-watch','ring-risk');
    ring.classList.add(ringTone(value));
    const progress = ring.querySelector('.svg-ring-progress');
    const number = ring.querySelector('.svg-ring-number');
    if (progress) {
      if (!animate || lowPowerDevice || matchMedia('(prefers-reduced-motion: reduce)').matches) progress.style.transition = 'none';
      else progress.style.transition = '';
      progress.style.strokeDashoffset = String(100 - value);
    }
    if (number) {
      const next = String(Math.round(value));
      if (number.textContent !== next) {
        number.textContent = next;
        ring.classList.remove('ring-value-hit');
        void ring.offsetWidth;
        ring.classList.add('ring-value-hit');
        window.setTimeout(() => ring.classList.remove('ring-value-hit'), 520);
      }
    }
    ring.setAttribute('aria-label', `${Math.round(value)} foiz`);
  };

  const createProgressRing = source => {
    const raw = String(source.textContent || '').trim();
    const match = raw.match(/^(-?\d+(?:[.,]\d+)?)\s*%$/);
    if (!match) return null;
    const value = clampPercent(match[1].replace(',', '.'));
    const parent = source.parentElement;
    const legacyRingHost = source.closest('.progress-ring');
    const sizeClass = parent?.classList.contains('headline-kpi') ? 'ring-lg'
      : parent?.classList.contains('kpi') ? 'ring-md'
      : legacyRingHost ? 'ring-xl'
      : parent?.classList.contains('student-progress-ring') ? 'ring-xl'
      : parent?.classList.contains('metric-bars') ? 'ring-xs' : 'ring-sm';
    const ring = document.createElement('div');
    ring.className = `svg-progress-ring ${sizeClass} ${ringTone(value)}`;
    ring.dataset.progressRing = '';
    ring.dataset.progressValue = String(value);
    if (source.dataset.liveKey) {
      ring.dataset.liveRingKey = source.dataset.liveKey;
      source.removeAttribute('data-live-key');
    }
    ring.setAttribute('role','img');
    ring.setAttribute('aria-label', `${Math.round(value)} foiz`);
    ring.innerHTML = `
      <svg class="svg-ring" viewBox="0 0 44 44" aria-hidden="true">
        <circle class="svg-ring-track" cx="22" cy="22" r="17.25" pathLength="100"></circle>
        <g class="svg-ring-orbit-group">
          <circle class="svg-ring-orbit" cx="22" cy="22" r="20" pathLength="100"></circle>
          <circle class="svg-ring-orbit-dot" cx="22" cy="2" r="1.35"></circle>
        </g>
        <circle class="svg-ring-progress" cx="22" cy="22" r="17.25" pathLength="100" style="stroke-dashoffset:100"></circle>
      </svg>
      <span class="svg-ring-center"><b class="svg-ring-number">${Math.round(value)}</b><small>%</small></span>`;
    source.replaceWith(ring);
    parent?.classList.add('has-svg-ring');
    if (legacyRingHost) legacyRingHost.classList.add('svg-ring-host');
    // Start at zero and animate to the actual value after insertion. Two RAFs make
    // the transition deterministic in Chromium/Edge instead of rendering directly at the end state.
    requestAnimationFrame(() => requestAnimationFrame(() => setProgressRingValue(ring, value, true)));
    return ring;
  };

  const progressRingSelectors = [
    '.headline-kpi > strong',
    '.kpi > strong',
    '.student-progress-ring > strong',
    '.progress-ring strong',
    '.student-pulse > div > b',
    '.milestone-card header > strong',
    '.profile-complete > b',
    '.overview-grid > div > b',
    '.metric-bars > strong'
  ].join(',');
  $$(progressRingSelectors).forEach(createProgressRing);

  // Pause only the SVG orbit when off screen. The progress arc itself stays rendered.
  const allProgressRings = $$('[data-progress-ring]');
  if ('IntersectionObserver' in window && !lowPowerDevice) {
    const ringObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.target.classList.toggle('ring-offscreen', !entry.isIntersecting));
    }, { rootMargin:'80px 0px' });
    allProgressRings.forEach(ring => ringObserver.observe(ring));
  }
  if (lowPowerDevice) document.documentElement.classList.add('lite-rings');

  // Avatar upload preview — no image library and no extra network request.
  const avatarInput = $('[data-avatar-input]');
  avatarInput?.addEventListener('change', () => {
    const file = avatarInput.files?.[0];
    const preview = $('[data-avatar-preview]');
    if (!file || !preview) return;
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.hidden = false;
    preview.onload = () => URL.revokeObjectURL(url);
  });

  // Lightweight attention ripple for actionable statistics; pointer events only, no continuous JS loop.
  document.addEventListener('pointerdown', event => {
    const card = event.target.closest('.is-action-card,.headline-kpi,.kpi,.network-stat,.people-chip');
    if (!card || lowPowerDevice) return;
    card.classList.remove('tap-pulse');
    void card.offsetWidth;
    card.classList.add('tap-pulse');
    window.setTimeout(() => card.classList.remove('tap-pulse'), 520);
  }, { passive:true });
})();

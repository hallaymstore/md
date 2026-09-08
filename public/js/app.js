(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];

  // Persistent light/dark theme. Applied before CSS in <head> to avoid flash.
  const THEME_KEY = 'md-qdtu-theme';
  const applyTheme = (theme) => {
    const t = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
    document.documentElement.style.colorScheme = t;
    const meta = document.querySelector('meta[name=\"theme-color\"]');
    if (meta) meta.content = t === 'dark' ? '#081625' : '#f6fbff';
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
})();

'use strict';
/* Black — all data stays in this browser (localStorage). No network calls. */

const KEY = 'black.v1';
const DAY = 864e5;
const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const defaults = () => ({
  profile: { birth: '', years: 80 },
  habits: [],   // {id,name,days:[0-6],log:{'YYYY-MM-DD':1},created}
  targets: [],  // {id,name,unit,goal,value,step}
  dates: [],    // {id,name,date,yearly}
  focus: { focusMin: 25, breakMin: 5, history: [], run: null }, // run: {phase,end|null,remaining}
});

function load() {
  const d = defaults();
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') {
      Object.assign(d, s);
      d.profile = Object.assign(defaults().profile, s.profile);
      d.focus = Object.assign(defaults().focus, s.focus);
      for (const k of ['habits', 'targets', 'dates']) if (!Array.isArray(d[k])) d[k] = [];
      if (!Array.isArray(d.focus.history)) d.focus.history = [];
    }
  } catch { /* corrupt or unavailable storage: start clean */ }
  return d;
}
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode */ } }

/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDate = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const dayDiff = (a, b) => Math.round((startOf(a) - startOf(b)) / DAY);
const plural = (n, w) => `${w}${n === 1 ? '' : 's'}`;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
}
const tick = () => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', 20); s.setAttribute('height', 20); s.setAttribute('fill', 'none'); s.setAttribute('stroke-width', 3); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); const p = document.createElementNS(s.namespaceURI, 'path'); p.setAttribute('d', 'M5 12.5l4.5 4.5L19 7.5'); s.append(p); return s; };

/* ---------- time ---------- */
function timeUnits(now) {
  const y = now.getFullYear(), m = now.getMonth(), today = startOf(now);
  const y0 = new Date(y, 0, 1), y1 = new Date(y + 1, 0, 1);
  const m0 = new Date(y, m, 1), m1 = new Date(y, m + 1, 1);
  const dow = (now.getDay() + 6) % 7; // Monday first
  const dayFrac = (now - today) / DAY;
  const daysY = Math.round((y1 - y0) / DAY), daysM = Math.round((m1 - m0) / DAY);
  const units = [
    { id: 'year', label: String(y), unit: 'day', total: daysY, passed: dayDiff(now, y0), frac: (now - y0) / (y1 - y0), cols: 26, wide: true, tiny: true },
    { id: 'month', label: now.toLocaleString(undefined, { month: 'long' }), unit: 'day', total: daysM, passed: now.getDate() - 1, frac: (now - m0) / (m1 - m0), cols: 7 },
    { id: 'week', label: 'Week', unit: 'day', total: 7, passed: dow, frac: (dow + dayFrac) / 7, cols: 7 },
    { id: 'day', label: 'Today', unit: 'hour', total: 24, passed: now.getHours(), frac: dayFrac, cols: 8 },
    { id: 'hour', label: 'This hour', unit: 'minute', total: 60, passed: now.getMinutes(), frac: (now.getMinutes() * 60 + now.getSeconds()) / 3600, cols: 10 },
  ];
  const b = S.profile.birth && parseDate(S.profile.birth);
  if (b && !isNaN(b) && b < now) {
    const years = clamp(Number(S.profile.years) || 80, 1, 130);
    const age = (now - b) / (365.2425 * DAY);
    const total = years * 52;
    units.unshift({ id: 'life', label: 'Life', unit: 'week', total, passed: Math.min(total, Math.floor(age * 52)), frac: Math.min(1, age / years), cols: 52, wide: true, tiny: true, sub: `Age ${Math.floor(age)} of ${years}` });
  }
  return units;
}

function unitCard(u) {
  const left = Math.max(0, u.total - u.passed);
  const dots = h('div', { class: 'dots' + (u.tiny ? ' tiny' : ''), style: `--cols:${u.cols}`, role: 'img', 'aria-label': `${u.passed} of ${u.total} ${u.unit}s passed` });
  const frag = document.createDocumentFragment();
  for (let i = 0; i < u.total; i++) { const d = document.createElement('i'); if (i < u.passed) d.className = 'p'; else if (i === u.passed) d.className = 'n'; frag.append(d); }
  dots.append(frag);
  return h('section', { class: 'card' + (u.wide ? ' wide' : '') },
    h('div', { class: 'card-head' }, h('span', { class: 'label' }, u.label), h('span', { class: 'pct num' }, `${(u.frac * 100).toFixed(u.id === 'life' ? 1 : 0)}%`)),
    h('div', { class: 'big num' }, left.toLocaleString(), h('small', {}, `${plural(left, u.unit)} left`)),
    u.sub && h('div', { class: 'sub' }, u.sub),
    dots);
}

let timeSig = '';
function viewTime(force) {
  const units = timeUnits(new Date());
  const sig = units.map((u) => u.id + u.passed + u.total).join('|');
  if (!force && sig === timeSig && $('#main .cards')) return;
  timeSig = sig;
  const cards = h('div', { class: 'cards' }, units.map(unitCard));
  if (units[0].id !== 'life') {
    cards.prepend(h('section', { class: 'card wide' },
      h('div', { class: 'card-head' }, h('span', { class: 'label' }, 'Life')),
      h('p', { class: 'sub', style: 'margin:0 0 14px' }, 'Add your birth date to see your life in weeks. It never leaves this device.'),
      h('button', { class: 'add', onclick: openSettings }, 'Add birth date')));
  }
  $('#main').replaceChildren(cards);
}

/* ---------- habits & targets ---------- */
function streak(hb) {
  const d = startOf(new Date());
  if (!hb.log[key(d)]) d.setDate(d.getDate() - 1); // an unfinished today doesn't break the streak
  let n = 0;
  for (let i = 0; i < 3660; i++) {
    const k = key(d);
    if (hb.log[k]) n++;
    else if (hb.days.includes(d.getDay())) break;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

function habitRow(hb) {
  const today = startOf(new Date()), tk = key(today);
  const done = !!hb.log[tk];
  const due = hb.days.includes(today.getDay());
  const toggle = (k) => { if (hb.log[k]) delete hb.log[k]; else hb.log[k] = 1; save(); render(); };
  const week = h('div', { class: 'week' });
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const k = key(d), on = !!hb.log[k], sched = hb.days.includes(d.getDay());
    week.append(h('button', { class: on ? 'on' : sched ? '' : 'off', title: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }), 'aria-label': `${d.toDateString()}: ${on ? 'done' : 'not done'}`, 'aria-pressed': String(on), onclick: () => toggle(k) }));
  }
  const n = streak(hb);
  return h('div', { class: 'row' },
    h('button', { class: 'check', 'aria-pressed': String(done), 'aria-label': `Mark ${hb.name} ${done ? 'not done' : 'done'} today`, onclick: () => toggle(tk) }, tick()),
    h('button', { class: 'body', onclick: () => editHabit(hb), 'aria-label': `Edit ${hb.name}` },
      h('div', { class: 'name' }, hb.name),
      h('div', { class: 'sub' }, done ? 'Done today' : due ? 'Due today' : 'Rest day')),
    h('div', { class: 'side' }, h('div', { class: 'streak' }, h('b', { class: 'num' }, n), h('span', {}, `${plural(n, 'day')} streak`)), week));
}

function targetRow(t) {
  const pct = t.goal > 0 ? clamp(t.value / t.goal, 0, 1) : 0;
  const bump = (dir) => { t.value = Math.max(0, +(t.value + dir * (t.step || 1)).toFixed(4)); save(); render(); };
  return h('div', { class: 'row' },
    h('button', { class: 'step', 'aria-label': `Decrease ${t.name}`, onclick: () => bump(-1) }, '−'),
    h('button', { class: 'body', onclick: () => editTarget(t), 'aria-label': `Edit ${t.name}` },
      h('div', { class: 'name' }, t.name),
      h('div', { class: 'sub num' }, `${t.value.toLocaleString()} of ${t.goal.toLocaleString()} ${t.unit || ''} · ${Math.round(pct * 100)}%`),
      h('div', { class: 'bar' }, h('i', { style: `width:${pct * 100}%` }))),
    h('button', { class: 'step', 'aria-label': `Increase ${t.name}`, onclick: () => bump(1) }, '+'));
}

function viewHabits() {
  $('#main').replaceChildren(
    h('div', { class: 'section-head' }, h('h2', {}, 'Habits'), h('button', { class: 'add', onclick: () => editHabit() }, 'New habit')),
    S.habits.length ? h('div', { class: 'list' }, S.habits.map(habitRow)) : h('div', { class: 'empty' }, 'No habits yet. Start with one small thing you can do every day.'),
    h('div', { class: 'section-head' }, h('h2', {}, 'Targets'), h('button', { class: 'add', onclick: () => editTarget() }, 'New target')),
    S.targets.length ? h('div', { class: 'list' }, S.targets.map(targetRow)) : h('div', { class: 'empty' }, 'A target is anything you can count: pages read, money saved, kilometres run.'));
}

function editHabit(hb) {
  openForm(hb ? 'Edit habit' : 'New habit', [
    { k: 'name', label: 'Name', type: 'text', value: hb?.name || '', attrs: { required: true, maxlength: 60, placeholder: 'Read for 20 minutes' } },
    { k: 'days', label: 'Repeat on', type: 'days', value: hb?.days || [0, 1, 2, 3, 4, 5, 6] },
  ], (v) => {
    if (!v.days.length) v.days = [0, 1, 2, 3, 4, 5, 6];
    if (hb) Object.assign(hb, v); else S.habits.push({ id: uid(), log: {}, created: key(new Date()), ...v });
  }, hb && (() => { S.habits = S.habits.filter((x) => x !== hb); }));
}

function editTarget(t) {
  openForm(t ? 'Edit target' : 'New target', [
    { k: 'name', label: 'Name', type: 'text', value: t?.name || '', attrs: { required: true, maxlength: 60, placeholder: 'Read 20 books' } },
    { k: 'goal', label: 'Goal', type: 'number', value: t?.goal ?? '', attrs: { required: true, min: 0.01, step: 'any', inputmode: 'decimal' } },
    { k: 'value', label: 'Progress so far', type: 'number', value: t?.value ?? 0, attrs: { min: 0, step: 'any', inputmode: 'decimal' } },
    { k: 'step', label: 'Each tap adds', type: 'number', value: t?.step ?? 1, attrs: { min: 0.01, step: 'any', inputmode: 'decimal' } },
    { k: 'unit', label: 'Unit (optional)', type: 'text', value: t?.unit || '', attrs: { maxlength: 16, placeholder: 'books' } },
  ], (v) => {
    v.value = v.value || 0; v.step = v.step || 1;
    if (t) Object.assign(t, v); else S.targets.push({ id: uid(), ...v });
  }, t && (() => { S.targets = S.targets.filter((x) => x !== t); }));
}

/* ---------- ahead ---------- */
function daysTo(ev, today) {
  const d = parseDate(ev.date);
  if (!ev.yearly) return { n: dayDiff(d, today), on: d };
  let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  return { n: dayDiff(next, today), on: next };
}

function viewAhead() {
  const today = startOf(new Date());
  const all = S.dates.map((ev) => ({ ev, ...daysTo(ev, today) }));
  const ahead = all.filter((x) => x.n >= 0).sort((a, b) => a.n - b.n);
  const since = all.filter((x) => x.n < 0).sort((a, b) => b.n - a.n);
  const row = ({ ev, n, on }) => h('button', { class: 'row', onclick: () => editDate(ev), 'aria-label': `Edit ${ev.name}` },
    h('div', { class: 'count' }, h('b', { class: 'num' }, n === 0 ? 'Today' : Math.abs(n).toLocaleString()), n !== 0 && h('span', {}, `${plural(Math.abs(n), 'day')} ${n > 0 ? 'to go' : 'ago'}`)),
    h('div', { class: 'body' }, h('div', { class: 'name' }, ev.name),
      h('div', { class: 'sub' }, on.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + (ev.yearly ? ' · yearly' : ''))));
  $('#main').replaceChildren(
    h('div', { class: 'section-head' }, h('h2', {}, 'Ahead'), h('button', { class: 'add', onclick: () => editDate() }, 'New date')),
    ahead.length ? h('div', { class: 'list' }, ahead.map(row)) : h('div', { class: 'empty' }, 'Nothing ahead yet. Add a trip, a birthday, a deadline.'),
    since.length ? h('div', { class: 'section-head' }, h('h2', {}, 'Since')) : null,
    since.length ? h('div', { class: 'list' }, since.map(row)) : null);
}

function editDate(ev) {
  openForm(ev ? 'Edit date' : 'New date', [
    { k: 'name', label: 'Name', type: 'text', value: ev?.name || '', attrs: { required: true, maxlength: 60, placeholder: 'Trip to Lisbon' } },
    { k: 'date', label: 'Date', type: 'date', value: ev?.date || '', attrs: { required: true } },
    { k: 'yearly', label: 'Repeats every year', type: 'checkbox', value: !!ev?.yearly },
  ], (v) => { if (ev) Object.assign(ev, v); else S.dates.push({ id: uid(), ...v }); },
  ev && (() => { S.dates = S.dates.filter((x) => x !== ev); }));
}

/* ---------- focus ---------- */
const CIRC = 2 * Math.PI * 46;
const phaseMs = (p) => (p === 'focus' ? S.focus.focusMin : S.focus.breakMin) * 60000;
const run = () => S.focus.run || (S.focus.run = { phase: 'focus', end: null, remaining: phaseMs('focus') });
const remaining = () => { const r = run(); return r.end ? Math.max(0, r.end - Date.now()) : r.remaining; };
const fmt = (ms) => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

function chime() {
  try {
    const C = window.AudioContext || window.webkitAudioContext; const ctx = new C();
    [0, 0.25].forEach((t, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = i ? 880 : 660; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.0001, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.4); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.45); });
    if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
  } catch { /* audio not available */ }
}

function focusTick() {
  const r = run();
  if (r.end && Date.now() >= r.end) {
    if (r.phase === 'focus') S.focus.history.push({ t: r.end, min: S.focus.focusMin });
    if (S.focus.history.length > 2000) S.focus.history = S.focus.history.slice(-2000);
    const overdue = Date.now() - r.end > 5000; // finished while the app was closed
    const next = r.phase === 'focus' ? 'break' : 'focus';
    S.focus.run = { phase: next, end: null, remaining: phaseMs(next) };
    save();
    if (!overdue) chime();
    if (tab === 'focus') viewFocus();
  }
  const rr = run();
  document.title = rr.end ? `${fmt(remaining())} · Black` : 'Black — see the time you have';
  if (tab === 'focus') paintFocus();
}

function paintFocus() {
  const r = run(), ms = remaining(), total = phaseMs(r.phase);
  const t = $('#f-time'); if (!t) return;
  t.textContent = fmt(ms);
  $('#f-prog').style.strokeDashoffset = String(CIRC * (1 - clamp(ms / total, 0, 1)));
}

function viewFocus() {
  const r = run(), running = !!r.end, fresh = !running && r.remaining === phaseMs(r.phase);
  const today = key(new Date());
  const todays = S.focus.history.filter((x) => key(new Date(x.t)) === today);
  const mins = todays.reduce((a, x) => a + x.min, 0);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.innerHTML = `<circle class="track" cx="50" cy="50" r="46"/><circle id="f-prog" class="prog" cx="50" cy="50" r="46" stroke-dasharray="${CIRC}"/>`;
  const dur = (k, label) => h('label', {}, label, h('input', { type: 'number', min: 1, max: 180, value: S.focus[k], inputmode: 'numeric', disabled: running, onchange: (e) => {
    S.focus[k] = clamp(Math.round(Number(e.target.value)) || 1, 1, 180);
    if (!run().end) S.focus.run = { phase: run().phase, end: null, remaining: phaseMs(run().phase) };
    save(); viewFocus();
  } }));
  $('#main').replaceChildren(h('div', { class: 'focus' },
    h('div', { class: 'ring' }, svg, h('div', { class: 'read' }, h('b', { id: 'f-time', class: 'num', 'aria-live': 'off' }, fmt(remaining())), h('span', {}, r.phase === 'focus' ? 'Focus' : 'Break'))),
    h('div', { class: 'controls' },
      h('button', { class: 'btn primary', onclick: () => { const x = run(); if (x.end) { x.remaining = remaining(); x.end = null; } else { x.end = Date.now() + x.remaining; } save(); viewFocus(); } }, running ? 'Pause' : fresh ? 'Start' : 'Resume'),
      h('button', { class: 'btn', disabled: fresh, onclick: () => { S.focus.run = { phase: r.phase, end: null, remaining: phaseMs(r.phase) }; save(); viewFocus(); } }, 'Reset'),
      h('button', { class: 'btn', onclick: () => { const n = r.phase === 'focus' ? 'break' : 'focus'; S.focus.run = { phase: n, end: null, remaining: phaseMs(n) }; save(); viewFocus(); } }, r.phase === 'focus' ? 'Break' : 'Focus')),
    h('div', { class: 'durations' }, dur('focusMin', 'Focus minutes'), dur('breakMin', 'Break minutes')),
    h('p', { class: 'sub num' }, todays.length ? `${todays.length} ${plural(todays.length, 'session')} today · ${mins} min focused` : 'No sessions yet today.')));
  paintFocus();
}

/* ---------- sheet / forms ---------- */
function openForm(title, fields, onSave, onDelete) {
  const sheet = $('#sheet'), vals = {};
  const controls = fields.map((f) => {
    if (f.type === 'days') {
      vals[f.k] = [...f.value];
      // show Monday first
      const btns = [1, 2, 3, 4, 5, 6, 0].map((d) => h('button', { type: 'button', 'aria-pressed': String(vals[f.k].includes(d)), 'aria-label': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d], onclick: (e) => {
        const on = vals[f.k].includes(d);
        vals[f.k] = on ? vals[f.k].filter((x) => x !== d) : [...vals[f.k], d];
        e.currentTarget.setAttribute('aria-pressed', String(!on));
      } }, WD[d]));
      return h('label', {}, f.label, h('div', { class: 'days' }, btns));
    }
    if (f.type === 'checkbox') return h('label', { class: 'inline' }, h('input', { type: 'checkbox', name: f.k, checked: f.value }), f.label);
    return h('label', {}, f.label, h('input', { type: f.type, name: f.k, value: f.value, ...f.attrs }));
  });
  const form = h('form', { method: 'dialog', onsubmit: (e) => {
    e.preventDefault();
    for (const f of fields) {
      if (f.type === 'days') continue;
      const el = form.elements[f.k];
      vals[f.k] = f.type === 'checkbox' ? el.checked : f.type === 'number' ? Number(el.value) : el.value.trim();
    }
    onSave(vals); save(); sheet.close(); render(true);
  } }, controls,
    h('div', { class: 'actions' },
      onDelete && h('button', { type: 'button', class: 'btn danger', onclick: () => { if (confirm('Delete this? This cannot be undone.')) { onDelete(); save(); sheet.close(); render(true); } } }, 'Delete'),
      h('button', { type: 'button', class: 'btn', onclick: () => sheet.close() }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn primary' }, 'Save')));
  sheet.replaceChildren(h('h2', {}, title), form);
  sheet.showModal();
}

function openSettings() {
  const sheet = $('#sheet');
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || typeof d !== 'object' || !('habits' in d || 'dates' in d || 'profile' in d)) throw new Error('not a Black backup');
      if (!confirm('Replace everything in Black with this backup?')) return;
      localStorage.setItem(KEY, JSON.stringify(d)); S = load(); save(); sheet.close(); render(true);
    } catch { alert('That file is not a Black backup.'); }
  } });
  const form = h('form', { method: 'dialog', onsubmit: (e) => {
    e.preventDefault();
    S.profile.birth = form.elements.birth.value;
    S.profile.years = clamp(Math.round(Number(form.elements.years.value)) || 80, 1, 130);
    save(); sheet.close(); render(true);
  } },
    h('label', {}, 'Birth date', h('input', { type: 'date', name: 'birth', value: S.profile.birth, max: key(new Date()) })),
    h('label', {}, 'Years to plan for', h('input', { type: 'number', name: 'years', value: S.profile.years, min: 1, max: 130, inputmode: 'numeric' })),
    h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', onclick: () => sheet.close() }, 'Cancel'), h('button', { type: 'submit', class: 'btn primary' }, 'Save')),
    h('p', { class: 'note' }, 'Everything is stored only in this browser. Export a backup to move it or keep it safe. ', h('a', { href: 'privacy.html' }, 'Privacy')),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => {
        const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' })), download: `black-backup-${key(new Date())}.json` });
        document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      } }, 'Export'),
      h('button', { type: 'button', class: 'btn', onclick: () => file.click() }, 'Import'),
      h('button', { type: 'button', class: 'btn danger', onclick: () => { if (confirm('Erase all Black data on this device? This cannot be undone.')) { localStorage.removeItem(KEY); S = load(); sheet.close(); render(true); } } }, 'Erase all')),
    file);
  sheet.replaceChildren(h('h2', {}, 'Settings'), form);
  sheet.showModal();
}

/* ---------- shell ---------- */
const VIEWS = { time: ['Time', viewTime], habits: ['Habits', viewHabits], ahead: ['Ahead', viewAhead], focus: ['Focus', viewFocus] };
let tab = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'time';

function render(force) {
  const [title, fn] = VIEWS[tab];
  $('#view-title').textContent = title;
  document.querySelectorAll('.tabs button').forEach((b) => b.toggleAttribute('aria-current', false));
  $(`.tabs [data-tab="${tab}"]`).setAttribute('aria-current', 'page');
  fn(force);
}

document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  tab = b.dataset.tab; history.replaceState(null, '', '#' + tab); timeSig = ''; render(true); window.scrollTo(0, 0);
}));
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (VIEWS[t] && t !== tab) { tab = t; render(true); } });
$('#settings-btn').addEventListener('click', openSettings);
$('#sheet').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

let lastDay = key(new Date());
setInterval(() => {
  focusTick();
  if (tab === 'time') viewTime();
  const k = key(new Date());
  if (k !== lastDay) { lastDay = k; render(true); } // midnight rollover
}, 500);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { focusTick(); render(true); } });

render(true);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

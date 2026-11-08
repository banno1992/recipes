'use strict';

/* ---------- storage ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('rx.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('rx.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
};

let RECIPES = [];
let BY_ID = {};
const $view = document.getElementById('view');
const $title = document.getElementById('title');
const $back = document.getElementById('back');

/* ---------- helpers ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = {
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  unlock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.7"/></svg>',
  dice: '<svg viewBox="0 0 24 24"><path d="M4 4v6h6"/><path d="M20 20v-6h-6"/><path d="M5.5 15a7 7 0 0 0 12.3 2.3L20 14M4 10l2.2-3.3A7 7 0 0 1 18.5 9"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
  timer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>',
  cart: '<svg viewBox="0 0 24 24"><path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
};

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2200);
}

/* ---------- quantities ---------- */
const FRACS = [[0, ''], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'], [1, '']];
function fmtNum(n) {
  if (n >= 10) return String(Math.round(n));
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  let best = FRACS[0], bd = 9;
  for (const f of FRACS) { const d = Math.abs(frac - f[0]); if (d < bd) { bd = d; best = f; } }
  const w = best[0] === 1 ? whole + 1 : whole;
  if (!best[1]) return String(w);
  return (w ? w : '') + best[1];
}
function plural(display, n) {
  if (n <= 1) return display;
  const m = display.match(/^(\w+)( of .*)$/);
  const pl = w => /(s|x|ch|sh)$/.test(w) ? w + 'es' : /(potato|tomato)$/.test(w) ? w + 'es' : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : w + 's';
  if (m) return pl(m[1]) + m[2];
  if (/s$/.test(display)) return display;
  return display.replace(/(\w+)(\s*\(.*\))?$/, (all, w, rest) => pl(w) + (rest || ''));
}

// Returns {amount, unit, metric?, estimated} for a given number of servings, or null.
function qtyFor(ing, servings) {
  const q = ing.qty;
  if (!q) return null;
  if (q[servings]) return Object.assign({}, q[servings]);
  const cols = Object.keys(q).map(Number).sort((a, b) => a - b);
  let near = cols[0];
  for (const c of cols) if (Math.abs(c - servings) < Math.abs(near - servings) || (Math.abs(c - servings) === Math.abs(near - servings) && c > near)) near = c;
  const base = q[near], f = servings / near;
  const out = Object.assign({}, base, { amount: roundQty(base.amount * f, base.unit), scaled: true });
  if (base.metric) out.metric = { amount: roundQty(base.metric.amount * f, base.metric.unit), unit: base.metric.unit };
  return out;
}
function roundQty(a, unit) {
  if (unit === 'g' || unit === 'ml') return a < 20 ? Math.max(1, Math.round(a)) : Math.round(a / 5) * 5;
  if (unit === 'kg' || unit === 'l') return Math.round(a * 100) / 100;
  if (unit === 'tsp' || unit === 'tbsp') return Math.max(0.25, Math.round(a * 4) / 4);
  return Math.max(1, Math.round(a)); // counts, bunches, packs
}
function fmtMeasure(amount, unit) {
  if (unit === 'g' && amount >= 1000) return fmtNum(amount / 1000) + 'kg';
  if (unit === 'ml' && amount >= 1000) return fmtNum(amount / 1000) + 'l';
  if (unit === 'g' || unit === 'ml' || unit === 'kg' || unit === 'l') return (amount >= 10 ? Math.round(amount) : fmtNum(amount)) + unit;
  if (!unit) return fmtNum(amount);
  if (unit === 'tsp' || unit === 'tbsp') return fmtNum(amount) + ' ' + unit;
  return fmtNum(amount) + ' ' + (amount > 1 && !/s$/.test(unit) ? (/(ch|sh)$/.test(unit) ? unit + 'es' : unit + 's') : unit);
}
// "240g pork mince", "2 carrots", "1 bunch coriander", "1 pack (280g) chicken"
function ingText(ing, q) {
  if (!q) return ing.display;
  let s = fmtMeasure(q.amount, q.unit);
  if (q.metric) s += ' (' + fmtMeasure(q.metric.amount, q.metric.unit) + ')';
  const name = q.unit === '' ? plural(ing.display, q.amount) : ing.display;
  return s + ' ' + name;
}
const FRAC_MOD = { half: 0.5, third: 1 / 3, quarter: 0.25 };
function renderStep(text, recipe, servings) {
  const ings = {};
  recipe.ingredients.forEach(i => { ings[i.id] = i; });
  return esc(text).replace(/\{(i\d+)(?::([^}]+))?\}/g, (m, id, mod) => {
    const ing = ings[id];
    if (!ing) return m;
    if (mod === 'name' || !ing.qty) return '<b>' + esc(ing.display) + '</b>';
    if (mod === 'rest') return 'the remaining <b>' + esc(ing.display) + '</b>';
    const q = qtyFor(ing, servings);
    if (FRAC_MOD[mod]) {
      const f = FRAC_MOD[mod];
      const amt = q.amount * f;
      let s = q.unit === '' ? fmtNum(amt) : fmtMeasure(q.unit === 'g' || q.unit === 'ml' ? Math.round(amt) : amt, q.unit);
      return '<b>' + esc(s + ' ' + (q.unit === '' && amt > 1 ? plural(ing.display, amt) : ing.display)) + '</b>';
    }
    if (/^[\d.]+\s*\w*$/.test(mod || '')) { // explicit amount like {i3:100g}
      const mm = mod.match(/^([\d.]+)\s*(\w*)$/);
      const base = ing.qty[recipe.servings.base];
      const f = servings / recipe.servings.base;
      const amt = roundQty(parseFloat(mm[1]) * f, mm[2] || (base && base.unit) || '');
      return '<b>' + esc(fmtMeasure(amt, mm[2]) + ' ' + ing.display) + '</b>';
    }
    return '<b>' + esc(ingText(ing, q)) + '</b>';
  });
}

/* ---------- state ---------- */
const week = {
  all() { return store.get('week', []).filter(w => BY_ID[w.id]); },
  has(id) { return this.all().some(w => w.id === id); },
  get(id) { return this.all().find(w => w.id === id); },
  set(id, servings) {
    const w = store.get('week', []);
    const ex = w.find(x => x.id === id);
    if (ex) ex.servings = servings; else w.push({ id, servings });
    store.set('week', w);
    const h = store.get('history', {}); h[id] = Date.now(); store.set('history', h);
    updateBadge();
  },
  remove(id) { store.set('week', store.get('week', []).filter(x => x.id !== id)); updateBadge(); },
  clear() { store.set('week', []); store.set('checks', {}); updateBadge(); },
};
function defaultServings(r) { return store.get('servings', 2) || r.servings.base; }
function updateBadge() {
  const n = week.all().length;
  const b = document.getElementById('weekBadge');
  b.textContent = n; b.hidden = !n;
}

/* ---------- picker ---------- */
function weightFor(id, history, now) {
  const last = history[id];
  if (!last) return 100; // never picked: most likely
  const days = (now - last) / 864e5;
  if (days < 7) return 1;
  return Math.min(100, 5 + days * 1.2);
}
function draw(n, keep) {
  const history = store.get('history', {}), now = Date.now();
  const pool = RECIPES.filter(r => !keep.includes(r.id)).map(r => ({ id: r.id, w: weightFor(r.id, history, now) }));
  const out = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let x = Math.random() * total, i = 0;
    while (i < pool.length - 1 && (x -= pool[i].w) > 0) i++;
    out.push(pool.splice(i, 1)[0].id);
  }
  return out;
}
function currentPicks() {
  const size = store.get('pickSize', 5);
  let picks = store.get('picks', []).filter(id => BY_ID[id]);
  const locks = store.get('locks', []).filter(id => picks.includes(id));
  if (picks.length !== Math.min(size, RECIPES.length)) {
    picks = picks.filter(id => locks.includes(id)).concat(picks.filter(id => !locks.includes(id)));
    if (picks.length > size) picks = picks.slice(0, Math.max(size, locks.length));
    else picks = picks.concat(draw(size - picks.length, picks));
    store.set('picks', picks);
  }
  return { picks, locks, size };
}
function reroll() {
  const { picks, locks } = currentPicks();
  const fresh = draw(picks.length - locks.length, picks); // exclude everything currently shown
  const pool = fresh.length < picks.length - locks.length ? draw(picks.length - locks.length, locks) : fresh;
  let k = 0;
  store.set('picks', picks.map(id => locks.includes(id) ? id : pool[k++]).filter(Boolean));
  renderPick();
  window.scrollTo(0, 0);
}

function tile(r, opts = {}) {
  const inWeek = week.get(r.id);
  return `<div class="tile${opts.locked ? ' locked' : ''}${opts.big ? ' big' : ''}" data-open="${r.id}" role="button" tabindex="0">
    <div class="ph"><img src="${esc(r.image)}" alt="" loading="lazy"></div>
    <div class="t">${esc(r.title)}</div>
    ${inWeek ? `<span class="inweek">✓ ${inWeek.servings}</span>` : ''}
    ${opts.lockable ? `<button class="lock" data-lock="${r.id}" aria-label="${opts.locked ? 'Unlock' : 'Lock'}">${opts.locked ? icon.lock : icon.unlock}</button>` : ''}
  </div>`;
}

function renderPick() {
  setHeader('What shall we eat?', 'pick');
  if (!RECIPES.length) { $view.innerHTML = '<p class="empty">No recipes yet.</p>'; return; }
  const { picks, locks, size } = currentPicks();
  $view.innerHTML = `
    <div class="toolbar">
      <span class="hint">Tap a meal to add it. Lock to keep.</span>
      <div class="seg" role="group" aria-label="How many">
        <button data-size="5" class="${size === 5 ? 'on' : ''}">5</button>
        <button data-size="10" class="${size === 10 ? 'on' : ''}">10</button>
      </div>
    </div>
    <div class="grid">${picks.map(id => tile(BY_ID[id], { lockable: true, locked: locks.includes(id) })).join('')}</div>
    <div class="reroll-bar"><button class="btn" id="reroll">${icon.dice} Reroll${locks.length ? ' unlocked' : ''}</button></div>`;
  $view.querySelectorAll('[data-size]').forEach(b => b.onclick = () => { store.set('pickSize', +b.dataset.size); renderPick(); });
  $view.querySelector('#reroll').onclick = reroll;
  $view.querySelectorAll('[data-lock]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const id = b.dataset.lock;
    let l = store.get('locks', []);
    l = l.includes(id) ? l.filter(x => x !== id) : l.concat(id);
    store.set('locks', l);
    renderPick();
  });
  bindTiles(renderPick);
}

function bindTiles(onChange) {
  $view.querySelectorAll('[data-open]').forEach(t => t.onclick = () => openSheet(t.dataset.open, onChange));
}

/* ---------- bottom sheet ---------- */
function openSheet(id, onChange) {
  const r = BY_ID[id];
  const existing = week.get(id);
  let s = existing ? existing.servings : defaultServings(r);
  const sheet = document.getElementById('sheet'), bd = document.getElementById('sheetBackdrop');
  const draw = () => {
    sheet.innerHTML = `<div class="grab"></div>
      <div class="s-top"><img src="${esc(r.image)}" alt="">
        <div><h3>${esc(r.title)}</h3><div class="sub">${esc(r.source.brand || '')}${r.time_minutes ? ' · ' + r.time_minutes + ' min' : ''}</div></div></div>
      <div class="serve-bar"><span class="lbl">Servings</span>${stepper(s)}</div>
      <div class="acts">
        <button class="btn block" id="sAdd">${existing ? 'Update this week' : 'Add to this week'}</button>
        ${existing ? '<button class="btn secondary block" id="sRemove">Remove from this week</button>' : ''}
        <a class="btn secondary block" href="#/r/${r.id}" id="sView">View recipe</a>
      </div>`;
    bindStepper(sheet, v => { s = v; draw(); });
    sheet.querySelector('#sAdd').onclick = () => { week.set(id, s); store.set('servings', s); close(); toast(existing ? 'Updated' : 'Added to this week'); onChange && onChange(); };
    const rm = sheet.querySelector('#sRemove');
    if (rm) rm.onclick = () => { week.remove(id); close(); toast('Removed'); onChange && onChange(); };
    sheet.querySelector('#sView').onclick = e => { e.preventDefault(); close('#/r/' + r.id); };
  };
  // Closing pops the history entry the sheet pushed; navigate (if asked) only after that pop lands.
  const close = goTo => {
    sheet.hidden = true; bd.hidden = true;
    if (history.state && history.state.sheet) { sheetGoTo = goTo || null; history.back(); }
    else if (goTo) location.hash = goTo;
  };
  bd.onclick = close;
  draw();
  sheet.hidden = false; bd.hidden = false;
  history.pushState({ sheet: true }, '');
}
let sheetGoTo = null;
window.addEventListener('popstate', () => {
  document.getElementById('sheet').hidden = true;
  document.getElementById('sheetBackdrop').hidden = true;
  if (sheetGoTo) { const h = sheetGoTo; sheetGoTo = null; location.hash = h; }
});

function stepper(v, small) {
  return `<div class="stepper${small ? ' small' : ''}"><button data-step="-1" ${v <= 1 ? 'disabled' : ''} aria-label="Fewer">−</button><output>${small ? v : v + (v === 1 ? ' person' : ' people')}</output><button data-step="1" ${v >= 12 ? 'disabled' : ''} aria-label="More">+</button></div>`;
}
function bindStepper(root, cb, getV) {
  root.querySelectorAll('[data-step]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    const out = b.parentElement.querySelector('output');
    const cur = getV ? getV(b) : parseInt(out.textContent, 10);
    cb(Math.min(12, Math.max(1, cur + +b.dataset.step)), b);
  });
}

/* ---------- this week ---------- */
function renderWeek() {
  setHeader('This week', 'week');
  const w = week.all();
  if (!w.length) {
    $view.innerHTML = `<div class="empty">Nothing picked yet.<br><a class="btn" href="#/">Pick meals</a></div>`;
    return;
  }
  $view.innerHTML = `
    <div class="card rows">${w.map(x => {
      const r = BY_ID[x.id];
      return `<div class="row" data-id="${r.id}">
        <a href="#/r/${r.id}"><img class="thumb" src="${esc(r.image)}" alt=""></a>
        <div class="grow"><a href="#/r/${r.id}"><div class="name">${esc(r.title)}</div></a>
          <div style="margin-top:6px">${stepper(x.servings, true)}</div></div>
        <button class="icon-btn" data-rm="${r.id}" aria-label="Remove">${icon.x}</button>
      </div>`;
    }).join('')}</div>
    <div class="stack">
      <a class="btn block" href="#/list">${icon.cart} Shopping list</a>
      <button class="btn ghost" id="clearWeek">Clear the week</button>
    </div>`;
  bindStepper($view, (v, b) => { week.set(b.closest('.row').dataset.id, v); renderWeek(); });
  $view.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { week.remove(b.dataset.rm); renderWeek(); });
  $view.querySelector('#clearWeek').onclick = () => {
    if (confirm('Clear all meals from this week?')) { week.clear(); store.set('picks', []); renderWeek(); }
  };
}

/* ---------- shopping list ---------- */
const CAT_ORDER = ['fruit-veg', 'meat-fish', 'dairy-eggs', 'bakery', 'cupboard', 'herbs-spices', 'frozen', 'other'];
const CAT_NAME = { 'fruit-veg': 'Fruit & veg', 'meat-fish': 'Meat & fish', 'dairy-eggs': 'Dairy & eggs', bakery: 'Bakery', cupboard: 'Cupboard', 'herbs-spices': 'Herbs & spices', frozen: 'Frozen', other: 'Other' };
function unitKind(u) {
  if (u === 'g' || u === 'kg') return ['mass', u === 'kg' ? 1000 : 1];
  if (u === 'ml' || u === 'l') return ['vol', u === 'l' ? 1000 : 1];
  if (u === 'tsp' || u === 'tbsp') return ['spoon', u === 'tbsp' ? 3 : 1];
  return ['count:' + u, 1];
}
function buildList() {
  const items = {};
  for (const w of week.all()) {
    const r = BY_ID[w.id];
    for (const ing of r.ingredients) {
      if (ing.staple) continue;
      const q = qtyFor(ing, w.servings);
      const [kind, mult] = q ? unitKind(q.unit) : ['none', 1];
      const key = ing.name + '|' + kind;
      const it = items[key] || (items[key] = { key, name: ing.name, kind, total: 0, cat: ing.category, cupboard: !!ing.cupboard, optional: true, from: [], estimated: false });
      if (q) it.total += q.amount * mult;
      it.optional = it.optional && !!ing.optional;
      it.estimated = it.estimated || !!ing.estimated;
      if (!it.from.includes(r.title)) it.from.push(r.title);
    }
  }
  return Object.values(items);
}
function fmtTotal(it) {
  if (it.kind === 'none') return '';
  if (it.kind === 'mass') return fmtMeasure(Math.round(it.total), 'g');
  if (it.kind === 'vol') return fmtMeasure(Math.round(it.total), 'ml');
  if (it.kind === 'spoon') return it.total >= 3 ? fmtMeasure(it.total / 3, 'tbsp') : fmtMeasure(it.total, 'tsp');
  const u = it.kind.slice(6);
  return fmtMeasure(it.total, u);
}
function listGroups() {
  const items = buildList();
  const groups = [];
  for (const c of CAT_ORDER) {
    const g = items.filter(i => !i.cupboard && (i.cat === c || (c === 'other' && !CAT_ORDER.includes(i.cat))));
    if (g.length) groups.push({ title: CAT_NAME[c], items: g.sort((a, b) => a.name.localeCompare(b.name)) });
  }
  const cup = items.filter(i => i.cupboard).sort((a, b) => a.name.localeCompare(b.name));
  if (cup.length) groups.push({ title: 'Check the cupboard', items: cup });
  return groups;
}
function renderList() {
  setHeader('Shopping list', 'list');
  const groups = listGroups();
  if (!groups.length) {
    $view.innerHTML = `<div class="empty">Add meals to this week first.<br><a class="btn" href="#/">Pick meals</a></div>`;
    return;
  }
  const checks = store.get('checks', {});
  const n = week.all().length;
  $view.innerHTML = `
    <div class="count">${n} meal${n === 1 ? '' : 's'}</div>
    <div class="list-actions">
      <button class="btn" id="share">${icon.share} Share</button>
      <button class="btn secondary" id="untick">Untick all</button>
    </div>
    ${groups.map(g => `<div class="section-h">${esc(g.title)}</div>
      <div class="card rows">${g.items.map(it => `
        <label class="check${checks[it.key] ? ' done' : ''}">
          <input type="checkbox" data-key="${esc(it.key)}" ${checks[it.key] ? 'checked' : ''}>
          <div class="grow"><div><span class="item">${esc(it.name)}</span>${it.optional ? ' <span class="from">(optional)</span>' : ''}</div>
            <div class="from">${esc(it.from.join(', '))}</div></div>
          <span class="amt">${esc(fmtTotal(it))}${it.estimated ? '*' : ''}</span>
        </label>`).join('')}</div>`).join('')}
    <p class="from" style="margin:14px 4px">* approximate amount</p>`;
  $view.querySelectorAll('input[data-key]').forEach(cb => cb.onchange = () => {
    const c = store.get('checks', {});
    if (cb.checked) c[cb.dataset.key] = true; else delete c[cb.dataset.key];
    store.set('checks', c);
    cb.closest('.check').classList.toggle('done', cb.checked);
  });
  $view.querySelector('#untick').onclick = () => { store.set('checks', {}); renderList(); };
  $view.querySelector('#share').onclick = shareList;
}
async function shareList() {
  const checks = store.get('checks', {});
  const lines = ['Shopping list', ''];
  for (const g of listGroups()) {
    const todo = g.items.filter(i => !checks[i.key]);
    if (!todo.length) continue;
    lines.push(g.title.toUpperCase());
    for (const i of todo) { const t = fmtTotal(i); lines.push('- ' + i.name + (t ? ' ' + t : '')); }
    lines.push('');
  }
  lines.push('Meals: ' + week.all().map(w => BY_ID[w.id].title + ' (' + w.servings + ')').join(', '));
  const text = lines.join('\n');
  if (navigator.share) {
    try { await navigator.share({ text }); } catch (e) { /* cancelled */ }
  } else {
    try { await navigator.clipboard.writeText(text); toast('Copied'); } catch (e) { toast('Could not share'); }
  }
}

/* ---------- all recipes ---------- */
let allFilter = { q: '', chip: '' };
function renderAll() {
  setHeader('All recipes', 'all');
  const brands = [...new Set(RECIPES.map(r => r.source.brand).filter(Boolean))].sort();
  const tagCount = {};
  RECIPES.forEach(r => (r.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  const tags = Object.keys(tagCount).sort((a, b) => tagCount[b] - tagCount[a] || a.localeCompare(b));
  $view.innerHTML = `
    <div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input type="search" id="q" placeholder="Search recipes or ingredients" value="${esc(allFilter.q)}" autocomplete="off"></div>
    <div class="chips">${['', ...brands.map(b => 'b:' + b), ...tags.map(t => 't:' + t)].map(c =>
      `<button class="chip${allFilter.chip === c ? ' on' : ''}" data-chip="${esc(c)}">${esc(c ? c.slice(2) : 'All')}</button>`).join('')}</div>
    <div class="count" id="count"></div>
    <div class="grid" id="allGrid"></div>`;
  const draw = () => {
    const q = allFilter.q.trim().toLowerCase();
    const list = RECIPES.filter(r => {
      if (allFilter.chip.startsWith('b:') && r.source.brand !== allFilter.chip.slice(2)) return false;
      if (allFilter.chip.startsWith('t:') && !(r.tags || []).includes(allFilter.chip.slice(2))) return false;
      if (!q) return true;
      const hay = [r.title, r.subtitle || '', ...(r.tags || []), ...r.ingredients.map(i => i.name)].join(' ').toLowerCase();
      return q.split(/\s+/).every(w => hay.includes(w));
    });
    $view.querySelector('#count').textContent = list.length + ' recipe' + (list.length === 1 ? '' : 's');
    $view.querySelector('#allGrid').innerHTML = list.map(r => tile(r).replace('data-open=', 'data-go=')).join('');
    $view.querySelectorAll('[data-go]').forEach(t => t.onclick = () => { location.hash = '#/r/' + t.dataset.go; });
  };
  $view.querySelector('#q').oninput = e => { allFilter.q = e.target.value; draw(); };
  $view.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => {
    allFilter.chip = allFilter.chip === b.dataset.chip ? '' : b.dataset.chip;
    $view.querySelectorAll('[data-chip]').forEach(x => x.classList.toggle('on', x.dataset.chip === allFilter.chip));
    draw();
  });
  draw();
}

/* ---------- recipe view ---------- */
let timers = {}; // key -> {end, int, el}
function renderRecipe(id) {
  const r = BY_ID[id];
  if (!r) { location.hash = '#/all'; return; }
  setHeader(r.title, null, true);
  const inWeek = week.get(id);
  let s = store.get('rs.' + id, inWeek ? inWeek.servings : defaultServings(r));
  const doneKey = 'done.' + id;

  const draw = () => {
    const done = store.get(doneKey, []);
    const main = r.ingredients.filter(i => !i.staple || i.qty);
    const seen = new Set();
    const staples = r.ingredients.filter(i => i.staple && !i.qty && !seen.has(i.display) && seen.add(i.display));
    $view.innerHTML = `
      <div class="hero"><img src="${esc(r.image)}" alt=""></div>
      <div class="r-head"><h2>${esc(r.title)}</h2>${r.subtitle ? `<div class="subt">${esc(r.subtitle)}</div>` : ''}
        <div class="meta">${r.time_minutes ? `<span>${r.time_minutes} min</span>` : ''}<span>${esc(r.source.brand || '')}</span></div></div>
      <div class="serve-bar"><span class="lbl">Servings</span>${stepper(s)}</div>
      <div class="card"><ul class="ings">
        ${main.map(i => {
          const q = qtyFor(i, s);
          const qs = q ? fmtMeasure(q.amount, q.unit) + (q.metric ? ' (' + fmtMeasure(q.metric.amount, q.metric.unit) + ')' : '') : '';
          const nm = q && q.unit === '' ? plural(i.display, q.amount) : i.display;
          return `<li><span class="q">${esc(qs)}</span><span class="n">${esc(nm)}${i.optional ? ' <span class="tag">optional</span>' : ''}${i.estimated ? ' <span class="tag">approx.</span>' : ''}</span></li>`;
        }).join('')}
        ${staples.length ? `<li><span class="q"></span><span class="n staples">Plus ${esc(staples.map(i => i.display).join(', '))}</span></li>` : ''}
      </ul></div>
      <div class="r-actions">
        <button class="btn${inWeek ? ' secondary' : ''}" id="rWeek">${inWeek ? '✓ In this week' : 'Add to this week'}</button>
      </div>
      <div class="section-h">Method</div>
      <ol class="steps">${r.steps.map((st, k) => `
        <li class="step${done.includes(k) ? ' done' : ''}" data-k="${k}">
          <span class="num">${st.n}</span>
          <div class="body">${st.title ? `<div class="st">${esc(st.title)}</div>` : ''}
            <div class="tx">${renderStep(st.text, r, s)}</div>
            ${st.timer_seconds ? `<button class="timer" data-timer="${id}:${k}" data-sec="${st.timer_seconds}">${icon.timer}<span>${fmtTime(st.timer_seconds)}</span></button>` : ''}
          </div></li>`).join('')}</ol>
      ${done.length ? '<div class="stack"><button class="btn ghost" id="resetSteps">Reset steps</button></div>' : ''}
      ${r.notes && r.notes.length ? `<details class="notes"><summary>Notes</summary><ul>${r.notes.map(n => `<li>${esc(n.text.replace(/^CHECK:\s*/, ''))}</li>`).join('')}</ul></details>` : ''}`;

    bindStepper($view, v => { s = v; store.set('rs.' + id, s); const y = scrollY; draw(); scrollTo(0, y); }, () => s);
    $view.querySelector('#rWeek').onclick = () => {
      if (week.has(id)) { location.hash = '#/week'; return; }
      week.set(id, s); toast('Added to this week'); draw();
    };
    $view.querySelectorAll('.step').forEach(el => el.onclick = e => {
      if (e.target.closest('.timer')) return;
      const k = +el.dataset.k;
      let d = store.get(doneKey, []);
      d = d.includes(k) ? d.filter(x => x !== k) : d.concat(k);
      store.set(doneKey, d);
      el.classList.toggle('done', d.includes(k));
      if (d.length && !$view.querySelector('#resetSteps')) draw();
    });
    const rs = $view.querySelector('#resetSteps');
    if (rs) rs.onclick = () => { store.set(doneKey, []); draw(); };
    $view.querySelectorAll('[data-timer]').forEach(b => {
      const key = b.dataset.timer;
      if (timers[key]) { timers[key].el = b; tickTimer(key); }
      b.onclick = e => { e.stopPropagation(); toggleTimer(key, +b.dataset.sec, b); };
    });
  };
  draw();
  wake.on();
}

function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}
function toggleTimer(key, sec, el) {
  const t = timers[key];
  if (t) { clearInterval(t.int); delete timers[key]; el.className = 'timer'; el.querySelector('span').textContent = fmtTime(sec); return; }
  timers[key] = { end: Date.now() + sec * 1000, el, sec, int: setInterval(() => tickTimer(key), 250) };
  unlockAudio();
  tickTimer(key);
}
function tickTimer(key) {
  const t = timers[key];
  if (!t || !t.el) return;
  const left = (t.end - Date.now()) / 1000;
  const span = t.el.querySelector('span');
  if (left <= 0) {
    t.el.className = 'timer finished'; span.textContent = 'Done – tap to reset';
    if (!t.rang) { t.rang = true; ring(); }
  } else {
    t.el.className = 'timer running'; span.textContent = fmtTime(Math.ceil(left));
  }
}
let audioCtx;
function unlockAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) { /* ignore */ } }
function ring() {
  if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  for (let i = 0; i < 6; i++) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.0001, t0 + i * 0.5);
    g.gain.exponentialRampToValueAtTime(0.4, t0 + i * 0.5 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.5 + 0.35);
    o.start(t0 + i * 0.5); o.stop(t0 + i * 0.5 + 0.4);
  }
}

/* ---------- wake lock ---------- */
const wake = {
  lock: null, want: false,
  async on() {
    this.want = true;
    if (!('wakeLock' in navigator)) return;
    try {
      if (!this.lock) {
        this.lock = await navigator.wakeLock.request('screen');
        this.lock.addEventListener('release', () => { this.lock = null; this.show(); });
      }
    } catch (e) { this.lock = null; }
    this.show();
  },
  off() { this.want = false; if (this.lock) { this.lock.release(); this.lock = null; } this.show(); },
  show() { document.getElementById('awake').hidden = !(this.want && this.lock); },
};
document.addEventListener('click', () => { if (wake.want && !wake.lock) wake.on(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wake.want) wake.on();
});

/* ---------- routing ---------- */
function setHeader(text, tab, back) {
  $title.textContent = text;
  $back.hidden = !back;
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
}
$back.onclick = () => { if (history.length > 1) history.back(); else location.hash = '#/'; };

function route() {
  if (!RECIPES.length && document.body.classList.contains('locked-app')) return;
  const h = location.hash.replace(/^#/, '') || '/';
  if (!h.startsWith('/r/')) wake.off();
  const sheet = document.getElementById('sheet');
  sheet.hidden = true; document.getElementById('sheetBackdrop').hidden = true;
  if (h.startsWith('/r/')) renderRecipe(decodeURIComponent(h.slice(3)));
  else if (h === '/week') renderWeek();
  else if (h === '/list') renderList();
  else if (h === '/all') renderAll();
  else renderPick();
  if (!h.startsWith('/r/') || !route.last || route.last !== h) window.scrollTo(0, 0);
  route.last = h;
}
window.addEventListener('hashchange', route);

/* ---------- vault (encrypted data) ---------- */
// The published files are AES-GCM encrypted; see tools/build.py for the format.
const b64 = { enc: u => btoa(String.fromCharCode(...new Uint8Array(u))), dec: s => Uint8Array.from(atob(s), c => c.charCodeAt(0)) };
async function deriveKey(pass, meta) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64.dec(meta.salt), iterations: meta.iter }, base, 256);
}
async function aesKey(raw) { return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']); }
async function openBin(key, buf) {
  const u = new Uint8Array(buf);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, key, u.slice(12));
}
async function fetchBin(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('fetch ' + path);
  return res.arrayBuffer();
}
// Decrypts the recipes with the saved key; throws 'nokey' or 'badkey' if it needs the passphrase.
async function loadVault() {
  const meta = await (await fetch('vault/meta.json', { cache: 'no-cache' })).json();
  const saved = store.get('key', null);
  if (!saved || saved.salt !== meta.salt) throw new Error('nokey');
  const key = await aesKey(b64.dec(saved.k));
  let data;
  try { data = JSON.parse(new TextDecoder().decode(await openBin(key, await fetchBin('vault/recipes.bin')))); }
  catch (e) { if (e.name === 'OperationError') throw new Error('badkey'); throw e; }
  // Decrypt images into in-memory URLs.
  await Promise.all(data.recipes.map(async r => {
    try { r.image = URL.createObjectURL(new Blob([await openBin(key, await fetchBin(r.image))], { type: 'image/jpeg' })); }
    catch (e) { r.image = 'icons/icon-192.png'; }
  }));
  return data;
}
function showUnlock(wrong) {
  document.body.classList.add('locked-app');
  setHeader('Recipes');
  $view.innerHTML = `<form class="unlock" id="unlock">
      <p>Enter the password to open the recipes.</p>
      <input type="password" id="pw" autocomplete="current-password" placeholder="Password" required>
      ${wrong ? '<p class="err">Wrong password.</p>' : ''}
      <button class="btn block" type="submit">Open</button>
    </form>`;
  const pw = $view.querySelector('#pw');
  pw.focus();
  $view.querySelector('#unlock').onsubmit = async e => {
    e.preventDefault();
    const btn = $view.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Opening…';
    try {
      const meta = await (await fetch('vault/meta.json', { cache: 'no-cache' })).json();
      const raw = await deriveKey(pw.value, meta);
      store.set('key', { salt: meta.salt, k: b64.enc(raw) });
      boot();
    } catch (err) { showUnlock(true); }
  };
}

/* ---------- boot ---------- */
async function boot() {
  let data;
  try {
    data = await loadVault();
  } catch (e) {
    if (e.message === 'nokey') return showUnlock(false);
    if (e.message === 'badkey') { store.set('key', null); return showUnlock(true); }
    $view.innerHTML = '<p class="empty">Could not load recipes.</p>';
    return;
  }
  document.body.classList.remove('locked-app');
  RECIPES = data.recipes;
  BY_ID = Object.fromEntries(RECIPES.map(r => [r.id, r]));
  updateBadge();
  route();
}
boot();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

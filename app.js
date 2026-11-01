(() => {
  const D = window.NEB_DATA || {videos: [], stats: {}};
  const RUBRICS = D.rubrics || [];
  const NAME = Object.fromEntries(RUBRICS.map(r => [r.key, r.title]));
  const LS = 'neb.prefs.v1';
  const prefs = Object.assign({liked: {}, skipped: {}}, JSON.parse(localStorage.getItem(LS) || '{}'));
  const savePrefs = () => localStorage.setItem(LS, JSON.stringify(prefs));
  const $ = s => document.querySelector(s);
  const esc = s => (s || '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const plural = n => { const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return 'раз';
    if (b === 1) return 'раз'; if (b >= 2 && b <= 4) return 'раза'; return 'раз'; };

  const V = D.videos.map(v => Object.assign({}, v, {
    hay: ((v.t || '') + ' ' + (v.c || '') + ' ' + (v.d || '') + ' ' + (v.rubs || []).map(k => NAME[k] || '').join(' ') + ' ' + (v.tp || []).join(' ')).toLowerCase()
  }));

  const inRubric = (v, key) => key === 'podcast'
    ? (v.rubs || []).includes('podcast')
    : (v.rub === key);
  const state = {q: '', rub: null, mode: 'paper', sel: -1};
  let flat = [];   // текущий плоский список (для j/k и экспорта)

  $('#today').textContent = D.generated || '';
  const nf = n => (n || 0).toLocaleString('ru-RU');
  $('#statline').textContent = `${nf(D.stats.videos || V.length)} материалов · просмотрено ${nf(D.stats.comments)} комментариев HN`;

  /* ---------- навигация по рубрикам ---------- */
  const nav = $('#sections');
  const all = document.createElement('button');
  all.innerHTML = `Все полосы <b>${V.length}</b>`;
  all.className = 'on';
  all.onclick = () => { state.rub = null; state.q = ''; $('#q').value = ''; state.mode = 'paper'; render(); };
  nav.appendChild(all);
  RUBRICS.forEach(r => {
    const b = document.createElement('button');
    b.dataset.key = r.key;
    b.innerHTML = `${esc(r.title)} <b>${V.filter(v => inRubric(v, r.key)).length}</b>`;
    b.onclick = () => { state.rub = r.key; state.q = ''; $('#q').value = ''; state.mode = 'paper'; render(); };
    nav.appendChild(b);
  });

  /* ---------- профиль для «Моей подборки» ---------- */
  const STOP = new Set('the and for with from that this you your are was were have has had not but all can will just into about more than then them they what when where which while who why how his her its our out one two new old video videos watch part full talk'.split(' '));
  const tokCache = new Map();
  function tokens(v) {
    if (tokCache.has(v.id)) return tokCache.get(v.id);
    const s = new Set();
    const push = x => (x || '').toLowerCase().split(/[^a-zа-я0-9+#]+/i).forEach(w => { if (w.length > 2 && !STOP.has(w)) s.add(w); });
    (v.rubs || []).forEach(k => push(NAME[k])); (v.tp || []).forEach(push); push(v.c); push(v.t);
    tokCache.set(v.id, s); return s;
  }
  let profile = null;
  function buildProfile() {
    const likes = Object.keys(prefs.liked);
    profile = null;
    if (!likes.length) return;
    const sets = likes.map(id => V.find(x => x.id === id)).filter(Boolean).map(tokens);
    if (!sets.length) return;
    const df = new Map();
    sets.forEach(s => s.forEach(w => df.set(w, (df.get(w) || 0) + 1)));
    profile = new Map();
    df.forEach((c, w) => profile.set(w, Math.log(1 + sets.length / c) * (c / sets.length)));
  }
  const score = v => {
    if (!profile) return 0;
    const s = tokens(v); let acc = 0;
    s.forEach(w => { const p = profile.get(w); if (p) acc += p; });
    return acc / Math.sqrt(s.size || 1);
  };

  /* ---------- заметка ---------- */
  function note(v) {
    const el = document.createElement('article');
    el.className = 'note';
    el.dataset.id = v.id;
    const shot = v.th
      ? `<img loading="lazy" src="data/thumbs/${esc(v.th)}" alt="">`
      : `<div class="ph">без кадра</div>`;
    const q = (v.quotes && v.quotes[0]) || null;
    const other = (v.rubs || []).slice(1).map(k => NAME[k]).filter(Boolean);
    el.innerHTML = `
      <div class="shot">${shot}
        <div class="acts">
          <button class="like${prefs.liked[v.id] ? ' on' : ''}" title="В избранное (l)">♥</button>
          <button class="skip${prefs.skipped[v.id] ? ' on' : ''}" title="Вычеркнуть (x)">✕</button>
        </div>
        ${v.y ? `<span class="yr">${v.y}</span>` : ''}
        <span class="stamp">${v.n}×</span>
      </div>
      <h3>${esc(v.t || 'Видео ' + v.id)}</h3>
      ${v.d ? `<div class="what">${esc(v.d)}</div>` : ''}
      <div class="deck">${esc(v.c || '')}</div>
      <div class="byline">советовали <b>${v.n}</b> ${plural(v.n)}${other.length ? ' · также: ' + esc(other.join(', ')) : ''}</div>
      ${q ? `<div class="quote">«${esc(q.text.slice(0, 200))}${q.text.length > 200 ? '…' : ''}» <i>— ${esc(q.by)}, ${q.y}</i></div>` : ''}`;
    el.onclick = e => {
      if (e.target.closest('.acts')) return;
      window.open('https://www.youtube.com/watch?v=' + v.id, '_blank', 'noopener');
    };
    el.querySelector('.like').onclick = e => { e.stopPropagation(); toggleLike(v.id); };
    el.querySelector('.skip').onclick = e => { e.stopPropagation(); prefs.skipped[v.id] ? delete prefs.skipped[v.id] : prefs.skipped[v.id] = 1; savePrefs(); render(); };
    return el;
  }

  function toggleLike(id) {
    prefs.liked[id] ? delete prefs.liked[id] : prefs.liked[id] = 1;
    savePrefs(); buildProfile();
    const b = document.querySelector(`.note[data-id="${id}"] .like`);
    if (b) b.classList.toggle('on', !!prefs.liked[id]);
    if (state.mode === 'mine') render();
  }

  /* ---------- сборка полос ---------- */
  function pool() {
    return V.filter(v => !prefs.skipped[v.id]);
  }

  function render() {
    document.querySelectorAll('#sections button').forEach(b => b.classList.toggle('on', b.dataset.key === state.rub || (!state.rub && !b.dataset.key)));
    $('#foryou').classList.toggle('on', state.mode === 'mine');
    const lead = $('#lead'), body = $('#body');
    lead.hidden = true; body.innerHTML = ''; lead.innerHTML = '';
    $('#empty').hidden = true;

    const q = state.q.trim().toLowerCase();

    /* режим поиска */
    if (q) {
      flat = pool().filter(v => v.hay.includes(q)).sort((a, b) => b.n - a.n);
      if (!flat.length) { document.querySelectorAll('.section-head').forEach(h => h.remove()); $('#empty').hidden = false; return; }
      section('ПОИСК: ' + state.q.toUpperCase(), `${flat.length} материалов`, flat);
      return;
    }

    /* моя подборка */
    if (state.mode === 'mine') {
      flat = pool().slice();
      flat = profile ? flat.map(v => ({v, s: score(v)})).sort((a, b) => b.s - a.s).map(x => x.v) : flat.sort((a, b) => b.n - a.n);
      section(profile ? 'МОЯ ПОДБОРКА' : 'МОЯ ПОДБОРКА (пока общая: отметьте пару материалов ♥)',
              `${flat.length} материалов`, flat);
      return;
    }

    /* одна рубрика */
    if (state.rub) {
      flat = pool().filter(v => inRubric(v, state.rub)).sort((a, b) => b.n - a.n);
      const r = RUBRICS.find(x => x.key === state.rub) || {title: '', deck: ''};
      if (!flat.length) { document.querySelectorAll('.section-head').forEach(h => h.remove()); $('#empty').hidden = false; return; }
      section(r.title, r.deck, flat);
      return;
    }

    /* вся газета: передовая + полосы */
    const vis = pool();
    flat = vis.slice().sort((a, b) => b.n - a.n);
    const top = flat[0];
    if (top) {
      lead.hidden = false;
      lead.innerHTML = `
        <div class="kicker">Передовая · ${esc(NAME[(top.rubs || [])[0]] || '')}</div>
        <div class="grid">
          <div>
            <h2>${esc(top.t)}</h2>
            <div class="stand">${esc(top.c || '')}${top.tp && top.tp[0] ? ' · обсуждали в треде «' + esc(top.tp[0]) + '»' : ''}.
              Это видео советовали на Hacker News <b>${top.n}</b> раз${top.y ? ', последний — в ' + top.y : ''}.</div>
          </div>
          <div class="shot-wrap">${top.th ? `<img src="data/thumbs/${esc(top.th)}" alt="">` : ''}</div>
        </div>`;
      lead.onclick = () => window.open('https://www.youtube.com/watch?v=' + top.id, '_blank', 'noopener');
      if (top.d) {
        const w = document.createElement('div');
        w.className = 'what';
        w.style.cssText = 'margin-top:10px;font-size:16px';
        w.textContent = top.d;
        lead.querySelector('.stand').after(w);
      }
      const idx = vis.indexOf(top);
      if (idx >= 0) vis.splice(idx, 1);
      lead.style.cursor = 'pointer';
    }
    RUBRICS.forEach(r => {
      const items = vis.filter(v => inRubric(v, r.key)).sort((a, b) => b.n - a.n);
      if (items.length) section(r.title, r.deck, items, true);
    });
  }

  function section(title, deck, items, heading = true) {
    const body = $('#body');
    if (heading) {
      const h = document.createElement('div');
      h.className = 'section-head';
      h.innerHTML = `<h2>${esc(title)}</h2><div class="deck">${esc(deck || '')}</div><div class="cnt">${items.length} шт.</div>`;
      body.appendChild(h);
    }
    const wrap = document.createElement('div');
    wrap.className = 'cols';
    items.forEach(v => wrap.appendChild(note(v)));
    body.appendChild(wrap);
  }

  /* ---------- управление ---------- */
  $('#q').oninput = e => { state.q = e.target.value; state.sel = -1; render(); };
  $('#foryou').onclick = () => { state.mode = state.mode === 'mine' ? 'paper' : 'mine'; state.rub = null; state.q = ''; $('#q').value = ''; render(); };
  $('#closehelp').onclick = () => $('#help').hidden = true;

  $('#export').onclick = () => {
    const payload = {
      paper: 'НЕОБЪЯСНИМОЕ', generated: D.generated, stats: D.stats,
      prefs: {liked: Object.keys(prefs.liked), skipped: Object.keys(prefs.skipped)},
      view: {q: state.q, rubric: state.rub, mode: state.mode},
      items: flat.map(v => ({id: v.id, title: v.t, channel: v.c, rubrics: (v.rubs || []).map(k => NAME[k]),
        hn_mentions: v.n, last_year: v.y, threads: v.tp, url: 'https://www.youtube.com/watch?v=' + v.id, quotes: v.quotes}))
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 1)], {type: 'application/json'}));
    a.download = 'neobyasnimoe.json';
    a.click();
  };

  document.addEventListener('keydown', e => {
    const typing = document.activeElement === $('#q');
    if (e.key === 'Escape') {
      state.q = ''; state.rub = null; state.mode = 'paper'; $('#q').value = ''; $('#q').blur();
      $('#help').hidden = true; render(); return;
    }
    if (typing) { if (e.key === 'Enter') $('#q').blur(); return; }
    if (e.key === '/') { e.preventDefault(); $('#q').focus(); $('#q').select(); return; }
    if (e.key === '?') { $('#help').hidden = !$('#help').hidden; return; }
    if (e.key === 'j' || e.key === 'k') {
      e.preventDefault();
      const notes = [...document.querySelectorAll('.note')];
      if (!notes.length) return;
      state.sel = Math.max(0, Math.min(notes.length - 1, state.sel + (e.key === 'j' ? 1 : -1)));
      notes.forEach(n => n.classList.remove('sel'));
      const el = notes[state.sel];
      el.classList.add('sel'); el.scrollIntoView({block: 'center', behavior: 'smooth'}); return;
    }
    const sel = document.querySelector('.note.sel');
    const id = sel && sel.dataset.id;
    if (!id) return;
    if (e.key === 'o' || e.key === 'Enter') window.open('https://www.youtube.com/watch?v=' + id, '_blank', 'noopener');
    if (e.key === 'l') toggleLike(id);
    if (e.key === 'x') { prefs.skipped[id] = 1; savePrefs(); render(); state.sel = Math.max(0, state.sel - 1); }
    if (e.key === 'f') $('#foryou').click();
  });

  buildProfile();
  render();
})();
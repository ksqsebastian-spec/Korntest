/* =================================================================
   KORN — finest windows & doors · interactions (shared)
   ================================================================= */
(function () {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- REVEALS ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  function startReveals() { $$('[data-reveal]').forEach(el => io.observe(el)); }

  /* ---------- INTRO (home only) ---------- */
  const intro = $('[data-intro]');
  function revealHero() {
    $$('.hero [data-reveal]').forEach(el => el.classList.add('is-in'));
    const q = $('.hero__quote'); if (q) q.classList.add('is-in');
  }
  if (intro) {
    document.body.classList.add('is-loading');
    const endIntro = () => {
      intro.classList.add('is-done');
      document.body.classList.remove('is-loading');
      startReveals(); revealHero();
      setTimeout(() => intro.remove(), 1100);
    };
    window.addEventListener('load', () => {
      if (reduce) return endIntro();
      requestAnimationFrame(() => intro.classList.add('is-animate'));
      setTimeout(endIntro, 2700);
    });
    setTimeout(() => { if (document.body.classList.contains('is-loading')) endIntro(); }, 5000);
  } else {
    startReveals();
    document.addEventListener('DOMContentLoaded', revealHero);
    revealHero();
  }

  /* ---------- CUSTOM CURSOR (simple dot) ---------- */
  const cursor = $('[data-cursor]');
  if (cursor && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    const dot = $('.cursor__dot', cursor);
    window.addEventListener('mousemove', (e) => { dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; }, { passive: true });
    const sel = 'a, button, [data-link], summary, .pcard, .map__bubble';
    document.addEventListener('mouseover', e => { if (e.target.closest(sel)) cursor.classList.add('is-hover'); });
    document.addEventListener('mouseout', e => { if (e.target.closest(sel)) cursor.classList.remove('is-hover'); });
  }

  /* ---------- NAV (theme + hide-on-scroll) ---------- */
  const hasHero = !!$('.hero');
  const topnav = $('[data-topnav]');
  if (!hasHero) document.body.classList.add('nav-dark');
  let lastY = 0;
  const onScroll = () => {
    const y = window.scrollY;
    if (hasHero) document.body.classList.toggle('nav-dark', y > window.innerHeight * .7);
    if (topnav) topnav.classList.toggle('is-hidden', y > 140 && y > lastY);
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- MOBILE MENU ---------- */
  const burger = $('[data-burger]');
  if (burger) {
    burger.addEventListener('click', () => document.body.classList.toggle('menu-open'));
    $$('.menu__nav a').forEach(a => a.addEventListener('click', () => document.body.classList.remove('menu-open')));
  }

  /* ---------- HERO SLIDER (home) ---------- */
  const slider = $('[data-slider]');
  if (slider) {
    const slides = $$('.hero__slide', slider), dotsWrap = $('[data-dots]');
    let i = 0, timer;
    slides.forEach((_, n) => {
      const b = document.createElement('button'); b.setAttribute('aria-label', 'Bild ' + (n + 1));
      if (n === 0) b.classList.add('is-active'); b.addEventListener('click', () => go(n, true)); dotsWrap.appendChild(b);
    });
    const dots = $$('button', dotsWrap);
    function go(n, manual) {
      slides[i].classList.remove('is-active'); dots[i].classList.remove('is-active');
      i = (n + slides.length) % slides.length;
      slides[i].classList.add('is-active'); dots[i].classList.add('is-active');
      if (manual) restart();
    }
    function restart() { clearInterval(timer); timer = setInterval(() => go(i + 1), 6500); }
    if (!reduce) restart();
  }

  /* ---------- PRODUCT HOVER IMAGE ---------- */
  $$('.product[data-img]').forEach(p => p.style.setProperty('--bg', `url('${p.dataset.img}')`));

  /* ---------- WORLD MAP (bubbles + count-up) ---------- */
  const map = $('[data-map]');
  if (map) {
    const pct = (s) => parseFloat(s) || 0;
    // build great-circle-style arcs from HQ to each bubble
    const arcsSvg = $('[data-arcs]', map), hq = $('[data-hq]', map);
    if (arcsSvg && hq) {
      const hx = pct(hq.style.left), hy = pct(hq.style.top);
      $$('.map__bubble', map).forEach(b => {
        const bx = pct(b.style.left), by = pct(b.style.top);
        if (Math.hypot(bx - hx, by - hy) < 8) return; // skip bubbles at HQ (Deutschland)
        const cx = (hx + bx) / 2, cy = Math.min(hy, by) - Math.abs(bx - hx) * 0.16 - 5;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M${hx} ${hy} Q${cx} ${cy} ${bx} ${by}`);
        arcsSvg.appendChild(path);
        b._arc = path;
        b.addEventListener('mouseenter', () => path.classList.add('is-hot'));
        b.addEventListener('mouseleave', () => path.classList.remove('is-hot'));
      });
    }
    // hover: country highlight + dim others + dossier
    const dossier = $('[data-dossier]', map);
    const hi = $$('.map__cty', map);
    const bubbles = $$('.map__bubble', map);
    // dynamic, compressed (log) bubble sizing — relative to stage width, responsive
    const mstage = $('[data-mapstage]', map) || map;
    const sizeBubbles = () => {
      const w = mstage.clientWidth || 1000;
      const cs = bubbles.map(b => +b.querySelector('.map__dot').dataset.count);
      const lo = Math.log(Math.min(...cs)), hi = Math.log(Math.max(...cs));
      bubbles.forEach(b => {
        const dot = b.querySelector('.map__dot');
        const t = (Math.log(+dot.dataset.count) - lo) / (hi - lo);   // 0..1 (compressed)
        const d = Math.round(w * (0.052 + (0.078 - 0.052) * t));
        dot.style.width = d + 'px'; dot.style.height = d + 'px';
        dot.style.fontSize = Math.max(10, Math.round(d * 0.27)) + 'px';
      });
    };
    sizeBubbles();
    window.addEventListener('resize', sizeBubbles, { passive: true });
    bubbles.forEach(b => {
      b.addEventListener('mouseenter', () => {
        const c = b.dataset.c;
        hi.forEach(h => h.classList.toggle('on', h.dataset.c === c));
        bubbles.forEach(x => { if (x !== b) x.classList.add('dim'); });
        if (b._arc) b._arc.classList.add('is-hot');
        if (dossier) {
          const num = b.querySelector('.map__dot').dataset.count;
          const label = (b.getAttribute('aria-label') || '').split(' — ')[0];
          const arch = (b.dataset.arch || '').split(';').filter(Boolean);
          const list = arch.length
            ? '<ul>' + arch.map(a => `<li>${a}</li>`).join('') + '</ul>'
            : '<ul><li>Projekte weltweit — auf Anfrage</li></ul>';
          dossier.innerHTML = `<p class="map__dossier__k">${label}</p><p class="map__dossier__n">${num} <small>Projekte</small></p>${list}<p class="map__dossier__go">Projekte ansehen →</p>`;
          const lx = parseFloat(b.style.left), ty = parseFloat(b.style.top);
          dossier.style.left = lx + '%'; dossier.style.top = ty + '%';
          dossier.style.transform = lx > 55 ? 'translate(calc(-100% - 30px),-50%)' : 'translate(30px,-50%)';
          dossier.classList.add('show');
        }
      });
      b.addEventListener('mouseleave', () => {
        hi.forEach(h => h.classList.remove('on'));
        bubbles.forEach(x => x.classList.remove('dim'));
        if (b._arc) b._arc.classList.remove('is-hot');
        if (dossier) dossier.classList.remove('show');
      });
    });

    const mio = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        map.classList.add('is-in');
        // count-up numbers
        $$('.map__dot', map).forEach(d => {
          const target = +d.dataset.count; if (!target) return;
          if (reduce) { d.textContent = target; return; }
          const dur = 1500, t0 = performance.now();
          (function tick(now) {
            const p = Math.min((now - t0) / dur, 1);
            d.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(tick);
          })(t0);
        });
        // draw arcs in (staggered)
        if (arcsSvg && !reduce) {
          $$('path', arcsSvg).forEach((p, i) => {
            const len = p.getTotalLength();
            p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
            p.style.transition = 'none';
            requestAnimationFrame(() => {
              p.style.transition = `stroke-dashoffset 1.4s ${0.3 + i * 0.12}s cubic-bezier(.22,1,.36,1)`;
              p.style.strokeDashoffset = '0';
            });
          });
        }
        mio.disconnect();
      });
    }, { threshold: 0.2 });
    mio.observe(map);
  }

  /* ---------- PARALLAX BREAK ---------- */
  const para = $('[data-parallax]');
  if (para && !reduce) {
    const sect = para.closest('.break'); let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        const r = sect.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight) {
          const prog = (r.top + r.height) / (innerHeight + r.height);
          para.style.transform = `translateY(${(prog - .5) * 16}%)`;
        }
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------- PAGE TRANSITIONS (leave) ---------- */
  if (!reduce) {
    const pt = document.createElement('div'); pt.className = 'pt'; document.body.appendChild(pt);
    // if we return via back/forward cache, hide the overlay
    window.addEventListener('pageshow', () => pt.classList.remove('show'));
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!/\.html(\?|#|$)/.test(href)) return; // only internal pages
      e.preventDefault();
      pt.classList.add('show');
      setTimeout(() => { window.location.href = href; }, 430);
    });
  }

  /* ---------- SMOOTH ANCHORS ---------- */
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href'); if (id.length < 2) return;
    const t = $(id); if (!t) return; e.preventDefault();
    t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }));

  /* ---------- CONTACT FUNNEL ---------- */
  const funnel = $('[data-funnel]');
  if (funnel) {
    const mailto = funnel.dataset.mailto || 'info@korn-windows.com';
    const steps = [
      { k: 'name', type: 'text', ph: 'Dein Name', eye: 'Kontakt — in 30 Sekunden', q: () => 'Wie heißt du?' },
      { k: 'intent', type: 'choice', q: (a) => `Freut mich, ${a.name}. Worum geht es?`, opts: ['Neubau', 'Modernisierung', 'Produktberatung', 'Etwas anderes'] },
      { k: 'product', type: 'choice', q: () => 'Welche KORN Linie reizt dich?', opts: ['KORN LIGNUM', 'KORN LIGNUM SECURE', 'KORN air-lux', 'KORN burckhardt’s glide', 'KORN metal', 'KORN retrac system', 'Noch unentschieden'] },
      { k: 'place', type: 'text', ph: 'Ort / Land', q: (a) => `Wo entsteht ${a.name ? 'dein' : 'das'} Projekt?` },
      { k: 'email', type: 'email', ph: 'E-Mail oder Telefon', q: (a) => `Wie erreichen wir dich, ${a.name}?` }
    ];
    const LABEL = { name: 'Name', intent: 'Anliegen', product: 'Produktlinie', place: 'Ort', email: 'Kontakt' };
    const ans = {};
    let i = 0;

    const bar = document.createElement('div'); bar.className = 'funnel__bar';
    const top = document.createElement('div'); top.className = 'funnel__top';
    const back = document.createElement('button'); back.className = 'funnel__back'; back.type = 'button'; back.textContent = '‹ zurück';
    const counter = document.createElement('span');
    top.append(back, counter);
    const stage = document.createElement('div'); stage.className = 'funnel__stage';
    funnel.append(bar, top, stage);
    back.addEventListener('click', () => { if (i > 0) { i--; render(); } });

    function setBar() { bar.style.width = (i / steps.length * 100) + '%'; }

    function commit(val) { ans[steps[i].k] = val; i++; render(); }

    function render() {
      setBar();
      back.classList.toggle('show', i > 0);
      counter.textContent = i < steps.length ? `${i + 1} / ${steps.length}` : 'Fertig';
      stage.innerHTML = '';
      if (i >= steps.length) return renderDone();
      const s = steps[i];
      const step = document.createElement('div'); step.className = 'f-step';
      if (s.eye) { const e = document.createElement('p'); e.className = 'f-eyebrow'; e.textContent = s.eye; step.appendChild(e); }
      const q = document.createElement('h2'); q.className = 'f-q'; q.textContent = s.q(ans); step.appendChild(q);

      if (s.type === 'choice') {
        const wrap = document.createElement('div'); wrap.className = 'f-choices';
        s.opts.forEach(o => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'f-choice'; b.dataset.link = '';
          b.append(document.createTextNode(o));
          b.addEventListener('click', () => commit(o));
          wrap.appendChild(b);
        });
        step.appendChild(wrap);
      } else {
        const inp = document.createElement('input');
        inp.className = 'f-input'; inp.type = s.type === 'email' ? 'text' : 'text';
        inp.placeholder = s.ph; inp.value = ans[s.k] || '';
        const hint = document.createElement('p'); hint.className = 'f-hint'; hint.innerHTML = 'Drücke <b>Enter ↵</b>';
        const advance = () => {
          const v = inp.value.trim();
          if (!v) { hint.classList.add('err'); hint.textContent = 'Bitte gib hier etwas ein.'; inp.focus(); return; }
          commit(v);
        };
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); advance(); } });
        const act = document.createElement('div'); act.className = 'f-actions';
        const nx = document.createElement('button'); nx.type = 'button'; nx.className = 'f-next'; nx.dataset.link = ''; nx.textContent = 'Weiter →';
        nx.addEventListener('click', advance);
        act.appendChild(nx);
        step.append(inp, hint, act);
        requestAnimationFrame(() => inp.focus({ preventScroll: true }));
      }
      stage.appendChild(step);
    }

    function renderDone() {
      bar.style.width = '100%';
      const step = document.createElement('div'); step.className = 'f-step';
      const e = document.createElement('p'); e.className = 'f-eyebrow'; e.textContent = 'Fast geschafft';
      const q = document.createElement('h2'); q.className = 'f-q'; q.textContent = `Danke, ${ans.name}.`;
      const ul = document.createElement('ul'); ul.className = 'f-summary';
      steps.forEach(s => {
        if (!ans[s.k]) return;
        const li = document.createElement('li');
        li.innerHTML = `<span>${LABEL[s.k]}</span><b>${ans[s.k]}</b>`;
        ul.appendChild(li);
      });
      const subject = `Projektanfrage – ${ans.name || ''}`;
      const body = steps.map(s => `${LABEL[s.k]}: ${ans[s.k] || '—'}`).join('\n');
      const link = `mailto:${mailto}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      const act = document.createElement('div'); act.className = 'f-actions';
      const send = document.createElement('a'); send.className = 'f-next'; send.dataset.link = ''; send.href = link; send.textContent = 'Anfrage senden →';
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'funnel__back show'; edit.style.position = 'static'; edit.style.marginLeft = '1.5rem'; edit.textContent = '‹ ändern';
      edit.addEventListener('click', () => { i = 0; render(); });
      act.append(send, edit);
      step.append(e, q, ul, act);
      stage.appendChild(step);
    }

    render();
  }

  /* ---------- PROJEKTE FILTER (?ort=) ---------- */
  const pgrid = $('.pgrid');
  if (pgrid) {
    const ort = new URLSearchParams(location.search).get('ort');
    const bar = $('[data-filterbar]');
    if (ort) {
      const q = ort.toLowerCase();
      let n = 0;
      $$('.pcard', pgrid).forEach(c => {
        const hit = c.textContent.toLowerCase().includes(q);
        c.style.display = hit ? '' : 'none';
        if (hit) n++;
      });
      if (bar) {
        bar.innerHTML = n
          ? `Projekte in <b>${ort}</b> · ${n} <a href="projekte.html" data-link>Alle Projekte ›</a>`
          : `Für <b>${ort}</b> zeigen wir Projekte gern auf Anfrage. <a href="projekte.html" data-link>Alle Projekte ›</a>`;
        bar.classList.add('show');
      }
    }
  }

  /* ---------- YEAR ---------- */
  const y = $('[data-year]'); if (y) y.textContent = new Date().getFullYear();
})();

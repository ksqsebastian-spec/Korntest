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

  /* ---------- CUSTOM CURSOR ---------- */
  const cursor = $('[data-cursor]');
  if (cursor && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    const dot = $('.cursor__dot', cursor), ring = $('.cursor__ring', cursor);
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    window.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; dot.style.left = mx + 'px'; dot.style.top = my + 'px'; }, { passive: true });
    (function loop() { rx += (mx - rx) * .18; ry += (my - ry) * .18; ring.style.left = rx + 'px'; ring.style.top = ry + 'px'; requestAnimationFrame(loop); })();
    const sel = 'a, button, [data-link], .product, .projects__list li, .jobs li, summary, .gallery figure';
    document.addEventListener('mouseover', e => { if (e.target.closest(sel)) cursor.classList.add('is-hover'); });
    document.addEventListener('mouseout', e => { if (e.target.closest(sel)) cursor.classList.remove('is-hover'); });
    window.addEventListener('mousedown', () => cursor.classList.add('is-down'));
    window.addEventListener('mouseup', () => cursor.classList.remove('is-down'));
  }

  /* ---------- HEADER ---------- */
  const header = $('[data-header]');
  if (header) {
    if (!$('.hero')) header.classList.add('is-solid');
    else {
      const onScroll = () => header.classList.toggle('is-solid', window.scrollY > window.innerHeight * .7);
      window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    }
  }

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
    const mio = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        map.classList.add('is-in');
        $$('.map__dot', map).forEach(d => {
          const target = +d.dataset.count; if (!target) return;
          if (reduce) { d.textContent = target; return; }
          const dur = 1400, t0 = performance.now();
          (function tick(now) {
            const p = Math.min((now - t0) / dur, 1);
            d.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(tick);
          })(t0);
        });
        mio.disconnect();
      });
    }, { threshold: 0.25 });
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

  /* ---------- SMOOTH ANCHORS ---------- */
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href'); if (id.length < 2) return;
    const t = $(id); if (!t) return; e.preventDefault();
    t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }));

  /* ---------- YEAR ---------- */
  const y = $('[data-year]'); if (y) y.textContent = new Date().getFullYear();
})();

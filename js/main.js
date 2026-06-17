/* =================================================================
   KORN — finest windows & doors · interactions
   ================================================================= */
(function () {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- INTRO / LOGO FADE ---------- */
  const intro = $('[data-intro]');
  document.body.classList.add('is-loading');

  function endIntro() {
    intro.classList.add('is-done');
    document.body.classList.remove('is-loading');
    startReveals();
    setTimeout(() => intro && intro.remove(), 1100);
  }

  window.addEventListener('load', () => {
    if (reduce) { endIntro(); return; }
    requestAnimationFrame(() => intro.classList.add('is-animate'));
    // logo fades in then out (2.6s keyframe), then curtain lifts
    setTimeout(endIntro, 2700);
  });
  // safety net if load never fires
  setTimeout(() => { if (document.body.classList.contains('is-loading')) endIntro(); }, 5000);

  /* ---------- CUSTOM CURSOR ---------- */
  const cursor = $('[data-cursor]');
  if (cursor && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    const dot = $('.cursor__dot', cursor);
    const ring = $('.cursor__ring', cursor);
    let mx = innerWidth / 2, my = innerHeight / 2;
    let rx = mx, ry = my;

    window.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.left = mx + 'px';
      dot.style.top = my + 'px';
    }, { passive: true });

    // ring trails with easing
    (function loop() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.left = rx + 'px';
      ring.style.top = ry + 'px';
      requestAnimationFrame(loop);
    })();

    const hoverSel = 'a, button, [data-link], .product, .projects__list li';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(hoverSel)) cursor.classList.add('is-hover');
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(hoverSel)) cursor.classList.remove('is-hover');
    });
    window.addEventListener('mousedown', () => cursor.classList.add('is-down'));
    window.addEventListener('mouseup', () => cursor.classList.remove('is-down'));
    document.addEventListener('mouseleave', () => cursor.style.opacity = '0');
    document.addEventListener('mouseenter', () => cursor.style.opacity = '1');
  }

  /* ---------- HEADER SOLIDIFY ---------- */
  const header = $('[data-header]');
  const onScrollHeader = () => header.classList.toggle('is-solid', window.scrollY > window.innerHeight * 0.7);
  window.addEventListener('scroll', onScrollHeader, { passive: true });
  onScrollHeader();

  /* ---------- MOBILE MENU ---------- */
  const burger = $('[data-burger]');
  if (burger) {
    burger.addEventListener('click', () => document.body.classList.toggle('menu-open'));
    $$('.menu__nav a').forEach(a => a.addEventListener('click', () => document.body.classList.remove('menu-open')));
  }

  /* ---------- HERO SLIDER ---------- */
  const slider = $('[data-slider]');
  if (slider) {
    const slides = $$('.hero__slide', slider);
    const dotsWrap = $('[data-dots]');
    let i = 0, timer;
    slides.forEach((_, n) => {
      const b = document.createElement('button');
      b.setAttribute('aria-label', 'Bild ' + (n + 1));
      if (n === 0) b.classList.add('is-active');
      b.addEventListener('click', () => go(n, true));
      dotsWrap.appendChild(b);
    });
    const dots = $$('button', dotsWrap);

    function go(n, manual) {
      slides[i].classList.remove('is-active');
      dots[i].classList.remove('is-active');
      i = (n + slides.length) % slides.length;
      slides[i].classList.add('is-active');
      dots[i].classList.add('is-active');
      if (manual) restart();
    }
    function restart() { clearInterval(timer); timer = setInterval(() => go(i + 1), 6500); }
    if (!reduce) restart();
  }

  /* ---------- PRODUCT HOVER IMAGE ---------- */
  $$('.product[data-img]').forEach(p => p.style.setProperty('--bg', `url('${p.dataset.img}')`));

  /* ---------- SCROLL REVEALS ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  function startReveals() {
    $$('[data-reveal]').forEach(el => io.observe(el));
    // hero content reveals immediately after intro
    $$('.hero [data-reveal]').forEach(el => el.classList.add('is-in'));
    $('.hero__quote') && $('.hero__quote').classList.add('is-in');
  }

  /* ---------- PARALLAX BREAK ---------- */
  const para = $('[data-parallax]');
  if (para && !reduce) {
    const sect = para.closest('.break');
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const r = sect.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight) {
          const prog = (r.top + r.height) / (innerHeight + r.height); // 1 -> 0
          para.style.transform = `translateY(${(prog - 0.5) * 16}%)`;
        }
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------- SMOOTH ANCHOR (account for fixed header) ---------- */
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const t = $(id);
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* ---------- YEAR ---------- */
  const y = $('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
})();

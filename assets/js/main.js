/* NazarAI — sahifa interaktivligi */
(function () {
  'use strict';

  // Soʻrovlar yuboriladigan manzil — haqiqiy pochta bilan almashtiring
  const CONTACT_EMAIL = 'info@nazarai.uz';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Zarrachali koʻzlar ---------- */
  const hero = $('#heroEye');
  if (hero) {
    new ParticleEye(hero, {
      count: innerWidth < 760 ? 900 : 1700,
      ambient: 0.18,
      triSize: [1.2, 3.4],
      trackEl: hero,
      layout: (w, h) => {
        if (w < 760) return { cx: w * 0.5, cy: Math.max(150, h * 0.2), W: Math.min(w * 0.4, 170) };
        if (w < 1100) return { cx: w * 0.6, cy: h * 0.27, W: Math.min(w * 0.3, h * 0.3) };
        return { cx: w * 0.645, cy: h * 0.42, W: Math.min(w * 0.26, h * 0.6) };
      },
    }).start();
  }

  const logo = $('#logoEye');
  if (logo) {
    const eye = new ParticleEye(logo, {
      count: 230,
      ambient: 0,
      triSize: [0.7, 1.3],
      lineWidth: 0.9,
      repel: false,
      assemble: false,
      layout: (w, h) => ({ cx: w / 2, cy: h / 2, W: w * 0.47 }),
    });
    eye.start();
    logo.parentElement.addEventListener('pointerenter', () => eye.triggerBlink());
  }

  const foot = $('#footerEye');
  if (foot) {
    new ParticleEye(foot, {
      count: 520,
      ambient: 0.08,
      triSize: [0.9, 1.9],
      repel: false,
      layout: (w, h) => ({ cx: w / 2, cy: h / 2, W: w * 0.44 }),
    }).start();
  }

  const field = $('#contactField');
  if (field) {
    new ParticleEye(field, {
      count: innerWidth < 760 ? 140 : 320,
      ambient: 1,
      triSize: [1.4, 3.6],
      assemble: false,
    }).start();
  }

  // Monogrammalar — shriftlar yuklangandan keyin
  const initMonos = () => $$('.mono').forEach((c) => new ParticleMonogram(c, c.dataset.initials, { step: c.closest('.lead-card') ? 5 : 4 }));
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => {
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((ents) => {
        ents.forEach((e) => {
          if (!e.isIntersecting) return;
          const c = e.target;
          io.unobserve(c);
          new ParticleMonogram(c, c.dataset.initials, { step: c.closest('.lead-card') ? 5 : 4 });
        });
      }, { rootMargin: '100px' });
      $$('.mono').forEach((c) => io.observe(c));
    } else initMonos();
  });

  /* ---------- Navigatsiya ---------- */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const burger = $('#burger');
  const menu = $('#mobileMenu');
  const setMenu = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Menyuni yopish' : 'Menyuni ochish');
    menu.hidden = !open;
    nav.classList.toggle('is-scrolled', open || scrollY > 24);
  };
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));

  // Faol boʻlim
  const links = $$('.nav__links a');
  const sections = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const so = new IntersectionObserver((ents) => {
      ents.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => so.observe(s));
  }

  /* ---------- Paydo boʻlish animatsiyalari ---------- */
  // Hero darhol koʻrinadi
  $$('.hero .reveal').forEach((el, i) => setTimeout(() => el.classList.add('is-in'), 120 + i * 140));

  const revealEls = $$('.reveal, .product, .step').filter((el) => !el.closest('.hero'));
  if ('IntersectionObserver' in window && !reduceMotion) {
    const ro = new IntersectionObserver((ents) => {
      ents.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const sib = el.parentElement ? $$(':scope > .reveal', el.parentElement) : [];
        const idx = Math.max(0, sib.indexOf(el));
        el.style.transitionDelay = Math.min(idx, 5) * 70 + 'ms';
        el.classList.add('is-in');
        ro.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach((el) => ro.observe(el));
  } else revealEls.forEach((el) => el.classList.add('is-in'));

  /* ---------- Hisoblagichlar ---------- */
  const counters = $$('.count');
  const runCount = (el) => {
    const to = parseFloat(el.dataset.to);
    const dec = +(el.dataset.dec || 0);
    const fmt = (v) => v.toFixed(dec).replace('.', ',');
    if (reduceMotion) return (el.textContent = fmt(to));
    const t0 = performance.now();
    const dur = 1600;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = fmt(to * (1 - Math.pow(1 - k, 4)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if ('IntersectionObserver' in window) {
    const co = new IntersectionObserver((ents) => {
      ents.forEach((e) => {
        if (e.isIntersecting) {
          runCount(e.target);
          co.unobserve(e.target);
        }
      });
    }, { threshold: 0.6 });
    counters.forEach((c) => co.observe(c));
  } else counters.forEach(runCount);

  /* ---------- Mahsulot filtrlari ---------- */
  const chips = $$('.chip');
  const products = $$('.product');
  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      const f = chip.dataset.filter;
      chips.forEach((c) => {
        const on = c === chip;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-selected', String(on));
      });
      products.forEach((p) => {
        const show = f === 'all' || p.dataset.cat === f;
        p.classList.toggle('is-hidden', !show);
        if (show) p.classList.add('is-in');
      });
    })
  );

  // Kursor yorugʻligi
  products.forEach((p) =>
    p.addEventListener('pointermove', (e) => {
      const r = p.getBoundingClientRect();
      p.style.setProperty('--mx', e.clientX - r.left + 'px');
      p.style.setProperty('--my', e.clientY - r.top + 'px');
    })
  );

  // UMID identifikatori aylanishi
  const code = $('#umidCode');
  if (code && !reduceMotion) {
    const hex = '0123456789ABCDEF';
    const blk = () => Array.from({ length: 4 }, () => hex[(Math.random() * 16) | 0]).join('');
    let busy = false;
    code.closest('.product').addEventListener('pointerenter', () => {
      if (busy) return;
      busy = true;
      const final = `${blk()}‑${blk()}‑${blk()}`;
      let n = 0;
      const iv = setInterval(() => {
        n++;
        code.textContent = n < 12 ? `${blk()}‑${blk()}‑${blk()}` : final;
        if (n >= 12) {
          clearInterval(iv);
          busy = false;
        }
      }, 45);
    });
  }

  /* ---------- Magnit tugmalar ---------- */
  if (matchMedia('(hover: hover)').matches && !reduceMotion) {
    $$('.magnetic').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.25;
        const y = (e.clientY - r.top - r.height / 2) * 0.35;
        b.style.transform = `translate(${x}px, ${y}px)`;
      });
      b.addEventListener('pointerleave', () => (b.style.transform = ''));
    });
  }

  /* ---------- Aloqa formasi ---------- */
  const form = $('#contactForm');
  const note = $('#formNote');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    $$('input, textarea', form).forEach((inp) => {
      const bad = !inp.value.trim();
      inp.closest('.field').classList.toggle('is-error', bad);
      if (bad) ok = false;
    });
    if (!ok) {
      note.style.color = '#ff5a6e';
      note.textContent = 'Iltimos, barcha maydonlarni toʻldiring.';
      return;
    }
    const d = new FormData(form);
    const subject = encodeURIComponent('NazarAI — hamkorlik soʻrovi: ' + d.get('name'));
    const body = encodeURIComponent(`Ism: ${d.get('name')}\nAloqa: ${d.get('contact')}\n\n${d.get('msg')}`);
    location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    note.style.color = '';
    note.textContent = 'Rahmat! Pochta ilovangiz ochildi — xatni yuboring.';
    form.reset();
  });

  $('#year').textContent = new Date().getFullYear();
})();

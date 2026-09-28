/* NazarAI — Particle Eye engine
   Uchburchak zarrachalardan tashkil topgan, kursorni kuzatuvchi, miltillovchi ko‘z. */
(function (global) {
  'use strict';

  const PALETTE = {
    violet: '#8052ff',
    iris2: '#a47bff',
    amber: '#ffb829',
    teal: '#1fb592',
    verdant: '#15846e',
    magenta: '#e04dff',
    blue: '#4d7cff',
    white: '#ffffff',
  };
  const COLOR_KEYS = Object.keys(PALETTE);
  const ALPHA_LEVELS = [0.18, 0.4, 0.65, 0.95];
  const TAU = Math.PI * 2;

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const reduceMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Qovoq egri chiziqlari (normallashtirilgan birliklarda, u ∈ [-1, 1])
  const upperLid = (u) => 0.5 * Math.pow(Math.max(0, 1 - u * u), 0.82);
  const lowerLid = (u) => 0.4 * Math.pow(Math.max(0, 1 - u * u), 0.95);

  class ParticleEye {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.o = Object.assign(
        {
          count: 1400,
          ambient: 0.16,
          triSize: [1.2, 3.2],
          lineWidth: 1,
          fill: false,
          repel: true,
          assemble: true,
          layout: (w, h) => ({ cx: w / 2, cy: h / 2, W: Math.min(w * 0.42, h * 0.8) }),
          trackEl: null,
        },
        opts
      );
      this.t = 0;
      this.look = { x: 0, y: 0, tx: 0, ty: 0 };
      this.blink = 1;
      this.nextBlink = rand(2.5, 5);
      this.blinkStart = -1;
      this.dilate = 1;
      this.mouse = { x: -9999, y: -9999, active: false, last: 0 };
      this.nextSaccade = 0;
      this.running = false;
      this.visible = true;

      this.resize();
      this.build();
      this.bind();
    }

    resize() {
      const r = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(global.devicePixelRatio || 1, 2);
      this.w = Math.max(1, r.width);
      this.h = Math.max(1, r.height);
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      Object.assign(this, this.o.layout(this.w, this.h));
    }

    build() {
      const n = this.o.count;
      const P = [];
      const add = (p) => {
        p.x = this.o.assemble && !reduceMotion ? rand(0, this.w) : 0;
        p.y = this.o.assemble && !reduceMotion ? rand(0, this.h) : 0;
        p.vx = p.vy = 0;
        p.a = rand(0, TAU);
        p.va = rand(-0.02, 0.02);
        p.s = rand(this.o.triSize[0], this.o.triSize[1]);
        p.ph = rand(0, TAU);
        p.alpha = 0;
        p.init = !(this.o.assemble && !reduceMotion);
        P.push(p);
      };
      const nAmb = Math.round(n * this.o.ambient);
      const nEye = n - nAmb;
      const nLid = Math.round(nEye * 0.36);
      const nIris = Math.round(nEye * 0.4);
      const nPupil = Math.round(nEye * 0.07);
      const nGlint = Math.max(3, Math.round(nEye * 0.015));
      const nSclera = nEye - nLid - nIris - nPupil - nGlint;

      // Qovoqlar: zich kontur + tashqi "qosh" chiziq
      for (let i = 0; i < nLid; i++) {
        const upper = Math.random() < 0.58;
        const outer = Math.random() < 0.22;
        const u = Math.sign(rand(-1, 1)) * Math.pow(Math.random(), 0.8);
        let v = upper ? -upperLid(u) : lowerLid(u);
        if (outer) v *= upper ? 1.28 : 1.22;
        add({
          type: 'lid',
          u: u * (outer ? 1.06 : 1) + rand(-0.01, 0.01),
          v: v + rand(-0.018, 0.018),
          c: outer ? pick(['blue', 'violet', 'magenta', 'white']) : pick(['violet', 'violet', 'iris2', 'white', 'blue', 'teal']),
          lvl: outer ? rand(0, 1) < 0.5 ? 1 : 2 : 3,
        });
      }
      // Kamalak parda (iris): radial tolalar
      const fibers = 72;
      for (let i = 0; i < nIris; i++) {
        const rim = Math.random() < 0.22;
        const f = ((Math.random() * fibers) | 0) / fibers;
        const th = rim ? rand(0, TAU) : f * TAU + rand(-0.03, 0.03);
        const rho = rim ? 0.34 + rand(-0.012, 0.012) : rand(0.15, 0.335);
        let c;
        if (rim) c = pick(['violet', 'blue', 'violet']);
        else if (rho < 0.21) c = pick(['amber', 'amber', 'white']);
        else if (rho < 0.27) c = pick(['amber', 'magenta', 'iris2']);
        else c = pick(['violet', 'iris2', 'teal', 'blue']);
        add({ type: 'iris', th, rho, c, lvl: rim ? 3 : rand(0, 1) < 0.7 ? 3 : 2 });
      }
      // Qorachiq cheti
      for (let i = 0; i < nPupil; i++) {
        add({ type: 'iris', th: rand(0, TAU), rho: 0.135 + rand(-0.006, 0.006), c: pick(['amber', 'white']), lvl: 3, pupil: true });
      }
      // Yaltiroq nuqta
      for (let i = 0; i < nGlint; i++) {
        add({ type: 'glint', gx: -0.07 + rand(-0.02, 0.02), gy: -0.08 + rand(-0.02, 0.02), c: 'white', lvl: 3 });
      }
      // Oq qism — siyrak
      for (let i = 0; i < nSclera; i++) {
        let u, v;
        for (let k = 0; k < 20; k++) {
          u = rand(-0.95, 0.95);
          v = rand(-0.5, 0.4);
          const inside = v < 0 ? -v < upperLid(u) * 0.92 : v < lowerLid(u) * 0.9;
          if (inside && Math.hypot(u, v) > 0.36) break;
        }
        add({ type: 'sclera', u, v, c: pick(['white', 'blue', 'violet', 'teal']), lvl: rand(0, 1) < 0.6 ? 0 : 1 });
      }
      // Atrofdagi zarrachalar maydoni
      for (let i = 0; i < nAmb; i++) {
        add({
          type: 'amb',
          ax: rand(0, 1),
          ay: rand(0, 1),
          dx: rand(-0.006, 0.006),
          dy: rand(-0.004, 0.004),
          c: pick(COLOR_KEYS),
          lvl: rand(0, 1) < 0.7 ? 0 : 1,
        });
      }
      this.P = P;
      this.buckets = COLOR_KEYS.map(() => ALPHA_LEVELS.map(() => []));
    }

    bind() {
      this._onMove = (e) => {
        const r = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - r.left;
        this.mouse.y = e.clientY - r.top;
        this.mouse.active = true;
        this.mouse.last = this.t;
        const tr = this.o.trackEl ? this.o.trackEl.getBoundingClientRect() : { width: global.innerWidth, height: global.innerHeight };
        const nx = (this.mouse.x - this.cx) / Math.max(200, tr.width * 0.5);
        const ny = (this.mouse.y - this.cy) / Math.max(200, tr.height * 0.5);
        this.look.tx = clamp(nx, -1, 1) * 0.36;
        this.look.ty = clamp(ny, -1, 1) * 0.12;
      };
      this._onLeave = () => (this.mouse.active = false);
      this._onResize = () => {
        this.resize();
      };
      global.addEventListener('pointermove', this._onMove, { passive: true });
      document.addEventListener('pointerleave', this._onLeave);
      global.addEventListener('resize', this._onResize);

      // Ekrandan tashqarida boʻlsa toʻxtaydi, scroll/resize da qayta ishga tushadi
      this._wake = () => {
        if (!this.running && this.onScreen()) this.start();
      };
      global.addEventListener('scroll', this._wake, { passive: true });
      global.addEventListener('resize', this._wake);
      document.addEventListener('visibilitychange', this._wake);
    }

    onScreen() {
      const r = this.canvas.getBoundingClientRect();
      return r.bottom > -50 && r.top < global.innerHeight + 50 && r.width > 0;
    }

    triggerBlink() {
      if (this.blinkStart < 0) this.blinkStart = this.t;
    }

    start() {
      if (this.running) return;
      this.running = true;
      this._last = performance.now();
      this._frame = 0;
      const loop = (now) => {
        if (++this._frame % 15 === 0 && !this.onScreen()) {
          this.running = false;
          return;
        }
        const dt = Math.min(0.05, (now - this._last) / 1000);
        this._last = now;
        this.step(dt);
        this.draw();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    step(dt) {
      this.t += dt;
      const t = this.t;
      const L = this.look;

      // Sakkadalar — sichqoncha harakatsiz bo‘lsa, ko‘z o‘zi atrofga qaraydi
      if (!this.mouse.active || t - this.mouse.last > 2.6) {
        if (t > this.nextSaccade) {
          L.tx = rand(-0.3, 0.3);
          L.ty = rand(-0.09, 0.09);
          this.nextSaccade = t + rand(1.2, 3.2);
        }
      }
      const k = reduceMotion ? 1 : 1 - Math.pow(0.0008, dt);
      L.x += (L.tx - L.x) * k;
      L.y += (L.ty - L.y) * k;

      // Miltillash
      if (!reduceMotion && t > this.nextBlink && this.blinkStart < 0) {
        this.blinkStart = t;
        this.nextBlink = t + rand(3.2, 6.5);
        if (Math.random() < 0.18) this.nextBlink = t + 0.42; // ikki marta miltillash
      }
      if (this.blinkStart >= 0) {
        const bt = (t - this.blinkStart) / 0.3;
        if (bt >= 1) {
          this.blinkStart = -1;
          this.blink = 1;
        } else {
          this.blink = 1 - 0.94 * Math.sin(Math.PI * bt);
        }
      }
      this.dilate = 1 + Math.sin(t * 0.9) * 0.08;

      const { cx, cy, W } = this;
      const b = this.blink;
      const repel = this.o.repel && this.mouse.active;
      const mx = this.mouse.x,
        my = this.mouse.y;
      const RR = W * 0.28;
      const rot = t * 0.05;
      const spring = reduceMotion ? 1 : 0.06;
      const damp = 0.8;

      for (const p of this.P) {
        let tx, ty, vis = 1;
        const sh = Math.sin(t * 1.3 + p.ph) * 0.006;
        switch (p.type) {
          case 'lid': {
            const vv = p.v < 0 ? p.v * b : p.v * (0.35 + 0.65 * b);
            tx = cx + (p.u + sh) * W;
            ty = cy + (vv + Math.cos(t * 1.1 + p.ph) * 0.005) * W;
            break;
          }
          case 'sclera': {
            const vv = p.v < 0 ? p.v * b : p.v * (0.35 + 0.65 * b);
            tx = cx + (p.u + sh) * W;
            ty = cy + vv * W;
            vis = b > 0.5 ? 1 : 0;
            break;
          }
          case 'iris': {
            let rho = p.rho;
            if (p.pupil) rho *= this.dilate;
            else if (rho < 0.2) rho = 0.135 * this.dilate + (rho - 0.135) * (1 - (this.dilate - 1) * 0.6) + 0.015;
            const th = p.th + rot * (p.pupil ? -1 : 1);
            const lu = L.x + rho * Math.cos(th);
            const lv = L.y + rho * Math.sin(th) * 1.0;
            tx = cx + (lu + sh * 0.5) * W;
            ty = cy + lv * W;
            vis = this.inside(lu, lv, b) ? 1 : 0;
            break;
          }
          case 'glint': {
            const lu = L.x * 1.02 + p.gx,
              lv = L.y + p.gy;
            tx = cx + lu * W;
            ty = cy + lv * W;
            vis = this.inside(lu, lv, b) ? 1 : 0;
            break;
          }
          default: {
            // amb
            p.ax += p.dx * dt;
            p.ay += p.dy * dt;
            if (p.ax < -0.02) p.ax = 1.02;
            if (p.ax > 1.02) p.ax = -0.02;
            if (p.ay < -0.02) p.ay = 1.02;
            if (p.ay > 1.02) p.ay = -0.02;
            tx = p.ax * this.w + Math.sin(t * 0.4 + p.ph) * 6;
            ty = p.ay * this.h + Math.cos(t * 0.3 + p.ph) * 6;
          }
        }

        if (!p.init) {
          // yig‘ilish animatsiyasi
          p.vx += (tx - p.x) * 0.018;
          p.vy += (ty - p.y) * 0.018;
          p.vx *= 0.87;
          p.vy *= 0.87;
          if (Math.abs(tx - p.x) + Math.abs(ty - p.y) < 2) p.init = true;
        } else {
          p.vx += (tx - p.x) * spring;
          p.vy += (ty - p.y) * spring;
          p.vx *= damp;
          p.vy *= damp;
        }
        if (repel) {
          const dx = p.x - mx,
            dy = p.y - my;
          const d2 = dx * dx + dy * dy;
          if (d2 < RR * RR && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = (1 - d / RR) * 2.4;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }
        p.x += p.vx;
        p.y += p.vy;
        p.a += p.va + (Math.abs(p.vx) + Math.abs(p.vy)) * 0.01;
        const aT = vis;
        p.alpha += (aT - p.alpha) * (reduceMotion ? 1 : 0.35);
      }
    }

    inside(u, v, b) {
      if (u <= -1 || u >= 1) return false;
      return v < 0 ? -v <= upperLid(u) * b * 0.96 : v <= lowerLid(u) * (0.35 + 0.65 * b) * 0.94;
    }

    draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);
      const B = this.buckets;
      for (const row of B) for (const cell of row) cell.length = 0;
      for (const p of this.P) {
        if (p.alpha < 0.05) continue;
        let lvl = p.lvl;
        if (p.alpha < 0.6) lvl = Math.max(0, lvl - 1);
        B[COLOR_KEYS.indexOf(p.c)][lvl].push(p);
      }
      ctx.lineWidth = this.o.lineWidth;
      ctx.lineJoin = 'round';
      const C1 = 2.0944, C2 = 4.18879;
      for (let ci = 0; ci < COLOR_KEYS.length; ci++) {
        const col = PALETTE[COLOR_KEYS[ci]];
        for (let li = 0; li < ALPHA_LEVELS.length; li++) {
          const arr = B[ci][li];
          if (!arr.length) continue;
          ctx.globalAlpha = ALPHA_LEVELS[li];
          ctx.beginPath();
          for (const p of arr) {
            const s = p.s, a = p.a;
            ctx.moveTo(p.x + Math.cos(a) * s, p.y + Math.sin(a) * s);
            ctx.lineTo(p.x + Math.cos(a + C1) * s, p.y + Math.sin(a + C1) * s);
            ctx.lineTo(p.x + Math.cos(a + C2) * s, p.y + Math.sin(a + C2) * s);
            ctx.closePath();
          }
          if (this.o.fill) {
            ctx.fillStyle = col;
            ctx.fill();
          } else {
            ctx.strokeStyle = col;
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  /* Jamoa a’zolari uchun zarrachali monogramma */
  class ParticleMonogram {
    constructor(canvas, text, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.text = text;
      this.o = Object.assign({ colors: ['violet', 'iris2', 'amber', 'teal', 'blue', 'white'], step: 5 }, opts);
      this.hover = false;
      this.running = false;
      this.resize();
      canvas.parentElement.addEventListener('pointerenter', () => {
        this.hover = true;
        this.scatter();
      });
      canvas.parentElement.addEventListener('pointerleave', () => (this.hover = false));
      if ('ResizeObserver' in global) new ResizeObserver(() => this.resize()).observe(canvas);
    }
    resize() {
      const r = this.canvas.getBoundingClientRect();
      if (!r.width) return;
      this.dpr = Math.min(global.devicePixelRatio || 1, 2);
      this.w = r.width;
      this.h = r.height;
      this.canvas.width = Math.round(r.width * this.dpr);
      this.canvas.height = Math.round(r.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.sample();
      this.kick();
    }
    sample() {
      const w = Math.round(this.w), h = Math.round(this.h);
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const c = off.getContext('2d');
      const fs = Math.min(w * 0.46, h * 0.62);
      c.fillStyle = '#fff';
      c.font = `600 ${fs}px "Inter Tight", Inter, system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(this.text, w / 2, h / 2 + fs * 0.04);
      const d = c.getImageData(0, 0, w, h).data;
      const pts = [];
      const st = this.o.step;
      for (let y = 0; y < h; y += st) for (let x = 0; x < w; x += st) if (d[(y * w + x) * 4 + 3] > 128) pts.push([x + rand(-1, 1), y + rand(-1, 1)]);
      const old = this.P || [];
      this.P = pts.map(([x, y], i) => {
        const o = old[i];
        return {
          tx: x, ty: y,
          x: o ? o.x : rand(0, w), y: o ? o.y : rand(0, h),
          vx: 0, vy: 0,
          a: rand(0, TAU), s: rand(1, 2.2),
          c: PALETTE[pick(this.o.colors)],
          ph: rand(0, TAU),
        };
      });
      // atrofdagi siyrak zarrachalar
      for (let i = 0; i < 26; i++) {
        const x = rand(0, w), y = rand(0, h);
        this.P.push({ tx: x, ty: y, x, y, vx: 0, vy: 0, a: rand(0, TAU), s: rand(0.8, 1.6), c: PALETTE[pick(this.o.colors)], ph: rand(0, TAU), amb: true });
      }
    }
    scatter() {
      for (const p of this.P) {
        const ang = rand(0, TAU), f = rand(3, 9);
        p.vx += Math.cos(ang) * f;
        p.vy += Math.sin(ang) * f;
      }
      this.kick();
    }
    kick() {
      if (this.running || reduceMotion) {
        if (reduceMotion) { for (const p of this.P) { p.x = p.tx; p.y = p.ty; } this.draw(); }
        return;
      }
      this.running = true;
      this.idle = 0;
      const loop = () => {
        let energy = 0;
        const t = performance.now() / 1000;
        for (const p of this.P) {
          const tx = p.tx + (this.hover ? Math.sin(t * 2 + p.ph) * 1.5 : 0);
          const ty = p.ty + (this.hover ? Math.cos(t * 2 + p.ph) * 1.5 : 0);
          p.vx = (p.vx + (tx - p.x) * 0.05) * 0.86;
          p.vy = (p.vy + (ty - p.y) * 0.05) * 0.86;
          p.x += p.vx;
          p.y += p.vy;
          p.a += 0.01 + Math.abs(p.vx) * 0.05;
          energy += Math.abs(p.vx) + Math.abs(p.vy);
        }
        this.draw();
        if (energy / this.P.length < 0.02 && !this.hover) {
          this.running = false;
          return;
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
    draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.lineWidth = 1;
      for (const p of this.P) {
        ctx.globalAlpha = p.amb ? 0.25 : 0.9;
        ctx.strokeStyle = p.c;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = p.a + k * 2.0944;
          const X = p.x + Math.cos(a) * p.s, Y = p.y + Math.sin(a) * p.s;
          k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  global.ParticleEye = ParticleEye;
  global.ParticleMonogram = ParticleMonogram;
})(window);

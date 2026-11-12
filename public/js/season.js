/* Seasonal effects (admin picks one in Settings): a light canvas overlay that
   never blocks clicks. Honors reduced-motion and lets visitors switch it off. */
(function () {
  'use strict';

  const KEY = 'zemiki_season_off';
  const THEMES = {
    // kind: how particles move; draw: how they look
    christmas: { n: 70, label: 'snow', fall: true, colors: ['#ffffff', '#eaf3ff'], draw: 'flake', size: [2, 5], speed: [0.5, 1.4] },
    deepavali: { n: 45, label: 'lights', fall: false, colors: ['#ffcf5a', '#ff9d2e', '#ffe9a8'], draw: 'glow', size: [2, 5], speed: [0.3, 0.9] },
    vesak:     { n: 16, label: 'lanterns', fall: false, colors: ['#ffd24a', '#ff6b5a', '#6ec6ff', '#ffffff'], draw: 'lantern', size: [14, 24], speed: [0.25, 0.6] },
    avurudu:   { n: 55, label: 'confetti', fall: true, colors: ['#c9a24b', '#b3202e', '#2e8b57', '#f4b400', '#ffffff'], draw: 'confetti', size: [5, 9], speed: [0.8, 1.8] },
    valentine: { n: 24, label: 'hearts', fall: false, colors: ['#ff5d7a', '#ff8fa3', '#e0245e', '#ffc2d1'], draw: 'heart', size: [10, 20], speed: [0.4, 1.0] },
    eid:       { n: 34, label: 'stars', fall: true, colors: ['#ffe08a', '#ffffff', '#c9a24b'], draw: 'star', size: [4, 9], speed: [0.25, 0.7] },
  };

  function start(themeKey) {
    const T = THEMES[themeKey];
    if (!T || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (document.getElementById('seasonCanvas')) return;
    let off = false;
    try { off = localStorage.getItem(KEY) === '1'; } catch (e) {}

    const cv = document.createElement('canvas');
    cv.id = 'seasonCanvas';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:90';
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2), parts = [], raf = 0;

    const rnd = (a, b) => a + Math.random() * (b - a);
    const count = () => Math.round(T.n * (window.innerWidth < 640 ? 0.55 : 1));
    function make(initial) {
      const size = rnd(T.size[0], T.size[1]);
      return {
        x: rnd(0, W), size, speed: rnd(T.speed[0], T.speed[1]),
        y: initial ? rnd(0, H) : (T.fall ? -size * 2 : H + size * 2),
        sway: rnd(0.4, 1.4), phase: rnd(0, 6.28), rot: rnd(0, 6.28), vr: rnd(-0.04, 0.04),
        color: T.colors[Math.floor(Math.random() * T.colors.length)], tw: rnd(0.02, 0.05),
      };
    }
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = count();
      while (parts.length < n) parts.push(make(true));
      parts.length = n;
    }

    const draw = {
      flake(p) { ctx.fillStyle = p.color; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(0, 0, p.size, 0, 6.283); ctx.fill(); },
      glow(p, t) {
        const a = 0.35 + 0.65 * Math.abs(Math.sin(t * p.tw + p.phase));
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 3);
        g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(255,170,40,0)');
        ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, p.size * 3, 0, 6.283); ctx.fill();
      },
      lantern(p, t) {
        const s = p.size, a = 0.8;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2.2);
        g.addColorStop(0, 'rgba(255,220,120,.55)'); g.addColorStop(1, 'rgba(255,220,120,0)');
        ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 2.2, 0, 6.283); ctx.fill();
        ctx.fillStyle = p.color; ctx.globalAlpha = 0.92;
        ctx.beginPath(); ctx.roundRect(-s * 0.5, -s * 0.7, s, s * 1.4, s * 0.25); ctx.fill();
        ctx.fillStyle = 'rgba(90,26,43,.7)'; ctx.fillRect(-s * 0.5, -s * 0.7, s, s * 0.14); ctx.fillRect(-s * 0.5, s * 0.56, s, s * 0.14);
      },
      confetti(p) { ctx.fillStyle = p.color; ctx.globalAlpha = 0.9; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); },
      heart(p) {
        const s = p.size; ctx.fillStyle = p.color; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.moveTo(0, s * 0.35);
        ctx.bezierCurveTo(-s, -s * 0.3, -s * 0.5, -s, 0, -s * 0.45);
        ctx.bezierCurveTo(s * 0.5, -s, s, -s * 0.3, 0, s * 0.35); ctx.fill();
      },
      star(p, t) {
        const a = 0.4 + 0.6 * Math.abs(Math.sin(t * p.tw + p.phase)), s = p.size;
        ctx.fillStyle = p.color; ctx.globalAlpha = a; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.45 : s; const ang = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); }
        ctx.closePath(); ctx.fill();
      },
    };

    let t = 0;
    function frame() {
      raf = requestAnimationFrame(frame);
      t++;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.y += T.fall ? p.speed : -p.speed;
        p.x += Math.sin(t * 0.01 * p.sway + p.phase) * 0.5;
        p.rot += p.vr;
        if ((T.fall && p.y > H + p.size * 2) || (!T.fall && p.y < -p.size * 3)) parts[i] = make(false);
        ctx.save(); ctx.translate(p.x, p.y);
        if (T.draw === 'confetti' || T.draw === 'heart') ctx.rotate(T.draw === 'heart' ? Math.sin(t * 0.02 + p.phase) * 0.3 : p.rot);
        draw[T.draw](p, t); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    const run = () => { if (!raf) { cv.style.display = ''; frame(); } };
    const halt = () => { cancelAnimationFrame(raf); raf = 0; cv.style.display = 'none'; ctx.clearRect(0, 0, W, H); };

    resize(); window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!off) run(); });

    // Small switch so visitors can turn the effect off (remembered).
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'season-toggle';
    const paint = () => { btn.textContent = off ? '✨ Effects off' : '✨ ' + T.label; btn.title = off ? 'Turn seasonal effects on' : 'Turn seasonal effects off'; btn.setAttribute('aria-pressed', String(!off)); };
    btn.addEventListener('click', () => { off = !off; try { localStorage.setItem(KEY, off ? '1' : '0'); } catch (e) {} paint(); off ? halt() : run(); });
    paint(); document.body.appendChild(btn);
    off ? halt() : run();
  }

  document.addEventListener('layout:ready', (e) => {
    const cfg = (e.detail && e.detail.config) || window.__cfg || {};
    if (cfg.season && cfg.season !== 'none') start(cfg.season);
  });
  if (window.__cfg && window.__cfg.season && window.__cfg.season !== 'none') start(window.__cfg.season);
})();

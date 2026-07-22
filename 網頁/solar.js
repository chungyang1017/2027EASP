// EASP 2027 — real-time solar system hero background.
// Planetary positions are computed for the current date from J2000 mean
// orbital elements by solving Kepler's equation, so the configuration on
// screen matches the actual sky. Periods, eccentricities and perihelion
// longitudes are real; sizes and distances are compressed for display.
(() => {
  'use strict';

  const cv = document.getElementById('solarSky');
  if (!cv) return;
  const hero = cv.closest('.hero');
  const cx2 = cv.getContext('2d');

  /* ---- J2000 mean elements: a (au), e, T (days), L0 / w (deg), R (Earth radii) ---- */
  const PLANETS = [
    { n:'Mercury', a:0.38710, e:0.20563, T:87.969,  L0:252.251, w:77.457,  R:0.383,  c:'#a89a8e', d:'#4c4340' },
    { n:'Venus',   a:0.72333, e:0.00677, T:224.701, L0:181.980, w:131.564, R:0.949,  c:'#eddbb0', d:'#8a6f3f' },
    { n:'Earth',   a:1.00000, e:0.01671, T:365.256, L0:100.464, w:102.937, R:1.000,  c:'#6b93d6', d:'#1c3a6e' },
    { n:'Mars',    a:1.52368, e:0.09340, T:686.980, L0:355.453, w:336.041, R:0.532,  c:'#c1662f', d:'#5c2a12' },
    { n:'Jupiter', a:5.20260, e:0.04849, T:4332.59, L0:34.396,  w:14.728,  R:11.209, c:'#d9bb8d', d:'#7a5a35' },
    { n:'Saturn',  a:9.55491, e:0.05551, T:10759.2, L0:49.954,  w:92.598,  R:9.449,  c:'#e6d3a4', d:'#8a7345' },
    { n:'Uranus',  a:19.2184, e:0.04630, T:30688.5, L0:313.238, w:170.954, R:4.007,  c:'#aee1e1', d:'#3e7d85' },
    { n:'Neptune', a:30.1104, e:0.00899, T:60182,   L0:304.880, w:44.965,  R:3.883,  c:'#5d7de0', d:'#1d2f75' },
  ];
  const DEG = Math.PI / 180;
  const J2000 = Date.UTC(2000, 0, 1, 12);
  const daysNow = () => (Date.now() - J2000) / 86400000;

  function kepler(M, e) {
    let E = M + e * Math.sin(M);
    for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    return E;
  }
  function locate(p, t) {
    const M = ((p.L0 - p.w) * DEG + 2 * Math.PI * t / p.T) % (2 * Math.PI);
    const E = kepler(M, p.e);
    const nu = 2 * Math.atan2(Math.sqrt(1 + p.e) * Math.sin(E / 2), Math.sqrt(1 - p.e) * Math.cos(E / 2));
    return { r: p.a * (1 - p.e * Math.cos(E)), th: nu + p.w * DEG };
  }

  /* ---- presentation ---- */
  const TILT = 0.42, POW = 0.40, YEAR_SEC = 40;   // 1 Earth year ≈ 40 s on screen
  let W = 0, H = 0, DPR, SUNX, SUNY, S, sky, narrow = false;
  const pSize = R => Math.max(1.7, 2.6 * Math.pow(R, 0.42));
  const orbR  = a => S * Math.pow(a, POW);

  const BELT = Array.from({ length: 300 }, () => {
    const a = 2.12 + Math.random() * 1.15 + (Math.random() - .5) * .18;
    return { a, th: Math.random() * 2 * Math.PI, w: 2 * Math.PI / (365.25 * Math.pow(a, 1.5)), s: .4 + Math.random() * .6, al: .12 + Math.random() * .26 };
  });

  function resize() {
    const box = hero.getBoundingClientRect();
    W = Math.round(box.width); H = Math.round(box.height);
    if (!W || !H) return;                                  // pane hidden / not laid out yet
    DPR = Math.min(devicePixelRatio || 1, 2);
    cv.width = W * DPR; cv.height = H * DPR;
    cx2.setTransform(DPR, 0, 0, DPR, 0, 0);
    narrow = W < 900;
    SUNX = W * (narrow ? 0.50 : 0.70);
    SUNY = narrow ? Math.min(190, H * 0.14) : H * 0.52;   // narrow: pin to the empty band above the text
    const aMax = Math.pow(30.11, POW);
    const vertFit = narrow ? (SUNY - 14) / (aMax * TILT) : (H * 0.47) / (aMax * TILT);
    S = Math.min(72, (W - SUNX - 24) / aMax, (SUNX - 8) / aMax, vertFit);
    bakeSky();
  }

  function bakeSky() {
    sky = document.createElement('canvas');
    sky.width = W * DPR; sky.height = H * DPR;
    const g = sky.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const bg = g.createRadialGradient(SUNX, SUNY, 0, SUNX, SUNY, Math.max(W, H) * .9);
    bg.addColorStop(0, '#0a1226'); bg.addColorStop(.45, '#070c1b'); bg.addColorStop(1, '#04060d');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W * .5, H * .5); g.rotate(-.5);
    const band = g.createLinearGradient(0, -H * .32, 0, H * .32);
    band.addColorStop(0, 'rgba(150,170,220,0)'); band.addColorStop(.5, 'rgba(165,185,230,.05)'); band.addColorStop(1, 'rgba(150,170,220,0)');
    g.fillStyle = band; g.fillRect(-W, -H * .32, 2 * W, H * .64); g.restore();
    for (let i = 0; i < 520; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = Math.random();
      const s = r < .88 ? .5 + Math.random() * .6 : .9 + Math.random() * .9;
      const hue = Math.random();
      g.fillStyle = (hue < .82 ? 'rgba(235,242,255,' : hue < .92 ? 'rgba(190,214,255,' : 'rgba(255,224,178,') + (.35 + Math.random() * .6) + ')';
      g.beginPath(); g.arc(x, y, s, 0, 7); g.fill();
    }
  }

  const proj = (r, th) => ({ x: SUNX + r * Math.cos(th), y: SUNY - r * Math.sin(th) * TILT });

  function drawOrbit(p) {
    cx2.beginPath();
    for (let i = 0; i <= 96; i++) {
      const E = i / 96 * 2 * Math.PI;
      const r = orbR(p.a) * (1 - p.e * Math.cos(E));
      const nu = 2 * Math.atan2(Math.sqrt(1 + p.e) * Math.sin(E / 2), Math.sqrt(1 - p.e) * Math.cos(E / 2));
      const q = proj(r, nu + p.w * DEG);
      i ? cx2.lineTo(q.x, q.y) : cx2.moveTo(q.x, q.y);
    }
    cx2.closePath();
    cx2.strokeStyle = 'rgba(190,215,255,.07)'; cx2.lineWidth = 1; cx2.stroke();
  }

  function shadePlanet(q, s, p) {
    const dx = SUNX - q.x, dy = SUNY - q.y, m = Math.hypot(dx, dy) || 1;
    const g = cx2.createRadialGradient(q.x + dx / m * s * .45, q.y + dy / m * s * .45, s * .1, q.x, q.y, s * 1.25);
    g.addColorStop(0, p.c); g.addColorStop(.55, p.c); g.addColorStop(1, p.d);
    cx2.fillStyle = g;
    cx2.beginPath(); cx2.arc(q.x, q.y, s, 0, 7); cx2.fill();
  }

  function drawSaturnRing(q, s, front) {
    const rx = s * 2.25, ry = rx * .38;
    cx2.save(); cx2.translate(q.x, q.y); cx2.rotate(-.18);
    [[1.0, .8, s * .42], [.72, .5, s * .26]].forEach(([k, al, lw]) => {
      cx2.beginPath();
      cx2.ellipse(0, 0, rx * k, ry * k, 0, front ? 0 : Math.PI, front ? Math.PI : 2 * Math.PI, false);
      cx2.strokeStyle = `rgba(226,209,166,${al * .8})`; cx2.lineWidth = lw; cx2.stroke();
    });
    cx2.restore();
  }

  function drawSun(now) {
    const pulse = 1 + .025 * Math.sin(now / 1400);
    const R0 = Math.max(11, S * .26);
    let g = cx2.createRadialGradient(SUNX, SUNY, 0, SUNX, SUNY, R0 * 7 * pulse);
    g.addColorStop(0, 'rgba(255,190,90,.34)'); g.addColorStop(.4, 'rgba(255,140,45,.12)'); g.addColorStop(1, 'rgba(255,120,30,0)');
    cx2.fillStyle = g; cx2.beginPath(); cx2.arc(SUNX, SUNY, R0 * 7 * pulse, 0, 7); cx2.fill();
    cx2.save(); cx2.translate(SUNX, SUNY); cx2.scale(1, .06);
    g = cx2.createRadialGradient(0, 0, 0, 0, 0, R0 * 10);
    g.addColorStop(0, 'rgba(255,225,170,.30)'); g.addColorStop(1, 'rgba(255,225,170,0)');
    cx2.fillStyle = g; cx2.beginPath(); cx2.arc(0, 0, R0 * 10, 0, 7); cx2.fill(); cx2.restore();
    g = cx2.createRadialGradient(SUNX - R0 * .2, SUNY - R0 * .2, 0, SUNX, SUNY, R0);
    g.addColorStop(0, '#fffdf4'); g.addColorStop(.55, '#ffedc0'); g.addColorStop(.85, '#ffc866'); g.addColorStop(1, '#ff9838');
    cx2.fillStyle = g; cx2.beginPath(); cx2.arc(SUNX, SUNY, R0, 0, 7); cx2.fill();
    cx2.strokeStyle = 'rgba(255,140,50,.5)'; cx2.lineWidth = 1.2;
    cx2.beginPath(); cx2.arc(SUNX, SUNY, R0, 0, 7); cx2.stroke();
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let simDays = daysNow(), last = performance.now();

  function frame(now) {
    const box = hero.getBoundingClientRect();
    if (Math.round(box.width) !== W || Math.round(box.height) !== H) resize();
    if (!W || !H) { if (!reduced) requestAnimationFrame(frame); return; }
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    simDays += dt * 365.25 / YEAR_SEC;

    cx2.clearRect(0, 0, W, H);
    cx2.drawImage(sky, 0, 0, W, H);
    PLANETS.forEach(drawOrbit);

    BELT.forEach(b => {
      const q = proj(orbR(b.a), b.th + b.w * simDays);
      cx2.fillStyle = `rgba(205,200,190,${b.al})`;
      cx2.fillRect(q.x, q.y, b.s, b.s);
    });

    const bodies = PLANETS.map(p => {
      const { r, th } = locate(p, simDays);
      return { p, q: proj(orbR(p.a) * r / p.a, th), s: pSize(p.R) };
    });
    bodies.push({ sun: true, q: { x: SUNX, y: SUNY } });
    bodies.sort((A, B) => A.q.y - B.q.y);

    for (const b of bodies) {
      if (b.sun) { drawSun(now); continue; }
      const { p, q, s } = b;
      if (p.n === 'Saturn') drawSaturnRing(q, s, false);
      shadePlanet(q, s, p);
      if (p.n === 'Jupiter') {
        cx2.save(); cx2.beginPath(); cx2.arc(q.x, q.y, s, 0, 7); cx2.clip();
        cx2.strokeStyle = 'rgba(122,90,53,.5)'; cx2.lineWidth = s * .16;
        [-.38, -.02, .34].forEach(k => { cx2.beginPath(); cx2.moveTo(q.x - s, q.y + s * k); cx2.lineTo(q.x + s, q.y + s * k); cx2.stroke(); });
        cx2.restore();
      }
      if (p.n === 'Saturn') drawSaturnRing(q, s, true);
      if (p.n === 'Earth') {
        const ma = 2 * Math.PI * (simDays % 27.322) / 27.322;
        cx2.fillStyle = 'rgba(205,205,210,.95)';
        cx2.beginPath(); cx2.arc(q.x + Math.cos(ma) * (s + 4.5), q.y - Math.sin(ma) * (s + 4.5) * TILT, .9, 0, 7); cx2.fill();
      }
      if (!narrow) {                                   // labels off on small screens
        cx2.font = '10px "Space Mono", monospace';
        cx2.fillStyle = 'rgba(222,236,255,.42)';
        cx2.fillText(p.n, q.x + s + (p.n === 'Saturn' ? s * 1.6 : 0) + 5, q.y + 3);
      }
    }
    if (!reduced) requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { last = performance.now(); });
  resize();
  requestAnimationFrame(t => { last = t; frame(t); });
})();

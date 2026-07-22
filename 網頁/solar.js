// EASP 2027 — real-time solar system hero background (v2, textured).
// Positions: computed for the current date from J2000 mean orbital elements
// (Kepler solve) — true periods, eccentricities, perihelion longitudes.
// Rendering: procedurally generated planet surfaces (band turbulence, Great
// Red Spot, Earth continents/clouds/atmosphere, craters, polar caps), sun
// granulation with limb darkening and an animated corona. Sizes and
// distances remain compressed for display.
(() => {
  'use strict';

  const cv = document.getElementById('solarSky');
  if (!cv) return;
  const hero = cv.closest('.hero');
  const cx2 = cv.getContext('2d');
  cx2.imageSmoothingQuality = 'high';

  /* ================= astronomy ================= */
  const PLANETS = [
    { n:'Mercury', a:0.38710, e:0.20563, T:87.969,  L0:252.251, w:77.457,  R:0.383  },
    { n:'Venus',   a:0.72333, e:0.00677, T:224.701, L0:181.980, w:131.564, R:0.949  },
    { n:'Earth',   a:1.00000, e:0.01671, T:365.256, L0:100.464, w:102.937, R:1.000  },
    { n:'Mars',    a:1.52368, e:0.09340, T:686.980, L0:355.453, w:336.041, R:0.532  },
    { n:'Jupiter', a:5.20260, e:0.04849, T:4332.59, L0:34.396,  w:14.728,  R:11.209 },
    { n:'Saturn',  a:9.55491, e:0.05551, T:10759.2, L0:49.954,  w:92.598,  R:9.449  },
    { n:'Uranus',  a:19.2184, e:0.04630, T:30688.5, L0:313.238, w:170.954, R:4.007  },
    { n:'Neptune', a:30.1104, e:0.00899, T:60182,   L0:304.880, w:44.965,  R:3.883  },
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

  /* ================= deterministic noise ================= */
  function mulberry32(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function makeNoise(seed) {
    const rnd = mulberry32(seed);
    const g = new Float32Array(256 * 256);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    const raw = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const i00 = (yi & 255) * 256 + (xi & 255), i10 = (yi & 255) * 256 + (xi + 1 & 255);
      const i01 = (yi + 1 & 255) * 256 + (xi & 255), i11 = (yi + 1 & 255) * 256 + (xi + 1 & 255);
      const a = g[i00], b = g[i10], c = g[i01], d = g[i11];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    return (x, y, oct) => {
      let s = 0, amp = .5, f = 1;
      for (let o = 0; o < (oct || 4); o++) { s += amp * raw(x * f, y * f); amp *= .5; f *= 2; }
      return s;
    };
  }
  const N1 = makeNoise(20270630), N2 = makeNoise(1017), N3 = makeNoise(77);

  /* ================= texture bakery ================= */
  const SZ = 192, TEX = {};
  const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  function palette(stops) {
    const st = stops.map(([p, c]) => [p, hex(c)]);
    return t => {
      t = Math.max(0, Math.min(1, t));
      let i = 0;
      while (i < st.length - 2 && st[i + 1][0] < t) i++;
      const [p0, c0] = st[i], [p1, c1] = st[i + 1];
      const k = p1 > p0 ? (t - p0) / (p1 - p0) : 0;
      return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k];
    };
  }
  function bake(name, painter) {
    const c = document.createElement('canvas');
    c.width = c.height = SZ;
    painter(c.getContext('2d'));
    TEX[name] = c;
  }
  function pixelPlanet(g, colorAt) {
    const im = g.createImageData(SZ, SZ), d = im.data;
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const [r, gg, b] = colorAt(x / SZ, y / SZ);
      const i = (y * SZ + x) * 4;
      d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }
  function craters(g, count, rng, dark, lite) {
    for (let i = 0; i < count; i++) {
      const x = rng() * SZ, y = rng() * SZ, r = 1.5 + rng() * rng() * 9;
      g.fillStyle = dark; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.strokeStyle = lite; g.lineWidth = Math.max(.8, r * .22);
      g.beginPath(); g.arc(x, y, r * .82, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    }
  }
  const bandTex = (pal, k, fx, fy, oct) => (x, y) => pal(y + (N1(x * fx, y * fy, oct) - .5) * k);

  function bakeAll() {
    /* Mercury — cratered basalt gray */
    bake('Mercury', g => {
      const pal = palette([[0, '#b3aba1'], [1, '#57504a']]);
      pixelPlanet(g, (x, y) => pal(N1(x * 7, y * 7, 5)));
      craters(g, 46, mulberry32(11), 'rgba(58,52,48,.55)', 'rgba(214,206,196,.5)');
    });
    /* Venus — creamy sulfuric cloud swirls */
    bake('Venus', g => {
      const pal = palette([[0, '#f2e2b8'], [.5, '#dcbc88'], [1, '#bf9a60']]);
      pixelPlanet(g, (x, y) => pal(N1(x * 2.2 + y * 1.1, y * 3.4, 4) + (N2(x * 6, y * 6, 3) - .5) * .25));
    });
    /* Earth — oceans, continents, ice caps, clouds */
    bake('Earth', g => {
      const ocean = palette([[0, '#153e78'], [1, '#2f6fbf']]);
      const land = palette([[0, '#3f6f35'], [.55, '#7d8a4a'], [1, '#a08c58']]);
      pixelPlanet(g, (x, y) => {
        const cont = N1(x * 2.6, y * 2.6, 5);
        const polar = y < .10 + (N2(x * 9, 3, 2) - .5) * .05 || y > .90 + (N2(x * 9, 7, 2) - .5) * .05;
        if (polar) return [235, 242, 248];
        if (cont > .565) return land(N2(x * 5, y * 5, 4));
        if (cont > .545) return [90, 122, 96];
        return ocean(N3(x * 3, y * 3, 3));
      });
      const im = g.getImageData(0, 0, SZ, SZ), d = im.data;   // cloud layer
      for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
        const c = N2(x / SZ * 3.4 + 7, y / SZ * 3.1 + 13, 5);
        if (c > .585) {
          const a = Math.min(1, (c - .585) * 9);
          const i = (y * SZ + x) * 4;
          d[i] = d[i] + (250 - d[i]) * a; d[i + 1] = d[i + 1] + (252 - d[i + 1]) * a; d[i + 2] = d[i + 2] + (255 - d[i + 2]) * a;
        }
      }
      g.putImageData(im, 0, 0);
    });
    /* Mars — rust, dark maria, polar cap */
    bake('Mars', g => {
      const pal = palette([[0, '#e08a52'], [.5, '#c1662f'], [1, '#7c3a1a']]);
      pixelPlanet(g, (x, y) => {
        if (y < .09 + (N2(x * 8, 1, 2) - .5) * .04) return [240, 236, 230];
        return pal(N1(x * 4, y * 4, 5) * .75 + N2(x * 9, y * 9, 3) * .25);
      });
      craters(g, 14, mulberry32(42), 'rgba(96,44,20,.35)', 'rgba(232,178,140,.35)');
    });
    /* Jupiter — turbulent bands + Great Red Spot */
    bake('Jupiter', g => {
      const pal = palette([
        [0, '#c9b294'], [.07, '#e2d2b4'], [.14, '#b3835c'], [.21, '#ead9ba'],
        [.29, '#c59a6c'], [.37, '#f0e2c4'], [.45, '#a97a54'], [.52, '#e8d6b0'],
        [.60, '#bc8f66'], [.68, '#e2d0ac'], [.77, '#aa7d57'], [.86, '#d6c09a'], [1, '#b79c7a']]);
      pixelPlanet(g, bandTex(pal, .16, 3.4, 5.5, 5));
      g.save(); g.translate(SZ * .64, SZ * .615); g.rotate(-.12);   // Great Red Spot
      [[16, 10, '#b4442e', .95], [11.5, 7, '#cf6a48', .9], [7, 4.2, '#e2926f', .85]].forEach(([rx, ry, c, al]) => {
        g.globalAlpha = al; g.fillStyle = c;
        g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.fill();
      });
      g.globalAlpha = .5; g.strokeStyle = '#e8d6b0'; g.lineWidth = 2.2;
      g.beginPath(); g.ellipse(0, 0, 19, 12.4, 0, 0, 7); g.stroke();
      g.restore(); g.globalAlpha = 1;
    });
    /* Saturn — soft muted bands */
    bake('Saturn', g => {
      const pal = palette([
        [0, '#c3aa7e'], [.15, '#dcc79c'], [.3, '#cbb086'], [.45, '#e8d5a6'],
        [.6, '#d6bf92'], [.75, '#c2a97c'], [.9, '#dac69c'], [1, '#b59c72']]);
      pixelPlanet(g, bandTex(pal, .07, 2.6, 4.5, 4));
    });
    /* Uranus — pale featureless cyan */
    bake('Uranus', g => {
      const pal = palette([[0, '#8fc4c9'], [.5, '#abdcde'], [1, '#79b2ba']]);
      pixelPlanet(g, bandTex(pal, .04, 2, 3, 3));
    });
    /* Neptune — deep blue, dark spot, cirrus */
    bake('Neptune', g => {
      const pal = palette([[0, '#2c49a8'], [.35, '#3c63cf'], [.55, '#2a45a0'], [.78, '#4a6fd8'], [1, '#233b8a']]);
      pixelPlanet(g, bandTex(pal, .06, 2.8, 4, 4));
      g.fillStyle = 'rgba(16,26,74,.75)';
      g.beginPath(); g.ellipse(SZ * .38, SZ * .58, 13, 8, -.15, 0, 7); g.fill();
      g.strokeStyle = 'rgba(235,242,255,.5)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(SZ * .30, SZ * .34); g.quadraticCurveTo(SZ * .48, SZ * .30, SZ * .62, SZ * .335); g.stroke();
    });
    /* Sun — granulation + limb darkening (glow added at draw time) */
    bake('Sun', g => {
      const pal = palette([[0, '#fffdf2'], [.45, '#ffeec2'], [.75, '#ffcf78'], [.93, '#ff9f42'], [1, '#ff8430']]);
      pixelPlanet(g, (x, y) => {
        const dx = x - .5, dy = y - .5, r = Math.sqrt(dx * dx + dy * dy) * 2;
        const gran = .92 + .16 * (N3(x * 26, y * 26, 3) - .5) + .06 * (N1(x * 60, y * 60, 2) - .5);
        const [rr, gg, bb] = pal(Math.min(1, r));
        return [rr * gran, gg * gran, bb * gran];
      });
    });
  }

  /* ================= scene state ================= */
  const TILT = 0.42, POW = 0.40, YEAR_SEC = 40;
  let W = 0, H = 0, DPR, SUNX, SUNY, S, SUNR, PSCALE, sky, narrow = false, twinkles = [];

  const pSize = R => Math.max(2.1, 3.4 * Math.pow(R, 0.46)) * PSCALE;
  const orbR  = a => S * Math.pow(a, POW);

  const beltRnd = mulberry32(5);
  const BELT = Array.from({ length: 340 }, () => {
    const a = 2.12 + beltRnd() * 1.15 + (beltRnd() - .5) * .18;
    return { a, th: beltRnd() * 2 * Math.PI, w: 2 * Math.PI / (365.25 * Math.pow(a, 1.5)), s: .4 + beltRnd() * .7, al: .10 + beltRnd() * .24 };
  });

  const MOONS = {                     // real sidereal periods (days)
    Earth:   [{ T: 27.322, d: 5.6, s: 1.0, c: 'rgba(206,206,212,.95)' }],
    Jupiter: [{ T: 1.769, d: 4.2, s: .7, c: 'rgba(226,220,200,.9)' },   // Io
              { T: 3.551, d: 5.4, s: .7, c: 'rgba(216,222,232,.9)' },   // Europa
              { T: 7.155, d: 6.8, s: .9, c: 'rgba(196,188,172,.9)' },   // Ganymede
              { T: 16.689, d: 8.4, s: .8, c: 'rgba(178,170,160,.9)' }], // Callisto
    Saturn:  [{ T: 15.945, d: 7.6, s: .9, c: 'rgba(224,186,120,.9)' }], // Titan
  };

  function resize() {
    const box = hero.getBoundingClientRect();
    W = Math.round(box.width); H = Math.round(box.height);
    if (!W || !H) return;
    DPR = Math.min(devicePixelRatio || 1, 2);
    cv.width = W * DPR; cv.height = H * DPR;
    cx2.setTransform(DPR, 0, 0, DPR, 0, 0);
    narrow = W < 900;
    const aMax = Math.pow(30.11, POW);
    if (narrow) {
      SUNX = W * .50;
      SUNY = Math.min(200, H * .15);
      S = Math.min(64, (W * .5 - 10) / aMax, (SUNY - 12) / (aMax * TILT));
      PSCALE = 1.0; SUNR = Math.max(13, S * .17);
    } else {
      SUNX = W * .60;                                   // system sweeps the full hero, behind the text
      SUNY = H * .50;
      S = Math.min(210, (W * .52) / aMax, (H * .56) / (aMax * TILT));
      PSCALE = Math.max(1, Math.min(1.5, S / 140));
      SUNR = Math.max(20, Math.min(40, S * .19));
    }
    bakeSky();
  }

  function bakeSky() {
    sky = document.createElement('canvas');
    sky.width = W * DPR; sky.height = H * DPR;
    const g = sky.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const bg = g.createRadialGradient(SUNX, SUNY, 0, SUNX, SUNY, Math.max(W, H) * .95);
    bg.addColorStop(0, '#0b1328'); bg.addColorStop(.45, '#070c1c'); bg.addColorStop(1, '#03050c');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W * .5, H * .5); g.rotate(-.5);          // galactic band + nebulae
    const band = g.createLinearGradient(0, -H * .34, 0, H * .34);
    band.addColorStop(0, 'rgba(150,170,220,0)'); band.addColorStop(.5, 'rgba(168,188,232,.06)'); band.addColorStop(1, 'rgba(150,170,220,0)');
    g.fillStyle = band; g.fillRect(-W, -H * .34, 2 * W, H * .68);
    const neb = mulberry32(9);
    for (let i = 0; i < 7; i++) {
      const x = (neb() - .5) * W * 1.6, y = (neb() - .5) * H * .5, r = 60 + neb() * 150;
      const ng = g.createRadialGradient(x, y, 0, x, y, r);
      const tint = i % 2 ? '58,74,120' : '84,62,110';
      ng.addColorStop(0, `rgba(${tint},.07)`); ng.addColorStop(1, `rgba(${tint},0)`);
      g.fillStyle = ng; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    g.restore();
    const srnd = mulberry32(3);
    twinkles = [];
    for (let i = 0; i < 760; i++) {
      const x = srnd() * W, y = srnd() * H, r = srnd();
      const s = r < .86 ? .4 + srnd() * .6 : .9 + srnd() * 1.0;
      const hue = srnd(), al = .3 + srnd() * .6;
      g.fillStyle = (hue < .8 ? 'rgba(236,242,255,' : hue < .91 ? 'rgba(186,212,255,' : 'rgba(255,224,178,') + al + ')';
      g.beginPath(); g.arc(x, y, s, 0, 7); g.fill();
      if (s > 1.5 && twinkles.length < 40) twinkles.push({ x, y, s, ph: srnd() * 7, sp: .0012 + srnd() * .002 });
    }
    for (let i = 0; i < 4; i++) {                                   // bright stars w/ diffraction spikes
      const x = srnd() * W, y = srnd() * H;
      const sg = g.createRadialGradient(x, y, 0, x, y, 7);
      sg.addColorStop(0, 'rgba(240,246,255,.9)'); sg.addColorStop(1, 'rgba(240,246,255,0)');
      g.fillStyle = sg; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill();
      g.strokeStyle = 'rgba(230,240,255,.35)'; g.lineWidth = .8;
      g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x + 9, y); g.moveTo(x, y - 9); g.lineTo(x, y + 9); g.stroke();
    }
  }

  const proj = (r, th) => ({ x: SUNX + r * Math.cos(th), y: SUNY - r * Math.sin(th) * TILT });

  function drawOrbit(p) {
    cx2.beginPath();
    for (let i = 0; i <= 120; i++) {
      const E = i / 120 * 2 * Math.PI;
      const r = orbR(p.a) * (1 - p.e * Math.cos(E));
      const nu = 2 * Math.atan2(Math.sqrt(1 + p.e) * Math.sin(E / 2), Math.sqrt(1 - p.e) * Math.cos(E / 2));
      const q = proj(r, nu + p.w * DEG);
      i ? cx2.lineTo(q.x, q.y) : cx2.moveTo(q.x, q.y);
    }
    cx2.closePath();
    cx2.strokeStyle = 'rgba(190,215,255,.085)'; cx2.lineWidth = 1; cx2.stroke();
  }

  /* ---- planet with texture, day/night terminator, limb darkening ---- */
  function drawPlanet(q, s, p) {
    const dx = q.x - SUNX, dy = q.y - SUNY, m = Math.hypot(dx, dy) || 1;
    const ax = dx / m, ay = dy / m;                                  // away-from-sun
    cx2.save();
    cx2.beginPath(); cx2.arc(q.x, q.y, s, 0, 7); cx2.clip();
    cx2.drawImage(TEX[p.n], q.x - s, q.y - s, s * 2, s * 2);
    let g = cx2.createRadialGradient(q.x + ax * s * .9, q.y + ay * s * .9, s * .1, q.x + ax * s * .9, q.y + ay * s * .9, s * 1.9);
    g.addColorStop(0, 'rgba(3,5,14,.92)'); g.addColorStop(.45, 'rgba(3,5,14,.55)'); g.addColorStop(.75, 'rgba(3,5,14,.12)'); g.addColorStop(1, 'rgba(3,5,14,0)');
    cx2.fillStyle = g; cx2.fillRect(q.x - s, q.y - s, s * 2, s * 2);
    g = cx2.createRadialGradient(q.x, q.y, s * .62, q.x, q.y, s);
    g.addColorStop(0, 'rgba(0,0,6,0)'); g.addColorStop(1, 'rgba(0,0,6,.42)');
    cx2.fillStyle = g; cx2.fillRect(q.x - s, q.y - s, s * 2, s * 2);
    cx2.restore();
    if (p.n === 'Earth') {                                           // atmosphere rim
      cx2.strokeStyle = 'rgba(126,188,255,.4)'; cx2.lineWidth = 1.4;
      cx2.beginPath(); cx2.arc(q.x, q.y, s + .9, 0, 7); cx2.stroke();
      cx2.strokeStyle = 'rgba(126,188,255,.12)'; cx2.lineWidth = 2.6;
      cx2.beginPath(); cx2.arc(q.x, q.y, s + 2.4, 0, 7); cx2.stroke();
    }
  }

  function saturnRings(q, s, front) {
    cx2.save(); cx2.translate(q.x, q.y); cx2.rotate(-.18);
    const a0 = front ? 0 : Math.PI, a1 = front ? Math.PI : 2 * Math.PI;
    [[2.32, .30, 'rgba(214,196,150,.55)'],                            // A ring
     [2.02, .10, 'rgba(120,104,72,.35)'],                             // Cassini division
     [1.86, .38, 'rgba(230,212,166,.8)'],                             // B ring
     [1.48, .22, 'rgba(196,176,132,.45)'],                            // C ring
    ].forEach(([k, wF, col]) => {
      cx2.beginPath();
      cx2.ellipse(0, 0, s * k, s * k * .36, 0, a0, a1, false);
      cx2.strokeStyle = col; cx2.lineWidth = s * wF; cx2.stroke();
    });
    cx2.restore();
    if (front) {                                                      // ring shadow on the globe
      cx2.save();
      cx2.beginPath(); cx2.arc(q.x, q.y, s * .98, 0, 7); cx2.clip();
      cx2.strokeStyle = 'rgba(40,30,16,.35)'; cx2.lineWidth = s * .16;
      cx2.beginPath(); cx2.ellipse(q.x, q.y - s * .28, s * 1.6, s * .5, -.18, 0, Math.PI); cx2.stroke();
      cx2.restore();
    }
  }

  function drawMoons(p, q, s, simD) {
    (MOONS[p.n] || []).forEach((mo, i) => {
      const ph = 2 * Math.PI * (simD % mo.T) / mo.T + i * 1.7;
      const r = s + mo.d;
      const mx = q.x + Math.cos(ph) * r, my = q.y - Math.sin(ph) * r * TILT;
      cx2.fillStyle = mo.c;
      cx2.beginPath(); cx2.arc(mx, my, mo.s, 0, 7); cx2.fill();
    });
  }

  function drawSun(now) {
    const pulse = 1 + .02 * Math.sin(now / 1600);
    cx2.save();
    cx2.globalCompositeOperation = 'lighter';
    let g = cx2.createRadialGradient(SUNX, SUNY, 0, SUNX, SUNY, SUNR * 7.5 * pulse);
    g.addColorStop(0, 'rgba(255,186,84,.32)'); g.addColorStop(.35, 'rgba(255,138,44,.13)'); g.addColorStop(1, 'rgba(255,120,30,0)');
    cx2.fillStyle = g; cx2.beginPath(); cx2.arc(SUNX, SUNY, SUNR * 7.5 * pulse, 0, 7); cx2.fill();
    const rot = now / 140000;                                         // soft, slowly drifting coronal streamers
    for (let i = 0; i < 6; i++) {
      const a = rot + i * Math.PI * 2 / 6 + N2(i * 2.3, 0, 2) * 2;
      const L = SUNR * (2.6 + 2.4 * N2(i * .8, now * .00006, 2));
      const ex = SUNX + Math.cos(a) * (SUNR + L * .55), ey = SUNY + Math.sin(a) * (SUNR + L * .55);
      const rg = cx2.createRadialGradient(ex, ey, 0, ex, ey, L);
      rg.addColorStop(0, 'rgba(255,190,100,.055)'); rg.addColorStop(1, 'rgba(255,160,60,0)');
      cx2.fillStyle = rg;
      cx2.beginPath(); cx2.arc(ex, ey, L, 0, 7); cx2.fill();
    }
    cx2.save(); cx2.translate(SUNX, SUNY); cx2.scale(1, .05);         // ecliptic lens streak
    g = cx2.createRadialGradient(0, 0, 0, 0, 0, SUNR * 11);
    g.addColorStop(0, 'rgba(255,228,175,.28)'); g.addColorStop(1, 'rgba(255,228,175,0)');
    cx2.fillStyle = g; cx2.beginPath(); cx2.arc(0, 0, SUNR * 11, 0, 7); cx2.fill();
    cx2.restore();
    cx2.restore();
    cx2.save();                                                       // photosphere w/ granulation
    cx2.beginPath(); cx2.arc(SUNX, SUNY, SUNR, 0, 7); cx2.clip();
    cx2.drawImage(TEX.Sun, SUNX - SUNR, SUNY - SUNR, SUNR * 2, SUNR * 2);
    cx2.restore();
    cx2.strokeStyle = 'rgba(255,148,54,.55)'; cx2.lineWidth = 1.3;    // chromosphere limb
    cx2.beginPath(); cx2.arc(SUNX, SUNY, SUNR + .4, 0, 7); cx2.stroke();
  }

  /* ================= main loop ================= */
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
    twinkles.forEach(t => {
      cx2.fillStyle = `rgba(240,246,255,${.25 + .3 * (1 + Math.sin(now * t.sp + t.ph)) / 2})`;
      cx2.beginPath(); cx2.arc(t.x, t.y, t.s * .8, 0, 7); cx2.fill();
    });

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
      if (p.n === 'Saturn') saturnRings(q, s, false);
      drawPlanet(q, s, p);
      if (p.n === 'Saturn') saturnRings(q, s, true);
      drawMoons(p, q, s, simDays);
      if (!narrow) {
        cx2.font = '10px "Space Mono", monospace';
        cx2.fillStyle = 'rgba(222,236,255,.4)';
        cx2.fillText(p.n, q.x + s + (p.n === 'Saturn' ? s * 1.5 : 0) + 6, q.y + 3);
      }
    }
    if (!reduced) requestAnimationFrame(frame);
  }

  bakeAll();
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { last = performance.now(); });
  resize();
  requestAnimationFrame(t => { last = t; frame(t); });
})();

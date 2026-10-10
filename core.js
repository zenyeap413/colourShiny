/* Core logic: color science, judgement rules, round setup. No DOM access (testable in Node). */
(function (root) {
  'use strict';

  // ---------- Colorblind types ----------
  const TYPES = {
    protan: {
      record: '過斑馬線被車撞，躺在醫院還被譴責為什麼闖紅燈',
      short: '紅', level: 3, levelName: '困難',
      name: '紅色盲', en: 'Protanopia',
      desc: '紅色會變暗，紅、綠、棕、橘混成土黃色。',
      example: { fg: '#FF263C', bg: '#007339', num: '74' },
    },
    deutan: {
      record: '幼稚園把草地塗黃色，被老師踢出學校',
      short: '綠', level: 2, levelName: '普通',
      name: '綠色盲', en: 'Deuteranopia',
      desc: '紅色和綠色幾乎分不出來，都變成土黃色。',
      example: { fg: '#FF5226', bg: '#13BF00', num: '29' },
    },
    tritan: {
      record: '網路提問梵谷的星空為什麼好看，被網爆',
      short: '藍黃', level: 4, levelName: '地獄',
      name: '藍黃色盲', en: 'Tritanopia',
      desc: '藍綠色和綠色、橘色和粉紅分不太出來。',
      example: { fg: '#FF5500', bg: '#ED008E', num: '57' },
    },
    achroma: {
      record: '早餐店打工把巧克力訂單全用草莓醬',
      short: '全', level: 1, levelName: '簡單',
      name: '全色盲', en: 'Achromatopsia',
      desc: '完全看不到顏色，只分得出明暗。',
      example: { fg: '#FF59FF', bg: '#00BF00', num: '86' },
    },
  };
  const TYPE_IDS = Object.keys(TYPES);
  // Difficulty order (easy -> hard), ranked by how many color pairs can pass the test
  const LEVEL_ORDER = TYPE_IDS.slice().sort((a, b) => TYPES[a].level - TYPES[b].level);

  // Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear RGB
  const MACHADO = {
    protan: [
      0.152286, 1.052583, -0.204868,
      0.114503, 0.786281, 0.099216,
      -0.003882, -0.048116, 1.051998,
    ],
    deutan: [
      0.367322, 0.860646, -0.227968,
      0.280085, 0.672501, 0.047413,
      -0.011820, 0.042940, 0.968881,
    ],
    tritan: [
      1.255528, -0.076749, -0.178779,
      -0.078411, 0.930809, 0.147602,
      0.004733, 0.691367, 0.303900,
    ],
  };

  const NUMBER_POOL = ['12', '29', '35', '42', '57', '63', '74', '86', '95'];

  // ---------- Basic conversions ----------
  const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16));
  }
  function rgbToHex(rgb) {
    return '#' + rgb.map((c) => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  function srgbToLinear(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function linearToSrgb(c) {
    c = clamp(c, 0, 1);
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }

  function hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r, g, b;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  function rgbToHsv(rgb) {
    const [r, g, b] = rgb.map((c) => c / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d > 0) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    return { h, s: max === 0 ? 0 : d / max, v: max };
  }

  // ---------- Colorblind simulation ----------
  // rgb: [0..255]x3, severity: 0..1. Returns [0..255]x3.
  function simulate(rgb, type, severity) {
    if (severity === undefined) severity = 1;
    const lin = rgb.map((c) => srgbToLinear(c / 255));
    let sim;
    if (type === 'achroma') {
      const y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
      sim = [y, y, y];
    } else {
      const m = MACHADO[type];
      sim = [
        m[0] * lin[0] + m[1] * lin[1] + m[2] * lin[2],
        m[3] * lin[0] + m[4] * lin[1] + m[5] * lin[2],
        m[6] * lin[0] + m[7] * lin[1] + m[8] * lin[2],
      ].map((c) => clamp(c, 0, 1));
    }
    const out = lin.map((c, i) => c * (1 - severity) + sim[i] * severity);
    return out.map((c) => linearToSrgb(c) * 255);
  }

  // ---------- CIELAB & ΔE2000 ----------
  function rgbToLab(rgb) {
    const [r, g, b] = rgb.map((c) => srgbToLinear(clamp(c, 0, 255) / 255));
    const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
    const Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
    const Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
    const e = 216 / 24389, k = 24389 / 27;
    const f = (t) => (t > e ? Math.cbrt(t) : (k * t + 16) / 116);
    const fx = f(X), fy = f(Y), fz = f(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  function deltaE2000(lab1, lab2) {
    const [L1, a1, b1] = lab1, [L2, a2, b2] = lab2;
    const rad = Math.PI / 180, deg = 180 / Math.PI;
    const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
    const Cb7 = Math.pow((C1 + C2) / 2, 7);
    const G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + Math.pow(25, 7))));
    const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
    const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
    const hue = (b, a) => {
      if (b === 0 && a === 0) return 0;
      const h = Math.atan2(b, a) * deg;
      return h < 0 ? h + 360 : h;
    };
    const h1p = hue(b1, a1p), h2p = hue(b2, a2p);
    const dLp = L2 - L1, dCp = C2p - C1p;
    let dhp = 0;
    if (C1p * C2p !== 0) {
      dhp = h2p - h1p;
      if (dhp > 180) dhp -= 360;
      else if (dhp < -180) dhp += 360;
    }
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
    const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
    let hbp;
    if (C1p * C2p === 0) hbp = h1p + h2p;
    else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
    else hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
    const T = 1
      - 0.17 * Math.cos((hbp - 30) * rad)
      + 0.24 * Math.cos(2 * hbp * rad)
      + 0.32 * Math.cos((3 * hbp + 6) * rad)
      - 0.20 * Math.cos((4 * hbp - 63) * rad);
    const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
    const Cbp7 = Math.pow(Cbp, 7);
    const Rc = 2 * Math.sqrt(Cbp7 / (Cbp7 + Math.pow(25, 7)));
    const Sl = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
    const Sc = 1 + 0.045 * Cbp;
    const Sh = 1 + 0.015 * Cbp * T;
    const Rt = -Math.sin(2 * dTheta * rad) * Rc;
    return Math.sqrt(
      Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2) + Rt * (dCp / Sc) * (dHp / Sh)
    );
  }

  const deltaE = (rgb1, rgb2) => deltaE2000(rgbToLab(rgb1), rgbToLab(rgb2));

  // ΔE as seen by a colorblind viewer (both colors simulated first)
  function deltaESim(rgb1, rgb2, type, severity) {
    return deltaE(simulate(rgb1, type, severity), simulate(rgb2, type, severity));
  }

  // ---------- Color names ----------
  const COLOR_NAMES = [
    ['紅', '#FF0000'], ['深紅', '#8B0000'], ['酒紅', '#800020'], ['磚紅', '#B22222'],
    ['橘紅', '#FF4500'], ['珊瑚紅', '#FF7F50'], ['鮭魚粉', '#FA8072'], ['粉紅', '#FFC0CB'],
    ['桃紅', '#FF1493'], ['洋紅', '#FF00FF'], ['紫', '#800080'], ['淡紫', '#C8A2C8'],
    ['薰衣草紫', '#E6E6FA'], ['藍紫', '#8A2BE2'], ['藍', '#0000FF'], ['深藍', '#00008B'],
    ['海軍藍', '#1F2F5F'], ['寶藍', '#4169E1'], ['天藍', '#87CEEB'], ['青', '#00FFFF'],
    ['藍綠', '#008080'], ['湖水綠', '#7FFFD4'], ['薄荷綠', '#98FF98'], ['翡翠綠', '#50C878'],
    ['亮綠', '#00FF00'], ['綠', '#00A000'], ['草綠', '#7CBA3B'], ['深綠', '#006400'],
    ['橄欖綠', '#808000'], ['黃綠', '#9ACD32'], ['黃', '#FFFF00'], ['金黃', '#FFD700'],
    ['土黃', '#C8A951'], ['米色', '#F5F5DC'], ['橘', '#FF8000'], ['棕', '#8B4513'],
    ['咖啡', '#6F4E37'], ['膚色', '#F1C27D'], ['白', '#FFFFFF'], ['淺灰', '#D3D3D3'],
    ['灰', '#808080'], ['深灰', '#404040'], ['黑', '#000000'],
  ].map(([name, hex]) => ({ name, hex, lab: rgbToLab(hexToRgb(hex)) }));

  function nearestColorName(rgb) {
    const lab = rgbToLab(rgb);
    let best = null, bestD = Infinity;
    for (const c of COLOR_NAMES) {
      const d = deltaE2000(lab, c.lab);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best.name;
  }

  // ---------- Placard answer rules ----------
  function decideAnswer(d, th, closeRatio) {
    if (d >= th) return 'correct';
    if (d >= closeRatio * th) return 'close';
    return 'scribble';
  }

  const SIMILAR_PAIRS = [[0, 8], [1, 7], [3, 8], [5, 6], [6, 8], [2, 7], [4, 1], [9, 8]];
  const SIMILAR = {};
  SIMILAR_PAIRS.forEach(([a, b]) => {
    (SIMILAR[a] = SIMILAR[a] || []).push(b);
    (SIMILAR[b] = SIMILAR[b] || []).push(a);
  });
  const ROTATE = { 0: '0', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '9', 7: '7', 8: '8', 9: '6' };

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

  // Generate a "nearly right" misreading of num (string), never equal to num.
  function closeNumber(num, rng) {
    rng = rng || Math.random;
    const methods = {
      swap() {
        const idx = shuffle([...num].map((_, i) => i), rng).find((i) => SIMILAR[num[i]]);
        if (idx === undefined) return null;
        const arr = [...num];
        arr[idx] = String(pick(SIMILAR[num[idx]], rng));
        return arr.join('');
      },
      partial() {
        return num[Math.floor(rng() * num.length)];
      },
      flip() {
        return [...num].reverse().map((d) => ROTATE[d]).join('');
      },
    };
    for (const m of shuffle(Object.keys(methods), rng)) {
      const r = methods[m]();
      if (r && r !== num) return r;
    }
    return num[0] === num[1] ? '?' : num[1];
  }

  // ---------- Vision self-test (difficulty Z) ----------
  // Threshold-adjustment test: along each axis the player raises the colour difference
  // until the number appears. The axis with an elevated threshold (relative to the
  // player's own luminance baseline) reveals the type; the elevation gives the severity.
  // Difficulty Z = the author's own vision, measured with the self-test below
  // Measured 2026-10-02 (46-trial log): deuteranope, personal detection threshold ~12 ΔE
  const Z_LEVEL = {
    short: 'Z', record: '亂開已佔用廁格，社會性死亡',
    vision: { type: 'deutan', severity: 1, impostorTh: 12 },
  };
  // Linear-RGB greys the test pairs are centred on (varying brightness)
  const VISION_BASES = { mid: [0.22, 0.22, 0.22], light: [0.42, 0.42, 0.42], dark: [0.11, 0.11, 0.11] };
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (v) => { const n = Math.hypot(v[0], v[1], v[2]); return v.map((x) => x / n); };
  const rows3 = (m) => [m.slice(0, 3), m.slice(3, 6), m.slice(6, 9)];
  const mulv = (m, v) => rows3(m).map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
  function nullVector(m) {
    const r = rows3(m);
    const mag = (v) => Math.hypot(...mulv(m, v));
    return [cross3(r[0], r[1]), cross3(r[0], r[2]), cross3(r[1], r[2])].map(unit).sort((a, b) => mag(a) - mag(b))[0];
  }
  // Linear operator of an anomalous viewer at severity s (before clamping)
  const severityMatrix = (m, s) => m.map((x, i) => x * s + ((i % 4 === 0) ? 1 - s : 0));
  // Direction that viewer A sees much worse than viewer B (both at severity s)
  function discriminator(ma, mb, s) {
    const A = severityMatrix(ma, s), B = severityMatrix(mb, s);
    let best = null, bestR = -1;
    const n = 6000, golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
      const v = [Math.cos(th) * r, y, Math.sin(th) * r];
      const ratio = Math.hypot(...mulv(B, v)) / Math.max(1e-9, Math.hypot(...mulv(A, v)));
      if (ratio > bestR) { bestR = ratio; best = v; }
    }
    return best;
  }
  // Directions a full dichromat of each type cannot see, two red/green discriminators
  // (seen poorly by one red/green type but well by the other), plus a luminance baseline
  const VISION_AXES = {
    protan: nullVector(MACHADO.protan),
    deutan: nullVector(MACHADO.deutan),
    tritan: nullVector(MACHADO.tritan),
    pOnly: discriminator(MACHADO.protan, MACHADO.deutan, 0.6),
    dOnly: discriminator(MACHADO.deutan, MACHADO.protan, 0.6),
    lum: unit([1, 1, 1]),
  };
  const VISION_AXIS_IDS = Object.keys(VISION_AXES);
  const toSrgb255 = (lin) => lin.map((c) => linearToSrgb(c) * 255);
  function visionPair(axis, t, base) {
    const v = VISION_AXES[axis], c0 = VISION_BASES[base || 'mid'];
    return {
      fg: toSrgb255(c0.map((c, i) => c + (t / 2) * v[i])),
      bg: toSrgb255(c0.map((c, i) => c - (t / 2) * v[i])),
    };
  }
  const TMAX_CACHE = {};
  function visionTmax(axis, base) {
    const key = axis + '/' + (base || 'mid');
    if (TMAX_CACHE[key] == null) {
      const v = VISION_AXES[axis], c0 = VISION_BASES[base || 'mid'];
      let t = 0;
      while (c0.every((c, i) => c + ((t + 0.002) / 2) * v[i] <= 1 && c - ((t + 0.002) / 2) * v[i] >= 0)) t += 0.002;
      TMAX_CACHE[key] = t;
    }
    return TMAX_CACHE[key];
  }
  const VISION_TMAX = {};
  for (const a of VISION_AXIS_IDS) VISION_TMAX[a] = visionTmax(a, 'mid');
  // Pair along an axis whose normal-vision ΔE equals targetDE (null if out of gamut)
  function visionPairForNormalDE(axis, base, targetDE) {
    let lo = 0, hi = visionTmax(axis, base);
    const p0 = visionPair(axis, hi, base);
    if (deltaE(p0.fg, p0.bg) < targetDE) return null;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2, p = visionPair(axis, mid, base);
      if (deltaE(p.fg, p.bg) >= targetDE) hi = mid; else lo = mid;
    }
    return Object.assign({ t: hi }, visionPair(axis, hi, base));
  }
  const VISION_CANDIDATES = [{ type: 'normal', severity: 0 }];
  for (const type of ['protan', 'deutan', 'tritan']) {
    for (let k = 2; k <= 20; k++) VISION_CANDIDATES.push({ type, severity: k / 20 });
  }
  const perceived = (cand, p) => (cand.type === 'normal' ? deltaE(p.fg, p.bg) : deltaESim(p.fg, p.bg, cand.type, cand.severity));

  // trials: [{ axis, t, censored }] -> best-fitting vision model
  function fitVision(trials) {
    const scored = [];
    for (const c of VISION_CANDIDATES) {
      const ds = trials.map((tr) => Math.log(Math.max(0.05, perceived(c, visionPair(tr.axis, tr.t, tr.base)))));
      const unc = ds.filter((_, i) => !trials[i].censored);
      if (!unc.length) continue;
      const th = unc.reduce((a, b) => a + b, 0) / unc.length;
      let err = 0;
      ds.forEach((d, i) => {
        if (!trials[i].censored || d > th) err += (d - th) * (d - th);
      });
      scored.push(Object.assign({}, c, { err, theta: Math.exp(th) }));
    }
    scored.sort((a, b) => a.err - b.err);
    const best = scored[0];
    const rival = scored.find((c) => c.type !== best.type && c.type !== 'normal' && best.type !== 'normal');
    // Red/green ambiguity when the other red-green type fits almost as well
    const ambiguous = !!rival && ['protan', 'deutan'].includes(best.type) && ['protan', 'deutan'].includes(rival.type)
      && rival.err < best.err * 1.25 + 0.02;
    const result = { type: best.type, severity: best.severity, theta: best.theta, ambiguous };
    if (best.type !== 'normal' && best.severity < 0.2) { result.type = 'normal'; result.severity = 0; }
    return result;
  }

  // Colour pair along the viewer's own axis that they perceive as ΔE = targetDE
  function visionDemoPair(type, severity, targetDE) {
    let lo = 0, hi = VISION_TMAX[type];
    const cand = { type, severity };
    if (perceived(cand, visionPair(type, hi)) <= targetDE) return visionPair(type, hi);
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (perceived(cand, visionPair(type, mid)) > targetDE) hi = mid; else lo = mid;
    }
    return visionPair(type, lo);
  }

  // Can any card beat this impostor? (normal ΔE >= worst-case normal threshold while
  // impostor ΔE < best-case impostor threshold)
  function zFeasible(type, severity, cfg) {
    const needN = cfg.normalTh + 2, needI = cfg.impostorTh - 1;
    for (let t = 0.01; t <= VISION_TMAX[type]; t += 0.01) {
      const p = visionPair(type, t);
      if (deltaESim(p.fg, p.bg, type, severity) >= needI) break;
      if (deltaE(p.fg, p.bg) >= needN) return true;
    }
    return false;
  }

  // Impostor threshold used in difficulty Z: the configured one, or the smallest
  // raise (0.5 steps) that makes a winning card possible for a mild viewer.
  function zImpostorTh(type, severity, cfg) {
    for (let th = cfg.impostorTh; th <= 40; th += 0.5) {
      if (zFeasible(type, severity, Object.assign({}, cfg, { impostorTh: th }))) return th;
    }
    return 40;
  }

  // ---------- Config & round ----------
  const DEFAULT_CONFIG = {
    type: 'random',       // 'random' | type id
    suspects: 5,          // 3..7
    impostors: 'random',  // 'random' (1~2) | '1' | '2' | '3'
    revealCount: false,
    normalTh: 9,
    impostorTh: 5.5,
    severity: '100',      // '100' | '90' | '75'  (lower bound in %)
    closeRatio: 0.5,
    timerOn: true,
    timerSec: 30,
    showDE: false,
  };

  function impostorCount(cfg, rng) {
    const n = cfg.impostors === 'random' ? 1 + Math.floor(rng() * 2) : parseInt(cfg.impostors, 10);
    return clamp(n, 1, cfg.suspects - 1);
  }

  // characterIds: pool of character ids to draw from
  function createRound(cfg, characterIds, rng) {
    rng = rng || Math.random;
    const type = cfg.type === 'random' ? pick(TYPE_IDS, rng) : cfg.type;
    const n = clamp(cfg.suspects | 0, 3, 7);
    const nImp = impostorCount(Object.assign({}, cfg, { suspects: n }), rng);
    const chars = shuffle(characterIds, rng).slice(0, n);
    const impIdx = new Set(shuffle(chars.map((_, i) => i), rng).slice(0, nImp));
    const sevLo = parseInt(cfg.severity, 10) / 100;
    const suspects = chars.map((charId, i) => {
      const isImpostor = impIdx.has(i);
      return {
        no: i + 1,
        charId,
        isImpostor,
        threshold: isImpostor
          ? cfg.impostorTh + (rng() * 2 - 1)
          : cfg.normalTh + (rng() * 4 - 2),
        severity: isImpostor ? (cfg.fixedSeverity != null ? cfg.fixedSeverity : sevLo + rng() * (1 - sevLo)) : 0,
      };
    });
    return { type, suspects, impostorCount: nImp, number: pick(NUMBER_POOL, rng) };
  }

  // Compute every suspect's perceived ΔE and placard answer kind for a card.
  function evaluateCard(round, fgRgb, bgRgb, cfg, rng) {
    rng = rng || Math.random;
    const dNormal = deltaE(fgRgb, bgRgb);
    return round.suspects.map((s) => {
      const d = s.isImpostor ? deltaESim(fgRgb, bgRgb, round.type, s.severity) : dNormal;
      const kind = decideAnswer(d, s.threshold, cfg.closeRatio);
      const close = kind === 'close' ? closeNumber(round.number, rng) : null;
      return { no: s.no, d, th: s.threshold, kind, close };
    });
  }

  const api = {
    TYPES, TYPE_IDS, LEVEL_ORDER, NUMBER_POOL, DEFAULT_CONFIG, COLOR_NAMES,
    clamp, hexToRgb, rgbToHex, hsvToRgb, rgbToHsv, srgbToLinear, linearToSrgb,
    simulate, rgbToLab, deltaE2000, deltaE, deltaESim, nearestColorName,
    decideAnswer, closeNumber, shuffle, pick, createRound, evaluateCard,
    Z_LEVEL, VISION_AXES, VISION_AXIS_IDS, VISION_BASES, VISION_TMAX, visionTmax, visionPair, visionPairForNormalDE, fitVision, visionDemoPair, zFeasible, zImpostorTh,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof window !== 'undefined' ? window : globalThis);

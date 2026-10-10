/* UI, flow and animation. Judgement math lives in core.js. */
(() => {
  'use strict';
  const C = window.Core;
  const CH = window.Characters;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const fmt = (x) => x.toFixed(1);
  const css = (rgb) => `rgb(${rgb.map((c) => Math.round(C.clamp(c, 0, 255))).join(',')})`;

  const PLATE_BG = [236, 230, 216];
  const CHARACTER_IDS = CH.CHARACTERS.map((c) => c.id);

  const REACTIONS = [
    { cls: 'r-squint', say: '（瞇眼）' },
    { cls: 'r-tilt', say: '嗯……？' },
    { cls: 'r-turn', say: '轉 90 度看看' },
    { cls: 'r-lean', say: '湊近一點…' },
    { cls: 'r-nod', say: '簡單啦 😎' },
    { cls: 'r-peek', say: '（偷瞄隔壁）' },
    { cls: 'r-shrug', say: '🤷' },
    { cls: 'r-gasp', say: '哇喔！' },
  ];

  // ---------- Config ----------
  // Fixed release values (the planner parameter panel has been removed)
  const cfg = Object.assign({}, C.DEFAULT_CONFIG);

  // ---------- State ----------
  const S = {
    screen: null, round: null, plate: null,
    slots: { fg: { h: 0, s: 1, v: 1 }, bg: { h: 0, s: 1, v: 1 } }, active: 'fg',
    timerId: null, timeLeft: 0, results: null, answers: null,
    arrested: new Set(), phase: 'idle', scale: 1, token: 0,
  };

  // ---------- Stage scaling ----------
  const stage = $('#stage');
  function fitStage() {
    S.scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    stage.style.transform = `translate(-50%, -50%) scale(${S.scale})`;
  }
  window.addEventListener('resize', fitStage);
  const dpr = () => Math.min(3, (window.devicePixelRatio || 1) * Math.max(1, S.scale));

  // ---------- Ishihara plate ----------
  function generatePlate(num, noJitter) {
    const dots = [];
    const rmax = 0.05, rmin = 0.013, gap = 0.006, N = 16000;
    const cell = 0.11, gridN = Math.ceil(2 / cell) + 1;
    const grid = new Map();
    const key = (gx, gy) => gx * gridN + gy;
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const r = Math.max(rmin * 0.85, (rmax - (rmax - rmin) * Math.sqrt(t)) * rnd(0.8, 1.2));
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * (0.97 - r);
      const x = Math.cos(ang) * dist, y = Math.sin(ang) * dist;
      const gx = Math.floor((x + 1) / cell), gy = Math.floor((y + 1) / cell);
      let hit = false;
      for (let ix = gx - 1; ix <= gx + 1 && !hit; ix++) {
        for (let iy = gy - 1; iy <= gy + 1 && !hit; iy++) {
          const list = grid.get(key(ix, iy));
          if (!list) continue;
          for (const o of list) {
            if (Math.hypot(o.x - x, o.y - y) < o.r + r + gap) { hit = true; break; }
          }
        }
      }
      if (hit) continue;
      const d = { x, y, r, j: noJitter ? 0 : rnd(-0.08, 0.08), fig: false };
      dots.push(d);
      const k = key(gx, gy);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(d);
    }
    // Digit mask
    const M = 240;
    const mc = document.createElement('canvas');
    mc.width = mc.height = M;
    const mx = mc.getContext('2d', { willReadFrequently: true });
    mx.translate(M / 2, M / 2 + 6);
    mx.rotate(rnd(-0.08, 0.08));
    mx.fillStyle = '#000';
    mx.font = '900 138px "Arial Black", Arial, sans-serif';
    mx.textAlign = 'center';
    mx.textBaseline = 'middle';
    mx.fillText(num, 0, 0);
    const px = mx.getImageData(0, 0, M, M).data;
    for (const d of dots) {
      const ix = Math.round((d.x * 0.5 + 0.5) * M), iy = Math.round((d.y * 0.5 + 0.5) * M);
      d.fig = px[(iy * M + ix) * 4 + 3] > 110;
    }
    return { num, dots };
  }

  // sim: null (normal vision) or { type, severity }
  function renderPlate(cv, plate, fg, bg, sim, size) {
    const k = dpr();
    cv.width = cv.height = Math.round(size * k);
    cv.style.width = cv.style.height = size + 'px';
    const ctx = cv.getContext('2d');
    const R = cv.width / 2;
    const tone = (rgb) => (sim ? C.simulate(rgb, sim.type, sim.severity) : rgb);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = css(tone(PLATE_BG));
    ctx.beginPath(); ctx.arc(R, R, R, 0, Math.PI * 2); ctx.fill();
    for (const d of plate.dots) {
      const base = d.fig ? fg : bg;
      const col = base.map((c) => C.clamp(c * (1 + d.j), 0, 255));
      ctx.fillStyle = css(tone(col));
      ctx.beginPath(); ctx.arc(R + d.x * R, R + d.y * R, d.r * R, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---------- Title logo: bold glyphs filled with colour-test dots ----------
  // Dots are clipped to the glyph shape, so the title reads clearly whatever the dot size.
  const TITLE_DOTS = ['#E2453C', '#F08A3C', '#F6C03A', '#F3A33B', '#6FAE5A', '#3F8F4F', '#C9502E', '#9BC25A'];
  const TITLE_SIZE = { w: 640, h: 178 };
  function drawTitlePlate() {
    const cv = $('#titlePlate');
    const k = dpr(), Wc = TITLE_SIZE.w, Hc = TITLE_SIZE.h;
    cv.width = Math.round(Wc * k); cv.height = Math.round(Hc * k);
    cv.style.width = Wc + 'px'; cv.style.height = Hc + 'px';
    const W = cv.width, H = cv.height;
    const font = `bold ${Math.round(152 * k)}px "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif`;
    const glyphs = [['色', 0.31], ['偽', 0.69]];
    const yMid = H * 0.48;
    // Glyph shape on its own canvas; `extra` strokes outward (outline / shadow only, so dense
    // characters like 偽 keep their gaps)
    const shape = (extra, color, dy) => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d');
      x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = x.strokeStyle = color; x.lineJoin = 'round'; x.lineWidth = extra * k;
      for (const [ch, cx] of glyphs) {
        x.fillText(ch, W * cx, yMid + dy * k);
        if (extra > 0) x.strokeText(ch, W * cx, yMid + dy * k);
      }
      return c;
    };
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(shape(7, '#15213d', 6), 0, 0); // flat drop shadow
    ctx.drawImage(shape(7, '#22345c', 0), 0, 0); // outline
    ctx.drawImage(shape(0, '#fbf8f1', 0), 0, 0); // white fill
    // dot layer clipped to the fill shape
    const dots = document.createElement('canvas');
    dots.width = W; dots.height = H;
    const dx = dots.getContext('2d');
    const rmax = 9 * k, rmin = 2.6 * k, gap = 1.8 * k, cell = rmax * 2 + gap;
    const cols = Math.ceil(W / cell) + 1, grid = new Map(), N = 20000;
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const r = Math.max(rmin, (rmax - (rmax - rmin) * Math.sqrt(t)) * rnd(0.75, 1.15));
      const x = rnd(0, W), y = rnd(0, H);
      const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      let hit = false;
      for (let ix = gx - 1; ix <= gx + 1 && !hit; ix++) {
        for (let iy = gy - 1; iy <= gy + 1 && !hit; iy++) {
          const list = grid.get(iy * cols + ix);
          if (list) for (const o of list) if (Math.hypot(o.x - x, o.y - y) < o.r + r + gap) { hit = true; break; }
        }
      }
      if (hit) continue;
      const key = gy * cols + gx;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push({ x, y, r });
      dx.fillStyle = C.pick(TITLE_DOTS, Math.random);
      dx.beginPath(); dx.arc(x, y, r, 0, Math.PI * 2); dx.fill();
    }
    dx.globalCompositeOperation = 'destination-in';
    dx.drawImage(shape(0, '#000', 0), 0, 0);
    ctx.drawImage(dots, 0, 0);
  }

  // ---------- Colorblind illustration card (4.6) ----------
  const demoPlates = {};
  // o: { key, title, num, fg, bg, sim: {type, severity}, capA, capB }
  function buildDemoCard(el, o, size) {
    if (!demoPlates[o.key]) demoPlates[o.key] = generatePlate(o.num);
    el.innerHTML = `<div class="demo-title">${o.title}</div>
      <div class="demo-row">
        <figure><canvas></canvas><figcaption>${o.capA}</figcaption></figure>
        <figure><canvas></canvas><figcaption>${o.capB}</figcaption></figure>
      </div>`;
    const [a, b] = $$('canvas', el);
    renderPlate(a, demoPlates[o.key], o.fg, o.bg, null, size);
    renderPlate(b, demoPlates[o.key], o.fg, o.bg, o.sim, size);
  }
  function typeDemo(type) {
    const t = C.TYPES[type];
    return {
      key: type, title: t.name, num: t.example.num, fg: C.hexToRgb(t.example.fg), bg: C.hexToRgb(t.example.bg),
      sim: { type, severity: 1 }, capA: '你看到的', capB: `${t.name}偽人看到的`,
    };
  }
  function zDemo(v) {
    const p = C.visionDemoPair(v.type, v.severity, 2.2);
    return {
      key: 'z-' + v.type + v.severity, title: `Z（${visionText(v)}）`, num: C.TYPES[v.type].example.num,
      fg: p.fg, bg: p.bg, sim: { type: v.type, severity: v.severity }, capA: '你看到的', capB: 'Z 看到的',
    };
  }

  // ---------- Difficulty Z ----------
  const visionText = (v) => `${C.TYPES[v.type].name} ${Math.round(v.severity * 100)}%`;

  // ---------- Screens ----------
  function showScreen(id) {
    S.screen = id;
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + id));
    $('#timer').hidden = id !== 'mix' || !cfg.timerOn;
    window.Music.setMode(id === 'mix' || id === 'lineup' ? 'tense' : 'calm');
  }

  function impostorText() {
    return cfg.revealCount ? `混入 <b>${S.round.impostorCount}</b> 名偽人` : '偽人數量<b>未知</b>';
  }


  // ---------- 0. Difficulty select ----------
  function buildLevelCards() {
    // Buttons only show the difficulty number 1-5; the colour-blind type is revealed in the briefing
    // Each difficulty is a case folder; only its top half shows, the code is revealed in the briefing
    const ids = C.LEVEL_ORDER.concat('z');
    $('#levelRow').innerHTML = ids.map((id, i) => {
      const n = i + 1, lv = id === 'z' ? 'z' : C.TYPES[id].level;
      const code = id === 'z' ? C.Z_LEVEL.short : C.TYPES[id].short;
      // the code line sits where the next folder overlaps, so only its top half peeks out
      return `<button class="level-card lv${lv}" data-type="${id}" data-sfx="select" aria-label="機密文件${n}">
        <span class="fb-tab">機密文件${n}</span>
        <span class="fb-body"><span class="fb-line"><span class="fb-label">代號</span><b class="fb-num">${code}</b></span><span class="fb-sticker"></span></span>
      </button>`;
    }).join('');
    $$('.level-card').forEach((b) => b.addEventListener('click', () => startCase(b.dataset.type)));
  }
  function newRound() {
    S.token++;
    stopTimer();
    S.round = null;
    S.phase = 'idle';
    showScreen('select');
  }

  // ---------- 1. Briefing ----------
  function startCase(level) {
    S.token++;
    stopTimer();
    const v = level === 'z' ? C.Z_LEVEL.vision : null;
    const type = v ? v.type : level;
    const impTh = v ? C.zImpostorTh(v.type, v.severity, Object.assign({}, cfg, { impostorTh: v.impostorTh || cfg.impostorTh })) : cfg.impostorTh;
    const roundCfg = Object.assign({}, cfg, { type, impostorTh: impTh }, v ? { fixedSeverity: v.severity } : {});
    S.round = C.createRound(roundCfg, CHARACTER_IDS);
    S.round.z = v;
    S.round.impTh = impTh;
    S.plate = generatePlate(S.round.number);
    const h = rnd(0, 360), sat = rnd(0.45, 1), val = rnd(0.55, 1);
    S.slots.fg = { h, s: sat, v: val };
    S.slots.bg = { h, s: sat, v: val };
    S.active = 'fg';
    S.results = null;
    S.arrested = new Set();
    S.phase = 'idle';
    const t = C.TYPES[S.round.type];
    // same label as the folder picked on the select screen (機密文件1-5)
    $('#briefTab').textContent = `機密文件${level === 'z' ? C.LEVEL_ORDER.length + 1 : C.LEVEL_ORDER.indexOf(level) + 1}`;
    $('#briefCode').textContent = v ? C.Z_LEVEL.short : t.short;
    $('#briefRecord').textContent = v ? C.Z_LEVEL.record : t.record;
    // replay the "guilty" rubber stamp every time a case file is opened
    const stamp = $('#guiltyStamp');
    stamp.classList.remove('stamped');
    void stamp.offsetWidth;
    stamp.classList.add('stamped');
    setTimeout(() => window.Music.sfx('confirm'), 380);
    $('#briefTypeDesc').textContent = t.desc.replace(/。$/, '') + (v ? `（${visionText(v)}）` : '');
    const zn = $('#briefZNote');
    zn.hidden = !(v && impTh !== cfg.impostorTh);
    zn.textContent = `Z 的辨識門檻採作者實測值 ${impTh}（其他難度的偽人是 ${cfg.impostorTh}），一般人看得清楚的卡，Z 也可能看不到。`;
    $('#briefCount').innerHTML = `嫌犯 ${S.round.suspects.length} 人，${impostorText()}`;
    $('#briefTimeRule').textContent = cfg.timerOn
      ? `只有一次調色機會，${cfg.timerSec}秒內完成你的檢測卡。`
      : '只有一次調色機會，完成你的檢測卡。';
    buildDemoCard($('#briefDemo'), v ? zDemo(v) : typeDemo(type), 250);
    showScreen('brief');
    fitRecordLine();
  }

  // Keep the crime record on one line (shrinking the font if needed) so the stamp always sits on its last character;
  // STAMP_ROOM leaves space for the stamp so it only just kisses the folder edge
  const STAMP_ROOM = 50;
  function fitRecordLine() {
    const rec = $('#briefRecord'), dd = rec.parentElement;
    let size = 19;
    dd.style.fontSize = '';
    while (rec.offsetWidth > dd.clientWidth - STAMP_ROOM && size > 15) dd.style.fontSize = `${--size}px`;
  }

  // ---------- 2. Mixing ----------
  const slotRgb = (k) => {
    const o = S.slots[k];
    return C.hsvToRgb(o.h, o.s, o.v);
  };

  function startMix() {
    showScreen('mix');
    const t = C.TYPES[S.round.type];
    const zv = S.round.z;
    $('#mixMission').innerHTML = `
      <div class="m-type"><span class="tag">${zv ? 'Z' : t.name}</span>偽人混在 ${S.round.suspects.length} 名嫌犯裡</div>
      <div class="m-block"><div class="m-label">偽人的破綻</div>${t.desc}${zv ? `（${visionText(zv)}）` : ''}</div>
      <div class="m-block"><div class="m-label">任務目標</div><b>一般人看得出數字、偽人看不出來</b></div>
      <ul class="m-tips">
        <li>太接近：連一般人都看不清楚，會抓錯人</li>
        <li>不夠接近：偽人也看得出來，會混過去</li>
        <li>先點選要調的顏色槽，再用色盤與深淺滑桿調色</li>
      </ul>`;
    requestRender();
    startTimer();
  }

  // Wheel
  const WHEEL = 260;
  function drawWheel() {
    const cv = $('#wheel');
    const k = dpr();
    const W = Math.round(WHEEL * k);
    cv.width = cv.height = W;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, W);
    const R = W / 2;
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - R, dy = y + 0.5 - R;
        const dist = Math.hypot(dx, dy) / R;
        const i = (y * W + x) * 4;
        if (dist > 1) continue;
        const h = (Math.atan2(dy, dx) * 180) / Math.PI;
        const rgb = C.hsvToRgb(h, dist, 1);
        img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2];
        img.data[i + 3] = C.clamp((1 - dist) * R, 0, 1) * 255; // anti-aliased rim
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function wheelPick(e) {
    const rect = $('#wheel').getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    const slot = S.slots[S.active];
    slot.s = Math.min(1, Math.hypot(x, y));
    slot.h = (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
    requestRender();
  }

  let rafPending = false;
  function requestRender() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; renderMix(); });
  }

  function renderMix() {
    if (S.screen !== 'mix') return;
    const fg = slotRgb('fg'), bg = slotRgb('bg');
    renderPlate($('#plateMain'), S.plate, fg, bg, null, 420);
    // slots
    for (const k of ['fg', 'bg']) {
      const btn = $(`.slot[data-slot="${k}"]`);
      const rgb = slotRgb(k);
      btn.classList.toggle('active', S.active === k);
      $('.sw', btn).style.background = css(rgb);
      // fixed two lines (name / hex) so the slot never changes height while dragging
      const sm = $('small', btn);
      sm.children[0].textContent = C.nearestColorName(rgb);
      sm.children[1].textContent = C.rgbToHex(rgb);
    }
    // wheel marker + tooltip
    const a = S.slots[S.active];
    const mx = (0.5 + (a.s * Math.cos((a.h * Math.PI) / 180)) / 2) * WHEEL;
    const my = (0.5 + (a.s * Math.sin((a.h * Math.PI) / 180)) / 2) * WHEEL;
    const marker = $('#wheelMarker'), tip = $('#wheelTip');
    marker.style.left = mx + 'px'; marker.style.top = my + 'px';
    tip.style.left = mx + 'px'; tip.style.top = my + 'px';
    const activeRgb = slotRgb(S.active);
    tip.textContent = C.nearestColorName(activeRgb);
    // value slider
    const range = $('#vRange');
    range.value = Math.round(a.v * 100);
    range.style.background = `linear-gradient(to right, #000, ${css(C.hsvToRgb(a.h, a.s, 1))})`;
    // ΔE readout
    const ro = $('#deReadout');
    ro.hidden = !cfg.showDE;
    if (cfg.showDE) {
      const sev = S.round.z ? S.round.z.severity : 1;
      const dn = C.deltaE(fg, bg), di = C.deltaESim(fg, bg, S.round.type, sev);
      ro.innerHTML = `一般人 ΔE <b>${fmt(dn)}</b>（門檻 ${cfg.normalTh}±2）｜偽人 ΔE <b>${fmt(di)}</b>（門檻 ${S.round.impTh}±1，程度 ${Math.round(sev * 100)}%）`;
    }
  }

  function bindMix() {
    const cv = $('#wheel');
    let dragging = false;
    cv.addEventListener('pointerdown', (e) => { dragging = true; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or already-released pointer */ } wheelPick(e); });
    cv.addEventListener('pointermove', (e) => { if (dragging) wheelPick(e); });
    const end = () => { dragging = false; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    $('#vRange').addEventListener('input', (e) => {
      S.slots[S.active].v = e.target.value / 100;
      requestRender();
    });
    $$('.slot').forEach((b) => b.addEventListener('click', () => { S.active = b.dataset.slot; requestRender(); }));
    $('#btnReroll').addEventListener('click', () => {
      const others = C.NUMBER_POOL.filter((n) => n !== S.round.number);
      S.round.number = C.pick(others, Math.random);
      S.plate = generatePlate(S.round.number);
      requestRender();
    });
    $('#btnSubmit').addEventListener('click', () => submitCard(false));
  }

  // Timer
  function startTimer() {
    stopTimer();
    const el = $('#timer');
    if (!cfg.timerOn || S.screen !== 'mix') { el.hidden = true; return; }
    S.timeLeft = cfg.timerSec;
    el.hidden = false;
    const paint = () => {
      $('#timerNum').textContent = S.timeLeft;
      $('#timerBar').style.width = (S.timeLeft / cfg.timerSec) * 100 + '%';
      el.classList.toggle('warn', S.timeLeft <= 10);
    };
    paint();
    S.timerId = setInterval(() => {
      S.timeLeft--;
      paint();
      if (S.timeLeft <= 0) { stopTimer(); submitCard(true); }
    }, 1000);
  }
  function stopTimer() {
    if (S.timerId) clearInterval(S.timerId);
    S.timerId = null;
    $('#timer').classList.remove('warn');
  }

  // ---------- Answers ----------
  const DOODLES = {
    smile: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="14" cy="16" r="2.5" fill="currentColor"/><circle cx="26" cy="16" r="2.5" fill="currentColor"/><path d="M11 24 q9 9 18 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    scribble: '<svg viewBox="0 0 40 40"><path d="M4 22 C10 4 16 36 20 18 S30 6 26 24 S12 34 18 12 S36 30 36 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
    heart: '<svg viewBox="0 0 40 40"><path d="M20 34 C4 22 4 8 14 8 C18 8 20 12 20 14 C20 12 22 8 26 8 C36 8 36 22 20 34Z" fill="#e0445c"/></svg>',
  };
  function answerHtml(ans) {
    if (ans.kind !== 'scribble') return `<span class="ans num">${ans.text}</span>`;
    const html = ans.text
      .replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
      .replace(/\{(smile|scribble|heart)\}/g, (_, k) => DOODLES[k])
      .replace(/\n/g, '<br>');
    return `<span class="ans txt">${html}</span>`;
  }

  function submitCard(auto) {
    if (S.screen !== 'mix') return;
    stopTimer();
    const fg = slotRgb('fg'), bg = slotRgb('bg');
    S.card = { fg, bg };
    S.results = C.evaluateCard(S.round, fg, bg, cfg);
    S.answers = S.results.map((r, i) => {
      const ch = CH.BY_ID[S.round.suspects[i].charId];
      if (r.kind === 'correct') return { kind: r.kind, text: S.round.number };
      if (r.kind === 'close') return { kind: r.kind, text: r.close };
      return { kind: r.kind, text: C.pick(ch.scribbles, Math.random) };
    });
    showScreen('lineup');
    runLineup(auto);
  }

  // ---------- 3. Lineup ----------
  const SCENE_H = 656; // lineup scene height in stage pixels (keep in sync with #scene in style.css)
  function pxPerCm(n) {
    return n <= 5 ? 2.2 : n === 6 ? 2.0 : 1.85;
  }

  function buildWall(ppc) {
    const wall = $('#wall');
    const floor = 40;
    let html = `<div class="floor" style="height:${floor}px"></div>`;
    for (let cm = 50; cm <= 250; cm += 10) {
      const y = SCENE_H - floor - cm * ppc;
      if (y < 60) break; // keep the top clear of the floating sound button
      const major = cm % 50 === 0;
      html += `<div class="wline${major ? ' major' : ''}" style="top:${y}px"></div>`;
      html += `<div class="wlabel l" style="top:${y}px">${cm}</div><div class="wlabel r" style="top:${y}px">${cm} cm</div>`;
    }
    wall.innerHTML = html;
  }

  const CROSSHAIR = `<svg viewBox="0 0 100 100"><g fill="none" stroke="#ff2d2d" stroke-width="5"><circle cx="50" cy="50" r="34"/><circle cx="50" cy="50" r="6" fill="#ff2d2d"/><path d="M50 2 v22 M50 76 v22 M2 50 h22 M76 50 h22"/></g></svg>`;

  function buildLineup() {
    const n = S.round.suspects.length;
    const ppc = pxPerCm(n);
    buildWall(ppc);
    const row = $('#lineupRow');
    row.innerHTML = '';
    S.round.suspects.forEach((s, i) => {
      const ch = CH.BY_ID[s.charId];
      const fh = ch.heightCm * ppc;
      const el = document.createElement('div');
      el.className = 'suspect enter';
      el.style.animationDelay = i * 0.12 + 's';
      el.dataset.idx = i;
      el.innerHTML = `
        <div class="fig" style="height:${fh}px;width:${fh / 2}px;--fh:${fh}px;--skin:${ch.skin}">
          ${CH.drawFigure(ch, s.isImpostor)}
          <div class="placard">
            <div class="placard-inner">
              <div class="face front"><span class="no">${s.no}</span><span class="lbl">SUSPECT</span></div>
              <div class="face back">${answerHtml(S.answers[i])}</div>
            </div>
            <span class="hand-dot l"></span><span class="hand-dot r"></span>
          </div>
          <div class="crosshair">${CROSSHAIR}</div>
          <span class="sweat a">💧</span><span class="sweat b">💧</span>
          <div class="stamp ${s.isImpostor ? 'imp' : 'hum'}">${s.isImpostor ? '偽人' : '良民'}</div>
          <div class="bubble"></div>
        </div>`;
      // Name tag pinned near the top of the wall (scene y = 34px)
      const tag = document.createElement('div');
      tag.className = 'name-tag';
      tag.innerHTML = `${i + 1} 號 ${ch.name}<small>${ch.title}</small>`;
      tag.style.top = 34 - (SCENE_H - 40 - fh) + 'px';
      el.appendChild(tag);
      el.addEventListener('click', () => toggleArrest(i));
      row.appendChild(el);
    });
  }

  function say(el, text, ms) {
    const b = $('.bubble', el);
    b.textContent = text;
    b.classList.add('show');
    if (ms) setTimeout(() => b.classList.remove('show'), ms);
  }
  function sceneMsg(text, ms) {
    const m = $('#sceneMsg');
    m.textContent = text;
    m.classList.add('show');
    return sleep(ms).then(() => m.classList.remove('show'));
  }
  const hint = (html) => { $('#lineupHint').innerHTML = html; };

  async function runLineup(auto) {
    const token = S.token;
    const alive = () => token === S.token && S.screen === 'lineup';
    S.phase = 'intro';
    S.arrested = new Set();
    $('#resultModal').hidden = true;
    $('#btnArrest').disabled = true;
    $('#btnArrest').hidden = false;
    const hand = $('#hand');
    hand.className = 'down';
    renderPlate($('#handCard'), S.plate, S.card.fg, S.card.bg, null, 220);
    buildLineup();
    hint(auto ? '⏰ 時間到！檢測卡自動送出。嫌犯入場中…' : '嫌犯入場中…');
    await sleep(1300); if (!alive()) return;

    hint('📣 「各位，看清楚這張卡！」');
    hand.className = 'up';
    await sleep(900); if (!alive()) return;

    // Reactions: everyone draws from the same pool
    const els = $$('.suspect');
    const n = els.length;
    els.forEach((el, i) => {
      const r = C.pick(REACTIONS, Math.random);
      if (r.cls === 'r-peek') {
        const dir = i === 0 ? 1 : i === n - 1 ? -1 : Math.random() < 0.5 ? -1 : 1;
        el.style.setProperty('--peek', dir * 22 + 'px');
        el.style.setProperty('--peekRot', dir * 6 + 'deg');
      }
      setTimeout(() => { el.classList.add(r.cls); say(el, r.say); }, i * 150);
      el.dataset.react = r.cls;
    });
    await sleep(2400 + n * 150); if (!alive()) return;
    els.forEach((el) => { el.classList.remove(el.dataset.react); $('.bubble', el).classList.remove('show'); });

    hand.className = 'rest';
    hint('✍️ 嫌犯正在牌子背面寫答案…');
    await sleep(900); if (!alive()) return;
    for (const el of els) {
      el.classList.add('flipped');
      await sleep(420); if (!alive()) return;
    }
    await sleep(400); if (!alive()) return;

    S.phase = 'choose';
    els.forEach((el) => el.classList.add('pickable'));
    $('#btnArrest').disabled = false;
    updateArrestHint();
  }

  function updateArrestHint() {
    const correct = S.round.number;
    const list = [...S.arrested].sort().map((i) => `${i + 1} 號`).join('、');
    hint(`點嫌犯標記「逮捕」（可複選、可取消、也可都不抓）。正確答案是 <b>${correct}</b>。` +
      (list ? `　目前逮捕：<b>${list}</b>` : '　目前沒有逮捕任何人'));
  }

  function toggleArrest(i) {
    if (S.phase !== 'choose') return;
    const el = $$('.suspect')[i];
    if (S.arrested.has(i)) S.arrested.delete(i);
    else S.arrested.add(i);
    el.classList.toggle('arrested', S.arrested.has(i));
    window.Music.sfx(S.arrested.has(i) ? 'arrest' : 'unarrest');
    updateArrestHint();
  }

  // ---------- 4. Reveal & result ----------
  const REVEAL_LINES = {
    impCaught: ['可惡！被識破了！', '我的頭套！！', '你怎麼知道的？！'],
    impEscaped: ['謝啦警官～', '掰掰囉～', '下次見 😉'],
    humWrong: ['冤枉啊大人！', '我只是來借廁所的！', '我要找律師！'],
    humFree: ['（鬆一口氣）', '我就說吧', '可以回家了嗎？'],
  };

  async function confirmArrest() {
    if (S.phase !== 'choose') return;
    const token = S.token;
    S.phase = 'reveal';
    $('#btnArrest').disabled = true;
    const els = $$('.suspect');
    els.forEach((el) => el.classList.remove('pickable'));
    hint('🔍 揭曉真實身分…');
    await sceneMsg('揭曉真實身分！', 1000);
    for (let i = 0; i < els.length; i++) {
      if (token !== S.token) return;
      const el = els[i];
      const s = S.round.suspects[i];
      const arrested = S.arrested.has(i);
      el.classList.remove('arrested');
      el.classList.add('revealed');
      if (s.isImpostor) {
        el.classList.add('unmask');
        await sleep(500);
        el.classList.add(arrested ? 'cuffed' : 'thumbs');
        say(el, C.pick(arrested ? REVEAL_LINES.impCaught : REVEAL_LINES.impEscaped, Math.random));
      } else {
        if (arrested) el.classList.add('cry');
        say(el, C.pick(arrested ? REVEAL_LINES.humWrong : REVEAL_LINES.humFree, Math.random));
      }
      await sleep(750);
    }
    if (token !== S.token) return;
    await sleep(700);
    showResult();
  }

  function analyze() {
    const sus = S.round.suspects;
    const typeName = C.TYPES[S.round.type].name;
    const reasons = [];
    const wrong = [], missed = [];
    sus.forEach((s, i) => {
      const arrested = S.arrested.has(i);
      if (!s.isImpostor && arrested) wrong.push(i);
      if (s.isImpostor && !arrested) missed.push(i);
    });
    const label = (i) => `${i + 1} 號 ${CH.BY_ID[sus[i].charId].name}`;
    const wrote = (i) => (S.answers[i].kind === 'scribble' ? '亂寫' : `寫「${S.answers[i].text}」`);
    for (const i of wrong) {
      const r = S.results[i];
      if (r.kind !== 'correct') {
        reasons.push({ cls: 'card', text: `抓錯人：${label(i)} 是一般人，但牌子${wrote(i)}——卡片調太接近，連一般人都看不清楚。` });
      } else {
        reasons.push({ cls: 'judge', text: `抓錯人：${label(i)} 的牌子寫對了「${S.round.number}」，你卻逮捕了他——純判斷失誤。` });
      }
    }
    for (const i of missed) {
      const r = S.results[i];
      if (r.kind === 'correct') {
        reasons.push({ cls: 'card', text: `放走偽人：${label(i)} 是偽人，卻寫對了數字——這兩個顏色在${typeName}眼中還分得出來，卡片不夠接近。` });
      } else {
        reasons.push({ cls: 'judge', text: `放走偽人：${label(i)} 是偽人，牌子${wrote(i)}已經露出破綻，你卻放他走——純判斷失誤。` });
      }
    }
    const normalsOk = sus.every((s, i) => s.isImpostor || S.results[i].kind === 'correct');
    const impsOk = sus.every((s, i) => !s.isImpostor || S.results[i].kind !== 'correct');
    let diag;
    if (normalsOk && impsOk) diag = '🟢 卡片診斷：完美檢測卡——一般人全部寫對，偽人全部露餡。';
    else if (!normalsOk && impsOk) diag = '🟡 卡片診斷：調太接近——偽人看不出來，但連部分一般人也看不清楚。';
    else if (normalsOk && !impsOk) diag = `🟡 卡片診斷：不夠接近——一般人都看得到，但有偽人在${typeName}眼中也看得出數字。`;
    else diag = '🔴 卡片診斷：兩頭落空——有一般人看不清、也有偽人看得出來。';
    return { win: wrong.length === 0 && missed.length === 0, wrong, missed, reasons, diag };
  }

  function showResult() {
    S.phase = 'result';
    const a = analyze();
    const title = $('#resTitle');
    title.className = a.win ? 'win' : 'lose';
    title.textContent = a.win ? '🎉 破案！偽人全數落網' : '💥 任務失敗';
    let flavor;
    if (a.win) flavor = C.pick([
      '偽人的頭套掉了一地，本案正式偵破。',
      '局長感動到把自己的布丁分給你。',
      '全警局起立鼓掌，連打瞌睡的老吳都醒了。',
    ], Math.random);
    else if (a.missed.length && a.wrong.length) flavor = '無辜市民被銬走、偽人對你比讚離場。明天頭條就是你。';
    else if (a.missed.length) flavor = '偽人對你比了個讚 👍，大搖大擺走出警局。';
    else flavor = '無辜市民被銬走了，他的律師已經在路上。';
    $('#resFlavor').textContent = flavor;
    $('#resDiag').textContent = a.diag;
    $('#resReasons').innerHTML = a.win
      ? '<li>你逮捕的人和所有偽人完全一致。</li>'
      : a.reasons.map((r) => `<li class="${r.cls}">${r.text}</li>`).join('');

    // Plates: normal view and the (first) impostor's view
    const imp = S.round.suspects.find((s) => s.isImpostor);
    const sev = imp ? imp.severity : 1;
    renderPlate($('#resPlateN'), S.plate, S.card.fg, S.card.bg, null, 350);
    renderPlate($('#resPlateI'), S.plate, S.card.fg, S.card.bg, { type: S.round.type, severity: sev }, 350);
    $('#resPlateICap').textContent = `偽人看到的（${C.TYPES[S.round.type].name} ${Math.round(sev * 100)}%）`;

    $('#resultModal').hidden = false;
    $('#btnArrest').hidden = true;
    hint(a.win ? '🎉 破案！' : '💥 任務失敗——看看結算的原因分析。');
    window.Music.setMode('calm');
    window.Music.stinger(a.win);
  }

  // ---------- Vision self-test screen ----------
  // Phase A: threshold adjustment (slider) along 6 colour axes x 4 brightness bases.
  // Phase B: forced-choice contrast ladder (seen / not seen) along the red & green axes.
  // Every answer is logged and downloadable as JSON for offline analysis.
  const VT_BASES = ['mid', 'light', 'dark', 'mid'];
  const VT_LADDER = [
    ...['protan', 'deutan'].flatMap((axis) => [4, 5, 6, 7, 8, 10, 12, 15, 19, 28].map((de, i) => ({ axis, de, base: i % 2 ? 'light' : 'mid' }))),
    { axis: 'lum', de: 2.5, base: 'mid' }, { axis: 'lum', de: 4, base: 'mid' },
  ];
  const VT = { phase: 'A', order: [], idx: 0, plate: null, t: 0, t0: 0, wrong: [], log: null };
  const GREY = [150, 150, 150];
  const hex = (rgb) => C.rgbToHex(rgb);
  const r2 = (x) => Math.round(x * 100) / 100;

  function openVision() {
    S.token++;
    stopTimer();
    S.round = null;
    $('#visionIntro').hidden = false;
    $('#visionTest').hidden = true;
    $('#visionResult').hidden = true;
    renderPlate($('#visionPlate'), generatePlate('57', true), GREY, GREY, null, 420);
    showScreen('vision');
  }
  function startVisionTest() {
    VT.phase = 'A';
    VT.order = C.shuffle(C.VISION_AXIS_IDS.flatMap((axis) => VT_BASES.map((base) => ({ axis, base }))), Math.random);
    VT.idx = 0;
    VT.log = {
      version: 2,
      startedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      screen: { w: screen.width, h: screen.height, dpr: window.devicePixelRatio || 1 },
      phaseA: [], phaseB: [], fit: null,
    };
    $('#visionIntro').hidden = true;
    $('#visionResult').hidden = true;
    $('#visionTest').hidden = false;
    nextVisionTrial();
  }
  function setPhaseUI() {
    const a = VT.phase === 'A';
    $('#vtRange').hidden = !a;
    $('#vtPhase').textContent = a ? '第一階段：找門檻' : '第二階段：看得到嗎？';
    $('#vtHint').innerHTML = a
      ? '慢慢往右拉，<b>一看到數字就停</b>'
      : '這階段不用拉滑桿：<b>看得到就輸入數字，看不到就按「看不到」</b>';
    $('#vtNone').textContent = a ? '拉到最右邊還是看不到' : '看不到';
  }
  function nextVisionTrial() {
    if (VT.idx >= VT.order.length) {
      if (VT.phase === 'A') {
        VT.phase = 'B';
        VT.order = C.shuffle(VT_LADDER.filter((q) => C.visionPairForNormalDE(q.axis, q.base, q.de)), Math.random);
        VT.idx = 0;
      } else { finishVision(); return; }
    }
    setPhaseUI();
    VT.plate = generatePlate(C.pick(C.NUMBER_POOL, Math.random), true);
    VT.wrong = [];
    VT.t0 = performance.now();
    $('#vtRange').value = 0;
    $('#vtNum').value = '';
    $('#vtMsg').textContent = '';
    const total = C.VISION_AXIS_IDS.length * VT_BASES.length + VT_LADDER.length;
    const done = (VT.phase === 'A' ? 0 : C.VISION_AXIS_IDS.length * VT_BASES.length) + VT.idx;
    $('#vIdx').textContent = done + 1;
    $('#vTotal').textContent = total;
    drawVisionTrial();
    $('#vtNum').focus();
  }
  function currentPair() {
    const q = VT.order[VT.idx];
    if (VT.phase === 'B') return C.visionPairForNormalDE(q.axis, q.base, q.de);
    const x = $('#vtRange').value / 1000;
    VT.t = C.visionTmax(q.axis, q.base) * x * x; // finer control near zero difference
    return C.visionPair(q.axis, VT.t, q.base);
  }
  function drawVisionTrial() {
    const p = currentPair();
    renderPlate($('#visionPlate'), VT.plate, p.fg, p.bg, null, 420);
  }
  function logA(censored) {
    const q = VT.order[VT.idx];
    const t = censored ? C.visionTmax(q.axis, q.base) : VT.t;
    const p = C.visionPair(q.axis, t, q.base);
    VT.log.phaseA.push({
      n: VT.log.phaseA.length + 1, axis: q.axis, base: q.base, t: +t.toFixed(5), censored,
      num: VT.plate.num, fg: hex(p.fg), bg: hex(p.bg), dENormal: r2(C.deltaE(p.fg, p.bg)),
      wrong: VT.wrong, ms: Math.round(performance.now() - VT.t0),
    });
  }
  function logB(typed) {
    const q = VT.order[VT.idx];
    const p = currentPair();
    VT.log.phaseB.push({
      n: VT.log.phaseB.length + 1, axis: q.axis, base: q.base, dENormal: q.de, t: +p.t.toFixed(5),
      num: VT.plate.num, typed, seen: typed === VT.plate.num, fg: hex(p.fg), bg: hex(p.bg),
      ms: Math.round(performance.now() - VT.t0),
    });
  }
  function submitVisionAnswer() {
    const val = $('#vtNum').value.trim();
    if (!val) {
      $('#vtMsg').textContent = VT.phase === 'A'
        ? '請輸入你看到的數字；拉到底還是看不到就按下面的按鈕。'
        : '請輸入你看到的數字；看不到就按「看不到」。';
      return;
    }
    if (VT.phase === 'B') { logB(val); VT.idx++; nextVisionTrial(); return; }
    if (val !== VT.plate.num) {
      VT.wrong.push({ typed: val, t: +VT.t.toFixed(5) });
      $('#vtMsg').textContent = '數字不對，再往右拉一點看看。';
      $('#vtNum').select();
      return;
    }
    logA(false);
    VT.idx++;
    nextVisionTrial();
  }
  function visionNone() {
    if (VT.phase === 'A') logA(true); else logB(null);
    VT.idx++;
    nextVisionTrial();
  }
  function downloadVisionLog() {
    if (!VT.log) return;
    const blob = new Blob([JSON.stringify(VT.log, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const stamp = VT.log.startedAt.replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
    a.href = URL.createObjectURL(blob);
    a.download = `color-vision-log-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function ladderSummary(axis) {
    const rows = VT.log.phaseB.filter((r) => r.axis === axis).sort((x, y) => x.dENormal - y.dENormal);
    return rows.map((r) => `${r.dENormal}${r.seen ? '✔' : '✘'}`).join('　');
  }
  function finishVision() {
    const r = C.fitVision(VT.log.phaseA);
    VT.log.fit = r;
    VT.log.finishedAt = new Date().toISOString();
    try { localStorage.setItem('cbLineup.visionLog.last', JSON.stringify(VT.log)); } catch (e) { /* storage unavailable */ }
    $('#visionTest').hidden = true;
    $('#visionResult').hidden = false;
    const box = $('#visionResultBody');
    const head = r.type === 'normal'
      ? '<div class="v-big">接近一般色覺</div>'
      : `<div class="v-big">${C.TYPES[r.type].name}・程度約 ${Math.round(r.severity * 100)}%</div>
         ${r.ambiguous ? '<p class="v-warn">紅色盲和綠色盲的結果很接近，這次難以區分。</p>' : ''}`;
    box.innerHTML = `${head}
      <p class="v-small">第二階段（一般人看到的色差 → 你是否看得到）<br>
        紅方向：${ladderSummary('protan')}<br>綠方向：${ladderSummary('deutan')}<br>明暗：${ladderSummary('lum')}</p>
      <p class="v-small">目前難度 Z：${visionText(C.Z_LEVEL.vision)}。紀錄檔已下載，交給開發者分析後再更新 Z。</p>
      <p class="v-small">這不是醫療診斷，只代表在這套色盲模擬裡最接近你的設定。</p>`;
    renderPlate($('#visionPlate'), generatePlate('57', true), GREY, GREY, null, 420);
    downloadVisionLog();
  }
  function bindVision() {
    $('#vtStart').addEventListener('click', startVisionTest);
    $('#vtRange').addEventListener('input', drawVisionTrial);
    $('#vtOk').addEventListener('click', submitVisionAnswer);
    $('#vtNum').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitVisionAnswer(); });
    $('#vtNone').addEventListener('click', visionNone);
    $('#vtQuit').addEventListener('click', newRound);
    $('#vtRetest').addEventListener('click', startVisionTest);
    $('#vtDownload').addEventListener('click', downloadVisionLog);
  }

  // ---------- Music toggle ----------
  function renderMuteBtn() {
    const m = window.Music.isMuted();
    const b = $('#btnMute');
    b.textContent = m ? '🔇' : '🔊';
    b.title = m ? '聲音已關閉' : '聲音已開啟';
    b.setAttribute('aria-pressed', String(!m));
  }

  // ---------- Init ----------
  function init() {
    fitStage();
    drawWheel();
    bindMix();
    buildLevelCards();
    bindVision();
    $('#btnStartMix').addEventListener('click', startMix);
    $('#btnBackSelect').addEventListener('click', newRound);
    $('#btnArrest').addEventListener('click', confirmArrest);
    $('#btnAgain').addEventListener('click', newRound);
    // Title screen: click anywhere (or press any key) to go to difficulty select
    $('#scr-title').addEventListener('click', () => { window.Music.sfx('start'); newRound(); });
    // Click sounds: every button plays one (data-sfx picks a specific sound); drag controls blip on press
    document.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('button');
      if (b && !b.disabled) window.Music.sfx(b.dataset.sfx || 'click');
      else if (e.target.closest('#wheel, #vRange, #vtRange')) window.Music.sfx('pick');
    }, true);
    // Browsers only allow audio after a user gesture: start the loop on the first one
    const unlock = () => { window.Music.start(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    $('#btnMute').addEventListener('click', () => { window.Music.setMuted(!window.Music.isMuted()); renderMuteBtn(); });
    renderMuteBtn();
    window.addEventListener('keydown', (e) => { if (S.screen === 'title' && !e.repeat) newRound(); });
    drawTitlePlate();
    showScreen('title');
    // Hidden planner tool: index.html?tool=vision opens the vision self-test (used to measure Z)
    if (new URLSearchParams(location.search).get('tool') === 'vision') openVision();
    // Debug hooks for automated testing
    window.__game = { S, VT, get cfg() { return cfg; }, submitCard, startMix, newRound, startCase, openVision, toggleArrest, confirmArrest };
  }
  init();
})();

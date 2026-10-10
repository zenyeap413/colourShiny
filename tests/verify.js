// Automated acceptance checks for the judgement math.  Run: node tests/verify.js
'use strict';
const C = require('../core.js');

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};
const f2 = (x) => x.toFixed(2);
const cfg = Object.assign({}, C.DEFAULT_CONFIG);
const CHAR_IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

// Seeded RNG so failures are reproducible
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260924);

// --- 1. Example plates (spec 4.6.d / acceptance 7) ---
console.log('\n[1] 範例卡預設值');
for (const id of C.TYPE_IDS) {
  const ex = C.TYPES[id].example;
  const fg = C.hexToRgb(ex.fg), bg = C.hexToRgb(ex.bg);
  const dn = C.deltaE(fg, bg), di = C.deltaESim(fg, bg, id, 1);
  ok(dn > 20 && di <= 3, `${C.TYPES[id].name}: 一般人 ΔE=${f2(dn)}，偽人 ΔE=${f2(di)}（需 ≤3）`);
}

// --- 2. Brute-force wheel search: every type has a passing card (acceptance 1) ---
console.log('\n[2] 暴力搜尋色盤座標（預設參數，最嚴格條件：一般人 ΔE ≥ 11、偽人 ΔE < 4.5）');
const grid = [];
for (let h = 0; h < 360; h += 4)
  for (let s = 0; s <= 1.0001; s += 0.05)
    for (let v = 0.2; v <= 1.0001; v += 0.05) grid.push({ h, s, v, rgb: C.hsvToRgb(h, s, v) });
grid.forEach((g) => (g.lab = C.rgbToLab(g.rgb)));

const goodPairs = {};
for (const id of C.TYPE_IDS) {
  const simLab = grid.map((g) => C.rgbToLab(C.simulate(g.rgb, id, 1)));
  const found = [];
  const t0 = Date.now();
  for (let k = 0; k < 1500000 && found.length < 5; k++) {
    const i = (rng() * grid.length) | 0, j = (rng() * grid.length) | 0;
    const a = simLab[i], b = simLab[j];
    // Cheap Euclidean prefilter before ΔE2000
    if (Math.abs(a[0] - b[0]) > 6 || Math.hypot(a[1] - b[1], a[2] - b[2]) > 12) continue;
    const di = C.deltaE2000(a, b);
    if (di >= 4.5) continue;
    const dn = C.deltaE2000(grid[i].lab, grid[j].lab);
    if (dn >= 11) found.push({ i, j, dn, di });
  }
  const best = found.sort((x, y) => y.dn - y.di - (x.dn - x.di))[0];
  ok(!!best, `${C.TYPES[id].name}: 找到 ${found.length} 組可過關的卡（${Date.now() - t0}ms）` +
    (best ? `，例：圖案 ${C.rgbToHex(grid[best.i].rgb)}／背景 ${C.rgbToHex(grid[best.j].rgb)}，一般人 ${f2(best.dn)}／偽人 ${f2(best.di)}` : ''));
  if (best) goodPairs[id] = [grid[best.i].rgb, grid[best.j].rgb];
}

// --- 3. Answer rules across many random rounds ---
console.log('\n[3] 牌子答案規則（每種情境 × 每種色盲 × 300 局）');
function runRounds(id, fg, bg, check) {
  let bad = 0;
  for (let r = 0; r < 300; r++) {
    const round = C.createRound(Object.assign({}, cfg, { type: id }), CHAR_IDS, rng);
    const res = C.evaluateCard(round, fg, bg, cfg, rng);
    if (!check(round, res)) bad++;
  }
  return bad;
}
for (const id of C.TYPE_IDS) {
  const name = C.TYPES[id].name;
  // Acceptance 2: good card (example preset)
  const ex = C.TYPES[id].example;
  let bad = runRounds(id, C.hexToRgb(ex.fg), C.hexToRgb(ex.bg), (round, res) =>
    res.every((x, i) => (round.suspects[i].isImpostor ? x.kind !== 'correct' : x.kind === 'correct')));
  ok(bad === 0, `${name} 好卡：一般人全對、偽人全錯（失敗 ${bad} 局）`);
  // Acceptance 3: identical colors
  const same = C.hsvToRgb(120, 0.6, 0.7);
  bad = runRounds(id, same, same, (_, res) => res.every((x) => x.kind === 'scribble'));
  ok(bad === 0, `${name} 兩色相同：全員亂寫（失敗 ${bad} 局）`);
  // Acceptance 4: red vs blue
  bad = runRounds(id, [255, 0, 0], [0, 0, 255], (_, res) => res.every((x) => x.kind === 'correct'));
  ok(bad === 0, `${name} 紅配藍：全員寫對（失敗 ${bad} 局）`);
}

// --- 4. closeNumber never equals the answer ---
console.log('\n[4] 接近數字');
let clash = 0;
const samples = {};
for (const num of C.NUMBER_POOL) {
  samples[num] = new Set();
  for (let k = 0; k < 500; k++) {
    const c = C.closeNumber(num, rng);
    if (c === num) clash++;
    samples[num].add(c);
  }
}
ok(clash === 0, `5000 次產生，與正解相同 ${clash} 次`);
console.log('      例：' + Object.entries(samples).map(([k, v]) => `${k}→${[...v].slice(0, 5).join('/')}`).join('  '));

// --- 5. Round setup ranges ---
console.log('\n[5] 開局抽樣');
let rangeBad = 0;
for (let r = 0; r < 2000; r++) {
  const n = 3 + (r % 5);
  const round = C.createRound(Object.assign({}, cfg, { suspects: n, severity: '75' }), CHAR_IDS, rng);
  const imps = round.suspects.filter((s) => s.isImpostor);
  if (round.suspects.length !== n || imps.length < 1 || imps.length > 2) rangeBad++;
  for (const s of round.suspects) {
    if (s.isImpostor && (s.threshold < 4.5 || s.threshold > 6.5 || s.severity < 0.75 || s.severity > 1)) rangeBad++;
    if (!s.isImpostor && (s.threshold < 7 || s.threshold > 11)) rangeBad++;
  }
}
ok(rangeBad === 0, `人數、偽人數、門檻、嚴重度皆在範圍內（異常 ${rangeBad}）`);

// --- 6. Vision self-test recovers synthetic observers ---
console.log('\n[6] 色覺自我測驗：虛擬受測者（6 方向 × 4 題、反應誤差 ±15%、每組 60 人）');
function observe(obs, axis, theta, noise, base) {
  const seen = (t) => {
    const p = C.visionPair(axis, t, base);
    return obs.type === 'normal' ? C.deltaE(p.fg, p.bg) : C.deltaESim(p.fg, p.bg, obs.type, obs.severity);
  };
  let lo = 0, hi = C.visionTmax(axis, base);
  if (seen(hi) < theta) return { axis, base, t: hi, censored: true };
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (seen(mid) >= theta) hi = mid; else lo = mid; }
  return { axis, base, t: Math.min(C.visionTmax(axis, base), hi * (1 + noise * (rng() * 2 - 1))), censored: false };
}
const sameRG = (a, b) => ['protan', 'deutan'].includes(a) && ['protan', 'deutan'].includes(b);
for (const obs of [
  ...['protan', 'deutan'].flatMap((t) => [0.7, 0.85, 1].map((sv) => ({ type: t, severity: sv }))),
  ...[0.3, 0.6, 1].map((sv) => ({ type: 'tritan', severity: sv })),
]) {
  let typeOk = 0, rgOk = 0, errSum = 0;
  for (let rep = 0; rep < 60; rep++) {
    const theta = 2 + rng() * 3, trials = [];
    for (const axis of C.VISION_AXIS_IDS) for (const base of ['mid', 'light', 'dark', 'mid']) trials.push(observe(obs, axis, theta, 0.15, base));
    const r = C.fitVision(trials);
    if (r.type === obs.type) { typeOk++; errSum += Math.abs(r.severity - obs.severity); }
    if (r.type === obs.type || (sameRG(r.type, obs.type) && r.ambiguous)) rgOk++;
  }
  const need = obs.type === 'tritan' ? 57 : 50;
  const sevErr = errSum / Math.max(typeOk, 1);
  ok(typeOk >= need && sevErr <= 0.05, `${C.TYPES[obs.type].name} ${obs.severity * 100}%：類型正確 ${typeOk}/60（含標示紅綠不確定 ${rgOk}/60），程度平均誤差 ${(sevErr * 100).toFixed(1)}%（需 ≤5%）`);
}
{
  const zv = C.Z_LEVEL.vision, zcfg = Object.assign({}, cfg, { impostorTh: zv.impostorTh });
  ok(C.zFeasible(zv.type, zv.severity, zcfg), `難度 Z（${C.TYPES[zv.type].name} ${zv.severity * 100}%、門檻 ${zv.impostorTh}）有卡能過關`);
}
for (const [id, sv] of [['deutan', 0.7], ['protan', 1], ['tritan', 0.6], ['tritan', 0.3]]) {
  const th = C.zImpostorTh(id, sv, cfg);
  ok(C.zFeasible(id, sv, Object.assign({}, cfg, { impostorTh: th })), `Z 可過關：${C.TYPES[id].name} ${sv * 100}%（偽人門檻 ${th}${th > cfg.impostorTh ? '，已自動放寬' : ''}）`);
}

console.log(`\n${failures === 0 ? '全部通過' : `失敗 ${failures} 項`}`);
process.exit(failures ? 1 : 0);

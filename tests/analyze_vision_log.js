// Offline analysis of a vision self-test log.
// Run: node tests/analyze_vision_log.js <path/to/color-vision-log-*.json>
'use strict';
const fs = require('fs');
const C = require('../core.js');

const file = process.argv[2];
if (!file) { console.error('usage: node tests/analyze_vision_log.js <log.json>'); process.exit(1); }
const log = JSON.parse(fs.readFileSync(file, 'utf8'));
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
const perceived = (c, p) => (c.type === 'normal' ? C.deltaE(p.fg, p.bg) : C.deltaESim(p.fg, p.bg, c.type, c.severity));
const pairOf = (r) => ({ fg: C.hexToRgb(r.fg), bg: C.hexToRgb(r.bg) });

console.log(`測驗時間 ${log.startedAt} → ${log.finishedAt}`);
console.log(`螢幕 ${log.screen.w}x${log.screen.h} @${log.screen.dpr}x\n`);

// ---- Phase A raw ----
console.log('[第一階段] 每題停下時，一般人看到的色差（看不到＝拉到底）');
const byAxis = {};
for (const r of log.phaseA) (byAxis[r.axis] = byAxis[r.axis] || []).push(r);
for (const [axis, rows] of Object.entries(byAxis)) {
  const cells = rows.map((r) => `${r.base}:${r.censored ? '看不到' : f1(r.dENormal)}${r.wrong.length ? `(錯${r.wrong.length})` : ''}`);
  console.log(`  ${axis.padEnd(6)} ${cells.join('  ')}`);
}

// ---- Phase A fit on a fine grid ----
function fitA(c) {
  const ds = log.phaseA.map((r) => Math.log(Math.max(0.05, perceived(c, pairOf(r)))));
  const unc = ds.filter((_, i) => !log.phaseA[i].censored);
  const th = unc.reduce((a, b) => a + b, 0) / unc.length;
  let err = 0;
  ds.forEach((d, i) => { if (!log.phaseA[i].censored || d > th) err += (d - th) ** 2; });
  return { err, theta: Math.exp(th) };
}
const cands = [{ type: 'normal', severity: 0 }];
for (const type of ['protan', 'deutan', 'tritan']) for (let k = 5; k <= 100; k++) cands.push({ type, severity: k / 100 });
const scored = cands.map((c) => Object.assign({}, c, fitA(c))).sort((a, b) => a.err - b.err);
console.log('\n[第一階段擬合] 各類型最佳（err 越小越吻合）');
for (const type of ['protan', 'deutan', 'tritan', 'normal']) {
  const b = scored.find((c) => c.type === type);
  console.log(`  ${type.padEnd(6)} 程度 ${Math.round(b.severity * 100)}%  err ${f2(b.err)}  門檻θ ${f2(b.theta)}`);
}

// ---- Phase B: does the model explain seen / not seen? ----
console.log('\n[第二階段] 一般人色差 → 是否看得到');
for (const axis of ['protan', 'deutan', 'lum']) {
  const rows = log.phaseB.filter((r) => r.axis === axis).sort((a, b) => a.dENormal - b.dENormal);
  console.log(`  ${axis.padEnd(6)} ${rows.map((r) => `${r.dENormal}${r.seen ? '✔' : '✘'}`).join('  ')}`);
}
function fitB(c) {
  // best single threshold on perceived ΔE separating seen from unseen
  const pts = log.phaseB.map((r) => ({ d: perceived(c, pairOf(r)), seen: r.seen }));
  let best = { miss: Infinity, th: 0 };
  for (const th of pts.map((p) => p.d + 1e-6).concat([0])) {
    const miss = pts.filter((p) => (p.d >= th) !== p.seen).length;
    if (miss < best.miss) best = { miss, th };
  }
  return best;
}
console.log('\n[綜合] 第一階段擬合誤差＋第二階段判錯題數（取前 8 名）');
const combined = scored.filter((c) => c.type !== 'normal').map((c) => Object.assign(c, { b: fitB(c) }))
  .sort((a, b) => a.b.miss - b.b.miss || a.err - b.err).slice(0, 8);
for (const c of combined) {
  console.log(`  ${C.TYPES[c.type].name} ${Math.round(c.severity * 100)}%  第一階段 err ${f2(c.err)}  第二階段判錯 ${c.b.miss}/${log.phaseB.length}`);
}

// ---- What the chosen Z means in practice ----
const z = combined[0];
console.log(`\n[建議 Z] ${C.TYPES[z.type].name} ${Math.round(z.severity * 100)}%`);
for (const r of log.phaseB.filter((x) => !x.seen && x.axis !== 'lum')) {
  console.log(`  你看不到的卡：${r.axis} 一般人ΔE ${r.dENormal} → 模型中你看到 ΔE ${f1(perceived(z, pairOf(r)))}`);
}

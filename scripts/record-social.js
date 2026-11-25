// Renders the 9:16 social video of the brushing cursor, frame by frame.
// Serve the repo on http://localhost:8765 (python3 -m http.server 8765), then:
//   node scripts/record-social.js rec/frames 2.5
//   ffmpeg -framerate 30 -i rec/frames/f%04d.jpg -c:v libx264 -crf 17 -pix_fmt yuv420p -movflags +faststart media/glint-whitening-cursor.mp4
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || 'rec/frames', DPR = +(process.argv[3] || 2.5);
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 432, height: 768 }, deviceScaleFactor: DPR });
  // drive the page's animation clock frame by frame
  await p.addInitScript(() => {
    window.__vt = 0; const q = [];
    window.requestAnimationFrame = cb => { q.push(cb); return q.length; };
    performance.now = () => window.__vt;
    window.__tick = dt => { window.__vt += dt; q.splice(0).forEach(cb => cb(window.__vt)); };
  });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelectorAll('img').forEach(i => i.loading = 'eager'); });
  await p.waitForTimeout(1500);
  await p.waitForTimeout(500);

  // geometry of the headline lines
  const L = await p.evaluate(() => { const m = {}; document.querySelectorAll('h1 .w > span').forEach(s => { const r = s.getBoundingClientRect(); const k = Math.round(r.top + r.height / 2); (m[k] = m[k] || []).push(r); });
    return Object.entries(m).map(([y, rs]) => ({ y: +y, x0: Math.min(...rs.map(r => r.left)), x1: Math.max(...rs.map(r => r.right)) })); });
  const S = await p.evaluate(() => { const m = {}; document.querySelectorAll('.hero .sub .w > span').forEach(s => { const r = s.getBoundingClientRect(); const k = Math.round(r.top + r.height / 2); (m[k] = m[k] || []).push(r); });
    return Object.entries(m).map(([y, rs]) => ({ y: +y, x0: Math.min(...rs.map(r => r.left)), x1: Math.max(...rs.map(r => r.right)) })); });

  // build the timeline: one entry per frame {x, y, cap, capOp, end}
  const T = []; let pos = { x: 470, y: 600 };
  const push = (x, y, extra = {}) => { pos = { x, y }; T.push({ x, y, ...extra }); };
  const hold = (n, extra) => { for (let i = 0; i < n; i++) push(pos.x, pos.y, extra); };
  const glide = (x, y, n, extra) => { const a = { ...pos }; for (let i = 1; i <= n; i++) { const t = i / n, e = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; push(a.x + (x - a.x) * e, a.y + (y - a.y) * e, extra); } };
  const zig = (x0, x1, yc, amp, stepX, period, extra) => { const dir = x1 > x0 ? 1 : -1; let k = 0; for (let x = x0; dir > 0 ? x <= x1 : x >= x1; x += stepX * dir, k++) push(x, yc + amp * Math.sin(k / period * Math.PI * 2), extra); };

  const xa = Math.max(2, L[0].x0 - 14), xb = Math.max(...L.map(l => l.x1)) + 6;
  const yA = (L[0].y + L[1].y) / 2, yB = (L[1].y + L[2].y) / 2;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  const scroll = (from, to, n) => { for (let i = 1; i <= n; i++) push(pos.x, pos.y, { sy: from + (to - from) * ease(i / n) }); };
  pos = { x: 372, y: 560 };
  hold(24, { sy: 0 });
  scroll(0, 2300, 96); hold(18, { sy: 2300 });
  scroll(2300, 0, 84); hold(16, { sy: 0 });
  glide(L[0].x0 + 4, yA, 22);
  zig(xa, xb, yA, 30, 7, 4); zig(xb, xa, yA, 30, 7, 4);
  zig(xa, xb, yB, 30, 7, 4); zig(xb, xa, yB, 30, 7, 4);
  const circ = (x0, x1, yc, r, period, stepX) => { const dir = x1 > x0 ? 1 : -1; let k = 0;
    for (let x = x0; dir > 0 ? x <= x1 : x >= x1; x += stepX * dir, k++) { const a = k / period * Math.PI * 2; push(x + r * Math.cos(a), yc + r * Math.sin(a)); } };
  circ(xa, xb, L[0].y, 34, 3, 6); circ(xb, xa, L[1].y, 34, 3, 6); circ(xa, xb, L[2].y, 34, 3, 6); circ(xb, xa, L[0].y, 34, 3, 8); circ(xa, xb, L[2].y, 34, 3, 9);
  glide(388, 420, 20); hold(45);

  // render
  const fps = 30;
  await p.mouse.move(T[0].x, T[0].y);
  for (let i = 0; i < T.length; i++) {
    const f = T[i];
    if (f.sy !== undefined) await p.evaluate(y => scrollTo(0, y), f.sy);
    await p.mouse.move(f.x, f.y);
    await p.evaluate(() => window.__tick(1000 / 30));
    await p.screenshot({ path: `${OUT}/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
  }
  console.log('frames', T.length, 'seconds', (T.length / fps).toFixed(1));
  await b.close();
})();

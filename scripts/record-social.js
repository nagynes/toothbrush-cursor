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
  // overlay: captions and end card (video only, not part of the site)
  await p.evaluate(() => {
    const st = document.createElement('style');
    st.textContent = `
      #cap { position: fixed; left: 50%; bottom: 96px; transform: translateX(-50%); z-index: 200; opacity: 0; white-space: nowrap;
        font: 800 28px/1.1 "Bricolage Grotesque", sans-serif; letter-spacing: -0.02em; color: #ece7de;
        background: rgba(10, 22, 20, .82); border: 1px solid rgba(143,211,182,.35); padding: 14px 22px; border-radius: 999px; box-shadow: 0 10px 30px rgba(0,0,0,.4); }
      #cap b { color: #8fd3b6; font-weight: 800; }
      #end { position: fixed; inset: 0; z-index: 300; opacity: 0; display: grid; grid-template-rows: auto 1fr; justify-items: center; text-align: center;
        background: radial-gradient(600px 500px at 50% 75%, rgba(143,211,182,.22), transparent 70%), #12201e; padding: 120px 28px 0; overflow: hidden; }
      #end .t { display: grid; gap: 18px; justify-items: center; }
      #end .logo { font: 800 64px/1 "Bricolage Grotesque", sans-serif; letter-spacing: -0.04em; color: #ece7de; display: flex; align-items: center; gap: 12px; }
      #end .logo i { width: 46px; height: 46px; border-radius: 14px; background: linear-gradient(135deg, #8fd3b6, #5fae8e); display: grid; place-items: center; font-style: normal; font-size: 24px; color: #0e211b; }
      #end p { margin: 0; font: 700 28px/1.15 "Bricolage Grotesque", sans-serif; letter-spacing: -0.02em; color: #ece7de; max-width: 15ch; }
      #end .pill { margin-top: 8px; background: #8fd3b6; color: #0e211b; font: 600 19px/1 Inter, sans-serif; padding: 17px 28px; border-radius: 999px; }
      #end .g { font: 500 15px Inter, sans-serif; color: #a3b1ab; }
      #end img { width: 118%; max-width: none; align-self: end; margin-bottom: -40px; -webkit-mask-image: linear-gradient(to bottom, transparent, #000 18%); }`;
    document.head.appendChild(st);
    const cap = document.createElement('div'); cap.id = 'cap'; document.body.appendChild(cap);
    const end = document.createElement('div'); end.id = 'end';
    end.innerHTML = '<div class="t"><div class="logo"><i>✦</i>Glint</div><p>The toothbrush engineered for a whiter smile</p><span class="pill">I want whiter teeth</span><span class="g">30-day money-back guarantee</span></div><img src="img/hero.jpg" alt="">';
    document.body.appendChild(end);
  });
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

  const C1 = 'This website needs a <b>clean</b>.', C2 = 'Brush the stains <b>off</b>.', C3 = 'Go <b>fast</b> to whiten it.', C4 = 'Now <b>that’s</b> a smile.';
  hold(36, { cap: C1 });
  glide(L[0].x0 + 4, (L[0].y + L[1].y) / 2, 22, { cap: C1 });
  const xa = Math.max(2, L[0].x0 - 14), xb = Math.max(...L.map(l => l.x1)) + 6;
  const yA = (L[0].y + L[1].y) / 2, yB = (L[1].y + L[2].y) / 2;
  zig(xa, xb, yA, 30, 7, 4, { cap: C2 }); zig(xb, xa, yA, 30, 7, 4, { cap: C2 });
  zig(xa, xb, yB, 30, 7, 4, { cap: C2 }); zig(xb, xa, yB, 30, 7, 4, { cap: C2 });
  // fast tight circles: builds whitening power and polishes every line
  const circ = (x0, x1, yc, r, period, stepX, extra) => { const dir = x1 > x0 ? 1 : -1; let k = 0;
    for (let x = x0; dir > 0 ? x <= x1 : x >= x1; x += stepX * dir, k++) { const a = k / period * Math.PI * 2; push(x + r * Math.cos(a), yc + r * Math.sin(a), extra); } };
  circ(xa, xb, L[0].y, 34, 3, 6, { cap: C3 }); circ(xb, xa, L[1].y, 34, 3, 6, { cap: C3 }); circ(xa, xb, L[2].y, 34, 3, 6, { cap: C3 }); circ(xb, xa, L[0].y, 34, 3, 8, { cap: C3 }); circ(xa, xb, L[2].y, 34, 3, 9, { cap: C3 });
  glide(388, 420, 20, { cap: C4 }); hold(38, { cap: C4 });
  hold(14, { end: true }); hold(60, { end: true });

  // render
  const fps = 30, dt = 1000 / fps; let lastCap = '', capAge = 0, endAge = 0;
  await p.mouse.move(T[0].x, T[0].y);
  for (let i = 0; i < T.length; i++) {
    const f = T[i];
    await p.mouse.move(f.x, f.y);
    if (f.cap !== lastCap) { capAge = 0; lastCap = f.cap; } else capAge++;
    if (f.end) endAge++;
    await p.evaluate(({ cap, capAge, endAge }) => {
      const c = document.getElementById('cap');
      if (cap) c.innerHTML = cap;
      c.style.opacity = cap ? Math.min(1, capAge / 6) : 0;
      c.style.transform = `translateX(-50%) translateY(${(1 - Math.min(1, capAge / 6)) * 10}px)`;
      const e = document.getElementById('end'); e.style.opacity = Math.min(1, endAge / 12);
      window.__tick(1000 / 30);
    }, { cap: f.end ? '' : f.cap, capAge, endAge });
    await p.screenshot({ path: `${OUT}/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
  }
  console.log('frames', T.length, 'seconds', (T.length / fps).toFixed(1));
  await b.close();
})();

const COLORS = { A: "#2f9c5c", C: "#2f6fd8", G: "#e39b1f", T: "#d24b4b", N: "#9aa3ae" };

export function startHelix({ canvas, ticker, motif = "CCGCGNGGNGGCAG", reduce }) {
  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, raf = 0, phase = 0.6, visible = true, running = false;

  function size() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const dark = () => document.documentElement.dataset.theme === "dark";

  function draw(tt) {
    ctx.clearRect(0, 0, w, h);
    const cy = h / 2 - 8, amp = Math.min(70, h * 0.28), n = 34, gap = w / (n - 1);
    const rungs = [];
    for (let i = 0; i < n; i++) {
      const ph = i * 0.42 + tt;
      rungs.push({ x: i * gap, y1: cy + Math.sin(ph) * amp, y2: cy + Math.sin(ph + Math.PI) * amp, z: Math.cos(ph), b: motif[i % motif.length] });
    }
    const rung = (r, front) => {
      ctx.strokeStyle = COLORS[r.b] || COLORS.N; ctx.globalAlpha = front ? 0.55 + 0.45 * r.z : 0.35 + 0.35 * (1 + r.z);
      ctx.lineWidth = front ? 2.5 : 2; ctx.beginPath(); ctx.moveTo(r.x, r.y1); ctx.lineTo(r.x, r.y2); ctx.stroke();
      if (front) { ctx.fillStyle = COLORS[r.b] || COLORS.N; ctx.beginPath(); ctx.arc(r.x, (r.y1 + r.y2) / 2, 2.2, 0, 7); ctx.fill(); }
    };
    rungs.filter((r) => r.z < 0).forEach((r) => rung(r, false));
    const strand = dark() ? "rgba(231,234,239,.9)" : "rgba(28,35,48,.85)";
    for (const off of [0, Math.PI]) {
      ctx.strokeStyle = strand; ctx.lineWidth = 2.2;
      for (let i = 1; i < n * 4; i++) {
        const ph0 = (i - 1) * 0.105 + tt + off, ph1 = i * 0.105 + tt + off;
        ctx.globalAlpha = 0.35 + 0.65 * (Math.cos(ph1) + 1) / 2;
        ctx.beginPath(); ctx.moveTo((i - 1) * gap / 4, cy + Math.sin(ph0) * amp); ctx.lineTo(i * gap / 4, cy + Math.sin(ph1) * amp); ctx.stroke();
      }
    }
    rungs.filter((r) => r.z >= 0).forEach((r) => rung(r, true));
    ctx.globalAlpha = 1;
  }

  function loop() { phase += 0.012; draw(phase); raf = requestAnimationFrame(loop); }
  function start() { if (reduce || running || !visible || document.hidden) return; running = true; raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  size(); draw(phase);
  addEventListener("resize", () => { size(); draw(phase); });
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; visible ? start() : stop(); }).observe(canvas);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  new MutationObserver(() => draw(phase)).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  start();

  ticker.replaceChildren();
  const text = Array(6).fill(motif).join("···");
  for (const ch of text) {
    if ("ACGT".includes(ch)) { const b = document.createElement("b"); b.className = ch; b.textContent = ch; ticker.appendChild(b); }
    else ticker.appendChild(document.createTextNode(ch));
  }
  return { stop };
}

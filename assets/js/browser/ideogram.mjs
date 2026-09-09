const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const SHADES = ["var(--band1)", "var(--band2)", "var(--band1)", "var(--band3)", "var(--band2)", "var(--band1)", "var(--band2)"];

export function initIdeogram(sections, { reduce }) {
  const svg = document.getElementById("ideo");
  svg.replaceChildren();
  const disposers = [];
  const total = sections.reduce((s, x) => s + x.weight, 0);
  let x = 0;
  const labels = new Map();
  sections.forEach((s, i) => {
    const w = (s.weight / total) * 1000;
    const band = svgEl("rect", { x, y: 10, width: w, height: 16, fill: SHADES[i % SHADES.length], class: "band", rx: i === 0 ? 8 : 0, tabindex: 0, role: "button", "aria-label": s.label });
    const go = () => document.getElementById(s.id).scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    band.addEventListener("click", go);
    band.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    svg.appendChild(band);
    if (s.id === "experience") svg.appendChild(svgEl("circle", { cx: x, cy: 18, r: 6, fill: "var(--cen)" }));
    const text = svgEl("text", { x: x + w / 2, y: 41, "text-anchor": "middle" });
    text.textContent = s.label;
    svg.appendChild(text);
    labels.set(s.id, text);
    s.x0 = x; s.x1 = x + w; x += w;
  });
  const loc = svgEl("rect", { class: "loc", x: 0, y: 6, width: sections[0].x1, height: 24, rx: 2 });
  svg.appendChild(loc);

  const input = document.getElementById("locus");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const s = sections.find((s) => s.id === e.target.id);
      loc.setAttribute("x", s.x0); loc.setAttribute("width", s.x1 - s.x0);
      labels.forEach((txt, id) => txt.classList.toggle("current", id === s.id));
      if (input) input.value = `chr${s.label[0].toUpperCase()}${s.label.slice(1)}`;
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => io.observe(document.getElementById(s.id)));
  disposers.push(() => io.disconnect());

  const form = document.getElementById("locus-form");
  const onSubmit = (e) => {
    e.preventDefault();
    const v = input.value.toLowerCase().replace(/^chr/, "");
    const s = sections.find((s) => s.label.toLowerCase().startsWith(v.slice(0, 4)) || s.id.startsWith(v.slice(0, 4)));
    if (s) document.getElementById(s.id).scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  };
  form?.addEventListener("submit", onSubmit);
  disposers.push(() => form?.removeEventListener("submit", onSubmit));
  return { dispose() { disposers.forEach((fn) => fn()); } };
}

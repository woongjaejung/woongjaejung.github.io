import { groupByChromosome, layoutGenes, parsePeriod, timelineScale, truncateToWidth, repoDescription, normalizePdb } from "../logic.mjs";
import { state, t, pk, el } from "../shell.mjs";

const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const text = (attrs, content) => { const e = svgEl("text", attrs); e.textContent = content; return e; };
const COLOR = { A: "var(--nA)", C: "var(--nC)", G: "var(--nG)", T: "var(--nT)", N: "var(--nN)" };
export const TL = 120, TR = 1080;

function button(group, label, onActivate) {
  group.setAttribute("tabindex", "0"); group.setAttribute("role", "button"); group.setAttribute("aria-label", label);
  group.addEventListener("click", onActivate);
  group.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onActivate(e); } });
}

/* ---------- projects (genes) ---------- */
function renderGenes() {
  const svg = document.getElementById("genes");
  svg.replaceChildren();
  const repos = state.repos;
  const note = document.getElementById("projects-note");
  if (!repos) {
    svg.setAttribute("viewBox", "0 0 1100 60");
    svg.appendChild(text({ x: TL, y: 30, class: "genelbl" }, t("projects_fallback")));
    const a = svgEl("a", { href: "https://github.com/woongjaejung", target: "_blank", rel: "noopener" });
    a.appendChild(text({ x: TL, y: 50, class: "genelbl", "text-decoration": "underline" }, "github.com/woongjaejung"));
    svg.appendChild(a);
    document.getElementById("projects-meta").textContent = "";
    note.textContent = "";
    return;
  }
  const groups = groupByChromosome(repos, state.content.repo_overrides);
  const top = 34, rowH = 84;
  svg.setAttribute("viewBox", `0 0 1100 ${top + groups.length * rowH + 20}`);
  document.getElementById("projects-meta").textContent = t("projects_track_meta", { n: repos.length, k: groups.length });
  note.textContent = t("projects_track_note");
  const legend = document.getElementById("lang-legend");
  legend.replaceChildren(...[["Python", "C"], ["JavaScript", "G"], ["Shell", "T"], ["HTML", "A"], [t("legend_other"), "N"]].map(([name, key]) => {
    const s = el("span"); const i = el("i"); i.style.background = COLOR[key]; s.append(i, name); return s;
  }));

  const kb = (x) => TL + (TR - TL) * x / 100;
  for (let k = 0; k <= 100; k += 10) {
    svg.appendChild(svgEl("line", { x1: kb(k), x2: kb(k), y1: 14, y2: 20, stroke: "var(--rule)" }));
    svg.appendChild(text({ x: kb(k), y: 10, class: "rulertxt", "text-anchor": "middle" }, `${k} kb`));
  }
  svg.appendChild(svgEl("line", { x1: TL, x2: TR, y1: 20, y2: 20, stroke: "var(--rule)" }));

  groups.forEach((chr, ri) => {
    const y = top + ri * rowH + 26;
    svg.appendChild(text({ x: TL - 12, y: y + 4, class: "rowlbl", "text-anchor": "end" }, chr.name));
    svg.appendChild(svgEl("line", { x1: TL, x2: TR, y1: y, y2: y, stroke: "var(--rule-soft)" }));
    const layout = layoutGenes(chr.genes);
    chr.genes.forEach((g, gi) => {
      const x0 = kb(layout[gi].x0), x1 = kb(layout[gi].x1), col = COLOR[g.colorKey];
      const grp = svgEl("g", { class: "gene" });
      grp.appendChild(svgEl("rect", { class: "hit", x: x0 - 6, y: y - 16, width: x1 - x0 + 12, height: 44, rx: 4 }));
      grp.appendChild(svgEl("line", { x1: x0, x2: x1, y1: y, y2: y, stroke: col, "stroke-width": 1.5 }));
      for (let cx = x0 + 10; cx < x1 - 6; cx += 14) grp.appendChild(svgEl("path", { d: `M${cx - 3} ${y - 3} L${cx} ${y} L${cx - 3} ${y + 3}`, fill: "none", stroke: col, "stroke-width": 1.2 }));
      const ne = g.exons.length, ew = (x1 - x0) / (ne * 2 - 1);
      g.exons.forEach((name, i) => {
        const ex = svgEl("rect", { class: "exon", x: x0 + i * ew * 2, y: y - 8, width: Math.max(ew, 6), height: 16, fill: col, rx: 1.5 });
        const title = svgEl("title"); title.textContent = name; ex.appendChild(title); grp.appendChild(ex);
      });
      const ly = gi % 2 === 0 ? y + 24 : y + 38;
      const limit = layout[gi + 2] ? kb(layout[gi + 2].x0) - 6 : TR;
      const label = truncateToWidth(g.name, limit - x0, 6.6);
      let lx = x0, anchor = "start";
      if (x0 + label.length * 6.6 > TR) { lx = TR; anchor = "end"; }
      const lbl = text({ x: lx, y: ly, class: "genelbl", "text-anchor": anchor }, label);
      const lblTitle = svgEl("title"); lblTitle.textContent = g.name; lbl.appendChild(lblTitle);
      grp.appendChild(lbl);
      button(grp, g.name, (e) => openPopup(g, chr.name, e));
      svg.appendChild(grp);
    });
  });
}

function openPopup(g, chrName, e) {
  const p = document.getElementById("popup");
  p.replaceChildren();
  const head = el("header");
  const dot = el("i"); dot.style.cssText = `width:10px;height:10px;border-radius:2px;background:${COLOR[g.colorKey]}`;
  const close = el("button", "x", "×"); close.type = "button"; close.setAttribute("aria-label", t("structure_close"));
  close.addEventListener("click", closePopup);
  head.append(dot, el("b", null, g.name), close);
  const dl = el("dl");
  const row = (k, v) => { dl.appendChild(el("dt", null, k)); const dd = el("dd"); if (typeof v === "string") dd.textContent = v; else dd.appendChild(v); dl.appendChild(dd); };
  const tags = (items) => { const d = el("div", "tags"); items.forEach((x) => d.appendChild(el("span", null, x))); return d; };
  row("CHROM", chrName);
  row("DESC", repoDescription(g, state.content.repo_overrides, state.lang));
  row("LANG", g.language || "—");
  row("EXONS", tags(g.exons));
  if (g.topics?.length) row("TOPICS", tags(g.topics));
  row("PUSHED", (g.pushed_at || "").slice(0, 10));
  const foot = el("footer");
  const a = el("a", null, t("popup_open_github")); a.href = g.html_url; a.target = "_blank"; a.rel = "noopener";
  foot.appendChild(a);
  p.append(head, dl, foot);
  p.hidden = false;
  const px = Math.min(Math.max(8, (e.clientX ?? 200) - 20), innerWidth - 372);
  const py = Math.min((e.clientY ?? 200) + 14, innerHeight - 320);
  p.style.left = `${px}px`; p.style.top = `${py}px`;
  p._returnTo = e.currentTarget;
  close.focus();
}
function closePopup() {
  const p = document.getElementById("popup");
  if (p.hidden) return;
  p.hidden = true;
  p._returnTo?.focus?.();
}

/* ---------- shared timeline ---------- */
function makeScale(t0, t1) { return (v) => TL + (TR - TL) * (v - t0) / (t1 - t0); }
function ruler(svg, y, t0, t1, tx) {
  for (let yr = t0; yr <= t1; yr++) {
    svg.appendChild(svgEl("line", { x1: tx(yr), x2: tx(yr), y1: y - 6, y2: y, stroke: "var(--rule)" }));
    if (yr < t1) svg.appendChild(text({ x: tx(yr), y: y - 10, class: "rulertxt", "text-anchor": "middle" }, String(yr)));
  }
  svg.appendChild(svgEl("line", { x1: TL, x2: TR, y1: y, y2: y, stroke: "var(--rule)" }));
}

/* ---------- experience (coverage) ---------- */
function renderCoverage(t0, t1, tx) {
  const svg = document.getElementById("coverage");
  svg.replaceChildren();
  const items = (state.content.experience || []).map((x) => ({ x, p: parsePeriod(x.period, state.now) })).filter((e) => e.p).sort((a, b) => a.p.start - b.p.start);
  document.getElementById("experience-meta").textContent = t("experience_track_meta", { t0, t1: t1 - 1, n: items.length });
  ruler(svg, 22, t0, t1, tx);
  const base = 120, unit = Math.min(22, 88 / Math.max(items.length, 1));
  svg.appendChild(text({ x: TL - 8, y: base - items.length * unit - 8, class: "rowlbl", "text-anchor": "end" }, "depth"));
  items.forEach((_, i) => {
    const h = i + 1;
    svg.appendChild(svgEl("line", { x1: TL, x2: TR, y1: base - h * unit, y2: base - h * unit, stroke: "var(--rule-soft)", "stroke-dasharray": "2 4" }));
    svg.appendChild(text({ x: TL - 8, y: base - h * unit + 4, class: "rulertxt", "text-anchor": "end" }, `${h}×`));
  });
  if (!items.length) return;
  let d = `M${tx(items[0].p.start)} ${base}`;
  items.forEach((e, i) => { d += ` L${tx(e.p.start)} ${base - (i + 1) * unit} L${tx(e.p.end)} ${base - (i + 1) * unit}`; });
  d += ` L${tx(items.at(-1).p.end)} ${base} Z`;
  svg.appendChild(svgEl("path", { d, fill: "var(--nC)", "fill-opacity": 0.18, stroke: "var(--nC)", "stroke-width": 1.5 }));
  items.forEach(({ x, p }, i) => {
    const x0 = tx(p.start), x1 = tx(p.end), cx = (x0 + x1) / 2, ly = base + 22 + (i % 2) * 46;
    const last = i === items.length - 1, first = i === 0;
    const anchor = last ? "end" : first ? "start" : "middle", ax = last ? x1 : first ? x0 : cx;
    svg.appendChild(svgEl("line", { x1: cx, x2: cx, y1: base - (i + 1) * unit, y2: ly - 14, stroke: "var(--rule)", "stroke-dasharray": "2 3" }));
    svg.appendChild(text({ x: ax, y: ly, class: "covlbl", "text-anchor": anchor }, pk(x.title)));
    const meta = [x.period, pk(x.org).split(",")[0]].join(" · ");
    svg.appendChild(text({ x: ax, y: ly + 14, class: "covmeta", "text-anchor": anchor }, meta));
  });
}

/* ---------- publications (peaks) ---------- */
function renderPeaks(t0, t1, tx, onPeak) {
  const svg = document.getElementById("peaks");
  svg.replaceChildren();
  const pubs = state.content.publications || [];
  const base = 48, rh = 36;
  svg.setAttribute("viewBox", `0 0 1100 ${base + pubs.length * rh + 24}`);
  document.getElementById("publications-meta").textContent = t("publications_track_meta", { n: pubs.length });
  document.getElementById("egg-hint").textContent = t("publications_egg_hint");
  ruler(svg, 22, t0, t1, tx);
  pubs.forEach((p, i) => {
    const y = base + i * rh, x = tx(Number(p.year) + 0.5);
    const g = svgEl("g", { class: "peak" });
    g.appendChild(svgEl("line", { x1: TL, x2: TR, y1: y + 12, y2: y + 12, stroke: "var(--rule-soft)" }));
    const first = /first/i.test(p.authors || "");
    g.appendChild(svgEl("path", { d: `M${x - 16} ${y + 12} Q${x - 6} ${y + 11} ${x - 3} ${y - 4} Q${x} ${y - 14} ${x + 3} ${y - 4} Q${x + 6} ${y + 11} ${x + 16} ${y + 12} Z`, fill: first ? "var(--nT)" : "var(--nG)", "fill-opacity": 0.85 }));
    const leftSide = x > (TL + TR) / 2;
    const lx = leftSide ? x - 24 : x + 24;
    const anchor = leftSide ? "end" : "start";
    const widthBudget = leftSide ? x - 24 - TL : TR - x - 24;
    const label = text({ x: lx, y: y + 2, class: "peaklbl", "text-anchor": anchor }, truncateToWidth(p.title, widthBudget));
    const full = svgEl("title"); full.textContent = p.title; label.appendChild(full);
    g.appendChild(label);
    const pdb = normalizePdb(p.pdb);
    const meta = [p.year, p.venue, p.authors, pdb ? `PDB ${pdb}` : null].filter(Boolean).join(" · ");
    g.appendChild(text({ x: lx, y: y + 16, class: "peakmeta", "text-anchor": anchor }, truncateToWidth(meta, widthBudget, 6.3)));
    button(g, p.title, () => onPeak(p));
    svg.appendChild(g);
  });
  svg.appendChild(text({ x: TR, y: base + pubs.length * rh + 2, class: "rulertxt", "text-anchor": "end" }, t("peak_legend")));
}

/* ---------- education (markers) ---------- */
function renderMarkers(t0, t1, tx) {
  const svg = document.getElementById("edu");
  svg.replaceChildren();
  const items = (state.content.education || []).map((e) => ({ e, p: parsePeriod(e.period, state.now) })).filter((x) => x.p).sort((a, b) => a.p.start - b.p.start);
  document.getElementById("education-meta").textContent = t("education_track_meta", { n: items.length });
  ruler(svg, 22, t0, t1, tx);
  const y = 50;
  svg.appendChild(svgEl("line", { x1: TL, x2: TR, y1: y, y2: y, stroke: "var(--rule-soft)" }));
  // first pass: compute dy, offsetting the EARLIER member of a crowded pair so its
  // stem/labels don't cross the later item's labels
  items.forEach((item, i) => {
    if (item.dy == null) item.dy = 0;
    if (i > 0 && item.p.start - items[i - 1].p.start <= 2 && !items[i - 1].dy && !items[i - 1].offsetDone) {
      items[i - 1].dy = 32;
      items[i - 1].offsetDone = true;
    }
  });
  items.forEach(({ e, p, dy }, i) => {
    const x = tx(p.start);
    const last = i === items.length - 1;
    svg.appendChild(svgEl("line", { x1: x, x2: x, y1: y + dy, y2: y - 16, stroke: "var(--nA)", "stroke-width": 1.5 }));
    svg.appendChild(svgEl("circle", { cx: x, cy: y - 19, r: 4.5, fill: "var(--nA)" }));
    svg.appendChild(text({ x: x + (last ? -8 : 8), y: y + 20 + dy, class: "covlbl", "text-anchor": last ? "end" : "start" }, pk(e.degree)));
    svg.appendChild(text({ x: x + (last ? -8 : 8), y: y + 34 + dy, class: "covmeta", "text-anchor": last ? "end" : "start" }, `${e.period} · ${pk(e.school).split(",")[0]}`));
  });
}

export function renderTracks({ onPeak }) {
  const c = state.content;
  const { t0, t1 } = timelineScale([...(c.experience || []), ...(c.education || []), ...(c.publications || []).map((p) => ({ period: `${p.year}.01` }))], state.now);
  const tx = makeScale(t0, t1);
  renderGenes();
  if (c.experience?.length) renderCoverage(t0, t1, tx);
  if (c.publications?.length) renderPeaks(t0, t1, tx, onPeak);
  if (c.education?.length) renderMarkers(t0, t1, tx);
}

document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePopup(); });
document.addEventListener("click", (e) => { const p = document.getElementById("popup"); if (!p.hidden && !p.contains(e.target) && !e.target.closest(".gene")) closePopup(); });

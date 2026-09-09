import { boot, state, t, pk, el, onLang, showLoadError } from "../shell.mjs";
import { groupByChromosome, normalizeTimeline, careerYears, runId, buildRunLog, repoDescription } from "../logic.mjs";

const logLabels = () => ({ pre: t("log_pre"), started: t("log_started"), lane: t("log_lane"), index: t("log_index"), peak: t("log_peak"), first: t("log_first"), qc: t("log_qc"), cluster: t("log_cluster"), pushed: t("log_pushed") });

const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const HEX = { C: "#2f6fd8", G: "#e39b1f", T: "#d24b4b", A: "#2f9c5c", N: "#9aa3ae" };
const HEAT = ["#111a22", "#173a45", "#1e6a6a", "#2d9a91", "#4fb8b1", "#e2a63c"];

function genes() { return state.repos ? groupByChromosome(state.repos, state.content.repo_overrides).flatMap((c) => c.genes.map((g) => ({ ...g, chr: c.name }))) : []; }

function renderHeader() {
  const { profile } = state.content;
  const now = state.now;
  document.getElementById("run-id").textContent = `Run · ${runId(profile.career_start)} · flowcell CAREER-01`;
  document.getElementById("run-name").textContent = profile.name;
  const sub = document.getElementById("run-sub");
  const kv = (k, v) => { const s = el("span", null, `${k} `); s.appendChild(el("b", null, v)); return s; };
  sub.replaceChildren(
    kv(t("run_instrument"), t("run_instrument_value")),
    kv(t("run_chemistry"), t("run_chemistry_value")),
    kv(t("run_readlength"), t("run_readlength_value")),
    kv(t("run_started"), `${profile.career_start.replace(".", "-")}-01 · ${t("run_yield_note")}`)
  );
  document.getElementById("run-status").textContent = t("run_status", { cycle: `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}` });
  document.getElementById("run-progress").textContent = t("run_progress");
  document.getElementById("run-note").textContent = t("run_note");
}

function tile(k, v, unit, s, color) {
  const d = el("div", "tile");
  d.appendChild(el("div", "k", k));
  const val = el("div", "v", v); if (color) val.style.color = color; if (unit) val.appendChild(el("small", null, unit));
  d.append(val, el("div", "s", s));
  return d;
}

function renderTiles() {
  const c = state.content, pubs = c.publications || [];
  const first = pubs.filter((p) => /first/i.test(p.authors || "")).length;
  const tiles = [
    tile(t("run_yield"), String(careerYears(c.profile.career_start, state.now)), t("unit_years"), `${c.profile.career_start} → ${state.now.getFullYear()}.${String(state.now.getMonth() + 1).padStart(2, "0")} · ${t("run_yield_note")}`),
    tile(t("run_clusters"), state.repos ? String(genes().length) : "—", t("unit_projects"), state.repos ? t("run_clusters_note") : t("projects_fallback")),
    tile(t("run_pubs"), String(pubs.length), t("unit_peer_reviewed"), `${t("run_first_author", { n: first })} · ${[...new Set(pubs.map((p) => p.venue))].join(", ")}`),
  ];
  if (c.profile.award?.year) tiles.push(tile(t("run_qc"), "MVP", c.profile.award.year, pk(c.profile.award), "var(--rm-green)"));
  document.getElementById("tiles").replaceChildren(...tiles); // column count comes from run.css (auto-fit)
}

function renderFlowcell() {
  const fc = document.getElementById("flowcell");
  document.getElementById("flowcell-note").textContent = t("run_flowcell_note");
  if (!state.repos) { document.getElementById("flowcell-title").textContent = t("run_flowcell"); fc.replaceChildren(el("p", "fallback", t("projects_fallback"))); return; }
  document.getElementById("flowcell-title").textContent = `${t("run_flowcell")} · ${genes().length} ${t("unit_lanes")}`;
  fc.replaceChildren(...genes().map((g, i) => {
    const lane = el("a", "lane"); lane.href = g.html_url; lane.target = "_blank"; lane.rel = "noopener";
    const canvas = el("canvas"); lane.appendChild(canvas);
    const ln = el("div", "ln"); ln.append(el("span", null, `L${i + 1}`), el("span", null, g.chr));
    lane.append(ln, el("div", "nm", g.name), el("div", "idx", `idx ${(g.language || "—").toUpperCase()}`));
    const w = (canvas.width = 220), h = (canvas.height = 110), ctx = canvas.getContext("2d");
    let seed = i * 97 + 13; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    ctx.fillStyle = HEX[g.colorKey];
    const n = Math.round((g.description || "").length * 1.6);
    for (let k = 0; k < n; k++) { ctx.globalAlpha = 0.25 + rnd() * 0.6; ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, 1.1 + rnd() * 1.2, 0, 7); ctx.fill(); }
    return lane;
  }));
}

function renderHeat() {
  document.getElementById("heat-title").textContent = t("run_heat");
  document.getElementById("heat-note").textContent = t("run_heat_note");
  const { years, rows, warnings } = normalizeTimeline(state.content.skill_timeline);
  warnings.forEach((w) => console.warn(w));
  const svg = document.getElementById("heat");
  svg.replaceChildren();
  const L = 118, T = 26, W = 560, ch = 27, cw = (W - L - 8) / Math.max(years.length, 1);
  svg.setAttribute("viewBox", `0 0 ${W} ${T + rows.length * ch + 4}`);
  years.forEach((y, i) => { if (i % 2 === 0) { const tx = svgEl("text", { x: L + i * cw + cw / 2, y: 16, "text-anchor": "middle" }); tx.textContent = y; svg.appendChild(tx); } });
  rows.forEach((r, ri) => {
    const lbl = svgEl("text", { x: L - 8, y: T + ri * ch + ch / 2 + 4, "text-anchor": "end", class: "rl" }); lbl.textContent = pk(r.label); svg.appendChild(lbl);
    r.values.forEach((v, i) => {
      const rc = svgEl("rect", { x: L + i * cw + 1, y: T + ri * ch + 1, width: cw - 2, height: ch - 2, rx: 2, fill: HEAT[v] || HEAT[0] });
      const title = svgEl("title"); title.textContent = `${pk(r.label)} · ${years[i]} · ${v}/4`; rc.appendChild(title); svg.appendChild(rc);
    });
  });
}

function renderSheet() {
  document.getElementById("sheet-title").textContent = t("run_sheet");
  const tb = document.querySelector("#sheet tbody");
  if (!state.repos) { const tr = el("tr"); const td = el("td", "d", t("projects_fallback")); td.colSpan = 3; tr.appendChild(td); tb.replaceChildren(tr); return; }
  tb.replaceChildren(...genes().map((g) => {
    const tr = el("tr");
    const a = el("a", null, g.name); a.href = g.html_url; a.target = "_blank"; a.rel = "noopener";
    const td1 = el("td"); td1.appendChild(a);
    const chip = el("span", "idxchip", g.language || "—"); chip.style.background = HEX[g.colorKey];
    const td2 = el("td"); td2.appendChild(chip);
    tr.append(td1, td2, el("td", "d", repoDescription(g, state.content.repo_overrides, state.lang)));
    return tr;
  }));
}

function renderLog() {
  document.getElementById("log-title").textContent = t("run_log");
  const log = document.getElementById("log");
  log.replaceChildren();
  const cls = { PRE: "t", INFO: "ok", NOTE: "warn", MARK: "hl" };
  for (const line of buildRunLog(state.content, state.repos, state.now, state.lang, logLabels())) {
    log.append(el("span", "t", line.date), "  ", el("span", cls[line.level], line.level.padEnd(4)), "  ", `${line.text}\n`);
  }
  const n = state.now;
  const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  log.append(el("span", "t", today), "  ", el("span", "ok", "INFO"), "  ", `${t("log_tail")} `, el("span", "cur"));
}

function renderAll() { renderHeader(); renderTiles(); renderFlowcell(); renderHeat(); renderSheet(); renderLog(); }

async function init() {
  await boot({ view: "run", themeFallback: "dark", showLocus: false, showTheme: false });
  document.documentElement.dataset.theme = "dark";
  renderAll();
  onLang(renderAll);
}
init().catch((err) => { console.error(err); showLoadError(); });

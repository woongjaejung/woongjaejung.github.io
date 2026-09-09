import { boot, state, t, pk, el, onLang, showLoadError, viewHref } from "../shell.mjs";
import { normalizeSkills, VIEWS } from "../logic.mjs";
import { initIdeogram } from "./ideogram.mjs";
import { startHelix } from "./helix.mjs";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let ideogram = null;
const SECTION_WEIGHTS = { about: 110, projects: 260, experience: 190, publications: 150, education: 90, skills: 120, contact: 80 };

function link(text, href, className = "chip") {
  const a = el("a", className, text);
  a.href = href;
  if (!href.startsWith("#") && !href.startsWith("mailto:")) { a.target = "_blank"; a.rel = "noopener"; }
  return a;
}

function renderHero() {
  const { profile, contact } = state.content;
  document.getElementById("hero-name").textContent = profile.name;
  document.getElementById("hero-tagline").textContent = pk(profile.tagline);
  document.getElementById("hero-intro").textContent = pk(profile.intro) || pk(profile.about);
  document.getElementById("hero-about").textContent = pk(profile.about);
  document.getElementById("helix-cap").replaceChildren(el("span", null, pk(profile.hero_motif_label)), el("br"), el("span", null, profile.hero_motif || "CCGCGNGGNGGCAG"));
  const chips = [link(t("hero_jump"), "#projects", "chip primary")];
  for (const l of contact.links) chips.push(link(l.label, l.url));
  if (contact.email) chips.push(link("Email", `mailto:${contact.email}`));
  document.getElementById("hero-chips").replaceChildren(...chips);
}

function renderSkillsTable() {
  const rows = normalizeSkills(state.content.skills);
  document.getElementById("skills-meta").textContent = t("skills_track_meta", { n: rows.length });
  document.getElementById("skills-legend").textContent = t("skills_legend");
  const tbody = document.querySelector("#vcf tbody");
  tbody.replaceChildren(...rows.map((s) => {
    const tr = el("tr");
    tr.appendChild(el("td", "chrom", `chr${s.chrom}`));
    tr.appendChild(el("td", "id", s.name));
    const af = el("td");
    if (s.af == null) af.textContent = "—";
    else { const bar = el("span", "af"); const fill = el("i"); fill.style.width = `${s.af * 100}%`; bar.appendChild(fill); af.append(bar, s.af.toFixed(2)); }
    tr.appendChild(af);
    tr.appendChild(el("td", null, s.dp == null ? "—" : `${s.dp}y`));
    tr.appendChild(el("td", "pass", "PASS"));
    tr.appendChild(el("td", "chrom", s.info));
    return tr;
  }));
}

function renderContact() {
  const { contact } = state.content;
  document.getElementById("contact-meta").textContent = t("contact_track_meta");
  const card = (k, v, href) => { const a = link("", href, ""); a.append(el("span", "k", k), el("span", "v", v)); return a; };
  const cards = [];
  if (contact.email) cards.push(card("email", contact.email, `mailto:${contact.email}`));
  for (const l of contact.links) cards.push(card(l.label.toLowerCase(), l.url.replace(/^https?:\/\/(www\.)?/, ""), l.url));
  document.getElementById("export").replaceChildren(...cards);
  document.getElementById("footer-updated").textContent = state.updatedAt ? `${t("footer_updated")}: ${state.updatedAt.slice(0, 10)}` : "";
  const views = document.getElementById("footer-views");
  views.replaceChildren(el("span", "k", t("footer_views")), ...VIEWS.filter((v) => v !== "browser").map((v) => {
    const a = el("a", "chip", t(`view_${v}`)); a.href = viewHref(v); // same tab, and remember the choice like the top bar does
    a.addEventListener("click", () => { try { localStorage.setItem("view", v); } catch { /* ignore */ } });
    return a;
  }));
}

function applyStaticText() {
  document.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = t(n.dataset.i18n); });
}

function visibleSections() {
  const c = state.content;
  const hide = { experience: !c.experience?.length, publications: !c.publications?.length, education: !c.education?.length };
  for (const [id, off] of Object.entries(hide)) document.getElementById(id).hidden = off;
  return Object.keys(SECTION_WEIGHTS).filter((id) => !hide[id]).map((id) => ({ id, label: t(`nav_${id}`), weight: SECTION_WEIGHTS[id] }));
}

function renderAll() {
  applyStaticText();
  renderHero();
  renderSkillsTable();
  renderContact();
  // TASK 9: renderTracks() is called here
  ideogram?.dispose();
  ideogram = initIdeogram(visibleSections(), { reduce });
}

async function init() {
  await boot({ view: "browser", themeFallback: "light", showLocus: true, showTheme: true });
  if (!state.content) return; // redirected to another view
  document.documentElement.dataset.view = "browser";
  renderAll();
  onLang(renderAll);
  startHelix({ canvas: document.getElementById("helix"), ticker: document.getElementById("ticker"), motif: state.content.profile.hero_motif, reduce });
  // TASK 10: initStructureDrawer() is called here
}

init().catch((err) => { console.error(err); showLoadError(); });

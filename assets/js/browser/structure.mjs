import { state, t, pk, el } from "../shell.mjs";
import { normalizePdb } from "../logic.mjs";

const LIB = "https://cdn.jsdelivr.net/npm/3dmol@2.5.5/build/3Dmol-min.js";
const pdbCache = new Map();
let libPromise = null, viewer = null, reduceMotion = false, returnTo = null, openSeq = 0;

function loadLib() {
  if (!libPromise) libPromise = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = LIB; s.onload = res; s.onerror = () => { libPromise = null; rej(new Error("3dmol load failed")); };
    document.head.appendChild(s);
  });
  return libPromise;
}
async function fetchPdb(id) {
  if (!pdbCache.has(id)) {
    const res = await fetch(`https://files.rcsb.org/download/${id}.pdb`);
    if (!res.ok) throw new Error(`RCSB ${id}: HTTP ${res.status}`);
    pdbCache.set(id, await res.text());
  }
  return pdbCache.get(id);
}

function setLoading(msg) { const v = document.getElementById("vload"); v.textContent = msg; v.hidden = !msg; }

export function initStructureDrawer({ reduce }) {
  reduceMotion = reduce;
  const drawer = document.getElementById("drawer");
  document.getElementById("dclose").addEventListener("click", closeStructure);
  drawer.addEventListener("click", (e) => { if (e.target === drawer) closeStructure(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeStructure(); });
}

export function closeStructure() {
  const d = document.getElementById("drawer");
  if (d.hidden) return;
  openSeq++;
  d.hidden = true;
  document.body.style.overflow = "";
  if (viewer) viewer.spin(false);
  returnTo?.focus?.();
}

export async function openStructure(p) {
  const token = ++openSeq;
  const pdb = normalizePdb(p.pdb);
  const d = document.getElementById("drawer");
  returnTo = document.activeElement;
  d.hidden = false;
  document.body.style.overflow = "hidden";
  document.getElementById("dclose").textContent = t("structure_close");
  document.getElementById("d-eyebrow").textContent = `${p.year} · ${p.venue}`;
  document.getElementById("d-title").textContent = p.title;
  document.getElementById("d-role").textContent = p.authors || "";
  document.getElementById("d-blurb").textContent = pk(p.blurb);
  const doi = document.getElementById("d-doi"); doi.href = p.link || "#"; doi.textContent = "DOI"; doi.hidden = !p.link;
  const rcsb = document.getElementById("d-rcsb"); rcsb.hidden = !pdb; if (pdb) { rcsb.href = `https://www.rcsb.org/structure/${pdb}`; rcsb.textContent = `RCSB ${pdb}`; }
  const kv = document.getElementById("d-kv");
  kv.replaceChildren(el("span", null, "gene"), el("b", null, p.gene || "—"), el("span", null, "structure"), el("b", null, pdb || "—"), el("span", null, "render"), el("b", null, "cartoon · spectrum"));
  document.getElementById("dclose").focus();
  const hud = document.getElementById("hud");
  hud.textContent = "";
  if (viewer) { viewer.clear(); viewer.render(); }
  if (!pdb) { setLoading(t("structure_none")); return; }

  setLoading(t("structure_loading"));
  try { await loadLib(); } catch { if (token !== openSeq || d.hidden) return; setLoading(t("structure_lib_failed")); return; }
  if (token !== openSeq || d.hidden) return; // closed or superseded while loading the library
  let pdbText;
  try { pdbText = await fetchPdb(pdb); } catch { if (token !== openSeq || d.hidden) return; setLoading(t("structure_fetch_failed")); return; }
  if (token !== openSeq || d.hidden) return; // closed or superseded while fetching the structure

  try {
    if (!viewer) viewer = $3Dmol.createViewer(document.getElementById("stage"), { backgroundColor: "#0b1118" });
    viewer.clear();
    viewer.addModel(pdbText, "pdb");
    viewer.setStyle({}, {});
    viewer.setStyle({ chain: p.pdb_chain || "A" }, { cartoon: { color: "spectrum" } });
    viewer.setStyle({ resn: ["DA", "DT", "DG", "DC"] }, { stick: { radius: 0.22, colorscheme: "whiteCarbon" } });
    viewer.setStyle({ resn: "ZN" }, { sphere: { radius: 1.1, color: "#e2a63c" } });
    viewer.zoomTo();
    viewer.render();
  } catch (err) {
    console.warn("3Dmol viewer failed:", err);
    viewer = null;
    setLoading(t("structure_lib_failed"));
    return;
  }
  setLoading("");
  if (!reduceMotion) viewer.spin("y", 0.35);
  hud.textContent = `${pdb} · ${p.gene} · ${t("structure_hint")}`;
}

export function resolveInitialLang(stored) {
  if (stored === "en" || stored === "ko") return stored;
  return "en";
}

export function translate(i18n, key, lang) {
  const entry = i18n?.[key];
  const value = entry?.[lang];
  if (value == null) {
    console.warn(`[i18n] missing translation: ${key} (${lang})`);
    return entry?.en ?? entry?.ko ?? key;
  }
  return value;
}

export function repoDescription(repo, overrides, lang) {
  if (lang === "ko") {
    const ko = overrides?.[repo.name]?.description_ko;
    if (ko) return ko;
  }
  return repo.description || "";
}

export function pick(field, lang) {
  if (field == null) return "";
  if (typeof field === "string") return field;
  return field[lang] ?? field.en ?? field.ko ?? "";
}

export function resolveInitialTheme(stored, fallback = "dark") {
  if (stored === "dark" || stored === "light") return stored;
  return fallback;
}

export const VIEWS = ["browser", "run", "classic"];

export function resolveInitialView(stored, query) {
  const q = new URLSearchParams(query || "").get("view");
  if (VIEWS.includes(q)) return q;
  if (VIEWS.includes(stored)) return stored;
  return "browser";
}

export function normalizeSkills(skills) {
  if (!Array.isArray(skills)) return [];
  return skills.map((s) =>
    typeof s === "string"
      ? { name: s, chrom: "other", af: null, dp: null, info: "" }
      : {
          name: String(s.name ?? ""),
          chrom: s.chrom ?? "other",
          af: typeof s.af === "number" ? s.af : null,
          dp: Number.isInteger(s.dp) ? s.dp : null,
          info: s.info ?? "",
        }
  );
}

export function normalizePdb(id) {
  if (id == null) return null;
  const s = String(id).toUpperCase();
  if (/^[0-9][A-Z0-9]{3}$/.test(s)) return s;
  console.warn(`[publications] ignoring malformed pdb id: ${id}`);
  return null;
}

export function normalizeTimeline(tl) {
  if (!tl || !Array.isArray(tl.years) || tl.years.length !== 2 || !Array.isArray(tl.rows)) {
    return { years: [], rows: [], warnings: [] };
  }
  const years = [];
  for (let y = tl.years[0]; y <= tl.years[1]; y++) years.push(y);
  const warnings = [];
  const rows = tl.rows.map((r) => {
    const values = (r.values || []).slice(0, years.length);
    if ((r.values || []).length !== years.length) {
      warnings.push(`skill_timeline row "${r.label?.en ?? "?"}" has ${(r.values || []).length} values, expected ${years.length}`);
    }
    while (values.length < years.length) values.push(0);
    return { label: r.label, values };
  });
  return { years, rows, warnings };
}

function yearMonth(text) {
  const m = /^(\d{4})\.(\d{2})$/.exec(String(text || "").trim());
  return m ? { y: Number(m[1]), m: Number(m[2]) } : null;
}

export function careerYears(careerStart, now) {
  const ym = yearMonth(careerStart);
  if (!ym) return 0;
  const start = ym.y + (ym.m - 1) / 12;
  const end = now.getFullYear() + now.getMonth() / 12;
  return Math.round((end - start) * 10) / 10;
}

export function runId(careerStart) {
  const ym = yearMonth(careerStart);
  if (!ym) return "JAE-00000000";
  return `JAE-${ym.y}${String(ym.m).padStart(2, "0")}01`;
}

const NGS_KEYS = ["bioinformatics", "ica", "illumina", "dragen", "ngs", "clinical-genomics", "clinical genomics",
  "cnv", "sequencing", "bcl-convert", "genomics", "variant"];
const AI_KEYS = ["rag", "llm", "agent", "ai-safety", "evaluation", "mistral", "genai"];
export const CHROMOSOMES = ["chrAI", "chrNGS", "chrInfra"];

function hasKeyword(repo, keys) {
  const topics = (repo.topics || []).map((x) => String(x).toLowerCase());
  const desc = String(repo.description || "").toLowerCase();
  return keys.some((k) => topics.includes(k) || new RegExp(`(^|[^a-z0-9])${k.replace(/[-.]/g, "\\$&")}([^a-z0-9]|$)`).test(desc));
}

export function chromosomeOf(repo, overrides = {}) {
  const forced = overrides?.[repo.name]?.chromosome;
  if (CHROMOSOMES.includes(forced)) return forced;
  if (hasKeyword(repo, NGS_KEYS)) return "chrNGS";
  if (hasKeyword(repo, AI_KEYS)) return "chrAI";
  return "chrInfra";
}

export function exonsOf(repo, overrides = {}) {
  const forced = overrides?.[repo.name]?.exons;
  if (Array.isArray(forced) && forced.length) return forced.slice(0, 6).map((s) => truncateToWidth(String(s), 180));
  const parts = String(repo.description || "")
    .split(/,|;|\+| — |: /)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [repo.name];
  return parts.slice(0, 6).map((s) => truncateToWidth(s, 180)); // ≤26 chars per exon label
}

export function langColorKey(language) {
  return { Python: "C", JavaScript: "G", Shell: "T", HTML: "A" }[language] ?? "N";
}

function fractionalYear(text) {
  const m = /^(\d{4})\.(\d{2})$/.exec(text);
  return m ? Number(m[1]) + (Number(m[2]) - 1) / 12 : null;
}

export function parsePeriod(text, now) {
  const parts = String(text || "").split(/\s*[–-]\s*/).map((s) => s.trim());
  if (parts.length === 0 || parts.length > 2) return null;
  const start = fractionalYear(parts[0]);
  if (start == null) return null;
  if (parts.length === 1) return { start, end: start };
  const end = /^present$/i.test(parts[1]) ? now.getFullYear() + now.getMonth() / 12 : fractionalYear(parts[1]);
  if (end == null) return null;
  return { start, end };
}

export function timelineScale(items, now) {
  const starts = items.map((x) => parsePeriod(x.period, now)?.start).filter((v) => v != null);
  const t0 = starts.length ? Math.floor(Math.min(...starts)) : now.getFullYear() - 1;
  return { t0, t1: now.getFullYear() + 1 };
}

export function layoutGenes(genes, totalKb = 100, minGap = 2) {
  let lens = genes.map((g) => 8 + g.exons.length * 4.5);
  let sum = lens.reduce((a, b) => a + b, 0);
  const room = Math.max(totalKb * 0.5, totalKb - minGap * (genes.length + 1)); // never let gaps eat the whole track
  if (sum > room) { const k = room / sum; lens = lens.map((l) => l * k); sum = room; } // shrink to fit, keep min gaps
  const gap = (totalKb - sum) / (genes.length + 1);
  let pos = gap;
  return genes.map((g, i) => {
    const out = { name: g.name, x0: pos, x1: pos + lens[i] };
    pos += lens[i] + gap;
    return out;
  });
}

export function truncateToWidth(text, px, charPx = 6.9) {
  const max = Math.floor(px / charPx);
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)) + "…";
}

export function groupByChromosome(repos, overrides = {}) {
  const buckets = Object.fromEntries(CHROMOSOMES.map((c) => [c, []]));
  for (const r of repos || []) {
    buckets[chromosomeOf(r, overrides)].push({ ...r, exons: exonsOf(r, overrides), colorKey: langColorKey(r.language) });
  }
  return CHROMOSOMES
    .map((name) => ({ name, genes: buckets[name].sort((a, b) => (b.pushed_at || "").localeCompare(a.pushed_at || "")) }))
    .filter((g) => g.genes.length > 0);
}

function ymToDate(text, day = "01") {
  const m = /^(\d{4})\.(\d{2})$/.exec(String(text || "").trim());
  return m ? `${m[1]}-${m[2]}-${day}` : null;
}

export const LOG_LABELS_EN = { pre: "Pre-run", started: "Run started", lane: "Lane switch", index: "Index read complete", peak: "Peak called", first: "First author", qc: "QC flag", cluster: "Cluster PF", pushed: "pushed" };

export function buildRunLog(content, repos, now, lang, labels = LOG_LABELS_EN) {
  const out = [];
  const careerStart = fractionalYear(content.profile?.career_start || "") ?? -Infinity;
  const exp = (content.experience || [])
    .map((x) => ({ x, p: parsePeriod(x.period, now) }))
    .filter((e) => e.p)
    .sort((a, b) => a.p.start - b.p.start);
  let started = false;
  for (const { x, p } of exp) {
    const date = ymToDate(String(x.period).split(/\s*[–-]\s*/)[0]);
    const org = pick(x.org, lang).split(",")[0];
    if (p.start < careerStart) {
      out.push({ date, level: "PRE", text: `${labels.pre} · ${org} · ${pick(x.title, lang)}` });
    } else if (!started) {
      started = true;
      out.push({ date, level: "INFO", text: `${labels.started} · ${org} · ${pick(x.title, lang)}` });
    } else {
      out.push({ date, level: "INFO", text: `${labels.lane} · ${org} · ${pick(x.title, lang)}` });
    }
  }
  for (const e of content.education || []) {
    const date = ymToDate(e.period);
    if (date) out.push({ date, level: "MARK", text: `${labels.index} · ${pick(e.degree, lang)}` });
  }
  for (const p of content.publications || []) {
    const first = /first/i.test(p.authors || "");
    out.push({ date: `${p.year}-07-01`, level: "MARK", text: `${labels.peak} · ${p.venue}${first ? ` · ${labels.first}` : ""}` });
  }
  const award = content.profile?.award;
  if (award?.year) out.push({ date: `${award.year}-12-01`, level: "NOTE", text: `${labels.qc} · ${pick(award, lang)}` });
  const newest = (repos || []).slice().sort((a, b) => (b.pushed_at || "").localeCompare(a.pushed_at || ""))[0];
  if (newest?.pushed_at) out.push({ date: newest.pushed_at.slice(0, 10), level: "INFO", text: `${labels.cluster} · ${newest.name} ${labels.pushed}` });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

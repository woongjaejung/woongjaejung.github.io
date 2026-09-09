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

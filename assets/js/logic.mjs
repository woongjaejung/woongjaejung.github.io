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

export function resolveInitialTheme(stored) {
  if (stored === "dark" || stored === "light") return stored;
  return "dark";
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

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const content = JSON.parse(readFileSync(new URL("../data/content.json", import.meta.url), "utf8"));

test("profile.career_start is YYYY.MM", () => {
  assert.match(content.profile.career_start, /^\d{4}\.\d{2}$/);
  assert.equal(content.profile.career_start, "2015.03");
});

test("skills are objects with name/chrom/af/dp", () => {
  for (const s of content.skills) {
    assert.equal(typeof s.name, "string");
    assert.ok(["genomics", "ai", "cloud"].includes(s.chrom), `chrom of ${s.name}`);
    assert.ok(s.af >= 0 && s.af <= 1, `af of ${s.name}`);
    assert.ok(Number.isInteger(s.dp) && s.dp >= 0, `dp of ${s.name}`);
  }
  const dp = Object.fromEntries(content.skills.map((s) => [s.name, s.dp]));
  for (const k of ["Machine Learning", "LLM", "GenAI", "GCP", "AWS"]) assert.equal(dp[k], 2, k);
  const pinnedDp = {
    Genomics: 11,
    NGS: 11,
    Epigenomics: 9,
    Multiomics: 6,
    Python: 11,
    "Pipeline Engineering": 9,
  };
  for (const [k, v] of Object.entries(pinnedDp)) assert.equal(dp[k], v, k);
});

test("skill_timeline rows match the year span", () => {
  const { years, rows } = content.skill_timeline;
  assert.deepEqual(years, [2012, 2026]);
  const span = years[1] - years[0] + 1;
  assert.ok(rows.length >= 3);
  for (const r of rows) {
    assert.equal(r.values.length, span, r.label.en);
    assert.equal(r.values.length, 15, r.label.en);
    assert.ok(r.values.every((v) => Number.isInteger(v) && v >= 0 && v <= 4), r.label.en);
    assert.equal(typeof r.label.ko, "string");
  }
});

test("publications carry pdb metadata", () => {
  for (const p of content.publications) {
    assert.ok(p.pdb === null || /^[0-9][A-Z0-9]{3}$/.test(p.pdb), p.title);
    if (p.pdb) assert.match(p.pdb_chain, /^[A-Z]$/);
    assert.equal(typeof p.gene, "string");
    assert.equal(typeof p.blurb.en, "string");
    assert.equal(typeof p.blurb.ko, "string");
  }
  const ctcfTitles = content.publications.filter((p) => p.title.includes("CTCF"));
  assert.equal(ctcfTitles.length, 2);
  for (const p of ctcfTitles) {
    assert.equal(p.pdb, "5T0U", p.title);
    assert.equal(p.pdb_chain, "A", p.title);
  }
  const p53Title = content.publications.find((p) => p.title.includes("p53"));
  assert.ok(p53Title, "p53 publication");
  assert.equal(p53Title.pdb, "1TUP");
  assert.equal(p53Title.pdb_chain, "B");
  const runx3Title = content.publications.find((p) => p.title.includes("RUNX3"));
  assert.ok(runx3Title, "RUNX3 publication");
  assert.equal(runx3Title.pdb, null);
});

test("every new i18n key has en and ko", () => {
  const keys = [
    "view_browser", "view_run", "view_classic", "view_hint", "view_hint_close", "locus_label", "locus_go",
    "projects_track_meta", "projects_track_note", "experience_track_meta", "publications_track_meta",
    "publications_egg_hint", "education_track_meta", "skills_track_meta", "skills_legend", "contact_track_meta",
    "structure_loading", "structure_none", "structure_lib_failed", "structure_fetch_failed", "structure_hint",
    "structure_close", "popup_open_github", "hero_jump", "legend_other", "peak_legend", "nav_skills",
    "run_yield", "run_yield_note", "run_clusters", "run_clusters_note", "run_pubs", "run_qc", "run_flowcell",
    "run_flowcell_note", "run_heat", "run_heat_note", "run_sheet", "run_log", "run_note", "run_status",
    "run_instrument", "run_chemistry", "run_readlength", "run_started", "run_progress",
    "hero_eyebrow", "footer_views", "log_pre", "log_started", "log_lane", "log_index", "log_peak", "log_first", "log_qc",
    "log_cluster", "log_pushed", "log_tail", "unit_years", "unit_projects", "unit_peer_reviewed", "run_first_author",
    "run_instrument_value", "run_chemistry_value", "run_readlength_value", "unit_lanes",
  ];
  for (const k of keys) {
    assert.equal(typeof content.i18n[k]?.en, "string", `${k}.en`);
    assert.equal(typeof content.i18n[k]?.ko, "string", `${k}.ko`);
  }
});

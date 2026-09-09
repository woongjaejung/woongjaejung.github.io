import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSkills, normalizeTimeline, normalizePdb, careerYears, runId,
  chromosomeOf, exonsOf, langColorKey, parsePeriod, timelineScale, layoutGenes, truncateToWidth, groupByChromosome,
  buildRunLog, LOG_LABELS_EN,
} from "../assets/js/logic.mjs";

const repo = (name, description, topics = [], language = "Python", pushed_at = "2026-08-01T00:00:00Z") =>
  ({ name, description, topics, language, pushed_at, stars: 0, html_url: `https://github.com/x/${name}` });

test("normalizeSkills: legacy string array becomes objects with null af/dp", () => {
  assert.deepEqual(normalizeSkills(["Genomics"]), [
    { name: "Genomics", chrom: "other", af: null, dp: null, info: "" },
  ]);
});

test("normalizeSkills: objects pass through with defaults filled", () => {
  const out = normalizeSkills([{ name: "LLM", chrom: "ai", af: 0.8, dp: 2 }]);
  assert.deepEqual(out, [{ name: "LLM", chrom: "ai", af: 0.8, dp: 2, info: "" }]);
});

test("normalizeTimeline: pads short rows, truncates long rows, records warnings", () => {
  const out = normalizeTimeline({ years: [2020, 2022], rows: [
    { label: { en: "A" }, values: [1] },
    { label: { en: "B" }, values: [1, 2, 3, 4] },
    { label: { en: "C" }, values: [0, 1, 2] },
  ]});
  assert.deepEqual(out.years, [2020, 2021, 2022]);
  assert.deepEqual(out.rows.map((r) => r.values), [[1, 0, 0], [1, 2, 3], [0, 1, 2]]);
  assert.equal(out.warnings.length, 2);
});

test("normalizeTimeline: missing input yields empty rows", () => {
  assert.deepEqual(normalizeTimeline(undefined), { years: [], rows: [], warnings: [] });
});

test("normalizeTimeline: invalid year span (too large or descending) yields empty rows with a warning", () => {
  assert.deepEqual(normalizeTimeline({ years: [2012, 202600], rows: [] }),
    { years: [], rows: [], warnings: ["skill_timeline.years span is invalid"] });
  assert.deepEqual(normalizeTimeline({ years: [2020, 2010], rows: [] }),
    { years: [], rows: [], warnings: ["skill_timeline.years span is invalid"] });
});

test("normalizePdb: accepts 4-char ids, upper-cases, rejects garbage", () => {
  assert.equal(normalizePdb("5t0u"), "5T0U");
  assert.equal(normalizePdb(null), null);
  const orig = console.warn; const warned = []; console.warn = (m) => warned.push(m);
  try { assert.equal(normalizePdb("nope!"), null); } finally { console.warn = orig; }
  assert.equal(warned.length, 1);
});

test("careerYears: 2015.03 → 2026-09 is 11.5", () => {
  assert.equal(careerYears("2015.03", new Date(2026, 8, 9)), 11.5);
});

test("runId: JAE-YYYYMMDD from YYYY.MM", () => {
  assert.equal(runId("2015.03"), "JAE-20150301");
});

test("chromosomeOf: NGS keywords win over AI keywords, override wins over both", () => {
  assert.equal(chromosomeOf(repo("a", "Grounded RAG for support", ["rag"])), "chrAI");
  assert.equal(chromosomeOf(repo("b", "DRAGEN CNV review", ["cnv", "dragen"])), "chrNGS");
  assert.equal(chromosomeOf(repo("c", "clinical genomics EMR bridge", ["ai-safety", "clinical-genomics"])), "chrNGS");
  assert.equal(chromosomeOf(repo("d", "tmux over tailnet", ["tmux"])), "chrInfra");
  assert.equal(chromosomeOf(repo("d", "tmux over tailnet", ["tmux"]), { d: { chromosome: "chrAI" } }), "chrAI");
});

test("chromosomeOf: keywords match whole words only (regression: 'ica' inside 'technical')", () => {
  const fieldrag = repo("fieldrag-v3", "Grounded RAG and agent system for technical field-support QA, with a diagnostic evaluation harness", ["bm25", "evaluation", "llm", "mistral", "rag"]);
  assert.equal(chromosomeOf(fieldrag), "chrAI");
  assert.equal(chromosomeOf(repo("s", "average storage of fragments", ["misc"])), "chrInfra");
  assert.equal(chromosomeOf(repo("s", "runs ICA uploads nightly", [])), "chrNGS");
});

test("exonsOf: splits description on separators, caps at 6, falls back to name", () => {
  assert.deepEqual(exonsOf(repo("r", "RAG with citations, guarded tools; eval harness + OTel — K8s: Helm")),
    ["RAG with citations", "guarded tools", "eval harness", "OTel", "K8s", "Helm"]);
  assert.deepEqual(exonsOf(repo("r", "a, b, c, d, e, f, g")), ["a", "b", "c", "d", "e", "f"]);
  assert.deepEqual(exonsOf(repo("solo", "one sentence only")), ["solo"]);
  assert.deepEqual(exonsOf(repo("solo", null)), ["solo"]);
  assert.deepEqual(exonsOf(repo("r", "x, y"), { r: { exons: ["custom"] } }), ["custom"]);
  const long = exonsOf(repo("r", "short, a very long clause that keeps going well past the label budget"));
  assert.equal(long[1].length, 26);
  assert.ok(long[1].endsWith("…"));
  const overrideLong = exonsOf(repo("r", "x, y"), {
    r: { exons: ["a very long override label that exceeds the twenty-six character budget", "b", "c", "d", "e", "f", "g"] },
  });
  assert.equal(overrideLong.length, 6);
  assert.equal(overrideLong[0].length, 26);
  assert.ok(overrideLong[0].endsWith("…"));
});

test("langColorKey maps languages to nucleotide keys", () => {
  assert.equal(langColorKey("Python"), "C");
  assert.equal(langColorKey("JavaScript"), "G");
  assert.equal(langColorKey("Shell"), "T");
  assert.equal(langColorKey("HTML"), "A");
  assert.equal(langColorKey("Rust"), "N");
  assert.equal(langColorKey(null), "N");
});

test("parsePeriod handles range, Present, single point, both dashes, and garbage", () => {
  const now = new Date(2026, 8, 1);
  assert.deepEqual(parsePeriod("2017.02 – 2022.08", now), { start: 2017 + 1 / 12, end: 2022 + 7 / 12 });
  assert.deepEqual(parsePeriod("2022.09 - Present", now), { start: 2022 + 8 / 12, end: 2026 + 8 / 12 });
  assert.deepEqual(parsePeriod("2015.02", now), { start: 2015 + 1 / 12, end: 2015 + 1 / 12 });
  assert.equal(parsePeriod("someday", now), null);
});

test("timelineScale spans floor(min start) to current year + 1", () => {
  const now = new Date(2026, 8, 1);
  const { t0, t1 } = timelineScale([{ period: "2012.02 – 2015.02" }, { period: "2022.09 – Present" }], now);
  assert.equal(t0, 2012);
  assert.equal(t1, 2027);
});

test("layoutGenes places genes in order without overlap inside totalKb", () => {
  const out = layoutGenes([{ name: "a", exons: ["1", "2"] }, { name: "b", exons: ["1"] }], 100);
  assert.equal(out.length, 2);
  assert.ok(out[0].x0 > 0 && out[0].x1 < out[1].x0 && out[1].x1 < 100);
  assert.ok(Math.abs((out[0].x1 - out[0].x0) - (8 + 2 * 4.5)) < 1e-9);
});

test("layoutGenes shrinks genes to fit when they exceed the track", () => {
  const six = ["1", "2", "3", "4", "5", "6"];
  const out = layoutGenes(Array.from({ length: 8 }, (_, i) => ({ name: `g${i}`, exons: six })), 100);
  for (let i = 0; i < out.length; i++) {
    assert.ok(out[i].x0 >= 0 && out[i].x1 <= 100, `gene ${i} inside track`);
    if (i) assert.ok(out[i].x0 - out[i - 1].x1 >= 2 - 1e-9, `gap before gene ${i}`);
  }
});

test("truncateToWidth cuts to the number of characters that fit", () => {
  assert.equal(truncateToWidth("abcdefghij", 6.9 * 5), "abcd…");
  assert.equal(truncateToWidth("abc", 100), "abc");
});

test("groupByChromosome drops empty chromosomes and sorts by pushed_at desc", () => {
  const groups = groupByChromosome([
    repo("old", "rag agent", ["rag"], "Python", "2026-01-01T00:00:00Z"),
    repo("new", "llm evals", ["llm"], "JavaScript", "2026-08-01T00:00:00Z"),
  ], {});
  assert.deepEqual(groups.map((g) => g.name), ["chrAI"]);
  assert.deepEqual(groups[0].genes.map((g) => g.name), ["new", "old"]);
  assert.equal(groups[0].genes[0].colorKey, "G");
  assert.deepEqual(groups[0].genes[1].exons, ["old"]); // no separators in the description → the name is the single exon
});

test("buildRunLog merges sources, marks pre-career entries, sorts ascending", () => {
  const content = {
    profile: { career_start: "2015.03", award: { en: "2024 MVP", ko: "2024 MVP", year: "2024" } },
    experience: [
      { period: "2022.09 – Present", title: { en: "Senior FAS", ko: "시니어" }, org: { en: "Illumina Korea", ko: "일루미나" } },
      { period: "2015.03 – 2017.02", title: { en: "Researcher", ko: "연구원" }, org: { en: "Soongsil", ko: "숭실" } },
      { period: "2012.02 – 2015.02", title: { en: "RA", ko: "조교" }, org: { en: "Immunology", ko: "면역학" } },
    ],
    education: [{ period: "2022.08", degree: { en: "Ph.D.", ko: "박사" }, school: { en: "S", ko: "S" } }],
    publications: [
      { year: "2021", venue: "NAR", authors: "First author", title: "t" },
      { venue: "X", authors: "Co-author" },
    ],
  };
  const repos = [{ name: "newest", pushed_at: "2026-08-16T06:10:36Z" }, { name: "older", pushed_at: "2026-07-01T00:00:00Z" }];
  const log = buildRunLog(content, repos, new Date(2026, 8, 9), "en");
  assert.deepEqual(log.map((l) => l.date), ["2012-02-01", "2015-03-01", "2021-07-01", "2022-08-01", "2022-09-01", "2024-12-01", "2026-08-16"]);
  assert.deepEqual(log.map((l) => l.level), ["PRE", "INFO", "MARK", "MARK", "INFO", "NOTE", "INFO"]);
  assert.equal(log[1].text, "Run started · Soongsil · Researcher");
  assert.equal(log[4].text, "Lane switch · Illumina Korea · Senior FAS");
  assert.equal(log[2].text, "Peak called · NAR · First author");
  assert.equal(log[6].text, "Cluster PF · newest pushed");
  assert.equal(log.length, 7); // year-less publication produces no row
  assert.ok(log.every((l) => !l.date.startsWith("undefined")));
});

test("buildRunLog uses the supplied labels", () => {
  const content = { profile: { career_start: "2015.03" }, experience: [{ period: "2015.03 – Present", title: { en: "R" }, org: { en: "O" } }] };
  const log = buildRunLog(content, [], new Date(2026, 8, 9), "en", { ...LOG_LABELS_EN, started: "런 시작" });
  assert.equal(log[0].text, "런 시작 · O · R");
});

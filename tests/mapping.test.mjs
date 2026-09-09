import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSkills, normalizeTimeline, normalizePdb, careerYears, runId } from "../assets/js/logic.mjs";

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

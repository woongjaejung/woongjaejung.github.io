# Genome Browser Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single bento page with three views of the same data — a genome-browser view (default, `index.html`), a sequencing run-monitor view (`run.html`), and the existing bento page kept as `classic.html`.

**Architecture:** One HTML file per view, all loading the same `data/content.json` + `data/repos.json` through a shared `assets/js/shell.mjs` (state, language/theme/view persistence, top bar). All metaphor mapping (repo → chromosome/exons, period → years, skills normalization, run log) lives in pure functions in `assets/js/logic.mjs` and is unit-tested with `node --test`. Views draw with hand-built SVG/Canvas; the only external library is 3Dmol.js, loaded lazily when a publication peak is clicked.

**Tech Stack:** Static HTML/CSS/ES modules (no build step), GitHub Pages, Node 22 `node --test`, 3Dmol.js 2.5.5 via jsDelivr, Google Fonts (Bricolage Grotesque, IBM Plex Sans, IBM Plex Mono, Noto Sans KR).

**Spec:** `docs/superpowers/specs/2026-09-09-genome-browser-redesign-design.md` — read it first. Approved mockup: `docs/design/genome-browser-mockup.html` (also https://claude.ai/code/artifact/c70e6ce9-e1d6-4abc-825a-0821b417803e). Where this plan and the mockup disagree on visuals, the mockup wins; where they disagree on data values, the spec wins.

## Global Constraints

- No build step, no bundler, no framework. ES modules only (`<script type="module">`). Local preview must use `python3 -m http.server 8000` (file:// will not load modules).
- No external JS except `https://cdn.jsdelivr.net/npm/3dmol@2.5.5/build/3Dmol-min.js`, injected only after a publication peak is clicked.
- `data/repos.json` is auto-generated. Never edit it. `.github/workflows/update-repos.yml` and `scripts/*` are not touched.
- Repo is public. Never `git add -A`; add files by name. Never commit `*.docx` or CV material.
- Git author/committer stay as configured (`woongjaej2@gmail.com`). No `Co-Authored-By` trailers, no "Generated with" lines.
- All user-visible strings go through `i18n` keys (en + ko) in `content.json`, or `pick()` for bilingual fields. No hard-coded English in view code except aria fallbacks that mirror an i18n key.
- Career counting starts at `profile.career_start = "2015.03"`. Skill years: Machine Learning, LLM, GenAI, GCP, AWS = 2; Genomics 11, NGS 11, Epigenomics 9, Multiomics 6, Python 11, Pipeline Engineering 9.
- Browser view: light theme default, dark toggle. Run monitor: dark only, theme toggle hidden. Classic: dark default (unchanged).
- Language → colour: Python→C, JavaScript→G, Shell→T, HTML→A, anything else/null→N.
- `prefers-reduced-motion: reduce`: helix draws one static frame, 3D viewer does not spin, scrolls are instant.
- Every clickable SVG glyph gets `tabindex="0"`, `role="button"`, `aria-label`, and Enter/Space handling.
- SVG text is set with `textContent`; never put JSON strings into `innerHTML`.
- Work on branch `redesign/genome-browser` (create a worktree with superpowers:using-git-worktrees). `main` must keep working until the branch is merged, because `main` is the live site.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `data/content.json` | modify | new fields: `profile.career_start`, `profile.award`, `profile.hero_motif(_label)`, `skills` objects, `skill_timeline`, `publications[].pdb/pdb_chain/gene/blurb`, new `i18n` keys |
| `tests/content.test.mjs` | create | schema guard for the fields above |
| `assets/js/logic.mjs` | extend | pure functions (existing five stay unchanged in behaviour) |
| `tests/logic.test.mjs` | extend | `resolveInitialTheme` fallback, `resolveInitialView` |
| `tests/mapping.test.mjs` | create | all new mapping functions |
| `assets/js/shell.mjs` | create | JSON load, `state`, lang/theme/view storage, top bar + hint bar, view redirect |
| `assets/css/base.css` | create | shared tokens for the top bar/hint bar, used by all three views |
| `classic.html` | create (git mv from `index.html`) | current bento page + top-bar view switch |
| `assets/js/main.js` | modify | mount shared view switch; skills accept objects |
| `assets/css/style.css` | modify | style for the view-switch links inside `#site-nav` |
| `index.html` | recreate | genome browser view markup |
| `assets/css/browser.css` | create | browser view styles (from mockup) |
| `assets/js/browser/index.js` | create | browser entry: boot, hero, contact, skills table, wiring |
| `assets/js/browser/ideogram.mjs` | create | chromosome nav + locus box + locus input |
| `assets/js/browser/helix.mjs` | create | canvas helix + ticker |
| `assets/js/browser/tracks.mjs` | create | genes, coverage, peaks, markers |
| `assets/js/browser/structure.mjs` | create | 3Dmol drawer |
| `run.html` | create | run monitor markup |
| `assets/css/run.css` | create | run monitor styles |
| `assets/js/run/index.js` | create | run monitor entry |
| `README.md` | modify | three views, new editable fields |

---

### Task 1: Extend `content.json` and guard it with a schema test

**Files:**
- Modify: `data/content.json`
- Create: `tests/content.test.mjs`

**Interfaces:**
- Produces: the JSON shape every later task reads. Field names are exact: `profile.career_start`, `profile.award`, `profile.hero_motif`, `profile.hero_motif_label`, `skills[] = {name, chrom, af, dp, info}`, `skill_timeline = {years:[from,to], rows:[{label:{en,ko}, values:number[]}]}`, `publications[].pdb|null`, `publications[].pdb_chain`, `publications[].gene`, `publications[].blurb:{en,ko}`.

- [ ] **Step 1: Write the failing schema test**

```js
// tests/content.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const content = JSON.parse(readFileSync(new URL("../data/content.json", import.meta.url), "utf8"));

test("profile.career_start is YYYY.MM", () => {
  assert.match(content.profile.career_start, /^\d{4}\.\d{2}$/);
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
});

test("skill_timeline rows match the year span", () => {
  const { years, rows } = content.skill_timeline;
  const span = years[1] - years[0] + 1;
  assert.ok(rows.length >= 3);
  for (const r of rows) {
    assert.equal(r.values.length, span, r.label.en);
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
    "run_instrument_value", "run_chemistry_value", "run_readlength_value",
  ];
  for (const k of keys) {
    assert.equal(typeof content.i18n[k]?.en, "string", `${k}.en`);
    assert.equal(typeof content.i18n[k]?.ko, "string", `${k}.ko`);
  }
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test tests/content.test.mjs`
Expected: FAIL — `career_start` undefined, skills are strings, `skill_timeline` undefined, i18n keys missing.

- [ ] **Step 3: Edit `data/content.json`**

Apply these changes with a small Node script so the existing key order and Korean text are preserved (run from repo root, then delete nothing — it rewrites the file in place):

```js
// one-off: node --input-type=module -e "$(cat <<'EOF'
import { readFileSync, writeFileSync } from "node:fs";
const path = "data/content.json";
const c = JSON.parse(readFileSync(path, "utf8"));

c.profile.career_start = "2015.03";
c.profile.award = { en: "2024 MVP · Asia Middle East Region", ko: "2024 MVP · 아시아·중동 지역", year: "2024" };
c.profile.hero_motif = "CCGCGNGGNGGCAG";
c.profile.hero_motif_label = { en: "CTCF core motif", ko: "CTCF 핵심 모티프" };

c.skills = [
  { name: "Genomics", chrom: "genomics", af: 0.95, dp: 11, info: "WGS/WES · DRAGEN · variant review" },
  { name: "NGS", chrom: "genomics", af: 0.95, dp: 11, info: "Illumina platforms · bcl-convert · QC" },
  { name: "Epigenomics", chrom: "genomics", af: 0.9, dp: 9, info: "ChIP-seq · ATAC-seq · Hi-C · CTCF" },
  { name: "Multiomics", chrom: "genomics", af: 0.75, dp: 6, info: "integration · RNA + chromatin" },
  { name: "Python", chrom: "ai", af: 0.9, dp: 11, info: "pipelines · FastAPI · tooling" },
  { name: "Machine Learning", chrom: "ai", af: 0.7, dp: 2, info: "evaluation · classical ML" },
  { name: "LLM", chrom: "ai", af: 0.8, dp: 2, info: "RAG · agents · eval harnesses" },
  { name: "GenAI", chrom: "ai", af: 0.75, dp: 2, info: "Claude Code · Codex · guarded tools" },
  { name: "GCP", chrom: "cloud", af: 0.7, dp: 2, info: "Vertex · Cloud Run · IAM" },
  { name: "AWS", chrom: "cloud", af: 0.65, dp: 2, info: "EC2 · S3 · Batch" },
  { name: "Pipeline Engineering", chrom: "cloud", af: 0.85, dp: 9, info: "Nextflow-style DAGs · containers · CI" },
];

c.skill_timeline = {
  years: [2012, 2026],
  rows: [
    { label: { en: "Immunology", ko: "면역학" }, values: [3,3,3,1,0,0,0,0,0,0,0,0,0,0,0] },
    { label: { en: "Genomics / NGS", ko: "유전체학 / NGS" }, values: [0,1,2,3,3,4,4,4,4,4,4,4,4,4,4] },
    { label: { en: "Epigenomics", ko: "후성유전체학" }, values: [0,0,1,2,3,4,4,4,4,4,3,2,2,2,2] },
    { label: { en: "Python", ko: "Python" }, values: [1,1,2,3,3,4,4,4,4,4,4,4,4,4,4] },
    { label: { en: "Pipeline eng.", ko: "파이프라인" }, values: [0,0,1,2,3,3,4,4,4,4,4,4,4,4,4] },
    { label: { en: "Cloud (GCP/AWS)", ko: "클라우드" }, values: [0,0,0,0,0,0,0,0,0,0,0,0,0,3,3] },
    { label: { en: "ML", ko: "머신러닝" }, values: [0,0,0,0,0,0,0,0,0,0,0,0,0,3,3] },
    { label: { en: "LLM / agents", ko: "LLM / 에이전트" }, values: [0,0,0,0,0,0,0,0,0,0,0,0,0,4,4] },
    { label: { en: "Field / customer", ko: "필드 / 고객" }, values: [0,0,0,0,0,0,0,0,0,0,2,4,4,4,4] },
  ],
};

const pdbByTitle = [
  [/RUNX3/, { pdb: null, pdb_chain: null, gene: "RUNX3",
    blurb: { en: "No structure is shown for this paper yet. The DOI has the full text.", ko: "이 논문의 구조는 아직 표시하지 않습니다. DOI에서 전문을 볼 수 있습니다." } }],
  [/phase-separated/, { pdb: "5T0U", pdb_chain: "A", gene: "CTCF",
    blurb: { en: "CTCF zinc fingers 2–7 wrapped around DNA — the protein whose loops organise the genome you are scrolling through.", ko: "DNA를 감싼 CTCF 징크핑거 2–7. 지금 스크롤 중인 게놈을 고리로 정리하는 단백질입니다." } }],
  [/Liver-Specific/, { pdb: "5T0U", pdb_chain: "A", gene: "CTCF",
    blurb: { en: "First-author work. Removing CTCF from the mouse liver rewires PPARγ signalling; the structure shows what was removed.", ko: "1저자 논문. 마우스 간에서 CTCF를 제거하면 PPARγ 신호가 재배선됩니다. 구조는 제거된 단백질입니다." } }],
  [/p53/, { pdb: "1TUP", pdb_chain: "B", gene: "p53",
    blurb: { en: "p53 DNA-binding core domain gripping its response element. Chromatin accessibility around such sites is what the paper measured.", ko: "반응 요소를 붙잡은 p53 DNA 결합 도메인. 논문은 이런 자리 주변의 염색질 접근성을 측정했습니다." } }],
];
for (const p of c.publications) {
  const hit = pdbByTitle.find(([re]) => re.test(p.title));
  Object.assign(p, hit ? hit[1] : { pdb: null, pdb_chain: null, gene: "", blurb: { en: "", ko: "" } });
}

Object.assign(c.i18n, {
  nav_skills: { en: "skills", ko: "스킬" },
  view_browser: { en: "Browser", ko: "브라우저" },
  view_run: { en: "Run monitor", ko: "런 모니터" },
  view_classic: { en: "Classic", ko: "클래식" },
  view_hint: { en: "Also available: Run monitor and Classic views.", ko: "런 모니터·클래식 뷰도 있습니다." },
  view_hint_close: { en: "Dismiss", ko: "닫기" },
  locus_label: { en: "locus", ko: "위치" },
  locus_go: { en: "Go", ko: "이동" },
  projects_track_meta: { en: "{n} genes · {k} chromosomes · synced from GitHub daily", ko: "유전자 {n}개 · 염색체 {k}개 · GitHub에서 매일 동기화" },
  projects_track_note: { en: "Exons = feature groups named in the repo description. Click a gene for details.", ko: "엑손 = 저장소 설명에 적힌 기능 단위. 유전자를 클릭하면 상세가 열립니다." },
  experience_track_meta: { en: "coverage track · {t0}–{t1} · {n} regions", ko: "커버리지 트랙 · {t0}–{t1} · 구간 {n}개" },
  publications_track_meta: { en: "peaks · expanded · {n} features", ko: "피크 · 펼침 · {n}개" },
  publications_egg_hint: { en: "click a peak → 3D structure", ko: "피크 클릭 → 3D 구조" },
  education_track_meta: { en: "markers · {n} loci", ko: "마커 · {n}개" },
  skills_track_meta: { en: "variant panel · {n} calls · FILTER=PASS", ko: "변이 패널 · {n}개 · FILTER=PASS" },
  skills_legend: { en: "AF = proficiency · DP = years", ko: "AF = 숙련도 · DP = 연차" },
  contact_track_meta: { en: "export session", ko: "세션 내보내기" },
  structure_loading: { en: "loading 3D viewer…", ko: "3D 뷰어 불러오는 중…" },
  structure_none: { en: "No structure is linked to this paper.", ko: "이 논문에 연결된 구조가 없습니다." },
  structure_lib_failed: { en: "The 3D viewer could not load. The DOI link still works.", ko: "3D 뷰어를 불러오지 못했습니다. DOI 링크는 사용할 수 있습니다." },
  structure_fetch_failed: { en: "The structure could not be fetched from RCSB. Open the RCSB entry instead.", ko: "RCSB에서 구조를 가져오지 못했습니다. RCSB 항목을 대신 열어 보세요." },
  structure_hint: { en: "drag to rotate · scroll to zoom", ko: "드래그로 회전 · 스크롤로 확대" },
  structure_close: { en: "esc · close", ko: "esc · 닫기" },
  popup_open_github: { en: "Open on GitHub ↗", ko: "GitHub에서 열기 ↗" },
  hero_jump: { en: "Jump to projects", ko: "프로젝트로 이동" },
  legend_other: { en: "other", ko: "기타" },
  peak_legend: { en: "red peak = first author · amber = co-author", ko: "빨간 피크 = 1저자 · 호박색 = 공저자" },
  run_yield: { en: "Yield", ko: "산출량" },
  run_yield_note: { en: "counted from Ph.D.", ko: "박사 과정부터 계산" },
  run_clusters: { en: "Clusters PF", ko: "클러스터 PF" },
  run_clusters_note: { en: "public repos, synced daily", ko: "공개 저장소, 매일 동기화" },
  run_pubs: { en: "Publications", ko: "논문" },
  run_qc: { en: "Run QC", ko: "런 QC" },
  run_flowcell: { en: "Flowcell", ko: "플로우셀" },
  run_flowcell_note: { en: "density = description length", ko: "밀도 = 설명 길이" },
  run_heat: { en: "Intensity by cycle", ko: "사이클별 강도" },
  run_heat_note: { en: "skill × year · hand-edited values", ko: "스킬 × 연도 · 직접 편집한 값" },
  run_sheet: { en: "Sample sheet", ko: "샘플 시트" },
  run_log: { en: "Run log", ko: "런 로그" },
  run_note: { en: "Lanes, cycles and intensities are metaphors mapped from the same content.json. No instrument branding is used.", ko: "레인·사이클·강도는 같은 content.json에서 만든 메타포입니다. 특정 장비의 브랜드는 쓰지 않습니다." },
  run_status: { en: "Sequencing · cycle {cycle}", ko: "시퀀싱 중 · 사이클 {cycle}" },
  run_instrument: { en: "Instrument", ko: "장비" },
  run_chemistry: { en: "Chemistry", ko: "케미스트리" },
  run_readlength: { en: "Read length", ko: "리드 길이" },
  run_started: { en: "Started", ko: "시작" },
  run_progress: { en: "cluster gen ✓ · read 1 ✓ · index ✓ · read 2 in progress", ko: "클러스터 생성 ✓ · 리드 1 ✓ · 인덱스 ✓ · 리드 2 진행 중" },
  hero_eyebrow: { en: "chrAbout · p-arm · 1 gene", ko: "chrAbout · p-arm · 유전자 1개" },
  footer_views: { en: "Other views", ko: "다른 뷰" },
  log_pre: { en: "Pre-run", ko: "런 이전" },
  log_started: { en: "Run started", ko: "런 시작" },
  log_lane: { en: "Lane switch", ko: "레인 전환" },
  log_index: { en: "Index read complete", ko: "인덱스 리드 완료" },
  log_peak: { en: "Peak called", ko: "피크 검출" },
  log_first: { en: "First author", ko: "1저자" },
  log_qc: { en: "QC flag", ko: "QC 플래그" },
  log_cluster: { en: "Cluster PF", ko: "클러스터 PF" },
  log_pushed: { en: "pushed", ko: "푸시됨" },
  log_tail: { en: "Read 2 in progress", ko: "리드 2 진행 중" },
  unit_years: { en: "years", ko: "년" },
  unit_projects: { en: "projects", ko: "프로젝트" },
  unit_peer_reviewed: { en: "peer-reviewed", ko: "동료 심사" },
  run_first_author: { en: "{n} first-author", ko: "1저자 {n}편" },
  run_instrument_value: { en: "Field scientist, gen 3", ko: "필드 사이언티스트 3세대" },
  run_chemistry_value: { en: "Genomics + AI", ko: "유전체학 + AI" },
  run_readlength_value: { en: "2 × 150 (EN/KO)", ko: "2 × 150 (한/영)" },
});

const exonOverrides = {
  "claudex5-engineering-harness": ["role routing", "review gates", "Claude + Codex", "installable"],
  "dragen-cnv-plot-builder-showcase": ["exon-level CNV", "interactive HTML", "artifact vs true call", "Electron"],
  "fieldrag-v3": ["grounded RAG", "agent", "diagnostic evals", "BM25"],
  "ICA_CSV_Batch_Runner_showcase": ["preflight checks", "CSV batch", "ICA API"],
  "ICA_usage_dashboard_showcase": ["usage analytics", "FastAPI", "pandas"],
  "bclconvert_ubuntu_version": ["container wrapper", "bcl-convert"],
  "tailterm": ["ttyd", "Tailscale serve", "PWA shell", "no public ports"],
};
c.repo_overrides = c.repo_overrides || {};
for (const [name, exons] of Object.entries(exonOverrides)) c.repo_overrides[name] = { ...(c.repo_overrides[name] || {}), exons };

writeFileSync(path, JSON.stringify(c, null, 2) + "\n");
EOF
)"
```

- [ ] **Step 4: Keep the live bento renderer working with skill objects**

`assets/js/main.js:98-104` renders `state.content.skills` as strings. Replace `renderSkills` so the page keeps working from this commit on (the `normalizeSkills` helper is added to `logic.mjs` in this same step so the branch never has a broken page):

```js
// assets/js/logic.mjs — append
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
```

```js
// assets/js/main.js — add normalizeSkills to the import from "./logic.mjs", then:
function renderSkills() {
  const wrap = document.getElementById("skill-list");
  wrap.replaceChildren(
    ...normalizeSkills(state.content.skills).map((s) => el("span", "skill-chip", s.name))
  );
}
```

- [ ] **Step 5: Run the test again**

Run: `node --test tests/content.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 6: Run the whole suite and check the live page**

Run: `node --test` → all pass.
Run: `python3 -m http.server 8000` and `timeout 30 /opt/google/chrome/chrome --headless=new --no-sandbox --disable-gpu --virtual-time-budget=3000 --dump-dom http://localhost:8000/index.html | grep -o 'skill-chip">[^<]*' | head -2`
Expected: `skill-chip">Genomics` and `skill-chip">NGS` (not `[object Object]`).

- [ ] **Step 7: Commit**

```bash
git add data/content.json tests/content.test.mjs assets/js/logic.mjs assets/js/main.js
git commit -m "data: add career_start, skill objects, skill_timeline, publication structures, view i18n"
```

---

### Task 2: Pure functions — skills, timeline, career numbers, theme/view resolution

**Files:**
- Modify: `assets/js/logic.mjs`
- Modify: `tests/logic.test.mjs`
- Create: `tests/mapping.test.mjs`

**Interfaces:**
- Produces (all exported from `assets/js/logic.mjs`):
  - `normalizeSkills(skills) → Array<{name:string, chrom:string, af:number|null, dp:number|null, info:string}>`
  - `normalizeTimeline(tl) → {years:number[], rows:Array<{label, values:number[]}>, warnings:string[]}`
  - `normalizePdb(id) → string|null` (upper-cased 4-char id or null with a console warning)
  - `careerYears(careerStart:string, now:Date) → number` (one decimal)
  - `runId(careerStart:string) → string` e.g. `"JAE-20150301"`
  - `resolveInitialTheme(stored, fallback = "dark")` (existing, new second arg)
  - `resolveInitialView(stored, query) → "browser"|"run"|"classic"`

- [ ] **Step 1: Write the failing tests**

Append to `tests/logic.test.mjs`:

```js
test("resolveInitialTheme: fallback argument is used when nothing is stored", () => {
  assert.equal(resolveInitialTheme(null, "light"), "light");
  assert.equal(resolveInitialTheme("dark", "light"), "dark");
  assert.equal(resolveInitialTheme(null), "dark");
});

test("resolveInitialView: query beats storage, storage beats default", () => {
  assert.equal(resolveInitialView(null, ""), "browser");
  assert.equal(resolveInitialView("run", ""), "run");
  assert.equal(resolveInitialView("classic", "?view=browser"), "browser");
  assert.equal(resolveInitialView("garbage", "?view=nope"), "browser");
});
```
and add `resolveInitialView` to the import list at the top of that file.

Create `tests/mapping.test.mjs`:

```js
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
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `node --test`
Expected: FAIL — the new exports do not exist.

- [ ] **Step 3: Implement in `assets/js/logic.mjs`**

Change the existing `resolveInitialTheme` and append the rest:

```js
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

// normalizeSkills already exists (added in Task 1) — do not add a second copy.

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
```

- [ ] **Step 4: Run tests**

Run: `node --test`
Expected: PASS. Existing `resolveInitialTheme` tests still pass because the default fallback is `"dark"`.

- [ ] **Step 5: Commit**

```bash
git add assets/js/logic.mjs tests/logic.test.mjs tests/mapping.test.mjs
git commit -m "feat(logic): skills/timeline normalization, career numbers, view resolution"
```

---

### Task 3: Pure functions — repo classification, exons, period parsing, gene layout, truncation

**Files:**
- Modify: `assets/js/logic.mjs`
- Modify: `tests/mapping.test.mjs`

**Interfaces:**
- Produces:
  - `chromosomeOf(repo, overrides) → "chrAI"|"chrNGS"|"chrInfra"`
  - `exonsOf(repo, overrides) → string[]` (1..6)
  - `langColorKey(language) → "A"|"C"|"G"|"T"|"N"`
  - `parsePeriod(text, now) → {start:number, end:number}|null` (fractional years)
  - `timelineScale(items, now) → {t0:number, t1:number}` where `items` have `period`
  - `layoutGenes(genes, totalKb = 100) → Array<{name, x0, x1}>` in kb, `genes[] = {name, exons:string[]}`
  - `truncateToWidth(text, px, charPx = 6.9) → string`
  - `groupByChromosome(repos, overrides) → Array<{name, genes:Array<repo & {exons, colorKey}>}>` — only non-empty chromosomes, order chrAI, chrNGS, chrInfra; genes sorted by `pushed_at` desc.

- [ ] **Step 1: Write the failing tests** (append to `tests/mapping.test.mjs`; extend the import line)

```js
import {
  chromosomeOf, exonsOf, langColorKey, parsePeriod, timelineScale, layoutGenes, truncateToWidth, groupByChromosome,
} from "../assets/js/logic.mjs";

const repo = (name, description, topics = [], language = "Python", pushed_at = "2026-08-01T00:00:00Z") =>
  ({ name, description, topics, language, pushed_at, stars: 0, html_url: `https://github.com/x/${name}` });

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
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `node --test tests/mapping.test.mjs`
Expected: FAIL — missing exports.

- [ ] **Step 3: Implement in `assets/js/logic.mjs`** (append)

```js
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
  if (Array.isArray(forced) && forced.length) return forced.slice(0, 6);
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
  const room = totalKb - minGap * (genes.length + 1);
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
```

- [ ] **Step 4: Run tests**

Run: `node --test`
Expected: PASS (all files).

- [ ] **Step 5: Commit**

```bash
git add assets/js/logic.mjs tests/mapping.test.mjs
git commit -m "feat(logic): chromosome/exon mapping, period parsing, gene layout"
```

---
### Task 4: Pure function — `buildRunLog`

**Files:**
- Modify: `assets/js/logic.mjs`
- Modify: `tests/mapping.test.mjs`

**Interfaces:**
- Produces: `buildRunLog(content, repos, now, lang, labels = LOG_LABELS_EN) → Array<{date:string, level:"PRE"|"INFO"|"MARK"|"NOTE", text:string}>` sorted ascending by `date` (`YYYY-MM-DD`). Uses `pick()` for bilingual fields; every fixed word comes from `labels` (`{pre, started, lane, index, peak, first, qc, cluster, pushed}`) so the view can pass translated strings. `LOG_LABELS_EN` is exported.
- Rules (from spec §Run log): experience start → `INFO` "Lane switch · {org} · {title}" (first one after `career_start` says "Run started"; entries starting before `career_start` are `PRE`); education → `MARK` "Index read complete · {degree}"; publications → `MARK` "Peak called · {venue}{ · First author}" dated `{year}-07-01`; `profile.award` → `NOTE` "QC flag · {award}" dated `{year}-12-01`; newest repo (max `pushed_at`) → `INFO` "Cluster PF · {name} pushed" dated from `pushed_at`.

- [ ] **Step 1: Write the failing test** (append to `tests/mapping.test.mjs`; add `buildRunLog` and `LOG_LABELS_EN` to the import)

```js
test("buildRunLog merges sources, marks pre-career entries, sorts ascending", () => {
  const content = {
    profile: { career_start: "2015.03", award: { en: "2024 MVP", ko: "2024 MVP", year: "2024" } },
    experience: [
      { period: "2022.09 – Present", title: { en: "Senior FAS", ko: "시니어" }, org: { en: "Illumina Korea", ko: "일루미나" } },
      { period: "2015.03 – 2017.02", title: { en: "Researcher", ko: "연구원" }, org: { en: "Soongsil", ko: "숭실" } },
      { period: "2012.02 – 2015.02", title: { en: "RA", ko: "조교" }, org: { en: "Immunology", ko: "면역학" } },
    ],
    education: [{ period: "2022.08", degree: { en: "Ph.D.", ko: "박사" }, school: { en: "S", ko: "S" } }],
    publications: [{ year: "2021", venue: "NAR", authors: "First author", title: "t" }],
  };
  const repos = [{ name: "newest", pushed_at: "2026-08-16T06:10:36Z" }, { name: "older", pushed_at: "2026-07-01T00:00:00Z" }];
  const log = buildRunLog(content, repos, new Date(2026, 8, 9), "en");
  assert.deepEqual(log.map((l) => l.date), ["2012-02-01", "2015-03-01", "2021-07-01", "2022-08-01", "2022-09-01", "2024-12-01", "2026-08-16"]);
  assert.deepEqual(log.map((l) => l.level), ["PRE", "INFO", "MARK", "MARK", "INFO", "NOTE", "INFO"]);
  assert.equal(log[1].text, "Run started · Soongsil · Researcher");
  assert.equal(log[4].text, "Lane switch · Illumina Korea · Senior FAS");
  assert.equal(log[2].text, "Peak called · NAR · First author");
  assert.equal(log[6].text, "Cluster PF · newest pushed");
});

test("buildRunLog uses the supplied labels", () => {
  const content = { profile: { career_start: "2015.03" }, experience: [{ period: "2015.03 – Present", title: { en: "R" }, org: { en: "O" } }] };
  const log = buildRunLog(content, [], new Date(2026, 8, 9), "en", { ...LOG_LABELS_EN, started: "런 시작" });
  assert.equal(log[0].text, "런 시작 · O · R");
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `node --test tests/mapping.test.mjs`
Expected: FAIL — `buildRunLog` is not exported.

- [ ] **Step 3: Implement** (append to `assets/js/logic.mjs`)

```js
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
```

- [ ] **Step 4: Run tests**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add assets/js/logic.mjs tests/mapping.test.mjs
git commit -m "feat(logic): buildRunLog for the run monitor view"
```

---

### Task 5: Shared shell — `shell.mjs` + `base.css`

**Files:**
- Create: `assets/js/shell.mjs`
- Create: `assets/css/base.css`

**Interfaces:**
- Consumes: `resolveInitialLang`, `resolveInitialTheme`, `resolveInitialView`, `translate`, `pick`, `VIEWS` from `logic.mjs`.
- Produces (exports of `assets/js/shell.mjs`):
  - `state = { lang, theme, view, content, repos, updatedAt, now }`
  - `boot({ view, themeFallback, showLocus, showTheme }) → Promise<state>` — loads JSON, applies theme, renders the top bar into `#topbar`, redirects if a stored view differs (only when `view === "browser"` and the URL has no `?view=`), shows the first-visit hint bar.
  - `t(key, vars?)` → translated string with `{name}` substitution
  - `pk(field)` → `pick(field, state.lang)`
  - `onLang(fn)` → registers a re-render callback; `setLang(lang)` calls them all
  - `el(tag, className?, text?)` → element helper
  - `viewHref(view)` → `"index.html" | "run.html" | "classic.html"`
- The top bar markup it renders (ids are relied on by later tasks):

```html
<div class="topbar" id="topbar">
  <a class="brand" href="index.html?view=browser">jae.genome <small id="build-label"></small></a>
  <nav class="views" aria-label="View">
    <a data-view="browser" href="index.html?view=browser" aria-current="page">Browser</a>
    <a data-view="run" href="run.html">Run monitor</a>
    <a data-view="classic" href="classic.html">Classic</a>
  </nav>
  <form class="locus" id="locus-form" hidden>
    <label for="locus"></label><input id="locus"><button class="go" type="submit"></button>
  </form>
  <button id="lang-toggle" class="tb-toggle"></button>
  <button id="theme-toggle" class="tb-toggle"></button>
</div>
<div class="hintbar" id="hintbar" hidden><span></span><button type="button"></button></div>
```

- [ ] **Step 1: Write `assets/js/shell.mjs`**

```js
import {
  resolveInitialLang, resolveInitialTheme, resolveInitialView, translate, pick, VIEWS,
} from "./logic.mjs";

export const state = {
  lang: "en", theme: "dark", view: "browser", content: null, repos: null, updatedAt: null, now: new Date(),
};

const listeners = [];
export function onLang(fn) { listeners.push(fn); }

function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
function write(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } }

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function t(key, vars) {
  let s = translate(state.content.i18n, key, state.lang);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
export function pk(field) { return pick(field, state.lang); }
export function viewHref(view) { return { browser: "index.html", run: "run.html", classic: "classic.html" }[view]; }

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

export function setTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  write("theme", theme);
  renderToggleLabels();
}

export function setLang(lang) {
  state.lang = lang;
  document.documentElement.lang = lang;
  write("lang", lang);
  renderTopbarText();
  listeners.forEach((fn) => fn());
}

function renderToggleLabels() {
  const ko = state.lang === "ko";
  const lt = document.getElementById("lang-toggle");
  if (lt) { lt.textContent = ko ? "EN" : "KO"; lt.setAttribute("aria-label", ko ? "영어로 전환" : "Switch to Korean"); }
  const tt = document.getElementById("theme-toggle");
  if (tt) {
    const toLight = state.theme === "dark";
    tt.textContent = toLight ? "LIGHT" : "DARK";
    tt.setAttribute("aria-label", toLight ? (ko ? "밝은 테마로 전환" : "Switch to light theme") : (ko ? "어두운 테마로 전환" : "Switch to dark theme"));
  }
}

function renderTopbarText() {
  document.querySelectorAll("#topbar .views a").forEach((a) => { a.textContent = t(`view_${a.dataset.view}`); });
  const form = document.getElementById("locus-form");
  if (form) { form.querySelector("label").textContent = t("locus_label"); form.querySelector("button").textContent = t("locus_go"); }
  const hint = document.getElementById("hintbar");
  if (hint) { hint.querySelector("span").textContent = t("view_hint"); hint.querySelector("button").textContent = t("view_hint_close"); }
  renderToggleLabels();
}

function renderTopbar({ view, showLocus, showTheme }) {
  const bar = document.getElementById("topbar");
  const brand = el("a", "brand", "jae.genome ");
  brand.href = "index.html?view=browser"; // never bounce through the stored-view redirect
  brand.appendChild(el("small", null, state.updatedAt ? `hg-jae · build ${state.updatedAt.slice(0, 7).replace("-", ".")}` : "hg-jae"));
  const views = el("nav", "views");
  views.setAttribute("aria-label", "View");
  for (const v of VIEWS) {
    const a = el("a", null, "");
    a.dataset.view = v;
    a.href = v === "browser" ? "index.html?view=browser" : viewHref(v);
    if (v === view) a.setAttribute("aria-current", "page");
    a.addEventListener("click", () => write("view", v));
    views.appendChild(a);
  }
  const form = el("form", "locus");
  form.id = "locus-form";
  form.hidden = !showLocus;
  const label = el("label"); label.htmlFor = "locus";
  const input = el("input"); input.id = "locus"; input.value = "chrCareer";
  const go = el("button", "go"); go.type = "submit";
  form.append(label, input, go);
  const lt = el("button", "tb-toggle"); lt.id = "lang-toggle"; lt.type = "button";
  lt.addEventListener("click", () => setLang(state.lang === "en" ? "ko" : "en"));
  const tt = el("button", "tb-toggle"); tt.id = "theme-toggle"; tt.type = "button";
  tt.hidden = !showTheme;
  tt.addEventListener("click", () => setTheme(state.theme === "dark" ? "light" : "dark"));
  bar.replaceChildren(brand, views, form, lt, tt);

  const hint = el("div", "hintbar"); hint.id = "hintbar";
  hint.hidden = read("view-hint-seen") === "1" || view !== "browser";
  const close = el("button"); close.type = "button";
  close.addEventListener("click", () => { hint.hidden = true; write("view-hint-seen", "1"); });
  hint.append(el("span"), close);
  bar.after(hint);
}

export async function boot({ view, themeFallback = "dark", showLocus = false, showTheme = true }) {
  state.view = view;
  if (view === "browser") {
    const wanted = resolveInitialView(read("view"), location.search);
    if (wanted !== "browser") { location.replace(viewHref(wanted)); return state; }
  }
  setTheme(resolveInitialTheme(read("theme"), themeFallback));
  state.content = await loadJSON("data/content.json");
  try {
    const data = await loadJSON("data/repos.json");
    state.repos = Array.isArray(data.repos) ? data.repos.filter((r) => !(state.content.exclude_repos || []).includes(r.name)) : null;
    state.updatedAt = data.updated_at;
  } catch (err) {
    console.warn("repos.json unavailable:", err);
    state.repos = null;
  }
  renderTopbar({ view, showLocus, showTheme });
  state.lang = resolveInitialLang(read("lang"));
  document.documentElement.lang = state.lang;
  renderTopbarText();
  return state;
}

export function showLoadError() {
  document.body.appendChild(el("p", "load-error",
    "Failed to load page data. Please refresh. / 페이지 데이터를 불러오지 못했습니다. 새로고침해 주세요."));
}
```

Note: `exclude_repos` filtering was previously done in `scripts/transform.mjs` at fetch time; filtering again here is harmless and keeps `content.json` edits effective without waiting for the next Action run.

- [ ] **Step 2: Write `assets/css/base.css`**

```css
/* Shared shell: top bar + hint bar. Tokens here are consumed by browser.css / run.css. */
:root {
  --tb-bg: #ffffff; --tb-ink: #1c2330; --tb-muted: #6a7383; --tb-rule: #d7dbe0; --tb-paper: #f3f4f1; --tb-accent: #2f6fd8;
  --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --sans: "IBM Plex Sans", "Noto Sans KR", system-ui, -apple-system, "Segoe UI", sans-serif;
  --disp: "Bricolage Grotesque", "IBM Plex Sans", "Noto Sans KR", system-ui, sans-serif;
}
:root[data-theme="dark"] { --tb-bg: #161b23; --tb-ink: #e7eaef; --tb-muted: #8b94a1; --tb-rule: #2a313c; --tb-paper: #0f1319; --tb-accent: #5f93ea; }
:root[data-view="run"] { --tb-bg: #0d141b; --tb-ink: #d5dfe6; --tb-muted: #7d8b98; --tb-rule: #1d2833; --tb-paper: #06090d; --tb-accent: #4fb8b1; }

.topbar { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 18px; padding: 10px 20px;
  background: var(--tb-bg); border-bottom: 1px solid var(--tb-rule); color: var(--tb-ink); font-family: var(--sans); }
.topbar .brand { font-family: var(--disp); font-weight: 700; font-size: 17px; letter-spacing: -.01em; color: inherit; text-decoration: none; display: flex; align-items: baseline; gap: 6px; }
.topbar .brand small { font-family: var(--mono); font-weight: 400; font-size: 11px; color: var(--tb-muted); }
.topbar .views { display: flex; border: 1px solid var(--tb-rule); border-radius: 6px; overflow: hidden; }
.topbar .views a { padding: 6px 12px; font-family: var(--mono); font-size: 12px; color: var(--tb-muted); text-decoration: none; border-right: 1px solid var(--tb-rule); }
.topbar .views a:last-child { border-right: 0; }
.topbar .views a[aria-current="page"] { background: var(--tb-ink); color: var(--tb-paper); }
.topbar .locus { margin-left: auto; display: flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 12px; color: var(--tb-muted); }
.topbar .locus input { font: inherit; color: var(--tb-ink); background: var(--tb-paper); border: 1px solid var(--tb-rule); border-radius: 4px; padding: 5px 8px; width: 220px; }
.topbar .locus .go, .topbar .tb-toggle { font: inherit; font-family: var(--mono); font-size: 12px; padding: 5px 10px; border: 1px solid var(--tb-rule); border-radius: 4px; background: none; color: var(--tb-muted); cursor: pointer; }
.topbar .locus[hidden] + .tb-toggle { margin-left: auto; }
.topbar :focus-visible { outline: 2px solid var(--tb-accent); outline-offset: 2px; }
.hintbar { display: flex; gap: 12px; align-items: center; padding: 6px 20px; font-family: var(--mono); font-size: 12px; color: var(--tb-muted); background: var(--tb-paper); border-bottom: 1px solid var(--tb-rule); }
.hintbar button { font: inherit; background: none; border: 0; color: var(--tb-accent); cursor: pointer; padding: 0; }
.load-error { font-family: var(--sans); padding: 24px; }
[hidden] { display: none !important; } /* author display rules above must not defeat the hidden attribute */
@media (max-width: 760px) { .topbar { gap: 10px; padding: 8px 12px; } .topbar .locus input { width: 130px; } .topbar .brand small { display: none; } }
```

- [ ] **Step 3: Smoke test in a browser**

Create a throwaway `smoke.html` (do not commit) in the repo root:

```html
<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="assets/css/base.css"></head>
<body><div id="topbar"></div><script type="module">
import { boot, t } from "./assets/js/shell.mjs";
const s = await boot({ view: "run", showLocus: true });
document.body.append(t("view_hint"), " · ", s.repos.length + " repos");
</script></body></html>
```

Run: `python3 -m http.server 8000` then `timeout 30 /opt/google/chrome/chrome --headless=new --no-sandbox --disable-gpu --virtual-time-budget=3000 --dump-dom http://localhost:8000/smoke.html | grep -c 'aria-current="page"'`
Expected: `1`, and the DOM contains "Also available" and "9 repos". Delete `smoke.html`.

- [ ] **Step 4: Commit**

```bash
git add assets/js/shell.mjs assets/css/base.css
git commit -m "feat(shell): shared data loader, top bar, view/lang/theme persistence"
```

---

### Task 6: Move the bento page to `classic.html` and give it the view switch

**Files:**
- Rename: `index.html` → `classic.html` (`git mv`)
- Modify: `classic.html` (title, canonical, nav)
- Modify: `assets/js/main.js` `init()`
- Modify: `assets/css/style.css:194-215` (`.toggles`)

**Interfaces:**
- Classic keeps its own `main.js` state and toggles; it only writes `localStorage.view = "classic"` when its view links are clicked, and shows links to the other two views inside the existing floating nav.

- [ ] **Step 1: Rename and edit `classic.html`**

```bash
git mv index.html classic.html
```

In `classic.html`:
- `<title>` → `Woongjae (Jae) Jung — Classic view`
- Inside `<div class="toggles">`, before the two existing buttons, add:

```html
<a class="toggle view-link" href="index.html?view=browser" data-view="browser" data-i18n="view_browser"></a>
<a class="toggle view-link" href="run.html" data-view="run" data-i18n="view_run"></a>
```

- [ ] **Step 2: Edit `assets/js/main.js`**

(`renderSkills` already uses `normalizeSkills` since Task 1.) In `init()`, right after the theme-toggle listener, add:

```js
  document.querySelectorAll(".view-link").forEach((a) =>
    a.addEventListener("click", () => {
      try { localStorage.setItem("view", a.dataset.view); } catch { /* ignore */ }
    })
  );
```

`applyStaticText()` already fills `[data-i18n]` nodes, so the link labels get translated for free.

- [ ] **Step 3: Style the links in `assets/css/style.css`** (after the `.toggle:active` rule)

```css
.toggle.view-link { text-decoration: none; color: var(--muted); }
.toggle.view-link:hover { color: var(--accent); }
@media (max-width: 620px) { .toggle { padding: 0.38rem 0.55rem; letter-spacing: 0.06em; } }
```

- [ ] **Step 4: Verify**

Run: `node --test` → PASS.
Run: `python3 -m http.server 8000` and `timeout 30 /opt/google/chrome/chrome --headless=new --no-sandbox --disable-gpu --virtual-time-budget=3000 --dump-dom http://localhost:8000/classic.html | grep -o 'skill-chip">[^<]*' | head -3`
Expected: three chips (`Genomics`, `NGS`, `Epigenomics`) — skills render from objects. Also `grep -c view-link` on the same DOM → `2`.

- [ ] **Step 5: Commit**

```bash
git add classic.html assets/js/main.js assets/css/style.css
git commit -m "feat(classic): move bento page to classic.html with view switch"
```

(The site root now has no `index.html` on this branch until Task 7. That is fine on the feature branch; do not merge before Task 12.)

---
### Task 7: Browser view skeleton — `index.html`, `browser.css`, entry module, hero, skills table, contact, ideogram

**Files:**
- Create: `index.html`
- Create: `assets/css/browser.css`
- Create: `assets/js/browser/index.js`
- Create: `assets/js/browser/ideogram.mjs`

**Interfaces:**
- Consumes: `boot`, `state`, `t`, `pk`, `el`, `onLang`, `showLoadError` from `shell.mjs`; `normalizeSkills` from `logic.mjs`.
- Produces: DOM ids used by Tasks 8–10: `#helix`, `#ticker`, `#helix-cap`, `#genes`, `#coverage`, `#peaks`, `#edu`, `#popup`, `#drawer` (+ children listed in Task 10), section ids `about projects experience publications education skills contact`.
- `ideogram.mjs` exports `initIdeogram(sections, { reduce }) → { dispose() }` where `sections = [{id, label, weight}]`; it draws into `#ideo`, tracks scroll, and wires `#locus-form`. `dispose()` disconnects the observer and the submit listener so a language re-render can rebuild it without leaks.
- `index.js` exports nothing; it defines `renderAll()` and registers it with `onLang`.

- [ ] **Step 1: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="en" data-theme="light" data-view="browser">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Woongjae (Jae) Jung — Bioinformatics · AI</title>
  <meta name="description" content="Portfolio of Woongjae (Jae) Jung — Senior Field Bioinformatics Support Scientist, AI Engineer, Ph.D. Bioinformatics & Epigenomics. Rendered as a genome browser." />
  <meta name="theme-color" content="#f3f4f1" />
  <meta property="og:title" content="Woongjae (Jae) Jung — Bioinformatics · AI" />
  <meta property="og:description" content="Projects as genes, career as coverage, papers as peaks." />
  <meta property="og:type" content="website" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="assets/css/base.css" />
  <link rel="stylesheet" href="assets/css/browser.css" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧬</text></svg>" />
  <script>try{var th=localStorage.getItem("theme");if(th==="dark"||th==="light")document.documentElement.dataset.theme=th;}catch(e){}</script>
</head>
<body>
  <a class="skip-link" href="#projects">Skip to projects</a>
  <div id="topbar" class="topbar"></div>
  <div class="ideo"><div class="ideo-inner"><svg id="ideo" viewBox="0 0 1000 46" preserveAspectRatio="none" aria-label="Section navigation drawn as a chromosome ideogram"></svg></div></div>

  <main class="wrap">
    <section class="hero" id="about">
      <div>
        <p class="eyebrow" id="hero-eyebrow" data-i18n="hero_eyebrow"></p>
        <h1 id="hero-name"></h1>
        <p class="tagline" id="hero-tagline"></p>
        <p class="intro" id="hero-intro"></p>
        <p class="about" id="hero-about"></p>
        <div class="chips" id="hero-chips"></div>
      </div>
      <div class="helix">
        <canvas id="helix" aria-hidden="true"></canvas>
        <div class="helix-cap" id="helix-cap"></div>
        <div class="ticker" aria-hidden="true"><span id="ticker"></span></div>
      </div>
    </section>

    <section class="track" id="projects">
      <div class="track-head"><h2 data-i18n="heading_projects"></h2><span class="meta" id="projects-meta"></span><div class="right legend" id="lang-legend"></div></div>
      <div class="track-body"><svg id="genes" aria-label="Projects drawn as genes on chromosome rows"></svg></div>
      <p class="track-note" id="projects-note"></p>
    </section>

    <section class="track" id="experience">
      <div class="track-head"><h2 data-i18n="heading_experience"></h2><span class="meta" id="experience-meta"></span></div>
      <div class="track-body"><svg id="coverage" viewBox="0 0 1100 230" aria-label="Career timeline drawn as a coverage track"></svg></div>
    </section>

    <section class="track" id="publications">
      <div class="track-head"><h2 data-i18n="heading_publications"></h2><span class="meta" id="publications-meta"></span><div class="right egg-hint" id="egg-hint"></div></div>
      <div class="track-body"><svg id="peaks" aria-label="Publications drawn as peaks"></svg></div>
    </section>

    <section class="track" id="education">
      <div class="track-head"><h2 data-i18n="heading_education"></h2><span class="meta" id="education-meta"></span></div>
      <div class="track-body"><svg id="edu" viewBox="0 0 1100 120" aria-label="Degrees drawn as markers on the career timeline"></svg></div>
    </section>

    <section class="track" id="skills">
      <div class="track-head"><h2 data-i18n="heading_skills"></h2><span class="meta" id="skills-meta"></span><div class="right legend" id="skills-legend"></div></div>
      <div class="track-body table-body">
        <table class="vcf" id="vcf"><thead><tr><th>CHROM</th><th>ID</th><th>AF</th><th>DP</th><th>FILTER</th><th class="info-col">INFO</th></tr></thead><tbody></tbody></table>
      </div>
    </section>

    <section class="track" id="contact">
      <div class="track-head"><h2 data-i18n="heading_contact"></h2><span class="meta" id="contact-meta"></span></div>
      <div class="export" id="export"></div>
      <div class="chips footer-views" id="footer-views"></div>
      <p class="track-note" id="footer-updated"></p>
    </section>
  </main>

  <div class="popup" id="popup" role="dialog" aria-label="Gene details" hidden></div>
  <div class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="Structure viewer" hidden>
    <div class="panel">
      <div class="viewer"><div class="stage" id="stage"></div><div class="loading" id="vload"></div><div class="hud" id="hud"></div></div>
      <div class="side">
        <button class="x" id="dclose" type="button"></button>
        <p class="eyebrow" id="d-eyebrow"></p>
        <h3 id="d-title"></h3>
        <p id="d-role"></p>
        <div class="kv" id="d-kv"></div>
        <p id="d-blurb"></p>
        <div class="btns"><a class="primary" id="d-doi" target="_blank" rel="noopener">DOI</a><a id="d-rcsb" target="_blank" rel="noopener">RCSB</a></div>
      </div>
    </div>
  </div>

  <script type="module" src="assets/js/browser/index.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `assets/css/browser.css`**

Copy the `<style>` block of `docs/design/genome-browser-mockup.html` **from the `:root{` line through the closing `}` of the `@media (prefers-reduced-motion: reduce)` block**, then make these edits:

1. Delete the `.topbar…`, `.brand…`, `.views…`, `.locus…`, `.lang…`, `.gate…`, `.rm…`, `.tile…`, `.panel…`, `.flowcell…`, `.lane…`, `.heat…`, `table.sheet…`, `.idxchip…`, `.log…`, `.classic…`, `.status…`, `.rm-*` rules (they belong to `base.css` / `run.css`), and the `--rm-*` tokens.
2. Replace the two dark blocks. The site uses an explicit `data-theme` attribute, not `prefers-color-scheme`, so keep only:
   ```css
   :root[data-theme="dark"]{ --paper:#0f1319; --surface:#161b23; --ink:#e7eaef; --body:#c3c9d2; --muted:#8b94a1; --rule:#2a313c; --rule-soft:#1f2530;
     --nA:#4cbf78; --nC:#5f93ea; --nG:#f0b247; --nT:#ea6b6b; --nN:#6f7884; --band1:#2c333d; --band2:#4a535e; --band3:#9aa3ae; --track-head:#131820; --hover:#1b212b; --shadow:0 12px 32px rgba(0,0,0,.5); }
   ```
3. Change `.ideo{… top:49px}` to `top:var(--topbar-h,49px)` and add `.hintbar ~ .ideo{top:calc(var(--topbar-h,49px) + 31px)}` so the hint bar does not overlap it. Add `html{scroll-padding-top:120px}`.
4. Delete the mockup's `.hidden{display:none!important}` rule (base.css already provides `[hidden]{display:none!important}`) and delete the copied `--mono`, `--sans`, `--disp` declarations from `:root` — base.css defines them with `"Noto Sans KR"` in the stack and browser.css must not override them.
5. Keep `body{font-family:var(--sans)}` (resolves to base.css's stack, which includes Noto Sans KR); add `.skip-link{position:absolute;left:-999px} .skip-link:focus{left:12px;top:60px;background:var(--surface);padding:8px;z-index:50}`.
6. Add `.table-body{padding:0 0 4px} @media (max-width:600px){ .info-col, table.vcf td:nth-child(6){display:none} .ideo text{display:none} .ideo text.current{display:block} }`.
7. Add `.footer-views{padding:0 16px 14px;align-items:center} .footer-views .k{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-right:4px}`; add `.popup{position:fixed}` override (the popup is positioned with viewport coordinates in Task 9) and `.drawer .side .x{cursor:pointer;background:none;border:0}`.

- [ ] **Step 3: Write `assets/js/browser/ideogram.mjs`**

```js
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const SHADES = ["var(--band1)", "var(--band2)", "var(--band1)", "var(--band3)", "var(--band2)", "var(--band1)", "var(--band2)"];

export function initIdeogram(sections, { reduce }) {
  const svg = document.getElementById("ideo");
  svg.replaceChildren();
  const disposers = [];
  const total = sections.reduce((s, x) => s + x.weight, 0);
  let x = 0;
  const labels = new Map();
  sections.forEach((s, i) => {
    const w = (s.weight / total) * 1000;
    const band = svgEl("rect", { x, y: 10, width: w, height: 16, fill: SHADES[i % SHADES.length], class: "band", rx: i === 0 ? 8 : 0, tabindex: 0, role: "button", "aria-label": s.label });
    const go = () => document.getElementById(s.id).scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    band.addEventListener("click", go);
    band.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    svg.appendChild(band);
    if (s.id === "experience") svg.appendChild(svgEl("circle", { cx: x, cy: 18, r: 6, fill: "var(--cen)" }));
    const text = svgEl("text", { x: x + w / 2, y: 41, "text-anchor": "middle" });
    text.textContent = s.label;
    svg.appendChild(text);
    labels.set(s.id, text);
    s.x0 = x; s.x1 = x + w; x += w;
  });
  const loc = svgEl("rect", { class: "loc", x: 0, y: 6, width: sections[0].x1, height: 24, rx: 2 });
  svg.appendChild(loc);

  const input = document.getElementById("locus");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const s = sections.find((s) => s.id === e.target.id);
      loc.setAttribute("x", s.x0); loc.setAttribute("width", s.x1 - s.x0);
      labels.forEach((txt, id) => txt.classList.toggle("current", id === s.id));
      if (input) input.value = `chr${s.label[0].toUpperCase()}${s.label.slice(1)}`;
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => io.observe(document.getElementById(s.id)));
  disposers.push(() => io.disconnect());

  const form = document.getElementById("locus-form");
  const onSubmit = (e) => {
    e.preventDefault();
    const v = input.value.toLowerCase().replace(/^chr/, "");
    const s = sections.find((s) => s.label.toLowerCase().startsWith(v.slice(0, 4)) || s.id.startsWith(v.slice(0, 4)));
    if (s) document.getElementById(s.id).scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  };
  form?.addEventListener("submit", onSubmit);
  disposers.push(() => form?.removeEventListener("submit", onSubmit));
  return { dispose() { disposers.forEach((fn) => fn()); } };
}
```

- [ ] **Step 4: Write `assets/js/browser/index.js`** (hero, chips, skills table, contact, wiring; track/helix/structure calls are added in Tasks 8–10 at the marked lines)

```js
import { boot, state, t, pk, el, onLang, showLoadError, viewHref } from "../shell.mjs";
import { normalizeSkills, VIEWS } from "../logic.mjs";
import { initIdeogram } from "./ideogram.mjs";

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
  views.replaceChildren(el("span", "k", t("footer_views")), ...VIEWS.filter((v) => v !== "browser").map((v) => link(t(`view_${v}`), viewHref(v), "chip")));
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
  // TASK 8: startHelix(...) is called here
  // TASK 10: initStructureDrawer() is called here
}

init().catch((err) => { console.error(err); showLoadError(); });
```

- [ ] **Step 5: Verify in headless Chrome**

Run: `python3 -m http.server 8000` and
`timeout 40 /opt/google/chrome/chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --window-size=1280,1800 --virtual-time-budget=4000 --screenshot=/tmp/claude-0/browser-skeleton.png http://localhost:8000/index.html`
Expected: hero text, empty track frames with headers, skills table with 11 rows, contact cards, ideogram with 7 bands. No console errors: run the same URL with `--dump-dom | grep -c 'load-error'` → `0`.

- [ ] **Step 6: Commit**

```bash
git add index.html assets/css/browser.css assets/js/browser/index.js assets/js/browser/ideogram.mjs
git commit -m "feat(browser): view skeleton, hero, skills panel, contact, ideogram nav"
```

---

### Task 8: Helix hero canvas + ticker

**Files:**
- Create: `assets/js/browser/helix.mjs`
- Modify: `assets/js/browser/index.js` (replace the `// TASK 8` comment)

**Interfaces:**
- Produces: `startHelix({ canvas, ticker, motif, reduce }) → { stop() }`. Draws the two-strand helix with base-pair rungs coloured by nucleotide, animates with `requestAnimationFrame` unless `reduce`, pauses when the canvas leaves the viewport or the tab is hidden. Fills `ticker` with the motif repeated six times, each base wrapped in `<b class="A|C|G|T">` (built with `createElement`, not `innerHTML`).

- [ ] **Step 1: Write `assets/js/browser/helix.mjs`**

```js
const COLORS = { A: "#2f9c5c", C: "#2f6fd8", G: "#e39b1f", T: "#d24b4b", N: "#9aa3ae" };

export function startHelix({ canvas, ticker, motif = "CCGCGNGGNGGCAG", reduce }) {
  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, raf = 0, phase = 0.6, visible = true, running = false;

  function size() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const dark = () => document.documentElement.dataset.theme === "dark";

  function draw(tt) {
    ctx.clearRect(0, 0, w, h);
    const cy = h / 2 - 8, amp = Math.min(70, h * 0.28), n = 34, gap = w / (n - 1);
    const rungs = [];
    for (let i = 0; i < n; i++) {
      const ph = i * 0.42 + tt;
      rungs.push({ x: i * gap, y1: cy + Math.sin(ph) * amp, y2: cy + Math.sin(ph + Math.PI) * amp, z: Math.cos(ph), b: motif[i % motif.length] });
    }
    const rung = (r, front) => {
      ctx.strokeStyle = COLORS[r.b] || COLORS.N; ctx.globalAlpha = front ? 0.55 + 0.45 * r.z : 0.35 + 0.35 * (1 + r.z);
      ctx.lineWidth = front ? 2.5 : 2; ctx.beginPath(); ctx.moveTo(r.x, r.y1); ctx.lineTo(r.x, r.y2); ctx.stroke();
      if (front) { ctx.fillStyle = COLORS[r.b] || COLORS.N; ctx.beginPath(); ctx.arc(r.x, (r.y1 + r.y2) / 2, 2.2, 0, 7); ctx.fill(); }
    };
    rungs.filter((r) => r.z < 0).forEach((r) => rung(r, false));
    const strand = dark() ? "rgba(231,234,239,.9)" : "rgba(28,35,48,.85)";
    for (const off of [0, Math.PI]) {
      ctx.strokeStyle = strand; ctx.lineWidth = 2.2;
      for (let i = 1; i < n * 4; i++) {
        const ph0 = (i - 1) * 0.105 + tt + off, ph1 = i * 0.105 + tt + off;
        ctx.globalAlpha = 0.35 + 0.65 * (Math.cos(ph1) + 1) / 2;
        ctx.beginPath(); ctx.moveTo((i - 1) * gap / 4, cy + Math.sin(ph0) * amp); ctx.lineTo(i * gap / 4, cy + Math.sin(ph1) * amp); ctx.stroke();
      }
    }
    rungs.filter((r) => r.z >= 0).forEach((r) => rung(r, true));
    ctx.globalAlpha = 1;
  }

  function loop() { phase += 0.012; draw(phase); raf = requestAnimationFrame(loop); }
  function start() { if (reduce || running || !visible || document.hidden) return; running = true; raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  size(); draw(phase);
  addEventListener("resize", () => { size(); draw(phase); });
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; visible ? start() : stop(); }).observe(canvas);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  new MutationObserver(() => draw(phase)).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  start();

  ticker.replaceChildren();
  const text = Array(6).fill(motif).join("···");
  for (const ch of text) {
    if ("ACGT".includes(ch)) { const b = document.createElement("b"); b.className = ch; b.textContent = ch; ticker.appendChild(b); }
    else ticker.appendChild(document.createTextNode(ch));
  }
  return { stop };
}
```

- [ ] **Step 2: Wire it in `assets/js/browser/index.js`**

Add `import { startHelix } from "./helix.mjs";` and replace the `// TASK 8` line with:

```js
  startHelix({ canvas: document.getElementById("helix"), ticker: document.getElementById("ticker"), motif: state.content.profile.hero_motif, reduce });
```

- [ ] **Step 3: Verify**

Screenshot as in Task 7 Step 5 → the helix is drawn in the hero's right column with coloured rungs; the ticker line under it shows coloured bases. Also run with reduced motion: add `--force-prefers-reduced-motion` to the chrome command → still one static helix frame (the page must not be blank).

- [ ] **Step 4: Commit**

```bash
git add assets/js/browser/helix.mjs assets/js/browser/index.js
git commit -m "feat(browser): canvas helix hero with motif ticker"
```

---

### Task 9: Tracks — genes with popup, coverage, peaks, education markers

**Files:**
- Create: `assets/js/browser/tracks.mjs`
- Modify: `assets/js/browser/index.js` (replace the `// TASK 9` comment)

**Interfaces:**
- Consumes: `groupByChromosome`, `layoutGenes`, `parsePeriod`, `timelineScale`, `truncateToWidth`, `normalizePdb`, `repoDescription` from `logic.mjs`; `state`, `t`, `pk`, `el` from `shell.mjs`.
- Produces: `renderTracks({ reduce, onPeak })` where `onPeak(publication)` is supplied by Task 10 (until then, pass `() => {}`). Draws into `#genes`, `#coverage`, `#peaks`, `#edu`, fills `#projects-meta`, `#projects-note`, `#lang-legend`, `#experience-meta`, `#publications-meta`, `#egg-hint`, `#education-meta`, and manages the `#popup`.
- Shared constants exported for tests/other modules: `TL = 120`, `TR = 1080`.

- [ ] **Step 1: Write `assets/js/browser/tracks.mjs`**

```js
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
  const top = 34, rowH = 70;
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
      grp.appendChild(text({ x: x0, y: y + 24, class: "genelbl" }, g.name));
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
  svg.appendChild(text({ x: TL - 8, y: base - items.length * unit - 12, class: "rowlbl", "text-anchor": "end" }, "depth"));
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
    const label = text({ x: x + 24, y: y + 2, class: "peaklbl" }, truncateToWidth(p.title, TR - x - 24));
    const full = svgEl("title"); full.textContent = p.title; label.appendChild(full);
    g.appendChild(label);
    const pdb = normalizePdb(p.pdb);
    const meta = [p.year, p.venue, p.authors, pdb ? `PDB ${pdb}` : null].filter(Boolean).join(" · ");
    g.appendChild(text({ x: x + 24, y: y + 16, class: "peakmeta" }, truncateToWidth(meta, TR - x - 24, 6.3)));
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
  items.forEach(({ e, p }, i) => {
    const x = tx(p.start);
    const crowded = i > 0 && p.start - items[i - 1].p.start <= 2 && !(items[i - 1].dy);
    const dy = crowded ? 32 : 0; items[i].dy = dy;
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
```

- [ ] **Step 2: Wire it in `assets/js/browser/index.js`**

Add `import { renderTracks } from "./tracks.mjs";` and replace the `// TASK 9` line with `renderTracks({ onPeak: (p) => openStructure(p) });` and, until Task 10 lands, add near the top of the file: `let openStructure = () => {};` (Task 10 replaces this with the real import).
- Expected screenshot detail: the 2013 and 2015 degree labels sit on different lines (their starts are exactly 2 years apart, which counts as crowded).

- [ ] **Step 3: Verify**

Screenshot at 1280×2300 as in Task 7. Expected, matching the mockup: three chromosome rows with nine genes; coverage steps 1×→4× with four labels on two alternating lines; four peaks (one red) with titles that end inside the SVG; three education markers with the 2013/2015 pair on different lines. Toggle language with `--dump-dom` after clicking is not possible headlessly; instead temporarily set `localStorage` by loading `http://localhost:8000/index.html?view=browser` after running once with `lang=ko` stored via the smoke page pattern from Task 5 — or simply open the page in a real browser and press KO: all track headers, notes and labels switch to Korean.

- [ ] **Step 4: Commit**

```bash
git add assets/js/browser/tracks.mjs assets/js/browser/index.js
git commit -m "feat(browser): gene, coverage, peak and marker tracks with gene popup"
```

---
### Task 10: 3D structure drawer (3Dmol.js, lazy, fetched from RCSB)

**Files:**
- Create: `assets/js/browser/structure.mjs`
- Modify: `assets/js/browser/index.js` (replace the `// TASK 10` comment and the `let openStructure` stub)

**Interfaces:**
- Consumes: `#drawer` and its children from Task 7 (`#stage #vload #hud #dclose #d-eyebrow #d-title #d-role #d-kv #d-blurb #d-doi #d-rcsb`); `state`, `t`, `pk`, `el` from `shell.mjs`.
- Produces: `initStructureDrawer({ reduce })` (wires close handlers once) and `openStructure(publication)`.
- Network: script `https://cdn.jsdelivr.net/npm/3dmol@2.5.5/build/3Dmol-min.js` (once), structures `https://files.rcsb.org/download/{PDB}.pdb` (cached in a `Map`).

- [ ] **Step 1: Write `assets/js/browser/structure.mjs`**

```js
import { state, t, pk, el } from "../shell.mjs";
import { normalizePdb } from "../logic.mjs";

const LIB = "https://cdn.jsdelivr.net/npm/3dmol@2.5.5/build/3Dmol-min.js";
const pdbCache = new Map();
let libPromise = null, viewer = null, reduceMotion = false, returnTo = null;

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
  d.hidden = true;
  document.body.style.overflow = "";
  if (viewer) viewer.spin(false);
  returnTo?.focus?.();
}

export async function openStructure(p) {
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
  try { await loadLib(); } catch { setLoading(t("structure_lib_failed")); return; }
  let pdb;
  try { pdb = await fetchPdb(pdb); } catch { setLoading(t("structure_fetch_failed")); return; }
  if (d.hidden) return; // closed while loading
  if (!viewer) viewer = $3Dmol.createViewer(document.getElementById("stage"), { backgroundColor: "#0b1118" });
  viewer.clear();
  viewer.addModel(pdb, "pdb");
  viewer.setStyle({}, {});
  viewer.setStyle({ chain: p.pdb_chain || "A" }, { cartoon: { color: "spectrum" } });
  viewer.setStyle({ resn: ["DA", "DT", "DG", "DC"] }, { stick: { radius: 0.22, colorscheme: "whiteCarbon" } });
  viewer.setStyle({ resn: "ZN" }, { sphere: { radius: 1.1, color: "#e2a63c" } });
  viewer.zoomTo();
  viewer.render();
  setLoading("");
  if (!reduceMotion) viewer.spin("y", 0.35);
  hud.textContent = `${pdb} · ${p.gene} · ${t("structure_hint")}`;
}
```

- [ ] **Step 2: Wire it in `assets/js/browser/index.js`**

Remove the `let openStructure = () => {};` stub. Add `import { initStructureDrawer, openStructure } from "./structure.mjs";` and replace the `// TASK 10` line with `initStructureDrawer({ reduce });`. No resize hook is needed — 3Dmol resizes with its container.

- [ ] **Step 3: Verify (manual, real browser)**

Open `http://localhost:8000/` in a browser. Click the CTCF peak → drawer opens, "loading 3D viewer…" then a rotating zinc-finger/DNA cartoon; HUD shows `5T0U · CTCF · drag to rotate · scroll to zoom`. Click the p53 peak → `1TUP` loads without a second script download (check the Network tab: one `3Dmol-min.js`, one `1TUP.pdb`). Click the RUNX3 peak → "No structure is linked to this paper." and no RCSB button. Esc closes and focus returns to the peak. With DevTools "Emulate prefers-reduced-motion: reduce" the structure does not spin.

Headless check that nothing crashed at load: `--dump-dom http://localhost:8000/ | grep -c 'id="drawer"[^>]*hidden'` → `1`.

- [ ] **Step 4: Commit**

```bash
git add assets/js/browser/structure.mjs assets/js/browser/index.js
git commit -m "feat(browser): lazy 3Dmol structure drawer fed from RCSB"
```

---

### Task 11: Run monitor view — `run.html`, `run.css`, `run/index.js`

**Files:**
- Create: `run.html`
- Create: `assets/css/run.css`
- Create: `assets/js/run/index.js`

**Interfaces:**
- Consumes: `boot`, `state`, `t`, `pk`, `el`, `onLang`, `showLoadError` from `shell.mjs`; `groupByChromosome`, `normalizeTimeline`, `careerYears`, `runId`, `buildRunLog`, `repoDescription` from `logic.mjs`.
- Produces: a page that renders header, four tiles, flowcell, heatmap, sample sheet, run log, and re-renders on language change. Theme toggle hidden; `data-theme="dark"` fixed.

- [ ] **Step 1: Write `run.html`**

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark" data-view="run">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Woongjae (Jae) Jung — Run monitor</title>
  <meta name="description" content="Career of Woongjae (Jae) Jung shown as a sequencing run: lanes, cycles, sample sheet." />
  <meta name="theme-color" content="#06090d" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="assets/css/base.css" />
  <link rel="stylesheet" href="assets/css/run.css" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧬</text></svg>" />
</head>
<body class="rm">
  <div id="topbar" class="topbar"></div>
  <main class="wrap">
    <div class="rm-head">
      <div>
        <div class="id" id="run-id"></div>
        <h1 id="run-name"></h1>
        <div class="sub" id="run-sub"></div>
      </div>
      <div class="status">
        <span class="pill"><span class="dot"></span><span id="run-status"></span></span>
        <div class="bar"><i></i></div>
        <div class="cyc" id="run-progress"></div>
      </div>
    </div>
    <div class="rm-grid" id="tiles"></div>
    <div class="rm-two">
      <div class="panel"><div class="ph"><span id="flowcell-title"></span><span class="r" id="flowcell-note"></span></div><div class="pb"><div class="flowcell" id="flowcell"></div></div></div>
      <div class="panel"><div class="ph"><span id="heat-title"></span><span class="r" id="heat-note"></span></div><div class="pb"><svg class="heat" id="heat" aria-label="Skill intensity by year"></svg></div></div>
    </div>
    <div class="rm-two">
      <div class="panel"><div class="ph"><span id="sheet-title"></span><span class="r">SampleSheet.csv</span></div><div class="pb" style="padding:0"><table class="sheet" id="sheet"><thead><tr><th>Sample_ID</th><th>Index</th><th>Description</th></tr></thead><tbody></tbody></table></div></div>
      <div class="panel"><div class="ph"><span id="log-title"></span><span class="r">RunInfo.log</span></div><pre class="log" id="log"></pre></div>
    </div>
    <p class="rm-note" id="run-note"></p>
  </main>
  <script type="module" src="assets/js/run/index.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `assets/css/run.css`**

Copy from `docs/design/genome-browser-mockup.html` every rule that starts with `.rm`, `.status`, `.tile`, `.panel`, `.flowcell`, `.lane`, `.heat`, `table.sheet`, `.idxchip`, `.log`, plus the `@keyframes pulse/fill/blink` and the `--rm-*` tokens, into `run.css`. Then:
1. Put the `--rm-*` tokens in `:root{}` and add `body.rm{margin:0;background:var(--rm-bg);color:var(--rm-text);font-family:var(--sans);min-height:100vh} .wrap{max-width:1180px;margin:0 auto;padding:18px 20px 60px} .rm-head h1{font-family:var(--disp);letter-spacing:-.02em}`.
2. `.lane canvas{opacity:.22}` (spec value).
3. `.lane .nm{overflow-wrap:anywhere}` (no `word-break`).
4. Keep the `@media (prefers-reduced-motion: reduce)` block that disables `.status .dot`, `.status .bar i`, `.log .cur` animations and sets the bar width to 93%.
5. Add `.log{max-height:520px;overflow:auto}`.
6. Replace the mockup's `.rm-grid{…grid-template-columns:repeat(4,1fr)…}` with `.rm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:12px}` and delete its `@media (max-width:820px)` override — the tile count varies (3 or 4) and the grid must reflow at 390px without inline styles. Add `.flowcell .fallback{font-family:var(--sans);color:var(--rm-muted);margin:0}`.

- [ ] **Step 3: Write `assets/js/run/index.js`**

```js
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
  document.getElementById("flowcell-title").textContent = `${t("run_flowcell")} · ${genes().length} lanes`;
  document.getElementById("flowcell-note").textContent = t("run_flowcell_note");
  const fc = document.getElementById("flowcell");
  if (!state.repos) { fc.replaceChildren(el("p", "fallback", t("projects_fallback"))); return; }
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
  const today = state.now.toISOString().slice(0, 10);
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
```

- [ ] **Step 4: Verify**

`timeout 40 /opt/google/chrome/chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --window-size=1280,1900 --virtual-time-budget=4000 --screenshot=/tmp/claude-0/run.png http://localhost:8000/run.html`
Expected: matches mockup v2 — Run ID `JAE-20150301`, Yield `11.5 years`, 9 lanes with faint dots and legible names, heatmap with Korean/English labels, sample sheet, log starting with a `PRE` line. `--dump-dom … | grep -c 'id="theme-toggle"[^>]*hidden'` → `1` (attribute order is class, id, type, hidden).

- [ ] **Step 5: Commit**

```bash
git add run.html assets/css/run.css assets/js/run/index.js
git commit -m "feat(run): sequencing run-monitor view"
```

---

### Task 12: README, cross-view checks, final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update `README.md`**

Replace the first paragraph and add a "Views" section after "How it works":

```markdown
Personal portfolio — bilingual (EN/KO), auto-synced with my GitHub repos, rendered three ways from the same data.

## Views

| URL | View | Notes |
|---|---|---|
| `/` (`index.html`) | Genome browser | default. Projects = genes, career = coverage, papers = peaks (click → 3D structure from RCSB) |
| `/run.html` | Run monitor | the same career as a sequencing run |
| `/classic.html` | Classic | the bento-grid page; fastest path to résumé and links |

The last view you opened is remembered in this browser. `index.html?view=browser` always opens the genome browser.
```

Add rows to the editing table:

```markdown
| Where career counting starts (run monitor yield) | `profile.career_start` (`"YYYY.MM"`) |
| Award shown as Run QC | `profile.award` `{en, ko, year}` (remove to hide the tile) |
| Skill proficiency / years (variant panel) | `skills[]` `{name, chrom, af 0–1, dp years, info}` |
| Skill × year heatmap | `skill_timeline` — `years: [from, to]`, one `values` entry per year (0–4) |
| 3D structure for a paper | `publications[].pdb` (RCSB id or `null`), `pdb_chain`, `gene`, `blurb {en, ko}` |
| Force a repo onto a chromosome / name its exons | `repo_overrides.<repo>.chromosome` (`chrAI`/`chrNGS`/`chrInfra`), `repo_overrides.<repo>.exons` |
```

- [ ] **Step 2: Full test run**

Run: `node --test`
Expected: all pass (content, logic, mapping, transform).

- [ ] **Step 3: Screenshot sweep (record results in the PR/commit message)**

With `python3 -m http.server 8000` running, for each of `index.html`, `run.html`, `classic.html` and each width `1280` and `390`:

```bash
for p in index run classic; do for w in 1280 390; do
  timeout 40 /opt/google/chrome/chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
    --window-size=$w,2400 --virtual-time-budget=4000 --screenshot=/tmp/claude-0/$p-$w.png "http://localhost:8000/$p.html?view=$([ $p = index ] && echo browser || echo $p)"
done; done
```

Look at each image. Pass criteria: no overlapping labels, no text clipped at an SVG edge (peak title and meta lines both end inside the track), tracks scroll horizontally at 390 instead of overflowing the page, hero stacks at 390, top bar fits at 390, run-monitor tiles reflow to two per row at 390, classic nav pills fit at 390.

- [ ] **Step 4: Manual checks in a real browser** (tick each)

- Language toggle on each view switches every label (track headers, notes, tiles, log, hint bar).
- Theme toggle on `index.html` switches to the dark palette and the helix strands turn light; toggle is absent on `run.html`.
- Open `run.html`, then open `/` → redirected to `run.html`; `/index.html?view=browser` → browser view and the stored choice resets when the Browser tab is clicked.
- Keyboard: Tab reaches ideogram bands, genes, peaks; Enter opens popup/drawer; Esc closes and focus returns.
- Reduced motion emulation: helix static, structure not spinning, run-monitor progress bar full without animation.

- [ ] **Step 5: Commit and finish the branch**

```bash
git add README.md
git commit -m "docs: describe the three views and new content.json fields"
```

Then use superpowers:finishing-a-development-branch to merge `redesign/genome-browser` into `main` (fast-forward or merge commit; no squash needed). After the merge, confirm GitHub Pages serves `/`, `/run.html`, `/classic.html`, and that the next scheduled "Update repos data" run still commits `data/repos.json` unchanged in shape.

---

## Self-review notes (already applied)

- Spec coverage: shell/top bar (T5), classic move (T6), browser sections incl. ideogram, hero, tracks, skills, contact (T7–T9), structure drawer with all four error states (T10), run monitor with tiles/flowcell/heat/sheet/log (T11), data schema + i18n keys (T1), pure functions + tests (T2–T4), README (T12). The spec's hint bar and `?view=browser` override live in T5.
- Names used across tasks: `boot/state/t/pk/el/onLang/showLoadError/viewHref` (T5) ↔ T7/T11; `groupByChromosome/layoutGenes/parsePeriod/timelineScale/truncateToWidth` (T3) ↔ T9; `normalizeTimeline/careerYears/runId` (T2) + `buildRunLog` (T4) ↔ T11; `renderTracks({onPeak})` (T9) ↔ `openStructure` (T10); `initIdeogram(sections,{reduce})` (T7).
- Known simplification: the mockup's blocking mode gate is intentionally not built (spec decision).
- Revised 2026-09-09 after an independent pre-implementation review (22 findings): `[hidden]` rule moved to base.css; keyword matching is whole-word/exact-topic; `layoutGenes` shrinks to fit; `normalizeSkills` + main.js change moved into Task 1 so the branch never renders `[object Object]`; run-log and tile words are i18n; peak meta truncated; education crowding uses `<= 2`; tile grid reflows via CSS; brand link bypasses the redirect; ideogram re-init disposes observers; verification greps fixed; exon labels capped and overrides supplied; flowcell fallback; hero eyebrow and footer view links are i18n; inline theme script prevents the light flash; `normalizePdb` guards malformed ids.

# Portfolio Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `wf4006hufman.github.io`에 배포되는 한/영 전환 가능한 정적 포트폴리오 페이지 + GitHub Actions 기반 repo 자동 반영 파이프라인.

**Architecture:** 프레임워크 없는 정적 사이트. 자동 데이터(`data/repos.json`, Actions가 갱신)와 수동 데이터(`data/content.json`, 사용자 편집)를 파일로 격리한다. 브라우저 JS는 두 JSON을 fetch해 렌더링하며, 순수 로직은 `assets/js/logic.mjs`·`scripts/transform.mjs`로 분리해 `node --test`로 테스트한다.

**Tech Stack:** HTML/CSS/vanilla JS(ES modules), Node 22 (스크립트·테스트, `node:test`), GitHub Actions, GitHub Pages (main 브랜치 루트, Deploy from branch).

**Spec:** `docs/superpowers/specs/2026-07-29-portfolio-page-design.md`

## Global Constraints

- 프레임워크·빌드 도구·npm 의존성 금지. 테스트는 Node 내장 `node:test`만 사용 (`package.json` 불필요).
- 커밋 author/committer는 항상 `Woongjae (Jae) Jung <woongjaej2@gmail.com>` (repo에 `git config` 완료됨). `Co-Authored-By: Claude` 등 AI 서명 트레일러 금지. Actions 워크플로우 커밋도 동일 identity.
- `data/repos.json`은 자동 생성 파일 — 수동 편집하는 태스크를 만들지 않는다 (초기 1회 생성은 스크립트 실행으로).
- 모든 사용자 노출 정적 텍스트는 en/ko 두 언어 제공. repo 설명만 영어 fallback 허용.
- 페이지 섹션 순서: About(+Skills) → Projects → Experience → Publications → Education → Contact.
- Experience/Publications/Education은 데이터가 빈 배열이면 섹션과 네비게이션 링크를 함께 숨긴다.
- 로컬 미리보기는 `python3 -m http.server` (ES module과 fetch가 file:// 에서 동작하지 않으므로).

## File Structure

```
index.html                         # 페이지 마크업 (Task 5)
assets/css/style.css               # 스타일 (Task 6)
assets/js/logic.mjs                # 순수 로직: 언어 결정, 번역, 설명 선택 (Task 4)
assets/js/main.js                  # DOM 와이어링, 렌더링 (Task 5)
data/content.json                  # 수동 데이터: i18n, 섹션 내용, 제외 목록, override (Task 3)
data/repos.json                    # 자동 데이터: 스크립트가 생성 (Task 3에서 초기 생성)
scripts/transform.mjs              # 순수 변환: 필터·필드 추출·정렬·안전장치 (Task 1)
scripts/fetch-repos.mjs            # CLI: API 호출 → transform → 파일 쓰기 (Task 2)
tests/transform.test.mjs           # Task 1 테스트
tests/logic.test.mjs               # Task 4 테스트
.github/workflows/update-repos.yml # 자동 업데이트 워크플로우 (Task 7)
README.md                          # 콘텐츠 편집 가이드 (Task 3)
```

---

### Task 1: repo 데이터 변환 모듈 (`transform.mjs`)

**Files:**
- Create: `scripts/transform.mjs`
- Test: `tests/transform.test.mjs`

**Interfaces:**
- Consumes: 없음 (최초 태스크)
- Produces: `transformRepos(apiRepos: object[], opts: {excludeRepos?: string[]}) => {name, description, language, topics, stars, pushed_at, html_url}[]` — fork·제외목록 필터, 필드 추출, `pushed_at` 내림차순 정렬. `assertValidRepos(repos: object[]) => void` — 빈 배열이거나 필수 필드(name, html_url) 누락 시 throw.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/transform.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { transformRepos, assertValidRepos } from "../scripts/transform.mjs";

const apiRepo = (over = {}) => ({
  name: "fieldrag",
  description: "Grounded RAG assistant",
  language: "Python",
  topics: ["rag"],
  stargazers_count: 3,
  pushed_at: "2026-07-05T00:00:00Z",
  html_url: "https://github.com/wf4006hufman/fieldrag",
  fork: false,
  extra_api_field: "must be dropped",
  ...over,
});

test("fork는 제외한다", () => {
  const out = transformRepos([apiRepo(), apiRepo({ name: "f2", fork: true })]);
  assert.deepEqual(out.map((r) => r.name), ["fieldrag"]);
});

test("excludeRepos 목록의 repo는 제외한다", () => {
  const out = transformRepos([apiRepo(), apiRepo({ name: "webflyx" })], {
    excludeRepos: ["webflyx"],
  });
  assert.deepEqual(out.map((r) => r.name), ["fieldrag"]);
});

test("허용된 필드만 추출한다", () => {
  const [r] = transformRepos([apiRepo()]);
  assert.deepEqual(r, {
    name: "fieldrag",
    description: "Grounded RAG assistant",
    language: "Python",
    topics: ["rag"],
    stars: 3,
    pushed_at: "2026-07-05T00:00:00Z",
    html_url: "https://github.com/wf4006hufman/fieldrag",
  });
});

test("null 설명·언어·topics를 기본값으로 채운다", () => {
  const [r] = transformRepos([
    apiRepo({ description: null, language: null, topics: undefined }),
  ]);
  assert.equal(r.description, "");
  assert.equal(r.language, null);
  assert.deepEqual(r.topics, []);
});

test("pushed_at 내림차순 정렬", () => {
  const out = transformRepos([
    apiRepo({ name: "old", pushed_at: "2025-01-01T00:00:00Z" }),
    apiRepo({ name: "new", pushed_at: "2026-07-01T00:00:00Z" }),
  ]);
  assert.deepEqual(out.map((r) => r.name), ["new", "old"]);
});

test("assertValidRepos: 빈 배열이면 throw", () => {
  assert.throws(() => assertValidRepos([]), /empty/i);
});

test("assertValidRepos: 필수 필드 누락 시 throw", () => {
  assert.throws(() => assertValidRepos([{ name: "" }]), /invalid/i);
});

test("assertValidRepos: 정상 배열은 통과", () => {
  assert.doesNotThrow(() =>
    assertValidRepos(transformRepos([apiRepo()]))
  );
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test tests/transform.test.mjs`
Expected: FAIL — `Cannot find module '../scripts/transform.mjs'`

- [ ] **Step 3: 구현**

`scripts/transform.mjs`:

```js
export function transformRepos(apiRepos, { excludeRepos = [] } = {}) {
  return apiRepos
    .filter((r) => !r.fork && !excludeRepos.includes(r.name))
    .map((r) => ({
      name: r.name,
      description: r.description ?? "",
      language: r.language ?? null,
      topics: r.topics ?? [],
      stars: r.stargazers_count ?? 0,
      pushed_at: r.pushed_at,
      html_url: r.html_url,
    }))
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
}

export function assertValidRepos(repos) {
  if (!Array.isArray(repos) || repos.length === 0) {
    throw new Error("repos is empty — refusing to overwrite data/repos.json");
  }
  for (const r of repos) {
    if (!r.name || !r.html_url) {
      throw new Error(`invalid repo entry: ${JSON.stringify(r)}`);
    }
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/transform.test.mjs`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/transform.mjs tests/transform.test.mjs
git commit -m "feat: add repo data transform with safety guard"
```

---

### Task 2: repo 수집 CLI (`fetch-repos.mjs`)

**Files:**
- Create: `scripts/fetch-repos.mjs`

**Interfaces:**
- Consumes: Task 1의 `transformRepos`, `assertValidRepos`. `data/content.json`의 `exclude_repos` (Task 3에서 생성 — 이 태스크 시점에는 파일이 없을 수 있으므로 **파일 없으면 빈 제외 목록으로 동작**해야 한다).
- Produces: 실행 시 `data/repos.json` 파일 `{updated_at: ISO문자열, repos: [...]}`. 실패 시 파일을 쓰지 않고 exit code 1.

CLI는 네트워크·파일IO만 담당하는 얇은 층이므로 단위 테스트 없이 Task 3에서 실제 실행으로 검증한다 (로직은 Task 1에서 테스트 완료).

- [ ] **Step 1: 구현**

`scripts/fetch-repos.mjs`:

```js
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { transformRepos, assertValidRepos } from "./transform.mjs";

const USER = "wf4006hufman";
const OUT = new URL("../data/repos.json", import.meta.url);
const CONTENT = new URL("../data/content.json", import.meta.url);

async function loadExcludes() {
  try {
    const content = JSON.parse(await readFile(CONTENT, "utf8"));
    return content.exclude_repos ?? [];
  } catch {
    return [];
  }
}

async function fetchAllRepos() {
  const headers = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(
    `https://api.github.com/users/${USER}/repos?per_page=100&type=owner`,
    { headers }
  );
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

const excludeRepos = await loadExcludes();
const repos = transformRepos(await fetchAllRepos(), { excludeRepos });
assertValidRepos(repos);

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({ updated_at: new Date().toISOString(), repos }, null, 2) + "\n"
);
console.log(`wrote ${repos.length} repos to data/repos.json`);
```

- [ ] **Step 2: 로컬 실행으로 검증**

Run: `GITHUB_TOKEN=$(gh auth token) node scripts/fetch-repos.mjs`
Expected: `wrote 3 repos to data/repos.json` (fork 없음·제외 목록 아직 없으므로 4개일 수 있음 — webflyx 포함 4개면 정상, Task 3에서 content.json 생성 후 재실행하면 3개)

Run: `node -e "const d=require('./data/repos.json'); console.log(d.repos.map(r=>r.name))"`
Expected: repo 이름 배열 출력, 각 항목에 7개 필드만 존재

- [ ] **Step 3: Commit (repos.json은 Task 3에서 최종 생성해 커밋하므로 스크립트만)**

```bash
git add scripts/fetch-repos.mjs
git commit -m "feat: add fetch-repos CLI"
```

---

### Task 3: 콘텐츠 데이터 + 초기 repos.json + README

**Files:**
- Create: `data/content.json`
- Create: `data/repos.json` (스크립트 실행으로 생성)
- Create: `README.md`

**Interfaces:**
- Consumes: Task 2의 `fetch-repos.mjs`.
- Produces: `content.json` 스키마 — 이후 태스크(4, 5)가 의존하는 키: `profile{name, tagline{en,ko}, about{en,ko}}`, `skills: string[]`, `exclude_repos: string[]`, `repo_overrides: {[name]: {description_ko}}`, `i18n: {[key]: {en, ko}}`, `experience: []`, `publications: []`, `education: []`, `contact{email, links: [{label, url}]}`.

- [ ] **Step 1: `data/content.json` 작성**

```json
{
  "profile": {
    "name": "Woongjae (Jae) Jung",
    "tagline": {
      "en": "Ph.D. Bioinformatics Scientist · NGS · Epigenomics · Multiomics · AI Engineer",
      "ko": "생물정보학 박사 · NGS · 후성유전체학 · 멀티오믹스 · AI 엔지니어"
    },
    "about": {
      "en": "Bioinformatics scientist working at the intersection of next-generation sequencing, epigenomics, multiomics, and AI engineering. I build pipelines and tools that turn raw sequencing data into clinical and research insight.",
      "ko": "차세대 시퀀싱(NGS), 후성유전체학, 멀티오믹스, AI 엔지니어링의 교차점에서 일하는 생물정보학 연구자입니다. 원시 시퀀싱 데이터를 임상·연구 인사이트로 바꾸는 파이프라인과 도구를 만듭니다."
    }
  },
  "skills": ["NGS", "Epigenomics", "Multiomics", "Python", "Machine Learning", "Google Cloud", "Pipeline Engineering"],
  "exclude_repos": ["webflyx"],
  "repo_overrides": {
    "clinical-genomics-emr-bridge": {
      "description_ko": "임상 유전체 리포트–EMR 연동 케이스 스터디 — 승인 게이팅, PHI 안전 드리프트 감지, 적대적 안전성 리뷰 (정제된 포트폴리오)"
    },
    "fieldrag": {
      "description_ko": "NGS 필드 지원을 위한 grounded RAG + 에이전트 어시스턴트 (Google Cloud, Gemini)"
    },
    "bclconvert_ubuntu_version": {
      "description_ko": "Oracle Linux 컨테이너 래퍼로 Ubuntu에서 Illumina bcl-convert 실행"
    }
  },
  "i18n": {
    "nav_about": { "en": "About", "ko": "소개" },
    "nav_projects": { "en": "Projects", "ko": "프로젝트" },
    "nav_experience": { "en": "Experience", "ko": "경력" },
    "nav_publications": { "en": "Publications", "ko": "논문" },
    "nav_education": { "en": "Education", "ko": "학력" },
    "nav_contact": { "en": "Contact", "ko": "연락처" },
    "heading_about": { "en": "About", "ko": "소개" },
    "heading_skills": { "en": "Skills", "ko": "기술" },
    "heading_projects": { "en": "Projects", "ko": "프로젝트" },
    "heading_experience": { "en": "Experience", "ko": "경력" },
    "heading_publications": { "en": "Publications", "ko": "논문" },
    "heading_education": { "en": "Education", "ko": "학력" },
    "heading_contact": { "en": "Contact", "ko": "연락처" },
    "projects_auto_note": {
      "en": "Automatically synced from my GitHub once a day.",
      "ko": "GitHub에서 하루 한 번 자동으로 동기화됩니다."
    },
    "projects_fallback": {
      "en": "Could not load project list — view them directly on GitHub.",
      "ko": "프로젝트 목록을 불러오지 못했습니다 — GitHub에서 직접 확인해 주세요."
    },
    "footer_updated": { "en": "Projects updated", "ko": "프로젝트 갱신" }
  },
  "experience": [],
  "publications": [],
  "education": [],
  "contact": {
    "email": "woongjaej2@gmail.com",
    "links": [
      { "label": "GitHub", "url": "https://github.com/wf4006hufman" }
    ]
  }
}
```

- [ ] **Step 2: JSON 유효성 확인**

Run: `node -e "JSON.parse(require('fs').readFileSync('data/content.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: 초기 repos.json 생성 (이제 제외 목록 적용됨)**

Run: `GITHUB_TOKEN=$(gh auth token) node scripts/fetch-repos.mjs`
Expected: `wrote 3 repos to data/repos.json` — webflyx 제외, `clinical-genomics-emr-bridge`·`bclconvert_ubuntu_version`·`fieldrag`만 포함

- [ ] **Step 4: `README.md` 작성**

````markdown
# wf4006hufman.github.io

Personal portfolio — bilingual (EN/KO), auto-synced with my GitHub repos.

## How it works

- `data/repos.json` — **auto-generated**. A GitHub Action
  (`.github/workflows/update-repos.yml`) refreshes it daily at 00:00 UTC
  (09:00 KST) and on manual dispatch. **Never edit by hand.**
- `data/content.json` — **hand-edited**. Everything else lives here.

## Editing content (`data/content.json`)

| To do this | Edit this |
|---|---|
| Hide a repo from the page | Add its name to `exclude_repos` |
| Korean description for a repo | Add `repo_overrides.<repo-name>.description_ko` |
| Add work experience | Append to `experience`: `{ "period": "2024 –", "title": {"en", "ko"}, "org": {"en", "ko"}, "summary": {"en", "ko"} }` |
| Add a publication | Append to `publications`: `{ "year": "2025", "title": "…", "venue": "…", "authors": "…", "link": "https://…" }` |
| Add education | Append to `education`: `{ "period": "…", "degree": {"en", "ko"}, "school": {"en", "ko"} }` |
| Change bio / skills / contact | `profile`, `skills`, `contact` |

Sections with empty arrays (`experience`, `publications`, `education`) are
hidden automatically, including their nav links.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Refresh repo data manually

Actions tab → "Update repos data" → Run workflow. Or locally:

```bash
GITHUB_TOKEN=$(gh auth token) node scripts/fetch-repos.mjs
```

## Tests

```bash
node --test
```
````

- [ ] **Step 5: Commit**

```bash
git add data/content.json data/repos.json README.md
git commit -m "feat: add content data, initial repos data, and README"
```

---

### Task 4: 프론트엔드 순수 로직 (`logic.mjs`)

**Files:**
- Create: `assets/js/logic.mjs`
- Test: `tests/logic.test.mjs`

**Interfaces:**
- Consumes: 없음 (순수 함수만).
- Produces: `resolveInitialLang(stored: string|null, navigatorLang: string) => "en"|"ko"` · `translate(i18n: object, key: string, lang: string) => string` (누락 시 `console.warn` 후 en→ko→key 순 fallback) · `repoDescription(repo, overrides, lang) => string` · `pick(field: string|{en,ko}|null, lang) => string`.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/logic.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveInitialLang,
  translate,
  repoDescription,
  pick,
} from "../assets/js/logic.mjs";

test("resolveInitialLang: 저장값 우선", () => {
  assert.equal(resolveInitialLang("ko", "en-US"), "ko");
  assert.equal(resolveInitialLang("en", "ko-KR"), "en");
});

test("resolveInitialLang: 저장값 없으면 브라우저 언어", () => {
  assert.equal(resolveInitialLang(null, "ko-KR"), "ko");
  assert.equal(resolveInitialLang(null, "en-US"), "en");
  assert.equal(resolveInitialLang(null, ""), "en");
  assert.equal(resolveInitialLang("garbage", "ja-JP"), "en");
});

test("translate: 키 존재 시 해당 언어", () => {
  const i18n = { hello: { en: "Hello", ko: "안녕하세요" } };
  assert.equal(translate(i18n, "hello", "ko"), "안녕하세요");
});

test("translate: 언어 누락 시 en fallback + 경고", () => {
  const warnings = [];
  const orig = console.warn;
  console.warn = (m) => warnings.push(m);
  try {
    const i18n = { hello: { en: "Hello" } };
    assert.equal(translate(i18n, "hello", "ko"), "Hello");
    assert.equal(translate(i18n, "missing_key", "en"), "missing_key");
    assert.equal(warnings.length, 2);
  } finally {
    console.warn = orig;
  }
});

test("repoDescription: ko 모드에서 override 우선", () => {
  const repo = { name: "fieldrag", description: "RAG assistant" };
  const overrides = { fieldrag: { description_ko: "RAG 어시스턴트" } };
  assert.equal(repoDescription(repo, overrides, "ko"), "RAG 어시스턴트");
  assert.equal(repoDescription(repo, overrides, "en"), "RAG assistant");
  assert.equal(repoDescription(repo, {}, "ko"), "RAG assistant");
  assert.equal(repoDescription({ name: "x", description: "" }, {}, "en"), "");
});

test("pick: 문자열/이중언어/null 처리", () => {
  assert.equal(pick("plain", "ko"), "plain");
  assert.equal(pick({ en: "Univ", ko: "대학교" }, "ko"), "대학교");
  assert.equal(pick({ en: "Univ" }, "ko"), "Univ");
  assert.equal(pick(null, "en"), "");
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test tests/logic.test.mjs`
Expected: FAIL — `Cannot find module '../assets/js/logic.mjs'`

- [ ] **Step 3: 구현**

`assets/js/logic.mjs`:

```js
export function resolveInitialLang(stored, navigatorLang) {
  if (stored === "en" || stored === "ko") return stored;
  return (navigatorLang || "").toLowerCase().startsWith("ko") ? "ko" : "en";
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
```

- [ ] **Step 4: 전체 테스트 통과 확인**

Run: `node --test`
Expected: PASS (Task 1 + Task 4 테스트 전부)

- [ ] **Step 5: Commit**

```bash
git add assets/js/logic.mjs tests/logic.test.mjs
git commit -m "feat: add i18n and rendering logic helpers"
```

---

### Task 5: 페이지 마크업 + DOM 와이어링 (`index.html`, `main.js`)

**Files:**
- Create: `index.html`
- Create: `assets/js/main.js`

**Interfaces:**
- Consumes: Task 4의 `resolveInitialLang`, `translate`, `repoDescription`, `pick`. Task 3의 `content.json`·`repos.json` 스키마.
- Produces: 완성된 페이지 DOM. `index.html`의 id 계약(Task 6 CSS가 사용): `site-nav`, `lang-toggle`, `about`, `projects`, `project-grid`, `experience`, `publications`, `education`, `contact`. 클래스 계약: `.card`, `.tag`, `.skill-chip`, `.section`, `.entry`.

- [ ] **Step 1: `index.html` 작성**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Woongjae (Jae) Jung — Bioinformatics · AI</title>
  <meta name="description" content="Portfolio of Woongjae (Jae) Jung — Ph.D. Bioinformatics Scientist (NGS, Epigenomics, Multiomics, AI)." />
  <link rel="stylesheet" href="assets/css/style.css" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧬</text></svg>" />
</head>
<body>
  <header id="site-nav">
    <nav>
      <a class="brand" href="#top">WJ</a>
      <div class="nav-links">
        <a href="#about" data-i18n="nav_about"></a>
        <a href="#projects" data-i18n="nav_projects"></a>
        <a href="#experience" data-i18n="nav_experience" data-section-link="experience"></a>
        <a href="#publications" data-i18n="nav_publications" data-section-link="publications"></a>
        <a href="#education" data-i18n="nav_education" data-section-link="education"></a>
        <a href="#contact" data-i18n="nav_contact"></a>
      </div>
      <button id="lang-toggle" type="button" aria-label="Switch language">KO</button>
    </nav>
  </header>

  <main id="top">
    <section class="hero">
      <h1 id="hero-name"></h1>
      <p id="hero-tagline" class="tagline"></p>
    </section>

    <section id="about" class="section">
      <h2 data-i18n="heading_about"></h2>
      <p id="about-text"></p>
      <h3 data-i18n="heading_skills"></h3>
      <div id="skill-list" class="chip-row"></div>
    </section>

    <section id="projects" class="section">
      <h2 data-i18n="heading_projects"></h2>
      <p class="muted" data-i18n="projects_auto_note"></p>
      <div id="project-grid"></div>
      <p id="projects-updated" class="muted small"></p>
    </section>

    <section id="experience" class="section" hidden>
      <h2 data-i18n="heading_experience"></h2>
      <div id="experience-list"></div>
    </section>

    <section id="publications" class="section" hidden>
      <h2 data-i18n="heading_publications"></h2>
      <ol id="publication-list"></ol>
    </section>

    <section id="education" class="section" hidden>
      <h2 data-i18n="heading_education"></h2>
      <div id="education-list"></div>
    </section>

    <section id="contact" class="section">
      <h2 data-i18n="heading_contact"></h2>
      <div id="contact-links" class="chip-row"></div>
    </section>
  </main>

  <footer>
    <p class="muted small">© <span id="year"></span> Woongjae (Jae) Jung</p>
  </footer>

  <script type="module" src="assets/js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: `assets/js/main.js` 작성**

```js
import {
  resolveInitialLang,
  translate,
  repoDescription,
  pick,
} from "./logic.mjs";

const state = { lang: "en", content: null, repos: null, updatedAt: null };

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function applyStaticText() {
  const { i18n } = state.content;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = translate(i18n, node.dataset.i18n, state.lang);
  });
  document.documentElement.lang = state.lang;
  document.getElementById("lang-toggle").textContent =
    state.lang === "en" ? "KO" : "EN";

  const { profile } = state.content;
  document.getElementById("hero-name").textContent = profile.name;
  document.getElementById("hero-tagline").textContent = pick(
    profile.tagline,
    state.lang
  );
  document.getElementById("about-text").textContent = pick(
    profile.about,
    state.lang
  );
}

function renderSkills() {
  const wrap = document.getElementById("skill-list");
  wrap.replaceChildren(
    ...state.content.skills.map((s) => el("span", "skill-chip", s))
  );
}

function renderProjects() {
  const grid = document.getElementById("project-grid");
  const updated = document.getElementById("projects-updated");
  const { i18n, repo_overrides } = state.content;

  if (!state.repos) {
    const fallback = el("p", "muted", translate(i18n, "projects_fallback", state.lang) + " ");
    const link = el("a", null, "github.com/wf4006hufman");
    link.href = "https://github.com/wf4006hufman";
    fallback.appendChild(link);
    grid.replaceChildren(fallback);
    updated.textContent = "";
    return;
  }

  grid.replaceChildren(
    ...state.repos.map((repo) => {
      const card = el("article", "card");
      const title = el("h3");
      const link = el("a", null, repo.name);
      link.href = repo.html_url;
      link.target = "_blank";
      link.rel = "noopener";
      title.appendChild(link);
      card.appendChild(title);
      card.appendChild(
        el("p", null, repoDescription(repo, repo_overrides, state.lang))
      );
      const meta = el("div", "card-meta");
      if (repo.language) meta.appendChild(el("span", "lang-dot", repo.language));
      if (repo.stars > 0) meta.appendChild(el("span", null, `★ ${repo.stars}`));
      card.appendChild(meta);
      if (repo.topics.length) {
        const tags = el("div", "chip-row");
        repo.topics.forEach((t) => tags.appendChild(el("span", "tag", t)));
        card.appendChild(tags);
      }
      return card;
    })
  );

  updated.textContent = state.updatedAt
    ? `${translate(i18n, "footer_updated", state.lang)}: ${state.updatedAt.slice(0, 10)}`
    : "";
}

function renderEntrySection(sectionId, listId, items, build) {
  const section = document.getElementById(sectionId);
  const navLink = document.querySelector(`[data-section-link="${sectionId}"]`);
  const empty = !items || items.length === 0;
  section.hidden = empty;
  if (navLink) navLink.hidden = empty;
  if (empty) return;
  document.getElementById(listId).replaceChildren(...items.map(build));
}

function renderLists() {
  const lang = state.lang;

  renderEntrySection("experience", "experience-list", state.content.experience, (x) => {
    const entry = el("div", "entry");
    entry.appendChild(el("span", "entry-period", x.period));
    const body = el("div");
    body.appendChild(el("strong", null, pick(x.title, lang)));
    body.appendChild(el("div", "muted", pick(x.org, lang)));
    if (x.summary) body.appendChild(el("p", "small", pick(x.summary, lang)));
    entry.appendChild(body);
    return entry;
  });

  renderEntrySection("publications", "publication-list", state.content.publications, (p) => {
    const li = el("li", "entry");
    if (p.link) {
      const a = el("a", null, p.title);
      a.href = p.link;
      a.target = "_blank";
      a.rel = "noopener";
      li.appendChild(a);
    } else {
      li.appendChild(el("span", null, p.title));
    }
    li.appendChild(el("div", "muted small", [p.authors, p.venue, p.year].filter(Boolean).join(" · ")));
    return li;
  });

  renderEntrySection("education", "education-list", state.content.education, (e) => {
    const entry = el("div", "entry");
    entry.appendChild(el("span", "entry-period", e.period));
    const body = el("div");
    body.appendChild(el("strong", null, pick(e.degree, lang)));
    body.appendChild(el("div", "muted", pick(e.school, lang)));
    entry.appendChild(body);
    return entry;
  });
}

function renderContact() {
  const wrap = document.getElementById("contact-links");
  const { contact } = state.content;
  const nodes = [];
  if (contact.email) {
    const a = el("a", "contact-link", contact.email);
    a.href = `mailto:${contact.email}`;
    nodes.push(a);
  }
  contact.links.forEach((l) => {
    const a = el("a", "contact-link", l.label);
    a.href = l.url;
    a.target = "_blank";
    a.rel = "noopener";
    nodes.push(a);
  });
  wrap.replaceChildren(...nodes);
}

function renderAll() {
  applyStaticText();
  renderSkills();
  renderProjects();
  renderLists();
  renderContact();
}

function setLang(lang) {
  state.lang = lang;
  localStorage.setItem("lang", lang);
  renderAll();
}

async function init() {
  state.content = await loadJSON("data/content.json");
  try {
    const data = await loadJSON("data/repos.json");
    state.repos = data.repos;
    state.updatedAt = data.updated_at;
  } catch (err) {
    console.warn("repos.json unavailable:", err);
    state.repos = null;
  }
  document.getElementById("year").textContent = String(new Date().getFullYear());
  document
    .getElementById("lang-toggle")
    .addEventListener("click", () => setLang(state.lang === "en" ? "ko" : "en"));
  setLang(resolveInitialLang(localStorage.getItem("lang"), navigator.language));
}

init().catch((err) => {
  console.error(err);
  document.body.appendChild(
    el("p", "muted", "Failed to load page data. Please refresh.")
  );
});
```

- [ ] **Step 3: 로컬 미리보기로 검증 (스타일 없이 내용만)**

Run: `python3 -m http.server 8000 &` 후 `curl -s http://localhost:8000/ | grep -c data-i18n`
Expected: 13 (data-i18n 속성 개수)

브라우저 확인이 어려운 환경이면: `curl -s http://localhost:8000/data/content.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{JSON.parse(s);console.log('json ok')})"`
Expected: `json ok`

가능하면 브라우저(또는 browse 도구)에서: 페이지 로드 → 프로젝트 카드 3개 렌더 확인, KO 토글 → 한국어 전환 + repo 한국어 설명 확인, Experience/Publications/Education 섹션·네비 링크 숨김 확인.

- [ ] **Step 4: Commit**

```bash
git add index.html assets/js/main.js
git commit -m "feat: add page markup and rendering"
```

---

### Task 6: 스타일 (`style.css`)

**Files:**
- Create: `assets/css/style.css`

**Interfaces:**
- Consumes: Task 5의 id/클래스 계약 (`site-nav`, `lang-toggle`, `project-grid`, `.card`, `.tag`, `.skill-chip`, `.section`, `.entry`, `.chip-row`, `.muted`, `.small`, `.hero`, `.tagline`, `.card-meta`, `.lang-dot`, `.contact-link`, `.entry-period`, `.brand`, `.nav-links`).
- Produces: 완성 스타일. 방향: 참고 사이트의 차분한 미니멀 + 트렌디한 디테일 — 타이포그래피 중심, 절제된 teal 액센트, 카드 hover 인터랙션, `prefers-color-scheme` 다크 모드. 구현 시 frontend-design 스킬을 로드해 아래 코드를 출발점으로 다듬는다.

- [ ] **Step 1: frontend-design 스킬 로드 후 `assets/css/style.css` 작성**

아래는 완성 기준을 담은 출발점 코드다. frontend-design 스킬의 가이드에 따라 다듬되, 색·간격 토큰 구조와 다크 모드 지원은 유지한다.

```css
:root {
  --bg: #fdfdfc;
  --fg: #1a1d1e;
  --muted: #6b7280;
  --border: #e5e7eb;
  --accent: #0d9488;
  --accent-soft: #0d94881a;
  --card-bg: #ffffff;
  --max-width: 46rem;
  font-family: "Pretendard Variable", Pretendard, -apple-system,
    BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", "Malgun Gothic",
    sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #101314;
    --fg: #e7e9ea;
    --muted: #9ca3af;
    --border: #2a2f31;
    --accent: #2dd4bf;
    --accent-soft: #2dd4bf1f;
    --card-bg: #16191b;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

.muted { color: var(--muted); }
.small { font-size: 0.85rem; }

/* ── nav ─────────────────────────────── */
#site-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(12px);
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  border-bottom: 1px solid var(--border);
}

#site-nav nav {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0.75rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.brand {
  font-weight: 800;
  letter-spacing: 0.05em;
  color: var(--fg);
}

.nav-links {
  display: flex;
  gap: 0.9rem;
  flex-wrap: wrap;
  margin-left: auto;
}

.nav-links a { color: var(--muted); font-size: 0.9rem; }
.nav-links a:hover { color: var(--accent); text-decoration: none; }

#lang-toggle {
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--fg);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}
#lang-toggle:hover { border-color: var(--accent); color: var(--accent); }

/* ── layout ──────────────────────────── */
main {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 1.25rem 4rem;
}

.hero { padding: 5rem 0 2.5rem; }

.hero h1 {
  margin: 0;
  font-size: clamp(2rem, 6vw, 2.8rem);
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.tagline { color: var(--muted); font-size: 1.05rem; margin-top: 0.6rem; }

.section { padding: 2.5rem 0; border-top: 1px solid var(--border); }

.section h2 {
  font-size: 1.15rem;
  letter-spacing: -0.01em;
  margin: 0 0 1.2rem;
}

.section h2::before {
  content: "";
  display: inline-block;
  width: 0.55em;
  height: 0.55em;
  margin-right: 0.5em;
  border-radius: 2px;
  background: var(--accent);
}

.section h3 { font-size: 0.95rem; margin: 1.6rem 0 0.7rem; }

/* ── chips / tags ────────────────────── */
.chip-row { display: flex; flex-wrap: wrap; gap: 0.45rem; }

.skill-chip, .tag {
  font-size: 0.78rem;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
}

.tag { background: transparent; border: 1px solid var(--border); color: var(--muted); }

.contact-link {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.35rem 0.9rem;
  font-size: 0.9rem;
  transition: border-color 0.2s;
}
.contact-link:hover { border-color: var(--accent); text-decoration: none; }

/* ── project cards ───────────────────── */
#project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.9rem;
  margin-top: 1rem;
}

.card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1.1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.card:hover {
  transform: translateY(-3px);
  border-color: var(--accent);
  box-shadow: 0 8px 24px -12px var(--accent-soft);
}

.card h3 { margin: 0; font-size: 1rem; }
.card p { margin: 0; font-size: 0.88rem; color: var(--muted); flex: 1; }

.card-meta {
  display: flex;
  gap: 0.9rem;
  font-size: 0.8rem;
  color: var(--muted);
}

.lang-dot::before {
  content: "";
  display: inline-block;
  width: 0.6em;
  height: 0.6em;
  margin-right: 0.35em;
  border-radius: 50%;
  background: var(--accent);
}

/* ── entries (experience / education / pubs) ── */
.entry {
  display: grid;
  grid-template-columns: 7.5rem 1fr;
  gap: 0.4rem 1rem;
  padding: 0.7rem 0;
}

.entry-period { color: var(--muted); font-size: 0.85rem; padding-top: 0.15rem; }

#publication-list { padding-left: 1.2rem; }
#publication-list .entry { display: block; }

footer {
  border-top: 1px solid var(--border);
  padding: 1.5rem 1.25rem;
  text-align: center;
}

@media (max-width: 480px) {
  .entry { grid-template-columns: 1fr; gap: 0.1rem; }
  .nav-links { gap: 0.6rem; }
}

@media (prefers-reduced-motion: reduce) {
  .card, #lang-toggle, .contact-link { transition: none; }
  .card:hover { transform: none; }
}
```

- [ ] **Step 2: 시각 검증**

Run: `python3 -m http.server 8000 &` 후 브라우저(또는 browse 도구)에서 확인:
- 라이트/다크 모드 각각에서 대비·가독성 확인
- 모바일 폭(375px)에서 카드 1열, 네비게이션 줄바꿈 확인
- KO/EN 전환 시 레이아웃 깨짐 없는지 확인

브라우저가 없으면 최소한: `curl -sI http://localhost:8000/assets/css/style.css | head -1` → `HTTP/1.0 200 OK`

- [ ] **Step 3: Commit**

```bash
git add assets/css/style.css
git commit -m "feat: add styling with dark mode support"
```

---

### Task 7: 자동 업데이트 워크플로우

**Files:**
- Create: `.github/workflows/update-repos.yml`

**Interfaces:**
- Consumes: Task 2의 `scripts/fetch-repos.mjs` (실패 시 exit 1 → 커밋 없이 워크플로우 실패하는 계약).
- Produces: 매일 00:00 UTC + 수동 실행 시 `data/repos.json` 갱신 커밋.

- [ ] **Step 1: 워크플로우 작성**

`.github/workflows/update-repos.yml`:

```yaml
name: Update repos data

on:
  schedule:
    - cron: "0 0 * * *"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Fetch repo data
        run: node scripts/fetch-repos.mjs
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Commit and push if changed
        run: |
          if git diff --quiet -- data/repos.json; then
            echo "No changes."
            exit 0
          fi
          git config user.name "Woongjae (Jae) Jung"
          git config user.email "woongjaej2@gmail.com"
          git add data/repos.json
          git commit -m "chore: update repos data"
          git push
```

- [ ] **Step 2: YAML 문법 검증**

Run: `node -e "console.log('yaml check skipped — validated by actionlint or push')"` 대신 가능하면:
`python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/update-repos.yml')); print('yaml ok')"`
Expected: `yaml ok` (PyYAML이 없으면 push 후 Actions 탭에서 문법 오류 여부 확인으로 대체)

- [ ] **Step 3: 전체 테스트 재실행**

Run: `node --test`
Expected: PASS 전부

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/update-repos.yml
git commit -m "feat: add daily repo data update workflow"
```

---

### Task 8: 배포 및 실배포 검증

**Files:** 없음 (인프라 작업)

**Interfaces:**
- Consumes: 전체 태스크 결과물. `gh` CLI 인증 (`wf4006hufman`, `repo`+`workflow` 스코프 확인됨).
- Produces: 라이브 페이지 `https://wf4006hufman.github.io`, 동작하는 자동 업데이트 워크플로우.

- [ ] **Step 1: 최종 점검**

```bash
node --test                       # 전부 PASS
git log --format='%an <%ae>' | sort -u   # 사용자 identity 단일 확인
git status --porcelain                   # 클린 확인
```

- [ ] **Step 2: GitHub repo 생성 + push**

```bash
gh repo create wf4006hufman/wf4006hufman.github.io --public \
  --description "Personal portfolio — bilingual, auto-synced with GitHub" \
  --source . --push
```

Expected: repo 생성 및 main push 성공

- [ ] **Step 3: GitHub Pages 활성화 (main 브랜치 루트)**

```bash
gh api -X POST repos/wf4006hufman/wf4006hufman.github.io/pages \
  -f "source[branch]=main" -f "source[path]=/" || \
gh api -X PUT repos/wf4006hufman/wf4006hufman.github.io/pages \
  -f "source[branch]=main" -f "source[path]=/"
```

Expected: 201 (또는 이미 활성화돼 있으면 PUT 성공)

- [ ] **Step 4: 라이브 확인 (Pages 빌드 최대 수 분 대기)**

```bash
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' https://wf4006hufman.github.io/)
  [ "$code" = "200" ] && break
  sleep 20
done
echo "status: $code"
curl -s https://wf4006hufman.github.io/data/repos.json | head -5
```

Expected: `status: 200`, repos.json 정상 응답

- [ ] **Step 5: 워크플로우 수동 실행으로 파이프라인 검증**

```bash
gh workflow run update-repos.yml -R wf4006hufman/wf4006hufman.github.io
sleep 30
gh run list -R wf4006hufman/wf4006hufman.github.io --workflow=update-repos.yml --limit 1
```

Expected: 최신 run이 `completed success`. 데이터 변경이 없으므로 "No changes." 로그 (`gh run view --log`로 확인 가능).

- [ ] **Step 6: 실페이지 기능 검증**

브라우저(또는 browse 도구)에서 `https://wf4006hufman.github.io`:
- 프로젝트 카드 3개 (webflyx 없음)
- KO 토글 → 한국어 전환, repo 한국어 설명 표시, 새로고침 후 언어 유지
- Experience/Publications/Education 섹션·네비 링크 비노출 (데이터 비어 있으므로)
- 모바일 뷰 정상

브라우저가 불가하면 최소: `curl -s https://wf4006hufman.github.io/ | grep -o 'lang-toggle'` → 출력 확인

- [ ] **Step 7: 완료 커밋 없음 — 로컬과 원격 동기화만 확인**

```bash
git fetch && git status -sb   # ahead/behind 0 확인
```

---

## Self-Review 결과

- **Spec coverage:** 배포(T8), 스택(전체), 섹션 구성(T5), 자동 업데이트+안전장치(T1·T2·T7), 필터링(T1·T3), 한/영+override+fallback(T3·T4·T5), 비주얼 방향+다크 모드(T6), 빈 섹션 숨김(T5), i18n 누락 경고(T4), fetch 실패 fallback(T5), README 편집 가이드(T3), 커밋 identity 규율(전체+T7·T8) — 모두 태스크에 매핑됨.
- **Placeholder scan:** 코드 블록 전부 실코드. "적절히 처리" 류 표현 없음.
- **Type consistency:** `transformRepos`/`assertValidRepos`(T1→T2), `logic.mjs` 4개 함수 시그니처(T4→T5), `content.json` 키(T3→T5), HTML id/클래스(T5→T6) 교차 확인 완료.

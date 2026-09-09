# Portfolio Redesign — Genome Browser · Run Monitor · Classic (Design Spec)

날짜: 2026-09-09
상태: 목업 승인 완료 ("브라우저 뷰 기본으로 가고 스펙 작성해줘") — 스펙 사용자 검토 대기
선행 스펙: `2026-07-29-portfolio-page-design.md`(데이터·자동화), `2026-07-29-portfolio-redesign-design.md`(현재 bento 뷰)
승인된 목업: `https://claude.ai/code/artifact/c70e6ce9-e1d6-4abc-825a-0821b417803e` (v2). 소스 사본: `docs/design/genome-browser-mockup.html`. 스펙과 목업이 충돌하면 목업이 우선한다. 단, 목업에 박힌 값(스킬 AF/DP, 히트맵 강도, 경력 기산점)은 이 스펙의 데이터 스키마가 우선한다.

## 목적

포트폴리오를 **NGS·유전체학 도구의 화면 문법**으로 다시 그린다. 조사 결과(2026-09-09) 게놈 브라우저 테마의 개인 포트폴리오는 존재하지 않으므로 이 자리를 선점한다. 데이터 구조(`content.json` / `repos.json`)와 GitHub Action 일일 갱신, 한/영 전환은 그대로 두고 **뷰(렌더링 레이어)를 세 개로 늘린다.**

| 뷰 | 파일 | 메타포 | 상태 |
|---|---|---|---|
| Genome browser | `index.html` | IGV/UCSC식 트랙 브라우저. 프로젝트 = 유전자, 경력 = coverage, 논문 = peak, 학위 = marker, 스킬 = variant panel | **기본 뷰** |
| Run monitor | `run.html` | 시퀀싱 런 대시보드. 프로젝트 = lane, 스킬×연도 = intensity 히트맵, 경력 = run log | 보조 뷰 |
| Classic | `classic.html` | 현재 bento grid 그대로 | 빠른 경로 (이력서·링크 우선) |

세 뷰는 같은 JSON을 읽는다. 저장소가 추가·수정되면 다음 날 세 뷰 모두에 반영된다.

## 확정된 결정 사항

| 항목 | 결정 |
|---|---|
| 기본 뷰 | Genome browser (`index.html`). 첫 방문 시 **차단형 모드 게이트는 두지 않는다.** 상단 바의 뷰 전환 버튼이 항상 보이고, 첫 방문에만 상단 바 아래에 한 줄 힌트("Run monitor · Classic 뷰도 있습니다")를 띄우며 닫으면 다시 안 보인다 |
| 뷰 구조 | 뷰당 HTML 파일 1개(해시 기반 단일 페이지가 아님). 이유: 뷰별 CSS·JS를 분리해 기본 뷰의 로드 비용을 최소화하고, 현재 bento CSS와의 캐스케이드 충돌을 피하며, 각 뷰가 고유 URL을 가져 링크 공유가 쉽다 |
| 뷰 기억 | `localStorage.view` ∈ {browser, run, classic}. `index.html` 진입 시 저장값이 run/classic이고 URL에 `?view=browser`가 없으면 해당 파일로 `location.replace`. 전환 버튼 클릭이 저장값을 갱신한다 |
| 경력 기산점 | **2015.03(박사 과정 시작)**. `profile.career_start = "2015.03"`. 런 모니터의 Yield, Run ID, Started가 이 값을 쓴다. 2012–2015 면역학 RA는 경력 목록·타임라인에는 남기고 run log에 `PRE` 등급으로 표시 |
| 스킬 연차 | Machine Learning · LLM · GenAI · GCP · AWS = **2y**. 나머지는 목업 값 유지(Genomics 11, NGS 11, Epigenomics 9, Multiomics 6, Python 11, Pipeline Engineering 9) |
| 테마 | Browser 뷰 **라이트 기본**(실제 게놈 브라우저는 흰 바탕) + 다크 토글. Run monitor는 **다크 고정**(토글 숨김). Classic은 기존대로 다크 기본. 저장 키 `theme`는 세 뷰가 공유하되, 저장값이 없을 때의 기본값만 뷰별로 다르다 |
| 3D 구조 | 3Dmol.js 2.5.5 (jsDelivr, BSD). 논문 peak 클릭 시에만 로드. 구조 파일은 RCSB `files.rcsb.org/download/{ID}.pdb`에서 브라우저가 직접 가져온다(CORS 허용 확인 완료). 목업처럼 파일을 인라인하지 않는다 |
| 라이브러리 | 3Dmol.js 외 외부 JS 없음. 트랙·히트맵·나선은 SVG/Canvas 직접 그림 |
| 폰트 | Google Fonts: Bricolage Grotesque(디스플레이) · IBM Plex Sans(본문) · IBM Plex Mono(데이터) · Noto Sans KR(한국어 본문, 기존 유지). Classic은 기존 Outfit 유지 |
| 접근성·모션 | `prefers-reduced-motion`이면 나선은 정지 프레임, 3D는 회전 없음, 스크롤은 즉시 이동. 모든 클릭 대상(유전자·peak·밴드·lane)은 `tabindex=0` + Enter/Space |
| 자동화 | `.github/workflows/update-repos.yml`, `scripts/*` 변경 없음 |

## 비주얼 토큰

### Browser 뷰 (라이트 기본)

```
--paper:#f3f4f1   --surface:#ffffff  --ink:#1c2330  --body:#3a4352  --muted:#6a7383
--rule:#d7dbe0    --rule-soft:#e9ecef  --track-head:#f7f8f6  --hover:#eef1f5
염기 팔레트(범주색):  --nA:#2f9c5c  --nC:#2f6fd8  --nG:#e39b1f  --nT:#d24b4b  --nN:#9aa3ae
--locus:#d24b4b(현재 위치 박스)  밴드: --band1:#d9dde2 --band2:#a6adb6 --band3:#4a525d  --cen:#c24a4a
```
다크 토글:
```
--paper:#0f1319  --surface:#161b23  --ink:#e7eaef  --body:#c3c9d2  --muted:#8b94a1
--rule:#2a313c   --rule-soft:#1f2530  --track-head:#131820  --hover:#1b212b
--nA:#4cbf78  --nC:#5f93ea  --nG:#f0b247  --nT:#ea6b6b  --nN:#6f7884
--band1:#2c333d --band2:#4a535e --band3:#9aa3ae
```
- 언어 → 색 매핑은 염기 팔레트를 재사용한다: Python=C(파랑), JavaScript=G(호박), Shell=T(빨강), HTML=A(초록), 그 외/없음=N(회색). 새 언어가 나타나면 N으로 떨어진다.
- 텍스트 대비는 두 테마 모두 WCAG AA(4.5:1) 이상. `--muted`는 11px 이상 모노 라벨에만 쓴다.

### Run monitor 뷰 (다크 고정)

```
--rm-bg:#06090d  --rm-panel:#0d141b  --rm-panel2:#111a22  --rm-line:#1d2833
--rm-text:#d5dfe6  --rm-muted:#7d8b98  --rm-teal:#4fb8b1  --rm-amber:#e2a63c  --rm-green:#3fbf6f  --rm-red:#e05252
히트맵 단계(0→5): #111a22 #173a45 #1e6a6a #2d9a91 #4fb8b1 #e2a63c
```
- 장비 제조사의 이름·로고·고유 색은 쓰지 않는다. 화면 하단에 "메타포이며 특정 장비 UI가 아니다"라는 한 줄을 둔다.

## 화면 구성

### 공통 상단 바 (세 뷰 동일 마크업, `assets/js/shell.mjs`가 렌더)

```
[ jae.genome  hg-jae · build YYYY.MM ] [ Browser | Run monitor | Classic ]   [ locus 입력 + Go ]  [ KO/EN ] [ 테마 ]
```
- 브랜드 클릭 → `index.html`.
- 뷰 버튼: 현재 뷰가 `aria-pressed=true`. 클릭 시 `localStorage.view` 저장 후 해당 파일로 이동.
- locus 입력은 Browser 뷰에서만 보인다. 섹션 이름 앞 4글자로 매칭해 스크롤한다(`chrProjects` 등). 매칭 실패 시 입력창을 한 번 흔들지 않고 그대로 둔다(조용한 실패).
- 테마 토글은 Run monitor에서 숨긴다.
- build 라벨은 `repos.json.updated_at`의 연·월. repos.json이 없으면 생략.

### Browser 뷰 (`index.html`)

위에서 아래로:

1. **Ideogram 내비게이션** (sticky, 상단 바 바로 아래)
   - SVG 하나. 섹션 7개(about, projects, experience, publications, education, skills, contact)가 밴드. 밴드 폭 가중치는 상수 `[110,260,190,150,90,120,80]`. experience 시작점에 centromere 원.
   - 빨간 locus 박스가 현재 섹션을 감싼다. IntersectionObserver `rootMargin:"-45% 0px -50% 0px"`.
   - 밴드 클릭 → 해당 섹션으로 스크롤. 라벨은 `i18n.nav_*` 재사용.
   - 비어 있는 섹션(experience/publications/education 배열이 빈 경우)은 밴드에서도 뺀다.

2. **Hero** (`#about`)
   - 좌: eyebrow `chrAbout · p-arm · 1 gene`, `profile.name`, `profile.tagline`, `profile.intro`, `profile.about`, 칩(Jump to projects / GitHub / LinkedIn / Email).
   - 우: Canvas 2D 이중나선. 34개 염기쌍, 서열은 `profile.hero_motif`(기본 `CCGCGNGGNGGCAG`, CTCF core motif), 캡션 `profile.hero_motif_label`. 아래에 같은 서열이 흐르는 ticker.
   - 나선은 뷰포트 밖이거나 탭이 숨겨지면 rAF를 멈춘다. reduced-motion이면 위상 0.6에서 한 프레임만 그린다.

3. **Projects 트랙** (`#projects`)
   - 헤더: `PROJECTS · {n} genes · {k} chromosomes · synced from GitHub daily`. 우측 범례(언어→색).
   - 본문 SVG(viewBox 1100×(34+70·행수+20), `min-width:720px`, 컨테이너 `overflow-x:auto`).
   - 상단 ruler 0–100 kb. 행 = 염색체(chrAI, chrNGS, chrInfra). 빈 염색체 행은 생략.
   - 유전자 글리프: intron 선 + 방향 chevron + exon 사각형(높이 16). 유전자 길이(kb) = `8 + exon수 × 4.5`. 행 안에서 균등 간격 배치. exon마다 `<title>`로 exon 이름.
   - 클릭/Enter → IGV식 팝업(이름, CHROM, DESC(한국어 override 적용), LANG, EXONS, TOPICS, PUSHED, "Open on GitHub"). 팝업은 트랙 섹션 내부 absolute, Esc·× 로 닫힘, 한 번에 하나.
   - 각주: `i18n.projects_track_note`.
   - `repos.json` 없음 → 트랙 본문 대신 기존 `projects_fallback` 문구 + GitHub 링크.

4. **Experience 트랙** (`#experience`) — coverage
   - 공통 타임라인 스케일: `T0 = floor(min(start))`, `T1 = 현재 연도 + 1`. 연 단위 ruler.
   - 계단형 area: 항목 i의 높이 = 시간순 인덱스+1 (1×…n×). 점선 가로선과 `1×…n×` 눈금.
   - 라벨은 항목마다 제목(굵게)·기간·기관 첫 절(`org`를 첫 쉼표 앞까지)·`note`. 겹침 방지: 홀수 인덱스는 46px 아래 줄.
   - `period` 파싱 규칙은 §데이터 참조.

5. **Publications 트랙** (`#publications`) — peaks, expanded
   - 논문마다 행 하나(36px). 연도 위치에 peak 글리프. 1저자 = `--nT`, 공저자 = `--nG`. 헤더 우측 힌트 `click a peak → 3D structure`.
   - 제목은 남은 폭에 맞춰 잘라 `…`. 전체 제목은 `<title>`과 드로어에서.
   - 클릭/Enter → **구조 드로어**(아래 §3D 구조 드로어).

6. **Education 트랙** (`#education`) — markers
   - 같은 타임라인. lollipop 마커(`--nA`). 2년 이내로 겹치는 이웃은 아래 줄(+32px)로 내린다.

7. **Skills 트랙** (`#skills`) — variant panel
   - 표: CHROM · ID · AF(막대+수치) · DP · FILTER(항상 PASS) · INFO. 헤더 우측 설명 `AF = proficiency · DP = years`.
   - 모바일에서는 INFO 열을 숨기고 표는 가로 스크롤.

8. **Contact 트랙** (`#contact`) — export session
   - email / GitHub / LinkedIn 카드 3개(`contact.email`, `contact.links`).

9. **푸터**: `footer_updated: YYYY-MM-DD` + 뷰 전환 링크 반복.

### Run monitor 뷰 (`run.html`)

1. **Run 헤더**: `RUN · JAE-{career_start YYYYMMDD} · FLOWCELL CAREER-01`, 이름, Instrument/Chemistry/Read length/Started(`career_start`, "Ph.D. onward"), 우측 상태 pill(`Sequencing · cycle {YYYY.MM}`) + 진행 막대(고정 93%) + 단계 텍스트.
2. **타일 4개**: Yield(`now − career_start` 년, 소수 1자리) · Clusters PF(프로젝트 수) · Publications(수, 1저자 수, 저널 약칭 목록) · Run QC(`profile.award` 있으면 표시, 없으면 타일 생략하고 3열).
3. **Flowcell**: lane = 프로젝트. 3열 그리드(모바일 2열). 배경 점 밀도 = 설명 길이×1.6, 색 = 언어색, **캔버스 opacity 0.22**. 라벨 `L{n}` · 염색체 · 이름(`overflow-wrap:anywhere`) · `idx {LANG}`. 클릭 → GitHub.
4. **Intensity by cycle 히트맵**: 행 = `skill_timeline` 항목, 열 = 연도(`skill_timeline.years`). 셀 `<title>`에 값. 짝수 연도만 라벨.
5. **Sample sheet**: Sample_ID(링크) · Index(언어 칩) · Description.
6. **Run log**: experience·education·publications·최근 push를 시간순으로 합쳐 생성. 등급: `PRE`(career_start 이전 항목) · `INFO`(경력 시작/이동, 최근 push) · `MARK`(학위, 논문) · `NOTE`(`profile.award`). 마지막 줄 `Read 2 in progress` + 깜빡이는 커서.
7. 하단 한 줄: 메타포 고지.

### Classic 뷰 (`classic.html`)

현재 `index.html`을 그대로 옮긴다. 변경은 두 가지뿐: 상단 바에 뷰 전환 버튼을 추가하고, `<title>`/canonical을 `classic.html`로 맞춘다. 기존 `main.js`·`style.css`는 유지한다.

### 3D 구조 드로어 (Browser 뷰)

- 모달(`role=dialog`, `aria-modal`, Esc·배경 클릭·× 로 닫힘, 열릴 때 body 스크롤 잠금, 닫힐 때 포커스 복귀).
- 좌: 3Dmol 스테이지(배경 `#0b1118`). 우: 연도·저널, 제목, 저자 역할, gene/structure/render 키값, `blurb`, 버튼(DOI · RCSB entry).
- 흐름: 클릭 → 드로어 열림 + "loading 3Dmol.js…" → 스크립트 1회 로드(`https://cdn.jsdelivr.net/npm/3dmol@2.5.5/build/3Dmol-min.js`) → PDB 텍스트 fetch(메모리 캐시) → 렌더.
- 표현: 단백질 체인(`publications[].pdb_chain`) cartoon `spectrum`; DNA(`DA/DT/DG/DC`) stick `whiteCarbon`; `ZN` sphere 호박색. `zoomTo` 후 reduced-motion 아니면 `spin('y', .35)`.
- `pdb`가 null → 스테이지에 "structure not available for this paper" 문구, RCSB 버튼 숨김. 이 상태도 정상 경로다(RUNX3 논문 초기값).
- 실패 처리: 스크립트 로드 실패 → "3D viewer could not load" + DOI 버튼은 유지. PDB fetch 실패(네트워크/404) → "structure could not be fetched from RCSB" + RCSB 링크 유지. 어느 경우도 콘솔 외에 페이지 다른 부분에 영향 없음.

## 데이터

### `data/content.json` 스키마 추가·변경

```jsonc
"profile": {
  // 기존 필드 유지
  "career_start": "2015.03",                       // 신규. Yield·Run ID·PRE 판정 기준
  "award": { "en": "2024 MVP · Asia Middle East Region", "ko": "2024 MVP · 아시아·중동 지역", "year": "2024" },  // 신규(선택)
  "hero_motif": "CCGCGNGGNGGCAG",                  // 신규(선택, 기본값 동일)
  "hero_motif_label": { "en": "CTCF core motif", "ko": "CTCF 핵심 모티프" }
},
"skills": [                                        // 문자열 배열 → 객체 배열
  { "name": "Genomics", "chrom": "genomics", "af": 0.95, "dp": 11, "info": "WGS/WES · DRAGEN · variant review" },
  { "name": "NGS", "chrom": "genomics", "af": 0.95, "dp": 11, "info": "Illumina platforms · bcl-convert · QC" },
  { "name": "Epigenomics", "chrom": "genomics", "af": 0.90, "dp": 9,  "info": "ChIP-seq · ATAC-seq · Hi-C · CTCF" },
  { "name": "Multiomics", "chrom": "genomics", "af": 0.75, "dp": 6,  "info": "integration · RNA + chromatin" },
  { "name": "Python", "chrom": "ai", "af": 0.90, "dp": 11, "info": "pipelines · FastAPI · tooling" },
  { "name": "Machine Learning", "chrom": "ai", "af": 0.70, "dp": 2, "info": "evaluation · classical ML" },
  { "name": "LLM", "chrom": "ai", "af": 0.80, "dp": 2, "info": "RAG · agents · eval harnesses" },
  { "name": "GenAI", "chrom": "ai", "af": 0.75, "dp": 2, "info": "Claude Code · Codex · guarded tools" },
  { "name": "GCP", "chrom": "cloud", "af": 0.70, "dp": 2, "info": "Vertex · Cloud Run · IAM" },
  { "name": "AWS", "chrom": "cloud", "af": 0.65, "dp": 2, "info": "EC2 · S3 · Batch" },
  { "name": "Pipeline Engineering", "chrom": "cloud", "af": 0.85, "dp": 9, "info": "Nextflow-style DAGs · containers · CI" }
],
"skill_timeline": {                                // 신규. Run monitor 히트맵
  "years": [2012, 2026],                           // 시작·끝(포함)
  "rows": [
    { "label": { "en": "Immunology", "ko": "면역학" },        "values": [3,3,3,1,0,0,0,0,0,0,0,0,0,0,0] },
    { "label": { "en": "Genomics / NGS", "ko": "유전체학 / NGS" }, "values": [0,1,2,3,3,4,4,4,4,4,4,4,4,4,4] },
    { "label": { "en": "Epigenomics", "ko": "후성유전체학" },  "values": [0,0,1,2,3,4,4,4,4,4,3,2,2,2,2] },
    { "label": { "en": "Python", "ko": "Python" },            "values": [1,1,2,3,3,4,4,4,4,4,4,4,4,4,4] },
    { "label": { "en": "Pipeline eng.", "ko": "파이프라인" },  "values": [0,0,1,2,3,3,4,4,4,4,4,4,4,4,4] },
    { "label": { "en": "Cloud (GCP/AWS)", "ko": "클라우드" },  "values": [0,0,0,0,0,0,0,0,0,0,0,0,0,3,3] },
    { "label": { "en": "ML", "ko": "머신러닝" },              "values": [0,0,0,0,0,0,0,0,0,0,0,0,0,3,3] },
    { "label": { "en": "LLM / agents", "ko": "LLM / 에이전트" }, "values": [0,0,0,0,0,0,0,0,0,0,0,0,0,4,4] },
    { "label": { "en": "Field / customer", "ko": "필드 / 고객" }, "values": [0,0,0,0,0,0,0,0,0,0,2,4,4,4,4] }
  ]
},
"publications": [                                  // 기존 필드 + 신규 3개
  { "...": "...", "pdb": "5T0U", "pdb_chain": "A", "gene": "CTCF",
    "blurb": { "en": "CTCF zinc fingers 2–7 wrapped around DNA.", "ko": "DNA를 감싼 CTCF 징크핑거 2–7." } },
  { "...": "p53 paper", "pdb": "1TUP", "pdb_chain": "B", "gene": "p53", "blurb": { "en": "...", "ko": "..." } },
  { "...": "RUNX3 paper", "pdb": null, "gene": "RUNX3", "blurb": { "en": "...", "ko": "..." } }
],
"repo_overrides": {
  "<repo>": {
    "description_ko": "...",                       // 기존
    "chromosome": "chrAI",                         // 신규(선택). 자동 분류 덮어쓰기
    "exons": ["RAG w/ citations", "guarded tool calls"]  // 신규(선택). 자동 exon 추출 덮어쓰기
  }
},
"i18n": {                                          // 신규 키 (전부 en/ko)
  "view_browser", "view_run", "view_classic", "view_hint", "locus_label", "locus_go",
  "projects_track_meta", "projects_track_note", "experience_track_meta", "publications_track_meta",
  "publications_egg_hint", "education_track_meta", "skills_track_meta", "skills_legend", "contact_track_meta",
  "structure_loading", "structure_none", "structure_lib_failed", "structure_fetch_failed", "structure_hint",
  "run_yield", "run_clusters", "run_pubs", "run_qc", "run_flowcell", "run_heat", "run_sheet", "run_log", "run_note"
}
```

- `skills`가 문자열 배열이면(과거 형식) `{name, chrom:"other", af:null, dp:null}`로 정규화해 Classic·Browser 모두 깨지지 않는다. AF가 null이면 막대 대신 `—`.
- `skill_timeline.rows[].values` 길이는 `years` 범위 길이와 같아야 한다. 다르면 콘솔 경고 후 부족분 0, 초과분 절단.
- 논문 `pdb`는 대문자 4자리 또는 null. 그 외 값은 null로 취급하고 경고.

### `data/repos.json`

변경 없음. 브라우저에서 파생하는 값:

| 파생값 | 규칙 |
|---|---|
| 염색체 | `repo_overrides[name].chromosome` 우선. 없으면 topics·description(소문자)에서 키워드 매칭: chrNGS ← {bioinformatics, ica, illumina, dragen, ngs, clinical-genomics, cnv, sequencing, bcl-convert, genomics, variant}; chrAI ← {rag, llm, agent, ai-safety, evaluation, mistral, genai}; 둘 다 아니면 chrInfra. 둘 다 맞으면 chrNGS 우선(임상·NGS 맥락이 더 구체적) |
| exon 목록 | `repo_overrides[name].exons` 우선. 없으면 description을 `,` `;` `+` ` — ` `: `로 분할, 각 조각 trim, 빈 조각 제거, 최대 6개. 조각이 1개면 `[name]` 1개 exon |
| 언어색 | Python→C, JavaScript→G, Shell→T, HTML→A, 그 외/null→N |
| 유전자 정렬 | 염색체 내에서 `pushed_at` 내림차순 |

### `period` 파싱 (experience · education 공통)

- 형식 `"YYYY.MM – YYYY.MM"`, `"YYYY.MM – Present"`, `"YYYY.MM"`(단일 시점). 대시는 `–`/`-` 모두 허용.
- 소수 연도 = `YYYY + (MM − 1) / 12`. Present = 현재 연·월.
- 파싱 실패 시 해당 항목은 트랙에서 제외하고 콘솔 경고(목록 뷰인 Classic에는 영향 없음).

## 파일 구조

```
index.html                    # NEW  Genome browser 뷰 (기본)
run.html                      # NEW  Run monitor 뷰
classic.html                  # MOVE 현재 index.html (+뷰 전환 버튼)
assets/css/base.css           # NEW  공통 토큰·상단 바·힌트 바
assets/css/browser.css        # NEW  Browser 뷰
assets/css/run.css            # NEW  Run monitor 뷰
assets/css/style.css          # KEEP Classic (전환 버튼 스타일만 추가)
assets/js/logic.mjs           # EXTEND 순수 함수 (아래)
assets/js/shell.mjs           # NEW  JSON 로드, 상태(lang/theme/view), 상단 바 렌더, 뷰 리다이렉트
assets/js/browser/index.js    # NEW  Browser 뷰 진입점 (모듈 조립)
assets/js/browser/ideogram.mjs
assets/js/browser/helix.mjs
assets/js/browser/tracks.mjs  # genes · coverage · peaks · markers · variant table
assets/js/browser/structure.mjs
assets/js/run/index.js        # NEW  Run monitor 진입점
assets/js/main.js             # KEEP Classic (shell.mjs의 뷰 전환만 붙임)
tests/logic.test.mjs          # EXTEND
tests/mapping.test.mjs        # NEW  분류·exon·period·layout·log 생성
docs/design/genome-browser-mockup.html   # 목업 사본(PDB 인라인 제거)
README.md                     # 뷰 3개·새 필드 편집 표 추가
```

### `logic.mjs`에 추가되는 순수 함수 (전부 단위 테스트)

```
chromosomeOf(repo, overrides) → "chrAI" | "chrNGS" | "chrInfra"
exonsOf(repo, overrides) → string[]            (1..6)
langColorKey(language) → "A"|"C"|"G"|"T"|"N"
parsePeriod(text, now) → { start, end } | null (소수 연도)
timelineScale(items, now) → { t0, t1 }
layoutGenes(genes, totalKb=100) → [{ name, x0, x1 }]   (kb 좌표)
normalizeSkills(skills) → [{ name, chrom, af, dp, info }]
normalizeTimeline(skill_timeline) → { years:number[], rows } (길이 보정 + 경고 플래그)
careerYears(career_start, now) → number (소수 1자리)
runId(career_start) → "JAE-YYYYMMDD"
buildRunLog(content, repos, now) → [{ date, level, text }] (시간순)
truncateToWidth(text, px, charPx=6.9) → string
resolveInitialTheme(stored, fallback="dark")   // 기존 시그니처 유지, 두 번째 인자 추가
resolveInitialView(stored, query) → "browser"|"run"|"classic"
```

## 렌더링·상호작용 규칙

- 모든 텍스트는 `pick()`/`translate()`를 거친다. 언어 토글 시 세 뷰 모두 `renderAll()`로 다시 그린다(캔버스 나선과 3D 뷰어는 재생성하지 않는다).
- SVG는 `document.createElementNS`로 생성하고 `innerHTML`에 사용자 데이터를 넣지 않는다(설명문에 `<`가 있어도 안전).
- 팝업·드로어는 한 번에 하나. 열릴 때 마지막 포커스 요소를 기억하고 닫힐 때 복귀.
- 나선 rAF: `IntersectionObserver`로 hero가 화면 밖이면 정지, `visibilitychange`로 탭 숨김 시 정지.
- 반응형: ≤820px hero 1열, ≤760px 드로어 세로 배치, 트랙 SVG는 `min-width:720px` + 가로 스크롤, ≤600px ideogram 라벨은 현재 밴드만 표시, flowcell 2열.

## 성능 예산

| 항목 | 예산 |
|---|---|
| Browser 뷰 첫 로드 JS(자체 코드, gzip 전) | ≤ 45 KB |
| 외부 JS(첫 로드) | 0 |
| 3Dmol.js | 클릭 시에만, ~150 KB gz |
| PDB 파일 | 클릭 시에만, 구조당 ≤ 600 KB(캐시) |
| 폰트 | Google Fonts 4패밀리, `display=swap` |
| LCP 요소 | hero 이름(h1). 나선 캔버스는 LCP 후 시작 |

## 오류 처리

| 상황 | 동작 |
|---|---|
| `content.json` 실패 | 기존과 동일: 본문에 이중 언어 오류 문구 |
| `repos.json` 실패 | Projects 트랙·flowcell·sample sheet에 `projects_fallback` + GitHub 링크. 나머지 정상 |
| 3Dmol 로드 실패 | 드로어에 `structure_lib_failed`, DOI 유지 |
| PDB fetch 실패 | 드로어에 `structure_fetch_failed`, RCSB 링크 유지 |
| `period` 파싱 실패 | 항목 제외 + 경고 |
| `skill_timeline` 길이 불일치 | 보정 + 경고 |
| localStorage 접근 불가 | try/catch, 기본값으로 진행 |

## 테스트

- `node --test`: `tests/logic.test.mjs`(기존 + `resolveInitialTheme` fallback, `resolveInitialView`), `tests/mapping.test.mjs`(분류 규칙·override 우선순위, exon 분할 경계, period 형식 3종 + 실패, layout 겹침 없음, `buildRunLog` 정렬·등급, `normalizeSkills` 구형 배열 호환, `normalizeTimeline` 길이 보정).
- 수동 검증(구현 완료 조건): headless Chrome으로 `index.html`·`run.html`·`classic.html`을 1280px·390px에서 스크린샷, 라벨 겹침·잘림 없음. 논문 peak 클릭 → 5T0U·1TUP가 실제 RCSB에서 로드되어 렌더됨. reduced-motion 에뮬레이션에서 나선 정지·회전 없음. 키보드만으로 유전자 팝업·드로어 열고 닫기. 언어 토글 후 세 뷰 텍스트 전부 한국어.
- 로컬 프리뷰: `python3 -m http.server 8000` (ES 모듈이라 `file://`로는 동작하지 않음).

## 범위 밖 (이번 스펙에서 하지 않음)

- Circos형 원형 플롯, Nextflow DAG 뷰, AlphaFold 구조, 검색·필터.
- 실제 커밋 활동 히트맵(GitHub API 추가 호출 필요) — `skill_timeline`은 손으로 편집하는 값이다.
- Classic 뷰 리팩터링. `main.js`는 뷰 전환 버튼 외 손대지 않는다.

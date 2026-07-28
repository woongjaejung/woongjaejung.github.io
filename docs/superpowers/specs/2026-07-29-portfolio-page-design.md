# Portfolio Page — Design Spec

날짜: 2026-07-29
상태: 사용자 승인 완료 (대화 중 섹션별 승인)

## 목적

Woongjae (Jae) Jung의 개인 포트폴리오 페이지.
- 참고 사이트 https://swhan0329.github.io/ 의 **정보 구조와 미니멀한 느낌**을 따르되, 비주얼은 복제하지 않고 더 세련되고 차분한 최신 스타일로 재해석한다.
- 한국어/영어 전환 지원.
- GitHub 계정 `wf4006hufman`에 공개 repo가 추가되면 **자동으로 페이지에 반영**되는 체계를 갖춘다.

## 확정된 결정 사항

| 항목 | 결정 |
|---|---|
| 배포 | GitHub Pages 사용자 사이트 `wf4006hufman.github.io` (main 브랜치 루트, "Deploy from branch") |
| 기술 스택 | 순수 정적 사이트 — HTML/CSS/vanilla JS, 프레임워크·빌드 도구 없음 |
| 섹션 | About(+Skills) → Projects(자동) → Experience → Publications → Education → Contact |
| 자동 업데이트 | GitHub Actions 하루 1회 cron + workflow_dispatch |
| repo 필터링 | 공개 repo 전체 노출(fork 제외), 설정 파일의 제외 목록으로 opt-out (초기 제외: `webflyx`) |
| 한/영 처리 | 정적 텍스트는 전부 이중 언어. 자동 수집된 repo 설명은 영어 fallback, `content.json`의 override로 한국어 설명 추가 가능 |
| 비주얼 방향 | 참고 사이트의 차분함 유지 + 트렌디하게: 타이포그래피 중심, 절제된 액센트 컬러, 부드러운 카드 인터랙션, `prefers-color-scheme` 기반 라이트/다크 자동 대응. 구현 시 frontend-design 스킬로 구체화 |

## 파일 구조

```
index.html                         # 단일 페이지 전체
assets/css/style.css               # 스타일
assets/js/main.js                  # 한/영 전환 + 프로젝트 카드 렌더링
data/repos.json                    # [자동] GitHub Actions가 갱신, 수동 편집 금지
data/content.json                  # [수동] 정적 섹션 내용(ko/en), repo 제외 목록, 한국어 설명 override
scripts/fetch-repos.mjs            # repo 수집 스크립트 (Node, 로컬 실행도 가능)
.github/workflows/update-repos.yml # cron(daily) + workflow_dispatch
docs/superpowers/specs/            # 이 문서
```

원칙: **자동 데이터(`repos.json`)와 수동 데이터(`content.json`)를 파일 단위로 격리**해 Actions 커밋과 사용자 편집이 충돌하지 않게 한다.

## 데이터 모델

### `data/repos.json` (자동 생성)
```json
{
  "updated_at": "2026-07-29T00:00:00Z",
  "repos": [
    {
      "name": "fieldrag",
      "description": "Grounded RAG + agent assistant ...",
      "language": "Python",
      "topics": ["rag", "gcp"],
      "stars": 0,
      "pushed_at": "2026-07-05T…",
      "html_url": "https://github.com/wf4006hufman/fieldrag"
    }
  ]
}
```
정렬: `pushed_at` 내림차순. 포함 필드는 위가 전부(불필요한 API 필드 제거).

### `data/content.json` (수동 편집)
```json
{
  "exclude_repos": ["webflyx"],
  "repo_overrides": {
    "fieldrag": { "description_ko": "NGS 필드 지원용 RAG 어시스턴트 …" }
  },
  "i18n": {
    "about_heading": { "en": "About", "ko": "소개" }
  },
  "experience": [ { "period": "…", "title": { "en": "…", "ko": "…" }, "org": "…" } ],
  "publications": [ { "year": "…", "title": "…", "venue": "…", "link": "…" } ],
  "education": [ { "period": "…", "degree": { "en": "…", "ko": "…" }, "school": { "en": "…", "ko": "…" } } ]
}
```
Experience/Publications/Education의 실제 내용은 사용자가 채운다. 초기 릴리스는 형식 예시가 담긴 스켈레톤 + GitHub 프로필에서 확인 가능한 정보(bio 등)로 출시하고, 편집 방법을 README에 문서화한다.

## 페이지 동작

- 상단 고정 네비게이션 + 단일 컬럼 스크롤. 네비게이션에 섹션 앵커와 KO/EN 토글.
- 언어 초기값: localStorage 저장값 → 없으면 `navigator.language`가 `ko*`면 KO, 아니면 EN. 전환 시 `<html lang>`도 갱신.
- 프로젝트 카드: 이름, 설명(KO 모드에서 `description_ko` 있으면 그것, 없으면 영어 fallback), 주 언어, topic 태그, GitHub 링크.
- `repos.json` fetch 실패 시: 프로젝트 섹션에 fallback 문구 + GitHub 프로필 링크 표시.

## 자동 업데이트 파이프라인

`update-repos.yml`:
1. 트리거: cron 하루 1회 (`0 0 * * *`, 00:00 UTC = KST 09:00) + workflow_dispatch.
2. `scripts/fetch-repos.mjs` 실행 — Actions 내장 `GITHUB_TOKEN`으로 `GET /users/wf4006hufman/repos` 호출, fork와 `exclude_repos` 제외, 필드 추려 `data/repos.json` 생성.
3. **안전장치**: 결과가 repo 0개이거나 JSON 파싱 불가면 커밋하지 않고 워크플로우 실패 → 페이지는 마지막 정상 데이터 유지.
4. diff가 있을 때만 커밋·푸시. 커밋 author/committer는 사용자 identity(`wf4006hufman` <woongjaej2@gmail.com>) — bot이 contributor로 잡히지 않게 한다. AI 서명/Co-Authored-By 트레일러 금지.

새 repo 반영 시점: 다음 cron(최대 24h) 또는 Actions 탭 수동 실행 즉시.

## 검증

- 로컬 미리보기: `python3 -m http.server` (fetch가 상대경로이므로 그대로 동작).
- `scripts/fetch-repos.mjs`는 로컬에서도 실행 가능 — 커밋 전 결과 확인용.
- i18n 키가 한쪽 언어에 없으면 콘솔 경고를 출력해 번역 누락을 노출.
- 배포 후: 실제 페이지에서 언어 전환, 카드 렌더링, 모바일 뷰 확인.

## 범위 제외 (YAGNI)

- 자동 번역(API 의존) — 수동 override로 충분.
- 블로그/개별 프로젝트 상세 페이지 — 단일 페이지로 시작.
- 방문자 분석, 댓글 등 외부 서비스 연동.
- 클라이언트 측 GitHub API 호출(rate limit 문제) — 빌드 타임 데이터만 사용.

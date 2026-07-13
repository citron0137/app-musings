# musings

[musings.rahoon.site](https://musings.rahoon.site) 를 굴리는 정적 사이트.
Jekyll + GitHub Pages. 외부 스크립트 없이 자립한다.

## 구조

| 경로 | 역할 |
|------|------|
| `index.html` | 첫 화면 — 최근 메모, 노트 목록, 메모 작성 |
| `_musings/` | 노트 본문 (Jekyll collection). URL 은 `/<yyyy-mm-dd>-<slug>.html` |
| `_layouts/`, `_includes/` | 레이아웃과 스타일 |
| `js/`, `sw.js`, `manifest.webmanifest` | 클라이언트 스크립트, 서비스워커, PWA |
| `locked/*.enc`, `token.enc` | 암호문만 커밋된다. 평문과 비밀번호는 절대 들어오지 않는다 |
| `_scripts/` | 암호화·복호화·메모 수집 스크립트 ([문서](_scripts/README.md)) |
| `.githooks/` | 커밋 전 암호문 검증 ([문서](.githooks/README.md)) |

`_locked/`, `_inbox/` 는 평문이 놓이는 자리라 `.gitignore` 로 막아 둔다.

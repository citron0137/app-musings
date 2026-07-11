# inbox

폰에서 쓴 메모의 암호문(.enc)만 쌓이는 고아 브랜치.
`main` 과 공통 조상이 없다 — merge/rebase 할 일이 영원히 없고, 사이트 재배포도 일어나지 않는다.

- 파일: `inbox/<YYYY-MM-DD-HHMMSS>.enc` (KST)
- 포맷: main 의 잠긴 노트와 동일 (AES-256-GCM + PBKDF2)
- 평문을 로컬에서 보려면: `node _scripts/pull-inbox.js` (main 브랜치에서 실행)

설계: `00-docs/설계-메모기능.md` (main 브랜치)

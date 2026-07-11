# Git Hooks

이 디렉토리의 훅들은 `.git/hooks/` 가 아니라 버전 관리되는 `.githooks/` 에 두고, `git config core.hooksPath` 로 git 이 보게 한다.

## 설치 (한 번만)

```bash
node .githooks/install.js
```

## 비활성화

```bash
git config --unset core.hooksPath
```

## 훅 목록

### `pre-commit` — `.enc` 무결성 검증

**staging 여부와 무관하게** 워킹트리의 모든 `.enc` 파일을:
1. 복호화
2. 대응 평문과 문자열 비교
3. 불일치 시 커밋 차단

평문 수정 후 재암호화를 까먹은 채 무관한 커밋(예: 마크다운 수정)을 시도해도 막아줌. 비밀번호/평문이 없는 환경에서는 silent skip 해서 fresh checkout 의 무관한 커밋은 차단하지 않음.

### `pre-push` — push 직전 재검증

`pre-commit` 과 동일한 검증을 push 직전에 한 번 더. `pre-commit` 을 `--no-verify` 로 우회했거나, 훅이 설치 안 된 환경에서 만든 커밋이 remote 로 나가는 것을 막는 마지막 그물망.

우회: `git push --no-verify`

**동작 시스템:**
| .enc 경로 | 평문 | 비번 (env / file) | salt |
|---|---|---|---|
| `musings/locked/<id>.enc` | `musings/_locked/<id>.txt` | `MUSINGS_PASSWORD` / `musings/_locked/password.txt` | `rahoon_musings_2026` |
| `dashboard/links-private.enc` | `dashboard/_private/links-private.json` | `DASHBOARD_PASSWORD` / `dashboard/_private/password.txt` | `rahoon_dashboard_2025` |

**우회 (검증 무시하고 커밋):**

```bash
git commit --no-verify
```

**실패 메시지 예시:**

```
[pre-commit] musings/locked/2026-04-22-a.enc: 복호화 결과가 musings/_locked/2026-04-22-a.txt 와 일치하지 않습니다.
[pre-commit]   → 평문이 변경됐다면 'node musings/_scripts/encrypt-locked-musings.js' 로 재암호화 후 다시 커밋하세요.
```

## 새 훅 추가하기

1. `.githooks/<hook-name>` 으로 sh 또는 node 스크립트 생성
2. 첫 줄에 `#!/bin/sh` 또는 `#!/usr/bin/env node`
3. `chmod +x .githooks/<hook-name>` (Unix)
4. 커밋

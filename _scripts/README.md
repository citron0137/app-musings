# 잠긴 사색 노트 (Locked Musings)

평문/비밀번호는 절대 git에 들어가지 않고, 암호문(`.enc`)만 커밋해서 사이트에 배포되는 인라인 토글 시스템.

## 디렉토리 구조

```
musings/
├── <yyyy-mm-dd>-<slug>.md                  ← 사색 노트 본문 (커밋)
├── _locked/                                ← .gitignore + Jekyll exclude (절대 커밋 X)
│   ├── password.txt                        ← 사이트 전체 단일 비밀번호 (한 줄)
│   └── <id>.txt                            ← 평문 잠긴 노트
├── _scripts/                               ← Jekyll exclude (커밋 O)
│   ├── encrypt-locked-musings.js           ← 평문 → 암호문
│   └── decrypt-locked-musings.js           ← 암호문 → 평문 (복구용)
└── locked/                                 ← 커밋, 사이트에 서빙됨
    └── <id>.enc                            ← 암호문 (JSON: {iv, tag, data})

_includes/locked-musing.html                ← Jekyll 인라인 토글 템플릿
```

> `musings/_locked/` 와 `musings/_scripts/` 는 `_` prefix 폴더라 Jekyll 빌드에서 자동 제외 + `_config.yml` `exclude` 명시. `_locked/` 만 추가로 `.gitignore` 처리.

## 처음 한 번 세팅

```bash
# 1) 비밀번호 파일 생성 (한 줄, 빈 줄/개행 포함 X)
mkdir -p musings/_locked
echo -n "원하는비밀번호" > musings/_locked/password.txt

# 2) 평문 노트 작성
nano musings/_locked/2026-04-22-a.txt
```

## 잠긴 노트 추가/수정

```bash
# 1) 평문 작성 또는 수정
nano musings/_locked/<id>.txt

# 2) 암호화 (모든 노트 또는 특정 id)
node musings/_scripts/encrypt-locked-musings.js
node musings/_scripts/encrypt-locked-musings.js <id>

# 3) 사색 노트 본문에 토글 삽입 (디폴트 라벨: "🔒 솔직하지만 부끄러운 감정")
{% raw %}{% include locked-musing.html id="<id>" %}{% endraw %}
# 라벨 바꾸고 싶을 때만 인자 추가
{% raw %}{% include locked-musing.html id="<id>" label="🔒 다른 라벨" %}{% endraw %}

# 4) .enc 와 musing 본문만 커밋
git add musings/locked/<id>.enc musings/<post>.md
git commit -m "..."
```

## 평문 복구 (혹시 `musings/_locked/` 가 날아갔을 때)

```bash
# stdout 으로 출력
node musings/_scripts/decrypt-locked-musings.js <id>

# musings/_locked/<id>.txt 로 복원
node musings/_scripts/decrypt-locked-musings.js <id> --restore
```

## 비밀번호 변경

1. 새 비밀번호로 `musings/_locked/password.txt` 갱신
2. 모든 잠긴 노트 재암호화: `node musings/_scripts/encrypt-locked-musings.js`
3. 변경된 `.enc` 파일들 커밋

## ID 컨벤션

내용 힌트가 안 묻도록 `<yyyy-mm-dd>-<a|b|c…>` 형식 권장. 같은 날 여러 잠긴 노트가 생기면 `-b`, `-c` 로 확장.

예: `2026-04-22-a`, `2026-04-22-b`

## 보안 메모

- **암호화**: AES-256-GCM + PBKDF2-SHA256 (100k iterations, salt: `rahoon_musings_2026`)
- **브라우저 복호화**: SubtleCrypto API (외부 라이브러리 없음)
- **세션 캐시**: 같은 탭에서는 한 번 입력하면 sessionStorage 에 비번 저장. 탭 종료 시 비움
- **평문 위치**: `musings/_locked/` (gitignore + Jekyll exclude). 비번도 `MUSINGS_PASSWORD` 환경변수로 대체 가능 (스크립트에서 `musings/_locked/password.txt` 보다 우선)
- **GitHub Pages 배포**: `.enc` 만 사이트에 올라감. 평문/비번은 로컬에서만 존재
- **password.txt 자체는 암호화 대상에서 제외**: `encrypt-locked-musings.js` 가 `.txt` 중 `password.txt` 만 골라냄

## dashboard 와의 관계

이 시스템은 `dashboard/encrypt.js` 와 같은 알고리즘이지만 salt 가 다름 (`rahoon_dashboard_2025` vs `rahoon_musings_2026`). 같은 비번을 써도 도출되는 키가 달라지므로 잠긴 노트와 dashboard 비공개 데이터는 독립적으로 보호됨.

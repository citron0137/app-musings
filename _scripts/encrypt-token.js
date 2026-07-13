#!/usr/bin/env node
/**
 * GitHub 토큰 암호화 (로컬 전용)
 *
 *   _locked/token.txt         (평문 PAT 한 줄, gitignore — 절대 커밋 X)
 *   _locked/password.txt      (사이트 전체 비밀번호)
 *      ↓
 *   token.enc                 (커밋 O — 사이트에 공개 서빙된다)
 *
 * 사용법 (저장소 루트에서):
 *   node _scripts/encrypt-token.js        # 만료일은 GitHub 에서 자동 조회·검증
 *
 * 왜 만료일을 같이 넣나:
 *   토큰 암호문이 public 저장소에 공개되므로, 비밀번호가 언젠가 깨지면 토큰도 깨진다.
 *   그 위험을 90일 만료로 제한하는 것이 이 설계의 유일한 안전장치다.
 *   만료일을 암호문 안에 넣어야 페이지가 "곧 만료" 경고를 띄울 수 있고,
 *   토큰이 조용히 죽어서 메모가 안 올라가는 사고를 막을 수 있다.
 *
 * 자세한 배경: 00-docs/설계-메모기능.md
 */
const fs = require('fs');
const path = require('path');
const { encrypt, loadPassword, readTextFileSafe } = require('./lib/musings-crypto');

const ROOT = path.resolve(__dirname, '..');
const LOCKED_DIR = path.join(ROOT, '_locked');
const TOKEN_FILE = path.join(LOCKED_DIR, 'token.txt');
const PASSWORD_FILE = path.join(LOCKED_DIR, 'password.txt');
const OUT_FILE = path.join(ROOT, 'token.enc');

const OWNER = 'citron0137';
const REPO = 'site-musings';

const MAX_EXPIRY_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 만료일을 GitHub 에게 직접 물어본다 — 사람이 입력한 날짜를 믿지 않는다.
 *
 * GitHub 은 만료가 설정된 토큰에만 github-authentication-token-expiration 헤더를 붙인다.
 * 즉 헤더가 없다 = 만료 없는 토큰 = 이 설계에서 절대 쓰면 안 되는 토큰.
 *
 * (브라우저에서는 이 헤더를 읽을 수 없다 — GitHub 의 Access-Control-Expose-Headers 에
 *  포함돼 있지 않다. 그래서 진짜 검증이 가능한 곳은 여기, CLI 뿐이다.)
 */
async function fetchExpiry(token) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
  });

  if (res.status === 401) {
    console.error('토큰이 유효하지 않습니다 (401). 폐기됐거나 잘못 붙여넣었습니다.');
    process.exit(1);
  }
  if (res.status === 404) {
    console.error(`토큰이 ${OWNER}/${REPO} 에 접근하지 못합니다 (404).`);
    console.error('Repository access 에 이 저장소가 포함돼 있는지 확인하세요.');
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`GitHub 응답 ${res.status}`);
    process.exit(1);
  }

  const header = res.headers.get('github-authentication-token-expiration');
  if (!header) {
    console.error('이 토큰에는 만료일이 없습니다 (GitHub 이 만료 헤더를 보내지 않음).');
    console.error('암호문이 공개 저장소에 영구히 남으므로, 만료 없는 토큰은 쓸 수 없습니다.');
    console.error(`${MAX_EXPIRY_DAYS}일 이하 만료로 재발급하세요.`);
    process.exit(1);
  }

  // 예: "2026-10-09 21:15:40 UTC"
  const date = new Date(header.replace(' UTC', 'Z').replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) {
    console.error(`만료 헤더를 해석할 수 없습니다: ${header}`);
    process.exit(1);
  }

  const days = Math.ceil((date.getTime() - Date.now()) / DAY_MS);
  if (days <= 0) {
    console.error(`토큰이 이미 만료됐습니다 (${header}).`);
    process.exit(1);
  }
  if (days > MAX_EXPIRY_DAYS) {
    console.error(`만료가 ${days}일 뒤입니다 — ${MAX_EXPIRY_DAYS}일을 넘습니다.`);
    console.error('토큰 암호문이 공개 저장소에 올라가므로, 유효 기간이 곧 위험 노출 창입니다.');
    process.exit(1);
  }

  // 저장은 날짜만 (시각까지는 필요 없다 — 경고 배너용)
  return { raw: date.toISOString().slice(0, 10), days };
}

async function main() {
  if (!fs.existsSync(TOKEN_FILE)) {
    console.error(`${TOKEN_FILE} 가 없습니다.`);
    console.error('GitHub fine-grained PAT (site-musings 저장소 Contents 읽기/쓰기) 를 한 줄로 저장하세요.');
    process.exit(1);
  }

  const token = readTextFileSafe(TOKEN_FILE).trim();
  if (!token) {
    console.error('_locked/token.txt 가 비어 있습니다.');
    process.exit(1);
  }
  if (!token.startsWith('github_pat_')) {
    console.error('fine-grained PAT 이 아닙니다 (github_pat_ 로 시작해야 함).');
    console.error('classic 토큰(ghp_)은 쓰면 안 됩니다 — 모든 공개 저장소에 쓰기 권한이 열립니다.');
    process.exit(1);
  }

  let password;
  try {
    password = loadPassword(PASSWORD_FILE);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  // 만료일은 사람에게 묻지 않고 GitHub 에게 물어본다 — 그래야 진짜 검증이 된다.
  const { raw: expires, days } = await fetchExpiry(token);

  const payload = JSON.stringify({ token, expires });
  fs.writeFileSync(OUT_FILE, JSON.stringify(encrypt(payload, password)), 'utf8');

  console.log(`token.enc 생성 완료 — 만료 ${expires} (${days}일 남음, GitHub 확인값)`);
  console.log('평문 토큰은 _locked/token.txt 에만 있습니다 (gitignore).');
  console.log('다음: git add token.enc && git commit');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});



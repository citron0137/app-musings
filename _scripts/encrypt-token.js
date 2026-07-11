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
 *   node _scripts/encrypt-token.js --expires 2026-10-10
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

const MAX_EXPIRY_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseExpires(argv) {
  const i = argv.indexOf('--expires');
  if (i === -1 || !argv[i + 1]) {
    console.error('만료일이 필요합니다: node _scripts/encrypt-token.js --expires YYYY-MM-DD');
    console.error('GitHub 에서 PAT 발급할 때 지정한 만료일을 그대로 적으세요.');
    process.exit(1);
  }
  const raw = argv[i + 1];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    console.error(`만료일 형식이 잘못됐습니다: ${raw} (YYYY-MM-DD 이어야 함)`);
    process.exit(1);
  }
  const date = new Date(`${raw}T23:59:59+09:00`);
  if (Number.isNaN(date.getTime())) {
    console.error(`만료일을 해석할 수 없습니다: ${raw}`);
    process.exit(1);
  }
  const days = Math.ceil((date.getTime() - Date.now()) / DAY_MS);
  if (days <= 0) {
    console.error(`만료일이 이미 지났습니다: ${raw}`);
    process.exit(1);
  }
  if (days > MAX_EXPIRY_DAYS) {
    console.error(`만료일이 ${days}일 뒤입니다 — ${MAX_EXPIRY_DAYS}일을 넘습니다.`);
    console.error('토큰 암호문이 공개 저장소에 올라가므로, 유효 기간이 곧 위험 노출 창입니다.');
    console.error(`${MAX_EXPIRY_DAYS}일 이하로 발급하세요.`);
    process.exit(1);
  }
  return { raw, days };
}

function main() {
  const { raw: expires, days } = parseExpires(process.argv);

  if (!fs.existsSync(TOKEN_FILE)) {
    console.error(`${TOKEN_FILE} 가 없습니다.`);
    console.error('GitHub fine-grained PAT (app-musings 저장소 Contents 읽기/쓰기) 를 한 줄로 저장하세요.');
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

  const payload = JSON.stringify({ token, expires });
  fs.writeFileSync(OUT_FILE, JSON.stringify(encrypt(payload, password)), 'utf8');

  console.log(`token.enc 생성 완료 — 만료 ${expires} (${days}일 남음)`);
  console.log('평문 토큰은 _locked/token.txt 에만 있습니다 (gitignore).');
  console.log('다음: git add token.enc && git commit');
}

main();

#!/usr/bin/env node
/**
 * 잠긴 노트(.enc) 무결성 검증 — pre-commit / pre-push 훅 본체
 *
 * locked/*.enc 를 복호화해서 _locked/<id>.txt 평문과 일치하는지 검사한다.
 * 평문을 고쳐놓고 재암호화를 깜빡한 채 커밋하는 사고를 막는 것이 목적.
 *
 * 검증 불가 상황(비밀번호 파일 없음 / 평문 없음)은 통과시킨다 —
 * 평문은 gitignore 대상이라 다른 기기의 클론에는 아예 없을 수 있다.
 */
const fs = require('fs');
const path = require('path');
const { decrypt, loadPassword, readTextFileSafe } = require('../_scripts/lib/musings-crypto');

const ROOT = path.resolve(__dirname, '..');
const ENC_DIR = path.join(ROOT, 'locked');
const PLAIN_DIR = path.join(ROOT, '_locked');
const PASSWORD_FILE = path.join(PLAIN_DIR, 'password.txt');
const ENCRYPT_CMD = 'node _scripts/encrypt-locked-musings.js';

function fail(problems) {
  console.error('');
  console.error('[pre-commit] 잠긴 노트 무결성 검증 실패');
  problems.forEach((p) => console.error(`  - ${p}`));
  console.error('');
  console.error(`  재암호화: ${ENCRYPT_CMD}`);
  console.error('  우회:     git commit --no-verify');
  console.error('');
  process.exit(1);
}

function main() {
  if (!fs.existsSync(ENC_DIR)) return;

  const encFiles = fs.readdirSync(ENC_DIR).filter((f) => f.endsWith('.enc'));
  if (encFiles.length === 0) return;

  if (!fs.existsSync(PASSWORD_FILE) && !process.env.MUSINGS_PASSWORD) {
    console.error('[pre-commit] _locked/password.txt 없음 — 무결성 검증 건너뜀');
    return;
  }

  const password = loadPassword(PASSWORD_FILE);
  const problems = [];
  let checked = 0;

  for (const file of encFiles) {
    const id = file.replace(/\.enc$/, '');
    const plainPath = path.join(PLAIN_DIR, `${id}.txt`);

    if (!fs.existsSync(plainPath)) {
      console.error(`[pre-commit] _locked/${id}.txt 없음 — ${file} 검증 건너뜀`);
      continue;
    }

    let decrypted;
    try {
      decrypted = decrypt(fs.readFileSync(path.join(ENC_DIR, file), 'utf8'), password);
    } catch (e) {
      problems.push(`locked/${file} 복호화 실패 — 비밀번호가 바뀌었거나 파일이 깨졌습니다.`);
      continue;
    }

    if (decrypted !== readTextFileSafe(plainPath)) {
      problems.push(`locked/${file} 가 _locked/${id}.txt 와 다릅니다 — 재암호화가 필요합니다.`);
    }
    checked += 1;
  }

  if (problems.length > 0) fail(problems);

  console.log(`[pre-commit] 잠긴 노트 ${checked}개 무결성 OK`);
}

main();

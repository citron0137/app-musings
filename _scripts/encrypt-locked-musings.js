#!/usr/bin/env node
/**
 * 잠긴 사색 노트 암호화 스크립트 (로컬 전용)
 *
 *   _locked/<id>.txt          (평문, gitignore)
 *   _locked/password.txt      (사이트 전체 비밀번호 한 줄, gitignore)
 *      ↓
 *   locked/<id>.enc           (커밋 대상)
 *
 * 사용법 (저장소 루트에서):
 *   node _scripts/encrypt-locked-musings.js          # 모든 노트 암호화
 *   node _scripts/encrypt-locked-musings.js <id>     # 특정 노트만
 *   MUSINGS_PASSWORD=xxx node _scripts/encrypt-locked-musings.js
 */
const fs = require('fs');
const path = require('path');
const { encrypt, loadPassword, readTextFileSafe, ITERATIONS } = require('./lib/musings-crypto');

const ROOT = path.resolve(__dirname, '..');
const PLAIN_DIR = path.join(ROOT, '_locked');
const PASSWORD_FILE = path.join(PLAIN_DIR, 'password.txt');
const OUT_DIR = path.join(ROOT, 'locked');

function listTargets(filterId) {
  if (!fs.existsSync(PLAIN_DIR)) {
    console.error(`${PLAIN_DIR} 디렉토리가 없습니다.`);
    process.exit(1);
  }
  const all = fs.readdirSync(PLAIN_DIR).filter(
    (f) => f.endsWith('.txt') && f !== 'password.txt'
  );
  if (filterId) {
    const target = `${filterId}.txt`;
    if (!all.includes(target)) {
      console.error(`_locked/${target} 를 찾을 수 없습니다.`);
      process.exit(1);
    }
    return [target];
  }
  return all;
}

function main() {
  const filterId = process.argv[2];

  let password;
  try {
    password = loadPassword(PASSWORD_FILE);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const targets = listTargets(filterId);
  if (targets.length === 0) {
    console.log('암호화할 노트가 없습니다.');
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const filename of targets) {
    const id = filename.replace(/\.txt$/, '');
    const plaintext = readTextFileSafe(path.join(PLAIN_DIR, filename));
    const encrypted = encrypt(plaintext, password);
    fs.writeFileSync(path.join(OUT_DIR, `${id}.enc`), JSON.stringify(encrypted), 'utf8');
    console.log(`암호화 완료: ${id}.enc (PBKDF2 ${ITERATIONS.toLocaleString()}회)`);
  }
}

main();

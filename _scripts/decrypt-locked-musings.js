#!/usr/bin/env node
/**
 * 잠긴 사색 노트 복호화 스크립트 (로컬 전용 — 평문 복구용)
 *
 *   locked/<id>.enc           (암호문)
 *   _locked/password.txt      (비밀번호)
 *      ↓
 *   stdout (평문 출력) 또는 _locked/<id>.txt 에 복원
 *
 * 사용법 (저장소 루트에서):
 *   node _scripts/decrypt-locked-musings.js <id>            # 평문을 stdout 으로 출력
 *   node _scripts/decrypt-locked-musings.js <id> --restore  # _locked/<id>.txt 에 복원
 *   MUSINGS_PASSWORD=xxx node _scripts/decrypt-locked-musings.js <id>
 */
const fs = require('fs');
const path = require('path');
const { decrypt, loadPassword } = require('./lib/musings-crypto');

const ROOT = path.resolve(__dirname, '..');
const ENC_DIR = path.join(ROOT, 'locked');
const PLAIN_DIR = path.join(ROOT, '_locked');
const PASSWORD_FILE = path.join(PLAIN_DIR, 'password.txt');

function main() {
  const id = process.argv[2];
  const restore = process.argv.includes('--restore');

  if (!id) {
    console.error('사용법: node _scripts/decrypt-locked-musings.js <id> [--restore]');
    process.exit(1);
  }

  const encPath = path.join(ENC_DIR, `${id}.enc`);
  if (!fs.existsSync(encPath)) {
    console.error(`${encPath} 를 찾을 수 없습니다.`);
    process.exit(1);
  }

  let password;
  try {
    password = loadPassword(PASSWORD_FILE);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  let plaintext;
  try {
    plaintext = decrypt(fs.readFileSync(encPath, 'utf8'), password);
  } catch (e) {
    console.error('복호화 실패. 비밀번호를 확인하세요.');
    process.exit(1);
  }

  if (restore) {
    fs.mkdirSync(PLAIN_DIR, { recursive: true });
    fs.writeFileSync(path.join(PLAIN_DIR, `${id}.txt`), plaintext, 'utf8');
    console.error(`복원 완료: _locked/${id}.txt`);
  } else {
    process.stdout.write(plaintext);
  }
}

main();

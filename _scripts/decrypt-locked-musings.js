#!/usr/bin/env node
/**
 * 잠긴 사색 노트 복호화 스크립트 (로컬 전용 — 평문 복구용)
 *
 *   musings/locked/<id>.enc           (암호문)
 *   musings/_locked/password.txt      (비밀번호)
 *      ↓
 *   stdout (평문 출력) 또는 musings/_locked/<id>.txt 에 복원
 *
 * 사용법 (프로젝트 루트에서):
 *   node musings/_scripts/decrypt-locked-musings.js <id>            # 평문을 stdout 으로 출력
 *   node musings/_scripts/decrypt-locked-musings.js <id> --restore  # musings/_locked/<id>.txt 에 복원
 *   MUSINGS_PASSWORD=xxx node musings/_scripts/decrypt-locked-musings.js <id>
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const ENC_DIR = path.join(ROOT, 'musings', 'locked');
const PLAIN_DIR = path.join(ROOT, 'musings', '_locked');
const PASSWORD_FILE = path.join(PLAIN_DIR, 'password.txt');

const SALT = 'rahoon_musings_2026';
const ITERATIONS = 100000;
const KEY_LEN = 32;

/**
 * BOM 을 보고 인코딩을 자동 판별해 텍스트로 디코딩.
 * Windows PowerShell 의 UTF-16 LE 기본 저장 같은 함정 방어.
 */
function readTextFileSafe(filePath) {
  const buf = fs.readFileSync(filePath);
  let text;
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    text = buf.slice(3).toString('utf8');
  } else if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
    text = buf.slice(2).toString('utf16le');
  } else if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) {
    const content = buf.slice(2);
    const swapped = Buffer.alloc(content.length);
    for (let i = 0; i < content.length - 1; i += 2) {
      swapped[i] = content[i + 1];
      swapped[i + 1] = content[i];
    }
    text = swapped.toString('utf16le');
  } else {
    text = buf.toString('utf8');
  }
  return text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
}

function deriveKey(password) {
  return crypto.pbkdf2Sync(password, Buffer.from(SALT, 'utf8'), ITERATIONS, KEY_LEN, 'sha256');
}

function decrypt(encrypted, password) {
  const key = deriveKey(password);
  const iv = Buffer.from(encrypted.iv, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');
  const data = Buffer.from(encrypted.data, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function loadPassword() {
  if (process.env.MUSINGS_PASSWORD) {
    return process.env.MUSINGS_PASSWORD.trim();
  }
  if (!fs.existsSync(PASSWORD_FILE)) {
    console.error(`musings/_locked/password.txt 가 없습니다.`);
    process.exit(1);
  }
  return readTextFileSafe(PASSWORD_FILE).replace(/\n+$/, '').trim();
}

function main() {
  const id = process.argv[2];
  const restore = process.argv.includes('--restore');

  if (!id) {
    console.error('사용법: node musings/_scripts/decrypt-locked-musings.js <id> [--restore]');
    process.exit(1);
  }

  const encPath = path.join(ENC_DIR, `${id}.enc`);
  if (!fs.existsSync(encPath)) {
    console.error(`${encPath} 를 찾을 수 없습니다.`);
    process.exit(1);
  }

  const encrypted = JSON.parse(fs.readFileSync(encPath, 'utf8'));
  const password = loadPassword();

  let plaintext;
  try {
    plaintext = decrypt(encrypted, password);
  } catch (e) {
    console.error('복호화 실패. 비밀번호를 확인하세요.');
    process.exit(1);
  }

  if (restore) {
    fs.mkdirSync(PLAIN_DIR, { recursive: true });
    const outPath = path.join(PLAIN_DIR, `${id}.txt`);
    fs.writeFileSync(outPath, plaintext, 'utf8');
    console.error(`복원 완료: musings/_locked/${id}.txt`);
  } else {
    process.stdout.write(plaintext);
  }
}

main();

#!/usr/bin/env node
/**
 * 잠긴 사색 노트 암호화 스크립트 (로컬 전용)
 *
 *   musings/_locked/<id>.txt          (평문, gitignore)
 *   musings/_locked/password.txt      (사이트 전체 비밀번호 한 줄, gitignore)
 *      ↓
 *   musings/locked/<id>.enc           (커밋 대상)
 *
 * 사용법 (프로젝트 루트에서):
 *   node musings/_scripts/encrypt-locked-musings.js          # 모든 노트 암호화
 *   node musings/_scripts/encrypt-locked-musings.js <id>     # 특정 노트만
 *   MUSINGS_PASSWORD=xxx node musings/_scripts/encrypt-locked-musings.js
 *
 * 형식: dashboard 의 encrypt.js 와 동일한 AES-256-GCM + PBKDF2(SHA-256, 100k)
 *       단, salt 는 'rahoon_musings_2026' 으로 분리.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const PLAIN_DIR = path.join(ROOT, 'musings', '_locked');
const PASSWORD_FILE = path.join(PLAIN_DIR, 'password.txt');
const OUT_DIR = path.join(ROOT, 'musings', 'locked');

const SALT = 'rahoon_musings_2026';
const ITERATIONS = 100000;
const KEY_LEN = 32;
const IV_LEN = 12;

/**
 * BOM 을 보고 인코딩을 자동 판별해 텍스트로 디코딩.
 * Windows PowerShell 의 UTF-16 LE 기본 저장 같은 함정 방어.
 * 지원: UTF-8 (BOM 유무 무관), UTF-16 LE, UTF-16 BE.
 * 줄바꿈은 \n 으로 통일.
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

function encrypt(plaintext, password) {
  const key = deriveKey(password);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: data.toString('base64')
  };
}

function loadPassword() {
  if (process.env.MUSINGS_PASSWORD) {
    return process.env.MUSINGS_PASSWORD.trim();
  }
  if (!fs.existsSync(PASSWORD_FILE)) {
    console.error(`musings/_locked/password.txt 가 없습니다.`);
    console.error(`사이트 전체 비밀번호 한 줄을 ${PASSWORD_FILE} 에 저장하세요.`);
    process.exit(1);
  }
  const pw = readTextFileSafe(PASSWORD_FILE).replace(/\n+$/, '').trim();
  if (!pw) {
    console.error('musings/_locked/password.txt 가 비어 있습니다.');
    process.exit(1);
  }
  return pw;
}

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
      console.error(`musings/_locked/${target} 를 찾을 수 없습니다.`);
      process.exit(1);
    }
    return [target];
  }
  return all;
}

function main() {
  const filterId = process.argv[2];
  const password = loadPassword();
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
    const outPath = path.join(OUT_DIR, `${id}.enc`);
    fs.writeFileSync(outPath, JSON.stringify(encrypted), 'utf8');
    console.log(`암호화 완료: ${id}.enc`);
  }
}

main();

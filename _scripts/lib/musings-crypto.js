/**
 * 잠긴 노트 / inbox 메모 공용 암호화 모듈 (Node 전용)
 *
 * 포맷 v2: {"v":2,"iter":<반복수>,"iv":..,"tag":..,"data":..}  (모두 base64)
 * 포맷 v1: {"iv":..,"tag":..,"data":..}                        (반복수 100000 고정)
 *
 * 반복 횟수를 파일 안에 적어두므로, 앞으로 KDF 파라미터를 올려도
 * 이전에 만든 .enc 는 그대로 열린다. 브라우저 복호화 코드
 * (_includes/locked-musing.html) 도 같은 규칙을 따른다.
 */
const fs = require('fs');
const crypto = require('crypto');

const SALT = 'rahoon_musings_2026';
const ITERATIONS = 600000;        // 신규 암호화에 쓰는 값
const LEGACY_ITERATIONS = 100000; // v1 파일의 암묵적 값
const FORMAT_VERSION = 2;
const KEY_LEN = 32;
const IV_LEN = 12;

/**
 * BOM 을 보고 인코딩을 자동 판별해 텍스트로 디코딩.
 * Windows PowerShell 의 UTF-16 LE 기본 저장 같은 함정 방어.
 * 지원: UTF-8 (BOM 유무 무관), UTF-16 LE, UTF-16 BE. 줄바꿈은 \n 으로 통일.
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

function deriveKey(password, iterations) {
  return crypto.pbkdf2Sync(password, Buffer.from(SALT, 'utf8'), iterations, KEY_LEN, 'sha256');
}

function encrypt(plaintext, password) {
  const key = deriveKey(password, ITERATIONS);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    v: FORMAT_VERSION,
    iter: ITERATIONS,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64')
  };
}

function decrypt(encJson, password) {
  const blob = typeof encJson === 'string' ? JSON.parse(encJson) : encJson;
  const iterations = blob.iter || LEGACY_ITERATIONS;
  const key = deriveKey(password, iterations);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(blob.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(blob.data, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

/** 비밀번호 로드. MUSINGS_PASSWORD 환경변수가 password.txt 보다 우선. */
function loadPassword(passwordFile) {
  if (process.env.MUSINGS_PASSWORD) {
    return process.env.MUSINGS_PASSWORD.trim();
  }
  if (!fs.existsSync(passwordFile)) {
    throw new Error(`${passwordFile} 가 없습니다. 비밀번호 한 줄을 저장하세요.`);
  }
  const pw = readTextFileSafe(passwordFile).replace(/\n+$/, '').trim();
  if (!pw) {
    throw new Error(`${passwordFile} 가 비어 있습니다.`);
  }
  return pw;
}

module.exports = {
  SALT,
  ITERATIONS,
  LEGACY_ITERATIONS,
  FORMAT_VERSION,
  readTextFileSafe,
  deriveKey,
  encrypt,
  decrypt,
  loadPassword
};

#!/usr/bin/env node
/**
 * pre-commit 훅의 본체.
 *
 * staging 여부와 관계없이 *워킹트리의 모든 .enc 파일* 을 검증:
 *   1. 시스템(musings/dashboard)별로 .enc 디렉토리 스캔
 *   2. 각 .enc 를 복호화
 *   3. 대응 평문과 문자열 비교
 *   4. 불일치 시 커밋 차단 + 친절한 안내
 *
 * 비밀번호 또는 평문이 없는 시스템은 silent skip
 * (fresh checkout / 다른 dev 의 환경 시나리오 대응).
 *
 * 우회: git commit --no-verify
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

// 시스템별 설정 — 같은 알고리즘, salt 만 다름
const SYSTEMS = [
  {
    name: 'musings',
    discover() {
      const dir = path.join(ROOT, 'musings', 'locked');
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir)
        .filter(f => f.endsWith('.enc'))
        .map(f => {
          const id = f.replace(/\.enc$/, '');
          return {
            encPath: path.join(dir, f),
            encRel: `musings/locked/${f}`,
            plainPath: path.join(ROOT, 'musings', '_locked', `${id}.txt`),
            plainRel: `musings/_locked/${id}.txt`,
          };
        });
    },
    passwordFile: path.join(ROOT, 'musings', '_locked', 'password.txt'),
    passwordRel: 'musings/_locked/password.txt',
    envVar: 'MUSINGS_PASSWORD',
    salt: 'rahoon_musings_2026',
    encryptCmd: 'node musings/_scripts/encrypt-locked-musings.js',
  },
  {
    name: 'dashboard',
    discover() {
      const enc = path.join(ROOT, 'dashboard', 'links-private.enc');
      if (!fs.existsSync(enc)) return [];
      return [{
        encPath: enc,
        encRel: 'dashboard/links-private.enc',
        plainPath: path.join(ROOT, 'dashboard', '_private', 'links-private.json'),
        plainRel: 'dashboard/_private/links-private.json',
      }];
    },
    passwordFile: path.join(ROOT, 'dashboard', '_private', 'password.txt'),
    passwordRel: 'dashboard/_private/password.txt',
    envVar: 'DASHBOARD_PASSWORD',
    salt: 'rahoon_dashboard_2025',
    encryptCmd: 'node dashboard/_scripts/encrypt.js',
  },
];

const ITERATIONS = 100000;
const KEY_LEN = 32;

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

function loadPassword(system) {
  if (process.env[system.envVar]) return process.env[system.envVar].trim();
  if (!fs.existsSync(system.passwordFile)) return null;
  return readTextFileSafe(system.passwordFile).replace(/\n+$/, '').trim();
}

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, Buffer.from(salt, 'utf8'), ITERATIONS, KEY_LEN, 'sha256');
}

function decryptBlob(blob, password, salt) {
  const key = deriveKey(password, salt);
  const iv = Buffer.from(blob.iv, 'base64');
  const tag = Buffer.from(blob.tag, 'base64');
  const data = Buffer.from(blob.data, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function fail(msg) { console.error(`${RED}[validate-enc] ${msg}${RESET}`); }
function note(msg) { console.error(`${YELLOW}[validate-enc] ${msg}${RESET}`); }

function main() {
  let hadError = false;

  for (const sys of SYSTEMS) {
    const targets = sys.discover();
    if (targets.length === 0) continue;

    const password = loadPassword(sys);
    if (!password) {
      // 비번 없음 → 검증 불가, skip (fresh checkout 등에서 무관한 커밋 차단 방지)
      continue;
    }

    for (const t of targets) {
      if (!fs.existsSync(t.plainPath)) {
        // 평문 없음 → 검증 불가, skip
        continue;
      }

      let encJson;
      try {
        encJson = JSON.parse(fs.readFileSync(t.encPath, 'utf8'));
      } catch (e) {
        fail(`${t.encRel}: 유효한 JSON 이 아닙니다 (${e.message}).`);
        hadError = true;
        continue;
      }

      let decrypted;
      try {
        decrypted = decryptBlob(encJson, password, sys.salt);
      } catch (e) {
        fail(`${t.encRel}: 복호화 실패 — 비밀번호가 다르거나 .enc 가 손상됐을 수 있습니다.`);
        hadError = true;
        continue;
      }

      const plaintext = readTextFileSafe(t.plainPath);

      if (decrypted !== plaintext) {
        fail(`${t.encRel} ↔ ${t.plainRel}: 일치하지 않습니다.`);
        fail(`  → '${sys.encryptCmd}' 로 재암호화 후 다시 커밋하세요.`);
        hadError = true;
      }
    }
  }

  if (hadError) {
    console.error('');
    note('어떻게든 그대로 커밋하려면: git commit --no-verify');
    process.exit(1);
  }
  process.exit(0);
}

main();

#!/usr/bin/env node
/**
 * inbox 브랜치의 메모를 받아 평문으로 푼다 (로컬 전용)
 *
 *   origin/inbox 의 inbox/<stamp>.enc      (폰에서 올린 암호문)
 *      ↓
 *   _inbox/<stamp>.txt                     (평문, gitignore + Jekyll exclude)
 *
 * 사용법 (저장소 루트, main 브랜치에서):
 *   node _scripts/pull-inbox.js
 *   node _scripts/pull-inbox.js --list     # 받지 않고 목록만
 *
 * 브랜치를 갈아타지 않는다 — fetch 후 `git show` 로 파일 내용만 읽는다.
 * inbox 는 main 과 공통 조상이 없는 고아 브랜치라, 체크아웃하면 작업트리가 헝클어진다.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { decrypt, loadPassword } = require('./lib/musings-crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, '_inbox');
const PASSWORD_FILE = path.join(ROOT, '_locked', 'password.txt');
const BRANCH = 'inbox';
const DIR = 'inbox';

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function main() {
  const listOnly = process.argv.includes('--list');

  try {
    git('fetch', '--quiet', 'origin', `${BRANCH}:refs/remotes/origin/${BRANCH}`);
  } catch (err) {
    console.error(`origin/${BRANCH} 를 받아올 수 없습니다: ${err.message}`);
    process.exit(1);
  }

  const files = git('ls-tree', '--name-only', `origin/${BRANCH}`, `${DIR}/`)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.enc'))
    .sort();

  if (files.length === 0) {
    console.log('메모가 없습니다.');
    return;
  }

  if (listOnly) {
    files.forEach((f) => console.log(path.basename(f, '.enc')));
    console.log(`\n총 ${files.length}개`);
    return;
  }

  let password;
  try {
    password = loadPassword(PASSWORD_FILE);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let written = 0;
  let failed = 0;
  for (const file of files) {
    const id = path.basename(file, '.enc');
    const outPath = path.join(OUT_DIR, `${id}.txt`);
    if (fs.existsSync(outPath)) continue;   // 이미 푼 것은 건너뛴다

    try {
      fs.writeFileSync(outPath, decrypt(git('show', `origin/${BRANCH}:${file}`), password), 'utf8');
      written += 1;
    } catch (err) {
      console.error(`복호화 실패: ${id} (${err.message})`);
      failed += 1;
    }
  }

  console.log(`_inbox/ 에 ${written}개 추가 (전체 ${files.length}개${failed ? `, 실패 ${failed}개` : ''})`);
  if (written > 0) console.log('평문입니다 — gitignore 대상이라 커밋되지 않습니다.');
}

main();

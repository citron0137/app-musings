#!/usr/bin/env node
/**
 * .githooks/ 의 훅을 git 에 활성화.
 *
 *   node .githooks/install.js
 *
 * 동작:
 *   - core.hooksPath 를 .githooks 로 설정
 *   - pre-commit 의 실행 비트 부여 (Unix; Windows 에서는 무시됨)
 *
 * 비활성화: git config --unset core.hooksPath
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  execSync('git config core.hooksPath .githooks', { stdio: 'inherit' });
  console.log('git core.hooksPath = .githooks');
} catch (e) {
  console.error('git config 실패:', e.message);
  process.exit(1);
}

for (const hook of ['pre-commit', 'pre-push']) {
  try {
    fs.chmodSync(path.join(__dirname, hook), 0o755);
  } catch (e) {
    // Windows 에서는 chmod 가 의미 없거나 실패할 수 있음 — 무시
  }
}

console.log('설치 완료. 이제 .enc 가 staged 일 때 자동으로 평문 일치 검증.');
console.log('우회: git commit --no-verify');

/**
 * 브라우저 암호화 모듈 — 잠긴 노트와 inbox 메모가 공유한다.
 *
 * Node 쪽 대응물: _scripts/lib/musings-crypto.js (같은 알고리즘·같은 포맷)
 *
 * 포맷 v2: {"v":2,"iter":<반복수>,"iv":..,"tag":..,"data":..}  (모두 base64)
 * 포맷 v1: {"iv":..,"tag":..,"data":..}                        (반복수 100000 고정)
 *
 * 반복 횟수를 파일 안에서 읽으므로, 앞으로 KDF 파라미터를 올려도 옛 파일이 그대로 열린다.
 */
window.MusingsCrypto = (function () {
  const SALT = 'rahoon_musings_2026';
  const ITERATIONS = 600000;        // 새로 암호화할 때 쓰는 값
  const LEGACY_ITERATIONS = 100000; // v1 파일의 암묵적 값
  const FORMAT_VERSION = 2;
  const TAG_BYTES = 16;             // AES-GCM 인증 태그 길이

  // 키는 (반복수, 용도, 비번) 조합으로 캐시 — 인메모리만. 새로고침하면 휘발된다.
  const keyCache = new Map();

  function b64ToBytes(s) {
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  }

  function bytesToB64(bytes) {
    const arr = new Uint8Array(bytes);
    let s = '';
    for (let i = 0; i < arr.length; i += 1) s += String.fromCharCode(arr[i]);
    return btoa(s);
  }

  async function deriveKey(password, iterations, usages) {
    const cacheKey = iterations + ':' + usages.join(',') + ':' + password;
    if (keyCache.has(cacheKey)) return keyCache.get(cacheKey);

    const enc = new TextEncoder();
    const material = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode(SALT), iterations: iterations, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      usages
    );
    keyCache.set(cacheKey, key);
    return key;
  }

  /** 평문 → v2 암호문 객체 */
  async function encrypt(plaintext, password) {
    const key = await deriveKey(password, ITERATIONS, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(plaintext)
    ));
    // WebCrypto 는 태그를 암호문 뒤에 붙여서 준다 — Node 포맷(iv/tag/data 분리)에 맞춘다.
    return {
      v: FORMAT_VERSION,
      iter: ITERATIONS,
      iv: bytesToB64(iv),
      tag: bytesToB64(sealed.slice(sealed.length - TAG_BYTES)),
      data: bytesToB64(sealed.slice(0, sealed.length - TAG_BYTES))
    };
  }

  /** v1/v2 암호문(JSON 문자열 또는 객체) → 평문 */
  async function decrypt(encJson, password) {
    const blob = typeof encJson === 'string' ? JSON.parse(encJson) : encJson;
    const key = await deriveKey(password, blob.iter || LEGACY_ITERATIONS, ['decrypt']);
    const data = b64ToBytes(blob.data);
    const tag = b64ToBytes(blob.tag);
    const sealed = new Uint8Array(data.length + tag.length);
    sealed.set(data);
    sealed.set(tag, data.length);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64ToBytes(blob.iv) }, key, sealed
    );
    return new TextDecoder().decode(plain);
  }

  function clearKeyCache() {
    keyCache.clear();
  }

  return { encrypt, decrypt, clearKeyCache, ITERATIONS, LEGACY_ITERATIONS };
})();

---
layout: null
permalink: /sw.js
---
/**
 * 루트 스코프 서비스워커.
 *
 * 목적 둘:
 *   1. 비행기모드에서도 페이지가 열린다. 메모는 지하철·새벽에 쓰는 물건이라,
 *      그 순간 안 열리면 기능이 아니라 장식이다.
 *   2. token.enc 를 캐시한다. 오프라인에서도 비밀번호를 검증하고 메모를 암호화해
 *      큐에 넣어야 하기 때문 — 캐시가 없으면 신호 없을 때 저장이 통째로 실패한다.
 *
 * 문서는 네트워크 우선(2초 타임아웃)이다.
 *   루트 페이지가 곧 사색노트 목록이라, 캐시 우선으로 두면 새 노트가 안 보인다.
 *   대신 신호가 나쁠 때 무한정 기다리지 않도록 타임아웃을 두고 캐시로 넘어간다.
 *
 * api.github.com 은 절대 캐시하지 않는다 —
 * 캐시된 응답을 "전송 성공"으로 오인하면 메모가 사라진다.
 */
// 버전을 올리면 activate 가 옛 캐시를 통째로 지운다.
// v2: 라이트 테마 전환 — '/' 와 manifest 가 프리캐시돼 있어서,
//     버전을 안 올리면 기존 방문자에게 다크 버전이 계속 나온다.
const CACHE = 'musings-v2';
const SHELL = ['/', '/js/musings-crypto.js', '/manifest.webmanifest'];
const TOKEN_PATH = '/token.enc';
const DOC_TIMEOUT_MS = 2000;

// token.enc 는 프리캐시에 넣지 않는다 —
// addAll 은 하나라도 실패하면 전체가 실패한다. 토큰 등록 전(404)에는
// 서비스워커 설치 자체가 죽어서 오프라인 기능이 통째로 사라진다.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function putIfOk(request, response) {
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

/** 네트워크를 기다리되 timeout 을 넘기면 캐시로 넘어간다. 캐시가 없으면 네트워크를 끝까지 기다린다. */
function networkFirst(request, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (res) => { if (!settled && res) { settled = true; resolve(res); } };

    const timer = setTimeout(() => {
      caches.match(request).then(done);
    }, timeoutMs);

    fetch(request)
      .then((res) => {
        clearTimeout(timer);
        done(putIfOk(request, res));
      })
      .catch(() => {
        clearTimeout(timer);
        caches.match(request).then((cached) => done(cached || Response.error()));
      });
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // GitHub API 등 외부는 손대지 않는다

  // 문서: 네트워크 우선 — 새 사색노트가 바로 보여야 한다.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, DOC_TIMEOUT_MS));
    return;
  }

  // token.enc: 최신 우선, 오프라인이면 캐시본으로 비밀번호 검증을 가능하게 한다.
  // 404(등록 전)는 캐시하지 않는다 — 캐시하면 나중에 등록해도 오프라인에서 못 찾는다.
  if (url.pathname === TOKEN_PATH) {
    event.respondWith(
      fetch(request)
        .then((res) => putIfOk(request, res))
        .catch(() => caches.match(request))
    );
    return;
  }

  // 자산: 캐시 우선, 뒤에서 조용히 갱신
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => putIfOk(request, res))
        .catch(() => cached);
      return cached || network;
    })
  );
});

---
layout: null
permalink: /inbox/sw.js
---
/**
 * 메모 앱 서비스워커 — 비행기모드에서도 열리게 하는 것이 전부다.
 *
 * 왜 필요한가:
 *   메모는 지하철·새벽·상담 끝나고 나오는 길에 쓴다.
 *   그 순간 페이지가 안 열리면 이건 기능이 아니라 장식이다.
 *
 * token.enc 를 캐시하는 이유:
 *   오프라인에서도 비밀번호를 검증하고 메모를 암호화해서 큐에 넣어야 한다.
 *   캐시가 없으면 신호 없을 때 save() 가 토큰을 못 받아 통째로 실패한다 — 즉 글이 날아간다.
 *
 * api.github.com 은 절대 캐시하지 않는다. 전송은 항상 실제 네트워크여야 한다.
 */
const CACHE = 'musings-inbox-v2';
const SHELL = [
  '/inbox/',
  '/js/musings-crypto.js',
  '/inbox/manifest.webmanifest'
];
const TOKEN_PATH = '/token.enc';

// token.enc 는 프리캐시에 넣지 않는다.
// addAll 은 하나라도 실패하면 전체가 실패한다 — 토큰 등록 전(404)에는
// 서비스워커 설치 자체가 실패해서 오프라인 기능이 통째로 죽는다.
// 토큰은 첫 성공 응답 때 fetch 핸들러가 알아서 캐시한다.
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

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // GitHub API 는 손대지 않는다 — 캐시된 응답을 "전송 성공"으로 오인하면 메모가 사라진다.
  if (url.origin !== self.location.origin) return;

  // token.enc: 최신을 우선하되, 오프라인이면 캐시본으로라도 비밀번호 검증을 가능하게 한다.
  //
  // 성공한 응답만 캐시한다. 404(아직 등록 전)를 캐시하면, 나중에 토큰을 등록해도
  // 캐시에 404 가 남아 오프라인에서 토큰을 못 찾는다.
  if (url.pathname === TOKEN_PATH) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 셸: 캐시 우선, 뒤에서 조용히 갱신
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

/* 서비스 워커: 앱 껍데기를 미리 저장해 두고 오프라인에서도 열리게 한다.
   페이지는 네트워크 우선(새 버전을 바로 받음), 같은 출처 파일은 저장본을 먼저 주고 뒤에서 갱신, 글꼴은 저장본 우선.
   __VERSION__은 build.sh가 배포 커밋으로 바꿔 넣는다. */
'use strict';
var VERSION='__VERSION__';
var CACHE='arcade-'+VERSION;
var FONT_CACHE='arcade-fonts';
var SHELL=[
  './','index.html','core.js','pwa.js','manifest.webmanifest',
  'g-jelly.js','g-runner.js','g-meteor.js','g-guard.js','g-candy.js','g-stars.js','g-whack.js','g-bubble.js','g-lantern.js','g-archery.js','g-prism.js','g-pond.js',
  'icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png'
];

self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(SHELL); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k!==CACHE&&k!==FONT_CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET') return;
  var url=new URL(req.url);

  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'){
    e.respondWith(caches.open(FONT_CACHE).then(function(c){
      return c.match(req).then(function(hit){
        return hit||fetch(req).then(function(res){ if(res.ok||res.type==='opaque') c.put(req,res.clone()); return res; });
      });
    }));
    return;
  }
  if(url.origin!==self.location.origin) return;

  if(req.mode==='navigate'){
    e.respondWith(fetch(req).then(function(res){
      var copy=res.clone(); caches.open(CACHE).then(function(c){ c.put('index.html',copy); });
      return res;
    }).catch(function(){ return caches.match('index.html'); }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(function(c){
    return c.match(req,{ignoreSearch:true}).then(function(hit){
      var net=fetch(req).then(function(res){ if(res.ok) c.put(req,res.clone()); return res; }).catch(function(){ return hit; });
      return hit||net;
    });
  }));
});

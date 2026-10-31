/* 설치형 앱(PWA)용: 서비스 워커 등록. 정적 호스팅 빌드에만 포함되고 Claude 아티팩트에서는 쓰지 않는다. */
(function(){
'use strict';
if(!('serviceWorker' in navigator)) return;
var local=location.hostname==='localhost'||location.hostname==='127.0.0.1';
if(location.protocol!=='https:'&&!local) return;
window.addEventListener('load',function(){
  navigator.serviceWorker.register('sw.js').catch(function(){});
});
})();

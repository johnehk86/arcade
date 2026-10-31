/* 설치형 앱(PWA)용: 서비스 워커 등록과 "홈 화면에 추가" 배너. 정적 호스팅 빌드에만 포함되고 Claude 아티팩트에서는 쓰지 않는다.
   안드로이드 크롬은 beforeinstallprompt로 바로 설치 창을 띄우고, 아이폰 사파리는 공유 메뉴 안내를 보여 준다.
   이미 설치된 앱(독립 실행)이나 플레이 스토어 앱(?source=app)에서는 배너를 숨긴다. */
(function(){
'use strict';
var local=location.hostname==='localhost'||location.hostname==='127.0.0.1';
if('serviceWorker' in navigator&&(location.protocol==='https:'||local)){
  window.addEventListener('load',function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
}

var KEY='arc_install_hide_until';
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
function installed(){
  var mm=function(q){ try{ return window.matchMedia(q).matches; }catch(e){ return false; } };
  return mm('(display-mode: standalone)')||mm('(display-mode: fullscreen)')||window.navigator.standalone===true||
    /[?&]source=app/.test(location.search)||document.referrer.indexOf('android-app://')===0;
}
var ua=navigator.userAgent||'';
var isIOS=/iphone|ipad|ipod/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
var deferred=null;

function el(id){ return document.getElementById(id); }
function snoozed(){ return Number(store(KEY)||0)>Date.now(); }
function show(){ if(installed()||snoozed()) return; var b=el('install'); if(b) b.hidden=false; }
function hide(){ var b=el('install'); if(b) b.hidden=true; }

window.addEventListener('beforeinstallprompt',function(e){
  e.preventDefault(); deferred=e;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',show); else show();
});
window.addEventListener('appinstalled',function(){ deferred=null; hide(); });

function bind(){
  var btn=el('install-btn'), x=el('install-x'), sub=el('install-sub');
  if(!btn) return;
  btn.addEventListener('click',function(){
    if(deferred){
      deferred.prompt();
      deferred.userChoice.then(function(c){ if(c&&c.outcome==='accepted') hide(); deferred=null; }).catch(function(){});
    } else if(isIOS){
      sub.textContent='Safari 아래쪽 공유 버튼(□↑)을 누르고 "홈 화면에 추가"를 골라 주세요.';
      btn.textContent='알겠어요';
      btn.onclick=function(){ hide(); };
    }
  });
  x.addEventListener('click',function(){ store(KEY,String(Date.now()+7*86400e3)); hide(); });
  if(isIOS&&!installed()&&/safari/i.test(ua)&&!/crios|fxios|edgios/i.test(ua)) show();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind); else bind();
})();

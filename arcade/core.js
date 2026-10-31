/* 달빛 아케이드 공용 엔진
   게임 하나는 Arcade.register({...})로 등록한다. 셸이 캔버스, 루프, HUD, 소리, 이펙트, 랭킹, 결과 화면을 맡고
   게임은 start / update / draw / pointer / key / preview / result 만 구현한다. 좌표는 폭 360 기준 논리 좌표. */
(function(){
'use strict';

var W=360;
var A=window.Arcade={games:[],byId:{}};
A.register=function(g){ A.games.push(g); A.byId[g.id]=g; };

/* ---------- 유틸 ---------- */
function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function lerp(a,b,k){ return a+(b-a)*k; }
function easeOutBack(x){ var c=1.6; return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2); }
function easeOutCubic(x){ return 1-Math.pow(1-x,3); }
function fmt(n){ return Math.round(Number(n)||0).toLocaleString('ko-KR'); }
function todayKey(){ return new Date(Date.now()+9*3600e3).toISOString().slice(0,10).replace(/-/g,''); }
function seedFrom(str){ var h=2166136261; for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
A.util={clamp:clamp,lerp:lerp,easeOutBack:easeOutBack,easeOutCubic:easeOutCubic,fmt:fmt,seedFrom:seedFrom,mulberry:mulberry};

var store={
  get:function(k,d){ try{ var v=localStorage.getItem(k); return v===null?d:v; }catch(e){ return d; } },
  set:function(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
};
A.store=store;
var today=todayKey();
var reduceMotion=false;
try{ reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}

/* ---------- 소리: 잔향 버스 하나와 노이즈 버퍼 하나를 공유 ---------- */
var au={ctx:null,master:null,dry:null,conv:null,noise:null,muted:store.get('arc_mute','0')==='1'};
function ensureAudio(){
  if(!au.ctx){
    try{
      var AC=window.AudioContext||window.webkitAudioContext;
      if(AC){
        var c=au.ctx=new AC();
        au.master=c.createGain(); au.master.gain.value=0.6;
        var comp=c.createDynamicsCompressor(); comp.threshold.value=-14; comp.ratio.value=4;
        au.master.connect(comp); comp.connect(c.destination);
        au.dry=c.createGain(); au.dry.connect(au.master);
        au.conv=c.createConvolver();
        var len=Math.floor(c.sampleRate*2.4), buf=c.createBuffer(2,len,c.sampleRate);
        for(var ch=0;ch<2;ch++){ var d=buf.getChannelData(ch); for(var i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.4); }
        au.conv.buffer=buf;
        var wet=c.createGain(); wet.gain.value=0.38; au.conv.connect(wet); wet.connect(au.master);
        var nl=c.sampleRate, nb=c.createBuffer(1,nl,c.sampleRate), nd=nb.getChannelData(0);
        for(var j=0;j<nl;j++) nd[j]=Math.random()*2-1;
        au.noise=nb;
      }
    }catch(e){ au.ctx=null; }
  }
  if(au.ctx&&au.ctx.state==='suspended') au.ctx.resume().catch(function(){});
}
function route(g,wet){ g.connect(au.dry); if(wet) g.connect(au.conv); }
function tone(f,dur,type,vol,opt){
  if(!au.ctx||au.muted) return;
  opt=opt||{};
  var c=au.ctx, t0=c.currentTime+(opt.delay||0), o=c.createOscillator(), g=c.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(f,t0);
  if(opt.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,opt.slide),t0+dur);
  g.gain.setValueAtTime(0.0001,t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002,vol),t0+(opt.attack||0.005));
  g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  o.connect(g); route(g,opt.wet!==false);
  o.start(t0); o.stop(t0+dur+0.05);
}
function noise(dur,vol,opt){
  if(!au.ctx||au.muted) return;
  opt=opt||{};
  var c=au.ctx, t0=c.currentTime+(opt.delay||0), s=c.createBufferSource(), f=c.createBiquadFilter(), g=c.createGain();
  s.buffer=au.noise; s.playbackRate.value=opt.rate||1;
  f.type=opt.type||'lowpass'; f.Q.value=opt.q||0.8;
  f.frequency.setValueAtTime(opt.freq||1400,t0);
  if(opt.slide) f.frequency.exponentialRampToValueAtTime(Math.max(30,opt.slide),t0+dur);
  g.gain.setValueAtTime(0.0001,t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002,vol),t0+(opt.attack||0.003));
  g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  s.connect(f); f.connect(g); route(g,!!opt.wet);
  s.start(t0,Math.random()*0.5); s.stop(t0+dur+0.05);
}
function mtof(m){ return 440*Math.pow(2,(m-69)/12); }
function pluck(m,vol,delay){
  var f=mtof(m);
  tone(f,1.2,'triangle',vol,{delay:delay});
  tone(f*2,0.6,'sine',vol*0.32,{delay:delay});
}
function haptic(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }
A.sfx={tone:tone,noise:noise,pluck:pluck,mtof:mtof};

/* ---------- 이펙트: 빛 입자, 파편, 고리, 글자, 흔들림, 번쩍임, 히트스톱 ---------- */
var glowCache={};
function glow(rgb){
  if(!glowCache[rgb]){
    var c=document.createElement('canvas'); c.width=c.height=64;
    var g=c.getContext('2d'), gr=g.createRadialGradient(32,32,0,32,32,32);
    gr.addColorStop(0,'rgba('+rgb+',1)'); gr.addColorStop(0.3,'rgba('+rgb+',.5)'); gr.addColorStop(1,'rgba('+rgb+',0)');
    g.fillStyle=gr; g.fillRect(0,0,64,64); glowCache[rgb]=c;
  }
  return glowCache[rgb];
}
var fx={parts:[],shardList:[],rings:[],texts:[],shakeA:0,flashA:0,flashC:'255,240,220',stop:0,pulseA:0,additive:true,font:'"Jua","Apple SD Gothic Neo",sans-serif'};
fx.glow=glow;
fx.reset=function(){ fx.parts.length=0; fx.shardList.length=0; fx.rings.length=0; fx.texts.length=0; fx.shakeA=0; fx.flashA=0; fx.stop=0; fx.pulseA=0; };
fx.burst=function(x,y,n,rgb,speed,opt){
  opt=opt||{};
  var s0=opt.size?opt.size[0]:5, s1=opt.size?opt.size[1]:14, spr=glow(rgb);
  for(var i=0;i<n;i++){
    var a=opt.angle!=null?opt.angle+(Math.random()-.5)*(opt.spread||1):Math.random()*Math.PI*2;
    var v=(opt.min||0.2)*speed+Math.random()*speed*(1-(opt.min||0.2));
    var life=(opt.life||0.8)*(0.6+Math.random()*0.7);
    fx.parts.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:life,max:life,s:s0+Math.random()*(s1-s0),spr:spr,g:opt.gravity||0,drag:opt.drag==null?2.4:opt.drag});
  }
  if(fx.parts.length>700) fx.parts.splice(0,fx.parts.length-700);
};
fx.shards=function(x,y,n,color,speed,size,opt){
  opt=opt||{};
  for(var i=0;i<n;i++){
    var a=Math.random()*Math.PI*2, v=speed*(0.3+Math.random()*0.7), life=(opt.life||0.9)*(0.6+Math.random()*0.6);
    fx.shardList.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:Math.random()*6.28,vr:(Math.random()-.5)*14,s:size*(0.5+Math.random()*0.8),c:color,life:life,max:life,g:opt.gravity||0});
  }
  if(fx.shardList.length>300) fx.shardList.splice(0,fx.shardList.length-300);
};
fx.ring=function(x,y,r,rgb,dur,w,a,delay){ fx.rings.push({x:x,y:y,r:r,c:rgb,dur:dur||0.6,w:w||2,a:a==null?0.8:a,age:-(delay||0)}); };
fx.text=function(x,y,s,color,size,dur,opt){ opt=opt||{}; fx.texts.push({x:x,y:y,s:s,c:color,size:size||20,dur:dur||0.9,age:-(opt.delay||0),rise:opt.rise==null?28:opt.rise,stroke:opt.stroke||'rgba(0,0,0,.55)',weight:opt.weight||700}); };
fx.shake=function(a){ if(!reduceMotion||a<3) fx.shakeA=Math.max(fx.shakeA,reduceMotion?a*0.3:a); };
fx.flash=function(a,rgb){ if(a>fx.flashA){ fx.flashA=a; fx.flashC=rgb||'255,240,220'; } };
fx.hitstop=function(s){ fx.stop=Math.max(fx.stop,s); };
fx.pulse=function(a){ fx.pulseA=Math.max(fx.pulseA,a); };
fx.update=function(dt){
  var i,p;
  for(i=fx.parts.length-1;i>=0;i--){ p=fx.parts[i]; p.life-=dt; if(p.life<=0){ fx.parts.splice(i,1); continue; }
    var k=Math.exp(-dt*p.drag); p.vx*=k; p.vy=p.vy*k+p.g*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; }
  for(i=fx.shardList.length-1;i>=0;i--){ p=fx.shardList[i]; p.life-=dt; if(p.life<=0){ fx.shardList.splice(i,1); continue; }
    p.vx*=Math.exp(-dt*1.6); p.vy=p.vy*Math.exp(-dt*1.6)+p.g*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.rot+=p.vr*dt; }
  for(i=fx.rings.length-1;i>=0;i--){ fx.rings[i].age+=dt; if(fx.rings[i].age>fx.rings[i].dur) fx.rings.splice(i,1); }
  for(i=fx.texts.length-1;i>=0;i--){ fx.texts[i].age+=dt; if(fx.texts[i].age>fx.texts[i].dur) fx.texts.splice(i,1); }
  fx.shakeA*=Math.exp(-dt*12); if(fx.shakeA<0.05) fx.shakeA=0;
  fx.flashA*=Math.exp(-dt*7); fx.pulseA*=Math.exp(-dt*10);
};
fx.draw=function(ctx){
  var i,p;
  for(i=0;i<fx.rings.length;i++){
    var r=fx.rings[i]; if(r.age<0) continue;
    var k=r.age/r.dur, rr=r.r*(1-Math.pow(1-k,2.6));
    ctx.strokeStyle='rgba('+r.c+','+(r.a*(1-k))+')'; ctx.lineWidth=r.w*(1-k*0.5);
    ctx.beginPath(); ctx.arc(r.x,r.y,Math.max(0.5,rr),0,Math.PI*2); ctx.stroke();
  }
  for(i=0;i<fx.shardList.length;i++){
    p=fx.shardList[i]; ctx.globalAlpha=Math.min(1,p.life/p.max*1.6);
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.c;
    ctx.beginPath(); ctx.moveTo(0,-p.s); ctx.lineTo(p.s*0.8,p.s*0.6); ctx.lineTo(-p.s*0.7,p.s*0.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha=1;
  if(fx.additive) ctx.globalCompositeOperation='lighter';
  for(i=0;i<fx.parts.length;i++){
    p=fx.parts[i]; ctx.globalAlpha=Math.max(0,p.life/p.max);
    ctx.drawImage(p.spr,p.x-p.s/2,p.y-p.s/2,p.s,p.s);
  }
  ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.lineJoin='round';
  for(i=0;i<fx.texts.length;i++){
    var tx=fx.texts[i]; if(tx.age<0) continue;
    var q=tx.age/tx.dur, sc=q<0.12?easeOutBack(q/0.12):1;
    ctx.globalAlpha=1-q*q;
    ctx.font=(tx.weight===700?'400':tx.weight)+' '+Math.round(tx.size*sc)+'px '+fx.font;
    var px=clamp(tx.x,70,W-70), py=tx.y-q*tx.rise;
    ctx.lineWidth=Math.max(3,tx.size*0.22); ctx.strokeStyle=tx.stroke; ctx.strokeText(tx.s,px,py);
    ctx.fillStyle=tx.c; ctx.fillText(tx.s,px,py);
  }
  ctx.globalAlpha=1;
};
A.fx=fx;

/* ---------- DOM ---------- */
function $(id){ return document.getElementById(id); }
var stage, canvas, ctx, scale=1, H=640;
var cur=null, view='hub', paused=false, lastNow=0, restartAt=0, dieAt=0;
var api={W:W,H:H,t:0,state:'menu',daily:true,rng:Math.random,score:0,pointerDown:false,reduceMotion:reduceMotion,
  fx:fx,sfx:A.sfx,util:A.util,haptic:haptic,today:today};

function resize(){
  if(!canvas) return;
  var r=canvas.getBoundingClientRect();
  var dpr=Math.min(window.devicePixelRatio||1,2.5);
  canvas.width=Math.max(1,Math.round(r.width*dpr));
  canvas.height=Math.max(1,Math.round(r.height*dpr));
  scale=canvas.width/W; H=canvas.height/scale; api.H=H;
  sizeCards();
}

/* ---------- 점수와 HUD ---------- */
var targets=[], targetIdx=0;
api.addScore=function(pts){
  api.score+=Math.round(pts);
  var el=$('score'); el.textContent=fmt(api.score);
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  checkRival();
  return api.score;
};
api.setSub=function(s){ var el=$('sub'); if(s){ el.textContent=s; el.classList.add('on'); } else el.classList.remove('on'); };
api.setMeter=function(frac,label,hot){
  var el=$('meter');
  if(frac==null){ el.hidden=true; return; }
  el.hidden=false; el.classList.toggle('hot',!!hot);
  el.querySelector('i').style.transform='scaleX('+clamp(frac,0,1)+')';
  el.querySelector('span').textContent=label||'';
};
var ICONS={
  petal:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c4 4 6 8 6 12a6 6 0 0 1-12 0c0-4 2-8 6-12z"/></svg>',
  shield:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z"/></svg>'
};
var livesShown=-1, livesMax=0;
api.setLives=function(n,max){
  var el=$('lives');
  if(!cur||!cur.lifeIcon){ el.hidden=true; return; }
  el.hidden=false;
  if(max!==livesMax){ livesMax=max; var h=''; for(var i=0;i<max;i++) h+=ICONS[cur.lifeIcon]; el.innerHTML=h; }
  var s=el.querySelectorAll('svg');
  for(var j=0;j<s.length;j++) s[j].classList.toggle('lost',j>=n);
  if(livesShown>n){ el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
  livesShown=n;
  el.setAttribute('aria-label','남은 목숨 '+n+'개');
};
api.end=function(){
  if(api.state!=='play') return;
  setState('dying'); dieAt=performance.now()+(cur.endDelay||1100);
  renderRival(false);
};
function setState(s){ api.state=s; stage.dataset.state=s; }

/* ---------- 보상형 광고: 앱(Capacitor + AdMob)에서만 켜진다 ----------
   window.ARCADE_ADS = {units:{revive, double, mission}, testing:true|false} 는 앱 빌드에서만 넣는다.
   웹사이트와 Claude 아티팩트에서는 광고 버튼이 나오지 않는다. 주소에 ?adsdemo 를 붙이면 가짜 광고로 흐름을 시험할 수 있다. */
var ads=(function(){
  var TEST_UNIT='ca-app-pub-3940256099942544/5224354917';
  var demo=/[?&]adsdemo\b/.test(location.search);
  var busy=false, loaded={}, inited=null;
  function cfg(){ return window.ARCADE_ADS||null; }
  var admob=null;
  function plugin(){
    if(admob) return admob;
    var C=window.Capacitor;
    try{
      if(!(C&&C.isNativePlatform&&C.isNativePlatform())) return null;
      // 번들러 없이 쓰므로 @capacitor/core(capacitor.js)의 registerPlugin으로 네이티브 AdMob 프록시를 만든다
      var reg=(window.capacitorExports&&window.capacitorExports.registerPlugin)||C.registerPlugin;
      admob=(C.Plugins&&C.Plugins.AdMob)||(reg?reg('AdMob'):null);
      return admob;
    }catch(e){ return null; }
  }
  function unit(pl){ var c=cfg(); return c.testing?TEST_UNIT:(c.units[pl]||c.units.revive); }
  function init(){
    var pg=plugin(); if(!pg||!cfg()) return Promise.resolve(false);
    if(!inited) inited=Promise.resolve(pg.initialize({initializeForTesting:!!cfg().testing})).then(function(){ return true; },function(){ return false; });
    return inited;
  }
  function prepare(pl){
    var pg=plugin();
    return init().then(function(ok){
      if(!ok) throw new Error('init');
      return pg.prepareRewardVideoAd({adId:unit(pl),isTesting:!!cfg().testing});
    }).then(function(){ loaded[pl]=true; });
  }
  function available(){ return demo||(!!plugin()&&!!cfg()); }
  function demoShow(){
    return new Promise(function(res){
      var o=document.createElement('div'); o.className='ad-demo'; o.setAttribute('role','dialog');
      var b=document.createElement('div'); b.className='ad-demo-box';
      var t=document.createElement('b'); t.textContent='테스트 광고';
      var c=document.createElement('span'); var n=3; c.textContent=n+'초 뒤 보상';
      var x=document.createElement('button'); x.type='button'; x.textContent='닫기';
      b.append(t,c,x); o.append(b); document.body.append(o);
      var iv=setInterval(function(){ n--; if(n<=0){ clearInterval(iv); c.textContent='보상을 받았어요'; setTimeout(function(){ o.remove(); res('rewarded'); },500); } else c.textContent=n+'초 뒤 보상'; },1000);
      x.addEventListener('click',function(){ clearInterval(iv); o.remove(); res(n<=0?'rewarded':'dismissed'); });
    });
  }
  function nativeShow(pl){
    var pg=plugin(), rewarded=false, handles=[], settled=false;
    return new Promise(function(res){
      function done(r){ if(settled) return; settled=true; handles.forEach(function(h){ try{ h.remove(); }catch(e){} }); res(r); }
      function on(ev,fn){ Promise.resolve(pg.addListener(ev,fn)).then(function(h){ if(settled){ try{ h.remove(); }catch(e){} } else handles.push(h); }); }
      on('onRewardedVideoAdReward',function(){ rewarded=true; });
      on('onRewardedVideoAdDismissed',function(){ done(rewarded?'rewarded':'dismissed'); });
      on('onRewardedVideoAdFailedToShow',function(){ done('failed'); });
      (loaded[pl]?Promise.resolve():prepare(pl)).then(function(){
        loaded[pl]=false;
        return pg.showRewardVideoAd();
      }).then(function(item){ if(item) rewarded=true; setTimeout(function(){ done(rewarded?'rewarded':'dismissed'); },90000); })
        .catch(function(){ done('failed'); });
    });
  }
  function show(pl){
    if(busy) return Promise.resolve('busy');
    busy=true;
    var wasPaused=paused; paused=true;
    try{ if(au.ctx) au.ctx.suspend(); }catch(e){}
    return (demo&&!plugin()?demoShow():nativeShow(pl)).then(function(r){
      busy=false; paused=wasPaused; lastNow=performance.now();
      try{ if(au.ctx&&!au.muted) au.ctx.resume(); }catch(e){}
      if(plugin()) prepare(pl).catch(function(){});
      return r;
    });
  }
  function warm(){ if(plugin()&&cfg()) ['revive','double','mission'].forEach(function(pl){ prepare(pl).catch(function(){}); }); }
  return {available:available,show:show,warm:warm};
})();
A.ads=ads;

/* ---------- 이어하기: 판이 끝나는 순간 한 번 제안한다 ---------- */
var reviveTimer=null;
function afterDie(){
  dieAt=Infinity;
  if(cur.revive&&!api.revived&&api.score>0&&ads.available()) showRevive();
  else showOver();
}
function showRevive(){
  paused=true;
  $('rv-desc').textContent=cur.reviveText||'짧은 광고를 보면 지금 점수 그대로 이어서 할 수 있어요.';
  $('rv-score').textContent=fmt(api.score);
  $('revive').hidden=false;
  var n=6, el=$('rv-count'); el.textContent=String(n);
  clearInterval(reviveTimer);
  reviveTimer=setInterval(function(){ n--; el.textContent=String(Math.max(0,n)); if(n<=0) skipRevive(); },1000);
}
function closeRevive(){ clearInterval(reviveTimer); reviveTimer=null; $('revive').hidden=true; }
function skipRevive(){ if($('revive').hidden) return; closeRevive(); paused=false; showOver(); }
function watchRevive(){
  clearInterval(reviveTimer); reviveTimer=null;
  $('rv-watch').disabled=true;
  ads.show('revive').then(function(r){
    $('rv-watch').disabled=false;
    closeRevive();
    if(r==='rewarded'&&cur){
      api.revived=true; paused=false; lastNow=performance.now();
      setState('play');
      cur.revive(api);
      renderRival(false);
      haptic(20);
    } else {
      paused=false;
      if(r!=='dismissed') toast('광고를 불러오지 못했어요. 결과를 보여 드릴게요.');
      showOver();
    }
  });
}

/* ---------- 따라잡을 상대 ---------- */
function buildTargets(){
  targets=[];
  var b=boards[cur.id], list=api.daily?b.daily:b.all, my=api.daily?myDayBest(cur.id):myBest(cur.id);
  for(var i=0;i<list.length;i++){ var s=list[i]; if(s.id!==cloud.uid&&s.v>0) targets.push({name:s.name,v:s.v}); }
  var na=b.nearAbove;
  if(na&&na.daily===api.daily&&!targets.some(function(x){ return x.v===na.v&&x.name===na.name; })) targets.push({name:na.name,v:na.v});
  if(my>0) targets.push({name:'내 최고 기록',v:my,self:true});
  targets.sort(function(a,b){ return a.v-b.v; });
  targetIdx=0; renderRival(false);
}
function checkRival(){
  var passed=null;
  while(targetIdx<targets.length&&api.score>targets[targetIdx].v){ passed=targets[targetIdx]; targetIdx++; }
  if(passed&&api.state==='play'){
    A.sfx.pluck(88,0.13); A.sfx.pluck(93,0.15,0.08); haptic(16);
    fx.text(W/2,H*0.3,passed.self?'내 기록 돌파':'추월 · '+passed.name,cur.palette.hotText||'#ffb3cf',24,1.5,{rise:16});
    fx.ring(W/2,H*0.3,W*0.55,cur.palette.hotRgb||'255,170,205',1.1,2,0.5);
  }
  renderRival(!!passed);
}
function renderRival(pass){
  var el=$('rival'); el.replaceChildren(); el.classList.toggle('pass',pass);
  if(api.state!=='play'){ el.hidden=true; return; }
  var nx=targets[targetIdx];
  if(nx){
    var b=document.createElement('b'); b.textContent=nx.name;
    el.append(nx.self?'목표 · ':'다음 상대 · ',b,' '+fmt(nx.v-api.score+1)+'점');
    el.hidden=false;
  } else if(targets.length){ el.textContent=api.daily?'오늘의 도전 1위로 달리는 중':'전체 1위로 달리는 중'; el.hidden=false; }
  else el.hidden=true;
}

/* ---------- 게임 열기, 시작, 종료 ---------- */
var nick=store.get('arc_nick','')||('손님'+(100+Math.floor(Math.random()*900)));
store.set('arc_nick',nick);
function getName(){ var v=$('nick').value.replace(/\s+/g,' ').trim().slice(0,10); return v||nick; }
function modeOf(id){ return store.get('arc_mode_'+id,'daily')==='free'?'free':'daily'; }

function applyPalette(g){
  var p=g.palette, s=stage.style;
  ['bg','surface','surface2','line','text','muted','accent','accentInk','accentDeep','hot'].forEach(function(k){
    if(p[k]) s.setProperty('--g-'+k.replace(/[A-Z0-9]/g,function(m){ return '-'+m.toLowerCase(); }),p[k]);
  });
  stage.classList.toggle('light',!!p.light);
  fx.additive=!p.light;
  var meta=document.querySelector('meta[name="theme-color"]'); if(meta) meta.content=p.bg;
}
function openGame(g){
  cur=g; view='game';
  $('hub').hidden=true; stage.hidden=false;
  applyPalette(g);
  $('m-kicker').textContent=g.kicker;
  $('m-title').textContent=g.title;
  $('m-lede').textContent=g.lede;
  $('m-how').textContent=g.how;
  $('board-title').textContent=g.title;
  livesMax=-1; livesShown=-1;
  $('menu').hidden=false; $('over').hidden=true; $('board').hidden=true; paused=false; closeRevive();
  setMode(modeOf(g.id));
  resize();
  setState('menu'); api.score=0; $('score').textContent='0'; api.setSub(''); api.setMeter(null); $('lives').hidden=true;
  fx.reset(); api.t=0; api.rng=Math.random;
  g.start(api);
  renderRival(false); updateMenuInfo();
  document.title=g.title+' · 달빛 아케이드';
  window.scrollTo(0,0);
}
function closeGame(){
  cur=null; view='hub';
  stage.hidden=true; $('hub').hidden=false; paused=false; closeRevive();
  document.title='달빛 아케이드';
  renderCards(); sizeCards();
}
function startRun(){
  if(!cur) return;
  ensureAudio();
  nick=getName(); store.set('arc_nick',nick);
  $('menu').hidden=true; $('over').hidden=true;
  api.daily=modeOf(cur.id)==='daily';
  api.rng=api.daily?mulberry(seedFrom(cur.id+'-'+today)):Math.random;
  api.score=0; $('score').textContent='0'; api.setSub(''); api.setMeter(null);
  livesMax=-1; livesShown=-1;
  fx.reset(); api.t=0; api.pointerDown=false; api.revived=false;
  closeRevive(); $('dbl').hidden=true;
  setState('play');
  cur.start(api);
  buildTargets();
}
function showOver(){
  setState('over'); restartAt=performance.now()+700;
  var g=cur, id=g.id, sc=api.score, daily=api.daily;
  var prev=daily?myDayBest(id):myBest(id);
  var lb=localBest(id); if(sc>lb) store.set('arc_'+id+'_best',String(sc));
  if(daily){ var ld=localDay(id); store.set('arc_'+id+'_day',today); store.set('arc_'+id+'_daybest',String(Math.max(ld,sc))); }
  var res=g.result?g.result(api):{stats:[]};
  $('final').textContent=fmt(sc);
  $('over-label').textContent=(daily?'오늘의 도전':'자유 모드')+' 점수';
  $('badge').hidden=!(sc>0&&sc>prev);
  var st=$('stats'); st.replaceChildren();
  (res.stats||[]).slice(0,3).forEach(function(s){
    var d=document.createElement('div'), b=document.createElement('b');
    b.textContent=String(s[1]); d.append(b,String(s[0])); st.append(d);
  });
  $('heal').textContent=res.line||'';
  var gain=onRunEnd(id,daily,sc>0&&sc>prev), rw=$('reward');
  rw.textContent='별사탕 +'+gain.earned+(gain.ready?' · 받을 미션 '+gain.ready+'개':''); rw.hidden=false;
  var dbl=$('dbl'); dbl.hidden=!ads.available(); dbl.disabled=false; dbl.dataset.n=String(gain.earned);
  $('dbl-n').textContent='+'+gain.earned;
  $('over').hidden=false;
  updateBest();
  renderResult(null,'pending');
  submitScore(id,sc,daily).then(function(status){
    var m=Math.max(sc,daily?myDayBest(id):myBest(id));
    return rankFor(id,daily,m).then(function(info){
      boards[id].nearAbove=info&&info.above?{name:info.above.name,v:info.above.v,daily:daily}:null;
      if(cur===g&&api.state==='over') renderResult(info,status);
    });
  });
}
function renderResult(info,status){
  var rl=$('rank-line'), ch=$('chase'); rl.replaceChildren(); ch.replaceChildren();
  var label=api.daily?'오늘의 도전 ':'전체 ';
  if(info){
    var b=document.createElement('b'); b.textContent=info.rank+'위';
    rl.append(label,b,' / '+fmt(info.total)+'명');
    if(info.above){
      var nb=document.createElement('b'); nb.textContent=info.above.name;
      var my=api.daily?myDayBest(cur.id):myBest(cur.id);
      ch.append('다음 순위 ',nb,'님까지 '+fmt(info.above.v-my+1)+'점');
    } else ch.append('지금 이 게임의 1위예요. 누가 따라오는지 지켜보세요.');
  } else if(!cloudReady()) rl.append('랭킹에 연결되지 않았어요');
  else rl.append('순위를 확인하는 중이에요');
  var note='';
  if(!cloudReady()) note='기록은 이 기기에만 남아요.';
  else if(cloud.canWrite===false) note='보기 전용 링크라 랭킹에는 기록되지 않아요.';
  else if(status==='ok') note='새 기록을 랭킹에 올렸어요.';
  else if(status==='fail') note='랭킹 등록에 실패했어요. 다음 판이 끝나면 다시 시도해요.';
  else if(status==='pending') note='랭킹에 등록하는 중이에요.';
  $('over-note').textContent=note;
}

/* ---------- 기록 ---------- */
function localBest(id){ return parseInt(store.get('arc_'+id+'_best','0'),10)||0; }
function localDay(id){ return store.get('arc_'+id+'_day','')===today?(parseInt(store.get('arc_'+id+'_daybest','0'),10)||0):0; }
function cloudBest(id){ var m=boards[id].mine; return m?(Number(m.best)||0):0; }
function cloudDay(id){ var m=boards[id].mine; return m&&m.day===today?(Number(m.dayBest)||0):0; }
function myBest(id){ return Math.max(localBest(id),cloudBest(id)); }
function myDayBest(id){ return Math.max(localDay(id),cloudDay(id)); }
function updateBest(){
  if(!cur) return;
  var d=modeOf(cur.id)==='daily';
  $('best-label').textContent=d?'오늘 최고':'내 최고';
  $('best').textContent=fmt(d?myDayBest(cur.id):myBest(cur.id));
}
function updateMenuInfo(){
  if(!cur) return;
  var el=$('menu-info'); el.replaceChildren();
  var d=modeOf(cur.id)==='daily', b=d?myDayBest(cur.id):myBest(cur.id), list=d?boards[cur.id].daily:boards[cur.id].all;
  if(list.length&&list[0].id!==cloud.uid){
    el.append((d?'오늘 1위 ':'전체 1위 ')); var n=document.createElement('b'); n.textContent=list[0].name+' '+fmt(list[0].v); el.append(n,' · ');
  }
  if(b>0){
    el.append(d?'오늘 내 기록 ':'내 최고 ');
    var s=document.createElement('b'); s.textContent=fmt(b); el.append(s);
    for(var k=0;k<list.length;k++){ if(list[k].id===cloud.uid){ el.append(' · '+(k+1)+'위'); break; } }
  } else el.append(d?'오늘은 모두에게 같은 패턴이 나와요. 첫 기록을 남겨 보세요.':'첫 기록을 남겨 보세요.');
}
function setMode(m){
  if(!cur) return;
  store.set('arc_mode_'+cur.id,m);
  $('mode-daily').setAttribute('aria-pressed',String(m==='daily'));
  $('mode-free').setAttribute('aria-pressed',String(m==='free'));
  boardTab=m==='daily'?'daily':'all';
  updateBest(); updateMenuInfo();
}

/* ---------- 랭킹 (db): 게임마다 컬렉션 하나, 한 사람당 문서 하나 ---------- */
var cloud={db:null,uid:null,canWrite:null,status:'connecting'};
var boards={}, boardTab='daily', slowTimer=null;
function cloudReady(){ return !!(cloud.db&&cloud.uid); }
function cloudWritable(){ return cloudReady()&&cloud.canWrite!==false; }
function mapDocs(snap,field){
  return snap.docs.map(function(d){ var v=d.data()||{}; return {id:d.id,name:String(v.name||'익명').slice(0,10),v:Number(v[field])||0}; })
    .filter(function(s){ return s.v>0; });
}
function q(id,daily){ var c=cloud.db.collection(id); return daily?c.where('day','==',today):c; }
function rankFor(id,daily,m){
  if(!cloudReady()||m<=0) return Promise.resolve(null);
  var b=boards[id], list=daily?b.daily:b.all, f=daily?'dayBest':'best';
  var others=list.filter(function(s){ return s.id!==cloud.uid; });
  var above=others.filter(function(s){ return s.v>m; });
  if(list.length<100||m>=list[list.length-1].v){
    return Promise.resolve({rank:above.length+1,total:others.length+1,above:above.length?above[above.length-1]:null});
  }
  return Promise.all([
    q(id,daily).where(f,'>',m).limit(1000).get(),
    q(id,daily).where(f,'>',m).orderBy(f,'asc').limit(1).get(),
    q(id,daily).where(f,'>',0).limit(1000).get()
  ]).then(function(r){
    var a=r[1].docs[0], ad=a?a.data()||{}:null;
    var meIn=r[2].docs.some(function(d){ return d.id===cloud.uid; });
    return {rank:r[0].size+1,total:r[2].size+(meIn?0:1),above:a?{name:String(ad.name||'익명').slice(0,10),v:Number(ad[f])||0}:null};
  }).catch(function(){ return null; });
}
function submitScore(id,run,daily){
  var b=boards[id];
  if(!cloudWritable()) return Promise.resolve('skip');
  if(b.writing) return Promise.resolve('busy');
  var m=b.mine, cb=cloudBest(id), nb=Math.max(cb,run,b.pendingBest);
  var day=m&&m.day?String(m.day):'', d0=m?(Number(m.dayBest)||0):0;
  var touchDay=daily||b.pendingDay>0;
  if(touchDay&&day!==today){ day=today; d0=0; }
  var nd=touchDay?Math.max(d0,daily?run:0,b.pendingDay):d0;
  var name=getName();
  if(nb<=0&&nd<=0) return Promise.resolve('nochange');
  if(m&&nb===cb&&nd===(Number(m.dayBest)||0)&&day===m.day&&m.name===name) return Promise.resolve('nochange');
  b.writing=true;
  return cloud.db.doc(id+'/'+cloud.uid).set({name:name,best:nb,day:day,dayBest:nd,t:Date.now()}).then(function(){
    b.pendingBest=0; b.pendingDay=0; b.writing=false; return 'ok';
  },function(){
    b.pendingBest=Math.max(b.pendingBest,run); if(daily) b.pendingDay=Math.max(b.pendingDay,run);
    b.writing=false; return 'fail';
  });
}
function onLists(){
  clearTimeout(slowTimer); cloud.status='ok';
  if(view==='hub') renderCards();
  else { updateMenuInfo(); if(!$('board').hidden) renderBoard(); }
}
function initCloud(){
  A.games.forEach(function(g){ boards[g.id]={all:[],daily:[],mine:null,pendingBest:0,pendingDay:0,writing:false,nearAbove:null}; });
  var c=window.claude;
  if(!c||!c.use){ cloud.status='offline'; return; }
  Promise.all([c.use('db'),c.use('user')]).then(function(r){
    var dbns=r[0], user=r[1];
    if(!dbns||!user){ cloud.status='offline'; onStatus(); return; }
    return Promise.all([user.id(),user.can('data.write')]).then(function(x){
      cloud.uid=x[0]; cloud.canWrite=x[1];
      if(!cloud.uid){ cloud.status='offline'; onStatus(); return; }
      cloud.db=dbns;
      slowTimer=setTimeout(function(){ if(cloud.status==='connecting'){ cloud.status='slow'; onStatus(); } },10000);
      A.games.forEach(function(g){
        var b=boards[g.id], col=dbns.collection(g.id);
        col.orderBy('best','desc').limit(100).onSnapshot(function(s){ b.all=mapDocs(s,'best'); onLists(); },function(){ cloud.status='offline'; onStatus(); });
        col.where('day','==',today).orderBy('dayBest','desc').limit(100).onSnapshot(function(s){ b.daily=mapDocs(s,'dayBest'); onLists(); },function(){});
        dbns.doc(g.id+'/'+cloud.uid).onSnapshot(function(s){ b.mine=s.exists?s.data():null; if(cur===g){ updateBest(); updateMenuInfo(); } if(view==='hub') renderCards(); },function(){});
      });
    });
  }).catch(function(){ cloud.status='offline'; onStatus(); });
}
function onStatus(){ if(!$('board').hidden) renderBoard(); }

function renderBoard(){
  if(!cur) return;
  $('tab-daily').setAttribute('aria-selected',String(boardTab==='daily'));
  $('tab-all').setAttribute('aria-selected',String(boardTab==='all'));
  var st=$('board-status'), s=cloud.status;
  if(s==='connecting') st.textContent='랭킹을 불러오는 중이에요.';
  else if(s==='slow') st.textContent='응답이 느려요. 잠시 뒤에 다시 열어 보세요.';
  else if(s==='offline') st.textContent='랭킹에 연결할 수 없어요. 게임은 그대로 즐길 수 있어요.';
  else if(cloud.canWrite===false) st.textContent='보기 전용이에요. 기록을 올리려면 게시자에게 참여 권한을 요청하세요.';
  else st.textContent=boardTab==='daily'?today.slice(4,6)+'월 '+today.slice(6)+'일, 모두 같은 패턴으로 겨룬 순위예요. 한국 시간 자정에 새 도전이 열려요.':'모든 판을 통틀어 가장 높은 점수 순이에요.';
  var ol=$('rows'); ol.replaceChildren();
  var list=boardTab==='daily'?boards[cur.id].daily:boards[cur.id].all;
  if(!list.length){
    var li=document.createElement('li'); li.className='empty';
    li.textContent=cloudReady()?'아직 기록이 없어요. 첫 번째 이름을 올려 보세요.':'랭킹이 연결되면 여기에 순위가 나와요.';
    ol.append(li); return;
  }
  var prev=null, prevRank=0;
  list.forEach(function(e,i){
    var rank=(prev!==null&&e.v===prev)?prevRank:i+1; prev=e.v; prevRank=rank;
    var li=document.createElement('li'); li.className='r'+(e.id===cloud.uid?' me':'')+(rank<=3?' top'+rank:'');
    var no=document.createElement('span'); no.className='no'; no.textContent=String(rank);
    var nm=document.createElement('span'); nm.className='nm'; nm.textContent=e.name+(e.id===cloud.uid?' (나)':'');
    var sc=document.createElement('span'); sc.className='sc'; sc.textContent=fmt(e.v);
    li.append(no,nm,sc); ol.append(li);
  });
}
function openBoard(){ $('board').hidden=false; paused=true; renderBoard(); }
function closeBoard(){ $('board').hidden=true; paused=false; lastNow=performance.now(); }

/* ---------- 성장: 별사탕, 레벨, 연속 출석, 일일 미션 (이 기기에 저장) ---------- */
var MISSIONS=[
  {id:'play3',ic:'3',name:'아무 게임 3판 하기',goal:3,reward:10,get:function(d){ return d.plays; }},
  {id:'play6',ic:'6',name:'아무 게임 6판 하기',goal:6,reward:20,get:function(d){ return d.plays; }},
  {id:'vary3',ic:'✦',name:'서로 다른 게임 3종 하기',goal:3,reward:15,get:function(d){ return d.games.length; }},
  {id:'daily2',ic:'★',name:'오늘의 도전 2판 하기',goal:2,reward:10,get:function(d){ return d.dailyPlays; }},
  {id:'best1',ic:'♛',name:'아무 게임에서 신기록 세우기',goal:1,reward:20,get:function(d){ return d.bests; }},
  {id:'new1',ic:'♡',name:'처음 보는 게임 해 보기',goal:1,reward:15,get:function(d){ return d.newGames; }}
];
var meta=null;
function loadMeta(){
  var m=null; try{ m=JSON.parse(store.get('arc_meta','null')); }catch(e){}
  m=m||{stars:0,xp:0,plays:0,bests:0,streak:0,lastDay:'',ever:[]};
  if(!m.ever) m.ever=[];
  var y=new Date(Date.now()+9*3600e3-86400e3).toISOString().slice(0,10).replace(/-/g,'');
  var fresh=m.lastDay!==today;
  if(fresh){ m.streak=m.lastDay===y?(m.streak||0)+1:1; m.lastDay=today; }
  if(!m.day||m.day.key!==today){
    var r=mulberry(seedFrom('missions-'+today)), pool=MISSIONS.slice(), picks=[];
    while(picks.length<3){ picks.push(pool.splice(Math.floor(r()*pool.length),1)[0].id); }
    m.day={key:today,plays:0,games:[],dailyPlays:0,bests:0,newGames:0,missions:picks,claimed:[]};
  }
  meta=m;
  if(fresh){ meta.stars+=2; meta.xp+=2; saveMeta(); setTimeout(function(){ toast('출석 보상 별사탕 +2 · 연속 '+meta.streak+'일'); },700); }
  else saveMeta();
}
function saveMeta(){ store.set('arc_meta',JSON.stringify(meta)); }
function levelOf(xp){ var lv=1, need=20; while(xp>=need){ xp-=need; lv++; need=20+lv*10; } return {lv:lv,cur:xp,need:need}; }
var TITLES=['새싹','솜사탕','젤리','별사탕','요정','별빛 요정','달빛 요정','은하수 요정'];
function titleOf(lv){ return TITLES[Math.min(TITLES.length-1,Math.floor((lv-1)/3))]; }
function missionDef(id){ for(var i=0;i<MISSIONS.length;i++) if(MISSIONS[i].id===id) return MISSIONS[i]; return null; }
function onRunEnd(id,daily,isBest){
  var d=meta.day, earned=1+(isBest?3:0);
  d.plays++; meta.plays++;
  if(d.games.indexOf(id)<0) d.games.push(id);
  if(daily) d.dailyPlays++;
  if(isBest){ d.bests++; meta.bests++; }
  if(meta.ever.indexOf(id)<0){ meta.ever.push(id); d.newGames++; }
  meta.stars+=earned; meta.xp+=earned;
  saveMeta();
  var ready=d.missions.filter(function(mid){ var m=missionDef(mid); return d.claimed.indexOf(mid)<0&&m.get(d)>=m.goal; }).length;
  return {earned:earned,ready:ready};
}
function claimMission(mid,mult){
  var d=meta.day, m=missionDef(mid), got=m?m.reward*(mult||1):0;
  if(!m||d.claimed.indexOf(mid)>=0||m.get(d)<m.goal) return;
  d.claimed.push(mid); meta.stars+=got; meta.xp+=got; saveMeta();
  ensureAudio(); pluck(84,0.14); pluck(88,0.13,0.08); pluck(91,0.14,0.16); haptic(12);
  toast((mult>1?'2배 보상! ':'미션 완료! ')+'별사탕 +'+got);
  renderMeta();
}
function toast(msg){
  var t=document.createElement('div'); t.className='toast'; t.setAttribute('role','status'); t.textContent=msg;
  document.body.append(t); setTimeout(function(){ t.remove(); },2700);
}
function renderMeta(){
  if(!meta) return;
  var L=levelOf(meta.xp), d=meta.day, title=titleOf(L.lv);
  $('lv-label').textContent='LV. '+L.lv+' 스타 버니';
  $('lv-tag').textContent=title;
  $('mascot-name').textContent='LV. '+L.lv+' 스타 버니 루루';
  $('fairy').textContent=title+' 등급';
  $('streak').textContent='연속 출석 '+meta.streak+'일';
  $('xp-num').textContent=L.cur+'/'+L.need;
  $('xp-bar').style.transform='scaleX('+(L.cur/L.need)+')';
  $('stars').textContent=fmt(meta.stars);
  var done=d.claimed.length;
  $('ms-num').textContent=done+'/3';
  $('ms-bar').style.transform='scaleX('+(done/3)+')';
  $('st-today').textContent=d.plays+'판';
  $('st-bests').textContent=meta.bests+'개';
  $('st-tried').textContent=meta.ever.length+'/'+A.games.length;
  $('stage-line').textContent=d.plays===0?'오늘도 반짝, 첫 판을 시작해 볼까요?':d.plays<3?'좋아요! 몸이 풀리고 있어요.':'오늘 벌써 '+d.plays+'판! 아케이드의 전설이 되는 중이에요.';
  var wrap=$('missions'); wrap.replaceChildren(); var readyCount=0;
  d.missions.forEach(function(mid){
    var m=missionDef(mid), cur=Math.min(m.goal,m.get(d)), claimed=d.claimed.indexOf(mid)>=0, ready=!claimed&&cur>=m.goal;
    if(ready) readyCount++;
    var row=document.createElement('div'); row.className='mission'+(claimed?' done':'');
    var ic=document.createElement('span'); ic.className='ic'; ic.textContent=m.ic; ic.setAttribute('aria-hidden','true');
    var mid2=document.createElement('div'); mid2.className='mid';
    var b=document.createElement('b'); b.textContent=m.name;
    var s=document.createElement('span'); s.textContent=cur+' / '+m.goal+' · 별사탕 '+m.reward;
    var bar=document.createElement('div'); bar.className='bar'; var bi=document.createElement('i'); bi.style.transform='scaleX('+(cur/m.goal)+')'; bar.append(bi);
    mid2.append(b,s,bar);
    var btn=document.createElement('button'); btn.type='button';
    btn.textContent=claimed?'완료':ready?'받기':'진행 중'; btn.disabled=!ready;
    btn.addEventListener('click',function(){ claimMission(mid); });
    row.append(ic,mid2);
    if(ready&&ads.available()){
      var b2=document.createElement('button'); b2.type='button'; b2.className='x2'; b2.textContent='▶ 2배';
      b2.setAttribute('aria-label','광고 보고 보상 2배로 받기');
      b2.addEventListener('click',function(){ b2.disabled=true; ads.show('mission').then(function(r){ if(r==='rewarded') claimMission(mid,2); else b2.disabled=false; }); });
      row.append(b2);
    }
    row.append(btn); wrap.append(row);
  });
  $('ms-dot').hidden=readyCount===0;
}

/* ---------- 허브 카드 ---------- */
var cards=[];
function pickToday(){ return A.games[seedFrom('pick-'+today)%A.games.length]; }
function buildHub(){
  var wrap=$('cards'); wrap.replaceChildren(); cards=[];
  A.games.forEach(function(g){
    var p=g.palette;
    var a=document.createElement('a'); a.className='card'; a.href='#'+g.id;
    a.style.setProperty('--c-bg',p.bg); a.style.setProperty('--c-accent',p.accent);
    a.style.setProperty('--c-deep',p.accentDeep||p.text); a.style.setProperty('--c-line',p.line);
    a.style.setProperty('--c-soft',p.surface2);
    var art=document.createElement('canvas'); art.className='card-art'; art.setAttribute('aria-hidden','true');
    var body=document.createElement('div'); body.className='card-body';
    var k=document.createElement('span'); k.className='card-kicker'; k.textContent=g.kicker;
    var h=document.createElement('h3'); h.textContent=g.title;
    var bl=document.createElement('p'); bl.className='card-blurb'; bl.textContent=g.blurb;
    var mrow=document.createElement('div'); mrow.className='card-meta';
    var lead=document.createElement('span'); var go=document.createElement('span'); go.className='go'; go.textContent='GO →';
    mrow.append(lead,go);
    body.append(k,h,bl,mrow);
    a.append(art,body);
    var nw=document.createElement('span'); nw.className='card-new'; nw.textContent='NEW'; a.append(nw);
    wrap.append(a);
    cards.push({g:g,el:a,art:art,ctx:art.getContext('2d'),lead:lead,nw:nw,w:0,h:0});
  });
  var rec=pickToday();
  $('cta').href='#'+rec.id;
  $('cta-title').textContent=rec.title;
  $('cta-sub').textContent='오늘의 추천 게임 · '+rec.kicker;
  $('games-count').textContent=A.games.length+' GAMES';
  renderCards();
}
function renderCards(){
  cards.forEach(function(c){
    var b=boards[c.g.id], top=b&&b.daily[0], m=myBest(c.g.id);
    c.lead.textContent=m>0?'내 최고 '+fmt(m):top?'1위 '+fmt(top.v):'첫 기록 도전!';
    c.nw.hidden=!!meta&&meta.ever.indexOf(c.g.id)>=0;
  });
  renderRanks();
  renderMeta();
}
function renderRanks(){
  var wrap=$('ranks'); if(!wrap) return; wrap.replaceChildren();
  var bestGap=null;
  A.games.forEach(function(g){
    var b=boards[g.id], list=b?b.daily:[], top=list[0], myIdx=-1;
    for(var i=0;i<list.length;i++){ if(list[i].id===cloud.uid){ myIdx=i; break; } }
    var a=document.createElement('a'); a.className='rk'; a.href='#'+g.id;
    var gi=document.createElement('span'); gi.className='gi'; gi.style.background=g.palette.accent; gi.textContent=g.title.slice(0,1); gi.setAttribute('aria-hidden','true');
    var nm=document.createElement('span'); nm.className='nm';
    var bn=document.createElement('b'); bn.textContent=top?top.name:'아직 1위가 없어요';
    var sn=document.createElement('span'); sn.textContent=g.title+(myIdx>=0?' · 나는 '+(myIdx+1)+'위':'');
    nm.append(bn,sn);
    var sc=document.createElement('span'); sc.className='sc'; sc.textContent=top?fmt(top.v):'-';
    if(myIdx>0){
      var gap=list[myIdx-1].v-list[myIdx].v+1, sm=document.createElement('small');
      sm.textContent='+'+fmt(gap)+'점이면 '+myIdx+'위'; sc.append(sm);
      if(!bestGap||gap<bestGap.gap) bestGap={gap:gap,title:g.title,rank:myIdx};
    }
    a.append(gi,nm,sc); wrap.append(a);
  });
  var tip=document.createElement('p'); tip.className='tip';
  if(bestGap){ tip.append(bestGap.title+'에서 '); var tb=document.createElement('b'); tb.textContent=fmt(bestGap.gap)+'점'; tip.append(tb,'만 더 모으면 '+bestGap.rank+'위!'); }
  else tip.textContent=cloudReady()?'오늘의 도전 기록이 랭킹에 바로 올라가요.':'랭킹에 연결되면 오늘의 1위가 여기에 나와요.';
  wrap.append(tip);
  var on=$('online'); if(on) on.hidden=!cloudReady();
}
function sizeCards(){
  var dpr=Math.min(window.devicePixelRatio||1,2);
  cards.forEach(function(c){
    var r=c.art.getBoundingClientRect();
    if(r.width<1) return;
    c.w=r.width; c.h=r.height;
    c.art.width=Math.round(r.width*dpr); c.art.height=Math.round(r.height*dpr);
    c.ctx.setTransform(dpr,0,0,dpr,0,0);
  });
}

/* ---------- 루프 ---------- */
var hubT=0, hubAcc=0;
function frame(now){
  var dt=Math.min(0.033,(now-lastNow)/1000); lastNow=now;
  if(view==='game'&&cur){
    if(canvas.width<=1) resize();
    if(!paused){
      if(fx.stop>0){ fx.stop-=dt; }
      else { api.t+=dt; cur.update(dt,api); fx.update(dt); }
      if(api.state==='dying'&&now>=dieAt) afterDie();
    }
    var sh=fx.shakeA, z=1+fx.pulseA*0.02;
    ctx.setTransform(scale,0,0,scale,0,0);
    ctx.save();
    ctx.translate(W/2+(Math.random()-.5)*sh*2,H/2+(Math.random()-.5)*sh*2);
    ctx.scale(z,z); ctx.translate(-W/2,-H/2);
    cur.draw(ctx,api);
    fx.draw(ctx);
    ctx.restore();
    if(fx.flashA>0.01){ ctx.fillStyle='rgba('+fx.flashC+','+(fx.flashA*0.3)+')'; ctx.fillRect(0,0,W,H); }
  } else if(view==='hub'){
    hubT+=dt; hubAcc+=dt;
    if(hubAcc>=1/40){
      hubAcc=0;
      for(var i=0;i<cards.length;i++){
        var c=cards[i]; if(!c.w) continue;
        var r=c.el.getBoundingClientRect();
        if(r.bottom<0||r.top>window.innerHeight) continue;
        c.ctx.save(); c.g.preview(c.ctx,c.w,c.h,hubT+i*3.7); c.ctx.restore();
      }
    }
  }
  requestAnimationFrame(frame);
}

/* ---------- 입력 ---------- */
function toLocal(e){ var r=canvas.getBoundingClientRect(); return {x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H}; }
function bindInput(){
  canvas.addEventListener('pointerdown',function(e){
    e.preventDefault(); ensureAudio();
    if(paused||!cur) return;
    if(api.state==='play'){
      try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
      api.pointerDown=true; var p=toLocal(e); cur.pointer('down',p.x,p.y,api);
    } else if(api.state==='menu'||(api.state==='over'&&performance.now()>restartAt)) startRun();
  });
  canvas.addEventListener('pointermove',function(e){
    if(paused||!cur||api.state!=='play') return;
    var p=toLocal(e); cur.pointer('move',p.x,p.y,api);
  });
  function up(e){
    if(!cur||api.state!=='play'){ api.pointerDown=false; return; }
    api.pointerDown=false; var p=toLocal(e); cur.pointer('up',p.x,p.y,api);
  }
  canvas.addEventListener('pointerup',up);
  canvas.addEventListener('pointercancel',up);
  window.addEventListener('keydown',function(e){
    if(view!=='game'||!cur) return;
    if(e.target&&e.target.tagName==='INPUT') return;
    if(e.key==='Escape'){ if(!$('board').hidden) closeBoard(); else if(api.state!=='play') location.hash=''; return; }
    if(paused) return;
    if(api.state==='play'){ if(cur.key&&cur.key('down',e.code,api)) e.preventDefault(); return; }
    if((e.code==='Space'||e.key==='Enter')&&!(e.target&&e.target.tagName==='BUTTON')){
      if(api.state==='menu'||(api.state==='over'&&performance.now()>restartAt)){ e.preventDefault(); startRun(); }
    }
  });
  window.addEventListener('keyup',function(e){
    if(view!=='game'||!cur||api.state!=='play'||paused) return;
    if(cur.key&&cur.key('up',e.code,api)) e.preventDefault();
  });
}

function routeHash(){
  var id=(location.hash||'').replace('#','');
  var g=A.byId[id];
  if(g){ if(cur!==g) openGame(g); }
  else if(view!=='hub') closeGame();
}

/* ---------- 시작 ---------- */
A.boot=function(){
  stage=$('stage'); canvas=$('c'); ctx=canvas.getContext('2d');
  loadMeta();
  initCloud();
  buildHub();
  $('nick').value=nick;
  $('nick').addEventListener('change',function(){
    nick=getName(); $('nick').value=nick; store.set('arc_nick',nick);
    A.games.forEach(function(g){
      var b=boards[g.id];
      if(cloudWritable()&&b.mine&&b.mine.name!==nick&&!b.writing){
        b.writing=true;
        cloud.db.doc(g.id+'/'+cloud.uid).update({name:nick}).then(function(){ b.writing=false; },function(){ b.writing=false; });
      }
    });
  });
  $('mode-daily').addEventListener('click',function(){ setMode('daily'); });
  $('mode-free').addEventListener('click',function(){ setMode('free'); });
  $('start').addEventListener('click',startRun);
  $('rv-watch').addEventListener('click',watchRevive);
  $('rv-skip').addEventListener('click',skipRevive);
  $('dbl').addEventListener('click',function(){
    var b=$('dbl'), n=Number(b.dataset.n)||0; b.disabled=true;
    ads.show('double').then(function(r){
      if(r==='rewarded'&&n>0){ meta.stars+=n; meta.xp+=n; saveMeta(); b.hidden=true; $('reward').textContent='별사탕 +'+(n*2)+' (2배!)'; pluck(84,0.14); pluck(91,0.14,0.1); toast('별사탕 2배! +'+n+' 더'); }
      else b.disabled=false;
    });
  });
  ads.warm();
  $('again').addEventListener('click',startRun);
  $('to-board').addEventListener('click',function(){ boardTab=api.daily?'daily':'all'; openBoard(); });
  $('btn-board').addEventListener('click',openBoard);
  $('board-close').addEventListener('click',closeBoard);
  $('tab-daily').addEventListener('click',function(){ boardTab='daily'; renderBoard(); });
  $('tab-all').addEventListener('click',function(){ boardTab='all'; renderBoard(); });
  $('btn-back').addEventListener('click',function(){ location.hash=''; });
  $('to-menu').addEventListener('click',function(){
    $('over').hidden=true; $('menu').hidden=false;
    setState('menu'); cur.start(api); updateMenuInfo(); renderRival(false);
  });
  function syncSound(){ $('btn-sound').classList.toggle('muted',au.muted); $('hub-sound').classList.toggle('muted',au.muted); }
  function toggleSound(){
    au.muted=!au.muted; store.set('arc_mute',au.muted?'1':'0'); syncSound(); ensureAudio();
    if(!au.muted) pluck(76,0.14);
  }
  $('btn-sound').addEventListener('click',toggleSound);
  $('hub-sound').addEventListener('click',toggleSound);
  var dockBtns=document.querySelectorAll('.dock button');
  Array.prototype.forEach.call(dockBtns,function(btn){
    btn.addEventListener('click',function(){
      var go=btn.dataset.go, hub=$('hub');
      Array.prototype.forEach.call(dockBtns,function(x){ x.setAttribute('aria-current',String(x===btn)); });
      hub.scrollTo({top:go==='top'?0:Math.max(0,$(go).offsetTop-70),behavior:'smooth'});
    });
  });
  syncSound();
  bindInput();
  window.addEventListener('resize',resize);
  window.addEventListener('hashchange',routeHash);
  document.addEventListener('visibilitychange',function(){ lastNow=performance.now(); });
  try{ document.fonts.load('24px "Jua"'); }catch(e){}
  routeHash();
  requestAnimationFrame(function(){ sizeCards(); });
  lastNow=performance.now();
  requestAnimationFrame(frame);
};
})();

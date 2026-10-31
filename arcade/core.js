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
var fx={parts:[],shardList:[],rings:[],texts:[],shakeA:0,flashA:0,flashC:'255,240,220',stop:0,pulseA:0,additive:true,font:'"Hahmlet","Noto Serif KR",serif'};
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
    ctx.font=tx.weight+' '+Math.round(tx.size*sc)+'px '+fx.font;
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
  $('menu').hidden=false; $('over').hidden=true; $('board').hidden=true; paused=false;
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
  stage.hidden=true; $('hub').hidden=false; paused=false;
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
  fx.reset(); api.t=0; api.pointerDown=false;
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

/* ---------- 허브 카드 ---------- */
var cards=[];
function buildHub(){
  var wrap=$('cards'); wrap.replaceChildren(); cards=[];
  A.games.forEach(function(g,i){
    var p=g.palette;
    var a=document.createElement('a'); a.className='card'; a.href='#'+g.id;
    a.style.setProperty('--c-bg',p.bg); a.style.setProperty('--c-surface',p.surface);
    a.style.setProperty('--c-text',p.text); a.style.setProperty('--c-muted',p.muted); a.style.setProperty('--c-accent',p.accent);
    if(p.light) a.classList.add('light');
    var art=document.createElement('canvas'); art.className='card-art'; art.setAttribute('aria-hidden','true');
    var no=document.createElement('span'); no.className='card-no'; no.textContent='No.'+String(i+1).padStart(2,'0');
    var body=document.createElement('div'); body.className='card-body';
    var k=document.createElement('span'); k.className='card-kicker'; k.textContent=g.kicker;
    var h=document.createElement('h3'); h.textContent=g.title;
    var bl=document.createElement('p'); bl.className='card-blurb'; bl.textContent=g.blurb;
    var meta=document.createElement('div'); meta.className='card-meta';
    var lead=document.createElement('span'); var mine=document.createElement('span'); mine.className='mine';
    meta.append(lead,mine);
    var play=document.createElement('span'); play.className='card-play'; play.textContent='플레이';
    body.append(k,h,bl,meta);
    a.append(art,no,play,body);
    wrap.append(a);
    cards.push({g:g,el:a,art:art,ctx:art.getContext('2d'),lead:lead,mine:mine,w:0,h:0});
  });
  renderCards();
}
function renderCards(){
  cards.forEach(function(c){
    var b=boards[c.g.id], top=b&&b.daily[0];
    c.lead.replaceChildren();
    if(top){ var n=document.createElement('b'); n.textContent=top.name; c.lead.append('오늘 1위 ',n,' '+fmt(top.v)); }
    else c.lead.textContent=cloudReady()?'오늘 1위 자리가 비어 있어요':'오늘의 도전 · 매일 새 패턴';
    var m=b?myBest(c.g.id):localBest(c.g.id);
    c.mine.textContent=m>0?'내 최고 '+fmt(m):'';
  });
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
function grain(){
  try{
    var c=document.createElement('canvas'); c.width=c.height=160;
    var g=c.getContext('2d'), d=g.createImageData(160,160);
    for(var i=0;i<d.data.length;i+=4){ var v=Math.random()*255|0; d.data[i]=d.data[i+1]=d.data[i+2]=v; d.data[i+3]=14; }
    g.putImageData(d,0,0);
    document.documentElement.style.setProperty('--grain','url('+c.toDataURL()+')');
  }catch(e){}
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
      if(api.state==='dying'&&now>=dieAt) showOver();
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
  grain();
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
  function syncSound(){ $('btn-sound').classList.toggle('muted',au.muted); }
  $('btn-sound').addEventListener('click',function(){
    au.muted=!au.muted; store.set('arc_mute',au.muted?'1':'0'); syncSound(); ensureAudio();
    if(!au.muted) pluck(76,0.14);
  });
  syncSound();
  var d=$('hub-date'); if(d) d.textContent=today.slice(0,4)+'. '+today.slice(4,6)+'. '+today.slice(6);
  bindInput();
  window.addEventListener('resize',resize);
  window.addEventListener('hashchange',routeHash);
  document.addEventListener('visibilitychange',function(){ lastNow=performance.now(); });
  try{ document.fonts.load('700 24px "Hahmlet"'); document.fonts.load('600 24px "Unbounded"'); }catch(e){}
  routeHash();
  requestAnimationFrame(function(){ sizeCards(); });
  lastNow=performance.now();
  requestAnimationFrame(frame);
};
})();

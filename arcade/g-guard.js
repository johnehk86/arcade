/* 별빛 수호대: 가운데서 잠든 루루를 지키는 360도 방어 슈팅. 손가락 쪽으로 별 지팡이가 자동 사격한다.
   시간이 지날수록 적이 빨라지고 단단해지며, 잔잔한 4초와 몰아치는 10초가 번갈아 온다. 60초마다 보스. */
(function(){
'use strict';
var U=Arcade.util, clamp=U.clamp, lerp=U.lerp;
var W=360, SHIELD_MAX=5, FIRE=0.125, NOVA_NEED=40;
var PENTA=[72,74,76,79,81,84,86,88,91,93];
var S=null;

/* ---------- 적 정의 ---------- */
var TYPES={
  basic:{hp:1,r:13,sp:34,pts:20,col:'#c9b6ff',deep:'#8f78e0'},
  mini:{hp:1,r:9,sp:46,pts:10,col:'#d8cbff',deep:'#9a86e6'},
  chubby:{hp:4,r:21,sp:22,pts:50,col:'#b6a6e8',deep:'#7d68c8'},
  zig:{hp:2,r:12,sp:58,pts:40,col:'#ffb3cf',deep:'#e0729b'},
  shield:{hp:6,r:17,sp:28,pts:80,col:'#b9bfd6',deep:'#7b84a6'},
  boss:{hp:60,r:44,sp:12,pts:1000,col:'#a993e6',deep:'#6b55c4'}
};

function center(api){ return {x:W/2,y:120+(api.H-120)/2+6}; }
function stageOf(t){ return 1+Math.floor(t/30); }

function newState(api){
  var c=center(api);
  return {cx:c.x,cy:c.y,aim:-Math.PI/2,aimT:-Math.PI/2,fireT:0,enemies:[],bolts:[],drops:[],
    shield:SHIELD_MAX,shieldHit:0,time:0,spawnT:1.2,bossT:60,stage:1,combo:0,maxCombo:0,lastKill:-9,kills:0,
    nova:0,triple:0,freeze:0,lastTap:-9,holding:false,px:c.x,py:c.y-100,keyRot:0,keyFire:false,
    wake:0,dead:false,muzzle:0,zz:0,stars:makeStars()};
}
function makeStars(){ var a=[]; for(var i=0;i<46;i++) a.push({x:Math.random()*W,y:Math.random()*900,r:0.6+Math.random()*1.6,p:Math.random()*6.28}); return a; }

function rnd(api){ return api.state==='play'?api.rng():Math.random(); }

/* ---------- 생성 ---------- */
function spawnEnemy(api,kind,x,y){
  var T=TYPES[kind], st=S.stage, R=rnd;
  if(x==null){
    var side=Math.floor(R(api)*4), H=api.H;
    if(side===0){ x=R(api)*W; y=112; }
    else if(side===1){ x=W+24; y=130+R(api)*(H-150); }
    else if(side===2){ x=R(api)*W; y=H+24; }
    else { x=-24; y=130+R(api)*(H-150); }
  }
  var hpScale=api.state==='play'?1+Math.max(0,st-2)*0.25:1;
  var spScale=api.state==='play'?1+Math.min(1.2,S.time/150):1;
  var hp=kind==='boss'?Math.round(T.hp*(1+(st-1)*0.35)):Math.max(1,Math.round(T.hp*hpScale));
  S.enemies.push({kind:kind,x:x,y:y,vx:0,vy:0,hp:hp,max:hp,r:T.r,sp:T.sp*spScale,flash:0,kb:0,ph:R(api)*6.28,
    wob:R(api)*6.28,minionT:2.5,age:0});
}
function pickKind(api){
  var t=S.time, r=api.rng(), pool=[['basic',10]];
  if(t>15) pool.push(['chubby',3+Math.min(4,t/30)]);
  if(t>30) pool.push(['zig',3+Math.min(5,t/25)]);
  if(t>50) pool.push(['shield',2+Math.min(4,t/40)]);
  var sum=0, i; for(i=0;i<pool.length;i++) sum+=pool[i][1];
  r*=sum; for(i=0;i<pool.length;i++){ r-=pool[i][1]; if(r<=0) return pool[i][0]; }
  return 'basic';
}
/* 잔잔한 4초 → 몰아치는 10초 */
function intensity(){
  var cyc=S.time%14;
  if(S.time<15) return 0.55;
  return cyc<4?0.45:1+0.3*Math.sin((cyc-4)/10*Math.PI);
}
function spawnInterval(){ return Math.max(0.22,1.35-S.time*0.009)/intensity(); }

/* ---------- 사격 ---------- */
function fire(api){
  var sfx=api.sfx, n=S.triple>0?3:1;
  for(var k=0;k<n;k++){
    var a=S.aim+(n>1?(k-1)*0.16:0)+(rnd(api)-.5)*0.06;
    var ox=S.cx+Math.cos(S.aim)*30, oy=S.cy+Math.sin(S.aim)*30;
    S.bolts.push({x:ox,y:oy,vx:Math.cos(a)*560,vy:Math.sin(a)*560,life:1.2,gold:S.triple>0});
  }
  S.muzzle=1;
  if(api.state==='play') sfx.tone(1250,0.06,'triangle',0.035,{slide:780,wet:false});
}

/* ---------- 처치와 피해 ---------- */
function kill(api,e,byNova){
  var fx=api.fx, sfx=api.sfx, T=TYPES[e.kind], play=api.state==='play';
  e.dead=true;
  var big=e.kind==='boss'||e.kind==='chubby'||e.kind==='shield';
  fx.shards(e.x,e.y,big?18:8,T.col,big?220:150,big?7:4.5);
  fx.burst(e.x,e.y,big?30:12,e.kind==='zig'?'255,126,166':'172,151,254',big?230:150,{size:[5,14],life:0.7});
  fx.burst(e.x,e.y,big?12:5,'255,214,107',120,{size:[4,9],life:0.6});
  fx.ring(e.x,e.y,e.r*2.6,'172,151,254',0.45,2,0.6);
  if(e.kind==='chubby'){ for(var i=0;i<2;i++) spawnEnemy(api,'mini',e.x+(i?10:-10),e.y+(i?6:-6)); }
  if(!play) return;
  S.kills++;
  if(S.time-S.lastKill<=1) S.combo++; else S.combo=1;
  S.lastKill=S.time;
  if(S.combo>S.maxCombo) S.maxCombo=S.combo;
  var mult=Math.min(8,1+Math.floor(S.combo/4));
  var pts=T.pts*mult;
  api.addScore(pts);
  if(e.kind==='boss'){
    fx.text(e.x,e.y-20,'보스 정화! +'+pts,'#634eb0',28,1.6,{stroke:'rgba(255,255,255,.9)',rise:14});
    fx.flash(0.9,'255,240,250'); fx.hitstop(0.1); fx.shake(12); fx.pulse(1);
    for(var k=0;k<6;k++) fx.ring(e.x,e.y,W*0.8,'255,214,107',1.4,3,0.5,k*0.08);
    sfx.noise(1.2,0.3,{freq:900,slide:120});
    for(k=0;k<6;k++) sfx.pluck(PENTA[k+2],0.14,k*0.06);
    api.haptic(40);
  } else {
    if(big){ fx.hitstop(0.035); fx.shake(4); } else fx.shake(1.5);
    if(pts>=40||S.combo%5===0) fx.text(e.x,e.y-e.r-4,'+'+pts,'#a3365d',big?20:15,0.7,{stroke:'rgba(255,255,255,.9)'});
    sfx.pluck(PENTA[Math.min(PENTA.length-1,Math.floor(S.combo/2))],big?0.17:0.12);
    sfx.noise(big?0.22:0.1,big?0.12:0.05,{freq:big?1600:2400,slide:300});
    api.haptic(big?14:5);
  }
  if(S.combo>0&&S.combo%10===0) fx.text(W/2,S.cy-110,'연속 '+S.combo+'!','#ff5f92',24,1,{stroke:'rgba(255,255,255,.9)'});
  if(!byNova){
    var was=S.nova; S.nova=Math.min(NOVA_NEED,S.nova+(e.kind==='boss'?NOVA_NEED:big?3:1));
    if(was<NOVA_NEED&&S.nova>=NOVA_NEED){ fx.text(S.cx,S.cy+70,'별빛 폭발 준비 완료! 루루를 톡','#7b61e8',18,1.6,{stroke:'rgba(255,255,255,.9)',rise:10}); sfx.pluck(91,0.14); sfx.pluck(96,0.12,0.1); }
  }
  /* 아이템 */
  var dr=api.rng();
  if(e.kind==='boss'||dr<(big?0.22:0.05)){
    var r2=api.rng(), type=r2<0.4?'triple':r2<0.7?'heal':'freeze';
    S.drops.push({x:e.x,y:e.y,type:type,life:7,ph:0});
  }
  updateSub(api);
}
function updateSub(api){
  if(api.state!=='play') return;
  var mult=Math.min(8,1+Math.floor(S.combo/4));
  api.setSub(S.combo>=3?'연속 '+S.combo+(mult>1?' · ×'+mult:''):'');
}
function hurtShield(api,e){
  var fx=api.fx;
  e.dead=true;
  fx.shards(e.x,e.y,6,TYPES[e.kind].col,120,4);
  if(api.state!=='play'){ return; }
  var dmg=e.kind==='boss'?2:1;
  S.shield=Math.max(0,S.shield-dmg); S.shieldHit=1;
  api.setLives(S.shield,SHIELD_MAX);
  S.combo=0; updateSub(api);
  fx.ring(S.cx,S.cy,120,'255,126,166',0.6,4,0.8);
  fx.shake(9); fx.flash(0.5,'255,180,200');
  api.sfx.tone(140,0.35,'sine',0.25,{slide:70}); api.sfx.noise(0.25,0.15,{freq:500,slide:120});
  api.haptic(35);
  /* 주변 적을 밀어낸다 */
  for(var i=0;i<S.enemies.length;i++){
    var o=S.enemies[i], dx=o.x-S.cx, dy=o.y-S.cy, d=Math.hypot(dx,dy)||1;
    if(d<150){ o.kb=1; o.vx=dx/d*180; o.vy=dy/d*180; }
  }
  if(S.shield<=0){
    S.dead=true; S.wake=1;
    fx.text(S.cx,S.cy-60,'앗!','#a3365d',34,1.4,{stroke:'rgba(255,255,255,.95)',rise:10});
    fx.burst(S.cx,S.cy,40,'255,126,166',260,{size:[6,16]});
    api.sfx.pluck(72,0.16); api.sfx.pluck(67,0.14,0.2); api.sfx.pluck(60,0.15,0.45);
    api.setMeter(null); api.setSub('');
    api.end();
  }
}
function nova(api){
  var fx=api.fx, sfx=api.sfx;
  S.nova=0;
  fx.flash(1,'255,246,220'); fx.hitstop(0.08); fx.shake(14); fx.pulse(1);
  for(var k=0;k<5;k++) fx.ring(S.cx,S.cy,W*1.1,k%2?'255,214,107':'172,151,254',1.1,5-k*0.6,0.7,k*0.07);
  fx.burst(S.cx,S.cy,60,'255,214,107',420,{size:[6,18],life:1});
  fx.text(S.cx,S.cy-90,'별빛 폭발!','#7b61e8',34,1.4,{stroke:'rgba(255,255,255,.95)',rise:12});
  for(k=0;k<8;k++) sfx.pluck(PENTA[k],0.13,k*0.045);
  sfx.noise(1,0.22,{freq:400,slide:4000,type:'bandpass',q:0.7});
  api.haptic(50);
  for(var i=0;i<S.enemies.length;i++){
    var e=S.enemies[i]; if(e.dead) continue;
    if(e.kind==='boss'){ e.hp-=Math.ceil(e.max*0.4); e.flash=1; if(e.hp<=0) kill(api,e,true); }
    else kill(api,e,true);
  }
}

/* ---------- 그리기 도구 ---------- */
function drawSky(ctx,w,h,t,stars,dim){
  var g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#b9a6f5'); g.addColorStop(0.5,'#e9c6ef'); g.addColorStop(1,'#ffd3e2');
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  for(var i=0;i<stars.length;i++){
    var s=stars[i], y=s.y%h;
    ctx.globalAlpha=(0.35+0.45*(0.5+0.5*Math.sin(t*1.6+s.p)))*(dim||1);
    ctx.fillStyle='#fff';
    if(s.r>1.6) star4(ctx,s.x%w,y,s.r*2.2); else { ctx.beginPath(); ctx.arc(s.x%w,y,s.r,0,6.283); ctx.fill(); }
  }
  ctx.globalAlpha=1;
}
function star4(ctx,x,y,r){
  ctx.beginPath(); ctx.moveTo(x,y-r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.quadraticCurveTo(x,y,x,y+r);
  ctx.quadraticCurveTo(x,y,x-r,y); ctx.quadraticCurveTo(x,y,x,y-r); ctx.fill();
}
function star5(ctx,x,y,r,rot){
  ctx.beginPath();
  for(var i=0;i<10;i++){ var a=rot-Math.PI/2+i*Math.PI/5, rr=i%2?r*0.45:r; ctx.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr); }
  ctx.closePath(); ctx.fill();
}
function cloudBlob(ctx,x,y,r,col){
  ctx.fillStyle=col; ctx.beginPath();
  ctx.arc(x-r*0.55,y+r*0.1,r*0.55,0,6.283); ctx.arc(x+r*0.55,y+r*0.1,r*0.55,0,6.283);
  ctx.arc(x,y-r*0.2,r*0.7,0,6.283); ctx.arc(x,y+r*0.25,r*0.6,0,6.283); ctx.fill();
}
function drawLulu(ctx,x,y,s,t,wake){
  /* 구름 베개 */
  ctx.fillStyle='rgba(163,54,93,.12)'; ctx.beginPath(); ctx.ellipse(x,y+34*s,46*s,9*s,0,0,6.283); ctx.fill();
  cloudBlob(ctx,x,y+24*s,34*s,'#ffffff');
  var br=1+Math.sin(t*1.8)*0.03*(wake?0:1);
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s*br);
  /* 귀 */
  ctx.fillStyle='#fff'; ctx.strokeStyle='#ffc3d6'; ctx.lineWidth=2;
  [[-11,-0.35],[11,0.4]].forEach(function(e){
    ctx.save(); ctx.translate(e[0],-14); ctx.rotate(e[1]+(wake?0:Math.sin(t*1.3+e[0])*0.05));
    ctx.beginPath(); ctx.ellipse(0,-14,7,18,0,0,6.283); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#ffb1c5'; ctx.beginPath(); ctx.ellipse(0,-13,3.2,12,0,0,6.283); ctx.fill(); ctx.fillStyle='#fff';
    ctx.restore();
  });
  ctx.beginPath(); ctx.ellipse(0,4,24,21,0,0,6.283); ctx.fillStyle='#fff'; ctx.fill(); ctx.stroke();
  /* 헤드셋 */
  ctx.strokeStyle='#ac97fe'; ctx.lineWidth=3.4; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(0,4,22,Math.PI*1.08,Math.PI*1.92); ctx.stroke();
  ctx.fillStyle='#ac97fe'; ctx.beginPath(); ctx.arc(-21,0,4.6,0,6.283); ctx.arc(21,0,4.6,0,6.283); ctx.fill();
  ctx.fillStyle='#ffd66b'; star5(ctx,21,-7,5.5,0);
  /* 얼굴 */
  ctx.strokeStyle='#3f001b'; ctx.lineWidth=2;
  if(wake){
    ctx.fillStyle='#3f001b'; ctx.beginPath(); ctx.arc(-8,5,3.2,0,6.283); ctx.arc(8,5,3.2,0,6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(0,14,3,0,6.283); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(-8,4,3.4,0.15,Math.PI-0.15); ctx.stroke();
    ctx.beginPath(); ctx.arc(8,4,3.4,0.15,Math.PI-0.15); ctx.stroke();
    ctx.strokeStyle='#a3365d'; ctx.beginPath(); ctx.arc(0,12,2.6,0.2,Math.PI-0.2); ctx.stroke();
  }
  ctx.fillStyle='rgba(255,177,197,.85)'; ctx.beginPath(); ctx.ellipse(-14,11,4.5,2.8,0,0,6.283); ctx.ellipse(14,11,4.5,2.8,0,0,6.283); ctx.fill();
  ctx.restore();
  if(!wake){
    ctx.fillStyle='#7b61e8'; ctx.textAlign='center'; ctx.textBaseline='middle';
    for(var i=0;i<2;i++){
      var q=(t*0.5+i*0.5)%1;
      ctx.globalAlpha=Math.sin(q*Math.PI)*0.8;
      ctx.font=Math.round((11+i*3)*s)+'px "Jua",sans-serif';
      ctx.fillText('z',x+(20+q*14+i*4)*s,y-(28+q*26)*s);
    }
    ctx.globalAlpha=1;
  }
}
function drawWand(ctx,x,y,a,s,muz){
  ctx.save(); ctx.translate(x,y); ctx.rotate(a);
  ctx.strokeStyle='#ffffff'; ctx.lineWidth=5*s; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(40*s,0); ctx.lineTo(58*s,0); ctx.stroke();
  ctx.strokeStyle='#ff9bb7'; ctx.lineWidth=2.4*s;
  ctx.beginPath(); ctx.moveTo(41*s,0); ctx.lineTo(57*s,0); ctx.stroke();
  ctx.fillStyle='#ffd66b'; ctx.strokeStyle='#fff'; ctx.lineWidth=2*s;
  ctx.beginPath();
  for(var i=0;i<10;i++){ var aa=-Math.PI/2+i*Math.PI/5, rr=i%2?4.4*s:10*s; ctx.lineTo(64*s+Math.cos(aa)*rr,Math.sin(aa)*rr); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if(muz>0.05){
    ctx.globalAlpha=muz; ctx.fillStyle='#fff';
    star4(ctx,76*s,0,9*s*muz+3*s); ctx.globalAlpha=1;
  }
  ctx.restore();
}
function drawEnemy(ctx,e,t){
  var T=TYPES[e.kind], r=e.r, x=e.x, y=e.y+Math.sin(t*3+e.wob)*1.5;
  ctx.fillStyle='rgba(99,78,176,.14)'; ctx.beginPath(); ctx.ellipse(x+2,y+r*0.9,r*0.9,r*0.28,0,0,6.283); ctx.fill();
  var col=e.flash>0?'#ffffff':T.col;
  if(e.kind==='zig'){
    /* 찡그린 번개 젤리 */
    ctx.fillStyle=col; ctx.beginPath(); ctx.ellipse(x,y,r*1.05,r,0,0,6.283); ctx.fill();
    ctx.fillStyle='#ffd66b'; ctx.beginPath(); ctx.moveTo(x+r*0.2,y-r*1.5); ctx.lineTo(x-r*0.25,y-r*0.7); ctx.lineTo(x+r*0.1,y-r*0.7); ctx.lineTo(x-r*0.2,y-r*0.05); ctx.lineTo(x+r*0.45,y-r*0.95); ctx.lineTo(x+r*0.05,y-r*0.95); ctx.closePath(); ctx.fill();
  } else if(e.kind==='shield'){
    ctx.fillStyle=col; ctx.beginPath(); ctx.ellipse(x,y,r,r*0.92,0,0,6.283); ctx.fill();
    ctx.strokeStyle=e.flash>0?'#fff':'#ffffff'; ctx.lineWidth=3; ctx.globalAlpha=0.5+0.5*(e.hp/e.max);
    ctx.beginPath(); ctx.arc(x,y,r+4,0,6.283); ctx.stroke(); ctx.globalAlpha=1;
  } else {
    /* 마시멜로 구름 */
    cloudBlob(ctx,x,y,r,col);
  }
  /* 얼굴: 화난 눈썹, 점 눈 */
  var fs=r/13;
  ctx.strokeStyle=T.deep; ctx.lineWidth=Math.max(1.4,1.8*fs); ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(x-6*fs,y-4.5*fs); ctx.lineTo(x-2*fs,y-2.5*fs); ctx.moveTo(x+6*fs,y-4.5*fs); ctx.lineTo(x+2*fs,y-2.5*fs); ctx.stroke();
  ctx.fillStyle=T.deep; ctx.beginPath(); ctx.arc(x-4*fs,y+0.5*fs,1.7*fs,0,6.283); ctx.arc(x+4*fs,y+0.5*fs,1.7*fs,0,6.283); ctx.fill();
  ctx.beginPath(); ctx.arc(x,y+6*fs,2.4*fs,Math.PI+0.3,-0.3); ctx.stroke();
  ctx.fillStyle='rgba(255,177,197,.7)'; ctx.beginPath(); ctx.ellipse(x-7.5*fs,y+3.5*fs,2.2*fs,1.3*fs,0,0,6.283); ctx.ellipse(x+7.5*fs,y+3.5*fs,2.2*fs,1.3*fs,0,0,6.283); ctx.fill();
  if(e.kind==='boss'||e.max>2&&e.hp<e.max){
    var bw=e.kind==='boss'?r*2.2:r*1.6, by=y-r-(e.kind==='boss'?16:9);
    ctx.fillStyle='rgba(255,255,255,.85)'; roundRect(ctx,x-bw/2,by,bw,e.kind==='boss'?7:4,4); ctx.fill();
    ctx.fillStyle=e.kind==='boss'?'#ff5f92':'#7b61e8'; roundRect(ctx,x-bw/2,by,bw*clamp(e.hp/e.max,0,1),e.kind==='boss'?7:4,4); ctx.fill();
  }
}
function roundRect(ctx,x,y,w,h,r){
  r=Math.min(r,h/2,w/2); ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function drawDrop(ctx,d,t){
  var y=d.y+Math.sin(t*4+d.x)*3, a=d.life<1.5?(Math.sin(t*20)>0?1:0.3):1;
  ctx.globalAlpha=a;
  ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(d.x,y,12,0,6.283); ctx.fill();
  ctx.strokeStyle=d.type==='heal'?'#ff5f92':d.type==='freeze'?'#3d9be9':'#e0a100'; ctx.lineWidth=2.5; ctx.stroke();
  ctx.fillStyle=ctx.strokeStyle;
  if(d.type==='heal'){ ctx.beginPath(); ctx.moveTo(d.x,y+5); ctx.bezierCurveTo(d.x-9,y-2,d.x-4,y-9,d.x,y-4); ctx.bezierCurveTo(d.x+4,y-9,d.x+9,y-2,d.x,y+5); ctx.fill(); }
  else if(d.type==='freeze'){ ctx.lineWidth=2; for(var k=0;k<3;k++){ var aa=k*Math.PI/3; ctx.beginPath(); ctx.moveTo(d.x-Math.cos(aa)*7,y-Math.sin(aa)*7); ctx.lineTo(d.x+Math.cos(aa)*7,y+Math.sin(aa)*7); ctx.stroke(); } }
  else { star5(ctx,d.x-4,y+1,4.5,0); star5(ctx,d.x+4,y+1,4.5,0); star5(ctx,d.x,y-4,4.5,0); }
  ctx.globalAlpha=1;
}

/* ---------- 미리보기 상태 ---------- */
var PV={en:[],bo:[],t:0,ft:0};
function pvSpawn(w,h){ var a=Math.random()*6.283, d=Math.max(w,h)*0.62; PV.en.push({x:w/2+Math.cos(a)*d,y:h/2+Math.sin(a)*d,kind:Math.random()<0.25?'chubby':'basic',r:0,wob:Math.random()*6,hp:1,max:1,flash:0}); }

Arcade.register({
  id:'guard',
  title:'별빛 수호대',
  kicker:'360° 슈팅 · 수호',
  blurb:'잠든 루루를 지켜요! 악몽 마시멜로를 사방에서 톡톡',
  lede:'루루가 꿈나라에 갔어요. 사방에서 몰려오는 심술 마시멜로를 별 지팡이로 물리쳐 주세요. 시간이 갈수록 악몽이 더 세지고, 60초마다 보스가 와요.',
  how:'화면을 누르고 있으면 그쪽으로 자동 사격 · 별빛 게이지가 차면 루루를 톡(또는 두 번 탭) · 방향키+스페이스도 돼요',
  lifeIcon:'shield',
  endDelay:1400,
  palette:{bg:'#f1e8ff',surface:'#ffffff',surface2:'#f3ecff',line:'#ddd0ff',text:'#21172b',muted:'#887176',
    accent:'#7b61e8',accentInk:'#ffffff',accentDeep:'#5a43c2',hot:'#ff5f92',hotText:'#ff5f92',hotRgb:'255,126,166'},

  start:function(api){
    S=newState(api);
    if(api.state==='play'){
      api.setLives(SHIELD_MAX,SHIELD_MAX); api.setSub(''); api.setMeter(0,'별빛 폭발 준비 0%',false);
      api.fx.text(W/2,S.cy-100,'단계 1 · 루루를 지켜요!','#7b61e8',20,1.6,{stroke:'rgba(255,255,255,.9)',rise:10});
    } else {
      for(var i=0;i<5;i++) spawnEnemy(api,'basic');
    }
  },

  update:function(dt,api){
    var play=api.state==='play', fx=api.fx, i, e;
    var c=center(api); S.cx=c.x; S.cy=c.y;
    if(play||api.state==='dying') S.time+=play?dt:0;
    S.muzzle=Math.max(0,S.muzzle-dt*8); S.shieldHit=Math.max(0,S.shieldHit-dt*2.5);
    if(S.triple>0) S.triple-=dt; if(S.freeze>0) S.freeze-=dt;
    if(S.combo>0&&S.time-S.lastKill>1.2&&play){ S.combo=0; updateSub(api); }

    /* 조준과 사격 */
    var firing=false;
    if(play&&!S.dead){
      if(S.holding){ S.aimT=Math.atan2(S.py-S.cy,S.px-S.cx); firing=true; }
      if(S.keyRot){ S.aimT+=S.keyRot*3.2*dt; }
      if(S.keyFire) firing=true;
    } else if(api.state==='menu'||api.state==='over'){
      var tgt=null, bd=1e9;
      for(i=0;i<S.enemies.length;i++){ e=S.enemies[i]; var dd=Math.hypot(e.x-S.cx,e.y-S.cy); if(dd<bd){ bd=dd; tgt=e; } }
      if(tgt&&bd<260){ S.aimT=Math.atan2(tgt.y-S.cy,tgt.x-S.cx); firing=true; }
    }
    var da=((S.aimT-S.aim+Math.PI*3)%(Math.PI*2))-Math.PI;
    S.aim+=da*Math.min(1,dt*18);
    S.fireT-=dt;
    if(firing&&S.fireT<=0){ S.fireT=FIRE*(S.triple>0?0.9:1); fire(api); }

    /* 생성 */
    if(play){
      var st=stageOf(S.time);
      if(st>S.stage){
        S.stage=st;
        fx.text(W/2,S.cy-120,'단계 '+st+' · 악몽이 몰려와요!','#a3365d',22,1.8,{stroke:'rgba(255,255,255,.95)',rise:10});
        fx.ring(S.cx,S.cy,W*0.7,'255,126,166',1.2,3,0.5);
        api.sfx.pluck(79,0.12); api.sfx.pluck(84,0.12,0.12);
      }
      S.spawnT-=dt;
      if(S.spawnT<=0){
        S.spawnT=spawnInterval();
        var n=1+(S.time>40&&api.rng()<0.3?1:0)+(S.time>90&&api.rng()<0.25?1:0);
        for(i=0;i<n;i++) spawnEnemy(api,pickKind(api));
      }
      S.bossT-=dt;
      if(S.bossT<=0){
        S.bossT=60; spawnEnemy(api,'boss');
        fx.text(W/2,S.cy-120,'보스 악몽 등장!','#634eb0',26,2,{stroke:'rgba(255,255,255,.95)',rise:8});
        fx.flash(0.4,'210,190,255'); api.sfx.tone(110,0.9,'sawtooth',0.08,{slide:70}); api.sfx.noise(0.9,0.12,{freq:300,slide:120});
      }
    } else if(api.state==='menu'||api.state==='over'){
      S.spawnT-=dt;
      if(S.spawnT<=0){ S.spawnT=1.1; if(S.enemies.length<8) spawnEnemy(api,Math.random()<0.25?'chubby':'basic'); }
    }

    /* 적 이동 */
    var slow=S.freeze>0?0.35:1;
    for(i=0;i<S.enemies.length;i++){
      e=S.enemies[i]; if(e.dead) continue;
      e.age+=dt; e.flash=Math.max(0,e.flash-dt*7);
      var dx=S.cx-e.x, dy=S.cy-e.y, d=Math.hypot(dx,dy)||1, ux=dx/d, uy=dy/d;
      var sp=e.sp*slow;
      if(e.kind==='zig'){ var side=Math.sin(e.age*4+e.ph)*0.9; ux+=-uy*side; uy+=dx/d*side; }
      if(e.kb>0){ e.kb=Math.max(0,e.kb-dt*3); e.x+=e.vx*dt*e.kb; e.y+=e.vy*dt*e.kb; }
      else { e.x+=ux*sp*dt; e.y+=uy*sp*dt; }
      if(e.kind==='boss'&&play){
        e.minionT-=dt;
        if(e.minionT<=0){ e.minionT=Math.max(1.4,3-S.stage*0.2); spawnEnemy(api,'mini',e.x+(api.rng()-.5)*40,e.y+(api.rng()-.5)*40); }
      }
      if(d<44+e.r*0.6){
        if(play) hurtShield(api,e);
        else { e.dead=true; fx.shards(e.x,e.y,5,TYPES[e.kind].col,90,3.5); }
        if(S.dead) break;
      }
    }

    /* 별 탄 */
    for(i=S.bolts.length-1;i>=0;i--){
      var b=S.bolts[i]; b.life-=dt; b.x+=b.vx*dt; b.y+=b.vy*dt;
      if(b.life<=0||b.x<-30||b.x>W+30||b.y<60||b.y>api.H+30){ S.bolts.splice(i,1); continue; }
      for(var j=0;j<S.enemies.length;j++){
        e=S.enemies[j]; if(e.dead) continue;
        if(Math.hypot(e.x-b.x,e.y-b.y)<e.r+5){
          e.hp-=1; e.flash=1;
          var kk=e.kind==='boss'?0.05:e.kind==='chubby'?0.15:0.3;
          e.kb=Math.max(e.kb,kk); var bl=Math.hypot(b.vx,b.vy)||1; e.vx=b.vx/bl*160; e.vy=b.vy/bl*160;
          fx.burst(b.x,b.y,3,'255,255,255',70,{size:[3,7],life:0.25});
          if(play) api.sfx.tone(e.kind==='shield'?1700:900+Math.random()*200,0.04,'square',0.02,{wet:false});
          if(e.hp<=0) kill(api,e,false);
          S.bolts.splice(i,1); break;
        }
      }
    }
    S.enemies=S.enemies.filter(function(x){ return !x.dead; });
    if(S.enemies.length>90) S.enemies.splice(0,S.enemies.length-90);

    /* 아이템 */
    for(i=S.drops.length-1;i>=0;i--){
      var dr=S.drops[i]; dr.life-=dt;
      var tx=S.cx-dr.x, ty=S.cy-dr.y, dl=Math.hypot(tx,ty)||1;
      dr.x+=tx/dl*40*dt; dr.y+=ty/dl*40*dt;
      if(dl<40&&play){
        if(dr.type==='heal'){ S.shield=Math.min(SHIELD_MAX,S.shield+1); api.setLives(S.shield,SHIELD_MAX); fx.text(S.cx,S.cy-60,'방패 +1','#ff5f92',18,1,{stroke:'rgba(255,255,255,.9)'}); }
        else if(dr.type==='freeze'){ S.freeze=4; fx.text(S.cx,S.cy-60,'꽁꽁!','#3d9be9',20,1,{stroke:'rgba(255,255,255,.9)'}); fx.flash(0.35,'200,230,255'); }
        else { S.triple=6; fx.text(S.cx,S.cy-60,'세 갈래 별!','#e0a100',20,1,{stroke:'rgba(255,255,255,.9)'}); }
        api.sfx.pluck(84,0.14); api.sfx.pluck(91,0.12,0.08); api.haptic(10);
        fx.ring(S.cx,S.cy,70,'255,214,107',0.5,3,0.7);
        S.drops.splice(i,1); continue;
      }
      if(dr.life<=0) S.drops.splice(i,1);
    }

    if(play&&!S.dead){
      var full=S.nova>=NOVA_NEED;
      api.setMeter(S.nova/NOVA_NEED,full?'별빛 폭발 준비 완료! 루루를 톡':'별빛 폭발 준비 '+Math.floor(S.nova/NOVA_NEED*100)+'%',full);
    }
    for(i=0;i<S.stars.length;i++) S.stars[i].y+=dt*4;
  },

  draw:function(ctx,api){
    var t=api.t, H=api.H, i;
    drawSky(ctx,W,H,t,S.stars);
    /* 섬 */
    ctx.fillStyle='rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(S.cx,S.cy+40,110,26,0,0,6.283); ctx.fill();
    /* 방패 고리 */
    var sr=50, sa=api.state==='play'?S.shield/SHIELD_MAX:1;
    ctx.strokeStyle='rgba(255,255,255,'+(0.35+0.4*sa)+')'; ctx.lineWidth=3+S.shieldHit*4;
    ctx.setLineDash([6,6]); ctx.lineDashOffset=-t*12;
    ctx.beginPath(); ctx.arc(S.cx,S.cy,sr,0,6.283); ctx.stroke(); ctx.setLineDash([]);
    if(S.shieldHit>0){ ctx.fillStyle='rgba(255,126,166,'+(S.shieldHit*0.25)+')'; ctx.beginPath(); ctx.arc(S.cx,S.cy,sr,0,6.283); ctx.fill(); }
    if(S.freeze>0){ ctx.fillStyle='rgba(143,211,255,.12)'; ctx.fillRect(0,0,W,H); }
    for(i=0;i<S.drops.length;i++) drawDrop(ctx,S.drops[i],t);
    for(i=0;i<S.enemies.length;i++) drawEnemy(ctx,S.enemies[i],t);
    /* 별 탄 */
    for(i=0;i<S.bolts.length;i++){
      var b=S.bolts[i], bl=Math.hypot(b.vx,b.vy)||1;
      ctx.strokeStyle=b.gold?'rgba(255,214,107,.55)':'rgba(255,255,255,.6)'; ctx.lineWidth=4; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(b.x-b.vx/bl*16,b.y-b.vy/bl*16); ctx.stroke();
      ctx.fillStyle=b.gold?'#ffd66b':'#ff9bb7'; star5(ctx,b.x,b.y,6,t*10);
    }
    drawLulu(ctx,S.cx,S.cy+4,1.05,t,S.wake>0);
    drawWand(ctx,S.cx,S.cy,S.aim,1,S.muzzle);
    if(S.nova>=NOVA_NEED&&api.state==='play'){
      ctx.strokeStyle='rgba(255,214,107,'+(0.5+0.4*Math.sin(t*8))+')'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(S.cx,S.cy,58+Math.sin(t*8)*4,0,6.283); ctx.stroke();
    }
    if(api.state==='play'&&S.holding){
      ctx.strokeStyle='rgba(123,97,232,.5)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(S.px,S.py,14,0,6.283); ctx.stroke();
    }
    if(api.state==='play'&&S.shield===1){
      var vg=ctx.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H*0.75);
      vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(255,95,146,'+(0.18+0.08*Math.sin(t*5))+')');
      ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
    }
  },

  pointer:function(type,x,y,api){
    if(type==='down'){
      var nearLulu=Math.hypot(x-S.cx,y-S.cy)<46;
      var dbl=api.t-S.lastTap<0.3;
      S.lastTap=api.t;
      if(S.nova>=NOVA_NEED&&(nearLulu||dbl)){ nova(api); S.holding=false; return; }
      S.holding=true; S.px=x; S.py=y;
    } else if(type==='move'){
      if(api.pointerDown){ S.holding=true; S.px=x; S.py=y; }
    } else if(type==='up'){
      S.holding=false;
    }
  },
  key:function(type,code,api){
    var down=type==='down';
    if(code==='ArrowLeft'||code==='KeyA'){ S.keyRot=down?-1:0; return true; }
    if(code==='ArrowRight'||code==='KeyD'){ S.keyRot=down?1:0; return true; }
    if(code==='Space'){ S.keyFire=down; return true; }
    if(code==='KeyX'||code==='Enter'){ if(down&&S.nova>=NOVA_NEED) nova(api); return true; }
    return false;
  },

  preview:function(ctx,w,h,t){
    var dt=Math.min(0.05,Math.max(0,t-PV.t)); PV.t=t;
    if(!PV.stars) PV.stars=makeStars();
    drawSky(ctx,w,h,t,PV.stars,0.8);
    var cx=w/2, cy=h/2+6, s=Math.min(w,h)/150;
    if(PV.en.length<6&&Math.random()<dt*2) pvSpawn(w,h);
    var tgt=null, bd=1e9, i;
    for(i=0;i<PV.en.length;i++){ var e=PV.en[i]; var d=Math.hypot(e.x-cx,e.y-cy); if(d<bd){ bd=d; tgt=e; } }
    var aim=tgt?Math.atan2(tgt.y-cy,tgt.x-cx):-Math.PI/2;
    PV.ft-=dt;
    if(tgt&&PV.ft<=0){ PV.ft=0.16; PV.bo.push({x:cx+Math.cos(aim)*30*s,y:cy+Math.sin(aim)*30*s,vx:Math.cos(aim)*260,vy:Math.sin(aim)*260,l:1}); }
    for(i=PV.en.length-1;i>=0;i--){
      var en=PV.en[i], ex=cx-en.x, ey=cy-en.y, dl=Math.hypot(ex,ey)||1;
      en.x+=ex/dl*22*dt; en.y+=ey/dl*22*dt; en.flash=Math.max(0,en.flash-dt*6);
      en.r=(en.kind==='chubby'?16:10)*s*0.8;
      if(dl<34*s) PV.en.splice(i,1);
    }
    for(i=PV.bo.length-1;i>=0;i--){
      var b=PV.bo[i]; b.x+=b.vx*dt; b.y+=b.vy*dt; b.l-=dt;
      var hit=false;
      for(var j=0;j<PV.en.length;j++){ var q=PV.en[j]; if(Math.hypot(q.x-b.x,q.y-b.y)<q.r+4){ q.flash=1; q.hp=(q.hp||1)-0.5; if(q.hp<=0) PV.en.splice(j,1); hit=true; break; } }
      if(hit||b.l<=0) PV.bo.splice(i,1);
    }
    ctx.strokeStyle='rgba(255,255,255,.6)'; ctx.lineWidth=2; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.arc(cx,cy,40*s*0.8,0,6.283); ctx.stroke(); ctx.setLineDash([]);
    for(i=0;i<PV.en.length;i++){ var pe=PV.en[i]; drawEnemy(ctx,{kind:pe.kind,x:pe.x,y:pe.y,r:pe.r,wob:pe.wob,flash:pe.flash,hp:1,max:1},t); }
    for(i=0;i<PV.bo.length;i++){ ctx.fillStyle='#ff9bb7'; star5(ctx,PV.bo[i].x,PV.bo[i].y,4*s,t*10); }
    drawLulu(ctx,cx,cy+4*s,0.8*s,t,false);
    drawWand(ctx,cx,cy,aim,0.8*s,0);
  },

  result:function(api){
    var sec=Math.floor(S.time), mm=Math.floor(sec/60), ss=sec%60;
    var line=S.time>=120?'우와, 루루가 아침까지 푹 잤어요! 최고의 수호대예요.':
      S.time>=60?'보스 악몽까지 만났어요. 루루가 고맙대요!':
      S.kills>=20?'잘 지켰어요! 조금만 더 버티면 보스가 와요.':'악몽이 세네요. 다시 한 번 루루를 지켜 줘요!';
    return {stats:[['물리친 악몽',S.kills],['최대 연속',S.maxCombo],['버틴 시간',mm+':'+(ss<10?'0':'')+ss]],line:line};
  }
});
})();

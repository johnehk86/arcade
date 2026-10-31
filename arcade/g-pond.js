/* 달빛 연못: 물결 고리가 연잎에 닿는 순간 탭하는 원탭 리듬 게임. C–G–Am–F 위에서 맞힐 때마다 멜로디가 이어진다.
   파스텔 새벽 연못: 라벤더–분홍–민트 물빛, 민트 연잎, 분홍 연꽃, 반짝이. 밝은 바탕이라 가산 합성을 쓰지 않는다. */
(function(){
'use strict';
var U=Arcade.util, clamp=U.clamp, lerp=U.lerp, easeOutBack=U.easeOutBack;
var W=360, R=32, PERFECT=0.062, GOOD=0.135, EARLY=0.34;
var CHORDS=[[60,64,67],[55,59,62],[57,60,64],[53,57,60]];
var MELO=[0,1,2,3,4,5,4,3,2,3,4,5];
var TXT={stroke:'rgba(255,255,255,.92)'};
var SPARK=['#ffb1c5','#ccbeff','#76f8dc','#ffe08a'];

var S=null;   // 판 상태
var flies=[]; for(var i=0;i<22;i++) flies.push({x:Math.random()*W,y:Math.random()*900,ph:Math.random()*6.28,sp:6+Math.random()*10,c:SPARK[i%4],s:3+Math.random()*3.5});

function approachFor(n){ return Math.max(0.66,1.32-n*0.0068); }
function intervalFor(n){ return Math.max(0.42,0.8-n*0.0042); }
function halfChance(n){ return n<24?0:Math.min(0.34,(n-24)*0.006); }
function melody(ci,step){ var c=CHORDS[ci], k=MELO[step%MELO.length]; return c[k%3]+12+12*Math.floor(k/3); }

function padChord(api,ci,delay){
  var c=CHORDS[ci], sfx=api.sfx;
  for(var k=0;k<3;k++) sfx.tone(sfx.mtof(c[k]-12),3.2,'sine',0.045,{attack:0.7,delay:delay});
  sfx.tone(sfx.mtof(c[0]-24),3.2,'triangle',0.04,{attack:0.9,delay:delay});
}
function multiplier(){ return Math.min(5,1+Math.floor(S.combo/8))*(S.fever>0?2:1); }
function updateSub(api){ api.setSub(S.combo>=3?'콤보 '+S.combo+(multiplier()>1?' · ×'+multiplier():''):''); }

function spawnNote(api){
  var q=S.seq, n=q.n, A=approachFor(n), x, y, top=168, bot=api.H-96;
  for(var k=0;k<14;k++){
    x=R+18+api.rng()*(W-2*R-36); y=top+api.rng()*Math.max(40,bot-top);
    var d=Math.hypot(x-q.lx,y-q.ly); if(d>78&&d<210) break;
  }
  q.lx=x; q.ly=y;
  var ci=Math.floor(n/4)%4;
  S.notes.push({x:x,y:y,hitT:q.nextHit,spawnT:q.nextHit-A,A:A,idx:n,ci:ci,res:null,resT:0});
  if(n%4===0) padChord(api,ci,Math.max(0,q.nextHit-api.t));
  api.sfx.tone(1100,0.09,'sine',0.03,{slide:1700});
  var half=!q.half&&api.rng()<halfChance(n);
  q.half=half; q.nextHit+=intervalFor(n)*(half?0.5:1); q.n++;
}
function firstLive(){ for(var k=0;k<S.notes.length;k++){ if(!S.notes[k].res) return S.notes[k]; } return null; }

function tap(api){
  var n=firstLive();
  if(!n||api.t-n.hitT< -EARLY){ api.sfx.tone(700,0.08,'sine',0.04,{slide:520}); return; }
  var ad=Math.abs(api.t-n.hitT), pw=S.fever>0?PERFECT*1.25:PERFECT;
  judge(api,n,ad<=pw?'perfect':ad<=GOOD?'good':'early');
}
function judge(api,n,res){
  var fx=api.fx, sfx=api.sfx;
  n.res=res; n.resT=api.t;
  if(res==='perfect'||res==='good'){
    var perf=res==='perfect', gold=S.fever>0;
    S.combo++; if(S.combo>S.maxCombo) S.maxCombo=S.combo;
    if(perf) S.perfects++; else S.goods++;
    var pts=(perf?10:4)*multiplier();
    api.addScore(pts);
    if(S.fever<=0){ S.gauge=Math.min(1,S.gauge+(perf?1/12:1/30)); if(S.gauge>=1) startFever(api); }
    S.blooms.push({x:n.x,y:n.y,t0:api.t,size:perf?R*0.98:R*0.62,gold:gold,full:perf});
    fx.ring(n.x,n.y,R*3.4,gold?'255,180,80':'255,126,166',1.3,2.5,perf?0.6:0.35);
    if(perf) fx.ring(n.x,n.y,R*5,'172,151,254',1.6,1.5,0.35,0.12);
    fx.burst(n.x,n.y,perf?(14+Math.min(S.combo,20)):6,gold?'255,190,90':(perf?'255,126,166':'172,151,254'),perf?150:80,{gravity:-26,drag:2.2,life:1,size:[4,10]});
    fx.text(n.x,n.y-R-6,(perf?'완벽 +':'좋아 +')+pts,perf?(gold?'#e07a00':'#ff5f92'):'#634eb0',perf?21:16,0.9,TXT);
    if(perf){ fx.pulse(0.6); fx.flash(0.2+Math.min(S.combo,20)*0.01,'255,246,251'); sfx.pluck(melody(n.ci,S.combo),0.26); sfx.tone(2400,0.12,'sine',0.03,{slide:3200}); api.haptic(10); }
    else { sfx.pluck(melody(n.ci,S.combo)-12,0.16); api.haptic(5); }
    if(S.combo%30===0&&S.lives<3){ S.lives++; api.setLives(S.lives,3); sfx.pluck(84,0.14); sfx.pluck(91,0.12,0.12); fx.text(W/2,api.H*0.42,'꽃잎이 돌아왔어요','#2bbca3',20,1.2,{delay:0.15,stroke:TXT.stroke}); }
  } else {
    S.misses++; S.combo=0; S.lives--; api.setLives(S.lives,3);
    S.gauge=Math.max(0,S.gauge-0.25);
    fx.shake(4); sfx.tone(210,0.42,'sine',0.2,{slide:95}); api.haptic(30);
    fx.ring(n.x,n.y,R*2.2,'136,113,118',1,1.5,0.35);
    fx.text(n.x,n.y-R-6,res==='early'?'빨라요':'놓침','#887176',16,0.9,TXT);
    if(S.lives<=0){
      for(var k=0;k<S.notes.length;k++){ if(!S.notes[k].res){ S.notes[k].res='sink'; S.notes[k].resT=api.t; } }
      S.fever=0;
      sfx.pluck(72,0.16); sfx.pluck(67,0.14,0.22); sfx.pluck(64,0.13,0.44); sfx.pluck(60,0.15,0.7);
      api.end();
    }
  }
  updateSub(api);
}
function startFever(api){
  var fx=api.fx, c=CHORDS[0];
  S.fever=8; S.gauge=1; fx.flash(0.8,'255,230,190'); api.haptic(25);
  for(var k=0;k<7;k++) api.sfx.pluck(c[k%3]+12+12*Math.floor(k/3),0.16,k*0.06);
  fx.text(W/2,api.H*0.4,'보름달 · 점수 두 배','#ff8a3d',28,1.6,{rise:16,stroke:TXT.stroke});
  for(k=0;k<4;k++) fx.ring(W/2,api.H*0.5,W*0.9,'255,180,80',1.8,2.5,0.45,k*0.14);
}

/* ---------- 그리기 도구 ---------- */
function sparkle(ctx,x,y,r,col,a){
  ctx.globalAlpha=a; ctx.fillStyle=col;
  ctx.beginPath(); ctx.moveTo(x,y-r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.quadraticCurveTo(x,y,x,y+r);
  ctx.quadraticCurveTo(x,y,x-r,y); ctx.quadraticCurveTo(x,y,x,y-r); ctx.fill();
  ctx.globalAlpha=1;
}
function softGlow(ctx,x,y,r,rgb,a){
  var g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,'rgba('+rgb+','+a+')'); g.addColorStop(1,'rgba('+rgb+',0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
}
function drawPad(ctx,x,y,r,a,rot){
  ctx.globalAlpha=a;
  ctx.fillStyle='rgba(99,78,176,.14)'; ctx.beginPath(); ctx.arc(x+2,y+4,r,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#8fe3c8';
  ctx.beginPath(); ctx.moveTo(x,y); ctx.arc(x,y,r,rot+0.32,rot+Math.PI*2-0.32); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#2bbca3'; ctx.lineWidth=1.6; ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=1.2; ctx.beginPath();
  for(var k=1;k<6;k++){ var an=rot+k*(Math.PI*2/6); ctx.moveTo(x,y); ctx.lineTo(x+Math.cos(an)*r*0.82,y+Math.sin(an)*r*0.82); }
  ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(x-r*0.38,y-r*0.42,r*0.22,r*0.09,-0.6,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
}
function drawLotus(ctx,x,y,size,open,gold,a){
  if(open<=0) return;
  ctx.globalAlpha=a;
  var layers=[[8,1,gold?'#ffc46b':'#ff8fb4',0],[6,0.72,gold?'#fff1c2':'#ffd6e6',0.26]];
  for(var L=0;L<2;L++){
    var cnt=layers[L][0], len=size*layers[L][1]*open, wid=size*0.36*layers[L][1]*(0.5+open*0.5);
    ctx.fillStyle=layers[L][2]; ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=1;
    for(var k=0;k<cnt;k++){
      ctx.save(); ctx.translate(x,y); ctx.rotate(k*(Math.PI*2/cnt)+layers[L][3]+(1-open)*0.6);
      ctx.beginPath(); ctx.ellipse(len*0.5,0,Math.max(0.1,len*0.5),Math.max(0.1,wid*0.5),0,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }
  ctx.fillStyle='#ffd66b'; ctx.beginPath(); ctx.arc(x,y,size*0.17*(0.4+open*0.6),0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
}
function drawWater(ctx,w,h,t,fm){
  var g=ctx.createLinearGradient(0,0,0,h);
  // 평소: 라벤더 → 분홍 → 민트 / 보름달: 복숭아 → 금빛
  g.addColorStop(0,'rgb('+Math.round(lerp(226,255,fm))+','+Math.round(lerp(214,214,fm))+','+Math.round(lerp(255,190,fm))+')');
  g.addColorStop(0.5,'rgb('+Math.round(lerp(255,255,fm))+','+Math.round(lerp(220,226,fm))+','+Math.round(lerp(236,186,fm))+')');
  g.addColorStop(1,'rgb('+Math.round(lerp(204,255,fm))+','+Math.round(lerp(246,236,fm))+','+Math.round(lerp(236,196,fm))+')');
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=1.2;
  for(var k=0;k<10;k++){
    var wy=((k+0.5)/10)*h+Math.sin(t*0.35+k*1.7)*8;
    ctx.beginPath(); ctx.moveTo(0,wy);
    for(var x=0;x<=w;x+=30) ctx.lineTo(x,wy+Math.sin(x*0.03+t*0.8+k)*3);
    ctx.stroke();
  }
}
function drawMoon(ctx,mx,my,r,p,fm,t){
  softGlow(ctx,mx,my,r*(2.6+p*1.4+fm),fm>0.5?'255,200,110':'255,236,190',0.35+p*0.35);
  ctx.fillStyle='#fff6dc'; ctx.beginPath(); ctx.arc(mx,my,r,0,Math.PI*2); ctx.fill();
  // 라벤더 그림자로 달의 차오름(게이지)을 보여 준다
  ctx.save(); ctx.beginPath(); ctx.arc(mx,my,r,0,Math.PI*2); ctx.clip();
  ctx.fillStyle='rgba(204,190,255,.92)'; ctx.beginPath(); ctx.arc(mx-r*2*p,my,r*1.02,0,Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle='rgba(255,255,255,.95)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(mx,my,r,0,Math.PI*2); ctx.stroke();
  if(p>0.6){
    ctx.fillStyle='rgba(255,158,192,'+(Math.min(1,(p-0.6)*2.5)*0.8)+')';
    ctx.beginPath(); ctx.ellipse(mx-r*0.45,my+r*0.25,3.5,2.2,0,0,Math.PI*2); ctx.ellipse(mx+r*0.45,my+r*0.25,3.5,2.2,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(119,17,60,'+Math.min(1,(p-0.6)*2.5)*0.7+')';
    ctx.beginPath(); ctx.arc(mx-r*0.3,my,1.8,0,Math.PI*2); ctx.arc(mx+r*0.3,my,1.8,0,Math.PI*2); ctx.fill();
  }
  for(var k=0;k<4;k++){
    var ww=(r*1.6-k*7)*(0.4+p*0.6);
    ctx.globalAlpha=(0.75-k*0.15)*(0.4+p*0.6); ctx.fillStyle='#ffffff';
    ctx.fillRect(mx-ww/2+Math.sin(t*1.4+k)*4,my+r+12+k*9,ww,2);
  }
  ctx.globalAlpha=1;
  sparkle(ctx,mx+r+10,my-r+4,4+Math.sin(t*3)*1.2,'#ffffff',0.9);
}
function drawFlies(ctx,h,t,gold){
  for(var k=0;k<flies.length;k++){
    var f=flies[k], fy=((f.y%(h+40))+h+40)%(h+40)-20;
    sparkle(ctx,f.x,fy,f.s*(0.8+0.3*Math.sin(f.ph*2.2+k)),gold?'#ffc46b':f.c,0.45+0.4*(0.5+0.5*Math.sin(f.ph*2.2+k)));
  }
}

Arcade.register({
  id:'pond',
  title:'달빛 연못',
  kicker:'리듬 · 원탭 힐링',
  blurb:'물결이 연잎에 닿을 때 톡! 연꽃이 피어나요',
  lede:'분홍 물결 고리가 연잎 테두리에 닿는 순간 톡 눌러 줘요. 딱 맞추면 연꽃이 피고 멜로디가 이어져요. 달이 동그랗게 차면 보름달 시간, 점수가 두 배예요!',
  how:'화면 아무 곳이나 탭 · 스페이스바도 돼요 · 놓치면 꽃잎이 하나 떨어져요',
  lifeIcon:'petal',
  endDelay:1400,
  palette:{bg:'#fbf0ff',surface:'#ffffff',surface2:'#f7e9ff',line:'#e6d2f5',text:'#21172b',muted:'#887176',
    accent:'#ac97fe',accentInk:'#ffffff',accentDeep:'#7a63d6',hot:'#ff7ea6',hotText:'#ff5f92',hotRgb:'255,126,166',light:true},

  start:function(api){
    S={notes:[],blooms:[],combo:0,maxCombo:0,perfects:0,goods:0,misses:0,lives:3,gauge:0,fever:0,fm:0,menuBloomAt:0,
      seq:{n:0,nextHit:api.t+approachFor(0)+0.7,lx:W/2,ly:api.H*0.55,half:false}};
    if(api.state==='play'){ api.setLives(3,3); updateSub(api); }
  },
  reviveText:'꽃잎 2장을 되찾고 이어서 연주해요',
  // 이어하기: 화면의 물결은 모두 가라앉힌 채로 두고, 다음 물결을 1.2초 뒤로 미뤄 박자에 다시 들어가게 한다
  revive:function(api){
    var k;
    for(k=0;k<S.notes.length;k++){ if(!S.notes[k].res){ S.notes[k].res='sink'; S.notes[k].resT=api.t; } }
    S.lives=2; S.combo=0; S.fever=0;
    S.seq.nextHit=api.t+approachFor(S.seq.n)+1.2; S.seq.half=false;
    api.setLives(2,3); updateSub(api);
    api.fx.text(W/2,api.H*0.42,'이어서 GO!','#ff5f92',28,1.3,{rise:16,stroke:TXT.stroke});
    api.fx.ring(W/2,api.H*0.5,W*0.7,'255,126,166',1.4,2,0.4);
    api.sfx.pluck(72,0.16); api.sfx.pluck(76,0.15,0.1); api.sfx.pluck(79,0.16,0.2); api.sfx.pluck(84,0.17,0.3);
  },
  update:function(dt,api){
    var t=api.t, k;
    if(api.state==='play'){
      while(t>=S.seq.nextHit-approachFor(S.seq.n)) spawnNote(api);
      for(k=0;k<S.notes.length;k++){ var n=S.notes[k]; if(!n.res&&t>n.hitT+GOOD){ judge(api,n,'miss'); if(api.state!=='play') break; } }
      if(S.fever>0){ S.fever-=dt; S.gauge=Math.max(0,S.fever/8); if(S.fever<=0){ S.fever=0; S.gauge=0; updateSub(api); } }
    } else if(api.state==='menu'||api.state==='over'){
      if(t>S.menuBloomAt){
        S.menuBloomAt=t+1.8+Math.random()*1.4;
        var bx=40+Math.random()*(W-80), by=170+Math.random()*Math.max(60,api.H*0.3);
        S.blooms.push({x:bx,y:by,t0:t,size:R*(0.6+Math.random()*0.4),gold:Math.random()<0.25,full:true,quiet:true});
        api.fx.ring(bx,by,R*3,'255,126,166',2,1.5,0.35);
      }
    }
    S.fm+=((S.fever>0?1:0)-S.fm)*Math.min(1,dt*2.5);
    for(k=S.notes.length-1;k>=0;k--){ if(S.notes[k].res&&t-S.notes[k].resT>0.7) S.notes.splice(k,1); }
    for(k=S.blooms.length-1;k>=0;k--){ if(t-S.blooms[k].t0>3.4) S.blooms.splice(k,1); }
    for(k=0;k<flies.length;k++){
      var f=flies[k]; f.ph+=dt*0.7;
      f.x+=Math.cos(f.ph*0.9+k)*f.sp*dt; f.y+=Math.sin(f.ph*0.6+k*2)*f.sp*dt-3*dt;
      if(f.x<-20) f.x=W+20; if(f.x>W+20) f.x=-20;
    }
  },
  draw:function(ctx,api){
    var t=api.t, H=api.H, k;
    drawWater(ctx,W,H,t,S.fm);
    drawMoon(ctx,W-64,H*0.16+40,24,S.fever>0?1:S.gauge,S.fm,t);
    drawFlies(ctx,H,t,S.fever>0);
    var live=S.notes.filter(function(n){ return !n.res; });
    if(live.length>1){
      ctx.setLineDash([3,7]); ctx.lineWidth=2;
      for(k=0;k<live.length-1;k++){
        var a1=live[k], a2=live[k+1], ap=clamp((t-a2.spawnT)/0.4,0,1);
        ctx.strokeStyle='rgba(99,78,176,'+(0.3*ap)+')';
        ctx.beginPath(); ctx.moveTo(a1.x,a1.y); ctx.lineTo(a2.x,a2.y); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    for(k=0;k<S.notes.length;k++){
      var n=S.notes[k], appear=clamp((t-n.spawnT)/0.25,0,1), rot=n.idx*1.7;
      if(n.res){
        var fa=1-clamp((t-n.resT)/0.6,0,1), sink=n.res!=='perfect'&&n.res!=='good';
        drawPad(ctx,n.x,n.y+(sink?(1-fa)*6:0),R*(sink?0.8+fa*0.2:1),fa*(sink?0.5:0.9),rot);
        continue;
      }
      var rem=n.hitT-t, prog=clamp(rem/n.A,0,1), ar=R+R*2.3*prog, near=Math.abs(rem)<PERFECT*1.2, first=(n===live[0]);
      if(first) softGlow(ctx,n.x,n.y,R*1.9,S.fever>0?'255,190,90':'255,126,166',(1-prog)*0.45);
      drawPad(ctx,n.x,n.y,R*(0.6+appear*0.4),appear,rot);
      ctx.globalAlpha=appear*(first?1:0.5);
      ctx.strokeStyle='rgba(255,255,255,.95)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(n.x,n.y,R,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle=near?'#ffb020':(S.fever>0?'#ff9a3d':'#ff5f92'); ctx.lineWidth=near?4.5:2.8+(1-prog)*1.2;
      ctx.beginPath(); ctx.arc(n.x,n.y,ar,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
    }
    for(k=0;k<S.blooms.length;k++){
      var b=S.blooms[k], ba=t-b.t0, open=easeOutBack(clamp(ba/0.5,0,1))*(b.full?1:0.55);
      var alpha=b.quiet?Math.min(1,ba/0.6)*clamp((3.4-ba)/1.2,0,1)*0.85:clamp((3.4-ba)/1.1,0,1);
      drawLotus(ctx,b.x,b.y-ba*4,b.size,open,b.gold,alpha);
    }
    if(api.state==='play'&&S.lives===1){
      var vg=ctx.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H*0.75);
      vg.addColorStop(0,'rgba(255,95,146,0)'); vg.addColorStop(1,'rgba(255,95,146,'+(0.2+0.08*Math.sin(t*4))+')');
      ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
    }
  },
  pointer:function(type,x,y,api){ if(type==='down') tap(api); },
  key:function(type,code,api){
    if(code==='Space'||code==='Enter'||code==='KeyZ'||code==='KeyX'||code==='ArrowDown'){ if(type==='down') tap(api); return true; }
    return false;
  },
  preview:function(ctx,w,h,t){
    drawWater(ctx,w,h,t,0);
    drawMoon(ctx,w-56,46,18,0.5+0.5*Math.sin(t*0.4),0,t);
    for(var f=0;f<10;f++) sparkle(ctx,(f*73.3)%w,(f*41.7+t*6)%h,3+(f%3),SPARK[f%4],0.5+0.4*Math.sin(t*2+f));
    var spots=[[0.24,0.6],[0.52,0.38],[0.78,0.66]];
    for(var k=0;k<3;k++){
      var cyc=(t*0.55+k*0.37)%1, x=spots[k][0]*w, y=spots[k][1]*h, r=Math.min(w,h)*0.1;
      drawPad(ctx,x,y,r,1,k*2);
      if(cyc<0.45){
        var prog=1-cyc/0.45;
        ctx.strokeStyle='rgba(255,95,146,'+(0.45+0.55*(1-prog))+')'; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.arc(x,y,r+r*2.2*prog,0,Math.PI*2); ctx.stroke();
      } else {
        var bt=(cyc-0.45)/0.55;
        drawLotus(ctx,x,y,r*0.95,easeOutBack(Math.min(1,bt*2.2)),k===1,1-Math.max(0,bt-0.6)/0.4);
        ctx.strokeStyle='rgba(255,126,166,'+(0.6*(1-bt))+')'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(x,y,r+bt*r*3,0,Math.PI*2); ctx.stroke();
      }
    }
  },
  result:function(api){
    var judged=S.perfects+S.goods+S.misses, bloomed=S.perfects+S.goods;
    var total=(parseInt(Arcade.store.get('arc_pond_flowers','0'),10)||0)+bloomed;
    Arcade.store.set('arc_pond_flowers',String(total));
    return {
      stats:[['완벽',S.perfects],['최대 콤보',S.maxCombo],['정확도',(judged?Math.round((S.perfects+S.goods*0.5)/judged*100):0)+'%']],
      line:bloomed>0?'이번 판에 연꽃 '+bloomed+'송이를 피웠어요 · 지금까지 '+U.fmt(total)+'송이 🌸':'숨 한 번 고르고, 다시 물결을 기다려 봐요.'
    };
  }
});
})();

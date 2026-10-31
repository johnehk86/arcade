/* 달빛 연못: 물결 고리가 연잎에 닿는 순간 탭하는 원탭 리듬 게임. C–G–Am–F 위에서 맞힐 때마다 멜로디가 이어진다. */
(function(){
'use strict';
var U=Arcade.util, clamp=U.clamp, lerp=U.lerp, easeOutBack=U.easeOutBack;
var W=360, R=32, PERFECT=0.062, GOOD=0.135, EARLY=0.34;
var CHORDS=[[60,64,67],[55,59,62],[57,60,64],[53,57,60]];
var MELO=[0,1,2,3,4,5,4,3,2,3,4,5];

var S=null;   // 판 상태
var flies=[]; for(var i=0;i<26;i++) flies.push({x:Math.random()*W,y:Math.random()*900,ph:Math.random()*6.28,sp:6+Math.random()*10,c:Math.random()<0.6?'140,240,200':'255,226,150',s:8+Math.random()*10});

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
    fx.ring(n.x,n.y,R*3.4,gold?'255,226,150':'255,170,205',1.3,2,perf?0.55:0.3);
    if(perf) fx.ring(n.x,n.y,R*5,'200,235,255',1.6,1,0.25,0.12);
    fx.burst(n.x,n.y,perf?(14+Math.min(S.combo,20)):6,gold?'255,226,150':(perf?'255,165,205':'225,238,255'),perf?150:80,{gravity:-26,drag:2.2,life:1});
    fx.text(n.x,n.y-R-6,(perf?'완벽 +':'좋아 +')+pts,perf?(gold?'#ffe3a1':'#ffc2da'):'#d6e4ef',perf?21:16,0.9);
    if(perf){ fx.pulse(0.6); fx.flash(0.2+Math.min(S.combo,20)*0.01); sfx.pluck(melody(n.ci,S.combo),0.26); sfx.tone(2400,0.12,'sine',0.03,{slide:3200}); api.haptic(10); }
    else { sfx.pluck(melody(n.ci,S.combo)-12,0.16); api.haptic(5); }
    if(S.combo%30===0&&S.lives<3){ S.lives++; api.setLives(S.lives,3); sfx.pluck(84,0.14); sfx.pluck(91,0.12,0.12); fx.text(W/2,api.H*0.42,'꽃잎이 돌아왔어요','#86dcb9',20,1.2,{delay:0.15}); }
  } else {
    S.misses++; S.combo=0; S.lives--; api.setLives(S.lives,3);
    S.gauge=Math.max(0,S.gauge-0.25);
    fx.shake(4); sfx.tone(210,0.42,'sine',0.2,{slide:95}); api.haptic(30);
    fx.ring(n.x,n.y,R*2.2,'150,170,190',1,1.5,0.3);
    fx.text(n.x,n.y-R-6,res==='early'?'빨라요':'놓침','#9db3c7',16,0.9);
    if(S.lives<=0){
      for(var k=0;k<S.notes.length;k++){ if(!S.notes[k].res){ S.notes[k].res='sink'; S.notes[k].resT=api.t; } }
      S.fever=0;
      var sfx2=api.sfx; sfx2.pluck(72,0.16); sfx2.pluck(67,0.14,0.22); sfx2.pluck(64,0.13,0.44); sfx2.pluck(60,0.15,0.7);
      api.end();
    }
  }
  updateSub(api);
}
function startFever(api){
  var fx=api.fx, c=CHORDS[0];
  S.fever=8; S.gauge=1; fx.flash(0.8,'255,236,200'); api.haptic(25);
  for(var k=0;k<7;k++) api.sfx.pluck(c[k%3]+12+12*Math.floor(k/3),0.16,k*0.06);
  fx.text(W/2,api.H*0.4,'보름달 · 점수 두 배','#ffe3a1',28,1.6,{rise:16});
  for(k=0;k<4;k++) fx.ring(W/2,api.H*0.5,W*0.9,'255,226,150',1.8,2,0.35,k*0.14);
}

/* ---------- 그리기 도구 ---------- */
function drawPad(ctx,x,y,r,a,rot){
  ctx.globalAlpha=a;
  ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(x+3,y+4,r,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#1f5a49';
  ctx.beginPath(); ctx.moveTo(x,y); ctx.arc(x,y,r,rot+0.32,rot+Math.PI*2-0.32); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(134,220,185,.45)'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.strokeStyle='rgba(134,220,185,.18)'; ctx.lineWidth=1; ctx.beginPath();
  for(var k=1;k<6;k++){ var an=rot+k*(Math.PI*2/6); ctx.moveTo(x,y); ctx.lineTo(x+Math.cos(an)*r*0.85,y+Math.sin(an)*r*0.85); }
  ctx.stroke(); ctx.globalAlpha=1;
}
function drawLotus(ctx,x,y,size,open,gold,a){
  if(open<=0) return;
  ctx.globalAlpha=a;
  var layers=[[8,1,gold?'#ffd27a':'#ff8fb8',0],[6,0.72,gold?'#fff1c9':'#ffd6e6',0.26]];
  for(var L=0;L<2;L++){
    var cnt=layers[L][0], len=size*layers[L][1]*open, wid=size*0.34*layers[L][1]*(0.5+open*0.5);
    ctx.fillStyle=layers[L][2];
    for(var k=0;k<cnt;k++){
      ctx.save(); ctx.translate(x,y); ctx.rotate(k*(Math.PI*2/cnt)+layers[L][3]+(1-open)*0.6);
      ctx.beginPath(); ctx.ellipse(len*0.5,0,Math.max(0.1,len*0.5),Math.max(0.1,wid*0.5),0,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
  }
  ctx.fillStyle='#ffd45e'; ctx.beginPath(); ctx.arc(x,y,size*0.16*(0.4+open*0.6),0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
}
function drawWater(ctx,w,h,t,fm){
  var g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'rgb('+Math.round(lerp(12,52,fm))+','+Math.round(lerp(28,30,fm))+','+Math.round(lerp(48,62,fm))+')');
  g.addColorStop(1,'rgb('+Math.round(lerp(5,34,fm))+','+Math.round(lerp(13,18,fm))+','+Math.round(lerp(26,38,fm))+')');
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='rgba(180,215,240,.05)'; ctx.lineWidth=1;
  for(var k=0;k<10;k++){
    var wy=((k+0.5)/10)*h+Math.sin(t*0.35+k*1.7)*8;
    ctx.beginPath(); ctx.moveTo(0,wy);
    for(var x=0;x<=w;x+=30) ctx.lineTo(x,wy+Math.sin(x*0.03+t*0.8+k)*3);
    ctx.stroke();
  }
}
function drawMoon(ctx,mx,my,r,p,fm,t,glow){
  ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha=0.25+p*0.5+fm*0.25;
  var gs=r*(4+p*2+fm*2); ctx.drawImage(glow('255,226,150'),mx-gs/2,my-gs/2,gs,gs);
  ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
  ctx.fillStyle='rgba(255,227,161,.13)'; ctx.beginPath(); ctx.arc(mx,my,r,0,Math.PI*2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(mx,my,r,0,Math.PI*2); ctx.clip();
  ctx.fillStyle='#ffe3a1'; ctx.fillRect(mx-r,my-r,r*2,r*2);
  ctx.fillStyle='rgba(12,26,44,.94)'; ctx.beginPath(); ctx.arc(mx-r*2*p,my,r*1.02,0,Math.PI*2); ctx.fill();
  ctx.restore();
  for(var k=0;k<4;k++){
    var ww=(r*1.6-k*7)*(0.4+p*0.6);
    ctx.globalAlpha=(0.22-k*0.04)*(0.4+p); ctx.fillStyle='#ffe3a1';
    ctx.fillRect(mx-ww/2+Math.sin(t*1.4+k)*4,my+r+12+k*9,ww,1.5);
  }
  ctx.globalAlpha=1;
}
function drawFlies(ctx,h,t,glow,gold){
  ctx.globalCompositeOperation='lighter';
  for(var k=0;k<flies.length;k++){
    var f=flies[k], fy=((f.y%(h+40))+h+40)%(h+40)-20;
    ctx.globalAlpha=0.18+0.35*(0.5+0.5*Math.sin(f.ph*2.2+k));
    ctx.drawImage(glow(gold?'255,226,150':f.c),f.x-f.s/2,fy-f.s/2,f.s,f.s);
  }
  ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
}

Arcade.register({
  id:'pond',
  title:'달빛 연못',
  kicker:'RHYTHM · 원탭 힐링',
  blurb:'물결이 연잎에 닿는 순간 톡, 연꽃이 피어요',
  lede:'물결 고리가 연잎 테두리에 닿는 순간 탭하세요. 딱 맞추면 연꽃이 피고 멜로디가 이어져요. 달이 가득 차면 보름달 시간, 점수가 두 배예요.',
  how:'화면 아무 곳이나 탭 · 스페이스바도 돼요 · 놓치면 꽃잎이 하나 져요',
  lifeIcon:'petal',
  endDelay:1400,
  palette:{bg:'#0a1828',surface:'#10253a',surface2:'#173250',line:'#26496c',text:'#eef4f8',muted:'#9db3c7',
    accent:'#ffe3a1',accentInk:'#2a1d00',accentDeep:'#b58f3c',hot:'#ff9cc2',hotText:'#ffb3cf',hotRgb:'255,170,205'},

  start:function(api){
    S={notes:[],blooms:[],combo:0,maxCombo:0,perfects:0,goods:0,misses:0,lives:3,gauge:0,fever:0,fm:0,menuBloomAt:0,
      seq:{n:0,nextHit:api.t+approachFor(0)+0.7,lx:W/2,ly:api.H*0.55,half:false}};
    if(api.state==='play'){ api.setLives(3,3); updateSub(api); }
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
        api.fx.ring(bx,by,R*3,'255,170,205',2,1.5,0.25);
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
    var t=api.t, H=api.H, glow=api.fx.glow, k;
    drawWater(ctx,W,H,t,S.fm);
    drawMoon(ctx,W-64,H*0.16+40,24,S.fever>0?1:S.gauge,S.fm,t,glow);
    drawFlies(ctx,H,t,glow,S.fever>0);
    var live=S.notes.filter(function(n){ return !n.res; });
    if(live.length>1){
      ctx.setLineDash([3,7]); ctx.lineWidth=1.5;
      for(k=0;k<live.length-1;k++){
        var a1=live[k], a2=live[k+1], ap=clamp((t-a2.spawnT)/0.4,0,1);
        ctx.strokeStyle='rgba(220,235,250,'+(0.22*ap)+')';
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
      drawPad(ctx,n.x,n.y,R*(0.6+appear*0.4),appear,rot);
      var rem=n.hitT-t, prog=clamp(rem/n.A,0,1), ar=R+R*2.3*prog, near=Math.abs(rem)<PERFECT*1.2, first=(n===live[0]);
      ctx.globalAlpha=appear*(first?1:0.55);
      ctx.strokeStyle='rgba(238,244,248,.45)'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(n.x,n.y,R,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle=near?'#ffe3a1':(S.fever>0?'#ffd27a':'#ff9cc2'); ctx.lineWidth=near?4:2.5+(1-prog)*1.2;
      ctx.beginPath(); ctx.arc(n.x,n.y,ar,0,Math.PI*2); ctx.stroke();
      if(first){
        ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=(1-prog)*0.55;
        ctx.drawImage(glow(S.fever>0?'255,226,150':'255,165,205'),n.x-R*1.5,n.y-R*1.5,R*3,R*3);
        ctx.globalCompositeOperation='source-over';
      }
      ctx.globalAlpha=1;
    }
    for(k=0;k<S.blooms.length;k++){
      var b=S.blooms[k], ba=t-b.t0, open=easeOutBack(clamp(ba/0.5,0,1))*(b.full?1:0.55);
      var alpha=b.quiet?Math.min(1,ba/0.6)*clamp((3.4-ba)/1.2,0,1)*0.7:clamp((3.4-ba)/1.1,0,1);
      drawLotus(ctx,b.x,b.y-ba*4,b.size,open,b.gold,alpha);
    }
    if(api.state==='play'&&S.lives===1){
      var vg=ctx.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H*0.75);
      vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(120,40,70,'+(0.22+0.08*Math.sin(t*4))+')');
      ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
    }
  },
  pointer:function(type,x,y,api){ if(type==='down') tap(api); },
  key:function(type,code,api){
    if(code==='Space'||code==='Enter'||code==='KeyZ'||code==='KeyX'||code==='ArrowDown'){ if(type==='down') tap(api); return true; }
    return false;
  },
  preview:function(ctx,w,h,t){
    var glow=Arcade.fx.glow;
    drawWater(ctx,w,h,t,0);
    drawMoon(ctx,w-56,46,18,0.5+0.5*Math.sin(t*0.4),0,t,glow);
    var spots=[[0.24,0.6],[0.52,0.38],[0.78,0.66]];
    for(var k=0;k<3;k++){
      var cyc=(t*0.55+k*0.37)%1, x=spots[k][0]*w, y=spots[k][1]*h, r=Math.min(w,h)*0.1;
      drawPad(ctx,x,y,r,1,k*2);
      if(cyc<0.45){
        var prog=1-cyc/0.45;
        ctx.strokeStyle='rgba(255,156,194,'+(0.4+0.6*(1-prog))+')'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(x,y,r+r*2.2*prog,0,Math.PI*2); ctx.stroke();
      } else {
        var bt=(cyc-0.45)/0.55;
        drawLotus(ctx,x,y,r*0.95,easeOutBack(Math.min(1,bt*2.2)),k===1,1-Math.max(0,bt-0.6)/0.4);
        ctx.strokeStyle='rgba(255,170,205,'+(0.5*(1-bt))+')'; ctx.lineWidth=1.5;
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
      line:bloomed>0?'이번 판에 연꽃 '+bloomed+'송이를 피웠어요 · 지금까지 '+U.fmt(total)+'송이':'숨 한 번 고르고, 다시 물결을 기다려 봐요.'
    };
  }
});
})();

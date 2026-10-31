/* 빛구슬: 조준해서 구슬 한 묶음을 쏘고, 숫자 블록을 연쇄로 부수는 게임.
   7칸 격자, 턴마다 새 줄이 위에서 들어오고 전부 한 칸 내려온다. 블록이 발사선에 닿으면 끝.
   분홍빛 크림 바탕 위 젤리 마카롱 블록. 판 안의 모든 무작위는 api.rng()로 뽑아 오늘의 도전이 공정하다. */
(function(){
'use strict';
var A=window.Arcade, U=A.util;
var W=360, COLS=7, CELL=W/COLS, GAP=4, TOP=132, BR=5, SPEED=620, MIN_ANG=8*Math.PI/180;
var COLORS=[{c:'#ff8fb4',rgb:'255,126,166',ink:'#8c1f4b',hi:'#ffd2e1'},{c:'#b7a3ff',rgb:'172,151,254',ink:'#4b3596',hi:'#e7deff'},
  {c:'#ffd66b',rgb:'255,200,90',ink:'#7a4d00',hi:'#fff1c2'},{c:'#6fdcc4',rgb:'86,219,193',ink:'#005144',hi:'#c9f7ec'}];
var NUMF='"Jua","Unbounded","IBM Plex Sans KR",sans-serif';
var BOMB='#6b55c9', BOMB_RGB='107,85,201', GOLD_RGB='255,200,90', PINK='#ff5f92', LAV='#634eb0';
var PENT=[0,2,4,7,9];
var TXT={stroke:'rgba(255,255,255,.92)'};
var s=null;

function LY(api){ return api.H-90; }
function rowsOf(api){ return Math.max(6,Math.floor((LY(api)-TOP)/CELL)); }
function cx(c){ return c*CELL+CELL/2; }
function cy(r){ return TOP+r*CELL+CELL/2; }
function key(c,r){ return r*COLS+c; }
function play(api){ return api.state==='play'; }
function rr(ctx,x,y,w,h,r){
  ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function colorFor(hp){ return COLORS[Math.floor(Math.log(hp)/Math.LN2)%4]; }

/* ---------- 판 상태 ---------- */
function newState(api){
  s={turn:1,balls:5,launchX:W/2,aim:-Math.PI/2,aiming:false,showAim:false,phase:'aim',
     blocks:[],items:[],grid:{},flying:[],toLaunch:0,launchT:0,firstLand:null,plus:0,dir:null,
     volleyT:0,speedMul:1,ff:false,chain:0,maxChain:0,destroyed:0,bombs:[],beams:[],slide:0,
     sndT:-1,bsndT:-1,lsndT:-1,hapT:-1,demoT:0};
  addRow(api); shift(api); addRow(api);
}
function rebuildGrid(){
  s.grid={};
  for(var i=0;i<s.blocks.length;i++){ var b=s.blocks[i]; s.grid[key(b.c,b.r)]=b; }
}
function addRow(api){
  var R=api.rng, t=s.turn, empties=[], c;
  var density=Math.min(0.68,0.42+t*0.012);
  for(c=0;c<COLS;c++){
    if(R()<density){
      var hp=Math.max(1,Math.ceil(t*(0.8+R()*1.1)));
      var bomb=t>=4&&R()<0.07;
      s.blocks.push({c:c,r:0,hp:hp,max:hp,bomb:bomb,flash:0,bump:0,col:colorFor(hp)});
    } else empties.push(c);
  }
  if(!empties.length){
    var drop=Math.floor(R()*COLS);
    for(var i=s.blocks.length-1;i>=0;i--){ if(s.blocks[i].r===0&&s.blocks[i].c===drop){ s.blocks.splice(i,1); break; } }
    empties.push(drop);
  }
  var pi=Math.floor(R()*empties.length);
  s.items.push({c:empties[pi],r:0,kind:'plus',cd:0,used:false});
  empties.splice(pi,1);
  if(t>=3&&empties.length&&R()<0.2) s.items.push({c:empties[Math.floor(R()*empties.length)],r:0,kind:'laser',cd:0,used:false});
  rebuildGrid();
}
function shift(api){
  var R=rowsOf(api), i;
  for(i=0;i<s.blocks.length;i++) s.blocks[i].r++;
  for(i=s.items.length-1;i>=0;i--){ s.items[i].r++; if(s.items[i].r>=R-1) s.items.splice(i,1); }
  s.slide=1;
  rebuildGrid();
}
function reachedBottom(api){
  var R=rowsOf(api);
  for(var i=0;i<s.blocks.length;i++){ if(s.blocks[i].r>=R-1) return true; }
  return false;
}
function sub(api){ if(play(api)) api.setSub('구슬 '+s.balls+'개 · 턴 '+s.turn); }

/* ---------- 충돌 ---------- */
function collide(x,y){
  var c0=Math.floor((x-BR)/CELL), c1=Math.floor((x+BR)/CELL);
  var r0=Math.floor((y-BR-TOP)/CELL), r1=Math.floor((y+BR-TOP)/CELL);
  for(var r=r0;r<=r1;r++){
    if(r<0) continue;
    for(var c=c0;c<=c1;c++){
      if(c<0||c>=COLS) continue;
      var b=s.grid[key(c,r)]; if(!b) continue;
      var x0=c*CELL+GAP/2, y0=TOP+r*CELL+GAP/2, sz=CELL-GAP;
      var nx=U.clamp(x,x0,x0+sz), ny=U.clamp(y,y0,y0+sz), dx=x-nx, dy=y-ny;
      if(dx*dx+dy*dy<BR*BR) return b;
    }
  }
  return null;
}

/* ---------- 타격과 파괴 ---------- */
function hitBlock(b,api,dmg){
  if(b.hp<=0) return;
  b.hp-=dmg||1; b.flash=1; b.bump=1;
  if(play(api)){
    api.addScore(1);
    if(api.t-s.sndT>0.04){
      s.sndT=api.t;
      var h=Math.max(1,b.hp);
      A.sfx.tone(A.sfx.mtof(72+PENT[h%5]+12*(Math.floor(h/5)%2)),0.08,'triangle',0.045,{wet:false});
    }
  }
  if(b.hp<=0) destroy(b,api);
}
function destroy(b,api){
  var i=s.blocks.indexOf(b); if(i>=0) s.blocks.splice(i,1);
  if(s.grid[key(b.c,b.r)]===b) delete s.grid[key(b.c,b.r)];
  s.chain++; if(s.chain>s.maxChain) s.maxChain=s.chain;
  s.destroyed++;
  var x=cx(b.c), y=cy(b.r), fx=api.fx;
  fx.shards(x,y,8,b.bomb?BOMB:b.col.c,210,6);
  fx.burst(x,y,8,b.bomb?BOMB_RGB:b.col.rgb,150,{size:[4,10],life:0.5});
  fx.ring(x,y,CELL*0.9,b.bomb?BOMB_RGB:b.col.rgb,0.45,3,0.6);
  fx.shake(2); fx.pulse(0.3);
  if(s.chain>=3&&(s.chain<12||s.chain%5===0)) fx.text(x,y,'연쇄 ×'+s.chain,PINK,14+Math.min(s.chain,24)*0.5,0.7,TXT);
  if(play(api)){
    api.addScore(Math.round(b.max*(1+s.chain/10)));
    if(api.t-s.bsndT>0.03){
      s.bsndT=api.t;
      A.sfx.pluck(67+PENT[s.chain%5]+12*(Math.floor(s.chain/5)%2),0.11);
      A.sfx.noise(0.1,0.06,{freq:3000,type:'bandpass',q:1.2});
    }
    if(api.t-s.hapT>0.08){ s.hapT=api.t; api.haptic(6); }
    if(s.chain%10===0){
      fx.hitstop(0.04); fx.flash(0.35,'255,214,107');
      fx.ring(x,y,W*0.5,'255,126,166',0.8,3,0.7);
    }
  }
  if(b.bomb) s.bombs.push({c:b.c,r:b.r,t:0.09});
}
function explode(bm,api){
  var x=cx(bm.c), y=cy(bm.r), fx=api.fx, dmg=Math.max(10,s.turn*3);
  fx.ring(x,y,CELL*2.2,GOLD_RGB,0.6,5,0.9);
  fx.ring(x,y,CELL*1.6,BOMB_RGB,0.5,2,0.6,0.05);
  fx.burst(x,y,22,'255,126,166',260,{size:[6,16],life:0.6});
  fx.shards(x,y,12,BOMB,260,7);
  fx.shake(7); fx.hitstop(0.05); fx.flash(0.4,'255,214,107');
  if(play(api)){
    A.sfx.noise(0.45,0.32,{freq:1200,slide:90});
    A.sfx.tone(110,0.35,'sine',0.28,{slide:38,wet:false});
    api.haptic(25);
  }
  var hits=[];
  for(var dr=-1;dr<=1;dr++) for(var dc=-1;dc<=1;dc++){
    var b=s.grid[key(bm.c+dc,bm.r+dr)]; if(b) hits.push(b);
  }
  for(var i=0;i<hits.length;i++) hitBlock(hits[i],api,dmg);
}
function zap(it,api){
  s.beams.push({c:it.c,r:it.r,a:1});
  var hits=s.blocks.filter(function(b){ return b.r===it.r||b.c===it.c; });
  for(var i=0;i<hits.length;i++) hitBlock(hits[i],api,1);
  if(play(api)){
    A.sfx.tone(1200,0.2,'sawtooth',0.035,{slide:300,wet:false});
    A.sfx.noise(0.15,0.05,{freq:5000,type:'highpass'});
  }
}
function touchItems(b,api){
  for(var i=s.items.length-1;i>=0;i--){
    var it=s.items[i], dx=b.x-cx(it.c), dy=b.y-cy(it.r);
    if(dx*dx+dy*dy>(BR+11)*(BR+11)) continue;
    if(it.kind==='plus'){
      s.items.splice(i,1); s.plus++;
      api.fx.ring(cx(it.c),cy(it.r),24,'172,151,254',0.4,2.5,0.8);
      api.fx.text(cx(it.c),cy(it.r)-10,'+1',LAV,15,0.7,TXT);
      if(play(api)) A.sfx.pluck(84,0.1);
    } else if(it.cd<=0){
      it.cd=0.2; it.used=true; zap(it,api);
    }
  }
}

/* ---------- 발사와 공 이동 ---------- */
function fire(api){
  if(s.phase!=='aim') return;
  s.slide=0;
  s.phase='fire'; s.toLaunch=s.balls; s.launchT=0; s.firstLand=null; s.chain=0;
  s.volleyT=0; s.speedMul=1; s.ff=false; s.aiming=false; s.showAim=false;
  s.dir={x:Math.cos(s.aim),y:Math.sin(s.aim)};
}
function aimAt(x,y,api){
  var dx=x-s.launchX, dy=y-(LY(api)-BR-1);
  if(dy>0){ dx=-dx; dy=-dy; }            // 발사선 아래를 끌면 새총처럼 반대로 조준
  if(dy>-4) dy=-4;
  s.aim=U.clamp(Math.atan2(dy,dx),-Math.PI+MIN_ANG,-MIN_ANG);
}
function moveBall(b,dt,api,ly){
  var dist=SPEED*dt, steps=Math.max(1,Math.ceil(dist/3.5)), h=dt/steps, hit;
  for(var i=0;i<steps;i++){
    b.x+=b.vx*h;
    if(b.x<BR){ b.x=BR; b.vx=Math.abs(b.vx); } else if(b.x>W-BR){ b.x=W-BR; b.vx=-Math.abs(b.vx); }
    hit=collide(b.x,b.y);
    if(hit){ b.x-=b.vx*h; b.vx=-b.vx; hitBlock(hit,api); }
    b.y+=b.vy*h;
    if(b.y<TOP-6+BR){ b.y=TOP-6+BR; b.vy=Math.abs(b.vy); }
    hit=collide(b.x,b.y);
    if(hit){ b.y-=b.vy*h; b.vy=-b.vy; hitBlock(hit,api); }
    touchItems(b,api);
    if(b.vy>0&&b.y>=ly-BR){
      b.alive=false;
      if(s.firstLand==null) s.firstLand=U.clamp(b.x,BR+8,W-BR-8);
      return;
    }
  }
}
function stepFire(dt,api){
  s.volleyT+=dt;
  if(s.volleyT>5){
    if(!s.ff){ s.ff=true; api.fx.text(W/2,LY(api)-44,'빨리 감기',LAV,16,1,TXT); }
    s.speedMul=Math.min(2.5,s.speedMul+dt*0.8);
  }
  var ly=LY(api);
  if(s.toLaunch>0){
    s.launchT-=dt;
    while(s.toLaunch>0&&s.launchT<=0){
      s.flying.push({x:s.launchX,y:ly-BR-1,vx:s.dir.x*SPEED,vy:s.dir.y*SPEED,alive:true});
      s.toLaunch--; s.launchT+=0.05/s.speedMul;
      if(play(api)&&api.t-s.lsndT>0.05){ s.lsndT=api.t; A.sfx.tone(880,0.03,'sine',0.018,{wet:false}); }
    }
  }
  var mdt=dt*s.speedMul, i;
  for(i=0;i<s.flying.length;i++){ if(s.flying[i].alive) moveBall(s.flying[i],mdt,api,ly); }
  for(i=s.bombs.length-1;i>=0;i--){ s.bombs[i].t-=dt; if(s.bombs[i].t<=0){ var bm=s.bombs.splice(i,1)[0]; explode(bm,api); } }
  var n=0;
  for(i=0;i<s.flying.length;i++){ if(s.flying[i].alive) s.flying[n++]=s.flying[i]; }
  s.flying.length=n;
  if(s.toLaunch===0&&n===0&&!s.bombs.length) endTurn(api);
}
function endTurn(api){
  var fx=api.fx;
  s.phase='aim';
  if(s.firstLand!=null) s.launchX=s.firstLand;
  s.balls+=s.plus; s.plus=0;
  for(var i=s.items.length-1;i>=0;i--){ if(s.items[i].kind==='laser'&&s.items[i].used) s.items.splice(i,1); }
  if(s.chain>=8) fx.text(W/2,api.H*0.42,'연쇄 ×'+s.chain,PINK,30,1.3,TXT);
  if(!s.blocks.length){
    fx.text(W/2,api.H*0.36,'완전 정리!',LAV,30,1.5,TXT);
    fx.flash(0.6,'255,246,251'); fx.ring(W/2,api.H*0.45,W*0.7,'172,151,254',1,3,0.7);
    if(play(api)){
      api.addScore(s.turn*20);
      [72,76,79,84].forEach(function(m,k){ A.sfx.pluck(m,0.13,k*0.07); });
    }
  }
  s.turn++;
  shift(api); addRow(api);
  if(reachedBottom(api)){
    if(play(api)){
      s.phase='over';
      fx.shake(6); fx.flash(0.4,'255,126,166');
      [72,67,64,60].forEach(function(m,k){ A.sfx.pluck(m,0.13,k*0.18); });
      api.haptic(40);
      api.end();
    } else newDemo(api);
  }
  sub(api);
}

/* ---------- 메뉴 화면의 자동 시연 ---------- */
function newDemo(api){
  newState(api);
  s.balls=14;
  for(var k=0;k<3;k++){ s.turn++; shift(api); addRow(api); }
  s.slide=0;
}
function demoTick(dt,api){
  if(s.phase!=='aim') return;
  s.demoT+=dt;
  s.aim=-Math.PI/2+Math.sin(api.t*0.9)*0.95;
  s.showAim=true;
  if(s.demoT>1.1&&s.slide<0.05){ s.demoT=0; fire(api); }
}

/* ---------- 그리기 ---------- */
function star(ctx,x,y,r,ri,n,rot){
  ctx.beginPath();
  for(var i=0;i<n*2;i++){ var a=rot+i*Math.PI/n, q=i%2?ri:r; ctx.lineTo(x+Math.cos(a)*q,y+Math.sin(a)*q); }
  ctx.closePath();
}
function sparkle(ctx,x,y,r,col,a){
  ctx.globalAlpha=a; ctx.fillStyle=col;
  ctx.beginPath(); ctx.moveTo(x,y-r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.quadraticCurveTo(x,y,x,y+r);
  ctx.quadraticCurveTo(x,y,x-r,y); ctx.quadraticCurveTo(x,y,x,y-r); ctx.fill();
  ctx.globalAlpha=1;
}
function cloud(ctx,x,y,s,a){
  ctx.globalAlpha=a; ctx.fillStyle='#ffffff';
  ctx.beginPath();
  ctx.arc(x,y,s*0.5,0,Math.PI*2); ctx.arc(x+s*0.45,y-s*0.2,s*0.42,0,Math.PI*2);
  ctx.arc(x+s*0.9,y,s*0.4,0,Math.PI*2); ctx.rect(x,y-s*0.05,s*0.9,s*0.45);
  ctx.fill(); ctx.globalAlpha=1;
}
function dots(ctx,w,h){
  for(var y=0,row=0;y<h;y+=14,row++){
    for(var x=(row%2)*14;x<w;x+=28){
      ctx.fillStyle=row%2?'rgba(214,199,255,.45)':'rgba(255,202,224,.55)';
      ctx.fillRect(x,y,2.2,2.2);
    }
  }
}
function drawAim(ctx,api){
  var ly=LY(api), x=s.launchX, y=ly-BR-1, dx=Math.cos(s.aim), dy=Math.sin(s.aim), st=4, bounced=0, after=0, pts=[];
  for(var i=0;i<420;i++){
    x+=dx*st; y+=dy*st;
    if(x<BR){ x=BR; dx=-dx; bounced++; } else if(x>W-BR){ x=W-BR; dx=-dx; bounced++; }
    if(y<TOP-6+BR){ y=TOP-6+BR; dy=-dy; bounced++; }
    if(collide(x,y)){
      if(collide(x-dx*st,y)) dy=-dy; else dx=-dx;
      x+=dx*st; y+=dy*st; bounced++;
    }
    if(bounced) after+=st;
    if(after>80||y>ly) break;
    if(i%4===3) pts.push(x,y,bounced>0);
  }
  for(var k=0;k<pts.length;k+=3){
    ctx.globalAlpha=pts[k+2]?0.4*(1-k/pts.length):0.85-k/pts.length*0.4;
    ctx.fillStyle=pts[k+2]?'#ac97fe':'#ff7ea6';
    ctx.beginPath(); ctx.arc(pts[k],pts[k+1],2.6,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}
function drawBlock(ctx,b,off,danger,t){
  var sz=CELL-GAP, x=b.c*CELL+GAP/2, y=TOP+b.r*CELL+GAP/2+off, k=1+b.bump*0.12, rad=11;
  ctx.save();
  ctx.translate(x+sz/2,y+sz/2); ctx.scale(k*(1+b.bump*0.04),k*(1-b.bump*0.05));
  ctx.fillStyle='rgba(163,54,93,.15)'; rr(ctx,-sz/2+1,-sz/2+4,sz,sz,rad); ctx.fill();
  if(b.bomb){
    // 폭탄 사탕: 둥근 보라 사탕 + 심지 + 반짝 불꽃 + 얼굴
    var r=sz*0.42;
    ctx.fillStyle=BOMB; ctx.beginPath(); ctx.arc(0,2,r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-r*0.35,-r*0.25,r*0.32,r*0.2,-0.6,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#d8a24a'; ctx.lineWidth=2.5; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(r*0.45,-r*0.6); ctx.quadraticCurveTo(r*0.8,-r*1.1,r*0.6,-r*1.25); ctx.stroke();
    ctx.fillStyle='#ffd66b'; star(ctx,r*0.6,-r*1.25,5+Math.sin(t*12)*1.2,2.2,4,t*3); ctx.fill();
    ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(-r*0.3,r*0.15,2,0,Math.PI*2); ctx.arc(r*0.3,r*0.15,2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,158,192,.8)'; ctx.beginPath(); ctx.ellipse(-r*0.55,r*0.42,3.2,2,0,0,Math.PI*2); ctx.ellipse(r*0.55,r*0.42,3.2,2,0,0,Math.PI*2); ctx.fill();
    var hp0=Math.max(0,b.hp);
    ctx.fillStyle='#ffffff'; ctx.font=(hp0<100?13:11)+'px '+NUMF; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(String(hp0),0,r*0.62);
  } else {
    var g=ctx.createLinearGradient(0,-sz/2,0,sz/2);
    g.addColorStop(0,b.col.hi); g.addColorStop(0.45,b.col.c); g.addColorStop(1,b.col.c);
    ctx.fillStyle=g; rr(ctx,-sz/2,-sz/2,sz,sz,rad); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=1.5; rr(ctx,-sz/2+1,-sz/2+1,sz-2,sz-2,rad-1); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-sz*0.2,-sz*0.3,sz*0.18,sz*0.07,-0.25,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(sz*0.02,-sz*0.33,sz*0.035,0,Math.PI*2); ctx.fill();
    var hp=Math.max(0,b.hp), fs=hp<10?22:hp<100?19:hp<1000?15:12;
    ctx.fillStyle=b.col.ink; ctx.font=fs+'px '+NUMF;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(String(hp),0,2);
  }
  if(danger){ ctx.strokeStyle='rgba(255,95,146,'+(0.5+0.5*Math.sin(t*8))+')'; ctx.lineWidth=2.5; rr(ctx,-sz/2-2,-sz/2-2,sz+4,sz+4,rad+2); ctx.stroke(); }
  if(b.flash>0){ ctx.fillStyle='rgba(255,255,255,'+(b.flash*0.85)+')'; rr(ctx,-sz/2,-sz/2,sz,sz,rad); ctx.fill(); }
  ctx.restore();
}
function drawWand(ctx,x,y,t){
  ctx.save(); ctx.translate(x,y); ctx.rotate(-0.5+Math.sin(t*3)*0.12);
  ctx.strokeStyle='#ff9ec0'; ctx.lineWidth=3; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(0,2); ctx.lineTo(0,13); ctx.stroke();
  ctx.fillStyle='#ffd66b'; ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.5;
  star(ctx,0,-4,9.5,4.2,5,-Math.PI/2); ctx.fill(); ctx.stroke();
  ctx.restore();
  sparkle(ctx,x+10,y-12,3.5+Math.sin(t*6)*1.2,'#ac97fe',0.9);
}
function drawBoard(ctx,api){
  var ly=LY(api), R=rowsOf(api), t=api.t;
  var bg=ctx.createLinearGradient(0,0,0,api.H);
  bg.addColorStop(0,'#fff6fb'); bg.addColorStop(0.6,'#fbf0ff'); bg.addColorStop(1,'#f2f9ff');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,api.H);
  dots(ctx,W,api.H);
  // 몽글몽글 구름과 반짝이
  cloud(ctx,W*0.62+Math.sin(t*0.2)*8,ly-70,70,0.85);
  cloud(ctx,-20+Math.sin(t*0.15+1)*6,TOP+(ly-TOP)*0.5,58,0.7);
  sparkle(ctx,W*0.14,ly-40,6,'#ffb1c5',0.6+0.3*Math.sin(t*2));
  sparkle(ctx,W*0.9,TOP+40,5,'#ccbeff',0.6+0.3*Math.sin(t*2.4+1));
  ctx.fillStyle='rgba(255,126,166,.08)';
  for(var c=1;c<COLS;c++) ctx.fillRect(c*CELL-0.5,TOP-6,1,ly-TOP+6);
  ctx.fillStyle='#ffc2d6'; rr(ctx,8,TOP-9,W-16,3,1.5); ctx.fill();
  var danger=s.blocks.some(function(b){ return b.r>=R-2; });
  if(danger){ ctx.fillStyle='rgba(255,126,166,'+(0.1+0.06*Math.sin(t*6))+')'; ctx.fillRect(0,ly-CELL,W,CELL); }
  ctx.strokeStyle='#e8c4f4'; ctx.lineWidth=2; ctx.setLineDash([6,6]);
  ctx.beginPath(); ctx.moveTo(0,ly); ctx.lineTo(W,ly); ctx.stroke(); ctx.setLineDash([]);

  var off=-CELL*(1-U.easeOutCubic(1-s.slide)), i;
  for(i=0;i<s.items.length;i++){
    var it=s.items[i], x=cx(it.c), y=cy(it.r)+off;
    if(it.kind==='plus'){
      var pr=11+Math.sin(t*4+it.c)*1.5;
      ctx.fillStyle='rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(x,y,pr,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#ac97fe'; ctx.lineWidth=2.5; ctx.stroke();
      ctx.fillStyle=LAV; ctx.font='13px '+NUMF; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('+1',x,y+1);
    } else drawWand(ctx,x,y,t);
  }
  for(i=0;i<s.blocks.length;i++) drawBlock(ctx,s.blocks[i],off,s.blocks[i].r>=R-2,t);
  for(i=0;i<s.beams.length;i++){
    var bm=s.beams[i], by=cy(bm.r), bx=cx(bm.c);
    ctx.fillStyle='rgba(255,214,107,'+(bm.a*0.7)+')';
    ctx.fillRect(0,by-6*bm.a,W,12*bm.a); ctx.fillRect(bx-6*bm.a,TOP-6,12*bm.a,ly-TOP+6);
    ctx.fillStyle='rgba(255,255,255,'+bm.a+')';
    ctx.fillRect(0,by-1.5,W,3); ctx.fillRect(bx-1.5,TOP-6,3,ly-TOP+6);
  }
}
function drawBalls(ctx,api){
  var ly=LY(api), i, b, n=s.flying.length;
  if(n){
    ctx.strokeStyle='rgba(255,126,166,.32)'; ctx.lineWidth=BR*1.6; ctx.lineCap='round';
    ctx.beginPath();
    for(i=0;i<n;i++){ b=s.flying[i]; ctx.moveTo(b.x-b.vx*0.024,b.y-b.vy*0.024); ctx.lineTo(b.x,b.y); }
    ctx.stroke();
    ctx.fillStyle='#ffffff'; ctx.strokeStyle='#ff9ec0'; ctx.lineWidth=1.4; ctx.beginPath();
    for(i=0;i<n;i++){ b=s.flying[i]; ctx.moveTo(b.x+BR,b.y); ctx.arc(b.x,b.y,BR,0,Math.PI*2); }
    ctx.fill(); ctx.stroke();
    ctx.fillStyle='rgba(255,177,197,.9)'; ctx.beginPath();
    for(i=0;i<n;i++){ b=s.flying[i]; ctx.moveTo(b.x+1.2+1.3,b.y+1.2); ctx.arc(b.x+1.2,b.y+1.2,1.3,0,Math.PI*2); }
    ctx.fill();
  }
  // 발사대: 분홍 진주
  var lx=s.launchX;
  if(s.phase!=='fire'||s.toLaunch>0){
    ctx.fillStyle='rgba(163,54,93,.15)'; ctx.beginPath(); ctx.ellipse(lx,ly+1,BR+5,3,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ff7ea6'; ctx.beginPath(); ctx.arc(lx,ly-BR-1,BR+2.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(lx-2,ly-BR-3,2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#a3365d'; ctx.font='13px '+NUMF; ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText('×'+(s.phase==='fire'?s.toLaunch:s.balls),lx,ly+8);
  }
  if(s.phase==='fire'&&s.firstLand!=null){
    ctx.fillStyle='rgba(255,126,166,.55)'; ctx.beginPath(); ctx.arc(s.firstLand,ly-BR-1,BR,0,Math.PI*2); ctx.fill();
  }
  if(s.phase==='aim'&&(s.aiming||s.showAim)) drawAim(ctx,api);
}

/* ---------- 카드 미리보기 ---------- */
function tri(u){ var f=u-Math.floor(u); return f<0.5?f*2:2-f*2; }
function preview(ctx,w,h,t){
  var bg=ctx.createLinearGradient(0,0,0,h);
  bg.addColorStop(0,'#fff6fb'); bg.addColorStop(1,'#f4ecff');
  ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
  dots(ctx,w,h);
  cloud(ctx,w*0.66,h*0.82,h*0.22,0.9);
  var cs=w/7, pr=Math.max(2,Math.floor(h*0.62/cs)), balls=[], i;
  for(i=0;i<9;i++) balls.push({x:4+tri(t*0.23*(1+i*0.07)+i*0.13)*(w-8),y:4+tri(t*0.31*(1+i*0.05)+i*0.29)*(h*0.86)});
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font=Math.round(cs*0.36)+'px '+NUMF;
  for(var r=0;r<pr;r++){
    for(var c=0;c<7;c++){
      if((c*7+r*13)%5>=3) continue;
      var x=c*cs+3, y=r*cs+3+cs*0.2, sz=cs-6, near=0, col=COLORS[(c+r*2)%4];
      for(i=0;i<balls.length;i++){ var dx=balls[i].x-(x+sz/2), dy=balls[i].y-(y+sz/2); if(dx*dx+dy*dy<sz*sz*0.5) near=1; }
      ctx.fillStyle='rgba(163,54,93,.14)'; rr(ctx,x+1,y+3,sz,sz,9); ctx.fill();
      var g=ctx.createLinearGradient(0,y,0,y+sz); g.addColorStop(0,col.hi); g.addColorStop(0.5,col.c); g.addColorStop(1,col.c);
      ctx.fillStyle=g; rr(ctx,x,y,sz,sz,9); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(x+sz*0.3,y+sz*0.2,sz*0.17,sz*0.06,-0.25,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=col.ink; ctx.fillText(String((c*31+r*17)%40+3),x+sz/2,y+sz/2+2);
      if(near){ ctx.fillStyle='rgba(255,255,255,.6)'; rr(ctx,x,y,sz,sz,9); ctx.fill(); }
    }
  }
  var ly=h-14, a=-Math.PI/2+Math.sin(t*0.7)*0.7;
  ctx.strokeStyle='#e8c4f4'; ctx.lineWidth=1.5; ctx.setLineDash([5,5]);
  ctx.beginPath(); ctx.moveTo(0,ly); ctx.lineTo(w,ly); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='#ff7ea6';
  for(i=1;i<9;i++){ ctx.globalAlpha=0.8-i*0.08; ctx.beginPath(); ctx.arc(w/2+Math.cos(a)*i*11,ly-5+Math.sin(a)*i*11,2.2,0,Math.PI*2); ctx.fill(); }
  ctx.globalAlpha=1;
  ctx.beginPath(); ctx.arc(w/2,ly-5,5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ffffff'; ctx.strokeStyle='#ff9ec0'; ctx.lineWidth=1.2;
  for(i=0;i<balls.length;i++){ ctx.beginPath(); ctx.arc(balls[i].x,balls[i].y,4,0,Math.PI*2); ctx.fill(); ctx.stroke(); }
  sparkle(ctx,w*0.1,h*0.85,6,'#ffb1c5',0.6+0.4*Math.sin(t*2));
  sparkle(ctx,w*0.92,h*0.12,5,'#ac97fe',0.6+0.4*Math.sin(t*2.5));
}

/* ---------- 등록 ---------- */
A.register({
  id:'prism',
  title:'빛구슬',
  kicker:'조준 · 젤리 와르르',
  blurb:'한 번 조준하면 진주알이 젤리를 와르르!',
  lede:'각도를 잡고 손을 떼면 진주알 구슬이 우르르 쏟아져 말랑한 젤리 블록을 톡톡 깎아요. 폭탄 사탕과 별 요술봉으로 연쇄를 이어 봐요!',
  how:'끌어서 조준 · 손을 떼면 발사 · 아래로 끌면 새총처럼 반대로 · 키보드 ←→ 조준, 스페이스 발사',
  palette:{bg:'#fff6fb',surface:'#ffffff',surface2:'#fbefff',line:'#f3cfe0',text:'#21172b',muted:'#887176',
    accent:'#ff5f92',accentInk:'#ffffff',accentDeep:'#c63d70',hot:'#ac97fe',hotText:'#634eb0',hotRgb:'172,151,254',light:true},
  lifeIcon:null,
  endDelay:1300,
  start:function(api){
    if(api.state==='play'){ newState(api); api.setMeter(null); sub(api); }
    else newDemo(api);
  },
  reviveText:'아래쪽 블록 3줄을 광선으로 지우고 이어서 해요',
  // 이어하기: 아래 3줄을 점수 없이 광선으로 지우고, 구슬을 발사대로 모아 조준 상태로 되돌린다
  revive:function(api){
    var R=rowsOf(api), fx=api.fx, i, b, r;
    for(i=s.blocks.length-1;i>=0;i--){
      b=s.blocks[i];
      if(b.r>=R-3){
        fx.shards(cx(b.c),cy(b.r),6,b.bomb?BOMB:b.col.c,180,5);
        fx.burst(cx(b.c),cy(b.r),6,b.bomb?BOMB_RGB:b.col.rgb,130,{size:[4,9],life:0.5});
        s.blocks.splice(i,1);
      }
    }
    for(r=R-3;r<R;r++) s.beams.push({c:-1,r:r,a:1});
    rebuildGrid();
    s.phase='aim'; s.flying.length=0; s.toLaunch=0; s.bombs.length=0; s.firstLand=null;
    s.volleyT=0; s.speedMul=1; s.ff=false; s.chain=0; s.aiming=false; s.showAim=false;
    sub(api);
    fx.text(W/2,api.H*0.42,'이어서 GO!',PINK,30,1.3,TXT);
    fx.flash(0.4,'255,246,251'); fx.shake(3);
    A.sfx.pluck(76,0.15); A.sfx.pluck(81,0.15,0.1); A.sfx.pluck(88,0.16,0.2);
  },
  update:function(dt,api){
    if(!s) return;
    var i;
    s.slide=Math.max(0,s.slide-dt*4);
    for(i=0;i<s.blocks.length;i++){ var b=s.blocks[i]; if(b.flash>0) b.flash=Math.max(0,b.flash-dt*6); if(b.bump>0) b.bump=Math.max(0,b.bump-dt*8); }
    for(i=s.beams.length-1;i>=0;i--){ s.beams[i].a-=dt*4; if(s.beams[i].a<=0) s.beams.splice(i,1); }
    for(i=0;i<s.items.length;i++){ if(s.items[i].cd>0) s.items[i].cd-=dt; }
    if(api.state==='menu') demoTick(dt,api);
    if((api.state==='play'||api.state==='menu')&&s.phase==='fire') stepFire(dt,api);
  },
  draw:function(ctx,api){
    if(!s) newDemo(api);
    drawBoard(ctx,api);
    drawBalls(ctx,api);
  },
  pointer:function(type,x,y,api){
    if(!s||s.phase!=='aim') { if(type==='up') s&&(s.aiming=false); return; }
    if(type==='down'){ s.aiming=true; aimAt(x,y,api); }
    else if(type==='move'&&s.aiming) aimAt(x,y,api);
    else if(type==='up'&&s.aiming){ aimAt(x,y,api); fire(api); }
  },
  key:function(type,code,api){
    if(!s||type!=='down') return false;
    if(code==='ArrowLeft'||code==='ArrowRight'){
      if(s.phase==='aim'){ s.aim=U.clamp(s.aim+(code==='ArrowLeft'?-0.04:0.04),-Math.PI+MIN_ANG,-MIN_ANG); s.showAim=true; }
      return true;
    }
    if(code==='Space'||code==='Enter'||code==='ArrowUp'){ fire(api); return true; }
    return false;
  },
  preview:preview,
  result:function(api){
    return {stats:[['도달 턴',s.turn],['부순 블록',s.destroyed],['최대 연쇄',s.maxChain]],
      line:s.destroyed>0?'진주알 '+s.balls+'개로 젤리 '+s.destroyed+'개를 와르르 부쉈어요!':'각도를 살짝 바꿔서 첫 줄부터 다시 노려 봐요.'};
  }
});
})();

/* 빛구슬: 조준해서 구슬 한 묶음을 쏘고, 숫자 블록을 연쇄로 부수는 게임.
   7칸 격자, 턴마다 새 줄이 위에서 들어오고 전부 한 칸 내려온다. 블록이 발사선에 닿으면 끝.
   종이색 바탕 위 바우하우스 원색 블록. 판 안의 모든 무작위는 api.rng()로 뽑아 오늘의 도전이 공정하다. */
(function(){
'use strict';
var A=window.Arcade, U=A.util;
var W=360, COLS=7, CELL=W/COLS, GAP=4, TOP=132, BR=5, SPEED=620, MIN_ANG=8*Math.PI/180;
var COLORS=[{c:'#e2452b',rgb:'226,69,43'},{c:'#2747c9',rgb:'39,71,201'},{c:'#e8a817',rgb:'232,168,23'},{c:'#138a7e',rgb:'19,138,126'}];
var INK='#1d1a22', INK_RGB='29,26,34', PAPER='#f3ecdf', CREAM='#fbf6ec', NUMF='"Unbounded","IBM Plex Sans KR",sans-serif';
var PENT=[0,2,4,7,9];
var TXT={stroke:'rgba(251,246,236,.92)'};
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
  fx.shards(x,y,8,b.bomb?INK:b.col.c,210,6);
  fx.burst(x,y,8,b.bomb?INK_RGB:b.col.rgb,150,{size:[4,10],life:0.5});
  fx.ring(x,y,CELL*0.9,b.bomb?INK_RGB:b.col.rgb,0.45,3,0.6);
  fx.shake(2); fx.pulse(0.3);
  if(s.chain>=3&&(s.chain<12||s.chain%5===0)) fx.text(x,y,'연쇄 ×'+s.chain,INK,14+Math.min(s.chain,24)*0.5,0.7,TXT);
  if(play(api)){
    api.addScore(Math.round(b.max*(1+s.chain/10)));
    if(api.t-s.bsndT>0.03){
      s.bsndT=api.t;
      A.sfx.pluck(67+PENT[s.chain%5]+12*(Math.floor(s.chain/5)%2),0.11);
      A.sfx.noise(0.1,0.06,{freq:3000,type:'bandpass',q:1.2});
    }
    if(api.t-s.hapT>0.08){ s.hapT=api.t; api.haptic(6); }
    if(s.chain%10===0){
      fx.hitstop(0.04); fx.flash(0.35,'232,168,23');
      fx.ring(x,y,W*0.5,'232,168,23',0.8,3,0.7);
    }
  }
  if(b.bomb) s.bombs.push({c:b.c,r:b.r,t:0.09});
}
function explode(bm,api){
  var x=cx(bm.c), y=cy(bm.r), fx=api.fx, dmg=Math.max(10,s.turn*3);
  fx.ring(x,y,CELL*2.2,'232,168,23',0.6,5,0.9);
  fx.ring(x,y,CELL*1.6,INK_RGB,0.5,2,0.6,0.05);
  fx.burst(x,y,22,'232,168,23',260,{size:[6,16],life:0.6});
  fx.shards(x,y,12,INK,260,7);
  fx.shake(7); fx.hitstop(0.05); fx.flash(0.4,'232,168,23');
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
      api.fx.ring(cx(it.c),cy(it.r),24,'39,71,201',0.4,2.5,0.8);
      api.fx.text(cx(it.c),cy(it.r)-10,'+1',COLORS[1].c,15,0.7,TXT);
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
    if(!s.ff){ s.ff=true; api.fx.text(W/2,LY(api)-44,'빨리 감기',COLORS[1].c,16,1,TXT); }
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
  if(s.chain>=8) fx.text(W/2,api.H*0.42,'연쇄 ×'+s.chain,COLORS[0].c,30,1.3,TXT);
  if(!s.blocks.length){
    fx.text(W/2,api.H*0.36,'완전 정리!',COLORS[1].c,30,1.5,TXT);
    fx.flash(0.6,'255,250,235'); fx.ring(W/2,api.H*0.45,W*0.7,'39,71,201',1,3,0.7);
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
      fx.shake(6); fx.flash(0.4,'226,69,43');
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
    ctx.globalAlpha=pts[k+2]?0.35*(1-k/pts.length):0.75-k/pts.length*0.4;
    ctx.fillStyle=INK;
    ctx.beginPath(); ctx.arc(pts[k],pts[k+1],2.2,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}
function drawBlock(ctx,b,off,danger,t){
  var sz=CELL-GAP, x=b.c*CELL+GAP/2, y=TOP+b.r*CELL+GAP/2+off, k=1+b.bump*0.1;
  ctx.save();
  ctx.translate(x+sz/2,y+sz/2); ctx.scale(k,k);
  ctx.fillStyle='rgba(29,26,34,.12)'; rr(ctx,-sz/2+3,-sz/2+3,sz,sz,7); ctx.fill();
  ctx.fillStyle=b.bomb?INK:b.col.c; rr(ctx,-sz/2,-sz/2,sz,sz,7); ctx.fill();
  if(b.bomb){
    ctx.strokeStyle='#e8a817'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(sz*0.28,-sz*0.28,4.5,0,Math.PI*2); ctx.stroke();
    ctx.beginPath();
    for(var a=0;a<8;a++){ var an=a*Math.PI/4; ctx.moveTo(sz*0.28+Math.cos(an)*6,-sz*0.28+Math.sin(an)*6); ctx.lineTo(sz*0.28+Math.cos(an)*8.5,-sz*0.28+Math.sin(an)*8.5); }
    ctx.stroke();
  }
  if(danger){ ctx.strokeStyle='rgba(226,69,43,'+(0.5+0.5*Math.sin(t*8))+')'; ctx.lineWidth=2.5; rr(ctx,-sz/2-2,-sz/2-2,sz+4,sz+4,9); ctx.stroke(); }
  var hp=Math.max(0,b.hp), fs=hp<10?20:hp<100?17:hp<1000?14:12;
  ctx.fillStyle=CREAM; ctx.font='600 '+fs+'px '+NUMF;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(String(hp),0,1);
  if(b.flash>0){ ctx.fillStyle='rgba(255,255,255,'+(b.flash*0.8)+')'; rr(ctx,-sz/2,-sz/2,sz,sz,7); ctx.fill(); }
  ctx.restore();
}
function drawBoard(ctx,api){
  var ly=LY(api), R=rowsOf(api), t=api.t;
  ctx.fillStyle=PAPER; ctx.fillRect(0,0,W,api.H);
  // 바우하우스 장식: 큰 원, 반원, 삼각형을 아주 옅게
  ctx.fillStyle='rgba(39,71,201,.06)'; ctx.beginPath(); ctx.arc(W*0.86,ly-50,120,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(232,168,23,.09)'; ctx.beginPath(); ctx.arc(0,TOP+(ly-TOP)*0.42,96,-Math.PI/2,Math.PI/2); ctx.fill();
  ctx.fillStyle='rgba(226,69,43,.06)'; ctx.beginPath(); ctx.moveTo(W*0.18,ly); ctx.lineTo(W*0.42,ly-150); ctx.lineTo(W*0.66,ly); ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(29,26,34,.045)';
  for(var c=1;c<COLS;c++) ctx.fillRect(c*CELL-0.5,TOP-6,1,ly-TOP+6);
  ctx.fillStyle='rgba(29,26,34,.8)'; ctx.fillRect(0,TOP-8,W,2);
  var danger=s.blocks.some(function(b){ return b.r>=R-2; });
  if(danger){ ctx.fillStyle='rgba(226,69,43,'+(0.06+0.04*Math.sin(t*6))+')'; ctx.fillRect(0,ly-CELL,W,CELL); }
  ctx.fillStyle='rgba(29,26,34,.5)'; ctx.fillRect(0,ly,W,1.5);

  var off=-CELL*(1-U.easeOutCubic(1-s.slide)), i;
  for(i=0;i<s.items.length;i++){
    var it=s.items[i], x=cx(it.c), y=cy(it.r)+off;
    if(it.kind==='plus'){
      ctx.strokeStyle=COLORS[1].c; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.arc(x,y,11+Math.sin(t*4+it.c)*1.5,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle=COLORS[1].c; ctx.font='600 10px '+NUMF; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('+1',x,y+0.5);
    } else {
      ctx.save(); ctx.translate(x,y); ctx.rotate(Math.PI/4+Math.sin(t*3)*0.1);
      ctx.fillStyle='#e8a817'; ctx.fillRect(-8,-8,16,16);
      ctx.fillStyle=CREAM; ctx.fillRect(-8,-1.2,16,2.4); ctx.fillRect(-1.2,-8,2.4,16);
      ctx.restore();
    }
  }
  for(i=0;i<s.blocks.length;i++) drawBlock(ctx,s.blocks[i],off,s.blocks[i].r>=R-2,t);
  for(i=0;i<s.beams.length;i++){
    var bm=s.beams[i], by=cy(bm.r), bx=cx(bm.c);
    ctx.fillStyle='rgba(232,168,23,'+(bm.a*0.7)+')';
    ctx.fillRect(0,by-5*bm.a,W,10*bm.a); ctx.fillRect(bx-5*bm.a,TOP-6,10*bm.a,ly-TOP+6);
    ctx.fillStyle='rgba(255,255,255,'+bm.a+')';
    ctx.fillRect(0,by-1.2,W,2.4); ctx.fillRect(bx-1.2,TOP-6,2.4,ly-TOP+6);
  }
}
function drawBalls(ctx,api){
  var ly=LY(api), i, b, n=s.flying.length;
  if(n){
    ctx.strokeStyle='rgba(29,26,34,.16)'; ctx.lineWidth=BR*1.5; ctx.lineCap='round';
    ctx.beginPath();
    for(i=0;i<n;i++){ b=s.flying[i]; ctx.moveTo(b.x-b.vx*0.02,b.y-b.vy*0.02); ctx.lineTo(b.x,b.y); }
    ctx.stroke();
    ctx.fillStyle=INK; ctx.beginPath();
    for(i=0;i<n;i++){ b=s.flying[i]; ctx.moveTo(b.x+BR,b.y); ctx.arc(b.x,b.y,BR,0,Math.PI*2); }
    ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.75)'; ctx.beginPath();
    for(i=0;i<n;i++){ b=s.flying[i]; ctx.moveTo(b.x-1.2,b.y-1.6); ctx.arc(b.x-1.6,b.y-1.6,1.4,0,Math.PI*2); }
    ctx.fill();
  }
  // 발사대
  var lx=s.launchX;
  if(s.phase!=='fire'||s.toLaunch>0){
    ctx.fillStyle=INK; ctx.beginPath(); ctx.arc(lx,ly-BR-1,BR+1.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#6b6358'; ctx.font='600 11px '+NUMF; ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText('×'+(s.phase==='fire'?s.toLaunch:s.balls),lx,ly+8);
  }
  if(s.phase==='fire'&&s.firstLand!=null){
    ctx.fillStyle='rgba(29,26,34,.55)'; ctx.beginPath(); ctx.arc(s.firstLand,ly-BR-1,BR,0,Math.PI*2); ctx.fill();
  }
  if(s.phase==='aim'&&(s.aiming||s.showAim)) drawAim(ctx,api);
}

/* ---------- 카드 미리보기 ---------- */
function tri(u){ var f=u-Math.floor(u); return f<0.5?f*2:2-f*2; }
function preview(ctx,w,h,t){
  ctx.fillStyle=PAPER; ctx.fillRect(0,0,w,h);
  ctx.fillStyle='rgba(39,71,201,.08)'; ctx.beginPath(); ctx.arc(w*0.85,h*0.8,h*0.45,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(232,168,23,.12)'; ctx.beginPath(); ctx.arc(0,h*0.35,h*0.3,-Math.PI/2,Math.PI/2); ctx.fill();
  var cs=w/7, pr=Math.max(2,Math.floor(h*0.62/cs)), balls=[], i;
  for(i=0;i<9;i++) balls.push({x:4+tri(t*0.23*(1+i*0.07)+i*0.13)*(w-8),y:4+tri(t*0.31*(1+i*0.05)+i*0.29)*(h*0.86)});
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='600 '+Math.round(cs*0.3)+'px '+NUMF;
  for(var r=0;r<pr;r++){
    for(var c=0;c<7;c++){
      if((c*7+r*13)%5>=3) continue;
      var x=c*cs+2, y=r*cs+2+cs*0.2, sz=cs-4, near=0;
      for(i=0;i<balls.length;i++){ var dx=balls[i].x-(x+sz/2), dy=balls[i].y-(y+sz/2); if(dx*dx+dy*dy<sz*sz*0.5) near=1; }
      ctx.fillStyle='rgba(29,26,34,.12)'; rr(ctx,x+2,y+2,sz,sz,5); ctx.fill();
      ctx.fillStyle=COLORS[(c+r*2)%4].c; rr(ctx,x,y,sz,sz,5); ctx.fill();
      ctx.fillStyle=CREAM; ctx.fillText(String((c*31+r*17)%40+3),x+sz/2,y+sz/2+1);
      if(near){ ctx.fillStyle='rgba(255,255,255,.55)'; rr(ctx,x,y,sz,sz,5); ctx.fill(); }
    }
  }
  var ly=h-14, a=-Math.PI/2+Math.sin(t*0.7)*0.7;
  ctx.fillStyle='rgba(29,26,34,.45)'; ctx.fillRect(0,ly,w,1.2);
  ctx.fillStyle=INK;
  for(i=1;i<9;i++){ ctx.globalAlpha=0.7-i*0.07; ctx.beginPath(); ctx.arc(w/2+Math.cos(a)*i*11,ly-5+Math.sin(a)*i*11,1.8,0,Math.PI*2); ctx.fill(); }
  ctx.globalAlpha=1;
  ctx.beginPath(); ctx.arc(w/2,ly-5,4.5,0,Math.PI*2); ctx.fill();
  for(i=0;i<balls.length;i++){ ctx.beginPath(); ctx.arc(balls[i].x,balls[i].y,3.6,0,Math.PI*2); ctx.fill(); }
}

/* ---------- 등록 ---------- */
A.register({
  id:'prism',
  title:'빛구슬',
  kicker:'조준 · 연쇄 파괴',
  blurb:'한 번 조준, 구슬 수십 개가 블록을 부순다',
  lede:'각도를 잡고 손을 떼면 구슬이 한꺼번에 쏟아져 숫자 블록을 깎아 냅니다. 폭탄과 광선으로 연쇄를 이어 보세요.',
  how:'끌어서 조준 · 손을 떼면 발사 · 발사선 아래로 끌면 새총처럼 반대로 · 키보드 ←→ 조준, 스페이스 발사',
  palette:{bg:'#f3ecdf',surface:'#fbf6ec',surface2:'#ece3d2',line:'#d8ccb6',text:'#1d1a22',muted:'#6b6358',
    accent:'#2747c9',accentInk:'#fbf6ec',accentDeep:'#172c86',hot:'#e2452b',hotText:'#e2452b',hotRgb:'226,69,43',light:true},
  lifeIcon:null,
  endDelay:1300,
  start:function(api){
    if(api.state==='play'){ newState(api); api.setMeter(null); sub(api); }
    else newDemo(api);
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
      line:s.destroyed>0?'구슬 '+s.balls+'개로 블록 '+s.destroyed+'개를 부쉈어요.':'각도를 조금만 바꿔서 첫 줄부터 다시 노려 보세요.'};
  }
});
})();

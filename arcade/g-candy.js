/* 별사탕 팡: 같은 사탕 묶음을 탭해서 터뜨리는 60초 퍼즐. 터지는 순서가 탭한 곳에서 물결처럼 퍼지고, 큰 묶음은 무지개 별사탕을 남긴다. */
(function(){
'use strict';
var U=Arcade.util, clamp=U.clamp, easeOutBack=U.easeOutBack;
var W=360, COLS=8, ROWS=10, TOP=128, RAINBOW=5, CHAIN=1.6;
var KINDS=[
  {c:'#ff7ea6',d:'#e24f80',rgb:'255,110,160'},   // 하트
  {c:'#ac97fe',d:'#7b61e8',rgb:'140,110,245'},   // 별
  {c:'#56dbc1',d:'#22a98f',rgb:'40,190,160'},    // 물방울
  {c:'#ffd66b',d:'#e3a52a',rgb:'235,175,50'},    // 동그라미
  {c:'#ffab85',d:'#ef7a4f',rgb:'245,130,90'}     // 네모
];
var PENTA=[0,2,4,7,9];
var S=null;

function layout(H){
  var cs=Math.min((W-24)/COLS,(H-TOP-40)/ROWS);
  return {cs:cs,x0:(W-cs*COLS)/2,y0:TOP+Math.max(0,(H-TOP-40-cs*ROWS)*0.5)};
}
function rr(ctx,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function hh(a,b,c){ var h=Math.sin(a*127.1+b*311.7+c*74.7)*43758.5453; return h-Math.floor(h); }

/* ---------- 사탕 그리기: 색과 모양이 둘 다 달라서 색약이어도 구분된다 ---------- */
function shapePath(ctx,k,s){
  ctx.beginPath();
  if(k===0){
    ctx.moveTo(0,s*0.9);
    ctx.bezierCurveTo(-s*1.35,-s*0.05,-s*0.6,-s*1.1,0,-s*0.45);
    ctx.bezierCurveTo(s*0.6,-s*1.1,s*1.35,-s*0.05,0,s*0.9);
  } else if(k===1||k===RAINBOW){
    for(var i=0;i<10;i++){
      var a=-Math.PI/2+i*Math.PI/5, rad=i%2?s*0.55:s*1.08;
      if(i===0) ctx.moveTo(Math.cos(a)*rad,Math.sin(a)*rad); else ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad);
    }
    ctx.closePath();
  } else if(k===2){
    ctx.moveTo(0,-s*1.08);
    ctx.bezierCurveTo(s*0.6,-s*0.45,s*0.9,-s*0.05,s*0.9,s*0.2);
    ctx.arc(0,s*0.2,s*0.9,0,Math.PI,false);
    ctx.bezierCurveTo(-s*0.9,-s*0.05,-s*0.6,-s*0.45,0,-s*1.08);
  } else if(k===3){
    ctx.arc(0,0,s*0.95,0,Math.PI*2);
  } else {
    rr(ctx,-s*0.88,-s*0.88,s*1.76,s*1.76,s*0.42);
  }
}
function drawCandy(ctx,k,x,y,s,sx,sy,rot,a,t){
  ctx.save(); ctx.translate(x,y); if(rot) ctx.rotate(rot); ctx.scale(sx,sy); ctx.globalAlpha=a;
  ctx.fillStyle='rgba(33,23,43,.08)';
  ctx.beginPath(); ctx.ellipse(0,s*0.95,s*0.8,s*0.22,0,0,Math.PI*2); ctx.fill();
  shapePath(ctx,k,s);
  if(k===RAINBOW){
    var g=ctx.createLinearGradient(Math.cos(t*2)*-s,Math.sin(t*2)*-s,Math.cos(t*2)*s,Math.sin(t*2)*s);
    g.addColorStop(0,'#ff7ea6'); g.addColorStop(0.33,'#ffd66b'); g.addColorStop(0.66,'#56dbc1'); g.addColorStop(1,'#ac97fe');
    ctx.fillStyle=g; ctx.fill();
    ctx.lineJoin='round'; ctx.lineWidth=s*0.16; ctx.strokeStyle='#ffffff'; ctx.stroke();
  } else {
    var K=KINDS[k];
    ctx.fillStyle=K.c; ctx.fill();
    ctx.lineJoin='round'; ctx.lineWidth=s*0.13; ctx.strokeStyle=K.d; ctx.stroke();
  }
  ctx.fillStyle='rgba(255,255,255,.6)';
  ctx.beginPath(); ctx.ellipse(-s*0.3,-s*0.4,s*0.24,s*0.13,-0.6,0,Math.PI*2); ctx.fill();
  if(s>6){
    var fy=k===0?-s*0.05:(k===2?s*0.22:s*0.05);
    ctx.fillStyle='#21172b';
    ctx.beginPath(); ctx.arc(-s*0.26,fy,s*0.085,0,Math.PI*2); ctx.arc(s*0.26,fy,s*0.085,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#21172b'; ctx.lineWidth=Math.max(1,s*0.07); ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(0,fy+s*0.08,s*0.12,0.2,Math.PI-0.2); ctx.stroke();
    ctx.fillStyle='rgba(255,95,146,.38)';
    ctx.beginPath(); ctx.ellipse(-s*0.46,fy+s*0.16,s*0.12,s*0.07,0,0,Math.PI*2); ctx.ellipse(s*0.46,fy+s*0.16,s*0.12,s*0.07,0,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
function drawBg(ctx,w,h,t,glow){
  ctx.fillStyle='#fff6fb'; ctx.fillRect(0,0,w,h);
  var blobs=[[0.1,0.08,'255,190,215'],[0.95,0.4,'205,190,255'],[0.2,0.95,'190,245,230']];
  for(var i=0;i<3;i++){
    var b=blobs[i], sz=Math.max(w,h)*0.9;
    ctx.globalAlpha=0.55;
    ctx.drawImage(glow(b[2]),b[0]*w-sz/2+Math.sin(t*0.3+i)*10,b[1]*h-sz/2,sz,sz);
  }
  ctx.globalAlpha=1;
  for(var y=7;y<h;y+=28){
    for(var x=7;x<w;x+=28){
      ctx.fillStyle='rgba(255,170,205,.35)'; ctx.fillRect(x,y,2,2);
      ctx.fillStyle='rgba(190,170,255,.35)'; ctx.fillRect(x+14,y+14,2,2);
    }
  }
}
function drawSpark(ctx,x,y,s,c,a,rot){
  ctx.save(); ctx.translate(x,y); ctx.rotate(rot); ctx.globalAlpha=a; ctx.fillStyle=c;
  ctx.beginPath(); ctx.moveTo(0,-s); ctx.quadraticCurveTo(0,0,s,0); ctx.quadraticCurveTo(0,0,0,s); ctx.quadraticCurveTo(0,0,-s,0); ctx.quadraticCurveTo(0,0,0,-s);
  ctx.fill(); ctx.restore();
}

/* ---------- 판 ---------- */
function newCandy(c,row){ return {k:Math.floor(S.col[c]()*5),fy:row,vy:0,sq:0,wob:0,pop:0}; }
function seedStream(api){ var s=Math.floor(api.rng()*4294967296); return U.mulberry(s); }
function flood(c,r){
  var cell=S.g[c][r], k=cell.k, seen={}, out=[], st=[[c,r]];
  seen[c+','+r]=1;
  while(st.length){
    var p=st.pop(); out.push(p);
    var nb=[[p[0]+1,p[1]],[p[0]-1,p[1]],[p[0],p[1]+1],[p[0],p[1]-1]];
    for(var i=0;i<4;i++){
      var x=nb[i][0], y=nb[i][1];
      if(x<0||y<0||x>=COLS||y>=ROWS||seen[x+','+y]) continue;
      var n=S.g[x][y]; if(!n||n.pop||n.k!==k) continue;
      seen[x+','+y]=1; st.push([x,y]);
    }
  }
  return out;
}
function hasMove(){
  for(var c=0;c<COLS;c++) for(var r=0;r<ROWS;r++){
    var a=S.g[c][r]; if(!a) continue;
    if(a.k===RAINBOW) return true;
    if(c+1<COLS&&S.g[c+1][r]&&S.g[c+1][r].k===a.k) return true;
    if(r+1<ROWS&&S.g[c][r+1]&&S.g[c][r+1].k===a.k) return true;
  }
  return false;
}
function multiplier(){ return Math.min(6,1+Math.floor((S.combo-1)/2)); }

function startWave(api,c,r,silent){
  var cell=S.g[c][r];
  if(!cell||cell.pop||S.wave) return;
  var fx=api.fx, L=layout(api.H), px=L.x0+(c+0.5)*L.cs, py=L.y0+(r+0.5)*L.cs;
  var set, rainbow=cell.k===RAINBOW, i;
  if(rainbow){
    var cnt=[0,0,0,0,0], best=0;
    for(var x=0;x<COLS;x++) for(var y=0;y<ROWS;y++){ var n=S.g[x][y]; if(n&&n.k<5) cnt[n.k]++; }
    for(i=1;i<5;i++) if(cnt[i]>cnt[best]) best=i;
    set=[[c,r]];
    for(x=0;x<COLS;x++) for(y=0;y<ROWS;y++){ n=S.g[x][y]; if(n&&n.k===best) set.push([x,y]); }
  } else {
    set=flood(c,r);
    if(set.length<2){
      if(silent) return;
      cell.wob=1; S.rem=Math.max(0,S.rem-0.5); S.combo=0; api.setSub('');
      api.sfx.tone(240,0.18,'sine',0.14,{slide:170}); api.haptic(12);
      fx.text(px,py-L.cs*0.6,'-0.5초','#887176',16,0.8,{stroke:'rgba(255,255,255,.9)'});
      return;
    }
  }
  var groupN=set.length;
  var special=!rainbow&&groupN>=7, blast=!rainbow&&groupN>=10;
  var key={}; set.forEach(function(p){ key[p[0]+','+p[1]]=1; });
  if(blast){
    for(i=0;i<COLS;i++) if(!key[i+','+r]&&S.g[i][r]){ key[i+','+r]=1; set.push([i,r]); }
    for(i=0;i<ROWS;i++) if(!key[c+','+i]&&S.g[c][i]){ key[c+','+i]=1; set.push([c,i]); }
    S.beams.push({h:true,i:r,t0:api.t},{h:false,i:c,t0:api.t});
  }
  var items=[], maxAt=api.t;
  set.forEach(function(p){
    if(special&&p[0]===c&&p[1]===r) return;
    var d=Math.hypot(p[0]-c,p[1]-r);
    items.push({c:p[0],r:p[1],d:d});
  });
  items.sort(function(a,b){ return a.d-b.d; });
  items.forEach(function(it,idx){ it.idx=idx; it.at=api.t+it.d*0.065; if(it.at>maxAt) maxAt=it.at; });
  S.wave={items:items,end:maxAt+0.17,silent:silent};
  if(special){ cell.k=RAINBOW; cell.sq=0.3; fx.ring(px,py,L.cs*2.2,'172,151,254',0.7,3,0.8); }
  if(silent) return;

  // 점수, 콤보, 시간
  var m=items.length;
  S.combo=(api.t-S.lastPop<=CHAIN)?S.combo+1:1; S.lastPop=api.t;
  if(S.combo>S.maxCombo) S.maxCombo=S.combo;
  if(groupN>S.maxGroup&&!rainbow) S.maxGroup=groupN;
  S.popped+=m;
  var pts=m*m*5*multiplier();
  api.addScore(pts);
  api.setSub(S.combo>=2?'콤보 '+S.combo+' · ×'+multiplier():'');
  if(m>=5){ S.rem=Math.min(75,S.rem+0.1*m); }
  fx.text(px,py-L.cs*0.7,'+'+U.fmt(pts),'#ff5f92',m>=7?24:19,0.9,{stroke:'rgba(255,255,255,.95)'});
  api.haptic(m>=10?24:8);
  if(rainbow){
    fx.text(W/2,api.H*0.34,'무지개 팡!','#7b61e8',30,1.4,{stroke:'rgba(255,255,255,.95)',rise:16});
    var cols=['255,126,166','255,214,107','86,219,193','172,151,254'];
    for(i=0;i<4;i++) fx.ring(px,py,W*0.8,cols[i],1.2,4,0.7,i*0.08);
    fx.flash(0.5,'255,240,250'); fx.shake(4); fx.hitstop(0.05);
    var sf=api.sfx; [0,4,7,12,16,19].forEach(function(n,j){ sf.pluck(72+n,0.13,j*0.05); });
  } else if(groupN>=10){
    fx.text(W/2,api.H*0.34,'대박!','#ff5f92',32,1.3,{stroke:'rgba(255,255,255,.95)',rise:16});
    fx.flash(0.55,'255,236,246'); fx.shake(6); fx.hitstop(0.05);
    fx.ring(px,py,W*0.7,'255,126,166',0.9,4,0.7);
  } else if(special){
    fx.text(px,py+L.cs*0.9,'무지개 별사탕','#7b61e8',16,1.1,{stroke:'rgba(255,255,255,.95)',rise:10});
    fx.shake(2.5);
  } else if(m>=5){ fx.shake(1.5); }
}
function popCell(api,it,w){
  var cell=S.g[it.c][it.r]; if(!cell||cell.pop) return;
  cell.pop=api.t;
  var fx=api.fx, L=layout(api.H), x=L.x0+(it.c+0.5)*L.cs, y=L.y0+(cell.fy+0.5)*L.cs;
  var K=cell.k===RAINBOW?{c:'#ac97fe',rgb:'172,151,254'}:KINDS[cell.k];
  fx.burst(x,y,w.silent?3:6,K.rgb,110,{size:[5,11],life:0.55,drag:3.2});
  if(!w.silent) fx.shards(x,y,3,K.c,150,5,{gravity:380,life:0.7});
  for(var i=0;i<2;i++){
    var a=Math.random()*6.28, v=60+Math.random()*90;
    S.spark.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-40,life:0.7,max:0.7,s:3+Math.random()*4,c:i?K.c:'#ffffff',rot:Math.random()*3});
  }
  if(S.spark.length>220) S.spark.splice(0,S.spark.length-220);
  if(!w.silent&&(it.idx<14||it.idx%3===0)){
    var j=Math.min(it.idx,14);
    api.sfx.pluck(72+PENTA[j%5]+12*Math.floor(j/5),0.11);
    api.sfx.tone(900,0.05,'sine',0.04,{slide:1700,wet:false});
  }
}
function finishWave(api){
  for(var c=0;c<COLS;c++){
    var keep=[];
    for(var r=ROWS-1;r>=0;r--){ var n=S.g[c][r]; if(n&&!n.pop) keep.push(n); }
    var missing=ROWS-keep.length;
    for(r=ROWS-1;r>=0;r--){
      var idx=ROWS-1-r;
      if(idx<keep.length) S.g[c][r]=keep[idx];
      else { var nc=newCandy(c,0); nc.fy=r-missing-0.6-(missing-(idx-keep.length))*0.15; S.g[c][r]=nc; }
    }
  }
  S.wave=null;
  if(!hasMove()){
    var a=S.g[0][ROWS-1], b=S.g[1][ROWS-1];
    if(a&&b&&a.k<5) b.k=a.k;
  }
}

Arcade.register({
  id:'candy',
  title:'별사탕 팡',
  kicker:'PUZZLE · 60초',
  blurb:'같은 사탕을 톡, 물결처럼 팡팡 터져요',
  lede:'같은 모양 사탕이 둘 이상 붙어 있으면 탭해서 터뜨려요. 크게 묶을수록 점수가 제곱으로 커지고, 일곱 개 넘게 터뜨리면 무지개 별사탕이 생겨요.',
  how:'묶음 탭으로 팡 · 1.6초 안에 이어 터뜨리면 콤보 · 혼자인 사탕을 누르면 0.5초 감점',
  lifeIcon:null,
  endDelay:1300,
  palette:{bg:'#fff6fb',surface:'#ffffff',surface2:'#fbf0ff',line:'#f3d3e4',text:'#21172b',muted:'#887176',
    accent:'#7b61e8',accentInk:'#ffffff',accentDeep:'#4b3596',hot:'#ff5f92',hotText:'#ff5f92',hotRgb:'255,95,146',light:true},

  start:function(api){
    S={g:[],col:[],wave:null,spark:[],beams:[],combo:0,lastPop:-9,maxCombo:0,maxGroup:0,popped:0,rem:60,lastTick:0,autoAt:api.t+1};
    for(var c=0;c<COLS;c++) S.col.push(seedStream(api));
    for(c=0;c<COLS;c++){ S.g.push([]); for(var r=0;r<ROWS;r++){ var n=newCandy(c,r); n.fy=r-ROWS-1+r*0.04; S.g[c].push(n); } }
    if(!hasMove()) S.g[1][ROWS-1].k=S.g[0][ROWS-1].k;
    if(api.state==='play'){ api.setSub(''); api.setMeter(1,'남은 시간 60.0초',false); }
  },
  update:function(dt,api){
    var t=api.t, c, r, n;
    for(c=0;c<COLS;c++) for(r=0;r<ROWS;r++){
      n=S.g[c][r]; if(!n) continue;
      if(n.fy<r||n.vy!==0){
        n.vy+=46*dt; n.fy+=n.vy*dt;
        if(n.fy>=r){ n.fy=r; if(n.vy>4){ n.sq=Math.min(0.32,n.vy*0.022); n.vy=-n.vy*0.2; } else n.vy=0; }
      }
      n.sq*=Math.exp(-dt*9); n.wob*=Math.exp(-dt*5);
    }
    if(S.wave){
      var w=S.wave;
      for(var i=0;i<w.items.length;i++){ var it=w.items[i]; if(!it.done&&t>=it.at){ it.done=true; popCell(api,it,w); } }
      if(t>=w.end) finishWave(api);
    }
    for(i=S.spark.length-1;i>=0;i--){
      var p=S.spark[i]; p.life-=dt; if(p.life<=0){ S.spark.splice(i,1); continue; }
      p.vy+=260*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.rot+=dt*4;
    }
    for(i=S.beams.length-1;i>=0;i--) if(t-S.beams[i].t0>0.4) S.beams.splice(i,1);

    if(api.state==='play'){
      if(S.combo>0&&!S.wave&&t-S.lastPop>CHAIN){ S.combo=0; api.setSub(''); }
      S.rem-=dt;
      var sec=Math.ceil(S.rem);
      if(S.rem<10&&S.rem>0&&sec!==S.lastTick){ S.lastTick=sec; api.sfx.tone(1500,0.05,'square',0.035,{wet:false}); }
      if(S.rem<=0){
        S.rem=0; api.setMeter(0,'시간 종료',true); api.setSub('');
        api.sfx.pluck(76,0.14); api.sfx.pluck(72,0.14,0.15); api.sfx.pluck(67,0.16,0.3);
        api.end();
      } else api.setMeter(Math.min(1,S.rem/60),'남은 시간 '+S.rem.toFixed(1)+'초',S.rem<10);
    } else if((api.state==='menu'||api.state==='over')&&!S.wave&&t>S.autoAt){
      S.autoAt=t+1.1+Math.random()*0.8;
      for(var k=0;k<14;k++){
        c=Math.floor(Math.random()*COLS); r=Math.floor(Math.random()*ROWS);
        n=S.g[c][r];
        if(n&&n.k<5&&n.fy===r&&flood(c,r).length>=2){ startWave(api,c,r,true); break; }
      }
    }
  },
  draw:function(ctx,api){
    var H=api.H, t=api.t, L=layout(H), cs=L.cs, glow=api.fx.glow, c, r, n;
    drawBg(ctx,W,H,t,glow);
    var bw=cs*COLS, bh=cs*ROWS;
    ctx.save();
    ctx.shadowColor='rgba(255,126,166,.28)'; ctx.shadowBlur=26; ctx.shadowOffsetY=10;
    ctx.fillStyle='#ffffff'; rr(ctx,L.x0-8,L.y0-8,bw+16,bh+16,24); ctx.fill();
    ctx.restore();
    ctx.strokeStyle='#ffd9e8'; ctx.lineWidth=2; rr(ctx,L.x0-8,L.y0-8,bw+16,bh+16,24); ctx.stroke();
    ctx.save();
    rr(ctx,L.x0,L.y0,bw,bh,16); ctx.clip();
    ctx.fillStyle='#fdf5ff';
    for(c=0;c<COLS;c++) for(r=0;r<ROWS;r++) if((c+r)%2) ctx.fillRect(L.x0+c*cs,L.y0+r*cs,cs,cs);
    var s=cs*0.4;
    for(c=0;c<COLS;c++) for(r=0;r<ROWS;r++){
      n=S.g[c][r]; if(!n) continue;
      var x=L.x0+(c+0.5)*cs, y=L.y0+(n.fy+0.5)*cs;
      if(y<L.y0-cs) continue;
      var sc=1, a=1, rot=n.wob>0.02?Math.sin(t*38)*n.wob*0.35:0;
      if(n.pop){ var q=clamp((t-n.pop)/0.15,0,1); sc=1+q*0.45; a=1-q; if(a<=0) continue; }
      if(n.k===RAINBOW){ sc*=1+0.08*Math.sin(t*6); rot+=Math.sin(t*2)*0.15; }
      drawCandy(ctx,n.k,x,y,s*sc,1+n.sq,1-n.sq,rot,a,t);
    }
    for(var i=0;i<S.beams.length;i++){
      var b=S.beams[i], ba=1-(t-b.t0)/0.4;
      ctx.globalAlpha=ba; ctx.fillStyle='#ffffff';
      if(b.h) ctx.fillRect(L.x0,L.y0+(b.i+0.5)*cs-cs*0.22*ba,bw,cs*0.44*ba);
      else ctx.fillRect(L.x0+(b.i+0.5)*cs-cs*0.22*ba,L.y0,cs*0.44*ba,bh);
      ctx.globalAlpha=ba*0.6; ctx.fillStyle='#ffb1c5';
      if(b.h) ctx.fillRect(L.x0,L.y0+(b.i+0.5)*cs-cs*0.4*ba,bw,cs*0.8*ba);
      else ctx.fillRect(L.x0+(b.i+0.5)*cs-cs*0.4*ba,L.y0,cs*0.8*ba,bh);
    }
    ctx.globalAlpha=1;
    ctx.restore();
    for(i=0;i<S.spark.length;i++){ var p=S.spark[i]; drawSpark(ctx,p.x,p.y,p.s,p.c,p.life/p.max,p.rot); }
    ctx.globalAlpha=1;
    if(api.state==='play'&&S.rem<10){
      var vg=ctx.createRadialGradient(W/2,H/2,H*0.32,W/2,H/2,H*0.75);
      vg.addColorStop(0,'rgba(255,95,146,0)'); vg.addColorStop(1,'rgba(255,95,146,'+(0.12+0.06*Math.sin(t*6))+')');
      ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
    }
  },
  pointer:function(type,x,y,api){
    if(type!=='down'||S.wave) return;
    var L=layout(api.H), c=Math.floor((x-L.x0)/L.cs), r=Math.floor((y-L.y0)/L.cs);
    if(c<0||r<0||c>=COLS||r>=ROWS) return;
    startWave(api,c,r,false);
  },
  key:function(){ return false; },
  preview:function(ctx,w,h,t){
    var glow=Arcade.fx.glow;
    drawBg(ctx,w,h,t,glow);
    var cols=7, rows=5, cs=Math.min((w-40)/cols,(h-44)/rows), bw=cs*cols, bh=cs*rows, x0=(w-bw)/2, y0=(h-bh)/2+8;
    ctx.save(); ctx.shadowColor='rgba(255,126,166,.3)'; ctx.shadowBlur=20; ctx.shadowOffsetY=8;
    ctx.fillStyle='#ffffff'; rr(ctx,x0-7,y0-7,bw+14,bh+14,20); ctx.fill(); ctx.restore();
    ctx.save(); rr(ctx,x0,y0,bw,bh,14); ctx.clip();
    var cyc=Math.floor(t/1.8), ph=t-cyc*1.8, cx=Math.floor(hh(cyc,1,2)*cols), cy=Math.floor(hh(cyc,3,4)*rows);
    for(var c=0;c<cols;c++) for(var r=0;r<rows;r++){
      var k=Math.floor(hh(c,r,0)*5), x=x0+(c+0.5)*cs, y=y0+(r+0.5)*cs, s=cs*0.4;
      var d=Math.hypot(c-cx,r-cy), pt=ph-0.45-d*0.08;
      if(d<2.3&&pt>0){
        if(pt<0.16){ var q=pt/0.16; drawCandy(ctx,k,x,y,s*(1+q*0.4),1,1,0,1-q,t); drawSpark(ctx,x+(q*12),y-(q*12),4,'#ff7ea6',1-q,q*3); }
        else if(pt>0.42){ var f=Math.min(1,(pt-0.42)*4.5); drawCandy(ctx,k,x,y-(1-easeOutBack(f))*cs*1.4,s,1,1,0,1,t); }
      } else drawCandy(ctx,k,x,y,s,1,1,0,1,t);
    }
    ctx.restore();
  },
  result:function(){
    return {
      stats:[['최대 묶음',S.maxGroup],['최대 콤보',S.maxCombo],['터뜨린 사탕',U.fmt(S.popped)]],
      line:S.popped>0?'별사탕 '+U.fmt(S.popped)+'개를 팡팡 터뜨렸어요. 오늘도 달콤하게!':'같은 모양끼리 붙은 사탕을 찾아 톡 눌러 봐요.'
    };
  }
});
})();

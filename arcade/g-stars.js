/* 별자리 잇기: 같은 색 별을 상하좌우로 끌어 잇는 60초 퍼즐. 고리로 닫으면 그 색 별이 전부 터지고, 긴 줄은 유성 별을 남긴다. */
(function(){
'use strict';
var U=Arcade.util, clamp=U.clamp, easeOutBack=U.easeOutBack;
var W=360, COLS=6, ROWS=7, TOP=132, DUR=60, CHAIN_GAP=2;
var KINDS=[
  {c:'#ff7ea6',d:'#e24f80',rgb:'255,110,160'},   // 하트
  {c:'#ac97fe',d:'#7b61e8',rgb:'140,110,245'},   // 점
  {c:'#56dbc1',d:'#22a98f',rgb:'40,190,160'},    // 달
  {c:'#ffd66b',d:'#e3a52a',rgb:'235,175,50'},    // 꽃
  {c:'#8fd3ff',d:'#3d9be9',rgb:'70,160,235'},    // 물방울
  {c:'#ffab85',d:'#ef7a4f',rgb:'245,130,90'}     // 마름모 (20초 뒤 등장)
];
var PENTA=[0,2,4,7,9];
var S=null;

function hh(a,b,c){ var h=Math.sin(a*127.1+b*311.7+c*74.7)*43758.5453; return h-Math.floor(h); }
function layout(H){
  var cs=Math.min((W-28)/COLS,(H-TOP-50)/ROWS);
  return {cs:cs,x0:(W-cs*COLS)/2,y0:TOP+Math.max(0,(H-TOP-50-cs*ROWS)*0.45)};
}
function cx(c){ return S.L.x0+(c+0.5)*S.L.cs; }
function cy(r){ return S.L.y0+(r+0.5)*S.L.cs; }
function rr(ctx,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

/* ---------- 별 그리기: 색과 안쪽 무늬가 둘 다 달라서 색약이어도 구분된다 ---------- */
function starPath(ctx,s){
  ctx.beginPath();
  for(var i=0;i<10;i++){
    var a=-Math.PI/2+i*Math.PI/5, rad=i%2?s*0.62:s;
    if(i===0) ctx.moveTo(Math.cos(a)*rad,Math.sin(a)*rad); else ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad);
  }
  ctx.closePath();
}
function markPath(ctx,k,m){
  ctx.beginPath();
  if(k===0){
    ctx.moveTo(0,m*0.85);
    ctx.bezierCurveTo(-m*1.3,-m*0.05,-m*0.55,-m*1.05,0,-m*0.4);
    ctx.bezierCurveTo(m*0.55,-m*1.05,m*1.3,-m*0.05,0,m*0.85);
  } else if(k===1){
    ctx.arc(0,0,m*0.62,0,Math.PI*2);
  } else if(k===2){
    ctx.arc(0,0,m*0.8,Math.PI*0.3,Math.PI*1.7,false);
    ctx.arc(m*0.42,0,m*0.62,Math.PI*1.55,Math.PI*0.45,true);
    ctx.closePath();
  } else if(k===3){
    for(var i=0;i<5;i++){ var a=-Math.PI/2+i*Math.PI*0.4; ctx.moveTo(Math.cos(a)*m*0.55+m*0.32,Math.sin(a)*m*0.55); ctx.arc(Math.cos(a)*m*0.55,Math.sin(a)*m*0.55,m*0.32,0,Math.PI*2); }
  } else if(k===4){
    ctx.moveTo(0,-m*0.95);
    ctx.bezierCurveTo(m*0.5,-m*0.35,m*0.7,0,m*0.7,m*0.22);
    ctx.arc(0,m*0.22,m*0.7,0,Math.PI,false);
    ctx.bezierCurveTo(-m*0.7,0,-m*0.5,-m*0.35,0,-m*0.95);
  } else {
    ctx.moveTo(0,-m*0.9); ctx.lineTo(m*0.7,0); ctx.lineTo(0,m*0.9); ctx.lineTo(-m*0.7,0); ctx.closePath();
  }
}
function drawStar(ctx,k,x,y,s,sx,sy,a,meteor,t){
  var K=KINDS[k];
  ctx.save(); ctx.translate(x,y); ctx.scale(sx,sy); ctx.globalAlpha=a;
  ctx.fillStyle='rgba(99,78,176,.10)';
  ctx.beginPath(); ctx.ellipse(0,s*0.95,s*0.75,s*0.2,0,0,Math.PI*2); ctx.fill();
  if(meteor){
    ctx.save(); ctx.rotate(t*2);
    ctx.strokeStyle='#ffc94a'; ctx.lineWidth=s*0.14; ctx.setLineDash([s*0.32,s*0.22]);
    ctx.beginPath(); ctx.arc(0,0,s*1.28,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  ctx.lineJoin='round';
  starPath(ctx,s*0.88);
  ctx.lineWidth=s*0.42; ctx.strokeStyle=K.d; ctx.stroke();
  ctx.lineWidth=s*0.24; ctx.strokeStyle=K.c; ctx.stroke();
  ctx.fillStyle=K.c; ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.ellipse(-s*0.28,-s*0.36,s*0.2,s*0.11,-0.6,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=meteor?'#fff4c2':'rgba(255,255,255,.95)';
  ctx.save(); ctx.translate(0,s*0.08); markPath(ctx,k,s*0.3); ctx.fill(); ctx.restore();
  ctx.restore();
}
function drawSpark(ctx,x,y,s,c,a,rot){
  ctx.save(); ctx.translate(x,y); ctx.rotate(rot); ctx.globalAlpha=a; ctx.fillStyle=c;
  ctx.beginPath(); ctx.moveTo(0,-s); ctx.quadraticCurveTo(0,0,s,0); ctx.quadraticCurveTo(0,0,0,s); ctx.quadraticCurveTo(0,0,-s,0); ctx.quadraticCurveTo(0,0,0,-s);
  ctx.fill(); ctx.restore();
}
function drawSky(ctx,w,h,t){
  var g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#e6dcff'); g.addColorStop(0.5,'#ffe0ee'); g.addColorStop(1,'#ffeadb');
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  // 희미한 별자리 선
  var pts=[];
  for(var i=0;i<12;i++) pts.push([hh(i,1,3)*w,hh(i,2,5)*h*0.95+h*0.02]);
  ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=1;
  ctx.beginPath();
  for(i=0;i<11;i++){ if(i%4===3) continue; ctx.moveTo(pts[i][0],pts[i][1]); ctx.lineTo(pts[i+1][0],pts[i+1][1]); }
  ctx.stroke();
  for(i=0;i<pts.length;i++){
    var tw=0.45+0.4*Math.sin(t*2+i*1.7);
    drawSpark(ctx,pts[i][0],pts[i][1],3+hh(i,4,1)*3,'#ffffff',tw,0);
  }
  for(i=0;i<18;i++){
    ctx.globalAlpha=0.25+0.35*(0.5+0.5*Math.sin(t*3+i));
    ctx.fillStyle=i%3?'#ffffff':'#ffd66b';
    ctx.fillRect(hh(i,7,2)*w,hh(i,9,4)*h,2,2);
  }
  ctx.globalAlpha=1;
}

/* ---------- 판 ---------- */
function seedStream(f){ return U.mulberry(Math.floor(f()*4294967296)); }
function pickKind(c){
  var st=S.col[c], a=st(), b=st();
  var p=S.el>20?Math.min(0.2,(S.el-20)*0.006):0;
  return b<p?5:Math.floor(a*5);
}
function newStar(c,fy){ return {k:pickKind(c),fy:fy,vy:0,sq:0,pop:-1,meteor:false,sel:0}; }
function initBoard(f){
  S.col=[]; S.g=[];
  for(var c=0;c<COLS;c++) S.col.push(seedStream(f));
  for(c=0;c<COLS;c++){
    var col=[];
    for(var r=0;r<ROWS;r++) col.push(newStar(c,r-ROWS-1-(ROWS-r)*0.25-c*0.15));
    S.g.push(col);
  }
  ensureMoves(false);
}
function hasMove(){
  for(var c=0;c<COLS;c++) for(var r=0;r<ROWS;r++){
    var s=S.g[c][r]; if(!s) continue;
    if(c+1<COLS&&S.g[c+1][r]&&S.g[c+1][r].k===s.k) return true;
    if(r+1<ROWS&&S.g[c][r+1]&&S.g[c][r+1].k===s.k) return true;
  }
  return false;
}
function ensureMoves(show){
  var tries=0;
  while(!hasMove()&&tries<8){
    var ks=[], c, r;
    for(c=0;c<COLS;c++) for(r=0;r<ROWS;r++) ks.push(S.g[c][r].k);
    for(var i=ks.length-1;i>0;i--){ var j=Math.floor(S.col[0]()*(i+1)), tmp=ks[i]; ks[i]=ks[j]; ks[j]=tmp; }
    var n=0;
    for(c=0;c<COLS;c++) for(r=0;r<ROWS;r++){ S.g[c][r].k=ks[n++]; S.g[c][r].sq=1; }
    tries++;
    if(show&&S.api){ S.api.fx.text(W/2,cy(3),'섞는 중~','#7b61e8',24,1.1,{stroke:'rgba(255,255,255,.9)'}); }
  }
  if(!hasMove()) S.g[1][ROWS-1].k=S.g[0][ROWS-1].k;
}
function settled(){
  for(var c=0;c<COLS;c++) for(var r=0;r<ROWS;r++){ var s=S.g[c][r]; if(!s||s.pop>=0||Math.abs(s.fy-r)>0.02) return false; }
  return true;
}
function pending(){
  for(var c=0;c<COLS;c++) for(var r=0;r<ROWS;r++){ var s=S.g[c][r]; if(!s||s.pop>=0) return true; }
  return false;
}
function collapse(){
  for(var c=0;c<COLS;c++){
    var col=S.g[c], kept=[];
    for(var r=ROWS-1;r>=0;r--) if(col[r]) kept.push(col[r]);
    var m=ROWS-kept.length, out=new Array(ROWS);
    for(var i=0;i<kept.length;i++) out[ROWS-1-i]=kept[i];
    for(var j=0;j<m;j++) out[j]=newStar(c,j-m-0.6);
    S.g[c]=out;
  }
  S.needCheck=true;
}

/* ---------- 소리 ---------- */
function loud(){ return S.api&&S.api.state==='play'; }
function noteAdd(i){
  if(!loud()) return;
  var m=72+PENTA[i%5]+12*Math.min(2,Math.floor(i/5));
  S.api.sfx.pluck(m,0.15); S.api.haptic(4);
}
function burstChord(n){
  if(!loud()) return;
  var sfx=S.api.sfx;
  sfx.pluck(72,0.12); sfx.pluck(76,0.11,0.04); sfx.pluck(79,0.11,0.08);
  if(n>=6) sfx.pluck(84,0.12,0.12);
  sfx.noise(0.18,0.05,{type:'highpass',freq:3000});
}
function loopArp(){
  if(!loud()) return;
  var sfx=S.api.sfx, seq=[72,76,79,84,88,91,96];
  for(var i=0;i<seq.length;i++) sfx.pluck(seq[i],0.14,i*0.05);
  sfx.tone(1800,0.6,'sine',0.04,{slide:3600,attack:0.02});
}

/* ---------- 연결 ---------- */
function cellAt(x,y){
  var L=S.L, c=Math.floor((x-L.x0)/L.cs), r=Math.floor((y-L.y0)/L.cs);
  if(c<0||r<0||c>=COLS||r>=ROWS) return null;
  var dx=x-cx(c), dy=y-cy(r), rad=L.cs*0.47;
  if(dx*dx+dy*dy>rad*rad) return null;
  var s=S.g[c][r];
  if(!s||s.pop>=0||Math.abs(s.fy-r)>0.1) return null;
  return [c,r];
}
function same(a,b){ return a&&b&&a[0]===b[0]&&a[1]===b[1]; }
function adj(a,b){ return Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])===1; }
function idxIn(p){ for(var i=0;i<S.chain.length;i++) if(same(S.chain[i],p)) return i; return -1; }
function startChain(p){
  S.chain=[p]; S.loop=false; S.loopAt=null;
  S.g[p[0]][p[1]].sq=0.8; noteAdd(0);
}
function extend(p){
  var ch=S.chain, n=ch.length, last=ch[n-1];
  if(!p||same(p,last)||!adj(last,p)) return;
  var k=S.g[last[0]][last[1]].k;
  if(S.g[p[0]][p[1]].k!==k) return;
  if(n>=2&&same(p,ch[n-2])){
    if(S.loop){ S.loop=false; S.loopAt=null; return; }
    ch.pop(); if(loud()) S.api.sfx.tone(520,0.06,'sine',0.04,{slide:400});
    return;
  }
  if(S.loop) return;
  if(idxIn(p)>=0){
    if(n>=3){ S.loop=true; S.loopAt=p; if(loud()){ S.api.sfx.pluck(91,0.13); S.api.haptic(10); } }
    return;
  }
  ch.push(p); S.g[p[0]][p[1]].sq=0.8; noteAdd(n);
}
function resolve(api,scoring){
  var ch=S.chain, n=ch.length, loop=S.loop, fx=api.fx;
  var k=S.g[ch[0][0]][ch[0][1]].k;
  S.chain=[]; S.loop=false; S.loopAt=null;
  var set={}, list=[];
  function add(c,r,d){
    var key=c+','+r; if(set[key]) return;
    var s=S.g[c][r]; if(!s||s.pop>=0) return;
    set[key]=1; list.push([c,r,d]);
  }
  var keep=(scoring&&n>=8&&!loop)?ch[n-1]:null;
  var meteors=[];
  for(var i=0;i<n;i++){
    var p=ch[i];
    if(S.g[p[0]][p[1]].meteor) meteors.push(p);
    if(keep&&same(p,keep)) continue;
    add(p[0],p[1],i*0.045);
  }
  var base=n*0.045;
  if(loop){
    var lc=cx(ch[n-1][0]), lr=cy(ch[n-1][1]);
    for(var c=0;c<COLS;c++) for(var r=0;r<ROWS;r++){
      var s=S.g[c][r]; if(s&&s.k===k) add(c,r,base+Math.hypot(cx(c)-lc,cy(r)-lr)/S.L.cs*0.04);
    }
  }
  for(i=0;i<meteors.length;i++){
    var m=meteors[i];
    for(c=0;c<COLS;c++) add(c,m[1],base+Math.abs(c-m[0])*0.03);
    for(r=0;r<ROWS;r++) add(m[0],r,base+Math.abs(r-m[1])*0.03);
    S.streaks.push({c:m[0],r:m[1],age:0});
    S.g[m[0]][m[1]].meteor=false;
  }
  for(i=0;i<list.length;i++) S.g[list[i][0]][list[i][1]].pop=list[i][2];
  if(keep){ var ks=S.g[keep[0]][keep[1]]; ks.meteor=true; ks.sq=1; }
  burstChord(n);
  var mx=cx(ch[n-1][0]), my=cy(ch[n-1][1]);
  if(!scoring) return;

  var t=S.el;
  S.combo=(S.lastChain>-1&&t-S.lastChain<=CHAIN_GAP)?S.combo+1:1;
  S.lastChain=t;
  var mult=Math.min(6,S.combo);
  var pts=n*n*10*mult+(loop?50*Math.max(0,list.length-n):0)+meteors.length*150;
  api.addScore(pts);
  S.popped+=list.length+(keep?0:0);
  if(n>S.longest) S.longest=n;
  api.setSub(S.combo>=2?'연속 '+S.combo+' · ×'+mult:'');
  fx.text(mx,my-S.L.cs*0.7,'+'+U.fmt(pts),KINDS[k].d,n>=6?24:19,0.9,{stroke:'rgba(255,255,255,.9)'});

  var taper=Math.max(0.55,1-S.el/120), tb=(n>=6?1:0)+(loop?2:0);
  if(tb){
    var add2=tb*taper; S.rem=Math.min(DUR+20,S.rem+add2);
    fx.text(W/2,S.L.y0-14,'+'+add2.toFixed(1)+'초','#22a98f',18,1,{stroke:'rgba(255,255,255,.9)',delay:0.15});
  }
  if(loop){
    S.loops++;
    fx.text(W/2,cy(3),'별자리 완성!','#7b61e8',32,1.5,{stroke:'rgba(255,255,255,.95)',rise:14});
    fx.flash(0.5,'255,245,255'); fx.hitstop(0.06); fx.shake(6);
    var rings=['255,126,166','255,214,107','86,219,193','172,151,254'];
    for(i=0;i<4;i++) fx.ring(mx,my,W*0.75,rings[i],1.2,3,0.6,i*0.08);
    loopArp(); api.haptic(30);
  } else if(n>=6){
    fx.shake(2+n*0.3); fx.ring(mx,my,S.L.cs*3,KINDS[k].rgb,0.7,2.5,0.6); api.haptic(14);
  }
  if(keep){ fx.text(cx(keep[0]),cy(keep[1])-S.L.cs*1.2,'유성 별 등장!','#e3a52a',20,1.2,{stroke:'rgba(255,255,255,.9)',delay:0.2}); }
  if(meteors.length){ fx.text(W/2,cy(5),'유성 쓸기!','#ef7a4f',26,1.2,{stroke:'rgba(255,255,255,.9)'}); fx.hitstop(0.05); fx.shake(5);
    if(loud()) api.sfx.noise(0.5,0.12,{type:'bandpass',freq:2400,slide:600,q:1.2}); }
}

/* ---------- 메뉴 시연: 보이지 않는 손이 별을 잇는다 ---------- */
function autoPath(){
  for(var tries=0;tries<20;tries++){
    var c=Math.floor(Math.random()*COLS), r=Math.floor(Math.random()*ROWS), s=S.g[c][r];
    if(!s) continue;
    var path=[[c,r]], seen={}; seen[c+','+r]=1;
    var want=2+Math.floor(Math.random()*4);
    while(path.length<want){
      var last=path[path.length-1], nb=[[last[0]+1,last[1]],[last[0]-1,last[1]],[last[0],last[1]+1],[last[0],last[1]-1]], opts=[];
      for(var i=0;i<4;i++){ var q=nb[i]; if(q[0]<0||q[1]<0||q[0]>=COLS||q[1]>=ROWS||seen[q[0]+','+q[1]]) continue; if(S.g[q[0]][q[1]].k===s.k) opts.push(q); }
      if(!opts.length) break;
      var pick=opts[Math.floor(Math.random()*opts.length)]; seen[pick[0]+','+pick[1]]=1; path.push(pick);
    }
    if(path.length>=2) return path;
  }
  return null;
}

Arcade.register({
  id:'stars',
  title:'별자리 잇기',
  kicker:'PUZZLE · 60초 잇기',
  blurb:'같은 색 별을 쭉 이어서 별자리를 완성해요',
  lede:'같은 색 별을 손가락으로 쭉 이어 보세요. 길게 이을수록 점수가 쑥쑥, 네모로 닫으면 그 색 별이 한꺼번에 팡! 8개 넘게 이으면 유성 별이 생겨요.',
  how:'같은 색 별을 상하좌우로 끌어서 잇기 · 왔던 길로 되돌아가면 취소 · 고리로 닫으면 별자리 완성',
  lifeIcon:null,
  endDelay:1300,
  palette:{bg:'#f6efff',surface:'#ffffff',surface2:'#efe9ff',line:'#e3d9ff',text:'#21172b',muted:'#887176',
    accent:'#7b61e8',accentInk:'#ffffff',accentDeep:'#5a43c4',hot:'#ff5f92',hotText:'#ff5f92',hotRgb:'255,95,146',light:true},

  start:function(api){
    S={api:api,L:layout(api.H),chain:[],loop:false,loopAt:null,drag:false,px:0,py:0,
      el:0,rem:DUR,combo:0,lastChain:-1,longest:0,loops:0,popped:0,streaks:[],needCheck:false,
      ended:false,step:0,lastTick:-1,auto:null,autoT:0.8,popSnd:0};
    initBoard(api.state==='play'?api.rng:Math.random);
    if(api.state==='play'){ api.setMeter(1,'남은 시간 60.0초',false); api.setSub(''); }
  },
  update:function(dt,api){
    var fx=api.fx, c, r, s;
    S.L=layout(api.H);
    if(api.state==='play'&&!S.ended){
      S.el+=dt; S.rem-=dt;
      if(S.step===0&&S.el>=20){ S.step=1; fx.text(W/2,cy(2),'단계 2 · 새 색깔 별!','#ef7a4f',22,1.4,{stroke:'rgba(255,255,255,.9)'}); api.sfx.pluck(84,0.12); api.sfx.pluck(91,0.12,0.1); }
      if(S.step===1&&S.el>=40){ S.step=2; fx.text(W/2,cy(2),'단계 3 · 마지막 질주!','#ff5f92',22,1.4,{stroke:'rgba(255,255,255,.9)'}); api.sfx.pluck(86,0.12); api.sfx.pluck(93,0.12,0.1); }
      if(S.combo>0&&S.el-S.lastChain>CHAIN_GAP){ S.combo=0; api.setSub(''); }
      var rem=Math.max(0,S.rem);
      if(rem<10){ var sec=Math.ceil(rem); if(sec!==S.lastTick){ S.lastTick=sec; if(sec>0) api.sfx.tone(1200,0.05,'sine',0.05,{wet:false}); } }
      api.setMeter(rem/DUR,'남은 시간 '+rem.toFixed(1)+'초',rem<10);
      if(S.rem<=0){
        S.ended=true; S.drag=false; S.chain=[]; S.loop=false;
        api.setMeter(0,'시간 종료',true); api.setSub('');
        api.sfx.pluck(79,0.14); api.sfx.pluck(76,0.13,0.15); api.sfx.pluck(72,0.14,0.3);
        api.end();
      }
    }

    // 터지는 별
    S.popSnd=Math.max(0,S.popSnd-dt);
    var any=false;
    for(c=0;c<COLS;c++) for(r=0;r<ROWS;r++){
      s=S.g[c][r]; if(!s) { any=true; continue; }
      if(s.pop>=0){
        any=true; s.pop-=dt;
        if(s.pop<0){
          var K=KINDS[s.k], x=cx(c), y=cy(r);
          fx.burst(x,y,8,K.rgb,130,{size:[4,10],gravity:-40,life:0.7});
          fx.shards(x,y,4,K.c,120,S.L.cs*0.12,{gravity:300,life:0.7});
          fx.ring(x,y,S.L.cs*0.9,K.rgb,0.45,2,0.6);
          if(loud()&&S.popSnd<=0){ api.sfx.tone(900+r*40,0.06,'sine',0.04,{wet:false}); S.popSnd=0.035; }
          S.g[c][r]=null;
        }
      }
    }
    if(any){
      var still=false;
      for(c=0;c<COLS;c++) for(r=0;r<ROWS;r++){ s=S.g[c][r]; if(s&&s.pop>=0) still=true; }
      if(!still) collapse();
    }
    // 떨어지기
    for(c=0;c<COLS;c++) for(r=0;r<ROWS;r++){
      s=S.g[c][r]; if(!s) continue;
      if(s.fy<r){ s.vy+=60*dt; s.fy+=s.vy*dt; if(s.fy>=r){ s.fy=r; if(s.vy>3) s.sq=Math.min(1,s.vy/12); s.vy=0; } }
      s.sq=Math.max(0,s.sq-dt*4);
      s.sel+=((idxIn([c,r])>=0?1:0)-s.sel)*Math.min(1,dt*14);
    }
    if(S.needCheck&&settled()){ S.needCheck=false; ensureMoves(true); }
    for(var i=S.streaks.length-1;i>=0;i--){ S.streaks[i].age+=dt; if(S.streaks[i].age>0.5) S.streaks.splice(i,1); }

    // 시연
    if(api.state==='menu'||api.state==='over'){
      S.autoT-=dt;
      if(!S.auto&&S.autoT<=0&&settled()){
        var path=autoPath();
        if(path){ S.auto={path:path,i:1,t:0}; S.chain=[path[0]]; S.loop=false; }
        S.autoT=1.3;
      }
      if(S.auto){
        S.auto.t+=dt;
        var tgt=S.auto.path[Math.min(S.auto.i,S.auto.path.length-1)];
        S.px=cx(tgt[0]); S.py=cy(tgt[1]);
        if(S.auto.t>0.16){
          S.auto.t=0;
          if(S.auto.i<S.auto.path.length){ S.chain.push(S.auto.path[S.auto.i]); S.auto.i++; }
          else { if(S.chain.length>=2) resolve(api,false); S.chain=[]; S.auto=null; }
        }
      }
    }
  },
  draw:function(ctx,api){
    var H=api.H, t=api.t, L=S.L, cs=L.cs, c, r, s, i;
    drawSky(ctx,W,H,t);
    // 판
    ctx.save();
    ctx.shadowColor='rgba(123,97,232,.18)'; ctx.shadowBlur=24; ctx.shadowOffsetY=8;
    rr(ctx,L.x0-10,L.y0-10,cs*COLS+20,cs*ROWS+20,26);
    ctx.fillStyle='rgba(255,255,255,.72)'; ctx.fill();
    ctx.restore();
    rr(ctx,L.x0-10,L.y0-10,cs*COLS+20,cs*ROWS+20,26);
    ctx.strokeStyle='#e3d9ff'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='rgba(172,151,254,.10)';
    for(c=0;c<COLS;c++) for(r=0;r<ROWS;r++){ ctx.beginPath(); ctx.arc(cx(c),cy(r),cs*0.34,0,Math.PI*2); ctx.fill(); }

    // 유성 쓸기 줄기
    for(i=0;i<S.streaks.length;i++){
      var st=S.streaks[i], a=1-st.age/0.5;
      ctx.globalAlpha=a; ctx.fillStyle='#ffe6a0';
      ctx.fillRect(L.x0,cy(st.r)-cs*0.18*a,cs*COLS,cs*0.36*a);
      ctx.fillRect(cx(st.c)-cs*0.18*a,L.y0,cs*0.36*a,cs*ROWS);
      ctx.globalAlpha=1;
    }

    // 리본
    var ch=S.chain;
    if(ch.length){
      var K=KINDS[S.g[ch[0][0]][ch[0][1]]?S.g[ch[0][0]][ch[0][1]].k:0], n=ch.length;
      ctx.lineCap='round'; ctx.lineJoin='round';
      var pass=[[K.c,10+n*1.4,0.35],[K.c,5+n*0.5,1],['#ffffff',2,0.9]];
      for(var q=0;q<3;q++){
        ctx.globalAlpha=pass[q][2]; ctx.strokeStyle=pass[q][0]; ctx.lineWidth=pass[q][1];
        ctx.beginPath(); ctx.moveTo(cx(ch[0][0]),cy(ch[0][1]));
        for(i=1;i<n;i++) ctx.lineTo(cx(ch[i][0]),cy(ch[i][1]));
        if(S.loop&&S.loopAt) ctx.lineTo(cx(S.loopAt[0]),cy(S.loopAt[1]));
        else if(S.drag||S.auto) ctx.lineTo(S.px,S.py);
        ctx.stroke();
      }
      ctx.globalAlpha=1;
    }

    // 별
    for(c=0;c<COLS;c++) for(r=0;r<ROWS;r++){
      s=S.g[c][r]; if(!s) continue;
      var y=L.y0+(s.fy+0.5)*cs; if(y<L.y0-cs*0.6) continue;
      var sc=1+s.sel*0.14+(s.pop>=0?0.12*Math.sin((0.2-s.pop)*30):0);
      var sx=sc*(1+s.sq*0.16), sy=sc*(1-s.sq*0.14);
      var alpha=clamp((y-(L.y0-cs*0.6))/(cs*0.8),0,1);
      if(s.sel>0.05){ ctx.globalAlpha=0.5*s.sel; ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(cx(c),y,cs*0.48,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
      drawStar(ctx,s.k,cx(c),y,cs*0.38,sx,sy,alpha,s.meteor,t);
    }

    // 손가락 옆 개수 말풍선
    if(ch.length>=2&&(S.drag||S.auto)){
      var bx=clamp(S.px,40,W-40), by=Math.max(L.y0-6,S.py-cs*1.15), label='×'+ch.length+(S.loop?' 고리!':'');
      ctx.font='400 18px '+Arcade.fx.font;
      var tw=ctx.measureText(label).width+22;
      rr(ctx,bx-tw/2,by-15,tw,30,15); ctx.fillStyle='#ffffff'; ctx.fill();
      ctx.strokeStyle=KINDS[S.g[ch[0][0]][ch[0][1]].k].d; ctx.lineWidth=2; ctx.stroke();
      ctx.fillStyle=KINDS[S.g[ch[0][0]][ch[0][1]].k].d; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(label,bx,by+1);
    }
    if(S.auto){
      ctx.globalAlpha=0.55; ctx.fillStyle='#ffffff';
      ctx.beginPath(); ctx.arc(S.px+cs*0.22,S.py+cs*0.26,cs*0.2,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#ac97fe'; ctx.lineWidth=2; ctx.stroke(); ctx.globalAlpha=1;
    }
  },
  pointer:function(type,x,y,api){
    if(S.ended) return;
    S.px=x; S.py=y;
    if(type==='down'){
      S.drag=true; S.chain=[]; S.loop=false;
      if(!pending()){ var p=cellAt(x,y); if(p) startChain(p); }
    } else if(type==='move'){
      if(!S.drag||!api.pointerDown) return;
      if(!S.chain.length){ if(!pending()){ var p2=cellAt(x,y); if(p2) startChain(p2); } return; }
      extend(cellAt(x,y));
    } else if(type==='up'){
      S.drag=false;
      if(S.chain.length>=2) resolve(api,true);
      else S.chain=[];
    }
  },
  key:function(){ return false; },
  preview:function(ctx,w,h,t){
    drawSky(ctx,w,h,t);
    var cols=5, rows=4, cs=Math.min(w*0.82/cols,h*0.78/rows), x0=(w-cs*cols)/2, y0=(h-cs*rows)/2+4;
    var path=[[0,1],[1,1],[2,1],[2,2],[3,2],[4,2]];
    function onPath(c,r){ for(var i=0;i<path.length;i++) if(path[i][0]===c&&path[i][1]===r) return i; return -1; }
    var cyc=(t%3.2)/3.2, prog=Math.min(1,cyc/0.5), cnt=1+Math.floor(prog*(path.length-1));
    var burst=cyc>0.6?Math.min(1,(cyc-0.6)/0.2):0, back=cyc>0.85?(cyc-0.85)/0.15:0;
    function px(c){ return x0+(c+0.5)*cs; } function py(r){ return y0+(r+0.5)*cs; }
    if(burst===0){
      ctx.lineCap='round'; ctx.lineJoin='round';
      var pass=[['#ff7ea6',9,0.35],['#ff7ea6',5,1],['#ffffff',2,0.9]];
      for(var q=0;q<3;q++){
        ctx.globalAlpha=pass[q][2]; ctx.strokeStyle=pass[q][0]; ctx.lineWidth=pass[q][1];
        ctx.beginPath(); ctx.moveTo(px(path[0][0]),py(path[0][1]));
        for(var i=1;i<cnt;i++) ctx.lineTo(px(path[i][0]),py(path[i][1]));
        ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
    for(var c=0;c<cols;c++) for(var r=0;r<rows;r++){
      var pi=onPath(c,r), k=pi>=0?0:1+Math.floor(hh(c,r,2)*4), a=1, sc=1;
      if(pi>=0){
        if(pi<cnt&&burst===0) sc=1.14;
        if(burst>0){ a=back>0?back:Math.max(0,1-burst*1.3); sc=1+burst*0.5; }
      }
      if(a>0) drawStar(ctx,k,px(c),py(r),cs*0.36*sc,1,1,a,false,t);
      if(pi>=0&&burst>0&&burst<1){
        for(var j=0;j<3;j++) drawSpark(ctx,px(c)+Math.cos(j*2.1+pi)*cs*0.6*burst,py(r)+Math.sin(j*2.1+pi)*cs*0.6*burst,4,'#ff7ea6',1-burst,burst*3);
      }
    }
  },
  result:function(api){
    var line=S.loops>0?'별자리를 '+S.loops+'번 완성했어요! 밤하늘이 반짝반짝해요.':
      S.longest>=6?'긴 별줄기 멋졌어요! 다음엔 네모로 닫아 별자리를 만들어 봐요.':
      '같은 색 별을 이어 네모로 닫으면 그 색 별이 전부 터져요.';
    return {stats:[['최장 연결',S.longest],['별자리 완성',S.loops],['터뜨린 별',U.fmt(S.popped)]],line:line};
  }
});
})();

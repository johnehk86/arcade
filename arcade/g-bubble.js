/* 별방울 슈터: 끌어서 조준하고 놓아 쏘는 방울 퍼즐. 같은 색 3개 이상이면 터지고, 천장과 끊긴 방울은 우수수 떨어진다.
   격자는 육각 배치(넓은 줄 11개, 좁은 줄 10개). par로 맨 윗줄이 넓은지 좁은지 정한다. */
(function(){
'use strict';
var U=Arcade.util, clamp=U.clamp, easeOutBack=U.easeOutBack;
var W=360, R=16, RH=R*Math.sqrt(3), TOP=132, SPEED=900;
var COLORS=[
  {fill:'#ff7ea6',deep:'#e0507f',rgb:'255,95,146',sym:'heart'},
  {fill:'#ac97fe',deep:'#7d63d6',rgb:'125,99,214',sym:'star'},
  {fill:'#56dbc1',deep:'#1fae95',rgb:'31,174,149',sym:'flower'},
  {fill:'#ffd66b',deep:'#e0a92a',rgb:'224,169,42',sym:'diamond'},
  {fill:'#8fd3ff',deep:'#3d9be9',rgb:'61,155,233',sym:'drop'},
  {fill:'#ffb38a',deep:'#e5794a',rgb:'229,121,74',sym:'moon'},
  {fill:'#d9cfe0',deep:'#a497ad',rgb:'164,151,173',sym:null}   // 끝날 때 쓰는 회색
];
var GRAY=6, PENT=[0,2,4,7,9];
var S=null;

/* ---------- 방울 스프라이트: 색마다 한 번만 그려 둔다 ---------- */
var sprites=[];
function symbol(g,s,cx,cy,r){
  g.beginPath();
  if(s==='heart'){ g.moveTo(cx,cy+r*0.85); g.bezierCurveTo(cx-r*1.3,cy-r*0.1,cx-r*0.6,cy-r*1.1,cx,cy-r*0.35); g.bezierCurveTo(cx+r*0.6,cy-r*1.1,cx+r*1.3,cy-r*0.1,cx,cy+r*0.85); }
  else if(s==='star'){ for(var i=0;i<10;i++){ var a=-Math.PI/2+i*Math.PI/5, rr=i%2?r*0.45:r; g.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr); } g.closePath(); }
  else if(s==='flower'){ for(var k=0;k<5;k++){ var b=-Math.PI/2+k*Math.PI*2/5, px=cx+Math.cos(b)*r*0.55, py=cy+Math.sin(b)*r*0.55; g.moveTo(px+r*0.42,py); g.arc(px,py,r*0.42,0,Math.PI*2); } }
  else if(s==='diamond'){ g.moveTo(cx,cy-r); g.lineTo(cx+r*0.75,cy); g.lineTo(cx,cy+r); g.lineTo(cx-r*0.75,cy); g.closePath(); }
  else if(s==='moon'){ g.arc(cx,cy,r*0.9,Math.PI*0.4,Math.PI*1.6,false); g.arc(cx+r*0.38,cy,r*0.72,Math.PI*1.45,Math.PI*0.55,true); g.closePath(); }
  else if(s==='drop'){ g.moveTo(cx,cy-r); g.bezierCurveTo(cx+r*0.9,cy,cx+r*0.7,cy+r*0.95,cx,cy+r*0.9); g.bezierCurveTo(cx-r*0.7,cy+r*0.95,cx-r*0.9,cy,cx,cy-r); }
  g.fill();
}
function sprite(ci){
  if(sprites[ci]) return sprites[ci];
  var c=document.createElement('canvas'); c.width=c.height=72;
  var g=c.getContext('2d'), col=COLORS[ci], cx=36, cy=36, r=32;
  var gr=g.createRadialGradient(cx-10,cy-12,2,cx,cy,r);
  gr.addColorStop(0,'#ffffff'); gr.addColorStop(0.3,col.fill); gr.addColorStop(1,col.deep);
  g.globalAlpha=0.94; g.fillStyle=gr; g.beginPath(); g.arc(cx,cy,r,0,Math.PI*2); g.fill();
  g.globalAlpha=1; g.lineWidth=2; g.strokeStyle='rgba(255,255,255,.6)'; g.beginPath(); g.arc(cx,cy,r-1.5,0,Math.PI*2); g.stroke();
  g.fillStyle='rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(cx-11,cy-15,9,5,-0.6,0,Math.PI*2); g.fill();
  g.fillStyle='rgba(255,255,255,.55)'; g.beginPath(); g.arc(cx+13,cy+13,2.6,0,Math.PI*2); g.fill();
  if(col.sym){ g.fillStyle='rgba(255,255,255,.93)'; symbol(g,col.sym,cx,cy+2,11); }
  sprites[ci]=c; return c;
}
function drawBubble(ctx,x,y,ci,r,alpha,rot){
  var sz=72*(r/32);
  ctx.globalAlpha=alpha==null?1:alpha;
  if(rot){ ctx.save(); ctx.translate(x,y); ctx.rotate(rot); ctx.drawImage(sprite(ci),-sz/2,-sz/2,sz,sz); ctx.restore(); }
  else ctx.drawImage(sprite(ci),x-sz/2,y-sz/2,sz,sz);
  ctx.globalAlpha=1;
}

/* ---------- 하늘 배경: 파스텔 그라데이션, 구름, 반짝이 (꾸밈이라 Math.random) ---------- */
var clouds=[], sparks=[];
for(var i=0;i<6;i++) clouds.push({x:Math.random(),y:0.08+Math.random()*0.8,s:0.6+Math.random()*0.8,sp:0.006+Math.random()*0.01});
for(i=0;i<22;i++) sparks.push({x:Math.random(),y:Math.random(),ph:Math.random()*6.28,s:2+Math.random()*3});
function drawCloud(ctx,x,y,s){
  ctx.fillStyle='rgba(255,255,255,.72)';
  ctx.beginPath();
  ctx.arc(x,y,16*s,0,Math.PI*2); ctx.arc(x+18*s,y-8*s,20*s,0,Math.PI*2); ctx.arc(x+40*s,y,15*s,0,Math.PI*2);
  ctx.arc(x+20*s,y+6*s,16*s,0,Math.PI*2);
  ctx.fill();
}
function drawSpark(ctx,x,y,s,a){
  ctx.globalAlpha=a; ctx.fillStyle='#ffffff';
  ctx.beginPath(); ctx.moveTo(x,y-s*2); ctx.lineTo(x+s*0.5,y-s*0.5); ctx.lineTo(x+s*2,y); ctx.lineTo(x+s*0.5,y+s*0.5);
  ctx.lineTo(x,y+s*2); ctx.lineTo(x-s*0.5,y+s*0.5); ctx.lineTo(x-s*2,y); ctx.lineTo(x-s*0.5,y-s*0.5); ctx.closePath(); ctx.fill();
  ctx.globalAlpha=1;
}
function drawSky(ctx,w,h,t,danger){
  var g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#ffe3f0'); g.addColorStop(0.55,'#f3e6ff'); g.addColorStop(1,'#e3f6ff');
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  var k=w/W;
  for(var j=0;j<clouds.length;j++){
    var c=clouds[j], cx=(((c.x+t*c.sp)%1.35)-0.2)*w;
    drawCloud(ctx,cx,c.y*h,c.s*k);
  }
  for(j=0;j<sparks.length;j++){
    var p=sparks[j], a=0.25+0.55*(0.5+0.5*Math.sin(t*2+p.ph));
    drawSpark(ctx,p.x*w,p.y*h,p.s*Math.max(0.6,k),a);
  }
  if(danger>0){ ctx.fillStyle='rgba(255,95,146,'+(danger*0.12)+')'; ctx.fillRect(0,0,w,h); }
}
function drawBunny(ctx,bx,by,s,t){
  var bob=Math.sin(t*3)*1.2*s;
  by+=bob;
  ctx.save();
  ctx.fillStyle='rgba(119,17,60,.12)'; ctx.beginPath(); ctx.ellipse(bx,by+21*s,20*s,5*s,0,0,Math.PI*2); ctx.fill();
  for(var e=-1;e<=1;e+=2){
    ctx.save(); ctx.translate(bx+e*9*s,by-24*s); ctx.rotate(e*0.22+Math.sin(t*2.2+e)*0.05);
    ctx.fillStyle='#ffffff'; ctx.strokeStyle='#f3c9da'; ctx.lineWidth=1.5*s;
    ctx.beginPath(); ctx.ellipse(0,-6*s,6.5*s,15*s,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#ffb1c5'; ctx.beginPath(); ctx.ellipse(0,-5*s,3.2*s,10*s,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle='#ffffff'; ctx.strokeStyle='#f3c9da'; ctx.lineWidth=1.5*s;
  ctx.beginPath(); ctx.arc(bx,by,20*s,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#3f001b';
  ctx.beginPath(); ctx.arc(bx-7*s,by-2*s,2.3*s,0,Math.PI*2); ctx.arc(bx+7*s,by-2*s,2.3*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,126,166,.55)';
  ctx.beginPath(); ctx.ellipse(bx-12*s,by+5*s,4*s,2.5*s,0,0,Math.PI*2); ctx.ellipse(bx+12*s,by+5*s,4*s,2.5*s,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#a3365d'; ctx.lineWidth=1.3*s; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(bx-3*s,by+4*s); ctx.quadraticCurveTo(bx-1.5*s,by+6.5*s,bx,by+4.5*s); ctx.quadraticCurveTo(bx+1.5*s,by+6.5*s,bx+3*s,by+4*s); ctx.stroke();
  ctx.restore();
}

/* ---------- 격자 ---------- */
function rnd(api){ return api.state==='play'?api.rng():Math.random(); }
function wide(r){ return ((r+S.par)&1)===0; }
function cols(r){ return wide(r)?11:10; }
function cellX(r,c){ return (wide(r)?R+4:2*R+4)+c*2*R; }
function cellY(r){ return TOP+S.offY+r*RH; }
function get(r,c){ var row=S.rows[r]; return row?row[c]||null:null; }
function emptyRow(){ var a=[]; for(var c=0;c<11;c++) a.push(null); return a; }
function nbrs(r,c){
  var w=wide(r), a=w?c-1:c, b=w?c:c+1;
  return [[r,c-1],[r,c+1],[r-1,a],[r-1,b],[r+1,a],[r+1,b]].filter(function(p){ return p[0]>=0&&p[1]>=0&&p[1]<cols(p[0]); });
}
function hasNb(r,c){ return nbrs(r,c).some(function(p){ return !!get(p[0],p[1]); }); }
function each(fn){ for(var r=0;r<S.rows.length;r++) for(var c=0;c<11;c++){ var b=S.rows[r][c]; if(b) fn(b,r,c); } }
function count(){ var n=0; each(function(){ n++; }); return n; }
function presentColors(){ var seen={}, out=[]; each(function(b){ if(!seen[b.c]){ seen[b.c]=1; out.push(b.c); } }); return out; }
function pickColor(api){
  var p=presentColors();
  if(!p.length){ for(var k=0;k<S.colorsN;k++) p.push(k); }
  p.sort(function(a,b){ return a-b; });
  return p[Math.floor(rnd(api)*p.length)];
}
function genRow(api,r,near){
  var row=emptyRow(), n=cols(r);
  for(var c=0;c<n;c++){
    var ci=Math.floor(rnd(api)*S.colorsN), roll=rnd(api);
    if(c>0&&roll<0.38&&row[c-1]) ci=row[c-1].c;
    else if(near&&roll<0.62){ var nb=near[Math.min(c,10)]||near[Math.max(0,c-1)]; if(nb) ci=nb.c; }
    row[c]={c:ci,w:0,sq:0};
  }
  return row;
}
function initBoard(api,n){
  S.rows=[]; S.par=0; S.offY=0;
  for(var r=0;r<n;r++) S.rows.push(genRow(api,r,r>0?S.rows[r-1]:null));
}
function trimRows(){ while(S.rows.length&&!S.rows[S.rows.length-1].some(function(b){ return !!b; })) S.rows.pop(); }
function lowestY(){ var y=-1; for(var r=S.rows.length-1;r>=0;r--){ if(S.rows[r].some(function(b){ return !!b; })){ y=TOP+r*RH; break; } } return y; }

/* 공 위치에서 부딪혔는지: 천장이거나 근처 방울과 겹침 */
function hitTest(x,y){
  if(y-R<=TOP+S.offY) return true;
  var ra=Math.round((y-TOP-S.offY)/RH), lim=(2*R*0.86)*(2*R*0.86);
  for(var r=Math.max(0,ra-1);r<=Math.min(S.rows.length-1,ra+1);r++){
    for(var c=0;c<cols(r);c++){
      if(!S.rows[r][c]) continue;
      var dx=cellX(r,c)-x, dy=cellY(r)-y;
      if(dx*dx+dy*dy<lim) return true;
    }
  }
  return false;
}
/* 가장 가까운 빈 칸(천장 줄이거나 이웃이 있는 칸) */
function snapCell(x,y){
  var best=null, bd=1e9, ra=clamp(Math.round((y-TOP-S.offY)/RH),0,S.rows.length);
  function scan(r0,r1){
    for(var r=r0;r<=r1;r++){
      for(var c=0;c<cols(r);c++){
        if(get(r,c)) continue;
        if(r!==0&&!hasNb(r,c)) continue;
        var dx=cellX(r,c)-x, dy=cellY(r)-y, d=dx*dx+dy*dy;
        if(d<bd){ bd=d; best=[r,c]; }
      }
    }
  }
  scan(Math.max(0,ra-1),Math.min(S.rows.length,ra+1));
  if(!best) scan(0,S.rows.length);
  return best;
}

/* ---------- 소리 ---------- */
function snd(api){ return api.state==='play'?api.sfx:null; }
function popNote(api,i){
  var s=snd(api); if(!s) return;
  var m=Math.min(100,72+PENT[i%5]+12*Math.floor(i/5)), f=s.mtof(m);
  s.tone(f,0.13,'sine',0.11,{slide:f*1.5,wet:false});
  s.noise(0.04,0.035,{type:'highpass',freq:3200});
  if(i%3===0) s.pluck(m,0.07);
}

/* ---------- 발사와 판정 ---------- */
function origin(api){ return {x:W/2,y:api.H-84}; }
function dangerY(api){ return api.H-120; }
// 빗나간 몇 발마다 새 줄이 내려오는지: 점수와 쏜 수가 늘수록 줄어든다(최소 3발)
function missLimit(api){ var s=api.score; return Math.max(3,(s<3000?6:s<8000?5:4)-Math.floor(S.shots/45)); }
// 60초가 지나면 쏘지 않아도 일정 시간마다 줄이 내려온다
function rowEvery(){ return S.playT<60?0:Math.max(7,18-(S.playT-60)*0.06); }
function unlockColors(api){
  var want=(api.score>=6000||S.shots>=70)?6:(api.score>=1500||S.shots>=25)?5:4;
  if(want>S.colorsN){
    S.colorsN=want;
    api.fx.text(W/2,api.H*0.44,want===5?'새 색깔 등장 · 하늘 방울!':'새 색깔 등장 · 노을 방울!',COLORS[want-1].deep,24,1.6,{rise:14,stroke:'rgba(255,255,255,.95)'});
    api.fx.ring(W/2,api.H*0.44,W*0.5,COLORS[want-1].rgb,1,2,0.5);
    api.sfx.pluck(79,0.12); api.sfx.pluck(84,0.12,0.1); api.sfx.pluck(88,0.13,0.2);
  }
}

function fire(api){
  if(S.shot||S.over) return;
  var o=origin(api);
  S.shot={x:o.x,y:o.y,vx:Math.cos(S.aim)*SPEED,vy:Math.sin(S.aim)*SPEED,c:S.cur,trail:[]};
  S.cur=S.next; S.next=pickColor(api); S.shots++; S.launchT=api.t;
  var s=snd(api); if(s){ s.noise(0.13,0.12,{type:'bandpass',freq:1900,slide:600,q:1.4}); s.tone(420,0.08,'triangle',0.05,{slide:700,wet:false}); }
}
function setAim(api,x,y){
  var o=origin(api), dx=x-o.x, dy=Math.min(y-o.y,-8);
  S.aim=clamp(Math.atan2(dy,dx),-Math.PI+0.16,-0.16);
}
function place(api,cell,ci){
  var r=cell[0], c=cell[1];
  while(S.rows.length<=r) S.rows.push(emptyRow());
  S.rows[r][c]={c:ci,w:0,sq:1};
  nbrs(r,c).forEach(function(p){ var b=get(p[0],p[1]); if(b) b.w=1; });
  var s=snd(api); if(s) s.tone(520,0.06,'sine',0.05,{wet:false});
  resolve(api,r,c);
}
function resolve(api,r0,c0){
  var fx=api.fx, play=api.state==='play', start=get(r0,c0), color=start.c;
  // 같은 색 묶음 찾기 (깊이 = 터지는 순서)
  var seen={}, q=[[r0,c0,0]], cluster=[];
  seen[r0+','+c0]=1;
  while(q.length){
    var cur=q.shift(); cluster.push(cur);
    nbrs(cur[0],cur[1]).forEach(function(p){ var k=p[0]+','+p[1], b=get(p[0],p[1]); if(!seen[k]&&b&&b.c===color){ seen[k]=1; q.push([p[0],p[1],cur[2]+1]); } });
  }
  if(cluster.length>=3){
    if(play){ S.combo++; if(S.combo>S.maxCombo) S.maxCombo=S.combo; }
    var mult=Math.min(5,Math.max(1,S.combo));
    cluster.forEach(function(p,i){
      S.pops.push({x:cellX(p[0],p[1]),y:cellY(p[0]),c:color,t:p[2]*0.045+0.02,i:i,pts:play?10*mult:0});
      S.rows[p[0]][p[1]]=null;
    });
    if(play) S.popped+=cluster.length;
    // 천장과 끊긴 방울은 떨어진다
    var keep={}, fq=[];
    for(var c=0;c<cols(0);c++){ if(get(0,c)){ keep['0,'+c]=1; fq.push([0,c]); } }
    while(fq.length){
      var f=fq.shift();
      nbrs(f[0],f[1]).forEach(function(p){ var k=p[0]+','+p[1]; if(!keep[k]&&get(p[0],p[1])){ keep[k]=1; fq.push(p); } });
    }
    var drops=0, sx=0, sy=0;
    each(function(b,r,c){
      if(keep[r+','+c]) return;
      var x=cellX(r,c), y=cellY(r);
      S.falls.push({x:x,y:y,vx:(rnd(api)-0.5)*160,vy:-120-rnd(api)*160,rot:0,vr:(rnd(api)-0.5)*10,c:b.c});
      S.rows[r][c]=null; drops++; sx+=x; sy+=y;
    });
    if(drops>0){
      var bonus=Math.round(20*drops*Math.pow(2,Math.min(drops,10)/4))*mult;
      if(play){ S.dropped+=drops; api.addScore(bonus); }
      fx.text(sx/drops,sy/drops,'+'+U.fmt(bonus),'#634eb0',drops>=6?26:20,1.1,{stroke:'rgba(255,255,255,.95)'});
      var s=snd(api);
      if(s) for(var k=0;k<Math.min(drops,8);k++) s.pluck(96-k*2-(k%2)*3,0.08,0.18+k*0.05);
      if(drops>=6){
        fx.text(W/2,api.H*0.42,'우수수!','#ff5f92',34,1.3,{stroke:'rgba(255,255,255,.95)',rise:14});
        fx.hitstop(0.05); fx.flash(0.5,'255,240,250'); fx.shake(5); api.haptic(25);
      } else fx.shake(2);
    }
    if(play&&S.combo>=2) fx.text(W/2,api.H*0.5,'콤보 ×'+mult,'#ac97fe',22,0.9,{stroke:'rgba(255,255,255,.95)'});
    api.haptic(8);
  } else {
    if(play){ S.combo=0; S.misses++; }
  }
  trimRows();
  if(api.state==='play') unlockColors(api);
  // 판을 모두 비우면 보너스와 함께 새 판
  if(count()===0){
    if(play){
      api.addScore(1000);
      fx.text(W/2,api.H*0.38,'완전 정리!','#1fae95',32,1.5,{stroke:'rgba(255,255,255,.95)',rise:14});
      fx.flash(0.7,'255,250,255'); fx.burst(W/2,api.H*0.4,40,'255,95,146',260,{size:[6,14],life:1.1});
      var s2=snd(api); if(s2) for(var j=0;j<6;j++) s2.pluck(72+PENT[j%5]+12*Math.floor(j/5),0.12,j*0.07);
    }
    initBoard(api,5); S.offY=-RH*5;
  } else if(play&&S.misses>=missLimit(api)){
    S.misses=0; pushRow(api);
  }
  if(!presentColors().some(function(x){ return x===S.cur; })) S.cur=pickColor(api);
  if(!presentColors().some(function(x){ return x===S.next; })) S.next=pickColor(api);
  updateHud(api);
  var ly=lowestY();
  if(ly>=0&&ly+R>dangerY(api)) gameOver(api);
}
function pushRow(api){
  S.par^=1;
  S.rows.unshift(genRow(api,0,S.rows[0]||null));
  S.offY-=RH;
  var s=snd(api); if(s) s.tone(160,0.25,'sine',0.12,{slide:105});
  api.fx.shake(2);
}
function gameOver(api){
  if(api.state!=='play'){ initBoard(api,6); return; }
  S.over=true;
  var list=[];
  each(function(b,r,c){ list.push({x:cellX(r,c),y:cellY(r),r:r}); });
  list.sort(function(a,b){ return b.y-a.y; });
  list.forEach(function(p,i){ S.pops.push({x:p.x,y:p.y,c:GRAY,t:0.15+i*0.018,i:i,pts:0,sad:true}); });
  S.rows=[];
  var s=api.sfx; s.pluck(76,0.14); s.pluck(72,0.13,0.2); s.pluck(67,0.12,0.4); s.pluck(64,0.14,0.65);
  api.setMeter(null); api.setSub('');
  api.fx.shake(4); api.haptic(40);
  api.end();
}
function updateHud(api){
  if(api.state!=='play') return;
  api.setSub(S.combo>=2?'콤보 ×'+Math.min(5,S.combo):'');
  var lim=missLimit(api), left=lim-S.misses, ev=rowEvery();
  if(ev>0){ var sec=Math.max(0,ev-S.rowT); api.setMeter(Math.min(left/lim,sec/ev),'새 줄까지 '+left+'발 · '+sec.toFixed(0)+'초',left<=1||sec<3); }
  else api.setMeter(left/lim,'새 줄까지 '+left+'발',left<=1);
}
function computeGuide(api){
  var o=origin(api), x=o.x, y=o.y, vx=Math.cos(S.aim), vy=Math.sin(S.aim), pts=[], bounces=0;
  for(var i=0;i<420;i++){
    x+=vx*5; y+=vy*5;
    if(x<R){ x=R; vx=-vx; bounces++; } else if(x>W-R){ x=W-R; vx=-vx; bounces++; }
    if(bounces>2) break;
    if(hitTest(x,y)){ S.guide={pts:pts,ghost:snapCell(x,y)}; return; }
    if(i%3===2) pts.push(x,y);
  }
  S.guide={pts:pts,ghost:null};
}

/* ---------- 메뉴 시연: 노출된 방울을 겨냥해 자동으로 쏜다 ---------- */
function attract(api){
  if(S.shot||api.t<S.attractAt) return;
  S.attractAt=api.t+1.05;
  if(count()===0||S.rows.length<2){ initBoard(api,6); return; }
  var targets=[];
  each(function(b,r,c){ if(!get(r+1,wide(r)?c:c)||!get(r+1,wide(r)?c-1:c+1)) targets.push([r,c,b.c]); });
  if(!targets.length) return;
  var tg=targets[Math.floor(Math.random()*targets.length)], o=origin(api);
  if(Math.random()<0.7) S.cur=tg[2];
  S.aim=clamp(Math.atan2(cellY(tg[0])+RH-o.y,cellX(tg[0],tg[1])-o.x)+(Math.random()-0.5)*0.06,-Math.PI+0.16,-0.16);
  fire(api);
}

Arcade.register({
  id:'bubble',
  title:'별방울 슈터',
  kicker:'조준 · 퍼즐 슈팅',
  blurb:'같은 색 셋이면 퐁! 끊긴 방울은 우수수',
  lede:'토끼 루루가 별방울을 쏘아 올려요. 같은 색을 3개 이상 붙이면 터지고, 천장과 끊어진 방울은 한꺼번에 떨어져 큰 점수가 돼요.',
  how:'끌어서 조준 · 손을 떼면 발사 · 오른쪽 아래 다음 방울을 탭하면 바꾸기 · 키보드 ←→ 조준, 스페이스 발사',
  lifeIcon:null,
  endDelay:1500,
  palette:{bg:'#fff6fb',surface:'#ffffff',surface2:'#fbf0ff',line:'#f3d3e3',text:'#21172b',muted:'#887176',
    accent:'#3d9be9',accentInk:'#ffffff',accentDeep:'#2a74b8',hot:'#ff5f92',hotText:'#ff5f92',hotRgb:'255,95,146',light:true},

  start:function(api){
    S={rows:[],par:0,offY:0,shot:null,cur:0,next:0,aim:-Math.PI/2,aiming:false,kb:false,guide:null,
      pops:[],falls:[],combo:0,maxCombo:0,popped:0,dropped:0,misses:0,shots:0,colorsN:4,over:false,attractAt:api.t+0.6,launchT:-9,playT:0,rowT:0,hudT:0};
    initBoard(api,6);
    S.cur=pickColor(api); S.next=pickColor(api);
    if(api.state==='play'){ api.setSub(''); updateHud(api); }
  },
  update:function(dt,api){
    var fx=api.fx, k;
    S.offY=Math.min(0,S.offY+dt*RH*5);
    if(api.state==='menu'||api.state==='over') attract(api);
    if(api.state==='play'&&!S.over){
      S.playT+=dt;
      var ev=rowEvery();
      if(ev>0){
        S.rowT+=dt;
        if(S.rowT>=ev&&!S.shot){
          S.rowT=0; pushRow(api);
          var ly0=lowestY(); if(ly0>=0&&ly0+R>dangerY(api)) gameOver(api);
        }
        S.hudT-=dt; if(S.hudT<=0&&!S.over){ S.hudT=0.25; updateHud(api); }
      }
    }
    // 날아가는 방울
    var sh=S.shot;
    if(sh){
      var steps=Math.ceil(SPEED*dt/4);
      for(k=0;k<steps;k++){
        sh.x+=sh.vx*dt/steps; sh.y+=sh.vy*dt/steps;
        if(sh.x<R){ sh.x=R; sh.vx=-sh.vx; } else if(sh.x>W-R){ sh.x=W-R; sh.vx=-sh.vx; }
        if(hitTest(sh.x,sh.y)){
          S.shot=null;
          var cell=snapCell(sh.x,sh.y);
          if(cell) place(api,cell,sh.c);
          break;
        }
      }
      if(S.shot){ sh.trail.unshift(sh.x,sh.y); if(sh.trail.length>10) sh.trail.length=10; }
    }
    // 터지는 방울
    for(k=S.pops.length-1;k>=0;k--){
      var p=S.pops[k]; p.t-=dt;
      if(p.t>0) continue;
      var col=COLORS[p.c];
      fx.ring(p.x,p.y,R*2.6,col.rgb,0.5,2.5,0.7);
      fx.burst(p.x,p.y,p.sad?4:9,col.rgb,p.sad?70:170,{size:[4,9],life:0.7});
      if(!p.sad) fx.shards(p.x,p.y,4,col.fill,140,4,{life:0.6});
      if(p.pts>0) api.addScore(p.pts);
      if(p.sad){ if(p.i%4===0&&api.state!=='menu') api.sfx.tone(300-Math.min(p.i,40)*3,0.12,'sine',0.04,{wet:false}); }
      else popNote(api,p.i);
      S.pops.splice(k,1);
    }
    // 떨어지는 방울
    for(k=S.falls.length-1;k>=0;k--){
      var f=S.falls[k]; f.vy+=1400*dt; f.x+=f.vx*dt; f.y+=f.vy*dt; f.rot+=f.vr*dt;
      if(f.y>api.H+40){ S.falls.splice(k,1); fx.burst(clamp(f.x,10,W-10),api.H-6,3,COLORS[f.c].rgb,90,{size:[3,7],life:0.5,gravity:200}); }
    }
    // 흔들림 감쇠
    var decay=Math.exp(-dt*6);
    each(function(b){ b.w*=decay; b.sq*=Math.exp(-dt*9); });
    if(api.state==='play'&&!S.shot&&(S.aiming||S.kb)) computeGuide(api); else S.guide=null;
  },
  draw:function(ctx,api){
    var t=api.t, H=api.H, k, ly=lowestY(), dy=dangerY(api);
    var danger=(api.state==='play'&&ly>=0)?clamp(1-(dy-(ly+R))/(RH*2.2),0,1):0;
    drawSky(ctx,W,H,t,danger*(0.6+0.4*Math.sin(t*6)));
    // 천장 리본
    ctx.fillStyle='rgba(255,255,255,.55)'; ctx.fillRect(0,TOP-R-8,W,3);
    // 위험선
    ctx.setLineDash([6,6]); ctx.lineWidth=2;
    ctx.strokeStyle='rgba(255,95,146,'+(0.3+danger*0.6)+')';
    ctx.beginPath(); ctx.moveTo(10,dy); ctx.lineTo(W-10,dy); ctx.stroke(); ctx.setLineDash([]);
    // 조준선과 착지 예상
    if(S.guide){
      var g=S.guide, gc=COLORS[S.cur];
      for(k=0;k<g.pts.length;k+=2){
        ctx.globalAlpha=Math.max(0.15,0.85-k/g.pts.length*0.7);
        ctx.fillStyle=gc.deep; ctx.beginPath(); ctx.arc(g.pts[k],g.pts[k+1],k%4===0?3:2,0,Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha=1;
      if(g.ghost) drawBubble(ctx,cellX(g.ghost[0],g.ghost[1]),cellY(g.ghost[0]),S.cur,R,0.35);
    }
    // 판
    for(var r=0;r<S.rows.length;r++){
      for(var c=0;c<cols(r);c++){
        var b=S.rows[r][c]; if(!b) continue;
        var wob=Math.sin(t*28+r+c)*b.w*2.4, sc=1+b.sq*0.18*Math.sin(b.sq*9);
        drawBubble(ctx,cellX(r,c),cellY(r)+wob,b.c,R*sc,1);
      }
    }
    for(k=0;k<S.pops.length;k++){
      var p=S.pops[k], grow=1+Math.max(0,0.12-p.t)*1.6;
      drawBubble(ctx,p.x,p.y,p.c,R*grow,1);
    }
    for(k=0;k<S.falls.length;k++){ var f=S.falls[k]; drawBubble(ctx,f.x,f.y,f.c,R,1,f.rot); }
    if(S.shot){
      var sh=S.shot;
      for(k=2;k<sh.trail.length;k+=2) drawBubble(ctx,sh.trail[k],sh.trail[k+1],sh.c,R*(1-k*0.05),0.22);
      drawBubble(ctx,sh.x,sh.y,sh.c,R,1);
    }
    // 발사대: 토끼 루루와 현재/다음 방울
    var o=origin(api), kick=clamp((t-S.launchT)/0.25,0,1);
    drawBunny(ctx,W/2,H-44,1,t);
    if(!S.over){
      ctx.strokeStyle='rgba(99,78,176,.55)'; ctx.lineWidth=3; ctx.lineCap='round';
      var ax=o.x+Math.cos(S.aim)*(R+6), ay=o.y+Math.sin(S.aim)*(R+6);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(o.x+Math.cos(S.aim)*(R+16),o.y+Math.sin(S.aim)*(R+16)); ctx.stroke();
      drawBubble(ctx,o.x,o.y,S.cur,R*(0.7+0.3*easeOutBack(kick)),1);
      drawBubble(ctx,W/2+72,H-50,S.next,R*0.72,0.95);
      ctx.fillStyle='#887176'; ctx.font='13px "Jua","Quicksand",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('다음',W/2+72,H-28);
    }
  },
  pointer:function(type,x,y,api){
    if(S.over) return;
    if(type==='down'){
      if(!S.shot&&Math.hypot(x-(W/2+72),y-(api.H-50))<26){
        var tmp=S.cur; S.cur=S.next; S.next=tmp; api.sfx.tone(880,0.08,'sine',0.06,{slide:1320,wet:false}); return;
      }
      S.aiming=true; S.kb=false; setAim(api,x,y);
    } else if(type==='move'){
      if(S.aiming&&api.pointerDown) setAim(api,x,y);
    } else if(type==='up'){
      if(!S.aiming) return;
      S.aiming=false; setAim(api,x,y); fire(api);
    }
  },
  key:function(type,code,api){
    if(type!=='down') return code==='ArrowLeft'||code==='ArrowRight'||code==='Space';
    if(code==='ArrowLeft'){ S.kb=true; S.aim=clamp(S.aim-0.05,-Math.PI+0.16,-0.16); return true; }
    if(code==='ArrowRight'){ S.kb=true; S.aim=clamp(S.aim+0.05,-Math.PI+0.16,-0.16); return true; }
    if(code==='Space'||code==='Enter'){ fire(api); return true; }
    return false;
  },
  preview:function(ctx,w,h,t){
    drawSky(ctx,w,h,t,0);
    var r=Math.min(w/17,h/11), rh=r*Math.sqrt(3), top=h*0.16, n=Math.floor((w-8)/(2*r));
    var ph=(t%3.4)/3.4, tr=2, tc=Math.floor(n/2)-1;
    // 터질 묶음: 2줄 tc, tc+1 / 1줄 tc (분홍)
    function inCluster(row,c){ return (row===2&&(c===tc||c===tc+1))||(row===1&&c===tc); }
    var shotCell=[2,tc+2];
    for(var row=0;row<4;row++){
      var odd=row%2===1, cnt=odd?n-1:n, x0=(w-(n*2*r))/2+r+(odd?r:0);
      for(var c=0;c<cnt;c++){
        var x=x0+c*2*r, y=top+row*rh, ci=(row*7+c*3+((c*row)%4))%4;
        var cl=inCluster(row,c)||(row===shotCell[0]&&c===shotCell[1]);
        if(row===3&&c>=tc-1&&c<=tc+3) continue;
        if(row===shotCell[0]&&c===shotCell[1]){ if(ph<0.38||ph>0.4) continue; }
        if(cl){
          if(ph>0.4&&ph<0.78) continue;
          var a=ph>=0.78?(ph-0.78)/0.22:1;
          drawBubble(ctx,x,y,0,r,a);
        } else drawBubble(ctx,x,y,ci,r,1);
      }
      if(row===2) var sx=x0+shotCell[1]*2*r, sy=top+2*rh, px=x0, py=y;
    }
    var bx=w/2, by=h-r*2.2;
    if(ph<0.38){
      var k=ph/0.38;
      drawBubble(ctx,bx+(sx-bx)*k,by-r*2+(sy-by+r*2)*k,0,r,1);
    }
    if(ph>0.4&&ph<0.62){
      var q=(ph-0.4)/0.22;
      ctx.strokeStyle='rgba(255,95,146,'+(1-q)+')'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.arc(sx-r*2,sy-rh*0.5,r*(1+q*3),0,Math.PI*2); ctx.stroke();
      for(var j=0;j<10;j++){ var an=j*0.63+1, d=r*(1+q*3.2); drawSpark(ctx,sx-r*2+Math.cos(an)*d,sy-rh*0.5+Math.sin(an)*d,2.2,1-q); }
    }
    drawBunny(ctx,bx,by+r*0.8,Math.min(1,h/260),t);
    if(ph>=0.38) drawBubble(ctx,bx,by-r*2,1,r*0.9,1);
  },
  result:function(api){
    var total=S.popped+S.dropped;
    return {
      stats:[['터뜨린 방울',U.fmt(S.popped)],['떨어뜨린 방울',U.fmt(S.dropped)],['최대 콤보',S.maxCombo]],
      line:total>0?'별방울 '+U.fmt(total)+'개를 하늘로 날려 보냈어요. 루루가 박수 치고 있어요!':'루루가 기다려요. 한 번만 더 쏴 볼까요?'
    };
  }
});
})();

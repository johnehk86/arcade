/* 솜사탕 러너: 스타 버니 루루가 저절로 달리고, 탭으로 점프(공중에서 한 번 더 탭하면 2단 점프)하는 원터치 러너.
   시간이 지날수록 빨라지고 장애물 종류가 늘어난다. 판의 배치는 모두 api.rng(오늘의 도전은 모두 같은 코스). */
(function(){
'use strict';
var U=Arcade.util, clamp=U.clamp, lerp=U.lerp;
var W=360, BX=92;
var G=1900, JUMP=620, JUMP2=560;
var PENT=[72,74,76,79,81,84,86,88,91,93];
var MCOL=['#ffd1e3','#e3d9ff','#c9f3e6'], TCOL=['#ffb8d1','#cbbdff','#9fe8d4','#ffe08f'];
var CCOL=['#ff7ea6','#ac97fe','#56dbc1','#ffd66b','#ffb38a'];
var S=null;
var LAST={meters:0,got:0,maxStreak:0,stage:1};   // 끝난 판 기록 (연출 화면으로 바뀌어도 결과 화면에 남게)

function hash(n){ var x=Math.sin(n*127.1+311.7)*43758.5453; return x-Math.floor(x); }
function speedAt(t){ return Math.min(520,220+t*3.2); }
function stageAt(t){ return t<15?1:t<35?2:t<60?3:t<90?4:5; }
function airDist(v){ return v*(2*JUMP/G); }
function mult(){ return Math.min(5,1+Math.floor(S.streak/10)); }
function GY(api){ return api.H-120; }

/* ---------- 그리기 도구 ---------- */
function rr(ctx,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function sparkle(ctx,x,y,r){
  ctx.beginPath(); ctx.moveTo(x,y-r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.quadraticCurveTo(x,y,x,y+r);
  ctx.quadraticCurveTo(x,y,x-r,y); ctx.quadraticCurveTo(x,y,x,y-r); ctx.fill();
}
function puff(ctx,x,y,r){
  ctx.beginPath(); ctx.arc(x-r*0.9,y,r*0.7,0,6.283); ctx.arc(x,y-r*0.35,r,0,6.283); ctx.arc(x+r*0.95,y,r*0.75,0,6.283); ctx.fill();
  ctx.fillRect(x-r*0.9,y-1,r*1.85,r*0.7);
}
function drawStar(ctx,x,y,r,col){
  ctx.fillStyle=col; ctx.beginPath();
  for(var i=0;i<10;i++){ var a=-Math.PI/2+i*Math.PI/5, q=i%2?r*0.45:r; ctx.lineTo(x+Math.cos(a)*q,y+Math.sin(a)*q); }
  ctx.closePath(); ctx.fill();
}
function grumpy(ctx,x,y,s){
  ctx.strokeStyle='#77113c'; ctx.lineWidth=1.4*s; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(x-7*s,y-3*s); ctx.lineTo(x-3*s,y-1.5*s); ctx.moveTo(x+7*s,y-3*s); ctx.lineTo(x+3*s,y-1.5*s); ctx.stroke();
  ctx.fillStyle='#3f001b'; ctx.beginPath(); ctx.arc(x-4.5*s,y+1*s,1.5*s,0,6.283); ctx.arc(x+4.5*s,y+1*s,1.5*s,0,6.283); ctx.fill();
  ctx.beginPath(); ctx.arc(x,y+7*s,2.6*s,Math.PI+0.3,-0.3); ctx.stroke();
}
function drawBunny(ctx,x,y,s,sx,sy,rot,phase,blink){
  ctx.save();
  ctx.fillStyle='rgba(119,17,60,.12)'; ctx.beginPath(); ctx.ellipse(x,y+1,12*s,3*s,0,0,6.283); ctx.fill();
  ctx.translate(x,y); ctx.rotate(rot||0); ctx.scale(sx,sy);
  var bob=Math.sin(phase)*1.5*s;
  // 발
  ctx.fillStyle='#ffe4ee';
  ctx.beginPath(); ctx.ellipse(-5*s+Math.sin(phase)*4*s,-2*s,4*s,2.6*s,0,0,6.283); ctx.ellipse(6*s-Math.sin(phase)*4*s,-2*s,4*s,2.6*s,0,0,6.283); ctx.fill();
  for(var e=-1;e<=1;e+=2){
    ctx.save(); ctx.translate(e*6*s-2*s,-27*s+bob); ctx.rotate(e*0.18-0.25-Math.sin(phase)*0.08);
    ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.ellipse(0,-10*s,5.2*s,12*s,0,0,6.283); ctx.fill();
    ctx.strokeStyle='rgba(163,54,93,.35)'; ctx.lineWidth=1.2*s; ctx.stroke();
    ctx.fillStyle='#ffb1c5'; ctx.beginPath(); ctx.ellipse(0,-10*s,2.6*s,8.5*s,0,0,6.283); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.ellipse(0,-14*s+bob,15*s,14*s,0,0,6.283); ctx.fill();
  ctx.strokeStyle='rgba(163,54,93,.35)'; ctx.lineWidth=1.4*s; ctx.stroke();
  ctx.strokeStyle='#ac97fe'; ctx.lineWidth=2*s;
  ctx.beginPath(); ctx.arc(0,-16*s+bob,14.5*s,Math.PI*1.15,Math.PI*1.85); ctx.stroke();
  drawStar(ctx,10*s,-27*s+bob,5*s,'#ffd66b');
  ctx.fillStyle='#ac97fe'; ctx.beginPath(); ctx.arc(-13.5*s,-15*s+bob,3*s,0,6.283); ctx.fill();
  ctx.fillStyle='#21172b';
  if(blink){ ctx.fillRect(1*s,-16*s+bob,4*s,1.2*s); ctx.fillRect(8*s,-16*s+bob,4*s,1.2*s); }
  else { ctx.beginPath(); ctx.arc(3*s,-15.5*s+bob,1.9*s,0,6.283); ctx.arc(10*s,-15.5*s+bob,1.9*s,0,6.283); ctx.fill(); }
  ctx.fillStyle='rgba(255,126,166,.55)';
  ctx.beginPath(); ctx.ellipse(0,-11*s+bob,2.8*s,1.6*s,0,0,6.283); ctx.ellipse(13*s,-11*s+bob,2.4*s,1.5*s,0,0,6.283); ctx.fill();
  ctx.strokeStyle='#77113c'; ctx.lineWidth=1.1*s;
  ctx.beginPath(); ctx.arc(6.5*s,-12*s+bob,1.6*s,0.2,Math.PI-0.2); ctx.stroke();
  ctx.fillStyle='#ffe4ee'; ctx.beginPath(); ctx.arc(-15*s,-8*s+bob,3.6*s,0,6.283); ctx.fill();
  ctx.restore();
}
function drawSky(ctx,w,h,t,s){
  var g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#ffe4ee'); g.addColorStop(0.55,'#efe6ff'); g.addColorStop(1,'#e0fbf4');
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#ffffff';
  for(var i=0;i<14;i++){
    ctx.globalAlpha=0.35+0.55*Math.abs(Math.sin(t*1.5+i));
    sparkle(ctx,hash(i)*w,hash(i+40)*h*0.55,(2+hash(i+9)*2.5)*s);
  }
  ctx.globalAlpha=1;
}
function drawLayers(ctx,w,gy,off,s){
  var sp,o,base,k,id,x;
  // 먼 구름
  ctx.fillStyle='rgba(255,255,255,.85)';
  sp=170*s; o=(off*0.06)%sp; base=Math.floor(off*0.06/sp);
  for(k=-1;k<w/sp+2;k++){ id=base+k; puff(ctx,k*sp-o,gy*(0.22+hash(id+5)*0.25),(14+hash(id+6)*10)*s); }
  // 사탕 산
  sp=150*s; o=(off*0.15)%sp; base=Math.floor(off*0.15/sp);
  for(k=-1;k<w/sp+2;k++){
    id=base+k; x=k*sp-o; var hh=(60+hash(id)*70)*s, ww=(120+hash(id+3)*60)*s;
    ctx.fillStyle=MCOL[((id%3)+3)%3];
    ctx.beginPath(); ctx.moveTo(x-ww/2,gy); ctx.quadraticCurveTo(x-ww*0.18,gy-hh*0.95,x,gy-hh); ctx.quadraticCurveTo(x+ww*0.18,gy-hh*0.95,x+ww/2,gy); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(x,gy-hh+5*s,11*s,5*s,0,0,6.283); ctx.fill();
  }
  // 솜사탕 나무
  sp=95*s; o=(off*0.4)%sp; base=Math.floor(off*0.4/sp);
  for(k=-1;k<w/sp+2;k++){
    id=base+k; if(hash(id+7)<0.25) continue;
    x=k*sp-o+hash(id)*30*s; var th=(34+hash(id+1)*26)*s, r=(14+hash(id+2)*9)*s;
    ctx.fillStyle='#f6d2b8'; ctx.fillRect(x-2*s,gy-th,4*s,th);
    ctx.fillStyle=TCOL[((id%4)+4)%4];
    ctx.beginPath(); ctx.arc(x,gy-th-r*0.4,r,0,6.283); ctx.arc(x-r*0.7,gy-th+r*0.15,r*0.7,0,6.283); ctx.arc(x+r*0.7,gy-th+r*0.15,r*0.7,0,6.283); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(x-r*0.3,gy-th-r*0.7,r*0.3,0,6.283); ctx.fill();
  }
}
function drawGround(ctx,x0,x1,gy,h,off,s){
  if(x1<-20||x0>W+20) return;
  var a=Math.max(-20,x0), b=Math.min(W+20,x1);
  ctx.fillStyle='#ffe0c2'; rr(ctx,x0,gy,x1-x0,h-gy+30,10*s); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.rect(a,gy,b-a,h-gy); ctx.clip();
  var tw=40*s, start=Math.floor((a+off)/tw);
  for(var i=start;i*tw-off<b;i++){
    var tx=i*tw-off;
    ctx.fillStyle=i%2?'#ffd2b0':'#ffe6cf'; ctx.fillRect(tx,gy+12*s,tw,h-gy);
    ctx.fillStyle='#f2b98f';
    ctx.beginPath(); ctx.arc(tx+tw*(0.3+hash(i)*0.4),gy+26*s+hash(i+2)*18*s,2.2*s,0,6.283); ctx.arc(tx+tw*(0.2+hash(i+4)*0.5),gy+48*s+hash(i+6)*20*s,1.8*s,0,6.283); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle='#8be3cc'; rr(ctx,x0,gy-3*s,x1-x0,15*s,7*s); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.6)'; rr(ctx,x0+6*s,gy-1*s,Math.max(0,x1-x0-12*s),3*s,2*s); ctx.fill();
}
function drawMallow(ctx,x,y,w,h,s,col){
  ctx.fillStyle='rgba(163,54,93,.15)'; ctx.beginPath(); ctx.ellipse(x+w/2,y+h,w*0.55,4*s,0,0,6.283); ctx.fill();
  ctx.fillStyle=col||'#ffffff'; rr(ctx,x,y,w,h,9*s); ctx.fill();
  ctx.fillStyle='rgba(255,177,197,.45)'; rr(ctx,x,y+h*0.62,w,h*0.38,8*s); ctx.fill();
  ctx.strokeStyle='rgba(163,54,93,.3)'; ctx.lineWidth=1.3*s; rr(ctx,x,y,w,h,9*s); ctx.stroke();
  grumpy(ctx,x+w/2,y+h*0.42,s*0.9);
}
function drawLolli(ctx,x,gy,s){
  ctx.fillStyle='#ffffff'; ctx.fillRect(x+5*s,gy-52*s,6*s,52*s);
  ctx.fillStyle='#ff9fbf'; for(var i=0;i<5;i++) ctx.fillRect(x+5*s,gy-48*s+i*10*s,6*s,3*s);
  var cx=x+8*s, cy=gy-64*s;
  ctx.fillStyle='#ff7ea6'; ctx.beginPath(); ctx.arc(cx,cy,13*s,0,6.283); ctx.fill();
  ctx.strokeStyle='#ffe08f'; ctx.lineWidth=3*s; ctx.beginPath();
  for(var a=0;a<12;a+=0.3){ var r=a*1.0*s; ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r); }
  ctx.stroke();
  grumpy(ctx,cx,cy-1*s,s*0.7);
}
function drawCloudFoe(ctx,x,y,s,t){
  ctx.fillStyle='rgba(99,78,176,.12)'; puff(ctx,x+28*s,y+20*s,16*s);
  ctx.fillStyle='#d9d2ee'; puff(ctx,x+28*s,y+16*s+Math.sin(t*3)*1.5*s,16*s);
  grumpy(ctx,x+28*s,y+12*s+Math.sin(t*3)*1.5*s,s*0.85);
}
function drawCandy(ctx,x,y,s,col,spin){
  ctx.save(); ctx.translate(x,y); ctx.rotate(spin);
  ctx.fillStyle=col;
  ctx.beginPath(); ctx.moveTo(-6*s,0); ctx.lineTo(-11*s,-4*s); ctx.lineTo(-11*s,4*s); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(6*s,0); ctx.lineTo(11*s,-4*s); ctx.lineTo(11*s,4*s); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(0,0,6.5*s,0,6.283); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(-2*s,-2*s,2*s,0,6.283); ctx.fill();
  ctx.restore();
}
function drawMagnet(ctx,x,y,s){
  ctx.strokeStyle='#ff5f92'; ctx.lineWidth=6*s; ctx.lineCap='butt';
  ctx.beginPath(); ctx.arc(x,y,8*s,Math.PI,0,true); ctx.stroke();
  ctx.fillStyle='#ffffff'; ctx.fillRect(x-11*s,y,6*s,5*s); ctx.fillRect(x+5*s,y,6*s,5*s);
}

/* ---------- 코스 만들기 ---------- */
function addCandyArc(cx,n,width,height,gy,base){
  var grp={n:n,got:0,end:cx+width/2,done:false};
  S.groups.push(grp);
  for(var i=0;i<n;i++){
    var u=n===1?0.5:i/(n-1), x=cx-width/2+u*width, k=2*u-1;
    S.candies.push({x:x,y:(base||gy-22)-height*(1-k*k),col:CCOL[(S.candyCol++)%5],grp:grp,got:false});
  }
}
function cutGap(w){
  S.segs.push({x0:S.segStart,x1:S.genX});
  S.genX+=w; S.segStart=S.genX;
}
function genPattern(api){
  var r=S.rnd, v=S.v, st=S.auto?1:stageAt(S.t), gy=GY(api);
  var run=v*lerp(1.25,0.62,clamp(S.t/100,0,1))*(0.8+r()*0.5);
  run=Math.max(run,v*0.5,90);
  if(!S.auto&&r()<0.5) addCandyArc(S.genX+run*0.5,4,Math.min(run*0.6,120),0,gy);
  S.genX+=run;
  if(!S.auto&&st>=2&&!S.powerPlaced&&r()<0.1){
    S.items.push({x:S.genX-run*0.4,y:gy-70,type:r()<0.55?'rocket':'magnet',got:false});
    S.powerPlaced=true; S.powerCool=6;
  }
  var pool=['mallow','mallow'];
  if(st>=2) pool.push('gap','lolli','gap');
  if(st>=3) pool.push('cloud','gapwide','mallow2');
  if(st>=4) pool.push('mover','combo','mover');
  if(st>=5) pool.push('combo','gapwide','cloud');
  var p=S.auto?'mallow':pool[Math.floor(r()*pool.length)], x=S.genX, gw;
  if(p==='mallow'){
    S.obs.push({type:'mallow',x:x,w:34,h:30}); if(!S.auto) addCandyArc(x+17,5,110,62,gy); S.genX+=34;
  } else if(p==='mallow2'){
    S.obs.push({type:'mallow',x:x,w:34,h:30}); S.obs.push({type:'mallow',x:x+84,w:34,h:30});
    addCandyArc(x+59,6,150,70,gy); S.genX+=118;
  } else if(p==='lolli'){
    S.obs.push({type:'lolli',x:x,w:16,h:76}); addCandyArc(x+8,5,100,96,gy); S.genX+=16;
  } else if(p==='gap'){
    gw=clamp(airDist(v)*(0.3+r()*0.25),46,airDist(v)*0.55);
    addCandyArc(x+gw/2,5,gw+40,70,gy); cutGap(gw);
  } else if(p==='gapwide'){
    gw=clamp(airDist(v)*(0.62+r()*0.25),airDist(v)*0.6,v*1.06*0.62);
    addCandyArc(x+gw/2,7,gw+30,140,gy); cutGap(gw);
  } else if(p==='cloud'){
    S.obs.push({type:'mallow',x:x+11,w:34,h:30});
    S.obs.push({type:'cloud',x:x,w:56,h:32,yo:-170});
    addCandyArc(x+28,4,80,50,gy); S.genX+=56;
  } else if(p==='mover'){
    S.obs.push({type:'mover',x:x,w:34,h:30,ph:r()*6.28}); addCandyArc(x+17,5,110,80,gy); S.genX+=34;
  } else if(p==='combo'){
    S.obs.push({type:'mallow',x:x,w:34,h:30});
    var sp=Math.max(v*0.55,110);
    S.genX+=34+sp;
    gw=clamp(airDist(v)*0.4,50,airDist(v)*0.5);
    addCandyArc(S.genX+gw/2,4,gw+30,60,gy); cutGap(gw);
  }
}
function genAhead(api){
  while(S.genX<S.dist+W+300) genPattern(api);
}
function onGround(wx){
  if(wx>=S.segStart-4) return true;
  for(var i=0;i<S.segs.length;i++){ var g=S.segs[i]; if(wx>=g.x0-4&&wx<=g.x1+4) return true; }
  return false;
}
function obsBox(o,gy){
  if(o.type==='lolli') return [o.x-3,gy-76,o.x+19,gy];
  if(o.type==='cloud') return [o.x+6,gy+o.yo,o.x+o.w-6,gy+o.yo+o.h];
  var yo=o.type==='mover'?-Math.abs(Math.sin(o.ph+S.t*3))*46:0;
  return [o.x+3,gy-o.h+yo,o.x+o.w-3,gy+yo];
}

/* ---------- 조작 ---------- */
function press(api){
  S.held=true;
  if(S.rocket>0||S.dead) return;
  var grounded=!S.air||S.t-S.leftGround<0.08;
  if(grounded&&S.jumps===0){ doJump(api,false); }
  else if(S.jumps<2){ doJump(api,true); }
  else S.buffer=0.12;
}
function doJump(api,dbl){
  var sfx=api.sfx;
  if(dbl){
    S.vy=-JUMP2; S.jumps=2;
    api.fx.burst(BX,S.y-10,10,'172,151,254',120,{size:[4,9],life:0.5});
    if(api.state==='play'){ sfx.tone(880,0.14,'sine',0.09,{slide:1500,wet:false}); sfx.tone(1760,0.18,'sine',0.04,{delay:0.03}); }
  } else {
    S.vy=-JUMP; S.jumps=1; S.air=true; S.holdT=0;
    S.sx=0.85; S.sy=1.2;
    api.fx.burst(BX,S.y,6,'255,200,170',70,{size:[4,8],life:0.4,gravity:-40});
    if(api.state==='play') sfx.tone(520,0.16,'sine',0.11,{slide:880,wet:false});
  }
  S.buffer=0;
}
function release(){ S.held=false; }

function hitObstacle(api,o){
  var fx=api.fx;
  if(S.rocket>0){
    o.dead=true; S.smashed++;
    api.addScore(50*mult());
    fx.hitstop(0.04); fx.shake(5);
    fx.shards(o.x-S.dist+o.w/2,GY(api)-20,10,'#ffb1c5',220,6);
    fx.burst(o.x-S.dist+o.w/2,GY(api)-20,14,'255,200,90',180);
    fx.text(o.x-S.dist+o.w/2,GY(api)-60,'쾅! +'+50*mult(),'#ff5f92',20,0.8,{stroke:'rgba(255,255,255,.9)'});
    api.sfx.noise(0.25,0.18,{freq:900,slide:200}); api.haptic(14);
    return;
  }
  if(S.inv>0) return;
  S.lives--; api.setLives(S.lives,3);
  S.inv=1.2; S.vy=-380; S.air=true; S.jumps=1;
  S.streak=0; updateSub(api);
  fx.shake(7); fx.flash(0.5,'255,170,200');
  fx.burst(BX,S.y-14,12,'255,214,107',160,{size:[5,10]});
  fx.text(BX+20,S.y-50,'아야!','#a3365d',20,0.8,{stroke:'rgba(255,255,255,.9)'});
  api.sfx.tone(180,0.25,'sine',0.25,{slide:80,wet:false}); api.sfx.noise(0.12,0.12,{freq:600});
  api.haptic(35);
  if(S.lives<=0) die(api,false);
}
function die(api,fell){
  if(S.dead) return;
  S.dead=true; S.deadT=0;
  LAST={meters:S.meters,got:S.got,maxStreak:S.maxStreak,stage:stageAt(S.t)};
  if(fell){ api.sfx.tone(600,0.8,'sine',0.15,{slide:150}); api.fx.text(W/2,GY(api)-80,'으앗, 떨어졌어요!','#a3365d',22,1.2,{stroke:'rgba(255,255,255,.9)'}); }
  else { S.vy=-420; }
  api.setMeter(null); api.setSub('');
  if(api.state==='play') api.end();
}
function updateSub(api){
  if(S.auto) return;
  api.setSub(S.streak>=3?'사탕 연속 '+S.streak+(mult()>1?' · ×'+mult():''):'');
}

/* ---------- 판 준비 ---------- */
function init(api,auto){
  S={auto:auto,rnd:auto?Math.random:api.rng,t:0,v:auto?200:220,dist:0,acc:0,meters:0,
    y:GY(api),vy:0,air:false,jumps:0,held:false,holdT:0,leftGround:0,buffer:0,sx:1,sy:1,phase:0,rot:0,
    lives:3,inv:0,rocket:0,magnet:0,powerPlaced:false,powerCool:0,streak:0,maxStreak:0,candies:[],candyCol:0,got:0,smashed:0,
    obs:[],items:[],groups:[],segs:[],segStart:-400,genX:380,stage:1,dead:false,deadT:0,trail:[],blinkT:2};
  genAhead(api);
}

Arcade.register({
  id:'runner',
  title:'솜사탕 러너',
  kicker:'RUN · 원터치 점프',
  blurb:'루루와 솜사탕 나라를 끝없이 달려요',
  lede:'루루가 저절로 달려요. 탭하면 점프, 공중에서 한 번 더 탭하면 2단 점프! 사탕을 이어 먹으면 점수가 커지고, 갈수록 빨라져요.',
  how:'탭으로 점프 · 공중에서 한 번 더 탭하면 2단 점프 · 길게 누르면 조금 더 높이 · 구멍에 빠지면 끝',
  lifeIcon:'shield',
  endDelay:1300,
  palette:{bg:'#f2fbf8',surface:'#ffffff',surface2:'#e6f8f2',line:'#bfeee0',text:'#21172b',muted:'#6d7f7a',
    accent:'#1fae95',accentInk:'#ffffff',accentDeep:'#137a68',hot:'#ff5f92',hotText:'#ff5f92',hotRgb:'255,95,146',light:true},

  start:function(api){
    init(api,api.state!=='play');
    if(api.state==='play'){ api.setLives(3,3); api.setSub(''); api.setMeter(null); }
  },
  update:function(dt,api){
    if(api.state==='over'&&!S.auto&&S.deadT>1.5) init(api,true);
    var fx=api.fx, gy=GY(api), i, play=api.state==='play'&&!S.auto;
    S.t+=dt;
    if(S.dead){ S.deadT+=dt; S.v*=Math.exp(-dt*3); }
    else S.v=S.auto?200:speedAt(S.t);
    if(play){
      var st=stageAt(S.t);
      if(st>S.stage){
        S.stage=st;
        fx.text(W/2,api.H*0.32,'단계 '+st+'! 더 빨라져요','#1fae95',26,1.4,{stroke:'rgba(255,255,255,.95)',rise:14});
        fx.flash(0.4,'200,255,240');
        for(i=0;i<4;i++) api.sfx.pluck(72+[0,4,7,12][i],0.13,i*0.07);
      }
    }
    var dx=S.v*dt*(S.rocket>0?1.35:1);
    S.dist+=dx;
    if(play&&!S.dead){
      S.acc+=dx;
      if(S.acc>=10){ var p=Math.floor(S.acc/10); S.acc-=p*10; S.meters+=p; api.addScore(p); }
    }
    genAhead(api);

    // 루루 움직임
    S.phase+=dt*(8+S.v/40);
    S.sx+=(1-S.sx)*Math.min(1,dt*12); S.sy+=(1-S.sy)*Math.min(1,dt*12);
    if(S.inv>0) S.inv-=dt;
    if(S.buffer>0) S.buffer-=dt;
    var wx=S.dist+BX;
    if(S.rocket>0&&!S.dead){
      S.rocket-=dt;
      S.y+=((gy-90)-S.y)*Math.min(1,dt*8); S.vy=0; S.air=true; S.jumps=1;
      S.trail.push({x:BX,y:S.y-14}); if(S.trail.length>18) S.trail.shift();
      if(S.rocket<=0&&!onGround(wx+40)) S.rocket=0.2;
      if(S.rocket<=0){ S.vy=0; S.trail.length=0; api.setMeter(null); }
      else if(play) api.setMeter(S.rocket/3,'별빛 로켓',false);
      if(Math.random()<0.6) fx.burst(BX-16,S.y-12,1,['255,126,166','172,151,254','86,219,193','255,214,107'][Math.floor(Math.random()*4)],60,{angle:Math.PI,spread:0.6,size:[6,10],life:0.5});
    } else {
      var g=G;
      if(S.held&&S.vy<0&&S.jumps===1&&S.holdT<0.2) g*=0.5;
      S.holdT+=dt;
      var prevY=S.y;
      S.vy+=g*dt; S.y+=S.vy*dt;
      if(S.dead&&!S.fellOff){ S.rot+=dt*7; }
      if(!S.dead&&S.vy>=0&&S.y>=gy&&prevY<=gy+2&&onGround(wx)){
        var impact=S.vy;
        S.y=gy; S.vy=0;
        if(S.air){ S.sx=1.25; S.sy=0.78; if(impact>500) fx.burst(BX,gy,6,'255,200,170',80,{size:[4,8],life:0.35,gravity:-30}); }
        S.air=false; S.jumps=0;
        if(S.buffer>0) doJump(api,false);
      } else if(!S.air&&!onGround(wx)){
        S.air=true; S.leftGround=S.t;
      }
      if(S.y>gy+70&&!S.dead){
        if(play) { S.fellOff=true; die(api,true); }
        else { S.y=gy; S.vy=0; S.air=false; S.jumps=0; }
      }
    }
    if(S.auto&&!S.dead){
      for(i=0;i<S.obs.length;i++){ var ao=S.obs[i], ax=ao.x-S.dist; if(ax>BX+10&&ax<BX+62&&!S.air){ doJump(api,false); break; } }
      if(!S.air&&!onGround(wx+40)) doJump(api,false);
    }

    // 충돌
    if(!S.dead){
      var b0=BX-10, b1=BX+10, t0=S.y-26, t1=S.y-3;
      for(i=0;i<S.obs.length;i++){
        var o=S.obs[i]; if(o.dead) continue;
        var ox=o.x-S.dist; if(ox>BX+60||ox+o.w<BX-40) continue;
        var bx=obsBox(o,gy);
        if(b1>bx[0]-S.dist&&b0<bx[2]-S.dist&&t1>bx[1]&&t0<bx[3]){ if(play) hitObstacle(api,o); }
      }
      // 사탕
      for(i=0;i<S.candies.length;i++){
        var c=S.candies[i]; if(c.got) continue;
        var cx=c.x-S.dist, cy=c.y;
        if(S.magnet>0&&Math.abs(cx-BX)<150&&Math.abs(cy-(S.y-14))<150){
          var k=Math.min(1,dt*9); c.x+=(BX+S.dist-c.x)*k; c.y+=(S.y-14-c.y)*k; cx=c.x-S.dist; cy=c.y;
        }
        if(Math.abs(cx-BX)<18&&Math.abs(cy-(S.y-14))<22&&!S.auto){
          c.got=true; c.grp.got++; S.got++; S.streak++; if(S.streak>S.maxStreak) S.maxStreak=S.streak;
          if(play){
            api.addScore(10*mult());
            api.sfx.pluck(PENT[S.streak%PENT.length],0.12);
            fx.burst(cx,cy,5,'255,214,107',90,{size:[4,8],life:0.4});
            if(S.streak%10===0) fx.text(cx,cy-20,'×'+mult()+'!','#ff5f92',20,0.8,{stroke:'rgba(255,255,255,.9)'});
            updateSub(api);
          }
        }
      }
      for(i=0;i<S.groups.length;i++){
        var gp=S.groups[i];
        if(!gp.done&&gp.end<S.dist+BX-30){ gp.done=true; if(gp.got===0&&S.streak>0&&play){ S.streak=0; updateSub(api); } }
      }
      // 아이템
      for(i=0;i<S.items.length;i++){
        var it=S.items[i]; if(it.got) continue;
        var ix=it.x-S.dist;
        if(Math.abs(ix-BX)<22&&Math.abs(it.y-(S.y-14))<28&&play){
          it.got=true; S.powerPlaced=false;
          if(it.type==='rocket'){
            S.rocket=3; S.inv=0;
            fx.text(BX+40,S.y-60,'별빛 로켓!','#ff5f92',24,1,{stroke:'rgba(255,255,255,.95)'});
            fx.flash(0.5,'255,240,200'); api.sfx.noise(0.9,0.12,{type:'bandpass',freq:500,slide:2200,wet:true});
          } else {
            S.magnet=6;
            fx.text(BX+40,S.y-60,'사탕 자석!','#634eb0',22,1,{stroke:'rgba(255,255,255,.95)'});
            api.sfx.pluck(84,0.13); api.sfx.pluck(91,0.12,0.08);
          }
          api.haptic(16);
        }
      }
    }
    if(S.magnet>0){ S.magnet-=dt; if(play&&S.rocket<=0) api.setMeter(Math.max(0,S.magnet/6),'사탕 자석',false); if(S.magnet<=0&&play&&S.rocket<=0) api.setMeter(null); }
    if(S.powerCool>0){ S.powerCool-=dt; }

    // 정리
    var cut=S.dist-120;
    S.obs=S.obs.filter(function(o){ return o.x+o.w>cut; });
    S.candies=S.candies.filter(function(c){ return c.x>cut&&!(c.got&&c.x<S.dist); });
    S.items=S.items.filter(function(it){ return it.x>cut&&!it.got; });
    S.groups=S.groups.filter(function(gp){ return !gp.done; });
    S.segs=S.segs.filter(function(sg){ return sg.x1>cut; });
    S.blinkT-=dt; if(S.blinkT<-0.12) S.blinkT=2+Math.random()*2;
  },
  draw:function(ctx,api){
    var H=api.H, gy=GY(api), off=S.dist, i;
    drawSky(ctx,W,H,S.t,1);
    drawLayers(ctx,W,gy,off,1);
    // 땅
    for(i=0;i<S.segs.length;i++) drawGround(ctx,S.segs[i].x0-off,S.segs[i].x1-off,gy,H,off,1);
    drawGround(ctx,S.segStart-off,W+40,gy,H,off,1);
    // 속도선
    if(S.v>380||S.rocket>0){
      ctx.strokeStyle='rgba(255,255,255,'+(S.rocket>0?0.8:clamp((S.v-380)/200,0,0.6))+')'; ctx.lineWidth=2;
      for(i=0;i<8;i++){ var ly=140+hash(i+Math.floor(S.t*6))*(gy-160), lx=(W-((S.t*900+i*137)%(W+120))); ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(lx+40+hash(i)*40,ly); ctx.stroke(); }
    }
    // 사탕
    for(i=0;i<S.candies.length;i++){ var c=S.candies[i]; if(c.got) continue; var cx=c.x-off; if(cx<-20||cx>W+20) continue; drawCandy(ctx,cx,c.y+Math.sin(S.t*4+c.x*0.05)*2,1,c.col,Math.sin(S.t*3+c.x)*0.3); }
    // 아이템
    for(i=0;i<S.items.length;i++){
      var it=S.items[i], ix=it.x-off; if(ix<-30||ix>W+30) continue;
      var iy=it.y+Math.sin(S.t*3)*4;
      ctx.fillStyle='rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(ix,iy,17,0,6.283); ctx.fill();
      ctx.strokeStyle=it.type==='rocket'?'#ffd66b':'#ff7ea6'; ctx.lineWidth=2; ctx.stroke();
      if(it.type==='rocket') drawStar(ctx,ix,iy,11,'#ffd66b'); else drawMagnet(ctx,ix,iy+2,1);
    }
    // 장애물
    for(i=0;i<S.obs.length;i++){
      var o=S.obs[i]; if(o.dead) continue; var ox=o.x-off; if(ox<-70||ox>W+70) continue;
      if(o.type==='mallow') drawMallow(ctx,ox,gy-o.h,o.w,o.h,1);
      else if(o.type==='mover') drawMallow(ctx,ox,gy-o.h-Math.abs(Math.sin(o.ph+S.t*3))*46,o.w,o.h,1,'#ffe9a8');
      else if(o.type==='lolli') drawLolli(ctx,ox,gy,1);
      else if(o.type==='cloud') drawCloudFoe(ctx,ox,gy+o.yo-6,1,S.t);
    }
    // 로켓 무지개 꼬리
    if(S.trail.length>1){
      var cols=['#ff7ea6','#ffd66b','#56dbc1','#ac97fe'];
      for(var cI=0;cI<4;cI++){
        ctx.strokeStyle=cols[cI]; ctx.lineWidth=4; ctx.globalAlpha=0.8; ctx.beginPath();
        for(i=0;i<S.trail.length;i++){ var tp=S.trail[i]; ctx.lineTo(tp.x-(S.trail.length-i)*9,tp.y-6+cI*4); }
        ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
    // 루루
    var blink=S.inv>0&&Math.floor(S.inv*14)%2===0;
    if(!blink){
      var ph=S.air?0:S.phase;
      var tilt=S.dead?S.rot:(S.air?clamp(S.vy/1600,-0.3,0.35):0)+(S.rocket>0?-0.15:0);
      drawBunny(ctx,BX,S.y,1,S.sx,S.sy,tilt,ph,S.blinkT<0);
      if(S.magnet>0){ ctx.globalAlpha=0.5+0.3*Math.sin(S.t*8); drawMagnet(ctx,BX+2,S.y-58,0.7); ctx.globalAlpha=1; }
    }
  },
  pointer:function(type,x,y,api){
    if(type==='down') press(api); else if(type==='up') release();
  },
  key:function(type,code,api){
    if(code==='Space'||code==='ArrowUp'||code==='KeyW'){ if(type==='down') press(api); else release(); return true; }
    return false;
  },
  preview:function(ctx,w,h,t){
    var s=h/240, gy=h*0.8, off=t*90;
    drawSky(ctx,w,h,t,s);
    drawLayers(ctx,w,gy,off,s);
    drawGround(ctx,-20,w+20,gy,h,off,s);
    var cyc=(t%2.2)/2.2, ox=w*1.1-cyc*w*1.3, bx=w*0.3;
    drawMallow(ctx,ox,gy-26*s,30*s,26*s,s);
    var jy=0, jp=(cyc-0.42)/0.3;
    if(jp>0&&jp<1) jy=-Math.sin(jp*Math.PI)*58*s;
    for(var i=0;i<4;i++){ var cx=ox+15*s+(i-1.5)*18*s, ccy=gy-40*s-Math.sin((i+0.5)/4*Math.PI)*28*s; if(cx>bx+6*s) drawCandy(ctx,cx,ccy,s*0.8,CCOL[i],0); }
    drawBunny(ctx,bx,gy+jy,s,1,1,jp>0&&jp<1?-0.15:0,jp>0&&jp<1?0:t*14,false);
  },
  result:function(api){
    var R=S.auto?LAST:{meters:S.meters,got:S.got,maxStreak:S.maxStreak,stage:stageAt(S.t)};
    return {
      stats:[['달린 거리',U.fmt(R.meters)+'m'],['사탕',R.got],['최대 연속',R.maxStreak]],
      line:R.meters>=1500?'솜사탕 나라 끝까지 갈 기세예요! 루루가 신났어요.':R.meters>=500?'바람처럼 달렸어요. 다음엔 단계 '+Math.min(5,R.stage+1)+'까지 가 봐요!':'몸풀기 완료! 사탕 길을 따라 점프해 보세요.'
    };
  }
});
})();

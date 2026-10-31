/* 별똥별 요격: 드래그로 움직이고 자동으로 쏘는 세로 슈팅. 파스텔 꿈나라 하늘, 토끼 로켓, 사탕 별똥별.
   큰 운석은 중간 둘로, 중간은 작은 둘로 쪼개진다. 1.4초 안에 이어서 부수면 콤보, 25콤보마다 과열. */
(function(){
'use strict';

var W=360;
var U=Arcade.util, clamp=U.clamp, fmt=U.fmt;
var S=null, keys={}, PV=null;
var SIZES={
  3:{r:30,hp:8,hue:10,pts:60,drops:3,verts:10},
  2:{r:18,hp:3,hue:24,pts:25,drops:2,verts:8},
  1:{r:10,hp:1,hue:38,pts:10,drops:1,verts:7}
};
var STREAMS=[
  [[0,0]],
  [[-5,0],[5,0]],
  [[-9,-0.06],[0,0],[9,0.06]],
  [[-12,-0.1],[-4,-0.02],[4,0.02],[12,0.1]],
  [[-14,-0.16],[-7,-0.06],[0,0],[7,0.06],[14,0.16]]
];
var CHIME=[0,2,4,7,9,12,14,16,19,21,24];
var CANDY=[340,265,45,168,15];   // 분홍, 라벤더, 버터, 민트, 복숭아
var KEYMAP={ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0],ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1]};

/* ---------- 모양 ---------- */
function makeVerts(n,jag){
  var v=[];
  for(var i=0;i<n;i++) v.push({a:i/n*Math.PI*2+(Math.random()-.5)*(Math.PI*2/n)*0.5,r:1-Math.random()*jag});
  v.sort(function(a,b){ return a.a-b.a; });
  return v;
}
function mkStars(){
  var s=[];
  for(var i=0;i<70;i++) s.push({x:Math.random()*W,y:Math.random()*900,z:0.3+Math.random()*1.7,cloud:i%9===0,p:Math.random()*6.28});
  return s;
}

/* ---------- 상태 ---------- */
function fresh(api){
  S={ship:{x:W/2,y:api.H-110,px:W/2,bank:0,dead:false,inv:0},
    bullets:[],enemies:[],drops:[],warns:[],
    fireAcc:0,power:1,maxPower:1,combo:0,maxCombo:0,lastKill:-9,mult:1,od:0,odNext:25,
    shields:3,spawnAcc:0,ambAcc:0,elapsed:0,kills:0,cometAt:14,dartAcc:0,
    lastX:0,lastY:0,tickAt:0,chimeAt:0,meterAcc:0,muzzle:0,
    stars:(S&&S.stars)||mkStars()};
}
function addRock(size,x,y,vx,vy,hue){
  var d=SIZES[size];
  if(hue==null) hue=CANDY[Math.floor(Math.random()*CANDY.length)];
  S.enemies.push({kind:'rock',size:size,x:x,y:y,vx:vx,vy:vy,r:d.r,hp:d.hp,rot:Math.random()*6.28,vr:(Math.random()-.5)*2.2,
    verts:makeVerts(d.verts,0.3),hue:hue+(Math.random()-.5)*8,flash:0});
}
function updSub(api){ api.setSub(S.combo>=2?'콤보 '+S.combo+' · ×'+S.mult:''); }

/* ---------- 쏘기 ---------- */
function fire(api,play){
  var sh=S.ship, list=STREAMS[(play?S.power:2)-1], gold=S.od>0;
  for(var i=0;i<list.length;i++){
    var o=list[i];
    S.bullets.push({x:sh.x+o[0],y:sh.y-18,vx:Math.sin(o[1])*720,vy:-Math.cos(o[1])*720,gold:gold});
  }
  if(S.bullets.length>160) S.bullets.splice(0,S.bullets.length-160);
  S.muzzle=1;
  if(play) api.sfx.tone(gold?1500:1250,0.06,'triangle',0.022,{slide:gold?820:680,wet:false});
}

/* ---------- 맞히기와 부수기 ---------- */
function hit(e,b,api){
  e.hp--; e.flash=1; e.y-=e.kind==='comet'?1:3;
  api.fx.burst(b.x,b.y,3,b.gold?'255,200,90':'86,219,193',120,{size:[3,7],life:0.25});
  if(api.state==='play'&&api.t-S.tickAt>0.03){ S.tickAt=api.t; api.sfx.tone(1700+Math.random()*400,0.035,'square',0.014,{wet:false}); }
  if(e.hp<=0) kill(e,api,true);
}
function boom(api,size,wet){
  api.sfx.noise(0.22+size*0.12,0.12+size*0.06,{freq:2600,slide:160+size*20,type:'lowpass',wet:!!wet});
  api.sfx.tone(150-size*25,0.25+size*0.1,'sine',0.16+size*0.06,{slide:38,wet:false});
  if(size>=3) api.sfx.noise(0.9,0.12,{freq:700,slide:60,type:'lowpass',wet:true,delay:0.03});
}
function kill(e,api,scored){
  if(e.dead) return;
  e.dead=true;
  var fx=api.fx, play=api.state==='play';
  var size=e.kind==='rock'?e.size:e.kind==='comet'?3:2;
  var col=e.kind==='rock'?'hsl('+Math.round(e.hue)+' 85% 70%)':e.kind==='dart'?'#ac97fe':'#ffd66b';
  var rgb=e.kind==='rock'?hueRgb(e.hue):e.kind==='dart'?'172,151,254':'255,200,90';
  fx.shards(e.x,e.y,4+size*4,col,90+size*55,3+size*1.5);
  fx.burst(e.x,e.y,6+size*6,rgb,80+size*60,{size:[6,14+size*4],life:0.6});
  fx.burst(e.x,e.y,2,rgb,20,{size:[e.r*2.2,e.r*3.2],life:0.18});
  fx.burst(e.x,e.y,3+size*2,'255,214,107',110+size*30,{size:[4,8],life:0.7});
  fx.ring(e.x,e.y,e.r*2.6,rgb,0.45,2+size*0.6,0.7);
  fx.shake(size===3?7:size===2?3.5:1.5);
  if(size===3){ fx.hitstop(e.kind==='comet'?0.08:0.06); fx.pulse(0.6); }
  else if(size===2&&e.kind==='rock') fx.hitstop(0.03);
  if(play) boom(api,size,size>=3);

  var rnd=play?api.rng:Math.random;
  if(e.kind==='rock'&&e.size>1){
    for(var k=0;k<2;k++){
      var dir=k?1:-1;
      addRock(e.size-1,e.x+dir*e.r*0.45,e.y,e.vx*0.5+dir*(50+rnd()*45),Math.max(30,e.vy*0.8)+rnd()*20,e.hue);
    }
  }
  if(!play||!scored) return;

  if(api.t-S.lastKill<1.4) S.combo++; else S.combo=1;
  S.lastKill=api.t; S.kills++;
  if(S.combo>S.maxCombo) S.maxCombo=S.combo;
  S.mult=Math.min(8,1+Math.floor(S.combo/6));
  var base=e.kind==='rock'?SIZES[e.size].pts:e.kind==='dart'?40:300;
  var pts=base*S.mult;
  api.addScore(pts);
  fx.text(e.x,e.y-e.r-4,'+'+fmt(pts),e.kind==='comet'?'#946200':'#a3365d',12+size*3,0.7,{rise:22,stroke:'rgba(255,255,255,.9)'});
  if(S.combo>=10&&S.combo%10===0) fx.text(W/2,api.H*0.42,'연쇄 ×'+S.combo+'!','#634eb0',26,1.1,{rise:14,stroke:'rgba(255,255,255,.9)'});
  if(S.combo>=S.odNext&&S.od<=0) startOverdrive(api);
  updSub(api);

  var n=e.kind==='rock'?SIZES[e.size].drops:e.kind==='dart'?2:12;
  for(var i=0;i<n;i++) S.drops.push({x:e.x,y:e.y,vx:(rnd()-.5)*170,vy:(rnd()-.5)*170-40,kind:'star',age:0});
  var ch=e.kind==='comet'?1:e.kind==='dart'?0.15:e.size===3?0.12:0;
  if(ch>0&&rnd()<ch) S.drops.push({x:e.x,y:e.y,vx:(rnd()-.5)*60,vy:-60,kind:'power',age:0});
  if(S.drops.length>140) S.drops.splice(0,S.drops.length-140);
}
function startOverdrive(api){
  var fx=api.fx, sh=S.ship;
  S.od=6; S.odNext=S.combo+25;
  fx.flash(0.6,'255,214,107');
  fx.text(W/2,api.H*0.38,'과열 모드!','#ff5f92',36,1.3,{rise:12,stroke:'rgba(255,255,255,.95)'});
  fx.ring(sh.x,sh.y,W,'255,200,90',0.8,3,0.7);
  fx.ring(sh.x,sh.y,W*0.6,'255,126,166',0.6,2,0.6,0.1);
  api.sfx.tone(260,0.55,'sawtooth',0.05,{slide:1300,wet:true});
  api.sfx.pluck(72,0.13); api.sfx.pluck(76,0.13,0.06); api.sfx.pluck(79,0.13,0.12); api.sfx.pluck(84,0.15,0.18);
  api.haptic(30);
}
function playerHit(e,api){
  var fx=api.fx, sh=S.ship;
  S.shields--; api.setLives(S.shields,3);
  kill(e,api,false);
  sh.inv=1.6;
  fx.shake(14); fx.flash(0.9,'255,126,166'); api.haptic(80);
  S.combo=0; S.mult=1; S.power=Math.max(1,S.power-1); S.od=0; updSub(api);
  api.sfx.noise(0.5,0.28,{freq:900,slide:80,wet:true});
  api.sfx.tone(90,0.5,'sine',0.3,{slide:40,wet:false});
  if(S.shields<=0){
    sh.dead=true;
    fx.shards(sh.x,sh.y,30,'#ff7ea6',260,5);
    fx.shards(sh.x,sh.y,14,'#ac97fe',200,4);
    fx.burst(sh.x,sh.y,40,'255,126,166',260,{size:[8,22],life:1});
    fx.burst(sh.x,sh.y,3,'255,214,107',20,{size:[90,140],life:0.3});
    fx.ring(sh.x,sh.y,160,'255,126,166',0.9,4,0.9);
    fx.ring(sh.x,sh.y,260,'172,151,254',1.2,2,0.6,0.12);
    fx.hitstop(0.12); fx.shake(20);
    api.sfx.noise(1.4,0.3,{freq:1800,slide:50,wet:true});
    api.setMeter(null); api.setSub('');
    api.end();
  }
}

/* ---------- 업데이트 ---------- */
function update(dt,api){
  if(!S) fresh(api);
  var H=api.H, sh=S.ship, play=api.state==='play', fx=api.fx, i, j, e;
  sh.y=clamp(sh.y,H*0.45,H-40);

  // 배 이동
  if(play&&!sh.dead){
    var kx=0, ky=0;
    for(var k in keys){ if(keys[k]&&KEYMAP[k]){ kx+=KEYMAP[k][0]; ky+=KEYMAP[k][1]; } }
    if(kx||ky){ sh.x+=kx*280*dt; sh.y+=ky*280*dt; }
    sh.x=clamp(sh.x,14,W-14); sh.y=clamp(sh.y,H*0.45,H-40);
  } else if(api.state==='menu'){
    sh.x=W/2+Math.sin(api.t*0.9)*90; sh.y=H-110+Math.sin(api.t*1.7)*6;
  }
  sh.bank+=((clamp((sh.x-sh.px)/Math.max(dt,0.001)/400,-1,1))-sh.bank)*Math.min(1,dt*10);
  sh.px=sh.x;
  if(sh.inv>0) sh.inv-=dt;
  S.muzzle=Math.max(0,S.muzzle-dt*12);

  // 생성
  if(play){
    S.elapsed+=dt;
    var el=S.elapsed, interval=Math.max(0.32,1.25-el*0.011);
    S.spawnAcc+=dt;
    if(S.spawnAcc>=interval){
      S.spawnAcc-=interval;
      var r=api.rng(), size=r<0.22+Math.min(0.2,el*0.003)?3:r<0.62?2:1;
      var spd=Math.min(150,45+el*0.9)*(1+(3-size)*0.15);
      addRock(size,24+api.rng()*(W-48),-40,(api.rng()-.5)*40,spd*(0.8+api.rng()*0.4));
    }
    if(el>20){
      S.dartAcc+=dt;
      if(S.dartAcc>=Math.max(1.4,4.5-(el-20)*0.03)){ S.dartAcc=0; S.warns.push({x:24+api.rng()*(W-48),t:0.6}); }
    }
    if(el>=S.cometAt){
      S.cometAt=el+16+api.rng()*10;
      var left=api.rng()<0.5;
      S.enemies.push({kind:'comet',x:left?-30:W+30,y:0,by:160+api.rng()*120,vx:left?150:-150,vy:0,r:14,hp:6,rot:0,vr:0,flash:0,ph:0});
      api.sfx.tone(880,0.5,'sine',0.05,{slide:1320});
    }
    if(S.combo>0&&api.t-S.lastKill>1.4){ S.combo=0; S.mult=1; updSub(api); }
    if(S.od>0){ S.od-=dt; if(S.od<=0){ S.od=0; } }
    S.meterAcc+=dt;
    if(S.meterAcc>0.1){
      S.meterAcc=0;
      if(S.od>0) api.setMeter(S.od/6,'과열',true);
      else if(S.combo>0) api.setMeter(1-(S.odNext-S.combo)/25,'과열까지 '+(S.odNext-S.combo),false);
      else api.setMeter(null);
    }
  } else if(api.state==='menu'||api.state==='over'){
    S.ambAcc+=dt;
    if(S.ambAcc>1.1){
      S.ambAcc=0;
      var as=Math.random()<0.3?3:Math.random()<0.6?2:1;
      addRock(as,24+Math.random()*(W-48),-40,(Math.random()-.5)*30,40+Math.random()*30);
    }
  }

  // 경고 뒤 다트 발사
  for(i=S.warns.length-1;i>=0;i--){
    var w=S.warns[i]; w.t-=dt;
    if(w.t<=0){
      S.warns.splice(i,1);
      var vy=280+Math.min(120,S.elapsed);
      S.enemies.push({kind:'dart',x:w.x,y:-20,vx:clamp((sh.x-w.x)*vy/(sh.y+20),-130,130),vy:vy,r:11,hp:2,rot:0,vr:0,flash:0});
      if(play) api.sfx.tone(520,0.18,'triangle',0.04,{slide:260,wet:false});
    }
  }

  // 사격
  if(!sh.dead&&api.state!=='dying'){
    S.fireAcc+=dt;
    var rate=9*(S.od>0?1.6:1);
    while(S.fireAcc>=1/rate){ S.fireAcc-=1/rate; fire(api,play); }
  }

  // 적 이동
  for(i=0;i<S.enemies.length;i++){
    e=S.enemies[i];
    if(e.kind==='comet'){ e.ph+=dt*3; e.x+=e.vx*dt; e.y=e.by+Math.sin(e.ph)*22; }
    else { e.x+=e.vx*dt; e.y+=e.vy*dt; }
    e.rot+=e.vr*dt;
    e.flash=Math.max(0,e.flash-dt*8);
    if(e.kind==='rock'){
      if(e.x<e.r&&e.vx<0) e.vx=-e.vx;
      if(e.x>W-e.r&&e.vx>0) e.vx=-e.vx;
    }
    if(e.y>H+60||e.x<-80||e.x>W+80) e.dead=true;
  }

  // 총알 이동과 충돌
  for(i=S.bullets.length-1;i>=0;i--){
    var b=S.bullets[i];
    b.x+=b.vx*dt; b.y+=b.vy*dt;
    if(b.y<-20||b.x<-20||b.x>W+20){ S.bullets.splice(i,1); continue; }
    for(j=0;j<S.enemies.length;j++){
      e=S.enemies[j]; if(e.dead||e.y<-e.r) continue;
      var dx=b.x-e.x, dy=b.y-e.y, rr=e.r+4;
      if(dx*dx+dy*dy<rr*rr){ hit(e,b,api); S.bullets.splice(i,1); break; }
    }
  }

  // 배와 부딪힘
  if(play&&!sh.dead&&sh.inv<=0){
    for(i=0;i<S.enemies.length;i++){
      e=S.enemies[i]; if(e.dead) continue;
      var ddx=e.x-sh.x, ddy=e.y-sh.y, hr=e.r*0.85+9;
      if(ddx*ddx+ddy*ddy<hr*hr){ playerHit(e,api); break; }
    }
  }
  for(i=S.enemies.length-1;i>=0;i--){ if(S.enemies[i].dead) S.enemies.splice(i,1); }
  if(S.enemies.length>90) S.enemies.splice(0,S.enemies.length-90);

  // 별 조각
  for(i=S.drops.length-1;i>=0;i--){
    var d=S.drops[i]; d.age+=dt;
    if(play&&!sh.dead&&d.age>0.2){
      var mx=sh.x-d.x, my=sh.y-d.y, dist=Math.sqrt(mx*mx+my*my)||1, pull=900+d.age*1800;
      d.vx+=mx/dist*pull*dt; d.vy+=my/dist*pull*dt;
      var dr=Math.exp(-dt*4); d.vx*=dr; d.vy*=dr;
      if(dist<20){ collect(d,api); S.drops.splice(i,1); continue; }
    } else {
      d.vx*=Math.exp(-dt*2); d.vy=d.vy*Math.exp(-dt*2)+60*dt;
      if(d.age>3){ S.drops.splice(i,1); continue; }
    }
    d.x+=d.vx*dt; d.y+=d.vy*dt;
  }
}
function collect(d,api){
  var fx=api.fx, sh=S.ship;
  if(d.kind==='star'){
    api.addScore(5*S.mult);
    fx.burst(sh.x,sh.y-6,2,'255,200,90',60,{size:[4,9],life:0.3});
    if(api.t-S.chimeAt>0.045){
      S.chimeAt=api.t;
      api.sfx.pluck(76+CHIME[Math.min(S.combo,CHIME.length-1)],0.05);
    }
  } else {
    if(S.power<5){
      S.power++; if(S.power>S.maxPower) S.maxPower=S.power;
      fx.text(sh.x,sh.y-34,'화력 '+S.power+'단계!','#006b5b',20,1,{rise:24,stroke:'rgba(255,255,255,.9)'});
    } else {
      api.addScore(200*S.mult);
      fx.text(sh.x,sh.y-34,'+'+fmt(200*S.mult),'#006b5b',20,1,{rise:24,stroke:'rgba(255,255,255,.9)'});
    }
    fx.ring(sh.x,sh.y,70,'86,219,193',0.5,3,0.8);
    fx.burst(sh.x,sh.y,14,'86,219,193',160,{size:[5,12],life:0.5});
    api.sfx.pluck(79,0.12); api.sfx.pluck(84,0.12,0.07); api.sfx.pluck(91,0.12,0.14);
    api.haptic(15);
  }
}

/* ---------- 그리기 ---------- */
function hueRgb(h){
  var l=0.68, sat=0.85, c=(1-Math.abs(2*l-1))*sat, hp=((h%360)+360)%360/60, x=c*(1-Math.abs(hp%2-1)), r=0, g=0, b=0;
  if(hp<1){ r=c; g=x; } else if(hp<2){ r=x; g=c; } else if(hp<3){ g=c; b=x; } else if(hp<4){ g=x; b=c; } else if(hp<5){ r=x; b=c; } else { r=c; b=x; }
  var m=l-c/2;
  return Math.round((r+m)*255)+','+Math.round((g+m)*255)+','+Math.round((b+m)*255);
}
function star4(ctx,x,y,r){
  ctx.beginPath(); ctx.moveTo(x,y-r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.quadraticCurveTo(x,y,x,y+r);
  ctx.quadraticCurveTo(x,y,x-r,y); ctx.quadraticCurveTo(x,y,x,y-r); ctx.closePath(); ctx.fill();
}
function star5(ctx,x,y,R,r,rot){
  ctx.beginPath();
  for(var i=0;i<10;i++){ var a=rot+i*Math.PI/5-Math.PI/2, q=i%2?r:R; if(i) ctx.lineTo(x+Math.cos(a)*q,y+Math.sin(a)*q); else ctx.moveTo(x+Math.cos(a)*q,y+Math.sin(a)*q); }
  ctx.closePath();
}
function face(ctx,x,y,s,mood){
  ctx.fillStyle='#4a2a3e';
  ctx.beginPath(); ctx.arc(x-s*0.32,y-s*0.05,s*0.09,0,Math.PI*2); ctx.arc(x+s*0.32,y-s*0.05,s*0.09,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,110,160,.5)';
  ctx.beginPath(); ctx.ellipse(x-s*0.52,y+s*0.16,s*0.14,s*0.08,0,0,Math.PI*2); ctx.ellipse(x+s*0.52,y+s*0.16,s*0.14,s*0.08,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#4a2a3e'; ctx.lineWidth=Math.max(1,s*0.07); ctx.lineCap='round';
  ctx.beginPath();
  if(mood==='grump'){
    ctx.moveTo(x-s*0.15,y+s*0.24); ctx.quadraticCurveTo(x,y+s*0.12,x+s*0.15,y+s*0.24);
    ctx.moveTo(x-s*0.5,y-s*0.32); ctx.lineTo(x-s*0.18,y-s*0.2); ctx.moveTo(x+s*0.5,y-s*0.32); ctx.lineTo(x+s*0.18,y-s*0.2);
  } else { ctx.moveTo(x-s*0.12,y+s*0.12); ctx.quadraticCurveTo(x,y+s*0.26,x+s*0.12,y+s*0.12); }
  ctx.stroke();
}
function drawRock(ctx,x,y,r,rot,verts,hue,flash){
  ctx.fillStyle='rgba(163,54,93,.13)';
  ctx.beginPath(); ctx.ellipse(x+2,y+5,r*0.92,r*0.88,0,0,Math.PI*2); ctx.fill();
  ctx.save(); ctx.translate(x,y); ctx.rotate(rot);
  var n=verts.length, i, a, b, bb;
  for(i=0;i<n;i++){
    a=verts[i]; b=verts[(i+1)%n]; bb=b.a+(i===n-1?Math.PI*2:0);
    var mid=(a.a+bb)/2, light=Math.cos(mid+rot+2.3);
    ctx.fillStyle='hsl('+Math.round(hue)+' 82% '+Math.round(74+light*10)+'%)';
    ctx.beginPath(); ctx.moveTo(0,0);
    ctx.lineTo(Math.cos(a.a)*a.r*r,Math.sin(a.a)*a.r*r);
    ctx.lineTo(Math.cos(b.a)*b.r*r,Math.sin(b.a)*b.r*r);
    ctx.closePath(); ctx.fill();
  }
  ctx.beginPath();
  for(i=0;i<n;i++){ a=verts[i]; var px=Math.cos(a.a)*a.r*r, py=Math.sin(a.a)*a.r*r; if(i) ctx.lineTo(px,py); else ctx.moveTo(px,py); }
  ctx.closePath();
  ctx.strokeStyle='rgba(255,255,255,.95)'; ctx.lineWidth=1.8; ctx.lineJoin='round'; ctx.stroke();
  if(flash>0){ ctx.globalAlpha=Math.min(1,flash); ctx.fillStyle='#fff'; ctx.fill(); ctx.globalAlpha=1; }
  ctx.restore();
  ctx.fillStyle='rgba(255,255,255,.75)'; star4(ctx,x-r*0.35,y-r*0.42,r*0.16);
  if(r>=17) face(ctx,x,y+r*0.05,r*0.55,'happy');
}
function drawShip(ctx,x,y,s,bank,alpha,muzzle,t){
  ctx.save(); ctx.translate(x,y); ctx.scale(s*(1-Math.abs(bank)*0.25),s);
  ctx.globalAlpha=alpha;
  // 꼬리 불꽃
  var fl=9+Math.sin(t*40)*2.5;
  ctx.fillStyle='#ffb1c5'; ctx.beginPath(); ctx.ellipse(0,15+fl*0.45,5.5,fl,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ffd66b'; ctx.beginPath(); ctx.ellipse(0,14+fl*0.3,3,fl*0.6,0,0,Math.PI*2); ctx.fill();
  // 그림자
  ctx.fillStyle='rgba(163,54,93,.15)'; ctx.beginPath(); ctx.ellipse(2,4,11,16,0,0,Math.PI*2); ctx.fill();
  // 토끼 귀
  for(var e=-1;e<=1;e+=2){
    ctx.save(); ctx.translate(e*5,-16); ctx.rotate(e*0.28);
    ctx.fillStyle='#ffffff'; ctx.strokeStyle='#ff9bb7'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.ellipse(0,-6,3.6,8,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#ffc2d4'; ctx.beginPath(); ctx.ellipse(0,-6,1.6,5.5,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  // 날개
  ctx.fillStyle='#ff7ea6';
  ctx.beginPath(); ctx.moveTo(-7,3); ctx.quadraticCurveTo(-17,8,-15,15); ctx.quadraticCurveTo(-10,13,-6,11); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(7,3); ctx.quadraticCurveTo(17,8,15,15); ctx.quadraticCurveTo(10,13,6,11); ctx.closePath(); ctx.fill();
  // 몸통
  ctx.fillStyle='#ffffff'; ctx.strokeStyle='#ffb1c5'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.ellipse(0,0,9.5,15,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
  // 창문 속 얼굴
  ctx.fillStyle='#d6ccff'; ctx.beginPath(); ctx.arc(0,-3,6,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#3f2a55'; ctx.beginPath(); ctx.arc(-2.1,-3.4,0.95,0,Math.PI*2); ctx.arc(2.1,-3.4,0.95,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,110,160,.6)'; ctx.beginPath(); ctx.arc(-3.6,-1.4,1.2,0,Math.PI*2); ctx.arc(3.6,-1.4,1.2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(2.6,-6,1.3,0,Math.PI*2); ctx.fill();
  if(muzzle>0){ ctx.fillStyle='rgba(255,201,77,'+muzzle+')'; star4(ctx,0,-22,4+muzzle*5); }
  ctx.restore(); ctx.globalAlpha=1;
}
function cloud(ctx,x,y,s){
  ctx.beginPath();
  ctx.arc(x-s*0.9,y+s*0.15,s*0.55,0,Math.PI*2); ctx.arc(x,y-s*0.15,s*0.8,0,Math.PI*2); ctx.arc(x+s*0.9,y+s*0.2,s*0.5,0,Math.PI*2);
  ctx.rect(x-s*0.9,y+s*0.1,s*1.8,s*0.6); ctx.fill();
}
function drawSky(ctx,w,h,t,stars,speed,streak){
  var g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#cfc2ff'); g.addColorStop(0.5,'#ffd6e8'); g.addColorStop(1,'#fff3f9');
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  var G=Arcade.fx.glow;
  ctx.globalAlpha=0.35; ctx.drawImage(G('255,182,210'),-w*0.3,h*0.1,w*0.9,w*0.9);
  ctx.globalAlpha=0.3; ctx.drawImage(G('172,151,254'),w*0.45,h*0.45,w*0.9,w*0.9);
  ctx.globalAlpha=0.3; ctx.drawImage(G('210,251,240'),w*0.05,h*0.7,w*0.7,w*0.7);
  for(var i=0;i<stars.length;i++){
    var s=stars[i], sy=((s.y+t*s.z*speed*(s.cloud?0.4:1))%(h+60)+h+60)%(h+60)-30, sx=s.x*(w/W);
    if(s.cloud){ ctx.globalAlpha=0.55; ctx.fillStyle='#ffffff'; cloud(ctx,sx,sy,8+s.z*8); continue; }
    if(streak){ ctx.globalAlpha=0.6; ctx.fillStyle='#ffffff'; ctx.fillRect(sx,sy-s.z*9,1.5,s.z*9+1); continue; }
    if(s.z>1.4){ ctx.globalAlpha=0.55+0.4*Math.sin(t*2.5+s.p); ctx.fillStyle='#ffffff'; star4(ctx,sx,sy,2+s.z*1.4); }
    else { ctx.globalAlpha=0.35; ctx.fillStyle=i%2?'#ac97fe':'#ff9bb7'; ctx.fillRect(sx,sy,1.8,1.8); }
  }
  ctx.globalAlpha=1;
}
function drawDart(ctx,e){
  ctx.save(); ctx.translate(e.x,e.y);
  ctx.strokeStyle='#ffc94d'; ctx.lineWidth=2.6; ctx.lineJoin='round'; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(1,8); ctx.lineTo(-3,14); ctx.lineTo(1.5,14); ctx.lineTo(-2,21); ctx.stroke();
  ctx.fillStyle='rgba(99,78,176,.15)'; cloud(ctx,1.5,2.5,9.5);
  ctx.fillStyle=e.flash>0?'#ffffff':'#b3a6e6'; cloud(ctx,0,0,9.5);
  face(ctx,0,1,9,'grump');
  ctx.restore();
}
function drawComet(ctx,e,t){
  var dir=e.vx>0?-1:1;
  for(var k=1;k<8;k++){
    ctx.globalAlpha=0.6*(1-k/8); ctx.fillStyle=k%2?'#ffd66b':'#ff9bb7';
    star4(ctx,e.x+dir*k*11,e.y+Math.sin(e.ph-k*0.3)*3,6-k*0.5);
  }
  ctx.globalAlpha=0.5; ctx.drawImage(Arcade.fx.glow('255,200,90'),e.x-26,e.y-26,52,52);
  ctx.globalAlpha=1;
  star5(ctx,e.x,e.y,15,7.5,Math.sin(t*3)*0.2);
  ctx.fillStyle=e.flash>0?'#ffffff':'#ffd66b'; ctx.fill();
  ctx.strokeStyle='#ffffff'; ctx.lineWidth=2; ctx.stroke();
  face(ctx,e.x,e.y+1,7,'happy');
}
function draw(ctx,api){
  if(!S) fresh(api);
  var H=api.H, t=api.t, G=api.fx.glow, i, e, d, fade;
  drawSky(ctx,W,H,t,S.stars,S.od>0?90:28,S.od>0);

  // 번개구름 경고
  for(i=0;i<S.warns.length;i++){
    var w=S.warns[i], wa=0.5+0.5*Math.sin(t*30);
    ctx.strokeStyle='rgba(255,95,146,'+(0.4+wa*0.5)+')'; ctx.lineWidth=3; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(w.x-9,128); ctx.lineTo(w.x,138); ctx.lineTo(w.x+9,128); ctx.stroke();
    ctx.strokeStyle='rgba(255,95,146,.22)'; ctx.lineWidth=1.5; ctx.setLineDash([4,8]);
    ctx.beginPath(); ctx.moveTo(w.x,142); ctx.lineTo(S.ship.x,S.ship.y); ctx.stroke(); ctx.setLineDash([]);
  }

  // 별 조각과 화력 방울
  for(i=0;i<S.drops.length;i++){
    d=S.drops[i]; fade=d.age>2.4?Math.max(0,(3-d.age)/0.6):1;
    ctx.globalAlpha=fade;
    if(d.kind==='star'){
      star5(ctx,d.x,d.y,5.5,2.6,d.age*5);
      ctx.fillStyle='#ffd66b'; ctx.fill(); ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.4; ctx.stroke();
    } else {
      var pr=9+Math.sin(d.age*8);
      ctx.fillStyle='#7fe8d2'; ctx.beginPath(); ctx.arc(d.x,d.y,pr,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=2; ctx.stroke();
      ctx.lineWidth=2.6; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(d.x-4,d.y); ctx.lineTo(d.x+4,d.y); ctx.moveTo(d.x,d.y-4); ctx.lineTo(d.x,d.y+4); ctx.stroke();
    }
  }
  ctx.globalAlpha=1;

  // 적
  for(i=0;i<S.enemies.length;i++){
    e=S.enemies[i];
    if(e.kind==='rock') drawRock(ctx,e.x,e.y,e.r,e.rot,e.verts,e.hue,e.flash);
    else if(e.kind==='dart') drawDart(ctx,e);
    else drawComet(ctx,e,t);
  }

  // 총알: 민트 젤리 알갱이, 과열 때는 버터색
  ctx.lineCap='round';
  for(i=0;i<S.bullets.length;i++){
    var b=S.bullets[i], tx=b.x-b.vx*0.02, ty=b.y-b.vy*0.02;
    ctx.strokeStyle=b.gold?'#ffc94d':'#4fd3b8'; ctx.lineWidth=6;
    ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(tx,ty); ctx.stroke();
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=2.2;
    ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(tx,ty); ctx.stroke();
  }

  // 토끼 로켓
  var sh=S.ship;
  if(!sh.dead){
    var blink=sh.inv>0&&Math.floor(t*20)%2===0;
    if(S.od>0){
      ctx.globalAlpha=0.45+0.15*Math.sin(t*20);
      ctx.drawImage(G('255,200,90'),sh.x-44,sh.y-44,88,88);
      ctx.globalAlpha=1;
    }
    drawShip(ctx,sh.x,sh.y,1,sh.bank,blink?0.3:1,S.muzzle,t);
  }
}

/* ---------- 미리보기 ---------- */
function preview(ctx,w,h,t){
  if(!PV){
    PV={stars:mkStars(),rocks:[]};
    for(var i=0;i<5;i++) PV.rocks.push({x:0.12+i*0.19,ph:Math.random(),r:[22,13,8,17,10][i],verts:makeVerts(9,0.3),hue:CANDY[i],vr:(Math.random()-.5)*1.6,sp:0.05+Math.random()*0.04});
  }
  drawSky(ctx,w,h,t,PV.stars,26,false);
  var sx=w/2+Math.sin(t*1.1)*w*0.22, sy=h*0.8;
  for(var j=0;j<PV.rocks.length;j++){
    var p=PV.rocks[j], y=((p.ph+t*p.sp)%1.25)*h*1.1-h*0.15;
    drawRock(ctx,p.x*w+Math.sin(t*0.7+j)*8,y,p.r,t*p.vr,p.verts,p.hue,0);
  }
  ctx.lineCap='round';
  for(var k=0;k<9;k++){
    var by=sy-22-((t*430+k*44)%(h*0.9));
    for(var s=-1;s<=1;s++){
      ctx.strokeStyle='#4fd3b8'; ctx.lineWidth=5;
      ctx.beginPath(); ctx.moveTo(sx+s*9,by); ctx.lineTo(sx+s*9,by+12); ctx.stroke();
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(sx+s*9,by); ctx.lineTo(sx+s*9,by+12); ctx.stroke();
    }
  }
  var ph=(t*0.55)%1;
  if(ph<0.4){
    var q=ph/0.4, ex=w*0.32, ey=h*0.34;
    ctx.globalAlpha=1-q;
    ctx.fillStyle='#ffd66b';
    for(var m=0;m<6;m++){ var an=m*1.047+q; star4(ctx,ex+Math.cos(an)*q*50,ey+Math.sin(an)*q*50,5*(1-q)+2); }
    ctx.strokeStyle='#ff7ea6'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(ex,ey,10+q*60,0,Math.PI*2); ctx.stroke();
  }
  ctx.globalAlpha=1;
  drawShip(ctx,sx,sy,1.25,Math.cos(t*1.1)*0.4,1,0.5+0.5*Math.sin(t*50),t);
}

/* ---------- 등록 ---------- */
Arcade.register({
  id:'meteor',
  title:'별똥별 요격',
  kicker:'슈팅 · 드래그',
  blurb:'말랑한 사탕 별똥별을 톡톡 쪼개요',
  lede:'손가락을 따라다니는 토끼 로켓이 쉬지 않고 쏴요. 큰 별똥별은 둘로, 또 둘로 쪼개져요. 쉬지 않고 이어서 부수면 과열 모드로 화력이 팡팡!',
  how:'화면 아무 곳이나 끌어서 이동 · 사격은 자동 · 번개구름은 피하거나 쏘기 · 키보드는 방향키',
  palette:{bg:'#fbefff',surface:'#ffffff',surface2:'#f6eaff',line:'#e3d3ff',text:'#21172b',muted:'#887176',
    accent:'#7b61e8',accentInk:'#ffffff',accentDeep:'#4b3596',hot:'#ff5f92',hotText:'#ff5f92',hotRgb:'255,95,146',light:true},
  lifeIcon:'shield',
  endDelay:1200,
  start:function(api){
    fresh(api); keys={};
    if(api.state==='play'){ api.setLives(3,3); api.setSub(''); api.setMeter(null); }
  },
  update:update,
  draw:draw,
  pointer:function(type,x,y,api){
    if(!S||S.ship.dead) return;
    if(type==='down'){ S.lastX=x; S.lastY=y; }
    else if(type==='move'&&api.pointerDown){
      var sh=S.ship;
      sh.x=clamp(sh.x+(x-S.lastX)*1.25,14,W-14);
      sh.y=clamp(sh.y+(y-S.lastY)*1.25,api.H*0.45,api.H-40);
      S.lastX=x; S.lastY=y;
    }
  },
  key:function(type,code){
    if(!KEYMAP[code]) return false;
    keys[code]=type==='down';
    return true;
  },
  preview:preview,
  result:function(){
    var s=Math.floor(S.elapsed), tm=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
    return {
      stats:[['격추',fmt(S.kills)],['최대 콤보',S.maxCombo],['버틴 시간',tm]],
      line:S.kills>0?'별똥별 '+fmt(S.kills)+'개를 톡톡 부쉈어요. 화력은 '+S.maxPower+'단계까지!':'손가락을 조금 더 크게 움직이면 피하기 쉬워요.'
    };
  }
});
})();

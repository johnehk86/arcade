/* 유성 요격: 드래그로 움직이고 자동으로 쏘는 세로 슈팅.
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
  for(var i=0;i<70;i++) s.push({x:Math.random()*W,y:Math.random()*900,z:0.3+Math.random()*1.7});
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
function addRock(size,x,y,vx,vy){
  var d=SIZES[size];
  S.enemies.push({kind:'rock',size:size,x:x,y:y,vx:vx,vy:vy,r:d.r,hp:d.hp,rot:Math.random()*6.28,vr:(Math.random()-.5)*2.2,
    verts:makeVerts(d.verts,0.35),hue:d.hue+(Math.random()-.5)*8,flash:0});
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
  api.fx.burst(b.x,b.y,3,'255,240,200',120,{size:[3,7],life:0.25});
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
  var col=e.kind==='rock'?'hsl('+Math.round(e.hue)+' 90% 62%)':e.kind==='dart'?'#ff6b8f':'#ffd76a';
  var rgb=e.kind==='rock'?'255,150,90':e.kind==='dart'?'255,110,150':'255,215,120';
  fx.shards(e.x,e.y,4+size*4,col,90+size*55,3+size*1.5);
  fx.burst(e.x,e.y,6+size*6,rgb,80+size*60,{size:[6,14+size*4],life:0.6});
  fx.burst(e.x,e.y,2,'255,250,235',20,{size:[e.r*2.2,e.r*3.2],life:0.18});
  fx.ring(e.x,e.y,e.r*2.6,rgb,0.45,2+size*0.6,0.7);
  fx.shake(size===3?7:size===2?3.5:1.5);
  if(size===3){ fx.hitstop(e.kind==='comet'?0.08:0.06); fx.pulse(0.6); }
  else if(size===2&&e.kind==='rock') fx.hitstop(0.03);
  if(play) boom(api,size,size>=3);

  var rnd=play?api.rng:Math.random;
  if(e.kind==='rock'&&e.size>1){
    for(var k=0;k<2;k++){
      var dir=k?1:-1;
      addRock(e.size-1,e.x+dir*e.r*0.45,e.y,e.vx*0.5+dir*(50+rnd()*45),Math.max(30,e.vy*0.8)+rnd()*20);
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
  fx.text(e.x,e.y-e.r-4,'+'+fmt(pts),e.kind==='comet'?'#ffe08a':'#fff1df',12+size*3,0.7,{rise:22});
  if(S.combo>=10&&S.combo%10===0) fx.text(W/2,api.H*0.42,'연쇄 ×'+S.combo,'#ffd9a8',26,1.1,{rise:14});
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
  fx.flash(0.6,'255,210,120');
  fx.text(W/2,api.H*0.38,'과열!','#ffd27a',36,1.3,{rise:12});
  fx.ring(sh.x,sh.y,W,'255,210,120',0.8,3,0.6);
  fx.ring(sh.x,sh.y,W*0.6,'255,240,200',0.6,2,0.5,0.1);
  api.sfx.tone(260,0.55,'sawtooth',0.05,{slide:1300,wet:true});
  api.sfx.pluck(72,0.13); api.sfx.pluck(76,0.13,0.06); api.sfx.pluck(79,0.13,0.12); api.sfx.pluck(84,0.15,0.18);
  api.haptic(30);
}
function playerHit(e,api){
  var fx=api.fx, sh=S.ship;
  S.shields--; api.setLives(S.shields,3);
  kill(e,api,false);
  sh.inv=1.6;
  fx.shake(14); fx.flash(0.9,'255,80,100'); api.haptic(80);
  S.combo=0; S.mult=1; S.power=Math.max(1,S.power-1); S.od=0; updSub(api);
  api.sfx.noise(0.5,0.28,{freq:900,slide:80,wet:true});
  api.sfx.tone(90,0.5,'sine',0.3,{slide:40,wet:false});
  if(S.shields<=0){
    sh.dead=true;
    fx.shards(sh.x,sh.y,30,'#fff3dc',260,5);
    fx.burst(sh.x,sh.y,40,'150,245,215',260,{size:[8,22],life:1});
    fx.burst(sh.x,sh.y,3,'255,250,240',20,{size:[90,140],life:0.3});
    fx.ring(sh.x,sh.y,160,'255,240,220',0.9,4,0.9);
    fx.ring(sh.x,sh.y,260,'150,245,215',1.2,2,0.6,0.12);
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
    fx.burst(sh.x,sh.y-6,2,'255,225,140',60,{size:[4,9],life:0.3});
    if(api.t-S.chimeAt>0.045){
      S.chimeAt=api.t;
      api.sfx.pluck(76+CHIME[Math.min(S.combo,CHIME.length-1)],0.05);
    }
  } else {
    if(S.power<5){
      S.power++; if(S.power>S.maxPower) S.maxPower=S.power;
      fx.text(sh.x,sh.y-34,'화력 '+S.power+'단계','#9ff7d8',20,1,{rise:24});
    } else {
      api.addScore(200*S.mult);
      fx.text(sh.x,sh.y-34,'+'+fmt(200*S.mult),'#9ff7d8',20,1,{rise:24});
    }
    fx.ring(sh.x,sh.y,70,'150,245,215',0.5,3,0.8);
    fx.burst(sh.x,sh.y,14,'150,245,215',160,{size:[5,12],life:0.5});
    api.sfx.pluck(79,0.12); api.sfx.pluck(84,0.12,0.07); api.sfx.pluck(91,0.12,0.14);
    api.haptic(15);
  }
}

/* ---------- 그리기 ---------- */
function drawRock(ctx,x,y,r,rot,verts,hue,flash){
  ctx.save(); ctx.translate(x,y); ctx.rotate(rot);
  var n=verts.length, i, a, b, bb;
  for(i=0;i<n;i++){
    a=verts[i]; b=verts[(i+1)%n]; bb=b.a+(i===n-1?Math.PI*2:0);
    var mid=(a.a+bb)/2, light=Math.cos(mid+rot+2.3);
    ctx.fillStyle='hsl('+Math.round(hue)+' 78% '+Math.round(46+light*17)+'%)';
    ctx.beginPath(); ctx.moveTo(0,0);
    ctx.lineTo(Math.cos(a.a)*a.r*r,Math.sin(a.a)*a.r*r);
    ctx.lineTo(Math.cos(b.a)*b.r*r,Math.sin(b.a)*b.r*r);
    ctx.closePath(); ctx.fill();
  }
  ctx.beginPath();
  for(i=0;i<n;i++){ a=verts[i]; var px=Math.cos(a.a)*a.r*r, py=Math.sin(a.a)*a.r*r; if(i) ctx.lineTo(px,py); else ctx.moveTo(px,py); }
  ctx.closePath();
  ctx.strokeStyle='hsl('+Math.round(hue)+' 95% 80%)'; ctx.lineWidth=1.2; ctx.stroke();
  if(flash>0){ ctx.globalAlpha=Math.min(1,flash); ctx.fillStyle='#fff'; ctx.fill(); ctx.globalAlpha=1; }
  ctx.restore();
}
function drawShip(ctx,x,y,s,bank,alpha,muzzle,t){
  var G=Arcade.fx.glow;
  ctx.save(); ctx.translate(x,y); ctx.scale(s*(1-Math.abs(bank)*0.25),s);
  ctx.globalAlpha=alpha;
  ctx.globalCompositeOperation='lighter';
  var fl=16+Math.sin(t*40)*4;
  ctx.drawImage(G('120,240,210'),-fl/2,8,fl,fl*1.6);
  ctx.drawImage(G('255,255,255'),-5,10,10,10);
  if(muzzle>0){ var m=18*muzzle; ctx.drawImage(G('200,255,235'),-m/2,-22-m/2,m,m); }
  ctx.globalCompositeOperation='source-over';
  ctx.fillStyle='#fff3dc';
  ctx.beginPath();
  ctx.moveTo(0,-20); ctx.lineTo(6,-4); ctx.lineTo(15,10); ctx.lineTo(5,8); ctx.lineTo(0,14);
  ctx.lineTo(-5,8); ctx.lineTo(-15,10); ctx.lineTo(-6,-4); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#d9c3a0';
  ctx.beginPath(); ctx.moveTo(0,-20); ctx.lineTo(-6,-4); ctx.lineTo(-15,10); ctx.lineTo(-5,8); ctx.lineTo(0,14); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#7ff0cf';
  ctx.beginPath(); ctx.ellipse(0,-4,2.6,5,0,0,Math.PI*2); ctx.fill();
  ctx.restore(); ctx.globalAlpha=1;
}
function drawSky(ctx,w,h,t,stars,speed,streak){
  var g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#0a1238'); g.addColorStop(0.6,'#191050'); g.addColorStop(1,'#2b0f4c');
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  var G=Arcade.fx.glow;
  ctx.globalAlpha=0.2; ctx.drawImage(G('110,90,255'),-w*0.25,h*0.15,w*0.9,w*0.9);
  ctx.globalAlpha=0.12; ctx.drawImage(G('255,120,150'),w*0.5,h*0.5,w*0.8,w*0.8);
  ctx.globalAlpha=1;
  ctx.fillStyle='#dfe6ff';
  for(var i=0;i<stars.length;i++){
    var s=stars[i], sy=((s.y+t*s.z*speed)%(h+10)+h+10)%(h+10)-5, sx=s.x*(w/W);
    ctx.globalAlpha=0.25+s.z*0.3;
    if(streak) ctx.fillRect(sx,sy-s.z*8,1,s.z*8+1);
    else ctx.fillRect(sx,sy,s.z>1.3?1.6:1,s.z>1.3?1.6:1);
  }
  ctx.globalAlpha=1;
}
function draw(ctx,api){
  if(!S) fresh(api);
  var H=api.H, t=api.t, G=api.fx.glow, i, e;
  drawSky(ctx,W,H,t,S.stars,S.od>0?90:28,S.od>0);

  // 다트 경고
  for(i=0;i<S.warns.length;i++){
    var w=S.warns[i], wa=0.5+0.5*Math.sin(t*30);
    ctx.strokeStyle='rgba(255,110,150,'+(0.35+wa*0.5)+')'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(w.x-9,128); ctx.lineTo(w.x,138); ctx.lineTo(w.x+9,128); ctx.stroke();
    ctx.strokeStyle='rgba(255,110,150,.12)'; ctx.lineWidth=1; ctx.setLineDash([4,8]);
    ctx.beginPath(); ctx.moveTo(w.x,142); ctx.lineTo(S.ship.x,S.ship.y); ctx.stroke(); ctx.setLineDash([]);
  }

  // 별 조각
  ctx.globalCompositeOperation='lighter';
  for(i=0;i<S.drops.length;i++){
    var d=S.drops[i], fade=d.age>2.4?Math.max(0,(3-d.age)/0.6):1;
    ctx.globalAlpha=fade;
    if(d.kind==='star') ctx.drawImage(G('255,220,130'),d.x-7,d.y-7,14,14);
    else ctx.drawImage(G('150,245,215'),d.x-16,d.y-16,32,32);
  }
  ctx.globalCompositeOperation='source-over';
  for(i=0;i<S.drops.length;i++){
    d=S.drops[i]; fade=d.age>2.4?Math.max(0,(3-d.age)/0.6):1;
    ctx.globalAlpha=fade;
    if(d.kind==='star'){
      ctx.fillStyle='#ffe7a8'; ctx.save(); ctx.translate(d.x,d.y); ctx.rotate(d.age*6);
      ctx.beginPath(); ctx.moveTo(0,-4); ctx.lineTo(1.2,-1.2); ctx.lineTo(4,0); ctx.lineTo(1.2,1.2); ctx.lineTo(0,4); ctx.lineTo(-1.2,1.2); ctx.lineTo(-4,0); ctx.lineTo(-1.2,-1.2); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else {
      ctx.strokeStyle='#9ff7d8'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(d.x,d.y,8+Math.sin(d.age*8),0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(d.x-4,d.y); ctx.lineTo(d.x+4,d.y); ctx.moveTo(d.x,d.y-4); ctx.lineTo(d.x,d.y+4); ctx.stroke();
    }
  }
  ctx.globalAlpha=1;

  // 적
  for(i=0;i<S.enemies.length;i++){
    e=S.enemies[i];
    if(e.kind==='rock') drawRock(ctx,e.x,e.y,e.r,e.rot,e.verts,e.hue,e.flash);
    else if(e.kind==='dart'){
      ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=0.6; ctx.drawImage(G('255,110,150'),e.x-20,e.y-30,40,40); ctx.globalAlpha=1;
      ctx.globalCompositeOperation='source-over';
      var ang=Math.atan2(e.vy,e.vx)-Math.PI/2;
      ctx.save(); ctx.translate(e.x,e.y); ctx.rotate(ang);
      ctx.fillStyle=e.flash>0?'#ffffff':'#ff6b8f';
      ctx.beginPath(); ctx.moveTo(0,14); ctx.lineTo(9,-10); ctx.lineTo(0,-5); ctx.lineTo(-9,-10); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#ffd0de'; ctx.beginPath(); ctx.moveTo(0,14); ctx.lineTo(3,-3); ctx.lineTo(0,-5); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else {
      ctx.globalCompositeOperation='lighter';
      var dir=e.vx>0?-1:1;
      for(var k=1;k<8;k++){ ctx.globalAlpha=0.5*(1-k/8); var sz=28-k*2.5; ctx.drawImage(G('255,200,110'),e.x+dir*k*11-sz/2,e.y-sz/2+Math.sin(e.ph-k*0.3)*3,sz,sz); }
      ctx.globalAlpha=0.9; ctx.drawImage(G('255,230,160'),e.x-28,e.y-28,56,56);
      ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
      ctx.fillStyle=e.flash>0?'#ffffff':'#ffe08a';
      ctx.beginPath(); ctx.arc(e.x,e.y,9,0,Math.PI*2); ctx.fill();
    }
  }

  // 총알
  ctx.globalCompositeOperation='lighter';
  ctx.lineCap='round';
  for(i=0;i<S.bullets.length;i++){
    var b=S.bullets[i];
    ctx.strokeStyle=b.gold?'rgba(255,215,120,.9)':'rgba(140,245,210,.85)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(b.x-b.vx*0.028,b.y-b.vy*0.028); ctx.stroke();
    ctx.globalAlpha=0.8; ctx.drawImage(G(b.gold?'255,215,120':'140,245,210'),b.x-7,b.y-7,14,14); ctx.globalAlpha=1;
  }
  ctx.globalCompositeOperation='source-over';

  // 배
  var sh=S.ship;
  if(!sh.dead){
    var blink=sh.inv>0&&Math.floor(t*20)%2===0;
    if(S.od>0){
      ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=0.35+0.15*Math.sin(t*20);
      ctx.drawImage(G('255,210,120'),sh.x-40,sh.y-40,80,80);
      ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
    }
    drawShip(ctx,sh.x,sh.y,1,sh.bank,blink?0.3:1,S.muzzle,t);
  }
}

/* ---------- 미리보기 ---------- */
function preview(ctx,w,h,t){
  if(!PV){
    PV={stars:mkStars(),rocks:[]};
    for(var i=0;i<5;i++) PV.rocks.push({x:0.12+i*0.19,ph:Math.random(),r:[22,13,8,17,10][i],verts:makeVerts(9,0.35),hue:[10,24,38,16,30][i],vr:(Math.random()-.5)*1.6,sp:0.05+Math.random()*0.04});
  }
  drawSky(ctx,w,h,t,PV.stars,26,false);
  var G=Arcade.fx.glow, sx=w/2+Math.sin(t*1.1)*w*0.22, sy=h*0.8;
  for(var j=0;j<PV.rocks.length;j++){
    var p=PV.rocks[j], y=((p.ph+t*p.sp)%1.25)*h*1.1-h*0.15;
    drawRock(ctx,p.x*w+Math.sin(t*0.7+j)*8,y,p.r,t*p.vr,p.verts,p.hue,0);
  }
  ctx.globalCompositeOperation='lighter'; ctx.lineCap='round';
  for(var k=0;k<9;k++){
    var by=sy-22-((t*430+k*44)%(h*0.9));
    for(var s=-1;s<=1;s++){
      ctx.strokeStyle='rgba(140,245,210,.8)'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(sx+s*9,by); ctx.lineTo(sx+s*9,by+16); ctx.stroke();
    }
  }
  var ph=(t*0.55)%1;
  if(ph<0.4){
    var q=ph/0.4, ex=w*0.32, ey=h*0.34;
    ctx.globalAlpha=1-q; ctx.drawImage(G('255,170,100'),ex-60*q-20,ey-60*q-20,120*q+40,120*q+40);
    ctx.globalAlpha=1;
    ctx.globalCompositeOperation='source-over';
    ctx.strokeStyle='rgba(255,190,130,'+(1-q)+')'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(ex,ey,10+q*60,0,Math.PI*2); ctx.stroke();
  }
  ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
  drawShip(ctx,sx,sy,1.15,Math.cos(t*1.1)*0.4,1,0.5+0.5*Math.sin(t*50),t);
}

/* ---------- 등록 ---------- */
Arcade.register({
  id:'meteor',
  title:'유성 요격',
  kicker:'슈팅 · 드래그',
  blurb:'쏟아지는 유성을 쪼개고 또 쪼개는 쾌감',
  lede:'손가락을 따라 움직이는 배가 쉬지 않고 쏩니다. 큰 유성은 둘로, 다시 둘로 쪼개져요. 이어서 부수면 과열 상태로 화력이 폭발해요.',
  how:'화면 아무 곳이나 드래그해 이동 · 사격은 자동 · 키보드는 방향키',
  palette:{bg:'#0d1340',surface:'#151a52',surface2:'#1f2468',line:'#353c8f',text:'#f3f1ff',muted:'#a9aee0',
    accent:'#ff9a52',accentInk:'#2a1300',accentDeep:'#b85d1f',hot:'#ff6b8f',hotText:'#ffb3c7',hotRgb:'255,140,170'},
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
      line:S.kills>0?'유성 '+fmt(S.kills)+'개를 부쉈어요. 화력은 '+S.maxPower+'단계까지 올렸어요.':'손가락을 조금 더 크게 움직이면 피하기 쉬워요.'
    };
  }
});
})();

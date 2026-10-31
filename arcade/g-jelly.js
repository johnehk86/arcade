/* 젤리 점프: 스타 버니 루루가 젤리 발판을 밟고 끝없이 올라가는 세로 점프 게임.
   좌표는 월드 좌표(위로 갈수록 y가 작아짐), 카메라는 위로만 따라간다. 1점 = 10px = 1m. */
(function(){
'use strict';
var U=Arcade.util, clamp=U.clamp, lerp=U.lerp;
var W=360, G=1500, JUMP=-720, SPRING=-1150, CLOUD=-960, MOVE=270;

var S=null;
var keys={l:false,r:false};

/* ---------- 하늘 색: 높이에 따라 분홍 → 라벤더 → 민트 → 별밤 ---------- */
var SKY=[
  [[255,214,232],[255,246,251]],
  [[214,199,255],[251,240,255]],
  [[176,240,224],[240,252,248]],
  [[59,47,107],[120,98,190]]
];
function mix(a,b,k){ return [Math.round(lerp(a[0],b[0],k)),Math.round(lerp(a[1],b[1],k)),Math.round(lerp(a[2],b[2],k))]; }
function skyAt(m){
  var f=clamp(m/3000,0,2.999), i=Math.floor(f), k=f-i;
  return [mix(SKY[i][0],SKY[i+1][0],k),mix(SKY[i][1],SKY[i+1][1],k)];
}
function rgb(c){ return 'rgb('+c[0]+','+c[1]+','+c[2]+')'; }

/* ---------- 그리기 도구 ---------- */
function rr(ctx,x,y,w,h,r){
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function drawCloud(ctx,x,y,s,a){
  ctx.globalAlpha=a; ctx.fillStyle='#ffffff';
  ctx.beginPath();
  ctx.arc(x,y,16*s,0,Math.PI*2); ctx.arc(x+18*s,y-8*s,20*s,0,Math.PI*2);
  ctx.arc(x+40*s,y,16*s,0,Math.PI*2); ctx.arc(x+20*s,y+6*s,16*s,0,Math.PI*2);
  ctx.fill(); ctx.globalAlpha=1;
}
function drawStar(ctx,x,y,r,c){
  ctx.fillStyle=c; ctx.beginPath();
  for(var i=0;i<10;i++){ var a=-Math.PI/2+i*Math.PI/5, rad=i%2?r*0.45:r; ctx.lineTo(x+Math.cos(a)*rad,y+Math.sin(a)*rad); }
  ctx.closePath(); ctx.fill();
}
function drawTwinkle(ctx,x,y,r,a){
  ctx.globalAlpha=a; ctx.fillStyle='#ffffff';
  ctx.beginPath(); ctx.moveTo(x,y-r); ctx.lineTo(x+r*0.25,y-r*0.25); ctx.lineTo(x+r,y); ctx.lineTo(x+r*0.25,y+r*0.25);
  ctx.lineTo(x,y+r); ctx.lineTo(x-r*0.25,y+r*0.25); ctx.lineTo(x-r,y); ctx.lineTo(x-r*0.25,y-r*0.25); ctx.closePath(); ctx.fill();
  ctx.globalAlpha=1;
}
var PCOL={normal:['#ff9bb7','#ff5f92','#ffd9e1'],move:['#c4b3ff','#8f78e8','#ece6ff'],spring:['#76f8dc','#2bbca3','#d2fbf0'],crumb:['#ffd1ea','#e6a6d6','#fff3fa']};
function drawPlat(ctx,x,y,w,type,jig,s){
  s=s||1;
  var h=14*s, sq=1+Math.sin(jig*30)*jig*0.35, ww=w*(1+(sq-1)*0.4), hh=h*(2-sq);
  var x0=x-ww/2, y0=y;
  ctx.fillStyle='rgba(119,17,60,.10)'; rr(ctx,x0+2*s,y0+5*s,ww,hh,hh/2); ctx.fill();
  if(type==='cloud'){
    drawCloud(ctx,x-ww*0.38,y0+hh*0.4,ww/60,1);
    ctx.fillStyle='rgba(172,151,254,.35)'; rr(ctx,x0+6*s,y0+hh*0.9,ww-12*s,3*s,1.5*s); ctx.fill();
    return;
  }
  if(type==='crumb'){
    var c=PCOL.crumb;
    for(var i=0;i<5;i++){ ctx.fillStyle=i%2?c[0]:c[2]; ctx.beginPath(); ctx.arc(x0+ww*(0.12+i*0.19),y0+hh*0.5,hh*0.75,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle='rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(x0+ww*0.3,y0+hh*0.25,hh*0.25,0,Math.PI*2); ctx.fill();
    return;
  }
  var col=PCOL[type]||PCOL.normal;
  ctx.fillStyle=col[1]; rr(ctx,x0,y0+2*s,ww,hh,hh/2); ctx.fill();
  ctx.fillStyle=col[0]; rr(ctx,x0,y0,ww,hh-2*s,(hh-2*s)/2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.75)'; rr(ctx,x0+6*s,y0+2.5*s,ww*0.45,3*s,1.5*s); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(x0+ww*0.62,y0+4*s,1.6*s,0,Math.PI*2); ctx.fill();
  if(type==='spring'){
    ctx.strokeStyle='#006b5b'; ctx.lineWidth=2*s; ctx.beginPath();
    var cy=y0-2*s;
    for(var k=0;k<4;k++){ ctx.moveTo(x-7*s,cy-k*3*s); ctx.lineTo(x+7*s,cy-k*3*s-1.5*s); }
    ctx.stroke();
    ctx.fillStyle='#56dbc1'; rr(ctx,x-9*s,cy-14*s,18*s,4*s,2*s); ctx.fill();
  }
}
function drawCandy(ctx,x,y,s,hue){
  var c=['#ff7ea6','#ac97fe','#56dbc1','#ffd66b'][hue%4];
  ctx.fillStyle=c;
  ctx.beginPath(); ctx.moveTo(x-7*s,y); ctx.lineTo(x-13*s,y-5*s); ctx.lineTo(x-13*s,y+5*s); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x+7*s,y); ctx.lineTo(x+13*s,y-5*s); ctx.lineTo(x+13*s,y+5*s); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(x,y,7.5*s,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=1.6*s;
  ctx.beginPath(); ctx.arc(x,y,4*s,Math.PI*0.9,Math.PI*1.9); ctx.stroke();
}
/* 루루: y는 발끝. sx/sy는 찌그러짐, rot는 회전 */
function drawBunny(ctx,x,y,s,sx,sy,rot,face,blink){
  ctx.save();
  ctx.translate(x,y); ctx.rotate(rot||0); ctx.scale(sx*face,sy);
  ctx.fillStyle='rgba(119,17,60,.12)'; ctx.beginPath(); ctx.ellipse(0,0,13*s,3.5*s,0,0,Math.PI*2); ctx.fill();
  // 귀
  for(var e=-1;e<=1;e+=2){
    ctx.save(); ctx.translate(e*6*s,-27*s); ctx.rotate(e*0.18);
    ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.ellipse(0,-10*s,5.2*s,12*s,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(163,54,93,.35)'; ctx.lineWidth=1.2*s; ctx.stroke();
    ctx.fillStyle='#ffb1c5'; ctx.beginPath(); ctx.ellipse(0,-10*s,2.6*s,8.5*s,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  // 몸
  ctx.fillStyle='#ffffff';
  ctx.beginPath(); ctx.ellipse(0,-14*s,15*s,14*s,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(163,54,93,.35)'; ctx.lineWidth=1.4*s; ctx.stroke();
  // 별 헤드셋
  ctx.strokeStyle='#ac97fe'; ctx.lineWidth=2*s;
  ctx.beginPath(); ctx.arc(0,-16*s,14.5*s,Math.PI*1.15,Math.PI*1.85); ctx.stroke();
  drawStar(ctx,10*s,-27*s,5*s,'#ffd66b');
  ctx.fillStyle='#ac97fe'; ctx.beginPath(); ctx.arc(-13.5*s,-15*s,3*s,0,Math.PI*2); ctx.fill();
  // 얼굴
  ctx.fillStyle='#21172b';
  if(blink){ ctx.fillRect(1*s,-16*s,4*s,1.2*s); ctx.fillRect(8*s,-16*s,4*s,1.2*s); }
  else { ctx.beginPath(); ctx.arc(3*s,-15.5*s,1.9*s,0,Math.PI*2); ctx.arc(10*s,-15.5*s,1.9*s,0,Math.PI*2); ctx.fill(); }
  ctx.fillStyle='rgba(255,126,166,.55)';
  ctx.beginPath(); ctx.ellipse(0*s,-11*s,2.8*s,1.6*s,0,0,Math.PI*2); ctx.ellipse(13*s,-11*s,2.4*s,1.5*s,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#77113c'; ctx.lineWidth=1.1*s;
  ctx.beginPath(); ctx.arc(6.5*s,-12*s,1.6*s,0.2,Math.PI-0.2); ctx.stroke();
  // 꼬리
  ctx.fillStyle='#ffe4ee'; ctx.beginPath(); ctx.arc(-15*s,-8*s,3.6*s,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

/* ---------- 발판 만들기 (게임 판은 api.rng, 메뉴 연출은 Math.random) ---------- */
function heightM(y){ return Math.max(0,(S.baseY-y)/10); }
function addPlat(api,y){
  var rnd=S.rnd, hm=heightM(y);
  var w=Math.max(54,76-hm*0.006);
  var r=rnd(), type='normal';
  var pMove=Math.min(0.34,hm/4000), pCrumb=Math.min(0.22,hm/5000);
  if(r<0.07) type='spring';
  else if(r<0.1) type='cloud';
  else if(r<0.1+pMove) type='move';
  else if(r<0.1+pMove+pCrumb) type='crumb';
  if(type==='cloud') w*=1.5;
  var p={x:w/2+rnd()*(W-w),y:y,w:w,type:type,vx:0,jig:0,dead:false};
  if(type==='move') p.vx=(rnd()<0.5?-1:1)*(45+rnd()*50+Math.min(60,hm*0.01));
  S.plats.push(p);
  if(type!=='crumb'&&rnd()<0.3) S.items.push({x:p.x+(rnd()-0.5)*p.w*0.5,y:y-34,kind:'candy',hue:Math.floor(rnd()*4),dead:false});
  else if(hm>150&&rnd()<0.013) S.items.push({x:p.x,y:y-40,kind:'rocket',dead:false});
}
function gapFor(hm){
  var lo=55+Math.min(50,hm*0.02), hi=Math.min(145,85+hm*0.025);
  return lo+S.rnd()*(hi-lo);
}
function fill(api){
  while(S.nextY>S.cam-220){ addPlat(api,S.nextY); S.nextY-=gapFor(heightM(S.nextY)); }
}

function newState(api,attract){
  var H=api.H, base=H-90;
  S={attract:attract,rnd:attract?Math.random:api.rng,plats:[],items:[],baseY:base,cam:0,nextY:0,
    b:{x:W/2,y:base,vy:JUMP,face:1,sx:1,sy:1,rot:0,spin:0,lastPlat:null},
    maxH:0,pts:0,candies:0,combo:0,maxCombo:0,candyStreak:0,candyAt:-9,rocket:0,milestone:1,
    hold:0,lastX:0,downX:0,dragged:false,blinkAt:2,fell:false,t:0};
  S.plats.push({x:W/2,y:base,w:120,type:'normal',vx:0,jig:0,dead:false});
  if(attract){
    S.plats.push({x:W*0.26,y:base-120,w:76,type:'normal',vx:0,jig:0,dead:false});
    S.plats.push({x:W*0.74,y:base-120,w:76,type:'spring',vx:0,jig:0,dead:false});
    S.target=1;
  } else {
    S.nextY=base-70;
    fill(api);
  }
}
function mult(){ return Math.min(5,1+Math.floor(S.combo/2)); }
function updateSub(api){ api.setSub(S.combo>=2?'딱! 콤보 '+S.combo+' · ×'+mult():(S.rocket>0?'별빛 로켓!':'')); }

/* ---------- 착지 ---------- */
function land(api,p){
  var b=S.b, fx=api.fx, sfx=api.sfx, play=api.state==='play';
  var v=p.type==='spring'?SPRING:p.type==='cloud'?CLOUD:JUMP;
  b.vy=v; b.y=p.y; b.sx=1.35; b.sy=0.68; p.jig=1;
  fx.burst(b.x,p.y,6,p.type==='spring'?'86,219,193':'255,182,210',90,{size:[4,9],life:0.5,gravity:300,angle:-Math.PI/2,spread:2.4});
  if(p.type==='spring'){
    b.spin=1; fx.shake(3); fx.ring(b.x,p.y,60,'86,219,193',0.5,3,0.7);
    if(play){ sfx.tone(260,0.35,'sine',0.2,{slide:1100,wet:false}); sfx.pluck(84,0.12,0.05); api.haptic(14); }
  } else if(p.type==='cloud'){
    fx.ring(b.x,p.y,70,'172,151,254',0.6,3,0.6);
    if(play){ sfx.tone(220,0.4,'sine',0.18,{slide:760,wet:false}); api.haptic(10); }
  } else if(play) sfx.tone(330,0.16,'sine',0.14,{slide:620,wet:false});
  if(p.type==='crumb'){
    p.dead=true;
    fx.shards(p.x,p.y+6,10,'#ffc4e4',140,7,{gravity:600,life:0.9});
    fx.burst(p.x,p.y,10,'230,166,214',80,{size:[8,16],life:0.6,gravity:120});
    if(play) sfx.noise(0.22,0.1,{freq:2600,type:'bandpass',q:1.2});
  }
  if(!play) return;
  // 가운데 착지면 '딱!' 콤보
  if(p!==b.lastPlat){
    var off=Math.abs(b.x-p.x)/(p.w/2);
    if(off<0.36){
      S.combo++; if(S.combo>S.maxCombo) S.maxCombo=S.combo;
      var bonus=5*mult();
      api.addScore(bonus);
      fx.text(b.x,p.y-46,'딱! +'+bonus,'#ff5f92',18,0.8,{stroke:'rgba(255,255,255,.9)'});
      if(S.combo>=2) sfx.pluck(76+Math.min(S.combo,12),0.08,0.02);
    } else S.combo=0;
    updateSub(api);
  }
  b.lastPlat=p;
}

function collect(api,it){
  var fx=api.fx, sfx=api.sfx;
  it.dead=true;
  if(it.kind==='candy'){
    S.candies++;
    S.candyStreak=(api.t-S.candyAt<2)?S.candyStreak+1:0; S.candyAt=api.t;
    var pts=20*mult(); api.addScore(pts);
    var scale=[0,2,4,7,9,12,14,16,19,21];
    sfx.pluck(72+scale[S.candyStreak%scale.length],0.14);
    fx.burst(it.x,it.y,10,['255,126,166','172,151,254','86,219,193','255,214,107'][it.hue%4],120,{size:[4,10],life:0.6});
    fx.text(it.x,it.y-14,'+'+pts,'#a3365d',15,0.7,{stroke:'rgba(255,255,255,.9)'});
  } else {
    S.rocket=3; S.b.vy=-820; S.b.spin=0;
    sfx.noise(0.9,0.14,{freq:500,slide:3200,type:'bandpass',q:0.9});
    sfx.pluck(79,0.14); sfx.pluck(86,0.14,0.1); sfx.pluck(91,0.14,0.2);
    fx.flash(0.5,'255,214,107'); fx.ring(it.x,it.y,90,'255,214,107',0.6,3,0.8);
    fx.text(W/2,api.H*0.38,'별빛 로켓!','#634eb0',26,1.2,{stroke:'rgba(255,255,255,.95)',rise:14});
    api.haptic(20); updateSub(api);
  }
}

/* ---------- 업데이트 ---------- */
function step(dt,api){
  var b=S.b, H=api.H, play=api.state==='play';
  S.t+=dt;
  // 좌우 이동
  if(play){
    var dir=(keys.r?1:0)-(keys.l?1:0);
    if(api.pointerDown&&S.hold) dir=S.hold;
    if(dir){ b.x+=dir*MOVE*dt; b.face=dir; }
  } else if(S.attract){
    var tg=S.plats[S.target], dx=tg.x-b.x;
    if(b.vy<0||Math.abs(dx)>4){ b.x+=clamp(dx,-1,1)*Math.min(Math.abs(dx)*3,200)*dt; if(Math.abs(dx)>2) b.face=dx>0?1:-1; }
  }
  b.x=((b.x%W)+W)%W;
  // 로켓
  if(S.rocket>0){
    S.rocket-=dt; b.vy=-820;
    api.fx.burst(b.x+(Math.random()-0.5)*10,b.y+4,2,Math.random()<0.5?'255,214,107':'255,126,166',60,{size:[5,11],life:0.6,angle:Math.PI/2,spread:0.8});
    for(var m=0;m<S.items.length;m++){ var it=S.items[m]; if(!it.dead&&it.kind==='candy'&&Math.hypot(it.x-b.x,it.y-b.y)<90){ it.x+=(b.x-it.x)*Math.min(1,dt*10); it.y+=(b.y-14-it.y)*Math.min(1,dt*10); } }
    if(S.rocket<=0){ S.rocket=0; b.vy=-500; updateSub(api); }
  } else b.vy+=G*dt;
  var prevY=b.y;
  b.y+=b.vy*dt;
  // 착지 검사
  if(b.vy>0&&S.rocket<=0){
    for(var i=0;i<S.plats.length;i++){
      var p=S.plats[i]; if(p.dead) continue;
      if(prevY<=p.y+2&&b.y>=p.y){
        var dx2=Math.abs(b.x-p.x); dx2=Math.min(dx2,W-dx2);
        if(dx2<p.w/2+9){ land(api,p); if(S.attract) S.target=(S.target%2)+1; break; }
      }
    }
  }
  // 발판 움직임
  for(i=S.plats.length-1;i>=0;i--){
    var q=S.plats[i];
    q.jig=Math.max(0,q.jig-dt*3);
    if(q.vx){ q.x+=q.vx*dt; if(q.x<q.w/2){ q.x=q.w/2; q.vx*=-1; } else if(q.x>W-q.w/2){ q.x=W-q.w/2; q.vx*=-1; } }
    if(!S.attract&&(q.dead||q.y>S.cam+H+80)) S.plats.splice(i,1);
  }
  // 아이템
  for(i=S.items.length-1;i>=0;i--){
    var c=S.items[i];
    if(!c.dead&&play&&Math.hypot(c.x-b.x,c.y-(b.y-14))<24) collect(api,c);
    if(c.dead||c.y>S.cam+H+80) S.items.splice(i,1);
  }
  // 찌그러짐 회복, 회전
  b.sx+=(1-b.sx)*Math.min(1,dt*12); b.sy+=(1-b.sy)*Math.min(1,dt*12);
  if(b.vy<-200){ b.sy=Math.max(b.sy,1.08); b.sx=Math.min(b.sx,0.94); }
  if(b.spin>0){ b.spin-=dt*1.4; b.rot=(1-Math.max(0,b.spin))*Math.PI*2*b.face; if(b.spin<=0){ b.spin=0; b.rot=0; } }
  if(S.attract){
    if(b.y>S.baseY+200){ b.y=S.baseY; b.vy=JUMP; }
    return;
  }
  // 카메라: 위로만
  var want=b.y-H*0.42;
  if(want<S.cam) S.cam=want;
  if(play){
    fill(api);
    var h=heightM(b.y);
    if(h>S.maxH){
      S.maxH=h;
      var pts=Math.floor(h);
      if(pts>S.pts){ api.addScore(pts-S.pts); S.pts=pts; }
      if(pts>=S.milestone*1000){
        api.fx.flash(0.5,'255,214,107');
        api.fx.text(W/2,H*0.34,(S.milestone*1000)+'m 돌파!','#634eb0',28,1.4,{stroke:'rgba(255,255,255,.95)',rise:14});
        for(var k=0;k<3;k++) api.sfx.pluck([72,76,79][k]+12,0.13,k*0.07);
        S.milestone++;
      }
    }
    // 이어하기 직후 잠깐은 바닥의 별빛 그물이 받쳐 준다
    if(S.grace>0){
      S.grace-=dt;
      if(b.vy>0&&b.y-S.cam>H*0.86){ b.vy=JUMP; b.sx=1.3; b.sy=0.7; api.fx.ring(b.x,b.y,50,'255,214,107',0.5,3,0.7); api.sfx.tone(330,0.16,'sine',0.14,{slide:620,wet:false}); }
    }
    if(b.y-S.cam>H+40&&!S.fell){
      S.fell=true;
      api.sfx.tone(760,0.9,'triangle',0.15,{slide:140});
      api.fx.text(W/2,H*0.5,'으앗~','#a3365d',22,1.1,{stroke:'rgba(255,255,255,.9)'});
      api.setSub('');
      api.end();
    }
  }
}

/* ---------- 배경 ---------- */
function drawSky(ctx,w,h,m,cam,t,s){
  var sk=skyAt(m), g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,rgb(sk[0])); g.addColorStop(1,rgb(sk[1]));
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  var night=clamp((m-6000)/3000,0,1);
  // 물방울 무늬
  ctx.fillStyle='rgba(255,202,224,'+(0.35*(1-night))+')';
  var off=((-cam*0.15)%28+28)%28;
  for(var y=-28;y<h+28;y+=28) for(var x=(Math.floor(y/28)%2)*14;x<w;x+=28){ ctx.beginPath(); ctx.arc(x,y+off,1.2,0,Math.PI*2); ctx.fill(); }
  // 별
  for(var i=0;i<24;i++){
    var sx=(i*97.3)%w, sy=(((i*151.7-cam*0.08)%h)+h)%h;
    drawTwinkle(ctx,sx,sy,(2+(i%3))*s,(0.25+0.5*night)*(0.5+0.5*Math.sin(t*2+i)));
  }
  // 구름 두 겹
  for(var L=0;L<2;L++){
    var par=L?0.5:0.25, sc=(L?1.1:0.7)*s, a=(L?0.85:0.55)*(1-night*0.6);
    for(var j=0;j<4;j++){
      var cx=((j*131+L*57+t*(L?6:3))%(w+140))-90, cy=(((j*(h/3.2)+L*70-cam*par)%(h+160))+h+160)%(h+160)-80;
      drawCloud(ctx,cx,cy,sc,a);
    }
  }
}

Arcade.register({
  id:'jelly',
  title:'젤리 점프',
  kicker:'JUMP · 끝없이 위로',
  blurb:'루루와 함께 젤리를 밟고 구름 위로 퐁퐁',
  lede:'스타 버니 루루가 젤리 발판을 밟고 저절로 튀어 올라요. 좌우로만 이끌어 주세요. 발판 한가운데를 밟으면 "딱!" 콤보, 별빛 로켓을 잡으면 하늘을 날아요.',
  how:'좌우로 끌기 · 화면 왼쪽/오른쪽 누르고 있기 · 방향키도 돼요 · 떨어지면 끝',
  lifeIcon:null,
  endDelay:1200,
  reviveText:'구름 발판에서 다시 퐁! 2초 동안 별빛 그물이 받쳐 줘요',
  palette:{bg:'#fff6fb',surface:'#ffffff',surface2:'#fbf0ff',line:'#f3d3e2',text:'#21172b',muted:'#887176',
    accent:'#ff5f92',accentInk:'#ffffff',accentDeep:'#c23c6c',hot:'#ac97fe',hotText:'#634eb0',hotRgb:'172,151,254',light:true},

  start:function(api){
    keys.l=keys.r=false;
    newState(api,api.state!=='play');
    if(api.state==='play') updateSub(api);
  },
  revive:function(api){
    var H=api.H, b=S.b, y=S.cam+H*0.7;
    S.plats.push({x:W/2,y:y,w:150,type:'cloud',vx:0,jig:1,dead:false});
    b.x=W/2; b.y=y; b.vy=SPRING; b.spin=1; b.rot=0; b.lastPlat=null; b.sx=1.3; b.sy=0.7;
    S.fell=false; S.rocket=0; S.combo=0; S.grace=2.2; S.hold=0; S.dragged=false;
    keys.l=keys.r=false;
    api.fx.ring(W/2,y,110,'255,214,107',0.8,4,0.8);
    api.fx.burst(W/2,y,22,'255,126,166',160,{size:[5,12],life:0.8});
    api.fx.text(W/2,H*0.4,'이어서 GO!','#ff5f92',28,1.2,{stroke:'rgba(255,255,255,.95)',rise:14});
    api.sfx.pluck(79,0.14); api.sfx.pluck(84,0.14,0.08); api.sfx.pluck(91,0.15,0.16);
    updateSub(api);
  },
  update:function(dt,api){
    if(!S) return;
    if(api.state==='play'||api.state==='dying'||S.attract) step(dt,api);
    if(S.t>S.blinkAt){ S.blinkAt=S.t+2.5+Math.random()*2; S.blinkUntil=S.t+0.12; }
  },
  draw:function(ctx,api){
    var H=api.H, cam=S.attract?0:S.cam, t=api.t, b=S.b;
    drawSky(ctx,W,H,S.attract?0:S.maxH,cam,t,1);
    ctx.save(); ctx.translate(0,-cam);
    var i;
    for(i=0;i<S.plats.length;i++){ var p=S.plats[i]; if(p.dead||p.y-cam<-30||p.y-cam>H+30) continue; drawPlat(ctx,p.x,p.y,p.w,p.type,p.jig,1); }
    for(i=0;i<S.items.length;i++){
      var it=S.items[i]; if(it.dead) continue;
      var bob=Math.sin(t*3+it.x)*3;
      if(it.kind==='candy') drawCandy(ctx,it.x,it.y+bob,1,it.hue);
      else {
        ctx.globalAlpha=0.35+0.2*Math.sin(t*5); ctx.fillStyle='#fff3c4'; ctx.beginPath(); ctx.arc(it.x,it.y+bob,18,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
        drawStar(ctx,it.x,it.y+bob,12,'#ffd66b'); drawStar(ctx,it.x,it.y+bob,6,'#ffffff');
      }
    }
    var blink=S.blinkUntil&&S.t<S.blinkUntil;
    if(S.grace>0){
      ctx.strokeStyle='rgba(255,214,107,'+(0.35+0.25*Math.sin(t*10))+')'; ctx.lineWidth=3; ctx.setLineDash([6,6]);
      ctx.beginPath(); ctx.moveTo(0,cam+H*0.86); ctx.lineTo(W,cam+H*0.86); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha=Math.sin(t*28)>0?1:0.45;
    }
    if(api.state!=='over'||S.attract){
      drawBunny(ctx,b.x,b.y,1,b.sx,b.sy,b.rot,b.face,blink);
      if(b.x<20) drawBunny(ctx,b.x+W,b.y,1,b.sx,b.sy,b.rot,b.face,blink);
      else if(b.x>W-20) drawBunny(ctx,b.x-W,b.y,1,b.sx,b.sy,b.rot,b.face,blink);
    }
    ctx.globalAlpha=1;
    ctx.restore();
    // 높이 표시
    if(api.state==='play'){
      ctx.font='600 12px '+Arcade.fx.font; ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillStyle='rgba(119,17,60,.55)'; ctx.fillText(Math.floor(S.maxH)+'m',14,H-24);
    }
  },
  pointer:function(type,x,y,api){
    if(type==='down'){ S.lastX=x; S.downX=x; S.dragged=false; S.hold=x<W/2?-1:1; }
    else if(type==='move'&&api.pointerDown){
      var dx=x-S.lastX; S.lastX=x;
      if(!S.dragged&&Math.abs(x-S.downX)>6){ S.dragged=true; S.hold=0; }
      if(S.dragged){ S.b.x+=dx*1.3; if(Math.abs(dx)>0.5) S.b.face=dx>0?1:-1; }
    } else if(type==='up'){ S.hold=0; S.dragged=false; }
  },
  key:function(type,code,api){
    var on=type==='down';
    if(code==='ArrowLeft'||code==='KeyA'){ keys.l=on; return true; }
    if(code==='ArrowRight'||code==='KeyD'){ keys.r=on; return true; }
    return false;
  },
  preview:function(ctx,w,h,t){
    var s=Math.min(1.3,h/240);
    drawSky(ctx,w,h,(t*120)%9000*0.25,t*20,t,s);
    var P=[[0.24,0.82],[0.62,0.6],[0.36,0.38],[0.7,0.2]];
    for(var i=0;i<P.length;i++) drawPlat(ctx,P[i][0]*w,P[i][1]*h,62*s,i===3?'spring':i===1?'move':'normal',0,s);
    var cyc=(t*0.9)%3, k=Math.floor(cyc), f=cyc-k;
    var a=P[k], c=P[k+1], x=lerp(a[0],c[0],f)*w, y0=lerp(a[1],c[1],f)*h, y=y0-Math.sin(f*Math.PI)*h*0.18;
    var sq=f<0.12?1+(0.12-f)*3:1;
    drawCandy(ctx,P[2][0]*w+28*s,P[2][1]*h-24*s+Math.sin(t*3)*3,s,(Math.floor(t)%4));
    drawBunny(ctx,x,y,s,sq,2-sq,0,c[0]>a[0]?1:-1,false);
    for(var j=0;j<5;j++) drawTwinkle(ctx,((j*73+t*14)%w),((j*53)%h),3*s,0.5+0.5*Math.sin(t*3+j));
  },
  result:function(api){
    var m=Math.floor(S.maxH);
    return {
      stats:[['최고 높이',U.fmt(m)+'m'],['캔디',S.candies],['최대 콤보',S.maxCombo]],
      line:m>=1000?'루루가 구름 위 '+U.fmt(m)+'m까지 퐁퐁 뛰어올랐어요!':'루루가 '+U.fmt(m)+'m까지 올라갔어요. 한가운데를 밟으면 콤보가 쌓여요.'
    };
  }
});
})();

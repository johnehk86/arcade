/* 등불 사격: 떠오르는 종이 등불을 탭으로 쏘는 60초 사격. 정중앙이면 두 배, 겹친 등불은 관통.
   그림은 파스텔 노을 축제: 얼굴 있는 말랑한 등불, 민트 시계 등불, 먹구름. */
(function(){
'use strict';

var W=360, TOP=118;
var PENT=[72,74,76,79,81,84,86,88,91,93,96];
var KINDS={
  red:{body:'#ff9bb7',light:'#fff0f5',edge:'#ff5f92',glow:'255,126,166',shard:'#ff7ea6'},
  amber:{body:'#ffd66b',light:'#fff8dc',edge:'#f0a92a',glow:'255,200,90',shard:'#ffc94d'},
  lav:{body:'#c3b2ff',light:'#f6f2ff',edge:'#7b61e8',glow:'172,151,254',shard:'#ac97fe'},
  peach:{body:'#ffb994',light:'#fff3ea',edge:'#f07a4a',glow:'255,170,130',shard:'#ff9f7a'},
  time:{body:'#7fe8d2',light:'#effffb',edge:'#2bbca3',glow:'86,219,193',shard:'#56dbc1'},
  gold:{body:'#ffcf4a',light:'#fffbe6',edge:'#e09b00',glow:'255,200,90',shard:'#ffd66b'},
  ink:{body:'#7b7290',light:'#a99fbf',edge:'#4d4562',glow:null,shard:'#7b7290'}
};
var VARIANT=['red','amber','lav','peach'];
/* 보통 등불은 흔들림 위상(ph)으로 색만 고른다. 난수를 더 쓰지 않으니 오늘의 도전 패턴은 그대로다. */
function look(kind,ph){ return (kind==='red'||kind==='amber')?KINDS[VARIANT[Math.floor(ph*7)%4]]:KINDS[kind]; }

var L=[], shots=[], remaining=60, elapsed=0, spawnAcc=0, combo=0, maxCombo=0;
var nShots=0, nHits=0, nCrits=0, nPop=0, cross={x:W/2,y:300,age:9}, ended=false, attractAcc=0;

/* 배경 소품: 0..1 정규화 좌표로 한 번만 만든다 */
var stars=[], roofs=[], wins=[];
(function(){
  for(var i=0;i<46;i++) stars.push({x:Math.random(),y:Math.random()*0.62,s:Math.random()*1.3+0.4,p:Math.random()*6.28});
  var x=-0.04;
  while(x<1.04){
    var w=0.16+Math.random()*0.16, h=0.05+Math.random()*0.05;
    roofs.push({x:x,w:w,h:h});
    for(var k=0;k<2;k++) if(Math.random()<0.7) wins.push({x:x+w*(0.25+k*0.35),w:w*0.12,y:h*0.35});
    x+=w*0.82;
  }
})();

function mult(){ return Math.min(6,1+Math.floor(combo/5)); }
function sub(api){ api.setSub(combo>=2?'콤보 '+combo+' · ×'+mult():''); }
function lx(l,t){ return l.x+Math.sin(t*l.sf+l.ph)*l.amp; }

function spawn(rnd,api,attract){
  var H=api.H, k=attract?0.2:Math.min(1,elapsed/60);
  var roll=rnd(), kind;
  if(attract) kind=roll<0.5?'red':'amber';
  else if(roll<0.04) kind='gold';
  else if(roll<0.095) kind='time';
  else if(elapsed>8&&roll<0.095+0.055+k*0.03) kind='ink';
  else kind=rnd()<0.5?'red':'amber';
  var r=kind==='gold'?14:kind==='ink'?22:18+rnd()*12;
  var vy=(60+70*k)*(0.8+rnd()*0.5)*(kind==='gold'?1.9:1)*(attract?0.55:1);
  L.push({x:r+14+rnd()*(W-2*r-28),y:H+r+20,r:r,vy:vy,kind:kind,sf:0.8+rnd()*1.2,ph:rnd()*6.28,
    amp:kind==='gold'?38:6+rnd()*10,born:api.t});
  if(L.length>40) L.shift();
}

/* ---------- 그리기 ---------- */
function star4(ctx,x,y,r){
  ctx.beginPath(); ctx.moveTo(x,y-r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.quadraticCurveTo(x,y,x,y+r);
  ctx.quadraticCurveTo(x,y,x-r,y); ctx.quadraticCurveTo(x,y,x,y-r); ctx.closePath(); ctx.fill();
}
function puff(ctx,x,y,s){
  ctx.beginPath();
  ctx.arc(x-s*0.9,y+s*0.15,s*0.55,0,Math.PI*2); ctx.arc(x,y-s*0.15,s*0.8,0,Math.PI*2); ctx.arc(x+s*0.9,y+s*0.2,s*0.5,0,Math.PI*2);
  ctx.rect(x-s*0.9,y+s*0.1,s*1.8,s*0.6); ctx.fill();
}
function face(ctx,x,y,s,grump){
  ctx.fillStyle='#4a2a3e';
  ctx.beginPath(); ctx.arc(x-s*0.32,y-s*0.05,s*0.085,0,Math.PI*2); ctx.arc(x+s*0.32,y-s*0.05,s*0.085,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,100,150,.45)';
  ctx.beginPath(); ctx.ellipse(x-s*0.5,y+s*0.15,s*0.13,s*0.075,0,0,Math.PI*2); ctx.ellipse(x+s*0.5,y+s*0.15,s*0.13,s*0.075,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#4a2a3e'; ctx.lineWidth=Math.max(1,s*0.065); ctx.lineCap='round';
  ctx.beginPath();
  if(grump){
    ctx.moveTo(x-s*0.14,y+s*0.24); ctx.quadraticCurveTo(x,y+s*0.12,x+s*0.14,y+s*0.24);
    ctx.moveTo(x-s*0.5,y-s*0.3); ctx.lineTo(x-s*0.18,y-s*0.2); ctx.moveTo(x+s*0.5,y-s*0.3); ctx.lineTo(x+s*0.18,y-s*0.2);
  } else { ctx.moveTo(x-s*0.12,y+s*0.12); ctx.quadraticCurveTo(x,y+s*0.26,x+s*0.12,y+s*0.12); }
  ctx.stroke();
}
function drawSky(ctx,w,h,t){
  var g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#cbbcff'); g.addColorStop(0.5,'#ffc9de'); g.addColorStop(1,'#ffe3cc');
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  var fg=ctx.createRadialGradient(w*0.5,h*1.02,0,w*0.5,h*1.02,h*0.7);
  fg.addColorStop(0,'rgba(255,214,150,.55)'); fg.addColorStop(1,'rgba(255,214,150,0)');
  ctx.fillStyle=fg; ctx.fillRect(0,0,w,h);
  // 구름 몇 덩이가 천천히 흐른다
  ctx.fillStyle='rgba(255,255,255,.55)';
  for(var c=0;c<4;c++){
    var cx=((c*0.31+t*0.008*(1+c*0.3))%1.3-0.15)*w, cy=h*(0.12+c*0.12);
    puff(ctx,cx,cy,10+c*3);
  }
  ctx.fillStyle='#ffffff';
  for(var i=0;i<stars.length;i++){
    var s=stars[i]; ctx.globalAlpha=0.35+0.45*(0.5+0.5*Math.sin(t*1.3+s.p));
    if(s.s>1.2) star4(ctx,s.x*w,s.y*h,s.s*2.2);
    else ctx.fillRect(s.x*w,s.y*h,1.6,1.6);
  }
  ctx.globalAlpha=1;
}
var BULBS=['#ff7ea6','#ffd66b','#56dbc1','#ac97fe'];
function drawLights(ctx,w,h,t){
  var y0=h*0.2, y1=h*0.26, sag=h*0.07;
  ctx.strokeStyle='rgba(255,255,255,.8)'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(0,y0); ctx.quadraticCurveTo(w/2,(y0+y1)/2+sag*2,w,y1); ctx.stroke();
  var n=Math.max(8,Math.round(w/24));
  for(var i=1;i<n;i++){
    var u=i/n, y=(1-u)*(1-u)*y0+2*u*(1-u)*((y0+y1)/2+sag*2)+u*u*y1;
    ctx.globalAlpha=0.75+0.25*Math.sin(t*2+i*1.7);
    ctx.fillStyle=BULBS[i%4];
    ctx.beginPath(); ctx.ellipse(u*w,y+5,3,4,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(u*w-1,y+3.5,1,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}
function drawRoofs(ctx,w,h){
  var base=h;
  for(var layer=0;layer<2;layer++){
    var off=layer?0:14;
    ctx.fillStyle=layer?'#c6a3e8':'#e6c4ef';
    ctx.beginPath(); ctx.moveTo(0,base);
    for(var i=0;i<roofs.length;i++){
      var r=roofs[i], x=r.x*w+(layer?0:w*0.06), rw=r.w*w, rh=r.h*h+18, top=base-rh-28-off;
      ctx.lineTo(x,base-28-off);
      ctx.lineTo(x,top+rh*0.55);
      ctx.quadraticCurveTo(x-6,top+rh*0.35,x-10,top+rh*0.3);
      ctx.quadraticCurveTo(x+rw*0.2,top+rh*0.32,x+rw*0.3,top);
      ctx.lineTo(x+rw*0.7,top);
      ctx.quadraticCurveTo(x+rw*0.8,top+rh*0.32,x+rw+10,top+rh*0.3);
      ctx.quadraticCurveTo(x+rw+6,top+rh*0.35,x+rw,top+rh*0.55);
      ctx.lineTo(x+rw,base-28-off);
    }
    ctx.lineTo(w,base); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle='#fff3b0';
  for(var j=0;j<wins.length;j++){
    var wi=wins[j], wx=wi.x*w, ww=Math.max(5,wi.w*w);
    ctx.beginPath(); ctx.ellipse(wx+ww/2,base-17,ww/2,5,0,0,Math.PI*2); ctx.fill();
  }
}
function drawLantern(ctx,x,y,r,kind,t,ph,alpha){
  var k=look(kind,ph);
  ctx.globalAlpha=alpha;
  if(kind==='ink'){
    // 먹구름: 찡그린 회보라 구름과 작은 번개
    ctx.strokeStyle='#ffc94d'; ctx.lineWidth=2.6; ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(x+2,y+r*0.5); ctx.lineTo(x-3,y+r*0.85); ctx.lineTo(x+2,y+r*0.85); ctx.lineTo(x-2,y+r*1.2); ctx.stroke();
    ctx.fillStyle='rgba(77,69,98,.18)'; puff(ctx,x+2,y+4,r*0.7);
    ctx.fillStyle=k.body; puff(ctx,x,y,r*0.7);
    ctx.fillStyle='rgba(255,255,255,.18)'; puff(ctx,x-r*0.15,y-r*0.2,r*0.38);
    face(ctx,x,y+r*0.05,r*0.62,true);
    ctx.globalAlpha=1;
    return;
  }
  if(k.glow){
    var gs=r*4.6; ctx.globalAlpha=alpha*(0.35+0.08*Math.sin(t*3+ph));
    ctx.drawImage(Arcade.fx.glow(k.glow),x-gs/2,y-gs/2,gs,gs);
    ctx.globalAlpha=alpha;
  }
  // 끈
  ctx.strokeStyle='rgba(255,255,255,.9)'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(x,y-r-3); ctx.lineTo(x,y-r-12); ctx.stroke();
  // 그림자와 몸통
  ctx.fillStyle='rgba(163,54,93,.12)';
  ctx.beginPath(); ctx.ellipse(x+2,y+4,r*0.88,r,0,0,Math.PI*2); ctx.fill();
  var g=ctx.createRadialGradient(x-r*0.25,y-r*0.3,r*0.1,x,y,r*1.05);
  g.addColorStop(0,k.light); g.addColorStop(0.6,k.body); g.addColorStop(1,k.edge);
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.ellipse(x,y,r*0.88,r,0,0,Math.PI*2); ctx.fill();
  // 종이 살
  ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.ellipse(x,y,r*0.48,r*0.97,0,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x,y-r); ctx.lineTo(x,y+r); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=1.6;
  ctx.beginPath(); ctx.ellipse(x,y,r*0.88,r,0,0,Math.PI*2); ctx.stroke();
  // 위아래 뚜껑
  ctx.fillStyle=k.edge;
  ctx.beginPath(); ctx.ellipse(x,y-r+1,r*0.44,3.2,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x,y+r-1,r*0.44,3.2,0,0,Math.PI*2); ctx.fill();
  // 술
  var sw=Math.sin(t*2.4+ph*6.28)*0.25;
  ctx.strokeStyle=k.edge; ctx.lineWidth=1.8; ctx.lineCap='round';
  ctx.beginPath();
  for(var i=-1;i<=1;i++){ ctx.moveTo(x+i*2,y+r+2); ctx.lineTo(x+i*2+Math.sin(sw)*r*0.5,y+r+2+r*0.5); }
  ctx.stroke();
  // 하이라이트와 얼굴
  ctx.fillStyle='rgba(255,255,255,.75)';
  ctx.beginPath(); ctx.ellipse(x-r*0.42,y-r*0.42,r*0.12,r*0.2,-0.5,0,Math.PI*2); ctx.fill();
  if(kind==='time'){
    ctx.strokeStyle='#006b5b'; ctx.lineWidth=1.8;
    ctx.beginPath(); ctx.arc(x,y+r*0.02,r*0.36,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x,y+r*0.02); ctx.lineTo(x,y-r*0.22); ctx.moveTo(x,y+r*0.02); ctx.lineTo(x+r*0.18,y+r*0.1); ctx.stroke();
  } else {
    face(ctx,x,y+r*0.1,r*0.62,false);
  }
  if(kind==='gold'){
    ctx.fillStyle='#ffffff';
    ctx.globalAlpha=alpha*(0.6+0.4*Math.sin(t*8+ph*9));
    star4(ctx,x+r*0.75,y-r*0.7,r*0.3); star4(ctx,x-r*0.8,y+r*0.2,r*0.2);
  }
  ctx.globalAlpha=1;
}
function drawCross(ctx,x,y,a,s){
  ctx.globalAlpha=a; ctx.lineCap='round';
  for(var pass=0;pass<2;pass++){
    ctx.strokeStyle=pass?'#ff5f92':'rgba(255,255,255,.95)'; ctx.lineWidth=pass?2:4.5;
    ctx.beginPath(); ctx.arc(x,y,s,0,Math.PI*2);
    ctx.moveTo(x-s-6,y); ctx.lineTo(x-s*0.45,y); ctx.moveTo(x+s*0.45,y); ctx.lineTo(x+s+6,y);
    ctx.moveTo(x,y-s-6); ctx.lineTo(x,y-s*0.45); ctx.moveTo(x,y+s*0.45); ctx.lineTo(x,y+s+6);
    ctx.stroke();
  }
  ctx.fillStyle='#ff5f92'; ctx.beginPath(); ctx.arc(x,y,1.8,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
}

/* ---------- 사격 ---------- */
function shoot(x,y,api){
  var fx=api.fx, sfx=api.sfx, t=api.t;
  nShots++;
  sfx.noise(0.05,0.32,{type:'highpass',freq:2600,wet:false});
  sfx.tone(130,0.12,'sine',0.32,{slide:48,wet:false});
  fx.burst(x,y,6,'255,126,166',130,{size:[4,9],life:0.22});
  fx.ring(x,y,16,'255,126,166',0.2,2,0.8);
  fx.shake(1.6);
  shots.push({x:x,y:y,age:0}); if(shots.length>12) shots.shift();
  var hit=[];
  for(var i=0;i<L.length;i++){
    var l=L[i], d=Math.hypot(lx(l,t)-x,l.y-y);
    if(d<l.r+2) hit.push({l:l,d:d});
  }
  if(!hit.length){
    combo=0; remaining=Math.max(0,remaining-1); sub(api);
    sfx.tone(150,0.24,'sine',0.2,{slide:80,wet:false}); sfx.noise(0.1,0.08,{freq:420});
    fx.text(x,y-18,'빗나감 −1초','#887176',15,0.7,{rise:18,stroke:'rgba(255,255,255,.9)'});
    api.haptic(20);
    return;
  }
  nHits++;
  var total=0, pierce=hit.filter(function(h){ return h.l.kind!=='ink'; }).length;
  for(var j=0;j<hit.length;j++){
    var h=hit[j], lt=h.l, px=lx(lt,t), py=lt.y, K=look(lt.kind,lt.ph);
    var idx=L.indexOf(lt); if(idx>=0) L.splice(idx,1);
    if(lt.kind==='ink'){
      combo=0; remaining=Math.max(0,remaining-5); sub(api);
      fx.shards(px,py,22,'#7b7290',240,7,{gravity:300,life:1.1});
      fx.shards(px,py,8,'#a99fbf',180,5,{gravity:260});
      fx.ring(px,py,lt.r*3,'123,114,144',0.6,3,0.6);
      fx.text(px,py-24,'먹구름 −5초','#4d4562',20,1.1,{rise:20,stroke:'rgba(255,255,255,.9)'});
      fx.shake(7); fx.flash(0.35,'123,114,144');
      sfx.noise(0.45,0.3,{freq:320,slide:70}); sfx.tone(92,0.5,'sawtooth',0.07,{slide:44,wet:false});
      api.haptic(45);
      continue;
    }
    var crit=h.d<lt.r*0.33;
    combo++; if(combo>maxCombo) maxCombo=combo;
    nPop++; if(crit) nCrits++;
    var base=lt.kind==='gold'?500:(crit?200:100);
    if(lt.kind==='gold'&&crit) base=800;
    var pts=base*mult();
    total+=pts;
    remaining=Math.min(99,remaining+(crit?0.4:0.15)+(lt.kind==='time'?3:0));
    fx.shards(px,py,crit?20:13,K.shard,crit?260:200,6,{gravity:240,life:1.1});
    fx.shards(px,py,5,K.edge,160,4,{gravity:200});
    fx.burst(px,py,crit?26:16,K.glow,crit?170:130,{gravity:-70,life:1.2,size:[4,11],drag:1.8});
    fx.ring(px,py,lt.r*2.6,K.glow,0.5,2.5,0.75);
    var note=PENT[Math.min(PENT.length-1,(combo-1)%PENT.length)];
    sfx.pluck(note,0.2);
    if(crit){
      fx.hitstop(0.04); fx.ring(px,py,lt.r*4,'255,200,90',0.7,3,0.9); fx.flash(0.22,'255,214,107'); fx.shake(4); fx.pulse(0.6);
      sfx.tone(sfx.mtof(96),0.7,'sine',0.11); sfx.tone(sfx.mtof(103),0.45,'sine',0.05,{delay:0.03});
      fx.text(px,py-lt.r-8,'정중앙 +'+pts,'#ff5f92',22,0.9,{stroke:'rgba(255,255,255,.95)'});
      api.haptic(14);
    } else {
      fx.text(px,py-lt.r-8,'+'+pts,'#a3365d',17,0.8,{stroke:'rgba(255,255,255,.9)'});
      api.haptic(7);
    }
    if(lt.kind==='time'){ fx.text(px,py+lt.r+14,'+3초','#006b5b',18,0.9,{stroke:'rgba(255,255,255,.9)'}); sfx.pluck(84,0.14,0.06); sfx.pluck(91,0.12,0.14); }
    if(lt.kind==='gold') fx.text(px,py+lt.r+14,'금빛 등불','#946200',16,0.9,{stroke:'rgba(255,255,255,.9)'});
    if(combo%10===0){
      fx.flash(0.4,'255,182,210'); fx.text(W/2,api.H*0.42,'콤보 '+combo+'!','#634eb0',30,1.2,{rise:14,stroke:'rgba(255,255,255,.95)'});
      fx.ring(W/2,api.H*0.42,W*0.6,'172,151,254',1,2.5,0.6);
      sfx.pluck(72,0.12); sfx.pluck(76,0.12,0.05); sfx.pluck(79,0.12,0.1); sfx.pluck(84,0.14,0.15);
    }
  }
  if(pierce>=2){
    var bonus=Math.round(total*(pierce-1)*0.5);
    total+=bonus;
    fx.text(x,y-46,'관통 ×'+pierce+' +'+bonus,'#ff5f92',22,1.1,{rise:20,stroke:'rgba(255,255,255,.95)'});
    fx.ring(x,y,90,'255,126,166',0.6,2.5,0.8); fx.hitstop(0.05);
    sfx.pluck(91,0.14,0.05); sfx.pluck(96,0.12,0.11);
  }
  if(total>0) api.addScore(total);
  sub(api);
}

Arcade.register({
  id:'lantern',
  title:'등불 사격',
  kicker:'사격 · 60초',
  blurb:'두둥실 떠오르는 등불의 정중앙을 콕!',
  lede:'노을 진 축제 하늘로 말랑한 종이 등불이 두둥실 떠올라요. 탭해서 톡 터뜨리고, 정중앙을 맞히면 두 배! 겹친 등불을 한 번에 맞히면 관통 보너스예요.',
  how:'탭으로 사격 · 민트 시계 등불 +3초 · 먹구름은 −5초 · 빗나가면 −1초',
  palette:{bg:'#fff1f4',surface:'#ffffff',surface2:'#fff0f6',line:'#ffd0de',text:'#21172b',muted:'#887176',
    accent:'#ff5f92',accentInk:'#ffffff',accentDeep:'#a3365d',hot:'#7b61e8',hotText:'#634eb0',hotRgb:'172,151,254',light:true},
  lifeIcon:null,
  endDelay:1200,

  start:function(api){
    L.length=0; shots.length=0; remaining=60; elapsed=0; spawnAcc=0.4; combo=0; maxCombo=0;
    nShots=0; nHits=0; nCrits=0; nPop=0; ended=false; cross.age=9; attractAcc=0;
    if(api.state==='play'){
      api.setMeter(1,'남은 시간 60.0초',false); sub(api);
    } else {
      for(var i=0;i<6;i++){ spawn(Math.random,api,true); L[L.length-1].y=api.H*(0.3+Math.random()*0.7); }
    }
  },

  update:function(dt,api){
    var t=api.t, H=api.H;
    if(api.state==='play'){
      elapsed+=dt; remaining-=dt;
      var k=Math.min(1,elapsed/60), iv=0.85-0.47*k;
      spawnAcc-=dt;
      while(spawnAcc<=0){ spawn(api.rng,api,false); spawnAcc+=iv*(0.75+api.rng()*0.5); }
      if(remaining<=0&&!ended){
        remaining=0; ended=true;
        api.setMeter(0,'시간 종료',true);
        api.fx.text(W/2,H*0.45,'시간 종료','#a3365d',30,1.2,{rise:10,stroke:'rgba(255,255,255,.95)'});
        api.sfx.pluck(79,0.14); api.sfx.pluck(76,0.13,0.15); api.sfx.pluck(72,0.15,0.32);
        api.end();
      } else if(!ended){
        api.setMeter(remaining/60,'남은 시간 '+remaining.toFixed(1)+'초',remaining<10);
      }
    } else if(api.state==='menu'||api.state==='over'){
      attractAcc-=dt;
      if(attractAcc<=0){ spawn(Math.random,api,true); attractAcc=1.1+Math.random()*0.8; }
    }
    for(var i=L.length-1;i>=0;i--){
      var l=L[i]; l.y-=l.vy*dt;
      if(l.y<-l.r*2){
        L.splice(i,1);
        if(api.state==='play'&&l.kind!=='ink'&&combo>0){
          if(combo>=3) api.fx.text(W/2,TOP+10,'놓친 등불 · 콤보 끊김','#887176',14,0.8,{rise:10,stroke:'rgba(255,255,255,.9)'});
          combo=0; sub(api);
        }
      }
    }
    for(var j=shots.length-1;j>=0;j--){ shots[j].age+=dt; if(shots[j].age>0.35) shots.splice(j,1); }
    cross.age+=dt;
  },

  draw:function(ctx,api){
    var H=api.H, t=api.t;
    drawSky(ctx,W,H,t);
    drawLights(ctx,W,H,t);
    for(var i=0;i<L.length;i++){
      var l=L[i], a=Math.min(1,(t-l.born)/0.4+0.2);
      drawLantern(ctx,lx(l,t),l.y,l.r,l.kind,t,l.ph,a);
    }
    drawRoofs(ctx,W,H);
    for(var j=0;j<shots.length;j++){
      var s=shots[j], q=s.age/0.35;
      drawCross(ctx,s.x,s.y,(1-q)*0.9,10+q*14);
    }
    if(api.state==='play'&&cross.age<1.2) drawCross(ctx,cross.x,cross.y,0.55*(1-cross.age/1.2),12);
    if(api.state==='play'&&remaining<10&&!ended){
      var vg=ctx.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H*0.75);
      vg.addColorStop(0,'rgba(255,95,146,0)'); vg.addColorStop(1,'rgba(255,95,146,'+(0.2+0.1*Math.sin(t*6))+')');
      ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
    }
  },

  pointer:function(type,x,y,api){
    cross.x=x; cross.y=y; cross.age=0;
    if(type==='down'&&!ended) shoot(x,y,api);
  },
  key:function(){ return false; },

  preview:function(ctx,w,h,t){
    drawSky(ctx,w,h,t);
    drawLights(ctx,w,h,t);
    var u=Math.min(w,h)/12, tx=0, ty=0;
    for(var i=0;i<8;i++){
      var sp=0.07+(i%3)*0.03, r=u*(0.75+(i%4)*0.18);
      var y=h+r*2-((t*sp*h+i*h*0.41)%(h+r*4));
      var x=((i*0.137+0.08)%1)*(w-r*3)+r*1.5+Math.sin(t*(0.9+i*0.1)+i)*r*0.3;
      var kind=i===5?'time':i===2?'gold':i===7?'ink':'red';
      drawLantern(ctx,x,y,r,kind,t,i*0.143+0.01,1);
      if(i===0){ tx=x; ty=y; }
    }
    drawRoofs(ctx,w,h);
    drawCross(ctx,tx+Math.sin(t*3)*2,ty+Math.cos(t*2.5)*2,0.8,u*0.8);
  },

  result:function(){
    var acc=nShots?Math.round(nHits/nShots*100):0;
    return {
      stats:[['명중률',acc+'%'],['정중앙',nCrits],['최대 콤보',maxCombo]],
      line:nPop>0?'등불 '+nPop+'개를 노을 하늘에 톡톡 터뜨렸어요. 정중앙 '+nCrits+'번!':'등불이 기다려요. 숨을 고르고 정중앙을 노려 보세요.'
    };
  }
});
})();

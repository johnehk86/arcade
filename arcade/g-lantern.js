/* 등불 사격: 떠오르는 종이 등불을 탭으로 쏘는 60초 사격. 정중앙이면 두 배, 겹친 등불은 관통. */
(function(){
'use strict';

var W=360, TOP=118;
var PENT=[72,74,76,79,81,84,86,88,91,93,96];
var KINDS={
  red:{body:'#e8553d',light:'#ffd9a8',glow:'255,140,90',shard:'#f2734f'},
  amber:{body:'#f2a33c',light:'#fff1c6',glow:'255,190,110',shard:'#f7b75a'},
  time:{body:'#4f9cf0',light:'#d9f0ff',glow:'120,190,255',shard:'#7cb8ff'},
  gold:{body:'#ffd25e',light:'#fffbe6',glow:'255,224,130',shard:'#ffe08a'},
  ink:{body:'#1c1218',light:'#3b2a3a',glow:null,shard:'#2a1a26'}
};

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
function drawSky(ctx,w,h,t){
  var g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#12070f'); g.addColorStop(0.55,'#2e0d1a'); g.addColorStop(1,'#5a1e26');
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  var fg=ctx.createRadialGradient(w*0.5,h*1.02,0,w*0.5,h*1.02,h*0.7);
  fg.addColorStop(0,'rgba(255,170,90,.32)'); fg.addColorStop(1,'rgba(255,170,90,0)');
  ctx.fillStyle=fg; ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#fff3dc';
  for(var i=0;i<stars.length;i++){
    var s=stars[i]; ctx.globalAlpha=0.25+0.3*(0.5+0.5*Math.sin(t*1.3+s.p));
    ctx.fillRect(s.x*w,s.y*h,s.s,s.s);
  }
  ctx.globalAlpha=1;
}
function drawLights(ctx,w,h,t,spr){
  var y0=h*0.2, y1=h*0.26, sag=h*0.07;
  ctx.strokeStyle='rgba(20,8,12,.8)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,y0); ctx.quadraticCurveTo(w/2,(y0+y1)/2+sag*2,w,y1); ctx.stroke();
  ctx.globalCompositeOperation='lighter';
  var n=Math.max(8,Math.round(w/24));
  for(var i=1;i<n;i++){
    var u=i/n, y=(1-u)*(1-u)*y0+2*u*(1-u)*((y0+y1)/2+sag*2)+u*u*y1;
    var a=0.35+0.25*Math.sin(t*2+i*1.7), s=10;
    ctx.globalAlpha=a; ctx.drawImage(spr,u*w-s/2,y-s/2+3,s,s);
  }
  ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
}
function drawRoofs(ctx,w,h){
  var base=h;
  ctx.fillStyle='#0b0508';
  ctx.beginPath(); ctx.moveTo(0,base);
  for(var i=0;i<roofs.length;i++){
    var r=roofs[i], x=r.x*w, rw=r.w*w, rh=r.h*h+18, top=base-rh-28;
    ctx.lineTo(x,base-28);
    ctx.lineTo(x,top+rh*0.55);
    ctx.quadraticCurveTo(x-6,top+rh*0.35,x-10,top+rh*0.3);
    ctx.quadraticCurveTo(x+rw*0.2,top+rh*0.32,x+rw*0.3,top);
    ctx.lineTo(x+rw*0.7,top);
    ctx.quadraticCurveTo(x+rw*0.8,top+rh*0.32,x+rw+10,top+rh*0.3);
    ctx.quadraticCurveTo(x+rw+6,top+rh*0.35,x+rw,top+rh*0.55);
    ctx.lineTo(x+rw,base-28);
  }
  ctx.lineTo(w,base); ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(255,180,90,.35)';
  for(var j=0;j<wins.length;j++){ var wi=wins[j]; ctx.fillRect(wi.x*w,base-22,Math.max(4,wi.w*w),10); }
}
function drawLantern(ctx,x,y,r,kind,t,ph,alpha){
  var k=KINDS[kind];
  ctx.globalAlpha=alpha;
  if(k.glow){
    ctx.globalCompositeOperation='lighter';
    var gs=r*6.2; ctx.globalAlpha=alpha*(0.5+0.08*Math.sin(t*3+ph));
    ctx.drawImage(Arcade.fx.glow(k.glow),x-gs/2,y-gs/2,gs,gs);
    ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=alpha;
  }
  ctx.strokeStyle='rgba(20,8,12,.7)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(x,y-r-3); ctx.lineTo(x,y-r-12); ctx.stroke();
  var g=ctx.createRadialGradient(x-r*0.15,y-r*0.1,r*0.1,x,y,r);
  g.addColorStop(0,k.light); g.addColorStop(0.55,k.body); g.addColorStop(1,kind==='ink'?'#0a0609':'rgba(60,10,10,.95)');
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.ellipse(x,y,r*0.86,r,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=kind==='ink'?'rgba(170,90,160,.55)':'rgba(40,10,10,.22)'; ctx.lineWidth=kind==='ink'?1.5:1;
  ctx.beginPath(); ctx.ellipse(x,y,r*0.86,r,0,0,Math.PI*2); ctx.stroke();
  if(kind!=='ink'){
    ctx.strokeStyle='rgba(40,10,10,.2)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.ellipse(x,y,r*0.5,r*0.98,0,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x,y-r); ctx.lineTo(x,y+r); ctx.stroke();
  } else {
    ctx.strokeStyle='rgba(220,120,190,.5)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(x-r*0.3,y-r*0.3); ctx.lineTo(x+r*0.3,y+r*0.3); ctx.moveTo(x+r*0.3,y-r*0.3); ctx.lineTo(x-r*0.3,y+r*0.3); ctx.stroke();
  }
  ctx.fillStyle='#1a0b0e';
  ctx.fillRect(x-r*0.42,y-r-3,r*0.84,5);
  ctx.fillRect(x-r*0.42,y+r-2,r*0.84,5);
  var sw=Math.sin(t*2.4+ph)*0.25;
  ctx.strokeStyle=kind==='gold'?'#ffd25e':kind==='time'?'#7cb8ff':'#c23a2a'; ctx.lineWidth=1.5;
  ctx.beginPath();
  for(var i=-1;i<=1;i++){ ctx.moveTo(x+i*2,y+r+3); ctx.lineTo(x+i*2+Math.sin(sw)*r*0.5,y+r+3+r*0.55); }
  ctx.stroke();
  ctx.globalAlpha=1;
}
function drawCross(ctx,x,y,a,s){
  ctx.globalAlpha=a; ctx.strokeStyle='#fff1d6'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(x,y,s,0,Math.PI*2);
  ctx.moveTo(x-s-6,y); ctx.lineTo(x-s*0.45,y); ctx.moveTo(x+s*0.45,y); ctx.lineTo(x+s+6,y);
  ctx.moveTo(x,y-s-6); ctx.lineTo(x,y-s*0.45); ctx.moveTo(x,y+s*0.45); ctx.lineTo(x,y+s+6);
  ctx.stroke();
  ctx.fillStyle='#fff1d6'; ctx.fillRect(x-1,y-1,2,2);
  ctx.globalAlpha=1;
}

/* ---------- 사격 ---------- */
function shoot(x,y,api){
  var fx=api.fx, sfx=api.sfx, t=api.t;
  nShots++;
  sfx.noise(0.05,0.32,{type:'highpass',freq:2600,wet:false});
  sfx.tone(130,0.12,'sine',0.32,{slide:48,wet:false});
  fx.burst(x,y,6,'255,240,205',130,{size:[4,9],life:0.22});
  fx.ring(x,y,16,'255,240,210',0.2,1.5,0.7);
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
    fx.text(x,y-18,'빗나감 −1초','#a8939b',15,0.7,{rise:18});
    api.haptic(20);
    return;
  }
  nHits++;
  var total=0, pierce=hit.filter(function(h){ return h.l.kind!=='ink'; }).length;
  for(var j=0;j<hit.length;j++){
    var h=hit[j], lt=h.l, px=lx(lt,t), py=lt.y, K=KINDS[lt.kind];
    var idx=L.indexOf(lt); if(idx>=0) L.splice(idx,1);
    if(lt.kind==='ink'){
      combo=0; remaining=Math.max(0,remaining-5); sub(api);
      fx.shards(px,py,22,'#1a0f16',240,7,{gravity:300,life:1.1});
      fx.shards(px,py,8,'#4a2a44',180,5,{gravity:260});
      fx.ring(px,py,lt.r*3,'150,90,150',0.6,3,0.6);
      fx.text(px,py-24,'먹 등불 −5초','#c9a3c4',20,1.1,{rise:20});
      fx.shake(7); fx.flash(0.35,'40,10,30');
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
    fx.shards(px,py,5,'#f6e7c8',160,4,{gravity:200});
    fx.burst(px,py,crit?26:16,K.glow,crit?170:130,{gravity:-70,life:1.2,size:[4,11],drag:1.8});
    fx.ring(px,py,lt.r*2.6,K.glow,0.5,2.5,0.75);
    var note=PENT[Math.min(PENT.length-1,(combo-1)%PENT.length)];
    sfx.pluck(note,0.2);
    if(crit){
      fx.hitstop(0.04); fx.ring(px,py,lt.r*4,'255,220,130',0.7,3,0.9); fx.flash(0.22,'255,220,150'); fx.shake(4); fx.pulse(0.6);
      sfx.tone(sfx.mtof(96),0.7,'sine',0.11); sfx.tone(sfx.mtof(103),0.45,'sine',0.05,{delay:0.03});
      fx.text(px,py-lt.r-8,'정중앙 +'+pts,'#ffe08a',22,0.9);
      api.haptic(14);
    } else {
      fx.text(px,py-lt.r-8,'+'+pts,'#fff1d6',17,0.8);
      api.haptic(7);
    }
    if(lt.kind==='time'){ fx.text(px,py+lt.r+14,'+3초','#9fd0ff',18,0.9); sfx.pluck(84,0.14,0.06); sfx.pluck(91,0.12,0.14); }
    if(lt.kind==='gold') fx.text(px,py+lt.r+14,'금빛 등불','#ffe08a',16,0.9);
    if(combo%10===0){
      fx.flash(0.4,'255,190,110'); fx.text(W/2,api.H*0.42,'콤보 '+combo,'#ffd27a',30,1.2,{rise:14});
      fx.ring(W/2,api.H*0.42,W*0.6,'255,190,110',1,2,0.45);
      sfx.pluck(72,0.12); sfx.pluck(76,0.12,0.05); sfx.pluck(79,0.12,0.1); sfx.pluck(84,0.14,0.15);
    }
  }
  if(pierce>=2){
    var bonus=Math.round(total*(pierce-1)*0.5);
    total+=bonus;
    fx.text(x,y-46,'관통 ×'+pierce+' +'+bonus,'#ffb3cf',22,1.1,{rise:20});
    fx.ring(x,y,90,'255,170,205',0.6,2.5,0.7); fx.hitstop(0.05);
    sfx.pluck(91,0.14,0.05); sfx.pluck(96,0.12,0.11);
  }
  if(total>0) api.addScore(total);
  sub(api);
}

Arcade.register({
  id:'lantern',
  title:'등불 사격',
  kicker:'사격 · 60초',
  blurb:'축제의 밤, 떠오르는 등불의 정중앙을 쏴라',
  lede:'밤하늘로 떠오르는 등불을 탭해서 터뜨리세요. 정중앙을 맞히면 두 배, 겹친 등불을 한 번에 맞히면 관통 보너스예요.',
  how:'탭으로 사격 · 파란 등불 +3초 · 검은 먹 등불은 −5초 · 빗나가면 −1초',
  palette:{bg:'#1a0a12',surface:'#2a1019',surface2:'#3a1722',line:'#5a2632',text:'#fbeee2',muted:'#c7a59f',
    accent:'#f4b04a',accentInk:'#2b1400',accentDeep:'#a86a1c',hot:'#ff8a6b',hotText:'#ffd27a',hotRgb:'255,190,110'},
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
        api.fx.text(W/2,H*0.45,'시간 종료','#ffd27a',30,1.2,{rise:10});
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
          if(combo>=3) api.fx.text(W/2,TOP+10,'놓친 등불 · 콤보 끊김','#c7a59f',14,0.8,{rise:10});
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
    drawLights(ctx,W,H,t,Arcade.fx.glow('255,200,120'));
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
      vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(150,30,30,'+(0.18+0.1*Math.sin(t*6))+')');
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
    drawLights(ctx,w,h,t,Arcade.fx.glow('255,200,120'));
    var u=Math.min(w,h)/12, tx=0, ty=0;
    for(var i=0;i<8;i++){
      var sp=0.07+(i%3)*0.03, r=u*(0.75+(i%4)*0.18);
      var y=h+r*2-((t*sp*h+i*h*0.41)%(h+r*4));
      var x=((i*0.137+0.08)%1)*(w-r*3)+r*1.5+Math.sin(t*(0.9+i*0.1)+i)*r*0.3;
      var kind=i===5?'time':i===2?'gold':(i%2?'red':'amber');
      drawLantern(ctx,x,y,r,kind,t,i,1);
      if(i===0){ tx=x; ty=y; }
    }
    drawRoofs(ctx,w,h);
    drawCross(ctx,tx+Math.sin(t*3)*2,ty+Math.cos(t*2.5)*2,0.8,u*0.8);
  },

  result:function(){
    var acc=nShots?Math.round(nHits/nShots*100):0;
    return {
      stats:[['명중률',acc+'%'],['정중앙',nCrits],['최대 콤보',maxCombo]],
      line:nPop>0?'등불 '+nPop+'개를 밤하늘에 터뜨렸어요. 정중앙 '+nCrits+'번.':'등불이 기다려요. 숨을 고르고 정중앙을 노려 보세요.'
    };
  }
});
})();

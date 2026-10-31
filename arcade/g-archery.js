/* 하트 양궁: 끌어서 당기고 놓아서 쏘는 60초 양궁. 중력과 바람이 화살을 휘게 하고, 과녁은 점점 작고 멀고 빨라진다. */
(function(){
'use strict';
var U=Arcade.util, clamp=U.clamp, lerp=U.lerp, easeOutBack=U.easeOutBack;
var W=360, G=520, TIME=60, MAXPULL=150;
var RING_PTS=[10,30,60,150], RING_NAME=['바깥','가운데','안쪽','정중앙!'];
var PENT=[72,74,76,79,81,84,86,88,91,93];
var S=null;
var clouds=[]; for(var ci=0;ci<6;ci++) clouds.push({x:Math.random()*W,y:140+Math.random()*240,s:0.6+Math.random()*0.8,v:5+Math.random()*9});

function bow(api){ return {x:W/2,y:api.H-132}; }
function diff(){ return clamp((S.el-12)/45,0,1); }
function mult(){ return Math.min(6,1+Math.floor(Math.max(0,S.combo-1)/3)); }

/* ---------- 그리기 도구 ---------- */
function heart(ctx,x,y,s){
  ctx.beginPath();
  ctx.moveTo(x,y+s*0.4);
  ctx.bezierCurveTo(x-s*1.1,y-s*0.25,x-s*0.5,y-s*1.05,x,y-s*0.42);
  ctx.bezierCurveTo(x+s*0.5,y-s*1.05,x+s*1.1,y-s*0.25,x,y+s*0.4);
  ctx.closePath();
}
function cloud(ctx,x,y,s,a){
  ctx.globalAlpha=a; ctx.fillStyle='#fff';
  ctx.beginPath();
  ctx.arc(x,y,16*s,0,Math.PI*2); ctx.arc(x+18*s,y-6*s,20*s,0,Math.PI*2); ctx.arc(x+38*s,y,15*s,0,Math.PI*2);
  ctx.rect(x,y,38*s,14*s); ctx.fill(); ctx.globalAlpha=1;
}
function drawSky(ctx,w,h,t){
  var g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#ffe4ee'); g.addColorStop(0.5,'#e9f1ff'); g.addColorStop(1,'#eafbf3');
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  ctx.globalAlpha=0.6; ctx.fillStyle='#fff3c4';
  ctx.beginPath(); ctx.arc(w*0.82,h*0.2,Math.min(w,h)*0.09,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
}
function drawMeadow(ctx,w,h){
  ctx.fillStyle='#c8f1df';
  ctx.beginPath(); ctx.moveTo(0,h); ctx.lineTo(0,h*0.86);
  ctx.quadraticCurveTo(w*0.25,h*0.8,w*0.5,h*0.85); ctx.quadraticCurveTo(w*0.78,h*0.9,w,h*0.83); ctx.lineTo(w,h); ctx.fill();
  ctx.fillStyle='#a8e6cc';
  ctx.beginPath(); ctx.moveTo(0,h); ctx.lineTo(0,h*0.92);
  ctx.quadraticCurveTo(w*0.4,h*0.87,w*0.7,h*0.93); ctx.quadraticCurveTo(w*0.88,h*0.96,w,h*0.92); ctx.lineTo(w,h); ctx.fill();
  var cols=['#ff9ec0','#ffd66b','#ffffff','#c7b8ff'];
  for(var i=0;i<14;i++){
    var fx=(i*53.7)%w, fy=h*(0.9+((i*37)%9)/100);
    ctx.fillStyle=cols[i%4]; ctx.beginPath(); ctx.arc(fx,fy,2.6,0,Math.PI*2); ctx.fill();
  }
}
function drawBoard(ctx,x,y,r,wob,alpha){
  ctx.save(); ctx.globalAlpha=alpha==null?1:alpha;
  ctx.translate(x,y); ctx.rotate(Math.sin(wob*24)*wob*0.25); ctx.scale(1+wob*0.08,1-wob*0.06);
  ctx.fillStyle='rgba(163,54,93,.14)'; ctx.beginPath(); ctx.ellipse(3,5,r,r,0,0,Math.PI*2); ctx.fill();
  var rings=[[1,'#ff8fb5'],[0.72,'#ffffff'],[0.47,'#ffd66b'],[0.22,'#fff6d6']];
  for(var i=0;i<rings.length;i++){ ctx.fillStyle=rings[i][1]; ctx.beginPath(); ctx.arc(0,0,r*rings[i][0],0,Math.PI*2); ctx.fill(); }
  ctx.strokeStyle='rgba(255,255,255,.95)'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
  // 사탕 줄무늬
  ctx.save(); ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.arc(0,0,r*0.72,0,Math.PI*2,true); ctx.clip();
  ctx.strokeStyle='rgba(255,255,255,.5)'; ctx.lineWidth=r*0.12;
  for(var k=0;k<8;k++){ var a=k*Math.PI/4; ctx.beginPath(); ctx.moveTo(Math.cos(a)*r*0.7,Math.sin(a)*r*0.7); ctx.lineTo(Math.cos(a+0.4)*r,Math.sin(a+0.4)*r); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle='#f7b500'; heart(ctx,0,r*0.02,r*0.2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(-r*0.06,-r*0.08,r*0.04,0,Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawBalloon(ctx,x,y,r,col,mark,t){
  ctx.strokeStyle='rgba(119,17,60,.35)'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(x,y+r); ctx.quadraticCurveTo(x+Math.sin(t*3)*5,y+r+14,x,y+r+28); ctx.stroke();
  ctx.fillStyle='rgba(163,54,93,.12)'; ctx.beginPath(); ctx.ellipse(x+3,y+4,r*0.9,r,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=col; ctx.beginPath(); ctx.ellipse(x,y,r*0.9,r,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x-3,y+r+3); ctx.lineTo(x+3,y+r+3); ctx.lineTo(x,y+r-1); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(x-r*0.35,y-r*0.4,r*0.18,r*0.28,-0.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff'; ctx.strokeStyle='#fff'; ctx.lineWidth=1.8;
  if(mark==='star'){
    ctx.beginPath();
    for(var i=0;i<10;i++){ var a=-Math.PI/2+i*Math.PI/5, rr=i%2?r*0.18:r*0.42; ctx.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr); }
    ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(x,y,r*0.42,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y-r*0.28); ctx.moveTo(x,y); ctx.lineTo(x+r*0.2,y+r*0.08); ctx.stroke();
  }
}
function drawArrow(ctx,x,y,ang,len,alpha){
  ctx.save(); ctx.globalAlpha=alpha==null?1:alpha;
  ctx.translate(x,y); ctx.rotate(ang);
  ctx.strokeStyle='#a3365d'; ctx.lineWidth=2.4; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-len,0); ctx.lineTo(-4,0); ctx.stroke();
  ctx.fillStyle='#ac97fe';
  ctx.beginPath(); ctx.moveTo(-len,0); ctx.lineTo(-len-7,-5); ctx.lineTo(-len+5,0); ctx.lineTo(-len-7,5); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#ff5f92'; ctx.save(); ctx.rotate(Math.PI/2); heart(ctx,0,-2,5.5); ctx.fill(); ctx.restore();
  ctx.restore();
}
/* 루루와 활: ang = 쏠 방향, pull = 당긴 정도(0..1) */
function drawBunny(ctx,x,y,s,ang,pull,squint,nocked){
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  ctx.fillStyle='rgba(163,54,93,.12)'; ctx.beginPath(); ctx.ellipse(0,46,34,7,0,0,Math.PI*2); ctx.fill();
  // 귀
  for(var e=-1;e<=1;e+=2){
    ctx.save(); ctx.translate(e*12,-18); ctx.rotate(e*0.18);
    ctx.fillStyle='#fff'; ctx.strokeStyle='#ffc3d6'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-24,8,22,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#ffb1c5'; ctx.beginPath(); ctx.ellipse(0,-22,3.8,15,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  // 몸과 머리
  ctx.fillStyle='#fff'; ctx.strokeStyle='#ffc3d6'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.ellipse(0,30,22,18,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0,6,30,26,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
  // 헤드셋
  ctx.strokeStyle='#ac97fe'; ctx.lineWidth=5; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(0,6,27,Math.PI*1.08,Math.PI*1.92); ctx.stroke();
  ctx.fillStyle='#ac97fe'; ctx.beginPath(); ctx.arc(-27,4,6,0,Math.PI*2); ctx.arc(27,4,6,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ffd66b'; ctx.beginPath();
  for(var i=0;i<10;i++){ var a=-Math.PI/2+i*Math.PI/5, rr=i%2?2.6:6; ctx.lineTo(27+Math.cos(a)*rr,-6+Math.sin(a)*rr); }
  ctx.closePath(); ctx.fill();
  // 얼굴
  ctx.strokeStyle='#3f001b'; ctx.fillStyle='#3f001b'; ctx.lineWidth=2.4;
  if(squint){
    ctx.beginPath(); ctx.moveTo(-14,4); ctx.lineTo(-8,7); ctx.lineTo(-14,10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14,4); ctx.lineTo(8,7); ctx.lineTo(14,10); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(-10,7,3.4,0,Math.PI*2); ctx.arc(10,7,3.4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-9,5.8,1.2,0,Math.PI*2); ctx.arc(11,5.8,1.2,0,Math.PI*2); ctx.fill();
  }
  ctx.fillStyle='rgba(255,177,197,.85)'; ctx.beginPath(); ctx.ellipse(-17,15,5,3,0,0,Math.PI*2); ctx.ellipse(17,15,5,3,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#a3365d'; ctx.lineWidth=1.8; ctx.beginPath();
  if(squint){ ctx.arc(0,16,3,0,Math.PI); } else { ctx.moveTo(-3,14); ctx.quadraticCurveTo(0,17,3,14); }
  ctx.stroke();
  // 활
  ctx.save(); ctx.translate(0,-8); ctx.rotate(ang+Math.PI/2);
  var p=pull*24;
  ctx.strokeStyle='#ff7b5c'; ctx.lineWidth=4; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-26,6); ctx.quadraticCurveTo(0,-26,26,6); ctx.stroke();
  ctx.fillStyle='#ff5f92'; heart(ctx,0,-12,5); ctx.fill();
  ctx.strokeStyle='rgba(119,17,60,.55)'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(-26,6); ctx.lineTo(0,6+p); ctx.lineTo(26,6); ctx.stroke();
  ctx.restore();
  if(nocked){ var ax=Math.cos(ang), ay=Math.sin(ang); drawArrow(ctx,ax*(30-pull*24),-8+ay*(30-pull*24),ang,36,1); }
  ctx.restore();
}

/* ---------- 과녁 만들기 ---------- */
function newBoard(api,opt){
  var rng=S.rng, k=S.attract?0:diff(), el=S.attract?0:S.el;
  opt=opt||{};
  var r=opt.r||lerp(34,20,k)*(0.9+rng()*0.2);
  var top=152, bot=Math.max(top+70,api.H*0.56-k*api.H*0.12);
  var mv='static';
  if(el>15&&!opt.still){ var p=rng(); mv=p<0.35?'float':p<0.7?'slide':'bob'; if(el<25&&p>0.6) mv='static'; }
  var amp=lerp(22,70,k)*(0.6+rng()*0.5), maxAmp=Math.max(8,(W-60-2*r)/2);
  if(mv==='slide'||mv==='bob') amp=Math.min(amp,maxAmp);
  var lo=30+r+((mv==='slide'||mv==='bob')?amp:0), hi=W-30-r-((mv==='slide'||mv==='bob')?amp:0);
  var x=opt.x!=null?opt.x:lo+rng()*Math.max(0,hi-lo), y=opt.y!=null?opt.y:top+rng()*(bot-top);
  var t={kind:'board',x:x,y:y,bx:x,by:y,r:r,mv:opt.mv||mv,amp:amp,spd:lerp(0.6,1.8,k)*(0.8+rng()*0.4),ph:opt.ph!=null?opt.ph:rng()*6.28,
    stuck:[],wob:0,popAt:0,dead:false,balloon:!opt.pair&&rng()<0.3,born:api.t,pair:opt.pair||0,rail:(opt.mv||mv)==='slide'};
  S.targets.push(t);
  return t;
}
function newPair(api){
  var rng=S.rng, k=diff(), r=lerp(28,20,k);
  var x=60+r+rng()*(W-120-2*r), y=api.H*0.5-rng()*40;
  var id=++S.pairSeq, ph=rng()*6.28;
  newBoard(api,{r:r,x:x,y:y,pair:id,mv:'static',ph:ph,still:true});
  newBoard(api,{r:r,x:x,y:y-2*r-34,pair:id,mv:'static',ph:ph,still:true});
}
function newBalloon(api,kind){
  var rng=S.rng, gold=kind==='gold', k=diff();
  var x=50+rng()*(W-100);
  S.targets.push({kind:kind,x:x,y:api.H*0.66,bx:x,by:0,r:gold?13:17,rise:gold?lerp(70,120,k):lerp(38,60,k),sway:gold?34:18,ph:rng()*6.28,
    born:api.t,stuck:[],wob:0,popAt:0,dead:false});
}
function liveBoards(){ var n=0; S.targets.forEach(function(t){ if(t.kind==='board'&&!t.dead&&!t.popAt) n++; }); return n; }

/* ---------- 쏘기 ---------- */
function aimFrom(dx,dy){
  var len=Math.hypot(dx,dy); if(len<1) return null;
  var a=Math.atan2(-dy,-dx);
  if(a>-0.17&&a<=Math.PI/2) a=-0.17; else if(a<-Math.PI+0.17||a>Math.PI/2) a=-Math.PI+0.17;
  var d=Math.min(MAXPULL,len);
  return {ang:a,pull:d/MAXPULL,speed:300+d*5};
}
function curAim(){
  if(S.drag&&S.drag.aim) return S.drag.aim;
  if(S.kb.drawing) return {ang:S.kb.ang,pull:S.kb.pow/MAXPULL,speed:300+S.kb.pow*5};
  return null;
}
function fire(api,aim){
  if(!aim||aim.pull<0.12) return false;
  if(api.t<S.nextShot) return false;
  var b=bow(api);
  S.arrows.push({x:b.x+Math.cos(aim.ang)*20,y:b.y+Math.sin(aim.ang)*20,vx:Math.cos(aim.ang)*aim.speed,vy:Math.sin(aim.ang)*aim.speed,
    hit:[],any:false,age:0,dead:false,trail:0});
  S.nextShot=api.t+0.3;
  if(api.state==='play'){
    S.shots++;
    api.sfx.tone(330,0.25,'triangle',0.12,{slide:210,wet:false});
    api.sfx.noise(0.12,0.06,{type:'highpass',freq:2400});
    api.haptic(8);
    if(--S.windShots<=0) newWind(api,true);
  }
  return true;
}
function newWind(api,announce){
  var rng=S.rng, k=diff(), max=S.el<15?0.8:lerp(1.2,3.5,k);
  S.wind=(rng()<0.5?-1:1)*max*(0.25+rng()*0.75);
  S.windShots=Math.round(lerp(4,2,k))+(rng()<0.5?1:0);
  if(announce) api.fx.text(70,api.H*0.3,'바람이 바뀌었어요','#634eb0',15,1,{stroke:'rgba(255,255,255,.9)'});
}

/* ---------- 맞히기 ---------- */
function onHit(api,ar,t){
  var fx=api.fx, sfx=api.sfx, play=api.state==='play';
  ar.hit.push(t);
  var first=!ar.any; ar.any=true;
  if(play&&first){ S.hits++; S.combo++; if(S.combo>S.maxCombo) S.maxCombo=S.combo; }
  var m=mult();
  if(t.kind!=='board'){
    t.popAt=api.t;
    var gold=t.kind==='gold';
    fx.burst(t.x,t.y,18,gold?'255,200,90':'86,219,193',140,{size:[4,10],life:0.8});
    fx.shards(t.x,t.y,10,gold?'#ffd66b':'#56dbc1',150,6,{gravity:260});
    fx.ring(t.x,t.y,46,gold?'255,200,90':'86,219,193',0.6,2.5,0.8);
    if(play){
      if(gold){ api.addScore(300*m); S.rem+=3; fx.text(t.x,t.y-20,'금빛 +'+(300*m)+' · +3초','#e09a00',20,1.2,{stroke:'rgba(255,255,255,.9)'}); }
      else { api.addScore(50*m); S.rem+=5; fx.text(t.x,t.y-20,'시간 +5초','#1fae95',20,1.2,{stroke:'rgba(255,255,255,.9)'}); }
      sfx.pluck(gold?91:86,0.16); sfx.pluck(gold?96:91,0.12,0.07); api.haptic(14);
    }
    return true;
  }
  var d=Math.hypot(ar.x-t.x,ar.y-t.y), q=d/t.r, ring=q<=0.22?3:q<=0.47?2:q<=0.72?1:0;
  t.wob=1;
  var pierce=false;
  if(t.pair){
    var partner=null;
    S.targets.forEach(function(o){ if(o!==t&&o.pair===t.pair&&!o.dead&&!o.popAt) partner=o; });
    var hitBoth=ar.hit.filter(function(o){ return o.pair===t.pair; }).length>=2;
    pierce=!!partner&&!hitBoth&&ar.hit.indexOf(partner)<0;
    if(hitBoth&&play){ api.addScore(200*m); fx.text(W/2,api.H*0.36,'관통! +'+(200*m),'#ff5f92',26,1.4,{stroke:'rgba(255,255,255,.9)',rise:16}); fx.hitstop(0.05); sfx.pluck(93,0.15,0.05); }
  }
  if(!pierce){
    t.stuck.push({dx:ar.x-t.x,dy:ar.y-t.y,ang:Math.atan2(ar.vy,ar.vx)});
    ar.dead=true;
  }
  if(!t.popAt) t.popAt=api.t+0.42;
  fx.ring(ar.x,ar.y,ring===3?60:30,ring===3?'255,200,90':'255,126,166',0.5,ring===3?3:2,0.85);
  fx.burst(ar.x,ar.y,ring===3?16:6,ring===3?'255,200,90':'255,126,166',ring===3?150:80,{size:[3,8],life:0.6});
  fx.shake(ring===3?4:2);
  if(play){
    sfx.tone(140,0.15,'sine',0.25,{slide:70,wet:false});
    sfx.noise(0.08,0.12,{freq:900});
    var pts=RING_PTS[ring]*m;
    api.addScore(pts);
    if(ring===3){ S.centers++; S.rem+=1.5; fx.hitstop(0.06); fx.flash(0.35,'255,236,170'); sfx.pluck(88,0.18); sfx.pluck(95,0.12,0.06); api.haptic(18); }
    else if(ring===2){ S.rem+=0.5; }
    fx.text(ar.x,t.y-t.r-10,(ring===3?'정중앙! +':RING_NAME[ring]+' +')+pts,ring===3?'#e09a00':'#ff5f92',ring===3?24:17,1,{stroke:'rgba(255,255,255,.9)'});
    var step=PENT[Math.min(PENT.length-1,S.combo-1)];
    sfx.pluck(step,0.1,0.05);
    updateSub(api);
  }
  return !pierce;
}
function onMiss(api){
  if(api.state!=='play') return;
  S.combo=0; updateSub(api);
  api.sfx.noise(0.3,0.06,{type:'bandpass',freq:800,slide:300,q:1.2});
}
function updateSub(api){ api.setSub(S.combo>=2?'연속 '+S.combo+' · ×'+mult():''); }

/* ---------- 등록 ---------- */
Arcade.register({
  id:'archery',
  title:'하트 양궁',
  kicker:'ARCHERY · 60초',
  blurb:'당겨서 놓으면 하트 화살이 슝, 정중앙을 노려요',
  lede:'화면을 누른 채 뒤로 끌어 활을 당기고, 놓으면 하트 화살이 날아가요. 바람과 중력을 읽어 과녁 한가운데 금빛 하트를 맞히면 시간이 늘어나요.',
  how:'누르고 뒤로 끌기 · 놓으면 발사 · 길게 끌수록 멀리 · 바람 깃발을 보세요',
  lifeIcon:null,
  endDelay:1300,
  palette:{bg:'#fff6fb',surface:'#ffffff',surface2:'#fff1ec',line:'#ffd6cc',text:'#21172b',muted:'#887176',
    accent:'#ff7b5c',accentInk:'#ffffff',accentDeep:'#d4553a',hot:'#ff5f92',hotText:'#ff5f92',hotRgb:'255,126,166',light:true},

  start:function(api){
    var play=api.state==='play';
    S={attract:!play,rng:play?api.rng:Math.random,targets:[],arrows:[],grounded:[],el:0,rem:TIME,combo:0,maxCombo:0,
      shots:0,hits:0,centers:0,nextShot:0,wind:0,windShots:4,drag:null,kb:{ang:-Math.PI/2,pow:90,drawing:false},
      stage:1,pairSeq:0,nextSpecial:9,respawnAt:0,autoAt:api.t+0.8,drawSnd:0,ended:false};
    newWind(api,false);
    if(!play){ S.wind=0; newBoard(api,{x:W*0.62,y:api.H*0.3,r:30,mv:'static',still:true}); return; }
    newBoard(api,{x:W/2,y:api.H*0.42,r:34,still:true});
    api.setMeter(1,'남은 시간 60.0초',false);
    updateSub(api);
  },

  reviveText:'15초를 더 받고 이어서 쏴요',
  // 이어하기: 날아가던 화살은 치우고 시간을 15초 더한다. 점수와 단계는 그대로 둔다
  revive:function(api){
    S.ended=false; S.rem=Math.max(0,S.rem)+15; S.arrows.length=0;
    S.drag=null; S.kb.drawing=false; S.combo=0; S.respawnAt=api.t+0.2;
    api.setMeter(S.rem/TIME,'남은 시간 '+S.rem.toFixed(1)+'초',false);
    updateSub(api);
    api.fx.text(W/2,api.H*0.4,'이어서 GO! +15초','#ff5f92',26,1.3,{rise:16,stroke:'rgba(255,255,255,.9)'});
    api.fx.ring(W/2,api.H*0.45,W*0.7,'255,126,166',1.3,2,0.4);
    api.sfx.pluck(76,0.15); api.sfx.pluck(81,0.15,0.1); api.sfx.pluck(88,0.16,0.2);
  },

  update:function(dt,api){
    var play=api.state==='play', i, t;
    if(play){
      S.el+=dt; S.rem=Math.min(99,S.rem)-dt;
      if(S.el>=20&&S.stage===1){ S.stage=2; api.fx.text(W/2,api.H*0.34,'단계 2 · 과녁이 움직여요!','#ff7b5c',22,1.5,{stroke:'rgba(255,255,255,.9)',rise:14}); api.sfx.pluck(84,0.12); api.sfx.pluck(88,0.12,0.1); }
      if(S.el>=40&&S.stage===2){ S.stage=3; api.fx.text(W/2,api.H*0.34,'단계 3 · 바람이 세져요!','#ff7b5c',22,1.5,{stroke:'rgba(255,255,255,.9)',rise:14}); api.sfx.pluck(86,0.12); api.sfx.pluck(91,0.12,0.1); }
      var want=S.el<20?1:S.el<40?2:3;
      if(liveBoards()<want&&api.t>=S.respawnAt){
        if(S.el>25&&S.rng()<0.22&&liveBoards()<=want-1) newPair(api); else newBoard(api);
        S.respawnAt=api.t+0.35;
      }
      if(S.el>=S.nextSpecial){ newBalloon(api,S.rng()<0.5?'gold':'time'); S.nextSpecial=S.el+lerp(11,7,diff())+S.rng()*4; }
      api.setMeter(Math.max(0,S.rem)/TIME,'남은 시간 '+Math.max(0,S.rem).toFixed(1)+'초',S.rem<10);
      var aim=curAim();
      if(aim&&api.t>S.drawSnd){ S.drawSnd=api.t+0.12; api.sfx.tone(180+aim.pull*260,0.06,'triangle',0.02,{wet:false}); }
      if(S.rem<=0&&!S.ended){ S.ended=true; api.setMeter(0,'시간 종료',true); api.setSub(''); S.drag=null; S.kb.drawing=false; api.end(); }
    } else if(api.state==='menu'||api.state==='over'){
      if(api.t>S.autoAt&&S.targets.length){
        var tg=S.targets[0], b=bow(api), T=0.75, err=(Math.random()-0.5)*14;
        var vx=(tg.x+err-b.x)/T, vy=(tg.y-b.y-0.5*G*T*T)/T;
        S.arrows.push({x:b.x,y:b.y,vx:vx,vy:vy,hit:[],any:false,age:0,dead:false,trail:0});
        S.autoAt=api.t+1.7;
      }
      if(!S.targets.length||S.targets.every(function(o){ return o.dead||o.popAt; })){
        if(api.t>S.respawnAt){ S.targets=S.targets.filter(function(o){ return !o.dead; }); newBoard(api,{x:60+Math.random()*(W-120),y:api.H*(0.24+Math.random()*0.16),r:30,mv:'static',still:true}); S.respawnAt=api.t+999; }
      } else S.respawnAt=Math.min(S.respawnAt,api.t+0.5);
    }

    // 과녁 움직임
    for(i=S.targets.length-1;i>=0;i--){
      t=S.targets[i];
      var age=api.t-t.born;
      if(t.kind==='board'){
        if(t.mv==='float') t.y=t.by+Math.sin(age*t.spd*2+t.ph)*t.amp*0.45;
        else if(t.mv==='slide') t.x=t.bx+Math.sin(age*t.spd+t.ph)*t.amp;
        else if(t.mv==='bob'){ t.x=t.bx+Math.sin(age*t.spd*0.8+t.ph)*t.amp; t.y=t.by+Math.sin(age*t.spd*2.2+t.ph)*t.amp*0.28; }
      } else if(!t.popAt){
        t.y-=t.rise*dt; t.x=t.bx+Math.sin(age*1.6+t.ph)*t.sway;
        if(t.y<110) t.dead=true;
      }
      t.wob=Math.max(0,t.wob-dt*2.5);
      if(t.popAt&&api.t>=t.popAt&&!t.dead){
        t.dead=true;
        if(t.kind==='board'){
          api.fx.shards(t.x,t.y,16,'#ff8fb5',190,7,{gravity:300});
          api.fx.shards(t.x,t.y,10,'#ffd66b',170,6,{gravity:300});
          api.fx.burst(t.x,t.y,12,'255,126,166',120,{size:[4,9]});
          if(api.state==='play') api.sfx.tone(700,0.09,'sine',0.05,{slide:1200,wet:false});
          S.respawnAt=Math.max(S.respawnAt,api.t+0.3);
        }
      }
      if(t.dead) S.targets.splice(i,1);
    }

    // 화살
    for(i=S.arrows.length-1;i>=0;i--){
      var ar=S.arrows[i];
      ar.age+=dt;
      var sp=Math.hypot(ar.vx,ar.vy), n=Math.max(1,Math.ceil(sp*dt/6)), sdt=dt/n;
      for(var s=0;s<n&&!ar.dead;s++){
        ar.vy+=G*sdt; ar.vx+=S.wind*30*sdt;
        ar.x+=ar.vx*sdt; ar.y+=ar.vy*sdt;
        for(var j=0;j<S.targets.length&&!ar.dead;j++){
          t=S.targets[j];
          if(t.dead||t.popAt||ar.hit.indexOf(t)>=0) continue;
          if(Math.hypot(ar.x-t.x,ar.y-t.y)<t.r+1) onHit(api,ar,t);
        }
      }
      ar.trail-=dt;
      if(ar.trail<=0&&!ar.dead){ ar.trail=0.05; api.fx.burst(ar.x,ar.y,1,'255,170,205',10,{size:[3,6],life:0.35,drag:4}); }
      var b2=bow(api);
      if(!ar.dead&&ar.vy>0&&ar.y>b2.y+70){
        ar.dead=true;
        S.grounded.push({x:ar.x,y:b2.y+70+Math.random()*12,ang:Math.atan2(ar.vy,ar.vx),t:api.t});
        if(!ar.any) onMiss(api);
      } else if(!ar.dead&&(ar.x<-60||ar.x>W+60||ar.age>4)){
        ar.dead=true; if(!ar.any) onMiss(api);
      }
      if(ar.dead) S.arrows.splice(i,1);
    }
    for(i=S.grounded.length-1;i>=0;i--){ if(api.t-S.grounded[i].t>2.5) S.grounded.splice(i,1); }
    for(i=0;i<clouds.length;i++){ var c=clouds[i]; c.x+=c.v*dt; if(c.x>W+60) c.x=-80; }
  },

  draw:function(ctx,api){
    var H=api.H, t=api.t, i;
    drawSky(ctx,W,H,t);
    for(i=0;i<clouds.length;i++) cloud(ctx,clouds[i].x,clouds[i].y,clouds[i].s,0.85);
    drawMeadow(ctx,W,H);

    // 바람 깃발
    var fx0=26, fy0=Math.max(132,H*0.2), wv=S.wind, len=14+Math.abs(wv)*14, dir=wv>=0?1:-1;
    ctx.strokeStyle='#a3365d'; ctx.lineWidth=2.5; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(fx0,fy0); ctx.lineTo(fx0,fy0+46); ctx.stroke();
    var cols=['#ff7ea6','#ffffff','#ac97fe'];
    for(i=0;i<3;i++){
      ctx.strokeStyle=cols[i]; ctx.lineWidth=4;
      ctx.beginPath(); ctx.moveTo(fx0,fy0+4+i*4);
      for(var k=1;k<=6;k++){ var px=fx0+dir*len*k/6, py=fy0+4+i*4+Math.sin(t*8+k+i)*(2+Math.abs(wv)*0.6)+(Math.abs(wv)<0.3?k*2.4:0); ctx.lineTo(px,py); }
      ctx.stroke();
    }
    ctx.font='400 13px '+Arcade.fx.font; ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.lineWidth=4; ctx.strokeStyle='rgba(255,255,255,.9)';
    var lab='바람 '+(Math.abs(wv)<0.05?'없음':(wv>0?'→ ':'← ')+Math.abs(wv).toFixed(1));
    ctx.strokeText(lab,fx0-8,fy0+60); ctx.fillStyle='#634eb0'; ctx.fillText(lab,fx0-8,fy0+60);

    // 과녁
    for(i=0;i<S.targets.length;i++){
      var tg=S.targets[i], pa=tg.popAt?Math.max(0,1-(t-tg.popAt+0.42)/0.42*0.3):1;
      if(tg.kind==='board'){
        if(tg.rail){ ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(tg.bx-tg.amp-tg.r,tg.by+tg.r+10); ctx.lineTo(tg.bx+tg.amp+tg.r,tg.by+tg.r+10); ctx.stroke();
          cloud(ctx,tg.bx-tg.amp-tg.r-20,tg.by+tg.r+12,0.5,0.95); cloud(ctx,tg.bx+tg.amp+tg.r-2,tg.by+tg.r+12,0.5,0.95); }
        if(tg.balloon){ drawBalloon(ctx,tg.x+tg.r*0.9,tg.y-tg.r-18,10,'#ffb1c5','star',t); }
        if(tg.pair){ ctx.strokeStyle='rgba(172,151,254,.5)'; ctx.setLineDash([4,5]); ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(tg.x,tg.y-tg.r); ctx.lineTo(tg.x,tg.y-tg.r-14); ctx.stroke(); ctx.setLineDash([]); }
        drawBoard(ctx,tg.x,tg.y,tg.r,tg.wob,pa);
        for(var a=0;a<tg.stuck.length;a++){ var st=tg.stuck[a]; drawArrow(ctx,tg.x+st.dx+Math.cos(st.ang)*4,tg.y+st.dy+Math.sin(st.ang)*4,st.ang,26,pa); }
      } else if(!tg.popAt){
        drawBalloon(ctx,tg.x,tg.y,tg.r,tg.kind==='gold'?'#ffc93c':'#56dbc1',tg.kind==='gold'?'star':'clock',t);
      }
    }
    for(i=0;i<S.grounded.length;i++){ var gd=S.grounded[i]; drawArrow(ctx,gd.x,gd.y,gd.ang,22,1-Math.max(0,(t-gd.t-1.8)/0.7)); }

    // 조준선(앞부분만)
    var b=bow(api), aim=api.state==='play'?curAim():null;
    if(aim&&aim.pull>=0.12){
      var vx=Math.cos(aim.ang)*aim.speed, vy=Math.sin(aim.ang)*aim.speed, x=b.x, y=b.y;
      var flight=Math.max(0.3,2*Math.max(0,-vy)/G), T=flight*0.35, steps=Math.ceil(T*60);
      ctx.fillStyle='#ff5f92';
      for(var s2=0;s2<steps;s2++){
        vy+=G/60; vx+=S.wind*30/60; x+=vx/60; y+=vy/60;
        if(s2%3===0){ ctx.globalAlpha=0.75*(1-s2/steps); ctx.beginPath(); ctx.arc(x,y,2.6,0,Math.PI*2); ctx.fill(); }
      }
      ctx.globalAlpha=1;
      ctx.strokeStyle='rgba(255,123,92,.55)'; ctx.lineWidth=4; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(b.x,b.y+30,46,-Math.PI*0.5-aim.pull*Math.PI*0.5,-Math.PI*0.5+aim.pull*Math.PI*0.5); ctx.stroke();
    }

    // 날아가는 화살
    for(i=0;i<S.arrows.length;i++){ var ar=S.arrows[i]; drawArrow(ctx,ar.x,ar.y,Math.atan2(ar.vy,ar.vx),38,1); }

    // 루루
    var ang=aim?aim.ang:-Math.PI/2, pull=aim?aim.pull:0;
    var ready=api.t>=S.nextShot;
    drawBunny(ctx,b.x,b.y+30,1,ang,pull,!!aim&&pull>0.15,ready&&api.state!=='dying');
  },

  pointer:function(type,x,y,api){
    if(S.ended) return;
    if(type==='down'){ S.drag={sx:x,sy:y,aim:null}; }
    else if(type==='move'){ if(S.drag&&api.pointerDown) S.drag.aim=aimFrom(x-S.drag.sx,y-S.drag.sy); }
    else if(type==='up'){
      if(S.drag){ S.drag.aim=aimFrom(x-S.drag.sx,y-S.drag.sy)||S.drag.aim; fire(api,S.drag.aim); }
      S.drag=null;
    }
  },
  key:function(type,code,api){
    if(S.ended) return false;
    var kb=S.kb;
    if(code==='ArrowLeft'||code==='KeyA'){ if(type==='down'){ kb.ang=clamp(kb.ang-0.05,-Math.PI+0.17,-0.17); kb.drawing=true; } return true; }
    if(code==='ArrowRight'||code==='KeyD'){ if(type==='down'){ kb.ang=clamp(kb.ang+0.05,-Math.PI+0.17,-0.17); kb.drawing=true; } return true; }
    if(code==='ArrowUp'||code==='KeyW'){ if(type==='down'){ kb.pow=clamp(kb.pow+6,20,MAXPULL); kb.drawing=true; } return true; }
    if(code==='ArrowDown'||code==='KeyS'){ if(type==='down'){ kb.pow=clamp(kb.pow-6,20,MAXPULL); kb.drawing=true; } return true; }
    if(code==='Space'||code==='Enter'){
      if(type==='down') kb.drawing=true;
      else { fire(api,{ang:kb.ang,pull:kb.pow/MAXPULL,speed:300+kb.pow*5}); kb.drawing=false; }
      return true;
    }
    return false;
  },

  preview:function(ctx,w,h,t){
    drawSky(ctx,w,h,t);
    cloud(ctx,(t*12)%(w+80)-60,h*0.22,0.7,0.9);
    cloud(ctx,(t*7+w*0.5)%(w+80)-60,h*0.4,0.5,0.8);
    drawMeadow(ctx,w,h);
    var cyc=(t*0.6)%1, tx=w*0.68, ty=h*0.34, r=Math.min(w,h)*0.15;
    var bx=w*0.24, by=h*0.74, s=Math.min(1,h/260);
    var hitPhase=cyc>0.78, wob=hitPhase?Math.max(0,1-(cyc-0.78)/0.22):0;
    drawBoard(ctx,tx,ty,r,wob*0.6,1);
    var ang=Math.atan2(ty-by-20,tx-bx)-0.25;
    var pull=cyc<0.45?cyc/0.45:0;
    drawBunny(ctx,bx,by,s,ang,pull,pull>0.2,cyc<0.45);
    if(cyc>=0.45&&cyc<=0.78){
      var u=(cyc-0.45)/0.33, sx=bx+Math.cos(ang)*20*s, sy=by-8*s;
      var x=lerp(sx,tx,u), y=lerp(sy,ty,u)-Math.sin(u*Math.PI)*h*0.18;
      var ang2=Math.atan2((lerp(sy,ty,u+0.02)-Math.sin((u+0.02)*Math.PI)*h*0.18)-y,lerp(sx,tx,u+0.02)-x);
      drawArrow(ctx,x,y,ang2,30*s+8,1);
    } else if(hitPhase){
      drawArrow(ctx,tx-2,ty+1,0.5,24,1);
      var k=(cyc-0.78)/0.22;
      ctx.strokeStyle='rgba(255,200,90,'+(1-k)+')'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(tx,ty,r*(1+k*1.2),0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1-k; ctx.font='400 '+Math.round(r*0.55)+'px "Jua",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.lineWidth=4; ctx.strokeStyle='#fff'; ctx.strokeText('정중앙!',tx,ty-r-14-k*10); ctx.fillStyle='#e09a00'; ctx.fillText('정중앙!',tx,ty-r-14-k*10);
      ctx.globalAlpha=1;
    }
  },

  result:function(api){
    var acc=S.shots?Math.round(S.hits/S.shots*100):0;
    var line=S.centers>=10?'정중앙을 '+S.centers+'번이나! 루루가 활의 요정이 됐어요.':
      S.centers>=3?'바람을 읽기 시작했어요. 다음엔 정중앙을 더 노려 봐요.':
      S.shots===0?'누른 채 뒤로 끌었다가 놓으면 화살이 날아가요.':'길게 당길수록 멀리, 바람 깃발 방향을 기억하세요.';
    return {stats:[['정중앙',S.centers],['명중률',acc+'%'],['최대 연속',S.maxCombo]],line:line};
  }
});
})();

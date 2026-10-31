/* 냥냥 펀치: 구름 구멍에서 튀어나오는 고양이를 톡 하고 터치하는 45초 반응 게임.
   천둥구름은 건드리면 안 되고, 15콤보면 냥냥 타임(점수 두 배)이 열린다. */
(function(){
'use strict';
var U=Arcade.util, clamp=U.clamp, lerp=U.lerp, easeOutBack=U.easeOutBack;
var W=360, COLS=3, ROWS=4, TIME=45, FEVER=5;
var FONT='"Jua","Quicksand","Hahmlet",sans-serif';
var FURS=['#fff1d6','#ffc9a8','#d9d2ee','#ffffff','#ffd9e1'];
var PENTA=[0,2,4,7,9];

var S=null;

/* ---------- 배치 ---------- */
function layout(H){
  var top=150, bot=H-56, cw=W/COLS, ch=Math.max(60,(bot-top)/ROWS);
  var r=Math.min(cw*0.3,ch*0.34), out=[];
  for(var j=0;j<ROWS;j++) for(var i=0;i<COLS;i++) out.push({x:cw*(i+0.5),y:top+ch*(j+0.5)+ch*0.22,r:r});
  return out;
}
function newHoles(){ var h=[]; for(var k=0;k<COLS*ROWS;k++) h.push({cat:null}); return h; }
function multiplier(){ return Math.min(6,1+Math.floor(S.combo/5))*(S.fever>0?2:1); }
function updateSub(api){ api.setSub(S.combo>=3?'콤보 '+S.combo+(multiplier()>1?' · ×'+multiplier():''):(S.fever>0?'냥냥 타임':'')); }
function noteFreq(api,step){ var i=step%10; return api.sfx.mtof(72+PENTA[i%5]+12*Math.floor(i/5)); }

/* ---------- 고양이 등장 ---------- */
function spawn(api,rng,scoring){
  var free=[];
  for(var k=0;k<S.holes.length;k++) if(!S.holes[k].cat) free.push(k);
  if(!free.length) return;
  var idx=free[Math.floor(rng()*free.length)];
  var prog=scoring?clamp(S.elapsed/TIME,0,1):0.3;
  var life=lerp(1.1,0.55,prog), roll=rng(), type='cat';
  if(S.fever>0){ if(roll<0.12) type='gold'; }
  else if(scoring){
    if(roll<0.06) type='gold';
    else if(roll<0.16&&S.elapsed>8) type='sleepy';
    else if(roll<0.28&&S.elapsed>5) type='thunder';
  }
  if(type==='gold') life*=0.7;
  if(type==='sleepy') life*=1.5;
  if(type==='thunder') life*=1.2;
  if(S.fever>0) life=Math.max(life,0.7);
  S.holes[idx].cat={type:type,fur:FURS[Math.floor(rng()*FURS.length)],t0:S.time,life:life,state:'up',hp:type==='sleepy'?2:1,hitT:0,woke:false,wob:rng()*6.28};
}
function popAmount(c,t){
  var a=t-c.t0;
  if(c.state==='hit') return 1-clamp((t-c.hitT-0.28)/0.14,0,1);
  if(a<0.14) return easeOutBack(a/0.14);
  if(a>c.life-0.14) return clamp((c.life-a)/0.14,0,1);
  return 1;
}

/* ---------- 터치 판정 ---------- */
function tap(api,x,y){
  var L=layout(api.H), fx=api.fx, sfx=api.sfx, best=-1, bd=1e9;
  for(var k=0;k<S.holes.length;k++){
    var c=S.holes[k].cat; if(!c||c.state!=='up') continue;
    var p=popAmount(c,S.time); if(p<0.25) continue;
    var h=L[k], cy=h.y-h.r*0.75*p, d=Math.hypot(x-h.x,y-cy);
    if(d<h.r*1.15&&d<bd){ bd=d; best=k; }
  }
  S.taps++;
  if(best<0){
    S.combo=0; S.timeLeft=Math.max(0,S.timeLeft-0.5);
    sfx.tone(140,0.16,'sine',0.14,{slide:80,wet:false}); api.haptic(8);
    fx.text(x,y-10,'헛손질 −0.5초','#887176',15,0.8,{stroke:'rgba(255,255,255,.9)'});
    fx.ring(x,y,26,'136,113,118',0.4,2,0.4);
    updateSub(api); return;
  }
  var hole=L[best], cat=S.holes[best].cat, cy2=hole.y-hole.r*0.75;
  S.paws.push({x:x,y:y,age:0});
  if(cat.type==='thunder'){
    cat.state='hit'; cat.hitT=S.time;
    S.combo=0; S.timeLeft=Math.max(0,S.timeLeft-3);
    fx.shake(9); fx.flash(0.7,'172,151,254'); fx.hitstop(0.06);
    sfx.noise(0.6,0.35,{freq:500,slide:80,type:'lowpass'}); sfx.tone(70,0.5,'sawtooth',0.08,{slide:40,wet:false});
    fx.text(hole.x,cy2-hole.r,'찌릿! −3초','#634eb0',22,1.1,{stroke:'rgba(255,255,255,.95)'});
    fx.shards(hole.x,cy2,10,'#ffd66b',220,7);
    api.haptic(40); updateSub(api); return;
  }
  if(cat.type==='sleepy'&&cat.hp>1){
    cat.hp--; cat.woke=true; cat.t0=S.time-0.14; cat.life=Math.max(0.6,cat.life*0.6);
    sfx.tone(noteFreq(api,S.combo),0.1,'sine',0.12,{wet:false});
    fx.text(hole.x,cy2-hole.r,'깼다!','#634eb0',17,0.7,{stroke:'rgba(255,255,255,.9)'});
    fx.ring(hole.x,cy2,hole.r*1.6,'172,151,254',0.4,2,0.6);
    api.haptic(6); return;
  }
  // 고양이 펀치 성공
  var react=S.time-cat.t0-0.14;
  cat.state='hit'; cat.hitT=S.time;
  S.combo++; S.boops++; S.reactSum+=Math.max(0,react); S.reactN++;
  if(S.combo>S.maxCombo) S.maxCombo=S.combo;
  var gold=cat.type==='gold';
  var speed=100*clamp(1-Math.max(0,react)/Math.max(0.3,cat.life-0.28),0,1);
  var pts=Math.round(((gold?500:100)+speed)*multiplier());
  api.addScore(pts);
  fx.hitstop(gold?0.05:0.03); fx.shake(gold?5:2.5); fx.pulse(0.5);
  fx.burst(hole.x,cy2,gold?24:12,gold?'255,196,60':'255,126,166',gold?240:160,{size:[6,14],life:0.8,gravity:-40});
  fx.shards(hole.x,cy2,gold?14:7,gold?'#ffd66b':(S.combo%2?'#ac97fe':'#56dbc1'),200,6);
  fx.ring(hole.x,cy2,hole.r*(gold?2.6:1.9),gold?'255,196,60':'255,95,146',0.5,3,0.8);
  var word=gold?'골드냥!':(S.combo>=10?'냥냥냥!':S.combo>=4?'냥냥!':'냥!');
  fx.text(hole.x,cy2-hole.r*1.1,word+' +'+pts,gold?'#e09a00':'#ff5f92',gold?24:19,0.9,{stroke:'rgba(255,255,255,.95)'});
  for(var h2=0;h2<3;h2++) S.hearts.push({x:hole.x+(Math.random()-.5)*hole.r,y:cy2-hole.r*0.4,vx:(Math.random()-.5)*60,vy:-60-Math.random()*60,age:0,s:6+Math.random()*5});
  var f=noteFreq(api,S.combo);
  sfx.tone(f,0.14,'square',0.05,{slide:f*1.5,wet:false});
  sfx.tone(f*2,0.22,'sine',0.08);
  if(gold){ sfx.pluck(91,0.12,0.05); sfx.pluck(96,0.12,0.12); fx.flash(0.4,'255,230,150'); }
  api.haptic(gold?20:10);
  if(S.combo===15&&S.fever<=0) startFever(api);
  updateSub(api);
}
function startFever(api){
  var fx=api.fx;
  S.fever=FEVER; fx.flash(0.6,'255,182,210'); api.haptic(25);
  for(var k=0;k<8;k++) api.sfx.pluck(72+PENTA[k%5]+12*Math.floor(k/5),0.14,k*0.06);
  fx.text(W/2,api.H*0.42,'냥냥 타임 · 점수 두 배','#ff5f92',28,1.6,{rise:16,stroke:'rgba(255,255,255,.95)'});
  for(k=0;k<3;k++) fx.ring(W/2,api.H*0.5,W*0.8,'255,126,166',1.4,3,0.5,k*0.15);
}

/* ---------- 그리기 도구 ---------- */
var dots=null;
function drawSky(ctx,w,h,t,fv,glow){
  var g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#fff6fb'); g.addColorStop(0.55,lerpCol('#f7e9ff','#ffe4ee',fv)); g.addColorStop(1,lerpCol('#e7deff','#ffd9e1',fv));
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  ctx.globalAlpha=0.55;
  ctx.drawImage(glow('255,212,229'),-w*0.3,-h*0.05,w*0.9,w*0.9);
  ctx.drawImage(glow('214,204,255'),w*0.45,h*0.3,w*0.9,w*0.9);
  ctx.drawImage(glow('210,251,240'),-w*0.2,h*0.68,w*0.8,w*0.8);
  ctx.globalAlpha=1;
  ctx.fillStyle='rgba(255,202,224,.55)';
  for(var y=14;y<h;y+=28) for(var x=(y/28|0)%2?14:0;x<w;x+=28){ ctx.beginPath(); ctx.arc(x,y,1.3,0,6.283); ctx.fill(); }
  for(var k=0;k<5;k++){
    var cx=((k*97+t*(8+k*3))%(w+120))-60, cy=40+k*(h*0.17);
    puff(ctx,cx,cy,14+k%3*5,'rgba(255,255,255,.75)');
  }
  if(fv>0.01){
    for(k=0;k<14;k++){
      var sx=(k*53.7)%w, sy=(k*91.3)%h, tw=0.5+0.5*Math.sin(t*5+k*1.7);
      star(ctx,sx,sy,3+tw*4,'rgba(255,214,107,'+(fv*tw)+')');
    }
  }
}
function lerpCol(a,b,k){
  var pa=parseInt(a.slice(1),16), pb=parseInt(b.slice(1),16);
  var r=Math.round(lerp(pa>>16,pb>>16,k)), g=Math.round(lerp(pa>>8&255,pb>>8&255,k)), bl=Math.round(lerp(pa&255,pb&255,k));
  return 'rgb('+r+','+g+','+bl+')';
}
function puff(ctx,x,y,s,col){
  ctx.fillStyle=col; ctx.beginPath();
  ctx.arc(x,y,s,0,6.283); ctx.arc(x+s*0.9,y+s*0.2,s*0.75,0,6.283); ctx.arc(x-s*0.9,y+s*0.25,s*0.7,0,6.283);
  ctx.fill();
}
function star(ctx,x,y,r,col){
  ctx.fillStyle=col; ctx.beginPath();
  for(var i=0;i<10;i++){ var a=-Math.PI/2+i*Math.PI/5, rr=i%2?r*0.45:r; ctx.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr); }
  ctx.closePath(); ctx.fill();
}
function holeBack(ctx,x,y,r){
  ctx.fillStyle='rgba(99,78,176,.18)';
  ctx.beginPath(); ctx.ellipse(x,y,r*1.22,r*0.4,0,0,6.283); ctx.fill();
  ctx.fillStyle='rgba(172,151,254,.32)';
  ctx.beginPath(); ctx.ellipse(x,y-r*0.04,r*1.05,r*0.3,0,0,6.283); ctx.fill();
}
function holeFront(ctx,x,y,r){
  var xs=[-1.12,-0.58,0,0.58,1.12], rs=[0.36,0.44,0.48,0.44,0.36], ys=[0.12,0.26,0.32,0.26,0.12];
  ctx.fillStyle='rgba(99,78,176,.14)'; ctx.beginPath();
  for(var i=0;i<5;i++){ ctx.moveTo(x+xs[i]*r+rs[i]*r,y+ys[i]*r+5); ctx.arc(x+xs[i]*r,y+ys[i]*r+5,rs[i]*r,0,6.283); }
  ctx.fill();
  ctx.fillStyle='#ffffff'; ctx.beginPath();
  for(i=0;i<5;i++){ ctx.moveTo(x+xs[i]*r+rs[i]*r,y+ys[i]*r); ctx.arc(x+xs[i]*r,y+ys[i]*r,rs[i]*r,0,6.283); }
  ctx.fill();
  ctx.fillStyle='rgba(255,217,225,.7)'; ctx.beginPath(); ctx.ellipse(x-r*0.55,y+r*0.16,r*0.16,r*0.06,0,0,6.283); ctx.fill();
}
function drawCat(ctx,x,y,r,c,mood,t){
  var ink='#21172b';
  if(c.type==='thunder'){
    ctx.fillStyle='#b9b0d9';
    ctx.beginPath(); ctx.arc(x,y,r*0.82,0,6.283); ctx.arc(x-r*0.62,y+r*0.18,r*0.55,0,6.283); ctx.arc(x+r*0.62,y+r*0.18,r*0.55,0,6.283); ctx.fill();
    ctx.fillStyle='#9a8fc7'; ctx.beginPath(); ctx.ellipse(x,y+r*0.5,r*1.1,r*0.22,0,0,6.283); ctx.fill();
    ctx.strokeStyle=ink; ctx.lineWidth=2.4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(x-r*0.45,y-r*0.22); ctx.lineTo(x-r*0.15,y-r*0.08); ctx.moveTo(x+r*0.45,y-r*0.22); ctx.lineTo(x+r*0.15,y-r*0.08); ctx.stroke();
    ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(x-r*0.28,y+r*0.06,r*0.07,0,6.283); ctx.arc(x+r*0.28,y+r*0.06,r*0.07,0,6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(x,y+r*0.36,r*0.14,Math.PI*1.15,Math.PI*1.85); ctx.stroke();
    ctx.fillStyle='#ffd66b'; ctx.beginPath();
    var bx=x+r*0.7, by=y-r*0.7+Math.sin(t*9)*2;
    ctx.moveTo(bx,by); ctx.lineTo(bx-r*0.2,by+r*0.32); ctx.lineTo(bx-r*0.04,by+r*0.32); ctx.lineTo(bx-r*0.16,by+r*0.62); ctx.lineTo(bx+r*0.14,by+r*0.22); ctx.lineTo(bx-r*0.02,by+r*0.22); ctx.closePath(); ctx.fill();
    return;
  }
  var fur=c.type==='gold'?'#ffd66b':c.fur;
  // 귀
  ctx.fillStyle=fur; ctx.strokeStyle='rgba(119,17,60,.28)'; ctx.lineWidth=2;
  for(var s=-1;s<=1;s+=2){
    ctx.beginPath(); ctx.moveTo(x+s*r*0.88,y-r*0.2); ctx.lineTo(x+s*r*0.72,y-r*1.12); ctx.lineTo(x+s*r*0.18,y-r*0.78); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#ffb1c5'; ctx.beginPath(); ctx.moveTo(x+s*r*0.72,y-r*0.36); ctx.lineTo(x+s*r*0.66,y-r*0.88); ctx.lineTo(x+s*r*0.36,y-r*0.7); ctx.closePath(); ctx.fill();
    ctx.fillStyle=fur;
  }
  // 얼굴
  ctx.beginPath(); ctx.arc(x,y,r,0,6.283); ctx.fill(); ctx.stroke();
  if(c.type==='gold'){
    ctx.fillStyle='rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(x-r*0.4,y-r*0.5,r*0.22,r*0.12,-0.6,0,6.283); ctx.fill();
    star(ctx,x+r*0.85,y-r*0.95,r*0.22*(0.8+0.3*Math.sin(t*8)),'#fff6c2');
  } else if(c.fur==='#d9d2ee'){
    ctx.fillStyle='rgba(99,78,176,.18)'; ctx.beginPath(); ctx.arc(x,y-r*0.62,r*0.28,Math.PI,0); ctx.fill();
  }
  ctx.strokeStyle=ink; ctx.fillStyle=ink; ctx.lineWidth=2.4; ctx.lineCap='round'; ctx.lineJoin='round';
  var ex=r*0.38, ey=-r*0.04;
  if(mood==='hit'){
    ctx.beginPath();
    ctx.moveTo(x-ex-r*0.12,y+ey-r*0.1); ctx.lineTo(x-ex+r*0.08,y+ey); ctx.lineTo(x-ex-r*0.12,y+ey+r*0.1);
    ctx.moveTo(x+ex+r*0.12,y+ey-r*0.1); ctx.lineTo(x+ex-r*0.08,y+ey); ctx.lineTo(x+ex+r*0.12,y+ey+r*0.1);
    ctx.stroke();
  } else if(mood==='sleep'){
    ctx.beginPath(); ctx.arc(x-ex,y+ey-r*0.03,r*0.11,0.15,Math.PI-0.15); ctx.moveTo(x+ex+r*0.11,y+ey-r*0.03); ctx.arc(x+ex,y+ey-r*0.03,r*0.11,0.15,Math.PI-0.15); ctx.stroke();
    ctx.font=Math.round(r*0.42)+'px '+FONT; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('z',x+r*0.95,y-r*0.95-Math.sin(t*3)*3);
  } else {
    ctx.beginPath(); ctx.arc(x-ex,y+ey,r*0.1,0,6.283); ctx.arc(x+ex,y+ey,r*0.1,0,6.283); ctx.fill();
    ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(x-ex+r*0.035,y+ey-r*0.035,r*0.035,0,6.283); ctx.arc(x+ex+r*0.035,y+ey-r*0.035,r*0.035,0,6.283); ctx.fill();
    if(mood==='woke'){ ctx.fillStyle='#634eb0'; ctx.font=Math.round(r*0.5)+'px '+FONT; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('!',x+r*0.95,y-r*0.9); }
  }
  // 볼터치, 입, 수염
  ctx.fillStyle='rgba(255,126,166,.45)';
  ctx.beginPath(); ctx.ellipse(x-r*0.58,y+r*0.22,r*0.16,r*0.1,0,0,6.283); ctx.ellipse(x+r*0.58,y+r*0.22,r*0.16,r*0.1,0,0,6.283); ctx.fill();
  ctx.fillStyle='#ff7ea6'; ctx.beginPath(); ctx.ellipse(x,y+r*0.1,r*0.07,r*0.05,0,0,6.283); ctx.fill();
  ctx.strokeStyle=ink; ctx.lineWidth=1.8;
  ctx.beginPath();
  if(mood==='hit'){ ctx.ellipse(x,y+r*0.3,r*0.1,r*0.12,0,0,6.283); }
  else { ctx.arc(x-r*0.08,y+r*0.17,r*0.08,0.2,Math.PI-0.2); ctx.moveTo(x+r*0.16,y+r*0.17); ctx.arc(x+r*0.08,y+r*0.17,r*0.08,0.2,Math.PI-0.2); }
  ctx.stroke();
  ctx.strokeStyle='rgba(33,23,43,.45)'; ctx.lineWidth=1.2; ctx.beginPath();
  for(s=-1;s<=1;s+=2){
    ctx.moveTo(x+s*r*0.42,y+r*0.12); ctx.lineTo(x+s*r*1.02,y+r*0.02);
    ctx.moveTo(x+s*r*0.42,y+r*0.2); ctx.lineTo(x+s*r*1.04,y+r*0.24);
  }
  ctx.stroke();
}
function drawPaw(ctx,x,y,s,a){
  ctx.globalAlpha=a; ctx.fillStyle='#ff7ea6';
  ctx.beginPath(); ctx.ellipse(x,y+s*0.25,s*0.55,s*0.45,0,0,6.283); ctx.fill();
  var tx=[-0.55,-0.2,0.2,0.55], ty=[-0.2,-0.55,-0.55,-0.2];
  ctx.beginPath(); for(var i=0;i<4;i++){ ctx.moveTo(x+tx[i]*s+s*0.2,y+ty[i]*s); ctx.ellipse(x+tx[i]*s,y+ty[i]*s,s*0.2,s*0.24,0,0,6.283); } ctx.fill();
  ctx.globalAlpha=1;
}
function drawHeart(ctx,x,y,s,a){
  ctx.globalAlpha=a; ctx.fillStyle='#ff5f92';
  ctx.beginPath(); ctx.moveTo(x,y+s*0.35);
  ctx.bezierCurveTo(x-s*1.1,y-s*0.35,x-s*0.45,y-s*1.05,x,y-s*0.45);
  ctx.bezierCurveTo(x+s*0.45,y-s*1.05,x+s*1.1,y-s*0.35,x,y+s*0.35);
  ctx.fill(); ctx.globalAlpha=1;
}
function drawHoleWithCat(ctx,h,c,t){
  holeBack(ctx,h.x,h.y,h.r);
  if(c){
    var p=popAmount(c,t);
    if(p>0.01){
      var a=t-c.t0, sx=1, sy=1, mood='normal';
      if(c.state==='hit'){ var k=clamp((t-c.hitT)/0.25,0,1); sx=1.2-0.15*k; sy=0.78+0.12*k; mood=c.type==='thunder'?'normal':'hit'; }
      else if(a<0.22){ var q=a/0.22; sx=1-0.14*Math.sin(q*Math.PI); sy=1+0.16*Math.sin(q*Math.PI); }
      if(c.state==='up'&&c.type==='sleepy') mood=c.woke?'woke':'sleep';
      var cy=h.y-h.r*0.75*p+Math.sin(t*4+c.wob)*1.2;
      ctx.save();
      ctx.beginPath(); ctx.rect(h.x-h.r*2,h.y-h.r*3,h.r*4,h.r*3+2); ctx.clip();
      ctx.translate(h.x,cy+h.r); ctx.scale(sx,sy); ctx.translate(-h.x,-(cy+h.r));
      drawCat(ctx,h.x,cy,h.r,c,mood,t);
      ctx.restore();
    }
  }
  holeFront(ctx,h.x,h.y,h.r);
}

Arcade.register({
  id:'whack',
  title:'냥냥 펀치',
  kicker:'반응 · 45초',
  blurb:'구름에서 쏙 나온 고양이를 톡! 천둥구름은 조심',
  lede:'구름 구멍에서 고양이가 쏙 튀어나오면 재빨리 톡 터치하세요. 빨리 누를수록 점수가 커지고, 15콤보면 냥냥 타임이 열려요.',
  how:'고양이를 탭 · 졸린 고양이는 두 번 · 천둥구름은 누르면 −3초 · 빈 구름을 누르면 −0.5초',
  lifeIcon:null,
  endDelay:1300,
  palette:{bg:'#fff6fb',surface:'#ffffff',surface2:'#fbf0ff',line:'#f3d3e2',text:'#21172b',muted:'#887176',
    accent:'#ff5f92',accentInk:'#ffffff',accentDeep:'#a3365d',hot:'#ac97fe',hotText:'#634eb0',hotRgb:'172,151,254',light:true},

  start:function(api){
    S={holes:newHoles(),paws:[],hearts:[],time:0,elapsed:0,timeLeft:TIME,combo:0,maxCombo:0,boops:0,taps:0,
      reactSum:0,reactN:0,fever:0,fv:0,nextSpawn:0.6,attractAt:0,ended:false};
    if(api.state==='play'){ api.setMeter(1,'남은 시간 45.0초',false); updateSub(api); }
  },
  update:function(dt,api){
    var t, k, c;
    S.time+=dt; t=S.time;
    var playing=api.state==='play';
    if(playing&&!S.ended){
      S.elapsed+=dt; S.timeLeft-=dt;
      if(S.fever>0){ S.fever-=dt; if(S.fever<=0){ S.fever=0; updateSub(api); } }
      var prog=clamp(S.elapsed/TIME,0,1);
      var maxUp=S.fever>0?COLS*ROWS:1+Math.floor(prog*3.5);
      var up=0; for(k=0;k<S.holes.length;k++) if(S.holes[k].cat&&S.holes[k].cat.state==='up') up++;
      S.nextSpawn-=dt;
      if(S.nextSpawn<=0){
        if(up<maxUp) spawn(api,api.rng,true);
        S.nextSpawn=S.fever>0?0.16:lerp(0.9,0.38,prog);
      }
      if(S.timeLeft<=0){
        S.timeLeft=0; S.ended=true;
        api.setMeter(0,'시간 종료',true);
        api.sfx.pluck(79,0.14); api.sfx.pluck(76,0.13,0.15); api.sfx.pluck(72,0.15,0.32);
        api.end();
      } else api.setMeter(S.timeLeft/TIME,'남은 시간 '+S.timeLeft.toFixed(1)+'초',S.timeLeft<10);
    } else if(api.state==='menu'||api.state==='over'){
      if(t>S.attractAt){ S.attractAt=t+0.7+Math.random()*0.8; spawn(api,Math.random,false); }
    }
    // 고양이 수명 정리
    for(k=0;k<S.holes.length;k++){
      c=S.holes[k].cat; if(!c) continue;
      if(c.state==='hit'){ if(t-c.hitT>0.45) S.holes[k].cat=null; continue; }
      if(t-c.t0>c.life){
        S.holes[k].cat=null;
        if(playing&&!S.ended&&c.type!=='thunder'){
          S.combo=0; updateSub(api);
          var L=layout(api.H);
          api.fx.text(L[k].x,L[k].y-L[k].r*1.2,'도망!','#887176',14,0.7,{stroke:'rgba(255,255,255,.9)'});
        }
      }
    }
    S.fv+=((S.fever>0?1:0)-S.fv)*Math.min(1,dt*3);
    for(k=S.paws.length-1;k>=0;k--){ S.paws[k].age+=dt; if(S.paws[k].age>0.55) S.paws.splice(k,1); }
    for(k=S.hearts.length-1;k>=0;k--){ var hh=S.hearts[k]; hh.age+=dt; hh.x+=hh.vx*dt; hh.y+=hh.vy*dt; hh.vy+=30*dt; if(hh.age>0.9) S.hearts.splice(k,1); }
    if(S.hearts.length>60) S.hearts.splice(0,S.hearts.length-60);
  },
  draw:function(ctx,api){
    var H=api.H, t=S.time, L=layout(H), k;
    drawSky(ctx,W,H,t,S.fv,api.fx.glow);
    for(k=0;k<L.length;k++) drawHoleWithCat(ctx,L[k],S.holes[k].cat,t);
    for(k=0;k<S.paws.length;k++){
      var p=S.paws[k], q=p.age/0.55;
      drawPaw(ctx,p.x,p.y,14*(q<0.15?easeOutBack(q/0.15):1),1-q*q);
    }
    for(k=0;k<S.hearts.length;k++){ var hh=S.hearts[k]; drawHeart(ctx,hh.x,hh.y,hh.s,1-hh.age/0.9); }
    if(api.state==='play'&&S.timeLeft<10&&S.timeLeft>0){
      var vg=ctx.createRadialGradient(W/2,H/2,H*0.32,W/2,H/2,H*0.78);
      vg.addColorStop(0,'rgba(255,126,166,0)'); vg.addColorStop(1,'rgba(255,95,146,'+(0.12+0.06*Math.sin(t*6))+')');
      ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
    }
  },
  pointer:function(type,x,y,api){ if(type==='down'&&!S.ended) tap(api,x,y); },
  key:function(type,code,api){
    var m=/^(Digit|Numpad)([1-9])$/.exec(code);
    if(!m) return false;
    if(type==='down'&&!S.ended){
      // 숫자 1–9는 위 세 줄 구멍에 대응
      var idx=Number(m[2])-1, L=layout(api.H), h=L[idx];
      if(h) tap(api,h.x,h.y-h.r*0.75);
    }
    return true;
  },
  preview:function(ctx,w,h,t){
    var glow=Arcade.fx.glow;
    drawSky(ctx,w,h,t,0.4+0.4*Math.sin(t*0.6),glow);
    var r=Math.min(w/3*0.28,h*0.17), spots=[0.2,0.5,0.8];
    for(var k=0;k<3;k++){
      var hx=w*spots[k], hy=h*0.66+(k===1?-h*0.12:0);
      var cyc=(t*0.5+k*0.33)%1;
      var fake={type:k===1&&Math.floor(t*0.5)%3===0?'gold':'cat',fur:FURS[k],t0:0,life:1,state:'up',wob:k};
      var p, mood='normal', sx=1, sy=1;
      if(cyc<0.15) p=easeOutBack(cyc/0.15);
      else if(cyc<0.62) p=1;
      else if(cyc<0.75){ p=1; mood='hit'; sx=1.18; sy=0.82; }
      else p=clamp(1-(cyc-0.75)/0.1,0,1);
      holeBack(ctx,hx,hy,r);
      if(p>0.01){
        var cy=hy-r*0.75*p;
        ctx.save(); ctx.beginPath(); ctx.rect(hx-r*2,hy-r*3,r*4,r*3+2); ctx.clip();
        ctx.translate(hx,cy+r); ctx.scale(sx,sy); ctx.translate(-hx,-(cy+r));
        drawCat(ctx,hx,cy,r,fake,mood,t); ctx.restore();
      }
      holeFront(ctx,hx,hy,r);
      if(cyc>=0.6&&cyc<0.78){
        var pq=(cyc-0.6)/0.18;
        drawPaw(ctx,hx+r*0.3,hy-r*0.9,r*0.42*(pq<0.2?easeOutBack(pq/0.2):1),1-pq);
        drawHeart(ctx,hx-r*0.5,hy-r*1.6-pq*r,r*0.2,1-pq);
        drawHeart(ctx,hx+r*0.7,hy-r*1.8-pq*r*1.2,r*0.16,1-pq);
      }
    }
  },
  result:function(api){
    var avg=S.reactN?(S.reactSum/S.reactN):0;
    var line=S.boops>=40?'손이 고양이보다 빨라요. 오늘의 냥 펀치 장인!':S.boops>=15?'고양이들이 꽤 놀랐어요. 한 판 더 하면 콤보가 이어질 거예요.':'고양이들이 아직 장난치고 있어요. 천천히 리듬을 찾아봐요.';
    return {stats:[['냥 펀치',S.boops],['최대 콤보',S.maxCombo],['평균 반응',S.reactN?avg.toFixed(2)+'초':'-']],line:line};
  }
});
})();

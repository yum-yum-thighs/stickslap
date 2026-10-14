/* Standalone Canvas presentation. Music starts on a user gesture; the beat map also works while muted. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d'),arenaElement=$('arena');
  const colors={player:'#5ef2c3',chaser:'#ff668f',runner:'#c096ff',bruiser:'#ff956a',bomb:'#ffcd62',health:'#5ef2c3'};
  const read=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
  const save=(key,value)=>{try{localStorage.setItem(key,String(value));}catch{/* Private browsing may disallow persistence. */}};
  let width=1,height=1,scale=1,visualTime=0,pulse=0,shake=0,state='ready',best=Number(read('stickslap.web.best',0))||0;
  let notice='TAP TWO TARGETS, THEN COMPRESS',noticeTime=0,learned=false,accumulator=0,lastTime=0,lastMusicFrame=-1,musicEnergy=0;
  let practiceFired=false,resumeState='playing';
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let calm=read('stickslap.web.calm',reducedMotion?'1':'0')==='1';
  const active=()=>state==='playing'||state==='practice';
  const particles=[],rings=[],glows=new Map(),map=globalThis.STICKSLAP_MUSIC_MAP;
  const music=$('music');music.volume=.35;
  let muted=false,audioContext,effectGain;music.muted=muted;
  const model=new SlapSimulation({left:-4,right:4,bottom:-4,top:4});model.feedback=feedback;
  function resize(){
    const box=arenaElement.getBoundingClientRect();width=box.width;height=box.height;const dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    scale=height/8;const halfWidth=width/(2*scale);model.setArena({left:-halfWidth,right:halfWidth,bottom:-4,top:4});
    if(state==='ready')model.reset(model.arena);
  }
  new ResizeObserver(resize).observe(arenaElement);resize();
  const point=(x,y)=>({x:width/2+x*scale,y:height/2-y*scale});
  function audioUnlock(){
    try{if(!audioContext){audioContext=new (window.AudioContext||window.webkitAudioContext)();effectGain=audioContext.createGain();effectGain.gain.value=muted?0:1;effectGain.connect(audioContext.destination);}audioContext.resume().catch(()=>{});}catch{/* Game remains playable if audio is unavailable. */}
    music.play().catch(()=>message('MUSIC UNAVAILABLE — YOU CAN STILL SLAP',3));
  }
  function tone(type){
    if(muted||!audioContext||audioContext.state!=='running')return;
    const settings={grab:[480,820,.09],release:[430,290,.06],compress:[190,60,.22],kill:[240,100,.11],explosion:[95,30,.36],hurt:[130,65,.2],wave:[460,920,.24],full:[180,150,.07],heal:[580,1100,.35],ability:[720,160,.45]};
    const [start,end,duration]=settings[type]||settings.grab,time=audioContext.currentTime;
    const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type=type==='explosion'?'sawtooth':'sine';
    oscillator.frequency.setValueAtTime(start,time);oscillator.frequency.exponentialRampToValueAtTime(end,time+duration);
    gain.gain.setValueAtTime(.001,time);gain.gain.linearRampToValueAtTime(type==='compress'?.15:.08,time+.008);gain.gain.exponentialRampToValueAtTime(.001,time+duration);
    oscillator.connect(gain);gain.connect(effectGain);oscillator.start(time);oscillator.stop(time+duration);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
  function message(text,duration=2){notice=text;noticeTime=duration;}
  function ripple(e,color,radius,duration){if(rings.length>=24)rings.shift();rings.push({x:e.x,y:e.y,color,radius,life:duration,duration});}
  function sparks(e,color,count){for(let i=0;i<count&&particles.length<100;i++){const angle=Math.random()*Math.PI*2,speed=1.4+Math.random()*3.4,duration=.25+Math.random()*.25;particles.push({x:e.x,y:e.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,color,life:duration,duration,size:.055+Math.random()*.065});}}
  function feedback(e){
    tone(e.type);
    switch(e.type){
      case 'grab':ripple(e,colors.player,.65,.25);break;
      case 'compress':learned=true;ripple(e,colors.player,1.5,.32);sparks(e,colors.player,8);shake=.035;break;
      case 'kill':ripple(e,colors.chaser,.8,.3);sparks(e,colors.chaser,7);if(e.value>=2)message(`${e.value} SLAP COMBO!`,1.8);break;
      case 'explosion':ripple(e,colors.bomb,2.05,.48);sparks(e,colors.bomb,14);shake=.08;message('CHAIN REACTION!',1.6);break;
      case 'hurt':ripple(e,'#eff8ff',.8,.3);shake=.06;message('CRUSH TO DASH OUT OF DANGER');break;
      case 'heal':ripple(e,colors.player,1.2,.5);sparks(e,colors.player,12);message('+2 HP — BACK IN THE FIGHT');break;
      case 'ability':ripple(e,e.value===2?'#73baff':colors.bomb,e.value===0?3.2:1.2,.55);if(e.value===0)shake=.1;message(['SHOCKWAVE!','PROTECTION — 5 SECONDS','SLOW MODE — 6 SECONDS'][e.value]);break;
      case 'wave':message(`WAVE ${e.value}${e.value===2?' — RUNNERS INCOMING':e.value===3?' — BRUISERS INCOMING':''}`,3);break;
      case 'full':message('ALL FIVE TENTACLES ARE BUSY',1.5);break;
    }
  }
  function start(){model.reset(model.arena);particles.length=rings.length=0;visualTime=pulse=shake=accumulator=0;learned=false;noticeTime=0;state='playing';$('overlay').hidden=true;audioUnlock();canvas.focus({preventScroll:true});updateHud();}
  function practice(){start();state='practice';practiceFired=false;model.spawnTimer=model.bombTimer=Infinity;model.invulnerability=999;message('PRACTICE 1 / 2 — TAP THE TWO PINK TARGETS',999);updateHud();}
  function pause(){if(active()){resumeState=state;state='paused';music.pause();showMenu('TAKE A<br><em>BREATHER</em>',`${model.score} SLAPS / WAVE ${model.wave}`,'Your tentacles are right where you left them.<br>Ready for another crush?','KEEP SLAPPING','ESC / P TO RESUME');}else if(state==='paused'){state=resumeState;$('overlay').hidden=true;accumulator=0;audioUnlock();canvas.focus({preventScroll:true});}updateHud();}
  function showMenu(title,tagline,copy,button,note){$('menu-title').innerHTML=title;$('menu-tagline').textContent=tagline;$('menu-copy').innerHTML=copy;$('play').textContent=button;$('menu-note').textContent=note;$('practice').hidden=true;$('overlay').hidden=false;$('play').focus({preventScroll:true});}
  function finish(){state='finished';const record=model.score>best;if(record){best=model.score;save('stickslap.web.best',best);}showMenu('NICE<br><em>SLAPPING</em>',`${model.score} SLAPS${record?' / NEW BEST':` / BEST ${best}`}`,`Survived ${Math.floor(model.elapsed)} seconds. Reached wave ${model.wave}.<br>Try grabbing a bomb into your next crush.`,'ONE MORE RUN','SPACE / R TO REPLAY');}
  function compress(){if(active()){const fired=model.compress();if(state==='practice'&&fired)practiceFired=true;}}
  function ability(which){if(state==='playing'&&!model.ability(which))message('CHAIN KILLS TO CHARGE YOUR ABILITIES',1.5);}
  $('play').addEventListener('click',()=>state==='paused'?pause():start());$('pause').addEventListener('click',pause);$('compress').addEventListener('click',compress);
  $('practice').addEventListener('click',practice);
  $('calm').addEventListener('click',()=>{calm=!calm;save('stickslap.web.calm',calm?'1':'0');shake=0;updateHud();});
  for(let i=0;i<3;i++)$(`ability-${i}`).addEventListener('click',()=>ability(i));
  $('sound').addEventListener('click',()=>{muted=!muted;music.muted=muted;if(effectGain)effectGain.gain.value=muted?0:1;if(!muted&&active())audioUnlock();updateHud();});
  canvas.addEventListener('pointerdown',e=>{if(!active())return;e.preventDefault();const b=canvas.getBoundingClientRect();model.toggleAt((e.clientX-b.left-width/2)/scale,(height/2-e.clientY+b.top)/scale);if(state==='practice'&&!practiceFired)message(model.canCompress?'PRACTICE 2 / 2 — PRESS COMPRESS. DASH TO THE CYAN MARKER.':'PRACTICE 1 / 2 — TAP THE TWO PINK TARGETS',999);canvas.focus({preventScroll:true});updateHud();});
  document.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key.toLowerCase();if(k==='escape'||k==='p'){e.preventDefault();pause();}else if(e.code==='Space'||k==='c'){if(e.target instanceof HTMLButtonElement&&e.code==='Space')return;e.preventDefault();if(active())compress();else if(state==='paused')pause();else start();}else if(k==='r'&&state==='finished')start();else if(['1','2','3'].includes(k)){e.preventDefault();ability(Number(k)-1);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&active())pause();});
  window.addEventListener('blur',()=>{if(active())pause();});
  function text(id,value){if($(id).textContent!==String(value))$(id).textContent=value;}
  function updateHud(){
    text('score',model.score);text('best',`BEST ${best}`);text('combo',model.comboCount?`COMBO ×${model.comboCount}`:'CHAIN KILLS');$('combo-fill').style.transform=`scaleX(${model.comboRemaining/3})`;
    text('wave',state==='practice'?'SAFE PRACTICE':`WAVE ${String(model.wave).padStart(2,'0')} · ${Math.floor(model.elapsed)}s`);
    if($('hearts').dataset.hp!==String(model.hearts)){$('hearts').dataset.hp=model.hearts;$('hearts').innerHTML=Array.from({length:5},(_,i)=>`<i class="${i<model.hearts?'alive':''}"></i>`).join('');$('hearts').setAttribute('aria-label',`${model.hearts} health points`);}
    text('charge-label',model.abilityReady?'ABILITY READY — CHOOSE 1, 2 OR 3':'ABILITY CHARGE');text('charge-value',`${Math.floor(model.charge)}%`);$('charge-fill').style.transform=`scaleX(${model.charge/100})`;$('charge-meter').setAttribute('aria-valuenow',Math.floor(model.charge));
    for(let i=0;i<3;i++){const b=$(`ability-${i}`),remaining=i===1?model.protection:i===2?model.slow:0;b.disabled=state!=='playing'||!model.abilityReady||remaining>0;b.classList.toggle('active',remaining>0);const label=remaining>0?`${i===1?'SHIELD':'SLOW'} ${Math.ceil(remaining)}s`:['SHOCKWAVE','PROTECTION','SLOW MODE'][i];b.querySelector('span').textContent=label;}
    text('slots',`${model.selected.length} / 5 GRABBED`);Array.from($('tentacle-dots').children).forEach((d,i)=>d.classList.toggle('selected',i<model.selected.length));
    $('compress').disabled=!active()||!model.canCompress;text('compress',model.canCompress?'COMPRESS!':`GRAB ${Math.max(0,2-model.selected.length)} MORE`);
    text('sound',muted?'SOUND OFF':'SOUND ON');$('sound').setAttribute('aria-pressed',String(muted));$('sound').setAttribute('aria-label',muted?'Unmute sound':'Mute sound');$('pause').disabled=!active()&&state!=='paused';text('pause',state==='paused'?'▶':'Ⅱ');$('pause').setAttribute('aria-label',state==='paused'?'Resume game':'Pause game');
    $('sound').title=muted?'Unmute music and effects':music.paused?'Sound enabled — music starts when you play':'Playing Trails of Light';
    text('calm',calm?'CALM ON':'CALM OFF');$('calm').setAttribute('aria-pressed',String(calm));
    text('notice',noticeTime>0?notice:model.canCompress?'CYAN MARKER = YOUR DASH DESTINATION':learned?'GRAB BOMBS FOR CHAIN REACTIONS':'TAP TWO TARGETS, THEN COMPRESS');
  }
  function glow(color){if(glows.has(color))return glows.get(color);const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d'),gradient=g.createRadialGradient(48,48,0,48,48,48);gradient.addColorStop(0,color+'66');gradient.addColorStop(.5,color+'1a');gradient.addColorStop(1,color+'00');g.fillStyle=gradient;g.fillRect(0,0,96,96);glows.set(color,c);return c;}
  function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,Math.PI*2);ctx.fill();}
  function ring(x,y,r,color,line=.035){ctx.strokeStyle=color;ctx.lineWidth=line*scale;ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,Math.PI*2);ctx.stroke();}
  function draw(){
    ctx.clearRect(0,0,width,height);ctx.save();if(active()&&!calm)ctx.translate(Math.sin(visualTime*93)*shake*scale,Math.cos(visualTime*79)*shake*scale);
    const p=model.player,origin=point(p.x,p.y),vibration=calm?0:musicEnergy*.08+pulse*.15;
    for(let i=0;i<5;i++){
      const grabbed=i<model.selected.length;let end;if(grabbed)end=model.selected[i];else{let angle=i*Math.PI*2/5+visualTime*.25;angle+=Math.sin(visualTime*30+i*1.7)*vibration;const length=.65+Math.sin(visualTime*3+i)*.08+pulse*.18;end={x:p.x+Math.cos(angle)*length,y:p.y+Math.sin(angle)*length};}
      const dx=end.x-p.x,dy=end.y-p.y,d=Math.hypot(dx,dy),nx=d?-dy/d:0,ny=d?dx/d:0;
      ctx.beginPath();for(let j=0;j<22;j++){const t=j/21,sway=Math.sin(visualTime*5+i)*Math.min(.35,d*.15),wiggle=Math.sin(visualTime*36-t*14+i)*vibration,offset=Math.sin(t*Math.PI)*(sway+wiggle),q=point(p.x+dx*t+nx*offset,p.y+dy*t+ny*offset);if(j===0)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);}
      ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#5ef2c32b';ctx.lineWidth=.16*scale;ctx.stroke();ctx.strokeStyle=grabbed?'#5ef2c3':'#5ef2c380';ctx.lineWidth=(grabbed?.065:.045)*scale*(1+pulse*.65);ctx.stroke();
    }
    for(const b of model.bodies){if(b.dead)continue;const q=point(b.x,b.y),color=colors[b.kind],r=b.radius*scale,pulsing=b.selected||b.kind==='health'?1+Math.sin(visualTime*8+b.id)*.06:1;ctx.save();ctx.translate(q.x,q.y);ctx.scale(pulsing,pulsing);ctx.drawImage(glow(color),-r*2.8,-r*2.8,r*5.6,r*5.6);circle(.03*scale,.08*scale,r*1.07,'#00000055');
      if(b===p&&model.invulnerability>0&&state==='playing')ctx.globalAlpha=Math.sin(visualTime*34)>0?1:.42;circle(0,0,r,color);ctx.globalAlpha=1;
      if(b.kind==='health'){ctx.fillStyle='#eff8ff';ctx.fillRect(-.16*scale,-.05*scale,.32*scale,.1*scale);ctx.fillRect(-.05*scale,-.16*scale,.1*scale,.32*scale);}
      else if(b.kind==='bomb'){circle(0,0,.1*scale,'#09241d');ctx.strokeStyle=color;ctx.lineWidth=.045*scale;ctx.beginPath();ctx.moveTo(0,-r*.7);ctx.lineTo(.05*scale,-r-.13*scale);ctx.lineTo(.14*scale,-r-.17*scale);ctx.stroke();}
      else{for(let eye=0;eye<2;eye++){const x=(eye===0?-1:1)*r*.31;if(b===p)circle(x,-r*.13,r*.2,'#eff8ff');else{ctx.fillStyle='#eff8ff';ctx.fillRect(x-r*.2,-r*.33,r*.4,r*.4);}circle(x+.015*scale,-r*.1,r*.08,'#09241d');}if(b.kind==='bruiser'){ctx.fillStyle='#09241d';ctx.fillRect(-.12*scale,.11*scale,.24*scale,.04*scale);}}
      if(b.selected)ring(0,0,r+.13*scale,'#5ef2c3');if(b===p&&model.protection>0)ring(0,0,r+.2*scale,'#ffcd62');ctx.restore();
    }
    const destination=active()?model.compressionCenter():null;
    if(destination){const q=point(destination.x,destination.y),size=(1.3+(calm?0:pulse*.15))*scale;ctx.save();ctx.strokeStyle='#90deff66';ctx.lineWidth=1;ctx.setLineDash([4,6]);ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.restore();ctx.drawImage(glow('#90deff'),q.x-size/2,q.y-size/2,size,size);ring(q.x,q.y,(.34+(calm?0:Math.sin(visualTime*5)*.025))*scale,'#90deff');ctx.fillStyle='#90deff';ctx.fillRect(q.x-.12*scale,q.y-.0175*scale,.24*scale,.035*scale);ctx.fillRect(q.x-.0175*scale,q.y-.12*scale,.035*scale,.24*scale);ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText('DASH HERE',q.x,Math.max(14,q.y-.55*scale));ctx.textAlign='left';}
    for(const r of rings){const q=point(r.x,r.y),fade=r.life/r.duration;ctx.globalAlpha=fade;ring(q.x,q.y,(.12+(r.radius-.12)*(1-fade))*scale,r.color,.065);}for(const s of particles){const q=point(s.x,s.y),fade=s.life/s.duration;ctx.globalAlpha=fade;circle(q.x,q.y,s.size*scale*fade,s.color);}ctx.globalAlpha=1;ctx.restore();
  }
  function frame(timestamp){
    const dt=Math.min(.06,lastTime?(timestamp-lastTime)/1000:0);lastTime=timestamp;
    let beat=false,level=0;if(map&&!music.paused){const index=Math.floor(music.currentTime/map.step)%map.levels.length;level=map.levels[index]||0;beat=index!==lastMusicFrame&&!!map.beats[index];lastMusicFrame=index;}musicEnergy+=(level-musicEnergy)*(1-Math.exp(-dt*14));
    if(active()){
      model.music(musicEnergy,beat);pulse=beat?1:Math.max(0,pulse-dt*4);visualTime+=dt;noticeTime=Math.max(0,noticeTime-dt);shake=Math.max(0,shake-dt*2.5);accumulator+=dt;
      while(accumulator>=1/240&&!model.gameOver){if(state!=='practice'||practiceFired)model.tick(1/240);accumulator-=1/240;}if(model.gameOver)finish();
      if(state==='practice'&&model.score>=2){state='practice-complete';showMenu('YOU GOT<br><em>THE HANG</em>','TARGETS ARE ALSO YOUR ESCAPE ROUTE.','Pick targets. Check the cyan marker. Compress.<br>In a real run, bombs make chain reactions and kills charge your abilities.','START A RUN','A SHORT RUN IS ALL YOU NEED TO EXPERIMENT.');}
      for(let i=particles.length-1;i>=0;i--){const s=particles[i];s.life-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;const friction=Math.pow(.92,dt*60);s.vx*=friction;s.vy*=friction;if(s.life<=0)particles.splice(i,1);}for(let i=rings.length-1;i>=0;i--){rings[i].life-=dt;if(rings[i].life<=0)rings.splice(i,1);}
    }
    updateHud();draw();requestAnimationFrame(frame);
  }
  updateHud();requestAnimationFrame(frame);
})();

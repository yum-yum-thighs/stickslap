/* Browser port of the Unity rules. No movement input: your compression chooses your escape. */
(function (root) {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  class SlapSimulation {
    constructor(arena,seed=Date.now()){this.feedback=()=>{};this.reset(arena,seed);}
    reset(arena,seed=Date.now()){
      this.seed=seed>>>0;this.arena={...arena};this.bodies=[];this.selected=[];this.nextId=0;
      this.score=0;this.hearts=5;this.wave=1;this.elapsed=0;this.invulnerability=1.2;
      this.spawnTimer=1.5;this.bombTimer=5;this.spawnCooldown=0;this.comboCount=0;this.comboRemaining=0;
      this.charge=0;this.protection=0;this.slow=0;this.musicEnergy=0;this.dashing=false;this.dashTarget={x:0,y:0};
      const center={x:(arena.left+arena.right)/2,y:(arena.bottom+arena.top)/2};
      this.player=this.spawn('player',center.x,center.y);
      this.spawn('chaser',center.x-1.55,center.y+1.55);this.spawn('chaser',center.x+1.55,center.y+1.55);
    }
    random(){this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0;return this.seed/4294967296;}
    get gameOver(){return this.hearts<=0;}
    get canCompress(){return !!this.compressionCenter();}
    get abilityReady(){return !this.gameOver&&this.charge>=100;}
    cue(type,body,value=0){this.feedback({type,x:body.x,y:body.y,value});}
    spawn(kind,x,y){
      const b={id:++this.nextId,kind,x,y,vx:0,vy:0,radius:kind==='player'||kind==='bruiser'?.34:.25,
        mass:kind==='player'?1000000:kind==='bruiser'||kind==='bomb'?2:1,health:kind==='bruiser'?4:2,crush:0,dead:false,selected:false};
      this.clamp(b);this.bodies.push(b);return b;
    }
    setArena(arena){this.arena={...arena};for(const b of this.bodies)this.clamp(b);this.dashTarget.x=clamp(this.dashTarget.x,arena.left+this.player.radius,arena.right-this.player.radius);this.dashTarget.y=clamp(this.dashTarget.y,arena.bottom+this.player.radius,arena.top-this.player.radius);}
    toggleAt(x,y){let closest=null,best=.62;for(const b of this.bodies){if(b===this.player||b.dead)continue;const d=Math.hypot(x-b.x,y-b.y)-b.radius;if(d<best){best=d;closest=b;}}return closest?this.toggle(closest):false;}
    toggle(b){
      if(this.gameOver||!b||b.dead||b===this.player||!this.bodies.includes(b))return false;
      if(b.selected){b.selected=false;this.selected=this.selected.filter(t=>t!==b);this.cue('release',b);return true;}
      if(this.selected.length>=5){this.cue('full',b);return false;}
      b.selected=true;this.selected.push(b);this.cue('grab',b);return true;
    }
    compressionCenter(){
      if(this.gameOver)return null;let x=0,y=0,mass=0,count=0;
      for(const b of this.selected){if(b.dead||!b.selected)continue;x+=b.x*b.mass;y+=b.y*b.mass;mass+=b.mass;count++;}
      return count>=2&&mass>0?{x:x/mass,y:y/mass}:null;
    }
    compress(){
      const center=this.compressionCenter();if(!center)return false;
      this.dashTarget={...center};this.dashing=true;this.invulnerability=Math.max(this.invulnerability,.8);
      for(const b of this.selected){if(b.dead||!b.selected)continue;const dx=center.x-b.x,dy=center.y-b.y,d=Math.hypot(dx,dy);const speed=clamp(d*8,9,21);b.vx=d?dx/d*speed:0;b.vy=d?dy/d*speed:0;b.crush=.7;b.selected=false;}
      this.cue('compress',center,this.selected.length);this.selected=[];return true;
    }
    music(energy,beat){this.musicEnergy=clamp(energy,0,1);if(beat&&this.spawnCooldown<=0)this.spawnTimer=Math.min(this.spawnTimer,.025);}
    ability(which){
      if(!this.abilityReady||!Number.isInteger(which)||which<0||which>2||(which===1&&this.protection>0)||(which===2&&this.slow>0))return false;
      this.charge-=100;this.cue('ability',this.player,which);
      if(which===1)this.protection=5;else if(which===2)this.slow=6;
      else for(const b of this.bodies){const dx=b.x-this.player.x,dy=b.y-this.player.y,d=Math.hypot(dx,dy);if(b===this.player||b.dead||b.kind==='health'||d>3.2)continue;b.vx+=(d?dx/d:1)*11;b.vy+=(d?dy/d:0)*11;if(b.kind==='bomb')this.explode(b);else this.damage(b,3);}
      return true;
    }
    tick(dt){
      if(this.gameOver||dt<=0)return;this.elapsed+=dt;
      for(const key of ['invulnerability','comboRemaining','protection','slow','spawnCooldown'])this[key]=Math.max(0,this[key]-dt);
      if(!this.comboRemaining)this.comboCount=0;
      const wave=1+Math.floor(this.elapsed/20);if(wave!==this.wave){this.wave=wave;this.cue('wave',this.player,wave);}
      this.spawnTimer-=dt*(.65+1.45*this.musicEnergy);this.bombTimer-=dt;
      if(this.spawnTimer<=0&&this.spawnCooldown<=0){
        if(this.enemyCount()<24){const pick=this.random(),p=this.edgePosition();this.spawn(this.wave>=3&&pick<.2?'bruiser':this.wave>=2&&pick<.4?'runner':'chaser',p.x,p.y);}
        this.spawnTimer=Math.max(.38,1.25-this.elapsed*.008);this.spawnCooldown=.4;
      }
      if(this.bombTimer<=0){if(this.bodies.filter(b=>b.kind==='bomb'&&!b.dead).length<3){const p=this.bombPosition();this.spawn('bomb',p.x,p.y);}this.bombTimer=5;}
      this.player.vx=this.player.vy=0;
      if(this.dashing){const dx=this.dashTarget.x-this.player.x,dy=this.dashTarget.y-this.player.y;this.player.vx=dx*18;this.player.vy=dy*18;if(dx*dx+dy*dy<.0025){this.dashing=false;this.player.vx=this.player.vy=0;}}
      for(const b of this.bodies){
        if(b.dead)continue;b.crush=Math.max(0,b.crush-dt);const step=this.slow>0&&b!==this.player&&b.kind!=='health'&&b.crush<=0?dt*.35:dt;
        if(b!==this.player&&b.kind!=='bomb'&&b.kind!=='health'&&!b.selected){const dx=this.player.x-b.x,dy=this.player.y-b.y,d=Math.hypot(dx,dy),speed=b.kind==='runner'?3.7:b.kind==='bruiser'?1.7:2.5;if(d){b.vx+=dx/d*speed*step;b.vy+=dy/d*speed*step;}}
        if(b.selected){const drag=Math.pow(.76,dt*60);b.vx*=drag;b.vy*=drag;}
        b.x+=b.vx*step;b.y+=b.vy*step;
        if(b!==this.player){const drag=Math.pow(b.kind==='bomb'?.96:.97,step*60);b.vx*=drag;b.vy*=drag;}this.clamp(b);
      }
      for(let i=0;i<this.bodies.length;i++){const a=this.bodies[i];if(a.dead||a.kind==='health')continue;for(let j=i+1;j<this.bodies.length;j++){if(a.dead)break;const b=this.bodies[j];if(b.dead||b.kind==='health')continue;const impact=this.collide(a,b);if(impact>.5)this.impact(a,b,impact);}}
      for(const b of this.bodies)if(b.kind==='health'&&!b.dead&&this.hearts===1&&distance(b,this.player)<=b.radius+this.player.radius+.12){b.dead=true;b.selected=false;this.hearts=Math.min(5,this.hearts+2);this.cue('heal',this.player,this.hearts);}
      if(this.invulnerability<=0&&this.protection<=0)for(const b of this.bodies){if(b===this.player||b.kind==='bomb'||b.kind==='health'||b.dead||b.selected||b.crush>0)continue;if(distance(b,this.player)<=b.radius+this.player.radius+.07){this.hearts--;this.invulnerability=1.2;this.cue('hurt',this.player,this.hearts);break;}}
      this.updateHealthPack();this.selected=this.selected.filter(b=>!b.dead);this.bodies=this.bodies.filter(b=>!b.dead);
    }
    explode(bomb){if(!bomb||bomb.kind!=='bomb'||bomb.dead)return;bomb.dead=true;bomb.selected=false;this.cue('explosion',bomb);for(const b of this.bodies){if(b.dead||b===this.player||b.kind==='health'||distance(b,bomb)>2.05)continue;if(b.kind==='bomb')this.explode(b);else this.damage(b,10);}}
    damage(b,damage){if(b.dead||b===this.player||b.kind==='bomb'||b.kind==='health')return;b.health-=damage;if(b.health>0)return;b.dead=true;b.selected=false;this.score++;this.comboCount=this.comboRemaining>0?this.comboCount+1:1;this.comboRemaining=3;this.charge=Math.min(100,this.charge+8+Math.min(this.comboCount,8)*3);this.cue('kill',b,this.comboCount);}
    updateHealthPack(){let exists=false;for(const b of this.bodies)if(b.kind==='health'&&!b.dead){if(this.hearts!==1)b.dead=true;else exists=true;}if(this.hearts===1&&!exists)this.spawn('health',this.player.x+1.15,this.player.y+.6);}
    impact(a,b,speed){const bomb=a.kind==='bomb'?a:b.kind==='bomb'?b:null;if(bomb){if(speed>3.4)this.explode(bomb);return;}if(a===this.player||b===this.player){if(speed>5)this.damage(a===this.player?b:a,speed/4.5);}else if(speed>6||((a.crush>0||b.crush>0)&&speed>2)){const damage=a.crush>0||b.crush>0?2:speed/6;this.damage(a,damage);this.damage(b,damage);}}
    collide(a,b){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),r=a.radius+b.radius;if(d>=r)return 0;const nx=d>.0001?dx/d:1,ny=d>.0001?dy/d:0,speed=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny,overlap=r-d,mass=a.mass+b.mass;a.x-=nx*overlap*b.mass/mass;a.y-=ny*overlap*b.mass/mass;b.x+=nx*overlap*a.mass/mass;b.y+=ny*overlap*a.mass/mass;if(speed>0){const impulse=1.6*speed/(1/a.mass+1/b.mass);a.vx-=impulse*nx/a.mass;a.vy-=impulse*ny/a.mass;b.vx+=impulse*nx/b.mass;b.vy+=impulse*ny/b.mass;}return Math.max(0,speed);}
    clamp(b){const a=this.arena,r=b.radius;if(b.x<a.left+r){b.x=a.left+r;b.vx=Math.abs(b.vx)*.8;}if(b.x>a.right-r){b.x=a.right-r;b.vx=-Math.abs(b.vx)*.8;}if(b.y<a.bottom+r){b.y=a.bottom+r;b.vy=Math.abs(b.vy)*.8;}if(b.y>a.top-r){b.y=a.top-r;b.vy=-Math.abs(b.vy)*.8;}}
    enemyCount(){return this.bodies.filter(b=>b!==this.player&&b.kind!=='bomb'&&b.kind!=='health'&&!b.dead).length;}
    edgePosition(){const a=this.arena;for(let i=0;i<12;i++){let x=a.left+.45+this.random()*(a.right-a.left-.9),y=a.bottom+.45+this.random()*(a.top-a.bottom-.9);switch(Math.floor(this.random()*4)){case 0:x=a.left+.45;break;case 1:x=a.right-.45;break;case 2:y=a.bottom+.45;break;default:y=a.top-.45;}const p={x,y};if(distance(p,this.player)>1.4)return p;}const lo={x:a.left+.45,y:a.bottom+.45},hi={x:a.right-.45,y:a.top-.45};return distance(lo,this.player)>distance(hi,this.player)?lo:hi;}
    bombPosition(){const a=this.arena;let p={x:0,y:0};for(let i=0;i<20;i++){p={x:a.left+.6+this.random()*(a.right-a.left-1.2),y:a.bottom+.6+this.random()*(a.top-a.bottom-1.2)};if(distance(p,this.player)>1.8)break;}return p;}
  }
  root.SlapSimulation=SlapSimulation;
})(globalThis);

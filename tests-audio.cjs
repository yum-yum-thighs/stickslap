const assert=require('node:assert/strict');require('./soundtrack.js');
const S=globalThis.SlapSoundtrack;let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;};
const element=()=>({src:'song.mp3',dataset:{},paused:true,currentTime:0,play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;}});
function context(){return {currentTime:0,destination:{},sources:[],decodes:0,
 resume(){return Promise.resolve();},decodeAudioData(){this.decodes++;return Promise.resolve({duration:162.35});},
 createGain(){return {gain:{value:.35,setTargetAtTime(value){this.value=value;}},connect(){}};},
 createBufferSource(){const s={connect(){},disconnect(){},start(when,offset){this.offset=offset;this.started=true;},stop(){this.stopped=true;}};this.sources.push(s);return s;}
};}
const response=()=>({ok:true,arrayBuffer:()=>Promise.resolve(new ArrayBuffer(10))});
async function main(){
 let fetches=0;const ctx=context(),song=new S(element(),function(){assert.equal(this,globalThis,'Fetch keeps its browser receiver');fetches++;return Promise.resolve(response());});
 await Promise.all([song.play(ctx),song.play(ctx)]);
 check(fetches===1&&ctx.decodes===1&&ctx.sources.length===1,'Repeated play requests share one complete download and one source');
 check(song.source.loop&&song.element.dataset.playback==='playing','Decoded soundtrack loops independently of network streaming');
 ctx.currentTime=170;check(Math.abs(song.currentTime-7.65)<.00001,'Beat clock wraps at the decoded track duration');
 song.muted=true;check(!song.paused&&song.gain.gain.value===0,'Muting preserves playback and its beat clock');
 song.muted=false;check(song.gain.gain.value===.35,'Unmuting restores the selected volume');
 const position=song.currentTime;song.pause();ctx.currentTime+=10;check(song.paused&&song.currentTime===position&&ctx.sources[0].stopped,'Pause freezes the song position and stops its source');
 await song.play(ctx);check(ctx.sources.length===2&&Math.abs(ctx.sources[1].offset-position)<.00001&&fetches===1,'Resume uses the saved position without downloading again');
 let release;const delayed=new S(element(),()=>new Promise(resolve=>{release=resolve;})),later=context();
 const pending=delayed.play(later);await Promise.resolve();delayed.pause();release(response());await pending;
 check(delayed.paused&&later.sources.length===0,'Pausing during loading prevents a late background start');
 await delayed.play(later);check(later.sources.length===1,'A paused loading request can resume when the buffer is ready');
 const fallback=element(),broken=context();broken.decodeAudioData=()=>Promise.reject(Error('Decoder unavailable'));
 await new S(fallback,()=>Promise.resolve(response())).play(broken);
 check(!fallback.paused&&fallback.dataset.playback==='streaming','Native playback remains available if buffered decoding fails');
 console.log(`${checks} soundtrack checks passed.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});

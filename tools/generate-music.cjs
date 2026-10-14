/* Original synthesized score: kick, snare, hats, bass and an A-minor chord sequence.
 * No samples or external recordings. Rebuild with: node tools/generate-music.cjs
 */
const fs=require('node:fs'),path=require('node:path');
const rate=22050,bpm=128,beat=60/bpm,bars=32,duration=bars*4*beat;
const samples=new Float32Array(Math.round(duration*rate));
let seed=210641;const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
const frequency=note=>440*Math.pow(2,(note-69)/12),tau=Math.PI*2;
function voice(start,length,synth){const offset=Math.round(start*rate),count=Math.round(length*rate);for(let i=0;i<count&&offset+i<samples.length;i++)samples[offset+i]+=synth(i/rate,i/count);}
const chords=[[45,48,52],[41,45,48],[48,52,55],[43,47,50]];
for(let bar=0;bar<bars;bar++){
  const start=bar*4*beat,chord=chords[Math.floor(bar/2)%4],root=chord[0]-12;
  for(let subdivision=0;subdivision<8;subdivision++){
    const t=start+subdivision*beat/2;
    // Two kicks per bar, occasional offbeat kick; clipped sine decays into the bass.
    if(subdivision===0||subdivision===4||(bar%4===3&&subdivision===7))voice(t,.24,(s)=>Math.sin(tau*(48*s+110*.025*(1-Math.exp(-s/.025))))*Math.exp(-s*19)*.52);
    if(subdivision===2||subdivision===6)voice(t,.16,s=>(noise()*.7+Math.sin(tau*175*s)*.3)*Math.exp(-s*31)*.24);
    voice(t,subdivision===7?.11:.055,s=>noise()*Math.exp(-s*(subdivision===7?45:95))*.052);
    const note=root+([0,0,12,7,0,12,7,10][subdivision]),f=frequency(note);
    voice(t,.19,(s,p)=>(Math.sin(tau*f*s)+.2*Math.sin(tau*f*2*s))*Math.min(1,s*150)*Math.pow(1-p,1.6)*.125);
    if(bar>=4&&subdivision%2===0){const pitch=frequency(chord[(bar+subdivision/2)%3]+24);voice(t,.28,(s,p)=>Math.sin(tau*pitch*s)*Math.exp(-s*12)*Math.min(1,s*300)*.038);}
  }
  for(const note of chord){const f=frequency(note+12);voice(start,4*beat,(s,p)=>(Math.sin(tau*f*s)+.18*Math.sin(tau*f*2*s))*Math.sin(Math.PI*p)*.027);}
}
const pcm=Buffer.alloc(samples.length*2);for(let i=0;i<samples.length;i++){samples[i]=Math.tanh(samples[i]*1.15)*.82;pcm.writeInt16LE(Math.round(samples[i]*32767),i*2);}
const header=Buffer.alloc(44);header.write('RIFF',0);header.writeUInt32LE(36+pcm.length,4);header.write('WAVE',8);header.write('fmt ',12);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
const step=.05,stride=Math.round(step*rate),count=Math.ceil(samples.length/stride),levels=[],beats=Array(count).fill(false);
for(let frame=0;frame<count;frame++){let energy=0;const start=frame*stride,end=Math.min(samples.length,start+stride);for(let i=start;i<end;i++)energy+=samples[i]*samples[i];levels.push(Math.sqrt(energy/(end-start)));}
const sorted=[...levels].sort((a,b)=>a-b),peak=sorted[Math.floor(sorted.length*.95)];for(let i=0;i<levels.length;i++)levels[i]=Number(Math.min(1,levels[i]/peak).toFixed(5));
for(let i=0;i<bars*4;i++)beats[Math.floor(i*beat/step)]=true;
const output=path.resolve(__dirname,'../assets');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'stickslap-loop.wav'),Buffer.concat([header,pcm]));fs.writeFileSync(path.join(output,'generated-music-map.js'),'globalThis.STICKSLAP_MUSIC_MAP = '+JSON.stringify({step,levels,beats})+';\n');
console.log(`Original loop: ${duration}s, ${bpm} BPM, ${bars} bars, ${beats.filter(Boolean).length} beat accents.`);

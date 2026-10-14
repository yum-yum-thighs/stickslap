/* Fully buffered playback: one download, then a gapless Web Audio loop. */
(() => {
  class SlapSoundtrack {
    constructor(element, fetcher=globalThis.fetch) {
      this.element=element;this.fetcher=fetcher.bind(globalThis);this.position=0;this.startedAt=0;
      this.source=null;this.buffer=null;this.gain=null;this.context=null;
      this.loading=false;this.requested=false;this.generation=0;this._muted=false;this._volume=.35;
      this.preload();
    }
    preload() {
      if(!this.bytes)this.bytes=Promise.resolve().then(()=>this.fetcher(this.element.src)).then(response=>{
        if(!response.ok)throw Error('Soundtrack download failed.');return response.arrayBuffer();
      });
      this.bytes.catch(()=>{});return this.bytes;
    }
    get paused(){return this.streaming?this.element.paused:!this.source;}
    get currentTime(){return this.streaming?this.element.currentTime:this.source?(this.position+this.context.currentTime-this.startedAt)%this.buffer.duration:this.position;}
    get muted(){return this._muted;}
    set muted(value){this._muted=!!value;this.element.muted=this._muted;this.updateGain();}
    get volume(){return this._volume;}
    set volume(value){this._volume=Math.max(0,Math.min(1,value));this.element.volume=this._volume;this.updateGain();}
    updateGain(){if(this.gain)this.gain.gain.setTargetAtTime(this._muted?0:this._volume,this.context.currentTime,.01);}
    async prepare(context) {
      if(!this.preparation){
        this.loading=true;this.element.dataset.playback='loading';
        this.preparation=this.preload().then(bytes=>context.decodeAudioData(bytes.slice(0))).then(buffer=>{
          this.buffer=buffer;this.loading=false;this.element.dataset.duration=String(buffer.duration);return buffer;
        }).catch(error=>{this.loading=false;this.preparation=null;this.bytes=null;throw error;});
      }
      return this.preparation;
    }
    async play(context) {
      this.requested=true;const generation=this.generation;
      if(this.streaming||!context){this.streaming=true;await this.element.play();this.element.dataset.playback='streaming';return;}
      this.context=context;await context.resume();
      try{await this.prepare(context);}catch(error){
        this.element.dataset.bufferError=error.message;
        if(!this.requested||generation!==this.generation)return;
        this.streaming=true;await this.element.play();this.element.dataset.playback='streaming';return;
      }
      if(!this.requested||generation!==this.generation||this.source)return;
      if(!this.gain){this.gain=context.createGain();this.gain.connect(context.destination);}
      this.updateGain();
      const source=context.createBufferSource();source.buffer=this.buffer;source.loop=true;source.connect(this.gain);
      this.position%=this.buffer.duration;this.startedAt=context.currentTime;this.source=source;
      source.start(0,this.position);this.element.dataset.playback='playing';
    }
    pause() {
      this.requested=false;this.generation++;
      if(this.streaming)this.element.pause();
      if(this.source){this.position=this.currentTime;const source=this.source;this.source=null;source.stop();source.disconnect();}
      this.element.dataset.playback='paused';
    }
  }
  globalThis.SlapSoundtrack=SlapSoundtrack;
})();

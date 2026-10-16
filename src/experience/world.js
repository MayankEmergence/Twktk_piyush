import './world.css';
import '@fontsource/syncopate/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/vt323/400.css';
import '../../assets/manifest.js';
import {worldStore,session as SESSION,config} from './bridge';
import {setupBoxOffice,setupAccount,PRICING} from './booking';
window.TWKTK_CONFIG=config;

import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

window.addEventListener('error',e=>document.documentElement.setAttribute('data-err',(e.message||'?')+' @'+e.lineno));
window.addEventListener('unhandledrejection',e=>document.documentElement.setAttribute('data-err','promise: '+(e.reason&&e.reason.message||e.reason)));

/* ================= helpers ================= */
const $=s=>document.querySelector(s);
const RED=0xD81F26, REDH=0xFF3B41, CHROME=0xAEAEC0, INK=0xEDEDF2;
const rnd=(a,b)=>a+Math.random()*(b-a);
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const isTouch=matchMedia('(pointer:coarse)').matches;
const params=new URLSearchParams(location.search);
// Exploration keeps the original public globe-to-venue flow. Accounts are checked at checkout.

function mat(c,o={}){return new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.85,metalness:.15},o))}
function emat(c,i=1.6){return new THREE.MeshStandardMaterial({color:0x0a0a0e,emissive:c,emissiveIntensity:i,roughness:.6})}
function amat(c,op=.5){return new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide})}
function box(w,h,d,m){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.receiveShadow=true;return mesh}
function cyl(rt,rb,h,m,seg=12){return new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),m)}
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function textSprite(text,{size=256,color='#FF3B41',scale=8}={}){
  const t=canvasTex(size*2,size/2,(g,w,h)=>{g.clearRect(0,0,w,h);
    let fs=46;g.font=`bold ${fs}px Syncopate, sans-serif`;
    while(g.measureText(text).width>w-24&&fs>12){fs-=2;g.font=`bold ${fs}px Syncopate, sans-serif`}
    g.textAlign='center';g.textBaseline='middle';
    g.shadowColor=color;g.shadowBlur=24;g.fillStyle=color;g.fillText(text,w/2,h/2)});
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false}));
  sp.scale.set(scale,scale/4,1);return sp}
/* official TWKTK wordmark as a texture — THOSE WHO KNOW / THEY KNOW */
function wordmarkTex(w=1024,h=340){return canvasTex(w,h,g=>{
  g.clearRect(0,0,w,h);g.textBaseline='middle';
  let fs=88;g.font=`700 ${fs}px Syncopate,sans-serif`;
  while(g.measureText('THOSE WHO KNOW').width>w-60&&fs>18){fs-=2;g.font=`700 ${fs}px Syncopate,sans-serif`}
  const W1=g.measureText('THOSE WHO KNOW').width;
  g.textAlign='center';g.shadowColor='rgba(217,217,217,.5)';g.shadowBlur=16;g.fillStyle='#FFFFFF';
  g.fillText('THOSE WHO KNOW',w/2,h*.34);
  g.font=`700 ${Math.round(fs*.56)}px Syncopate,sans-serif`;
  g.textAlign='right';g.shadowColor='#FF3B41';g.shadowBlur=24;g.fillStyle='#FF3B41';
  g.fillText('THEY KNOW',w/2+W1/2,h*.74)})}
/* official logo PNG for 3D signage — canvas wordmark until (and unless) it loads */
const texLoader=new THREE.TextureLoader();
const brandMats=[];let LOGO_TEX=null;
texLoader.load((window.TWKTK_ASSETS&&window.TWKTK_ASSETS.logo)||'assets/brand/logo.png',
  t=>{t.colorSpace=THREE.SRGBColorSpace;LOGO_TEX=t;
    brandMats.forEach(m=>{m.map=t;m.needsUpdate=true})},undefined,()=>{});
function brandLogoMat(){
  const m=new THREE.MeshBasicMaterial({map:LOGO_TEX||wordmarkTex(),transparent:true,
    blending:THREE.AdditiveBlending,depthWrite:false});
  brandMats.push(m);return m}
/* museum/stall photos — real image with branded fallback art */
function fallbackArt(txt){return canvasTex(512,384,(g,w,h)=>{
  g.fillStyle='#0c0c10';g.fillRect(0,0,w,h);
  const gr=g.createRadialGradient(w/2,h*.72,20,w/2,h*.72,300);
  gr.addColorStop(0,'rgba(216,31,38,.8)');gr.addColorStop(1,'rgba(216,31,38,0)');
  g.fillStyle=gr;g.fillRect(0,0,w,h);
  for(let i=0;i<50;i++){g.fillStyle=`rgba(255,59,65,${rnd(.06,.3)})`;
    g.fillRect(rnd(0,w),rnd(h*.4,h),rnd(2,5),rnd(8,40))}
  g.font='bold 30px Syncopate,sans-serif';g.textAlign='center';g.fillStyle='#EDEDF2';
  g.fillText('THOSE WHO KNOW',w/2,74);
  g.font='bold 17px Syncopate,sans-serif';g.fillStyle='#FF3B41';g.textAlign='right';
  g.fillText('THEY KNOW',w/2+150,102);
  g.font='13px "IBM Plex Mono",monospace';g.fillStyle='#8B8B9E';g.textAlign='center';
  g.fillText((txt||'ARCHIVE').toUpperCase().slice(0,40),w/2,h-28)})}
function photoMat(src,cap){
  const m=new THREE.MeshBasicMaterial({map:fallbackArt(cap)});
  if(src)texLoader.load(src,t=>{t.colorSpace=THREE.SRGBColorSpace;m.map=t;m.needsUpdate=true},undefined,()=>{});
  return m}
function galItems(key){const A=window.TWKTK_ASSETS;
  return (A&&A.galleries&&A.galleries[key]&&A.galleries[key].items)||[]}
function glowTex(){return canvasTex(64,64,(g)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.35,'rgba(255,120,120,.55)');gr.addColorStop(1,'rgba(255,60,60,0)');
  g.fillStyle=gr;g.fillRect(0,0,64,64)})}
const GLOW=glowTex();
// Deterministic, tiled surface detail: no downloads or large texture payloads.
function surfaceMat(color,width,height,{tile=4,tiles=false,roughness=.8}={}){
  const texture=canvasTex(512,512,(g,w,h)=>{
    let seed=731;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
    g.fillStyle='#b8b8b8';g.fillRect(0,0,w,h);
    for(let i=0;i<22000;i++){const n=145+Math.floor(rand()*66);g.fillStyle=`rgba(${n},${n},${n},.22)`;g.fillRect(rand()*w,rand()*h,1+rand()*2,1+rand()*2)}
    if(tiles){g.strokeStyle='rgba(65,65,65,.35)';g.lineWidth=2;g.strokeRect(1,1,w-2,h-2);g.strokeStyle='rgba(225,225,225,.25)';g.strokeRect(4,4,w-8,h-8)}
    else{g.strokeStyle='rgba(70,70,70,.07)';g.lineWidth=1;g.beginPath();g.moveTo(0,170);g.lineTo(190,200);g.lineTo(340,180);g.lineTo(512,210);g.stroke()}
  });
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(width/tile,height/tile);texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  const relief=texture.clone();relief.colorSpace=THREE.NoColorSpace;
  return new THREE.MeshStandardMaterial({color,map:texture,bumpMap:relief,bumpScale:tiles?.018:.035,roughnessMap:relief,roughness,metalness:.025});
}

/* ================= renderer ================= */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'default' });
} catch(e1) {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false });
  } catch(e2) {
    $('#err').style.display = 'flex';
    throw e2;
  }
}
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.25 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = !isTouch;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.className = 'webgl';
$('#app').appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .1, 3000);
let scene = new THREE.Scene();
const renderPass = new RenderPass(scene, camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .35, .6, 1.15);
const fxaa = new ShaderPass(FXAAShader);
const composer = new EffectComposer(renderer);
composer.addPass(renderPass);
composer.addPass(bloom);
composer.addPass(fxaa);
composer.addPass(new OutputPass());
function setFxaaRes() {
  const pr = renderer.getPixelRatio();
  fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
}
setFxaaRes();
const pmrem = new THREE.PMREMGenerator(renderer);
const roomEnvironment = new RoomEnvironment();
const ENV = pmrem.fromScene(roomEnvironment, .06).texture;
roomEnvironment.dispose();
pmrem.dispose();
function useScene(s) { scene = s; renderPass.scene = s; }
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  setFxaaRes();
});


/* ================= audio engine (synth techno, no files) ================= */
const AudioEngine={
  on:false,ready:false,muffleHz:22000,
  init(){
    if(this.ready)return;
    try{
      const ac=this.ac=new (window.AudioContext||window.webkitAudioContext)();
      this.master=ac.createGain();this.master.gain.value=0;
      const comp=ac.createDynamicsCompressor();
      this.muffle=ac.createBiquadFilter();this.muffle.type='lowpass';this.muffle.frequency.value=this.muffleHz;
      this.panner=ac.createPanner();this.panner.panningModel='HRTF';
      this.panner.refDistance=14;this.panner.rolloffFactor=1.4;this.panner.distanceModel='inverse';
      this.bus=ac.createGain();this.bus.gain.value=.9;
      this.bus.connect(this.muffle);this.muffle.connect(this.panner);
      this.panner.connect(this.master);this.master.connect(comp);comp.threshold.value=-14;comp.ratio.value=8;comp.connect(ac.destination);
      // noise buffer
      const nb=ac.createBuffer(1,ac.sampleRate,ac.sampleRate),d=nb.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.noiseBuf=nb;
      // pad drone
      const padG=ac.createGain();padG.gain.value=.05;
      const padF=ac.createBiquadFilter();padF.type='lowpass';padF.frequency.value=600;
      [110,110.35,220].forEach(f=>{const o=ac.createOscillator();o.type='sine';o.frequency.value=f;o.connect(padF);o.start()});
      padF.connect(padG);padG.connect(this.bus);
      // Original TWKTK melodic-house arrangement, created entirely in the browser.
      const echo=ac.createDelay(1);echo.delayTime.value=60/124*.75;
      const feedback=ac.createGain();feedback.gain.value=.26;
      const echoTone=ac.createBiquadFilter();echoTone.type='lowpass';echoTone.frequency.value=2400;
      const wet=ac.createGain();wet.gain.value=.18;
      echo.connect(echoTone);echoTone.connect(feedback);feedback.connect(echo);echoTone.connect(wet);wet.connect(this.bus);this.echo=echo;
      this.step=0;this.nextT=ac.currentTime+.1;this.bpm=124;
      this.seqInt=setInterval(()=>this.schedule(),25);
      this.ready=true;
    }catch(e){}
  },
  schedule(){
    const ac=this.ac,spb=60/this.bpm,s16=spb/4;
    if(ac.state!=="running")return;
    if(this.nextT<ac.currentTime-.25)this.nextT=ac.currentTime+.04;
    while(this.nextT<ac.currentTime+.12){
      const st=this.step%16,t=this.nextT,bar=Math.floor(this.step/16)%16;
      const chords=[[220,261.63,329.63],[174.61,220,261.63],[261.63,329.63,392],[196,246.94,293.66]],chord=chords[Math.floor(bar/2)%4];
      const breakdown=bar===12||bar===13;
      if(st%4===0&&!breakdown)this.kick(t);
      if(st%4===2)this.hat(t,.33);
      if(st===7||st===15)this.hat(t,.13);
      if(st===4||st===12)this.clap(t);
      if([2,6,10,14].includes(st)&&!breakdown)this.bass(t,chord[0]/4);
      if(st===0||st===8)this.chord(t,chord);
      if([1,3,6,9,11,14].includes(st))this.melody(t,chord[[0,2,1,2,0,1][[1,3,6,9,11,14].indexOf(st)]]*(bar%4===3?2:1),breakdown?.065:.09);
      if(bar===15&&st>=12)this.hat(t,.12+(st-12)*.07);
      this.nextT+=s16;this.step++;
    }
  },
  env(t,a,d,peak=1){const g=this.ac.createGain();g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(.001,t+a+d);return g},
  kick(t){const ac=this.ac,o=ac.createOscillator();o.type='sine';
    o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(42,t+.11);
    const g=this.env(t,.002,.26,1.05);o.connect(g);g.connect(this.bus);o.start(t);o.stop(t+.3);
    if(this.onKick)this.onKick(t-ac.currentTime)},
  hat(t,v){const ac=this.ac,s=ac.createBufferSource();s.buffer=this.noiseBuf;s.loop=true;
    const f=ac.createBiquadFilter();f.type='highpass';f.frequency.value=8200;
    const g=this.env(t,.001,.05,v*.5);s.connect(f);f.connect(g);g.connect(this.bus);s.start(t);s.stop(t+.08)},
  clap(t){const ac=this.ac,s=ac.createBufferSource();s.buffer=this.noiseBuf;s.loop=true;
    const f=ac.createBiquadFilter();f.type='bandpass';f.frequency.value=1600;f.Q.value=1.4;
    const g=this.env(t,.002,.14,.5);s.connect(f);f.connect(g);g.connect(this.bus);s.start(t);s.stop(t+.18)},
  bass(t,fr){const ac=this.ac,o=ac.createOscillator();o.type='sawtooth';o.frequency.value=fr;
    const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(90,t);
    f.frequency.exponentialRampToValueAtTime(500,t+.03);f.frequency.exponentialRampToValueAtTime(110,t+.16);
    const g=this.env(t,.004,.17,.42);o.connect(f);f.connect(g);g.connect(this.bus);o.start(t);o.stop(t+.2)},
  chord(t,notes){const ac=this.ac,f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=950;
    const g=this.env(t,.055,.8,.07);f.connect(g);g.connect(this.bus);
    notes.forEach((fr,i)=>{const o=ac.createOscillator();o.type='triangle';o.frequency.value=fr;o.detune.value=(i-1)*5;o.connect(f);o.start(t);o.stop(t+.9)})},
  melody(t,fr,volume){const ac=this.ac,o=ac.createOscillator();o.type='sine';o.frequency.value=fr*2;
    const g=this.env(t,.009,.3,volume);o.connect(g);g.connect(this.bus);if(this.echo)g.connect(this.echo);o.start(t);o.stop(t+.34)},
  blip(){if(!this.ready||!this.on)return;const t=this.ac.currentTime,o=this.ac.createOscillator();o.type='square';
    o.frequency.value=880;const g=this.env(t,.001,.09,.12);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+.1)},
  foot(run){if(!this.ready||!this.on)return;const ac=this.ac,t=ac.currentTime;
    const s=ac.createBufferSource();s.buffer=this.noiseBuf;s.loop=true;
    const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=run?900:600;
    const g=this.env(t,.001,.05,run?.1:.06);s.connect(f);f.connect(g);g.connect(this.master);s.start(t);s.stop(t+.07)},
  hiss(){if(!this.ready)return;const ac=this.ac,t=ac.currentTime;
    const s=ac.createBufferSource();s.buffer=this.noiseBuf;s.loop=true;
    const f=ac.createBiquadFilter();f.type='highpass';f.frequency.value=3200;
    const g=this.env(t,.01,.5,.22);s.connect(f);f.connect(g);g.connect(this.master);s.start(t);s.stop(t+.6)},
  fanfare(){if(!this.ready)return;const ac=this.ac,t0=ac.currentTime;
    [523.25,659.25,783.99,1046.5,1318.5].forEach((fr,i)=>{
      const o=ac.createOscillator();o.type='triangle';o.frequency.value=fr;
      const g=this.env(t0+i*.09,.005,.4,.16);o.connect(g);g.connect(this.master);
      o.start(t0+i*.09);o.stop(t0+i*.09+.45)})},
  whoosh(){if(!this.ready)return;const ac=this.ac,t=ac.currentTime;
    const s=ac.createBufferSource();s.buffer=this.noiseBuf;s.loop=true;
    const f=ac.createBiquadFilter();f.type='bandpass';f.Q.value=3;
    f.frequency.setValueAtTime(300,t);f.frequency.exponentialRampToValueAtTime(2600,t+.9);
    const g=this.env(t,.05,.85,.08);s.connect(f);f.connect(g);g.connect(this.master);s.start(t);s.stop(t+1)},
  boom(){if(!this.ready)return;const ac=this.ac,t=ac.currentTime;
    const o=ac.createOscillator();o.type='sine';
    o.frequency.setValueAtTime(90,t);o.frequency.exponentialRampToValueAtTime(28,t+.5);
    const g=this.env(t,.005,.7,.55);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+.75);
    const s=ac.createBufferSource();s.buffer=this.noiseBuf;s.loop=true;
    const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=900;
    const g2=this.env(t,.005,.5,.3);s.connect(f);f.connect(g2);g2.connect(this.master);s.start(t);s.stop(t+.6)},
  drop(cb){if(!this.ready)return;const ac=this.ac,t=ac.currentTime;
    this.muffle.frequency.cancelScheduledValues(t);
    this.muffle.frequency.setValueAtTime(this.muffle.frequency.value,t);
    this.muffle.frequency.exponentialRampToValueAtTime(240,t+1.4);
    this.muffle.frequency.exponentialRampToValueAtTime(Math.max(this.muffleHz,300),t+1.9);
    const s=ac.createBufferSource();s.buffer=this.noiseBuf;s.loop=true;
    const f=ac.createBiquadFilter();f.type='bandpass';f.frequency.setValueAtTime(300,t);
    f.frequency.exponentialRampToValueAtTime(6000,t+1.8);f.Q.value=2;
    const g=ac.createGain();g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.4,t+1.7);
    g.gain.exponentialRampToValueAtTime(.001,t+2.2);
    s.connect(f);f.connect(g);g.connect(this.master);s.start(t);s.stop(t+2.3);
    if(cb)setTimeout(cb,1850)},
  setMuffle(hz,ramp=1){this.muffleHz=hz;if(!this.ready)return;const t=this.ac.currentTime;
    this.muffle.frequency.cancelScheduledValues(t);
    this.muffle.frequency.setValueAtTime(Math.max(this.muffle.frequency.value,40),t);
    this.muffle.frequency.exponentialRampToValueAtTime(Math.max(hz,40),t+ramp)},
  setVolume(v,ramp=.8){if(!this.ready)return;const t=this.ac.currentTime;
    this.master.gain.cancelScheduledValues(t);this.master.gain.setValueAtTime(this.master.gain.value,t);
    this.master.gain.linearRampToValueAtTime(v,t+ramp)},
  setStagePos(x,y,z){if(this.ready)this.panner.setPosition(x,y,z)},
  updListener(cam){if(!this.ready)return;const l=this.ac.listener,p=cam.position;
    const f=new THREE.Vector3(0,0,-1).applyQuaternion(cam.quaternion);
    const u=new THREE.Vector3(0,1,0).applyQuaternion(cam.quaternion);
    if(l.positionX){l.positionX.value=p.x;l.positionY.value=p.y;l.positionZ.value=p.z;
      l.forwardX.value=f.x;l.forwardY.value=f.y;l.forwardZ.value=f.z;
      l.upX.value=u.x;l.upY.value=u.y;l.upZ.value=u.z}
    else l.setPosition(p.x,p.y,p.z)},
  toggle(){this.init();if(!this.ready)return false;
    if(this.ac.state==='suspended')this.ac.resume();
    this.on=!this.on;this.setVolume(this.on?.55:0);return this.on}
};
$('#sndChip').textContent='SND OFF';
$('#sndChip').addEventListener('click',()=>{$('#sndChip').textContent=AudioEngine.toggle()?'SND ON':'SND OFF'});

/* ================= UI utils ================= */
let toastT=null;
function toast(html,ms=3200){const t=$('#toast');t.innerHTML=html;t.classList.add('on');
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),ms)}
function flash(op=.9,ms=420){const f=$('#flash');f.style.transition='none';f.style.opacity=op;
  requestAnimationFrame(()=>{f.style.transition=`opacity ${ms}ms`;f.style.opacity=0})}
function fadeIn(ms=900){const f=$('#fade');f.style.transition=`opacity ${ms}ms`;f.style.opacity=1}
function fadeOut(ms=900){const f=$('#fade');f.style.transition=`opacity ${ms}ms`;f.style.opacity=0}

/* ================= city data ================= */
const CITIES={
  mumbai:{label:'MUMBAI',lat:19.076,lon:72.877,sea:true,
    skyTop:0x3d5a8f,skyHor:0xff8f6e,sunC:0xffd9a8,fogC:0xd9906e,ground:0x4a3c34,
    cloudC:0xffa0b4,treeCount:30,pastel:[0xf2d8c0,0xe8c8d0,0xc8d8e8,0xf0e0b8,0xd8ccc0],
    bills:['THOSE WHO KNOW THEY KNOW','BEYOND SOUND','MUMBAI, ARE YOU READY?','THOSE WHO KNOW THEY KNOW','THE NIGHT IS COMING'],
    landmarks:[
      {u:.10,side:-1,b:'marineDrive',n:'MARINE DRIVE · QUEEN\'S NECKLACE'},
      {u:.26,side: 1,b:'gateway',n:'GATEWAY OF INDIA'},
      {u:.42,side:-1,b:'nariman',n:'NARIMAN POINT'},
      {u:.58,side:-1,b:'sealink',n:'BANDRA–WORLI SEA LINK'},
      {u:.72,side: 1,b:'worli',n:'WORLI SKYLINE'},
      {u:.86,side: 1,b:'bkc',n:'BKC — FINAL APPROACH'},
    ]},
  delhi:{label:'DELHI',lat:28.61,lon:77.21,sea:false,
    skyTop:0x5a4d85,skyHor:0xffa860,sunC:0xffdca0,fogC:0xcc9a6e,ground:0x453729,
    cloudC:0xffb888,treeCount:130,pastel:[0xf0e6d2,0xe8d8c0,0xdcc8b0,0xe0d0c8,0xd8ccb8],
    bills:['TWKTK · 31.10','BEYOND SOUND','DILLI, RAAT BAAKI HAI','THOSE WHO KNOW THEY KNOW','THE NIGHT IS COMING'],
    landmarks:[
      {u:.10,side: 1,b:'indiaGate',n:'INDIA GATE'},
      {u:.26,side:-1,b:'cp',n:'CONNAUGHT PLACE'},
      {u:.42,side: 1,b:'lodhi',n:'LODHI ROAD'},
      {u:.58,side:-1,b:'qutub',n:'QUTUB MINAR'},
      {u:.72,side: 1,b:'hauz',n:'HAUZ KHAS VILLAGE'},
      {u:.86,side:-1,b:'aerocity',n:'AEROCITY — FINAL APPROACH'},
    ]},
  bangalore:{label:'BANGALORE',lat:12.97,lon:77.59,sea:false,
    skyTop:0x4a3a85,skyHor:0xc97ab8,sunC:0xffc9a0,fogC:0xa87e9e,ground:0x39412f,
    cloudC:0xd9a0e0,treeCount:150,pastel:[0xd8e0e8,0xc8d8d0,0xe0d8c8,0xccd4dc,0xd0e0d4],
    bills:['TWKTK · 01.11','BEYOND SOUND','NAMMA BENGALURU, READY?','THOSE WHO KNOW THEY KNOW','THE NIGHT IS COMING'],
    landmarks:[
      {u:.10,side:-1,b:'mgroad',n:'MG ROAD'},
      {u:.26,side: 1,b:'cubbon',n:'CUBBON PARK'},
      {u:.42,side:-1,b:'vidhana',n:'VIDHANA SOUDHA'},
      {u:.58,side: 1,b:'ubcity',n:'UB CITY'},
      {u:.72,side:-1,b:'church',n:'CHURCH STREET'},
      {u:.86,side: 1,b:'ecity',n:'ELECTRONIC CITY — FINAL APPROACH'},
    ]},
};

/* ================= landmark builders (golden-hour, recognisable) ================= */
const conc=mat(0x9a9088,{roughness:.9}),stone=mat(0xb09c7c,{roughness:.95}),
      basalt=mat(0x8a7a62,{roughness:.9}),sandRed=mat(0xb0603a,{roughness:.95}),
      marble=mat(0xeae2d2,{roughness:.85}),heritage=mat(0xf0e6d2,{roughness:.9}),
      glass=mat(0x9ab4cc,{roughness:.25,metalness:.65}),
      lawn=mat(0x4a7a42,{roughness:1}),
      warmWin=emat(0xffb45e,.7),coolWin=emat(0xbfd4ff,.45),whiteEm=emat(0xfff6e8,1.1),
      goldM=mat(0xd8a848,{metalness:.85,roughness:.3});
const LB={
  gateway(){const g=new THREE.Group(); // Gateway of India — basalt arch, corner turrets, wings
    const plinth=box(36,2.6,15,basalt);plinth.position.y=1.3;g.add(plinth);
    [-7.2,7.2].forEach(x=>{const pier=box(3.8,24,11,basalt);pier.position.set(x,2.6+12,0);g.add(pier)});
    const arch=new THREE.Mesh(new THREE.TorusGeometry(5.6,1.9,10,24,Math.PI),basalt);arch.position.y=2.6+13;g.add(arch);
    const spandrel=box(18,6,10,basalt);spandrel.position.y=2.6+23;g.add(spandrel);
    [-14,14].forEach(x=>{const wing=box(9.5,15,11,basalt);wing.position.set(x,2.6+7.5,0);g.add(wing);
      const wa=new THREE.Mesh(new THREE.TorusGeometry(2.3,1,8,16,Math.PI),basalt);wa.position.set(x,2.6+7,5.6);g.add(wa)});
    [[-14,-4.2],[-14,4.2],[14,-4.2],[14,4.2]].forEach(([x,z])=>{
      const t=cyl(1.4,1.6,18,basalt,8);t.position.set(x,2.6+9,z);g.add(t);
      const d=new THREE.Mesh(new THREE.SphereGeometry(1.9,10,8,0,TAU,0,Math.PI/2),stone);d.position.set(x,2.6+18,z);g.add(d)});
    const cornice=box(37,1.1,12,stone);cornice.position.y=2.6+26.4;g.add(cornice);
    const cd=new THREE.Mesh(new THREE.SphereGeometry(6,14,10,0,TAU,0,Math.PI/2),stone);cd.position.y=2.6+27;g.add(cd);
    const wash=box(32,1,.8,warmWin);wash.position.set(0,3.2,7.6);g.add(wash);
    return g},
  marineDrive(){const g=new THREE.Group(); // art-deco crescent + promenade + palms + necklace
    const R=90;
    for(let i=0;i<13;i++){const a=-.5+i*.085;const h=rnd(11,17);
      const b=box(7,h,8,mat([0xf2d8c0,0xe8d0c8,0xdcd0c0][i%3],{roughness:.85}));
      b.position.set(Math.sin(a)*R-24,h/2,-Math.cos(a)*R+52);b.rotation.y=-a;g.add(b);
      const st=box(6,.5,.2,warmWin);st.position.set(b.position.x,h*.55,b.position.z+4.1);st.rotation.y=-a;g.add(st)}
    const prom=box(150,.5,7,mat(0xb0a494,{roughness:.95}));prom.position.set(-20,.25,-36);g.add(prom);
    const sea2=box(150,.2,3,mat(0x5a6a70));sea2.position.set(-20,.1,-41);g.add(sea2);
    for(let i=0;i<7;i++){const p=LB._palm(rnd(6,8));p.position.set(-70+i*18,0,-32);g.add(p)}
    const pts=[];for(let i=0;i<=30;i++){const a=i/30*Math.PI*.8;pts.push(Math.sin(a)*70-20,2,-Math.cos(a)*36)}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
    g.add(new THREE.Points(geo,new THREE.PointsMaterial({map:GLOW,color:0xffc878,size:5,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})));
    return g},
  sealink(){const g=new THREE.Group(); // cable-stayed twin pylons, fan cables, deck lamps
    const deck=box(150,1.5,11,conc);deck.position.y=12;g.add(deck);
    [-5.2,5.2].forEach(z=>{const rail=box(150,.35,.3,mat(0xd8d8e0));rail.position.set(0,13,z);g.add(rail)});
    [-35,35].forEach(x=>{
      [-3.8,3.8].forEach(z=>{
        const leg=cyl(.9,1.3,17,conc,8);leg.position.set(x,12+7,z*.5);leg.rotation.x=z>0?-.21:.21;g.add(leg)});
      const mast=box(2.4,30,2.2,conc);mast.position.set(x,12+17+13,0);g.add(mast);
      for(let i=-6;i<=6;i++){if(!i)continue;
        const dx=i*5.4,top=12+38;const len=Math.hypot(dx,25);
        [-4.6,4.6].forEach(z=>{
          const c=cyl(.07,.07,len,mat(0xf2f2f6,{roughness:.4}),4);
          c.position.set(x+dx/2,top-12.5,z*.9);c.rotation.z=Math.atan2(dx,25);g.add(c)})}});
    const lp=[];for(let i=0;i<16;i++)lp.push(-70+i*9.4,14.6,5.2);
    const lgeo=new THREE.BufferGeometry();lgeo.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));
    g.add(new THREE.Points(lgeo,new THREE.PointsMaterial({map:GLOW,color:0xffd9a0,size:4,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})));
    return g},
  nariman(){return LB._towers(5,[16,26,34,22,18],[0xd8ccc0,0xc4d2dc,0xe0d4c4])},
  worli(){return LB._towers(4,[40,52,34,46],[0xe8d8c8,0xccd8e0,0xd8ccc4])},
  bkc(){const g=LB._towers(5,[24,32,28,36,22],[0xc8d8e8,0xd8e0e8,0xd0ccc8]);
    const s=textSprite('BKC',{scale:14,color:'#FFD9A0'});s.position.y=44;g.add(s);return g},
  indiaGate(){const g=new THREE.Group();const sand=mat(0xc9a878,{roughness:.95});
    [[-1,0],[1,0]].forEach(()=>{});
    const lawn1=box(70,.25,12,lawn);lawn1.position.set(0,.12,12);g.add(lawn1);
    const lawn2=lawn1.clone();lawn2.position.z=-12;g.add(lawn2);
    const base=box(26,3.5,16,sand);base.position.y=1.75;g.add(base);
    [-8,8].forEach(x=>{const leg=box(7,28,11,sand);leg.position.set(x,3.5+14,0);g.add(leg)});
    const arch=new THREE.Mesh(new THREE.TorusGeometry(6.4,2.3,10,24,Math.PI),sand);arch.position.y=3.5+16;g.add(arch);
    const band=box(23.4,1.4,12.2,mat(0xa88858));band.position.y=3.5+28.7;g.add(band);
    const attic=box(23,6,12,sand);attic.position.y=3.5+32.4;g.add(attic);
    const inscr=new THREE.Mesh(new THREE.PlaneGeometry(10,3),new THREE.MeshBasicMaterial({
      map:canvasTex(256,80,(gc,w,h)=>{gc.fillStyle='#c9a878';gc.fillRect(0,0,w,h);
        gc.font='bold 44px Georgia,serif';gc.textAlign='center';gc.textBaseline='middle';
        gc.fillStyle='#6a5438';gc.fillText('INDIA',w/2,h/2)})}));
    inscr.position.set(0,3.5+32.4,6.15);g.add(inscr);
    const bowl=cyl(2.2,2.9,1.8,sand,10);bowl.position.y=3.5+36.3;g.add(bowl);
    const flame=new THREE.Mesh(new THREE.ConeGeometry(.9,2.2,8),emat(0xffa040,2.2));flame.position.set(0,4.4,9.5);g.add(flame);
    return g},
  cp(){const g=new THREE.Group(); // Connaught Place — white georgian colonnade rings + central park
    [[34,12],[50,16]].forEach(([R,cnt])=>{
      for(let i=0;i<cnt;i++){const a=i/cnt*TAU;
        const blk=new THREE.Group();
        const b=box(14,8.5,6,heritage);b.position.y=4.25;blk.add(b);
        for(let c2=0;c2<5;c2++){const col=cyl(.34,.34,3.4,marble,8);col.position.set(-5.6+c2*2.8,1.7,3.4);blk.add(col)}
        const cor=box(14.4,.8,6.8,marble);cor.position.y=8.9;blk.add(cor);
        const st=box(11,.5,.2,warmWin);st.position.set(0,5.6,3.15);blk.add(st);
        blk.position.set(Math.cos(a)*R,0,Math.sin(a)*R);blk.lookAt(0,0,0);g.add(blk)}});
    const park=new THREE.Mesh(new THREE.CircleGeometry(24,24),lawn);park.rotation.x=-Math.PI/2;park.position.y=.06;g.add(park);
    for(let i=0;i<8;i++){const t=LB._tree(rnd(5,7));const a=i/8*TAU;t.position.set(Math.cos(a)*16,0,Math.sin(a)*16);g.add(t)}
    return g},
  lodhi(){const g=new THREE.Group(); // Lodhi gardens — domed tomb + lawns + old trees
    const lw=new THREE.Mesh(new THREE.CircleGeometry(48,20),lawn);lw.rotation.x=-Math.PI/2;lw.position.y=.05;g.add(lw);
    const tomb=new THREE.Group();
    const tb=box(16,9,16,stone);tb.position.y=4.5;tomb.add(tb);
    const drum=cyl(6.4,6.8,2.2,stone,14);drum.position.y=10.1;tomb.add(drum);
    const dm=new THREE.Mesh(new THREE.SphereGeometry(6.6,14,10,0,TAU,0,Math.PI/2),mat(0xc9b898,{roughness:.9}));dm.position.y=11;tomb.add(dm);
    const fa=new THREE.Mesh(new THREE.TorusGeometry(2.6,1,8,16,Math.PI),stone);fa.position.set(0,5,8.1);tomb.add(fa);
    [[-6,-6],[6,-6],[-6,6],[6,6]].forEach(([x,z])=>{const ch=cyl(.5,.5,3,stone,6);ch.position.set(x,10.5,z);tomb.add(ch);
      const cd2=new THREE.Mesh(new THREE.SphereGeometry(1.1,8,6,0,TAU,0,Math.PI/2),stone);cd2.position.set(x,12,z);tomb.add(cd2)});
    tomb.position.set(0,0,-14);g.add(tomb);
    for(let i=0;i<10;i++){const t=LB._tree(rnd(7,10));t.position.set(rnd(-42,42),0,rnd(-8,16));g.add(t)}
    return g},
  qutub(){const g=new THREE.Group(); // Qutub Minar — 5 tapering fluted storeys + balconies
    const pl=cyl(9,10,1.6,stone,16);pl.position.y=.8;g.add(pl);
    let y=1.6;
    [[6,15,sandRed],[4.9,11.5,sandRed],[3.9,9,sandRed],[3,6.5,marble],[2.3,5.5,sandRed]].forEach(([r,h,m],i)=>{
      const seg=new THREE.Mesh(new THREE.CylinderGeometry(r*.84,r,h,18),m);
      seg.material=m;seg.geometry.computeVertexNormals();seg.position.y=y+h/2;g.add(seg);
      const balc=cyl(r+.55,r+.75,.9,stone,18);balc.position.y=y+h;g.add(balc);y+=h});
    const cup=cyl(1.4,1.8,1.6,stone,10);cup.position.y=y+.8;g.add(cup);
    // Quwwat ruin arch nearby
    const ruin=new THREE.Group();
    [-4,4].forEach(x=>{const pier=box(2.4,12,2.4,sandRed);pier.position.set(x,6,0);ruin.add(pier)});
    const ra=new THREE.Mesh(new THREE.TorusGeometry(3.6,1.1,8,16,Math.PI),sandRed);ra.position.y=11;ruin.add(ra);
    ruin.position.set(-18,0,-8);g.add(ruin);
    for(let i=0;i<5;i++){const t=LB._tree(rnd(5,7));t.position.set(rnd(-24,24),0,rnd(8,20));g.add(t)}
    return g},
  hauz(){const g=new THREE.Group(); // Hauz Khas — lake + L-shaped madrasa + trees
    const lake=new THREE.Mesh(new THREE.CircleGeometry(30,24),mat(0x486a80,{roughness:.15,metalness:.6}));
    lake.rotation.x=-Math.PI/2;lake.position.y=.1;g.add(lake);
    const ruin=box(24,8.5,6,stone);ruin.position.set(0,4.25,-24);g.add(ruin);
    const ruin2=box(6,8.5,16,stone);ruin2.position.set(12,4.25,-18);g.add(ruin2);
    [[-6,-24],[4,-24],[12,-12]].forEach(([x,z])=>{
      const d=new THREE.Mesh(new THREE.SphereGeometry(2.4,10,8,0,TAU,0,Math.PI/2),mat(0xc9b898));d.position.set(x,8.5,z);g.add(d)});
    for(let i=0;i<4;i++){const w=box(1.6,2.8,.3,warmWin);w.position.set(-8+i*4.5,4.5,-20.8);g.add(w)}
    for(let i=0;i<7;i++){const t=LB._tree(rnd(5,8));t.position.set(rnd(-26,26),0,rnd(-14,-32));g.add(t)}
    return g},
  aerocity(){const g=LB._towers(4,[18,24,20,26],[0xd8dce0,0xc8d4dc,0xdcd8d0]); // hotel row + plane + runway
    for(let i=0;i<4;i++){const band=box(7,1.1,.25,emat([0xffd9a0,0xffb45e][i%2],1));
      band.position.set((i-1.5)*14,14+i%2*4,5.2);g.add(band)}
    const plane=new THREE.Group();const fus=cyl(.8,.8,10,mat(0xe8e8ec));fus.rotation.z=Math.PI/2;plane.add(fus);
    const wing=box(1.4,.2,9,mat(0xe8e8ec));plane.add(wing);
    const tail=box(.2,2,1.6,mat(0xe8e8ec));tail.position.set(-4.6,1,0);plane.add(tail);
    const beacon=new THREE.Mesh(new THREE.SphereGeometry(.4,6,6),emat(RED,3));beacon.position.y=1;plane.add(beacon);
    plane.position.set(0,46,0);g.add(plane);g.userData.plane=plane;
    const rp=[];for(let i=0;i<14;i++)rp.push(-40+i*6,.4,-30);
    const rgeo=new THREE.BufferGeometry();rgeo.setAttribute('position',new THREE.Float32BufferAttribute(rp,3));
    g.add(new THREE.Points(rgeo,new THREE.PointsMaterial({map:GLOW,color:0xffe0a0,size:3,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})));
    return g},
  mgroad(){const g=LB._towers(5,[14,20,12,22,16],[0xe0d8cc,0xccd4dc,0xd8d0c4]); // + Namma Metro viaduct
    const via=box(120,1.4,5,conc);via.position.y=9;g.add(via);
    for(let i=0;i<9;i++){const p=cyl(.8,1,9,conc,8);p.position.set(-54+i*13.5,4.5,0);g.add(p)}
    const train=box(24,2.6,3,mat(0x7a4a9a,{roughness:.5}));train.position.set(-10,10.8,0);g.add(train);
    const tw=box(22,.7,.2,coolWin);tw.position.set(-10,11,1.6);g.add(tw);
    const s=textSprite('MG ROAD',{scale:12,color:'#FFD9A0'});s.position.y=28;g.add(s);
    return g},
  cubbon(){const g=new THREE.Group(); // Cubbon Park — dense green + red Gothic library
    for(let i=0;i<16;i++){const t=LB._tree(rnd(7,12));t.position.set(rnd(-48,48),0,rnd(-18,18));g.add(t)}
    const lib=new THREE.Group();const red=mat(0xa03830,{roughness:.85});
    const lb2=box(18,7,9,red);lb2.position.y=3.5;lib.add(lb2);
    const gable=new THREE.Mesh(new THREE.CylinderGeometry(.1,6,4,3),red);gable.rotation.y=Math.PI/6;gable.position.y=9;lib.add(gable);
    const trim=box(18.4,.7,9.4,marble);trim.position.y=7;lib.add(trim);
    for(let i=0;i<5;i++){const a2=box(1.6,3,.3,marble);a2.position.set(-6.4+i*3.2,3.2,4.6);lib.add(a2)}
    lib.position.set(0,0,-6);g.add(lib);
    for(let i=0;i<5;i++){const l=cyl(.12,.12,5,mat(0x4a4440),6);l.position.set(-40+i*20,2.5,10);g.add(l);
      const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffd28a,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
      gl.scale.set(4,4,1);gl.position.set(-40+i*20,5.4,10);g.add(gl)}
    return g},
  vidhana(){const g=new THREE.Group(); // Vidhana Soudha — granite, colonnade, central + corner domes
    const gran=mat(0xcabb96,{roughness:.9}),granD=mat(0xb0a37f,{roughness:.9});
    const podium=box(52,4,26,granD);podium.position.y=2;g.add(podium);
    [[42,1.2],[34,2.4]].forEach(([w,y2])=>{const st=box(w,1.2,6,granD);st.position.set(0,y2*.5+ .1,15);g.add(st)});
    const main=box(46,11,20,gran);main.position.y=4+5.5;g.add(main);
    for(let i=0;i<14;i++){const col=cyl(.62,.62,9.4,marble,10);col.position.set(-19.5+i*3,4+4.7,10.6);g.add(col)}
    const entab=box(48,1.8,22,granD);entab.position.y=4+11.4;g.add(entab);
    const ctower=box(15,5.5,15,gran);ctower.position.y=4+11.4+2.75;g.add(ctower);
    const drum=cyl(5.6,6.2,2.4,gran,14);drum.position.y=4+11.4+5.5+1.2;g.add(drum);
    const dome=new THREE.Mesh(new THREE.SphereGeometry(5.8,14,10,0,TAU,0,Math.PI/2),gran);dome.position.y=4+11.4+5.5+2.4;g.add(dome);
    const cap=cyl(.7,.9,2.2,goldM,8);cap.position.y=4+11.4+5.5+2.4+6.4;g.add(cap);
    [[-21,-8],[21,-8],[-21,8],[21,8]].forEach(([x,z])=>{
      const md=new THREE.Mesh(new THREE.SphereGeometry(2.3,10,8,0,TAU,0,Math.PI/2),gran);md.position.set(x,4+11.4+.9,z);g.add(md)});
    const wash=box(44,9,.3,new THREE.MeshStandardMaterial({color:0x776a4e,emissive:0xffd9a0,emissiveIntensity:.4}));
    wash.position.set(0,4+5,10.15);g.add(wash);
    return g},
  ubcity(){const g=new THREE.Group(); // UB City — crowned luxury towers + podium mall
    const pod=box(34,6,18,mat(0xd8ccc0,{roughness:.7}));pod.position.y=3;g.add(pod);
    const podLED=box(34.2,.7,18.2,warmWin);podLED.position.y=6;g.add(podLED);
    [[-12,40],[0,52],[12,40]].forEach(([x,h])=>{
      const t=box(8.5,h,8.5,glass);t.position.set(x,6+h/2,0);g.add(t);
      LB._winds(g,x,h,8.5);
      const crown=new THREE.Mesh(new THREE.ConeGeometry(5.6,6,4),goldM);
      crown.position.set(x,6+h+3,0);crown.rotation.y=Math.PI/4;g.add(crown)});
    const s=textSprite('UB CITY',{scale:11,color:'#FFD9A0'});s.position.y=70;g.add(s);
    return g},
  church(){const g=new THREE.Group(); // Church Street — cafés, pastel facades, festoon lights
    const cols=[0xe8c8b8,0xc8d8c8,0xd8c8e0,0xe8d8b0,0xc8ccd8,0xe0ccc0];
    for(let i=0;i<6;i++){const h=rnd(6,9);const b=box(8,h,6,mat(cols[i],{roughness:.85}));
      b.position.set(-22+i*9,h/2,0);g.add(b);
      const awn=box(6,.4,1.6,mat([0xa03830,0x3a6a4a,0xb08030][i%3]));awn.position.set(-22+i*9,3.4,3.6);g.add(awn);
      const sign=box(4.5,1,.2,emat([0xffd25e,0xff9a70,0xffe0a8][i%3],1.1));sign.position.set(-22+i*9,5.2,3.2);g.add(sign)}
    const fp=[];for(let i=0;i<26;i++){const x=-24+i*2.1;fp.push(x,5.6-Math.sin(i/25*Math.PI)*1.4+1.2,5)}
    const fgeo=new THREE.BufferGeometry();fgeo.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));
    g.add(new THREE.Points(fgeo,new THREE.PointsMaterial({map:GLOW,color:0xffe0a0,size:2.2,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})));
    for(let i=0;i<4;i++){const t=LB._tree(rnd(4,6));t.position.set(-20+i*13,0,7);g.add(t)}
    return g},
  ecity(){const g=LB._towers(4,[16,22,14,20],[0xc8d8e8,0xd0dce4,0xc4ccd8]); // glass campus + elevated expressway
    const via=box(160,1.3,8,conc);via.position.y=11;g.add(via);
    for(let i=0;i<11;i++){const p=cyl(1,1.3,11,conc,8);p.position.set(-72+i*14.5,5.5,0);g.add(p)}
    for(let i=0;i<4;i++){const car=box(2,.8,4,mat([0xd8d8e0,0x8a9098,0xb0a8a0][i%3]));
      car.position.set(-40+i*24,12.1,i%2?2:-2);g.add(car)}
    const s=textSprite('ELECTRONIC CITY',{scale:15,color:'#BFD4FF'});s.position.y=30;g.add(s);
    return g},
  _towers(n,hs,pal){const g=new THREE.Group();
    hs.forEach((h,i)=>{const w=rnd(8,12);
      const m=pal?mat(pal[i%pal.length],{roughness:.7,metalness:.15}):glass;
      const t=box(w,h,w,m);
      t.position.set((i-(n-1)/2)*14+rnd(-2,2),h/2,rnd(-6,6));g.add(t);
      LB._winds(g,t.position.x,h,w,t.position.z);
      if(i%2){const tank=box(2.2,1.5,2.2,conc);tank.position.set(t.position.x+2,h+.75,t.position.z);g.add(tank)}
      else{const ant=cyl(.08,.08,4,mat(0x777),6);ant.position.set(t.position.x,h+2,t.position.z);g.add(ant)}});
    return g},
  _winds(g,x,h,w,z=0){for(let i=0;i<Math.min(10,h/4);i++){
    const win=box(w*.9,.5,.1,Math.random()<.5?warmWin:coolWin);
    win.position.set(x,3+i*(h/ (Math.min(10,h/4)+1)),z+w/2+.06);g.add(win)}},
  _tree(h){const t=new THREE.Group();const tr=cyl(.25,.4,h*.5,mat(0x5a4432),6);tr.position.y=h*.25;t.add(tr);
    const cr=new THREE.Mesh(new THREE.IcosahedronGeometry(h*.42,0),mat(0x3f6a35,{roughness:1}));cr.position.y=h*.66;t.add(cr);
    const cr2=new THREE.Mesh(new THREE.IcosahedronGeometry(h*.3,0),mat(0x4a7a3c,{roughness:1}));cr2.position.set(h*.14,h*.84,h*.1);t.add(cr2);
    return t},
  _palm(h){const p=new THREE.Group();const tr=cyl(.14,.26,h,mat(0x7a5c40),6);tr.position.y=h/2;p.add(tr);
    for(let i=0;i<6;i++){const fr=box(2.6,.08,.5,mat(0x3f7a3a,{roughness:1}));
      fr.position.set(Math.cos(i/6*TAU)*1.1,h,Math.sin(i/6*TAU)*1.1);
      fr.rotation.y=-i/6*TAU;fr.rotation.z=-.35;p.add(fr)}
    return p},
};
/* human figures — pass {v:1} for a unique festival-goer (skin/fit/hair/body variety) */
const SKINS=[0xc9a080,0xa87858,0x8a5a3c,0xe0b89a,0x6a4530];
const NPC_FITS=[[0x8a1218,0x14141a],[0x3a5a7a,0x1c1c24],[0x1c1c24,0x3a3632],[0xd9d9d9,0x2a2a32],
  [0x6a4a7a,0x14141a],[0x2a5a4a,0x24201c],[0xc9a040,0x1c1c24]];
function personFig(c=0x6a5a4a,o={}){
  const p=new THREE.Group();
  const fit=o.v?NPC_FITS[Math.floor(Math.random()*NPC_FITS.length)]:null;
  const shirtC=fit?fit[0]:c,pantC=fit?fit[1]:0x16161a,
        skinC=o.v?SKINS[Math.floor(Math.random()*SKINS.length)]:0x9a7458;
  const b=new THREE.Mesh(new THREE.CapsuleGeometry(.3,.62,3,8),mat(shirtC,{roughness:.85}));b.position.y=1.28;p.add(b);
  const h=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),mat(skinC,{roughness:.75}));h.position.y=1.86;p.add(h);
  [-.12,.12].forEach(x=>{const leg2=box(.15,.8,.17,mat(pantC,{roughness:.9}));leg2.position.set(x,.42,0);p.add(leg2)});
  if(o.v){
    if(Math.random()<.55){const cap2=new THREE.Mesh(new THREE.SphereGeometry(.205,10,6,0,TAU,0,Math.PI/2),
      mat([0x50151a,0x14141a,0x3a3632,0x8a1218][Math.floor(rnd(0,4))],{roughness:.85}));cap2.position.y=1.9;p.add(cap2)}
    else{const hair=new THREE.Mesh(new THREE.SphereGeometry(.215,10,6,0,TAU,0,Math.PI/1.7),
      mat([0x14100c,0x2a1a10,0x3a2214,0x0c0c0c][Math.floor(rnd(0,4))],{roughness:1}));hair.position.y=1.9;p.add(hair)}
    if(Math.random()<.28){const ph2=box(.1,.16,.02,emat(0xbfd4ff,1.6));ph2.position.set(.28,1.7,.16);p.add(ph2)}
    p.scale.setScalar(rnd(.9,1.06));p.scale.y*=rnd(.94,1.06);
  }
  const sh=new THREE.Mesh(new THREE.CircleGeometry(.42,14),
    new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.32,depthWrite:false}));
  sh.rotation.x=-Math.PI/2;sh.position.y=.02;p.add(sh);
  return p}

/* ================= state machine ================= */
const State={phase:'city',city:null,zones:new Set(),world:null,shuttle:null,descent:null};
const tickers=[]; // active per-phase update fns

const {openBoxOffice,renderBoxOffice,chooseEntry}=setupBoxOffice({State,AudioEngine,flash,buildWorld:()=>buildWorld(),triggerDrop:()=>triggerDrop(),toast,rnd});
/* ================= DESCENT (earth) ================= */
function latLon(lat,lon,r){const ph=(90-lat)*Math.PI/180,th=(lon+180)*Math.PI/180;
  return new THREE.Vector3(-r*Math.sin(ph)*Math.cos(th),r*Math.cos(ph),r*Math.sin(ph)*Math.sin(th))}
function startDescentBackdrop(){
  const s=new THREE.Scene();s.background=new THREE.Color(0x010102);
  // stars
  const sp=new Float32Array(2400*3);for(let i=0;i<2400;i++){
    const v=new THREE.Vector3().randomDirection().multiplyScalar(rnd(500,900));sp.set([v.x,v.y,v.z],i*3)}
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
  s.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0x8899bb,size:1.1,sizeAttenuation:false})));
  // earth
  const earth=new THREE.Group();
  const earthMap=new THREE.TextureLoader().load('/assets/images/world/earth.jpg');earthMap.colorSpace=THREE.SRGBColorSpace;earthMap.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const globe=new THREE.Mesh(new THREE.SphereGeometry(60,64,48),new THREE.MeshStandardMaterial({map:earthMap,color:0xffffff,roughness:.95,metalness:0,emissiveMap:earthMap,emissive:0xffffff,emissiveIntensity:.08}));
  earth.add(globe);
  const grid=new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(60.3,24,16)),
    new THREE.LineBasicMaterial({color:0x0e3a4a,transparent:true,opacity:.08}));
  earth.add(grid);
  // Only actual city beacons, rather than random lights across oceans.
  // beacons
  const beacons={};
  Object.entries(CITIES).forEach(([k,c])=>{
    const p=latLon(c.lat,c.lon,61);
    const b=new THREE.Mesh(new THREE.SphereGeometry(.9,8,8),emat(0xFFB45E,3));b.position.copy(p);earth.add(b);
    const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xFFC878,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    gl.scale.set(10,10,1);gl.position.copy(p);earth.add(gl);beacons[k]=b});
  // atmosphere
  const atm=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0x2a6a9a,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending}));
  atm.scale.set(190,190,1);earth.add(atm);
  s.add(earth);
  s.add(new THREE.AmbientLight(0x637a94,1.05));
  const sun=new THREE.DirectionalLight(0xfff2dd,1.6);sun.position.set(100,60,260);s.add(sun);
  camera.position.set(0,10,240);camera.lookAt(0,-70,0);
  useScene(s);bloom.strength=.55;fadeOut(1200);
  State.descent={scene:s,earth,beacons,anim:null,t:0};
  tickers.length=0;
  tickers.push(dt=>{if(!State.descent.anim)earth.rotation.y+=dt*.05;descentAnim(dt)});
}
function descentAnim(dt){
  const D=State.descent;if(!D||!D.anim)return;
  D.t+=dt/D.anim.dur;const t=Math.min(1,D.t),e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  camera.position.lerpVectors(D.anim.from,D.anim.to,e);
  camera.lookAt(D.anim.look);
  if(t>.9)$('#flash').style.opacity=(t-.9)*10;
  if(t>=1){D.anim=null;beginShuttle(State.city)}
}
document.querySelectorAll('.citycard').forEach(c=>c.addEventListener('click',()=>selectCity(c.dataset.city)));
function selectCity(key){
  if(State.phase!=='city')return;
  State.city=key;State.phase='descent';document.body.classList.add('journey-active');
  document.body.classList.add('outside');
  $('#citySel').classList.add('hide');$('#hud').classList.add('on');$('#skipBtn').classList.add('on');
  const D=State.descent,c=CITIES[key];
  // stop idle rotation at a nice angle: rotate earth so beacon faces camera
  const p=latLon(c.lat,c.lon,61);
  D.earth.rotation.y=0;
  const beaconWorld=p.clone();
  const camDir=beaconWorld.clone().normalize();
  D.anim={from:camera.position.clone(),to:camDir.clone().multiplyScalar(66),look:beaconWorld,dur:6};D.t=0;
  toast(`COORDINATES LOCKED — <b>${c.label}</b> · INITIATING ORBITAL DESCENT`);
  AudioEngine.init();
  if(AudioEngine.ready&&AudioEngine.ac.state==='suspended')AudioEngine.ac.resume(); // city click = user gesture
  if(!AudioEngine.on){AudioEngine.on=true;AudioEngine.setVolume(.5);$('#sndChip').textContent='SND ON'}
  AudioEngine.setMuffle(500,2);
}
$('#skipBtn').addEventListener('click',()=>{
  if(State.phase==='descent'&&State.descent.anim){State.descent.t=1;descentAnim(0)}
  else if(State.phase==='shuttle'&&State.shuttle){State.shuttle.u=Math.max(State.shuttle.u,.985)}
});

/* ================= SHUTTLE ================= */
function beginShuttle(cityKey){
  State.phase='shuttle';flash(1,900);
  document.body.classList.add('outside');
  const c=CITIES[cityKey];
  const s=new THREE.Scene();s.background=new THREE.Color(c.skyHor);
  s.fog=new THREE.FogExp2(c.fogC,0.003);
  s.environment=ENV;
  // --- golden hour sky ---
  const sunDir=new THREE.Vector3(-.55,.11,-.62).normalize();
  const sky=new THREE.Mesh(new THREE.SphereGeometry(1400,28,14),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{cT:{value:new THREE.Color(c.skyTop)},cH:{value:new THREE.Color(c.skyHor)},
      cS:{value:new THREE.Color(c.sunC)},cP:{value:new THREE.Color(0x8a6aae)},sunD:{value:sunDir}},
    vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 vP;uniform vec3 cT,cH,cS,cP,sunD;
      void main(){float h=clamp(vP.y*1.7+.1,0.,1.);vec3 col=mix(cH,cT,pow(h,.72));
      col=mix(col,cP,smoothstep(.18,.5,h)*(1.-smoothstep(.5,.95,h))*.32); // soft purple band
      float s=pow(max(dot(vP,sunD),0.),26.);col+=cS*s*.5;
      float s2=pow(max(dot(vP,sunD),0.),380.);col+=vec3(1.,.95,.85)*s2*.9;
      gl_FragColor=vec4(col,1.);}`}));
  s.add(sky);
  const sunSpr=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:c.sunC,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
  sunSpr.scale.set(170,170,1);sunSpr.position.copy(sunDir).multiplyScalar(1150);s.add(sunSpr);
  for(let i=0;i<6;i++){ // sunset clouds
    const cl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:c.cloudC,transparent:true,opacity:rnd(.12,.24),depthWrite:false,fog:false}));
    cl.scale.set(rnd(220,420),rnd(40,80),1);
    cl.position.set(rnd(-900,300),rnd(120,320),rnd(-1200,-200));s.add(cl)}
  const sun=new THREE.DirectionalLight(0xffc9a0,1.25);sun.position.copy(sunDir).multiplyScalar(400);s.add(sun);
  s.add(new THREE.HemisphereLight(c.skyTop,c.ground,.95));
  s.add(new THREE.AmbientLight(0xffe0c8,.3)); // lift the shadows — golden hour, not dusk-dark
  bloom.strength=.3; // no blinding glare outside
  // --- route ---
  const pts=[
    new THREE.Vector3(0,0,0),new THREE.Vector3(60,0,-160),new THREE.Vector3(-40,0,-330),
    new THREE.Vector3(30,0,-520),new THREE.Vector3(-60,0,-700),new THREE.Vector3(20,0,-880),
    new THREE.Vector3(-20,0,-1050),new THREE.Vector3(0,0,-1200)];
  const curve=new THREE.CatmullRomCurve3(pts);
  const N=240,rw=9,posA=[],uvA=[],idxA=[];
  for(let i=0;i<=N;i++){const u=i/N,p=curve.getPointAt(u),tg=curve.getTangentAt(u);
    const side=new THREE.Vector3(-tg.z,0,tg.x).normalize();
    const l=p.clone().addScaledVector(side,-rw),r=p.clone().addScaledVector(side,rw);
    posA.push(l.x,.02,l.z,r.x,.02,r.z);uvA.push(0,u*60,1,u*60);
    if(i<N){const a=i*2;idxA.push(a,a+1,a+2,a+1,a+3,a+2)}}
  const roadG=new THREE.BufferGeometry();
  roadG.setAttribute('position',new THREE.Float32BufferAttribute(posA,3));
  roadG.setAttribute('uv',new THREE.Float32BufferAttribute(uvA,2));
  roadG.setIndex(idxA);roadG.computeVertexNormals();
  const roadTex=canvasTex(64,256,(g,w,h)=>{g.fillStyle='#2e2c2e';g.fillRect(0,0,w,h);
    g.fillStyle='#e8d8a0';g.fillRect(w/2-1,0,2,h*.4)});
  roadTex.wrapS=roadTex.wrapT=THREE.RepeatWrapping;
  s.add(new THREE.Mesh(roadG,new THREE.MeshStandardMaterial({map:roadTex,roughness:.9})));
  const gnd=new THREE.Mesh(new THREE.PlaneGeometry(3000,3000),mat(c.ground,{roughness:1}));
  gnd.rotation.x=-Math.PI/2;gnd.position.y=-.1;s.add(gnd);
  // --- sea + golden reflection (mumbai) ---
  let streak=null;
  if(c.sea){const sea=new THREE.Mesh(new THREE.PlaneGeometry(1600,2600),
    new THREE.MeshStandardMaterial({color:0x2a4a66,roughness:.16,metalness:.85}));
    sea.rotation.x=-Math.PI/2;sea.position.set(-490,-.05,-600);s.add(sea);
    const skTex=canvasTex(128,32,(g,w,h)=>{const gr=g.createLinearGradient(0,0,w,0);
      gr.addColorStop(0,'rgba(255,170,80,0)');gr.addColorStop(.5,'rgba(255,190,110,.9)');gr.addColorStop(1,'rgba(255,170,80,0)');
      g.fillStyle=gr;g.fillRect(0,0,w,h)});
    streak=new THREE.Mesh(new THREE.PlaneGeometry(30,1000),
      new THREE.MeshBasicMaterial({map:skTex,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false}));
    streak.rotation.x=-Math.PI/2;streak.rotation.z=.35;streak.position.set(-190,.05,-540);s.add(streak)}
  // --- buildings (pastel sunset skyline) ---
  const bTex=canvasTex(64,128,(g,w,h)=>{g.fillStyle='#8a8280';g.fillRect(0,0,w,h);
    for(let y=6;y<h-6;y+=10)for(let x=6;x<w-6;x+=10){
      g.fillStyle=Math.random()<.3?(Math.random()<.6?'rgba(255,190,110,.95)':'rgba(200,220,255,.8)'):'rgba(40,40,55,.55)';
      g.fillRect(x,y,5,6)}});
  const bMat=new THREE.MeshStandardMaterial({color:0xffffff,map:bTex,emissive:0xffffff,emissiveMap:bTex,emissiveIntensity:.3,roughness:.85});
  const bGeo=new THREE.BoxGeometry(1,1,1);bGeo.translate(0,.5,0);
  const inst=new THREE.InstancedMesh(bGeo,bMat,380);
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),pv=new THREE.Vector3();
  const col=new THREE.Color();
  let bi=0;
  for(let i=0;i<380&&bi<380;i++){
    const u=Math.random()*.96+.02;
    if(c.landmarks.some(l=>Math.abs(l.u-u)<.045))continue;
    const p=curve.getPointAt(u),tg=curve.getTangentAt(u);
    const side=new THREE.Vector3(-tg.z,0,tg.x);
    const sgn=Math.random()<.5?-1:1;
    if(c.sea&&sgn<0&&Math.random()<.75)continue;
    pv.copy(p).addScaledVector(side,sgn*rnd(18,70));
    const h=rnd(8,58),w=rnd(6,14);
    q.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(tg.x,tg.z)+rnd(-.2,.2));
    sc.set(w,h,w);m4.compose(pv.setY(0),q,sc);inst.setMatrixAt(bi,m4);
    col.setHex(c.pastel[bi%c.pastel.length]);inst.setColorAt(bi,col);bi++;
  }
  inst.count=bi;s.add(inst);
  // --- trees along the route ---
  if(c.treeCount){
    const tGeo=new THREE.CylinderGeometry(.22,.42,3,6);tGeo.translate(0,1.5,0);
    const cGeo=new THREE.IcosahedronGeometry(2.1,0);cGeo.translate(0,4.1,0);
    const tInst=new THREE.InstancedMesh(tGeo,mat(0x5a4432,{roughness:1}),c.treeCount);
    const cInst=new THREE.InstancedMesh(cGeo,mat(0x3f6a35,{roughness:1}),c.treeCount);
    for(let i=0;i<c.treeCount;i++){
      const u=Math.random()*.94+.03;
      const p=curve.getPointAt(u),tg=curve.getTangentAt(u);
      const side=new THREE.Vector3(-tg.z,0,tg.x);
      const sgn=Math.random()<.5?-1:1;
      if(c.sea&&sgn<0){i--;continue}
      pv.copy(p).addScaledVector(side,sgn*rnd(12,55)).setY(0);
      const k=rnd(.8,1.7);sc.set(k,k,k);q.setFromAxisAngle(new THREE.Vector3(0,1,0),rnd(0,TAU));
      m4.compose(pv,q,sc);tInst.setMatrixAt(i,m4);cInst.setMatrixAt(i,m4);
    }
    s.add(tInst,cInst);
  }
  // --- billboards ---
  for(let i=0;i<8;i++){
    const u=.06+i*.115;
    if(c.landmarks.some(l=>Math.abs(l.u-u)<.04))continue;
    const p=curve.getPointAt(u),tg=curve.getTangentAt(u);
    const side=new THREE.Vector3(-tg.z,0,tg.x);const sgn=i%2?1:-1;
    if(c.sea&&sgn<0)continue;
    const bb=new THREE.Group();
    const pole=cyl(.25,.32,9,mat(0x6a625a),8);pole.position.y=4.5;bb.add(pole);
    const panel=box(10,4.4,.4,mat(0x3a3632));panel.position.y=10.6;bb.add(panel);
    const txt=c.bills[i%c.bills.length];
    const face=new THREE.Mesh(new THREE.PlaneGeometry(9.4,3.8),new THREE.MeshBasicMaterial({
      map:canvasTex(512,208,(g,w,h)=>{g.fillStyle='#241a12';g.fillRect(0,0,w,h);
        g.strokeStyle='rgba(255,200,120,.55)';g.lineWidth=6;g.strokeRect(8,8,w-16,h-16);
        let fs=44;g.font=`bold ${fs}px Syncopate,sans-serif`;
        while(g.measureText(txt).width>w-50&&fs>16){fs-=2;g.font=`bold ${fs}px Syncopate,sans-serif`}
        g.textAlign='center';g.textBaseline='middle';
        g.fillStyle=['#FF3B41','#EDEDF2','#FFB0A0'][i%3];g.fillText(txt,w/2,h/2)})}));
    face.position.set(0,10.6,.25);bb.add(face);
    bb.position.copy(p).addScaledVector(side,sgn*15);bb.position.y=0;
    bb.lookAt(p.x,0,p.z);s.add(bb);
  }
  // --- streetlights (poles + warm glows) ---
  const lp=[];const poleGeo=new THREE.CylinderGeometry(.09,.13,5.6,6);poleGeo.translate(0,2.8,0);
  const poles=new THREE.InstancedMesh(poleGeo,mat(0x5a544e),70);
  // city takeover: pole banners on every third streetlight
  const bannerTex=canvasTex(128,256,(g,w,h)=>{g.fillStyle='#D81F26';g.fillRect(0,0,w,h);
    g.strokeStyle='rgba(255,255,255,.5)';g.lineWidth=4;g.strokeRect(6,6,w-12,h-12);
    g.font='bold 26px Syncopate,sans-serif';g.textAlign='center';g.fillStyle='#fff';
    g.fillText('THOSE',w/2,60);g.fillText('WHO',w/2,100);g.fillText('KNOW',w/2,140);
    g.font='bold 17px Syncopate,sans-serif';g.fillStyle='#050507';
    g.fillText('THEY KNOW',w/2,190);g.fillText('2026',w/2,222)});
  const bannerMat=new THREE.MeshBasicMaterial({map:bannerTex,side:THREE.DoubleSide});
  for(let i=0;i<70;i++){const u=i/70;const p=curve.getPointAt(u),tg=curve.getTangentAt(u);
    const side=new THREE.Vector3(-tg.z,0,tg.x);const sgn=i%2?1:-1;
    const q2=p.clone().addScaledVector(side,sgn*10.5);lp.push(q2.x,5.6,q2.z);
    m4.makeTranslation(q2.x,0,q2.z);poles.setMatrixAt(i,m4);
    if(i%3===0){const bn=new THREE.Mesh(new THREE.PlaneGeometry(1.1,2.2),bannerMat);
      bn.position.set(q2.x,4,q2.z);bn.lookAt(p.x,4,p.z);s.add(bn)}}
  s.add(poles);
  // branded bus stops
  [.2,.62].forEach(u=>{
    const p=curve.getPointAt(u),tg=curve.getTangentAt(u);
    const side=new THREE.Vector3(-tg.z,0,tg.x);
    if(c.sea)side.multiplyScalar(1); // keep on land side below
    const bs=new THREE.Group();
    const roofB=box(6,.25,2.4,mat(0x8a8280,{metalness:.5}));roofB.position.y=3;bs.add(roofB);
    [[-2.8],[2.8]].forEach(([x])=>{const pl2=cyl(.08,.1,3,mat(0x6a625a),6);pl2.position.set(x,1.5,0);bs.add(pl2)});
    const poster=new THREE.Mesh(new THREE.PlaneGeometry(2.6,1.8),new THREE.MeshBasicMaterial({
      map:canvasTex(256,176,(g,w,h)=>{g.fillStyle='#050507';g.fillRect(0,0,w,h);
        g.font='bold 24px Syncopate,sans-serif';g.textAlign='center';
        g.fillStyle='#fff';g.fillText('THOSE WHO KNOW',w/2,70);
        g.font='bold 15px Syncopate,sans-serif';g.fillStyle='#FF3B41';g.textAlign='right';
        g.fillText('THEY KNOW',w/2+108,100);
        g.font='12px "IBM Plex Mono",monospace';g.fillStyle='#8B8B9E';g.textAlign='center';
        g.fillText('2026 · IF YOU KNOW YOU KNOW',w/2,150)})}));
    poster.position.set(1.6,1.7,-.9);bs.add(poster);
    const benchB=box(4.6,.12,.9,mat(0x7a5c40,{roughness:.9}));benchB.position.set(0,.85,-.4);bs.add(benchB);
    const wf=personFig(0x4a5a6a);wf.scale.setScalar(.9);wf.position.set(-1.4,0,.3);bs.add(wf);
    bs.position.copy(p).addScaledVector(side,13.5);bs.position.y=0;
    bs.lookAt(p.x,0,p.z);s.add(bs);
  });
  // TWKTK-wrapped taxi + overhead checkpoint gantry
  const gantry=new THREE.Group();
  const gp2=curve.getPointAt(.94),gt2=curve.getTangentAt(.94);
  [[-8],[8]].forEach(([x])=>{const post=cyl(.2,.26,8,mat(0x6a625a),8);post.position.set(x,4,0);gantry.add(post)});
  const gPanel=new THREE.Mesh(new THREE.PlaneGeometry(14,2.4),new THREE.MeshBasicMaterial({
    map:canvasTex(512,88,(g,w,h)=>{g.fillStyle='#050507';g.fillRect(0,0,w,h);
      g.strokeStyle='#FF3B41';g.lineWidth=4;g.strokeRect(4,4,w-8,h-8);
      g.font='bold 34px Syncopate,sans-serif';g.textAlign='center';g.fillStyle='#fff';
      g.fillText('TWKTK  →  CHECKPOINT 07',w/2,56)}),side:THREE.DoubleSide}));
  gPanel.position.y=8.2;gantry.add(gPanel);
  gantry.position.set(gp2.x,0,gp2.z);gantry.rotation.y=Math.atan2(gt2.x,gt2.z);s.add(gantry);
  // building wraps — the city is dressed for TWKTK
  const wrapTex=canvasTex(256,512,(g,w,h)=>{g.fillStyle='#D81F26';g.fillRect(0,0,w,h);
    g.fillStyle='rgba(5,5,7,.25)';for(let y=0;y<h;y+=26)g.fillRect(0,y,w,3);
    g.save();g.translate(w/2,h/2);g.rotate(-Math.PI/2);
    g.font='bold 44px Syncopate,sans-serif';g.textAlign='center';g.fillStyle='#fff';
    g.fillText('THOSE WHO KNOW',0,-10);
    g.font='bold 30px Syncopate,sans-serif';g.fillStyle='#050507';g.fillText('THEY KNOW · 2026',0,36);g.restore()});
  [.34,.72].forEach(u=>{
    const p=curve.getPointAt(u),tg=curve.getTangentAt(u);
    const side=new THREE.Vector3(-tg.z,0,tg.x);const sgn=c.sea?1:(u>.5?-1:1);
    const wrap=new THREE.Mesh(new THREE.PlaneGeometry(15,32),new THREE.MeshBasicMaterial({map:wrapTex}));
    wrap.position.copy(p).addScaledVector(side,sgn*30);wrap.position.y=18;
    wrap.lookAt(p.x,16,p.z);s.add(wrap)});
  // scrolling LED ad screens
  const ads=[];
  [.5,.88].forEach((u,ai)=>{
    const p=curve.getPointAt(u),tg=curve.getTangentAt(u);
    const side=new THREE.Vector3(-tg.z,0,tg.x);const sgn=ai?-1:1;
    if(c.sea&&sgn<0)return;
    const adTex=canvasTex(1024,128,(g,w,h)=>{g.fillStyle='#050507';g.fillRect(0,0,w,h);
      g.font='bold 62px Syncopate,sans-serif';g.textAlign='left';g.fillStyle='#FF3B41';
      g.fillText('THOSE WHO KNOW THEY KNOW · 2026 · ',10,84)});
    adTex.wrapS=THREE.RepeatWrapping;
    const frame2=box(13,5.4,.5,mat(0x2a2a30,{metalness:.6}));
    const scrn=new THREE.Mesh(new THREE.PlaneGeometry(12.4,4.6),new THREE.MeshBasicMaterial({map:adTex}));
    scrn.position.z=.3;
    const gAd=new THREE.Group();gAd.add(frame2,scrn);
    const pole2=cyl(.3,.36,8,mat(0x4a4440),8);pole2.position.y=-6.7;gAd.add(pole2);
    gAd.position.copy(p).addScaledVector(side,sgn*16);gAd.position.y=10;
    gAd.lookAt(p.x,8,p.z);s.add(gAd);ads.push(adTex)});
  // bridge banner over the sea link (mumbai)
  if(c.sea){
    const bp=curve.getPointAt(.58),bt2=curve.getTangentAt(.58);
    const bside=new THREE.Vector3(-bt2.z,0,bt2.x);
    const bridgeBn=new THREE.Mesh(new THREE.PlaneGeometry(24,2.6),new THREE.MeshBasicMaterial({
      map:canvasTex(1024,112,(g,w,h)=>{g.fillStyle='rgba(216,31,38,.92)';g.fillRect(0,0,w,h);
        g.font='bold 52px Syncopate,sans-serif';g.textAlign='center';g.fillStyle='#fff';
        g.fillText('MUMBAI, ARE YOU READY? · 25.07',w/2,72)}),side:THREE.DoubleSide}));
    bridgeBn.position.copy(bp).addScaledVector(bside,-64);bridgeBn.position.y=15.8;
    bridgeBn.rotation.y=Math.atan2(bt2.x,bt2.z)+Math.PI/2;s.add(bridgeBn)}
  // parking gantry near the checkpoint
  const gantry2=gantry.clone();
  const gp3=curve.getPointAt(.975),gt3=curve.getTangentAt(.975);
  gantry2.position.set(gp3.x,0,gp3.z);gantry2.rotation.y=Math.atan2(gt3.x,gt3.z);
  gantry2.children.forEach(ch2=>{if(ch2.isMesh&&ch2.geometry.type==='PlaneGeometry'){
    ch2.material=new THREE.MeshBasicMaterial({map:canvasTex(512,88,(g,w,h)=>{
      g.fillStyle='#050507';g.fillRect(0,0,w,h);
      g.strokeStyle='#FF3B41';g.lineWidth=4;g.strokeRect(4,4,w-8,h-8);
      g.font='bold 34px Syncopate,sans-serif';g.textAlign='center';g.fillStyle='#fff';
      g.fillText('SHUTTLE DROP  ·  TWKTK PARKING →',w/2,56)}),side:THREE.DoubleSide})}});
  s.add(gantry2);
  const lgg=new THREE.BufferGeometry();lgg.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));
  s.add(new THREE.Points(lgg,new THREE.PointsMaterial({map:GLOW,color:0xfff2dc,size:6,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})));
  // --- pedestrians on the promenade ---
  const peds=[];const pedCols=[0x8a4a3a,0x3a5a7a,0x6a5a4a,0x7a4a6a,0x3a6a5a,0x9a7a3a];
  for(let i=0;i<16;i++){
    const pd=personFig(pedCols[i%pedCols.length]);pd.scale.setScalar(rnd(.85,1));
    pd.userData={u:Math.random(),sp:rnd(.0006,.0012)*(i%2?1:-1),off:rnd(11.5,13.5)*(i%3===0?-1:1)};
    if(c.sea&&pd.userData.off<0)pd.userData.off*=-1;
    s.add(pd);peds.push(pd)}
  // --- landmarks ---
  const caps=[];let flyPlane=null;
  c.landmarks.forEach(l=>{
    const p=curve.getPointAt(l.u),tg=curve.getTangentAt(l.u);
    const side=new THREE.Vector3(-tg.z,0,tg.x);
    const g=LB[l.b]();
    g.position.copy(p).addScaledVector(side,l.side*(l.b==='sealink'?0:l.b==='marineDrive'?0:38));
    if(l.b==='sealink'){g.position.addScaledVector(side,-70);g.rotation.y=Math.atan2(tg.x,tg.z)+Math.PI/2}
    else g.lookAt(p.x,g.position.y,p.z);
    s.add(g);caps.push({u:l.u,n:l.n});
    if(g.userData.plane)flyPlane=g.userData.plane;
  });
  // --- traffic, both directions ---
  const carCols=[0xd8d8e0,0x8a4030,0x3a5a7a,0xc9b040,0x707478,0x2a2a30];
  const cars=[];for(let i=0;i<12;i++){
    const car=new THREE.Group();const bodyC=box(2,.9,4.4,mat(carCols[i%carCols.length],{roughness:.5,metalness:.3}));bodyC.position.y=.8;car.add(bodyC);
    const cab=box(1.8,.6,2.2,mat(0x30343a,{roughness:.3,metalness:.5}));cab.position.set(0,1.5,.2);car.add(cab);
    const tl=box(1.6,.2,.1,emat(RED,2));tl.position.set(0,.9,2.25);car.add(tl);
    const hl=box(1.6,.2,.1,emat(0xffeecc,2));hl.position.set(0,.9,-2.25);car.add(hl);
    car.userData.u=Math.random();car.userData.dir=i%3===2?1:-1;
    car.userData.spd=car.userData.dir>0?rnd(.005,.009):rnd(.008,.013);
    s.add(car);cars.push(car)}
  // one TWKTK-wrapped taxi in the flow
  cars[0].children[0].material=mat(0xD81F26,{roughness:.4,metalness:.35});
  const topper=box(.9,.3,.5,emat(0xffffff,1.2));topper.position.set(0,2,.2);cars[0].add(topper);
  // TWKTK-wrapped city bus in the flow
  const bus=new THREE.Group();
  const busBody=box(2.6,3,9.5,mat(0xD81F26,{roughness:.4,metalness:.3}));busBody.position.y=1.7;bus.add(busBody);
  const busWin=box(2.62,.8,7.5,mat(0x30343a,{roughness:.2,metalness:.6}));busWin.position.y=2.5;bus.add(busWin);
  const busAd=new THREE.Mesh(new THREE.PlaneGeometry(7.5,1.4),new THREE.MeshBasicMaterial({
    map:canvasTex(512,96,(g,w,h)=>{g.fillStyle='#D81F26';g.fillRect(0,0,w,h);
      let fs=40;g.font='bold '+fs+'px Syncopate,sans-serif';while(g.measureText('THOSE WHO KNOW THEY KNOW').width>w-28&&fs>12){fs--;g.font='bold '+fs+'px Syncopate,sans-serif';}g.textAlign='center';g.fillStyle='#fff';
      g.fillText('THOSE WHO KNOW THEY KNOW',w/2,60)})}));
  busAd.position.set(1.32,1.4,0);busAd.rotation.y=Math.PI/2;bus.add(busAd);
  const busAd2=busAd.clone();busAd2.position.x=-1.32;busAd2.rotation.y=-Math.PI/2;bus.add(busAd2);
  for(const x of [-1.3,1.3])for(const z of [-2.9,2.9]){const tyre=cyl(.55,.55,.3,mat(0x08080a,{roughness:.96}),20);tyre.rotation.z=Math.PI/2;tyre.position.set(x,.58,z);bus.add(tyre);const hub=cyl(.27,.27,.32,mat(0xb4b4ba,{metalness:.85,roughness:.28}),16);hub.rotation.z=Math.PI/2;hub.position.copy(tyre.position);bus.add(hub);}
  const busWindscreen=box(2.35,1.05,.08,mat(0x243242,{roughness:.12,metalness:.75}));busWindscreen.position.set(0,2.65,-4.8);bus.add(busWindscreen);
  for(const x of [-.9,.9]){const lamp=box(.35,.18,.08,emat(0xffffff,.6));lamp.position.set(x,.98,-4.81);bus.add(lamp);const tail=box(.25,.4,.08,emat(RED,.7));tail.position.set(x,1.05,4.81);bus.add(tail);}
  bus.userData={u:.3,dir:1,spd:.004};s.add(bus);cars.push(bus);
  // --- warehouse at end (dusk industrial, red slit inside) ---
  const wh=new THREE.Group();
  const endP=curve.getPointAt(1),endT=curve.getTangentAt(.99);
  const shell=box(70,26,50,mat(0x6a5c50,{roughness:.9}));shell.position.y=13;wh.add(shell);
  const roofW=box(72,1.4,52,mat(0x4a423a,{roughness:.95}));roofW.position.y=26.4;wh.add(roofW);
  const sign=textSprite('WAREHOUSE 07',{scale:24,color:'#FF3B41'});sign.position.set(0,30,26);wh.add(sign);
  const doorL=box(9,12,1,mat(0x3a3a42,{metalness:.5,roughness:.4}));doorL.position.set(-4.5,6,25.5);wh.add(doorL);
  const doorR=doorL.clone();doorR.position.x=4.5;wh.add(doorR);
  const doorGlow=box(19,12.6,.4,emat(RED,.5));doorGlow.position.set(0,6.2,25.2);wh.add(doorGlow);
  [-11,11].forEach(x=>{const yl=cyl(.14,.18,6,mat(0x5a544e),6);yl.position.set(x,3,27);wh.add(yl);
    const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffd9a0,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    gl.scale.set(4,4,1);gl.position.set(x,6.4,27);wh.add(gl)});
  wh.position.copy(endP).addScaledVector(endT,40);
  wh.lookAt(endP.x,0,endP.z);wh.position.y=0;s.add(wh);
  wh.updateMatrixWorld(true);
  const dirBack=endP.clone().sub(wh.position).setY(0).normalize();
  const doorPos=wh.position.clone().addScaledVector(dirBack,25.5);doorPos.y=0;
  // --- premium shuttle cabin (follows camera) ---
  const cabin=new THREE.Group();
  const frameM=mat(0x2a2622,{roughness:.5,metalness:.3});
  const dash=box(2.4,.5,.7,frameM);dash.position.set(0,-.75,-1.35);cabin.add(dash);
  const dashCv=document.createElement('canvas');dashCv.width=512;dashCv.height=160;
  const dashTex=new THREE.CanvasTexture(dashCv);dashTex.colorSpace=THREE.SRGBColorSpace;
  const dashScr=new THREE.Mesh(new THREE.PlaneGeometry(1.15,.36),new THREE.MeshBasicMaterial({map:dashTex}));
  dashScr.position.set(0,-.52,-1.28);dashScr.rotation.x=-.48;cabin.add(dashScr);
  function drawDash(pct,next){const g=dashCv.getContext('2d');
    g.fillStyle='#140e0a';g.fillRect(0,0,512,160);
    g.strokeStyle='rgba(255,200,120,.4)';g.lineWidth=4;g.strokeRect(6,6,500,148);
    g.font='bold 30px "IBM Plex Mono",monospace';g.fillStyle='#FF3B41';g.textAlign='left';
    g.fillText('TWKTK SHUTTLE 07',24,48);
    g.font='22px "IBM Plex Mono",monospace';g.fillStyle='#EDEDF2';
    g.fillText('NEXT: '+next,24,92);
    g.fillStyle='rgba(255,200,120,.25)';g.fillRect(24,116,464,14);
    g.fillStyle='#FF3B41';g.fillRect(24,116,464*pct/100,14);
    dashTex.needsUpdate=true}
  drawDash(0,'—');
  [[-1.15],[1.15]].forEach(([x])=>{const pillar=box(.12,1.6,.1,frameM);pillar.position.set(x,0,-1.4);cabin.add(pillar)});
  const roof=box(2.5,.1,4,frameM);roof.position.set(0,.95,.5);cabin.add(roof);
  const floorC=box(2.5,.08,4,mat(0x1c1712,{roughness:.9}));floorC.position.set(0,-1,.5);cabin.add(floorC);
  [-1.16,1.16].forEach(x=>{const strip=box(.05,.03,3.8,emat(0xffc9a0,1));strip.position.set(x,.88,.5);cabin.add(strip);
    const rail=cyl(.03,.03,3.6,mat(0xc9c9d2,{metalness:.9,roughness:.15}),8);rail.rotation.x=Math.PI/2;rail.position.set(x,.55,.4);cabin.add(rail)});
  const glassHint=new THREE.Mesh(new THREE.PlaneGeometry(2.3,1.5),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.045,depthWrite:false}));
  glassHint.position.set(0,.1,-1.42);cabin.add(glassHint);
  const glassStreak=new THREE.Mesh(new THREE.PlaneGeometry(.5,1.5),
    new THREE.MeshBasicMaterial({color:0xffe8d0,transparent:true,opacity:.05,depthWrite:false,blending:THREE.AdditiveBlending}));
  glassStreak.position.set(0,.1,-1.41);glassStreak.rotation.z=.35;cabin.add(glassStreak);
  const inLight=new THREE.PointLight(0xffc9a0,3.2,5.5,1.6);inLight.position.set(0,.7,.3);cabin.add(inLight);
  // passengers on two leather benches
  const passengers=[];const leather=mat(0x3a2a22,{roughness:.7});
  [[.85],[1.95]].forEach(([z])=>{
    const bench=box(2.3,.12,.62,leather);bench.position.set(0,-.6,z);cabin.add(bench);
    const back=box(2.3,.62,.1,leather);back.position.set(0,-.32,z+.33);cabin.add(back)});
  [[-.62,.85,0xa04a3a],[.62,.85,0x3a5a7a],[-.62,1.95,0x7a6a4a],[.62,1.95,0x4a4a52]].forEach(([x,z,cc],i)=>{
    const p=personFig(cc);p.scale.setScalar(.72);p.position.set(x,-.68,z);
    cabin.add(p);passengers.push(p)});
  cabin.position.set(0,0,0);s.add(cabin);
  const rig=new THREE.Group();s.add(rig);
  const headlight=new THREE.SpotLight(0xfff4e0,60,80,.55,.5,1.4);
  headlight.position.set(0,1,0);rig.add(headlight);rig.add(headlight.target);
  headlight.target.position.set(0,0,-30);
  useScene(s);
  State.shuttle={scene:s,curve,rig,cabin,u:0,speed:1/75,capIdx:-1,caps,cars,peds,
    doors:{l:doorL,r:doorR,open:0},doorGlow,doorPos,dirBack,arrived:false,flyPlane,
    warehousePos:wh.position.clone(),passengers,drawDash,lastPct:-1,streak,sunSpr,glassStreak,ads};
  camera.position.set(0,2.1,0);camera.rotation.set(0,0,0);
  look.yaw=0;look.pitch=0;
  tickers.length=0;tickers.push(shuttleTick);
  fadeOut(800);
  $('#ctlHint').textContent='DRAG TO LOOK AROUND · THE SHUTTLE KNOWS THE WAY';$('#ctlHint').classList.add('on');
  $('#etaBar').classList.add('on');
  toast(`SHUTTLE 07 EN ROUTE — <b>${c.label}</b> · GOLDEN HOUR · DESTINATION SEALED`,4200);
  AudioEngine.setMuffle(900,2);
}
function shuttleTick(dt){
  const S=State.shuttle;if(!S)return;
  const easeEnd=S.u>.94?clamp((1-S.u)/.06,0.12,1):1;
  S.u=Math.min(1,S.u+S.speed*dt*easeEnd);
  const u=S.u,p=S.curve.getPointAt(u),tg=S.curve.getTangentAt(u);
  S.rig.position.set(p.x,0,p.z);
  S.rig.rotation.y=Math.atan2(-tg.x,-tg.z); // rig -Z axis points along the tangent
  // camera inside rig
  const bob=Math.sin(performance.now()*.008)*.02;
  camera.position.set(S.rig.position.x,2.1+bob,S.rig.position.z);
  const baseYaw=Math.atan2(-tg.x,-tg.z);
  camera.rotation.set(look.pitch*.9,baseYaw+look.yaw,0,'YXZ');
  S.cabin.position.copy(camera.position);S.cabin.rotation.set(0,baseYaw,0,'YXZ');
  // passengers sway with the ride, heads nodding to the radio
  const tNow=performance.now()*.001;
  S.passengers.forEach((pf,i)=>{pf.rotation.z=Math.sin(tNow*1.6+i*1.4)*.05;
    pf.position.y=-.68+Math.sin(tNow*3.1+i)*.012;
    if(pf.children[1])pf.children[1].rotation.x=Math.sin(tNow*2.1+i*2)*.09});
  // window reflection drifting with the turns
  if(S.glassStreak){S.glassStreak.position.x=Math.sin(tNow*.6)*0.8;
    S.glassStreak.material.opacity=.04+Math.abs(Math.sin(tNow*.6))*.04}
  // pedestrians strolling the footpaths
  S.peds.forEach(pd=>{pd.userData.u+=pd.userData.sp*dt*60;
    if(pd.userData.u>1)pd.userData.u-=1;if(pd.userData.u<0)pd.userData.u+=1;
    const pu=pd.userData.u,pp=S.curve.getPointAt(pu),pt=S.curve.getTangentAt(pu);
    const pside=new THREE.Vector3(-pt.z,0,pt.x);
    pd.position.copy(pp).addScaledVector(pside,pd.userData.off);
    pd.position.y=Math.abs(Math.sin(tNow*7+pu*40))*.05;
    pd.rotation.y=Math.atan2(pt.x,pt.z)+(pd.userData.sp>0?0:Math.PI)});
  // dashboard route screen + live ETA HUD
  const pct=Math.min(100,Math.round(u*100));
  if(pct!==S.lastPct){S.lastPct=pct;
    const nx=S.caps.find(cp=>cp.u>u);
    const nxName=nx?nx.n.split('·')[0].split('—')[0].trim():'SECRET VENUE';
    S.drawDash(pct,nxName);
    const secs=Math.max(0,Math.round((1-u)*75));
    $('#etaNext').textContent=nxName;
    $('#etaDist').textContent=((1-u)*7.2).toFixed(1)+' KM';
    $('#etaTime').textContent=Math.floor(secs/60)+':'+String(secs%60).padStart(2,'0');
    $('#etaPct').textContent=pct+'%'}
  // captions
  let ci=-1;S.caps.forEach((cp,i)=>{if(Math.abs(cp.u-u)<.035)ci=i});
  if(ci!==S.capIdx){S.capIdx=ci;const el=$('#caption');
    if(ci>=0){el.querySelector('.cp-name').textContent=S.caps[ci].n;el.classList.add('on');AudioEngine.blip()}
    else el.classList.remove('on')}
  // traffic, both directions
  S.cars.forEach(car=>{
    // dir -1 ⇒ oncoming (u decreases); dir +1 ⇒ same direction (u increases)
    car.userData.u+=car.userData.dir*car.userData.spd*dt*6;
    if(car.userData.u<0)car.userData.u+=1;if(car.userData.u>1)car.userData.u-=1;
    const cu=car.userData.u,cp2=S.curve.getPointAt(cu),ct=S.curve.getTangentAt(cu);
    const side=new THREE.Vector3(-ct.z,0,ct.x);
    car.position.copy(cp2).addScaledVector(side,car.userData.dir>0?4.5:-4.5);car.position.y=0;
    car.rotation.y=Math.atan2(ct.x,ct.z)+(car.userData.dir>0?Math.PI:0)});
  if(S.flyPlane){S.flyPlane.position.x=Math.sin(performance.now()*.0004)*120;S.flyPlane.position.z=Math.cos(performance.now()*.0004)*60}
  if(S.streak)S.streak.material.opacity=.42+Math.sin(performance.now()*.0012)*.12;
  // LED ad tickers crawl
  if(S.ads)S.ads.forEach(a=>{a.offset.x=performance.now()*.00006});
  // arrival
  if(u>=1&&!S.arrived){S.arrived=true;arriveWarehouse()}
}
function arriveWarehouse(){
  const S=State.shuttle;State.phase='arrival';
  $('#caption').classList.remove('on');$('#skipBtn').classList.remove('on');
  $('#ctlHint').classList.remove('on');$('#etaBar').classList.remove('on');
  toast('THE SHUTTLE STOPS — <b>DOORS OPENING</b>',3600);
  // bass bleeds out as the doors part
  AudioEngine.setVolume(.8,4);AudioEngine.setMuffle(2800,4.5);
  const s=S.scene,side=new THREE.Vector3(-S.dirBack.z,0,S.dirBack.x);
  // red light spilling from the doorway
  const spill=new THREE.PointLight(0xff2a30,0,34,1.5);
  spill.position.copy(S.doorPos).addScaledVector(S.dirBack,2);spill.position.y=5;s.add(spill);
  // fog rolling out of the doors
  const fogSpr=[];
  for(let i=0;i<24;i++){
    const f=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xb07078,transparent:true,opacity:0,depthWrite:false}));
    f.scale.set(rnd(6,12),rnd(3,6),1);
    f.userData={t:Math.random(),sp:rnd(.05,.14),dx:rnd(-.5,.5)};
    s.add(f);fogSpr.push(f)}
  // people walking in from the queue
  const walkers=[];
  const wCols=[0x8a4a3a,0x3a5a7a,0x6a5a4a,0x4a4a52,0x7a4a6a,0x3a6a5a];
  for(let i=0;i<6;i++){
    const w=personFig(wCols[i]);
    w.userData={t:i/6*.9,sp:rnd(.06,.1),lane:rnd(-3,3)};
    s.add(w);walkers.push(w)}
  const qStart=S.doorPos.clone().addScaledVector(S.dirBack,22).addScaledVector(side,9);
  let t=0;
  tickers.push(function arrivalTick(dt){
    t+=dt;const k=Math.min(1,t/4.5);
    S.doors.l.position.x=-4.5-k*8.6;S.doors.r.position.x=4.5+k*8.6;
    S.doorGlow.material.emissiveIntensity=.5+k*1.9;
    spill.intensity=k*36+Math.sin(t*9)*3*k; // breathing with the bass
    fogSpr.forEach(f=>{f.userData.t+=dt*f.userData.sp;if(f.userData.t>1)f.userData.t=0;
      const ft=f.userData.t;
      f.position.copy(S.doorPos).addScaledVector(S.dirBack,2+ft*16)
        .addScaledVector(side,f.userData.dx*ft*10);
      f.position.y=1+ft*2.2;
      f.material.opacity=k*.28*Math.sin(ft*Math.PI)});
    walkers.forEach(w=>{w.userData.t+=dt*w.userData.sp;if(w.userData.t>1)w.userData.t=0;
      const wt=w.userData.t;
      w.position.lerpVectors(
        qStart.clone().addScaledVector(side,w.userData.lane),
        S.doorPos.clone().addScaledVector(side,w.userData.lane*.2),wt);
      w.position.y=Math.abs(Math.sin(wt*26))*.05;
      w.lookAt(S.doorPos.x,0,S.doorPos.z);
      w.visible=wt<.97});
    if(k>=.7&&!S.choiceShown){S.choiceShown=true;
      $('#entry').classList.remove('hide')}
  });
}

/* ================= WORLD ================= */
const ZONES=[
  {n:'MAIN STAGE',x:0,z:-44,r:18},{n:'INTERNATIONAL DJ BOOTH',x:0,z:-31,r:8},
  {n:'FAN PIT',x:0,z:-19,r:9},
  {n:'HOLO EXPERIENCE',x:-55,z:-26,r:11},{n:'3D MESH LED ZONE',x:55,z:-26,r:11},
  {n:'FASHION STORE',x:-70,z:4,r:10},{n:'ART INSTALLATION',x:70,z:4,r:10},
  {n:'BRAND ACTIVATION VILLAGE',x:-55,z:32,r:12},{n:'PREMIUM BAR',x:-14,z:44,r:12},
  {n:'ARCADE BAY',x:-38,z:46,r:9},
  {n:'FOOD COURT',x:26,z:44,r:12},{n:'VIP LOUNGE',x:62,z:32,r:14},
  {n:'EM LOUNGE',x:-60,z:-48,r:10},{n:'ON STAGE',x:38,z:-44,r:7},
  {n:'MERCH STORE',x:-84,z:-8,r:11},{n:'PHOTO BOOTH',x:84,z:-6,r:8},
  {n:'BROCODE BEER GARDEN',x:-84,z:20,r:11},{n:'ITC LOUNGE',x:84,z:18,r:10},
  {n:'AWARD GALLERY',x:0,z:88,r:12},
  {n:'TWKTK MUSEUM',x:0,z:102,r:12},
  {n:'AFTER PARTY',x:141,z:40,r:17},
  {n:'THE HIDDEN ROOM',x:20,z:-58,r:5},
];
$('#zoneCount').textContent='0/'+ZONES.length;
const interactables=[]; // {mesh(pick target root), label, action, dist}
function addIx(obj,label,action,dist=7){obj.traverse(o=>{o.userData.ix=interactables.length});
  obj.userData.ix=interactables.length;interactables.push({obj,label,action,dist})}

function buildWorld(){
  State.phase='loading';
  document.body.classList.remove('outside'); // crossing into the TWKTK universe
  $('#loader').classList.remove('hide');
  const s=new THREE.Scene();
  s.background=new THREE.Color(0x030304);
  s.fog=new THREE.FogExp2(0x050508,.008);
  s.environment=ENV;s.environmentIntensity=.45; // IBL — metals, glass and chrome pick up real reflections
  const W=State.world={scene:s,t:0,lasersOn:true,laserHue:0,ledMode:0,holoIdx:0,sitting:null,
    confetti:null,spots:[],lasers:null,led:null,holo:null,artRings:[],fashionDisc:null,
    hiddenDoor:null,hiddenOpen:false,crowd:null,crowdPhases:null,strobe:0,crowdJump:0};
  const steps=[
    ['pouring concrete shell',()=>{
      const hall=new THREE.Group();
      const wallM=surfaceMat(0x28282b,24,12,{tile:6,roughness:.95});
      const flr=new THREE.Mesh(new THREE.PlaneGeometry(200,140),
        surfaceMat(0x29292d,200,140,{tile:8,tiles:true,roughness:.68}));
      flr.receiveShadow=true;
      flr.rotation.x=-Math.PI/2;hall.add(flr);
      const mkWall=(w,h,x,z,ry)=>{const wl=box(w,h,1.5,wallM);wl.position.set(x,h/2,z);wl.rotation.y=ry;hall.add(wl)};
      mkWall(200,26,0,-70,0);
      // south wall split — grand doorway into the TWKTK Museum
      mkWall(88,26,-56,70,0);mkWall(88,26,56,70,0);
      const musLintel=box(24,12,1.5,wallM);musLintel.position.set(0,20,70);hall.add(musLintel);
      const musGlow=box(23.6,.5,.4,emat(0xffc878,1.5));musGlow.position.set(0,14.2,69.2);hall.add(musGlow);
      mkWall(140,26,-100,0,Math.PI/2);
      // east wall split — doorway to the after-party annex at z 36..52
      mkWall(106,26,100,-17,Math.PI/2);mkWall(18,26,100,61,Math.PI/2);
      const lintel=box(16,10,1.5,wallM);lintel.position.set(100,21,44);lintel.rotation.y=Math.PI/2;hall.add(lintel);
      const apGlow=box(15.6,.5,.4,emat(0xffc878,1.6));apGlow.position.set(99,16.2,44);apGlow.rotation.y=Math.PI/2;hall.add(apGlow);
      const apSign=textSprite('AFTER PARTY →',{scale:12,color:'#FF3B41'});apSign.position.set(96,13,44);hall.add(apSign);
      for(let i=0;i<6;i++){const tr=box(198,1.2,1.2,mat(0x101018,{metalness:.6}));tr.position.set(0,24,-60+i*24);hall.add(tr)}
      for(let i=0;i<4;i++){const st=box(198,.35,.2,emat(RED,1.4));st.position.set(0,4+i*6,-69.1);hall.add(st);
        const st2=st.clone();st2.position.z=69.1;hall.add(st2)}
      s.add(hall);
      s.add(new THREE.AmbientLight(0x26262e,1.0));
      const hemi=new THREE.HemisphereLight(0x30203a,0x0a0a12,.55);s.add(hemi);
      // A soft overhead key grounds the rig with a real, animated shadow.
      const key=new THREE.DirectionalLight(0xfff4e9,1.25);key.castShadow=true;
      key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-12;key.shadow.camera.right=12;
      key.shadow.camera.top=12;key.shadow.camera.bottom=-12;key.shadow.camera.near=.5;key.shadow.camera.far=40;
      key.shadow.bias=-.00025;key.shadow.normalBias=.025;key.shadow.radius=3;
      key.position.set(5,11.8,110);key.target.position.set(0,0,106);s.add(key,key.target);W.keyLight=key;
    }],
    ['rigging the main stage',()=>{
      const g=new THREE.Group();g.position.set(0,0,-52);
      const deck=box(80,2.6,16,mat(0x0d0d12,{metalness:.4}));deck.position.y=1.3;g.add(deck);
      const deckLip=box(80.4,.4,16.4,emat(RED,1.2));deckLip.position.y=.3;g.add(deckLip);
      // LED wall shader
      const ledMat=new THREE.ShaderMaterial({
        uniforms:{uT:{value:0},uMode:{value:0},uBeat:{value:0}},
        vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:`varying vec2 vUv;uniform float uT,uBeat;uniform int uMode;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}
        void main(){
          vec2 g=floor(vUv*vec2(72.,32.));vec2 f=fract(vUv*vec2(72.,32.));
          float px=smoothstep(.5,.42,length(f-.5));
          vec3 red=vec3(1.,.16,.18),chrome=vec3(.92,.93,1.);
          vec3 col=vec3(0.);
          if(uMode==0){float v=step(.5,fract(g.x*.07-uT*.6));col=mix(red,vec3(.05),v)*(.4+.6*sin(uT*2.+g.x*.2)*.5+.5);}
          else if(uMode==1){float d=length(vUv-.5)*2.;float r=fract(d*3.-uT*1.2);col=red*smoothstep(.3,.0,r)+chrome*smoothstep(.95,1.,1.-r)*.4;}
          else if(uMode==2){float n=hash(g+floor(uT*8.));col=mix(vec3(.02),red,step(.72,n))+chrome*step(.96,n);}
          else{float w=sin(vUv.x*14.+uT*3.)+sin(vUv.y*10.-uT*2.);col=mix(red,chrome,.5+.5*sin(w+uT));col*=.55;}
          col*=px*(1.+uBeat*1.6);
          gl_FragColor=vec4(col,1.);}`
      });
      const led=new THREE.Mesh(new THREE.PlaneGeometry(74,18),ledMat);
      led.position.set(0,11.5,-7.4);g.add(led);W.led=ledMat;
      // side LED wings angled toward the crowd
      [-1,1].forEach(sgn=>{const wing=new THREE.Mesh(new THREE.PlaneGeometry(18,14),ledMat);
        wing.position.set(sgn*45,9.5,-4);wing.rotation.y=-sgn*.5;g.add(wing)});
      const logo=new THREE.Mesh(new THREE.PlaneGeometry(28,7.2),brandLogoMat());
      logo.position.set(0,24,-6.9);g.add(logo);
      // PA stacks
      [-36,36].forEach(x=>{for(let i=0;i<3;i++){const sp=box(4.4,3.4,3.4,mat(0x0a0a0e));
        sp.position.set(x,2+i*3.6,-2);g.add(sp);
        const cone=cyl(1.1,1.1,.3,emat(0x14141c,.3),12);cone.rotation.x=Math.PI/2;cone.position.set(x,2+i*3.6,-.2);g.add(cone)}});
      s.add(g);
      addIx(led,'CYCLE LED VISUAL',()=>{W.ledMode=(W.ledMode+1)%4;W.led.uniforms.uMode.value=W.ledMode;
        toast(['<b>LED:</b> SIGNAL BARS','<b>LED:</b> RADIAL PULSE','<b>LED:</b> GLITCH NOISE','<b>LED:</b> CHROME WAVE'][W.ledMode]);AudioEngine.blip()},38);
      // stage wash lights
      const wash=new THREE.SpotLight(0xff2a30,260,90,.9,.6,1.4);wash.position.set(0,24,-38);
      wash.target.position.set(0,0,-20);s.add(wash,wash.target);
      const wash2=new THREE.SpotLight(0xffffff,90,90,1.1,.8,1.6);wash2.position.set(0,24,-10);
      wash2.target.position.set(0,0,-30);s.add(wash2,wash2.target);
    }],
    ['hanging moving heads + lasers',()=>{
      // moving-head cones (fake volumetrics)
      const coneG=new THREE.ConeGeometry(3.4,26,14,1,true);coneG.translate(0,-13,0);
      for(let i=0;i<10;i++){
        const cm=amat(i%3===0?0xffffff:REDH,.10);
        const cone=new THREE.Mesh(coneG,cm);
        cone.position.set(-76.5+i*17,24,-60+(i%2)*24+12);
        const head=box(1,1.4,1,mat(0x0c0c12,{metalness:.7}));head.position.copy(cone.position);
        s.add(head,cone);
        const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:i%3===0?0xffffff:REDH,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
        gl.scale.set(5,5,1);gl.position.copy(cone.position);s.add(gl);
        W.spots.push({cone,ph:i*1.3,gl});
      }
      // laser fans from stage — doubled
      const lg=new THREE.Group();
      const lGeo=new THREE.CylinderGeometry(.05,.05,120,4,1,true);lGeo.translate(0,60,0);
      W.laserMats=[];
      for(let i=0;i<20;i++){
        const lm=amat(REDH,.55);
        const l=new THREE.Mesh(lGeo,lm);
        l.position.set(-28.5+i*3,8,-46);l.rotation.z=Math.PI/2.15;
        lg.add(l);W.laserMats.push(lm);
      }
      lg.userData.baseY=8;s.add(lg);W.lasers=lg;
      // ceiling laser array — flat rotating grid under the trusses
      const ceil=new THREE.Group();ceil.position.set(0,21.5,-20);
      const cGeo=new THREE.CylinderGeometry(.045,.045,150,4,1,true);
      for(let i=0;i<12;i++){
        const lm=amat(REDH,.34);
        const l=new THREE.Mesh(cGeo,lm);
        l.rotation.z=Math.PI/2;l.rotation.y=(i/12)*Math.PI;
        ceil.add(l);W.laserMats.push(lm);
      }
      s.add(ceil);W.ceil=ceil;
      // physical console to aim interactions at (beam bounds are huge)
      const console3=new THREE.Group();console3.position.set(-16,0,-28);
      const cbody=box(2.2,2.6,1.4,mat(0x0c0c12,{metalness:.6}));cbody.position.y=1.3;console3.add(cbody);
      const cscr=box(1.8,.9,.1,emat(REDH,1.4));cscr.position.set(0,2.2,.7);cscr.rotation.x=-.4;console3.add(cscr);
      const clbl=textSprite('LASER CONTROL',{scale:6});clbl.position.y=4;console3.add(clbl);
      s.add(console3);
      addIx(console3,'LASERS: TOGGLE / COLOR',()=>{
        if(!W.lasersOn){W.lasersOn=true;lg.visible=true;W.ceil.visible=true;toast('<b>LASERS</b> ONLINE')}
        else{W.laserHue=(W.laserHue+1)%4;
          if(W.laserHue===3){W.lasersOn=false;lg.visible=false;W.ceil.visible=false;toast('<b>LASERS</b> OFFLINE')}
          else{const c=[REDH,0x7ae0ff,0xffffff][W.laserHue];
            W.laserMats.forEach(m=>m.color.setHex(c));toast('<b>LASERS</b> RETUNED')}}
        AudioEngine.blip()},8);
    }],
    ['summoning the crowd',()=>{
      const N2=240;W.crowdN=N2;
      const bodyG=new THREE.CapsuleGeometry(.34,1.05,3,8);bodyG.translate(0,1.05,0);
      const crowd=new THREE.InstancedMesh(bodyG,new THREE.MeshStandardMaterial({color:0x14141a,roughness:.9}),N2);
      const m4=new THREE.Matrix4(),col=new THREE.Color();
      W.crowdPhases=[];W.crowdPos=[];
      for(let i=0;i<N2;i++){
        const a=Math.random()*TAU,r=Math.abs(rnd(-1,1))*30+3;
        const x=clamp(Math.sin(a)*r*1.25,-38,38),z=-30+Math.abs(Math.cos(a))*r*.9+rnd(-4,16);
        m4.setPosition(x,0,z);crowd.setMatrixAt(i,m4);
        col.setHSL(rnd(0,.08),rnd(.1,.5),rnd(.06,.22));crowd.setColorAt(i,col);
        W.crowdPhases.push(rnd(0,TAU));W.crowdPos.push([x,z]);
      }
      s.add(crowd);W.crowd=crowd;
      // heads
      const headG=new THREE.SphereGeometry(.24,8,8);headG.translate(0,1.95,0);
      const heads=new THREE.InstancedMesh(headG,new THREE.MeshStandardMaterial({color:0x191920,roughness:.85}),N2);
      for(let i=0;i<N2;i++){m4.setPosition(W.crowdPos[i][0],0,W.crowdPos[i][1]);heads.setMatrixAt(i,m4)}
      s.add(heads);W.heads=heads;
      // phones held up over the crowd — the festival constellation
      const phN=44,phPos=new Float32Array(phN*3);W.phoneIdx=[];
      for(let i=0;i<phN;i++){const k=Math.floor(Math.random()*N2);W.phoneIdx.push(k);
        phPos.set([W.crowdPos[k][0],2.5,W.crowdPos[k][1]],i*3)}
      const phGeo=new THREE.BufferGeometry();phGeo.setAttribute('position',new THREE.BufferAttribute(phPos,3));
      W.phones=new THREE.Points(phGeo,new THREE.PointsMaterial({map:GLOW,color:0xcfe0ff,size:.7,
        transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending}));
      s.add(W.phones);
    }],
    ['building districts — west wing',()=>{
      // DJ booth
      const dj=new THREE.Group();dj.position.set(0,0,-31);
      const desk=box(10,2.6,3,mat(0x0c0c12,{metalness:.6}));desk.position.y=1.3;dj.add(desk);
      const deskLED=box(10.2,.5,3.2,emat(REDH,1.8));deskLED.position.y=.4;dj.add(deskLED);
      const cdj1=cyl(.8,.8,.2,emat(0x88e0ff,.9),16);cdj1.position.set(-3,2.75,0);dj.add(cdj1);
      const cdj2=cdj1.clone();cdj2.position.x=3;dj.add(cdj2);
      const mixer=box(2.2,.25,1.6,emat(REDH,.8));mixer.position.set(0,2.75,0);dj.add(mixer);
      s.add(dj);
      addIx(dj,'TRIGGER THE DROP',()=>{triggerDrop()},9);
      // HOLO experience
      const holo=new THREE.Group();holo.position.set(-55,0,-26);
      const plinth=cyl(4.5,5.2,1,mat(0x0d0d14,{metalness:.5}),18);plinth.position.y=.5;holo.add(plinth);
      const beam=new THREE.Mesh(new THREE.ConeGeometry(4.4,10,18,1,true),amat(0x8ad4ff,.12));
      beam.position.y=6;beam.rotation.x=Math.PI;holo.add(beam);
      const holoObjs=[
        new THREE.Mesh(new THREE.IcosahedronGeometry(2.2,1),new THREE.MeshBasicMaterial({color:0x9ae2ff,wireframe:true,transparent:true,opacity:.85})),
        new THREE.Mesh(new THREE.TorusKnotGeometry(1.6,.5,64,10),new THREE.MeshBasicMaterial({color:0xff5e66,wireframe:true,transparent:true,opacity:.85})),
        (()=>{const sp=textSprite('TWKTK',{scale:9,color:'#9AE2FF'});return sp})()
      ];
      holoObjs.forEach((o,i)=>{o.position.y=7.5;o.visible=i===0;holo.add(o)});
      W.holoObjs=holoObjs;
      s.add(holo);W.holo=holo;
      addIx(holo,'SWITCH HOLOGRAM',()=>{W.holoIdx=(W.holoIdx+1)%3;
        W.holoObjs.forEach((o,i)=>o.visible=i===W.holoIdx);
        toast(['<b>HOLO:</b> GEOCORE','<b>HOLO:</b> SIGNAL KNOT','<b>HOLO:</b> BRAND GHOST'][W.holoIdx]);AudioEngine.blip()},10);
      // FASHION STORE — realistic mannequins, racks, mirror, trial area
      const fash=new THREE.Group();fash.position.set(-70,0,4);
      const skin=mat(0xd9b89a,{roughness:.6});
      const storeFloor=box(18,.3,14,mat(0xcabfae,{roughness:.4,metalness:.2}));storeFloor.position.y=.15;fash.add(storeFloor);
      const disc=cyl(5.4,5.8,.7,mat(0xe8e2d6,{roughness:.35,metalness:.3}),24);disc.position.y=.65;fash.add(disc);
      const spinner=new THREE.Group();spinner.position.y=0;
      const outfits=[
        (mq)=>{const dress=new THREE.Mesh(new THREE.ConeGeometry(.75,1.9,10),mat(0xD81F26,{roughness:.5}));dress.position.y=2.55;mq.add(dress)},
        (mq)=>{const jk=box(.62,1,.34,mat(0xd9d9d9,{metalness:.85,roughness:.25}));jk.position.y=3;mq.add(jk);
          const pants=box(.5,1.15,.3,mat(0x2a2a32));pants.position.y=1.95;mq.add(pants)},
        (mq)=>{const suit=box(.6,1.05,.32,mat(0x1c1c24,{roughness:.5}));suit.position.y=3;mq.add(suit);
          const pants2=box(.5,1.15,.3,mat(0x1c1c24));pants2.position.y=1.95;mq.add(pants2)},
        (mq)=>{const tee=box(.6,.8,.32,mat(0xf2f2f2,{roughness:.7}));tee.position.y=3.1;mq.add(tee);
          const cargo=box(.52,1.2,.32,mat(0x5a5648));cargo.position.y=1.95;mq.add(cargo)}];
      for(let i=0;i<4;i++){const a=i/4*TAU;
        const mq=new THREE.Group();
        const legs=cyl(.16,.2,1.5,skin,8);legs.position.y=1.75;mq.add(legs);
        const torso=cyl(.26,.3,1.1,skin,10);torso.position.y=3;mq.add(torso);
        const hd=new THREE.Mesh(new THREE.SphereGeometry(.24,10,10),skin);hd.position.y=3.9;mq.add(hd);
        outfits[i](mq);
        const base2=cyl(.4,.5,.12,mat(0xd9d9d9,{metalness:.9}),10);base2.position.y=1;mq.add(base2);
        mq.position.set(Math.cos(a)*3.3,0,Math.sin(a)*3.3);mq.rotation.y=-a+Math.PI/2;spinner.add(mq)}
      fash.add(spinner);W.fashionDisc=spinner;
      // clothing racks
      [[-7.5,-4],[-7.5,3]].forEach(([x,z])=>{
        const bar2=cyl(.04,.04,5,mat(0xd9d9d9,{metalness:.95}),8);bar2.rotation.x=Math.PI/2;bar2.position.set(x,2.6,z);fash.add(bar2);
        [[-1.8],[-.9],[0],[.9],[1.8]].forEach(([o],k)=>{
          const gm=new THREE.Mesh(new THREE.PlaneGeometry(.7,1.1),
            mat([0xD81F26,0xf2f2f2,0x1c1c24,0xd9d9d9,0xb08a5a][k],{roughness:.8,side:THREE.DoubleSide}));
          gm.position.set(x,2,z+o);gm.rotation.y=Math.PI/2;fash.add(gm)})});
      // interactive mirror + trial booth
      const mirror=new THREE.Mesh(new THREE.PlaneGeometry(2.6,4.4),
        new THREE.MeshStandardMaterial({color:0xc8d0da,metalness:1,roughness:.04}));
      mirror.position.set(7.6,2.5,-3);mirror.rotation.y=-Math.PI/2.4;fash.add(mirror);
      const mFrame=box(3,4.8,.15,goldM);mFrame.position.set(7.8,2.5,-3.05);mFrame.rotation.y=-Math.PI/2.4;fash.add(mFrame);
      const booth=box(3,4.6,3,mat(0x3a2a30,{roughness:.8}));booth.position.set(7,2.3,4);fash.add(booth);
      const curt=box(2.6,3.8,.1,mat(0xD81F26,{roughness:.95}));curt.position.set(7,2.1,2.45);fash.add(curt);
      const neonF=new THREE.Mesh(new THREE.TorusGeometry(6.4,.09,6,40),emat(0xff9ab0,1.5));
      neonF.rotation.x=Math.PI/2;neonF.position.y=6;fash.add(neonF);
      const fsign=textSprite('AFTERS AT — FASHION',{scale:13,color:'#FFFFFF'});fsign.position.set(0,9,0);fash.add(fsign);
      s.add(fash);W.fashionSpd=.4;
      addIx(fash,'SPIN THE RUNWAY',()=>{W.fashionSpd=W.fashionSpd>2?-.6:W.fashionSpd+.8;
        toast('<b>AFTERS AT</b> — CHROME COLLECTION ROTATION ADJUSTED');AudioEngine.blip()},11);
      addIx(mirror,'INTERACTIVE MIRROR',()=>{flash(.5,300);
        toast('<b>MIRROR CHECK</b> — verdict: ready for the night. If you know, you wear it.');AudioEngine.blip()},5);
      addIx(booth,'CHANGING ROOM — TRY A FIT',()=>openWardrobe(),4.5);
      // Brand village
      const bv=new THREE.Group();bv.position.set(-55,0,32);
      const brands=['THOSE WHO KNOW THEY KNOW','AUTOMOTIVE — OPEN','ALCOBEV — OPEN','YOUR BRAND HERE'];
      brands.forEach((b,i)=>{
        const k=new THREE.Group();
        const kiosk=box(7,5,4,mat(0x0f0f16));kiosk.position.y=2.5;k.add(kiosk);
        const face=new THREE.Mesh(new THREE.PlaneGeometry(6.4,2.6),new THREE.MeshBasicMaterial({
          map:canvasTex(512,208,(g,w,h)=>{g.fillStyle='#08080c';g.fillRect(0,0,w,h);
            g.strokeStyle='#D81F26';g.lineWidth=6;g.strokeRect(8,8,w-16,h-16);
            g.textAlign='center';g.textBaseline='middle';g.shadowColor='#FF3B41';g.shadowBlur=16;
            if(i===0){
              let fs=32;g.font=`bold ${fs}px Syncopate,sans-serif`;
              while(g.measureText('THOSE WHO KNOW').width>w-60){fs--;g.font=`bold ${fs}px Syncopate,sans-serif`}
              g.fillStyle='#FFFFFF';g.fillText('THOSE WHO KNOW',w/2,85);
              g.font='bold 20px Syncopate,sans-serif';g.fillStyle='#FF3B41';g.fillText('THEY KNOW',w/2,135);
            }else{
              let fs=34;g.font=`bold ${fs}px Syncopate,sans-serif`;
              while(g.measureText(b).width>w-60&&fs>12){fs--;g.font=`bold ${fs}px Syncopate,sans-serif`}
              g.fillStyle='#FF3B41';g.fillText(b,w/2,h/2);
            }})}));
        face.position.set(0,3.2,2.05);k.add(face);
        k.position.set((i%2)*10-5,0,Math.floor(i/2)*8-4);bv.add(k)});
      s.add(bv);
      addIx(bv,'INSPECT ACTIVATIONS',()=>toast('<b>BRAND ACTIVATION VILLAGE</b> — own a zone, the shuttle journey, or the reveal moment itself. Slots: AUTOMOTIVE · ALCOBEV · FASHION · TECH'),13);
      // Merch store
      const ms=new THREE.Group();ms.position.set(-84,0,-8);
      const shopfront=box(12,7,8,mat(0x0e0e14));shopfront.position.y=3.5;ms.add(shopfront);
      const msign=textSprite('AFTERS AT',{scale:10,color:'#EDEDF2'});msign.position.set(0,8.2,0);ms.add(msign);
      const teeT=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#0b0b0f';g.fillRect(0,0,w,h);
        g.font='bold 42px Syncopate,sans-serif';g.textAlign='center';g.fillStyle='#FF3B41';
        g.shadowColor='#FF3B41';g.shadowBlur=18;g.fillText('BEYOND',w/2,h/2-14);g.fillText('SOUND',w/2,h/2+38)});
      const tee=new THREE.Mesh(new THREE.PlaneGeometry(3,3.4),new THREE.MeshBasicMaterial({map:teeT}));
      tee.position.set(0,3.6,4.15);ms.add(tee);W.merchTee=tee;
      s.add(ms);
      addIx(ms,'BROWSE THE DROP',()=>toast('<b>DROP 01</b> — Oversized tee · zip hoodie · reflective cap. Chrome print, heavyweight. IF YOU KNOW, YOU WEAR IT.'),12);
    }],
    ['building districts — east wing',()=>{
      // 3D Mesh LED zone — walk-through curtains
      const mz=new THREE.Group();mz.position.set(55,0,-26);
      const dotTex=canvasTex(128,128,(g,w,h)=>{g.fillStyle='rgba(0,0,0,0)';g.clearRect(0,0,w,h);
        for(let y=8;y<h;y+=16)for(let x=8;x<w;x+=16){g.fillStyle='rgba(255,60,66,.9)';g.beginPath();g.arc(x,y,2.4,0,TAU);g.fill()}});
      dotTex.wrapS=dotTex.wrapT=THREE.RepeatWrapping;dotTex.repeat.set(6,3);
      W.meshMats=[];
      for(let i=0;i<3;i++){
        const mm=new THREE.MeshBasicMaterial({map:dotTex,transparent:true,opacity:.75,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false});
        const cur=new THREE.Mesh(new THREE.PlaneGeometry(18-i*4,10),mm);
        cur.position.set(0,5.2,-6+i*6);mz.add(cur);W.meshMats.push(mm)}
      s.add(mz);
      addIx(mz,'PULSE THE MESH',()=>{W.meshPulse=1.6;toast('<b>3D MESH LED</b> — waveform injected');AudioEngine.blip()},12);
      // Art installation — kinetic rings
      const art=new THREE.Group();art.position.set(70,0,4);
      const ped=cyl(3,3.6,1,mat(0x0d0d14,{metalness:.5}),16);ped.position.y=.5;art.add(ped);
      for(let i=0;i<3;i++){
        const ring=new THREE.Mesh(new THREE.TorusGeometry(2.2+i*1.1,.12,8,40),
          new THREE.MeshStandardMaterial({color:0xAEAEC0,metalness:.95,roughness:.2,emissive:0x331113,emissiveIntensity:.4}));
        ring.position.y=5.4;art.add(ring);W.artRings.push(ring)}
      s.add(art);W.artDir=1;
      addIx(art,'REVERSE THE KINETIC',()=>{W.artDir*=-1;toast('<b>UNTITLED 07</b> — kinetic chrome, reversed');AudioEngine.blip()},9);
      // Premium bar
      const bar=new THREE.Group();bar.position.set(-14,0,44);
      const counter=box(16,2.4,3,mat(0x101016,{metalness:.5}));counter.position.y=1.2;bar.add(counter);
      const counterLED=box(16.2,.4,3.2,emat(REDH,1.5));counterLED.position.y=.3;bar.add(counterLED);
      const shelf=box(16,6,1,mat(0x0c0c12));shelf.position.set(0,3,-4);bar.add(shelf);
      const botG=new THREE.CylinderGeometry(.18,.22,1.1,8);
      const bots=new THREE.InstancedMesh(botG,emat(0xffb45e,.8),24);
      const bm=new THREE.Matrix4();
      for(let i=0;i<24;i++){bm.setPosition(-7+(i%12)*1.27,4.2+Math.floor(i/12)*1.6,-3.9);bots.setMatrixAt(i,bm)}
      bar.add(bots);s.add(bar);
      addIx(bar,'ORDER THE SIGNATURE',()=>{toast('<b>CHROME SOUR</b> poured — smoked silver rim, zero questions asked ✓');AudioEngine.blip()},9);
      // FOOD COURT — menus, prices, wait times, seating, people eating
      const food=new THREE.Group();food.position.set(26,0,44);
      const stalls=[
        {n:'RAMEN LAB',c:0xffd25e,items:[['MIDNIGHT TONKOTSU','450'],['SPICY MISO','420'],['GYOZA x6','280']],wait:'~6 MIN'},
        {n:'SMASH HOUSE',c:0xff6a5e,items:[['DOUBLE SMASH','390'],['TANDOOR STACK','420'],['LOADED FRIES','240']],wait:'~8 MIN'},
        {n:'CHAAT LAB',c:0x7ae0ff,items:[['VEGAN BHEL 2.0','190'],['DAHI PURI','210'],['4AM ESPRESSO','160']],wait:'~3 MIN'}];
      stalls.forEach((st2,i)=>{
        const x=-9+i*9;
        const stall=box(7,4.6,4,mat(0x241f1a,{roughness:.8}));stall.position.set(x,2.3,0);food.add(stall);
        const counterF=box(7.2,.4,4.2,mat(0x9a7a4a,{roughness:.6}));counterF.position.set(x,2.2,0);food.add(counterF);
        const awn=box(7.4,.3,4.8,emat(st2.c,1.3));awn.position.set(x,4.9,0);food.add(awn);
        const board=new THREE.Mesh(new THREE.PlaneGeometry(5.6,3.4),new THREE.MeshBasicMaterial({
          map:canvasTex(288,176,(g,w,h)=>{g.fillStyle='#141210';g.fillRect(0,0,w,h);
            g.fillStyle='#'+st2.c.toString(16).padStart(6,'0');g.fillRect(0,0,w,34);
            g.font='bold 20px Syncopate,sans-serif';g.fillStyle='#141210';g.textAlign='center';g.fillText(st2.n,w/2,25);
            g.textAlign='left';g.font='14px "IBM Plex Mono",monospace';g.fillStyle='#EDEDF2';
            st2.items.forEach(([nm,pr],k)=>{g.fillText(nm,12,62+k*26);g.textAlign='right';g.fillText('₹'+pr,w-12,62+k*26);g.textAlign='left'});
            g.fillStyle='#FF3B41';g.fillText('WAIT '+st2.wait,12,h-14);
            g.beginPath();g.arc(w-30,h-20,11,0,TAU);g.fillStyle='#'+st2.c.toString(16).padStart(6,'0');g.fill()})}));
        board.position.set(x,3.4,2.15);food.add(board);
        // prep animation: sizzling patty / shaker bobbing on the counter
        const prep=box(.5,.16,.5,emat(st2.c,.8));prep.position.set(x-2,2.5,.8);food.add(prep);
        (W.prepProps=W.prepProps||[]).push(prep);
        const chef=personFig(0xf2f2f2);chef.scale.setScalar(.9);chef.position.set(x,0,-1.2);food.add(chef)});
      // seating: tables + eaters
      [[-6,8],[2,9.5],[9,8]].forEach(([x,z],ti)=>{
        const tb=cyl(1.2,1.2,.09,mat(0x9a7a4a,{roughness:.6}),12);tb.position.set(x,1.55,z);food.add(tb);
        const lg2=cyl(.08,.12,1.5,mat(0x3a3632),8);lg2.position.set(x,.78,z);food.add(lg2);
        for(let k=0;k<2;k++){const e2=personFig([0x4a5a6a,0x6a4a3a,0x3a5a4a][ (ti+k)%3]);
          e2.scale.setScalar(.82);e2.position.set(x+ (k?1.3:-1.3),0,z+(k?-.4:.4));
          e2.rotation.y=k?-Math.PI/2:Math.PI/2;food.add(e2);(W.eaters=W.eaters||[]).push(e2)}});
      s.add(food);W.steamAnchor=new THREE.Vector3(26,4,44);
      addIx(food,'BROWSE THE FOOD COURT',()=>toast('<b>FOOD COURT</b> — Ramen Lab · Smash House · Chaat Lab. Fresh, fast, and open till sunrise.'),12);
      // VIP lounge — luxury tier: velvet, gold LED, glass rail, bottle service
      const vip=new THREE.Group();vip.position.set(62,0,32);
      const plat=box(22,1.2,16,mat(0x1a161c,{metalness:.45,roughness:.3}));plat.position.y=.6;vip.add(plat);
      const plat2=box(16,1,9,mat(0x201a22,{metalness:.45,roughness:.3}));plat2.position.set(0,1.7,-3);vip.add(plat2);
      [[22.4,.25,16.4,1.25],[16.4,.25,9.4,2.25]].forEach(([w2,h2,d2,y2])=>{
        const trim=box(w2,h2,d2,emat(0xffc878,1.6));trim.position.y=y2;vip.add(trim)});
      const velvet=mat(0x3a1016,{roughness:.55}),goldT=mat(0xd8a848,{metalness:.9,roughness:.25});
      for(let i=0;i<3;i++){
        const sofa=box(4.6,1.5,2.1,velvet);sofa.position.set(-5.5+i*5.5,2.9,-4.2);vip.add(sofa);
        const back=box(4.6,1.5,.55,velvet);back.position.set(-5.5+i*5.5,3.7,-5.2);vip.add(back);
        const trim2=box(4.7,.12,2.2,goldT);trim2.position.set(-5.5+i*5.5,2.2,-4.2);vip.add(trim2)}
      // bottle-service table: chrome bucket, gold bottles, sparkler
      const vtab=cyl(1.5,1.5,.12,mat(0xd9d9d9,{metalness:.95,roughness:.08}),16);vtab.position.set(0,2.9,0);vip.add(vtab);
      const vleg=cyl(.12,.16,1.6,goldT,8);vleg.position.set(0,2,0);vip.add(vleg);
      const bucket=cyl(.42,.3,.55,mat(0xd9d9d9,{metalness:.95,roughness:.1}),12);bucket.position.set(.5,3.25,0);vip.add(bucket);
      for(let i=0;i<3;i++){const bt=cyl(.09,.11,.7,mat(0x1a2a18,{roughness:.25}),8);
        bt.position.set(-.5+i*.35,3.4,.3);vip.add(bt);
        const neck=cyl(.04,.05,.25,goldT,6);neck.position.set(-.5+i*.35,3.85,.3);vip.add(neck)}
      const spark=new THREE.Mesh(new THREE.ConeGeometry(.16,.8,8),emat(0xffe0a0,2.6));spark.position.set(.5,3.95,0);vip.add(spark);
      // glass rail on the stage-view edge — lean here, look over the floor to the stage
      for(let i=0;i<5;i++){const gp=box(.09,1.2,.09,mat(0xd9d9d9,{metalness:.9}));gp.position.set(-10+i*5,1.85,-7.9);vip.add(gp)}
      const grail=box(20.4,.8,.08,new THREE.MeshStandardMaterial({color:0xbfd4ff,transparent:true,opacity:.18,roughness:.05,metalness:.6}));
      grail.position.set(0,1.9,-7.9);vip.add(grail);
      // chandelier cluster
      for(let i=0;i<7;i++){const orb=new THREE.Mesh(new THREE.SphereGeometry(.14,6,6),emat(0xffe0b0,2));
        orb.position.set(rnd(-1.2,1.2),rnd(6.2,7.4),rnd(-1,1));vip.add(orb)}
      const vsign=textSprite('VIP',{scale:7,color:'#FFD25E'});vsign.position.set(0,9,0);vip.add(vsign);
      s.add(vip);
      addIx(vip,'SIT IN THE LOUNGE',()=>{
        if(W.sitting){W.sitting=null;toast('You rise. The night continues.')}
        else{W.sitting={x:62-6+Math.floor(rnd(0,3))*6,z:27.5,y:2.9};
          toast('<b>VIP LOUNGE</b> — velvet, gold, and the best view of the stage. Move to stand up.')}
        AudioEngine.blip()},11);
      addIx(vtab,'BOTTLE SERVICE',()=>{toast('<b>BOTTLE SERVICE</b> — sparklers lit, table hosted. This is why it says VIP on the wristband.');AudioEngine.blip()},5);
      // Photo booth
      const pb=new THREE.Group();pb.position.set(84,0,-6);
      const frame=box(8,8,1,mat(0x0e0e14));frame.position.y=4;pb.add(frame);
      const neonP=new THREE.Mesh(new THREE.TorusGeometry(3.2,.12,8,4),emat(REDH,2));
      neonP.rotation.z=Math.PI/4;neonP.position.set(0,4,.6);pb.add(neonP);
      const psign=textSprite('PROOF YOU WERE NEVER HERE',{scale:12,color:'#FF3B41'});psign.position.set(0,9,0);pb.add(psign);
      s.add(pb);
      addIx(pb,'TAKE THE PHOTO',()=>{takePhoto()},9);
    }],
    ['tapping kegs + lighting lounges',()=>{
      const chrome3=mat(0xd9d9d9,{metalness:.95,roughness:.12});
      // ---- BROCODE BEER GARDEN (west wall) ----
      const bg=new THREE.Group();bg.position.set(-84,0,20);bg.rotation.y=Math.PI/2;
      const cnt=box(12,2.4,3,mat(0x141416,{metalness:.5,roughness:.35}));cnt.position.y=1.2;bg.add(cnt);
      const cntLED=box(12.2,.35,3.2,emat(0xffb445,1.4));cntLED.position.y=.28;bg.add(cntLED);W.brocodeLED=cntLED;
      const backB=box(12,5.5,1,mat(0x101012));backB.position.set(0,2.75,-3.4);bg.add(backB);
      const shelfG=box(10,.15,.8,goldM);shelfG.position.set(0,3.6,-3.1);bg.add(shelfG);
      for(let i=0;i<8;i++){const bot=cyl(.13,.15,.75,emat(0xffc060,.7),8);bot.position.set(-4.2+i*1.2,4.1,-3.1);bg.add(bot)}
      for(let i=0;i<4;i++){const tap=cyl(.09,.09,.9,chrome3,8);tap.position.set(-3+i*2,2.85,.6);bg.add(tap);
        const handle=box(.18,.34,.18,mat(0xa03830,{roughness:.4}));handle.position.set(-3+i*2,3.45,.6);bg.add(handle)}
      const bcSign=textSprite('BROCODE',{scale:13,color:'#FFFFFF'});bcSign.position.set(0,8.8,-3);bg.add(bcSign);
      const bcSub=textSprite('BEER GARDEN',{scale:9,color:'#FFB445'});bcSub.position.set(0,7.2,-3);bg.add(bcSub);
      const menu=new THREE.Mesh(new THREE.PlaneGeometry(4.6,3),new THREE.MeshBasicMaterial({
        map:canvasTex(256,168,(g,w,h)=>{g.fillStyle='#0a0a0c';g.fillRect(0,0,w,h);
          g.strokeStyle='#FFB445';g.lineWidth=4;g.strokeRect(4,4,w-8,h-8);
          g.font='bold 20px Syncopate,sans-serif';g.fillStyle='#fff';g.textAlign='left';
          g.fillText('ON TAP TONIGHT',14,32);
          g.font='15px "IBM Plex Mono",monospace';g.fillStyle='#FF3B41';
          ['DRAFT PILS ......... 350','WHEAT BREW ......... 400','FESTIVAL IPA ....... 450','3L TOWER .......... 1500'].forEach((l,i)=>g.fillText(l,14,64+i*24))})}));
      menu.position.set(4.2,4.4,-2.85);bg.add(menu);
      for(let i=0;i<3;i++){ // high tables
        const ht=cyl(.9,.9,.09,mat(0x1c1c20,{metalness:.4}),12);ht.position.set(-4+i*4,2.1,4.6);bg.add(ht);
        const pole=cyl(.07,.1,2.1,chrome3,8);pole.position.set(-4+i*4,1.05,4.6);bg.add(pole);
        const mug=cyl(.14,.12,.3,emat(0xffc060,.9),8);mug.position.set(-3.7+i*4,2.3,4.5);bg.add(mug)}
      const bench=box(7,.8,1.6,mat(0x241c14,{roughness:.7}));bench.position.set(0,.4,8.4);bg.add(bench);
      [[-4.6,3.9,.6],[-3.4,4.4,-.9],[.4,3.8,.5],[1.6,4.5,-.7],[4.6,4,.4],[5.4,4.8,-.8]].forEach(([x,z,ry],i)=>{
        const f=personFig([0x2a2a32,0x3a2a22,0x26262e][i%3]);f.position.set(x,0,z+2);f.rotation.y=ry;bg.add(f)});
      const strand=[];for(let i=0;i<14;i++)strand.push(-6+i*.92,6.4-Math.sin(i/13*Math.PI)*.9,2.5);
      const sgeo=new THREE.BufferGeometry();sgeo.setAttribute('position',new THREE.Float32BufferAttribute(strand,3));
      bg.add(new THREE.Points(sgeo,new THREE.PointsMaterial({map:GLOW,color:0xffd9a0,size:1.8,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})));
      s.add(bg);
      addIx(bg,'POUR A BROCODE',()=>{W.brocodePulse=1.6;
        toast('<b>BROCODE</b> DRAFT POURED — ice cold, straight off the tap. Cheers.');AudioEngine.blip()},12);
      // ---- ITC LOUNGE (east wall, premium smoking lounge, 18+) ----
      const itc=new THREE.Group();itc.position.set(84,0,18);itc.rotation.y=-Math.PI/2;
      const ipl=box(16,.8,12,mat(0x1c1814,{metalness:.35,roughness:.35}));ipl.position.y=.4;itc.add(ipl);
      const iTrim=box(16.3,.18,12.3,emat(0xd8a848,1.2));iTrim.position.y=.85;itc.add(iTrim);
      const ileather=mat(0x2a1c12,{roughness:.5});
      [[-4,-3],[4,-3]].forEach(([x,z])=>{
        const sofa=box(4.4,1.3,1.9,ileather);sofa.position.set(x,1.45,z);itc.add(sofa);
        const back=box(4.4,1.3,.5,ileather);back.position.set(x,2.2,z-1);itc.add(back)});
      [[-5.5,2.4],[5.5,2.4]].forEach(([x,z])=>{
        const ch=box(1.8,1.3,1.8,ileather);ch.position.set(x,1.45,z);itc.add(ch)});
      const itab=cyl(1.2,1.2,.14,marble,14);itab.position.set(0,1.7,0);itc.add(itab);
      const ileg=cyl(.1,.14,1,goldM,8);ileg.position.set(0,1.2,0);itc.add(ileg);
      [[-6.8,4.6],[6.8,4.6]].forEach(([x,z])=>{ // floor lamps, soft light
        const lp2=cyl(.06,.09,3.4,goldM,8);lp2.position.set(x,2.1,z);itc.add(lp2);
        const orb=new THREE.Mesh(new THREE.SphereGeometry(.32,8,8),emat(0xffe0b0,1.8));orb.position.set(x,4,z);itc.add(orb)});
      [[-7.4,-4.6],[7.4,-4.6]].forEach(([x,z])=>{ // planters
        const pot=cyl(.5,.4,.7,mat(0x2c2c30),8);pot.position.set(x,.75,z);itc.add(pot);
        const pl=new THREE.Mesh(new THREE.IcosahedronGeometry(.6,0),mat(0x2e4a2c,{roughness:1}));pl.position.set(x,1.5,z);itc.add(pl)});
      const host=box(5,2.2,1.6,mat(0x18141a,{metalness:.5,roughness:.3}));host.position.set(0,1.1,-5.4);itc.add(host);
      const hostLED=box(5.1,.3,1.7,emat(0xd8a848,1.1));hostLED.position.set(0,.25,-5.4);itc.add(hostLED);
      const iSign=textSprite('THE LOUNGE',{scale:11,color:'#FFFFFF'});iSign.position.set(0,8.4,-4);itc.add(iSign);
      const iSub=textSprite('BY ITC · STRICTLY 18+',{scale:8,color:'#D8A848'});iSub.position.set(0,7,-4);itc.add(iSub);
      s.add(itc);
      addIx(itc,'STEP INTO THE LOUNGE',()=>{
        toast('<b>THE LOUNGE by ITC</b> — hosted hospitality, low light, good conversation. Strictly 18+.');AudioEngine.blip()},12);
      // ---- warm light so the premium zones are never black voids ----
      [[-14,6,44,0xff9a60,18,22],[26,6,44,0xffd25e,14,22],[62,7,32,0xffc878,24,28],
       [-84,6,20,0xffb445,18,24],[84,6,18,0xffe0b0,16,22],[-70,7,4,0xfff2e0,14,20],
       [-84,6,-8,0xffd9b0,10,16],[-38,6,46,0xff6a5e,12,18]].forEach(([x,y2,z,cHex,i2,d])=>{
        const L=new THREE.PointLight(cHex,i2,d,1.7);L.position.set(x,y2,z);s.add(L)});
    }],
    ['curating the TWKTK museum',()=>{
      // ---- museum wing: shuttle bay → timeline → editions → awards → experiences → arch ----
      const mus=new THREE.Group();
      const musWallM=surfaceMat(0x363333,12,8,{tile:5,roughness:.9});
      const musFloor=new THREE.Mesh(new THREE.PlaneGeometry(64,44),
        surfaceMat(0x9b9691,64,44,{tile:3,tiles:true,roughness:.62}));
      musFloor.receiveShadow=true;
      musFloor.rotation.x=-Math.PI/2;musFloor.position.set(0,.02,91);mus.add(musFloor);
      const runner=box(8,.04,42,mat(0x7a1418,{roughness:.9}));runner.position.set(0,.06,91);mus.add(runner);
      // side walls sit flush between hall wall (z70) and south wall (z112) — no overlaps
      [[-32,40.7,Math.PI/2,91.05],[32,40.7,Math.PI/2,91.05]].forEach(([x,w2,ry,zc])=>{
        const wl=box(w2,13,1.2,musWallM);wl.position.set(x,6.5,zc);wl.rotation.y=ry;mus.add(wl)});
      const southW=box(62.8,13,1.2,musWallM);southW.position.set(0,6.5,112);mus.add(southW);
      for(let i=0;i<5;i++){const beam=box(64,.7,.7,mat(0x4a443e,{metalness:.5}));beam.position.set(0,12.4,74+i*9);mus.add(beam);
        [-16,0,16].forEach(x=>{const tr2=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffe8c8,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending}));
          tr2.scale.set(3,3,1);tr2.position.set(x,11.8,74+i*9);mus.add(tr2)})}
      // shuttle bay arrival end
      const bayDoorL=box(6,9,.8,mat(0x3a3a42,{metalness:.6,roughness:.3}));bayDoorL.position.set(-3,4.5,111.3);mus.add(bayDoorL);
      const bayDoorR=bayDoorL.clone();bayDoorR.position.x=3;mus.add(bayDoorR);
      const baySign=textSprite('SHUTTLE BAY 07 — WELCOME OPERATIVE',{scale:16,color:'#FF3B41'});baySign.position.set(0,10.4,108);mus.add(baySign);
      const musWm=new THREE.Mesh(new THREE.PlaneGeometry(20,5.1),brandLogoMat());
      musWm.position.set(0,7.5,111.2);musWm.rotation.y=Math.PI;mus.add(musWm);
      // ---- 1) TWKTK timeline ----
      const TL=[['2022 — YEAR ONE','A sealed warehouse. 2,000 believers. Zero clues. The rumour begins.'],
        ['2023 — EDITION 02','4,500 people. The shuttle protocol becomes legend.'],
        ['2024 — EDITION 03','7,000 people. The award sweep. Still no lineup, still no venue.'],
        ['2026 — THREE CITIES','Mumbai · Delhi · Bangalore. You are standing inside the rehearsal.']];
      TL.forEach((tl,i)=>{
        const side2=i%2?1:-1;
        // Fit each display inside its wall bay so neighbouring textures never intersect.
        const panel=new THREE.Mesh(new THREE.PlaneGeometry(4.6,4.4),new THREE.MeshBasicMaterial({
          map:canvasTex(768,736,(g,w,h)=>{g.fillStyle='#141210';g.fillRect(0,0,w,h);
            g.strokeStyle='#D81F26';g.lineWidth=5;g.strokeRect(10,10,w-20,h-20);
            let fs=40;g.font=`bold ${fs}px Syncopate,sans-serif`;
            while(g.measureText(tl[0]).width>w-80&&fs>18){fs--;g.font=`bold ${fs}px Syncopate,sans-serif`}
            g.fillStyle='#FF3B41';g.textAlign='left';g.fillText(tl[0],40,96);
            g.font='30px "IBM Plex Mono",monospace';g.fillStyle='#D9D9D9';
            const words=tl[1].split(' ');let line='',y2=176;
            words.forEach(wd=>{if(g.measureText(line+wd).width>w-80){g.fillText(line,40,y2);y2+=48;line=''}line+=wd+' '});
            g.fillText(line,40,y2)})}));
        panel.position.set(side2*31.2,4.6,106-Math.floor(i/2)*5.4);panel.rotation.y=-side2*Math.PI/2;mus.add(panel)});
      const growth=new THREE.Mesh(new THREE.PlaneGeometry(7,4.4),new THREE.MeshBasicMaterial({
        map:canvasTex(512,320,(g,w,h)=>{g.fillStyle='#141210';g.fillRect(0,0,w,h);
          g.strokeStyle='#FF3B41';g.lineWidth=5;g.strokeRect(10,10,w-20,h-20);
          g.font='bold 30px Syncopate,sans-serif';g.fillStyle='#FF3B41';g.textAlign='center';g.fillText('THE GROWTH',w/2,64);
          [[2000,'2022',110],[4500,'2023',210],[7000,'2024',300]].forEach(([n,yr,bw],k)=>{
            g.fillStyle='#D81F26';g.fillRect(80,110+k*56,bw,30);
            g.font='18px "IBM Plex Mono",monospace';g.fillStyle='#EDEDF2';g.textAlign='left';
            g.fillText(yr+'  ·  '+n.toLocaleString()+' FOOTFALL',90+bw,131+k*56)})})}));
      growth.position.set(0,5,111.3);growth.rotation.y=Math.PI;growth.position.x=-20;mus.add(growth);
      // ---- 2) previous editions gallery — real photographs, interactive frames ----
      const eds=galItems('editions');
      for(let i=0;i<8;i++){
        const side2=i%2?1:-1,zi=95-Math.floor(i/2)*5.2;
        const fr=new THREE.Group();fr.position.set(side2*31,4.2,zi);fr.rotation.y=-side2*Math.PI/2;
        const frame=box(4.6,4.2,.22,goldM);fr.add(frame);
        const ph=new THREE.Mesh(new THREE.PlaneGeometry(4.2,3.7),photoMat(eds[i]&&eds[i].src,eds[i]&&eds[i].cap));
        ph.position.z=.14;fr.add(ph);
        const spot2=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffe8c8,transparent:true,opacity:.4,depthWrite:false,blending:THREE.AdditiveBlending}));
        spot2.scale.set(7,4,1);spot2.position.set(0,3.4,.6);fr.add(spot2);
        mus.add(fr);
        addIx(fr,'VIEW — PREVIOUS EDITIONS',()=>openGallery('editions',i),5);
      }
      // ---- 3) experience gallery — one display per stall story ----
      const XP=[['fashion','FASHION'],['art','ART'],['bar','BARS'],['stage','STAGE'],['holo','HOLO'],['food','FOOD']];
      XP.forEach(([key,label],i)=>{
        const side2=i%2?1:-1,zi=77.5-Math.floor(i/2)*3.4;
        const py=new THREE.Group();py.position.set(side2*(26-Math.floor(i/2)*1.2),0,zi);
        const stand=box(3.2,5.4,.5,mat(0x24201c,{metalness:.4,roughness:.4}));stand.position.y=2.7;py.add(stand);
        const items=galItems(key);
        const ph=new THREE.Mesh(new THREE.PlaneGeometry(2.7,3.4),photoMat(items[0]&&items[0].src,label));
        ph.position.set(0,3.1,side2>0?-.32:.32);ph.rotation.y=side2>0?Math.PI:0;py.add(ph);
        const lbl=new THREE.Mesh(new THREE.PlaneGeometry(2.7,.6),new THREE.MeshBasicMaterial({
          map:canvasTex(256,56,(g,w,h)=>{g.fillStyle='#D81F26';g.fillRect(0,0,w,h);
            g.font='bold 26px Syncopate,sans-serif';g.textAlign='center';g.fillStyle='#fff';g.fillText(label,w/2,38)})}));
        lbl.position.set(0,.9,side2>0?-.32:.32);lbl.rotation.y=side2>0?Math.PI:0;py.add(lbl);
        mus.add(py);
        addIx(py,'VIEW — '+label+' EXPERIENCE',()=>openGallery(key,0),4.5);
      });
      // ---- 4) award room: official honours on illuminated pedestals ----
      const OFFICIAL=[
        ['FESTIVAL OF THE YEAR — MUSIC','Under 10K Attendees','The night nobody announced became the festival everybody chased.',eds[11]],
        ['SMALL BUDGET EVENT OF THE YEAR','Maximum room, minimum spend','Proof that trust is the loudest marketing there is.',eds[4]],
        ['DIGITAL PROMOTION — ON-GROUND EVENT','Campaign with zero lineup posts','A campaign made of rumours, decoded by those who know.',eds[7]]];
      const mkPed=(x,z,h2)=>{const pg=new THREE.Group();pg.position.set(x,0,z);
        const ped=cyl(.62,.8,h2,mat(0xd9d9d9,{metalness:.92,roughness:.12}),12);ped.position.y=h2/2;pg.add(ped);
        const pLED=cyl(.82,.82,.14,emat(0xffe0b0,2.2),12);pLED.position.y=h2+.07;pg.add(pLED);
        return pg};
      OFFICIAL.forEach((aw,i)=>{
        const pg=mkPed(-7+i*7,88,1.9);
        const caseG=box(1.5,1.9,1.5,new THREE.MeshStandardMaterial({color:0xbfd4ff,transparent:true,opacity:.13,roughness:.03,metalness:.6}));
        caseG.position.y=3.1;pg.add(caseG);
        const stem=cyl(.08,.14,.6,goldM,8);stem.position.y=2.5;pg.add(stem);
        const star=new THREE.Mesh(new THREE.OctahedronGeometry(.4,0),
          new THREE.MeshStandardMaterial({color:0xd8a848,metalness:1,roughness:.08,emissive:0x664208,emissiveIntensity:.8}));
        star.position.y=3.15;star.scale.y=1.5;pg.add(star);(W.trophies=W.trophies||[]).push(star);
        const beam2=new THREE.Mesh(new THREE.ConeGeometry(1.1,7.6,12,1,true),amat(0xffe8c8,.09));
        beam2.position.y=7.6;beam2.rotation.x=Math.PI;pg.add(beam2);
        const plaque=new THREE.Mesh(new THREE.PlaneGeometry(2.6,1.5),new THREE.MeshBasicMaterial({
          map:canvasTex(512,300,(g,w,h)=>{g.fillStyle='#181410';g.fillRect(0,0,w,h);
            g.strokeStyle='#D8A848';g.lineWidth=6;g.strokeRect(8,8,w-16,h-16);
            let fs=30;g.font=`bold ${fs}px Syncopate,sans-serif`;
            while(g.measureText(aw[0]).width>w-40&&fs>14){fs-=2;g.font=`bold ${fs}px Syncopate,sans-serif`}
            g.textAlign='center';g.fillStyle='#FF3B41';g.fillText(aw[0],w/2,70);
            g.font='18px "IBM Plex Mono",monospace';g.fillStyle='#D9D9D9';g.fillText(aw[1],w/2,120);
            g.font='16px "IBM Plex Mono",monospace';g.fillStyle='#8B8B9E';
            const words=aw[2].split(' ');let line='',y2=170;
            words.forEach(wd=>{if(g.measureText(line+wd).width>w-60){g.fillText(line,w/2,y2);y2+=26;line=''}line+=wd+' '});
            g.fillText(line,w/2,y2)})}));
        plaque.position.set(0,1.15,1.35);plaque.rotation.x=-.35;pg.add(plaque);
        if(i!==2){
          const thumb=new THREE.Mesh(new THREE.PlaneGeometry(1.7,1.15),photoMat(aw[3]&&aw[3].src,aw[0]));
          thumb.position.set(0,4.9,0);pg.add(thumb);(W.awardThumbs=W.awardThumbs||[]).push(thumb);
        }
        mus.add(pg);
        addIx(pg,'INSPECT — '+aw[0].split('—')[0].trim(),()=>{
          toast(`<b>${aw[0]}</b> · ${aw[1]} — ${aw[2]}`);openGallery('editions',Math.max(0,eds.indexOf(aw[3])))},5);
      });
      [-14,14].forEach(x=>{const pg=mkPed(x,88,1.6);
        const caseG=box(1.2,1.5,1.2,new THREE.MeshStandardMaterial({color:0xbfd4ff,transparent:true,opacity:.1,roughness:.05,metalness:.5}));
        caseG.position.y=2.5;pg.add(caseG);
        const rs=textSprite('RESERVED — OCT 2026',{scale:5,color:'#8B8B9E'});rs.position.y=4;pg.add(rs);
        mus.add(pg)});
      // the WOW haul, second row
      const AWARDS=[
        ['GOLD — LIVE IP OF THE YEAR','WOW Awards · Under 7K'],
        ['GOLD — BEST STAGE & PRODUCTION','WOW Awards'],
        ['SILVER — DIGITAL MARKETING','WOW Awards'],
        ['SILVER — BEST USE OF TECHNOLOGY','WOW Awards'],
        ['GOLD — IMMERSIVE EXPERIENCE','Event Excellence'],
        ['BEST EVENT IP LAUNCH','India Nightlife Honors'],
        ['PRODUCTION DESIGN EXCELLENCE','Live Design Circle']];
      AWARDS.forEach((aw,i)=>{
        const side2=i%2?1:-1,zi=95.5-Math.floor(i/2)*3.4;
        const pg=mkPed(side2*21,zi,1.5);
        const caseG=box(1.05,1.35,1.05,new THREE.MeshStandardMaterial({color:0xbfd4ff,transparent:true,opacity:.13,roughness:.05,metalness:.5}));
        caseG.position.y=2.3;pg.add(caseG);
        const orb=new THREE.Mesh(i%2?new THREE.OctahedronGeometry(.26,0):new THREE.SphereGeometry(.22,10,10),
          new THREE.MeshStandardMaterial({color:0xd8a848,metalness:1,roughness:.12,emissive:0x553a08,emissiveIntensity:.7}));
        orb.position.y=2.35;pg.add(orb);(W.trophies=W.trophies||[]).push(orb);
        mus.add(pg);
        addIx(pg,'INSPECT AWARD',()=>toast(`<b>${aw[0]}</b> — ${aw[1]}. For an event that never announces itself.`),4);
      });
      const glSign=textSprite('AWARD GALLERY',{scale:14,color:'#FF3B41'});glSign.position.set(0,10,88);mus.add(glSign);
      const musSign=textSprite('THE TWKTK MUSEUM',{scale:17,color:'#FFFFFF'});musSign.position.set(0,11,100);mus.add(musSign);
      [[0,76],[0,90],[0,104]].forEach(([x,z])=>{
        const L=new THREE.PointLight(0xffe8c8,22,26,1.6);L.position.set(x,9,z);mus.add(L)});
      s.add(mus);
    }],
    ['raising the grand entrance',()=>{
      // ---- iconic TWKTK entrance arch + red carpet + award gallery ----
      const en=new THREE.Group();
      // pylons with live LED skins (share the stage shader)
      [-11,11].forEach(x=>{
        const py=box(3.4,17,3.4,mat(0x1a1a20,{metalness:.6,roughness:.3}));py.position.set(x,8.5,60);en.add(py);
        const skin=new THREE.Mesh(new THREE.PlaneGeometry(3,15),W.led);skin.position.set(x,8.5,58.2);skin.rotation.y=Math.PI;en.add(skin);
        const mh=new THREE.Mesh(new THREE.ConeGeometry(1.6,12,10,1,true),amat(REDH,.12));
        mh.position.set(x,17,60);en.add(mh);(W.archSpots=W.archSpots||[]).push(mh)});
      const beam=box(26,3.2,3.4,mat(0x1a1a20,{metalness:.6,roughness:.3}));beam.position.set(0,18.6,60);en.add(beam);
      const archWm=new THREE.Mesh(new THREE.PlaneGeometry(22,5.6),brandLogoMat());
      archWm.position.set(0,18.8,58.1);archWm.rotation.y=Math.PI;en.add(archWm);
      const archLED=box(26.4,.5,.5,emat(RED,2));archLED.position.set(0,16.8,58.2);en.add(archLED);
      // red carpet + golden ropes
      const carpet=box(7,.08,26,mat(0x8a1218,{roughness:.95}));carpet.position.set(0,.05,54);en.add(carpet);
      for(let i=0;i<6;i++)[-4.4,4.4].forEach(x=>{
        const post=cyl(.09,.12,1.1,goldM,8);post.position.set(x,.55,44+i*4.4);en.add(post);
        const knob=new THREE.Mesh(new THREE.SphereGeometry(.14,8,8),goldM);knob.position.set(x,1.15,44+i*4.4);en.add(knob)});
      // flags row
      for(let i=0;i<5;i++)[-7.5,7.5].forEach(x=>{
        const fp2=cyl(.06,.08,6,mat(0x6a6a72,{metalness:.7}),6);fp2.position.set(x,3,46+i*4.5);en.add(fp2);
        const flag=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.1),
          new THREE.MeshStandardMaterial({color:0xD81F26,emissive:0x550a0d,emissiveIntensity:.5,side:THREE.DoubleSide}));
        flag.position.set(x+.95,5.4,46+i*4.5);en.add(flag);(W.flags=W.flags||[]).push(flag)});
      // ticket scanner gates + security
      [-2.8,0,2.8].forEach(x=>{
        [-1,1].forEach(o=>{const pil=box(.32,1.4,.32,mat(0x22222a,{metalness:.7}));pil.position.set(x+o*.85,.7,63.5);en.add(pil);
          const lamp=box(.2,.12,.2,emat(0x4aff88,1.8));lamp.position.set(x+o*.85,1.46,63.5);en.add(lamp)});
        const scan=new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.1),amat(0x4aff88,.14));scan.position.set(x,.75,63.5);en.add(scan)});
      [-6.5,6.5].forEach(x=>{const sec=personFig(0x0e0e14);sec.position.set(x,0,63);sec.rotation.y=Math.PI;en.add(sec)});
      // smoke at the arch base
      W.enSmoke=[];for(let i=0;i<10;i++){
        const f=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0x8a8a96,transparent:true,opacity:0,depthWrite:false}));
        f.scale.set(rnd(4,8),rnd(2,4),1);f.userData={t:Math.random(),x:rnd(-9,9)};en.add(f);W.enSmoke.push(f)}
      // ---- walk-in BOX OFFICE: booth, receptionist, live displays, queue ----
      const bo3=new THREE.Group();bo3.position.set(21,0,56);bo3.rotation.y=-Math.PI/2;
      const boothWallM=mat(0x2a2622,{roughness:.7});
      const backW=box(9,6.5,.5,boothWallM);backW.position.set(0,3.25,-2.6);bo3.add(backW);
      [[-4.5],[4.5]].forEach(([x])=>{const sw2=box(.5,6.5,4.6,boothWallM);sw2.position.set(x,3.25,-.5);bo3.add(sw2)});
      const roofB2=box(9.6,.4,5.4,mat(0x18141a,{metalness:.6}));roofB2.position.set(0,6.6,-.4);bo3.add(roofB2);
      const boWm=new THREE.Mesh(new THREE.PlaneGeometry(8,2),brandLogoMat());boWm.position.set(0,7.6,0);bo3.add(boWm);
      const boSign=textSprite('BOX OFFICE',{scale:9,color:'#FF3B41'});boSign.position.set(0,5.6,.2);bo3.add(boSign);
      const cnt3=box(8.4,1.2,1.1,mat(0x8a6a4a,{roughness:.45}));cnt3.position.set(0,1.65,.8);bo3.add(cnt3);
      const cntGlass=box(8.4,1.6,.08,new THREE.MeshStandardMaterial({color:0xbfd4ff,transparent:true,opacity:.16,roughness:.03,metalness:.6}));
      cntGlass.position.set(0,3.2,.5);bo3.add(cntGlass);
      const cntLED2=box(8.6,.3,1.2,emat(RED,1.4));cntLED2.position.set(0,.95,.8);bo3.add(cntLED2);
      // receptionist (greets on approach — see worldTick)
      const recep=personFig(0x8a1218,{v:1});recep.position.set(0,0,-1.2);bo3.add(recep);
      W.recep={fig:recep,greeted:false,worldPos:new THREE.Vector3(21,0,56)};
      // live queue + tier displays (canvas, updated in worldTick)
      const qCv=document.createElement('canvas');qCv.width=256;qCv.height=128;
      const qTex=new THREE.CanvasTexture(qCv);qTex.colorSpace=THREE.SRGBColorSpace;
      const qScr=new THREE.Mesh(new THREE.PlaneGeometry(3,1.5),new THREE.MeshBasicMaterial({map:qTex}));
      qScr.position.set(-2.4,4.6,-2.3);bo3.add(qScr);
      const tCv=document.createElement('canvas');tCv.width=256;tCv.height=128;
      const tTex=new THREE.CanvasTexture(tCv);tTex.colorSpace=THREE.SRGBColorSpace;
      const tScr=new THREE.Mesh(new THREE.PlaneGeometry(3,1.5),new THREE.MeshBasicMaterial({map:tTex}));
      tScr.position.set(2.4,4.6,-2.3);bo3.add(tScr);
      W.boothScr={qCv,qTex,tCv,tTex,serving:12,t:0,tier:0};
      // physical ticket card — appears on the counter after purchase
      const tCard=new THREE.Group();
      const cardB=box(1.15,.04,.68,goldM);tCard.add(cardB);
      const cardWm=new THREE.Mesh(new THREE.PlaneGeometry(.95,.24),brandLogoMat());
      cardWm.rotation.x=-Math.PI/2;cardWm.position.y=.03;tCard.add(cardWm);
      tCard.position.set(1.6,2.34,.8);tCard.visible=false;bo3.add(tCard);W.ticketCard=tCard;
      // queue stanchions + touch kiosks
      for(let i=0;i<4;i++){const post=cyl(.08,.11,1.1,goldM,8);post.position.set(-3+i*2,0.55,2.6);bo3.add(post);
        const rope=cyl(.03,.03,1.9,mat(0x8a1218,{roughness:.6}),6);rope.rotation.z=Math.PI/2;
        rope.position.set(-2+i*2,1,2.6);if(i<3)bo3.add(rope)}
      [[-2.6],[2.6]].forEach(([x])=>{
        const kk=new THREE.Group();kk.position.set(x,0,3.8);
        const kb=box(.9,2.4,.5,mat(0x1c1c22,{metalness:.6,roughness:.3}));kb.position.y=1.2;kk.add(kb);
        const ks=box(.75,.95,.06,emat(REDH,1));ks.position.set(0,2,.26);ks.rotation.x=-.35;kk.add(ks);
        bo3.add(kk);
        addIx(kk,'TOUCH KIOSK — BUY TICKETS',()=>openBoxOffice(),4)});
      const qFig=personFig(0x3a5a7a,{v:1});qFig.position.set(-1,0,3.4);qFig.rotation.y=Math.PI;bo3.add(qFig);
      en.add(bo3);
      addIx(bo3,'BOX OFFICE COUNTER',()=>openBoxOffice(),6.5);
      s.add(en);
    }],
    ['staging performers + after party',()=>{
      // ---- fan pit barriers ----
      const railM=mat(0xc9c9d2,{metalness:.85,roughness:.25});
      for(let i=0;i<12;i++){const a=-Math.PI*.42+i/11*Math.PI*.84;
        const r2=13;const rl=box(3,1.05,.14,railM);
        rl.position.set(Math.sin(a)*r2,0.55,-19+Math.cos(a)*r2*.6);rl.rotation.y=-a;s.add(rl)}
      const fpSign=textSprite('FAN PIT',{scale:9,color:'#FF3B41'});fpSign.position.set(0,6.5,-19);s.add(fpSign);
      // ---- EM Lounge (elevated mezzanine) ----
      const em=new THREE.Group();em.position.set(-60,0,-48);
      const emPlat=box(15,1.6,11,mat(0x1c1620,{metalness:.4,roughness:.3}));emPlat.position.y=.8;em.add(emPlat);
      const emTrim=box(15.3,.2,11.3,emat(0xffc878,1.5));emTrim.position.y=1.65;em.add(emTrim);
      for(let i=0;i<3;i++){const sofa=box(3.6,1.2,1.8,mat(0x2a1030,{roughness:.6}));sofa.position.set(-4.5+i*4.5,2.3,-3);em.add(sofa)}
      const emBar=box(6,1.8,1.4,mat(0x14141a,{metalness:.6}));emBar.position.set(0,2.4,3.4);em.add(emBar);
      const emSign=textSprite('EM LOUNGE',{scale:10,color:'#FF3B41'});emSign.position.set(0,8,0);em.add(emSign);
      s.add(em);
      addIx(em,'EM LOUNGE — MEZZANINE',()=>toast('<b>EM LOUNGE</b> — elevated, hosted, bottle menu on request. The floor below, the drop above.'),10);
      // ---- on-stage viewing riser ----
      const os=new THREE.Group();os.position.set(38,0,-46);
      const osPlat=box(8,2.2,6,mat(0x16161c,{metalness:.5})); osPlat.position.y=1.1;os.add(osPlat);
      const osTrim=box(8.3,.2,6.3,emat(RED,1.6));osTrim.position.y=2.25;os.add(osTrim);
      const osSign=textSprite('ON STAGE',{scale:8,color:'#FF3B41'});osSign.position.set(0,6.5,0);os.add(osSign);
      s.add(os);
      addIx(os,'ON STAGE — ARTIST VIEW',()=>toast('<b>ON STAGE</b> — the artist-eye view. Strictly limited on the real night.'),8);
      // ---- ARCADE BAY: four playable cabinets + leaderboard wall ----
      const ab=new THREE.Group();ab.position.set(-38,0,46);ab.rotation.y=Math.PI;
      const games=[['TWKTK RUNNER','runner',0xff3b41],['RHYTHM DROP','rhythm',0xffc878],['MEMORY GLOW','simon',0x7ae0ff],['TWKTK MAZE','maze',0x4aff88]];
      games.forEach(([nm,key,cc],i)=>{
        const cab=new THREE.Group();cab.position.set(-6.75+i*4.5,0,0);
        const body2=box(1.9,3.2,1.4,mat(0x101014,{roughness:.4,metalness:.4}));body2.position.y=1.6;cab.add(body2);
        const scr=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.1),new THREE.MeshBasicMaterial({
          map:canvasTex(160,120,(g,w,h)=>{g.fillStyle='#050507';g.fillRect(0,0,w,h);
            g.font='bold 16px Syncopate,sans-serif';g.textAlign='center';
            g.fillStyle='#'+cc.toString(16).padStart(6,'0');g.fillText(nm.split(' ')[0],w/2,52);g.fillText(nm.split(' ')[1]||'',w/2,76);
            g.font='9px "IBM Plex Mono",monospace';g.fillStyle='#8B8B9E';g.fillText('PRESS E TO PLAY',w/2,104)})}));
        scr.position.set(0,2.1,.72);scr.rotation.x=-.12;cab.add(scr);
        const marq=box(1.9,.4,1.4,emat(cc,1.6));marq.position.y=3.4;cab.add(marq);
        ab.add(cab);
        addIx(cab,'PLAY: '+nm,()=>openGame(key),4.5);
      });
      // leaderboard wall — the floor remembers
      const lbW=new THREE.Group();lbW.position.set(12,0,.4);lbW.rotation.y=-.3;
      const lbStand=box(6.6,4.8,.5,mat(0x101014,{roughness:.4,metalness:.4}));lbStand.position.y=2.6;lbW.add(lbStand);
      const lbGlow=box(6.8,.28,.6,emat(0x4aff88,1.6));lbGlow.position.y=5.15;lbW.add(lbGlow);
      W.lbMat=new THREE.MeshBasicMaterial({map:lbTexture()});
      const lbScr=new THREE.Mesh(new THREE.PlaneGeometry(6,3.9),W.lbMat);lbScr.position.set(0,2.7,.28);lbW.add(lbScr);
      ab.add(lbW);
      addIx(lbW,'LEADERBOARD — THE FLOOR REMEMBERS',()=>openLb(),5);
      const abSign=textSprite('ARCADE BAY',{scale:11,color:'#FF3B41'});abSign.position.set(0,7.5,0);ab.add(abSign);
      s.add(ab);
      // ---- live performers ----
      W.performers=[];
      const addPerf=(fig,u)=>{s.add(fig);W.performers.push({fig,u})};
      // fire + poi spinners
      [[14,8,0xff7a30],[-14,8,0xff7a30],[-28,14,0x7ab8ff]].forEach(([x,z,cc])=>{
        const g2=new THREE.Group();g2.position.set(x,0,z);
        g2.add(personFig(0x1c1c24));
        const piv=new THREE.Group();piv.position.y=1.4;g2.add(piv);
        [[1.3],[-1.3]].forEach(([o])=>{const orb=new THREE.Mesh(new THREE.SphereGeometry(.16,8,8),emat(cc,3));orb.position.x=o;piv.add(orb);
          const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:cc,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
          gl.scale.set(2.6,2.6,1);gl.position.x=o;piv.add(gl)});
        addPerf(g2,(dt,t,o)=>{piv.rotation.y+=dt*7;piv.rotation.x=Math.sin(t*2)*0.7})});
      // LED dancers on podiums
      for(let i=0;i<3;i++){
        const g2=new THREE.Group();g2.position.set(46+i*9,0,-12);
        const pod=cyl(1.1,1.3,1.6,mat(0x14141a,{metalness:.5}),10);pod.position.y=.8;g2.add(pod);
        const dm=new THREE.MeshStandardMaterial({color:0x111114,emissive:0xff2a30,emissiveIntensity:1.2,roughness:.5});
        const dancer=new THREE.Group();
        const db=new THREE.Mesh(new THREE.CapsuleGeometry(.3,.95,3,8),dm);db.position.y=1;dancer.add(db);
        const dh=new THREE.Mesh(new THREE.SphereGeometry(.21,8,8),dm);dh.position.y=1.85;dancer.add(dh);
        dancer.position.y=1.6;g2.add(dancer);
        addPerf(g2,(dt,t)=>{dancer.position.y=1.6+Math.abs(Math.sin(t*3.2+i))*.3;
          dm.emissive.setHSL((t*.15+i*.33)%1,.9,.5);dancer.rotation.y+=dt*2})}
      // aerial artist on a ribbon
      {const g2=new THREE.Group();g2.position.set(0,21,-8);
        const swing=new THREE.Group();
        const ribbon=box(.12,9,.02,mat(0xD81F26,{roughness:.6,side:THREE.DoubleSide}));ribbon.position.y=-4.5;swing.add(ribbon);
        const artist=personFig(0xe8d0c0);artist.scale.setScalar(.9);artist.position.y=-9.4;swing.add(artist);
        g2.add(swing);
        addPerf(g2,(dt,t)=>{swing.rotation.z=Math.sin(t*.9)*.5;swing.rotation.x=Math.cos(t*.7)*.25})}
      // flair bartender
      {const g2=new THREE.Group();g2.position.set(-14,0,41);
        g2.add(personFig(0xf2f2f2));
        const bottle=cyl(.09,.11,.5,emat(0xffb445,.9),8);g2.add(bottle);
        addPerf(g2,(dt,t)=>{const k=(t*1.4)%2;bottle.position.set(.4,1.6+Math.max(0,Math.sin(k*Math.PI))*1.4,0);
          bottle.rotation.z=k*Math.PI*2})}
      // photographers roaming with flashes
      for(let i=0;i<2;i++){
        const g2=new THREE.Group();
        g2.add(personFig(0x2a2a32));
        const flashS=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffffff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
        flashS.scale.set(3,3,1);flashS.position.y=1.7;g2.add(flashS);
        const wp=[[i?30:-30,10],[i?18:-18,-8],[i?38:-38,2]];let wi=0;
        addPerf(g2,(dt,t)=>{const tgt=wp[wi];
          const dx=tgt[0]-g2.position.x,dz=tgt[1]-g2.position.z,d=Math.hypot(dx,dz);
          if(d<1)wi=(wi+1)%3;else{g2.position.x+=dx/d*dt*2.4;g2.position.z+=dz/d*dt*2.4;g2.rotation.y=Math.atan2(dx,dz)}
          flashS.material.opacity=(Math.sin(t*2.4+i*3)>.985)?.9:Math.max(0,flashS.material.opacity-dt*3)})}
      // ---- special FX: CO2, sparks, fire columns ----
      W.co2=[];[[-26],[-12],[12],[26]].forEach(([x],i)=>{
        const noz=box(.6,.8,.6,mat(0x22222a,{metalness:.8}));noz.position.set(x,2.9,-43);s.add(noz);
        const jet=new THREE.Mesh(new THREE.ConeGeometry(1.1,7,10,1,true),amat(0xffffff,.35));
        jet.position.set(x,3.4,-43);jet.scale.set(1,0.001,1);s.add(jet);
        W.co2.push({jet,next:4+i*2.3,on:0})});
      W.sparks=[];[[-38],[38]].forEach(([x])=>{
        const n2=50,pos2=new Float32Array(n2*3),vel2=[];
        for(let i=0;i<n2;i++){pos2.set([x,2.6,-46],i*3);vel2.push([rnd(-1.5,1.5),rnd(3,7),rnd(-1,1)]);}
        const gsp=new THREE.BufferGeometry();gsp.setAttribute('position',new THREE.BufferAttribute(pos2,3));
        const pts2=new THREE.Points(gsp,new THREE.PointsMaterial({map:GLOW,color:0xffd080,size:.5,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
        s.add(pts2);W.sparks.push({pts:pts2,vel:vel2,x})});
      W.fireCols=[];[[-20],[-7],[7],[20]].forEach(([x])=>{
        const fc=new THREE.Mesh(new THREE.ConeGeometry(1,6,10),amat(0xff7a30,.5));
        fc.position.set(x,4,-57);fc.scale.set(1,.001,1);s.add(fc);W.fireCols.push(fc)});
      // ---- AFTER PARTY annex: sunrise chapter ----
      const ap=new THREE.Group();ap.position.set(141,0,40);
      const apFloor=new THREE.Mesh(new THREE.PlaneGeometry(46,58),mat(0x241d1a,{roughness:.7,metalness:.2}));
      apFloor.rotation.x=-Math.PI/2;apFloor.position.y=.01;ap.add(apFloor);
      const apWallM=mat(0x2a2026,{roughness:.9});
      [[0,-28,46,0],[0,28,46,0],[21,0,58,Math.PI/2]].forEach(([x,z,w2,ry])=>{
        const wl=box(w2,14,1.2,apWallM);wl.position.set(x,7,z);wl.rotation.y=ry;ap.add(wl)});
      // sunrise wall
      const sunrise=new THREE.Mesh(new THREE.PlaneGeometry(44,12),new THREE.MeshBasicMaterial({
        map:canvasTex(512,160,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);
          gr.addColorStop(0,'#3a2a5e');gr.addColorStop(.45,'#b05a80');gr.addColorStop(.75,'#e88a50');gr.addColorStop(1,'#ffd9a0');
          g.fillStyle=gr;g.fillRect(0,0,w,h);
          g.fillStyle='rgba(255,230,180,.9)';g.beginPath();g.arc(w/2,h*.82,26,0,TAU);g.fill()})}));
      sunrise.position.set(20.2,7,0);sunrise.rotation.y=-Math.PI/2;ap.add(sunrise);
      const sunGl=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0xffd9a0,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending}));
      sunGl.scale.set(26,26,1);sunGl.position.set(19,4,0);ap.add(sunGl);
      // chill stage + DJ
      const apStage=box(10,1,4,mat(0x3a2f28,{roughness:.8}));apStage.position.set(0,.5,-24);ap.add(apStage);
      const apBooth=box(3.4,1.1,1.2,mat(0x4a3a30,{roughness:.7}));apBooth.position.set(0,1.55,-24);ap.add(apBooth);
      const apDJ=personFig(0x6a5a4a);apDJ.position.set(0,1,-25.4);ap.add(apDJ);(W.performers=W.performers||[]).push({fig:apDJ,u:(dt,t)=>{apDJ.children[1].rotation.x=Math.sin(t*2.4)*.12}});
      // cocktail bar + lounge
      const apBar=box(8,2.2,2,mat(0x5a4432,{roughness:.55}));apBar.position.set(14,1.1,12);ap.add(apBar);
      for(let i=0;i<5;i++){const gl2=cyl(.08,.05,.4,new THREE.MeshStandardMaterial({color:0xbfd4ff,transparent:true,opacity:.5,roughness:.1}),6);
        gl2.position.set(10.8+i*1.4,2.4,12);ap.add(gl2)}
      for(let i=0;i<3;i++){const sofa=box(3.4,1,1.7,mat(0x8a5a40,{roughness:.8}));
        sofa.position.set(-13,+.5,8+i*4);sofa.rotation.y=Math.PI/2;ap.add(sofa)}
      for(let i=0;i<4;i++){const p2=LB._palm(rnd(4,6));p2.position.set(rnd(-18,18),0,rnd(-20,20));ap.add(p2)}
      // mirror ball + strings
      const ball=new THREE.Mesh(new THREE.SphereGeometry(1,14,12),mat(0xd9d9d9,{metalness:1,roughness:.05}));
      ball.position.set(0,9,0);ap.add(ball);W.mirror=ball;
      const stp=[];for(let i=0;i<40;i++)stp.push(rnd(-20,20),rnd(6,11),rnd(-24,24));
      const stg=new THREE.BufferGeometry();stg.setAttribute('position',new THREE.Float32BufferAttribute(stp,3));
      ap.add(new THREE.Points(stg,new THREE.PointsMaterial({map:GLOW,color:0xffe0b0,size:1.4,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})));
      const apL=new THREE.PointLight(0xffc9a0,20,40,1.5);apL.position.set(0,8,0);ap.add(apL);
      const apSign2=textSprite('AFTER PARTY — SUNRISE SESSIONS',{scale:16,color:'#FFD9A0'});apSign2.position.set(0,12.5,0);ap.add(apSign2);
      s.add(ap);
      addIx(apBar,'SUNRISE COCKTAIL',()=>toast('<b>SUNRISE SESSIONS</b> — espresso martini, first light, last dance.'),6);
      // ---- realistic fireworks: particle pool, shells, smoke, dynamic light ----
      const FWN=700;
      const fwPos=new Float32Array(FWN*3),fwCol=new Float32Array(FWN*3);
      for(let i=0;i<FWN;i++)fwPos[i*3+1]=-999;
      const fwGeo=new THREE.BufferGeometry();
      fwGeo.setAttribute('position',new THREE.BufferAttribute(fwPos,3));
      fwGeo.setAttribute('color',new THREE.BufferAttribute(fwCol,3));
      const fwPts=new THREE.Points(fwGeo,new THREE.PointsMaterial({map:GLOW,size:.9,vertexColors:true,
        transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
      s.add(fwPts);
      const smokes=[];for(let i=0;i<10;i++){
        const sm=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,color:0x9a9aa4,transparent:true,opacity:0,depthWrite:false}));
        sm.scale.set(6,6,1);s.add(sm);smokes.push({sp:sm,t:1})}
      const flashL=new THREE.PointLight(0xffffff,0,90,1.4);s.add(flashL);
      W.fw={pts:fwPts,parts:[],free:[...Array(FWN).keys()],shells:[],smokes,flash:flashL,show:0,next:0,
        launchers:[[128,20],[141,16],[154,20]]};
      const fwConsole=new THREE.Group();fwConsole.position.set(147,0,15);
      const fb2=box(1.6,1.1,.9,mat(0x22222a,{metalness:.7}));fb2.position.y=.55;fwConsole.add(fb2);
      const fbtn=cyl(.18,.18,.12,emat(RED,2),10);fbtn.position.set(0,1.15,0);fwConsole.add(fbtn);
      const fLbl=textSprite('CLOSING SHOW',{scale:6,color:'#FF3B41'});fLbl.position.y=2.2;fwConsole.add(fLbl);
      s.add(fwConsole);
      addIx(fwConsole,'LAUNCH THE CLOSING SHOW',()=>{
        if(W.fw.show>0)return toast('<b>SHOW RUNNING</b> — eyes up.');
        W.fw.show=22;toast('<b>CLOSING CEREMONY</b> — eyes on the sky.')},5);
    }],
    ['laying ramps + catwalks',()=>{
      const deckM=mat(0x2a2a30,{metalness:.5,roughness:.4}),
            stepM=mat(0x34343c,{metalness:.4,roughness:.5}),
            gripM=emat(RED,.9);
      // stage wing ramps (west + east)
      [[-43.75,.334],[43.75,-.334]].forEach(([x,rz])=>{
        const ramp=box(8.1,.3,4,deckM);ramp.position.set(x,1.32,-48);ramp.rotation.z=rz;s.add(ramp);
        const lip=box(8.1,.08,.25,gripM);lip.position.set(x,1.5,-46.1);lip.rotation.z=rz;s.add(lip)});
      // catwalk into the pit
      const cw=box(5,.35,11,deckM);cw.position.set(0,2.43,-38.5);s.add(cw);
      [-2.4,2.4].forEach(x=>{const strip=box(.12,.1,11,gripM);strip.position.set(x,2.66,-38.5);s.add(strip)});
      [[-1.8,-35],[1.8,-35],[-1.8,-42],[1.8,-42]].forEach(([x,z])=>{
        const leg=cyl(.14,.18,2.4,stepM,8);leg.position.set(x,1.2,z);s.add(leg)});
      // catwalk east steps down
      for(let i=0;i<4;i++){const top=2.6-(i+.6)*.62;
        const st2=box(.85,Math.max(top,.18),4,stepM);
        st2.position.set(2.95+i*.83,Math.max(top,.18)/2,-35);s.add(st2)}
      // ON STAGE riser steps (south)
      for(let i=0;i<3;i++){const top=2.2-(i+.55)*.7;
        const st2=box(4,Math.max(top,.2),.68,stepM);
        st2.position.set(38,Math.max(top,.2)/2,-42.7+i*.66);s.add(st2)}
      // VIP east entry ramp + tier steps
      const vr=box(4,.25,4.2,deckM);vr.position.set(71.9,.62,37.3);vr.rotation.z=-.306;s.add(vr);
      const vrG=box(4,.07,.3,gripM);vrG.position.set(71.9,.78,35.5);vrG.rotation.z=-.306;s.add(vrG);
      for(let i=0;i<2;i++){const top=2.7-(i+.5)*.75;
        const st2=box(4,top,.56,stepM);st2.position.set(62,top/2,33.8+i*.56);s.add(st2)}
      // EM lounge east ramp
      const er=box(4,.25,4,deckM);er.position.set(-50.65,.82,-48);er.rotation.z=-.408;s.add(er);
      // after-party stage steps
      for(let i=0;i<2;i++){const top=1-(i+.5)*.5;
        const st2=box(5,top,.6,stepM);st2.position.set(141,top/2,18.3+i*.6);s.add(st2)}
      // backstage safety rail on the stage rear edge (visual + honest barrier)
      const br=box(52,.9,.12,mat(0xc9c9d2,{metalness:.85,roughness:.25}));br.position.set(-13,3.4,-58.8);s.add(br);
    }],
    ['unsealing the hidden room',()=>{
      // hidden room behind stage-right in back wall
      const hr=new THREE.Group();hr.position.set(20,0,-63);
      const shell=box(16,10,12,mat(0x0b0b10));shell.position.set(0,5,-2);hr.add(shell);
      // interior (visible when door opens)
      const inner=new THREE.Group();
      const neon=textSprite('YOU WERE NEVER HERE',{scale:11,color:'#FF3B41'});neon.position.set(0,5,-5.5);inner.add(neon);
      const pede=cyl(.8,1,1.6,mat(0x101018,{metalness:.7}),10);pede.position.set(0,.8,-4);inner.add(pede);
      const key=new THREE.Mesh(new THREE.OctahedronGeometry(.7,0),
        new THREE.MeshStandardMaterial({color:0xAEAEC0,metalness:1,roughness:.15,emissive:0x550a0d,emissiveIntensity:.6}));
      key.position.set(0,2.4,-4);inner.add(key);W.relic=key;
      const rl=new THREE.PointLight(0xff2a30,30,18,1.6);rl.position.set(0,4,-4);inner.add(rl);
      hr.add(inner);
      const door=box(4.4,6,.5,mat(0x15151d,{metalness:.6}));door.position.set(0,3,4.1);hr.add(door);
      const sigil=new THREE.Mesh(new THREE.CircleGeometry(.5,3),emat(REDH,1.2));
      sigil.position.set(0,4.6,4.4);hr.add(sigil);
      s.add(hr);W.hiddenDoor=door;
      addIx(hr,'??? — THE MARKED DOOR',()=>{
        if(!W.hiddenOpen){W.hiddenOpen=true;discoverZone('THE HIDDEN ROOM');
          toast('<b>THE HIDDEN ROOM</b> — some truths are kept off the map. Take a good look.');
          AudioEngine.drop()}
      },15);
    }],
    ['charging particles + air',()=>{
      // ambient dust
      const dp=new Float32Array(500*3);for(let i=0;i<500;i++)dp.set([rnd(-95,95),rnd(.5,22),rnd(-66,66)],i*3);
      const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(dp,3));
      const dust=new THREE.Points(dg,new THREE.PointsMaterial({map:GLOW,color:0x996060,size:.5,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending}));
      s.add(dust);W.dust=dust;
      // steam over food court
      const sp2=new Float32Array(80*3);for(let i=0;i<80;i++)sp2.set([rnd(-10,10)+26,rnd(4,9),rnd(-2,2)+44],i*3);
      const sg2=new THREE.BufferGeometry();sg2.setAttribute('position',new THREE.BufferAttribute(sp2,3));
      const steam=new THREE.Points(sg2,new THREE.PointsMaterial({map:GLOW,color:0x9aa0aa,size:1.6,transparent:true,opacity:.28,depthWrite:false,blending:THREE.AdditiveBlending}));
      s.add(steam);W.steam=steam;
      // confetti pool (hidden until drop)
      const cp2=new Float32Array(600*3),cv2=[];
      for(let i=0;i<600;i++){cp2.set([0,-50,0],i*3);cv2.push([0,0,0])}
      const cg2=new THREE.BufferGeometry();cg2.setAttribute('position',new THREE.BufferAttribute(cp2,3));
      const conf=new THREE.Points(cg2,new THREE.PointsMaterial({map:GLOW,color:0xff4a50,size:.85,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
      s.add(conf);W.confetti={pts:conf,vel:cv2,live:0};
      // entrance doorway glow (south)
      [-12.2,12.2].forEach(x=>{const jamb=box(.5,14,.5,emat(RED,1.2));jamb.position.set(x,7,69.6);s.add(jamb)});
      // official logo on the entrance branding wall
      const wmWall=new THREE.Mesh(new THREE.PlaneGeometry(38,9.7),brandLogoMat());
      wmWall.position.set(0,18,68.9);wmWall.rotation.y=Math.PI;s.add(wmWall);
      // zone label sprites
      ZONES.forEach(z=>{if(z.n==='THE HIDDEN ROOM')return;
        const sp3=textSprite(z.n,{scale:Math.min(16,4+z.n.length*.8),color:'#FF3B41'});
        sp3.position.set(z.x,z.n==='MAIN STAGE'?26:11.5,z.z);sp3.material.opacity=.85;s.add(sp3)});
    }],
  ];
  // progressive build
  let si=0;
  function step(){
    if(si<steps.length){
      const [label,fn]=steps[si];
      $('#loadTxt').textContent='> '+label+'…';
      $('#loadBar').style.transform=`scaleX(${(si+1)/steps.length})`;
      try{fn()}catch(e){document.documentElement.setAttribute('data-err','build:'+label+': '+e.message)}
      si++;setTimeout(step,60);
    }else finishWorld();
  }
  step();
}
function buildAvatar(s){
  const A={phase:0,yaw:0,wave:0,stepped:false};
  const root=new THREE.Group();
  const jacket=mat(0x1a1a22,{roughness:.6}),pants=mat(0x111116,{roughness:.7}),
        skin2=mat(0xc9a080,{roughness:.7}),shoe=mat(0xd9d9d9,{roughness:.4,metalness:.3});
  const hips=new THREE.Group();hips.position.y=.98;root.add(hips);
  const torso=box(.44,.52,.26,jacket);torso.position.y=.3;hips.add(torso);
  const zip=box(.05,.48,.02,emat(REDH,.9));zip.position.set(0,.3,.14);hips.add(zip);
  const headG=new THREE.Group();headG.position.y=.62;hips.add(headG);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.17,12,10),skin2);head.position.y=.14;headG.add(head);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.175,10,8,0,TAU,0,Math.PI/2),mat(0x50151a,{roughness:.8}));
  cap.position.y=.16;headG.add(cap);
  function limb(px,upperLen,foreLen,m1,m2){
    const up=new THREE.Group();up.position.set(px,.5,0);
    const u2=box(.11,upperLen,.13,m1);u2.position.y=-upperLen/2;up.add(u2);
    const lo=new THREE.Group();lo.position.y=-upperLen;up.add(lo);
    const l2=box(.1,foreLen,.11,m2);l2.position.y=-foreLen/2;lo.add(l2);
    return {up,lo}}
  const armL=limb(-.3,.3,.28,jacket,skin2),armR=limb(.3,.3,.28,jacket,skin2);
  hips.add(armL.up,armR.up);
  function leg(px){const up=new THREE.Group();up.position.set(px,0,0);
    const th=box(.15,.42,.17,pants);th.position.y=-.21;up.add(th);
    const lo=new THREE.Group();lo.position.y=-.42;up.add(lo);
    const sh=box(.13,.42,.15,pants);sh.position.y=-.21;lo.add(sh);
    const ft=box(.14,.09,.3,shoe);ft.position.set(0,-.44,.06);lo.add(ft);
    return {up,lo}}
  const legL=leg(-.13),legR=leg(.13);
  hips.add(legL.up,legR.up);
  // blob shadow
  const contactTex=canvasTex(64,64,g=>{const gradient=g.createRadialGradient(32,32,5,32,32,32);gradient.addColorStop(0,'rgba(0,0,0,.65)');gradient.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gradient;g.fillRect(0,0,64,64)});
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.3,1.3),
    new THREE.MeshBasicMaterial({map:contactTex,transparent:true,opacity:.5,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.02;root.add(shadow);
  hips.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
  s.add(root);
  Object.assign(A,{root,hips,headG,torso,armL,armR,legL,legR,
    mJacket:jacket,mPants:pants,mSkin:skin2,mShoe:shoe,zip,cap});
  applyAvatarStyle(A,avatarPrefs());
  // ---- optional rigged GLB character (skeleton + animation clips) ----
  const mURL=(window.TWKTK_CONFIG||{}).MODEL_URL;
  if(mURL)new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(mURL,gltf=>{
    try{
      const mesh=gltf.scene,C3=window.TWKTK_CONFIG||{};
      mesh.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
      // skinned-aware bounds: rigs (Tripo etc.) often carry their true size in
      // the BONES, so the bind-pose geometry box lies — compute skinned AABBs
      mesh.updateMatrixWorld(true);
      const bb=new THREE.Box3();
      mesh.traverse(o=>{
        if(o.isSkinnedMesh){o.computeBoundingBox();
          bb.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld))}
        else if(o.isMesh){o.geometry.computeBoundingBox();
          bb.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld))}});
      const sz=new THREE.Vector3();bb.getSize(sz);
      const targetH=C3.MODEL_HEIGHT||1.75;
      const sc2=(targetH/Math.max(.001,sz.y))*(C3.MODEL_SCALE||1);
      mesh.scale.setScalar(sc2);
      mesh.position.y=-bb.min.y*sc2;mesh.position.x=-(bb.min.x+bb.max.x)*.5*sc2;mesh.position.z=-(bb.min.z+bb.max.z)*.5*sc2;          // feet on the floor
      A.glbHeight=+(sz.y*sc2).toFixed(2);
      mesh.rotation.y=C3.MODEL_YAW||0;
      hips.visible=false;                       // swap visuals, keep the shadow blob
      root.add(mesh);
      A.glb=mesh;A.clips={};A.active=null;
      if(gltf.animations&&gltf.animations.length){
        A.mixer=new THREE.AnimationMixer(mesh);
        gltf.animations.forEach(c=>{
          const n=c.name.toLowerCase();
          const key=/idle|stand|breath/.test(n)?'idle':/run|sprint|jog/.test(n)?'run'
            :/walk/.test(n)?'walk':/wave|hello/.test(n)?'wave':/dance/.test(n)?'dance':c.name;
          if(!A.clips[key])A.clips[key]=A.mixer.clipAction(c)});
        if(!A.clips.idle)A.clips.idle=A.mixer.clipAction(gltf.animations[0]);
        A.setClip=k=>{const next=A.clips[k]||A.clips.walk||A.clips.idle;
          if(!next||A.active===next)return;
          if(A.active)A.active.fadeOut(.22);
          next.reset().fadeIn(.22).play();A.active=next};
        A.setClip('idle');
      }
      if(!A.mixer){ // skeleton but no clips — drive the bones ourselves
        // covers Tripo (L_Thigh/L_Upperarm), Mixamo (LeftUpLeg/LeftArm) and
        // Blender (thigh.L / upper_arm.L) naming families
        const B={},flat=n=>n.toLowerCase().replace(/[^a-z]/g,'');
        const M={
          legL:['lthigh','leftupleg','lupleg','thighl','leftthigh','upperlegl'],
          legR:['rthigh','rightupleg','rupleg','thighr','rightthigh','upperlegr'],
          armL:['lupperarm','leftarm','upperarml','leftupperarm','arml','larm'],
          armR:['rupperarm','rightarm','upperarmr','rightupperarm','armr','rarm'],
          kneeL:['lcalf','leftleg','calfl','lowerlegl','leftcalf','shinl'],
          kneeR:['rcalf','rightleg','calfr','lowerlegr','rightcalf','shinr'],
          spine:['spine']};
        mesh.traverse(o=>{if(!o.isBone)return;const n=flat(o.name);
          if(/twist|fore|hand|clav|toe|foot/.test(n))return;   // only root limb bones
          for(const k in M)if(!B[k]&&M[k].some(p=>n===p||n.startsWith(p)||n.endsWith(p))){B[k]=o;break}});
        if(B.legL||B.armL){A.bones=B;
          Object.values(B).forEach(b=>{b.userData.rx=b.rotation.x;b.userData.rz=b.rotation.z});mesh.updateMatrixWorld(true);A.hipHeight=(B.legL||B.legR)?.getWorldPosition(new THREE.Vector3()).y-root.getWorldPosition(new THREE.Vector3()).y;}
      }
      toast('<b>CHARACTER LOADED</b> — skeleton rig active'+(A.mixer?' · '+gltf.animations.length+' animation'+(gltf.animations.length>1?'s':''):(A.bones?' · skeleton-driven movement':' · static model')),4200);
    }catch(err){document.documentElement.setAttribute('data-err','glb:'+err.message)}
  },undefined,()=>{/* no model file — procedural rig stays */});
  return A;
}
function finishWorld(){
  $('#loader').classList.add('hide');
  const W=State.world;
  useScene(W.scene);
  State.phase='world';
  // spawn in the shuttle bay — walk the museum first, then the arch, then the floor
  player.pos.set(0,0,106);player.vel.set(0,0,0);
  look.yaw=0;look.pitch=.18;W.camDist=12; // cinematic pull-in
  W.avatar=buildAvatar(W.scene);
  W.avatar.root.position.set(0,0,106);
  camera.position.set(0,4,116);camera.rotation.set(0,0,0,'YXZ');
  AudioEngine.setStagePos(0,6,-46);
  AudioEngine.setMuffle(16000,1.5);
  flash(1,900);fadeOut(600);
  $('#skipBtn').classList.remove('on');
  $('#minimap').classList.add('on');
  if(isTouch){$('#joy').classList.add('on');$('#sprintBtn').classList.add('on');$('#mapBtn').classList.add('on')}
  tickers.length=0;tickers.push(worldTick);
  discoverZone('MAIN STAGE',true);
  if(!worldStore.getItem('twktk_guided')){$('#guide').classList.remove('hide')}
  else toast(`WELCOME BACK — WALK THE AWARD GALLERY, THEN FIND ALL ${ZONES.length} ZONES.`,5200);
}

/* ---- world interactions ---- */
function triggerDrop(){
  const W=State.world;
  toast('<b>THE DROP</b> — INCOMING',1800);
  AudioEngine.drop(()=>{
    W.strobe=1.2;
    // confetti burst
    const C=W.confetti,pos=C.pts.geometry.attributes.position.array;
    for(let i=0;i<600;i++){
      pos[i*3]=rnd(-8,8);pos[i*3+1]=rnd(10,16);pos[i*3+2]=-40+rnd(-6,6);
      C.vel[i]=[rnd(-6,6),rnd(2,9),rnd(-6,6)]}
    C.live=4.5;C.pts.geometry.attributes.position.needsUpdate=true;
  });
}
function takePhoto(){
  flash(1,260);
  try{
    composer.render();
    renderer.domElement.toBlob(b=>{
      if(!b)return toast('<b>PHOTO BOOTH</b> — capture failed on this device');
      const a=document.createElement('a');a.href=URL.createObjectURL(b);
      a.download='TWKTK-worldline-photo.png';a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),4000);
      toast('<b>PHOTO CAPTURED</b> — saved to your downloads. Proof you were never here.')
    },'image/png');
  }catch(e){toast('<b>PHOTO BOOTH</b> — capture failed on this device')}
}
const zoneBannerEl=$('#zoneBanner');let zbT=null;
function discoverZone(name,quiet){
  if(State.zones.has(name))return;
  State.zones.add(name);
  $('#zoneCount').textContent=State.zones.size+'/'+ZONES.length;
  if(!quiet){zoneBannerEl.querySelector('.zb-name').textContent=name;
    zoneBannerEl.classList.add('on');clearTimeout(zbT);
    zbT=setTimeout(()=>zoneBannerEl.classList.remove('on'),2800);
    AudioEngine.blip()}
  if(State.zones.size===ZONES.length)setTimeout(()=>toast(`<b>ALL ${ZONES.length} ZONES DISCOVERED</b> — you know now. See you at the checkpoint. 19.0760°N · 72.8777°E`,7000),1500);
}

/* ================= controls ================= */
const look={yaw:0,pitch:0};
const player={pos:new THREE.Vector3(0,0,60),vel:new THREE.Vector3()};
const keys={};
/* ============ GLOBAL INPUT MANAGER ============
   While ANY text field is focused (input/textarea/select/contenteditable —
   booking, payment, sign-in, chat, search, admin, future forms), every
   gameplay hotkey is dead: W A S D E F M Q R T, digits, arrows, Space,
   Shift, Tab, etc. Registered in CAPTURE phase with stopImmediatePropagation
   so no later listener (this file, social.js, arcade games) ever sees the
   key. Typing itself is the browser default action, so it still works.
   Held movement keys are cleared the moment a field gains focus. */
function editable(t){return !!t&&t.tagName&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable)}
function uiTyping(evTarget){return editable(evTarget)||editable(document.activeElement)}
function releaseKeys(){for(const k in keys)keys[k]=false;window.__sprintTouch=false}
addEventListener('focusin',e=>{if(editable(e.target))releaseKeys()});
/* blockers live on document (bubble): the focused field's OWN handlers
   (e.g. chat Enter-to-send) run first at the target, then the event dies
   here — before any window-level gameplay listener. The check uses the
   EVENT TARGET (keys are always delivered to the focused field), so it
   holds even when document.activeElement is unreliable (embedded panes).
   Typing itself is the browser's default action and is never affected. */
document.addEventListener('keydown',e=>{
  if(!uiTyping(e.target))return;
  if(e.key==='Escape'&&editable(e.target))e.target.blur(); // Esc leaves the field, nothing else
  releaseKeys();
  e.stopImmediatePropagation();
});
document.addEventListener('keyup',e=>{
  if(!uiTyping(e.target))return;
  e.stopImmediatePropagation();
});
addEventListener('keydown',e=>{keys[e.code]=true;
  if(e.code==='KeyE'&&State.phase==='world'&&!G.active)tryInteract();
  eggBuf=(eggBuf+e.key.toLowerCase()).slice(-5);
  if(eggBuf==='trust'&&State.phase==='world'){
    State.world.laserMats&&State.world.laserMats.forEach(m=>m.color.setHex(0xffffff));
    toast('<b>MAGIC WORD ACCEPTED</b> — lasers burn white. Tell no one.');}
});
addEventListener('keyup',e=>{keys[e.code]=false});
let eggBuf='';
// drag look
let dragging=false,lx=0,ly=0,dragMoved=0;
const cvs=renderer.domElement;
cvs.addEventListener('pointerdown',e=>{if(e.target.closest('#joy'))return;
  dragging=true;lx=e.clientX;ly=e.clientY;dragMoved=0});
addEventListener('pointermove',e=>{if(!dragging)return;
  const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;dragMoved+=Math.abs(dx)+Math.abs(dy);
  look.yaw-=dx*.0042;look.pitch=clamp(look.pitch-dy*.0036,-1.2,1.2)});
addEventListener('pointerup',e=>{
  if(dragging&&dragMoved<8&&State.phase==='world')tryInteract(e);
  dragging=false});
// joystick
const joy={x:0,y:0,id:null};
const joyEl=$('#joy'),stickEl=$('#joyStick');
joyEl.addEventListener('pointerdown',e=>{joy.id=e.pointerId;joyEl.setPointerCapture(e.pointerId);joyMove(e)});
joyEl.addEventListener('pointermove',e=>{if(e.pointerId===joy.id)joyMove(e)});
const releaseJoy=()=>{joy.id=null;joy.x=joy.y=0;stickEl.style.transform='translate(-50%,-50%)'};joyEl.addEventListener('pointerup',releaseJoy);joyEl.addEventListener('pointercancel',releaseJoy);joyEl.addEventListener('lostpointercapture',releaseJoy);
function joyMove(e){const r=joyEl.getBoundingClientRect();
  let x=(e.clientX-r.left-r.width/2)/(r.width/2),y=(e.clientY-r.top-r.height/2)/(r.height/2);
  const l=Math.hypot(x,y);if(l>1){x/=l;y/=l}
  joy.x=x;joy.y=y;stickEl.style.transform=`translate(calc(-50% + ${x*30}px),calc(-50% + ${y*30}px))`}
$('#actBtn').addEventListener('click',()=>tryInteract());

/* interact */
const ray=new THREE.Raycaster();let promptIx=-1;
function scanInteract(){
  if(State.phase!=='world')return;
  const W=State.world;
  const pPos=new THREE.Vector3(player.pos.x,player.pos.y+1.3,player.pos.z);
  let best=-1,bestD=1e9;
  interactables.forEach((it,i)=>{
    const c=new THREE.Vector3();new THREE.Box3().setFromObject(it.obj).getCenter(c);
    const d=c.distanceTo(pPos);
    if(d<it.dist){ // also require the camera to roughly face it
      const dir=c.sub(camera.position).normalize();
      const fwd=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
      if(dir.dot(fwd)>.05&&d<bestD){best=i;bestD=d}}
  });
  promptIx=best;
  const pr=$('#prompt');
  if(best>=0){pr.querySelector('.lbl').textContent=interactables[best].label;
    pr.querySelector('.key').textContent=isTouch?'●':'E';pr.classList.add('on');
    if(isTouch)$('#actBtn').classList.add('on')}
  else{pr.classList.remove('on');if(isTouch)$('#actBtn').classList.remove('on')}
}
setInterval(scanInteract,140);
function tryInteract(){if(promptIx>=0){interactables[promptIx].action();
  if(State.world&&State.world.avatar)State.world.avatar.wave=.8}}

/* colliders */
/* ============================================================
   PHYSICS CORE — walkable surfaces, tight colliders, step rule
   ============================================================ */
const STEP=.92; // max step-up height; taller ledges need ramps/stairs
/* Walkable elevated surfaces: [x1,x2,z1,z2,h] or ramps
   [x1,x2,z1,z2,'rx'|'rz',h_at_min,h_at_max] interpolate along that axis */
const SURFACES=[
  // main stage (walkable) — split so the hidden-room forecourt stays at floor level
  [-40,14,-60,-44,2.6],[14,40,-52,-44,2.6],
  // stage side ramps (west + east wings)
  [-47.5,-40,-50,-46,'rx',0,2.6],[40,47.5,-50,-46,'rx',2.6,0],
  // catwalk into the fan pit + side steps down (eastward)
  [-2.5,2.5,-44,-33,2.6],[2.5,5.8,-37,-33,'rx',2.6,0],
  // ON STAGE riser + its steps
  [34,42,-49,-43,2.2],[36,40,-43,-41,'rz',2.2,0],
  // VIP deck, upper tier, tier step, east entry ramp
  [51,70,24,40,1.2],[54,70,24.5,33.5,2.2],[60,64,33.5,34.6,'rz',2.2,1.2],[70,73.8,35.2,39.4,'rx',1.2,0],
  // EM Lounge mezzanine + east ramp
  [-67.5,-52.5,-53.5,-42.5,1.6],[-52.5,-48.8,-50,-46,'rx',1.6,0],
  // ITC low deck (steppable from all sides)
  [78,90,10,26,.85],
  // after-party stage + front step
  [136,146,14,18,1],[136,146,18,19.2,'rz',1,0],
];
function surfH(S,x,z){
  if(S[4]==='rx')return S[5]+(S[6]-S[5])*((x-S[0])/(S[1]-S[0]));
  if(S[4]==='rz')return S[5]+(S[6]-S[5])*((z-S[2])/(S[3]-S[2]));
  return S[4];
}
function groundH(x,z,curY){ // highest surface the player can actually stand on
  let h=0;
  for(const S of SURFACES){
    if(x<S[0]||x>S[1]||z<S[2]||z>S[3])continue;
    const sh=surfH(S,x,z);
    if(sh>h&&sh<=curY+STEP)h=sh;
  }
  return h;
}
function topH(x,z){ // absolute top — used to treat tall ledges as walls
  let h=0;
  for(const S of SURFACES){
    if(x<S[0]||x>S[1]||z<S[2]||z>S[3])continue;
    const sh=surfH(S,x,z);if(sh>h)h=sh;
  }
  return h;
}
/* Solid boxes: [x1,x2,z1,z2,hTop] — ignored once the player stands above hTop-.5 */
const RECTS=[
  // stage LED wall + DJ desk (walk behind, not through)
  [-37,37,-60.6,-58.6,99],[-5.2,5.2,-32.6,-29.4,5],
  // premium bar counter + back shelf (walk around the ends)
  [-22.2,-5.8,42.4,45.6,5],[-22.2,-5.8,39.4,40.9,7],
  // food stalls (tables are circles below)
  [16.8,35.2,41.8,46.2,6],
  // VIP: sofas, glass rail on the stage-view (north) edge
  [55.2,68.8,26.4,29.4,5.5],[51.6,72.4,23.8,24.4,4.5],
  // EM lounge furniture
  [-66.3,-53.7,-52.2,-50,5],[-63,-57,-45.4,-43.8,5],
  // merch shopfront, photo frame
  [-90.2,-77.8,-12.2,-3.8,99],[80,88,-6.8,-5.2,99],
  // BroCode: counter, back bar, bench
  [-85.6,-82.4,13.8,26.2,5],[-88.6,-86.7,13.8,26.2,7],[-76.5,-74.7,16.4,23.6,3],
  // ITC: sofas, host counter
  [85.9,88,11.6,16.4,4],[85.9,88,19.6,24.4,4],[88.5,90.2,15.4,20.6,4],
  // arcade cabinets + leaderboard stand
  [-45.4,-30.6,45.2,48.4,5],[-29,-22.6,44.4,48.4,7],
  // box office booth: back wall, two sides, counter (front stays open)
  [23.2,24,51.3,60.7,8],[18.6,23.6,51,51.9,8],[18.6,23.6,60.1,61,8],[19.5,20.8,51.8,60.2,4],
  // museum shuttle-bay doors, after-party cocktail bar
  [-6.2,6.2,110.5,111.9,99],[150.8,159.2,50.9,53.2,4],
];
/* Round obstacles: [cx,cz,r] */
const COLS=[
  // hidden room shell
  [20,-63,9],
  // installations
  [-55,-26,4.8],[70,4,3.8],[-70,4,6],
  // fashion store props: racks, mirror, changing booth corner posts
  [-77.5,0,1.1],[-77.5,7,1.1],[-62.4,1,1.5],[-63,8,1.9],
  // brand village kiosks
  [-60,28,4],[-50,28,4],[-60,36,4],[-50,36,4],
  // food court tables
  [20,52,1.3],[28,53.5,1.3],[35,52,1.3],
  // VIP bottle table, BroCode high tables
  [62,32,1.7],[-79.4,16,.95],[-79.4,20,.95],[-79.4,24,.95],
  // ITC chairs, lamps, planters, center table
  [81.6,12.5,1.1],[81.6,23.5,1.1],[79.4,11.2,.5],[79.4,24.8,.5],[88.6,10.6,.7],[88.6,25.4,.7],[84,18,1.5],
  // entrance arch pylons, scanner pillars (three lanes stay open), kiosk pair
  [-11,60,2.1],[11,60,2.1],
  [-3.65,63.5,.32],[-1.95,63.5,.32],[-.85,63.5,.32],[.85,63.5,.32],[1.95,63.5,.32],[3.65,63.5,.32],
  [17.2,53.4,.7],[17.2,58.6,.7],
  // museum: official pedestals, reserved, WOW row, experience pylons
  [-7,88,1.2],[0,88,1.2],[7,88,1.2],[-14,88,1],[14,88,1],
  [-21,95.5,.9],[21,95.5,.9],[-21,92.1,.9],[21,92.1,.9],[-21,88.7,.9],[21,88.7,.9],[-21,85.3,.9],
  [-26,77.5,1.1],[26,77.5,1.1],[-24.8,74.1,1.1],[24.8,74.1,1.1],[-23.6,70.7,1.1],[23.6,70.7,1.1],
  // after-party lounge sofas + fireworks console
  [128,48,1.6],[128,52,1.6],[128,56,1.6],[147,15,1],
];
// fan pit barrier arc (open toward the stage sides, matching the visual rails)
for(let i=0;i<12;i++){const a=-Math.PI*.42+i/11*Math.PI*.84;
  COLS.push([Math.sin(a)*13,-19+Math.cos(a)*13*.6,1.35])}
function collide(p){
  // playable union: main hall + east corridor + after-party annex + museum wing
  if(p.x>96){
    if(p.x<118){ // corridor
      if(p.z<37||p.z>51)p.x=96; else p.z=clamp(p.z,37,51);
    }else{ // annex
      p.x=clamp(p.x,118,162);p.z=clamp(p.z,12,68);
    }
  }else if(p.z>66){ // museum wing, south
    if(p.z<70){if(Math.abs(p.x)>11.5)p.z=66}
    else{p.x=clamp(p.x,-30.5,30.5);p.z=Math.min(p.z,110)}
  }else{p.x=clamp(p.x,-96,96);p.z=clamp(p.z,-66,66)}
  const py=p.y||0,m=.45;
  for(const[x1,x2,z1,z2,hTop]of RECTS){
    if(py+.5>=hTop)continue;
    if(p.x>x1-m&&p.x<x2+m&&p.z>z1-m&&p.z<z2+m){
      const dl=p.x-(x1-m),dr=(x2+m)-p.x,dn=p.z-(z1-m),df=(z2+m)-p.z;
      const mn=Math.min(dl,dr,dn,df);
      if(mn===dl)p.x=x1-m;else if(mn===dr)p.x=x2+m;
      else if(mn===dn)p.z=z1-m;else p.z=z2+m;
    }
  }
  COLS.forEach(([cx,cz,r])=>{const dx=p.x-cx,dz=p.z-cz,d=Math.hypot(dx,dz);
    if(d<r&&d>1e-4){p.x=cx+dx/d*r;p.z=cz+dz/d*r}});
}
/* ---------- world QA: grid reachability validation (TWKTK.navcheck()) ---------- */
function navCheck(){
  const GS=1.4,x0=-100,z0=-75,x1=166,z1=118;
  const nx=Math.ceil((x1-x0)/GS),nz=Math.ceil((z1-z0)/GS);
  const open=new Uint8Array(nx*nz),hgt=new Float32Array(nx*nz),seen=new Uint8Array(nx*nz);
  const cx=i=>x0+i*GS+GS/2,cz=j=>z0+j*GS+GS/2,id=(i,j)=>j*nx+i;
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const x=cx(i),z=cz(j),h=groundH(x,z,1e3);
    const p={x,z,y:h};collide(p);
    const disp=Math.hypot(p.x-x,p.z-z);
    open[id(i,j)]=disp<GS*.55?1:0;hgt[id(i,j)]=h;
  }
  // BFS from spawn (museum shuttle bay)
  const si=Math.floor((0-x0)/GS),sj=Math.floor((106-z0)/GS);
  const q=[[si,sj]];seen[id(si,sj)]=1;let walk=0;
  while(q.length){
    const [i,j]=q.pop();walk++;
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([di,dj])=>{
      const i2=i+di,j2=j+dj;
      if(i2<0||j2<0||i2>=nx||j2>=nz)return;
      const k=id(i2,j2);
      if(seen[k]||!open[k])return;
      if(hgt[k]-hgt[id(i,j)]>STEP)return; // can't step up that far
      seen[k]=1;q.push([i2,j2])});
  }
  const near=(x,z,r)=>{
    const i1=Math.max(0,Math.floor((x-r-x0)/GS)),i2=Math.min(nx-1,Math.floor((x+r-x0)/GS));
    const j1=Math.max(0,Math.floor((z-r-z0)/GS)),j2=Math.min(nz-1,Math.floor((z+r-z0)/GS));
    for(let j=j1;j<=j2;j++)for(let i=i1;i<=i2;i++)
      if(seen[id(i,j)]&&Math.hypot(cx(i)-x,cz(j)-z)<=r)return true;
    return false};
  const report={walkableCells:walk,unreachableZones:[],unreachableInteractables:[]};
  ZONES.forEach(zn=>{if(!near(zn.x,zn.z,zn.r))report.unreachableZones.push(zn.n)});
  const c=new THREE.Vector3();
  interactables.forEach(it=>{
    new THREE.Box3().setFromObject(it.obj).getCenter(c);
    if(!near(c.x,c.z,it.dist))report.unreachableInteractables.push(it.label)});
  return report;
}

/* zone detection (frame-driven, cheap) */
function zoneCheck(){
  ZONES.forEach(z=>{if(z.n==='THE HIDDEN ROOM'&&!State.world.hiddenOpen)return;
    if(Math.hypot(player.pos.x-z.x,player.pos.z-z.z)<z.r)discoverZone(z.n)});
}

/* ================= world tick ================= */
function worldTick(dt){
  const W=State.world;W.t+=dt;const t=W.t;
  const A=W.avatar;
  const sprint=keys.ShiftLeft||keys.ShiftRight||window.__sprintTouch;
  let speed=0;
  if(W.sitting){
    player.pos.x=W.sitting.x;player.pos.z=W.sitting.z;player.pos.y=groundH(player.pos.x,player.pos.z,1e3);
    if(A){A.root.position.set(player.pos.x,W.sitting.y+.75-(A.hipHeight||.98),player.pos.z);A.root.rotation.y=0;A.yaw=0;
      A.legL.up.rotation.x=A.legR.up.rotation.x=-1.35;
      A.legL.lo.rotation.x=A.legR.lo.rotation.x=1.3;
      A.armL.up.rotation.x=A.armR.up.rotation.x=-.4;
      if(A.bones){const B=A.bones;for(const k of ["legL","legR"])if(B[k])B[k].rotation.x=B[k].userData.rx-1.35;for(const k of ["kneeL","kneeR"])if(B[k])B[k].rotation.x=B[k].userData.rx+1.3;for(const k of ["armL","armR"])if(B[k])B[k].rotation.x=B[k].userData.rx-.35;}}
    if(Math.abs(joy.x)+Math.abs(joy.y)>.4||keys.KeyW||keys.KeyS||keys.KeyA||keys.KeyD){
      W.sitting=null;toast('You rise. The night continues.')}
  }else{
    const sp=sprint?11:5.4;
    let mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joy.x;
    let mz=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0)+joy.y;
    if(G.active)mx=mz=0; // arcade cabinet owns the keys while a game is open
    const l=Math.hypot(mx,mz);if(l>1){mx/=l;mz/=l}
    const sin=Math.sin(look.yaw),cos=Math.cos(look.yaw);
    // frame-rate independent: quick acceleration, quicker settle
    const moving=Math.abs(mx)+Math.abs(mz)>.01;
    const k=1-Math.pow(moving?1e-5:1e-7,dt);
    player.vel.x=lerp(player.vel.x,(mx*cos+mz*sin)*sp,k);
    player.vel.z=lerp(player.vel.z,(-mx*sin+mz*cos)*sp,k);
    const ox=player.pos.x,oz=player.pos.z;
    player.pos.x+=player.vel.x*dt;player.pos.z+=player.vel.z*dt;
    collide(player.pos);
    // step rule: ledges taller than STEP behave as walls — slide along them
    if(topH(player.pos.x,player.pos.z)-player.pos.y>STEP){
      const tx={x:player.pos.x,z:oz,y:player.pos.y};collide(tx);
      if(topH(tx.x,tx.z)-player.pos.y<=STEP){player.pos.x=tx.x;player.pos.z=tx.z}
      else{const tz={x:ox,z:player.pos.z,y:player.pos.y};collide(tz);
        if(topH(tz.x,tz.z)-player.pos.y<=STEP){player.pos.x=tz.x;player.pos.z=tz.z}
        else{player.pos.x=ox;player.pos.z=oz}}
    }
    // ride ramps and stairs; drop smoothly off edges
    const gh=groundH(player.pos.x,player.pos.z,player.pos.y);
    player.pos.y+=(gh-player.pos.y)*(1-Math.pow(gh>player.pos.y?1e-4:2e-3,dt));
    if(Math.abs(gh-player.pos.y)<.015)player.pos.y=gh;
    speed=Math.hypot(player.vel.x,player.vel.z);
    if(A){
      A.root.position.set(player.pos.x,player.pos.y,player.pos.z);
      if(A.glb){ // skeleton-rigged character: clips if present, else direct bone drive
        const B=A.bones;
        if(speed>.4){
          const ty=Math.atan2(player.vel.x,player.vel.z);
          let d2=ty-A.yaw;while(d2>Math.PI)d2-=TAU;while(d2<-Math.PI)d2+=TAU;
          A.yaw+=d2*Math.min(1,dt*10);A.root.rotation.y=A.yaw;
          const prev=Math.sin(A.phase);
          A.phase+=dt*(sprint?11.5:8)*Math.min(1,speed/sp);
          if(prev<=0&&Math.sin(A.phase)>0||prev>=0&&Math.sin(A.phase)<0)AudioEngine.foot(sprint);
          if(A.setClip)A.setClip(sprint?'run':'walk');
          else if(B){const sw=Math.sin(A.phase),amp=sprint?.8:.5;
            if(B.legL)B.legL.rotation.x=B.legL.userData.rx+sw*amp;
            if(B.legR)B.legR.rotation.x=B.legR.userData.rx-sw*amp;
            if(B.kneeL)B.kneeL.rotation.x=B.kneeL.userData.rx+Math.max(0,-sw)*(sprint?1.05:.65);
            if(B.kneeR)B.kneeR.rotation.x=B.kneeR.userData.rx+Math.max(0,sw)*(sprint?1.05:.65);
            if(B.armL)B.armL.rotation.x=(B.armL.userData.rx||0)-sw*amp*.7;
            if(B.armR)B.armR.rotation.x=(B.armR.userData.rx||0)+sw*amp*.7;
            if(B.spine)B.spine.rotation.x=(B.spine.userData.rx||0)+(sprint?.12:.05)}
        }else{
          if(A.setClip)A.setClip(A.wave>0?'wave':'idle');
          else if(B){const rel=1-Math.min(1,dt*6);
            ['legL','legR','kneeL','kneeR','armL','armR','spine'].forEach(k2=>{const b=B[k2];if(!b)return;
              b.rotation.x=b.userData.rx+(b.rotation.x-b.userData.rx)*rel});
            if(B.spine)B.spine.rotation.x=B.spine.userData.rx+Math.sin(t*1.8)*.02;
            if(A.wave>0&&B.armR)B.armR.rotation.x=(B.armR.userData.rx||0)-2+Math.sin(t*14)*.25}
        }
      }
      else if(speed>.4){ // procedural rig: face movement, animate gait
        const ty=Math.atan2(player.vel.x,player.vel.z);
        let d2=ty-A.yaw;while(d2>Math.PI)d2-=TAU;while(d2<-Math.PI)d2+=TAU;
        A.yaw+=d2*Math.min(1,dt*10);A.root.rotation.y=A.yaw;
        const prev=Math.sin(A.phase);
        A.phase+=dt*(sprint?11.5:8)*Math.min(1,speed/sp);
        const sw=Math.sin(A.phase),amp=sprint?.85:.55;
        A.legL.up.rotation.x=sw*amp;A.legR.up.rotation.x=-sw*amp;
        A.legL.lo.rotation.x=Math.max(0,-sw)*.9;A.legR.lo.rotation.x=Math.max(0,sw)*.9;
        A.armL.up.rotation.x=-sw*amp*.8;A.armR.up.rotation.x=sw*amp*.8;
        A.armL.lo.rotation.x=A.armR.lo.rotation.x=-.35;
        A.hips.position.y=.98+Math.abs(Math.cos(A.phase))*.05;
        A.torso.rotation.x=sprint?.16:.06;
        if(prev<=0&&Math.sin(A.phase)>0||prev>=0&&Math.sin(A.phase)<0)AudioEngine.foot(sprint);
      }else{ // idle: breathe, settle, glance around
        const settle=Math.min(1,dt*6);
        ['legL','legR','armL','armR'].forEach(k2=>{A[k2].up.rotation.x*= (1-settle);A[k2].lo.rotation.x*=(1-settle)});
        A.hips.position.y=lerp(A.hips.position.y,.98+Math.sin(t*1.8)*.012,.2);
        A.torso.rotation.x=lerp(A.torso.rotation.x,0,.2);
        A.armL.up.rotation.z=.06+Math.sin(t*1.8)*.02;A.armR.up.rotation.z=-.06-Math.sin(t*1.8)*.02;
        A.headG.rotation.y=Math.sin(t*.45)*.5;
      }
      if(A.wave>0){A.wave-=dt;A.armR.up.rotation.x=-2.2+Math.sin(t*14)*.25;A.armR.lo.rotation.x=-.5}
      if(A.mixer)A.mixer.update(dt);
    }
  }
  // third-person camera orbit
  const pit=clamp(look.pitch+.34,-.1,1.15);
  W.camDist=lerp(W.camDist||5.6,5.6,dt*1.6);
  const cd=W.camDist;
  const target=new THREE.Vector3(player.pos.x,player.pos.y+1.55,player.pos.z);
  const camGoal=new THREE.Vector3(
    target.x+Math.sin(look.yaw)*Math.cos(pit)*cd,
    target.y+Math.sin(pit)*cd+.35,
    target.z+Math.cos(look.yaw)*Math.cos(pit)*cd);
  if(W.keyLight){W.keyLight.position.set(player.pos.x+5,player.pos.y+11.8,player.pos.z+4);W.keyLight.target.position.copy(player.pos);W.keyLight.target.updateMatrixWorld()}
  // keep the camera inside the playable shell
  if(camGoal.x>96&&!(camGoal.z>36&&camGoal.z<52))camGoal.x=96;
  if(camGoal.x>118){camGoal.x=Math.min(camGoal.x,162)}
  else if(camGoal.x<=96){camGoal.x=clamp(camGoal.x,-98,98);
    const zMax=Math.abs(camGoal.x)<31?111:68; // museum wing allowance
    camGoal.z=clamp(camGoal.z,-68,zMax)}
  if(camGoal.z>70&&camGoal.x<=96)camGoal.x=clamp(camGoal.x,-30.6,30.6);
  camGoal.y=clamp(camGoal.y,player.pos.y+.7,26);
  camera.position.lerp(camGoal,1-Math.pow(.0001,dt));
  camera.lookAt(target.x,target.y+.25,target.z);
  zoneCheck();
  // after-party audio ambience
  const inAfter=player.pos.x>112;
  if(inAfter!==W.inAfter){W.inAfter=inAfter;AudioEngine.setMuffle(inAfter?1500:16000,1.2)}
  // audio listener
  AudioEngine.updListener(camera);
  // LED + beat
  if(W.led){W.led.uniforms.uT.value=t;
    W.led.uniforms.uBeat.value=Math.max(0,W.led.uniforms.uBeat.value-dt*3)}
  // beat pulse from audio
  if(AudioEngine.ready&&!AudioEngine.onKick)AudioEngine.onKick=()=>{if(W.led)W.led.uniforms.uBeat.value=1;
    W.crowdJump=1};
  // strobe
  if(W.strobe>0){W.strobe-=dt;bloom.strength=1.6+Math.sin(t*60)*1.2}
  else bloom.strength=qualityBloom;
  // spots
  W.spots.forEach((sPt,i)=>{sPt.cone.rotation.z=Math.sin(t*.7+sPt.ph)*.55;
    sPt.cone.rotation.x=Math.cos(t*.5+sPt.ph)*.4});
  // lasers sweep
  if(W.lasers&&W.lasersOn){W.lasers.children.forEach((l,i)=>{
    l.rotation.x=Math.sin(t*1.2+i*.6)*.5;l.rotation.z=Math.PI/2.15+Math.cos(t*.9+i*.35)*.35})}
  // holo
  if(W.holoObjs)W.holoObjs.forEach(o=>{o.rotation.y+=dt*.8;o.position.y=7.5+Math.sin(t*1.4)*.4});
  // fashion
  if(W.fashionDisc)W.fashionDisc.rotation.y+=dt*W.fashionSpd;
  // art rings
  W.artRings.forEach((r,i)=>{r.rotation.x+=dt*(.4+i*.3)*W.artDir;r.rotation.y+=dt*(.6-i*.15)*W.artDir});
  // relic
  if(W.relic){W.relic.rotation.y+=dt*1.4;W.relic.position.y=2.4+Math.sin(t*2)*.15}
  // hidden door slide
  if(W.hiddenDoor){const target=W.hiddenOpen?7.4:3;
    W.hiddenDoor.position.y=lerp(W.hiddenDoor.position.y,target,dt*2.4)}
  // crowd bob
  if(W.crowd){
    const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),sc=new THREE.Vector3(1,1,1);
    const jump=W.crowdJump||0;if(W.crowdJump>0)W.crowdJump-=dt*2;
    for(let i=0;i<W.crowdN;i++){
      const[x,z]=W.crowdPos[i],ph=W.crowdPhases[i];
      const y=Math.max(0,Math.sin(t*3.4+ph))*.28+jump*.35*Math.max(0,Math.sin(t*8+ph));
      const sx=x+Math.sin(t*.55+ph*2)*.35,sz=z+Math.cos(t*.4+ph)*.3; // slow shuffle
      q.setFromAxisAngle(up,Math.sin(t*.5+ph)*.3);
      m4.compose(new THREE.Vector3(sx,y,sz),q,sc);
      W.crowd.setMatrixAt(i,m4);W.heads.setMatrixAt(i,m4);
    }
    W.crowd.instanceMatrix.needsUpdate=true;W.heads.instanceMatrix.needsUpdate=true;
  }
  // mesh curtains scroll
  if(W.meshMats){W.meshPulse=Math.max(0,(W.meshPulse||0)-dt);
    W.meshMats.forEach((m,i)=>{m.map.offset.y=t*(.15+i*.08);m.opacity=.55+(W.meshPulse||0)*.5+Math.sin(t*2+i)*.15})}
  // merch tee sway
  if(W.merchTee)W.merchTee.rotation.y=Math.sin(t*.8)*.25;
  // brocode tap pulse
  if(W.brocodePulse>0){W.brocodePulse-=dt;
    W.brocodeLED.material.emissiveIntensity=1.4+Math.max(0,W.brocodePulse)*1.6}
  // dust drift
  if(W.dust){W.dust.rotation.y=t*.01}
  // steam rise
  if(W.steam){const p=W.steam.geometry.attributes.position;
    for(let i=0;i<80;i++){let y=p.getY(i)+dt*1.2;if(y>10)y=4;p.setY(i,y)}p.needsUpdate=true}
  // confetti
  const C=W.confetti;
  if(C&&C.live>0){C.live-=dt;const p=C.pts.geometry.attributes.position;
    for(let i=0;i<600;i++){
      C.vel[i][1]-=dt*7;
      p.setXYZ(i,p.getX(i)+C.vel[i][0]*dt,Math.max(0,p.getY(i)+C.vel[i][1]*dt),p.getZ(i)+C.vel[i][2]*dt)}
    p.needsUpdate=true}
  // live performers
  if(W.performers)W.performers.forEach(pf=>pf.u(dt,t));
  // CO2 jets: periodic bursts
  if(W.co2)W.co2.forEach(j=>{j.next-=dt;
    if(j.next<=0){j.next=8+rnd(0,5);j.on=.7;AudioEngine.hiss()}
    if(j.on>0){j.on-=dt;const k=clamp(j.on/.7,0,1);
      j.jet.scale.set(1+(1-k)*.6,Math.sin(k*Math.PI)*1.2+.001,1+(1-k)*.6)}});
  // spark fountains
  if(W.sparks)W.sparks.forEach(sf=>{const p=sf.pts.geometry.attributes.position;
    for(let i=0;i<50;i++){
      sf.vel[i][1]-=dt*9;
      let y=p.getY(i)+sf.vel[i][1]*dt;
      if(y<2.4){y=2.6;sf.vel[i]=[rnd(-1.5,1.5),rnd(3,7)+(W.strobe>0?3:0),rnd(-1,1)]}
      p.setXYZ(i,p.getX(i)+sf.vel[i][0]*dt,y,p.getZ(i)+sf.vel[i][2]*dt)}
    p.needsUpdate=true});
  // fire columns flare with the drop
  if(W.fireCols)W.fireCols.forEach((fc,i)=>{
    const target2=W.strobe>0?1+Math.sin(t*22+i)*.25:.001;
    fc.scale.y=lerp(fc.scale.y,target2,dt*7);fc.scale.x=fc.scale.z=.6+fc.scale.y*.5});
  // entrance: flags wave, smoke drifts, arch spots sweep, trophies spin
  if(W.flags)W.flags.forEach((f,i)=>{f.rotation.y=Math.sin(t*2.2+i)*.35});
  if(W.enSmoke)W.enSmoke.forEach(f=>{f.userData.t+=dt*.12;if(f.userData.t>1)f.userData.t=0;
    const k=f.userData.t;
    f.position.set(f.userData.x,.5+k*4,61-k*6);
    f.material.opacity=.16*Math.sin(k*Math.PI)});
  if(W.archSpots)W.archSpots.forEach((m,i)=>{m.rotation.z=Math.sin(t*1.1+i*2)*.5;m.rotation.x=.3+Math.cos(t*.8+i)*.3});
  if(W.trophies)W.trophies.forEach((o,i)=>{o.rotation.y+=dt*1.2;o.position.y=2.42+Math.sin(t*2+i)*.06});
  // food prep sizzle + eaters nod
  if(W.prepProps)W.prepProps.forEach((pp,i)=>{pp.position.y=2.5+Math.abs(Math.sin(t*6+i*2))*.25;pp.rotation.y+=dt*3});
  if(W.eaters)W.eaters.forEach((e2,i)=>{e2.children[1].rotation.x=Math.max(0,Math.sin(t*1.6+i*1.3))*.3});
  // after party: mirror ball
  if(W.mirror)W.mirror.rotation.y+=dt*.6;
  // ceiling laser array sweep
  if(W.ceil&&W.lasersOn)W.ceil.rotation.y+=dt*.22;
  // box office booth: receptionist greets, displays cycle
  if(W.recep){const d=Math.hypot(player.pos.x-W.recep.worldPos.x,player.pos.z-W.recep.worldPos.z);
    if(d<7&&!W.recep.greeted){W.recep.greeted=true;W.recepWave=1.8;
      toast('“Welcome to TWKTK. General, Fan Pit, VIP — or all of it?” — <b>E at the counter</b>',4200);AudioEngine.blip()}
    if(d>13)W.recep.greeted=false;
    if(W.recepWave>0){W.recepWave-=dt;W.recep.fig.rotation.z=Math.sin(t*10)*.08;
      if(W.recep.fig.children[1])W.recep.fig.children[1].rotation.x=Math.sin(t*6)*.15}
    else W.recep.fig.rotation.z*=.9}
  if(W.boothScr){const B=W.boothScr;B.t+=dt;
    if(B.t>1.6){B.t=0;if(Math.random()<.4)B.serving++;B.tier=(B.tier+1)%6;
      const qg=B.qCv.getContext('2d');qg.fillStyle='#0c0c10';qg.fillRect(0,0,256,128);
      qg.fillStyle='#FF3B41';qg.font='bold 20px Syncopate,sans-serif';qg.textAlign='center';
      qg.fillText('NOW SERVING',128,40);qg.font='bold 44px Syncopate,sans-serif';qg.fillStyle='#fff';
      qg.fillText('A-'+B.serving,128,95);B.qTex.needsUpdate=true;
      const P=PRICING[State.city||'mumbai'],[tn,tp]=P.tiers[B.tier];
      const tg2=B.tCv.getContext('2d');tg2.fillStyle='#0c0c10';tg2.fillRect(0,0,256,128);
      tg2.fillStyle='#FF3B41';tg2.font='bold 16px Syncopate,sans-serif';tg2.textAlign='center';
      tg2.fillText(tn,128,50);tg2.font='bold 34px Syncopate,sans-serif';tg2.fillStyle='#fff';
      tg2.fillText(tp,128,98);B.tTex.needsUpdate=true}}
  // phone constellation sways with the crowd
  if(W.phones){const pp=W.phones.geometry.attributes.position;
    for(let i=0;i<W.phoneIdx.length;i++){const k=W.phoneIdx[i],ph=W.crowdPhases[k];
      pp.setXYZ(i,W.crowdPos[k][0]+Math.sin(t*.55+ph*2)*.35+Math.sin(t*1.8+ph)*.18,
        2.45+Math.max(0,Math.sin(t*3.4+ph))*.28,W.crowdPos[k][1]+Math.cos(t*.4+ph)*.3)}
    pp.needsUpdate=true}
  if(W.awardThumbs)W.awardThumbs.forEach((th,i)=>{th.rotation.y=Math.sin(t*.6+i)*.4});
  fwUpdate(W,dt);
  if(window.TWKTK_SOCIAL_TICK)window.TWKTK_SOCIAL_TICK(dt); // multiplayer layer (assets/social.js)
}
/* ================= fireworks engine ================= */
const FW_PALETTE=[[1,.25,.27],[1,.78,.47],[.9,.9,1],[1,1,1],[.48,.88,1]];
function fwSpawn(W,p,v,col,life,drag,grav){const F=W.fw;if(!F||!F.free.length)return;
  const i=F.free.pop();F.parts.push({i,p:p.clone(),v:v.clone(),col,life,max:life,drag,grav})}
function fwLaunch(W){const F=W.fw;const L=F.launchers[Math.floor(rnd(0,3))];
  F.shells.push({p:new THREE.Vector3(L[0],1,L[1]),
    v:new THREE.Vector3(rnd(-1.5,1.5),rnd(24,30),rnd(-1.5,1.5)),
    fuse:rnd(1.35,1.7),type:Math.floor(rnd(0,4))});
  AudioEngine.whoosh()}
function fwExplode(W,sh){const F=W.fw;AudioEngine.boom();
  F.flash.position.copy(sh.p);F.flash.intensity=70;
  const sm=F.smokes.find(x=>x.t>=1);if(sm){sm.t=0;sm.sp.position.copy(sh.p)}
  const col=FW_PALETTE[Math.floor(rnd(0,FW_PALETTE.length))];
  const n=sh.type===3?150:110;
  for(let k=0;k<n;k++){
    let dir;
    if(sh.type===1){const a=rnd(0,TAU);dir=new THREE.Vector3(Math.cos(a),rnd(-.08,.08),Math.sin(a))}
    else dir=new THREE.Vector3().randomDirection();
    const sp2=sh.type===2?rnd(5,8):rnd(8,14);
    fwSpawn(W,sh.p,dir.multiplyScalar(sp2),sh.type===2?[1,.72,.35]:col,
      sh.type===2?rnd(1.9,2.6):rnd(1.1,1.7),sh.type===2?.985:.955,sh.type===2?8:4.5)}
  if(sh.type===3)setTimeout(()=>{for(let k=0;k<60;k++)
    fwSpawn(W,sh.p.clone().add(new THREE.Vector3(rnd(-3,3),rnd(-2,2),rnd(-3,3))),
      new THREE.Vector3().randomDirection().multiplyScalar(rnd(1,3)),[1,1,1],rnd(.2,.5),.9,2)},250)}
function fwUpdate(W,dt){const F=W.fw;if(!F)return;
  if(F.show>0){F.show-=dt;F.next-=dt;
    if(F.next<=0){F.next=rnd(.45,1);fwLaunch(W)}}
  F.shells.forEach(sh=>{sh.v.y-=9.5*dt;sh.p.addScaledVector(sh.v,dt);sh.fuse-=dt;
    if(Math.random()<.6)fwSpawn(W,sh.p,new THREE.Vector3(rnd(-.6,.6),rnd(-2,-.5),rnd(-.6,.6)),[1,.8,.5],.5,.94,2);
    if(sh.fuse<=0)fwExplode(W,sh)});
  F.shells=F.shells.filter(sh=>sh.fuse>0);
  F.flash.intensity=Math.max(0,F.flash.intensity-dt*160);
  F.smokes.forEach(sm=>{if(sm.t<1){sm.t+=dt*.25;sm.sp.position.y+=dt*1.2;
    sm.sp.material.opacity=.3*Math.sin(sm.t*Math.PI);sm.sp.scale.setScalar(6+sm.t*10)}
    else sm.sp.material.opacity=0});
  const pos=F.pts.geometry.attributes.position,colA=F.pts.geometry.attributes.color;
  for(let j=F.parts.length-1;j>=0;j--){const pt=F.parts[j];
    pt.life-=dt;pt.v.y-=pt.grav*dt;pt.v.multiplyScalar(pt.drag);
    pt.p.addScaledVector(pt.v,dt);
    if(pt.life<=0||pt.p.y<0){pos.setY(pt.i,-999);F.free.push(pt.i);F.parts.splice(j,1);continue}
    const f=pt.life/pt.max;
    pos.setXYZ(pt.i,pt.p.x,pt.p.y,pt.p.z);
    colA.setXYZ(pt.i,pt.col[0]*f,pt.col[1]*f,pt.col[2]*f)}
  pos.needsUpdate=true;colA.needsUpdate=true}

/* ================= teleports + experience directory ================= */
const TPS=[
  ['MAIN STAGE',0,-22],['3D MESH LED',55,-19],['HOLO EXPERIENCE',-55,-18],
  ['VIP',62,25],['FAN PIT',0,-16],['ON STAGE',38,-40],['EM LOUNGE',-60,-40],
  ['BROCODE BEER GARDEN',-76,20],['ITC ACTIVATION',76,18],['FASHION STORE',-70,11],
  ['FOOD COURT',26,37],['ART INSTALLATION',70,11],['PHOTO BOOTH',84,-12],
  ['MERCHANDISE',-77,-8],['AWARD GALLERY',0,84],['TWKTK MUSEUM',0,102],['AFTER PARTY',141,40],
  ['PARKING',null,null],['EXIT',null,null]];
function tpTo(x,z,label){
  if(State.phase!=='world')return;
  $('#dirPanel').classList.remove('on');$('#bigMap').classList.remove('on');
  fadeIn(240);
  setTimeout(()=>{
    const ty2=groundH(x,z,1e3);
    player.pos.set(x,ty2,z);player.vel.set(0,0,0);
    look.yaw=Math.atan2(x,z+46);look.pitch=.15;
    if(State.world){State.world.camDist=14;State.world.sitting=null;
      if(State.world.avatar){State.world.avatar.root.position.set(x,ty2,z);State.world.avatar.yaw=look.yaw+Math.PI}}
    fadeOut(750);toast('▮ '+label+' ▮',2400);AudioEngine.blip();
  },300);
}
const dirPanel=$('#dirPanel');
TPS.forEach(([n,x,z])=>{
  const b=document.createElement('button');b.textContent=n;
  b.addEventListener('click',()=>{
    if(n==='PARKING')return tpTo(0,62,'PARKING — SHUTTLES ONLY. THOSE WHO KNOW DON\'T DRIVE.');
    if(n==='EXIT')return tpTo(0,62,'EXIT — THE NIGHT ISN\'T DONE WITH YOU YET.');
    tpTo(x,z,n)});
  dirPanel.appendChild(b)});
$('#dirChip').addEventListener('click',()=>dirPanel.classList.toggle('on'));

/* ================= minimap + fullscreen map ================= */
const MM_W={x1:-100,x2:166,z1:-75,z2:118};
function drawZoneDots(g,toX,toY,r){
  ZONES.forEach(zn=>{
    if(zn.n==='THE HIDDEN ROOM'&&!(State.world&&State.world.hiddenOpen))return;
    const seen=State.zones.has(zn.n);
    g.fillStyle=seen?'#FF3B41':'#5a5a66';
    g.beginPath();g.arc(toX(zn.x),toY(zn.z),r,0,TAU);g.fill()});
  // objective: nearest undiscovered
  let ob=null,bd=1e9;
  ZONES.forEach(zn=>{if(State.zones.has(zn.n)||zn.n==='THE HIDDEN ROOM')return;
    const d=Math.hypot(player.pos.x-zn.x,player.pos.z-zn.z);if(d<bd){bd=d;ob=zn}});
  if(ob){g.strokeStyle='#FF3B41';g.lineWidth=2;
    const pr=r+2+Math.sin(performance.now()*.006)*1.5;
    g.beginPath();g.arc(toX(ob.x),toY(ob.z),pr,0,TAU);g.stroke()}
  return ob;
}
const mmCtx=$('#mmCanvas').getContext('2d');
function drawMinimap(){
  const g=mmCtx,S2=296,sc=1.15;
  g.clearRect(0,0,S2,S2);
  g.save();
  g.beginPath();g.arc(S2/2,S2/2,S2/2-2,0,TAU);g.clip();
  g.fillStyle='rgba(8,8,11,.95)';g.fillRect(0,0,S2,S2);
  const toX=wx=>S2/2+(wx-player.pos.x)*sc, toY=wz=>S2/2+(wz-player.pos.z)*sc;
  // playable shells
  g.fillStyle='#131318';g.strokeStyle='rgba(216,31,38,.5)';g.lineWidth=1.5;
  g.fillRect(toX(-100),toY(-70),200*sc,140*sc);g.strokeRect(toX(-100),toY(-70),200*sc,140*sc);
  g.fillRect(toX(96),toY(37),22*sc,14*sc);
  g.fillRect(toX(118),toY(12),44*sc,56*sc);g.strokeRect(toX(118),toY(12),44*sc,56*sc);
  g.fillRect(toX(-32),toY(66),64*sc,46*sc);g.strokeRect(toX(-32),toY(66),64*sc,46*sc);
  drawZoneDots(g,toX,toY,3.5);
  // player arrow (rotates with camera heading)
  g.save();g.translate(S2/2,S2/2);g.rotate(-look.yaw);
  g.fillStyle='#FFFFFF';g.beginPath();g.moveTo(0,-8);g.lineTo(5.5,6);g.lineTo(-5.5,6);g.closePath();g.fill();
  g.restore();
  g.restore();
}
setInterval(()=>{if(State.phase==='world'&&$('#minimap').classList.contains('on'))drawMinimap()},130);
const bigMapEl=$('#bigMap'),mapCtx=$('#mapCanvas').getContext('2d');
function drawBigMap(){
  const g=mapCtx,Wc=1000,Hc=560;
  const sx=Wc/(MM_W.x2-MM_W.x1),sy=Hc/(MM_W.z2-MM_W.z1),s2=Math.min(sx,sy);
  const toX=wx=>(wx-MM_W.x1)*s2, toY=wz=>(wz-MM_W.z1)*s2;
  g.clearRect(0,0,Wc,Hc);
  g.fillStyle='#0b0b0f';g.fillRect(0,0,Wc,Hc);
  g.fillStyle='#15151b';g.strokeStyle='rgba(216,31,38,.6)';g.lineWidth=2;
  g.fillRect(toX(-100),toY(-70),200*s2,140*s2);g.strokeRect(toX(-100),toY(-70),200*s2,140*s2);
  g.fillRect(toX(96),toY(37),22*s2,14*s2);
  g.fillRect(toX(118),toY(12),44*s2,56*s2);g.strokeRect(toX(118),toY(12),44*s2,56*s2);
  g.fillRect(toX(-32),toY(66),64*s2,46*s2);g.strokeRect(toX(-32),toY(66),64*s2,46*s2);
  g.font='10px "IBM Plex Mono",monospace';g.textAlign='center';
  ZONES.forEach(zn=>{
    if(zn.n==='THE HIDDEN ROOM'&&!(State.world&&State.world.hiddenOpen))return;
    const seen=State.zones.has(zn.n);
    g.fillStyle=seen?'#FF3B41':'#71717d';
    g.beginPath();g.arc(toX(zn.x),toY(zn.z),5,0,TAU);g.fill();
    g.fillStyle=seen?'#EDEDF2':'#8B8B9E';
    g.fillText(zn.n,toX(zn.x),toY(zn.z)-9)});
  drawZoneDots(g,toX,toY,5);
  g.fillStyle='#FFFFFF';g.save();g.translate(toX(player.pos.x),toY(player.pos.z));g.rotate(-look.yaw);
  g.beginPath();g.moveTo(0,-9);g.lineTo(6,7);g.lineTo(-6,7);g.closePath();g.fill();g.restore();
  g.fillStyle='#FF3B41';g.font='11px "IBM Plex Mono",monospace';g.textAlign='left';
  g.fillText('◆ CLICK ANYWHERE NEAR A ZONE TO TELEPORT',14,Hc-12);
}
let mapInt=null;
function toggleMap(force){
  const on=force!==undefined?force:!bigMapEl.classList.contains('on');
  bigMapEl.classList.toggle('on',on);
  clearInterval(mapInt);
  if(on){drawBigMap();mapInt=setInterval(drawBigMap,300)}
}
$('#mapCanvas').addEventListener('click',e=>{
  const r=$('#mapCanvas').getBoundingClientRect();
  const Wc=1000,Hc=560,s2=Math.min(Wc/(MM_W.x2-MM_W.x1),Hc/(MM_W.z2-MM_W.z1));
  const wx=(e.clientX-r.left)*(1000/r.width)/s2+MM_W.x1;
  const wz=(e.clientY-r.top)*(560/r.height)/s2+MM_W.z1;
  let bz=null,bd=1e9;
  ZONES.forEach(zn=>{if(zn.n==='THE HIDDEN ROOM')return;
    const d=Math.hypot(wx-zn.x,wz-zn.z);if(d<bd){bd=d;bz=zn}});
  if(bz&&bd<24)tpTo(bz.x,bz.z+ (bz.n==='MAIN STAGE'?24:5),bz.n);
});
$('#mapChip').addEventListener('click',()=>toggleMap());
$('#mapBtn').addEventListener('click',()=>toggleMap());

/* ================= guide + esc menu + keys ================= */
function closeAllPanels(){['#bigMap'].forEach(sel=>$(sel).classList.remove('on'));
  ['#guide','#escMenu','#wardOv','#lbOv','#acctOv'].forEach(sel=>$(sel).classList.add('hide'));
  dirPanel.classList.remove('on');clearInterval(mapInt)}
$('#guideGo').addEventListener('click',()=>{worldStore.setItem('twktk_guided','1');
  $('#guide').classList.add('hide');
  toast(`WELCOME TO <b>TWKTK</b> — WALK THE AWARD GALLERY, THEN FIND ALL ${ZONES.length} ZONES.`,5200)});
$('#guideSkip').addEventListener('click',()=>{worldStore.setItem('twktk_guided','1');$('#guide').classList.add('hide')});
$('#helpChip').addEventListener('click',()=>{$('#escMenu').classList.add('hide');$('#guide').classList.remove('hide')});
$('#emResume').addEventListener('click',()=>$('#escMenu').classList.add('hide'));
$('#emMap').addEventListener('click',()=>{$('#escMenu').classList.add('hide');toggleMap(true)});
$('#emGuide').addEventListener('click',()=>{$('#escMenu').classList.add('hide');$('#guide').classList.remove('hide')});
$('#emWard').addEventListener('click',()=>{$('#escMenu').classList.add('hide');openWardrobe()});
$('#emLb').addEventListener('click',()=>{$('#escMenu').classList.add('hide');openLb()});
$('#emBox').addEventListener('click',()=>{$('#escMenu').classList.add('hide');openBoxOffice()});
$('#emAcct').addEventListener('click',()=>{$('#escMenu').classList.add('hide');openAccount()});
const openAccount=setupAccount();
addEventListener('keydown',e=>{
  if(e.code==='KeyM'&&State.phase==='world'&&G.active===null)toggleMap();
  if(e.code==='Escape'){
    if($('#galOv').classList.contains('on'))return closeGallery();
    if(G.active!==null)return closeGame();
    if(bigMapEl.classList.contains('on'))return toggleMap(false);
    if(!$('#boxOffice').classList.contains('hide')&&State.phase==='world')return $('#boxOffice').classList.add('hide');
    if(!$('#wardOv').classList.contains('hide'))return $('#wardOv').classList.add('hide');
    if(!$('#lbOv').classList.contains('hide'))return $('#lbOv').classList.add('hide');
    if(!$('#acctOv').classList.contains('hide'))return $('#acctOv').classList.add('hide');
    if(!$('#guide').classList.contains('hide'))return $('#guide').classList.add('hide');
    if(State.phase==='world')$('#escMenu').classList.toggle('hide');
  }
});
$('#sprintBtn').addEventListener('pointerdown',()=>window.__sprintTouch=true);
$('#sprintBtn').addEventListener('pointerup',()=>window.__sprintTouch=false);
$('#sprintBtn').addEventListener('pointercancel',()=>window.__sprintTouch=false);

/* ================= fullscreen photo gallery ================= */
const GAL={items:[],i:0,zoom:1,px:0,py:0,timer:null,drag:null};
function openGallery(key,start=0){
  const A=window.TWKTK_ASSETS,d=(A&&A.galleries&&A.galleries[key])||{title:key.toUpperCase(),items:[]};
  GAL.items=d.items.length?d.items:[{src:'',cap:'ARCHIVE PENDING — DROP PHOTOS INTO assets/images'}];
  GAL.i=clamp(start,0,GAL.items.length-1);
  $('#galTitle').textContent=d.title||key.toUpperCase();
  $('#galOv').classList.add('on');
  galStop();galShow();AudioEngine.blip();
}
function galShow(){
  const it=GAL.items[GAL.i],img=$('#galImg');
  GAL.zoom=1;GAL.px=GAL.py=0;
  img.classList.add('snap');
  img.onload=()=>{const st=$('#galStage');
    const sr=st.clientWidth/st.clientHeight,ir=img.naturalWidth/img.naturalHeight;
    if(ir>sr){img.style.width=st.clientWidth+'px';img.style.height='auto'}
    else{img.style.height=st.clientHeight+'px';img.style.width='auto'}
    requestAnimationFrame(()=>img.classList.remove('snap'))};
  img.onerror=()=>{img.onerror=null;
    const c=document.createElement('canvas');c.width=1024;c.height=640;
    const t=fallbackArt(it.cap);c.getContext('2d').drawImage(t.image,0,0,1024,640);
    img.src=c.toDataURL('image/png')};
  img.src=it.src||'assets/__missing__';
  $('#galText').textContent=it.cap||'';
  $('#galN').textContent=(GAL.i+1)+' / '+GAL.items.length;
  galApply();
}
function galApply(){$('#galImg').style.transform=
  `translate(calc(-50% + ${GAL.px}px),calc(-50% + ${GAL.py}px)) scale(${GAL.zoom})`}
function galNav(d){GAL.i=(GAL.i+d+GAL.items.length)%GAL.items.length;galShow()}
function galZoom(f){GAL.zoom=clamp(GAL.zoom*f,1,5);if(GAL.zoom===1){GAL.px=GAL.py=0}galApply()}
function galStop(){clearInterval(GAL.timer);GAL.timer=null;$('#galPlay').classList.remove('on');
  $('#galPlay').textContent='▶ SLIDESHOW'}
function closeGallery(){galStop();$('#galOv').classList.remove('on')}
$('#galPrev').addEventListener('click',()=>galNav(-1));
$('#galNext').addEventListener('click',()=>galNav(1));
$('#galClose').addEventListener('click',closeGallery);
$('#galZoomIn').addEventListener('click',()=>galZoom(1.4));
$('#galZoomOut').addEventListener('click',()=>galZoom(1/1.4));
$('#galFit').addEventListener('click',()=>{GAL.zoom=1;GAL.px=GAL.py=0;galApply()});
$('#galPlay').addEventListener('click',()=>{
  if(GAL.timer)return galStop();
  $('#galPlay').classList.add('on');$('#galPlay').textContent='◼ STOP';
  GAL.timer=setInterval(()=>galNav(1),3500)});
$('#galStage').addEventListener('wheel',e=>{e.preventDefault();galZoom(e.deltaY<0?1.18:1/1.18)},{passive:false});
$('#galStage').addEventListener('dblclick',()=>galZoom(GAL.zoom>1.5?0.01:2));
$('#galStage').addEventListener('pointerdown',e=>{
  GAL.drag={x:e.clientX,y:e.clientY};$('#galStage').setPointerCapture(e.pointerId)});
$('#galStage').addEventListener('pointermove',e=>{if(!GAL.drag||GAL.zoom<=1)return;
  GAL.px+=e.clientX-GAL.drag.x;GAL.py+=e.clientY-GAL.drag.y;
  GAL.drag={x:e.clientX,y:e.clientY};
  $('#galImg').classList.add('snap');galApply()});
$('#galStage').addEventListener('pointerup',()=>{GAL.drag=null;$('#galImg').classList.remove('snap')});
addEventListener('keydown',e=>{
  if(!$('#galOv').classList.contains('on'))return;
  if(e.code==='ArrowRight')galNav(1);
  if(e.code==='ArrowLeft')galNav(-1);
});

/* ================= arcade mini-games ================= */
const G={active:null,raf:0,cleanup:null};
function gBest(k){return +worldStore.getItem('twktk_g_'+k)||0}
function gSave(k,v){v=Math.round(v);
  if(v>gBest(k)){worldStore.setItem('twktk_g_'+k,v);
    toast('<b>NEW RECORD</b> — '+v+' PTS. THE FLOOR REMEMBERS.');
    if(v>=100)setTimeout(()=>toast('<b>ACHIEVEMENT</b> — CERTIFIED ARCADE OPERATIVE ◆'),2600)}
  $('#gBest').textContent=gBest(k)}
function closeGame(){G.active=null;cancelAnimationFrame(G.raf);
  if(G.cleanup){G.cleanup();G.cleanup=null}
  $('#gameOv').classList.remove('on');$('#simonPads').classList.remove('on');
  $('#gameCanvas').style.display=''}
$('#gameClose').addEventListener('click',closeGame);
function openGame(key){
  G.active=key;$('#gameOv').classList.add('on');$('#gameMsg').textContent='';
  $('#gBest').textContent=gBest(key);$('#gScore').textContent='0';
  const cv=$('#gameCanvas'),g=cv.getContext('2d');
  $('#simonPads').classList.remove('on');cv.style.display='';
  if(key==='runner'){
    $('#gameTitle').innerHTML='TWKTK <b>RUNNER</b>';
    $('#gameMsg').textContent='TAP / SPACE TO JUMP THE VOID';
    const st={y:0,vy:0,obs:[],t:0,spd:230,score:0,dead:false,last:performance.now()};
    const jump=()=>{if(st.dead){closeGame();openGame('runner');return}
      if(st.y<=0){st.vy=560;AudioEngine.blip()}};
    const kd=e=>{if(e.code==='Space'){e.preventDefault();jump()}};
    cv.addEventListener('pointerdown',jump);addEventListener('keydown',kd);
    G.cleanup=()=>{cv.removeEventListener('pointerdown',jump);removeEventListener('keydown',kd)};
    let spawn=0;
    (function loop(){if(G.active!=='runner')return;
      const now=performance.now(),dt=Math.min(.04,(now-st.last)/1000);st.last=now;
      if(!st.dead){
        st.t+=dt;st.spd+=dt*10;st.score=st.t*10;
        st.vy-=1500*dt;st.y=Math.max(0,st.y+st.vy*dt);
        spawn-=dt;if(spawn<=0){spawn=rnd(.7,1.5);st.obs.push({x:660,w:rnd(14,26),h:rnd(24,46)})}
        st.obs.forEach(o=>o.x-=st.spd*dt);st.obs=st.obs.filter(o=>o.x>-30);
        st.obs.forEach(o=>{if(o.x<96&&o.x+o.w>64&&st.y<o.h)st.dead=true});
        if(st.dead){$('#gameMsg').textContent='SIGNAL LOST — TAP TO RETRY';gSave('runner',st.score);lbPush('runner',st.score)}
      }
      g.fillStyle='#0a0a0e';g.fillRect(0,0,640,240);
      g.strokeStyle='#2a2a34';g.beginPath();g.moveTo(0,200);g.lineTo(640,200);g.stroke();
      g.fillStyle='#FF3B41';g.fillRect(64,200-32-st.y,32,32);
      g.fillStyle='#D9D9D9';st.obs.forEach(o=>g.fillRect(o.x,200-o.h,o.w,o.h));
      $('#gScore').textContent=Math.floor(st.score);
      G.raf=requestAnimationFrame(loop)})();
  }else if(key==='rhythm'){
    $('#gameTitle').innerHTML='RHYTHM <b>DROP</b>';
    $('#gameMsg').textContent='TAP / SPACE WHEN THE PULSE HITS THE RING';
    const st={notes:[],t:0,next:.6,made:0,total:24,score:0,last:performance.now(),done:false};
    const hit=()=>{if(st.done){closeGame();openGame('rhythm');return}
      let bi=-1,bd=1e9;st.notes.forEach((n,i)=>{const d=Math.abs(n.y-190);if(d<bd){bd=d;bi=i}});
      if(bi>=0&&bd<30){st.score+=bd<12?100:50;st.notes.splice(bi,1);AudioEngine.blip()}
      else st.score=Math.max(0,st.score-20)};
    const kd=e=>{if(e.code==='Space'){e.preventDefault();hit()}};
    cv.addEventListener('pointerdown',hit);addEventListener('keydown',kd);
    G.cleanup=()=>{cv.removeEventListener('pointerdown',hit);removeEventListener('keydown',kd)};
    (function loop(){if(G.active!=='rhythm')return;
      const now=performance.now(),dt=Math.min(.04,(now-st.last)/1000);st.last=now;
      if(!st.done){st.t+=dt;st.next-=dt;
        if(st.next<=0&&st.made<st.total){st.made++;st.next=60/126;st.notes.push({y:-16})}
        st.notes.forEach(n=>n.y+=dt*170);
        st.notes=st.notes.filter(n=>{if(n.y>236){st.score=Math.max(0,st.score-10);return false}return true});
        if(st.made>=st.total&&st.notes.length===0){st.done=true;
          $('#gameMsg').textContent='SET COMPLETE — '+st.score+' PTS — TAP TO REPLAY';gSave('rhythm',st.score);lbPush('rhythm',st.score)}}
      g.fillStyle='#0a0a0e';g.fillRect(0,0,640,240);
      g.strokeStyle='#FF3B41';g.lineWidth=3;g.beginPath();g.arc(320,190,24,0,TAU);g.stroke();
      g.fillStyle='#FF3B41';st.notes.forEach(n=>{g.beginPath();g.arc(320,n.y,12,0,TAU);g.fill()});
      $('#gScore').textContent=st.score;
      G.raf=requestAnimationFrame(loop)})();
  }else if(key==='simon'){
    $('#gameTitle').innerHTML='MEMORY <b>GLOW</b>';
    cv.style.display='none';$('#simonPads').classList.add('on');
    const pads=[...document.querySelectorAll('.spad')];
    const st={seq:[],pos:0,busy:true,round:0};
    const tone=i=>{if(!AudioEngine.ready)return;const ac=AudioEngine.ac,t2=ac.currentTime;
      const o=ac.createOscillator();o.frequency.value=[330,415,494,587][i];
      const gn=AudioEngine.env(t2,.01,.25,.15);o.connect(gn);gn.connect(AudioEngine.master);o.start(t2);o.stop(t2+.3)};
    const lit=(i,ms=340)=>{pads[i].classList.add('lit');tone(i);setTimeout(()=>pads[i].classList.remove('lit'),ms)};
    const play=()=>{st.busy=true;$('#gameMsg').textContent='WATCH THE SEQUENCE…';
      st.seq.push(Math.floor(Math.random()*4));
      st.seq.forEach((p,i)=>setTimeout(()=>lit(p),500+i*520));
      setTimeout(()=>{st.busy=false;st.pos=0;$('#gameMsg').textContent='YOUR TURN'},500+st.seq.length*520)};
    const tap=e=>{if(st.busy)return;const i=+e.currentTarget.dataset.i;lit(i,200);
      if(i===st.seq[st.pos]){st.pos++;
        if(st.pos>=st.seq.length){st.round++;$('#gScore').textContent=st.round*40;
          gSave('simon',st.round*40);setTimeout(play,700)}}
      else{$('#gameMsg').textContent='PATTERN LOST — ROUND '+st.round+' — CLOSE & RETRY';st.busy=true;lbPush('simon',st.round*40)}};
    pads.forEach(p=>p.addEventListener('pointerdown',tap));
    G.cleanup=()=>{pads.forEach(p=>p.removeEventListener('pointerdown',tap));st.seq=[]};
    setTimeout(play,600);
  }else if(key==='maze'){
    $('#gameTitle').innerHTML='TWKTK <b>MAZE</b>';
    $('#gameMsg').textContent='ARROWS / WASD — REACH THE SIGNAL BEFORE BLACKOUT';
    const CO=25,RO=9,CS=24,OX=(640-CO*CS)/2,OY=(240-RO*CS)/2;
    const id=(x,y)=>y*CO+x;
    // perfect maze — recursive backtracker
    const wl=Array.from({length:CO*RO},()=>({n:1,s:1,e:1,w:1}));
    const vis=new Array(CO*RO).fill(false);
    const stk=[[0,0]];vis[0]=true;
    while(stk.length){
      const [cx,cy]=stk[stk.length-1];
      const opts=[[1,0,'e','w'],[-1,0,'w','e'],[0,1,'s','n'],[0,-1,'n','s']].filter(([dx,dy])=>{
        const nx=cx+dx,ny=cy+dy;return nx>=0&&nx<CO&&ny>=0&&ny<RO&&!vis[id(nx,ny)]});
      if(!opts.length){stk.pop();continue}
      const [dx,dy,a,b2]=opts[Math.floor(Math.random()*opts.length)];
      wl[id(cx,cy)][a]=0;wl[id(cx+dx,cy+dy)][b2]=0;
      vis[id(cx+dx,cy+dy)]=true;stk.push([cx+dx,cy+dy])}
    const st={x:0,y:0,time:40,score:0,done:false,glow:0,last:performance.now(),shards:[]};
    while(st.shards.length<4){
      const sx=Math.floor(rnd(2,CO-1)),sy=Math.floor(rnd(0,RO));
      if(!st.shards.some(s2=>s2.x===sx&&s2.y===sy)&&!(sx===CO-1&&sy===RO-1))st.shards.push({x:sx,y:sy})}
    const finish=msg=>{st.done=true;$('#gameMsg').textContent=msg;
      gSave('maze',st.score);lbPush('maze',st.score)};
    const move=(dx,dy)=>{
      const c=wl[id(st.x,st.y)];
      if((dx>0&&c.e)||(dx<0&&c.w)||(dy>0&&c.s)||(dy<0&&c.n))return;
      st.x=clamp(st.x+dx,0,CO-1);st.y=clamp(st.y+dy,0,RO-1);
      const si=st.shards.findIndex(s2=>s2.x===st.x&&s2.y===st.y);
      if(si>=0){st.shards.splice(si,1);st.score+=60;AudioEngine.blip()}
      if(st.x===CO-1&&st.y===RO-1){st.score+=Math.ceil(st.time)*10;
        finish('SIGNAL FOUND — '+st.score+' PTS — TAP TO RE-ENTER')}};
    const DIRS={ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1],
      ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0]};
    const kd=e=>{if(!DIRS[e.code])return;e.preventDefault();
      if(st.done){closeGame();openGame('maze');return}
      move(...DIRS[e.code])};
    const tap=e=>{if(st.done){closeGame();openGame('maze');return}
      const r=cv.getBoundingClientRect();
      const px=(e.clientX-r.left)*(cv.width/r.width)-(OX+st.x*CS+CS/2);
      const py=(e.clientY-r.top)*(cv.height/r.height)-(OY+st.y*CS+CS/2);
      if(Math.abs(px)>Math.abs(py))move(px>0?1:-1,0);else move(0,py>0?1:-1)};
    cv.addEventListener('pointerdown',tap);addEventListener('keydown',kd);
    G.cleanup=()=>{cv.removeEventListener('pointerdown',tap);removeEventListener('keydown',kd)};
    (function loop(){if(G.active!=='maze')return;
      const now=performance.now(),dt=Math.min(.05,(now-st.last)/1000);st.last=now;st.glow+=dt*3;
      if(!st.done){st.time-=dt;
        if(st.time<=0){st.time=0;finish('BLACKOUT — THE MAZE KEEPS ITS SECRET — TAP TO RETRY')}}
      g.fillStyle='#0a0a0e';g.fillRect(0,0,640,240);
      g.fillStyle='rgba(217,217,217,.12)';g.fillRect(OX,1,CO*CS,3);
      g.fillStyle=st.time<10?'#FF3B41':'#FF3B41';g.fillRect(OX,1,CO*CS*(st.time/40),3);
      g.strokeStyle='#3a3a46';g.lineWidth=2;g.beginPath();
      for(let y=0;y<RO;y++)for(let x=0;x<CO;x++){
        const c=wl[id(x,y)],px=OX+x*CS,py=OY+y*CS;
        if(c.n){g.moveTo(px,py);g.lineTo(px+CS,py)}
        if(c.w){g.moveTo(px,py);g.lineTo(px,py+CS)}
        if(x===CO-1&&c.e){g.moveTo(px+CS,py);g.lineTo(px+CS,py+CS)}
        if(y===RO-1&&c.s){g.moveTo(px,py+CS);g.lineTo(px+CS,py+CS)}}
      g.stroke();
      const gx=OX+(CO-1)*CS,gy=OY+(RO-1)*CS;
      g.fillStyle=`rgba(74,255,136,${.55+Math.sin(st.glow*2)*.35})`;
      g.fillRect(gx+5,gy+5,CS-10,CS-10);
      g.fillStyle='#FF3B41';
      st.shards.forEach(s2=>{const cx2=OX+s2.x*CS+CS/2,cy2=OY+s2.y*CS+CS/2;
        g.save();g.translate(cx2,cy2);g.rotate(Math.PI/4);g.fillRect(-5,-5,10,10);g.restore()});
      const ppx=OX+st.x*CS+CS/2,ppy=OY+st.y*CS+CS/2;
      g.fillStyle='#FF3B41';g.fillRect(ppx-7,ppy-7,14,14);
      g.strokeStyle='rgba(255,59,65,.5)';g.lineWidth=1;g.strokeRect(ppx-10,ppy-10,20,20);
      $('#gScore').textContent=st.score;
      G.raf=requestAnimationFrame(loop)})();
  }
}

/* ================= arcade leaderboard — the floor remembers ================= */
const LB_GAMES=[['runner','TWKTK RUNNER'],['rhythm','RHYTHM DROP'],['simon','MEMORY GLOW'],['maze','TWKTK MAZE']];
const escH=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function lbName(){return (worldStore.getItem('twktk_name')||'OPERATIVE').toUpperCase()}
function lbData(){try{return JSON.parse(worldStore.getItem('twktk_lb'))||{}}catch(e){return {}}}
function lbPush(k,score){score=Math.round(score);if(score<=0)return;
  const d=lbData();(d[k]=d[k]||[]).push({n:lbName(),s:score,t:Date.now()});
  d[k].sort((a,b)=>b.s-a.s);d[k]=d[k].slice(0,5);
  worldStore.setItem('twktk_lb',JSON.stringify(d));
  if(State.world&&State.world.lbMat){const old=State.world.lbMat.map;
    State.world.lbMat.map=lbTexture();State.world.lbMat.needsUpdate=true;
    if(old&&old.dispose)old.dispose()}}
function lbTexture(){
  return canvasTex(512,332,(g,w,h)=>{
    g.fillStyle='#050507';g.fillRect(0,0,w,h);
    g.strokeStyle='#FFFFFF';g.lineWidth=4;g.strokeRect(6,6,w-12,h-12);
    g.font='bold 26px Syncopate,sans-serif';g.textAlign='center';g.fillStyle='#FFFFFF';
    g.fillText('LEADERBOARD',w/2,44);
    g.font='11px "IBM Plex Mono",monospace';g.fillStyle='#8B8B9E';
    g.fillText('THE FLOOR REMEMBERS',w/2,64);
    const d=lbData();
    LB_GAMES.forEach(([k,nm],i)=>{
      const cx=i%2?w/2+18:22,cy=98+Math.floor(i/2)*116;
      g.textAlign='left';g.font='bold 14px Syncopate,sans-serif';g.fillStyle='#FF3B41';
      g.fillText(nm,cx,cy);
      g.font='13px "IBM Plex Mono",monospace';
      const rows=(d[k]||[]).slice(0,3);
      if(!rows.length){g.fillStyle='#55555f';g.fillText('— no runs —',cx,cy+22)}
      rows.forEach((r,j)=>{g.fillStyle='#D9D9D9';g.fillText((j+1)+'. '+String(r.n).slice(0,10),cx,cy+22+j*20);
        g.fillStyle='#FF3B41';g.fillText(String(r.s),cx+168,cy+22+j*20)})})})}
function renderLb(){
  const d=lbData();
  $('#lbGrid').innerHTML=LB_GAMES.map(([k,nm])=>{
    const rows=d[k]||[];
    return `<div class="lb-col"><h5>${nm}</h5>${
      rows.length?rows.map((r,i)=>`<div class="lb-row"><b>${i+1}. ${escH(r.n)}</b><span class="s">${r.s}</span></div>`).join('')
      :'<div class="lb-row empty">NO RUNS LOGGED — BE FIRST</div>'}</div>`}).join('');
  $('#lbNameIn').value=worldStore.getItem('twktk_name')||''}
function openLb(){renderLb();$('#lbOv').classList.remove('hide');AudioEngine.blip()}
$('#lbClose').addEventListener('click',()=>$('#lbOv').classList.add('hide'));
$('#gameLb').addEventListener('click',()=>{closeGame();openLb()});
$('#lbNameSave').addEventListener('click',()=>{
  const v=$('#lbNameIn').value.trim().slice(0,12).toUpperCase()||'OPERATIVE';
  worldStore.setItem('twktk_name',v);renderLb();
  toast('<b>TAG SAVED</b> — the floor will remember '+escH(v))});

/* ================= wardrobe — characters + festival fits ================= */
const CHARS=[
  {n:'ASH',skin:0xc9a080,sc:1},
  {n:'VEER',skin:0x8a5a3a,sc:1.04},
  {n:'NOOR',skin:0xe8c39c,sc:.96},
  {n:'KAI',skin:0x6a4530,sc:1}];
const FITS=[
  {n:'MIDNIGHT OPERATIVE',jacket:0x1a1a22,jm:.15,jr:.6,pants:0x111116,zip:0xff3b41,cap:0x50151a,shoe:0xd9d9d9},
  {n:'CHROME COURIER',jacket:0xd9d9d9,jm:.85,jr:.25,pants:0x2a2a32,zip:0xd81f26,cap:null,shoe:0x111116},
  {n:'GOLDEN HOUR',jacket:0xd8a848,jm:.2,jr:.5,pants:0x4a3a28,zip:0xfff2e0,cap:0xf2ede2,shoe:0xf2ede2},
  {n:'NEON RAVER',jacket:0x0f5a5a,jm:.1,jr:.55,pants:0x101014,zip:0x4affd8,cap:null,shoe:0x4affd8},
  {n:'FESTIVAL WHITE',jacket:0xf2ede2,jm:0,jr:.7,pants:0xcabfae,zip:0xd8a848,cap:null,shoe:0xd81f26},
  {n:'CRIMSON INSIDER',jacket:0x7a1418,jm:.1,jr:.5,pants:0x111116,zip:0xffc878,cap:0x0e0e14,shoe:0xd9d9d9}];
function avatarPrefs(){
  try{const p=JSON.parse(worldStore.getItem('twktk_avatar'))||{};
    return {c:Math.abs(p.c|0)%CHARS.length,f:Math.abs(p.f|0)%FITS.length}}
  catch(e){return {c:0,f:0}}}
function applyAvatarStyle(A,p){
  if(A.glb)return; // rigged GLB character keeps its authored materials
  const ch=CHARS[p.c],ft=FITS[p.f];
  A.mSkin.color.setHex(ch.skin);
  A.mJacket.color.setHex(ft.jacket);A.mJacket.metalness=ft.jm;A.mJacket.roughness=ft.jr;
  A.mPants.color.setHex(ft.pants);
  A.mShoe.color.setHex(ft.shoe);
  A.zip.material.emissive.setHex(ft.zip);
  A.cap.visible=ft.cap!==null;
  if(ft.cap!==null)A.cap.material.color.setHex(ft.cap);
  A.root.scale.setScalar(ch.sc)}
const hex6=n=>'#'+n.toString(16).padStart(6,'0');
function renderWardrobe(){
  const p=avatarPrefs();
  $('#wardChars').innerHTML=CHARS.map((c,i)=>`
    <button class="ward-chip${i===p.c?' on':''}" data-wc="${i}"><i style="background:${hex6(c.skin)}"></i>${c.n}</button>`).join('');
  $('#wardGrid').innerHTML=FITS.map((f,i)=>`
    <div class="ward-card${i===p.f?' on':''}" data-wf="${i}">
      <div class="ward-sw"><i style="background:${hex6(f.jacket)}"></i><i style="background:${hex6(f.pants)}"></i><i style="background:${hex6(f.zip)}"></i></div>
      <div class="wn">${f.n}</div></div>`).join('')}
function openWardrobe(){renderWardrobe();$('#wardOv').classList.remove('hide');AudioEngine.blip()}
function setAvatarPref(k,v){
  const p=avatarPrefs();p[k]=v;worldStore.setItem('twktk_avatar',JSON.stringify(p));
  if(State.world&&State.world.avatar)applyAvatarStyle(State.world.avatar,avatarPrefs());
  renderWardrobe()}
$('#wardOv').addEventListener('click',e=>{
  const wc=e.target.closest('[data-wc]'),wf=e.target.closest('[data-wf]');
  if(wc){setAvatarPref('c',+wc.dataset.wc);AudioEngine.blip()}
  if(wf){setAvatarPref('f',+wf.dataset.wf);AudioEngine.blip()}});
$('#wardClose').addEventListener('click',()=>{$('#wardOv').classList.add('hide');
  toast('<b>FIT LOCKED</b> — if you know, you wear it.')});

/* ================= quality manager ================= */
let qualityBloom=.35,qMode='auto',fpsAcc=0,fpsN=0,fpsT=0;
$('#qChip').addEventListener('click',()=>{
  qMode=qMode==='auto'?'high':qMode==='high'?'low':'auto';
  $('#qChip').textContent='FX '+qMode.toUpperCase();
  applyQ(qMode==='low'?'low':'high');
});
let appliedQuality=null;
function applyQ(level){
  if(appliedQuality===level)return;appliedQuality=level;
  if(level==='low'){renderer.setPixelRatio(1);qualityBloom=.2}
  else{renderer.setPixelRatio(Math.min(devicePixelRatio,isTouch?1.25:1.75));qualityBloom=.35}
  renderer.shadowMap.enabled=level!=='low'&&!isTouch;
  composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);setFxaaRes();
  if(State.phase==='world')bloom.strength=qualityBloom; // outside phases manage their own (lower) bloom
}
function autoQ(dt){
  if(qMode!=='auto')return;
  fpsAcc+=dt;fpsN++;fpsT+=dt;
  if(fpsT>3){const avg=fpsN/fpsAcc;
    if(avg<40)applyQ('low');else if(avg>55)applyQ('high');
    fpsAcc=0;fpsN=0;fpsT=0}
}

/* ================= main loop ================= */
const clock=new THREE.Clock();
function tick(forceDt){
  const dt=forceDt!==undefined?forceDt:Math.min(.05,clock.getDelta());
  tickers.slice().forEach(f=>f(dt));
  autoQ(dt);
  composer.render();
}
renderer.setAnimationLoop(()=>tick());

/* ================= debug / power API ================= */
window.TWKTK={
  get phase(){return State.phase},
  city:k=>selectCity(k),
  choose:k=>chooseEntry(k),
  skip:()=>$('#skipBtn').click(),
  tick:(dt=.016)=>tick(dt),
  zones:()=>[...State.zones],
  interact:label=>{const it=interactables.find(i=>i.label.includes(label));if(it)it.action()},
  list:()=>interactables.map(i=>i.label),
  teleport:(x,z)=>{player.pos.set(x,groundH(x,z,1e3),z)},
  tp:(x,z,l='DEBUG JUMP')=>tpTo(x,z,l),
  game:k=>openGame(k),
  map:()=>toggleMap(),
  navcheck:()=>navCheck(),
  y:()=>player.pos.y,
  pos:()=>({x:+player.pos.x.toFixed(2),y:+player.pos.y.toFixed(2),z:+player.pos.z.toFixed(2),yaw:+look.yaw.toFixed(2)}),
};
/* bridge for the multiplayer layer (assets/social.js) */
window.TWKTK_WORLD={
  ready:()=>State.phase==='world'&&!!State.world,
  scene:()=>State.world&&State.world.scene,
  pos:()=>({x:player.pos.x,y:player.pos.y,z:player.pos.z,
    yaw:(State.world&&State.world.avatar)?State.world.avatar.yaw:0,
    speed:Math.hypot(player.vel.x,player.vel.z),
    sitting:!!(State.world&&State.world.sitting)}),
  groundH:(x,z)=>{try{return groundH(x,z,1e3)}catch(e){return 0}},
  zones:()=>ZONES.map(z=>({n:z.n,x:z.x,z:z.z,r:z.r})),
  fig:o=>personFig(0x3a5a7a,o||{v:1}),
  toast:(h,ms)=>toast(h,ms),
  blip:()=>AudioEngine.blip(),
  wave:()=>{if(State.world&&State.world.avatar)State.world.avatar.wave=.8},
  session:()=>({user:SESSION.user}),
  avatarInfo:()=>{const A=State.world&&State.world.avatar;
    return A?{glb:!!A.glb,mixer:!!A.mixer,clips:A.clips?Object.keys(A.clips):null,
      bones:A.bones?Object.keys(A.bones):null,height:A.glbHeight||null}:null},
  THREE:THREE
};
// landing: city selection over the rotating Earth — no gate, no ticket
startDescentBackdrop();
// deep-link: ?city=mumbai&phase=world — poll phases instead of racing timers
if(params.get('city')&&CITIES[params.get('city')]){
  const wantWorld=params.get('phase')==='world';
  const poll=setInterval(()=>{
    if(State.phase==='city'){selectCity(params.get('city'));
      if(wantWorld&&State.descent&&State.descent.anim){State.descent.t=1;descentAnim(0)}
      if(!wantWorld)clearInterval(poll)}
    else if(wantWorld&&State.phase==='shuttle'&&State.shuttle){
      State.shuttle.u=Math.max(State.shuttle.u,.999)}
    else if(wantWorld&&State.phase==='arrival'){chooseEntry('enter');clearInterval(poll)}
    else if(State.phase==='world'||State.phase==='loading')clearInterval(poll);
  },300);
}
fadeOut(1400);
// No offline worker or local persistent business data.

addEventListener('blur',()=>{Object.keys(keys).forEach(k=>keys[k]=false);window.__sprintTouch=false;joy.x=joy.y=0;});
document.addEventListener('visibilitychange',()=>{renderer.setAnimationLoop(document.hidden?null:()=>tick());if(document.hidden){Object.keys(keys).forEach(k=>keys[k]=false);AudioEngine.ac?.suspend();}else if(AudioEngine.on){AudioEngine.ac?.resume();}});








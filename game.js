'use strict';
const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const types = [ {color:'#e97970',points:10,speed:48}, {color:'#63b4c8',points:20,speed:68}, {color:'#aa89d0',points:35,speed:92}, {color:'#e8b451',points:50,speed:120} ];
const levels = [
 ['First flight',6,1.25,1,1],['Blue horizon',8,1.15,1.08,2],['Picking up',10,1.05,1.17,2],['Violet hour',12,.95,1.25,3],['Crosswinds',14,.85,1.35,3],['Golden skies',16,.78,1.45,4],['Rush hour',18,.70,1.55,4],['High altitude',20,.62,1.65,4],['Sky dancer',22,.55,1.78,4],['Master of the wind',25,.48,1.9,4]
];
let state='intro',level=0,score=0,hits=0,lives=5,balloons=[],arrows=[],particles=[],archerY=345,spawn=0,cooldown=0,last=0,shotTime=0;
let spaceHeld=0,machineGun=false,robot=false,werewolf=false,wolfStrike=null,explosions=[],moveSoundTimer=0;
const keys = new Set();
// Bounds include the head (62px above the bow) and feet (116px below).
const clampArcher = y => Math.max(62, Math.min(canvas.height - 116, y));
function hud(){ $('score').textContent=score.toLocaleString();$('level').textContent=`${String(level+1).padStart(2,'0')} / 10`;$('targets').textContent=`${hits} / ${levels[level][1]}`;$('lives').textContent='♥ '.repeat(lives)||'—';$('progress').style.width=`${hits/levels[level][1]*100}%`;$('levelName').textContent=`${String(level+1).padStart(2,'0')} — ${levels[level][0]}`; }
function modal(title,message,button,eyebrow){$('title').textContent=title;$('message').textContent=message;$('action').textContent=button;$('eyebrow').textContent=eyebrow;$('overlay').classList.remove('hidden');}
function begin(){wolfStrike=null;effectSound(440,660,.12);explosions=[];spaceHeld=0;machineGun=false;keys.clear();confetti=[];state='playing';balloons=[];arrows=[];particles=[];spawn=.25;cooldown=0;shotTime=0;archerY=345;$('overlay').classList.add('hidden');$('pause').textContent='Pause · P';hud();}
$('action').onclick=()=>{if(state==='paused'){pause();return;}if(state==='between')level++;else{level=0;score=0;lives=5;robot=false;werewolf=false;}hits=0;begin();};
function pause(){effectSound(400,300,.08);if(state==='playing'){state='paused';keys.clear();releaseGun();modal('Take a breath.','Your arrows and balloons will wait for you.','Resume →','PAUSED');$('pause').textContent='Resume · P';}else if(state==='paused'){state='playing';$('overlay').classList.add('hidden');$('pause').textContent='Pause · P';}}
$('pause').onclick=pause;
// Audio is unlocked by a player gesture; no external sound files are needed.
let audioContext;
function unlockAudio(){
 try{const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;if(!Audio)return;
 audioContext ||= new Audio();if(audioContext.state==='suspended')audioContext.resume().then(startMusic).catch(()=>{});else startMusic();
 }catch{} // Audio availability must not interrupt gameplay.
}
addEventListener('pointerdown',unlockAudio);
addEventListener('keydown',unlockAudio);
// Original eight-bar folk/arcade theme, rendered once and looped by the audio clock.
let musicSource, musicGain, musicEnabled=true;
function buildMusicBuffer(context){
 const beat=60/112, duration=32*beat, rate=context.sampleRate;
 const buffer=context.createBuffer(1,Math.round(duration*rate),rate),data=buffer.getChannelData(0);
 const frequency=midi=>440*Math.pow(2,(midi-69)/12);
 function note(midi,start,length,volume,voice){
 const offset=Math.round(start*rate),count=Math.floor(length*rate),hz=frequency(midi);
 for(let i=0;i<count&&offset+i<data.length;i++){
 const t=i/rate,phase=2*Math.PI*hz*t;
 const envelope=Math.min(1,t/.012)*Math.min(1,(length-t)/.06)*Math.exp(-t*(voice==='pluck'?4:1.3));
 const wave=voice==='pluck'?(Math.sin(phase)+.3*Math.sin(phase*2)+.12*Math.sin(phase*3))/1.42:Math.sin(phase);
 data[offset+i]+=wave*envelope*volume;
 }
 }
 const chords=[[48,52,55],[55,59,62],[57,60,64],[53,57,60],[48,52,55],[53,57,60],[55,59,62],[48,52,55]];
 const melody=[[72,76,79,76,74,76,72,67],[71,74,79,74,76,74,71,67],[72,76,81,79,76,72,76,79],[77,76,74,72,69,72,74,76],[79,76,72,76,79,84,83,79],[81,77,76,74,77,76,72,69],[71,74,79,83,81,79,74,71],[72,76,79,76,74,72,67,72]];
 chords.forEach((chord,bar)=>{
 const start=bar*4*beat;
 for(let step=0;step<8;step++){
 note(melody[bar][step],start+step*beat/2,beat*.44,.13,'pluck');
 note(chord[step%3]+12,start+step*beat/2,beat*.4,.045,'pluck');
 }
 for(let pulse=0;pulse<4;pulse++){
 note(chord[pulse%2?2:0]-12,start+pulse*beat,beat*.75,.12,'bass');
 // Soft pitched percussion keeps the loop buoyant without obscuring effects.
 const offset=Math.round((start+pulse*beat)*rate);
 for(let i=0;i<rate*.09&&offset+i<data.length;i++){
 const t=i/rate;data[offset+i]+=.07*Math.sin(2*Math.PI*(90*t-200*t*t))*Math.exp(-t*45)*Math.min(1,t/.004);
 }
 }
 });
 return buffer;
}
function startMusic(){
 if(!musicEnabled||musicSource||!audioContext||audioContext.state!=='running')return;
 musicGain=audioContext.createGain();musicGain.gain.setValueAtTime(.65,audioContext.currentTime);
 musicSource=audioContext.createBufferSource();musicSource.buffer=buildMusicBuffer(audioContext);musicSource.loop=true;
 musicSource.connect(musicGain);musicGain.connect(audioContext.destination);musicSource.start();
}
$('music').onclick=()=>{effectSound(600,450,.06);
 musicEnabled=!musicEnabled;
 $('music').textContent=musicEnabled?'Music: on':'Music: off';
 $('music').setAttribute('aria-pressed',String(musicEnabled));
 if(musicGain)musicGain.gain.setTargetAtTime(musicEnabled?.65:0,audioContext.currentTime,.04);
 if(musicEnabled)unlockAudio();
};
function popSound(){
 if(!audioContext || audioContext.state!=='running')return;
 const t=audioContext.currentTime, duration=.09;
 const buffer=audioContext.createBuffer(1,Math.ceil(audioContext.sampleRate*duration),audioContext.sampleRate);
 const data=buffer.getChannelData(0);
 for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,3);
 const noise=audioContext.createBufferSource(),gain=audioContext.createGain();noise.buffer=buffer;
 gain.gain.setValueAtTime(.35,t);gain.gain.exponentialRampToValueAtTime(.001,t+duration);
 noise.connect(gain);gain.connect(audioContext.destination);noise.start(t);noise.stop(t+duration);
 noise.onended=()=>{noise.disconnect();gain.disconnect();};
 const tone=audioContext.createOscillator(),envelope=audioContext.createGain();
 tone.frequency.setValueAtTime(420,t);tone.frequency.exponentialRampToValueAtTime(90,t+.07);
 envelope.gain.setValueAtTime(.22,t);envelope.gain.exponentialRampToValueAtTime(.001,t+.08);
 tone.connect(envelope);envelope.connect(audioContext.destination);tone.start(t);tone.stop(t+.08);
 tone.onended=()=>{tone.disconnect();envelope.disconnect();};
}
const confettiContext=document.getElementById('confetti').getContext('2d');
let confetti=[];
function celebrate(){
 const colors=['#ffd166','#ef476f','#06d6a0','#76caff','#bb8cff','#ffffff'];
 confetti=Array.from({length:150},(_,i)=>({
 x:i%2?1000:100,y:490,vx:(i%2?-1:1)*(100+Math.random()*400),
 vy:-330-Math.random()*420,rotation:Math.random()*Math.PI,
 spin:(Math.random()-.5)*12,life:3+Math.random()*1.5,color:colors[i%colors.length]
 }));
 if(!audioContext || audioContext.state!=='running')return;
 // A light ascending major chord, played only once per completed level.
 const now=audioContext.currentTime;
 [523.25,659.25,783.99,1046.5].forEach((frequency,i)=>{
 const tone=audioContext.createOscillator(),gain=audioContext.createGain(),t=now+i*.11;
 tone.type='sine';tone.frequency.setValueAtTime(frequency,t);
 gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.13,t+.015);
 gain.gain.exponentialRampToValueAtTime(.001,t+.35);
 tone.connect(gain);gain.connect(audioContext.destination);tone.start(t);tone.stop(t+.36);
 tone.onended=()=>{tone.disconnect();gain.disconnect();};
 });
}
function drawConfetti(dt){
 confettiContext.clearRect(0,0,1100,600);
 for(const p of confetti){
 p.life-=dt;p.vy+=300*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rotation+=p.spin*dt;
 confettiContext.save();confettiContext.globalAlpha=Math.max(0,Math.min(1,p.life));
 confettiContext.translate(p.x,p.y);confettiContext.rotate(p.rotation);
 confettiContext.fillStyle=p.color;confettiContext.fillRect(-4,-2,8,5);confettiContext.restore();
 }
 confetti=confetti.filter(p=>p.life>0&&p.y<650);
}
function shootSound(){
 if(!audioContext || audioContext.state!=='running')return;
 const t=audioContext.currentTime,tone=audioContext.createOscillator(),gain=audioContext.createGain();
 tone.type='triangle';tone.frequency.setValueAtTime(650,t);tone.frequency.exponentialRampToValueAtTime(110,t+.14);
 gain.gain.setValueAtTime(.001,t);gain.gain.linearRampToValueAtTime(.18,t+.008);gain.gain.exponentialRampToValueAtTime(.001,t+.16);
 tone.connect(gain);gain.connect(audioContext.destination);tone.start(t);tone.stop(t+.17);
 tone.onended=()=>{tone.disconnect();gain.disconnect();};
}
function gunSound(){
 if(!audioContext || audioContext.state!=='running')return;
 const t=audioContext.currentTime,source=audioContext.createBufferSource(),gain=audioContext.createGain();
 const buffer=audioContext.createBuffer(1,Math.ceil(audioContext.sampleRate*.055),audioContext.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,4);
 source.buffer=buffer;gain.gain.setValueAtTime(.22,t);gain.gain.exponentialRampToValueAtTime(.001,t+.055);
 source.connect(gain);gain.connect(audioContext.destination);source.start(t);source.stop(t+.06);
 source.onended=()=>{source.disconnect();gain.disconnect();};
}
function effectSound(from,to,duration=.15,type='triangle',volume=.10){
 if(!audioContext||audioContext.state!=='running')return;
 const t=audioContext.currentTime,o=audioContext.createOscillator(),g=audioContext.createGain();
 o.type=type;o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,t+duration);
 g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(volume,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+duration);
 o.connect(g);g.connect(audioContext.destination);o.start(t);o.stop(t+duration+.01);o.onended=()=>{o.disconnect();g.disconnect();};
}
function transform(){if(state!=='playing')return;robot=!robot;werewolf=false;wolfStrike=null;releaseGun();cooldown=0;shotTime=0;effectSound(robot?160:900,robot?900:160,.35,'sawtooth',.09);}
function monsterSound(){
 effectSound(95,35,.4,'sawtooth',.13);
 effectSound(140,55,.3,'triangle',.12);
}
function transformWolf(){
 if(state!=='playing')return;
 werewolf=!werewolf;robot=false;wolfStrike=null;releaseGun();cooldown=0;shotTime=0;monsterSound();
}
function wolfAttack(){
 const origin=wolfStrike?{x:wolfStrike.x,y:wolfStrike.y}:{x:137,y:archerY};
 let target=null,distance=Infinity;
 for(const b of balloons){if(b.dead||b.y<0||b.y>canvas.height)continue;const d=Math.hypot(b.x-origin.x,b.y-origin.y);if(d<distance){target=b;distance=d;}}
 cooldown=.5;monsterSound();
 if(!target)return;
 wolfStrike={x:Math.max(80,Math.min(canvas.width-100,target.x-65)),y:clampArcher(target.y),targetX:target.x,targetY:target.y,life:.35};
 popBalloon(target);hud();
}
function popBalloon(b){
 if(b.dead)return;b.dead=true;popSound();score+=b.t.points;hits++;
 for(let i=0;i<12;i++)particles.push({x:b.x,y:b.y,vx:(Math.random()-.5)*180,vy:(Math.random()-.5)*180,life:.6,color:b.t.color});
}
function explode(x,y){
 explosions.push({x,y,life:.5});effectSound(120,25,.4,'sawtooth',.22);gunSound();
 for(const b of balloons)if(!b.dead&&Math.hypot(b.x-x,b.y-y)<=135+b.r)popBalloon(b);
 hud();
}
function steerRocket(rocket,dt){
 const available=b=>!b.dead&&b.y>=-b.r&&b.y<=canvas.height+b.r;
 if(!rocket.target||!balloons.includes(rocket.target)||!available(rocket.target)){
 rocket.target=null;let nearest=Infinity;
 for(const b of balloons){if(!available(b))continue;const distance=Math.hypot(b.x-rocket.x,b.y-rocket.y);if(distance<nearest){nearest=distance;rocket.target=b;}}
 }
 if(!rocket.target)return;
 const target=rocket.target;
 const desired=Math.atan2(target.y-rocket.y,target.x-rocket.x),heading=Math.atan2(rocket.vy,rocket.vx);
 const difference=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));
 const turn=Math.max(-5*dt,Math.min(5*dt,difference)),angle=heading+turn;
 rocket.vx=580*Math.cos(angle);rocket.vy=580*Math.sin(angle);
}
function shoot(){if(state!=='playing'||cooldown>0)return;if(werewolf){wolfAttack();return;}
 arrows.push({x:robot?180:machineGun?176:137,y:archerY,vx:robot?580:machineGun?1150:760,vy:0,bullet:!robot&&machineGun,rocket:robot});
 cooldown=robot?.55:machineGun?.075:.28;shotTime=robot?.2:machineGun?.065:.24;
 if(robot)effectSound(180,65,.25,'sawtooth',.12);else if(machineGun)gunSound();else shootSound();
}
function releaseGun(){spaceHeld=0;machineGun=false;}

$('shoot').onclick=shoot;
addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='Space'&&state==='playing'&&!e.repeat)shoot();if(e.code==='KeyP'&&!e.repeat)pause();if(e.code==='KeyT'&&!e.repeat)transform();if(e.code==='KeyY'&&!e.repeat)transformWolf();});
addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space')releaseGun();});addEventListener('blur',()=>{keys.clear();releaseGun();if(state==='playing')pause();});
function moveToPointer(e){if(state!=='playing')return;const oldY=archerY,r=canvas.getBoundingClientRect();archerY=clampArcher((e.clientY-r.top)*canvas.height/r.height);if(oldY!==archerY&&moveSoundTimer<=0){effectSound(robot?110:220,robot?70:160,.06,'triangle',.025);moveSoundTimer=.18;}}
canvas.addEventListener('pointermove',moveToPointer);
canvas.addEventListener('pointerdown',e=>{moveToPointer(e);shoot();});
function update(dt){if(state!=='playing')return;if(wolfStrike){wolfStrike.life-=dt;if(wolfStrike.life<=0)wolfStrike=null;}const oldY=archerY;archerY=clampArcher(archerY+((keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0))*280*dt);moveSoundTimer-=dt;if(oldY!==archerY&&moveSoundTimer<=0){effectSound(robot?110:220,robot?70:160,.06,'triangle',.025);moveSoundTimer=.18;}explosions.forEach(e=>e.life-=dt);explosions=explosions.filter(e=>e.life>0);shotTime=Math.max(0,shotTime-dt);cooldown-=dt;if(werewolf){/* Werewolf attacks once per press. */}else if(keys.has('Space')&&robot)shoot();else if(keys.has('Space')){spaceHeld+=dt;if(spaceHeld>=.35){if(!machineGun)cooldown=0;machineGun=true;shoot();}}else releaseGun();spawn-=dt;const l=levels[level];if(spawn<=0){const t=types[Math.floor(Math.random()*l[4])];balloons.push({x:610+Math.random()*440,y:640,r:22,t,phase:Math.random()*6});spawn=l[2];}
 for(const b of balloons){b.y-=b.t.speed*l[3]*dt;b.phase+=dt;b.x+=Math.sin(b.phase)*dt*level*2;}
 for(const a of arrows){if(a.rocket)steerRocket(a,dt);const ox=a.x,oy=a.y;a.x+=a.vx*dt;a.y+=a.vy*dt;for(const b of balloons){if(b.dead)continue;const dx=a.x-ox,dy=a.y-oy,u=Math.max(0,Math.min(1,((b.x-ox)*dx+(b.y-oy)*dy)/(dx*dx+dy*dy)));if(((ox+u*dx-b.x)/b.r)**2+((oy+u*dy-b.y)/(b.r*1.25))**2<1){a.dead=true;if(a.rocket){explode(b.x,b.y);}else popBalloon(b);hud();break;}}}
 balloons=balloons.filter(b=>{if(b.dead)return false;if(b.y< -35){lives=Math.max(0,lives-1);effectSound(180,60,.2);hud();return false;}return true;});arrows=arrows.filter(a=>!a.dead&&a.x<1150&&a.y>-50&&a.y<650);
 for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);
 if(lives===0){state='over';modal('The sky wins this time.',`You scored ${score.toLocaleString()} points and reached level ${level+1}. Ready for another flight?`,'Try again →','ADVENTURE OVER');}else if(hits>=l[1]){state=level===9?'won':'between';celebrate();modal(level===9?'You mastered the sky!':`Level ${level+1} complete!`,level===9?`All 10 levels conquered. Final score: ${score.toLocaleString()} points.`:`${score.toLocaleString()} points earned. Next: ${levels[level+1][0]}. Your remaining lives carry forward.`,level===9?'Play again →':'Next level →',level===9?'SKYBOW CHAMPION':'NICE SHOOTING');}}
function line(x,y,x2,y2,color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
// Small integer-coordinate shapes create a crisp, outlined storybook sprite.
function drawArcher(){
 if(werewolf){
 const x=wolfStrike?wolfStrike.x:105,y=wolfStrike?wolfStrike.y:archerY;
 ctx.save();ctx.translate(x-45,y-60);
 const box=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
 const shape=(points,color)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();};
 // Pointed ears, long muzzle, amber eyes, shaggy shoulders and clawed limbs.
 shape([[15,26],[9,0],[30,14],[43,10],[58,0],[59,28]],'#42394c');
 box(17,18,43,36,'#625368');box(40,33,36,17,'#8b7886');box(70,33,9,10,'#282736');
 box(44,23,13,6,'#ffc64f');box(51,23,3,6,'#262333');box(47,47,24,7,'#322c3c');
 shape([[50,47],[55,47],[53,55]],'#fff4d6');shape([[63,47],[68,47],[65,55]],'#fff4d6');
 shape([[17,48],[50,48],[65,65],[54,91],[58,112],[43,102],[36,114],[25,103],[8,111],[13,86],[0,71]],'#514455');
 box(23,60,23,32,'#9a8290');box(12,105,17,39,'#625368');box(40,105,17,39,'#625368');
 box(3,140,28,21,'#42394c');box(38,140,30,21,'#42394c');
 const reach=wolfStrike?22:0;
 shape([[47,57],[60,54],[75+reach,65],[72+reach,76],[55,71]],'#736078');
 for(let i=0;i<3;i++){line(72+reach,66+i*4,83+reach,63+i*5,'#fff0d0',3);line(57+i*5,153,62+i*5,160,'#fff0d0',2);}
 ctx.restore();
 if(wolfStrike){ctx.globalAlpha=wolfStrike.life/.35;for(let i=0;i<3;i++)line(wolfStrike.targetX-22+i*12,wolfStrike.targetY-28,wolfStrike.targetX-5+i*12,wolfStrike.targetY+28,'#fff0c1',4);ctx.globalAlpha=1;}
 return;
 }

 if(robot){
 ctx.save();ctx.translate(75,archerY-60);
 const box=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
 box(7,6,47,36,'#243744');box(12,10,37,27,'#a4bec9');box(17,18,28,8,'#32eced');
 box(26,0,5,8,'#6b8998');box(24,0,9,4,'#ffbe61');
 box(0,46,62,55,'#365463');box(8,50,46,42,'#7c9da9');box(20,62,21,15,'#43e7d9');
 box(2,101,23,40,'#55717d');box(36,101,23,40,'#55717d');box(-3,140,30,22,'#263e4b');box(34,140,30,22,'#263e4b');
 box(43,48,35,20,'#a0b9bf');box(62,48,43,24,'#253947');box(67,51,35,6,'#6e8f99');box(100,46,9,28,'#4ce7dd');
 if(shotTime>0){box(110,53,14,12,'#ffbc58');box(124,57,8,5,'#fff2a8');}
 ctx.restore();return;
 }

 ctx.save();ctx.translate(38-4*Math.sin(shotTime/.24*Math.PI),Math.round(archerY)-60);ctx.scale(2,2);
 const ink='#182c20',green='#71b934',light='#a6d64c',skin='#f4d984',brown='#a66d2e';
 function shape(points,color){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=1;ctx.lineJoin='miter';ctx.stroke();}
 function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
 // Quiver, arrow fletching, and red feather.
 shape([[9,27],[17,25],[21,52],[12,54]],brown);
 for(let x=9;x<17;x+=3){rect(x,19,1,12,'#e8ce89');rect(x,19,2,6,'#e9422f');}
 shape([[23,15],[9,10],[0,3],[-8,1],[-3,6],[9,11],[23,17]],'#f33e2f');
 // Boots and legs stay within the same movement bounds as the original archer.
 shape([[19,58],[28,59],[25,73],[22,78],[14,79],[10,78],[17,74]],skin);
 shape([[31,58],[39,59],[36,74],[40,79],[34,81],[29,76]],skin);
 shape([[17,74],[23,76],[22,81],[14,83],[-5,83],[-5,81],[9,79]],green);
 shape([[29,74],[36,75],[37,79],[45,82],[45,84],[28,84],[26,81]],green);
 // Tunic and belt.
 shape([[17,31],[29,29],[36,34],[32,49],[38,59],[32,57],[29,63],[25,59],[19,63],[18,57],[13,58],[18,46]],green);
 shape([[18,33],[22,32],[35,54],[32,57]],brown);
 shape([[16,49],[33,51],[34,54],[16,52]],brown);rect(25,50,4,3,'#edc44c');
 // Face, hair, pointed cap.
 shape([[20,16],[34,16],[36,21],[35,24],[39,25],[35,27],[35,31],[25,32],[20,27]],skin);
 shape([[18,17],[25,17],[23,21],[20,20],[21,26],[18,25]],'#ddbb4b');
 shape([[14,7],[22,11],[31,14],[39,17],[17,17],[17,23],[14,20]],green);
 rect(28,21,2,2,ink);rect(33,21,2,1,ink);rect(29,28,5,1,ink);
 // Outstretched sleeve and hands at the horizontal arrow height.
 shape([[22,33],[29,32],[34,33],[36,30],[48,30],[48,34],[36,36],[31,39],[24,38]],skin);
 shape([[19,32],[26,32],[26,39],[19,39]],light);
 shape([[46,28],[50,28],[51,30],[50,34],[46,34]],skin);
 if(machineGun){
 // A blocky arcade weapon, with a stock, magazine, barrel and muzzle flash.
 rect(27,28,12,6,'#694b35');rect(37,26,22,8,'#25333c');rect(40,26,18,2,'#647d87');
 rect(45,34,7,10,'#263841');rect(59,28,10,4,'#172832');rect(67,27,3,6,'#536873');
 rect(41,23,3,3,'#172832');rect(61,25,2,3,'#172832');
 if(shotTime>0){shape([[70,29],[77,25],[75,29],[82,30],[75,32],[77,35],[70,32]],'#ffd46c');}
 }else{
 // Tall green bow and taut string.
 ctx.strokeStyle=ink;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(50,0);ctx.lineTo(47,2);ctx.lineTo(46,7);ctx.lineTo(48,15);ctx.lineTo(52,26);ctx.lineTo(53,35);ctx.lineTo(51,46);ctx.lineTo(47,59);ctx.lineTo(46,65);ctx.lineTo(48,69);ctx.lineTo(51,70);ctx.stroke();
 const release=shotTime/.24;
 const stringX=49-8*release*Math.cos((1-release)*Math.PI*4);
 line(49,1,stringX,30,'#eee9ba',.6);line(stringX,30,49,69,'#eee9ba',.6);
 // Drawing hand recoils toward the cheek, then returns to its resting position.
 shape([[30,32],[34,30],[40-12*release,28],[42-12*release,30],[35,35]],skin);
 if(shotTime===0){line(31,30,65,30,ink,1);rect(64,29,3,2,'#e9dfbb');}
 }
 ctx.restore();
}
const settings = [
 ['Plains','#91c7db','#f4e7b5','#76a76e'],['Forest','#183e48','#8cbd91','#294e39'],
 ['Town','#f2b59b','#ffe5bb','#9e715e'],['City','#253657','#a683ab','#363d59'],
 ['Castle','#788fae','#d5dce0','#536779'],['Desert','#dd874a','#ffe0a0','#bc813d'],
 ['Hell','#280e28','#e34c30','#512331'],['Heaven','#8acbe6','#fff7e2','#e3eaf3'],
 ['Robotic','#102f40','#237b81','#173c4b'],['Space','#090c2c','#402d70','#25204c']
];
function drawBackground(){
 const [name,top,bottom,ground]=settings[level];
 const g=ctx.createLinearGradient(0,0,0,600);g.addColorStop(0,top);g.addColorStop(1,bottom);ctx.fillStyle=g;ctx.fillRect(0,0,1100,600);
 const box=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
 const circle=(x,y,r,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
 const triangle=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w/2,y-h);ctx.lineTo(x+w,y);ctx.fill();};
 if([0,2,5].includes(level))circle(885,105,45,'#fff0b8');
 if(level===0){for(let i=0;i<3;i++){ctx.fillStyle=['#a6c49a','#86b27e',ground][i];ctx.beginPath();ctx.moveTo(0,600);for(let x=0;x<=1100;x+=10)ctx.lineTo(x,430+i*55+Math.sin(x/180+i)*30);ctx.lineTo(1100,600);ctx.fill();}for(let x=20;x<1100;x+=43){box(x,557,2,12,'#416d48');circle(x+1,554,3,'#f8db8d');}}
 if(level===1){for(let i=0;i<15;i++){const x=i*83;box(x+25,220,15,350,'#345346');for(let j=0;j<3;j++)triangle(x-25,270+j*85,115,170,i%2?'#315e4d':'#40785c');}}
 if(level===2){for(let i=0;i<8;i++){const x=15+i*145,y=390+i%2*35;box(x,y,120,180,'#d99c75');triangle(x-10,y,140,80,'#9b5457');box(x+45,y+100,30,80,'#754e49');box(x+15,y+30,25,35,'#f6d99a');box(x+80,y+30,25,35,'#f6d99a');}}
 if(level===3){circle(870,100,35,'#f3d7d5');for(let i=0;i<12;i++){const x=i*100,y=210+(i*71)%170;box(x,y,85,360,'#303b57');for(let row=0;row<6;row++)for(let col=0;col<3;col++)box(x+12+col*24,y+20+row*40,10,17,(row+col+i)%3?'#b99b79':'#58617c');}}
 if(level===4){box(180,340,760,230,'#788893');for(let x=180;x<940;x+=45)box(x,320,24,25,'#788893');for(const x of [160,425,690,900]){box(x,250,75,320,'#596c7c');triangle(x-10,250,95,85,'#424f73');box(x+28,280,18,45,'#283b4c');line(x+38,165,x+38,130,'#384c5e',2);triangle(x+39,151,36,20,'#b85e69');}box(510,445,90,125,'#314554');}
 if(level===5){triangle(200,570,440,280,'#d49b52');triangle(620,570,350,220,'#e8b76a');for(const x of [100,950]){box(x,420,17,150,'#657647');box(x-30,450,30,14,'#657647');box(x-30,420,12,35,'#657647');box(x+12,480,30,14,'#657647');box(x+30,450,12,40,'#657647');}}
 if(level===6){for(let i=0;i<10;i++)triangle(i*125-30,600,170,160+(i%3)*80,'#382039');for(let i=0;i<20;i++){triangle(i*60,590,50,40+i%4*17,'#f68039');circle((i*137)%1100,150+(i*73)%380,3,'#ffb565');}box(0,575,1100,25,'#e95428');}
 if(level===7){for(let i=0;i<13;i++){const x=i*100,y=360+(i%3)*65;for(let j=0;j<3;j++)circle(x+j*25,y-j%2*12,36,'#fff9eb');}for(const x of [260,800]){box(x,240,32,270,'#f7f1dd');box(x-12,230,56,16,'#dacba3');box(x-12,510,56,16,'#dacba3');}circle(550,120,55,'#fff5c5');}
 if(level===8){for(let i=0;i<11;i++){const x=i*105;box(x,350-i%3*50,65,250,'#204e5b');box(x+10,370-i%3*50,45,8,'#68d9cb');line(x+32,350-i%3*50,x+32,290-i%3*50,'#63b5ba',2);circle(x+32,285-i%3*50,5,'#a2f0cc');}for(let y=30;y<560;y+=55){line(0,y,1100,y,'#519ba322',1);}for(let x=0;x<1100;x+=55)line(x,0,x,560,'#519ba322',1);}
 if(level===9){for(let i=0;i<100;i++)circle((i*173+31)%1100,(i*97+13)%550,i%4===0?2:1,'#d9def5');circle(860,150,65,'#ad8bc6');ctx.strokeStyle='#dfb4d5';ctx.lineWidth=9;ctx.beginPath();ctx.ellipse(860,150,105,23,-.3,0,Math.PI*2);ctx.stroke();circle(250,100,23,'#6d9fbf');}
 if(level!==6)box(0,575,1100,25,ground);
 ctx.fillStyle='#ffffffaa';ctx.font='12px system-ui';ctx.fillText(name.toUpperCase(),22,28);
}
function draw(){drawBackground();
 drawArcher();
 for(const b of balloons){line(b.x,b.y+27,b.x+Math.sin(b.phase)*8,b.y+68,'#54776d',1);ctx.fillStyle=b.t.color;ctx.beginPath();ctx.ellipse(b.x,b.y,b.r,b.r*1.25,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffffff55';ctx.beginPath();ctx.ellipse(b.x-7,b.y-9,5,9,.3,0,Math.PI*2);ctx.fill();ctx.fillStyle=b.t.color;ctx.beginPath();ctx.moveTo(b.x,b.y+25);ctx.lineTo(b.x-5,b.y+32);ctx.lineTo(b.x+5,b.y+32);ctx.fill();}
 for(const e of explosions){ctx.globalAlpha=e.life*1.5;ctx.fillStyle='#ffb348';ctx.beginPath();ctx.arc(e.x,e.y,135*(1-e.life/.5),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}for(const a of arrows){if(a.rocket){ctx.save();ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(a.vy,a.vx));line(-42,0,-24,0,'#ffb34c',8);line(-24,0,0,0,'#e0e9e8',10);line(-20,-9,-14,9,'#ef6f53',4);ctx.restore();continue;}if(a.bullet){line(a.x-14,a.y,a.x,a.y,'#ffe8a0',3);continue;}ctx.save();ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(a.vy,a.vx));line(-42,0,0,0,'#654a32',3);ctx.fillStyle='#f8f2dc';ctx.beginPath();ctx.moveTo(4,0);ctx.lineTo(-7,-5);ctx.lineTo(-7,5);ctx.fill();line(-40,-5,-30,0,'#f8f2dc',3);line(-40,5,-30,0,'#f8f2dc',3);ctx.restore();}for(const p of particles){ctx.globalAlpha=p.life/.6;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,5,5);}ctx.globalAlpha=1;}
function frame(t){const dt=Math.min((t-last)/1000,.035);last=t;update(dt);draw();drawConfetti(dt);requestAnimationFrame(frame);}hud();requestAnimationFrame(frame);

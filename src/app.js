import { Garden, matches } from './engine.js';
import { LEVELS, TOKENS } from './levels.js';
import { renderBoard, tokenIcon } from './render.js';

const $ = id => document.getElementById(id);
let saved = {};
try { saved = JSON.parse(localStorage.getItem('trail-garden-v1') || '{}') || {}; } catch {}
const validLevel = Number.isInteger(saved.level) && saved.level >= 0 && saved.level < LEVELS.length ? saved.level : 0;
const completed = new Set(Array.isArray(saved.completed) ? saved.completed.filter(i=>Number.isInteger(i)&&i>=0&&i<LEVELS.length) : []);
const game = new Garden(validLevel);
let hintStep = 0, soundEnabled = false, audioContext;
const soundIcon = enabled => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M10 5L5 9H2v6h3l5 4Z"/>${enabled?'<path d="M14 8q5 4 0 8m3-11q8 7 0 14"/>':'<path d="M15 9l6 6m0-6-6 6"/>'}</svg>`;
$('sound').innerHTML = soundIcon(false);
function saveProgress() { try { localStorage.setItem('trail-garden-v1', JSON.stringify({level:game.level,completed:[...completed]})); } catch {} }
function playSound(event) {
  if(!soundEnabled) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const notes = {eat:[440,660],fold:[330,494,660],win:[392,494,587,784],enter:[440,330,220],return:[330,440,660],well:[220,440],write:[330,392],read:[392,494],bump:[130],full:[146],locked:[164]};
    const list=notes[event] || [event==='move'?196:294];
    list.forEach((freq,i)=>{const osc=audioContext.createOscillator(), gain=audioContext.createGain(), t=audioContext.currentTime+i*.08;osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(event==='move'?.014:.035,t+.01);gain.gain.exponentialRampToValueAtTime(.0001,t+.18);osc.connect(gain).connect(audioContext.destination);osc.start(t);osc.stop(t+.2);});
  } catch { soundEnabled=false; $('sound').innerHTML=soundIcon(false); $('sound').setAttribute('aria-pressed','false'); $('sound').setAttribute('aria-label','开启声音'); }
}
const fixtureNames = {fold:'折叠红果',stone:'触摸石碑',pot:'进入陶壶',well:'投入鲜果'};
const notes = [
  '这是一个回合制花园。\n你不动，时间也不会走。',
  '满了就停下来想想。\nZ 能让你回到上一步。',
  '站上有花纹的石台，\n用空格与它打个招呼。',
  '石碑只刻最近的一枚果纹。\n两块石碑，共享一道刻痕。',
  '石台可以折叠颜色，\n却折不出鲜果的汁液。',
  '壶外与壶内，各有自己的蛇。\n记得给花种留一片空鳞。',
  '没有新规则了。\n试着让旧规则一起工作。',
];
function render() {
  const level=LEVELS[game.level],room=game.room,f=game.state.frame,inner=game.state.stack.length>0;
  $('chapter-number').textContent=String(game.level+1).padStart(2,'0');
  $('level-title').textContent=room.title;
  $('level-subtitle').textContent=room.subtitle;
  $('objective').textContent=room.objective;
  $('epigraph').textContent=room.epigraph;
  $('rule-note').innerHTML=(inner?'小蛇只有两片空鳞。\n外面的东西，不会跟进来。':notes[game.level]).replace('\n','<br>');
  $('breadcrumb').innerHTML=`<span class="live-dot"></span>庭院 ${String(game.level+1).padStart(2,'0')} ${inner?'<span class="room-in-room">/ 壶中庭院</span>':'<span class="toolbar-muted">/ 07</span>'}`;
  $('moves').textContent=String(game.state.moves).padStart(2,'0');
  $('capacity').textContent=`${f.tokens.length} / ${room.capacity}`;
  $('capacity-label').style.color=f.tokens.length===room.capacity?'#b18251':'';
  $('board').innerHTML=renderBoard(game);
  $('board').setAttribute('aria-label',`${room.title}。蛇头在第 ${f.snake[0].x} 列第 ${f.snake[0].y} 行。身上有${f.tokens.length?f.tokens.map(t=>TOKENS[t].name).join('、'):'零枚果纹'}。${room.objective}`);
  $('inventory').innerHTML=Array.from({length:room.capacity},(_,i)=>`<span class="slot ${f.tokens[i]?'filled':'empty'}" title="${f.tokens[i]?TOKENS[f.tokens[i]].name:'空鳞片'}" aria-label="${f.tokens[i]?TOKENS[f.tokens[i]].name:'空鳞片'}">${f.tokens[i]?tokenIcon(f.tokens[i],24):''}</span>`).join('');
  const remaining=[...f.tokens];
  $('gate-recipe').innerHTML='<span class="recipe-intro">门上的纹样</span>'+room.gate.needs.map(t=>{const i=remaining.findIndex(v=>matches([v],[t]));if(i>=0)remaining.splice(i,1);return `<span class="recipe-token ${i>=0?'met':''}" title="${t==='red'?'红色（鲜果或红印）':TOKENS[t].name}">${tokenIcon(t,25)}</span>`;}).join('');
  const fixture=game.fixture;
  $('interaction').innerHTML=fixture&&fixture.type!=='veil'?`<button id="interact">${fixtureNames[fixture.type]} <kbd>空格</kbd></button>`:'<span class="idle-interact">遇到奇物时，按空格</span>';
  $('interact')?.addEventListener('click',()=>act('interact'));
  $('message').textContent=game.state.message||(fixture?fixture.type==='veil'?'白雨落下，鳞片重新空了。':'脚下有一件奇物。按空格，看看它会做什么。':game.ready?'门已经亮了。带着身上的果纹走过去吧。':'慢慢走。看看身上的纹样，再看看门。');
  $('message').parentElement.classList.toggle('warning',['bump','full','lossy','locked'].includes(game.state.event));
  $('room-tag').textContent=inner?'壶外的你，正在等候。':game.level===0?'慢慢来，每一步都算数。':room.epigraph;
  $('undo').disabled=game.history.length===0;
  $('progress').innerHTML=LEVELS.map((l,i)=>`<button data-level="${i}" class="${completed.has(i)?'complete ':''}${i===game.level?'current':''}" aria-label="庭院 ${i+1}：${l.title}${completed.has(i)?'，已通过':''}" ${i===game.level?'aria-current="step"':''} title="${l.title}"></button>`).join('');
  $('progress').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>loadLevel(Number(b.dataset.level))));
  $('win-layer').hidden=!game.state.won;
  if(game.state.won){
    const final=game.level===LEVELS.length-1;
    $('win-layer').innerHTML=`<div class="win-card" role="region" aria-label="庭院通过"><span class="win-flower">✳</span><div class="eyebrow">${final?'THE GARDEN GOES ON':'A LITTLE FURTHER'}</div><h2>${final?'路还很长':'又走过一座庭院'}</h2><p>${level.discovery}</p><button id="next" class="primary-button">${final?'回看庭院手记':'走向下一座庭院'} <span>→</span></button><button id="replay" class="secondary-button">${final?'再走一遍最后的路':'再在这里待一会儿'}</button></div>`;
    $('next').addEventListener('click',()=>final?openChapters():loadLevel(game.level+1));
    $('replay').addEventListener('click',()=>loadLevel(game.level));
  }
}
function loadLevel(index) { game.load(index); hintStep=0; saveProgress(); if($('modal').open)$('modal').close(); render(); }
function act(action) {
  if($('modal').open) return;
  const changed=action==='interact'?game.interact():action==='undo'?game.undo():game.move(action);
  if(game.state.won&&changed){completed.add(game.level);saveProgress();}
  render();
  const event=game.state.event;
  if(changed || ['bump','full','locked','lossy'].includes(event))playSound(event);
  if(['enter','return','fold','wash','bump','full','locked','lossy'].includes(event)){
    const board=$('board-wrap');board.classList.remove('enter','fold','bump');void board.offsetWidth;board.classList.add(['enter','return'].includes(event)?'enter':['fold','wash'].includes(event)?'fold':'bump');
  }
}
function openModal(html) { $('modal-content').innerHTML=html; if(!$('modal').open)$('modal').showModal(); }
function openChapters() {
  openModal(`<div class="modal-eyebrow">FIELD NOTES · ${completed.size} / 7</div><h2 class="modal-title">庭院手记</h2><p class="modal-lead">七座小小的庭院。按顺序走，会有新的发现。<br>也可以挑一座，随时进去坐坐。</p><div class="chapter-list">${LEVELS.map((l,i)=>`<button class="chapter-card" data-level="${i}"><span class="num">0${i+1}</span><span><strong>${l.title}</strong><small>${completed.has(i)?l.discovery:l.subtitle}</small></span><span class="check">${completed.has(i)?'✓':i===game.level?'此刻':'↗'}</span></button>`).join('')}</div>`);
  $('modal-content').querySelectorAll('[data-level]').forEach(b=>b.addEventListener('click',()=>loadLevel(Number(b.dataset.level))));
}
function openHelp(){
  openModal(`<div class="modal-eyebrow">MAKE YOURSELF AT HOME</div><h2 class="modal-title">在花园里，慢慢走</h2><p class="modal-lead">这里没有倒计时。方向键按一下，蛇走一格。<br>果子会在身上留下纹样，门会认出那些纹样。</p><div class="help-grid"><div class="help-item"><strong>↑ ↓ ← → / WASD</strong><p>移动小蛇。不能穿墙，也不能撞上身体；空格不会让蛇前进。</p></div><div class="help-item"><strong>空格 · 和奇物打招呼</strong><p>先走到奇物所在的格子，再按空格。看看石台、石碑、井和陶壶会怎样回应。</p></div><div class="help-item"><strong>Z · 撤回　R · 重来</strong><p>每一步都可以撤回，包括折叠、刻印与进出陶壶。重来会重新开始当前整座庭院。</p></div><div class="help-item"><strong>✧ · 一点提示</strong><p>每座庭院有三层提示，逐次展开。庭院手记可以回访任何一关。</p></div></div><p class="modal-lead" style="margin:20px 0 0">小提示：门上的纹样亮起时，说明你已经带上了需要的东西。进度会留在这台设备上。</p>`);
}
function showHint(){
  const hints=game.room.hints;
  openModal(`<div class="modal-eyebrow">A SMALL NUDGE · ${hintStep+1} / 3</div><h2 class="modal-title">风里的一点提示</h2><p class="hint-text">${hints[hintStep]}</p><div class="hint-actions"><span>不急，想一想再走。</span>${hintStep<2?'<button id="more-hint">再多一点 →</button>':'<button id="back-game">回到庭院 →</button>'}</div>`);
  $('more-hint')?.addEventListener('click',()=>{hintStep++;showHint();});
  $('back-game')?.addEventListener('click',()=>$('modal').close());
}
$('chapters').addEventListener('click',openChapters);
$('help').addEventListener('click',openHelp);
$('hint').addEventListener('click',showHint);
$('undo').addEventListener('click',()=>act('undo'));
$('restart').addEventListener('click',()=>loadLevel(game.level));
$('close-modal').addEventListener('click',()=>$('modal').close());
$('modal').addEventListener('click',e=>{if(e.target===$('modal')){const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('modal').close();}});
$('sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('sound').innerHTML=soundIcon(soundEnabled);$('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').setAttribute('aria-label',soundEnabled?'关闭声音':'开启声音');playSound('read');});
document.querySelectorAll('[data-dir]').forEach(b=>b.addEventListener('click',()=>act(b.dataset.dir)));
$('touch-interact').addEventListener('click',()=>act('interact'));
document.addEventListener('keydown',e=>{
  if(e.metaKey||e.ctrlKey||e.altKey||e.isComposing||$('modal').open)return;
  const key=e.key.toLowerCase(),dir={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'}[key];
  // Space/Enter on a focused button must retain native button activation.
  if((e.key===' '||e.key==='Enter')&&document.activeElement?.tagName==='BUTTON')return;
  if(dir){e.preventDefault();act(dir);}
  else if(key==='z'){e.preventDefault();act('undo');}
  else if(key==='r'){e.preventDefault();loadLevel(game.level);}
  else if(e.key===' '){e.preventDefault();if(!e.repeat)act('interact');}
  else if(e.key==='Enter'&&game.state.won){e.preventDefault();if(game.level<6)loadLevel(game.level+1);else openChapters();}
  else if(key==='h'){e.preventDefault();showHint();}
});
render();

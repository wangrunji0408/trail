import { Garden, matches } from './engine.js';
import { LEVELS, TOKENS, RECIPES } from './levels.js';
import { renderBoard, tokenIcon } from './render.js';

const $ = id => document.getElementById(id);
const storageKey = 'trail-garden-v2';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch {}
const startLevel = Math.max(0, LEVELS.findIndex(level => level.id === saved.current));
const completed = new Set(Array.isArray(saved.completed) ? saved.completed.filter(id => LEVELS.some(level => level.id === id)) : []);
const game = new Garden(startLevel);
let soundEnabled = false, audioContext;
const soundIcon = enabled => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M10 5L5 9H2v6h3l5 4Z"/>${enabled?'<path d="M14 8q5 4 0 8m3-11q8 7 0 14"/>':'<path d="M15 9l6 6m0-6-6 6"/>'}</svg>`;
$('sound').innerHTML = soundIcon(false);
function saveProgress() {
  try { localStorage.setItem(storageKey, JSON.stringify({current:LEVELS[game.level].id,completed:[...completed]})); } catch {}
}
function playSound(event) {
  if (!soundEnabled) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const notes = {eat:[440,660],fold:[330,494,660],win:[392,494,587,784],enter:[440,330,220],return:[330,440,660],well:[220,440],write:[330,392],read:[392,494],learn:[330,440,587],generate:[294,440,587],bump:[130],full:[146],locked:[164]};
    (notes[event] || [event==='move'?196:294]).forEach((freq,i) => {
      const osc=audioContext.createOscillator(), gain=audioContext.createGain(), t=audioContext.currentTime+i*.08;
      osc.type='sine'; osc.frequency.value=freq; gain.gain.setValueAtTime(0,t);
      gain.gain.linearRampToValueAtTime(event==='move'?.014:.035,t+.01);
      gain.gain.exponentialRampToValueAtTime(.0001,t+.18);
      osc.connect(gain).connect(audioContext.destination); osc.start(t); osc.stop(t+.2);
    });
  } catch {
    soundEnabled=false; $('sound').innerHTML=soundIcon(false);
    $('sound').setAttribute('aria-pressed','false'); $('sound').setAttribute('aria-label','开启声音');
  }
}
const recipeMarkup = recipe => `${recipe.needs.map(t=>tokenIcon(t,25)).join('<span>+</span>')}<span>→</span>${tokenIcon(recipe.output,25)}`;
function render() {
  const room=game.room, f=game.state.frame, inner=game.state.stack.length>0;
  $('chapter-number').textContent=String(game.level+1).padStart(2,'0');
  $('level-title').textContent=room.title;
  $('objective').textContent=room.objective;
  $('breadcrumb').innerHTML=`<span class="live-dot"></span>关卡 ${String(game.level+1).padStart(2,'0')} ${inner?'<span class="room-in-room">/ 壶内</span>':`<span class="toolbar-muted">/ ${String(LEVELS.length).padStart(2,'0')}</span>`}`;
  $('moves').textContent=String(game.state.moves).padStart(2,'0');
  $('capacity').textContent=`${f.tokens.length} / ${room.capacity}`;
  $('capacity-label').style.color=f.tokens.length===room.capacity?'#b18251':'';
  $('board').innerHTML=renderBoard(game);
  $('board').setAttribute('aria-label',`${room.title}。蛇头在第 ${f.snake[0].x} 列第 ${f.snake[0].y} 行。身上有${f.tokens.length?f.tokens.map(t=>TOKENS[t].name).join('、'):'零枚果纹'}。${room.objective}`);
  $('inventory').innerHTML=Array.from({length:room.capacity},(_,i)=>`<span class="slot ${f.tokens[i]?'filled':'empty'}" title="${f.tokens[i]?TOKENS[f.tokens[i]].name:'空格'}" aria-label="${f.tokens[i]?TOKENS[f.tokens[i]].name:'空格'}">${f.tokens[i]?tokenIcon(f.tokens[i],24):''}</span>`).join('');
  const remaining=[...f.tokens];
  $('gate-recipe').innerHTML=room.gate.needs.length?'<span class="recipe-intro">出口果纹</span>'+room.gate.needs.map(t=>{
    const i=remaining.findIndex(v=>matches([v],[t])); if(i>=0)remaining.splice(i,1);
    return `<span class="recipe-token ${i>=0?'met':''}" title="${t==='red'?'红果或红印':TOKENS[t].name}">${tokenIcon(t,25)}</span>`;
  }).join(''):'';
  $('known-recipe').hidden=!room.canGenerate;
  if(room.canGenerate) {
    const book=room.fixtures.find(item=>item.type==='book');
    const recipes=book ? (f.tokens.includes(RECIPES[book.recipe].scroll)?[RECIPES[book.recipe]]:[]) : [RECIPES.basic];
    $('known-recipe').innerHTML=recipes.length?`<span class="small-label">已知配方</span>${recipes.map(r=>`<div class="formula">${recipeMarkup(r)}</div>`).join('')}`:`<span class="small-label">${RECIPES[book.recipe].name}</span><p>未展开</p>`;
  }
  const at=game.fixture;
  $('interaction').innerHTML=room.canGenerate?'<button id="output">输出 <kbd>空格</kbd></button>':'';
  $('output')?.addEventListener('click',()=>act('output'));
  $('touch-output').hidden=!room.canGenerate;
  $('message').textContent=game.state.event==='sign'?'提示牌':game.state.message;
  $('message').parentElement.classList.toggle('warning',['bump','full','lossy','locked'].includes(game.state.event));
  const onSign=at?.type==='sign', onBook=at?.type==='book'&&f.tokens.includes(RECIPES[at.recipe].scroll);
  $('sign-popup').hidden=!(onSign||onBook);
  if(onSign||onBook) $('sign-popup').innerHTML=onSign?`<strong>提示牌</strong><p>${at.text}</p>`:`<strong>${RECIPES[at.recipe].name}</strong><div class="formula">${recipeMarkup(RECIPES[at.recipe])}</div><p>书卷占一格。</p>`;
  $('undo').disabled=game.history.length===0;
  $('completion-count').textContent=`已完成 ${completed.size} / ${LEVELS.length}`;
  $('progress').innerHTML=LEVELS.map((l,i)=>`<button data-level="${i}" class="${completed.has(l.id)?'complete ':''}${i===game.level?'current':''}" aria-label="关卡 ${i+1}：${l.title}${completed.has(l.id)?'，已通过':''}" ${i===game.level?'aria-current="step"':''} title="${l.title}"></button>`).join('');
  $('progress').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>loadLevel(Number(b.dataset.level))));
  $('win-layer').hidden=!game.state.won;
  if(game.state.won) {
    const final=game.level===LEVELS.length-1;
    $('win-layer').innerHTML=`<div class="win-card" role="region" aria-label="关卡完成"><span class="win-flower">✓</span><h2>${final?'全部完成':'关卡完成'}</h2><p>${game.state.moves} 步</p><button id="next" class="primary-button">${final?'选择关卡':'下一关'} →</button><button id="replay" class="secondary-button">重新开始</button></div>`;
    $('next').addEventListener('click',()=>final?openChapters():loadLevel(game.level+1));
    $('replay').addEventListener('click',()=>loadLevel(game.level));
  }
}
function loadLevel(index) { game.load(index); saveProgress(); if($('modal').open)$('modal').close(); render(); }
function act(action) {
  if($('modal').open) return;
  const changed=action==='output'?game.generate():action==='undo'?game.undo():game.move(action);
  if(game.state.won&&changed) { completed.add(LEVELS[game.level].id); saveProgress(); }
  render();
  const event=game.state.event;
  if(changed||['bump','full','locked','lossy'].includes(event))playSound(event);
  if(['enter','return','fold','wash','bump','full','locked','lossy'].includes(event)) {
    const board=$('board-wrap'); board.classList.remove('enter','fold','bump'); void board.offsetWidth;
    board.classList.add(['enter','return'].includes(event)?'enter':['fold','wash'].includes(event)?'fold':'bump');
  }
}
function openModal(html) { $('modal-content').innerHTML=html; if(!$('modal').open)$('modal').showModal(); }
function openChapters() {
  openModal(`<div class="modal-eyebrow">${completed.size} / ${LEVELS.length}</div><h2 class="modal-title">选择关卡</h2><div class="chapter-list">${LEVELS.map((l,i)=>`<button class="chapter-card" data-level="${i}"><span class="num">${String(i+1).padStart(2,'0')}</span><span><strong>${l.title}</strong><small>${l.objective}</small></span><span class="check">${completed.has(l.id)?'✓':i===game.level?'当前':'↗'}</span></button>`).join('')}</div>`);
  $('modal-content').querySelectorAll('[data-level]').forEach(b=>b.addEventListener('click',()=>loadLevel(Number(b.dataset.level))));
}
function openHelp() {
  openModal(`<h2 class="modal-title">操作</h2><div class="help-grid"><div class="help-item"><strong>方向键 / WASD</strong><p>每次走一格。不能穿墙或撞上身体。</p></div><div class="help-item"><strong>碰触机关</strong><p>所有机关碰触后自动生效。走上角落的提示牌，可查看一条线索。</p></div><div class="help-item"><strong>空格 · 输出</strong><p>沿当前朝向前进一格，同时把生成结果加入蛇身。原有输入保留。</p></div><div class="help-item"><strong>Z · 撤回　R · 重来</strong><p>自动机关、生成与进出陶壶都可撤回。重来会重置当前整关。</p></div></div>`);
}
$('chapters').addEventListener('click',openChapters);
$('help').addEventListener('click',openHelp);
$('undo').addEventListener('click',()=>act('undo'));
$('restart').addEventListener('click',()=>loadLevel(game.level));
$('close-modal').addEventListener('click',()=>$('modal').close());
$('modal').addEventListener('click',e=>{
  if(e.target===$('modal')) { const r=$('modal').getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('modal').close(); }
});
$('sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('sound').innerHTML=soundIcon(soundEnabled);$('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').setAttribute('aria-label',soundEnabled?'关闭声音':'开启声音');playSound('read');});
document.querySelectorAll('[data-dir]').forEach(b=>b.addEventListener('click',()=>act(b.dataset.dir)));
$('touch-output').addEventListener('click',()=>act('output'));
document.addEventListener('keydown',e=>{
  if(e.metaKey||e.ctrlKey||e.altKey||e.isComposing||$('modal').open)return;
  const key=e.key.toLowerCase(),dir={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'}[key];
  if((e.key===' '||e.key==='Enter')&&document.activeElement?.tagName==='BUTTON')return;
  if(dir){e.preventDefault();act(dir);}
  else if(key==='z'){e.preventDefault();act('undo');}
  else if(key==='r'){e.preventDefault();loadLevel(game.level);}
  else if(e.key===' '){e.preventDefault();if(!e.repeat)act('output');}
  else if(e.key==='Enter'&&game.state.won){e.preventDefault();if(game.level<LEVELS.length-1)loadLevel(game.level+1);else openChapters();}
});
render();

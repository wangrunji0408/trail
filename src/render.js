import { TOKENS } from './levels.js';
const C = 48;
const glyph = (token, x = 24, y = 24, size = 10) => {
  const color = TOKENS[token]?.color || '#cf755c';
  if (token === 'r' || token === 'red') return `<path d="M${x} ${y-7}q1-6 6-5q-1 5-6 5" fill="#819165"/><path d="M${x} ${y-5}C${x-15} ${y-14},${x-14} ${y+12},${x} ${y+11}C${x+14} ${y+12},${x+15} ${y-14},${x} ${y-5}" fill="${color}"/><ellipse cx="${x-4}" cy="${y-2}" rx="2" ry="3" fill="#ebac8d" opacity=".7"/>`;
  if (token === 'b') return `<path d="M${x+5} ${y-12}A12 12 0 1 0 ${x+9} ${y+9}A10 10 0 0 1 ${x+5} ${y-12}" fill="${color}"/><circle cx="${x+6}" cy="${y-3}" r="1.5" fill="#bfd5c9"/>`;
  if (token === 'y') return `<path d="M${x} ${y-12}L${x+10} ${y}L${x} ${y+12}L${x-10} ${y}Z" fill="${color}"/><path d="M${x} ${y-8}v16" stroke="#ebd18a" stroke-width="1.5"/>`;
  if (token === 's') return `<g fill="${color}">${[0, 72, 144, 216, 288].map(a=>`<ellipse cx="${x}" cy="${y-6}" rx="4" ry="6" transform="rotate(${a} ${x} ${y})"/>`).join('')}<circle cx="${x}" cy="${y}" r="3" fill="#e6c49a"/></g>`;
  if (token === 'v') return `<path d="M${x} ${y-13}Q${x+2} ${y-2} ${x+12} ${y}Q${x+2} ${y+2} ${x} ${y+13}Q${x-2} ${y+2} ${x-12} ${y}Q${x-2} ${y-2} ${x} ${y-13}" fill="${color}"/><circle cx="${x}" cy="${y}" r="3" fill="#e8ddec"/>`;
  return '';
};
export function tokenIcon(token, size = 24) { return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${glyph(token)}</svg>`; }

function stoneTile(x, y, border = false) {
  const n = (x * 13 + y * 37) % 7;
  return `<g transform="translate(${x*C} ${y*C})"><rect x="3" y="5" width="43" height="41" rx="5" fill="#aab799"/><rect x="3" y="2" width="43" height="40" rx="5" fill="${border ? '#c0cbae' : '#bbc7aa'}" stroke="#afbd9c"/><path d="M8 7h30M8 8v25" fill="none" stroke="#d4dcc2" stroke-width="1.3" opacity=".7"/>${n<3?`<path d="M${15+n*5} 3l-3 10 5 6" fill="none" stroke="#aab99a"/>`:''}${n%3===0?'<path d="M28 35q-3-7 0-10m0 6q7-7 9-3m-9 1q-7-8-9-3" fill="none" stroke="#82996c" stroke-width="1.5"/>':''}</g>`;
}
function fixtureArt(item, f) {
  const used = f.used.includes(item.type), x = item.x*C, y = item.y*C;
  let art = '';
  if(item.type === 'fold') art = `<ellipse cx="24" cy="37" rx="20" ry="7" fill="#acb79a"/><path d="M5 19L24 8 43 19V34L24 44 5 34Z" fill="#bcc4a9" stroke="#92a180"/><path d="M5 19l19 11 19-11M24 30v14" fill="none" stroke="#96a584"/><path d="M7 18l17-9 17 9-17 10Z" fill="#dfe0c9"/><g transform="translate(12 6) scale(.5)">${glyph('s')}</g>`;
  if(item.type === 'stone') art = `<ellipse cx="24" cy="41" rx="18" ry="5" fill="#a7b693"/><path d="M11 40V13Q11 3 23 3H28Q37 4 37 13V40Z" fill="#c8ceb6" stroke="#9caa8b" stroke-width="1.4"/><path d="M15 36V14Q15 8 21 8" fill="none" stroke="#e2e4cf" stroke-width="2"/><path d="M28 4l-4 8 4 5-3 7" fill="none" stroke="#a3b093"/>${f.stone?`<g transform="translate(12 16) scale(.5)">${glyph(f.stone)}</g>`:'<path d="M18 29h12M18 33h8" stroke="#9eac8d" stroke-width="1.4"/>'}`;
  if(item.type === 'veil') art = `<rect x="-4" y="-12" width="56" height="72" rx="14" fill="#f0f2de" opacity=".55"/><g stroke="#f9faec" stroke-width="2" stroke-linecap="round">${[7,15,24,33,41].map((x,i)=>`<path d="M${x} ${i%2?0:8}v25"/>`).join('')}</g><path d="M1 38q12-5 24 0t24 0" stroke="#c2cbb3" fill="none"/>`;
  if(item.type === 'well') art = `<ellipse cx="24" cy="35" rx="20" ry="10" fill="#a8b496"/><path d="M6 22v13q18 16 36 0V22" fill="#b6c3a4" stroke="#93a680"/><ellipse cx="24" cy="22" rx="18" ry="10" fill="#d1d7be" stroke="#92a27f"/><ellipse cx="24" cy="22" rx="12" ry="6" fill="#54766c"/><path class="ripple" d="M16 22q8 5 16 0" fill="none" stroke="#92b7a0"/>${used?'<circle cx="40" cy="9" r="4" fill="#83a3a5"/>':''}`;
  if(item.type === 'pot') art = `<ellipse cx="24" cy="40" rx="18" ry="5" fill="#a8b295"/><path d="M16 10h16l-2 8q14 8 10 18-2 9-16 9S8 42 8 33q0-9 10-15Z" fill="${used?'#b6b6a5':'#c99f7f'}" stroke="#a18e73" stroke-width="1.3"/><ellipse cx="24" cy="10" rx="9" ry="4" fill="#e0b89a" stroke="#ad9072"/><ellipse cx="24" cy="10" rx="6" ry="2" fill="#526750"/><path d="M13 27q11 7 22 0M12 31q12 7 24 0" fill="none" stroke="#e5c5a3"/><path d="M24 24l4 4-4 4-4-4Z" fill="#967e8f"/>`;
  return `<g transform="translate(${x} ${y})">${art}</g>`;
}
export function renderBoard(game) {
  const room = game.room, f = game.state.frame;
  let out = `<defs><pattern id="ground" width="96" height="96" patternUnits="userSpaceOnUse"><rect width="96" height="96" fill="#dae1c7"/><path d="M48 0v96M0 48h96" stroke="#ccd6b9" stroke-width=".6"/><rect x="1" y="1" width="46" height="46" fill="#d4ddbf" opacity=".45"/><rect x="49" y="49" width="46" height="46" fill="#e0e5cf" opacity=".65"/></pattern><filter id="shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="3" stdDeviation="1.7" flood-color="#45583d" flood-opacity=".16"/></filter></defs><rect width="720" height="528" fill="url(#ground)"/>`;
  for(let y=0;y<room.height;y++) for(let x=0;x<room.width;x++) {
    const edge = x===0||y===0||x===room.width-1||y===room.height-1;
    if(edge || room.walls.some(([wx,wy])=>wx===x&&wy===y)) out += stoneTile(x,y,edge);
    else if((x*17+y*31)%11===0) out += `<path d="M${x*C+13} ${y*C+35}v-5m0 4-4-4m4 4 3-5" stroke="#a9bb91" stroke-width="1" fill="none" opacity=".7"/>`;
    else if((x*31+y*13)%17===0) out += `<circle cx="${x*C+34}" cy="${y*C+10}" r="1.1" fill="#b3c29c"/><circle cx="${x*C+38}" cy="${y*C+14}" r=".8" fill="#b3c29c"/>`;
  }
  // Small clusters soften the stone boundary without obscuring the walkable grid.
  for(const [x,y] of [[0,0],[14,0],[0,10],[14,10],[2,0],[12,10]]) out += `<g transform="translate(${x*C+24} ${y*C+24})" fill="#91a478"><ellipse cx="-5" cy="0" rx="9" ry="5" transform="rotate(30)"/><ellipse cx="6" cy="-5" rx="10" ry="5" transform="rotate(-40)"/><ellipse cx="0" cy="9" rx="8" ry="4" transform="rotate(55)"/></g>`;
  const gate = room.gate;
  out += `<g transform="translate(${gate.x*C} ${gate.y*C})"><ellipse cx="24" cy="39" rx="25" ry="9" fill="#b9c7a0" opacity=".7"/><path d="M3 43V18C3-7 45-7 45 18V43" fill="${game.ready?'#e8ebc5':'#c7cfb2'}" stroke="#a7b393" stroke-width="2"/><path d="M10 43V19C10 1 38 1 38 19V43" fill="${game.ready?'#fbf9d9':'#b4c3a3'}" stroke="${game.ready?'#d3d5a9':'#94a886'}"/><path d="M11 43h26" stroke="#94a683" stroke-width="3"/>${game.ready?'<path class="gate-light" d="M20 12v24m8-27v30" stroke="#ffffed" stroke-width="4"/>':'<path d="M23 21v10m-5-5h10" stroke="#dbe1c8" stroke-width="2"/>'}<g transform="translate(${24-gate.needs.length*8} -19)">${gate.needs.map((t,i)=>`<g transform="translate(${i*16} 0) scale(.34)">${glyph(t)}</g>`).join('')}</g></g>`;
  out += room.fixtures.map(item=>fixtureArt(item,f)).join('');
  f.fruits.forEach(food=>{ out += `<g transform="translate(${food.x*C} ${food.y*C})"><ellipse cx="24" cy="37" rx="10" ry="3" fill="#aebd96" opacity=".45"/><g class="fruit-float">${glyph(food.kind)}</g></g>`; });
  const snake = f.snake;
  // Paint the continuous body first, then individual scales and their fruit marks.
  const points = snake.map(part=>`${part.x*C+24},${part.y*C+24}`).join(' ');
  out += `<g filter="url(#shadow)"><polyline points="${points}" fill="none" stroke="#355c43" stroke-width="29" stroke-linejoin="round" stroke-linecap="round"/>`;
  for(let i=snake.length-1;i>=0;i--) {
    const part=snake[i], x=part.x*C,y=part.y*C;
    out += `<g transform="translate(${x} ${y})"><rect x="${i===snake.length-1?12:7}" y="${i===snake.length-1?12:7}" width="${i===snake.length-1?24:34}" height="${i===snake.length-1?24:34}" rx="${i===0?12:10}" fill="${i===0?'#355d43':i%2?'#4e7450':'#577b52'}"/>`;
    if(i>0&&f.tokens[i-1]) out+=`<g transform="translate(8 8) scale(.67)">${glyph(f.tokens[i-1])}</g>`;
    if(i===0) {
      const angle={right:0,down:90,left:180,up:270}[f.direction];
      out+=`<g transform="rotate(${angle} 24 24)"><circle class="snake-eye" cx="31" cy="15" r="3.5"/><circle class="snake-eye" cx="31" cy="33" r="3.5"/><circle cx="32" cy="15" r="1.5" fill="#2a4935"/><circle cx="32" cy="33" r="1.5" fill="#2a4935"/><path d="M39 24h4" stroke="#d29475" stroke-width="2" stroke-linecap="round"/></g>`;
    } else if(!f.tokens[i-1]) out+='<circle cx="24" cy="24" r="2" fill="#a3b080" opacity=".5"/>';
    out+='</g>';
  }
  out+='</g>';
  if(game.fixture && game.fixture.type!=='veil') out+=`<g transform="translate(${snake[0].x*C+24} ${snake[0].y*C-8})"><rect x="-18" y="-13" width="36" height="18" rx="5" fill="#f3f2df" stroke="#b2bd9e"/><text y="0" text-anchor="middle" fill="#748666" font-size="8" font-family="sans-serif">空格</text></g>`;
  return out;
}

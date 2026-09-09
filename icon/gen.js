const sharp = require('sharp');
const fs = require('fs');

const W = 512, C = 256;

function defsBg(id, extra = '') {
  return `<defs>
    <linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/>
      <stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
    <radialGradient id="h${id}" cx="0.24" cy="0.18" r="0.8">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.26"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    ${extra}
  </defs>
  <rect width="${W}" height="${W}" rx="116" fill="url(#g${id})"/>
  <rect width="${W}" height="${W}" rx="116" fill="url(#h${id})"/>`;
}

function arc(cx, cy, r, frac) {
  const a = (-90 + 360 * frac) * Math.PI / 180;
  const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
  const large = frac > 0.5 ? 1 : 0;
  return `M${cx} ${cy - r} A${r} ${r} 0 ${large} 1 ${x.toFixed(1)} ${y.toFixed(1)}`;
}

function svg(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${inner}</svg>`;
}

const icons = {};

// D 双层活动环 + 对勾
icons.d = svg(`${defsBg('D')}
  <circle cx="256" cy="256" r="180" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="32"/>
  <circle cx="256" cy="256" r="130" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="32"/>
  <path d="${arc(256, 256, 180, 0.8)}" fill="none" stroke="#fde047" stroke-width="32" stroke-linecap="round"/>
  <path d="${arc(256, 256, 130, 0.62)}" fill="none" stroke="#22d3ee" stroke-width="32" stroke-linecap="round"/>
  <path d="M198 256 L240 300 L318 216" fill="none" stroke="#ffffff" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>`);

// E 连续火焰 + 对勾
icons.e = svg(`${defsBg('E', `
    <linearGradient id="flame" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0" stop-color="#fcd34d"/>
      <stop offset="1" stop-color="#f97316"/>
    </linearGradient>`)}
  <path d="M256 78 C302 152 360 184 360 258 C360 326 313 378 256 378 C199 378 152 326 152 258 C152 184 210 152 256 78 Z" fill="url(#flame)"/>
  <path d="M206 288 L242 326 L312 244" fill="none" stroke="#ffffff" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="396" cy="132" r="13" fill="#fde047" opacity="0.9"/>
  <circle cx="120" cy="398" r="9" fill="#fde047" opacity="0.7"/>`);

// F 九宫格日历 + 黄色对勾徽章
(() => {
  const pos = [108, 214, 320], size = 84;
  const filled = [1, 1, 1, 1, 1, 0, 1, 0, 0];
  let cells = '';
  let i = 0;
  for (const y of pos) for (const x of pos) {
    cells += `\n  <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="26" fill="#ffffff" opacity="${filled[i++] ? 0.92 : 0.26}"/>`;
  }
  icons.f = svg(`${defsBg('F')}${cells}
  <circle cx="376" cy="376" r="96" fill="url(#gF)"/>
  <circle cx="376" cy="376" r="84" fill="#fde047"/>
  <path d="M340 376 L366 403 L414 349" fill="none" stroke="#4f46e5" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>`);
})();

// G 上升折线 + 节点
icons.g = svg(`${defsBg('G')}
  <path d="M118 344 L190 302 L260 324 L332 240 L396 184 L396 402 L118 402 Z" fill="#ffffff" opacity="0.14"/>
  <path d="M112 402 L432 402" stroke="#ffffff" stroke-opacity="0.32" stroke-width="10" stroke-linecap="round"/>
  <path d="M118 344 L190 302 L260 324 L332 240 L396 184" fill="none" stroke="#ffffff" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="190" cy="302" r="15" fill="#ffffff"/>
  <circle cx="260" cy="324" r="15" fill="#ffffff"/>
  <circle cx="332" cy="240" r="15" fill="#ffffff"/>
  <circle cx="396" cy="184" r="27" fill="#fde047" stroke="#ffffff" stroke-width="9"/>
  <circle cx="140" cy="150" r="12" fill="#fde047" opacity="0.85"/>`);

// H 金色勋章 + 缎带
icons.h = svg(`${defsBg('H', `
    <linearGradient id="gold" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#fde68a"/>
      <stop offset="1" stop-color="#f59e0b"/>
    </linearGradient>`)}
  <path d="M206 336 L162 464 L228 430 L248 364 Z" fill="#6d28d9"/>
  <path d="M306 336 L350 464 L284 430 L264 364 Z" fill="#a78bfa"/>
  <circle cx="256" cy="228" r="140" fill="url(#gold)"/>
  <circle cx="256" cy="228" r="112" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="10"/>
  <path d="M206 230 L242 268 L310 188" fill="none" stroke="#6d28d9" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>`);

// J 30 天刻度环 + 对勾
(() => {
  const n = 30, done = 22, r0 = 158, r1 = 188;
  let ticks = '';
  for (let i = 0; i < n; i++) {
    const a = (-90 + i * 360 / n) * Math.PI / 180;
    const x0 = 256 + r0 * Math.cos(a), y0 = 256 + r0 * Math.sin(a);
    const x1 = 256 + r1 * Math.cos(a), y1 = 256 + r1 * Math.sin(a);
    const on = i < done;
    ticks += `\n  <path d="M${x0.toFixed(1)} ${y0.toFixed(1)} L${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${on ? '#fde047' : '#ffffff'}" stroke-opacity="${on ? 1 : 0.28}" stroke-width="12" stroke-linecap="round"/>`;
  }
  icons.j = svg(`${defsBg('J')}
  <circle cx="256" cy="256" r="136" fill="#ffffff" opacity="0.1"/>${ticks}
  <path d="M192 256 L242 308 L326 210" fill="none" stroke="#ffffff" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>`);
})();

const jobs = [];
for (const [k, s] of Object.entries(icons)) {
  fs.writeFileSync(`icon-${k}.svg`, s);
  jobs.push(sharp(Buffer.from(s), { density: 300 }).resize(512, 512).png().toFile(`icon-${k}-512.png`));
  jobs.push(sharp(Buffer.from(s), { density: 300 }).resize(144, 144).png().toFile(`icon-${k}-144.png`));
}
Promise.all(jobs).then(() => console.log('rendered: ' + Object.keys(icons).join(', '))).catch(e => console.error(e));

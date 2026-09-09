const sharp = require('sharp');
const fs = require('fs');

const W = 512;

function svg(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${inner}</svg>`;
}

function bg(id, c0, c1, hi = 0.24) {
  return `<defs>
    <linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c0}"/>
      <stop offset="1" stop-color="${c1}"/>
    </linearGradient>
    <radialGradient id="h${id}" cx="0.24" cy="0.16" r="0.85">
      <stop offset="0" stop-color="#ffffff" stop-opacity="${hi}"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${W}" rx="116" fill="url(#g${id})"/>
  <rect width="${W}" height="${W}" rx="116" fill="url(#h${id})"/>`;
}

function arc(cx, cy, r, frac) {
  const a = (-90 + 360 * frac) * Math.PI / 180;
  const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
  return `M${cx} ${cy - r} A${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${x.toFixed(1)} ${y.toFixed(1)}`;
}

const icons = {};

// K 墨黑底 + 荧光青双环 + 白勾（这一屏全是亮色，深色最跳）
icons.k = svg(`${bg('K', '#111827', '#1f2937', 0.1)}
  <circle cx="256" cy="256" r="180" fill="none" stroke="#ffffff" stroke-opacity="0.1" stroke-width="32"/>
  <circle cx="256" cy="256" r="130" fill="none" stroke="#ffffff" stroke-opacity="0.1" stroke-width="32"/>
  <path d="${arc(256, 256, 180, 0.8)}" fill="none" stroke="#22d3ee" stroke-width="32" stroke-linecap="round"/>
  <path d="${arc(256, 256, 130, 0.62)}" fill="none" stroke="#a3e635" stroke-width="32" stroke-linecap="round"/>
  <path d="M198 256 L240 300 L318 216" fill="none" stroke="#ffffff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>`);

// L 大字「练」+ 黄勾徽章（中文列表里字最快被认出）
icons.l = svg(`${bg('L', '#6366f1', '#8b5cf6')}
  <text x="242" y="330" font-family="Microsoft YaHei, PingFang SC, Heiti SC, sans-serif" font-size="300" font-weight="bold" fill="#ffffff" text-anchor="middle">练</text>
  <circle cx="392" cy="392" r="88" fill="url(#gL)"/>
  <circle cx="392" cy="392" r="76" fill="#fde047"/>
  <path d="M360 392 L384 417 L428 366" fill="none" stroke="#4f46e5" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>`);

// M 暖橙金底 + 白色双环 + 白勾（暖色版 D，白卡片上最亮）
icons.m = svg(`${bg('M', '#fb923c', '#f59e0b')}
  <circle cx="256" cy="256" r="180" fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="32"/>
  <circle cx="256" cy="256" r="130" fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="32"/>
  <path d="${arc(256, 256, 180, 0.8)}" fill="none" stroke="#ffffff" stroke-width="32" stroke-linecap="round"/>
  <path d="${arc(256, 256, 130, 0.62)}" fill="none" stroke="#fff7ed" stroke-opacity="0.75" stroke-width="32" stroke-linecap="round"/>
  <path d="M198 256 L240 300 L318 216" fill="none" stroke="#ffffff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>`);

// N 墨黑底 + 金色勋章（深底衬金，质感最强）
icons.n = svg(`<defs>
    <linearGradient id="gN" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#111827"/>
      <stop offset="1" stop-color="#1f2937"/>
    </linearGradient>
    <linearGradient id="goldN" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#fde68a"/>
      <stop offset="1" stop-color="#f59e0b"/>
    </linearGradient>
    <radialGradient id="hN" cx="0.24" cy="0.16" r="0.85">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.1"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${W}" rx="116" fill="url(#gN)"/>
  <rect width="${W}" height="${W}" rx="116" fill="url(#hN)"/>
  <path d="M206 336 L162 464 L228 430 L248 364 Z" fill="#0891b2"/>
  <path d="M306 336 L350 464 L284 430 L264 364 Z" fill="#22d3ee"/>
  <circle cx="256" cy="228" r="140" fill="url(#goldN)"/>
  <circle cx="256" cy="228" r="112" fill="none" stroke="#111827" stroke-opacity="0.28" stroke-width="10"/>
  <path d="M206 230 L242 268 L310 188" fill="none" stroke="#111827" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>`);

// P 大字「打」+ 深色底
icons.p = svg(`${bg('P', '#111827', '#1f2937', 0.1)}
  <text x="248" y="336" font-family="Microsoft YaHei, PingFang SC, Heiti SC, sans-serif" font-size="310" font-weight="bold" fill="#ffffff" text-anchor="middle">打</text>
  <circle cx="396" cy="120" r="52" fill="#a3e635"/>
  <path d="M374 120 L392 139 L420 104" fill="none" stroke="#111827" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>`);

const jobs = [];
for (const [k, s] of Object.entries(icons)) {
  fs.writeFileSync(`icon-${k}.svg`, s);
  jobs.push(sharp(Buffer.from(s), { density: 300 }).resize(512, 512).png().toFile(`icon-${k}-512.png`));
  jobs.push(sharp(Buffer.from(s), { density: 300 }).resize(144, 144).png().toFile(`icon-${k}-144.png`));
}
Promise.all(jobs).then(() => console.log('rendered: ' + Object.keys(icons).join(', '))).catch(e => console.error(e));

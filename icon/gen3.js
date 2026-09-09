const sharp = require('sharp');
const fs = require('fs');

const W = 512;
const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${inner}</svg>`;
const flat = (c) => `<rect width="${W}" height="${W}" fill="${c}"/>`;

const icons = {};

// Q 米白底 + 纯线描哑铃（没有色块、没有渐变，工具书插画感）
icons.q = svg(`${flat('#faf6ef')}
  <rect x="112" y="192" width="62" height="128" rx="24" fill="none" stroke="#1c1917" stroke-width="26"/>
  <rect x="338" y="192" width="62" height="128" rx="24" fill="none" stroke="#1c1917" stroke-width="26"/>
  <path d="M174 256 L338 256" stroke="#1c1917" stroke-width="30" stroke-linecap="round"/>
  <path d="M148 402 L364 402" stroke="#84cc16" stroke-width="24" stroke-linecap="round"/>`);

// R 深青底 + 举铁小人线稿（主体是人，不是符号）
icons.r = svg(`${flat('#0f766e')}
  <path d="M120 122 L392 122" stroke="#ffffff" stroke-width="24" stroke-linecap="round"/>
  <circle cx="118" cy="122" r="38" fill="#a3e635"/>
  <circle cx="394" cy="122" r="38" fill="#a3e635"/>
  <circle cx="256" cy="212" r="46" fill="#ffffff"/>
  <path d="M214 186 L166 138" stroke="#ffffff" stroke-width="26" stroke-linecap="round"/>
  <path d="M298 186 L346 138" stroke="#ffffff" stroke-width="26" stroke-linecap="round"/>
  <path d="M256 258 L256 340" stroke="#ffffff" stroke-width="30" stroke-linecap="round"/>
  <path d="M256 340 L198 432" stroke="#ffffff" stroke-width="28" stroke-linecap="round"/>
  <path d="M256 340 L314 432" stroke="#ffffff" stroke-width="28" stroke-linecap="round"/>`);

// S 脚印递进（斜向构图，两色平涂，没有居中主体）
(() => {
  const print = (x, y, a, op, c) => `
  <g transform="translate(${x} ${y}) rotate(${a})" fill="${c}" opacity="${op}">
    <ellipse cx="0" cy="16" rx="34" ry="46"/>
    <circle cx="-24" cy="-38" r="12"/>
    <circle cx="-4" cy="-48" r="13"/>
    <circle cx="18" cy="-44" r="12"/>
    <circle cx="36" cy="-30" r="10"/>
  </g>`;
  icons.s = svg(`${flat('#fff6e9')}
  ${print(126, 402, -18, 0.28, '#1c1917')}
  ${print(214, 316, -14, 0.5, '#1c1917')}
  ${print(302, 230, -10, 0.75, '#1c1917')}
  ${print(392, 142, -6, 1, '#ea580c')}`);
})();

// T 等距 3D 台阶 + 旗（伪立体，有明暗面，不是平面图形）
(() => {
  const step = (cx, cy, w, h) => {
    const hw = w / 2;
    return `
  <polygon points="${cx - w},${cy} ${cx},${cy + hw} ${cx + w},${cy} ${cx},${cy - hw}" fill="#a3e635"/>
  <polygon points="${cx - w},${cy} ${cx},${cy + hw} ${cx},${cy + hw + h} ${cx - w},${cy + h}" fill="#3f6212"/>
  <polygon points="${cx + w},${cy} ${cx},${cy + hw} ${cx},${cy + hw + h} ${cx + w},${cy + h}" fill="#65a30d"/>`;
  };
  icons.t = svg(`${flat('#eef4ff')}
  <ellipse cx="256" cy="446" rx="180" ry="30" fill="#1e293b" opacity="0.08"/>
  ${step(158, 320, 84, 66)}
  ${step(256, 272, 84, 66)}
  ${step(354, 224, 84, 66)}
  <path d="M354 214 L354 96" stroke="#1e293b" stroke-width="14" stroke-linecap="round"/>
  <path d="M354 100 L354 168 L436 134 Z" fill="#f43f5e"/>`);
})();

// U 手写「正」字计数 + 红印章（纸感、手写笔触，完全不是矢量图形风）
icons.u = svg(`${flat('#fdf8ee')}
  <path d="M96 168 L416 164" stroke="#e2d8c6" stroke-width="5"/>
  <path d="M96 300 L416 296" stroke="#e2d8c6" stroke-width="5"/>
  <path d="M96 432 L416 428" stroke="#e2d8c6" stroke-width="5"/>
  <path d="M132 122 L372 114" stroke="#1c1917" stroke-width="30" stroke-linecap="round"/>
  <path d="M254 120 L248 400" stroke="#1c1917" stroke-width="32" stroke-linecap="round"/>
  <path d="M138 244 L250 238" stroke="#1c1917" stroke-width="28" stroke-linecap="round"/>
  <path d="M142 244 L136 398" stroke="#1c1917" stroke-width="28" stroke-linecap="round"/>
  <path d="M126 400 L386 392" stroke="#1c1917" stroke-width="32" stroke-linecap="round"/>
  <rect x="352" y="330" width="104" height="104" rx="14" fill="#dc2626" transform="rotate(-8 404 382)"/>
  <text x="404" y="400" transform="rotate(-8 404 382)" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="66" font-weight="bold" fill="#ffffff" text-anchor="middle">卡</text>`);

// V 吉祥物：戴运动发带的小狗（角色插画，不是图标）
icons.v = svg(`${flat('#0ea5e9')}
  <path d="M138 208 L152 88 L238 148 Z" fill="#c2410c"/>
  <path d="M374 208 L360 88 L274 148 Z" fill="#c2410c"/>
  <ellipse cx="256" cy="262" rx="146" ry="128" fill="#f59e0b"/>
  <rect x="126" y="186" width="260" height="40" rx="20" fill="#a3e635"/>
  <ellipse cx="256" cy="316" rx="98" ry="76" fill="#fffbeb"/>
  <circle cx="196" cy="262" r="19" fill="#1c1917"/>
  <circle cx="316" cy="262" r="19" fill="#1c1917"/>
  <ellipse cx="256" cy="298" rx="24" ry="17" fill="#1c1917"/>
  <path d="M256 316 C244 344 218 346 206 330" fill="none" stroke="#1c1917" stroke-width="10" stroke-linecap="round"/>
  <path d="M256 316 C268 344 294 346 306 330" fill="none" stroke="#1c1917" stroke-width="10" stroke-linecap="round"/>`);

// W 排版海报风：左对齐大数字 + 小字（非居中、非对称）
icons.w = svg(`${flat('#facc15')}
  <text x="58" y="132" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="58" font-weight="bold" letter-spacing="14" fill="#18181b">DAY</text>
  <path d="M58 168 L454 168" stroke="#18181b" stroke-width="12"/>
  <text x="46" y="402" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="264" font-weight="bold" fill="#18181b">30</text>
  <rect x="340" y="286" width="118" height="118" rx="26" fill="#18181b"/>
  <path d="M368 344 L392 370 L432 320" fill="none" stroke="#facc15" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>`);

const jobs = [];
for (const [k, s] of Object.entries(icons)) {
  fs.writeFileSync(`icon-${k}.svg`, s);
  jobs.push(sharp(Buffer.from(s), { density: 300 }).resize(512, 512).png().toFile(`icon-${k}-512.png`));
  jobs.push(sharp(Buffer.from(s), { density: 300 }).resize(144, 144).png().toFile(`icon-${k}-144.png`));
}
Promise.all(jobs).then(() => console.log('rendered: ' + Object.keys(icons).join(', '))).catch(e => console.error(e));

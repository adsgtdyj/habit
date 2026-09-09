const sharp = require('sharp');
const fs = require('fs');

const W = 512;
const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${inner}</svg>`;
const flat = (c) => `<rect width="${W}" height="${W}" fill="${c}"/>`;
const FONT = 'Microsoft YaHei, PingFang SC, Heiti SC, sans-serif';

const icons = {};

// Y 教练哨子（墨黑底 + 亮黄哨子，教练最强符号）
icons.y = svg(`${flat('#101828')}
  <g transform="rotate(-10 256 256)">
    <rect x="96" y="230" width="128" height="66" rx="30" fill="#eab308"/>
    <rect x="186" y="184" width="204" height="156" rx="72" fill="#facc15"/>
    <circle cx="304" cy="244" r="30" fill="#101828"/>
    <circle cx="374" cy="148" r="34" fill="none" stroke="#facc15" stroke-width="18"/>
  </g>
  <path d="M96 400 L214 400" stroke="#a3e635" stroke-width="20" stroke-linecap="round"/>`);

// Z 教练小人：鸭舌帽 + 哨子 + 举手示范（主体是教练本人）
icons.z = svg(`${flat('#be123c')}
  <circle cx="222" cy="182" r="48" fill="#ffffff"/>
  <rect x="172" y="128" width="100" height="26" rx="13" fill="#a3e635"/>
  <path d="M272 132 L338 146 L272 158 Z" fill="#a3e635"/>
  <rect x="256" y="192" width="52" height="30" rx="15" fill="#facc15"/>
  <path d="M258 254 L344 164" stroke="#ffffff" stroke-width="28" stroke-linecap="round"/>
  <circle cx="352" cy="156" r="20" fill="#ffffff"/>
  <path d="M188 256 L138 314" stroke="#ffffff" stroke-width="28" stroke-linecap="round"/>
  <path d="M222 230 L222 324" stroke="#ffffff" stroke-width="32" stroke-linecap="round"/>
  <path d="M222 324 L170 424" stroke="#ffffff" stroke-width="28" stroke-linecap="round"/>
  <path d="M222 324 L280 424" stroke="#ffffff" stroke-width="28" stroke-linecap="round"/>`);

// AA 大字「教」（墨黑底 + 白字 + 荧光绿下划线，中文列表里读得最快）
icons.aa = svg(`${flat('#101828')}
  <text x="256" y="366" font-family="${FONT}" font-size="316" font-weight="bold" fill="#ffffff" text-anchor="middle">教</text>
  <path d="M108 434 L404 434" stroke="#a3e635" stroke-width="26" stroke-linecap="round"/>`);

// AB 训练计划板（教练手里的那块板，描边插画风）
icons.ab = svg(`${flat('#f6f1e6')}
  <rect x="106" y="112" width="300" height="324" rx="30" fill="#ffffff" stroke="#1c1917" stroke-width="15"/>
  <rect x="214" y="82" width="84" height="48" rx="18" fill="#1c1917"/>
  <rect x="150" y="188" width="46" height="46" rx="14" fill="#a3e635"/>
  <path d="M160 211 L172 224 L188 200" fill="none" stroke="#1c1917" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="216" y="200" width="146" height="22" rx="11" fill="#d6d3d1"/>
  <rect x="150" y="262" width="46" height="46" rx="14" fill="#a3e635"/>
  <path d="M160 285 L172 298 L188 274" fill="none" stroke="#1c1917" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="216" y="274" width="118" height="22" rx="11" fill="#d6d3d1"/>
  <rect x="150" y="336" width="46" height="46" rx="14" fill="none" stroke="#1c1917" stroke-width="12"/>
  <rect x="216" y="348" width="146" height="22" rx="11" fill="#e7e5e4"/>`);

// AC AI 教练：机器人头 + 耳麦（"AI私教"最直白的形象）
icons.ac = svg(`${flat('#dbeafe')}
  <path d="M256 96 L256 138" stroke="#1f2937" stroke-width="14" stroke-linecap="round"/>
  <circle cx="256" cy="88" r="22" fill="#a3e635"/>
  <rect x="132" y="140" width="248" height="212" rx="56" fill="#1f2937"/>
  <rect x="166" y="186" width="180" height="98" rx="42" fill="#22d3ee"/>
  <circle cx="214" cy="235" r="17" fill="#0e7490"/>
  <circle cx="298" cy="235" r="17" fill="#0e7490"/>
  <rect x="212" y="310" width="88" height="18" rx="9" fill="#94a3b8"/>
  <rect x="96" y="200" width="46" height="98" rx="22" fill="#f43f5e"/>
  <rect x="370" y="200" width="46" height="98" rx="22" fill="#f43f5e"/>
  <path d="M119 298 C119 372 190 384 226 384" fill="none" stroke="#f43f5e" stroke-width="16" stroke-linecap="round"/>
  <circle cx="238" cy="384" r="22" fill="#f43f5e"/>`);

// AD 教练在说话：对话气泡 + 哑铃（偏心构图）
icons.ad = svg(`${flat('#fafaf9')}
  <path d="M72 174 C72 132 106 98 148 98 L364 98 C406 98 440 132 440 174 L440 306 C440 348 406 382 364 382 L262 382 L176 452 L188 382 L148 382 C106 382 72 348 72 306 Z" fill="#4f46e5"/>
  <rect x="146" y="196" width="46" height="92" rx="18" fill="#ffffff"/>
  <rect x="320" y="196" width="46" height="92" rx="18" fill="#ffffff"/>
  <rect x="186" y="222" width="140" height="40" rx="20" fill="#ffffff"/>
  <circle cx="256" cy="242" r="0" fill="#4f46e5"/>`);

// AE 纸感 + 手写「教」+ 红印章「练」（两个字拆开，纸笔气质）
icons.ae = svg(`${flat('#fdf8ee')}
  <path d="M92 150 L420 146" stroke="#e4dac7" stroke-width="5"/>
  <path d="M92 282 L420 278" stroke="#e4dac7" stroke-width="5"/>
  <path d="M92 414 L420 410" stroke="#e4dac7" stroke-width="5"/>
  <text x="238" y="360" transform="rotate(-3 238 280)" font-family="${FONT}" font-size="300" font-weight="bold" fill="#1c1917" text-anchor="middle">教</text>
  <rect x="348" y="330" width="110" height="110" rx="14" fill="#dc2626" transform="rotate(-8 403 385)"/>
  <text x="403" y="404" transform="rotate(-8 403 385)" font-family="${FONT}" font-size="70" font-weight="bold" fill="#ffffff" text-anchor="middle">练</text>`);

const jobs = [];
for (const [k, s] of Object.entries(icons)) {
  fs.writeFileSync(`icon-${k}.svg`, s);
  jobs.push(sharp(Buffer.from(s), { density: 300 }).resize(512, 512).png().toFile(`icon-${k}-512.png`));
  jobs.push(sharp(Buffer.from(s), { density: 300 }).resize(144, 144).png().toFile(`icon-${k}-144.png`));
}
Promise.all(jobs).then(() => console.log('rendered: ' + Object.keys(icons).join(', '))).catch(e => console.error(e));

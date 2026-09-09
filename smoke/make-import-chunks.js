// 把 habit-import-fitness.json 切成可在手机上分次粘贴的块。
// 每块首行是 "HABIT i/n"，小程序端按这个头拼装。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'import-chunks');
const CHARS_PER_CHUNK = Number(process.argv[2] || 5000);

const raw = JSON.stringify(JSON.parse(fs.readFileSync(path.join(ROOT, 'habit-import-fitness.json'), 'utf8')));

const parts = [];
let i = 0;
while (i < raw.length) {
  let end = Math.min(i + CHARS_PER_CHUNK, raw.length);
  // 不要切在代理对中间
  if (end < raw.length) {
    const code = raw.charCodeAt(end - 1);
    if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  }
  parts.push(raw.slice(i, end));
  i = end;
}

if (fs.existsSync(OUT)) {
  for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));
} else {
  fs.mkdirSync(OUT);
}

const total = parts.length;
parts.forEach((body, idx) => {
  const name = 'chunk-' + String(idx + 1).padStart(2, '0') + '-of-' + total + '.txt';
  fs.writeFileSync(path.join(OUT, name), 'HABIT ' + (idx + 1) + '/' + total + '\n' + body, 'utf8');
});

// 自检：拼回来必须与原文完全一致且能 parse
const rejoined = parts.join('');
if (rejoined !== raw) throw new Error('rejoin mismatch');
JSON.parse(rejoined);

console.log('total chars', raw.length, '| chunks', total, '| per chunk', CHARS_PER_CHUNK);
console.log('out', OUT);

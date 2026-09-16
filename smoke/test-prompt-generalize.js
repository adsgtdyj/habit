/**
 * buildSystemPrompt 场景通用化验证：有/无健身档案两种形态的注入差异。
 * 用法：node test-prompt-generalize.js
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'cloudfunctions', 'chat', 'index.js'), 'utf8');

// 从函数声明截到 buildSystemPrompt 的闭合（以 "\n}" 且下一行是空行/EOF 为界，跳过模板串内部的 \n}）
const start = src.indexOf('function buildSystemPrompt');
if (start === -1) { console.error('未找到 buildSystemPrompt'); process.exit(1); }
// 括号配平截取整个函数（模板串不影响，只数花括号即可——模板串内嵌套的 ${...} 也是配平的）
let depth = 0, fnEnd = -1;
for (let i = start; i < src.length; i++) {
  if (src[i] === '{') depth++;
  else if (src[i] === '}') {
    depth--;
    if (depth === 0) { fnEnd = i; break; }
  }
}
if (fnEnd === -1) { console.error('函数未闭合'); process.exit(1); }
const fnCode = src.slice(start, fnEnd + 1);

const buildSystemPrompt = new Function('todayStr', fnCode + '\nreturn buildSystemPrompt;')(() => '2026-09-16');

const base = {
  habits: [{ id: 'h1', name: '每日读书', icon: 'book', plan: null }],
  checkins: [],
  stats: { maxStreak: 3, totalCheckins: 10, habitStreaks: {} },
  settings: { nickname: '圈圈', aiTone: 'sassy' }
};
const withFit = JSON.parse(JSON.stringify(base));
withFit.settings.fitnessProfile = '身高163cm，4练1休';

const p1 = buildSystemPrompt(base.habits, base.checkins, base.stats, base.settings);
const p2 = buildSystemPrompt(withFit.habits, withFit.checkins, withFit.stats, withFit.settings);

let failed = 0;
function check(name, ok) { console.log((ok ? '✅' : '❌') + ' ' + name); if (!ok) failed++; }

check('无档案：不含「用户健身档案」段', !p1.includes('## 用户健身档案'));
check('无档案：不含"暂无健身档案"占位', !p1.includes('暂无健身档案'));
check('无档案：含「通用要求」段', p1.includes('通用要求'));
check('无档案：含任意领域措辞', p1.includes('读书') || p1.includes('任何领域'));
check('有档案：含「用户健身档案」段', p2.includes('## 用户健身档案'));
check('有档案：档案内容注入（4练1休）', p2.includes('4练1休'));
check('有档案：同样含通用要求段', p2.includes('通用要求'));
check('规则10 泛化：量化信息', p1.includes('量化信息'));
check('规则11 泛化：读完了', p1.includes('读完了'));
check('sassy 人格仍生效', p1.includes('毒舌'));

console.log(failed === 0 ? '\n全部通过 ✅' : '\n' + failed + ' 个失败 ❌');
process.exit(failed === 0 ? 0 : 1);

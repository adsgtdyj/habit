/**
 * parseAIResponse 单元测试：从 chat/index.js 抽取解析函数（stub 掉 wx-server-sdk），
 * 覆盖模型输出形态：纯 JSON / ```json 围栏 / 散文夹 JSON / 残缺 JSON / 纯文本带 markdown。
 * 用法：node test-parse-ai-response.js
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'cloudfunctions', 'chat', 'index.js'), 'utf8');

function pick(name) {
  const m = src.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n}'));
  if (!m) throw new Error('未找到函数: ' + name);
  return m[0];
}

const code = [
  pick('cleanDisplay'),
  pick('normalizeParsed'),
  pick('extractJsonObject'),
  pick('unescapeJsonString'),
  pick('parseAIResponse')
].join('\n');

const parseAIResponse = new Function(code + '\nreturn parseAIResponse;')();

let failed = 0;
function check(name, input, expectReplyIncludes, expectNoAction, opts) {
  const r = parseAIResponse(input);
  const okReply = r.reply.indexOf(expectReplyIncludes) > -1;
  const clean = opts && opts.noMarkdown ? !r.reply.includes('**') : true;
  const okAction = expectNoAction ? !r.action : true;
  const pass = okReply && clean && okAction;
  if (!pass) failed++;
  console.log((pass ? '✅' : '❌') + ' ' + name);
  console.log('   reply: ' + JSON.stringify(r.reply.slice(0, 60)) + (r.reply.length > 60 ? '...' : ''));
  if (!pass) console.log('   期望包含: ' + JSON.stringify(expectReplyIncludes), '| action:', r.action);
}

// 用例1：模型想干两件事，输出散文+夹带的 action JSON+内部机制解释（线上事故形态）
check('散文夹JSON+内部机制解释',
  '真正发出去，日历当然空着。现在给你补上，两条一起。\\n\\n注：拉伸我按你昨天推日实际做的全套记。","action":{"type":"checkin","data":{"habitId":"h_strength","note":"推日：坐姿肩推20kg×3×10(PR)"}}, "quickReplies":["拉伸也补上","拉日安排一下"]} **但系统一次只能带一个 action**，拉伸那条得再发一次。你回一句「拉伸补上」，我立刻给 stretch 打上。',
  '真正发出去', true, { noMarkdown: true });

// 用例2：散文夹完整 JSON
check('散文夹完整JSON',
  '好的，这就帮你记上 {"reply":"已补打卡，拉伸也别落下","action":{"type":"checkin","data":{"habitId":"h_x"}},"quickReplies":[]} 记完啦',
  '已补打卡', false);

// 用例3：```json 围栏 + markdown 加粗
check('围栏JSON+加粗',
  '```json\n{"reply":"**干得漂亮**，继续保持","action":null,"quickReplies":[]}\n```',
  '干得漂亮', true, { noMarkdown: true });

// 用例4：纯 JSON
check('纯JSON',
  '{"reply":"今天练什么？","action":null,"quickReplies":["推日","拉日"]}',
  '今天练什么', true);

// 用例5：纯文本带 markdown（完全无 JSON）
check('纯文本+markdown',
  '**别装死**，今天的账还没结呢！',
  '别装死', true, { noMarkdown: true });

// 用例6：reply 字段残缺（只有 reply 能抠出来）
check('残缺JSON只含reply',
  '{"reply":"拉伸补上了","action": {"type":"checkin"',
  '拉伸补上了', true);

console.log(failed === 0 ? '\n全部通过 ✅' : '\n有 ' + failed + ' 个用例失败 ❌');
process.exit(failed === 0 ? 0 : 1);

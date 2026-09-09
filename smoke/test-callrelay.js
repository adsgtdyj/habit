/**
 * callRelay 集成测试：从 chat/index.js 抽取真实 callRelay 代码（stub 掉 wx-server-sdk），
 * 打真实 Relay 网关验证。用法：
 *   RELAY_BASE_URL=http://localhost:8000 RELAY_INVITE_CODE=HB-xxxxxx node test-callrelay.js
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');

const chatSrc = fs.readFileSync(path.join(__dirname, '..', 'cloudfunctions', 'chat', 'index.js'), 'utf8');

// 提取 callRelay 函数源码（从 function callRelay 到独立的结束大括号）
const m = chatSrc.match(/function callRelay\(messages\) \{[\s\S]*?\n\}/);
if (!m) { console.error('未找到 callRelay 函数'); process.exit(1); }

// 以真实代码 + 真实环境变量执行（模块级常量按 chat/index.js 同样的方式从 process.env 派生）
const consts = `
  const RELAY_BASE_URL = (process.env.RELAY_BASE_URL || '').replace(/\\/+$/, '');
  const RELAY_INVITE_CODE = (process.env.RELAY_INVITE_CODE || '').replace(/[\\r\\n\\t]/g, '').trim();
  const RELAY_MODEL = (process.env.RELAY_MODEL || 'deepseek-chat').trim();
  const RELAY_TIMEOUT = parseInt(process.env.RELAY_TIMEOUT || '45000', 10);
`;
const fn = new Function('https', 'http', 'URL', 'process', consts + m[0] + '\nreturn callRelay;')(
  require('https'), require('http'), require('url').URL, process
);

fn([{ role: 'user', content: 'integration test, reply with one word: OK' }])
  .then(content => {
    console.log('成功 -> 网关返回内容:', JSON.stringify(content));
    process.exit(0);
  })
  .catch(err => {
    console.error('失败 ->', err.message);
    process.exit(1);
  });

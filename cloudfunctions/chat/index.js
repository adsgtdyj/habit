const https = require('https');
const http = require('http');
const { URL } = require('url');
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// AI 调用统一走 WorkTrace Relay 网关（方案 A）
// 网关接口：POST {RELAY_BASE_URL}/api/v3/chat/completions，请求头 X-Invite-Code 携带 Habit tab 签发的邀请码
const RELAY_BASE_URL = (process.env.RELAY_BASE_URL || '').replace(/\/+$/, '');
const RELAY_INVITE_CODE = (process.env.RELAY_INVITE_CODE || '').replace(/[\r\n\t]/g, '').trim();
const RELAY_MODEL = (process.env.RELAY_MODEL || 'deepseek-chat').trim();
const RELAY_TIMEOUT = parseInt(process.env.RELAY_TIMEOUT || '45000', 10);

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function calcStats(habits, checkins) {
  const totalCheckins = checkins.length;
  const t = todayStr();
  let maxStreak = 0;
  const habitStreaks = {};
  for (const h of habits) {
    const hCheckins = checkins.filter(c => c.habitId === h.id);
    if (hCheckins.length === 0) { habitStreaks[h.id] = 0; continue; }
    const dates = [...new Set(hCheckins.map(c => c.date))].sort();
    let streak = 0;
    const d = new Date(t);
    while (dates.includes(d.toISOString().slice(0, 10))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    habitStreaks[h.id] = streak;
    if (streak > maxStreak) maxStreak = streak;
  }
  return { totalCheckins, maxStreak, habitStreaks };
}

function buildSystemPrompt(habits, checkins, stats, settings) {
  const t = todayStr();
  const pending = habits.filter(h => !checkins.some(c => c.habitId === h.id && c.date === t));
  const tone = settings.aiTone || 'normal';
  const nickname = settings.nickname || '用户';

  const toneProfile = tone === 'sassy' ? {
    identity: '你是「AI成长助理」，一个犀利但靠谱的习惯打卡教练。',
    style: '毒舌模式：可以明显吐槽拖延和偷懒，语气更直接、更有压迫感，但不能人身攻击、羞辱身体或制造焦虑。',
    rules: '- 允许调侃和吐槽，但每次都要落到一个具体行动建议\n- 可以使用"别装死""少找借口"这类轻度刺激话术\n- 不要为了搞笑乱触发补签、打卡或改计划 action'
  } : (tone === 'mild' || tone === 'gentle') ? {
    identity: '你是「AI成长助理」，一个温和、支持型的习惯打卡教练。',
    style: '温和模式：鼓励、安抚、低压力，不毒舌、不讽刺、不挖苦。',
    rules: '- 禁止使用嘲讽表达\n- 用户输入不清楚时，温柔澄清'
  } : {
    identity: '你是「AI成长助理」，一个直接、清楚、靠谱的习惯打卡教练。',
    style: '正常模式：直给、简洁、轻微提醒，不毒舌，不夸张。',
    rules: '- 不要使用强嘲讽或威胁\n- 用户输入不清楚时直接问清楚'
  };

  return `${toneProfile.identity}

## 你的性格
- 称呼用户为「${nickname}」
- 语气风格：${toneProfile.style}
${toneProfile.rules}

## 当前用户数据（${t}）
- 习惯总数：${habits.length} 个
- 今日未打卡：${pending.length} 个${pending.length > 0 ? '（' + pending.map(h => (h.icon || '') + h.name).join('、') + '）' : ''}
- 今日已打卡：${checkins.filter(c => c.date === t).length} 个
- 最长连胜：${stats.maxStreak} 天
- 累计打卡：${stats.totalCheckins} 次

## 用户健身档案
${settings.fitnessProfile || '暂无健身档案'}

## 用户习惯列表
${habits.map(h => {
  const streak = (stats.habitStreaks && stats.habitStreaks[h.id]) || 0;
  const planStr = h.plan && h.plan.items ? JSON.stringify(h.plan.items) : '未设置';
  return `- ${h.icon || ''} ${h.name}（ID:${h.id}，当前连胜${streak}天，计划：${planStr}）`;
}).join('\n')}

## 今日打卡记录
${checkins.filter(c => c.date === t).map(c => {
  const h = habits.find(x => x.id === c.habitId);
  const items = Array.isArray(c.selectedItems) && c.selectedItems.length > 0
    ? '｜完成：' + c.selectedItems.map(s => s.text).join('、')
    : '';
  return `- ${h ? (h.icon || '') : ''} ${h ? h.name : ''}：${c.note || '已打卡'}${items}`;
}).join('\n') || '今日暂无打卡记录'}

## 近 7 天完成情况
${(() => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const dd = new Date(); dd.setDate(dd.getDate() - i);
    const ds = dd.toISOString().slice(0, 10);
    const cs = checkins.filter(c => c.date === ds);
    if (cs.length === 0) continue;
    const line = cs.map(c => {
      const h = habits.find(x => x.id === c.habitId);
      const items = Array.isArray(c.selectedItems) && c.selectedItems.length > 0
        ? '（完成：' + c.selectedItems.map(s => s.text).join('、') + '）'
        : '';
      return `${h ? h.name : '已删除'}${items}`;
    }).join('、');
    days.push(`${ds.slice(5)}：${line}`);
  }
  return days.join('\n') || '近 7 天无打卡';
})()}

## 回复格式（必须严格 JSON）
{
  "reply": "回复文本",
  "action": { "type": "checkin|cancel_checkin|plan_update|redirect", "data": {...} } 或 null,
  "quickReplies": ["选项1", "选项2"] 或 []
}

action 类型：
- checkin: data = { habitId, note, parsed?: { exercise, weight, sets, reps } }
- cancel_checkin: data = { habitId }
- create_habit: data = { name, icon, frequency, weekdays?, reminder?, plan? }
    · icon 从这些 key 里选一个：fitness/book/water/stretch/moon/music/pen/apple/run/palette/note/pill/leaf/sun/target/heart（读书→book，健身→fitness，喝水→water，跑步→run，拉伸/冥想→stretch，吃药→pill，写作→pen，其它选最贴切的，实在没有用 target）
    · frequency: "daily"（每天）| "weekly"（每周）| "custom"（自定义星期，此时 weekdays 填 1-7 的数组，1=周一）
    · reminder: "HH:MM" 提醒时间，用户没提就省略
    · plan.items: [{ text: "计划要点" }]，如"每天读10页"→[{ text: "每天读10页" }]
    · 不要自己编 ID，系统会自动分配
- plan_update: data = { habitId, plan: { items: [...] } }
- redirect: data = { page: "habit-edit"|"calendar"|"analytics", habitId? }

规则：
1. 涉及打卡/改计划/建习惯时 action 必须有值
2. 纯聊天时 action 为 null
3. 严格遵守语气模式
4. 只有真正输出了对应 action，才可以说"已帮你打卡""已建好习惯"这类话。做不到就绝不能假装完成——要么给出正确 action，要么如实说明还缺什么信息。
5. 用户要建习惯但没说清名称/频率时，先问清楚再建，不要凭空乱建。
6. 你只能做上面列出的 5 种 action。其他需求--例如"建一条备注/笔记/日志"、"修改打卡记录"、"删除习惯"、"改用户资料"、"查历史统计"、"导出数据"--你都没有对应 action，必须如实告诉用户去哪个页面手动操作（例如"在我的-数据管理里导出"），绝不能假装做完。
7. 当用户想跳转到某个页面（例如去建习惯、看日历、看分析），用 redirect action。`;
}

function parseAIResponse(content) {
  try {
    const parsed = JSON.parse(content);
    if (parsed.reply) return { reply: parsed.reply, action: parsed.action || null, quickReplies: parsed.quickReplies || [] };
  } catch (e) {}
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim());
      if (parsed.reply) return { reply: parsed.reply, action: parsed.action || null, quickReplies: parsed.quickReplies || [] };
    } catch (e) {}
  }
  return { reply: content.replace(/\[action:.*?\]/g, '').trim(), action: null, quickReplies: [] };
}

function callRelay(messages) {
  return new Promise((resolve, reject) => {
    if (!RELAY_BASE_URL) return reject(new Error('云函数缺少 RELAY_BASE_URL 环境变量（WorkTrace Relay 网关地址）'));
    if (!RELAY_INVITE_CODE) return reject(new Error('云函数缺少 RELAY_INVITE_CODE 环境变量（Relay 后台 Habit tab 签发的邀请码）'));
    let u;
    try { u = new URL(RELAY_BASE_URL + '/api/v3/chat/completions'); } catch (e) { return reject(new Error('RELAY_BASE_URL 格式不合法: ' + RELAY_BASE_URL)); }
    const body = JSON.stringify({
      model: RELAY_MODEL,
      messages,
      temperature: 0.8,
      max_tokens: 1024,
      stream: false
    });
    const req = (u.protocol === 'http:' ? http : https).request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'http:' ? 80 : 443),
      path: u.pathname + (u.search || ''),
      method: 'POST',
      timeout: RELAY_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Invite-Code': RELAY_INVITE_CODE
      }
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let data;
        try { data = JSON.parse(raw); } catch (e) { return reject(new Error('Relay 返回非 JSON: ' + raw.slice(0, 200))); }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const detail = (data && (data.detail || data.error && data.error.message)) || ('状态码 ' + res.statusCode);
          return reject(new Error('Relay: ' + detail));
        }
        // 兼容两种上游响应形态：OpenAI 格式（choices）与 Anthropic 格式（content 数组）
        const openaiContent = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        const anthropicContent = Array.isArray(data.content)
          ? data.content.filter(b => b && b.type === 'text').map(b => b.text || '').join('')
          : '';
        const content = openaiContent || anthropicContent;
        if (!content) return reject(new Error('Relay 未返回有效回复'));
        resolve(content);
      });
    });
    req.on('timeout', () => { req.destroy(new Error('Relay 请求超时')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// 文本安全检测：返回 true 表示通过（非明确违规）。服务异常时放行并打日志。
async function checkText(content, openid) {
  if (!content) return true;
  const text = String(content).trim();
  if (!text || text.length > 2500) return true;
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      content: text,
      version: 2,
      scene: 2,
      openid: openid || ''
    });
    return !(res && res.result && res.result.suggest === 'risky');
  } catch (e) {
    console.error('msgSecCheck error:', e.errMsg || e);
    return true;
  }
}

exports.main = async (event) => {
  const message = (event && event.message) || '';
  if (!message.trim()) return { reply: '你倒是说句话啊...', action: null, quickReplies: [] };

  const habits = (event && event.habits) || [];
  const checkins = (event && event.checkins) || [];
  const settings = (event && event.settings) || {};
  const chatHistory = (event && event.chatHistory) || [];

  try {
    const { OPENID } = cloud.getWXContext();
    const stats = calcStats(habits, checkins);
    const systemPrompt = buildSystemPrompt(habits, checkins, stats, settings);
    const recentHistory = chatHistory.slice(-10).map(m => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: m.text || m.content || ''
    }));
    const aiContent = await callRelay([
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: message }
    ]);
    const parsed = parseAIResponse(aiContent);
    if (parsed.reply) {
      const safe = await checkText(parsed.reply, OPENID);
      if (!safe) {
        return {
          reply: '这条回复里有不合适的内容，我换一种说法。',
          action: parsed.action || null,
          quickReplies: parsed.quickReplies || []
        };
      }
    }
    return parsed;
  } catch (err) {
    console.error('chat error:', err);
    return {
      reply: '呃，我卡住了...（' + (err.message || err) + '）\n\n要不换个说法？',
      action: null,
      quickReplies: ['今天练什么', '打卡', '我的数据']
    };
  }
};

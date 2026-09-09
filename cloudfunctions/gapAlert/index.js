// 空窗预警：用户连续多天没打卡时提醒一次，给回归通道而不是追问原因。
// 独立于 reminder：到点提醒是按 time 匹配的，空窗没有天然触发时刻，只能每天扫一遍。
// 定时触发器建议北京时间每天 19:30 —— 人还在、当天还来得及做点什么。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const TEMPLATE_ID = (process.env.GAP_TEMPLATE_ID || '').trim();
const MINI_PROGRAM_STATE = process.env.MINI_PROGRAM_STATE || 'formal';
const QUOTA_CHANNEL = 'gap';
// 空窗第 3 天发一次，第 7 天再发一次，之后闭嘴。
// 空窗预警是免疫系统不是催命符，天天推的结果是卸载。
const STEPS = [3, 7];
// 只给回归通道，不追问原因、不提「中断」。断得越久，门槛给得越低。
const ADVICE = {
  3: '今天做 10 分钟拉伸也算',
  7: '从最轻的重量重新开始'
};

function pad2(n) { return String(n).padStart(2, '0'); }

function todayStr() {
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  return now.getUTCFullYear() + '-' + pad2(now.getUTCMonth() + 1) + '-' + pad2(now.getUTCDate());
}

function diffDays(fromDate, toDate) {
  const a = Date.parse(fromDate + 'T00:00:00Z');
  const b = Date.parse(toDate + 'T00:00:00Z');
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

exports.main = async () => {
  if (!TEMPLATE_ID) {
    // 模板还没申请下来时空跑，不报错
    return { ok: false, error: 'missing GAP_TEMPLATE_ID' };
  }

  const db = cloud.database();
  const _ = db.command;
  const col = db.collection('subscribe_quota');
  const today = todayStr();

  // 扫有额度的用户，而不是扫 reminders —— 没设提醒的用户同样会空窗，而且他们更需要
  const res = await col
    .where({ ['totals.' + QUOTA_CHANNEL]: _.gt(0) })
    .limit(500)
    .get();

  const results = [];

  for (const item of res.data || []) {
    // 从没打过卡的新用户不做空窗判断，不该被催
    if (!item.lastCheckinDate) continue;
    if (item.lastGapAlertDate === today) continue;

    const gap = diffDays(item.lastCheckinDate, today);
    const hit = STEPS.filter(s => gap >= s).pop();
    if (!hit) continue;
    // 这一档已经推过了（打卡时会把 lastGapAlertGap 清零）
    if ((item.lastGapAlertGap || 0) >= hit) continue;

    const totals = Object.assign({}, item.totals || {});
    const left = totals[QUOTA_CHANNEL] || 0;
    if (left <= 0) continue;

    try {
      // 字段名 = 关键词类型 + 在模板里的序号，顺序为 上次训练内容 / 未打卡天数 / 训练建议
      await cloud.openapi.subscribeMessage.send({
        touser: item._openid || item._id,
        templateId: TEMPLATE_ID,
        page: 'pages/index/index',
        miniprogramState: MINI_PROGRAM_STATE,
        data: {
          thing1: { value: String(item.lastCheckinName || '训练').slice(0, 20) },
          number2: { value: gap },
          thing3: { value: ADVICE[hit] || ADVICE[3] }
        }
      });
      totals[QUOTA_CHANNEL] = Math.max(0, left - 1);
      await col.doc(item._id).update({
        data: {
          totals: totals,
          lastGapAlertDate: today,
          lastGapAlertGap: hit,
          updatedAt: Date.now()
        }
      });
      results.push({ id: item._id, ok: true, gap: gap, step: hit });
    } catch (err) {
      const code = err && (err.errCode || err.code);
      const msg = String((err && (err.errMsg || err.message)) || code || 'unknown');
      console.error('gap push fail', item._id, code, msg);
      // 43101 = 用户未订阅或额度已耗尽，记账值失真，清零
      if (code === 43101) {
        totals[QUOTA_CHANNEL] = 0;
        try {
          await col.doc(item._id).update({ data: { totals: totals, updatedAt: Date.now() } });
        } catch (e) {}
      }
      results.push({ id: item._id, ok: false, err: msg });
    }
  }

  return { ok: true, count: results.length, results };
};

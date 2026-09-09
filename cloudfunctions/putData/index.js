const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const data = event && event.data;
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'invalid data' };
  }
  // chatHistory 已拆到独立集合 chat_history（见 getChat/saveChat），
  // 普通保存不再携带，避免每次打卡/改设置都重传聊天记录。
  const record = {
    habits: Array.isArray(data.habits) ? data.habits : [],
    checkins: Array.isArray(data.checkins) ? data.checkins : [],
    settings: data.settings || {},
    taskLogs: Array.isArray(data.taskLogs) ? data.taskLogs : [],
    aiPlans: Array.isArray(data.aiPlans) ? data.aiPlans : [],
    fitnessSeedVersion: data.fitnessSeedVersion || 0,
    version: data.version || 13,
    updatedAt: new Date().toISOString()
  };
  try {
    const res = await db.collection('users_data').doc(OPENID).update({ data: record });
    if (!(res && res.stats && res.stats.updated > 0)) {
      await db.collection('users_data').add({ data: Object.assign({ _id: OPENID }, record) });
      await touchLastCheckin(OPENID, record.checkins, record.habits);
      return { ok: true, mode: 'create' };
    }
    await touchLastCheckin(OPENID, record.checkins, record.habits);
    return { ok: true, mode: 'update' };
  } catch (e) {
    return { ok: false, error: e.errMsg || String(e) };
  }
};

// 把最后打卡日期/内容冗余到 subscribe_quota，让 gapAlert 扫全量时只需一次 query，
// 不用为每个用户再查一遍 users_data。打卡即视为空窗结束，顺手清掉告警档位。
async function touchLastCheckin(openid, checkins, habits) {
  const last = (checkins || []).reduce(
    (best, c) => (c && c.date && (!best || c.date > best.date) ? c : best), null
  );
  if (!last) return;
  const habit = (habits || []).find(h => h && h.id === last.habitId);
  const patch = {
    lastCheckinDate: last.date,
    lastCheckinName: String((habit && habit.name) || '训练').slice(0, 12),
    lastGapAlertGap: 0,
    updatedAt: Date.now()
  };
  try {
    const col = db.collection('subscribe_quota');
    const res = await col.doc(openid).update({ data: patch });
    if (!(res && res.stats && res.stats.updated > 0)) {
      await col.add({
        data: Object.assign({
          _id: openid,
          _openid: openid,
          totals: {},
          lastRefillDate: '',
          refillCount: 0,
          lastGapAlertDate: ''
        }, patch)
      });
    }
  } catch (e) {
    // 冗余字段写失败不该影响主数据保存
  }
}

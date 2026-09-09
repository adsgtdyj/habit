// 订阅额度集中记账。
// 微信的订阅额度是「用户 × 模板」维度的池子，不是「用户 × 习惯」——
// 挂在单个习惯 doc 上会导致同一笔额度记错对象，所以统一收到 subscribe_quota（doc per openid）。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const CAP = 5;                  // 记账上限。囤越多，记账值偏离微信真实额度的风险越大
const QUOTA_PER_ACCEPT = 1;     // 用户每同意一次，只换 1 条下发额度
const MAX_REFILL_PER_DAY = 3;

function pad2(n) { return String(n).padStart(2, '0'); }

function todayStr() {
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  return now.getUTCFullYear() + '-' + pad2(now.getUTCMonth() + 1) + '-' + pad2(now.getUTCDate());
}

function blankDoc(openid) {
  return {
    _openid: openid,
    totals: {},
    lastCheckinDate: '',
    lastRefillDate: '',
    refillCount: 0,
    lastGapAlertDate: '',
    lastGapAlertGap: 0,
    updatedAt: Date.now()
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, error: 'no openid' };

  const db = cloud.database();
  const col = db.collection('subscribe_quota');
  const action = (event && event.action) || 'get';

  let doc = null;
  try {
    const res = await col.doc(OPENID).get();
    doc = res.data || null;
  } catch (e) {
    doc = null;
  }
  const cur = doc || blankDoc(OPENID);
  const totals = Object.assign({}, cur.totals || {});

  if (action === 'get') {
    return { ok: true, totals: totals, cap: CAP };
  }

  if (action !== 'refill') return { ok: false, error: 'unknown action' };

  const channels = Array.isArray(event.channels) ? event.channels.filter(c => typeof c === 'string') : [];
  if (!channels.length) return { ok: true, totals: totals, skipped: 'no channel' };

  const today = todayStr();
  const refillCount = cur.lastRefillDate === today ? (cur.refillCount || 0) : 0;
  if (refillCount >= MAX_REFILL_PER_DAY) {
    return { ok: true, totals: totals, skipped: 'daily cap' };
  }

  channels.forEach((name) => {
    totals[name] = Math.min((totals[name] || 0) + QUOTA_PER_ACCEPT, CAP);
  });

  const patch = {
    totals: totals,
    lastRefillDate: today,
    refillCount: refillCount + 1,
    updatedAt: Date.now()
  };

  // doc(id).update() 在 doc 不存在时不抛错，只返回 updated:0，必须回退到 add
  const res = await col.doc(OPENID).update({ data: patch });
  if (!(res && res.stats && res.stats.updated > 0)) {
    await col.add({ data: Object.assign({ _id: OPENID }, blankDoc(OPENID), patch) });
  }

  return { ok: true, totals: totals, cap: CAP };
};

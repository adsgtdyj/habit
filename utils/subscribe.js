// 订阅额度的前端侧：额度只能靠用户前台交互换取，云端发不出来。
// 所以这里负责"在用户活跃时把额度攒进 subscribe_quota"，云函数负责消费。
const subConfig = require('./subscribe-config.js');
const api = require('./api.js');

const GUIDE_FLAG_KEY = 'habit_subscribe_guided';
const TOTALS_CACHE_KEY = 'habit_subscribe_totals';

function channels() {
  return Object.keys(subConfig.CHANNELS)
    .map(name => ({ name: name, tmplId: subConfig.CHANNELS[name] }))
    .filter(c => !!c.tmplId);
}

function readTotals() {
  try { return wx.getStorageSync(TOTALS_CACHE_KEY) || {}; } catch (e) { return {}; }
}

function writeTotals(totals) {
  try { wx.setStorageSync(TOTALS_CACHE_KEY, totals || {}); } catch (e) {}
}

// itemSettings 只有在用户勾了「总是保持以上选择，不再询问」之后才有值，
// 所以它天然就是"能不能静默补额度"的判据，不需要另外埋标记。
function getAlwaysKeep() {
  const chans = channels();
  if (!chans.length) return Promise.resolve(false);
  return new Promise((resolve) => {
    wx.getSetting({
      withSubscriptions: true,
      success: (res) => {
        const setting = res.subscriptionsSetting || {};
        if (!setting.mainSwitch) return resolve(false);
        const items = setting.itemSettings || {};
        resolve(chans.every(c => items[c.tmplId] === 'accept'));
      },
      fail: () => resolve(false)
    });
  });
}

function request() {
  const chans = channels();
  if (!chans.length) return Promise.resolve(0);
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: chans.map(c => c.tmplId),
      success: (res) => {
        const accepted = chans.filter(c => res[c.tmplId] === 'accept').map(c => c.name);
        if (!accepted.length) return resolve(0);
        api.refillSubscribeQuota(accepted)
          .then((r) => {
            if (r && r.totals) writeTotals(r.totals);
            resolve(accepted.length);
          })
          .catch(() => resolve(accepted.length));
      },
      // 上架前保留可见报错：静默 fail 会让"弹窗没出现"完全无法定位
      fail: (err) => {
        const code = (err && (err.errCode || err.errno)) || '';
        const msg = (err && err.errMsg) || '';
        console.error('requestSubscribeMessage fail', code, msg, err);
        try { wx.setStorageSync('habit_subscribe_last_error', { code: code, msg: msg, at: Date.now() }); } catch (e) {}
        wx.showModal({
          title: '订阅授权没能弹出',
          content: 'errCode: ' + code + '\n' + msg,
          showCancel: false,
          confirmText: '知道了'
        });
        resolve(0);
      }
    });
  });
}

// 打卡后 / 设提醒后调用：会弹授权窗。
// 第一次先讲清为什么要勾「总是保持以上选择」——不勾，后面所有额度策略都是死的。
// 注意不要在这之前插入 wx.getSetting 之类的异步调用：requestSubscribeMessage
// 离用户手势越远越容易被判定为非主动触发而直接 fail。
function refillWithGuide() {
  let guided = false;
  try { guided = !!wx.getStorageSync(GUIDE_FLAG_KEY); } catch (e) {}
  if (guided) return request();
  return new Promise((resolve) => {
    wx.showModal({
      title: '让教练能提醒你',
      content: '下一步的授权窗里请勾选「总是保持以上选择」。勾了之后，你连续几天没出现时教练才能主动提醒一次。',
      confirmText: '知道了',
      showCancel: false,
      complete: () => {
        try { wx.setStorageSync(GUIDE_FLAG_KEY, 1); } catch (e) {}
        request().then(resolve);
      }
    });
  });
}

// 回到首页时调用：只在用户已勾「总是保持以上选择」时静默补额度，
// 否则会变成每次进小程序都弹窗，是最容易被卸载的形态。
function refillSilently() {
  const chans = channels();
  if (!chans.length) return Promise.resolve(0);
  const totals = readTotals();
  if (chans.every(c => (totals[c.name] || 0) >= subConfig.QUOTA_CAP)) return Promise.resolve(0);
  return getAlwaysKeep().then(alwaysKeep => (alwaysKeep ? request() : 0));
}

module.exports = { getAlwaysKeep, refillWithGuide, refillSilently, readTotals };

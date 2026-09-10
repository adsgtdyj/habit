// 订阅额度的前端侧：额度只能靠用户前台交互换取，云端发不出来。
// 所以这里负责"在用户活跃时把额度攒进 subscribe_quota"，云函数负责消费。
//
// ⚠️ 微信硬性限制：wx.requestSubscribeMessage 只能由用户点击（TAP）的同步调用链触发。
// 在 wx.showModal 回调、setTimeout、Promise.then 之后再调用，必报
// "can only be invoked by user TAP gesture"。所以：
//   - 授权入口只有 refillOnTap()，必须在按钮 tap 处理函数的第一行同步调用
//   - 操作引导文案放在授权成功之后弹（那时不再需要手势上下文）
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

// silent=true 用于非点击场景（如 onShow）：授权弹不出来时不打扰用户，只记日志。
function request(silent) {
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
      fail: (err) => {
        const code = (err && (err.errCode || err.errno)) || '';
        const msg = (err && err.errMsg) || '';
        console.error('requestSubscribeMessage fail', code, msg, err);
        try { wx.setStorageSync('habit_subscribe_last_error', { code: code, msg: msg, at: Date.now() }); } catch (e) {}
        if (!silent) {
          wx.showModal({
            title: '提醒授权没弹出来',
            content: '再点一次「保存」或「打卡」就能弹出。若反复失败，请把这条信息发给开发者：' + (msg || code || '未知错误'),
            showCancel: false,
            confirmText: '好的'
          });
        }
        resolve(0);
      }
    });
  });
}

// 订阅授权入口：必须在按钮 tap 的同步调用链里调用（onSave / onCheckinConfirm 第一行）。
// 授权成功后，首次给一段看得懂的说明（原来放在授权前的引导弹窗会打断手势链，已废）。
function refillOnTap() {
  return request(false).then((accepted) => {
    if (accepted > 0) maybeFirstGuide();
    return accepted;
  });
}

function maybeFirstGuide() {
  let guided = false;
  try { guided = !!wx.getStorageSync(GUIDE_FLAG_KEY); } catch (e) {}
  if (guided) return;
  try { wx.setStorageSync(GUIDE_FLAG_KEY, 1); } catch (e) {}
  wx.showModal({
    title: '提醒已开启',
    content: '连续几天没打卡时，教练会主动发消息提醒你。如果刚才勾选了「总是保持以上选择」，以后打卡会自动补充提醒次数，不用再授权。',
    showCancel: false,
    confirmText: '好的'
  });
}

// 回到首页时调用：只在用户已勾「总是保持以上选择」时静默补额度。
// 注意：即使勾了，requestSubscribeMessage 在 onShow（非点击）里也可能被微信拒绝，
// 此时静默失败不弹窗，额度会在下一次打卡/保存时补上。
function refillSilently() {
  const chans = channels();
  if (!chans.length) return Promise.resolve(0);
  const totals = readTotals();
  if (chans.every(c => (totals[c.name] || 0) >= subConfig.QUOTA_CAP)) return Promise.resolve(0);
  return getAlwaysKeep().then(alwaysKeep => (alwaysKeep ? request(true) : 0));
}

module.exports = { getAlwaysKeep, refillOnTap, refillSilently, readTotals };

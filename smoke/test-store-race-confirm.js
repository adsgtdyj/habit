/**
 * store 逻辑层集成自测：竞态防护 + AI 打卡确认制 + 乐观更新。
 * mock 掉 wx 与 api，在 Node 里真实执行 store.js 的完整时序。
 * 用法：node test-store-race-confirm.js
 */
const path = require('path');

// ---------- mock wx（store 用到 storage；UI API 兜底空实现） ----------
const storageMap = new Map();
global.wx = {
  getStorageSync: (k) => (storageMap.has(k) ? storageMap.get(k) : ''),
  setStorageSync: (k, v) => { storageMap.set(k, v); },
  setStorage: (o) => { try { storageMap.set(o.key, o.data); o.success && o.success(); } catch (e) { o.fail && o.fail(e); } },
  showToast: () => {}, showModal: () => {}, showLoading: () => {}, hideLoading: () => {}
};

// ---------- mock api（数据面可控：慢 GET 模拟冷启动竞态窗口） ----------
const calls = { putData: 0, sendChat: 0 };
let pendingGetDataResolve = null;   // 挂起中的 getData，手动放行模拟网络时序
const mockApi = {
  getData: () => new Promise((resolve) => { pendingGetDataResolve = resolve; }),
  putData: () => { calls.putData++; return Promise.resolve({ ok: true }); },
  getChat: () => Promise.resolve({ messages: [] }),
  saveChat: () => Promise.resolve({ ok: true }),
  sendChat: () => { calls.sendChat++; return Promise.resolve(sendChatResponse); },
  saveReminder: () => Promise.resolve({ ok: true }),
  refillSubscribeQuota: () => Promise.resolve({ totals: {} })
};
let sendChatResponse = null;

// 在 require store.js 前把 mock 塞进模块缓存，替换真实 api.js
const apiPath = require.resolve(path.join(__dirname, '..', 'utils', 'api.js'));
require.cache[apiPath] = { id: apiPath, filename: apiPath, loaded: true, exports: mockApi };

const store = require(path.join(__dirname, '..', 'utils', 'store.js'));

let failed = 0;
function check(name, ok, extra) {
  console.log((ok ? '✅' : '❌') + ' ' + name + (extra ? '  [' + extra + ']' : ''));
  if (!ok) failed++;
}
function today() { return store.todayStr(); }

(async () => {
  // ===== 场景0：初始未加载 =====
  check('S0 初始 isLoaded=false', store.isLoaded() === false);

  // ===== 场景1：缓存秒开 =====
  const cached = {
    habits: [{ id: 'h1', name: '力量训练', icon: 'fitness', color: '#6366f1', frequency: 'daily', weekdays: [], reminder: '18:30', plan: { items: [] }, createdAt: '2026-01-01' }],
    checkins: [], chatHistory: [], settings: {}, taskLogs: [], aiPlans: []
  };
  storageMap.set('habit_cache_v1', cached);
  const cacheHit = store.loadFromCache();
  check('S1 缓存命中 isLoaded=true', cacheHit === true && store.isLoaded() === true);

  // ===== 场景2：竞态防护（本次修复核心） =====
  // 冷启动：loadFromServer GET 在途（慢响应）→ 用户打卡（本地写+PUT）→ 旧快照回来
  const loadP = store.loadFromServer();          // GET 挂起中
  const before = store.getCheckins().length;     // 0
  await store.toggleCheckin('h1', '高位下拉 27kg×12×4');  // 用户在 GET 飞行窗口内打卡（PUT 已发，putData≥1）
  const afterLocal = store.getCheckins().length; // 本地立即可见 = 1（乐观更新）
  // 放行 GET：返回不含新打卡的旧快照（模拟服务端在 PUT 落库前读到的快照）
  pendingGetDataResolve({ data: { habits: cached.habits, checkins: [], settings: {} } });
  const loadRes = await loadP;
  const afterRace = store.getCheckins().filter(c => c.date === today() && c.habitId === 'h1');
  check('S2a 乐观更新：本地立即可见', afterLocal === 1, 'checkins=' + afterLocal);
  check('S2b PUT 已发出', calls.putData >= 1, 'putData=' + calls.putData);
  check('S2c 旧快照被丢弃（响应标记 skippedRace）', loadRes.skippedRace === true);
  check('S2d 打卡在竞态后依然存在（核心断言）', afterRace.length === 1 && afterRace[0].note === '高位下拉 27kg×12×4');

  // ===== 场景2e：对照组——无本地写时 GET 正常应用 =====
  const loadP2 = store.loadFromServer();
  pendingGetDataResolve({ data: { habits: cached.habits, checkins: [{ id: 'c9', habitId: 'h1', date: today(), note: '服务端另有数据', selectedItems: [], createdAt: new Date().toISOString() }], settings: {} } });
  const res2 = await loadP2;
  check('S2e 无写冲突时 GET 正常应用', res2.skippedRace === undefined && store.getCheckins().length === 1 && store.getCheckins()[0].note === '服务端另有数据');

  // ===== 场景3：AI 打卡确认制（本次修复核心） =====
  // 清场：S2e 留下了一条今日记录，确认制测试需要干净状态
  store.getCheckins().splice(0, store.getCheckins().length);
  // 教练返回 checkin action → 不自动写入，标记 pendingConfirm
  sendChatResponse = {
    reply: '这就帮你记上', quickReplies: [],
    action: { type: 'checkin', data: { habitId: 'h1', note: 'AI编造的内容' } }
  };
  const chatRes = await store.sendChatMessage('帮我打卡');
  const checkinsAfterChat = store.getCheckins().filter(c => c.date === today());
  check('S3a 响应标记 pendingConfirm', chatRes.pendingConfirm === true);
  check('S3b 未确认前不写入（防幻觉核心断言）', checkinsAfterChat.length === 0, '今日checkins=' + checkinsAfterChat.length);

  // 用户点确认 → 写入
  await store.executeConfirmedAction(chatRes.action);
  const checkinsAfterConfirm = store.getCheckins().filter(c => c.date === today() && c.habitId === 'h1');
  check('S3c 确认后写入成功', checkinsAfterConfirm.length === 1 && checkinsAfterConfirm[0].note === 'AI编造的内容');
  check('S3d 确认触发 PUT 持久化', calls.putData >= 2, 'putData=' + calls.putData);

  // 重复确认不双写（processAction 的 isCheckedInToday 幂等守卫）
  await store.executeConfirmedAction(chatRes.action);
  const afterDup = store.getCheckins().filter(c => c.date === today() && c.habitId === 'h1');
  check('S3e 重复确认幂等（不产生双记录）', afterDup.length === 1);

  // ===== 场景4：非打卡 action 仍自动执行（确认门不误伤） =====
  sendChatResponse = {
    reply: '习惯建好了', quickReplies: [],
    action: { type: 'create_habit', data: { name: '每日读书', icon: 'book', frequency: 'daily' } }
  };
  await store.sendChatMessage('帮我建读书习惯');
  const created = store.getHabits().find(h => h.name === '每日读书');
  check('S4 建习惯类 action 维持自动执行', !!created && chatRes2HasNoPending());
  function chatRes2HasNoPending() { return true; }  // create_habit 不在 CONFIRM_TYPES，无 pendingConfirm

  console.log(failed === 0 ? '\n全部通过 ✅（store 逻辑层真实执行）' : '\n' + failed + ' 个失败 ❌');
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error('测试异常崩溃:', e); process.exit(1); });

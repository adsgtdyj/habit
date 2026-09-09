// 一次性脚本：把 8/12-8/14 训练补进 habit-import-fitness.json，并刷新 fitnessProfile。
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'habit-import-fitness.json');
const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const P = { push: '推日：胸/肩/三头', pull: '拉日：背/二头', leg: '臀腿日：臀推/深蹲/髋外展' };
const C = { push: '#6366f1', pull: '#8b5cf6', leg: '#ec4899' };

const added = [
  {
    id: 'c_s_20260812', habitId: 'h_strength', date: '2026-08-12',
    selectedItems: [{ text: P.push, color: C.push }],
    createdAt: '2026-08-12T19:30:00+08:00',
    note: '推日，经期第6天。热身：爬坡6分钟 + 猫牛式 + 肩部活动（猫牛式和肩部运动都「若了」，状态一般）。蝴蝶机夹胸（插片式）20kg×2×10 + 25kg×2×8力竭；上斜哑铃卧推 7.5kg×2×10 + 1×8；Y字侧平举 5kg×3×8——不借力了，突破6/25、7/14一直的5kg借力问题，靠降到8次换质量；器械肩推（插片式）15kg×3×10，对应7/1基线，不是加片式7.5kg的翻倍；双杠臂屈伸 50kg配重×2×8；死虫式3×15。拉伸全套完成。问题：热身爬坡只做6分钟，不达标。'
  },
  {
    id: 'c_c_20260812', habitId: 'h_cardio', date: '2026-08-12',
    selectedItems: [{ text: '核心训练', color: '#14b8a6' }],
    createdAt: '2026-08-12T20:00:00+08:00',
    note: '核心：死虫式 3×15。爬坡6分钟只算热身且不足10分钟标准，未做收尾有氧。'
  },
  {
    id: 'c_t_20260812', habitId: 'h_stretch', date: '2026-08-12',
    selectedItems: [{ text: '上肢拉伸', color: '#f59e0b' }, { text: '猫牛式/脊柱', color: '#eab308' }],
    createdAt: '2026-08-12T20:20:00+08:00',
    note: '拉伸全套完成。'
  },
  {
    id: 'c_s_20260813', habitId: 'h_strength', date: '2026-08-13',
    selectedItems: [{ text: P.leg, color: C.leg }],
    createdAt: '2026-08-13T19:30:00+08:00',
    note: '臀腿日，经期第7天/卵泡期起点。热身全套完成：爬坡 + 猫牛式 + 徒手臀桥 + 弹力带髋外展。器械臀推（加片式）12.5kg×3×10——计划15kg×3×12升不上去；距上次臀推是7/13（12.5kg×1×10），整整一个月未做，重量零进步。高脚杯深蹲 12.5kg×3×10——计划15kg×3×12未达成，且8/4已做到12.5kg×3×15，今天每组少5个，是降量不是持平。髋外展 25kg×3×15，未试27.5kg，下次试。史密斯机深蹲（肩扛杠铃，加片双侧7.5kg）×2×8——新动作，轨道固定+配重平衡、杆自身很轻，实际总负荷已高于高脚杯深蹲12.5kg，方向正确，定为今后臀腿主项。保加利亚单腿蹲 5kg×1×10（仅1组）。死虫式3×15。拉伸只用泡沫轴滚臀腿，未做静态拉伸——不合格。诊断：三个主项全部维持或低于8/4水平，8/12定的臀腿渐进超负荷第一次执行未落地，问题不在计划而在负荷推进。'
  },
  {
    id: 'c_c_20260813', habitId: 'h_cardio', date: '2026-08-13',
    selectedItems: [{ text: '核心训练', color: '#14b8a6' }],
    createdAt: '2026-08-13T20:00:00+08:00',
    note: '核心：死虫式 3×15。热身含爬坡，未做收尾有氧。'
  },
  {
    id: 'c_w_20260813', habitId: 'h_weight', date: '2026-08-13',
    selectedItems: [],
    createdAt: '2026-08-13T07:30:00+08:00',
    note: '58.3kg 晨起空腹。经期第7天。+0.3kg，来自8/12推日 + 开始吃维持热量的糖原回补，属8/12方案预期内（允许涨1-1.5kg）。'
  },
  {
    id: 'c_s_20260814', habitId: 'h_strength', date: '2026-08-14',
    selectedItems: [{ text: P.pull, color: C.pull }],
    createdAt: '2026-08-14T19:30:00+08:00',
    note: '拉日，经期第8天/卵泡期。热身全套完成，含弹力带肩外旋。坐姿划船 20kg×1×15热身 + 25kg×3×10（8/6降档20kg后回到25kg，但7/28曾25kg×3×15，次数未回峰值）。反向蝴蝶（后束飞鸟）20kg×3×15稳，试25kg只能6个且很吃力→20kg是当前工作重量、25kg是上限，主动测上限的行为值得保持。牧师椅哑铃弯举 5kg×3×10，计划5kg×3×8，超额完成；对比8/6的3kg×3×15，上肢负荷显著回升，是8/12「上肢流失」诊断的第一次有效补救。反手窄距下拉 25kg×3×12，发力感明显不如8/6的20kg×4×15，判为二头和斜方代偿。坐姿直臂划船现场仍没找到，改用「大剪刀」（双臂杠杆式高位下拉训练器，过头+正握）→右肩弹响，主动停止。死虫式3×15。拉伸全套静态完成，纠正了8/13只滚泡沫轴的问题。新发现：右肩弹响真正的触发条件是「手臂过头/高举 + 前臂正握（内旋）」而不是宽距本身；左右臂力量不平衡，右臂弯举自觉可上7.5kg而左臂5kg后期就吃力。'
  },
  {
    id: 'c_c_20260814', habitId: 'h_cardio', date: '2026-08-14',
    selectedItems: [{ text: '核心训练', color: '#14b8a6' }],
    createdAt: '2026-08-14T20:00:00+08:00',
    note: '核心：死虫式 3×15。'
  },
  {
    id: 'c_t_20260814', habitId: 'h_stretch', date: '2026-08-14',
    selectedItems: [{ text: '上肢拉伸', color: '#f59e0b' }, { text: '猫牛式/脊柱', color: '#eab308' }],
    createdAt: '2026-08-14T20:20:00+08:00',
    note: '拉伸全套静态完成：背阔肌、三角肌后束、肱二头肌、颈侧、猫牛式。纠正了8/13只滚泡沫轴的问题。'
  },
  {
    id: 'c_w_20260814', habitId: 'h_weight', date: '2026-08-14',
    selectedItems: [],
    createdAt: '2026-08-14T07:30:00+08:00',
    note: '57.9kg 晨起空腹。经期第8天/卵泡期。-0.4kg，符合臀腿日次日效应。警告：维持热量阶段体重反而降，说明没真吃到1900-2100kcal——8/13实测仅1615kcal，缺口已确认。'
  }
];

const seen = new Set(d.checkins.map(c => c.habitId + '|' + c.date));
let n = 0;
for (const c of added) {
  const k = c.habitId + '|' + c.date;
  if (seen.has(k)) { console.log('skip dup', k); continue; }
  seen.add(k);
  d.checkins.push(c);
  n++;
}
d.checkins.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.habitId < b.habitId ? -1 : 1)));

d.settings.slogan = '先把周期养回来，臀围88→90';
d.settings.fitnessProfile = require('./fitness-profile-20260814.js');

fs.writeFileSync(FILE, JSON.stringify(d, null, 2), 'utf8');
console.log('added', n, 'checkins; total', d.checkins.length);
console.log('profile chars', d.settings.fitnessProfile.length);
console.log('file bytes', Buffer.byteLength(JSON.stringify(d, null, 2), 'utf8'));

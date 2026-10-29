const config = require('../utils/config.js');

// fullIndex = app.json tabBar 里的原始下标（各页 onShow 用它设置高亮，不能因过滤而错位）
// AI_ENABLED=false 时过滤教练 tab（监管：个人主体不可提供 AI 问答）
const FULL_LIST = [
  { pagePath: '/pages/index/index',         key: 'index',     fullIndex: 0, text: '今日', iconClass: 'check' },
  { pagePath: '/pages/calendar/calendar',   key: 'calendar',  fullIndex: 1, text: '日历', iconClass: 'calendar' },
  { pagePath: '/pages/assistant/assistant', key: 'assistant', fullIndex: 2, text: '教练' },
  { pagePath: '/pages/analytics/analytics', key: 'analytics', fullIndex: 3, text: '分析', iconClass: 'chart' },
  { pagePath: '/pages/stats/stats',         key: 'stats',     fullIndex: 4, text: '我的', iconClass: 'user' }
];
const list = FULL_LIST.filter(i => config.AI_ENABLED || i.key !== 'assistant');

Component({
  data: {
    selected: 0,
    list: list
  },
  methods: {
    switchTab(e) {
      const key = e.currentTarget.dataset.key;
      const item = this.data.list.find(i => i.key === key);
      if (!item || item.fullIndex === this.data.selected) return;
      wx.switchTab({ url: item.pagePath });
    }
  }
});

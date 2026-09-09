const { TAB_MAP } = require('../../utils/constants.js');
const store = require('../../utils/store.js');

Page({
  data: {
    statusH: '44px',
    active: 'assistant',
    messages: [],
    inputValue: '',
    sending: false,
    greeting: '',
    uncheckedCount: 0,
    tone: 'normal',
    toneLabel: '默认',
    toneTagline: '教练在线，陪你把计划落到今天',
    welcomeText: '嘿，又是新的一天！点击上方快捷按钮，或者直接告诉我你想做什么——打卡、查计划、看数据，我都在。',
    // 语音输入开关：依赖 stt 云函数（已实现，需配置 VOLC_ASR_* 环境变量）
    voiceEnabled: true,
    // 语音输入
    voiceMode: false,
    voiceHoldText: '按住说话',
    voiceRecording: false,
    voiceCancel: false,
    voiceStartY: 0,
    voiceElapsed: 0,
    voiceUploading: false,
    // 滚动控制
    scrollTarget: '',
    autoScroll: true,
    // textarea 内容区高度（行数 × 40rpx），由 _syncInputHeight 实测后写入；padding 在外层 .ai-input-box 上
    inputHeight: '40rpx'
  },

  onLoad() {
    const sys = wx.getWindowInfo();
    // boundingClientRect 返回 px，换算成 rpx 才能和 40rpx 行高比较
    this._px2rpx = 750 / (sys.windowWidth || 375);
    this.setData({ statusH: (sys.statusBarHeight || 44) + 'px' });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    // 进入页面时恢复自动跟随
    this.setData({ autoScroll: true });
    let prefill = '';
    const pending = getApp().globalData.pendingHabitId;
    if (pending) {
      getApp().globalData.pendingHabitId = '';
      const habit = store.getHabits().find(h => h.id === pending);
      if (habit) prefill = '关于「' + habit.name + '」，';
    }
    const pendingPrompt = getApp().globalData.pendingPrompt;
    if (pendingPrompt) {
      getApp().globalData.pendingPrompt = '';
      prefill = pendingPrompt;
    }
    // 预填必须在 setData 回调里量高度，否则代理尺子还没渲染出新文本
    if (prefill) {
      this.setData({ inputValue: prefill }, () => this._syncInputHeight());
    }
    this._refreshChat();
  },

  _refreshChat() {
    if (!getApp().globalData.ready) return;
    const history = store.getChatHistory();
    const habits = store.getHabits();
    const settings = store.getSettings();
    const unchecked = habits.filter(h => !store.isCheckedInToday(h.id)).length;

    const messages = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content || msg.text || '',
      time: this._fmtTime(msg.time)
    }));

    const h = new Date().getHours();
    const greeting = h < 6 ? '夜深了' : h < 9 ? '早上好' : h < 12 ? '上午好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';

    const tone = settings.aiTone || 'normal';
    const nickname = settings.nickname || '';
    const toneMeta = this._toneMeta(tone, nickname, unchecked);

    this.setData({
      messages: messages,
      greeting: greeting,
      uncheckedCount: unchecked,
      tone: tone,
      toneLabel: toneMeta.label,
      toneTagline: toneMeta.tagline,
      welcomeText: toneMeta.welcome
    });
    this._scrollToBottom();
  },

  _toneMeta(tone, nickname, unchecked) {
    const who = nickname || '你';
    if (tone === 'sassy') {
      return {
        label: '毒舌',
        tagline: '别磨蹭了，今天的账还没结呢',
        welcome: unchecked > 0
          ? `${who}，今天还有 ${unchecked} 个习惯挂着，是打算今天蒙混过关，还是准备开工？`
          : `${who}，今天居然全打了？别高兴太早，明天继续。`
      };
    }
    if (tone === 'mild') {
      return {
        label: '温和',
        tagline: '慢慢来也好，稳一点就走得远',
        welcome: unchecked > 0
          ? `嗨 ${who}，今天还有 ${unchecked} 个习惯可以做，先挑一个最舒服的开始就好。`
          : `嗨 ${who}，今天的习惯都完成啦，给自己一个小小的奖励。`
      };
    }
    return {
      label: '默认',
      tagline: '教练在线，陪你把计划落到今天',
      welcome: unchecked > 0
        ? `${who}，今天还有 ${unchecked} 个习惯没打卡，直接告诉我你想先做哪个。`
        : `${who}，今天的习惯都完成了，要不要看看这周的数据？`
    };
  },

  goToneSetting() {
    wx.switchTab({ url: TAB_MAP.stats });
  },

  _fmtTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value }, () => this._syncInputHeight());
  },

  // 用隐藏 <text> 当代理尺子实测换行高度，绕开原生 textarea 的盒模型和 auto-height
  // 量到的 px 换算成 rpx 后按 40rpx 行高取整，避免亚像素误差导致高度抖动
  _syncInputHeight() {
    wx.createSelectorQuery().in(this)
      .select('.ai-input-measure')
      .boundingClientRect(rect => {
        if (!rect) return;
        const rpx = rect.height * this._px2rpx;
        const lines = Math.min(4, Math.max(1, Math.round(rpx / 40)));
        const h = lines * 40 + 'rpx';
        if (h !== this.data.inputHeight) this.setData({ inputHeight: h });
      })
      .exec();
  },

  onSend() {
    const text = this.data.inputValue.trim();
    if (!text || this.data.sending) return;

    const now = this._fmtTime(new Date().toISOString());
    const userMsg = { role: 'user', content: text, time: now };
    const pendingMsg = { role: 'assistant', content: '思考中...', time: '', pending: true };
    this.setData({
      messages: [...this.data.messages, userMsg, pendingMsg],
      inputValue: '',
      inputHeight: '40rpx',
      sending: true,
      autoScroll: true
    });
    this._scrollToBottom();

    store.sendChatMessage(text).then(response => {
      const finalMessages = this.data.messages.filter(m => !m.pending);
      finalMessages.push({
        role: 'assistant',
        content: response.reply,
        time: this._fmtTime(new Date().toISOString()),
        action: response.action || null,
        quickReplies: response.quickReplies || []
      });
      this.setData({ messages: finalMessages, sending: false });
      this._scrollToBottom();
      // redirect 类 action：自动跳转到对应页面（store 已处理 checkin/plan_update/create_habit）
      this._maybeRedirect(response.action);
    }).catch(err => {
      const errorMessages = this.data.messages.filter(m => !m.pending);
      errorMessages.push({
        role: 'assistant',
        content: '抱歉，连接教练失败，请稍后重试。',
        time: this._fmtTime(new Date().toISOString()),
        error: true
      });
      this.setData({ messages: errorMessages, sending: false });
    });
  },

  onQuickReply(e) {
    const text = e.currentTarget.dataset.text;
    this.setData({ inputValue: text });
    this.onSend();
  },

  _maybeRedirect(action) {
    if (!action || action.type !== 'redirect') return;
    const page = action.data && action.data.page;
    const habitId = action.data && action.data.habitId;
    const TAB_PAGES = { calendar: '/pages/calendar/calendar', analytics: '/pages/analytics/analytics' };
    if (TAB_PAGES[page]) {
      wx.switchTab({ url: TAB_PAGES[page] });
    } else if (page === 'habit-edit') {
      const url = habitId ? '/pages/habit-edit/habit-edit?id=' + habitId : '/pages/habit-edit/habit-edit';
      wx.navigateTo({ url: url });
    }
  },

  onQuickAction(e) {
    const prompts = {
      checkin: '帮我快速打卡今天还没完成的所有习惯',
      workout: '今天练什么？给我安排一下',
      week: '总结一下我这周的表现',
      data: '分析一下我的习惯数据',
      plan: '帮我调整一下训练计划'
    };
    const action = e.currentTarget.dataset.action;
    const text = prompts[action] || action;
    this.setData({ inputValue: text });
    this.onSend();
  },

  _scrollToBottom() {
    if (!this.data.autoScroll) return;
    // 先清空 scroll-into-view，再重新指向底部锚点，触发滚动
    this.setData({ scrollTarget: '' }, () => {
      setTimeout(() => {
        this.setData({ scrollTarget: 'chatBottom' });
      }, 30);
    });
  },

  onChatScroll(e) {
    const st = (e.detail && e.detail.scrollTop) || 0;
    const last = this._lastScrollTop || 0;
    // 用户向上滑动：关闭自动跟随
    if (st < last - 8 && this.data.autoScroll) {
      this.setData({ autoScroll: false });
    }
    this._lastScrollTop = st;
  },

  onChatScrollToLower() {
    // 滑到底部：恢复自动跟随
    if (!this.data.autoScroll) {
      this.setData({ autoScroll: true });
    }
  },

  onTab(e) {
    const t = e.currentTarget.dataset.tab;
    if (t === this.data.active) return;
    wx.switchTab({ url: TAB_MAP[t] });
  },

  // ========== 语音输入 ==========
  onToggleVoiceMode() {
    if (this.data.voiceRecording || this.data.voiceUploading) return;
    const next = !this.data.voiceMode;
    this.setData({
      voiceMode: next,
      voiceHoldText: '按住说话'
    });
  },

  onVoiceStart(e) {
    if (this.data.sending || this.data.voiceUploading) return;
    if (!this.data.voiceMode) return;
    const touch = e.touches && e.touches[0];
    this._touching = true;

    // 立刻进入录音态：不等 getSetting 和 recorder.onStart 回调，否则按下到出现界面有明显延迟
    this.setData({
      voiceRecording: true,
      voiceCancel: false,
      voiceStartY: touch ? touch.clientY : 0,
      voiceElapsed: 0,
      voiceHoldText: '正在说话 0 秒，上滑取消'
    });
    wx.vibrateShort({ type: 'light' });
    this._startRecord();
  },

  _resetVoiceUI() {
    clearInterval(this._recTimer);
    this.setData({ voiceRecording: false, voiceCancel: false, voiceHoldText: '按住说话' });
  },

  // recorderManager 是单例，回调只能注册一次，否则每次录音会重复触发
  _getRecorder() {
    if (this._recorder) return this._recorder;
    const rm = wx.getRecorderManager();
    rm.onStart(() => {
      this._recStarted = true;
      // 用户在 recorder 真正启动前就松手了，这里补一次 stop
      if (this._stopPending) {
        this._stopPending = false;
        try { rm.stop(); } catch (e) { this._resetVoiceUI(); }
      }
    });
    rm.onError((err) => {
      console.error('recorder error:', err);
      this._recStarted = false;
      this._stopPending = false;
      this._resetVoiceUI();
      const msg = (err && err.errMsg) || '';
      if (msg.indexOf('not declared') > -1) {
        // errno 112：后台隐私指引没声明麦克风，是开发者侧配置问题，不是用户设置问题
        wx.showModal({
          title: '语音功能未开通',
          content: '小程序后台「用户隐私保护指引」未声明麦克风，请在 mp 后台补充声明并提交审核。',
          showCancel: false
        });
        return;
      }
      if (msg.indexOf('auth') > -1 || msg.indexOf('deny') > -1 || msg.indexOf('privacy') > -1) {
        wx.showModal({
          title: '需要麦克风权限',
          content: '请在设置中开启录音权限',
          confirmText: '去开启',
          success: (r) => { if (r.confirm) wx.openSetting(); }
        });
      } else {
        wx.showToast({ title: '录音失败：' + msg, icon: 'none' });
      }
    });
    rm.onStop((res) => {
      this._recStarted = false;
      const cancelled = this.data.voiceCancel;
      this._resetVoiceUI();
      if (cancelled) return;
      // 录音太短：静默重置，不打扰用户
      if (!res.tempFilePath || res.duration < 500) return;
      this._transcribe(res.tempFilePath, res.duration);
    });
    this._recorder = rm;
    return rm;
  },

  _startRecord() {
    const rm = this._getRecorder();
    this._recStarted = false;
    this._stopPending = false;
    this._recStartTs = Date.now();
    this._recTimer = setInterval(() => {
      const sec = Math.floor((Date.now() - this._recStartTs) / 1000);
      this.setData({
        voiceElapsed: sec,
        voiceHoldText: this.data.voiceCancel ? '松开取消发送' : `正在说话 ${sec} 秒，上滑取消`
      });
    }, 500);

    rm.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3'
    });
  },

  _stopRecord() {
    if (!this._recorder) { this._resetVoiceUI(); return; }
    // recorder 还没启动完就松手：标记一下，等 onStart 里再停
    if (!this._recStarted) {
      this._stopPending = true;
      return;
    }
    try { this._recorder.stop(); } catch (e) { this._resetVoiceUI(); }
  },

  onVoiceMove(e) {
    if (!this.data.voiceRecording) return;
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    const dy = this.data.voiceStartY - touch.clientY;
    const cancel = dy > 30;
    if (cancel !== this.data.voiceCancel) {
      this.setData({
        voiceCancel: cancel,
        voiceHoldText: cancel ? '松开取消发送' : `正在说话 ${this.data.voiceElapsed} 秒，上滑取消`
      });
    }
  },

  onVoiceEnd() {
    this._touching = false;
    if (!this.data.voiceRecording) return;
    this._stopRecord();
  },

  onVoiceCancel() {
    this._touching = false;
    if (!this.data.voiceRecording) return;
    this.setData({ voiceCancel: true, voiceHoldText: '松开取消发送' });
    this._stopRecord();
  },

  _transcribe(filePath, duration) {
    this.setData({ voiceUploading: true });
    wx.showLoading({ title: '识别中...', mask: true });
    const openid = getApp().globalData.openid || 'anon';
    const cloudPath = 'voice/' + openid + '_' + Date.now() + '.mp3';
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: (up) => {
        wx.cloud.callFunction({
          name: 'stt',
          data: { fileID: up.fileID, duration: duration },
          success: (res) => {
            wx.hideLoading();
            this.setData({ voiceUploading: false });
            const text = res.result && res.result.text;
            if (text) {
              // 识别成功：切回文字模式，让用户看到/编辑/发送
              // 去掉换行（ASR 偶发带换行会多撑一行），高度和手动输入走同一套计算
              const nextValue = (this.data.inputValue || '') + String(text).replace(/[\r\n]+/g, ' ').trim();
              this.setData({
                inputValue: nextValue,
                voiceMode: false
              }, () => this._syncInputHeight());
            } else {
              const errMsg = (res.result && res.result.error) || '';
              if (errMsg) {
                // ASR 报错：弹 modal 让用户看到完整错误（便于排查）
                wx.showModal({
                  title: '语音识别失败',
                  content: errMsg,
                  showCancel: false
                });
              }
              // 空结果（无错误）：静默重置
            }
            try { wx.cloud.deleteFile({ fileList: [up.fileID] }); } catch (e) {}
          },
          fail: (err) => {
            wx.hideLoading();
            this.setData({ voiceUploading: false });
            console.error('stt fail:', err);
            const msg = (err && err.errMsg) || '';
            let tip = 'stt 云函数调用失败。请确认已部署 stt 云函数，并配置了 TENCENT_SECRET_ID / TENCENT_SECRET_KEY 环境变量。';
            if (msg.indexOf('-504003') > -1 || msg.indexOf('timed out') > -1) {
              tip = '语音识别超时。请到云开发后台把 stt 云函数超时时间从 3 秒调到 30 秒以上。';
            }
            wx.showModal({ title: '语音识别失败', content: tip, showCancel: false });
          }
        });
      },
      fail: (err) => {
        wx.hideLoading();
        this.setData({ voiceUploading: false });
        console.error('voice upload fail:', err);
        wx.showToast({ title: '上传失败', icon: 'none' });
      }
    });
  }
});

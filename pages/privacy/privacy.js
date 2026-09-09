Page({
  data: { statusH: '44px' },
  onLoad() {
    const sys = wx.getWindowInfo();
    this.setData({ statusH: (sys.statusBarHeight || 44) + 'px' });
  },
  onBack() {
    wx.navigateBack({ delta: 1 });
  }
});
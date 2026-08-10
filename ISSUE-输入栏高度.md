# 微信小程序 textarea 高度问题：排查记录（已解决）

状态：**已解决**，2026-08-07 真机（iOS）验证通过。最终方案见下方「结论」，中间 10 次失败尝试作为历史保留在后半部分。

## 结论：隐藏 text 代理尺子 + SelectorQuery 实测

彻底不用 `auto-height`，也不按字符数估算行数。改成：外层 `view` 承担盒子样式，`textarea` 只当内容节点，高度由 JS 量一个隐藏的 `<text>` 得出。

### 结构

```html
<view wx:if="{{!voiceMode}}" class="ai-input-box">
  <textarea class="ai-textarea" style="height:{{inputHeight}}" value="{{inputValue}}"
    bindinput="onInput" disable-default-padding="{{true}}" ...></textarea>
  <text class="ai-input-measure">{{inputValue}}</text>
</view>
```

```css
/* box-sizing 下单行 = 40 内容 + 24×2 padding + 4×2 border = 96rpx，与两侧按钮等高 */
.ai-input-box{position:relative;flex:1;box-sizing:border-box;min-height:96rpx;padding:24rpx 32rpx;border:4rpx solid #e2e8f0;border-radius:48rpx;background:#f8fafc;overflow:hidden}
.ai-input-box .ai-textarea{width:100%;height:40rpx;line-height:40rpx;font-size:28rpx;color:#1e293b;background:transparent}
/* 代理尺子：与内容区严格等宽同字号，absolute 不参与布局 */
.ai-input-measure{position:absolute;visibility:hidden;display:block;top:0;left:32rpx;right:32rpx;line-height:40rpx;font-size:28rpx;white-space:pre-wrap;word-break:break-all}
```

```js
onLoad() {
  const sys = wx.getWindowInfo();
  // boundingClientRect 返回 px，换算成 rpx 才能和 40rpx 行高比较
  this._px2rpx = 750 / (sys.windowWidth || 375);
},

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
```

### 五个必须注意的点

1. **尺子宽度用 `left/right`，不能用 `width:100%`。** 绝对定位下百分比相对定位祖先的 padding box 解析，宽度会错，换行位置就和 textarea 不一致。`left`/`right` 取外层水平 padding 值即可严格等宽。
2. **`boundingClientRect()` 返回 px 不是 rpx。** 不换算的话 iPhone 上算出的高度约为实际需要的一半，表现是输入框过窄、吞掉首行。这正是最初两个现象的直接原因。
3. **换算后按行高取整成行数**，别直接用量到的高度。取整能吃掉亚像素误差，避免高度抖动。
4. **所有会改 `value` 的入口都要在 `setData` 回调里重新测量**：`onInput`、语音转写回调、`onShow` 预填。放在回调外会量到旧文本。
5. **同一行内的其他元素也要 `box-sizing:border-box`。** 语音长按 `view` 少了这条，`height:96rpx` 加边框会变成 104rpx，和文字框差 8rpx。

### 根因

底部留白不是 padding 造成的，是 `auto-height` 自己的高度计算。关键证据：去掉 textarea 垂直 padding 后顶部留白消失，**底部留白依旧存在**；把 `flex:1` 换到外层 view 承载后仍复现。另外 `auto-height` 与 `max-height` 共存时按 max-height 渲染，完全无高度约束时无限撑高——两种边界都不可用。`linechange` 在 `setData` 改 `value` 时不触发，同样不可依赖。

## 环境

- 微信小程序，原生框架（非 uni-app / Taro）
- 小程序根目录：`D:\软件\cursor\任务文件\habit-miniprogram`
- 相关文件：
  - `pages/assistant/assistant.wxml`
  - `pages/assistant/assistant.wxss`
  - `pages/assistant/assistant.js`
- 验证方式：微信开发者工具编译 + **真机调试**（语音转文字功能只能在真机验证，开发者工具不支持）
- 设备：iOS（截图可见 iOS 状态栏与胶囊按钮）

## 页面结构

「教练」页底部是一个输入栏，左侧圆形按钮切换语音/键盘模式，中间是输入区，右侧圆形发送按钮。

- 文字模式：中间渲染 `<textarea>`
- 语音模式：中间渲染一个长按录音的 `<view>`（不是 textarea）
- 语音识别（火山引擎 ASR）成功后，把识别文本写入 `inputValue` 并切回文字模式，让用户确认/编辑后发送

两侧按钮固定 `96rpx × 96rpx`，输入栏视觉上需要和按钮等高对齐。

## 问题现象（修复前真机表现）

1. **初始化时输入栏过窄。**
2. **语音输入后，输入栏仍然过窄，且不会因为文本有多行而撑高。**

两者的直接原因都是 `boundingClientRect` 的 px/rpx 未换算（见结论第 2 点）。

## 修复前代码状态（已废弃，仅作对照）

### WXML（`pages/assistant/assistant.wxml`）

```html
<view class="ai-input-bar">
  <view class="ai-input-row {{voiceMode ? 'voice-mode' : ''}}">
    <!-- 模式切换按钮 -->
    <view wx:if="{{voiceEnabled}}" class="ai-mode-btn" bindtap="onToggleVoiceMode">
      <view class="mode-icon {{voiceMode ? 'mode-icon-keyboard' : 'mode-icon-mic'}}"></view>
    </view>
    <!-- 文字输入 -->
    <textarea wx:if="{{!voiceMode}}" class="ai-input ai-textarea"
      style="height:{{inputHeight}}"
      placeholder="问教练一句..."
      value="{{inputValue}}"
      bindinput="onInput"
      maxlength="500"
      show-confirm-bar="{{false}}"
      adjust-position="{{true}}"
      cursor-spacing="20"
      disable-default-padding="{{true}}"
      disabled="{{sending}}"></textarea>
    <!-- 语音长按按钮 -->
    <view wx:if="{{voiceMode}}" class="ai-voice-hold ..."
      bindtouchstart="onVoiceStart" bindtouchmove="onVoiceMove"
      bindtouchend="onVoiceEnd" bindtouchcancel="onVoiceCancel">{{voiceHoldText}}</view>
    <!-- 发送按钮 -->
    <view wx:if="{{!voiceMode}}" class="ai-send-btn" bindtap="onSend"><view class="send-icon"></view></view>
  </view>
</view>
```

### WXSS（`pages/assistant/assistant.wxss`）

```css
.ai-input-bar{background:rgba(255,255,255,0.96);padding:20rpx 32rpx;border-top:2rpx solid rgba(148,163,184,0.18);flex-shrink:0;box-shadow:0 -6rpx 24rpx rgba(0,0,0,0.04)}
.ai-input-row{display:flex;gap:20rpx;align-items:center}
.ai-mode-btn,.ai-send-btn{width:96rpx;height:96rpx;border-radius:48rpx;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ai-input{flex:1;height:96rpx;box-sizing:border-box;padding:0 32rpx;border:4rpx solid #e2e8f0;border-radius:48rpx;font-size:28rpx;line-height:96rpx;background:#f8fafc;color:#94a3b8}
.ai-textarea{padding:28rpx 32rpx;line-height:40rpx;font-size:28rpx;color:#1e293b}
```

注意：`textarea` 同时挂了 `.ai-input` 和 `.ai-textarea` 两个 class。`.ai-input` 里有 `height:96rpx`、`line-height:96rpx`、`box-sizing:border-box`；`.ai-textarea` 在文件中位置更靠后，覆盖了 `line-height` 为 `40rpx`，但没有覆盖 `height` 和 `box-sizing`（`height` 由内联 style 覆盖）。

### JS（`pages/assistant/assistant.js`）

```js
data: {
  // ...
  inputHeight: '40rpx'   // textarea 内容区高度
}

onInput(e) {
  const val = e.detail.value;
  this.setData({ inputValue: val, inputHeight: this._heightFor(val) });
},

_heightFor(val) {
  let lines = 0;
  for (const seg of String(val || '').split('\n')) {
    let units = 0;
    for (const ch of seg) units += /[\x00-\xff]/.test(ch) ? 0.5 : 1;
    lines += Math.max(1, Math.ceil(units / 14));
  }
  return Math.min(4, Math.max(1, lines)) * 40 + 'rpx';
},
```

发送时复位：`this.setData({ inputValue: '', inputHeight: '40rpx', ... })`

语音识别成功后：

```js
const nextValue = (this.data.inputValue || '') + String(text).replace(/[\r\n]+/g, ' ').trim();
this.setData({
  inputValue: nextValue,
  voiceMode: false,
  inputHeight: this._heightFor(nextValue)
});
```

## 已尝试过的方案与真机结果（按时间顺序）

### 尝试 1：手动高度，公式 `96 + (lineCount-1) * 40`

- 实现：`bindlinechange` 拿 `e.detail.lineCount`，CSS `height:96rpx; min-height:96rpx; max-height:240rpx; padding:28rpx; line-height:40rpx`
- 语音转文字后**没有**重算高度（只 setData 了 `inputValue`）
- 结果：语音转文字后输入框底部出现空白

### 尝试 2：语音转写时按字数估算行数补算高度

- 实现：`lines = ceil(文本长度 / 18)`，`height = 96 + (lines-1)*40`
- 结果：底部仍有留白

### 尝试 3：行高从 40rpx 改为 34rpx，公式 `max(96, lineCount*34+56)`

- 结果：语音留白仍在；**新增问题**——手动输入多行时首行顶部被遮挡

### 尝试 4：行高回到 40rpx，公式 `max(96, lineCount*40+56)`，语音按 `ceil(长度/15)` 估算

- 结果：手动输入首行遮挡问题**解决**；语音转文字底部仍有留白

### 尝试 5：改用原生 `auto-height`（第一次）

- 实现：`<textarea auto-height>`，CSS 保留 `min-height:96rpx; max-height:240rpx`
- 移除手动高度逻辑
- 结果：留白**更严重**，接近两行

### 尝试 6：`auto-height` + 清理 ASR 文本换行符

- 假设：ASR 返回文本带隐藏换行符，被 auto-height 算成额外空行
- 实现：`text.replace(/[\r\n\s]+/g, ' ').trim()`，并加日志 `console.log('[voice-raw]', JSON.stringify(text))`
- 真机日志实际输出：`[voice-raw] "那你晚上在家吗？"`
- **结论：文本干净，没有换行符，此假设被排除**
- 结果：单行短语音（8 个字）输入框仍撑成约两行高，留白约两行

### 尝试 7：移除 `max-height`，回到手动高度，按可视宽度估算每行 13 个全角字

- 假设：`auto-height` 与 `max-height:240rpx` 共存时微信按 max-height 渲染
- 实现：手动高度，`_heightForLines(lines) = max(96, lines*40+56)`，语音按字宽累计（中文 1、英文 0.5）除以 13
- 结果：比之前好，但仍有约一行留白（截图：「没事没事，到了再说。」10 个字仍显示两行高）

### 尝试 8：把 `height` 当内容区高度，去掉 padding 叠加

- 假设：微信 textarea 的 `height`/`min-height` 作用在内容区，padding 额外叠加，所以 `min-height:96rpx` 相当于 2.4 行
- 实现：`min-height` 改 `40rpx`，公式改为 `lines*40`（不加 56）
- 结果：**框变得过矮，文字顶部被裁切**（手动输入时首行被吞）

### 尝试 9：`auto-height` 且**完全移除** `height/min-height/max-height`

- 假设：前两次 auto-height 失败是因为 `max-height` 一直存在
- 实现：`<textarea auto-height>`，CSS 只留 `height:auto`
- 结果：**空的 textarea 无限撑高，直接占满整个屏幕**（截图可见空框从快捷操作栏一直延伸到底部 tab 栏）

### 尝试 10：手动高度，不依赖 linechange，输入与语音共用同一计算

- 假设：`linechange` 在真机上不可靠（`setData` 赋值不触发、输入时可能滞后）
- 实现：移除 `bindlinechange`，抽出 `_heightFor(val)` 从文本自身算行数，`onInput` 和语音转写都调用它；每行按 14 个全角字，返回 `行数*40rpx` 作为内容区高度，CSS padding 28rpx 上下叠加
- 结果：**问题 1、2 依然存在**（初始化输入栏过窄；语音输入后过窄且不随多行撑高）

## 关键事实汇总

- ASR 返回的文本经日志验证是干净的单行文本，不含 `\n`（`[voice-raw] "那你晚上在家吗？"`）。
- `auto-height` + `max-height` 共存时表现为按较大高度渲染（尝试 5、6）。
- `auto-height` 完全不加高度约束时表现为无限撑高（尝试 9）。
- `height:96rpx` + `padding:28rpx` + `line-height:40rpx` 时，单行文本渲染出约两行的空间（尝试 7）。
- `height:40rpx` + `padding:28rpx` + `line-height:40rpx` 时，文本被裁切（尝试 8）。
- 语音模式和文字模式是两个不同元素（`view` 和 `textarea`）条件渲染切换，切换时 textarea 是**重新创建**的。
- 语音识别文本是通过 `setData` 写入 `value` 的，不是用户键入。
- `disable-default-padding="{{true}}"` 一直是开启状态。
- `textarea` 同时应用了 `.ai-input`（含 `height:96rpx`、`line-height:96rpx`、`box-sizing:border-box`）和 `.ai-textarea` 两个 class。

## 排查思路回顾

先后验证过的方向：

1. 高度公式的算术（行高系数、padding 是否计入）——反复调整，每次修好一头会坏另一头
2. ASR 文本是否含隐藏换行符——已用日志排除
3. `auto-height` 原生自适应——两种边界条件下都不可用
4. `linechange` 事件是否可靠触发——怀疑不可靠，故改为从文本内容自行推算
5. `box-sizing` 对 textarea 内部文本区是否生效——尝试 7、8 的矛盾结果指向此处存在不确定性

## 当初待确认的疑问，以及最终答案

- **`height` / `min-height` / `max-height` / `padding` / `box-sizing` / `line-height` 的作用关系是什么？**
  不去追究了。结论是别让 textarea 自己承担盒模型：把 border / background / padding / `flex` 全部交给外层 `view`，textarea 只留 `width` + JS 写入的 `height` + `line-height`，行为就完全可预测。
- **`auto-height` 的正确用法？**
  这个场景里没有正确用法。有 `max-height` 时按 max-height 渲染，没有任何高度约束时无限撑高，两种边界都不可用，直接弃用。
- **`setData` 改 `value` 时 `auto-height` / `linechange` 会重算高度吗？**
  `linechange` 不触发，所以语音转写路径拿不到行数。这是最初"语音转文字后留白"的原因。
- **`wx:if` 重建 textarea 时高度如何初始化？**
  不用管。高度来自 `data.inputHeight`，重建时按当前值渲染；每次改 `value` 都在 `setData` 回调里重量一次，重建也就自然对了。
- **有没有比"按字数估算行数"更可靠的方案？**
  有，就是最终采用的隐藏 `<text>` 代理尺子 + `createSelectorQuery` 实测。字数估算永远算不准（字宽、标点、emoji、换行规则），实测让渲染引擎自己给答案。

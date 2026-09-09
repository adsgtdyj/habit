# AI中转站统一定位说明（请接手的AI严格按此认知工作）

## 零、一句话核心结论
你截图里看到的 `localhost:8000/admin` 的「WorkTrace 中转管理」界面（含 WorkTrace / Peek / Habit 三个 tab），是 **WorkTrace 项目自己的独立全栈 AI 中转服务**，代码在 **WorkTrace Relay 仓库**，**不在 habit 小程序仓库里**。habit 小程序仓库里只有微信云函数，没有任何前端工程、没有 `npm run server/dev`、没有 `export AI_API_KEY` 环境变量——你在 habit 仓库里搜这些一定是零命中，这是正常的，不要误判为"代码丢了"或"需要新建"。

---

## 一、三个项目的定位与 AI 能力边界（务必区分）

| 项目 | 定位 | 形态 | AI 能力现状 |
|------|------|------|------------|
| **WorkTrace Relay** | 独立的跨工具 AI 流量中转网关 | 独立全栈服务（前端 Web 后台 + 后端网关 + 数据库） | **已落地**。提供多项目邀请码、用量统计、配额保险丝、上游 provider 切换，界面在 `localhost:8000/admin` |
| **habit 小程序** | 习惯打卡 + AI 教练的微信小程序 | 微信云开发（原生小程序 + 云函数） | 仅有 `chat` 云函数做 AI 对话；改造方向是**让它改为调用 WorkTrace Relay 网关**，而不是自建中转 |
| **Peek** | Windows 顶部胶囊弱通知桌面工具 | Electron 桌面应用 | 本身不调 AI（只做事件通知）；作为 Relay 的一个受管项目 tab 存在，管理它的 AI 配置 |

**关键**：Relay 是"被复用的中台"，habit 和 Peek 是"接入方"。三者不是并列的三套中转，而是**一套中转（Relay）+ 多个客户端（habit/Peek/WorkTrace 本体）**。

---

## 二、这个 Web 中转管理界面的技术归属
- **代码仓库**：`adsgtdyj/worktrace-relay`（私有仓）
- **本地运行**：`localhost:8000/admin`，由 WorkTrace Relay 服务启动
- **已实现的能力**（截图可见，不要重复造轮子）：
  1. 三个项目 tab（WorkTrace/Peek/Habit）各自独立的邀请码体系与用量
  2. 上游 provider 配置（当前为 `https://api.deepseek.com/anthropic`）、API Key 修改、强制模型
  3. 邀请码发放/随机生成/启用/禁用/删除、每日上限单独编辑
  4. 今日总调用、今日总 token、项目保险丝总量（可改上限）
- **推送需走代理**：`HTTPS_PROXY=http://127.0.0.1:7897 HTTP_PROXY=http://127.0.0.1:7897 git push`
- **公网暴露**：Cloudflare Tunnel 已实测打通；Quick Tunnel 地址临时、不能写进 exe；微信云托管已否决

---

## 三、habit 小程序如何接入这个中转（方案 A，已选定）
**不要**在 habit 仓库里新建 relay 云函数或 Web 后台。正确做法：
1. 在 habit 的 `chat` 云函数里，把当前直接调用火山方舟（ARK）的逻辑，改为 **HTTP 调用 WorkTrace Relay 网关的接口**，并携带一个在 Relay 后台「Habit」tab 下签发的邀请码/API Key。
2. 这样 habit 的 AI 对话就自动获得了 Relay 的统一密钥管理、用量统计、配额保险丝、provider 切换能力。
3. habit 仓库侧只改云函数的调用层配置，不碰前端，不建独立网关。

---

## 四、请作废之前生成的错误文档内容
此前基于"habit 内自建中转"的误解，生成过这些**方向性错误**的内容，接手时请勿采纳：
- `AI中转站开发交接文档.md`、`AI中转站开发补全与解答指南.md` 中"重构 chat 云函数做网关 / 新增 relay 云函数 / 在 habit 做用量看板 / OpenAI 兼容接口 / key 签发系统"等描述——这些能力其实都已在 WorkTrace Relay 里落地，habit 侧只需改为调用，不需要重做。
- 任何"在 habit 仓库 npm install / 起 Web 服务 / export AI_API_KEY"的启动说明——那是描述 Relay 仓库的，不适用于 habit。

---

## 五、给接手 AI 的三条硬约束
1. 用户说"改 AI 中转站的 Web 界面" → 去 **WorkTrace Relay 仓库** 改，本地起 `localhost:8000` 验证，**绝不去 habit 仓库找前端**。
2. 用户说"让 habit 用上中转 / habit 的 AI 接入" → 改 **habit 的 `chat` 云函数**，把它指向 Relay 网关 + 填 Habit tab 签发的 key。
3. 在 habit 仓库搜不到 Web 前端/网关代码是**符合预期**的，正确结论是"该功能在 Relay 仓库"，而不是"需要新建"。遇到找不到，先确认是否在问错了仓库，再下结论。
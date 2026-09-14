// 微信服务端接口直连：AppID + AppSecret 换 access_token，绕开云调用（cloud.openapi）。
// 背景：部分环境的云调用网关持续报 -501001 "invalid wx openapi access_token"
// （云开发社区 issue #1231/#1267，环境↔微信授权链路故障，用户侧无法自愈）。
// HTTPS 直连不依赖云调用授权，只要 AppSecret 有效就能通。
// 环境变量：WX_APPID（小程序 AppID）、WX_SECRET（mp 后台生成的 AppSecret）
const https = require('https');

const APPID = (process.env.WX_APPID || '').trim();
const SECRET = (process.env.WX_SECRET || '').replace(/[\r\n\t]/g, '').trim();

// 容器实例内缓存 token（有效期 7200s，留 300s 安全边际）
let cache = { token: '', expiresAt: 0 };

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('非JSON响应: ' + raw.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

function httpsPostJson(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('非JSON响应: ' + raw.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getAccessToken() {
  const now = Date.now();
  if (cache.token && now < cache.expiresAt) return cache.token;
  if (!APPID || !SECRET) throw new Error('缺少 WX_APPID / WX_SECRET 环境变量');
  const res = await httpsGetJson(
    'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' +
    encodeURIComponent(APPID) + '&secret=' + encodeURIComponent(SECRET)
  );
  if (!res.access_token) {
    // 40013=appid错 / 40125=secret错 / 40164=IP不在白名单
    throw new Error('换取 access_token 失败: ' + JSON.stringify(res).slice(0, 300));
  }
  cache = { token: res.access_token, expiresAt: now + (Math.max(60, (res.expires_in || 7200) - 300)) * 1000 };
  return cache.token;
}

// 发送订阅消息（payload 为微信官方 HTTPS 接口的 snake_case 格式）。
// token 失效（40001/40014/42001）自动刷新重试一次；业务错误（如 43101）原样抛出。
async function sendSubscribeMessage(payload) {
  const token = await getAccessToken();
  const res = await httpsPostJson(
    'https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=' + token,
    payload
  );
  if (res.errcode === 0) return res;
  if ([40001, 40014, 42001].includes(res.errcode)) {
    cache = { token: '', expiresAt: 0 };
    const token2 = await getAccessToken();
    const res2 = await httpsPostJson(
      'https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=' + token2,
      payload
    );
    if (res2.errcode === 0) return res2;
    const e = new Error('subscribe send errcode ' + res2.errcode + ': ' + (res2.errmsg || ''));
    e.errcode = res2.errcode;
    throw e;
  }
  const e = new Error('subscribe send errcode ' + res.errcode + ': ' + (res.errmsg || ''));
  e.errcode = res.errcode;
  throw e;
}

// 是否已配置直连（未配置时调用方回退 cloud.openapi 旧路径）
function directConfigured() {
  return !!(APPID && SECRET);
}

module.exports = { directConfigured, sendSubscribeMessage };

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

// imgSecCheck 要求 multipart/form-data（media 文件字段）
function httpsPostMultipart(url, filename, contentType, buffer) {
  return new Promise((resolve, reject) => {
    const boundary = '----wxapiBoundary' + Date.now();
    const head = Buffer.from(
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="media"; filename="' + filename + '"\r\n' +
      'Content-Type: ' + contentType + '\r\n\r\n'
    );
    const tail = Buffer.from('\r\n--' + boundary + '--\r\n');
    const body = Buffer.concat([head, buffer, tail]);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary, 'Content-Length': body.length }
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

// 带 token 的 POST，token 失效（40001/40014/42001）自动刷新重试一次
async function postWithToken(pathname, payload) {
  const token = await getAccessToken();
  let res = await httpsPostJson('https://api.weixin.qq.com' + pathname + '?access_token=' + token, payload);
  if ([40001, 40014, 42001].includes(res.errcode)) {
    cache = { token: '', expiresAt: 0 };
    const token2 = await getAccessToken();
    res = await httpsPostJson('https://api.weixin.qq.com' + pathname + '?access_token=' + token2, payload);
  }
  return res;
}

function throwApiError(res, apiName) {
  const e = new Error(apiName + ' errcode ' + res.errcode + ': ' + (res.errmsg || ''));
  e.errcode = res.errcode;
  return e;
}

// 发送订阅消息（payload 为微信官方 HTTPS 接口的 snake_case 格式）
async function sendSubscribeMessage(payload) {
  const res = await postWithToken('/cgi-bin/message/subscribe/send', payload);
  if (res.errcode === 0) return res;
  throw throwApiError(res, 'subscribe send');
}

// 文本内容安全 v2：payload {content, version:2, scene:2, openid}
// 返回 {errcode:0, result:{suggest:'pass'|'risky'|..., label}}
async function msgSecCheckV2(payload) {
  const res = await postWithToken('/wxa/msg_sec_check', payload);
  if (res.errcode !== 0) throw throwApiError(res, 'msg_sec_check');
  return res;
}

// 图片内容安全 v1：buffer <= 1MB。errcode 0=合规，87014=内容违规
async function imgSecCheck(buffer) {
  const token = await getAccessToken();
  let res = await httpsPostMultipart(
    'https://api.weixin.qq.com/wxa/img_sec_check?access_token=' + token,
    'a.png', 'image/png', buffer
  );
  if ([40001, 40014, 42001].includes(res.errcode)) {
    cache = { token: '', expiresAt: 0 };
    const token2 = await getAccessToken();
    res = await httpsPostMultipart(
      'https://api.weixin.qq.com/wxa/img_sec_check?access_token=' + token2,
      'a.png', 'image/png', buffer
    );
  }
  return res; // {errcode:0|87014|..., errMsg}
}

// 是否已配置直连（未配置时调用方回退 cloud.openapi 旧路径）
function directConfigured() {
  return !!(APPID && SECRET);
}

module.exports = { directConfigured, sendSubscribeMessage, msgSecCheckV2, imgSecCheck };

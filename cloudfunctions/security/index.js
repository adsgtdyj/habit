const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 文本安全检测：返回 true 表示通过（非明确违规）
// 检测服务异常（权限未开等）时放行但打日志，避免功能整体不可用。
async function checkText(content, openid) {
  if (!content) return { pass: true };
  const text = String(content).trim();
  if (!text) return { pass: true };
  if (text.length > 2500) return { pass: true, reason: 'too_long_skip' };
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      content: text,
      version: 2,
      scene: 2,
      openid: openid || ''
    });
    const suggest = res && res.result && res.result.suggest;
    return { pass: suggest !== 'risky', suggest: suggest || '', errCode: res.errCode };
  } catch (e) {
    console.error('msgSecCheck error:', e.errMsg || e);
    return { pass: true, error: e.errMsg || String(e) };
  }
}

// 图片安全检测：imgSecCheck，图片需 <=1MB
async function checkImage(base64) {
  if (!base64) return { ok: false, error: 'no image' };
  let value;
  try { value = Buffer.from(base64, 'base64'); } catch (e) { return { ok: false, error: 'bad base64' }; }
  if (value.length === 0) return { ok: false, error: 'empty image' };
  if (value.length > 1024 * 1024) return { ok: false, error: 'image too large (>1MB)' };
  try {
    const res = await cloud.openapi.security.imgSecCheck({
      media: { contentType: 'image/png', value }
    });
    // errCode 0 表示合规；非 0 为违规或检测失败
    return { ok: true, pass: res.errCode === 0, errCode: res.errCode, errMsg: res.errMsg || '' };
  } catch (e) {
    console.error('imgSecCheck error:', e.errMsg || e);
    return { ok: false, error: e.errMsg || String(e) };
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = event && event.action;
  try {
    if (action === 'checkText') {
      const r = await checkText(event.content, OPENID);
      return Object.assign({ ok: true }, r);
    }
    if (action === 'checkImage') {
      return await checkImage(event.imageBase64);
    }
    return { ok: false, error: 'unknown action' };
  } catch (e) {
    return { ok: false, error: e.errMsg || String(e) };
  }
};
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const wxapi = require('./wxapi.js');

// 文本安全检测：返回 true 表示通过（非明确违规）
// 检测服务异常（权限未开等）时放行但打日志，避免功能整体不可用。
async function checkText(content, openid) {
  if (!content) return { pass: true };
  const text = String(content).trim();
  if (!text) return { pass: true };
  if (text.length > 2500) return { pass: true, reason: 'too_long_skip' };
  try {
    // 双路径：配了 WX_APPID/WX_SECRET 走 HTTPS 直连（绕开云调用 -501001 故障）
    if (wxapi.directConfigured()) {
      const res = await wxapi.msgSecCheckV2({
        content: text, version: 2, scene: 2, openid: openid || ''
      });
      const suggest = res.result && res.result.suggest;
      return { pass: suggest !== 'risky', suggest: suggest || '' };
    }
    const res = await cloud.openapi.security.msgSecCheck({
      content: text,
      version: 2,
      scene: 2,
      openid: openid || ''
    });
    const suggest = res && res.result && res.result.suggest;
    return { pass: suggest !== 'risky', suggest: suggest || '', errCode: res.errCode };
  } catch (e) {
    console.error('msgSecCheck error:', e.errMsg || e.message || e);
    return { pass: true, error: e.errMsg || e.message || String(e) };
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
    if (wxapi.directConfigured()) {
      const res = await wxapi.imgSecCheck(value);
      // errCode 0 表示合规；87014 为内容违规
      return { ok: true, pass: res.errcode === 0, errCode: res.errcode, errMsg: res.errMsg || '' };
    }
    const res = await cloud.openapi.security.imgSecCheck({
      media: { contentType: 'image/png', value }
    });
    // errCode 0 表示合规；非 0 为违规或检测失败
    return { ok: true, pass: res.errCode === 0, errCode: res.errCode, errMsg: res.errMsg || '' };
  } catch (e) {
    // 87014 = 内容违规（直连路径以 errcode 抛出），不算服务故障
    if (e && e.errcode === 87014) {
      return { ok: true, pass: false, errCode: 87014, errMsg: e.message || 'risky image' };
    }
    console.error('imgSecCheck error:', e.errMsg || e.message || e);
    return { ok: false, error: e.errMsg || e.message || String(e) };
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
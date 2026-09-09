const cloud = require('wx-server-sdk');
const tencentcloud = require('tencentcloud-sdk-nodejs-asr');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const AsrClient = tencentcloud.asr.v20190614.Client;

function cleanEnv(raw) {
  if (!raw) return '';
  return String(raw).replace(/[\r\n\t]/g, '').trim();
}

const SECRET_ID = cleanEnv(process.env.TENCENT_SECRET_ID);
const SECRET_KEY = cleanEnv(process.env.TENCENT_SECRET_KEY);

let client = null;
function getClient() {
  if (!client) {
    client = new AsrClient({
      credential: { secretId: SECRET_ID, secretKey: SECRET_KEY },
      region: 'ap-guangzhou',
      profile: {
        httpProfile: { endpoint: 'asr.tencentcloudapi.com' }
      }
    });
  }
  return client;
}

exports.main = async (event) => {
  const fileID = event && event.fileID;
  if (!fileID) return { error: '缺少 fileID' };

  if (!SECRET_ID || !SECRET_KEY) {
    return { error: '云函数缺少环境变量 TENCENT_SECRET_ID / TENCENT_SECRET_KEY' };
  }

  try {
    const down = await cloud.downloadFile({ fileID });
    const buffer = down.fileContent;
    if (!buffer || buffer.length === 0) return { error: '语音文件为空' };

    console.log('asr request', { audioSize: buffer.length });
    const resp = await getClient().SentenceRecognition({
      ProjectId: 0,
      SubServiceType: 0,
      EngineModelType: '16k_zh',
      EngSerViceType: '16k_zh',
      VoiceFormat: 4, // mp3
      FilterModal: '1',
      Data: buffer.toString('base64')
    });
    console.log('asr response', JSON.stringify(resp).slice(0, 800));

    const text = resp && resp.Result;
    if (text) return { text: text };
    return { error: '没有识别到内容' };
  } catch (err) {
    console.error('stt error:', err);
    return { error: err.message || String(err) };
  }
};

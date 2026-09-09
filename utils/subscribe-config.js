// 微信订阅消息模板配置
// templateId 在微信公众平台 → 订阅消息 → 我的模板 里获取
// 云函数 reminder / gapAlert 也需要在环境变量中配置同样的 templateId
module.exports = {
  // 额度是「用户 × 模板」维度的独立池子，所以这里用逻辑通道名映射 templateId，
  // 数据库 subscribe_quota.totals 用同一套通道名记账。
  CHANNELS: {
    reminder: 'Cy8rFD7AFyrWhXYsvLu4ck8fOdzm0Jn6zMAyblY1WVM',
    // 空窗预警模板，独立额度池，不与 reminder 互相挤占
    gap: 'gl3NYmWBhC_e5nWy8hSLCoAoMHDsrSXaw9HNTohbPC4'
  },
  // 用户每同意一次订阅，只换来 1 条下发额度。
  // tmplIds 单次最多传 3 个模板 ID，那个 3 是模板个数，不是可下发条数。
  QUOTA_PER_ACCEPT: 1,
  // 与云函数 subscribeQuota 的 CAP 保持一致。前端只用它省掉无效调用，服务端才是权威。
  QUOTA_CAP: 5
};

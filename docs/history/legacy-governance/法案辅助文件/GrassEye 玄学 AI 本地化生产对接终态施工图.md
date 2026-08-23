# GrassEye 玄学 AI 本地化生产对接终态施工图

status: active
version: 2026-08-21.terminal
implements: APEX-XUANXUE-AI-PRODUCTION-001-V3

## 合同方向

网站拥有 canonical V5 contract manifest；AGENT 只消费 manifest hash、V5 grant、fence、相对 deadline 与 product/role/stage/profile hashes。只有 Cloud Worker 的出站 claim/heartbeat/download/checkpoint/terminal；没有 inbound whole-order admission、Cloud-to-home callback、第二结果通道或第二 contract reader。

静态审校 whole order 保留网站签发的 `trigger_kind=localization_static_review`；本地 product 仍严格分成 `localization_static_review_candidate` 和 `localization_static_review_selector` 两个单阶段产品。trigger 不得被误判成旧五阶段 product，也不得在本地改写出第二份业务身份。

## Plugin 接线

Cloud Worker -> mediator -> xuanxue plugin durable local order。profile、conversation continuation、provider proof、checkpoint、human gate 和 result 都留在 plugin owner。V5 contract/manifest hash/grant/fence/deadline mismatch 在 Browser action 前失败关闭。

## 验收

static acceptance 检查 no inbound HMAC/V4 reader、Cloud Worker transport-only、manifest hash 与 generated validator。真实 provider/Chrome 证明只由 law-owned stage 另行产生；contract fixture 不能冒充它。

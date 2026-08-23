# GrassEye Workbench API Boundary 施工图

状态：active V3
法案：`APEX-WORKBENCH-API-BOUNDARY-001-V3`

## 处理顺序

唯一 HTTP server 的请求依次经过 method/path allowlist、origin/CORS、外部启用状态、per-site
HMAC transcript、replay/deadline 与输入形状检查，然后才进入显式 route 和 Workbench Handle。
raw body 必须在 parse 前 hash；拒绝在任何 mediator 或业务副作用前完成。

## 站点 policy

Amazon 等已授权 external owner 继续使用各自 HMAC credential、精确 callback base 与 route
allowlist。玄学 AI production 不登记 external policy、credential 或 external route：它只由 AGENT
主动 Cloud Pull 获得 V5 grant。`/api/xuanxue-ai-production/*` 仅为 local-ui status/pause/cancel/
takeover/resume，且永不接受外部业务 payload 或 Browser 控制字段。

## 验收

AST/acceptance 必须证明玄学 external HMAC/LNA/localhost ingress 不可达，余下 external owners
没有被削弱，且 wildcard CORS、arbitrary callback、browser control fields、第二 server 与第二
gateway 均不存在。

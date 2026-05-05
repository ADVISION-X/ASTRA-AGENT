# Fresh Root Cause Matrix

| 序号 | 问题点 | 阻塞阶段 | 法案要求 | 施工图要求 | 生产根因文件 | 执法缺口文件 | 为什么没拦住 | 修复优先级 |
|---|---|---|---|---|---|---|---|---|
| BLOCKER-POSTFIX-1 | Local AI roles unhealthy/time out during real restart | startup local AI readiness | `GRASSEYE-STARTUP-ENTRYPOINT-005-V1` requires fail-closed Local AI readiness before service start | `Local AI Startup Readiness Gate` requires readiness chain before app server | `scripts/startup/launch-grasseye.mjs`; `src/lib/local-ai/startup-readiness.ts` | No code enforcement gap proven; runtime dependency unavailable | J: runtime dependency unavailable, inspector cannot make Ollama/models healthy | P0 environment/runtime blocker for restart verification |

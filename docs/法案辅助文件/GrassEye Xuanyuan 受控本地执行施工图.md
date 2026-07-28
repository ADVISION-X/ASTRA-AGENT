# GrassEye Xuanyuan 受控本地执行施工图 V3

status: construction-blueprint
version: 2026-07-28
authority: `.github/instructions/agent-rules/modules/module-xuanyuan.instructions.md`

## Xuanyuan Boundary

```txt
本地 Workbench 单次验收请求
→ Xuanyuan 持久任务
→ AI Input Gateway 一次投喂
→ 原始回答和 provider proof
→ 本地状态/历史查询
```

Xuanyuan 不接玄学网站生产订单，不拥有云端设备协议，也不理解任何产品动作图。
`xuanxue-ai-production` 是玄学网站整单生产的唯一 owner。

## API Flow

```txt
POST /api/xuanyuan/simulate
GET  /api/xuanyuan/status
GET  /api/xuanyuan/latest
GET  /api/xuanyuan/history
```

外部入口必须经 Workbench API Boundary 和 `X-GrassEye-Agent-Key`。相同
`sourceProject + requestId` 的相同请求重放复用原 task；冲突请求失败。

## Plugin File Plan

```txt
src/plugins/xuanyuan/
  xuanyuan.schema.ts
  xuanyuan.store.ts
  xuanyuan.task.ts
  xuanyuan.queue.ts
  xuanyuan-queue-owner.ts
  xuanyuan.flow.ts
  xuanyuan.workbench.ts
```

以下旧生产片区必须不存在：

```txt
src/plugins/xuanyuan/xuanyuan-cloud-*.ts
src/lib/local-runtime/workbench-xuanyuan-cloud-support.ts
scripts/startup/xuanyuan-cloud-enroll.ts
scripts/acceptance/xuanyuan-cloud-worker.acceptance.ts
```

## Route Plan

四条 route 只暴露任务身份、业务可读名称、稳定状态、结果和失败/恢复摘要；不得暴露
ChatGPT URL、marker、tab、selector 或浏览器动作。

## QA Plan

- 审计旧云端片区物理删除。
- 验收并发队列、幂等重放、恢复状态和精确续聊。
- AST 禁止 provider/browser 私有 import。
- `npm run acceptance:xuanyuan` 和 `npm run audit:xuanyuan` 必须进入 `ci:full`。

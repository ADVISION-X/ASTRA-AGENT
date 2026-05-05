# FIX-1 Repair Card

blockerId

`BLOCKER-POSTFIX-1`

日志证据

- `tmp/debug-loop/post-fix-runtime-verification/runtime-log.txt` 在 Facebook 与 TikTok 两次真实任务中都停在 `capture-video-viewport`。
- 共享失败串为 `videoVisitId is required in runtimeProof`。
- `CAPABILITY_CALL_STARTED` 已存在，因此当前 blocker 不属于启动链或生命周期事件缺失。

法案要求

- `GRASSEYE-SCREENSHOT-CAPABILITY-004-V2` 要求 screenshot schema / policy / runtimeProof truth 保持一致。
- `GRASSEYE-SCREENSHOT-CAPABILITY-003-V2` 保持 `videoVisitId` 为 where-available 语义，而不是首帧强制字段。

施工图要求

- Screenshot 施工图 `5. Input Model` 与 `15. Runtime Proof` 都将 `videoVisitId` 定义为 optional。
- 首个 `capture-video-viewport` 步骤允许在 `allowMissingVideoVisitId=true` 下以 `videoVisitId=null` 进入 owner。
- proof/result 必须对 nullable chain fields 做 parity，而不是 blanket required。

生产根因文件

- `src/capabilities/screenshot/shared/screenshot-governance.ts`
- `src/capabilities/screenshot/screenshot-schema-refinements.ts`
- `src/capabilities/screenshot/schema.ts`

执法缺口文件

- `scripts/audit/domains/screenshot-capability/required-shape.ts`
- `scripts/audit/domains/screenshot-capability/runtime-proof-parity-check.ts`
- `scripts/audit/domains/screenshot-capability/negative-proof-harness.ts`

为什么没拦住

- 旧 inspector 只覆盖了 adapter mapping、marker presence、generic chain parity，没有编码 `videoVisitId` 的 nullable schema/policy/refine 一致性。
- 旧 negative proof 没有把 `videoVisitId` 提升为 required，也没有把 result nullable parity 漂移成 blanket required。

修复策略

- 物理删除并重建 screenshot governance / refinements 根因文件。
- 将 chain fields 拆为 required 与 optional parity 两组：`videoVisitId` 与 `roundId` 保持 nullable；result 额外允许 `diagnosticPayloadRef` nullable。
- runtimeProof refine 只对 required chain fields 报错；result refine 只对 required chain fields 报错，但对完整 chain fields 保持 parity 校验。

防复发策略

- 新增 AST 级 `runtime-proof-parity-check.ts`，同时校验 governance 常量、schema policy 与 refine 使用点。
- 将该检查接入 screenshot `required-shape.ts`，把 nullable parity 变成 machine-blocking。
- negative proof 新增两条生产突变：
  - 把 `videoVisitId` 移入 `SCREENSHOT_PROOF_REQUIRED_CHAIN_FIELD_NAMES`
  - 把 result requiredness 从 `SCREENSHOT_RESULT_REQUIRED_CHAIN_FIELD_NAMES` 漂移到 `SCREENSHOT_RESULT_CHAIN_FIELD_NAMES`
- 施工图补写当前 blocker 的正确链路、禁止链路、inspector coverage、negative proof coverage、结构化日志字段和 READY 约束。

生产突变验证策略

- 对 screenshot production file 做真实错误注入。
- 运行 `npm run audit:screenshot` 观察 FAIL。
- 回滚同一文件并再次运行 `npm run audit:screenshot` 观察 PASS。
- 将 fail/pass 输出、补丁和回滚证明存入 `tmp/debug-loop/regression-proofs/BLOCKER-POSTFIX-1/`。

修复后真实重启验证点

- `npm run grasseye:start` 可正常启动，Commander readiness 不回退。
- 真实任务再次进入 `capture-video-viewport` 时，不再出现 `videoVisitId is required in runtimeProof`。
- 若 screenshot 继续失败，必须是新的、可定位的新 blocker，而不是 proof/result nullable parity 旧 blocker 复发。

修复后最新日志应不再出现的同类问题

- `videoVisitId is required in runtimeProof`
- `videoVisitId is required in result`
- 任何由 `videoVisitId=null` 触发的 screenshot owner blanket-required 阻断
blockerId: BLOCKER-PAV-INVALID-INPUT-RUNID

日志证据:
- tmp/debug-loop/root-cause-analysis/current-runtime-log-snapshot.json:245 出现 `Expected string, received null`，path 为 `runId`。
- tmp/debug-loop/root-cause-analysis/current-runtime-log-snapshot.json:2117 与 3053 重复出现同类 `runId=null` 拒绝。
- tmp/debug-loop/root-cause-analysis/current-runtime-snapshot.json:211 至 235 在 failedRecords 中持续保留同类 `runId=null` 细节，说明这是 authoritative blocker，而不是单次偶发文本。

法案要求:
- Post-action Verification 输入必须带完整 mission/run/step/map chain，并且没有合法 proof 不能 claim verification truth。
- Local runtime shell 可以做能力调度组装，但不能绕过 owner schema，也不能制造脱离 owner contract 的伪输入。
- Structured debug/runtime truth 必须能把失败原因精确归到真实 owner，而不是在 fallback 中再次崩溃并把根因伪装成更外层 transport 问题。

施工图要求:
- `verify-page-opened` 是 builtin map 的第二步，必须通过 governed PAV 输入与结果链拿到 page-opened truth，不能在第一条 PAV step 就因 schema drift 失效。
- PAV failure path 必须输出受控失败结果，不能因为 fallback proof/result 再次触发 schema 崩溃。
- observation-only 的 page-open verification 必须允许由 page-state 真值完成验证，不能要求系统里当前并不存在的伪 evidence 链。

生产根因文件:
- src/lib/local-runtime/workbench-post-action-dispatch-input.ts
- src/lib/local-runtime/workbench-ability-command-executor.ts
- src/capabilities/post-action-verification/runtime/verification-proof-builder.ts
- src/capabilities/post-action-verification/runtime/verification-result-builder.ts
- src/capabilities/post-action-verification/schema.ts
- src/capabilities/post-action-verification/runtime/post-action-output-boundary-gate.ts

执法缺口文件:
- tmp/debug-loop/root-cause-analysis/enforcement-gap-matrix.md
- scripts/audit/domains/post-action-verification-capability/run-inspector.ts
- scripts/audit/domains/post-action-verification-capability/run-governed-runtime-checks.ts
- scripts/audit/domains/post-action-verification-capability/negative-proof-harness.ts

为什么没拦住:
- local-runtime 的 PAV builder 长期脱离 `PostActionVerificationAbilityInputSchema` 演进，childCapabilityId、chain fields、actionProof、verificationPolicy、observation shape 都已过期，但缺少 owner-local schema-shape inspector。
- PAV invalid-input fallback 在 `rawInput` 缺 runId 时又把 `runtimeProof.runId` 和 `result.runId` 回填成 `null`，导致 owner 自己的 failure path 二次崩溃，把根因伪装成更外层 `runId/null`。
- observation-only 的 `verify-page-opened` child 与统一 output-boundary gate 脱节，导致即使 child 已能给出 `verified`，结果也会被错误降级为 `insufficient_evidence`。
- `expectedUrlHost` 使用 `tiktok.com` / `facebook.com`，而真实默认 feed URL 是 `www.*`，导致 page-open verification 在真实 host 上被误判为 wrong domain。

修复策略:
- 在 `workbench-post-action-dispatch-input.ts` 物理重建 PAV 输入 builder，按 canonical schema 补齐 mission/run/step/map chain、source fields、actionProof、page_state observation、verificationPolicy 与 confidencePolicy。
- 在 `workbench-ability-command-executor.ts` 改为把 runtime 传进 PAV builder，让 page-state observation 直接读取当前 browser session。
- 在 `verification-proof-builder.ts` 与 `verification-result-builder.ts` 改掉 invalid-input fallback，把 `runId` 回填到受控的 generated inputRef，而不是 `null`。
- 在 `schema.ts` 取消 governed result 对 `videoVisitId` 的错误强制非空要求，保持与当前 nullable chain contract 一致。
- 在 `post-action-output-boundary-gate.ts` 允许 observation-only 模式基于至少一条绑定 observation 和 source proof 通过边界门，不再要求伪造第二条 observation 或 evidence。
- 在 `workbench-post-action-dispatch-input.ts` 把 page-open expected host 对齐到真实 canonical host：`www.tiktok.com` / `www.facebook.com`。

防复发策略:
- 在 PAV domain 增加 owner-local audit：machine-check `buildPostActionVerificationInput(...)` 产物必须能通过 `PostActionVerificationAbilityInputSchema.parse`，至少覆盖 `verify-page-opened` / `verify-comments-panel-opened` / `verify-video-changed-after-scroll` 三类 child。
- 在 PAV domain 增加 mutation-proof：删除 builder 的 chain fields、把 observation 改回旧字段、把 failure fallback runId 改回 `null`、把 observation-only 边界门恢复成“必须 2 条 observation/evidence”时，inspector 必须 FAIL。
- 在 PAV domain 增加 host-policy check：builtin `facebook` / `tiktok` page-open verification 的 expected host 必须与默认 open URL host 对齐，防止 future drift 再把 `www` 判成 wrong domain。

生产突变验证策略:
- 突变 1：从 `workbench-post-action-dispatch-input.ts` 删除 `runId` / `missionId` / `capabilityCallId` 任一 chain 字段，预期 audit 失败。
- 突变 2：把 page_state observation 改回 `observedAt` / `confidence` 旧结构，预期 schema audit 失败。
- 突变 3：把 `verification-proof-builder.ts` 或 `verification-result-builder.ts` 的 invalid-input fallback `runId` 改回 `null`，预期 negative proof 失败。
- 突变 4：把 `post-action-output-boundary-gate.ts` 恢复成 observation-only 也必须 2 条 observation/evidence，预期 `verify-page-opened` 执行验证失败。
- 突变 5：把 page-open expected host 改回无 `www` 版本，预期 `verify-page-opened` 对 `https://www.tiktok.com/foryou` 验证失败。

修复后真实重启验证点:
- 真实 `grasseye:start` 重启后，start-mission 首个 PAV step `verify-page-opened` 不应再抛 raw ZodError，也不应再出现 `runId=null` reject。
- fresh log 中应能看到 `ORCHESTRATION_START_RECEIVED` 之后继续进入受控的 PAV dispatch/result 链，而不是在 invalid-input fallback 中中断。
- 若 page 已正常打开，`verify-page-opened` 应返回受控 `success/verified`；若平台状态不满足，也应返回受控 `review_required` 或 `failed`，但不能是 schema crash。

修复后最新日志应不再出现的同类问题:
- `Expected string, received null` 且 path 为 `runId` 的 PAV fallback 二次崩溃。
- `verify-page-opened` 因 `www` host 被误判为 wrong domain 的 `unexpected_state`。
- `verify-page-opened` 在 observation-only 模式下被统一 output-boundary gate 错误降级成 `insufficient_evidence`。
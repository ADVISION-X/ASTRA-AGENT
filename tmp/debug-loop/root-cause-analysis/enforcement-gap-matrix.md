# Enforcement Gap Matrix

| Blocker | Inspector | Negative proof | Current coverage | Missing coverage | Category |
|---|---|---|---|---|---|
| BLOCKER-1 | `scripts/audit/domains/orchestration-capability/start-mission-boundary-checks.ts`; `scripts/audit/domains/orchestration-capability/run-governed-runtime-checks.ts` | `scripts/audit/domains/orchestration-capability/negative-proof-harness.ts` | current worktree 已检查 `envelope.runId -> startMission`、`ORCHESTRATION_START_RECEIVED` / `MISSION_ACTIVATION_SNAPSHOT_FROZEN`、`MissionCommandSchema.safeParse`、删除 `RuntimeProofSchema.runId` / proof builder runId 发出必须 FAIL | 没有直接证明 activation snapshot / failed result / runtime proof 深层 nested object 的 `runId=null` 会 machine-fail；也没有 fresh real rerun 证明 live blocker 已封死 | `C + E + F` |
| BLOCKER-2 | `scripts/audit/domains/commander-console-capability/run-startup-readiness-gate-checks.ts` | `scripts/audit/domains/orchestration-capability/negative-proof-harness.ts` | current worktree 已检查 `taskTemplateId/activationId/activationSnapshotRef/targetProfileRef` preflight 合同字段，以及 `MissionCommandSchema.safeParse` | 只证明顶层 MissionCommand preflight，不证明 activation snapshot freeze 使用的更深层对象；也没有证明 preflight pass 后绝不会再出现 deeper `runId/null` reject | `C + E + F` |
| BLOCKER-3 | `scripts/audit/domains/commander-console-capability/run-commander-runtime-runid-checks.ts`; `scripts/audit/domains/commander-console-capability/run-startup-readiness-gate-checks.ts` | `scripts/audit/domains/commander-console-capability/negative-proof-harness.ts` | current worktree 已检查 debug refs passthrough、dispatch result refs、terminal relay 关键字段 | authoritative live artifacts 仍然是旧 snapshot + 最新 terminal 混存；没有一条 fresh persisted debug chain 能把 failing object 直接串到 command/result/proof refs | `H + C + E` |
| BLOCKER-4 | `scripts/audit/domains/orchestration-capability/run-inspector.ts`; `scripts/audit/domains/orchestration-capability/run-governed-runtime-checks.ts`; `scripts/audit/domains/commander-console-capability/run-commander-runtime-runid-checks.ts` | `scripts/audit/domains/orchestration-capability/negative-proof-harness.ts` | current worktree 已加入边界 runId drop、log removal、safeParse removal 等突变；Commander 侧也加入 runId/refs 守卫 | baseline 仍需先 PASS 才能形成完整 negative-proof 闭环；更深层 activation snapshot nested object mutation 仍未直测；没有 latest real rerun closeout | `C + E + F + G` |

## Enforcement notes

- 这不是 owner mapping 缺失问题。Commander 和 Orchestration 的 owner-local inspector、runner、manifest 在工作区里都存在。
- 这也不是法案缺失问题。法条和施工图已经明确要求 runId 链路、activation snapshot 链、proof refs 和 negative proof。
- 真正缺的是两层闭环：
  1. 更深层 nested failing object 的 machine mutation proof。
  2. 基于 current-worktree hardening 的 fresh real rerun authoritative evidence。

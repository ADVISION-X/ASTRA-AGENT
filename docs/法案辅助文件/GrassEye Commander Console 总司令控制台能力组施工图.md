# GrassEye Commander Console 总司令控制台能力组施工图

## 1. 定位

Commander Console 是人的驾驶舱。

它只负责人类命令入口、系统可视化、能力健康展示、运行证明查看、证据查看、人工复核与人工裁决。

它不是旧 Agent。
它不是 Workbench。
它不是 Operator Control。
它不是 Orchestration。
它不是 Nerve Bus。
它不是 Forensics。
它不是 AI。
它不是 runtime snapshot builder。
它不是 mechanical skill catalog。

## 2. 主职责

- issue-human-command
- show-capability-roster
- show-capability-health
- show-mission-dashboard
- show-operational-map-progress
- show-runtime-proof-timeline
- show-evidence-packets
- show-browse-ledger
- show-failed-records
- show-review-queue
- show-audit-summary
- pause-mission
- resume-mission
- stop-mission
- emergency-stop
- approve-candidate
- reject-candidate
- mark-review-required
- inspect-record-detail

## 3. 命令边界

- 人类命令先进入 Commander Console。
- Commander Console 把 HumanCommand 包装成 HumanCommandEnvelope。
- HumanCommandEnvelope 通过 CommandTransportPort 进入 Nerve Bus。
- Nerve Bus 再把命令送往 Orchestration 或受治理 review / persistence backend。
- mission start 如果没有 selectedMapId 或 requestedPlatformId，Commander Console 不得自动补 tiktok-web，只能要求人类明确选择，或让下游按治理结果拒绝该命令。
- Commander Console 不得直接持有 raw OrchestrationAbilityGroup。
- Commander Console 不得直接调用 orchestration.startMission / pauseMission / resumeMission / stopMission / emergencyStop。
- Commander Console 不得直接调用 setCandidateDisposition 或 resetLocalStore。

## 4. 读侧边界

Commander Console 的 read model 只能来自公共 read-model ports：

- OrchestrationMissionReadModel
- ForensicsReadModel
- CapabilityHealthReadModel
- AuditReadModel
- RuntimeProofReadModel

展示数据必须转成 Commander 自己的 view records。

Commander-facing 字段命名也必须转译成 Commander 词汇，不得保留 TaskRun / activeTaskRunId 这类旧命名作为 public truth。

不得把下面这些旧类型当成 Commander public truth：

- OperatorSnapshotRecord
- AgentSkillMatrixSnapshot
- ProductDiscoveryEvidencePacket 旧域对象
- BrowseRuntimeSnapshot
- RuntimeDeliveryState
- LocalAiTaskResult
- TaskRun
- ProductOpportunityCandidate mutable domain object

## 5. 禁止职责

- 不推进 map step
- 不拥有 mission truth
- 不拥有 browse ledger truth
- 不拥有 evidence packet truth
- 不拥有 failed record truth
- 不拥有 structured runtime log truth
- 不构造 ProductOpportunityCandidate
- 不维护 AgentMechanicalSkill catalog
- 不 import features/local-data
- 不 import types/agent-skill
- 不 import types/evidence-packet 作为 read-model truth
- 不 import types/local-ai
- 不 import RuntimeDeliveryState / BrowseRuntimeSnapshot
- 不直连 BrowserController
- 不直连 platform adapter
- 不直连 local AI runtime
- 不使用 defaultRequestedPlatformId、requestedPlatformId ?? "tiktok-web" 或任何 silent platform fallback

## 6. canonical root

- src/capabilities/commander-console
- scripts/audit/domains/commander-console-capability
- .github/instructions/cursor-rules/modules/module-commander-console-capability.instructions.md

目标结构：

- contract.ts
- ability-group.ts
- registry.ts
- command-builder.ts
- read-models.ts
- index.ts
- ports/command-transport-port.ts
- ports/mission-read-model-port.ts
- ports/forensics-read-model-port.ts
- ports/capability-health-read-model-port.ts
- ports/audit-read-model-port.ts
- ports/runtime-proof-read-model-port.ts
- shared/commander-result.ts
- shared/command-policy.ts
- shared/review-decision.ts
- shared/view-model-types.ts
- shared/health-summary.ts
- children/<child-id>/implementation.ts

## 7. 必删旧残留

- runtime-skill-catalog.ts
- runtime-skill-resolution.ts
- build-runtime-skill-matrix-snapshot.ts
- build-browse-runtime-snapshot.ts
- build-pending-analysis-candidate.ts
- children.ts 这种平面假子能力表
- resetLocalStore public surface

## 8. 验收信号

建对表现：

- task-api-handlers 只调 Commander Console public interface
- Candidate review API 只调 Commander Console public interface
- Commander Console 通过 HumanCommandEnvelope / CommandTransportPort 发命令
- Commander Console 只消费 read-model ports，不再拿旧 runtime truth 类型拼装
- 子能力变成真实 child folders
- commander-console-capability inspector 用 AST / symbol / import graph 做 decisive enforcement

漂移信号：

- task-api-handlers 继续直调 workbench 或 mission-runtime-executor
- Commander Console 重新 import 浏览器、平台动作、AI runtime、本地存储路径
- Commander Console 重新出现 skill catalog、browse runtime snapshot、candidate builder
- Commander Console 暴露 resetLocalStore 或 raw OrchestrationAbilityGroup
- 再次出现 compat、legacy、bridge 叙事
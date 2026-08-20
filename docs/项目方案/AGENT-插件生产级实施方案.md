---
artifact_type: project_implementation_plan
skill: design-project-implementation-plan
project_name: AGENT 插件生产级绿地实施方案
candidate_id: agent-plugin-greenfield-plan-v8@60cfcf512ecdae0ed27d001d40b6293ae53e5cc6:prototype-9f653564:law-488ef0b4:blueprint-6b90a9e9
claim: DESIGN_ONLY
necessity_verdict: NECESSITY_PROCEED
boundary_verdict: BOUNDARY_LOCKED
score_necessity: 30
score_boundary: 20
score_reuse_gap: 14
score_expected_benefit: 15
score_feasibility: 8
score_risk_control: 7
vote_score: 94
vote_verdict: VOTE_PASS_80
hard_veto_count: 0
plan_execution_readiness: WORKORDER_READY
execution_manifest_status: VALID
construction_start_state: DECISION_GATED
work_order_count: 58
decision_gate_count: 7
unmodeled_decision_gate_count: 0
work_order_graph_status: VALID
d_verdict: D_PASS
d_architecture_closed_loop_score: 100
d_boundary_score: 100
d_execution_readiness_score: 100
d_cold_start_executor_test: PASS
d_work_order_graph_check: PASS
d_major_finding_count: 0
d_unresolved_conflict_count: 0
implementation_status: NOT_IMPLEMENTED
test_status: NOT_TESTED_AS_PROJECT
commit_status: NOT_COMMITTED
deployment_status: NOT_DEPLOYED
release_status: NOT_RELEASED
---

# AGENT-插件生产级实施方案

## 1. 一句话结论

把 AGENT 的 Browser 责任片区视为从未正确建设过：当前源码只用于列清删除对象和消费者，未来施工先物理清场，再按 active law 从协议、Host、Extension、authority、exact target、消费者、审计、真实 Chrome、HA、发布逐 owner 重建；任何阶段都不保留旧 Browser 运行链。

## 2. 项目目标和当前问题

目标不是继续修第三次执行留下的实现，而是得到一条法定数据面：execution fence → BrowserAuthorityBroker → authority lease → exact target/document lease → CommandActor → authenticated Host channel → Rust Host → one Native Port → MV3 CommandRegistry → chrome.debugger。

当前问题有四类：现实现新旧语义混合；Local Runtime 在装配期领取或缓存 lease；Video Download 仍有 createTargetSession/evaluate；local-browser audit 当前只有 7 个绑定而 active law 要求 26 个独立检查。历史 PASS 只说明历史候选通过当时检查，不能证明目标完成。

## 3. 必要性分析

用户已经报告同一方案执行三次仍未彻底闭合。A/B/C 对冻结候选的核对同时确认：旧 Session/evaluate/raw path、装配期 lease、重复 owner 风险和 7/26 审计缺口客观存在。因此必要性结论是 `NECESSITY_PROCEED`。

## 4. 建设与不建设边界

建设边界：Browser 根物理删除后绿地重建；Local Runtime、DOM、AI、Video 和三个 plugin 只改 Browser 边界；现有 local-browser audit owner 扩到 26 项；另获授权的 xuanxue 三条精确路径只消费唯一 fence/receipt。

不建设：不改 active law；不手改 generated truth；不改变各 plugin 业务顺序；不造第二 server、Browser transport、controller、election、receipt、Dynamic Proof verdict 或 audit runner；不加 bridge、fallback、alias、wrapper、shadow implementation。

## 5. 100 分建设表决

总分：94/100，`VOTE_PASS_80`。

```scorecard-evidence
{
  "dimensions": [
    {
      "field": "score_necessity",
      "base_score": 30,
      "evidence_level": "E3_VERIFIED",
      "evidence_cap": 30,
      "final_score": 30,
      "deduction_reason": "用户报告三次执行未闭合，当前新旧 Browser 语义并存。",
      "evidence_locations": [
        "用户明确指令",
        "A/B/C verified facts"
      ]
    },
    {
      "field": "score_boundary",
      "base_score": 20,
      "evidence_level": "E3_VERIFIED",
      "evidence_cap": 20,
      "final_score": 20,
      "deduction_reason": "Browser 片区绿地重建；其他 owner 只改 Browser 边界。",
      "evidence_locations": [
        "AGENTS.md owner map",
        "active Browser law"
      ]
    },
    {
      "field": "score_reuse_gap",
      "base_score": 15,
      "evidence_level": "E3_VERIFIED",
      "evidence_cap": 15,
      "final_score": 14,
      "deduction_reason": "复用 active law、施工图和唯一审计链；当前实现仅作退休地图。",
      "evidence_locations": [
        "A/C current-source inventory",
        "7 versus 26 check gap"
      ]
    },
    {
      "field": "score_expected_benefit",
      "base_score": 15,
      "evidence_level": "E3_VERIFIED",
      "evidence_cap": 15,
      "final_score": 15,
      "deduction_reason": "物理清场消除旧 Session、重复 owner 与第二链风险。",
      "evidence_locations": [
        "active law forbidden topology",
        "consumer graph"
      ]
    },
    {
      "field": "score_feasibility",
      "base_score": 10,
      "evidence_level": "E3_VERIFIED",
      "evidence_cap": 10,
      "final_score": 8,
      "deduction_reason": "外部 CWS、签名、HA 和干净跨仓候选仍由独立 gate 控制。",
      "evidence_locations": [
        "DG-003",
        "DG-004"
      ]
    },
    {
      "field": "score_risk_control",
      "base_score": 10,
      "evidence_level": "E3_VERIFIED",
      "evidence_cap": 10,
      "final_score": 7,
      "deduction_reason": "绿地中间态不可发布，旧链不恢复；仍需真实生产证据。",
      "evidence_locations": [
        "CUT-001..CUT-004",
        "WO-034..WO-042"
      ]
    }
  ]
}
```

## 6. 权威、法案和施工图分析

权威顺序：用户明确要求 → AGENTS.md → Kernel → index → active local-browser law → generated audit truth / inspector / acceptance → 终态施工图。active law 和终态施工图已经给出目标，不存在需要自动补 active law 的 LAW-GAP。当前源码只属于 `RETIREMENT_MAP_ONLY`，不能反向授权目标架构。

Browser 唯一拥有 authority、transport、target 与 command。Local Runtime 只装配 Broker。capability 只拥有本能力动作。plugin 只拥有业务步骤与业务状态。xuanxue 只拥有数据库 election/fence 和唯一 Dynamic Proof verdict。

## 7. 质检和证据系统方案

四本账严格分开：plugin 业务状态、forensics evidence、runtime logs、audit compliance。静态、Exam、真实 Chrome、provider 业务终态、HA/soak、CI、两仓治理与发布批准各有独立 producer，不得互相冒充。

候选身份也分两层：本文件的 `agent-plugin-greenfield-plan-v8@60cfcf512ecdae0ed27d001d40b6293ae53e5cc6:prototype-9f653564:law-488ef0b4:blueprint-6b90a9e9` 只是方案证据候选；它绑定当前终态施工图 SHA。WO-058 与 WO-059 在未来施工完成后分别冻结 AGENT/xuanxue 的 clean tree、commit SHA 与 remote SHA，WO-060 才签发唯一 `constructed-release-candidate`。ArtifactSet、Chrome、provider、HA、soak、CI、branch protection、ProofManifest 和 activation 全部只认 WO-060，不认施工前 SHA。

证据链固定为：26 项审计与 deterministic evidence → 双仓施工后候选 → build-once ArtifactSet 实体 → artifact-bound tuple/policy → packaged Chrome/provider/HA/soak/CI → 两仓治理读回 → fresh independent audit → ProofManifest → activation/readback。任一 hash 漂移从最早受影响 producer 重做。

### 7.1 Health / Errors / Metrics 的施工与验收闭环

唯一生产 owner 是 `WO-047` 的 `BrowserInfrastructureSupervisor`：它只能发布
`browserInfrastructure` 与 `browserAuthority` 两个 health component。`WO-023` 只在
`workbench-status.ts` 原样展示该结果，不得自行计算健康、错误、指标或恢复
`browserSession`、`transportReady`、`session not authenticated`、`wait for authentication`
语义。`ACC-023` 检查此展示边界，`ACC-047` 检查唯一 producer 和零业务流程所有权。

`WO-012` 在 `protocol/browser-errors.json` 创建唯一 error taxonomy，`ACC-012` 必须拒绝
缺失或额外的 install、host、origin、extension、tuple、transcript、capability、profile、process、
policy、liveness、worker-fence、dual-active、backpressure、file-grant、rollback、revocation、permit、
target、document、devtools、outcome-unknown、repair 代码。`WO-032`/`ACC-032` 以确定性合同检查
两个合法 component、旧语义不存在、全部零指标声明与无界队列/缓存/流为零。

`ACC-036` 在 handover receipt 验证 `dual_active_browser_worker_total=0`、
`stale_event_side_effect_total=0`、`old_completion_to_new_port_total=0`、
`command_after_liveness_expiry_total=0`。`ACC-037` 在 24h/168h soak receipts 验证完整零集：
`unauthenticated_browser_authority_issued_total`、`command_without_valid_authority_total`、
`stale_event_side_effect_total`、`old_completion_to_new_port_total`、
`non_idempotent_auto_replay_total`、`wrong_profile_process_authority_issued_total`、
`command_after_liveness_expiry_total`、`browser_action_during_authority_absence_total`、
`dual_active_browser_worker_total`、`revoked_or_rollback_blocked_tuple_activated_total`、
`browser_admission_budget_violation_total` 均为零；同时要求 supported-runtime-window authority
availability ≥99.99%、authority issuance p99 ≤5s、recoverable chain rebuild p99 ≤10s、
revoke→ABSENT p99 ≤10ms 和 `unbounded_queue=unbounded_cache=unbounded_stream=0`。任何缺字段、
阈值越界或 identity 漂移均为 FAIL 并重置整个 soak 窗口。

## 8. 实现与建设拓扑方案

唯一数据面：current execution fence → BrowserAuthorityBroker → AuthenticatedBrowserAuthorityLease → exact BrowserTargetLease/BrowserDocumentRef → BrowserCommandActor → authenticated Controller/Host channel → signed Rust Host → one Native Messaging Port → MV3 CommandRegistry → chrome.debugger。当前源码只用于退休和消费者分母，不能作为目标模板。

| 终态责任 | 工作单 | 单一产物或边界 |
| --- | --- | --- |
| physical demolition | WO-005..WO-011 | 零未知分类、Browser jobs BLOCKED、旧路径物理不存在 |
| protocol/Host/MV3/transport | WO-012..WO-016 | generated TS/Rust、Rust Host、one Port、Actor/Reducer |
| browserctl/profile/supervisor | WO-046/WO-021/WO-047 | install/verify/repair、dedicated profile、OwnerLock/handover |
| issuer/Broker/target/command | WO-017..WO-020 | ABSENT/PRESENT authority 与 exact governed command |
| Local Runtime/capabilities/plugins/xuanxue contract | WO-023..WO-030 | 各 owner 的 Browser 边界 |
| health / errors / metrics | WO-012/WO-023/WO-032/WO-047/WO-036/WO-037 | 唯一 producer、两项健康名、精确错误分类、11 零指标、4 项 SLO 与有界性 receipts |
| 26 checks 与 deterministic tests | WO-031/WO-032 | law-SHA-bound 精确 26 ID 集合、唯一 audit runner 和 candidate-bound receipts |
| 合法 repository governance policies | WO-056/WO-057 | 两个仓库 owner 各自签发 exact contexts 与 commit/push/restore 权限 |
| 施工后双仓候选 | WO-058..WO-060 | clean tree、content manifest、source bundle、commit/push、remote readback、composite identity |
| release schemas/ABSENT slot | WO-022 | 只建 schema 与 SIGNED_ABSENT，不签候选身份 |
| build-once 实体 ArtifactSet | WO-033 | Controller、Host、browserctl、launcher、platform、Verified CRX、Native manifest、checksums/signature |
| artifact-bound tuple/policy | WO-050 | 同一 ArtifactSet/constructed candidate 的不可变签名身份 |
| Chrome/provider/HA/soak/CI/governance | WO-034..WO-048 | 同 constructed candidate/artifact/tuple/policy 的独立 receipts |
| 正常激活 | WO-038..WO-042 | proof → snapshot → CAS → readback → receipt-only approval |
| 失败恢复 | WO-051..WO-055 | revoke → SIGNED_PRESENT 回退或 SIGNED_ABSENT 隔离 → slot CAS → consumers BLOCKED → 独立 readback |

两个旧 Local Runtime support 永久 absent。首次绿地激活的 previous snapshot 可以是 `SIGNED_ABSENT`；升级场景可以是 `SIGNED_PRESENT(tuple)`，两条恢复分支最终都必须 authority ABSENT、CON-001..CON-011 BLOCKED。

## 9. 决策门与施工起始状态

施工状态为 `DECISION_GATED`。第一批根工作单：`WO-002`、`WO-003`、`WO-004`、`WO-006`、`WO-049`、`WO-056`、`WO-057`。新增 DG-006/DG-007 的原因是 required checks、commit/push 与恢复权限只能由两个合法 repository governance owner 分别签发，release operations owner 无权代签。

- DG-001：Which clean AGENT SHA/tree and Browser-only construction scope are authorized?；owner=user plus AGENT construction authority owner；resolution=WO-002；blocks=WO-005, WO-007, WO-008, WO-009, WO-010, WO-011, WO-012, WO-013, WO-014, WO-015, WO-016, WO-017, WO-018, WO-019, WO-020, WO-021, WO-022, WO-023, WO-024, WO-025, WO-026, WO-027, WO-028, WO-029, WO-030, WO-031, WO-032, WO-033, WO-034, WO-035, WO-036, WO-037, WO-038, WO-039, WO-040, WO-041, WO-042, WO-043, WO-044, WO-046, WO-047, WO-050, WO-051, WO-052, WO-053, WO-054, WO-055, WO-056, WO-057, WO-058, WO-059, WO-060；receipt=`deliverable://construction-admission/agent-candidate.json`；状态=MODELED_AS_FIRST_WORK_ORDER
- DG-002：Which single BrowserProcessSupervisor target path is authorized by active law and terminal blueprint?；owner=user plus AGENT construction authority owner；resolution=WO-006；blocks=WO-005, WO-008, WO-009, WO-010, WO-011, WO-012, WO-013, WO-014, WO-015, WO-016, WO-017, WO-018, WO-019, WO-020, WO-021, WO-022, WO-023, WO-024, WO-025, WO-026, WO-027, WO-028, WO-029, WO-030, WO-031, WO-032, WO-033, WO-034, WO-035, WO-036, WO-037, WO-038, WO-039, WO-040, WO-041, WO-042, WO-043, WO-044, WO-046, WO-047, WO-050, WO-051, WO-052, WO-053, WO-054, WO-055, WO-058, WO-059, WO-060；receipt=`deliverable://construction-admission/browser-canonical-path.json`；状态=MODELED_AS_FIRST_WORK_ORDER
- DG-003：Which clean xuanxue SHA/tree and exact three proof paths are authorized?；owner=xuanxue repository authority owner；resolution=WO-004；blocks=WO-030, WO-031, WO-032, WO-033, WO-034, WO-035, WO-036, WO-037, WO-038, WO-039, WO-040, WO-041, WO-042, WO-043, WO-044, WO-048, WO-051, WO-052, WO-053, WO-054, WO-055, WO-058, WO-059, WO-060；receipt=`deliverable://construction-admission/xuanxue-candidate.json`；状态=MODELED_AS_FIRST_WORK_ORDER
- DG-004：Are CWS, signing, notarization, managed profile and two independent HA workers available with owner readback?；owner=release operations owner；resolution=WO-003；blocks=WO-033, WO-034, WO-035, WO-036, WO-037, WO-038, WO-039, WO-040, WO-041, WO-042, WO-043, WO-044, WO-050, WO-051, WO-052, WO-053, WO-054, WO-055, WO-058, WO-059, WO-060；receipt=`deliverable://construction-admission/external-operations.json`；状态=MODELED_AS_FIRST_WORK_ORDER
- DG-005：Which provider accounts, journey IDs, sensitive-action boundary, human gates and eight-hour evidence window are operator-authorized?；owner=provider journey authorization owner；resolution=WO-049；blocks=WO-038, WO-039, WO-040, WO-041, WO-042, WO-043, WO-044, WO-051, WO-052, WO-053, WO-054, WO-055；receipt=`deliverable://construction-admission/provider-journey-authorization.json`；状态=MODELED_AS_FIRST_WORK_ORDER
- DG-006：Has the AGENT repository governance owner signed exact required contexts and construction branch commit/push plus readback authority?；owner=AGENT repository governance owner；resolution=WO-056；blocks=WO-033, WO-034, WO-035, WO-036, WO-037, WO-038, WO-039, WO-040, WO-041, WO-042, WO-043, WO-044, WO-050, WO-051, WO-052, WO-053, WO-054, WO-055, WO-058, WO-060；receipt=`deliverable://construction-admission/agent-repository-governance-policy.json`；状态=MODELED_AS_FIRST_WORK_ORDER
- DG-007：Has the xuanxue repository governance owner signed exact required contexts and construction branch commit/push plus readback authority?；owner=xuanxue repository governance owner；resolution=WO-057；blocks=WO-033, WO-034, WO-036, WO-037, WO-038, WO-039, WO-040, WO-041, WO-042, WO-043, WO-044, WO-048, WO-050, WO-051, WO-052, WO-053, WO-054, WO-055, WO-059, WO-060；receipt=`deliverable://construction-admission/xuanxue-repository-governance-policy.json`；状态=MODELED_AS_FIRST_WORK_ORDER

## 10. 唯一 ExecutionManifest

以下 JSON 是唯一机器可读施工事实。正文只解释它，不得建立第二份工作单真相。

```execution-manifest
{
  "schema_version": "2.0",
  "candidate_id": "agent-plugin-greenfield-plan-v8@60cfcf512ecdae0ed27d001d40b6293ae53e5cc6:prototype-9f653564:law-488ef0b4:blueprint-6b90a9e9",
  "candidate_scope": [
    "plan-evidence AGENT HEAD 60cfcf512ecdae0ed27d001d40b6293ae53e5cc6",
    "prototype sha256 9f6535645f258d9fa9eecc08653790c0a9aae2e0c8b189913c7a041acb8cd231",
    "local-browser law sha256 488ef0b4734b1158e5012569cc6ce958cd3d4200a8f9b3f77ca5e154b64f925f",
    "blueprint sha256 6b90a9e9ad03cebbfb922fb003e4e0e4f67c94e03fd95d26a1044fafcd5a894f",
    "current Browser source is retirement and consumer evidence only",
    "constructed release candidate is a separate future identity produced only by WO-060"
  ],
  "excluded_volatile_scope": [
    "xuanxue-web dirty worktree before DG-003 yields a clean frozen candidate",
    "external CWS signing notarization managed-profile and HA state before DG-004 receipts",
    "unrelated AGENT business behavior and concurrent user changes"
  ],
  "plan_execution_readiness": "WORKORDER_READY",
  "construction_start_state": "DECISION_GATED",
  "first_executable_work_orders": [
    "WO-002",
    "WO-003",
    "WO-004",
    "WO-006",
    "WO-049",
    "WO-056",
    "WO-057"
  ],
  "decision_gates": [
    {
      "decision_gate_id": "DG-001",
      "question": "Which clean AGENT SHA/tree and Browser-only construction scope are authorized?",
      "decision_owner": "user plus AGENT construction authority owner",
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "required_inputs": [
        "AGENT clean SHA/tree",
        "Browser-only scope statement"
      ],
      "allowed_options_or_decision_rule": "Accept exactly one clean candidate and Browser-only responsibility slice; otherwise stop.",
      "output_artifact": "deliverable://construction-admission/agent-candidate.json",
      "blocks_work_orders": [
        "WO-005",
        "WO-007",
        "WO-008",
        "WO-009",
        "WO-010",
        "WO-011",
        "WO-012",
        "WO-013",
        "WO-014",
        "WO-015",
        "WO-016",
        "WO-017",
        "WO-018",
        "WO-019",
        "WO-020",
        "WO-021",
        "WO-022",
        "WO-023",
        "WO-024",
        "WO-025",
        "WO-026",
        "WO-027",
        "WO-028",
        "WO-029",
        "WO-030",
        "WO-031",
        "WO-032",
        "WO-033",
        "WO-034",
        "WO-035",
        "WO-036",
        "WO-037",
        "WO-038",
        "WO-039",
        "WO-040",
        "WO-041",
        "WO-042",
        "WO-043",
        "WO-044",
        "WO-046",
        "WO-047",
        "WO-050",
        "WO-051",
        "WO-052",
        "WO-053",
        "WO-054",
        "WO-055",
        "WO-056",
        "WO-057",
        "WO-058",
        "WO-059",
        "WO-060"
      ],
      "resolution_work_order_id": "WO-002",
      "acceptance_ids": [
        "ACC-002"
      ],
      "status": "MODELED_AS_FIRST_WORK_ORDER"
    },
    {
      "decision_gate_id": "DG-002",
      "question": "Which single BrowserProcessSupervisor target path is authorized by active law and terminal blueprint?",
      "decision_owner": "user plus AGENT construction authority owner",
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "required_inputs": [
        ".github/instructions/agent-rules/modules/module-local-browser-session.instructions.md",
        "docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md"
      ],
      "allowed_options_or_decision_rule": "Accept exactly src/lib/browser/profile/browser-process-supervisor.ts; any second path stops Browser construction.",
      "output_artifact": "deliverable://construction-admission/browser-canonical-path.json",
      "blocks_work_orders": [
        "WO-005",
        "WO-008",
        "WO-009",
        "WO-010",
        "WO-011",
        "WO-012",
        "WO-013",
        "WO-014",
        "WO-015",
        "WO-016",
        "WO-017",
        "WO-018",
        "WO-019",
        "WO-020",
        "WO-021",
        "WO-022",
        "WO-023",
        "WO-024",
        "WO-025",
        "WO-026",
        "WO-027",
        "WO-028",
        "WO-029",
        "WO-030",
        "WO-031",
        "WO-032",
        "WO-033",
        "WO-034",
        "WO-035",
        "WO-036",
        "WO-037",
        "WO-038",
        "WO-039",
        "WO-040",
        "WO-041",
        "WO-042",
        "WO-043",
        "WO-044",
        "WO-046",
        "WO-047",
        "WO-050",
        "WO-051",
        "WO-052",
        "WO-053",
        "WO-054",
        "WO-055",
        "WO-058",
        "WO-059",
        "WO-060"
      ],
      "resolution_work_order_id": "WO-006",
      "acceptance_ids": [
        "ACC-006"
      ],
      "status": "MODELED_AS_FIRST_WORK_ORDER"
    },
    {
      "decision_gate_id": "DG-003",
      "question": "Which clean xuanxue SHA/tree and exact three proof paths are authorized?",
      "decision_owner": "xuanxue repository authority owner",
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "required_inputs": [
        "clean xuanxue SHA/tree",
        "three exact proof paths"
      ],
      "allowed_options_or_decision_rule": "Accept one clean candidate and the three explicit paths listed by WO-004; otherwise only WO-030 and downstream release stay blocked.",
      "output_artifact": "deliverable://construction-admission/xuanxue-candidate.json",
      "blocks_work_orders": [
        "WO-030",
        "WO-031",
        "WO-032",
        "WO-033",
        "WO-034",
        "WO-035",
        "WO-036",
        "WO-037",
        "WO-038",
        "WO-039",
        "WO-040",
        "WO-041",
        "WO-042",
        "WO-043",
        "WO-044",
        "WO-048",
        "WO-051",
        "WO-052",
        "WO-053",
        "WO-054",
        "WO-055",
        "WO-058",
        "WO-059",
        "WO-060"
      ],
      "resolution_work_order_id": "WO-004",
      "acceptance_ids": [
        "ACC-004"
      ],
      "status": "MODELED_AS_FIRST_WORK_ORDER"
    },
    {
      "decision_gate_id": "DG-004",
      "question": "Are CWS, signing, notarization, managed profile and two independent HA workers available with owner readback?",
      "decision_owner": "release operations owner",
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "required_inputs": [
        "CWS permanent item and publisher receipt",
        "Host signing and notarization identity",
        "managed profile policy receipt",
        "two independent worker inventory"
      ],
      "allowed_options_or_decision_rule": "Each input is PASS or BLOCKED independently; missing input blocks only artifact, governance, HA and downstream release work.",
      "output_artifact": "deliverable://construction-admission/external-operations.json",
      "blocks_work_orders": [
        "WO-033",
        "WO-034",
        "WO-035",
        "WO-036",
        "WO-037",
        "WO-038",
        "WO-039",
        "WO-040",
        "WO-041",
        "WO-042",
        "WO-043",
        "WO-044",
        "WO-050",
        "WO-051",
        "WO-052",
        "WO-053",
        "WO-054",
        "WO-055",
        "WO-058",
        "WO-059",
        "WO-060"
      ],
      "resolution_work_order_id": "WO-003",
      "acceptance_ids": [
        "ACC-003"
      ],
      "status": "MODELED_AS_FIRST_WORK_ORDER"
    },
    {
      "decision_gate_id": "DG-005",
      "question": "Which provider accounts, journey IDs, sensitive-action boundary, human gates and eight-hour evidence window are operator-authorized?",
      "decision_owner": "provider journey authorization owner",
      "authority_basis": [
        "用户继续授权",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "required_inputs": [
        "operator-approved provider account refs",
        "exact journey allowlist",
        "sensitive final-action denylist",
        "human-gate policy",
        "eight-hour window",
        "pause/cancel/takeover owner",
        "evidence redaction policy"
      ],
      "allowed_options_or_decision_rule": "Accept only a signed complete authorization; missing fields block WO-043 and downstream release work without blocking Browser construction.",
      "output_artifact": "deliverable://construction-admission/provider-journey-authorization.json",
      "blocks_work_orders": [
        "WO-038",
        "WO-039",
        "WO-040",
        "WO-041",
        "WO-042",
        "WO-043",
        "WO-044",
        "WO-051",
        "WO-052",
        "WO-053",
        "WO-054",
        "WO-055"
      ],
      "resolution_work_order_id": "WO-049",
      "acceptance_ids": [
        "ACC-049"
      ],
      "status": "MODELED_AS_FIRST_WORK_ORDER"
    },
    {
      "decision_gate_id": "DG-006",
      "question": "Has the AGENT repository governance owner signed exact required contexts and construction branch commit/push plus readback authority?",
      "decision_owner": "AGENT repository governance owner",
      "authority_basis": [
        "用户两轮 D 修订授权",
        "AGENTS.md",
        "repository governance owner boundary"
      ],
      "required_inputs": [
        "deliverable://construction-admission/agent-repository-governance-request.json"
      ],
      "allowed_options_or_decision_rule": "Accept only an owner-signed policy naming ADVISION-X/AGENT, main, exact contexts, strict flag, construction branch, expected remote ref, commit/push authority and restore authority; otherwise stop.",
      "output_artifact": "deliverable://construction-admission/agent-repository-governance-policy.json",
      "blocks_work_orders": [
        "WO-033",
        "WO-034",
        "WO-035",
        "WO-036",
        "WO-037",
        "WO-038",
        "WO-039",
        "WO-040",
        "WO-041",
        "WO-042",
        "WO-043",
        "WO-044",
        "WO-050",
        "WO-051",
        "WO-052",
        "WO-053",
        "WO-054",
        "WO-055",
        "WO-058",
        "WO-060"
      ],
      "resolution_work_order_id": "WO-056",
      "acceptance_ids": [
        "ACC-056"
      ],
      "status": "MODELED_AS_FIRST_WORK_ORDER"
    },
    {
      "decision_gate_id": "DG-007",
      "question": "Has the xuanxue repository governance owner signed exact required contexts and construction branch commit/push plus readback authority?",
      "decision_owner": "xuanxue repository governance owner",
      "authority_basis": [
        "用户两轮 D 修订授权",
        "AGENTS.md",
        "cross-repo owner boundary"
      ],
      "required_inputs": [
        "deliverable://construction-admission/xuanxue-repository-governance-request.json"
      ],
      "allowed_options_or_decision_rule": "Accept only an owner-signed policy naming ADVISION-X/xuanxue-web, main, exact contexts, strict flag, construction branch, expected remote ref, commit/push authority and restore authority; otherwise stop.",
      "output_artifact": "deliverable://construction-admission/xuanxue-repository-governance-policy.json",
      "blocks_work_orders": [
        "WO-033",
        "WO-034",
        "WO-036",
        "WO-037",
        "WO-038",
        "WO-039",
        "WO-040",
        "WO-041",
        "WO-042",
        "WO-043",
        "WO-044",
        "WO-048",
        "WO-050",
        "WO-051",
        "WO-052",
        "WO-053",
        "WO-054",
        "WO-055",
        "WO-059",
        "WO-060"
      ],
      "resolution_work_order_id": "WO-057",
      "acceptance_ids": [
        "ACC-057"
      ],
      "status": "MODELED_AS_FIRST_WORK_ORDER"
    }
  ],
  "work_orders": [
    {
      "work_order_id": "WO-002",
      "title": "冻结 AGENT 施工候选",
      "objective": "只关闭 AGENT SHA/tree 与本轮 Browser 片区授权。",
      "owner": "project authorization owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [
        "DG-001"
      ],
      "depends_on": [],
      "parallel_group": "DECISION",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "AGENTS.md",
        ".github/instructions/agent-rules/modules/module-local-browser-session.instructions.md",
        "docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md",
        "deliverable://construction-admission/user-browser-scope-authorization.json"
      ],
      "create_scope": [
        "deliverable://construction-admission/agent-candidate.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "AGENTS.md",
        ".github/instructions/agent-rules/modules/module-local-browser-session.instructions.md",
        "docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md",
        "deliverable://construction-admission/user-browser-scope-authorization.json"
      ],
      "actions": [
        "ACT-002"
      ],
      "outputs": [
        "deliverable://construction-admission/agent-candidate.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-002"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-005",
        "WO-007"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-003",
      "title": "冻结外部运营输入",
      "objective": "只冻结 CWS、签名/公证、managed profile、两台独立 HA worker 与 release key custody；不决定任何仓库 required-check policy。",
      "owner": "release operations owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [
        "DG-004"
      ],
      "depends_on": [],
      "parallel_group": "DECISION",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md"
      ],
      "create_scope": [
        "deliverable://construction-admission/external-operations.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md"
      ],
      "actions": [
        "ACT-003"
      ],
      "outputs": [
        "deliverable://construction-admission/external-operations.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-003"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-033",
        "WO-036"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-004",
      "title": "冻结 xuanxue 跨仓候选",
      "objective": "独立取得干净 xuanxue SHA/tree 与三条精确目标路径；缺失只阻断跨仓和其后发布。",
      "owner": "xuanxue repository authority owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [
        "DG-003"
      ],
      "depends_on": [],
      "parallel_group": "DECISION",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "/Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/browser-authority-proof-contract.ts",
        "/Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/collector-contracts.ts",
        "/Users/nexgen/Documents/xuanxue-web/scripts/audit/domains/dynamic-proof/dynamic-agent-receipt-inspection.ts"
      ],
      "create_scope": [
        "deliverable://construction-admission/xuanxue-candidate.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "/Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/browser-authority-proof-contract.ts",
        "/Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/collector-contracts.ts",
        "/Users/nexgen/Documents/xuanxue-web/scripts/audit/domains/dynamic-proof/dynamic-agent-receipt-inspection.ts"
      ],
      "actions": [
        "ACT-004"
      ],
      "outputs": [
        "deliverable://construction-admission/xuanxue-candidate.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-004"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-030",
        "WO-048"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-005",
      "title": "生成逐文件清场分类",
      "objective": "用 AST/symbol 消费图把当前 Browser 文件逐一标为删除，并把每个消费者绑定到 CON-001..CON-011。",
      "owner": "Browser retirement inventory owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-002",
        "WO-006"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "git-tree://60cfcf512ecdae0ed27d001d40b6293ae53e5cc6/src/lib/browser",
        "src/lib/local-runtime/workbench-browser-support.ts",
        "src/lib/local-runtime/workbench-video-download-support.ts",
        "src/lib/local-runtime/workbench-ai-gateway-support.ts",
        "src/lib/local-runtime/workbench-assembly.ts"
      ],
      "create_scope": [
        "scripts/acceptance/local-browser-plan-harness.self-test.ts",
        "scripts/acceptance/local-browser-plan-gates.acceptance.ts",
        "scripts/acceptance/local-browser-retirement-inventory.acceptance.ts",
        "scripts/acceptance/local-browser-consumer-registry.acceptance.ts",
        "scripts/acceptance/local-browser-work-order-receipt.acceptance.ts",
        "deliverable://browser-retirement/file-classification.json",
        "deliverable://browser-retirement/consumer-registry.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "git-tree://60cfcf512ecdae0ed27d001d40b6293ae53e5cc6/src/lib/browser",
        "src/lib/local-runtime/workbench-browser-support.ts",
        "src/lib/local-runtime/workbench-video-download-support.ts",
        "src/lib/local-runtime/workbench-ai-gateway-support.ts",
        "src/lib/local-runtime/workbench-assembly.ts"
      ],
      "actions": [
        "ACT-005"
      ],
      "outputs": [
        "scripts/acceptance/local-browser-plan-harness.self-test.ts",
        "scripts/acceptance/local-browser-plan-gates.acceptance.ts",
        "scripts/acceptance/local-browser-retirement-inventory.acceptance.ts",
        "scripts/acceptance/local-browser-consumer-registry.acceptance.ts",
        "scripts/acceptance/local-browser-work-order-receipt.acceptance.ts",
        "deliverable://browser-retirement/file-classification.json",
        "deliverable://browser-retirement/consumer-registry.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-005"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-007",
        "WO-008"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-006",
      "title": "裁决唯一 BrowserProcessSupervisor 目标路径",
      "objective": "只依据 active law 与终态施工图选择 src/lib/browser/profile/browser-process-supervisor.ts；逐文件分类和删除批准由 WO-005/WO-008 完成。",
      "owner": "project authorization owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [
        "DG-002"
      ],
      "depends_on": [],
      "parallel_group": "DECISION",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        ".github/instructions/agent-rules/modules/module-local-browser-session.instructions.md",
        "docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md"
      ],
      "create_scope": [
        "deliverable://construction-admission/browser-canonical-path.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        ".github/instructions/agent-rules/modules/module-local-browser-session.instructions.md",
        "docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md"
      ],
      "actions": [
        "ACT-006"
      ],
      "outputs": [
        "deliverable://construction-admission/browser-canonical-path.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-006"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-005",
        "WO-008"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-007",
      "title": "取得施工前真实 Chrome 现场证据",
      "objective": "记录获准真实路径的 URL、profile/process/policy、DOM 与动作前后终态；未知状态保持 UNKNOWN。",
      "owner": "real Chrome evidence owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-002",
        "WO-005"
      ],
      "parallel_group": "OBSERVATION",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "scripts/acceptance/xuanxue-ai-production.real-chrome.ts"
      ],
      "create_scope": [
        "deliverable://browser-observation/preconstruction-chrome.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "scripts/acceptance/xuanxue-ai-production.real-chrome.ts"
      ],
      "actions": [
        "ACT-007"
      ],
      "outputs": [
        "deliverable://browser-observation/preconstruction-chrome.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-007"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-008",
        "WO-024"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-008",
      "title": "冻结逐消费者迁移与切换账",
      "objective": "把每个 CON ID 映射到精确路径、owner、迁移工作单、验收和无旧链恢复。",
      "owner": "Browser retirement inventory owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-005",
        "WO-006",
        "WO-007"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://browser-retirement/file-classification.json",
        "deliverable://browser-retirement/consumer-registry.json",
        "deliverable://construction-admission/browser-canonical-path.json",
        "deliverable://browser-observation/preconstruction-chrome.json"
      ],
      "create_scope": [
        "deliverable://construction-admission/browser-demolition.json",
        "deliverable://browser-retirement/cutover-ledger.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://browser-retirement/file-classification.json",
        "deliverable://browser-retirement/consumer-registry.json",
        "deliverable://construction-admission/browser-canonical-path.json",
        "deliverable://browser-observation/preconstruction-chrome.json"
      ],
      "actions": [
        "ACT-008"
      ],
      "outputs": [
        "deliverable://construction-admission/browser-demolition.json",
        "deliverable://browser-retirement/cutover-ledger.json"
      ],
      "consumer_migration": [
        "src/lib/local-runtime/workbench-browser-support.ts | owner=local-runtime | migration=WO-023 | acceptance=ACC-023",
        "src/lib/local-runtime/workbench-video-download-support.ts | owner=local-runtime | migration=WO-023/WO-026 | acceptance=ACC-023/ACC-026",
        "src/lib/local-runtime/workbench-ai-gateway-support.ts | owner=local-runtime | migration=WO-023/WO-025 | acceptance=ACC-023/ACC-025",
        "src/lib/local-runtime/workbench-assembly.ts | owner=local-runtime | migration=WO-023 | acceptance=ACC-023",
        "src/capabilities/dom-automation/runtime/dom-target-binding.ts | owner=dom-automation | migration=WO-024 | acceptance=ACC-024",
        "src/capabilities/ai-input-gateway/ability-group.ts | owner=ai-input-gateway | migration=WO-025 | acceptance=ACC-025",
        "src/capabilities/video-download/children/download-web-video-once.ts | owner=video-download | migration=WO-026 | acceptance=ACC-026",
        "src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts | owner=amazon-invoice-upload | migration=WO-027 | acceptance=ACC-027",
        "src/plugins/amazon-product-mining/amazon-product-mining.flow-support.ts | owner=amazon-product-mining | migration=WO-028 | acceptance=ACC-028",
        "src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-proof.ts | owner=xuanxue-ai-production | migration=WO-029 | acceptance=ACC-029",
        "scripts/acceptance/local-browser-real-chrome-scenarios.acceptance.ts | owner=acceptance | migration=WO-034 | acceptance=ACC-034"
      ],
      "acceptance_ids": [
        "ACC-008"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-009",
        "WO-010",
        "WO-011"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-009",
      "title": "物理删除现有 Browser 实现片区",
      "objective": "删除获准 Browser 根内全部现实现，构造期 authority 明确 ABSENT。",
      "owner": "Browser owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-008"
      ],
      "parallel_group": "DEMOLITION",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://construction-admission/browser-demolition.json",
        "deliverable://browser-retirement/cutover-ledger.json"
      ],
      "create_scope": [
        "deliverable://work-orders/WO-009/receipt.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [
        "deliverable://browser-retirement/file-classification.json#delete_targets"
      ],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://construction-admission/browser-demolition.json",
        "deliverable://browser-retirement/cutover-ledger.json"
      ],
      "actions": [
        "ACT-009"
      ],
      "outputs": [
        "deliverable://work-orders/WO-009/receipt.json"
      ],
      "consumer_migration": [
        "CON-001 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.",
        "CON-002 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.",
        "CON-003 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.",
        "CON-004 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.",
        "CON-005 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.",
        "CON-006 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.",
        "CON-007 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.",
        "CON-008 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.",
        "CON-009 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.",
        "CON-010 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.",
        "CON-011 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes."
      ],
      "acceptance_ids": [
        "ACC-009"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-012"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-010",
      "title": "物理删除旧 Local Runtime Browser support",
      "objective": "删除两个旧 support surface，不保留别名、wrapper 或 authority 平行文件。",
      "owner": "local-runtime owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-008"
      ],
      "parallel_group": "DEMOLITION",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://browser-retirement/cutover-ledger.json"
      ],
      "create_scope": [
        "deliverable://work-orders/WO-010/receipt.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [
        "src/lib/local-runtime/workbench-browser-support.ts",
        "src/lib/local-runtime/workbench-video-download-support.ts"
      ],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://browser-retirement/cutover-ledger.json"
      ],
      "actions": [
        "ACT-010"
      ],
      "outputs": [
        "deliverable://work-orders/WO-010/receipt.json"
      ],
      "consumer_migration": [
        "CON-001 remains BLOCKED until WO-023 creates workbench-browser-authority-support.ts; src/lib/local-runtime/workbench-browser-support.ts is permanently absent.",
        "CON-002 remains BLOCKED until WO-023 Broker injection and WO-026 capability migration; src/lib/local-runtime/workbench-video-download-support.ts is permanently absent."
      ],
      "acceptance_ids": [
        "ACC-010"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-012"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-011",
      "title": "物理删除旧 Local Browser 验收面",
      "objective": "删除当前 legacy local-browser acceptance，未来验收只按终态合同重建。",
      "owner": "acceptance owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-008"
      ],
      "parallel_group": "DEMOLITION",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://browser-retirement/cutover-ledger.json"
      ],
      "create_scope": [
        "deliverable://work-orders/WO-011/receipt.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [
        "scripts/acceptance/local-browser-artifact-contract.acceptance.ts",
        "scripts/acceptance/local-browser-atomic-cutover.acceptance.ts",
        "scripts/acceptance/local-browser-business-workday.acceptance.ts",
        "scripts/acceptance/local-browser-exact-target-contract.acceptance.ts",
        "scripts/acceptance/local-browser-native-transport.acceptance.ts",
        "scripts/acceptance/local-browser-real-chrome-scenarios.acceptance.ts",
        "scripts/acceptance/local-browser-real-chrome.acceptance.ts",
        "scripts/acceptance/local-browser-target-actions.acceptance.ts"
      ],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://browser-retirement/cutover-ledger.json"
      ],
      "actions": [
        "ACT-011"
      ],
      "outputs": [
        "deliverable://work-orders/WO-011/receipt.json"
      ],
      "consumer_migration": [
        "CON-011 migrates only to WO-034/ACC-034; every retired legacy acceptance remains non-authoritative."
      ],
      "acceptance_ids": [
        "ACC-011"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-012"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-012",
      "title": "建立 canonical protocol schema",
      "objective": "建立消息、framing、budget、artifact grant、registry hash 与唯一完整 Browser error taxonomy 的单一源。",
      "owner": "Browser protocol owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-009",
        "WO-010",
        "WO-011"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://work-orders/WO-009/receipt.json",
        "deliverable://work-orders/WO-010/receipt.json",
        "deliverable://work-orders/WO-011/receipt.json"
      ],
      "create_scope": [
        "src/lib/browser/protocol/browser-protocol.schema.json",
        "src/lib/browser/protocol/browser-authority-certificate.schema.json",
        "src/lib/browser/protocol/browser-authority-liveness-lease.schema.json",
        "src/lib/browser/protocol/browser-profile-enrollment.schema.json",
        "src/lib/browser/protocol/browser-file-artifact-grant.schema.json",
        "src/lib/browser/protocol/browser-capabilities.json",
        "src/lib/browser/protocol/browser-errors.json",
        "src/lib/browser/protocol/browser-protocol-schema.acceptance.ts"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://work-orders/WO-009/receipt.json",
        "deliverable://work-orders/WO-010/receipt.json",
        "deliverable://work-orders/WO-011/receipt.json"
      ],
      "actions": [
        "ACT-012"
      ],
      "outputs": [
        "src/lib/browser/protocol/browser-protocol.schema.json",
        "src/lib/browser/protocol/browser-authority-certificate.schema.json",
        "src/lib/browser/protocol/browser-authority-liveness-lease.schema.json",
        "src/lib/browser/protocol/browser-profile-enrollment.schema.json",
        "src/lib/browser/protocol/browser-file-artifact-grant.schema.json",
        "src/lib/browser/protocol/browser-capabilities.json",
        "src/lib/browser/protocol/browser-errors.json",
        "src/lib/browser/protocol/browser-protocol-schema.acceptance.ts"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-012"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-013"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-013",
      "title": "建立确定性协议 codegen",
      "objective": "从唯一 schema 生成 TypeScript 与 Rust 合同并证明两端 hash 相同。",
      "owner": "Browser protocol codegen owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-012"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/browser/protocol/browser-protocol.schema.json",
        "src/lib/browser/protocol/browser-protocol-schema.acceptance.ts"
      ],
      "create_scope": [
        "src/lib/browser/protocol/generated/browser-protocol.generated.ts",
        "src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs",
        "src/lib/browser/protocol/browser-protocol-codegen.acceptance.ts"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/browser/protocol/browser-protocol.schema.json",
        "src/lib/browser/protocol/browser-protocol-schema.acceptance.ts"
      ],
      "actions": [
        "ACT-013"
      ],
      "outputs": [
        "src/lib/browser/protocol/generated/browser-protocol.generated.ts",
        "src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs",
        "src/lib/browser/protocol/browser-protocol-codegen.acceptance.ts"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-013"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-014",
        "WO-015",
        "WO-022",
        "WO-046"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-014",
      "title": "建设 Rust Native Host",
      "objective": "只建设 framing、认证握手、单 Port 与有界 I/O 的 Host。",
      "owner": "Native Host owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-013"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/browser/protocol/generated/browser-protocol.generated.ts",
        "src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs"
      ],
      "create_scope": [
        "src/lib/browser/native-messaging-host/Cargo.toml",
        "src/lib/browser/native-messaging-host/crates/host/Cargo.toml",
        "src/lib/browser/native-messaging-host/crates/host/src/main.rs",
        "src/lib/browser/native-messaging-host/crates/host/src/browser-native-framing.rs",
        "src/lib/browser/native-messaging-host/crates/host/src/raw-channel.rs",
        "src/lib/browser/native-messaging-host/crates/host/src/authenticated-channel.rs",
        "src/lib/browser/native-messaging-host/crates/host/src/transcript.rs",
        "src/lib/browser/native-messaging-host/crates/host/src/artifact-stream.rs",
        "src/lib/browser/native-messaging-host/crates/host/tests/native-host.acceptance.rs",
        "src/lib/browser/native-messaging-host/Cargo.lock",
        "src/lib/browser/native-messaging-host/crates/host/fuzz/Cargo.toml",
        "src/lib/browser/native-messaging-host/crates/host/fuzz/fuzz_targets/native_framing.rs",
        "src/lib/browser/native-messaging-host/crates/host/fuzz/corpus/native_framing/seed.bin"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/browser/protocol/generated/browser-protocol.generated.ts",
        "src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs"
      ],
      "actions": [
        "ACT-014"
      ],
      "outputs": [
        "src/lib/browser/native-messaging-host/Cargo.toml",
        "src/lib/browser/native-messaging-host/crates/host/Cargo.toml",
        "src/lib/browser/native-messaging-host/crates/host/src/main.rs",
        "src/lib/browser/native-messaging-host/crates/host/src/browser-native-framing.rs",
        "src/lib/browser/native-messaging-host/crates/host/src/raw-channel.rs",
        "src/lib/browser/native-messaging-host/crates/host/src/authenticated-channel.rs",
        "src/lib/browser/native-messaging-host/crates/host/src/transcript.rs",
        "src/lib/browser/native-messaging-host/crates/host/src/artifact-stream.rs",
        "src/lib/browser/native-messaging-host/crates/host/tests/native-host.acceptance.rs",
        "src/lib/browser/native-messaging-host/Cargo.lock",
        "src/lib/browser/native-messaging-host/crates/host/fuzz/Cargo.toml",
        "src/lib/browser/native-messaging-host/crates/host/fuzz/fuzz_targets/native_framing.rs",
        "src/lib/browser/native-messaging-host/crates/host/fuzz/corpus/native_framing/seed.bin"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-014"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-016",
        "WO-046"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-015",
      "title": "建设 MV3 Extension",
      "objective": "只建设 NativePortActor、CommandRegistry 与 chrome.debugger 适配。",
      "owner": "MV3 Extension owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-013"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/browser/protocol/generated/browser-protocol.generated.ts",
        "src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs"
      ],
      "create_scope": [
        "src/lib/browser/chrome-extension/manifest.json",
        "src/lib/browser/chrome-extension/service-worker.ts",
        "src/lib/browser/chrome-extension/native-port-actor.ts",
        "src/lib/browser/chrome-extension/command-registry.ts",
        "src/lib/browser/chrome-extension/command-permit-validator.ts",
        "src/lib/browser/chrome-extension/debugger-runtime.ts",
        "src/lib/browser/chrome-extension/exact-target-runtime.ts",
        "src/lib/browser/chrome-extension/dom-intent-runtime.ts",
        "src/lib/browser/chrome-extension/artifact-stream.ts",
        "src/lib/browser/chrome-extension/authenticated-heartbeat.ts",
        "src/lib/browser/chrome-extension/extension.acceptance.ts"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/browser/protocol/generated/browser-protocol.generated.ts",
        "src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs"
      ],
      "actions": [
        "ACT-015"
      ],
      "outputs": [
        "src/lib/browser/chrome-extension/manifest.json",
        "src/lib/browser/chrome-extension/service-worker.ts",
        "src/lib/browser/chrome-extension/native-port-actor.ts",
        "src/lib/browser/chrome-extension/command-registry.ts",
        "src/lib/browser/chrome-extension/command-permit-validator.ts",
        "src/lib/browser/chrome-extension/debugger-runtime.ts",
        "src/lib/browser/chrome-extension/exact-target-runtime.ts",
        "src/lib/browser/chrome-extension/dom-intent-runtime.ts",
        "src/lib/browser/chrome-extension/artifact-stream.ts",
        "src/lib/browser/chrome-extension/authenticated-heartbeat.ts",
        "src/lib/browser/chrome-extension/extension.acceptance.ts"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-015"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-016",
        "WO-046"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-016",
      "title": "建设 TransportActor 与 Reducer",
      "objective": "只拥有 transport event、状态归约、fresh-chain retry 与 stale event 丢弃。",
      "owner": "Browser transport owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-014",
        "WO-015"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/browser/native-messaging-host/Cargo.toml",
        "src/lib/browser/native-messaging-host/crates/host/src/main.rs",
        "src/lib/browser/chrome-extension/manifest.json",
        "src/lib/browser/chrome-extension/service-worker.ts"
      ],
      "create_scope": [
        "src/lib/browser/transport/raw-controller-host-channel.ts",
        "src/lib/browser/transport/authenticated-controller-host-channel.ts",
        "src/lib/browser/transport/transport-event.ts",
        "src/lib/browser/transport/transport-reducer.ts",
        "src/lib/browser/transport/transport-actor.ts",
        "src/lib/browser/transport/transport-authenticator.ts",
        "src/lib/browser/transport/transport-transcript.ts",
        "src/lib/browser/transport/authenticated-heartbeat.ts",
        "src/lib/browser/transport/browser-native-framing.ts",
        "src/lib/browser/transport/browser-transport.acceptance.ts"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/browser/native-messaging-host/Cargo.toml",
        "src/lib/browser/native-messaging-host/crates/host/src/main.rs",
        "src/lib/browser/chrome-extension/manifest.json",
        "src/lib/browser/chrome-extension/service-worker.ts"
      ],
      "actions": [
        "ACT-016"
      ],
      "outputs": [
        "src/lib/browser/transport/raw-controller-host-channel.ts",
        "src/lib/browser/transport/authenticated-controller-host-channel.ts",
        "src/lib/browser/transport/transport-event.ts",
        "src/lib/browser/transport/transport-reducer.ts",
        "src/lib/browser/transport/transport-actor.ts",
        "src/lib/browser/transport/transport-authenticator.ts",
        "src/lib/browser/transport/transport-transcript.ts",
        "src/lib/browser/transport/authenticated-heartbeat.ts",
        "src/lib/browser/transport/browser-native-framing.ts",
        "src/lib/browser/transport/browser-transport.acceptance.ts"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-016"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-021",
        "WO-047"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-017",
      "title": "建设 Authority Issuer",
      "objective": "只在 authenticated channel、profile/process/policy 与 liveness 全成立时产生 PRESENT authority。",
      "owner": "Browser authority issuer owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-047"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/browser/transport/transport-event.ts",
        "src/lib/browser/transport/transport-reducer.ts"
      ],
      "create_scope": [
        "src/lib/browser/infrastructure/browser-authority-lease.ts",
        "src/lib/browser/infrastructure/browser-authority-issuer.ts",
        "src/lib/browser/infrastructure/browser-authority-certificate.ts",
        "src/lib/browser/infrastructure/browser-authority-liveness-lease.ts",
        "src/lib/browser/infrastructure/browser-control-state.ts",
        "src/lib/browser/infrastructure/browser-authority-issuer.acceptance.ts"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/browser/transport/transport-event.ts",
        "src/lib/browser/transport/transport-reducer.ts"
      ],
      "actions": [
        "ACT-017"
      ],
      "outputs": [
        "src/lib/browser/infrastructure/browser-authority-lease.ts",
        "src/lib/browser/infrastructure/browser-authority-issuer.ts",
        "src/lib/browser/infrastructure/browser-authority-certificate.ts",
        "src/lib/browser/infrastructure/browser-authority-liveness-lease.ts",
        "src/lib/browser/infrastructure/browser-control-state.ts",
        "src/lib/browser/infrastructure/browser-authority-issuer.acceptance.ts"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-017"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-018"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-018",
      "title": "建设 BrowserAuthorityBroker",
      "objective": "唯一业务入口只消费当前 execution binding 并返回 authority lease 或 typed unavailable。",
      "owner": "Browser broker owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-017"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/browser/infrastructure/browser-authority-certificate.ts",
        "src/lib/browser/infrastructure/browser-authority-issuer.ts"
      ],
      "create_scope": [
        "src/lib/browser/infrastructure/browser-authority-broker.ts",
        "src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts",
        "src/lib/browser/browser-authority-api.ts"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/browser/infrastructure/browser-authority-certificate.ts",
        "src/lib/browser/infrastructure/browser-authority-issuer.ts"
      ],
      "actions": [
        "ACT-018"
      ],
      "outputs": [
        "src/lib/browser/infrastructure/browser-authority-broker.ts",
        "src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts",
        "src/lib/browser/browser-authority-api.ts"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-018"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-019",
        "WO-023"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-019",
      "title": "建设 exact TargetLeaseManager",
      "objective": "只从当前 authority lease 取得唯一 target/document lease，epoch 变化立即失效。",
      "owner": "Browser target lease owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-018"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/browser/infrastructure/browser-authority-broker.ts",
        "src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts"
      ],
      "create_scope": [
        "src/lib/browser/exact-target/browser-target-ref.ts",
        "src/lib/browser/exact-target/browser-document-ref.ts",
        "src/lib/browser/exact-target/browser-target-lease.ts",
        "src/lib/browser/exact-target/browser-target-lease-manager.ts",
        "src/lib/browser/exact-target/browser-target-lease.acceptance.ts"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/browser/infrastructure/browser-authority-broker.ts",
        "src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts"
      ],
      "actions": [
        "ACT-019"
      ],
      "outputs": [
        "src/lib/browser/exact-target/browser-target-ref.ts",
        "src/lib/browser/exact-target/browser-document-ref.ts",
        "src/lib/browser/exact-target/browser-target-lease.ts",
        "src/lib/browser/exact-target/browser-target-lease-manager.ts",
        "src/lib/browser/exact-target/browser-target-lease.acceptance.ts"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-019"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-020",
        "WO-023"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-020",
      "title": "建设 CommandActor",
      "objective": "只执行 registry-owned declarative commands；mutation 不自动重放，歧义进入 OUTCOME_UNKNOWN。",
      "owner": "Browser command owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-019"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/browser/exact-target/browser-target-lease.ts",
        "src/lib/browser/exact-target/browser-target-lease-manager.ts"
      ],
      "create_scope": [
        "src/lib/browser/transport/command-permit.ts",
        "src/lib/browser/transport/reply-channel-token.ts",
        "src/lib/browser/transport/browser-command-admission-budget.ts",
        "src/lib/browser/exact-target/browser-command-actor.ts",
        "src/lib/browser/exact-target/browser-mutation-intent-journal.ts",
        "src/lib/browser/exact-target/browser-dom-intent.ts",
        "src/lib/browser/exact-target/browser-file-artifact-grant.ts",
        "src/lib/browser/exact-target/browser-artifact-stream.ts",
        "src/lib/browser/exact-target/browser-command.acceptance.ts"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/browser/exact-target/browser-target-lease.ts",
        "src/lib/browser/exact-target/browser-target-lease-manager.ts"
      ],
      "actions": [
        "ACT-020"
      ],
      "outputs": [
        "src/lib/browser/transport/command-permit.ts",
        "src/lib/browser/transport/reply-channel-token.ts",
        "src/lib/browser/transport/browser-command-admission-budget.ts",
        "src/lib/browser/exact-target/browser-command-actor.ts",
        "src/lib/browser/exact-target/browser-mutation-intent-journal.ts",
        "src/lib/browser/exact-target/browser-dom-intent.ts",
        "src/lib/browser/exact-target/browser-file-artifact-grant.ts",
        "src/lib/browser/exact-target/browser-artifact-stream.ts",
        "src/lib/browser/exact-target/browser-command.acceptance.ts"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-020"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-023",
        "WO-024",
        "WO-026"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-021",
      "title": "建设 Profile 与 BrowserProcessSupervisor",
      "objective": "建设完整 profile 终态：config、state、dedicated policy、enrollment、receipt、process attestation、managed policy readback 与唯一 BrowserProcessSupervisor；enrollment mutation 仍只由 browserctl 执行。",
      "owner": "Browser profile owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-016",
        "WO-046"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/browser/protocol/browser-profile-enrollment.schema.json",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/enroll_profile.rs",
        "deliverable://construction-admission/browser-canonical-path.json"
      ],
      "create_scope": [
        "src/lib/browser/profile/browser-profile-enrollment.ts",
        "src/lib/browser/profile/dedicated-profile-policy.ts",
        "src/lib/browser/profile/browser-profile-state.ts",
        "src/lib/browser/profile/browser-profile-config.ts",
        "src/lib/browser/profile/browser-profile-enrollment-receipt.ts",
        "src/lib/browser/profile/browser-profile-process-attestation.ts",
        "src/lib/browser/profile/managed-policy-readback.ts",
        "src/lib/browser/profile/browser-process-supervisor.ts",
        "src/lib/browser/profile/browser-profile.acceptance.ts"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/browser/protocol/browser-profile-enrollment.schema.json",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/enroll_profile.rs",
        "deliverable://construction-admission/browser-canonical-path.json"
      ],
      "actions": [
        "ACT-021"
      ],
      "outputs": [
        "src/lib/browser/profile/browser-profile-enrollment.ts",
        "src/lib/browser/profile/dedicated-profile-policy.ts",
        "src/lib/browser/profile/browser-profile-state.ts",
        "src/lib/browser/profile/browser-profile-config.ts",
        "src/lib/browser/profile/browser-profile-enrollment-receipt.ts",
        "src/lib/browser/profile/browser-profile-process-attestation.ts",
        "src/lib/browser/profile/managed-policy-readback.ts",
        "src/lib/browser/profile/browser-process-supervisor.ts",
        "src/lib/browser/profile/browser-profile.acceptance.ts"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-021"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-023",
        "WO-047"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-022",
      "title": "建设发布 schema 与空 ABSENT 激活槽",
      "objective": "只建立 ArtifactSet、ActivationTuple、ReleaseSecurityPolicy、ProofManifest、rollback、SBOM、provenance 与 build-input schemas，并初始化空 ABSENT slot；不签发任何候选身份。",
      "owner": "Browser release identity owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-013"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/browser/protocol/browser-protocol.schema.json",
        "src/lib/browser/protocol/generated/browser-protocol.generated.ts",
        "src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs"
      ],
      "create_scope": [
        "src/lib/browser/release/browser-artifact-set.schema.json",
        "src/lib/browser/release/browser-activation-tuple.schema.json",
        "src/lib/browser/release/browser-release-proof.schema.json",
        "src/lib/browser/release/browser-release-security-policy.schema.json",
        "src/lib/browser/release/browser-rollback-receipt.schema.json",
        "src/lib/browser/release/browser-build-inputs.schema.json",
        "src/lib/browser/release/browser-sbom.schema.json",
        "src/lib/browser/release/browser-provenance.schema.json",
        "src/lib/browser/release/pinned-browser-toolchain.json",
        "src/lib/browser/release/active-activation.json",
        "src/lib/browser/release/release-identity.acceptance.ts",
        "src/lib/browser/release/browser-build.config.json",
        "src/lib/browser/release/browser-previous-activation-snapshot.schema.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/browser/protocol/browser-protocol.schema.json",
        "src/lib/browser/protocol/generated/browser-protocol.generated.ts",
        "src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs"
      ],
      "actions": [
        "ACT-022"
      ],
      "outputs": [
        "src/lib/browser/release/browser-artifact-set.schema.json",
        "src/lib/browser/release/browser-activation-tuple.schema.json",
        "src/lib/browser/release/browser-release-proof.schema.json",
        "src/lib/browser/release/browser-release-security-policy.schema.json",
        "src/lib/browser/release/browser-rollback-receipt.schema.json",
        "src/lib/browser/release/browser-build-inputs.schema.json",
        "src/lib/browser/release/browser-sbom.schema.json",
        "src/lib/browser/release/browser-provenance.schema.json",
        "src/lib/browser/release/pinned-browser-toolchain.json",
        "src/lib/browser/release/active-activation.json",
        "src/lib/browser/release/release-identity.acceptance.ts",
        "src/lib/browser/release/browser-build.config.json",
        "src/lib/browser/release/browser-previous-activation-snapshot.schema.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-022"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-031",
        "WO-033"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-023",
      "title": "接回 Local Runtime 唯一装配面",
      "objective": "Local Runtime 只注入 Broker，原样展示 supervisor 的 browserInfrastructure/browserAuthority health；assembly 不领取或缓存 target lease；已退休的 workbench-browser-support.ts 与 workbench-video-download-support.ts 永久不存在。",
      "owner": "local-runtime owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-018",
        "WO-019",
        "WO-020",
        "WO-021"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/browser/infrastructure/browser-authority-broker.ts",
        "src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts",
        "src/lib/browser/exact-target/browser-target-lease.ts",
        "src/lib/browser/exact-target/browser-target-lease-manager.ts",
        "src/lib/browser/exact-target/browser-command-actor.ts",
        "src/lib/browser/transport/command-permit.ts",
        "src/lib/browser/profile/browser-profile-enrollment.ts",
        "src/lib/browser/profile/browser-process-supervisor.ts"
      ],
      "create_scope": [
        "src/lib/local-runtime/workbench-browser-authority-support.ts",
        "src/lib/local-runtime/workbench-browser-authority.acceptance.ts"
      ],
      "modify_scope": [
        "src/lib/local-runtime/workbench-assembly.ts",
        "src/lib/local-runtime/workbench-ai-gateway-support.ts",
        "src/lib/local-runtime/workbench-status.ts",
        "src/lib/local-runtime/workbench.ts"
      ],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/browser/infrastructure/browser-authority-broker.ts",
        "src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts",
        "src/lib/browser/exact-target/browser-target-lease.ts",
        "src/lib/browser/exact-target/browser-target-lease-manager.ts",
        "src/lib/browser/exact-target/browser-command-actor.ts",
        "src/lib/browser/transport/command-permit.ts",
        "src/lib/browser/profile/browser-profile-enrollment.ts",
        "src/lib/browser/profile/browser-process-supervisor.ts"
      ],
      "actions": [
        "ACT-023"
      ],
      "outputs": [
        "src/lib/local-runtime/workbench-browser-authority-support.ts",
        "src/lib/local-runtime/workbench-browser-authority.acceptance.ts"
      ],
      "consumer_migration": [
        "src/lib/local-runtime/workbench-browser-support.ts | owner=local-runtime | terminal=permanently absent | replacement=src/lib/local-runtime/workbench-browser-authority-support.ts | acceptance=ACC-023",
        "src/lib/local-runtime/workbench-video-download-support.ts | owner=local-runtime | terminal=permanently absent | replacement=Broker injection in workbench-assembly.ts plus capability public factory in WO-026 | acceptance=ACC-023/ACC-026",
        "src/lib/local-runtime/workbench-ai-gateway-support.ts | owner=local-runtime | migration=WO-023/WO-025 | acceptance=ACC-023/ACC-025",
        "src/lib/local-runtime/workbench-assembly.ts | owner=local-runtime | migration=WO-023 | acceptance=ACC-023"
      ],
      "acceptance_ids": [
        "ACC-023"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-024",
        "WO-025",
        "WO-026",
        "WO-027",
        "WO-028",
        "WO-029",
        "WO-031"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-024",
      "title": "迁移 DOM Automation",
      "objective": "六个原子动作只消费当前 BrowserTargetLease 与命令 permit。",
      "owner": "dom-automation owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-020",
        "WO-023",
        "WO-007"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/browser/exact-target/browser-command-actor.ts",
        "src/lib/browser/transport/command-permit.ts",
        "src/lib/local-runtime/workbench-browser-authority-support.ts",
        "src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
        "deliverable://browser-observation/preconstruction-chrome.json"
      ],
      "create_scope": [
        "src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts"
      ],
      "modify_scope": [
        "src/capabilities/dom-automation/runtime/dom-target-binding.ts",
        "src/capabilities/dom-automation/runtime/dom-snapshot.ts",
        "src/capabilities/dom-automation/runtime/dom-fill.ts",
        "src/capabilities/dom-automation/runtime/dom-click.ts",
        "src/capabilities/dom-automation/runtime/dom-upload.ts",
        "src/capabilities/dom-automation/runtime/dom-evidence.ts"
      ],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/browser/exact-target/browser-command-actor.ts",
        "src/lib/browser/transport/command-permit.ts",
        "src/lib/local-runtime/workbench-browser-authority-support.ts",
        "src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
        "deliverable://browser-observation/preconstruction-chrome.json"
      ],
      "actions": [
        "ACT-024"
      ],
      "outputs": [
        "src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts"
      ],
      "consumer_migration": [
        "src/capabilities/dom-automation/runtime/dom-target-binding.ts | owner=dom-automation | migration=WO-024 | acceptance=ACC-024"
      ],
      "acceptance_ids": [
        "ACC-024"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-025",
        "WO-027",
        "WO-028",
        "WO-031"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-025",
      "title": "迁移 AI Input Gateway",
      "objective": "每次 provider execution/checkpoint 重新取得并释放 authority/target；删除 BrowserTargetSession fixture 合同。",
      "owner": "ai-input-gateway owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-023",
        "WO-024"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/local-runtime/workbench-browser-authority-support.ts",
        "src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
        "src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts"
      ],
      "create_scope": [
        "src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts"
      ],
      "modify_scope": [
        "src/capabilities/ai-input-gateway/ability-group.ts",
        "src/capabilities/ai-input-gateway/contracts/ai-provider-adapter.contract.ts",
        "src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution.ts",
        "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-browser.ts",
        "src/capabilities/ai-input-gateway/providers/web-chat-page-actions.ts",
        "src/capabilities/ai-input-gateway/children/attach-approved-web-chat-files-once.ts",
        "src/capabilities/ai-input-gateway/acceptance/attachment.acceptance.ts",
        "src/capabilities/ai-input-gateway/acceptance/provider-boundary.acceptance.ts"
      ],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/local-runtime/workbench-browser-authority-support.ts",
        "src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
        "src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts"
      ],
      "actions": [
        "ACT-025"
      ],
      "outputs": [
        "src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts"
      ],
      "consumer_migration": [
        "src/capabilities/ai-input-gateway/ability-group.ts | owner=ai-input-gateway | migration=WO-025 | acceptance=ACC-025"
      ],
      "acceptance_ids": [
        "ACC-025"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-028",
        "WO-029",
        "WO-031"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-026",
      "title": "迁移 Video Download",
      "objective": "来源页探测只使用命名、有界 observation capability，不允许 evaluate 或脚本 fallback。",
      "owner": "video-download owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-020",
        "WO-023"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/browser/exact-target/browser-command-actor.ts",
        "src/lib/browser/transport/command-permit.ts",
        "src/lib/local-runtime/workbench-browser-authority-support.ts",
        "src/lib/local-runtime/workbench-browser-authority.acceptance.ts"
      ],
      "create_scope": [
        "src/capabilities/video-download/acceptance/browser-authority.acceptance.ts"
      ],
      "modify_scope": [
        "src/capabilities/video-download/children/download-web-video-once.ts",
        "src/capabilities/video-download/children/download-facebook-video-once.ts",
        "src/capabilities/video-download/children/download-tiktok-video-once.ts"
      ],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/browser/exact-target/browser-command-actor.ts",
        "src/lib/browser/transport/command-permit.ts",
        "src/lib/local-runtime/workbench-browser-authority-support.ts",
        "src/lib/local-runtime/workbench-browser-authority.acceptance.ts"
      ],
      "actions": [
        "ACT-026"
      ],
      "outputs": [
        "src/capabilities/video-download/acceptance/browser-authority.acceptance.ts"
      ],
      "consumer_migration": [
        "src/capabilities/video-download/children/download-web-video-once.ts | owner=video-download | migration=WO-026 | acceptance=ACC-026"
      ],
      "acceptance_ids": [
        "ACC-026"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-031"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-027",
      "title": "迁移 Amazon Invoice Upload",
      "objective": "只改 Browser 边界，保留业务顺序和人工最终门；每个 mutation 有 journal 与 owner outcome resolution。",
      "owner": "amazon-invoice-upload owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-023",
        "WO-024"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/local-runtime/workbench-browser-authority-support.ts",
        "src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
        "src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts"
      ],
      "create_scope": [
        "src/plugins/amazon-invoice-upload/amazon-invoice-upload-browser-authority.acceptance.ts"
      ],
      "modify_scope": [
        "src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts",
        "src/plugins/amazon-invoice-upload/amazon-invoice-upload-file-attachment.ts",
        "src/plugins/amazon-invoice-upload/amazon-invoice-upload-steps.ts",
        "src/plugins/amazon-invoice-upload/amazon-invoice-upload-verify.ts",
        "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts",
        "src/plugins/amazon-invoice-upload/amazon-tax-invoice-download-flow-actions.ts",
        "src/plugins/amazon-invoice-upload/amazon-tax-invoice-download-flow-navigation.ts",
        "src/plugins/amazon-invoice-upload/amazon-tax-invoice-download.flow.ts"
      ],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/local-runtime/workbench-browser-authority-support.ts",
        "src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
        "src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts"
      ],
      "actions": [
        "ACT-027"
      ],
      "outputs": [
        "src/plugins/amazon-invoice-upload/amazon-invoice-upload-browser-authority.acceptance.ts"
      ],
      "consumer_migration": [
        "src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts | owner=amazon-invoice-upload | migration=WO-027 | acceptance=ACC-027"
      ],
      "acceptance_ids": [
        "ACC-027"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-031",
        "WO-043"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-028",
      "title": "迁移 Amazon Product Mining",
      "objective": "每阶段使用当前 execution/authority/target，checkpoint 后不缓存旧 lease。",
      "owner": "amazon-product-mining owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-023",
        "WO-024",
        "WO-025"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/local-runtime/workbench-browser-authority-support.ts",
        "src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
        "src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts",
        "src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts"
      ],
      "create_scope": [
        "src/plugins/amazon-product-mining/amazon-product-mining-browser-authority.acceptance.ts"
      ],
      "modify_scope": [
        "src/plugins/amazon-product-mining/amazon-product-mining.flow-support.ts",
        "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts",
        "src/plugins/amazon-product-mining/amazon-product-mining.search.ts",
        "src/plugins/amazon-product-mining/amazon-product-mining.product-detail.ts",
        "src/plugins/amazon-product-mining/amazon-product-mining.reviews.ts",
        "src/plugins/amazon-product-mining/index.ts"
      ],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/local-runtime/workbench-browser-authority-support.ts",
        "src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
        "src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts",
        "src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts"
      ],
      "actions": [
        "ACT-028"
      ],
      "outputs": [
        "src/plugins/amazon-product-mining/amazon-product-mining-browser-authority.acceptance.ts"
      ],
      "consumer_migration": [
        "src/plugins/amazon-product-mining/amazon-product-mining.flow-support.ts | owner=amazon-product-mining | migration=WO-028 | acceptance=ACC-028"
      ],
      "acceptance_ids": [
        "ACC-028"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-031",
        "WO-043"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-029",
      "title": "迁移 xuanxue-ai-production receipt 生产者",
      "objective": "在唯一 AgentRuntimeReceiptV2 内记录有序 authority windows，窗口间零动作且无未裁决 mutation。",
      "owner": "xuanxue-ai-production owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-023",
        "WO-025"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/local-runtime/workbench-browser-authority-support.ts",
        "src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
        "src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts"
      ],
      "create_scope": [
        "src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts"
      ],
      "modify_scope": [
        "src/plugins/xuanxue-ai-production/index.ts",
        "src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-proof.ts",
        "src/plugins/xuanxue-ai-production/xuanxue-ai-production-result.ts"
      ],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/local-runtime/workbench-browser-authority-support.ts",
        "src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
        "src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts"
      ],
      "actions": [
        "ACT-029"
      ],
      "outputs": [
        "src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts"
      ],
      "consumer_migration": [
        "src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-proof.ts | owner=xuanxue-ai-production | migration=WO-029 | acceptance=ACC-029"
      ],
      "acceptance_ids": [
        "ACC-029"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-030",
        "WO-031",
        "WO-043"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-030",
      "title": "切换 xuanxue 唯一消费合同",
      "objective": "只在 DG-003 干净候选上修改三条冻结路径，不建立第二 election、receipt 或 verdict owner。",
      "owner": "xuanxue dynamic-proof owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-004",
        "WO-029"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://construction-admission/xuanxue-candidate.json",
        "src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts"
      ],
      "create_scope": [
        "/Users/nexgen/Documents/xuanxue-web/tests/dynamic-proof/browser-authority-window-contract.test.ts",
        "deliverable://work-orders/WO-030/cross-repo-receipt.json"
      ],
      "modify_scope": [
        "/Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/browser-authority-proof-contract.ts",
        "/Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/collector-contracts.ts",
        "/Users/nexgen/Documents/xuanxue-web/scripts/audit/domains/dynamic-proof/dynamic-agent-receipt-inspection.ts"
      ],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://construction-admission/xuanxue-candidate.json",
        "src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts"
      ],
      "actions": [
        "ACT-030"
      ],
      "outputs": [
        "/Users/nexgen/Documents/xuanxue-web/tests/dynamic-proof/browser-authority-window-contract.test.ts",
        "deliverable://work-orders/WO-030/cross-repo-receipt.json"
      ],
      "consumer_migration": [
        "Cross-repo target paths are exactly the three paths frozen by DG-003; no path wildcard is permitted."
      ],
      "acceptance_ids": [
        "ACC-030"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-031",
        "WO-036",
        "WO-048"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-031",
      "title": "扩充唯一 local-browser audit owner 到 26 项",
      "objective": "从当前 active law 的 SHA 绑定文本导出精确 26 个 machine-blocking checkId，并与现有 owner manifest/inspector 的独立 binding 集合做全等比较。",
      "owner": "local-browser audit owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-022",
        "WO-023",
        "WO-024",
        "WO-025",
        "WO-026",
        "WO-027",
        "WO-028",
        "WO-029",
        "WO-030"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        ".github/instructions/agent-rules/modules/module-local-browser-session.instructions.md",
        "scripts/audit/domains/local-browser-session/manifest.json",
        "scripts/audit/domains/local-browser-session/inspector.ts"
      ],
      "create_scope": [
        "scripts/audit/domains/local-browser-session/local-browser-26-checks.acceptance.ts",
        "deliverable://work-orders/WO-031/26-check-receipt.json"
      ],
      "modify_scope": [
        "scripts/audit/domains/local-browser-session/manifest.json",
        "scripts/audit/domains/local-browser-session/inspector.ts"
      ],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        ".github/instructions/agent-rules/modules/module-local-browser-session.instructions.md",
        "scripts/audit/domains/local-browser-session/manifest.json",
        "scripts/audit/domains/local-browser-session/inspector.ts"
      ],
      "actions": [
        "ACT-031"
      ],
      "outputs": [
        "scripts/audit/domains/local-browser-session/local-browser-26-checks.acceptance.ts",
        "deliverable://work-orders/WO-031/26-check-receipt.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-031"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-032"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-032",
      "title": "建立并通过确定性负例、性质、模型与 mutant 组",
      "objective": "26 个检查逐项拥有 negative/property/model/mutant 证据；另以确定性合同验证两项合法 health、精确 error taxonomy、11 个零指标、4 项 SLO 和无界队列/缓存/流为零；generated truth 只由现有 builder 生成。",
      "owner": "acceptance and audit test owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-031",
        "WO-047"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "scripts/audit/domains/local-browser-session/manifest.json",
        "scripts/audit/domains/local-browser-session/inspector.ts"
      ],
      "create_scope": [
        "scripts/acceptance/local-browser-terminal-contract.acceptance.ts",
        "scripts/acceptance/local-browser-26-mutants.acceptance.ts",
        "scripts/acceptance/local-browser-property-model.acceptance.ts"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "scripts/audit/domains/local-browser-session/manifest.json",
        "scripts/audit/domains/local-browser-session/inspector.ts"
      ],
      "actions": [
        "ACT-032"
      ],
      "outputs": [
        "scripts/acceptance/local-browser-terminal-contract.acceptance.ts",
        "scripts/acceptance/local-browser-26-mutants.acceptance.ts",
        "scripts/acceptance/local-browser-property-model.acceptance.ts"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-032"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-035",
        "WO-044",
        "WO-048",
        "WO-058",
        "WO-059"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-033",
      "title": "构建一次不可变 ArtifactSet",
      "objective": "只从 WO-060 冻结的 source bundles/tree manifests 与精确 package/tsconfig/build config 输入构建 Controller、Host、browserctl、launcher、platform adapter、Verified CRX、Native Messaging manifest、checksums/signature 九个实体；ArtifactSet 仅索引这些 content-addressed entities。",
      "owner": "release build owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-003",
        "WO-022",
        "WO-060"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://construction-admission/external-operations.json",
        "deliverable://browser-release/constructed-release-candidate.json",
        "deliverable://browser-release/agent-constructed-tree-manifest.json",
        "deliverable://browser-release/agent-build-input-manifest.json",
        "deliverable://browser-release/agent-constructed-source-bundle.tar.zst",
        "deliverable://browser-release/xuanxue-constructed-tree-manifest.json",
        "deliverable://browser-release/xuanxue-constructed-source-bundle.tar.zst"
      ],
      "create_scope": [
        "artifact://browser-release/controller/controller-bundle.tgz",
        "artifact://browser-release/native-host/grasseye-browser-host",
        "artifact://browser-release/browserctl/browserctl",
        "artifact://browser-release/launcher/grasseye-browser-launcher",
        "artifact://browser-release/platform-macos/libgrasseye-platform-macos.a",
        "artifact://browser-release/extension/grasseye-browser-extension.verified.crx",
        "artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json",
        "artifact://browser-release/checksums/SHA256SUMS",
        "artifact://browser-release/signatures/SHA256SUMS.sig",
        "deliverable://browser-release/browser-build-input-lock.json",
        "deliverable://browser-release/artifact-set.json",
        "deliverable://browser-release/builder-a-receipt.json",
        "deliverable://browser-release/builder-b-receipt.json",
        "deliverable://browser-release/sbom.spdx.json",
        "deliverable://browser-release/provenance.json",
        "deliverable://browser-release/installed-artifact-readback.json",
        "src/lib/browser/release/build-artifacts.mjs",
        "src/lib/browser/release/verify-artifacts.mjs"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://construction-admission/external-operations.json",
        "deliverable://browser-release/constructed-release-candidate.json",
        "deliverable://browser-release/agent-constructed-tree-manifest.json",
        "deliverable://browser-release/agent-build-input-manifest.json",
        "deliverable://browser-release/agent-constructed-source-bundle.tar.zst",
        "deliverable://browser-release/xuanxue-constructed-tree-manifest.json",
        "deliverable://browser-release/xuanxue-constructed-source-bundle.tar.zst"
      ],
      "actions": [
        "ACT-033"
      ],
      "outputs": [
        "artifact://browser-release/controller/controller-bundle.tgz",
        "artifact://browser-release/native-host/grasseye-browser-host",
        "artifact://browser-release/browserctl/browserctl",
        "artifact://browser-release/launcher/grasseye-browser-launcher",
        "artifact://browser-release/platform-macos/libgrasseye-platform-macos.a",
        "artifact://browser-release/extension/grasseye-browser-extension.verified.crx",
        "artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json",
        "artifact://browser-release/checksums/SHA256SUMS",
        "artifact://browser-release/signatures/SHA256SUMS.sig",
        "deliverable://browser-release/browser-build-input-lock.json",
        "deliverable://browser-release/artifact-set.json",
        "deliverable://browser-release/builder-a-receipt.json",
        "deliverable://browser-release/builder-b-receipt.json",
        "deliverable://browser-release/sbom.spdx.json",
        "deliverable://browser-release/provenance.json",
        "deliverable://browser-release/installed-artifact-readback.json",
        "src/lib/browser/release/build-artifacts.mjs",
        "src/lib/browser/release/verify-artifacts.mjs"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-033"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-050"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-034",
      "title": "运行同一 ArtifactSet 的真实 Chrome 矩阵",
      "objective": "在 Stable 与 CfT 上对同一 ArtifactSet、ActivationTuple candidate 与 ReleaseSecurityPolicy 完成 profile/process/policy、auth、target、file、stream、update 与 rollback 正反终态。",
      "owner": "real Chrome evidence owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-050"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://browser-release/artifact-set.json",
        "deliverable://browser-release/activation-tuple-candidate.json",
        "deliverable://browser-release/release-security-policy.json",
        "deliverable://browser-release/release-identity-signature.json",
        "deliverable://browser-observation/preconstruction-chrome.json",
        "artifact://browser-release/controller/controller-bundle.tgz",
        "artifact://browser-release/native-host/grasseye-browser-host",
        "artifact://browser-release/browserctl/browserctl",
        "artifact://browser-release/launcher/grasseye-browser-launcher",
        "artifact://browser-release/platform-macos/libgrasseye-platform-macos.a",
        "artifact://browser-release/extension/grasseye-browser-extension.verified.crx",
        "artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json",
        "artifact://browser-release/checksums/SHA256SUMS",
        "artifact://browser-release/signatures/SHA256SUMS.sig",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "create_scope": [
        "scripts/acceptance/local-browser-real-chrome-terminal.acceptance.ts",
        "deliverable://browser-release/real-chrome-matrix.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://browser-release/artifact-set.json",
        "deliverable://browser-release/activation-tuple-candidate.json",
        "deliverable://browser-release/release-security-policy.json",
        "deliverable://browser-release/release-identity-signature.json",
        "deliverable://browser-observation/preconstruction-chrome.json",
        "artifact://browser-release/controller/controller-bundle.tgz",
        "artifact://browser-release/native-host/grasseye-browser-host",
        "artifact://browser-release/browserctl/browserctl",
        "artifact://browser-release/launcher/grasseye-browser-launcher",
        "artifact://browser-release/platform-macos/libgrasseye-platform-macos.a",
        "artifact://browser-release/extension/grasseye-browser-extension.verified.crx",
        "artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json",
        "artifact://browser-release/checksums/SHA256SUMS",
        "artifact://browser-release/signatures/SHA256SUMS.sig",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "actions": [
        "ACT-034"
      ],
      "outputs": [
        "scripts/acceptance/local-browser-real-chrome-terminal.acceptance.ts",
        "deliverable://browser-release/real-chrome-matrix.json"
      ],
      "consumer_migration": [
        "scripts/acceptance/local-browser-real-chrome-scenarios.acceptance.ts | owner=acceptance | migration=WO-034 | acceptance=ACC-034"
      ],
      "acceptance_ids": [
        "ACC-034"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-036",
        "WO-043"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-035",
      "title": "锁定 GitHub required checks 与 branch protection",
      "objective": "Consume only deliverable://construction-admission/agent-repository-governance-policy.json; sign remote pre-state, PATCH exact main strict/contexts, GET signed post-state, and restore signed pre-state plus GET on failure.",
      "owner": "AGENT repository governance owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-032",
        "WO-056",
        "WO-060"
      ],
      "parallel_group": "RELEASE_GOVERNANCE",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "scripts/audit/domains/local-browser-session/manifest.json",
        "deliverable://browser-release/constructed-release-candidate.json",
        "deliverable://construction-admission/agent-repository-governance-policy.json"
      ],
      "create_scope": [
        "deliverable://browser-release/agent-branch-protection-prestate.json",
        "deliverable://browser-release/branch-protection-readback.json",
        "deliverable://browser-release/agent-branch-protection-recovery-receipt.json"
      ],
      "modify_scope": [
        "system://github/ADVISION-X/AGENT/branches/main/protection/required_status_checks"
      ],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "scripts/audit/domains/local-browser-session/manifest.json",
        "deliverable://browser-release/constructed-release-candidate.json",
        "deliverable://construction-admission/agent-repository-governance-policy.json"
      ],
      "actions": [
        "ACT-035A",
        "ACT-035B",
        "ACT-035C"
      ],
      "outputs": [
        "deliverable://browser-release/agent-branch-protection-prestate.json",
        "deliverable://browser-release/branch-protection-readback.json",
        "deliverable://browser-release/agent-branch-protection-recovery-receipt.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-035A",
        "ACC-035B",
        "ACC-035C"
      ],
      "failure_actions": [
        "Run ACT-035C: PATCH the signed pre-state, GET again, emit deliverable://browser-release/agent-branch-protection-recovery-receipt.json with RESTORED or RECOVERY_FAILED, and stop release work."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Only the signed deliverable://browser-release/agent-branch-protection-prestate.json may be restored; verify exact strict/contexts readback before any retry."
      ],
      "handoff_to": [
        "WO-041"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-036",
      "title": "执行主备 handover",
      "objective": "一主一热备只消费 xuanxue 数据库 fence，完成 revoke/checkpoint/fresh-window 交接并证明 dual_active、stale-event、old-completion-to-new-port、liveness-expired-command 四项指标均为零。",
      "owner": "HA operations owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-003",
        "WO-030",
        "WO-034"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://construction-admission/external-operations.json",
        "deliverable://construction-admission/xuanxue-candidate.json",
        "deliverable://browser-release/real-chrome-matrix.json",
        "deliverable://browser-release/activation-tuple-candidate.json",
        "deliverable://browser-release/release-security-policy.json",
        "deliverable://browser-release/release-identity-signature.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "create_scope": [
        "deliverable://browser-release/ha-handover.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://construction-admission/external-operations.json",
        "deliverable://construction-admission/xuanxue-candidate.json",
        "deliverable://browser-release/real-chrome-matrix.json",
        "deliverable://browser-release/activation-tuple-candidate.json",
        "deliverable://browser-release/release-security-policy.json",
        "deliverable://browser-release/release-identity-signature.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "actions": [
        "ACT-036"
      ],
      "outputs": [
        "deliverable://browser-release/ha-handover.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-036"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-037"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-037",
      "title": "完成 24h 与 168h soak",
      "objective": "对同一 ArtifactSet 和 HA 拓扑完成法定时长；11 个零指标、4 项 SLO 与无界队列/缓存/流必须全部达标，任何 identity 漂移或指标越界即整段作废。",
      "owner": "soak evidence owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-036"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://browser-release/ha-handover.json",
        "deliverable://browser-release/artifact-set.json",
        "deliverable://browser-release/activation-tuple-candidate.json",
        "deliverable://browser-release/release-security-policy.json",
        "deliverable://browser-release/release-identity-signature.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "create_scope": [
        "deliverable://browser-release/soak-24h.json",
        "deliverable://browser-release/soak-168h.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://browser-release/ha-handover.json",
        "deliverable://browser-release/artifact-set.json",
        "deliverable://browser-release/activation-tuple-candidate.json",
        "deliverable://browser-release/release-security-policy.json",
        "deliverable://browser-release/release-identity-signature.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "actions": [
        "ACT-037"
      ],
      "outputs": [
        "deliverable://browser-release/soak-24h.json",
        "deliverable://browser-release/soak-168h.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-037"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-041"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-038",
      "title": "创建 BrowserReleaseProofManifestV1",
      "objective": "首次创建 proof manifest，绑定同一 candidate、ArtifactSet、ActivationTuple 候选、安全策略、26 checks、Chrome、HA、soak 与 branch readback。",
      "owner": "release proof owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-041"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://work-orders/WO-031/26-check-receipt.json",
        "deliverable://work-orders/WO-030/cross-repo-receipt.json",
        "deliverable://browser-release/artifact-set.json",
        "deliverable://browser-release/activation-tuple-candidate.json",
        "deliverable://browser-release/release-security-policy.json",
        "deliverable://browser-release/real-chrome-matrix.json",
        "deliverable://browser-release/business-workday-receipt.json",
        "deliverable://browser-release/branch-protection-readback.json",
        "deliverable://browser-release/ha-handover.json",
        "deliverable://browser-release/soak-24h.json",
        "deliverable://browser-release/soak-168h.json",
        "deliverable://browser-release/ci-full-receipt.json",
        "deliverable://browser-release/independent-audit.json",
        "scripts/audit/generated/audit-plan.generated.json",
        "deliverable://browser-release/xuanxue-branch-protection-readback.json",
        "deliverable://browser-release/browser-build-input-lock.json",
        "deliverable://browser-release/sbom.spdx.json",
        "deliverable://browser-release/provenance.json",
        "deliverable://browser-release/installed-artifact-readback.json",
        "deliverable://browser-release/release-identity-signature.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "create_scope": [
        "deliverable://browser-release/BrowserReleaseProofManifestV1.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://work-orders/WO-031/26-check-receipt.json",
        "deliverable://work-orders/WO-030/cross-repo-receipt.json",
        "deliverable://browser-release/artifact-set.json",
        "deliverable://browser-release/activation-tuple-candidate.json",
        "deliverable://browser-release/release-security-policy.json",
        "deliverable://browser-release/real-chrome-matrix.json",
        "deliverable://browser-release/business-workday-receipt.json",
        "deliverable://browser-release/branch-protection-readback.json",
        "deliverable://browser-release/ha-handover.json",
        "deliverable://browser-release/soak-24h.json",
        "deliverable://browser-release/soak-168h.json",
        "deliverable://browser-release/ci-full-receipt.json",
        "deliverable://browser-release/independent-audit.json",
        "scripts/audit/generated/audit-plan.generated.json",
        "deliverable://browser-release/xuanxue-branch-protection-readback.json",
        "deliverable://browser-release/browser-build-input-lock.json",
        "deliverable://browser-release/sbom.spdx.json",
        "deliverable://browser-release/provenance.json",
        "deliverable://browser-release/installed-artifact-readback.json",
        "deliverable://browser-release/release-identity-signature.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "actions": [
        "ACT-038"
      ],
      "outputs": [
        "deliverable://browser-release/BrowserReleaseProofManifestV1.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-038"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-039"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-039",
      "title": "原子激活唯一 ActivationTuple",
      "objective": "只消费已签 proof manifest，先签发 PreviousActivationSnapshot=SIGNED_ABSENT 或 SIGNED_PRESENT(tuple)，再 CAS 切换一个 active tuple。",
      "owner": "release activation owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-038"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://browser-release/BrowserReleaseProofManifestV1.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "create_scope": [
        "deliverable://browser-release/activation-receipt.json",
        "deliverable://browser-release/previous-activation-snapshot.json"
      ],
      "modify_scope": [
        "system://browser-release/active-activation-slot"
      ],
      "retire_or_delete_scope": [
        "deliverable://browser-release/construction-blocked-browser-authority"
      ],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://browser-release/BrowserReleaseProofManifestV1.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "actions": [
        "ACT-039"
      ],
      "outputs": [
        "deliverable://browser-release/activation-receipt.json",
        "deliverable://browser-release/previous-activation-snapshot.json"
      ],
      "consumer_migration": [
        "CON-001 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.",
        "CON-002 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.",
        "CON-003 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.",
        "CON-004 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.",
        "CON-005 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.",
        "CON-006 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.",
        "CON-007 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.",
        "CON-008 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.",
        "CON-009 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.",
        "CON-010 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.",
        "CON-011 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple."
      ],
      "acceptance_ids": [
        "ACC-039"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-040"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-040",
      "title": "执行激活后生产 readback",
      "objective": "只读安装、policy、process、extension、Host、authority slot 与业务 receipt；输出 PASS readback 或 POST_ACTIVATION_MISMATCH，不隐式取得 revoke、rollback、CAS 或 consumer 写权。",
      "owner": "production readback owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-039"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://browser-release/activation-receipt.json",
        "deliverable://browser-release/BrowserReleaseProofManifestV1.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "create_scope": [
        "deliverable://browser-release/post-activation-readback.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://browser-release/activation-receipt.json",
        "deliverable://browser-release/BrowserReleaseProofManifestV1.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "actions": [
        "ACT-040"
      ],
      "outputs": [
        "deliverable://browser-release/post-activation-readback.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-040"
      ],
      "failure_actions": [
        "Emit POST_ACTIVATION_MISMATCH and hand off only to WO-051; do not mutate authority, installation, activation slot or consumer admission in WO-040."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "On PASS hand off to WO-042; on POST_ACTIVATION_MISMATCH hand off to WO-051. No other state transition is allowed."
      ],
      "handoff_to": [
        "WO-042",
        "WO-051"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-041",
      "title": "执行全新独立只读终审",
      "objective": "独立审计者绑定同一候选和 artifact，审查法案执法面、旧路径零可达与所有 proof receipts。",
      "owner": "independent read-only audit owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-035",
        "WO-037",
        "WO-043",
        "WO-044",
        "WO-048"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://work-orders/WO-031/26-check-receipt.json",
        "deliverable://work-orders/WO-030/cross-repo-receipt.json",
        "deliverable://browser-release/artifact-set.json",
        "deliverable://browser-release/activation-tuple-candidate.json",
        "deliverable://browser-release/release-security-policy.json",
        "deliverable://browser-release/real-chrome-matrix.json",
        "deliverable://browser-release/business-workday-receipt.json",
        "deliverable://browser-release/branch-protection-readback.json",
        "deliverable://browser-release/ha-handover.json",
        "deliverable://browser-release/soak-24h.json",
        "deliverable://browser-release/soak-168h.json",
        "deliverable://browser-release/ci-full-receipt.json",
        "deliverable://browser-release/xuanxue-branch-protection-readback.json",
        "deliverable://browser-release/browser-build-input-lock.json",
        "deliverable://browser-release/sbom.spdx.json",
        "deliverable://browser-release/provenance.json",
        "deliverable://browser-release/installed-artifact-readback.json",
        "deliverable://browser-release/release-identity-signature.json",
        "deliverable://browser-release/agent-branch-protection-prestate.json",
        "deliverable://browser-release/agent-branch-protection-recovery-receipt.json",
        "deliverable://browser-release/xuanxue-branch-protection-prestate.json",
        "deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json",
        "deliverable://browser-release/constructed-release-candidate.json",
        "deliverable://construction-admission/agent-repository-governance-policy.json",
        "deliverable://construction-admission/xuanxue-repository-governance-policy.json"
      ],
      "create_scope": [
        "deliverable://browser-release/independent-audit.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://work-orders/WO-031/26-check-receipt.json",
        "deliverable://work-orders/WO-030/cross-repo-receipt.json",
        "deliverable://browser-release/artifact-set.json",
        "deliverable://browser-release/activation-tuple-candidate.json",
        "deliverable://browser-release/release-security-policy.json",
        "deliverable://browser-release/real-chrome-matrix.json",
        "deliverable://browser-release/business-workday-receipt.json",
        "deliverable://browser-release/branch-protection-readback.json",
        "deliverable://browser-release/ha-handover.json",
        "deliverable://browser-release/soak-24h.json",
        "deliverable://browser-release/soak-168h.json",
        "deliverable://browser-release/ci-full-receipt.json",
        "deliverable://browser-release/xuanxue-branch-protection-readback.json",
        "deliverable://browser-release/browser-build-input-lock.json",
        "deliverable://browser-release/sbom.spdx.json",
        "deliverable://browser-release/provenance.json",
        "deliverable://browser-release/installed-artifact-readback.json",
        "deliverable://browser-release/release-identity-signature.json",
        "deliverable://browser-release/agent-branch-protection-prestate.json",
        "deliverable://browser-release/agent-branch-protection-recovery-receipt.json",
        "deliverable://browser-release/xuanxue-branch-protection-prestate.json",
        "deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json",
        "deliverable://browser-release/constructed-release-candidate.json",
        "deliverable://construction-admission/agent-repository-governance-policy.json",
        "deliverable://construction-admission/xuanxue-repository-governance-policy.json"
      ],
      "actions": [
        "ACT-041"
      ],
      "outputs": [
        "deliverable://browser-release/independent-audit.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-041"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-038"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-042",
      "title": "最终 release approval",
      "objective": "只验证并消费 WO-044 的 candidate-bound ci-full-receipt 及全部 PASS receipts，签发 release approval；不运行 CI，不修改源码、ProofManifest、保护规则或 activation。",
      "owner": "release approval owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-040"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "ACC-040 PASS on the same candidate and tuple",
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://browser-release/BrowserReleaseProofManifestV1.json",
        "deliverable://browser-release/activation-receipt.json",
        "deliverable://browser-release/post-activation-readback.json",
        "deliverable://browser-release/independent-audit.json",
        "deliverable://browser-release/ci-full-receipt.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "create_scope": [
        "deliverable://browser-release/final-release-approval.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://browser-release/BrowserReleaseProofManifestV1.json",
        "deliverable://browser-release/activation-receipt.json",
        "deliverable://browser-release/post-activation-readback.json",
        "deliverable://browser-release/independent-audit.json",
        "deliverable://browser-release/ci-full-receipt.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "actions": [
        "ACT-042"
      ],
      "outputs": [
        "deliverable://browser-release/final-release-approval.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-042"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [],
      "terminal": true
    },
    {
      "work_order_id": "WO-046",
      "title": "建设 browserctl、launcher 与 macOS 注册面",
      "objective": "browserctl 是 install/verify/doctor/repair/enroll-profile/activate/rollback 唯一 owner；launcher、platform-macos 与 manifests 只服务该控制面。",
      "owner": "browserctl owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-013",
        "WO-014",
        "WO-015"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/browser/protocol/browser-profile-enrollment.schema.json",
        "src/lib/browser/protocol/browser-protocol.schema.json"
      ],
      "create_scope": [
        "src/lib/browser/native-messaging-host/crates/browserctl/Cargo.toml",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/install.rs",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/verify.rs",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/doctor.rs",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/repair.rs",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/enroll_profile.rs",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/activate.rs",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/rollback.rs",
        "src/lib/browser/native-messaging-host/crates/launcher/Cargo.toml",
        "src/lib/browser/native-messaging-host/crates/launcher/src/main.rs",
        "src/lib/browser/native-messaging-host/crates/platform-macos/Cargo.toml",
        "src/lib/browser/native-messaging-host/crates/platform-macos/src/registration.rs",
        "src/lib/browser/native-messaging-host/manifests/com.grasseye.browser_host.json",
        "src/lib/browser/native-messaging-host/crates/browserctl/tests/browserctl.acceptance.rs"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/browser/protocol/browser-profile-enrollment.schema.json",
        "src/lib/browser/protocol/browser-protocol.schema.json"
      ],
      "actions": [
        "ACT-046"
      ],
      "outputs": [
        "src/lib/browser/native-messaging-host/crates/browserctl/Cargo.toml",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/install.rs",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/verify.rs",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/doctor.rs",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/repair.rs",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/enroll_profile.rs",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/activate.rs",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/rollback.rs",
        "src/lib/browser/native-messaging-host/crates/launcher/Cargo.toml",
        "src/lib/browser/native-messaging-host/crates/launcher/src/main.rs",
        "src/lib/browser/native-messaging-host/crates/platform-macos/Cargo.toml",
        "src/lib/browser/native-messaging-host/crates/platform-macos/src/registration.rs",
        "src/lib/browser/native-messaging-host/manifests/com.grasseye.browser_host.json",
        "src/lib/browser/native-messaging-host/crates/browserctl/tests/browserctl.acceptance.rs"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-046"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-021",
        "WO-047"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-047",
      "title": "建设 BrowserInfrastructureSupervisor 与唯一 OwnerLock",
      "objective": "唯一 supervisor 在 bind 前取得 OwnerLock，并拥有 worker membership、handover、retry、repair、两项合法 health、唯一 error/metrics producer；不拥有业务流程。",
      "owner": "Browser infrastructure supervisor owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-016",
        "WO-021",
        "WO-046"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "src/lib/browser/transport/transport-actor.ts",
        "src/lib/browser/profile/browser-process-supervisor.ts"
      ],
      "create_scope": [
        "src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts",
        "src/lib/browser/infrastructure/browser-owner-lock.ts",
        "src/lib/browser/infrastructure/browser-worker-membership.ts",
        "src/lib/browser/infrastructure/browser-worker-handover.ts",
        "src/lib/browser/infrastructure/browser-retry-policy.ts",
        "src/lib/browser/infrastructure/browser-repair.ts",
        "src/lib/browser/infrastructure/browser-infrastructure-supervisor.acceptance.ts"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "src/lib/browser/transport/transport-actor.ts",
        "src/lib/browser/profile/browser-process-supervisor.ts"
      ],
      "actions": [
        "ACT-047"
      ],
      "outputs": [
        "src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts",
        "src/lib/browser/infrastructure/browser-owner-lock.ts",
        "src/lib/browser/infrastructure/browser-worker-membership.ts",
        "src/lib/browser/infrastructure/browser-worker-handover.ts",
        "src/lib/browser/infrastructure/browser-retry-policy.ts",
        "src/lib/browser/infrastructure/browser-repair.ts",
        "src/lib/browser/infrastructure/browser-infrastructure-supervisor.acceptance.ts"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-047"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-017"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-043",
      "title": "运行 operator-approved provider journeys 与一工作日业务基线",
      "objective": "在同一 candidate、ArtifactSet、ActivationTuple candidate、ReleaseSecurityPolicy 与 release identity signature 下完成获准 provider journeys 和 8 小时业务基线，证明零 focus theft、零 keyboard interruption、零 wrong-target、有限 pause/cancel/takeover 与零 mutation replay。",
      "owner": "business workday evidence owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-027",
        "WO-028",
        "WO-029",
        "WO-034",
        "WO-049"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://browser-release/artifact-set.json",
        "deliverable://browser-release/activation-tuple-candidate.json",
        "deliverable://browser-release/real-chrome-matrix.json",
        "deliverable://construction-admission/provider-journey-authorization.json",
        "deliverable://browser-release/release-security-policy.json",
        "deliverable://browser-release/release-identity-signature.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "create_scope": [
        "scripts/acceptance/local-browser-business-workday-terminal.acceptance.ts",
        "deliverable://browser-release/business-workday-receipt.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://browser-release/artifact-set.json",
        "deliverable://browser-release/activation-tuple-candidate.json",
        "deliverable://browser-release/real-chrome-matrix.json",
        "deliverable://construction-admission/provider-journey-authorization.json",
        "deliverable://browser-release/release-security-policy.json",
        "deliverable://browser-release/release-identity-signature.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "actions": [
        "ACT-043"
      ],
      "outputs": [
        "scripts/acceptance/local-browser-business-workday-terminal.acceptance.ts",
        "deliverable://browser-release/business-workday-receipt.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-043"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-041",
        "WO-044"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-044",
      "title": "在激活前运行唯一 ci:full",
      "objective": "只在同一 candidate/artifact/tuple/policy 的业务 receipt 完成后运行唯一 ci:full，并形成候选绑定 receipt；任何 failure 阻断 ProofManifest 与激活。",
      "owner": "CI-FULL compliance self-check owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-032",
        "WO-043"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "scripts/audit/ci-full.ts",
        "deliverable://browser-release/business-workday-receipt.json",
        "deliverable://browser-release/activation-tuple-candidate.json",
        "deliverable://browser-release/release-security-policy.json",
        "deliverable://browser-release/release-identity-signature.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "create_scope": [
        "deliverable://browser-release/ci-full-receipt.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "scripts/audit/ci-full.ts",
        "deliverable://browser-release/business-workday-receipt.json",
        "deliverable://browser-release/activation-tuple-candidate.json",
        "deliverable://browser-release/release-security-policy.json",
        "deliverable://browser-release/release-identity-signature.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "actions": [
        "ACT-044"
      ],
      "outputs": [
        "deliverable://browser-release/ci-full-receipt.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-044"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code."
      ],
      "handoff_to": [
        "WO-041"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-048",
      "title": "锁定 xuanxue-web required checks 与 branch protection",
      "objective": "Consume only deliverable://construction-admission/xuanxue-repository-governance-policy.json; sign remote pre-state, PATCH exact main strict/contexts, GET signed post-state, and restore signed pre-state plus GET on failure.",
      "owner": "xuanxue repository governance owner",
      "authorization_required": true,
      "authority_basis": [
        "用户继续授权",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-004",
        "WO-030",
        "WO-032",
        "WO-057",
        "WO-060"
      ],
      "parallel_group": "RELEASE_GOVERNANCE",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://construction-admission/xuanxue-candidate.json",
        "deliverable://work-orders/WO-030/cross-repo-receipt.json",
        "deliverable://browser-release/constructed-release-candidate.json",
        "deliverable://construction-admission/xuanxue-repository-governance-policy.json"
      ],
      "create_scope": [
        "deliverable://browser-release/xuanxue-branch-protection-prestate.json",
        "deliverable://browser-release/xuanxue-branch-protection-readback.json",
        "deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json"
      ],
      "modify_scope": [
        "system://github/ADVISION-X/xuanxue-web/branches/main/protection/required_status_checks"
      ],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://construction-admission/xuanxue-candidate.json",
        "deliverable://work-orders/WO-030/cross-repo-receipt.json",
        "deliverable://browser-release/constructed-release-candidate.json",
        "deliverable://construction-admission/xuanxue-repository-governance-policy.json"
      ],
      "actions": [
        "ACT-048A",
        "ACT-048B",
        "ACT-048C"
      ],
      "outputs": [
        "deliverable://browser-release/xuanxue-branch-protection-prestate.json",
        "deliverable://browser-release/xuanxue-branch-protection-readback.json",
        "deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-048A",
        "ACC-048B",
        "ACC-048C"
      ],
      "failure_actions": [
        "Run ACT-048C: PATCH the signed pre-state, GET again, emit deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json with RESTORED or RECOVERY_FAILED, and stop release work."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Only the signed deliverable://browser-release/xuanxue-branch-protection-prestate.json may be restored; verify exact strict/contexts readback before any retry."
      ],
      "handoff_to": [
        "WO-041"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-049",
      "title": "冻结 provider journey 与一工作日采集授权",
      "objective": "由 operator 明确账户、journey 范围、敏感动作边界、人工门、8 小时窗口和中止权限；缺失只阻断业务证据及发布链。",
      "owner": "provider journey authorization owner",
      "authorization_required": true,
      "authority_basis": [
        "用户继续授权",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [
        "DG-005"
      ],
      "depends_on": [],
      "parallel_group": "DECISION",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://construction-admission/operator-provider-journey-request.json"
      ],
      "create_scope": [
        "deliverable://construction-admission/provider-journey-authorization.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://construction-admission/operator-provider-journey-request.json"
      ],
      "actions": [
        "ACT-049"
      ],
      "outputs": [
        "deliverable://construction-admission/provider-journey-authorization.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-049"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop only the work orders that depend on this result."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard an incomplete or rejected authorization; the operator corrects the request and signs a new authorization. No remote or runtime state is mutated by this work order."
      ],
      "handoff_to": [
        "WO-043"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-050",
      "title": "签发 ArtifactSet-bound ActivationTuple 与 ReleaseSecurityPolicy",
      "objective": "读取不可变 ArtifactSet、完整 input lock、SBOM、provenance、builder 与安装 readback，签发内部绑定同一 artifact/candidate/sequence 的 ActivationTuple candidate、ReleaseSecurityPolicy 与 release identity signature。",
      "owner": "Browser release identity owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-033"
      ],
      "parallel_group": "SEQUENTIAL",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://construction-admission/external-operations.json",
        "deliverable://browser-release/browser-build-input-lock.json",
        "deliverable://browser-release/artifact-set.json",
        "deliverable://browser-release/builder-a-receipt.json",
        "deliverable://browser-release/builder-b-receipt.json",
        "deliverable://browser-release/sbom.spdx.json",
        "deliverable://browser-release/provenance.json",
        "deliverable://browser-release/installed-artifact-readback.json",
        "src/lib/browser/release/browser-activation-tuple.schema.json",
        "src/lib/browser/release/browser-release-security-policy.schema.json",
        "artifact://browser-release/controller/controller-bundle.tgz",
        "artifact://browser-release/native-host/grasseye-browser-host",
        "artifact://browser-release/browserctl/browserctl",
        "artifact://browser-release/launcher/grasseye-browser-launcher",
        "artifact://browser-release/platform-macos/libgrasseye-platform-macos.a",
        "artifact://browser-release/extension/grasseye-browser-extension.verified.crx",
        "artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json",
        "artifact://browser-release/checksums/SHA256SUMS",
        "artifact://browser-release/signatures/SHA256SUMS.sig",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "create_scope": [
        "deliverable://browser-release/activation-tuple-candidate.json",
        "deliverable://browser-release/release-security-policy.json",
        "deliverable://browser-release/release-identity-signature.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://construction-admission/external-operations.json",
        "deliverable://browser-release/browser-build-input-lock.json",
        "deliverable://browser-release/artifact-set.json",
        "deliverable://browser-release/builder-a-receipt.json",
        "deliverable://browser-release/builder-b-receipt.json",
        "deliverable://browser-release/sbom.spdx.json",
        "deliverable://browser-release/provenance.json",
        "deliverable://browser-release/installed-artifact-readback.json",
        "src/lib/browser/release/browser-activation-tuple.schema.json",
        "src/lib/browser/release/browser-release-security-policy.schema.json",
        "artifact://browser-release/controller/controller-bundle.tgz",
        "artifact://browser-release/native-host/grasseye-browser-host",
        "artifact://browser-release/browserctl/browserctl",
        "artifact://browser-release/launcher/grasseye-browser-launcher",
        "artifact://browser-release/platform-macos/libgrasseye-platform-macos.a",
        "artifact://browser-release/extension/grasseye-browser-extension.verified.crx",
        "artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json",
        "artifact://browser-release/checksums/SHA256SUMS",
        "artifact://browser-release/signatures/SHA256SUMS.sig",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "actions": [
        "ACT-050"
      ],
      "outputs": [
        "deliverable://browser-release/activation-tuple-candidate.json",
        "deliverable://browser-release/release-security-policy.json",
        "deliverable://browser-release/release-identity-signature.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-050"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard all three identity outputs together and rerun WO-050 from the same immutable WO-033 ArtifactSet; never edit an issued tuple or policy."
      ],
      "handoff_to": [
        "WO-034"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-051",
      "title": "激活失败时立即 revoke Browser authority",
      "objective": "仅由 Browser authority issuer owner 把 active authority slot 改为 ABSENT，并签发 revoke readback；不执行安装或 activation 回退。",
      "owner": "Browser authority issuer owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-040"
      ],
      "parallel_group": "RECOVERY",
      "entry_conditions": [
        "ACC-040 terminal status is POST_ACTIVATION_MISMATCH on the same candidate and tuple"
      ],
      "read_scope": [
        "deliverable://browser-release/post-activation-readback.json",
        "deliverable://browser-release/activation-receipt.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "create_scope": [
        "deliverable://browser-release/recovery-authority-revoke.json"
      ],
      "modify_scope": [
        "system://browser-authority/active-authority-slot#revoke"
      ],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://browser-release/post-activation-readback.json",
        "deliverable://browser-release/activation-receipt.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "actions": [
        "ACT-051"
      ],
      "outputs": [
        "deliverable://browser-release/recovery-authority-revoke.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-051"
      ],
      "failure_actions": [
        "Emit RECOVERY_FAILED_AUTHORITY_NOT_ABSENT and stop; do not proceed to browserctl rollback."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Retry only the idempotent revoke while the same failed authority certificate remains current; any different authority state stops the recovery chain."
      ],
      "handoff_to": [
        "WO-052"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-052",
      "title": "按 previous snapshot 回退或隔离已安装 artifact",
      "objective": "若 snapshot 为 SIGNED_PRESENT，browserctl 安装回退到 previous tuple；若为 SIGNED_ABSENT，browserctl 卸载/隔离失败新 artifact 并证明 profile/process/policy/tree 无可用 Browser authority。",
      "owner": "browserctl owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-051"
      ],
      "parallel_group": "RECOVERY",
      "entry_conditions": [
        "ACC-051 PASS and authority is ABSENT"
      ],
      "read_scope": [
        "deliverable://browser-release/recovery-authority-revoke.json",
        "deliverable://browser-release/activation-receipt.json",
        "deliverable://browser-release/previous-activation-snapshot.json",
        "deliverable://browser-release/BrowserReleaseProofManifestV1.json",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/rollback.rs",
        "artifact://browser-release/controller/controller-bundle.tgz",
        "artifact://browser-release/native-host/grasseye-browser-host",
        "artifact://browser-release/browserctl/browserctl",
        "artifact://browser-release/launcher/grasseye-browser-launcher",
        "artifact://browser-release/platform-macos/libgrasseye-platform-macos.a",
        "artifact://browser-release/extension/grasseye-browser-extension.verified.crx",
        "artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json",
        "artifact://browser-release/checksums/SHA256SUMS",
        "artifact://browser-release/signatures/SHA256SUMS.sig",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "create_scope": [
        "deliverable://browser-release/recovery-browserctl-rollback.json"
      ],
      "modify_scope": [
        "system://browser-profile/installed-artifact-state#recover-signed-present-or-absent"
      ],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://browser-release/recovery-authority-revoke.json",
        "deliverable://browser-release/activation-receipt.json",
        "deliverable://browser-release/previous-activation-snapshot.json",
        "deliverable://browser-release/BrowserReleaseProofManifestV1.json",
        "src/lib/browser/native-messaging-host/crates/browserctl/src/rollback.rs",
        "artifact://browser-release/controller/controller-bundle.tgz",
        "artifact://browser-release/native-host/grasseye-browser-host",
        "artifact://browser-release/browserctl/browserctl",
        "artifact://browser-release/launcher/grasseye-browser-launcher",
        "artifact://browser-release/platform-macos/libgrasseye-platform-macos.a",
        "artifact://browser-release/extension/grasseye-browser-extension.verified.crx",
        "artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json",
        "artifact://browser-release/checksums/SHA256SUMS",
        "artifact://browser-release/signatures/SHA256SUMS.sig",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "actions": [
        "ACT-052"
      ],
      "outputs": [
        "deliverable://browser-release/recovery-browserctl-rollback.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-052"
      ],
      "failure_actions": [
        "Emit RECOVERY_FAILED_INSTALLATION and stop; authority remains ABSENT."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Repeat only when installed tuple still equals failed new tuple or already equals signed previous tuple; a third identity stops recovery."
      ],
      "handoff_to": [
        "WO-053"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-053",
      "title": "CAS active slot 回 previous tuple 或 ABSENT",
      "objective": "仅由 activation owner 把 active slot 从失败新 tuple CAS 到 SIGNED_PRESENT 的 previous tuple，或 CAS 到 SIGNED_ABSENT。",
      "owner": "release activation owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-052"
      ],
      "parallel_group": "RECOVERY",
      "entry_conditions": [
        "ACC-052 PASS and signed previous tuple satisfies signature, revocation and minimum-sequence policy"
      ],
      "read_scope": [
        "deliverable://browser-release/recovery-browserctl-rollback.json",
        "deliverable://browser-release/activation-receipt.json",
        "deliverable://browser-release/previous-activation-snapshot.json",
        "deliverable://browser-release/release-security-policy.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "create_scope": [
        "deliverable://browser-release/recovery-active-slot-cas.json"
      ],
      "modify_scope": [
        "system://browser-release/active-activation-slot#rollback-present-or-absent"
      ],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://browser-release/recovery-browserctl-rollback.json",
        "deliverable://browser-release/activation-receipt.json",
        "deliverable://browser-release/previous-activation-snapshot.json",
        "deliverable://browser-release/release-security-policy.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "actions": [
        "ACT-053"
      ],
      "outputs": [
        "deliverable://browser-release/recovery-active-slot-cas.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-053"
      ],
      "failure_actions": [
        "Emit RECOVERY_FAILED_ACTIVE_SLOT and stop; authority remains ABSENT and consumers remain blocked."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Repeat only when slot equals failed new tuple or already equals signed previous tuple; any third value stops recovery."
      ],
      "handoff_to": [
        "WO-054"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-054",
      "title": "把全部 Browser consumer admission 回写为 BLOCKED",
      "objective": "仅由 Local Runtime Browser admission owner 在 previous tuple CAS readback 后关闭 CON-001..CON-011 的 Browser admission，并证明没有业务副作用。",
      "owner": "local-runtime owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-053"
      ],
      "parallel_group": "RECOVERY",
      "entry_conditions": [
        "ACC-053 PASS and authority remains ABSENT"
      ],
      "read_scope": [
        "deliverable://browser-release/recovery-active-slot-cas.json",
        "deliverable://browser-release/recovery-authority-revoke.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "create_scope": [
        "deliverable://browser-release/recovery-consumer-blocked.json"
      ],
      "modify_scope": [
        "system://workbench/browser-consumer-admission#construction-blocked"
      ],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://browser-release/recovery-active-slot-cas.json",
        "deliverable://browser-release/recovery-authority-revoke.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "actions": [
        "ACT-054"
      ],
      "outputs": [
        "deliverable://browser-release/recovery-consumer-blocked.json"
      ],
      "consumer_migration": [
        "CON-001..CON-011 are explicitly read back as BLOCKED; capability and plugin business state owners are not mutated."
      ],
      "acceptance_ids": [
        "ACC-054"
      ],
      "failure_actions": [
        "Emit RECOVERY_FAILED_CONSUMER_ADMISSION and stop; no Browser consumer may run."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Repeat only to converge the same eleven named consumer admissions to BLOCKED; adding an unnamed consumer stops recovery."
      ],
      "handoff_to": [
        "WO-055"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-055",
      "title": "独立读回完整 rollback 终态",
      "objective": "独立验证 authority ABSENT、SIGNED_PRESENT 时 previous tuple 已安装且 active，或 SIGNED_ABSENT 时无可用 Browser artifact 且 slot 为 ABSENT；两分支均要求 CON-001..CON-011 BLOCKED。",
      "owner": "production recovery readback owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-054"
      ],
      "parallel_group": "RECOVERY",
      "entry_conditions": [
        "ACC-054 PASS on the same failed activation and signed previous tuple"
      ],
      "read_scope": [
        "deliverable://browser-release/recovery-authority-revoke.json",
        "deliverable://browser-release/recovery-browserctl-rollback.json",
        "deliverable://browser-release/recovery-active-slot-cas.json",
        "deliverable://browser-release/recovery-consumer-blocked.json",
        "deliverable://browser-release/previous-activation-snapshot.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "create_scope": [
        "deliverable://browser-release/post-rollback-readback.json",
        "deliverable://browser-release/new-attempt-admission.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://browser-release/recovery-authority-revoke.json",
        "deliverable://browser-release/recovery-browserctl-rollback.json",
        "deliverable://browser-release/recovery-active-slot-cas.json",
        "deliverable://browser-release/recovery-consumer-blocked.json",
        "deliverable://browser-release/previous-activation-snapshot.json",
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "actions": [
        "ACT-055"
      ],
      "outputs": [
        "deliverable://browser-release/post-rollback-readback.json",
        "deliverable://browser-release/new-attempt-admission.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-055"
      ],
      "failure_actions": [
        "Emit RECOVERY_TERMINAL_BLOCKED; retain authority ABSENT and all consumers BLOCKED."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "A future separately authorized attempt may consume new-attempt-admission.json and restart from the earliest invalidated producer; it may not reuse the failed ProofManifest or automatically reactivate."
      ],
      "handoff_to": [],
      "terminal": true
    },
    {
      "work_order_id": "WO-056",
      "title": "由 AGENT repository governance owner 签发精确治理策略",
      "objective": "签发 ADVISION-X/AGENT main 的 repo、branch、strict、exact contexts、construction branch commit/push 权限、expected remote ref、保护规则变更权限与恢复权限。",
      "owner": "AGENT repository governance owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [
        "DG-006"
      ],
      "depends_on": [],
      "parallel_group": "DECISION",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://construction-admission/agent-repository-governance-request.json"
      ],
      "create_scope": [
        "deliverable://construction-admission/agent-repository-governance-policy.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://construction-admission/agent-repository-governance-request.json"
      ],
      "actions": [
        "ACT-056"
      ],
      "outputs": [
        "deliverable://construction-admission/agent-repository-governance-policy.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-056"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard unsigned or incomplete policy; the AGENT repository governance owner corrects and re-signs the request."
      ],
      "handoff_to": [
        "WO-035",
        "WO-058"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-057",
      "title": "由 xuanxue repository governance owner 签发精确治理策略",
      "objective": "签发 ADVISION-X/xuanxue-web main 的 repo、branch、strict、exact contexts、construction branch commit/push 权限、expected remote ref、保护规则变更权限与恢复权限。",
      "owner": "xuanxue repository governance owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [
        "DG-007"
      ],
      "depends_on": [],
      "parallel_group": "DECISION",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://construction-admission/xuanxue-repository-governance-request.json"
      ],
      "create_scope": [
        "deliverable://construction-admission/xuanxue-repository-governance-policy.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://construction-admission/xuanxue-repository-governance-request.json"
      ],
      "actions": [
        "ACT-057"
      ],
      "outputs": [
        "deliverable://construction-admission/xuanxue-repository-governance-policy.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-057"
      ],
      "failure_actions": [
        "Emit a candidate-bound FAIL receipt and stop dependent work orders."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Discard unsigned or incomplete policy; the xuanxue repository governance owner corrects and re-signs the request."
      ],
      "handoff_to": [
        "WO-048",
        "WO-059"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-058",
      "title": "冻结施工后 AGENT release candidate",
      "objective": "在所有 AGENT 源码、audit 与 acceptance 建设完成后，生成 content-addressed tree/build-input manifest 与 source bundle；在获准 construction branch 上 commit/push，并以 git ls-remote 读回相同 SHA。",
      "owner": "AGENT repository governance owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-032",
        "WO-056"
      ],
      "parallel_group": "CANDIDATE_FREEZE",
      "entry_conditions": [
        "ACC-032 PASS",
        "ACC-056 PASS authorizes exact construction branch commit/push and expected remote ref"
      ],
      "read_scope": [
        "deliverable://construction-admission/agent-repository-governance-policy.json",
        "system://git/ADVISION-X/AGENT/worktree-and-index",
        "package.json",
        "package-lock.json",
        "tsconfig.json"
      ],
      "create_scope": [
        "deliverable://browser-release/agent-constructed-tree-manifest.json",
        "deliverable://browser-release/agent-build-input-manifest.json",
        "deliverable://browser-release/agent-constructed-source-bundle.tar.zst",
        "deliverable://browser-release/agent-constructed-candidate.json",
        "deliverable://browser-release/agent-remote-candidate-readback.json"
      ],
      "modify_scope": [
        "system://git/ADVISION-X/AGENT/refs/heads/codex/browser-greenfield"
      ],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://construction-admission/agent-repository-governance-policy.json",
        "system://git/ADVISION-X/AGENT/worktree-and-index",
        "package.json",
        "package-lock.json",
        "tsconfig.json"
      ],
      "actions": [
        "ACT-058"
      ],
      "outputs": [
        "deliverable://browser-release/agent-constructed-tree-manifest.json",
        "deliverable://browser-release/agent-build-input-manifest.json",
        "deliverable://browser-release/agent-constructed-source-bundle.tar.zst",
        "deliverable://browser-release/agent-constructed-candidate.json",
        "deliverable://browser-release/agent-remote-candidate-readback.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-058"
      ],
      "failure_actions": [
        "Do not build or change main protection; restore neither old Browser code nor an unverified remote ref."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Correct the construction tree, rerun all invalidated checks, then create a new content manifest and push with the policy's expected-old-ref lease."
      ],
      "handoff_to": [
        "WO-060"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-059",
      "title": "冻结施工后 xuanxue release candidate",
      "objective": "在 xuanxue 三条授权路径和跨仓验收完成后，生成 content-addressed tree/source bundle；在获准 construction branch 上 commit/push，并以 git ls-remote 读回相同 SHA。",
      "owner": "xuanxue repository governance owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-032",
        "WO-057"
      ],
      "parallel_group": "CANDIDATE_FREEZE",
      "entry_conditions": [
        "ACC-032 PASS includes cross-repo contract checks",
        "ACC-057 PASS authorizes exact construction branch commit/push and expected remote ref"
      ],
      "read_scope": [
        "deliverable://construction-admission/xuanxue-repository-governance-policy.json",
        "system://git/ADVISION-X/xuanxue-web/worktree-and-index",
        "deliverable://work-orders/WO-030/cross-repo-receipt.json"
      ],
      "create_scope": [
        "deliverable://browser-release/xuanxue-constructed-tree-manifest.json",
        "deliverable://browser-release/xuanxue-constructed-source-bundle.tar.zst",
        "deliverable://browser-release/xuanxue-constructed-candidate.json",
        "deliverable://browser-release/xuanxue-remote-candidate-readback.json"
      ],
      "modify_scope": [
        "system://git/ADVISION-X/xuanxue-web/refs/heads/codex/browser-greenfield"
      ],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://construction-admission/xuanxue-repository-governance-policy.json",
        "system://git/ADVISION-X/xuanxue-web/worktree-and-index",
        "deliverable://work-orders/WO-030/cross-repo-receipt.json"
      ],
      "actions": [
        "ACT-059"
      ],
      "outputs": [
        "deliverable://browser-release/xuanxue-constructed-tree-manifest.json",
        "deliverable://browser-release/xuanxue-constructed-source-bundle.tar.zst",
        "deliverable://browser-release/xuanxue-constructed-candidate.json",
        "deliverable://browser-release/xuanxue-remote-candidate-readback.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-059"
      ],
      "failure_actions": [
        "Do not build, mutate main protection or produce Dynamic Proof from an unverified candidate."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Correct only the three authorized paths, rerun invalidated checks, then create a new content manifest and push with the policy's expected-old-ref lease."
      ],
      "handoff_to": [
        "WO-060"
      ],
      "terminal": false
    },
    {
      "work_order_id": "WO-060",
      "title": "签发双仓 constructed release candidate",
      "objective": "把施工后 AGENT 与 xuanxue 的 clean tree、commit SHA、remote SHA、content manifests 与 cross-repo contract hash 组合成唯一 constructed-release-candidate identity。",
      "owner": "cross-repo release candidate owner",
      "authorization_required": true,
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ],
      "decision_gates": [],
      "depends_on": [
        "WO-058",
        "WO-059"
      ],
      "parallel_group": "CANDIDATE_FREEZE",
      "entry_conditions": [
        "Named dependencies and decision gates are PASS on the same candidate"
      ],
      "read_scope": [
        "deliverable://browser-release/agent-constructed-tree-manifest.json",
        "deliverable://browser-release/agent-constructed-candidate.json",
        "deliverable://browser-release/agent-remote-candidate-readback.json",
        "deliverable://browser-release/xuanxue-constructed-tree-manifest.json",
        "deliverable://browser-release/xuanxue-constructed-candidate.json",
        "deliverable://browser-release/xuanxue-remote-candidate-readback.json",
        "deliverable://work-orders/WO-030/cross-repo-receipt.json"
      ],
      "create_scope": [
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "modify_scope": [],
      "retire_or_delete_scope": [],
      "forbidden_scope": [
        "active law changes",
        "generated artifact manual edits",
        "bridge/fallback/shadow Browser runtime",
        "second Browser transport/controller/election/receipt/audit runner",
        "unrelated business behavior changes"
      ],
      "inputs": [
        "deliverable://browser-release/agent-constructed-tree-manifest.json",
        "deliverable://browser-release/agent-constructed-candidate.json",
        "deliverable://browser-release/agent-remote-candidate-readback.json",
        "deliverable://browser-release/xuanxue-constructed-tree-manifest.json",
        "deliverable://browser-release/xuanxue-constructed-candidate.json",
        "deliverable://browser-release/xuanxue-remote-candidate-readback.json",
        "deliverable://work-orders/WO-030/cross-repo-receipt.json"
      ],
      "actions": [
        "ACT-060"
      ],
      "outputs": [
        "deliverable://browser-release/constructed-release-candidate.json"
      ],
      "consumer_migration": [
        "No unnamed consumer handoff is permitted."
      ],
      "acceptance_ids": [
        "ACC-060"
      ],
      "failure_actions": [
        "Invalidate both constructed candidates; no ArtifactSet, CI, branch mutation, Chrome, HA, provider, proof or activation may proceed."
      ],
      "stop_conditions": [
        "Candidate, owner, interface or authority drift stops this work order."
      ],
      "rollback_or_recovery": [
        "Rerun the changed repository's freeze work order and sign a new composite identity; never edit an issued composite candidate."
      ],
      "handoff_to": [
        "WO-033",
        "WO-035",
        "WO-048"
      ],
      "terminal": false
    }
  ],
  "file_operations": [
    {
      "operation_id": "OP-002-001",
      "work_order_id": "WO-002",
      "owner": "project authorization owner",
      "object_type": "file",
      "target": "AGENTS.md",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-002-002",
      "work_order_id": "WO-002",
      "owner": "project authorization owner",
      "object_type": "file",
      "target": ".github/instructions/agent-rules/modules/module-local-browser-session.instructions.md",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-002-003",
      "work_order_id": "WO-002",
      "owner": "project authorization owner",
      "object_type": "file",
      "target": "docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-002-004",
      "work_order_id": "WO-002",
      "owner": "project authorization owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/user-browser-scope-authorization.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-002-005",
      "work_order_id": "WO-002",
      "owner": "project authorization owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/agent-candidate.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-003-001",
      "work_order_id": "WO-003",
      "owner": "release operations owner",
      "object_type": "file",
      "target": "docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-003-002",
      "work_order_id": "WO-003",
      "owner": "release operations owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/external-operations.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-004-001",
      "work_order_id": "WO-004",
      "owner": "xuanxue repository authority owner",
      "object_type": "file",
      "target": "/Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/browser-authority-proof-contract.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-004-002",
      "work_order_id": "WO-004",
      "owner": "xuanxue repository authority owner",
      "object_type": "file",
      "target": "/Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/collector-contracts.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-004-003",
      "work_order_id": "WO-004",
      "owner": "xuanxue repository authority owner",
      "object_type": "file",
      "target": "/Users/nexgen/Documents/xuanxue-web/scripts/audit/domains/dynamic-proof/dynamic-agent-receipt-inspection.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-004-004",
      "work_order_id": "WO-004",
      "owner": "xuanxue repository authority owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/xuanxue-candidate.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-005-001",
      "work_order_id": "WO-005",
      "owner": "Browser retirement inventory owner",
      "object_type": "file",
      "target": "git-tree://60cfcf512ecdae0ed27d001d40b6293ae53e5cc6/src/lib/browser",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-005-002",
      "work_order_id": "WO-005",
      "owner": "Browser retirement inventory owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-browser-support.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-005-003",
      "work_order_id": "WO-005",
      "owner": "Browser retirement inventory owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-video-download-support.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-005-004",
      "work_order_id": "WO-005",
      "owner": "Browser retirement inventory owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-ai-gateway-support.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-005-005",
      "work_order_id": "WO-005",
      "owner": "Browser retirement inventory owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-assembly.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-005-006",
      "work_order_id": "WO-005",
      "owner": "Browser retirement inventory owner",
      "object_type": "file",
      "target": "scripts/acceptance/local-browser-plan-harness.self-test.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-005-007",
      "work_order_id": "WO-005",
      "owner": "Browser retirement inventory owner",
      "object_type": "file",
      "target": "scripts/acceptance/local-browser-plan-gates.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-005-008",
      "work_order_id": "WO-005",
      "owner": "Browser retirement inventory owner",
      "object_type": "file",
      "target": "scripts/acceptance/local-browser-retirement-inventory.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-005-009",
      "work_order_id": "WO-005",
      "owner": "Browser retirement inventory owner",
      "object_type": "file",
      "target": "scripts/acceptance/local-browser-consumer-registry.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-005-010",
      "work_order_id": "WO-005",
      "owner": "Browser retirement inventory owner",
      "object_type": "file",
      "target": "scripts/acceptance/local-browser-work-order-receipt.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-005-011",
      "work_order_id": "WO-005",
      "owner": "Browser retirement inventory owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-retirement/file-classification.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-005-012",
      "work_order_id": "WO-005",
      "owner": "Browser retirement inventory owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-retirement/consumer-registry.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-006-001",
      "work_order_id": "WO-006",
      "owner": "project authorization owner",
      "object_type": "file",
      "target": ".github/instructions/agent-rules/modules/module-local-browser-session.instructions.md",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-006-002",
      "work_order_id": "WO-006",
      "owner": "project authorization owner",
      "object_type": "file",
      "target": "docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-006-003",
      "work_order_id": "WO-006",
      "owner": "project authorization owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/browser-canonical-path.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-007-001",
      "work_order_id": "WO-007",
      "owner": "real Chrome evidence owner",
      "object_type": "file",
      "target": "scripts/acceptance/xuanxue-ai-production.real-chrome.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-007-002",
      "work_order_id": "WO-007",
      "owner": "real Chrome evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-observation/preconstruction-chrome.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-008-001",
      "work_order_id": "WO-008",
      "owner": "Browser retirement inventory owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-retirement/file-classification.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-008-002",
      "work_order_id": "WO-008",
      "owner": "Browser retirement inventory owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-retirement/consumer-registry.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-008-003",
      "work_order_id": "WO-008",
      "owner": "Browser retirement inventory owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/browser-canonical-path.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-008-004",
      "work_order_id": "WO-008",
      "owner": "Browser retirement inventory owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-observation/preconstruction-chrome.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-008-005",
      "work_order_id": "WO-008",
      "owner": "Browser retirement inventory owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/browser-demolition.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-008-006",
      "work_order_id": "WO-008",
      "owner": "Browser retirement inventory owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-retirement/cutover-ledger.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-009-001",
      "work_order_id": "WO-009",
      "owner": "Browser owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/browser-demolition.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-009-002",
      "work_order_id": "WO-009",
      "owner": "Browser owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-retirement/cutover-ledger.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-009-003",
      "work_order_id": "WO-009",
      "owner": "Browser owner",
      "object_type": "deliverable",
      "target": "deliverable://work-orders/WO-009/receipt.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-009-004",
      "work_order_id": "WO-009",
      "owner": "Browser owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-retirement/file-classification.json#delete_targets",
      "operation": "DELETE",
      "consumer_ids": [
        "CON-001",
        "CON-002",
        "CON-003",
        "CON-004",
        "CON-005",
        "CON-006",
        "CON-007",
        "CON-008",
        "CON-009",
        "CON-010",
        "CON-011"
      ],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-010-001",
      "work_order_id": "WO-010",
      "owner": "local-runtime owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-retirement/cutover-ledger.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-010-002",
      "work_order_id": "WO-010",
      "owner": "local-runtime owner",
      "object_type": "deliverable",
      "target": "deliverable://work-orders/WO-010/receipt.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-010-003",
      "work_order_id": "WO-010",
      "owner": "local-runtime owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-browser-support.ts",
      "operation": "DELETE",
      "consumer_ids": [
        "CON-001"
      ],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-010-004",
      "work_order_id": "WO-010",
      "owner": "local-runtime owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-video-download-support.ts",
      "operation": "DELETE",
      "consumer_ids": [
        "CON-002"
      ],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-011-001",
      "work_order_id": "WO-011",
      "owner": "acceptance owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-retirement/cutover-ledger.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-011-002",
      "work_order_id": "WO-011",
      "owner": "acceptance owner",
      "object_type": "deliverable",
      "target": "deliverable://work-orders/WO-011/receipt.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-011-003",
      "work_order_id": "WO-011",
      "owner": "acceptance owner",
      "object_type": "file",
      "target": "scripts/acceptance/local-browser-artifact-contract.acceptance.ts",
      "operation": "DELETE",
      "consumer_ids": [
        "CON-011"
      ],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-011-004",
      "work_order_id": "WO-011",
      "owner": "acceptance owner",
      "object_type": "file",
      "target": "scripts/acceptance/local-browser-atomic-cutover.acceptance.ts",
      "operation": "DELETE",
      "consumer_ids": [
        "CON-011"
      ],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-011-005",
      "work_order_id": "WO-011",
      "owner": "acceptance owner",
      "object_type": "file",
      "target": "scripts/acceptance/local-browser-business-workday.acceptance.ts",
      "operation": "DELETE",
      "consumer_ids": [
        "CON-011"
      ],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-011-006",
      "work_order_id": "WO-011",
      "owner": "acceptance owner",
      "object_type": "file",
      "target": "scripts/acceptance/local-browser-exact-target-contract.acceptance.ts",
      "operation": "DELETE",
      "consumer_ids": [
        "CON-011"
      ],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-011-007",
      "work_order_id": "WO-011",
      "owner": "acceptance owner",
      "object_type": "file",
      "target": "scripts/acceptance/local-browser-native-transport.acceptance.ts",
      "operation": "DELETE",
      "consumer_ids": [
        "CON-011"
      ],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-011-008",
      "work_order_id": "WO-011",
      "owner": "acceptance owner",
      "object_type": "file",
      "target": "scripts/acceptance/local-browser-real-chrome-scenarios.acceptance.ts",
      "operation": "DELETE",
      "consumer_ids": [
        "CON-011"
      ],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-011-009",
      "work_order_id": "WO-011",
      "owner": "acceptance owner",
      "object_type": "file",
      "target": "scripts/acceptance/local-browser-real-chrome.acceptance.ts",
      "operation": "DELETE",
      "consumer_ids": [
        "CON-011"
      ],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-011-010",
      "work_order_id": "WO-011",
      "owner": "acceptance owner",
      "object_type": "file",
      "target": "scripts/acceptance/local-browser-target-actions.acceptance.ts",
      "operation": "DELETE",
      "consumer_ids": [
        "CON-011"
      ],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-012-001",
      "work_order_id": "WO-012",
      "owner": "Browser protocol owner",
      "object_type": "deliverable",
      "target": "deliverable://work-orders/WO-009/receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-012-002",
      "work_order_id": "WO-012",
      "owner": "Browser protocol owner",
      "object_type": "deliverable",
      "target": "deliverable://work-orders/WO-010/receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-012-003",
      "work_order_id": "WO-012",
      "owner": "Browser protocol owner",
      "object_type": "deliverable",
      "target": "deliverable://work-orders/WO-011/receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-012-004",
      "work_order_id": "WO-012",
      "owner": "Browser protocol owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/browser-protocol.schema.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-012-005",
      "work_order_id": "WO-012",
      "owner": "Browser protocol owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/browser-authority-certificate.schema.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-012-006",
      "work_order_id": "WO-012",
      "owner": "Browser protocol owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/browser-authority-liveness-lease.schema.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-012-007",
      "work_order_id": "WO-012",
      "owner": "Browser protocol owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/browser-profile-enrollment.schema.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-012-008",
      "work_order_id": "WO-012",
      "owner": "Browser protocol owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/browser-file-artifact-grant.schema.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-012-009",
      "work_order_id": "WO-012",
      "owner": "Browser protocol owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/browser-capabilities.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-012-010",
      "work_order_id": "WO-012",
      "owner": "Browser protocol owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/browser-errors.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-012-011",
      "work_order_id": "WO-012",
      "owner": "Browser protocol owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/browser-protocol-schema.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-013-001",
      "work_order_id": "WO-013",
      "owner": "Browser protocol codegen owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/browser-protocol.schema.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-013-002",
      "work_order_id": "WO-013",
      "owner": "Browser protocol codegen owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/browser-protocol-schema.acceptance.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-013-003",
      "work_order_id": "WO-013",
      "owner": "Browser protocol codegen owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/generated/browser-protocol.generated.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-013-004",
      "work_order_id": "WO-013",
      "owner": "Browser protocol codegen owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-013-005",
      "work_order_id": "WO-013",
      "owner": "Browser protocol codegen owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/browser-protocol-codegen.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-014-001",
      "work_order_id": "WO-014",
      "owner": "Native Host owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/generated/browser-protocol.generated.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-014-002",
      "work_order_id": "WO-014",
      "owner": "Native Host owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-014-003",
      "work_order_id": "WO-014",
      "owner": "Native Host owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/Cargo.toml",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-014-004",
      "work_order_id": "WO-014",
      "owner": "Native Host owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/host/Cargo.toml",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-014-005",
      "work_order_id": "WO-014",
      "owner": "Native Host owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/host/src/main.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-014-006",
      "work_order_id": "WO-014",
      "owner": "Native Host owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/host/src/browser-native-framing.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-014-007",
      "work_order_id": "WO-014",
      "owner": "Native Host owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/host/src/raw-channel.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-014-008",
      "work_order_id": "WO-014",
      "owner": "Native Host owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/host/src/authenticated-channel.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-014-009",
      "work_order_id": "WO-014",
      "owner": "Native Host owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/host/src/transcript.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-014-010",
      "work_order_id": "WO-014",
      "owner": "Native Host owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/host/src/artifact-stream.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-014-011",
      "work_order_id": "WO-014",
      "owner": "Native Host owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/host/tests/native-host.acceptance.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-014-012",
      "work_order_id": "WO-014",
      "owner": "Native Host owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/Cargo.lock",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-014-013",
      "work_order_id": "WO-014",
      "owner": "Native Host owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/host/fuzz/Cargo.toml",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-014-014",
      "work_order_id": "WO-014",
      "owner": "Native Host owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/host/fuzz/fuzz_targets/native_framing.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-014-015",
      "work_order_id": "WO-014",
      "owner": "Native Host owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/host/fuzz/corpus/native_framing/seed.bin",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-015-001",
      "work_order_id": "WO-015",
      "owner": "MV3 Extension owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/generated/browser-protocol.generated.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-015-002",
      "work_order_id": "WO-015",
      "owner": "MV3 Extension owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-015-003",
      "work_order_id": "WO-015",
      "owner": "MV3 Extension owner",
      "object_type": "file",
      "target": "src/lib/browser/chrome-extension/manifest.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-015-004",
      "work_order_id": "WO-015",
      "owner": "MV3 Extension owner",
      "object_type": "file",
      "target": "src/lib/browser/chrome-extension/service-worker.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-015-005",
      "work_order_id": "WO-015",
      "owner": "MV3 Extension owner",
      "object_type": "file",
      "target": "src/lib/browser/chrome-extension/native-port-actor.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-015-006",
      "work_order_id": "WO-015",
      "owner": "MV3 Extension owner",
      "object_type": "file",
      "target": "src/lib/browser/chrome-extension/command-registry.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-015-007",
      "work_order_id": "WO-015",
      "owner": "MV3 Extension owner",
      "object_type": "file",
      "target": "src/lib/browser/chrome-extension/command-permit-validator.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-015-008",
      "work_order_id": "WO-015",
      "owner": "MV3 Extension owner",
      "object_type": "file",
      "target": "src/lib/browser/chrome-extension/debugger-runtime.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-015-009",
      "work_order_id": "WO-015",
      "owner": "MV3 Extension owner",
      "object_type": "file",
      "target": "src/lib/browser/chrome-extension/exact-target-runtime.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-015-010",
      "work_order_id": "WO-015",
      "owner": "MV3 Extension owner",
      "object_type": "file",
      "target": "src/lib/browser/chrome-extension/dom-intent-runtime.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-015-011",
      "work_order_id": "WO-015",
      "owner": "MV3 Extension owner",
      "object_type": "file",
      "target": "src/lib/browser/chrome-extension/artifact-stream.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-015-012",
      "work_order_id": "WO-015",
      "owner": "MV3 Extension owner",
      "object_type": "file",
      "target": "src/lib/browser/chrome-extension/authenticated-heartbeat.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-015-013",
      "work_order_id": "WO-015",
      "owner": "MV3 Extension owner",
      "object_type": "file",
      "target": "src/lib/browser/chrome-extension/extension.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-016-001",
      "work_order_id": "WO-016",
      "owner": "Browser transport owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/Cargo.toml",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-016-002",
      "work_order_id": "WO-016",
      "owner": "Browser transport owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/host/src/main.rs",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-016-003",
      "work_order_id": "WO-016",
      "owner": "Browser transport owner",
      "object_type": "file",
      "target": "src/lib/browser/chrome-extension/manifest.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-016-004",
      "work_order_id": "WO-016",
      "owner": "Browser transport owner",
      "object_type": "file",
      "target": "src/lib/browser/chrome-extension/service-worker.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-016-005",
      "work_order_id": "WO-016",
      "owner": "Browser transport owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/raw-controller-host-channel.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-016-006",
      "work_order_id": "WO-016",
      "owner": "Browser transport owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/authenticated-controller-host-channel.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-016-007",
      "work_order_id": "WO-016",
      "owner": "Browser transport owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/transport-event.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-016-008",
      "work_order_id": "WO-016",
      "owner": "Browser transport owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/transport-reducer.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-016-009",
      "work_order_id": "WO-016",
      "owner": "Browser transport owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/transport-actor.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-016-010",
      "work_order_id": "WO-016",
      "owner": "Browser transport owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/transport-authenticator.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-016-011",
      "work_order_id": "WO-016",
      "owner": "Browser transport owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/transport-transcript.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-016-012",
      "work_order_id": "WO-016",
      "owner": "Browser transport owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/authenticated-heartbeat.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-016-013",
      "work_order_id": "WO-016",
      "owner": "Browser transport owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/browser-native-framing.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-016-014",
      "work_order_id": "WO-016",
      "owner": "Browser transport owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/browser-transport.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-017-001",
      "work_order_id": "WO-017",
      "owner": "Browser authority issuer owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/transport-event.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-017-002",
      "work_order_id": "WO-017",
      "owner": "Browser authority issuer owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/transport-reducer.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-017-003",
      "work_order_id": "WO-017",
      "owner": "Browser authority issuer owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-authority-lease.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-017-004",
      "work_order_id": "WO-017",
      "owner": "Browser authority issuer owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-authority-issuer.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-017-005",
      "work_order_id": "WO-017",
      "owner": "Browser authority issuer owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-authority-certificate.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-017-006",
      "work_order_id": "WO-017",
      "owner": "Browser authority issuer owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-authority-liveness-lease.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-017-007",
      "work_order_id": "WO-017",
      "owner": "Browser authority issuer owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-control-state.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-017-008",
      "work_order_id": "WO-017",
      "owner": "Browser authority issuer owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-authority-issuer.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-018-001",
      "work_order_id": "WO-018",
      "owner": "Browser broker owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-authority-certificate.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-018-002",
      "work_order_id": "WO-018",
      "owner": "Browser broker owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-authority-issuer.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-018-003",
      "work_order_id": "WO-018",
      "owner": "Browser broker owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-authority-broker.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-018-004",
      "work_order_id": "WO-018",
      "owner": "Browser broker owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-018-005",
      "work_order_id": "WO-018",
      "owner": "Browser broker owner",
      "object_type": "file",
      "target": "src/lib/browser/browser-authority-api.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-019-001",
      "work_order_id": "WO-019",
      "owner": "Browser target lease owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-authority-broker.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-019-002",
      "work_order_id": "WO-019",
      "owner": "Browser target lease owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-019-003",
      "work_order_id": "WO-019",
      "owner": "Browser target lease owner",
      "object_type": "file",
      "target": "src/lib/browser/exact-target/browser-target-ref.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-019-004",
      "work_order_id": "WO-019",
      "owner": "Browser target lease owner",
      "object_type": "file",
      "target": "src/lib/browser/exact-target/browser-document-ref.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-019-005",
      "work_order_id": "WO-019",
      "owner": "Browser target lease owner",
      "object_type": "file",
      "target": "src/lib/browser/exact-target/browser-target-lease.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-019-006",
      "work_order_id": "WO-019",
      "owner": "Browser target lease owner",
      "object_type": "file",
      "target": "src/lib/browser/exact-target/browser-target-lease-manager.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-019-007",
      "work_order_id": "WO-019",
      "owner": "Browser target lease owner",
      "object_type": "file",
      "target": "src/lib/browser/exact-target/browser-target-lease.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-020-001",
      "work_order_id": "WO-020",
      "owner": "Browser command owner",
      "object_type": "file",
      "target": "src/lib/browser/exact-target/browser-target-lease.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-020-002",
      "work_order_id": "WO-020",
      "owner": "Browser command owner",
      "object_type": "file",
      "target": "src/lib/browser/exact-target/browser-target-lease-manager.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-020-003",
      "work_order_id": "WO-020",
      "owner": "Browser command owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/command-permit.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-020-004",
      "work_order_id": "WO-020",
      "owner": "Browser command owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/reply-channel-token.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-020-005",
      "work_order_id": "WO-020",
      "owner": "Browser command owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/browser-command-admission-budget.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-020-006",
      "work_order_id": "WO-020",
      "owner": "Browser command owner",
      "object_type": "file",
      "target": "src/lib/browser/exact-target/browser-command-actor.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-020-007",
      "work_order_id": "WO-020",
      "owner": "Browser command owner",
      "object_type": "file",
      "target": "src/lib/browser/exact-target/browser-mutation-intent-journal.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-020-008",
      "work_order_id": "WO-020",
      "owner": "Browser command owner",
      "object_type": "file",
      "target": "src/lib/browser/exact-target/browser-dom-intent.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-020-009",
      "work_order_id": "WO-020",
      "owner": "Browser command owner",
      "object_type": "file",
      "target": "src/lib/browser/exact-target/browser-file-artifact-grant.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-020-010",
      "work_order_id": "WO-020",
      "owner": "Browser command owner",
      "object_type": "file",
      "target": "src/lib/browser/exact-target/browser-artifact-stream.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-020-011",
      "work_order_id": "WO-020",
      "owner": "Browser command owner",
      "object_type": "file",
      "target": "src/lib/browser/exact-target/browser-command.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-021-001",
      "work_order_id": "WO-021",
      "owner": "Browser profile owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/browser-profile-enrollment.schema.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-021-002",
      "work_order_id": "WO-021",
      "owner": "Browser profile owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/browserctl/src/enroll_profile.rs",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-021-003",
      "work_order_id": "WO-021",
      "owner": "Browser profile owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/browser-canonical-path.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-021-004",
      "work_order_id": "WO-021",
      "owner": "Browser profile owner",
      "object_type": "file",
      "target": "src/lib/browser/profile/browser-profile-enrollment.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-021-005",
      "work_order_id": "WO-021",
      "owner": "Browser profile owner",
      "object_type": "file",
      "target": "src/lib/browser/profile/dedicated-profile-policy.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-021-006",
      "work_order_id": "WO-021",
      "owner": "Browser profile owner",
      "object_type": "file",
      "target": "src/lib/browser/profile/browser-profile-state.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-021-007",
      "work_order_id": "WO-021",
      "owner": "Browser profile owner",
      "object_type": "file",
      "target": "src/lib/browser/profile/browser-profile-config.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-021-008",
      "work_order_id": "WO-021",
      "owner": "Browser profile owner",
      "object_type": "file",
      "target": "src/lib/browser/profile/browser-profile-enrollment-receipt.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-021-009",
      "work_order_id": "WO-021",
      "owner": "Browser profile owner",
      "object_type": "file",
      "target": "src/lib/browser/profile/browser-profile-process-attestation.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-021-010",
      "work_order_id": "WO-021",
      "owner": "Browser profile owner",
      "object_type": "file",
      "target": "src/lib/browser/profile/managed-policy-readback.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-021-011",
      "work_order_id": "WO-021",
      "owner": "Browser profile owner",
      "object_type": "file",
      "target": "src/lib/browser/profile/browser-process-supervisor.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-021-012",
      "work_order_id": "WO-021",
      "owner": "Browser profile owner",
      "object_type": "file",
      "target": "src/lib/browser/profile/browser-profile.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-022-001",
      "work_order_id": "WO-022",
      "owner": "Browser release identity owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/browser-protocol.schema.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-022-002",
      "work_order_id": "WO-022",
      "owner": "Browser release identity owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/generated/browser-protocol.generated.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-022-003",
      "work_order_id": "WO-022",
      "owner": "Browser release identity owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-022-004",
      "work_order_id": "WO-022",
      "owner": "Browser release identity owner",
      "object_type": "file",
      "target": "src/lib/browser/release/browser-artifact-set.schema.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-022-005",
      "work_order_id": "WO-022",
      "owner": "Browser release identity owner",
      "object_type": "file",
      "target": "src/lib/browser/release/browser-activation-tuple.schema.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-022-006",
      "work_order_id": "WO-022",
      "owner": "Browser release identity owner",
      "object_type": "file",
      "target": "src/lib/browser/release/browser-release-proof.schema.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-022-007",
      "work_order_id": "WO-022",
      "owner": "Browser release identity owner",
      "object_type": "file",
      "target": "src/lib/browser/release/browser-release-security-policy.schema.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-022-008",
      "work_order_id": "WO-022",
      "owner": "Browser release identity owner",
      "object_type": "file",
      "target": "src/lib/browser/release/browser-rollback-receipt.schema.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-022-009",
      "work_order_id": "WO-022",
      "owner": "Browser release identity owner",
      "object_type": "file",
      "target": "src/lib/browser/release/browser-build-inputs.schema.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-022-010",
      "work_order_id": "WO-022",
      "owner": "Browser release identity owner",
      "object_type": "file",
      "target": "src/lib/browser/release/browser-sbom.schema.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-022-011",
      "work_order_id": "WO-022",
      "owner": "Browser release identity owner",
      "object_type": "file",
      "target": "src/lib/browser/release/browser-provenance.schema.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-022-012",
      "work_order_id": "WO-022",
      "owner": "Browser release identity owner",
      "object_type": "file",
      "target": "src/lib/browser/release/pinned-browser-toolchain.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-022-013",
      "work_order_id": "WO-022",
      "owner": "Browser release identity owner",
      "object_type": "file",
      "target": "src/lib/browser/release/active-activation.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-022-014",
      "work_order_id": "WO-022",
      "owner": "Browser release identity owner",
      "object_type": "file",
      "target": "src/lib/browser/release/release-identity.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-022-015",
      "work_order_id": "WO-022",
      "owner": "Browser release identity owner",
      "object_type": "file",
      "target": "src/lib/browser/release/browser-build.config.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-022-016",
      "work_order_id": "WO-022",
      "owner": "Browser release identity owner",
      "object_type": "file",
      "target": "src/lib/browser/release/browser-previous-activation-snapshot.schema.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-023-001",
      "work_order_id": "WO-023",
      "owner": "local-runtime owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-authority-broker.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-023-002",
      "work_order_id": "WO-023",
      "owner": "local-runtime owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-023-003",
      "work_order_id": "WO-023",
      "owner": "local-runtime owner",
      "object_type": "file",
      "target": "src/lib/browser/exact-target/browser-target-lease.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-023-004",
      "work_order_id": "WO-023",
      "owner": "local-runtime owner",
      "object_type": "file",
      "target": "src/lib/browser/exact-target/browser-target-lease-manager.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-023-005",
      "work_order_id": "WO-023",
      "owner": "local-runtime owner",
      "object_type": "file",
      "target": "src/lib/browser/exact-target/browser-command-actor.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-023-006",
      "work_order_id": "WO-023",
      "owner": "local-runtime owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/command-permit.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-023-007",
      "work_order_id": "WO-023",
      "owner": "local-runtime owner",
      "object_type": "file",
      "target": "src/lib/browser/profile/browser-profile-enrollment.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-023-008",
      "work_order_id": "WO-023",
      "owner": "local-runtime owner",
      "object_type": "file",
      "target": "src/lib/browser/profile/browser-process-supervisor.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-023-009",
      "work_order_id": "WO-023",
      "owner": "local-runtime owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-browser-authority-support.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-023-010",
      "work_order_id": "WO-023",
      "owner": "local-runtime owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-023-011",
      "work_order_id": "WO-023",
      "owner": "local-runtime owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-assembly.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-023-012",
      "work_order_id": "WO-023",
      "owner": "local-runtime owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-ai-gateway-support.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-023-013",
      "work_order_id": "WO-023",
      "owner": "local-runtime owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-status.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-023-014",
      "work_order_id": "WO-023",
      "owner": "local-runtime owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-024-001",
      "work_order_id": "WO-024",
      "owner": "dom-automation owner",
      "object_type": "file",
      "target": "src/lib/browser/exact-target/browser-command-actor.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-024-002",
      "work_order_id": "WO-024",
      "owner": "dom-automation owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/command-permit.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-024-003",
      "work_order_id": "WO-024",
      "owner": "dom-automation owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-browser-authority-support.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-024-004",
      "work_order_id": "WO-024",
      "owner": "dom-automation owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-024-005",
      "work_order_id": "WO-024",
      "owner": "dom-automation owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-observation/preconstruction-chrome.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-024-006",
      "work_order_id": "WO-024",
      "owner": "dom-automation owner",
      "object_type": "file",
      "target": "src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-024-007",
      "work_order_id": "WO-024",
      "owner": "dom-automation owner",
      "object_type": "file",
      "target": "src/capabilities/dom-automation/runtime/dom-target-binding.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-024-008",
      "work_order_id": "WO-024",
      "owner": "dom-automation owner",
      "object_type": "file",
      "target": "src/capabilities/dom-automation/runtime/dom-snapshot.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-024-009",
      "work_order_id": "WO-024",
      "owner": "dom-automation owner",
      "object_type": "file",
      "target": "src/capabilities/dom-automation/runtime/dom-fill.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-024-010",
      "work_order_id": "WO-024",
      "owner": "dom-automation owner",
      "object_type": "file",
      "target": "src/capabilities/dom-automation/runtime/dom-click.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-024-011",
      "work_order_id": "WO-024",
      "owner": "dom-automation owner",
      "object_type": "file",
      "target": "src/capabilities/dom-automation/runtime/dom-upload.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-024-012",
      "work_order_id": "WO-024",
      "owner": "dom-automation owner",
      "object_type": "file",
      "target": "src/capabilities/dom-automation/runtime/dom-evidence.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-025-001",
      "work_order_id": "WO-025",
      "owner": "ai-input-gateway owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-browser-authority-support.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-025-002",
      "work_order_id": "WO-025",
      "owner": "ai-input-gateway owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-025-003",
      "work_order_id": "WO-025",
      "owner": "ai-input-gateway owner",
      "object_type": "file",
      "target": "src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-025-004",
      "work_order_id": "WO-025",
      "owner": "ai-input-gateway owner",
      "object_type": "file",
      "target": "src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-025-005",
      "work_order_id": "WO-025",
      "owner": "ai-input-gateway owner",
      "object_type": "file",
      "target": "src/capabilities/ai-input-gateway/ability-group.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-025-006",
      "work_order_id": "WO-025",
      "owner": "ai-input-gateway owner",
      "object_type": "file",
      "target": "src/capabilities/ai-input-gateway/contracts/ai-provider-adapter.contract.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-025-007",
      "work_order_id": "WO-025",
      "owner": "ai-input-gateway owner",
      "object_type": "file",
      "target": "src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-025-008",
      "work_order_id": "WO-025",
      "owner": "ai-input-gateway owner",
      "object_type": "file",
      "target": "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-browser.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-025-009",
      "work_order_id": "WO-025",
      "owner": "ai-input-gateway owner",
      "object_type": "file",
      "target": "src/capabilities/ai-input-gateway/providers/web-chat-page-actions.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-025-010",
      "work_order_id": "WO-025",
      "owner": "ai-input-gateway owner",
      "object_type": "file",
      "target": "src/capabilities/ai-input-gateway/children/attach-approved-web-chat-files-once.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-025-011",
      "work_order_id": "WO-025",
      "owner": "ai-input-gateway owner",
      "object_type": "file",
      "target": "src/capabilities/ai-input-gateway/acceptance/attachment.acceptance.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-025-012",
      "work_order_id": "WO-025",
      "owner": "ai-input-gateway owner",
      "object_type": "file",
      "target": "src/capabilities/ai-input-gateway/acceptance/provider-boundary.acceptance.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-026-001",
      "work_order_id": "WO-026",
      "owner": "video-download owner",
      "object_type": "file",
      "target": "src/lib/browser/exact-target/browser-command-actor.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-026-002",
      "work_order_id": "WO-026",
      "owner": "video-download owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/command-permit.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-026-003",
      "work_order_id": "WO-026",
      "owner": "video-download owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-browser-authority-support.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-026-004",
      "work_order_id": "WO-026",
      "owner": "video-download owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-026-005",
      "work_order_id": "WO-026",
      "owner": "video-download owner",
      "object_type": "file",
      "target": "src/capabilities/video-download/acceptance/browser-authority.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-026-006",
      "work_order_id": "WO-026",
      "owner": "video-download owner",
      "object_type": "file",
      "target": "src/capabilities/video-download/children/download-web-video-once.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-026-007",
      "work_order_id": "WO-026",
      "owner": "video-download owner",
      "object_type": "file",
      "target": "src/capabilities/video-download/children/download-facebook-video-once.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-026-008",
      "work_order_id": "WO-026",
      "owner": "video-download owner",
      "object_type": "file",
      "target": "src/capabilities/video-download/children/download-tiktok-video-once.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-027-001",
      "work_order_id": "WO-027",
      "owner": "amazon-invoice-upload owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-browser-authority-support.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-027-002",
      "work_order_id": "WO-027",
      "owner": "amazon-invoice-upload owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-027-003",
      "work_order_id": "WO-027",
      "owner": "amazon-invoice-upload owner",
      "object_type": "file",
      "target": "src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-027-004",
      "work_order_id": "WO-027",
      "owner": "amazon-invoice-upload owner",
      "object_type": "file",
      "target": "src/plugins/amazon-invoice-upload/amazon-invoice-upload-browser-authority.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-027-005",
      "work_order_id": "WO-027",
      "owner": "amazon-invoice-upload owner",
      "object_type": "file",
      "target": "src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-027-006",
      "work_order_id": "WO-027",
      "owner": "amazon-invoice-upload owner",
      "object_type": "file",
      "target": "src/plugins/amazon-invoice-upload/amazon-invoice-upload-file-attachment.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-027-007",
      "work_order_id": "WO-027",
      "owner": "amazon-invoice-upload owner",
      "object_type": "file",
      "target": "src/plugins/amazon-invoice-upload/amazon-invoice-upload-steps.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-027-008",
      "work_order_id": "WO-027",
      "owner": "amazon-invoice-upload owner",
      "object_type": "file",
      "target": "src/plugins/amazon-invoice-upload/amazon-invoice-upload-verify.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-027-009",
      "work_order_id": "WO-027",
      "owner": "amazon-invoice-upload owner",
      "object_type": "file",
      "target": "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-027-010",
      "work_order_id": "WO-027",
      "owner": "amazon-invoice-upload owner",
      "object_type": "file",
      "target": "src/plugins/amazon-invoice-upload/amazon-tax-invoice-download-flow-actions.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-027-011",
      "work_order_id": "WO-027",
      "owner": "amazon-invoice-upload owner",
      "object_type": "file",
      "target": "src/plugins/amazon-invoice-upload/amazon-tax-invoice-download-flow-navigation.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-027-012",
      "work_order_id": "WO-027",
      "owner": "amazon-invoice-upload owner",
      "object_type": "file",
      "target": "src/plugins/amazon-invoice-upload/amazon-tax-invoice-download.flow.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-028-001",
      "work_order_id": "WO-028",
      "owner": "amazon-product-mining owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-browser-authority-support.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-028-002",
      "work_order_id": "WO-028",
      "owner": "amazon-product-mining owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-028-003",
      "work_order_id": "WO-028",
      "owner": "amazon-product-mining owner",
      "object_type": "file",
      "target": "src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-028-004",
      "work_order_id": "WO-028",
      "owner": "amazon-product-mining owner",
      "object_type": "file",
      "target": "src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-028-005",
      "work_order_id": "WO-028",
      "owner": "amazon-product-mining owner",
      "object_type": "file",
      "target": "src/plugins/amazon-product-mining/amazon-product-mining-browser-authority.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-028-006",
      "work_order_id": "WO-028",
      "owner": "amazon-product-mining owner",
      "object_type": "file",
      "target": "src/plugins/amazon-product-mining/amazon-product-mining.flow-support.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-028-007",
      "work_order_id": "WO-028",
      "owner": "amazon-product-mining owner",
      "object_type": "file",
      "target": "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-028-008",
      "work_order_id": "WO-028",
      "owner": "amazon-product-mining owner",
      "object_type": "file",
      "target": "src/plugins/amazon-product-mining/amazon-product-mining.search.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-028-009",
      "work_order_id": "WO-028",
      "owner": "amazon-product-mining owner",
      "object_type": "file",
      "target": "src/plugins/amazon-product-mining/amazon-product-mining.product-detail.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-028-010",
      "work_order_id": "WO-028",
      "owner": "amazon-product-mining owner",
      "object_type": "file",
      "target": "src/plugins/amazon-product-mining/amazon-product-mining.reviews.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-028-011",
      "work_order_id": "WO-028",
      "owner": "amazon-product-mining owner",
      "object_type": "file",
      "target": "src/plugins/amazon-product-mining/index.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-029-001",
      "work_order_id": "WO-029",
      "owner": "xuanxue-ai-production owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-browser-authority-support.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-029-002",
      "work_order_id": "WO-029",
      "owner": "xuanxue-ai-production owner",
      "object_type": "file",
      "target": "src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-029-003",
      "work_order_id": "WO-029",
      "owner": "xuanxue-ai-production owner",
      "object_type": "file",
      "target": "src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-029-004",
      "work_order_id": "WO-029",
      "owner": "xuanxue-ai-production owner",
      "object_type": "file",
      "target": "src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-029-005",
      "work_order_id": "WO-029",
      "owner": "xuanxue-ai-production owner",
      "object_type": "file",
      "target": "src/plugins/xuanxue-ai-production/index.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-029-006",
      "work_order_id": "WO-029",
      "owner": "xuanxue-ai-production owner",
      "object_type": "file",
      "target": "src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-proof.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-029-007",
      "work_order_id": "WO-029",
      "owner": "xuanxue-ai-production owner",
      "object_type": "file",
      "target": "src/plugins/xuanxue-ai-production/xuanxue-ai-production-result.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-030-001",
      "work_order_id": "WO-030",
      "owner": "xuanxue dynamic-proof owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/xuanxue-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-030-002",
      "work_order_id": "WO-030",
      "owner": "xuanxue dynamic-proof owner",
      "object_type": "file",
      "target": "src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-030-003",
      "work_order_id": "WO-030",
      "owner": "xuanxue dynamic-proof owner",
      "object_type": "file",
      "target": "/Users/nexgen/Documents/xuanxue-web/tests/dynamic-proof/browser-authority-window-contract.test.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-030-004",
      "work_order_id": "WO-030",
      "owner": "xuanxue dynamic-proof owner",
      "object_type": "deliverable",
      "target": "deliverable://work-orders/WO-030/cross-repo-receipt.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-030-005",
      "work_order_id": "WO-030",
      "owner": "xuanxue dynamic-proof owner",
      "object_type": "file",
      "target": "/Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/browser-authority-proof-contract.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-030-006",
      "work_order_id": "WO-030",
      "owner": "xuanxue dynamic-proof owner",
      "object_type": "file",
      "target": "/Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/collector-contracts.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-030-007",
      "work_order_id": "WO-030",
      "owner": "xuanxue dynamic-proof owner",
      "object_type": "file",
      "target": "/Users/nexgen/Documents/xuanxue-web/scripts/audit/domains/dynamic-proof/dynamic-agent-receipt-inspection.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-031-001",
      "work_order_id": "WO-031",
      "owner": "local-browser audit owner",
      "object_type": "file",
      "target": ".github/instructions/agent-rules/modules/module-local-browser-session.instructions.md",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-031-002",
      "work_order_id": "WO-031",
      "owner": "local-browser audit owner",
      "object_type": "file",
      "target": "scripts/audit/domains/local-browser-session/manifest.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-031-003",
      "work_order_id": "WO-031",
      "owner": "local-browser audit owner",
      "object_type": "file",
      "target": "scripts/audit/domains/local-browser-session/inspector.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-031-004",
      "work_order_id": "WO-031",
      "owner": "local-browser audit owner",
      "object_type": "file",
      "target": "scripts/audit/domains/local-browser-session/local-browser-26-checks.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-031-005",
      "work_order_id": "WO-031",
      "owner": "local-browser audit owner",
      "object_type": "deliverable",
      "target": "deliverable://work-orders/WO-031/26-check-receipt.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-031-006",
      "work_order_id": "WO-031",
      "owner": "local-browser audit owner",
      "object_type": "file",
      "target": "scripts/audit/domains/local-browser-session/manifest.json",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-031-007",
      "work_order_id": "WO-031",
      "owner": "local-browser audit owner",
      "object_type": "file",
      "target": "scripts/audit/domains/local-browser-session/inspector.ts",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-032-001",
      "work_order_id": "WO-032",
      "owner": "acceptance and audit test owner",
      "object_type": "file",
      "target": "scripts/audit/domains/local-browser-session/manifest.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-032-002",
      "work_order_id": "WO-032",
      "owner": "acceptance and audit test owner",
      "object_type": "file",
      "target": "scripts/audit/domains/local-browser-session/inspector.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-032-003",
      "work_order_id": "WO-032",
      "owner": "acceptance and audit test owner",
      "object_type": "file",
      "target": "scripts/acceptance/local-browser-terminal-contract.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-032-004",
      "work_order_id": "WO-032",
      "owner": "acceptance and audit test owner",
      "object_type": "file",
      "target": "scripts/acceptance/local-browser-26-mutants.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-032-005",
      "work_order_id": "WO-032",
      "owner": "acceptance and audit test owner",
      "object_type": "file",
      "target": "scripts/acceptance/local-browser-property-model.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-001",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/external-operations.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-002",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-003",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/agent-constructed-tree-manifest.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-004",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/agent-build-input-manifest.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-005",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/agent-constructed-source-bundle.tar.zst",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-006",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/xuanxue-constructed-tree-manifest.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-007",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/xuanxue-constructed-source-bundle.tar.zst",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-008",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "data",
      "target": "artifact://browser-release/controller/controller-bundle.tgz",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-009",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "data",
      "target": "artifact://browser-release/native-host/grasseye-browser-host",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-010",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "data",
      "target": "artifact://browser-release/browserctl/browserctl",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-011",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "data",
      "target": "artifact://browser-release/launcher/grasseye-browser-launcher",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-012",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "data",
      "target": "artifact://browser-release/platform-macos/libgrasseye-platform-macos.a",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-013",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "data",
      "target": "artifact://browser-release/extension/grasseye-browser-extension.verified.crx",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-014",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "data",
      "target": "artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-015",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "data",
      "target": "artifact://browser-release/checksums/SHA256SUMS",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-016",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "data",
      "target": "artifact://browser-release/signatures/SHA256SUMS.sig",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-017",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/browser-build-input-lock.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-018",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/artifact-set.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-019",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/builder-a-receipt.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-020",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/builder-b-receipt.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-021",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/sbom.spdx.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-022",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/provenance.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-023",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/installed-artifact-readback.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-024",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "file",
      "target": "src/lib/browser/release/build-artifacts.mjs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-033-025",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "object_type": "file",
      "target": "src/lib/browser/release/verify-artifacts.mjs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-034-001",
      "work_order_id": "WO-034",
      "owner": "real Chrome evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/artifact-set.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-034-002",
      "work_order_id": "WO-034",
      "owner": "real Chrome evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/activation-tuple-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-034-003",
      "work_order_id": "WO-034",
      "owner": "real Chrome evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/release-security-policy.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-034-004",
      "work_order_id": "WO-034",
      "owner": "real Chrome evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/release-identity-signature.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-034-005",
      "work_order_id": "WO-034",
      "owner": "real Chrome evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-observation/preconstruction-chrome.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-034-006",
      "work_order_id": "WO-034",
      "owner": "real Chrome evidence owner",
      "object_type": "data",
      "target": "artifact://browser-release/controller/controller-bundle.tgz",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-034-007",
      "work_order_id": "WO-034",
      "owner": "real Chrome evidence owner",
      "object_type": "data",
      "target": "artifact://browser-release/native-host/grasseye-browser-host",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-034-008",
      "work_order_id": "WO-034",
      "owner": "real Chrome evidence owner",
      "object_type": "data",
      "target": "artifact://browser-release/browserctl/browserctl",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-034-009",
      "work_order_id": "WO-034",
      "owner": "real Chrome evidence owner",
      "object_type": "data",
      "target": "artifact://browser-release/launcher/grasseye-browser-launcher",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-034-010",
      "work_order_id": "WO-034",
      "owner": "real Chrome evidence owner",
      "object_type": "data",
      "target": "artifact://browser-release/platform-macos/libgrasseye-platform-macos.a",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-034-011",
      "work_order_id": "WO-034",
      "owner": "real Chrome evidence owner",
      "object_type": "data",
      "target": "artifact://browser-release/extension/grasseye-browser-extension.verified.crx",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-034-012",
      "work_order_id": "WO-034",
      "owner": "real Chrome evidence owner",
      "object_type": "data",
      "target": "artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-034-013",
      "work_order_id": "WO-034",
      "owner": "real Chrome evidence owner",
      "object_type": "data",
      "target": "artifact://browser-release/checksums/SHA256SUMS",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-034-014",
      "work_order_id": "WO-034",
      "owner": "real Chrome evidence owner",
      "object_type": "data",
      "target": "artifact://browser-release/signatures/SHA256SUMS.sig",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-034-015",
      "work_order_id": "WO-034",
      "owner": "real Chrome evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-034-016",
      "work_order_id": "WO-034",
      "owner": "real Chrome evidence owner",
      "object_type": "file",
      "target": "scripts/acceptance/local-browser-real-chrome-terminal.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-034-017",
      "work_order_id": "WO-034",
      "owner": "real Chrome evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/real-chrome-matrix.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-035-001",
      "work_order_id": "WO-035",
      "owner": "AGENT repository governance owner",
      "object_type": "file",
      "target": "scripts/audit/domains/local-browser-session/manifest.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-035-002",
      "work_order_id": "WO-035",
      "owner": "AGENT repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-035-003",
      "work_order_id": "WO-035",
      "owner": "AGENT repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/agent-repository-governance-policy.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-035-004",
      "work_order_id": "WO-035",
      "owner": "AGENT repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/agent-branch-protection-prestate.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-035-005",
      "work_order_id": "WO-035",
      "owner": "AGENT repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/branch-protection-readback.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-035-006",
      "work_order_id": "WO-035",
      "owner": "AGENT repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/agent-branch-protection-recovery-receipt.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-035-007",
      "work_order_id": "WO-035",
      "owner": "AGENT repository governance owner",
      "object_type": "system",
      "target": "system://github/ADVISION-X/AGENT/branches/main/protection/required_status_checks",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-036-001",
      "work_order_id": "WO-036",
      "owner": "HA operations owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/external-operations.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-036-002",
      "work_order_id": "WO-036",
      "owner": "HA operations owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/xuanxue-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-036-003",
      "work_order_id": "WO-036",
      "owner": "HA operations owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/real-chrome-matrix.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-036-004",
      "work_order_id": "WO-036",
      "owner": "HA operations owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/activation-tuple-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-036-005",
      "work_order_id": "WO-036",
      "owner": "HA operations owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/release-security-policy.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-036-006",
      "work_order_id": "WO-036",
      "owner": "HA operations owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/release-identity-signature.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-036-007",
      "work_order_id": "WO-036",
      "owner": "HA operations owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-036-008",
      "work_order_id": "WO-036",
      "owner": "HA operations owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/ha-handover.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-037-001",
      "work_order_id": "WO-037",
      "owner": "soak evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/ha-handover.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-037-002",
      "work_order_id": "WO-037",
      "owner": "soak evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/artifact-set.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-037-003",
      "work_order_id": "WO-037",
      "owner": "soak evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/activation-tuple-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-037-004",
      "work_order_id": "WO-037",
      "owner": "soak evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/release-security-policy.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-037-005",
      "work_order_id": "WO-037",
      "owner": "soak evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/release-identity-signature.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-037-006",
      "work_order_id": "WO-037",
      "owner": "soak evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-037-007",
      "work_order_id": "WO-037",
      "owner": "soak evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/soak-24h.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-037-008",
      "work_order_id": "WO-037",
      "owner": "soak evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/soak-168h.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-001",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://work-orders/WO-031/26-check-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-002",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://work-orders/WO-030/cross-repo-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-003",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/artifact-set.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-004",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/activation-tuple-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-005",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/release-security-policy.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-006",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/real-chrome-matrix.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-007",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/business-workday-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-008",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/branch-protection-readback.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-009",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/ha-handover.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-010",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/soak-24h.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-011",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/soak-168h.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-012",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/ci-full-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-013",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/independent-audit.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-014",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "file",
      "target": "scripts/audit/generated/audit-plan.generated.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-015",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/xuanxue-branch-protection-readback.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-016",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/browser-build-input-lock.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-017",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/sbom.spdx.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-018",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/provenance.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-019",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/installed-artifact-readback.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-020",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/release-identity-signature.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-021",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-038-022",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/BrowserReleaseProofManifestV1.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-039-001",
      "work_order_id": "WO-039",
      "owner": "release activation owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/BrowserReleaseProofManifestV1.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-039-002",
      "work_order_id": "WO-039",
      "owner": "release activation owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-039-003",
      "work_order_id": "WO-039",
      "owner": "release activation owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/activation-receipt.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-039-004",
      "work_order_id": "WO-039",
      "owner": "release activation owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/previous-activation-snapshot.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-039-005",
      "work_order_id": "WO-039",
      "owner": "release activation owner",
      "object_type": "system",
      "target": "system://browser-release/active-activation-slot",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-039-006",
      "work_order_id": "WO-039",
      "owner": "release activation owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/construction-blocked-browser-authority",
      "operation": "DELETE",
      "consumer_ids": [
        "CON-001",
        "CON-002",
        "CON-003",
        "CON-004",
        "CON-005",
        "CON-006",
        "CON-007",
        "CON-008",
        "CON-009",
        "CON-010",
        "CON-011"
      ],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-040-001",
      "work_order_id": "WO-040",
      "owner": "production readback owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/activation-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-040-002",
      "work_order_id": "WO-040",
      "owner": "production readback owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/BrowserReleaseProofManifestV1.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-040-003",
      "work_order_id": "WO-040",
      "owner": "production readback owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-040-004",
      "work_order_id": "WO-040",
      "owner": "production readback owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/post-activation-readback.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-001",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://work-orders/WO-031/26-check-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-002",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://work-orders/WO-030/cross-repo-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-003",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/artifact-set.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-004",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/activation-tuple-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-005",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/release-security-policy.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-006",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/real-chrome-matrix.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-007",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/business-workday-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-008",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/branch-protection-readback.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-009",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/ha-handover.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-010",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/soak-24h.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-011",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/soak-168h.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-012",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/ci-full-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-013",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/xuanxue-branch-protection-readback.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-014",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/browser-build-input-lock.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-015",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/sbom.spdx.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-016",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/provenance.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-017",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/installed-artifact-readback.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-018",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/release-identity-signature.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-019",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/agent-branch-protection-prestate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-020",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/agent-branch-protection-recovery-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-021",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/xuanxue-branch-protection-prestate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-022",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-023",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-024",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/agent-repository-governance-policy.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-025",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/xuanxue-repository-governance-policy.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-041-026",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/independent-audit.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-042-001",
      "work_order_id": "WO-042",
      "owner": "release approval owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/BrowserReleaseProofManifestV1.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-042-002",
      "work_order_id": "WO-042",
      "owner": "release approval owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/activation-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-042-003",
      "work_order_id": "WO-042",
      "owner": "release approval owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/post-activation-readback.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-042-004",
      "work_order_id": "WO-042",
      "owner": "release approval owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/independent-audit.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-042-005",
      "work_order_id": "WO-042",
      "owner": "release approval owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/ci-full-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-042-006",
      "work_order_id": "WO-042",
      "owner": "release approval owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-042-007",
      "work_order_id": "WO-042",
      "owner": "release approval owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/final-release-approval.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-046-001",
      "work_order_id": "WO-046",
      "owner": "browserctl owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/browser-profile-enrollment.schema.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-046-002",
      "work_order_id": "WO-046",
      "owner": "browserctl owner",
      "object_type": "file",
      "target": "src/lib/browser/protocol/browser-protocol.schema.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-046-003",
      "work_order_id": "WO-046",
      "owner": "browserctl owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/browserctl/Cargo.toml",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-046-004",
      "work_order_id": "WO-046",
      "owner": "browserctl owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-046-005",
      "work_order_id": "WO-046",
      "owner": "browserctl owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/browserctl/src/install.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-046-006",
      "work_order_id": "WO-046",
      "owner": "browserctl owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/browserctl/src/verify.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-046-007",
      "work_order_id": "WO-046",
      "owner": "browserctl owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/browserctl/src/doctor.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-046-008",
      "work_order_id": "WO-046",
      "owner": "browserctl owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/browserctl/src/repair.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-046-009",
      "work_order_id": "WO-046",
      "owner": "browserctl owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/browserctl/src/enroll_profile.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-046-010",
      "work_order_id": "WO-046",
      "owner": "browserctl owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/browserctl/src/activate.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-046-011",
      "work_order_id": "WO-046",
      "owner": "browserctl owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/browserctl/src/rollback.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-046-012",
      "work_order_id": "WO-046",
      "owner": "browserctl owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/launcher/Cargo.toml",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-046-013",
      "work_order_id": "WO-046",
      "owner": "browserctl owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/launcher/src/main.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-046-014",
      "work_order_id": "WO-046",
      "owner": "browserctl owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/platform-macos/Cargo.toml",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-046-015",
      "work_order_id": "WO-046",
      "owner": "browserctl owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/platform-macos/src/registration.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-046-016",
      "work_order_id": "WO-046",
      "owner": "browserctl owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/manifests/com.grasseye.browser_host.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-046-017",
      "work_order_id": "WO-046",
      "owner": "browserctl owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/browserctl/tests/browserctl.acceptance.rs",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-047-001",
      "work_order_id": "WO-047",
      "owner": "Browser infrastructure supervisor owner",
      "object_type": "file",
      "target": "src/lib/browser/transport/transport-actor.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-047-002",
      "work_order_id": "WO-047",
      "owner": "Browser infrastructure supervisor owner",
      "object_type": "file",
      "target": "src/lib/browser/profile/browser-process-supervisor.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-047-003",
      "work_order_id": "WO-047",
      "owner": "Browser infrastructure supervisor owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-047-004",
      "work_order_id": "WO-047",
      "owner": "Browser infrastructure supervisor owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-owner-lock.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-047-005",
      "work_order_id": "WO-047",
      "owner": "Browser infrastructure supervisor owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-worker-membership.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-047-006",
      "work_order_id": "WO-047",
      "owner": "Browser infrastructure supervisor owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-worker-handover.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-047-007",
      "work_order_id": "WO-047",
      "owner": "Browser infrastructure supervisor owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-retry-policy.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-047-008",
      "work_order_id": "WO-047",
      "owner": "Browser infrastructure supervisor owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-repair.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-047-009",
      "work_order_id": "WO-047",
      "owner": "Browser infrastructure supervisor owner",
      "object_type": "file",
      "target": "src/lib/browser/infrastructure/browser-infrastructure-supervisor.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-043-001",
      "work_order_id": "WO-043",
      "owner": "business workday evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/artifact-set.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-043-002",
      "work_order_id": "WO-043",
      "owner": "business workday evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/activation-tuple-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-043-003",
      "work_order_id": "WO-043",
      "owner": "business workday evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/real-chrome-matrix.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-043-004",
      "work_order_id": "WO-043",
      "owner": "business workday evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/provider-journey-authorization.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-043-005",
      "work_order_id": "WO-043",
      "owner": "business workday evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/release-security-policy.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-043-006",
      "work_order_id": "WO-043",
      "owner": "business workday evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/release-identity-signature.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-043-007",
      "work_order_id": "WO-043",
      "owner": "business workday evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-043-008",
      "work_order_id": "WO-043",
      "owner": "business workday evidence owner",
      "object_type": "file",
      "target": "scripts/acceptance/local-browser-business-workday-terminal.acceptance.ts",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-043-009",
      "work_order_id": "WO-043",
      "owner": "business workday evidence owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/business-workday-receipt.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-044-001",
      "work_order_id": "WO-044",
      "owner": "CI-FULL compliance self-check owner",
      "object_type": "file",
      "target": "scripts/audit/ci-full.ts",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-044-002",
      "work_order_id": "WO-044",
      "owner": "CI-FULL compliance self-check owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/business-workday-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-044-003",
      "work_order_id": "WO-044",
      "owner": "CI-FULL compliance self-check owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/activation-tuple-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-044-004",
      "work_order_id": "WO-044",
      "owner": "CI-FULL compliance self-check owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/release-security-policy.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-044-005",
      "work_order_id": "WO-044",
      "owner": "CI-FULL compliance self-check owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/release-identity-signature.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-044-006",
      "work_order_id": "WO-044",
      "owner": "CI-FULL compliance self-check owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-044-007",
      "work_order_id": "WO-044",
      "owner": "CI-FULL compliance self-check owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/ci-full-receipt.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-048-001",
      "work_order_id": "WO-048",
      "owner": "xuanxue repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/xuanxue-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户继续授权",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-048-002",
      "work_order_id": "WO-048",
      "owner": "xuanxue repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://work-orders/WO-030/cross-repo-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户继续授权",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-048-003",
      "work_order_id": "WO-048",
      "owner": "xuanxue repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户继续授权",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-048-004",
      "work_order_id": "WO-048",
      "owner": "xuanxue repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/xuanxue-repository-governance-policy.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户继续授权",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-048-005",
      "work_order_id": "WO-048",
      "owner": "xuanxue repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/xuanxue-branch-protection-prestate.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户继续授权",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-048-006",
      "work_order_id": "WO-048",
      "owner": "xuanxue repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/xuanxue-branch-protection-readback.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户继续授权",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-048-007",
      "work_order_id": "WO-048",
      "owner": "xuanxue repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户继续授权",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-048-008",
      "work_order_id": "WO-048",
      "owner": "xuanxue repository governance owner",
      "object_type": "system",
      "target": "system://github/ADVISION-X/xuanxue-web/branches/main/protection/required_status_checks",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户继续授权",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-049-001",
      "work_order_id": "WO-049",
      "owner": "provider journey authorization owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/operator-provider-journey-request.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户继续授权",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-049-002",
      "work_order_id": "WO-049",
      "owner": "provider journey authorization owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/provider-journey-authorization.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户继续授权",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-001",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/external-operations.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-002",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/browser-build-input-lock.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-003",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/artifact-set.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-004",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/builder-a-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-005",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/builder-b-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-006",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/sbom.spdx.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-007",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/provenance.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-008",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/installed-artifact-readback.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-009",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "file",
      "target": "src/lib/browser/release/browser-activation-tuple.schema.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-010",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "file",
      "target": "src/lib/browser/release/browser-release-security-policy.schema.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-011",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "data",
      "target": "artifact://browser-release/controller/controller-bundle.tgz",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-012",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "data",
      "target": "artifact://browser-release/native-host/grasseye-browser-host",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-013",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "data",
      "target": "artifact://browser-release/browserctl/browserctl",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-014",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "data",
      "target": "artifact://browser-release/launcher/grasseye-browser-launcher",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-015",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "data",
      "target": "artifact://browser-release/platform-macos/libgrasseye-platform-macos.a",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-016",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "data",
      "target": "artifact://browser-release/extension/grasseye-browser-extension.verified.crx",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-017",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "data",
      "target": "artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-018",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "data",
      "target": "artifact://browser-release/checksums/SHA256SUMS",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-019",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "data",
      "target": "artifact://browser-release/signatures/SHA256SUMS.sig",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-020",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-021",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/activation-tuple-candidate.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-022",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/release-security-policy.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-050-023",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/release-identity-signature.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-051-001",
      "work_order_id": "WO-051",
      "owner": "Browser authority issuer owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/post-activation-readback.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-051-002",
      "work_order_id": "WO-051",
      "owner": "Browser authority issuer owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/activation-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-051-003",
      "work_order_id": "WO-051",
      "owner": "Browser authority issuer owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-051-004",
      "work_order_id": "WO-051",
      "owner": "Browser authority issuer owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/recovery-authority-revoke.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-051-005",
      "work_order_id": "WO-051",
      "owner": "Browser authority issuer owner",
      "object_type": "system",
      "target": "system://browser-authority/active-authority-slot#revoke",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-052-001",
      "work_order_id": "WO-052",
      "owner": "browserctl owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/recovery-authority-revoke.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-052-002",
      "work_order_id": "WO-052",
      "owner": "browserctl owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/activation-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-052-003",
      "work_order_id": "WO-052",
      "owner": "browserctl owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/previous-activation-snapshot.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-052-004",
      "work_order_id": "WO-052",
      "owner": "browserctl owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/BrowserReleaseProofManifestV1.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-052-005",
      "work_order_id": "WO-052",
      "owner": "browserctl owner",
      "object_type": "file",
      "target": "src/lib/browser/native-messaging-host/crates/browserctl/src/rollback.rs",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-052-006",
      "work_order_id": "WO-052",
      "owner": "browserctl owner",
      "object_type": "data",
      "target": "artifact://browser-release/controller/controller-bundle.tgz",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-052-007",
      "work_order_id": "WO-052",
      "owner": "browserctl owner",
      "object_type": "data",
      "target": "artifact://browser-release/native-host/grasseye-browser-host",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-052-008",
      "work_order_id": "WO-052",
      "owner": "browserctl owner",
      "object_type": "data",
      "target": "artifact://browser-release/browserctl/browserctl",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-052-009",
      "work_order_id": "WO-052",
      "owner": "browserctl owner",
      "object_type": "data",
      "target": "artifact://browser-release/launcher/grasseye-browser-launcher",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-052-010",
      "work_order_id": "WO-052",
      "owner": "browserctl owner",
      "object_type": "data",
      "target": "artifact://browser-release/platform-macos/libgrasseye-platform-macos.a",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-052-011",
      "work_order_id": "WO-052",
      "owner": "browserctl owner",
      "object_type": "data",
      "target": "artifact://browser-release/extension/grasseye-browser-extension.verified.crx",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-052-012",
      "work_order_id": "WO-052",
      "owner": "browserctl owner",
      "object_type": "data",
      "target": "artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-052-013",
      "work_order_id": "WO-052",
      "owner": "browserctl owner",
      "object_type": "data",
      "target": "artifact://browser-release/checksums/SHA256SUMS",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-052-014",
      "work_order_id": "WO-052",
      "owner": "browserctl owner",
      "object_type": "data",
      "target": "artifact://browser-release/signatures/SHA256SUMS.sig",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-052-015",
      "work_order_id": "WO-052",
      "owner": "browserctl owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-052-016",
      "work_order_id": "WO-052",
      "owner": "browserctl owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/recovery-browserctl-rollback.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-052-017",
      "work_order_id": "WO-052",
      "owner": "browserctl owner",
      "object_type": "system",
      "target": "system://browser-profile/installed-artifact-state#recover-signed-present-or-absent",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-053-001",
      "work_order_id": "WO-053",
      "owner": "release activation owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/recovery-browserctl-rollback.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-053-002",
      "work_order_id": "WO-053",
      "owner": "release activation owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/activation-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-053-003",
      "work_order_id": "WO-053",
      "owner": "release activation owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/previous-activation-snapshot.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-053-004",
      "work_order_id": "WO-053",
      "owner": "release activation owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/release-security-policy.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-053-005",
      "work_order_id": "WO-053",
      "owner": "release activation owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-053-006",
      "work_order_id": "WO-053",
      "owner": "release activation owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/recovery-active-slot-cas.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-053-007",
      "work_order_id": "WO-053",
      "owner": "release activation owner",
      "object_type": "system",
      "target": "system://browser-release/active-activation-slot#rollback-present-or-absent",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-054-001",
      "work_order_id": "WO-054",
      "owner": "local-runtime owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/recovery-active-slot-cas.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-054-002",
      "work_order_id": "WO-054",
      "owner": "local-runtime owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/recovery-authority-revoke.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-054-003",
      "work_order_id": "WO-054",
      "owner": "local-runtime owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-054-004",
      "work_order_id": "WO-054",
      "owner": "local-runtime owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/recovery-consumer-blocked.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-054-005",
      "work_order_id": "WO-054",
      "owner": "local-runtime owner",
      "object_type": "system",
      "target": "system://workbench/browser-consumer-admission#construction-blocked",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-055-001",
      "work_order_id": "WO-055",
      "owner": "production recovery readback owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/recovery-authority-revoke.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-055-002",
      "work_order_id": "WO-055",
      "owner": "production recovery readback owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/recovery-browserctl-rollback.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-055-003",
      "work_order_id": "WO-055",
      "owner": "production recovery readback owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/recovery-active-slot-cas.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-055-004",
      "work_order_id": "WO-055",
      "owner": "production recovery readback owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/recovery-consumer-blocked.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-055-005",
      "work_order_id": "WO-055",
      "owner": "production recovery readback owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/previous-activation-snapshot.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-055-006",
      "work_order_id": "WO-055",
      "owner": "production recovery readback owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-055-007",
      "work_order_id": "WO-055",
      "owner": "production recovery readback owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/post-rollback-readback.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-055-008",
      "work_order_id": "WO-055",
      "owner": "production recovery readback owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/new-attempt-admission.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-056-001",
      "work_order_id": "WO-056",
      "owner": "AGENT repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/agent-repository-governance-request.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-056-002",
      "work_order_id": "WO-056",
      "owner": "AGENT repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/agent-repository-governance-policy.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-057-001",
      "work_order_id": "WO-057",
      "owner": "xuanxue repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/xuanxue-repository-governance-request.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-057-002",
      "work_order_id": "WO-057",
      "owner": "xuanxue repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/xuanxue-repository-governance-policy.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-058-001",
      "work_order_id": "WO-058",
      "owner": "AGENT repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/agent-repository-governance-policy.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-058-002",
      "work_order_id": "WO-058",
      "owner": "AGENT repository governance owner",
      "object_type": "system",
      "target": "system://git/ADVISION-X/AGENT/worktree-and-index",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-058-003",
      "work_order_id": "WO-058",
      "owner": "AGENT repository governance owner",
      "object_type": "file",
      "target": "package.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-058-004",
      "work_order_id": "WO-058",
      "owner": "AGENT repository governance owner",
      "object_type": "file",
      "target": "package-lock.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-058-005",
      "work_order_id": "WO-058",
      "owner": "AGENT repository governance owner",
      "object_type": "file",
      "target": "tsconfig.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-058-006",
      "work_order_id": "WO-058",
      "owner": "AGENT repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/agent-constructed-tree-manifest.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-058-007",
      "work_order_id": "WO-058",
      "owner": "AGENT repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/agent-build-input-manifest.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-058-008",
      "work_order_id": "WO-058",
      "owner": "AGENT repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/agent-constructed-source-bundle.tar.zst",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-058-009",
      "work_order_id": "WO-058",
      "owner": "AGENT repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/agent-constructed-candidate.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-058-010",
      "work_order_id": "WO-058",
      "owner": "AGENT repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/agent-remote-candidate-readback.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-058-011",
      "work_order_id": "WO-058",
      "owner": "AGENT repository governance owner",
      "object_type": "system",
      "target": "system://git/ADVISION-X/AGENT/refs/heads/codex/browser-greenfield",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-059-001",
      "work_order_id": "WO-059",
      "owner": "xuanxue repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://construction-admission/xuanxue-repository-governance-policy.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-059-002",
      "work_order_id": "WO-059",
      "owner": "xuanxue repository governance owner",
      "object_type": "system",
      "target": "system://git/ADVISION-X/xuanxue-web/worktree-and-index",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-059-003",
      "work_order_id": "WO-059",
      "owner": "xuanxue repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://work-orders/WO-030/cross-repo-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-059-004",
      "work_order_id": "WO-059",
      "owner": "xuanxue repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/xuanxue-constructed-tree-manifest.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-059-005",
      "work_order_id": "WO-059",
      "owner": "xuanxue repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/xuanxue-constructed-source-bundle.tar.zst",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-059-006",
      "work_order_id": "WO-059",
      "owner": "xuanxue repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/xuanxue-constructed-candidate.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-059-007",
      "work_order_id": "WO-059",
      "owner": "xuanxue repository governance owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/xuanxue-remote-candidate-readback.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-059-008",
      "work_order_id": "WO-059",
      "owner": "xuanxue repository governance owner",
      "object_type": "system",
      "target": "system://git/ADVISION-X/xuanxue-web/refs/heads/codex/browser-greenfield",
      "operation": "MODIFY",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-060-001",
      "work_order_id": "WO-060",
      "owner": "cross-repo release candidate owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/agent-constructed-tree-manifest.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-060-002",
      "work_order_id": "WO-060",
      "owner": "cross-repo release candidate owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/agent-constructed-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-060-003",
      "work_order_id": "WO-060",
      "owner": "cross-repo release candidate owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/agent-remote-candidate-readback.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-060-004",
      "work_order_id": "WO-060",
      "owner": "cross-repo release candidate owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/xuanxue-constructed-tree-manifest.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-060-005",
      "work_order_id": "WO-060",
      "owner": "cross-repo release candidate owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/xuanxue-constructed-candidate.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-060-006",
      "work_order_id": "WO-060",
      "owner": "cross-repo release candidate owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/xuanxue-remote-candidate-readback.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-060-007",
      "work_order_id": "WO-060",
      "owner": "cross-repo release candidate owner",
      "object_type": "deliverable",
      "target": "deliverable://work-orders/WO-030/cross-repo-receipt.json",
      "operation": "READ",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    },
    {
      "operation_id": "OP-060-008",
      "work_order_id": "WO-060",
      "owner": "cross-repo release candidate owner",
      "object_type": "deliverable",
      "target": "deliverable://browser-release/constructed-release-candidate.json",
      "operation": "CREATE",
      "consumer_ids": [],
      "authority_basis": [
        "用户绿地重建要求",
        "AGENTS.md",
        "APEX-LOCAL-BROWSER active law",
        "终态施工图"
      ]
    }
  ],
  "action_contracts": [
    {
      "action_id": "ACT-002",
      "work_order_id": "WO-002",
      "owner": "project authorization owner",
      "caller_or_actor": "project authorization owner",
      "entrypoint_or_channel": "deliverable://construction-admission/agent-candidate.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "AGENTS.md ; .github/instructions/agent-rules/modules/module-local-browser-session.instructions.md ; docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md ; deliverable://construction-admission/user-browser-scope-authorization.json ; deliverable://construction-admission/agent-candidate.json",
      "input_contract": "AGENTS.md ; .github/instructions/agent-rules/modules/module-local-browser-session.instructions.md ; docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md ; deliverable://construction-admission/user-browser-scope-authorization.json",
      "output_contract": "deliverable://construction-admission/agent-candidate.json",
      "state_transition": "只关闭 AGENT SHA/tree 与本轮 Browser 片区授权。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-002",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-002"
      ]
    },
    {
      "action_id": "ACT-004",
      "work_order_id": "WO-004",
      "owner": "xuanxue repository authority owner",
      "caller_or_actor": "xuanxue repository authority owner",
      "entrypoint_or_channel": "deliverable://construction-admission/xuanxue-candidate.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "/Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/browser-authority-proof-contract.ts ; /Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/collector-contracts.ts ; /Users/nexgen/Documents/xuanxue-web/scripts/audit/domains/dynamic-proof/dynamic-agent-receipt-inspection.ts ; deliverable://construction-admission/xuanxue-candidate.json",
      "input_contract": "/Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/browser-authority-proof-contract.ts ; /Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/collector-contracts.ts ; /Users/nexgen/Documents/xuanxue-web/scripts/audit/domains/dynamic-proof/dynamic-agent-receipt-inspection.ts",
      "output_contract": "deliverable://construction-admission/xuanxue-candidate.json",
      "state_transition": "独立取得干净 xuanxue SHA/tree 与三条精确目标路径；缺失只阻断跨仓和其后发布。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-004",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-004"
      ]
    },
    {
      "action_id": "ACT-005",
      "work_order_id": "WO-005",
      "owner": "Browser retirement inventory owner",
      "caller_or_actor": "Browser retirement inventory owner",
      "entrypoint_or_channel": "scripts/acceptance/local-browser-plan-harness.self-test.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "git-tree://60cfcf512ecdae0ed27d001d40b6293ae53e5cc6/src/lib/browser ; src/lib/local-runtime/workbench-browser-support.ts ; src/lib/local-runtime/workbench-video-download-support.ts ; src/lib/local-runtime/workbench-ai-gateway-support.ts ; src/lib/local-runtime/workbench-assembly.ts ; scripts/acceptance/local-browser-plan-harness.self-test.ts ; scripts/acceptance/local-browser-plan-gates.acceptance.ts ; scripts/acceptance/local-browser-retirement-inventory.acceptance.ts ; scripts/acceptance/local-browser-consumer-registry.acceptance.ts ; scripts/acceptance/local-browser-work-order-receipt.acceptance.ts ; deliverable://browser-retirement/file-classification.json ; deliverable://browser-retirement/consumer-registry.json",
      "input_contract": "git-tree://60cfcf512ecdae0ed27d001d40b6293ae53e5cc6/src/lib/browser ; src/lib/local-runtime/workbench-browser-support.ts ; src/lib/local-runtime/workbench-video-download-support.ts ; src/lib/local-runtime/workbench-ai-gateway-support.ts ; src/lib/local-runtime/workbench-assembly.ts",
      "output_contract": "scripts/acceptance/local-browser-plan-harness.self-test.ts ; scripts/acceptance/local-browser-plan-gates.acceptance.ts ; scripts/acceptance/local-browser-retirement-inventory.acceptance.ts ; scripts/acceptance/local-browser-consumer-registry.acceptance.ts ; scripts/acceptance/local-browser-work-order-receipt.acceptance.ts ; deliverable://browser-retirement/file-classification.json ; deliverable://browser-retirement/consumer-registry.json",
      "state_transition": "用 AST/symbol 消费图把当前 Browser 文件逐一标为删除，并把每个消费者绑定到 CON-001..CON-011。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-005",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-005"
      ]
    },
    {
      "action_id": "ACT-006",
      "work_order_id": "WO-006",
      "owner": "project authorization owner",
      "caller_or_actor": "project authorization owner",
      "entrypoint_or_channel": "deliverable://construction-admission/browser-canonical-path.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": ".github/instructions/agent-rules/modules/module-local-browser-session.instructions.md ; docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md ; deliverable://construction-admission/browser-canonical-path.json",
      "input_contract": ".github/instructions/agent-rules/modules/module-local-browser-session.instructions.md ; docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md",
      "output_contract": "deliverable://construction-admission/browser-canonical-path.json",
      "state_transition": "只依据 active law 与终态施工图选择 src/lib/browser/profile/browser-process-supervisor.ts；逐文件分类和删除批准由 WO-005/WO-008 完成。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-006",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-006"
      ]
    },
    {
      "action_id": "ACT-007",
      "work_order_id": "WO-007",
      "owner": "real Chrome evidence owner",
      "caller_or_actor": "real Chrome evidence owner",
      "entrypoint_or_channel": "deliverable://browser-observation/preconstruction-chrome.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "scripts/acceptance/xuanxue-ai-production.real-chrome.ts ; deliverable://browser-observation/preconstruction-chrome.json",
      "input_contract": "scripts/acceptance/xuanxue-ai-production.real-chrome.ts",
      "output_contract": "deliverable://browser-observation/preconstruction-chrome.json",
      "state_transition": "记录获准真实路径的 URL、profile/process/policy、DOM 与动作前后终态；未知状态保持 UNKNOWN。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-007",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-007"
      ]
    },
    {
      "action_id": "ACT-008",
      "work_order_id": "WO-008",
      "owner": "Browser retirement inventory owner",
      "caller_or_actor": "Browser retirement inventory owner",
      "entrypoint_or_channel": "deliverable://construction-admission/browser-demolition.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://browser-retirement/file-classification.json ; deliverable://browser-retirement/consumer-registry.json ; deliverable://construction-admission/browser-canonical-path.json ; deliverable://browser-observation/preconstruction-chrome.json ; deliverable://construction-admission/browser-demolition.json ; deliverable://browser-retirement/cutover-ledger.json",
      "input_contract": "deliverable://browser-retirement/file-classification.json ; deliverable://browser-retirement/consumer-registry.json ; deliverable://construction-admission/browser-canonical-path.json ; deliverable://browser-observation/preconstruction-chrome.json",
      "output_contract": "deliverable://construction-admission/browser-demolition.json ; deliverable://browser-retirement/cutover-ledger.json",
      "state_transition": "把每个 CON ID 映射到精确路径、owner、迁移工作单、验收和无旧链恢复。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-008",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-008"
      ]
    },
    {
      "action_id": "ACT-009",
      "work_order_id": "WO-009",
      "owner": "Browser owner",
      "caller_or_actor": "Browser owner",
      "entrypoint_or_channel": "deliverable://work-orders/WO-009/receipt.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://construction-admission/browser-demolition.json ; deliverable://browser-retirement/cutover-ledger.json ; deliverable://work-orders/WO-009/receipt.json ; deliverable://browser-retirement/file-classification.json#delete_targets",
      "input_contract": "deliverable://construction-admission/browser-demolition.json ; deliverable://browser-retirement/cutover-ledger.json",
      "output_contract": "deliverable://work-orders/WO-009/receipt.json",
      "state_transition": "删除获准 Browser 根内全部现实现，构造期 authority 明确 ABSENT。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-009",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-009"
      ]
    },
    {
      "action_id": "ACT-010",
      "work_order_id": "WO-010",
      "owner": "local-runtime owner",
      "caller_or_actor": "local-runtime owner",
      "entrypoint_or_channel": "deliverable://work-orders/WO-010/receipt.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://browser-retirement/cutover-ledger.json ; deliverable://work-orders/WO-010/receipt.json ; src/lib/local-runtime/workbench-browser-support.ts ; src/lib/local-runtime/workbench-video-download-support.ts",
      "input_contract": "deliverable://browser-retirement/cutover-ledger.json",
      "output_contract": "deliverable://work-orders/WO-010/receipt.json",
      "state_transition": "删除两个旧 support surface，不保留别名、wrapper 或 authority 平行文件。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-010",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-010"
      ]
    },
    {
      "action_id": "ACT-011",
      "work_order_id": "WO-011",
      "owner": "acceptance owner",
      "caller_or_actor": "acceptance owner",
      "entrypoint_or_channel": "deliverable://work-orders/WO-011/receipt.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://browser-retirement/cutover-ledger.json ; deliverable://work-orders/WO-011/receipt.json ; scripts/acceptance/local-browser-artifact-contract.acceptance.ts ; scripts/acceptance/local-browser-atomic-cutover.acceptance.ts ; scripts/acceptance/local-browser-business-workday.acceptance.ts ; scripts/acceptance/local-browser-exact-target-contract.acceptance.ts ; scripts/acceptance/local-browser-native-transport.acceptance.ts ; scripts/acceptance/local-browser-real-chrome-scenarios.acceptance.ts ; scripts/acceptance/local-browser-real-chrome.acceptance.ts ; scripts/acceptance/local-browser-target-actions.acceptance.ts",
      "input_contract": "deliverable://browser-retirement/cutover-ledger.json",
      "output_contract": "deliverable://work-orders/WO-011/receipt.json",
      "state_transition": "删除当前 legacy local-browser acceptance，未来验收只按终态合同重建。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-011",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-011"
      ]
    },
    {
      "action_id": "ACT-012",
      "work_order_id": "WO-012",
      "owner": "Browser protocol owner",
      "caller_or_actor": "Browser protocol owner",
      "entrypoint_or_channel": "src/lib/browser/protocol/browser-protocol.schema.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://work-orders/WO-009/receipt.json ; deliverable://work-orders/WO-010/receipt.json ; deliverable://work-orders/WO-011/receipt.json ; src/lib/browser/protocol/browser-protocol.schema.json ; src/lib/browser/protocol/browser-authority-certificate.schema.json ; src/lib/browser/protocol/browser-authority-liveness-lease.schema.json ; src/lib/browser/protocol/browser-profile-enrollment.schema.json ; src/lib/browser/protocol/browser-file-artifact-grant.schema.json ; src/lib/browser/protocol/browser-capabilities.json ; src/lib/browser/protocol/browser-errors.json ; src/lib/browser/protocol/browser-protocol-schema.acceptance.ts",
      "input_contract": "deliverable://work-orders/WO-009/receipt.json ; deliverable://work-orders/WO-010/receipt.json ; deliverable://work-orders/WO-011/receipt.json",
      "output_contract": "src/lib/browser/protocol/browser-protocol.schema.json ; src/lib/browser/protocol/browser-authority-certificate.schema.json ; src/lib/browser/protocol/browser-authority-liveness-lease.schema.json ; src/lib/browser/protocol/browser-profile-enrollment.schema.json ; src/lib/browser/protocol/browser-file-artifact-grant.schema.json ; src/lib/browser/protocol/browser-capabilities.json ; src/lib/browser/protocol/browser-errors.json ; src/lib/browser/protocol/browser-protocol-schema.acceptance.ts",
      "state_transition": "建立消息、framing、budget、artifact grant 与 registry hash 的单一源。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-012",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-012"
      ]
    },
    {
      "action_id": "ACT-013",
      "work_order_id": "WO-013",
      "owner": "Browser protocol codegen owner",
      "caller_or_actor": "Browser protocol codegen owner",
      "entrypoint_or_channel": "src/lib/browser/protocol/generated/browser-protocol.generated.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/browser/protocol/browser-protocol.schema.json ; src/lib/browser/protocol/browser-protocol-schema.acceptance.ts ; src/lib/browser/protocol/generated/browser-protocol.generated.ts ; src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs ; src/lib/browser/protocol/browser-protocol-codegen.acceptance.ts",
      "input_contract": "src/lib/browser/protocol/browser-protocol.schema.json ; src/lib/browser/protocol/browser-protocol-schema.acceptance.ts",
      "output_contract": "src/lib/browser/protocol/generated/browser-protocol.generated.ts ; src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs ; src/lib/browser/protocol/browser-protocol-codegen.acceptance.ts",
      "state_transition": "从唯一 schema 生成 TypeScript 与 Rust 合同并证明两端 hash 相同。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-013",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-013"
      ]
    },
    {
      "action_id": "ACT-015",
      "work_order_id": "WO-015",
      "owner": "MV3 Extension owner",
      "caller_or_actor": "MV3 Extension owner",
      "entrypoint_or_channel": "src/lib/browser/chrome-extension/manifest.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/browser/protocol/generated/browser-protocol.generated.ts ; src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs ; src/lib/browser/chrome-extension/manifest.json ; src/lib/browser/chrome-extension/service-worker.ts ; src/lib/browser/chrome-extension/native-port-actor.ts ; src/lib/browser/chrome-extension/command-registry.ts ; src/lib/browser/chrome-extension/command-permit-validator.ts ; src/lib/browser/chrome-extension/debugger-runtime.ts ; src/lib/browser/chrome-extension/exact-target-runtime.ts ; src/lib/browser/chrome-extension/dom-intent-runtime.ts ; src/lib/browser/chrome-extension/artifact-stream.ts ; src/lib/browser/chrome-extension/authenticated-heartbeat.ts ; src/lib/browser/chrome-extension/extension.acceptance.ts",
      "input_contract": "src/lib/browser/protocol/generated/browser-protocol.generated.ts ; src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs",
      "output_contract": "src/lib/browser/chrome-extension/manifest.json ; src/lib/browser/chrome-extension/service-worker.ts ; src/lib/browser/chrome-extension/native-port-actor.ts ; src/lib/browser/chrome-extension/command-registry.ts ; src/lib/browser/chrome-extension/command-permit-validator.ts ; src/lib/browser/chrome-extension/debugger-runtime.ts ; src/lib/browser/chrome-extension/exact-target-runtime.ts ; src/lib/browser/chrome-extension/dom-intent-runtime.ts ; src/lib/browser/chrome-extension/artifact-stream.ts ; src/lib/browser/chrome-extension/authenticated-heartbeat.ts ; src/lib/browser/chrome-extension/extension.acceptance.ts",
      "state_transition": "只建设 NativePortActor、CommandRegistry 与 chrome.debugger 适配。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-015",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-015"
      ]
    },
    {
      "action_id": "ACT-016",
      "work_order_id": "WO-016",
      "owner": "Browser transport owner",
      "caller_or_actor": "Browser transport owner",
      "entrypoint_or_channel": "src/lib/browser/transport/raw-controller-host-channel.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/browser/native-messaging-host/Cargo.toml ; src/lib/browser/native-messaging-host/crates/host/src/main.rs ; src/lib/browser/chrome-extension/manifest.json ; src/lib/browser/chrome-extension/service-worker.ts ; src/lib/browser/transport/raw-controller-host-channel.ts ; src/lib/browser/transport/authenticated-controller-host-channel.ts ; src/lib/browser/transport/transport-event.ts ; src/lib/browser/transport/transport-reducer.ts ; src/lib/browser/transport/transport-actor.ts ; src/lib/browser/transport/transport-authenticator.ts ; src/lib/browser/transport/transport-transcript.ts ; src/lib/browser/transport/authenticated-heartbeat.ts ; src/lib/browser/transport/browser-native-framing.ts ; src/lib/browser/transport/browser-transport.acceptance.ts",
      "input_contract": "src/lib/browser/native-messaging-host/Cargo.toml ; src/lib/browser/native-messaging-host/crates/host/src/main.rs ; src/lib/browser/chrome-extension/manifest.json ; src/lib/browser/chrome-extension/service-worker.ts",
      "output_contract": "src/lib/browser/transport/raw-controller-host-channel.ts ; src/lib/browser/transport/authenticated-controller-host-channel.ts ; src/lib/browser/transport/transport-event.ts ; src/lib/browser/transport/transport-reducer.ts ; src/lib/browser/transport/transport-actor.ts ; src/lib/browser/transport/transport-authenticator.ts ; src/lib/browser/transport/transport-transcript.ts ; src/lib/browser/transport/authenticated-heartbeat.ts ; src/lib/browser/transport/browser-native-framing.ts ; src/lib/browser/transport/browser-transport.acceptance.ts",
      "state_transition": "只拥有 transport event、状态归约、fresh-chain retry 与 stale event 丢弃。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-016",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-016"
      ]
    },
    {
      "action_id": "ACT-017",
      "work_order_id": "WO-017",
      "owner": "Browser authority issuer owner",
      "caller_or_actor": "Browser authority issuer owner",
      "entrypoint_or_channel": "src/lib/browser/infrastructure/browser-authority-lease.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/browser/transport/transport-event.ts ; src/lib/browser/transport/transport-reducer.ts ; src/lib/browser/infrastructure/browser-authority-lease.ts ; src/lib/browser/infrastructure/browser-authority-issuer.ts ; src/lib/browser/infrastructure/browser-authority-certificate.ts ; src/lib/browser/infrastructure/browser-authority-liveness-lease.ts ; src/lib/browser/infrastructure/browser-control-state.ts ; src/lib/browser/infrastructure/browser-authority-issuer.acceptance.ts",
      "input_contract": "src/lib/browser/transport/transport-event.ts ; src/lib/browser/transport/transport-reducer.ts",
      "output_contract": "src/lib/browser/infrastructure/browser-authority-lease.ts ; src/lib/browser/infrastructure/browser-authority-issuer.ts ; src/lib/browser/infrastructure/browser-authority-certificate.ts ; src/lib/browser/infrastructure/browser-authority-liveness-lease.ts ; src/lib/browser/infrastructure/browser-control-state.ts ; src/lib/browser/infrastructure/browser-authority-issuer.acceptance.ts",
      "state_transition": "只在 authenticated channel、profile/process/policy 与 liveness 全成立时产生 PRESENT authority。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-017",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-017"
      ]
    },
    {
      "action_id": "ACT-018",
      "work_order_id": "WO-018",
      "owner": "Browser broker owner",
      "caller_or_actor": "Browser broker owner",
      "entrypoint_or_channel": "src/lib/browser/infrastructure/browser-authority-broker.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/browser/infrastructure/browser-authority-certificate.ts ; src/lib/browser/infrastructure/browser-authority-issuer.ts ; src/lib/browser/infrastructure/browser-authority-broker.ts ; src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts ; src/lib/browser/browser-authority-api.ts",
      "input_contract": "src/lib/browser/infrastructure/browser-authority-certificate.ts ; src/lib/browser/infrastructure/browser-authority-issuer.ts",
      "output_contract": "src/lib/browser/infrastructure/browser-authority-broker.ts ; src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts ; src/lib/browser/browser-authority-api.ts",
      "state_transition": "唯一业务入口只消费当前 execution binding 并返回 authority lease 或 typed unavailable。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-018",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-018"
      ]
    },
    {
      "action_id": "ACT-019",
      "work_order_id": "WO-019",
      "owner": "Browser target lease owner",
      "caller_or_actor": "Browser target lease owner",
      "entrypoint_or_channel": "src/lib/browser/exact-target/browser-target-ref.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/browser/infrastructure/browser-authority-broker.ts ; src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts ; src/lib/browser/exact-target/browser-target-ref.ts ; src/lib/browser/exact-target/browser-document-ref.ts ; src/lib/browser/exact-target/browser-target-lease.ts ; src/lib/browser/exact-target/browser-target-lease-manager.ts ; src/lib/browser/exact-target/browser-target-lease.acceptance.ts",
      "input_contract": "src/lib/browser/infrastructure/browser-authority-broker.ts ; src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts",
      "output_contract": "src/lib/browser/exact-target/browser-target-ref.ts ; src/lib/browser/exact-target/browser-document-ref.ts ; src/lib/browser/exact-target/browser-target-lease.ts ; src/lib/browser/exact-target/browser-target-lease-manager.ts ; src/lib/browser/exact-target/browser-target-lease.acceptance.ts",
      "state_transition": "只从当前 authority lease 取得唯一 target/document lease，epoch 变化立即失效。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-019",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-019"
      ]
    },
    {
      "action_id": "ACT-020",
      "work_order_id": "WO-020",
      "owner": "Browser command owner",
      "caller_or_actor": "Browser command owner",
      "entrypoint_or_channel": "src/lib/browser/transport/command-permit.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/browser/exact-target/browser-target-lease.ts ; src/lib/browser/exact-target/browser-target-lease-manager.ts ; src/lib/browser/transport/command-permit.ts ; src/lib/browser/transport/reply-channel-token.ts ; src/lib/browser/transport/browser-command-admission-budget.ts ; src/lib/browser/exact-target/browser-command-actor.ts ; src/lib/browser/exact-target/browser-mutation-intent-journal.ts ; src/lib/browser/exact-target/browser-dom-intent.ts ; src/lib/browser/exact-target/browser-file-artifact-grant.ts ; src/lib/browser/exact-target/browser-artifact-stream.ts ; src/lib/browser/exact-target/browser-command.acceptance.ts",
      "input_contract": "src/lib/browser/exact-target/browser-target-lease.ts ; src/lib/browser/exact-target/browser-target-lease-manager.ts",
      "output_contract": "src/lib/browser/transport/command-permit.ts ; src/lib/browser/transport/reply-channel-token.ts ; src/lib/browser/transport/browser-command-admission-budget.ts ; src/lib/browser/exact-target/browser-command-actor.ts ; src/lib/browser/exact-target/browser-mutation-intent-journal.ts ; src/lib/browser/exact-target/browser-dom-intent.ts ; src/lib/browser/exact-target/browser-file-artifact-grant.ts ; src/lib/browser/exact-target/browser-artifact-stream.ts ; src/lib/browser/exact-target/browser-command.acceptance.ts",
      "state_transition": "只执行 registry-owned declarative commands；mutation 不自动重放，歧义进入 OUTCOME_UNKNOWN。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-020",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-020"
      ]
    },
    {
      "action_id": "ACT-021",
      "work_order_id": "WO-021",
      "owner": "Browser profile owner",
      "caller_or_actor": "Browser profile owner",
      "entrypoint_or_channel": "src/lib/browser/profile/browser-profile-enrollment.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/browser/protocol/browser-profile-enrollment.schema.json ; src/lib/browser/native-messaging-host/crates/browserctl/src/enroll_profile.rs ; deliverable://construction-admission/browser-canonical-path.json ; src/lib/browser/profile/browser-profile-enrollment.ts ; src/lib/browser/profile/dedicated-profile-policy.ts ; src/lib/browser/profile/browser-profile-state.ts ; src/lib/browser/profile/browser-profile-config.ts ; src/lib/browser/profile/browser-profile-enrollment-receipt.ts ; src/lib/browser/profile/browser-profile-process-attestation.ts ; src/lib/browser/profile/managed-policy-readback.ts ; src/lib/browser/profile/browser-process-supervisor.ts ; src/lib/browser/profile/browser-profile.acceptance.ts",
      "input_contract": "src/lib/browser/protocol/browser-profile-enrollment.schema.json ; src/lib/browser/native-messaging-host/crates/browserctl/src/enroll_profile.rs ; deliverable://construction-admission/browser-canonical-path.json",
      "output_contract": "src/lib/browser/profile/browser-profile-enrollment.ts ; src/lib/browser/profile/dedicated-profile-policy.ts ; src/lib/browser/profile/browser-profile-state.ts ; src/lib/browser/profile/browser-profile-config.ts ; src/lib/browser/profile/browser-profile-enrollment-receipt.ts ; src/lib/browser/profile/browser-profile-process-attestation.ts ; src/lib/browser/profile/managed-policy-readback.ts ; src/lib/browser/profile/browser-process-supervisor.ts ; src/lib/browser/profile/browser-profile.acceptance.ts",
      "state_transition": "建设完整 profile 终态：config、state、dedicated policy、enrollment、receipt、process attestation、managed policy readback 与唯一 BrowserProcessSupervisor；enrollment mutation 仍只由 browserctl 执行。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-021",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-021"
      ]
    },
    {
      "action_id": "ACT-024",
      "work_order_id": "WO-024",
      "owner": "dom-automation owner",
      "caller_or_actor": "dom-automation owner",
      "entrypoint_or_channel": "src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/browser/exact-target/browser-command-actor.ts ; src/lib/browser/transport/command-permit.ts ; src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts ; deliverable://browser-observation/preconstruction-chrome.json ; src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts ; src/capabilities/dom-automation/runtime/dom-target-binding.ts ; src/capabilities/dom-automation/runtime/dom-snapshot.ts ; src/capabilities/dom-automation/runtime/dom-fill.ts ; src/capabilities/dom-automation/runtime/dom-click.ts ; src/capabilities/dom-automation/runtime/dom-upload.ts ; src/capabilities/dom-automation/runtime/dom-evidence.ts",
      "input_contract": "src/lib/browser/exact-target/browser-command-actor.ts ; src/lib/browser/transport/command-permit.ts ; src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts ; deliverable://browser-observation/preconstruction-chrome.json",
      "output_contract": "src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts",
      "state_transition": "六个原子动作只消费当前 BrowserTargetLease 与命令 permit。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-024",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-024"
      ]
    },
    {
      "action_id": "ACT-025",
      "work_order_id": "WO-025",
      "owner": "ai-input-gateway owner",
      "caller_or_actor": "ai-input-gateway owner",
      "entrypoint_or_channel": "src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts ; src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts ; src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts ; src/capabilities/ai-input-gateway/ability-group.ts ; src/capabilities/ai-input-gateway/contracts/ai-provider-adapter.contract.ts ; src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution.ts ; src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-browser.ts ; src/capabilities/ai-input-gateway/providers/web-chat-page-actions.ts ; src/capabilities/ai-input-gateway/children/attach-approved-web-chat-files-once.ts ; src/capabilities/ai-input-gateway/acceptance/attachment.acceptance.ts ; src/capabilities/ai-input-gateway/acceptance/provider-boundary.acceptance.ts",
      "input_contract": "src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts ; src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts",
      "output_contract": "src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts",
      "state_transition": "每次 provider execution/checkpoint 重新取得并释放 authority/target；删除 BrowserTargetSession fixture 合同。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-025",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-025"
      ]
    },
    {
      "action_id": "ACT-026",
      "work_order_id": "WO-026",
      "owner": "video-download owner",
      "caller_or_actor": "video-download owner",
      "entrypoint_or_channel": "src/capabilities/video-download/acceptance/browser-authority.acceptance.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/browser/exact-target/browser-command-actor.ts ; src/lib/browser/transport/command-permit.ts ; src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts ; src/capabilities/video-download/acceptance/browser-authority.acceptance.ts ; src/capabilities/video-download/children/download-web-video-once.ts ; src/capabilities/video-download/children/download-facebook-video-once.ts ; src/capabilities/video-download/children/download-tiktok-video-once.ts",
      "input_contract": "src/lib/browser/exact-target/browser-command-actor.ts ; src/lib/browser/transport/command-permit.ts ; src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
      "output_contract": "src/capabilities/video-download/acceptance/browser-authority.acceptance.ts",
      "state_transition": "来源页探测只使用命名、有界 observation capability，不允许 evaluate 或脚本 fallback。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-026",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-026"
      ]
    },
    {
      "action_id": "ACT-027",
      "work_order_id": "WO-027",
      "owner": "amazon-invoice-upload owner",
      "caller_or_actor": "amazon-invoice-upload owner",
      "entrypoint_or_channel": "src/plugins/amazon-invoice-upload/amazon-invoice-upload-browser-authority.acceptance.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts ; src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts ; src/plugins/amazon-invoice-upload/amazon-invoice-upload-browser-authority.acceptance.ts ; src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts ; src/plugins/amazon-invoice-upload/amazon-invoice-upload-file-attachment.ts ; src/plugins/amazon-invoice-upload/amazon-invoice-upload-steps.ts ; src/plugins/amazon-invoice-upload/amazon-invoice-upload-verify.ts ; src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts ; src/plugins/amazon-invoice-upload/amazon-tax-invoice-download-flow-actions.ts ; src/plugins/amazon-invoice-upload/amazon-tax-invoice-download-flow-navigation.ts ; src/plugins/amazon-invoice-upload/amazon-tax-invoice-download.flow.ts",
      "input_contract": "src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts ; src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts",
      "output_contract": "src/plugins/amazon-invoice-upload/amazon-invoice-upload-browser-authority.acceptance.ts",
      "state_transition": "只改 Browser 边界，保留业务顺序和人工最终门；每个 mutation 有 journal 与 owner outcome resolution。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-027",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-027"
      ]
    },
    {
      "action_id": "ACT-028",
      "work_order_id": "WO-028",
      "owner": "amazon-product-mining owner",
      "caller_or_actor": "amazon-product-mining owner",
      "entrypoint_or_channel": "src/plugins/amazon-product-mining/amazon-product-mining-browser-authority.acceptance.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts ; src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts ; src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts ; src/plugins/amazon-product-mining/amazon-product-mining-browser-authority.acceptance.ts ; src/plugins/amazon-product-mining/amazon-product-mining.flow-support.ts ; src/plugins/amazon-product-mining/amazon-product-mining.flow.ts ; src/plugins/amazon-product-mining/amazon-product-mining.search.ts ; src/plugins/amazon-product-mining/amazon-product-mining.product-detail.ts ; src/plugins/amazon-product-mining/amazon-product-mining.reviews.ts ; src/plugins/amazon-product-mining/index.ts",
      "input_contract": "src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts ; src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts ; src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts",
      "output_contract": "src/plugins/amazon-product-mining/amazon-product-mining-browser-authority.acceptance.ts",
      "state_transition": "每阶段使用当前 execution/authority/target，checkpoint 后不缓存旧 lease。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-028",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-028"
      ]
    },
    {
      "action_id": "ACT-029",
      "work_order_id": "WO-029",
      "owner": "xuanxue-ai-production owner",
      "caller_or_actor": "xuanxue-ai-production owner",
      "entrypoint_or_channel": "src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts ; src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts ; src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts ; src/plugins/xuanxue-ai-production/index.ts ; src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-proof.ts ; src/plugins/xuanxue-ai-production/xuanxue-ai-production-result.ts",
      "input_contract": "src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts ; src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts",
      "output_contract": "src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts",
      "state_transition": "在唯一 AgentRuntimeReceiptV2 内记录有序 authority windows，窗口间零动作且无未裁决 mutation。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-029",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-029"
      ]
    },
    {
      "action_id": "ACT-030",
      "work_order_id": "WO-030",
      "owner": "xuanxue dynamic-proof owner",
      "caller_or_actor": "xuanxue dynamic-proof owner",
      "entrypoint_or_channel": "/Users/nexgen/Documents/xuanxue-web/tests/dynamic-proof/browser-authority-window-contract.test.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://construction-admission/xuanxue-candidate.json ; src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts ; /Users/nexgen/Documents/xuanxue-web/tests/dynamic-proof/browser-authority-window-contract.test.ts ; deliverable://work-orders/WO-030/cross-repo-receipt.json ; /Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/browser-authority-proof-contract.ts ; /Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/collector-contracts.ts ; /Users/nexgen/Documents/xuanxue-web/scripts/audit/domains/dynamic-proof/dynamic-agent-receipt-inspection.ts",
      "input_contract": "deliverable://construction-admission/xuanxue-candidate.json ; src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts",
      "output_contract": "/Users/nexgen/Documents/xuanxue-web/tests/dynamic-proof/browser-authority-window-contract.test.ts ; deliverable://work-orders/WO-030/cross-repo-receipt.json",
      "state_transition": "只在 DG-003 干净候选上修改三条冻结路径，不建立第二 election、receipt 或 verdict owner。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-030",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-030"
      ]
    },
    {
      "action_id": "ACT-031",
      "work_order_id": "WO-031",
      "owner": "local-browser audit owner",
      "caller_or_actor": "local-browser audit owner",
      "entrypoint_or_channel": "scripts/audit/domains/local-browser-session/local-browser-26-checks.acceptance.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": ".github/instructions/agent-rules/modules/module-local-browser-session.instructions.md ; scripts/audit/domains/local-browser-session/manifest.json ; scripts/audit/domains/local-browser-session/inspector.ts ; scripts/audit/domains/local-browser-session/local-browser-26-checks.acceptance.ts ; deliverable://work-orders/WO-031/26-check-receipt.json ; scripts/audit/domains/local-browser-session/manifest.json ; scripts/audit/domains/local-browser-session/inspector.ts",
      "input_contract": ".github/instructions/agent-rules/modules/module-local-browser-session.instructions.md ; scripts/audit/domains/local-browser-session/manifest.json ; scripts/audit/domains/local-browser-session/inspector.ts",
      "output_contract": "scripts/audit/domains/local-browser-session/local-browser-26-checks.acceptance.ts ; deliverable://work-orders/WO-031/26-check-receipt.json",
      "state_transition": "从当前 active law 的 SHA 绑定文本导出精确 26 个 machine-blocking checkId，并与现有 owner manifest/inspector 的独立 binding 集合做全等比较。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-031",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-031"
      ]
    },
    {
      "action_id": "ACT-032",
      "work_order_id": "WO-032",
      "owner": "acceptance and audit test owner",
      "caller_or_actor": "acceptance and audit test owner",
      "entrypoint_or_channel": "scripts/acceptance/local-browser-terminal-contract.acceptance.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "scripts/audit/domains/local-browser-session/manifest.json ; scripts/audit/domains/local-browser-session/inspector.ts ; src/lib/browser/protocol/browser-errors.json ; src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts ; scripts/acceptance/local-browser-terminal-contract.acceptance.ts ; scripts/acceptance/local-browser-26-mutants.acceptance.ts ; scripts/acceptance/local-browser-property-model.acceptance.ts",
      "input_contract": "scripts/audit/domains/local-browser-session/manifest.json ; scripts/audit/domains/local-browser-session/inspector.ts ; src/lib/browser/protocol/browser-errors.json ; src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts",
      "output_contract": "scripts/acceptance/local-browser-terminal-contract.acceptance.ts ; scripts/acceptance/local-browser-26-mutants.acceptance.ts ; scripts/acceptance/local-browser-property-model.acceptance.ts",
      "state_transition": "26 个检查逐项拥有 negative/property/model/mutant 证据；确定性合同验证两项合法 health、精确 error taxonomy、11 个零指标、4 项 SLO 和无界队列/缓存/流为零；generated truth 只由现有 builder 生成。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-032",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-032"
      ]
    },
    {
      "action_id": "ACT-046",
      "work_order_id": "WO-046",
      "owner": "browserctl owner",
      "caller_or_actor": "browserctl owner",
      "entrypoint_or_channel": "src/lib/browser/native-messaging-host/crates/browserctl/Cargo.toml",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/browser/protocol/browser-profile-enrollment.schema.json ; src/lib/browser/protocol/browser-protocol.schema.json ; src/lib/browser/native-messaging-host/crates/browserctl/Cargo.toml ; src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/install.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/verify.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/doctor.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/repair.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/enroll_profile.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/activate.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/rollback.rs ; src/lib/browser/native-messaging-host/crates/launcher/Cargo.toml ; src/lib/browser/native-messaging-host/crates/launcher/src/main.rs ; src/lib/browser/native-messaging-host/crates/platform-macos/Cargo.toml ; src/lib/browser/native-messaging-host/crates/platform-macos/src/registration.rs ; src/lib/browser/native-messaging-host/manifests/com.grasseye.browser_host.json ; src/lib/browser/native-messaging-host/crates/browserctl/tests/browserctl.acceptance.rs",
      "input_contract": "src/lib/browser/protocol/browser-profile-enrollment.schema.json ; src/lib/browser/protocol/browser-protocol.schema.json",
      "output_contract": "src/lib/browser/native-messaging-host/crates/browserctl/Cargo.toml ; src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/install.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/verify.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/doctor.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/repair.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/enroll_profile.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/activate.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/rollback.rs ; src/lib/browser/native-messaging-host/crates/launcher/Cargo.toml ; src/lib/browser/native-messaging-host/crates/launcher/src/main.rs ; src/lib/browser/native-messaging-host/crates/platform-macos/Cargo.toml ; src/lib/browser/native-messaging-host/crates/platform-macos/src/registration.rs ; src/lib/browser/native-messaging-host/manifests/com.grasseye.browser_host.json ; src/lib/browser/native-messaging-host/crates/browserctl/tests/browserctl.acceptance.rs",
      "state_transition": "browserctl 是 install/verify/doctor/repair/enroll-profile/activate/rollback 唯一 owner；launcher、platform-macos 与 manifests 只服务该控制面。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-046",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-046"
      ]
    },
    {
      "action_id": "ACT-047",
      "work_order_id": "WO-047",
      "owner": "Browser infrastructure supervisor owner",
      "caller_or_actor": "Browser infrastructure supervisor owner",
      "entrypoint_or_channel": "src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/browser/transport/transport-actor.ts ; src/lib/browser/profile/browser-process-supervisor.ts ; src/lib/browser/protocol/browser-errors.json ; src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts ; src/lib/browser/infrastructure/browser-owner-lock.ts ; src/lib/browser/infrastructure/browser-worker-membership.ts ; src/lib/browser/infrastructure/browser-worker-handover.ts ; src/lib/browser/infrastructure/browser-retry-policy.ts ; src/lib/browser/infrastructure/browser-repair.ts ; src/lib/browser/infrastructure/browser-infrastructure-supervisor.acceptance.ts",
      "input_contract": "src/lib/browser/transport/transport-actor.ts ; src/lib/browser/profile/browser-process-supervisor.ts ; src/lib/browser/protocol/browser-errors.json",
      "output_contract": "src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts ; src/lib/browser/infrastructure/browser-owner-lock.ts ; src/lib/browser/infrastructure/browser-worker-membership.ts ; src/lib/browser/infrastructure/browser-worker-handover.ts ; src/lib/browser/infrastructure/browser-retry-policy.ts ; src/lib/browser/infrastructure/browser-repair.ts ; src/lib/browser/infrastructure/browser-infrastructure-supervisor.acceptance.ts",
      "state_transition": "唯一 supervisor 在 bind 前取得 OwnerLock，并拥有 worker membership、handover、retry、repair、两项合法 health、唯一 error/metrics producer；不拥有业务流程。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-047",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-047"
      ]
    },
    {
      "action_id": "ACT-035A",
      "work_order_id": "WO-035",
      "owner": "AGENT repository governance owner",
      "caller_or_actor": "AGENT repository governance owner",
      "entrypoint_or_channel": "deliverable://construction-admission/agent-repository-governance-policy.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "scripts/audit/domains/local-browser-session/manifest.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/agent-repository-governance-policy.json ; deliverable://browser-release/agent-branch-protection-prestate.json ; deliverable://browser-release/branch-protection-readback.json ; deliverable://browser-release/agent-branch-protection-recovery-receipt.json ; system://github/ADVISION-X/AGENT/branches/main/protection/required_status_checks",
      "input_contract": "scripts/audit/domains/local-browser-session/manifest.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/agent-repository-governance-policy.json",
      "output_contract": "deliverable://browser-release/agent-branch-protection-prestate.json",
      "state_transition": "GET and sign the exact pre-state; verify exact strict/contexts from the repository governance owner's signed policy and bind candidate/repo/branch.",
      "idempotency_or_replay": "Repeat only while candidate, repository policy and GET pre-state hashes are unchanged.",
      "audit_or_receipt": "ACC-035A",
      "error_semantics": "Do not PATCH; emit FAIL.",
      "acceptance_ids": [
        "ACC-035A"
      ]
    },
    {
      "action_id": "ACT-035B",
      "work_order_id": "WO-035",
      "owner": "AGENT repository governance owner",
      "caller_or_actor": "AGENT repository governance owner",
      "entrypoint_or_channel": "gh api --method PATCH repos/ADVISION-X/AGENT/branches/main/protection/required_status_checks",
      "authorization": "future explicit construction authorization required",
      "object_scope": "scripts/audit/domains/local-browser-session/manifest.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/agent-repository-governance-policy.json ; deliverable://browser-release/agent-branch-protection-prestate.json ; deliverable://browser-release/branch-protection-readback.json ; deliverable://browser-release/agent-branch-protection-recovery-receipt.json ; system://github/ADVISION-X/AGENT/branches/main/protection/required_status_checks",
      "input_contract": "scripts/audit/domains/local-browser-session/manifest.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/agent-repository-governance-policy.json",
      "output_contract": "deliverable://browser-release/branch-protection-readback.json",
      "state_transition": "PATCH exact desired strict/contexts, GET the same endpoint, and sign exact post-state readback.",
      "idempotency_or_replay": "Repeat only when current GET equals signed pre-state or exact desired post-state; any third state fails closed.",
      "audit_or_receipt": "ACC-035B",
      "error_semantics": "Invoke ACT-035C before reporting failure.",
      "acceptance_ids": [
        "ACC-035B"
      ]
    },
    {
      "action_id": "ACT-035C",
      "work_order_id": "WO-035",
      "owner": "AGENT repository governance owner",
      "caller_or_actor": "AGENT repository governance owner",
      "entrypoint_or_channel": "gh api --method PATCH repos/ADVISION-X/AGENT/branches/main/protection/required_status_checks",
      "authorization": "future explicit construction authorization required",
      "object_scope": "scripts/audit/domains/local-browser-session/manifest.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/agent-repository-governance-policy.json ; deliverable://browser-release/agent-branch-protection-prestate.json ; deliverable://browser-release/branch-protection-readback.json ; deliverable://browser-release/agent-branch-protection-recovery-receipt.json ; system://github/ADVISION-X/AGENT/branches/main/protection/required_status_checks",
      "input_contract": "scripts/audit/domains/local-browser-session/manifest.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/agent-repository-governance-policy.json",
      "output_contract": "deliverable://browser-release/agent-branch-protection-recovery-receipt.json",
      "state_transition": "On ACT-B failure, PATCH the exact signed pre-state, GET again, and record RESTORED or RECOVERY_FAILED; on ACT-B success record NOT_REQUIRED.",
      "idempotency_or_replay": "Repeat only while current GET equals the failed/desired state or already equals signed pre-state; any third state fails closed.",
      "audit_or_receipt": "ACC-035C",
      "error_semantics": "RECOVERY_FAILED is terminal and blocks release.",
      "acceptance_ids": [
        "ACC-035C"
      ]
    },
    {
      "action_id": "ACT-048A",
      "work_order_id": "WO-048",
      "owner": "xuanxue repository governance owner",
      "caller_or_actor": "xuanxue repository governance owner",
      "entrypoint_or_channel": "deliverable://construction-admission/xuanxue-repository-governance-policy.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://construction-admission/xuanxue-candidate.json ; deliverable://work-orders/WO-030/cross-repo-receipt.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/xuanxue-repository-governance-policy.json ; deliverable://browser-release/xuanxue-branch-protection-prestate.json ; deliverable://browser-release/xuanxue-branch-protection-readback.json ; deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json ; system://github/ADVISION-X/xuanxue-web/branches/main/protection/required_status_checks",
      "input_contract": "deliverable://construction-admission/xuanxue-candidate.json ; deliverable://work-orders/WO-030/cross-repo-receipt.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/xuanxue-repository-governance-policy.json",
      "output_contract": "deliverable://browser-release/xuanxue-branch-protection-prestate.json",
      "state_transition": "GET and sign the exact pre-state; verify exact strict/contexts from the repository governance owner's signed policy and bind candidate/repo/branch.",
      "idempotency_or_replay": "Repeat only while candidate, repository policy and GET pre-state hashes are unchanged.",
      "audit_or_receipt": "ACC-048A",
      "error_semantics": "Do not PATCH; emit FAIL.",
      "acceptance_ids": [
        "ACC-048A"
      ]
    },
    {
      "action_id": "ACT-048B",
      "work_order_id": "WO-048",
      "owner": "xuanxue repository governance owner",
      "caller_or_actor": "xuanxue repository governance owner",
      "entrypoint_or_channel": "gh api --method PATCH repos/ADVISION-X/xuanxue-web/branches/main/protection/required_status_checks",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://construction-admission/xuanxue-candidate.json ; deliverable://work-orders/WO-030/cross-repo-receipt.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/xuanxue-repository-governance-policy.json ; deliverable://browser-release/xuanxue-branch-protection-prestate.json ; deliverable://browser-release/xuanxue-branch-protection-readback.json ; deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json ; system://github/ADVISION-X/xuanxue-web/branches/main/protection/required_status_checks",
      "input_contract": "deliverable://construction-admission/xuanxue-candidate.json ; deliverable://work-orders/WO-030/cross-repo-receipt.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/xuanxue-repository-governance-policy.json",
      "output_contract": "deliverable://browser-release/xuanxue-branch-protection-readback.json",
      "state_transition": "PATCH exact desired strict/contexts, GET the same endpoint, and sign exact post-state readback.",
      "idempotency_or_replay": "Repeat only when current GET equals signed pre-state or exact desired post-state; any third state fails closed.",
      "audit_or_receipt": "ACC-048B",
      "error_semantics": "Invoke ACT-048C before reporting failure.",
      "acceptance_ids": [
        "ACC-048B"
      ]
    },
    {
      "action_id": "ACT-048C",
      "work_order_id": "WO-048",
      "owner": "xuanxue repository governance owner",
      "caller_or_actor": "xuanxue repository governance owner",
      "entrypoint_or_channel": "gh api --method PATCH repos/ADVISION-X/xuanxue-web/branches/main/protection/required_status_checks",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://construction-admission/xuanxue-candidate.json ; deliverable://work-orders/WO-030/cross-repo-receipt.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/xuanxue-repository-governance-policy.json ; deliverable://browser-release/xuanxue-branch-protection-prestate.json ; deliverable://browser-release/xuanxue-branch-protection-readback.json ; deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json ; system://github/ADVISION-X/xuanxue-web/branches/main/protection/required_status_checks",
      "input_contract": "deliverable://construction-admission/xuanxue-candidate.json ; deliverable://work-orders/WO-030/cross-repo-receipt.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/xuanxue-repository-governance-policy.json",
      "output_contract": "deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json",
      "state_transition": "On ACT-B failure, PATCH the exact signed pre-state, GET again, and record RESTORED or RECOVERY_FAILED; on ACT-B success record NOT_REQUIRED.",
      "idempotency_or_replay": "Repeat only while current GET equals the failed/desired state or already equals signed pre-state; any third state fails closed.",
      "audit_or_receipt": "ACC-048C",
      "error_semantics": "RECOVERY_FAILED is terminal and blocks release.",
      "acceptance_ids": [
        "ACC-048C"
      ]
    },
    {
      "action_id": "ACT-049",
      "work_order_id": "WO-049",
      "owner": "provider journey authorization owner",
      "caller_or_actor": "provider journey authorization owner",
      "entrypoint_or_channel": "deliverable://construction-admission/provider-journey-authorization.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://construction-admission/operator-provider-journey-request.json ; deliverable://construction-admission/provider-journey-authorization.json",
      "input_contract": "deliverable://construction-admission/operator-provider-journey-request.json",
      "output_contract": "deliverable://construction-admission/provider-journey-authorization.json",
      "state_transition": "由 operator 明确账户、journey 范围、敏感动作边界、人工门、8 小时窗口和中止权限；缺失只阻断业务证据及发布链。",
      "idempotency_or_replay": "An incomplete or rejected authorization is discarded; only a newly signed operator authorization may replace it. No remote or runtime mutation occurs.",
      "audit_or_receipt": "ACC-049",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop only the work orders that depend on this result.",
      "acceptance_ids": [
        "ACC-049"
      ]
    },
    {
      "action_id": "ACT-003",
      "work_order_id": "WO-003",
      "owner": "release operations owner",
      "caller_or_actor": "release operations owner",
      "entrypoint_or_channel": "deliverable://construction-admission/external-operations.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md ; deliverable://construction-admission/external-operations.json",
      "input_contract": "docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md",
      "output_contract": "deliverable://construction-admission/external-operations.json",
      "state_transition": "只冻结 CWS、签名/公证、managed profile、两台独立 HA worker 与 release key custody；不决定任何仓库 required-check policy。",
      "idempotency_or_replay": "Read-only checks may repeat on the same constructed candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-003",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-003"
      ]
    },
    {
      "action_id": "ACT-014",
      "work_order_id": "WO-014",
      "owner": "Native Host owner",
      "caller_or_actor": "Native Host owner",
      "entrypoint_or_channel": "src/lib/browser/native-messaging-host/crates/host/Cargo.toml",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/browser/protocol/generated/browser-protocol.generated.ts ; src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs ; src/lib/browser/native-messaging-host/Cargo.toml ; src/lib/browser/native-messaging-host/crates/host/Cargo.toml ; src/lib/browser/native-messaging-host/crates/host/src/main.rs ; src/lib/browser/native-messaging-host/crates/host/src/browser-native-framing.rs ; src/lib/browser/native-messaging-host/crates/host/src/raw-channel.rs ; src/lib/browser/native-messaging-host/crates/host/src/authenticated-channel.rs ; src/lib/browser/native-messaging-host/crates/host/src/transcript.rs ; src/lib/browser/native-messaging-host/crates/host/src/artifact-stream.rs ; src/lib/browser/native-messaging-host/crates/host/tests/native-host.acceptance.rs ; src/lib/browser/native-messaging-host/Cargo.lock ; src/lib/browser/native-messaging-host/crates/host/fuzz/Cargo.toml ; src/lib/browser/native-messaging-host/crates/host/fuzz/fuzz_targets/native_framing.rs ; src/lib/browser/native-messaging-host/crates/host/fuzz/corpus/native_framing/seed.bin",
      "input_contract": "src/lib/browser/protocol/generated/browser-protocol.generated.ts ; src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs",
      "output_contract": "src/lib/browser/native-messaging-host/Cargo.toml ; src/lib/browser/native-messaging-host/crates/host/Cargo.toml ; src/lib/browser/native-messaging-host/crates/host/src/main.rs ; src/lib/browser/native-messaging-host/crates/host/src/browser-native-framing.rs ; src/lib/browser/native-messaging-host/crates/host/src/raw-channel.rs ; src/lib/browser/native-messaging-host/crates/host/src/authenticated-channel.rs ; src/lib/browser/native-messaging-host/crates/host/src/transcript.rs ; src/lib/browser/native-messaging-host/crates/host/src/artifact-stream.rs ; src/lib/browser/native-messaging-host/crates/host/tests/native-host.acceptance.rs ; src/lib/browser/native-messaging-host/Cargo.lock ; src/lib/browser/native-messaging-host/crates/host/fuzz/Cargo.toml ; src/lib/browser/native-messaging-host/crates/host/fuzz/fuzz_targets/native_framing.rs ; src/lib/browser/native-messaging-host/crates/host/fuzz/corpus/native_framing/seed.bin",
      "state_transition": "只建设 framing、认证握手、单 Port 与有界 I/O 的 Host。",
      "idempotency_or_replay": "Read-only checks may repeat on the same constructed candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-014",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-014"
      ]
    },
    {
      "action_id": "ACT-022",
      "work_order_id": "WO-022",
      "owner": "Browser release identity owner",
      "caller_or_actor": "Browser release identity owner",
      "entrypoint_or_channel": "src/lib/browser/release/release-identity.acceptance.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/browser/protocol/browser-protocol.schema.json ; src/lib/browser/protocol/generated/browser-protocol.generated.ts ; src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs ; src/lib/browser/release/browser-artifact-set.schema.json ; src/lib/browser/release/browser-activation-tuple.schema.json ; src/lib/browser/release/browser-release-proof.schema.json ; src/lib/browser/release/browser-release-security-policy.schema.json ; src/lib/browser/release/browser-rollback-receipt.schema.json ; src/lib/browser/release/browser-build-inputs.schema.json ; src/lib/browser/release/browser-sbom.schema.json ; src/lib/browser/release/browser-provenance.schema.json ; src/lib/browser/release/pinned-browser-toolchain.json ; src/lib/browser/release/active-activation.json ; src/lib/browser/release/release-identity.acceptance.ts ; src/lib/browser/release/browser-build.config.json ; src/lib/browser/release/browser-previous-activation-snapshot.schema.json",
      "input_contract": "src/lib/browser/protocol/browser-protocol.schema.json ; src/lib/browser/protocol/generated/browser-protocol.generated.ts ; src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs",
      "output_contract": "src/lib/browser/release/browser-artifact-set.schema.json ; src/lib/browser/release/browser-activation-tuple.schema.json ; src/lib/browser/release/browser-release-proof.schema.json ; src/lib/browser/release/browser-release-security-policy.schema.json ; src/lib/browser/release/browser-rollback-receipt.schema.json ; src/lib/browser/release/browser-build-inputs.schema.json ; src/lib/browser/release/browser-sbom.schema.json ; src/lib/browser/release/browser-provenance.schema.json ; src/lib/browser/release/pinned-browser-toolchain.json ; src/lib/browser/release/active-activation.json ; src/lib/browser/release/release-identity.acceptance.ts ; src/lib/browser/release/browser-build.config.json ; src/lib/browser/release/browser-previous-activation-snapshot.schema.json",
      "state_transition": "只建立 ArtifactSet、ActivationTuple、ReleaseSecurityPolicy、ProofManifest、rollback、SBOM、provenance 与 build-input schemas，并初始化空 ABSENT slot；不签发任何候选身份。",
      "idempotency_or_replay": "Read-only checks may repeat on the same constructed candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-022",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-022"
      ]
    },
    {
      "action_id": "ACT-023",
      "work_order_id": "WO-023",
      "owner": "local-runtime owner",
      "caller_or_actor": "local-runtime owner",
      "entrypoint_or_channel": "src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "src/lib/browser/infrastructure/browser-authority-broker.ts ; src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts ; src/lib/browser/exact-target/browser-target-lease.ts ; src/lib/browser/exact-target/browser-target-lease-manager.ts ; src/lib/browser/exact-target/browser-command-actor.ts ; src/lib/browser/transport/command-permit.ts ; src/lib/browser/profile/browser-profile-enrollment.ts ; src/lib/browser/profile/browser-process-supervisor.ts ; src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts ; src/lib/local-runtime/workbench-assembly.ts ; src/lib/local-runtime/workbench-ai-gateway-support.ts ; src/lib/local-runtime/workbench-status.ts ; src/lib/local-runtime/workbench.ts",
      "input_contract": "src/lib/browser/infrastructure/browser-authority-broker.ts ; src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts ; src/lib/browser/exact-target/browser-target-lease.ts ; src/lib/browser/exact-target/browser-target-lease-manager.ts ; src/lib/browser/exact-target/browser-command-actor.ts ; src/lib/browser/transport/command-permit.ts ; src/lib/browser/profile/browser-profile-enrollment.ts ; src/lib/browser/profile/browser-process-supervisor.ts",
      "output_contract": "src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts",
      "state_transition": "Local Runtime 只注入 Broker；assembly 不领取或缓存 target lease；已退休的 workbench-browser-support.ts 与 workbench-video-download-support.ts 永久不存在。",
      "idempotency_or_replay": "Read-only checks may repeat on the same constructed candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-023",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-023"
      ]
    },
    {
      "action_id": "ACT-041",
      "work_order_id": "WO-041",
      "owner": "independent read-only audit owner",
      "caller_or_actor": "independent read-only audit owner",
      "entrypoint_or_channel": "deliverable://browser-release/independent-audit.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://work-orders/WO-031/26-check-receipt.json ; deliverable://work-orders/WO-030/cross-repo-receipt.json ; deliverable://browser-release/artifact-set.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/real-chrome-matrix.json ; deliverable://browser-release/business-workday-receipt.json ; deliverable://browser-release/branch-protection-readback.json ; deliverable://browser-release/ha-handover.json ; deliverable://browser-release/soak-24h.json ; deliverable://browser-release/soak-168h.json ; deliverable://browser-release/ci-full-receipt.json ; deliverable://browser-release/xuanxue-branch-protection-readback.json ; deliverable://browser-release/browser-build-input-lock.json ; deliverable://browser-release/sbom.spdx.json ; deliverable://browser-release/provenance.json ; deliverable://browser-release/installed-artifact-readback.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-release/agent-branch-protection-prestate.json ; deliverable://browser-release/agent-branch-protection-recovery-receipt.json ; deliverable://browser-release/xuanxue-branch-protection-prestate.json ; deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/agent-repository-governance-policy.json ; deliverable://construction-admission/xuanxue-repository-governance-policy.json ; deliverable://browser-release/independent-audit.json",
      "input_contract": "deliverable://work-orders/WO-031/26-check-receipt.json ; deliverable://work-orders/WO-030/cross-repo-receipt.json ; deliverable://browser-release/artifact-set.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/real-chrome-matrix.json ; deliverable://browser-release/business-workday-receipt.json ; deliverable://browser-release/branch-protection-readback.json ; deliverable://browser-release/ha-handover.json ; deliverable://browser-release/soak-24h.json ; deliverable://browser-release/soak-168h.json ; deliverable://browser-release/ci-full-receipt.json ; deliverable://browser-release/xuanxue-branch-protection-readback.json ; deliverable://browser-release/browser-build-input-lock.json ; deliverable://browser-release/sbom.spdx.json ; deliverable://browser-release/provenance.json ; deliverable://browser-release/installed-artifact-readback.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-release/agent-branch-protection-prestate.json ; deliverable://browser-release/agent-branch-protection-recovery-receipt.json ; deliverable://browser-release/xuanxue-branch-protection-prestate.json ; deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/agent-repository-governance-policy.json ; deliverable://construction-admission/xuanxue-repository-governance-policy.json",
      "output_contract": "deliverable://browser-release/independent-audit.json",
      "state_transition": "独立审计者绑定同一候选和 artifact，审查法案执法面、旧路径零可达与所有 proof receipts。",
      "idempotency_or_replay": "A fresh auditor identity and clean context are required for every constructed candidate; prior audit output cannot be reused.",
      "audit_or_receipt": "ACC-041",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-041"
      ]
    },
    {
      "action_id": "ACT-056",
      "work_order_id": "WO-056",
      "owner": "AGENT repository governance owner",
      "caller_or_actor": "AGENT repository governance owner",
      "entrypoint_or_channel": "deliverable://construction-admission/agent-repository-governance-policy.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://construction-admission/agent-repository-governance-request.json ; deliverable://construction-admission/agent-repository-governance-policy.json",
      "input_contract": "deliverable://construction-admission/agent-repository-governance-request.json",
      "output_contract": "deliverable://construction-admission/agent-repository-governance-policy.json",
      "state_transition": "签发 ADVISION-X/AGENT main 的 repo、branch、strict、exact contexts、construction branch commit/push 权限、expected remote ref、保护规则变更权限与恢复权限。",
      "idempotency_or_replay": "Read-only checks may repeat on the same constructed candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-056",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-056"
      ]
    },
    {
      "action_id": "ACT-057",
      "work_order_id": "WO-057",
      "owner": "xuanxue repository governance owner",
      "caller_or_actor": "xuanxue repository governance owner",
      "entrypoint_or_channel": "deliverable://construction-admission/xuanxue-repository-governance-policy.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://construction-admission/xuanxue-repository-governance-request.json ; deliverable://construction-admission/xuanxue-repository-governance-policy.json",
      "input_contract": "deliverable://construction-admission/xuanxue-repository-governance-request.json",
      "output_contract": "deliverable://construction-admission/xuanxue-repository-governance-policy.json",
      "state_transition": "签发 ADVISION-X/xuanxue-web main 的 repo、branch、strict、exact contexts、construction branch commit/push 权限、expected remote ref、保护规则变更权限与恢复权限。",
      "idempotency_or_replay": "Read-only checks may repeat on the same constructed candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-057",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-057"
      ]
    },
    {
      "action_id": "ACT-058",
      "work_order_id": "WO-058",
      "owner": "AGENT repository governance owner",
      "caller_or_actor": "AGENT repository governance owner",
      "entrypoint_or_channel": "git push --force-with-lease=<expected-old-ref> origin HEAD:refs/heads/codex/browser-greenfield",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://construction-admission/agent-repository-governance-policy.json ; system://git/ADVISION-X/AGENT/worktree-and-index ; package.json ; package-lock.json ; tsconfig.json ; deliverable://browser-release/agent-constructed-tree-manifest.json ; deliverable://browser-release/agent-build-input-manifest.json ; deliverable://browser-release/agent-constructed-source-bundle.tar.zst ; deliverable://browser-release/agent-constructed-candidate.json ; deliverable://browser-release/agent-remote-candidate-readback.json ; system://git/ADVISION-X/AGENT/refs/heads/codex/browser-greenfield",
      "input_contract": "deliverable://construction-admission/agent-repository-governance-policy.json ; system://git/ADVISION-X/AGENT/worktree-and-index ; package.json ; package-lock.json ; tsconfig.json",
      "output_contract": "deliverable://browser-release/agent-constructed-tree-manifest.json ; deliverable://browser-release/agent-build-input-manifest.json ; deliverable://browser-release/agent-constructed-source-bundle.tar.zst ; deliverable://browser-release/agent-constructed-candidate.json ; deliverable://browser-release/agent-remote-candidate-readback.json",
      "state_transition": "在所有 AGENT 源码、audit 与 acceptance 建设完成后，生成 content-addressed tree/build-input manifest 与 source bundle；在获准 construction branch 上 commit/push，并以 git ls-remote 读回相同 SHA。",
      "idempotency_or_replay": "Repeat only when local tree hash is identical and remote ref equals expected old ref or already equals the exact new SHA.",
      "audit_or_receipt": "ACC-058",
      "error_semantics": "Do not build or change main protection; restore neither old Browser code nor an unverified remote ref.",
      "acceptance_ids": [
        "ACC-058"
      ]
    },
    {
      "action_id": "ACT-059",
      "work_order_id": "WO-059",
      "owner": "xuanxue repository governance owner",
      "caller_or_actor": "xuanxue repository governance owner",
      "entrypoint_or_channel": "git push --force-with-lease=<expected-old-ref> origin HEAD:refs/heads/codex/browser-greenfield",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://construction-admission/xuanxue-repository-governance-policy.json ; system://git/ADVISION-X/xuanxue-web/worktree-and-index ; deliverable://work-orders/WO-030/cross-repo-receipt.json ; deliverable://browser-release/xuanxue-constructed-tree-manifest.json ; deliverable://browser-release/xuanxue-constructed-source-bundle.tar.zst ; deliverable://browser-release/xuanxue-constructed-candidate.json ; deliverable://browser-release/xuanxue-remote-candidate-readback.json ; system://git/ADVISION-X/xuanxue-web/refs/heads/codex/browser-greenfield",
      "input_contract": "deliverable://construction-admission/xuanxue-repository-governance-policy.json ; system://git/ADVISION-X/xuanxue-web/worktree-and-index ; deliverable://work-orders/WO-030/cross-repo-receipt.json",
      "output_contract": "deliverable://browser-release/xuanxue-constructed-tree-manifest.json ; deliverable://browser-release/xuanxue-constructed-source-bundle.tar.zst ; deliverable://browser-release/xuanxue-constructed-candidate.json ; deliverable://browser-release/xuanxue-remote-candidate-readback.json",
      "state_transition": "在 xuanxue 三条授权路径和跨仓验收完成后，生成 content-addressed tree/source bundle；在获准 construction branch 上 commit/push，并以 git ls-remote 读回相同 SHA。",
      "idempotency_or_replay": "Repeat only when the three authorized xuanxue paths and tree hash are identical and remote ref equals expected old ref or exact new SHA.",
      "audit_or_receipt": "ACC-059",
      "error_semantics": "Do not build, mutate main protection or produce Dynamic Proof from an unverified candidate.",
      "acceptance_ids": [
        "ACC-059"
      ]
    },
    {
      "action_id": "ACT-060",
      "work_order_id": "WO-060",
      "owner": "cross-repo release candidate owner",
      "caller_or_actor": "cross-repo release candidate owner",
      "entrypoint_or_channel": "deliverable://browser-release/constructed-release-candidate.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://browser-release/agent-constructed-tree-manifest.json ; deliverable://browser-release/agent-constructed-candidate.json ; deliverable://browser-release/agent-remote-candidate-readback.json ; deliverable://browser-release/xuanxue-constructed-tree-manifest.json ; deliverable://browser-release/xuanxue-constructed-candidate.json ; deliverable://browser-release/xuanxue-remote-candidate-readback.json ; deliverable://work-orders/WO-030/cross-repo-receipt.json ; deliverable://browser-release/constructed-release-candidate.json",
      "input_contract": "deliverable://browser-release/agent-constructed-tree-manifest.json ; deliverable://browser-release/agent-constructed-candidate.json ; deliverable://browser-release/agent-remote-candidate-readback.json ; deliverable://browser-release/xuanxue-constructed-tree-manifest.json ; deliverable://browser-release/xuanxue-constructed-candidate.json ; deliverable://browser-release/xuanxue-remote-candidate-readback.json ; deliverable://work-orders/WO-030/cross-repo-receipt.json",
      "output_contract": "deliverable://browser-release/constructed-release-candidate.json",
      "state_transition": "把施工后 AGENT 与 xuanxue 的 clean tree、commit SHA、remote SHA、content manifests 与 cross-repo contract hash 组合成唯一 constructed-release-candidate identity。",
      "idempotency_or_replay": "The composite identity is immutable; any repository SHA/tree/remote/contract drift requires a new WO-060 output.",
      "audit_or_receipt": "ACC-060",
      "error_semantics": "Invalidate both constructed candidates; no ArtifactSet, CI, branch mutation, Chrome, HA, provider, proof or activation may proceed.",
      "acceptance_ids": [
        "ACC-060"
      ]
    },
    {
      "action_id": "ACT-033",
      "work_order_id": "WO-033",
      "owner": "release build owner",
      "caller_or_actor": "release build owner",
      "entrypoint_or_channel": "src/lib/browser/release/build-artifacts.mjs",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://construction-admission/external-operations.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://browser-release/agent-constructed-tree-manifest.json ; deliverable://browser-release/agent-build-input-manifest.json ; deliverable://browser-release/agent-constructed-source-bundle.tar.zst ; deliverable://browser-release/xuanxue-constructed-tree-manifest.json ; deliverable://browser-release/xuanxue-constructed-source-bundle.tar.zst ; artifact://browser-release/controller/controller-bundle.tgz ; artifact://browser-release/native-host/grasseye-browser-host ; artifact://browser-release/browserctl/browserctl ; artifact://browser-release/launcher/grasseye-browser-launcher ; artifact://browser-release/platform-macos/libgrasseye-platform-macos.a ; artifact://browser-release/extension/grasseye-browser-extension.verified.crx ; artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json ; artifact://browser-release/checksums/SHA256SUMS ; artifact://browser-release/signatures/SHA256SUMS.sig ; deliverable://browser-release/browser-build-input-lock.json ; deliverable://browser-release/artifact-set.json ; deliverable://browser-release/builder-a-receipt.json ; deliverable://browser-release/builder-b-receipt.json ; deliverable://browser-release/sbom.spdx.json ; deliverable://browser-release/provenance.json ; deliverable://browser-release/installed-artifact-readback.json ; src/lib/browser/release/build-artifacts.mjs ; src/lib/browser/release/verify-artifacts.mjs",
      "input_contract": "deliverable://construction-admission/external-operations.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://browser-release/agent-constructed-tree-manifest.json ; deliverable://browser-release/agent-build-input-manifest.json ; deliverable://browser-release/agent-constructed-source-bundle.tar.zst ; deliverable://browser-release/xuanxue-constructed-tree-manifest.json ; deliverable://browser-release/xuanxue-constructed-source-bundle.tar.zst",
      "output_contract": "artifact://browser-release/controller/controller-bundle.tgz ; artifact://browser-release/native-host/grasseye-browser-host ; artifact://browser-release/browserctl/browserctl ; artifact://browser-release/launcher/grasseye-browser-launcher ; artifact://browser-release/platform-macos/libgrasseye-platform-macos.a ; artifact://browser-release/extension/grasseye-browser-extension.verified.crx ; artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json ; artifact://browser-release/checksums/SHA256SUMS ; artifact://browser-release/signatures/SHA256SUMS.sig ; deliverable://browser-release/browser-build-input-lock.json ; deliverable://browser-release/artifact-set.json ; deliverable://browser-release/builder-a-receipt.json ; deliverable://browser-release/builder-b-receipt.json ; deliverable://browser-release/sbom.spdx.json ; deliverable://browser-release/provenance.json ; deliverable://browser-release/installed-artifact-readback.json ; src/lib/browser/release/build-artifacts.mjs ; src/lib/browser/release/verify-artifacts.mjs",
      "state_transition": "只从 WO-060 冻结的 source bundles/tree manifests 与精确 package/tsconfig/build config 输入构建 Controller、Host、browserctl、launcher、platform adapter、Verified CRX、Native Messaging manifest、checksums/signature 九个实体；ArtifactSet 仅索引这些 content-addressed entities。",
      "idempotency_or_replay": "Two builders must consume the identical WO-060 candidate, source bundle, build-input manifest, toolchain and build config; any byte/input drift invalidates all entities.",
      "audit_or_receipt": "ACC-033",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-033"
      ]
    },
    {
      "action_id": "ACT-039",
      "work_order_id": "WO-039",
      "owner": "release activation owner",
      "caller_or_actor": "release activation owner",
      "entrypoint_or_channel": "src/lib/browser/native-messaging-host/target/release/browserctl activate --expected-current <hash> --new <hash> --proof <hash>",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://browser-release/BrowserReleaseProofManifestV1.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://browser-release/activation-receipt.json ; deliverable://browser-release/previous-activation-snapshot.json ; system://browser-release/active-activation-slot ; deliverable://browser-release/construction-blocked-browser-authority",
      "input_contract": "deliverable://browser-release/BrowserReleaseProofManifestV1.json ; deliverable://browser-release/constructed-release-candidate.json",
      "output_contract": "deliverable://browser-release/activation-receipt.json ; deliverable://browser-release/previous-activation-snapshot.json",
      "state_transition": "只消费已签 proof manifest，先签发 PreviousActivationSnapshot=SIGNED_ABSENT 或 SIGNED_PRESENT(tuple)，再 CAS 切换一个 active tuple。",
      "idempotency_or_replay": "Same constructed candidate and idempotency key may read back the identical active tuple; mismatch never overwrites.",
      "audit_or_receipt": "ACC-039",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-039"
      ]
    },
    {
      "action_id": "ACT-052",
      "work_order_id": "WO-052",
      "owner": "browserctl owner",
      "caller_or_actor": "browserctl owner",
      "entrypoint_or_channel": "src/lib/browser/native-messaging-host/target/release/browserctl recover --snapshot deliverable://browser-release/previous-activation-snapshot.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://browser-release/recovery-authority-revoke.json ; deliverable://browser-release/activation-receipt.json ; deliverable://browser-release/previous-activation-snapshot.json ; deliverable://browser-release/BrowserReleaseProofManifestV1.json ; src/lib/browser/native-messaging-host/crates/browserctl/src/rollback.rs ; artifact://browser-release/controller/controller-bundle.tgz ; artifact://browser-release/native-host/grasseye-browser-host ; artifact://browser-release/browserctl/browserctl ; artifact://browser-release/launcher/grasseye-browser-launcher ; artifact://browser-release/platform-macos/libgrasseye-platform-macos.a ; artifact://browser-release/extension/grasseye-browser-extension.verified.crx ; artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json ; artifact://browser-release/checksums/SHA256SUMS ; artifact://browser-release/signatures/SHA256SUMS.sig ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://browser-release/recovery-browserctl-rollback.json ; system://browser-profile/installed-artifact-state#recover-signed-present-or-absent",
      "input_contract": "deliverable://browser-release/recovery-authority-revoke.json ; deliverable://browser-release/activation-receipt.json ; deliverable://browser-release/previous-activation-snapshot.json ; deliverable://browser-release/BrowserReleaseProofManifestV1.json ; src/lib/browser/native-messaging-host/crates/browserctl/src/rollback.rs ; artifact://browser-release/controller/controller-bundle.tgz ; artifact://browser-release/native-host/grasseye-browser-host ; artifact://browser-release/browserctl/browserctl ; artifact://browser-release/launcher/grasseye-browser-launcher ; artifact://browser-release/platform-macos/libgrasseye-platform-macos.a ; artifact://browser-release/extension/grasseye-browser-extension.verified.crx ; artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json ; artifact://browser-release/checksums/SHA256SUMS ; artifact://browser-release/signatures/SHA256SUMS.sig ; deliverable://browser-release/constructed-release-candidate.json",
      "output_contract": "deliverable://browser-release/recovery-browserctl-rollback.json",
      "state_transition": "若 snapshot 为 SIGNED_PRESENT，browserctl 安装回退到 previous tuple；若为 SIGNED_ABSENT，browserctl 卸载/隔离失败新 artifact 并证明 profile/process/policy/tree 无可用 Browser authority。",
      "idempotency_or_replay": "SIGNED_PRESENT repeats only from failed new tuple or restored previous tuple; SIGNED_ABSENT repeats only from failed new installation or fully isolated state.",
      "audit_or_receipt": "ACC-052",
      "error_semantics": "Emit RECOVERY_FAILED_INSTALLATION and stop; authority remains ABSENT.",
      "acceptance_ids": [
        "ACC-052"
      ]
    },
    {
      "action_id": "ACT-053",
      "work_order_id": "WO-053",
      "owner": "release activation owner",
      "caller_or_actor": "release activation owner",
      "entrypoint_or_channel": "system://browser-release/active-activation-slot#rollback-present-or-absent",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://browser-release/recovery-browserctl-rollback.json ; deliverable://browser-release/activation-receipt.json ; deliverable://browser-release/previous-activation-snapshot.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://browser-release/recovery-active-slot-cas.json ; system://browser-release/active-activation-slot#rollback-present-or-absent",
      "input_contract": "deliverable://browser-release/recovery-browserctl-rollback.json ; deliverable://browser-release/activation-receipt.json ; deliverable://browser-release/previous-activation-snapshot.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/constructed-release-candidate.json",
      "output_contract": "deliverable://browser-release/recovery-active-slot-cas.json",
      "state_transition": "仅由 activation owner 把 active slot 从失败新 tuple CAS 到 SIGNED_PRESENT 的 previous tuple，或 CAS 到 SIGNED_ABSENT。",
      "idempotency_or_replay": "Repeat only from failed new tuple or already-restored snapshot value.",
      "audit_or_receipt": "ACC-053",
      "error_semantics": "Emit RECOVERY_FAILED_ACTIVE_SLOT and stop; authority remains ABSENT and consumers remain blocked.",
      "acceptance_ids": [
        "ACC-053"
      ]
    },
    {
      "action_id": "ACT-055",
      "work_order_id": "WO-055",
      "owner": "production recovery readback owner",
      "caller_or_actor": "production recovery readback owner",
      "entrypoint_or_channel": "deliverable://browser-release/post-rollback-readback.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://browser-release/recovery-authority-revoke.json ; deliverable://browser-release/recovery-browserctl-rollback.json ; deliverable://browser-release/recovery-active-slot-cas.json ; deliverable://browser-release/recovery-consumer-blocked.json ; deliverable://browser-release/previous-activation-snapshot.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://browser-release/post-rollback-readback.json ; deliverable://browser-release/new-attempt-admission.json",
      "input_contract": "deliverable://browser-release/recovery-authority-revoke.json ; deliverable://browser-release/recovery-browserctl-rollback.json ; deliverable://browser-release/recovery-active-slot-cas.json ; deliverable://browser-release/recovery-consumer-blocked.json ; deliverable://browser-release/previous-activation-snapshot.json ; deliverable://browser-release/constructed-release-candidate.json",
      "output_contract": "deliverable://browser-release/post-rollback-readback.json ; deliverable://browser-release/new-attempt-admission.json",
      "state_transition": "独立验证 authority ABSENT、SIGNED_PRESENT 时 previous tuple 已安装且 active，或 SIGNED_ABSENT 时无可用 Browser artifact 且 slot 为 ABSENT；两分支均要求 CON-001..CON-011 BLOCKED。",
      "idempotency_or_replay": "Read-only verification may repeat for the same failed activation and snapshot.",
      "audit_or_receipt": "ACC-055",
      "error_semantics": "Emit RECOVERY_TERMINAL_BLOCKED; retain authority ABSENT and all consumers BLOCKED.",
      "acceptance_ids": [
        "ACC-055"
      ]
    },
    {
      "action_id": "ACT-034",
      "work_order_id": "WO-034",
      "owner": "real Chrome evidence owner",
      "caller_or_actor": "real Chrome evidence owner",
      "entrypoint_or_channel": "scripts/acceptance/local-browser-real-chrome-terminal.acceptance.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://browser-release/artifact-set.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-observation/preconstruction-chrome.json ; artifact://browser-release/controller/controller-bundle.tgz ; artifact://browser-release/native-host/grasseye-browser-host ; artifact://browser-release/browserctl/browserctl ; artifact://browser-release/launcher/grasseye-browser-launcher ; artifact://browser-release/platform-macos/libgrasseye-platform-macos.a ; artifact://browser-release/extension/grasseye-browser-extension.verified.crx ; artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json ; artifact://browser-release/checksums/SHA256SUMS ; artifact://browser-release/signatures/SHA256SUMS.sig ; deliverable://browser-release/constructed-release-candidate.json ; scripts/acceptance/local-browser-real-chrome-terminal.acceptance.ts ; deliverable://browser-release/real-chrome-matrix.json",
      "input_contract": "deliverable://browser-release/artifact-set.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-observation/preconstruction-chrome.json ; artifact://browser-release/controller/controller-bundle.tgz ; artifact://browser-release/native-host/grasseye-browser-host ; artifact://browser-release/browserctl/browserctl ; artifact://browser-release/launcher/grasseye-browser-launcher ; artifact://browser-release/platform-macos/libgrasseye-platform-macos.a ; artifact://browser-release/extension/grasseye-browser-extension.verified.crx ; artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json ; artifact://browser-release/checksums/SHA256SUMS ; artifact://browser-release/signatures/SHA256SUMS.sig ; deliverable://browser-release/constructed-release-candidate.json",
      "output_contract": "scripts/acceptance/local-browser-real-chrome-terminal.acceptance.ts ; deliverable://browser-release/real-chrome-matrix.json",
      "state_transition": "在 Stable 与 CfT 上对同一 ArtifactSet、ActivationTuple candidate 与 ReleaseSecurityPolicy 完成 profile/process/policy、auth、target、file、stream、update 与 rollback 正反终态。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-034",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-034"
      ]
    },
    {
      "action_id": "ACT-036",
      "work_order_id": "WO-036",
      "owner": "HA operations owner",
      "caller_or_actor": "HA operations owner",
      "entrypoint_or_channel": "deliverable://browser-release/ha-handover.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://construction-admission/external-operations.json ; deliverable://construction-admission/xuanxue-candidate.json ; deliverable://browser-release/real-chrome-matrix.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://browser-release/ha-handover.json",
      "input_contract": "deliverable://construction-admission/external-operations.json ; deliverable://construction-admission/xuanxue-candidate.json ; deliverable://browser-release/real-chrome-matrix.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-release/constructed-release-candidate.json",
      "output_contract": "deliverable://browser-release/ha-handover.json",
      "state_transition": "一主一热备只消费 xuanxue 数据库 fence，完成 revoke/checkpoint/fresh-window 交接并证明零 dual-active。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-036",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-036"
      ]
    },
    {
      "action_id": "ACT-037",
      "work_order_id": "WO-037",
      "owner": "soak evidence owner",
      "caller_or_actor": "soak evidence owner",
      "entrypoint_or_channel": "deliverable://browser-release/soak-24h.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://browser-release/ha-handover.json ; deliverable://browser-release/artifact-set.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://browser-release/soak-24h.json ; deliverable://browser-release/soak-168h.json",
      "input_contract": "deliverable://browser-release/ha-handover.json ; deliverable://browser-release/artifact-set.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-release/constructed-release-candidate.json",
      "output_contract": "deliverable://browser-release/soak-24h.json ; deliverable://browser-release/soak-168h.json",
      "state_transition": "对同一 ArtifactSet 和 HA 拓扑完成法定时长，任何 forbidden metric 非零即整段作废。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-037",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-037"
      ]
    },
    {
      "action_id": "ACT-038",
      "work_order_id": "WO-038",
      "owner": "release proof owner",
      "caller_or_actor": "release proof owner",
      "entrypoint_or_channel": "deliverable://browser-release/BrowserReleaseProofManifestV1.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://work-orders/WO-031/26-check-receipt.json ; deliverable://work-orders/WO-030/cross-repo-receipt.json ; deliverable://browser-release/artifact-set.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/real-chrome-matrix.json ; deliverable://browser-release/business-workday-receipt.json ; deliverable://browser-release/branch-protection-readback.json ; deliverable://browser-release/ha-handover.json ; deliverable://browser-release/soak-24h.json ; deliverable://browser-release/soak-168h.json ; deliverable://browser-release/ci-full-receipt.json ; deliverable://browser-release/independent-audit.json ; scripts/audit/generated/audit-plan.generated.json ; deliverable://browser-release/xuanxue-branch-protection-readback.json ; deliverable://browser-release/browser-build-input-lock.json ; deliverable://browser-release/sbom.spdx.json ; deliverable://browser-release/provenance.json ; deliverable://browser-release/installed-artifact-readback.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://browser-release/BrowserReleaseProofManifestV1.json",
      "input_contract": "deliverable://work-orders/WO-031/26-check-receipt.json ; deliverable://work-orders/WO-030/cross-repo-receipt.json ; deliverable://browser-release/artifact-set.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/real-chrome-matrix.json ; deliverable://browser-release/business-workday-receipt.json ; deliverable://browser-release/branch-protection-readback.json ; deliverable://browser-release/ha-handover.json ; deliverable://browser-release/soak-24h.json ; deliverable://browser-release/soak-168h.json ; deliverable://browser-release/ci-full-receipt.json ; deliverable://browser-release/independent-audit.json ; scripts/audit/generated/audit-plan.generated.json ; deliverable://browser-release/xuanxue-branch-protection-readback.json ; deliverable://browser-release/browser-build-input-lock.json ; deliverable://browser-release/sbom.spdx.json ; deliverable://browser-release/provenance.json ; deliverable://browser-release/installed-artifact-readback.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-release/constructed-release-candidate.json",
      "output_contract": "deliverable://browser-release/BrowserReleaseProofManifestV1.json",
      "state_transition": "首次创建 proof manifest，绑定同一 candidate、ArtifactSet、ActivationTuple 候选、安全策略、26 checks、Chrome、HA、soak 与 branch readback。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-038",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-038"
      ]
    },
    {
      "action_id": "ACT-040",
      "work_order_id": "WO-040",
      "owner": "production readback owner",
      "caller_or_actor": "production readback owner",
      "entrypoint_or_channel": "deliverable://browser-release/post-activation-readback.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://browser-release/activation-receipt.json ; deliverable://browser-release/BrowserReleaseProofManifestV1.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://browser-release/post-activation-readback.json",
      "input_contract": "deliverable://browser-release/activation-receipt.json ; deliverable://browser-release/BrowserReleaseProofManifestV1.json ; deliverable://browser-release/constructed-release-candidate.json",
      "output_contract": "deliverable://browser-release/post-activation-readback.json",
      "state_transition": "只读安装、policy、process、extension、Host、authority slot 与业务 receipt；输出 PASS readback 或 POST_ACTIVATION_MISMATCH，不隐式取得 revoke、rollback、CAS 或 consumer 写权。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-040",
      "error_semantics": "Emit POST_ACTIVATION_MISMATCH and hand off only to WO-051; do not mutate authority, installation, activation slot or consumer admission in WO-040.",
      "acceptance_ids": [
        "ACC-040"
      ]
    },
    {
      "action_id": "ACT-042",
      "work_order_id": "WO-042",
      "owner": "release approval owner",
      "caller_or_actor": "release approval owner",
      "entrypoint_or_channel": "deliverable://browser-release/final-release-approval.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://browser-release/BrowserReleaseProofManifestV1.json ; deliverable://browser-release/activation-receipt.json ; deliverable://browser-release/post-activation-readback.json ; deliverable://browser-release/independent-audit.json ; deliverable://browser-release/ci-full-receipt.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://browser-release/final-release-approval.json",
      "input_contract": "deliverable://browser-release/BrowserReleaseProofManifestV1.json ; deliverable://browser-release/activation-receipt.json ; deliverable://browser-release/post-activation-readback.json ; deliverable://browser-release/independent-audit.json ; deliverable://browser-release/ci-full-receipt.json ; deliverable://browser-release/constructed-release-candidate.json",
      "output_contract": "deliverable://browser-release/final-release-approval.json",
      "state_transition": "只验证并消费 WO-044 的 candidate-bound ci-full-receipt 及全部 PASS receipts，签发 release approval；不运行 CI，不修改源码、ProofManifest、保护规则或 activation。",
      "idempotency_or_replay": "Read-only receipt verification may repeat; this work order never runs CI or mutates source, proof, branch protection or activation.",
      "audit_or_receipt": "ACC-042",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-042"
      ]
    },
    {
      "action_id": "ACT-043",
      "work_order_id": "WO-043",
      "owner": "business workday evidence owner",
      "caller_or_actor": "business workday evidence owner",
      "entrypoint_or_channel": "scripts/acceptance/local-browser-business-workday-terminal.acceptance.ts",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://browser-release/artifact-set.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/real-chrome-matrix.json ; deliverable://construction-admission/provider-journey-authorization.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-release/constructed-release-candidate.json ; scripts/acceptance/local-browser-business-workday-terminal.acceptance.ts ; deliverable://browser-release/business-workday-receipt.json",
      "input_contract": "deliverable://browser-release/artifact-set.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/real-chrome-matrix.json ; deliverable://construction-admission/provider-journey-authorization.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-release/constructed-release-candidate.json",
      "output_contract": "scripts/acceptance/local-browser-business-workday-terminal.acceptance.ts ; deliverable://browser-release/business-workday-receipt.json",
      "state_transition": "在同一 candidate、ArtifactSet、ActivationTuple candidate、ReleaseSecurityPolicy 与 release identity signature 下完成获准 provider journeys 和 8 小时业务基线，证明零 focus theft、零 keyboard interruption、零 wrong-target、有限 pause/cancel/takeover 与零 mutation replay。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-043",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-043"
      ]
    },
    {
      "action_id": "ACT-044",
      "work_order_id": "WO-044",
      "owner": "CI-FULL compliance self-check owner",
      "caller_or_actor": "CI-FULL compliance self-check owner",
      "entrypoint_or_channel": "npm run ci:full",
      "authorization": "future explicit construction authorization required",
      "object_scope": "scripts/audit/ci-full.ts ; deliverable://browser-release/business-workday-receipt.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://browser-release/ci-full-receipt.json",
      "input_contract": "scripts/audit/ci-full.ts ; deliverable://browser-release/business-workday-receipt.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-release/constructed-release-candidate.json",
      "output_contract": "deliverable://browser-release/ci-full-receipt.json",
      "state_transition": "只在同一 candidate/artifact/tuple/policy 的业务 receipt 完成后运行唯一 ci:full，并形成候选绑定 receipt；任何 failure 阻断 ProofManifest 与激活。",
      "idempotency_or_replay": "Read-only checks may repeat on the same candidate; mutations never auto-replay.",
      "audit_or_receipt": "ACC-044",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-044"
      ]
    },
    {
      "action_id": "ACT-050",
      "work_order_id": "WO-050",
      "owner": "Browser release identity owner",
      "caller_or_actor": "Browser release identity owner",
      "entrypoint_or_channel": "deliverable://browser-release/activation-tuple-candidate.json",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://construction-admission/external-operations.json ; deliverable://browser-release/browser-build-input-lock.json ; deliverable://browser-release/artifact-set.json ; deliverable://browser-release/builder-a-receipt.json ; deliverable://browser-release/builder-b-receipt.json ; deliverable://browser-release/sbom.spdx.json ; deliverable://browser-release/provenance.json ; deliverable://browser-release/installed-artifact-readback.json ; src/lib/browser/release/browser-activation-tuple.schema.json ; src/lib/browser/release/browser-release-security-policy.schema.json ; artifact://browser-release/controller/controller-bundle.tgz ; artifact://browser-release/native-host/grasseye-browser-host ; artifact://browser-release/browserctl/browserctl ; artifact://browser-release/launcher/grasseye-browser-launcher ; artifact://browser-release/platform-macos/libgrasseye-platform-macos.a ; artifact://browser-release/extension/grasseye-browser-extension.verified.crx ; artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json ; artifact://browser-release/checksums/SHA256SUMS ; artifact://browser-release/signatures/SHA256SUMS.sig ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/release-identity-signature.json",
      "input_contract": "deliverable://construction-admission/external-operations.json ; deliverable://browser-release/browser-build-input-lock.json ; deliverable://browser-release/artifact-set.json ; deliverable://browser-release/builder-a-receipt.json ; deliverable://browser-release/builder-b-receipt.json ; deliverable://browser-release/sbom.spdx.json ; deliverable://browser-release/provenance.json ; deliverable://browser-release/installed-artifact-readback.json ; src/lib/browser/release/browser-activation-tuple.schema.json ; src/lib/browser/release/browser-release-security-policy.schema.json ; artifact://browser-release/controller/controller-bundle.tgz ; artifact://browser-release/native-host/grasseye-browser-host ; artifact://browser-release/browserctl/browserctl ; artifact://browser-release/launcher/grasseye-browser-launcher ; artifact://browser-release/platform-macos/libgrasseye-platform-macos.a ; artifact://browser-release/extension/grasseye-browser-extension.verified.crx ; artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json ; artifact://browser-release/checksums/SHA256SUMS ; artifact://browser-release/signatures/SHA256SUMS.sig ; deliverable://browser-release/constructed-release-candidate.json",
      "output_contract": "deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/release-identity-signature.json",
      "state_transition": "读取不可变 ArtifactSet、完整 input lock、SBOM、provenance、builder 与安装 readback，签发内部绑定同一 artifact/candidate/sequence 的 ActivationTuple candidate、ReleaseSecurityPolicy 与 release identity signature。",
      "idempotency_or_replay": "The three signed outputs are immutable and issued together for one artifact-set hash; any input drift requires discarding all three and rerunning WO-050.",
      "audit_or_receipt": "ACC-050",
      "error_semantics": "Emit a candidate-bound FAIL receipt and stop dependent work orders.",
      "acceptance_ids": [
        "ACC-050"
      ]
    },
    {
      "action_id": "ACT-051",
      "work_order_id": "WO-051",
      "owner": "Browser authority issuer owner",
      "caller_or_actor": "Browser authority issuer owner",
      "entrypoint_or_channel": "system://browser-authority/active-authority-slot#revoke",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://browser-release/post-activation-readback.json ; deliverable://browser-release/activation-receipt.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://browser-release/recovery-authority-revoke.json ; system://browser-authority/active-authority-slot#revoke",
      "input_contract": "deliverable://browser-release/post-activation-readback.json ; deliverable://browser-release/activation-receipt.json ; deliverable://browser-release/constructed-release-candidate.json",
      "output_contract": "deliverable://browser-release/recovery-authority-revoke.json",
      "state_transition": "仅由 Browser authority issuer owner 把 active authority slot 改为 ABSENT，并签发 revoke readback；不执行安装或 activation 回退。",
      "idempotency_or_replay": "Repeated revoke is allowed only for the same failed authority certificate or already-ABSENT slot.",
      "audit_or_receipt": "ACC-051",
      "error_semantics": "Emit RECOVERY_FAILED_AUTHORITY_NOT_ABSENT and stop; do not proceed to browserctl rollback.",
      "acceptance_ids": [
        "ACC-051"
      ]
    },
    {
      "action_id": "ACT-054",
      "work_order_id": "WO-054",
      "owner": "local-runtime owner",
      "caller_or_actor": "local-runtime owner",
      "entrypoint_or_channel": "system://workbench/browser-consumer-admission#construction-blocked",
      "authorization": "future explicit construction authorization required",
      "object_scope": "deliverable://browser-release/recovery-active-slot-cas.json ; deliverable://browser-release/recovery-authority-revoke.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://browser-release/recovery-consumer-blocked.json ; system://workbench/browser-consumer-admission#construction-blocked",
      "input_contract": "deliverable://browser-release/recovery-active-slot-cas.json ; deliverable://browser-release/recovery-authority-revoke.json ; deliverable://browser-release/constructed-release-candidate.json",
      "output_contract": "deliverable://browser-release/recovery-consumer-blocked.json",
      "state_transition": "仅由 Local Runtime Browser admission owner 在 previous tuple CAS readback 后关闭 CON-001..CON-011 的 Browser admission，并证明没有业务副作用。",
      "idempotency_or_replay": "Repeat only to converge the same named CON-001..CON-011 set to BLOCKED; an unknown consumer stops recovery.",
      "audit_or_receipt": "ACC-054",
      "error_semantics": "Emit RECOVERY_FAILED_CONSUMER_ADMISSION and stop; no Browser consumer may run.",
      "acceptance_ids": [
        "ACC-054"
      ]
    }
  ],
  "acceptance_mappings": [
    {
      "acceptance_id": "ACC-002",
      "work_order_id": "WO-002",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-002",
      "command_or_procedure": "Verify git rev-parse HEAD equals 60cfcf512ecdae0ed27d001d40b6293ae53e5cc6; verify git status --porcelain=v1 --untracked-files=all is empty before construction; verify deliverable://construction-admission/user-browser-scope-authorization.json names only the Browser responsibility slice.",
      "proves": "只关闭 AGENT SHA/tree 与本轮 Browser 片区授权。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-004",
      "work_order_id": "WO-004",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-004",
      "command_or_procedure": "Verify git -C /Users/nexgen/Documents/xuanxue-web status --porcelain=v1 --untracked-files=all is empty; bind git -C /Users/nexgen/Documents/xuanxue-web rev-parse HEAD and the three exact paths from WO-004 into deliverable://construction-admission/xuanxue-candidate.json.",
      "proves": "独立取得干净 xuanxue SHA/tree 与三条精确目标路径；缺失只阻断跨仓和其后发布。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-005",
      "work_order_id": "WO-005",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-005",
      "command_or_procedure": "node --import tsx scripts/acceptance/local-browser-plan-harness.self-test.ts --expect-all-negative-cases-rejected && node --import tsx scripts/acceptance/local-browser-retirement-inventory.acceptance.ts --classification deliverable://browser-retirement/file-classification.json --consumers deliverable://browser-retirement/consumer-registry.json --require-zero-unclassified --require-consumer-ids CON-001,CON-002,CON-003,CON-004,CON-005,CON-006,CON-007,CON-008,CON-009,CON-010,CON-011",
      "proves": "用 AST/symbol 消费图把当前 Browser 文件逐一标为删除，并把每个消费者绑定到 CON-001..CON-011。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-006",
      "work_order_id": "WO-006",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-006",
      "command_or_procedure": "Project authorization owner compares both exact authority documents and signs deliverable://construction-admission/browser-canonical-path.json only when canonical_path equals src/lib/browser/profile/browser-process-supervisor.ts and no alternate_supervisor_paths are present.",
      "proves": "消费逐文件分类后，关闭唯一 BrowserProcessSupervisor 路径和零未分类删除白名单。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-007",
      "work_order_id": "WO-007",
      "evidence_type": "DYNAMIC",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-007",
      "command_or_procedure": "node --import tsx scripts/acceptance/local-browser-work-order-receipt.acceptance.ts --work-order WO-007 --receipt deliverable://browser-observation/preconstruction-chrome.json --require-positive-negative-terminal-bounds",
      "proves": "记录获准真实路径的 URL、profile/process/policy、DOM 与动作前后终态；未知状态保持 UNKNOWN。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-008",
      "work_order_id": "WO-008",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-008",
      "command_or_procedure": "node --import tsx scripts/acceptance/local-browser-consumer-registry.acceptance.ts --registry deliverable://browser-retirement/consumer-registry.json --cutover deliverable://browser-retirement/cutover-ledger.json --demolition deliverable://construction-admission/browser-demolition.json --require-complete-mapping --require-zero-unclassified",
      "proves": "把每个 CON ID 映射到精确路径、owner、迁移工作单、验收和无旧链恢复。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-009",
      "work_order_id": "WO-009",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-009",
      "command_or_procedure": "node --import tsx scripts/acceptance/local-browser-retirement-inventory.acceptance.ts --classification deliverable://browser-retirement/file-classification.json --verify-all-browser-targets-absent --verify-no-import-reachability",
      "proves": "删除获准 Browser 根内全部现实现，构造期 authority 明确 ABSENT。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-010",
      "work_order_id": "WO-010",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-010",
      "command_or_procedure": "node --import tsx scripts/acceptance/local-browser-consumer-registry.acceptance.ts --cutover deliverable://browser-retirement/cutover-ledger.json --verify-targets-absent src/lib/local-runtime/workbench-browser-support.ts,src/lib/local-runtime/workbench-video-download-support.ts --verify-no-alias",
      "proves": "删除两个旧 support surface，不保留别名、wrapper 或 authority 平行文件。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-011",
      "work_order_id": "WO-011",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-011",
      "command_or_procedure": "node --import tsx scripts/acceptance/local-browser-consumer-registry.acceptance.ts --cutover deliverable://browser-retirement/cutover-ledger.json --verify-listed-legacy-acceptance-absent",
      "proves": "删除当前 legacy local-browser acceptance，未来验收只按终态合同重建。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-012",
      "work_order_id": "WO-012",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-012",
      "command_or_procedure": "node --import tsx src/lib/browser/protocol/browser-protocol-schema.acceptance.ts --schema src/lib/browser/protocol/browser-protocol.schema.json --errors src/lib/browser/protocol/browser-errors.json --reject-unknown-message --verify-budget-bounds --require-exact-error-taxonomy install,host,origin,extension,tuple,transcript,capability,profile,process,policy,liveness,worker-fence,dual-active,backpressure,file-grant,rollback,revocation,permit,target,document,devtools,outcome-unknown,repair",
      "proves": "建立消息、framing、budget、artifact grant、registry hash 与唯一完整 Browser error taxonomy 的单一源。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-013",
      "work_order_id": "WO-013",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-013",
      "command_or_procedure": "node --import tsx src/lib/browser/protocol/browser-protocol-codegen.acceptance.ts --schema src/lib/browser/protocol/browser-protocol.schema.json --ts src/lib/browser/protocol/generated/browser-protocol.generated.ts --rust src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs --require-byte-stable",
      "proves": "从唯一 schema 生成 TypeScript 与 Rust 合同并证明两端 hash 相同。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-015",
      "work_order_id": "WO-015",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-015",
      "command_or_procedure": "node --import tsx src/lib/browser/chrome-extension/extension.acceptance.ts --manifest src/lib/browser/chrome-extension/manifest.json --require-one-port-owner --reject-unregistered-command",
      "proves": "只建设 NativePortActor、CommandRegistry 与 chrome.debugger 适配。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-016",
      "work_order_id": "WO-016",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-016",
      "command_or_procedure": "node --import tsx src/lib/browser/transport/browser-transport.acceptance.ts --require-single-actor --reject-stale-event --verify-bounded-fresh-chain-retry",
      "proves": "只拥有 transport event、状态归约、fresh-chain retry 与 stale event 丢弃。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-017",
      "work_order_id": "WO-017",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-017",
      "command_or_procedure": "node --import tsx src/lib/browser/infrastructure/browser-authority-issuer.acceptance.ts --require-absent-or-present --reject-heartbeat-mint --verify-immediate-revoke --require-auth-proof-committed",
      "proves": "只在 authenticated channel、profile/process/policy 与 liveness 全成立时产生 PRESENT authority。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-018",
      "work_order_id": "WO-018",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-018",
      "command_or_procedure": "node --import tsx src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts --public-api src/lib/browser/browser-authority-api.ts --require-execution-binding --reject-private-export",
      "proves": "唯一业务入口只消费当前 execution binding 并返回 authority lease 或 typed unavailable。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-019",
      "work_order_id": "WO-019",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-019",
      "command_or_procedure": "node --import tsx src/lib/browser/exact-target/browser-target-lease.acceptance.ts --require-exact-target-document --reject-zero-or-many --reject-stale-epoch",
      "proves": "只从当前 authority lease 取得唯一 target/document lease，epoch 变化立即失效。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-020",
      "work_order_id": "WO-020",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-020",
      "command_or_procedure": "node --import tsx src/lib/browser/exact-target/browser-command.acceptance.ts --reject-evaluate --reject-raw-path --verify-mutation-journal --verify-outcome-unknown",
      "proves": "只执行 registry-owned declarative commands；mutation 不自动重放，歧义进入 OUTCOME_UNKNOWN。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-021",
      "work_order_id": "WO-021",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-021",
      "command_or_procedure": "node --import tsx src/lib/browser/profile/browser-profile.acceptance.ts --require-files src/lib/browser/profile/browser-profile-config.ts,src/lib/browser/profile/browser-profile-state.ts,src/lib/browser/profile/dedicated-profile-policy.ts,src/lib/browser/profile/browser-profile-enrollment.ts,src/lib/browser/profile/browser-profile-enrollment-receipt.ts,src/lib/browser/profile/browser-profile-process-attestation.ts,src/lib/browser/profile/managed-policy-readback.ts,src/lib/browser/profile/browser-process-supervisor.ts --enrollment-owner browserctl --reject-wrong-profile --reject-wrong-process --reject-policy-drift",
      "proves": "建设完整 profile 终态：config、state、dedicated policy、enrollment、receipt、process attestation、managed policy readback 与唯一 BrowserProcessSupervisor；enrollment mutation 仍只由 browserctl 执行。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-024",
      "work_order_id": "WO-024",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-024",
      "command_or_procedure": "node --import tsx src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts --require-six-primitives --reject-private-browser-import --bind-observation deliverable://browser-observation/preconstruction-chrome.json",
      "proves": "六个原子动作只消费当前 BrowserTargetLease 与命令 permit。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-025",
      "work_order_id": "WO-025",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-025",
      "command_or_procedure": "node --import tsx src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts --require-checkpoint-release --reject-browser-target-session --reject-production-fixture",
      "proves": "每次 provider execution/checkpoint 重新取得并释放 authority/target；删除 BrowserTargetSession fixture 合同。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-026",
      "work_order_id": "WO-026",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-026",
      "command_or_procedure": "node --import tsx src/capabilities/video-download/acceptance/browser-authority.acceptance.ts --require-named-observation --reject-create-target-session --reject-evaluate --reject-script-fallback",
      "proves": "来源页探测只使用命名、有界 observation capability，不允许 evaluate 或脚本 fallback。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-027",
      "work_order_id": "WO-027",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-027",
      "command_or_procedure": "node --import tsx src/plugins/amazon-invoice-upload/amazon-invoice-upload-browser-authority.acceptance.ts --require-current-window --require-mutation-journal --require-human-final-gate --reject-stale-target",
      "proves": "只改 Browser 边界，保留业务顺序和人工最终门；每个 mutation 有 journal 与 owner outcome resolution。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-028",
      "work_order_id": "WO-028",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-028",
      "command_or_procedure": "node --import tsx src/plugins/amazon-product-mining/amazon-product-mining-browser-authority.acceptance.ts --require-stage-checkpoint --reject-cross-stage-lease-cache --preserve-package-owner",
      "proves": "每阶段使用当前 execution/authority/target，checkpoint 后不缓存旧 lease。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-029",
      "work_order_id": "WO-029",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-029",
      "command_or_procedure": "node --import tsx src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts --require-ordered-windows --require-zero-gap-actions --require-zero-unresolved-outcomes",
      "proves": "在唯一 AgentRuntimeReceiptV2 内记录有序 authority windows，窗口间零动作且无未裁决 mutation。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-030",
      "work_order_id": "WO-030",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-030",
      "command_or_procedure": "cd /Users/nexgen/Documents/xuanxue-web && npx vitest run tests/dynamic-proof/browser-authority-window-contract.test.ts --reporter=verbose",
      "proves": "只在 DG-003 干净候选上修改三条冻结路径，不建立第二 election、receipt 或 verdict owner。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-031",
      "work_order_id": "WO-031",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-031",
      "command_or_procedure": "node --import tsx scripts/audit/domains/local-browser-session/local-browser-26-checks.acceptance.ts --law .github/instructions/agent-rules/modules/module-local-browser-session.instructions.md --manifest scripts/audit/domains/local-browser-session/manifest.json --inspector scripts/audit/domains/local-browser-session/inspector.ts --require-law-sha-bound-exact-check-set --require-check-count 26 --require-independent-receipts",
      "proves": "从当前 active law SHA 导出精确 26 个 machine-blocking checkId，并证明 manifest/inspector 的独立 binding 集合全等且各有 receipt。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-032",
      "work_order_id": "WO-032",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-032",
      "command_or_procedure": "node --import tsx scripts/acceptance/local-browser-terminal-contract.acceptance.ts --supervisor src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts --errors src/lib/browser/protocol/browser-errors.json --require-only-health-components browserInfrastructure,browserAuthority --reject-old-health-semantics browserSession,transportReady,session-not-authenticated,wait-for-authentication --require-exact-zero-metrics unauthenticated_browser_authority_issued_total,command_without_valid_authority_total,stale_event_side_effect_total,old_completion_to_new_port_total,non_idempotent_auto_replay_total,wrong_profile_process_authority_issued_total,command_after_liveness_expiry_total,browser_action_during_authority_absence_total,dual_active_browser_worker_total,revoked_or_rollback_blocked_tuple_activated_total,browser_admission_budget_violation_total --require-slo availability=99.99,authority_issuance_p99_ms=5000,recoverable_chain_rebuild_p99_ms=10000,revoke_to_absent_p99_ms=10 --require-unbounded-zero queue,cache,stream && node --import tsx scripts/acceptance/local-browser-26-mutants.acceptance.ts --require-killed 26 && node --import tsx scripts/acceptance/local-browser-property-model.acceptance.ts --require-all-invariants",
      "proves": "26 个检查逐项拥有 negative/property/model/mutant 证据；确定性合同验证两项 health、精确 error taxonomy、11 个零指标、4 项 SLO 与无界 queue/cache/stream 为零，generated truth 只由现有 builder 生成。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-046",
      "work_order_id": "WO-046",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-046",
      "command_or_procedure": "cargo test --manifest-path src/lib/browser/native-messaging-host/Cargo.toml --test browserctl -- --nocapture",
      "proves": "browserctl 是 install/verify/doctor/repair/enroll-profile/activate/rollback 唯一 owner；launcher、platform-macos 与 manifests 只服务该控制面。",
      "does_not_prove": "Does not prove downstream activation, production readback or final release approval.",
      "failure_result": "Emit a candidate-bound FAIL receipt and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-047",
      "work_order_id": "WO-047",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-047",
      "command_or_procedure": "node --import tsx src/lib/browser/infrastructure/browser-infrastructure-supervisor.acceptance.ts --require-lock-before-bind --reject-live-socket-unlink --require-bounded-repair --require-only-health-components browserInfrastructure,browserAuthority --require-sole-error-metrics-producer --reject-old-health-semantics browserSession,transportReady,session-not-authenticated,wait-for-authentication --reject-business-flow",
      "proves": "唯一 supervisor 在 bind 前取得 OwnerLock，并拥有 worker membership、handover、retry、repair、两项合法 health 与唯一 error/metrics producer；不拥有业务流程。",
      "does_not_prove": "Does not prove downstream activation, production readback or final release approval.",
      "failure_result": "Emit a candidate-bound FAIL receipt and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-035A",
      "work_order_id": "WO-035",
      "evidence_type": "MANUAL",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-035",
      "command_or_procedure": "Verify deliverable://construction-admission/agent-repository-governance-policy.json owner signature, repo, main branch, strict, exact contexts, constructed candidate SHA/tree and mutation/restore permissions; GET current required_status_checks and sign only the pre-state receipt with candidate/repo/branch/hash.",
      "proves": "Desired contexts are signed by the legal repository governance owner and the remote pre-state is signed before mutation.",
      "does_not_prove": "Does not prove PATCH or post-state.",
      "failure_result": "Do not PATCH; emit FAIL."
    },
    {
      "acceptance_id": "ACC-035B",
      "work_order_id": "WO-035",
      "evidence_type": "MANUAL",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-035",
      "command_or_procedure": "PATCH /repos/ADVISION-X/AGENT/branches/main/protection/required_status_checks from deliverable://construction-admission/agent-repository-governance-policy.json; GET the same endpoint into deliverable://browser-release/branch-protection-readback.json; require exact strict/contexts/candidate/repo/branch match. Require deliverable://browser-release/constructed-release-candidate.json AGENT/xuanxue remote SHA as applicable and reject the plan-evidence SHA.",
      "proves": "The requested exact branch-protection state is independently read back.",
      "does_not_prove": "Does not prove future configuration after the readback timestamp.",
      "failure_result": "Invoke ACT-035C and block release."
    },
    {
      "acceptance_id": "ACC-035C",
      "work_order_id": "WO-035",
      "evidence_type": "MANUAL",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-035",
      "command_or_procedure": "If ACC-B failed, PATCH the exact deliverable://browser-release/agent-branch-protection-prestate.json, GET again, and require byte-equivalent strict/contexts before signing deliverable://browser-release/agent-branch-protection-recovery-receipt.json; if ACC-B passed, sign NOT_REQUIRED.",
      "proves": "Remote mutation has a candidate-bound, verifiable restoration path.",
      "does_not_prove": "Does not approve release.",
      "failure_result": "RECOVERY_FAILED is terminal and blocks release."
    },
    {
      "acceptance_id": "ACC-048A",
      "work_order_id": "WO-048",
      "evidence_type": "MANUAL",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-048",
      "command_or_procedure": "Verify deliverable://construction-admission/xuanxue-repository-governance-policy.json owner signature, repo, main branch, strict, exact contexts, constructed candidate SHA/tree and mutation/restore permissions; GET current required_status_checks and sign only the pre-state receipt with candidate/repo/branch/hash.",
      "proves": "Desired contexts are signed by the legal repository governance owner and the remote pre-state is signed before mutation.",
      "does_not_prove": "Does not prove PATCH or post-state.",
      "failure_result": "Do not PATCH; emit FAIL."
    },
    {
      "acceptance_id": "ACC-048B",
      "work_order_id": "WO-048",
      "evidence_type": "MANUAL",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-048",
      "command_or_procedure": "PATCH /repos/ADVISION-X/xuanxue-web/branches/main/protection/required_status_checks from deliverable://construction-admission/xuanxue-repository-governance-policy.json; GET the same endpoint into deliverable://browser-release/xuanxue-branch-protection-readback.json; require exact strict/contexts/candidate/repo/branch match. Require deliverable://browser-release/constructed-release-candidate.json AGENT/xuanxue remote SHA as applicable and reject the plan-evidence SHA.",
      "proves": "The requested exact branch-protection state is independently read back.",
      "does_not_prove": "Does not prove future configuration after the readback timestamp.",
      "failure_result": "Invoke ACT-048C and block release."
    },
    {
      "acceptance_id": "ACC-048C",
      "work_order_id": "WO-048",
      "evidence_type": "MANUAL",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-048",
      "command_or_procedure": "If ACC-B failed, PATCH the exact deliverable://browser-release/xuanxue-branch-protection-prestate.json, GET again, and require byte-equivalent strict/contexts before signing deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json; if ACC-B passed, sign NOT_REQUIRED.",
      "proves": "Remote mutation has a candidate-bound, verifiable restoration path.",
      "does_not_prove": "Does not approve release.",
      "failure_result": "RECOVERY_FAILED is terminal and blocks release."
    },
    {
      "acceptance_id": "ACC-049",
      "work_order_id": "WO-049",
      "evidence_type": "MANUAL",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-049",
      "command_or_procedure": "Operator signs exact provider account refs, allowed journey IDs, forbidden sensitive final actions, required human gates, timestamps spanning at least 8 business hours, pause/cancel/takeover authority and evidence redaction policy; any missing field is BLOCKED.",
      "proves": "由 operator 明确账户、journey 范围、敏感动作边界、人工门、8 小时窗口和中止权限；缺失只阻断业务证据及发布链。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-003",
      "work_order_id": "WO-003",
      "evidence_type": "MANUAL",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-003",
      "command_or_procedure": "Release operations owner signs external-operations.json containing non-empty permanent CWS item ID, Verified CRX publisher identity, Host/launcher/browserctl signing and notarization key references, release-signing-root custody, dedicated managed-profile policy ref, and two distinct HA worker device IDs/dataDirs/profile enrollment refs; reject shared device/profile/dataDir or missing owner signature.",
      "proves": "只冻结 CWS、签名/公证、managed profile、两台独立 HA worker 与 release key custody；不决定任何仓库 required-check policy。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-014",
      "work_order_id": "WO-014",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-014",
      "command_or_procedure": "cargo test --manifest-path src/lib/browser/native-messaging-host/Cargo.toml --locked --all-targets && cargo fuzz run --manifest-path src/lib/browser/native-messaging-host/crates/host/fuzz/Cargo.toml native_framing -- -max_total_time=60; require bounded framing, raw/auth channel separation, original reply token, one Host per Port, transcript integrity and crash-safe artifact stream; any panic, hang or oversized frame acceptance fails.",
      "proves": "只建设 framing、认证握手、单 Port 与有界 I/O 的 Host。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-022",
      "work_order_id": "WO-022",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-022",
      "command_or_procedure": "node --import tsx src/lib/browser/release/release-identity.acceptance.ts --require-artifact-tuple-proof-security-rollback-sbom-provenance-build-input-previous-snapshot-schemas --require-active-slot-signed-absent --verify-targets-absent deliverable://browser-release/artifact-set.json,deliverable://browser-release/activation-tuple-candidate.json,deliverable://browser-release/release-security-policy.json --reject-tuple-intersection --reject-downgrade --reject-revoked; fail if WO-022 issues any candidate identity.",
      "proves": "只建立 ArtifactSet、ActivationTuple、ReleaseSecurityPolicy、ProofManifest、rollback、SBOM、provenance 与 build-input schemas，并初始化空 ABSENT slot；不签发任何候选身份。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-023",
      "work_order_id": "WO-023",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-023",
      "command_or_procedure": "node --import tsx src/lib/local-runtime/workbench-browser-authority.acceptance.ts --require-broker-only --forbid-assembly-authority-lease --forbid-assembly-target-lease --require-only-health-components browserInfrastructure,browserAuthority --reject-old-health-semantics browserSession,transportReady,session-not-authenticated,wait-for-authentication --verify-targets-absent src/lib/local-runtime/workbench-browser-support.ts,src/lib/local-runtime/workbench-video-download-support.ts --require-video-capability-public-factory --require-browser-jobs-blocked-when-authority-absent; run AST import check proving local-runtime imports Browser public facade only.",
      "proves": "Local Runtime 只注入 Broker，原样展示唯一 supervisor 的两个合法 health component；assembly 不领取或缓存 target lease；已退休的 workbench-browser-support.ts 与 workbench-video-download-support.ts 永久不存在。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-041",
      "work_order_id": "WO-041",
      "evidence_type": "MANUAL",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-041",
      "command_or_procedure": "Create a fresh independent read-only auditor with no prior implementation context; bind exact constructed-release-candidate, ArtifactSet, ActivationTuple, ReleaseSecurityPolicy and all declared receipt hashes; independently execute all 26 local-browser checks, old-path/import/symbol zero reachability, two-repo governance pre/post/recovery readbacks, ci-full receipt, packaged Chrome matrix, provider/business receipt, HA/24h/168h receipts and producer-ancestor graph; sign independent-audit.json only when blocking findings=0, conflicts=0 and every hash matches. Reject plan-evidence SHA as release identity; use only deliverable://browser-release/constructed-release-candidate.json.",
      "proves": "独立审计者绑定同一候选和 artifact，审查法案执法面、旧路径零可达与所有 proof receipts。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-056",
      "work_order_id": "WO-056",
      "evidence_type": "MANUAL",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-056",
      "command_or_procedure": "Verify the signer is the AGENT repository governance owner; require repo=ADVISION-X/AGENT, branch=main, strict boolean, non-empty exact contexts, construction_branch=codex/browser-greenfield, expected_remote_ref, commit/push permission, branch-protection mutation permission and exact pre-state restore permission; reject wildcard context or release-operations signature.",
      "proves": "签发 ADVISION-X/AGENT main 的 repo、branch、strict、exact contexts、construction branch commit/push 权限、expected remote ref、保护规则变更权限与恢复权限。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-057",
      "work_order_id": "WO-057",
      "evidence_type": "MANUAL",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-057",
      "command_or_procedure": "Verify the signer is the xuanxue repository governance owner; require repo=ADVISION-X/xuanxue-web, branch=main, strict boolean, non-empty exact contexts, construction_branch=codex/browser-greenfield, expected_remote_ref, commit/push permission, branch-protection mutation permission and exact pre-state restore permission; reject wildcard context or AGENT/release-operations signature.",
      "proves": "签发 ADVISION-X/xuanxue-web main 的 repo、branch、strict、exact contexts、construction branch commit/push 权限、expected remote ref、保护规则变更权限与恢复权限。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-058",
      "work_order_id": "WO-058",
      "evidence_type": "MANUAL",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-058",
      "command_or_procedure": "Require git status --porcelain=v1 --untracked-files=all empty after staging the authorized construction result; hash every tracked file into agent-constructed-tree-manifest; verify agent-build-input-manifest includes package.json, package-lock.json, tsconfig.json, browser-build.config.json and every Browser producer output; create source bundle; commit with authorized identity; push with exact lease; run git ls-remote origin refs/heads/codex/browser-greenfield and require returned SHA equals local commit and candidate receipt.",
      "proves": "在所有 AGENT 源码、audit 与 acceptance 建设完成后，生成 content-addressed tree/build-input manifest 与 source bundle；在获准 construction branch 上 commit/push，并以 git ls-remote 读回相同 SHA。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-059",
      "work_order_id": "WO-059",
      "evidence_type": "MANUAL",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-059",
      "command_or_procedure": "Require clean xuanxue worktree; verify only the three authorized cross-repo proof paths changed; hash complete tracked tree; create source bundle; commit with authorized identity; push with exact lease; run git ls-remote origin refs/heads/codex/browser-greenfield and require returned SHA equals local commit and cross-repo receipt candidate hash.",
      "proves": "在 xuanxue 三条授权路径和跨仓验收完成后，生成 content-addressed tree/source bundle；在获准 construction branch 上 commit/push，并以 git ls-remote 读回相同 SHA。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-060",
      "work_order_id": "WO-060",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-060",
      "command_or_procedure": "Verify AGENT local commit SHA=remote SHA and tree manifest hash matches source bundle; verify xuanxue local commit SHA=remote SHA and tree manifest hash matches source bundle; verify cross-repo contract hash is present; sign one constructed-release-candidate with both repo identities and reject the plan-evidence SHA as a release candidate.",
      "proves": "把施工后 AGENT 与 xuanxue 的 clean tree、commit SHA、remote SHA、content manifests 与 cross-repo contract hash 组合成唯一 constructed-release-candidate identity。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-033",
      "work_order_id": "WO-033",
      "evidence_type": "DYNAMIC",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-033",
      "command_or_procedure": "Build only from agent-constructed-source-bundle.tar.zst verified by constructed-release-candidate and agent-build-input-manifest; require package.json, package-lock.json, tsconfig.json, browser-build.config.json and no unlisted byte-affecting input; two independent builders must produce exact entity refs for Controller bundle, signed Host, browserctl, launcher, platform adapter, Verified CRX, Native Messaging manifest, SHA256SUMS and signature; verify entity hashes, SBOM, provenance, signing/notarization and installed readback before ArtifactSet indexes them.",
      "proves": "只从 WO-060 冻结的 source bundles/tree manifests 与精确 package/tsconfig/build config 输入构建 Controller、Host、browserctl、launcher、platform adapter、Verified CRX、Native Messaging manifest、checksums/signature 九个实体；ArtifactSet 仅索引这些 content-addressed entities。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-039",
      "work_order_id": "WO-039",
      "evidence_type": "BUSINESS",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-039",
      "command_or_procedure": "Read active slot; sign PreviousActivationSnapshot as exactly SIGNED_ABSENT or SIGNED_PRESENT(tuple with signature/hash/sequence); CAS to the proof-bound new tuple; require one active value and exact old/new readback. Require ProofManifest constructed-candidate hash equals deliverable://browser-release/constructed-release-candidate.json.",
      "proves": "只消费已签 proof manifest，先签发 PreviousActivationSnapshot=SIGNED_ABSENT 或 SIGNED_PRESENT(tuple)，再 CAS 切换一个 active tuple。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-052",
      "work_order_id": "WO-052",
      "evidence_type": "DYNAMIC",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-052",
      "command_or_procedure": "If snapshot=SIGNED_PRESENT, browserctl restores exactly the previous ArtifactSet entities and reads back profile/process/policy/tree; if snapshot=SIGNED_ABSENT, browserctl uninstalls or quarantines the failed Controller/Host/browserctl/launcher/platform/CRX/manifest entities and proves no launchable Browser authority path; both require authority ABSENT.",
      "proves": "若 snapshot 为 SIGNED_PRESENT，browserctl 安装回退到 previous tuple；若为 SIGNED_ABSENT，browserctl 卸载/隔离失败新 artifact 并证明 profile/process/policy/tree 无可用 Browser authority。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-053",
      "work_order_id": "WO-053",
      "evidence_type": "DYNAMIC",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-053",
      "command_or_procedure": "CAS active slot from failed new tuple to snapshot value: previous tuple for SIGNED_PRESENT or ABSENT for SIGNED_ABSENT; GET and verify exact state, signature/sequence rules for PRESENT, and no tuple fields for ABSENT.",
      "proves": "仅由 activation owner 把 active slot 从失败新 tuple CAS 到 SIGNED_PRESENT 的 previous tuple，或 CAS 到 SIGNED_ABSENT。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-055",
      "work_order_id": "WO-055",
      "evidence_type": "DYNAMIC",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-055",
      "command_or_procedure": "Require authority ABSENT and CON-001..CON-011 BLOCKED; for SIGNED_PRESENT require exact previous entities installed and active slot equals previous tuple; for SIGNED_ABSENT require failed entities uninstalled/quarantined, no launchable Browser authority path and active slot ABSENT; sign new-attempt-admission that forbids failed ProofManifest reuse.",
      "proves": "独立验证 authority ABSENT、SIGNED_PRESENT 时 previous tuple 已安装且 active，或 SIGNED_ABSENT 时无可用 Browser artifact 且 slot 为 ABSENT；两分支均要求 CON-001..CON-011 BLOCKED。",
      "does_not_prove": "Does not restore service or authorize a new activation.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-034",
      "work_order_id": "WO-034",
      "evidence_type": "DYNAMIC",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-034",
      "command_or_procedure": "node --import tsx scripts/acceptance/local-browser-real-chrome-terminal.acceptance.ts --artifact deliverable://browser-release/artifact-set.json --tuple deliverable://browser-release/activation-tuple-candidate.json --security-policy deliverable://browser-release/release-security-policy.json --identity-signature deliverable://browser-release/release-identity-signature.json --matrix deliverable://browser-release/real-chrome-matrix.json --browsers stable,cft --require-tuple-artifact-match --require-security-policy-hash --require-positive-negative-terminal-bounds Require --constructed-candidate deliverable://browser-release/constructed-release-candidate.json and reject plan-evidence SHA.",
      "proves": "在 Stable 与 CfT 上对同一 ArtifactSet、ActivationTuple candidate 与 ReleaseSecurityPolicy 完成 profile/process/policy、auth、target、file、stream、update 与 rollback 正反终态。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-036",
      "work_order_id": "WO-036",
      "evidence_type": "DYNAMIC",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-036",
      "command_or_procedure": "Run active-to-standby and standby-to-active handover with the exact artifact, tuple, security-policy and release-identity hashes; require one current database fence, sealed checkpoint, zero inter-window actions, zero unresolved outcomes, dual_active_browser_worker_total=0, stale_event_side_effect_total=0, old_completion_to_new_port_total=0 and command_after_liveness_expiry_total=0. Require every HA window receipt to embed deliverable://browser-release/constructed-release-candidate.json hash.",
      "proves": "一主一热备只消费 xuanxue 数据库 fence，完成 revoke/checkpoint/fresh-window 交接并证明四项 handover 关键零指标。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-037",
      "work_order_id": "WO-037",
      "evidence_type": "DYNAMIC",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-037",
      "command_or_procedure": "Run the exact same artifact/tuple/policy identity for 24h fault soak and 168h production soak; require zero for unauthenticated_browser_authority_issued_total, command_without_valid_authority_total, stale_event_side_effect_total, old_completion_to_new_port_total, non_idempotent_auto_replay_total, wrong_profile_process_authority_issued_total, command_after_liveness_expiry_total, browser_action_during_authority_absence_total, dual_active_browser_worker_total, revoked_or_rollback_blocked_tuple_activated_total and browser_admission_budget_violation_total; require availability>=99.99%, authority_issuance_p99<=5s, recoverable_chain_rebuild_p99<=10s, revoke_to_absent_p99<=10ms and unbounded_queue/cache/stream=0. Any identity drift, missing field or threshold breach resets the full required duration. Require both soak receipts to embed deliverable://browser-release/constructed-release-candidate.json hash without drift.",
      "proves": "对同一 ArtifactSet 和 HA 拓扑完成法定时长，证明完整零指标、SLO 与有界性；任一缺字段、越界或 identity 漂移即整段作废。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-038",
      "work_order_id": "WO-038",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-038",
      "command_or_procedure": "Create BrowserReleaseProofManifestV1 once; hash every declared input including build-input-lock, SBOM, provenance, installed readback and release-identity-signature; require all candidate/artifact/tuple/policy hashes to match. Hash deliverable://browser-release/constructed-release-candidate.json and require every upstream receipt candidate field equals it.",
      "proves": "首次创建 proof manifest，绑定同一 candidate、ArtifactSet、ActivationTuple 候选、安全策略、26 checks、Chrome、HA、soak 与 branch readback。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-040",
      "work_order_id": "WO-040",
      "evidence_type": "DYNAMIC",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-040",
      "command_or_procedure": "Read installation, profile, policy, process, Extension, Host, authority slot and business receipt; emit exactly PASS or POST_ACTIVATION_MISMATCH. On mismatch do not run revoke, browserctl, CAS or consumer mutations inside WO-040. Require installed and business readbacks to embed deliverable://browser-release/constructed-release-candidate.json.",
      "proves": "只读安装、policy、process、extension、Host、authority slot 与业务 receipt；输出 PASS readback 或 POST_ACTIVATION_MISMATCH，不隐式取得 revoke、rollback、CAS 或 consumer 写权。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit POST_ACTIVATION_MISMATCH and enable only WO-051."
    },
    {
      "acceptance_id": "ACC-042",
      "work_order_id": "WO-042",
      "evidence_type": "BUSINESS",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-042",
      "command_or_procedure": "node --import tsx scripts/acceptance/local-browser-work-order-receipt.acceptance.ts --work-order WO-042 --receipt deliverable://browser-release/final-release-approval.json --consume-ci-receipt deliverable://browser-release/ci-full-receipt.json --require-ci-full-pass --require-independent-zero-findings --require-post-activation-match --forbid-ci-execution --forbid-mutation Consume and compare deliverable://browser-release/constructed-release-candidate.json across ProofManifest, activation, readback, independent audit and CI receipt; do not run CI.",
      "proves": "只验证并消费 WO-044 的 candidate-bound ci-full-receipt 及全部 PASS receipts，签发 release approval；不运行 CI，不修改源码、ProofManifest、保护规则或 activation。",
      "does_not_prove": "Proves final approval receipt only; it does not prove future runtime availability after the recorded readback window.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-043",
      "work_order_id": "WO-043",
      "evidence_type": "BUSINESS",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-043",
      "command_or_procedure": "node --import tsx scripts/acceptance/local-browser-business-workday-terminal.acceptance.ts --authorization deliverable://construction-admission/provider-journey-authorization.json --artifact deliverable://browser-release/artifact-set.json --tuple deliverable://browser-release/activation-tuple-candidate.json --security-policy deliverable://browser-release/release-security-policy.json --identity-signature deliverable://browser-release/release-identity-signature.json --receipt deliverable://browser-release/business-workday-receipt.json --min-business-hours 8 --require-all-identity-hashes-match --require-zero-focus-theft --require-zero-keyboard-interruption --require-zero-wrong-target --require-bounded-operator-controls --require-zero-mutation-replay --require-sensitive-actions-human-gated Require --constructed-candidate deliverable://browser-release/constructed-release-candidate.json; artifact/tuple/policy/business receipt hashes must share it.",
      "proves": "在同一 candidate、ArtifactSet、ActivationTuple candidate、ReleaseSecurityPolicy 与 release identity signature 下完成获准 provider journeys 和 8 小时业务基线，证明零 focus theft、零 keyboard interruption、零 wrong-target、有限 pause/cancel/takeover 与零 mutation replay。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-044",
      "work_order_id": "WO-044",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-044",
      "command_or_procedure": "npm run ci:full && node --import tsx scripts/acceptance/local-browser-work-order-receipt.acceptance.ts --work-order WO-044 --receipt deliverable://browser-release/ci-full-receipt.json --artifact deliverable://browser-release/artifact-set.json --tuple deliverable://browser-release/activation-tuple-candidate.json --security-policy deliverable://browser-release/release-security-policy.json --require-ci-full-pass --require-candidate-match --require-all-identity-hashes-match Run CI from the exact AGENT SHA in deliverable://browser-release/constructed-release-candidate.json; verify xuanxue remote SHA and embed the composite hash in ci-full-receipt.",
      "proves": "只在同一 candidate/artifact/tuple/policy 的业务 receipt 完成后运行唯一 ci:full，并形成候选绑定 receipt；任何 failure 阻断 ProofManifest 与激活。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-050",
      "work_order_id": "WO-050",
      "evidence_type": "EXAM",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-050",
      "command_or_procedure": "Verify ActivationTuple embeds candidate hash, ArtifactSet hash and component hashes; verify ReleaseSecurityPolicy embeds tuple hash, minimum sequence and revocations; verify release-identity-signature covers tuple, policy, build-input-lock, SBOM, provenance and installed readback. Require all issued identities to embed deliverable://browser-release/constructed-release-candidate.json hash.",
      "proves": "读取不可变 ArtifactSet、完整 input lock、SBOM、provenance、builder 与安装 readback，签发内部绑定同一 artifact/candidate/sequence 的 ActivationTuple candidate、ReleaseSecurityPolicy 与 release identity signature。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-051",
      "work_order_id": "WO-051",
      "evidence_type": "DYNAMIC",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-051",
      "command_or_procedure": "Invoke BrowserAuthorityIssuer revoke for the failed certificate; GET authority slot; require ABSENT before any browserctl rollback.",
      "proves": "仅由 Browser authority issuer owner 把 active authority slot 改为 ABSENT，并签发 revoke readback；不执行安装或 activation 回退。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    },
    {
      "acceptance_id": "ACC-054",
      "work_order_id": "WO-054",
      "evidence_type": "DYNAMIC",
      "evidence_status": "TO_BE_CREATED_BY_WORK_ORDER",
      "producer_work_order_id": "WO-054",
      "command_or_procedure": "Write Browser admission BLOCKED for exact CON-001..CON-011; read every public entry; require BLOCKED and zero Browser action/evidence side effects.",
      "proves": "仅由 Local Runtime Browser admission owner 在 previous tuple CAS readback 后关闭 CON-001..CON-011 的 Browser admission，并证明没有业务副作用。",
      "does_not_prove": "Does not prove any downstream work order, deployment, activation or release.",
      "failure_result": "Emit FAIL and stop dependent work orders."
    }
  ],
  "cutover_and_retirement": [
    {
      "cutover_id": "CUT-001",
      "work_order_id": "WO-009",
      "retired_targets": [
        "deliverable://browser-retirement/file-classification.json#delete_targets"
      ],
      "consumer_ids": [
        "CON-001",
        "CON-002",
        "CON-003",
        "CON-004",
        "CON-005",
        "CON-006",
        "CON-007",
        "CON-008",
        "CON-009",
        "CON-010",
        "CON-011"
      ],
      "preconditions": [
        "ACC-006 PASS",
        "ACC-008 PASS",
        "browser-dependent jobs construction BLOCKED"
      ],
      "verification_acceptance_ids": [
        "ACC-009"
      ],
      "failure_actions": [
        "Stop and restart a fresh construction branch from the frozen candidate; do not add fallback."
      ],
      "recovery_steps": [
        "Rerun WO-005 and WO-008 before another deletion attempt."
      ]
    },
    {
      "cutover_id": "CUT-002",
      "work_order_id": "WO-010",
      "retired_targets": [
        "src/lib/local-runtime/workbench-browser-support.ts"
      ],
      "consumer_ids": [
        "CON-001"
      ],
      "preconditions": [
        "ACC-008 PASS"
      ],
      "verification_acceptance_ids": [
        "ACC-010"
      ],
      "failure_actions": [
        "Keep CON-001 BLOCKED; do not restore a wrapper."
      ],
      "recovery_steps": [
        "Restart WO-010 from the frozen candidate after registry correction."
      ]
    },
    {
      "cutover_id": "CUT-003",
      "work_order_id": "WO-010",
      "retired_targets": [
        "src/lib/local-runtime/workbench-video-download-support.ts"
      ],
      "consumer_ids": [
        "CON-002"
      ],
      "preconditions": [
        "ACC-008 PASS"
      ],
      "verification_acceptance_ids": [
        "ACC-010"
      ],
      "failure_actions": [
        "Keep CON-002 BLOCKED; do not restore a wrapper."
      ],
      "recovery_steps": [
        "Restart WO-010 from the frozen candidate after registry correction."
      ]
    },
    {
      "cutover_id": "CUT-004",
      "work_order_id": "WO-011",
      "retired_targets": [
        "scripts/acceptance/local-browser-artifact-contract.acceptance.ts",
        "scripts/acceptance/local-browser-atomic-cutover.acceptance.ts",
        "scripts/acceptance/local-browser-business-workday.acceptance.ts",
        "scripts/acceptance/local-browser-exact-target-contract.acceptance.ts",
        "scripts/acceptance/local-browser-native-transport.acceptance.ts",
        "scripts/acceptance/local-browser-real-chrome-scenarios.acceptance.ts",
        "scripts/acceptance/local-browser-real-chrome.acceptance.ts",
        "scripts/acceptance/local-browser-target-actions.acceptance.ts"
      ],
      "consumer_ids": [
        "CON-011"
      ],
      "preconditions": [
        "ACC-008 PASS"
      ],
      "verification_acceptance_ids": [
        "ACC-011"
      ],
      "failure_actions": [
        "Do not use legacy acceptance as target proof."
      ],
      "recovery_steps": [
        "Rebuild only terminal-law acceptance after WO-012 contracts exist."
      ]
    },
    {
      "cutover_id": "CUT-005",
      "work_order_id": "WO-039",
      "retired_targets": [
        "deliverable://browser-release/construction-blocked-browser-authority"
      ],
      "consumer_ids": [
        "CON-001",
        "CON-002",
        "CON-003",
        "CON-004",
        "CON-005",
        "CON-006",
        "CON-007",
        "CON-008",
        "CON-009",
        "CON-010",
        "CON-011"
      ],
      "preconditions": [
        "ACC-038 PASS",
        "signed PreviousActivationSnapshot recorded as SIGNED_ABSENT or SIGNED_PRESENT"
      ],
      "verification_acceptance_ids": [
        "ACC-039",
        "ACC-040"
      ],
      "failure_actions": [
        "CAS failure keeps authority ABSENT; execute WO-051..WO-055 using the signed snapshot union."
      ],
      "recovery_steps": [
        "SIGNED_PRESENT restores the signed bounded previous tuple; SIGNED_ABSENT isolates/uninstalls the failed new artifact and restores ABSENT. Deleted Browser source never returns."
      ]
    }
  ]
}
```

## 11. 工作单依赖图与分阶段顺序

图为有向无环图。任何工作单只能在同方案候选或同 constructed candidate 的依赖、gate 和 entry conditions 全部 PASS 后开始。拓扑层：

- L00：WO-002 冻结 AGENT 施工候选；WO-003 冻结外部运营输入；WO-004 冻结 xuanxue 跨仓候选；WO-006 裁决唯一 BrowserProcessSupervisor 目标路径；WO-049 冻结 provider journey 与一工作日采集授权；WO-056 由 AGENT repository governance owner 签发精确治理策略；WO-057 由 xuanxue repository governance owner 签发精确治理策略
- L01：WO-005 生成逐文件清场分类
- L02：WO-007 取得施工前真实 Chrome 现场证据
- L03：WO-008 冻结逐消费者迁移与切换账
- L04：WO-009 物理删除现有 Browser 实现片区；WO-010 物理删除旧 Local Runtime Browser support；WO-011 物理删除旧 Local Browser 验收面
- L05：WO-012 建立 canonical protocol schema
- L06：WO-013 建立确定性协议 codegen
- L07：WO-014 建设 Rust Native Host；WO-015 建设 MV3 Extension；WO-022 建设发布 schema 与空 ABSENT 激活槽
- L08：WO-016 建设 TransportActor 与 Reducer；WO-046 建设 browserctl、launcher 与 macOS 注册面
- L09：WO-021 建设 Profile 与 BrowserProcessSupervisor
- L10：WO-047 建设 BrowserInfrastructureSupervisor 与唯一 OwnerLock
- L11：WO-017 建设 Authority Issuer
- L12：WO-018 建设 BrowserAuthorityBroker
- L13：WO-019 建设 exact TargetLeaseManager
- L14：WO-020 建设 CommandActor
- L15：WO-023 接回 Local Runtime 唯一装配面
- L16：WO-024 迁移 DOM Automation；WO-026 迁移 Video Download
- L17：WO-025 迁移 AI Input Gateway；WO-027 迁移 Amazon Invoice Upload
- L18：WO-028 迁移 Amazon Product Mining；WO-029 迁移 xuanxue-ai-production receipt 生产者
- L19：WO-030 切换 xuanxue 唯一消费合同
- L20：WO-031 扩充唯一 local-browser audit owner 到 26 项
- L21：WO-032 建立并通过确定性负例、性质、模型与 mutant 组
- L22：WO-058 冻结施工后 AGENT release candidate；WO-059 冻结施工后 xuanxue release candidate
- L23：WO-060 签发双仓 constructed release candidate
- L24：WO-033 构建一次不可变 ArtifactSet；WO-035 锁定 GitHub required checks 与 branch protection；WO-048 锁定 xuanxue-web required checks 与 branch protection
- L25：WO-050 签发 ArtifactSet-bound ActivationTuple 与 ReleaseSecurityPolicy
- L26：WO-034 运行同一 ArtifactSet 的真实 Chrome 矩阵
- L27：WO-036 执行主备 handover；WO-043 运行 operator-approved provider journeys 与一工作日业务基线
- L28：WO-037 完成 24h 与 168h soak；WO-044 在激活前运行唯一 ci:full
- L29：WO-041 执行全新独立只读终审
- L30：WO-038 创建 BrowserReleaseProofManifestV1
- L31：WO-039 原子激活唯一 ActivationTuple
- L32：WO-040 执行激活后生产 readback
- L33：WO-042 最终 release approval；WO-051 激活失败时立即 revoke Browser authority
- L34：WO-052 按 previous snapshot 回退或隔离已安装 artifact
- L35：WO-053 CAS active slot 回 previous tuple 或 ABSENT
- L36：WO-054 把全部 Browser consumer admission 回写为 BLOCKED
- L37：WO-055 独立读回完整 rollback 终态

WO-040 的 PASS 只进入 WO-042；POST_ACTIVATION_MISMATCH 只进入 WO-051。WO-051..WO-055 是失败终态分支，不回流本候选批准链。任何 commit/push、GitHub PATCH、activation 或 rollback 都要先命中自身 owner-signed policy 与幂等前态。

## 12. 逐工作单建设步骤

### WO-002：冻结 AGENT 施工候选

- 单一结果：只关闭 AGENT SHA/tree 与本轮 Browser 片区授权。
- owner：project authorization owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：无；决策门：`DG-001`；并行组：`DECISION`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`AGENTS.md`、`.github/instructions/agent-rules/modules/module-local-browser-session.instructions.md`、`docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md`、`deliverable://construction-admission/user-browser-scope-authorization.json`
- CREATE：`deliverable://construction-admission/agent-candidate.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`AGENTS.md`、`.github/instructions/agent-rules/modules/module-local-browser-session.instructions.md`、`docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md`、`deliverable://construction-admission/user-browser-scope-authorization.json`
- 动作：`ACT-002`
- 输出：`deliverable://construction-admission/agent-candidate.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-002`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-005`、`WO-007`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-003：冻结外部运营输入

- 单一结果：只冻结 CWS、签名/公证、managed profile、两台独立 HA worker 与 release key custody；不决定任何仓库 required-check policy。
- owner：release operations owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：无；决策门：`DG-004`；并行组：`DECISION`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md`
- CREATE：`deliverable://construction-admission/external-operations.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md`
- 动作：`ACT-003`
- 输出：`deliverable://construction-admission/external-operations.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-003`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-033`、`WO-036`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-004：冻结 xuanxue 跨仓候选

- 单一结果：独立取得干净 xuanxue SHA/tree 与三条精确目标路径；缺失只阻断跨仓和其后发布。
- owner：xuanxue repository authority owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：无；决策门：`DG-003`；并行组：`DECISION`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`/Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/browser-authority-proof-contract.ts`、`/Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/collector-contracts.ts`、`/Users/nexgen/Documents/xuanxue-web/scripts/audit/domains/dynamic-proof/dynamic-agent-receipt-inspection.ts`
- CREATE：`deliverable://construction-admission/xuanxue-candidate.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`/Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/browser-authority-proof-contract.ts`、`/Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/collector-contracts.ts`、`/Users/nexgen/Documents/xuanxue-web/scripts/audit/domains/dynamic-proof/dynamic-agent-receipt-inspection.ts`
- 动作：`ACT-004`
- 输出：`deliverable://construction-admission/xuanxue-candidate.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-004`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-030`、`WO-048`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-005：生成逐文件清场分类

- 单一结果：用 AST/symbol 消费图把当前 Browser 文件逐一标为删除，并把每个消费者绑定到 CON-001..CON-011。
- owner：Browser retirement inventory owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-002`、`WO-006`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`git-tree://60cfcf512ecdae0ed27d001d40b6293ae53e5cc6/src/lib/browser`、`src/lib/local-runtime/workbench-browser-support.ts`、`src/lib/local-runtime/workbench-video-download-support.ts`、`src/lib/local-runtime/workbench-ai-gateway-support.ts`、`src/lib/local-runtime/workbench-assembly.ts`
- CREATE：`scripts/acceptance/local-browser-plan-harness.self-test.ts`、`scripts/acceptance/local-browser-plan-gates.acceptance.ts`、`scripts/acceptance/local-browser-retirement-inventory.acceptance.ts`、`scripts/acceptance/local-browser-consumer-registry.acceptance.ts`、`scripts/acceptance/local-browser-work-order-receipt.acceptance.ts`、`deliverable://browser-retirement/file-classification.json`、`deliverable://browser-retirement/consumer-registry.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`git-tree://60cfcf512ecdae0ed27d001d40b6293ae53e5cc6/src/lib/browser`、`src/lib/local-runtime/workbench-browser-support.ts`、`src/lib/local-runtime/workbench-video-download-support.ts`、`src/lib/local-runtime/workbench-ai-gateway-support.ts`、`src/lib/local-runtime/workbench-assembly.ts`
- 动作：`ACT-005`
- 输出：`scripts/acceptance/local-browser-plan-harness.self-test.ts`、`scripts/acceptance/local-browser-plan-gates.acceptance.ts`、`scripts/acceptance/local-browser-retirement-inventory.acceptance.ts`、`scripts/acceptance/local-browser-consumer-registry.acceptance.ts`、`scripts/acceptance/local-browser-work-order-receipt.acceptance.ts`、`deliverable://browser-retirement/file-classification.json`、`deliverable://browser-retirement/consumer-registry.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-005`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-007`、`WO-008`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-006：裁决唯一 BrowserProcessSupervisor 目标路径

- 单一结果：只依据 active law 与终态施工图选择 src/lib/browser/profile/browser-process-supervisor.ts；逐文件分类和删除批准由 WO-005/WO-008 完成。
- owner：project authorization owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：无；决策门：`DG-002`；并行组：`DECISION`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`.github/instructions/agent-rules/modules/module-local-browser-session.instructions.md`、`docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md`
- CREATE：`deliverable://construction-admission/browser-canonical-path.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`.github/instructions/agent-rules/modules/module-local-browser-session.instructions.md`、`docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md`
- 动作：`ACT-006`
- 输出：`deliverable://construction-admission/browser-canonical-path.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-006`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-005`、`WO-008`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-007：取得施工前真实 Chrome 现场证据

- 单一结果：记录获准真实路径的 URL、profile/process/policy、DOM 与动作前后终态；未知状态保持 UNKNOWN。
- owner：real Chrome evidence owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-002`、`WO-005`；决策门：无；并行组：`OBSERVATION`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`scripts/acceptance/xuanxue-ai-production.real-chrome.ts`
- CREATE：`deliverable://browser-observation/preconstruction-chrome.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`scripts/acceptance/xuanxue-ai-production.real-chrome.ts`
- 动作：`ACT-007`
- 输出：`deliverable://browser-observation/preconstruction-chrome.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-007`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-008`、`WO-024`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-008：冻结逐消费者迁移与切换账

- 单一结果：把每个 CON ID 映射到精确路径、owner、迁移工作单、验收和无旧链恢复。
- owner：Browser retirement inventory owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-005`、`WO-006`、`WO-007`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://browser-retirement/file-classification.json`、`deliverable://browser-retirement/consumer-registry.json`、`deliverable://construction-admission/browser-canonical-path.json`、`deliverable://browser-observation/preconstruction-chrome.json`
- CREATE：`deliverable://construction-admission/browser-demolition.json`、`deliverable://browser-retirement/cutover-ledger.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`deliverable://browser-retirement/file-classification.json`、`deliverable://browser-retirement/consumer-registry.json`、`deliverable://construction-admission/browser-canonical-path.json`、`deliverable://browser-observation/preconstruction-chrome.json`
- 动作：`ACT-008`
- 输出：`deliverable://construction-admission/browser-demolition.json`、`deliverable://browser-retirement/cutover-ledger.json`
- 消费者交接：src/lib/local-runtime/workbench-browser-support.ts \| owner=local-runtime \| migration=WO-023 \| acceptance=ACC-023；src/lib/local-runtime/workbench-video-download-support.ts \| owner=local-runtime \| migration=WO-023/WO-026 \| acceptance=ACC-023/ACC-026；src/lib/local-runtime/workbench-ai-gateway-support.ts \| owner=local-runtime \| migration=WO-023/WO-025 \| acceptance=ACC-023/ACC-025；src/lib/local-runtime/workbench-assembly.ts \| owner=local-runtime \| migration=WO-023 \| acceptance=ACC-023；src/capabilities/dom-automation/runtime/dom-target-binding.ts \| owner=dom-automation \| migration=WO-024 \| acceptance=ACC-024；src/capabilities/ai-input-gateway/ability-group.ts \| owner=ai-input-gateway \| migration=WO-025 \| acceptance=ACC-025；src/capabilities/video-download/children/download-web-video-once.ts \| owner=video-download \| migration=WO-026 \| acceptance=ACC-026；src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts \| owner=amazon-invoice-upload \| migration=WO-027 \| acceptance=ACC-027；src/plugins/amazon-product-mining/amazon-product-mining.flow-support.ts \| owner=amazon-product-mining \| migration=WO-028 \| acceptance=ACC-028；src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-proof.ts \| owner=xuanxue-ai-production \| migration=WO-029 \| acceptance=ACC-029；scripts/acceptance/local-browser-real-chrome-scenarios.acceptance.ts \| owner=acceptance \| migration=WO-034 \| acceptance=ACC-034
- 验收：`ACC-008`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-009`、`WO-010`、`WO-011`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-009：物理删除现有 Browser 实现片区

- 单一结果：删除获准 Browser 根内全部现实现，构造期 authority 明确 ABSENT。
- owner：Browser owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-008`；决策门：无；并行组：`DEMOLITION`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://construction-admission/browser-demolition.json`、`deliverable://browser-retirement/cutover-ledger.json`
- CREATE：`deliverable://work-orders/WO-009/receipt.json`
- MODIFY：无
- RETIRE/DELETE：`deliverable://browser-retirement/file-classification.json#delete_targets`
- 输入：`deliverable://construction-admission/browser-demolition.json`、`deliverable://browser-retirement/cutover-ledger.json`
- 动作：`ACT-009`
- 输出：`deliverable://work-orders/WO-009/receipt.json`
- 消费者交接：CON-001 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.；CON-002 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.；CON-003 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.；CON-004 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.；CON-005 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.；CON-006 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.；CON-007 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.；CON-008 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.；CON-009 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.；CON-010 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.；CON-011 is mapped by deliverable://browser-retirement/consumer-registry.json and remains BLOCKED until its named migration acceptance passes.
- 验收：`ACC-009`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-012`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-010：物理删除旧 Local Runtime Browser support

- 单一结果：删除两个旧 support surface，不保留别名、wrapper 或 authority 平行文件。
- owner：local-runtime owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-008`；决策门：无；并行组：`DEMOLITION`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://browser-retirement/cutover-ledger.json`
- CREATE：`deliverable://work-orders/WO-010/receipt.json`
- MODIFY：无
- RETIRE/DELETE：`src/lib/local-runtime/workbench-browser-support.ts`、`src/lib/local-runtime/workbench-video-download-support.ts`
- 输入：`deliverable://browser-retirement/cutover-ledger.json`
- 动作：`ACT-010`
- 输出：`deliverable://work-orders/WO-010/receipt.json`
- 消费者交接：CON-001 remains BLOCKED until WO-023 creates workbench-browser-authority-support.ts; src/lib/local-runtime/workbench-browser-support.ts is permanently absent.；CON-002 remains BLOCKED until WO-023 Broker injection and WO-026 capability migration; src/lib/local-runtime/workbench-video-download-support.ts is permanently absent.
- 验收：`ACC-010`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-012`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-011：物理删除旧 Local Browser 验收面

- 单一结果：删除当前 legacy local-browser acceptance，未来验收只按终态合同重建。
- owner：acceptance owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-008`；决策门：无；并行组：`DEMOLITION`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://browser-retirement/cutover-ledger.json`
- CREATE：`deliverable://work-orders/WO-011/receipt.json`
- MODIFY：无
- RETIRE/DELETE：`scripts/acceptance/local-browser-artifact-contract.acceptance.ts`、`scripts/acceptance/local-browser-atomic-cutover.acceptance.ts`、`scripts/acceptance/local-browser-business-workday.acceptance.ts`、`scripts/acceptance/local-browser-exact-target-contract.acceptance.ts`、`scripts/acceptance/local-browser-native-transport.acceptance.ts`、`scripts/acceptance/local-browser-real-chrome-scenarios.acceptance.ts`、`scripts/acceptance/local-browser-real-chrome.acceptance.ts`、`scripts/acceptance/local-browser-target-actions.acceptance.ts`
- 输入：`deliverable://browser-retirement/cutover-ledger.json`
- 动作：`ACT-011`
- 输出：`deliverable://work-orders/WO-011/receipt.json`
- 消费者交接：CON-011 migrates only to WO-034/ACC-034; every retired legacy acceptance remains non-authoritative.
- 验收：`ACC-011`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-012`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-012：建立 canonical protocol schema

- 单一结果：建立消息、framing、budget、artifact grant 与 registry hash 的单一源。
- owner：Browser protocol owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-009`、`WO-010`、`WO-011`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://work-orders/WO-009/receipt.json`、`deliverable://work-orders/WO-010/receipt.json`、`deliverable://work-orders/WO-011/receipt.json`
- CREATE：`src/lib/browser/protocol/browser-protocol.schema.json`、`src/lib/browser/protocol/browser-authority-certificate.schema.json`、`src/lib/browser/protocol/browser-authority-liveness-lease.schema.json`、`src/lib/browser/protocol/browser-profile-enrollment.schema.json`、`src/lib/browser/protocol/browser-file-artifact-grant.schema.json`、`src/lib/browser/protocol/browser-capabilities.json`、`src/lib/browser/protocol/browser-errors.json`、`src/lib/browser/protocol/browser-protocol-schema.acceptance.ts`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`deliverable://work-orders/WO-009/receipt.json`、`deliverable://work-orders/WO-010/receipt.json`、`deliverable://work-orders/WO-011/receipt.json`
- 动作：`ACT-012`
- 输出：`src/lib/browser/protocol/browser-protocol.schema.json`、`src/lib/browser/protocol/browser-authority-certificate.schema.json`、`src/lib/browser/protocol/browser-authority-liveness-lease.schema.json`、`src/lib/browser/protocol/browser-profile-enrollment.schema.json`、`src/lib/browser/protocol/browser-file-artifact-grant.schema.json`、`src/lib/browser/protocol/browser-capabilities.json`、`src/lib/browser/protocol/browser-errors.json`、`src/lib/browser/protocol/browser-protocol-schema.acceptance.ts`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-012`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-013`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-013：建立确定性协议 codegen

- 单一结果：从唯一 schema 生成 TypeScript 与 Rust 合同并证明两端 hash 相同。
- owner：Browser protocol codegen owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-012`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/browser/protocol/browser-protocol.schema.json`、`src/lib/browser/protocol/browser-protocol-schema.acceptance.ts`
- CREATE：`src/lib/browser/protocol/generated/browser-protocol.generated.ts`、`src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs`、`src/lib/browser/protocol/browser-protocol-codegen.acceptance.ts`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`src/lib/browser/protocol/browser-protocol.schema.json`、`src/lib/browser/protocol/browser-protocol-schema.acceptance.ts`
- 动作：`ACT-013`
- 输出：`src/lib/browser/protocol/generated/browser-protocol.generated.ts`、`src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs`、`src/lib/browser/protocol/browser-protocol-codegen.acceptance.ts`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-013`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-014`、`WO-015`、`WO-022`、`WO-046`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-014：建设 Rust Native Host

- 单一结果：只建设 framing、认证握手、单 Port 与有界 I/O 的 Host。
- owner：Native Host owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-013`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/browser/protocol/generated/browser-protocol.generated.ts`、`src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs`
- CREATE：`src/lib/browser/native-messaging-host/Cargo.toml`、`src/lib/browser/native-messaging-host/crates/host/Cargo.toml`、`src/lib/browser/native-messaging-host/crates/host/src/main.rs`、`src/lib/browser/native-messaging-host/crates/host/src/browser-native-framing.rs`、`src/lib/browser/native-messaging-host/crates/host/src/raw-channel.rs`、`src/lib/browser/native-messaging-host/crates/host/src/authenticated-channel.rs`、`src/lib/browser/native-messaging-host/crates/host/src/transcript.rs`、`src/lib/browser/native-messaging-host/crates/host/src/artifact-stream.rs`、`src/lib/browser/native-messaging-host/crates/host/tests/native-host.acceptance.rs`、`src/lib/browser/native-messaging-host/Cargo.lock`、`src/lib/browser/native-messaging-host/crates/host/fuzz/Cargo.toml`、`src/lib/browser/native-messaging-host/crates/host/fuzz/fuzz_targets/native_framing.rs`、`src/lib/browser/native-messaging-host/crates/host/fuzz/corpus/native_framing/seed.bin`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`src/lib/browser/protocol/generated/browser-protocol.generated.ts`、`src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs`
- 动作：`ACT-014`
- 输出：`src/lib/browser/native-messaging-host/Cargo.toml`、`src/lib/browser/native-messaging-host/crates/host/Cargo.toml`、`src/lib/browser/native-messaging-host/crates/host/src/main.rs`、`src/lib/browser/native-messaging-host/crates/host/src/browser-native-framing.rs`、`src/lib/browser/native-messaging-host/crates/host/src/raw-channel.rs`、`src/lib/browser/native-messaging-host/crates/host/src/authenticated-channel.rs`、`src/lib/browser/native-messaging-host/crates/host/src/transcript.rs`、`src/lib/browser/native-messaging-host/crates/host/src/artifact-stream.rs`、`src/lib/browser/native-messaging-host/crates/host/tests/native-host.acceptance.rs`、`src/lib/browser/native-messaging-host/Cargo.lock`、`src/lib/browser/native-messaging-host/crates/host/fuzz/Cargo.toml`、`src/lib/browser/native-messaging-host/crates/host/fuzz/fuzz_targets/native_framing.rs`、`src/lib/browser/native-messaging-host/crates/host/fuzz/corpus/native_framing/seed.bin`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-014`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-016`、`WO-046`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-015：建设 MV3 Extension

- 单一结果：只建设 NativePortActor、CommandRegistry 与 chrome.debugger 适配。
- owner：MV3 Extension owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-013`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/browser/protocol/generated/browser-protocol.generated.ts`、`src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs`
- CREATE：`src/lib/browser/chrome-extension/manifest.json`、`src/lib/browser/chrome-extension/service-worker.ts`、`src/lib/browser/chrome-extension/native-port-actor.ts`、`src/lib/browser/chrome-extension/command-registry.ts`、`src/lib/browser/chrome-extension/command-permit-validator.ts`、`src/lib/browser/chrome-extension/debugger-runtime.ts`、`src/lib/browser/chrome-extension/exact-target-runtime.ts`、`src/lib/browser/chrome-extension/dom-intent-runtime.ts`、`src/lib/browser/chrome-extension/artifact-stream.ts`、`src/lib/browser/chrome-extension/authenticated-heartbeat.ts`、`src/lib/browser/chrome-extension/extension.acceptance.ts`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`src/lib/browser/protocol/generated/browser-protocol.generated.ts`、`src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs`
- 动作：`ACT-015`
- 输出：`src/lib/browser/chrome-extension/manifest.json`、`src/lib/browser/chrome-extension/service-worker.ts`、`src/lib/browser/chrome-extension/native-port-actor.ts`、`src/lib/browser/chrome-extension/command-registry.ts`、`src/lib/browser/chrome-extension/command-permit-validator.ts`、`src/lib/browser/chrome-extension/debugger-runtime.ts`、`src/lib/browser/chrome-extension/exact-target-runtime.ts`、`src/lib/browser/chrome-extension/dom-intent-runtime.ts`、`src/lib/browser/chrome-extension/artifact-stream.ts`、`src/lib/browser/chrome-extension/authenticated-heartbeat.ts`、`src/lib/browser/chrome-extension/extension.acceptance.ts`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-015`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-016`、`WO-046`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-016：建设 TransportActor 与 Reducer

- 单一结果：只拥有 transport event、状态归约、fresh-chain retry 与 stale event 丢弃。
- owner：Browser transport owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-014`、`WO-015`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/browser/native-messaging-host/Cargo.toml`、`src/lib/browser/native-messaging-host/crates/host/src/main.rs`、`src/lib/browser/chrome-extension/manifest.json`、`src/lib/browser/chrome-extension/service-worker.ts`
- CREATE：`src/lib/browser/transport/raw-controller-host-channel.ts`、`src/lib/browser/transport/authenticated-controller-host-channel.ts`、`src/lib/browser/transport/transport-event.ts`、`src/lib/browser/transport/transport-reducer.ts`、`src/lib/browser/transport/transport-actor.ts`、`src/lib/browser/transport/transport-authenticator.ts`、`src/lib/browser/transport/transport-transcript.ts`、`src/lib/browser/transport/authenticated-heartbeat.ts`、`src/lib/browser/transport/browser-native-framing.ts`、`src/lib/browser/transport/browser-transport.acceptance.ts`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`src/lib/browser/native-messaging-host/Cargo.toml`、`src/lib/browser/native-messaging-host/crates/host/src/main.rs`、`src/lib/browser/chrome-extension/manifest.json`、`src/lib/browser/chrome-extension/service-worker.ts`
- 动作：`ACT-016`
- 输出：`src/lib/browser/transport/raw-controller-host-channel.ts`、`src/lib/browser/transport/authenticated-controller-host-channel.ts`、`src/lib/browser/transport/transport-event.ts`、`src/lib/browser/transport/transport-reducer.ts`、`src/lib/browser/transport/transport-actor.ts`、`src/lib/browser/transport/transport-authenticator.ts`、`src/lib/browser/transport/transport-transcript.ts`、`src/lib/browser/transport/authenticated-heartbeat.ts`、`src/lib/browser/transport/browser-native-framing.ts`、`src/lib/browser/transport/browser-transport.acceptance.ts`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-016`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-021`、`WO-047`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-017：建设 Authority Issuer

- 单一结果：只在 authenticated channel、profile/process/policy 与 liveness 全成立时产生 PRESENT authority。
- owner：Browser authority issuer owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-047`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/browser/transport/transport-event.ts`、`src/lib/browser/transport/transport-reducer.ts`
- CREATE：`src/lib/browser/infrastructure/browser-authority-lease.ts`、`src/lib/browser/infrastructure/browser-authority-issuer.ts`、`src/lib/browser/infrastructure/browser-authority-certificate.ts`、`src/lib/browser/infrastructure/browser-authority-liveness-lease.ts`、`src/lib/browser/infrastructure/browser-control-state.ts`、`src/lib/browser/infrastructure/browser-authority-issuer.acceptance.ts`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`src/lib/browser/transport/transport-event.ts`、`src/lib/browser/transport/transport-reducer.ts`
- 动作：`ACT-017`
- 输出：`src/lib/browser/infrastructure/browser-authority-lease.ts`、`src/lib/browser/infrastructure/browser-authority-issuer.ts`、`src/lib/browser/infrastructure/browser-authority-certificate.ts`、`src/lib/browser/infrastructure/browser-authority-liveness-lease.ts`、`src/lib/browser/infrastructure/browser-control-state.ts`、`src/lib/browser/infrastructure/browser-authority-issuer.acceptance.ts`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-017`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-018`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-018：建设 BrowserAuthorityBroker

- 单一结果：唯一业务入口只消费当前 execution binding 并返回 authority lease 或 typed unavailable。
- owner：Browser broker owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-017`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/browser/infrastructure/browser-authority-certificate.ts`、`src/lib/browser/infrastructure/browser-authority-issuer.ts`
- CREATE：`src/lib/browser/infrastructure/browser-authority-broker.ts`、`src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts`、`src/lib/browser/browser-authority-api.ts`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`src/lib/browser/infrastructure/browser-authority-certificate.ts`、`src/lib/browser/infrastructure/browser-authority-issuer.ts`
- 动作：`ACT-018`
- 输出：`src/lib/browser/infrastructure/browser-authority-broker.ts`、`src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts`、`src/lib/browser/browser-authority-api.ts`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-018`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-019`、`WO-023`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-019：建设 exact TargetLeaseManager

- 单一结果：只从当前 authority lease 取得唯一 target/document lease，epoch 变化立即失效。
- owner：Browser target lease owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-018`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/browser/infrastructure/browser-authority-broker.ts`、`src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts`
- CREATE：`src/lib/browser/exact-target/browser-target-ref.ts`、`src/lib/browser/exact-target/browser-document-ref.ts`、`src/lib/browser/exact-target/browser-target-lease.ts`、`src/lib/browser/exact-target/browser-target-lease-manager.ts`、`src/lib/browser/exact-target/browser-target-lease.acceptance.ts`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`src/lib/browser/infrastructure/browser-authority-broker.ts`、`src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts`
- 动作：`ACT-019`
- 输出：`src/lib/browser/exact-target/browser-target-ref.ts`、`src/lib/browser/exact-target/browser-document-ref.ts`、`src/lib/browser/exact-target/browser-target-lease.ts`、`src/lib/browser/exact-target/browser-target-lease-manager.ts`、`src/lib/browser/exact-target/browser-target-lease.acceptance.ts`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-019`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-020`、`WO-023`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-020：建设 CommandActor

- 单一结果：只执行 registry-owned declarative commands；mutation 不自动重放，歧义进入 OUTCOME_UNKNOWN。
- owner：Browser command owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-019`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/browser/exact-target/browser-target-lease.ts`、`src/lib/browser/exact-target/browser-target-lease-manager.ts`
- CREATE：`src/lib/browser/transport/command-permit.ts`、`src/lib/browser/transport/reply-channel-token.ts`、`src/lib/browser/transport/browser-command-admission-budget.ts`、`src/lib/browser/exact-target/browser-command-actor.ts`、`src/lib/browser/exact-target/browser-mutation-intent-journal.ts`、`src/lib/browser/exact-target/browser-dom-intent.ts`、`src/lib/browser/exact-target/browser-file-artifact-grant.ts`、`src/lib/browser/exact-target/browser-artifact-stream.ts`、`src/lib/browser/exact-target/browser-command.acceptance.ts`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`src/lib/browser/exact-target/browser-target-lease.ts`、`src/lib/browser/exact-target/browser-target-lease-manager.ts`
- 动作：`ACT-020`
- 输出：`src/lib/browser/transport/command-permit.ts`、`src/lib/browser/transport/reply-channel-token.ts`、`src/lib/browser/transport/browser-command-admission-budget.ts`、`src/lib/browser/exact-target/browser-command-actor.ts`、`src/lib/browser/exact-target/browser-mutation-intent-journal.ts`、`src/lib/browser/exact-target/browser-dom-intent.ts`、`src/lib/browser/exact-target/browser-file-artifact-grant.ts`、`src/lib/browser/exact-target/browser-artifact-stream.ts`、`src/lib/browser/exact-target/browser-command.acceptance.ts`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-020`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-023`、`WO-024`、`WO-026`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-021：建设 Profile 与 BrowserProcessSupervisor

- 单一结果：建设完整 profile 终态：config、state、dedicated policy、enrollment、receipt、process attestation、managed policy readback 与唯一 BrowserProcessSupervisor；enrollment mutation 仍只由 browserctl 执行。
- owner：Browser profile owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-016`、`WO-046`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/browser/protocol/browser-profile-enrollment.schema.json`、`src/lib/browser/native-messaging-host/crates/browserctl/src/enroll_profile.rs`、`deliverable://construction-admission/browser-canonical-path.json`
- CREATE：`src/lib/browser/profile/browser-profile-enrollment.ts`、`src/lib/browser/profile/dedicated-profile-policy.ts`、`src/lib/browser/profile/browser-profile-state.ts`、`src/lib/browser/profile/browser-profile-config.ts`、`src/lib/browser/profile/browser-profile-enrollment-receipt.ts`、`src/lib/browser/profile/browser-profile-process-attestation.ts`、`src/lib/browser/profile/managed-policy-readback.ts`、`src/lib/browser/profile/browser-process-supervisor.ts`、`src/lib/browser/profile/browser-profile.acceptance.ts`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`src/lib/browser/protocol/browser-profile-enrollment.schema.json`、`src/lib/browser/native-messaging-host/crates/browserctl/src/enroll_profile.rs`、`deliverable://construction-admission/browser-canonical-path.json`
- 动作：`ACT-021`
- 输出：`src/lib/browser/profile/browser-profile-enrollment.ts`、`src/lib/browser/profile/dedicated-profile-policy.ts`、`src/lib/browser/profile/browser-profile-state.ts`、`src/lib/browser/profile/browser-profile-config.ts`、`src/lib/browser/profile/browser-profile-enrollment-receipt.ts`、`src/lib/browser/profile/browser-profile-process-attestation.ts`、`src/lib/browser/profile/managed-policy-readback.ts`、`src/lib/browser/profile/browser-process-supervisor.ts`、`src/lib/browser/profile/browser-profile.acceptance.ts`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-021`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-023`、`WO-047`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-022：建设发布 schema 与空 ABSENT 激活槽

- 单一结果：只建立 ArtifactSet、ActivationTuple、ReleaseSecurityPolicy、ProofManifest、rollback、SBOM、provenance 与 build-input schemas，并初始化空 ABSENT slot；不签发任何候选身份。
- owner：Browser release identity owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-013`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/browser/protocol/browser-protocol.schema.json`、`src/lib/browser/protocol/generated/browser-protocol.generated.ts`、`src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs`
- CREATE：`src/lib/browser/release/browser-artifact-set.schema.json`、`src/lib/browser/release/browser-activation-tuple.schema.json`、`src/lib/browser/release/browser-release-proof.schema.json`、`src/lib/browser/release/browser-release-security-policy.schema.json`、`src/lib/browser/release/browser-rollback-receipt.schema.json`、`src/lib/browser/release/browser-build-inputs.schema.json`、`src/lib/browser/release/browser-sbom.schema.json`、`src/lib/browser/release/browser-provenance.schema.json`、`src/lib/browser/release/pinned-browser-toolchain.json`、`src/lib/browser/release/active-activation.json`、`src/lib/browser/release/release-identity.acceptance.ts`、`src/lib/browser/release/browser-build.config.json`、`src/lib/browser/release/browser-previous-activation-snapshot.schema.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`src/lib/browser/protocol/browser-protocol.schema.json`、`src/lib/browser/protocol/generated/browser-protocol.generated.ts`、`src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs`
- 动作：`ACT-022`
- 输出：`src/lib/browser/release/browser-artifact-set.schema.json`、`src/lib/browser/release/browser-activation-tuple.schema.json`、`src/lib/browser/release/browser-release-proof.schema.json`、`src/lib/browser/release/browser-release-security-policy.schema.json`、`src/lib/browser/release/browser-rollback-receipt.schema.json`、`src/lib/browser/release/browser-build-inputs.schema.json`、`src/lib/browser/release/browser-sbom.schema.json`、`src/lib/browser/release/browser-provenance.schema.json`、`src/lib/browser/release/pinned-browser-toolchain.json`、`src/lib/browser/release/active-activation.json`、`src/lib/browser/release/release-identity.acceptance.ts`、`src/lib/browser/release/browser-build.config.json`、`src/lib/browser/release/browser-previous-activation-snapshot.schema.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-022`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-031`、`WO-033`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-023：接回 Local Runtime 唯一装配面

- 单一结果：Local Runtime 只注入 Broker；assembly 不领取或缓存 target lease；已退休的 workbench-browser-support.ts 与 workbench-video-download-support.ts 永久不存在。
- owner：local-runtime owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-018`、`WO-019`、`WO-020`、`WO-021`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/browser/infrastructure/browser-authority-broker.ts`、`src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts`、`src/lib/browser/exact-target/browser-target-lease.ts`、`src/lib/browser/exact-target/browser-target-lease-manager.ts`、`src/lib/browser/exact-target/browser-command-actor.ts`、`src/lib/browser/transport/command-permit.ts`、`src/lib/browser/profile/browser-profile-enrollment.ts`、`src/lib/browser/profile/browser-process-supervisor.ts`
- CREATE：`src/lib/local-runtime/workbench-browser-authority-support.ts`、`src/lib/local-runtime/workbench-browser-authority.acceptance.ts`
- MODIFY：`src/lib/local-runtime/workbench-assembly.ts`、`src/lib/local-runtime/workbench-ai-gateway-support.ts`、`src/lib/local-runtime/workbench-status.ts`、`src/lib/local-runtime/workbench.ts`
- RETIRE/DELETE：无
- 输入：`src/lib/browser/infrastructure/browser-authority-broker.ts`、`src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts`、`src/lib/browser/exact-target/browser-target-lease.ts`、`src/lib/browser/exact-target/browser-target-lease-manager.ts`、`src/lib/browser/exact-target/browser-command-actor.ts`、`src/lib/browser/transport/command-permit.ts`、`src/lib/browser/profile/browser-profile-enrollment.ts`、`src/lib/browser/profile/browser-process-supervisor.ts`
- 动作：`ACT-023`
- 输出：`src/lib/local-runtime/workbench-browser-authority-support.ts`、`src/lib/local-runtime/workbench-browser-authority.acceptance.ts`
- 消费者交接：src/lib/local-runtime/workbench-browser-support.ts \| owner=local-runtime \| terminal=permanently absent \| replacement=src/lib/local-runtime/workbench-browser-authority-support.ts \| acceptance=ACC-023；src/lib/local-runtime/workbench-video-download-support.ts \| owner=local-runtime \| terminal=permanently absent \| replacement=Broker injection in workbench-assembly.ts plus capability public factory in WO-026 \| acceptance=ACC-023/ACC-026；src/lib/local-runtime/workbench-ai-gateway-support.ts \| owner=local-runtime \| migration=WO-023/WO-025 \| acceptance=ACC-023/ACC-025；src/lib/local-runtime/workbench-assembly.ts \| owner=local-runtime \| migration=WO-023 \| acceptance=ACC-023
- 验收：`ACC-023`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-024`、`WO-025`、`WO-026`、`WO-027`、`WO-028`、`WO-029`、`WO-031`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-024：迁移 DOM Automation

- 单一结果：六个原子动作只消费当前 BrowserTargetLease 与命令 permit。
- owner：dom-automation owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-020`、`WO-023`、`WO-007`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/browser/exact-target/browser-command-actor.ts`、`src/lib/browser/transport/command-permit.ts`、`src/lib/local-runtime/workbench-browser-authority-support.ts`、`src/lib/local-runtime/workbench-browser-authority.acceptance.ts`、`deliverable://browser-observation/preconstruction-chrome.json`
- CREATE：`src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts`
- MODIFY：`src/capabilities/dom-automation/runtime/dom-target-binding.ts`、`src/capabilities/dom-automation/runtime/dom-snapshot.ts`、`src/capabilities/dom-automation/runtime/dom-fill.ts`、`src/capabilities/dom-automation/runtime/dom-click.ts`、`src/capabilities/dom-automation/runtime/dom-upload.ts`、`src/capabilities/dom-automation/runtime/dom-evidence.ts`
- RETIRE/DELETE：无
- 输入：`src/lib/browser/exact-target/browser-command-actor.ts`、`src/lib/browser/transport/command-permit.ts`、`src/lib/local-runtime/workbench-browser-authority-support.ts`、`src/lib/local-runtime/workbench-browser-authority.acceptance.ts`、`deliverable://browser-observation/preconstruction-chrome.json`
- 动作：`ACT-024`
- 输出：`src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts`
- 消费者交接：src/capabilities/dom-automation/runtime/dom-target-binding.ts \| owner=dom-automation \| migration=WO-024 \| acceptance=ACC-024
- 验收：`ACC-024`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-025`、`WO-027`、`WO-028`、`WO-031`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-025：迁移 AI Input Gateway

- 单一结果：每次 provider execution/checkpoint 重新取得并释放 authority/target；删除 BrowserTargetSession fixture 合同。
- owner：ai-input-gateway owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-023`、`WO-024`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/local-runtime/workbench-browser-authority-support.ts`、`src/lib/local-runtime/workbench-browser-authority.acceptance.ts`、`src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts`
- CREATE：`src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts`
- MODIFY：`src/capabilities/ai-input-gateway/ability-group.ts`、`src/capabilities/ai-input-gateway/contracts/ai-provider-adapter.contract.ts`、`src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution.ts`、`src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-browser.ts`、`src/capabilities/ai-input-gateway/providers/web-chat-page-actions.ts`、`src/capabilities/ai-input-gateway/children/attach-approved-web-chat-files-once.ts`、`src/capabilities/ai-input-gateway/acceptance/attachment.acceptance.ts`、`src/capabilities/ai-input-gateway/acceptance/provider-boundary.acceptance.ts`
- RETIRE/DELETE：无
- 输入：`src/lib/local-runtime/workbench-browser-authority-support.ts`、`src/lib/local-runtime/workbench-browser-authority.acceptance.ts`、`src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts`
- 动作：`ACT-025`
- 输出：`src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts`
- 消费者交接：src/capabilities/ai-input-gateway/ability-group.ts \| owner=ai-input-gateway \| migration=WO-025 \| acceptance=ACC-025
- 验收：`ACC-025`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-028`、`WO-029`、`WO-031`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-026：迁移 Video Download

- 单一结果：来源页探测只使用命名、有界 observation capability，不允许 evaluate 或脚本 fallback。
- owner：video-download owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-020`、`WO-023`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/browser/exact-target/browser-command-actor.ts`、`src/lib/browser/transport/command-permit.ts`、`src/lib/local-runtime/workbench-browser-authority-support.ts`、`src/lib/local-runtime/workbench-browser-authority.acceptance.ts`
- CREATE：`src/capabilities/video-download/acceptance/browser-authority.acceptance.ts`
- MODIFY：`src/capabilities/video-download/children/download-web-video-once.ts`、`src/capabilities/video-download/children/download-facebook-video-once.ts`、`src/capabilities/video-download/children/download-tiktok-video-once.ts`
- RETIRE/DELETE：无
- 输入：`src/lib/browser/exact-target/browser-command-actor.ts`、`src/lib/browser/transport/command-permit.ts`、`src/lib/local-runtime/workbench-browser-authority-support.ts`、`src/lib/local-runtime/workbench-browser-authority.acceptance.ts`
- 动作：`ACT-026`
- 输出：`src/capabilities/video-download/acceptance/browser-authority.acceptance.ts`
- 消费者交接：src/capabilities/video-download/children/download-web-video-once.ts \| owner=video-download \| migration=WO-026 \| acceptance=ACC-026
- 验收：`ACC-026`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-031`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-027：迁移 Amazon Invoice Upload

- 单一结果：只改 Browser 边界，保留业务顺序和人工最终门；每个 mutation 有 journal 与 owner outcome resolution。
- owner：amazon-invoice-upload owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-023`、`WO-024`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/local-runtime/workbench-browser-authority-support.ts`、`src/lib/local-runtime/workbench-browser-authority.acceptance.ts`、`src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts`
- CREATE：`src/plugins/amazon-invoice-upload/amazon-invoice-upload-browser-authority.acceptance.ts`
- MODIFY：`src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts`、`src/plugins/amazon-invoice-upload/amazon-invoice-upload-file-attachment.ts`、`src/plugins/amazon-invoice-upload/amazon-invoice-upload-steps.ts`、`src/plugins/amazon-invoice-upload/amazon-invoice-upload-verify.ts`、`src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts`、`src/plugins/amazon-invoice-upload/amazon-tax-invoice-download-flow-actions.ts`、`src/plugins/amazon-invoice-upload/amazon-tax-invoice-download-flow-navigation.ts`、`src/plugins/amazon-invoice-upload/amazon-tax-invoice-download.flow.ts`
- RETIRE/DELETE：无
- 输入：`src/lib/local-runtime/workbench-browser-authority-support.ts`、`src/lib/local-runtime/workbench-browser-authority.acceptance.ts`、`src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts`
- 动作：`ACT-027`
- 输出：`src/plugins/amazon-invoice-upload/amazon-invoice-upload-browser-authority.acceptance.ts`
- 消费者交接：src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts \| owner=amazon-invoice-upload \| migration=WO-027 \| acceptance=ACC-027
- 验收：`ACC-027`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-031`、`WO-043`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-028：迁移 Amazon Product Mining

- 单一结果：每阶段使用当前 execution/authority/target，checkpoint 后不缓存旧 lease。
- owner：amazon-product-mining owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-023`、`WO-024`、`WO-025`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/local-runtime/workbench-browser-authority-support.ts`、`src/lib/local-runtime/workbench-browser-authority.acceptance.ts`、`src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts`、`src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts`
- CREATE：`src/plugins/amazon-product-mining/amazon-product-mining-browser-authority.acceptance.ts`
- MODIFY：`src/plugins/amazon-product-mining/amazon-product-mining.flow-support.ts`、`src/plugins/amazon-product-mining/amazon-product-mining.flow.ts`、`src/plugins/amazon-product-mining/amazon-product-mining.search.ts`、`src/plugins/amazon-product-mining/amazon-product-mining.product-detail.ts`、`src/plugins/amazon-product-mining/amazon-product-mining.reviews.ts`、`src/plugins/amazon-product-mining/index.ts`
- RETIRE/DELETE：无
- 输入：`src/lib/local-runtime/workbench-browser-authority-support.ts`、`src/lib/local-runtime/workbench-browser-authority.acceptance.ts`、`src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts`、`src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts`
- 动作：`ACT-028`
- 输出：`src/plugins/amazon-product-mining/amazon-product-mining-browser-authority.acceptance.ts`
- 消费者交接：src/plugins/amazon-product-mining/amazon-product-mining.flow-support.ts \| owner=amazon-product-mining \| migration=WO-028 \| acceptance=ACC-028
- 验收：`ACC-028`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-031`、`WO-043`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-029：迁移 xuanxue-ai-production receipt 生产者

- 单一结果：在唯一 AgentRuntimeReceiptV2 内记录有序 authority windows，窗口间零动作且无未裁决 mutation。
- owner：xuanxue-ai-production owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-023`、`WO-025`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/local-runtime/workbench-browser-authority-support.ts`、`src/lib/local-runtime/workbench-browser-authority.acceptance.ts`、`src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts`
- CREATE：`src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts`
- MODIFY：`src/plugins/xuanxue-ai-production/index.ts`、`src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-proof.ts`、`src/plugins/xuanxue-ai-production/xuanxue-ai-production-result.ts`
- RETIRE/DELETE：无
- 输入：`src/lib/local-runtime/workbench-browser-authority-support.ts`、`src/lib/local-runtime/workbench-browser-authority.acceptance.ts`、`src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts`
- 动作：`ACT-029`
- 输出：`src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts`
- 消费者交接：src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-proof.ts \| owner=xuanxue-ai-production \| migration=WO-029 \| acceptance=ACC-029
- 验收：`ACC-029`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-030`、`WO-031`、`WO-043`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-030：切换 xuanxue 唯一消费合同

- 单一结果：只在 DG-003 干净候选上修改三条冻结路径，不建立第二 election、receipt 或 verdict owner。
- owner：xuanxue dynamic-proof owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-004`、`WO-029`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://construction-admission/xuanxue-candidate.json`、`src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts`
- CREATE：`/Users/nexgen/Documents/xuanxue-web/tests/dynamic-proof/browser-authority-window-contract.test.ts`、`deliverable://work-orders/WO-030/cross-repo-receipt.json`
- MODIFY：`/Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/browser-authority-proof-contract.ts`、`/Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/collector-contracts.ts`、`/Users/nexgen/Documents/xuanxue-web/scripts/audit/domains/dynamic-proof/dynamic-agent-receipt-inspection.ts`
- RETIRE/DELETE：无
- 输入：`deliverable://construction-admission/xuanxue-candidate.json`、`src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts`
- 动作：`ACT-030`
- 输出：`/Users/nexgen/Documents/xuanxue-web/tests/dynamic-proof/browser-authority-window-contract.test.ts`、`deliverable://work-orders/WO-030/cross-repo-receipt.json`
- 消费者交接：Cross-repo target paths are exactly the three paths frozen by DG-003; no path wildcard is permitted.
- 验收：`ACC-030`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-031`、`WO-036`、`WO-048`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-031：扩充唯一 local-browser audit owner 到 law-SHA-bound 精确 26 项

- 单一结果：从当前 active law 的 SHA 绑定文本导出精确 26 个 machine-blocking checkId，并与现有 owner manifest/inspector 的独立 binding 集合做全等比较。
- owner：local-browser audit owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-022`、`WO-023`、`WO-024`、`WO-025`、`WO-026`、`WO-027`、`WO-028`、`WO-029`、`WO-030`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`.github/instructions/agent-rules/modules/module-local-browser-session.instructions.md`、`scripts/audit/domains/local-browser-session/manifest.json`、`scripts/audit/domains/local-browser-session/inspector.ts`
- CREATE：`scripts/audit/domains/local-browser-session/local-browser-26-checks.acceptance.ts`、`deliverable://work-orders/WO-031/26-check-receipt.json`
- MODIFY：`scripts/audit/domains/local-browser-session/manifest.json`、`scripts/audit/domains/local-browser-session/inspector.ts`
- RETIRE/DELETE：无
- 输入：`.github/instructions/agent-rules/modules/module-local-browser-session.instructions.md`、`scripts/audit/domains/local-browser-session/manifest.json`、`scripts/audit/domains/local-browser-session/inspector.ts`
- 动作：`ACT-031`
- 输出：`scripts/audit/domains/local-browser-session/local-browser-26-checks.acceptance.ts`、`deliverable://work-orders/WO-031/26-check-receipt.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-031`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-032`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-032：建立并通过确定性负例、性质、模型与 mutant 组

- 单一结果：26 个检查逐项拥有 negative/property/model/mutant 证据，generated truth 只由现有 builder 生成。
- owner：acceptance and audit test owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-031`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`scripts/audit/domains/local-browser-session/manifest.json`、`scripts/audit/domains/local-browser-session/inspector.ts`
- CREATE：`scripts/acceptance/local-browser-terminal-contract.acceptance.ts`、`scripts/acceptance/local-browser-26-mutants.acceptance.ts`、`scripts/acceptance/local-browser-property-model.acceptance.ts`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`scripts/audit/domains/local-browser-session/manifest.json`、`scripts/audit/domains/local-browser-session/inspector.ts`
- 动作：`ACT-032`
- 输出：`scripts/acceptance/local-browser-terminal-contract.acceptance.ts`、`scripts/acceptance/local-browser-26-mutants.acceptance.ts`、`scripts/acceptance/local-browser-property-model.acceptance.ts`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-032`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-035`、`WO-044`、`WO-048`、`WO-058`、`WO-059`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-033：构建一次不可变 ArtifactSet

- 单一结果：只从 WO-060 冻结的 source bundles/tree manifests 与精确 package/tsconfig/build config 输入构建 Controller、Host、browserctl、launcher、platform adapter、Verified CRX、Native Messaging manifest、checksums/signature 九个实体；ArtifactSet 仅索引这些 content-addressed entities。
- owner：release build owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-003`、`WO-022`、`WO-060`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://construction-admission/external-operations.json`、`deliverable://browser-release/constructed-release-candidate.json`、`deliverable://browser-release/agent-constructed-tree-manifest.json`、`deliverable://browser-release/agent-build-input-manifest.json`、`deliverable://browser-release/agent-constructed-source-bundle.tar.zst`、`deliverable://browser-release/xuanxue-constructed-tree-manifest.json`、`deliverable://browser-release/xuanxue-constructed-source-bundle.tar.zst`
- CREATE：`artifact://browser-release/controller/controller-bundle.tgz`、`artifact://browser-release/native-host/grasseye-browser-host`、`artifact://browser-release/browserctl/browserctl`、`artifact://browser-release/launcher/grasseye-browser-launcher`、`artifact://browser-release/platform-macos/libgrasseye-platform-macos.a`、`artifact://browser-release/extension/grasseye-browser-extension.verified.crx`、`artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json`、`artifact://browser-release/checksums/SHA256SUMS`、`artifact://browser-release/signatures/SHA256SUMS.sig`、`deliverable://browser-release/browser-build-input-lock.json`、`deliverable://browser-release/artifact-set.json`、`deliverable://browser-release/builder-a-receipt.json`、`deliverable://browser-release/builder-b-receipt.json`、`deliverable://browser-release/sbom.spdx.json`、`deliverable://browser-release/provenance.json`、`deliverable://browser-release/installed-artifact-readback.json`、`src/lib/browser/release/build-artifacts.mjs`、`src/lib/browser/release/verify-artifacts.mjs`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`deliverable://construction-admission/external-operations.json`、`deliverable://browser-release/constructed-release-candidate.json`、`deliverable://browser-release/agent-constructed-tree-manifest.json`、`deliverable://browser-release/agent-build-input-manifest.json`、`deliverable://browser-release/agent-constructed-source-bundle.tar.zst`、`deliverable://browser-release/xuanxue-constructed-tree-manifest.json`、`deliverable://browser-release/xuanxue-constructed-source-bundle.tar.zst`
- 动作：`ACT-033`
- 输出：`artifact://browser-release/controller/controller-bundle.tgz`、`artifact://browser-release/native-host/grasseye-browser-host`、`artifact://browser-release/browserctl/browserctl`、`artifact://browser-release/launcher/grasseye-browser-launcher`、`artifact://browser-release/platform-macos/libgrasseye-platform-macos.a`、`artifact://browser-release/extension/grasseye-browser-extension.verified.crx`、`artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json`、`artifact://browser-release/checksums/SHA256SUMS`、`artifact://browser-release/signatures/SHA256SUMS.sig`、`deliverable://browser-release/browser-build-input-lock.json`、`deliverable://browser-release/artifact-set.json`、`deliverable://browser-release/builder-a-receipt.json`、`deliverable://browser-release/builder-b-receipt.json`、`deliverable://browser-release/sbom.spdx.json`、`deliverable://browser-release/provenance.json`、`deliverable://browser-release/installed-artifact-readback.json`、`src/lib/browser/release/build-artifacts.mjs`、`src/lib/browser/release/verify-artifacts.mjs`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-033`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-050`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-034：运行同一 ArtifactSet 的真实 Chrome 矩阵

- 单一结果：在 Stable 与 CfT 上对同一 ArtifactSet、ActivationTuple candidate 与 ReleaseSecurityPolicy 完成 profile/process/policy、auth、target、file、stream、update 与 rollback 正反终态。
- owner：real Chrome evidence owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-050`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://browser-release/artifact-set.json`、`deliverable://browser-release/activation-tuple-candidate.json`、`deliverable://browser-release/release-security-policy.json`、`deliverable://browser-release/release-identity-signature.json`、`deliverable://browser-observation/preconstruction-chrome.json`、`artifact://browser-release/controller/controller-bundle.tgz`、`artifact://browser-release/native-host/grasseye-browser-host`、`artifact://browser-release/browserctl/browserctl`、`artifact://browser-release/launcher/grasseye-browser-launcher`、`artifact://browser-release/platform-macos/libgrasseye-platform-macos.a`、`artifact://browser-release/extension/grasseye-browser-extension.verified.crx`、`artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json`、`artifact://browser-release/checksums/SHA256SUMS`、`artifact://browser-release/signatures/SHA256SUMS.sig`、`deliverable://browser-release/constructed-release-candidate.json`
- CREATE：`scripts/acceptance/local-browser-real-chrome-terminal.acceptance.ts`、`deliverable://browser-release/real-chrome-matrix.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`deliverable://browser-release/artifact-set.json`、`deliverable://browser-release/activation-tuple-candidate.json`、`deliverable://browser-release/release-security-policy.json`、`deliverable://browser-release/release-identity-signature.json`、`deliverable://browser-observation/preconstruction-chrome.json`、`artifact://browser-release/controller/controller-bundle.tgz`、`artifact://browser-release/native-host/grasseye-browser-host`、`artifact://browser-release/browserctl/browserctl`、`artifact://browser-release/launcher/grasseye-browser-launcher`、`artifact://browser-release/platform-macos/libgrasseye-platform-macos.a`、`artifact://browser-release/extension/grasseye-browser-extension.verified.crx`、`artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json`、`artifact://browser-release/checksums/SHA256SUMS`、`artifact://browser-release/signatures/SHA256SUMS.sig`、`deliverable://browser-release/constructed-release-candidate.json`
- 动作：`ACT-034`
- 输出：`scripts/acceptance/local-browser-real-chrome-terminal.acceptance.ts`、`deliverable://browser-release/real-chrome-matrix.json`
- 消费者交接：scripts/acceptance/local-browser-real-chrome-scenarios.acceptance.ts \| owner=acceptance \| migration=WO-034 \| acceptance=ACC-034
- 验收：`ACC-034`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-036`、`WO-043`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-035：锁定 GitHub required checks 与 branch protection

- 单一结果：Consume only deliverable://construction-admission/agent-repository-governance-policy.json; sign remote pre-state, PATCH exact main strict/contexts, GET signed post-state, and restore signed pre-state plus GET on failure.
- owner：AGENT repository governance owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-032`、`WO-056`、`WO-060`；决策门：无；并行组：`RELEASE_GOVERNANCE`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`scripts/audit/domains/local-browser-session/manifest.json`、`deliverable://browser-release/constructed-release-candidate.json`、`deliverable://construction-admission/agent-repository-governance-policy.json`
- CREATE：`deliverable://browser-release/agent-branch-protection-prestate.json`、`deliverable://browser-release/branch-protection-readback.json`、`deliverable://browser-release/agent-branch-protection-recovery-receipt.json`
- MODIFY：`system://github/ADVISION-X/AGENT/branches/main/protection/required_status_checks`
- RETIRE/DELETE：无
- 输入：`scripts/audit/domains/local-browser-session/manifest.json`、`deliverable://browser-release/constructed-release-candidate.json`、`deliverable://construction-admission/agent-repository-governance-policy.json`
- 动作：`ACT-035A`、`ACT-035B`、`ACT-035C`
- 输出：`deliverable://browser-release/agent-branch-protection-prestate.json`、`deliverable://browser-release/branch-protection-readback.json`、`deliverable://browser-release/agent-branch-protection-recovery-receipt.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-035A`、`ACC-035B`、`ACC-035C`
- 失败动作：Run ACT-035C: PATCH the signed pre-state, GET again, emit deliverable://browser-release/agent-branch-protection-recovery-receipt.json with RESTORED or RECOVERY_FAILED, and stop release work.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Only the signed deliverable://browser-release/agent-branch-protection-prestate.json may be restored; verify exact strict/contexts readback before any retry.
- handoff：`WO-041`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-036：执行主备 handover

- 单一结果：一主一热备只消费 xuanxue 数据库 fence，完成 revoke/checkpoint/fresh-window 交接并证明零 dual-active。
- owner：HA operations owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-003`、`WO-030`、`WO-034`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://construction-admission/external-operations.json`、`deliverable://construction-admission/xuanxue-candidate.json`、`deliverable://browser-release/real-chrome-matrix.json`、`deliverable://browser-release/activation-tuple-candidate.json`、`deliverable://browser-release/release-security-policy.json`、`deliverable://browser-release/release-identity-signature.json`、`deliverable://browser-release/constructed-release-candidate.json`
- CREATE：`deliverable://browser-release/ha-handover.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`deliverable://construction-admission/external-operations.json`、`deliverable://construction-admission/xuanxue-candidate.json`、`deliverable://browser-release/real-chrome-matrix.json`、`deliverable://browser-release/activation-tuple-candidate.json`、`deliverable://browser-release/release-security-policy.json`、`deliverable://browser-release/release-identity-signature.json`、`deliverable://browser-release/constructed-release-candidate.json`
- 动作：`ACT-036`
- 输出：`deliverable://browser-release/ha-handover.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-036`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-037`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-037：完成 24h 与 168h soak

- 单一结果：对同一 ArtifactSet 和 HA 拓扑完成法定时长，任何 forbidden metric 非零即整段作废。
- owner：soak evidence owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-036`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://browser-release/ha-handover.json`、`deliverable://browser-release/artifact-set.json`、`deliverable://browser-release/activation-tuple-candidate.json`、`deliverable://browser-release/release-security-policy.json`、`deliverable://browser-release/release-identity-signature.json`、`deliverable://browser-release/constructed-release-candidate.json`
- CREATE：`deliverable://browser-release/soak-24h.json`、`deliverable://browser-release/soak-168h.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`deliverable://browser-release/ha-handover.json`、`deliverable://browser-release/artifact-set.json`、`deliverable://browser-release/activation-tuple-candidate.json`、`deliverable://browser-release/release-security-policy.json`、`deliverable://browser-release/release-identity-signature.json`、`deliverable://browser-release/constructed-release-candidate.json`
- 动作：`ACT-037`
- 输出：`deliverable://browser-release/soak-24h.json`、`deliverable://browser-release/soak-168h.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-037`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-041`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-038：创建 BrowserReleaseProofManifestV1

- 单一结果：首次创建 proof manifest，绑定同一 candidate、ArtifactSet、ActivationTuple 候选、安全策略、26 checks、Chrome、HA、soak 与 branch readback。
- owner：release proof owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-041`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://work-orders/WO-031/26-check-receipt.json`、`deliverable://work-orders/WO-030/cross-repo-receipt.json`、`deliverable://browser-release/artifact-set.json`、`deliverable://browser-release/activation-tuple-candidate.json`、`deliverable://browser-release/release-security-policy.json`、`deliverable://browser-release/real-chrome-matrix.json`、`deliverable://browser-release/business-workday-receipt.json`、`deliverable://browser-release/branch-protection-readback.json`、`deliverable://browser-release/ha-handover.json`、`deliverable://browser-release/soak-24h.json`、`deliverable://browser-release/soak-168h.json`、`deliverable://browser-release/ci-full-receipt.json`、`deliverable://browser-release/independent-audit.json`、`scripts/audit/generated/audit-plan.generated.json`、`deliverable://browser-release/xuanxue-branch-protection-readback.json`、`deliverable://browser-release/browser-build-input-lock.json`、`deliverable://browser-release/sbom.spdx.json`、`deliverable://browser-release/provenance.json`、`deliverable://browser-release/installed-artifact-readback.json`、`deliverable://browser-release/release-identity-signature.json`、`deliverable://browser-release/constructed-release-candidate.json`
- CREATE：`deliverable://browser-release/BrowserReleaseProofManifestV1.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`deliverable://work-orders/WO-031/26-check-receipt.json`、`deliverable://work-orders/WO-030/cross-repo-receipt.json`、`deliverable://browser-release/artifact-set.json`、`deliverable://browser-release/activation-tuple-candidate.json`、`deliverable://browser-release/release-security-policy.json`、`deliverable://browser-release/real-chrome-matrix.json`、`deliverable://browser-release/business-workday-receipt.json`、`deliverable://browser-release/branch-protection-readback.json`、`deliverable://browser-release/ha-handover.json`、`deliverable://browser-release/soak-24h.json`、`deliverable://browser-release/soak-168h.json`、`deliverable://browser-release/ci-full-receipt.json`、`deliverable://browser-release/independent-audit.json`、`scripts/audit/generated/audit-plan.generated.json`、`deliverable://browser-release/xuanxue-branch-protection-readback.json`、`deliverable://browser-release/browser-build-input-lock.json`、`deliverable://browser-release/sbom.spdx.json`、`deliverable://browser-release/provenance.json`、`deliverable://browser-release/installed-artifact-readback.json`、`deliverable://browser-release/release-identity-signature.json`、`deliverable://browser-release/constructed-release-candidate.json`
- 动作：`ACT-038`
- 输出：`deliverable://browser-release/BrowserReleaseProofManifestV1.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-038`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-039`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-039：原子激活唯一 ActivationTuple

- 单一结果：只消费已签 proof manifest，先签发 PreviousActivationSnapshot=SIGNED_ABSENT 或 SIGNED_PRESENT(tuple)，再 CAS 切换一个 active tuple。
- owner：release activation owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-038`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://browser-release/BrowserReleaseProofManifestV1.json`、`deliverable://browser-release/constructed-release-candidate.json`
- CREATE：`deliverable://browser-release/activation-receipt.json`、`deliverable://browser-release/previous-activation-snapshot.json`
- MODIFY：`system://browser-release/active-activation-slot`
- RETIRE/DELETE：`deliverable://browser-release/construction-blocked-browser-authority`
- 输入：`deliverable://browser-release/BrowserReleaseProofManifestV1.json`、`deliverable://browser-release/constructed-release-candidate.json`
- 动作：`ACT-039`
- 输出：`deliverable://browser-release/activation-receipt.json`、`deliverable://browser-release/previous-activation-snapshot.json`
- 消费者交接：CON-001 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.；CON-002 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.；CON-003 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.；CON-004 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.；CON-005 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.；CON-006 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.；CON-007 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.；CON-008 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.；CON-009 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.；CON-010 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.；CON-011 switches only under CUT-005 after ACC-038 PASS; failed CAS keeps the consumer BLOCKED or on signed previous tuple.
- 验收：`ACC-039`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-040`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-040：执行激活后生产 readback

- 单一结果：只读安装、policy、process、extension、Host、authority slot 与业务 receipt；输出 PASS readback 或 POST_ACTIVATION_MISMATCH，不隐式取得 revoke、rollback、CAS 或 consumer 写权。
- owner：production readback owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-039`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://browser-release/activation-receipt.json`、`deliverable://browser-release/BrowserReleaseProofManifestV1.json`、`deliverable://browser-release/constructed-release-candidate.json`
- CREATE：`deliverable://browser-release/post-activation-readback.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`deliverable://browser-release/activation-receipt.json`、`deliverable://browser-release/BrowserReleaseProofManifestV1.json`、`deliverable://browser-release/constructed-release-candidate.json`
- 动作：`ACT-040`
- 输出：`deliverable://browser-release/post-activation-readback.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-040`
- 失败动作：Emit POST_ACTIVATION_MISMATCH and hand off only to WO-051; do not mutate authority, installation, activation slot or consumer admission in WO-040.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：On PASS hand off to WO-042; on POST_ACTIVATION_MISMATCH hand off to WO-051. No other state transition is allowed.
- handoff：`WO-042`、`WO-051`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-041：执行全新独立只读终审

- 单一结果：独立审计者绑定同一候选和 artifact，审查法案执法面、旧路径零可达与所有 proof receipts。
- owner：independent read-only audit owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-035`、`WO-037`、`WO-043`、`WO-044`、`WO-048`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://work-orders/WO-031/26-check-receipt.json`、`deliverable://work-orders/WO-030/cross-repo-receipt.json`、`deliverable://browser-release/artifact-set.json`、`deliverable://browser-release/activation-tuple-candidate.json`、`deliverable://browser-release/release-security-policy.json`、`deliverable://browser-release/real-chrome-matrix.json`、`deliverable://browser-release/business-workday-receipt.json`、`deliverable://browser-release/branch-protection-readback.json`、`deliverable://browser-release/ha-handover.json`、`deliverable://browser-release/soak-24h.json`、`deliverable://browser-release/soak-168h.json`、`deliverable://browser-release/ci-full-receipt.json`、`deliverable://browser-release/xuanxue-branch-protection-readback.json`、`deliverable://browser-release/browser-build-input-lock.json`、`deliverable://browser-release/sbom.spdx.json`、`deliverable://browser-release/provenance.json`、`deliverable://browser-release/installed-artifact-readback.json`、`deliverable://browser-release/release-identity-signature.json`、`deliverable://browser-release/agent-branch-protection-prestate.json`、`deliverable://browser-release/agent-branch-protection-recovery-receipt.json`、`deliverable://browser-release/xuanxue-branch-protection-prestate.json`、`deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json`、`deliverable://browser-release/constructed-release-candidate.json`、`deliverable://construction-admission/agent-repository-governance-policy.json`、`deliverable://construction-admission/xuanxue-repository-governance-policy.json`
- CREATE：`deliverable://browser-release/independent-audit.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`deliverable://work-orders/WO-031/26-check-receipt.json`、`deliverable://work-orders/WO-030/cross-repo-receipt.json`、`deliverable://browser-release/artifact-set.json`、`deliverable://browser-release/activation-tuple-candidate.json`、`deliverable://browser-release/release-security-policy.json`、`deliverable://browser-release/real-chrome-matrix.json`、`deliverable://browser-release/business-workday-receipt.json`、`deliverable://browser-release/branch-protection-readback.json`、`deliverable://browser-release/ha-handover.json`、`deliverable://browser-release/soak-24h.json`、`deliverable://browser-release/soak-168h.json`、`deliverable://browser-release/ci-full-receipt.json`、`deliverable://browser-release/xuanxue-branch-protection-readback.json`、`deliverable://browser-release/browser-build-input-lock.json`、`deliverable://browser-release/sbom.spdx.json`、`deliverable://browser-release/provenance.json`、`deliverable://browser-release/installed-artifact-readback.json`、`deliverable://browser-release/release-identity-signature.json`、`deliverable://browser-release/agent-branch-protection-prestate.json`、`deliverable://browser-release/agent-branch-protection-recovery-receipt.json`、`deliverable://browser-release/xuanxue-branch-protection-prestate.json`、`deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json`、`deliverable://browser-release/constructed-release-candidate.json`、`deliverable://construction-admission/agent-repository-governance-policy.json`、`deliverable://construction-admission/xuanxue-repository-governance-policy.json`
- 动作：`ACT-041`
- 输出：`deliverable://browser-release/independent-audit.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-041`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-038`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-042：最终 release approval

- 单一结果：只验证并消费 WO-044 的 candidate-bound ci-full-receipt 及全部 PASS receipts，签发 release approval；不运行 CI，不修改源码、ProofManifest、保护规则或 activation。
- owner：release approval owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-040`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：ACC-040 PASS on the same candidate and tuple；Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://browser-release/BrowserReleaseProofManifestV1.json`、`deliverable://browser-release/activation-receipt.json`、`deliverable://browser-release/post-activation-readback.json`、`deliverable://browser-release/independent-audit.json`、`deliverable://browser-release/ci-full-receipt.json`、`deliverable://browser-release/constructed-release-candidate.json`
- CREATE：`deliverable://browser-release/final-release-approval.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`deliverable://browser-release/BrowserReleaseProofManifestV1.json`、`deliverable://browser-release/activation-receipt.json`、`deliverable://browser-release/post-activation-readback.json`、`deliverable://browser-release/independent-audit.json`、`deliverable://browser-release/ci-full-receipt.json`、`deliverable://browser-release/constructed-release-candidate.json`
- 动作：`ACT-042`
- 输出：`deliverable://browser-release/final-release-approval.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-042`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：无
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`true`

### WO-046：建设 browserctl、launcher 与 macOS 注册面

- 单一结果：browserctl 是 install/verify/doctor/repair/enroll-profile/activate/rollback 唯一 owner；launcher、platform-macos 与 manifests 只服务该控制面。
- owner：browserctl owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-013`、`WO-014`、`WO-015`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/browser/protocol/browser-profile-enrollment.schema.json`、`src/lib/browser/protocol/browser-protocol.schema.json`
- CREATE：`src/lib/browser/native-messaging-host/crates/browserctl/Cargo.toml`、`src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs`、`src/lib/browser/native-messaging-host/crates/browserctl/src/install.rs`、`src/lib/browser/native-messaging-host/crates/browserctl/src/verify.rs`、`src/lib/browser/native-messaging-host/crates/browserctl/src/doctor.rs`、`src/lib/browser/native-messaging-host/crates/browserctl/src/repair.rs`、`src/lib/browser/native-messaging-host/crates/browserctl/src/enroll_profile.rs`、`src/lib/browser/native-messaging-host/crates/browserctl/src/activate.rs`、`src/lib/browser/native-messaging-host/crates/browserctl/src/rollback.rs`、`src/lib/browser/native-messaging-host/crates/launcher/Cargo.toml`、`src/lib/browser/native-messaging-host/crates/launcher/src/main.rs`、`src/lib/browser/native-messaging-host/crates/platform-macos/Cargo.toml`、`src/lib/browser/native-messaging-host/crates/platform-macos/src/registration.rs`、`src/lib/browser/native-messaging-host/manifests/com.grasseye.browser_host.json`、`src/lib/browser/native-messaging-host/crates/browserctl/tests/browserctl.acceptance.rs`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`src/lib/browser/protocol/browser-profile-enrollment.schema.json`、`src/lib/browser/protocol/browser-protocol.schema.json`
- 动作：`ACT-046`
- 输出：`src/lib/browser/native-messaging-host/crates/browserctl/Cargo.toml`、`src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs`、`src/lib/browser/native-messaging-host/crates/browserctl/src/install.rs`、`src/lib/browser/native-messaging-host/crates/browserctl/src/verify.rs`、`src/lib/browser/native-messaging-host/crates/browserctl/src/doctor.rs`、`src/lib/browser/native-messaging-host/crates/browserctl/src/repair.rs`、`src/lib/browser/native-messaging-host/crates/browserctl/src/enroll_profile.rs`、`src/lib/browser/native-messaging-host/crates/browserctl/src/activate.rs`、`src/lib/browser/native-messaging-host/crates/browserctl/src/rollback.rs`、`src/lib/browser/native-messaging-host/crates/launcher/Cargo.toml`、`src/lib/browser/native-messaging-host/crates/launcher/src/main.rs`、`src/lib/browser/native-messaging-host/crates/platform-macos/Cargo.toml`、`src/lib/browser/native-messaging-host/crates/platform-macos/src/registration.rs`、`src/lib/browser/native-messaging-host/manifests/com.grasseye.browser_host.json`、`src/lib/browser/native-messaging-host/crates/browserctl/tests/browserctl.acceptance.rs`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-046`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-021`、`WO-047`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-047：建设 BrowserInfrastructureSupervisor 与唯一 OwnerLock

- 单一结果：唯一 supervisor 在 bind 前取得 OwnerLock，并拥有 worker membership、handover、retry 与 repair 协调；不拥有业务流程。
- owner：Browser infrastructure supervisor owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-016`、`WO-021`、`WO-046`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`src/lib/browser/transport/transport-actor.ts`、`src/lib/browser/profile/browser-process-supervisor.ts`
- CREATE：`src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts`、`src/lib/browser/infrastructure/browser-owner-lock.ts`、`src/lib/browser/infrastructure/browser-worker-membership.ts`、`src/lib/browser/infrastructure/browser-worker-handover.ts`、`src/lib/browser/infrastructure/browser-retry-policy.ts`、`src/lib/browser/infrastructure/browser-repair.ts`、`src/lib/browser/infrastructure/browser-infrastructure-supervisor.acceptance.ts`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`src/lib/browser/transport/transport-actor.ts`、`src/lib/browser/profile/browser-process-supervisor.ts`
- 动作：`ACT-047`
- 输出：`src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts`、`src/lib/browser/infrastructure/browser-owner-lock.ts`、`src/lib/browser/infrastructure/browser-worker-membership.ts`、`src/lib/browser/infrastructure/browser-worker-handover.ts`、`src/lib/browser/infrastructure/browser-retry-policy.ts`、`src/lib/browser/infrastructure/browser-repair.ts`、`src/lib/browser/infrastructure/browser-infrastructure-supervisor.acceptance.ts`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-047`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-017`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-043：运行 operator-approved provider journeys 与一工作日业务基线

- 单一结果：在同一 candidate、ArtifactSet、ActivationTuple candidate、ReleaseSecurityPolicy 与 release identity signature 下完成获准 provider journeys 和 8 小时业务基线，证明零 focus theft、零 keyboard interruption、零 wrong-target、有限 pause/cancel/takeover 与零 mutation replay。
- owner：business workday evidence owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-027`、`WO-028`、`WO-029`、`WO-034`、`WO-049`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://browser-release/artifact-set.json`、`deliverable://browser-release/activation-tuple-candidate.json`、`deliverable://browser-release/real-chrome-matrix.json`、`deliverable://construction-admission/provider-journey-authorization.json`、`deliverable://browser-release/release-security-policy.json`、`deliverable://browser-release/release-identity-signature.json`、`deliverable://browser-release/constructed-release-candidate.json`
- CREATE：`scripts/acceptance/local-browser-business-workday-terminal.acceptance.ts`、`deliverable://browser-release/business-workday-receipt.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`deliverable://browser-release/artifact-set.json`、`deliverable://browser-release/activation-tuple-candidate.json`、`deliverable://browser-release/real-chrome-matrix.json`、`deliverable://construction-admission/provider-journey-authorization.json`、`deliverable://browser-release/release-security-policy.json`、`deliverable://browser-release/release-identity-signature.json`、`deliverable://browser-release/constructed-release-candidate.json`
- 动作：`ACT-043`
- 输出：`scripts/acceptance/local-browser-business-workday-terminal.acceptance.ts`、`deliverable://browser-release/business-workday-receipt.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-043`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-041`、`WO-044`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-044：在激活前运行唯一 ci:full

- 单一结果：只在同一 candidate/artifact/tuple/policy 的业务 receipt 完成后运行唯一 ci:full，并形成候选绑定 receipt；任何 failure 阻断 ProofManifest 与激活。
- owner：CI-FULL compliance self-check owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-032`、`WO-043`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`scripts/audit/ci-full.ts`、`deliverable://browser-release/business-workday-receipt.json`、`deliverable://browser-release/activation-tuple-candidate.json`、`deliverable://browser-release/release-security-policy.json`、`deliverable://browser-release/release-identity-signature.json`、`deliverable://browser-release/constructed-release-candidate.json`
- CREATE：`deliverable://browser-release/ci-full-receipt.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`scripts/audit/ci-full.ts`、`deliverable://browser-release/business-workday-receipt.json`、`deliverable://browser-release/activation-tuple-candidate.json`、`deliverable://browser-release/release-security-policy.json`、`deliverable://browser-release/release-identity-signature.json`、`deliverable://browser-release/constructed-release-candidate.json`
- 动作：`ACT-044`
- 输出：`deliverable://browser-release/ci-full-receipt.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-044`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard this work order output and restart from its last PASS dependency; never reactivate retired Browser code.
- handoff：`WO-041`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-048：锁定 xuanxue-web required checks 与 branch protection

- 单一结果：Consume only deliverable://construction-admission/xuanxue-repository-governance-policy.json; sign remote pre-state, PATCH exact main strict/contexts, GET signed post-state, and restore signed pre-state plus GET on failure.
- owner：xuanxue repository governance owner
- 权威依据：用户继续授权；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-004`、`WO-030`、`WO-032`、`WO-057`、`WO-060`；决策门：无；并行组：`RELEASE_GOVERNANCE`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://construction-admission/xuanxue-candidate.json`、`deliverable://work-orders/WO-030/cross-repo-receipt.json`、`deliverable://browser-release/constructed-release-candidate.json`、`deliverable://construction-admission/xuanxue-repository-governance-policy.json`
- CREATE：`deliverable://browser-release/xuanxue-branch-protection-prestate.json`、`deliverable://browser-release/xuanxue-branch-protection-readback.json`、`deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json`
- MODIFY：`system://github/ADVISION-X/xuanxue-web/branches/main/protection/required_status_checks`
- RETIRE/DELETE：无
- 输入：`deliverable://construction-admission/xuanxue-candidate.json`、`deliverable://work-orders/WO-030/cross-repo-receipt.json`、`deliverable://browser-release/constructed-release-candidate.json`、`deliverable://construction-admission/xuanxue-repository-governance-policy.json`
- 动作：`ACT-048A`、`ACT-048B`、`ACT-048C`
- 输出：`deliverable://browser-release/xuanxue-branch-protection-prestate.json`、`deliverable://browser-release/xuanxue-branch-protection-readback.json`、`deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-048A`、`ACC-048B`、`ACC-048C`
- 失败动作：Run ACT-048C: PATCH the signed pre-state, GET again, emit deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json with RESTORED or RECOVERY_FAILED, and stop release work.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Only the signed deliverable://browser-release/xuanxue-branch-protection-prestate.json may be restored; verify exact strict/contexts readback before any retry.
- handoff：`WO-041`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-049：冻结 provider journey 与一工作日采集授权

- 单一结果：由 operator 明确账户、journey 范围、敏感动作边界、人工门、8 小时窗口和中止权限；缺失只阻断业务证据及发布链。
- owner：provider journey authorization owner
- 权威依据：用户继续授权；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：无；决策门：`DG-005`；并行组：`DECISION`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://construction-admission/operator-provider-journey-request.json`
- CREATE：`deliverable://construction-admission/provider-journey-authorization.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`deliverable://construction-admission/operator-provider-journey-request.json`
- 动作：`ACT-049`
- 输出：`deliverable://construction-admission/provider-journey-authorization.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-049`
- 失败动作：Emit a candidate-bound FAIL receipt and stop only the work orders that depend on this result.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard an incomplete or rejected authorization; the operator corrects the request and signs a new authorization. No remote or runtime state is mutated by this work order.
- handoff：`WO-043`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-050：签发 ArtifactSet-bound ActivationTuple 与 ReleaseSecurityPolicy

- 单一结果：读取不可变 ArtifactSet、完整 input lock、SBOM、provenance、builder 与安装 readback，签发内部绑定同一 artifact/candidate/sequence 的 ActivationTuple candidate、ReleaseSecurityPolicy 与 release identity signature。
- owner：Browser release identity owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-033`；决策门：无；并行组：`SEQUENTIAL`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://construction-admission/external-operations.json`、`deliverable://browser-release/browser-build-input-lock.json`、`deliverable://browser-release/artifact-set.json`、`deliverable://browser-release/builder-a-receipt.json`、`deliverable://browser-release/builder-b-receipt.json`、`deliverable://browser-release/sbom.spdx.json`、`deliverable://browser-release/provenance.json`、`deliverable://browser-release/installed-artifact-readback.json`、`src/lib/browser/release/browser-activation-tuple.schema.json`、`src/lib/browser/release/browser-release-security-policy.schema.json`、`artifact://browser-release/controller/controller-bundle.tgz`、`artifact://browser-release/native-host/grasseye-browser-host`、`artifact://browser-release/browserctl/browserctl`、`artifact://browser-release/launcher/grasseye-browser-launcher`、`artifact://browser-release/platform-macos/libgrasseye-platform-macos.a`、`artifact://browser-release/extension/grasseye-browser-extension.verified.crx`、`artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json`、`artifact://browser-release/checksums/SHA256SUMS`、`artifact://browser-release/signatures/SHA256SUMS.sig`、`deliverable://browser-release/constructed-release-candidate.json`
- CREATE：`deliverable://browser-release/activation-tuple-candidate.json`、`deliverable://browser-release/release-security-policy.json`、`deliverable://browser-release/release-identity-signature.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`deliverable://construction-admission/external-operations.json`、`deliverable://browser-release/browser-build-input-lock.json`、`deliverable://browser-release/artifact-set.json`、`deliverable://browser-release/builder-a-receipt.json`、`deliverable://browser-release/builder-b-receipt.json`、`deliverable://browser-release/sbom.spdx.json`、`deliverable://browser-release/provenance.json`、`deliverable://browser-release/installed-artifact-readback.json`、`src/lib/browser/release/browser-activation-tuple.schema.json`、`src/lib/browser/release/browser-release-security-policy.schema.json`、`artifact://browser-release/controller/controller-bundle.tgz`、`artifact://browser-release/native-host/grasseye-browser-host`、`artifact://browser-release/browserctl/browserctl`、`artifact://browser-release/launcher/grasseye-browser-launcher`、`artifact://browser-release/platform-macos/libgrasseye-platform-macos.a`、`artifact://browser-release/extension/grasseye-browser-extension.verified.crx`、`artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json`、`artifact://browser-release/checksums/SHA256SUMS`、`artifact://browser-release/signatures/SHA256SUMS.sig`、`deliverable://browser-release/constructed-release-candidate.json`
- 动作：`ACT-050`
- 输出：`deliverable://browser-release/activation-tuple-candidate.json`、`deliverable://browser-release/release-security-policy.json`、`deliverable://browser-release/release-identity-signature.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-050`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard all three identity outputs together and rerun WO-050 from the same immutable WO-033 ArtifactSet; never edit an issued tuple or policy.
- handoff：`WO-034`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-051：激活失败时立即 revoke Browser authority

- 单一结果：仅由 Browser authority issuer owner 把 active authority slot 改为 ABSENT，并签发 revoke readback；不执行安装或 activation 回退。
- owner：Browser authority issuer owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-040`；决策门：无；并行组：`RECOVERY`
- 进入条件：ACC-040 terminal status is POST_ACTIVATION_MISMATCH on the same candidate and tuple
- READ：`deliverable://browser-release/post-activation-readback.json`、`deliverable://browser-release/activation-receipt.json`、`deliverable://browser-release/constructed-release-candidate.json`
- CREATE：`deliverable://browser-release/recovery-authority-revoke.json`
- MODIFY：`system://browser-authority/active-authority-slot#revoke`
- RETIRE/DELETE：无
- 输入：`deliverable://browser-release/post-activation-readback.json`、`deliverable://browser-release/activation-receipt.json`、`deliverable://browser-release/constructed-release-candidate.json`
- 动作：`ACT-051`
- 输出：`deliverable://browser-release/recovery-authority-revoke.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-051`
- 失败动作：Emit RECOVERY_FAILED_AUTHORITY_NOT_ABSENT and stop; do not proceed to browserctl rollback.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Retry only the idempotent revoke while the same failed authority certificate remains current; any different authority state stops the recovery chain.
- handoff：`WO-052`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-052：按 previous snapshot 回退或隔离已安装 artifact

- 单一结果：若 snapshot 为 SIGNED_PRESENT，browserctl 安装回退到 previous tuple；若为 SIGNED_ABSENT，browserctl 卸载/隔离失败新 artifact 并证明 profile/process/policy/tree 无可用 Browser authority。
- owner：browserctl owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-051`；决策门：无；并行组：`RECOVERY`
- 进入条件：ACC-051 PASS and authority is ABSENT
- READ：`deliverable://browser-release/recovery-authority-revoke.json`、`deliverable://browser-release/activation-receipt.json`、`deliverable://browser-release/previous-activation-snapshot.json`、`deliverable://browser-release/BrowserReleaseProofManifestV1.json`、`src/lib/browser/native-messaging-host/crates/browserctl/src/rollback.rs`、`artifact://browser-release/controller/controller-bundle.tgz`、`artifact://browser-release/native-host/grasseye-browser-host`、`artifact://browser-release/browserctl/browserctl`、`artifact://browser-release/launcher/grasseye-browser-launcher`、`artifact://browser-release/platform-macos/libgrasseye-platform-macos.a`、`artifact://browser-release/extension/grasseye-browser-extension.verified.crx`、`artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json`、`artifact://browser-release/checksums/SHA256SUMS`、`artifact://browser-release/signatures/SHA256SUMS.sig`、`deliverable://browser-release/constructed-release-candidate.json`
- CREATE：`deliverable://browser-release/recovery-browserctl-rollback.json`
- MODIFY：`system://browser-profile/installed-artifact-state#recover-signed-present-or-absent`
- RETIRE/DELETE：无
- 输入：`deliverable://browser-release/recovery-authority-revoke.json`、`deliverable://browser-release/activation-receipt.json`、`deliverable://browser-release/previous-activation-snapshot.json`、`deliverable://browser-release/BrowserReleaseProofManifestV1.json`、`src/lib/browser/native-messaging-host/crates/browserctl/src/rollback.rs`、`artifact://browser-release/controller/controller-bundle.tgz`、`artifact://browser-release/native-host/grasseye-browser-host`、`artifact://browser-release/browserctl/browserctl`、`artifact://browser-release/launcher/grasseye-browser-launcher`、`artifact://browser-release/platform-macos/libgrasseye-platform-macos.a`、`artifact://browser-release/extension/grasseye-browser-extension.verified.crx`、`artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json`、`artifact://browser-release/checksums/SHA256SUMS`、`artifact://browser-release/signatures/SHA256SUMS.sig`、`deliverable://browser-release/constructed-release-candidate.json`
- 动作：`ACT-052`
- 输出：`deliverable://browser-release/recovery-browserctl-rollback.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-052`
- 失败动作：Emit RECOVERY_FAILED_INSTALLATION and stop; authority remains ABSENT.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Repeat only when installed tuple still equals failed new tuple or already equals signed previous tuple; a third identity stops recovery.
- handoff：`WO-053`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-053：CAS active slot 回 previous tuple 或 ABSENT

- 单一结果：仅由 activation owner 把 active slot 从失败新 tuple CAS 到 SIGNED_PRESENT 的 previous tuple，或 CAS 到 SIGNED_ABSENT。
- owner：release activation owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-052`；决策门：无；并行组：`RECOVERY`
- 进入条件：ACC-052 PASS and signed previous tuple satisfies signature, revocation and minimum-sequence policy
- READ：`deliverable://browser-release/recovery-browserctl-rollback.json`、`deliverable://browser-release/activation-receipt.json`、`deliverable://browser-release/previous-activation-snapshot.json`、`deliverable://browser-release/release-security-policy.json`、`deliverable://browser-release/constructed-release-candidate.json`
- CREATE：`deliverable://browser-release/recovery-active-slot-cas.json`
- MODIFY：`system://browser-release/active-activation-slot#rollback-present-or-absent`
- RETIRE/DELETE：无
- 输入：`deliverable://browser-release/recovery-browserctl-rollback.json`、`deliverable://browser-release/activation-receipt.json`、`deliverable://browser-release/previous-activation-snapshot.json`、`deliverable://browser-release/release-security-policy.json`、`deliverable://browser-release/constructed-release-candidate.json`
- 动作：`ACT-053`
- 输出：`deliverable://browser-release/recovery-active-slot-cas.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-053`
- 失败动作：Emit RECOVERY_FAILED_ACTIVE_SLOT and stop; authority remains ABSENT and consumers remain blocked.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Repeat only when slot equals failed new tuple or already equals signed previous tuple; any third value stops recovery.
- handoff：`WO-054`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-054：把全部 Browser consumer admission 回写为 BLOCKED

- 单一结果：仅由 Local Runtime Browser admission owner 在 previous tuple CAS readback 后关闭 CON-001..CON-011 的 Browser admission，并证明没有业务副作用。
- owner：local-runtime owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-053`；决策门：无；并行组：`RECOVERY`
- 进入条件：ACC-053 PASS and authority remains ABSENT
- READ：`deliverable://browser-release/recovery-active-slot-cas.json`、`deliverable://browser-release/recovery-authority-revoke.json`、`deliverable://browser-release/constructed-release-candidate.json`
- CREATE：`deliverable://browser-release/recovery-consumer-blocked.json`
- MODIFY：`system://workbench/browser-consumer-admission#construction-blocked`
- RETIRE/DELETE：无
- 输入：`deliverable://browser-release/recovery-active-slot-cas.json`、`deliverable://browser-release/recovery-authority-revoke.json`、`deliverable://browser-release/constructed-release-candidate.json`
- 动作：`ACT-054`
- 输出：`deliverable://browser-release/recovery-consumer-blocked.json`
- 消费者交接：CON-001..CON-011 are explicitly read back as BLOCKED; capability and plugin business state owners are not mutated.
- 验收：`ACC-054`
- 失败动作：Emit RECOVERY_FAILED_CONSUMER_ADMISSION and stop; no Browser consumer may run.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Repeat only to converge the same eleven named consumer admissions to BLOCKED; adding an unnamed consumer stops recovery.
- handoff：`WO-055`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-055：独立读回完整 rollback 终态

- 单一结果：独立验证 authority ABSENT、SIGNED_PRESENT 时 previous tuple 已安装且 active，或 SIGNED_ABSENT 时无可用 Browser artifact 且 slot 为 ABSENT；两分支均要求 CON-001..CON-011 BLOCKED。
- owner：production recovery readback owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-054`；决策门：无；并行组：`RECOVERY`
- 进入条件：ACC-054 PASS on the same failed activation and signed previous tuple
- READ：`deliverable://browser-release/recovery-authority-revoke.json`、`deliverable://browser-release/recovery-browserctl-rollback.json`、`deliverable://browser-release/recovery-active-slot-cas.json`、`deliverable://browser-release/recovery-consumer-blocked.json`、`deliverable://browser-release/previous-activation-snapshot.json`、`deliverable://browser-release/constructed-release-candidate.json`
- CREATE：`deliverable://browser-release/post-rollback-readback.json`、`deliverable://browser-release/new-attempt-admission.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`deliverable://browser-release/recovery-authority-revoke.json`、`deliverable://browser-release/recovery-browserctl-rollback.json`、`deliverable://browser-release/recovery-active-slot-cas.json`、`deliverable://browser-release/recovery-consumer-blocked.json`、`deliverable://browser-release/previous-activation-snapshot.json`、`deliverable://browser-release/constructed-release-candidate.json`
- 动作：`ACT-055`
- 输出：`deliverable://browser-release/post-rollback-readback.json`、`deliverable://browser-release/new-attempt-admission.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-055`
- 失败动作：Emit RECOVERY_TERMINAL_BLOCKED; retain authority ABSENT and all consumers BLOCKED.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：A future separately authorized attempt may consume new-attempt-admission.json and restart from the earliest invalidated producer; it may not reuse the failed ProofManifest or automatically reactivate.
- handoff：无
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`true`

### WO-056：由 AGENT repository governance owner 签发精确治理策略

- 单一结果：签发 ADVISION-X/AGENT main 的 repo、branch、strict、exact contexts、construction branch commit/push 权限、expected remote ref、保护规则变更权限与恢复权限。
- owner：AGENT repository governance owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：无；决策门：`DG-006`；并行组：`DECISION`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://construction-admission/agent-repository-governance-request.json`
- CREATE：`deliverable://construction-admission/agent-repository-governance-policy.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`deliverable://construction-admission/agent-repository-governance-request.json`
- 动作：`ACT-056`
- 输出：`deliverable://construction-admission/agent-repository-governance-policy.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-056`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard unsigned or incomplete policy; the AGENT repository governance owner corrects and re-signs the request.
- handoff：`WO-035`、`WO-058`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-057：由 xuanxue repository governance owner 签发精确治理策略

- 单一结果：签发 ADVISION-X/xuanxue-web main 的 repo、branch、strict、exact contexts、construction branch commit/push 权限、expected remote ref、保护规则变更权限与恢复权限。
- owner：xuanxue repository governance owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：无；决策门：`DG-007`；并行组：`DECISION`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://construction-admission/xuanxue-repository-governance-request.json`
- CREATE：`deliverable://construction-admission/xuanxue-repository-governance-policy.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`deliverable://construction-admission/xuanxue-repository-governance-request.json`
- 动作：`ACT-057`
- 输出：`deliverable://construction-admission/xuanxue-repository-governance-policy.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-057`
- 失败动作：Emit a candidate-bound FAIL receipt and stop dependent work orders.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Discard unsigned or incomplete policy; the xuanxue repository governance owner corrects and re-signs the request.
- handoff：`WO-048`、`WO-059`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-058：冻结施工后 AGENT release candidate

- 单一结果：在所有 AGENT 源码、audit 与 acceptance 建设完成后，生成 content-addressed tree/build-input manifest 与 source bundle；在获准 construction branch 上 commit/push，并以 git ls-remote 读回相同 SHA。
- owner：AGENT repository governance owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-032`、`WO-056`；决策门：无；并行组：`CANDIDATE_FREEZE`
- 进入条件：ACC-032 PASS；ACC-056 PASS authorizes exact construction branch commit/push and expected remote ref
- READ：`deliverable://construction-admission/agent-repository-governance-policy.json`、`system://git/ADVISION-X/AGENT/worktree-and-index`、`package.json`、`package-lock.json`、`tsconfig.json`
- CREATE：`deliverable://browser-release/agent-constructed-tree-manifest.json`、`deliverable://browser-release/agent-build-input-manifest.json`、`deliverable://browser-release/agent-constructed-source-bundle.tar.zst`、`deliverable://browser-release/agent-constructed-candidate.json`、`deliverable://browser-release/agent-remote-candidate-readback.json`
- MODIFY：`system://git/ADVISION-X/AGENT/refs/heads/codex/browser-greenfield`
- RETIRE/DELETE：无
- 输入：`deliverable://construction-admission/agent-repository-governance-policy.json`、`system://git/ADVISION-X/AGENT/worktree-and-index`、`package.json`、`package-lock.json`、`tsconfig.json`
- 动作：`ACT-058`
- 输出：`deliverable://browser-release/agent-constructed-tree-manifest.json`、`deliverable://browser-release/agent-build-input-manifest.json`、`deliverable://browser-release/agent-constructed-source-bundle.tar.zst`、`deliverable://browser-release/agent-constructed-candidate.json`、`deliverable://browser-release/agent-remote-candidate-readback.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-058`
- 失败动作：Do not build or change main protection; restore neither old Browser code nor an unverified remote ref.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Correct the construction tree, rerun all invalidated checks, then create a new content manifest and push with the policy's expected-old-ref lease.
- handoff：`WO-060`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-059：冻结施工后 xuanxue release candidate

- 单一结果：在 xuanxue 三条授权路径和跨仓验收完成后，生成 content-addressed tree/source bundle；在获准 construction branch 上 commit/push，并以 git ls-remote 读回相同 SHA。
- owner：xuanxue repository governance owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-032`、`WO-057`；决策门：无；并行组：`CANDIDATE_FREEZE`
- 进入条件：ACC-032 PASS includes cross-repo contract checks；ACC-057 PASS authorizes exact construction branch commit/push and expected remote ref
- READ：`deliverable://construction-admission/xuanxue-repository-governance-policy.json`、`system://git/ADVISION-X/xuanxue-web/worktree-and-index`、`deliverable://work-orders/WO-030/cross-repo-receipt.json`
- CREATE：`deliverable://browser-release/xuanxue-constructed-tree-manifest.json`、`deliverable://browser-release/xuanxue-constructed-source-bundle.tar.zst`、`deliverable://browser-release/xuanxue-constructed-candidate.json`、`deliverable://browser-release/xuanxue-remote-candidate-readback.json`
- MODIFY：`system://git/ADVISION-X/xuanxue-web/refs/heads/codex/browser-greenfield`
- RETIRE/DELETE：无
- 输入：`deliverable://construction-admission/xuanxue-repository-governance-policy.json`、`system://git/ADVISION-X/xuanxue-web/worktree-and-index`、`deliverable://work-orders/WO-030/cross-repo-receipt.json`
- 动作：`ACT-059`
- 输出：`deliverable://browser-release/xuanxue-constructed-tree-manifest.json`、`deliverable://browser-release/xuanxue-constructed-source-bundle.tar.zst`、`deliverable://browser-release/xuanxue-constructed-candidate.json`、`deliverable://browser-release/xuanxue-remote-candidate-readback.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-059`
- 失败动作：Do not build, mutate main protection or produce Dynamic Proof from an unverified candidate.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Correct only the three authorized paths, rerun invalidated checks, then create a new content manifest and push with the policy's expected-old-ref lease.
- handoff：`WO-060`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

### WO-060：签发双仓 constructed release candidate

- 单一结果：把施工后 AGENT 与 xuanxue 的 clean tree、commit SHA、remote SHA、content manifests 与 cross-repo contract hash 组合成唯一 constructed-release-candidate identity。
- owner：cross-repo release candidate owner
- 权威依据：用户绿地重建要求；AGENTS.md；APEX-LOCAL-BROWSER active law；终态施工图
- 依赖：`WO-058`、`WO-059`；决策门：无；并行组：`CANDIDATE_FREEZE`
- 进入条件：Named dependencies and decision gates are PASS on the same candidate
- READ：`deliverable://browser-release/agent-constructed-tree-manifest.json`、`deliverable://browser-release/agent-constructed-candidate.json`、`deliverable://browser-release/agent-remote-candidate-readback.json`、`deliverable://browser-release/xuanxue-constructed-tree-manifest.json`、`deliverable://browser-release/xuanxue-constructed-candidate.json`、`deliverable://browser-release/xuanxue-remote-candidate-readback.json`、`deliverable://work-orders/WO-030/cross-repo-receipt.json`
- CREATE：`deliverable://browser-release/constructed-release-candidate.json`
- MODIFY：无
- RETIRE/DELETE：无
- 输入：`deliverable://browser-release/agent-constructed-tree-manifest.json`、`deliverable://browser-release/agent-constructed-candidate.json`、`deliverable://browser-release/agent-remote-candidate-readback.json`、`deliverable://browser-release/xuanxue-constructed-tree-manifest.json`、`deliverable://browser-release/xuanxue-constructed-candidate.json`、`deliverable://browser-release/xuanxue-remote-candidate-readback.json`、`deliverable://work-orders/WO-030/cross-repo-receipt.json`
- 动作：`ACT-060`
- 输出：`deliverable://browser-release/constructed-release-candidate.json`
- 消费者交接：No unnamed consumer handoff is permitted.
- 验收：`ACC-060`
- 失败动作：Invalidate both constructed candidates; no ArtifactSet, CI, branch mutation, Chrome, HA, provider, proof or activation may proceed.
- 停止条件：Candidate, owner, interface or authority drift stops this work order.
- 恢复：Rerun the changed repository's freeze work order and sign a new composite identity; never edit an issued composite candidate.
- handoff：`WO-033`、`WO-035`、`WO-048`
- 禁区：active law changes；generated artifact manual edits；bridge/fallback/shadow Browser runtime；second Browser transport/controller/election/receipt/audit runner；unrelated business behavior changes
- 终态工作单：`false`

## 13. 文件操作、消费者迁移与退休账

CREATE 必须先于下游 READ。远端/运行态 mutation 必须有 legal owner、expected old state、幂等写入、写后 GET 和失败恢复。ArtifactSet JSON 只是实体索引，不得代替九个精确 entity refs。

| 操作 ID | 工作单 | owner | 类型 | 操作 | 精确目标 | consumers |
| --- | --- | --- | --- | --- | --- | --- |
| OP-002-001 | WO-002 | project authorization owner | file | READ | AGENTS.md |  |
| OP-002-002 | WO-002 | project authorization owner | file | READ | .github/instructions/agent-rules/modules/module-local-browser-session.instructions.md |  |
| OP-002-003 | WO-002 | project authorization owner | file | READ | docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md |  |
| OP-002-004 | WO-002 | project authorization owner | deliverable | READ | deliverable://construction-admission/user-browser-scope-authorization.json |  |
| OP-002-005 | WO-002 | project authorization owner | deliverable | CREATE | deliverable://construction-admission/agent-candidate.json |  |
| OP-003-001 | WO-003 | release operations owner | file | READ | docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md |  |
| OP-003-002 | WO-003 | release operations owner | deliverable | CREATE | deliverable://construction-admission/external-operations.json |  |
| OP-004-001 | WO-004 | xuanxue repository authority owner | file | READ | /Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/browser-authority-proof-contract.ts |  |
| OP-004-002 | WO-004 | xuanxue repository authority owner | file | READ | /Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/collector-contracts.ts |  |
| OP-004-003 | WO-004 | xuanxue repository authority owner | file | READ | /Users/nexgen/Documents/xuanxue-web/scripts/audit/domains/dynamic-proof/dynamic-agent-receipt-inspection.ts |  |
| OP-004-004 | WO-004 | xuanxue repository authority owner | deliverable | CREATE | deliverable://construction-admission/xuanxue-candidate.json |  |
| OP-005-001 | WO-005 | Browser retirement inventory owner | file | READ | git-tree://60cfcf512ecdae0ed27d001d40b6293ae53e5cc6/src/lib/browser |  |
| OP-005-002 | WO-005 | Browser retirement inventory owner | file | READ | src/lib/local-runtime/workbench-browser-support.ts |  |
| OP-005-003 | WO-005 | Browser retirement inventory owner | file | READ | src/lib/local-runtime/workbench-video-download-support.ts |  |
| OP-005-004 | WO-005 | Browser retirement inventory owner | file | READ | src/lib/local-runtime/workbench-ai-gateway-support.ts |  |
| OP-005-005 | WO-005 | Browser retirement inventory owner | file | READ | src/lib/local-runtime/workbench-assembly.ts |  |
| OP-005-006 | WO-005 | Browser retirement inventory owner | file | CREATE | scripts/acceptance/local-browser-plan-harness.self-test.ts |  |
| OP-005-007 | WO-005 | Browser retirement inventory owner | file | CREATE | scripts/acceptance/local-browser-plan-gates.acceptance.ts |  |
| OP-005-008 | WO-005 | Browser retirement inventory owner | file | CREATE | scripts/acceptance/local-browser-retirement-inventory.acceptance.ts |  |
| OP-005-009 | WO-005 | Browser retirement inventory owner | file | CREATE | scripts/acceptance/local-browser-consumer-registry.acceptance.ts |  |
| OP-005-010 | WO-005 | Browser retirement inventory owner | file | CREATE | scripts/acceptance/local-browser-work-order-receipt.acceptance.ts |  |
| OP-005-011 | WO-005 | Browser retirement inventory owner | deliverable | CREATE | deliverable://browser-retirement/file-classification.json |  |
| OP-005-012 | WO-005 | Browser retirement inventory owner | deliverable | CREATE | deliverable://browser-retirement/consumer-registry.json |  |
| OP-006-001 | WO-006 | project authorization owner | file | READ | .github/instructions/agent-rules/modules/module-local-browser-session.instructions.md |  |
| OP-006-002 | WO-006 | project authorization owner | file | READ | docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md |  |
| OP-006-003 | WO-006 | project authorization owner | deliverable | CREATE | deliverable://construction-admission/browser-canonical-path.json |  |
| OP-007-001 | WO-007 | real Chrome evidence owner | file | READ | scripts/acceptance/xuanxue-ai-production.real-chrome.ts |  |
| OP-007-002 | WO-007 | real Chrome evidence owner | deliverable | CREATE | deliverable://browser-observation/preconstruction-chrome.json |  |
| OP-008-001 | WO-008 | Browser retirement inventory owner | deliverable | READ | deliverable://browser-retirement/file-classification.json |  |
| OP-008-002 | WO-008 | Browser retirement inventory owner | deliverable | READ | deliverable://browser-retirement/consumer-registry.json |  |
| OP-008-003 | WO-008 | Browser retirement inventory owner | deliverable | READ | deliverable://construction-admission/browser-canonical-path.json |  |
| OP-008-004 | WO-008 | Browser retirement inventory owner | deliverable | READ | deliverable://browser-observation/preconstruction-chrome.json |  |
| OP-008-005 | WO-008 | Browser retirement inventory owner | deliverable | CREATE | deliverable://construction-admission/browser-demolition.json |  |
| OP-008-006 | WO-008 | Browser retirement inventory owner | deliverable | CREATE | deliverable://browser-retirement/cutover-ledger.json |  |
| OP-009-001 | WO-009 | Browser owner | deliverable | READ | deliverable://construction-admission/browser-demolition.json |  |
| OP-009-002 | WO-009 | Browser owner | deliverable | READ | deliverable://browser-retirement/cutover-ledger.json |  |
| OP-009-003 | WO-009 | Browser owner | deliverable | CREATE | deliverable://work-orders/WO-009/receipt.json |  |
| OP-009-004 | WO-009 | Browser owner | deliverable | DELETE | deliverable://browser-retirement/file-classification.json#delete_targets | CON-001；CON-002；CON-003；CON-004；CON-005；CON-006；CON-007；CON-008；CON-009；CON-010；CON-011 |
| OP-010-001 | WO-010 | local-runtime owner | deliverable | READ | deliverable://browser-retirement/cutover-ledger.json |  |
| OP-010-002 | WO-010 | local-runtime owner | deliverable | CREATE | deliverable://work-orders/WO-010/receipt.json |  |
| OP-010-003 | WO-010 | local-runtime owner | file | DELETE | src/lib/local-runtime/workbench-browser-support.ts | CON-001 |
| OP-010-004 | WO-010 | local-runtime owner | file | DELETE | src/lib/local-runtime/workbench-video-download-support.ts | CON-002 |
| OP-011-001 | WO-011 | acceptance owner | deliverable | READ | deliverable://browser-retirement/cutover-ledger.json |  |
| OP-011-002 | WO-011 | acceptance owner | deliverable | CREATE | deliverable://work-orders/WO-011/receipt.json |  |
| OP-011-003 | WO-011 | acceptance owner | file | DELETE | scripts/acceptance/local-browser-artifact-contract.acceptance.ts | CON-011 |
| OP-011-004 | WO-011 | acceptance owner | file | DELETE | scripts/acceptance/local-browser-atomic-cutover.acceptance.ts | CON-011 |
| OP-011-005 | WO-011 | acceptance owner | file | DELETE | scripts/acceptance/local-browser-business-workday.acceptance.ts | CON-011 |
| OP-011-006 | WO-011 | acceptance owner | file | DELETE | scripts/acceptance/local-browser-exact-target-contract.acceptance.ts | CON-011 |
| OP-011-007 | WO-011 | acceptance owner | file | DELETE | scripts/acceptance/local-browser-native-transport.acceptance.ts | CON-011 |
| OP-011-008 | WO-011 | acceptance owner | file | DELETE | scripts/acceptance/local-browser-real-chrome-scenarios.acceptance.ts | CON-011 |
| OP-011-009 | WO-011 | acceptance owner | file | DELETE | scripts/acceptance/local-browser-real-chrome.acceptance.ts | CON-011 |
| OP-011-010 | WO-011 | acceptance owner | file | DELETE | scripts/acceptance/local-browser-target-actions.acceptance.ts | CON-011 |
| OP-012-001 | WO-012 | Browser protocol owner | deliverable | READ | deliverable://work-orders/WO-009/receipt.json |  |
| OP-012-002 | WO-012 | Browser protocol owner | deliverable | READ | deliverable://work-orders/WO-010/receipt.json |  |
| OP-012-003 | WO-012 | Browser protocol owner | deliverable | READ | deliverable://work-orders/WO-011/receipt.json |  |
| OP-012-004 | WO-012 | Browser protocol owner | file | CREATE | src/lib/browser/protocol/browser-protocol.schema.json |  |
| OP-012-005 | WO-012 | Browser protocol owner | file | CREATE | src/lib/browser/protocol/browser-authority-certificate.schema.json |  |
| OP-012-006 | WO-012 | Browser protocol owner | file | CREATE | src/lib/browser/protocol/browser-authority-liveness-lease.schema.json |  |
| OP-012-007 | WO-012 | Browser protocol owner | file | CREATE | src/lib/browser/protocol/browser-profile-enrollment.schema.json |  |
| OP-012-008 | WO-012 | Browser protocol owner | file | CREATE | src/lib/browser/protocol/browser-file-artifact-grant.schema.json |  |
| OP-012-009 | WO-012 | Browser protocol owner | file | CREATE | src/lib/browser/protocol/browser-capabilities.json |  |
| OP-012-010 | WO-012 | Browser protocol owner | file | CREATE | src/lib/browser/protocol/browser-errors.json |  |
| OP-012-011 | WO-012 | Browser protocol owner | file | CREATE | src/lib/browser/protocol/browser-protocol-schema.acceptance.ts |  |
| OP-013-001 | WO-013 | Browser protocol codegen owner | file | READ | src/lib/browser/protocol/browser-protocol.schema.json |  |
| OP-013-002 | WO-013 | Browser protocol codegen owner | file | READ | src/lib/browser/protocol/browser-protocol-schema.acceptance.ts |  |
| OP-013-003 | WO-013 | Browser protocol codegen owner | file | CREATE | src/lib/browser/protocol/generated/browser-protocol.generated.ts |  |
| OP-013-004 | WO-013 | Browser protocol codegen owner | file | CREATE | src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs |  |
| OP-013-005 | WO-013 | Browser protocol codegen owner | file | CREATE | src/lib/browser/protocol/browser-protocol-codegen.acceptance.ts |  |
| OP-014-001 | WO-014 | Native Host owner | file | READ | src/lib/browser/protocol/generated/browser-protocol.generated.ts |  |
| OP-014-002 | WO-014 | Native Host owner | file | READ | src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs |  |
| OP-014-003 | WO-014 | Native Host owner | file | CREATE | src/lib/browser/native-messaging-host/Cargo.toml |  |
| OP-014-004 | WO-014 | Native Host owner | file | CREATE | src/lib/browser/native-messaging-host/crates/host/Cargo.toml |  |
| OP-014-005 | WO-014 | Native Host owner | file | CREATE | src/lib/browser/native-messaging-host/crates/host/src/main.rs |  |
| OP-014-006 | WO-014 | Native Host owner | file | CREATE | src/lib/browser/native-messaging-host/crates/host/src/browser-native-framing.rs |  |
| OP-014-007 | WO-014 | Native Host owner | file | CREATE | src/lib/browser/native-messaging-host/crates/host/src/raw-channel.rs |  |
| OP-014-008 | WO-014 | Native Host owner | file | CREATE | src/lib/browser/native-messaging-host/crates/host/src/authenticated-channel.rs |  |
| OP-014-009 | WO-014 | Native Host owner | file | CREATE | src/lib/browser/native-messaging-host/crates/host/src/transcript.rs |  |
| OP-014-010 | WO-014 | Native Host owner | file | CREATE | src/lib/browser/native-messaging-host/crates/host/src/artifact-stream.rs |  |
| OP-014-011 | WO-014 | Native Host owner | file | CREATE | src/lib/browser/native-messaging-host/crates/host/tests/native-host.acceptance.rs |  |
| OP-014-012 | WO-014 | Native Host owner | file | CREATE | src/lib/browser/native-messaging-host/Cargo.lock |  |
| OP-014-013 | WO-014 | Native Host owner | file | CREATE | src/lib/browser/native-messaging-host/crates/host/fuzz/Cargo.toml |  |
| OP-014-014 | WO-014 | Native Host owner | file | CREATE | src/lib/browser/native-messaging-host/crates/host/fuzz/fuzz_targets/native_framing.rs |  |
| OP-014-015 | WO-014 | Native Host owner | file | CREATE | src/lib/browser/native-messaging-host/crates/host/fuzz/corpus/native_framing/seed.bin |  |
| OP-015-001 | WO-015 | MV3 Extension owner | file | READ | src/lib/browser/protocol/generated/browser-protocol.generated.ts |  |
| OP-015-002 | WO-015 | MV3 Extension owner | file | READ | src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs |  |
| OP-015-003 | WO-015 | MV3 Extension owner | file | CREATE | src/lib/browser/chrome-extension/manifest.json |  |
| OP-015-004 | WO-015 | MV3 Extension owner | file | CREATE | src/lib/browser/chrome-extension/service-worker.ts |  |
| OP-015-005 | WO-015 | MV3 Extension owner | file | CREATE | src/lib/browser/chrome-extension/native-port-actor.ts |  |
| OP-015-006 | WO-015 | MV3 Extension owner | file | CREATE | src/lib/browser/chrome-extension/command-registry.ts |  |
| OP-015-007 | WO-015 | MV3 Extension owner | file | CREATE | src/lib/browser/chrome-extension/command-permit-validator.ts |  |
| OP-015-008 | WO-015 | MV3 Extension owner | file | CREATE | src/lib/browser/chrome-extension/debugger-runtime.ts |  |
| OP-015-009 | WO-015 | MV3 Extension owner | file | CREATE | src/lib/browser/chrome-extension/exact-target-runtime.ts |  |
| OP-015-010 | WO-015 | MV3 Extension owner | file | CREATE | src/lib/browser/chrome-extension/dom-intent-runtime.ts |  |
| OP-015-011 | WO-015 | MV3 Extension owner | file | CREATE | src/lib/browser/chrome-extension/artifact-stream.ts |  |
| OP-015-012 | WO-015 | MV3 Extension owner | file | CREATE | src/lib/browser/chrome-extension/authenticated-heartbeat.ts |  |
| OP-015-013 | WO-015 | MV3 Extension owner | file | CREATE | src/lib/browser/chrome-extension/extension.acceptance.ts |  |
| OP-016-001 | WO-016 | Browser transport owner | file | READ | src/lib/browser/native-messaging-host/Cargo.toml |  |
| OP-016-002 | WO-016 | Browser transport owner | file | READ | src/lib/browser/native-messaging-host/crates/host/src/main.rs |  |
| OP-016-003 | WO-016 | Browser transport owner | file | READ | src/lib/browser/chrome-extension/manifest.json |  |
| OP-016-004 | WO-016 | Browser transport owner | file | READ | src/lib/browser/chrome-extension/service-worker.ts |  |
| OP-016-005 | WO-016 | Browser transport owner | file | CREATE | src/lib/browser/transport/raw-controller-host-channel.ts |  |
| OP-016-006 | WO-016 | Browser transport owner | file | CREATE | src/lib/browser/transport/authenticated-controller-host-channel.ts |  |
| OP-016-007 | WO-016 | Browser transport owner | file | CREATE | src/lib/browser/transport/transport-event.ts |  |
| OP-016-008 | WO-016 | Browser transport owner | file | CREATE | src/lib/browser/transport/transport-reducer.ts |  |
| OP-016-009 | WO-016 | Browser transport owner | file | CREATE | src/lib/browser/transport/transport-actor.ts |  |
| OP-016-010 | WO-016 | Browser transport owner | file | CREATE | src/lib/browser/transport/transport-authenticator.ts |  |
| OP-016-011 | WO-016 | Browser transport owner | file | CREATE | src/lib/browser/transport/transport-transcript.ts |  |
| OP-016-012 | WO-016 | Browser transport owner | file | CREATE | src/lib/browser/transport/authenticated-heartbeat.ts |  |
| OP-016-013 | WO-016 | Browser transport owner | file | CREATE | src/lib/browser/transport/browser-native-framing.ts |  |
| OP-016-014 | WO-016 | Browser transport owner | file | CREATE | src/lib/browser/transport/browser-transport.acceptance.ts |  |
| OP-017-001 | WO-017 | Browser authority issuer owner | file | READ | src/lib/browser/transport/transport-event.ts |  |
| OP-017-002 | WO-017 | Browser authority issuer owner | file | READ | src/lib/browser/transport/transport-reducer.ts |  |
| OP-017-003 | WO-017 | Browser authority issuer owner | file | CREATE | src/lib/browser/infrastructure/browser-authority-lease.ts |  |
| OP-017-004 | WO-017 | Browser authority issuer owner | file | CREATE | src/lib/browser/infrastructure/browser-authority-issuer.ts |  |
| OP-017-005 | WO-017 | Browser authority issuer owner | file | CREATE | src/lib/browser/infrastructure/browser-authority-certificate.ts |  |
| OP-017-006 | WO-017 | Browser authority issuer owner | file | CREATE | src/lib/browser/infrastructure/browser-authority-liveness-lease.ts |  |
| OP-017-007 | WO-017 | Browser authority issuer owner | file | CREATE | src/lib/browser/infrastructure/browser-control-state.ts |  |
| OP-017-008 | WO-017 | Browser authority issuer owner | file | CREATE | src/lib/browser/infrastructure/browser-authority-issuer.acceptance.ts |  |
| OP-018-001 | WO-018 | Browser broker owner | file | READ | src/lib/browser/infrastructure/browser-authority-certificate.ts |  |
| OP-018-002 | WO-018 | Browser broker owner | file | READ | src/lib/browser/infrastructure/browser-authority-issuer.ts |  |
| OP-018-003 | WO-018 | Browser broker owner | file | CREATE | src/lib/browser/infrastructure/browser-authority-broker.ts |  |
| OP-018-004 | WO-018 | Browser broker owner | file | CREATE | src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts |  |
| OP-018-005 | WO-018 | Browser broker owner | file | CREATE | src/lib/browser/browser-authority-api.ts |  |
| OP-019-001 | WO-019 | Browser target lease owner | file | READ | src/lib/browser/infrastructure/browser-authority-broker.ts |  |
| OP-019-002 | WO-019 | Browser target lease owner | file | READ | src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts |  |
| OP-019-003 | WO-019 | Browser target lease owner | file | CREATE | src/lib/browser/exact-target/browser-target-ref.ts |  |
| OP-019-004 | WO-019 | Browser target lease owner | file | CREATE | src/lib/browser/exact-target/browser-document-ref.ts |  |
| OP-019-005 | WO-019 | Browser target lease owner | file | CREATE | src/lib/browser/exact-target/browser-target-lease.ts |  |
| OP-019-006 | WO-019 | Browser target lease owner | file | CREATE | src/lib/browser/exact-target/browser-target-lease-manager.ts |  |
| OP-019-007 | WO-019 | Browser target lease owner | file | CREATE | src/lib/browser/exact-target/browser-target-lease.acceptance.ts |  |
| OP-020-001 | WO-020 | Browser command owner | file | READ | src/lib/browser/exact-target/browser-target-lease.ts |  |
| OP-020-002 | WO-020 | Browser command owner | file | READ | src/lib/browser/exact-target/browser-target-lease-manager.ts |  |
| OP-020-003 | WO-020 | Browser command owner | file | CREATE | src/lib/browser/transport/command-permit.ts |  |
| OP-020-004 | WO-020 | Browser command owner | file | CREATE | src/lib/browser/transport/reply-channel-token.ts |  |
| OP-020-005 | WO-020 | Browser command owner | file | CREATE | src/lib/browser/transport/browser-command-admission-budget.ts |  |
| OP-020-006 | WO-020 | Browser command owner | file | CREATE | src/lib/browser/exact-target/browser-command-actor.ts |  |
| OP-020-007 | WO-020 | Browser command owner | file | CREATE | src/lib/browser/exact-target/browser-mutation-intent-journal.ts |  |
| OP-020-008 | WO-020 | Browser command owner | file | CREATE | src/lib/browser/exact-target/browser-dom-intent.ts |  |
| OP-020-009 | WO-020 | Browser command owner | file | CREATE | src/lib/browser/exact-target/browser-file-artifact-grant.ts |  |
| OP-020-010 | WO-020 | Browser command owner | file | CREATE | src/lib/browser/exact-target/browser-artifact-stream.ts |  |
| OP-020-011 | WO-020 | Browser command owner | file | CREATE | src/lib/browser/exact-target/browser-command.acceptance.ts |  |
| OP-021-001 | WO-021 | Browser profile owner | file | READ | src/lib/browser/protocol/browser-profile-enrollment.schema.json |  |
| OP-021-002 | WO-021 | Browser profile owner | file | READ | src/lib/browser/native-messaging-host/crates/browserctl/src/enroll_profile.rs |  |
| OP-021-003 | WO-021 | Browser profile owner | deliverable | READ | deliverable://construction-admission/browser-canonical-path.json |  |
| OP-021-004 | WO-021 | Browser profile owner | file | CREATE | src/lib/browser/profile/browser-profile-enrollment.ts |  |
| OP-021-005 | WO-021 | Browser profile owner | file | CREATE | src/lib/browser/profile/dedicated-profile-policy.ts |  |
| OP-021-006 | WO-021 | Browser profile owner | file | CREATE | src/lib/browser/profile/browser-profile-state.ts |  |
| OP-021-007 | WO-021 | Browser profile owner | file | CREATE | src/lib/browser/profile/browser-profile-config.ts |  |
| OP-021-008 | WO-021 | Browser profile owner | file | CREATE | src/lib/browser/profile/browser-profile-enrollment-receipt.ts |  |
| OP-021-009 | WO-021 | Browser profile owner | file | CREATE | src/lib/browser/profile/browser-profile-process-attestation.ts |  |
| OP-021-010 | WO-021 | Browser profile owner | file | CREATE | src/lib/browser/profile/managed-policy-readback.ts |  |
| OP-021-011 | WO-021 | Browser profile owner | file | CREATE | src/lib/browser/profile/browser-process-supervisor.ts |  |
| OP-021-012 | WO-021 | Browser profile owner | file | CREATE | src/lib/browser/profile/browser-profile.acceptance.ts |  |
| OP-022-001 | WO-022 | Browser release identity owner | file | READ | src/lib/browser/protocol/browser-protocol.schema.json |  |
| OP-022-002 | WO-022 | Browser release identity owner | file | READ | src/lib/browser/protocol/generated/browser-protocol.generated.ts |  |
| OP-022-003 | WO-022 | Browser release identity owner | file | READ | src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs |  |
| OP-022-004 | WO-022 | Browser release identity owner | file | CREATE | src/lib/browser/release/browser-artifact-set.schema.json |  |
| OP-022-005 | WO-022 | Browser release identity owner | file | CREATE | src/lib/browser/release/browser-activation-tuple.schema.json |  |
| OP-022-006 | WO-022 | Browser release identity owner | file | CREATE | src/lib/browser/release/browser-release-proof.schema.json |  |
| OP-022-007 | WO-022 | Browser release identity owner | file | CREATE | src/lib/browser/release/browser-release-security-policy.schema.json |  |
| OP-022-008 | WO-022 | Browser release identity owner | file | CREATE | src/lib/browser/release/browser-rollback-receipt.schema.json |  |
| OP-022-009 | WO-022 | Browser release identity owner | file | CREATE | src/lib/browser/release/browser-build-inputs.schema.json |  |
| OP-022-010 | WO-022 | Browser release identity owner | file | CREATE | src/lib/browser/release/browser-sbom.schema.json |  |
| OP-022-011 | WO-022 | Browser release identity owner | file | CREATE | src/lib/browser/release/browser-provenance.schema.json |  |
| OP-022-012 | WO-022 | Browser release identity owner | file | CREATE | src/lib/browser/release/pinned-browser-toolchain.json |  |
| OP-022-013 | WO-022 | Browser release identity owner | file | CREATE | src/lib/browser/release/active-activation.json |  |
| OP-022-014 | WO-022 | Browser release identity owner | file | CREATE | src/lib/browser/release/release-identity.acceptance.ts |  |
| OP-022-015 | WO-022 | Browser release identity owner | file | CREATE | src/lib/browser/release/browser-build.config.json |  |
| OP-022-016 | WO-022 | Browser release identity owner | file | CREATE | src/lib/browser/release/browser-previous-activation-snapshot.schema.json |  |
| OP-023-001 | WO-023 | local-runtime owner | file | READ | src/lib/browser/infrastructure/browser-authority-broker.ts |  |
| OP-023-002 | WO-023 | local-runtime owner | file | READ | src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts |  |
| OP-023-003 | WO-023 | local-runtime owner | file | READ | src/lib/browser/exact-target/browser-target-lease.ts |  |
| OP-023-004 | WO-023 | local-runtime owner | file | READ | src/lib/browser/exact-target/browser-target-lease-manager.ts |  |
| OP-023-005 | WO-023 | local-runtime owner | file | READ | src/lib/browser/exact-target/browser-command-actor.ts |  |
| OP-023-006 | WO-023 | local-runtime owner | file | READ | src/lib/browser/transport/command-permit.ts |  |
| OP-023-007 | WO-023 | local-runtime owner | file | READ | src/lib/browser/profile/browser-profile-enrollment.ts |  |
| OP-023-008 | WO-023 | local-runtime owner | file | READ | src/lib/browser/profile/browser-process-supervisor.ts |  |
| OP-023-009 | WO-023 | local-runtime owner | file | CREATE | src/lib/local-runtime/workbench-browser-authority-support.ts |  |
| OP-023-010 | WO-023 | local-runtime owner | file | CREATE | src/lib/local-runtime/workbench-browser-authority.acceptance.ts |  |
| OP-023-011 | WO-023 | local-runtime owner | file | MODIFY | src/lib/local-runtime/workbench-assembly.ts |  |
| OP-023-012 | WO-023 | local-runtime owner | file | MODIFY | src/lib/local-runtime/workbench-ai-gateway-support.ts |  |
| OP-023-013 | WO-023 | local-runtime owner | file | MODIFY | src/lib/local-runtime/workbench-status.ts |  |
| OP-023-014 | WO-023 | local-runtime owner | file | MODIFY | src/lib/local-runtime/workbench.ts |  |
| OP-024-001 | WO-024 | dom-automation owner | file | READ | src/lib/browser/exact-target/browser-command-actor.ts |  |
| OP-024-002 | WO-024 | dom-automation owner | file | READ | src/lib/browser/transport/command-permit.ts |  |
| OP-024-003 | WO-024 | dom-automation owner | file | READ | src/lib/local-runtime/workbench-browser-authority-support.ts |  |
| OP-024-004 | WO-024 | dom-automation owner | file | READ | src/lib/local-runtime/workbench-browser-authority.acceptance.ts |  |
| OP-024-005 | WO-024 | dom-automation owner | deliverable | READ | deliverable://browser-observation/preconstruction-chrome.json |  |
| OP-024-006 | WO-024 | dom-automation owner | file | CREATE | src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts |  |
| OP-024-007 | WO-024 | dom-automation owner | file | MODIFY | src/capabilities/dom-automation/runtime/dom-target-binding.ts |  |
| OP-024-008 | WO-024 | dom-automation owner | file | MODIFY | src/capabilities/dom-automation/runtime/dom-snapshot.ts |  |
| OP-024-009 | WO-024 | dom-automation owner | file | MODIFY | src/capabilities/dom-automation/runtime/dom-fill.ts |  |
| OP-024-010 | WO-024 | dom-automation owner | file | MODIFY | src/capabilities/dom-automation/runtime/dom-click.ts |  |
| OP-024-011 | WO-024 | dom-automation owner | file | MODIFY | src/capabilities/dom-automation/runtime/dom-upload.ts |  |
| OP-024-012 | WO-024 | dom-automation owner | file | MODIFY | src/capabilities/dom-automation/runtime/dom-evidence.ts |  |
| OP-025-001 | WO-025 | ai-input-gateway owner | file | READ | src/lib/local-runtime/workbench-browser-authority-support.ts |  |
| OP-025-002 | WO-025 | ai-input-gateway owner | file | READ | src/lib/local-runtime/workbench-browser-authority.acceptance.ts |  |
| OP-025-003 | WO-025 | ai-input-gateway owner | file | READ | src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts |  |
| OP-025-004 | WO-025 | ai-input-gateway owner | file | CREATE | src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts |  |
| OP-025-005 | WO-025 | ai-input-gateway owner | file | MODIFY | src/capabilities/ai-input-gateway/ability-group.ts |  |
| OP-025-006 | WO-025 | ai-input-gateway owner | file | MODIFY | src/capabilities/ai-input-gateway/contracts/ai-provider-adapter.contract.ts |  |
| OP-025-007 | WO-025 | ai-input-gateway owner | file | MODIFY | src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution.ts |  |
| OP-025-008 | WO-025 | ai-input-gateway owner | file | MODIFY | src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-browser.ts |  |
| OP-025-009 | WO-025 | ai-input-gateway owner | file | MODIFY | src/capabilities/ai-input-gateway/providers/web-chat-page-actions.ts |  |
| OP-025-010 | WO-025 | ai-input-gateway owner | file | MODIFY | src/capabilities/ai-input-gateway/children/attach-approved-web-chat-files-once.ts |  |
| OP-025-011 | WO-025 | ai-input-gateway owner | file | MODIFY | src/capabilities/ai-input-gateway/acceptance/attachment.acceptance.ts |  |
| OP-025-012 | WO-025 | ai-input-gateway owner | file | MODIFY | src/capabilities/ai-input-gateway/acceptance/provider-boundary.acceptance.ts |  |
| OP-026-001 | WO-026 | video-download owner | file | READ | src/lib/browser/exact-target/browser-command-actor.ts |  |
| OP-026-002 | WO-026 | video-download owner | file | READ | src/lib/browser/transport/command-permit.ts |  |
| OP-026-003 | WO-026 | video-download owner | file | READ | src/lib/local-runtime/workbench-browser-authority-support.ts |  |
| OP-026-004 | WO-026 | video-download owner | file | READ | src/lib/local-runtime/workbench-browser-authority.acceptance.ts |  |
| OP-026-005 | WO-026 | video-download owner | file | CREATE | src/capabilities/video-download/acceptance/browser-authority.acceptance.ts |  |
| OP-026-006 | WO-026 | video-download owner | file | MODIFY | src/capabilities/video-download/children/download-web-video-once.ts |  |
| OP-026-007 | WO-026 | video-download owner | file | MODIFY | src/capabilities/video-download/children/download-facebook-video-once.ts |  |
| OP-026-008 | WO-026 | video-download owner | file | MODIFY | src/capabilities/video-download/children/download-tiktok-video-once.ts |  |
| OP-027-001 | WO-027 | amazon-invoice-upload owner | file | READ | src/lib/local-runtime/workbench-browser-authority-support.ts |  |
| OP-027-002 | WO-027 | amazon-invoice-upload owner | file | READ | src/lib/local-runtime/workbench-browser-authority.acceptance.ts |  |
| OP-027-003 | WO-027 | amazon-invoice-upload owner | file | READ | src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts |  |
| OP-027-004 | WO-027 | amazon-invoice-upload owner | file | CREATE | src/plugins/amazon-invoice-upload/amazon-invoice-upload-browser-authority.acceptance.ts |  |
| OP-027-005 | WO-027 | amazon-invoice-upload owner | file | MODIFY | src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts |  |
| OP-027-006 | WO-027 | amazon-invoice-upload owner | file | MODIFY | src/plugins/amazon-invoice-upload/amazon-invoice-upload-file-attachment.ts |  |
| OP-027-007 | WO-027 | amazon-invoice-upload owner | file | MODIFY | src/plugins/amazon-invoice-upload/amazon-invoice-upload-steps.ts |  |
| OP-027-008 | WO-027 | amazon-invoice-upload owner | file | MODIFY | src/plugins/amazon-invoice-upload/amazon-invoice-upload-verify.ts |  |
| OP-027-009 | WO-027 | amazon-invoice-upload owner | file | MODIFY | src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts |  |
| OP-027-010 | WO-027 | amazon-invoice-upload owner | file | MODIFY | src/plugins/amazon-invoice-upload/amazon-tax-invoice-download-flow-actions.ts |  |
| OP-027-011 | WO-027 | amazon-invoice-upload owner | file | MODIFY | src/plugins/amazon-invoice-upload/amazon-tax-invoice-download-flow-navigation.ts |  |
| OP-027-012 | WO-027 | amazon-invoice-upload owner | file | MODIFY | src/plugins/amazon-invoice-upload/amazon-tax-invoice-download.flow.ts |  |
| OP-028-001 | WO-028 | amazon-product-mining owner | file | READ | src/lib/local-runtime/workbench-browser-authority-support.ts |  |
| OP-028-002 | WO-028 | amazon-product-mining owner | file | READ | src/lib/local-runtime/workbench-browser-authority.acceptance.ts |  |
| OP-028-003 | WO-028 | amazon-product-mining owner | file | READ | src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts |  |
| OP-028-004 | WO-028 | amazon-product-mining owner | file | READ | src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts |  |
| OP-028-005 | WO-028 | amazon-product-mining owner | file | CREATE | src/plugins/amazon-product-mining/amazon-product-mining-browser-authority.acceptance.ts |  |
| OP-028-006 | WO-028 | amazon-product-mining owner | file | MODIFY | src/plugins/amazon-product-mining/amazon-product-mining.flow-support.ts |  |
| OP-028-007 | WO-028 | amazon-product-mining owner | file | MODIFY | src/plugins/amazon-product-mining/amazon-product-mining.flow.ts |  |
| OP-028-008 | WO-028 | amazon-product-mining owner | file | MODIFY | src/plugins/amazon-product-mining/amazon-product-mining.search.ts |  |
| OP-028-009 | WO-028 | amazon-product-mining owner | file | MODIFY | src/plugins/amazon-product-mining/amazon-product-mining.product-detail.ts |  |
| OP-028-010 | WO-028 | amazon-product-mining owner | file | MODIFY | src/plugins/amazon-product-mining/amazon-product-mining.reviews.ts |  |
| OP-028-011 | WO-028 | amazon-product-mining owner | file | MODIFY | src/plugins/amazon-product-mining/index.ts |  |
| OP-029-001 | WO-029 | xuanxue-ai-production owner | file | READ | src/lib/local-runtime/workbench-browser-authority-support.ts |  |
| OP-029-002 | WO-029 | xuanxue-ai-production owner | file | READ | src/lib/local-runtime/workbench-browser-authority.acceptance.ts |  |
| OP-029-003 | WO-029 | xuanxue-ai-production owner | file | READ | src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts |  |
| OP-029-004 | WO-029 | xuanxue-ai-production owner | file | CREATE | src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts |  |
| OP-029-005 | WO-029 | xuanxue-ai-production owner | file | MODIFY | src/plugins/xuanxue-ai-production/index.ts |  |
| OP-029-006 | WO-029 | xuanxue-ai-production owner | file | MODIFY | src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-proof.ts |  |
| OP-029-007 | WO-029 | xuanxue-ai-production owner | file | MODIFY | src/plugins/xuanxue-ai-production/xuanxue-ai-production-result.ts |  |
| OP-030-001 | WO-030 | xuanxue dynamic-proof owner | deliverable | READ | deliverable://construction-admission/xuanxue-candidate.json |  |
| OP-030-002 | WO-030 | xuanxue dynamic-proof owner | file | READ | src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts |  |
| OP-030-003 | WO-030 | xuanxue dynamic-proof owner | file | CREATE | /Users/nexgen/Documents/xuanxue-web/tests/dynamic-proof/browser-authority-window-contract.test.ts |  |
| OP-030-004 | WO-030 | xuanxue dynamic-proof owner | deliverable | CREATE | deliverable://work-orders/WO-030/cross-repo-receipt.json |  |
| OP-030-005 | WO-030 | xuanxue dynamic-proof owner | file | MODIFY | /Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/browser-authority-proof-contract.ts |  |
| OP-030-006 | WO-030 | xuanxue dynamic-proof owner | file | MODIFY | /Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/collector-contracts.ts |  |
| OP-030-007 | WO-030 | xuanxue dynamic-proof owner | file | MODIFY | /Users/nexgen/Documents/xuanxue-web/scripts/audit/domains/dynamic-proof/dynamic-agent-receipt-inspection.ts |  |
| OP-031-001 | WO-031 | local-browser audit owner | file | READ | .github/instructions/agent-rules/modules/module-local-browser-session.instructions.md |  |
| OP-031-002 | WO-031 | local-browser audit owner | file | READ | scripts/audit/domains/local-browser-session/manifest.json |  |
| OP-031-003 | WO-031 | local-browser audit owner | file | READ | scripts/audit/domains/local-browser-session/inspector.ts |  |
| OP-031-004 | WO-031 | local-browser audit owner | file | CREATE | scripts/audit/domains/local-browser-session/local-browser-26-checks.acceptance.ts |  |
| OP-031-005 | WO-031 | local-browser audit owner | deliverable | CREATE | deliverable://work-orders/WO-031/26-check-receipt.json |  |
| OP-031-006 | WO-031 | local-browser audit owner | file | MODIFY | scripts/audit/domains/local-browser-session/manifest.json |  |
| OP-031-007 | WO-031 | local-browser audit owner | file | MODIFY | scripts/audit/domains/local-browser-session/inspector.ts |  |
| OP-032-001 | WO-032 | acceptance and audit test owner | file | READ | scripts/audit/domains/local-browser-session/manifest.json |  |
| OP-032-002 | WO-032 | acceptance and audit test owner | file | READ | scripts/audit/domains/local-browser-session/inspector.ts |  |
| OP-032-003 | WO-032 | acceptance and audit test owner | file | CREATE | scripts/acceptance/local-browser-terminal-contract.acceptance.ts |  |
| OP-032-004 | WO-032 | acceptance and audit test owner | file | CREATE | scripts/acceptance/local-browser-26-mutants.acceptance.ts |  |
| OP-032-005 | WO-032 | acceptance and audit test owner | file | CREATE | scripts/acceptance/local-browser-property-model.acceptance.ts |  |
| OP-033-001 | WO-033 | release build owner | deliverable | READ | deliverable://construction-admission/external-operations.json |  |
| OP-033-002 | WO-033 | release build owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-033-003 | WO-033 | release build owner | deliverable | READ | deliverable://browser-release/agent-constructed-tree-manifest.json |  |
| OP-033-004 | WO-033 | release build owner | deliverable | READ | deliverable://browser-release/agent-build-input-manifest.json |  |
| OP-033-005 | WO-033 | release build owner | deliverable | READ | deliverable://browser-release/agent-constructed-source-bundle.tar.zst |  |
| OP-033-006 | WO-033 | release build owner | deliverable | READ | deliverable://browser-release/xuanxue-constructed-tree-manifest.json |  |
| OP-033-007 | WO-033 | release build owner | deliverable | READ | deliverable://browser-release/xuanxue-constructed-source-bundle.tar.zst |  |
| OP-033-008 | WO-033 | release build owner | data | CREATE | artifact://browser-release/controller/controller-bundle.tgz |  |
| OP-033-009 | WO-033 | release build owner | data | CREATE | artifact://browser-release/native-host/grasseye-browser-host |  |
| OP-033-010 | WO-033 | release build owner | data | CREATE | artifact://browser-release/browserctl/browserctl |  |
| OP-033-011 | WO-033 | release build owner | data | CREATE | artifact://browser-release/launcher/grasseye-browser-launcher |  |
| OP-033-012 | WO-033 | release build owner | data | CREATE | artifact://browser-release/platform-macos/libgrasseye-platform-macos.a |  |
| OP-033-013 | WO-033 | release build owner | data | CREATE | artifact://browser-release/extension/grasseye-browser-extension.verified.crx |  |
| OP-033-014 | WO-033 | release build owner | data | CREATE | artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json |  |
| OP-033-015 | WO-033 | release build owner | data | CREATE | artifact://browser-release/checksums/SHA256SUMS |  |
| OP-033-016 | WO-033 | release build owner | data | CREATE | artifact://browser-release/signatures/SHA256SUMS.sig |  |
| OP-033-017 | WO-033 | release build owner | deliverable | CREATE | deliverable://browser-release/browser-build-input-lock.json |  |
| OP-033-018 | WO-033 | release build owner | deliverable | CREATE | deliverable://browser-release/artifact-set.json |  |
| OP-033-019 | WO-033 | release build owner | deliverable | CREATE | deliverable://browser-release/builder-a-receipt.json |  |
| OP-033-020 | WO-033 | release build owner | deliverable | CREATE | deliverable://browser-release/builder-b-receipt.json |  |
| OP-033-021 | WO-033 | release build owner | deliverable | CREATE | deliverable://browser-release/sbom.spdx.json |  |
| OP-033-022 | WO-033 | release build owner | deliverable | CREATE | deliverable://browser-release/provenance.json |  |
| OP-033-023 | WO-033 | release build owner | deliverable | CREATE | deliverable://browser-release/installed-artifact-readback.json |  |
| OP-033-024 | WO-033 | release build owner | file | CREATE | src/lib/browser/release/build-artifacts.mjs |  |
| OP-033-025 | WO-033 | release build owner | file | CREATE | src/lib/browser/release/verify-artifacts.mjs |  |
| OP-034-001 | WO-034 | real Chrome evidence owner | deliverable | READ | deliverable://browser-release/artifact-set.json |  |
| OP-034-002 | WO-034 | real Chrome evidence owner | deliverable | READ | deliverable://browser-release/activation-tuple-candidate.json |  |
| OP-034-003 | WO-034 | real Chrome evidence owner | deliverable | READ | deliverable://browser-release/release-security-policy.json |  |
| OP-034-004 | WO-034 | real Chrome evidence owner | deliverable | READ | deliverable://browser-release/release-identity-signature.json |  |
| OP-034-005 | WO-034 | real Chrome evidence owner | deliverable | READ | deliverable://browser-observation/preconstruction-chrome.json |  |
| OP-034-006 | WO-034 | real Chrome evidence owner | data | READ | artifact://browser-release/controller/controller-bundle.tgz |  |
| OP-034-007 | WO-034 | real Chrome evidence owner | data | READ | artifact://browser-release/native-host/grasseye-browser-host |  |
| OP-034-008 | WO-034 | real Chrome evidence owner | data | READ | artifact://browser-release/browserctl/browserctl |  |
| OP-034-009 | WO-034 | real Chrome evidence owner | data | READ | artifact://browser-release/launcher/grasseye-browser-launcher |  |
| OP-034-010 | WO-034 | real Chrome evidence owner | data | READ | artifact://browser-release/platform-macos/libgrasseye-platform-macos.a |  |
| OP-034-011 | WO-034 | real Chrome evidence owner | data | READ | artifact://browser-release/extension/grasseye-browser-extension.verified.crx |  |
| OP-034-012 | WO-034 | real Chrome evidence owner | data | READ | artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json |  |
| OP-034-013 | WO-034 | real Chrome evidence owner | data | READ | artifact://browser-release/checksums/SHA256SUMS |  |
| OP-034-014 | WO-034 | real Chrome evidence owner | data | READ | artifact://browser-release/signatures/SHA256SUMS.sig |  |
| OP-034-015 | WO-034 | real Chrome evidence owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-034-016 | WO-034 | real Chrome evidence owner | file | CREATE | scripts/acceptance/local-browser-real-chrome-terminal.acceptance.ts |  |
| OP-034-017 | WO-034 | real Chrome evidence owner | deliverable | CREATE | deliverable://browser-release/real-chrome-matrix.json |  |
| OP-035-001 | WO-035 | AGENT repository governance owner | file | READ | scripts/audit/domains/local-browser-session/manifest.json |  |
| OP-035-002 | WO-035 | AGENT repository governance owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-035-003 | WO-035 | AGENT repository governance owner | deliverable | READ | deliverable://construction-admission/agent-repository-governance-policy.json |  |
| OP-035-004 | WO-035 | AGENT repository governance owner | deliverable | CREATE | deliverable://browser-release/agent-branch-protection-prestate.json |  |
| OP-035-005 | WO-035 | AGENT repository governance owner | deliverable | CREATE | deliverable://browser-release/branch-protection-readback.json |  |
| OP-035-006 | WO-035 | AGENT repository governance owner | deliverable | CREATE | deliverable://browser-release/agent-branch-protection-recovery-receipt.json |  |
| OP-035-007 | WO-035 | AGENT repository governance owner | system | MODIFY | system://github/ADVISION-X/AGENT/branches/main/protection/required_status_checks |  |
| OP-036-001 | WO-036 | HA operations owner | deliverable | READ | deliverable://construction-admission/external-operations.json |  |
| OP-036-002 | WO-036 | HA operations owner | deliverable | READ | deliverable://construction-admission/xuanxue-candidate.json |  |
| OP-036-003 | WO-036 | HA operations owner | deliverable | READ | deliverable://browser-release/real-chrome-matrix.json |  |
| OP-036-004 | WO-036 | HA operations owner | deliverable | READ | deliverable://browser-release/activation-tuple-candidate.json |  |
| OP-036-005 | WO-036 | HA operations owner | deliverable | READ | deliverable://browser-release/release-security-policy.json |  |
| OP-036-006 | WO-036 | HA operations owner | deliverable | READ | deliverable://browser-release/release-identity-signature.json |  |
| OP-036-007 | WO-036 | HA operations owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-036-008 | WO-036 | HA operations owner | deliverable | CREATE | deliverable://browser-release/ha-handover.json |  |
| OP-037-001 | WO-037 | soak evidence owner | deliverable | READ | deliverable://browser-release/ha-handover.json |  |
| OP-037-002 | WO-037 | soak evidence owner | deliverable | READ | deliverable://browser-release/artifact-set.json |  |
| OP-037-003 | WO-037 | soak evidence owner | deliverable | READ | deliverable://browser-release/activation-tuple-candidate.json |  |
| OP-037-004 | WO-037 | soak evidence owner | deliverable | READ | deliverable://browser-release/release-security-policy.json |  |
| OP-037-005 | WO-037 | soak evidence owner | deliverable | READ | deliverable://browser-release/release-identity-signature.json |  |
| OP-037-006 | WO-037 | soak evidence owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-037-007 | WO-037 | soak evidence owner | deliverable | CREATE | deliverable://browser-release/soak-24h.json |  |
| OP-037-008 | WO-037 | soak evidence owner | deliverable | CREATE | deliverable://browser-release/soak-168h.json |  |
| OP-038-001 | WO-038 | release proof owner | deliverable | READ | deliverable://work-orders/WO-031/26-check-receipt.json |  |
| OP-038-002 | WO-038 | release proof owner | deliverable | READ | deliverable://work-orders/WO-030/cross-repo-receipt.json |  |
| OP-038-003 | WO-038 | release proof owner | deliverable | READ | deliverable://browser-release/artifact-set.json |  |
| OP-038-004 | WO-038 | release proof owner | deliverable | READ | deliverable://browser-release/activation-tuple-candidate.json |  |
| OP-038-005 | WO-038 | release proof owner | deliverable | READ | deliverable://browser-release/release-security-policy.json |  |
| OP-038-006 | WO-038 | release proof owner | deliverable | READ | deliverable://browser-release/real-chrome-matrix.json |  |
| OP-038-007 | WO-038 | release proof owner | deliverable | READ | deliverable://browser-release/business-workday-receipt.json |  |
| OP-038-008 | WO-038 | release proof owner | deliverable | READ | deliverable://browser-release/branch-protection-readback.json |  |
| OP-038-009 | WO-038 | release proof owner | deliverable | READ | deliverable://browser-release/ha-handover.json |  |
| OP-038-010 | WO-038 | release proof owner | deliverable | READ | deliverable://browser-release/soak-24h.json |  |
| OP-038-011 | WO-038 | release proof owner | deliverable | READ | deliverable://browser-release/soak-168h.json |  |
| OP-038-012 | WO-038 | release proof owner | deliverable | READ | deliverable://browser-release/ci-full-receipt.json |  |
| OP-038-013 | WO-038 | release proof owner | deliverable | READ | deliverable://browser-release/independent-audit.json |  |
| OP-038-014 | WO-038 | release proof owner | file | READ | scripts/audit/generated/audit-plan.generated.json |  |
| OP-038-015 | WO-038 | release proof owner | deliverable | READ | deliverable://browser-release/xuanxue-branch-protection-readback.json |  |
| OP-038-016 | WO-038 | release proof owner | deliverable | READ | deliverable://browser-release/browser-build-input-lock.json |  |
| OP-038-017 | WO-038 | release proof owner | deliverable | READ | deliverable://browser-release/sbom.spdx.json |  |
| OP-038-018 | WO-038 | release proof owner | deliverable | READ | deliverable://browser-release/provenance.json |  |
| OP-038-019 | WO-038 | release proof owner | deliverable | READ | deliverable://browser-release/installed-artifact-readback.json |  |
| OP-038-020 | WO-038 | release proof owner | deliverable | READ | deliverable://browser-release/release-identity-signature.json |  |
| OP-038-021 | WO-038 | release proof owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-038-022 | WO-038 | release proof owner | deliverable | CREATE | deliverable://browser-release/BrowserReleaseProofManifestV1.json |  |
| OP-039-001 | WO-039 | release activation owner | deliverable | READ | deliverable://browser-release/BrowserReleaseProofManifestV1.json |  |
| OP-039-002 | WO-039 | release activation owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-039-003 | WO-039 | release activation owner | deliverable | CREATE | deliverable://browser-release/activation-receipt.json |  |
| OP-039-004 | WO-039 | release activation owner | deliverable | CREATE | deliverable://browser-release/previous-activation-snapshot.json |  |
| OP-039-005 | WO-039 | release activation owner | system | MODIFY | system://browser-release/active-activation-slot |  |
| OP-039-006 | WO-039 | release activation owner | deliverable | DELETE | deliverable://browser-release/construction-blocked-browser-authority | CON-001；CON-002；CON-003；CON-004；CON-005；CON-006；CON-007；CON-008；CON-009；CON-010；CON-011 |
| OP-040-001 | WO-040 | production readback owner | deliverable | READ | deliverable://browser-release/activation-receipt.json |  |
| OP-040-002 | WO-040 | production readback owner | deliverable | READ | deliverable://browser-release/BrowserReleaseProofManifestV1.json |  |
| OP-040-003 | WO-040 | production readback owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-040-004 | WO-040 | production readback owner | deliverable | CREATE | deliverable://browser-release/post-activation-readback.json |  |
| OP-041-001 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://work-orders/WO-031/26-check-receipt.json |  |
| OP-041-002 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://work-orders/WO-030/cross-repo-receipt.json |  |
| OP-041-003 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/artifact-set.json |  |
| OP-041-004 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/activation-tuple-candidate.json |  |
| OP-041-005 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/release-security-policy.json |  |
| OP-041-006 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/real-chrome-matrix.json |  |
| OP-041-007 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/business-workday-receipt.json |  |
| OP-041-008 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/branch-protection-readback.json |  |
| OP-041-009 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/ha-handover.json |  |
| OP-041-010 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/soak-24h.json |  |
| OP-041-011 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/soak-168h.json |  |
| OP-041-012 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/ci-full-receipt.json |  |
| OP-041-013 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/xuanxue-branch-protection-readback.json |  |
| OP-041-014 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/browser-build-input-lock.json |  |
| OP-041-015 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/sbom.spdx.json |  |
| OP-041-016 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/provenance.json |  |
| OP-041-017 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/installed-artifact-readback.json |  |
| OP-041-018 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/release-identity-signature.json |  |
| OP-041-019 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/agent-branch-protection-prestate.json |  |
| OP-041-020 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/agent-branch-protection-recovery-receipt.json |  |
| OP-041-021 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/xuanxue-branch-protection-prestate.json |  |
| OP-041-022 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json |  |
| OP-041-023 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-041-024 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://construction-admission/agent-repository-governance-policy.json |  |
| OP-041-025 | WO-041 | independent read-only audit owner | deliverable | READ | deliverable://construction-admission/xuanxue-repository-governance-policy.json |  |
| OP-041-026 | WO-041 | independent read-only audit owner | deliverable | CREATE | deliverable://browser-release/independent-audit.json |  |
| OP-042-001 | WO-042 | release approval owner | deliverable | READ | deliverable://browser-release/BrowserReleaseProofManifestV1.json |  |
| OP-042-002 | WO-042 | release approval owner | deliverable | READ | deliverable://browser-release/activation-receipt.json |  |
| OP-042-003 | WO-042 | release approval owner | deliverable | READ | deliverable://browser-release/post-activation-readback.json |  |
| OP-042-004 | WO-042 | release approval owner | deliverable | READ | deliverable://browser-release/independent-audit.json |  |
| OP-042-005 | WO-042 | release approval owner | deliverable | READ | deliverable://browser-release/ci-full-receipt.json |  |
| OP-042-006 | WO-042 | release approval owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-042-007 | WO-042 | release approval owner | deliverable | CREATE | deliverable://browser-release/final-release-approval.json |  |
| OP-046-001 | WO-046 | browserctl owner | file | READ | src/lib/browser/protocol/browser-profile-enrollment.schema.json |  |
| OP-046-002 | WO-046 | browserctl owner | file | READ | src/lib/browser/protocol/browser-protocol.schema.json |  |
| OP-046-003 | WO-046 | browserctl owner | file | CREATE | src/lib/browser/native-messaging-host/crates/browserctl/Cargo.toml |  |
| OP-046-004 | WO-046 | browserctl owner | file | CREATE | src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs |  |
| OP-046-005 | WO-046 | browserctl owner | file | CREATE | src/lib/browser/native-messaging-host/crates/browserctl/src/install.rs |  |
| OP-046-006 | WO-046 | browserctl owner | file | CREATE | src/lib/browser/native-messaging-host/crates/browserctl/src/verify.rs |  |
| OP-046-007 | WO-046 | browserctl owner | file | CREATE | src/lib/browser/native-messaging-host/crates/browserctl/src/doctor.rs |  |
| OP-046-008 | WO-046 | browserctl owner | file | CREATE | src/lib/browser/native-messaging-host/crates/browserctl/src/repair.rs |  |
| OP-046-009 | WO-046 | browserctl owner | file | CREATE | src/lib/browser/native-messaging-host/crates/browserctl/src/enroll_profile.rs |  |
| OP-046-010 | WO-046 | browserctl owner | file | CREATE | src/lib/browser/native-messaging-host/crates/browserctl/src/activate.rs |  |
| OP-046-011 | WO-046 | browserctl owner | file | CREATE | src/lib/browser/native-messaging-host/crates/browserctl/src/rollback.rs |  |
| OP-046-012 | WO-046 | browserctl owner | file | CREATE | src/lib/browser/native-messaging-host/crates/launcher/Cargo.toml |  |
| OP-046-013 | WO-046 | browserctl owner | file | CREATE | src/lib/browser/native-messaging-host/crates/launcher/src/main.rs |  |
| OP-046-014 | WO-046 | browserctl owner | file | CREATE | src/lib/browser/native-messaging-host/crates/platform-macos/Cargo.toml |  |
| OP-046-015 | WO-046 | browserctl owner | file | CREATE | src/lib/browser/native-messaging-host/crates/platform-macos/src/registration.rs |  |
| OP-046-016 | WO-046 | browserctl owner | file | CREATE | src/lib/browser/native-messaging-host/manifests/com.grasseye.browser_host.json |  |
| OP-046-017 | WO-046 | browserctl owner | file | CREATE | src/lib/browser/native-messaging-host/crates/browserctl/tests/browserctl.acceptance.rs |  |
| OP-047-001 | WO-047 | Browser infrastructure supervisor owner | file | READ | src/lib/browser/transport/transport-actor.ts |  |
| OP-047-002 | WO-047 | Browser infrastructure supervisor owner | file | READ | src/lib/browser/profile/browser-process-supervisor.ts |  |
| OP-047-003 | WO-047 | Browser infrastructure supervisor owner | file | CREATE | src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts |  |
| OP-047-004 | WO-047 | Browser infrastructure supervisor owner | file | CREATE | src/lib/browser/infrastructure/browser-owner-lock.ts |  |
| OP-047-005 | WO-047 | Browser infrastructure supervisor owner | file | CREATE | src/lib/browser/infrastructure/browser-worker-membership.ts |  |
| OP-047-006 | WO-047 | Browser infrastructure supervisor owner | file | CREATE | src/lib/browser/infrastructure/browser-worker-handover.ts |  |
| OP-047-007 | WO-047 | Browser infrastructure supervisor owner | file | CREATE | src/lib/browser/infrastructure/browser-retry-policy.ts |  |
| OP-047-008 | WO-047 | Browser infrastructure supervisor owner | file | CREATE | src/lib/browser/infrastructure/browser-repair.ts |  |
| OP-047-009 | WO-047 | Browser infrastructure supervisor owner | file | CREATE | src/lib/browser/infrastructure/browser-infrastructure-supervisor.acceptance.ts |  |
| OP-043-001 | WO-043 | business workday evidence owner | deliverable | READ | deliverable://browser-release/artifact-set.json |  |
| OP-043-002 | WO-043 | business workday evidence owner | deliverable | READ | deliverable://browser-release/activation-tuple-candidate.json |  |
| OP-043-003 | WO-043 | business workday evidence owner | deliverable | READ | deliverable://browser-release/real-chrome-matrix.json |  |
| OP-043-004 | WO-043 | business workday evidence owner | deliverable | READ | deliverable://construction-admission/provider-journey-authorization.json |  |
| OP-043-005 | WO-043 | business workday evidence owner | deliverable | READ | deliverable://browser-release/release-security-policy.json |  |
| OP-043-006 | WO-043 | business workday evidence owner | deliverable | READ | deliverable://browser-release/release-identity-signature.json |  |
| OP-043-007 | WO-043 | business workday evidence owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-043-008 | WO-043 | business workday evidence owner | file | CREATE | scripts/acceptance/local-browser-business-workday-terminal.acceptance.ts |  |
| OP-043-009 | WO-043 | business workday evidence owner | deliverable | CREATE | deliverable://browser-release/business-workday-receipt.json |  |
| OP-044-001 | WO-044 | CI-FULL compliance self-check owner | file | READ | scripts/audit/ci-full.ts |  |
| OP-044-002 | WO-044 | CI-FULL compliance self-check owner | deliverable | READ | deliverable://browser-release/business-workday-receipt.json |  |
| OP-044-003 | WO-044 | CI-FULL compliance self-check owner | deliverable | READ | deliverable://browser-release/activation-tuple-candidate.json |  |
| OP-044-004 | WO-044 | CI-FULL compliance self-check owner | deliverable | READ | deliverable://browser-release/release-security-policy.json |  |
| OP-044-005 | WO-044 | CI-FULL compliance self-check owner | deliverable | READ | deliverable://browser-release/release-identity-signature.json |  |
| OP-044-006 | WO-044 | CI-FULL compliance self-check owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-044-007 | WO-044 | CI-FULL compliance self-check owner | deliverable | CREATE | deliverable://browser-release/ci-full-receipt.json |  |
| OP-048-001 | WO-048 | xuanxue repository governance owner | deliverable | READ | deliverable://construction-admission/xuanxue-candidate.json |  |
| OP-048-002 | WO-048 | xuanxue repository governance owner | deliverable | READ | deliverable://work-orders/WO-030/cross-repo-receipt.json |  |
| OP-048-003 | WO-048 | xuanxue repository governance owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-048-004 | WO-048 | xuanxue repository governance owner | deliverable | READ | deliverable://construction-admission/xuanxue-repository-governance-policy.json |  |
| OP-048-005 | WO-048 | xuanxue repository governance owner | deliverable | CREATE | deliverable://browser-release/xuanxue-branch-protection-prestate.json |  |
| OP-048-006 | WO-048 | xuanxue repository governance owner | deliverable | CREATE | deliverable://browser-release/xuanxue-branch-protection-readback.json |  |
| OP-048-007 | WO-048 | xuanxue repository governance owner | deliverable | CREATE | deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json |  |
| OP-048-008 | WO-048 | xuanxue repository governance owner | system | MODIFY | system://github/ADVISION-X/xuanxue-web/branches/main/protection/required_status_checks |  |
| OP-049-001 | WO-049 | provider journey authorization owner | deliverable | READ | deliverable://construction-admission/operator-provider-journey-request.json |  |
| OP-049-002 | WO-049 | provider journey authorization owner | deliverable | CREATE | deliverable://construction-admission/provider-journey-authorization.json |  |
| OP-050-001 | WO-050 | Browser release identity owner | deliverable | READ | deliverable://construction-admission/external-operations.json |  |
| OP-050-002 | WO-050 | Browser release identity owner | deliverable | READ | deliverable://browser-release/browser-build-input-lock.json |  |
| OP-050-003 | WO-050 | Browser release identity owner | deliverable | READ | deliverable://browser-release/artifact-set.json |  |
| OP-050-004 | WO-050 | Browser release identity owner | deliverable | READ | deliverable://browser-release/builder-a-receipt.json |  |
| OP-050-005 | WO-050 | Browser release identity owner | deliverable | READ | deliverable://browser-release/builder-b-receipt.json |  |
| OP-050-006 | WO-050 | Browser release identity owner | deliverable | READ | deliverable://browser-release/sbom.spdx.json |  |
| OP-050-007 | WO-050 | Browser release identity owner | deliverable | READ | deliverable://browser-release/provenance.json |  |
| OP-050-008 | WO-050 | Browser release identity owner | deliverable | READ | deliverable://browser-release/installed-artifact-readback.json |  |
| OP-050-009 | WO-050 | Browser release identity owner | file | READ | src/lib/browser/release/browser-activation-tuple.schema.json |  |
| OP-050-010 | WO-050 | Browser release identity owner | file | READ | src/lib/browser/release/browser-release-security-policy.schema.json |  |
| OP-050-011 | WO-050 | Browser release identity owner | data | READ | artifact://browser-release/controller/controller-bundle.tgz |  |
| OP-050-012 | WO-050 | Browser release identity owner | data | READ | artifact://browser-release/native-host/grasseye-browser-host |  |
| OP-050-013 | WO-050 | Browser release identity owner | data | READ | artifact://browser-release/browserctl/browserctl |  |
| OP-050-014 | WO-050 | Browser release identity owner | data | READ | artifact://browser-release/launcher/grasseye-browser-launcher |  |
| OP-050-015 | WO-050 | Browser release identity owner | data | READ | artifact://browser-release/platform-macos/libgrasseye-platform-macos.a |  |
| OP-050-016 | WO-050 | Browser release identity owner | data | READ | artifact://browser-release/extension/grasseye-browser-extension.verified.crx |  |
| OP-050-017 | WO-050 | Browser release identity owner | data | READ | artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json |  |
| OP-050-018 | WO-050 | Browser release identity owner | data | READ | artifact://browser-release/checksums/SHA256SUMS |  |
| OP-050-019 | WO-050 | Browser release identity owner | data | READ | artifact://browser-release/signatures/SHA256SUMS.sig |  |
| OP-050-020 | WO-050 | Browser release identity owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-050-021 | WO-050 | Browser release identity owner | deliverable | CREATE | deliverable://browser-release/activation-tuple-candidate.json |  |
| OP-050-022 | WO-050 | Browser release identity owner | deliverable | CREATE | deliverable://browser-release/release-security-policy.json |  |
| OP-050-023 | WO-050 | Browser release identity owner | deliverable | CREATE | deliverable://browser-release/release-identity-signature.json |  |
| OP-051-001 | WO-051 | Browser authority issuer owner | deliverable | READ | deliverable://browser-release/post-activation-readback.json |  |
| OP-051-002 | WO-051 | Browser authority issuer owner | deliverable | READ | deliverable://browser-release/activation-receipt.json |  |
| OP-051-003 | WO-051 | Browser authority issuer owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-051-004 | WO-051 | Browser authority issuer owner | deliverable | CREATE | deliverable://browser-release/recovery-authority-revoke.json |  |
| OP-051-005 | WO-051 | Browser authority issuer owner | system | MODIFY | system://browser-authority/active-authority-slot#revoke |  |
| OP-052-001 | WO-052 | browserctl owner | deliverable | READ | deliverable://browser-release/recovery-authority-revoke.json |  |
| OP-052-002 | WO-052 | browserctl owner | deliverable | READ | deliverable://browser-release/activation-receipt.json |  |
| OP-052-003 | WO-052 | browserctl owner | deliverable | READ | deliverable://browser-release/previous-activation-snapshot.json |  |
| OP-052-004 | WO-052 | browserctl owner | deliverable | READ | deliverable://browser-release/BrowserReleaseProofManifestV1.json |  |
| OP-052-005 | WO-052 | browserctl owner | file | READ | src/lib/browser/native-messaging-host/crates/browserctl/src/rollback.rs |  |
| OP-052-006 | WO-052 | browserctl owner | data | READ | artifact://browser-release/controller/controller-bundle.tgz |  |
| OP-052-007 | WO-052 | browserctl owner | data | READ | artifact://browser-release/native-host/grasseye-browser-host |  |
| OP-052-008 | WO-052 | browserctl owner | data | READ | artifact://browser-release/browserctl/browserctl |  |
| OP-052-009 | WO-052 | browserctl owner | data | READ | artifact://browser-release/launcher/grasseye-browser-launcher |  |
| OP-052-010 | WO-052 | browserctl owner | data | READ | artifact://browser-release/platform-macos/libgrasseye-platform-macos.a |  |
| OP-052-011 | WO-052 | browserctl owner | data | READ | artifact://browser-release/extension/grasseye-browser-extension.verified.crx |  |
| OP-052-012 | WO-052 | browserctl owner | data | READ | artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json |  |
| OP-052-013 | WO-052 | browserctl owner | data | READ | artifact://browser-release/checksums/SHA256SUMS |  |
| OP-052-014 | WO-052 | browserctl owner | data | READ | artifact://browser-release/signatures/SHA256SUMS.sig |  |
| OP-052-015 | WO-052 | browserctl owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-052-016 | WO-052 | browserctl owner | deliverable | CREATE | deliverable://browser-release/recovery-browserctl-rollback.json |  |
| OP-052-017 | WO-052 | browserctl owner | system | MODIFY | system://browser-profile/installed-artifact-state#recover-signed-present-or-absent |  |
| OP-053-001 | WO-053 | release activation owner | deliverable | READ | deliverable://browser-release/recovery-browserctl-rollback.json |  |
| OP-053-002 | WO-053 | release activation owner | deliverable | READ | deliverable://browser-release/activation-receipt.json |  |
| OP-053-003 | WO-053 | release activation owner | deliverable | READ | deliverable://browser-release/previous-activation-snapshot.json |  |
| OP-053-004 | WO-053 | release activation owner | deliverable | READ | deliverable://browser-release/release-security-policy.json |  |
| OP-053-005 | WO-053 | release activation owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-053-006 | WO-053 | release activation owner | deliverable | CREATE | deliverable://browser-release/recovery-active-slot-cas.json |  |
| OP-053-007 | WO-053 | release activation owner | system | MODIFY | system://browser-release/active-activation-slot#rollback-present-or-absent |  |
| OP-054-001 | WO-054 | local-runtime owner | deliverable | READ | deliverable://browser-release/recovery-active-slot-cas.json |  |
| OP-054-002 | WO-054 | local-runtime owner | deliverable | READ | deliverable://browser-release/recovery-authority-revoke.json |  |
| OP-054-003 | WO-054 | local-runtime owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-054-004 | WO-054 | local-runtime owner | deliverable | CREATE | deliverable://browser-release/recovery-consumer-blocked.json |  |
| OP-054-005 | WO-054 | local-runtime owner | system | MODIFY | system://workbench/browser-consumer-admission#construction-blocked |  |
| OP-055-001 | WO-055 | production recovery readback owner | deliverable | READ | deliverable://browser-release/recovery-authority-revoke.json |  |
| OP-055-002 | WO-055 | production recovery readback owner | deliverable | READ | deliverable://browser-release/recovery-browserctl-rollback.json |  |
| OP-055-003 | WO-055 | production recovery readback owner | deliverable | READ | deliverable://browser-release/recovery-active-slot-cas.json |  |
| OP-055-004 | WO-055 | production recovery readback owner | deliverable | READ | deliverable://browser-release/recovery-consumer-blocked.json |  |
| OP-055-005 | WO-055 | production recovery readback owner | deliverable | READ | deliverable://browser-release/previous-activation-snapshot.json |  |
| OP-055-006 | WO-055 | production recovery readback owner | deliverable | READ | deliverable://browser-release/constructed-release-candidate.json |  |
| OP-055-007 | WO-055 | production recovery readback owner | deliverable | CREATE | deliverable://browser-release/post-rollback-readback.json |  |
| OP-055-008 | WO-055 | production recovery readback owner | deliverable | CREATE | deliverable://browser-release/new-attempt-admission.json |  |
| OP-056-001 | WO-056 | AGENT repository governance owner | deliverable | READ | deliverable://construction-admission/agent-repository-governance-request.json |  |
| OP-056-002 | WO-056 | AGENT repository governance owner | deliverable | CREATE | deliverable://construction-admission/agent-repository-governance-policy.json |  |
| OP-057-001 | WO-057 | xuanxue repository governance owner | deliverable | READ | deliverable://construction-admission/xuanxue-repository-governance-request.json |  |
| OP-057-002 | WO-057 | xuanxue repository governance owner | deliverable | CREATE | deliverable://construction-admission/xuanxue-repository-governance-policy.json |  |
| OP-058-001 | WO-058 | AGENT repository governance owner | deliverable | READ | deliverable://construction-admission/agent-repository-governance-policy.json |  |
| OP-058-002 | WO-058 | AGENT repository governance owner | system | READ | system://git/ADVISION-X/AGENT/worktree-and-index |  |
| OP-058-003 | WO-058 | AGENT repository governance owner | file | READ | package.json |  |
| OP-058-004 | WO-058 | AGENT repository governance owner | file | READ | package-lock.json |  |
| OP-058-005 | WO-058 | AGENT repository governance owner | file | READ | tsconfig.json |  |
| OP-058-006 | WO-058 | AGENT repository governance owner | deliverable | CREATE | deliverable://browser-release/agent-constructed-tree-manifest.json |  |
| OP-058-007 | WO-058 | AGENT repository governance owner | deliverable | CREATE | deliverable://browser-release/agent-build-input-manifest.json |  |
| OP-058-008 | WO-058 | AGENT repository governance owner | deliverable | CREATE | deliverable://browser-release/agent-constructed-source-bundle.tar.zst |  |
| OP-058-009 | WO-058 | AGENT repository governance owner | deliverable | CREATE | deliverable://browser-release/agent-constructed-candidate.json |  |
| OP-058-010 | WO-058 | AGENT repository governance owner | deliverable | CREATE | deliverable://browser-release/agent-remote-candidate-readback.json |  |
| OP-058-011 | WO-058 | AGENT repository governance owner | system | MODIFY | system://git/ADVISION-X/AGENT/refs/heads/codex/browser-greenfield |  |
| OP-059-001 | WO-059 | xuanxue repository governance owner | deliverable | READ | deliverable://construction-admission/xuanxue-repository-governance-policy.json |  |
| OP-059-002 | WO-059 | xuanxue repository governance owner | system | READ | system://git/ADVISION-X/xuanxue-web/worktree-and-index |  |
| OP-059-003 | WO-059 | xuanxue repository governance owner | deliverable | READ | deliverable://work-orders/WO-030/cross-repo-receipt.json |  |
| OP-059-004 | WO-059 | xuanxue repository governance owner | deliverable | CREATE | deliverable://browser-release/xuanxue-constructed-tree-manifest.json |  |
| OP-059-005 | WO-059 | xuanxue repository governance owner | deliverable | CREATE | deliverable://browser-release/xuanxue-constructed-source-bundle.tar.zst |  |
| OP-059-006 | WO-059 | xuanxue repository governance owner | deliverable | CREATE | deliverable://browser-release/xuanxue-constructed-candidate.json |  |
| OP-059-007 | WO-059 | xuanxue repository governance owner | deliverable | CREATE | deliverable://browser-release/xuanxue-remote-candidate-readback.json |  |
| OP-059-008 | WO-059 | xuanxue repository governance owner | system | MODIFY | system://git/ADVISION-X/xuanxue-web/refs/heads/codex/browser-greenfield |  |
| OP-060-001 | WO-060 | cross-repo release candidate owner | deliverable | READ | deliverable://browser-release/agent-constructed-tree-manifest.json |  |
| OP-060-002 | WO-060 | cross-repo release candidate owner | deliverable | READ | deliverable://browser-release/agent-constructed-candidate.json |  |
| OP-060-003 | WO-060 | cross-repo release candidate owner | deliverable | READ | deliverable://browser-release/agent-remote-candidate-readback.json |  |
| OP-060-004 | WO-060 | cross-repo release candidate owner | deliverable | READ | deliverable://browser-release/xuanxue-constructed-tree-manifest.json |  |
| OP-060-005 | WO-060 | cross-repo release candidate owner | deliverable | READ | deliverable://browser-release/xuanxue-constructed-candidate.json |  |
| OP-060-006 | WO-060 | cross-repo release candidate owner | deliverable | READ | deliverable://browser-release/xuanxue-remote-candidate-readback.json |  |
| OP-060-007 | WO-060 | cross-repo release candidate owner | deliverable | READ | deliverable://work-orders/WO-030/cross-repo-receipt.json |  |
| OP-060-008 | WO-060 | cross-repo release candidate owner | deliverable | CREATE | deliverable://browser-release/constructed-release-candidate.json |  |

## 14. Action、接口与流程合同矩阵

| Action | 工作单 | actor | 入口/通道 | 授权 | 输入 | 输出 | 状态转换 | receipt | 失败语义 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACT-002 | WO-002 | project authorization owner | deliverable://construction-admission/agent-candidate.json | future explicit construction authorization required | AGENTS.md ; .github/instructions/agent-rules/modules/module-local-browser-session.instructions.md ; docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md ; deliverable://construction-admission/user-browser-scope-authorization.json | deliverable://construction-admission/agent-candidate.json | 只关闭 AGENT SHA/tree 与本轮 Browser 片区授权。 | ACC-002 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-004 | WO-004 | xuanxue repository authority owner | deliverable://construction-admission/xuanxue-candidate.json | future explicit construction authorization required | /Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/browser-authority-proof-contract.ts ; /Users/nexgen/Documents/xuanxue-web/scripts/dynamic-proof/collectors/collector-contracts.ts ; /Users/nexgen/Documents/xuanxue-web/scripts/audit/domains/dynamic-proof/dynamic-agent-receipt-inspection.ts | deliverable://construction-admission/xuanxue-candidate.json | 独立取得干净 xuanxue SHA/tree 与三条精确目标路径；缺失只阻断跨仓和其后发布。 | ACC-004 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-005 | WO-005 | Browser retirement inventory owner | scripts/acceptance/local-browser-plan-harness.self-test.ts | future explicit construction authorization required | git-tree://60cfcf512ecdae0ed27d001d40b6293ae53e5cc6/src/lib/browser ; src/lib/local-runtime/workbench-browser-support.ts ; src/lib/local-runtime/workbench-video-download-support.ts ; src/lib/local-runtime/workbench-ai-gateway-support.ts ; src/lib/local-runtime/workbench-assembly.ts | scripts/acceptance/local-browser-plan-harness.self-test.ts ; scripts/acceptance/local-browser-plan-gates.acceptance.ts ; scripts/acceptance/local-browser-retirement-inventory.acceptance.ts ; scripts/acceptance/local-browser-consumer-registry.acceptance.ts ; scripts/acceptance/local-browser-work-order-receipt.acceptance.ts ; deliverable://browser-retirement/file-classification.json ; deliverable://browser-retirement/consumer-registry.json | 用 AST/symbol 消费图把当前 Browser 文件逐一标为删除，并把每个消费者绑定到 CON-001..CON-011。 | ACC-005 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-006 | WO-006 | project authorization owner | deliverable://construction-admission/browser-canonical-path.json | future explicit construction authorization required | .github/instructions/agent-rules/modules/module-local-browser-session.instructions.md ; docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md | deliverable://construction-admission/browser-canonical-path.json | 只依据 active law 与终态施工图选择 src/lib/browser/profile/browser-process-supervisor.ts；逐文件分类和删除批准由 WO-005/WO-008 完成。 | ACC-006 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-007 | WO-007 | real Chrome evidence owner | deliverable://browser-observation/preconstruction-chrome.json | future explicit construction authorization required | scripts/acceptance/xuanxue-ai-production.real-chrome.ts | deliverable://browser-observation/preconstruction-chrome.json | 记录获准真实路径的 URL、profile/process/policy、DOM 与动作前后终态；未知状态保持 UNKNOWN。 | ACC-007 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-008 | WO-008 | Browser retirement inventory owner | deliverable://construction-admission/browser-demolition.json | future explicit construction authorization required | deliverable://browser-retirement/file-classification.json ; deliverable://browser-retirement/consumer-registry.json ; deliverable://construction-admission/browser-canonical-path.json ; deliverable://browser-observation/preconstruction-chrome.json | deliverable://construction-admission/browser-demolition.json ; deliverable://browser-retirement/cutover-ledger.json | 把每个 CON ID 映射到精确路径、owner、迁移工作单、验收和无旧链恢复。 | ACC-008 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-009 | WO-009 | Browser owner | deliverable://work-orders/WO-009/receipt.json | future explicit construction authorization required | deliverable://construction-admission/browser-demolition.json ; deliverable://browser-retirement/cutover-ledger.json | deliverable://work-orders/WO-009/receipt.json | 删除获准 Browser 根内全部现实现，构造期 authority 明确 ABSENT。 | ACC-009 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-010 | WO-010 | local-runtime owner | deliverable://work-orders/WO-010/receipt.json | future explicit construction authorization required | deliverable://browser-retirement/cutover-ledger.json | deliverable://work-orders/WO-010/receipt.json | 删除两个旧 support surface，不保留别名、wrapper 或 authority 平行文件。 | ACC-010 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-011 | WO-011 | acceptance owner | deliverable://work-orders/WO-011/receipt.json | future explicit construction authorization required | deliverable://browser-retirement/cutover-ledger.json | deliverable://work-orders/WO-011/receipt.json | 删除当前 legacy local-browser acceptance，未来验收只按终态合同重建。 | ACC-011 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-012 | WO-012 | Browser protocol owner | src/lib/browser/protocol/browser-protocol.schema.json | future explicit construction authorization required | deliverable://work-orders/WO-009/receipt.json ; deliverable://work-orders/WO-010/receipt.json ; deliverable://work-orders/WO-011/receipt.json | src/lib/browser/protocol/browser-protocol.schema.json ; src/lib/browser/protocol/browser-authority-certificate.schema.json ; src/lib/browser/protocol/browser-authority-liveness-lease.schema.json ; src/lib/browser/protocol/browser-profile-enrollment.schema.json ; src/lib/browser/protocol/browser-file-artifact-grant.schema.json ; src/lib/browser/protocol/browser-capabilities.json ; src/lib/browser/protocol/browser-errors.json ; src/lib/browser/protocol/browser-protocol-schema.acceptance.ts | 建立消息、framing、budget、artifact grant 与 registry hash 的单一源。 | ACC-012 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-013 | WO-013 | Browser protocol codegen owner | src/lib/browser/protocol/generated/browser-protocol.generated.ts | future explicit construction authorization required | src/lib/browser/protocol/browser-protocol.schema.json ; src/lib/browser/protocol/browser-protocol-schema.acceptance.ts | src/lib/browser/protocol/generated/browser-protocol.generated.ts ; src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs ; src/lib/browser/protocol/browser-protocol-codegen.acceptance.ts | 从唯一 schema 生成 TypeScript 与 Rust 合同并证明两端 hash 相同。 | ACC-013 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-015 | WO-015 | MV3 Extension owner | src/lib/browser/chrome-extension/manifest.json | future explicit construction authorization required | src/lib/browser/protocol/generated/browser-protocol.generated.ts ; src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs | src/lib/browser/chrome-extension/manifest.json ; src/lib/browser/chrome-extension/service-worker.ts ; src/lib/browser/chrome-extension/native-port-actor.ts ; src/lib/browser/chrome-extension/command-registry.ts ; src/lib/browser/chrome-extension/command-permit-validator.ts ; src/lib/browser/chrome-extension/debugger-runtime.ts ; src/lib/browser/chrome-extension/exact-target-runtime.ts ; src/lib/browser/chrome-extension/dom-intent-runtime.ts ; src/lib/browser/chrome-extension/artifact-stream.ts ; src/lib/browser/chrome-extension/authenticated-heartbeat.ts ; src/lib/browser/chrome-extension/extension.acceptance.ts | 只建设 NativePortActor、CommandRegistry 与 chrome.debugger 适配。 | ACC-015 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-016 | WO-016 | Browser transport owner | src/lib/browser/transport/raw-controller-host-channel.ts | future explicit construction authorization required | src/lib/browser/native-messaging-host/Cargo.toml ; src/lib/browser/native-messaging-host/crates/host/src/main.rs ; src/lib/browser/chrome-extension/manifest.json ; src/lib/browser/chrome-extension/service-worker.ts | src/lib/browser/transport/raw-controller-host-channel.ts ; src/lib/browser/transport/authenticated-controller-host-channel.ts ; src/lib/browser/transport/transport-event.ts ; src/lib/browser/transport/transport-reducer.ts ; src/lib/browser/transport/transport-actor.ts ; src/lib/browser/transport/transport-authenticator.ts ; src/lib/browser/transport/transport-transcript.ts ; src/lib/browser/transport/authenticated-heartbeat.ts ; src/lib/browser/transport/browser-native-framing.ts ; src/lib/browser/transport/browser-transport.acceptance.ts | 只拥有 transport event、状态归约、fresh-chain retry 与 stale event 丢弃。 | ACC-016 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-017 | WO-017 | Browser authority issuer owner | src/lib/browser/infrastructure/browser-authority-lease.ts | future explicit construction authorization required | src/lib/browser/transport/transport-event.ts ; src/lib/browser/transport/transport-reducer.ts | src/lib/browser/infrastructure/browser-authority-lease.ts ; src/lib/browser/infrastructure/browser-authority-issuer.ts ; src/lib/browser/infrastructure/browser-authority-certificate.ts ; src/lib/browser/infrastructure/browser-authority-liveness-lease.ts ; src/lib/browser/infrastructure/browser-control-state.ts ; src/lib/browser/infrastructure/browser-authority-issuer.acceptance.ts | 只在 authenticated channel、profile/process/policy 与 liveness 全成立时产生 PRESENT authority。 | ACC-017 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-018 | WO-018 | Browser broker owner | src/lib/browser/infrastructure/browser-authority-broker.ts | future explicit construction authorization required | src/lib/browser/infrastructure/browser-authority-certificate.ts ; src/lib/browser/infrastructure/browser-authority-issuer.ts | src/lib/browser/infrastructure/browser-authority-broker.ts ; src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts ; src/lib/browser/browser-authority-api.ts | 唯一业务入口只消费当前 execution binding 并返回 authority lease 或 typed unavailable。 | ACC-018 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-019 | WO-019 | Browser target lease owner | src/lib/browser/exact-target/browser-target-ref.ts | future explicit construction authorization required | src/lib/browser/infrastructure/browser-authority-broker.ts ; src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts | src/lib/browser/exact-target/browser-target-ref.ts ; src/lib/browser/exact-target/browser-document-ref.ts ; src/lib/browser/exact-target/browser-target-lease.ts ; src/lib/browser/exact-target/browser-target-lease-manager.ts ; src/lib/browser/exact-target/browser-target-lease.acceptance.ts | 只从当前 authority lease 取得唯一 target/document lease，epoch 变化立即失效。 | ACC-019 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-020 | WO-020 | Browser command owner | src/lib/browser/transport/command-permit.ts | future explicit construction authorization required | src/lib/browser/exact-target/browser-target-lease.ts ; src/lib/browser/exact-target/browser-target-lease-manager.ts | src/lib/browser/transport/command-permit.ts ; src/lib/browser/transport/reply-channel-token.ts ; src/lib/browser/transport/browser-command-admission-budget.ts ; src/lib/browser/exact-target/browser-command-actor.ts ; src/lib/browser/exact-target/browser-mutation-intent-journal.ts ; src/lib/browser/exact-target/browser-dom-intent.ts ; src/lib/browser/exact-target/browser-file-artifact-grant.ts ; src/lib/browser/exact-target/browser-artifact-stream.ts ; src/lib/browser/exact-target/browser-command.acceptance.ts | 只执行 registry-owned declarative commands；mutation 不自动重放，歧义进入 OUTCOME_UNKNOWN。 | ACC-020 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-021 | WO-021 | Browser profile owner | src/lib/browser/profile/browser-profile-enrollment.ts | future explicit construction authorization required | src/lib/browser/protocol/browser-profile-enrollment.schema.json ; src/lib/browser/native-messaging-host/crates/browserctl/src/enroll_profile.rs ; deliverable://construction-admission/browser-canonical-path.json | src/lib/browser/profile/browser-profile-enrollment.ts ; src/lib/browser/profile/dedicated-profile-policy.ts ; src/lib/browser/profile/browser-profile-state.ts ; src/lib/browser/profile/browser-profile-config.ts ; src/lib/browser/profile/browser-profile-enrollment-receipt.ts ; src/lib/browser/profile/browser-profile-process-attestation.ts ; src/lib/browser/profile/managed-policy-readback.ts ; src/lib/browser/profile/browser-process-supervisor.ts ; src/lib/browser/profile/browser-profile.acceptance.ts | 建设完整 profile 终态：config、state、dedicated policy、enrollment、receipt、process attestation、managed policy readback 与唯一 BrowserProcessSupervisor；enrollment mutation 仍只由 browserctl 执行。 | ACC-021 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-024 | WO-024 | dom-automation owner | src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts | future explicit construction authorization required | src/lib/browser/exact-target/browser-command-actor.ts ; src/lib/browser/transport/command-permit.ts ; src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts ; deliverable://browser-observation/preconstruction-chrome.json | src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts | 六个原子动作只消费当前 BrowserTargetLease 与命令 permit。 | ACC-024 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-025 | WO-025 | ai-input-gateway owner | src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts | future explicit construction authorization required | src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts ; src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts | src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts | 每次 provider execution/checkpoint 重新取得并释放 authority/target；删除 BrowserTargetSession fixture 合同。 | ACC-025 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-026 | WO-026 | video-download owner | src/capabilities/video-download/acceptance/browser-authority.acceptance.ts | future explicit construction authorization required | src/lib/browser/exact-target/browser-command-actor.ts ; src/lib/browser/transport/command-permit.ts ; src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts | src/capabilities/video-download/acceptance/browser-authority.acceptance.ts | 来源页探测只使用命名、有界 observation capability，不允许 evaluate 或脚本 fallback。 | ACC-026 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-027 | WO-027 | amazon-invoice-upload owner | src/plugins/amazon-invoice-upload/amazon-invoice-upload-browser-authority.acceptance.ts | future explicit construction authorization required | src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts ; src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts | src/plugins/amazon-invoice-upload/amazon-invoice-upload-browser-authority.acceptance.ts | 只改 Browser 边界，保留业务顺序和人工最终门；每个 mutation 有 journal 与 owner outcome resolution。 | ACC-027 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-028 | WO-028 | amazon-product-mining owner | src/plugins/amazon-product-mining/amazon-product-mining-browser-authority.acceptance.ts | future explicit construction authorization required | src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts ; src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts ; src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts | src/plugins/amazon-product-mining/amazon-product-mining-browser-authority.acceptance.ts | 每阶段使用当前 execution/authority/target，checkpoint 后不缓存旧 lease。 | ACC-028 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-029 | WO-029 | xuanxue-ai-production owner | src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts | future explicit construction authorization required | src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts ; src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts | src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts | 在唯一 AgentRuntimeReceiptV2 内记录有序 authority windows，窗口间零动作且无未裁决 mutation。 | ACC-029 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-030 | WO-030 | xuanxue dynamic-proof owner | /Users/nexgen/Documents/xuanxue-web/tests/dynamic-proof/browser-authority-window-contract.test.ts | future explicit construction authorization required | deliverable://construction-admission/xuanxue-candidate.json ; src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts | /Users/nexgen/Documents/xuanxue-web/tests/dynamic-proof/browser-authority-window-contract.test.ts ; deliverable://work-orders/WO-030/cross-repo-receipt.json | 只在 DG-003 干净候选上修改三条冻结路径，不建立第二 election、receipt 或 verdict owner。 | ACC-030 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-031 | WO-031 | local-browser audit owner | scripts/audit/domains/local-browser-session/local-browser-26-checks.acceptance.ts | future explicit construction authorization required | .github/instructions/agent-rules/modules/module-local-browser-session.instructions.md ; scripts/audit/domains/local-browser-session/manifest.json ; scripts/audit/domains/local-browser-session/inspector.ts | scripts/audit/domains/local-browser-session/local-browser-26-checks.acceptance.ts ; deliverable://work-orders/WO-031/26-check-receipt.json | 从当前 active law SHA 导出精确 26 个 machine-blocking checkId，并与 manifest/inspector 的独立 binding 集合做全等比较。 | ACC-031 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-032 | WO-032 | acceptance and audit test owner | scripts/acceptance/local-browser-terminal-contract.acceptance.ts | future explicit construction authorization required | scripts/audit/domains/local-browser-session/manifest.json ; scripts/audit/domains/local-browser-session/inspector.ts ; src/lib/browser/protocol/browser-errors.json ; src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts | scripts/acceptance/local-browser-terminal-contract.acceptance.ts ; scripts/acceptance/local-browser-26-mutants.acceptance.ts ; scripts/acceptance/local-browser-property-model.acceptance.ts | 26 个检查逐项拥有 negative/property/model/mutant 证据；确定性合同验证两项合法 health、精确 error taxonomy、11 个零指标、4 项 SLO 和无界队列/缓存/流为零。 | ACC-032 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-046 | WO-046 | browserctl owner | src/lib/browser/native-messaging-host/crates/browserctl/Cargo.toml | future explicit construction authorization required | src/lib/browser/protocol/browser-profile-enrollment.schema.json ; src/lib/browser/protocol/browser-protocol.schema.json | src/lib/browser/native-messaging-host/crates/browserctl/Cargo.toml ; src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/install.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/verify.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/doctor.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/repair.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/enroll_profile.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/activate.rs ; src/lib/browser/native-messaging-host/crates/browserctl/src/rollback.rs ; src/lib/browser/native-messaging-host/crates/launcher/Cargo.toml ; src/lib/browser/native-messaging-host/crates/launcher/src/main.rs ; src/lib/browser/native-messaging-host/crates/platform-macos/Cargo.toml ; src/lib/browser/native-messaging-host/crates/platform-macos/src/registration.rs ; src/lib/browser/native-messaging-host/manifests/com.grasseye.browser_host.json ; src/lib/browser/native-messaging-host/crates/browserctl/tests/browserctl.acceptance.rs | browserctl 是 install/verify/doctor/repair/enroll-profile/activate/rollback 唯一 owner；launcher、platform-macos 与 manifests 只服务该控制面。 | ACC-046 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-047 | WO-047 | Browser infrastructure supervisor owner | src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts | future explicit construction authorization required | src/lib/browser/transport/transport-actor.ts ; src/lib/browser/profile/browser-process-supervisor.ts ; src/lib/browser/protocol/browser-errors.json | src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts ; src/lib/browser/infrastructure/browser-owner-lock.ts ; src/lib/browser/infrastructure/browser-worker-membership.ts ; src/lib/browser/infrastructure/browser-worker-handover.ts ; src/lib/browser/infrastructure/browser-retry-policy.ts ; src/lib/browser/infrastructure/browser-repair.ts ; src/lib/browser/infrastructure/browser-infrastructure-supervisor.acceptance.ts | 唯一 supervisor 在 bind 前取得 OwnerLock，并拥有 worker membership、handover、retry、repair、两项合法 health 和唯一 error/metrics producer；不拥有业务流程。 | ACC-047 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-035A | WO-035 | AGENT repository governance owner | deliverable://construction-admission/agent-repository-governance-policy.json | future explicit construction authorization required | scripts/audit/domains/local-browser-session/manifest.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/agent-repository-governance-policy.json | deliverable://browser-release/agent-branch-protection-prestate.json | GET and sign the exact pre-state; verify exact strict/contexts from the repository governance owner's signed policy and bind candidate/repo/branch. | ACC-035A | Do not PATCH; emit FAIL. |
| ACT-035B | WO-035 | AGENT repository governance owner | gh api --method PATCH repos/ADVISION-X/AGENT/branches/main/protection/required_status_checks | future explicit construction authorization required | scripts/audit/domains/local-browser-session/manifest.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/agent-repository-governance-policy.json | deliverable://browser-release/branch-protection-readback.json | PATCH exact desired strict/contexts, GET the same endpoint, and sign exact post-state readback. | ACC-035B | Invoke ACT-035C before reporting failure. |
| ACT-035C | WO-035 | AGENT repository governance owner | gh api --method PATCH repos/ADVISION-X/AGENT/branches/main/protection/required_status_checks | future explicit construction authorization required | scripts/audit/domains/local-browser-session/manifest.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/agent-repository-governance-policy.json | deliverable://browser-release/agent-branch-protection-recovery-receipt.json | On ACT-B failure, PATCH the exact signed pre-state, GET again, and record RESTORED or RECOVERY_FAILED; on ACT-B success record NOT_REQUIRED. | ACC-035C | RECOVERY_FAILED is terminal and blocks release. |
| ACT-048A | WO-048 | xuanxue repository governance owner | deliverable://construction-admission/xuanxue-repository-governance-policy.json | future explicit construction authorization required | deliverable://construction-admission/xuanxue-candidate.json ; deliverable://work-orders/WO-030/cross-repo-receipt.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/xuanxue-repository-governance-policy.json | deliverable://browser-release/xuanxue-branch-protection-prestate.json | GET and sign the exact pre-state; verify exact strict/contexts from the repository governance owner's signed policy and bind candidate/repo/branch. | ACC-048A | Do not PATCH; emit FAIL. |
| ACT-048B | WO-048 | xuanxue repository governance owner | gh api --method PATCH repos/ADVISION-X/xuanxue-web/branches/main/protection/required_status_checks | future explicit construction authorization required | deliverable://construction-admission/xuanxue-candidate.json ; deliverable://work-orders/WO-030/cross-repo-receipt.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/xuanxue-repository-governance-policy.json | deliverable://browser-release/xuanxue-branch-protection-readback.json | PATCH exact desired strict/contexts, GET the same endpoint, and sign exact post-state readback. | ACC-048B | Invoke ACT-048C before reporting failure. |
| ACT-048C | WO-048 | xuanxue repository governance owner | gh api --method PATCH repos/ADVISION-X/xuanxue-web/branches/main/protection/required_status_checks | future explicit construction authorization required | deliverable://construction-admission/xuanxue-candidate.json ; deliverable://work-orders/WO-030/cross-repo-receipt.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/xuanxue-repository-governance-policy.json | deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json | On ACT-B failure, PATCH the exact signed pre-state, GET again, and record RESTORED or RECOVERY_FAILED; on ACT-B success record NOT_REQUIRED. | ACC-048C | RECOVERY_FAILED is terminal and blocks release. |
| ACT-049 | WO-049 | provider journey authorization owner | deliverable://construction-admission/provider-journey-authorization.json | future explicit construction authorization required | deliverable://construction-admission/operator-provider-journey-request.json | deliverable://construction-admission/provider-journey-authorization.json | 由 operator 明确账户、journey 范围、敏感动作边界、人工门、8 小时窗口和中止权限；缺失只阻断业务证据及发布链。 | ACC-049 | Emit a candidate-bound FAIL receipt and stop only the work orders that depend on this result. |
| ACT-003 | WO-003 | release operations owner | deliverable://construction-admission/external-operations.json | future explicit construction authorization required | docs/法案辅助文件/GrassEye 本地真实Chrome会话与登录态持久化施工图.md | deliverable://construction-admission/external-operations.json | 只冻结 CWS、签名/公证、managed profile、两台独立 HA worker 与 release key custody；不决定任何仓库 required-check policy。 | ACC-003 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-014 | WO-014 | Native Host owner | src/lib/browser/native-messaging-host/crates/host/Cargo.toml | future explicit construction authorization required | src/lib/browser/protocol/generated/browser-protocol.generated.ts ; src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs | src/lib/browser/native-messaging-host/Cargo.toml ; src/lib/browser/native-messaging-host/crates/host/Cargo.toml ; src/lib/browser/native-messaging-host/crates/host/src/main.rs ; src/lib/browser/native-messaging-host/crates/host/src/browser-native-framing.rs ; src/lib/browser/native-messaging-host/crates/host/src/raw-channel.rs ; src/lib/browser/native-messaging-host/crates/host/src/authenticated-channel.rs ; src/lib/browser/native-messaging-host/crates/host/src/transcript.rs ; src/lib/browser/native-messaging-host/crates/host/src/artifact-stream.rs ; src/lib/browser/native-messaging-host/crates/host/tests/native-host.acceptance.rs ; src/lib/browser/native-messaging-host/Cargo.lock ; src/lib/browser/native-messaging-host/crates/host/fuzz/Cargo.toml ; src/lib/browser/native-messaging-host/crates/host/fuzz/fuzz_targets/native_framing.rs ; src/lib/browser/native-messaging-host/crates/host/fuzz/corpus/native_framing/seed.bin | 只建设 framing、认证握手、单 Port 与有界 I/O 的 Host。 | ACC-014 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-022 | WO-022 | Browser release identity owner | src/lib/browser/release/release-identity.acceptance.ts | future explicit construction authorization required | src/lib/browser/protocol/browser-protocol.schema.json ; src/lib/browser/protocol/generated/browser-protocol.generated.ts ; src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs | src/lib/browser/release/browser-artifact-set.schema.json ; src/lib/browser/release/browser-activation-tuple.schema.json ; src/lib/browser/release/browser-release-proof.schema.json ; src/lib/browser/release/browser-release-security-policy.schema.json ; src/lib/browser/release/browser-rollback-receipt.schema.json ; src/lib/browser/release/browser-build-inputs.schema.json ; src/lib/browser/release/browser-sbom.schema.json ; src/lib/browser/release/browser-provenance.schema.json ; src/lib/browser/release/pinned-browser-toolchain.json ; src/lib/browser/release/active-activation.json ; src/lib/browser/release/release-identity.acceptance.ts ; src/lib/browser/release/browser-build.config.json ; src/lib/browser/release/browser-previous-activation-snapshot.schema.json | 只建立 ArtifactSet、ActivationTuple、ReleaseSecurityPolicy、ProofManifest、rollback、SBOM、provenance 与 build-input schemas，并初始化空 ABSENT slot；不签发任何候选身份。 | ACC-022 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-023 | WO-023 | local-runtime owner | src/lib/local-runtime/workbench-browser-authority.acceptance.ts | future explicit construction authorization required | src/lib/browser/infrastructure/browser-authority-broker.ts ; src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts ; src/lib/browser/exact-target/browser-target-lease.ts ; src/lib/browser/exact-target/browser-target-lease-manager.ts ; src/lib/browser/exact-target/browser-command-actor.ts ; src/lib/browser/transport/command-permit.ts ; src/lib/browser/profile/browser-profile-enrollment.ts ; src/lib/browser/profile/browser-process-supervisor.ts | src/lib/local-runtime/workbench-browser-authority-support.ts ; src/lib/local-runtime/workbench-browser-authority.acceptance.ts | Local Runtime 只注入 Broker；assembly 不领取或缓存 target lease；已退休的 workbench-browser-support.ts 与 workbench-video-download-support.ts 永久不存在。 | ACC-023 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-041 | WO-041 | independent read-only audit owner | deliverable://browser-release/independent-audit.json | future explicit construction authorization required | deliverable://work-orders/WO-031/26-check-receipt.json ; deliverable://work-orders/WO-030/cross-repo-receipt.json ; deliverable://browser-release/artifact-set.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/real-chrome-matrix.json ; deliverable://browser-release/business-workday-receipt.json ; deliverable://browser-release/branch-protection-readback.json ; deliverable://browser-release/ha-handover.json ; deliverable://browser-release/soak-24h.json ; deliverable://browser-release/soak-168h.json ; deliverable://browser-release/ci-full-receipt.json ; deliverable://browser-release/xuanxue-branch-protection-readback.json ; deliverable://browser-release/browser-build-input-lock.json ; deliverable://browser-release/sbom.spdx.json ; deliverable://browser-release/provenance.json ; deliverable://browser-release/installed-artifact-readback.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-release/agent-branch-protection-prestate.json ; deliverable://browser-release/agent-branch-protection-recovery-receipt.json ; deliverable://browser-release/xuanxue-branch-protection-prestate.json ; deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://construction-admission/agent-repository-governance-policy.json ; deliverable://construction-admission/xuanxue-repository-governance-policy.json | deliverable://browser-release/independent-audit.json | 独立审计者绑定同一候选和 artifact，审查法案执法面、旧路径零可达与所有 proof receipts。 | ACC-041 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-056 | WO-056 | AGENT repository governance owner | deliverable://construction-admission/agent-repository-governance-policy.json | future explicit construction authorization required | deliverable://construction-admission/agent-repository-governance-request.json | deliverable://construction-admission/agent-repository-governance-policy.json | 签发 ADVISION-X/AGENT main 的 repo、branch、strict、exact contexts、construction branch commit/push 权限、expected remote ref、保护规则变更权限与恢复权限。 | ACC-056 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-057 | WO-057 | xuanxue repository governance owner | deliverable://construction-admission/xuanxue-repository-governance-policy.json | future explicit construction authorization required | deliverable://construction-admission/xuanxue-repository-governance-request.json | deliverable://construction-admission/xuanxue-repository-governance-policy.json | 签发 ADVISION-X/xuanxue-web main 的 repo、branch、strict、exact contexts、construction branch commit/push 权限、expected remote ref、保护规则变更权限与恢复权限。 | ACC-057 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-058 | WO-058 | AGENT repository governance owner | git push --force-with-lease=<expected-old-ref> origin HEAD:refs/heads/codex/browser-greenfield | future explicit construction authorization required | deliverable://construction-admission/agent-repository-governance-policy.json ; system://git/ADVISION-X/AGENT/worktree-and-index ; package.json ; package-lock.json ; tsconfig.json | deliverable://browser-release/agent-constructed-tree-manifest.json ; deliverable://browser-release/agent-build-input-manifest.json ; deliverable://browser-release/agent-constructed-source-bundle.tar.zst ; deliverable://browser-release/agent-constructed-candidate.json ; deliverable://browser-release/agent-remote-candidate-readback.json | 在所有 AGENT 源码、audit 与 acceptance 建设完成后，生成 content-addressed tree/build-input manifest 与 source bundle；在获准 construction branch 上 commit/push，并以 git ls-remote 读回相同 SHA。 | ACC-058 | Do not build or change main protection; restore neither old Browser code nor an unverified remote ref. |
| ACT-059 | WO-059 | xuanxue repository governance owner | git push --force-with-lease=<expected-old-ref> origin HEAD:refs/heads/codex/browser-greenfield | future explicit construction authorization required | deliverable://construction-admission/xuanxue-repository-governance-policy.json ; system://git/ADVISION-X/xuanxue-web/worktree-and-index ; deliverable://work-orders/WO-030/cross-repo-receipt.json | deliverable://browser-release/xuanxue-constructed-tree-manifest.json ; deliverable://browser-release/xuanxue-constructed-source-bundle.tar.zst ; deliverable://browser-release/xuanxue-constructed-candidate.json ; deliverable://browser-release/xuanxue-remote-candidate-readback.json | 在 xuanxue 三条授权路径和跨仓验收完成后，生成 content-addressed tree/source bundle；在获准 construction branch 上 commit/push，并以 git ls-remote 读回相同 SHA。 | ACC-059 | Do not build, mutate main protection or produce Dynamic Proof from an unverified candidate. |
| ACT-060 | WO-060 | cross-repo release candidate owner | deliverable://browser-release/constructed-release-candidate.json | future explicit construction authorization required | deliverable://browser-release/agent-constructed-tree-manifest.json ; deliverable://browser-release/agent-constructed-candidate.json ; deliverable://browser-release/agent-remote-candidate-readback.json ; deliverable://browser-release/xuanxue-constructed-tree-manifest.json ; deliverable://browser-release/xuanxue-constructed-candidate.json ; deliverable://browser-release/xuanxue-remote-candidate-readback.json ; deliverable://work-orders/WO-030/cross-repo-receipt.json | deliverable://browser-release/constructed-release-candidate.json | 把施工后 AGENT 与 xuanxue 的 clean tree、commit SHA、remote SHA、content manifests 与 cross-repo contract hash 组合成唯一 constructed-release-candidate identity。 | ACC-060 | Invalidate both constructed candidates; no ArtifactSet, CI, branch mutation, Chrome, HA, provider, proof or activation may proceed. |
| ACT-033 | WO-033 | release build owner | src/lib/browser/release/build-artifacts.mjs | future explicit construction authorization required | deliverable://construction-admission/external-operations.json ; deliverable://browser-release/constructed-release-candidate.json ; deliverable://browser-release/agent-constructed-tree-manifest.json ; deliverable://browser-release/agent-build-input-manifest.json ; deliverable://browser-release/agent-constructed-source-bundle.tar.zst ; deliverable://browser-release/xuanxue-constructed-tree-manifest.json ; deliverable://browser-release/xuanxue-constructed-source-bundle.tar.zst | artifact://browser-release/controller/controller-bundle.tgz ; artifact://browser-release/native-host/grasseye-browser-host ; artifact://browser-release/browserctl/browserctl ; artifact://browser-release/launcher/grasseye-browser-launcher ; artifact://browser-release/platform-macos/libgrasseye-platform-macos.a ; artifact://browser-release/extension/grasseye-browser-extension.verified.crx ; artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json ; artifact://browser-release/checksums/SHA256SUMS ; artifact://browser-release/signatures/SHA256SUMS.sig ; deliverable://browser-release/browser-build-input-lock.json ; deliverable://browser-release/artifact-set.json ; deliverable://browser-release/builder-a-receipt.json ; deliverable://browser-release/builder-b-receipt.json ; deliverable://browser-release/sbom.spdx.json ; deliverable://browser-release/provenance.json ; deliverable://browser-release/installed-artifact-readback.json ; src/lib/browser/release/build-artifacts.mjs ; src/lib/browser/release/verify-artifacts.mjs | 只从 WO-060 冻结的 source bundles/tree manifests 与精确 package/tsconfig/build config 输入构建 Controller、Host、browserctl、launcher、platform adapter、Verified CRX、Native Messaging manifest、checksums/signature 九个实体；ArtifactSet 仅索引这些 content-addressed entities。 | ACC-033 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-039 | WO-039 | release activation owner | src/lib/browser/native-messaging-host/target/release/browserctl activate --expected-current <hash> --new <hash> --proof <hash> | future explicit construction authorization required | deliverable://browser-release/BrowserReleaseProofManifestV1.json ; deliverable://browser-release/constructed-release-candidate.json | deliverable://browser-release/activation-receipt.json ; deliverable://browser-release/previous-activation-snapshot.json | 只消费已签 proof manifest，先签发 PreviousActivationSnapshot=SIGNED_ABSENT 或 SIGNED_PRESENT(tuple)，再 CAS 切换一个 active tuple。 | ACC-039 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-052 | WO-052 | browserctl owner | src/lib/browser/native-messaging-host/target/release/browserctl recover --snapshot deliverable://browser-release/previous-activation-snapshot.json | future explicit construction authorization required | deliverable://browser-release/recovery-authority-revoke.json ; deliverable://browser-release/activation-receipt.json ; deliverable://browser-release/previous-activation-snapshot.json ; deliverable://browser-release/BrowserReleaseProofManifestV1.json ; src/lib/browser/native-messaging-host/crates/browserctl/src/rollback.rs ; artifact://browser-release/controller/controller-bundle.tgz ; artifact://browser-release/native-host/grasseye-browser-host ; artifact://browser-release/browserctl/browserctl ; artifact://browser-release/launcher/grasseye-browser-launcher ; artifact://browser-release/platform-macos/libgrasseye-platform-macos.a ; artifact://browser-release/extension/grasseye-browser-extension.verified.crx ; artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json ; artifact://browser-release/checksums/SHA256SUMS ; artifact://browser-release/signatures/SHA256SUMS.sig ; deliverable://browser-release/constructed-release-candidate.json | deliverable://browser-release/recovery-browserctl-rollback.json | 若 snapshot 为 SIGNED_PRESENT，browserctl 安装回退到 previous tuple；若为 SIGNED_ABSENT，browserctl 卸载/隔离失败新 artifact 并证明 profile/process/policy/tree 无可用 Browser authority。 | ACC-052 | Emit RECOVERY_FAILED_INSTALLATION and stop; authority remains ABSENT. |
| ACT-053 | WO-053 | release activation owner | system://browser-release/active-activation-slot#rollback-present-or-absent | future explicit construction authorization required | deliverable://browser-release/recovery-browserctl-rollback.json ; deliverable://browser-release/activation-receipt.json ; deliverable://browser-release/previous-activation-snapshot.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/constructed-release-candidate.json | deliverable://browser-release/recovery-active-slot-cas.json | 仅由 activation owner 把 active slot 从失败新 tuple CAS 到 SIGNED_PRESENT 的 previous tuple，或 CAS 到 SIGNED_ABSENT。 | ACC-053 | Emit RECOVERY_FAILED_ACTIVE_SLOT and stop; authority remains ABSENT and consumers remain blocked. |
| ACT-055 | WO-055 | production recovery readback owner | deliverable://browser-release/post-rollback-readback.json | future explicit construction authorization required | deliverable://browser-release/recovery-authority-revoke.json ; deliverable://browser-release/recovery-browserctl-rollback.json ; deliverable://browser-release/recovery-active-slot-cas.json ; deliverable://browser-release/recovery-consumer-blocked.json ; deliverable://browser-release/previous-activation-snapshot.json ; deliverable://browser-release/constructed-release-candidate.json | deliverable://browser-release/post-rollback-readback.json ; deliverable://browser-release/new-attempt-admission.json | 独立验证 authority ABSENT、SIGNED_PRESENT 时 previous tuple 已安装且 active，或 SIGNED_ABSENT 时无可用 Browser artifact 且 slot 为 ABSENT；两分支均要求 CON-001..CON-011 BLOCKED。 | ACC-055 | Emit RECOVERY_TERMINAL_BLOCKED; retain authority ABSENT and all consumers BLOCKED. |
| ACT-034 | WO-034 | real Chrome evidence owner | scripts/acceptance/local-browser-real-chrome-terminal.acceptance.ts | future explicit construction authorization required | deliverable://browser-release/artifact-set.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-observation/preconstruction-chrome.json ; artifact://browser-release/controller/controller-bundle.tgz ; artifact://browser-release/native-host/grasseye-browser-host ; artifact://browser-release/browserctl/browserctl ; artifact://browser-release/launcher/grasseye-browser-launcher ; artifact://browser-release/platform-macos/libgrasseye-platform-macos.a ; artifact://browser-release/extension/grasseye-browser-extension.verified.crx ; artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json ; artifact://browser-release/checksums/SHA256SUMS ; artifact://browser-release/signatures/SHA256SUMS.sig ; deliverable://browser-release/constructed-release-candidate.json | scripts/acceptance/local-browser-real-chrome-terminal.acceptance.ts ; deliverable://browser-release/real-chrome-matrix.json | 在 Stable 与 CfT 上对同一 ArtifactSet、ActivationTuple candidate 与 ReleaseSecurityPolicy 完成 profile/process/policy、auth、target、file、stream、update 与 rollback 正反终态。 | ACC-034 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-036 | WO-036 | HA operations owner | deliverable://browser-release/ha-handover.json | future explicit construction authorization required | deliverable://construction-admission/external-operations.json ; deliverable://construction-admission/xuanxue-candidate.json ; deliverable://browser-release/real-chrome-matrix.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-release/constructed-release-candidate.json | deliverable://browser-release/ha-handover.json | 一主一热备只消费 xuanxue 数据库 fence，完成 revoke/checkpoint/fresh-window 交接并证明 dual_active、stale-event、old-completion-to-new-port、liveness-expired-command 四项指标均为零。 | ACC-036 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-037 | WO-037 | soak evidence owner | deliverable://browser-release/soak-24h.json | future explicit construction authorization required | deliverable://browser-release/ha-handover.json ; deliverable://browser-release/artifact-set.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-release/constructed-release-candidate.json | deliverable://browser-release/soak-24h.json ; deliverable://browser-release/soak-168h.json | 对同一 ArtifactSet 和 HA 拓扑完成法定时长；11 个零指标、4 项 SLO 与无界队列/缓存/流必须全部达标，任何 identity 漂移或指标越界即整段作废。 | ACC-037 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-038 | WO-038 | release proof owner | deliverable://browser-release/BrowserReleaseProofManifestV1.json | future explicit construction authorization required | deliverable://work-orders/WO-031/26-check-receipt.json ; deliverable://work-orders/WO-030/cross-repo-receipt.json ; deliverable://browser-release/artifact-set.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/real-chrome-matrix.json ; deliverable://browser-release/business-workday-receipt.json ; deliverable://browser-release/branch-protection-readback.json ; deliverable://browser-release/ha-handover.json ; deliverable://browser-release/soak-24h.json ; deliverable://browser-release/soak-168h.json ; deliverable://browser-release/ci-full-receipt.json ; deliverable://browser-release/independent-audit.json ; scripts/audit/generated/audit-plan.generated.json ; deliverable://browser-release/xuanxue-branch-protection-readback.json ; deliverable://browser-release/browser-build-input-lock.json ; deliverable://browser-release/sbom.spdx.json ; deliverable://browser-release/provenance.json ; deliverable://browser-release/installed-artifact-readback.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-release/constructed-release-candidate.json | deliverable://browser-release/BrowserReleaseProofManifestV1.json | 首次创建 proof manifest，绑定同一 candidate、ArtifactSet、ActivationTuple 候选、安全策略、26 checks、Chrome、HA、soak 与 branch readback。 | ACC-038 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-040 | WO-040 | production readback owner | deliverable://browser-release/post-activation-readback.json | future explicit construction authorization required | deliverable://browser-release/activation-receipt.json ; deliverable://browser-release/BrowserReleaseProofManifestV1.json ; deliverable://browser-release/constructed-release-candidate.json | deliverable://browser-release/post-activation-readback.json | 只读安装、policy、process、extension、Host、authority slot 与业务 receipt；输出 PASS readback 或 POST_ACTIVATION_MISMATCH，不隐式取得 revoke、rollback、CAS 或 consumer 写权。 | ACC-040 | Emit POST_ACTIVATION_MISMATCH and hand off only to WO-051; do not mutate authority, installation, activation slot or consumer admission in WO-040. |
| ACT-042 | WO-042 | release approval owner | deliverable://browser-release/final-release-approval.json | future explicit construction authorization required | deliverable://browser-release/BrowserReleaseProofManifestV1.json ; deliverable://browser-release/activation-receipt.json ; deliverable://browser-release/post-activation-readback.json ; deliverable://browser-release/independent-audit.json ; deliverable://browser-release/ci-full-receipt.json ; deliverable://browser-release/constructed-release-candidate.json | deliverable://browser-release/final-release-approval.json | 只验证并消费 WO-044 的 candidate-bound ci-full-receipt 及全部 PASS receipts，签发 release approval；不运行 CI，不修改源码、ProofManifest、保护规则或 activation。 | ACC-042 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-043 | WO-043 | business workday evidence owner | scripts/acceptance/local-browser-business-workday-terminal.acceptance.ts | future explicit construction authorization required | deliverable://browser-release/artifact-set.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/real-chrome-matrix.json ; deliverable://construction-admission/provider-journey-authorization.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-release/constructed-release-candidate.json | scripts/acceptance/local-browser-business-workday-terminal.acceptance.ts ; deliverable://browser-release/business-workday-receipt.json | 在同一 candidate、ArtifactSet、ActivationTuple candidate、ReleaseSecurityPolicy 与 release identity signature 下完成获准 provider journeys 和 8 小时业务基线，证明零 focus theft、零 keyboard interruption、零 wrong-target、有限 pause/cancel/takeover 与零 mutation replay。 | ACC-043 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-044 | WO-044 | CI-FULL compliance self-check owner | npm run ci:full | future explicit construction authorization required | scripts/audit/ci-full.ts ; deliverable://browser-release/business-workday-receipt.json ; deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/release-identity-signature.json ; deliverable://browser-release/constructed-release-candidate.json | deliverable://browser-release/ci-full-receipt.json | 只在同一 candidate/artifact/tuple/policy 的业务 receipt 完成后运行唯一 ci:full，并形成候选绑定 receipt；任何 failure 阻断 ProofManifest 与激活。 | ACC-044 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-050 | WO-050 | Browser release identity owner | deliverable://browser-release/activation-tuple-candidate.json | future explicit construction authorization required | deliverable://construction-admission/external-operations.json ; deliverable://browser-release/browser-build-input-lock.json ; deliverable://browser-release/artifact-set.json ; deliverable://browser-release/builder-a-receipt.json ; deliverable://browser-release/builder-b-receipt.json ; deliverable://browser-release/sbom.spdx.json ; deliverable://browser-release/provenance.json ; deliverable://browser-release/installed-artifact-readback.json ; src/lib/browser/release/browser-activation-tuple.schema.json ; src/lib/browser/release/browser-release-security-policy.schema.json ; artifact://browser-release/controller/controller-bundle.tgz ; artifact://browser-release/native-host/grasseye-browser-host ; artifact://browser-release/browserctl/browserctl ; artifact://browser-release/launcher/grasseye-browser-launcher ; artifact://browser-release/platform-macos/libgrasseye-platform-macos.a ; artifact://browser-release/extension/grasseye-browser-extension.verified.crx ; artifact://browser-release/native-messaging-manifests/com.grasseye.browser_host.json ; artifact://browser-release/checksums/SHA256SUMS ; artifact://browser-release/signatures/SHA256SUMS.sig ; deliverable://browser-release/constructed-release-candidate.json | deliverable://browser-release/activation-tuple-candidate.json ; deliverable://browser-release/release-security-policy.json ; deliverable://browser-release/release-identity-signature.json | 读取不可变 ArtifactSet、完整 input lock、SBOM、provenance、builder 与安装 readback，签发内部绑定同一 artifact/candidate/sequence 的 ActivationTuple candidate、ReleaseSecurityPolicy 与 release identity signature。 | ACC-050 | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACT-051 | WO-051 | Browser authority issuer owner | system://browser-authority/active-authority-slot#revoke | future explicit construction authorization required | deliverable://browser-release/post-activation-readback.json ; deliverable://browser-release/activation-receipt.json ; deliverable://browser-release/constructed-release-candidate.json | deliverable://browser-release/recovery-authority-revoke.json | 仅由 Browser authority issuer owner 把 active authority slot 改为 ABSENT，并签发 revoke readback；不执行安装或 activation 回退。 | ACC-051 | Emit RECOVERY_FAILED_AUTHORITY_NOT_ABSENT and stop; do not proceed to browserctl rollback. |
| ACT-054 | WO-054 | local-runtime owner | system://workbench/browser-consumer-admission#construction-blocked | future explicit construction authorization required | deliverable://browser-release/recovery-active-slot-cas.json ; deliverable://browser-release/recovery-authority-revoke.json ; deliverable://browser-release/constructed-release-candidate.json | deliverable://browser-release/recovery-consumer-blocked.json | 仅由 Local Runtime Browser admission owner 在 previous tuple CAS readback 后关闭 CON-001..CON-011 的 Browser admission，并证明没有业务副作用。 | ACC-054 | Emit RECOVERY_FAILED_CONSUMER_ADMISSION and stop; no Browser consumer may run. |

## 15. 逐工作单验收与证据映射

| 验收 | 工作单 | 类型 | producer | 命令/步骤 | 能证明 | 不能证明 | 失败结果 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ACC-002 | WO-002 | EXAM | WO-002 | Verify git rev-parse HEAD equals 60cfcf512ecdae0ed27d001d40b6293ae53e5cc6; verify git status --porcelain=v1 --untracked-files=all is empty before construction; verify deliverable://construction-admission/user-browser-scope-authorization.json names only the Browser responsibility slice. | 只关闭 AGENT SHA/tree 与本轮 Browser 片区授权。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-004 | WO-004 | EXAM | WO-004 | Verify git -C /Users/nexgen/Documents/xuanxue-web status --porcelain=v1 --untracked-files=all is empty; bind git -C /Users/nexgen/Documents/xuanxue-web rev-parse HEAD and the three exact paths from WO-004 into deliverable://construction-admission/xuanxue-candidate.json. | 独立取得干净 xuanxue SHA/tree 与三条精确目标路径；缺失只阻断跨仓和其后发布。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-005 | WO-005 | EXAM | WO-005 | node --import tsx scripts/acceptance/local-browser-plan-harness.self-test.ts --expect-all-negative-cases-rejected && node --import tsx scripts/acceptance/local-browser-retirement-inventory.acceptance.ts --classification deliverable://browser-retirement/file-classification.json --consumers deliverable://browser-retirement/consumer-registry.json --require-zero-unclassified --require-consumer-ids CON-001,CON-002,CON-003,CON-004,CON-005,CON-006,CON-007,CON-008,CON-009,CON-010,CON-011 | 用 AST/symbol 消费图把当前 Browser 文件逐一标为删除，并把每个消费者绑定到 CON-001..CON-011。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-006 | WO-006 | EXAM | WO-006 | Project authorization owner compares both exact authority documents and signs deliverable://construction-admission/browser-canonical-path.json only when canonical_path equals src/lib/browser/profile/browser-process-supervisor.ts and no alternate_supervisor_paths are present. | 消费逐文件分类后，关闭唯一 BrowserProcessSupervisor 路径和零未分类删除白名单。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-007 | WO-007 | DYNAMIC | WO-007 | node --import tsx scripts/acceptance/local-browser-work-order-receipt.acceptance.ts --work-order WO-007 --receipt deliverable://browser-observation/preconstruction-chrome.json --require-positive-negative-terminal-bounds | 记录获准真实路径的 URL、profile/process/policy、DOM 与动作前后终态；未知状态保持 UNKNOWN。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-008 | WO-008 | EXAM | WO-008 | node --import tsx scripts/acceptance/local-browser-consumer-registry.acceptance.ts --registry deliverable://browser-retirement/consumer-registry.json --cutover deliverable://browser-retirement/cutover-ledger.json --demolition deliverable://construction-admission/browser-demolition.json --require-complete-mapping --require-zero-unclassified | 把每个 CON ID 映射到精确路径、owner、迁移工作单、验收和无旧链恢复。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-009 | WO-009 | EXAM | WO-009 | node --import tsx scripts/acceptance/local-browser-retirement-inventory.acceptance.ts --classification deliverable://browser-retirement/file-classification.json --verify-all-browser-targets-absent --verify-no-import-reachability | 删除获准 Browser 根内全部现实现，构造期 authority 明确 ABSENT。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-010 | WO-010 | EXAM | WO-010 | node --import tsx scripts/acceptance/local-browser-consumer-registry.acceptance.ts --cutover deliverable://browser-retirement/cutover-ledger.json --verify-targets-absent src/lib/local-runtime/workbench-browser-support.ts,src/lib/local-runtime/workbench-video-download-support.ts --verify-no-alias | 删除两个旧 support surface，不保留别名、wrapper 或 authority 平行文件。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-011 | WO-011 | EXAM | WO-011 | node --import tsx scripts/acceptance/local-browser-consumer-registry.acceptance.ts --cutover deliverable://browser-retirement/cutover-ledger.json --verify-listed-legacy-acceptance-absent | 删除当前 legacy local-browser acceptance，未来验收只按终态合同重建。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-012 | WO-012 | EXAM | WO-012 | node --import tsx src/lib/browser/protocol/browser-protocol-schema.acceptance.ts --schema src/lib/browser/protocol/browser-protocol.schema.json --errors src/lib/browser/protocol/browser-errors.json --reject-unknown-message --verify-budget-bounds --require-exact-error-taxonomy install,host,origin,extension,tuple,transcript,capability,profile,process,policy,liveness,worker-fence,dual-active,backpressure,file-grant,rollback,revocation,permit,target,document,devtools,outcome-unknown,repair | 建立消息、framing、budget、artifact grant、registry hash 与唯一完整 Browser error taxonomy 的单一源。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-013 | WO-013 | EXAM | WO-013 | node --import tsx src/lib/browser/protocol/browser-protocol-codegen.acceptance.ts --schema src/lib/browser/protocol/browser-protocol.schema.json --ts src/lib/browser/protocol/generated/browser-protocol.generated.ts --rust src/lib/browser/native-messaging-host/crates/host/src/generated/browser_protocol.rs --require-byte-stable | 从唯一 schema 生成 TypeScript 与 Rust 合同并证明两端 hash 相同。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-015 | WO-015 | EXAM | WO-015 | node --import tsx src/lib/browser/chrome-extension/extension.acceptance.ts --manifest src/lib/browser/chrome-extension/manifest.json --require-one-port-owner --reject-unregistered-command | 只建设 NativePortActor、CommandRegistry 与 chrome.debugger 适配。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-016 | WO-016 | EXAM | WO-016 | node --import tsx src/lib/browser/transport/browser-transport.acceptance.ts --require-single-actor --reject-stale-event --verify-bounded-fresh-chain-retry | 只拥有 transport event、状态归约、fresh-chain retry 与 stale event 丢弃。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-017 | WO-017 | EXAM | WO-017 | node --import tsx src/lib/browser/infrastructure/browser-authority-issuer.acceptance.ts --require-absent-or-present --reject-heartbeat-mint --verify-immediate-revoke --require-auth-proof-committed | 只在 authenticated channel、profile/process/policy 与 liveness 全成立时产生 PRESENT authority。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-018 | WO-018 | EXAM | WO-018 | node --import tsx src/lib/browser/infrastructure/browser-authority-broker.acceptance.ts --public-api src/lib/browser/browser-authority-api.ts --require-execution-binding --reject-private-export | 唯一业务入口只消费当前 execution binding 并返回 authority lease 或 typed unavailable。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-019 | WO-019 | EXAM | WO-019 | node --import tsx src/lib/browser/exact-target/browser-target-lease.acceptance.ts --require-exact-target-document --reject-zero-or-many --reject-stale-epoch | 只从当前 authority lease 取得唯一 target/document lease，epoch 变化立即失效。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-020 | WO-020 | EXAM | WO-020 | node --import tsx src/lib/browser/exact-target/browser-command.acceptance.ts --reject-evaluate --reject-raw-path --verify-mutation-journal --verify-outcome-unknown | 只执行 registry-owned declarative commands；mutation 不自动重放，歧义进入 OUTCOME_UNKNOWN。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-021 | WO-021 | EXAM | WO-021 | node --import tsx src/lib/browser/profile/browser-profile.acceptance.ts --require-files src/lib/browser/profile/browser-profile-config.ts,src/lib/browser/profile/browser-profile-state.ts,src/lib/browser/profile/dedicated-profile-policy.ts,src/lib/browser/profile/browser-profile-enrollment.ts,src/lib/browser/profile/browser-profile-enrollment-receipt.ts,src/lib/browser/profile/browser-profile-process-attestation.ts,src/lib/browser/profile/managed-policy-readback.ts,src/lib/browser/profile/browser-process-supervisor.ts --enrollment-owner browserctl --reject-wrong-profile --reject-wrong-process --reject-policy-drift | 建设完整 profile 终态：config、state、dedicated policy、enrollment、receipt、process attestation、managed policy readback 与唯一 BrowserProcessSupervisor；enrollment mutation 仍只由 browserctl 执行。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-024 | WO-024 | EXAM | WO-024 | node --import tsx src/capabilities/dom-automation/runtime/dom-browser-authority.acceptance.ts --require-six-primitives --reject-private-browser-import --bind-observation deliverable://browser-observation/preconstruction-chrome.json | 六个原子动作只消费当前 BrowserTargetLease 与命令 permit。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-025 | WO-025 | EXAM | WO-025 | node --import tsx src/capabilities/ai-input-gateway/acceptance/browser-authority.acceptance.ts --require-checkpoint-release --reject-browser-target-session --reject-production-fixture | 每次 provider execution/checkpoint 重新取得并释放 authority/target；删除 BrowserTargetSession fixture 合同。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-026 | WO-026 | EXAM | WO-026 | node --import tsx src/capabilities/video-download/acceptance/browser-authority.acceptance.ts --require-named-observation --reject-create-target-session --reject-evaluate --reject-script-fallback | 来源页探测只使用命名、有界 observation capability，不允许 evaluate 或脚本 fallback。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-027 | WO-027 | EXAM | WO-027 | node --import tsx src/plugins/amazon-invoice-upload/amazon-invoice-upload-browser-authority.acceptance.ts --require-current-window --require-mutation-journal --require-human-final-gate --reject-stale-target | 只改 Browser 边界，保留业务顺序和人工最终门；每个 mutation 有 journal 与 owner outcome resolution。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-028 | WO-028 | EXAM | WO-028 | node --import tsx src/plugins/amazon-product-mining/amazon-product-mining-browser-authority.acceptance.ts --require-stage-checkpoint --reject-cross-stage-lease-cache --preserve-package-owner | 每阶段使用当前 execution/authority/target，checkpoint 后不缓存旧 lease。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-029 | WO-029 | EXAM | WO-029 | node --import tsx src/plugins/xuanxue-ai-production/xuanxue-ai-production-browser-authority.acceptance.ts --require-ordered-windows --require-zero-gap-actions --require-zero-unresolved-outcomes | 在唯一 AgentRuntimeReceiptV2 内记录有序 authority windows，窗口间零动作且无未裁决 mutation。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-030 | WO-030 | EXAM | WO-030 | cd /Users/nexgen/Documents/xuanxue-web && npx vitest run tests/dynamic-proof/browser-authority-window-contract.test.ts --reporter=verbose | 只在 DG-003 干净候选上修改三条冻结路径，不建立第二 election、receipt 或 verdict owner。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-031 | WO-031 | EXAM | WO-031 | node --import tsx scripts/audit/domains/local-browser-session/local-browser-26-checks.acceptance.ts --law .github/instructions/agent-rules/modules/module-local-browser-session.instructions.md --manifest scripts/audit/domains/local-browser-session/manifest.json --inspector scripts/audit/domains/local-browser-session/inspector.ts --require-law-sha-bound-exact-check-set --require-check-count 26 --require-independent-receipts | 从当前 active law SHA 导出精确 26 个 machine-blocking checkId，并证明 manifest/inspector 的独立 binding 集合全等且各有 receipt。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-032 | WO-032 | EXAM | WO-032 | node --import tsx scripts/acceptance/local-browser-terminal-contract.acceptance.ts --supervisor src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts --errors src/lib/browser/protocol/browser-errors.json --require-only-health-components browserInfrastructure,browserAuthority --reject-old-health-semantics browserSession,transportReady,session-not-authenticated,wait-for-authentication --require-exact-zero-metrics unauthenticated_browser_authority_issued_total,command_without_valid_authority_total,stale_event_side_effect_total,old_completion_to_new_port_total,non_idempotent_auto_replay_total,wrong_profile_process_authority_issued_total,command_after_liveness_expiry_total,browser_action_during_authority_absence_total,dual_active_browser_worker_total,revoked_or_rollback_blocked_tuple_activated_total,browser_admission_budget_violation_total --require-slo availability=99.99,authority_issuance_p99_ms=5000,recoverable_chain_rebuild_p99_ms=10000,revoke_to_absent_p99_ms=10 --require-unbounded-zero queue,cache,stream && node --import tsx scripts/acceptance/local-browser-26-mutants.acceptance.ts --require-killed 26 && node --import tsx scripts/acceptance/local-browser-property-model.acceptance.ts --require-all-invariants | 26 个检查逐项拥有 negative/property/model/mutant 证据；确定性合同验证两项 health、精确 error taxonomy、11 个零指标、4 项 SLO 与无界 queue/cache/stream 为零，generated truth 只由现有 builder 生成。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-046 | WO-046 | EXAM | WO-046 | cargo test --manifest-path src/lib/browser/native-messaging-host/Cargo.toml --test browserctl -- --nocapture | browserctl 是 install/verify/doctor/repair/enroll-profile/activate/rollback 唯一 owner；launcher、platform-macos 与 manifests 只服务该控制面。 | Does not prove downstream activation, production readback or final release approval. | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACC-047 | WO-047 | EXAM | WO-047 | node --import tsx src/lib/browser/infrastructure/browser-infrastructure-supervisor.acceptance.ts --require-lock-before-bind --reject-live-socket-unlink --require-bounded-repair --require-only-health-components browserInfrastructure,browserAuthority --require-sole-error-metrics-producer --reject-old-health-semantics browserSession,transportReady,session-not-authenticated,wait-for-authentication --reject-business-flow | 唯一 supervisor 在 bind 前取得 OwnerLock，并拥有 worker membership、handover、retry、repair、两项合法 health 与唯一 error/metrics producer；不拥有业务流程。 | Does not prove downstream activation, production readback or final release approval. | Emit a candidate-bound FAIL receipt and stop dependent work orders. |
| ACC-035A | WO-035 | MANUAL | WO-035 | Verify deliverable://construction-admission/agent-repository-governance-policy.json owner signature, repo, main branch, strict, exact contexts, constructed candidate SHA/tree and mutation/restore permissions; GET current required_status_checks and sign only the pre-state receipt with candidate/repo/branch/hash. | Desired contexts are signed by the legal repository governance owner and the remote pre-state is signed before mutation. | Does not prove PATCH or post-state. | Do not PATCH; emit FAIL. |
| ACC-035B | WO-035 | MANUAL | WO-035 | PATCH /repos/ADVISION-X/AGENT/branches/main/protection/required_status_checks from deliverable://construction-admission/agent-repository-governance-policy.json; GET the same endpoint into deliverable://browser-release/branch-protection-readback.json; require exact strict/contexts/candidate/repo/branch match. Require deliverable://browser-release/constructed-release-candidate.json AGENT/xuanxue remote SHA as applicable and reject the plan-evidence SHA. | The requested exact branch-protection state is independently read back. | Does not prove future configuration after the readback timestamp. | Invoke ACT-035C and block release. |
| ACC-035C | WO-035 | MANUAL | WO-035 | If ACC-B failed, PATCH the exact deliverable://browser-release/agent-branch-protection-prestate.json, GET again, and require byte-equivalent strict/contexts before signing deliverable://browser-release/agent-branch-protection-recovery-receipt.json; if ACC-B passed, sign NOT_REQUIRED. | Remote mutation has a candidate-bound, verifiable restoration path. | Does not approve release. | RECOVERY_FAILED is terminal and blocks release. |
| ACC-048A | WO-048 | MANUAL | WO-048 | Verify deliverable://construction-admission/xuanxue-repository-governance-policy.json owner signature, repo, main branch, strict, exact contexts, constructed candidate SHA/tree and mutation/restore permissions; GET current required_status_checks and sign only the pre-state receipt with candidate/repo/branch/hash. | Desired contexts are signed by the legal repository governance owner and the remote pre-state is signed before mutation. | Does not prove PATCH or post-state. | Do not PATCH; emit FAIL. |
| ACC-048B | WO-048 | MANUAL | WO-048 | PATCH /repos/ADVISION-X/xuanxue-web/branches/main/protection/required_status_checks from deliverable://construction-admission/xuanxue-repository-governance-policy.json; GET the same endpoint into deliverable://browser-release/xuanxue-branch-protection-readback.json; require exact strict/contexts/candidate/repo/branch match. Require deliverable://browser-release/constructed-release-candidate.json AGENT/xuanxue remote SHA as applicable and reject the plan-evidence SHA. | The requested exact branch-protection state is independently read back. | Does not prove future configuration after the readback timestamp. | Invoke ACT-048C and block release. |
| ACC-048C | WO-048 | MANUAL | WO-048 | If ACC-B failed, PATCH the exact deliverable://browser-release/xuanxue-branch-protection-prestate.json, GET again, and require byte-equivalent strict/contexts before signing deliverable://browser-release/xuanxue-branch-protection-recovery-receipt.json; if ACC-B passed, sign NOT_REQUIRED. | Remote mutation has a candidate-bound, verifiable restoration path. | Does not approve release. | RECOVERY_FAILED is terminal and blocks release. |
| ACC-049 | WO-049 | MANUAL | WO-049 | Operator signs exact provider account refs, allowed journey IDs, forbidden sensitive final actions, required human gates, timestamps spanning at least 8 business hours, pause/cancel/takeover authority and evidence redaction policy; any missing field is BLOCKED. | 由 operator 明确账户、journey 范围、敏感动作边界、人工门、8 小时窗口和中止权限；缺失只阻断业务证据及发布链。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-003 | WO-003 | MANUAL | WO-003 | Release operations owner signs external-operations.json containing non-empty permanent CWS item ID, Verified CRX publisher identity, Host/launcher/browserctl signing and notarization key references, release-signing-root custody, dedicated managed-profile policy ref, and two distinct HA worker device IDs/dataDirs/profile enrollment refs; reject shared device/profile/dataDir or missing owner signature. | 只冻结 CWS、签名/公证、managed profile、两台独立 HA worker 与 release key custody；不决定任何仓库 required-check policy。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-014 | WO-014 | EXAM | WO-014 | cargo test --manifest-path src/lib/browser/native-messaging-host/Cargo.toml --locked --all-targets && cargo fuzz run --manifest-path src/lib/browser/native-messaging-host/crates/host/fuzz/Cargo.toml native_framing -- -max_total_time=60; require bounded framing, raw/auth channel separation, original reply token, one Host per Port, transcript integrity and crash-safe artifact stream; any panic, hang or oversized frame acceptance fails. | 只建设 framing、认证握手、单 Port 与有界 I/O 的 Host。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-022 | WO-022 | EXAM | WO-022 | node --import tsx src/lib/browser/release/release-identity.acceptance.ts --require-artifact-tuple-proof-security-rollback-sbom-provenance-build-input-previous-snapshot-schemas --require-active-slot-signed-absent --verify-targets-absent deliverable://browser-release/artifact-set.json,deliverable://browser-release/activation-tuple-candidate.json,deliverable://browser-release/release-security-policy.json --reject-tuple-intersection --reject-downgrade --reject-revoked; fail if WO-022 issues any candidate identity. | 只建立 ArtifactSet、ActivationTuple、ReleaseSecurityPolicy、ProofManifest、rollback、SBOM、provenance 与 build-input schemas，并初始化空 ABSENT slot；不签发任何候选身份。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-023 | WO-023 | EXAM | WO-023 | node --import tsx src/lib/local-runtime/workbench-browser-authority.acceptance.ts --require-broker-only --forbid-assembly-authority-lease --forbid-assembly-target-lease --require-only-health-components browserInfrastructure,browserAuthority --reject-old-health-semantics browserSession,transportReady,session-not-authenticated,wait-for-authentication --verify-targets-absent src/lib/local-runtime/workbench-browser-support.ts,src/lib/local-runtime/workbench-video-download-support.ts --require-video-capability-public-factory --require-browser-jobs-blocked-when-authority-absent; run AST import check proving local-runtime imports Browser public facade only. | Local Runtime 只注入 Broker，原样展示唯一 supervisor 的两个合法 health component；assembly 不领取或缓存 target lease；已退休的 workbench-browser-support.ts 与 workbench-video-download-support.ts 永久不存在。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-041 | WO-041 | MANUAL | WO-041 | Create a fresh independent read-only auditor with no prior implementation context; bind exact constructed-release-candidate, ArtifactSet, ActivationTuple, ReleaseSecurityPolicy and all declared receipt hashes; independently execute all 26 local-browser checks, old-path/import/symbol zero reachability, two-repo governance pre/post/recovery readbacks, ci-full receipt, packaged Chrome matrix, provider/business receipt, HA/24h/168h receipts and producer-ancestor graph; sign independent-audit.json only when blocking findings=0, conflicts=0 and every hash matches. Reject plan-evidence SHA as release identity; use only deliverable://browser-release/constructed-release-candidate.json. | 独立审计者绑定同一候选和 artifact，审查法案执法面、旧路径零可达与所有 proof receipts。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-056 | WO-056 | MANUAL | WO-056 | Verify the signer is the AGENT repository governance owner; require repo=ADVISION-X/AGENT, branch=main, strict boolean, non-empty exact contexts, construction_branch=codex/browser-greenfield, expected_remote_ref, commit/push permission, branch-protection mutation permission and exact pre-state restore permission; reject wildcard context or release-operations signature. | 签发 ADVISION-X/AGENT main 的 repo、branch、strict、exact contexts、construction branch commit/push 权限、expected remote ref、保护规则变更权限与恢复权限。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-057 | WO-057 | MANUAL | WO-057 | Verify the signer is the xuanxue repository governance owner; require repo=ADVISION-X/xuanxue-web, branch=main, strict boolean, non-empty exact contexts, construction_branch=codex/browser-greenfield, expected_remote_ref, commit/push permission, branch-protection mutation permission and exact pre-state restore permission; reject wildcard context or AGENT/release-operations signature. | 签发 ADVISION-X/xuanxue-web main 的 repo、branch、strict、exact contexts、construction branch commit/push 权限、expected remote ref、保护规则变更权限与恢复权限。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-058 | WO-058 | MANUAL | WO-058 | Require git status --porcelain=v1 --untracked-files=all empty after staging the authorized construction result; hash every tracked file into agent-constructed-tree-manifest; verify agent-build-input-manifest includes package.json, package-lock.json, tsconfig.json, browser-build.config.json and every Browser producer output; create source bundle; commit with authorized identity; push with exact lease; run git ls-remote origin refs/heads/codex/browser-greenfield and require returned SHA equals local commit and candidate receipt. | 在所有 AGENT 源码、audit 与 acceptance 建设完成后，生成 content-addressed tree/build-input manifest 与 source bundle；在获准 construction branch 上 commit/push，并以 git ls-remote 读回相同 SHA。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-059 | WO-059 | MANUAL | WO-059 | Require clean xuanxue worktree; verify only the three authorized cross-repo proof paths changed; hash complete tracked tree; create source bundle; commit with authorized identity; push with exact lease; run git ls-remote origin refs/heads/codex/browser-greenfield and require returned SHA equals local commit and cross-repo receipt candidate hash. | 在 xuanxue 三条授权路径和跨仓验收完成后，生成 content-addressed tree/source bundle；在获准 construction branch 上 commit/push，并以 git ls-remote 读回相同 SHA。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-060 | WO-060 | EXAM | WO-060 | Verify AGENT local commit SHA=remote SHA and tree manifest hash matches source bundle; verify xuanxue local commit SHA=remote SHA and tree manifest hash matches source bundle; verify cross-repo contract hash is present; sign one constructed-release-candidate with both repo identities and reject the plan-evidence SHA as a release candidate. | 把施工后 AGENT 与 xuanxue 的 clean tree、commit SHA、remote SHA、content manifests 与 cross-repo contract hash 组合成唯一 constructed-release-candidate identity。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-033 | WO-033 | DYNAMIC | WO-033 | Build only from agent-constructed-source-bundle.tar.zst verified by constructed-release-candidate and agent-build-input-manifest; require package.json, package-lock.json, tsconfig.json, browser-build.config.json and no unlisted byte-affecting input; two independent builders must produce exact entity refs for Controller bundle, signed Host, browserctl, launcher, platform adapter, Verified CRX, Native Messaging manifest, SHA256SUMS and signature; verify entity hashes, SBOM, provenance, signing/notarization and installed readback before ArtifactSet indexes them. | 只从 WO-060 冻结的 source bundles/tree manifests 与精确 package/tsconfig/build config 输入构建 Controller、Host、browserctl、launcher、platform adapter、Verified CRX、Native Messaging manifest、checksums/signature 九个实体；ArtifactSet 仅索引这些 content-addressed entities。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-039 | WO-039 | BUSINESS | WO-039 | Read active slot; sign PreviousActivationSnapshot as exactly SIGNED_ABSENT or SIGNED_PRESENT(tuple with signature/hash/sequence); CAS to the proof-bound new tuple; require one active value and exact old/new readback. Require ProofManifest constructed-candidate hash equals deliverable://browser-release/constructed-release-candidate.json. | 只消费已签 proof manifest，先签发 PreviousActivationSnapshot=SIGNED_ABSENT 或 SIGNED_PRESENT(tuple)，再 CAS 切换一个 active tuple。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-052 | WO-052 | DYNAMIC | WO-052 | If snapshot=SIGNED_PRESENT, browserctl restores exactly the previous ArtifactSet entities and reads back profile/process/policy/tree; if snapshot=SIGNED_ABSENT, browserctl uninstalls or quarantines the failed Controller/Host/browserctl/launcher/platform/CRX/manifest entities and proves no launchable Browser authority path; both require authority ABSENT. | 若 snapshot 为 SIGNED_PRESENT，browserctl 安装回退到 previous tuple；若为 SIGNED_ABSENT，browserctl 卸载/隔离失败新 artifact 并证明 profile/process/policy/tree 无可用 Browser authority。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-053 | WO-053 | DYNAMIC | WO-053 | CAS active slot from failed new tuple to snapshot value: previous tuple for SIGNED_PRESENT or ABSENT for SIGNED_ABSENT; GET and verify exact state, signature/sequence rules for PRESENT, and no tuple fields for ABSENT. | 仅由 activation owner 把 active slot 从失败新 tuple CAS 到 SIGNED_PRESENT 的 previous tuple，或 CAS 到 SIGNED_ABSENT。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-055 | WO-055 | DYNAMIC | WO-055 | Require authority ABSENT and CON-001..CON-011 BLOCKED; for SIGNED_PRESENT require exact previous entities installed and active slot equals previous tuple; for SIGNED_ABSENT require failed entities uninstalled/quarantined, no launchable Browser authority path and active slot ABSENT; sign new-attempt-admission that forbids failed ProofManifest reuse. | 独立验证 authority ABSENT、SIGNED_PRESENT 时 previous tuple 已安装且 active，或 SIGNED_ABSENT 时无可用 Browser artifact 且 slot 为 ABSENT；两分支均要求 CON-001..CON-011 BLOCKED。 | Does not restore service or authorize a new activation. | Emit FAIL and stop dependent work orders. |
| ACC-034 | WO-034 | DYNAMIC | WO-034 | node --import tsx scripts/acceptance/local-browser-real-chrome-terminal.acceptance.ts --artifact deliverable://browser-release/artifact-set.json --tuple deliverable://browser-release/activation-tuple-candidate.json --security-policy deliverable://browser-release/release-security-policy.json --identity-signature deliverable://browser-release/release-identity-signature.json --matrix deliverable://browser-release/real-chrome-matrix.json --browsers stable,cft --require-tuple-artifact-match --require-security-policy-hash --require-positive-negative-terminal-bounds Require --constructed-candidate deliverable://browser-release/constructed-release-candidate.json and reject plan-evidence SHA. | 在 Stable 与 CfT 上对同一 ArtifactSet、ActivationTuple candidate 与 ReleaseSecurityPolicy 完成 profile/process/policy、auth、target、file、stream、update 与 rollback 正反终态。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-036 | WO-036 | DYNAMIC | WO-036 | Run active-to-standby and standby-to-active handover with the exact artifact, tuple, security-policy and release-identity hashes; require one current database fence, sealed checkpoint, zero inter-window actions, zero unresolved outcomes, dual_active_browser_worker_total=0, stale_event_side_effect_total=0, old_completion_to_new_port_total=0 and command_after_liveness_expiry_total=0. Require every HA window receipt to embed deliverable://browser-release/constructed-release-candidate.json hash. | 一主一热备只消费 xuanxue 数据库 fence，完成 revoke/checkpoint/fresh-window 交接并证明四项 handover 关键零指标。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-037 | WO-037 | DYNAMIC | WO-037 | Run the exact same artifact/tuple/policy identity for 24h fault soak and 168h production soak; require zero for unauthenticated_browser_authority_issued_total, command_without_valid_authority_total, stale_event_side_effect_total, old_completion_to_new_port_total, non_idempotent_auto_replay_total, wrong_profile_process_authority_issued_total, command_after_liveness_expiry_total, browser_action_during_authority_absence_total, dual_active_browser_worker_total, revoked_or_rollback_blocked_tuple_activated_total and browser_admission_budget_violation_total; require availability>=99.99%, authority_issuance_p99<=5s, recoverable_chain_rebuild_p99<=10s, revoke_to_absent_p99<=10ms and unbounded_queue/cache/stream=0. Any identity drift, missing field or threshold breach resets the full required duration. Require both soak receipts to embed deliverable://browser-release/constructed-release-candidate.json hash without drift. | 对同一 ArtifactSet 和 HA 拓扑完成法定时长，证明完整零指标、SLO 与有界性；任一缺字段、越界或 identity 漂移即整段作废。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-038 | WO-038 | EXAM | WO-038 | Create BrowserReleaseProofManifestV1 once; hash every declared input including build-input-lock, SBOM, provenance, installed readback and release-identity-signature; require all candidate/artifact/tuple/policy hashes to match. Hash deliverable://browser-release/constructed-release-candidate.json and require every upstream receipt candidate field equals it. | 首次创建 proof manifest，绑定同一 candidate、ArtifactSet、ActivationTuple 候选、安全策略、26 checks、Chrome、HA、soak 与 branch readback。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-040 | WO-040 | DYNAMIC | WO-040 | Read installation, profile, policy, process, Extension, Host, authority slot and business receipt; emit exactly PASS or POST_ACTIVATION_MISMATCH. On mismatch do not run revoke, browserctl, CAS or consumer mutations inside WO-040. Require installed and business readbacks to embed deliverable://browser-release/constructed-release-candidate.json. | 只读安装、policy、process、extension、Host、authority slot 与业务 receipt；输出 PASS readback 或 POST_ACTIVATION_MISMATCH，不隐式取得 revoke、rollback、CAS 或 consumer 写权。 | Does not prove any downstream work order, deployment, activation or release. | Emit POST_ACTIVATION_MISMATCH and enable only WO-051. |
| ACC-042 | WO-042 | BUSINESS | WO-042 | node --import tsx scripts/acceptance/local-browser-work-order-receipt.acceptance.ts --work-order WO-042 --receipt deliverable://browser-release/final-release-approval.json --consume-ci-receipt deliverable://browser-release/ci-full-receipt.json --require-ci-full-pass --require-independent-zero-findings --require-post-activation-match --forbid-ci-execution --forbid-mutation Consume and compare deliverable://browser-release/constructed-release-candidate.json across ProofManifest, activation, readback, independent audit and CI receipt; do not run CI. | 只验证并消费 WO-044 的 candidate-bound ci-full-receipt 及全部 PASS receipts，签发 release approval；不运行 CI，不修改源码、ProofManifest、保护规则或 activation。 | Proves final approval receipt only; it does not prove future runtime availability after the recorded readback window. | Emit FAIL and stop dependent work orders. |
| ACC-043 | WO-043 | BUSINESS | WO-043 | node --import tsx scripts/acceptance/local-browser-business-workday-terminal.acceptance.ts --authorization deliverable://construction-admission/provider-journey-authorization.json --artifact deliverable://browser-release/artifact-set.json --tuple deliverable://browser-release/activation-tuple-candidate.json --security-policy deliverable://browser-release/release-security-policy.json --identity-signature deliverable://browser-release/release-identity-signature.json --receipt deliverable://browser-release/business-workday-receipt.json --min-business-hours 8 --require-all-identity-hashes-match --require-zero-focus-theft --require-zero-keyboard-interruption --require-zero-wrong-target --require-bounded-operator-controls --require-zero-mutation-replay --require-sensitive-actions-human-gated Require --constructed-candidate deliverable://browser-release/constructed-release-candidate.json; artifact/tuple/policy/business receipt hashes must share it. | 在同一 candidate、ArtifactSet、ActivationTuple candidate、ReleaseSecurityPolicy 与 release identity signature 下完成获准 provider journeys 和 8 小时业务基线，证明零 focus theft、零 keyboard interruption、零 wrong-target、有限 pause/cancel/takeover 与零 mutation replay。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-044 | WO-044 | EXAM | WO-044 | npm run ci:full && node --import tsx scripts/acceptance/local-browser-work-order-receipt.acceptance.ts --work-order WO-044 --receipt deliverable://browser-release/ci-full-receipt.json --artifact deliverable://browser-release/artifact-set.json --tuple deliverable://browser-release/activation-tuple-candidate.json --security-policy deliverable://browser-release/release-security-policy.json --require-ci-full-pass --require-candidate-match --require-all-identity-hashes-match Run CI from the exact AGENT SHA in deliverable://browser-release/constructed-release-candidate.json; verify xuanxue remote SHA and embed the composite hash in ci-full-receipt. | 只在同一 candidate/artifact/tuple/policy 的业务 receipt 完成后运行唯一 ci:full，并形成候选绑定 receipt；任何 failure 阻断 ProofManifest 与激活。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-050 | WO-050 | EXAM | WO-050 | Verify ActivationTuple embeds candidate hash, ArtifactSet hash and component hashes; verify ReleaseSecurityPolicy embeds tuple hash, minimum sequence and revocations; verify release-identity-signature covers tuple, policy, build-input-lock, SBOM, provenance and installed readback. Require all issued identities to embed deliverable://browser-release/constructed-release-candidate.json hash. | 读取不可变 ArtifactSet、完整 input lock、SBOM、provenance、builder 与安装 readback，签发内部绑定同一 artifact/candidate/sequence 的 ActivationTuple candidate、ReleaseSecurityPolicy 与 release identity signature。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-051 | WO-051 | DYNAMIC | WO-051 | Invoke BrowserAuthorityIssuer revoke for the failed certificate; GET authority slot; require ABSENT before any browserctl rollback. | 仅由 Browser authority issuer owner 把 active authority slot 改为 ABSENT，并签发 revoke readback；不执行安装或 activation 回退。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |
| ACC-054 | WO-054 | DYNAMIC | WO-054 | Write Browser admission BLOCKED for exact CON-001..CON-011; read every public entry; require BLOCKED and zero Browser action/evidence side effects. | 仅由 Local Runtime Browser admission owner 在 previous tuple CAS readback 后关闭 CON-001..CON-011 的 Browser admission，并证明没有业务副作用。 | Does not prove any downstream work order, deployment, activation or release. | Emit FAIL and stop dependent work orders. |

## 16. 风险、失败处理和停止条件

- 方案候选不得被当作施工后 release candidate；WO-060 未 PASS 时禁止构建或发布证据。
- 任一仓工作树不干净、commit/push 未授权、remote SHA 不等于 local SHA：停止 WO-058/059。
- build-input manifest 漏 package/lock/tsconfig/build config 或任一 byte-affecting input：停止 WO-033。
- 九个 ArtifactSet 实体缺失、hash/signature/SBOM/provenance/installed readback 不一致：禁止 WO-050。
- required contexts 不是对应 repository governance owner 签名：禁止 GitHub PATCH。
- 清场存在未知 consumer、真实页面存在 UNKNOWN、或实现需要 bridge/fallback/evaluate/raw path/第二链：停止施工。
- 激活 snapshot 非严格 `SIGNED_ABSENT | SIGNED_PRESENT`：禁止 CAS。
- SIGNED_ABSENT 恢复未卸载/隔离失败实体，或 SIGNED_PRESENT 未恢复同一 previous entities：authority 保持 ABSENT，消费者保持 BLOCKED。
- fresh independent audit、26 checks、Chrome、provider、HA/soak、CI、两仓治理任一缺失或 hash 漂移：不得创建 ProofManifest。

## 17. 恢复、Cutover 与回退方案

### CUT-001

- 工作单：WO-009
- 退休对象：`deliverable://browser-retirement/file-classification.json#delete_targets`
- 消费者：`CON-001`、`CON-002`、`CON-003`、`CON-004`、`CON-005`、`CON-006`、`CON-007`、`CON-008`、`CON-009`、`CON-010`、`CON-011`
- 前置：ACC-006 PASS；ACC-008 PASS；browser-dependent jobs construction BLOCKED
- 验收：`ACC-009`
- 失败：Stop and restart a fresh construction branch from the frozen candidate; do not add fallback.
- 恢复：Rerun WO-005 and WO-008 before another deletion attempt.

### CUT-002

- 工作单：WO-010
- 退休对象：`src/lib/local-runtime/workbench-browser-support.ts`
- 消费者：`CON-001`
- 前置：ACC-008 PASS
- 验收：`ACC-010`
- 失败：Keep CON-001 BLOCKED; do not restore a wrapper.
- 恢复：Restart WO-010 from the frozen candidate after registry correction.

### CUT-003

- 工作单：WO-010
- 退休对象：`src/lib/local-runtime/workbench-video-download-support.ts`
- 消费者：`CON-002`
- 前置：ACC-008 PASS
- 验收：`ACC-010`
- 失败：Keep CON-002 BLOCKED; do not restore a wrapper.
- 恢复：Restart WO-010 from the frozen candidate after registry correction.

### CUT-004

- 工作单：WO-011
- 退休对象：`scripts/acceptance/local-browser-artifact-contract.acceptance.ts`、`scripts/acceptance/local-browser-atomic-cutover.acceptance.ts`、`scripts/acceptance/local-browser-business-workday.acceptance.ts`、`scripts/acceptance/local-browser-exact-target-contract.acceptance.ts`、`scripts/acceptance/local-browser-native-transport.acceptance.ts`、`scripts/acceptance/local-browser-real-chrome-scenarios.acceptance.ts`、`scripts/acceptance/local-browser-real-chrome.acceptance.ts`、`scripts/acceptance/local-browser-target-actions.acceptance.ts`
- 消费者：`CON-011`
- 前置：ACC-008 PASS
- 验收：`ACC-011`
- 失败：Do not use legacy acceptance as target proof.
- 恢复：Rebuild only terminal-law acceptance after WO-012 contracts exist.

### CUT-005

- 工作单：WO-039
- 退休对象：`deliverable://browser-release/construction-blocked-browser-authority`
- 消费者：`CON-001`、`CON-002`、`CON-003`、`CON-004`、`CON-005`、`CON-006`、`CON-007`、`CON-008`、`CON-009`、`CON-010`、`CON-011`
- 前置：ACC-038 PASS；signed PreviousActivationSnapshot recorded as SIGNED_ABSENT or SIGNED_PRESENT
- 验收：`ACC-039`、`ACC-040`
- 失败：CAS failure keeps authority ABSENT; execute WO-051..WO-055 using the signed snapshot union.
- 恢复：SIGNED_PRESENT restores the signed bounded previous tuple; SIGNED_ABSENT isolates/uninstalls the failed new artifact and restores ABSENT. Deleted Browser source never returns.

旧 Browser 源码永不作为回退。运行恢复只用 fresh fence/authority/target/window。激活恢复由 snapshot 分叉：`SIGNED_PRESENT` 恢复同一 previous ArtifactSet 并 CAS previous tuple；`SIGNED_ABSENT` 卸载或隔离失败实体并 CAS ABSENT；随后统一关闭 CON-001..CON-011 admission，再独立读回。

## 18. A/B/C 分歧和主线裁决

A/B/C 的权威、证据与拓扑结论全部采纳。两轮 D 的十项重大 finding 均已映射为具体 manifest 修订：

- 第 1 轮 D-301..D-305：artifact→tuple 单向身份链、旧 support 永久 absent、跨 owner 恢复链、两仓保护规则前后态、WO-042 禁止重跑 CI。
- 第 2 轮 D-306..D-310：新增双仓施工后候选 WO-058..WO-060；WO-033 增加完整构建配置与九个实体产物；治理策略移交 WO-056/057 合法 owner；五项泛化验收改为字段级命令/步骤；previous snapshot 改为 SIGNED_ABSENT/SIGNED_PRESENT 联合终态。

## 19. D 三项终审与冷启动测试

D 第 1 轮和第 2 轮都返回了精确修订项。用户明确限定最多两轮，并授权第 2 轮问题全部修正后直接交付，因此没有发起第 3 个独立 D 回合。

本文件的 `D_PASS` 表示“用户授权的两轮修订闭合门”：D-301..D-310 已逐项消除；Manifest 合同、58 工作单 DAG、producer→READ 祖先关系、owner/scope/action/acceptance/cutover 一致性和最终文档合同均重新验证。它不是伪称第 2 轮审计者曾直接审过 v7。

最终修订闭合结果：`COLD_START_EXECUTOR_TEST_PASS`、`work_order_graph_check=PASS`、`EXECUTION_MANIFEST_CONTRACT_PASS`、`PLAN_CONTRACT_PASS`；架构闭环/边界/执行就绪自检均为 100，重大 finding=0，未解决冲突=0。

## 20. 事实、推断、假设和未知项

事实：active law/终态施工图存在；当前执法只有 7 项而法案要求 26 项；当前源码仍含旧 Session/evaluate、重复 owner 与装配期 lease；用户要求绿地重来并限定两轮 D。

推断：前三次没有彻底完成，是因为旧方案未把物理清场、施工后候选、完整 ArtifactSet 实体、合法治理 owner、producer evidence、首次激活恢复和 atomic cutover 拆成独立事务。

假设：未来用户会逐工作单授权施工，两个 repository governance owner 与 release/provider owner 会签发 gate 输入。假设不等于当前事实。

未知：未来 clean constructed SHAs、CWS item、签名/公证身份、managed profile、HA workers、provider 账号、真实页面状态、两仓保护规则前态。未知项只由对应 gate 阻断。

## 21. 明确禁止事项

- 禁止用本方案 SHA 代替施工后 constructed release candidate。
- 禁止未授权 commit/push、main branch protection PATCH、activation 或 rollback。
- 禁止 ArtifactSet 只有 JSON 索引却没有九个实体。
- 禁止 old/new Browser 双轨、bridge、fallback、alias、wrapper、shadow path。
- 禁止 BrowserTargetSession/createTargetSession/evaluate/raw path。
- 禁止 Local Runtime 生成业务 fence 或 assembly-time lease。
- 禁止第二 election、receipt、Dynamic Proof verdict、server、evidence/log/audit chain。
- 禁止手改 generated truth。
- 禁止 WO-042 运行 CI或修改源码、ProofManifest、branch protection、activation。
- 禁止 SIGNED_ABSENT 分支假装存在 previous tuple。
- 禁止用历史 PASS、fixture 或静态报告冒充生产证明。

## 22. 结论上限声明

- `DESIGN_ONLY`
- `NOT_IMPLEMENTED`
- `NOT_TESTED_AS_PROJECT`
- `NOT_COMMITTED`
- `NOT_DEPLOYED`
- `NOT_RELEASED`

本方案达到 `WORKORDER_READY`，施工入口仍是 `DECISION_GATED`。只有未来同一 constructed candidate 依次完成全部工作单、真实 Chrome、provider、HA/soak、唯一 CI、两仓治理、独立审计与签名发布，才可能形成生产结论。

本文件只是一份项目实现方案。
它不证明项目已经建设、测试、提交、部署或发布。
任何施工动作都需要新的明确授权。

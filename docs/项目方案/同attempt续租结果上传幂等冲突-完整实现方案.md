# 同 attempt 续租结果上传幂等冲突-完整实现方案

状态：可施工（执行 Claude 须按 §11 重绑定 candidate，并取得 §10 所列用户明确授权）

修订：v6。经五轮独立审计收敛（v5 吸收第四轮：部署边界、测试取证方式、lease 范围 orphan 改为 attempt 范围、并发 STALE 措辞、法案第 808 行；v6 吸收第五轮：按工单精确回退、迁移文件与执行同步落盘并动态取号、AGENT 提交命令、断言正则、在施改动 Owner、consumer 残留字段、补全依赖 candidate）。核心判据：AGENT 对 **5xx、`PRODUCTION_OUTBOX_*` 以及 terminal 阶段的任何失败** 都不向 Website 上报，只能靠 Website 续租同 attempt 重来；因此该路径上任何**确定性**错误都会形成无界静默循环。本方案消除当前链路上全部四处确定性错误（D1–D4），其余分支均落在现役类型化上报 → Website 新 attempt 的有界路径。

## 1. 需求、终点与范围

**需求**：结果上传与 terminal 链不得因确定性错误进入“不上报、只续租”的无界静默循环；当前卡死工单 `aiprod_2839cd99-d9d7-4fb6-8ad0-eb53a66a4b73`（attempt `e47022ae-272c-428f-8a8b-e847993486ce`）、`aiprod_f88390fa-1d31-4341-adfd-90c6db5defee`（attempt `73494c9a-ca32-49ad-99be-f52b3e3467d0`）必须进入 Website 领域裁决。

**本方案终点**：两个当前 attempt 的结果被 Website 领域 consumer 裁决并持久化——business admission receipt 且 AGENT `completed`；或该 attempt 的 `result_revision_rejected_v1` 已持久化且随后授予新 attempt。

**不在范围**：两 job 译文质量（历史拒收 `LOCALIZATION_SAFETY_FIELD_NOT_TRANSLATED` / `…_TRUNCATED`）。当前 attempt 已按现役合同（`result_revision_rejected_policy: new_attempt_new_prompt_result_identity`，localization 插件携 `resultRevision`，`flow.ts:132`）提交了新 GPT 回合，但产出与旧被拒 revision 字节相同；领域 consumer 预计再次拒收并签发新 revision，属正常业务行为。本方案负责的是：字节相同时 Website 各层不得因“按 payload 去重”而确定性失败（D1、D3）。

**不改**：AGENT 幂等键推导、`acceptTask`、`isResultTransportBoundary`、`completeClaim` 上报语义、两表 schema、GPT/Browser；Website 续租策略、领域 consumer 与 validator。

## 2. 证据（2026-09-17/18，只读）

| # | 证据 | 事实 |
|---|---|---|
| E1 | AGENT `.grasseye-local/production-runtime.sqlite` `production_outbox` | `aipresult_eb9b74fca654d463c522a4cdae362589e67a27ad`（2839cd99）、`aipresult_ba8fba18abd826348e38f6e63bfa79be5b425177`（f88390fa）：artifact/result_payload，`sent_at` 空，`last_error=INTERNAL_ERROR` |
| E2 | 以当前 attempt 与 `hashCanonical` 重算 | requestId、path、body sha256（`3aeda79e…`、`bb27c1f5…`）与 E1 一致，仅 `x-ai-execution-fence-hash` 不同 |
| E3 | AGENT `runtime-logs/agent/*.jsonl` | 首次 `result.upload` `{INTERNAL_ERROR, website, 500}`；其后每次续租 `PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT` |
| E4 | Website `ai_production_cloud_write_receipts` | 同 job、`write_kind=artifact`、同 payload_hash 回执已存在（旧 attempt `21e4e021`、`d818baac`）；约束 `ai_production_cloud_write_rec_job_id_write_kind_payload_has_key` = `UNIQUE(job_id,write_kind,payload_hash)`（`0071_ai_production_control.sql:183`），覆盖全部 write_kind |
| E5 | Website `ai_production_job_events` | 两旧 payload 已被 `result_revision_rejected_v1` 拒收；同 payload_hash 的旧 `business_result_ready` 事件已存在，`result_payload_ref` 指向旧 attempt slot |
| E6 | Website `output-artifact-routes.ts` `insertArtifactWriteReceipt` | 事务内普通 insert；unique_violation 非 `ApiError`，经 `api-unix-socket-server.ts:84` 成 500 并整体回滚；当前 slot 无 artifact 行。代码路径与数据一致的推断（Postgres 日志只到 08-26，Website stdout 已随进程消失） |
| E7 | AGENT `runtime-claim.ts` | `isResultTransportBoundary`（51-62）：5xx 与 `PRODUCTION_OUTBOX_*` 为边界 → `handleRuntimeBoundaryFailure`（accepted 时仅 `setCurrentReason`，不上报）；`completeClaim`（331）在内层 try 外，其一切错误同样进入 `handleRuntimeBoundaryFailure`；只有 `executeAndUpload` 内非边界错误走 `persistAttemptFailure`（插件包装为 `RESULT_SETTLED_UNUSABLE` + settled hash，`production-browser-lifecycle.ts:222-236`）→ Website settled-result 拒收（`job-lifecycle-repository.ts:55-80`，置 `attempt_id=null`）→ 新 attempt |
| E8 | Website events / failures | 两 job 当前 attempt 起零条 failure；`attempt_lease_expired_v6(ATTEMPT_LEASE_EXPIRED_READBACK_PENDING)` 与 `job_lease_regranted_v6(same_accepted_attempt=true)` 交替（f88390fa lease 7→50，2839cd99 →106）；最后续租 2026-09-17 16:11，此后因 AGENT 未再 claim 暂停 |
| E9 | Website `job-terminal-repository.ts:81` + `job-repository-core.ts:25-49` | `business_result_ready` 幂等键 `${job_id}:${result_payload_hash}:business-result-ready` 不含 attempt；`on conflict do nothing` 后按 evidence_hash 读回，不一致抛普通 `Error("AI_PRODUCTION_EVENT_READBACK_MISMATCH")` → 500 回滚；该键无任何读取方 |
| E10 | Website `job-expired-attempts.ts:36` vs `job-claim-repository.ts:218` | 租约过期且 readback-pending 时**保留** `staged_result_json`、不 orphan artifact；随后同 attempt 续租 claim 却**无条件** `staged_result_json=null` |
| E11 | Website `output-artifact-routes.ts` `bindResultPayload`（image）、`bindResultEnvelope`（payload）、`job-terminal-repository.ts` `assertCompletedArtifact` | 三处以 `lease_version=当前` 查 staged artifact；artifact slot 自 0084 起为 `attempt_id:role` 且 `unique(job_id,artifact_slot,role)` |

## 3. Scoped candidate

**AGENT** `/Users/nexgen/Documents/AGENT`，main，HEAD `47d1a8d7aaeb45ab7aac4bf278dc97e1d30fa390`（施工开始时；授权人 2026-09-18 已整体提交既有工作树）：

| 路径 | blob | 状态 |
|---|---|---|
| `src/lib/local-runtime/production/store-outbox.ts` | `eb2b28f7d3be492c0beac795daaee5e05e4162c8` | clean（施工） |
| `scripts/acceptance/agent-production-runtime-recovery-contract.acceptance.ts` | `3c7874a506bbe4b0ee84fab199ec7ee77ebd7c91` | clean（施工） |
| `src/lib/local-runtime/production/cloud-client.ts` | `f062438af15dfd3afe3a6d943201f6556917e683` | clean（依赖） |
| `src/lib/local-runtime/production/store-task-state.ts` | `dfbbbe03f3e2369d657823dab81cc8567ec764aa` | clean（依赖） |
| `src/lib/local-runtime/production/runtime-claim.ts` | `33de4ce736d4045ec5963524b29ec973db2fe85e` | clean（依赖） |
| `docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md` | `55076092003f42780708604e2d08087ec69ff580` | clean（权威） |
| `src/lib/local-runtime/production/transport-failure.ts` | `3b090051e8f2694a312923fd175baf6a9fa08ab1` | clean（依赖，A-WO2 import） |
| `src/lib/local-runtime/production/store-foundation.ts` | `ea539afcc55c126df66e78bb5bcf963b694d1cfa` | clean（依赖：`json` = `JSON.stringify`，第 66 行） |
| `src/lib/execution-failure.ts` | `a1c7ae79153ae36969fdca24f5e849581e753acb` | clean（依赖：`executionFailure`/`failureCode`） |

AGENT 施工开始时无关 overlay 已随 47d1a8d7 提交，index 为空。

**Website** `/Users/nexgen/Documents/xuanxue-web`，main，HEAD `870cd09a4261f9bdc4c13a504f38f736666642a3`（施工开始时；授权人 2026-09-18 已整体提交既有工作树，§3 “混合候选”已不存在）：

| 路径 | blob | 状态 |
|---|---|---|
| `services/api/src/ai-production/output-artifact-routes.ts` | `e0931cebb6baf4937bade620ac9101c2b3dac44e` | clean@870cd09a（施工） |
| `services/api/src/ai-production/job-terminal-repository.ts` | `7ae66413fb88c712dd03bc10a18c0051af510bd6` | clean（施工） |
| `services/api/src/ai-production/job-claim-repository.ts` | `8920036ca3e62c146f57c627f2b63ce2925420c3` | clean@870cd09a（施工 1 处 SQL 表达式；HEAD 已 504 行，既有 FILE_BUDGET） |
| `tests/exam/ai-production-v6-contract.test.ts` | `1aa86e1ea43514f2b2f63817b82789ffd8d34f59` | clean@870cd09a（施工；追加） |
| `scripts/audit/domains/ai-acceptance/manifest.json` | `f2e9e9498f2f3ca6dd3658c914f273aeeeceb9a2` | clean@870cd09a（施工；追加 0141/0142 两行） |
| `scripts/audit/generated/law-registry.generated.json` | `9c478d71b0207617888a01c42fe148833ab0a2c2` | clean@870cd09a（生成物，`pnpm audit:build` 重生成） |
| `data/migrations/commercial/0071_ai_production_control.sql` | `82c1c61cf003b5f200ce14089dc78db2e2534d42` | clean（约束来源） |
| `data/migrations/commercial/0140_generated_image_source_geometry.sql` | `4a7f0d0c91c303608a089d0a74e2ec43337b9197` | clean@870cd09a（已应用，不修改） |
| `services/api/src/ai-production/business-result-consumer.ts` | `6cfccf797bcc056e8e1583c7c0cc3b014980cfd2` | clean（施工 1 处 WHERE + 删除残留 `lease_version` 字段） |
| `services/api/src/ai-production/job-lifecycle-repository.ts` | `6a53ef8d458e35fa294e888914ad093fbd66988d` | clean@870cd09a（施工 2 处 WHERE） |
| `services/api/src/ai-production/job-expired-attempts.ts` | `b36f975772554115d7b6fa61f3cbd061480e8625` | clean（依赖） |
| `services/api/src/ai-production/job-lifecycle-core.ts` | `e390e7e1e6f62b259737ebd4105a2e319ebc8873` | clean（依赖：`lockV6Lease`、`persistWrite` 无 ON CONFLICT） |
| `scripts/generate/apply-commercial-migrations.ts` | `34687029cee2928628d6d61fc3cd866b37eb319f` | clean（依赖：迁移 runner 与 `--verify`） |
| `start.sh` | `f61f91bb40c76672b64291657833e93687a93f90` | clean@870cd09a（依赖：重启入口，含 `LC_ALL=C` 修复） |
| `.github/instructions/agent-rules/功能法案.md` | `1231fda044258fca79339bb8216c742540e3a2e2` | clean@870cd09a（权威，不修改） |

Website 既有在施改动（图片几何 0140、V6 v34 stopped-empty/013-V14、`start.sh` `LC_ALL=C`）已由授权人在 HEAD 870cd09a 提交。**提交边界裁决**：本方案两仓改动在第四步由 ci-full-governance 以原生 clean Git commit 按精确路径提交，各仓独立，不夹带无关路径。

## 4. 现役实现与连续性裁决

| 单元 | Owner | 裁决 |
|---|---|---|
| 回执 `UNIQUE(job_id,write_kind,payload_hash)` | Website ai-acceptance | **删除**。写入幂等由 `unique(worker_session_id,request_id)` 承担。逐 kind：artifact 的 payload_hash 为内容 hash，跨 attempt 同内容合法（本故障）；terminal/cancel/lease_release/renew/provider_cooldown 的 payload_hash 为含 request_id/lease 的请求体 hash，本就唯一，约束对其无去重作用。读取方：`replayWrite`/`artifactReplay`（session+request）、`job-device-status-repository.ts:124-130`（`order by created_at limit 1` 与聚合）、provider-cooldown（request）、AGENT `hydrateOne`（request_id）——均不依赖该唯一性 |
| `business_result_ready` 幂等键 | Website ai-acceptance | **原位加 attempt_id**，与 `business-result-consumer.ts:280` 拒收键同构；无读取方 |
| claim 同 attempt 续租清 `staged_result_json` | Website ai-acceptance | **原位改为仅新 attempt 清空**，与 `job-expired-attempts.ts:36` 的 readback-pending 保留语义一致 |
| staged artifact 按 `lease_version` 绑定（3 处） | Website ai-acceptance | **原位改为按当前 attempt slot**。`LAW-AI-ACCEPTANCE-012-V31` 与 AI-ACCEPTANCE-BLUEPRINT 第 129 行原文为“当前 lease_version/attempt”；slot 唯一约束保证每 role 一行；新 attempt 由 claim（`job-claim-repository.ts:209`）统一 orphan |
| lease 范围 orphan（`job-lifecycle-repository.ts:73-74`、`:127-130`，`business-result-consumer.ts:288-291`） | Website ai-acceptance | **原位改为 attempt 范围**。绑定改为 attempt slot 后，若 orphan 仍按 lease，同 attempt 早先 lease 暂存的行在拒收/释放后仍为 staged，违反 AI-ACCEPTANCE-BLUEPRINT 第 129 行“旧 revision 标记 orphaned”；三处均可取得 attempt_id，WHERE 替换为 0 净行；consumer 文件随之删除 2 处残留 `lease_version`（净 −1 行） |
| AGENT `enqueue` 含 fence 判同身份 | AGENT Outbox | **原位修改**。fence 为当次授权（V6 蓝图 273/274）。连续性：已退休的 `reauthorizeStaleCheckpoint`/`deliverReauthorizedStaleCheckpoint`（`caf0d6a0e`，随 checkpoint 运输 0114 一并删除）作用于 GPT checkpoint 运输；本单作用于 Website 对同一 accepted attempt 重新签发 grant 后的同一结果 artifact，属蓝图 208 行明示的同 attempt 读回收敛，不恢复 checkpoint、不新增重投器；`recovery-boundary.acceptance-support.ts` 禁止的符号名均不引入 |
| AGENT artifact / terminal requestId、`deliverOutbox`、`acceptTask`、`isResultTransportBoundary`、`completeClaim` | AGENT Runtime | 复用 |

结构：AGENT 红线 500/75/16，`store-outbox.ts` 336 行、`enqueue` 22 行。Website 红线 500/75/16：`output-artifact-routes.ts` 327、`job-terminal-repository.ts` 198 行有余量；`job-claim-repository.ts` 504 行的既有 FILE_BUDGET 由他方在施改动造成（HEAD 491 行），本方案对其为 0 净行的一处 SQL 表达式替换，不加剧、不承担其重构。

## 5. 四维映射

| 维度 | 事实 |
|---|---|
| 法案 | AGENT `LAW-AGENT-PRODUCTION-RUNTIME-001-V63`（功能法案第 49 行）、`004-V35`（第 179 行）。Website `LAW-AI-ACCEPTANCE-012-V31`（功能法案第 802 行：attempt slot；“当前 lease_version/attempt”；不得删旧 artifact、覆盖旧 receipt、增表）；功能法案第 808 行（consumer 不得对同一 `job_id + result_payload_hash` 重复不可逆副作用，领域事务按 job_id 幂等）——W-WO2 使同 payload 在新 attempt 再次进入 consumer：拒收支只追加 `failure_ledger` 与含 attempt 键的事件（`localization-job-repository.ts:250-271`），不可逆副作用为零；成功支按 job_id 幂等并写 admission receipt，与该条一致。Website 修改均不删改任何数据行，无需修法。 |
| 施工图 | AGENT V6 蓝图第 208 行（同 attempt 换 lease/fence 只读回同一 effect）、273 行（按 `job_id + attempt_id + result_hash` 幂等交付）、274 行（旧 fence 写入拒绝）；Website AI-ACCEPTANCE-BLUEPRINT 第 129 行。 |
| 现役实现 | D1–D4（§6）。 |
| 质检 | AGENT：`npm run typecheck`、`npm run acceptance:agent-production-runtime`、`npm run quality:check`。Website：`pnpm typecheck`、`pnpm exec tsx --test tests/exam/ai-production-v6-contract.test.ts`、`pnpm quality:check`。各仓独立。 |

## 6. 第一直接断裂（链路顺序）

| # | Owner / 位置 | 实际 | 期望 | 为何无界 |
|---|---|---|---|---|
| D1 | Website `insertArtifactWriteReceipt` | 旧 attempt 同 payload 回执 → unique_violation → 500 | 同内容新 attempt 正常暂存 | 5xx 为边界，不上报（E7） |
| D2 | AGENT `enqueue` | 续租后仅 fence 不同 → `PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT` | 以当前 fence 重授权同一意图 | `PRODUCTION_OUTBOX_*` 为边界 |
| D3 | Website terminal `announceResultReady` | 旧 attempt 同 payload `business_result_ready` 键已占且 evidence 不同 → 500 | 每 attempt 独立 ready 事件 | terminal 失败一律不上报 |
| D4 | Website claim + 3 处 lease 绑定 | 暂存后同 attempt 续租：`staged_result_json` 清空、按新 lease 查不到 staged → envelope/terminal 409；AGENT A3 返回已交付回执不重传 | 同 attempt 暂存跨续租有效 | terminal 失败一律不上报 |

当前两 job 必经 D1→D2→D3；D4 在任一次续租落在暂存与 terminal 之间时必经（本事故每 job 续租数十次）。

## 7. 有限闭环分母

### AGENT `enqueue` 同键既存行

`sameIntent`：kind、path、method、body 相同，且删去 `x-ai-execution-fence-hash` 后 headers 相同（其余 header 由代码字面量顺序生成，`json`=`JSON.stringify`）。

| # | 条件 | 决定 | 终态 |
|---|---|---|---|
| A0 | 无既存行 | 插入 | 发送 |
| A1 | `!sameIntent` | 抛冲突（现状） | 真实漂移 fail closed；provider_cooldown 续租后 body 含 lease/fence 必落此支 |
| A2 | headers 全等 | 返回（现状） | delivered 返回回执；有 `last_error` 抛该错，同 lease 不重放 |
| A3 | fence 不同，`sent_at` 非空 | 返回 | 返回已存回执；Website 侧由 D4 修复保证当前 lease 可绑定同 attempt 暂存 |
| A4 | fence 不同，`sent_at` 空，`last_error` 为 null 或非 `WEBSITE_ATTEMPT_REPLACED`（含崩溃在途、5xx、传输失败、`WEBSITE_HTTP_409:AI_LEASE_FENCE_STALE`） | `update headers_json=当前, last_error=null where idempotency_key=? and sent_at is null` | 以当前 fence 发送：成功 → 主链；4xx → 上报；5xx/STALE → 本 lease 记录，下次续租再 A4 |
| A5 | fence 不同，`sent_at` 空，`last_error = WEBSITE_ATTEMPT_REPLACED` | 返回 | 抛 `WEBSITE_ATTEMPT_REPLACED`，不复活 |

A4 为后写覆盖、不比较 lease 新旧。并发情形：A4 改写后若旧 lease 的在途发送回写 `WEBSITE_HTTP_409:AI_LEASE_FENCE_STALE`，同 lease 内再次 `deliverOutbox` 抛 `PRODUCTION_STALE_FENCE_REAUTHORIZATION_REQUIRED`（`store-outbox.ts:304-306`），该码不在边界集合 → `persistAttemptFailure` 上报 → Website 裁决（新 attempt），有界。

### Website（修复后）

| # | 条件 | 终态 |
|---|---|---|
| W1 | 同 job 旧 attempt 有同 payload 回执 | 回执插入，201 staged |
| W2 | 同 attempt 续租后上传 envelope / 文章 payload | 按 `attempt_id:result_payload` / `attempt_id:generated_image` slot 绑定 staged，201；内容不符仍 409（上报 → 新 attempt） |
| W3 | 同 attempt 续租后 terminal | `staged_result_json` 保留；按 `attempt_id:%` 统计 staged receipt；`business_result_ready` 按 attempt 写入 → first terminal 成功 → 领域 consumer：admission 或 `result_revision_rejected_v1`（键含 attempt_id）→ 新 attempt |
| W4 | 上传 slot 冲突（artifact 已 orphan 或内容不同） | 409 → AGENT 上报 → 新 attempt |
| W5 | 旧 fence | 409 `AI_LEASE_FENCE_STALE`（现状）→ A4 下次续租重发 |
| W6 | 新 attempt | claim 清 `staged_result_json` 并 orphan 全部 staged（现状） |
| W7 | 其他 5xx / terminal 失败 | 无当前证据；若动态验收出现，停止并另立问题（§9.3） |

## 8. 删除审判与原子工单

| 候选 | 裁决 | 依据 |
|---|---|---|
| W-WO1 删回执 payload 唯一约束 | 保留 | 删则 D1 永久 500 |
| W-WO2 `business_result_ready` 键含 attempt | 保留 | 删则 D3 永久 500（E9 数据已命中） |
| W-WO3 同 attempt 暂存跨续租（claim + 3 处绑定） | 保留 | 删则 D4 永久 409，且 terminal 不上报 |
| A-WO1 enqueue 去 fence 判定 | 保留 | 删则 D2 永久本地冲突 |
| slot 冲突同内容重放 | 删除 | 其分支 W4 在上传阶段为 4xx 可上报，有界 |
| 让 `completeClaim` 4xx 上报 / 调整边界集合 | 删除 | 需重定义 terminal 阶段 mutation_outcome 与 settled hash 语义，超出本故障；D3/D4 修复后当前分母内 terminal 无确定性错误 |
| W-WO3 第 8 步 orphan 改 attempt 范围 | 保留 | 删则绑定改 attempt 后早先 lease 的暂存在拒收/释放后仍为 staged，违反蓝图第 129 行 |
| 为测试导出内部函数 | 删除 | 静态源码断言即可取证（W-WO4），无需扩大导出面 |
| upload 前拦截已拒收 hash | 删除 | 领域 consumer 已确定性拒收并签发新 revision |
| fence 进键 / 续租 supersede / 删行 / 发送时注入 fence | 删除 | 违反蓝图 273 行、仍冲突、丢事实或需兼容既存行 |
| 手工改两库既存行 | 删除 | 修复后自然续租经 A4 收敛 |

### BP-WO 施工图对齐与冻结（双仓，先于一切代码）

- 依据：法案全量遍历结论——无需修法（004-V25 第 46 行、012-V31 第 105/110/111 行、002-V26 允许真实 schema 删除迁移）；但 Website AI-ACCEPTANCE-BLUEPRINT 原第 139 行“不保留…旧 fence 重授权或恢复发送”与 A-WO1 语义存在歧义，必须先对齐。
- Website `docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md`：§4 增写回执唯一身份与 0141 边界；§5 增写 `business_result_ready` 按 attempt 幂等、staged 按 attempt slot 绑定并跨同 attempt 续租有效、拒收/释放按 attempt 范围 orphan；§6 改写并冻结 `FROZEN-SAME-ATTEMPT-RESULT-REDELIVERY-001`；§9 增验收第 11 条。
- AGENT `docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md`：§8 第 12 条增写同一冻结条款（Outbox 交付身份不含 fence）。
- 关联措辞：施工图 §4 删除 0139 的“当前唯一前向migration”表述（0141/0142 存在后不成立）；§6 导语改为“Website 不接受任何旧 fence 请求，不保留跨 attempt Outbox 或第二恢复发送链”。
- 冻结强制：Website 在 `scripts/audit/domains/ai-acceptance/check.ts` 的 `LAW-AI-ACCEPTANCE-013-V14` 断言 tokens 追加 `FROZEN-SAME-ATTEMPT-RESULT-REDELIVERY-001`（该组 corpus 覆盖 ai-acceptance 施工图）；AGENT 因 007-V37 禁止字符串包含产生 PASS，冻结由 A-WO2 行为验收强制，不新增文本检查。
- 不修改任何法案、合同 spec 或合同版本（V6 manifest 无受影响字段，`late_old_fence_policy=reject` 保持）。

### W-WO1 删除回执 payload 唯一约束（Website）

- 前置：已取得迁移执行授权；`xuanshu_schema_migrations` 中 0140 注册 hash 等于当前文件 hash（否则 runner 以 `COMMERCIAL_MIGRATION_HASH_DRIFT` 失败，停止并交还在施方案 Owner）。
- **落盘与执行同步**：未获迁移授权时不创建迁移文件、不改 manifest（磁盘上存在未登记迁移会使 `start.sh` 第 789 行 `--verify` 以 `COMMERCIAL_MIGRATION_HEAD_MISSING` 失败，阻断任何人的 Website 重启）。获授权后在同一步内：创建文件 → 追加 manifest → `pnpm audit:build` → 执行迁移 → `--verify` → 向 W-WO4 测试追加断言 1 并重跑该测试文件。
  - 执行：`XUANSHU_DATABASE_PROFILE_FILE="$HOME/Library/Application Support/Xuanshu/PostgreSQL/profiles/xuanshu-migrate.json" pnpm db:migrate:commercial`。
  - 核验：`XUANSHU_DATABASE_PROFILE_FILE="$HOME/Library/Application Support/Xuanshu/PostgreSQL/profiles/xuanshu-migrate.json" pnpm exec tsx scripts/generate/apply-commercial-migrations.ts --verify`。
  - 执行失败（锁超时、`COMMERCIAL_MIGRATION_HASH_DRIFT` 等，`xuanshu_schema_migrations` 未写入 `<N>`）：同一步删除本方案新建的迁移文件与 manifest 条目，重跑 `pnpm audit:build`，以 `--verify` 头回到 0140 为准后停止，不留未登记迁移。
- 编号：施工时取 `data/migrations/commercial/` 当前最大编号 +1（本方案写作时为 `0141`，下文以 `<N>` 表示），W-WO4 断言 1 与 manifest 同步使用该文件名；施工图 §4 已写明 0141，若取号不同须同步改该段。
- 新增 `data/migrations/commercial/<N>_ai_production_write_receipt_payload_not_unique.sql`：
  ```sql
  set local lock_timeout='5s';
  set local statement_timeout='30s';

  alter table ai_production_cloud_write_receipts
    drop constraint ai_production_cloud_write_rec_job_id_write_kind_payload_has_key;
  ```
- `scripts/audit/domains/ai-acceptance/manifest.json`：在 `0140_generated_image_source_geometry.sql` 条目后追加该路径；`pnpm audit:build`。
- 门槛：迁移后 `--verify` 头为 `<N>`；只读 `pg_constraint` 该表唯一约束仅剩 `…worker_session_id_request_id_key`。
- 回退：迁移失败即事务回滚停止。修复生效后同 payload 多条回执即为预期数据，约束不可恢复；需要回退时只回退代码，不恢复该约束。

### W-WO1b 恢复按 job 读取回执的索引路径（Website，施工审查 F2 新增）

- 依据：删除唯一约束同时删除了其附带索引，`job-device-status-repository.ts` 按 `job_id` 读回执退化为全表扫描（实测 19ms / 15227 行）。0141 字节已登记不可改，故以前向 `data/migrations/commercial/0142_ai_production_write_receipt_job_index.sql` 建非唯一 `(job_id, write_kind)` 索引；施工图 §4 同步写明，manifest 登记，W-WO4 追加该迁移断言。已应用，实测回落 0.15ms。
- 删除反事实：删去本单即保留本方案自身引入的性能退化，不可删。

### W-WO2 `business_result_ready` 按 attempt 幂等（Website）

- `job-terminal-repository.ts` `announceResultReady`：`idempotencyKey` 改为 `${row.job_id}:${row.attempt_id}:${completedResult.result_payload_hash}:business-result-ready`。不加 attempt 空值检查：`announceResultReady` 只在 `assertCompletedArtifact` 之后调用，且 `accepted_at` 已前置校验（删除反事实：检查不可达）。

### W-WO3 同 attempt 暂存跨续租有效（Website）

1. `job-claim-repository.ts:218`：`staged_result_json=null,` → `staged_result_json=case when $11::boolean then staged_result_json else null end,`（`$11` 即现有 `continuingAcceptedAttempt`；0 净行）。
2. `output-artifact-routes.ts` `persistResultObjectAfterLock`：由 `artifactSlot` 取 attempt 前缀，局部变量固定命名为 `attempt`（`const attempt = artifactSlot.slice(0, artifactSlot.lastIndexOf(":"))`），传入 `bindResultPayload`、`bindResultEnvelope`，替换其 `leaseVersion` 参数。
3. `bindResultPayload` image 查询 `and lease_version=$2` → `and artifact_slot=$2`，值 `${attempt}:generated_image`。
4. `bindResultEnvelope` payload 查询 `and lease_version=$2` → `and artifact_slot=$2`，值 `${attempt}:result_payload`。
5. `job-terminal-repository.ts` `assertCompletedArtifact`：`and lease_version=$2` → `and artifact_slot like $2`，值 `${row.attempt_id}:%`；不加空值检查——`null:%` 匹配零行即落入现役 409 `AI_V6_COMPLETED_RESULT_RECEIPT_INVALID`。
6. `insertResultObject` 仍写 `lease_version`（保留审计事实）。
7. 不新增导出。
8. 三处 orphan 由 lease 范围改为 attempt 范围（参数由 `lease_version` 换为 `<attempt_id>:%`，0 净行）：
   - `business-result-consumer.ts:288-291`：`and lease_version=$2` → `and artifact_slot like $2`，值 `${current.attempt_id}:%`。
   - `job-lifecycle-repository.ts:73-74`（settled-result 拒收）：`and lease_version=$2` → `and artifact_slot like $2`，值 `${input.release.attempt_id}:%`。
   - `job-lifecycle-repository.ts:127-130`（lease release）：同上，值 `${input.release.attempt_id}:%`。
9. `business-result-consumer.ts`：第 8 步后 `ResultRevisionRuntimeRow.lease_version`（约第 251 行）与查询列 `r.lease_version`（约第 263 行）不再被使用，同工单删除；门槛：该文件 ≤500 行（当前 499）。

### W-WO4 Website 验收

`tests/exam/ai-production-v6-contract.test.ts` 末尾追加一个测试，以 `readFile` 读取源码做静态断言（被改 SQL 所在函数依赖完整文章包、`WebsiteAgentResultV1` envelope 或会话/路由 fixture，现有测试无可复用 fixture，静态断言为最短可取证据）：
1. 迁移 `<N>_ai_production_write_receipt_payload_not_unique.sql` 只含 `alter table ai_production_cloud_write_receipts drop constraint ai_production_cloud_write_rec_job_id_write_kind_payload_has_key` 一条 DDL，无 `drop table`/`delete`/`update`/`add constraint`（仅在 W-WO1 已落盘时执行本断言；未获迁移授权时本测试不写入该断言）。
2. `output-artifact-routes.ts`：整文件不含 `lease_version=$2`；含字面量 `` `${attempt}:generated_image` `` 与 `` `${attempt}:result_payload` ``（W-WO3 第 2 步变量名固定为 `attempt`），且 `bindResultPayload`、`bindResultEnvelope` 函数体各含 `artifact_slot=$2`。
3. `job-terminal-repository.ts`：整文件不含 `lease_version=$2`；幂等键匹配正则 ``/idempotencyKey: `\$\{row\.job_id\}:\$\{row\.attempt_id\}:\$\{completedResult\.result_payload_hash\}:business-result-ready`/``。
4. `job-claim-repository.ts` 含 `staged_result_json=case when $11::boolean then staged_result_json else null end`，不含 `staged_result_json=null,`。
5. 以正则 ``/set state='orphaned'[^`]*artifact_slot like \$2/g`` 计数：`business-result-consumer.ts` 恰 1 处，`job-lifecycle-repository.ts` 恰 2 处；两文件均不含 `state='staged' and lease_version=$2` 与 `lease_version=$2 and state='staged'`。

门槛：`pnpm typecheck`、该测试文件通过；`pnpm quality:check` 如实记录（见 §10）。

### A-WO1 enqueue 以当前 fence 重新授权（AGENT）

- `src/lib/local-runtime/production/store-outbox.ts`：
  1. 顶部新增私有纯函数 `headersWithoutExecutionFence(headersJson: string): string`（parse → delete `"x-ai-execution-fence-hash"` → stringify）；header 名与 `"WEBSITE_ATTEMPT_REPLACED"` 各只用一次，按删除原则以字面量内联，不设常量。
  2. `enqueue` 既存行 select 增加 `sent_at,last_error`。
  3. 按 §7：非 `sameIntent` → 抛冲突；headers 全等、`sent_at` 非空或 `last_error === "WEBSITE_ATTEMPT_REPLACED"` → `notifyOutbox` 后返回；否则执行 A4 update 后 `notifyOutbox` 返回。
- 门槛：`npm run typecheck`；`enqueue` ≤75 行、复杂度 ≤16。

### A-WO2 AGENT 验收

`scripts/acceptance/agent-production-runtime-recovery-contract.acceptance.ts`，现有场景后、`store.close()` 前，独立 job `job:regrant-fence`；artifact path 固定为 `/internal/ai-production/v6/jobs/${encodeURIComponent("job:regrant-fence")}/artifacts/result_payload/airesult_regrant`，body/content headers 固定，仅 fence 变化：
1. `acceptTask(job,"attempt:1")` → `LEASE_GRANTED`；fence A `enqueue`；`deliverOutbox` 以 `runtimeTransportFailure("INTERNAL_ERROR", 500)` 失败；fence A 再 `deliverOutbox` 抛 `INTERNAL_ERROR` 且 send 未调用（A2）。
2. `acceptTask(job,"attempt:1")` → `LEASE_REGRANTED`；fence B `enqueue` 不抛；`readOutboxAuthority(key).lastError === null`；send 回调内断言 `write.headers["x-ai-execution-fence-hash"] === B`，返回后 `state === "delivered"`（A4）。
3. fence C `enqueue` 同键不抛；`deliverOutbox` 不调用 send 并返回原回执（A3）。
4. 同键 body 改变 → 抛 `PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT`（A1）。
5. 第二键（同 job 前缀）fence A 入队，`deliverOutbox` 以 `runtimeTransportFailure("AI_LEASE_FENCE_STALE", 409)` 失败 → `lastError === "WEBSITE_HTTP_409:AI_LEASE_FENCE_STALE"`；`acceptTask(job,"attempt:1")`；fence B `enqueue` 后 `lastError === null` 且可交付（A4-STALE）。
6. 第三键（同 job 前缀）fence A 入队未发送；`acceptTask(job,"attempt:2")` 使其 `WEBSITE_ATTEMPT_REPLACED`；fence B `enqueue` 不抛，`deliverOutbox` 抛 `WEBSITE_ATTEMPT_REPLACED` 且 send 未调用（A5）。

施工偏差（已核）：各场景 path 以 key 区分（`regrantPath(key)`），不用固定 `airesult_regrant`；场景 6 切换到 attempt:2 前先 `recordAttemptFailure(attempt:1)`（`acceptTask` 新 attempt 分支的前置状态）；场景 1 另断言同 fence 再 `enqueue` 保留 `INTERNAL_ERROR`；场景 4 另断言只改非 fence header 也冲突；场景 5 断言以 fence B 送达。

局限：本脚本只证明 AGENT 本地；跨 lease 的 Website 绑定由 W-WO4 与 §9 动态 readback 证明。门槛：`npm run acceptance:agent-production-runtime`、`npm run quality:check`。

### 顺序与兼容

1. Website：W-WO2 → W-WO3 → W-WO4 →（获迁移授权时）W-WO1 同步落盘并执行 →（获部署授权时）重启 Website（`./start.sh`）。
2. AGENT：A-WO1 → A-WO2 →（获授权时）重启 AGENT（`npm run grasseye:start`）。

任意先后部署无不兼容窗口：Website 各项为放宽或保留既有语义；AGENT 仅改本地判定；任一侧先上线时循环持续但不产生新错误类型。

回退（只反向本方案精确改动）：
- Website：只反向本方案列出的精确改动——W-WO2 的幂等键模板、W-WO3 第 1–5 步与第 8–9 步的 SQL/参数/字段、W-WO4 追加的测试；W-WO1 一旦执行，迁移文件与 manifest 条目保留、约束不恢复。
- AGENT：提交前按 A-WO1/A-WO2 精确反向；提交后 `git revert <本方案提交>`。

## 9. 分层验收

1. 各仓质检按 §5 执行并如实记录。
2. 动态 readback（两仓重启后只读；E8 循环已暂停，需 AGENT 运行并重新 claim 两 job 才会触发）：
   - AGENT：E1 两行 `sent_at` 非空、`last_error` 空；log 不再出现 `PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT`；同 attempt `aipterminal_…` delivered。
   - Website：两当前 attempt 的新 artifact 回执（与 E4 旧回执同 payload_hash 共存）、`<attempt>:result_payload` / `<attempt>:result_envelope` artifact 行、以含 attempt 的键新增 `business_result_ready` 事件、`job_terminal_v6`。
   - 终点（二选一）：business admission receipt 且 AGENT `status=completed`；或当前 attempt 的 `result_revision_rejected_v1` 已持久化且随后 `job_lease_granted_v6(same_accepted_attempt=false)`。
3. 失败关闭：出现任一 5xx，或当前 attempt 仍在同 attempt 续租中无领域裁决 → 判定未达终点，保留证据停止；不以 staged、delivered 或测试 PASS 冒充终点。

## 10. 授权前置与停止条件

- Website 授权：迁移执行（W-WO1/W-WO1b）与服务重启相互独立，均已由授权人 2026-09-18 授权（数据库操作）。缺迁移授权时 W-WO1 不落盘，D1 未修复，§9.2 终点不可达，只完成其余工单与静态验收并如实报告。
- Website `pnpm quality:check`：HEAD 870cd09a 已包含法案与在施改动，本方案不修改法案；质检按 ci-full-governance 在第四步执行，既有 `job-claim-repository.ts` FILE_BUDGET 若阻断 READY，按 CI-FULL 同一故障鉴权后在同候选内处理。
- AGENT A-WO2 新增 `store.enqueue(` 行命中 `high-impact-detector` queue 检测，`quality:check` 需用户明确授权 `GRASSEYE_HIGH_IMPACT_AUTHORIZED=1`；不得改写测试规避。
- 两仓服务重启由用户执行或明确授权。
- §9.2 动态证据只证明当次候选运行结果，不单独构成 READY / RELEASE 依据。
- 不修改任何法案与合同；施工图只按 BP-WO 修改。如需修法或改合同，停止回到设计。
- §3 任一 blob 漂移或目标文件出现无法区分的新改动 → 停止重核。

## 11. 执行 Claude 重绑定要求

施工前：读两仓 `AGENTS.md`；按 §3 逐项 `git hash-object` / `git status` 复核；重读 AGENT `store-outbox.ts`（`enqueue`、`deliverOutbox`、`recordDeliveryFailure`）、`runtime-claim.ts`（`isResultTransportBoundary`、`completeClaim`、`handleRuntimeBoundaryFailure`），Website `output-artifact-routes.ts`、`job-terminal-repository.ts`、`job-claim-repository.ts:207-230`、`job-expired-attempts.ts`、0071 约束名、0140 注册 hash；只读确认两 job 当前 attempt 未变（若已变，动态验收改用下一次同类事件或保持构造性验收）。提交：AGENT 的无关 overlay 已在 index 暂存，`git commit -- src/lib/local-runtime/production/store-outbox.ts scripts/acceptance/agent-production-runtime-recovery-contract.acceptance.ts "docs/项目方案/同attempt续租结果上传幂等冲突-完整实现方案.md"` 按精确路径提交，index 中无关暂存不进入提交；Website 按 §3 提交边界裁决以精确路径提交。A-WO2 需新增 `import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js"`（按该脚本现有相对路径风格）。完成后只按 §9 报告实际结果，不把测试 PASS、staged 或 delivered 表述为业务完成或 RELEASE。

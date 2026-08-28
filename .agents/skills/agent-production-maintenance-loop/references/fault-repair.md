# 故障定责、重构、清理与复跑

## 1. 先冻结现场

首次故障立即停止发布下一任务。固化 job/source/request、attempt、lease/fence、checkpoint、Outbox、Browser mutation、Target/Document、网站 terminal/consumer 以及双仓日志源。不要先删任务、重启链路、关闭 GPT 页面或打开新页面。

按 mutation 状态分流：

- 无 mutation、`PREPARED` 或 dispatch 前 `FAILED`：确认没有外部动作后，按 Owner 合同完成失败终态和清理。
- `DISPATCHED`：只在原 Target/Document 上按冻结正反后置条件做只读对账；禁止重发、刷新、关闭/重建 Target、重启链路或 selector 广扫。观察次数受现役 Owner 的有限预算约束，最迟不得超过任务冻结的 `delivery_deadline_at`。
- `CONFIRMED` 或 `REJECTED`：尊重既有事实，不再次执行同一动作。
- 尚未到 Browser 层：记录 `BROWSER_NOT_REACHED`；不得为了“实证”额外发送 GPT/Browser 动作。

只在旧 mutation 已明确终结、旧任务安全收口后，才能用新的 diagnostic job 和全新身份复现。

只读观察本身不改变 WAL、job 或 recovery 状态，也不能补造缺失的 provider receipt。只有现役 Browser reconciliation Owner 能按当前合同生成独立 reconciliation record 并执行单调转换：正向后置条件成立则确认既有 mutation 并恢复原 job；反向成立则拒绝/失败原 job；无法判断则在 `delivery_deadline_at` 到期后 typed final failure。不得用全新 job 代替正向确认后的原 job 恢复。Owner、正式 API/命令或消费链未接通时返回 `DISPATCHED_RECONCILIATION_OWNER_UNAVAILABLE`，禁止清理 Target、创建 diagnostic job 或复跑。

## 2. Chrome 插件实证

在唯一 Browser Authority 下检查真实 Chrome/GPT 现场：原 Target/Document、页面身份、DOM、新鲜候选、动作前状态、WAL、直接后置条件、GPT child、下载/产物和 cleanup。不得操作人工页面，不得绕过认证、2FA、验证码或风控。

`DISPATCHED` 只能观察。没有安全可判定的后置条件时记录外部结果未知并停止，不能用新动作“试一下”。

## 3. 联合结构化日志定责

跨仓事故从 xuanxue-web 运行唯一联合检查器，显式传入网站与 AGENT 日志源：

```bash
pnpm logs:inspect:website -- --job <job_id> --source <website-log> --source <agent-log>
```

它必须同时解析网站数据库 authority、AGENT Production Store 和 Browser WAL。只有 `DIAGNOSIS_COMPLETE` 且 boundary、authority、freshness、integrity 与全部 blocking roots 闭合，才能宣称根因已定位；否则只报告诊断缺口，不猜根因、不打补丁。

沿真实链逐段定位唯一语义 Owner：网站正式 sender -> API/contract/store -> claim/session/lease/fence -> AGENT route/plugin -> GPT child/Browser mutation -> checkpoint/Outbox -> 网站 terminal/consumer/domain -> 用户页面。

## 4. 片区删除加重构

修复前分别绑定两个仓库的 authority 和 debug candidate。根因属于哪个 Owner 就修改哪个仓；需要双仓修改时分别施工、分别测试、分别记录每次快照变化和未证明项。目标片区已有本轮授权改动或用户明确的迭代改动时，在保留其语义的前提下继续修复；来源不明且重叠时先查归属或使用隔离 worktree。无关脏改只保留，不构成停止理由。

“片区”必须由根因和真实消费者界定。物理移除该 active slice 的错误实现、旧 consumer、binding、wrapper、fallback、alias、dual-read/write、shadow path 和不可达测试，再重建唯一主路径及其直接合同、消费者和测试。不得加入兼容层，也不得顺手改无关区域。

若修复需要修改 active law 或 blueprint，停止并请求单独授权。

## 5. 修复验证深度

至少包括：

- 原故障的确定性复现测试；
- 状态机或性质测试；
- 能证明旧错误重新出现会失败的 mutant test；
- Browser 故障的跨 attempt 身份稳定、`DISPATCHED` 不重放、原 Target/Document 对账、未知结果阻止新 mutation；
- 合同变化时双仓 provider/dependency 投影一致；
- 实际 Owner 的聚焦验收，以及两个仓库分别按本仓唯一命令执行的 `quality:check -- CHANGE`。

这些只证明 CHANGE。代码修改后的真实复跑必须绑定更新后的 debug candidate，并证明运行实例已重新加载这些字节；本地真实系统允许运行未提交的工作树快照。只有声称外部已部署结果时才必须读回对应部署工件，不得用本地修改冒充远端生产结果。

## 6. 安全清理旧任务

保留 job、event、failure、receipt、mutation 和最小脱敏审计事实。将失败任务置于 typed terminal，释放 lease/fence，确认 Outbox 无待处理项，并通过正式 Owner 清理任务私有 Target、临时下载、孤立输出对象或受 retention/privacy 合同允许清理的材料。

普通用户页面不得展示管理员 QA 数据。“用户侧无残留”不等于数据库无事实。不得直接 SQL 硬删、级联删除、覆盖、复活或复制失败任务；没有正式清理 API/Owner 时返回 `CLEANUP_OWNER_ABSENT`，要求抹除不可变事实时返回 `UNSUPPORTED_BY_ACTIVE_LAW`。

## 7. 全新任务复跑

使用新的 `job_id`、`source_task_id` 和 `idempotency_key`，从同一个正式产品入口完整重跑；不得复活旧任务。成功必须再次闭合网站终态、领域消费、真实用户页面、Target/临时产物和 Outbox。

默认只允许一次修复后复跑。同一根因再次出现、仍有 `DISPATCHED`、外部副作用未知、清理不完整、候选漂移或认证/风控介入时立即停止。

## 8. Dynamic Proof 交接

本 Skill 不写质量 verdict。只有网站现役 `xuanxue-dynamic-proof` 的引用文件、命令、schema、journey registry 和声明分母全部与代码一致时，才能把 evidence handoff 给唯一 Dynamic Proof Controller；否则返回 `DYNAMIC_PROOF_DEPENDENCY_DRIFT`。

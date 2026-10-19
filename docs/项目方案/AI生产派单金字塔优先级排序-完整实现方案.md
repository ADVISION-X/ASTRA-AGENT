# AI 生产派单金字塔优先级排序完整实现方案

## 0. 当前结论

本方案的唯一派单语义是**固定阶级、容量递补**。

- `N` 是设备允许同时在途的业务工单总数，也是各工单独占 Tab 的总容量上限。
- Website 先扣除已经占用的业务席位，再得到本次 fresh grant 的剩余名额。
- fresh 候选严格按固定阶级从高到低填充；同阶按 `created_at,job_id` 排序。
- 高阶 claimable fresh 候选足以填满剩余名额时，低阶不得领取。
- 高阶 claimable fresh 候选少于剩余名额时，下一阶必须使用空闲名额，继续递补到容量填满或没有可领取任务。
- 已经在途的高阶工单只通过容量计算占用一个席位，不得把其它空闲席位一起冻结。
- 当前因 retry、lease、device、capability、material、control、cooldown 或锁竞争而不可领取的高阶工单不虚占 fresh 名额；其排除原因仍由 Website 唯一 observation Owner 报告。
- 已 durable accept 的 attempt 恢复、同 effect 零输入读回、staged result 交付和领域接纳不属于 fresh grant，继续原链收尾并优先恢复。

示例：`N=3`，当前已有一张 Tier 2 工单在途，且没有其它 claimable Tier 2 候选，则剩余两个名额可由 Tier 3、Tier 4 依次递补。若另有两张 claimable Tier 2，则两个名额都由 Tier 2 使用，Tier 3 不能领取。

## 1. 固定阶级

| 阶级 | 固定业务范围 | `product_id` |
|---|---|---|
| Tier 1 | 支付截图观察 | `payment_screenshot_observation` |
| Tier 2 | 已购付费产品、报告翻译 | `bazi_ai_full_analysis`, `bazi_chart_interpretation`, `bazi_report_followup`, `hehun_ai_analysis`, `hehun_report_followup`, `naming_commercial`, `naming_from_existing_bazi_report`, `qimen_professional_answer`, `qimen_report_followup`, `localization_report_translation` |
| Tier 3 | 固定文案翻译 | `localization_static_catalog` |
| Tier 4 | 文章翻译、公开知识文章生产 | `localization_article_translation`, `public_knowledge_article_pipeline` |
| Tier 5 | 未显式映射的其它产品 | `ELSE 5` |

同一 `product_id` 的 primary、`accuracy_challenge` 和 `quality_reflection` 继承同一阶级。阶级只来自 Website 唯一静态映射，不读取价格、用户、等待时间、重试次数、设备或 Provider 状态。

明确禁止：aging、晋级、动态权重、轮转、低层保底配额、第二 scheduler、第二 priority Owner、持久化 current tier、AGENT 自主改序。

## 2. 容量与 Browser 语义

### 2.1 容量

Website 现役 `v6NewGrantCapacity` 负责计算：

```text
fresh_remaining = min(
  device.max_in_flight - database_business_in_flight,
  protocol_max - database_business_in_flight,
  device.max_in_flight - agent_attested_in_flight,
  requested
)
```

selector 只负责用固定阶级顺序填充 `fresh_remaining`。selector 不得再次用“全局存在高阶未完成任务”把剩余容量清零。

### 2.2 Tab 与 Browser lane

- 每张已领取工单独占自己的 Tab。
- `N` 控制同时在途的工单/Tab 数，不表示 Browser 可以并行点击。
- Browser 物理动作 lane 固定为 1；点击、输入、导航串行。
- GPT 等待回答时释放 Browser lane，其他在途工单可使用 lane 操作自己的 Tab。
- 本次不修改 V6 wire、AGENT Runtime 调度、Browser FIFO 或设备 N。

## 3. 双仓 Owner 与唯一链

### 3.1 Website

Website `ai-acceptance` 是唯一派单 Owner：

1. `job-claim-repository.ts` 在现役 control singleton 锁内计算剩余容量。
2. `job-claim-selection.ts` 先选已经接受的可恢复 attempt，再按 fresh 固定阶级填充剩余名额。
3. `job-claim-observation.ts` 对各阶未完成需求执行固定上限的当前只读分类，不再只观察全局最高阶，也不把后一次读取冒充 selector 前一语句的同一快照。
4. task create 与 claim 继续复用现役 `ai_production_lock_task_ordering()` 线性化点。

### 3.2 AGENT

AGENT 只机械执行 Website 已签 grant：

- 不保存 priority tier。
- 不重新排序 Website grant。
- 不新增容量算法、队列、账本、兼容桥或第二链路。
- 保持每 job 独占 Tab、Browser mutation lane=1、等待时释放 lane。

## 4. 两遍源头审计结论

### 4.1 第一遍：从规则到实现

现役固定 `product_id -> tier` 映射正确，现役容量函数也正确。第一直接断裂位于 Website `job-claim-selection.ts`：fresh 分支把候选阶级强制等于“全部未完成 job 的最小阶级”。这使一张高阶在途或暂不可领取任务冻结其它空闲名额。

对应诊断断裂位于 `job-claim-observation.ts`：`all` scope 也只读取全局最高未完成阶级，无法解释容量递补后的完整候选分母。

### 4.2 第二遍：从运行结果反查

`job-claim-repository.ts` 已把 `N - in_flight` 的剩余 fresh 名额传给 selector。若 selector 按 tier 排序并持续取候选：

- 高阶候选数量大于或等于剩余名额时，只会返回高阶；低阶不会越序。
- 高阶候选数量小于剩余名额时，循环自然进入下一阶并填满空位。
- 已在途高阶任务已经在上游占掉容量，不需要 selector 再次全局冻结。
- accepted recovery 必须排在 fresh 之前，保持现役恢复闭环。
- 不能继续使用一个混合 `(created_at,job_id)` 游标，因为 tier 排序后下一阶可能拥有更早的创建时间；selector 应物理分成 recovery 和 fresh 两段，recovery 使用 `(created_at,job_id)`，fresh 使用固定大小的 `(tier,created_at,job_id)` 游标，避免遗漏、死循环和随候选数增长的内存/参数膨胀。

结论：不需要数据库字段、跨仓字段或 AGENT 代码改动。Website 需要一个只承载固定 `product_id -> tier + created_at + job_id` 读取顺序的表达式索引迁移；tier 仍由同一静态映射推导，不持久化新状态。

## 5. 施工清单

### 工单 1｜法案与施工图

- `LAW-AI-ACCEPTANCE-004-V31 -> V32`：把“全局最高未完成阶级独占”改为“剩余容量按固定阶级递补”。
- 直接依赖闭包续升：`012-V44 -> V45`、`013-V28 -> V29`、`PUBLIC-KNOWLEDGE-CONTENT-005-V44 -> V45`，只更新依赖身份，不扩大其正文职责。
- Website AI Acceptance Blueprint 升为 V51，并同步 System Blueprint。
- AGENT Website–Agent V6 Blueprint 只同步 Website 内部派单语义；V6 wire 和 AGENT Runtime 职责不变。
- 原方案中“高阶未完成即冻结全部低阶”“开放阶不可领则返回零”“容量不得补位”的旧表述全部物理删除。

### 工单 2｜Website selector 重构

在 `services/api/src/ai-production/job-claim-selection.ts`：

1. 删除 fresh 分支中的全局 `min(open tier)` 子查询。
2. 保留当前 claimable 条件、source evidence、delivery-only、material/capability 当前复核和 `FOR UPDATE SKIP LOCKED`；稳定 capability、material、隐私 Owner 排除先下推 SQL，避免逐行锁住整个队列后再淘汰。
3. selector 分为两个有界阶段：先 accepted recovery，再 fresh；fresh 按静态 tier 升序，最后按 `created_at,job_id`。
4. recovery 使用 `(created_at,job_id)` 游标，fresh 使用固定大小的 `(tier,created_at,job_id)` 游标；稳定资格先由 SQL 排除，每段最多检查 32 个已锁候选，单次事务合计上限 64，recovery 的并发失效不得耗尽 fresh 的检查预算。只有锁后资格并发漂移耗尽某段预算时当前 receipt 可欠填并由下一次 claim 重试，禁止为追逐极端竞态改成无界扫描。
5. `selectedNew` 达到上游传入的 `newLimit` 后停止；不得另造 tier quota。
6. 新增唯一表达式索引支持固定 tier、`created_at,job_id` 读取；不得新增 tier 列、表、状态或第二映射。

### 工单 3｜Website observation 对齐

在 `services/api/src/ai-production/job-claim-observation.ts`：

1. `all` scope 跨全部 tier 按顺序读取至多 256 条未完成 V6 demand，不再只读取最小 tier，也不把全量队列装入内存。
2. 观察顺序按静态 tier、`created_at,job_id`。
3. 继续使用现役 reason code 闭集，不新增状态或第二诊断 Owner；该分类是零 grant 后的当前有界 observation，不声称与 selector 前一语句共享快照。
4. exact job 观察和当前 next action 语义保持不变。

### 工单 4｜质检重构

- 静态 inspector 删除对 `select min(open tier)` 的正向要求，并反向断言全局冻结 SQL 不得恢复。
- Exam 声明绑定 V32 与不可跳过的容量递补行为 case；环境门后的 PostgreSQL 用例只作补充，不得成为唯一行为证据。
- 集成测试覆盖：
  - 剩余 2 席且高阶有 2 张 claimable：只选 2 张高阶。
  - 剩余 3 席且高阶只有 2 张 claimable：第 3 席由下一阶递补。
  - 高阶已在途占 1 席、`N=3`：剩余 2 席可由低阶填充。
  - 高阶暂不可领取：不虚占空位，低阶可递补，observation 保留高阶排除原因。
  - 同阶保持 `created_at,job_id`。
  - accepted recovery 不受 fresh tier 排序阻断。
  - tier 排序跨越创建时间时不漏选、不重复、不死循环。

## 6. 删除边界

必须删除：

- selector 的全局未完成最小 tier gate。
- observation 的全局最高阶 scope gate。
- 质检中要求上述 gate 存在的断言。
- 双仓法案、施工图和本方案中的旧全局冻结表述。

必须保留：

- 唯一静态五阶映射。
- 现役 N 与业务在途容量计算。
- control singleton 线性化锁。
- accepted recovery、result delivery、domain admission 主链。
- Browser lane=1、每 job 独占 Tab。
- 现役 claimability、权限、material、capability 与 recovery 安全门。
- 一个从唯一静态映射推导排序的 Website 表达式索引。

不新增数据库表、字段、持久 tier、feature flag、兼容桥、第二队列、第二 scheduler、第二 observation Owner 或 AGENT priority 状态。只新增一个必要的排序索引迁移。

## 7. 验收矩阵

| 场景 | 剩余 fresh 名额 | 候选 | 必须结果 |
|---|---:|---|---|
| 高阶足够 | 2 | T1×3, T2×3 | 只取最早 T1×2 |
| 高阶不足 | 3 | T1×1, T2×3 | T1×1 + 最早 T2×2 |
| 在途占位 | N=3，已有 T1×1 在途 | 无 fresh T1，T2×3 | T2×2 |
| 高阶不可领取 | 2 | T1×1 retry pending，T2×3 | T2×2；observation 报 T1 retry |
| 同阶 FIFO | 2 | T2×3 | 按 `created_at,job_id` 取前 2 |
| 恢复优先 | recovery×1，fresh T1/T2 | recoverableLimit=1 | recovery 继续；fresh 再按阶级填剩余 |
| 无可领取任务 | 3 | 全部被合法条件排除 | 零 grant，返回非空、稳定排序的现役 reason 闭集；结果明确属于当前有界 observation |

## 8. 门禁与完成定义

1. 法案、双仓施工图和本方案先完成两遍主 Codex 审计；active law、Blueprint、当前实现与 Exam 中操作性的旧全局冻结语义必须为零，`supersedesLawId` 和明确标注的历史根因描述不计入该门。
2. 再施工 Website 代码和质检；不改 AGENT 代码，不执行 AGENT READY。
3. 主 Codex 完成两遍代码自检和目标测试。
4. 子智能体只审计最终建设与本方案差异，不参与写代码；未放行不得结束。
5. 最后才运行 Website 原生 `npm run quality:check -- CHANGE`。READY 只有在用户要求且能形成不混入无关改动的 clean commit 时执行；READY 不等于 RELEASE。

“完成建设”只表示当前候选已通过规定的静态、Exam 和集成证据。真实生产跑满 N 仍需部署后以同一 claim receipt、设备 N、数据库在途数与实际多 Tab 运行记录证明；不得把本地测试或 HTTP 200 冒充生产完成。

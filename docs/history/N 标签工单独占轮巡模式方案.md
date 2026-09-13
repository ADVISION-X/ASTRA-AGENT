---
document_type: project_scheme
scheme_id: N_TAB_EXCLUSIVE_ROTATION
scheme_name: N 标签工单独占轮巡模式
status: candidate
created_at: 2026-09-13
implementation_status: BLOCKED
test_status: NOT_RUN
release_status: NOT_RELEASED
---

# N 标签工单独占轮巡模式方案

## 0. 文档身份与当前裁决

本文件是一份待授权施工的项目候选方案，不是 active law、Blueprint、跨仓合同、运行时配置或第二质量结论。它不能覆盖现役冻结法案；正式施工前必须由授权人明确解冻并同步替换命中的双仓 active law、Blueprint、跨仓合同、实现和唯一质检。

当前裁决：

```text
方案：CONDITIONAL GO
施工：BLOCKED
实现：NOT_IMPLEMENTED
测试：NOT_RUN
发布：NOT_RELEASED
```

方案本身可控，但首次建设不是简单改一个数字。当前实现把业务容量、当前执行工单、Browser Target、GPT 等待和质检都冻结为 ONE BY ONE；首次动态化必须完成一次双仓合同升级、前向迁移、Runtime 改造、Browser 多 Target 改造和真实 Provider 分级验收。首个 RELEASE 只承诺经过真实 GPT 证明的 `1 <= N <= 4`；在这个范围内，`3 -> 4` 是后台一次修改，无需改代码、迁移或重启。将来要把生产上限提高到 5 或更大，必须先在新候选中完成目标高水位的真实 GPT 证明，再提高同一个合同安全上限，不能把“数据库能存”冒充“Provider 已安全”。

## 1. 模式定义

中文名称：`N 标签工单独占轮巡模式`。

简称：`N-TAB 独占轮巡`。

系统标识：`N_TAB_EXCLUSIVE_ROTATION`。

一句话定义：

> 每台获授权设备最多同时保有 N 个占用当前业务席位的执行闭环工单；每个执行闭环工单独占一个 GPT Tab；所有点击、输入、附件、Tab 激活和页面读取仍共用一条 Browser 物理车道；系统级轮询频率不随 N 增长。

四条不可拆开的底线：

1. 一个动态 N；
2. 一个未闭环工单独占一个 Tab；
3. 一台设备只有一条 Browser 物理操作车道；
4. 一台设备只有一个全局 Provider observation 节拍。

删除任意一条，方案即退化：

- 删除动态 N：重新回到改数字、改合同、迁移、发版；
- 删除工单独占 Tab：重新回到旧 3 模式的跨工单 URL 切换；
- 删除单车道：页面现实输入并发，无法保持现役物理安全；
- 删除全局节拍：轮询次数随 N 线性增长，再次触发 GPT 页面操作压力。

## 2. 本次目标与明确非目标

### 2.1 目标

1. 保留当前 ONE BY ONE 的工单内质量、提交至多一次、Website 最终接纳和失败关闭语义；
2. 把 Provider 生成等待从“整个系统空等”变成“多个专属 Tab 同时等待”；
3. 正常轮询只切换到工单原 Tab，不再通过 URL、侧栏、搜索或历史聊天定位；
4. N 由 Website 唯一配置，完成首次建设后支持一次操作从 3 调到 4；
5. 降容不杀在途工单，扩容不使用旧授权提前多领；
6. 一个已取得确定终态事实的 Tab 故障只影响其绑定工单；若存在现实输入结果不明的 `DISPATCHED`，则按现役安全合同阻断整条 Browser 车道；
7. 最终效率以 Website 成功接纳并持久化的工单吞吐衡量。

### 2.2 非目标

本方案不建设：

- N 个 Worker 进程；
- N 个任务队列；
- N 条 Browser lane；
- 每 Tab 一个独立页面轮询器；
- 中央 Scheduler、Traffic Arbiter 或优先级系统；
- Tab 数据库、Provider URL 数据库或持久化轮询表；
- 第二 WAL、第二 Outbox、第二恢复队列或第二任务状态；
- AGENT 环境变量版 N；
- 自动调 N 的算法；
- 兼容桥、dual-read/write、feature flag、shadow 或 fallback；
- 对 Product Flow、Prompt、模型、Child 顺序、领域验收或发布顺序的重构；
- 把正常业务容量 N 与既有系统故障熔断阈值绑定。

## 3. 与旧 10、旧 3、现役 ONE BY ONE 的关系

历史上旧并发路径的核心形态是：

```text
多个工单
-> 共用一个逻辑 Target/Tab
-> park/reacquire
-> 使用 canonical URL 切换会话
-> 读取下一工单
```

用户已经提供真实生产反证：旧 10 和旧 3 会把 GPT 页面拉爆并出现频繁操作提示。因此本方案不得把旧容量数字重新打开，也不得恢复旧 cross-poll URL 切换。

新模式是：

```text
最多 N 个未闭环工单
-> 每个工单独占自己的 Target/Tab
-> 等待时只释放 Browser 物理车道，不释放工单与 Tab 的绑定
-> 检查到期后激活原 Tab
-> fresh observe 一次
-> pending 则再次释放车道并排到轮巡尾部
```

它与旧 3 的本质差异只有两项：

1. 多个工单不再共享同一个 Target；
2. 正常 Provider 轮询不再执行 URL 导航或会话重选。

它保留现役 ONE BY ONE 的核心质量合同：

- 一个工单内部仍按原 Product Flow 串行执行；
- 同一个 Tab 不接第二个未闭环工单；
- Provider effect 仍最多现实提交一次；
- 当前 Target/Document/fence 仍在每次现实动作前验证；
- Website admission receipt 仍是业务完成门；
- 恢复仍由 Website 授权，Browser 只提供 WAL 事实；
- 失败仍输出 typed fact，不自行重试或猜测。

本方案不能仅凭结构推断安全。即使页面操作频率不增加，N 个 GPT 会话同时生成仍可能触发 Provider 账号级限流。该风险只能由真实 Chrome、真实 GPT 的 N=2、N=3 和首版高水位 N=4 分级实证裁决。

## 4. 用户肉眼看到的运行方式

以 `N=3` 为例：

```text
业务：A、B、C 最多三个工单同时在路上
页面：A、B、C 分别拥有一个专属 GPT Tab
物理：任意时刻只有一个 Tab 正在被系统操作
轮巡：A -> B -> C -> A
完成：只有 Website 接纳入库后才释放对应槽位
```

运行过程：

1. A 进入自己的 Tab，完成准备并提交；
2. A 开始生成，系统保留 A 与该 Tab 的绑定，但释放 Browser 车道；
3. A submit 后先执行现役全局 40 秒零页面命令静默；静默结束后，Browser 车道才按已具备资格请求的 FIFO 处理 B、C；
4. A 的检查时间到达后，A 只提交一个“已具备检查资格”的请求；
5. 全局轮询门允许后，Browser 激活 A 的原 Tab，校验当前 Target/Document，fresh observe 一次；
6. 如果仍 pending，Browser 立即释放车道，A 的下一次检查重新排到轮巡尾部；
7. 如果 ready，沿现役结果、Outbox、Website staging、Domain Consumer、admission receipt 主链继续；
8. admission receipt 读回后，A 的业务席位和 Tab 绑定才解除；
9. 新工单 D 才能使用空出的席位和一个 clean GPT Tab。

## 5. 终态硬合同

### 5.1 唯一 N 与安全上限

唯一持久真相：

```text
Website.ai-acceptance
-> ai_production_devices.max_in_flight
```

现有数据库列的存储边界继续保持：

```text
1 <= N <= 64
```

但数据库能存 `1..64`，不等于本版本能安全运行 `1..64`。首个 RELEASE 的生产配置范围固定为：

```text
1 <= current_device_N <= N_contract_max
N_contract_max = 4
```

`N_contract_max` 是经真实 GPT 证明后写入同一跨仓合同的不可配置安全上限，不是第二份运行时 N。实际业务容量仍只有设备行中的当前值。管理员可以在 `1..4` 中填写任意整数，不是只能选择硬编码的 1、3 或 4。

AGENT、Browser、环境变量、Session 和 heartbeat receipt 不得接收、缓存或保存当前设备 N。Manifest 只声明不可配置的协议支持上限，不保存当前 N。新设备 enrollment 必须显式以 `max_in_flight=1` 启动；不得从数据库上限、协议上限或 Manifest 推导初始值。

未来提高 `N_contract_max` 必须替换同一安全上限并重新 RELEASE，不得新增“已批准 N”表、第二配置或实验旁路。

### 5.2 业务席位与领取计算

业务在途不得合并成一份跨系统真相。两个 Owner 各自只报告自己的事实：

```text
agent_attested_in_flight
= distinct(active execution jobs U admission-pending jobs)

website_current_business_set
= distinct(
    Website 按 exact device 统计的全部仍占业务席位的 accepted job
    U 尚未消费的 staged result
  )
```

`website_current_business_set` 包含 lease 已过期但 accepted attempt 尚待同 effect regrant 的工单。AGENT 的 attestation 只能进一步收紧领取，不能扩大 Website 的持久化安全门。

AGENT 不知道当前 N，只按协议支持上限、自己的本地在途数和 executor 可用量提出请求：

```text
requested_new_limit = max(0, min(
  executor_available,
  N_contract_max - agent_attested_in_flight
))
```

Website 在锁定 exact device row 后唯一裁决实际新发工单数：

```text
new_job_grant_capacity = max(0, min(
  requested_new_limit,
  current_device_N - count(website_current_business_set),
  N_contract_max - count(website_current_business_set)
))
```

Website 数据库计数是 grant 的最终安全门。AGENT 本地少报、旧 heartbeat 或重启瞬间本地集合尚未恢复，都不能让 Website 超领。已有工单的 regrant 先独立恢复，不重复增加业务席位，也不受缩容后的新领取容量截断。

### 5.3 工单与 Tab 一一绑定

Browser 私有进程内绑定必须满足：

```text
jobRefHash -> exactly one targetRef
targetRef -> zero or one unfinished jobRefHash
```

绑定从该执行闭环工单首次进入 Browser 时建立，在当前 Browser Authority epoch 内持续到执行闭环释放条件成立。绑定不是 Website 状态，不进入数据库、任务合同、日志正文或跨仓接口。

若 Extension/Chrome 私有状态完全丢失，原进程内绑定随 authority epoch 作废：已 `CONFIRMED` 的 effect 只允许依据唯一 Browser WAL，在新建并重新证明为 system-owned 的 Tab 中按 canonical URL 零 submit 恢复；submit 前丢失则输出 `mutation=no` 事实交 Website 裁决。失去 ownership 证明的旧 Tab 不得扫描、复用或自动关闭，也不计入新 authority epoch 的 bound Tab 数。本方案不为消除这类孤儿页面新增 Tab 数据库。

`activeTarget` 和 `operatorTargetClaim` 继续保持单例。它们表示当前唯一正在被物理操作的 Tab，是 Browser lane 等于 1 的直接证明。多 Tab 只扩大 parked/bound Target 集合，不能扩大 active 物理声明。

### 5.4 唯一 Browser 车道

无论 N 为多少：

```text
browser_action_capacity_total = 1
browser_action_in_flight in {0, 1}
```

以下动作全部经过同一 FIFO：

- 建立或复用 system Tab；
- 激活精确 Tab；
- profile/model/menu/附件/Composer 准备；
- submit；
- Provider observation；
- confirmed-effect recovery；
- Tab reset/close。

恢复不得有 bypass、优先队列或第二 lane。

### 5.5 全局 Provider observation 节拍

保留现役时间边界：

```text
提交后全局静默：40 秒
相邻 Provider observation 最小间隔：30 秒
```

每个 GPT wait Child 只拥有本工单下一次何时具备检查资格。`nextCheckAt` 为调用期瞬时数据，到期前不进入 Browser FIFO；同一工单任意时刻最多有一个 pending observation 请求。

Browser lane 只拥有系统级机械限速：真实页面 observation 的总频率不得随 N 增长。现役唯一 FIFO 的 waiter 增加 `requestKind` 和瞬时 `eligibleAt`，全局只增加一个非持久 `observationNotBefore` 标量：

1. 普通 mutation、恢复和清理请求的 `eligibleAt=now`；
2. Provider observation 的实时资格为 `max(waiter.eligibleAt, observationNotBefore)`；
3. coordinator 只从同一个 FIFO 中取“当前已具备资格且入队序号最早”的请求，未到全局时间的 observation 不得把 `active` 置为 true、不得激活 Tab、不得读取 DOM，也不得堵住后续已具备资格的 submit/准备/清理；
4. 如果当前没有已具备资格的请求，只允许一个 coordinator wake-up timer 等待最早资格点，不得为每个 Tab 建 timer；
5. observation 终止后以真实 `observedAt/terminalAt` 推进 `observationNotBefore`；失败、abort 或断连必须释放 active lane；
6. 一旦旧 observation 到达全局资格点，它按原入队序号参与 FIFO，不得被后来的已具备资格请求长期饿死。

`requestKind` 必须由 local-browser-session 根据受治理的 Browser 操作生成，GPT/Product调用方不得自报或改写，否则可伪装成普通mutation绕过全局observation门。

这仍是一条 FIFO、一个 lane、一个 timer 和一个限速标量，不是第二 queue、中央 Scheduler 或持久状态机。

只有在 N=3、A/B/C 均 pending、均已具备资格、按 A/B/C 顺序进入 FIFO 且没有其它页面动作的控制场景中，才会看到：

```text
A observe
>= 30 秒
B observe
>= 30 秒
C observe
>= 30 秒
A observe
```

`A -> B -> C -> A` 只是受控示例，不是固定轮转合同。普通运行只要求“已具备资格请求按原入队序号、无插队、无饥饿”。没有其它页面动作时，同一 Tab 两次 observation 间隔的理论下界约为 `N * 30 秒`；它不是平均时延保证。整台设备的页面读取频率仍最多约一次/30秒。

### 5.6 正常轮询只能切 Tab

正常轮询唯一动作：

```text
激活 job 已绑定的 exact Tab
-> 验证 tab/window/active/discarded/loading
-> 验证 Target 与实时 current Document
-> fresh observe 一次
-> pending 时释放 Browser lane
```

正常轮询禁止：

- `Page.navigate`；
- reload；
- 回 GPT 首页；
- 侧栏点击；
- 搜索、滚动或自动展开历史对话；
- canonical URL 重选；
- 标题、顺序、时间或当前页面猜测。

`Page.navigate` 只允许：

1. 新工单首次建立 clean GPT chat；
2. 进程或 Target 真正丢失后，按唯一 Browser WAL 中同一 confirmed effect 的 canonical URL 执行零次或一次精确恢复导航。

### 5.7 Provider effect 至多一次

继续复用现役 Browser WAL 和 provider effect identity：

```text
physical submit <= 1
```

- `PREPARED`：尚未发生现实输入；
- `DISPATCHED`：现实输入可能已经发生，禁止重放；
- `CONFIRMED`：只允许零输入读回；
- `REJECTED + mutation_outcome=no + physical_input_count=0`：由 Website 决定是否签发新 attempt。

多 Tab 不改变 effect identity，不新增第二 WAL，不以 Tab/Target/Document 作为跨 attempt provider effect 身份。

### 5.8 业务完成与席位释放

以下事实都不得释放业务席位：

- Provider 已返回；
- AGENT 已组装结果；
- Outbox delivered；
- Website staging 成功；
- HTTP 200。

本模式中的“工单槽”精确定义为当前业务执行闭环，不是 Website job 的永久寿命。`ACTIVE_ATTEMPT` 与 `CONSUME_CURRENT_RESULT` 占一个业务槽；Provider ready、Outbox delivered 或 staging 只允许 park 并释放 Browser lane，不得解除绑定或释放业务席位。

只有以下事实之一可结束当前执行闭环、解除工单与 Tab 的绑定并释放席位：

1. Website Domain Consumer 已入库并签发有效 admission receipt；
2. Website 已持久决定 `WAIT_NEW_ATTEMPT`；
3. Website 已持久决定永久撤权；
4. Website 已证明该未完成工单被管理员删除。

`WAIT_NEW_ATTEMPT` 必须原子解除旧 attempt 的 Tab 绑定；同一 Website job 的后续新 attempt 按容量重新取得一个 clean Tab，不复用旧 attempt 的页面事实。

## 6. 动态 N 闭环

### 6.1 管理员唯一入口

候选接口：

```http
PUT /api/commercial/platform/ai-acceptance/devices/:deviceId/business-capacity
```

精确请求：

```json
{
  "expected_business_capacity_total": 3,
  "business_capacity_total": 4
}
```

服务端必须：

1. `requirePlatformOperator`；
2. 锁定 exact device row；
3. 验证设备 active、未撤权；
4. 验证 N 为 `1..N_contract_max` 的整数；首个 RELEASE 中即 `1..4`；
5. 用 expected old value 做 CAS；
6. 只写 `ai_production_devices.max_in_flight`；
7. 写后读回 exact row；
8. 复用现役 audit；
9. 同值 PUT 返回幂等成功；
10. 回复不明时客户端先 GET 精确读回，不自动重发。

不新增 capacity event 表或幂等台账。PUT、CAS 和写后读回已经承担本次需要。

全新 enrollment 必须显式写入 `max_in_flight=1`；重放 enrollment 只返回既有设备，不改变其当前 N。协议支持上限绝不能被当作新设备的实际 N。

### 6.2 Heartbeat 与 claim 的边界

Worker attestation 不再由 AGENT 声明“自己容量是多少”，只上报 `agent_attested_in_flight` 和现役 Browser/ledger 状态。

Heartbeat receipt 不返回当前 N，也不授权 N。它继续证明 session、attestation、Browser/ledger 状态和 `agent_attested_in_flight`。旧 heartbeat 的幂等重放仍只返回原 receipt。

动态 N 只在 Website claim 事务内生效：claim 锁定 device row、读取当前 N、计算 Website 持久化在途集合，再裁决 grant。AGENT 和 Browser 不需要等下一次 heartbeat，也不需要知道当前 N。

### 6.3 统一锁顺序

Capacity PUT、heartbeat 和 claim 涉及相同行时统一遵守：

```text
device row
-> worker_session row
-> control_protocol row
```

Capacity PUT 对 device 使用 update lock；claim 至少使用能够与更新互斥的 device row lock 读取 current N。由此保证缩容接口成功返回后，后续 claim 不可能再按旧 N 发出新 lease。PUT、heartbeat、claim 的并发全排列都必须由真实 PostgreSQL 事务证明，不允许只用串行单测代替。

### 6.4 扩容 3 -> 4

```text
管理员一次 PUT 把 device N 从 3 改为 4
-> 下一笔 claim 锁定 device row并读到4
-> website_current_business_set=3 时只授予1个新工单
-> Website 最多新增 1 个 lease
-> 第四个工单首次进入 Browser 时取得第四个专属 Tab
```

首次动态化发布完成后，该过程不改代码、不跑 migration、不重新 enrollment、不重启 Runtime。

### 6.5 缩容 4 -> 3

已有四个工单时：

```text
configured N = 3
website_current_business_set = 4
new claim = 0
existing jobs continue
```

收敛：

```text
4 -> 3：不补新工单
3 -> 2：才允许补 1 个
```

缩容期间允许 Website 持久化业务在途数暂时大于 N，但禁止新工单。不得 abort、撤 attempt、丢弃 confirmed effect 或关闭在途 Tab。因为 Browser 不接收 N，它只按 Website 已授予的 existing/new job 行事，不另做容量判断。

## 7. 多工单领取与恢复

现役 Website 领取路径只读取一个 current execution job。动态 N 必须拆清三组事实，否则进程重启、结果待消费或超额缩容时会把不同职责混成一个“恢复集合”：

```text
website_current_business_set
= 全部未闭环 accepted job U 未消费 staged result
用途：占业务席位

recoverable_execution_set
= 同设备、无有效 lease、仍为 ACTIVE_ATTEMPT 的既有工单
用途：同 accepted attempt / same effect regrant

consume_current_result_set
= CONSUME_CURRENT_RESULT 工单
用途：只走现役 Outbox/admission reconciliation，禁止重新进入 Product/Browser
```

Claim 固定顺序：

1. 锁定 device、session 和 control protocol；
2. 读取并计数 `website_current_business_set`；
3. 读取全部 `recoverable_execution_set`；
4. 先按 exact identity 返回全部可恢复 `ACTIVE_ATTEMPT`，不受缩容后的 N 或 `requested_new_limit` 截断；
5. 已有工单 regrant 不重复增加业务席位；
6. `CONSUME_CURRENT_RESULT` 继续占槽，但由 Runtime 本地 durable store/Outbox 的现役 reconciliation 收敛，Website 不把它重新授予 Product/Browser；
7. 再按第 5.2 节公式计算普通新领取空位；
8. 仅按全局稳定 FIFO 领取新工单。

即使缩容后 `count(website_current_business_set) > N`，全部可恢复 `ACTIVE_ATTEMPT` 仍允许按同一 accepted attempt/effect regrant，但新工单领取数必须为零。不得因为普通新领取容量为零而把旧工单恢复也阻断，也不得把 `CONSUME_CURRENT_RESULT` 误送回 Browser。

## 8. Browser Target/Tab 生命周期

### 8.1 最小状态

复用现役：

- `ExtensionExactTargetRegistry`；
- `ExtensionDebuggerRuntime` 的多 attachment 能力；
- Browser FIFO；
- Browser WAL；
- exact Target/Document；
- execution binding 与 jobRefHash。

必要新增或改造仅限进程内：

- 在现役 `ExtensionExactTargetRegistry` 条目中增加 `jobRefHash` 独占绑定；
- 现役唯一 FIFO waiter 增加 `requestKind/eligibleAt`；
- 一个全局 observation not-before 时间点。

targetRef、tabId、current Document 和 navigation epoch 继续复用现役字段；不得另建 loader map、Document map、Tab 状态投影或 Browser N 投影。这些对象不得持久化，也不得进入 Website。

### 8.2 必须保留的单例

- 当前 active Target；
- 当前 operator target claim；
- Browser FIFO；
- Browser physical lane；
- Browser WAL；
- Browser Authority。

### 8.3 必须退休的单工单假设

- `singleParkedTargetRef()`；
- “parked target 数量不等于1即失败”的路径；
- 单个 `attachedTabId` 对全部已附加 Tab 的错误表达；
- acquire 请求只携带 `targetMode` 而不能精确说明当前 job binding；
- audit/acceptance 中“只有一个 production Tab”的断言；
- 任何把 Browser 资源安全上限误当成实际业务容量 N 的消费者。

现役 Browser FIFO backpressure 与 execution artifact binding 中的 10 是资源安全边界，不是本设备实际业务容量 Owner。首个 RELEASE 的 N 最大为4，本方案不为“未来也许到64”预防性改造这些无关边界；将来只有真实消费者和删除反事实证明不足时，才另行修改。

### 8.4 Target acquire 模式

保留：

- `fresh`：新 attempt 的 clean Target；
- `confirmed-readback`：Target 真正丢失后的同 effect 零提交恢复。

新增：

- `bound-observation`：正常 Provider 轮询时，只重领当前 job 已绑定 Target；禁止 URL 导航。

Browser acquire 内部请求增加 `jobRefHash`。Website、Product 和 GPT 业务层不得传 `tabId`、targetRef 或 Document。

### 8.5 Tab 创建与释放

Browser 永远不接收 N，也不预建空 Tab。只有 Website 已授予的具体工单首次需要 Browser 时，才创建一个 clean system Tab并绑定。

当前执行闭环结束后，通过唯一 Browser lane 只解除并关闭该工单的 system Tab。不得保留空闲 Tab 池、扫描或认领操作者 Tab，也不得为了“以后复用”增加 reset 状态。正常稳定态满足：

```text
system_owned_tab_count = bound_tab_count
bound_tab_count <= count(website_current_business_set)
```

authority epoch 切换后失去 ownership 证明的旧页面不进入这个计数，也不得由系统自动操作。

## 9. GPT 等待与轮巡

现役 `ProductionGptBrowserLifecycle` 在 pending 等待期间持续持有 Browser lease，这是多 Tab 模式的直接 GAP。

终态：

1. submit CONFIRMED 后，工单—Tab绑定继续存在；
2. 任一 submit 后，整台设备先执行40秒零页面命令静默；静默期间其它Tab的submit、激活和observation也不得执行；
3. 40秒门结束后，observation pending 立即 park 该Target并释放当前 Browser lease，绑定仍存在；
4. GPT wait Child记录本工单下一次临时 `nextCheckAt`；
5. 本工单到期后才进入唯一 FIFO；未满足全局 `observationNotBefore` 的 waiter 不取得 active lane，也不阻塞其它已具备资格请求；
6. 同一 FIFO 的资格选择保证相邻真实 observation 至少30秒；
7. 取得 lane 后只激活绑定 Tab、fresh observe一次；
8. pending立即释放，ready才读取完整结果；
9. 生成状态必须保留轻量观察，禁止提取完整 `outerHTML` 和 semantic text；
10. 不新增 wait Child、per-Tab timer、持久 timer、poll table、中央轮巡器或第二状态机。

## 10. 故障隔离与恢复矩阵

| 故障 | 必须行为 | 明确禁止 |
|---|---|---|
| 用户关闭 Tab A，且 A 无 unresolved DISPATCHED | 只撤销 A 的 Target，输出 typed fact；B/C Browser工作可继续 | 清空全部 Target 或猜另一个 Tab |
| A 自行刷新或导航 | 重新核验 A 的 live Document；不满足即 A 失败关闭 | 把旧 Document 当当前事实 |
| A submit 前 Target 丢失 | `mutation=no` 事实交 Website 决定 | AGENT 自行重试 |
| A 已 DISPATCHED 但结果不明 | 保留原 effect，禁止再提交 | 换 Tab 重发 |
| A 已 CONFIRMED 后进程重启 | 按唯一 WAL URL 零 submit 恢复 | 先重做准备或提交 |
| 单 Tab debugger detach，且该Tab无 unresolved DISPATCHED | 只清理该 Target/attachment | 把另一个 active Target 置空 |
| WebSocket 短断、Extension 内存仍在 | 重连后按 job binding 逐个恢复 | 建 recovery bypass |
| Extension/Chrome 私有绑定完全丢失 | 不扫描猜测旧 Tab；按 Website 授权和 WAL 建替代恢复现场 | 按标题、时间或 URL 猜归属 |
| 一个 admission 长期 pending | 只占自己的业务席位和 Tab | 阻断其它已授权槽位 |
| 同一 Target 被分给两个 job | 分配动作失败，Provider mutation 增量为零 | 共享页面继续执行 |
| 用户在物理输入前切走 Tab | `BROWSER_TARGET_NOT_INTERACTIVE`，输入为零 | 抢焦点后盲点 |
| 用户在输入开始后切走 | 保留真实 DISPATCHED/部分动作事实 | 当作未输入重放 |
| 4 -> 3 且四单在途 | 新 claim=0，四单继续 | 杀第四单或关其 Tab |
| N 更新回复不明 | exact GET 读回 | 自动重复写 |

单 Tab 故障隔离不是无条件的。任一工单存在现实输入结果不明的 `DISPATCHED` 时，唯一 Browser 物理车道必须整体阻断；其它工单只可继续不需要 Browser 的本地或 Website 收敛工作。不得为维持 B/C 页面执行新增第二 lane、bypass 或重放。

故障矩阵所有行共同遵守唯一终止链：

```text
Browser 产出当前 Target / Document / WAL typed fact
-> GPT / Product 返回当前调用 terminal fact
-> Runtime 绑定 exact job + attempt + effect 上报
-> Website 持久裁决 ACTIVE_ATTEMPT / WAIT_NEW_ATTEMPT / 永久撤权 / 删除
-> AGENT 读回决定后才恢复、释放或清理
```

Website 决定读回前，当前业务席位和绑定不得释放：

- `PREPARED` 且 `physical_input_count=0`：Website 可在有限退避后签发新 attempt，旧绑定在 `WAIT_NEW_ATTEMPT` 读回后释放；
- `CONFIRMED` 且 WAL locator 完整：Website regrant 同一 accepted attempt，Browser 在替代 system Tab 上按 canonical URL 零次或一次导航，`physical submit=0`；
- `DISPATCHED` 或输入不明且无可靠 locator：不得创建替代恢复现场、不得重发；job 保持精确 blocked，只有 Website 后续永久撤权或管理员删除才释放席位。

恢复、正常操作和轮询继续共用一个 FIFO，不增加优先级、抢占、aging或保留席位。

## 11. 原子 Owner 与存在性裁决

| 原子责任 | 唯一 Owner | 权威输入 | 输出/真相 | 当前消费者 | 删除后直接失败 | 裁决 |
|---|---|---|---|---|---|---|
| 配置设备 N | Website `ai-acceptance` | 管理员 exact device + CAS old/new | `ai_production_devices.max_in_flight` | claim、管理页 | 无法一键变更容量 | 复用现有列，禁止新表 |
| 协议安全上限 | Website `ai-acceptance` V6 provider contract | 已通过的真实 GPT 高水位 | `N_contract_max` | Website PUT/claim validator、AGENT dependency consumer | 未证明值可直接上线 | Website唯一签发；AGENT只消费；首个RELEASE固定4，不得成为设备实际值 |
| 签报本地在途 | AGENT `agent-production-runtime` | active + admission-pending 本地事实 | `agent_attested_in_flight` | Runtime claim request、heartbeat | AGENT会超出自身执行能力 | 复用现役去重函数 |
| 统计Website在途并裁决grant | Website `ai-acceptance` claim | exact device持久job/result集合 + current N | `website_current_business_set`、实际grant数 | Website claim | 旧heartbeat或本地少报可导致超领 | 保留DB安全门并动态读取device N |
| 当前执行恢复 | Website `ai-acceptance` claim | recoverable `ACTIVE_ATTEMPT` | existing-job regrant | AGENT Runtime | 重启后只恢复一个工单 | 单数查询改复数，不建恢复队列 |
| 当前结果收敛 | AGENT Runtime现役 durable store/Outbox | `CONSUME_CURRENT_RESULT` | admission reconciliation | Website Domain Consumer | 结果工单错误重进Browser | 保留现役路径，不并入execution regrant |
| 工单绑定 Target | `local-browser-session` | jobRefHash + Browser Authority | 进程内独占 binding | target acquire、轮询、释放 | 会错投到其它 Tab | 扩展现役 Target registry |
| 页面物理串行 | `local-browser-session` FIFO | 已具备资格的 Browser 请求 | 单 active lease | 全部 Browser 操作 | 多 Tab 同时现实输入 | 保留唯一 FIFO/lane |
| 单工单检查资格 | GPT wait Child | confirmed submit 时间和 probe budget | 临时 nextCheckAt | 当前 GPT 调用 | 过早或忙轮询 | 保留调用期瞬时数据 |
| 全局读取限速 | Browser FIFO 子边界 | 已到期 observation 请求 | 瞬时 global not-before | 所有 GPT wait | N 倍放大页面读取 | 新增一个非持久标量 |
| Provider effect 真相 | `local-browser-session` WAL | exact effect identity/fence | terminal effect receipt | GPT、Runtime typed failure | 重复现实提交 | 原样保留唯一 WAL |
| 领域验收与入库 | 命中业务域的 Website Domain Consumer | staged result | 领域存储 + admission receipt | Website `ai-acceptance`、AGENT Runtime | Provider结果冒充领域完成 | 原样保留现役领域门 |
| Website公开完成转换 | Website `ai-acceptance` | 已校验admission receipt与本域附加门 | public completed / business consumed | Website claim、AGENT Runtime | 提前释放业务席位 | 原样保留现役完成转换 |

上述新增对象通过删除反事实：

- 删除 job—Target binding，正常轮询无法证明回到原 Tab；
- 删除 Website device N，claim 无法动态裁决实际 grant；
- 删除 Website 持久在途计数，本地少报或旧 heartbeat 会造成超领；
- 删除 global not-before，N 个到期请求会把页面读取频率放大 N 倍；
- 删除复数 current-job recovery，重启后只能恢复一个已占席位工单。

不增加 signed N receipt、AGENT/Browser N 投影、central scheduler、Tab数据库、第二队列或第二WAL，因为现役 Website claim、FIFO、Target registry、WAL和设备列已经有真实消费者并能承担对应责任。

## 12. 顺序化施工工单

### WO-00：明确解冻与双仓权威替换

依赖：无。

动作：

- 在改造前冻结一轮现役 ONE BY ONE 真实基线：固定相同任务、模型、附件、物理命令、Target/Document变化、WAL effect、40/30秒节拍和Website最终存储读回；
- 明确解冻容量1、唯一 production Tab、正常等待持续独占 FIFO/lease 和 `FROZEN-EXACT-TARGET-POLL-RESULT-REVISION-001`；
- 同一候选替换 AGENT Runtime、GPT、Browser 和 Website ai-acceptance 命中法案；
- 同步替换三份 AGENT Blueprint、Website AI Acceptance Blueprint 和跨仓合同声明；
- 旧 law 正常 supersede，不修改历史 migration。

验收：active corpus 只剩一套动态 N 语义；Browser lane仍为1；普通轮询明确零导航；基线证据绑定 exact candidate、run id 和任务身份。

失败停止：新旧法案同时 active，或任一跨仓 Owner/contract version 不一致。

### WO-01：Website V6 动态容量合同

依赖：WO-00。

主要目标：

- `packages/ai-contracts/src/production-control/**`；
- `docs/specs/ai-acceptance/xuanxue-ai-production-v6.contract.spec.json`；
- AGENT 对应 dependency spec。

动作：

- 升级 control contract；
- Manifest 删除“当前实际容量固定为1”的语义，只声明不可配置的 `N_contract_max=4`；
- Worker attestation只上报 `agent_attested_in_flight`，不自报当前设备容量；
- heartbeat receipt不返回当前N；
- `browser_action_capacity_total=1`保持不变；
- 更新hash vector、provider/consumer dependency和唯一合同检查。

验收：claim请求支持上限内的1、3、4通过；0、5、非整数、未知字段、伪造当前N字段和合同签名不符全部失败关闭。数据库能保存64不得成为协议通过证据。

### WO-02：前向 migration

依赖：WO-01。

候选新增一份下一序号 migration。施工时必须以当前 migration registry head重新确定文件名，不得预先假定编号仍为空闲。

动作：

- live lease或`website_current_business_set`非零即失败；本次无兼容桥，旧合同工单必须先按旧链完整收敛；
- supersede旧session；
- 保留旧合同历史容量分支；
- 新合同不再让session保存“AGENT自报的当前N”，只保存本地在途和协议支持上限所需事实；
- Website持久化在途允许缩容期暂时大于当前N，但不超过历史已合法grant的数量；
- 保留既有device N，不统一写3；
- migration preflight要求所有既有device N均在首版支持范围1..4；超出即失败关闭，不静默改值；
- 不新增表、列、队列或状态。

验收：历史migration bytes/hash零变化，registry/hash/DB constraint读回一致。

### WO-03：Website容量入口、heartbeat和claim

依赖：WO-01、WO-02。

主要目标：

- `services/api/src/commercial/runtime-ai-acceptance.ts`；
- `services/api/src/commercial/runtime-route-match.ts`；
- `services/api/src/ai-production/device-auth.ts`；
- `services/api/src/ai-production/worker-session-repository.ts`；
- `services/api/src/ai-production/job-claim-repository.ts`；
- `services/api/src/ai-production/job-claim-selection.ts`；
- `services/api/src/ai-production/review-query-repository.ts`；
- `apps/web/app/admin/ai-acceptance/**`。

动作：实现唯一PUT、统一锁序、Website持久在途计数、复数 `ACTIVE_ATTEMPT` recovery、`CONSUME_CURRENT_RESULT`分流、新设备默认1和管理页写后读回。heartbeat只保留资格/在途证明，不传播当前N。

验收：

- 3 -> 4后的下一笔claim只补1，无需等待heartbeat；
- 4 -> 3立即阻断新claim，不取消四个既有工单；
- Website数据库在途与AGENT attestation同时作为收紧门，任一低报都不能超领；
- existing `ACTIVE_ATTEMPT` regrant在超额缩容时仍全部恢复；`CONSUME_CURRENT_RESULT`不得重新进入Product/Browser；
- 全新enrollment exact row为1，幂等重放不改变既有N；
- PUT/heartbeat/claim真实PostgreSQL并发全排列不超领；
- revoked/foreign device、CAS mismatch和回复不明路径失败关闭。

### WO-04：AGENT Runtime多执行与有界领取

依赖：WO-01、WO-03。

主要目标：

- `src/lib/local-runtime/production/control-contract-dependency.ts`；
- `transport-protocol.ts`；
- `worker-session.ts`；
- `runtime-loops.ts`；
- `cloud-client.ts`；
- `executor.ts`；
- Runtime inspector、acceptance和proof。

动作：删除“当前实际N=1”的运行假设；Runtime只按 `N_contract_max=4`、本地在途去重和executor可用量提出 `requested_new_limit`，不接收当前设备N；Website claim receipt返回多少真实grant，Runtime就启动多少。过期或非法资格只阻断新claim，不杀现有工单。

验收：N=1与冻结基线逐项等价；1..4属性测试；admission-pending占槽；同job不重复计数；设备N变化无需heartbeat或重启；AGENT和Browser均不存在当前N副本。

### WO-05：Browser多Target独占绑定

依赖：WO-04。

主要目标：

- `src/lib/browser/infrastructure/browser-authority-broker.ts`；
- `browser-target-acquirer.ts`；
- `browser-lane-coordinator.ts`；
- `browser-infrastructure-supervisor.ts`；
- `src/lib/browser/chrome-extension/extension-target-authority.ts`；
- `exact-target-runtime.ts`；
- Browser wire源schema、生成物、WebSocket两端；
- Browser inspector、acceptance和real proof。

动作：只在现役Target registry条目增加job绑定；退休single parked假设；多attachment按Target隔离；新增bound-observation；保留单active claim和单lane；仅为已grant的具体job懒建Tab；执行闭环结束后关闭对应Tab，不建空闲池。

验收：job/Target双向唯一；没有unresolved DISPATCHED时一个Tab关闭不影响其它；普通轮询Page.navigate增量为0；任意时刻active物理Target至多1；system-owned Tab与bound Tab数量一致；用户Tab变化为0。

### WO-06：GPT释放车道与全局轮巡

依赖：WO-05。

主要目标：

- `src/capabilities/gpt/production-browser-lifecycle.ts`；
- GPT wait Child及对应acceptance/inspector；
- Browser lane的global observation gate。

动作：pending后保留绑定但释放lease；nextCheckAt到期才进入现役唯一FIFO；同一FIFO以一个global not-before限制真实observation且未到期waiter不占lane、不堵eligible mutation；一次lease只读一次，pending重新排尾；保留40秒静默和生成期轻量观察。

验收：受控条件下A/B/C/A；普通条件只验eligible FIFO、无插队、无饥饿；相邻observation至少30秒；未到期observe的Tab activation、DOM read和browser_action_in_flight增量均为0，后续eligible mutation仍可执行；总频率不随N增加；无第二timer service/scheduler/queue。

### WO-07：业务闭环释放与故障恢复

依赖：WO-03、WO-04、WO-05、WO-06。

主要目标：

- `src/lib/local-runtime/production/runtime-business-admission.ts`；
- GPT Product settled与Runtime admission readback之间的Browser binding生命周期连接点；
- Browser job binding释放入口。

动作：只有Website闭环事实可释放job/Tab；Product settled只park；WAIT_NEW_ATTEMPT释放旧绑定；`CONSUME_CURRENT_RESULT`只走现役admission reconciliation，Product/Browser调用增量为0；删除精确清理当前job且不碰其它job。Website staging、Domain Consumer和admission receipt实现不在本工单预防性修改，只作为只读回归证据；若验收暴露真实GAP，再形成精确Website变更工单。

验收：Provider/Outbox/staging均不能提前释放；Website入库回复不明按数据库读回；故障终止链完整；无unresolved DISPATCHED时单job故障不污染其它槽。

### WO-08：分级真实放行

依赖：WO-00至WO-07全部完成。

动作与证据见下一节。把 Gate A-E 的事实声明接入双仓 active law 的唯一 dynamic-proof 路由。任何静态、fixture或模拟DOM通过都不能替代真实Chrome和真实GPT证据；独立real-proof只能生产证据，不能另发PASS。

## 13. 每个核心步骤的验收要点

| 核心步骤 | 必须证明 | 不能冒充的证据 | 失败结果 |
|---|---|---|---|
| 动态N写入 | exact device CAS、写后读回、唯一持久列 | UI显示成功 | 阻断配置放行 |
| 新设备默认N | enrollment后exact row=1；重放不改既有N | 协议或数据库上限 | 阻断上线 |
| heartbeat资格 | receipt签名、在途去重、重放返回原receipt且不携带当前N | AGENT本地日志 | 阻断新claim |
| claim容量 | Website device N、Website持久在途和AGENT attestation三者只收紧不放大 | 单元函数返回值 | 阻断多工单领取 |
| 容量并发竞态 | PUT/heartbeat/claim真实PostgreSQL全排列后grant不超过Website安全门 | 串行单测 | NO-GO |
| 恢复与结果消费分流 | `ACTIVE_ATTEMPT`只同attempt regrant；`CONSUME_CURRENT_RESULT`只做admission reconciliation且Product/Browser增量为0 | 混合返回一个current-job数组 | 阻断重启放行 |
| 超额缩容重启 | 4->3后重启仍恢复4个既有ACTIVE_ATTEMPT，新job grant=0 | 只恢复N个或首个 | NO-GO |
| job/Tab绑定 | 双向唯一、错误绑定输入为0 | Tab标题或URL相似 | 阻断Browser放行 |
| 单Browser lane | 所有现实动作最大并发1 | 只有submit并发为1 | 阻断Browser放行 |
| pending释放车道 | A绑定仍在；等待期active lease/claim=0；40秒门后B可获同一lane | 只看到A最终ready | 阻断Browser放行 |
| observation不堵lane | 未到全局时间的observe不激活、不读DOM、不占active；后续eligible mutation可执行 | 最终轮巡顺序 | NO-GO |
| 全局轮询 | 相邻真实observation至少30秒 | 每Tab自己30秒 | 判定会N倍放大，NO-GO |
| 正常切Tab | exact Tab激活后current Document fresh | 缓存document或URL命中 | 失败关闭当前job |
| 正常零导航 | pending轮询Page.navigate/reload/侧栏/搜索均为0 | 最终URL正确 | NO-GO |
| submit至多一次 | WAL+真实physical input count | Product调用次数 | NO-GO |
| 生成期轻量读取 | generating时不提取完整DOM/semantic text | fixture pending | NO-GO |
| settled后生命周期 | Provider ready、Outbox、staging后binding仍在；Website终态读回后只释放该job | Provider已返回 | NO-GO |
| 业务完成 | admission receipt与领域存储readback | Provider结果、Outbox、HTTP 200 | 不释放席位 |
| 缩容 | 不杀旧工单、新claim=0、自然收敛 | Tab数量瞬间等于N | NO-GO |
| authority完全丢失 | 不扫描未知旧Tab；CONFIRMED在新system Tab零submit恢复；其它job identity不变 | 找到相似URL | NO-GO |
| 故障隔离 | 确定终态故障只改变当前Target/job；unresolved DISPATCHED则整lane阻断 | 通过第二lane让其它Tab继续 | NO-GO |
| GPT频繁操作提示 | 真实Gate全程取得可审计的页面警告与Chrome lifecycle覆盖，warning/crash/detach均为0 | AGENT日志、fixture或“肉眼没看到” | NO-GO |

## 14. 真实放行阶梯

### 14.1 唯一质量裁决与证据归位

READY 只接纳静态检查、类型/属性/并发模型测试、fixture 和模拟故障；它不能证明真实 GPT 安全或 Website 已入库。唯一裁决入口固定为：

```text
AGENT:   cd /Users/nexgen/Documents/AGENT && npm run quality:check -- READY
Website: cd /Users/nexgen/Documents/xuanxue-web && pnpm quality:check -- READY

AGENT:   cd /Users/nexgen/Documents/AGENT && npm run quality:check -- RELEASE
Website: cd /Users/nexgen/Documents/xuanxue-web && pnpm quality:check -- RELEASE
```

Gate A-E 的真实事实必须接入命中 active law 的唯一 dynamic-proof route：

- 容量、锁和claim：真实PostgreSQL事务证据；
- Tab绑定、单lane、零导航、轮巡和故障隔离：真实Chrome/CDP证据；
- submit与恢复：唯一Browser WAL、physical input count和effect identity；
- GPT安全：真实GPT页面警告事实与Chrome crash/detach事件；
- 业务完成：Website admission receipt加领域存储readback。

每份证据必须绑定 exact candidate hash、run id、device、job/attempt/effect身份和时间线。独立real-proof脚本只生产证据，不得输出第二PASS；任一候选漂移、证据缺口或dynamic route缺失都必须让RELEASE失败。

GPT安全观察从该Gate首次submit前开始，到最后一个工单Website storage readback结束。real-proof在每个Target上于首个submit前安装只读、事件驱动的页面警告采集，并复用正常coherent observation的数据包；它不得增加轮询、点击、输入、导航或额外DOM读取。任一可见“操作频繁”、rate-limit、usage-limit提示记录为结构化warning fact并保留文字hash/截图证据；Chrome的tab crash、Target crash、debugger detach沿现役lifecycle事件线采集。采集器中断或时间线存在未覆盖区间，整轮FAIL；AGENT日志、fixture和“肉眼没看到”不能证明为零。

### Gate A：N=1回归

必须证明：

- 使用WO-00冻结的同任务、模型、附件与计时口径逐项对比现役ONE BY ONE；
- 新实现允许等待期内部park/reacquire，但不得增加Provider输入、Page.navigate、reload、错误Target激活或提前释放业务席位；同一Tab已经active时activation update增量必须为0；
- physical submit至多1；
- normal Page.navigate为0；
- admission receipt前下一新job claim为0；
- 无GPT频繁操作提示、页面崩溃或debugger conflict。

旧real-proof中“normal poll park/reacquire=0”和“永不发生observation Tab activation”的ONE BY ONE实现断言必须被逐条替换：N=1仍不允许无意义activation；N>1只允许激活当前job精确绑定Target；所有N仍要求normal Page.navigate=0、active物理Target最大1、错绑输入为0。

### Gate B：N=2安全金丝雀

必须使用真实Chrome和真实GPT：

- 两个独立Tab同时生成；
- Browser action in-flight最大值为1；
- 两个Target不共享；
- 相邻Provider observation至少30秒；
- submit后40秒页面命令增量为0；
- 没有unresolved DISPATCHED时，任一Tab关闭只影响自身工单；
- 无频繁操作提示、Tab crash或debugger conflict。

出现一次Provider频繁操作提示或页面崩溃，立即 `NO-GO`，不得尝试N=3。

### Gate C：N=3价值证明

运行前冻结成对批次、任务身份、模型、附件、顺序和统计口径。N=1与N=3各至少三轮，每轮不少于六个相同类型工单；计时从Website发出该轮首个lease开始，到该轮最后一个领域存储commit结束，慢单和失败单全部计入，不得看完结果再改阈值。

- 三轮均无错投、重复submit、普通URL导航、Provider警告或Tab crash；
- 每个工单均读回Website admission receipt；
- N=3的`admitted jobs/hour`三轮中位数至少比N=1提高20%，且最终admission成功率不得下降；
- Browser现实动作节拍不比N=1的现役安全门更激进。

如果安全但最终入库吞吐没有提升，判定无建设价值，不放行。

### Gate D：N=3崩溃与隔离恢复

必须在真实Chrome、真实GPT和真实Website数据库中完成：

1. 三个工单均submit CONFIRMED并处于pending后强制终止AGENT；
2. 重启后Website regrant全部三个 `ACTIVE_ATTEMPT`，每个工单保持原attempt/effect，physical submit增量均为0；
3. 验证WebSocket短断且Extension内存仍在时，三个job binding逐个精确恢复；
4. 验证Extension/Chrome authority完全丢失时不扫描、不操作未知旧Tab，CONFIRMED effect只在新system Tab按WAL零submit恢复；
5. 关闭A Tab后，A无unresolved DISPATCHED时B/C继续；若制造unresolved DISPATCHED，整条Browser lane必须阻断且不得重放；
6. 三个工单最终都取得Website admission receipt和领域存储readback。

任一错误Target、全局Target误清、猜Tab、重复输入、existing-job漏恢复或其它job identity变化，立即NO-GO。

### Gate E：动态3 -> 4 -> 3与N=4安全高水位

必须证明：

- 管理页只修改一次N；
- 无代码变更、发版、migration、re-enrollment或Runtime重启；
- 3 -> 4在下一笔claim中最多补1单，无需等待heartbeat；
- 四个独占Tab可同时处于生成等待，但Browser lane、40秒静默和30秒observation总频率仍满足全部硬边界；
- N=4全程GPT warning、Tab crash和debugger detach均为0，每单均有Website storage readback；
- 4 -> 3且四单在途时不取消任何工单，新claim=0；
- 第一单闭合后剩3单，仍不补；
- 再闭合到2单后才补1；
- 每个闭环工单只关闭自己的system Tab，不保留空闲Tab池、不操作用户Tab；
- Browser lane最大并发始终为1。

Gate E通过后，首个RELEASE才取得`1..4`的生产安全结论。N=5或更大仍被同一合同安全上限拒绝，直到新候选完成目标高水位真实Gate并替换该上限。

## 15. 发布顺序

固定顺序：

```text
明确解冻
-> 双仓active law与Blueprint同候选替换
-> Website provider contract升级
-> 前向migration
-> Website capacity/heartbeat/claim
-> AGENT Runtime多执行与有界领取
-> Browser多Target绑定
-> GPT全局轮巡
-> 业务闭环与故障恢复
-> 双仓原生CHANGE/READY
-> N=1真实回归
-> N=2金丝雀
-> N=3价值证明
-> N=3崩溃恢复
-> 3->4->3与N=4安全高水位证明
-> RELEASE
```

生产切换：

1. 停止新claim；
2. 等live lease与`website_current_business_set`全部归零，并读回不存在旧合同未闭环工单；
3. Website应用前向migration并发布新contract；
4. 旧AGENT因contract version不等失败关闭；
5. 发布匹配的AGENT consumer；
6. 新session先以N=1启动；
7. Gate A通过后升N=2；
8. Gate B通过后升N=3；
9. Gate C、D、E全部通过且双仓RELEASE通过后，才可正式把N=3作为生产配置，并开放1..4的一键调整。

## 16. 施工准入与完成公式

正式施工前必须重新绑定双仓HEAD、branch、tracking ref、dirty state、active law、Blueprint和provider/consumer contract。任一命中施工面的用户改动不得覆盖。

方案完成必须同时满足：

```text
授权人明确解冻命中冻结条款
AND 双仓authority与contract一致
AND WO-00..WO-08全部PASS
AND 所有硬边界证据PASS
AND Gate A-E真实证据PASS
AND 每个证明工单均有Website admission/storage readback
AND 第二queue/store/WAL/scheduler/N投影/verdict数量为0
AND 精确控制本设备V6实际业务容量的活动消费者不再硬编码1、3或10
AND 协议支持上限、Browser资源安全上限、领域业务并发和系统故障熔断阈值未因数字相同被误删
AND anti-overdesign violation=0
AND 双仓均为clean Git commit
```

任何静态检查、模拟DOM、Provider返回、Outbox delivered或HTTP 200都不能单独证明本方案完成。

## 17. 三子智能体审计收口

本轮三名只读审计员分别主审过度设计与回归、闭环与Owner、验收与真实证据；三者都覆盖了用户指定的四项问题。审计只裁决方案文本，不替代后续双仓原生质量结论。

| 审计项 | 初稿阻断点 | 终稿收口 |
|---|---|---|
| 过度设计 | current N被Website、heartbeat、AGENT、Browser多层传播；预防性改64和空闲Tab池 | current N只留Website设备行；删除signed N和AGENT/Browser N投影；不改无关Browser资源10；无空闲Tab池 |
| 闭环严密 | Website持久在途门缺失；execution regrant与result consume混用；故障只到Browser typed fact | Website数据库成为grant最终安全门；三组集合分流；所有故障走到Website持久决定和AGENT读回 |
| 最小回归 | 对“单Tab故障不影响其它工单”和N=1等价承诺过宽；Website领域主链被预防性列为修改面 | unresolved DISPATCHED仍阻断唯一lane；冻结ONE BY ONE真实基线逐项对比；Website领域主链只读回归 |
| 验收清晰 | N=64无Provider证据；Gate未归位唯一quality；告警、崩溃和吞吐口径不完整 | 首版生产上限4；Gate A-E进入唯一dynamic proof；连续警告/lifecycle证据；固定批次、计时和20%吞吐阈值 |

终稿裁决保持：

```text
方案架构：CONDITIONAL GO
生产代码施工：BLOCKED，等待授权人明确解冻并重新绑定双仓authority
真实安全与效率：NOT_PROVEN，必须由Gate A-E裁决
```

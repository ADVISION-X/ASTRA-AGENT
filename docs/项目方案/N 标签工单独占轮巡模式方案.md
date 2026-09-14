---
document_type: project_scheme
scheme_id: N_TAB_EXCLUSIVE_ROTATION
scheme_name: N 标签工单独占轮巡模式
status: ready
created_at: 2026-09-13
updated_at: 2026-09-15
implementation_status: NTAB_BASE_IMPLEMENTED_SECOND_RUNTIME_CLOSURE_DESIGN_ONLY
test_status: SECOND_RUNTIME_EVIDENCE_BOUND_REPAIR_NOT_RUN
release_status: NOT_RELEASED
---

# N 标签工单独占轮巡模式方案

## 0. 文档身份与当前裁决

本文件是授权施工的唯一项目方案，不是 active law、Blueprint、跨仓合同、运行时配置或第二质量结论。原 N-TAB 建设及第20节修复已经完成双仓代码合并；2026-09-14 第二次 N=3 真实翻译运行证明了 Website 入库主链、三业务席位、工单独占 Tab 与 Browser 单物理 lane 均已运行，同时暴露出首轮 Provider observation 绕过全局60秒门、历史 CONFIRMED effect 因现役候选身份漂移无法零提交收回、同类失败被 Website 反复签发新 Attempt，以及 orphaned artifact 时间事实不完整四个剩余断点。本文件继续原位承接唯一终局方案，不新建 V2、补丁方案或第二实施文档。

当前裁决：

```text
方案：可施工
N-TAB基础实现：已合并至双仓 main
生产配置：N=3 已生效
当前真实运行：N=3；截至2026-09-14 23:50（Asia/Dubai）只读快照为65个工单，其中26个完成并具备领域持久化闭包、39个未完成、终态失败0；实时数量会继续变化
第20节修复：已合并至双仓 main；第二次运行未再证明其静态候选，而是暴露第21节剩余断点
第21节终局修复：只完成生产方案、法案差异和施工工单绑定；代码、法案、数据库、服务与 Browser 均未改动
本次修复测试：NOT_RUN；法案精准解冻尚未获授权
发布：NOT_RELEASED
```

原架构仍然有效：Website 唯一拥有动态 N，每工单独占一个 Tab，全部现实页面动作共用一条 Browser lane。本轮不回退该架构，不把 N 降为1调试，也不新增队列、状态库、恢复链、语义验证器或兼容桥。只读快照中的26个完成工单证明 Provider→AGENT→Website→领域持久化主链可用；当前失败集中在既有单链的两个恢复入口，而不是 N-TAB 模型失效。本次继续保持 N=3 和全局至少60秒 observation 硬门。首个 RELEASE 仍只承诺经过真实 GPT 证明的 `1 <= N <= 4`；在这个范围内，`3 -> 4` 才能是后台一次修改。

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
相邻 Provider observation 最小间隔：60 秒
```

GPT wait Child 只计算本工单下一次 observation 的最早资格时间，并立即调用现役 Browser observation typed 入口；它不创建、持有或等待 per-job timer。同一工单任意时刻最多有一个 pending observation 请求。

Browser lane 只拥有系统级机械限速：真实页面 observation 的总频率不得随 N 增长。现役唯一 FIFO 的 waiter 只接收目标模式和瞬时 `eligibleAt`，由 local-browser-session 从目标模式内部派生私有 `requestKind`；全局只增加一个非持久 `observationNotBefore` 标量：

1. 普通 mutation、恢复和清理请求的 `eligibleAt=now`；
2. Provider observation waiter 的 `eligibleAt` 等于 GPT Child 提供的本次最早资格时间，其实时资格为 `max(waiter.eligibleAt, observationNotBefore)`；
3. coordinator 只从同一个 FIFO 中取“当前已具备资格且入队序号最早”的请求，未到全局时间的 observation 不得把 `active` 置为 true、不得激活 Tab、不得读取 DOM，也不得堵住后续已具备资格的 submit/准备/清理；
4. 如果当前没有已具备资格的请求，只允许一个 coordinator wake-up timer 等待最早资格点，不得为每个 Tab 建 timer；
5. observation 终止后以真实 `observedAt/terminalAt` 推进 `observationNotBefore`；失败、abort 或断连必须释放 active lane；
6. 一旦旧 observation 到达全局资格点，它按原入队序号参与 FIFO，不得被后来的已具备资格请求长期饿死。

`requestKind` 必须是 local-browser-session 的私有派生事实，公开 lease wait 合同不得暴露该字段；GPT/Product调用方不得自报或改写，否则可伪装成普通mutation绕过全局observation门。

BrowserLaneCoordinator 是唯一计时等待 Owner；这仍是一条 FIFO、一个 lane、一个 timer 和一个限速标量，不是第二 queue、中央 Scheduler 或持久状态机。

只有在 N=3、A/B/C 均 pending、均已具备资格、按 A/B/C 顺序进入 FIFO 且没有其它页面动作的控制场景中，才会看到：

```text
A observe
>= 60 秒
B observe
>= 60 秒
C observe
>= 60 秒
A observe
```

`A -> B -> C -> A` 只是受控示例，不是固定轮转合同。普通运行只要求“已具备资格请求按原入队序号、无插队、无饥饿”。没有其它页面动作时，同一 Tab 两次 observation 间隔的理论下界约为 `N * 60 秒`；它不是平均时延保证。整台设备的页面读取频率仍最多约一次/60秒。

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
PUT /api/commercial/platform/ai-acceptance/devices/:deviceId/capacity
```

精确请求：

```json
{
  "expected_max_in_flight": 3,
  "max_in_flight": 4
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
8. 在同一数据库事务内复用现役 `commercial_audit_events`，审计失败则容量更新一并回滚；
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
- 现役唯一 FIFO waiter 增加 `eligibleAt`，`requestKind` 只在 Browser lane 内由目标模式派生；
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
6. 同一 FIFO 的资格选择保证相邻真实 observation 至少60秒；
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

单 Tab 故障隔离不是无条件的。任一工单存在现实输入结果不明的 `DISPATCHED` 时，唯一 Browser 物理车道必须阻断全部 acquisition；其它工单只可继续不需要 Browser 的本地或 Website 收敛工作。唯一例外是 Website 已持久永久撤权或管理员删除 exact job 后的清理：同一 lane 必须先将该 job 的 active claim 零输入 park并保留原 WAL，再按 exact `jobRefHash` 删除且只删除该 system Tab。不得为维持 B/C 页面执行新增第二 lane、bypass 或重放。

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

- 在改造前冻结一轮现役 ONE BY ONE 真实基线：固定相同任务、模型、附件、物理命令、Target/Document变化、WAL effect、40/60秒节拍和Website最终存储读回；
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

动作：pending后保留绑定但释放lease；GPT Child计算最早资格时间后立即把请求交给现役唯一FIFO且不自行等待；BrowserLaneCoordinator以waiter eligibleAt和一个global not-before作为唯一计时Owner，未到期waiter不占lane、不堵eligible mutation；一次lease只读一次，pending重新排尾；保留40秒静默和生成期轻量观察。

验收：受控条件下A/B/C/A；普通条件只验eligible FIFO、无插队、无饥饿；相邻observation至少60秒；未到期observe的Tab activation、DOM read和browser_action_in_flight增量均为0，后续eligible mutation仍可执行；总频率不随N增加；无第二timer service/scheduler/queue。

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
| 全局轮询 | 相邻真实observation至少60秒 | 每Tab自己60秒 | 判定会N倍放大，NO-GO |
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

### Gate A：N=3干净现场直接启动

必须证明：

- Website唯一动态配置读回为3，AGENT本地不存在N副本，启动与领取过程中不经过N=1或N=2；
- 使用WO-00冻结的三份同类型任务、模型、附件与计时口径，Website一次最多签发3个grant；
- 三个工单分别取得一个system-owned独占Tab，绑定双向唯一，用户Tab变化为0；
- 唯一Browser lane依次处理三个Tab，Browser action in-flight最大值为1；
- 每个工单physical submit至多1；
- normal Page.navigate为0；
- 三个业务席位均闭合前第四个新job grant为0；
- 无GPT频繁操作提示、页面崩溃或debugger conflict。

旧real-proof中“normal poll park/reacquire=0”和“永不发生observation Tab activation”的ONE BY ONE实现断言必须被逐条替换：N>1只允许激活当前job精确绑定Target；所有N仍要求normal Page.navigate=0、active物理Target最大1、错绑输入为0。N=1只保留为后续兼容与性能对照样本，不再作为本轮调试前置台阶。

### Gate B：N=3逐槽ONE BY ONE等价性

必须使用真实Chrome和真实GPT：

- 三个独立Tab可同时生成，但每个Tab内部始终只跑一个工单直至Website入库；
- Browser action in-flight最大值为1；
- 三个Target不共享；
- 相邻Provider observation至少60秒；
- submit后40秒页面命令增量为0；
- 没有unresolved DISPATCHED时，任一Tab关闭只影响自身工单；
- 无频繁操作提示、Tab crash或debugger conflict。

出现一次Provider频繁操作提示、错误Target输入或页面崩溃，立即 `NO-GO`；保持N=3、停止新claim并修复同一断点，不以降N掩盖并发缺陷。

### Gate C：N=3端到端价值证明

先直接完成N=3功能闭环：至少三轮，每轮不少于六个相同类型工单；计时从Website发出该轮首个lease开始，到该轮最后一个领域存储commit结束，慢单和失败单全部计入，不得看完结果再改阈值。

- 三轮均无错投、重复submit、普通URL导航、Provider警告或Tab crash；
- 每个工单均读回Website admission receipt；
- 三轮N=3最终admission成功率不得低于冻结ONE BY ONE基线；
- Browser现实动作节拍不比现役ONE BY ONE安全门更激进。

N=3闭环稳定后，Gate E再制作N=1性能对照；最终`admitted jobs/hour`三轮中位数至少比N=1提高20%。安全成立但吞吐未提升，判定无建设价值，不放行任意N调节。

### Gate D：N=3崩溃与隔离恢复

必须在真实Chrome、真实GPT和真实Website数据库中完成：

1. 三个工单均submit CONFIRMED并处于pending后强制终止AGENT；
2. 重启后Website regrant全部三个 `ACTIVE_ATTEMPT`，每个工单保持原attempt/effect，physical submit增量均为0；
3. 验证WebSocket短断且Extension内存仍在时，三个job binding逐个精确恢复；
4. 验证Extension/Chrome authority完全丢失时不扫描、不操作未知旧Tab，CONFIRMED effect只在新system Tab按WAL零submit恢复；
5. 关闭A Tab后，A无unresolved DISPATCHED时B/C继续；若制造unresolved DISPATCHED，整条Browser lane必须阻断且不得重放；
6. 三个工单最终都取得Website admission receipt和领域存储readback。

任一错误Target、全局Target误清、猜Tab、重复输入、existing-job漏恢复或其它job identity变化，立即NO-GO。

### Gate E：后置N变量承压与动态3 -> 4 -> 3

必须证明：

- 只在N=3功能、异常恢复和真实入库全部通过后，才制作N=1、N=2、N=4对照与承压；N=1不是调试或修复前置；
- N=1与N=3使用冻结的成对批次、任务身份、模型、附件、顺序和统计口径，各至少三轮且每轮不少于六个相同类型工单；
- N=3的`admitted jobs/hour`三轮中位数至少比N=1提高20%，最终admission成功率不得下降；
- 管理页只修改一次N；
- 无代码变更、发版、migration、re-enrollment或Runtime重启；
- 3 -> 4在下一笔claim中最多补1单，无需等待heartbeat；
- 四个独占Tab可同时处于生成等待，但Browser lane、40秒静默和60秒observation总频率仍满足全部硬边界；
- N=4全程GPT warning、Tab crash和debugger detach均为0，每单均有Website storage readback；
- 4 -> 3且四单在途时不取消任何工单，新claim=0；
- 第一单闭合后剩3单，仍不补；
- 再闭合到2单后才补1；
- 每个闭环工单只关闭自己的system Tab，不保留空闲Tab池、不操作用户Tab；
- Browser lane最大并发始终为1。

Gate E通过后，首个RELEASE才取得`1..4`的生产安全结论。N=5或更大仍被同一合同安全上限拒绝，直到新候选完成目标高水位真实Gate并替换该上限。任何后置承压失败都回到同一个故障修复，不把N=3自动降成1作为运行兜底。

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
-> 清空并读回本轮测试批次跨仓残留
-> 动态N=3直接启动
-> N=3逐槽ONE BY ONE等价性与价值证明
-> N=3崩溃恢复
-> 后置N=1/2/4承压、性能对照与3->4->3高水位证明
-> RELEASE
```

生产切换：

1. 停止新claim；
2. 等live lease与`website_current_business_set`全部归零，并读回不存在旧合同未闭环工单；
3. Website应用前向migration并发布新contract；
4. 旧AGENT因contract version不等失败关闭；
5. 发布匹配的AGENT consumer；
6. 读回同一设备Website唯一`max_in_flight=3`，新session直接按动态N=3启动；
7. Gate A—D全部在N=3完成，不经过N=1或N=2调试；
8. N=3稳定闭环后执行Gate E的其它N承压与性能对照；
9. Gate A—E全部通过且双仓RELEASE通过后，才开放1..4的一键调整。

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

终稿裁决更新为：

```text
原方案架构：AUTHORIZED GO
原 N-TAB 生产代码：已合并
原双仓 CHANGE：PASS
原独立施工审计：PASS（完成率99%，准确率99%，P0=0，P1=0）
2026-09-14 日志修复：F1/F2/F3 已按本节精确实施，聚焦单元与静态检查已通过；本次 CHANGE、READY 与 Gate A-E 尚未运行
真实安全与效率：NOT_PROVEN，仍必须由 Gate A-E 裁决
```

## 18. 本轮施工闭环记录

截至本方案进入候选 commit 前，本轮已完成：

1. 双仓 active law、Blueprint、跨仓 V6 provider/consumer contract 与唯一生成投影同步替换，并按授权重新冻结；Browser law 的版本链为已提交 V36 -> 本候选 V37，不存在中间 V37 后再建 V38 的事实；
2. Website 已形成唯一动态 N Owner、1..4 安全上限、新设备默认1、管理端行锁 CAS/同事务审计/readback、claim 锁内持久容量裁决与 recoverable/new 分流；
3. AGENT 已形成动态多工单在途、admission-pending 占槽、每 job 独占 Target、唯一 Browser FIFO、唯一 wake timer、全局30秒 Provider observation节拍、正常轮询零导航和 confirmed-effect 零submit读回；
4. unresolved `DISPATCHED` 的唯一 cleanup 例外已精确绑定同一 job 的 Website永久撤权或管理员删除；普通 admission、普通 WAIT、attempt replacement、其它 job清理与全部 acquisition 均继续阻断；
5. Browser release 的 authority映射、same-job WAL门、active claim零输入 park、FIFO、预授权 WebSocket、exact jobRefHash ack、Extension精确删Tab及删A不伤B均有现役行为验收；无消费者的幽灵验收文件声明已删除，没有新增空文件或第二链路；
6. 双仓原生 `quality:check CHANGE` 已分别输出 `CHANGE_PASS`；三名最终只读审计员均达到不低于95%的门槛，最终Browser安全审计与双仓交叉审计均为99%/99%、P0/P1为0。

上述记录是原建设候选的历史事实。此后生产已应用 `0137_ai_production_dynamic_n_tab_capacity.sql`，设备 `aipdev_709b550b2decd50644df15ed15cfaf12` 的唯一 `max_in_flight` 已经通过现役 CAS 从 1 调整为 3；本次启动日志证明 Website 一次签发 3 个 grant，AGENT 完成 3 个 durable accept、3 份材料校验和 3 次 lease renew。实际操作跳过了原定 N=1、N=2 逐级 Gate，Gate A-E 仍未完成，因此仍是 `NOT_RELEASED`，不得把局部容量生效写成 N-TAB 生产闭环已经通过。

## 19. 2026-09-14 首次 N=3 启动问题修复闭环（按测试清场与直接 N=3 校正版）

### 19.1 本轮边界、候选与证据绑定

本节只处理 2026-09-14 首次 N=3 启动暴露的问题，是第 1—18 节原架构的精确修复，不改变模式定义。

| 对象 | 当前绑定 |
|---|---|
| AGENT 仓 | `main@0bf4a1468e8d42e447499d920a403c87f58e1379`，tracking 同 HEAD |
| Website 仓 | `main@f67c9f56dd13354d51bb195991270f033e7590e8`，tracking 同 HEAD |
| AGENT dirty state | 本方案文件是本轮授权差异；未获本方案授权的 untracked `docs/项目方案/GPT聊天自动重命名-完整实现方案.md` 必须原样保留 |
| Website dirty state | 本轮仅允许两份现役 Blueprint、F2/F3 三个生产文件及其现役 inspector/test；并发出现的 untracked `docs/项目方案/SEO生产工单清理与完成分栏-完整实现方案.md` 属于其它工作，必须排除本候选并原样保留 |
| Website 启动日志 | `/Users/nexgen/.codex/attachments/8e14c4b8-9b1d-47d1-a663-22f0ab834e10/pasted-text.txt`，SHA-256 `d5d3c80320c27bb2e8a2cbbeef0d2bbb1a202abff021ff0c87c5faf8f1fd0ad7` |
| AGENT 启动日志 | `/Users/nexgen/.codex/attachments/200238c4-7262-4a16-82f6-13f097a1fb61/pasted-text.txt`，SHA-256 `b126dc4c33ac1c9116f34c75fe20497499301db04242cb8b4761b47d5ddbe191` |
| 回归节点 | 双仓 annotated tag `checkpoint/one-by-one-pre-ntab-20260914`；它只用于恢复，不是 READY/RELEASE 证明 |

本轮方案已进入实施候选：两份现役 Blueprint 已精准固化 F2/F3；Website F2/F3 代码与现役 inspector/test 已修改；数据库先删除已证明无后代、无 AI job、无 Provider effect 的 exact F1 孤立根，最终审计前又按第19.9节冻结分母并精确删除全部58个未完成/旧策略测试 AI 工单图。公开知识 Worker 仅为防止清场期间自动重建而停止，其它 Website 服务、Browser、生产配置和发布均未由本轮变更。

本节接受授权人的最新裁决并覆盖本节此前版本：

1. 当前 `LOCALIZATION_AI_JOB_BINDING_CONFLICT` 来自测试期间一次不完整删除留下的异常数据组合；不得为这组测试残留修改长期产品合同、禁止正常重建或增加 tombstone/replacement/兼容分支；
2. 宁可把本轮测试数据及其跨仓残留精确清空，再用全新业务身份重建；
3. 设备唯一动态 N 保持为3，不硬编码，也不先降到1或2调试；
4. 其它 N 只在 N=3 功能闭环稳定后作为承压、性能对照和动态调节验收，不是本轮修复阶梯。

### 19.2 证据裁决：三个问题与一个待证明面

| 编号 | 证据 | 裁决 | 首个直接断点 | 唯一 Owner |
|---|---|---|---|---|
| F1 | Website 日志 210—212及此前管理员删除事实 | 确认测试数据污染，不裁决为长期代码缺陷 | 旧 AI 子工单被删除，但 `localization_jobs` 根被保留为 `cancelled + ai_production_job_id=null`；sender随后命中这组非自然测试状态并在绑定门失败 | 本轮测试清场；不改 Website localization 产品语义 |
| F2 | Website 日志 212、215 | 确认事实表达错误 | Worker 单轮业务失败被外层写成 `runtime.start` failed，同时 `start.sh` 仅凭进程存活 10 秒显示 `active`，使人无法从启动输出区分“进程存活”与“本轮业务成功” | Website system-security + public-knowledge worker |
| F3 | Website 日志 270—411 共 16 次；AGENT 日志 20 | 确认日志语义错误 | Website 把持久且合法的 `CAPACITY_ZERO` 回执归类为 failed/BLOCKING；AGENT 对同一回执正确记录为 succeeded | Website ai-acceptance/runtime-log consumer |
| E1 | AGENT 日志 16—26 | 局部 PASS | N=3 已一次领取并 durable accept 三工单，材料和 lease 正常 | Website capacity + AGENT runtime |
| G1 | 两份日志均没有对应证据 | 未证明，不是已确认代码故障 | 尚未证明三个独占 GPT Tab、唯一 lane 轮巡、前台激活后 fresh readback、Provider 结果、Website admission/storage | 后续 Gate A-E |

F1 的事实链固定为：

```text
管理员物理删除旧 ai_production_job
-> 同一 localization_jobs 根记录按授权保留为 cancelled + ai_production_job_id=null
-> 自动 sender 后续再次处理同一翻译身份
-> createLocalizationJob 命中仍存在的 cancelled 根
-> bindLocalizationAiProductionJob 拒绝把 cancelled 根重新绑定
-> LOCALIZATION_AI_JOB_BINDING_CONFLICT
-> 事务整体回滚，没有形成可用新工单
```

`bindLocalizationAiProductionJob` 的不可变保护仍然正确，必须保留。真正要删除的是这次测试批次的完整旧数据，而不是删除保护、把 cancelled 改回 queued、让 sender 永久忽略该身份，或建立 replacement job。清场结束后必须由新工单、新 localization 根和新 AI job 正常重建。

### 19.3 首次故障修复的四维对齐裁决

本小节只记录F1/F2/F3首次修复当时的边界；随后授权的60秒全局observation节拍以19.10为准，并精准替代本小节中“法案零变化、AGENT Browser源码零变化、仅两份Blueprint变化”的旧候选限制。

| 维度 | 现役权威 | 本轮裁决 |
|---|---|---|
| 法案 | Website `LAW-AI-ACCEPTANCE-003-V8`、`004-V23`、`012-V25`；`LAW-LOCALIZATION-013-V11`、`016-V1`、`019-V6`；`LAW-PUBLIC-KNOWLEDGE-CONTENT-005-V25`；`LAW-SYSTEM-SECURITY-009-V7`、`017-V4`；AGENT Runtime Log、Browser 与生产 Runtime 现役法案 | 保留唯一身份、不可变绑定、局部 ready 不冒充端到端 ready、零任务 claim 合法终态和 unresolved effect 失败关闭；不新增“异常数据永久禁止重建”规则 |
| 施工图 | Website `SYSTEM-BLUEPRINT.md`、AI Acceptance、System Security Startup；AGENT V6、Runtime Log Spine、Local Browser Authority | 不新增施工图；仅在现役 AI Acceptance 与 System Security Startup 两份 Blueprint 精准固化 CAPACITY_ZERO、30秒退避、`job.execute` 与 `process_alive` 实施语义，其余 Blueprint 零变化 |
| 代码 | Website claim repository、public-knowledge server、`start.sh`；AGENT现役 runtime/Browser 路径只读回归 | localization sender、AGENT claim/cleanup与Browser WAL不因本次测试残留修改；长期代码仅修复F2/F3的日志真实性和满载节拍 |
| 质检 | Website `pnpm quality:check`；AGENT `npm run quality:check`；各自现役 inspector/acceptance；Gate A-E | 补足直接缺口的正反例，再由双仓唯一原生质量命令裁决；静态 PASS 不替代真实 Gate |

若施工时发现必须改变跨仓字段、数据库 schema、法案语义或冻结 Browser submit/readback 语义，立即停止。本方案未授权这些扩张，必须回到方案层重新裁决。

### 19.4 终态合同

修复后的唯一主链必须是：

```text
Website进入现役draining，设备动态N仍为3
-> 冻结本轮测试分母，停止新claim但不改变N
-> 证明每一项都是本轮测试数据且没有需保留的Website admission/storage
-> 用现役Website未完成工单删除Owner删除有归属的测试图
-> 对孤立的测试 localization 根执行一次精确事务删除
-> Website exact job读回404
-> Browser Authority present时由AGENT现役website-admin-deletion purge逐job清除
-> exact system Tab、Browser WAL、task、outbox、task-dir、evidence全部读回为空
-> 新建全新测试工单和全新业务身份
-> Website恢复active，动态N仍为3
-> 一次最多签发3个grant，直接进入三Tab单lane真实闭环

Website claim 回执
-> LEASE_GRANTED / NO_ELIGIBLE_JOB / CAPACITY_ZERO / DRAINING：请求已取得合法持久回执，span succeeded
-> CLAIM_BLOCKED：span failed
-> CAPACITY_ZERO 下一次请求最早 30 秒，仍使用现有 next_claim_after_ms

Website 启动输出
-> Core ready 只证明 Core
-> Domain Worker process_alive 只证明进程仍存活
-> 单轮业务失败使用 job.execute/error 事实，不写成 runtime.start failed
-> Worker 继续使用现役 loop/backoff，不因一个领域任务失败退出，也不伪报该轮成功
```

这里的“Tab 在前”仍沿用现役 Browser 合同：每次动作由唯一 lane 调用 `chrome.tabs.update(tabId,{active:true})`，随后重读同一 tab/window、active、discarded、load、Target 与 current Document。它只保证该 system Tab 是其 Chrome 窗口当前 Tab，不抢夺 macOS 前台应用或操作者窗口焦点。

### 19.5 原子工单

#### IR-00｜保持 N=3 的测试冻结与事实快照

目标：在清场和代码施工前停止新增现场，但不通过降N掩盖问题。

动作：

1. 只读记录双仓 HEAD/tracking/dirty、设备行当前 N、当前 Website 未闭合业务集合、AGENT task/outbox、Browser WAL 和 system Tab 绑定；
2. 读回设备 `aipdev_709b550b2decd50644df15ed15cfaf12.max_in_flight=3`，整个清场、修复和重启过程禁止改成1或2；
3. 使用现役 Website `draining`/停止新claim控制面冻结领取；它只冻结入口，不修改N，不取消当前在途；
4. 对每个 `DISPATCHED` 保存 exact job/attempt/effect/command 与 Website 当前状态读回；
5. 首轮已知测试候选至少包含旧根 `localization_c86a73e2-4b4d-4754-b04e-3704fb5d6ffe`、已删除旧job `aiprod_1a7a73ad-1a74-4123-8d71-e78e81ca51a9`，以及本次三job `aiprod_89f3fa23-5b10-4c5b-96c5-46d4e77c18a1`、`aiprod_51f4367e-a819-4db3-b647-225dfaf38aae`、`aiprod_b3f21ddf-200c-4b53-ba2a-b069b5869d34`；它们只是查询种子，不是最终分母，必须从Website外键图与AGENT持久层向两侧闭包。

验收：N读回始终为3；draining后没有新grant；测试分母清单包含每个Website row/object与AGENT本地责任的 exact identity、来源关系、保留/删除裁决。任何身份不明、非测试数据、已admitted业务或unknown external effect均停止删除。

#### IR-01｜本轮测试数据跨仓精确清场

Owner：长期生产仍只有 Website 现役管理员删除路径与 AGENT 现役 `purgeDeletedJob`。本轮另有一个仅存在于已授权操作时段的“一次性测试数据库清场责任”：它只处理不属于 public-knowledge work-order 可达闭包、又已由完整数据库分母证明无 admission/有效 Provider effect 的 localization 测试图；不落代码、接口、表、脚本或常驻命令，执行结束即消失，因此不形成第三条生产清理链。

动作：

1. 先生成“删除集合”和“保留集合”。删除集合只允许包含本轮测试工单、其unfinished runs/articles、四个候选job对应的AI/localization后代、私有材料/输出对象、AGENT task/outbox/task-dir/evidence、Browser WAL及exact system Tab；保留集合至少包含设备与`max_in_flight=3`、用户/凭证、migration/contract、其它工单、所有非测试与已admitted业务；
2. 若数据库只读证明全部可变业务行均属于本轮测试，仍按现役Owner逐图删除并读回，不执行`DROP DATABASE`、`TRUNCATE`、schema重建或migration回退；若存在任一非测试或已admitted数据，立即收敛为exact测试图，不扩大删除；
3. Website进入draining后，先用现役未完成工单删除接口处理能由work order闭包证明的测试图；每个调用必须读回以下唯一合法终态之一：有效完成量为零时 exact Work Order root 物理缺席，有效完成量大于零时 `status=paused && completed_count>0 && unfinished_count=0`；两种终态都必须同时证明 purged job/article 不存在并保留接口声明的 admitted 项；
4. 对无法由现役work-order图触达、但已由第1步证明为本轮 localization 测试残留的图，使用上述一次性测试数据库清场责任和同一数据库连接单事务处理。允许的形态只有两类：`cancelled + ai_production_job_id is null` 的孤立根，或 exact localization 根、绑定 AI job、runtime、binding attempt 组成且 `business_consumed_at is null` 的完整未完成图。事务必须锁 exact 分母及后代、开启现役 owner-scoped 删除 gate，再次断言 admission/storage 引用为0；若曾 accepted，还必须由 AGENT WAL/outbox 证明 Provider submit 为0；旧策略结果只允许其 output 全部已是 orphaned。删除 exact AI job/root 后依赖现役外键级联清除后代，影响行数不等于冻结值则整事务回滚；该许可只适用于本次测试清场，不能成为可复用生产命令；
5. 删除私有对象前先证明未被保留集合共享；对象删除失败则数据库事务失败关闭，不留下“数据库已删、对象未删”的半清场；
6. Website逐个读回测试job为404后，保持Browser Extension/Authority在线，让AGENT现役`website-admin-deletion`路径按exact job执行：关闭且只关闭其system Tab，purge per-job Browser WAL、evidence、task directory、task/outbox；不直接擦除整个SQLite或整个Browser profile；
7. 若某job存在unresolved `DISPATCHED`，仍不得重放；只有Website exact 404后才允许上述零submit purge。Browser不可用、404不成立或本地责任读回不全时停止清场并保留现场；
8. 清场完成后再次做跨仓闭包读回，旧job、旧localization根、旧system Tab和六类本地责任必须全部为0，保留集合hash不得变化。

验收：

- 删除集合Website row/object均为0，AGENT task/outbox/task-dir/evidence/WAL和exact system Tab均为0；
- 保留集合row count、identity hash、admission receipt与对象引用逐项不变；
- 设备N仍为3，migration/contract/schema数量变化为0；
- 整个清场provider submit增量为0；
- 清场后用全新工单身份运行自动sender，能够创建全新localization根与AI job，证明“正常重建”没有被代码禁止。

#### IR-02｜统一 CAPACITY_ZERO 日志语义并降低满载空转

Owner：Website ai-acceptance/runtime-log consumer。

目标文件：

- `services/api/src/ai-production/job-claim-repository.ts`
- 对应 AI Acceptance 与 Runtime Log acceptance/inspector

动作：

1. 在已经取得合法持久 receipt 的五种 outcome 中，仅 `CLAIM_BLOCKED` 记录 failed；`CAPACITY_ZERO` 与 `DRAINING` 和 AGENT 一致记录 succeeded，同时保留 authorityRef/authorityHash 与持久 receipt；事务、传输、合同等未取得合法 receipt 的异常仍按原生失败记录；
2. `CAPACITY_ZERO.next_claim_after_ms` 从 5000 调整为现有合同允许的 30000；不把当前 N 下发给 AGENT，不新增推送、缓存或第二调度；
3. 不删除原始回执和 reason code，诊断仍可看到 `BUSINESS_CAPACITY_EXHAUSTED`。

验收：五种 outcome 逐项测试；CAPACITY_ZERO 必须是 `jobs=[]`、`reason_codes=[BUSINESS_CAPACITY_EXHAUSTED]`、`next_claim_after_ms=30000`、Website/AGENT 两端 terminal 均 succeeded；CLAIM_BLOCKED 仍 failed/BLOCKING；30 秒内同一满载设备不出现第二次 claim。

#### IR-03｜把 Worker 进程存活与业务轮次结果分开

Owner：Website system-security + public-knowledge worker。

目标文件：

- `start.sh`
- `services/api/src/public-knowledge-worker-server.ts`
- `tests/production/production-runtime.test.ts`
- System Security 与 Public Knowledge 现役 inspector

动作：

1. `start.sh` 的十秒监督状态改名为 `process_alive`，输出明确写明“只证明进程存活，不证明业务轮次成功”；
2. public-knowledge 外层 cycle catch 不再创建 `runtime.start` span；使用现有 RuntimeLogEventV2 的 `job.execute` error 事实暴露同一原生 code；
3. 保留现役 loop/backoff 和 Worker 进程，不因单任务失败整进程退出，不新增 readiness socket/file/table 或日志 reducer。

验收：注入 localization sender 失败时，进程仍存活并按现役 loop 退避；日志只有 inner `website.task-create` 作为首个直接失败，outer 记录为同 code 的 cycle 后果且 operation 不是 runtime.start；启动输出不得出现该 Worker `active/ready/业务成功`，只能出现 `process_alive`。

#### IR-04｜静态质量与删除门

动作：

1. 更新现役 inspector/acceptance，不新建第二质量入口；
2. 检查 source/test 净变化，新增每一行必须只有IR-02或IR-03的直接消费者；Website localization sender和AGENT生产/Browser源码净变化必须为0；
3. 搜索并拒绝 replacement job、second queue、second WAL、second readiness、compatibility、fallback、shadow、dual read/write；
4. 双仓分别运行唯一原生 `quality:check CHANGE`，形成 clean commit 后再运行 READY。

验收：双仓 CHANGE_PASS；clean candidate-bound READY_PASS；P0/P1=0；未授权文件无差异；法案、跨仓 contract、migration 数量变化均为0；Blueprint 只允许上述两份现役文件的精准固化，不得新增文件或扩大语义。

#### IR-05｜全新测试批次直接 N=3 闭环

固定顺序：

```text
IR-00 保持N=3并进入draining
-> IR-01精确清空本轮测试图与跨仓残留
-> 读回删除集合=0、保留集合不变、provider submit增量=0
-> Website IR-02/03 clean candidate 发布
-> 双仓原生CHANGE/READY
-> 新建全新测试工单，不复用旧job/localization/run身份
-> 恢复active并读回设备动态N=3
-> Gate A：N=3干净现场直接启动
-> Gate B：N=3逐槽ONE BY ONE等价性
-> Gate C/D：N=3端到端价值与崩溃恢复
-> Gate E：后置N=1/2/4承压、性能对照与3->4->3
-> 双仓 RELEASE
```

任何阶段出现 unknown Provider effect、同一 effect submit 增量大于0、第三方Tab被操作、正常轮询导航、Website admission缺失、旧job任一本地责任残留或Worker又把业务错误写成启动失败，立即停止新claim并保持N=3配置不变；不得自动降N、不得用N=1绕过故障。

### 19.6 删除反事实与复杂度上限

| 拟变更 | 当前必要性 | 真实消费者 | 删除后会失败的验收 |
|---|---|---|---|
| 一次性测试清场步骤 | 关闭F1测试数据污染 | 本轮N=3测试 | 删除集合全空、保留集合不变、全新身份可正常重建 |
| CAPACITY_ZERO 成功语义 + 30 秒 backoff | 关闭 F3 与 5 秒空转 | Website/AGENT claim loop | 五 outcome 对齐、30 秒无第二 claim |
| `process_alive` 文案与 cycle error operation | 关闭 F2 | 操作员、Runtime Log 诊断 | 失败轮次不再伪装 runtime.start |

明确禁止新增：sender“禁止重建”分支、AGENT常驻pre-claim清理机制、数据库migration、删除台账、tombstone、replacement job、第二状态、第二queue/outbox/WAL、每job timer、额外Worker、readiness文件/socket、跨仓回调、当前N的AGENT副本、自动降N、兼容桥和旁路恢复命令。

### 19.7 完成公式

本次修复只有同时满足以下条件才可从 `可施工` 改为完成：

```text
F1通过一次性测试清场关闭，Website localization与AGENT生产/Browser源码净变化为0
AND F2/F3对应代码与现役质检全部PASS
AND CAPACITY_ZERO 两端均为 succeeded 且 30 秒内零重复 claim
AND 删除集合Website/AGENT/Browser责任全部读回为空且保留集合hash不变
AND 清场期间新claim数为0、provider submit增量为0
AND 全新测试工单能创建全新localization根和AI job
AND 设备唯一动态N从清场前到重启后始终读回为3
AND Gate A-E 使用同候选、真实 Chrome/GPT 与 Website admission/storage 证据通过
AND 双仓原生 clean READY + RELEASE 通过
AND 法案/contract/migration 新增或修改数为0，Blueprint新增数为0且修改集合精确等于现役AI Acceptance与System Security Startup两份
AND 第二链路数量为 0
```

### 19.8 回滚

代码回滚只能回到双仓各自的 `checkpoint/one-by-one-pre-ntab-20260914` 派生恢复分支，先读回 annotated tag 对象与仓库归属；禁止在当前 dirty 主工作树上 hard reset。数据库 `0137` 不回滚，设备动态N保持3。测试数据删除是经精确分母与读回确认的不可逆操作，不能靠Git回滚恢复；因此执行前必须保存删除/保留清单与对象hash，但不得把备份恢复成第二生产链。任何unknown/dispatched effect先按同一身份读回，绝不因代码回滚重新提交。

### 19.9 本轮实施与数据库清场证据

本节记录已经发生的实施事实，不替代 CHANGE、READY、RELEASE 或 Gate A-E：

1. Website F2/F3 生产修改只在既定三个 Owner 文件内发生；两个只为测试暴露的 `claimReceipt*` export 经存在证明审计后已物理删除，策略恢复为 Owner 文件内联实现，没有新增生产 API、模块、表、状态、队列或兼容路径；
2. 聚焦命令使用 Node 24.19.0 执行三份现役测试，共 `88/88` PASS、exit code 0；它只证明代码行为/静态接线，不冒充真实30秒零二次 claim、sender 故障注入或 Browser/GPT 动态证据；该结果早于19.10的60秒节拍修改，不能作为当前候选CHANGE/READY；
3. 首个 F1 孤立根 `localization_c86a73e2-4b4d-4754-b04e-3704fb5d6ffe` 已在 serializable 单事务中按 exact identity 删除，影响根行1，删除前 localization artifact/attempt/AI job/Provider effect 均为0，删除后根计数为0；
4. 最终审计刷新现场后，先停止唯一公开知识 Worker，冻结出53个 `queued + terminal_status is null + business_consumed_at is null` 的翻译工单图。其中3个 accepted 工单的 AGENT Browser WAL、pending outbox、Website failure/output/admission/localization artifact 均为0，另外50个从未 accepted；单事务删除53个 AI job、53个 localization 根及53条一对一 `LOCALIZATION_AGENT_TASK_BOUND` 子记录，影响数均与冻结分母一致；
5. 另外5个 `public-knowledge-terminal-localization.v1` cancelled 旧策略图仍满足现役 claim SQL 的候选外形，若保留会污染下次启动；四个从未 accepted，一个历史结果已经 policy-v2 cutover 拒绝且仅余2条 orphaned output row，五者均无 admission、无本地 task/WAL、无当前 attempt。单事务删除5个 AI job、5个 localization 根、5条绑定子记录及2条 orphaned output row；
6. AGENT 本地使用现役 Store、Browser WAL 与 Forensics 实现逐项精确清除4条 failed 责任：三个本次 N=3 工单和 Website 已404的旧冲突工单；删除4个 task row、4个 task directory与旧工单的1组 Browser WAL，pending outbox始终为0，24条 completed task 的身份hash不变；
7. 最终双侧读回：Website localization 只剩 `completed=11`，AI runtime只剩 `completed + terminal_status=completed + business_consumed_at!=null` 共24条，未消费/可领取外形为0；AGENT只剩 `completed=24`、pending outbox=0，上述4个工单的 Browser WAL与task directory均为0；设备 `aipdev_709b550b2decd50644df15ed15cfaf12` 仍为 `active + max_in_flight=3`；清场 Provider submit 增量为0。当前没有 AGENT production runtime 进程，因此没有现役 authority epoch 或仍可消费的内存 Target 绑定；三个新 accepted 工单从未形成 Browser WAL。物理 Chrome system Tab 是否仍残留未在本轮数据库授权内检查，明确保持 `NOT_RUN`，不得把数据库归零表述成 exact system Tab 已关闭；
8. 公开知识 Worker 保持停止，避免审计期间把合法 released article 队列立即重建。授权人下次启动系统时，现役 sender 应从已发布文章重新创建全新 localization/AI job 身份，并直接由动态N=3领取；这次重建与真实三Tab执行仍是 NOT_RUN，必须由启动后的 Gate A-E 证明。

### 19.10 全局 Provider observation 节拍收紧为60秒

本节是授权人针对浏览器负重提出的最新精准调整，并替代本文件此前所有面向当前候选的30秒observation值；19.9以前保留的30秒只可作为历史构建或`CAPACITY_ZERO` claim backoff事实，绝不得解释为当前Tab轮询节拍。

唯一实现闭环固定为：

```text
N仍由Website动态下发，当前数据库值=3
-> 每个已获grant工单仍独占一个system Tab
-> GPT Child只给出本工单eligibleAt，不建timer
-> observation waiter立即进入同一Browser FIFO
-> BrowserLaneCoordinator唯一global observationNotBefore=上一真实observation终止时间+60秒
-> 到期后只激活exact bound Tab并fresh observe一次
-> pending再次释放lane，继续排队
```

实施边界：

1. 精准修订并重新冻结`LAW-GPT-002-V11`与`LAW-LOCAL-BROWSER-SESSION-003-V36`，只把全设备相邻真实Provider observation收紧到不少于60秒、总频率不随N增长；后者引发的active law依赖版本传播只机械更新现役引用与版本链，不改变下游Runtime义务。不改变N Owner、Tab Owner、Browser lane、40秒submit静默、2500ms页面动作闸门、30秒Tab释放超时或Website `CAPACITY_ZERO` 30秒claim backoff；
2. AGENT只修改现役`PROVIDER_OBSERVATION_INTERVAL_MS`与BrowserLaneCoordinator唯一`observationNotBefore`推进值为`60_000`，不增加环境变量、数据库列、配置副本、每Tab timer、第二queue、第二lane或兼容分支；
3. GPT、Local Browser、跨仓Runtime与Website AI Acceptance现役Blueprint同步写明60秒；唯一静态inspector、行为acceptance和真实proof阈值同步收紧为`>=60000ms`；
4. 受控N=3肉眼顺序仍可见`A -> B -> C -> A`，但相邻两次真实页面observation至少相隔60秒；没有其它页面动作时，同一Tab两次观察的理论下界约180秒。mutation、submit、关闭等已具备资格动作仍可穿过尚未到期的observation waiter，不被60秒读频门堵死；
5. 本次不重新启动Worker、不创建新工单、不操作Chrome，也不重建已清空数据库；当前数据库最终读回与N=3保持19.9事实，真实三Tab/60秒/GPT压力验证继续由授权人启动后的Gate A-E完成。

当前候选验收必须同时满足：静态源码只存在GPT请求资格与Browser全局硬门两处现役60秒值，零配置副本与第三计时Owner；行为验收证明完成一次observation后全局not-before至少推进59秒且不会阻塞后续eligible mutation；动态proof要求相邻真实Provider observation `>=60000ms`；双仓CHANGE与clean READY重新通过；三名只读审计P0/P1为0。任何现役30秒Provider observation残留、按Tab各自60秒导致总频率随N增长、第二timer/queue/lane或把claim backoff误改为60秒均为失败关闭。

## 20. 2026-09-14 首次真实翻译闭环修复

### 20.1 本节身份、权限与基线

本节是第19节之后的唯一现役故障修复方案，旧章节作为 N-TAB 建设与历史证据保留；若旧章节的“未跑起”、“未入库”等阶段性描述与本节冲突，当前裁决以本节为准。

本节最初形成于只授权制定方案的阶段；授权人随后已明确授权法案、施工图、代码、质检与必要数据库操作，并要求直接在专门提供的双仓本地 `main` 施工。当前系统已由授权人启动，因此本轮只允许完成代码、文档、静态/本地质检、clean READY 与推送；禁止 Codex 重启、部署、操作 Browser、重放工单或改变数据库，RELEASE 与真实 N=3 动态证明留待授权人另行启动。施工时必须从当前基线重新绑定；任一 HEAD、active law、Owner 或目标文件 hash 变化，先停止并精确更新本节，不得凭旧方案盲施工。

| 对象 | 本轮只读绑定 |
|---|---|
| AGENT | `/Users/nexgen/Documents/AGENT`，施工只允许绑定本地主仓库 clean `main` 的当前 HEAD；禁止新建分支或工作树 |
| Website | `/Users/nexgen/Documents/xuanxue-web`，施工只允许绑定本地主仓库 clean `main` 的当前 HEAD；禁止新建分支或工作树 |
| AGENT active law | `LAW-GPT-002-V11`、`LAW-LOCAL-BROWSER-SESSION-003-V36`、`LAW-RUNTIME-LOG-SPINE-001-V7` |
| Website active law | `LAW-LOCALIZATION-013-V11`、`LAW-LOCALIZATION-017-V1`、`LAW-LOCALIZATION-019-V6` 及 Website Runtime Log 现役条款 |
| AGENT 日志 | `/Users/nexgen/.codex/attachments/63512112-6f05-431b-9349-fc9c82a94b3b/pasted-text.txt` |
| Website 日志 | `/Users/nexgen/.codex/attachments/fc524c49-491d-406b-b136-08e8c282f4a8/pasted-text.txt` |
| Browser 原始日志 | `/Users/nexgen/Documents/AGENT/.grasseye-local/runtime-logs/agent/af41d729-5741-4784-9d89-31bf6bdd498d-0001.jsonl` |

施工前必须在授权人专门提供的双仓本地 `main` 上重绑 candidate，确认进入施工前 clean，随后直接在该 `main` 完成实现、提交与质检。禁止新建分支或工作树；施工期间的授权内未提交差异属于当前 candidate，但在 clean commit 与原生 READY 通过前不得宣称 READY 或 RELEASE。

### 20.2 经数据库纠正后的真实分母

2026-09-14 17:26:27（Asia/Dubai）的只读快照必须作为本次故障分母，不得再把日志截止时的“没有证据”写成“入库失败”：

| 类别 | 数量 | 当前结论 |
|---|---:|---|
| Website 已入库并发布 | 4 | 真实完成 |
| AGENT/Provider 执行中 | 3 | 未闭合，但非失败 |
| 等待首次执行 | 47 | 排队，非失败 |
| Provider 已完成但等待 Website 入库 | 0 | 无积压 |
| 明确终态失败 | 0 | 无 |

已完成的4个工单均同时具备 `localization_jobs.state=completed`、AI runtime/terminal completed、`business_consumption_hash`、本地化 artifact、文章翻译绑定、released publication 与公开页 payload。其中日文 `ja-JP` 的 `aiprod_660cee11...` 第一个 Attempt 被 Website 拒绝，第二个 Attempt 在同一业务工单上成功入库。这一事实同时证明：

1. N=3 没有使入库主链整体失效；
2. Website 严格验证、拒绝当前 result revision、释放 Attempt 与同 job 新 Attempt 重试的现役单主链已经工作；
3. 修复目标是降低首轮不合格率并让首个直接拒绝可诊断，不是禁止 Website 拒绝、强行标记成功或删除重试机制。

### 20.3 四个第一直接断点

#### R1｜Website 原生语义拒绝被总括码吞掉

对 `aiprod_660cee11...` 首次被拒 result 与对应 source 使用现役 `validateStructuredEdition` 重放的精确结果是：

```text
LOCALIZATION_SAFETY_FIELD_NOT_TRANSLATED:/excluded_scope/segments/2/text
```

这证明本次不是结构或保护事实被改写，而是一个被 `safety_json_pointers` 覆盖的字符串仍保留源语言。`structured-edition-validator.ts` 已产生精确原生原因，但 `localization-completion-worker.ts` 把所有验证异常统一包装为 `LOCALIZATION_STRUCTURED_EDITION_SEMANTIC_INVALID`；现有 `failure_ledger`、`result_revision_rejected_v1` 和 Runtime Log 因此无法指向首个失败 pointer。

#### R2｜60秒 park/reacquire 后丢失 GPT Child 原子身份

三次 `BROWSER_DOM_CANDIDATE_MISSING` 的原始 started span 均显示：

```text
pluginStepId=browser-lifecycle
childCapabilityId=browser.dom.inspect.v1
```

但真实上层 Child 是 `checkpoint_gpt_text_response`。首次 observation 进入 `runAtomicStep` 时身份只保存在当时的物理 `BrowserTargetLease.state.atomicStep`；`waitForProviderObservation` park 旧 lease 并重领新 lease 后，新 lease 的 `atomicStep=null`，导致新命令回退到低层 Browser 身份。`browser-command-failure.ts` 现有的精确特例只在 `childCapabilityId=checkpoint_gpt_text_response` 时把“assistant 还未出现”终结为 Browser 命令成功；身份丢失后特例不生效，遂产生 `failed + BLOCKING` 红色噪声。

因此不得将 `BROWSER_DOM_CANDIDATE_MISSING` 全局白名单化；普通 inspect、错误 Document 或其他 Child 的候选缺失仍可能是真故障。唯一正解是保留同一 GPT Child 身份跨越它内部的多次 lease 更换。

#### R3｜AGENT 用 Website Owner 的 operation 名表达本地读回

`runtime-loops.ts` 中 AGENT 只向 Website 发起 V6 状态读回，但 span operation 命名为 `website.result-consume`，并在 HTTP/合同读回成功后统一写 `outcome=succeeded`。当 Website 真实业务消费已拒绝并返回 `WAIT_NEW_ATTEMPT` 时，这条日志表达的实际只是“AGENT 成功读到待新 Attempt 决定”，却在肉眼上像“Website 已成功消费”。

这是 Owner/命名错位，不是需要增加新 outcome enum。Website 仍是唯一可写 `website.result-consume` 的 Owner；AGENT 应复用现役 `website.v6-request` 表达同一 V6 GET 读回边界。

#### R4｜翻译 Prompt 没有把 Website pointer policy 显式写成穷尽检查清单

现役 prompt 已要求保留风险强度，但没有明确要求 Provider 将 `locale_policy.validation_policy.translatable_json_pointers` 当作穷尽列表，也没有在返回前逐项核对 `safety_json_pointers` 已全部翻译且安全义务未减弱。这能解释为什么整体 JSON 可解析，却遗留一个安全字段。

本缺口只授权收紧现役单次 prompt，不授权在 AGENT 新建语义验证器、第二 Provider 轮次、自动修复 Child 或新的 staging 链。最终语义裁决仍唯一属于 Website。

### 20.4 四维合同与唯一 Owner

| 维度 | 输入 | 决定/写入 Owner | 唯一输出 | 下游消费者 |
|---|---|---|---|---|
| 业务调度 | Website 动态 `max_in_flight=3` | Website AI Acceptance | V6 grant/status/revision receipt | AGENT production runtime |
| GPT Child 执行 | job/attempt/step/call/action/input hash | `ProductionGptBrowserLifecycle` 中的单 call facade | 跨 park/reacquire 不变的 `BrowserAtomicStepIdentity` | Browser command permit/log/WAL |
| Browser 现实操作 | exact system Tab + atomic identity | 现役 Browser lane/lease manager | 唯一命令终态 | GPT Child |
| 翻译输出 | source + route contract + validation policy | AGENT localization Product Flow | 一份 terminal JSON | Website localization consumer |
| 语义裁决 | source/result/pointer policy | Website `validateStructuredEdition` | validation receipt 或精确 native rejection | Website localization completion |
| 拒绝持久化 | outer code + native diagnostic | Website 同一 business-consumption transaction | failure ledger + `result_revision_rejected_v1` | 同 job 新 Attempt 与操作员诊断 |
| Website 消费日志 | 真实业务事务 | Website | `website.result-consume` | 运维/质检 |
| AGENT 状态读回日志 | Website V6 GET reply | AGENT | `website.v6-request` | 运维/本地 task 对账 |

关键状态转移不变：

```text
Website queued
-> V6 grant / AGENT accepted
-> GPT submit at-most-once
-> 60秒全局 observation 轮巡
-> terminal result upload
-> Website validate
   -> PASS: artifact + binding + publication + business_consumption_hash 同事务闭合
   -> REJECT: 记录outer/native/pointer receipt -> orphan当前artifact -> 同job新Attempt
-> AGENT只读回Website终态并收口本地task
```

### 20.5 施工工单

#### NTAB-R01｜Website 保留结构化原生拒绝

目标：在不改变任何验证规则、不记录业务原文的前提下，使操作员能从持久回执确定第一失败代码和 JSON pointer。

目标文件：

- `packages/ai-contracts/src/production-control/structured-edition-validator.ts`；
- `services/api/src/localization/localization-completion-worker.ts`；
- `services/api/src/localization/localization-job-repository.ts`；
- `services/api/src/ai-production/business-result-consumer.ts`；
- `services/api/src/ai-production/job-repository-core.ts`；
- 对应现役 localization、provider-submission-boundary 与 Runtime Log 测试。

施工动作：

1. 在 `structured-edition-validator.ts` 文件内收敛一个 `StructuredEditionValidationError`，只包含闭集 `code`、可选 `jsonPointer`、可选 `safetyObligation`；所有现役验证分支保持原顺序与原判定，仅把字符串异常改为结构化异常。
2. 关闭代码至少覆盖 `STRUCTURE_OR_FACT_CHANGED`、`PROTECTED_FIELD_CHANGED`、`SAFETY_FIELD_EMPTY`、`SAFETY_FIELD_WEAKENED`、`SAFETY_FIELD_NOT_TRANSLATED`、`SAFETY_FIELD_TRUNCATED`、`JSON_POINTER_MISSING/INVALID` 及 pointer policy 错误；不得把未知 Error message 当作可信 code。不得为提高测试覆盖率改变现役验证顺序或首因优先级：受保护字段漂移当前先命中 `STRUCTURE_OR_FACT_CHANGED`，仍保持该判定。
3. `localization-completion-worker.ts` 继续以 `LOCALIZATION_STRUCTURED_EDITION_SEMANTIC_INVALID` 作为对外 failure code，同时从 typed cause 提取安全 diagnostic；无 typed cause 时失败关闭为既有总括码，不猜 pointer。
4. 在现有 `localization_jobs.failure_ledger` 条目中增写 `native_error_code`、`json_pointer`、`safety_obligation`（无值则省略或 null）；不新增表、列、migration 或诊断台账。
5. 现有 `result_revision_rejected_v1` 的 `domain_rejection` 保留 outer `failure_code`，`reason_codes` 按固定顺序写入 `[outerCode,nativeCode]`，并携带同一安全 diagnostic；不把 source/result 文本写入事件或 Runtime Log。
6. `appendAiProductionEvent` 在现有 insert 后以 `idempotency_key + job_id` 读回真实 `event_id/evidence_hash`，并校验 hash 与当前预期一致；首写与幂等重放都返回同一已持久事件身份。既有调用者可忽略返回值，禁止再建 receipt store。
7. Website 对被拒绝的 `website.result-consume` 终端日志仍是 `outcome=failed`、outer failure code 仍是总括码，`nativeCause` 使用闭集 native code；同时绑定 `authorityRef=ai_production_job_events:<eventId>` 和对应 `authorityHash`。指针不直接写入公共日志；既有 Website authority reader 只核验该事件的持久 hash，操作员需要定位 pointer 时按日志中的 eventId 查询同一事件 `event_json`，不得把 hash 核验误写成 pointer 读取。

验收：

- 最小固定 fixture 复现“一个 safety pointer 保留源语言”，验证 outer/native/pointer 分别正确；
- 同一 rejection 幂等重放不生成第二 event，authorityRef/hash 可由现役 reader 核验，pointer 可按同一 eventId 从 `event_json` 读回；
- 对应真实样例的诊断回读必须精确得到 `LOCALIZATION_SAFETY_FIELD_NOT_TRANSLATED` 和 `/excluded_scope/segments/2/text`；
- Website 验证通过路径的 receipt、artifact、binding、publication 与 business consumption 零差异；
- 任何日志、fixture 或 event 不得包含真实文章原文、Provider 原始回答或凭证。

#### NTAB-R02｜原子 Child 身份跨 Browser lease 更换保真

目标：一个 GPT Child 调用即使内部经历多次 `park -> reacquire -> fresh observe`，每条 Browser command permit 仍使用同一上层 atomic identity。

目标文件：

- `src/capabilities/gpt/production-browser-lifecycle.ts`；
- `src/capabilities/gpt/production-atomic-call.ts`（仅在现有接线需精确调整时）；
- `src/lib/browser/exact-target/browser-target-lease-manager.ts` 与 `browser-command-failure.ts`（原则上只加回归验收，不改宽故障规则）；
- 现役 GPT lifecycle、Browser terminal contract 与 N-TAB 验收。

施工动作：

1. 由 `ProductionGptBrowserLifecycle` 内已存在的稳定 `facade` 拥有当前 call-scoped `BrowserAtomicStepIdentity`，而不再让身份仅附着在某一次物理 lease。
2. `facade.runAtomicStep(identity, action)` 在整个 Child action 前设置身份，在 `finally` 中唯一清除；嵌套调用、空身份或并行原子步骤继续失败关闭。
3. facade 在每次发出观察/变异命令时，先读取当前 `active.browser`；如果存在 call-scoped identity，则通过当前物理 lease 的 `runAtomicStep(identity, command)` 执行该命令。这使新 lease 生成的 permit 继承 `productStepId/callId/childCapabilityId/inputHash/actionOrdinal`，但不把 identity 持久到 DB、WAL 新表或第二 registry。
4. lifecycle 自身的 park/acquire、settle 与 confirmed-effect readback 仍使用已存在的 Owner；不复制 Target 绑定，不增加第二 lane、timer、queue 或对话 URL 找回链。
5. 保留 `browser-command-failure.ts` 的现役精确特例：只有 `checkpoint_gpt_text_response + non-mutation + BROWSER_DOM_CANDIDATE_MISSING` 才将 Browser command span 终结为 succeeded，然后原异常由 Child handler 捕获并进入 `GPT_PROVIDER_WAIT_ACTIVE`。其他 Child、DOM 歧义、Document 错误和变异故障仍为 failed/BLOCKING。

验收：

- 一个 text checkpoint 经历至少两次 park/reacquire 后，所有 Browser started span 仍是 `pluginStepId=article_translation`、`childCapabilityId=checkpoint_gpt_text_response` 且 call/input/action 全部一致；
- assistant 仍生成时，Browser command terminal 为 succeeded，GPT 上层仅出现受节流的 `GPT_PROVIDER_WAIT_ACTIVE`，零 `BROWSER_DOM_CANDIDATE_MISSING failed/BLOCKING`；
- 将同一候选缺失注入普通 `browser.dom.inspect.v1` 或变异 Child 时必须仍 failed/BLOCKING；
- 生成图像 checkpoint 经 lease 更换后同样保留它自己的 Child identity；
- 全局 observation 仍相邻 `>=60000ms`，且 `browser_action_in_flight` 最大为1。

#### NTAB-R03｜日志 operation 回归真实 Owner

目标：让“succeeded”只修饰该 span 真实执行的边界，不再把 AGENT 状态读回冒充 Website 业务消费。

目标文件：

- `src/lib/local-runtime/production/runtime-loops.ts`；
- `src/lib/local-runtime/production/runtime-business-admission.ts`（仅确保现有 completed/pending/deleted 决定未被扭曲）；
- 现役 Runtime Log 接线与行为验收。

施工动作：

1. AGENT `reconcilePendingBusinessAdmissions` 的 operation 从 `website.result-consume` 物理删除，复用现役 `website.v6-request`；component 收紧为 `production-admission-readback`。不增加 RuntimeLog enum、schema 或跨仓 contract。
2. span `outcome=succeeded` 仅表示 V6 GET/响应验证/本地读回正常。`pending` 或 `WAIT_NEW_ATTEMPT` 不提升为业务完成，也不伪造失败；业务结果必须由 Website reply 的受控 reason/receipt 或 Website 自身 `website.result-consume` 日志表达。
3. 只在 Website 已返回可校验 completed receipt、AGENT 已原子收口本地 task 时绑定本地 `production-task:<jobId>` authority。pending/wait-new 不使用本地 task hash 暗示领域完成。
4. 真实 HTTP、合同、存储或读回失败继续以 native cause failed/BLOCKING，不为了消灭红色日志而降级。

验收：AGENT 原始日志中 `operation=website.result-consume` 计数必须为0；Website 仍是该 operation 的唯一生产者；拒绝工单的完整事件顺序是 `Website result-consume failed -> AGENT website.v6-request succeeded -> 同job新Attempt`，任一 succeeded 都不能被解读为已入库。

#### NTAB-R04｜收紧现役单轮翻译 Prompt

目标文件：`src/plugins/localization-production/flow.ts` 及现役 Product Flow/Prompt 验收。

施工动作：只对 `article_translation` 与 `report_translation` 的现役 `PRODUCT_INSTRUCTION` 增加以下不可分割要求：

1. `locale_policy.validation_policy.translatable_json_pointers` 是本轮必须逐项完成的穷尽清单；
2. 每个 translatable pointer 指向的字符串必须使用 target locale；
3. 每个 safety pointer 必须翻译且保留源字段全部不保证、不代替专业建议、不确定性、范围限制与风险披露义务；
4. 每个 protected pointer 原值必须精确不变；
5. 返回唯一 JSON 前，在同一次推理内逐 pointer 自检，不输出自检过程。

禁止动作：不加第二 GPT turn，不加 AGENT 预验证器，不用 prompt 覆写 Website route contract，不在 accuracy/quality review Child 新增翻译职责。

验收：静态测试证明两个主翻译 Action 含完整指针要求，其他 Action 不变；真实 N=3 新批次中 Website 仍独立执行同一 validator，不得用 prompt 自检代替 admission receipt。

#### NTAB-R05｜Blueprint 精确固化与法案不变门

现役 active law 已要求 exact child identity、原生原因保留、低噪声 Runtime Log、Website 唯一语义验收和同 job 新 Attempt，本次是实现回归法案，不需要修改 active law、registry、跨仓 V6 contract 或 DB schema。

仅允许将实施细节写回以下现役 Blueprint，不新建文件：

- AGENT `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md`：固化 call facade 跨 lease 保留 atomic identity 及 prompt pointer 自检；
- AGENT `docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md`：固化 Browser permit 继承 exact Child 身份；
- Website `docs/blueprints/domains/ai-acceptance/AI-ACCEPTANCE-BLUEPRINT.md`：固化 outer/native/pointer rejection receipt 与 authority readback。

若施工发现 active law 存在真实相反义务，必须立即停止代码施工并向授权人申请精确法案修订；不得以“实施细节”名义绕过冻结条款。

#### NTAB-R06｜质检与真实 N=3 动态证明

静态/单元/接口层必须至少包含：

1. validator 每个闭集 native code 的类型、pointer 与 obligation 结构，以及每个现役可达分支的行为映射；受保护字段漂移按现役优先级验证为 `STRUCTURE_OR_FACT_CHANGED`，不得虚构不可达分支 PASS；
2. completion worker 在 outer code 不变的前提下保留 native diagnostic；
3. failure ledger 与 rejection event 同一 diagnostic/hash，幂等重放只有一条 event；
4. Website rejection Runtime Log authorityRef/hash 可读回，原文不进日志；
5. text/image checkpoint 跨至少两次 lease 更换仍保留 exact Child identity；
6. pending assistant 与真 Browser 故障两类注入的终态严格分开；
7. AGENT 零 `website.result-consume`，Website 仍唯一产生者；
8. 两个主翻译 Action 的 pointer 穷尽自检 prompt，且无第二轮次/验证器。

真实 N=3 动态 proof 必须在同一双仓 clean candidate、同一 Website 配置 `N=3`、真实 Chrome/GPT 与全新测试工单上执行，禁止重用已发布的4个结果冒充新 candidate 证明。必须同时证明：

- 动态 N 读回恒为3，至少3个同时在途工单各自绑定不同 exact system Tab；
- 每次 observation 前的 exact target activation 回读为 active/current，零 URL/侧栏/搜索导航，零第三方 Tab 动作；
- 相邻真实 Provider observation `>=60000ms`，轮巡顺序在资格相同时可见 `A -> B -> C -> A`，总频率不随 N 增长；
- `browser_action_in_flight <= 1`，零并行现实页面动作，零 Chrome crash、Debugger detach、频繁操作提示；
- 生成中无 Browser failed/BLOCKING 候选噪声；注入真故障时仍失败关闭并且不重提交 unknown effect；
- 至少一个通过样例完成 Website admission + domain durable readback；至少一个受控拒绝 fixture 在不暴露原文的前提下从 authority event 读回 outer/native/pointer，然后同 job 新 Attempt 成功；
- 吞吐对照以每小时 Website 真实 admission + durable storage 计数为分子，不使用 Provider terminal、AGENT upload 或 HTTP 2xx 代替。

### 20.6 双仓施工与发布顺序

```text
S0 双仓本地clean main重绑HEAD/active law/目标hash，禁止新建分支或工作树
-> S1 仅更新三份现役Blueprint，法案/contract/migration差异=0
-> S2 Website NTAB-R01 + 现役质检
-> S3 AGENT NTAB-R02/R03/R04 + 现役质检
-> S4 分别形成clean commit，锁定双仓candidate pair
-> S5 Website先发布，读回健康、schema无变更、现有工单无丢失
-> S6 AGENT进入draining，停止新claim
-> S7 等待active=0、pending admission=0、browser action=0、unknown/dispatched effect=0
-> S8 部署/重启AGENT candidate，读回Website唯一N=3
-> S9 执行全新N=3动态proof
-> S10 双仓唯一quality:check CHANGE -> clean READY -> RELEASE
```

发布顺序存在当前必要性：Website 先发布可使任何过渡期拒绝立即具备原生诊断，其变更不依赖 AGENT 新合同；AGENT 后发布只改自身 Browser 身份与日志/prompt。这是单主链的有序切换，不是兼容桥，不需要 feature flag 或 dual-read/write。

本轮不清空数据库，不删除47个排队工单，不重置3个在途工单，不降 N=1。若 draining 后仍存在 unknown/dispatched Provider effect，必须按现役同身份 receipt/readback 收口，禁止为赶发布强制终止或重提交。

本次施工批次止于 S4 后的双仓 clean READY 与主仓推送；S5-S10 属于后续发布批次，当前运行中的系统不得由 Codex 重启或部署，也不得把 READY 宣称为 RELEASE。

### 20.7 分层验收与失败关闭

| 层级 | PASS 证据 | 明确不能代表 |
|---|---|---|
| 类型/单元 | typed diagnostic、facade identity、prompt 与 operation 断言通过 | 不代表真 Browser/Website |
| 接口/持久化 | rejection event/failure ledger/hash 幂等可读回 | 不代表公开页已发布 |
| CHANGE | 双仓唯一 `quality:check CHANGE` PASS | 不代表 READY |
| READY | clean candidate-bound `quality:check READY` PASS，P0/P1=0 | 不代表 RELEASE |
| 动态 N=3 | 真实 Chrome/GPT/60秒/单 lane/exact Tab 证据 | 不代表 Website 入库 |
| 业务闭环 | 同 job/result 的 Website admission receipt + 领域表持久读回 + released payload | 不得由 HTTP 2xx 或 AGENT succeeded 代替 |
| RELEASE | active law 要求的全部 dynamic proof 同 candidate 通过 | 不代表未来 N>4 已承压 |

任一下列情况立即失败关闭：

- 修复通过放宽/跳过 Website validator 才让结果入库；
- 修复通过全局吞掉 `BROWSER_DOM_CANDIDATE_MISSING` 才消除红错；
- 新增 AGENT 语义验证器、第二 GPT turn、第二重试链、第二 receipt store 或新 DB migration；
- AGENT 仍产生 `website.result-consume`，或 pending/wait-new 仍被渲染为业务成功；
- exact pointer 只出现在终端文字而没有持久 authorityRef/hash，或日志泄露业务原文；
- 继续用 dirty candidate、旧报告 commit 或不同 candidate 的日志宣称 READY/RELEASE；
- 为调试自动降 N、清空排队、删除已入库结果或重放 unknown effect。

### 20.8 删除反事实与复杂度上限

| 拟保留的变更 | 当前必要性 | 真实消费者 | 删除后必然失败 |
|---|---|---|---|
| typed validator error | 保留首个直接原因 | completion worker | 只剩总括码，无法指向 pointer |
| 现有 rejection event 的 diagnostic/hash 读回 | 把诊断绑定持久事实 | Runtime Log authority reader/新 Attempt | 日志只有瞬时文本，不可核验 |
| call facade atomic identity | 跨 lease 保留上层 Child | Browser permit/故障分类 | pending 继续误报 BLOCKING |
| AGENT operation 改回 `website.v6-request` | 区分读回与业务消费 Owner | 运维/对账 | succeeded 继续被误解为入库 |
| pointer 穷尽 prompt | 减少可预防的首轮拒绝 | Provider 单次生成 | 同类遗漏无直接预防 |

除上表五个变更类别外，默认删除所有新增抽象、类、文件、状态、开关、配置、队列、重试、持久化结构与兼容分支。允许的 typed error 必须收在现役 validator 文件，call identity 必须收在现役 lifecycle facade，不得因为“未来可复用”拆新模块。

### 20.9 回滚与现场保护

1. 实施前继续使用双仓 `checkpoint/one-by-one-pre-ntab-20260914` 作为已存在的灾备参考，但它只是 rollback reference，不是当前 READY/RELEASE 证据。
2. 代码回滚仅以可审计的新提交精准反做本节目标文件，不对 `main` hard reset，不覆盖用户改动。
3. Website 变更无 migration，无 schema rollback；新 event JSON 字段是现有事件的安全诊断，不作物理删除，否则会破坏已发生事实。
4. 回滚不删除工单、artifact、publication 或 failure ledger，不重提交 Provider effect；未知 effect 仍先 checkpoint/receipt/postcondition readback。
5. 回滚后 N 仍由 Website 唯一动态配置且保持3，不以降 N 作为恢复手段。

### 20.10 完成公式

本次修复只有同时满足下式，才能将文档头的 implementation/test/release 改为完成：

```text
双仓clean candidate与active law重绑通过
AND active law/registry/跨仓contract/DB migration差异=0
AND Website保留outer + native + pointer且authorityRef/hash可读回
AND Browser跨lease保留exact Child identity
AND pending assistant零failed/BLOCKING，真Browser故障仍失败关闭
AND AGENT产生website.result-consume数=0
AND 翻译prompt穷尽覆盖translatable/protected/safety pointers
AND N始终=3、全局observation>=60000ms、browser_action_in_flight<=1
AND 全新通过样例完成Website admission + durable storage/readback
AND 受控拒绝样例可诊断且同job新Attempt闭合
AND 双仓唯一quality:check CHANGE/clean READY/RELEASE均绑定同一candidate pair
AND P0/P1=0
AND 第二validator/queue/WAL/receipt store/retry chain/compatibility path数=0
```

仅完成方案、单元测试、HTTP 2xx、Provider terminal、AGENT upload、日志变绿或已有4个历史成功样例，均不满足本式。

## 21. 2026-09-15 五段式终局闭环方案

### 21.1 裁决与证据边界

本节取代第20节对“当前剩余问题”的阶段性判断，但不抹除第20节已经发生的实施历史。方案绑定：

| 对象 | 当前只读事实 |
|---|---|
| AGENT candidate | `/Users/nexgen/Documents/AGENT`，`main=origin/main=406211abf3aa1bebfbcca6b8004946ddecf03057`；写入本节前目标方案文件无差异，当前工作树差异仅为本节方案 |
| Website candidate | `/Users/nexgen/Documents/xuanxue-web`，`main=origin/main=53648354d60a266b67bc745ce14fd26d6810f9fd`，只读检查时 clean |
| 本轮 AGENT 日志 | `/Users/nexgen/.codex/attachments/6d02c0e6-fdc1-44e0-ad72-0102b27e2e61/pasted-text.txt`；完整 ledger 为 `.grasseye-local/runtime-logs/agent/a610c412-3677-4a0a-ac43-eeeacc3f4ce0-0001.jsonl` |
| 本轮 Website 日志 | `/Users/nexgen/.codex/attachments/ff3b3e14-4ab4-493d-801a-5a39e5b2a681/pasted-text.txt` |
| 数据库快照 | 2026-09-14 23:50（Asia/Dubai）：65总数、26 completed、39 queued/执行中、0终态失败；26个 completed 均有 admission 与领域持久化闭包 |

观察到的四个剩余断点：

1. 相邻真实 Provider observation 首轮出现 `5.666s`，违反全设备 `>=60s`；后续间隔约 `65.695s / 72.603s / 69.191s`。第一直接断点是 submit 后首次 checkpoint 仍使用原 lease直接观察，没有像 pending 后续轮次一样 park并重新进入 BrowserLaneCoordinator 的全局节拍。
2. 至少三个工单出现 `BROWSER_PROVIDER_EFFECT_IDENTITY_DRIFT`。唯一 Browser WAL 已有同一 `job + result_revision + step + call + child` 的历史 CONFIRMED 现实提交，但新部署计算出的 request/input/payload身份不同；现役代码先按新精确身份查询，查不到后又把新候选送到 WAL prepare，最终被历史检查拒绝。安全性没有丢失，活性没有闭合。
3. AGENT没有把历史 CONFIRMED hash带回Website，Website遂按 `mutation_outcome=no` 结束旧 Attempt并反复签发新 Attempt。受影响工单的 accepted/failure count 已多次增长，但现实 Provider submit 没有重复；这是“安全关闭、业务空转”。
4. 四条 `state=orphaned` output artifact 的 `orphaned_at` 为空。新 Attempt 路径只写 state；现役 maintenance 又选择 orphaned 行却以 `state='staged'` 更新时间，条件永远不命中。对象清理可以继续，但孤儿时间事实不完整。

以下不是当前故障：Browser命令最大并发已证明为1；没有Chrome crash、Debugger detach、错误Tab或HTTP 5xx；26个完成工单已真实入库；本轮未出现新的 localization semantic rejection，因此第20节原生诊断动态证明只能记为 `NOT_RUN`，不能反推失效。

### 21.2 五件事所需的最小集合

不增加任何新状态、表、队列或恢复器。完成五件事只保留现役七个事实载体：

| 必需对象 | 唯一 Owner | 为什么不能删除 | 删除后第一直接断点 |
|---|---|---|---|
| `ai_production_jobs + runtime` 的需求、当前Attempt与result revision | Website.ai-acceptance | 决定“还要不要这个结果”及下一次授权 | AGENT会自行决定重做或永久停止 |
| V6 grant中的 `job/attempt/lease/fence/result_revision` | Website.ai-acceptance | 把一次执行绑定到当前授权 | 迟到执行可写回当前任务 |
| AGENT本地task与唯一Outbox | AGENT runtime | 执行落地与同一结果幂等交付 | 回复不明会重算或丢结果 |
| Browser唯一WAL row | Browser Authority | 证明Provider现实输入0次或1次 | 进程重启后无法证明是否已经发送 |
| 进程内 `job <-> system Tab` 双向绑定 | Browser Target registry | N个工单等待时只回到各自页面 | 会猜Tab、串工单或引入URL恢复链 |
| Browser唯一FIFO/lane与全局observation not-before | BrowserLaneCoordinator | 串行现实页面动作并把观察总频率与N解耦 | N增加会造成并发操作或轮询压力线性增长 |
| Website admission receipt + 领域持久对象读回 | Website领域consumer | 唯一证明“结果已经真正入库” | HTTP 200或AGENT completed会被误当业务完成 |

除上述七项外，不需要第八项。特别不需要：effect winner表、Tab表、恢复队列、Attempt上限表、部署代际表、Prompt版本表、第二Outbox、第二WAL、第四next action、每Tab timer或兼容桥。

### 21.3 唯一主链与闭集决策

```text
1 Website持久保留需求
  -> 2 Website签发一个当前Attempt，AGENT durable accept
  -> 3 Browser在任何准备动作前裁决同revision的现实effect
       无现实effect：当前授权Attempt最多提交一次
       有唯一CONFIRMED effect：旧effect成为唯一winner，零准备、零提交，只读回
       DISPATCHED/带输入但未确认/多义：保留原事实并失败关闭，不准任何job穿过Browser lane
  -> 4 AGENT得到稳定结果，或返回带真实effect事实的明确失败
  -> 5 Website唯一决定
       结果合格：领域事务入库并写admission receipt
       结果稳定但不合格：写rejection receipt，result_revision+1
       明确零输入：结束Attempt，有限退避后签发新Attempt
       DISPATCHED/CONFIRMED：保留同一accepted Attempt，只授权零提交收敛
       需求撤销：永久撤权或管理员按现役硬删除闭包清除
```

Website对AGENT仍只返回现役三个next action：`ACTIVE_ATTEMPT / WAIT_NEW_ATTEMPT / CONSUME_CURRENT_RESULT`。不增加 `RECOVER_CONFIRMED`；`ACTIVE_ATTEMPT` 已同时表达首次执行与同effect零提交收敛，Browser WAL决定它属于哪一种现实分支。

### 21.4 Provider effect winner：修复当前空转的唯一算法

在任何fresh、模型选择、附件、Composer写入之前，Browser Authority用现有WAL列按下列查询范围裁决：

```text
[job_id, result_revision, product_step_id, call_id, child_id]
```

这只是读取范围，不是新的effect identity，不持久化新hash或新列。真正现实effect identity仍严格等于：

```text
sha256([job_id, result_revision, product_step_id, call_id, child_id,
        request_hash, payload_hash])
```

闭集裁决：

| WAL事实 | 唯一动作 | Website后续 |
|---|---|---|
| 零历史行 | 计算当前精确identity，经唯一lane首次执行 | 接收结果或接收明确失败 |
| 历史行全部为旧Attempt的 `REJECTED + mutation_outcome=no + physical_input_count=0` | 新Website Attempt可使用当前精确identity首次执行；旧零输入事实不取得winner资格 | 仍按普通结果/失败裁决 |
| 恰好一个 `CONFIRMED` winner且receipt/canonical locator可读 | 返回该行原始immutable identity/receipt；抛弃当前候选identity，物理准备与submit增量均为0 | 保留同一accepted Attempt并收回同一结果 |
| `DISPATCHED`，或带实际输入但没有可确认readback receipt的REJECTED | 返回原始effect hash/outcome/evidence，零准备、零submit；未收束DISPATCHED继续阻断全局lane | Website保留同一accepted Attempt，绝不签发新现实输入 |
| 同范围出现两个不同实际输入winner、缺少关键hash、密文不可读或事实矛盾 | `BROWSER_RECONCILIATION_SCOPE_AMBIGUOUS/INVALID`，停止新claim与Browser acquisition；不得发送伪造的`mutation_outcome=no` | 只允许只读审计后由Website人工永久撤权/精确清除，不得重发 |

实现上不得在现有 `assertProviderEffectHistory` 旁新增resolver。必须物理删除该“先精确查、后prepare才发现漂移”的二段判定，原位替换为一个 `resolveProviderEffectWinner`；它复用现有查询、现有WAL、现有解密与现有confirmed-readback。`production-atomic-call`只消费其闭集结果，不建立第二恢复状态机。

该算法同时解决部署前后Prompt/hash变化：同revision已经CONFIRMED的现实输入永远胜出，当前部署只能读回；Website验证旧结果后，只有真实 `RESULT_SETTLED_UNUSABLE` 才能签发新revision并允许新Prompt产生新effect。已输入但没有可确认receipt的事实继续失败关闭；尚未发生现实输入的旧Attempt不阻断当前Website新Attempt。

### 21.5 60秒全局轮巡的唯一修复

删除“submit后首次checkpoint沿用当前lease直接观察”的特殊路径。submit取得CONFIRMED后立即释放Browser lane；第一次与之后每一次Provider observation完全共用一条路径：

```text
GPT Child计算本工单eligibleAt（首次还受submit后40秒静默门约束）
-> waiter立即进入唯一Browser FIFO
-> BrowserLaneCoordinator取 max(job eligibleAt, global observationNotBefore)
-> 到期取得精确job-bound Tab
-> 如未active只执行一次tabs.update(active=true)
-> 同window activation世代 + current Target/Document + active=true fresh读回
-> fresh observe一次
-> global observationNotBefore = 本次真实observation终止时间 + 60秒
-> pending再次park
```

因此N=3资格相同且无mutation插队时，肉眼可见 `A -> B -> C -> A`，任意相邻真实observation均 `>=60000ms`，同一Tab两次观察约不小于180秒。60秒只限制Provider observation，不修改Browser 2500ms页面动作总闸门、submit后40秒静默门、Website `CAPACITY_ZERO` 30秒backoff或有资格的mutation。

“Tab一定在浏览器最前”仍只承诺浏览器内部前台：每次动作/观察前精确Tab必须读回 `active=true`、current Target/Document未漂移。系统继续禁止聚焦Chrome窗口、`windows.update({focused:true})` 与 `Page.bringToFront`；用户把别的应用放在macOS前台时，系统不会抢焦点。这是现役安全边界，不是缺口。

### 21.6 AGENT明确结果/失败与Website终局接纳

AGENT侧每个Attempt最终只能产生二者之一：

1. 一份稳定observed response artifact，经唯一Outbox按 `job + attempt + result_payload_hash` 幂等提交；
2. 一份typed failure，至少包含 `code/effect_scope/child/browser_outcome/mutation_outcome/evidence`；只要WAL存在实际输入winner，就必须携带该winner的 `provider_effect_identity_hash`，不得因当前候选漂移降格为 `mutation_outcome=no`。

Website只按上述事实作现役决策，不从错误码猜Provider现实状态：

- `no + physical_input_count=0`：可以结束当前Attempt并有限退避；
- `dispatched/confirmed`：不得增加accepted Attempt，必须保持同一Attempt的 `PROVIDER_EFFECT_READBACK_PENDING`；
- settled result通过领域验证：同事务写业务对象、admission receipt和completed，再按同一job/result读回；
- settled result失败：持久化outer/native/pointer rejection与receipt，孤儿化当前artifact，再签发新revision；
- transport 200、AGENT upload、terminal completed或日志succeeded均不是入库完成。

当前三个identity-drift工单不删除、不清零、不伪造新revision。修复发布后，它们应从已有WAL winner零提交收回；历史失败ledger与accepted count保留为真实历史。若winner事实多义，则按闭集失败关闭，另行提交精确清除授权，绝不自动重建任务。

### 21.7 artifact入库完整性修复

Website只做两处原位替换，不加migration：

1. `job-claim-repository.ts` 新Attempt孤儿化旧staged artifact时，同一SQL同时写 `orphaned_at=coalesce(orphaned_at,now())`；
2. `output-artifact-maintenance.ts` 已经选择 `state='orphaned'` 的行，更新条件必须同样是 `state='orphaned'`，删除永远不可能命中的 `state='staged'` 条件。

发布前使用现役maintenance Owner有界处理当前 `orphaned_at is null` 行并读回为0；不直接删除数据库行，不新建一次性migration或修复台账。对象删除仍由现役private object store清理流程完成。completed/admitted artifact、publication、localization binding与业务receipt的hash必须前后完全不变。

### 21.8 冻结法案必须如何精准迭代

当前代码若直接实现21.4，会与冻结条款中“必须先按精确submit identity查询、身份不等失败关闭、旧零输入Attempt也必须保持同一effect identity”的文字冲突。因此本次不是单纯Blueprint细节，施工前必须得到授权人对以下封闭条款的明确解冻授权：

| 仓库 | 精准替换 | 保持不变 |
|---|---|---|
| AGENT | `LAW-GPT-002-V11 -> V12`：把精确identity-first改成同revision稳定范围先裁决现实winner；唯一winner零提交读回；只有全部旧事实明确no/0且Website签发新Attempt时才允许当前identity首次输入 | effect identity七元组、单WAL、单lane、Website恢复Owner、RESULT_SETTLED_UNUSABLE新revision门、60秒门全部不变 |
| AGENT | `LAW-LOCAL-BROWSER-SESSION-004-V38 -> V39`：允许唯一WAL在prepare前用现有列解析winner，并规定多义全局失败关闭 | WAL schema、logical_mutation_id、at-most-once、DISPATCHED全局阻断不变 |
| Website | `LAW-AI-ACCEPTANCE-013-V8 -> V9`：同步声明Website新Attempt只给零输入分支资格，CONFIRMED分支必须消费Browser返回的历史exact winner | 三个next action、V6合同字段、result revision规则、领域admission规则不变 |

版本依赖传播只机械更新直接依赖lawId、registry与现役Blueprint；不得借机修改其他法条。跨仓V6合同、数据库schema和migration均不变。替换完成后必须重新生成law registry、运行唯一governance校验并重新冻结。未取得该精准解冻授权前，代码施工状态必须为 `BLOCKED_BY_FROZEN_LAW`，不得用“修Bug”绕过。

60秒首轮修复、artifact时间修复、原生语义诊断动态验收均已符合现役法案，不需要额外改法案。

### 21.9 施工工单与顺序

#### NTAB-F01｜法案与Blueprint单候选替换

- 输入：21.8的明确解冻授权；Owner：双仓法案系统；
- 动作：只替换三条法案及直接版本引用，原位更新GPT、Local Browser、AI Acceptance现役Blueprint；
- 验收：active law唯一、registry唯一、冻结标记恢复，合同/migration差异为0；
- 删除门：任何额外law、方案、兼容说明或第二registry必须删除。

#### NTAB-F02｜WAL winner原位收敛

- 目标：`browser-mutation-store.ts`、`browser-command-actor.ts`、现役lease API与`production-atomic-call.ts`；
- 动作：删除二段drift路径，改成21.4单resolver；复用现有outcome/receipt/canonical URL；
- 验收：历史CONFIRMED + 新候选漂移时 `physical_input_count`增量0并读回旧result；全部旧no/0 + Website新Attempt时恰好一次submit；多winner零submit且失败关闭；
- 禁止：新WAL表/列、第二API状态机、把Browser SQLite暴露给Runtime、按最新时间猜winner。

#### NTAB-F03｜首次observation归一到唯一调度路径

- 目标：`production-browser-lifecycle.ts`与BrowserLaneCoordinator现役验收；
- 动作：submit confirmed后park；删除首次直接checkpoint分支；所有observation统一acquire；
- 验收：首轮及后续任意相邻真实observation均 `>=60000ms`，全程 `browser_action_in_flight<=1`，每次exact Tab active/current读回，normal observation导航增量0。

#### NTAB-F04｜Website artifact时间不变量

- 目标：`job-claim-repository.ts`、`output-artifact-maintenance.ts`及现役repository测试；
- 动作：两处SQL条件原位纠正；
- 验收：新产生orphaned行的 `orphaned_at`非空；当前缺失行经现役maintenance处理后为0；completed闭包零变化。

#### NTAB-F05｜失败运输与Website决策回归

- 目标：复用现役failure envelope、`job-lifecycle-repository.ts`和failure ledger测试；
- 动作：确认resolver返回的历史winner在任何后续失败中都进入原有metadata；不增加字段；
- 验收：CONFIRMED readback失败不增加accepted Attempt，`current_reason=PROVIDER_EFFECT_READBACK_PENDING`；no/0才可进入WAIT_NEW_ATTEMPT；重复同一failure request幂等。

#### NTAB-F06｜真实N=3终局证明

- 在相同clean candidate pair、真实Chrome/GPT、Website动态N=3上执行；
- 至少三个全新工单同时在途，证明三专属Tab、一lane、全局60秒；
- 受控构造一个历史CONFIRMED/候选漂移恢复样例，证明零submit收回并最终Website admission；
- 构造一个旧no/0新Attempt样例，证明只发生一次现实submit；
- 构造一个语义拒绝样例，读回outer/native/pointer rejection，随后新revision成功入库；
- 最终数据库逐job核验terminal、business consumption、artifact/binding/publication/payload，并证明 `completed_missing_closure=0`、`orphaned_at_missing=0`。

施工顺序固定为：

```text
解冻授权 -> 双仓法案/Blueprint替换并重新冻结
-> AGENT F02/F03/F05 -> Website F04/F05
-> 聚焦质检 -> 双仓quality:check CHANGE -> clean READY
-> 停止新claim并让现役accepted Attempt收敛
-> Website先发布 -> AGENT发布/重启
-> 现役maintenance有界修复时间事实
-> N=3 F06 -> 双仓RELEASE
```

Website先发布只包含向后兼容的SQL不变量修复；AGENT切换前必须停止新claim并收敛当前accepted Attempt，避免再次在运行中跨版本改变未决effect候选。若存在unresolved DISPATCHED，发布停止，先按同一WAL事实收束，禁止强制切换或重放。

### 21.10 代码总量与防过度设计硬门

本轮生产代码和质检代码总行数原则上必须持平或减少，按双仓本次候选相对各自施工前HEAD的所有 `*.ts/*.tsx/*.js/*.mjs/*.cjs/*.sql` 有效增删行合计裁决：

```text
AGENT executable_net_lines <= 0
AND Website executable_net_lines <= 0
AND new_production_files = 0
AND new_tables/columns/migrations/contracts/next_actions/states = 0
```

达到该门的方法只能是删除重复实现并参数化现役测试，不得通过压成难读单行、移出统计后缀、删必要断言或生成代码作弊：

- F02删除`assertProviderEffectHistory`二段判定后原位形成一个resolver；
- F03删除首次observation特殊路径，复用后续统一路径；
- F04替换错误SQL条件，不增加函数；
- 新验收合并进现役fixture，删除已被统一状态表覆盖的重复case/setup。

任何新增抽象必须同时回答“当前消费者是谁、删除后哪个验收必失败、为何不能由现役Owner承担”。回答不出即删除。尤其禁止：effect scope hash列、winner cache、recovery manager、deployment coordinator、per-job polling worker、Attempt cap、自动降N、旧/新identity双读桥。

### 21.11 分层验收与完成公式

| 层级 | 必须证明 | 不能冒充 |
|---|---|---|
| 法案 | 三条精准替换、直接引用一致、重新冻结 | 不代表代码完成 |
| 静态/单元 | winner闭集、首轮60秒、failure运输、orphaned时间 | 不代表真实Browser |
| CHANGE/READY | 双仓唯一quality verdict绑定clean candidate pair | 不代表发布或入库 |
| Browser动态 | exact Tab active/current、单lane、首轮起全局60秒、零重复submit | 不代表Website接纳 |
| Website动态 | admission receipt与领域对象同result hash读回 | HTTP 2xx、terminal或upload不能替代 |
| RELEASE | F06全部动态证据与同一candidate绑定 | 历史26个成功不能替代新候选证明 |

终局完成公式：

```text
三条必要法案已获授权精准替换并重新冻结
AND 现役唯一WAL在prepare前完成同revision winner闭集裁决
AND 历史CONFIRMED候选漂移的provider submit增量=0
AND CONFIRMED失败保持同一accepted Attempt，no/0才签发新Attempt
AND 第一次及全部后续相邻真实Provider observation>=60000ms
AND 每次动作/观察前exact Tab active/current读回且browser_action_in_flight<=1
AND orphaned_at缺失=0且completed/admitted闭包hash零变化
AND 至少一个恢复样例与一个新样例取得Website admission+领域持久读回
AND completed_missing_closure=0、terminal_waiting_business=0
AND 双仓executable_net_lines<=0、新生产文件/表/列/migration/合同/状态均为0
AND 双仓同candidate quality:check CHANGE/clean READY/RELEASE通过
AND P0/P1=0、第二链路数量=0
```

在上述公式完成前，只能说“N=3基础主链可运行、终局修复方案可施工但被冻结法案授权门阻断”，不得说当前剩余问题已经闭环。

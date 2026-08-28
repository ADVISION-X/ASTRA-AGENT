# 顺序真实内测

仅在已获得真实任务及 GPT/Browser 动作授权后执行。

## 1. 调试候选与最低安全就绪

固定双仓 HEAD、Git 状态、staged/unstaged diff 身份、相关 untracked 内容身份、provider/dependency hash、Catalog hash、route policy hash、环境和授权引用。脏工作树可作为 debug candidate；必须保留用户既有改动，并证明本地运行实例或待测构建来自当前快照。clean commit 只在后续 READY/CI-FULL/RELEASE 交接时要求。

分别取得新鲜证据，不把某一轴的成功替代另一轴：

- website Core、Worker、terminal/consumer 和用户页面；
- AGENT shell、Runtime Log Spine 和 production store；
- cloud contract、device/session、claim admission、lease/fence；
- Browser Authority、任务专属 Target/Document 和 lane；
- GPT child、Browser WAL、checkpoint、Outbox 和 cleanup。

HTTP 200、进程存活、端口监听、heartbeat 或空队列都不能单独证明 ready。

先检查 `RECONCILE_ONLY` 对账链、mutation 身份公式、Dynamic Proof 依赖、声明分母和 route cleanup。会造成未知或重复外部副作用的缺口必须先在当前脏候选上诊断、修复和聚焦验证，再发相关真实任务；证据治理缺口可以与安全实测并行修复，但会限制最终 claim ceiling。不得要求先跑数小时 CI-FULL 才开始诊断。

## 2. 生成执行清单

从 AGENT 唯一 Catalog 和 route policy 解析 12 个 Plugin 及 13 条 primary，按稳定顺序生成本次内存清单；不得写第二份产品表。父任务必须先于它依法产生的后续任务。

使用一个受控的真实管理员 QA 身份和正式生产数据库。每条 route 准备满足领域合同的真实 subject、authorization、material、entitlement、consent 和幂等输入，并从现役合同解析文章发布、通知、交付、支付观察、用户记录等实际业务副作用及 cleanup obligations。每项副作用和正式 Owner 清理必须具名授权；只有能证明某 route 没有清理义务时才可省略清理授权。不得使用 fixture、测试模式、测试数据库、陈旧任务或直接数据库写入。

每条 route 正式发单时，必须由网站现役 task/idempotency Owner 原子完成同一 QA 身份和 route 的并发准入。已有 active、recovery pending 或结果未知任务时拒绝创建并返回 `CONCURRENT_MAINTENANCE_TASK_PRESENT`；预查询只能用于观察，不能代替原子准入。现役 Owner 缺少该能力时，将它作为安全 finding 在原 Owner 片区修复并聚焦验证，再继续发单；不得新增锁、台账、scheduler 或第二协调器。只有缺少修复授权或无法确定 Owner 时才 `BLOCKED`。

## 3. 每条 route 的原子循环

1. 发单前冻结当前双仓 debug candidate；确认自上一次绑定后没有未授权并发改动，运行实例确实加载该快照。
2. 在该产品的正式网站业务入口完成管理员动作；当前 admin 页面若没有发单能力，不得绕到内部 API。
3. 固定 `product_id`、`action_id`、`job_id`、`source_task_id`、`idempotency_key`、`request_hash`、contract/candidate hash。
4. 核对网站 accepted/frozen identity 与 AGENT claim、attempt、lease、fence 完全一致。
5. 核对期望 Plugin/Skill、任务专属 Target/Document、GPT child 输入与冻结后置条件。
6. 监控 Browser mutation 的 `PREPARED -> DISPATCHED -> CONFIRMED|REJECTED|FAILED`，但不替代 Browser Authority 发命令。
7. 核对严格结构化结果、checkpoint、Outbox 先落盘、terminal receipt/hash、网站首终态和幂等消费。
8. 在真实用户页面核对领域产物可读、无测试数据泄露或错误成功提示。
9. 核对任务专属 Target、下载和临时产物按 Owner 合同清理，Outbox 无悬挂项。

只有第 3—9 项全部闭合，才记录该 route 的维护观察并进入下一条。不得取消、抢占或降级真实用户任务；若生产负载无法隔离本次 QA 任务，停止并申请维护窗口。

修复后生成新 debug candidate。若修改只属于当前产品片区，复跑失败 route；若修改命中 shared runtime、跨仓合同或多个已通过 route 的共同消费者，按真实影响面重跑受影响的已通过 route，不机械重跑无关产品，也不以全仓 CI 代替真实复证。

## 4. Chrome/GPT 现场证据

“Chrome 插件”指现役 GrassEye 扩展和 Browser Authority。Codex 的 Chrome 能力只有在不会争抢 Authority、不会改变原 Target/Document 且当前合同明确允许时才能辅助观察。

每次原子动作证据至少包括：唯一 Target/Document、fresh DOM/可交互候选计数、动作前条件、WAL/mutation 身份、动作后直接页面事实、GPT child 结果、terminal/proof 引用。截图只能作为辅助，不能代替这些事实。

## 5. 正常完成

全量 primary 完成后，输出 13 条 route 的逐条观察和未证明范围，结论只能是 `MAINTENANCE_OBSERVATION_ONLY`。不要自动进入 26 条 review、READY、提交、部署或 RELEASE。

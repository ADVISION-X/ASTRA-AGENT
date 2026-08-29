# 顺序真实内测

仅在已获得真实任务及 GPT/Browser 动作授权后执行。先按 [admin-auth.md](admin-auth.md) 复用或建立网站管理员会话。

## 1. 调试候选与最低安全就绪

固定双仓 HEAD、Git 状态、全部 staged/unstaged diff 身份、现役构建/运行/配置发现链可达的 untracked 或 ignored 输入安全身份、provider/dependency hash、Catalog hash、route policy hash、环境和授权引用。脏工作树可作为 debug candidate；必须保留未获当前片区修改授权的用户既有改动，并证明本地运行实例或待测构建来自当前快照。无法证明运行闭包完整时返回 `DEBUG_CANDIDATE_UNBOUND`。clean commit 只在后续 READY/CI-FULL/RELEASE 交接时要求。

分别取得新鲜证据，不把某一轴的成功替代另一轴：

- website Core、Worker、成功交付 receipt、领域入库 consumer 和用户页面；
- AGENT shell、Runtime Log Spine 和 production store；
- cloud contract、device/session、claim admission、lease/fence；
- Browser Authority、任务专属 Target/Document 和 lane；
- GPT child、Browser WAL、checkpoint、Outbox 和 cleanup。

HTTP 200、进程存活、端口监听、heartbeat 或空队列都不能单独证明 ready。

还必须从 Website 现役持久 Owner 读取每个相关任务的累计 attempt、剩余重试预算、`next_retry_at`、停车/放行、故障片区熔断和实际容量占用。Plugin/version/稳定错误相同的停车任务不得继续占用 active lease、worker slot、业务容量或不再需要的 Browser/continuation lane；若历史任务占满容量而健康任务仍在排队，记为 `PARKED_TASK_CAPACITY_LEAK`，先保存情报并走正式 Owner 释放容量。具体次数、熔断阈值和 Website 内部 Owner 未冻结时不得由 Skill 猜测或新增本地台账；没有唯一策略就禁止自动重试并隔离受影响片区，不阻塞已证明无共享故障面的健康 route。

先检查 `RECONCILE_ONLY` 对账链、mutation 身份公式、Dynamic Proof 依赖、声明分母和 route cleanup。会造成未知或重复外部副作用的缺口必须先在当前脏候选上诊断、修复和聚焦验证，再发相关真实任务。本次事故发生前已经独立确认且与当前故障逃逸无关的证据治理缺口可以并行修复；当前故障的治理逃逸修复必须后置到原网站任务成功恢复、交付并入库，二者在闭合前都限制最终 claim ceiling。不得要求先跑数小时 CI-FULL 才开始诊断。

## 2. 生成执行清单并绑定 GPT 公共分母

从 AGENT 唯一 Catalog 和 route policy 解析 12 个 Plugin 及 13 条 primary，按稳定顺序生成本次内存清单；不得写第二份产品表。父任务必须先于它依法产生的后续任务。

同时从现役 capability contract、公共执行器和全部 Product 消费者反查当前 GPT 公共分母，必须精确闭合为 22 项：

- 会话与执行配置 7 项：`prepare_clean_gpt_chat`、`focus_exact_gpt_conversation`、`verify_gpt_conversation_identity`、`open_gpt_execution_profile`、`ensure_exact_gpt_model`、`ensure_exact_gpt_reasoning_tier`、`close_gpt_execution_profile`；
- 附件、草稿与提交 7 项：`open_gpt_attachment_control`、`attach_approved_gpt_files_once`、`reconcile_gpt_attachment_set`、`write_exact_gpt_prompt`、`reconcile_gpt_draft`、`submit_exact_gpt_turn_once`、`reconcile_gpt_turn_submission`；
- 输出 4 项：`wait_for_stable_gpt_text`、`checkpoint_gpt_text_response`、`wait_for_stable_gpt_image`、`checkpoint_gpt_generated_image`；
- continuation 状态 4 项：`persist_gpt_continuation`、`acquire_gpt_continuation_lane`、`advance_gpt_continuation_lane`、`release_gpt_continuation_lane`。

`bind_exact_browser_target`、`execute_one_governed_browser_mutation`、`reconcile_browser_mutation_outcome` 属于 Browser Authority 边界，不进入 Product Flow；step checkpoint 与重启恢复属于 Runtime，也不新增 child ID。Product Plugin 只拥有业务轮次、Prompt、材料角色、输出类型、会话关系和结果合同，不得再复制 `gpt_flow` 厂商页面步骤。出现 44 项旧分母、退出项、Product 复制数组、alias、兼容映射或第二公共执行链时，记为 `GPT_PUBLIC_CAPABILITY_DENOMINATOR_DRIFT`；它是必须修复的调试 finding，不阻止 Skill 启动诊断，但在受影响片区收敛并聚焦验证前禁止发送相关真实任务。

使用一个受控的真实管理员 QA 身份和正式生产数据库。每条 route 准备满足领域合同的真实 subject、authorization、material、entitlement、consent 和幂等输入，并从现役合同解析文章发布、通知、交付、支付观察、用户记录等实际业务副作用及 cleanup obligations。每项副作用和正式 Owner 清理必须具名授权；只有能证明某 route 没有清理义务时才可省略清理授权。不得使用 fixture、测试模式、测试数据库、陈旧任务或直接数据库写入。

每条 route 首次正式发单时，必须由网站现役 task/idempotency Owner 原子完成同一 QA 身份和 route 的并发准入，并同时裁决该 route 的停车、重试预算和故障片区熔断。若不存在本轮恢复对象而已有 active、recovery pending 或结果未知任务，拒绝创建并返回 `CONCURRENT_MAINTENANCE_TASK_PRESENT`；若该任务正是本轮故障对象，禁止再创建任务，转入 [fault-repair.md](fault-repair.md) 的原任务恢复流程；若该 Plugin/version/稳定错误片区已熔断，只跳过受影响片区，不创建任务、不把它记为完成。预查询只能用于观察，不能代替原子准入。现役 Owner 缺少该能力时，将它作为安全 finding 在原 Owner 片区修复并聚焦验证；不得新增锁、台账、scheduler 或第二协调器。只有缺少修复授权或无法确定 Owner 时才 `BLOCKED`。

## 3. 每条 route 的原子循环

1. 首次发单前冻结当前双仓 debug candidate；确认运行实例确实加载该快照。从 accepted 到同一任务成功交付、领域入库和执行资源 cleanup 闭合期间，命中该任务当前 attempt 运行、合同、构建或配置闭包的任何字节变化都按 `CANDIDATE_DRIFT` 收口，不论该变化是否已获授权。修复只能在 attempt 之间生成并重新绑定下一版 candidate。
2. 在该产品的正式网站业务入口完成管理员动作；当前 admin 页面若没有发单能力，不得绕到内部 API。
3. 固定 `product_id`、`action_id`、`job_id`、`source_task_id`、`idempotency_key`、`request_hash`、contract/candidate hash。
4. 核对网站 accepted/frozen identity 与 AGENT claim、attempt、lease、fence 完全一致。
5. 核对期望 Plugin/Skill 的业务语义只映射到唯一公共 22 项执行面，并固定任务专属 Target/Document、共享 child 输入与后置条件；不得执行 Product 私有页面数组或已经退出的 child。
6. 每个安全原子步骤完成后，先核对 Runtime 已持久化 `flow version + step index + input hash + proof + mutation state + canonical document identity`，再允许下一步；涉及物理动作时同步监控 Browser mutation 的 `PREPARED -> DISPATCHED -> CONFIRMED|REJECTED|FAILED`，但不替代 Browser Authority 发命令。
7. 发生重启、控制异常或后置观察超时时，先联合读取 Website 重试/停车事实、最后 checkpoint、Browser WAL 和当前 Document，只允许观察、对账或执行第一个尚未完成且仍获授权的动作；不得从头重放。当前 attempt 必须明确闭合为 `success` 或 `failed`；`failed` 时形成完整故障情报包并进入获准有限重试、只读对账或停车等待修复之一，原网站任务不得结束。
8. 核对严格结构化结果和 Outbox 先落盘；网站只接受同一 job/source/request 的成功交付 receipt，并由领域 consumer 幂等入库。attempt failure、Browser rejection 或本地 checkpoint 都不能冒充网站任务终态。
9. 在真实用户页面核对领域产物可读、无测试数据泄露或错误成功提示。
10. 核对任务专属 Target、下载和临时产物按 Owner 合同清理，Outbox 无悬挂项。
11. 本 route 若经历故障修复，同一原任务成功交付并入库后按 [fault-repair.md](fault-repair.md) 第 8 节完成后置 `WHY-HAPPEN`；治理逃逸未闭合时不得进入下一条。

只有第 1—11 项全部闭合，且同一网站任务已经成功交付并由正式领域 consumer 入库，才记录该 route 完成。任何 attempt 失败都先在本 route 内形成故障现场，不得创建 replacement job 或把失败记作 route 完成。任务依 Website 策略停车，且外部动作已被确认、拒绝或正式封存为“结果未知且永不重放”，故障情报与容量释放闭合后，可以继续不共享故障 Owner、Plugin/version、合同或运行片区的健康 route；受影响 route 仍留在未完成分母，最终必须恢复成功并入库。不得取消、抢占或降级真实用户任务；若生产负载无法隔离本次 QA 任务，停止并申请维护窗口。

修复后生成新 debug candidate，并恢复失败 route 的同一网站任务，不重新发单。若修改命中 shared runtime、跨仓合同或多个已完成 route 的共同消费者，先让当前原任务成功交付并入库；其余影响面只在另行授权后安排回归任务，不能替代当前故障任务，也不机械重跑无关产品或以全仓 CI 代替真实交付。

## 4. 生产 Browser 证据与 Codex Chrome 诊断

GrassEye Chrome 扩展是 Browser Authority 管辖下的生产物理适配器；Browser Authority 是唯一生产动作许可和状态合同；Codex Chrome 是独立的操作者浏览器诊断能力。三者不得互称或互相替代。

生产 route 存续期间，Codex Chrome 只能在不争抢 Authority、不附加第二控制器且不改变原 Target/Document 时辅助只读观察。当前失败 attempt 已安全收口、原任务保持恢复状态且满足 [fault-repair.md](fault-repair.md) 第 2.3 节全部条件后，Codex Chrome 可以执行一次获新授权的受控人工复现；该复现不属于原任务的成功交付或入库证据。

每次原子动作证据至少包括：唯一 Target/Document、fresh DOM/可交互候选计数、动作前条件、WAL/mutation 身份、动作后直接页面事实、GPT child 结果和 proof 引用；任务完成还必须另有同一身份的成功交付 receipt 与领域入库证据。截图只能作为辅助，不能代替这些事实。

厂商页面 topology 必须在每次 route 执行前由本次真实登录 Chrome Document 重新取证。新鲜 popup、active/inert、候选和可访问状态与旧证据、fixture、文档示例或 selector 假设不一致时，旧证据对当前控制立即失效；停止动作并重新定责，不得沿用旧步骤、fallback 或 child 映射。

2026-08-28 最新实证必须作为当前回归反例，详细裁决见 [fault-repair.md](fault-repair.md) 第 3.1 节：执行配置只有同一菜单，点击唯一 composer 聚焦表面后入口先收口、浮层再异步消失；附件完成只认全部且仅有的可见附件集合；fresh submit 先确认 user turn 与 composer 清空，再等待 `/c/WEB:...` 变为永久 canonical URL；assistant placeholder 消失而停止按钮仍在属于生成中；canonical URL 新标签必须等待 hydration 后的 composer、marker 与 message identity；generated image 只认 exact assistant turn 中去重后的唯一语义主图，并由已认证 Browser Authority 下载，禁止页面外直接 `fetch(src)`。任何一步都必须使用各自直接后置条件，不能让一个层的暂态或实现细节冒充完成或失败。

当前执行配置动作仍是：打开同一入口；模型已匹配时只读核验，未匹配且当前 Document 的唯一选择路径尚无新鲜实证时失败关闭；在同一菜单内以一个 bounded `keypress repeat=1..4` 把 slider 调到目标并读回；点击唯一 `#prompt-textarea` composer 聚焦表面后先证明入口 `aria-expanded=false` 和草稿字节不变，再有界等待 popup 从 DOM 稳定消失。不得执行“高级”、第二推理弹窗、重复入口、多余模型点击，也不得把 `main` 几何中心当空白处；当前项目页的该点实测命中历史会话链接。下一次执行仍以届时实时 Chrome 事实为准，本快照不授权未来点击。

## 5. 正常完成

只有 13 条 primary 各自的原网站任务都成功交付并入库，且期间故障的后置 `WHY-HAPPEN` 已闭合，才输出逐条观察和未证明范围；结论仍只能是 `MAINTENANCE_OBSERVATION_ONLY`。任何未恢复任务都保留在未完成分母；停车可以释放容量并让无关健康 route 继续，但不得计入完成数。不要自动进入 26 条 review、READY、提交、部署或 RELEASE。

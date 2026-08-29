# 故障定责、重构、原任务恢复与交付

## 1. 先冻结现场

首次故障立即停止当前任务及同一故障片区的新生产动作。不要先删任务、重启链路、关闭 GPT 页面或打开新页面；停车并安全释放容量后，只有已证明不共享故障 Owner、Plugin/version、合同或运行片区的健康任务可以继续。

每个失败 attempt 都必须明确记为 `failed`，并先形成一份可尸检的故障情报包：

- 网站任务、AGENT job、Plugin/version、attempt、lease/fence 和最后 step checkpoint；
- 开始/失败时间、持续时间、累计重试次数与 Website 给出的 `next_retry_at`；
- Owner、component、业务阶段、安全原子步骤、稳定错误码、直接原因、根因 Owner 和因果事件；
- 外部 mutation 是 `no`、`dispatched` 还是 `confirmed`；
- 日志事件、checkpoint、Browser WAL、对象/回执的脱敏 ref/hash；
- 当前是否占用 worker slot、lease、业务容量、Browser/continuation lane 或 Outbox；
- `safe_to_retry` 判断，以及为何可重试、只能对账或必须停车。

只有 HTTP 409、异常字符串或笼统 `failed` 不足以进入下一处置。外部结果未知属于 mutation 证据，不得把 attempt 留成第三种含糊结果。

按 mutation 状态分流：

- 无 mutation、`PREPARED` 或 dispatch 前 `FAILED`：确认没有外部动作后，只结束当前 attempt，并把原网站任务保持在 `recovery_pending` 或 `review_required`；不得写任务失败终点。
- `DISPATCHED`：只在原 Target/Document 上按冻结正反后置条件做只读对账；禁止重发、刷新、关闭/重建 Target、重启链路或 selector 广扫。观察次数受现役 Owner 的有限预算约束，最迟不得超过任务冻结的 `delivery_deadline_at`；到期只停止本次观察/attempt，原网站任务仍是未完成的恢复对象。
- `CONFIRMED` 或 `REJECTED`：尊重既有 mutation 事实，不再次执行同一动作；这两个值都不是网站任务完成状态。
- 尚未到 Browser 层：记录 `BROWSER_NOT_REACHED`；不得为了“实证”额外发送 GPT/Browser 动作。

随后只能选择一种处置：

| 失败事实 | 唯一允许处置 |
| --- | --- |
| 已证明没有外部动作，且错误是现役策略明确列出的可恢复临时故障 | 仅在 Website 剩余预算授权下，从最近安全 checkpoint 有限重试并执行持久退避 |
| 外部动作已 `DISPATCHED` 但结果不明 | attempt 记为 `failed`；禁止重放，只在冻结期限和预算内只读对账，仍不明则停车 |
| identity、Plugin/checkpoint version、合同、权限或授权等确定性冲突 | 第一次即停车并报告，修复和 Website 正式放行前不得重复冲锋 |

重试预算、累计次数、`next_retry_at`、停车/放行和故障片区熔断只认 Website 侧持久事实，不能因 AGENT 重启、换设备、新 attempt、新 candidate 或用户再次调用 Skill 而清零。AGENT 提交故障情报、checkpoint、外部动作事实和 `safe_to_retry` 判断，不拥有预算或放行决定。会议尚未冻结 `3`、`5`、熔断阈值和 Website 内部具体 Owner；现役合同缺失时不得猜数字或自建状态，记录 `WEBSITE_RETRY_POLICY_OWNER_UNRESOLVED` 并停车受影响片区。

同一 `Plugin/version/稳定错误码/根因 Owner` 指纹连续击倒多个任务时，按 Website 现役策略只熔断该故障片区。停车前先持久化故障情报、checkpoint 和 WAL，终结本 attempt；外部动作必须由正式 reconciliation Owner 确认、拒绝，或在预算/期限后封存为“结果未知且永不重放”，随后释放 lease/fence、worker slot、业务容量及不再需要的 Browser/continuation lane，且不得破坏后续只读尸检依据。任务和最终交付义务继续保留。若十个同类历史任务占满十个位置而健康 SEO 任务无法领取，这是 `PARKED_TASK_CAPACITY_LEAK`，不得靠继续重试、判任务失败或删任务腾位；必须修复正式 Owner 的停车/释放片区，健康任务随后继续。

本轮 A/B 实证是拒绝旧错误的运行反例：V6 claim 已成功且双仓合同指纹一致时，十个旧 durable 任务因 Plugin `2 -> 9`、checkpoint schema `1 -> 2` 与新 lease 身份冲突而报 `PLUGIN_IDENTITY_CHANGED_BEFORE_RECOVERY`、`AI_V6_CHECKPOINT_TRANSITION_INVALID`，不能归因于 V6 通讯不兼容，也不能对十个任务重复相同尝试。该类确定性 identity/合同冲突第一次即停车对应 Plugin/version 片区，保留旧身份现场，释放容量，修复唯一退役/重建/交接路径后由 Website 放行；健康 SEO 片区不得被拖住。

旧 mutation 已明确终结、失败 attempt 的执行资源安全收口后，原网站任务必须继续保留为恢复对象。不得创建 production diagnostic job 或 replacement job 绕过该任务；诊断使用本地复现、结构化日志和下文受控 Codex Chrome 人工复现，均不得写入生产成功链。

恢复或重启前必须联合读取原任务最后 step checkpoint、Browser WAL 和当前 Document。checkpoint 至少包含 `flow version + step index + input hash + proof + mutation state + canonical document identity`；三者不一致时先观察或对账，只有第一个尚未完成、没有已派发副作用且仍获授权的动作可以继续。不得从头重放整轮，也不得仅因所有 attempt 都标记失败就结束或替换原网站任务。

只读观察本身不改变 WAL、job 或 recovery 状态，也不能补造缺失的 provider receipt。只有现役 Browser reconciliation Owner 能按当前合同生成独立 reconciliation record 并执行单调转换：正向后置条件成立则确认既有 mutation 并恢复原 job；反向成立则拒绝当前 mutation 并结束本 attempt；无法判断则在 `delivery_deadline_at` 到期后生成 typed attempt/recovery outcome 并停止观察。后两者都让原任务继续处于未完成恢复状态。不得用全新 job 代替原 job 恢复。Owner、正式 API/命令或消费链未接通时返回 `DISPATCHED_RECONCILIATION_OWNER_UNAVAILABLE`，禁止清理原任务事实、创建 replacement job 或继续生产 mutation。

## 2. Browser 与 Chrome 原子实证

### 2.1 名称和正常生产边界

- GrassEye Chrome 扩展：Browser Authority 管辖下的生产物理执行适配器；不等于 Authority。
- Browser Authority：唯一生产 Target/Document、动作许可、mutation WAL、后置条件和 reconciliation Owner。
- Codex Chrome：操作者 Chrome 的诊断能力；不属于 AGENT 生产链，不写 WAL、receipt、checkpoint、网站任务状态或业务结果。

生产任务存续时，在唯一 Browser Authority 下检查原 Target/Document、页面身份、DOM、新鲜候选、动作前状态、WAL、直接后置条件、GPT child、下载/产物和 cleanup。Codex Chrome 此时只能在不附加第二控制器、不改变原页面的前提下辅助只读观察；不能点击、刷新、导航、关闭或重建生产现场。

`DISPATCHED` 只能观察。没有安全可判定的后置条件时记录外部结果未知并停止，不能用新动作“试一下”。

### 2.2 Browser/GPT 原子根因证据

Browser/GPT 故障必须在真实登录 GPT 页面取得同一诊断 Document 的原子事实：页面及认证状态、Target/Document 或诊断 tab/Document 身份、hydration 前后 DOM、候选及可交互计数、节点是否替换、动作前状态、实际命中节点、动作后直接页面状态，以及相关 console/DevTools 错误。截图只是辅助；原始 HTML、secret、Prompt 和用户内容不得进入持久证据。

selector、语义定位和后置条件只能按以下顺序修复：真实 Chrome 原生事实 -> 固定原子根因 -> 修改唯一页面元素合同 -> 确定性回归和 mutant。fixture、源代码中的既有 selector、测试 DOM 或静态验收只能在根因固定后验证实现，不能发现真实页面事实，也不能把自己的 selector 猜测证明为正确。

厂商页面 topology 是每次执行都必须重新绑定的运行事实。进入任何 Browser/GPT 动作前，先在本次真实登录 Chrome Document 重新观察 popup 数量、活动/非活动面板、`inert`、候选计数和可访问状态，并冻结本次动作的直接后置条件；一旦新鲜页面事实与旧证据、fixture、文档示例或既有 selector 假设不一致，旧证据对当前控制立即失效，停止动作并按新鲜事实重新定责。历史证据仍保留为审计事实，但不得继续授权点击、补加步骤、fallback 或 child 架构。

真实页面要求多个 mutation 时，逐 mutation 记录动作前后 topology，不得把多步页面状态机压成一次 selector 点击，也不得让一个 one-mutation child 暗做多个 mutation。反过来，真实页面已经不再需要的步骤也不得因旧合同或旧测试而执行。Skill 不根据历史 UI 快照发明、复用或拆分 child；页面元素合同与现役唯一质量门只能消费本次新鲜 Chrome 原子事实。

物理动作与后置观察必须分开定责。WAL 已记录动作派发，而后置查询超时、Target 暂时不可读或页面正在异步收口时，不能倒推出动作没有发生或允许重放；先用 checkpoint、WAL 与同一 Document 重新观察。DOM 中存在隐藏 input、占位节点或非活动面板也只证明实现节点存在，不能替代用户可见语义状态。

精确 selector 在某一 Document 中计数为 0，只能证明该时刻没有匹配；随后出现 `BROWSER_TARGET_INVALID` 还会使后续页面诊断失去连续性。这组事实可以固定失败 action 和观察缺口，但不能单独证明 selector 已变、hydration 竞态、节点替换或正确替代 selector。

### 2.3 受控 Codex Chrome 人工复现

只允许在以下条件全部成立后，由用户对确切原 `job_id/product_id/action_id` 和 GPT 页面动作重新显式授权：失败 attempt 已结束但原网站任务仍处于恢复状态；mutation/WAL 无未决项；该 attempt 的生产 Target/Document 已按 Owner 合同释放；lease、lane 和 Outbox 已收口；AGENT 已停止且不会重新认领页面；没有待核外部副作用。

每次授权只允许一个专用诊断 tab、一次从同一冻结输入开始到失败 action 为止的最小前缀，以及每个原子 UI mutation 最多一次。禁止重试、刷新、广扫 selector 或继续执行失败 action 之后的业务步骤。只有失败 action 本身必须发送 GPT 输入且用户同时授权该 provider 副作用时才可发送；否则在发送前停止。

Codex Chrome 必须记录诊断 tab/Document 身份、冻结输入 hash、页面认证和新鲜度、hydration/节点替换、候选计数、动作前后状态及 console/DevTools 事实。它不得创建网站任务、调用内部 job API、写生产 WAL/receipt/checkpoint/任务状态，或把人工结果冒充原任务恢复、成功交付、入库、发布、通知或支付证据。

完成后关闭本次新建的专用诊断 tab，并确认没有下载、临时文件或新增生产 Target/lease/lane。若产生 provider conversation 或其他远端残留，只能按另行授权和正式能力清理；无法清理时记录残留并停止。任何前置条件、动作预算、证据或清理不闭合时，Codex Chrome 只能只读观察或返回 `CONTROLLED_CHROME_REPRODUCTION_BLOCKED`。

## 3. 联合结构化日志定责

跨仓事故从 xuanxue-web 运行唯一联合检查器，显式传入网站与 AGENT 日志源：

```bash
pnpm logs:inspect:website -- --job <job_id> --source <website-log> --source <agent-log>
```

它必须同时解析网站数据库 authority、AGENT Production Store 和 Browser WAL。`DIAGNOSIS_COMPLETE` 只证明该检查器覆盖的 boundary、authority、freshness、integrity 与 blocking roots 闭合，最多令 `failure_boundary_complete=true`；它不能自动令 `atomic_native_cause_complete=true`。

Skill 诊断报告必须独立记录两个布尔条件：

- `failure_boundary_complete`：联合检查器覆盖的失败边界、状态轴、authority 和因果链均闭合；
- `atomic_native_cause_complete`：失败 action 的原生因果机制、唯一 Owner 和可证伪替代解释已经由该层直接事实固定。Browser/GPT 故障必须消费第 2 节的真实 Chrome 原子证据。

只有两者都为 `true` 才能宣称根因已定位或输出 `FAULT_LOCALIZED`。任一为 `false` 时，只报告诊断未闭合和下一项所需证据，不猜根因、不修改 selector/后置条件。

拒绝旧错误的最小示例：日志把失败边界定位到 `open_gpt_model_selector`，精确 selector 在当时 Document 中计数为 0，随后诊断动作返回 `BROWSER_TARGET_INVALID`，fixture 又存在一个看似可用 selector。此时可将 `failure_boundary_complete` 评为 `true`，但 `atomic_native_cause_complete` 必须为 `false`；fixture 不能填补丢失的 live Document 事实，结论只能是诊断未闭合。

允许继续修复的示例：同一真实登录 GPT 诊断 Document 上记录 hydration 前后候选、稳定节点或节点替换、实际可交互计数、动作前状态、唯一动作及直接后置状态，并用 console/DevTools 事实排除 Target 漂移和其他替代解释。只有这些事实支持唯一原子因果链后，才把页面合同改动转成回归和 mutant。

### 3.1 2026-08-28 真实 Chrome 状态机反例

以下事实来自同日两轮真实登录 ChatGPT 页面调试，用于拒绝已经发生过的错误，不是 selector registry。下一次执行必须重新观察当前 Document；新鲜页面事实一旦不同，本节只保留历史诊断价值，不继续授权动作。

| 环节 | 当前直接事实 | 必须拒绝的旧判断 |
| --- | --- | --- |
| 执行配置 | 模型与推理 slider 位于同一菜单，没有“高级”或第二推理弹窗。模型已是 `GPT-5.6 Sol` 时只读核验唯一候选 `aria-checked=true`；slider 用一个 bounded `keypress repeat=1..4` 移到目标并直接读回。点击唯一 `#prompt-textarea` composer 聚焦表面后，入口先变为 `aria-expanded=false`，浮层随后异步从 DOM 消失，且草稿字节不变 | 重复打开入口、调用旧 `open_gpt_advanced_model_selector`、点击已选模型、把 `main` 的几何中心当空白处，或要求关闭点击后的同一瞬间 popup 计数必须为零 |
| 附件 | 唯一可见附件入口打开菜单，经真实 file chooser 一次设置全部批准文件；完成只由页面“全部且仅有”的可见附件集合、文件身份和移除控件证明 | 隐藏 `input[type=file]` 存在、file chooser 返回或本地路径存在就判上传完成；失败后盲目重复 |
| fresh submit | 唯一 user turn 与 composer 清空先证明提交发生；URL 可能先为 `/c/WEB:...`，随后才稳定为永久 `/c/<conversation-id>`，两者必须分成两个 checkpoint | 把过渡 `WEB:` URL 持久化为 continuation，或因提交后立即读取 canonical URL 失败而重发 |
| assistant 文本 | request placeholder 可以出现后消失；placeholder 消失而停止按钮仍在是正常生成中。完成必须同时满足目标 user turn 唯一、其后最终 assistant turn 唯一、停止按钮不存在、最终 message identity 与文本在稳定窗口内不变 | 把 placeholder 当最终 turn，或在 placeholder 消失但停止按钮仍在时判失败 |
| continuation hydration | 新标签的永久 canonical URL 可以先正确，而 marker、messages 与 composer 暂时为空；必须在同一 URL 上有界等待 composer、exact marker 和 message identity 后再确认会话 | 只看 URL 就确认成功，或在 hydration 窗口把 marker/composer 为空判身份失败 |
| generated image | exact assistant turn 内可以有多个同源 `<img>`，但按文件身份去重后只认唯一带“已生成图片：”语义的主图；还须证明文件身份和自然尺寸稳定、停止按钮不存在。原始媒体只能由已认证 Browser Authority 下载一次，再交给本地机械哈希、转换和持久化 | 用稳定文本条件判断图片完成、把重复 DOM 图当多个产物，或脱离浏览器登录态直接 `fetch(src)`；该真实路径返回 HTTP 403 |

动作已派发而后置观察落入上述暂态时，先持久化当前 step/mutation 事实并在同一 Document 有界观察；不得重放。当前模型不匹配但唯一选择路径尚未在本次页面获得新鲜原子证据时失败关闭，不根据旧菜单猜测点击。每个安全原子步骤只有在自己的直接后置条件成立并写入 step checkpoint 后才能推进。

沿真实链逐段定位唯一语义 Owner：网站正式 sender -> API/contract/store -> claim/session/lease/fence -> AGENT route/plugin -> GPT child/Browser mutation -> checkpoint/Outbox -> 网站成功交付 receipt -> 领域 consumer 入库 -> 用户页面。

## 4. 片区删除加重构

修复前分别绑定两个仓库的 authority 和 debug candidate。根因属于哪个 Owner 就修改哪个仓；需要双仓修改时分别施工、分别测试、分别记录每次快照变化和未证明项。目标片区已有本轮授权改动时继续修复；命中用户既有改动必须取得当前任务对具名文件或片区的明确授权，否则使用隔离候选并保留原工作树。来源不明且重叠时先查归属或使用隔离 worktree。无关脏改只保留，不构成停止理由。

“片区”必须由根因和真实消费者界定。物理移除该 active slice 的错误实现、旧 consumer、binding、wrapper、fallback、alias、dual-read/write、shadow path 和不可达测试，再重建唯一主路径及其直接合同、消费者和测试。不得加入兼容层，也不得顺手改无关区域。

若修复需要修改 active law 或 blueprint，停止并请求单独授权。

## 5. 修复验证深度

至少包括：

- 原故障的确定性复现测试；
- 状态机或性质测试；
- 能证明旧错误重新出现会失败的 mutant test；
- Browser selector/后置条件测试必须来自已闭合的真实 Chrome 原子证据；fixture 猜测 selector、再用同一 fixture 验证的 mutant 无效；
- 公共分母验收必须精确证明 18 项 GPT 页面语义子能力加 4 项 continuation 状态子能力；3 项 Browser Authority 边界能力不得进入 Product Flow，十二个 Product Plugin 不得复制 `gpt_flow` 页面步骤。旧 44 项、退出 child、alias、兼容映射、Product 私有页面数组和第二公共执行链都必须被拒绝；
- 页面状态机回归与 mutant 必须分别拒绝：关闭浮层同瞬间归零、隐藏 file input 冒充上传、持久化 `/c/WEB:...`、placeholder 或停止按钮仍在时提前终结、hydration 前判 marker 缺失、图片页面外 `fetch(src)` 以及重复 DOM 图片冒充多个产物；
- Product flow 验收必须拒绝当前实时 topology 中已经消失的面板步骤、重复入口动作和已选模型点击；模型只读核验不匹配且没有新鲜选择证据时失败关闭。bounded keypress 只能在单个 command 内为 `1..4`，并直接证明目标 `aria-valuenow`；
- Runtime 状态机/性质测试必须证明每个安全原子步骤先 checkpoint 后推进，重启联合消费 checkpoint、Browser WAL 与当前 Document，已派发 upload/submit/media download 不整轮重放；attempt 失败只保留原任务进入恢复，不能写任务失败终点、删除原任务或创建 replacement job；
- 完成语义 mutant 必须证明：缺少成功交付 receipt、同一 job/source/request 结果准入或领域 consumer 入库中的任何一项，网站任务都不能完成；
- 失败处置测试必须证明 attempt 只有 `success|failed`，外部未知不产生第三种结果；无外部动作的临时故障服从 Website 预算和退避，`DISPATCHED` 只读对账不重放，确定性 identity/合同/权限冲突第一次即停车；
- 恢复测试必须证明 Website 累计次数、`next_retry_at`、停车和熔断在 AGENT 重启、换设备、新 candidate 与 Skill 重入后不被清零；策略或唯一 Owner 缺失时自动重试失败关闭；
- 容量测试必须证明外部动作确认、拒绝或封存为“结果未知且永不重放”后，停车任务释放 lease、worker slot、业务容量及不再需要的 lane，同时保留 checkpoint/WAL/尸检依据；同故障片区被隔离而无共享故障面的健康任务继续，十个历史故障任务不得占满十个位置拖住 SEO；
- Browser 故障的跨 attempt 身份稳定、`DISPATCHED` 不重放、原 Target/Document 对账、未知结果阻止新 mutation；
- 合同变化时双仓 provider/dependency 投影一致；
- 实际 Owner 的聚焦验收，以及两个仓库分别按本仓唯一命令执行的 `quality:check CHANGE`。

这些只证明 CHANGE。代码修改后的原任务恢复必须绑定更新后的 debug candidate，并证明运行实例已重新加载这些字节；本地真实系统允许运行未提交的工作树快照。只有声称外部已部署结果时才必须读回对应部署工件，不得用本地修改冒充远端生产结果。

## 6. 清理失败 attempt，保留原任务

保留原 job、source、request、idempotency、event、failure、receipt、mutation、checkpoint、完整故障情报包和最小脱敏审计事实。只结束失败 attempt；外部动作经正式 Owner 确认、拒绝或封存为“结果未知且永不重放”后，释放该 attempt 的 lease/fence、worker slot、业务容量与不再需要的 Browser/continuation lane，确认 Outbox 已对账，并通过正式 Owner 清理任务私有 Target、临时下载和孤立输出对象，不得破坏 WAL 与只读尸检依据。原网站任务保持 Website 现役合同定义的未完成停车/恢复状态，等待修复后放行。

普通用户页面不得展示管理员 QA 故障数据或错误成功提示。“用户侧无故障残留”不等于删除任务事实。不得直接 SQL 硬删、级联删除、覆盖、复制或用新任务替换失败任务；没有正式执行资源清理 API/Owner 时返回 `CLEANUP_OWNER_ABSENT`，要求抹除不可变事实时返回 `UNSUPPORTED_BY_ACTIVE_LAW`。

## 7. 恢复原网站任务并完成交付

恢复必须沿用原 `job_id`、`source_task_id`、`idempotency_key`、`request_hash` 和冻结业务输入；只为新的执行 attempt 生成合同要求的新 attempt、lease、fence 和尚未完成步骤的 mutation 身份。先读取 checkpoint、Browser WAL 与当前 Document：已确认步骤不重放，结果未知步骤先对账，只执行第一个尚未完成且仍获授权的动作。不得重新走网站发单入口，不得创建 replacement job。

同一任务只有在 AGENT 结果完成、Outbox 交付成功、网站正式结果准入、领域 consumer 幂等入库、真实用户页面结果正确且 Target/临时产物收口后才完成。任何一项缺失或新的 attempt 再次失败，都回到第 1 节保留新故障现场；原任务继续未完成。恢复生产动作必须同时满足 Website 正式放行、持久预算和 `next_retry_at`、安全 checkpoint、未解决外部副作用为零以及当前生产授权；用户授权或新 candidate 都不能自行清零预算。预算耗尽只停止自动 mutation 并释放容量，继续允许诊断和修复，不能解释成任务结束。

## 8. 后置 WHY-HAPPEN

只有第 7 节已经证明同一原网站任务在更新后的 debug candidate 上成功交付并入库，才追查故障为什么逃过现役治理。原任务恢复仍失败时回到运行根因和代码片区，不修改法案、施工图或质检系统。

用已经确认的故障根因和修复事实依次核对：

1. active law 是否缺少、歧义或矛盾了本应约束该故障的生产不变量；
2. blueprint 是否缺少对应 Owner、状态转换、物理动作许可、证据、失败状态或后置条件；
3. quality system 是否缺少静态检查、聚焦验收、反例或 mutant，或者检查存在却不能拒绝旧错误；
4. 唯一质量入口是否没有执行、没有覆盖或没有把已有检查纳入现役分母。

逐层检查，但只修改证明确有缺口的层。现役法案和施工图已经清楚时不得为了记录事故而改写；规则和检查都存在但没有运行时，只修唯一入口或覆盖关系；属于治理无法合理预防的外部运行事件时，不制造法案条款，只在已证明需要时修复诊断、恢复或观测能力。

修改冻结 active law 或 blueprint 仍须用户另行明确授权。缺少该授权时保留原任务成功交付和入库事实，但暂停下一条 route。存在治理缺口时，修复必须加入或收紧能够拒绝本次旧错误的持久反例/mutant，并通过受影响仓库该层的现役检查和唯一 CHANGE 质量入口；不得新增第二 verdict、第二台账或旁路检查器。若四层均核查充分，且证据证明该事件不存在可合理预防或提前拦截的治理缺口，则以四层核查证据和已验证的运行修复或恢复证据闭合，不为凑流程强改治理文件。除此以外，只有旧错误已在最早应负责的层被确定性拒绝，后置 `WHY-HAPPEN` 才算闭合。

## 9. Dynamic Proof 交接

本 Skill 不写质量 verdict。只有网站现役 `xuanxue-dynamic-proof` 的引用文件、命令、schema、journey registry 和声明分母全部与代码一致时，才能把 evidence handoff 给唯一 Dynamic Proof Controller；否则返回 `DYNAMIC_PROOF_DEPENDENCY_DRIFT`。

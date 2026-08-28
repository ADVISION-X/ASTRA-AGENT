# 故障定责、重构、清理与复跑

## 1. 先冻结现场

首次故障立即停止发布下一任务。固化 job/source/request、attempt、lease/fence、最后完成的 step checkpoint、Outbox、Browser mutation/WAL、Target/Document、网站 terminal/consumer 以及双仓日志源。不要先删任务、重启链路、关闭 GPT 页面或打开新页面。

按 mutation 状态分流：

- 无 mutation、`PREPARED` 或 dispatch 前 `FAILED`：确认没有外部动作后，只处置当前 attempt，并由正式任务 Owner 根据 checkpoint 与冻结业务合同决定 `recovery_pending`、`review_required` 或业务终态；不得把 attempt failure 自动提升为永久业务失败。
- `DISPATCHED`：只在原 Target/Document 上按冻结正反后置条件做只读对账；禁止重发、刷新、关闭/重建 Target、重启链路或 selector 广扫。观察次数受现役 Owner 的有限预算约束，最迟不得超过任务冻结的 `delivery_deadline_at`；到期只结束当前观察/attempt，由正式任务 Owner 结合 mutation 和外部副作用事实裁决业务任务，不由页面适配器自行永久终结。
- `CONFIRMED` 或 `REJECTED`：尊重既有事实，不再次执行同一动作。
- 尚未到 Browser 层：记录 `BROWSER_NOT_REACHED`；不得为了“实证”额外发送 GPT/Browser 动作。

只在旧 mutation 已明确终结、旧任务安全收口后，才能选择新的 production diagnostic job 或下文受控 Codex Chrome 人工复现。前者属于新的生产 QA 动作并消耗生产预算；后者不是 job，不得写入生产成功链。

恢复或重启前必须联合读取最后 step checkpoint、Browser WAL 和当前 Document。checkpoint 至少包含 `flow version + step index + input hash + proof + mutation state + canonical document identity`；三者不一致时先观察或对账，只有第一个尚未完成、没有已派发副作用且仍获授权的动作可以继续。不得从头重放整轮，也不得仅因所有 attempt 都标记失败就永久终结业务任务。

只读观察本身不改变 WAL、job 或 recovery 状态，也不能补造缺失的 provider receipt。只有现役 Browser reconciliation Owner 能按当前合同生成独立 reconciliation record 并执行单调转换：正向后置条件成立则确认既有 mutation 并恢复原 job；反向成立则拒绝当前 mutation 并结束本 attempt；无法判断则在 `delivery_deadline_at` 到期后生成 typed attempt/recovery outcome 并停止观察。后两者都交给正式任务 Owner 依据冻结业务合同裁决，不自动写永久业务终态。不得用全新 job 代替正向确认后的原 job 恢复。Owner、正式 API/命令或消费链未接通时返回 `DISPATCHED_RECONCILIATION_OWNER_UNAVAILABLE`，禁止清理 Target、创建 diagnostic job 或复跑。

## 2. Browser 与 Chrome 原子实证

### 2.1 名称和正常生产边界

- GrassEye Chrome 扩展：Browser Authority 管辖下的生产物理执行适配器；不等于 Authority。
- Browser Authority：唯一生产 Target/Document、动作许可、mutation WAL、后置条件和 reconciliation Owner。
- Codex Chrome：操作者 Chrome 的诊断能力；不属于 AGENT 生产链，不写 WAL、receipt、checkpoint、网站 terminal 或业务结果。

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

只允许在以下条件全部成立后，由用户对确切 `product_id/action_id` 和 GPT 页面动作重新显式授权：旧任务已 typed terminal；mutation/WAL 无未决项；原生产 Target/Document 已按 Owner 合同释放；lease、lane、Outbox 和 recovery 全部闭合；AGENT 已停止且不会重新认领页面；没有待核外部副作用。

每次授权只允许一个专用诊断 tab、一次从同一冻结输入开始到失败 action 为止的最小前缀，以及每个原子 UI mutation 最多一次。禁止重试、刷新、广扫 selector 或继续执行失败 action 之后的业务步骤。只有失败 action 本身必须发送 GPT 输入且用户同时授权该 provider 副作用时才可发送；否则在发送前停止。

Codex Chrome 必须记录诊断 tab/Document 身份、冻结输入 hash、页面认证和新鲜度、hydration/节点替换、候选计数、动作前后状态及 console/DevTools 事实。它不得创建网站任务、调用内部 job API、写生产 WAL/receipt/checkpoint/terminal，或把人工结果冒充生产复跑、网站成功、发布、通知或支付证据。

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

沿真实链逐段定位唯一语义 Owner：网站正式 sender -> API/contract/store -> claim/session/lease/fence -> AGENT route/plugin -> GPT child/Browser mutation -> checkpoint/Outbox -> 网站 terminal/consumer/domain -> 用户页面。

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
- Runtime 状态机/性质测试必须证明每个安全原子步骤先 checkpoint 后推进，重启联合消费 checkpoint、Browser WAL 与当前 Document，已派发 upload/submit/media download 不整轮重放，attempt 全失败不自动写永久业务终态；
- Browser 故障的跨 attempt 身份稳定、`DISPATCHED` 不重放、原 Target/Document 对账、未知结果阻止新 mutation；
- 合同变化时双仓 provider/dependency 投影一致；
- 实际 Owner 的聚焦验收，以及两个仓库分别按本仓唯一命令执行的 `quality:check CHANGE`。

这些只证明 CHANGE。代码修改后的真实复跑必须绑定更新后的 debug candidate，并证明运行实例已重新加载这些字节；本地真实系统允许运行未提交的工作树快照。只有声称外部已部署结果时才必须读回对应部署工件，不得用本地修改冒充远端生产结果。

## 6. 安全清理旧任务

保留 job、event、failure、receipt、mutation 和最小脱敏审计事实。将失败任务置于 typed terminal，释放 lease/fence，确认 Outbox 无待处理项，并通过正式 Owner 清理任务私有 Target、临时下载、孤立输出对象或受 retention/privacy 合同允许清理的材料。

普通用户页面不得展示管理员 QA 数据。“用户侧无残留”不等于数据库无事实。不得直接 SQL 硬删、级联删除、覆盖、复活或复制失败任务；没有正式清理 API/Owner 时返回 `CLEANUP_OWNER_ABSENT`，要求抹除不可变事实时返回 `UNSUPPORTED_BY_ACTIVE_LAW`。

## 7. 全新任务复跑

使用新的 `job_id`、`source_task_id` 和 `idempotency_key`，从同一个正式产品入口完整重跑；不得复活旧任务。成功必须再次闭合网站终态、领域消费、真实用户页面、Target/临时产物和 Outbox。

默认只允许一次修复后生产复跑。同一根因再次出现、仍有 `DISPATCHED`、外部副作用未知、清理不完整、候选漂移或认证/风控介入时停止创建和发送新的生产 QA 动作。只要旧任务已 terminal 且 mutation、Target、lease、lane、Outbox 和 recovery 全部闭合，就继续第 2—5 节允许的 Chrome 诊断、本地复现、代码修复和聚焦测试；不得把生产复跑预算耗尽解释成调试结束。

## 8. 后置 WHY-HAPPEN

只有第 7 节已经证明原故障在更新后的 debug candidate 上真实解决，才追查它为什么逃过现役治理。真实复跑仍失败时回到运行根因和代码片区，不修改法案、施工图或质检系统。

用已经确认的故障根因和修复事实依次核对：

1. active law 是否缺少、歧义或矛盾了本应约束该故障的生产不变量；
2. blueprint 是否缺少对应 Owner、状态转换、物理动作许可、证据、失败状态或后置条件；
3. quality system 是否缺少静态检查、聚焦验收、反例或 mutant，或者检查存在却不能拒绝旧错误；
4. 唯一质量入口是否没有执行、没有覆盖或没有把已有检查纳入现役分母。

逐层检查，但只修改证明确有缺口的层。现役法案和施工图已经清楚时不得为了记录事故而改写；规则和检查都存在但没有运行时，只修唯一入口或覆盖关系；属于治理无法合理预防的外部运行事件时，不制造法案条款，只在已证明需要时修复诊断、恢复或观测能力。

修改冻结 active law 或 blueprint 仍须用户另行明确授权。缺少该授权时保留复跑成功事实，但暂停下一条 route。存在治理缺口时，修复必须加入或收紧能够拒绝本次旧错误的持久反例/mutant，并通过受影响仓库该层的现役检查和唯一 CHANGE 质量入口；不得新增第二 verdict、第二台账或旁路检查器。若四层均核查充分，且证据证明该事件不存在可合理预防或提前拦截的治理缺口，则以四层核查证据和已验证的运行修复或恢复证据闭合，不为凑流程强改治理文件。除此以外，只有旧错误已在最早应负责的层被确定性拒绝，后置 `WHY-HAPPEN` 才算闭合。

## 9. Dynamic Proof 交接

本 Skill 不写质量 verdict。只有网站现役 `xuanxue-dynamic-proof` 的引用文件、命令、schema、journey registry 和声明分母全部与代码一致时，才能把 evidence handoff 给唯一 Dynamic Proof Controller；否则返回 `DYNAMIC_PROOF_DEPENDENCY_DRIFT`。

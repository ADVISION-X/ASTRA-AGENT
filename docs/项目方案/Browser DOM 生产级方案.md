# Browser DOM 生产级方案

> 状态：项目方案，不是现役法案，不是实施完成证明，不是 READY，也不是 RELEASE。
>
> 取证日期：2026-09-02（Asia/Dubai）
>
> 本文只固化当前代码、当前工作区权威材料、项目 Chrome 插件启动结果和真实 ChatGPT 页面实证。本文没有修改生产代码、法案、蓝图、数据库或浏览器业务状态。

## 一、先说结论

当前 Browser DOM 完全达不到生产级。

问题不只是“有几个选择器过期”，而是 Browser DOM 还没有成为一个能稳定回答下面五个问题的生产底座：

1. 我看到的是不是当前 Target、当前 Document、当前页面状态？
2. 这个节点到底是存在、已渲染、可读取，还是可操作？
3. 页面正在重绘、动画、挂载、卸载时，失败属于暂时状态还是基础设施故障？
4. 一次点击到底有没有发出去，能不能安全重试？
5. 上层 GPT 子能力失败后，日志能不能保留 Browser 的原始原因，而不是只剩一个笼统错误？

当前实现把“能够取得 box model”近似当成“可见”，把部分正常的页面过渡误判为致命 DOM 故障；多个查询又不是同一份页面快照。结果就是：上传附件的页面正在切换状态时，Browser DOM 报错，GPT 子能力失败并释放执行权，调度器才有机会去跑下一单。表面看像“下一单打断了上传”，实际第一断点在 Browser DOM。

本方案的终态不是再造一个调度器，也不是新增第二套 DOM 读取器。终态只有一条责任链：

| 层级 | 唯一责任 |
|---|---|
| local-browser-session / Browser Authority | 当前 Target、Document 生命周期、DOM 物理事实、一次物理动作、动作是否已派发、原始失败原因 |
| GPT capability group | ChatGPT 页面语义、私有选择器、20 个页面 Child 的前置条件、后置条件、有限等待和恢复 |
| GPT continuation controller | 6 个续接状态 Child；不读取 DOM |
| Product | 订单业务顺序、产品流程、是否继续下一步 |
| Runtime / Website | 承接结构化结果、恢复和最终业务入库 |

Browser DOM 不负责“下一单什么时候开始”，但它必须保证：页面处于正常过渡时不把当前 Child 错杀；动作结果未知时不允许盲目重放；真正失败时给出可以裁决的原始事实。

## 二、范围和不可越界项

### 2.1 本方案覆盖什么

- 现役 GPT capability group 的全部 26 个子能力。
- 其中 20 个页面 Child 对 Browser DOM 的信息需求。
- 其中 6 个续接状态 Child 为什么不得进入 Browser DOM。
- 当前 Browser DOM 物理事实模型、快照、可读性、可操作性、错误分类、日志和动态实证。
- 当前真实 ChatGPT 页面与现役选择器的差距。

### 2.2 本方案明确不做什么

- 不在 Browser 层编排“新建会话、上传、发消息、等结果、开分支”等 Product Flow。
- 不在 Browser 层理解“GPT-5.6 Sol”“能力”“从电脑上传”等页面业务语义。
- 不新增第二个 Browser Owner、第二条 Chrome 控制通道或第二套 DOM 读取器。
- 不建立通用选择器 DSL、全局选择器注册中心、兼容桥、双读双写或 fallback 链。
- 不新增数据库、队列、账本、服务或独立调度器。
- 不把普通单元测试、控制浏览器观察或健康检查当成生产完成。
- 不修改现役法案和蓝图；它们如需变更，必须另行明确授权。

## 三、本次真实 Chrome 实证

### 3.1 到达的证据层

本次已执行项目原生启动入口 npm run grasseye:start，项目 Chrome 扩展完成认证和配对，启动日志到达 STARTUP_READY。

健康状态显示：

- Browser Authority：present。
- 当前 governed target：absent。
- Browser lane：idle。
- Cloud transport：不可用，连接被拒绝。

因此，本次证据分成两层：

1. 项目扩展层：证明扩展能够启动、配对，Browser Authority 存在。
2. 同一已登录 Chrome 的真实 ChatGPT 页面层：证明当前页面 DOM 结构和现役选择器的真实匹配情况。

由于没有网站下发的真实 exact-target 任务，不能把本次观察冒充成 AGENT 全链路生产通过。生产验收必须再补一轮“网站订单 → exact target → 20 个页面 Child → Website 成功承接”的动态证明。

### 3.2 真实页面观察结果

| 场景 | 真实观察 | 对当前实现的判定 |
|---|---|---|
| 新会话输入框 | #prompt-textarea 唯一、可编辑 | 当前选择器有效 |
| 空草稿发送按钮 | 空草稿时不存在；写入探针后唯一出现，aria-disabled=false；清空后消失 | 不能把“发送按钮不存在”一律当故障，必须结合草稿状态 |
| 附件总控 | button#composer-plus-btn 唯一，aria-expanded 可读 | 当前选择器有效 |
| 文件输入框 | #upload-files 唯一、type=file、multiple=true、零尺寸隐藏 | 隐藏是合法状态，不能用普通“可见节点”规则寻找 |
| 上传菜单叶子 | 精确文字“从电脑上传”当前唯一，但全局 span 选择器同时命中大量侧栏节点 | 当前选择器靠文字碰巧收敛，不具备生产级作用域 |
| 执行配置入口 | 当前匹配唯一，文字为 Pro | 当前结构有效，但仍是易漂移私有合同 |
| 执行配置弹层 | simple panel、模型入口、能力控制和推理 slider 均存在 | 当前结构有效 |
| 推理 slider | min=0、max=4、now=4，且 aria-hidden=true | “aria-hidden”不能简单等价为整个控件不可用，必须按 Child 的结构合同裁决 |
| 模型高级面板 | 两个 radio：GPT-5.6 Sol 已选，GPT-5.5 未选 | 当前模型选择结构有效 |
| 弹层动画 | 弹层打开过程中 opacity 曾约为 0.457，随后为 1 | box 存在不等于页面稳定可操作 |
| 新会话 hydration | 页面标题已经是新会话时，旧 user turn 曾短暂留在 DOM，数秒后消失 | 仅凭节点存在会读到过渡残影 |
| 历史会话 | 6 个 turn 正常存在，屏幕上方的旧 turn 仍有 box，坐标为负值 | 屏幕外不等于无效；读取历史 turn 不能要求在 viewport 内 |
| 文本回答 | assistant turn 内存在 data-message-author-role=assistant | 当前文本路径有效 |
| 图片回答 | 外层 assistant turn 存在，但内层 assistant role 不存在 | 文字和图片不能共用同一个内层根 |
| 图片节点 | 同一回答有 3 个原始 img；只有 1 个带有效 alt，另 2 个为空 alt 且内容重复 | 必须保留现役语义图片过滤和内容哈希去重 |
| 分支会话 | 现役 branch-conversation-button 命中 0 | 当前合同已失效 |
| 分支真实入口 | “更多操作”菜单中存在“打开新分支” | 当前 UI 需要两次物理动作；与现役 Child 的“一次物理 mutation”合同冲突 |
| 频率限制弹窗 | 本次未出现 | 不得声称已验证 |
| 附件 ready / spinner | 本次未实际上传用户文件 | 不得声称已验证 |

本次只写入并清除了一个无害草稿探针，没有发送消息、没有上传文件、没有点击“打开新分支”。

## 四、现役 Browser DOM 的根本缺口

### 4.1 一个 visible 混掉了四种完全不同的事实

当前 dom-query-runtime 的核心判断是能否取得 DOM.getBoxModel。这个判断最多只能说明节点此刻有布局盒，不能同时证明：

- 节点仍连接在当前 Document。
- CSS display、visibility、opacity 允许显示。
- 节点没有处于 inert、hidden 或过渡态。
- 节点在 viewport 内。
- 节点没有被遮挡。
- 节点可点击、可输入或可读取。

生产级必须拆成四个机械事实：

| 事实 | 含义 | 是否要求在 viewport 内 |
|---|---|---|
| connected | 节点仍属于本次 Document | 否 |
| rendered | 有布局且样式没有隐藏 | 否 |
| readable | 在指定语义作用域内，可以稳定读取 | 否 |
| actionable | 已渲染、已启用、在 viewport 内、命中测试通过且没有被遮挡 | 是 |

历史会话 turn 可以 readable，但不一定 actionable；隐藏 file input 可以 connected，但不 rendered，却仍可由专用文件注入动作使用。不同动作必须消费明确的物理事实，不能继续共用一个模糊 visible。

### 4.2 connected 当前是伪事实

当前静态属性读取把 connected 固定返回 true，并没有读取真实 Node.isConnected。页面重绘时，旧 nodeId 很可能已经脱离 Document，这会让上层看到虚假的“仍连接”。

### 4.3 disabled 只读 HTML disabled

当前只检查 disabled，没有统一读取 aria-disabled。真实 GPT 发送按钮使用 aria-disabled 表达部分状态，生产判断会漏掉不可操作状态。

### 4.4 多次 find / read 不是同一份页面快照

一个 Child 会先找节点、再读文字、再读属性、再读 outerHTML。ChatGPT 是持续重绘页面，四次调用之间可能已经跨过一次挂载、卸载或路由变化。当前结果可能把两个不同 Document 时刻拼成一个不存在的“事实”。

### 4.5 正常 no-layout 被错误升级

当前只把两条精确英文错误当作 no-layout：

- Could not compute box model
- Node does not have a layout object

CDP 错误文字、阶段或包装一旦变化，其余错误就被统一升级为 BROWSER_DOM_READ_INVALID。附件 ready 图标在加载阶段正好会经历“节点存在但暂时没有布局”的状态，这本应是“当前未渲染，继续在 Child 时限内观察”，不是基础设施致命故障。

### 4.6 语义文字会吸入视觉隐藏内容

当前 semantic text 会过滤 hidden、aria-hidden 和少数标签，但不计算 display:none、visibility:hidden、opacity:0、inert 和过渡状态。得到的文字不一定是用户当前实际看到的内容。

### 4.7 日志丢掉了真正原因

Browser 首次报错时 Owner 是 browser-session；错误传到 GPT Child 后，责任 Owner 被改写为 gpt，且没有可靠 causedBy 链。runtimeFailureFromError 又没有保留 DOM/CDP 的稳定原始原因。

结果是只能看到 BROWSER_DOM_READ_INVALID，无法回答失败发生在：

- 取得 Document；
- querySelectorAll；
- 作用域收敛；
- describe node；
- computed style；
- box model；
- 读属性；
- 动作派发；
- 动作后确认；
- 或页面已经换了 Document。

### 4.8 当前分支会话不是“偶发不稳定”，是合同已失效

现役选择器要求 assistant turn 下存在 branch-conversation-button，真实页面命中为 0。当前真实入口需要先打开“更多操作”，再点击“打开新分支”。

这不能靠 Browser 层偷偷封装成一个组合动作，因为那会把 GPT 页面语义和两步 Product 行为塞进 Browser Owner；也不能加一个旧选择器失败后走新选择器的 fallback。

在实施前必须做一个权威决定：

1. 找到并证明当前页面仍存在可一次派发的机器接口；或
2. 单独授权修改 GPT Child 合同及对应现役法案，把分支动作合法改成明确的两步可恢复协议。

在这个决定完成前，fork_exact_gpt_conversation_at_checkpoint 必须判定为生产阻断项。

## 五、26 个子能力需要的 DOM 信息清单

### 5.1 20 个页面 Child

| # | Child | 必须取得的信息 | 当前实证与生产判定 |
|---:|---|---|---|
| 1 | prepare_clean_gpt_chat | 当前 URL、全新 Document、唯一 composer、草稿为空、附件区为空、当前会话 user turn 为零、stop 不存在 | 新会话出现过旧 turn hydration 残影；必须有 Document epoch 和稳定窗口。失败 |
| 2 | focus_exact_gpt_conversation | exact URL、导航后的新 Document、目标 route 已稳定 | 历史会话需要异步 hydration；仅 URL 到达不够。部分成立 |
| 3 | verify_gpt_conversation_identity | canonical URL、唯一 marker user turn、prompt body hash、相邻 assistant、目标 turn id | 真实文本会话结构成立；当前多命令不是同一快照。部分成立 |
| 4 | open_gpt_execution_profile | 唯一 profile trigger、actionable、popup 打开后的结构和 expanded 状态 | 当前选择器命中；动画期 opacity 非 1。部分成立 |
| 5 | open_gpt_model_selector_v2 | 当前 profile popup、唯一模型入口、advanced panel 打开、simple panel 状态切换 | 当前真实结构命中。页面合同有效但仍需原子快照 |
| 6 | select_exact_gpt_model_v2 | 精确模型 radio、aria-checked、一次点击前后选择状态、面板回读 | GPT-5.6 Sol / GPT-5.5 真实命中；未执行切换。未完成动态证明 |
| 7 | ensure_exact_gpt_reasoning_tier | 能力控件、slider min/max/now、目标档位、动作后精确回读 | 当前 min=0、max=4、now=4；未执行修改。未完成动态证明 |
| 8 | close_gpt_execution_profile | 当前 popup、trigger expanded、关闭后 popup 不存在且 Document 未换 | 打开态已观察，未以 AGENT Child 完成关闭证明。未完成 |
| 9 | open_gpt_attachment_control | composer-local plus control、展开状态、active upload menu root、精确上传叶子 | 叶子现在靠全局 span + 中文精确文字收敛，作用域不合格。失败 |
| 10 | attach_approved_gpt_files_once | exact composer 的唯一 file input、type=file、multiple、批准文件集合、动作是否已派发 | file input 真实存在；本次未上传。历史运行证明动作可以派发，但非完整生产证据 |
| 11 | reconcile_gpt_attachment_set | composer-local attachment region、每个附件 item 的 provider 名称、ready 图标、spinner、数量和集合一致 | 当前正是在此处出现 BROWSER_DOM_READ_INVALID；no-layout 被错杀。失败 |
| 12 | write_exact_gpt_prompt | 唯一 composer、写前为空或已是同一 prompt、写后 marker 和全文精确回读 | 无害探针写入、回读、清除成功；尚非 AGENT exact-target 动态证明 |
| 13 | reconcile_gpt_draft | composer hash、marker、唯一 enabled send、附件集合 ready、stop 不存在 | composer/send 真实变化成立；附件状态未验证。部分成立 |
| 14 | submit_exact_gpt_turn_once | 目标 user turn 尚不存在、草稿精确、send actionable、派发一次、动作是否已发出 | 本次没有提交；必须使用 dispatch boundary，不能盲重试。未验证 |
| 15 | reconcile_gpt_turn_submission | canonical URL、marker user turn、prompt hash、唯一 turn id、composer 已清空 | 历史会话结构支持定位；当前快照原子性不足。部分成立 |
| 16 | wait_for_stable_gpt_text | exact user turn、相邻 text assistant、stop 不存在、连续稳定 hash、频率限制弹窗 | 文本 assistant 结构命中；rate-limit 未出现。部分成立 |
| 17 | checkpoint_gpt_text_response | exact assistant turn id、同一快照的 raw DOM、semantic text、内容 hash、来源 prompt hash | 真实结构成立；隐藏文字过滤和同快照保证不足。失败 |
| 18 | wait_for_stable_gpt_image | exact outer assistant、stop 不存在、语义图片唯一、authenticated media、内容 hash 稳定 | 真实页面 3 个 raw img 只应留下 1 个语义图片，证明去重必要；全链路未验证 |
| 19 | checkpoint_gpt_generated_image | exact outer assistant、来源 prompt hash、认证字节、内容 hash、转换结果 | 页面结构已观察；认证下载和 checkpoint 全链路未验证 |
| 20 | fork_exact_gpt_conversation_at_checkpoint | source URL、exact user/assistant/hash、唯一 fork 动作、子会话 URL 和 identity 回读 | 现役按钮命中 0，真实 UI 是两步；与“一次物理 mutation”冲突。生产阻断 |

### 5.2 6 个续接状态 Child

| # | Child | 所需事实 | Browser DOM 边界 |
|---:|---|---|---|
| 21 | persist_gpt_continuation | provider、checkpoint、原任务身份、续接状态 | 不需要 DOM，归 GPT continuation store |
| 22 | reserve_exact_gpt_continuation_once | 唯一 reservation、幂等身份、状态 CAS | 不需要 DOM |
| 23 | complete_exact_gpt_continuation_reservation_once | reservation 身份、完成状态、结果绑定 | 不需要 DOM |
| 24 | acquire_gpt_continuation_lane | lane owner、lease、原任务身份 | 不需要 DOM |
| 25 | advance_gpt_continuation_lane | 当前 checkpoint、下一个合法状态、CAS | 不需要 DOM |
| 26 | release_gpt_continuation_lane | lane owner、终态或释放原因 | 不需要 DOM |

结论：所谓“26 个子能力都需要 Browser DOM”并不准确。20 个页面 Child 消费 Browser DOM；6 个续接 Child 消费持久状态。把 6 个续接 Child 也塞进 Browser，会形成第二调度 Owner。

## 六、生产级 Browser DOM 终态

### 6.1 一个引擎、一个 Target、一个 Document epoch

继续使用现役 local-browser-session / Browser Authority，不新建服务。

每个 DOM 命令必须绑定：

- exact target identity；
- CDP session identity；
- navigation / loader identity；
- Document root identity；
- 命令开始和结束时一致的 documentEpochHash；
- Browser release/build identity。

命令开始取得 Document，命令结束再次核对 epoch。只要 epoch 已变化，这次读取就不能拼装成成功结果，应返回 DOCUMENT_CHANGED，并由 GPT Child 在自己的有限时限内重新观察。

### 6.2 一次命令返回一份观察快照

Browser DOM 的最小生产单位不再是“找到一个 nodeId”，而是一份同一 epoch 的机械观察：

| 字段 | 含义 |
|---|---|
| documentEpochHash | 本次事实属于哪个 Document |
| scopeCandidateCount | 原始作用域候选数 |
| scopeEligibleCount | 合法作用域候选数 |
| candidateCount | 原始节点候选数 |
| eligibleCount | 符合本次物理策略的节点数 |
| exclusionCounts | 因 disconnected、no-layout、style-hidden、inert、disabled、offscreen、occluded 被排除的数量 |
| nodeFacts | connected、rendered、readable、actionable、属性和文字的机械值 |
| operationStage | 失败发生在哪一个物理阶段 |
| dispatchState | NOT_DISPATCHED、DISPATCHED、CONFIRMED、OUTCOME_UNKNOWN |

日志中不得写 selector、prompt、对话文本、文件路径或 DOM 原文；只写计数、阶段、稳定错误码、哈希和因果事件 ID。

### 6.3 固定三种物理策略，不建通用 DSL

只增加真实消费者需要的三种固定策略：

1. READABLE：允许屏幕外历史 turn，但必须 connected、rendered、在精确语义作用域内。
2. ACTIONABLE：必须 connected、rendered、enabled、非 inert、在 viewport 内，并通过命中测试。
3. FILE_INPUT_TARGET：允许隐藏 input，但必须 connected、属于 exact composer、type=file，且动作走现役文件授权和 DOM.setFileInputFiles。

GPT Child 选择所需策略并提供私有 selector 和作用域；Browser 只执行机械判断，不理解 ChatGPT 业务文字。

### 6.4 唯一节点状态判定

DOM 查询和 authenticated media 必须复用同一套 Browser 物理节点判定，至少统一：

- Node.isConnected；
- layout 是否存在；
- display；
- visibility；
- opacity；
- hidden；
- inert；
- disabled；
- aria-disabled；
- viewport 交集；
- 可操作节点中心点 hit-test；
- 当前 Document epoch。

图片路径现有的 complete、naturalWidth、naturalHeight、有效 alt、认证来源和内容哈希去重继续保留。这里只消除两套物理“可见”定义，不把媒体业务规则泛化到普通 DOM。

### 6.5 no-layout、stale 和 invalid 必须分开

| 错误 | 含义 | 是否可在 Child 时限内重新观察 |
|---|---|---|
| BROWSER_DOM_NOT_FOUND | 当前快照没有候选 | 可以，由 GPT Child 决定 |
| BROWSER_DOM_NOT_RENDERED | 候选存在但当前无布局或样式隐藏 | 可以 |
| BROWSER_DOM_NODE_STALE | 节点在读取过程中脱离当前 Document | 可以，必须重新 query |
| BROWSER_DOM_DOCUMENT_CHANGED | 命令前后 Document epoch 不同 | 可以，必须从新 Document 开始 |
| BROWSER_DOM_AMBIGUOUS | 合法候选不唯一 | 不可盲点，Child 失败并报告 |
| BROWSER_DOM_NOT_ACTIONABLE | 已渲染但禁用、屏幕外或被遮挡 | 只能由 Child 有界等待，不得直接点击 |
| BROWSER_DOM_PAYLOAD_INVALID | 调用合同或 CDP 返回结构非法 | Browser 基础设施失败 |
| BROWSER_DOM_PROTOCOL_FAILED | CDP 调用失败，带稳定 nativeCause | Browser 基础设施失败 |
| BROWSER_DOM_ACTION_OUTCOME_UNKNOWN | 动作可能已发出，但后置条件无法确认 | 禁止重放，先读回 |

不再依赖两条英文错误文本判断 no-layout。应按 CDP 阶段、错误类型和节点再次连接性检查分类，同时保留经过脱敏的 nativeCauseCode。

### 6.6 动作派发边界

每个物理 mutation 必须严格经过：

1. 同一 epoch 的前置条件快照；
2. 唯一 ACTIONABLE 候选；
3. 写入现役 Browser WAL / action intent；
4. 派发一次；
5. 立即把 dispatchState 置为 DISPATCHED；
6. 通过新快照读取后置条件；
7. 只有后置条件成立才能 CONFIRMED；
8. 已 DISPATCHED 但无法确认时返回 OUTCOME_UNKNOWN，禁止再次点击或再次提交。

页面重绘只允许发生在派发前的重新观察；一旦动作可能发出，就必须先读回真实页面状态。

### 6.7 作用域必须由 GPT Child 精确给出

Browser 不允许继续在整页范围查找有业务含义的中文文字。

GPT 私有合同至少要把节点约束到：

- exact composer；
- 当前 active profile popup；
- 当前 advanced model panel；
- exact user turn；
- 与该 user turn 相邻的 exact assistant turn；
- exact attachment region；
- 当前 active upload menu root。

真实页面上，附件菜单暂时没有从控制按钮暴露稳定 aria-controls，也没有明显稳定 testid。实施前必须在当前 Chrome 版本上找到并冻结一个可以机器验证的 active menu root；找不到就明确失败，不能退回全局文字匹配。

### 6.8 Browser 原因不能在上层丢失

Browser 首发失败事件必须保留：

- responsibleOwner=browser-session；
- operationStage；
- stableErrorCode；
- nativeCauseCode；
- exact target / document / command hash；
- dispatched state；
- causedByEventId。

GPT Child 可以增加自己的语义失败事件，但只能通过 causedByEventId 引用 Browser 事件，不能把 Browser Owner 覆盖成 gpt。Runtime 和 Website 必须原样传播这条因果链。

## 七、20 个页面 Child 的整改规则

### 7.1 会话和身份

- 新会话不能只看 URL 和 heading；必须等待当前 Document epoch 稳定，并确认当前会话作用域内不存在 user turn、草稿和附件。
- 历史会话允许读取 viewport 外的 turn；不能用“在屏幕内”过滤历史消息。
- marker、prompt body、assistant 必须在同一个会话根、同一个 Document epoch 内收敛。
- 每个 turn identity 使用现役 data-testid / data-turn 和内容 hash 的联合事实，不能只靠顺序。

### 7.2 配置、模型和推理档位

- popup 动画期即使有 box，也不能立即判为 actionable。
- simple panel 和 advanced panel 必须一活一死；inert、opacity、expanded 和 radio checked 一起回读。
- 模型选择只能按 GPT 私有精确合同匹配，不允许 Browser 解释模型名称。
- 推理 slider 的 aria-hidden 需要由 GPT 页面结构合同解释；Browser 只返回真实属性和物理状态。

### 7.3 附件

- 隐藏 file input 走 FILE_INPUT_TARGET，不经过普通可见查询。
- 上传菜单叶子必须处于 active composer 对应的 menu root 中。
- attachment item、ready icon、spinner 必须处于 exact composer 的 attachment region。
- ready icon 暂时 no-layout、spinner 仍存在或附件数量未收敛，均是 WAIT，不是 Browser 基础设施致命失败。
- 附件集合以 provider 回显名称和批准文件集合做精确对照；不能只数卡片。
- DOM.setFileInputFiles 已派发后，不允许因为回读超时再次上传；必须先 reconcile 页面附件集合。

### 7.4 草稿和提交

- composer 为空、精确等于目标 prompt、或含其他内容，三种状态必须分开。
- send 不存在可能只是空草稿；send 存在但 aria-disabled=true 是不可操作；不能归成同一错误。
- submit 动作派发后，以 exact user turn、prompt hash、composer 清空和 canonical URL 回读。
- 回读未知时进入 OUTCOME_UNKNOWN，严禁再次点击 send。

### 7.5 文本回答

- exact user turn 的相邻 assistant 必须在同一 epoch。
- stop 不存在只能说明当前没有显式 stop 控件，仍需连续稳定内容 hash。
- raw DOM 和 semantic text 必须来自同一 assistant、同一 epoch。
- semantic text 必须排除物理隐藏、inert 和过渡残影。
- rate-limit 不能只用整页宽泛 role=dialog；必须补真实弹窗结构实证并冻结 GPT 私有合同。

### 7.6 图片回答

- 使用 outer assistant turn，不要求内层 data-message-author-role=assistant。
- 同一回答的多个 img 先做连接性、完成度、尺寸、有效语义和认证来源判断，再按内容 hash 去重。
- 不能把 3 个原始 img 当 3 张生成图片。
- 页面节点稳定和认证字节成功是两个独立后置条件，两者都成立才能 checkpoint。

### 7.7 分支会话

- 当前选择器立即列为失效，不加 fallback。
- 在合同权威决定前，该 Child 必须 production blocked。
- 如果合同改成两步，每一步必须各自有前置条件、dispatch boundary 和后置条件；第一步已打开菜单但第二步未点击时，必须能够安全重新观察。
- 如果找到一次派发的现役机器入口，则保留“一次 mutation”合同并用真实 Chrome 证明。

## 八、实施切片

### 切片 0：先冻结两个合同决定

在写生产代码前先完成：

1. 当前附件 active upload menu root 的稳定机器作用域。
2. 分支会话究竟保留一次 mutation，还是另行授权改成两步协议。

任一没有答案，对应 Child 保持生产阻断，不能用 fallback 赶工。

### 切片 1：重建 Browser 物理事实

优先在现役 Browser Owner 内完成：

- 真实 connected；
- rendered / readable / actionable / file-input-target；
- computed style、inert、aria-disabled、viewport、hit-test；
- documentEpochHash；
- 单命令快照；
- no-layout / stale / document changed / invalid 分类；
- dispatchState；
- 脱敏 nativeCauseCode；
- Browser 原始因果日志。

如果 dom-query-runtime 因完整实现超过项目单文件限制，才允许在同一 Browser Owner 下拆出一个只负责机械 node state 的相邻内部模块。它不得成为新接口、新服务或第二 Reader。

### 切片 2：逐个迁移 20 个页面 Child

顺序按真实风险：

1. reconcile_gpt_attachment_set；
2. open_gpt_attachment_control；
3. write / reconcile draft；
4. submit / reconcile submission；
5. conversation identity；
6. text checkpoint；
7. image checkpoint；
8. profile / model / reasoning；
9. prepare clean / focus；
10. fork。

每迁移一个 Child，就删除该 Child 的旧宽泛查询；不保留双路径。

### 切片 3：动态证明

先通过 Browser 物理单元和集成测试，再使用项目扩展在真实 GPT 页面逐项证明，最后使用网站真实订单走全链路。任何低一层通过都不能替代后一层。

### 切片 4：删除旧垃圾

必须删除：

- box model 等于 visible 的旧判断；
- connected 恒为 true；
- 只检查 disabled、不检查 aria-disabled 的旧分支；
- 只靠两条英文字符串识别 no-layout；
- 全页上传文字扫描；
- 已失效的 branch-conversation-button 合同；
- 上层覆盖 Browser responsibleOwner 的错误投影；
- 任何为兼容旧路径保留的 fallback 或双读。

## 九、允许影响的代码边界

以后如获实施授权，最小完整候选应限制在：

- src/lib/browser/chrome-extension/dom-query-runtime.ts；
- 同一 Browser Owner 下确有必要的相邻物理节点状态、错误和日志实现；
- src/lib/browser/exact-target/browser-dom-intent.ts，仅在返回固定物理事实确有必要时调整；
- 20 个 GPT 页面 Child 的私有 contract、selector、handler 和测试；
- Browser / GPT 对应的真实 Chrome acceptance；
- Runtime / Website 的错误投影仅在保留 causedBy 链确有必要且另行绑定范围时修改。

以下不在本方案默认实施范围：

- 6 个 continuation Child 的存储和状态机；
- Product 调度；
- Website 订单优先级；
- 新队列、新表、新服务；
- 现役法案和蓝图。

## 十、生产验收规则表

### 10.1 Browser 物理层

| 编号 | 场景 | 必须结果 |
|---:|---|---|
| B01 | 节点存在且正常渲染 | rendered=true |
| B02 | display:none | NOT_RENDERED，不是 INVALID |
| B03 | visibility:hidden / collapse | NOT_RENDERED |
| B04 | opacity=0 或动画未稳定 | 不得 actionable |
| B05 | inert | 不得 actionable，语义投影排除 |
| B06 | disabled | 不得 actionable |
| B07 | aria-disabled=true | 不得 actionable |
| B08 | 历史 turn 在 viewport 外 | 可以 readable，不得自动判失效 |
| B09 | 按钮在 viewport 外 | 不得直接点击，先由既有动作机制处理定位 |
| B10 | 节点被遮挡 | 不得 actionable |
| B11 | 节点 query 后脱离 Document | NODE_STALE，可重新观察 |
| B12 | 命令前后 Document 改变 | DOCUMENT_CHANGED，整次结果废弃 |
| B13 | ready icon 暂时无 layout | NOT_RENDERED，Child 有界等待 |
| B14 | selector 命中两个合法节点 | AMBIGUOUS，禁止任选 |
| B15 | CDP 返回非法结构 | PAYLOAD_INVALID，并保留阶段和 native cause |
| B16 | 点击前页面重绘 | 未派发，可重新观察 |
| B17 | 点击已发出但回读失败 | OUTCOME_UNKNOWN，禁止重放 |
| B18 | 日志检查 | 不含 prompt、selector、DOM、文件路径或对话正文 |

### 10.2 真实 ChatGPT 页面

| 编号 | 场景 | 必须结果 |
|---:|---|---|
| G01 | 新会话 hydration 残影 | 不把旧 turn 当当前新会话 |
| G02 | 历史长会话 | 能读取屏幕外的目标 turn |
| G03 | profile 动画 | 动画未稳定时不点击 |
| G04 | simple / advanced model panel | 只承认一个 active panel |
| G05 | 模型已选 | 不重复点击 |
| G06 | 推理档位已正确 | 不重复 mutation |
| G07 | 附件菜单 | 只在 active composer menu root 命中上传叶子 |
| G08 | 隐藏 file input | 经专用文件动作成功设置 |
| G09 | 附件上传中 | ready 暂不可见不终止当前任务 |
| G10 | 附件完成 | provider 名称集合精确、spinner 为零、ready 全部成立 |
| G11 | 草稿为空 | send 不存在是合法页面状态 |
| G12 | 草稿完整 | send 唯一且 enabled |
| G13 | submit 已派发 | 无论回读成功与否都不重复提交 |
| G14 | 文本流式生成 | stop 消失且内容连续稳定后才 checkpoint |
| G15 | 频率限制 | 精确弹窗只确认一次，返回结构化 rate-limit |
| G16 | 图片回答 3 个 raw img | 最终只得到 1 个语义内容哈希 |
| G17 | 图片内层 assistant root 缺失 | 仍能按 outer assistant 合法处理 |
| G18 | 分支会话 | 按权威合同完成且不盲重放 |

### 10.3 全链路

必须至少使用真实网站订单覆盖：

- 12 类产品中所有会调用 GPT 页面的产品组合；
- 50 单连续到达；
- 单任务上传附件期间新订单到达；
- 文本任务、图片任务、带附件任务和需要续接的任务交错；
- 页面重绘、目标 park / reacquire、Chrome 重启、AGENT 重启；
- submit / upload / fork 动作结果未知；
- Browser 失败、GPT 语义失败、Provider 限流和 Website 承接失败。

验收结果必须证明：

1. 当前 Child 没有终态前，不会因为正常 DOM 过渡释放执行权。
2. 真正失败时，只释放故障切片需要释放的容量。
3. 已派发动作不会盲目重放。
4. Browser 原因、GPT 语义原因、Product 状态和 Website 承接状态互不覆盖。
5. 原订单身份贯穿恢复，Website 成功入库才算业务完成。

## 十一、完成定义

以下条件缺一不可：

- 20 个页面 Child 全部使用唯一 Browser DOM 物理事实，没有第二 Reader。
- 6 个续接 Child 仍由 GPT continuation controller 负责，没有被 Browser 吸收。
- 分支会话合同已由现役权威明确裁决并通过真实 Chrome。
- 附件 active menu root 已获得稳定机器作用域。
- no-layout、stale、document changed、ambiguous、invalid、outcome unknown 可以被明确区分。
- Browser 首发原因在 GPT、Runtime、Website 全链路不丢失。
- 旧宽泛路径和 fallback 已删除。
- 单元、集成、真实 Chrome、真实网站订单四层证据全部成立。
- 当前 dirty worktree 之外形成干净候选，并按项目原生 quality verdict 审核。
- RELEASE 动态证明完成，且 Website 成功承接和存储真实结果。

在这些条件满足前，只能说“局部修复”或“局部证据通过”，不能说 Browser DOM 已达到生产级。

## 十二、最终裁决

当前故障可以明确归纳为：

1. Browser DOM 的物理事实模型不完整；
2. 页面观察没有同一 Document 快照；
3. 正常过渡、节点过期和基础设施错误没有分型；
4. 日志无法保留真正的原始原因；
5. 至少一个 GPT Child——分支会话——现役合同已经与真实页面冲突；
6. 附件菜单作用域和附件 ready 状态尚未达到可生产裁决的精度。

因此，当前不能把问题简单归咎于“调度规则垃圾”，也不能假设“26 个子能力各自增强就自然解决”。生产级终态必须是：Browser DOM 先成为可靠的唯一物理底座，20 个页面 Child 再用清晰合同消费它，6 个续接 Child 留在自己的状态 Owner，Product 调度只依据这些可证明的结果推进。

这是一条责任链，不是 26 套各自为政的能力，也不是再加一层万能调度器。

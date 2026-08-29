# AGNET 迭代记录

## 2026-08-28 会议记录：GPT 页面执行过度设计与子能力重构讨论

### 会议性质

- 阶段：方案讨论，尚未形成法案、施工图或实施授权。
- 范围：12 个 Product Plugin、13 条 primary、26 条 review、39 条公开路由；重点讨论 Product Plugin、Product Skill、GPT 子能力、Browser Authority 与 GrassEye Chrome 扩展的边界。
- 基本约束：不能用本地化单一产品的页面流程替全部十二个产品做架构决定；必须先绑定完整产品分母，再删除过度设计。

### 问题一：功能迟迟没有成功，是否因为过度设计？

**用户问题**

> 现在迟迟没有成功，是不是因为过度设计？

**讨论答复**

是，过度设计是主要原因之一，但不能把必要安全边界也删掉。exact Target/Document、Browser Authority、mutation WAL、防重与提交后禁止重放是必要的。真正的问题是：

1. GPT 厂商页面操作被拆成过多公开子能力，并被重复写入每个 Product Plugin。
2. Skill、Plugin、GPT 子能力、Browser Authority、Chrome 扩展、Runtime 和网站 terminal Owner 都有各自规则，但系统没有持久化“已完成到第几个安全原子步骤”。
3. 系统用大量复杂度防止重复点击和重复提交，却没有实现失败后从最近安全断点继续。
4. 局部页面后置条件失败会被放大为整个业务任务的终态失败。

会议结论：当前系统是“安全边界有必要，但页面执行编排过度设计，而断点恢复设计不足”。

### 问题二：如果强制删除一个过度设计，最应该删哪个？

**用户问题**

> 如果现在强制删除，最应该删除的是哪个过度设计？

**初步答复**

初步判断是删除“把 GPT 厂商页面操作固化成固定公共子能力分母，再让每个 Product Plugin 重复编排这些页面步骤”这一层。

但必须保留：

- exact Target/Document；
- Browser Authority；
- mutation WAL 与 logical mutation identity；
- 每个物理动作的正反后置条件；
- 上传、提交与已提交会话的防重与对账。

不应直接删除 `FINAL_FAILED`，否则会将当前的过早终态问题变成无限重试和重复外部动作问题。

### 问题三：将十二个产品全流程纳入后，上述删除方案是否满足？

**用户问题**

> 将 12 个产品的全流程纳入进行分析，这个方案是否满足？

**全分母分析事实**

- 12 个 Product Plugin 对应 13 条 primary；本地化同时拥有报告和文章两条 primary。
- 每条 primary 各有 `accuracy_challenge` 与 `quality_reflection`，共 26 条 review，总路由数为 39。
- 当前 12 份 `gpt-flow.ts` 实际只有两种内容：fresh 模板与 fresh+continuation 模板。
- 当前候选中，fresh 模板固定包含 27 个页面步骤，continuation 模板固定包含 28 个页面步骤。
- 所有产品当前都使用 `GPT-5.6 Sol + pro_standard`；产品差异是 Prompt、材料、输出类型、会话关系、轮次编排和结果合同，不是页面点击步骤。

**十二产品覆盖结论**

| Product Plugin | primary 业务轮次 | 统一 GPT Turn 执行器覆盖 |
| --- | --- | --- |
| 八字 AI 全分析 | fresh 分析 -> 原会话续写报告 | 可覆盖，Plugin 保留两轮关系 |
| 八字命盘解读 | 单次 fresh 文本 | 可覆盖 |
| 八字报告续问 | 跨任务授权续聊 | 可覆盖，必须保留 continuation 身份和 lane |
| 合婚 AI 分析 | 甲方 fresh、乙方 fresh、从乙方会话续写综合报告 | 可覆盖，Plugin 保留人物隔离和三轮关系 |
| 合婚报告续问 | 跨任务授权续聊 | 可覆盖 |
| 本地化生产 | A、B、私有审校、selector 四个隔离 fresh turn | 可覆盖，四轮隔离由 Plugin 决定 |
| 八字分析并起名 | fresh 命盘分析 -> 原会话续写名字 | 可覆盖 |
| 根据既有八字报告起名 | 单次 fresh 文本 | 可覆盖 |
| 付款截图观察 | fresh + 图片附件 | 可覆盖，需支持获批附件 |
| 公开知识文章 | fresh 研究 -> 条件续写文章 -> 续聊生成图片 | 可覆盖，需支持提前结束与图片 checkpoint |
| 奇门专业回答 | 单次 fresh 文本 | 可覆盖 |
| 奇门报告续问 | 跨任务授权续聊 | 可覆盖 |

26 条 review 当前均是“冻结结果 + review_context -> 单次 fresh 文本输出”，可由同一 GPT Turn 执行器覆盖。

**修正后的会议结论**

1. 删除 Product Plugin 中重复的厂商页面步骤编排：满足十二个产品。
2. 删除十二个产品的业务轮次编排：不满足，会破坏合婚隔离、本地化 A/B、历史续问与文章图片流程。
3. 删除底层原子动作与 Browser WAL：不满足，会丢失防重、故障定位和页面证据。
4. 最简单完整结构：十二个产品继续拥有各自的业务流程；GPT 只拥有一套厂商页面执行与恢复状态机；Chrome 扩展只执行获准的物理动作。

### 问题四：子能力到底是什么？

**用户问题**

> 子能力到底是什么？是固定的、重复的动作吗？

**本次会议的初步定义**

子能力不应定义为“十二个产品中固定重复的一行步骤”。它应定义为：

> 一个由唯一页面元素或唯一非 DOM 状态 Owner 负责、可独立验证、可独立记账、可独立失败和恢复的稳定意图。

它可以是：

- 一次有界只读观察；或
- 一次前置核验 + 至多一次物理动作 + 一个直接后置条件。

“在多个产品中重复出现”只证明它是可复用的 GPT 页面意图，不证明它应该由每个 Product Plugin 重复排列。

当前必须通过真实 Chrome 实证回答的问题是：

1. 当前 ChatGPT 页面真正存在哪些稳定用户意图？
2. 哪些只是 selector、find、read、click 等实现细节，不应升格为公开子能力？
3. 哪些操作在提交前可安全重建，哪些在发送后只能对账？
4. 哪些动作需要独立 checkpoint，以便重启后从最近安全位置继续？
5. 文本回答、图片输出、历史续聊、附件上传和标题处理是否真的需要不同动作集？

### 下一阶段：真实 Chrome 动作分母实证

**待用户梳理的候选动作**

用户将先从真实业务角度梳理“我们认为需要的动作”。该列表只是待验候选，不直接写入法案、施工图、子能力合同或 Product Flow。

**实证方法**

对每个候选动作，必须在当次真实登录 Chrome Document 上固定：

1. 对应的用户可见意图；
2. 动作前的页面状态和唯一候选数；
3. 是否只读，或只发生一次物理变更；
4. 动作后立即可见、与本动作直接因果相关的后置条件；
5. Target/Document 是否变化；
6. 失败后是安全重建、原现场对账，还是停止新动作；
7. 需要保留的最小证据与 checkpoint。

**覆盖要求**

实证不只覆盖本地化，至少必须覆盖以下五种页面拓扑，才能反向得到十二产品的共享动作分母：

1. 单轮 fresh 文本；
2. 任务内 continuation 文本；
3. 跨任务授权 continuation；
4. 含附件的文本输入；
5. generated image 输出。

每次实证以当次实时页面为准；旧快照、fixture 或历史流程只用于对比，不能直接授权本次点击。

### 未决事项

- 用户将提供候选动作清单。
- Codex 将在获得对确切 GPT 页面动作的实证授权后，使用真实 Chrome 逐项回放并产出“动作、前置、物理变更、直接后置、恢复策略、证据”表。
- 在实证完成前，不冻结新子能力分母，不据此修改法案或施工图。

## 2026-08-28 会议续记：第一轮真实 Chrome 子能力分母实证

### 本轮边界

- 实证时间：2026-08-28 17:27—17:35（Asia/Dubai）。
- 实证对象：当前已登录的真实 Chrome / ChatGPT 页面；静态代码只用于核对十二个 Product Plugin 的消费者，不能替代页面证据。
- “整个 AGENT”在本轮特指当前生产目录内的 12 个 Product Plugin、13 条 primary、26 条 review 所共同使用的 GPT 执行面，不扩张到没有当前消费者的未来能力。
- 没有运行 READY、提交、部署、RELEASE；没有发布、通知或支付。
- AGENT 现场只读健康证明：`status=healthy`，Browser Authority `present`，Target `absent`，lane `idle`，active `0`。因此本次诊断没有与生产任务争用 Target。

### 实证一：当前模型与推理强度入口

| 原子意图 | 动作前事实 | 唯一物理动作 | 直接后置事实 | 恢复结论 |
| --- | --- | --- | --- | --- |
| 打开执行配置 | fresh 页有一个 `Pro` 入口，`aria-expanded=false` | 点击一次 `Pro` | 入口变为“思考强度”且展开；同一菜单出现“选择模型”、能力滑块、`GPT-5.6 Sol` 与 `GPT-5.5` | 点击已发送但后置查询失败时，必须先重读页面，不能把查询失败等同于点击失败 |
| 核对模型 | 菜单已打开 | 只读 | `GPT-5.6 Sol` 唯一且 `aria-checked=true` | 当前模型已满足时不应再点击模型 |
| 左移推理强度 | 滑块 `aria-valuenow=4`，标签 `Pro` | `ArrowLeft` 一次 | `aria-valuenow=3`，标签 `极高`；模型不变 | 物理动作后可用滑块值直接确认 |
| 恢复推理强度 | 滑块 `aria-valuenow=3` | `ArrowRight` 一次 | `aria-valuenow=4`，标签 `Pro`；模型仍为 `GPT-5.6 Sol` | 已恢复实证前配置 |
| 关闭执行配置 | 菜单展开 | 点击主页面空白一次 | 入口立即 `aria-expanded=false`，浮层随后从 DOM 消失 | 后置必须等待短暂收口；不能要求点击后的同一瞬间 DOM 数量立即为零 |

**实证结论**

1. 当前页面没有“高级”这一步。
2. “打开模型选择器”和“打开推理选择器”不是两个页面弹窗；当前是一份执行配置菜单。
3. 当前模型已选中时，“选择模型”是只读核对，不应制造一次多余点击。
4. 页面动作与后置观察必须分开记账：动作已经发生时，观察超时不能倒推出动作未发生。

### 实证二：附件入口、文件选择与提示词草稿

使用的非敏感测试附件：`scripts/acceptance/fixtures/code-purity-zombie-deep/commented-out-code/src/main.ts.txt`，79 bytes，SHA-256 `53aba8f598736413f2cba20a0182582016877659aa8c6174d895049fa695ffc4`。

| 原子意图 | 动作前事实 | 唯一物理动作 | 直接后置事实 | 恢复结论 |
| --- | --- | --- | --- | --- |
| 发现附件能力 | 页面有一个“添加文件等”；DOM 同时存在多个隐藏 file input | 只读 | 可见入口唯一，隐藏 input 不能仅凭存在就判为可用 | 可见语义入口是 Owner，隐藏 input 只是实现细节 |
| 错误路径复现 | 发现隐藏 `input[type=file]` | 直接点击隐藏 input | 没有产生文件选择事件，控制会话超时并重置 | 禁止把“input 存在”写成上传前置 PASS；失败后不得盲目重复 |
| 打开附件菜单 | “添加文件等” `aria-expanded=false` | 点击一次可见入口 | `aria-expanded=true`，出现“从电脑上传” | 这是当前真实的附件入口动作 |
| 上传批准文件 | 菜单中“从电脑上传”唯一 | 点击一次并响应真实 file chooser，一次设置批准文件 | 页面出现唯一 `main.ts.txt` 附件组、类型“文档”和移除按钮 | 上传动作必须以可见附件组对账，不能以 file chooser 已返回为完成 |
| 写入提示词草稿 | composer 唯一且为空；附件组唯一 | 一次 fill | 草稿精确保留探针文本，附件组仍唯一，发送按钮从禁用变为可用 | fill 后可安全只读核对；尚未点击发送 |

本轮已把非敏感附件上传到当前 ChatGPT 草稿，但尚未发送该轮消息。历史本地化报告与重启日志没有上传，避免把可能含个人信息或运行遥测的材料用于架构探针。

### 实证三：十二产品当前消费者反查

当前 12 份 `gpt-flow.ts` 的 19 个数组实例只消费 29 个页面子能力 ID；其中 12 个 fresh，7 个 continuation。静态反查得到：

1. search 三件套只有合同与 handler，没有任何 Product Flow 消费者。
2. fork 两件套只有合同与 handler，而且 handler 明确拒绝生产执行。
3. 标题四件套被模板机械附加到每一轮；标题不参与结果合同、会话身份或 continuation，continuation 使用 canonical URL + turn marker。它是当前最明确的页面编排过度设计候选。
4. rate-limit、search-dialog cleanup 和通用 transient cleanup 没有进入任何当前 Product Flow；故障识别可以保留，但不能冒充十二产品必需的正常路径子能力。
5. `recover_gpt_response_checkpoint` 已有 handler，却没有进入当前执行恢复路径；与此相反，Product Flow 的页面步骤被大量复制。这说明系统把复杂度花在了正常路径编排，重启恢复的实际消费者仍缺失。
6. 当前 executor 只在文本 response checkpoint 后写业务 step；模型、附件、草稿、提交等安全原子步骤没有可供重启定位的执行位置。

### 当前得到的最简单完整分层清单

下表是本轮实证后的**候选分母**，用于继续实测；它还不是法案或施工图定稿。

#### A. Browser Authority 边界能力，不属于 Product Plugin 页面编排

1. 绑定唯一 GPT Target。
2. 读取并验证当前 Document、origin、canonical URL 与工作区身份。
3. 为一次物理 mutation 签发许可、记录 WAL，并在结果不明时先对账。

#### B. GPT 页面正常路径子能力

1. 准备一个干净 fresh 会话。
2. 聚焦一个由 canonical URL 指定的 continuation 会话。
3. 核对 continuation 的 canonical URL + turn marker 身份。
4. 打开当前执行配置菜单。
5. 保证目标模型已选中；已满足时只读返回。
6. 保证目标推理强度已选中；每次只移动到目标值并直接读回。
7. 关闭执行配置菜单并等待稳定收口。
8. 打开当前附件菜单。
9. 一次上传全部批准且哈希不变的附件。
10. 对账“全部且仅有”批准附件。
11. 一次写入完整精确提示词。
12. 对账提示词、turn marker、附件和发送按钮可用状态。
13. 一次提交精确 GPT turn。
14. 对账唯一 user turn、composer 已清空与 canonical conversation URL。
15. 等待并对账唯一、稳定的 assistant 文本结果。
16. 持久化文本 response checkpoint。
17. 等待并对账唯一、稳定的 generated image 结果。
18. 持久化 generated image artifact checkpoint。

#### C. continuation 会话能力，不属于厂商页面点击

1. 持久化 continuation 身份。
2. 按 owner、subject、authorization 和来源 Plugin 获取独占 continuation lane。
3. 成功后推进 lane 并持久化新 turn 身份。
4. 失败或取消时释放原 lane，不伪造推进。

#### D. Runtime 恢复能力，不应伪装成 GPT 页面子能力

1. 每个安全原子步骤完成后持久化 `step index + input hash + proof + mutation state`。
2. 重启后先读取 checkpoint 和 Browser WAL，再决定观察、对账或执行下一个动作。
3. 已派发的附件上传、turn 提交和标题变更不得仅凭异常重放；必须先在原 Document 对账。

### 当前应从必需分母剔除的项目

- “高级”弹窗：当前页面不存在。
- 单独的“打开推理选择器”：当前没有第二个推理弹窗。
- conversation search 三件套：当前十二产品已有 canonical URL continuation，无消费者。
- fork 两件套：无 Product Flow 消费者且未获生产验证。
- title 四件套：当前不参与任何业务结果或 continuation 身份；默认机械执行反而增加失败面。
- 把 selector、find、inspect、click、keypress、file input 等 Chrome 原语命名成 Product Plugin 子能力：这些是子能力内部实现，不是业务分母。

### 尚待本轮继续实证的闭环

1. 点击发送后：唯一 user turn、composer 清空、canonical conversation URL。
2. 文本回答稳定与 checkpoint。
3. 同一会话第二轮 continuation。
4. 关闭标签后通过 canonical URL 重新聚焦并核对 turn marker，用来覆盖跨任务 continuation。
5. generated image 的稳定结果与 artifact checkpoint。

上述五项完成前，只能确认“模型/推理、附件、草稿”分母；不能把 18 项页面正常路径候选全部冻结。

## 2026-08-28 会议续记：第二轮真实发送、续聊与图片闭环

### 授权与范围

- 用户明确“全面授权继续论证”。
- 实际向当前已登录 ChatGPT 账号发送三条非敏感探针：附件 fresh turn、同会话 continuation、generated image。
- 没有使用业务报告、个人信息或运行日志；没有发布、通知、支付、READY、提交、部署或 RELEASE。

### fresh turn 提交与永久会话身份

第一轮探针携带已批准的 79-byte `main.ts.txt`，要求只回复“附件读取成功”。实证顺序：

1. 发送前：composer 精确包含 marker 和提示词，批准附件组唯一，发送按钮可用。
2. 点击一次发送后：composer 清空，唯一 user turn 出现，停止按钮出现。
3. URL 先短暂变为 `/c/WEB:...`，随后才变为永久 `/c/<conversation-id>`。
4. 最终唯一 assistant turn 回复“附件读取成功”，停止按钮消失；连续两次读回的 URL、message ID 和文本完全一致。

**确定结论**

- “提交动作确认”与“永久会话身份确认”是两个 checkpoint。
- `/c/WEB:...` 是过渡身份，禁止写入 continuation。
- 当前 `canonicalGptConversationUrl()` 会拒绝 `WEB:`，但 `verify_gpt_turn_submission` 紧跟在 submit 后立即读取 URL；因此它可能在过渡窗口把一次成功提交判为失败。
- 正确后置是：唯一 user turn + composer 清空先证明提交发生；再有界等待 URL 从过渡身份稳定为永久 canonical URL，最后才持久化 continuation。

### 同会话 continuation 的 assistant 占位生命周期

第二轮在同一永久会话发送 continuation marker，要求只回复“同一会话续聊成功”。实证到：

1. user turn 立即产生永久 message ID，composer 清空，URL 不变。
2. assistant 先出现一个带 request placeholder 身份的“Pro 思考中”节点。
3. 该 placeholder 随后消失；一段时间内页面仍有停止按钮，但没有最终 assistant 节点。
4. 最终 assistant 节点以新的永久 message ID 出现，回复“同一会话续聊成功”；连续两次读回一致。

**确定结论**

- 不能把 request placeholder 当最终 assistant turn checkpoint。
- placeholder 消失但停止按钮仍在，是正常生成中状态，不是失败。
- 文本完成必须同时满足：目标 user turn 唯一、其后最终 assistant turn 唯一、停止按钮不存在、相同文本和最终 turn 身份在稳定窗口内不变。

### 跨标签直接聚焦 continuation

使用永久 canonical URL 在第二个真实 Chrome 标签重新打开同一会话：

1. `DOMContentLoaded` 后短时间内，URL 已正确，但 messages 与 composer 仍可能是零。
2. 页面完成异步 hydration 后，两条 user message ID、两条 assistant message ID、两个 marker 全部与原标签一致，composer 唯一可用。
3. 会话标题由 ChatGPT 自动生成成“附件读取确认”，没有执行任何手工标题动作。

**确定结论**

- continuation 的聚焦后置不能只看 URL，也不能在 hydration 前立即判 marker 缺失。
- 必须在同一永久 URL 上有界等待 composer + exact turn marker，再确认 conversation identity。
- 自动标题足以满足人工可读性；系统 continuation 身份只依赖 canonical URL + marker + message identity。标题四件套正式退出当前必需分母。

### generated image 的真实 DOM 与下载边界

第三轮从重新聚焦的标签发送图片 marker，要求生成无文字纯蓝色正方形。实证到：

1. user turn 唯一，生成期间同样经历 placeholder 出现、消失、停止按钮仍在的阶段。
2. 最终图片位于 `conversation-turn-6`、`data-turn=assistant` 的直接后续 turn 容器。
3. 页面渲染出 3 个指向同一 source 的 `<img>` 节点，但只有 1 个带“已生成图片：”前缀的语义主图；按文件身份去重后真实产物为 1。
4. 主图在连续两次读回中保持同一文件身份与 1254×1254 自然尺寸，停止按钮不存在。
5. 在页面外直接 `fetch(src)` 实测返回 HTTP 403；通过当前已认证 Chrome 的媒体下载能力，同一主图下载成功。
6. Chrome 下载产物为 `/Users/nexgen/Downloads/52b083f9-fb41-4308-8188-e771e6e505bf.png`，879,952 bytes，1254×1254 PNG，SHA-256 `dfbf8e35d7b87e9fa16e307fa56897475953d99485b7923a442a5cfed1296d48`；原尺寸视觉核验为无文字蓝色正方形，不是错误页或占位图。该文件未删除。

**确定代码根因**

- `response-children.ts` 的 assistant turn ordinal 和 `img[alt^="已生成图片："]` 精确选择方式与本次 DOM 相符。
- 但 `downloadGeneratedImage()` 使用脱离浏览器登录态的全局 `fetch(source)`；本次真实页面对同一 source 返回 403。因此现有 generated image checkpoint 即使找对图片，也会在获取原始字节时失败。
- 正确 Owner 是 Browser Authority：由已认证 Chrome 读取一次媒体字节，再交给本地机械处理做哈希、1200×630 WebP 转换和持久化。GPT 子能力不得自行绕过浏览器会话下载。
- generated image 的稳定等待不应复用“稳定文本回答”作为完成依据；应以 exact assistant turn、语义主图唯一、文件身份稳定、自然尺寸有效、停止按钮不存在为准。

## 本轮最终确认：当前生产 AGENT 的子能力清单

### 口径

- Product Plugin 只拥有业务轮次、Prompt、材料角色、输出类型、会话关系与结果合同。
- 当前生产 GPT 公共子能力固定为 **22 项**：18 项页面语义动作 + 4 项 continuation 状态动作。
- Browser Authority 另有 3 项边界能力；它们不是 Product Plugin 的 `gpt_flow`。
- Runtime checkpoint 与重启恢复是执行器职责，不增加一组伪页面子能力。

### 一、GPT 页面语义子能力：18 项

| # | 建议稳定 ID | 稳定意图 | 当前实证状态 |
| --- | --- | --- | --- |
| 1 | `prepare_clean_gpt_chat` | 聚焦根页并确认一个干净 fresh 会话 | 已实证 |
| 2 | `focus_exact_gpt_conversation` | 只用永久 canonical URL 聚焦 continuation | 已实证 |
| 3 | `verify_gpt_conversation_identity` | 等待 hydration 后核对 canonical URL + marker + message identity | 已实证 |
| 4 | `open_gpt_execution_profile` | 打开当前唯一执行配置菜单 | 已实证 |
| 5 | `ensure_exact_gpt_model` | 目标模型已选中则只读返回，否则一次选择并读回 | 当前已选中分支已实证 |
| 6 | `ensure_exact_gpt_reasoning_tier` | 将滑块移动到目标值并直接读回 | 已实证移动与恢复 |
| 7 | `close_gpt_execution_profile` | 点击空白并等待菜单稳定消失 | 已实证 |
| 8 | `open_gpt_attachment_control` | 打开当前唯一可见附件入口 | 已实证 |
| 9 | `attach_approved_gpt_files_once` | 一次上传全部批准且哈希不变的附件 | 已实证 |
| 10 | `reconcile_gpt_attachment_set` | 对账全部且仅有批准附件，含零附件状态 | 有附件状态已实证 |
| 11 | `write_exact_gpt_prompt` | 一次写入完整 prompt + turn marker | 已实证 |
| 12 | `reconcile_gpt_draft` | 对账精确草稿、附件集合和发送按钮可用 | 已实证 |
| 13 | `submit_exact_gpt_turn_once` | 对唯一发送控件执行一次提交 | 已实证 |
| 14 | `reconcile_gpt_turn_submission` | 对账唯一 user turn、composer 清空及永久 canonical URL | 已实证，并发现过渡 URL |
| 15 | `wait_for_stable_gpt_text` | 忽略 placeholder，等待最终文本 assistant turn 稳定 | 已实证 |
| 16 | `checkpoint_gpt_text_response` | 持久化最终文本、hash、turn identity 与 continuation identity | 页面来源已实证 |
| 17 | `wait_for_stable_gpt_image` | 等待 exact assistant turn 内唯一语义主图稳定 | 已实证 |
| 18 | `checkpoint_gpt_generated_image` | 经 Browser Authority 下载一次，机械转换并持久化图片 artifact | 浏览器下载已实证；现实现 Owner 错误 |

### 二、continuation 状态子能力：4 项

| # | 稳定 ID | 稳定意图 |
| --- | --- | --- |
| 19 | `persist_gpt_continuation` | 持久化永久 URL、prior task、output hash、turn marker |
| 20 | `acquire_gpt_continuation_lane` | 按 owner、subject、authorization 和来源 Plugin 获取独占 lane |
| 21 | `advance_gpt_continuation_lane` | 成功后以 CAS 推进新 turn 身份并释放 lane |
| 22 | `release_gpt_continuation_lane` | 失败或取消时释放原 lane，不伪造推进 |

### 三、Browser Authority 边界能力：3 项，不进入 Product Flow

1. `bind_exact_browser_target`：绑定唯一 Target 与当前 Document。
2. `execute_one_governed_browser_mutation`：为至多一次物理动作签发许可并写 mutation WAL。
3. `reconcile_browser_mutation_outcome`：动作结果不明时先观察原 Document，再确认、继续等待或停止。

### 四、Runtime 必须承担的恢复职责，不新增子能力 ID

1. 每个安全原子步骤后写 `flow version + step index + input hash + proof + mutation state + canonical document identity`。
2. 重启后读取 step checkpoint、Browser WAL 和当前页面事实；只执行第一个尚未完成且允许执行的动作。
3. 对已派发的 upload、submit、media download 先对账，禁止整轮重放。
4. `recovery_pending`、`review_required`、`failed` 是当前尝试的处置分类，不得仅凭一次页面后置失败直接把业务任务永久终结。

### 五、正式退出当前必需分母

- `observe_gpt_document`、`verify_gpt_workspace`：并入 Browser Target/Document 边界观察。
- `verify_clean_gpt_chat`：并入 `prepare_clean_gpt_chat` 的直接后置。
- `observe_gpt_execution_profile`、`verify_gpt_execution_profile`：并入三个 execution-profile 动作的前置与后置。
- `open_gpt_model_selector`、`open_gpt_reasoning_selector`：当前只有一份执行配置菜单，合并为 `open_gpt_execution_profile`。
- `select_exact_gpt_model`、`select_exact_gpt_reasoning_tier`：改为幂等 `ensure` 语义，已满足时不点击。
- `focus_exact_gpt_composer`、`verify_exact_gpt_prompt`：并入 write 与 draft reconcile。
- `verify_gpt_turn_submission`、`observe_exact_gpt_assistant_turn`、`wait_for_stable_gpt_response`：按提交、文本结果、图片结果三个真实生命周期重组。
- conversation search 三件套、fork 两件套、title 四件套：当前十二产品无真实必要消费者。
- `restore_gpt_operator_source`、rate-limit acknowledgement、search-dialog dismissal、通用 transient cleanup：不是十二产品正常路径公共子能力；确有故障时由恢复状态机按已知页面事实处置。
- `capture_gpt_response_artifact`：业务 result contract 负责解析已经 checkpoint 的文本，不需要第二条页面结果链。
- `recover_gpt_response_checkpoint`：checkpoint 读取属于 Runtime 恢复入口，不是 GPT 页面动作。

### 会议终结论

本轮已经确定迭代方向和子能力分母：**保留十二个 Product Plugin 的业务编排，删除它们重复的厂商页面步骤；将当前 44 项 GPT child denominator 收敛为 22 项真实公共子能力；Browser Authority 与 Runtime 恢复各守自己的边界。**

这份结论可以作为下一步重构方案输入，但本次没有修改冻结法案或施工图，也没有获得实施重构、READY、提交、部署或 RELEASE 授权。

## 2026-08-29 会议续记：任务失败情报、有限重试与容量熔断

### 本轮讨论背景

网站任务的业务红线保持不变：

> 网站任务只有“成功交付并入库”才算完成。任何一次执行失败，都只是故障现场，不是任务终点。

本轮继续讨论 AGENT 收到网站任务后的执行纪律。讨论重点不是把失败包装成成功，也不是让同一故障无限循环，而是同时满足以下三点：

1. 网站任务最终仍须成功交付并入库；
2. 每次失败都必须保留足以尸检和修复的完整情报；
3. 自动重试必须有上限，单个故障任务不得拖垮全局或阻塞后续任务。

### 已实证的 A/B 分叉结论

本轮对当前运行日志、AGENT 本地 durable ledger、Website PostgreSQL 状态及双仓代码进行了只读交叉核对。

候选 A：Website 与 AGENT 的 V6 通讯格式不兼容。

候选 B：V6 通讯已经成功，但同一历史任务的旧 durable identity 与当前新租约 identity 冲突。

实证裁决：**B 成立，A 不成立。**

证据闭环如下：

1. Website 与 AGENT 当前使用同一 V6 合同指纹 `sha256:9d9cef79fda1b7f4dd01ac10f5d5cbb76e474d74bafef40f9fd24c3e04423bda`。
2. 当前 Worker Session 已达到 `claim_eligible`、`ledger_reconciled=true`，运行日志出现真实 `cloud.claim=success`；因此报文解析、设备鉴权、会话绑定和领取接口已经通过。
3. Website 随后真实租出十个历史本地化任务，并按当前 Worker Manifest 写入 `localization-production` Plugin 版本 9。
4. 同一批任务在 AGENT 本地已经冻结为 Plugin 版本 2、checkpoint schema 版本 1；当前实现则是 Plugin 版本 9、checkpoint schema 版本 2。
5. AGENT 在 durable accept 时依法拒绝用新 Plugin 静默解释旧任务，报出 `PLUGIN_IDENTITY_CHANGED_BEFORE_RECOVERY`。
6. AGENT 因本地已存在旧 durable task，随后尝试上报 `recovery_pending`；Website 却把本次租约视为 `accepted_at=null` 的新租约，要求第一条 checkpoint 必须是 `inputs_downloading`，因此返回 `AI_V6_CHECKPOINT_TRANSITION_INVALID`。
7. 重试越过 30 秒接单期限后，同一 outbox 又收到 `AI_LEASE_ACCEPT_DEADLINE_EXPIRED`。

责任判断不能简单说成某一边全部正确：

- AGENT 拒绝冒用 Plugin 9 续跑 Plugin 2 的旧 durable task 是正确的，它保护冻结执行身份和旧 checkpoint 不被新代码静默重解释。
- Website 拒绝“未完成首次接收的新租约直接跳到 recovery_pending”也是正确的，它保护新租约的状态转换纪律。
- 真正错误发生在两者之前：Website 对历史 `recovery_pending` 任务重新发租约时，直接使用当前 Worker Manifest 重写期望 Plugin 身份，却没有先完成旧执行片区退役、新执行片区重建或正式交接。这制造了一条无法同时满足的命令。

当前 SEO 任务尚未在这一身份门禁上直接失败，而是被历史任务占满执行容量后堵在队列中。只读数据库快照显示：SEO 工单仍为 `running`，目标 100，成功入库与 admission receipt 均为 0；76 个相关 AI 任务仍为 `queued`，10 个为 `recovery_pending`。同时，十个历史本地化任务占用了当前全部十个租约容量。这正是“一个故障片区拖住后续士兵”的现实故障现场。

### 用户明确的执行纪律

AGENT 收到网站任务后，每次执行尝试只有两个事实结果：

1. **成功**：按既定步骤完成执行、结果回传、Website 业务消费和入库；只有取得匹配的业务 admission receipt，网站任务才算完成。
2. **失败**：本次执行尝试阵亡。阵亡不是网站任务完成，也不能只返回一个笼统失败状态；任务继续保留为待恢复、待重试或待修复对象。

失败必须“透露情报”。任何失败现场至少要回答：

- 谁阵亡：网站任务、AGENT job、attempt、lease、Plugin 与版本；
- 何时阵亡：发生时间、持续时间、重试次数和下一次允许重试时间；
- 在哪里阵亡：Owner、component、业务阶段、安全原子步骤与 checkpoint；
- 为什么阵亡：稳定错误码、直接原因、根因 Owner 与因果事件；
- 阵亡前做了什么：外部 mutation 是 `no`、`dispatched` 还是 `confirmed`；
- 留下什么证据：日志事件、checkpoint、Browser WAL、对象或回执的 ref/hash；
- 现在影响什么：是否占用租约、业务容量、Browser lane、continuation lane 或 outbox；
- 下一步能做什么：可以安全重试、只能对账，还是必须停下来等待修复。

禁止只记录 `failed`、HTTP 409、异常字符串或“执行失败”后结束。没有时间、地点、步骤、身份、外部动作状态和证据引用的失败，不足以支持尸检。

### 有限重试与兜底原则

失败可能是假死，因此系统必须支持自动重试；但重试不是无限循环。

本轮已经确定以下原则：

1. 每个 task/attempt 必须有明确重试预算，不能无限占用执行线程、租约、Browser lane 或全局容量。
2. 重试必须从最近一个已证明安全的 checkpoint 继续；已经 dispatch 的上传、提交、媒体下载或其他外部 mutation 必须先对账，禁止盲目重放。
3. 每次重试都要增加 attempt/lease 代次并保留上一现场，不能覆盖旧错误或伪造一条干净历史。
4. 同一稳定错误连续出现时必须采用有界退避，不能毫秒级空转轰击 Website、数据库、Provider 或 Browser。
5. 达到重试上限后，必须停止该任务的自动执行，释放它占用的租约、全局业务容量和其他共享 lane；后续健康任务必须能够继续领取和执行。
6. 停止自动重试不等于把网站任务宣判为完成或永久失败。该任务应保留完整故障情报，进入明确的待修复/人工判定位置；修复后才能获得新的受控执行机会，最终目标仍是成功交付并入库。
7. 任何兜底都不得静默丢任务、伪造成功、伪造入库、清除故障证据，或让 Website 用户承担 AGENT 内部故障。

授权人现已冻结参数：同一 AGENT 代码候选累计形成 **3 次失败现场** 后停车自动执行。这里的三次包含首次失败，不是“首次失败后再重试三次”。每次失败都必须先持久化故障情报再释放租约与容量；第三次后网站任务仍保留为待交付债务，新代码候选上线才重新获得三次预算。

### 当前系统为什么违反上述纪律

当前故障链同时暴露了两个缺口：

1. **身份恢复缺口**：旧 durable identity 与新租约 identity 不兼容时，没有唯一的退役、重建或交接路径。
2. **容量熔断缺口**：十个同类历史任务反复领取、反复失败并占满十个业务位置，导致后续 SEO 任务无法前进。

因此，仅增加一次 `retry`、改一个状态名或吞掉 409 都是表面处理。后续方案必须对“历史任务重新派发、AGENT durable accept、失败情报、重试预算、达到上限后的任务停车和容量释放”这一完整片区做删除与重构，不能增加兼容旁路、第二状态链或无限 fallback。

### 本轮冻结的实现裁决

1. Website 是 `attempt_number`、三次预算、退避时间与停车裁决的唯一事实源；AGENT 只按 grant 执行并完整上报现场。
2. 第一次失败退避 5 秒，第二次失败退避 15 秒，第三次失败后同一 `agent_build_hash` 不再领取该 job；新的 build hash 才开启新预算。
3. 每次失败 checkpoint 必须在同一事务追加 failure history、清除 lease/session/fence 并释放业务容量；停车任务保持 `recovery_pending`，没有 failed terminal。
4. `mutation_outcome=dispatched` 仍只能 `RECONCILE_ONLY`，三次预算不授权盲目重放。
5. 旧 Plugin 身份仅在网站已退役历史失败完成、本地执行片区完全没有 result、step、continuation、Browser mutation、active lease 或未知 Outbox 时，才允许删除旧 checkpoint/lease/材料片区并按现役身份重建；证据保留，不设兼容链。

本次会议续记授权同步修改法案、施工图、质检系统和生产代码；它不代表 READY、RELEASE 或 SEO 已成功交付入库，最终仍以真实 admission receipt 为准。

## 2026-08-29 会议续记：GPT WEB 战场位置与历史执行片区删除边界

### 当前任务究竟走到了哪里

实证结论是：**任务已经进入 GPT WEB 的真实浏览器执行战场，但没有通过“打开执行配置”这一道关口。**

已经证明的事实：

1. Browser Authority 已建立，真实 ChatGPT Target 已被 claim，AGENT 已进入 GPT Child 执行链。
2. `open_gpt_execution_profile` 已真实下发 `browser.dom.click.v1`，Browser WAL 已经过 `PREPARED -> DISPATCHED`。
3. 点击后在 5.085 秒内没有出现合同要求的执行配置弹面，因此 WAL 收束为 `REJECTED`，错误码为 `BROWSER_POSTCONDITION_FAILED`，随后上报 `GPT_CHILD_REVIEW_REQUIRED` 与 `PLUGIN_EXECUTION_FAILED`。

因此，用战场比喻表述：部队已经到达 GPT WEB 战场并发出了打开执行配置的动作，但在确认该配置界面真正打开时阵亡，没有继续到模型/推理档位确认、prompt 提交、结果回收或 Website 入库。“已进入 GPT WEB”不得被升级为“GPT 已开始生产”或“任务已成功”。

### `PLUGIN_EXECUTION_SLICE_RECONSTRUCTION_UNSAFE` 与本次浏览器阵亡不是同一件事

`BROWSER_POSTCONDITION_FAILED` 是当前真实 GPT WEB 动作的故障现场。

`PLUGIN_EXECUTION_SLICE_RECONSTRUCTION_UNSAFE` 则来自另一个历史 job：现行安全门发现该 job 至少有一项旧 result/step/continuation/Browser mutation/active lease/未知 Outbox 条件没有满足，因此拒绝直接重建。这个错误码本身只证明“现行条件下禁止重建”，不能单独证明该 job 仍有业务价值，也不能单独证明它可以无条件删除。

### 授权人对“纯历史产物”的新裁决

授权人明确：系统持续迭代时，如果某个旧执行对象已经是**纯历史产物**，它不再对应任何当前网站交付债务，也不再有现役业务消费者，则它的旧执行片区没有继续占用现役数据库和恢复链的价值，可以物理删除。

本次会议对“无痕删除”的精确定义是：

1. 从现役 runtime 存储中事务性删除该历史 job 的 checkpoint、lease、material、continuation、Browser mutation、Outbox 及只为它存在的关联行。
2. 不为已删除的历史对象新建 tombstone、重构回执、兼容 reader、旧 Plugin 分支、第二台账或第二身份链；删除后它不再被现役代码看见、恢复或重放。
3. “无痕”指不在现役运行系统中额外建立历史影子链；正常 Git 字节历史仍由 Git 自然记录，不为此改写 Git 历史。

删除前必须由 Website 和 AGENT 的当前权威事实完成二元归类：

- **现役交付债务**：网站仍要求交付，或仍有未收束的外部 mutation/回传。这类不得删除，必须保留阵亡情报、对账并继续修复。
- **纯历史产物**：Website 已明确退役且不再存在交付债务，所有现役执行入口先被断开。这类可在一个定点事务中无痕物理删除，不得继续报 `PLUGIN_EXECUTION_SLICE_RECONSTRUCTION_UNSAFE`、占用容量或反复进入恢复链。

这条新裁决与“每次现役失败必须保留尸检情报”不冲突：前者处理已退役且无交付债务的纯历史垃圾，后者处理当前仍要成功交付的网站任务。禁止把当前故障现场谎报成历史垃圾后删除。

现行施工图仍要求保留退役 Outbox 原文和本地重构凭据，因此它与本次“纯历史产物无痕删除”的新裁决存在明确 GAP。本次仅更新会议记录和讨论边界，还没有修改法案、施工图、质检系统、生产代码或删除任何运行数据。

## 2026-08-29 会议续记：GPT WEB 任务局部恢复片区重构

### WHY HAPPEN

本轮重新对照法案、施工图、生产代码、Browser WAL、GPT checkpoint 与质检系统后，确认“点击后几乎立刻失败、重试又被判重复动作、一个任务拖住后续任务”并非一个 DOM selector 小问题，而是恢复模型同时存在四个冲突：

1. Browser 已完成物理动作并把 WAL 写成 `DISPATCHED/CONFIRMED` 后，Forensics 或 shared checkpoint 仍可能失败；旧 checkpoint 会把同一步降级成 `mutation_state=no`，重试据此再次发送。
2. 旧 logical mutation identity 把执行中动态 observation 次数当 action ordinal，又没有区分 Provider 外部 effect 与 Target-local 页面动作；结果是本地弹面动作换新 Target 后仍可能被旧 identity 永久封死。
3. 旧 Browser lane 用全局 `unsettled` 保存一个 job 的现场，导致该 job 的 Target 生命周期问题冻结整条 FIFO；“保留尸检现场”被错误实现成“占住全局道路”。
4. 磁盘上的现役失败 checkpoint 仍是 `gpt-turn-flow.v1`。若只换成 v2 代码而不处理旧 step，重启会在新代码入口再次因 flow/input identity 漂移失败。

### 片区删除与唯一新链

本轮物理删除全局 `unsettled` 闸门、reconciliation 抢占旁路和按 attempt 读取 pending mutation 的旧行为。普通执行与恢复执行统一进入同一有界 FIFO；恢复身份只由 Browser WAL 按 `job + plugin step` 派生。

唯一新链如下：

1. 每个 GPT step 使用冻结的 `flow version + step index + input hash + plugin step + child + semantic action ordinal`。
2. `attach_approved_gpt_files_once` 与 `submit_exact_gpt_turn_once` 是 `provider-effect-once`，identity 跨 Target/attempt/build 稳定；已 `DISPATCHED/CONFIRMED/REJECTED` 均不得重发。
3. 模型弹面、推理档位、附件入口和 draft 等是 `target-local-per-generation`，identity 追加 `targetRef`；旧 Target 的 terminal 不再永久封死新 Target 代次。
4. Browser WAL 是物理副作用先行权威。WAL 领先 checkpoint 时，已确认 Provider effect 直接从 WAL authority 恢复；已发送但未确认时跳过 mutation Child，只进入下一项只读 reconcile；checkpoint mutation state 只能单调前进。
5. 需要恢复时扩展执行 `park-target`：保留任务专属 tab/Target/Document，撤销 active claim 与 Workspace，立即释放 FIFO；同一 job 重试携带 exact targetRef 重领，其他 job 可继续执行。

## 2026-08-29 会议续记：片区重构后的真实重启实证与下一阻塞点

### CHANGE 质检与重启事实

1. 本轮没有启动 CI-FULL。定向治理测试 77/77 通过，随后项目唯一 `quality:check` 以 CHANGE 模式返回 `CHANGE_PASS`；受影响的 Agent Runtime、GPT、Local Browser、Runtime Log、App Shell 与治理路由验收全部通过。
2. 2026-08-29 02:27（Asia/Dubai）通过项目原生 `grasseye:start` 入口清理旧 4173 实例并重启。新 Agent run id 为 `29d1428b-dac7-4e4d-a5ce-64bd425618ce`，健康端点返回 `status=healthy`、`cloud=ready`、`claim.admission=eligible`、`browser.authority=present`、`browser.target=claimed`，当时 Browser lane 为真实 `busy`。
3. Browser mutation 现役库已完成原位 schema 迁移，新增 `flow_version`、`step_index`、`effect_scope`。真实新任务已产生 `gpt-turn-flow.v2` 记录，`open_gpt_execution_profile` 和 `close_gpt_execution_profile` 都在各自 exact Target 上写入 `CONFIRMED`。这证明旧的全局 `unsettled` 冻结和按 attempt 盲目重放已不再是新执行链的首故障。
4. 但本次不得将上述事实升级为“SEO 已全流程修复”。当时网站 FIFO 先发放创建时间更早的本地化恢复任务；12 个 `public_knowledge_article_pipeline` 本地债务仍是 `recovery_pending`，其中旧 SEO checkpoint 仍为 `gpt-turn-flow.v1`，还没有获得本轮新租约，因此安全 step 重建尚未在 SEO 实例上触发。

### 下一真实阻塞点：GPT 附件入口未出现，而故障情报又被 Website 409 拒收

新链的第一个真实页面故障发生在 `open_gpt_attachment_control`：

1. 真实任务 `aiprod_b9dddc6e-dec5-4d7e-812f-56a7e3717c50` 已成功完成模型确认、推理档位确认和配置面板关闭；随后打开附件控件时仅用约 59 ms 就返回 `GPT_PAGE_CANDIDATE_COUNT_0`。
2. 直接原因不是“GPT 生成太慢”，而是现役附件子能力对 `GPT_ATTACHMENT_CONTROL_SELECTOR` 调用一次 `requireOneCandidate`，该读取没有语义等待门。页面尚未水合或 selector 已随 GPT WEB 改变时，系统会立即宣判为不是唯一候选。这与授权人看到的“刚点击就宣判失败”完全吻合。
3. 这个页面失败被 AGENT 保存为 `mutation_outcome=no`。但 Website 对该历史任务发放的 grant 仍是 `attempt_mode=reconciliation`，AGENT 现役 `claimFailureDecision` 因此又上报 `RECONCILE_ONLY`。Website 正确拒绝这个矛盾组合，返回 HTTP 409 / `AI_V6_RECONCILE_OUTCOME_INVALID`：只有 `mutation_outcome=dispatched` 才允许 `RECONCILE_ONLY`。
4. 该 409 不是页面失败的原因，而是“阵亡情报无法入库”的第二层故障。当前 outbox 会反复尝试同一份被拒 checkpoint；若不重构这个边界，三次阵亡历史不能可靠入 Website，而且会制造 outbox 噪声和后续诊断污染。

因此下一步不能继续盲跑。需要授权人判定下一个重构片区的顺序：先重构 GPT 附件入口的有界语义水合/精确 selector 链，还是先重构 `attempt_mode + mutation_outcome + decision` 失败回传合同。无论选哪个，都不得吞掉 409、降级为普通 retry，也不得宣称 SEO 已入库。
6. 旧 flow step 不保留兼容 reader。只有 `failed + no result/staged result`，且 Browser WAL 证明没有 DISPATCHED、没有 Provider effect CONFIRMED/REJECTED 时，才事务删除该旧 step并写入现役 Outbox 的已本地验收重构凭据；任何上传/提交副作用存在都拒绝删除。

### 法案、施工图与质检同步

法案现已明确“现场归任务、容量归全局”，并把 logical identity 分成 Provider effect 与 Target-local 两类。Local Browser、GPT 与 Website-Agent V6 施工图同步写入 WAL 先行、checkpoint 单调、park/re-acquire、flow step 安全退役边界。

质检系统新增并绑定以下检查：

- 全局 `private unsettled`、`acquireReconciliation`、`reconciliationAllowed` 必须物理缺席；
- lane 必须包含 `turnRecoveryScope + expectedTargetRef + park`；
- mutation row 必须含 `flowVersion + stepIndex + effectScope`，并提供 `atomicStepRecovery`；
- GPT flow 旧 step 删除必须同时出现 WAL 安全判断、拒绝码和重构凭据；
- acceptance 覆盖 WAL 领先 checkpoint 禁重放、Target-local 跨代隔离、Provider effect 跨代恢复、一个 lifecycle 故障不冻结 FIFO、扩展停放后 exact Target 重领。

### 当前定向证据

当前候选的 `typecheck`、GPT acceptance、Browser FIFO acceptance、Browser mutation rule mutants、Browser terminal contract、自动配对与 exact ChatGPT claim acceptance、旧 flow step 重构 acceptance 均已通过；法案 registry 已重新生成，projection current，57 项治理契约测试通过。本轮没有启动 CI-FULL，这些证据只证明当前 CHANGE 的定向边界，尚不等于 SEO 已完成入库。

重启前只读磁盘实证显示，现有 SEO 失败 step 均停在 `research/open_gpt_execution_profile`，Browser WAL 只有该 Target-local 动作的 CONFIRMED/REJECTED，没有附件上传或 GPT 提交 Provider effect；因此它们满足旧 flow step 定点退役条件。下一步是重启当前候选，让数据库完成 schema/step 重构并观察第一条 SEO 任务实际进入哪个新原子阻塞点，最终完成仍只认 Website 的 business admission receipt。

## 2026-08-29 会议续记：Outbox 409 重试风暴专项

### 真实故障现场与 WHY HAPPEN

模型选择 V2 经真实 Chrome、Browser WAL 和 runtime log 证明已经完成入口点击、精确模型选中和推理强度确认；任务随后在 `open_gpt_attachment_control` 失败。页面失败本身没有发送附件副作用，但它产生的 checkpoint Outbox 被 Website 以 HTTP 409 / `AI_V6_RECONCILE_OUTCOME_INVALID` 拒绝。

AGENT 旧 Outbox 链存在三个直接缺陷：

1. `production_outbox` 只保存 `failure_code`，没有交付尝试次数、下次允许时间、停车时间或 build 预算身份。
2. `pendingOutbox()` 只用 `sent_at is null` 选取任务，失败 Outbox 因此每轮都重新进入发送队列。
3. `deliverOutbox()` 和外层 flusher 同时处理同一次失败；外层又把失败态重置为 pending，导致 HTTP 409 每秒重复。真实调试 run 在约五分钟内产生 7,800 余条事件，证明该路径会制造重试风暴并污染其他任务诊断。

### 专项唯一新链

每个 Outbox intent 以 `idempotency_key + agent_build_hash` 持久化一份唯一交付预算：

1. 第一次网络失败原子写入原生 code、`delivery_attempt_count=1` 和 5 秒后的 `next_delivery_attempt_at`。
2. 第二次失败写入计数 2，并退避 15 秒。
3. 第三次失败写入计数 3、`delivery_parked_at`，authority 状态成为 `parked`；同 build 的循环和重启都不得再选择或发送该 intent。
4. 新 `agent_build_hash` 才能重开该 durable Outbox 的三次预算；这不是把网站任务判失败，任务仍是 `recovery_pending` 交付债务。
5. `parked` 只隔离该 intent。其他 Outbox、其他 job、Website 入口和全局 Claim 不得被它阻断。
6. 每次失败只有 Store Owner 记账一次；flusher 只记录 terminal span，并在第三次明确输出 `recovery=stop`，不得再把失败态改回 pending。
7. Website 已权威判定为旧租约/任务不存在的 409 不消耗三次假死预算；Store 在同一事务路径中直接退役该 Outbox，只暴露 `failed + STALE_LEASE_OUTBOX_RETIRED:<remote_code>`，禁止短暂进入 `parked` 后再被外层改写。

质检必须覆盖 5 秒/15 秒退避、第三次持久停车、同 build 重启不重放、新 build 恢复预算、原生 409 code 保留，以及一个 parked intent 不阻断无关 intent。

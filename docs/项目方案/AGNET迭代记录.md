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

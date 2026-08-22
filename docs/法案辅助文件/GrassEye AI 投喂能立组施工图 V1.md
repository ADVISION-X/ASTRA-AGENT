# GrassEye AI 投喂能立组施工图 V3

版本：2026-08-22.3
状态：active blueprint  
适用 owner：`src/capabilities/ai-input-gateway/**`

> 本施工图描述终态，不描述阶段性迁移路线。GPT Web 的模型选择、思考强度、会话新建/续聊/fork/切换、搜索发现、附件、发送、回答捕获、生成图片和会话重命名均属于同一个 `ai-input-gateway` 主链。禁止再造第二套页面控制器、标题 worker、兼容 transport 或 shadow state。

## Boundary

唯一主链：

```txt
business owner
→ AiInputGatewayAbilityGroup.execute
→ canonical production GPT profile admission
→ managed web-chat execution
→ gpt-web-chat adapter
→ Web Chat Session Controller
→ exact provider page actions
→ provider result checkpoint
→ title finalization
→ provider proof
→ AiFeedResult
```

边界固定：

- 业务 owner 只提供任务、提示词、输入引用、输出合同、拓扑父引用与受治理执行档案；不提供 selector、坐标、tab id、标题、marker、浏览器命令或 action plan。
- AI Input Gateway 只负责 provider transport、页面动作、原始回答与 transport evidence，不做八字、奇门、合婚、起名、SEO、选品等业务判断。
- Local Runtime 只把 Browser public facade 注入 Gateway；Gateway 消费 operator Session Workspace 下已经签发的认证 authority lease 与短生命周期 exact `BrowserTargetLease`，不得自行签发 Workspace、打开私有 transport 或缓存旧 session。一个 ChatGPT 物理标签页承载多条逻辑会话。
- canonical `/c/...` URL + logical turn marker + response hash 是逻辑会话身份；标题永远只是人类可读的次级 evidence。
- 所有新页面动作都进入同一个 Session Controller；禁止增加 `provider-title-owner`、`chat-manager`、`rename-worker`、`model-picker-v2` 等平行 owner。

## GPT Web Session Controller

终态控制器只有两个公开阶段入口：

```txt
prepareWebChatSessionForSubmission
finalizeWebChatSessionAfterResult
```

前者负责：

```txt
exact provider target
→ semantic execution profile read/select/read-back
→ pre-submit conversation state
→ attachment child
→ prompt submission
```

后者负责：

```txt
result checkpoint already durable
→ exact canonical conversation + marker
→ privacy-safe title finalization
→ title proof
```

它不拥有业务任务顺序，不运行周期 worker，不维护第二任务数据库。

## Provider Execution Profile

生产 GPT Web 不再由 `modelName + requestedReasoningEffort` 两个散字段驱动。终态输入为一个 hash-bound `gpt-web-execution-profile.v1`：

```txt
profileRef
profileHash
provider = openai-chatgpt-web
transport = gpt-web-chat
accountCapabilityRef
modelDisplayName
modelFamily
reasoningTier
executorIdentityRef
acceptanceRef
acceptanceVersion
sourceProfileRef?
sourceProfileHash?
```

稳定 reasoning 语义：

```txt
medium
high
extra_high
pro_standard
pro_extended
```

网页中文/英文标签只属于 registry 内部观察映射。生产请求在 input hash 之前只接受上述 canonical tier；`xhigh`、无限定 `pro` 或其他非 canonical 值直接失败关闭，不存在 alias、默认值或归一 reader。

执行规则：

1. 校验 profile hash。
2. 绑定准确 ChatGPT target/document。
3. 找唯一模型/推理控制入口。
4. 若当前模型与 reasoning 已完全匹配，记录 `no_op` proof，不点击。
5. 不匹配时按语义找唯一候选并点击。
6. 每次导航/菜单变化后重新观察，禁止使用旧坐标。
7. 最终必须 read-back 模型和 reasoning 与请求 profile 完全一致。
8. 缺项、多个候选、无权限、读取不清、错误页面、document drift、read-back mismatch 均 fail closed。

### 2026-08-22 真实 ChatGPT 页面施工基线

本节来自 `https://chatgpt.com/` 的已登录 Pro 账号真实页面逐步观察，固定本次已走通的页面结构，避免后续重复猜测。它只授权这一条现役路径；页面结构漂移时必须重新取证，不得追加兼容 selector 或第二 picker。

法定动作顺序：

```txt
1. 模型选择下拉
2. 高级
3. 模型
4. 推理强度
5. 同菜单精确回读模型、推理强度与唯一 checked candidate
```

真实 DOM 身份：

| 页面状态 | 唯一 DOM 身份 | 正向确认 | 反向排除 |
| --- | --- | --- | --- |
| composer 模型选择下拉 | `form button[aria-haspopup='menu'][data-tone='neutral']` | 恰好一个、可见、`aria-expanded` 可回读；按钮文案是当前推理档位 | 零个或多个、disabled、错误 form、旧 document 均失败关闭 |
| 高级未展开 | `[role='menuitem'][aria-label='显示高级选项']` | 与“已展开”状态二选一且恰好一个 | 两种状态同时存在或同时不存在均失败关闭 |
| 高级已展开 | `[role='menuitem'][aria-label='显示精简选项']` | 恰好两个 `[role='menuitem'][data-has-submenu]`，文本分别包含“模型”和“推理强度” | 隐藏旧菜单、多个同名入口、缺少任一入口均失败关闭 |
| 模型候选 | `[role='menuitemradio']` | `GPT-5.6 Sol` 恰好一个；选中后该项 `aria-checked='true'`，全部 checked candidate 恰好一个 | 本次相邻候选 `GPT-5.5`、`o3` 不得处于 checked；目标为零/多个或 checked 冲突均失败关闭 |
| 推理候选 | `[role='menuitemradio']` | 真实候选为 `极速 / 中 / 高 / 极高 / Pro`；请求目标恰好一个且最终唯一 checked | “最接近”选择、滑块坐标、固定 index、多个 checked 或目标缺失均失败关闭 |

新对话入口先读取同一张正反边界：当前 URL 为 `https://chatgpt.com/`、用户/助手 turn 均为零、composer
为空、附件/粘贴卡/生成态均不存在且候选唯一时，必须原地返回 no-op proof，不得再次 `Page.navigate`、reload
或点击 New chat。只有该边界不成立时才允许一次同源根导航，并在新 Document 上重新证明全部条件。

本次实证的 canonical tier 到中文 UI 的唯一映射：

```txt
medium       -> 中
high         -> 高
extra_high   -> 极高
pro_standard -> Pro
pro_extended -> 当前页面无独立可排他的 UI 档位，必须 review_required
```

`GPT-5.6 Sol + 极高` 的最终实证同时满足：主按钮回读“极高”；高级菜单回读“模型 GPT-5.6 Sol / 推理强度 极高”；推理候选只有“极高”为 `aria-checked='true'`。生产 proof 只能由这些 provider UI 观察生成，不能从请求字段反推或伪造。

旧占位实现已将一批当前 `web-chat-execution-v3` 在提交前写成 `review_required`。该执行状态只在 input/prompt/profile hash
不变、failure ledger 含精确 `GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH`，且 submission/upload/attachment/profile-proof/
page-action/UNKNOWN/response-checkpoint/response-hash 全空时，原位追加一次 `LEGACY_PROFILE_READBACK_STATE_CORRECTION_APPLIED`
并回到 `recovery_pending`。原 execution id、turn marker 和 failure history 保留，只轮换 attempt id；该 marker 存在后不得再纠正，
不得形成常驻 review-task reset 链路。

禁止：

- 固定 `reasoningSliderIndex`。
- 用滑块几何比例推断 reasoning。
- 自动选“最接近”的模型。
- `extra_high → high` 或任意 silent downgrade。
- 生产任务继续使用 caller split model/reasoning 作为执行权威。

## Page Action Contract

受治理 mutation 统一形成 bounded `WebChatPageActionProof`：

```txt
actionId
executionId
targetRefHash
documentRefHash
beforeUrl
afterUrl
candidateCount
semantics[]
result
startedAt
endedAt
evidenceRef
evidenceHash
```

现役动作族包括：

```txt
establish_fresh_conversation
verify_execution_profile
attach_approved_files
submit_prompt
focus_canonical_conversation
ack_rate_limit
capture_response
capture_generated_image
rename_exact_conversation
verify_exact_conversation_title
cleanup_owned_provider_ui
```

`discover_conversation_via_search` 不是独立 actionId；它只是
`focus_canonical_conversation` 在 sidebar 未物化精确 row 时的有界内部观察步骤，
不得被 caller 选择、单独记账或成为第二会话路由动作。

页面元素本身不穿越 extension transport；运行时只保存受限标量、坐标、identity hash 和结果。

`BrowserDocumentRef` 变化意味着本次观察失效。旧 point 立即作废，必须重新定位；禁止跨 document 继续点击。

同一 target 完成 navigation 后，React hydration 或 document replacement 可能在 mutation 前使刚取得的
DOM node id 失效。Session Controller 只能在现有动作截止时间内串行重新取得当前
`BrowserDocumentRef`，并重复同一个 registry-owned exact observation；不得放宽 selector、切换 target、
reload、调用另一 action 或建立 fallback。尚未发生 mutation 时到界仍只有
`BROWSER_TARGET_INVALID`，必须写入 failure ledger 并进入 `recovery_pending`，不得把这类页面瞬态
写成业务 `failed`。

## Conversation Identity

三层身份必须严格分离：

```txt
physical page identity
  BrowserTargetRef + BrowserDocumentRef

logical conversation identity
  canonical non-WEB /c/ URL + logical turn marker + response hash

operator label identity
  expected title + title policy + title proof
```

只有 logical conversation identity 可以决定：

- 续聊父会话。
- fork 父子关系。
- 防重复发送。
- 崩溃恢复。
- 路由。
- response capture。
- dedup。

标题不能决定以上任何事项。

## Fresh Conversation

fresh 必须证明：

```txt
provider root
zero user turns
zero assistant turns
empty composer
no staged attachment
no pasted text card
no active generation
```

已经是 clean root 时禁止重复点 New chat。

不是 clean root 时只允许唯一 actionable：

```txt
a[data-testid="create-new-chat-button"][data-sidebar-item="true"]
visible text = 新聊天 | New chat
href -> provider root
pointer-events != none
center hit-test -> same anchor
```

unknown/unmarked user draft 永不清理。

只有同时满足以下条件才可清理遗留 GrassEye draft：

```txt
root + zero-state
+ exactly one well-formed internal marker
+ durable ledger resolves marker to exactly one other execution
+ that execution owns a canonical non-WEB submission
+ immediate pre-mutation recheck still exact
```

## Continuation And Fork

`same_conversation`：

```txt
persisted parent canonical URL
→ focus exact canonical path
→ verify prior marker when available
→ wait for hydrated prior user + assistant history
→ submit new marked turn
```

`forked_from_checkpoint`：

```txt
parent canonical URL
+ parent checkpoint turn marker
+ parent response hash
→ prove exact parent
→ perform provider branch action
→ prove distinct child canonical URL
→ persist child initial history fingerprint
→ submit child first marked turn
```

无分叉控件、控件歧义、父 identity 不匹配，不得退化为空白聊天。

## Exact Conversation Switching

正常切换：

```txt
short patrol lease
→ locate anchors whose href pathname == persisted canonical pathname
→ collapse responsive duplicate renderings
→ deterministic visible geometry selection
→ sidebar-scroll if needed
→ click exact row
→ prove browser pathname
→ prove exact marker occurs once
→ release lease
```

禁止按 title text 切换。

进程重启时允许使用 `reuse-exact-url` 重新绑定物理 target，但绑定完成后逻辑切换继续走 sidebar DOM；不把 URL open 变成日常路由器。

## Canonical Conversation Registry Action

现有会话路由只有一个 registry action。它先从已物化 sidebar 解析精确 canonical pathname；精确 row 尚未物化时，同一 action 才执行以下有界内部 discovery step，不建立另一动作或调用方可选路径：

```txt
close only exact stale Search chats dialog if present
→ open unique Search chats / 搜索聊天 control
→ type exact turn marker
→ accept only result href pathname == already persisted canonical pathname
→ click
→ verify exact pathname + marker count == 1
→ close search dialog in finally
```

搜索只负责发现，不负责身份证明。标题搜索禁止成为最终路由依据。

## Conversation Title Finalization

### Title policy

所有新的 fresh ChatGPT conversation 与 provider-created fork child 都必须封口标题。

格式：

```txt
玄学·{allowlisted domain}｜{allowlisted role}｜MMDD-HHmm｜{opaque 6-char trace}
```

时间使用 `Asia/Dubai`，来自持久化 execution creation time。

标题只能由：

```txt
taskIdentity.labelKey allowlist
machine taskKind -> role mapping
createdAt
execution opaque hash trace
```

生成。

严禁进入标题：

```txt
prompt text
user name
birth date/time
phone/email/address
sourceTaskId
order id / DB key
file name
turn marker
report text
classical-corpus text
arbitrary caller title
```

### Transaction

回答 checkpoint 已完成且 canonical submission 已证明之后执行：

```txt
acquire existing exclusive patrol lease
→ focus canonical URL + exact marker
→ locate exact canonical sidebar row
→ hover exact row
→ locate exact row options
→ locate unique Rename / 重命名
→ locate unique chat title textbox
→ clear + write exact expected title
→ read-back exact textbox value
→ Enter commit
→ re-observe exact canonical row
→ prove expected title + canonical path + marker
→ persist title proof
→ release lease
```

如果已经正确，直接产生 `no_op` proof，不打开菜单。

菜单、row、textbox、title reflection 暂未 ready：`recovery_pending`，保留 checkpoint，不重投。

多个目标、错误 marker、错误 canonical path、标题控件歧义：`review_required`。

### Continuation inheritance

新协议父会话的 same-conversation child 继承同一个 `expectedTitle/expectedTitleHash`；如果用户/Provider 改了标题，child 封口时修复。

current V5 parent 缺少或不匹配 title proof 时 child 进入 `review_required`，不得伪造成功或收编未知标题。

fork child 是新 conversation，生成新标题。

## Attachment Child

唯一附件 child：

```txt
attach-approved-web-chat-files-once
```

职责仅为：

```txt
verify approved input refs
→ isolated staging directory
→ source bytes/hash/size recheck
→ deterministic unique display names
→ exact target document file input
→ one batch selection
→ exact attachment count + names
→ 30s continuous stability
→ aggregate terminal proof
```

它不输入 prompt，不发送，不读答案，不改标题，不切换 conversation。

## Staging Flow

```txt
input refs
→ re-read bytes
→ byte_count + sha256 exact
→ unique attempt dir
→ ordered display names
→ staging manifest hash
→ exact directory membership check
→ one exact-target file-input batch
→ wait exact attachments_stable
→ persist aggregate proof
→ remove staging dir
```

禁止 clipboard/native-picker fallback 环、clear-reupload、base64 HTTP 影子链。

## DOM Inclusion And Exclusion

允许观察：

- exact provider origin/path。
- current outer conversation turns。
- exact composer and staged attachments。
- model/reasoning controls required by profile transaction。
- exact canonical sidebar anchors。
- exact Search chats dialog for bounded discovery。
- exact row-scoped conversation options and Rename UI for owned title finalization。
- exact generated-image card and viewer save action。
- ordinary rate-limit acknowledgement dialog。

禁止：

- cookie/localStorage/sessionStorage/password/token extraction。
- login/CAPTCHA/2FA automation。
- page-global fuzzy selectors used as identity fallback。
- title text used as logical conversation identity。
- arbitrary menu closing / Escape universal cleanup。
- refresh/reload as recovery default。
- archive/delete/share/pin/project-move/global settings/history edit。

## Response Capture

文本：

```txt
unique marked user turn
→ immediately following substantive assistant turn
→ generation completion proof
→ durable response checkpoint
```

outer identity：

```txt
[data-testid^=conversation-turn-][data-turn=user|assistant]
```

空 shell 不算 substantive turn。

生成图片：

```txt
unique marked user turn
→ immediately following assistant turn
→ exactly one completed generated-image card
→ open exact HTMLElement role=button card
→ exactly one viewer button[aria-label=保存]
→ one newly downloaded decodable file
→ original byte hash
```

`web-chat-generated-image-capture.ts` 中的 exact assistant-turn 判定是现役 AI inspector 的静态受检证据；它不取得运行入口、导出转运或动态加载权。

## Response Checkpoint And Publication

终态状态机：

```txt
waiting_for_capacity
→ waiting_for_submit_slot
→ submitting
→ submitted_transient
→ conversation_canonicalized
→ waiting_provider
→ response_checkpointed
→ title_finalization_pending
→ title_verified
→ finalized
```

恢复/阻断：

```txt
recovery_pending
review_required
failed
```

关键语义：

- `response_checkpointed` = Provider 结果真相已经安全，不许重投。
- `title_verified` = Session Controller 已完成会话标题封口。
- `finalized` = 这个 title-managed GPT Web 执行可以正式发布完成。
- continuation 没有当前 canonical profile/title proof 时只能 `recovery_pending | review_required`；不存在 unmanaged、legacy 或兼容完成语义。

checkpoint patrol 仍必须在 provider branch success/failure/final publication 的 finally 生命周期停止。

**禁止 checkpoint winner 之后把 provider post-processing 用 `void` 脱离为第二后台链。** 同一 execution 必须由同一 owner 完成 title/profile/proof 与 lease release。

## Recovery

恢复优先级：

```txt
1. valid durable result checkpoint
2. immutable execution identity
3. canonical conversation URL
4. turn marker
5. persisted attachment proof
6. profile/title pending state
7. live provider target reacquisition
```

checkpoint 存在时绝不重发 prompt。

新 v3 execution state 持久化：

```txt
providerExecutionProfileBinding
providerExecutionProfileProof
conversationTitle
pageActionLedger
responseCheckpoint
responseHash
failure ledger
```

旧 execution 记录只保留为不可变历史，不进入 active production reader。不得通过 migration reader、alias、默认值或兼容分支补造 profile/title proof，也不得恢复旧 `systemChatTitle/chatTitleRename` debt。

唯一历史例外是旧候选在 prompt mutation 前把受信 Browser 技术中断误写为 `failed` 的同 execution
自动恢复。受信原因只包括 extension/liveness/workspace、target/document invalid、backpressure、认证
transcript discontinuity 与暂时 capability admission loss。它必须同时满足 input/prompt hash 不变，且
submission/upload/attachment proof/page-action proof/`UNKNOWN` mutation/response checkpoint/response
hash/output 全为空。恢复保留 execution id、turn marker 和 failure ledger，只更换 attempt id 并重走
同一 exact 观察。任一 proof 存在、身份漂移、明确业务失败或原因不在 allowlist 时失败关闭；该精确
恢复不是通用 legacy reader，也不需要人工逐单创建恢复任务。

## Bounded Parallel Web Chat

```txt
business capacity: fixed max_in_flight=10; environment cannot collapse or enlarge it
browser action admission: max_browser_in_flight=1
business/provider waits: durable, no Browser lock
provider generation wait: concurrent
submission queue: durable SQLite strict FIFO
submission window: oldest ticket holds clean-page -> durable submission checkpoint
pre-checkpoint UNKNOWN: same ticket remains head; newer submission and patrol blocked
attachment stable before prompt: exact names/count, no extra/uploading; send may still be disabled
submission priority: before patrol
patrol queue: durable SQLite FIFO
```

一个物理 ChatGPT tab，不建 tab pool。

同一次 provider 页面观察即使只读，也必须按 `document -> inspect/find/readText -> terminal evaluation` 逐条 `await`。禁止把同一 `BrowserTargetLease` 上的 `executeDomIntent`、`navigate`、`attachFile` 或其他 Browser action 放入 `Promise.all`、`allSettled`、未等待 Promise 或等价 fan-out；这不是并行提速，而是绕过唯一 mutation lane 并触发确定性的 `BROWSER_BACKPRESSURE`。

title transaction 使用已有 patrol/mutation 机制，不新增 title lease scheduler。

## Choice And Security Boundary

- provider 由受治理产品/能力选择，不由网页 DOM 随机选择。
- production GPT profile 决定模型和 reasoning，不由 caller free text 决定。
- rate-limit acknowledgement 是 process-wide 高优先级生存动作。
- operator takeover 期间所有新的 provider mutation 等待。
- login/CAPTCHA/2FA/risk control/account barrier/ambiguous identity fail closed。
- 标题绝不包含用户隐私或业务原文。
- title repair 只能作用于 ledger 已证明归 AGENT 所有的 canonical conversation。

## Success Gate

生产 GPT Web success 必须同时具备：

```txt
input hash valid
provider capacity lease valid
exact attachment proof
exact topology proof
canonical conversation + marker proof
providerExecutionProfileProof == requested profile
provider result checkpoint / generated image output proof
conversationTitleProof (when title-managed)
no duplicate semantic submission
AiFeedResult schema valid
```

缺任一 title-managed 证明都不能将 checkpoint 提前发布为最终完成。

## Acceptance

机器验收至少覆盖：

1. fresh zero-state 与 unknown draft 保护。
2. 同语义 retry 不重复发送。
3. canonical URL 占用冲突。
4. `/c/WEB:` 只作 anti-resubmission evidence。
5. one Browser action in-flight + next action durable wait。
6. single mutation lock + patrol FIFO。
7. exact target/document binding。
8. semantic profile `high / extra_high / pro_standard / pro_extended`。
9. profile 已正确时 no-op。
10. profile 多候选/缺候选/read-back mismatch fail closed。
11. 固定 slider index 物理删除。
12. fresh title 生成不含 prompt/PII/sourceTaskId。
13. exact canonical row rename transaction。
14. already-correct title no-op。
15. title menu/textbox 暂未 ready 保留 checkpoint 并 recovery_pending。
16. wrong marker/multiple row review_required。
17. same-conversation title proof inheritance。
18. current V5 parent 缺失或错误 title proof 时 review_required。
19. fork child 新标题。
20. title 不参与 route identity。
21. fresh/upload/submit/resume 的复合页面观察逐条串行，源码出现 Browser action fan-out 即审计失败。
21. 唯一 canonical-conversation registry action 的有界 marker discovery step。
22. search result 必须 canonical path + marker 双证明。
23. search dialog finally close。
24. response checkpoint 后崩溃恢复不重投，继续标题封口。
25. provider post-processing 无 detached `void` 第二链。
26. generated image exact outer turn + viewer save identity。
27. title/model 旧实现文件保持删除。
28. legacy execution active reader/alias/default/compatibility 为零。
29. providerProof 投影 execution profile + title proof。
30. xuanxue production profile source identity 保留 sourceProfileRef/sourceProfileHash。
31. navigation 后 hydration 使 exact node id 短暂失效时，只在同一 target、同一 selector、同一有界窗口重新观察；不得终态 failed、放宽 selector 或切第二路径。
32. 旧受信 Browser 技术失败只在无任何提交/上传/动作/UNKNOWN/checkpoint/output proof 时自动恢复同 execution；保留 marker/ledger 且更换 attempt。

本施工图的完成标准不是“能点网页”，而是：**每一个会改变 GPT Web 页面或决定某次 Provider 执行身份的动作，都只能在唯一 owner、唯一状态、唯一 proof 链中发生；失败可恢复，身份不可漂移，结果不可重复。**

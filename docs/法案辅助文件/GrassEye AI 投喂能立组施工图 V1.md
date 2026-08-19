# GrassEye AI 投喂能立组施工图 V3

版本：2026-08-19.1  
状态：active blueprint  
适用 owner：`src/capabilities/ai-input-gateway/**`

> 本施工图描述终态，不描述阶段性迁移路线。GPT Web 的模型选择、思考强度、会话新建/续聊/fork/切换、搜索发现、附件、发送、回答捕获、生成图片和会话重命名均属于同一个 `ai-input-gateway` 主链。禁止再造第二套页面控制器、标题 worker、兼容 transport 或 shadow state。

## Boundary

唯一主链：

```txt
business owner
→ AiInputGatewayAbilityGroup.execute
→ production GPT admission normalization
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
- `BrowserController` / `BrowserTargetSession` 是唯一浏览器物理执行基础；一个 ChatGPT 物理标签页承载多条逻辑会话。
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

网页中文/英文标签只属于观察层映射。旧 `xhigh` 可在进入 Gateway 前归一为 `extra_high`；旧 `pro` 必须归一为一个明确 tier，不能在运行时继续用模糊 `pro`。

执行规则：

1. 校验 profile hash。
2. 绑定准确 ChatGPT target/document。
3. 找唯一模型/推理控制入口。
4. 若当前模型与 reasoning 已完全匹配，记录 `no_op` proof，不点击。
5. 不匹配时按语义找唯一候选并点击。
6. 每次导航/菜单变化后重新观察，禁止使用旧坐标。
7. 最终必须 read-back 模型和 reasoning 与请求 profile 完全一致。
8. 缺项、多个候选、无权限、读取不清、错误页面、document drift、read-back mismatch 均 fail closed。

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
discover_conversation_via_search
ack_rate_limit
capture_response
capture_generated_image
rename_exact_conversation
verify_exact_conversation_title
cleanup_owned_provider_ui
```

页面元素本身不穿越 extension transport；运行时只保存受限标量、坐标、identity hash 和结果。

`BrowserDocumentRef` 变化意味着本次观察失效。旧 point 立即作废，必须重新定位；禁止跨 document 继续点击。

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

## Search Discovery Fallback

较旧会话的 sidebar row 暂时未物化时允许一个 bounded discovery transaction：

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

legacy parent 没有 title proof 时 child 不伪造成功，不强行收编未知标题。

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
- archive/delete/share/pin/project-move/global settings/history edit unless a future active law explicitly authorizes。

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
- legacy unmanaged continuation 可以保持旧兼容完成语义，但不能伪造 title proof。

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

v2 记录允许原地 migration 到 v3，但：

- 不伪造新 profile proof。
- 不伪造 title proof。
- 不恢复旧 `systemChatTitle/chatTitleRename` debt。
- old title fields 只被剥离，不成为身份。

## Bounded Parallel Web Chat

```txt
capacity lease: N bounded, default >=10
browser mutation lease: N=1
provider generation wait: concurrent
submission priority: before patrol
patrol queue: durable SQLite FIFO
```

一个物理 ChatGPT tab，不建 tab pool。

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
5. ten in-flight + N+1 wait。
6. mutation N=1 + patrol FIFO。
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
18. legacy parent 无 title proof 不伪造。
19. fork child 新标题。
20. title 不参与 route identity。
21. old sidebar row 的 marker search discovery。
22. search result 必须 canonical path + marker 双证明。
23. search dialog finally close。
24. response checkpoint 后崩溃恢复不重投，继续标题封口。
25. provider post-processing 无 detached `void` 第二链。
26. generated image exact outer turn + viewer save identity。
27. title/model 旧实现文件保持删除。
28. v2 → v3 migration 不伪造证明。
29. providerProof 投影 execution profile + title proof。
30. xuanxue production profile source identity 保留 sourceProfileRef/sourceProfileHash。

本施工图的完成标准不是“能点网页”，而是：**每一个会改变 GPT Web 页面或决定某次 Provider 执行身份的动作，都只能在唯一 owner、唯一状态、唯一 proof 链中发生；失败可恢复，身份不可漂移，结果不可重复。**

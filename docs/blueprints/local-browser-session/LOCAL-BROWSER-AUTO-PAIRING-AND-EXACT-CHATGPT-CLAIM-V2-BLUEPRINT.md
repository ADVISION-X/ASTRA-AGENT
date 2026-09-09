# GrassEye 单生产 Tab、可信 DOM 事实与唯一 Browser FIFO V20 施工图

状态：active final-state blueprint
Owner：`local-browser-session`

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "local-browser-auto-pairing-and-exact-chatgpt-claim-v20",
  "status": "active",
  "owner": "local-browser-session",
  "lawIds": [
    "LAW-LOCAL-BROWSER-SESSION-001-V4",
    "LAW-LOCAL-BROWSER-SESSION-002-V6",
    "LAW-LOCAL-BROWSER-SESSION-003-V25",
    "LAW-LOCAL-BROWSER-SESSION-004-V26",
    "LAW-LOCAL-BROWSER-SESSION-005-V6",
    "LAW-LOCAL-BROWSER-SESSION-006-V18"
  ],
  "contractRefs": [],
  "dependencyEdges": [
    {"contractRef":null,"from":{"domain":"startup-entrypoint","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}},
    {"contractRef":null,"from":{"domain":"workbench-api-boundary","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}}
  ],
  "prohibitedDependencyEdges": []
}
```

## 1. 生产终态

```text
AGENT 启动
-> 固定 unpacked MV3 与当前构建身份一致
-> 扩展从受限 loopback route 领取内存一次性密钥并自动配对
-> Browser Authority READY，Target 保持 absent
-> exact Cloud job 已 durable 接受
-> Browser Authority public facade 发出一次 job-bound Target acquisition
-> 扩展以 inactive 方式创建且只创建一个 visible、system-owned ChatGPT production Tab
-> 等待页面完成并复核预授权 gpt-web 精确 Origin
-> 扩展以当前 tabId 执行无聚焦 `Page.getFrameTree`，只把精确 `https://chatgpt.com` 作为 `claimOrigin` 提交该唯一 system Target 的现有 TARGET_CLAIM
-> 服务端校验并 ACK
-> 建立 connection-bound Session Workspace
-> 等待生成媒体时只在同一已鉴权 Target/Document 内以 `delivery=probe` 取回精确 assistant turn 原始 bytes；最终图片 checkpoint 以唯一 `delivery=visible-download` compound mutation 点击语义主图、打开同图查看器、点击唯一 `button[aria-label='保存']` 并等待原生下载完成，再证明同一 bytes/hash 并出具一个 receipt
-> 最终 fork click 触发 Provider 新页时，只在该同一 typed command 内允许受控瞬时双页：冻结点击前集合，唯一新增合法 gpt-web page 只读验证 source content 与 child route 后接管为同一逻辑 targetRef，再关闭 source tab
-> final fork terminal reply 前保持逻辑 targetRef、把物理 tabId 切换为 child tabId、递增 Document/navigation epoch 并恢复 settled production Tab 恰好一个，GPT/Product 不接触 tabId、URL 或 target 选择
-> 无未收束 DISPATCHED 时，Provider wait 或 turn settle 可 normal park：撤销 claim/Workspace 并释放 FIFO，system Tab 与 debugger session 保留
-> 存在未收束 DISPATCHED 时只能 recovery park：保留原 Target/Document 并隔离唯一 Browser lane，不占 Website 业务槽且不阻塞非 Browser 工作
-> 只有 normal park 释放后，其它 job 才按智慧指挥 FIFO 在同一 Tab 时间片执行；每次重领只做无聚焦精确验证，再用 conversation URL + marker + prompt hash 与适用的文本 response hash 或图片 media/content identity 定位
```

操作者不复制密码、不点击“认领当前标签页”。启动器只同步固定扩展 artifact 并启动本地 Shell；它不读取、
枚举、打开、附加或认领 Browser Target，也不创建、认领或执行任务。Target acquisition 只能由 exact job
durable 接受后的第一个 Browser 原子动作触发，固定扩展单独拥有物理认领。

Browser Authority 不决定 fresh 或 continuation，只提供全系统唯一的物理 production Target。Product Plugin 决定
会话意图；Browser 只在 current Document 同一次 coherent observation 中读取、清洗并签发 revision-bound `currentUrl`，GPT Child 再在同一 Target 上判断干净根页面或按 canonical conversation URL + marker + prompt hash 与适用的文本 response hash 或图片 media/content identity 聚焦精确历史 conversation。Target admission 的 `claimOrigin` 不含 path，永不进入 GPT 页面语义。Browser 机械验证 marker 所在 exact 外层 user turn 与唯一 user-role root 后，只裁决两个互斥 Prompt 正文结构：恰好一个 `[data-testid='collapsible-user-message-content']` 长 Prompt；或仅当长节点为零时，恰好一个无元素子节点 `.whitespace-pre-wrap` 短 Prompt 叶子。长节点存在时不得再读短结构；长/短节点或 user root 缺失、多义都 typed fail-close。Browser 对选中的唯一正文用现役 deterministic semantic tree 生成同 observation revision 的 hash-only `exactGptUserPromptHash`，GPT Owner 只消费该哈希形成 canonical rendered-prompt identity。外层 turn 继续提供 `conversation-turn-*`。Browser 不解释 URL 的 root/conversation 语义或 Prompt，也不绑定附件卡片或页面控制文字。建 tab 不另立为 GPT DOM
Child，也不允许 Product Plugin 直接接触 Chrome 资源。

## 2. 唯一认领策略

预授权策略固定为现有 `gpt-web` site policy：唯一 Origin 是 `https://chatgpt.com`，唯一 start URL 是
`https://chatgpt.com/`。首个已 durable 接受且进入 GPT turn 的 job-bound acquisition 以 `tabs.create({active:false})` 创建且只创建一个 visible、
system-owned Target；后续 acquisition 只复用它。唯一例外是源码冻结的 final fork click 在同一 Browser mutation command 内对 Provider 自行创建的新页执行 successor normalization；它不属于 acquisition，不得复用既存操作者页面，且 terminal reply 前必须验证并接管唯一 child tab、把同一逻辑 targetRef 转移到该物理 tab、关闭 source tab，再恢复恰好一个 system-owned production Target。扩展不枚举、不复用、不认领、不关闭，也不操纵任何既存操作者 ChatGPT Target。调用方仍不得
提供 URL、标题、tabId、顺序、坐标、选择器或任务输入来影响物理 Target。

- 首次 acquisition：以 `active:false` 创建一个固定 start URL；创建零个或多个均失败关闭。后续 acquisition 创建任何 Tab 均失败关闭。
- 新页面加载未完成或主 frame Origin 不精确：不得附加、认领或建立 Workspace。
- 只对首次 acquisition 创建并记录的 inactive system Tab 执行一次 debugger attach；正常 park、任务切换、turn settle 与 AGENT/WebSocket 重启均不 detach/close。创建、重领和轮询全部禁止 `Page.bringToFront`、`windows.update({focused:true})`、`tabs.update({active:true})` 以及任何等价前台化；操作者切出 Chrome 或切换其它 Tab 不得改变 Target 身份，系统不得改变操作者当前 Tab 或前台应用。
- 每一个 fresh job 在取得 claim 前都必须在同一 system Target 上无条件导航固定 start URL，即使当前 URL 已精确等于 start URL 也不得跳过；必须直接读回新的主 frame loaderId/Document identity，且相对上一停放 Document 已改变，随后 `prepare_clean_gpt_chat` 再证明 zero prior turn、zero attachment、empty draft 与 not generating。不得点击附件 X、创建第二 Tab、切到操作者页面或用旧 Document 冒充新任务。continuation/poll job 由 GPT Child 导航 exact canonical conversation URL，并校验 marker、prompt hash、紧邻 assistant，以及文本的 response hash 或图片的 mediaHash/content identity；禁止用 response hash 拒绝图片。
- 无未收束 DISPATCHED 时，normal park 撤销 active claim/Workspace 并立即释放 FIFO，其他 job 才可在同一 system Target 时间片执行。存在未收束 DISPATCHED 时，recovery park 必须保留原 Target/Document 和冻结判据，并持有唯一 Browser lane 隔离；其它 Browser job 不得导航或 mutation。该隔离不占用 Website 十个业务槽，不阻塞无需 Browser 的工作，也不产生第二 lane、Tab、queue 或 recovery bypass。Browser Authority 权威证明原 Document 丢失后，target_local 以 `REJECTED + mutation_outcome=dispatched` 保留不确定后终结；provider_effect 仍必须依 WAL、Forensics receipt 与 task-owned locator 只读收束。CONFIRMED submit 后只允许 Website 保留的同一 accepted attempt 执行零 mutation读回；locator pending 时只允许发送源 D0，或同一 exact submit 原子 Child 按同 Target、navigationEpoch 不变或精确 +1、initial evidence hash 唯一证明的直接后置 D1 做 source-only reconcile，locator 闭合后才可恢复新 Document 并 exact canonical navigate。
- Provider effect 的物理 identity 固定为 `provider_effect_identity_hash = sha256(canonical ordered tuple [job_id, plugin_id, plugin_version, product_step_id, call_id, child_id, request_hash, payload_hash])`，跨全部 attempt、lease、process、Target、Document 与 build 稳定且至多一次。物理 pre-dispatch fence 唯一属于 Browser WAL：历史零项才可首次 dispatch；历史非空时，只有全部记录均为 `REJECTED + mutation_outcome=no`、每条均属于不同旧 attempt，且当前 permit 绑定 Website 新签发并不同于全部旧记录的 accepted attempt，才可再次 PREPARED；任一 `DISPATCHED`、`CONFIRMED`、`REJECTED + dispatched|confirmed`、当前 attempt 已有记录、identity/attempt 多义或记录冲突都零 mutation失败关闭。Forensics 只拥有 evidence 生命周期，不签发提交许可；Product 只消费 GPT 安全投影。Target-local identity 继续绑定 attempt + target generation。已有唯一 `CONFIRMED + passed` submit receipt 时，只允许同一 accepted attempt 沿原 pending evidence，在发送源 D0 或该 submit 同一原子 Child 已唯一证明的直接后置 D1 上执行 source-only locator reconcile，或 locator 闭合后的 full readback，Provider mutation 增量为零。
- MV3 actor/Service Worker 重建且内存 registry 为空时，只有 Browser WAL 恢复事实给出的确定 `target-tab-<tabId>` 才能触发精确重建：`chrome.debugger.getTargets()` 必须只命中一个同 tabId、`type=page`、`attached=true`、gpt-web Origin 的 Target，当前扩展必须在不调用 `attach` 且不改变 Tab/窗口前台状态的前提下成功执行 `Page.getFrameTree`，然后以同一 targetRef 和当前主 frame 登记一个新 Document。零个、多于一个、未 attached、Origin 不符或当前扩展不能发送 Page 命令都立即返回 `BROWSER_EXACT_TARGET_UNAVAILABLE`，不得建新 Tab、重新 attach、将页面前台化或猜操作者页面。
- final fork successor normalization：Browser 在最终 click dispatch 前取得仅含本扩展 system-owned production page 的基准集合，动作后有界等待并计算新增集合；只有恰好一个 `type=page`、gpt-web 精确 Origin 的新 Target 时才可 attach、启用并只读验证其合法主 frame、source conversation content 与 current child route。Browser 随后必须把同一逻辑 `targetRef` 的物理绑定原子切换为 child tabId，以递增 navigation epoch 签发新 Document，用现有 `TARGET_CLAIM/ACK` 发布该 child Document，再 detach 并关闭 source tab；不得关闭 child，不得对 source 或 `/c/WEB:<opaque>` 执行 `Page.navigate`。全过程禁止前台化、不得触碰操作者页面，且在 extension REPLY 前读回本扩展 settled production page 恰好一个并证明它就是接管后的 child。新增零个/多个、Origin 非法、attach/frame/child 接管/source 关闭/claim 或单页读回任一失败都返回稳定 Browser typed cause；若已执行最终 click却无法证明未产生 Provider effect，mutation outcome 必须保持 dispatched，绝不二次点击。该 normalization 不增加第二 Provider 动作、第二 WAL row 或第二执行链。GPT/Product 只收到同一逻辑 targetRef 所对应的新 Document 安全 receipt，不接收 tabId、URL、集合或选择策略。

不增加设置页、授权台账、extension storage、宽 host permission、新 API、新 WebSocket、新 mutation store
或第二 registry；只在现有认证协议增加唯一无业务载荷的 `TARGET_ACQUIRE` 帧，复用现有
`TARGET_CLAIM/ACK`，不得新增或保留 `tabs`/`activeTab` 权限。法案与精确 site policy 就是预授权来源。

## 3. 认领与 Workspace 原子边界

扩展只有在现有 WebSocket READY 已安装 permit authority 且收到 exact job 触发的一次 acquisition 后，才创建并
等待唯一 system Target 完成加载。它只附加该 Target，读取主 frame，复核主 frame URL 的精确 Origin，并在 Extension 内物理丢弃 pathname/query/fragment 后，只发送携带 `claimOrigin=https://chatgpt.com` 的现有加密 `TARGET_CLAIM`；claim 帧不得携带完整 URL 或 conversation identity。服务端必须再次用同一
`gpt-web` policy 精确校验 `claimOrigin`，并拒绝在未 revoke 时用不同 `targetRef` 覆盖现有 claim。只有服务端完成
注册、SQLite/WAL compact claim receipt 持久化并返回现有 ACK 后，扩展和服务端才可报告 Target PRESENT 与 Session Workspace 已建立。

同 Origin 主 frame 导航复用现有 claim 更新 Document lease；normal park 撤销 active claim/Workspace、释放 FIFO 并保留扩展内存 Target registry 与同一 debugger session；recovery park 只撤销上层 Workspace，保留原 Target/Document 并隔离唯一 Browser lane，
精确重领必须验证同一 tab、主 frame Origin 与 targetRef，随后由 GPT 的 canonical URL + marker + prompt hash 与适用的文本 response hash 或图片 media/content identity 重证当前 Document 的业务语义。内存 registry 存在时沿现役 parked 路径；registry 因 actor 重建丢失时只沿上一节精确 debugger-owned tab 路径重建同一 targetRef，不持久化 registry。DISPATCHED 仍必须匹配原 Document，重建产生的新 Document 不得满足其恢复；CONFIRMED submit 绝不得笼统接受“同 Target 的任意新 Document”，只接受发送源 D0，或该 exact submit 同一原子 Child 以同 Target、navigationEpoch 不变或精确 +1、initial exact-call evidence 的 hash-only `confirmed_submit_readback_document_hash` 唯一证明的直接后置 D1；D2、Target-only、epoch 跳跃、缺失或多义 hash 全部拒绝。跨 Origin、Target 关闭或异常 debugger detach 先走现有 revoke 路径；仅当 Provider submit 已有唯一 `CONFIRMED + passed` receipt 时，同一 accepted attempt 才能在权威证明旧 Target 不存在后通过现役 acquisition 建立一个不与旧 Tab 并存的新合法 system Target/Document，由 GPT 只读重证原 conversation/turn且 Provider mutation 为零。socket 断开只把 active claim 转为 parked，不 detach system Tab。正常 turn settle 不关闭 system Target；
异常 detach 或关闭后不得在同一 turn 争抢式重建。同 attempt 中，只有 Browser Owner 能证明当前 exact call 从未发生物理 dispatch且无 verified evidence 时，新 Target generation 才能执行该 call 的首次 mutation；DISPATCHED 或未确认事实只能精确重领原 Target/Document 只读 rehydrate。Browser Authority 权威证明原 Document 丢失时，target_local 当前 attempt 以 `REJECTED + mutation_outcome=dispatched` typed fail-close 并释放 Browser lane，不得重放；provider_effect 不得使用该简化结算。换 Target 唯一允许边界是 Provider submit 已有唯一 `CONFIRMED + passed` receipt 后，经现役 acquisition 在旧 Target 已权威不存在时建立新合法 system Target/Document并只读重证。final fork 是同一已鉴权 command 内的封闭物理接管：其唯一 provider-effect click 只读验证 Provider 新开的恰好一个合法 gpt-web page、source conversation content 与 child route，把同一逻辑 targetRef 转移到 child tab 并关闭 source tab；物理 tabId 改为 child tabId，Document/navigation epoch 递增且 reply 前恢复单页，不授予其它 call 跨 Target 重做资格。两者之外禁止换 Target；任何 fill/click/submit 等非 final-fork Provider mutation增量必须为零，Website 仍保留同一 accepted attempt。

### 3.1 Target-local evidence 与 WAL 事实

Browser WAL 是物理 mutation 先行 Owner，Forensics 是 exact-call evidence 唯一 Owner。两者身份分工固定为：

```text
Browser target-local mutation identity
  = exact call identity + target generation + Browser 物理绑定

Forensics evidence identity
  = exact call identity
```

target generation 只用于隔离物理页面世代，不得变成第二 evidence generation。Browser 只返回经验证的 mutation outcome、immutable terminalAt 和安全 authority hash，不向 Product 暴露 Target/Document/WAL row 或恢复决策。

`atomicStepRecovery` 先按完整 effect identity 查唯一 mutation，再独立校验 actionOrdinal；`callRecoveryScope` 只按 job/current attempt/plugin/version/step/provider scope 定位原 parked Target。结果多义或跨 attempt/version 必须失败关闭，不得合并成宽查询。

### 3.1.1 DOM observation typed cause

Browser Authority 必须把物理 Target/Document 生命周期与当前 Document 内的 DOM observation 结果分层返回：

```text
exact Target identity 不存在/不匹配       -> BROWSER_TARGET_INVALID
exact Document identity 不存在/不匹配     -> BROWSER_DOCUMENT_INVALID
selector 在 fresh Document 中候选为零     -> BROWSER_DOM_CANDIDATE_MISSING
selector 在 fresh Document 中候选多义     -> BROWSER_DOM_CANDIDATE_AMBIGUOUS
nodeId 因 Provider 重绘失效               -> BROWSER_DOM_NODE_STALE
已识别的 no-layout/no-box box model 结果   -> 当次不可见候选（不是 failure）
CDP record/number/coordinate payload 无效 -> BROWSER_DOM_READ_INVALID
```

`BROWSER_TARGET_INVALID` 不得再作为 query count、node missing、box model、visibility、record/number/string decode 的通用兜底。DevTools 精确返回已识别的 no-layout/no-box 时，Browser 只把该 node 作为本轮不可见候选过滤掉；node stale 必须丢弃旧 nodeId 并返回 `BROWSER_DOM_NODE_STALE`；只有 record、number 或 coordinate 的 CDP payload 真实畸形时才返回 `BROWSER_DOM_READ_INVALID`。Browser 只报告原子 observation 事实，不决定 GPT Child 是否在自己的 timeout 内 fresh retry。fresh retry 必须重新 query 当前 Document，不能复用 nodeId，不进入 mutation WAL，也不能改变此前 submit 的 `CONFIRMED`、immutable terminalAt、evidence identity 或 Target ownership。真正 Target/Document lifecycle failure 原样返回，由上层现役 confirmed-submit readback 合同保留成果事实；Browser 不解释 Product 步骤、attempt 预算或业务终态，不新增 selector fallback、第二 DOM 读取链或第二上传路径。

恢复查询取得的旧 `CONFIRMED` mutation 只证明原 submit effect 与原 Target/Document 锚点，不得覆盖当前 observation 的动作类别或结果。当前 locator 获取、DOM 读取、导航后核验等只读动作失败时必须保持自己的 `mutationOutcome=no` 与原生 typed cause；Browser lane/coordinator 只能把旧 receipt 作为独立的 `confirmed_submit` 事实随结果携带，禁止把旧 `CONFIRMED` 贴成当前只读失败的 mutation outcome。

Browser terminal fact 的跨层安全投影固定同时携带 `child_capability_id + effect_scope + browser_outcome + mutation_outcome + evidence_ref/hash`，并直接来自唯一 compact WAL row。`submit_exact_gpt_turn_once + provider_effect + CONFIRMED` 与独立 confirmed-submit receipt、provider effect fact、initial exact-call evidence 唯一闭合后，立即保护 Website 同一 accepted attempt 与原 pending evidence。locator 未闭合前的 source-only authorization 必须精确重领发送源 D0，或该 exact submit 同一原子 Child 以同 Target、navigationEpoch 不变或精确 +1、initial evidence hash 唯一证明的直接后置 D1，只允许同一 coherent currentUrl 上的 observation/settle/locator 写入，禁止导航、替换 Target、下载媒体或 mutation；locator 闭合后的 full authorization 才放行 exact canonical navigation 与既有 observation/focus/wait/media read envelope。park/reacquire 后策略跟随新 lease。locator 暂缺、损坏、多义或原 Document 消失只结束本次 probe并保持 pending，不得重提。`target_local + REJECTED` 不能冒充 confirmed submit。Browser 只报告和机械执行，不裁决 attempt、Product Flow 或业务完成。

### 3.1.2 调用期 coherent DOM observation

页面 Child 的最小 Browser 读取单位是一份调用期稀疏事实包，不是跨命令积累的 nodeId 或 snapshot：

```text
BrowserDomObservationPacketV2<TFacts>
  exact_call_identity_hash
  target_ref_hash
  document_ref_hash
  currentUrl
  observation_revision_hash
  observed_at
  facts: TFacts
  native_cause_code | null
```

Browser Extension 必须在一条 typed observation 的同一次同步 `Runtime.callFunctionOn` 中只读一次 `location.href`，并同时完成该 Child 所需的 scope、候选与机械字段读取；不得以 `Page.getFrameTree`、另一次 Browser API/DOM URL 读取或 caller 值拼装。URL 在离开 Extension 前必须按唯一规则处理：protocol 精确为 `https:`、origin 精确为 `https://chatgpt.com`、username/password 任一存在即 fail-close、pathname 只允许 `/` 或 `/c/<单个非空且由 typed contract 固定上限的 opaque segment>`、query 物理丢弃、fragment 物理丢弃，最终只重建 `origin + pathname`；Browser 不检查 opaque segment 内部格式。清洗后的 `currentUrl` 必须与同包 DOM mechanical facts 一起进入 `observation_revision_hash`。只有 Browser 能机械证明读取期间 current Document 和 observation revision 均未改变时，才可组合内部多次 CDP read。`observation_revision_hash` 只证明这一次调用期事实一致，不持久化、不作为恢复身份，也不建立 snapshot registry。任一 currentUrl 缺失/非法、Document/revision 变化、node stale、调用未完整返回或字段 decode 失败都使整包作废；调用方只能丢弃并 fresh observe。

`TFacts` 只能包含真实消费者最少充分的机械事实：raw/eligible cardinality、真实 `isConnected`、layout、computed display/visibility/opacity、HTML hidden、aria-hidden、inert、HTML disabled、aria-disabled，以及当前 typed command 必需的 role/name/testId/label/value/checked/type。GPT Composer 允许额外返回 hash-only `exactEditableTextHash`：Browser 必须对 contenteditable 当前可编辑值使用与 fill 直接后置相同的唯一机械提取规范。exact GPT user turn 允许额外返回 hash-only `exactGptUserPromptHash`：Browser 先验证外层 turn 精确身份及唯一 user-role root，再裁决两个互斥正文结构；恰好一个 `[data-testid='collapsible-user-message-content']` 时读取长 Prompt，只有该节点为零时才允许读取恰好一个无元素子节点 `.whitespace-pre-wrap` 短 Prompt 叶子。长节点存在时短结构不参与；长/短正文或 user root 零项、多项均 typed fail-close。两种哈希都绑定同一 observation revision，不得返回 Prompt 正文、包含附件卡片或页面控制文字、互作 fallback，也不得把面向完整已渲染 user/assistant 容器的 `semanticTextHash` 改义。屏幕外只读历史 turn 不因 viewport 排除；viewport 与中心点 hit-test 只在真实物理指针动作需要时采集。隐藏 file input 不走普通可见性规则，只在专门 typed command 内证明 exact input、`type=file`、connected、current Document 与授权文件集合。

Browser 不解释模型、附件、Prompt、菜单或 fork 业务语义。GPT Child 源码冻结的私有 scope/query spec 只能通过认证 permit 进入对应固定 typed command；public caller 不能提供 selector、JavaScript、strategy、坐标或循环动作。日志和 proof 只投影稳定 hash、计数、stage、typed cause 与 evidence ref，不写 selector、DOM、Prompt、正文或路径。

Observation 升版采用一次性 V1→V2 删除式切换：Extension producer、Browser decoder、GPT consumer、acceptance 与 inspector 必须在同一 CHANGE 全部只认 `BrowserDomObservationPacketV2`，并物理删除 V1 类型、旧 decoder、旧 caller 与旧 fixtures。禁止 V1/V2 union、alias、optional `currentUrl`、feature flag、dual-read/write、fallback 或第二 observation command；现役同一 typed command、同一 WebSocket 与同一 Browser Owner 保持不变。

### 3.1.2.1 现役加密 wire 的精确原文边界

Browser Authority 不建立“原文总线”，但物理完成固定 typed command 必须看到对应的精确值。因此只有下列闭集可以在现役认证且 AES-GCM 加密的 WebSocket 中随单次调用瞬时通过：批准 Prompt/用户文本的 fill 请求；GPT Composer 当前可编辑值按 fill 直接后置同一唯一机械提取规范生成的 hash-only `exactEditableTextHash` reply；exact GPT user turn 的长 Prompt collapsible 节点或互斥短 Prompt `.whitespace-pre-wrap` 叶子按 deterministic semantic tree 生成且排除附件与控制文字的 hash-only `exactGptUserPromptHash` reply；exact assistant turn 专用 reply-only typed channel 的 `outerHTML + deterministic semanticText` 回复，后二者不得进入同一语义：两种 Prompt 哈希可进入通用 coherent observation，而 assistant 原文与 semantic text 不得进入；Browser grant resolver 在内存中解析出的批准本地路径的一次 file-input 请求；固定 start URL 或已验证 canonical conversation URL 的 navigation 请求；current Document 同一次 coherent observation 产生、清洗并进入 revision hash 的 `currentUrl` reply-only typed fact。现役 authenticated-media 的原始 bytes 回复保持不变；`delivery=probe` 只读，`delivery=visible-download` 只允许最终图片 checkpoint 的固定 compound mutation。

每项都必须同时绑定 exact call identity、Target、current Document、typed capability、一次性 permit/sequence 与 payload hash；请求或回复结束即释放。Prompt 和路径不得出现在 reply，DOM 原文只能交给调用 task 的现役 artifact Owner，完整 canonical conversation URL 正文只能持久于现役 submission-locator/continuation Owner。confirmed-submit source-only authorization 可由唯一 Browser WAL + Forensics receipt 派生并只绑定发送源 D0，或同一 exact submit 原子 Child 已按同 Target、navigationEpoch 不变或精确 +1、initial evidence hash 唯一证明的直接后置 D1 的同次 coherent currentUrl，零导航零 mutation；原始 D1 DocumentRef 只存在于 Browser 调用期，不得进入 Product、Runtime、日志、WAL 或新增持久层；只有 submission-locator 已验证 readback 后才升级 full recovery authorization，continuation 不得替代 locator 签发升级；两者都只作短生命周期 typed 内存投影，用毕释放，禁止写入 Browser WAL、artifact、row、log、proof、registry 或 ledger。`TARGET_CLAIM` 只含精确 claimOrigin，不能携带 currentUrl；GPT coherent reply 只含 revision-bound currentUrl，不能携带或消费 claimOrigin。Browser WAL、日志、proof、诊断和错误一律只允许 hash、长度、数量、ref、stage 和 typed cause；配对/claim 帧除 claimOrigin 外同样适用。cookie、token、credential、raw browser identity、任意资源 URL、通用 opaque payload 继续绝对禁止；禁止第二 WebSocket、Native Messaging、第二路径 resolver、第二 artifact store、URL table/registry/ledger、Browser URL WAL、V1/V2 dual-read/write、字段改名规避或 Browser 解释业务语义。

### 3.1.3 跨进程 mutation 单向门

mutation-capable command 的唯一顺序固定为：

```text
Browser Authority 校验 authority + exact call + typed permit
-> 同一 compact WAL row 写 PREPARED
-> 命令离开 Browser Authority 前写 DISPATCHED
-> Extension 同一命令重绑 exact Target/current Document
-> 机械重验 zero-action predicate、候选基数与动作资格
-> Provider 物理输入 0 或 1
-> 最后一个物理页面输入完成后，以唯一硬编码 2500ms read-not-before 保持同一 Target/current Document/claim/FIFO
-> 满 2500ms 后首次 fresh mechanical readback；只有源码冻结 final fork 可执行同命令 Browser-owned child-tab takeover normalization
-> CONFIRMED | REJECTED；回复/终局缺失保持 DISPATCHED
```

### 3.1.4 唯一页面动作后读回总闸门

总闸门按物理页面状态改变认定，不按现有 Child 或 Browser command 名单认定。点击、输入、清空、填写、DOM focus、鼠标与键盘事件、文件选择与上传、提交、`Page.navigate`、刷新、返回根页、切换会话、模型与推理档位、菜单开关、弹窗确认、tabs create、fork、轮询导航、恢复导航，以及未来新增的页面动作，都必须通过 Browser Authority 的同一 in-memory read-not-before。唯一常量固定为 `2500`，没有参数、环境变量、调用方 override、feature flag 或其它延迟档位。

起点是复合动作的最后一个物理页面输入已经完成。CDP dispatch acknowledgement、唯一 file chooser 事件、`Page.navigate` 的协议回包以及完成同一复合动作所必需的底层写入回包，可以在闸门内机械消费，但不能读取页面结果，也不能产生成功或失败 verdict。连续鼠标事件、按键 repeat 或“点击上传入口 -> chooser -> `DOM.setFileInputFiles`”只在最后一个输入后开始 2500ms。final fork 必须在最终 click 后等满 2500ms 才能第一次读取 Target 增量；navigation/create/reset/switch 必须在动作后等满 2500ms 才能第一次读取 frame、Document、currentUrl 或 DOM。

等待期间，同一 typed command 不返回动作结果，Target、current Document、claim 与唯一 FIFO 均不释放，不得 park、reacquire、切换会话或为轮询导航其它任务。2499ms 及以前，动作后 DOM、URL、frame、Target 集合、页面媒体、Browser postcondition 与上层 GPT/Product 判定读取总数必须为零；即使页面已显示成功或失败也不能提前结束。满 2500ms 后必须从 current Document 发起第一次 fresh coherent read，不得复用动作前、动作瞬间或缓存 packet。2500ms 只发放首读资格，不是成功证据；其后继续依源码冻结的机械正反 postcondition 和语义合同结算。既有 postcondition timeout 从首次可读时刻起算，不能被闸门吞掉。等待被 abort、撤权、超时、Target/Document 失效或读取失败时，原动作仍不得重放。

实现只有一个 Browser-owned 总闸门和一个常量；GPT Child 旧 2500ms helper、条件稳定窗口及其它页面动作后 sleep 必须物理删除。纯 observation 自身不设置新闸门，数据库、Website 请求、日志、checkpoint 与其它非页面动作完全不适用；但任何读取如果是某一页面动作后的首次结果读取，仍必须先满足该动作留下的 read-not-before。不得以内部动作、轮询动作、恢复动作、已有 Browser postcondition、Target-local scope 或未来新 command 为由绕过。

扩展只允许四种结算：zero-action predicate 已成立时 `CONFIRMED + mutation_outcome=no`；动作机械资格不成立时 `REJECTED + mutation_outcome=no`；一次 Provider 物理输入后按冻结正反 readback 结算 `CONFIRMED` 或 `REJECTED`，mutation outcome 只表达 `confirmed` 或实际可证明的 Provider 物理事实；已鉴权 exact `REPLY.errorCode` 必须结算 `REJECTED`，若不能证明输入为零则保留 `mutation_outcome=dispatched`；只有 deadline 前完全没收到终局 reply 才保持 `DISPATCHED + mutation_outcome=dispatched` 并记录 `BROWSER_COMMAND_RECEIPT_MISSING`。final fork 的正向 Browser readback 还必须在同一命令完成唯一新增合法 page、source conversation content 与 child route 验证、同一逻辑 targetRef 向 child tab 的物理转移、source tab 关闭、child Document/navigation epoch、现有 TARGET_CLAIM/ACK 与 settled 单页闭合；它不得导航 source 或关闭 child，也不增加第二 Provider 输入、第二 mutation row 或第二 Browser capability。Browser terminal、Provider 物理输入事实、GPT 直接语义后置互相正交，不从邻近事件或普通抛错推断。

同一 exact call 一经 DISPATCHED 就只能 settle/rehydrate，不得 fresh re-act；新 Target/Document generation 不产生重做资格。keypress 的有界 repeat 仍是一条 typed command、一次 dispatch。file input 仍只是一条 `browser.file-input.v1` typed command 和一条 WAL mutation：Extension 必须先开启 file-chooser interception，再在同一 current Document 中 fresh 机械重验 GPT 源码冻结的唯一活动菜单 scope 与唯一可见“从电脑上传”叶子并仅派发一次物理点击；从点击开始到批量 file set 与 interception 关闭完成为同一 capture 窗口，该窗口必须只收到一个 `Page.fileChooserOpened` 事件且其 backend node 精确等于同文档唯一 `#upload-files`，随后才对该 chooser node 执行一次批量 `DOM.setFileInputFiles`并读回批准集。点击触发及 chooser 首事件必须共同受同一有界 deadline 约束。点击、chooser 绑定和 file set 是同一个 Provider 上传物理输入，不得拆成第二 Browser 命令、第二上传路径或 direct-hidden-input fallback；interception 必须在 finally 中关闭，点击后任一不可唯一证明的结果保留 `mutation_outcome=dispatched` 并失败关闭。keypress 和 file input 都不得扩展为通用 range/JavaScript engine。现役非空 WAL 只允许由唯一 Browser store 的前向 schema migration 原位补齐新机械字段和 readback，不得重建表、清空历史、双读写或增加第二 mutation store。

### 3.2 唯一 FIFO、Provider wait 与两种 park

Browser 只保留一条最多十个 waiter 的有界严格 FIFO。normal、inspection、recovery 使用相同 acquire 入口，无 priority、抢占、aging、保留槽或 recovery bypass。Provider wait 的 `nextCheckAt` 是 coroutine 瞬时事实，未到时不进 FIFO且不持久化。只有 GPT Owner 的 `wait_for_stable_gpt_text`/`wait_for_stable_gpt_image` 在等待产物、fresh currentUrl 不等于目标 canonical conversation URL 且即将实际跨 conversation URL 查证结果时，另以 GPT 全进程共享的单调资格保证任意相邻导航至少间隔 30000ms。资格未到的调用必须先 normal park 释放 FIFO，到期重领后 fresh 重读 currentUrl；Browser 只执行同一 park/reacquire 与机械 navigate，不产生轮询时钟、不按 job 排程、不把通用 navigate 限流。同 URL DOM probe、附件、profile、模型、推理、Prompt、submit、checkpoint、fresh root、直接后置和 Runtime/Website 动作不属于该 30000ms 边界。

- normal Provider wait park：只在 exact submit 已 CONFIRMED、pending mutation 为零、当前无待收束 postcondition 且 Target/Document/conversation/turn 恢复锚点完整时允许；
- recovery park：专用于 unresolved DISPATCHED，必须保留原 Target/Document 与正负 postcondition 判据，并持有唯一 Browser lane 隔离；它不占 Website 业务槽，不阻塞非 Browser 工作；
- 只有 normal park 立即释放 FIFO，其它 job 才可在同一 system Tab 时间片执行。recovery park 禁止其它 Browser job 导航或 mutation，直到原现场只读收束，或 Browser Authority 权威证明原 Document 不存在并按 effect scope 结算：target_local 终结 `REJECTED + dispatched`，provider_effect 继续依 WAL/receipt/locator 对账。confirmed submit 后旧 Target 权威消失的唯一例外按第 3 节以新合法 system Target 只读重证且 mutation 为零。

Provider wait 的时间上限不再从 submit terminalAt 派生。Product 每次合法调用提供稳定 `probeBudgetMs`，GPT 在 invocation 内派生有限 `probeDeadlineAt=min(invocationStartedAt+probeBudgetMs, 当前 lease/abort 上限)`；同 invocation 的 park/reacquire 不刷新，后续同 accepted attempt 的新 invocation 可取得新的有限 budget。WAL 继续只在现有 compact row 冻结 immutable terminalAt 作为 effect 事实，不新建 terminal-time、wait 或恢复表。

### 3.2.1 唯一附件交接点

Website 继续是材料原件与 object binding 的唯一 durable Owner。Runtime 从 Website 下载后，只在当前 task-owned 临时目录保留已校验 bytes，并在当前 `job_id + attempt_id + exact execution binding` 下通过 Browser public facade 提交 `{artifactRef, localPath, sha256, bytes}` 及只能对该材料建立/清理 Provider 上传别名的 Runtime-owned 窄化调用。Product→GPT 输入严格保持 `{artifactRef, displayName, sha256, bytes}`，`providerDisplayName` 只由 GPT Owner 按 attempt + artifact 派生，随唯一 Browser attach 请求携带 `{artifactRef, providerDisplayName, expectedSha256, bytes}`。Product 不得传入或派生 `providerDisplayName`，GPT 不取得 `localPath`，Product 也不得调用 Browser 附件绑定。

Browser 先机械验证 `providerDisplayName` 是非空、NFC、非 `.`/`..`、无任何路径分隔符且在文件系统 basename 字节上限内的单一 basename，再经现有 execution artifact binding 调用 Runtime materializer。Runtime 只在原 task-owned 材料目录建立指向同一已校验 inode 的 hardlink 别名；同名已存在时必须同 inode、hash 与 bytes 全等才可幂等重用，否则 typed fail-close。hardlink 不可用时直接失败，禁止 copy fallback。Browser 继续只用现有唯一 resolver 对别名路径重验 exact basename、realpath、regular-file、SHA-256 和 bytes，然后签发 execution-scoped file grant；binding settle/abort 必须调用 Runtime 清理该别名并释放全部内存绑定。进程重启后 Browser 映射为空，Runtime 只能从 Website durable truth 重建原材料和本次调用期别名；同 attempt 已有经验证 `CONFIRMED` attach 时只读对账，不得再次物理上传或构造别名。Browser 不得复制附件、创建 Browser 私有上传目录、持久 artifact registry、保留 settle 后映射，或建立第二 resolver/store/ledger。完整本地路径只能在 Browser 已鉴权 file-input 命令调用期进入 request，不进入 reply、WAL、log、proof 或 error。

Browser Authority 同时是当前已鉴权页面资源传输与可见下载动作的唯一 Owner。调用方只能提交 GPT Owner 已在紧邻 user turn 的 exact 外层 assistant section 中机械确认的 assistantTurnId、semanticMediaId、预期 media type、task-owned 接收端口，以及封闭枚举 `delivery=probe|visible-download`；不能提交任意资源 URL、cookie、token、selector、坐标、下载策略或第二 transport 指令。扩展必须在同一个 typed command 内重新证明当前 exact Target/Document 中该 assistantTurnId section 恰好一个；section 不要求内层 assistant-role 节点或可见文本。候选只作机械身份确认：connected、complete、naturalWidth/Height 为正、非零布局且 computed display/visibility/opacity 非隐藏、非空 NFC 语义 alt；禁止任意像素阈值或取首节点。物理节点先按页面内资源 identity 收敛，再用现有登录会话取得每个候选的原始 bytes 并按 content hash 去重，最终必须恰好一个 content identity；同 bytes 的重复 raw img/URL alias 不能形成第二业务媒体。可见下载还必须证明该媒体 alt 精确符合 `已生成图片：<非空 NFC 标题>`，只能激活承载该冻结媒体的唯一可交互祖先容器；图片查看器必须恰好一个且其 aria-label 与从该 alt 去掉一次固定前缀 `已生成图片：` 所得标题完全相等，分享菜单不得作为候选。

`delivery=probe` 只用于 `wait_for_stable_gpt_image`，只读取 bytes/hash，页面输入为零。`delivery=visible-download` 只用于最终 `checkpoint_gpt_generated_image`：先冻结媒体 hash，并证明媒体 alt 精确符合 `已生成图片：<非空 NFC 标题>`；在精确 assistant section 内只允许一个承载该媒体的可交互图片容器，点击一次并在 Browser 总闸门后证明唯一 `[role='dialog']` 图片查看器，其 aria-label 必须精确等于从冻结媒体 alt 去掉一次固定前缀所得标题；再在该 dialog 内只允许一个 `button[aria-label='保存']`，点击一次并等待同一主 frame 的唯一 Browser 原生 downloadWillBegin/downloadProgress completed 事实，completed bytes 必须与冻结原图字节数相等。最后一次输入后的总闸门满时重新取得原始 bytes，content hash 必须与冻结值相同。两个依赖输入属于一个 typed compound mutation，只写一个 PREPARED/DISPATCHED WAL row、只签发一个 terminal receipt；同一 WAL row 持久绑定 `physical_input_count=0..2`、不可逆 download-guid hash 与下载完成事实，恢复只能按这些机械事实只读对账。0/1/2 次部分动作都按真实 mutation outcome 结算，任何失败不得重放、拆分或由调用方编排。

原始 bytes 经同一加密 WebSocket authority reply 交给 task-owned 接收端和现役 artifact/checkpoint Owner；Browser reply 必须绑定不可逆 Target/Document hash、assistantTurnId、semanticMediaId、content hash、bytes、media type、尺寸、`imageOpened/saveClicked/downloadCompleted`、download-guid hash 与适用的 compound click 事实，GPT task-owned receipt 再绑定 canonical conversation、turn marker、prompt hash 和直接前驱 text receipt；raw Target/Document、download guid、资源 URL 与本地下载路径不离开 Browser。资源 URL 只可作为页面内短期实现细节，不得进入调用合同、日志或持久证据；页面外直接请求、截图、DOM URL、重复 raw 节点或 selector fallback 均不是原件。该实现只扩展现有 authenticated-media typed capability 与现有 Browser WAL 行，不新增 downloader、公开 Child、对象库、下载 API、网络链、mutation store 或上传链。

## 4. 配对、更新与失败关闭

固定扩展 ID、loopback pairing route、P-256 ECDSA/ECDH、HKDF、AES-GCM、内存一次性密钥、
`releaseBuildId` 比对与 `chrome.runtime.reload()` 继续复用现役单链。构建身份不一致时先 reload，不得配对或
认领；后续插件源更新由 `grasseye:start` 同步固定 artifact，扩展自行 reload，通常无需再次手工更新。

Workbench 不存在、LNA 阻止、配对响应非法、握手失败、创建失败、加载未完成、Origin 错误、debugger 冲突、服务端拒绝、ACK 超时、
导航越界、异常 debugger detach 或 revoke 都保持 Target/Workspace absent；Shell 与 Authority 诊断事实不得被覆盖。异常 detach/channel failure 必须把最内层 Browser 原生 code/cause 贯穿 GPT typed failure、Runtime Log 与 Website current_reason，不得由 `BROWSER_INFRASTRUCTURE_FAILED` 或其它外层通用码替换。job-bound 认领失败
不伪装成配对失败，也不得触发任务创建、任务认领或任务执行。

## 5. 删除式迁移

物理删除 popup 的手动认领按钮、`GRASSEYE_CLAIM_ACTIVE_TARGET` runtime handler、active-tab 查询认领函数、
`activeTab` permission 及其质检断言。保留现有 pairing、encrypted WebSocket、target registry、claim ACK、
revoke、compact mutation receipt 和 Session Workspace；同时物理删除 `READY -> claimPreauthorizedChatGptTarget` 自动链与
session-level Target claim gate。唯一时序为 exact job durable 接受 -> 同一加密 WebSocket acquisition ->
唯一 visible inactive system Target 创建并完成加载 -> 无聚焦 Page.getFrameTree -> 现有 TARGET_CLAIM/ACK -> park/revoke logical claim 但保留 system Tab/debugger session；
物理删除“查询并复用既存 ChatGPT Target”、单/多候选选择分支及其测试，不存在 manual/auto 兼容桥、feature flag、
fallback 或第二 claim path。

同时物理删除 reconciliation 抢占旁路和“一个任务现场把十个业务槽或全局 Runtime ledger 置假”的判定。普通执行与恢复执行统一进入同一有界 FIFO；但任一 unresolved DISPATCHED 必须由现有 lane 的唯一 owner/quarantine 状态阻止同 Tab 上的后续 Browser 导航和 mutation，直到只读收束或按 effect scope 终结。这不是第二 queue、第二 recovery lane 或业务 capacity gate。恢复身份只从 Browser WAL 按 job + plugin step 派生，不接受调用方自报。

## 6. 质检与真实验收

本次总闸门必须由确定性时钟逐项证明：每一种现役页面物理动作在 2499ms 时动作后读取为零，2500ms 满后第一次读取来自 fresh current Document；等待期同一 Target、Document、claim 与 FIFO 未释放；成功态与失败态都不能提前；Browser 自带 postcondition、final fork Target 增量读取、轮询/恢复导航、弹窗与菜单、file chooser/批量 file set、keypress repeat、navigation/create/reset/switch 均受同一常量约束；postcondition timeout 从首次可读时刻起算；abort、撤权、Document 丢失与读回失败的物理动作重放次数为零。静态 inspector 必须从真实调用图和 AST 证明唯一硬编码 `2500`、调用方无 delay 参数或 override、GPT Child 旧 timing helper 已物理缺席，且新增页面动作若未登记为 Browser state-changing method 或未经过同一 gate 会使唯一 `quality:check` 失败。不得以测试文件的字符串搜索、手写动作总数或第二 allowlist 冒充生产调用图。

1. 构建与静态质检证明 manifest 无 `activeTab`/storage/宽 host，popup 无手动认领入口，源码无旧 handler。
2. 确定性测试覆盖 Authority READY 与空闲期间不创建/认领、首个 job-bound acquisition 后忽略既存操作者页面并只创建一个
   inactive visible Target、加载完成前不 attach、精确 Origin 复核、创建/claim/reacquire 的零 `Page.bringToFront/windows.update focused=true/tabs.update active=true`、debugger 冲突、服务端拒绝、ACK 超时、同 Origin
   Document 更新、跨 Origin revoke、正常 settle/断线不 close/detach、park/revoke/FIFO release、跨 job 同 Target 时间片复用、
   整体销毁并重建 `ExtensionTargetAuthority` 后从仍由本扩展 debugger 持有的精确 tabId 恢复同一 targetRef 且不调用 attach/create、attached=false/Origin 错误/多义时立即 `BROWSER_EXACT_TARGET_UNAVAILABLE`，DISPATCHED 原 Document 不因新 Document 被误放行，Provider effect 按唯一 `provider_effect_identity_hash` 跨 attempt/lease/process/Target/build 禁重放；已有 DISPATCHED、CONFIRMED、`REJECTED + dispatched|confirmed`、当前 attempt 记录、identity/attempt 多义或记录冲突时 PREPARED 与物理 mutation 增量为零；只有全部历史均为不同旧 attempt 的 `REJECTED + no` 且 Website 新签发的 accepted attempt 不同于全部旧记录时才能再次 PREPARED，同 attempt 已有 verified evidence 的 Target-local call 跨 Target generation 物理 mutation count 为零、原 Document 权威不存在时 target_local 精确结算 `REJECTED + dispatched`、provider_effect 仍留在 receipt/locator 只读对账；另须覆盖 confirmed submit 后原 Target 被关闭或异常 detach，同一 accepted attempt 在 locator pending 时只于发送源 D0 或同一 submit 原子 Child 已证明的直接后置 D1 source-only reconcile，并覆盖 D0/合法 D1 与 D2、epoch 跳跃、Target-only、hash 缺失或多义拒绝矩阵，locator 闭合后才经现役 acquisition 取得新合法 system Target/Document、GPT 只读导航并重证原 conversation/turn、fill/click/submit mutation count 全为零且继续取得原成果；以及一个 job 的 unresolved DISPATCHED 只隔离 Browser lane、不占 Website 业务槽且不阻塞非 Browser 工作，隔离期间后续 Browser job 导航/mutation 增量为零，
   以及 DOM candidate 零/多、Provider 重绘后的 stale node、已识别 no-layout/no-box 与真实畸形 CDP payload 分别映射为 missing/ambiguous、`BROWSER_DOM_NODE_STALE`、当次不可见候选与 `BROWSER_DOM_READ_INVALID`，真正 Target/Document failure 不得与它们混淆；fresh retry 丢弃旧 nodeId、重新 query 且物理 mutation增量为零、既有 CONFIRMED WAL 不变；同 URL fresh reset 仍必须产生新 loaderId/Document，返回相同或缺失 loaderId 必须失败关闭，且第二 Tab、附件 X、操作者页面 mutation count 均为零；以及 exact 外层 assistant section 在内层 assistant-role/text 都缺席时仍可凭唯一 semanticMediaId 取得媒体、section 零/一/多的原子判定、三个 raw img 仅一个完整可见非空 alt 语义媒体、display/visibility/opacity 隐藏负例、同 URL 与不同 URL 同 bytes 的 content-hash 去重、两个不同 content hash 拒绝、fetch rejection 映射稳定 Browser code、跨 turn/Document 拒绝、绑定 Target/Document hash 与 conversation/turn/prompt/content identity 的已鉴权原始 bytes receipt，异常 debugger detach 原生 cause 不被外层通用码覆盖。
   DOM/WAL 聚焦分母还必须逐字段覆盖 coherent packet 的 exact call/Target/Document/currentUrl/revision/observedAt、raw/eligible count、connected、layout、display/visibility/opacity、hidden/aria-hidden/inert、disabled/aria-disabled、role/name/testId/label/value/checked/type、按需 viewport/hit-test 与 native cause/stage；每个字段分别 mutate，调用中途 redraw/Document change 必须令整包失效。URL 专项必须证明 `location.href` 与 DOM facts 只在同一次 `Runtime.callFunctionOn` 读取一次，query/fragment 总是物理丢弃，userinfo、非 https、非精确 Origin、多段/空 conversation path、缺失 currentUrl 均整包 fail-close，`currentUrl` 任一改变都会改变 observationRevisionHash；从 TARGET_CLAIM、Page.getFrameTree、第二次读取或 caller 拼装的 mutant 必须被杀死。还必须证明 TARGET_CLAIM wire 只有 claimOrigin、coherent reply 只有 currentUrl、通用 observation 不含 rawDomHtml/semanticText、专用 assistant-turn reply-only channel 才可返回二者，以及完整 URL 不进入 Browser WAL/log/proof/registry。mutation property/mutant 必须覆盖 PREPARED、发送前 DISPATCHED、扩展 zero-action、qualification reject、一次 click、bounded keypress、隐藏 file input、明确 `REPLY.errorCode`、真实 reply 丢失、disconnect、late reply、扩展崩溃、动作前/动作后失败、新 generation 禁重做和非空旧 WAL 前向迁移；必须走完 `Extension REPLY.errorCode -> WebSocket acceptReply -> BrowserCommandActor -> WAL` 真实调用链，证明明确错误结算 REJECTED 而非 receipt missing，只有无 reply 保留 DISPATCHED。任何第二 dispatch、direct hidden-slider write、new range command、任意 JavaScript/selector、schema rebuild 或从 mutation outcome 推断 Browser terminal 的 mutant 都必须被杀死。
   附件分母必须从 Runtime 生产下载的 task-owned 临时文件走到 Browser public binding、GPT 传入的 exact `providerDisplayName`、Runtime 同 inode hardlink、Browser 唯一 resolver 对 exact basename/realpath/hash/bytes 的重验和唯一 file-input grant；必须读回 file-input 实际路径 basename 等于 `providerDisplayName`、文件 bytes/hash 不变、同名同 inode 幂等复用、同名异 inode 失败、非安全 basename 在 materializer 前失败、hardlink 失败时零 copy fallback、settle/abort 后别名与内存绑定均缺席；还必须证明同一 typed command 内唯一活动菜单的精确可见上传叶子只点击一次、只接受一个且绑定唯一 `#upload-files` 的 chooser 事件、该 chooser node 只执行一次 `DOM.setFileInputFiles`、interception 成功失败都关闭，direct hidden input、chooser 超时后重试、backend node 错配、第二点击和第二上传路径的 mutant 全部失败。证明生产 consumer 真实可达、重启从 Website durable truth 重建，Browser 复制、Browser 私有附件目录、第二 resolver、持久 registry 与 settle 后残留的 mutant 全部失败。
   final fork 专项必须覆盖：dispatch 前基准集合、最终叶子恰好一次 click、零/一/多新增 Target、非 page、跨 Origin、attach/frame/child 接管/source tab 关闭/claim 失败，以及正向的唯一新增 gpt-web page；正向路径必须证明 source conversation content 与 current child route 已验证、同一逻辑 targetRef 已转移到 child tab、source tab 已关闭、物理 tabId 已切换为 child tabId、Document/navigation epoch 递增、settled production page 恰好一个、GPT/Product reply 无 tabId/URL/target 集合，且 Page.navigate 与 child close 计数均为零。最终 click 后任一不确定失败都不得重发，必须按真实 reply 保留 `REJECTED + dispatched` 或终局缺失的 `DISPATCHED + dispatched`。还必须以真实 DOM fixture 证明 assistant rich tree 的完整语义 serializer 不因唯一 code block 截断兄弟内容，且 coherent hash 与 exact-assistant-turn hash相同；纯 code-only 回答保持干净正文。
   Prompt/media 专项还必须证明：exact 外层 user turn 内唯一 user-role root 下，长 Prompt 的唯一 collapsible 节点和短 Prompt 的唯一无元素 `.whitespace-pre-wrap` 叶子分别产生正确且相同规范的 hash-only identity；长节点存在时短结构不参与，长/短节点缺失、多义或结构冲突分别 typed fail-close。图片等待的 `delivery=probe` 物理点击数必须为零；最终 checkpoint 的 `delivery=visible-download` 必须真实命中一次 assistant-turn-scoped 语义主图容器与一次 viewer-scoped `button[aria-label='保存']`，取得同一主 frame 的唯一原生下载开始/完成事件、download-guid hash 和相同完成字节数；两个依赖输入只产生一个 WAL terminal，同一 WAL row 忠实读回 0..2 次物理输入，并在最后闸门后读回相同 media hash。图片容器、viewer、保存、原生下载任一零/多、部分点击、下载中断、媒体漂移、reply 丢失和恢复重领都不得重放；分享菜单点击数必须为零。
3. 服务端测试证明 TARGET_CLAIM 缺失或不精确等于 `https://chatgpt.com` 的 claimOrigin、claim 帧出现完整 URL/path/query/fragment/conversation identity、未 revoke 的不同 `targetRef` 覆盖和未确认 Workspace全部失败；claimOrigin 不得进入 GPT coherent packet。
4. 真实 Chrome 证明：启动 AGENT 后固定扩展自动配对且 Target absent；无需复制密码或点击 popup；首个 exact job
   durable 接受后才以 `tabs.create({active:false})` 创建唯一 visible system ChatGPT Target，且操作者既存页面、当前 Tab 和前台应用完全不受影响；五个并发业务任务始终只有该一个 tabId/targetRef，不人工点击也能执行。五个任务必须分别产生可读 `acquire -> 页面 Child -> normal park -> reacquire -> checkpoint -> Product 下一步` 纵向证据，每个任务至少一次获得 Browser 时间片且无饥饿，页面切换以相应 Target/Document/currentUrl 事实证明而不是日志口号。每个 normal wait 短 probe 必须依次产生同一 targetRef 的 park/无聚焦 reacquire，normal park 撤销 active claim/Workspace 并释放 FIFO，扩展保留同一 debugger session、tabId 与 parked registry；随后真实重启 MV3 actor，在不点击页面、不创建 Tab、不重新 attach、不前台化的情况下从同一 debugger-owned tabId 恢复同一 targetRef 与新 Document。操作者先切到其它应用，再切到其它 Chrome Tab 的两组验收中，reacquire 都只执行 `Page.getFrameTree` 且必须继续上传、submit、按 invocation 有限 probeBudgetMs 轮询、checkpoint 与 Product 下一步，`tabs.create active=true/Page.bringToFront/windows.update focused=true/tabs.update active=true` 计数必须为零；正常 DOM 重绘不得再产生 `BROWSER_TARGET_INVALID`，真正 lifecycle failure 必须保留自己的精确 code；不得留下两个并存 production Tab或未终态 Browser 调用。还必须用真实附件证明：Runtime 生产 material 经 Browser public binding 真实可达，Browser 不复制且 settle/abort 释放绑定；文件卡片先出现、曾短暂无 layout box 或仍有 scoped spinner 时系统继续在同一 Product timeout 内 fresh query，唯一 composer 内全部精确可见卡片且 scoped spinner 为零后 `write_exact_gpt_prompt` 实际开始，随后 exact prompt readback 与单次 submit 成功，全过程无第二次 file-input、prompt fill 或 submit mutation。上一 job 留有附件卡片时，下一 fresh job 只能在无 unresolved DISPATCHED 隔离后于同一 Target 强制取得新 loaderId/Document，并由 `prepare_clean_gpt_chat` 证明 attachment=0，且不点击 X、不建第二 Tab。normal park 后其它 job 可在同一 Tab 时间片执行；recovery park 期间其它 Browser job 导航/mutation 必须为零，但 Website 业务槽和非 Browser 工作不得被占死。原 job 重领时以 canonical URL + marker + 请求正文 prompt hash + 文本 response hash 或图片 media/content identity 回到正确回合，外层 user turn 的附件卡片与控制文字不得改变 prompt hash。AGENT 重启且原 Target 仍在时不新建 Tab、不重发已 CONFIRMED submit，并继续 SEO 下一步；Provider terminalAt 不变且不充当 wait 寿命；超过首次 submit 一小时后，同 attempt 的新 invocation 仍取得新的有限 probeBudgetMs，submit 总数保持一。还必须完成一条真实 Chrome 端到端故障验收：图片 submit 已唯一 `CONFIRMED + passed` 后，物理关闭原 system Target或制造真实异常 debugger detach，权威确认旧 Target 已不存在；Website 保留同一 accepted attempt，现役 acquisition 只创建一个 inactive 替代 system Target/Document，GPT 导航原 conversation 并用 locator 重证原 user turn，所有 attach/profile/prompt/draft/submit Provider mutation 增量为零，随后取得原图 bytes、生成 1200×630 WebP、checkpoint、staging 并取得同一 job 的 Website business admission receipt。turn settle 后 system Tab parked 而非关闭，后续 fresh job 复位根页并复用同一 Target。
   真实 Chrome 的 fork 验收还必须在源会话依次操作“更多操作 -> 打开新分支 -> 分支到新聊天”；Browser 只机械执行 GPT 在 exact source assistant turn 内冻结的唯一 `button[aria-label='更多操作']` query，并独立返回 aria-expanded 事实；`aria-haspopup` 不得作为 selector 或资格条件。不得解释本地化语义、恢复已消失的 `button[data-testid='more-turn-action-button']`、接受 OR/fallback 或建立第二 query 链。验收必须证明 Provider 实际新开页只在最终 Browser command 内被只读验证为唯一 child，并与 source conversation content 闭合；Browser 把同一逻辑 targetRef 接管到 child tab 后关闭 source tab，terminal reply 前只剩 child 物理 tabId 对应的一个 system-owned production Tab，且不得关闭 child 或导航 source；Document/navigation epoch 递增，子会话 URL/marker/relation 从 child Document 读回，操作者页面、当前前台 Tab 和应用焦点均未改变，任何步骤不得出现第二次 Provider 点击或第二执行链。
   上述真实附件验收中的 readiness 还必须由同一 coherent observation 证明 composer-scoped 可见 `button.cursor-wait` 数为零；卡片、ready 图标已出现且 spinner 为零、但该 pending action 仍存在时不得启动 Prompt，必须继续沿同一 Product timeout fresh observe，不得固定 sleep、重传或建立第二读取链。
5. 启动器检查证明 scripts/startup 与 `grasseye:start` 不使用 Chrome Target API、不打开 ChatGPT、不发送
   `TARGET_CLAIM`、不创建或认领任务。

静态、单项 acceptance 与构建通过只证明 CHANGE。只有当前候选的唯一完整 CI、全新独立只读治理审计和
真实 Chrome 均通过，才可报告本次生产候选实测成功；READY、RELEASE 与部署仍分别报告。

正文闭环：终态 Owner 是 `local-browser-session`；输入是当前 release identity、精确 Extension Origin、
exact job 接受事实、唯一 system Chrome Target 元数据，以及需要时的精确 assistant turn 媒体 identity；输出是已确认的
connection-bound Workspace receipt 或绑定 content identity 的已鉴权媒体 receipt。状态只持久进入现有 SQLite/WAL
compact mutation row 与调用方现役 artifact/checkpoint，调用方向固定为 Extension -> Workbench -> Browser Owner。失败恢复将 exact Target/Document 停放为任务局部现场；normal park 释放 Workspace/FIFO，unresolved DISPATCHED 的 recovery park 只释放上层 Workspace 并隔离唯一 Browser lane，不占业务槽或阻塞非 Browser 工作，
安全边界拒绝调用方 selector、坐标和 tab 身份；验收必须同时证明 settled 唯一 system Target、final fork 同命令内唯一受控 successor normalization、逻辑 targetRef 不变但物理 tabId 切换为 child、source 关闭且 child 存活、既存页面零影响、正常 settle 不关闭、
normal park 后释放 FIFO、recovery park 隔离 Browser lane、跨 job 单 Tab 时间片、URL + marker + prompt hash 与适用的 text response hash 或 image media/content identity 精确重领、生成媒体原始 bytes 的唯一已鉴权链和 revoke 后失效；mutation outcome 只能是
现役三值枚举，不得产生额外状态。

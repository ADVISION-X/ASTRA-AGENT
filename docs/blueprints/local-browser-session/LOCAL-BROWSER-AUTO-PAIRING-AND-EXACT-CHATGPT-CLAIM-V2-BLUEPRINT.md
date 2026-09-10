# GrassEye 单生产 Tab、交互就绪、可信 DOM 事实与唯一 Browser FIFO V23 施工图

状态：active final-state blueprint
Owner：`local-browser-session`

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "local-browser-auto-pairing-and-exact-chatgpt-claim-v23",
  "status": "active",
  "owner": "local-browser-session",
  "lawIds": [
    "LAW-LOCAL-BROWSER-SESSION-001-V4",
    "LAW-LOCAL-BROWSER-SESSION-002-V6",
    "LAW-LOCAL-BROWSER-SESSION-003-V27",
    "LAW-LOCAL-BROWSER-SESSION-004-V29",
    "LAW-LOCAL-BROWSER-SESSION-005-V6",
    "LAW-LOCAL-BROWSER-SESSION-006-V20"
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
-> 纯读取、Provider wait 与 park/reacquire 保持 system Tab 在后台；只有已获 mutation permit 且唯一 Browser WAL 已进入 DISPATCHED 的命令，在 Provider 输入前经过交互就绪闸门
-> system Tab 已 active 时不更新；非 active 时只执行一次 `tabs.update(tabId,{active:true})`，复用同一 2500ms 页面动作总闸门后重新证明 tab/Target/Document 与动作资格，且不聚焦 Chrome 窗口；tabs 只证明交互状态，Origin 仍只由当前 debugger session 的主 frame 证明
-> 等待生成媒体时只在同一已鉴权 Target/Document 内以 `delivery=probe` 取回精确 assistant turn 原始 bytes；最终图片 checkpoint 以唯一 `delivery=visible-download` compound mutation 点击语义主图、打开同图查看器、点击唯一 `button[aria-label='保存']` 并等待原生下载完成；唯一 download tracker 保持到最终同一 bytes/hash 回读及结算后才清理，整条命令只使用一份覆盖全部合法阶段的 command/reply budget 并出具一个 receipt
-> 最终 fork click 触发 Provider 新页时，只在该同一 typed command 内允许受控瞬时双页：冻结点击前集合，唯一新增合法 gpt-web page 只读验证 source content 与 child route 后接管为同一逻辑 targetRef，再关闭 source tab
-> final fork terminal reply 前保持逻辑 targetRef、把物理 tabId 切换为 child tabId、递增 Document/navigation epoch 并恢复 settled production Tab 恰好一个，GPT/Product 不接触 tabId、URL 或 target 选择
-> 无未收束 DISPATCHED 时，Provider wait 或 turn settle 可 normal park：撤销 claim/Workspace 并释放 FIFO，system Tab 与 debugger session 保留
-> 存在未收束 DISPATCHED 时只能 recovery park：保留原 Target/Document 并隔离唯一 Browser lane，不占 Website 业务槽且不阻塞非 Browser 工作
-> 只有 normal park 释放后，其它 job 才按智慧指挥 FIFO 在同一 Tab 时间片执行；每次重领只做无聚焦精确验证，再用 conversation URL + marker + prompt hash 与适用的文本 response hash 或图片 media/content identity 定位
```

操作者不复制密码、不点击“认领当前标签页”，也不需要在 mutation 前手工点开 system Tab。启动器只同步固定扩展 artifact 并启动本地 Shell；它不读取、
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
- 只对首次 acquisition 创建并记录的 inactive system Tab 执行一次 debugger attach；正常 park、任务切换、turn settle 与 AGENT/WebSocket 重启均不 detach/close。创建、重领、纯读取、Provider wait 和轮询全部禁止 `Page.bringToFront`、`windows.update({focused:true})`、`tabs.update({active:true})` 以及任何等价前台化。只有下节 mutation 交互就绪闸门可对精确 system tab 执行一次 `tabs.update({active:true})`；它不改变 macOS 前台应用、不调用窗口聚焦、不恢复操作者原标签。操作者切换不会改变 Target 身份，但会撤销当次尚未输入的交互资格。
- 每一个 fresh job 在取得 claim 前都必须在同一 system Target 上无条件导航固定 start URL，即使当前 URL 已精确等于 start URL 也不得跳过；必须直接读回新的主 frame loaderId/Document identity，且相对上一停放 Document 已改变，随后 `prepare_clean_gpt_chat` 再证明 zero prior turn、zero attachment、empty draft 与 not generating。不得点击附件 X、创建第二 Tab、切到操作者页面或用旧 Document 冒充新任务。continuation/poll job 由 GPT Child 导航 exact canonical conversation URL，并校验 marker、prompt hash、紧邻 assistant，以及文本的 response hash 或图片的 mediaHash/content identity；禁止用 response hash 拒绝图片。
- MV3 actor/Service Worker 重建且内存 registry 为空时，只有 Browser WAL 恢复事实给出的确定 `target-tab-<tabId>` 才能触发精确重建：`chrome.debugger.getTargets()` 必须只命中一个同 tabId、`type=page`、`attached=true`、gpt-web Origin 的 Target，当前扩展必须在不调用 `attach` 且不改变 Tab/窗口前台状态的前提下成功执行 `Page.getFrameTree`，然后以同一 targetRef 和当前主 frame 登记一个新 Document。零个、多于一个、未 attached、Origin 不符或当前扩展不能发送 Page 命令都立即返回 `BROWSER_EXACT_TARGET_UNAVAILABLE`，不得建新 Tab、重新 attach、将页面前台化或猜操作者页面。
- final fork successor normalization：Browser 在最终 click dispatch 前取得仅含本扩展 system-owned production page 的基准集合，动作后有界等待并计算新增集合；只有恰好一个 `type=page`、gpt-web 精确 Origin 的新 Target 时才可 attach、启用并只读验证其合法主 frame、source conversation content 与 current child route。Browser 随后必须把同一逻辑 `targetRef` 的物理绑定原子切换为 child tabId，以递增 navigation epoch 签发新 Document，用现有 `TARGET_CLAIM/ACK` 发布该 child Document，再 detach 并关闭 source tab；不得关闭 child，不得对 source 或 `/c/WEB:<opaque>` 执行 `Page.navigate`。最终 click 只可复用同一 mutation 交互就绪闸门选中 source system Tab；successor normalization 本身不得再次调用 tabs.update，且全过程禁止窗口聚焦、不得触碰操作者页面。extension REPLY 前必须读回本扩展 settled production page 恰好一个并证明它就是接管后的 child。新增零个/多个、Origin 非法、attach/frame/child 接管/source 关闭/claim 或单页读回任一失败都返回稳定 Browser typed cause；若已执行最终 click却无法证明未产生 Provider effect，mutation outcome 必须保持 dispatched，绝不二次点击。该 normalization 不增加第二 Provider 动作、第二 WAL row 或第二执行链。GPT/Product 只收到同一逻辑 targetRef 所对应的新 Document 安全 receipt，不接收 tabId、URL、集合或选择策略。

不增加设置页、授权台账、extension storage、宽 host permission、新 API、新 WebSocket、新 mutation store
或第二 registry；只在现有认证协议增加唯一无业务载荷的 `TARGET_ACQUIRE` 帧，复用现有
`TARGET_CLAIM/ACK`，不得新增或保留 `tabs`/`activeTab` 权限。法案与精确 site policy 就是预授权来源。

### 2.1 唯一 mutation 交互就绪闸门

交互就绪不是公开 GPT Child，也不是新的 Browser command、WAL、状态表或恢复链。Extension command registry
必须把同一个已准入 command 的真实 `mutationClass` 交给 `ExtensionTargetAuthority`；只有值为 `mutation` 的
command 才进入下列固定顺序：

```text
现有 exact permit + system Target/Document + Browser WAL DISPATCHED
-> chrome.tabs.get(exact tabId)
-> 已 active：零次 tabs.update；非 active：恰好一次 tabs.update(tabId,{active:true})
-> 复用现役 PAGE_ACTION_READ_SETTLEMENT_MS=2500 的唯一 page-action gate
-> chrome.tabs.get(exact tabId) 并证明同 tab/window、active=true、discarded=false、status=complete
-> 由当前已 attach debugger session 的 Page.getFrameTree 主 frame 精确证明 gpt-web Origin；不得读取或要求 tab.url
-> 重新取得 exact Target/current Document，废弃激活前元素事实并 fresh qualification
-> 每次 Provider 物理输入前同步核对同 window 的 tabs.onActivated 当前 tab 与 generation
-> 执行原 typed command，沿原 WAL/REPLY 结算
```

`tabs.onActivated` 只保留扩展进程内、按 window 有界的当前 active tab 与递增 generation，不持久化、不上 wire、
不进入 WAL/Forensics。由本次 `tabs.update` 引发的同 tab 延迟事件不得制造第二 generation；不同 tab 事件必须
立即使当次资格失效。首次 Provider 输入前失效时返回唯一稳定码 `BROWSER_TARGET_NOT_INTERACTIVE`，并由现役
reply 链结算 `REJECTED + mutation_outcome=no`；一旦任一物理输入已经开始，后续切换、崩溃或不确定结果必须
保留 DISPATCHED 与真实 0..N 部分动作，不得重放。图片 compound mutation 在图片容器点击与“保存”点击前各复核
一次，因此第一次点击后被切走只能保持已 dispatch 事实，不能再次打开图片或保存。

`visible-download` 继续只用现役一个 Browser command deadline 和一个 WebSocket mutation reply deadline，但两者
必须覆盖激活闸门、图片点击后的 2500ms、viewer 有界等待、保存点击后的 2500ms、原生下载有界等待、媒体
fetch 与最终身份回读的完整合法最坏路径，不能只按下载阶段计算。保存前建立的唯一 download tracker 在首个
completed 后只冻结候选完成事实，直到最终媒体身份回读与 terminal settlement 结束仍继续接收事件；若此窗口
出现第二个 `downloadWillBegin`，唯一下载证明立即失败。结算后一次性清理该 tracker，不新增第二 deadline、
tracker、queue 或 transport。

闸门只选中 Browser Authority 自己登记并重新验证的精确 system tab；不得向 GPT/Product/Runtime 暴露 tabId，
不得使用 `windows.update({focused:true})`、`Page.bringToFront`、DOM `.click()`、`activeTab` permission、`tabs`
permission、ChatGPT host permission、专用窗口、
第二浏览器、后台硬点 fallback 或自动循环抢回。Browser 不保存、也不恢复操作者此前的普通标签；下一次新的合法
mutation 自己重新取得一次交互资格。若 system tab active 但 Chrome 窗口不在 macOS 前台的真实 A/B 不能成功，
本候选必须停止 RELEASE 并回到法案修订，不得在运行时偷偷追加窗口聚焦。

## 3. 认领与 Workspace 原子边界

扩展只有在现有 WebSocket READY 已安装 permit authority 且收到 exact job 触发的一次 acquisition 后，才创建并
等待唯一 system Target 完成加载。它只附加该 Target，读取主 frame，复核主 frame URL 的精确 Origin，并在 Extension 内物理丢弃 pathname/query/fragment 后，只发送携带 `claimOrigin=https://chatgpt.com` 的现有加密 `TARGET_CLAIM`；claim 帧不得携带完整 URL 或 conversation identity。服务端必须再次用同一
`gpt-web` policy 精确校验 `claimOrigin`，并拒绝在未 revoke 时用不同 `targetRef` 覆盖现有 claim。只有服务端完成
注册、SQLite/WAL compact claim receipt 持久化并返回现有 ACK 后，扩展和服务端才可报告 Target PRESENT 与 Session Workspace 已建立。

同 Origin 主 frame 导航复用现有 claim 更新 Document lease；normal park 撤销 active claim/Workspace、释放 FIFO 并保留扩展内存 Target registry 与同一 debugger session；recovery park 只撤销上层 Workspace，保留原 Target/Document 并隔离唯一 Browser lane，

### 3.1 Target-local evidence 与 WAL 事实

Browser WAL 是物理 mutation 先行 Owner，Forensics 是 exact-call evidence 唯一 Owner。两者身份分工固定为：

```text
Browser target-local mutation identity
  = exact call identity + target generation + Browser 物理绑定

Forensics evidence identity
  = exact call identity
```

target generation 只用于隔离物理页面世代，不得变成第二 evidence generation。Browser 只返回经验证的 mutation outcome、immutable terminalAt 和安全 authority hash，不向 Product 暴露 Target/Document/WAL row 或恢复决策。


### 3.1.1 DOM observation typed cause

Browser Authority 必须把物理 Target/Document 生命周期与当前 Document 内的 DOM observation 结果分层返回：

```text
exact Target identity 不存在/不匹配       -> BROWSER_TARGET_INVALID
exact Document identity 不存在/不匹配     -> BROWSER_DOCUMENT_INVALID
system Tab 无法唯一激活或输入前已被切走   -> BROWSER_TARGET_NOT_INTERACTIVE
selector 在 fresh Document 中候选为零     -> BROWSER_DOM_CANDIDATE_MISSING
selector 在 fresh Document 中候选多义     -> BROWSER_DOM_CANDIDATE_AMBIGUOUS
nodeId 因 Provider 重绘失效               -> BROWSER_DOM_NODE_STALE
已识别的 no-layout/no-box box model 结果   -> 当次不可见候选（不是 failure）
CDP record/number/coordinate payload 无效 -> BROWSER_DOM_READ_INVALID
```

`BROWSER_TARGET_INVALID` 不得再作为 query count、node missing、box model、visibility、record/number/string decode 的通用兜底。DevTools 精确返回已识别的 no-layout/no-box 时，Browser 只把该 node 作为本轮不可见候选过滤掉；node stale 必须丢弃旧 nodeId 并返回 `BROWSER_DOM_NODE_STALE`；只有 record、number 或 coordinate 的 CDP payload 真实畸形时才返回 `BROWSER_DOM_READ_INVALID`。Browser 只报告原子 observation 事实，不决定 GPT Child 是否在自己的 timeout 内 fresh retry。fresh retry 必须重新 query 当前 Document，不能复用 nodeId，不进入 mutation WAL，也不能改变此前 submit 的 `CONFIRMED`、immutable terminalAt、evidence identity 或 Target ownership。真正 Target/Document lifecycle failure 原样返回，由上层现役 confirmed-submit readback 合同保留成果事实；Browser 不解释 Product 步骤、attempt 预算或业务终态，不新增 selector fallback、第二 DOM 读取链或第二上传路径。

恢复查询取得的旧 `CONFIRMED` mutation 只证明原 submit effect 与原 Target/Document 锚点，不得覆盖当前 observation 的动作类别或结果。当前 locator 获取、DOM 读取、导航后核验等只读动作失败时必须保持自己的 `mutationOutcome=no` 与原生 typed cause；Browser lane/coordinator 只能把旧 receipt 作为独立的 `confirmed_submit` 事实随结果携带，禁止把旧 `CONFIRMED` 贴成当前只读失败的 mutation outcome。


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

每项都必须同时绑定 exact call identity、Target、current Document、typed capability、一次性 permit/sequence 与 payload hash；请求或回复结束即释放。Prompt 和路径不得出现在 reply，DOM 原文只能交给当前 attempt 的现役 artifact Owner。canonical conversation URL 只允许在当前 attempt 当前页面的直接 observation 中使用；失败、重启或结果不明后不得据此签发任何恢复授权。`TARGET_CLAIM` 只含精确 claimOrigin，不能携带 currentUrl；GPT coherent reply 只含 revision-bound currentUrl，不能携带或消费 claimOrigin。Browser WAL、日志、proof、诊断和错误一律只允许 hash、长度、数量、ref、stage 和 typed cause；配对/claim 帧除 claimOrigin 外同样适用。cookie、token、credential、raw browser identity、任意资源 URL、通用 opaque payload 继续绝对禁止；禁止第二 WebSocket、Native Messaging、第二路径 resolver、第二 artifact store、URL table/registry/ledger、Browser URL WAL、恢复授权、V1/V2 dual-read/write、字段改名规避或 Browser 解释业务语义。

### 3.1.3 Attempt 内 mutation 单向门

Browser WAL 唯一身份必须包含 `job_id + attempt_id + plugin_id + plugin_version + product_step_id + call_id + child_id + request_hash + payload_hash`。每次 mutation 前先验证 Website 当前 lease/fence，再写 PREPARED，并在不可逆边界前写 DISPATCHED。

同一 attempt 的同一身份最多 dispatch 一次；进程、Target、Document、deadline 或错误变化都不能在该 attempt 取得重做资格。attempt 失败或结果不明后，Browser 只报告 typed fact并结束，不重领旧 Target、不恢复旧 Document、不导航旧 conversation。新 attempt 因 attempt_id 不同获得新的 Website 授权身份，不受旧 WAL 阻断。旧 attempt 的任何迟到 command 必须被 fence 拒绝。

WAL 只保留当前 attempt 防重所需字段与最小审计事实；atomicStepRecovery、callRecoveryScope、recovery park、source-only/full-readback 与跨 attempt reconciliation 必须不存在。

### 3.1.4 唯一页面动作后读回总闸门

总闸门按物理页面状态改变认定，不按现有 Child 或 Browser command 名单认定。点击、输入、清空、填写、DOM focus、鼠标与键盘事件、文件选择与上传、提交、`Page.navigate`、刷新、返回根页、切换会话、模型与推理档位、菜单开关、弹窗确认、tabs create、fork、轮询导航、恢复导航，以及未来新增的页面动作，都必须通过 Browser Authority 的同一 in-memory read-not-before。唯一常量固定为 `2500`，没有参数、环境变量、调用方 override、feature flag 或其它延迟档位。

起点是复合动作的最后一个物理页面输入已经完成。CDP dispatch acknowledgement、唯一 file chooser 事件、`Page.navigate` 的协议回包以及完成同一复合动作所必需的底层写入回包，可以在闸门内机械消费，但不能读取页面结果，也不能产生成功或失败 verdict。连续鼠标事件、按键 repeat 或“点击上传入口 -> chooser -> `DOM.setFileInputFiles`”只在最后一个输入后开始 2500ms。final fork 必须在最终 click 后等满 2500ms 才能第一次读取 Target 增量；navigation/create/reset/switch 必须在动作后等满 2500ms 才能第一次读取 frame、Document、currentUrl 或 DOM。

等待期间，同一 typed command 不返回动作结果，Target、current Document、claim 与唯一 FIFO 均不释放，不得 park、reacquire、切换会话或为轮询导航其它任务。2499ms 及以前，动作后 DOM、URL、frame、Target 集合、页面媒体、Browser postcondition 与上层 GPT/Product 判定读取总数必须为零；即使页面已显示成功或失败也不能提前结束。满 2500ms 后必须从 current Document 发起第一次 fresh coherent read，不得复用动作前、动作瞬间或缓存 packet。2500ms 只发放首读资格，不是成功证据；其后继续依源码冻结的机械正反 postcondition 和语义合同结算。既有 postcondition timeout 从首次可读时刻起算，不能被闸门吞掉。等待被 abort、撤权、超时、Target/Document 失效或读取失败时，原动作仍不得重放。

实现只有一个 Browser-owned 总闸门和一个常量；GPT Child 旧 2500ms helper、条件稳定窗口及其它页面动作后 sleep 必须物理删除。纯 observation 自身不设置新闸门，数据库、Website 请求、日志、checkpoint 与其它非页面动作完全不适用；但任何读取如果是某一页面动作后的首次结果读取，仍必须先满足该动作留下的 read-not-before。不得以内部动作、轮询动作、恢复动作、已有 Browser postcondition、Target-local scope 或未来新 command 为由绕过。

扩展只允许四种结算：zero-action predicate 已成立时 `CONFIRMED + mutation_outcome=no`；动作机械资格不成立时 `REJECTED + mutation_outcome=no`；一次 Provider 物理输入后按冻结正反 readback 结算 `CONFIRMED` 或 `REJECTED`，mutation outcome 只表达 `confirmed` 或实际可证明的 Provider 物理事实；已鉴权 exact `REPLY.errorCode` 必须结算 `REJECTED`，若不能证明输入为零则保留 `mutation_outcome=dispatched`；只有 deadline 前完全没收到终局 reply 才保持 `DISPATCHED + mutation_outcome=dispatched` 并记录 `BROWSER_COMMAND_RECEIPT_MISSING`。final fork 的正向 Browser readback 还必须在同一命令完成唯一新增合法 page、source conversation content 与 child route 验证、同一逻辑 targetRef 向 child tab 的物理转移、source tab 关闭、child Document/navigation epoch、现有 TARGET_CLAIM/ACK 与 settled 单页闭合；它不得导航 source 或关闭 child，也不增加第二 Provider 输入、第二 mutation row 或第二 Browser capability。Browser terminal、Provider 物理输入事实、GPT 直接语义后置互相正交，不从邻近事件或普通抛错推断。

同一 exact call 一经 DISPATCHED 就不得在同一 attempt fresh re-act；无法在本次调用内结算时，该 attempt 结束，WAL 只留下审计事实。keypress 的有界 repeat 仍是一条 typed command、一次 dispatch。file input 仍只是一条 `browser.file-input.v1` typed command 和一条 WAL mutation：Extension 必须先开启 file-chooser interception，再在同一 current Document 中 fresh 机械重验 GPT 源码冻结的唯一活动菜单 scope 与唯一可见“从电脑上传”叶子并仅派发一次物理点击；从点击开始到批量 file set 与 interception 关闭完成为同一 capture 窗口，该窗口必须只收到一个 `Page.fileChooserOpened` 事件且其 backend node 精确等于同文档唯一 `#upload-files`，随后才对该 chooser node 执行一次批量 `DOM.setFileInputFiles`并读回批准集。点击触发及 chooser 首事件必须共同受同一有界 deadline 约束。点击、chooser 绑定和 file set 是同一个 Provider 上传物理输入，不得拆成第二 Browser 命令、第二上传路径或 direct-hidden-input fallback；interception 必须在 finally 中关闭，点击后任一不可唯一证明的结果保留 `mutation_outcome=dispatched` 并失败关闭。keypress 和 file input 都不得扩展为通用 range/JavaScript engine。现役非空 WAL 只允许由唯一 Browser store 的前向 schema migration原位补齐当前 attempt 防重字段，不得重建表、清空历史、双读写或增加第二 mutation store。

### 3.2 唯一 FIFO 与当前 Attempt wait

全系统仍只有一条 Browser FIFO 和一个 system Tab。当前 attempt 的 Provider wait 只能在本次 invocation 的有限 deadline 内保持或释放 FIFO；任何失败、进程重启、lease 失效、Target/Document 丢失或结果不明都结束 attempt，不进入 recovery park，也不保留旧现场供以后执行。

新 attempt 从固定 start URL 建立干净 Target/Document。已经 DISPATCHED 的旧 attempt 只保留审计事实，不能阻断新 attempt；任何旧 fence command 都在物理输入前拒绝。

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
物理删除“查询并复用既存 ChatGPT Target”、单/多候选选择分支及其测试；旧“后台标签直接物理输入”验收也必须删除，唯一替代是 mutation 前交互就绪闸门，不存在 manual/auto 兼容桥、feature flag、
fallback 或第二 claim path。

同时物理删除 reconciliation 抢占旁路、quarantine 和“一个任务现场把十个业务槽或全局 Runtime ledger 置假”的判定。所有当前 attempt 普通执行进入同一有界 FIFO；旧 attempt 的 unresolved DISPATCHED 只保留审计事实，不得阻止新 attempt 取得 FIFO、建立干净 Target/Document 并从第一步执行。

## 6. 质检与真实验收

1. 同一 attempt 的同一 mutation identity 最多进入 DISPATCHED 一次；
2. identity 精确包含 attempt_id，新 attempt 可从固定 start URL 重新执行；
3. 旧 attempt 的迟到 command 在物理输入前被 fence 拒绝；
4. 进程重启不重建旧 Target/Document，不导航旧 conversation，不进入 recovery park；
5. 单 system Tab、单 FIFO、交互就绪闸门、2500ms fresh readback 与 typed terminal 继续成立；
6. atomicStepRecovery、callRecoveryScope、source-only/full-readback 和跨 attempt WAL 查询消费者为零；
7. 不新增第二 Tab、lane、WAL、queue、store、scheduler 或恢复状态机；
8. 真实 Chrome 故障注入证明 attempt-1 失败后停止，attempt-2 使用新 fence 从第一步执行。

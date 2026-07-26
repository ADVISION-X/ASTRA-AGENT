# 附件＋提示词投喂给网页版 AI 分析实操论证报告

> 文件身份：真实 Chrome 实操记录、第二上传链路施工输入、DOM/原生文件选择器边界说明
> 文件状态：verified-v1.3
> 实操日期：2026-07-24、2026-07-26
> 实操对象：ChatGPT Web（`https://chatgpt.com/`）
> 目标模式：点击“＋”→ 官方文件选择器 → 目标目录 → Command+A → 一次打开 → 附件稳定 → 提示词稳定 → 提交
> 当前结论：标准子能力已经接入 AI Input Gateway；真实 Chrome 的 1、10、17 文件均完成闭环；八字 SEO 的 16＋2 文件真实成功会话进一步证明，生产步骤必须使用 `ACTION AND THEN`，且 THEN 必须同时绑定精确作用域、包含条件、排除条件和相对基线增量；2026-07-26 又以两个独立 ChatGPT 会话完成了真实并发生成和交替 DOM 轮询，证明“一次只能等待一个 Web Chat”不是 provider 技术限制，但生产并发必须增加会话身份、临时 URL 收敛、短时浏览器操作权和防串话合同

---

## 0. 本文件的权威边界

本文件不是 active 法案，不是第二套 AI Input Gateway，不是第二个 Xuanyuan，也不直接授权修改生产代码。

本文件只做四件事：

1. 记录真实 Chrome 中已经发生的操作和观察结果。
2. 把“批量文件选择器上传”拆成可以直接施工的步骤契约。
3. 明确 DOM、macOS 原生文件选择器、业务 flow 和证据 owner 的包含与排除关系。
4. 暴露当前 active 法案与第二链路之间的冲突，防止后续 Codex 绕过法案直接写代码。

### 0.1 LAW-GAP 已关闭

本报告初稿发现的法案冲突已经按用户授权删除并重构。当前 active 权威现已明确：

- 统一子能力 ID 是 `attach-approved-web-chat-files-once`。
- 0 文件跳过；GPT 1 文件走 `ordered_clipboard`；GPT 2 个及以上走 `native_picker_batch`；Gemini 任意文件数仍走 `ordered_clipboard`。
- 运输方式由 AI Input Gateway 内部按 provider 与文件数固定决定，外部请求不得传入或干预。
- 同一 attempt 不允许静默 fallback；失败必须如实结束。
- Xuanyuan 只接收聚合附件证明，不再拥有逐文件运输细节。

因此当前关系是：

```text
active 法案
→ AI Input Gateway 施工图
→ 标准附件子能力
→ owner audit、自动验收与真实 Chrome 证据
```

本报告只记录真实操作和施工证据，不再承担授权入口，也不形成第二套规则。

### 0.2 第二链路不是第二 owner

允许的目标结构：

```text
Xuanyuan task
→ AI Input Gateway
→ gpt-web-chat provider adapter
→ 单次内部选择一种附件运输方式
   ├─ ordered_clipboard：现有逐文件 Command+C/V
   └─ native_picker_batch：官方文件选择器一次全选
→ 同一套 prompt、submit、response capture、proof 和任务状态
```

禁止：

- 新建第二个 Xuanyuan。
- 新建第二个 HTTP 入口。
- 新建第二套任务账本。
- 新建第二套 provider proof。
- 两条上传链同时操作同一个 composer。
- 第一链路失败后在同一 feed 中静默切到第二链路。
- 第二链路失败后静默回退到第一链路。

一次任务必须在进入 provider 前确定唯一运输方式。失败必须如实结束为 `failed` 或 `review_required`；如需换链重试，应创建有独立 attempt identity 的新尝试。

---

## 1. 实操结论

本轮最终使用真实 Chrome、真实 ChatGPT 登录态、真实 macOS 文件选择器和系统自动生成的唯一内容附件进行整链实操。

测试材料：

```text
用例：1 文件、10 文件、17 文件
文件类型：JSON
每个文件：包含唯一、可由回答逐项核对的内容标记
```

结果：

```text
点击 ChatGPT “＋”：成功
打开“添加照片和文件”：成功
打开 macOS 原生文件选择器：成功
进入指定附件目录：成功
文件选择器精确识别10个与17个文件：成功
列表视图聚焦后Command+A全选并打开：成功
ChatGPT composer精确出现10个与17个附件：成功
附件稳定30秒：成功
填写完整测试提示词：成功
提交前重新核对附件数量：成功
正式点击发送：成功
捕获新assistant回答：成功
回答包含每个附件的唯一标记：1/1、10/10、17/17
raw response hash与聚合附件proof：完整
```

这次实操直接证明：

1. 当前 ChatGPT Web 与本子能力可以一次承接17个文件并实际读完。
2. “最多只能上传10个附件”不是本轮真实事实。
3. 批量官方文件选择器路径避开了逐文件 Finder/Chrome 焦点往返。
4. 该路径不能依靠固定 sleep；文件列表、精确文件名、附件数量、ready状态和30秒稳定窗均由真实状态证明。
5. 10文件与17文件均使用 `native_picker_batch`；1文件按固定路由使用 `ordered_clipboard`。

### 1.1 八字 SEO 成功会话的只读 Chrome 复核

本轮没有重新提交消息、没有重新上传附件、没有导航或刷新页面，只读取已经成功完成的真实会话：

```text
会话URL：
https://chatgpt.com/c/6a62b3fc-b628-83ed-843b-4816cc4a87e2

会话标题：
月令与旺衰判定
```

当前页面有4个已完成消息 turn：

| turn | 身份 | 当前turn内文件按钮 |
|---|---|---:|
| `conversation-turn-1` | 第一轮user message | 16 |
| `conversation-turn-2` | 第一轮assistant message | 0 |
| `conversation-turn-3` | 第二轮user message | 2 |
| `conversation-turn-4` | 第二轮assistant message | 0 |

第一轮16个文件和第二轮2个文件均能在各自user turn内按唯一展示名逐项读取；assistant turn内没有文件按钮。

当前空composer的只读DOM事实：

```text
main：1个
user heading“你说：”：2个
main内role=group：22个
main内历史文件按钮：18个

当前composer root：
form:has(#prompt-textarea)：1个

该composer root内部：
role=textbox：1个
data-testid=composer-plus-btn：1个
通用multiple file input：1个
conversation turn：0个
历史文件按钮：0个

页面其他范围：
image/* multiple file input：2个
```

这组事实证明了一个P0级误判风险：

```text
main内发现18个历史附件
≠
当前composer已上传18个附件
```

因此附件THEN不得使用页面全局计数，也不得只限定到`main`。当前任务附件必须限定在唯一composer root内，并明确排除全部历史`conversation-turn-*`。

本轮还观察到：

```text
Chrome openTabs仍能列出目标标签
AND
旧tab控制句柄已经失效
```

重新从当前Chrome会话认领同一个精确tab后，才恢复只读DOM能力。因此：

```text
标签仍存在
≠
旧控制句柄仍有效
```

每次动作前的THEN必须使用当前新鲜句柄重新读取URL和DOM；不得复用旧句柄或旧快照。

---

## 2. 实操中发现的偶发与风险

### 2.1 Command+A可能选中路径文字，而不是文件

第一次操作中：

```text
Command+Shift+G
→ 输入目标目录
→ 目录尚未真正进入
→ 过早执行Command+A
→ 实际选中“前往文件夹”输入框中的路径文字
```

结论：

```text
输入了目录路径
≠
已经进入目标目录
```

必须先观察原生文件选择器中的目标文件列表，再允许 Command+A。

### 2.2 文件列表已经出现，不等于键盘焦点属于文件列表

第二次操作中，原生文件选择器已经列出17个文件，但直接 Command+A 后，“打开”按钮仍不可用。

结论：

```text
文件列表可见
≠
文件列表拥有键盘焦点
```

Command+A前必须先让文件列表成为当前焦点范围。最终实现禁止把固定屏幕坐标当作生产 identity；必须使用原生辅助功能对象、可验证的键盘焦点迁移，或浏览器受治理 file-input 端口完成焦点/选择。

### 2.3 原生文件选择器不能可靠提供“已选中17项”的DOM证明

macOS 文件选择器不是网页 DOM。辅助功能树可以证明：

- Chrome 当前窗口存在1个原生 sheet。
- sheet 内文件列表有17个 group。
- 每个 group 对应一个真实文件名。
- “打开”按钮是否可用。

但本轮辅助功能树没有稳定暴露每个 group 的 `AXSelected` 值。因此“打开”按钮可用只能证明至少有文件被选中，不能单独证明17个全部选中。

最终强证明必须在返回 ChatGPT DOM 后完成：

```text
expectedAttachmentCount === observedAttachmentCount
```

### 2.4 附件 chip 可能在上传过程中改名

本轮使用的是以前上传过多次的老文件名。ChatGPT 为避免重名，陆续把文件显示名改为：

```text
00-manifest(9).json
11-di-tian-sui-chan-wei-index(6).json
70-zi-ping-zhen-quan-book(5).md
```

这不是附件丢失，但会破坏“显示文件名必须与本地文件名完全相等”的验收。

生产要求：

- 每次 upload attempt 的 staging 文件名必须包含唯一 `uploadAttemptId`。
- 同一个任务重试时不得复用完全相同的展示文件名。
- 本地 input ref、sha256、byte count 仍是材料身份真相。
- Provider DOM 只能证明文件 chip 数量和可见名称，不得冒充文件内容 hash 证明。

### 2.5 附件chip出现，不等于上传完成

本轮在附件刚出现时：

```text
附件数量：17
发送按钮：不可用
```

约15秒后：

```text
附件数量：17
发送按钮：可用
```

因此：

```text
附件chip出现
≠
附件已经可随提示词发送
```

必须等到附件数量精确、composer没有上传中状态、发送按钮进入可用状态，才能填写或提交正式提示词。

### 2.6 刷新页面可能清附件，但保留提示词草稿

本轮清场时，刷新 `https://chatgpt.com/` 后附件变为0，但测试提示词仍被页面保存为草稿。

结论：

- 刷新不是完整清场。
- 清场必须分别验证“附件为0”和“composer文本为空”。
- 新任务开始前不得只依赖刷新。

---

## 3. Owner与边界

| 对象 | 唯一owner | 包含 | 排除 |
|---|---|---|---|
| 业务任务与运输方式选择 | Xuanyuan /调用它的受治理任务 | 单次attempt选择一种运输方式、任务状态、失败语义 | DOM selector、文件选择器坐标、provider私有细节进入外部请求 |
| Web Chat步骤顺序 | AI Input Gateway的gpt-web-chat provider链 | workspace、附件、prompt、submit、response capture顺序 | 业务文章判断、第二任务账本 |
| 网页DOM | DOM Automation / provider page actions | snapshot、semantic locate、click、fill、wait、verify | macOS原生文件选择器内部、业务成功裁决 |
| macOS原生文件选择器 | Browser/OS低层端口 | sheet识别、目录进入、文件列表观察、焦点、Command+A、打开 | ChatGPT附件成功、业务任务完成 |
| 文件材料身份 | Xuanyuan请求快照与input refs | approved path、file name、sha256、byte count、order | 任意目录扫描、未批准文件 |
| Provider页面附件证明 | Web Chat provider proof | DOM附件数量、可见名、稳定时间线 | 文件内容hash、模型已经读取 |
| 提示词内容 | 调用方受治理prompt package | exact approved text、prompt hash、expected prefix | DOM自行生成或改写prompt |
| 回答与hash | AI Input Gateway现有response capture | raw response、raw hash、conversation proof | 第二模型修复、DOM业务判断 |

关键边界：

```text
DOM只能证明网页页面状态。
macOS辅助功能只能证明原生文件选择器状态。
两者不能互相冒充。
```

---

## 4. 全链状态机

建议第二链路使用以下内部状态；不得向外部业务网站暴露浏览器细节：

```text
transport_selected
→ provider_lease_acquired
→ workspace_proven
→ composer_cleared
→ upload_menu_open
→ native_picker_open
→ staging_folder_proven
→ file_list_proven
→ selection_requested
→ picker_confirmed
→ attachments_pending
→ attachments_stable
→ prompt_filled
→ pre_submit_proven
→ submitted
→ response_captured
→ cleanup_completed
```

任何状态缺少进入证据时，禁止进入下一状态。

### 4.1 ACTION AND THEN执行模式

本链路不再把步骤写成：

```text
做动作
→ 等几秒
→ 猜测成功
→ 继续
```

唯一允许的执行语义是：

```text
ACTION
AND THEN
  freshScope === expectedScope
  AND allIncludedSignals === true
  AND allExcludedSignals === false
  AND exactCandidateCount === expectedCandidateCount
  AND observedDelta === expectedDelta
  AND providerIdentityUnchanged === true
THEN
  只放行到唯一下一状态
ELSE
  保持当前状态，或结束为failed/review_required
```

其中最困难、也最重要的是THEN。

THEN不是一句“页面看起来好了”，而是一份完整判定：

1. **Fresh**：必须在ACTION之后重新读取，不能复用动作前快照。
2. **Scope**：先证明在哪一个tab、main、composer、sheet或message turn内判断。
3. **Include**：必须出现的信号全部出现。
4. **Exclude**：不属于本轮、会制造误判的信号全部不存在于该作用域。
5. **Exact**：候选数量必须精确相等，不能使用大于等于。
6. **Delta**：证明是本轮动作新增的状态，不是页面原有历史状态。
7. **Identity**：provider URL、tab、lease和attempt身份没有漂移。
8. **One next state**：一个THEN只能授权一个下一步，不能跨级授权。

#### 4.1.1 THEN的基线账

每个ACTION之前必须形成最小基线：

```text
providerUrlBefore
claimedTabHandleBefore
conversationTurnIdsBefore
composerRootIdentityBefore
composerAttachmentNamesBefore
nativeSheetCountBefore
```

ACTION之后重新读取：

```text
providerUrlAfter
claimedTabHandleAfter
conversationTurnIdsAfter
composerRootIdentityAfter
composerAttachmentNamesAfter
nativeSheetCountAfter
```

THEN判断的是精确差值：

```text
after - before
```

不是在整个页面中寻找一个可能早已存在的成功信号。

#### 4.1.2 本链逐步AND THEN表

| ACTION | THEN必须包含 | THEN必须排除 | 只允许进入 |
|---|---|---|---|
| 从当前Chrome会话认领目标tab | 新鲜句柄可读；URL精确等于批准conversation URL；origin为`chatgpt.com` | 旧失效句柄、同origin其他会话、第一个模糊匹配tab | `provider_lease_acquired` |
| 读取composer基线 | `form:has(#prompt-textarea)`恰好1个；内部textbox、plus button、通用file input各1个 | `conversation-turn-*`、历史文件按钮、两个`image/*` input、侧边栏搜索 | `composer_cleared` |
| 点击唯一“＋” | 当前composer范围不变；新菜单唯一；目标菜单行同时包含“添加照片和文件”与“从电脑上传” | 创建图片、网页搜索、深度研究、插件入口、旧菜单 | `upload_menu_open` |
| 点击目标菜单行 | 当前Chrome窗口原生sheet从0精确变为1；sheet同时有“取消”和“打开” | 0个sheet、2个及以上sheet、Finder窗口、权限/登录/保存弹窗 | `native_picker_open` |
| 进入staging目录 | 文件列表group数量精确等于expected；名称集合与manifest完全一致 | 路径输入框仍打开、额外文件、缺失文件、旧attempt文件 | `file_list_proven` |
| 文件列表聚焦并Command+A | 焦点仍在目标列表；“打开”从不可用变为可用 | 焦点在路径框/搜索框/边栏；“打开”仍不可用 | 仅允许点击“打开”，不得宣称全选已证明 |
| 点击“打开” | sheet从1变为0；同一provider URL；当前composer root内附件名称集合与expected完全一致 | 历史user turn的18个文件、文件库、assistant turn、数量大于或小于expected | `attachments_pending` |
| 等待附件ready | 当前composer内精确附件集合；无上传中状态；发送按钮可用；连续稳定窗内集合不变 | 历史附件、pending spinner、disabled send、附件消失或重复 | `attachments_stable` |
| fill受治理prompt | 唯一composer内出现exact prompt prefix；附件THEN再次通过 | 搜索框、插件输入框、旧prompt、附件集合变化 | `prompt_filled` |
| submit | 新user turn id不在基线；该新turn含本轮exact附件集合和本轮prompt证据；composer完成受治理清空 | 任意旧user turn、只有composer清空但无新turn、附件落入错误turn | `submitted` |
| capture response | 新assistant turn id不在基线且位于新user turn之后；回答稳定；raw text/hash绑定本轮task | 旧assistant turn、停止生成中、只有页面文字变化但无新turn | `response_captured` |

#### 4.1.3 THEN的作用域优先级

作用域必须从窄到宽：

```text
当前attempt
→ 当前精确provider tab
→ 当前main
→ 当前composer root或本轮新增message turn
→ 当前目标元素
```

禁止反过来从整页搜索一个信号，再猜它属于当前任务。

尤其禁止：

```text
main中附件总数 === expected
```

允许：

```text
currentComposerRoot内
AND 不在任何conversation-turn内
AND attachmentNameSet === expectedNameSet
```

提交后附件已经离开composer，此时作用域必须切换为：

```text
newUserTurnId
AND newUserTurnId不在conversationTurnIdsBefore
AND newUserTurn内attachmentNameSet === expectedNameSet
```

#### 4.1.4 时间的唯一角色

时间只能做两件事：

1. poll间隔；
2. 总timeout保险丝和active法案要求的连续稳定窗。

时间不能单独证明成功：

```text
等待30秒
≠
附件稳定
```

正确语义是：

```text
精确附件THEN已经成立
AND
在连续稳定窗内每次fresh observation仍成立
THEN
attachments_stable
```

若中途任一包含条件消失、任一排除条件出现或作用域漂移，稳定计时必须作废，不能累计旧时间。

#### 4.1.5 THEN失败边界

THEN失败后只能有三种结果：

```text
尚未到总timeout且状态仍单义
→ 留在当前状态继续fresh poll

出现多义、登录、风控、焦点或身份漂移
→ review_required

出现精确反证、集合错误、sheet错误或状态倒退
→ failed
```

禁止：

- THEN失败后继续执行下一ACTION。
- 用更宽的selector重试到“找到为止”。
- 从composer作用域扩大到整个main或整个document。
- 把旧turn、历史附件或文件库内容当成本轮增量。
- 同attempt切换运输方式或重复上传全部文件。

---

## 5. 可直接施工的逐步操作契约

## 第0步：获得法案修改授权

进入条件：

- 用户明确授权修改 active AI Input Gateway/Xuanyuan上传法条。
- 明确第二链路只增加内部运输方式，不增加第二owner。

允许：

- 修改冲突法条、施工图、acceptance、inspector和现有provider链。

禁止：

- 只改代码不改冲突权威。
- 手工修改generated审计产物。
- 用本报告代替active法案。

成功证据：

- active法条允许 `native_picker_batch`，同时保留 `ordered_clipboard`。
- generated计划由builder生成，非手写。

失败处理：

- 未获授权时停止施工。

## 第1步：单次任务选择唯一运输方式

进入条件：

- Xuanyuan任务已经建立。
- request、prompt package、input refs、limits已经冻结。

内部选择：

```ts
type WebChatAttachmentTransport =
  | "ordered_clipboard"
  | "native_picker_batch";
```

边界：

- 该字段只能存在于AGENT内部provider调度。
- 外部网站不得传入该字段。
- 同一attempt只能选择一个值。

抗干扰：

- 禁止两条链并行。
- 禁止失败后同attempt静默换链。

## 第2步：建立本轮唯一staging目录

进入条件：

- 所有input refs已经批准。

要求：

```text
一个attempt
→ 一个独立staging目录
→ 目录中恰好只有expectedFiles
```

每个展示文件名必须包含：

```text
稳定顺序号
+语义短名
+uploadAttemptId
+原扩展名
```

例如：

```text
10-滴天髓正文-upload_a1b2c3.md
11-滴天髓索引-upload_a1b2c3.json
```

允许：

- 从已批准文件生成本轮有唯一展示名的副本或受治理链接。

禁止：

- 对父目录直接Command+A。
- 目录包含日志、隐藏文件、`.DS_Store`、旧attempt附件或未批准文件。
- 运行中继续向staging目录写入文件。

成功证据：

- 目录文件数量等于expected count。
- 排序后文件名集合与本轮manifest一致。
- 每个源文件hash和byte count已经在任务快照中。

## 第3步：获取唯一provider lease并证明精确标签页

进入条件：

- staging目录冻结。
- Web Chat全局lease已获得。

必须证明：

- 当前前台应用是Google Chrome。
- 当前标签页origin是`https://chatgpt.com`。
- 当前标签页是本attempt批准的新会话或批准continuation会话。
- 页面中唯一composer存在。

禁止：

- 只按`chatgpt.com`找到“第一个匹配标签页”。
- 同时让Chrome插件、其他worker或用户自动化切换标签页。
- 未持有lease时点击、粘贴或填写。

失败处理：

- 标签页多义或URL漂移时 `review_required`。

## 第4步：建立上传前DOM基线

本轮实测基线：

```text
role=textbox且accessible name为“与 ChatGPT 聊天”：1个
role=button且accessible name精确为“添加文件等”：1个
input[type=file]：3个
通用多文件input：1个
image/* input：2个
```

必须包含：

```css
input[type="file"][multiple]:not([accept="image/*"])
```

必须排除：

```css
input[type="file"][accept="image/*"]
```

禁止：

- 只使用`input[type=file]`并默认取第一个。
- 把图片生成/图片上传input当成通用附件input。
- 使用动态hash class作为主identity。

说明：

第二链路的用户动作是点击官方菜单并进入原生文件选择器。通用file input的DOM识别用于确认页面上传结构和排除错误入口，不得在未授权时偷偷改成另一条`setFileInputFiles`链路。

## 第5步：定位并点击“＋”按钮

DOM包含关系：

- 位于当前`main`内。
- 与唯一composer属于同一输入区域。
- role为`button`。
- accessible name精确为当前语言下的“添加文件等”。
- 页面内候选数必须恰好为1。

DOM排除关系：

- 侧边栏“新聊天”。
- 项目/插件区域的加号。
- 无accessible name的按钮。
- 麦克风、语音和发送按钮。

允许动作：

- DOM located-element-first click。

禁止动作：

- 坐标点击“＋”。
- 点击后不验证菜单状态。

成功证据：

- 上传菜单出现。
- 菜单中“添加照片和文件”和“从电脑上传”同时存在。

## 第6步：定位“添加照片和文件”菜单项

DOM包含关系：

- 当前新打开的上传菜单范围内。
- 同一候选行同时包含精确文本：
  - `添加照片和文件`
  - `从电脑上传`
- 候选行唯一。

DOM排除关系：

- `创建图片`
- `网页搜索`
- `深度研究`
- GitHub、Figma、OpenAI Developers等插件入口
- 其他只含“上传”字样的页面元素

允许动作：

- 点击唯一候选行。

成功证据：

- Google Chrome当前窗口出现1个原生sheet。

失败处理：

- 菜单缺失、候选为0或大于1时停止，不得猜。

## 第7步：证明原生文件选择器已经打开

本步骤已经离开网页DOM，进入macOS辅助功能边界。

必须包含：

- 前台process是`Google Chrome`。
- 当前Chrome窗口标题对应已证明的ChatGPT标签页。
- `count of sheets of window 1 === 1`。
- sheet包含“取消”和“打开”按钮。

必须排除：

- Finder普通窗口。
- 其他Chrome窗口的文件选择器。
- 系统权限弹窗、登录弹窗或保存文件弹窗。
- 超过1个sheet的多义状态。

禁止：

- DOM脚本声称看到了原生文件选择器内部。
- sheet未证明时发送Command+Shift+G或Command+A。

## 第8步：进入唯一staging目录

推荐动作：

```text
Command+Shift+G
→ 将批准的staging目录绝对路径写入“前往文件夹”
→ Return
```

路径输入建议使用一次受治理的剪贴板文本粘贴，避免AppleScript逐字符输入时丢字符。该剪贴板只承载目录路径，不承载附件文件对象。

进入成功不能只靠等待秒数，必须从辅助功能树证明：

- 文件列表对象存在。
- 文件group数量等于expected count。
- 每个group的image/name组成的文件名集合与expected file names一致。
- 不存在额外文件名。

本轮真实辅助功能树证明了17个group和17个文件名。

禁止：

- 只看窗口标题或路径输入框文字就判目录成功。
- 文件数量不符仍继续。
- 只验证第一个和最后一个文件。

## 第9步：获得文件列表焦点并Command+A

进入条件：

- 第8步的文件列表数量和文件名集合全部通过。

必须先证明：

- 当前sheet仍属于同一ChatGPT Chrome窗口。
- “前往文件夹”输入框已经关闭。
- 当前交互范围不是左侧边栏、搜索框或路径输入框。
- 文件列表已经获得键盘焦点。

然后执行：

```text
Command+A
```

辅助证据：

- “打开”按钮从不可用变为可用。

重要限制：

- “打开”可用只能证明至少一个文件被选中。
- 原生辅助功能树未稳定暴露17个group各自的选中状态。
- 最终全选证明必须等返回ChatGPT后用exact attachment count完成。

禁止：

- 文件列表未获得焦点时Command+A。
- 使用固定屏幕坐标作为生产identity。
- “打开”按钮仍不可用时继续。

## 第10步：确认原生选择并返回ChatGPT

允许动作：

- 通过辅助功能对象点击唯一“打开”按钮。

禁止：

- 在sheet多义时按Return。
- 使用屏幕坐标点击“打开”。
- 点击后立即填写prompt。

成功证据：

- 原生sheet消失。
- 当前标签页仍是精确ChatGPT provider标签。
- composer开始出现附件chip。

## 第11步：等待附件从pending进入stable

DOM包含关系：

- 只统计当前`main`中当前composer的附件group。
- 每个附件group必须带有对应的“移除文件N：显示文件名”按钮。
- observed count必须精确等于expected count。

DOM排除关系：

- 侧边栏历史对话文字。
- ChatGPT文件库中的文件。
- 菜单和插件中的文件字样。
- 页面全局任意相同文件名文本。

稳定门：

```text
attachmentCount === expectedCount
AND provider URL未漂移
AND composer不存在上传中状态
AND send button进入可用状态
AND 连续稳定窗口内附件数量不变化
```

本轮实测：

```text
第1秒：17个附件，发送不可用
第5秒：17个附件，发送不可用
第11秒：17个附件，发送不可用
约第15秒：17个附件，发送可用
```

禁止：

- 附件chip刚出现就填写或发送。
- lower-bound count验收。
- 附件数量大于expected时继续。
- 文件名被provider追加`(N)`后仍用旧显示名做死等。

失败处理：

- 数量小于expected：`ATTACHMENT_COUNT_MISMATCH`。
- 数量大于expected：`ATTACHMENT_DUPLICATE_OR_STALE`。
- 数量先正确后归零：`ATTACHMENT_SET_DISAPPEARED`。
- 长时间发送不可用：`ATTACHMENT_UPLOAD_NOT_READY`。

## 第12步：定位唯一composer并填写受治理提示词

DOM包含关系：

- 当前`main`范围内。
- role=`textbox`。
- accessible name精确为当前语言下的“与 ChatGPT 聊天”。
- visible、enabled、writable。
- 候选数恰好为1。

DOM排除关系：

- 侧边栏搜索聊天。
- “＋”菜单里的插件搜索框。
- 页面搜索、浏览器地址栏和开发者工具。
- 任何密码、隐藏或disabled input。

动作：

- 关闭上传菜单或其他overlay。
- 使用DOM fill写入调用方批准的exact prompt。
- 不使用系统级Command+V把prompt粘到整个Chrome应用。

填写后必须证明：

- composer可见文本包含受治理`expectedPrefix`，或现有provider支持的pasted-text card ready。
- 附件数量仍精确等于expected count。
- provider URL未变化。
- 发送按钮可用。

最终真实验收提示词契约：

```text
请读取本轮全部附件。
只回复一个 JSON 对象，不要 Markdown 代码块，不要解释。
marker 必须等于本轮唯一 marker。
fileCount 必须等于本轮附件数。
tokens 必须按附件编号顺序列出每个附件中的 token，不能遗漏。
```

17 文件最终结果：

```text
提示词可见：true
附件数量：17
发送按钮可用：true
继续等待30秒后上述三项仍成立
提交前复核：17/17
正式发送：success
新回答捕获：success
回答附件内容校验：17/17
```

## 第13步：提交前最终门

提交前必须重新读取当前页面状态，禁止复用第11步的旧快照。

全部成立才允许提交：

```text
providerTabExact === true
attachmentCount === expectedCount
attachmentsStable === true
promptPrefixProven === true
sendButtonUnique === true
sendButtonEnabled === true
loginOrCaptchaDetected === false
unexpectedOverlayDetected === false
```

发送按钮DOM包含关系：

- 当前composer操作区内。
- role=`button`。
- accessible name精确为“发送提示”。
- enabled。
- 候选数恰好为1。

必须排除：

- “开始听写”。
- “启动语音功能”。
- 停止生成按钮。
- 无accessible name按钮。
- 任何插件或侧边栏按钮。

本轮已在用户授权范围内执行正式发送。提交方法为现有 provider DOM send button owner；未新增第二套发送链。

## 第14步：提交、回答捕获与清理

本步骤复用现有Web Chat submit和response capture owner，不新建第二套回答链。

提交成功证据：

- 出现本轮新的user message，或composer在完成提交前鉴权后清空。
- assistant进入generating或产生新的assistant message。

回答完成证据：

- 新assistant回答稳定。
- exact raw response已经不可变保存。
- `rawOutputRef`、`rawOutputHash`、conversation proof和transport warnings已经落入现有provider proof。

本轮三组回答完成证据：

| 文件数 | 固定运输方式 | 附件证明 | 内容校验 | raw output hash |
|---:|---|---|---|---|
| 1 | `ordered_clipboard` | 1/1，`attachments_stable` | 1/1 token | `6f0b4eabecab303cfa1db9fbc69f9310a9cf24d42b6d2de0eaf5476e4e0dbe96` |
| 10 | `native_picker_batch` | 10/10，`attachments_stable` | 10/10 tokens | `63a434646b9f6c70dd9ed9afc168e5c541e102e6a3a6e108919cfa81fe865d27` |
| 17 | `native_picker_batch` | 17/17，`attachments_stable` | 17/17 tokens | `ded626bb99ceca572a27f47dcd60d7f3c54e8dfd4d9e14ea9c1195053add50d7` |

10 文件 staging manifest hash：

```text
sha256:bf1b4c2579186021048c3ce57eebaf3efa0243c45814da928426b20f33499bf5
```

17 文件 staging manifest hash：

```text
sha256:e0e6ec97530cebdb66a3ec29f96c3c0addfa3bce6658b0de7bf9ab2764bcea1c
```

该 17 文件证据来自代码纯洁度拆分和 CI-FULL 通过后的最终复验，marker 为
`REAL_CHROME_ATTACHMENT_17_6adbe341`。

清理边界：

- raw response捕获前不得恢复source tab。
- 捕获后清理失败只能增加warning，不得降级已捕获raw response。
- 提交前失败可以清空composer和附件。
- 提交后失败不得删除已存在的用户消息或assistant原始回答。

---

## 6. DOM包含/排除总表

| 目标 | 必须包含 | 必须排除 | 多义处理 |
|---|---|---|---|
| 新鲜tab句柄 | 当前Chrome会话重新认领成功、精确批准URL可读 | openTabs存在但旧句柄失效、同origin其他会话 | `PROVIDER_TAB_HANDLE_STALE` |
| Provider标签 | 精确受治理URL、`chatgpt.com` origin、当前lease | 第一个同origin标签、其他ChatGPT对话 | `review_required` |
| Composer root | `form:has(#prompt-textarea)`唯一；内部textbox、plus、通用file input各唯一 | 全部`conversation-turn-*`、历史文件按钮、页面其他image input | `PROMPT_COMPOSER_AMBIGUOUS` |
| Composer | `main`内、role textbox、accessible name精确、唯一 | 搜索框、插件搜索、隐藏input | `PROMPT_COMPOSER_AMBIGUOUS` |
| “＋”按钮 | composer同区域、role button、name精确、唯一 | 侧边栏/项目/插件加号、无名按钮 | `UPLOAD_PLUS_AMBIGUOUS` |
| 上传菜单项 | 同一行同时含“添加照片和文件”＋“从电脑上传” | 创建图片、网页搜索、深度研究、插件 | `UPLOAD_MENU_AMBIGUOUS` |
| 通用file input | `type=file`＋`multiple`＋非`image/*`，恰好1个 | 两个`accept=image/*` input | `GENERAL_FILE_INPUT_AMBIGUOUS` |
| 上传后的附件chip | 当前composer root内group＋对应移除按钮；名称集合精确等于expected | 全部历史conversation turn、文件库、assistant turn、全局同名文本 | `ATTACHMENT_COUNT_MISMATCH` |
| 提交后的user turn | 相对基线新增的唯一user turn；包含本轮附件集合与prompt证据 | 旧user turn、仅composer清空、其他会话turn | `SUBMITTED_USER_TURN_NOT_PROVEN` |
| 本轮assistant turn | 相对基线新增且位于本轮user turn后的assistant turn | 旧assistant turn、仍在生成、侧边栏对话文字 | `RESPONSE_ASSISTANT_TURN_NOT_PROVEN` |
| 发送按钮 | composer操作区、role button、name精确、enabled、唯一 | 听写、语音、停止生成、无名按钮 | `SEND_BUTTON_AMBIGUOUS` |

核心原则：

```text
DOM定位永远是“包含条件全部满足”并且“排除条件全部不满足”。
不是找到一个看起来像的元素就继续。

ACTION之后必须重新读取fresh DOM。
THEN必须证明“这是本轮新增状态”，不能证明“页面某处存在类似状态”。
```

---

## 7. 抗干扰协议

### 7.1 全链独占

- 从provider lease获得到response capture完成，禁止其他worker控制Chrome。
- Chrome插件监控只能读，不得在上传期间切标签、点击或导航。
- 用户主动操作造成焦点漂移时必须停止，不得抢回来继续发送。

### 7.2 不依赖固定等待

允许：

- 小间隔poll。
- 总timeout保险丝。
- 根据状态变化续等。

禁止：

```text
sleep 1秒
→ 假设目录已打开
→ Command+A
```

每一步等待对象必须明确：

- sheet出现；
- 文件列表数量正确；
- “打开”按钮可用；
- 附件数量正确；
- 发送按钮可用；
- prompt prefix存在；
- assistant回答稳定。

每次poll都必须重新计算当前步骤完整THEN；不得只轮询其中一个正向信号。任何排除信号出现，都必须立即停止当前等待并转入结构化失败。

### 7.3 页面漂移

在这些动作前必须重新证明provider tab：

- 点击“＋”前；
- 点击上传菜单项前；
- 原生文件选择器返回后；
- prompt fill前；
- submit前；
- response capture前。

### 7.4 登录、验证码和风控

出现以下任一情况立即`review_required`：

- login page；
- CAPTCHA；
- 2FA；
- provider rate limit；
- account limit；
- risk control；
- unexpected modal。

不得自动输入账号密码，不得绕过限制。

### 7.5 重试

- 同一个attempt不得重复点击“打开”。
- 同一个attempt不得重复Command+A＋打开。
- 附件数量不符时不得在原composer追加一遍全部附件。
- 重试必须新建uploadAttemptId和唯一展示文件名，并先清理或新建受治理conversation。

---

## 8. 建议的结构化失败码

```text
PROVIDER_LEASE_UNAVAILABLE
PROVIDER_TAB_AMBIGUOUS
PROVIDER_TAB_HANDLE_STALE
PROVIDER_FOCUS_DRIFT
COMPOSER_NOT_CLEAN
UPLOAD_PLUS_AMBIGUOUS
UPLOAD_MENU_AMBIGUOUS
GENERAL_FILE_INPUT_AMBIGUOUS
NATIVE_PICKER_NOT_OPEN
NATIVE_PICKER_AMBIGUOUS
NATIVE_FOLDER_NOT_PROVEN
NATIVE_FILE_LIST_MISMATCH
NATIVE_FILE_LIST_NOT_FOCUSED
NATIVE_SELECTION_UNPROVEN
NATIVE_OPEN_NOT_ENABLED
ATTACHMENT_COUNT_MISMATCH
ATTACHMENT_DUPLICATE_OR_STALE
ATTACHMENT_SET_DISAPPEARED
ATTACHMENT_UPLOAD_NOT_READY
PROMPT_COMPOSER_AMBIGUOUS
PROMPT_NOT_PROVEN
PRE_SUBMIT_GATE_FAILED
SUBMITTED_USER_TURN_NOT_PROVEN
RESPONSE_ASSISTANT_TURN_NOT_PROVEN
LOGIN_REQUIRED
CAPTCHA_OR_2FA_REQUIRED
PROVIDER_LIMIT_REACHED
```

失败码只描述观察到的运输状态，不得冒充业务文章失败原因。

---

## 9. 实际代码施工面

实际施工保持在现有 owner 内，没有新增第二套入口、任务账本或 provider：

```text
.github/instructions/agent-rules/modules/module-ai-input-gateway.instructions.md
.github/instructions/agent-rules/modules/module-xuanyuan.instructions.md
docs/法案辅助文件/GrassEye AI 投喂能立组施工图 V1.md
docs/法案辅助文件/GrassEye Xuanyuan API 临时实现施工图.md

src/capabilities/ai-input-gateway/schema.ts
src/capabilities/ai-input-gateway/children/attach-approved-web-chat-files-once.ts
src/capabilities/ai-input-gateway/providers/web-chat-attachment-transport.ts
src/capabilities/ai-input-gateway/providers/web-chat-native-picker-attachment.ts
src/capabilities/ai-input-gateway/providers/web-chat-ordered-clipboard-attachment.ts
src/capabilities/ai-input-gateway/providers/web-chat-upload-page-actions.ts
src/capabilities/ai-input-gateway/providers/web-chat-composer-scripts.ts
src/lib/browser/current-chrome-native-multi-file-picker.ts
src/lib/browser/current-chrome-window-control.ts

src/capabilities/ai-input-gateway/acceptance/attachment.acceptance.ts
scripts/acceptance/ai-input-gateway-attachment.real-chrome.ts
scripts/acceptance/xuanyuan.acceptance.ts
scripts/audit/domains/ai-input-gateway/manifest.json
scripts/audit/domains/ai-input-gateway/inspector.ts
scripts/audit/domains/xuanyuan/inspector.ts
```

旧的 `src/capabilities/ai-input-gateway/providers/web-chat-upload.ts` 已删除，不保留兼容层。generated artifacts 只由现有 audit builder 重建。

---

## 10. 必须完成的验收

### 10.1 静态验收

- 两条运输方式共用一个AI Input Gateway owner。
- 外部Xuanyuan请求不能选择浏览器运输细节。
- 同attempt不能自动fallback。
- staging目录只能包含批准文件。
- 文件名包含唯一uploadAttemptId。
- DOM通用file input必须排除`accept=image/*`。
- provider tab必须绑定精确会话，不得first-origin-match。

### 10.2 真实Chrome验收

至少覆盖：

1. 1个文件。
2. 10个文件。
3. 17个文件。
4. 文件总量大于当前SEO八字输入包。
5. 重复任务但不同uploadAttemptId。
6. 目录多一个未批准文件时阻断。
7. 文件列表未获得焦点时不得Command+A。
8. Command+A落在路径输入框时阻断。
9. 17个chip出现但发送按钮不可用时继续等待。
10. 附件数量先正确后归零时失败。
11. prompt填写后附件数量不变。
12. prompt填写后等待30秒仍稳定。
13. 精确发送并捕获新assistant回答。
14. raw response/hash/proof完整。

### 10.3 干扰验收

- 上传期间尝试切换到另一个ChatGPT标签页，任务必须停止。
- 上传期间出现登录/风控弹窗，任务必须`review_required`。
- 原生sheet数量大于1时必须停止。
- Chrome窗口不是任务绑定窗口时必须停止。
- 监控工具只能读取，任何写操作必须被lease阻止。

### 10.4 CI验收

```bash
node --import tsx scripts/acceptance/xuanyuan.acceptance.ts
node --import tsx scripts/audit/domains/xuanyuan/inspector.ts
npm run ci:full
```

静态PASS不能替代真实Chrome的17附件＋prompt＋发送＋回答捕获。

---

## 11. 最终实证等级

```text
CHROME_VERIFIED: true
VERIFIED_SCOPE:
  - 官方上传菜单真实存在
  - 通用file input与两个image input的包含/排除关系
  - macOS原生sheet真实打开
  - 辅助功能树按精确层级进入列表视图并枚举目标文件
  - 列表获得焦点后Command+A
  - 1、10、17附件进入composer
  - 附件ready并持续稳定30秒
  - DOM填写受治理测试prompt
  - 提交前再次核对精确附件数
  - 正式submit
  - 捕获新assistant回答
  - 回答内容逐项命中附件唯一标记
  - raw response hash与聚合附件proof完整闭环

REAL_RUNS:
  - 1文件：ordered_clipboard，1/1，success
  - 10文件：native_picker_batch，10/10，success
  - 17文件：native_picker_batch，17/17，success
```

### 11.1 ACTION AND THEN代码实证

2026-07-24已把本报告第4.1节的判定模型落入现有唯一子能力，没有增加第二owner、第二上传链或外部控制参数。

本轮代码门禁：

```text
清场：
  只在唯一composer root内移除附件和清空文本
  → fresh验证附件为0、文本为空

上传：
  同一精确provider URL
  + 唯一composer
  + composer内conversation turn为0
  + 通用multiple file input精确为1
  + composer内image/* input为0
  + 附件数量与展示名集合精确
  + 相对清场基线增量精确
  + 无pending/uploading
  + 发送按钮唯一且可用

稳定：
  连续15次、每次间隔2秒fresh读取全部成立
  → 30秒attachments_stable
  任一轮pending
  → 连续计数归零

提交：
  user turn数量相对基线精确增加1
  + 新user turn含本轮prompt证据
  + 新user turn内附件数量和文件名集合精确
  → submitted
```

真实Chrome第一次运行发现：

```text
失败：CHATGPT_UPLOAD_MENU_SCOPE_UNPROVEN
原因：代码臆造菜单必须具有固定role/radix父容器；
真实ChatGPT当前菜单能以唯一候选行提供完整包含/排除证据，但不提供该固定父标记。
处理：删除错误固定父容器假设；保留点击前菜单必须不存在、点击后目标行唯一、
同时包含“添加照片和文件/从电脑上传”、排除云盘/相机/其他工具等实证条件。
```

这次失败没有上传、没有填写prompt、没有提交，证明THEN失败会安全停止；修正的是错误假设，不是降低成功门槛。

修正后真实结果：

```text
2文件：
  status=success
  transport=native_picker_batch
  expected=2
  detected=2
  attachmentStatus=attachments_stable
  stagingManifestHash=sha256:b344a03631ecbe02dec3f613120aecfa45e569f8497d9b4e085a100fc7100d09
  rawOutputHash=f43c1add83d269e51e69c82f378f1913a9a1fa567dc0edb330ccbe8288248b0f
  conversation=https://chatgpt.com/c/6a62c22c-7544-83eb-9af5-c7d5527509ad

17文件：
  status=success
  transport=native_picker_batch
  expected=17
  detected=17
  attachmentStatus=attachments_stable
  stagingManifestHash=sha256:4f673c1ac6aa5ab3706b12044532f4922552ee50180162b519a6f6d2aa5cc547
  rawOutputHash=30cdc32f022284fc41fe94546c078d7cfc9a5a16098b8e2f4d1b780545199db4
  conversation=https://chatgpt.com/c/6a62c323-5c78-83eb-a894-70a0752bef45
```

Chrome插件对17文件会话的独立只读复核：

```text
精确会话tab：1
user turn：1
assistant turn：1
新user turn内附件group：17
新user turn内附件button：17
回答marker：命中
第1个token：命中
第17个token：命中

当前composer root：1
composer内历史turn：0
composer内附件group：0
composer内通用multiple file input：1
```

因此本轮实证同时证明：

```text
历史消息附件不会冒充当前composer附件；
composer清空不会单独冒充提交成功；
旧user turn不会冒充本轮新增user turn；
AI确实读取了本轮17个文件，而不是只完成了上传动作。
```

最终结论：

```text
标准附件子能力已经完成代码、法案、审计、自动验收与真实Chrome闭环。
它没有把AI变成填空题，只负责把经过批准的完整材料可靠送入网页版AI，并证明材料确实被读到。
```

---

## 12. 后续维护口令

```text
先读AGENTS.md、active AI Input Gateway法案与施工图。
只维护attach-approved-web-chat-files-once这一owner。
不得允许外部请求选择运输方式，不得增加同attempt fallback。
网页DOM变化时同时更新精确包含/排除规则、owner audit、自动验收和真实Chrome证据。
不得把file chip出现当上传ready；必须保留精确数量、精确文件名、提交前复核和30秒稳定门。
修改原生选择器输出协议时，必须覆盖首个文件名不丢失的解析回归。
```

---

## 13. 历史多标签实验（结论已被第14节片区替换）

> 本节保留的是发现“不同聊天可在服务端同时生成”的历史实验记录。其“每任务一个标签页、
> tab lease、按标签轮询”的实现结论已经废止，不得再作为施工依据。当前唯一有效的
> GPT Web 运行合同见第14节。

### 13.1 实操目的与边界

本轮按用户提出的方案，直接使用真实 Chrome、真实 ChatGPT 登录态、多个真实标签页和页面 DOM 验证：

```text
每个提示词带一个内部唯一 marker
→ 在不同 ChatGPT 会话中连续提交
→ 不等待前一个会话完成
→ 按精确标签页交替读取 DOM
→ 用 marker 找到本轮 user turn
→ 只读取该 user turn 之后的 assistant turn
→ 检查两个会话是否同时生成、是否串话、是否都能完成
```

本轮没有上传附件，原因是本次要单独验证“多会话并发生成和 DOM 轮询”这一技术命题，避免把原生文件选择器焦点、附件稳定窗与多会话调度混成一个无法归因的测试。

因此本节能够证明：

- 同一 ChatGPT 账号可以让至少两个独立会话同时生成。
- Chrome 控制端可以持有两个准确标签页句柄并交替读取各自 DOM。
- 唯一 marker 可以在各自 user turn 中形成可验证关联。
- 一个会话不需要持续保持前台焦点，生成仍会继续。
- 两个会话可以在各自准确 DOM 中独立完成，未发生 marker 串话。

本节尚不能证明：

- 两个带附件的会话可以同时执行原生文件选择器上传。
- 两个 22 分钟级真实玄学分析在账号限流、深度研究或长推理下必然稳定。
- AGENT 进程重启后能够恢复全部在途标签页。
- continuation、CAPTCHA、账号限流和标签页失效的并发恢复已经闭环。

### 13.2 实验环境

```text
CHROME_VERIFIED: true
浏览器：真实 Google Chrome
网页：ChatGPT Web
账号：用户当前已登录账号
控制方式：Chrome 插件提供的精确 Tab 句柄
本地日期：2026-07-26，Asia/Dubai
下列精确事件时间：UTC
```

安全边界：

- 未读取 Cookie、localStorage、sessionStorage、密码或 token。
- 未上传用户文件。
- DOM 读取只限定于当前实验会话的 `main`、conversation turn、composer 和生成状态按钮。
- 未把页面全量 HTML、账号资料或历史聊天正文写入本报告。

### 13.3 第一轮：两个会话连续提交与独立终态

第一轮创建两个全新的 ChatGPT 标签页 A、B，并使用不同 marker：

```text
A marker：
GRASSEYE_PARALLEL_DOM_1785014193968_8e6bf4_A

B marker：
GRASSEYE_PARALLEL_DOM_1785014193968_8e6bf4_B
```

提交时间：

```text
A submitted：2026-07-25T21:16:45.937Z
B submitted：2026-07-25T21:16:49.150Z
提交间隔：3213 ms
```

正式会话 URL：

```text
A：
https://chatgpt.com/c/6a6527b2-bfd4-83eb-a21f-8aa661ef6d18

B：
https://chatgpt.com/c/6a6527c2-2420-83eb-873d-651545da8230
```

两个终态 DOM 都满足：

```text
main：1
conversation turn：2
conversation-turn-1：user，包含本会话 marker
conversation-turn-2：assistant，位于本会话 user turn 之后
本会话 DOM 包含对方 marker：false
最终完成标记：true
停止回答按钮：0
```

两个回答都完整生成120项，DOM文本长度均为1153。第一轮证明两个提示词可以在约3.2秒内先后送入两个不同会话，且最终结果彼此隔离。

### 13.4 第二轮：捕获两个会话同时生成的硬证据

为了排除“第一个会话可能在第二个提交前已经完成”的解释，第二轮把任务扩大为每个会话完整生成300项，并在第二个会话提交前后立即读取第一个会话 DOM。

唯一 marker：

```text
C marker：
GRASSEYE_OVERLAP_1785014262614_xdher6_C

D marker：
GRASSEYE_OVERLAP_1785014262614_xdher6_D
```

正式会话 URL：

```text
C：
https://chatgpt.com/c/6a6527fd-6458-83eb-97db-2e4c0c31f194

D：
https://chatgpt.com/c/6a652808-b79c-83eb-bd7d-0a237ba10981
```

关键时间线：

| UTC时间 | C会话 | D会话 | 结论 |
|---|---|---|---|
| `21:17:48.383` | 已提交 | 尚未提交 | C开始独立任务 |
| `21:17:51.765` | `stop-button`存在；assistant显示正在思考 | 尚未提交 | D提交前，C明确仍在生成 |
| `21:18:00.031` | 仍在生成 | 已提交 | D没有等待C完成 |
| `21:18:00.799` | `stop-button`存在 | `stop-button`存在 | 两个不同会话同时生成的直接证据 |
| `21:18:21.531` | assistant长度2721 | assistant长度1133 | 两边都在增长 |
| `21:18:37.874` | assistant长度4783 | assistant长度3221 | 两边继续增长 |
| `21:18:58.193` | assistant长度7619 | assistant长度5868 | 切换读取未使任一生成停止 |
| `21:19:22.555` | assistant长度11220 | assistant长度9684 | 两边仍在独立推进 |
| `21:20:01.685` | C完成，长度15848 | D仍生成，长度15775 | 一个完成不影响另一个 |
| `21:20:14.067` | C完成 | D完成 | 两会话均到达独立终态 |

从C提交到D提交相隔11648 ms。在D提交之前，C已经通过以下 DOM 同时证明仍在生成：

```text
conversation-turn-1：包含C marker的user消息
conversation-turn-2：assistant消息
button[data-testid="stop-button"]：1
accessible name：停止回答
final marker：false
```

D提交后768 ms的双会话探测结果：

```text
C：
  精确URL：C会话
  user turn含C marker：true
  user turn含D marker：false
  stop-button：1

D：
  精确URL：D会话的临时URL
  user turn含D marker：true
  user turn含C marker：false
  stop-button：1
```

这组证据排除了以下说法：

```text
错误说法一：
必须等C完成，才能让D开始。

错误说法二：
切换到D后，C就会暂停生成。

错误说法三：
只有当前前台标签页的ChatGPT会继续工作。
```

实际事实是：

> ChatGPT 的回答生成发生在服务端。浏览器标签页只负责提交、显示和读取。只要两个提示词已经进入不同会话，两个任务可以同时推进，轮询器无需在某个标签页前台等待二十多分钟。

### 13.5 回答绑定与防串话结果

终态抓取不是读取“页面最后一条 assistant 消息”，而是执行：

```text
在当前精确会话内枚举 conversation turn
→ 找到 role=user 且包含本轮 marker、排除另一 marker 的唯一turn
→ 从该turn之后寻找第一个assistant turn
→ 读取该assistant turn
→ 再次验证回答不含另一任务 marker
```

终态结果：

| 会话 | user turn | assistant turn | 回答长度 | 对方marker | SHA-256 |
|---|---|---|---:|---|---|
| C | `conversation-turn-1` | `conversation-turn-2` | 15848 | `false` | `40e2e4521086f18882abbaece9b1d547a805b34c1b80581fb595dc40d5ca55eb` |
| D | `conversation-turn-1` | `conversation-turn-2` | 15848 | `false` | `93121e0384bd0e469e9bdfa1224fd8d584a5db08bc49ff18f17324264f751b66` |

两个回答长度相同，但哈希不同。这进一步证明：

```text
长度相同
≠
同一个回答被两个任务重复抓取
```

本轮实验提示词要求assistant重复本会话marker，便于人工校验；生产抓取不得依赖assistant一定复述marker。真正稳定的锚点仍应是：

```text
精确会话身份
+ 带marker的user turn
+ 该user turn之后的assistant turn
```

### 13.6 临时会话 URL 是必须处理的新事实

本轮两次观察到，ChatGPT点击发送后不会立刻获得最终持久化URL。

第一轮B提交后的即时URL：

```text
https://chatgpt.com/c/WEB:c1bf6217-69fd-47c6-88ca-9a46531b4ad9
```

随后收敛为：

```text
https://chatgpt.com/c/6a6527c2-2420-83eb-873d-651545da8230
```

第二轮：

```text
C即时URL：
https://chatgpt.com/c/WEB:538af69c-48d4-4aca-9ea8-fcf070a5b7d4

C正式URL：
https://chatgpt.com/c/6a6527fd-6458-83eb-97db-2e4c0c31f194

D即时URL：
https://chatgpt.com/c/WEB:619a2ffb-0b42-4df0-9a64-20ab9d2e6c74

D正式URL：
https://chatgpt.com/c/6a652808-b79c-83eb-bd7d-0a237ba10981
```

因此提交后的会话身份必须有两个阶段：

```text
submitted_transient
  tabHandle存在
  user turn marker已证明
  URL可能仍为/c/WEB:<uuid>

conversation_canonicalized
  同一tabHandle
  同一user turn marker
  URL已经变为正式/c/<conversation-id>
  正式URL持久化
```

禁止：

- 发送按钮点击后立刻把 `/c/WEB:<uuid>` 当作永久 continuation URL。
- 只等 URL 变化，不核对 user turn marker。
- URL从临时值变正式值后丢弃原tab身份和提交证明。
- 在正式URL尚未形成时因为“找不到历史会话”而重复提交提示词。

正确做法：

```text
点击发送
AND THEN
  新user turn包含本轮marker
  + tabHandle仍属于本attempt
  + origin仍为chatgpt.com
THEN
  标记submitted_transient

继续短轮询
AND THEN
  URL从/c/WEB:*收敛为/c/<canonical-id>
  + user turn仍包含同一marker
THEN
  持久化canonical conversation URL
```

### 13.7 DOM身份不能只靠 `conversation-turn-1`

两个独立会话都从以下局部编号开始：

```text
conversation-turn-1：user
conversation-turn-2：assistant
```

因此：

```text
conversation-turn-1
```

只在一个会话内部有意义，不是全局唯一身份。

安全组合必须至少是：

```text
providerHost
+ canonicalConversationUrl
+ internallyMintedTurnMarker
+ userTurnTestId
+ submittedPromptHash
```

在正式URL尚未形成时，过渡身份是：

```text
providerHost
+ controlledTabHandle
+ transientUrl
+ internallyMintedTurnMarker
+ userTurnTestId
+ submittedPromptHash
```

本轮还观察到，在流式生成期间的一次探测中：

```text
conversation-turn-2已经存在
stop-button已经存在
但assistant role属性没有在该轮DOM中稳定暴露
```

随后探测中role又恢复为assistant。这说明流式DOM会发生替换或属性短暂缺失。

因此生成中不得只靠单一 `data-message-author-role="assistant"` 判定。应组合：

- user turn marker已证明；
- 它之后出现新的conversation turn；
- `stop-button`存在，或回答文本相对上一轮增长；
- 当前会话URL和tab身份未漂移；
- 其他任务marker不存在。

### 13.8 生成中与完成的判定合同

本轮真实页面的生成中强信号是：

```text
button[data-testid="stop-button"]
accessible name：停止回答
```

但生产代码不能把一个按钮永久当作唯一真相，因为provider可能改DOM。建议状态判定：

```text
generating：
  exact conversation identity
  + exact user marker turn
  + assistant turn位于其后
  + stop-button存在
  + assistant文本为空、显示思考，或相对上轮增长

response_detected：
  assistant turn已存在
  + assistant文本长度 > 0

response_stable：
  stop-button不存在
  + assistant文本非空
  + 连续N次fresh读取文本哈希不变
  + exact conversation identity未漂移
  + user marker关系仍成立

response_captured：
  raw text与hash已经持久化
  + provider URL已经正式化
  + 抓取证据绑定task与marker
```

本轮实验使用的final marker只用于加强实验证明。生产状态机不能把“模型复述final marker”设为唯一完成条件。

### 13.9 对当前“全链独占”的新结论

本报告第7.1节记录的“从provider lease获得到response capture完成，全链独占”仍然准确描述当前生产规则，但本轮真实Chrome已经证明：

```text
它是当前AGENT的保护策略
不是ChatGPT Web的技术硬限制
```

真正需要独占的是会改变浏览器页面的短动作：

```text
打开或认领目标tab
上传附件
填写prompt
点击发送
确认新user turn
必要的焦点恢复
最终原始回答抓取与证据落盘
```

不需要全程独占的是：

```text
GPT服务端生成回答的几十秒或二十多分钟
```

因此后续生产重构应把一把长锁片区删除，改成：

```text
短时提交操作权
→ 释放
→ 多会话同时waiting_provider
→ 调度器按准确tab/URL/marker做短轮询
→ 回答完成时取得短时抓取操作权
→ 持久化后释放
```

禁止同时保留：

```text
旧的全程长锁主链
+
新的并发调度主链
```

这会形成双模式、双真相和无法判定的锁所有权。正式施工应在原AI Input Gateway owner内片区删除重构，不做compatibility bridge。

### 13.10 BrowserController应采用受限Tab池

本轮Chrome插件能够同时保有C、D两个准确Tab句柄，并对两个非同一页面执行独立DOM读取。

这说明现有“一切都复用一个host tab”不是唯一实现方式。后续可以在同一个BrowserController内建立受限Tab池：

```text
一个BrowserController
→ 最多N个受治理provider tabs
→ 每个in-flight feed独占一个tab lease
→ 同一tab只属于一个attempt
→ 调度器统一提交、轮询、回收
```

这不是第二BrowserController，也不是第二provider owner。

每个在途会话至少持久化：

```ts
type WebChatInFlightIdentity = {
  taskId: string;
  attemptId: string;
  providerKind: "gpt-web-chat";
  providerHost: "chatgpt.com";
  turnMarker: string;
  promptHash: string;
  controlledTabLeaseId: string;
  transientUrl: string | null;
  canonicalConversationUrl: string | null;
  userTurnTestId: string | null;
  submittedAt: string;
  lastPolledAt: string | null;
  lastAssistantTextHash: string | null;
  lastAssistantTextLength: number;
  stableRounds: number;
};
```

注意：

- `controlledTabLeaseId`是AGENT内部凭据，外部网站不能传入。
- `turnMarker`由AI Input Gateway内部生成，外部网站不能拿它选择或劫持别的会话。
- Tab池必须有固定上限，首轮生产目标可以是2，不得无限开tab。
- 会话结束、失败或进入人工复核后，tab必须按统一回收规则处理。
- 进程重启后的tab重新认领仍需单独真实Chrome验收，不能仅凭本轮句柄存活推断。

### 13.11 带附件并发时仍需串行的区域

本轮证明的是“生成等待可并发”，不等于原生文件选择器可以并行操作。

带附件时以下区域仍应全局短时互斥：

```text
激活目标Chrome窗口
→ 打开目标tab
→ 打开附件菜单
→ 操作唯一macOS sheet
→ 返回目标tab
→ 证明当前composer附件集合
→ 填写并提交prompt
```

原因：

- macOS原生文件选择器属于窗口级sheet，不属于单个网页DOM。
- Command+Shift+G、Command+A和“打开”依赖当前前台窗口与焦点。
- 两个任务同时打开原生sheet会造成窗口和文件集合多义。

所以推荐调度不是“两个任务同时抢着上传”，而是：

```text
任务C短时独占完成附件+prompt提交
→ 立即释放
→ C在服务端生成
→ 任务D短时独占完成附件+prompt提交
→ 立即释放
→ C、D同时在服务端生成
→ 调度器轮询两个会话
```

这种结构已经足够把两次22分钟的独立分析从串行等待改成并行等待，同时不破坏原生附件选择器的单义性。

### 13.12 可直接进入后续施工的状态机

建议把当前单次feed拆成：

```text
accepted
→ waiting_for_submit_slot
→ submitting
→ submitted_transient
→ conversation_canonicalized
→ waiting_provider
→ response_detected
→ response_stable
→ response_captured
→ cleanup_completed
```

异常出口：

```text
review_required
failed
cancelled
```

调度器拥有两种不同的内部资源权：

```text
provider_submit_lease：
  用于打开tab、附件、prompt、submit和提交证明
  必须短时持有

provider_tab_lease：
  一个在途任务绑定一个受治理tab
  从提交前持续到回答抓取和清理完成
  它不阻止其他tab同时生成
```

如果当前BrowserController暂时只能操作active tab，第一阶段仍可：

```text
一个统一poll scheduler
→ 短时聚焦C
→ 核对URL+marker
→ 读取一次
→ 短时聚焦D
→ 核对URL+marker
→ 读取一次
```

但本轮Chrome插件已经证明精确Tab句柄可以直接读取目标DOM。正式设计应优先评估把这一能力收回现有BrowserController，而不是长期依赖“先切成active tab再猜当前页面”。

### 13.13 并发轮询伪代码

```ts
async function pollOne(task: WebChatInFlightIdentity) {
  const tab = await browserController.resolveGovernedTab({
    controlledTabLeaseId: task.controlledTabLeaseId,
    canonicalConversationUrl: task.canonicalConversationUrl,
    transientUrl: task.transientUrl,
  });

  const observation = await tab.readScopedConversationDom({
    providerHost: task.providerHost,
    turnMarker: task.turnMarker,
    expectedUserTurnId: task.userTurnTestId,
  });

  assert(
    observation.providerHost === task.providerHost
    && observation.userTurnMarkerMatched === true
    && observation.otherTaskMarkerDetected === false,
  );

  if (!task.canonicalConversationUrl && observation.canonicalConversationUrl) {
    await persistCanonicalConversationIdentity(task, observation);
  }

  if (observation.generating) {
    return recordProgress(task, observation);
  }

  if (!observation.answerText) {
    return recordPending(task, observation);
  }

  return advanceStableAnswer(task, observation);
}
```

统一调度：

```ts
for (const task of fairQueue.inFlightTasks()) {
  await pollOne(task);
}
```

如果BrowserController支持准确目标tab的独立evaluate，可以受控并行读取：

```ts
await Promise.all(
  selectedTasks.map((task) => pollOneReadOnly(task)),
);
```

但写动作、原生文件选择器和tab回收仍必须通过统一调度器串行裁决，不能让每个任务拥有自己的无协调控制循环。

### 13.14 本轮最终技术结论

```text
CHROME_VERIFIED: true
```

已被真实Chrome证明：

1. 同一ChatGPT账号至少可以同时生成两个独立会话。
2. 第二个会话提交时，第一个会话可以明确处于`stop-button`存在的生成状态。
3. 两个会话可在同一时间同时存在`stop-button`。
4. 两个会话回答文本在交替轮询期间同时持续增长。
5. 切换读取另一个标签页不会停止前一个会话的服务端生成。
6. 两个会话均完成300项长输出。
7. 两个会话的正式URL不同。
8. 两个会话的user turn分别只包含自己的marker。
9. 两个终态回答均不包含对方marker。
10. 两个同长度回答的SHA-256不同，没有抓成同一份回答。
11. `/c/WEB:<uuid>`是提交后的临时URL，不能直接当永久会话身份。
12. `conversation-turn-1/2`只在单个会话内编号，不是全局身份。
13. 流式生成期间role属性可能短暂不稳定，必须用组合证据。
14. 当前全程provider lease是AGENT实现策略，不是ChatGPT Web技术硬限制。

尚未被本轮证明：

1. 两个带附件会话同时提交的完整生产链。
2. 22分钟级玄学任务在真实长期运行中的账号限流表现。
3. 三个及以上同时在途会话的安全容量。
4. 进程重启后的tab恢复与防重复提交。
5. continuation在多会话调度中的完整证据闭环。
6. CAPTCHA、登录失效、账号限制和用户抢焦点时的并发恢复。

因此当前最准确的结论是：

> 用户提出的“不同提示词使用唯一标识、多个ChatGPT会话同时生成、AGENT按标识轮询DOM”的核心方案已经被真实Chrome证明可行。生产实现不能只靠marker字符串，还必须加入准确Tab所有权、临时URL到正式URL的收敛、user turn相对关系、回答稳定哈希和短时浏览器操作权。当前长锁应在后续法案授权后于原AI Input Gateway owner内片区删除重构。

## 14. 单物理标签页＋系统重命名聊天＋marker巡查实证

### 14.1 本节替换的错误片区

2026-07-26 的第二轮真实 Chrome 实证没有继续证明“多标签可用”，而是直接验证最终目标：

```txt
一个物理 ChatGPT 标签页
→ 创建聊天 A 并发送带 marker 的提示词
→ 等待侧栏聊天名称出现
→ 点击该聊天的选项
→ 点击“重命名”
→ 写入系统生成的唯一聊天名并回车
→ 在同一标签页创建聊天 B，重复以上过程
→ 按系统聊天名逐个点击切换
→ 在打开后的聊天 DOM 中核对 marker
→ 只读取 marker 所属 user turn 后面的 assistant turn
```

以下旧实现合同已被片区删除：

- 每任务创建一个 Chrome 标签页；
- 每任务持有 `tabLeaseId`；
- 用 `window.name` 保存任务级标签租约；
- 按 provider 标签页轮询；
- 完成后关闭任务标签页；
- 把 Chrome 标签数当作 GPT 并发数。

新的 `N` 表示“最多 N 个已经提交、尚未完成的独立 GPT 聊天”，不表示 N 个 Chrome
标签页。默认容量可以是 10，但物理 ChatGPT 标签页始终是 1。

### 14.2 真实 Chrome 观测值

本轮在同一个已登录 ChatGPT 物理标签页内创建两个独立任务：

| 证据 | 聊天 A | 聊天 B |
|---|---|---|
| 提示词 marker | `GRASSEYE_SINGLE_TAB_ms12zu8e_A` | `GRASSEYE_SINGLE_TAB_ms12zu8e_B` |
| 系统重命名 | `AGENT-单标签实证-ms12zu8e-A` | `AGENT-单标签实证-ms12zu8e-B` |
| 正式会话路径 | `/c/6a6559ce-7d8c-83eb-8021-bc3f8734ab17` | `/c/6a655a0d-1d1c-83eb-ac0a-916cfc9a7086` |
| marker 命中数 | 1 | 1 |
| 对方 marker 命中数 | 0 | 0 |
| 最终回答长度 | 984 字符 | 984 字符 |
| 最终编号行 | 180 行甲＋完成 | 180 行乙＋完成 |
| 生成按钮终态 | 不存在 | 不存在 |

两个任务均在同一个物理标签页中完成。切换聊天只改变当前显示的会话，不会终止另一个
会话在服务端的生成。

### 14.3 ChatGPT 重命名 DOM 的真实操作合同

本轮中文界面实际观测到：

1. 侧栏聊天链接出现后，其选项按钮的 `aria-label` 形如
   `打开“<当前标题>”的对话选项`；
2. 点击后出现菜单，真实菜单项包含：
   `分享`、`重命名`、`移至项目`、`置顶聊天`、`归档`、`删除`；
3. 点击角色为 `menuitem`、可见文字严格等于 `重命名` 的唯一菜单项；
4. 重命名输入框的无障碍名称是 `聊天标题`；
5. 对输入框执行全选清空、输入系统聊天名、按 Enter；
6. 重命名成功后同时证明：
   - 侧栏中恰有一个链接文字严格等于系统聊天名；
   - 该链接仍指向本任务正式会话路径；
   - 当前页面路径严格等于该侧栏链接的正式会话路径；
   - 当前聊天 DOM 中本任务 marker 恰好出现一次。

点击必须是真实浏览器鼠标/键盘动作。DOM 脚本只负责定位唯一目标和回读证据，不能用
脚本直接伪造重命名结果。

重构后第一次真实代码回放还发现：只在侧栏直接点一个“非当前聊天”的选项按钮，菜单可能
不会出现；先真实点击该聊天链接，使它成为当前聊天，再点同一条目的选项按钮，菜单稳定出现，
其六个 `menuitem` 的 `innerText` 分别为分享、重命名、移至项目、置顶聊天、归档、删除。
因此代码必须先执行“聊天链接当前化＋marker 回读”，再打开重命名菜单。

第二次真实代码回放又发现：`a[href]` 解析后的 `pathname` 相等仍不足以证明它是聊天链接。
页面的“跳至内容”链接使用 `#main`，浏览器解析后会继承当前 `/c/<id>` pathname，从而与
当前聊天路径假相等。聊天定位必须同时要求原始 `href` 含 `/c/`，再比较解析后的正式路径；
否则会把无障碍跳转链接误当成第二个聊天链接并错误报告歧义。

### 14.4 自动标题不能当任务身份

本轮发现一个会直接造成串话的事实：聊天 B 的自动标题先显示为
`单标签多聊天任务`，随后又自动变化为 `任务B完成`。

因此：

```txt
自动标题 ≠ 稳定主键
自动标题文本 ≠ 可恢复身份
```

系统必须用正式会话路径先定位刚提交的侧栏条目，随后立即执行重命名。只有系统聊天名、
正式会话路径和 marker 三项已经共同核验，任务才能从 `submitting` 进入
`waiting_provider` 并释放浏览器短锁。

第三次真实代码回放证明自动标题还存在竞态：第一条聊天的系统重命名曾短暂执行，但稍后被
ChatGPT 的异步自动命名覆盖；第二条聊天因为提交得更晚，系统重命名正常保留。解决方式不是
接受自动标题，而是在同一提交阶段进行最多三次有界重命名核验：每次都重新打开当前聊天选项、
写入同一个系统聊天名，并持续回读侧栏标题、正式路径和 marker；只有三项同时成立才释放
提交锁。这个重试只重做重命名 UI，不得重发提示词。

最终重构后的再次实证还发现：侧栏重命名、正式路径和 marker 已经全部正确时，
`document.title` 仍可能延迟更新。失败现场稍后回读显示，原先被误判的聊天已以正确系统名
稳定存在于侧栏。浏览器页面标题不是用户提出的身份依据，也不是 ChatGPT 聊天记录主键，因此
不得再把它作为放行条件；它只保留为诊断观测。稳定身份合同最终固定为：
`侧栏唯一系统聊天名对应当前正式路径 + 当前聊天 marker 唯一`。

随后一次真实回放发现了另一类输入层问题：macOS `System Events keystroke` 将
`GRASSEYE-...` 实际输入成了 `GRASEYE-...`，重复字符发生丢失。代码不能在按 Enter 后才
发现标题错误，也不能假设键盘动作已经完整执行。重命名输入因此改为：

```txt
清空聊天标题输入框
→ 使用系统剪贴板和真实 Command+V 粘贴系统聊天名
→ DOM 回读“聊天标题”输入框的实际 value
→ 只有 value 与目标名称逐字相等才按 Enter
→ 提交后再核验侧栏唯一名称、正式路径和 marker
```

DOM 仍只负责回读和定位，真正的输入与提交使用系统剪贴板、键盘和鼠标动作完成。

继续回放时，连续验收触发了 ChatGPT 的“请求过于频繁”对话记录临时限制。现场 DOM 同时
出现两个可见的“搜索聊天”按钮：一个位于窄侧栏轨道，另一个位于展开侧栏顶部；二者是同一
功能的响应式入口，不能因为数量为 2 就误报身份歧义。路由现在固定选择展开侧栏中横坐标更大
的入口。若历史列表被限流对话框遮蔽，最高优先级固定生存动作是定位唯一“明白了”按钮并
秒点，随后立即刷新当前同一标签页，再恢复系统聊天名＋marker 巡查；不得先搜索、开新聊天、
重发提示词或另开标签页。系统聊天名或 marker 本身的重复仍然必须失败关闭。

### 14.5 巡查算法

生产巡查默认每 60 秒一轮。等待本身不占浏览器锁：

```txt
for each in-flight task:
  等到本任务下一个巡查时间
  抢占全局 browser-mutation 短锁
  在当前物理标签页侧栏查找 exact(systemChatTitle)
  如果近期侧栏没有，则打开“搜索聊天”并搜索 exact(systemChatTitle)
  真实点击唯一匹配聊天
  证明侧栏唯一 systemChatTitle 链接指向当前正式会话路径
  证明 user turn 中 markerCount == 1
  找到该 user turn 后面的第一个 assistant turn
  若仍生成：记录进度并释放短锁
  若已完成且回答稳定：保存原文、hash、URL和证据并释放短锁
```

严禁：

- 只按当前页面最后一条 assistant 回答取结果；
- 只按聊天名取结果而不核对 marker；
- 只按 marker 搜索全页面而不先切换到指定聊天；
- 依赖 ChatGPT 自动标题；
- marker 缺失或重复时继续读取；
- 巡查等待 60 秒期间占用浏览器操作锁；
- 因任务并发增加而打开更多物理 ChatGPT 标签页。

### 14.6 失败关闭条件

以下任一情况必须进入 `review_required`，不得猜测：

- 系统聊天名在侧栏或搜索结果中出现多次；
- 点击聊天后，侧栏唯一系统聊天名链接不指向当前正式会话路径；
- marker 命中数不是 1；
- 系统聊天名与持久化正式会话不一致；
- 重命名菜单、`聊天标题` 输入框或目标聊天链接不唯一；
- 提交后没有形成正式 `/c/<id>` 会话；
- 进程恢复时找不到系统重命名聊天；
- 发现运行时创建了第二个物理 ChatGPT 标签页；
- 回答仍显示停止生成控件或未达到稳定条件。

### 14.7 当前最终技术结论

```txt
CHROME_VERIFIED_SINGLE_PHYSICAL_TAB: true
CHROME_VERIFIED_TWO_RENAMED_CONVERSATIONS: true
CHROME_VERIFIED_TITLE_PLUS_MARKER_ROUTING: true
CHROME_VERIFIED_AUTO_TITLE_IS_MUTABLE: true
```

本轮实证已经把并发的技术本质固定下来：

> GPT 并发发生在不同聊天会话，不发生在 Chrome 标签页。AGENT 只需要一个物理标签页；
> 每次提交后把聊天重命名为系统唯一名称；之后按聊天名切换，再用提示词 marker 对照 DOM
> 身份，完成后回传结果。附件、输入、发送、重命名、切换和读取仍必须短时串行，但等待
> GPT 生成可以有 N 个真实在途任务。

### 14.8 重构代码最终真实 Chrome 验收

最终验收命令：

```sh
npm run acceptance:ai-input-gateway-web-chat-parallel:real-chrome
```

验收运行目录：

```txt
/var/folders/wg/jqx8m72j5t73k7b8stzs_kpc0000gn/T/grasseye-real-chrome-parallel-eX7Nvc
```

最终结果：

| 证据 | 任务 1 | 任务 2 |
| --- | --- | --- |
| 系统聊天名 | `GRASSEYE-c4b8a19d98bd-28309087be46` | `GRASSEYE-96d89b7da418-c580654f14b9` |
| marker | `GRASSEYE_TURN_21cfc64691d84356aceb28309087be46` | `GRASSEYE_TURN_328817aa390b4bc1981bc580654f14b9` |
| 正式会话 | `/c/6a6560d7-1418-83eb-a95b-1996a34aca69` | `/c/6a6560bc-e4b0-83eb-94eb-a9e3f122d61f` |
| 提交完成 | `2026-07-26T01:20:28.232Z` | `2026-07-26T01:20:01.192Z` |
| 重命名核验 | `2026-07-26T01:20:36.514Z` | `2026-07-26T01:20:10.040Z` |
| 回答捕获 | `2026-07-26T01:21:42.282Z` | `2026-07-26T01:21:20.281Z` |
| 终态 | `response_captured` | `response_captured` |

本轮两个任务的提交和重命名都早于第一份回答捕获。ChatGPT 物理标签页计数在验收前后均为
`2`，没有因两个任务而增加；验收程序复用同一个受控活动标签页完成两个新聊天。两份回答
分别通过本任务系统聊天名和 marker 双重核验，且都不含对方 marker。

这次验收同时修正了一处时间证据缺陷：正式会话再次核验时不得用“捕获时刻”覆盖原始
`submittedAt`。提交时间一经建立必须原样保留，否则会把真实并发误报成串行。

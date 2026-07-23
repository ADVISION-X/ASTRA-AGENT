# 附件＋提示词投喂给网页版 AI 分析实操论证报告

> 文件身份：真实 Chrome 实操记录、第二上传链路施工输入、DOM/原生文件选择器边界说明
> 文件状态：verified-v1.0
> 实操日期：2026-07-24
> 实操对象：ChatGPT Web（`https://chatgpt.com/`）
> 目标模式：点击“＋”→ 官方文件选择器 → 目标目录 → Command+A → 一次打开 → 附件稳定 → 提示词稳定 → 提交
> 当前结论：标准子能力已经接入 AI Input Gateway；真实 Chrome 的 1、10、17 文件均完成“上传、稳定、提示词、发送、新回答、内容校验、证据落账”闭环

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
| Provider标签 | 精确受治理URL、`chatgpt.com` origin、当前lease | 第一个同origin标签、其他ChatGPT对话 | `review_required` |
| Composer | `main`内、role textbox、accessible name精确、唯一 | 搜索框、插件搜索、隐藏input | `PROMPT_COMPOSER_AMBIGUOUS` |
| “＋”按钮 | composer同区域、role button、name精确、唯一 | 侧边栏/项目/插件加号、无名按钮 | `UPLOAD_PLUS_AMBIGUOUS` |
| 上传菜单项 | 同一行同时含“添加照片和文件”＋“从电脑上传” | 创建图片、网页搜索、深度研究、插件 | `UPLOAD_MENU_AMBIGUOUS` |
| 通用file input | `type=file`＋`multiple`＋非`image/*`，恰好1个 | 两个`accept=image/*` input | `GENERAL_FILE_INPUT_AMBIGUOUS` |
| 附件chip | 当前composer内group＋对应移除按钮 | 文件库、历史对话、全局同名文本 | `ATTACHMENT_COUNT_MISMATCH` |
| 发送按钮 | composer操作区、role button、name精确、enabled、唯一 | 听写、语音、停止生成、无名按钮 | `SEND_BUTTON_AMBIGUOUS` |

核心原则：

```text
DOM定位永远是“包含条件全部满足”并且“排除条件全部不满足”。
不是找到一个看起来像的元素就继续。
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

# GPT 页面 DOM 更新与工单恢复－完整实现方案

## 1. 候选与裁决

- 候选：`/Users/nexgen/Documents/AGENT` 的 `main`，基线 `3823c8f8a181778330eac957aeeea9ab923d7e8c`；Website 的业务 Owner、父任务合同及 v4 cutover 不变。
- 已证实断裂：新静态 root 与 public knowledge root 在 `prepare_clean_gpt_chat` 报 `GPT_CHAT_MODE_MISSING`；有父身份的文章任务在 `open_gpt_execution_profile` 报 `GPT_EXECUTION_PROFILE_OPEN_QUALIFICATION_INVALID`。三个错误均发生在 Provider submit 前，不能据此断言父 URL 错配或聊天丢失。
- 页面实证：根页当前唯一 `role=group[aria-label=撰写器模式]` 含两个 `button[aria-pressed]`；Composer 是 `form[data-chatgpt-composer] [data-composer-markdown][role=textbox]` 下唯一 `contenteditable=true` 节点，无 `#prompt-textarea`；模型触发是 `button[aria-label=选择 ChatGPT 模型][aria-haspopup=menu]`，弹层为 `role=menu[data-radix-menu-content]`，有 `data-model-picker-view=simple|advanced`；强度控件为 `menuitem[data-reasoning-slider]` 和其当前滑杆；附件入口为 `button[aria-label=添加文件等内容]`，上传选择位于 `data-composer-overlay-floating-ui`；非空草稿时当前发送按钮为 `form[data-chatgpt-composer] button[type=submit][aria-label=发送]`。用户另行授权的一次无业务测试发送已完成，未删除聊天。
- 发送后页面实证：现役 `/c/` 页已无旧 `conversation-turn-*` / `data-message-author-role`。五轮既有聊天与一次测试聊天重载后，每个用户轮次各有一个 `data-turn-key` UUID 外层，UUID 在当前页唯一，以及顺序为 `fallback-turn-N` 的 `data-content-search-turn-key`。同一外层内有唯一 `data-chatgpt-search-unit-key` 后缀 `:user` 的用户单元与唯一真实紧邻的 `:assistant` 单元；用户单元的 message ids 等于 UUID，用户正文位于唯一 `data-user-message-bubble=true`；助手单元的正文位于其 `data-chatgpt-selection-message-id` 所绑定的 `data-markdown-text-style=assistant-message`。生成期间存在 `form[data-chatgpt-composer] button[aria-label=停止]`，完成后消失。此证据只覆盖所见的短 Prompt 和文本回答；长 Prompt、图片以及业务 job 的真实交付仍须单独验收。
- 现役 authority：`LAW-GPT-001-V62`、`LAW-GPT-002-V28`、`GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md`、Browser 唯一 Target/WAL 施工图与 `FROZEN-GPT-SUBMIT-TWO-PRECONDITIONS-001`。法案的业务语义无变化；施工图明确 DOM 变更只替换原 Child 事实链，不增加第三 submit 前置门。

## 2. 唯一执行边界

Website demand → Runtime 按原 job/attempt 领取 → Product 按原 Flow 调用 GPT Child → Browser 以原 Target/Document、FIFO 与 WAL 执行一次动作并返回同包事实 → Product 结果 → Runtime Outbox → Website Domain Consumer admission。DOM 更新只在 GPT 精确页面 Child 与 Browser 机械属性读回；不修改 Website 的父身份、Provider effect identity、重试授权、Outbox 或业务完成权。

`prepare_clean_gpt_chat` 在 fresh root 的一个 coherent packet 中证明两按钮互斥状态、空 Composer、零历史 turn/附件/generating。Work→Chat 最多一次点击，同一 Browser mutation packet 证明被点击按钮 `aria-pressed=true` 且另一个为 false；旧草稿清空仍与模式切换互斥。continuation 不执行 root 模式切换。

发送后在原 Browser coherent observation 中以最大有效 `fallback-turn-N` 取得唯一新用户轮次，核其外层 UUID、唯一 user 单元和批准 Prompt hash；已发生输入而身份未知时保留原 WAL DISPATCHED，只走同 effect 零输入对账。CONFIRMED 后只保存同包 canonical URL 与该 UUID，文本回答用该 UUID 定位同一外层的唯一紧邻 assistant 单元；图片只在该用户轮次之后、下一个用户轮次之前查 source，不等待 assistant role；两者都不重新 hash 历史 Prompt。生成状态和非空正文仍遵守现役两门合同。旧轮次选择器、旧正则和对应夹具在同一片区物理删除；旧 WAL 事实保留，无法以现役 DOM 定位的旧 effect 走现役 unaddressable/risk grant 结算，不伪造未发送证明。

配置开/关只证明当前唯一触发、弹层、活动 simple view 与强度读回；模型选择必须先打开当前 advanced view、选择 Product 指定的唯一 radio，并读回同一节点选中及弹层关闭；强度按当前滑杆最大值执行 `min(requested,max)` 并读回，仍只一次输入。附件入口、文件选择及现有附件集合对账继续由原 Child 执行；Composer 写入和提交只替换 DOM 地址，submit 的两项冻结前置条件与发送后精确 user turn 证明保持原样。页面标记不存在、多义或无法证明动作后的状态，当前动作 fail closed，工单仍由 Website 原恢复主链继续。

## 3. 施工片区与物理退出

1. GPT Child 的 `prepare_clean_gpt_chat`、`open/close_gpt_execution_profile`、`open_gpt_model_selector_v3`、`select_gpt_model_from_start_v3`、`select_gpt_reasoning_from_start_v3`、`open_gpt_attachment_control`、`attach_approved_gpt_files_once`、`reconcile_gpt_attachment_set`、`write_exact_gpt_prompt`、`submit_exact_gpt_turn_once`：替换实际失效的 selector、状态投影和原后置条件。提交/回答/图片/恢复的直接消费者统一采用新的精确轮次身份。直接 consumer `contract.ts` 同步当前控件文字，Child 身份、schema、action ordinal 与结果合同不变。
2. Browser 机械观察层补 `ariaPressed`/`aria-pressed` 的同一 typed 属性通路，将空 Composer 的旧 id 判定换成当前节点特征，并将 `exactGptUserPromptHash`、最新用户轮次、text/image exact answer 与 materialization 整体换到 `data-turn-key` / `fallback-turn-N` / 角色单元。保留模型 radio 所需 `ariaChecked`，不建第二观察或 mutation API。
3. `gpt-exact-target`、profile/model/reasoning、attachment、write/submit 原验收及唯一 GPT audit inspector 同步替换旧 DOM 字面量和 fixture；覆盖成功、缺席、多义、不可操作、错误后置状态与零重放。物理删除本片区的旧 `#prompt-textarea`、旧 radio group、旧模型/附件菜单字面量和其只为旧 DOM 存在的质检断言；不留下兼容 selector 或双路径。
4. 先把 Browser 004/006 规范升版及 GPT 001/002 的现役依赖指针、GPT/Browser 施工图、Manifest、registry 和审计 ID 对齐，主 Codex 正反各审一次，达到自检门槛后再继续代码。之后跑 GPT/Browser 定向验收及冻结 `ci-full-governance` 的 AGENT 原生 `quality:check -- CHANGE`、clean Git commit 与 `quality:check -- READY`。独立子智能体只读审计实际差异和剩余旧路径，发现阻断则继续迭代。用户已裁决停在 RELEASE 前，不把 READY 或页面检查称为业务完成。
5. 原入口重启 AGENT 后先核 Website control、原任务/attempt/effect 与无在途 Provider submit，再受控恢复领取。对同一批任务读回：Provider submit 身份与增量、结果 artifact、Runtime Outbox、Website staging、Domain admission receipt、最终 completed。任何新 DOM 或身份错误即重新 draining，保留原身份修正；不删除已接纳结果或 GPT 聊天，不盲重发。

依赖版本裁决：GPT 001/002 与 Runtime 001/006 的义务、forbidden、Owner 和证据门槛未改变，仅把依赖 ID 指向现役 Browser 004/006。按母本 §72.1 的“依赖义务发生规范变化”判据，这些纯指针同步不触发连锁 major；只有 Browser 004/006 的 DOM 规范正文升级。

## 4. 实证边界

当前根页和弹层观察能证明模式、Composer、模型/强度与附件入口的形状；一次测试发送和五轮既有聊天的只读重载可证明当前短 Prompt 文本轮次身份、生成状态和助手正文形状。不能证明长 Prompt、图片、每个业务模型、文件真实上传、父会话续接或 Website admission。下一次真实提交只在现役授权 job 的原 Flow 中进行，前后必须按原 WAL/receipt 精确读回。若新页面没有足够稳定的精确身份或 action 后置事实，停在该 Child 的 typed failure 并报告缺口，不放宽 identity 或制造成功回执。

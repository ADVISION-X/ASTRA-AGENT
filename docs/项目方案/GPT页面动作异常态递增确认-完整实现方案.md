# GPT DOM 瞬态失败递增确认完整实现方案

> 状态：可施工（仅表示方案内部准入；代码、READY 与 RELEASE 均未开始）
>
> 需求 Owner：AGENT `gpt`
>
> 唯一 cadence Owner：现役 `local-browser-session/chatgpt-page-access-gate`
>
> 唯一目标：对“准备仅凭一次瞬态 DOM 样本作终局失败”的 GPT 页面裁决，统一追加 1.5 秒和 3 秒两次 fresh 只读复核
>
> 独立边界：不改发送 5 秒冻结协议、重命名 10 秒冻结协议、附件上传业务等待、Provider 70–90 秒回答观察、限流确认、N-TAB 或 Website

## 一、需求的准确语义

用户要解决的敌人只有一个：ChatGPT 页面重绘、节点替换或短暂无布局时，AGENT 在一个临界瞬间读到“不存在”，就立即宣告整个 Product 失败。

本方案不是“所有动作都多等 4.5 秒”，更不是“点击重试三次”。它只是一条失败前的只读证明规则：

```text
O0：按现役主链 fresh 读取一次
→ 已稳定 DONE / ACT：立即继续，零新增等待
→ 仅命中允许的瞬态 DOM 原因：申请 stage=1

Browser 唯一 Owner 等待 1500ms
→ O1：同一 exact Target/current Document 上重新读取整包事实
→ 恢复：立即继续
→ 仍是同一类瞬态原因：申请 stage=2

Browser 唯一 Owner 等待 3000ms
→ O2：同一 exact Target/current Document 上最后一次 fresh 读取
→ 恢复：立即继续
→ 仍异常：以 O2 事实正式失败
```

不可破坏的约束：

- O0 正常时 DOM 读取次数和延迟增量都为零；
- O1/O2 只读，不点击、不输入、不上传、不刷新、不导航、不换 Tab；
- 普通 mutation 仍只能 `physical_input_count=0|1`；
- 重命名是冻结的唯一例外：整体 `0|4`，部分执行诚实返回 `1..3`，任一阶段都不重放；
- Provider effect 已发生或结果不明时只能读回，不得因 DOM 恢复再发一次。

## 二、事故与第一直接断裂

已证实的页面闪烁事故点是 `close_gpt_execution_profile`：

```text
模型选择成功
→ 推理强度选择成功
→ close_gpt_execution_profile 只读一次 topology
→ 页面恰处于控件替换/重绘瞬间
→ 单样本既不满足 closed，也不满足 openable
→ GPT_EXECUTION_PROFILE_CLOSE_TRIGGER_INVALID
→ Product 失败并结算当前 Browser 生命周期
```

第一直接断裂是：**GPT 语义 Owner 把一包可由页面重绘解释的不完整 topology 当成了终局业务失败，没有要求 Browser 在同一 Target/Document 上追加有界 fresh 证明。**

已证实的 `BROWSER_PROVIDER_EFFECT_IDENTITY_DRIFT` 与页面闪烁不是同一问题。它发生在新 WAL `PREPARED` 和物理发送之前，是防止同一 job/result revision 用不同 effect identity 重复提交的硬边界。它必须保持零等待、零新 WAL、零物理输入；本方案只将它作为反例验收，不修复其活性问题。

## 三、唯一分类和边界

分类是 GPT 对当前 fresh coherent observation 的纯语义裁决，不新增数据库状态、Product 状态或公共状态机。

| 分类 | 含义 | 处理 |
| --- | --- | --- |
| `STABLE_DONE` | 目标已经满足 | 零输入完成 |
| `STABLE_ACT` | 身份、内容和唯一机械资格均完整 | 进入现役唯一 Browser mutation/WAL |
| `BUSINESS_PENDING` | 已经确认是真实业务异步工作未完成 | 仅交由现役业务 deadline/调度，不进入本协议 |
| `TRANSIENT_DOM` | 没有反向身份或内容证据，仅为可由重绘解释的 DOM 缺失/不完整 | 只能进入 stage 1/2 复核 |
| `HARD_FAIL` | 身份、授权、内容、唯一性、合同或现实副作用边界被破坏 | 立即失败，不启动复核 |

### 3.1 只有这些原因可进入 `TRANSIENT_DOM`

- 预期唯一节点当次为零，且没有其它矛盾节点；
- `BROWSER_DOM_NODE_STALE`；
- `NO_LAYOUT_BOX`、短暂无可见布局或计算样式处于重绘中；
- 同一 popup/menu/Composer/slider 的机械 topology 是无矛盾的 partial；
- 非 submit 冻结特例中，唯一正确控件短暂 `disabled/aria-disabled`；
- 动作后的直接机械后置节点尚未出现，且当前整包事实不含内容或身份 mismatch。

O0/O1/O2 每次都必须重新读取整包 observation，不得复用旧 nodeId、坐标、packet、候选集或失败文案。

### 3.2 这些原因必须立即 `HARD_FAIL`

- 候选多于一个、错误文案/模型/推理强度、或出现与目标相矛盾的稳定候选；
- Prompt hash、附件 identity/hash/count、父任务事实、canonical URL 不等；
- exact call、Website grant、attempt、lease、fence、Target 或 Document 漂移；
- 错误账号、错误会话、历史 turn、真实附件或真实生成内容出现在 fresh-chat 准备页；
- `prepare_clean_gpt_chat` 读到 `generatingRaw != 0`：这代表进入旧会话、错误页面或人工任务，不是闪烁；
- Browser WAL 已 `DISPATCHED/CONFIRMED`、现实输入结果不明、Provider effect identity 漂移；
- packet 结构、签名、加密、合同或权限无效。

### 3.3 `BUSINESS_PENDING` 只允许两个现役场景

1. 附件身份已经匹配，页面明确显示它仍在上传；
2. Provider effect 已确认发生，页面明确显示回答仍在生成。

其它“也许再等等”不得加入 `BUSINESS_PENDING`。它只是对现役业务等待的准确命名，不新建 WAIT Child、队列、timer 或恢复链。

## 四、“统一模式”的准确范围

统一的是**同一类终局失败决策**，不是把不同业务时限强行拉平。

### 4.1 必须接入本协议

| 能力 | 只能复核的瞬态事实 | 仍要立即失败的事实 |
| --- | --- | --- |
| `prepare_clean_gpt_chat` | 零 Composer、stale、no-layout | 历史 turn、附件、生成中、错误 URL、多 Composer |
| `open_gpt_execution_profile` | 控件整体缺席或无矛盾 partial | 多候选、错误控件、身份漂移 |
| `open_gpt_model_selector_v2` | 模型入口/目标选项缺席、stale、no-layout | 多候选、错误模型身份 |
| `select_exact_gpt_model_v2` | 唯一目标选项短暂缺席/stale/no-layout | 目标文案不等、多候选、非法 aria state |
| `ensure_gpt_reasoning_requirement` | 控件缺席、stale、无矛盾 partial | 错误需求值、多候选、身份不等 |
| `close_gpt_execution_profile` | 既非 closed 也非 openable 的无矛盾临界 topology | 多候选、错误控件、Target/Document 改变 |
| `open_gpt_attachment_control` | 入口缺席、stale、no-layout、无矛盾 partial | 多入口、错误菜单、身份不等 |
| `attach_approved_gpt_files_once` | 授权 file input 缺席/stale/no-layout | 批准文件 identity/hash 不等 |
| `write_exact_gpt_prompt` | Composer 缺席/stale/no-layout | 已写入内容 hash 不等、错误 Composer |
| 非冻结特例的 Browser 直接后置条件 | 后置节点缺席/stale/no-layout | 节点已出现但值/hash/URL/identity 不等 |

实施必须先保留 typed mismatch cause，再决定是否进入 stage 1/2。不得继续把“节点没出现”和“节点已出现但 Prompt hash 错了”折叠成同一个 `BROWSER_DOM_CANDIDATE_MISSING`。

### 4.2 必须保留现役特殊协议，严禁叠加 stage 1/2

| 现役协议 | 保留原因 | 本方案的约束 |
| --- | --- | --- |
| `FROZEN-GPT-SUBMIT-ACTIONABILITY-WAIT-001` | 发送按钮 disabled/aria-disabled 已有同一 submit command 内的冻结 5000ms 防重协议 | 原样保留；不得追加 1.5/3s，不得改 5s |
| `FROZEN-BROWSER-SETTLED-CONVERSATION-RENAME-001` | 固定 10s、四个逻辑输入各走全局至少 1.5s 门、末尾 2.5s 读回 | 原样保留；不加外层复核，不重放部分输入 |
| 附件已证明上传中 | 这是业务工作未完成，不是 DOM 闪烁 | 保留 Product deadline 内现役低频调度 |
| 已确认 Provider effect 的回答生成 | 这是 Provider 业务等待 | 保留 40s 静默门和 70–90s 全局下一次观察资格 |
| 限流弹窗确认 | 它是不超过 1s 的紧急安全通道 | 精确命中即确认；身份不等立即失败 |
| Tab 激活、Page.navigate、授权、WAL、effect recovery | 它们不是 GPT DOM 瞬态失败裁决 | 完全排除，不得借本方案延时或恢复 |

页面闪烁只有一种 stage 1/2 协议；表中保留的是其它问题的已冻结协议或业务等待，不允许它们反向被当成 DOM 闪烁复核。

## 五、唯一 Owner 与最少实现

### 5.1 Browser cadence Owner

直接复用现役 `src/lib/browser/chrome-extension/chatgpt-page-access-gate.ts`。它已经是账号级、跨 job/Tab/Product 的唯一页面访问节拍 Owner，不再建 helper 文件、timer service、全局时间常量文件或第二调度器。

在该 Owner 内原位增加唯一 typed 阶段入口：

```ts
type TransientDomConfirmationStage = 1 | 2;
awaitTransientDomConfirmationStage(stage, signal)
```

唯一映射为 `stage 1 -> 1500ms`、`stage 2 -> 3000ms`。调用方只能提交 stage，不得提交裸毫秒、自定义次数或动态间隔。

入口在等待前检查 abort，并复用 Browser 现役 30 秒 command envelope；不接受 caller deadline，也不允许某个 Child 用更短的局部 deadline 跳过 O2。一旦进入本协议，只能完整执行当前 1.5s/3s 阶段，或因 abort/command expiry 以独立传输失败中断；不得把预算中断伪装成页面状态失败。

GPT 侧不能继续通过 `BrowserTargetLease.wait({durationMs})` 表达 DOM 瞬态复核。在现有 `BrowserTargetLease` 上原位增加 `awaitTransientDomConfirmation({stage})`，它只把 typed stage 传给上述 Owner；不存储状态、不决定 GPT 语义、不获得物理输入。现有 raw `wait` 仅保留给已证明的业务等待，本方案涉及的 Child 不得用它复制 1500/3000。

Browser 扩展内的直接后置复核也只能调用同一 Owner，不得在 `dom-mutation-postcondition.ts` 再定义 tuple 或 sleep。

### 5.2 GPT 语义 Owner

GPT Child 继续唯一拥有 DONE/ACT/TRANSIENT/HARD_FAIL 的业务分类。`src/capabilities/gpt/web/gpt-dom-observation.ts` 只允许原位增加一个薄的共享驱动：

1. 接收 caller-owned fresh observation 和纯分类函数；
2. 只在分类为 `TRANSIENT_DOM` 时请求 stage 1/2；
3. 每次重读后先校验 exact call/Target/Document/current URL 连续性；
4. 返回最后一包 observation 和阶段，不生成动作、不吞掉 typed cause、不决定 Product 下一步。

该驱动不得接受 action callback、重试次数、裸毫秒、Product 配置或任意 predicate DSL。每个 Child 仍保留自己已有的具体语义 predicate 和 failure code。

### 5.3 Browser 后置原因必须保真

`src/lib/browser/chrome-extension/dom-mutation-postcondition.ts` 先输出精确 typed 原因：

- 候选为零、stale、no-layout：可进入复核；
- 多候选、attribute/value/hash/URL/identity mismatch：立即失败；
- `preClickExactOutgoingTurn` 的 Prompt hash 不等必须保留为内容错误，不再伪装成 candidate missing。

只有第一类原因且当前动作不受第 4.2 节特殊协议管辖时，才可调用唯一 stage Owner。

## 六、动作前、动作后与物理输入边界

### 6.1 动作前

```text
fresh coherent observation
→ DONE：零输入返回
→ ACT：进入现役唯一 WAL/mutation
→ BUSINESS_PENDING：返回现役业务调度边界
→ TRANSIENT_DOM：唯一 stage 1/2 只读复核
→ HARD_FAIL：立即失败
```

只有 O2 仍命中同类 `TRANSIENT_DOM` 才正式失败。终局证据必须使用 O2 的 observation revision、原生 cause、候选计数和 authority hashes。

### 6.2 动作后

动作后只允许重读直接后置条件：

```text
普通物理动作 0/1 次
→ 现役 2500ms 硬读回门
→ fresh P0
→ 若且仅若命中 TRANSIENT_DOM，进入 stage 1/2
→ 恢复则诚实结算；未恢复则以最后事实结算
```

任何物理输入开始后，都严禁因复核再点击、再 fill、再上传、再滑动或再 submit。冻结 submit 和 rename 不进入这个通用后置分支，只执行它们自身的现役协议。

### 6.3 Target/Document 连续性

O0/O1/O2 始终绑定：

```text
exactCallIdentityHash
+ targetRefHash
+ documentRefHash
+ canonical currentUrl（该 Child 要求时）
```

任一阶段发生变化，立即转为 `HARD_FAIL`，后续等待和 DOM 读取增量为零。系统不得在新 Document 上延续旧动作，也不得自行重找 Tab、刷新或导航。

## 七、精确施工片区与删除清单

### 7.1 允许修改

- `src/lib/browser/chrome-extension/chatgpt-page-access-gate.ts`：唯一 stage/cadence Owner；
- `src/lib/browser/exact-target/browser-target-lease.ts`、`browser-target-lease-manager.ts` 与现役 Browser public re-export：typed stage 入口；
- `src/lib/browser/exact-target/browser-command-actor.ts`、`src/lib/browser/chrome-extension/extension-target-observation.ts` 与 `extension-command-runtime.ts`：在现役 `browser.wait.v1` input/handler 原位增加 DOM confirmation stage 类型，不新建 command 或第二协议；
- `src/capabilities/gpt/web/gpt-dom-observation.ts`：薄的语义分类驱动；
- 第 4.1 节列出的现役 GPT Child `handler.ts` / `observation.ts`；
- `src/capabilities/gpt/contract.ts`：只将确实新接入等待的 `ensure_gpt_reasoning_requirement` `3->4`、`close_gpt_execution_profile` `3->4`、`attach_approved_gpt_files_once` `2->3` 改为真实 `boundedWait:true`；已为 true 或未接入者不动；
- `src/lib/browser/chrome-extension/dom-mutation-postcondition.ts`：typed cause 保真和非特例后置复核；
- `src/lib/browser/chrome-extension/dom-pointer-intent-runtime.ts`：只做原因分流，冻结 submit 分支原样保留；
- 现役 GPT/Local Browser acceptance 与 Inspector；
- GPT 与 Local Browser 两份现役施工图。

不修改 GPT Product Flow 次序、Child 对外 input/output schema、Website、Runtime claim/outbox、Browser WAL/store、N-TAB、Provider observation 调度、限流冷却或数据库。`boundedWait` 从 false 变 true 是真实执行语义变更，必须对应升版；不能为了声称“合同不变”而保留虚假元数据。

### 7.2 必须物理删除或退出本语义

1. 删除 `prepare_clean_gpt_chat` 用 `[5s,10s,15s,30s]` 处理 Composer 缺席的私有 hydration；历史 turn、附件、生成中和错误 URL 保持硬失败；
2. 删除 `open_gpt_execution_profile` 的私有 1.5s hydration loop；
3. 删除 `open_gpt_attachment_control` 的私有 1.5s hydration loop；
4. 删除第 4.1 节范围内的其它单样本终局失败和重复 deadline-loop 样板；
5. 删除 `waitForObservation` 将 outgoing-turn 内容 mismatch 统一伪装成 candidate missing 的折叠逻辑；
6. 删除模型菜单、推理强度、profile 等非冻结普通后置条件的局部 `timeoutMs: 5000` 失败循环，改由同一 stage 1/2 协议在现役 30 秒 command envelope 内完整执行；
7. 禁止新增 per-Child interval constant、动态 retry count 或环境变量。

必须保留 submit 现役 5000ms actionability loop、rename 现役 10s/四阶段/2.5s readback、attachment uploading 低频业务等待、Provider 40s 静默门与 70–90s 全局观察、2.5s 动作后首次 fresh readback 门、known-rate-limit 不超过 1s 的精确确认通道。

## 八、法案、施工图与合同裁决

### 8.1 法案不解冻

修订后的方案不再改动两个冻结时限：

- `FROZEN-GPT-SUBMIT-ACTIONABILITY-WAIT-001` 的 5000ms 和一次 submit；
- `FROZEN-BROWSER-SETTLED-CONVERSATION-RENAME-001` 的 10s、0/4 输入与不重放。

它也不改 Browser/GPT Owner、WAL、effect identity、attempt/lease/fence、1.5s 全局访问下限、2.5s 读回门、70–90s Provider 观察或限流紧急通道。因此不需要修改或解冻现役法案。

直接权威为 `LAW-GPT-002-V17` 与 `LAW-LOCAL-BROWSER-SESSION-004-V43`：它们已要求至少 1.5 秒全局页面访问门、fresh coherent observation、动作后 2.5 秒读回和物理输入不重放。本方案只在该现役边界内收紧一次性 DOM 失败证明，不创建新权威。

施工若发现必须改动上述 5s/10s 边界才能实现，必须立即停止，将方案回退为“设计阻断”并向用户单独请求解冻；不得用 deadline 尾读、缩短 1.5/3s 或跳过 O2 偷渡。

### 8.2 施工图原位更新

施工时只同步：

- `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md`；
- `docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md`。

GPT 施工图固化语义分类与适用 Child；Browser 施工图固化唯一 stage Owner、typed cause、Target/Document 连续性和物理输入不重放。Website 法案/施工图、跨仓合同和数据库都不改。

## 九、删除反事实与防止过度设计

| 保留/增加单元 | 当前必要性与真实消费者 | 删除后的具体失败 |
| --- | --- | --- |
| `chatgpt-page-access-gate` 内的 typed stage 映射 | GPT 动作前复核与 Browser 非特例后置复核共用 | 调用方只能重新传裸毫秒，立即恢复多套 cadence |
| `BrowserTargetLease.awaitTransientDomConfirmation(stage)` | AGENT 侧 GPT Child 需要请求 Browser-owned stage，且不能自己 sleep | 无法让唯一 Browser Owner 管理跨进程的 1.5/3s 阶段 |
| GPT 薄分类驱动 | 多个现役 Child 共用，但业务 predicate 仍在各 Child | 每个 Child 必须复制 stage 编排、abort 与 Document 连续性 |
| postcondition typed mismatch 保真 | Browser WAL 结算与 GPT submit/普通后置验证直接消费 | 内容错误会被当成闪烁无效等待 |

不新增生产文件、Child、Product action、Owner、队列、scheduler、timer service、全局时间常量文件、数据库表/列/migration、WAL、Website 字段/接口、fallback、兼容桥、第二 Browser lane、第二恢复链、第二质量结论或可配置重试次数。

生产代码采用“删除私有循环 + 原位共享”，目标净行数 `<= 0`。如无法用删除现役重复循环抵消 typed stage 入口，施工者必须说明每个新增单元被删除后哪个真实消费者会如何失败；证明不成立则删除。

## 十、确定性验收

### 10.1 统一协议

1. O0 稳定 DONE/ACT：无 stage 请求，无新增等待，DOM 读取增量为零；
2. O0 transient、O1 恢复：stage 序列精确为 `[1]`，实际等待为 `[1500]`；
3. O0/O1 transient、O2 恢复：stage 序列 `[1,2]`，实际等待 `[1500,3000]`；
4. O2 仍 transient：以 O2 packet 的 revision/cause 失败；
5. O1 改为内容错误或多候选：立即失败，不请求 stage 2；
6. O1/O2 Target、Document、exact call 或 URL 漂移：立即失败；
7. abort 在任一 stage 前/中发生：不再读取、不输入；
8. stage 进入后不得因局部 deadline 跳过 O2；abort 或 30 秒 command expiry 必须返回独立传输失败，不伪装成 DOM 失败；
9. 动作后 P0/P1/P2 全失败：普通物理输入仍为 1，不重放。

### 10.2 硬错误与冻结协议零回归

1. `prepare_clean_gpt_chat` 出现生成中/历史 turn/附件/错误 URL：stage 请求为零；
2. Prompt hash、附件 hash/count、canonical URL 或 Provider effect identity 不等：stage 请求为零；
3. 同 job/result revision 已有 CONFIRMED effect 且新 identity 漂移：返回 `BROWSER_PROVIDER_EFFECT_IDENTITY_DRIFT`，无新 PREPARED，物理输入为零；
4. submit disabled/aria-disabled：仍仅走冻结 5000ms 协议，没有 stage 1/2 调用；
5. rename：仍是固定 10s、四阶段各一次、末尾 2.5s readback，没有外层 stage；
6. 附件真实 uploading 和 Provider 真实 generating：仍只走原业务调度；
7. exact rate-limit dialog：仍在不超过 1s 边界内确认，确认后仍等 2.5s fresh readback。

### 10.3 事故专属回归

```text
close_gpt_execution_profile
O0：既非 profileOpenReady，也非 profileClosedReady，无矛盾候选
→ stage 1 / 1500ms
O1：仍为同类 partial
→ stage 2 / 3000ms
O2：profileOpenReady
→ 关闭一次
→ 2500ms fresh postcondition
→ profileClosedReady
→ Product 继续，不 park、不释放 attempt
```

另必须验收 O1 恢复、O2 仍失败、O1 出现多候选、Document 漂移四个反例。

### 10.4 原生质检

聚焦施工阶段：

```text
npm run acceptance:gpt
npm run acceptance:local-browser-terminal
npm run audit:build
git diff --check
```

用户另行授权 READY 后，才使用冻结 `$ci-full-governance` 执行唯一：

```text
npm run quality:check -- READY
```

READY 不等于 RELEASE。真实 Chrome 证据需要在 RELEASE 动态证明中验证闪烁样本被吸收、硬错误零延时、正常路径零额外读取、物理输入不重放。

## 十一、原子施工顺序

### 工单 A：施工图固化

- 原位更新 GPT 与 Local Browser 两份施工图；
- 固化唯一 stage Owner、适用原因、硬失败、特殊协议排除和物理输入边界；
- 不修改法案、Website 或 Child 对外 input/output schema；施工图对齐后只升必需 Child 的 bounded-wait 合同版本；
- 主 Codex 复核 5s submit 与 10s rename 条款均未被改写。

### 工单 B：唯一 cadence Owner 与 typed cause

- 在现役 page-access gate 内实现 stage 1/2；
- 用 typed lease 入口替换 DOM 复核中的 raw millisecond wait；
- 保留后置条件的 missing/stale/no-layout 与 mismatch 区别；
- 验收任一调用方都无法为 DOM 复核传入自定义毫秒。

### 工单 C：GPT Child 删除与接入

- 先删除第 7.2 节的私有 hydration/单样本失败；
- 再把第 4.1 节的瞬态原因接到唯一 stage 驱动；
- `prepare_clean_gpt_chat` 生成中等稳定错误保持硬失败；
- submit、rename、uploading、Provider generating 只作零变更回归，不接入。

### 工单 D：原位质检与候选收口

- 只扩充现役 GPT/Local Browser acceptance 与 Inspector；
- 执行第十节的确定性验收和原生质检；
- 验证生产文件增量为零、Owner/queue/store/WAL 增量为零、生产代码净行数目标 `<=0`；
- 如任一冻结特例变化，立即停止，不进入 READY。

代码工单不并发写入；后一工单只在前一工单的 candidate 和验收证据已锁定后开始。

## 十二、独立审计 finding 关闭矩阵

| finding | 本版关闭方式 |
| --- | --- |
| 1.5/3s 无法保证装入 submit 5s / rename 10s | 两个冻结协议完全排除，禁止叠加 stage；无需解冻 |
| `prepare_clean_gpt_chat` generating 被错归为等待 | 明确改为 `HARD_FAIL`，只有 Composer 的 missing/stale/no-layout 可复核 |
| 共享 tuple 不等于唯一 Owner | 唯一 Owner 回到现役 `chatgpt-page-access-gate`，调用方只传 stage |
| postcondition 折叠了缺席与内容 mismatch | 先保留 typed cause，只有 missing/stale/no-layout 类原因可复核 |
| “所有页面动作”范围过宽 | 收紧为第 4.1 节的 GPT DOM 失败裁决，显式排除导航/激活/授权/WAL/Provider 等待 |
| “任何物理动作最多一次”忽略 rename | 修正为普通 mutation `0|1`；rename `0|4`、部分 `1..3`诚实返回且不重放 |

## 十三、候选绑定与最终裁决

- 仓库：`/Users/nexgen/Documents/AGENT`
- 分支：`main`
- 设计基线：`17247858c9e2519a0c960eaacefb8a56120e5df5`
- tracking：`origin/main`
- 本方案文件是 untracked overlay；同一工作树已出现与本方案无关的 `固定文案五语会话压缩任务-完整实现方案.md` 并行修改，本轮不触碰、不吸收、不回复它；施工前必须重新校验 HEAD、tracking 与全部施工片区 dirty state
- Website：不在本方案施工范围内

最终裁决：**只把“准备仅凭一次可由重绘解释的 DOM 样本就终局失败”收敛到 Browser 唯一 stage 1/2 协议；不把业务等待、冻结时限、授权、身份、内容或现实副作用错误伪装成页面闪烁。**

这是对“统一模式”的生产级实现：同类失败只有一个 Owner、一组阶段、一个终局规则；异类现役协议互不叠加，不因“看起来统一”而引入无意义延时。

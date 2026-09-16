# GPT 等待原因可观测性－完整实现方案

> 状态：已施工；`quality:check CHANGE` 通过；待用户重启后的真实日志核对  
> 方案日期：2026-09-17（Asia/Dubai）  
> 唯一 Owner：GPT（等待语义与日志）／Local Browser Session（DOM 机械事实）  
> 适用仓库：`/Users/nexgen/Documents/AGENT`  
> 方案边界：只消除 `GPT_PROVIDER_WAIT_ACTIVE` 无法说明“为什么继续等待”的观测缺口；不改变任何回答裁决。

## 1. 目标与完成边界

当前文本回答轮询只记录统一事件 `GPT_PROVIDER_WAIT_ACTIVE`。它能证明调用仍在等待，却不能区分：

1. 尚未做第一次页面观察；
2. exact user turn 当前不可取得；
3. exact user turn 的真实紧邻 assistant turn 当前不存在；
4. assistant 已定位，但停止按钮仍存在；
5. 停止按钮已消失、正文仍为空，正在执行现役 20 分钟确认窗口。

本方案的唯一目标，是让每次文本回答继续等待时留下一个固定、可统计、不可携带页面内容的原因码，使事故分析能直接回答“本轮为什么 pending”。

完成标准只有三个：

- 文本 checkpoint 的每次等待日志恰有一个封闭原因；
- 原因只解释现役两门禁已经作出的 pending，不参与 DONE、failure、20 分钟窗口、deadline 或 Browser 调度；
- 正反测试和治理检查能证明删除任一原因映射、恢复统一模糊事件、或让原因参与裁决都会失败。

本方案不宣称修复任何尚未证实的 Provider、标签页、工单、入库或 Website 故障。它只补足定位这些故障所需的证据。

## 2. 明确不做

以下对象全部排除：

- 不解冻、不修改 `.github/instructions/agent-rules/功能法案.md`；
- 不增加第三门禁，不改变 `FROZEN-GPT-TEXT-RESPONSE-TWO-GATES-001`；
- 不改变 stop 按钮、正文非空、20 分钟 stopped-empty、`probeBudgetMs` 或 deadline 的现役语义；
- 不改变 70—90 秒全局 Provider observation 节拍、FIFO、lane、park/reacquire、Target 激活或导航；
- 不改变 Browser 成功回复 `BrowserExactAssistantTurnReplyV3`，不新增协议字段、数据库列、表、WAL、台账或持久状态；
- 不修改 Runtime 全局日志 schema，不向 `RuntimeGptCallIdentity` 塞入诊断字段；
- 不记录 URL、标题、Prompt、回答正文、DOM、hash、候选数量、等待时长或其它业务内容；
- 不修改图片 checkpoint 的现役日志行为；
- 不修改 Website、数据库、Forensics、Product Plugin、任务领取或结果入库链；
- 不顺手修复 exact user turn 多候选等相邻议题，不改旧事故方案和旧历史记录；
- 不建立兼容桥、双写事件、旧新原因并存、第二日志链或通用诊断框架。

## 3. 现役候选绑定

施工前重绑基线如下；任何一项漂移都必须停工并重新审计，不得把本方案直接套到新候选：

| 项目 | 当前候选 |
|---|---|
| 仓库 | `/Users/nexgen/Documents/AGENT` |
| 分支 | `main` |
| HEAD | `b011eeb3461760d7e76874cec892422ee1d23d02` |
| 跟踪分支 | `origin/main`，与 HEAD 对齐 |
| 工作树 | clean |
| 当前提交主题 | `Freeze GPT text response two-gate contract` |

关键候选文件及 SHA-256：

| 文件 | SHA-256 |
|---|---|
| `.github/instructions/agent-rules/功能法案.md` | `e0e35032bcd3a1bde98c95fcdafecb1c5db8ca44663f518a154e49c99f08c809` |
| `docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md` | `d3903bfd8a20b3bc11507d1512767c2ef57bd6462ffc3d60f4b06c0cc83a4b19` |
| `docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md` | `c0f1a87c9952aca629b1712a5cecfaba82861d47978d0ba229a0ad177ba243e1` |
| `src/capabilities/gpt/children/checkpoint_gpt_text_response/handler.ts` | `958e174ddcb0438cfea008db52e4e7872aa8c54403609c10c22ed3ec3fd2fe18` |
| `src/capabilities/gpt/production-browser-lifecycle.ts` | `e0f3f0cad82385d1576a5f52b95ce4d20771a4490d721a7f8c2efc3f185a9180` |
| `src/capabilities/gpt/contract.ts` | `bdfef1f6810e4cd812a5b52b3dbba3546bb289fbcd7c7ab2d4e0a3ab2bf22871` |
| `src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts` | `390f892463f8830905c2d5b1c00bd289bdeab69613a77b19268ed28a7557d70e` |
| `src/lib/browser/exact-target/browser-command-failure.ts` | `856459031587c9a45a335d7702c1c52b14f247e55ca79eaf685b7f510493f811` |
| `src/lib/browser/protocol/browser-errors.json` | `eaa82f5ddef3b208e2c74199be18a6b1084591867f9ebe623000639333ad03db` |
| `tests/governance/quality-contract.test.ts` | `c93633b24e69099d5c59f1c486d491750c820cb6e6be0c5e4d44856a45e3786a` |

本方案与 `docs/项目方案/GPT文本回答两门禁冻结-完整实现方案.md` 相邻但不覆盖它。后者继续冻结裁决，本方案只冻结诊断表达。

## 4. 事故证据与直接断点

本次证据输入：

| 证据 | SHA-256 | 与本方案有关的事实 |
|---|---|---|
| AGENT 修复后日志 `a037bff5-15a1-4e32-8d95-99aa9d2e621c/pasted-text.txt` | `c713985880007b2f8b2180a5fc6e4101c2b8a28b1d42b9bc0f4255881047093e` | 多个 job 只有 `GPT_PROVIDER_WAIT_ACTIVE`，无法恢复具体 pending 原因 |
| Website 修复后日志 `76aee36f-b07a-4926-b96f-47e2b0294265/pasted-text.txt` | `8794f5c2502139fc7656663cccead1aa563d418519fcf23bd82c0e1d1907698c` | 可证明部分 job 后续完成并被 Website 接纳，但不能解释先前每轮等待原因 |

现役调用链：

```text
checkpoint_gpt_text_response
  -> waitForProviderObservation(deadline)
     -> GPT_PROVIDER_WAIT_ACTIVE
     -> Browser lane park / reacquire
  -> readExactAssistantTurn(...)
     -> exact DOM observation 或 BROWSER_DOM_CANDIDATE_MISSING
  -> 两门禁裁决 DONE / pending / failure
```

直接断点有两个：

1. `waitForProviderObservation` 在 Browser observation 之前统一发出 `GPT_PROVIDER_WAIT_ACTIVE`，没有携带上一次裁决所产生的下一轮等待原因；
2. `dom-exact-assistant-turn.ts` 把 exact user turn 不可取得和紧邻 assistant 不存在都压缩成同一个 `BROWSER_DOM_CANDIDATE_MISSING`，GPT 无法在不猜测 DOM 的前提下区分两者。

因此，不能仅修改日志文案；必须沿现役 Browser 机械事实到 GPT pending 原因的单链做最小贯通。

## 5. 唯一诊断合同

### 5.1 封闭原因集

文本 checkpoint 只允许以下五个原因：

| 原因 | Runtime 事件码 | 事实来源 | 对裁决的影响 |
|---|---|---|---|
| 第一次观察尚未发生 | `GPT_PROVIDER_WAIT_INITIAL_OBSERVATION` | handler 初始固定状态 | 无 |
| exact user turn 当前不可取得 | `GPT_PROVIDER_WAIT_EXACT_USER_TURN_UNAVAILABLE` | Browser typed observation | 与现役 missing 相同，继续 pending |
| 紧邻 assistant turn 当前不存在 | `GPT_PROVIDER_WAIT_ADJACENT_ASSISTANT_MISSING` | Browser typed observation | 与现役 missing 相同，继续 pending |
| 停止按钮仍存在 | `GPT_PROVIDER_WAIT_STOP_PRESENT` | 同包 exact assistant observation | 继续 pending，20 分钟窗口归零 |
| stop 消失且正文为空，确认中 | `GPT_PROVIDER_WAIT_STOPPED_EMPTY_CONFIRMING` | 同包 exact assistant observation | 继续现役 20 分钟窗口 |

“第一次观察尚未发生”必须保留，因为现役顺序是在第一次 Browser observation 之前先进入全局节拍。此时若写成 stop、user turn 或 assistant 原因，就是伪造页面事实。

### 5.2 单事件规则

- 每次真正进入文本 Provider observation 等待，只发一个上述事件；
- 不再为同一次等待同时发 `GPT_PROVIDER_WAIT_ACTIVE`；
- 完成、20 分钟失败、deadline、Browser hard failure 不补发等待事件；
- 事件继续只绑定现役 `gpt-call` typed identity；原因由固定 event code 表达，不新增自由文本或可扩张字段；
- 图片 checkpoint 显式保持现役 `GPT_PROVIDER_WAIT_ACTIVE`，不得被本方案顺手改造。

### 5.3 两门禁不变式

原因码是已经发生的 pending 裁决的只读投影，禁止反向参与：

```text
Browser/handler 现役事实
  -> 现役两门禁决定 DONE / pending / failure
  -> 仅当结果为 pending 时，选择下一次等待日志原因
```

不得出现：

```text
等待原因 -> 是否允许返回正文
等待原因 -> 是否 DONE
等待原因 -> 是否重置/推进 20 分钟窗口
等待原因 -> 是否取得 lane、换 Tab、导航或重试
```

## 6. 最小实现设计

### 6.1 Browser：只拆分两个被压扁的机械事实

在 `dom-exact-assistant-turn.ts` 的 extension-local observation 中增加一个封闭、非持久的 pending discriminator，仅允许：

- `exact-user-turn-unavailable`；
- `adjacent-assistant-missing`；
- `null`。

它只用于 decoder 选择 typed error，不进入 `BrowserExactAssistantTurnReplyV3` 成功 shape，不进入 WAL、receipt、数据库或 Runtime 日志。

在 `browser-errors.json` 增加并生成两个精确错误码：

- `BROWSER_EXACT_USER_TURN_UNAVAILABLE`；
- `BROWSER_ADJACENT_ASSISTANT_TURN_MISSING`。

`browser-command-failure.ts` 中，文本 checkpoint 的非 mutation observation 例外必须从通用 `BROWSER_DOM_CANDIDATE_MISSING` 精确替换为以上两个新码。通用码继续服务其它路径，但不得作为文本 exact response 的兼容 fallback。协议生成必须使用现役 `browser:protocol:generate`，禁止手改 generated 文件。

本工单保持现役行为：exact user turn 为零或非唯一时仍归入 `unavailable` pending；不得借机改变为新的 ambiguity failure。assistant roots 多义、Document/URL/revision/authority 错误继续按现役 hard failure。

### 6.2 GPT handler：保存“下一次等待原因”

`checkpoint_gpt_text_response/handler.ts` 只增加一个调用期内、非持久、封闭 union 的 `nextWaitReason`：

- 初值为 `initial-observation`；
- 捕获 `BROWSER_EXACT_USER_TURN_UNAVAILABLE` 后更新为 `exact-user-turn-unavailable`；
- 捕获 `BROWSER_ADJACENT_ASSISTANT_TURN_MISSING` 后更新为 `adjacent-assistant-missing`；
- exact assistant observation 为 stop 存在时更新为 `stop-present`；
- stop 消失且正文为空、20 分钟尚未到期时更新为 `stopped-empty-confirming`；
- stop 消失且正文非空立即返回，不再产生下一次等待。

该变量不得写入 artifact、result、checkpoint、WAL 或数据库。它不得被任何 if/switch 用于回答裁决；唯一消费者是下一次 `waitForProviderObservation` 日志映射。

### 6.3 共享 wait 入口：必填但不改图片行为

把 `GptExecutionContext.waitForProviderObservation` 的第二参数改为必填封闭 union。union 包含上述五个文本原因和一个现役图片调用标识 `generated-image-source-pending`。

- 五个文本原因映射到五个新事件码；
- 图片标识仍映射到原事件 `GPT_PROVIDER_WAIT_ACTIVE`；
- 禁止 optional、默认值、任意 string 或 unknown fallback；
- `production-atomic-call.ts` 只透传；
- `production-browser-lifecycle.ts` 只做封闭映射并保留原有节拍、park、deadline 和 typed identity。

这样只修改现有单入口，不新建第二 wait API、第二 lifecycle 或兼容 wrapper，也不扩大图片诊断范围。

### 6.4 施工图

法案已经允许非阻断诊断事实，且两门禁冻结明确禁止诊断变成隐藏 gate，因此法案不改。

施工时只做两份必要的现役施工图版本迭代：

1. GPT 施工图：冻结五原因、单事件、只读投影、图片行为不变；
2. Local Browser Session 施工图：冻结两个 exact text pending 机械事实、成功 reply shape 不变、不得把诊断升级为门禁。

不得修改 Runtime Log Spine 施工图，因为事件 envelope 和 typed identity 均不变。

## 7. 四维闭环

| 维度 | 本方案闭环 |
|---|---|
| 需求维 | 日志直接回答每次文本 checkpoint 为什么继续等待 |
| 功能维 | Browser 两类机械 pending 事实单链传到 GPT；stop/empty 原因由现役同包 observation 产生 |
| 业务维 | 运维可区分页面仍生成、回答邻接尚未出现、目标 user turn 不可取得、停止后空正文确认中；不据此自动重发或改任务 |
| 质量维 | 封闭枚举、单事件、无 schema/存储扩张、决策等价、正反测试与变异测试共同失败关闭 |

## 8. 有限分母与终态矩阵

| 输入事实 | 现役裁决 | 等待事件 | 是否改变现役行为 |
|---|---|---|---|
| 尚未完成第一次 observation 的节拍等待 | pending | `...INITIAL_OBSERVATION` | 否 |
| exact user turn 零个或现役不可唯一取得 | pending | `...EXACT_USER_TURN_UNAVAILABLE` | 否 |
| exact user turn 已有、紧邻 assistant 尚无 | pending | `...ADJACENT_ASSISTANT_MISSING` | 否 |
| exact assistant 唯一，stop > 0 | pending，空窗口归零 | `...STOP_PRESENT` | 否 |
| exact assistant 唯一，stop = 0、正文空、未满 20 分钟 | pending，窗口推进 | `...STOPPED_EMPTY_CONFIRMING` | 否 |
| stop = 0、正文非空 | DONE | 无 | 否 |
| stop = 0、正文连续空满 20 分钟 | `GPT_RESPONSE_STOPPED_EMPTY` | 无 | 否 |
| deadline 到达 | 原 timeout | 无新增 | 否 |
| assistant 多义、URL/Document/revision/authority 失真 | 原 typed failure | 无新增 | 否 |
| 图片 source 尚未出现 | pending | 仍为 `GPT_PROVIDER_WAIT_ACTIVE` | 否 |

## 9. 原子施工工单

### IR-01：候选重绑与污染检查

- 重验 branch、HEAD、tracking、clean worktree；
- 重验现役法案、GPT/Browser 施工图、两门禁方案和本方案 hash；
- 若候选漂移或目标文件有用户改动，停止施工，不覆盖。

### IR-02：先对齐施工图

- 只迭代 GPT 与 Local Browser Session 两份施工图；
- 明写原因只读、单事件、无第三门禁、无 Runtime schema 与图片行为变化；
- 自检后才能进入代码。

### IR-03：Browser 精确事实拆分

- 修改 `dom-exact-assistant-turn.ts`；
- 修改 `browser-errors.json` 并运行唯一生成命令；
- 修改 `browser-command-failure.ts` 的精确 observation 例外；
- 删除文本路径对通用 missing 的依赖，不保留 fallback。

### IR-04：GPT 原因贯通

- 修改 `contract.ts`、`production-atomic-call.ts`、`production-browser-lifecycle.ts`；
- 修改文本 handler 的 `nextWaitReason`；
- 图片 handler 只显式传现役图片标识，输出事件仍不变；
- 不改任何计时数值、分支终态或 Browser 调度。

### IR-05：质检与变异防线

- GPT inspector 冻结五原因、必填封闭 union、原因不得参与裁决；
- Browser inspector 冻结两个 typed pending 事实、成功 reply V3 不变；
- governance test 增加源码正反样本；
- acceptance 增加五个文本原因与图片事件不变的测试；
- 变异至少覆盖：恢复统一文本事件、交换两个 Browser 原因、原因缺省、原因参与 DONE、文本继续接受通用 missing、同轮双事件；任一变异必须失败。

### IR-06：CHANGE 级验证

按仓库原生入口执行，不升级为 READY/RELEASE：

```bash
npm run typecheck
npm run acceptance:gpt
npm run acceptance:local-browser-terminal
npm run acceptance:runtime-log-spine
node --import tsx --test tests/governance/quality-contract.test.ts
npm run audit:projection:check
npm run quality:check CHANGE
```

真实重启日志属于后续生产观察，不得用静态 PASS 冒充。用户重启后，至少取得一条文本原因事件并与当轮页面事实核对，才能确认观测链真实生效。

## 10. 删除反事实与膨胀门禁

| 对象 | 删除后果 | 裁决 |
|---|---|---|
| 五个固定文本原因 | 重新退化为无法定位的统一等待 | 必须保留 |
| Browser 两个 typed pending 事实 | GPT 只能猜测 user/assistant 缺失 | 必须保留 |
| `nextWaitReason` 单一调用期变量 | 下一轮 wait 无法忠实表达上轮 observation | 必须保留 |
| 新 Runtime 字段或 identity 字段 | 固定事件码已经能表达，且会扩大全局合同 | 必须删除／禁止新增 |
| 新数据库/WAL/台账 | 无真实消费者，调用期诊断无需持久状态 | 必须删除／禁止新增 |
| generic + reason 双事件 | 重复计数并形成双权威 | 必须删除／禁止新增 |
| 文本 generic fallback | 掩盖遗漏映射并形成兼容桥 | 必须删除／禁止新增 |
| 第二 wait API/lifecycle | 现役单入口足够 | 必须删除／禁止新增 |
| 对历史方案的追溯性改写 | 历史证据不是现役 Owner | 禁止 |

## 11. 验收标准

施工完成必须同时满足：

1. 当前 diff 只触及本方案、两份必要施工图、上述最小代码和直接对应质检；
2. Active law、Runtime log schema、数据库、Website 均零差异；
3. 文本等待不再产生 `GPT_PROVIDER_WAIT_ACTIVE`，每次只产生五原因之一；
4. 图片等待继续产生 `GPT_PROVIDER_WAIT_ACTIVE`；
5. 五种原因均有正向 acceptance；DONE、20 分钟失败、timeout、hard failure 均证明不多发等待事件；
6. 相同输入下，施工前后文本 checkpoint 的 DONE/pending/failure、计时窗口与 Browser 操作计数完全一致；
7. `BrowserExactAssistantTurnReplyV3`、Runtime event envelope 和 `RuntimeGptCallIdentity` shape 完全不变；
8. 无 optional/default/fallback、无双写、无第二链路、无新增持久化；
9. 变异测试全部能抓住违规；
10. `quality:check CHANGE` 原生通过；不得据此宣称 READY、RELEASE 或生产故障已修复。

## 12. 停工与回退

出现以下任一条件立即停工：

- 需要解冻两门禁才能实现；
- 必须修改 Runtime 全局 schema、数据库或 Website；
- 发现原因会改变回答裁决、计时或 Browser 调度；
- 当前候选漂移、工作树出现不明改动或生成投影不一致；
- 无法在不保留 generic fallback 的情况下区分两个 Browser pending 事实；
- 原生质检要求扩大到相邻故障才能通过。

回退单位是本工单的完整变更片区：两份施工图、Browser 原因拆分、GPT 原因贯通和对应质检必须共同回退，不允许只回退测试、只保留事件码或留下半条兼容链。

## 13. 施工交付物

后续获得施工授权后，只允许交付：

- 两份最小版本迭代的现役施工图；
- 两个 Browser typed pending 原因；
- 一个现役 wait 入口上的封闭原因参数；
- 五个文本固定事件码，图片原事件不变；
- 对应 inspectors、governance tests、acceptance 与变异测试；
- CHANGE 级原生质检报告和真实重启后的日志核对结论。

除此之外的功能、修复、重构、抽象、持久化和治理改造均不属于本方案。

## 14. 施工结果

2026-09-17 已按本方案完成精确迭代：法案零修改，GPT 施工图升至 V58，Local Browser Authority 施工图升至 V49；Browser 已分别报告 exact user turn 不可取得与紧邻 assistant turn 缺失，GPT 已将两者和首次观察、stop 存在、stopped-empty 确认投影为五个固定文本等待事件。图片等待继续使用原事件，Runtime 日志结构、两门裁决、20分钟窗口、Browser节拍、数据库和 Website 均未改变。

已通过：TypeScript、GPT acceptance、Local Browser terminal acceptance、Runtime Log Spine acceptance、治理正反与变异测试、projection check，以及仓库唯一 `npm run quality:check CHANGE`，最终 verdict 为 `CHANGE_PASS`。这只证明当前代码候选达到 CHANGE，不代表 READY、RELEASE 或真实生产问题已经闭环；生产结论必须等待用户重启后的新日志。

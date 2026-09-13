# Codex + Chrome 产品采集协议

## 1. 采集不是自动化任务

采集的操作者是当前 Codex，浏览器通道只能是 `chrome:control-chrome`。本 Skill 不安装 Worker、不监听 Runtime、不注入 Product、不创建定时任务，也不在终端启动 Playwright/CDP。

终端运行的离线脚本只允许做：读取生产 task、核对材料 bytes/sha256、读取 Product 合同/源码/forensics trace、装配 Codex 已采回的 scene、更新唯一报告。任何离线 CLI 出现浏览器导航、点击、填入、上传或提交能力都必须拒绝。

`chrome-scene-collector.mjs` 是唯一例外，但它不是 CLI 或自动任务：只能由当前 Codex 在 `chrome:control-chrome` 已建立的交互会话中导入；Codex 每明确执行一个 Child 调用，才让它记录该次 pre/command/post。它不得读取 `process.argv`，不得拥有 `main`、产品循环、任务选择、调度或后台入口。

## 2. 产品范围绑定

每轮必须明确：`productId`、`actionId`、生产 `jobId`、实际 `attemptId`。静态本地化还必须明确 `target_locale`，其最小范围是该 locale 的全部 cohort。

本 Skill 在 `references/product-flow-projections/<plugin>.json` 保存自己的可删除流程投影。投影由本 Skill 维护，只声明资料规则、阶段拓扑和要读取的现役 flow source；Product 生产目录不拥有、不读取也不为它适配。已接受生产 attempt 的真实调用顺序只由现有 durable forensics trace 证明。`exactCallIdentityHash` 绑定调用身份，但不能单独冒充页面输入证明；现有 forensics 若有 `input_hash` 和安全 `page_input_role_hashes`，工具可用它们与 Chrome DOM 做逐角色相等校验，缺失则报告工具缺口。当前投影与历史 trace 不同，只能标成投影漂移，不能宣布历史事实无效。

仓库内不允许出现第二份 Product 路由注册表。报告的全部产品分母来自现役 `productPluginCatalogSnapshot`；缺合同的路由只能显示 `PRODUCT_EVIDENCE_CONTRACT_NOT_IMPLEMENTED`。

## 3. 生产资料核对

`production-source.mjs` 必须只读打开 production runtime DB、材料目录、forensics records 和 Browser mutation DB。它要求：

1. task 行与 task JSON 的 job/request hash 一致；
2. accepted Product/Action identity 与 task request hash 一致；
3. `material_refs` ordinal 从 0 连续且不重复；
4. 材料目录没有缺文件、多文件或子目录；
5. display name、role、bytes、sha256 与磁盘字节一致；
6. 本 Skill 的产品流程投影与当前 Catalog 一致；
7. trace 每行属于同一 job/attempt/plugin，Child 与 payload 身份一致；
8. trace 每一步的 step/Child/ordinal/exact call identity 与 forensics 完整性成立，且每条实际记录有唯一 `traceEntryId`；
9. Browser receipt 若存在，必须与同一 exact call 的 step/Child/ordinal 一致；语义 `callId` 只取自回执，无回执时为 `null`；
10. Browser receipt 的 `request_hash` 与 forensics `input_hash` 必须一致；旧记录缺 `page_input_role_hashes` 时只能保留历史事实并报告输入绑定 GAP，禁止从源码、通用 profile 变体或相似任务反推；
11. 当前 Product 阶段拓扑只输出 `flowProjectionStatus/flowProjectionGaps`，不得反向否决历史 trace；
12. 当前 attempt 的完成分支必须把 task 行的 result receipt 与 production outbox 中对应 `result_payload` 的 object ref、body bytes、sha256、response hash 和 receipt hash 全部对齐；分支值从校验后的 payload 读取；指定历史 attempt 时禁止借用当前 task 行的状态或结果；
13. 历史失败分支必须精确命中 `production_attempt_failures(job_id, attempt_id)`，并将该行的哈希回执与同 attempt 最后一条 failed trace 关联；记录声明 Child/evidence hash 时必须相等；
14. 历史 attempt 没有自己的 durable terminal 时只能输出 `PARTIAL/DURABLE_ATTEMPT_TERMINAL_UNAVAILABLE`。

校验器生成的仓库外 source manifest 可含执行所需的本地生产标识；合并进公共报告时必须投影为 hash-only 身份。公共报告不得保留原始 job/attempt、材料文件名、task reason、forensics record ref 或 Browser command id，也不复制 prompt、材料正文、结果正文或原始会话 ID。

## 4. Codex 复刻流程

Codex 读取 Product `SKILL.md`、合同列出的 flow sources 和 source manifest 后，按 `actualTrace` 这份实际采购清单使用 Chrome 插件逐调用采集。不得根据本协议发明步骤；当前源码与历史 trace 的差别要单独报告，不能改写历史调用。

逐调用页面分母由 trace 的 `resultStatus/mutationOutcome` 决定：真实 mutation 要 pre/post，成功零动作要 already/steady；失败零动作且没有任何 Browser 观察时分母为零，用空 specimen + durable failure 表达“无 DOM 可采”，不要求 input↔DOM 匹配。mapping 只能把 scene 对齐到派生状态，不能挑选或删减状态；其它未映射调用仍须在报告保存派生状态清单。

每条实际 forensics 调用记录以唯一 `traceEntryId` 为采购单主键，同时保留其 `exactCallIdentityHash`。同一逻辑调用失败后重试时 exact call hash 可以相同，但 `traceEntryId` 不同，必须各有独立 mapping 和 DOM；以下行为禁止：

- 一个通用 profile scene 冒充所有产品调用；
- 一个 Child scene 同时冒充不同 cohort/pass；
- 用另一个产品的相似页面替代；
- 跳过失败步骤后继续伪造后续成功；
- 用派生负例、单元测试 DOM 或旧 v5 synthetic scene 声称 `LIVE_PAGE`。

## 5. 每调用的三段证据

### pre observation

- 当前 Target/Document/revision 的 hash 身份；
- 产品步骤、调用序号、Child 和 exact call hash；
- scope 内 raw/eligible 候选数；
- 每个候选的机械拒绝原因；
- 目标节点的清洗属性、布局、可见性和 hash-only 文本；
- 必需父节点、兄弟节点、owner/label/menu/dialog 关系；
- 当前上传、生成、错误、overlay 等页面状态。

### command receipt

- typed command、目标身份、effect scope；
- dispatched/confirmed/rejected/no 的准确 outcome；
- terminal receipt、native cause 和完成时间；
- 纯观察调用必须写 `NOT_APPLICABLE`，不能伪造 command。

### post observation

- 动作后重新获取的 Document/revision；
- 直接后置条件和必须不存在的失败条件；
- DOM 差异；
- 上传集合、提交 user turn、稳定文本/图片、错误终态或 checkpoint 的安全引用。

pre/post 不能跨 Document 组成成功证据；如果动作后出现禁止的 Document 变化，post scene 只作为失败现场保留并固定冲突，不得 PASS。动作 outcome unknown 时必须先 readback，禁止重放。

目标资格失败不等于 DOM 不存在。只要 scene 中有真实候选，装配器必须在同一 product call 的 specimen 中保存清洗后的 `diagnosticDom`、`observed:false`、候选基数与拒绝原因；该 specimen 永远不能令 call complete，但必须可供故障回看。只有原 scene 确实没有任何候选节点时，才允许没有 diagnostic DOM。

### production input ↔ Chrome DOM

每个 `traceEntryId` 单独核对，不允许按 Child 或 Product 共用结论：

- prompt：生产 `promptHash/expectedPromptHash` 必须按 Child/状态对位；write/draft reconcile 只对指定 composer 状态，submit/submission reconcile 只对带准确 owner turn identity 的目标 post-submit user turn，continuation 只对同一 prompt/response/marker/assistant tuple；其它旧 turn 或错误状态即使同 hash 也不算；
- attachments：生产批准文件的 provider display name 哈希集合，对 composer scope 内 `[role='group'][aria-label]` 的完整哈希集合；空集合也必须精确相等；
- model：本次调用 profile 的 `modelDisplayName` 哈希，对高级模型面板的实际选项文字哈希；
- reasoning：本次调用的 selection policy/requested tier，对页面实际 `aria-valuemin/max/now` 做同一套解析；`pro_standard` 在 0..2 页面允许按生产规则降级到 observed maximum，但不能拿 A 的要求替 B/selector；
- continuation：生产 canonical URL、prompt/response、assistant turn/marker 哈希，对当前 URL 和准确前序 user/assistant turn；
- response/checkpoint：生产 expected response hash 对实际 assistant semantic text hash。

短 user prompt 的唯一合法补充定位是：同一个唯一 user turn 下没有 collapsible 节点时，命中唯一 `.whitespace-pre-wrap` 叶节点。禁止扫描全页正文或借用其它 turn。历史证据缺角色哈希时，重建出相同 prompt/调用身份也不能补写 `MATCHED`。

公共 scene 只保存这些实际值的哈希、计数和非敏感 scale 枚举，不保存正文。UI 文本只有“白名单值 + 明确 button/menuitem/slider 等 UI 语义”同时成立才可明文；业务 turn/composer/普通容器碰巧等于白名单词仍必须 hash-only。装配器生成 `gpt-page-input-binding-proof.v1`；`inputHashBound=false`、期望缺失、实际缺失或不相等时都产生 `PAGE_INPUT_BINDING_GAP`，不得完成。

scene metadata、decision/transition receipt 与公共 production source 只接受 Schema 明列字段，多出的 note、debug、原始 payload、明文 prompt/body/content 或 Provider 返回对象一律拒绝。合并报告时再次重算完整 specimen/call envelope，并按 `sourceSceneId → traceEntryId` 检查唯一归属，阻断绕过装配器的跨调用 DOM 复用。

## 6. 隐私

- UI 白名单文本可保留；Product prompt、用户/assistant 正文、文件正文只留 sha256 和长度。
- attachment 名称只在 Website task 已明确声明且不含私密信息时进入 source manifest；DOM 内 aria-label 仍默认 hash-only。
- URL 只保留根页面或 `/c/sha256:<digest>`。
- Cookie、storage、password、authorization、token、邮箱和其它标签页内容禁止进入 scene/capture/report。

## 7. 完成与缺口

完整产品资料要求：真实资料核对通过；durable task 已到真实完成或失败终点；trace 中每个实际页面 Child 调用都有独立且完整的 pre/command/post 证据；本地化静态目录按材料声明的全部 cohort 留有 A/B/selector 实际 trace。

真实生产失败是一个合法终点，固定记录 `terminalBranch=production-failure`，不能伪装成成功。如果失败前实际发生的每个页面调用都有完整 DOM，该失败 run 可以是 `CAPTURE_COMPLETE`；这只表示“故障现场采全”，不表示产品成功。只有实际调用缺 DOM 或 trace 尚未到合法终点时才是 `CAPTURE_PARTIAL`。缺口使用准确坐标：

动作 receipt 结构和 pre/action/时间链有效，但 `postconditionPassed=false`、页面发生合同禁止的 document transition、或当前状态断言失败时，必须保留失败后的 DOM，标记 `PAGE_EVIDENCE_CONFLICT:*` 并保持 `CAPTURE_PARTIAL`。这些是需要回看的故障现场，不得因失败而从报告丢弃。输入/附件/profile 任一步当前核验失败时在 submit 前停止，后续步骤只能报缺口。

```text
PAGE_EVIDENCE_GAP:<product>/<action>/<step>/<ordinal>/<child>:<missing-field>
```

不允许为了追求 100% 而补造未走到的分支。

## 8. 定向更新

用户可只要求一个 Product/Action。Codex仍从该 Action 的合法入口开始，完整走到真实合法终点或真实失败点。合并时只替换同一产品切片；其它产品整个 slice 原样保留，包括已从当前 Catalog 删除的历史产品切片；当前 Catalog 新增路由才追加 `NOT_CAPTURED`。普通 `validate` 校验报告自身结构并返回 `projectionCurrent/staleProducts`，全局或其它 Product 漂移不阻止目标 slice 落盘；`candidate/admit` 只对所选 Product 严格核对当前来源。只有 `validate --require-complete` 才要求全局投影也为当前。页面需求变化但旧 DOM 足够时只离线 refresh，不开 Chrome。

产品级 candidate/admit 只做工具内部的同次查询防串包，校验目标 Product 的当前投影、实际 source binding、run 推导和 DOM。全局投影或其它 Product 漂移不得改变该 candidate；共享 Child 只保留派生反向索引，不拥有独立查询通道。它不产生生产准入、质量或发布结论。

无论产品是否 stale，`validate` 都按每个 call 落盘的 capture-time states/targets/assertions/required input roles/Child transition contract 重算该历史 slice，并继续校验 production source/trace/input binding、capture context 精确白名单、scene/specimen/call envelope、scene 跨调用唯一性和 `captureComplete`。Product 或矩阵变化只暂停“与当前投影一致”的检查，不能用今天的规则改判历史，也不能放过落盘后的篡改。

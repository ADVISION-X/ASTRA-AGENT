# 双仓 AI 生产现场八项问题闭环修复：完整实现方案

更新日期：2026-10-07。状态：**前一候选建设审查放行后，原生CHANGE检出B-Q关联缺口；修复中，CI-FULL及真实工单终点未闭合**。授权范围含法案、施工图、代码、质检及数据库。重绑定两仓现有 main；先对齐源头并由主 Codex 两遍审计，两遍源头审计已核销设计 finding，可进入已授权代码片区；动态激活仍按§10。本轮新增的 Browser 设计只保全原命令的诊断，不宣称已追回历史物理原因，也不为旧工单授予重发资格。

本文重新绑定当前两仓与本次两张工单，取代本文件此前的施工指令。2026-10-03 的施工授权、69 文件清场记录及历史质量结论不延续为本轮授权或当前质量结论；历史正文保留在 AGENT `ea38ce6076dc095010e51b10ea56b304d04be5a5` 的同路径。前轮更新前本文 SHA256 为 `958cfddcc001ab4a4c6e7751c8c05c4388f634b537e9319c3c2d1892d7657c2d`；本轮更新前为 `8b413e3d8cd7c06e8a61bdd81a32976acb182eae3668ab7be1dc1de6dab437e1`。本轮方案本身也执行了整文件删除、读回 ABSENT、原位重新建立。

## 1. 需求、范围和红线

需求是按工单重建本批生产链，区分已证实的第一直接断裂与已经无法追回的历史物理现场，再形成按片区删除后重构的唯一迭代方案。需求入口属于 AGENT `agent-production-runtime`；付款观察由原 Product 决定执行，Website `commercial-payment-evidence` 决定付款业务，静态文案由 Website `localization` 决定接纳；恢复授权只属于 Website `ai-acceptance`。Manifest 的文件 primary Owner 不等于 Product 运行决策权。

当前已获 CHANGE 施工及 CI-FULL 连续执行授权，继承本轮明确列出的法案、施工图、代码、质检及数据库范围；母说明书、冻结 ci-full-governance Skill 与具名 FROZEN 条款的特定解冻要求保持原文。授权不解除事实和设计阻断。先由主 Codex 完成源头对齐及至少两遍审计，本阶段禁止子智能体；条件闭合后才进入整文件删除重构。重要代码步骤及最终建设由只读子智能体审查，禁止子智能体写代码，未放行不宣布建设完成。主 AI 最终至少两遍自检；98%及95%的要求必须落在有限实际要求与证据上，不能凭感受填数。不得创建分支、worktree、stash、reset，或覆盖用户改动；用户已另行授权两仓并行改动合并提交和一起READY，代码重构仍只处理本轮精确片区。

强制施工顺序是：**对一个已获准片区的完整文件先物理删除 → 逐文件证明不存在 → 从现役权威重新构造 → 验证旧符号、生产调用及旧断言零残留 → 原链 consumer readback**。不允许补丁、覆盖写、先建替代文件再删、复制旧文件恢复、改名转发、兼容桥或第二真相。数据记录、WAL、原始回答、Outbox、既有 receipt 不是源码清场对象，必须保留。

本轮不扩大为全站改造，不改 N、失败计数、退避、当前 policy 或领域接纳安全门；不把 timeout、空 WAL、空 registry、旧 Target 消失或默认 `mutation_outcome=no` 解释为原 writer 已终止或 Provider 输入为零。

## 2. 双遍源头理解与候选绑定

已按 `frozen-spec-index` 回读两仓母说明书 §0/§4/§35，并以 §47 的 CHANGE 有关法条规则沿本次调用图做两遍深度遍历：第一遍从授权、producer 追到领域接纳；第二遍从业务终点反查 Owner、首事实、恢复与删除门。两仓基础法案及本次 Runtime、Architecture、Capability、Forensics、GPT、Browser、Log、AI Acceptance、付款和固定文案适用条款均回读核对。这里的“两遍”指本次受影响源头图，不声明已将 Website 两万余行全部无关功能法案全文阅读两遍。

`closed-loop-implementation-design/SKILL.md` 全文实际读完两遍，输出截断处补齐；上下文压缩后又恢复全文双遍核对。另读现役 `agent-flow-boundary-gatekeeper/SKILL.md`，核对职责与非 Skill 基础设施边界。采用深度设计，因为同片区反复迭代、跨 Owner handoff、共享生产干线和相关前轮方案均命中回归信号。没有派生 Agent 或第二审计产物。

| 仓库 | 当前原生身份及 overlay |
| --- | --- |
| AGENT | realpath `/Users/nexgen/Documents/AGENT`；main；HEAD `ea38ce6076dc095010e51b10ea56b304d04be5a5`；tracking origin/main `148426e49ed1b5c14aabb163baa6eb2af834c4ec`，ahead 1。前轮方案写前该文档 clean；本轮是本会话前轮方案的未提交差异。用户已有 Skill、code-purity Manifest、generated registry 改动及对应未跟踪方案/BP；全部保留 |
| Website | realpath `/Users/nexgen/Documents/xuanxue-web`；main；HEAD `c5249da868012153c1e1c5fb38d3f181515b034c`；tracking origin/main。2026-10-07 重绑定时 clean；源头、AI/付款代码相对 73b0 未变。hash-core 的 NFC/排序缓存只在一次 canonical 调用内复用，值/getter/循环/碰撞仍逐项校验；旧 task envelope 不包含 descriptor/result_contract，原任务身份不变。不得改写已提交的其它片区 |

本轮完整解析并遍历两仓549条现役 law-record 的 Owner、适用路径、证据模式、依赖引用及十份施工图记录的拓扑，逐段回读本次调用图适用原文。机器遍历只证明结构及关系已遍历，不冒充 Website 两万余行功能法案全文语义阅读；未完成阅读及未核销 finding不能计作代码启动条件已满足。Website六个付款/结果合同与 Consumer文件相对旧HEAD差异为空；共享 hash-core在审查期间发生overlay，旧身份结论须重新核对，不能直接延用前轮B结论。

源头正文优先于 generated registry、历史方案和历史提交。以下只绑定设计输入，不是CI-FULL候选或质量回执；READY/RELEASE候选仅使用原生clean Git commit。2026-10-06 源头修订前输入 SHA256（仅作原始设计来源，2026-10-07新源头以当前文件及Git实际差异为准）：

| 对象 | SHA256 |
| --- | --- |
| 两仓母说明书，同字节 | `27a143ecd7016887d056255e106f49caa29d83d06245ff21ea5c0ffd62b98c3a` |
| AGENT 基础/功能法案 | `f1970c2416127f8bcdf560d0fd81105895924c4ed2cdd23f6a08ae910998d2f3` / `37fa293fc9fcee920c855936fe9c3887ac5885da09aa8dfb89977f2a37aad752` |
| Website 基础/功能法案 | `6ad826fb1980f78f1bfbffca3417fc4636332596b489d181c607e1032bfaa85f` / `dce08f8d650bc3193e829c21d53177ba6bc8180b5a12eb77dff651bbe92122fb` |
| AGENT GPT / Browser BP | `f53f9c81ede40aed61c1c5fb3edd7ac8540e5c4cd1ee27afe85bd8ddcbf914a6` / `09853eb36101eb7c68dcae4028c888cfe804cf73b4687f3ade97afc7bbc2b4b6` |
| AGENT 双仓 / Runtime Log BP | `8c2c5e67cae3283f6b94e17c3d38e92c95034e55be31e8fc3c1e3dcc40037e90` / `64f9d746d1bbd350837c09ec1f9c5dc4a3b00b76bbea542b447ae4cb0d9833b3` |
| Website AI Acceptance / SYSTEM BP | `e4a96987d7e457db09cd42bce996e597ab827008f03a9b545dc39e8d9e79e86d` / `7de7e5a138fab4d19501bb6feeb2c4b08d06c82caf3731765350dceb486d34bf` |
| Website task-result provider spec / canonical route artifact | `813cc50cae071de84ec0bd97e7a48cdb180b97b357d9f90eb30aaa5442635e91` / `dede74af7f97f6730612fa542de7487c74447a669f18edbfcab00ee97daf2cf3` |
| AGENT / Website generated registry overlay | `d08b33cff713144587014cc060ba769837d50e5c94f33b3b19d3cd0cea6eeb39` / `e20f6b008d05230a9084c551776e480b51375432064f53a6304330ead276606e` |

以下工单逐项列出的实现、直接 consumer、验收路径在上述 HEAD 写前均为 clean，内容绑定原生 HEAD；相关 dirty authority 则以本表 overlay 内容绑定。本文独立验证，不进入 source candidate。实施前重新核同一范围的 Git 状态、源头内容及 hash；相关漂移重开受影响设计，命中用户改动且无法区分时不得清场。

精确阅读入口均相对对应 repo：母本 `docs/governance/法案系统建设说明书-冻结定稿版.md`；法案 `.github/instructions/agent-rules/{基础法案,功能法案}.md`。AGENT 功能法案：Runtime 001–008（15–321）、Architecture 001/002（471/518）、Capability 001/002（547/592）、Forensics 001–003（636–695）、GPT 001/002（725/778）、Browser 001–006（934–1149）、Log 001–003（1183–1274）。Website：AI Acceptance 001–013（237–824）、Payment Evidence 001–007（13780–13990）、Localization 009/019/020（15839/16264/16316）。行号只定位，实施以现役 lawId/内容为准。

## 3. 工单取证与当前问题清单

证据链来自用户粘贴日志、同 run 原始 runtime log、AGENT 三表 SQLite、Browser 唯一 WAL、Forensics 原始回答，以及 Website 原表的只读事务读回。原 run：`95f4c77c-9aa3-47d5-927c-734108c45536`；原始文件 `.grasseye-local/runtime-logs/agent/95f4c77c-9aa3-47d5-927c-734108c45536-0001.jsonl`。按 `spanId/causedByEventId` 关联，终端投影不能充当完整证据。

用户附件：`/Users/nexgen/.codex/attachments/4d95de2b-b176-4127-a23d-e4e4971d465b/已粘贴的文本.txt`。SQLite：AGENT `.grasseye-local/production-runtime.sqlite`；Browser `.grasseye-local/browser/browser-mutations.sqlite`；回答索引 `.grasseye-local/forensics/artifacts.ndjson` 与其原 `.bin`。没有新证据库或 failure ledger。

批次有限窗口（run 开始至 2026-10-06 09:30 UTC）含 88 张工单；原始日志失败 attempt 为 75：68 次 acquisition timeout、4 次 RESULT_SETTLED_UNUSABLE、2 次 TARGET_INVALID、1 次 DOM_CANDIDATE_MISSING。该窗口初次读回 86 张 completed、2 张 failed。失败次数不是未完成工单数，也不是 75 个独立根因。

### P：付款截图观察工单

`aiprod_cda50d3e-67dc-49a1-af6d-101a885786f7`，route `payment_screenshot_observation/observe`；source `payment-observation:payment_evidence_4ec5a864-a5a6-4161-85a5-4e435a92fa0a`；order `order_9ac87698-a454-4f70-8679-cc42b238fe60`。

截图 3,378,007 bytes，SHA256 `72330e188a4a575025896ee35f346a9eb4979597ef9da39962f6317544d383c6`，与 Website material 完全匹配；实际为 AD VISION 花洒商品图。不是付款图，并不等于 AI 观察任务不能完成：合法否定观察与“付款通过”属于不同决定。

已保存四份完整模型回答，均被精确 result-revision rejection 拒绝：

| UTC 时间 / attempt | 原始关键值 | 原 artifact id |
| --- | --- | --- |
| 10-05 21:48:51 / `cb153dd9-ca18-4bc0-99cd-85787308d939` | page_kind=`other`，payment_app=`null`，false/null | `art-36920efd216b1c58c5187c316664a908b364eee48569012adea83acdbf570e68` |
| 10-06 04:19:58 / `e88b9d64-ff8f-4d19-89d7-0e3968e00bc5` | `unrecognized_other` / `null`，false/null | `art-b85ce3f4ecbeb32b586525590db2741eff2a678d8fd5f6180c1dd278c014c0c7` |
| 10-06 06:40:11 / `1ccb9598-5eaa-408f-be58-4e280be00796` | `other_unrecognized` / `null`，false/null | `art-6264e710dc08f69b1e7e4e3320589319414641e75b29fd4125307ad54d49cda8` |
| 10-06 07:49:00 / `bc85b97b-3567-431f-a80c-93a5aba3f7a2` | `other` / `null`，false/null | `art-62f1b94c693e9e459cf6058445fdefa02e80aec2d049f8c2d6c7619a38e726b2` |

第一直接断裂是 Product `flow.ts:128/236` 请求不完整格式，而 `result-contract.ts:9–16` 用隐藏 exact/enums 拒收。Website `website-agent-result-payload-contract.ts:196/231` 在 staging/reader 又执行同类领域拒收；不是 GPT 没看图、上传没发生或回答未保存。发给模型的 `result_contract.json` 仅 256 bytes，hash `5dab8d3c6e2bdac00a00dc311c16289914e60ef288e1403359386e31461a441e`，只有六字段名和禁止业务 verdict，没有值枚举、类型与负例。公开 route 也只有 schema identity，没有 payment primary `result_contract`。

历史商业证据在 09-30 已 rejected，原 reason=`review_unavailable_after_retries`，原 outbox 保留 `permission denied for table ai_production_job_failures`。当前 API role 权限已可读/写该表，不能把旧 ACL 事故宣布为当前权限故障。现役 Domain Consumer `payment-evidence-result-consumer.ts:155` 已有合法 `no_payment_change` 收束，保留原决定；只需得到合法观察并按同 job/result 完成 admission，不需要重开付款或删除该 job。

### L：zh-HK 固定文案工单

`aiprod_814a20e4-7f08-4e98-ade7-f83a53cf5354`，route `localization_static_catalog/produce_locale_catalog`；cohort `batch-be920065813d`；source hash `2ba80523a6bf5db2ed631cba694d3dfad84dbce2f7af395b40089ebec51efcbb`；冻结 policy `target-language-review-v26-20261004`。material 63,412 bytes，hash `53e7636375bc2af414b8ae2f89a4c8d9d72bbc640cb8ddab87a46c24991852a1`。

五次前期 acquisition 超时，第六次 attempt `75b29423-9278-4d64-9775-1b63befb8647` 在 09:00:05.157 inspect 成功、09:00:05.217 profile-open 进入；下一次 inspect command `cecf4cd3-a7dd-42c2-bd7a-8e61f6b07478` 于 09:00:06.489 返回 TARGET_INVALID，09:00:07.999 cleanup park 同码。原 log 行 16651–16654 可定位原 command→GPT→cleanup 因果。

该 job 的保留 WAL=0、回答 artifact=0、result candidate=0。当前资料证明失败发生在 Browser/GPT 准备而非译文领域接纳；不能据此宣称所有外部 writer 已 quiescent。历史 Target 究竟 loading、激活失败、frame 失效还是物理消失，现存资料不能唯一裁决。

### 10:54:17 UTC（迪拜 14:54:17）的独立只读快照

| 工单 | 当前 attempt / accepted 次数 | 最近失败 / retry_not_before | 业务终点 |
| --- | --- | --- | --- |
| P | `ecdf9e8c-78ae-4d2e-a104-4b36d2686803` / 22 | acquisition timeout，09:55:06 / 10:55:06 UTC | completed_at、terminal、business admission 均空 |
| L | `7abfa9b2-1741-4103-ac59-fad6c5b6a8a8` / 7 | acquisition timeout，10:01:26 / 11:01:26 UTC | 同上 |

设备 `aipdev_709b550b2decd50644df15ed15cfaf12` 的 N=3、限流 level=0、cooldown=null、cohort=[]。两张 failed job 仍保留 accepted_at/attempt/lease_owner，且尚无业务 admission，按 `job-claim-selection.ts:79` 计入两席；因此观察到只剩一席可承接其他业务。不是 N 被降成 1，也不是单 Browser lane 能决定 N。

2026-10-06 22:27 UTC的后续只读事务读回：P、L仍failed且无staged result/terminal/admission；N仍3、level0、cohort空。按同一原生容量查询，此刻occupied=3，另有原accepted未admission的`aiprod_1d0c387f-388c-4c98-8dcb-cb4bee456449`计入第三席。故前述“剩一席”只属于10:54快照，不能延用为当前可用容量；第三job只作为原查询分母，不扩大维修范围。没有执行DB写入或释放accepted slot。

两张最近 first fact 均为 `effect_scope/child_capability_id/browser_outcome/evidence_ref/evidence_hash=null`，cause 为 Error/code=null，mutation_outcome=`no`；AGENT 本地与 Website 原值相同，未发现本次网络运输丢字段。current_reason=`ATTEMPT_FAILURE_UNCLASSIFIED` 只解释分类，不能驱动释放席位。

| 当前问题 | 因果裁决 / 是否施工 |
| --- | --- |
| P1 付款输出格式请求与隐藏接收门不一致 | 已证实，付款格式/基础接收/领域消费片区需要重构 |
| B1 反复 acquisition timeout、TARGET_INVALID | 失败已证实；历史物理触发点未知，禁止猜测修复 timeout/Tab/导航策略 |
| G1 acquisition 早退及纯观察失败不携完整调用事实 | 已证实当前路径；可保全原 intent、code/cause，但不存在的 Browser effect 不能补造 |
| D1 commandStage 原诊断不能从当前事故持久证据读回 | 已证实可观测性缺口；原日志抑制 command-handler 重复 failure 是现役不变量，不能简单删 return |
| C1 failed accepted attempt 长退避占两席 | 快照事实；并非独立容量配置根因。所有失败均按次数退避，分类成功也不保证释放 accepted slot |
| H1 商业已拒绝而 AI job 未接纳 | 历史事故遗留，原 no_payment_change 分支应复用，不重做商业决定 |
| T1 终端缺准备细节 | 低噪声投影设计，不另造日志库；用原始 log 因果关联 |
| L1 固定文案尚无输出/领域接纳 | 下游后果，现阶段不修改翻译语义/policy，不发 replacement job |

## 4. 现役结构、连续性与四维裁决

| 片区 | 现役结构与第一断裂 | 权威/BP及连续性 | 裁决 |
| --- | --- | --- | --- |
| 付款 | Website task/material→Product Flow→原回答→Product parser→Outbox→staging/reader→Domain Consumer；公开请求缺枚举，Product/AA 提前做领域校验 | Website AI-012-V40 forbidden 3/4/8/10；AI-010-V13；Payment Evidence 001–007；AI BP §A/B/F。`148426e49` 已落地图片卡片识别与 latest/reasoning=2 | 保留附件修复、模型 profile、原材料与 once；删除 primary 隐藏 parser，格式只有 Website canonical provider，领域判断回原 consumer |
| GPT | `ProductionGptChildTools.executeOne:142` acquisition 在 atomic phase 前；support:89 普通异常直接 terminalize；pure observation 的 projectBrowserFact:44 合法返回 null | GPT 001/002、Capability 001/002、GPT BP §Browser/证据；`92bb5a97c` 已落地唯一纯 Browser fact 投影及同一 atomic identity | 保全 Child 原调用事实和 cause；继续复用 projectBrowserFact；不为 observation 建 WAL 或假 target-local REJECTED |
| Browser | acquirer:60 本地 timer 只抛 timeout；Extension 现有 stage 已诊断，Supervisor:176 只传 reason/event/nativeCause，Emitter:13 抑制重复 command failure | Browser 003/004/006、Log 001–003；Browser BP §证据/闭合载荷；Log BP event v3；原 command terminal/ACK、slot/CAS 不变量 | 不改 deadline、lane、Target 生命周期。先证明安全相关性；缺原 stage 与 terminal 不能作授权 proof |
| Runtime/Website | serializer:124 child id 只取 Browser effect；first fact 持久只写一次；两边 classifier 要完整 Browser evidence；retry 与 accepted slot 不由 current_reason 决定 | Runtime 001/004/005；Website AI-012/013；双仓 BP §4/5；current_reason 既有方案仍保留诊断边界 | 复用原三表、source seal、Outbox、claim、退避和 admission；只运输原事实，不改变恢复裁决 |
| 静态文案 | 尚未进入 submit；原 cohort/source/policy/qualified-message 原 consumer 接纳 | Localization 009/019/020；Website AI BP §B，GPT BP 固定 catalog 续聊链 | 不动 static Flow/policy/字段资格；未来按相同 source/current policy 真正 readback，不让旧冻结结果覆盖漂移后的在用版本 |

此前“创建后导航尚未 complete 就发布 claim”的修复已经在 current `extension-created-target.ts` 的同一 absolute deadline→waitForCreatedTarget(requireComplete=true) 中落地。本次没有证据证明该缺陷回归，不再追加另一个 wait、更长 timer 或第二 readiness。

旧方案 W7 的 `aiprod_2e48943f…`、`aiprod_2ecfc2ce…` 及 U-Z 未在本轮解除；不清除、不重试、不代签风险授权。历史 Provider 单调性方案只作连续性线索，不能导入“业务 failed 就删除全部旧 job”的做法。原完整回答复用、原 WAL终态、输入前全历史核验、source seal、精确领域 rejection、新 revision 互斥来源、无旧 Target 恢复身份都进入 §8 防回归验收。

## 5. 唯一目标链、合同与有限分母

```text
Website 原 immutable task/material + 唯一公开 route 格式
→ 原 Product 静态 Flow / 原 Browser 全历史 input authority
→ 原 observed DOM + semantic text artifact
→ Product 一次基础接收与无损归一
→ 原 Runtime staged result / 唯一 Outbox
→ Website 只核运输、route/schema/identity/hash/receipt
→ 原 Domain Consumer 唯一校验领域观察与裁决
→ 同一 client/事务写领域结果及 admission
→ AGENT completed + Website 业务 readback
```

无损归一在本片区只允许 identity projection：唯一 JSON object 解码后保留字段和值及未知字段，原 raw artifact/ref/双 hash 不变，原 evidence/receipt 绑定实际交付。没有枚举 alias、null→unknown、字符串→数字/boolean、code fence 猜提取、字段删除或模型语义推断；原回答已被拒绝时不能用新接收器重新追认。模型必须按公开格式产生合法新观察，何时允许新输入仍由原 Website rejection/source/WAL 决定。

公开付款格式的提案：现役六字段不增减；schema 固定 `payment-screenshot-observation-v1`；page_kind 请求 `payment_success|other`；payment_app 请求 `alipay|wechat|unknown`；success_visible boolean；amount null 或 safe integer；reason_code string。非付款图请求 `other/unknown/false/null`，不授予 accepted/rejected/payment_received/order_approved。该提案来自现役商业类型，不是本方案创设付款事实；必须先落实到唯一 provider，再机械投影给 Product，不能在 Skill/Prompt/AGENT parser 另抄一套字段 schema。

供源头审议的唯一公开 `result_contract` body 如下。它是请求格式数据；不扩task/result envelope、不加入生产步骤，不另存归一化sidecar。`reason_code` 的非空条件明确公开，Domain只消费已声明的六字段且校验其机械类型；额外字段继续留在raw/result，不得取得订单或付款裁决权。

```json
{
  "schema_version": "payment-observation-result-contract.v1",
  "output_schema_version": "payment-screenshot-observation-v1",
  "requested_fields": ["schema_version", "page_kind", "payment_app", "success_visible", "visible_amount_minor_units", "reason_code"],
  "field_types": {
    "schema_version": {"const": "payment-screenshot-observation-v1"},
    "page_kind": {"enum": ["payment_success", "other"]},
    "payment_app": {"enum": ["alipay", "wechat", "unknown"]},
    "success_visible": {"type": "boolean"},
    "visible_amount_minor_units": {"type": "safe_integer_or_null"},
    "reason_code": {"type": "non_empty_string"}
  },
  "unknown_field_policy": "preserve",
  "forbidden_verdicts": ["accepted", "rejected", "payment_received", "order_approved"]
}
```

贯穿 identity spine：job_id→source_task_id/request_hash→product/action/task/result contract→material identity/hash/bytes/owner→accepted attempt/revision/lease/fence→Product step/call/Child→原 provider effect→原 artifact 双 hash→result hash/receipt→domain consumer/consumption hash/business object。Target/Document/epoch只用于当前动作，不进入恢复资格、容量、cooldown或跨仓业务身份。

| 相邻 handoff | 现役合同及核验 | 输出/拒绝/未知的 Owner |
| --- | --- | --- |
| Website→Runtime/Product | task-result provider/dependency v16、task/result envelope v1；V6 v44；材料 exact bytes/hash、排序/基数/trust/Owner；40 routes/48 parameters/34公开result_contract | Website签发；Runtime只机械核验，缺失/额外/漂移 fail-close |
| Browser→GPT→Runtime | 原 immutable atomic identity；非读动作原 WAL terminal/outcome/input count；纯读/acquisition没有WAL时如实空；Child临时proof不是Browser authority | Browser原事实；GPT纯投影；Runtime首事实不可补写 |
| Product→Outbox→Website | 单一完整result hash/object receipt，unknown-field保留；回复不明仅读原artifact/staging/terminal/admission | 原Runtime Outbox与Website AA；零重复Provider动作 |
| AA→领域consumer→readback | 原同client事务、固定锁序、job/result hash幂等；商业订单/evidence或locale/source/cohort/current policy | 原领域Owner；completed/rejected/transient沿原链，AA只签admission或原rejection |

有限分母：①全历史无可能输入的fresh准备；②已有DISPATCHED/CONFIRMED同effect读回；③合法完整回答；④未完整/身份错误回答；⑤原领域精确rejection；⑥原结果交付未知/暂时消费失败；⑦合法负付款观察及历史no_payment_change；⑧静态部分合格/零合格/身份漂移；⑨未知Browser准备故障；⑩原Website永久撤权/exact absence。

①仅原claim/source核验后新attempt；②旧effect零submit，缺quiescence不风险重放；③领域admission后完成；④基础运输不可交付才局部fail-close，领域内层由consumer裁决；⑤原receipt一次新revision；⑥同result有限重消费；⑦不改变原付款决定而合法关闭AI任务；⑧原localization consumer保存合格字段、现役补译或原revision退避，漂移不激活；⑨原Owner保持未知、有限再检查，不能伪造fact放行；⑩只有原Website精确撤销/absence才能本地清算。成功、拒绝、暂时失败、未知和撤权都接原主链，没有新增恢复状态。

## 6. 设计阻断与源头提案

**GAP-A：公开付款格式与源头分母。** 现役 payment route 没有 result_contract；补入后公开合同数从33变34，task-result provider语义需要从15递增至16。AGENT Runtime-003-V43 与双仓BP明确固定33/v15，不能直接改代码绕过。提案仅发布这份既有付款观察格式；Product/route 数40、parameters48、V6 v44、task/result envelope v1、付款schema v1、原task/request/material bytes均不变。

本轮明确授权已包含上述法案及施工图，不再将正常源头修订包装成待批准。源头已按本轮授权物理删除后重建：Runtime-003规范改为34/v16，按母本§12.4原子升为V44、supersedes指向V43；Runtime-004/007/008对同lawKey的依赖引用同步指向现役V44，不能留悬空V43。Runtime Blueprint保留稳定blueprintId，只替换实际合同及数量连接；Website AA Blueprint更新task-result=16并指向唯一公开付款格式，不抄一套schema。V6=44及Route Manifest provider=4规范未变，不顺手升版本。同步归位 Runtime Manifest lawIds、三份spec的lawIds及原验收/inspector/session-output引用，由原audit:build生成唯一registry，不手改generated。其它法条正文、具名GPT/Browser冻结、品牌价值、恢复主权及用户overlay保持；本文不能替代active authority。

**B：原基线旧任务身份设计已反查闭合；本轮hash-core overlay后须重新验证，实际cutover验收仍必需。** `services/api/src/ai-production/website-agent-task-repository.ts:230–261` 的canonical body与 `packages/ai-contracts/src/agent-task/website-agent-task-result.ts:409` 的hash只包含原task各项事实，不包含provider descriptor version或route result_contract body；task validator:219–225核task/result envelope version1。故本提案只更新descriptor/public格式、保持原业务参数/材料/关系/envelope时，不需改request_hash或旧256byte材料。两张旧job原身份保留，不加旧版reader或replacement job。实施仍须在同candidate核原task validator、原材料读回与原Website grant，再按逐effect来源结算旧回答；未经运行期原来源/drain证明不得cutover。静态兼容设计不冒充旧writer已静止或新输入已获授权。

**GAP-C：历史物理触发点未知，未来原命令诊断的设计已闭合。** 现役 REPLY→pending 删除→DIAGNOSTIC 的顺序丢失原命令关联。复用既有帧、认证发送队列、AwaitingReply、terminal error、Command Actor 与 Runtime Log：Extension 固定原 terminal 后 DIAGNOSTIC→finally REPLY；Node 只在现役 pending 暂存首次已解析 reason/stage，REPLY 经原 verifier/WAL/ACK 后只把同 code 的 stage 交原 error，Command Actor 记录一次原身份 diagnostic event 并沿原 failure span。晚到/无 pending/code 不等不归属；不新增 wire/DB/Log 字段、timer、历史 map、第二 store/第二 blocking failure。诊断发送失败也尝试 REPLY，槽中原 fact 保持到现役 ACK/补交，Target退休在REPLY成功后的finally内执行，诊断发送异常不跳过该退休；保留既有commandKind/commandIntentKind/capabilityId脱敏诊断，commandIntentKind只透传原dom-intent的intent.kind，不扩现役closed诊断枚举。Actor日志写失败的AggregateError保留原terminal error为cause，WAL/ACK和原失败码不退化。新诊断无法补证旧 Target 为什么失效；历史 firstfact 与 WAL 不回填。物理故障本轮只保留原未知 Owner 分支，禁止猜改 Tab/lane/deadline。

源头先修订 Runtime-003/V44、原 Blueprint、provider/dependency/Manifest 引用并核全部关联。独立付款与身份保全修复不依赖已丢失历史现场；删除原“必须追回旧物理根因才能施工所有已证实片区”的无效依赖。实际激活仍须 §10 原 writer/drain/同身份验收，无未来 Dynamic 证据不冒充已完成。

## 7. 原子工单与完整清场边界

所有路径相对表中repo根。目录不是删除授权，列出的完整文件才是片区候选。每张工单单独准入、删除、ABSENT、重建、验收；跨Owner依赖按C→R→G→P→S→D→E顺序，B只修复已证实的原命令关联断点，历史物理触发点保留未知。没有跨仓mega工单。

| 工单 / 唯一Owner | 完整文件候选与当前承载 | 决定、动作及consumer readback |
| --- | --- | --- |
| C-W / Website ai-acceptance | `packages/ai-contracts/src/agent-task/website-agent-route-policies.v1.json`、`packages/ai-contracts/src/agent-task/website-agent-route-policy.ts`、`packages/ai-contracts/src/agent-task/website-agent-task-result.ts`；`docs/specs/ai-acceptance/website-agent-task-result.provider.spec.json` | GAP-A先落地；整文件清场后在原provider发布§5完整格式、v16/34；保留其他route全部语义、原task/material身份及V6。Consumer为原AGENT generator及Website sender/reader。双方逐项语义相等与B同身份验收通过后才准下一片区 |
| C-A / AGENT agent-production-runtime | `scripts/generate/sync-website-agent-route-policy-projection.ts`（78行）、`src/lib/local-runtime/production/route-policy.ts`（102）、`src/lib/local-runtime/production/website-agent-route-policies.v1.json`、`docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json`；仅lawIds归位的`docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json`、`docs/specs/agent-production-runtime/agent-route-capability-manifest.provider.spec.json` | 完整删除后只由原generator重生成唯一projection并核v16/40/48/34；不手写投影。Route Manifest仍由原Catalog产生，task/result版本1不变，原Provider声明只属于Website。接收readback是Product实际拿到同一result_contract |
| C-QW / Website ai-acceptance | `scripts/audit/domains/ai-acceptance/check.ts`（499）、`scripts/audit/domains/ai-acceptance/law-012-v12-inspection.ts`、`tests/exam/ai-production-v6-contract.test.ts` | 源头批准且C-W完成后整文件删除重构原checker，`routeResultContractValid`在原职责内证明付款primary存在§5完整格式，版本只认16；原完整route/identity/图像证明保持，不能宽松接受15/16或忽略版本。重构原条件体而非叠加wrapper/第二schema表，按Website原预算核承载。consumer为Website唯一quality |
| C-QA / AGENT agent-production-runtime | `scripts/audit/domains/agent-production-runtime/contract-inspection.ts`（412）、`scripts/audit/domains/agent-production-runtime/inspector.ts`（499）、`scripts/audit/domains/agent-production-runtime/session-output.ts`、`scripts/audit/domains/agent-production-runtime/manifest.json`、`scripts/acceptance/agent-route-contract.acceptance.ts`（187）、`tests/governance/quality-contract.test.ts` | 源头批准且C-A完成后整文件删除重构原33/v15保护断言为对应真实34/v16断言，保留其余AST/route/材料/生成图像正反证明；499行inspector只更新原必要绑定，不加新层/门或超预算。Manifest仅更新现役lawId，ownedPaths不变；session-output仅更新原lawId key，不增中央clause路由或第二入口。consumer为AGENT唯一quality |
| R / AGENT agent-production-runtime | `src/lib/execution-failure.ts`（125）、`src/lib/local-runtime/production/terminal-failure.ts`（154）直接复用；`scripts/acceptance/agent-production-runtime-failure-transport.acceptance-support.ts`（76）全文件重建验收 | 原V6 browser facts是同一组事实：无Browser effect时scope/Child/outcome/provider_effect_identity_hash均为空，已有effect时保留该effect的Child与evidence对；不能把GPT当前调用身份填进wire Child。撤回本轮临时新增metadata及无effect Child fallback，相关生产文件物理清场后按原单链重建为直接复用；不变更V6=44、Website validator、firstfact或分类规则。原transport验收与Website实际公开assertLeaseReleaseV6须对同一序列化结果核无effect合法空值、部分Browser事实拒收及原CONFIRMED事实保全 |
| G / AGENT gpt | `src/capabilities/gpt/production-child-tools.ts`（173）、`src/capabilities/gpt/production-child-support.ts`（98）、`src/capabilities/gpt/execution-fault.ts`（118）直接复用；`src/capabilities/gpt/acceptance/gpt-failure-evidence-readback.acceptance-support.ts`（35）全文件重建验收 | 删除本轮当前Child metadata传递设计；GPT原childSpan已在原logger写入真实job/attempt/step/capabilityCallId，后者绑定callId:childCapabilityId，可用于故障定位，不增加字段或carrier。普通异常沿原typed失败出口保全code/cause，不补假Browser fact或失败artifact；known-rate-limit原控制流及原projectBrowserFact直接复用。实际public execute/acquisition及ability-group观察失败验收同时读回原日志调用身份与R的空Browser事实；原CONFIRMED submit fact保留其来源Child，不被后来checkpoint覆盖 |
| P / AGENT payment Product（文件治理architecture-boundary） | `src/plugins/payment-screenshot-observation/flow.ts`（253）、`scripts/acceptance/product-plugins/payment-screenshot-observation.acceptance.ts`；`src/plugins/payment-screenshot-observation/result-contract.ts`（18）永久删除 | GAP-A落地且B同身份验收通过；Prompt机械写入唯一公开格式，维持latest/reasoning2及现役静态Child顺序。基础接收保留object/schema/identity/artifact完整性，只做一次identity projection；删除primary hidden exact/enum/非空门。`src/plugins/payment-screenshot-observation/index.ts`仍直接注册原flow；review在原flow调用现役公开review接收能力，不恢复该删除文件、不复制schema。Consumer是S；实际Prompt、raw/hash、交付payload能同身份读回 |
| S / Website ai-acceptance | `services/api/src/ai-production/website-agent-result-payload-contract.ts`（244） | 完整删除重构该文件，付款primary只核基础route/schema/运输，移除付款内层exact/enum判断；其他route不借本工单扩大改变。原`output-artifact-routes.ts`与`website-agent-result-reader.ts`继续调用同一函数，不另加defer/旁路。Consumer是D；staging不作付款领域决定 |
| D / Website commercial-payment-evidence | `services/api/src/commercial/payment-evidence-result-consumer.ts`（252）、`tests/commercial/simple-screenshot-payment.test.ts` | 完整删除重构，将付款观察字段合同校验放入原prepare路径，并消费唯一公开格式而非复制enum真源；非法领域结果沿原rejection，暂时读取失败沿原transient。保留order→evidence→runtime锁序、source/material/hash验证、CAS、幂等及no_payment_change。原strict staging测试整文件重建，换成基础接收/领域裁决分离的真实反例，其余商业安全用例保留。最终readback为相同job/result admission和原evidence决定不变 |
| B / AGENT local-browser-session | `src/lib/browser/chrome-extension/websocket-actor.ts`、`src/lib/browser/transport/browser-authority-websocket.ts`、`src/lib/browser/exact-target/browser-command-actor.ts`、`src/lib/browser/exact-target/browser-command-runtime-logging.ts`、`src/lib/browser/chrome-extension/extension-command-runtime.ts`、`src/lib/browser/chrome-extension/websocket-command-diagnostic.ts`、`src/lib/browser/transport/browser-authority-diagnostic.ts`；`scripts/acceptance/local-browser-diagnostic-contract-support.ts`、`scripts/acceptance/local-browser-auto-pairing-support.ts`、`scripts/acceptance/local-browser-terminal-contract.acceptance.ts` | 全文件清场重建 §6 的原帧→原 pending→原 REPLY/WAL/ACK→原 terminal error→原身份 event 链。Supervisor/Emitter 去重直接复用，不增第二 failure。测试必须执行真实 sender/receiver/Actor 入口；诊断发送失败仍尝试回复、mutation ACK 不被日志失败扣押、重复/迟到/code 不等不串 command，原原因码及因果保持 |
| B-Q / AGENT local-browser-session | `scripts/audit/domains/local-browser-session/browser-mutation-settlement-inspection.ts`、`scripts/acceptance/local-browser-rule-mutants.acceptance.ts`、`scripts/audit/domains/local-browser-session/transport-inspector.ts`、同一`tests/governance/quality-contract.test.ts` | 原生CHANGE证明现役inspector仍硬编码旧REPLY→退休→诊断顺序，与已获准单链冲突。整文件清场，在原inspectReceiptConsumer核事实槽→诊断→原try的finally直接等待唯一REPLY→退休；保留其它所有WAL、ACK、认证、readgate检查。原mutant测试保留所有旧反例，补缺事实/错finally/条件跳过回复/提前退休/额外提前回复反例，合法当前源头必须零finding；不新增checker/helper/Owner/预算 |
| L-Q / AGENT runtime-log-spine | 原 `scripts/acceptance/runtime-log-spine-v2.acceptance.ts` | 验证 B 使用现役 event/typedIdentity、同 command 一个 failure terminal且独立 command-handler failure 增量0，无新 schema 字段、flow position、WAL或第二 writer；不新增日志Owner |
| E：验收顺序索引，不是跨Owner原子工单 | 原Product/GPT/Browser/Runtime/Website各自原生quality与领域readback，无新增文件/Owner | §8分别归各Owner原生入口；重建仅限本表已列实际验收文件，不共享动态assertion、原Provider job或另一域verdict，不删除无关测试、不扩全仓 |

付款 Website producer `services/api/src/commercial/payment-evidence-agent.ts`（386）直接复用：不改变旧result_contract material bytes，`readOriginalPaymentObservationTask`仍按原任务的唯一冻结内容核对；完整Provider请求来自公开route。`packages/commercial-contracts/src/payment-evidence.ts`保留现役商业类型，公开schema与类型语义须在C-W验收等值。本次结构修复在原职责内完成：Browser只对现役closed parser输出的frame/source/event三项做精确组合相等核验，保留原pending/首次/stage条件；原自动配对验收把命令诊断顺序放入既有originalDelivery，仍先诊断后原delivery，不新建转发层；S将既有静态文案早退和付款schema早退合并，其他route行为不变；D在原prepare内按唯一公开格式逐字段找出首个非法值，使用原Observation命名类型，禁止双重类型断言。Website checker以原AST计行核500上限，不能用换行统计冒充。源码承载不能先堆再切：AGENT native限制文件500行/函数75行/参数7/return8/嵌套5/复杂度16/await10/import28/source24/export24，重建时删除旧门并复用现役函数，不添转发层；Website按自己的原生结构规则，不照搬AGENT数字预算。

原`services/api/src/ai-production/business-result-consumer.ts:318/409`与`services/api/src/commercial/postgres.ts:35–51`直接复用：nested withCommercialTransaction先取AsyncLocalStorage当前client，没有创建第二事务；`prepare→lock→consume→finalize→readback`仍属原商业/AA接纳链，不把源码表面嵌套误列成事务断裂。原`src/capabilities/gpt/web/child-handler.ts`、`ability-group.ts`、`production-child-result.ts`分别保留唯一Browser投影、原Child proof生成及只持久完整回答的边界。

R/G/P/S/D不改变firstfact已持久原值；当前两张工单的历史null事实不得补写、伪造或迁移成新proof。Consumer得到新的真实失败也不保证capacity释放。若实际需要扩其他整个文件，先沿同一根因图定位、审计并更新本文再准入，不能施工时临场猜scope。

## 8. 分层验收与业务终点

1. **Static/Contract**：唯一公开格式→原generator→Product实际Prompt逐字段一致；v16/40/48/34只在源头批准后使用；原材料hash/request不变；payment primary hidden parser/import/内层staging门零残留；未知字段/raw答案保留，无alias/副本/第二store。`result-contract.ts`文件与import均ABSENT。
2. **原Native Exam**：实际Product Flow消费合法非付款观察可交付；额外字段在基础接收不被拒；null app/非法page-kind不由Product“修好”，在唯一Domain Consumer拒绝；raw bytes/ref/hash保持。confirmed effect恢复submit增量0，新获授权effect最多1；旧拒绝答案不因parser改变被重新接纳。原附件图片DIV和JSON BUTTON识别、模型/reasoning2、同一atomic identity、原终态/ACK/CAS反例仍有效。
3. **故障/观察反例**：在Browser acquisition失败、纯inspect失败、target-local失败、Provider CONFIRMED后失败、known-rate-limit关门失败逐条消费真实typed结果；无Browser effect时wire Child/scope/outcome/provider_effect_identity_hash全部为空，并通过Website公开assertLeaseReleaseV6；原GPT日志的capabilityCallId仍绑定实际调用Child。已有effect时保留Browser来源Child及原evidence对，后来checkpoint/inspect Child不覆盖submit身份。部分Browser事实必须由现役接收器拒收。cause原样，只有原Browser fact填effect字段；不能把gpt-child-proof ref/hash冒充Browser evidence。无fact仍fail-close；重复/迟到/乱序diag不得制造新failure、假terminal或新恢复资格。保持 Forensics failure artifact增量0、第二日志库/计时器/状态增量0。
4. **原生质量与CI-FULL**：冻结`/Users/nexgen/.codex/skills/ci-full-governance/SKILL.md`连续执行CHANGE→clean commit→READY→RELEASE，不修改母本或该Skill。AGENT `package.json` 的唯一 `quality:check` 为 `node --import tsx scripts/audit/governance.ts quality`；Website为 `tsx scripts/audit/governance.ts quality`。按该仓母本规定的CHANGE/READY/RELEASE调用，不创建总PASS。Website每次命令的同一环境先核Node>=24，本机已验证Node24路径 `/Users/nexgen/.nvm/versions/node/v24.20.0/bin/node`；静态/Exam不代替真实Browser/Provider。实际CLI以现役入口为准，AGENT READY用`npm run quality:check -- READY`。两仓并行用户改动已由用户明确授权一并提交；保留全部当前工作，通过当前CHANGE后各仓提交完整候选，以母本§49及CI Skill核原生clean commit再一起READY。不得忽略、stash、移动或删除改动制造clean；资格不成立时不调用READY/RELEASE，不生成项目PASS/FAIL。
5. **真实端到端，设计阻断闭合、原grant及切换条件成立后执行**：P按原job/source/revision与Website授权经过Browser→原answer→Outbox→S→D→admission；最终AI completed，原商业rejected/decision hash不变，`payment_observation_disposition_v1=no_payment_change`与同result消费hash可读，订单/权限/资金不因否定观察改变。L按原cohort/source/locale及当前适用policy完成真正领域接纳，在用译文与qualified-message receipt等值；源漂移则原Owner拒绝激活，不能为了完成旧job重写policy。
6. **容量读回**：同一job只计一席；accepted但未admission的failed/staged仍占原席；ACTIVE_ATTEMPT不加席；真正admission或原Owner合法source handoff之后按现役规则核容量。N仍由Website，Browser lane仍1。不将局部promise结束、关闭Tab或diagnostic分类改名作为释放证据。

## 9. 删除反事实裁决

| 单元 | 当前必要性、真实consumer、Owner输出、删掉后的具体失败 / 更短替代 |
| --- | --- |
| 唯一公开付款格式及机械投影 | P1缺格式；Product Prompt直接消费Website AA输出。删掉继续让模型猜枚举；不能在Product Skill再抄字段。替代现有欠完整请求，不新增route/queue；旧隐藏parser在P/S物理退休 |
| Product一次基础接收/identity projection | 原raw artifact→Runtime是交付入口，Product Owner。删掉不能形成唯一result；原泛化normalize库/别名映射没有必要，不新增，零转换时原值保留即可 |
| 原Domain Consumer领域校验与no_payment_change | 商业Owner唯一决定、AA接admission。删掉S旧校验又无D校验将把任意payload当观察；删no_payment_change会丢已拒绝商业证据的合法AI收束。复用原prepare/事务，不另立payment validator服务 |
| 原GPT日志调用身份及原Browser失败事实 | 现役childSpan的gpt-call typedIdentity已承载job/attempt/step/callId:Child，故新增当前Child metadata没有必要，必须删除；原Runtime serializer继续只运Browser原事实。日志用于诊断，V6 browser facts用于原Website恢复主权，直接复用两个已有合法consumer，不新增字段、归一层或持久schema |
| Browser原WAL、原terminal/ACK、唯一lane/current registry | GPT/source reconciliation消费Browser事实。删除会失去at-most-once和可信quiescence；不新增failureWAL、Target恢复store或第二timer。GAP-C未证明更短关联，当前不准加结构 |
| Runtime三表/Outbox/source seal与Website原claim/failure/admission | 原生产及领域consumer依赖；删掉会失去同result幂等、原attempt资格和业务完成。分类空值不提供删这些单元的理由，直接复用，零第二恢复器 |
| 日志原writer及command-handler去重 | 原因果读回consumer；删除去重会把同命令报成第二独立阻断。诊断保全必须接原事件合同，不能为stage新开ledger或logschema |
| 旧strict payment parser及基础接收领域门 | 无独立合法Owner决定，真实领域判断由D承担；保留会在领域前拒绝可交付值。P永久删parser，S全文件重建移除同义校验，无compatibility替身 |
| N/backoff补丁、重新开Tab恢复器、replacement job、normalization alias、事故复跑 | 不能证明当前必要性或原authority；全部从目标方案删除，不分配工单和测试。unknown分支仍由原Owner有限再检查 |

## 10. 跨仓顺序、停止与回接

代码开始条件是本轮源头修订、两遍主审和所有设计要求核销；达到后可在现有 main 清场重建授权源码。事故现场不可恢复不阻塞已证实的付款和诊断修复。服务激活/cutover 与未来业务证明仍必须满足下段运行期门，不将静态设计当原 writer 已终止。

实施窗口先按原控制关闭受影响片区新claim，停止未获授权新submit，逐job盘点原accepted attempt/lease、WAL全部相关command真实终态、未决effect、回答artifact、staged/Outbox及领域receipt。不能以全库零未完成job为drain条件；保留两张原job及历史全部事实。旧writer未收束，保持原链只读结算和关门，不切换。

冻结provider、dependency、route projection和所有相交source在同一candidate后，依次C-W→C-A→R→G→P→S→D；执行期间两仓服务不加载半成品。先各仓CHANGE，READY必须使用各自原生clean commit；共享main并行改动保持原样，按用户合并授权与本轮候选一并提交；不能删除或隐藏制造clean。无兼容桥的cutover只有双方当前版本与语义精确相等、原grant和旧任务身份读回成立后才能开新session/claim。不能靠先上线一边试错。

失败停止：保持片区关门，保留WAL/firstfact/Outbox/material/receipt，核原回执再行动；外部写UNKNOWN不重发。实际部署前各仓原clean commit就是回退点，但有外部动作发生后不能直接回滚出第二兼容链；先由原Owner读回并结算，再经重新授权回到两仓相同合同。不得restore/stash覆盖共享main用户工作。

若施工中发现源码含用户改动、related candidate drift、第三Owner、字段/合同不等、无法证明原terminal或未知业务消费，停止该工单，保持原事实，返回本文同一缺口修订。不得为了完成两张工单删除业务job、清零失败次数、解除原rejection、改policy或降低付款安全。

## 11. 本轮主审与施工进度

本节记录执行事实，不产生独立quality verdict。2026-10-06的历史输入与未知物理触发点继续保留在§3，当前方案已完成2026-10-07源头修订和施工准入。

源头主审第1遍：003 原子升 V44且 supersedes V43；004/007/008只归位依赖，不改变其规范；其余32条功能记录保持。provider/dependency16、Blueprint34格式及Manifest同源一致，V6=44/Route=4/envelope1不变。发现 AddFile 产生EOF多余空行，源头全文件重建纠正。源头主审第2遍：反查真实发送队列与原槽，diagnostic失败仍finally发送REPLY；Node收到诊断只暂存、WAL/ACK先于Actor日志。发现非mutation原生code可能不同于diag通用code，已把原诊断producer纳入B清场，并要求reasonCode复用同一REPLY的真实code，禁止把stage冒充cause。

两遍源头主审的13项有限要求已核销：双仓唯一源头/Owner；当前main及overlay保护；单一provider和投影；16/34规范与全部引用；旧task/request/material身份；原Browser effect/firstfact不改写；诊断原command关联；终态/ACK优先；原code/cause与唯一failure；结构预算及精确完整文件；领域同client/readback；source/drain/UNKNOWN不重发；原生quality独占。没有留待施工者自行决定的设计项。历史物理触发点未知与未取得的未来Dynamic证据明确保留，不宣称业务已完成，不自填98%。

初始候选两仓在2026-10-07、Node v24.20.0执行原生 quality:check CHANGE，退出0、CHANGE_PASS；仅绑定源头修订之前，不能外推修复通过。

施工已进入代码：C公开格式和原generator投影已清场重建；P/S/D已清场重建，旧Product付款parser已物理退休。B及其原验收已重建。R/G已按修订源头清除新增metadata，其五份生产文件回到原单链直接复用，原验收补足真实失败日志和跨仓空事实接收反例。所有代码由主Codex写，子智能体只读审查。

C步骤独立审计发现原checker对同步错误schema仍可通过、原Exam旧v15断言以及本文handoff表旧15/33残留。主Codex已分别整文件重建修正，C步骤复审已放行。B步骤实际发送/认证接收/WAL/ACK/日志失败验收完成且独立复审已放行。R/G/P/S/D步骤审计通过真实AGENT序列化→Website公开接收复现AI_V6_LEASE_RELEASE_INVALID：无effect但Child非空违反V6。主Codex返回源头，删除新增metadata设计，改为复用已有GPT日志身份与原Browser wire事实；此处两遍主审后已完成相关清场重建，实际两仓接收验证通过；V6与接收器没有放宽。Runtime BP生成图像段的旧v15描述已改为实际task/result envelope v1，descriptor为16。当前完整子审、原生CHANGE/READY/RELEASE及真实工单业务证明尚未闭合，不宣称建设完成。


前一候选完整总审检查32项要求，29项符合，3项未核销，未放行；结合该候选原生CHANGE，合计7项具体finding：AGENT Blueprint通用provider hash文字命中身份绑定禁令、认证control复杂度18>16、自动配对验收await11>10；Website checker AST物理行501>500、S入口return9>8、D字段判断嵌套6>5及双重as。该候选AGENT/Website原生CHANGE均退出1；Website其余typecheck、lint、适用Exam与126项治理测试通过，不抵销code-purity失败。按原冻结CI三层鉴权返回本文同一候选修复，不调高预算、修改母本/冻结Skill或新增机制。源头文字使用既有provider_effect_identity_hash准确指代Browser effect，不能将其解读为Provider合同身份绑定。修复后旧候选的审计与质量结论失效，须重新自检、独立总审及原生CHANGE。这次源头修订由主Codex独立完成两遍审计：第一遍绑定当前失败、精确源头差异与原预算；第二遍反查closed parser、REPLY/WAL/ACK、S route行为及D字段语义，7项修复的Owner、现役消费者、删除边界与验收均无未裁定设计项。未引入新字段、原型、helper、转发层或第二链，可进入本次已授权的完整文件重建；不以主观98%代替该有限范围核销。


7项finding已在原文件完成再次删除→ABSENT→重建。主实现自检第1遍核原预算：AGENT认证control复杂度16、原automatic pairing await10、原delivery await8；Website原metrics与type-escape检查对checker/S/D均无finding，checker AST499行。第2遍反查真实consumer：公开provider与原projection字节相同(v16/40/48/34)，旧parser不存在，R/G五份生产文件与原HEAD字节相同，D的lock/consume/finalize/readback全部原业务代码保持；实际认证Browser入口新增wrong-frame/source/event反例通过，WAL/ACK及日志失败cause保持；付款原消费链16项全部通过。第2遍主审时原自动配对完整验收仍在运行；随后原入口退出0，原输出automatic pairing and exact Target navigation exercised；AGENT原typecheck也退出0。当前Native CHANGE须在独立子审后重跑。两遍自检不代替quality verdict、真实Provider、旧writer/drain或业务完成。四份AGENT并行用户文件保持原hash，Website其它栏目方案在用户并行工作中更新，原样保留；不能借此宣称工作树clean。


2026-10-06 22:54 UTC独立总审复审：32/32建设要求覆盖，7项原finding全部核销，未发现新增阻断，明确放行方案建设。独立读20个AGENT施工TS/559函数体及原结构口径无超限；Website修复3文件按自身口径无超限或双重as。closed parser原有限256种来源组合与新三项组合相等条件0差异、0含NUL值；真实验收、单主链、删除/ABSENT/重建、原业务安全及用户改动保护均核对。该放行仅为建设审查，不是quality verdict；当前Native CHANGE/READY/RELEASE、Dynamic Proof、旧writer/drain、原grant及两张工单业务终点仍须原链真实执行。原生质量状态以当前唯一quality:check实际输出为准，本文不代造质量回执。母本和冻结ci-full-governance Skill均未修改。


2026-10-06 23:01 UTC，本轮两仓原生CHANGE均退出1。AGENT唯一失败为acceptance:local-browser-terminal中的原rule-mutants：现役Owner inspector拒收websocket-actor，因为仍按旧fact→REPLY→retire→DIAGNOSTIC文字顺序检查。直属LAW-LOCAL-BROWSER-SESSION-004-V56forbidden:20要求先PREPARED/DISPATCHED及原真实终局回执，现役Browser BP原命令诊断段要求先保留terminal槽、诊断后finally尝试REPLY；不能因此撤回诊断关联或放松事实槽/ACK。B-Q只对齐原Owner inspector与已获准的finally单链，其它生产与业务源码保持。Website是EXAM_CANDIDATE_DRIFT与母本§50：本任务11份Website文件字节未改、HEAD未变，另一未跟踪栏目方案在Exam期间变更，足以使原snapshot失败；其代码纯度/typecheck/lint及已执行11组普通测试退出0不构成CHANGE通过，治理核心未执行。不得通过忽略该用户文件或改checker来通过；保持它并在当前候选重跑。母本和冻结CI Skill均保持。B-Q源头由主Codex完成两遍审计：第1遍从原生fatal找出旧文字顺序，绑定原法/BP/Owner及两个现役consumer；第2遍从实际finally回复、原槽/ACK/drain及mutant结果需求反查，原合法基线与四个必须拒绝反例已唯一裁定，原预算可承载（inspector函数33行/复杂度15，原验收函数62行）。不更改法案语义、wire、schema、Owner或生产链；可以进入这两个授权完整文件的物理删除重建。此前建设审查不延用为新候选放行。


B-Q两文件已按delete→ABSENT→Add重建；主自检第1遍核所有函数的原结构预算无超限，第2遍反查原ACK/receipt/token/drain/readgate检查和全部旧mutant字节保留。原rule-mutants真实入口退出0（browser rule mutants and durable identities exercised），合法基线与四种新增非法变体均核销。其它生产文件未改，最终建设总审及当前两仓原生CHANGE仍需重跑；本记录不输出quality verdict。

B-Q复查先后实际发现额外早发REPLY、括号字面量及tuple spread可绕过计数；原生产文件仅纯内存变体，磁盘不改。此前候选审查均不延用。本次选择复用原方法的封闭发送结构：整个executeCommand对原sender仅有诊断try与finally回复两处语义引用，原finally首句仍必须直接await原REPLY后退休，出现第三个sender引用由同一mutation-settlement finding拒绝；不建立参数展开解释器，不改变生产、法案、wire/schema/Owner或预算。主源头审第1遍绑定原LAW004/006与Browser BP的同命令原终局、事实先行；第2遍从当前sender方法声明和两个既有调用点反查ACK/drain/CAS及CODE001V6预算，合并候选的质量证据施工图要求static.ast不得以TypeChecker关系冒充，故只计原方法名称的Identifier/StringLiteral AST引用，删除参数类型计数。现役消费者和37个原入口反例已唯一裁定，可以按两原文件Delete→ABSENT→Add施工。保留全部原30个mutant及已发现的等价变体，新增spread/call/索引原sender的真实早发反例；主实现两遍自检、独立复审及当前Native CHANGE仍必须核销，本文不产生quality verdict。

授权范围更新：用户明确要求‘合并一起提交！一起ready’，两仓当前并行改动一并纳入各自main原生提交和READY候选；合并提交不授权覆盖并行文件或扩大代码重构片区。保留所有现有工作，不创建分支/worktree、不stash/reset或删除隐藏用户文件。先完成当前建设复审和两仓当前原生CHANGE，通过后各仓完整提交、核clean原生commit并一起执行READY，CI-FULL依冻结Skill继续；母本及冻结ci-full-governance Skill不改。

当前独立复审发现模板索引漏计第三处sender，主Codex随后真实复现valueOf取得原实例后模板索引也漏检（TypeChecker诊断确认同一sender，基线和非法变体finding均为零）。主源头第1遍回原LAW004/006与BP的唯一REPLY/原诊断两个发送点、质量证据BP的static.ast义务；第2遍反查当前executeCommand全部this仅直接访问本类AST属性声明或原sender，valueOf不属本类属性。复用同一AST引用计数，拒绝索引、实例转交和未声明成员，不解释模板/参数或建立类型引擎；保持fact→诊断→finally首句REPLY→退休、ACK/drain/CAS及全部其它检查。原入口保留全部40变体，补一个已复现的valueOf反例，目标41个、原验收函数73行可承载；两原文件已Delete→ABSENT→Add重建。主实现自检第1遍核48个函数原预算全部满足（原inspectReceiptConsumer39行/复杂度16，exerciseInspectors73行）；第2遍核原30反例、其它全部checker函数字节保留及新增等价变体，原rule-mutants入口41变体与合法基线退出0。独立复审尚须核销后才能继续当前原生质量流程。

READY 原生失败回接：AGENT f220fa465e8aca9e1b93eb527921620e762de191 的完整原始输出退出1，唯一报告39条法案中37通过、Browser001/002两条失败；治理106例104通过、两例失败。三层鉴权已闭合：一公里绑定 Browser001/V4 transport AST、Browser002/V6原认证诊断及Runtime003/V44原provider正例；五公里纳入Browser004/V56原WAL/ACK、Browser006/V45原opaque identity、Log001–003原事件链、Code001/V6原结构与原质量证据BP，因为共享原诊断/terminal consumer、provider与native quality；十公里对当前双仓549条active法案、110 Manifest及10现役BP已完整读取的体系核对，两仓职责、母本、Owner、wire、schema、runtime/business事实与quality主权不变。只修复原因链的三处不一致：provider正例lawDomains仍写V43；原transport五方法AST参考的send/acceptReply仍是诊断前方法体；本轮Extension重建遗漏原commandIntentKind producer与原runtime传入，不能删除原必需检查来掩盖该实际遗漏。

本次唯一清场边界是上述C-QA/B-Q原quality-contract.test.ts与transport-inspector.ts，以及B已列出的extension-command-runtime.ts、websocket-command-diagnostic.ts、browser-authority-diagnostic.ts、local-browser-auto-pairing-support.ts。原正例对齐V44、五方法参考只对齐diagnostic:null与同reasonCode stage条件；14个混身份反例的语义不减，其中permitSequence锚点须包含已批准diagnostic:null，reply查表锚点须限定原acceptReply中的reply赋值，避免先命中新诊断查表；补初始化槽伪诊断与跨原因码错配两项反例。原runtime的原command-shape判据只接真实string的现役kind，物理删除String(candidate.kind)强制转换（数组['dom-intent']已实测会造成原失败诊断拒收）；再使用既有asRecord读intent.kind，缺失或畸形intent不能在原catch之后再次抛错；producer只发送原closed parser既有枚举允许的可选commandIntentKind。原browser-authority-diagnostic.ts的CONTROLLED_VALUES保持私有；唯一原commandIntentKind Set原位公开为BROWSER_DIAGNOSTIC_COMMAND_INTENT_KINDS，只供原parser与同Owner producer共同读取。删除整包公共object bag，不抄第二枚举、扩大值域或新增validator；同一原治理测试执行真实Extension admission失败入口，覆盖click保留intent、两个现役特殊kind不发送未准入intent、缺失/畸形intent仍返回原失败、数组kind在原command-shape处拒收而诊断可读；核REPLY与DIAGNOSTIC同code、原stage/kind/capability可读且Target调用0，无DOM或外部动作。两个source文件先由主Codex分别两遍审计再Delete→ABSENT→Add；六个实现文件随后按同纪律重建，完成主自检两遍与独立子审后原生CHANGE→clean main commit→READY。历史construction放行与失败READY不延用为当前候选通过，本记录不产生quality verdict。

补充候选子审未放行：真实入口证明acknowledgeKnownGptRateLimit/readKnownGptRateLimitClearance两种诊断值不在原closed枚举而引发拒收；dom-intent缺intent在catch后直接取kind再次抛TypeError、丢原失败回复。主Codex回源头两遍审计：第一遍绑定Browser002/V6非致命诊断、原parser的唯一枚举与现役command-registry实际kind；第二遍反查原失败REPLY、无Target访问、original code/cause及预算，只复用原asRecord和同Owner原commandIntentKind枚举，不增加类型推断、业务门禁、wire/持久字段、第二chain或新文件。共享原intent枚举若删除，producer须盲发或复制规则，会重现已实测拒收；这是当前唯一真实producer consumer，原parser全部值、函数与判据保持。另一个真实同根因反例是数组kind经String强转后仍保留数组，诊断不满足原字段类型；主Codex再次独自两遍源头审计，先核原typed kind和command-shape责任，再反查原失败REPLY与结构预算，删除强转、仅把原形状判据写实为string，复杂度16不超原预算，不增加独立判据。本次建设验收必须拒收上述旧坏链并读回click与两特殊kind、缺失/畸形intent的真实回复，原16个transport反例全部保留；当前原生结果不升级。

AGENT本次原生CHANGE完整退出1，唯一失败为原automatic pairing的originalCommandDiagnostics第106行仍断言合法click诊断无commandIntentKind；类型检查、67项适用治理用例与其它原生验收均通过，不抵销该失败。围绕同一故障三层鉴权闭合：直属Browser002/V6及当前BP要求合法原intent的非致命诊断；关联Browser001/004/006、Log001–003及Code001保全唯一帧/WAL/ACK/原因/预算；完整双仓权威与母本的Owner、等级、唯一quality主权保持。主Codex源头两遍审计分别从原生发送失败定位旧断言，再从真实解密诊断/closed parser读回原command.intent.kind反查；只重建B已列出的原auto-pairing support验收，把absence断言改为原parsed intent与原命令相等，原发送失败两分支、REPLY/slot/retirement及其它全部测试保持，不改生产或降低准入。重新两遍自检、独立子审后重跑CHANGE，旧结果不延用。

READY剩余Code003/V3收口：四条原生finding来自整包CONTROLLED_VALUES公开后，其余三个诊断属性无静态外部消费者及Object.entries动态遍历。只重建上述两个原诊断模块：整包恢复私有，原intent Set唯一声明由parser与producer直接消费；其余枚举、parser判据、原失败REPLY/WAL/ACK/日志、现役checker和测试完全保留。按Code001/002/003与Browser001/002、现役两施工图及完整双仓权威核对后，主Codex两遍源头审计先对齐本方案与Browser施工图，再整文件删除、验缺席、重建代码，两遍自检及子审后回到原生CHANGE、clean main commit、READY；只有当前READY通过并完成§79审查，才推送修复提交，不执行RELEASE或发布。

# GPT 聊天自动重命名—完整实现方案

## 0. 冻结状态

- 状态：`FROZEN_FOR_IMPLEMENTATION`
- 施工仓库：`/Users/nexgen/Documents/AGENT`
- branch：`main`（用户明确禁止分支/worktree施工）
- 基线：`406211abf3aa1bebfbcca6b8004946ddecf03057`
- authority：AGENT 与 Website 当前《法案系统建设说明书-冻结定稿版》、active law、manifest、registry、blueprint；已由主 Codex 各遍历两遍。
- 当前授权：只在证明不可删除时修改 AGENT 法案、施工图、代码、质检和现有 Browser WAL schema；Website 合同与数据库不改。

本文件是本需求唯一施工图。实现若偏离本文件的单 Child、单 Browser intent、单生命周期接点或非阻断边界，必须失败关闭。

## 1. 请求与完成定义

对以后每个已经取得 confirmed Provider effect 且结果已稳定 checkpoint 的 GPT conversation，在释放当前 Browser lease 前，最多尝试一次重命名：

```text
MMDD·项目短名·aiprod_<UUID首段八位>
```

`MMDD` 固定取该 conversation 已确认 Provider effect 的 `terminalAt`，按 `Asia/Dubai` 转换。标题仅是操作者可见索引，不是任务、conversation、claim、恢复、提交、结果或完成身份。

标题成功终点：同一 canonical conversation URL 对应的侧栏行，在一个有界 Browser compound mutation 后精确回读目标 NFC 标题。

业务成功终点不变：Website 接纳并持久化同一 `job_id + result_payload_hash`，且其现役 admission/readback 闭合。标题成功不能替代业务完成，标题失败不能改变业务完成。

## 2. 第一直接断裂

现役 GPT 只有 13 个业务 Child，没有稳定结果后的 cleanup-only 重命名责任；Browser 只接受单物理输入 DOM mutation，不能把真实页面所需的“打开菜单、点重命名、填标题、Enter”作为一个不可穿插的原子意图；生命周期稳定结果后直接 park。

真实 Chrome 同名回写已证明：

- 当前聊天行菜单按钮 accessible name：`打开“<title>”的对话选项`；
- 唯一菜单项：`重命名`；
- 编辑器：`input[aria-label="聊天标题"][name="title-editor"]`；
- Enter 后编辑器消失，同一 canonical URL 行可精确读回标题；
- 非相等标题的完整分母是 4 个物理输入；已相等为 0。

## 3. 唯一 Owner 与边界

- GPT Owner：唯一 Child `rename_settled_gpt_conversation`，拥有标题投影、输入校验、调用语义和 cleanup proof。
- Browser Owner：唯一 typed intent `renameExactGptConversation`，拥有真实 DOM 候选、4 步不可穿插执行、现役 WAL、terminal receipt 与 fresh postcondition。
- Lifecycle Owner：只由 `ProductionGptChildTools` 的一个内部 cleanup 函数消费；在已 settled conversation 因 session 切换或 Product 终结而进入原 park 前调用，不向 Product flow 暴露。
- Runtime Log：失败影响恒为 `CLEANUP`。
- Website：零改动；不拥有标题语义，不新增数据库字段、任务、队列或 admission 条件。

禁止 Product、Runtime 或 Website 复制项目短名映射、selector、重命名状态或重试逻辑。

## 4. 标题合同

当前 route projection 的 14 个 `product_id` 必须一一覆盖：

| product_id | 项目短名 |
| --- | --- |
| `bazi_ai_full_analysis` | 八字分析 |
| `bazi_chart_interpretation` | 八字解盘 |
| `bazi_report_followup` | 八字追问 |
| `hehun_ai_analysis` | 合婚分析 |
| `hehun_report_followup` | 合婚追问 |
| `localization_article_translation` | 本地化文章 |
| `localization_report_translation` | 本地化报告 |
| `localization_static_catalog` | 本地化文案 |
| `naming_bazi_analysis_and_naming` | 八字取名 |
| `naming_from_existing_bazi_report` | 报告取名 |
| `payment_screenshot_observation` | 支付核验 |
| `public_knowledge_article_pipeline` | 公知文章 |
| `qimen_professional_answer` | 奇门答问 |
| `qimen_report_followup` | 奇门追问 |

输入不满足以下任一条件就只生成 cleanup failure，不猜测、不截断、不回退：

- `jobId` 精确匹配 `aiprod_<UUID>`；
- `productId` 是上述现役 14 项之一；
- `terminalAt` 是规范 ISO 时间；
- canonical URL 是当前允许的 ChatGPT conversation URL；
- 目标标题是 NFC、无控制字符且不超过 128 Unicode code points。

同一工单的多个隔离 conversation 可以同名；唯一身份仍是 canonical URL 与 Browser authority，不增加第四段。

## 5. 单 Child 有限状态机

```text
PRECHECK
  ├─ 当前 URL/目标侧栏行不唯一、菜单或编辑器已处于残留态 → CLEANUP_FAILED(0)
  ├─ 当前标题已精确相等 → ALREADY_EXACT(0)
  └─ CURRENT_CHAT_READY
       → 打开当前行唯一菜单(1)
       → 点击唯一“重命名”(2)
       → 填入 exact targetTitle(3)
       → Enter 保存(4)
       → fresh canonical-row title readback
          ├─ exact → RENAMED
          └─ 非 exact → CLEANUP_FAILED
```

括号内是累计物理输入数。整个状态机只由一个 Browser command 执行；中间不得返回 GPT、不得调用其它 Child、不得导航或按标题选择 conversation。

## 6. 永不阻塞合同

1. active conversation 同时具有 confirmed effect 与 settled result hash 时即具备资格；在 session 切换或 Product 终结的原 park 前由 lifecycle 原子取走一次，取走后无论预算跳过、Child 失败、后续 park/Product 失败或 finally 重入都不得再次尝试；不具备资格则直接执行原 park。
2. 当前执行预算不足或 abort 已生效时跳过，不延长 Website lease。
3. Child 成功或失败都不进入 Product output、result parser、Outbox、Website write、result revision、Provider retry 或 `RESULT_SETTLED_UNUSABLE`。
4. Child 的结果失败、throw、timeout、DOM stale、transport unknown、日志/证据失败均在内部捕获，Runtime impact 为 `CLEANUP`，随后必须执行原 park。
5. Browser deadline 或 channel revocation 必须在每个下一物理输入前停止；deadline 后在 terminal grace 内仍返回冻结的 1/2/3/4 累计 receipt，只有 socket 真正失联导致未认证/缺失 terminal reply 时才以未知计数 0 原位终结为 `REJECTED + mutation_outcome=dispatched + BROWSER_COMMAND_RECEIPT_MISSING`，不重放且 pending 归零。
6. 精确 missing-reply 已撤销 transport 时，extension 的 socket-close cleanup 已释放 current target；lifecycle 仍进入一次原 park 边界以释放本地 lane，并把该已撤销 target 视为 park 完成，不得用随后必然出现的 liveness error 覆盖 Product 结果。除此以外的 park 失败仍按现役生命周期规则阻断。
7. 不增加持久重试、历史回扫、后台 worker、queue、ledger、fallback 或第二 Browser lane。

因此“永不阻塞”指不改变业务主链终态和下一工单可运行性，不承诺 Provider 标题最终必然成功。

## 7. 原子施工顺序

### WO-01：authority 原位升级

- 升级 `LAW-GPT-001`：增加唯一 cleanup Child、标题非权威、内部 lifecycle 尾部与 CLEANUP failure。
- 升级 `LAW-LOCAL-BROWSER-SESSION-004`：允许仅该 typed intent 在一个 Browser command 内执行 0 或精确 4 个物理输入。
- 升级 `LAW-LOCAL-BROWSER-SESSION-006`：wire 只新增该 intent 的 canonical URL、目标标题与短 timeout；不开放脚本、坐标或 caller selector。
- 对直接或传递依赖上述 lawId 的现役 AGENT laws 只做不可变版本与 dependency 引用重绑定；不得夹带新的语义条款。当前机械闭包为 `LAW-GPT-002` 与 `LAW-AGENT-PRODUCTION-RUNTIME-001/003/004/005/006/007/008`。
- 同步现有 manifest、GPT/Browser blueprint、inspector 期望与 generated registry。
- 不新增法案域、manifest、registry、blueprint 或 Website authority。

完成门：两次 projection/current 检查闭合，主 Codex 法案/施工图自检不低于 98%，才进入代码。

### WO-02：Browser 原子 intent 与 WAL

- 在现有 `BrowserDomIntent` union 新增一个 typed 分支；Extension 机械执行 4 步并返回一个 terminal receipt。
- 复用现有 DOM query、actionability、pointer、fill、keypress 和 postcondition primitive；不新增通用 eval 或第二 command bus。
- 现有 `physical_input_count` 原位从 `0..2` 扩到 `0..4`，为旧表执行单向、事务性 rebuild 并逐行保持；不新增列或表。
- terminal receipt 把 0..4 的真实计数写入同一 WAL；transport unknown 以无认证计数的 0 和 `mutation_outcome=dispatched` 表示未知，不伪造输入数。

### WO-03：唯一 GPT Child 与 lifecycle

- 新增 `children/rename_settled_gpt_conversation/**`，输入为 canonical URL、jobId、productId、confirmed terminalAt 与 2500ms timeout。
- `ProductGptTools` 的公开类型显式排除此内部 cleanup Child；`src/plugins/**` 不得出现调用。
- `ProductionGptChildTools` 只保留一个内部 cleanup 函数，在 settled session 切换与最终 settle 的原 park 前消费；固定内部 step/call identity，不进入 Product Child sequence。
- cleanup failure span 恒为 `CLEANUP` 并吞掉；原 park 始终执行。

### WO-04：质检

- GPT：14 个 Child/handler/contract 一一对应；公开 Product facade 不含 rename；14 个 product 映射穷尽；lifecycle 唯一调用点；失败不阻断。
- Browser：intent admission、0/1/2/3/4 receipt、WAL schema 迁移、exact readback、partial/unknown terminal、pending=0。
- 负向扫描：Product flow、Website contract/DB、第二 queue/store/lane、历史 sweep 均为零变化。
- 运行唯一原生 `npm run quality:check -- CHANGE`；clean commit 后运行 READY；按母本 §79 独立审查，再运行 RELEASE 所需动态证明。

## 8. 删除门禁

必须删除或拒绝新增：

- 每个 Product 各自的 rename 调用；
- prepare/menu/fill/enter 四个 GPT Child；
- rename queue、table、worker、retry、ledger、history sweep；
- Website title 字段或 admission 条件；
- 标题参与恢复、claim、去重、提交资格或完成判断；
- 兼容旧标题、双读/双写或 feature flag；
- 任意第二 Browser API、脚本执行面或 caller selector。

保留的每个新增对象都有当前消费者与验证：一个 GPT Child 被唯一 cleanup 函数在两个 park 出口消费；一个 Browser intent 被该 Child 消费；一个 WAL schema 原位迁移被该 intent 的真实 4 输入 receipt 消费；现有 inspector/acceptance 直接验收。

## 9. 终验

静态终验必须证明：单 Child、单 handler、单 Browser intent、单 lifecycle 调用、零 Product flow 调用、零 Website 改动、零第二链路。

动态终验至少证明：

1. 非目标标题经一次 compound command 变为目标标题并由同一 canonical URL 行精确回读，计数 4；
2. 已相等时零输入，计数 0；
3. 缠菜单、歧义、stale、保存未生效、transport unknown 和预算不足均为 cleanup terminal；
4. 失败后 pending mutation 为 0、lease 完成 park、下一工单仍可领取；
5. 开关 rename 前后 Provider submit 数、settled result hash、Outbox 与 Website admission/readback 完全相同。

READY 只证明发布候选闭合；只有 active law 要求的 Browser/Provider 与 Website admission/readback 动态证据完成后才可宣告 RELEASE。

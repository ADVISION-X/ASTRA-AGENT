---
name: agent-production-maintenance-loop
description: 对当前双仓工作树执行经授权的生产级 AGENT 内测维护闭环：允许在可归属、可固定的脏调试候选上，从网站正式产品入口依次运行现役十二个 Product Plugin 的十三条 primary 任务，监控 AGENT、Browser、GPT、回执和网站消费；故障时完成 Chrome 插件实证、联合结构化日志定责、片区删除重构、安全清理和受控复跑。用于迭代中的问题发现、修复和全量内测；不用于普通 CI、直接数据库删单、第二动态裁决或发布放行。
---

# AGENT 生产内测维护闭环

## 身份

本 Skill 是可独立触发的 Codex 仓库级维护编排说明。它不是 Product Skill、Product Plugin、Capability、scheduler、worker、数据库 Owner、日志 Owner、Browser Controller、Dynamic Proof Controller 或 quality verdict writer。

入口独立，主权不独立。只复用现役网站 sender、AGENT shared runtime、Browser Authority、Runtime Log Spine、数据库 Owner、领域消费者和网站唯一 Dynamic Proof Controller。不得把本 Skill 登记进 Product Catalog、Capability Manifest、App Shell skill registry 或跨仓 route policy；不得新增常驻服务、状态表、日志解析器、维护台账或第二裁决链。

本 Skill 的输出上限是维护观察与修复证据。内测成功不等于 `READY` 或 `RELEASE`。

## 每次先绑定现役合同与调试候选

1. 读取两个仓库各自最近的 `AGENTS.md`，分别记录 HEAD、Git 状态和当前工作树事实。
2. 在 AGENT 读取 active law、`docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md`、`src/lib/local-runtime/production/catalog.ts`、Browser Authority 与 Runtime Log Spine 现役合同。
3. 在 xuanxue-web 读取 active law、AI acceptance/provider 合同、正式产品 sender、consumer、数据清理 Owner，以及 `.agents/skills/xuanxue-dynamic-proof/SKILL.md` 引用的现役依赖。
4. 从 AGENT 唯一 Catalog 和跨仓 route policy 动态解析分母，不维护第二份产品清单。当前预期是 12 个 Plugin、13 条 primary、26 条 review、39 条 route；不匹配即 `DENOMINATOR_DRIFT`。
5. 逐项校验双仓 provider/dependency 字节、命令、schema、journey registry 和声明分母。缺文件、错误命令、版本或分母漂移即 `DYNAMIC_PROOF_DEPENDENCY_DRIFT`。

本 Skill 面向调试候选，不以 clean commit 或 CI-FULL 为启动条件。每个仓库在内存中绑定一份 `debug candidate`：HEAD、staged/unstaged diff 身份、相关 untracked 文件路径及内容身份、冲突状态、当前授权范围，以及实际运行进程/构建是否来自这些字节。不得为此新增持久台账或把 Git 身份写入设备/session 凭据。

工作树脏本身不是故障。把现有改动分为：本轮已授权改动、用户既有改动、来源不明改动。前两类在不覆盖他人内容的前提下可进入诊断和修复；来源不明但与目标片区无关时保留并继续，命中目标片区时先查明归属或使用隔离 worktree。无法读取内容、存在未解决 merge conflict、无法证明运行实例对应当前快照，才返回 `DEBUG_CANDIDATE_UNBOUND`。

每条真实任务发出前冻结该次快照。Skill 自己完成的获授权修复会产生下一版快照，这是正常候选演进，不是漂移；旧证据只属于旧快照。只有运行期间出现未授权并发改动、运行实例换版或快照无法重建，才是 `CANDIDATE_DRIFT`，暂停当前原子任务并重新绑定。

clean Git commit 是后续 READY、CI-FULL、提交和 RELEASE 的交接条件，不是本 Skill 发现和修复问题的准入条件。

## 授权分层

分别确认并记录以下授权，不得相互代替：

- 创建真实任务及其 GPT/Browser 外部动作；
- 每条 route 可能造成的文章发布、通知、交付、支付观察、用户记录或其他业务副作用；
- 修改 AGENT 或网站代码；
- 通过正式 Owner 清理任务私有材料或临时产物；
- 运行 READY、提交、部署或 RELEASE。

用户授权一次有限维护窗口时，仍须把上面五类授权逐项写入本次授权矩阵；“运行内测”不得推导出代码修改、材料清理或业务副作用授权。在候选不漂移、分母不变且停止条件未触发时，只执行矩阵明确包含的阶段。任何有限窗口都不包含改法案、改施工图、直接删数据库、绕过认证、提交、发布或无限重试。

## 运行模式

- `plan`：只生成绑定事实、分母、授权缺口、阻断项和执行顺序，不创建任务。
- `diagnose <job_id>`：只调查现有故障；不补发任务、不重放 Browser mutation。
- `run-one <product_id> <action_id>`：只运行一条现役 primary。
- `run-primary`：先处理会妨碍安全实测的前置故障，再按 Catalog 稳定顺序运行全部 13 条 primary。只跑 primary 的结论固定为 `MAINTENANCE_OBSERVATION_ONLY`；正式 RELEASE 仍须由唯一 Dynamic Proof Controller 覆盖全部 39 条 route。

进入 `run-one` 或 `run-primary` 前，读取 [references/live-run.md](references/live-run.md)。发生任何故障后，立即停止下一条任务并读取 [references/fault-repair.md](references/fault-repair.md)。

本 Skill 属于高影响维护程序，必须由用户显式使用 `$agent-production-maintenance-loop` 并给出运行模式。自然语言隐式匹配只能建议 `plan`，不得创建任务、操作 Browser/GPT、修改、清理或复跑。

## 已知问题是修复输入，不是启动门

每次从当前事实重新验证下列问题；存在时将其登记为本轮首批 finding 并进入诊断、定责和获授权修复，而不是因为系统“不干净”就结束 Skill：

- 网站产生 `RECONCILE_ONLY`，但 AGENT 生产链不能消费 Browser 只读对账证据；
- Browser `logicalMutationId` 不严格绑定 active law 要求的 job、plugin step、action ordinal 和 request hash；
- 网站 Dynamic Proof Skill 引用缺失文件、错误命令或过期 receipt schema；
- 13 条 primary 仍只是外部 receipt 占位，未进入现役 Dynamic Proof 声明分母；
- 缺少正式任务清理 Owner/API，或请求要求物理抹除审计事实。

其中，`RECONCILE_ONLY` 对账断链、mutation 身份错误或缺失该 route 必需的正式清理能力，会使相关外部 mutation 不安全：先使用本地复现、状态机/性质测试、mutant 和现役只读 authority 完成修复，不发该真实任务；修复验证后更新 debug candidate，再继续 `run-one`/`run-primary`。Dynamic Proof 命令、schema 或声明漂移不阻止安全的 CHANGE 调试，但在修复前禁止 Dynamic Proof 交接、READY 或 RELEASE 结论。

只有缺少必要授权、唯一 Owner 无法确定、修复需要另行修改冻结 law/blueprint、目标片区与无法归属的用户改动重叠，或无法建立安全 Browser/数据清理边界时，才返回 `BLOCKED`。已知代码故障本身不得成为“永远不启动”的理由。

## 不可突破的安全边界

- 管理员使用专门的真实 QA 身份走各产品正式网站入口；不得借管理员权限跳过 subject、authentication、material、entitlement、consent 或领域 Owner 校验。
- `/admin/ai-acceptance` 只按现役能力用于观察、challenge、finding、triage 和人工决定；不得虚构成万能发单页，也不得从浏览器直接调用内部 service job API。
- Chrome 插件实证必须服从唯一 Browser Authority。不得附加第二控制器、操作人工页面、绕过登录/2FA/验证码/风控，或用截图、HTTP 200、heartbeat、listener 代替原子后置条件。
- `DISPATCHED` 或外部结果未知时，只能在原 Target/Document 上按冻结后置条件只读补核；不得刷新、关闭、重建、重发或广扫 selector。
- 只读补核本身不得改变任何状态或补造 provider receipt。只有现役 Browser reconciliation Owner 能依据原 Target/Document 的冻结正反后置条件生成独立、可追溯的 reconciliation record，并单调驱动 WAL 和网站 recovery：正向确认后恢复原 job，反向确认后按合同失败，未知结果在冻结 `delivery_deadline_at` 到期后失败关闭。Owner/入口未接通时返回 `DISPATCHED_RECONCILIATION_OWNER_UNAVAILABLE`。
- “片区删除+重构”只处理命中根因的 active slice，并物理删除其旧 consumer、wrapper、fallback、alias 和 dual path；不得保留兼容桥，也不得扩大成无关全仓重写。
- 不得修改冻结 active law 或 blueprint，除非用户另行明确授权该治理修改。
- 不得“无痕删除”生产任务。用户侧无残留必须与审计事实保留分开；没有正式清理 Owner 时返回 `CLEANUP_OWNER_ABSENT`，要求物理抹除时返回 `UNSUPPORTED_BY_ACTIVE_LAW`。

## 有限循环与停止条件

每个 debug candidate 对同一真实任务最多允许首次执行加一次修复后复跑，防止外部副作用循环；达到预算后停止真实动作并回到本地诊断，不得自动反复发单。满足任一条件时暂停当前原子任务，不进入下一产品：

- 同一根因在修复后真实复跑中再次出现；
- Browser `DISPATCHED`、外部副作用或原 Target/Document 未闭合；
- 只读补核超过冻结 `delivery_deadline_at`，或现役 reconciliation Owner/落地入口不可用；
- 联合诊断不是 `DIAGNOSIS_COMPLETE`；
- 出现未授权的候选、合同、产品分母或授权漂移；
- 认证、2FA、验证码、风控、配额或人工页面介入；
- 清理、lease/fence、Outbox、Target 或网站 consumer 未收口；
- 同一 QA 身份和 route 已有 active、recovery pending 或结果未知任务；
- 修复需要改冻结 law/blueprint，或会覆盖来源不明且无法隔离的用户改动。

暂停真实动作不等于终止调试。仍可在授权范围内继续读取证据、本地复现、修复和聚焦验证；再次执行真实任务需要新的已绑定快照、未解决外部副作用为零，并重新满足该 route 的动作授权和预算。

## 最终报告

用一份简洁报告逐条列出：双仓候选、授权范围、动态分母、每条 primary 的 job/source/request 身份、全链终态、用户页面结果、Browser/Target 清理、故障根因与唯一 Owner、实际修改片区、验证、清理状态、新任务复跑结果、未证明项和 claim ceiling。

只允许以下维护结论：

- `BLOCKED`：前置、授权、authority、诊断或清理未闭合；
- `FAULT_LOCALIZED`：联合诊断闭合，但未完成修复；
- `CHANGE_VERIFIED`：修复与聚焦验证完成，只证明 CHANGE；
- `MAINTENANCE_OBSERVATION_ONLY`：13 条 primary 的本轮用户旅程观察完成，不是 READY/RELEASE。

不得输出 `PASS`、`READY`、`RELEASE`、`GO` 或 `NO_GO`。正式质量结论只能由现役唯一治理门和 Dynamic Proof Controller 产生。

---
name: agent-production-maintenance-loop
description: 对当前双仓工作树执行经授权的生产级 AGENT 内测维护闭环：允许在可归属、可固定的脏调试候选上，从网站正式产品入口依次运行现役十二个 Product Plugin 的十三条 primary 任务，监控 AGENT、Browser、GPT、回执和网站消费；故障时保留原网站任务，完成 Browser Authority 生产证据、Codex Chrome 受控原子诊断、联合结构化日志定责、片区删除重构、执行资源清理和原任务恢复，直到成功交付并入库。用于迭代中的问题发现、修复和全量内测；不用于普通 CI、直接数据库删单、第二动态裁决或发布放行。
---

# AGENT 生产内测维护闭环

## 身份

本 Skill 是可独立触发的 Codex 仓库级维护编排说明。它不是 Product Skill、Product Plugin、Capability、scheduler、worker、数据库 Owner、日志 Owner、Browser Controller、Dynamic Proof Controller 或 quality verdict writer。

入口独立，主权不独立。只复用现役网站 sender、AGENT shared runtime、Browser Authority、Runtime Log Spine、数据库 Owner、领域消费者和网站唯一 Dynamic Proof Controller。不得把本 Skill 登记进 Product Catalog、Capability Manifest、App Shell skill registry 或跨仓 route policy；不得新增常驻服务、状态表、日志解析器、维护台账或第二裁决链。

本 Skill 的输出上限是维护观察与修复证据。内测成功不等于 `READY` 或 `RELEASE`。

本文严格区分三个对象：GrassEye Chrome 扩展是受控执行 AGENT 生产页面动作的物理适配器；Browser Authority 是唯一生产动作许可、Target/Document、mutation 与对账合同，不等于扩展本身；Codex Chrome 是操作者 Chrome 的诊断能力，不是生产 Browser Controller、不能写生产 receipt，也不能替代 Authority。生产任务存续期间只能由前两者完成生产 mutation；安全收口后，Codex Chrome 只可按故障参考中的受控人工复现路径诊断真实 GPT 页面。

## 唯一任务完成定义

必须把三层事实分开，禁止压成一条状态链：

1. 网站业务任务只有同一个已接受任务成功取得 AGENT 交付结果、通过网站正式结果准入并由领域 consumer 幂等入库，才算完成。用户页面可见结果、成功 receipt、入库记录及其 job/source/request 身份必须相互一致；缺任何一项都仍是未完成任务。
2. 每个 AGENT attempt 必须明确闭合为 `success` 或 `failed`。Browser mutation 可以保留外部结果未知的证据，但 attempt 不能因此保持含糊或冒充任务结果；`failed` 只说明本次执行阵亡。
3. attempt 失败后只能作出“获准有限重试”“只读对账”或“停车等待修复”之一的内部处置。处置决定不是第三种 attempt 结果，也不是网站任务终态。

`attempt`、Browser mutation、lease、Target 和一次运行可以失败或结束，网站任务不能因这些失败变成任务终点。任何执行失败都只生成故障现场和恢复输入：冻结证据、停止不安全的新 mutation、按 Website 持久策略处置、修复并恢复原任务。不得把 attempt failure 映射成网站任务完成或永久失败，不得删除、复制、替换原任务，也不得用新 `job_id` 绕过故障。若当前授权或动作预算耗尽，只暂停恢复并报告阻断；原任务仍未完成。

本 Skill 的 `BLOCKED`、`FAULT_LOCALIZED` 或 `CHANGE_VERIFIED` 是维护过程结论，不是网站任务终态。只有“成功交付并入库”可以关闭该 route；按正式合同停车并释放容量的故障任务不得被计为完成，也不得阻塞已证明不属于同一故障片区的健康任务。

自动重试预算、已用次数、下一次允许时间、停车/放行和故障片区熔断必须由 Website 侧一份可跨 AGENT 重启、设备和 debug candidate 保存的持久事实授权；AGENT 只上报故障情报、checkpoint、外部动作事实和 `safe_to_retry` 判断。具体次数、熔断阈值和 Website 内部唯一 Owner 尚未由会议冻结，Skill 不得写死 `3`、`5` 或自建本地计数器；读不到唯一现役策略时禁止自动重试，记录 `WEBSITE_RETRY_POLICY_OWNER_UNRESOLVED` 并停车当前故障片区。

若 active law、blueprint、schema、quality gate 或现役代码仍把执行失败映射为网站任务终点，必须将该冲突失败关闭并请求对应治理层的单独修改授权；不得在 Skill 中加兼容桥、双轨状态或 replacement job 掩盖冲突。

## 每次先绑定现役合同与调试候选

1. 读取两个仓库各自最近的 `AGENTS.md`，分别记录 HEAD、Git 状态和当前工作树事实。
2. 在 AGENT 读取 active law、`docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md`、`src/lib/local-runtime/production/catalog.ts`、Browser Authority 与 Runtime Log Spine 现役合同。
3. 在 xuanxue-web 读取 active law、AI acceptance/provider 合同、正式产品 sender、consumer、数据清理 Owner、任务重试/停车/片区熔断的持久事实与 Owner，以及 `.agents/skills/xuanxue-dynamic-proof/SKILL.md` 引用的现役依赖。
4. 从 AGENT 唯一 Catalog 和跨仓 route policy 动态解析分母，不维护第二份产品清单。当前预期是 12 个 Plugin、13 条 primary、26 条 review、39 条 route；不匹配即 `DENOMINATOR_DRIFT`。
5. 从现役 GPT capability contract、唯一公共执行器和全部消费者反查页面执行分母。当前目标是 [references/live-run.md](references/live-run.md) 第 2 节列出的 22 项公共子能力；3 项 Browser Authority 边界能力和 Runtime checkpoint/recovery 职责都不计入该分母。仍为 44 项、Product Plugin 仍复制 `gpt_flow` 页面步骤，或保留退出项、alias、兼容映射时记为 `GPT_PUBLIC_CAPABILITY_DENOMINATOR_DRIFT`。
6. 逐项校验双仓 provider/dependency 字节、命令、schema、journey registry 和声明分母。缺文件、错误命令、版本或分母漂移即 `DYNAMIC_PROOF_DEPENDENCY_DRIFT`。

本 Skill 面向调试候选，不以 clean commit 或 CI-FULL 为启动条件。每个仓库在内存中绑定一份 `debug candidate`：HEAD、全部 staged/unstaged diff 身份、现役构建/运行/配置发现链可达的 untracked 或 ignored 输入及其安全身份、冲突状态、当前授权范围，以及实际运行进程/构建是否来自这些字节。secret、session 和设备凭据只按现役安全合同记录非明文身份，不得输出内容；无法证明运行闭包完整时返回 `DEBUG_CANDIDATE_UNBOUND`。不得为此新增持久台账或把 Git 身份写入设备/session 凭据。

工作树脏本身不是故障。把现有改动分为：本轮已授权改动、用户既有改动、来源不明改动。前两类可以进入运行和诊断；修改命中用户既有改动时，必须取得当前任务对具名文件或片区的明确授权，否则使用隔离候选并保留原工作树。来源不明但与目标片区无关时保留并继续，命中目标片区时先查明归属或使用隔离 worktree。无法读取内容、存在未解决 merge conflict、无法证明运行实例对应当前快照，才返回 `DEBUG_CANDIDATE_UNBOUND`。

每条真实任务发出前冻结该次快照。Skill 自己完成的获授权修复会在同一任务的两个 attempt 之间产生下一版快照，这是正常候选演进，旧证据只属于旧快照。从任务 accepted 到成功交付、领域入库和执行资源 cleanup 全部闭合期间，任何命中该任务运行、合同、构建或配置闭包的字节变化，无论是否已授权，都是 `CANDIDATE_DRIFT`；先按原 mutation/Target 事实安全收口，禁止边跑边换版。授权修改只能发生在两个 attempt 之间。

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
- `diagnose <job_id>`：只调查现有故障；不补发生产任务、不重放 Browser mutation。满足故障参考的安全收口和新授权条件时，可执行一次受控 Codex Chrome 人工复现。
- `run-one <product_id> <action_id>`：只运行一条现役 primary。
- `run-primary`：先处理会妨碍安全实测的前置故障，再按 Catalog 稳定顺序运行全部 13 条 primary。只跑 primary 的结论固定为 `MAINTENANCE_OBSERVATION_ONLY`；正式 RELEASE 仍须由唯一 Dynamic Proof Controller 覆盖全部 39 条 route。

进入 `run-one` 或 `run-primary` 前，读取 [references/live-run.md](references/live-run.md)。发生任何故障后，立即停止下一条任务并读取 [references/fault-repair.md](references/fault-repair.md)。

联合日志只负责证明失败边界是否闭合，不自动证明页面原子根因。诊断报告必须分别给出 `failure_boundary_complete` 和 `atomic_native_cause_complete`；Browser/GPT 故障缺少真实 Chrome 原子证据时，后者必须为 `false`，不得修改 selector/后置条件或输出 `FAULT_LOCALIZED`。

故障修复后必须用更新后的 debug candidate 恢复同一个网站任务，先真实证明原问题已经解决，再完成成功交付和领域入库。恢复仍失败就保留新故障现场并继续根因循环，不得创建替代任务，也不得据此改写治理合同；原任务成功交付并入库后才执行后置 `WHY-HAPPEN`，检查法案、施工图、质检系统和执行入口为何没有预防或拦截该问题。经证明存在的治理缺口未修复并验证前，不得进入下一条 route。

`run-one` 和 `run-primary` 需要网站 `platform_system_operator` 登录会话；`plan` 不需要，`diagnose` 只有在必须读取管理员页面时才需要。涉及登录时先读取 [references/admin-auth.md](references/admin-auth.md)，不得在仓库内到处搜索、打印或复制账号密码。

本 Skill 属于高影响维护程序，必须由用户显式使用 `$agent-production-maintenance-loop` 并给出运行模式。自然语言隐式匹配只能建议 `plan`，不得创建任务、操作 Browser/GPT、修改、清理或恢复生产执行。

## 已知问题是修复输入，不是启动门

每次从当前事实重新验证下列问题；存在时将其登记为本轮首批 finding 并进入诊断、定责和获授权修复，而不是因为系统“不干净”就结束 Skill：

- 网站产生 `RECONCILE_ONLY`，但 AGENT 生产链不能消费 Browser 只读对账证据；
- Browser `logicalMutationId` 不严格绑定 active law 要求的 job、plugin step、action ordinal 和 request hash；
- 网站 Dynamic Proof Skill 引用缺失文件、错误命令或过期 receipt schema；
- 13 条 primary 仍只是外部 receipt 占位，未进入现役 Dynamic Proof 声明分母；
- 缺少正式执行资源清理 Owner/API，或请求要求物理抹除审计事实。
- GPT 公共子能力仍是 44 项，Product Plugin 仍复制厂商页面步骤，或已经退出的 title、search、fork 和旧 profile child 仍进入当前十二产品正常路径；
- 安全原子步骤没有逐步 checkpoint，重启没有先读 step checkpoint、Browser WAL 和当前 Document，一次页面后置失败会直接终结网站任务，或恢复流程创建新 job 替代原任务。
- Website 没有唯一持久的重试预算、退避、停车/放行和故障片区熔断 Owner，AGENT 重启或换设备会重置次数，或停车任务仍占用 lease、Browser/continuation lane 和业务容量。

其中，`RECONCILE_ONLY` 对账断链、mutation 身份错误、相关 route 仍会执行退出的 GPT 页面步骤、缺少逐步 checkpoint/recovery，或缺失该 route 必需的正式清理能力，都会使相关外部 mutation 不安全：先使用本地复现、状态机/性质测试、mutant 和现役只读 authority 完成修复，不发该真实任务；修复验证后更新 debug candidate，再继续 `run-one`/`run-primary`。只有在本次事故发生前已经独立确认且与当前故障逃逸无关的 Dynamic Proof 命令、schema 或声明漂移，才可与安全实测并行修复；当前故障为何逃逸的法案、施工图、质检系统和入口修复必须等待原任务成功交付并入库。所有证据治理缺口在修复前都禁止 Dynamic Proof 交接、READY 或 RELEASE 结论。

只有缺少必要授权、唯一 Owner 无法确定、修复需要另行修改冻结 law/blueprint、目标片区与无法归属的用户改动重叠，或无法建立安全 Browser/数据清理边界时，才返回 `BLOCKED`。已知代码故障本身不得成为“永远不启动”的理由。

## 不可突破的安全边界

- 管理员使用专门的真实 QA 身份走各产品正式网站入口；不得借管理员权限跳过 subject、authentication、material、entitlement、consent 或领域 Owner 校验。
- `/admin/ai-acceptance` 只按现役能力用于观察、challenge、finding、triage 和人工决定；不得虚构成万能发单页，也不得从浏览器直接调用内部 service job API。
- AGENT 生产页面 mutation 只能由 GrassEye Chrome 扩展在唯一 Browser Authority 许可下执行。Codex Chrome 不得认领生产 Target、写 WAL/receipt、竞争控制权，或在生产任务未安全收口时点击、刷新、导航、关闭或重建页面。
- Codex Chrome 操作真实登录 GPT 页面只允许用于 [fault-repair.md](references/fault-repair.md) 定义的单次受控人工复现；该动作不是原任务生产恢复，不得生成网站成功回执、入库、发布、通知、支付或冒充生产证据。任何路径都不得绕过登录、2FA、验证码或风控，也不得用截图、HTTP 200、heartbeat、listener 代替原子后置条件。
- `DISPATCHED` 或外部结果未知时，只能在原 Target/Document 上按冻结后置条件只读补核；不得刷新、关闭、重建、重发或广扫 selector。
- 只读补核本身不得改变任何状态或补造 provider receipt。只有现役 Browser reconciliation Owner 能依据原 Target/Document 的冻结正反后置条件生成独立、可追溯的 reconciliation record，并单调驱动 WAL 和网站 recovery：正向确认后恢复原 job，反向确认后结束当前 attempt，未知结果在冻结 `delivery_deadline_at` 到期后关闭本次 reconciliation；后两者都把原任务留在恢复状态，不得写网站任务失败终点。Owner/入口未接通时返回 `DISPATCHED_RECONCILIATION_OWNER_UNAVAILABLE`。
- 每个安全原子步骤完成后必须先持久化 `flow version + step index + input hash + proof + mutation state + canonical document identity` 再进入下一步。重启先联合读取该 checkpoint、Browser WAL 和当前 Document，只观察、对账或执行第一个尚未完成且仍获授权的动作；不得整轮重放 upload、submit 或 media download。
- `recovery_pending`、`review_required`、`failed` 只描述当前 attempt 或故障处置。单次动作、后置观察或全部 attempt 失败都不得终结网站任务；任务保持未完成，继续等待修复、恢复授权或必要人工处理，直到成功交付并入库。
- 每次 `failed` attempt 在选择处置前必须形成故障情报包，至少含任务/Plugin/version、attempt/lease/checkpoint、时间与步骤、稳定错误码和根因 Owner、外部动作状态、日志/WAL/回执/hash、已用重试次数、当前容量占用，以及为何可重试、只能对账或必须停车。不得用 HTTP 状态或异常字符串代替。
- 停车只停止该任务的自动执行；必须先保存情报，由正式 reconciliation Owner 将外部动作确认、拒绝，或在预算/期限后封存为“结果未知且永不重放”，再安全释放 lease/fence、worker slot、业务容量及不再需要的 Browser/continuation lane。释放不得破坏 checkpoint、WAL 和后续只读尸检依据。停车不删除任务或最终交付义务。相同 Plugin/version/稳定错误反复击倒多个任务时只隔离该故障片区，健康片区继续；阈值和放行仍只认 Website 持久策略。
- “片区删除+重构”只处理命中根因的 active slice，并物理删除其旧 consumer、wrapper、fallback、alias 和 dual path；不得保留兼容桥，也不得扩大成无关全仓重写。
- 不得修改冻结 active law 或 blueprint，除非用户另行明确授权该治理修改。
- 不得“无痕删除”生产任务。用户侧无残留必须与审计事实保留分开；没有正式清理 Owner 时返回 `CLEANUP_OWNER_ABSENT`，要求物理抹除时返回 `UNSUPPORTED_BY_ACTIVE_LAW`。

## 有限循环与停止条件

每次准备生产 Authority mutation 前，都从 Website 唯一持久 Owner 重新读取原任务的处置类别、累计 attempt、剩余重试预算、`next_retry_at`、停车/放行和故障片区熔断事实；AGENT 本地进程、用户重新调用 Skill、新 candidate、重启或换设备都不得清零。只有“未发生外部动作的可恢复临时故障”且 Website 明确授权剩余预算时，才能按持久退避恢复；`DISPATCHED` 结果未知只能按有限预算只读对账；identity、合同、权限等确定性冲突第一次就停车。授权不完整、策略/Owner 缺失或预算耗尽时停止自动 mutation，但不停止安全收口后的诊断、修复和聚焦测试。受控 Codex Chrome 人工复现仍使用故障参考中的独立一次性诊断授权，既不消耗也不补充生产重试预算。满足任一条件时停车当前任务或故障片区，不把它记为完成：

- Website 拒绝重试、剩余预算为零、尚未到 `next_retry_at`，或停车/片区熔断尚未正式放行；
- identity、合同、授权、Plugin/checkpoint version 等确定性冲突；
- Browser `DISPATCHED`、外部副作用或原 Target/Document 未闭合；
- 只读补核超过冻结 `delivery_deadline_at`，或现役 reconciliation Owner/落地入口不可用；
- `failure_boundary_complete=false`，或需要原子根因的故障仍为 `atomic_native_cause_complete=false`；
- 出现未授权的候选、合同、产品分母或授权漂移；
- 认证、2FA、验证码、风控、配额，或未满足受控人工复现条件的操作者页面介入；
- 清理、lease/fence、Outbox、Target 或网站 consumer 未收口；
- 原故障已真实复证解决，但后置 `WHY-HAPPEN` 尚未闭合；
- 除当前恢复对象以外，同一 QA 身份和 route 已有 active、recovery pending 或结果未知任务；
- 修复需要改冻结 law/blueprint，或会覆盖来源不明且无法隔离的用户改动。

暂停生产动作不等于任务终止或调试结束。当前 attempt 已停止、没有未决 mutation，且其 Target、lease、lane 与 Outbox 已安全收口后，原网站任务保持 Website 现役合同定义的未完成停车/恢复状态；仍须在授权范围内继续 Chrome 诊断、本地复现、修复和聚焦验证。恢复原任务需要新的已绑定快照、未解决外部副作用为零、Website 正式放行和该 route 的生产动作授权；不得创建新任务、在 AGENT 本地解封，或因新 candidate/新调用自动恢复预算。停车任务释放容量后，`run-primary` 可以继续不共享故障 Owner、Plugin/version、合同或运行片区的健康 route，但总报告必须保留未完成分母，不能输出全量观察完成。

## 最终报告

用一份简洁报告逐条列出：双仓候选、授权范围、产品 route 分母、GPT 公共 22 项分母及退出项、每条 primary 的原 job/source/request 身份、全部 attempt 及二元结果、最后完成的 step checkpoint、Browser WAL/Document 恢复裁决、故障情报包、Website 累计次数/剩余预算/`next_retry_at`/停车与片区熔断事实、容量是否释放、处置及理由、成功交付 receipt、领域入库证据、用户页面结果、Browser/Target 清理、`failure_boundary_complete`、`atomic_native_cause_complete`、故障根因与唯一 Owner、实际修改片区、验证、原任务恢复结果、后置 `WHY-HAPPEN` 的逃逸层与闭合证据、未证明项和 claim ceiling。

只允许以下维护结论：

- `BLOCKED`：前置、授权、authority、任一诊断条件或清理未闭合；失败 action 已知但 `atomic_native_cause_complete=false` 时只能使用本结论并写明诊断缺口；
- `FAULT_LOCALIZED`：`failure_boundary_complete=true` 且 `atomic_native_cause_complete=true`，唯一原子根因和 Owner 已由原生证据固定，但尚未完成修复；
- `CHANGE_VERIFIED`：修复与聚焦验证完成，只证明 CHANGE；
- `MAINTENANCE_OBSERVATION_ONLY`：13 条 primary 的本轮用户旅程观察完成，不是 READY/RELEASE。

前三种结论下，原网站任务一律仍未完成；不得把维护报告写回为任务失败或完成。`MAINTENANCE_OBSERVATION_ONLY` 只在 13 个原任务分别成功交付并入库后成立。

不得输出 `PASS`、`READY`、`RELEASE`、`GO` 或 `NO_GO`。正式质量结论只能由现役唯一治理门和 Dynamic Proof Controller 产生。

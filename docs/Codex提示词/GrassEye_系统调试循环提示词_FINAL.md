你现在执行 GrassEye 真实系统调试闭环，不允许跳步，不允许直接凭感觉改代码。

当前项目最高原则：
1. 本地仓库是最高事实源，先确认 git 状态。
2. 真实运行日志是 runtime 问题最高证据。
3. 法案文件 + 施工图 + 执法系统是判断 P0 的依据。
4. 修复必须基于《系统调试根因记录.md》，不得绕过根因直接改代码。
5. 每轮修复完成后必须回到阶段A，重新启动系统、人工触发真实任务、重新分析最新日志。

启动前必须先执行并记录：

git status
git branch --show-current
git log --oneline -5
git rev-parse HEAD
git diff --stat
git diff --check

如果本地有未提交内容，不要自动覆盖，不要 reset，不要切分支，先记录当前状态。

============================================================
阶段A：真实日志采集 + 法案故事遍历 + P0根因固定
============================================================

阶段A只允许分析，禁止修复代码，禁止修改法案，禁止修改施工图，禁止修改 inspector，禁止生成 patch。

A-1：真实启动系统 + 人工触发任务

执行：

npm run grasseye:start

等待系统启动成功，必须看到至少以下链路：

dependency_check
update_preflight_check
map_package_readiness_check
local_ai_runtime_presence_check
local_ai_model_roster_check
local_ai_start_or_connect
local_ai_health_probe
ai_capability_readiness_gate
port_clear
app_server start
APP_SHELL_HEALTH_PASSED
open_console
mission_runtime_available
terminal_structured_log_relay
waiting_for_human_command

然后由人工在 Commander Console 真实触发一个任务，不允许 mock，不允许直接调用内部函数，不允许测试文件替代。

任务触发后，尽量完整捕获直到任务进入以下任一状态：

MISSION_FINALIZED
MISSION_REVIEW_REQUIRED
MISSION_FAILED
MISSION_STOPPED
或明确卡死/超时/无后续事件

把本轮完整终端日志全文写入：

《系统调试日志.md》

不得只复制最后几行。
不得用旧日志覆盖。
不得用模拟日志替代。

A-2：遍历相关法案文件 + 故事情节 + 执法系统

必须读取并对照：

.github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.md
.github/instructions/cursor-rules/grasseye-index.instructions.md
.github/instructions/cursor-rules/modules/**
docs/法案辅助文件/**
scripts/audit/generated/ci-full-summary.json
scripts/audit/generated/audit-plan.generated.json
scripts/audit/generated/enforcement-matrix.generated.*
scripts/audit/phase-gates/**
scripts/audit/domains/**/manifest.json
scripts/audit/domains/**/inspector.ts
scripts/audit/domains/**/owner-inspection-harness.ts
src/**

必须重建当前故事链：

Human
→ Commander Console
→ Nerve Bus
→ Orchestration
→ frozen map / activation snapshot
→ Nerve Bus step dispatch
→ ability group execution
→ Post-action Verification
→ transition evaluation
→ Forensics persistence
→ mission terminal state / human review

A-3：从《系统调试日志.md》中找出所有 P0 / P1 / P2

必须先建立 runtime timeline，至少检查这些事件是否出现、顺序是否正确、字段是否一致：

HUMAN_COMMAND_VALIDATED
MISSION_READINESS_CHECK_STARTED
MISSION_PREFLIGHT_STARTED
MISSION_PREFLIGHT_PASSED / FAILED
COMMANDER_COMMAND_ENVELOPE_BUILT
NERVE_BUS_ENVELOPE_CREATED
NERVE_BUS_DISPATCH_STARTED
NERVE_BUS_RESULT_ENVELOPE_RECEIVED
NERVE_BUS_RESULT_SEMANTIC_GATE_PASSED
NERVE_BUS_TRANSFER_PROOF_BUILT
COMMAND_ACCEPTED / COMMAND_REJECTED
ORCHESTRATION_START_RECEIVED
MISSION_ACTIVATION_SNAPSHOT_FROZEN
MAP_STEP_SELECTED
STEP_PRECONDITION_CHECKED
STEP_DISPATCH_STARTED
CAPABILITY_CALL_STARTED
CAPABILITY_CALL_COMPLETED / FAILED / REVIEW_REQUIRED
POST_ACTION_VERIFICATION_STARTED
POST_ACTION_VERIFICATION_PASSED / FAILED / REVIEW_REQUIRED
STEP_TRANSITION_EVALUATED
FORENSICS_RECORD_WRITE_REQUESTED
FORENSICS_RECORD_WRITTEN
MISSION_FINALIZED / MISSION_REVIEW_REQUIRED / MISSION_FAILED / MISSION_STOPPED

如果事件缺失，写：

LOG_EVENT_MISSING

并判断原因：

1. 系统没有执行到该阶段。
2. 执行了但没有结构化日志。
3. 事件命名不规范。
4. traceId/runId/ref 缺失导致无法关联。
5. 代码路径被提前 return / catch / swallow。
6. Forensics 或 terminal relay 丢失后续事件。

本轮重点必须检查以下 P0候选，不得忽略：

P0候选-1：
traceId / runId / missionId / commandId / envelopeId 是否中途换轨。
尤其检查是否出现 traceId=A 但 runId=B 的混合链。

P0候选-2：
FORENSICS_RECORD_WRITE_REQUESTED / FORENSICS_RECORD_WRITTEN 是否重复写同一事件。
必须检查是否有 recordId、idempotencyKey、eventId、sourceRef 去重。
如果没有去重证明，记录为 P0 或 P1，并说明依据。

P0候选-3：
Nerve Bus 是否只有 dispatch started，但缺少 result envelope / semantic gate / transfer proof。
如果执行了但日志没有证明，也要记录为 P0候选。

P0候选-4：
CAPABILITY_CALL_COMPLETED success 之后是否继续出现 STEP_TRANSITION_EVALUATED、PAV、mission terminal。
如果没有，判断是日志截断、mission loop 停止、transition evaluator 未触发、PAV policy 未接入，还是 Forensics 没记录。

P0候选-5：
COMMAND_ACCEPTED 是否被多层重复输出，是否可能被 UI 或上游误判为 mission success。
COMMAND_ACCEPTED 只能表示 command 被接收，不能表示任务成功。

P0候选-6：
open ability 返回 success 时，是否有 URL、browserProfileRef、target page、open proof、page-state handoff、ownerResponsible、actionableMessage。
如果 open success 没有可复盘 proof，记录为 P0候选或 P1。

A-4：固定根因，写入《系统调试根因记录.md》

每个问题必须按以下格式写，不得只写概括：

## BLOCKER-N：一句话标题

### 1. 严重级别
P0 / P1 / P2

### 2. 日志证据
粘贴《系统调试日志.md》中的原始日志片段。

必须逐项填写：

traceId：
runId：
missionId：
commandId：
envelopeId：
attemptId：
taskTemplateId：
requestedPlatformId：
selectedMapId：
activationSnapshotRef：
stepId：
abilityGroupId：
childCapabilityId：
ownerResponsible：
status：
failureReason：
actionableMessage：
refs：

字段不存在就写 MISSING，不得脑补。

### 3. 实际行为
系统真实发生了什么。

### 4. 法案要求
文件：
lawId：
主题：
要求：
禁止项：
当前违反点：

如果没有找到对应法案，写 LAW_GAP_CANDIDATE，但本阶段不得修改法案。

### 5. 施工图要求
文件：
章节：
要求：
当前违反点：

如果施工图缺细节，写 BLUEPRINT_DETAIL_GAP，但本阶段不得修改施工图。

### 6. 生产根因定位
文件路径：
函数 / class / route：
关键代码链路：
为什么导致当前问题：

必须定位到生产文件，不得只写“可能是 Orchestration”。

### 7. 执法缺口定位
owner inspector：
real-code-inspection：
manifest：
audit script：
当前是否覆盖：
为什么没有提前拦住：

### 8. 为什么没拦住
归类为以下之一或多个：

A. 法案缺失
B. 施工图细节缺失
C. 法案存在但 inspector 未覆盖
D. inspector 只做 grep/includes/regex，缺 AST/symbol/import graph
E. inspector 只覆盖 happy path，缺 real-code-inspection
F. real-code-inspection 没有生产代码突变验证
G. warning-only / fake PASS / skip / 豁免
H. runtime 日志字段不足导致不可判定
I. 生产代码绕过 governed public interface
J. 其它，必须说明

### 9. 修复层级建议
修生产代码：
修施工图：
修 inspector：
修 real-code-inspection：
修结构化日志：
是否需要申请改法案：YES / NO

阶段A最终必须输出：

《系统调试根因记录.md》

并在终端最后只输出：

PHASE_A_ROOT_CAUSE_READY

如果缺真实日志，输出：

BLOCKED_MISSING_REAL_RUNTIME_LOG

如果无法定位生产根因，输出：

PHASE_A_ROOT_CAUSE_NOT_READY

============================================================
阶段B：按根因修复代码 + WHY + 防复发
============================================================

阶段B必须先读取：

《系统调试根因记录.md》

如果文件不存在，立即停止，输出：

BLOCKED_MISSING_ROOT_CAUSE_RECORD

阶段B只修《系统调试根因记录.md》里的 P0。
P1/P2 进入 backlog，除非它阻碍 P0 判断。

B-1：为每个 P0 建立 FIX 卡

## FIX-N

对应 BLOCKER：
根因文件：
根因函数：
违反法案：
违反施工图：
最小修复策略：
为什么这是根因：
为什么修后不会复发：
需要补哪个 inspector：
需要补哪个 real-code-inspection：
需要补哪个结构化日志字段：

B-2：修复原则

只允许最小修复，不许扩大架构。
不许改法案。
不许为了过 CI 降低校验。
不许 suppress、ts-ignore、eslint-disable、any 逃逸。
不许手写 generated 文件。
不许新增第二套 runtime。
不许新增旧 owner。
不许让 debug-loop 成为运行链。

对于 owner-local implementation 小文件，如果根因已经固定，优先物理删除后重构，保持 public API 不变。
但以下文件不得随便删除重构：

public contract
schema source of truth
generated 文件
法案文件
冻结基线
manifest
registry source-of-truth

B-3：必须解释 WHY

每个 FIX 必须写：

1. 为什么旧代码会产生该日志问题。
2. 为什么新代码从结构上消除了问题。
3. 为什么不是补丁式掩盖。
4. 为什么不会破坏能力组主权。
5. 为什么不会引入第二条链。
6. 为什么不会让 COMMAND_ACCEPTED 被当成 mission success。
7. 为什么 traceId/runId 链路会稳定。
8. 为什么 Forensics 不会重复污染账本。
9. 为什么 Nerve Bus result/proof 有可见证明。
10. 为什么 capability completed 后会继续 transition/PAV/terminal。

B-4：防复发

每个 P0 修复必须补至少一个防复发点：

1. owner inspector AST / symbol / import graph 检查。
2. structured log semantic check。
3. real-code-inspection 生产突变验证。
4. anti-escape 检查。
5. owner evidence field completeness 检查。

不得只加普通测试文件。
不得只靠人工说明。
不得 warning-only。

B-5：生产突变验证

每个 P0 必须做一次真实生产文件突变验证：

1. 临时制造该问题的最小错误。
2. 运行对应 audit / inspector。
3. 必须 FAIL。
4. 保存 fail 输出。
5. 回滚突变。
6. 再运行，必须 PASS。

保存到：

tmp/debug-loop/regression-proofs/<BLOCKER-N>/
├── regression-description.md
├── mutated-file.patch
├── inspector-fail-output.txt
├── re-inspect-proof.txt
├── inspector-pass-output.txt
└── proof-summary.md

B-6：运行静态命令

按 package.json 实际存在 scripts 执行：

npm run ci:full
npm run ci:full
npm run typecheck
npm run lint
npm run ci:full
git diff --check

如果某个命令不存在，列出实际 scripts，不得伪造。

如果 audit fail-fast 卡在非本轮 owner，不得假装通过，记录到：

tmp/debug-loop/fix-verification/non-current-owner-ci-blockers.md

B-7：输出修复报告

写入：

《系统调试修复记录.md》

每个 FIX 必须包含：

修了哪些文件：
为什么是根因修复：
防复发补在哪里：
突变验证结果：
静态命令结果：
仍未解决的问题：
下一轮需要回到阶段A验证的点：

阶段B最后只允许输出：

PHASE_B_FIX_READY

或

PHASE_B_FIX_NOT_READY

============================================================
阶段C：回到阶段A，不允许跳过
============================================================

阶段C不是结束，而是强制回到阶段A。

C-1：重新启动系统

停止旧服务。
确认 127.0.0.1:4173 释放或由 startup port_clear 接管。
重新执行：

npm run grasseye:start

C-2：人工真实触发任务

不得 mock。
不得直接调内部函数。
不得只打开 console。
必须通过 Commander Console / 用户侧真实链路触发任务。

C-3：重新采集完整日志

把新日志全文覆盖写入：

《系统调试日志.md》

C-4：重新执行阶段A

重新遍历法案、施工图、执法系统、生产代码。
重新找 P0。
重新写：

《系统调试根因记录.md》

不能只检查旧 blocker 是否消失，必须当作全新日志重新分析。

如果旧 P0 消失且没有新 P0，输出：

DEBUG_LOOP_READY_FOR_NEXT_OWNER_OR_FULL_AUDIT

如果旧 P0 未消失，输出：

FIX_NOT_EFFECTIVE

如果旧 P0 消失但出现新 P0，输出：

NEXT_DEBUG_LOOP_REQUIRED

============================================================
当前本轮已知日志观察，必须在阶段A中验证
============================================================

不要直接当结论，必须从《系统调试日志.md》重新验证：

1. 启动链、map readiness、AI readiness 已 PASS。
2. MISSION_ACTIVATION_SNAPSHOT_FROZEN 已出现。
3. STEP_DISPATCH_STARTED 已出现。
4. CAPABILITY_CALL_STARTED 已出现。
5. CAPABILITY_CALL_COMPLETED success 已出现。
6. traceId/runId 中途发生多次换轨，疑似 P0。
7. FORENSICS_RECORD_WRITE_REQUESTED / WRITTEN 重复度很高，疑似写账重复或日志递归污染。
8. Nerve Bus result envelope / semantic gate / transfer proof 日志不可见，疑似 P0。
9. CAPABILITY_CALL_COMPLETED 后未看到 STEP_TRANSITION_EVALUATED / PAV / mission terminal，疑似 P0。
10. COMMAND_ACCEPTED 出现多次，必须确认不会被当作 mission success。

最终纪律：
阶段A只分析。
阶段B只按根因修。
阶段C必须回到阶段A。
没有最新真实日志，不准说 READY。
没有根因记录，不准修代码。
没有 WHY 和防复发，不准交付。
没有生产突变验证，不准说防复发。
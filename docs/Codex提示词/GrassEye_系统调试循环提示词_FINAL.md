# GrassEye 系统调试循环提示词_FINAL.

## 任务名称

GrassEye 系统调试循环：日志落盘 → 根因固定 → 修复固化 → 重启重跑 → 新日志复核

---

## 最高原则

本任务不是泛泛审计。
本任务不是阶段性报告。
本任务不是只修一个显性错误。

唯一目标：
通过真实运行日志，把系统从当前阻塞点持续向后推进。
每一轮必须用“新日志推进”证明修复有效。


---

## 三条死命令

死命令 1：
没有完成“启动系统 + 触发任务 + 全量日志写入《系统调试日志.》”，禁止分析，禁止修复。

死命令 2：
没有把日志中的全部 P0 问题和根因写入《系统调试根因记录.》，禁止改代码。

死命令 3：
修复完成后，必须重启系统、重新触发同一个任务、重新覆盖《系统调试日志.》，并重新进入根因分析。
没有新日志推进，禁止宣称完成。


---

## 固定文件

本调试循环只围绕两个文件推进：


docs/debug/系统调试日志.
docs/debug/系统调试根因记录.


如果目录不存在，先创建：


docs/debug/


要求：


《系统调试日志.》只保存最新一轮完整运行日志。
《系统调试根因记录.》保存最新一轮 P0 根因树、修复计划、修复状态、防复发要求。


每轮允许覆盖《系统调试日志.》。  
《系统调试根因记录.》不得删除历史轮次，必须按轮次追加。

---

# 阶段 A：运行取证 + 根因固定

## A1. 启动系统并触发任务

执行：

bash
npm run grasseye:start


系统启动后，触发固定任务：


facebook.seeding-video.discovery.meta.v1

---

## A2. 写入完整日志

把本轮终端产生的完整日志写入：

docs/debug/系统调试日志.

要求：


必须是完整日志。
不得只复制最后几十行。
不得只复制 error。
不得只复制 summary。
必须包含 startup、readiness、Commander、Nerve Bus、Orchestration、能力组执行、Forensics、最终失败。


如果日志太长，可以分段追加，但最终文件必须包含完整日志。

---

## A3. 回读法案和故事情节

只读取与当前日志阻塞相关的最小必要文件。

必须读取：


.github/instructions/cursor-rules/GRASSEYE-KERNEL.instructions.
docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.
docs/法案辅助文件/GrassEye Agent故事情节.


然后根据日志中的 ownerResponsible / abilityGroup / childCapability 再读取对应能力组法案和施工图。

示例：


如果卡在 screenshot.prepare-ai-input：
读取 Screenshot 法案 + Screenshot 施工图 + screenshot 源码 + screenshot inspector。

如果卡在 open-local-program：
读取 Open 法案 + Open 施工图 + open 源码 + open inspector。

如果卡在 map transition：
读取 map-plugin-package 法案 + map 施工图 + built-in map + orchestration 相关代码。


禁止：


一次性遍历所有能力组。
泛泛重审整个系统。
脱离日志去扩功能。


---

## A4. 找出所有 P0 问题

从《系统调试日志.》中提取所有 P0 问题。

P0 定义：


导致任务停止、任务失败、mission failed、owner audit fail、CI fail、核心 proof 缺失、handoff 断裂、map 无 transition、能力组越权、第二链路风险的问题。


必须区分：


第一阻塞：当前任务最先失败的位置。
并发 P0：同一轮日志中已经暴露但不是第一失败的 P0。
症状：由第一阻塞引起的后续失败。
噪音：不影响本轮任务推进的非 P0。


---

## A5. 固定根因

把结果写入：


docs/debug/系统调试根因记录.


格式：


## Round N

### 1. 本轮任务
- mapId:
- platform:
- run command:
- log file:

### 2. 当前推进到哪里
- last successful step:
- first failed step:
- ownerResponsible:
- abilityGroup:
- childCapability:
- failureReason:

### 3. P0 问题清单
| id | 类型 | step | owner | failureReason | 是否第一阻塞 |
|---|---|---|---|---|---|

### 4. 根因树
#### P0-1
- 日志证据:
- 代码证据:
- 法案/施工图证据:
- 根因:
- 不是根因的项:
- 需要修复的文件:
- 需要补的执法:
- 需要补的 negative proof:

### 5. 本轮修复目标
- 必须修:
- 禁止修:
- 不属于本轮:


要求：


每个 P0 必须有明确根因。
如果证据不足，写 UNKNOWN，并列出还要读取的文件。
禁止用“可能是”结束。
禁止只写现象不固定根因。


---

# 阶段 B：修复 + WHY + 执法防复发

## B1. 读取根因记录

先读取：


docs/debug/系统调试根因记录.


只修最新 Round 中标记为：


本轮必须修


的 P0 问题。

禁止：


跳到别的能力组。
顺手重构。
修低优先级问题。
扩展新功能。
修改法案降低要求。


---

## B2. 修复代码文件

修复原则：


法案/施工图是主干。
inspector 是枝干。
代码是被治理对象。


允许：


删除 owner-local implementation 文件后重写。
删除 owner-local runtime helper 后重写。
删除 owner-local inspector phase 后重写。
物理切割过大的 owner-local 文件。
补 schema / contract / proof builder / handoff builder。


禁止：


缝合怪。
小补丁糊住。
FAIL 改 WARNING。
删除检查。
添加临时 allowlist。
把字段改 optional 放水。
伪造 proof。
绕过 owner。
让 Orchestration 处理图片。
让 AI adapter 自己压缩图片。
让 debug-loop 代替 production agent。


---

## B3. WHY 记录

如果本轮新增或重建了关键机制，更新或创建 WHY 文件：


docs/why/系统调试循环.WHY.


只写和本轮修复有关的 WHY，不写空泛文档。

格式：


## Round N WHY

### 为什么修这个
- 运行日志暴露的问题:
- 不修的后果:

### 为什么不能用补丁
- 禁止方式:
- 正确 owner:

### 为什么这样防复发
- inspector:
- negative proof:
- runtime proof:


---

## B4. 同步执法系统

每个修复必须同步对应 inspector。

最低要求：


1. Required shape：正确结构必须存在。
2. Forbidden shape：错误结构必须被拦截。
3. Boundary attack：owner 越权必须被拦截。
4. Anti-escape：绕路、别名、二链路必须被拦截。
5. Negative proof：破坏后必须 FAIL，回滚后必须 PASS。


必须优先使用：


ts-morph AST
symbol
import graph
schema traversal
JSON traversal
reference tracing


禁止只用：


grep
includes
regex
path exists


除非是纯文档路径检查，并且必须说明原因。

---

## B5. 局部验证

根据 owner 运行最小命令。

示例：

bash
npm run audit:screenshot
npm run audit:orchestration
npx tsc --noEmit


如果改了地图：

bash
npm run audit:map-plugin-package


如果改了执法覆盖：

bash
npm run audit:coverage


如果改了 code-purity 触发文件：

bash
npm run audit:code-purity


本阶段不要把 CI FULL 当作唯一目标。  
CI FULL 可以在阶段 C 复核后运行。

---

# 阶段 C：重启重跑 + 新日志复核

## C1. 重启系统并触发同一个任务

必须重新执行：

bash
npm run grasseye:start


然后触发与阶段 A 相同的任务：


facebook.seeding-video.discovery.meta.v1


禁止换任务来制造“看似通过”。

---

## C2. 覆盖写入最新完整日志

把新一轮完整日志覆盖写入：


docs/debug/系统调试日志.


要求同阶段 A：


必须完整。
必须包含从 startup 到最终失败/推进结果。
不得只贴摘要。


---

## C3. 重新分析 P0

重复阶段 A3-A5：


回读相关法案 + 故事情节
找出所有 P0
固定根因
追加写入《系统调试根因记录.》


---

## C4. 判断推进结果

必须判断：


旧阻塞是否消失:
新日志推进到哪里:
是否进入下一 step:
是否出现新的 first failed step:
是否达到本轮调试目标:


写入《系统调试根因记录.》：


### 6. 重跑结果
- old blocker gone: YES/NO
- new latest successful step:
- new first failed step:
- advanced: YES/NO
- next action:


---

# 循环规则

如果：


old blocker gone = YES
但出现新的 P0


则继续：


阶段 B → 阶段 C


如果：


old blocker gone = NO


则说明修复无效，必须回到：


阶段 A 根因重新判定


如果：


达到本轮调试目标


才允许停止。

---

# 本轮默认调试目标

默认目标：


facebook.seeding-video.discovery.meta.v1 至少跑过 prepare-ai-input，
进入 judge-seeding-video。


如果已经进入 `judge-seeding-video`，本轮可停止并输出：


NEXT_BLOCKER


如果继续往后修，必须明确写新目标。

---

# 允许停止的情况

只允许三种：

## PASS


本轮目标达成。
新日志证明系统已经越过本轮目标 step。


## NEXT_BLOCKER


旧阻塞已消失。
系统推进到下一能力组或下一 step。
新阻塞已写入《系统调试根因记录.》。


## TRUE_BLOCKED

仅限：


需要用户登录/授权。
缺少系统权限。
缺少真实外部程序。
法案和施工图冲突。
关键文件缺失，Codex 无法判断。


禁止用以下理由停止：


已经修了一个问题。
局部 audit 通过。
typecheck 通过。
建议下一轮继续。
任务太长。
需要用户再运行。
本轮阶段性完成。


---

# 最终输出格式


[SYSTEM-DEBUG-LOOP-RESULT]

1. Round
- round:
- task:
- mapId:

2. Old Blocker
- step:
- failureReason:
- owner:

3. Root Cause Record
- file:
- P0 count:
- first blocker fixed:

4. Fixes
- code files:
- inspector files:
- negative proof:
- WHY:

5. Validation
- local audits:
- tsc:
- coverage if touched:
- code-purity if touched:

6. Rerun
- system restarted:
- task rerun:
- log file overwritten:
- old blocker gone:
- new latest successful step:
- new first failed step:

7. Verdict
- PASS / NEXT_BLOCKER / TRUE_BLOCKED


---

# 一句话纪律


调试交付不是“修了什么”，而是“新日志推进到了哪里”。
没有完整日志、没有根因记录、没有修复防复发、没有重启重跑，就不算完成。


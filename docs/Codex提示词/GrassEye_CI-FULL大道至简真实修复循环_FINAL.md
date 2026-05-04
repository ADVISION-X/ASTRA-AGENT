# GrassEye CI-FULL 大道至简真实修复循环 FINAL

## 0. 文件身份

```yaml
documentId: GRASSEYE-CI-FULL-SIMPLE-REAL-REPAIR-LOOP-FINAL
documentType: codex-execution-prompt
targetExecutor: Codex
executionMode: single-long-running-loop
coreGoal: read-current-violation-authorize-against-law-blueprint-inspector-fix-rerun-until-ci-full-green
lawStatus: frozen-content
blueprintStatus: frozen-content
status: active
```

本提示词用于 GrassEye 当前阶段的 CI-FULL 真实修复循环。

本任务不是重新规划系统。  
本任务不是重写法案。  
本任务不是大规模架构讨论。  
本任务不是为了把红色 CI 临时抹绿。  

本任务只有一个主循环：

```txt
读取当前 CI-FULL 违规报错
→ 通读对应法条
→ 通读对应施工图
→ 通读对应质检脚本段落
→ 判断到底是谁错
→ 立即删除重写错误对象
→ 重新运行 CI-FULL
→ 继续处理下一个违规
→ 直到 CI-FULL 全绿
```

---

## 1. 最高铁律

### 1.1 法案冻结

法案内容冻结。

允许：

```txt
修正格式
修正 OCR/识别错误
修正明显文件编码/标题/换行问题
```

禁止：

```txt
改法案内容
降低法条
删除法条
弱化 MUST / FORBIDDEN
把 FAIL 改 WARNING
新增 exception
新增 waiver
新增 allowlist
为了过 CI 修改法案口径
```

如果发现法案内容本身疑似冲突：

```txt
不得自行改法案内容。
输出 LAW-GAP，等待用户裁决。
```

---

### 1.2 施工图冻结

施工图内容冻结。

允许：

```txt
修正格式
修正 OCR/识别错误
修正文档结构导致的读取错误
```

禁止：

```txt
为了过 CI 改施工图内容
删除施工图要求
弱化施工图要求
把施工图要求改成 optional
```

如果施工图与法案冲突：

```txt
法案优先。
不得自行改法案。
不得自行改施工图内容。
输出 LAW-BLUEPRINT-CONFLICT，等待用户裁决。
```

---

### 1.3 CI-FULL 不是权威源

CI-FULL 只负责发现当前违规。  
CI-FULL 不是法案。  
CI-FULL 不是施工图。  
CI-FULL 不是架构真相。  

权威顺序：

```txt
法案
→ 施工图
→ 对应质检脚本 / inspector
→ 当前代码文件
→ CI-FULL 报错
```

CI 报错后，第一步不是立刻改代码。  
第一步是鉴权：

```txt
这个报错到底是代码错？
还是质检脚本错？
还是 generated/runner 漂移？
还是法案/施工图存在需要用户裁决的冲突？
```

---

## 2. 唯一主循环

Codex 必须严格按这个循环执行。

```txt
LOOP START

1. 运行 npm run ci:full。
2. 如果 CI-FULL 全绿，进入最终确认。
3. 如果 CI-FULL 报错，只提取当前第一个阻断项。
4. 读取该阻断项对应的法条。
5. 读取该阻断项对应的施工图段落。
6. 读取该阻断项对应的质检脚本 / inspector 段落。
7. 判断是谁错：
   A. 代码文件违反法案/施工图/合法 inspector
   B. 质检脚本逻辑错误或越权
   C. 执法覆盖缺失
   D. generated/runner/manifest 漂移
   E. 法案/施工图内容冲突，需要用户裁决
8. 按裁决立即修复。
9. 重新运行 npm run ci:full。
10. 继续处理新的第一个阻断项。
11. 直到 CI-FULL 全绿。

LOOP END
```

禁止：

```txt
一次处理一堆问题然后不复验
只看 CI 报错不读法案
只看法案不读施工图
只看施工图不读质检脚本
只改代码不鉴权 inspector
只改 inspector 不修真实代码
修一个报错就停止
报错减少就汇报完成
CI-FULL 未全绿就输出最终完成
```

---

## 3. 每个违规的最小处理格式

每一个 CI-FULL 违规必须输出以下结构。

```txt
[CI-VIOLATION]
失败命令：
失败文件：
失败位置：
失败 owner：
相关法案文件：
相关 lawId：
相关施工图：
相关质检脚本：
相关代码文件：
```

然后输出：

```txt
[AUTH-READ]
已通读法条：YES/NO
已通读施工图：YES/NO
已通读质检脚本：YES/NO
```

然后输出：

```txt
[FAULT-JUDGMENT]
裁决只能是以下之一：

1. CODE_FILE_WRONG
2. INSPECTOR_WRONG
3. ENFORCEMENT_MISSING
4. GENERATED_OR_RUNNER_DRIFT
5. LAW_BLUEPRINT_CONFLICT_NEEDS_USER
```

不得输出模糊裁决：

```txt
可能是
大概是
建议后续
基本可以
暂时接受
```

---

## 4. 五种裁决怎么修

### 4.1 CODE_FILE_WRONG

定义：

```txt
代码文件违反了冻结法案、冻结施工图、以及经过鉴权的合法质检脚本。
```

处理：

```txt
删除 / 删除重写 / 物理切割违规代码文件或违规模块。
不得小补丁糊住。
不得新增 bridge。
不得新增 fallback。
不得新增兼容层。
不得新增第二实现。
不得让代码迁就错误 inspector。
```

要求：

```txt
重写后的代码必须更小、更清楚、更符合 owner 边界。
必须满足 code-purity。
必须满足 type-safety。
必须满足该 owner 法案和施工图。
```

输出：

```txt
[CODE-FILE-REWRITE]
违规原因：
删除/重写文件：
新文件职责：
为什么不是补丁：
```

---

### 4.2 INSPECTOR_WRONG

定义：

```txt
质检脚本逻辑错误、越权、误读法案、误读施工图、或把施工图辅助内容当成新增法案。
```

处理：

```txt
删除对应质检脚本文件。
按法案 + 施工图重新写。
```

原则：

```txt
现在 code-purity 已经执行，质检脚本应该小而清楚。
如果 inspector 逻辑错，不要补丁修补。
直接删除对应 inspector 文件并重写。
```

必须重写：

```txt
scripts/audit/domains/<owner>/inspector.ts
```

必要时同步重写：

```txt
scripts/audit/domains/<owner>/negative-proof-harness.ts
scripts/audit/domains/<owner>/run-inspector.ts
scripts/audit/domains/<owner>/manifest.json
```

禁止：

```txt
为了消除误报去改代码
为了保留旧 inspector 加例外
把 FAIL 改 WARNING
跳过检查
注释掉检查
```

输出：

```txt
[INSPECTOR-REWRITE]
错误逻辑：
对应法条：
对应施工图：
删除重写文件：
新 inspector 覆盖点：
```

---

### 4.3 ENFORCEMENT_MISSING

定义：

```txt
法案/施工图有明确要求，但质检脚本没有覆盖，导致 CI 没拦或拦得不完整。
```

处理：

```txt
补齐 inspector。
补齐 negative proof。
补齐 owner audit 入口。
必要时补 manifest。
```

要求：

```txt
该要求必须能 fail。
必须有正反例。
必须有 negative proof。
```

输出：

```txt
[ENFORCEMENT-ADD]
缺失要求：
新增 inspector 检查：
新增 negative proof：
```

---

### 4.4 GENERATED_OR_RUNNER_DRIFT

定义：

```txt
法案、manifest、matrix、audit-plan、runner-summary、generated artifacts 之间漂移。
```

处理：

```txt
修 source law / manifest / generator / runner source。
重新运行 audit:build。
不得手工改 generated 伪造 PASS。
```

输出：

```txt
[GENERATED-DRIFT-FIX]
漂移位置：
真实源头：
修复文件：
重新生成命令：
```

---

### 4.5 LAW_BLUEPRINT_CONFLICT_NEEDS_USER

定义：

```txt
冻结法案与施工图内容真实冲突，或法案本身缺授权，Codex 无权裁决。
```

处理：

```txt
停止当前项。
不得继续猜。
不得修改法案内容。
不得修改施工图内容。
输出给用户裁决。
```

输出：

```txt
[LAW-BLUEPRINT-CONFLICT-NEEDS-USER]
冲突法条：
冲突施工图段落：
CI 报错：
为什么 Codex 无权自行改：
最小用户裁决选项：
```

---

## 5. 通读要求

每次处理违规，Codex 必须通读三件东西：

### 5.1 通读对应法条

必须读取：

```txt
lawId
summary
主题
法条
禁止
Required inspector
Required negative proof
Final readiness gate
```

### 5.2 通读对应施工图

必须读取：

```txt
对应 owner 施工图
对应章节
对应目录结构
对应 public contract
对应 schema / proof / result / boundary 要求
```

### 5.3 通读对应质检脚本

必须读取：

```txt
inspector 当前逻辑
run-inspector 当前入口
negative-proof 当前覆盖
manifest 当前 owner/law 映射
package.json 当前 audit 命令
```

没有通读这三项，不得修复。

---

## 6. 修复原则：删除重写优先

### 6.1 质检脚本错

```txt
删除对应 inspector 文件，重写。
```

原因：

```txt
当前 code-purity 已经要求质检脚本小而清楚。
小文件逻辑错，继续补丁只会形成缝合怪。
```

### 6.2 代码文件错

```txt
删除违规文件 / 删除违规模块 / 物理切割后重写。
```

原因：

```txt
代码文件违规说明它已经偏离法案或施工图。
不要打补丁。
重写成单一职责、小文件、清晰 owner 边界。
```

### 6.3 generated 漂移

```txt
修 source，不手改 generated。
重新运行 audit:build。
```

### 6.4 法案/施工图识别错误

```txt
只允许修格式/OCR/识别错误。
内容不改。
```

---

## 7. 质检脚本重写标准

重写 inspector 必须满足：

```txt
1. 小文件。
2. 单 owner。
3. 单职责。
4. 不超过 code-purity 限制。
5. 使用 ts-morph / AST / symbol / import graph / schema / JSON traversal。
6. grep / regex / includes 只能辅助，不能作为最终判断。
7. 必须检查 required shape。
8. 必须检查 forbidden shape。
9. 必须检查 owner boundary。
10. 必须检查 anti-escape。
11. 必须能 fail。
12. 必须有 negative proof。
```

禁止：

```txt
warning-only
info-only
no-op pass
fake pass
空 negative proof
只检查文件存在
只检查字符串存在
```

---

## 8. 代码文件重写标准

重写代码必须满足：

```txt
1. 文件小。
2. 函数小。
3. 职责单一。
4. owner 边界清楚。
5. 不新增 bridge/fallback/compat。
6. 不新增第二实现。
7. 不新增 mock/fake/demo 到 production path。
8. 不使用 any / ts-ignore / eslint-disable。
9. 不绕过 Nerve Bus。
10. 不绕过 Orchestration。
11. 不绕过 map lifecycle。
12. 不绕过 PAV。
13. 不绕过 Forensics proof。
```

---

## 9. 每轮修复后的最小复验

每修完一个违规，必须运行：

```bash
npm run ci:full
```

因为本提示词目标就是 CI-FULL 真实修复循环。

如果 ci:full 仍失败：

```txt
读取新的第一个阻断项。
继续循环。
```

如果同一个阻断项仍失败：

```txt
继续当前项，不得进入下一个。
```

---

## 10. 最终确认

当 `npm run ci:full` 第一次全绿后，必须再执行一次：

```bash
npm run ci:full
```

第二次也全绿，才允许最终输出。

不得额外扩大为大规模 GLOBAL-RECHECK。  
不得引入新的重型检查目标。  
本提示词只以 CI-FULL 双次全绿为最终出口。

---

## 11. 最终报告格式

只有 CI-FULL 连续两次全绿，才输出：

```txt
[FINAL-CI-FULL-SIMPLE-REPORT]

1. VERDICT
CI-FULL TRUE GREEN

2. LOOP COUNT
总循环次数：
处理违规数量：

3. EACH VIOLATION
- 违规：
- 裁决：
- 通读法条：
- 通读施工图：
- 通读质检脚本：
- 修复动作：
- 是否删除重写：
- 复验结果：

4. FILES MODIFIED
- inspector files:
- negative proof files:
- code files:
- generated files by audit:build only:
- law files:
- blueprint files:

5. FREEZE CHECK
- 法案内容是否修改：NO
- 施工图内容是否修改：NO
- 是否仅修格式/OCR：YES/NO
- 是否降低法案：NO
- 是否删除法条：NO
- 是否关闭 inspector：NO
- 是否删除 negative proof：NO
- 是否手改 generated：NO

6. FINAL COMMANDS
- npm run ci:full first green:
- npm run ci:full second green:

7. FINAL SENTENCE
CI-FULL 已真实全绿；法案和施工图内容冻结未被破坏；质检脚本与代码文件已按法案和施工图完成真实修复。
```

---

## 12. 禁止最终报告条件

以下任一存在，不得输出最终报告：

```txt
CI-FULL 未全绿
只绿了一次，没有第二次确认
法案内容被改
施工图内容被改
法案被降级
inspector 被关闭
negative proof 被删除
generated 被手工改
通过 warning/info/no-op 当 PASS
新增 bridge/fallback/compat
代码迁就错误 inspector
```

---

## 13. 一句话启动纪律

```txt
现在开始：
运行 npm run ci:full。
读取第一个违规。
通读对应法条。
通读对应施工图。
通读对应质检脚本。
判断谁错。
错的是质检脚本就删除重写质检脚本。
错的是代码文件就删除重写代码文件。
修完重新跑 npm run ci:full。
循环直到 CI-FULL 连续两次全绿。
```

# END

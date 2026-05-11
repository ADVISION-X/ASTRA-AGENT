# GrassEye CI-FULL Final Blueprint

版本: FINAL  
状态: active  
目标: 永久定义 CI-FULL，防止 CI 流程再次膨胀失控。  
主旨: CI-FULL 只守三条底线：类型正确、代码纯洁、日志不失明。

---

## 1. Final Doctrine

CI-FULL 不再是大而全的质检宇宙。

CI-FULL 不是：

```txt
业务正确性证明
AI 判断正确性证明
平台动作正确性证明
能力组细节法庭
generated matrix universe
owner-inspection-harness 集群
smoke test 大系统
```

CI-FULL 只证明：

```txt
代码能 typecheck；
代码没有复杂化；
日志链不断；
旧系统没有回归。
```

一句话：

```txt
CI-FULL = typecheck + code-purity + runtime-log-spine。
```

---

## 2. CI-FULL 唯一组成

CI-FULL 只能包含：

```txt
1. typecheck
2. code-purity
3. runtime-log-spine
```

其中：

```txt
code-purity 内含 boundary / retired surface / dead source / console scatter / owner boundary 防护。
runtime-log-spine 内含 AI 四件套 / FLOW DEBUG TRACE / redaction / logger 不越权。
```

不得新增第四类核心质检，除非用户明确修改本施工图。

---

## 3. Step 1: Typecheck

### 3.1 目的

```txt
保证 TypeScript 层面可编译。
```

### 3.2 必须

```bash
npm run typecheck
```

或项目当前等价命令。

### 3.3 禁止

```txt
用 ts-ignore 绕过。
用 as any 绕过。
关闭 strict。
把错误移到 generated 里隐藏。
```

### 3.4 失败

失败即 CI-FULL 失败。

---

## 4. Step 2: Code Purity

### 4.1 目的

```txt
保证系统不会复杂化、不会越权、不会旧系统复活。
```

### 4.2 必须检查

```txt
文件大小
函数大小
函数复杂度
类/对象大小
import/export
cross-owner import
private runtime import
dead file
dead import
unused export
fake/mock/placeholder
console scatter
type escape
compat/fallback/alias
retired surface
manual generated edit
```

### 4.3 必须阻断

```txt
超大文件
超大函数
owner mixing
跨 owner private runtime import
dead source
console scatter
as any / ts-ignore
旧系统正向回归
compat bridge
fallback/alias
```

### 4.4 不得检查

```txt
AI 是否判断正确
按钮是否应该点击
业务字段是否符合某个旧能力组 inspector
页面语义是否正确
平台动作是否成功
```

### 4.5 输出

PASS：

```txt
[CODE-PURITY][PASS] files=<n> findings=0
```

FAIL：

```txt
[CODE-PURITY][FAIL]
file:
rule:
reason:
fixDirection:
```

禁止 PASS 大报告。

---

## 5. Step 3: Runtime Log Spine

### 5.1 目的

```txt
保证系统调试不失明。
```

### 5.2 必须检查

```txt
module-structured-logging active
src/lib/runtime-logs <= 8 files
runtime-logging audit <= 3 files
FLOW / DEBUG / TRACE
RuntimeLogEvent required fields
redaction
console scatter ban
AI_REQUEST_DEBUG
AI_RAW_RESPONSE_DEBUG
AI_PARSE_RESULT_DEBUG
AI_ERROR_DEBUG
logger no private runtime import
LocalAiDebugHook retired
```

### 5.3 必须阻断

```txt
没有 AI_REQUEST_DEBUG
没有 AI_RAW_RESPONSE_DEBUG
没有 AI_PARSE_RESULT_DEBUG
AI failure 无 AI_ERROR_DEBUG
logger 越权 import
console 散落
默认 DEBUG/TRACE
无 redaction
detail-only debugHook 主线
```

### 5.4 输出

PASS：

```txt
[RUNTIME-LOG-SPINE][PASS] mode=FLOW aiFourPiece=present consoleScatter=0
```

FAIL：

```txt
[RUNTIME-LOG-SPINE][FAIL]
file:
rule:
reason:
fixDirection:
```

禁止日志大 inventory。

---

## 6. Explicitly Excluded From CI-FULL

以下不得作为 CI-FULL mandatory step：

```txt
ability detail inspectors
child-by-child schema inspectors
business field inspectors
platform-specific behavior tests
AI judgment correctness tests
smoke tests
E2E browser tests
visual target semantic tests
generated matrix validation universe
owner-inspection-harness cluster
large report generation
coverage percentage gate
performance benchmark gate
```

说明：

```txt
这些可以作为手动调试工具存在，但不得进入 CI-FULL 主链。
```

---

## 7. Smoke Tests Position

当前阶段 smoke tests 不进入 CI-FULL。

原因：

```txt
它不能证明系统调试成功；
它容易假绿；
它容易变成新测试宇宙；
它不如日志 + 小文件定位高效。
```

如果未来需要，只能作为：

```txt
npm run debug:smoke
```

不得作为：

```txt
npm run ci:full
```

---

## 8. CI-FULL 命令形态

推荐：

```json
{
  "scripts": {
    "ci:full": "npm run typecheck && npm run audit:code-purity && npm run audit:runtime-logging"
  }
}
```

允许命令名不同，但逻辑必须等价。

禁止：

```txt
ci:full 里塞入 smoke/e2e/ability-detail/generated-report。
ci:full 里生成大量默认报告。
ci:full 只 warning 不 fail。
ci:full 跳过 typecheck。
```

---

## 9. Audit Domain File Limits

```txt
scripts/audit/domains/code-purity <= 12 files
scripts/audit/domains/runtime-logging <= 3 files
```

禁止：

```txt
owner-inspection-harness
generated matrix universe
large default inventory
domain-by-domain detail inspectors
```

---

## 10. CI-FULL Output Contract

CI-FULL 成功输出必须短：

```txt
[TYPECHECK][PASS]
[CODE-PURITY][PASS] files=<n> findings=0
[RUNTIME-LOG-SPINE][PASS] aiFourPiece=present consoleScatter=0
[CI-FULL][PASS]
```

CI-FULL 失败输出必须可修：

```txt
[CI-FULL][FAIL]
step:
file:
rule:
reason:
fixDirection:
```

禁止：

```txt
失败只给 stack trace。
失败给 1000 行报告。
失败不给 fixDirection。
PASS 输出大 inventory。
```

---

## 11. CI-FULL Governance Rule

任何人或 AI 修改 CI-FULL，必须满足：

```txt
1. 不能新增 mandatory category。
2. 不能引入 business detail inspector。
3. 不能引入 smoke/e2e mandatory step。
4. 不能引入 generated report universe。
5. 不能降低 code-purity。
6. 不能降低 runtime-log-spine。
7. 不能把 FAIL 改 WARNING。
```

否则直接 FAIL。

---

## 12. Relationship To Laws

CI-FULL 只执行两个最终法案：

```txt
module-code-purity.instructions.md
module-structured-logging.instructions.md
```

边界防护归 Code Purity。  
日志透明归 Runtime Log Spine。

CI-FULL 不再为每个能力组创建独立细节法庭。

---

## 13. Final PASS Definition

CI-FULL PASS 只代表：

```txt
1. TypeScript 可编译。
2. 代码形态健康。
3. 旧系统没有复活。
4. 关键日志链不断。
5. 系统不会失明。
```

CI-FULL PASS 不代表：

```txt
AI 判断正确。
业务动作正确。
平台交互一定成功。
端到端任务一定完成。
```

这些由真实运行 + Runtime Log Spine 定位解决。

---

## 14. Final Sentence

```txt
GrassEye CI-FULL 不追求证明一切正确；
它只守住三件事：能编译、不复杂、不失明。
```

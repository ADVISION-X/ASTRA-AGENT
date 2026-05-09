你说得对。重新站在 **CI FULL 三层质检系统** 看，真正的根治不是“让 `CI-FULL audit-system stage` 少跑一点”，而是要把 **每一层的职责固定下来**：

```text
CI FULL = 总质检编排器
  第一层：foundation-layer，全局基础质检
  第二层：map-layer，地图/插件包质检
  第三层：ability-group-layer，14个能力组 owner 质检
```

现在的问题本质是：

> **有些检查没有唯一 owner，导致第一层检查了，第二层/第三层又间接重复检查；audit-system 又把自己变成“全系统再审计器”，所以内存被放大。**

---

# 一、当前 CI FULL 实际结构

你的 `ci:full` 已经有三层结构：

```ts
foundation-layer
map-layer
ability-group-layer
```

代码里明确写了这三层，并且第一层是串行，第三层是 bounded 并发。

第一层现在包括：

```text
audit build
code-purity
typecheck
capability-group-governance
type-safety
security-privacy
audit-system
```

第二层：

```text
map-plugin-package
```

第三层：

```text
commander-console
orchestration
nerve-bus
ai
open
screenshot
visual-target
geometry-guard
mouse-click
text-input
mouse-scroll
post-action-verification
forensics-persistence
page-state
```

这说明你的大方向是对的：**CI FULL 是总编排，三层各自质检，最后汇总。**

问题出在：**单个 owner inspector 没有严格服从这个三层边界。**

---

# 二、真正的问题：audit-system 越权成了“二次 CI FULL”

`audit-system` 现在不只是检查 audit-system 自己。

它内部会跑：

```text
base owner inspection
governance checks
red-line checks
real-code-inspection
```

并且 red-line 里面直接调用了：

```ts
inspectCodePurity(context)
```

也就是 `audit-system` 会内嵌完整 code-purity。

但是 CI FULL 第一层已经单独跑了：

```text
code-purity
```

而且 `CI-FULL code-purity stage` 本身已经被拆成：

```text
code-purity:scan
code-purity:report
code-purity:real-code-inspection
```

三个独立阶段。

所以这里出现了严重重复：

```text
CI FULL 第一层已经跑 code-purity
    ↓
audit-system 又内嵌 inspectCodePurity
    ↓
audit-system real-code-inspection 又反复启动 audit-system
    ↓
每一轮又可能触发 code-purity / topology / artifact 检查
```

这不是质检增强，这是 **检查职责失控**。

---

# 三、CI FULL 的正确原则

应该建立一条铁律：

## 一个检查，只能有一个生产者 owner

也就是：

```text
code-purity 的真实扫描结果，只能由 foundation-layer / code-purity 生产
audit-system 不允许重新执行 code-purity
map-layer 不允许重新执行 code-purity
ability-group-layer 不允许重新执行 code-purity
```

其他层如果需要确认 code-purity，不能重新跑，只能检查：

```text
code-purity 结果是否存在
code-purity 结果是否新鲜
code-purity 结果是否 PASS
code-purity 是否被 CI FULL 纳入
```

这叫：

```text
生产者检查 = 真执行
消费者检查 = 查证据
```

---

# 四、三层重新定义

## 第一层：foundation-layer

第一层只做全局基础质检。

它应该拥有这些真实检查：

```text
1. ci:full
   生成 law registry / matrix / audit plan / conflicts 等基础产物

2. CI-FULL code-purity stage
   全仓代码纯洁度扫描
   这是全局重检查，只能在这里真实执行一次

3. typecheck
   TypeScript 全局类型检查

4. CI-FULL capability-group-governance stage
   检查能力组注册、owner 映射、矩阵关系

5. CI-FULL type-safety stage
   类型安全规则

6. CI-FULL security-privacy stage
   安全隐私边界

7. CI-FULL audit-system stage
   只检查“审计系统本身的拓扑、证据链、产物链、runner 链”
   不允许重新执行 code-purity
   不允许重新执行 CI FULL
   不允许默认执行 production regression real-code-inspection
```

关键点：

```text
foundation-layer 是全局检查生产层。
audit-system 是 foundation-layer 的一个检查项，不是 CI FULL 的替身。
```

---

## 第二层：map-layer

第二层只负责 map/plugin package。

它应该检查：

```text
1. map package 结构
2. map contract
3. map manifest
4. map 与能力组的声明边界
5. map 是否没有越权调用 runtime 能力
```

它不应该做：

```text
不跑 code-purity
不跑 typecheck
不跑 audit-system
不跑 capability-group-governance
不跑 ability group owner 检查
不跑 real-code-inspection 总链
```

map-layer 如果需要知道 code-purity 是否通过，只读取第一层证据：

```text
tmp/audit/ci-full/foundation-layer/code-purity.json
```

而不是自己重新跑。

---

## 第三层：ability-group-layer

第三层负责 14 个能力组 owner。

每个 owner 只检查自己的能力边界：

```text
commander-console 只检查 commander-console
orchestration 只检查 orchestration
nerve-bus 只检查 nerve-bus
ai 只检查 ai
open 只检查 open
...
```

第三层不应该做：

```text
不 rebuild audit artifacts
不全仓 code-purity
不 typecheck
不检查其他 owner 的完整逻辑
不跑 CI FULL
不默认跑 production regression real-code-inspection
```

它可以检查：

```text
我的 manifest 是否存在
我的 laws 是否映射
我的 inspector 是否覆盖自己的 lawId
我的 runtime 能力是否没有越权
我的输出证据是否符合格式
```

但是不能重新做第一层的事情。

---

# 五、CI FULL 应该变成“证据总线”，不是“重复执行器”

你现在需要建立一个统一的 CI evidence ledger。

每个检查项执行后，都写一个标准结果文件：

```json
{
  "layer": "foundation-layer",
  "step": "code-purity",
  "owner": "code-purity",
  "status": "PASS",
  "exitCode": 0,
  "startedAt": "...",
  "finishedAt": "...",
  "durationMs": 12345,
  "memoryPeakMb": 2100,
  "findingsCount": 0,
  "artifactPaths": [
    "scripts/audit/generated/code-purity-report.generated.json",
    "tmp/audit/code-purity/findings.ndjson"
  ]
}
```

然后 CI FULL 最后只做汇总：

```text
foundation-layer evidence
+ map-layer evidence
+ ability-group-layer evidence
= ci-full-summary.generated.json
```

最终判断：

```text
只要任意 evidence FAIL，CI FULL FAIL
全部 evidence PASS，CI FULL PASS
```

这样每个检查只跑一次。

---

# 六、audit-system 的正确定位

`audit-system` 不应该再是“全系统审计器”。

它应该是：

```text
审计系统拓扑检查器
```

它检查这些：

```text
1. ci-full.ts 是否存在三层结构
2. foundation-layer 是否包含必要基础检查
3. map-layer 是否只包含 map 检查
4. ability-group-layer 是否包含 14 个能力组 owner 检查
5. 每个检查是否有唯一 owner
6. 每个检查是否输出 evidence
7. 每个 evidence 是否被 CI FULL summary 汇总
8. heavy proof 是否只能显式执行
9. code-purity 是否只在 foundation-layer 真实执行一次
10. owner inspector 是否没有越权调用其他层重检查
```

它不能再做这些：

```text
不能真实跑 code-purity
不能真实跑 typecheck
不能真实跑 map-layer
不能真实跑 ability-group-layer
不能默认跑 regression real-code-inspection
不能通过启动自己来证明自己
```

---

# 七、这次的根治方案

## 方案 1：建立检查唯一 owner 矩阵

新增一个文件：

```text
scripts/audit/ci-full-check-ownership.ts
```

里面定义：

```ts
export const CI_FULL_CHECK_OWNERS = [
  {
    checkId: "audit-build",
    layer: "foundation-layer",
    producer: "ci:full",
    consumers: ["audit-system"],
    exclusive: true,
  },
  {
    checkId: "code-purity",
    layer: "foundation-layer",
    producer: "CI-FULL code-purity stage",
    consumers: ["audit-system", "ability-group-layer"],
    exclusive: true,
  },
  {
    checkId: "typecheck",
    layer: "foundation-layer",
    producer: "typecheck",
    consumers: ["audit-system"],
    exclusive: true,
  },
  {
    checkId: "map-plugin-package",
    layer: "map-layer",
    producer: "ci:full",
    consumers: ["audit-system"],
    exclusive: true,
  },
  {
    checkId: "ai-capability",
    layer: "ability-group-layer",
    producer: "CI-FULL ai owner step",
    consumers: ["audit-system", "capability-group-governance"],
    exclusive: true,
  }
];
```

核心规则：

```text
exclusive: true 的 check，不允许被其他 inspector 重新执行。
```

---

## 方案 2：audit-system 只检查 evidence，不重新执行检查

把 `audit-system` 里类似这种逻辑：

```ts
results.push(await inspectCodePurity(context));
```

改成：

```ts
results.push(await validateCiFullEvidence({
  checkId: "code-purity",
  expectedLayer: "foundation-layer",
  expectedProducer: "CI-FULL code-purity stage",
}));
```

也就是：

```text
以前：audit-system 重新执行 code-purity
以后：audit-system 检查 code-purity evidence 是否存在、是否 PASS、是否新鲜
```

这才符合 CI FULL 分层。

---

## 方案 3：所有 owner inspector 禁止调用其他 owner 的真实 inspector

加一条红线：

```text
Owner inspector 只能检查自己的源文件、manifest、law coverage、runtime boundary。
Owner inspector 不得 import 或调用其他 owner inspector 的 inspectXXX。
```

比如：

```text
audit-system 不得 import inspectCodePurity
map-plugin-package 不得 import inspectCodePurity
ai-capability 不得 import audit-system inspector
ability owner 不得 import ci-full runner
```

允许：

```text
读取 evidence
读取 generated artifact
读取 manifest
读取 summary
```

禁止：

```text
重新执行别人的检查
重新 spawn 别人的 npm audit
重新 build 全局 artifact
```

---

## 方案 4：real-code-inspection 从 CI FULL 常规链中物理切出去

real-code-inspection 不是每日常规 CI FULL 的一部分。

它应该变成：

```text
ci:full = 常规完整质检
ci:full = 重型变异证明
```

也就是：

```json
{
  "scripts": {
    "ci:full": "node --import tsx scripts/audit/ci-full.ts",
    "ci:full": "node --import tsx scripts/audit/ci-full-plan.ts"
  }
}
```

`ci:full` 做：

```text
完整但不变异生产树的检查
```

`ci:full` 做：

```text
低频、重型、串行、限内存、可中断的 real-code inspection
```

否则普通 CI FULL 每次都动生产树、反复 spawn、自我验证，风险太大。

---

## 方案 5：CI FULL 总结文件成为最高质检结果

新增最终汇总：

```text
scripts/audit/generated/ci-full-summary.generated.json
```

结构：

```json
{
  "status": "PASS",
  "layers": [
    {
      "label": "foundation-layer",
      "status": "PASS",
      "steps": [...]
    },
    {
      "label": "map-layer",
      "status": "PASS",
      "steps": [...]
    },
    {
      "label": "ability-group-layer",
      "status": "PASS",
      "steps": [...]
    }
  ],
  "blockingFindings": [],
  "memoryPeakMb": 0
}
```

以后 audit-system 检查 CI FULL，不是重新跑 CI FULL，而是检查：

```text
ci-full-summary 是否存在
三层是否完整
每层 step 是否完整
每个 step 是否只有一个 producer
每个 evidence 是否新鲜
```

---

# 八、最终结构应该是这样

```text
CI FULL
│
├─ foundation-layer
│  ├─ ci:full                         生产 generated artifacts
│  ├─ CI-FULL code-purity stage                   生产 code-purity evidence
│  ├─ typecheck                           生产 typecheck evidence
│  ├─ CI-FULL capability-group-governance stage   生产 owner/matrix evidence
│  ├─ CI-FULL type-safety stage                   生产 type safety evidence
│  ├─ CI-FULL security-privacy stage              生产 security evidence
│  └─ CI-FULL audit-system stage                  只检查 CI 拓扑与 evidence 链
│
├─ map-layer
│  └─ ci:full            只生产 map evidence
│
└─ ability-group-layer
   ├─ CI-FULL commander-console owner step             只生产 commander evidence
   ├─ CI-FULL orchestration owner step                 只生产 orchestration evidence
   ├─ CI-FULL nerve-bus owner step                     只生产 nerve-bus evidence
   ├─ CI-FULL ai owner step                            只生产 ai evidence
   ├─ ...
   └─ CI-FULL page-state owner step                    只生产 page-state evidence
```

一句话：

```text
每层生产自己的证据。
上一层不替下一层跑。
下一层不重复上一层跑。
audit-system 只查证据链，不再亲自重跑全系统。
```

---

# 九、给 Codex 的新提示词

你可以直接发这个版本：

```text
重新治理 GrassEye CI FULL 三层质检系统，目标不是单点降内存，而是消除跨层重复检查。

原则：
1. CI FULL 是唯一总编排器，分为 foundation-layer、map-layer、ability-group-layer。
2. 每个 check 只能有一个 producer owner。其他层只能读取 evidence，不得重新执行该 check。
3. foundation-layer 负责全局检查：ci:full、CI-FULL code-purity stage、typecheck、CI-FULL capability-group-governance stage、CI-FULL type-safety stage、CI-FULL security-privacy stage、CI-FULL audit-system stage。
4. map-layer 只负责 ci:full。
5. ability-group-layer 只负责 14 个 ability owner inspectors。
6. audit-system 的定位改为“CI 拓扑与 evidence 链检查器”，不得重新执行 code-purity、typecheck、map-layer、ability-group-layer，不得默认跑 production regression real-code-inspection。
7. 移除 audit-system 内部对 inspectCodePurity 的真实执行，改为 validate code-purity evidence：检查 foundation-layer/code-purity evidence 是否存在、PASS、新鲜、被 ci-full-summary 汇总。
8. 建立 CI_FULL_CHECK_OWNERS 矩阵，声明每个 checkId 的唯一 producer、所属 layer、允许 consumers。
9. 所有 owner inspector 禁止 import/call 其他 owner 的真实 inspector，只能读取 generated artifacts / evidence / summaries。
10. ci:full 输出 scripts/audit/generated/ci-full-summary.generated.json，汇总三层所有 step 的 status、exitCode、duration、memoryPeak、artifactPaths。
11. real-code-inspection 从常规 ci:full 中物理切出，放到显式 ci:full 或 CI-FULL real-code-inspection 模式；普通 ci:full 不做生产树 real-code inspection。
12. 资源保护仍保留：每个 step 限时、限 RSS、超限 kill child process tree。
13. 最终结果：ci:full 是完整质检，但每项检查只执行一次；audit-system 只验证链路完整，不重复执行重型检查。
```

---

# 最终判断

你现在要修的不是一个命令，而是 **CI FULL 分层所有权**。

原来的错误是：

```text
audit-system 想证明系统可靠，于是重新执行一堆系统检查。
```

正确做法是：

```text
CI FULL 执行所有检查。
每个检查只执行一次。
audit-system 证明这些检查被正确编排、正确产出 evidence、正确汇总。
```

这样才是完整质检系统，也才符合你的“大道至简”。

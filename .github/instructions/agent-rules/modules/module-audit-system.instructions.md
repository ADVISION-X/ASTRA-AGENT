---
name: "APEX Audit System"
description: "质检系统主权法案：法案文件、执法脚本、自动生成矩阵、runner 与元质检闭环"
applyTo: "scripts/audit/**/*"
---

# APEX Audit System

Scope: 质检系统主权、执行链、自动生成矩阵、owner 边界、runner 权限、元质检闭环。
Boundary: 本文件只管质检系统，不接管业务模块法案内容，不代替任何模块施工图。

## 总原则

质检系统是 GrassEye 的清规戒律。

极简不是放纵。极简只是删除多余宇宙、万能大脑、旧壳和第二真相；它绝不意味着降低质检强度。

相反，越是极简系统，质检越必须严苛：因为质检系统一旦腐烂，后续每一次迭代都会把小口子、小桥、小壳带回系统，最后重新长成迷宫。

APEX 质检系统只允许一条真实主链：

**法案文件 → inspector manifest / owner script → generated matrix / generated plan → runner → CI-FULL**

禁止第二主链。
禁止平行真相。
禁止手工维护 matrix 作为运行权威。
禁止 runner 自己维护 law ↔ script 绑定真相。
质检系统运行态只有二元裁决：`PASS` 或 `FAIL`。
禁止 `warning`、`advisory`、`partial-pass`、`soft-fail` 进入 owner report、domain report、summary 或 runner gate。

任何声称“为了极简可以跳过 manifest、generated artifact、owner inspector、meta audit、CI-FULL”的改动，都是 P0 违法。

任何声称“只有 smoke 通过就算健康”的改动，都是 P0 违法。

## [APEX-AUDIT-001-V1] 质检系统唯一主链

```apex-law
{
  "lawId": "APEX-AUDIT-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "audit-system",
  "enforcementMode": "meta",
  "evidenceMode": "hybrid",
  "summary": "The audit system must keep one real execution chain from laws to manifests to generated artifacts to runner.",
  "appliesTo": [
    "scripts/audit/**/*.{ts,js,mjs,json}",
    ".github/workflows/**/*.yml"
  ],
  "forbidden": [
    "Manual enforcement matrix truth.",
    "ci:full bypassing codex:entry-gate.",
    "Runner-owned law binding truth.",
    "Parallel audit truth chains."
  ]
}
```

### 主题
质检系统唯一主链

### 法条
APEX 质检系统的唯一主链是：

**package.json ci:full → codex:entry-gate → law → manifest → generated artifacts → runner**

其中：

1. `package.json ci:full` 必须先经过 `codex:entry-gate`。
2. `law` 是唯一规则源。
3. `manifest` 是唯一脚本归属源。
4. `generated artifacts` 是唯一运行计划源。
5. `runner` 只执行，不裁定规则，不手工绑定 law。

### 禁止
禁止以下形态成为质检系统真相源：

- 手工维护的 enforcement matrix
- `ci:full` 绕过 `codex:entry-gate`
- runner 内置 lawId 列表
- runner 内置脚本顺序真相
- runner 内置 capability owner 绑定
- 补丁型 mapping / orphan / zombie / unenforced 平行真相链

## [APEX-AUDIT-002-V1] 法案文件主权

```apex-law
{
  "lawId": "APEX-AUDIT-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "audit-system",
  "enforcementMode": "meta",
  "evidenceMode": "hybrid",
  "summary": "Each active audit law must remain structurally parseable from the law file with stable metadata.",
  "appliesTo": [
    "scripts/audit/**/*.{ts,js,mjs,json}"
  ],
  "forbidden": [
    "Unstructured active laws that cannot be parsed stably.",
    "Hard-binding inspector filenames inside the law body.",
    "One law spanning multiple capability domains."
  ]
}
```

### 主题
法案文件主权

### 法条
每条 active law 必须从法案文件中可被稳定解析。

当前主链只承认唯一机器 schema：

- active law metadata 必须使用 fenced block：```apex-law
- active lawId 必须属于 `APEX-*` 体系
- active law 不得使用 ```law
- active law 不得使用 `WEB-*` lawId
- active law 不得依赖纯 markdown / prose inference 成为机器真相

每个 `apex-law` metadata 至少包含：

- lawId
- status
- tier
- capabilityDomain
- enforcementMode
- evidenceMode
- summary

法案文件只声明法条主权，不直接声明 inspector 文件名。
法案通过 `capabilityDomain` 归属到 owner inspector。

### 禁止
禁止以下写法：

- 只写自然语言、无法稳定抽取 lawId / status / capabilityDomain
- 使用非 `apex-law` fenced schema 作为 active law metadata
- 使用非 `APEX-*` lawId 进入当前主链
- 在法案里直接写脚本文件名作为硬绑定
- 一个法条横跨多个 capabilityDomain
- retired law 继续被 active matrix 执行

## [APEX-AUDIT-003-V1] 一个能力域一个 owner inspector

```apex-law
{
  "lawId": "APEX-AUDIT-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "audit-system",
  "enforcementMode": "meta",
  "evidenceMode": "hybrid",
  "summary": "Each capabilityDomain must have one owner inspector and one manifest-owned execution authority.",
  "appliesTo": [
    "scripts/audit/**/*.{ts,js,mjs,json}"
  ],
  "forbidden": [
    "One script carrying multiple capability domains.",
    "Multiple owner inspectors for one capability domain.",
    "Helper or wrapper paths pretending to be owner inspectors."
  ]
}
```

### 主题
一个能力域一个 owner inspector

### 法条
每个 `capabilityDomain` 只允许一个 `owner inspector`。

owner inspector 负责：

- 解释本能力域 active law 的可执法部分
- 输出统一 InspectorResult
- 只上报本能力域允许的 lawId
- 对本域执法真实性负责

辅助函数、helper、components 可以存在，但不构成平行 owner。

### 禁止
禁止以下形态：

- 一个脚本代持多个能力域
- 一个能力域多个 owner inspector
- helper / wrapper / delegate 伪装成主执法脚本
- inspector 越权上报非本域 lawId

## [APEX-AUDIT-004-V1] 自动生成矩阵

```apex-law
{
  "lawId": "APEX-AUDIT-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "audit-system",
  "enforcementMode": "meta",
  "evidenceMode": "hybrid",
  "summary": "The law registry, enforcement matrix, audit plan, and conflict snapshots must be generated artifacts.",
  "appliesTo": [
    "scripts/audit/**/*.{ts,js,mjs,json}"
  ],
  "forbidden": [
    "Manual editing of generated audit artifacts.",
    "Runner consumption of legacy manual matrix files.",
    "CI skipping artifact regeneration."
  ]
}
```

### 主题
自动生成矩阵

### 法条
`enforcement matrix`、`law registry`、`audit plan` 必须由生成器自动生成。
generated artifacts 是运行产物，不是人工源文件。

至少生成：

- `law-registry.generated.json`
- `enforcement-matrix.generated.json`
- `enforcement-matrix.generated.yaml`
- `audit-plan.generated.json`
- `audit-conflicts.generated.json`

### 禁止
禁止以下行为：

- 手工编辑 generated matrix 作为运行真相
- runner 直接读取旧版手工 matrix
- law / manifest / generated matrix 三者不一致仍继续运行
- CI-FULL 跳过 artifacts regenerate

## [APEX-AUDIT-005-V1] runner 权限边界

```apex-law
{
  "lawId": "APEX-AUDIT-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "audit-system",
  "enforcementMode": "meta",
  "evidenceMode": "hybrid",
  "summary": "The runner is an executor only and must not own law truth, ordering truth, or binding truth.",
  "appliesTo": [
    "scripts/audit/**/*.{ts,js,mjs,json}"
  ],
  "forbidden": [
    "Runner-maintained manual script ordering truth.",
    "Runner-maintained law to inspector mapping.",
    "Runner interpreting business laws directly."
  ]
}
```

### 主题
runner 权限边界

### 法条
runner 是执行器，不是规则中心。runner 只允许：

1. 调用 artifacts 生成器
2. 调用 audit-system 元质检
3. 读取 generated audit plan
4. 共享 Project / diagnostics / cache
5. 调度 owner inspector
6. 汇总结果

runner 不拥有法条定义权、绑定权、顺序主权。

### 禁止
禁止 runner：

- 维护手工脚本顺序真相
- 手工维护 law ↔ script 映射
- 绕过 generated plan 直接执行旧 inspector 列表
- 在 runner 内解释业务法案内容

## [APEX-AUDIT-006-V1] 执法真实性

```apex-law
{
  "lawId": "APEX-AUDIT-006-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "audit-system",
  "enforcementMode": "meta",
  "evidenceMode": "hybrid",
  "summary": "Inspector evidence must remain consistent with the declared evidenceMode and cannot fake AST or hybrid enforcement.",
  "appliesTo": [
    "scripts/audit/**/*.{ts,js,mjs,json}"
  ],
  "forbidden": [
    "String search pretending to be AST primary judgment.",
    "Blind delegate or hollow enforcement.",
    "Blueprint or law drift hidden behind PASS results."
  ]
}
```

### 主题
执法真实性

### 法条
执法脚本必须与 `evidenceMode` 一致：

- `ast`：以 AST / symbol / type checker / anti-evasion 为主裁
- `fs`：以文件系统结构 / 存在性 / 拓扑为主裁
- `config`：以可解析配置对象为主裁
- `hybrid`：多证据源协同，但必须声明并执行一个主裁路径

凡涉及 TS / TSX 语义判断，主裁证据必须来自 AST / symbol / type checker。
若 `engine=ast` 或 TS-facing `hybrid`，则字符串搜索、`getFullText`、`includes`、纯 grep 只能作为辅助证据，不能冒充主裁。
若 `engine=fs`，则审计对象必须天然属于文件系统拓扑、目录落位、锚点存在性这一类结构问题。

### 禁止
禁止以下形态：

- 字符串搜索冒充 AST 主裁
- blind delegate
- hollow enforcement
- fake enforcement
- law home 缺失仍宣称执法成立
- blueprint 锚点缺失仍宣称施工图已接入
- 未声明 primary evidence 却宣称 auto / meta 静态执法成立

## [APEX-AUDIT-007-V1] 法案—施工图—脚本闭环

```apex-law
{
  "lawId": "APEX-AUDIT-007-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "audit-system",
  "enforcementMode": "meta",
  "evidenceMode": "hybrid",
  "summary": "Law, blueprint, and inspector must form a closed authority chain whenever blueprint-backed enforcement is declared.",
  "appliesTo": [
    "scripts/audit/**/*.{ts,js,mjs,json}",
    "docs/法案辅助文件/*.md"
  ],
  "forbidden": [
    "Inspector claiming blueprint integration without reading blueprint anchors.",
    "PASS results when law or blueprint anchors are missing.",
    "Blueprint-only or law-only enforcement claims."
  ]
}
```

### 主题
法案—施工图—脚本闭环

### 法条
每个 owner inspector 若声明自己依赖施工图，则必须同时验证：

1. 对应 law section 存在
2. 对应 blueprint 主矩阵存在
3. 对应 blueprint 次级矩阵存在（若本域需要）
4. 对应 blueprint 验收线存在

若任一锚点缺失，必须直接报 drift / fake enforcement，而不是静默降级。

所有 active auto/meta auto / meta law 的静态执法闭环必须升级到 clause 级：

**lawId → clauseId → inspectorCheckId / sourceEvidence → generated coverage**

lawId 级覆盖不能证明法条级覆盖。

### 禁止
禁止以下形态：

- 脚本只读 law，不读 blueprint，却声称已施工图接入
- 脚本只读 blueprint，不校验 law home
- law / blueprint 锚点缺失但继续给 PASS
- 施工图与法案分离漂移后无告警
- 只有 lawId coverage、没有 clauseId coverage 却宣称闭环完成

## [APEX-AUDIT-008-V1] 元质检闭环

```apex-law
{
  "lawId": "APEX-AUDIT-008-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "audit-system",
  "enforcementMode": "meta",
  "evidenceMode": "hybrid",
  "summary": "The audit system must have a meta-inspection capability domain that can inspect the audit system itself.",
  "appliesTo": [
    "scripts/audit/**/*.{ts,js,mjs,json}"
  ],
  "forbidden": [
    "Dispersed patch scripts holding long-term system-level audit truth.",
    "Generated-artifact drift with no meta inspector alarm.",
    "Duplicate owner or fake enforcement escaping the audit-system gate."
  ]
}
```

### 主题
元质检闭环

### 法条
质检系统必须拥有 audit-system 元质检能力域，用来审计质检系统自己。

元质检至少覆盖：

- duplicate lawId
- duplicate owner inspector
- auto law 无 owner inspector
- inspector manifest 指向不存在 entry
- inspector 越权上报 lawId
- `package.json` 的 `ci:full` 未先经过 `codex:entry-gate`
- runner 仍读取手工 matrix
- generated artifacts 缺失或脏
- `static-clause-coverage.generated.json` 缺失或未 100% 覆盖 active auto/meta auto / meta static clauses
- fake enforcement / drift / hollow enforcement

### 禁止
禁止把这些系统级问题分散到大量补丁型巡检脚本中长期共存。
若仍需要存在，只允许收敛到：

- 单一 artifacts 生成器
- 单一 audit-system 元质检脚本

## [APEX-AUDIT-009-V1] 删除优先级

```apex-law
{
  "lawId": "APEX-AUDIT-009-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "audit-system",
  "enforcementMode": "meta",
  "evidenceMode": "hybrid",
  "summary": "Manual matrix truth, duplicate mappings, giant cross-domain inspectors, and retired enforcement remnants should converge toward deletion.",
  "appliesTo": [
    "scripts/audit/**/*.{ts,js,mjs,json}"
  ],
  "forbidden": [
    "Manual matrix truth surviving as runtime authority.",
    "Parallel registry or mapping chains.",
    "Generated and source files with overlapping authority."
  ]
}
```

### 主题
删除优先级

### 法条
凡以下对象，默认进入删除或收敛名单：

- 手工维护 matrix 真相
- 平行 registry / mapping / orphan / zombie 补丁链
- 巨型跨域 inspector
- 无主 owner
- retired law 残留执法
- generated 与源码职责重叠的旧文件

完成标准不是“文件都在”，而是“系统真相单一、执行链闭合、CI-FULL 自动成立”。

retired law、non-runnable law、historical prompt 只能作为 historical reference 存在，不得进入 current router / generated audit plan / matrix。
generated truth 不得与源码 truth 重叠。

### 禁止
- 手工维护 matrix 真相继续作为运行时主权
- 平行 registry 或 mapping 链继续与 generated truth 并存
- 巨型跨域 inspector 继续代持多个能力域
- retired law 残留执法继续占用现役执行面
- historical prompt 继续作为当前治理入口
- non-runnable law 进入 current matrix

## [APEX-AUDIT-010-V1] 二元裁决主权

```apex-law
{
  "lawId": "APEX-AUDIT-010-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "audit-system",
  "enforcementMode": "meta",
  "evidenceMode": "hybrid",
  "summary": "Executable audit outputs must be binary PASS/FAIL results only and must not introduce warning-grade verdict tiers."
}
```

### 主题
二元裁决主权

### 法条
所有 owner report、generated report、generated summary、runner gate 的执行态结果只能是：

- `PASS`
- `FAIL`

任一 finding 一旦被执行态报告发出，该报告的执行态必须为 `FAIL`。
finding 可以解释失败原因和整改动作，但不能自成第三种结果状态。

### 禁止

- `warning` 作为执行态 verdict
- `advisory` 作为执行态 verdict
- `partial enforcement` 作为通过态 verdict
- `soft fail`、`yellow pass`、`pass with warning`
- summary 统计 warning 并仍给 PASS

## 现役主权基线

这是 APEX 质检系统的现役主权法案。
它只定义质检系统如何成立，不代替任何业务域法案本身。

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
  ],
  "clauses": [
    {
      "clauseId": "apex-audit-001-requirement",
      "statement": "The audit system must keep one real execution chain from laws to manifests to generated artifacts to runner.",
      "evidenceMode": "static",
      "ownerDomain": "audit-system"
    }
  ]
}
```

### 主题
质检系统唯一主链

### 法条
APEX 质检系统的唯一主链是：

**package.json ci:full → codex:entry-gate → active law clause → explicit manifest binding → generated artifacts → runner receipt → owner report**

其中：

1. `package.json ci:full` 必须先经过 `codex:entry-gate`。
2. `law` 是唯一规则源。
3. `manifest` 是唯一脚本归属源；每条 active clause 必须显式绑定 `clauseId`、`checkIds` 与 `sourceEvidence`。
4. `generated artifacts` 是唯一运行计划源。
5. `runner` 只执行，不裁定规则，不手工绑定 law；它必须核对 owner 返回的单一 assertion-set 物理执行回执。失败诊断类别不得冒充额外物理检查。

当前仓库不设 GitHub Actions 质检入口，`.github/workflows` 必须保持无 workflow 文件。任何未来 workflow 若要运行质检，必须先取得 active 法案与施工图授权，并且只能调用唯一 `npm run ci:full`；在该授权出现前，workflow 文件本身就是第二入口风险，audit-system 必须按文件系统事实直接 FAIL，不得用 YAML 文本扫描、隐藏 allowlist 或第二 workflow registry 放行。

### 禁止
禁止以下形态成为质检系统真相源：

- 手工维护的 enforcement matrix
- `ci:full` 绕过 `codex:entry-gate`
- 未获 active 权威授权即新增 `.github/workflows` 质检或自动化入口
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
  ],
  "clauses": [
    {
      "clauseId": "apex-audit-002-requirement",
      "statement": "Each active audit law must remain structurally parseable from the law file with stable metadata.",
      "evidenceMode": "static",
      "ownerDomain": "audit-system"
    }
  ]
}
```

### 主题
法案文件主权

### 法条
每条 active law 必须从法案文件中可被稳定解析。

当前主链只承认唯一机器 schema：

- active law metadata 必须使用 fenced block：```apex-law
- active lawId 必须属于现役 `APEX-*` 或 `GRASSEYE-*` 体系
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
- 使用非 `APEX-*` / `GRASSEYE-*` lawId 进入当前主链
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
  ],
  "clauses": [
    {
      "clauseId": "apex-audit-003-requirement",
      "statement": "Each capabilityDomain must have one owner inspector and one manifest-owned execution authority.",
      "evidenceMode": "static",
      "ownerDomain": "audit-system"
    }
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
- 返回与 generated plan 完全一致、无缺失、无重复、无越权的 owner assertion-set `executedChecks` 映射和唯一物理回执

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
  ],
  "clauses": [
    {
      "clauseId": "apex-audit-004-requirement",
      "statement": "The law registry, enforcement matrix, audit plan, and conflict snapshots must be generated artifacts.",
      "evidenceMode": "static",
      "ownerDomain": "audit-system"
    }
  ]
}
```

### 主题
自动生成矩阵

### 法条
`enforcement matrix`、`law registry`、`audit plan` 必须由生成器自动生成。
generated artifacts 是运行产物，不是人工源文件。

clause coverage 必须区分证据层：所有 active clause 都必须被 manifest 精确绑定；只有 `static` / `acceptance` 机器条款可以由普通 CI owner receipt 计为 executed。`real-chrome` 条款只能在 generated truth 中列为 deferred browser evidence，普通 owner callback、typecheck 或本地 acceptance 永远不得把它标记为已执行。

因此 owner report 的 `executedChecks` 和 runner 的 expected executed mappings 都必须在签发前物理排除 `evidenceMode=real-chrome`；不能先写入 owner report，再只在最终 coverage summary 里过滤。元质检和攻击验收必须同时阻断该越层回归。

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
  "codePurityLiveness": {
    "externalEntryFiles": [
      "scripts/audit/core/run-generated-plan-worker.mjs"
    ],
    "lawfulDynamicImports": [
      {
        "consumerFilePath": "scripts/audit/core/run-generated-plan-worker.mjs",
        "targetFilePath": "scripts/audit/core/run-generated-plan-worker.ts"
      }
    ]
  },
  "appliesTo": [
    "scripts/audit/**/*.{ts,js,mjs,json}"
  ],
  "forbidden": [
    "Runner-maintained manual script ordering truth.",
    "Runner-maintained law to inspector mapping.",
    "Runner interpreting business laws directly."
  ],
  "clauses": [
    {
      "clauseId": "apex-audit-005-requirement",
      "statement": "The runner is an executor only and must not own law truth, ordering truth, or binding truth.",
      "evidenceMode": "static",
      "ownerDomain": "audit-system"
    }
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
7. 校验每个 `(lawId, clauseId, owner-assertion-set)` 映射、唯一物理回执与 finding 的 law/clause 归属

一个 owner 的完整 assertion set 只能在一个 runner-signed evaluation window 内执行一次，并且 manifest 只能登记一个 `<capabilityDomain>/owner-assertion-set` 物理检查。细粒度 finding `checkId` 只是失败诊断类别，不得进入 `executedChecks` 或伪造独立 `checkRunId`。禁止为 K 个诊断类别重复 K 次整域扫描，也禁止在窗口外预计算后抄写回执。

CI-FULL 的每个外部命令必须有固定 hard deadline，并在超时时终止完整进程组；generated-plan owner 执行必须位于可终止的独立 worker deadline 内，不能靠同进程 `Promise.race` 冒充取消。package.json 中供人工使用的 `&&` acceptance group 不得作为 CI 物理回执；CI 必须递归展开为去重后的直接物理叶，每叶独立记录 command、owner、lawId、startedAt、endedAt、duration、timeout 和 PASS/FAIL，失败后的其余叶必须逐项记为 skipped。任何 acceptance 需要验证用户交付复制时，必须把交付目录注入本次临时目录并在 `finally` 递归清理；禁止向真实 `~/Downloads` 写入会跨次累积的测试产物。

超时终止必须等待并记录进程组或 worker 的真实 terminal receipt；只发送 `SIGTERM`/`SIGKILL`、使用 `unref` 定时器、在 leader 退出后立即返回，或在终态未证实时谎报“已终止”，都不构成完整清理。终态无法证实时必须保留真实 cleanup error 并立即 fail closed，不得启动下一物理步骤。失败物理步骤本身必须先以 `FAIL` 写入 completed receipt，再生成 fail-fast summary；它不得从 completed 与 skipped 两边同时消失。每个外部物理步骤均须绑定非空 lawId；typecheck 绑定 `APEX-CODE-PURITY-008-V1`。每个 acceptance 物理叶必须由显式 file-to-law binding 绑定其直接项目法案并验证该法案属于该 owner，且绑定目标不得含 `evidenceMode=real-chrome`；禁止从 owner 的 `lawIds[0]` 批量抄写。owner inspector 及其域内 helper 只返回 report payload，不得调用 filesystem mutation API；generated report 只能由唯一 generated-plan runner 写入，owner 私有 report writer 必须物理退休。

runner 不拥有法条定义权、绑定权、顺序主权。

### 禁止
禁止 runner：

- 维护手工脚本顺序真相
- 手工维护 law ↔ script 映射
- 绕过 generated plan 直接执行旧 inspector 列表
- 在 runner 内解释业务法案内容
- 接受缺失、重复、越权或 manifest 未声明的执行回执
- 用普通 CI receipt 把 `real-chrome` clause 标记成 executed
- 反复执行整域 evaluation 后按诊断 checkId 过滤或批量伪造物理回执
- 用无 hard deadline 的 child/owner 执行，或把多个 acceptance 叶压成一个 group receipt
- 在 `ci:full` 中为某个 owner 建立特判、排除列表或第二次补跑

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
  ],
  "clauses": [
    {
      "clauseId": "apex-audit-006-requirement",
      "statement": "Inspector evidence must remain consistent with the declared evidenceMode and cannot fake AST or hybrid enforcement.",
      "evidenceMode": "static",
      "ownerDomain": "audit-system"
    }
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

`hybrid` 法条的 owner manifest binding 必须使用唯一结构字段
`primaryEvidence: { engine, sourceEvidenceIndex }` 明示主裁引擎，并精确指向同一 binding 的
`sourceEvidence`；生成链必须投影该声明，audit-system 元质检必须对缺失或越界索引 fail closed。

凡涉及 TS / TSX 语义判断，主裁证据必须来自 AST / symbol / type checker。
若 `engine=ast` 或 TS-facing `hybrid`，则字符串搜索、`getFullText`、`includes`、纯 grep 只能作为辅助证据，不能冒充主裁。
若 `engine=fs`，则审计对象必须天然属于文件系统拓扑、目录落位、锚点存在性这一类结构问题。
凡涉及 owner-boundary、import-graph、zombie reachability，`import` 与 `re-export` 都必须进入主裁图；只查 import 放过 barrel laundering 视为伪执法。
凡涉及 entry / liveness exemption，豁免必须来自 `package.json`、generated plan、或 active law 的结构性真相；`index.ts`、`contract.ts`、`schema.ts`、type-contract 等文件类别不得整类放行。
active law 若授权 Code Purity 活性面，只能在所属法条的 `codePurityLiveness` 结构字段中精确声明 file / export / edge 三元组，并由 generated law registry 唯一投影给 inspector；禁止在 inspector 源码中再维护一份豁免数组。

### 禁止
禁止以下形态：

- 字符串搜索冒充 AST 主裁
- blind delegate
- 只查 import 不查 re-export 的 owner / zombie 审计
- 按文件类别整类豁免边界或活性
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
  ],
  "clauses": [
    {
      "clauseId": "apex-audit-007-requirement",
      "statement": "Law, blueprint, and inspector must form a closed authority chain whenever blueprint-backed enforcement is declared.",
      "evidenceMode": "static",
      "ownerDomain": "audit-system"
    }
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
  ],
  "clauses": [
    {
      "clauseId": "apex-audit-008-requirement",
      "statement": "The audit system must have a meta-inspection capability domain that can inspect the audit system itself.",
      "evidenceMode": "static",
      "ownerDomain": "audit-system"
    }
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
- `static-clause-coverage.generated.json` 缺失、未 100% 绑定 active clauses、未 100% 执行机器条款，或把 real-Chrome 条款混入机器 executed coverage
- fake enforcement / drift / hollow enforcement
- active clause 缺失显式 manifest binding
- manifest 不是唯一的 `<capabilityDomain>/owner-assertion-set`，或把诊断类别登记成物理检查
- owner 缺失、重复或越权的 executed-check receipt
- `ci:full` 过滤、排除或单独补跑任一 owner

### 禁止
禁止把这些系统级问题分散到大量补丁型巡检脚本中长期共存。
若仍需要存在，只允许收敛到：

- 单一 artifacts 生成器
- 单一 audit-system 元质检脚本

## [APEX-AUDIT-TRUTH-001-V1] Inspector 执法真值

```apex-law
{
  "lawId": "APEX-AUDIT-TRUTH-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "audit-truth",
  "enforcementMode": "meta",
  "evidenceMode": "ast+project",
  "summary": "Owner inspectors must use project-backed AST evidence and must not launder source-text search into structural judgment.",
  "appliesTo": [
    "scripts/audit/**/*.{ts,js,mjs}"
  ],
  "forbidden": [
    "Owner inspector skipping context.project.",
    "getText/getFullText string search used as structural verdict.",
    "Regex-based structural judgment in audit owner or shared audit code.",
    "Text-search anti-evasion pretending to be AST-first enforcement."
  ],
  "clauses": [
    {
      "clauseId": "apex-audit-truth-001-requirement",
      "statement": "Owner inspectors must use project-backed AST evidence and must not launder source-text search into structural judgment.",
      "evidenceMode": "static",
      "ownerDomain": "audit-truth"
    }
  ]
}
```

### 主题
Inspector 执法真值

### 法条
所有 owner inspector 必须通过 `context.project` 进入 ts-morph project 真相。

凡涉及结构、owner、graph、entry、coverage、runtime contract 等 TS-facing 判断：

- 主裁必须来自 AST / symbol / project graph
- `getText`、`getFullText`、`includes`、`match`、`test` 只能作为辅助线索，不能变成 verdict 真相
- `scripts/audit/domains/**` 与 `scripts/audit/shared/**` 中的 regex literal、`RegExp`、regex-driven `match/search/test/exec/split` 不得冒充结构判断
- inspector 若不接入 `context.project`，视为无法证明 AST-first enforcement

### 禁止

- inspector 不使用 `context.project`
- 把 source text 搜索包装成 anti-evasion 或 coverage 判断
- 把 regex 判断包装成 coverage、owner、graph、entry、contract、summary 真相
- 用 tracked text variable 做 `includes` / `match` / `test` 后宣称是结构判断

## [APEX-AUDIT-TRUTH-002-V1] Generated Plan Owner Coverage Truth

```apex-law
{
  "lawId": "APEX-AUDIT-TRUTH-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "audit-truth",
  "enforcementMode": "meta",
  "evidenceMode": "generated-plan+project",
  "summary": "Generated plan must cover every owner inspector exactly once and must not contain orphan owner paths.",
  "appliesTo": [
    "scripts/audit/**/*.{ts,js,mjs,json}"
  ],
  "forbidden": [
    "Owner inspector missing from generated plan.",
    "Generated plan pointing to orphan owner inspector path.",
    "Plan truth and real inspector surface drifting apart."
  ],
  "clauses": [
    {
      "clauseId": "apex-audit-truth-002-requirement",
      "statement": "Generated plan must cover every owner inspector exactly once and must not contain orphan owner paths.",
      "evidenceMode": "static",
      "ownerDomain": "audit-truth"
    }
  ]
}
```

### 主题
Generated Plan Owner Coverage Truth

### 法条
generated plan 必须与真实 owner inspector 面一一对应。

至少要求：

- 每个真实 owner inspector 都有且只有一个 generated-plan entry
- generated-plan entry 指向的 owner inspector 必须真实存在于 project 中
- owner coverage 漂移必须 machine-blocking，而不是留给人工猜测
- `ci:full` 必须只调用一次未过滤的完整 generated plan；不得先排除某 owner 再单独补跑

### 禁止

- 新增 owner inspector 但 generated plan 不接入
- generated plan 指向不存在或已删除的 owner inspector
- 以旧 summary 或旧 report 冒充当前 owner coverage 真相

质检系统的文字法条是最低边界，不是最高边界。
只要 owner inspector 能用同一条 AST / project / generated-plan 主裁链证明更强的漂移、假覆盖、假执行、或明显腐烂面，就必须直接 FAIL，不能用“法条还没细写到这句”作为放过理由。

## [GRASSEYE-AUDIT-META-QUALITY-AST-SYMBOL-NO-REGEX-V1] Audit Meta Quality AST / Symbol / No Regex

```apex-law
{
  "lawId": "GRASSEYE-AUDIT-META-QUALITY-AST-SYMBOL-NO-REGEX-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "audit-truth",
  "enforcementMode": "meta",
  "evidenceMode": "ast+symbol+project+acceptance",
  "summary": "The audit-truth owner and its proof scripts must stay AST-first, symbol-backed, anti-evasion, and free of regex-driven governance logic.",
  "appliesTo": [
    "scripts/audit/domains/audit-truth/**/*.{ts,js,mjs}",
    "scripts/acceptance/audit-truth-coverage.acceptance.ts"
  ],
  "forbidden": [
    "RegularExpressionLiteral inside audit meta-quality owner or proof scope.",
    "new RegExp or aliased RegExp construction inside audit meta-quality owner or proof scope.",
    "match/matchAll/search/test/replace/replaceAll/split/exec based governance logic inside audit meta-quality owner or proof scope.",
    "Dynamic property or prototype-call escape that cannot be disproven with AST and symbol evidence.",
    "Raw source-text laundering inside audit meta-quality proof scripts."
  ],
  "clauses": [
    {
      "clauseId": "grasseye-audit-meta-quality-ast-symbol-no-regex-requirement",
      "statement": "The audit-truth owner and its proof scripts must stay AST-first, symbol-backed, anti-evasion, and free of regex-driven governance logic.",
      "evidenceMode": "acceptance",
      "ownerDomain": "audit-truth"
    }
  ]
}
```

### 主题
Audit 元质检 AST / Symbol / No Regex

### 法条
`audit-truth` owner 与它的 acceptance proof 只能用 `ts-morph Project + SourceFile + SyntaxKind + Symbol` 做治理执法。

至少要求：

- 不得在 owner 或 proof 内保留 regex literal
- 不得保留 `new RegExp()` 或构造器别名逃逸
- 不得保留 `match`、`matchAll`、`search`、`test`、`replace`、`replaceAll`、`split`、`exec` 作为治理判断
- 动态属性调用若可能指向上述 regex/string judgment 方法，且 AST + symbol 不能排除，必须直接 FAIL
- proof 若对 `context.project` / `SourceFile` / `getFullText` / `getText` 做原文扫描并据此裁决，必须直接 FAIL

### 禁止

- 正则字面量伪装 anti-evasion
- `RegExp` 构造器或构造器别名伪装 anti-evasion
- `String.prototype.match.call(...)`、`text[method](...)` 等动态逃逸
- audit-truth acceptance proof 退化成 raw string scanning

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
  ],
  "clauses": [
    {
      "clauseId": "apex-audit-009-requirement",
      "statement": "Manual matrix truth, duplicate mappings, giant cross-domain inspectors, and retired enforcement remnants should converge toward deletion.",
      "evidenceMode": "static",
      "ownerDomain": "audit-system"
    }
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
  "summary": "Executable audit outputs must be binary PASS/FAIL results only and must not introduce warning-grade verdict tiers.",
  "clauses": [
    {
      "clauseId": "apex-audit-010-requirement",
      "statement": "Executable audit outputs must be binary PASS/FAIL results only and must not introduce warning-grade verdict tiers.",
      "evidenceMode": "static",
      "ownerDomain": "audit-system"
    }
  ]
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

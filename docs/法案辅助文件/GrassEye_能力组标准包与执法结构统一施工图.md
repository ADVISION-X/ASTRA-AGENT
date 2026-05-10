# GrassEye 能力组标准包与执法结构统一施工图 V1.0

## 0. 文件定位

本文件是 GrassEye 冻结法案之后的 **能力组建设统一施工图**。

它不是新法案，不新增 lawId，不修改冻结法案。

它的作用是把所有能力组统一成同一种生产级模式，避免 Codex 在每个能力组里继续用补丁、缝合、局部修复的方式施工。

本施工图用于指导：

1. 新能力组是否有资格立组。
2. 已有能力组如何从旧模式切换为标准能力组包。
3. 每个能力组必须具备什么目录结构。
4. 每个子能力必须具备什么结构。
5. 每个能力组的执法系统必须如何建设。
6. 四方攻击如何验收。
7. real-code-inspection 如何证明执法真实有效。
8. Codex 每轮交付必须满足什么标准。

一句话：

> 能力组是器官，子能力是组织，执行地图是神经程序，执法系统是免疫系统。本文件定义每个器官如何被生产级制造、验收和固化。

---

## 1. 当前冻结基线

GrassEye 当前法案源头已冻结。

后续施工不得修改：

- `.github/instructions/cursor-rules/**`
- `docs/法案辅助文件/GrassEye 法案冻结基线.md`

除非用户明确下达：

```txt
解冻法案
```

否则所有迭代都必须让代码、执法、生成物服从冻结法案。

### 1.1 当前 active ability groups

固定为 14 个：

1. commander-console
2. orchestration
3. nerve-bus
4. ai
5. open
6. screenshot
7. visual-target
8. geometry-guard
9. mouse-click
10. text-input
11. mouse-scroll
12. post-action-verification
13. forensics-persistence
14. page-state

### 1.2 当前 foundation laws

固定为 5 个：

1. audit-system
2. capability-group-governance
3. code-purity
4. type-safety
5. security-privacy

### 1.3 当前 support governance domains

固定为 1 个：

1. map-plugin-package

### 1.4 当前子契约归属

| 子契约 | 父 owner | 是否 active owner | inspector 归属 |
| --- | --- | --- | --- |
| local-ai-runtime | ai-capability | 否 | ai-capability |
| local-browser-session | open-capability | 否 | open-capability |
| local-app-shell | commander-console-capability | 否 | commander-console-capability |
| startup-entrypoint | commander-console-capability | 否 | commander-console-capability |
| structured-logging | forensics-persistence-capability | 否 | forensics-persistence-capability |
| local-persistence-schema | forensics-persistence-capability | 否 | forensics-persistence-capability |
| platform-action | open-capability | 否 | open-capability |
| code-topology | capability-group-governance | 否 | capability-group-governance |
| code-purity | audit-system | 否 | audit-system |

### 1.5 禁止恢复的旧 owner

以下不得重新进入 active owner、phase gate、audit plan、runner：

- local-data
- localization
- platform-action as action owner
- local-ai-runtime as independent owner
- local-browser-session as independent owner
- local-app-shell as independent owner
- startup-entrypoint as independent owner
- structured-logging as independent owner
- local-persistence-schema as independent owner
- multi-frame-evidence as independent owner
- code-topology as independent owner
- code-purity as independent owner

---

## 2. 本施工图的最高原则

### 2.1 统一模式原则

后续所有能力组必须使用统一模式。

禁止每个能力组各写一套风格。

禁止：

- 这个能力组用大 adapter。
- 那个能力组用 God Facade。
- 另一个能力组用 metadata-only child。
- 某个能力组只靠 inspector 补洞。
- 某个能力组通过 helper 拼凑生产链。

所有能力组必须统一成：

```txt
Ability Group Standard Package
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── runtime/
├── children/
├── ports/
├── shared/
└── audit domain inspector
```

### 2.2 删除 / 删除后重构原则

代码文件只有两个处理方式：

```txt
A. 删除
B. 删除后重构
```

禁止第三种选择。

禁止补丁式修复。

禁止在旧文件上不断叠函数、叠 if、叠 helper、叠 exception。

如果旧文件已经形成以下形态，必须删除后重构：

- God Facade
- God Adapter
- metadata-only child
- 复制粘贴 child implementation
- export * barrel
- primitive port 暴露过宽
- Record<string, unknown> 生产透传
- 直接 new Date 分散在 child
- Date.parse 计算 duration
- naked throw 穿透 public execute
- fake success / fallback success
- warning-only / no-op pass
- 通过 any / unknown as / ts-ignore / eslint-disable 逃逸

### 2.3 能力组不得无限膨胀原则

当前痛苦是旧模式切换到标准模式的过渡成本，不是未来常态。

切换完成后，新增能力应套用本施工图，不应每次重建治理逻辑。

未来扩展重点不是无限增加 ability group，而是增加：

- child capability
- execution map
- prompt contract
- platform profile
- policy
- inspector rule

只有满足立组资格的对象，才能成为 ability group。

---

## 3. 立组资格判断

一个对象必须同时满足以下条件，才允许成为能力组：

1. 有独立 runtime 边界。
2. 有独立输入契约。
3. 有独立输出契约。
4. 有独立失败治理。
5. 有独立 proof / evidence 要求。
6. 有独立 inspector 必要。
7. 出错会造成系统级风险。
8. 不能自然归入现有父能力组作为 child capability。

如果不满足，不能立组，只能作为：

- child capability
- execution map node
- prompt contract
- platform profile
- policy
- resource contract
- helper，但 helper 不得持有 runtime 权力

### 3.1 允许成为能力组的典型对象

- AI
- Open
- Screenshot
- Visual Target
- Geometry Guard
- Mouse Click
- Text Input
- Mouse Scroll
- Page State
- Post-action Verification
- Forensics Persistence
- Commander Console
- Orchestration
- Nerve Bus

### 3.2 不允许成为能力组的典型对象

- prompt
- schema validator
- model roster
- platform profile
- local browser session
- local app shell
- owner evidence
- code topology
- code purity
- single click mode
- single scroll direction
- single prompt template
- single map node

这些必须归入父能力组或施工资源，不得成为 active owner。

---

## 4. 标准能力组目录结构

每个能力组必须使用以下标准结构。

```txt
src/capabilities/<ability-group>/
├── ability-group.ts
├── contract.ts
├── schema.ts
├── registry.ts
├── index.ts
├── runtime/
│   ├── <ability>-executor.ts
│   ├── <ability>-input-gate.ts
│   ├── <ability>-policy-gate.ts
│   ├── <ability>-boundary-gate.ts
│   ├── <ability>-result-builder.ts
│   ├── <ability>-proof-builder.ts
│   ├── <ability>-dispatch-failure.ts
│   ├── <ability>-idempotency.ts
│   └── <ability>-clock.ts
├── children/
│   ├── <child-a>/
│   │   ├── contract.ts
│   │   ├── schema.ts
│   │   └── implementation.ts
│   └── <child-b>/
│       ├── contract.ts
│       ├── schema.ts
│       └── implementation.ts
├── ports/
│   ├── <ability>-primary-port.ts
│   └── <ability>-clock-port.ts
└── shared/
    ├── <ability>-types.ts
    ├── <ability>-policy.ts
    ├── <ability>-result.ts
    ├── <ability>-proof.ts
    └── <ability>-failure.ts
```

不是所有能力都必须有 primary port，但如果能力接触外部系统、浏览器、文件、模型、primitive、storage，就必须通过 port。

---

## 5. 标准文件职责

### 5.1 ability-group.ts

只允许做：

1. 接收 public input。
2. 调用 schema parse。
3. 路由 childCapabilityId。
4. 调用 runtime executor。
5. 返回 governed result。

禁止：

- 直接执行业务细节。
- 直接调用外部 port。
- 直接构造 proof。
- 直接构造复杂 result。
- 直接写 storage。
- 直接调用其他能力组。
- 直接裸 throw。
- 聚合多个 child 的内部逻辑。

ability-group.ts 必须薄。

如果 ability-group.ts 超过“入口 + 路由 + executor 调用”的职责，必须删除后重构。

### 5.2 contract.ts

负责公开 TypeScript 契约。

只能放：

- ability group id
- child capability id union
- public input type
- public output type
- public result type
- public port type
- public policy type

禁止：

- 放运行逻辑。
- 放 schema parse 逻辑。
- 放 helper 实现。
- 放 default runtime。
- 放 child implementation。

### 5.3 schema.ts

负责所有 runtime schema。

必须包含：

- AbilityGroupIdSchema
- ChildCapabilityIdSchema
- PublicInputSchema
- PublicResultSchema
- RuntimeProofSchema
- 每个 child input schema
- 每个 child output schema

要求：

1. 所有 public input 必须先 parse。
2. 所有 output 返回前必须 parse。
3. childCapabilityId 与 registry 必须一致。
4. public result 与 owner evidence 必须强约束。
5. 不得用 TypeScript 类型替代 runtime schema。
6. 不得用 Record<string, unknown> 透传生产 payload。

### 5.4 registry.ts

负责注册 child capability。

必须包含：

- childCapabilityId
- child displayName
- child purpose
- child implementation entry
- child input schema ref
- child output schema ref
- child risk level
- child execution kind

禁止：

- 注册不存在的 child。
- 注册 metadata-only child。
- 注册 disabled child 但仍允许生产执行。
- registry 与 schema child id 漂移。

### 5.5 index.ts

index.ts 是公开出口。

禁止 `export *`。

只能显式 export：

- create<Ability>AbilityGroup
- ABILITY_GROUP_ID
- public input schema
- public result schema
- public input type
- public result type
- public port type
- list<Ability>Children

不得 export：

- child implementation
- runtime internals
- gate internals
- result builder
- proof builder
- mutable registry
- private helper
- primitive runner
- storage implementation

### 5.6 runtime/

runtime 是能力组内部生产链。

必须包含：

- executor
- input gate
- policy gate
- boundary gate
- result builder
- proof builder
- dispatch failure
- clock wrapper

根据能力风险可以增加：

- schema gate
- quality gate
- safety gate
- idempotency
- primitive runner
- storage gate
- integrity gate
- hash builder
- transformer
- pre-action gate
- post-action handoff gate

runtime 只能被 ability-group 或 child implementation 内部使用，不得从 index.ts 暴露。

### 5.7 children/

每个 child 必须是真子能力。

每个 child 至少包含：

```txt
children/<child>/
├── contract.ts
├── schema.ts
└── implementation.ts
```

implementation.ts 必须有真实 execute，不得只有：

- displayName
- purpose
- currentStrength
- metadata
- empty handler
- TODO
- throw not implemented
- fake success

每个 child 必须：

1. 接收已 parse 的 child input。
2. 调用 runtime executor 或 child-specific runtime gate。
3. 返回 governed result。
4. 不裸 throw。
5. 不绕过父能力组 executor。
6. 不越权调用其他能力组。

### 5.8 ports/

port 是能力组接触外部系统的唯一边界。

外部系统包括：

- browser
- local AI runtime
- mouse primitive
- scroll primitive
- storage
- file system
- clock
- network
- OS screen

要求：

1. port 只能定义接口，不直接实现生产逻辑。
2. primitive port 不得被 UI / Commander / Orchestration 直接 import。
3. port 调用必须经过 runtime runner。
4. port error 必须转成 governed failed result。
5. port success 必须进入 proof。

### 5.9 shared/

shared 只允许放稳定的小型类型和纯函数。

禁止 shared 变成：

- 业务真相 owner
- runtime executor
- storage writer
- hidden capability
- wrapper hiding forbidden call
- fallback success provider

如果 shared 里出现 runtime 权力，必须删除后重构到 runtime/ 或 child/。

---

## 6. 标准执行链

每个能力组必须统一为以下执行链：

```txt
public input
→ schema parse
→ child route
→ executor
→ input gate
→ policy gate
→ boundary gate
→ child execute
→ port / primitive / storage / model call if applicable
→ result builder
→ proof builder
→ output schema parse
→ governed result
```

禁止：

- public input 直接进 primitive。
- public input 直接进 storage。
- public input 直接进 model。
- child 绕过 executor。
- executor 绕过 policy gate。
- failed/review_required 返回可执行参数。
- port throw 穿透 public execute。

---

## 7. 统一 governed result 标准

每个能力组必须定义自己的 result，但结构必须符合统一模式。

```ts
type GovernedAbilityResult<TOutput> = {
  abilityGroupId: string;
  childCapabilityId: string;
  status: "success" | "failed" | "review_required";
  output: TOutput | null;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  runtimeProof: RuntimeProof;
  policyDecision: PolicyDecision;
  dataQualityFlags: string[];
};
```

动作类能力还必须包含：

- primitiveDecision
- preActionDecision
- postActionVerificationRequired
- idempotencyKey

证据类能力还必须包含：

- storageOperation
- integrityDecision
- storageRef
- recordRef
- artifactRefs

AI 类能力还必须包含：

- schemaValidationStatus
- confidence
- modelRole
- promptContractId

### 7.1 success 规则

success 必须表示真实执行成功。

禁止：

- schema invalid success
- primitive failed success
- storage failed success
- fake fallback success
- zero-action success
- disabled child success
- no-op success

### 7.2 failed / review_required 规则

failed / review_required 不得返回可执行输出。

例如：

- mouse-click failed 不得返回 executable click point。
- mouse-scroll failed 不得返回 executable delta。
- geometry-guard failed 不得返回 executable coordinate。
- AI schema invalid 不得返回 success output。
- Forensics storage failed 不得返回 committed recordRef。

---

## 8. 统一 owner evidence 标准

每个能力组必须有 runtimeProof。

最低字段：

```txt
proofId
runLockId
runId
missionId
sessionId
roundId
videoVisitId
abilityGroupId
childCapabilityId
sourceAbilityGroupId
sourceChildCapabilityId
inputRef
outputRef
startedAt
endedAt
durationMs
timeoutMs
cancellationTokenRef
resumeCheckpointRef
retryCount
maxRetry
status
failureReason
reviewRequiredReason
policyDecision
dataQualityFlags
```

动作类能力增加：

```txt
preActionDecision
primitiveDecision
postActionVerificationRequired
idempotencyKey
```

坐标类能力增加：

```txt
sourceCoordinateSpace
requestedExecutionSpace
normalizedCoordinateSpace
sourceBounds
targetBounds
bboxBefore
bboxAfter
clickPointBefore
clickPointAfter
scaleDecision
transformDecision
```

证据类能力增加：

```txt
recordType
recordId
storageOperation
storageRef
recordRef
artifactRefs
integrityHash
integrityDecision
idempotencyKey
```

AI 类能力增加：

```txt
promptContractId
expectedOutputSchema
schemaValidationStatus
modelRole
providerKind
confidence
inputRefs
outputRefs
```

### 8.1 时间规则

所有时间必须来自 clock port 或能力组统一 clock wrapper。

禁止：

- child 中到处 new Date
- Date.parse 直接计算 duration
- startedAt / endedAt 不校验

要求：

- startedAt <= endedAt
- durationMs >= 0
- failed/review_required 也必须有 proof

### 8.2 run-lock / cancel / recover

- runLockId 是一次执行锁的主键
- cancellationTokenRef 必须指向可取消的执行上下文
- resumeCheckpointRef 必须指向可恢复的检查点
- timeoutMs 只能来源于受治理 timeout policy
- retryCount 不得超过 maxRetry
- cancel / resume 不能只在终端文本里出现

---

## 9. 标准 policy / gate 模式

每个能力组根据风险必须建设 gate。

### 9.1 input gate

负责：

- schema parse
- child id 匹配
- required refs
- payload shape
- source identity

### 9.2 policy gate

负责：

- 当前阶段是否允许
- operator approval 是否需要
- paid / external / destructive / privileged 是否禁止
- risk level 是否允许
- source refs 是否完整

### 9.3 boundary gate

负责：

- 禁止越权调用其他能力组
- 禁止绕过父能力组
- 禁止 primitive 直接暴露
- 禁止 UI / Commander / Orchestration 直接调用内部 port

### 9.4 safety gate

动作类能力必须有 safety gate。

例如：

- click safety gate
- scroll safety gate
- geometry safety gate
- open target safety gate

### 9.5 idempotency gate

所有真实动作、写入、持久化能力必须有 idempotency。

必须防止：

- 重复点击
- 重复滚动
- 重复写 evidence
- 重复打开同一目标
- 重复提交人工命令

### 9.6 result gate

返回前必须 output schema parse。

禁止 TS satisfies 代替 runtime parse。

---

## 10. 执行地图与 Prompt 归属

### 10.1 执行地图归 Orchestration

执行地图负责：

- 调用顺序
- 分支条件
- 失败恢复
- 调用哪个 ability group / child capability
- 输入引用
- 输出引用
- review policy

能力组仍然静态冻结、受法案治理。

执行地图可以作为受控数据包插件，但地图插件包不属于能力组。

地图插件包只能被 Orchestration 读取、校验、选择和执行，不得成为 owner，不得执行代码。

Orchestration 只消费 active approved retired package chain。

### 10.2 Prompt 不立组

Prompt 不是能力组。

Prompt 正文归 AI Capability 的 prompt registry / prompt contract 管。

执行地图只能引用：

```txt
promptContractId
expectedOutputSchema
inputRefs
confidencePolicy
reviewPolicy
failureBranch
```

执行地图禁止保存 raw prompt 大段正文。

地图插件包只能保存 promptContractId，不得保存 raw prompt 正文。

---

## 11. 标准执法目录结构

每个能力组必须有同构 audit domain。

```txt
scripts/audit/domains/<ability>-capability/
├── manifest.json
├── inspector.ts
├── required-shape.ts
├── forbidden-shape.ts
├── boundary-attack.ts
├── anti-escape.ts
├── owner-inspection-harness.ts
└── ast-utils.ts, if needed
```

如果项目暂时不拆多个文件，inspector.ts 内部也必须保持同等结构：

```txt
runRequiredShapeAttack()
runForbiddenShapeAttack()
runBoundaryAttack()
runAntiEscapeAttack()
runGeneratedChainCheck()
runManifestCheck()
runRunnerFailPowerCheck()
```

---

## 12. ts-morph AST 强制要求

执法系统必须使用 ts-morph：

- Project
- SourceFile
- SyntaxKind
- TypeChecker
- Symbol
- AliasedSymbol
- ImportDeclaration
- ExportDeclaration
- CallExpression
- PropertyAccessExpression
- JsxElement
- findReferencesAsNodes

禁止用以下方式判断 TypeScript / TSX 结构：

- grep
- regex
- includes
- match
- search
- split
- 文本命中
- 行级字符串扫描

允许：

- fs / glob 枚举候选文件
- JSON.parse 读取 generated JSON
- path 精确匹配路径

但最终结构判断必须来自 AST / symbol / type / reference。

---

## 13. 四方攻击统一标准

每个能力组都必须承受四方攻击。

### 13.1 Required Shape Attack

证明该存在的真实存在。

必须检查：

- ability-group.ts 存在且薄入口
- contract.ts 存在
- schema.ts 存在
- registry.ts 存在
- index.ts 显式出口
- runtime executor 存在
- input gate 存在
- policy gate 存在
- result builder 存在
- proof builder 存在
- dispatch failure 存在
- clock port 存在，如涉及时间
- primitive/storage/model port 存在，如涉及外部系统
- 每个 child 有 contract/schema/implementation/execute
- output schema parse 存在
- registry 与 schema child ids 一致

### 13.2 Forbidden Shape Attack

证明不该存在的不存在。

通用禁止项：

- export *
- metadata-only child
- naked throw 穿透 public execute
- Record<string, unknown> 生产 payload 透传
- fake success
- fallback success
- warning-only pass
- no-op pass
- child 中直接 new Date
- Date.parse 直接算 duration
- output 不 parse
- generated 手写伪造
- primitive/storage/model throw 穿透
- failed/review_required 返回可执行输出

### 13.3 Boundary Attack

证明不能被其他 owner 抢权或绕过。

必须检查：

- 非 owner 不得实现该能力。
- UI 不得直接调用能力组内部 port。
- Commander 不得抢 runtime。
- Orchestration 只编排，不执行 primitive。
- Nerve Bus 只运输 envelope，不执行业务。
- child 不得绕过 parent executor。
- support 子契约不得恢复为 independent owner。

### 13.4 Anti-Escape Attack

证明不能通过技术逃逸绕过执法。

必须禁止：

- as any
- as unknown as
- @ts-ignore
- @ts-expect-error
- eslint-disable
- dynamic import
- require
- barrel export laundering
- re-export laundering
- alias laundering
- wrapper hiding forbidden call
- computed property hiding forbidden call
- fake fixture leaking into production
- no-op inspector
- warning-only inspector

---

## 14. real-code-inspection 统一标准

每个能力组必须做真实 regression 反证。

禁止只写“理论上会 fail”。

每条反证必须执行：

1. 写入临时破坏。
2. 运行对应 audit。
3. 观察 FAIL。
4. 回滚临时破坏。
5. 再运行 audit 恢复 PASS。

执行拓扑强制要求：

- spawned real-code-inspection harness 禁止对大量 regression 逐个重放完整 inspector。
- 多 regression spawned harness 必须合组 regression；高复杂 owner 必须按 phase 或等价执法切片缩小 nested inspector 范围。
- 非 law metadata regression 的 nested inspector 必须 `--skip-build`。
- re-inspect PASS 可以在所有 regression re-inspect 后统一执行一次，但必须真实证明恢复 PASS。
- audit-system owner 必须用 ts-morph AST 全仓检查 owner-inspection-harness 的 spawn、regression loop、re-inspect replay、`--skip-build` 与 grouping topology。

最低通用 regression：

1. 删除 input gate 调用 → audit FAIL → 回滚
2. 删除 policy gate 调用 → audit FAIL → 回滚
3. 删除 proof builder 调用 → audit FAIL → 回滚
4. child 改成 metadata-only → audit FAIL → 回滚
5. 加 export * → audit FAIL → 回滚
6. 加 naked throw → audit FAIL → 回滚
7. 加 as any → audit FAIL → 回滚
8. 加 dynamic import → audit FAIL → 回滚
9. 暴露 internal runtime → audit FAIL → 回滚
10. 移除 manifest lawId → audit FAIL → 回滚

动作类能力追加：

- primitive 直接被 child 调用 → audit FAIL
- failed 返回 executable output → audit FAIL
- 绕过 pre-action gate → audit FAIL

证据类能力追加：

- storage failure fake success → audit FAIL
- raw JSON.stringify hash → audit FAIL
- payload Record<string, unknown> → audit FAIL

AI 类能力追加：

- schema invalid success → audit FAIL
- paid/future 执行 → audit FAIL
- LocalAiGateway 旁路 → audit FAIL

---

## 15. generated 与 runner 同步

每次能力组重构必须同步：

- owner manifest
- generated law-registry
- generated enforcement-matrix
- generated audit-plan
- phase gate
- runner summary
- inspector
- health snapshot，如存在

禁止手写 generated 文件。

必须通过项目命令生成。

如果 generator 损坏，先修 generator，不能硬改 generated JSON。

---

## 16. Codex 标准施工流程

Codex 每次处理能力组，必须按以下顺序：

### Step 1：扫描

只读扫描：

- 当前能力组源码
- 当前 inspector
- 当前 manifest
- 当前 generated 链
- 当前施工图
- 调用方

输出极简：

```txt
[SCAN]
- ability:
- files:
- blockers:
- decision: DELETE / DELETE_AND_REBUILD
```

### Step 2：删除旧形态

删除所有缝合怪文件：

- God Facade
- God Adapter
- metadata child
- export * index
- overwide primitive port
- old shared helper with runtime power
- duplicated child implementation

### Step 3：重建标准包

按本施工图重建：

- ability-group
- contract
- schema
- registry
- index
- runtime
- children
- ports
- shared

### Step 4：同步 inspector

必须同步：

- required shape
- forbidden shape
- boundary attack
- anti-escape
- generated chain
- manifest lawId
- runner fail power

### Step 5：修复 inspector 发现的真实源码问题

如果 inspector 打出 FATAL / ERROR，必须修源码，不得降级 inspector。

### Step 6：real-code-inspection

必须做 regression fail + re-inspect。

### Step 7：全量命令

必须运行：

```bash
npm run ci:full
npm run ci:full
npm run typecheck
npm run lint
npm run ci:full
git diff --check
```

如果存在更细命令，也必须运行：

- CI-FULL internal metadata
- CI-FULL
- verify 仅可作为辅助，不得替代 audit

---

## 17. Codex 输出标准

Codex 最终只允许输出：

```txt
[ABILITY-REBUILD-RESULT]

1. Verdict
- before:
- after:

2. Delete / Rebuild
- deleted files:
- rebuilt files:
- new files:
- removed patch-style remnants:

3. Capability Body
- thin ability-group:
- real child execute:
- governed result:
- input schema:
- output schema:
- runtime gates:
- proof builder:
- clock port:
- idempotency:

4. Four Attacks
- required:
- forbidden:
- boundary:
- anti-escape:

5. real-code-inspection
- regression list:
- audit failed:
- re-inspect verified:

6. Commands
- ci:full:
- audit:
- typecheck:
- lint:
- ci:full:
- diff-check:

7. Residual
只能写：
- NONE
- PRE_EXISTING
- BLOCKED

8. Final
只能写：
- <ABILITY>_READY_TO_ESTABLISH
- <ABILITY>_NOT_READY
- BLOCKED

最后一行：
[ABILITY-AUDIT-COMPLETE]
```

禁止长篇解释。

禁止写：

- 基本完成
- 大致满足
- 理论上可行
- 建议后续优化
- 可能需要
- 可以考虑

---

## 18. 能力组 ready 判定

一个能力组只有同时满足以下条件，才能输出 READY_TO_ESTABLISH：

1. 不修改冻结法案。
2. 标准包结构完整。
3. 旧缝合文件已删除或删除后重构。
4. ability-group 是薄入口。
5. 每个 child 是真 execute。
6. 输入 runtime schema parse。
7. 输出 runtime schema parse。
8. 所有失败路径 governed。
9. 没有 naked throw 穿透 public execute。
10. 没有 fake success / fallback success。
11. 没有 export *。
12. 没有 any / unknown as / ts-ignore / eslint-disable。
13. 没有 metadata-only child。
14. 没有复制粘贴 child implementation。
15. 有 owner evidence。
16. 有 policy decision。
17. 有 real-code-inspection。
18. inspector 四方攻击闭合。
19. runner 可真实 fail。
20. CI 全量命令通过。

缺任一项，必须输出：

```txt
<ABILITY>_NOT_READY
```

---

## 19. 能力组不 ready 的处理

如果不 ready，Codex 不得粉饰。

必须输出：

```txt
<ABILITY>_NOT_READY
```

并列出：

- 仍未删除的旧文件
- 仍未重建的标准文件
- 仍无法证明的四方攻击
- 仍缺失的 real-code-inspection
- 仍失败的命令
- BLOCKED 的真实原因

---

## 20. 能力组工厂化目标

本施工图的最终目标不是让每个能力都写一份巨大提示词，而是形成统一生产线：

```txt
输入能力名
→ 判断是否可立组
→ 删除旧形态
→ 生成标准包
→ 重建 child
→ 重建 runtime gates
→ 重建 inspector
→ real-code-inspection
→ full CI
→ READY / NOT_READY
```

当 14 个能力组全部完成标准化后，后续新增 child、execution map、prompt contract、platform profile，都应在既有模式内扩展，不再出现大面积重构。

---

## 21. 固定给 Codex 的总提示词

以下提示词用于每个能力组重构任务的开头。

```txt
你现在执行：<ABILITY> 能力组标准包删除后重构任务。

当前法案已冻结，禁止修改：
- .github/instructions/cursor-rules/**
- docs/法案辅助文件/GrassEye 法案冻结基线.md

本轮目标：
1. 不修改冻结法案。
2. 不做补丁。
3. 代码文件只有两个选项：删除，或删除后重构。
4. 按《GrassEye 能力组标准包与执法结构统一施工图》重建能力组。
5. 每个 child 必须是真子能力。
6. 所有输入输出必须 runtime schema parse。
7. 所有结果必须 governed result。
8. 所有失败不得裸 throw。
9. 必须同步 owner inspector。
10. inspector 必须 ts-morph AST / symbol / type / reference 级。
11. 必须覆盖四方攻击：required / forbidden / boundary / anti-escape。
12. 必须执行 real-code-inspection：regression fail + re-inspect。
13. 执法发现的问题必须修源码，不能降级 inspector。
14. 最终达到 <ABILITY>_READY_TO_ESTABLISH；否则明确输出 <ABILITY>_NOT_READY。

禁止：
1. 补丁式堆旧文件。
2. 保留 God Facade / God Adapter。
3. 保留 metadata-only child。
4. 保留复制粘贴 child implementation。
5. 保留 export *。
6. 保留 naked throw 穿透 public execute。
7. 保留 fake success / fallback success。
8. 新增 any / unknown as / ts-ignore / eslint-disable。
9. 新增 mock / fake / demo / fixture 到生产路径。
10. 手写 generated 文件。
11. 为了 PASS 降低约束。
12. 让 support 子契约恢复成 independent owner。

必须运行：
- npm run ci:full
- npm run ci:full
- npm run typecheck
- npm run lint
- npm run ci:full
- git diff --check

最终只按本施工图指定格式输出，不要写长报告。
```

---

## 22. 最终裁决规则

施工图本身不代表能力已达标。

能力达标只看：

```txt
标准包结构
+ 生产级 runtime gates
+ governed result
+ owner evidence
+ 四方攻击 inspector
+ real-code-inspection
+ full CI
```

如果 Codex 只跑通 CI，但没有 real-code-inspection，不达标。

如果 Codex 只修 inspector，没有重建能力组本体，不达标。

如果 Codex 只重构源码，没有同步 inspector，不达标。

如果 Codex 只写报告，没有删除旧缝合文件，不达标。

最终只有一个标准：

> 系统不只是能 PASS，而是无法被绕过。

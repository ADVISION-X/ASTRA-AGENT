# GrassEye Child Capability Strength 子能力强度施工图

版本：2026-05-10

## 1. 目标

本施工图用于约束强肌肉阶段的 child capability 准入。

唯一目标：

- 任何进入 MuscleMemoryCatalog 的 actionCode，都必须能追到真实 child capability。
- 任何允许 AI 规划的 actionCode，都必须能追到 Level 4 以上 child capability。
- inventory、inspector、Forensics、CI-FULL 必须形成单链闭合，而不是文档承诺。

## 2. 强度等级

### Level 0：名字存在

- 只有 child id、目录名、或零散 metadata。
- 不可进入 MuscleMemoryCatalog。
- 不可进入 AI manual。

### Level 1：schema 存在

- 已有 owner contract 或 owner schema。
- 没有真实 execute，或 execute 不能证明 governed result。
- 不可进入 MuscleMemoryCatalog。

### Level 2：父能力组内部可执行

- child implementation 存在。
- execute 存在，且能返回 governed result。
- 尚未证明 Nerve Bus 或 scheduler dispatch 可达。

### Level 3：可被 governed dispatch 到达

- owner contract、owner schema、owner registry、implementation、execute 都存在。
- local runtime 或 Nerve Bus 已有 dispatch coverage。
- 可以作为 runtime child，但默认不等于 AI 可调用。

### Level 4：可被 AI action plan 安全调用

- 至少一个 AI reachable actionCode 能追到该 child。
- child 具备 executable path。
- governed dispatch 可达。
- side-effecting child 具备 Forensics path。
- capability-group-governance inspector 能产出机器 finding。

### Level 5：可组合

- 组合 actionCode 的失败策略、idempotency、outputRefs、中断/继续/review 语义明确。
- 组合动作只能展开成已存在 actionCode。

## 3. Inventory Schema

generated artifact:

- scripts/audit/generated/child-capability-strength-inventory.generated.json

每条 entry 至少记录：

- abilityGroupId
- childCapabilityId
- declaredInContract
- declaredInSchema
- registered
- hasChildContract
- hasChildSchema
- hasChildImplementation
- hasExecute
- returnsGovernedResult
- publicExecuteThrows
- hasNerveBusDispatchBuilder
- hasCapabilityCatalogEntry
- hasMuscleMemoryAction
- allowedForAiActionPlan
- hasForensicsRecordPath
- strengthLevel
- blockingReasons[]

## 4. Inspector 责任

owner inspector 必须机器化拦截：

- CHILD_NOT_REGISTERED
- CHILD_NOT_IN_SCHEMA_UNION
- CHILD_HAS_NO_IMPLEMENTATION
- CHILD_HAS_NO_EXECUTE
- CHILD_RETURNS_FAKE_SUCCESS
- CHILD_PUBLIC_EXECUTE_THROWS
- AI_ACTION_WITHOUT_CHILD_PATH
- AI_ACTION_WITHOUT_NERVE_BUS_PATH
- SIDE_EFFECT_ACTION_WITHOUT_FORENSICS
- CLICK_CELL_BYPASSES_GEOMETRY_GUARD
- MOUSE_CLICK_ACCEPTS_AI_GRIDCELL_DIRECTLY

## 5. AI Plan Eligibility

AI action planning 只允许 actionCode，不允许 raw execution。

要进入 AI action manual，必须同时满足：

- actionCode 在 MuscleMemoryCatalog 中存在。
- actionCode 可解析到 atomic child path 或受治理 composite path。
- child strengthLevel >= 4。
- child 不是 metadata-only。
- child 不依赖 synthetic dispatch 特判。

## 6. Dispatch Coverage

dispatch coverage 的最小证明：

- child 能从 owner registry 到达。
- local runtime 或 Nerve Bus 代码面存在受治理 dispatch 路径。
- 不能依赖 `if key === "L"`、`if key === "ArrowDown"`、或 `if childCapabilityId === "write-product-lead-record"` 这类 synthetic dispatch。

## 7. Forensics Coverage

side-effecting child 至少要满足其一：

- child 自身属于 forensics-persistence。
- governed runtime 能把执行结果绑定到 Forensics write path。
- round record 或 structured runtime evidence 能回链到执行 child。

没有 Forensics path 的 side-effect child，不得宣称 Level 4。

## 8. CI-FULL Acceptance

CI-FULL 必须能够证明，而不是假定：

- inventory 可生成。
- inspector 已接入 capability-group-governance owner audit。
- AI allowed action path 可追到 executable child。
- CLICK_CELL 不能直接终止到 mouse-click raw coordinate path。
- 任何新的弱 child 回归都会形成 machine-blocking finding。

## 9. 当前实现锚点

本轮 round 1 代码锚点：

- scripts/audit/domains/capability-group-governance/child-capability-strength-builder.ts
- scripts/audit/domains/capability-group-governance/child-capability-strength-inventory.ts
- scripts/audit/domains/capability-group-governance/child-capability-strength-inspector.ts
- scripts/audit/generated/child-capability-strength-inventory.generated.json

这些文件负责把“child 是否够强”从口头判断，转为可执行审计事实。
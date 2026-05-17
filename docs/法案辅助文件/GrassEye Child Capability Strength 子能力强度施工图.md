# GrassEye Child Capability Strength 子能力强度施工图

版本：2026-05-11

## 1. 目标

本施工图定义“子能力强度”的最终口径。
强度不再围绕套餐动作是否能展开，而是围绕子能力是否真实存在、是否原子、是否可执行、是否有清晰输入输出、是否有证据、是否有失败策略。
本施工图是当前最高定义，不是未来愿景。

唯一目标：
- 任何进入 MuscleMemoryCatalog 的条目，都必须能追到真实原子 child capability。
- 任何允许 AI 使用的条目，都必须能追到安全可执行的原子 child capability。
- inventory、inspector、Forensics、CI-FULL 必须形成单链闭合，而不是停留在口头承诺。

## 2. 最终定义

子能力强度 = 某个 child capability 作为真实原子动作被安全登记、被系统调度、被 AI 使用、并被审计证明的完整程度。

强度验收必须检查：
1. 子能力是否属于一个明确能力组。
2. 子能力是否是不可再拆的具体动作。
3. 子能力是否没有业务流程语义。
4. 子能力是否有 input schema。
5. 子能力是否有 forbidden input。
6. 子能力是否有 output proof 或 ref。
7. 子能力是否有 failure policy。
8. 子能力是否可以被能力登记册引用。
9. 子能力是否可被 AI 通过登记册安全使用。

## 3. 强度等级

### Level 0：名字存在

- 只有 child id、目录名或零散 metadata。
- 没有能力契约、没有执行真相。
- 不可进入 MuscleMemoryCatalog。
- 不可进入 AI manual。

### Level 1：契约存在

- 已有 owner contract 或 owner schema。
- 但没有真实 execute，或 execute 不能证明 governed result。
- 不可进入 MuscleMemoryCatalog。

### Level 2：原子执行存在

- child implementation 存在。
- execute 存在，且能返回 governed result。
- child 已经是原子动作，而不是业务流程包装。
- 尚未证明 governed dispatch 可达。

### Level 3：可被 governed dispatch 到达

- owner contract、owner schema、owner registry、implementation、execute 都存在。
- local runtime 或 Nerve Bus 已有 governed dispatch coverage。
- 可以作为 runtime child，但默认不等于 AI 可调用。

### Level 4：可被 AI 通过登记册安全调用

- registry entry 能追到该 child。
- child 具备 executable path。
- governed dispatch 可达。
- side-effecting child 具备 Forensics path。
- capability-group-governance inspector 能产出机器 finding。

### Level 5：证据闭环稳定

- input schema、forbidden input、output refs、failure policy 全部稳定。
- 重复调用、失败中断、review_required 语义明确。
- 可以作为 AI 组合中的稳定原子积木。

## 4. Inventory Schema

generated artifact 若存在，只能表达 child capability 真相，而不是套餐动作真相。
inventory 只能是 support evidence；只有出现 violation 或定向审计明确需要时才应输出。

每条 entry 至少记录：
- abilityGroupId
- childCapabilityId
- registryEntryIds[]
- declaredInContract
- declaredInSchema
- registered
- hasChildContract
- hasChildSchema
- hasChildImplementation
- hasExecute
- returnsGovernedResult
- publicExecuteThrows
- hasDispatchPath
- hasForensicsRecordPath
- strengthLevel
- blockingReasons[]

actionCode 只能作为能力登记册条目 id，不改变 child capability strength 的当前最高定义。

## 5. Inspector 责任

owner inspector 必须机器化拦截：
- CHILD_NOT_REGISTERED
- CHILD_NOT_ATOMIC_ACTION
- CHILD_HAS_BUSINESS_FLOW_SEMANTICS
- CHILD_NOT_IN_SCHEMA_UNION
- CHILD_HAS_NO_IMPLEMENTATION
- CHILD_HAS_NO_EXECUTE
- CHILD_RETURNS_FAKE_SUCCESS
- CHILD_PUBLIC_EXECUTE_THROWS
- REGISTRY_ENTRY_WITHOUT_CHILD_PATH
- AI_VISIBLE_ENTRY_WITHOUT_DISPATCH_PATH
- SIDE_EFFECT_CHILD_WITHOUT_FORENSICS
- GRID_CELL_ACTION_BYPASSES_GEOMETRY_GUARD
- MOUSE_CLICK_ACCEPTS_AI_GRIDCELL_DIRECTLY

## 6. Registry Eligibility

要进入 MuscleMemoryCatalog，必须同时满足：
- registry entry 能明确映射到一个 atomic child path。
- child strengthLevel >= 4。
- child 不是 metadata-only。
- child 不依赖 synthetic dispatch 特判。
- child 不携带业务流程语义。

以下不得提升为强子能力：
- LIKE_CURRENT_VIDEO
- OPEN_COMMENTS
- NEXT_VIDEO
- SEEDING_VIDEO_FLOW
- SAVE_PRODUCT_AND_LIKE

## 7. AI Safety Eligibility

AI 使用能力时，允许的是“登记能力”，不是“自由执行”。

AI-visible 条目必须同时满足：
- 来自 capability registry。
- 对应原子 child capability，而非 composite business flow。
- 能一跳映射到真实 child capability path；当前 `actions[].actionCode` 只能作为 transport alias。
- 明确声明输入边界。
- 不允许 raw coordinate。
- side effect 动作可回链到 Forensics。

## 8. Dispatch Coverage

dispatch coverage 的最小证明：
- child 能从 owner registry 到达。
- local runtime 或 Nerve Bus 代码面存在受治理 dispatch 路径。
- 不能依赖某个业务词、平台词、快捷键词的 synthetic 特判。

## 9. Forensics Coverage

side-effecting child 至少要满足其一：
- child 自身属于 forensics-persistence。
- governed runtime 能把执行结果绑定到 Forensics write path。
- round record 或 structured runtime evidence 能回链到执行 child。

没有 Forensics path 的 side-effect child，不得宣称 Level 4 或以上。

## 10. 正反例

正例：
- LEFT_CLICK_GRID_CELL_ONCE
- RIGHT_CLICK_GRID_CELL_ONCE
- DOUBLE_LEFT_CLICK_GRID_CELL
- PRESS_KEY_ONCE
- TYPE_TEXT_ONCE
- CAPTURE_VIEWPORT_ONCE
- CAPTURE_REGION_ONCE
- OPEN_PLATFORM_ENTRY_ONCE
- SAVE_EVIDENCE_RECORD_ONCE
- STOP_REVIEW_REQUIRED_ONCE

反例：
- Like Current Video 不是原子子能力。
- Open Comments 不是原子子能力。
- Next Video 不是原子子能力。
- Seeding Video Flow 不是原子子能力。

## 11. CI-FULL Acceptance

CI-FULL 必须能够证明，而不是假定：
- PASS/FAIL 输出可直接指向 lawId、file、最小原因与修复方向。
- inventory 仅在 violation 或 targeted audit 模式下生成。
- inspector 已接入 capability-group-governance owner audit。
- AI-visible registry entry 可追到 executable child。
- 任何 gridCell 执行都不会跳过 Geometry Guard。
- 任何新的弱 child 回归都会形成 machine-blocking finding。

## 12. 后续代码层治理差异

当前仓库若仍保留 semantic action、composite action、package flow 的 transport 命名，它们只能被视为待治理差异。
这些残留不得被判定为强子能力。

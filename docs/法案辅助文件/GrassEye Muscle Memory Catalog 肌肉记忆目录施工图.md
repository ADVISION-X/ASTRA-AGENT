# GrassEye Muscle Memory Catalog 肌肉记忆目录施工图

本施工图定义 GrassEye 当前对 MuscleMemoryCatalog 的最高蓝图权威。

## 文件身份

- Owner boundary: capability-group-governance
- Runtime consumers: ai-capability, orchestration-capability, commander-console-capability
- Final role: MuscleMemoryCatalog = Capability Registry

## 核心定义

GrassEye Muscle Memory is the governed capability registry.
It is not a workflow library.
It is not a package library.
It is not a business-flow catalog.
It is not a semantic-shortcut catalog.

中文口径：
- 肌肉记忆是受治理的能力登记册。
- 它不等于套餐库。
- 它不等于业务流程库。
- 它不等于语义动作库。
- 它只负责登记系统已经具备的能力、输入边界、输出证据、执行 owner、失败策略。

## 能力登记册职责

1. 登记能力组与其可公开引用的子能力。
2. 登记每个子能力的输入 schema 与 forbidden input。
3. 登记每个子能力的 output proof、evidence ref、failure policy。
4. 产出 AI 可见的能力手册。
5. 产出系统可见的调度登记信息。
6. 明确禁止 raw coordinate 直通执行。
7. 要求所有 gridCell 执行先经过 Geometry Guard。
8. 要求 side effect 动作可以回链到 Forensics。
9. 禁止登记套餐动作、语义动作、业务流程动作。

## 定义表

| 概念 | 正确定义 | 禁止误解 |
| --- | --- | --- |
| 肌肉记忆 | 能力登记册 | 见禁误 A |
| 能力组 | 能力提供部门 | 业务流程 owner |
| 子能力 | 最小真实原子动作 | 多步骤业务动作 |
| AI 手册 | 能力登记册的可见版本 | 预制业务套餐列表 |
| AI 动作计划 | AI 对登记能力的组合 | AI 发明能力 |
| 系统调度 | 校验、注入、执行、留证 | 替 AI 做业务判断 |
| Geometry Guard | gridCell 到坐标的保护层 | 业务点击判断器 |
| Forensics | 证据记录 | 业务流程推进器 |

禁误 A：套餐库 / 流程库 / 语义动作库

## 能力组职责

能力组是能力提供部门，不是业务流程 owner。

例子：
- mouse-click 能力组：提供鼠标点击类子能力。
- text-input 能力组：提供键盘输入与按键类子能力。
- screenshot 能力组：提供截图类子能力。
- open 能力组：提供打开入口类子能力。
- forensics-persistence 能力组：提供证据写入类子能力。
- geometry-guard 能力组：提供坐标与几何保护类子能力。

## 子能力原子标准

子能力必须同时满足：
- 属于一个明确能力组。
- 是不可再拆的具体动作。
- 不包含业务流程语义。
- 有清晰 input schema。
- 有 forbidden input 说明。
- 有 output proof 或 ref。
- 有 failure policy。
- 可被能力登记册引用。
- 可被 AI 通过登记册安全使用。

## AI 能力手册生成方式

- AI 拿到的是能力登记册的可见版本，不是套餐流转库。
- AI 可以根据用户需求和当前截图，自行组合多个已登记的原子能力。
- 当前代码若仍使用 `actions[].actionCode` 作为 transport 字段，该字段只可序列化登记册条目 id，不改变“能力登记册”这一最终定义。
- 任何 AI-visible 条目都必须最终映射到一个真实 atomic child capability，而不是业务套餐动作。
- AI 不能发明能力名。
- AI 不能输出 raw coordinate。
- AI 不能绕过登记册直接调用 owner internals。

## 系统注入字段边界

系统不替 AI 做业务判断。
系统不写业务套餐。
系统只负责：
1. 校验 AI 输出能力是否登记。
2. 校验输入字段是否符合能力契约。
3. 注入系统字段与 refs。
4. 将 gridCell 交给 Geometry Guard。
5. 调度对应能力组执行。
6. 记录证据与失败原因。

## Geometry Guard 与证据 refs

- 任何基于 gridCell 的点击、滚动、区域截图，必须先经过 Geometry Guard。
- Geometry Guard 负责 gridCell 到 executable geometry 的安全解析，不负责业务判断。
- 执行结果必须产出 evidence refs、output refs、failure refs 或 review refs。
- side effect 动作若无 Forensics 回链，不得被登记为可安全复用能力。

## 正例：原子能力

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

## AI 组合示例

用户目标：

```txt
挖掘 Facebook 种草产品。
如果是种草视频，保存证据；
如果不是种草视频，下一条。
```

AI 应组合登记能力，而不是选择套餐：

```txt
CAPTURE_VIEWPORT_ONCE
SAVE_EVIDENCE_RECORD_ONCE
LEFT_CLICK_GRID_CELL_ONCE(nextButtonGridCell)
```

如果不是产品：

```txt
LEFT_CLICK_GRID_CELL_ONCE(nextButtonGridCell)
```

## 后续执法检查点

后续 inspector 必须检查：
1. MuscleMemoryCatalog 不得登记业务流程套餐为 atomic child capability。
2. AI-visible registry 不得以 business flow 为主要能力表面。
3. Child capability 必须是原子动作。
4. AI manual 必须来自 capability registry。
5. AI manual 必须允许 AI 组合能力，不得提供套餐动作。
6. 子能力不得包含多步骤业务流程。

# GrassEye 简单能力机器总纲施工图

版本：2026-05-11

## 1. 当前最高定义

GrassEye 当前不是地图机，不是套餐机，不是 PAV 机，也不是审计矩阵机。

GrassEye 当前是一台简单能力机器：
- 用户提供需求与平台范围。
- AI 结合当前画面、PlatformRegistry、MuscleMemoryCatalog 进行判断。
- AI 只组合已经登记的原子 child capability。
- System 只负责校验、注入、调度、保护边界、留证。
- Capability Group 提供真实可执行的 atomic child capability。
- Forensics 负责把执行事实写成可追踪证据。

## 2. 简单公式

```txt
userRequirement + selectedPlatforms
→ PlatformRegistry + MuscleMemoryCatalog
→ current screenshot / evidence bundle
→ AI judgment + registry-backed atomic capability composition
→ System validation / ref injection / geometry guard / dispatch
→ owning capability-group public contract
→ atomic child capability execution
→ Forensics evidence
```

## 3. 角色分工

### 用户

- 只提供任务目标、限制条件、平台范围。
- 不负责告诉系统套餐名、路线图名、地图名、分支名。

### AI

- 是大脑，不是执行器。
- 只读取当前证据、平台资料、能力登记册、提示词合同。
- 只组合登记过的原子能力。
- 不得发明能力，不得输出 raw coordinate，不得直接执行动作。

### 系统

- 只负责校验、注入、调度、边界保护、留证。
- 不替 AI 做商品判断、评论理解、页面语义判断、目标语义判断。
- 不得把 semantic action、workflow、package 重新升级成系统主权。

### 能力组

- 是能力提供部门，不是业务流程 owner。
- 只对自己名下的 atomic child capability 负责。
- 只能通过公开 contract 被调度。

## 4. 支持与过渡表面

以下表面在当前实现中可以存在，但不是最高语义权威：
- page-state
- visual-target
- post-action-verification
- generated audit artifacts
- inventory / report / matrix 类辅助产物

它们只能做观察、包装、保护、支持证据。
如果某个表面不能持续提供独立 atomic child capability，就应被折叠或退役。

## 5. 过渡残留口径

- 当前代码若仍使用 actions[].actionCode，它只能是 transport alias，不改变能力登记册与 atomic child capability 的最终定义。
- semantic action、package、workflow、business flow 只可作为历史残留、反例、差异记录或待治理标签。
- 它们不得成为当前主线定义，不得成为 AI 手册最终真相，也不得成为系统调度主权。

## 6. QA 位置

QA 的存在目的是保护这台简单能力机器，而不是再造一台第二系统。

因此：
- inspector 必须回答一个清楚的阻断问题。
- PASS 输出应尽量短。
- FAIL 输出必须直接给出 file、lawId、最小原因、修复方向。
- inventory 只应在出现 violation 或定向审计需要时输出。
- generated artifacts 只能是 support evidence，不能反过来压过 law 和 blueprint。

## 7. 与其他蓝图关系

- GrassEye Muscle Memory Catalog 肌肉记忆目录施工图：定义能力登记册真相。
- GrassEye Child Capability Strength 子能力强度施工图：定义 atomic child capability 的强度与 AI 准入真相。
- 本总纲：定义整机主线，不允许叙事漂移回地图、套餐、PAV、审计宇宙。

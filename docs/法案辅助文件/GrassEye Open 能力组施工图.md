# GrassEye Open 能力组施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 13 个 active ability groups 与 4 个 active support laws，不重新分配主权。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 基本身份

- 从属法案：.github/instructions/cursor-rules/modules/module-open-capability.instructions.md
- 角色：Open Ability Group 的建造级落地映射
- 原则：只定义 Open 能力组主权，不扩写其他能力组真相

## 定位

Open Ability Group 只负责：

- 打开目标
- 记录 open proof
- 返回结构化 open result

Post-action Verification Ability Group 负责判断“打开后是否真的进入预期页面状态”。
Page State Ability Group 负责判断“当前页面此刻是不是 login wall / safety page / feed ready”。

它不负责截图、AI、评论、视觉目标识别、坐标动作、产品判断、总调度分支。

## 子能力

- open-tiktok
- open-facebook
- open-local-workbench

## 代码根目录

- src/capabilities/open/
- src/capabilities/open/shared/
- src/capabilities/open/open-tiktok/
- src/capabilities/open/open-facebook/
- src/capabilities/open/open-local-workbench/

## 统一 contract

Open Ability Group 必须暴露：

- OpenCapabilityInput
- OpenCapabilityResult
- OpenCapability
- orchestrate-open

OpenCapabilityResult 至少包含：

- abilityGroupId
- childAbilityId
- targetKind
- sessionId
- roundId
- startedAt
- endedAt
- durationMs
- status
- targetUrl
- openedUrl
- targetTitle
- failureReason
- nextAbilityGroup
- reviewRequiredReason
- fallbackUsed

## 调用边界

| 对象 | 可以做什么 | 不可以做什么 |
| --- | --- | --- |
| Open Ability Group | 打开目标、返回 open proof | 截图、AI、页面状态最终验证、评论、平台后续动作 |
| Page State Ability Group | 判断当前页面此刻是否已进入可浏览状态 | 执行 open、动作后验证、截图、AI |
| Post-action Verification Ability Group | 验证页面是否真的打开到预期状态 | 执行 open、截图、AI、平台后续动作 |
| Orchestration Ability Group | 调用 Open contract，消费 open result | 私自拥有平台打开细节 |
| PlatformAdapter | 页面已打开后的动作适配 | 拥有 open 主权 |
| Startup | 打开本地控制台 | 冒充平台 open 主权 |

## 禁止边界

- 每个平台自造 open result 结构
- 平台 adapter 内隐藏第二套 open helper 宇宙
- startup helper 变成平台打开真相
- 一个 open 子能力直接导入另一个 open 子能力实现

## 验收标准

建对表现：

- open 只有一个 canonical root
- 所有 open 子能力共用统一 contract
- success 与 failure 都有 open proof

漂移信号：

- platform adapter 再次声明 openFeed / openTargetPage
- open 结果靠副作用隐藏，不返回结构化结果
- 文案把 open 写成总调度本体
# GrassEye Screenshot 能力组施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 13 个 active ability groups 与 4 个 active support laws，不重新分配主权。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 1. 定位

Screenshot Ability Group 是视觉输入与图像产物能力组。
它不属于 platform-action。
它为 PlatformAction、LocalAI、Operator Diagnostic、Post-action Verification 提供统一截图能力。

## 2. 唯一接口

调度器只能调用 ScreenshotAbilityGroup.execute(input)。
调度器不得直接调用子能力 implementation。

## 3. 子能力

- capture-browser-viewport
- capture-desktop-screen
- capture-region
- optimize-lossless
- prepare-ai-input

## 4. 禁止职责

- 不做 AI 判断
- 不找按钮坐标
- 不点击
- 不裁决动作是否成功
- 不读 DOM/BOM
- 不采集评论
- 不决定 round 分支

## 5. 图像产物

- evidence_original
- evidence_optimized
- ai_input

## 6. coordinateSpace 与 scaleMapping

- evidence_original 保留原始 coordinateSpace。
- evidence_optimized 保留与 evidence_original 一致的像素尺寸和 coordinateSpace。
- ai_input 可以 crop 或 resize，但必须保留 scaleMapping 以映射回 source screenshot。
- 任何 region 或 transform 结果都必须保留 sourceScreenshotEvidenceId。

## 7. 调用边界

- PlatformAction 调 Screenshot 获取图像，不拥有截图策略。
- Page State 可以消费 Screenshot 产物作为外部证据，但 Screenshot 不拥有页面状态真相。
- LocalAI 调 Screenshot 的 prepare-ai-input，不自己 resize 或 crop。
- EvidenceStore 记录 Screenshot 产物，不定义截图策略。
- BrowserController 只做底层 capture primitive。

## 8. 文件路径

Screenshot Ability Group canonical root 固定为 src/capabilities/screenshot/。
不得继续使用 src/features/platform-action/screenshot-drawer/。

## 9. 施工图主权

本文件是 Screenshot 能力组唯一主施工图。
其他文档只能引用本文件，不得重复定义 screenshot 规则。
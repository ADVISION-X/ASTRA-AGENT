# GrassEye 多帧视频取证施工图

## 统一身份与冻结边界

- 本文件是当前主题的建设级落地映射或冻结说明，不新增 lawId，不修改冻结法案。
- 本文件只服从当前 14 个 active ability groups、5 个 foundation laws、1 个 support governance domain；若与 Kernel / Index / 法案冻结基线冲突，以 Kernel / Index / 冻结基线为准。
- 若本文档涉及 support boundary、共享子契约或已退役主题，只能从属于现有父能力组或冻结结论，不得借此恢复独立 owner、phase gate、audit plan 或 runner。
- 若与 .github/instructions/cursor-rules/** 或 docs/法案辅助文件/GrassEye 法案冻结基线.md 冲突，以冻结法案与现行 owner law 为准。

## 基本身份

- 从属法案：module-screenshot-capability.instructions.md、module-ai-capability.instructions.md、module-forensics-persistence-capability.instructions.md
- 角色：Screenshot、AI、Forensics 之间的共享取证输入边界施工图
- 原则：不是独立 ability group，不进入 active owner、phase gate、audit plan 或 runner

## 定位

多帧视频取证是第一问产品存在性判断之前的共享子边界。

它由 Screenshot、AI 和 Forensics 共同承担：负责把同一 roundId、同一 videoVisitId 下的多帧截图组织成受治理输入，避免 opening frame、黑屏、字幕过场或延迟出镜主导第一问结果。

## 当前运行事实

- 当前治理目标是 multi-frame default。
- Facebook 种草视频第一问已经禁止 single_frame_fallback：产品存在性判断必须喂给 AI 两张间隔 3 秒的准备后图片，采样语义为 3s / 6s。
- Facebook 生产 `routePlanBoundMap` 的首帧锚点继续使用 `capture-video-viewport` / `prepare-ai-input`；3s 语义通过 `screenshotEvidenceRefFrame3s` / `promptInputRefFrame3s` 承载，第二帧固定为 `capture-video-frame-6s` / `prepare-ai-input-frame-6s`。
- single_frame_fallback 只能用于非产品第一问的诚实降级路径，不能进入 product_presence_judgment。
- contact sheet 仍是优先输入模式；多图直喂仅作为可替换能力。

## 核心约束

- 通用默认采样点为 3s / 6s / 10s；Facebook 种草视频第一问的固定采样点为 3s / 6s。
- 同一组帧必须属于同一 roundId 与同一 videoVisitId。
- 必须形成一个 MultiFrameVideoEvidenceSet，而不是三次互不关联的 AI 调用。
- product_presence_judgment 的 validFrameCount 必须等于 2；不足 2 时生产代码只能机械失败，不能改判 product_no、product_yes 或 review。
- single_frame_fallback 必须留下 fallbackReason、missingFrames 与 validFrameCount。
- Browse Ledger 对 product_no 默认只保留 lightweight references，不默认保留完整多帧长期证据。

## 与其他边界的关系

- Screenshot Ability Group 负责截图产物。
- Local AI Runtime / AI Ability Group 负责消费受治理输入并返回结构化结果。
- Forensics Persistence 负责写入最终记录。
- 该共享子边界本身不做最终产品分析，不决定 browse branch，也不是独立 owner。

## 审计与验收

- 当前 owner 归口：Screenshot 负责输入打包，AI 负责消费判断，Forensics Persistence 负责记录闭环
- 负向证明：若 multi-frame 被重新写成独立 owner，或用三次独立 AI 调用冒充一个受治理证据集合，则本施工图判定漂移

验收信号：

建对表现：

- 第一问输入字段包含 inputMode、multiFrameEvidenceSetId、contactSheetEvidenceId、sampledFrameCount、validFrameCount。
- Evidence Packet 可记录 multi-frame 证据元数据。
- Facebook 种草视频第一问输入为 promptInputRefFrame3s + promptInputRefFrame6s，AI request builder 对 product_presence_judgment 要求 exactly 2。

漂移信号：

- 重新把第一问默认输入退回单帧 opening screenshot。
- 为了表面命名统一，把首帧改成 `capture-video-frame-3s` / `prepare-ai-input-frame-3s`，从而打断 `click-next-video-arrow:success -> capture-video-viewport` 的 Route Plan 回环。
- product_presence_judgment 出现 single_frame_fallback。
- 三次独立 AI 调用冒充一个 multi-frame 任务。
- fake frame、伪造 validFrameCount 或隐藏 fallbackReason。

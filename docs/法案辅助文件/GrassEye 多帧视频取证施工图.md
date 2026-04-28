# GrassEye 多帧视频取证施工图

## 定位

多帧视频取证是第一问产品存在性判断之前的共享子边界。

它由 Screenshot、AI 和 Forensics 共同承担：负责把同一 roundId、同一 videoVisitId 下的多帧截图组织成受治理输入，避免 opening frame、黑屏、字幕过场或延迟出镜主导第一问结果。

## 当前运行事实

- 当前治理目标是 multi-frame default。
- 当前生产 runtime 仍然诚实声明 single_frame_fallback，不能伪装成已经完成真实 3s / 6s / 10s 抽帧闭环。
- contact sheet 仍是优先输入模式；多图直喂仅作为可替换能力。

## 核心约束

- 默认采样点为 3s / 6s / 10s。
- 同一组帧必须属于同一 roundId 与同一 videoVisitId。
- 必须形成一个 MultiFrameVideoEvidenceSet，而不是三次互不关联的 AI 调用。
- validFrameCount 小于 2 时不得伪装成高置信度 product_yes。
- single_frame_fallback 必须留下 fallbackReason、missingFrames 与 validFrameCount。
- Browse Ledger 对 product_no 默认只保留 lightweight references，不默认保留完整多帧长期证据。

## 与其他边界的关系

- Screenshot Ability Group 负责截图产物。
- Local AI Runtime / AI Ability Group 负责消费受治理输入并返回结构化结果。
- Forensics Persistence 负责写入最终记录。
- 该共享子边界本身不做最终产品分析，不决定 browse branch，也不是独立 owner。

## 验收信号

建对表现：

- 第一问输入字段包含 inputMode、multiFrameEvidenceSetId、contactSheetEvidenceId、sampledFrameCount、validFrameCount。
- Evidence Packet 可记录 multi-frame 证据元数据。
- 当前 runtime 若仍未完成真实多帧抽帧，会诚实标记 single_frame_fallback。

漂移信号：

- 重新把第一问默认输入退回单帧 opening screenshot。
- 三次独立 AI 调用冒充一个 multi-frame 任务。
- fake frame、伪造 validFrameCount 或隐藏 fallbackReason。
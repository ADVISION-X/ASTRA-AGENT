# GrassEye 多帧视频取证施工图

## 基本身份

- 从属法案：screenshot-capability、ai-capability、forensics-persistence-capability
- 角色：Screenshot、AI、Forensics 之间的共享取证输入边界施工图
- 原则：不是独立 ability group，不进入 active owner

## 定位

多帧视频取证是 visual mission input 的扩展模式，不再由 retired chain sampling 充当生产采样主权。

## 当前口径

- 简单任务默认单轮单图。
- 需要多帧证据时，采样策略只能由 governed visual mission input policy 或 AI request builder 请求。
- 多帧输入必须形成一个 MultiFrameVideoEvidenceSet，而不是三次互不关联的 AI 调用。
- contact sheet 仍是优先输入模式；多图直喂仅作为可替换能力。

## 禁止

```txt
retired deterministic flow planning 表达生产采样真相
retired chain script 写入 3s / 6s / 10s 采样脚本
用 retired branch tokens 控制多帧输入
三次独立 AI 调用冒充一个 multi-frame 任务
```

## 审计信号

建对表现：

```txt
第一问输入字段包含 inputMode、multiFrameEvidenceSetId、sampledFrameCount、validFrameCount
多帧输入通过 visual mission bundle 进入 AI
```

漂移信号：

```txt
多帧真相重新回到 retired chain script
product_presence_judgment 继续由 retired branch tokens 驱动
```

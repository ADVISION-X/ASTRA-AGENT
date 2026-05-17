# GrassEye AI 大脑能力组施工图

status: active
version: 2026-05-17

## 定义

AI 是视觉指挥官，只负责判断当前画面并选择一个登记过的原子能力。

## 输入

- 用户需求
- 当前原始截图
- 当前坐标图
- 当前平台资料
- MuscleMemoryCatalog

## 输出

AI 只能输出 `pureVisualRound.v1`：

- `goalMatched`
- `save`
- `saveReason`
- `confidence`
- `visualEvidence`
- `decision`
- `nextAction`
- `reviewRequiredReason`
- `doneReason`

## 禁止

- 不输出 raw 坐标。
- 不输出 DOM selector。
- 不输出多个动作。
- 不输出能力 owner。
- 不写证据 payload。
- 不携带旧轮历史包。
- 不使用产品 yes/no、页面状态、动作后验证等旧字段。

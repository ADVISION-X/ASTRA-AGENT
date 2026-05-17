# GrassEye Orchestration 总指挥能力组施工图

status: active
version: 2026-05-17

## 定义

Orchestration 只执行 AI 选择的一个登记原子能力。

## 每轮顺序

1. 检查 loop guard。
2. 系统打开平台注册入口，仅限首轮需要时。
3. 系统截取当前浏览器视口。
4. 系统渲染坐标图。
5. AI 输出 `pureVisualRound.v1`。
6. 如果 `save=true`，系统保存当前轮视觉证据。
7. 如果 `decision=act`，调度执行一个 `nextAction`。
8. 下一轮重新截图。

## 禁止

- 不做业务判断。
- 不追加第二个动作。
- 不维护套餐路线。
- 不执行未登记能力。
- 不跳过 Geometry Guard。
- 不恢复任何旧连续性系统。

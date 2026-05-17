# GrassEye 简单能力机器总纲施工图

status: active
version: 2026-05-17

GrassEye 是纯视觉原子能力机器。

```txt
用户需求 + 平台
→ 系统打开入口
→ 系统截图
→ 系统生成坐标图
→ AI 看当前画面和能力登记册
→ AI 输出 save / decision / nextAction
→ 系统先保存证据
→ 调度执行一个 nextAction
→ 下一轮重新截图判断
```

## 硬边界

- 用户不写路线。
- AI 不执行。
- 系统不猜业务。
- 调度不追加动作。
- 能力组不做第二个系统。
- 日志按 FLOW / DEBUG / TRACE 逐级展开。
- 质检只守住纯视觉、单动作、无旧系统复活。

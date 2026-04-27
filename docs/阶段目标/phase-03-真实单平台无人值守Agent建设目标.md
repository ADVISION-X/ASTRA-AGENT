# GrassEye 第三阶段建设目标方案

版本：1.0
定位：第三阶段完成态定义文件
文件性质：阶段目标方案，不是 TODO，不是施工图，不是法案，不是验收报告
核心目标：第三阶段完成后，GrassEye 可以在受治理边界内实现无人值守的真实网页 Agent 工作闭环。

---

## 1. 阶段结论

第三阶段的唯一建设目标是：

> 让 GrassEye 从 fixture/demo 闭环进入真实网页平台闭环，使 Agent 能在人工启动后，于本机浏览器中无人值守地连续观察真实视频流、截图判断、执行有限平台动作、采集评论证据、生成产品机会候选，并在本地工作台中等待人工复核。

第三阶段完成后，系统应该从：

```txt
本地 fixture demo agent
```

升级为：

```txt
真实网页单平台无人值守 Agent MVP
```

---

## 2. 一句话目标

```txt
人工启动，Agent 无人值守运行；本机浏览器进入一个真实视频平台，连续观察视频、截图、本地 AI 判断、有限动作、评论采集、产品机会沉淀，最终回到本地 Workbench 人工复核。
```

---

## 3. 第三阶段完成态

完成后必须具备以下状态：

- Local Workbench 可打开
- Local Agent Service 可启动
- Real Platform Adapter 可选择
- Browser Session 可连接
- Agent 可无人值守连续运行
- Video Screenshot Evidence 可生成
- Local AI Classification 可执行
- Platform Action 可受控执行
- Comment Capture 可执行
- Product Candidate 可生成
- Candidate Pool 可复核
- Action Log 可追踪
- Error / Stop Reason 可查看

---

## 4. 核心边界

第三阶段只允许接入一个真实网页平台，优先：

```txt
Facebook Web / Facebook Reels / Facebook Watch
```

必须坚持：

- 本机授权浏览器会话
- 本地 AI 判断真实截图
- 有限平台动作
- 评论证据与候选证据链
- 无人值守运行的 maxRounds / maxRuntimeMinutes / pause / stop
- Workbench 可见的真实运行模式

禁止进入：

- 多平台扩张
- 账号池 / 代理池 / 指纹伪装
- 验证码 / 登录 / 风控绕过
- 自动评论 / 私信 / 关注
- 云端浏览器托管
- 默认云端或付费 AI fallback

---

## 5. 验收约束

第三阶段不得以 fixture、mock、测试或文档代替真实平台结果。

最终必须同时具备：

- 真实平台 adapter
- 真实浏览器授权会话
- 真实视频截图 evidence
- 真实评论 evidence 或明确不可用记录
- 真实 evidence-backed candidate
- typecheck / audit:build / audit / build / launch 通过
- 第三阶段验收报告和真实平台实测记录落盘
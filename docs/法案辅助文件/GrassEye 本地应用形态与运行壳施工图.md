# GrassEye 本地应用形态与运行壳施工图

## 定位

GrassEye 是本地优先工作台，不是公开 SaaS，也不是浏览器插件主产品。

本图只描述 Commander Console 之下的本地壳层子边界，不定义独立 Commander Console 或 Orchestration 主权。

## 本地运行壳分层

- Operator UI：控制、复核、状态呈现
- Commander Console：人工命令入口与控制台真相
- local-app-shell：Commander Console 的本地承载壳层
- Orchestration：mission 与地图调度
- Browser session / browser primitives：本地真实浏览器基础设施
- AI Ability Group：本地 AI 执行与结构化输出
- Forensics Persistence：公共写账

## open-local-workbench 的位置

- open-local-workbench 是 Open Ability Group 的子能力
- 本地壳只能调用它，不能把它改造成第二调度链

## 禁止边界

- 不让本地壳拥有 Commander Console 主权
- 不让本地壳拥有 Orchestration command truth
- 不让启动脚本侵入业务调度
- 不允许 verify 脚本作为壳层验收

## 验收信号

建对表现：

- 本地壳只做容器与监督
- 命令入口和 mission truth 仍然分属各自能力组
- 文档不再重写能力组规则

漂移信号：

- localhost shell 重新变成第二总调度
- 启动逻辑被写成平台打开主权
- UI 文档开始持有浏览器、AI 或数据真相

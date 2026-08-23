# GrassEye 法案冻结基线

版本：2026-05-21  
状态：active

## 1. 当前冻结口径

GrassEye 不是万能 Agent。  
GrassEye 是岗位型流程自动化执行系统。

唯一主公式：

```txt
一个岗位一个 flow script；
一个流程一个编排脚本；
一个动作类型一个 ability group；
AI 只做选项判官；
证据证明每一步。
```

## 2. 当前第一主线

当前唯一优先主线：

```txt
Amazon 发票 / 订单上传流程
```

代码真相 owner：

```txt
src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts
```

## 3. 当前现役蓝图

- 能力组与子能力总纲
- Amazon 入口与任务启动
- DOM 自动化能力组
- AI Input Gateway / Choice Judge
- Evidence Store
- Runtime Log Spine
- 本地浏览器会话
- 本地工作台与运行壳
- 本地取证存储结构
- 启动入口与终端日志
- 执法系统

## 4. 当前退役面

以下主题已经退役，不再作为现役蓝图保留：

- 万能 Agent
- 纯视觉主闭环
- Nerve Bus
- 通用 Orchestration
- Geometry Guard
- Mouse Click
- Mouse Scroll
- Text Input 独立能力组
- Open 独立能力组
- Screenshot 独立能力组
- Video Download
- Product Video DOM Runtime
- Muscle Memory Catalog 作为流程真相
- Platform Registry 作为流程真相
- Commander Console 作为主运行面

## 5. 冻结要求

- 新增法案辅助文件必须直接服务 Amazon-first 主线或其必要基础设施。
- 若一个文档无法服务现役架构，结论只能是删除或改写。
- 不允许在文档层维护双轨宇宙。
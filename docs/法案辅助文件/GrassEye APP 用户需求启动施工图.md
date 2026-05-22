# GrassEye APP 用户需求启动施工图

版本：2026-05-21  
状态：active

说明：本文件保留旧路径，仅约束 workbench 内的任务请求入口；它不约束
`npm run grasseye:start` 的本地 app 启动职责。

## 1. 任务入口不是通用需求引擎

当前任务入口只接收已知 job flow 的结构化输入，不服务通用任务理解或多平台需求编排。
本地 app 启动只负责打开 workbench；任务入口负责把操作者输入送入明确法门。

## 2. 操作者提交的最小输入

- `sellerCentralEntryUrl`
- `amazonOrderId`
- `invoiceNo`
- `invoicePdf`
- `requireHumanFinalSubmit`

可选辅助输入：

- `adminUrl`
- `marketplace`

## 3. 任务请求链

```txt
operator input
  -> local HTTP workbench
  -> amazon task service
  -> save approved PDF
  -> start amazon-invoice-upload.flow.ts
  -> persist task status
```

## 4. 当前接口面

- `POST /api/amazon-invoice-upload/mission`
- `POST /api/amazon-invoice-upload/task`
- `POST /api/amazon-invoice-upload/task/resume`
- `GET /api/amazon-invoice-upload/task?taskId=...`
- `GET /api/amazon-invoice-upload/latest?amazonOrderId=...`

## 5. 禁止项

- 通用用户需求解析器
- 多岗位路由器
- 根据自然语言自动生成流程
- app 启动入口直接控制 DOM 或浏览器动作
- 未批准文件自动上传

# GrassEye 本地应用形态与运行壳施工图

版本：2026-05-21  
状态：active

## 1. 当前形态

GrassEye 当前是一个本地 HTTP workbench，服务 Amazon 发票上传主线。

它不是 SaaS，不是浏览器扩展主产品，不是 CLI-only 运行面。

## 2. 当前页面与接口

根页面提供最小入口说明。  
当前现役接口：

- `GET /api/health`
- `GET /api/mode`
- `POST /api/amazon-invoice-upload/mission`
- `POST /api/amazon-invoice-upload/task`
- `POST /api/amazon-invoice-upload/task/resume`
- `GET /api/amazon-invoice-upload/task`
- `GET /api/amazon-invoice-upload/latest`

## 3. 当前运行壳职责

- 承载最小本地页面
- 暴露最小 HTTP API
- 连接 local workbench handle

## 4. 当前运行壳禁止项

- 自己拥有流程顺序
- 自己拥有 evidence truth
- 自己拥有 AI judgment
- 自己变成第二套 runtime

## 5. 当前 owner 边界

- `src/app/**`：HTTP surface
- `src/lib/local-runtime/**`：本地装配与 handle
- `src/plugins/amazon-invoice-upload/**`：业务流程
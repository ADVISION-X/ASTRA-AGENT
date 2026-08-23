# GrassEye Amazon Invoice Upload Terminal Authority 施工图

版本：2026-08-21
状态：active
owner：amazon-invoice-upload
对应法案：`.github/instructions/agent-rules/modules/module-amazon-invoice-upload.instructions.md`

## 业务主链

```txt
API / App Shell
  -> amazon-invoice-upload mediator route
      -> terminal invoice owner
          -> persist task record
              -> review_required / manual_required
```

当前 Browser Authority site policy 没有 Amazon Invoice 写入动作。因此该 owner 不能打开 Seller Central、读取 DOM、下载 CSV、上传 PDF 或提交发票。它只如实持久化 `BROWSER_AUTHORITY_NOT_PRODUCTION_VERIFIED`；这不是上传或下载成功。

## Browser 接线

终态禁入链固定为：

```txt
invoice plugin
  -> BrowserAuthorityBroker
      -> no active Amazon Invoice site-policy action
          -> fail closed before Session Workspace / Authority / Target / Document issuance
```

该 active owner 没有条件式或预留 Browser 能力。禁止新增 selector、BrowserController、旧 `open/evaluate` 方法、逐 job/operator-claimed Target/Document、DOM compatibility adapter、fallback、shadow worker 或第二执行链。Session Workspace 和每命令动态 Authority/Target/Document 只属于 Browser owner，不会为不存在的 Invoice site action 创造业务授权。

## 验收

`scripts/acceptance/amazon-invoice-upload-terminal.acceptance.ts` 证明上传与下载入口分别持久化 `review_required` 和 `manual_required`，且没有 artifact、页面动作或成功结果。真实 Chrome 仅确认当前 Seller Central 会话可读；它不构成 Invoice 生产动作验证。

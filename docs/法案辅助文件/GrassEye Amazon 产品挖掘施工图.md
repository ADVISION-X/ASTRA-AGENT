# GrassEye Amazon 产品挖掘 Terminal Authority 施工图

版本：2026-08-21
状态：active
owner：amazon-product-mining
对应法案：`.github/instructions/agent-rules/modules/module-amazon-product-mining.instructions.md`

## 业务主链

```txt
App / API
  -> amazon-product-mining mediator
      -> terminal mining owner
          -> persist review_required record
```

当前 Browser Authority site policy 没有 Amazon 产品挖掘动作。因此不生成关键词、不访问 Amazon、不取详情/评论、不调用 AI，也不产出资料包。

## Browser 接线

终态禁入链是：

```txt
product-mining plugin
  -> BrowserAuthorityBroker
      -> no active Amazon product-mining site-policy action
          -> fail closed before Session Workspace / Authority / Target / Document issuance
```

该 active owner 没有条件式或预留 Browser 能力。禁止回填 `open/evaluate`、BrowserController、逐 job/operator-claimed Target/Document、DOM adapter、fallback 或第二执行链。Session Workspace 和每命令动态 Authority/Target/Document 只属于 Browser owner，不会为不存在的 mining site action 创造业务授权。

## 验收

`scripts/acceptance/amazon-product-mining-terminal.acceptance.ts` 验证任务只持久化 `review_required` 与 `BROWSER_AUTHORITY_NOT_PRODUCTION_VERIFIED`。它不代表真实 Amazon 采集或资料包产出成功。

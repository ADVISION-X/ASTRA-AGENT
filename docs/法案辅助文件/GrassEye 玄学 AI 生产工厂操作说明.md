# GrassEye 玄学 AI 生产工厂操作说明

status: active-runbook
version: 2026-07-28
authority: `.github/instructions/agent-rules/modules/module-xuanxue-ai-production.instructions.md`

## 首次登记

服务器先签发短期登记口令，本机仅在登记时使用：

```sh
XUANXUE_AI_PRODUCTION_CLOUD_BASE_URL="https://你的服务器域名" \
XUANXUE_AI_PRODUCTION_CLOUD_DEVICE_NAME="玄学AI工厂-Mac" \
XUANXUE_AI_PRODUCTION_CLOUD_ENROLLMENT_TOKEN="短期登记口令" \
XUANXUE_AI_PRODUCTION_CLOUD_MAX_IN_FLIGHT=10 \
npm run xuanxue-ai-production:cloud:enroll
```

登记后生成 permission-0600 本地设备凭据。常规启动只需要配置
`XUANXUE_AI_PRODUCTION_CLOUD_BASE_URL`；不得继续保存登记口令。

## 常规工作

Workbench 启动后，本机主动 heartbeat 和领取整单：

```txt
网站云端待处理订单
→ 本机按剩余窗口领取
→ SQLite 工厂账本
→ 固定动作图
→ GPT Web
→ 整单结果回传
```

本机不开放入站端口。临时无 GPT、浏览器断线或网络中断写入 `recovery_pending`，不删除
订单。重启 Workbench 后会从本地账本恢复，云端重复派发同一身份只会复用原订单。

管理员在玄学网站发起准确度追问时，服务器会把追问绑定到父订单最终回答，并只派给原
设备。本机必须保留生产 SQLite；这样隔天仍能回到父 GPT 会话继续问。历史链已经捕获的
合法回答会作为 seeded 前缀导入，本机只补做剩余阶段。

## 禁止排障方式

- 不得删除 SQLite 来“重试”真实用户订单。
- 不得改 order id、source task id 或 request hash 绕过冲突。
- 不得手工把失败状态改成 completed。
- 不得在日志中打印设备凭据、lease token、用户资料包或 provider 会话 URL。
- 不得删除父订单后尝试执行人工追问，不得把追问改成新聊天。
- 不得把 seeded 原始回答复制成新的 execution 来绕过 hash/proof 校验。

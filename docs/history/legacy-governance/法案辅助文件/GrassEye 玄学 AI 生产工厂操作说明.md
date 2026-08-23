# GrassEye 玄学 AI 生产工厂操作说明

status: active-runbook
version: 2026-07-28
authority: `.github/instructions/agent-rules/modules/module-xuanxue-ai-production.instructions.md`

## 首次登记

服务器先签发短期登记口令，本机仅在登记时使用：

```sh
XUANXUE_AI_PRODUCTION_CLOUD_BASE_URL="https://你的服务器域名" \
XUANXUE_AI_PRODUCTION_DEVICE_NAME="玄学AI工厂-Mac" \
XUANXUE_AI_PRODUCTION_ENROLLMENT_TOKEN="短期登记口令" \
XUANXUE_AI_PRODUCTION_MAX_IN_FLIGHT=10 \
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
一张多阶段订单从第一步到最后一步只使用一个 GPT 聊天。看到合婚乙方、合婚总论、八字
问题分析、起名创作或文章写作跳到 ChatGPT 空白首页，必须立即停止；这是错误动作，不是
正常的角色切换。原聊天仍可恢复时保留已完成上游回答并回到原聊天继续；原聊天已经失效
时，AGENT 必须整张订单从第一步在一个新聊天重建，禁止后续节点原地紧循环。

终端只有在 GPT 页面真实出现本 execution 的唯一 marker、轮次只增加一条且正式会话 URL
完成持久化后，才会记录 `prompt_submit success`。只看到按钮被点击或页面跳转不算成功；
若页面回到其他任务的旧聊天，AGENT 会自动废弃本次 execution 并重跑，用户仍看到处理中。

管理员在玄学网站发起准确度追问时，服务器会把追问绑定到父订单最终回答，并只派给原
设备。本机必须保留生产 SQLite；这样隔天仍能回到父 GPT 会话继续问。历史链已经捕获的
合法回答会作为 seeded 前缀导入，本机只补做剩余阶段。seeded 回答仍要经过私用字符、
provider 引用残留和 provider 失败回答检查；坏 seed 会自动退休并重做，不会假装成完成。

普通用户购买八字、奇门或合婚报告追问时也完全相同：服务器绑定原正式报告的最终 GPT
会话，AGENT 只在这个 URL 内发送。一个父聊天有多条追问时按创建顺序逐条生产；别的父
聊天仍可并发。若日志出现 `PARENT_*`、`CONTINUATION_*` 或历史订单没有父身份，订单
必须保持 `recovery_pending`，用户侧只显示处理中。网站补发不可变父身份和父重放包后，
AGENT 先在 order/source/product/input bundle 与材料语义完全一致的前提下原位补齐父身份，
再从父任务第一阶段完整重建，并在重建后的父聊天执行追问；绝不能手工打开空白聊天代替。
只有外来设备账本、不可变身份冲突或安全边界无法自动确认时才进入人工查证。

同一订单第二步或第三步找不到第一步的精确 GPT 聊天时，不要手工重试，也不要删除账本。
AGENT 会记录一次 `conversation_graph_rebuild_started`，废弃旧下游 execution，从第一步
在一个新聊天完整重建，再继续后续步骤。若终端十秒左右反复出现同一个 continuation
mismatch 且没有整图重建事件，属于工厂故障，应立即停机排查，避免无效调用。

## 禁止排障方式

- 不得删除 SQLite 来“重试”真实用户订单。
- 不得改 order id、source task id 或 request hash 绕过冲突。
- 不得手工把失败状态改成 completed。
- 不得在日志中打印设备凭据、lease token、用户资料包或 provider 会话 URL。
- 不得删除父订单后尝试执行人工追问，不得把追问改成新聊天。
- 不得让同一父聊天的两个追问并发发送，不得跳过前一条恢复中的追问。
- 不得把 seeded 原始回答复制成新的 execution 来绕过 hash/proof 校验。
- 不得因阶段角色或提示词改变而新开聊天；一张订单只有首阶段允许创建聊天。

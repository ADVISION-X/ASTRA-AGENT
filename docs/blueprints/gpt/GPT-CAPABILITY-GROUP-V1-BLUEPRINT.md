# GPT 能力组 V1 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "gpt-capability-group-v1",
  "status": "active",
  "owner": "gpt",
  "lawIds": [
    "LAW-GPT-001-V3"
  ],
  "contractRefs": [],
  "dependencyEdges": [
    {"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"capability-governance","repo":"local"}},
    {"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}},
    {"contractRef":null,"from":{"domain":"gpt","repo":"local"},"to":{"domain":"runtime-log-spine","repo":"local"}}
  ],
  "prohibitedDependencyEdges": []
}
```

## 唯一终态

`gpt` 是 GPT Provider 的唯一能力组，公开 transport 固定为 `gpt-web`，物理根固定为
`src/capabilities/gpt/`。Product Plugin 拥有业务 Flow、Prompt、输入引用、会话意图、结果判定和敏感动作；
GPT 能力组只接收已经批准的原子请求并返回 GPT 页面事实与证据。未来接入其他 AI 时建立另一个独立能力组，
不得恢复通用 AI Gateway、provider selector、兼容 wrapper、alias、fallback、bridge、shadow 或第二页面链。

```text
Product Plugin request
  -> src/capabilities/gpt/index.ts 唯一公共 Facade
  -> 一个稳定 Provider 页面意图对应的精确 Child Ability
  -> Browser Authority exact Target + Document
  -> 一次有界 observation，或一次 precondition + 唯一 dispatch + 完备 postcondition
  -> typed GPT child receipt
  -> Product Plugin 继续业务 Flow
```

唯一公共合同固定为 `GptAbilityGroup`，`abilityGroupId` 只能是 `gpt`，内部 transport 只能是 `gpt-web`。
公共 Facade 只暴露 `listChildCapabilityIds()` 和一次只接收一个 `GptChildCapabilityIntent` 的 `execute()`；
它不得接收动作数组、selector、脚本、坐标、tab id、Provider URL 或 fallback policy。

每个 `ChildCapabilityContract` 必须声明 `childCapabilityId`、`contractVersion`、`inputSchema`、
`requiredTargetKind`、`allowedDocumentTransition`、`precondition`、`oneObservationOrMutation`、
`postcondition`、`evidenceSchema`、`failureClassification` 和 `replayPolicy`。每次执行必须返回同一
`GptChildCapabilityProof` 的 `childCapabilityId`、`executionId`、`targetRefHash`、前后 Document ref/hash 与 URL、
`pluginStepId`、`childCapabilityId`、`actionOrdinal`、`candidateCount`、`observedSemantics`、
`mutationOutcome=no|dispatched|confirmed`、`postconditionResult=passed|failed|pending`、开始/结束时间以及
`evidenceRef/evidenceHash`；非 DOM child 的 Target/Document 字段才允许为空。

公共 Facade 只做合同解析、Child 定位和单次委派。它不得在 Child 前后或异常分支自行读取 DOM、执行页面动作、
重试或补做后置流程；前置、物理动作、互斥且覆盖允许页面结果的正向/负向后置判据必须在 dispatch 前冻结，并由当前 Child 自己一次收束。物理 dispatch 已发而 receipt 未返回时只形成精确 `DISPATCHED + postcondition pending`，不得生成 UNKNOWN 结果。

## 原子子能力分母

公开 `childCapabilityId` 固定为以下 43 项；实现文件可按同一页面元素 Owner 垂直合并，但不得用粗粒度
`feed-gpt-once`、动态字符串或私有别名替代这份分母。

| 类别 | 固定 childCapabilityId |
|---|---|
| Target / Document | `bind_exact_gpt_target`、`observe_gpt_document`、`verify_gpt_workspace`、`restore_gpt_operator_source` |
| 已知临时 UI | `acknowledge_known_gpt_rate_limit`、`dismiss_known_gpt_search_dialog`、`cleanup_owned_gpt_transient_ui` |
| 会话 / 搜索 / 分叉 | `verify_clean_gpt_chat`、`focus_exact_gpt_conversation`、`open_gpt_conversation_search`、`write_gpt_conversation_search_key`、`select_exact_gpt_conversation_result`、`open_gpt_fork_control`、`commit_gpt_checkpoint_fork`、`verify_gpt_conversation_identity` |
| 模型 / 推理 | `observe_gpt_execution_profile`、`open_gpt_model_selector`、`select_exact_gpt_model`、`open_gpt_reasoning_selector`、`select_exact_gpt_reasoning_tier`、`verify_gpt_execution_profile` |
| 附件 | `open_gpt_attachment_control`、`attach_approved_gpt_files_once`、`verify_gpt_attachment_set` |
| Composer / 提交 | `focus_exact_gpt_composer`、`write_exact_gpt_prompt`、`verify_exact_gpt_prompt`、`submit_exact_gpt_turn`、`verify_gpt_turn_submission` |
| 回答 / Artifact | `observe_exact_gpt_assistant_turn`、`wait_for_stable_gpt_response`、`checkpoint_gpt_text_response`、`checkpoint_gpt_generated_image`、`capture_gpt_response_artifact` |
| 标题 | `open_gpt_title_control`、`write_exact_gpt_title`、`commit_gpt_title`、`verify_exact_gpt_title` |
| Continuation / 恢复 | `persist_gpt_continuation`、`acquire_gpt_continuation_lane`、`advance_gpt_continuation_lane`、`release_gpt_continuation_lane`、`recover_gpt_response_checkpoint` |

每个 child 文件只拥有一个稳定、可独立验证的 Provider 页面意图、一个输入合同、一个前置证明、一次有界
observation 或一次 precondition、至多一次 dispatch 及其完备 postcondition、一个 evidence schema、一个 typed failure 集合和一个 replay
policy。定位元素、读取属性、执行点击和核对结果是该页面意图内部的前置/动作/直接证明，不拆成互相竞争的公开
兄弟能力。Child 不调用兄弟 child，不隐藏多步 workflow；唯一 `gpt-session-controller.ts` 只管理 opaque
continuation、conversation identity、turn marker 和 lane CAS，标题不是身份。

## 状态、调用与安全边界

GPT 能力组不建私有数据库、队列、证据库或日志系统。短期页面状态留在单次调用内；续聊绑定由唯一 Session
Controller 写入调用方提供的 shared persistence port；证据和日志只经现役 capability port 输出。调用只能从
Product Plugin 到 GPT 公共 Facade，再到 Browser Authority，禁止 Product Plugin 导入 GPT 私有 DOM、selector、
坐标、tab、Browser 命令或 Provider SDK。

Browser Authority 是物理动作许可 Owner。新 GPT turn 的首个 Browser 原子请求只取得该 turn 专属的后台
ChatGPT Target，不复用、认领、关闭或操纵操作者已经打开的 ChatGPT 页面；页面加载完成并复核精确 Origin 后才
建立 exact Target/Document。候选为 0 时不得点击，候选大于 1 时不得猜选；Target/Document 漂移、
动作已 DISPATCHED、已有 upload/submission/checkpoint proof 时必须失败关闭。恢复只允许在原 Target/Document 上按当前 Child 已冻结的正向/负向判据只读补核；只有 `mutationOutcome=no` 才允许重新绑定 exact Target；不得自动 replay，也不得刷新、重开、重传或重发。登录、验证码、2FA、风控、账户轮换、全局设置、
cookie、storage、密码和 token 全部在能力组边界之外。

会话拓扑的唯一判定者是 Product Plugin：fresh turn 使用 Browser Authority 新建的根页面并调用
`verify_clean_gpt_chat`；authorized continuation 仍先新建任务专属根页面，再由 `focus_exact_gpt_conversation` 导航到
冻结的 canonical conversation URL 并调用 `verify_gpt_conversation_identity`。物理建 tab 不是 Product Plugin 功能，
也不是 GPT DOM Child；`click_gpt_new_chat` 因与任务 Target 创建重复而物理退出。

## 验收

静态检查必须证明只有一个 `gpt` 根、一个公共 Facade、一个 Session Controller，全部 childCapabilityId 可枚举且旧
`src/capabilities/ai-input-gateway/` 与其脚本、Manifest、路由、wrapper 和别名物理为零。AST、类型与依赖检查必须
证明调用方向和私有边界；golden、property、state-machine Exam 必须覆盖 0/1/多候选、页面漂移、DISPATCHED receipt 丢失只读补核、附件
精确集合、长 Prompt、提交后禁重放与 checkpoint 后标题失败。Dynamic Proof 必须在真实 Chrome 的同一 Target/Document
证明 execution profile、附件、Prompt、提交、回答 checkpoint 和恢复分类；任一证据缺失即 FAIL，不得用 HTTP 200、
截图、日志或旧快照冒充页面终态。

正文闭环：Owner 是 `gpt`；输入为 Product Plugin 已批准的原子 GPT 请求与 Browser Authority grant，输出为绑定
childCapabilityId、Target/Document、前后置条件和 evidence ref/hash 的 typed receipt。状态仅存在于单次调用与唯一
Session Controller 的 shared persistence port；失败恢复只能修复原 child 或在零 mutation 证明下重新绑定，安全边界
禁止业务决策、认证绕过和第二链，验收以静态分母、Exam 与真实浏览器证据共同证明唯一终态。

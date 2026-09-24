# production-runtime 生产级施工图 V63

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "agent-production-runtime-v63",
  "status": "active",
  "owner": "agent-production-runtime",
  "lawIds": [
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V70",
    "LAW-AGENT-PRODUCTION-RUNTIME-002-V10",
    "LAW-AGENT-PRODUCTION-RUNTIME-003-V40",
    "LAW-AGENT-PRODUCTION-RUNTIME-004-V40",
    "LAW-AGENT-PRODUCTION-RUNTIME-005-V39",
    "LAW-AGENT-PRODUCTION-RUNTIME-006-V42",
    "LAW-AGENT-PRODUCTION-RUNTIME-007-V42",
    "LAW-AGENT-PRODUCTION-RUNTIME-008-V43"
  ],
  "contractRefs": [
    "docs/specs/agent-production-runtime/agent-route-capability-manifest.provider.spec.json",
    "docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json",
    "docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json"
  ],
  "dependencyEdges": [
    {"contractRef":"docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json","from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"ai-acceptance","repo":"ADVISION-X/xuanxue-web"}},
    {"contractRef":"docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json","from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"ai-acceptance","repo":"ADVISION-X/xuanxue-web"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"architecture-boundary","repo":"local"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"forensics-persistence-capability","repo":"local"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"gpt","repo":"local"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"runtime-log-spine","repo":"local"}},
    {"contractRef":null,"from":{"domain":"agent-production-runtime","repo":"local"},"to":{"domain":"system-security","repo":"local"}},
    {"contractRef":null,"from":{"domain":"app-shell-ui","repo":"local"},"to":{"domain":"agent-production-runtime","repo":"local"}},
    {"contractRef":null,"from":{"domain":"local-app-shell","repo":"local"},"to":{"domain":"agent-production-runtime","repo":"local"}},
    {"contractRef":null,"from":{"domain":"startup-entrypoint","repo":"local"},"to":{"domain":"agent-production-runtime","repo":"local"}}
  ],
  "prohibitedDependencyEdges": [
    {"from":{"domain":"agent-production-runtime","repo":"local"},"lawId":"LAW-AGENT-PRODUCTION-RUNTIME-001-V70","to":{"domain":"app-shell-ui","repo":"local"}},
    {"from":{"domain":"agent-production-runtime","repo":"local"},"lawId":"LAW-AGENT-PRODUCTION-RUNTIME-001-V70","to":{"domain":"local-app-shell","repo":"local"}},
    {"from":{"domain":"agent-production-runtime","repo":"local"},"lawId":"LAW-AGENT-PRODUCTION-RUNTIME-001-V70","to":{"domain":"startup-entrypoint","repo":"local"}}
  ]
}
```

## 1. 唯一职责与边界

agent-production-runtime 只拥有一条 product-opaque 运输与恢复主链：

```text
Website claim + lease/grant/fence
  -> Runtime durable accept
  -> Mediator 单次路由
  -> 命中的 Product Plugin 按自身 Product runtime authority 执行
  -> exact mechanically valid result + artifact receipts
  -> one SQLite transaction: staged result + terminal Outbox intent
  -> Browser/GPT cleanup as diagnosis only
  -> Website domain consumer admission
  -> Runtime 校验 admission receipt
  -> local completed
  -> 释放当前 job 的一个本地在途席位；其余已授权 job 不受影响
```

| Runtime 运行职责 | 只通过 typed interface 消费 | 明确不拥有 |
|---|---|---|
| credential read、session、claim、durable accept、attempt、lease/fence | Website control intent、claim/grant/fence、business admission receipt | Website 业务准入、任务创建、领域入库、公开状态 |
| Runtime 当前授权的运输、lease/fence 与 typed failure | Browser effect WAL、GPT 当前 Child 结果 | Product 静态 Flow、Prompt、各技能精确模型/0..5 推理目标、Child 顺序与结果组装；GPT 只作当前滑杆上限数值截断 |
| product-opaque failure、健康与诊断安全投影 | Runtime Log 的单写者接口 | Browser 私有 WAL、Target/Document、Runtime Log 事实正文 |
| 唯一 Runtime inspector、acceptance 与 Runtime-only proof | 相邻能力权威已签发的 typed receipt，不复制证明正文 | 第二 checker、proof、queue、store、receipt、verdict 或兼容链 |

Manifest primary Owner 只表示路径治理。Product runtime authority 只拥有静态 Flow、Prompt、每个技能的精确模型与 0..5 整数推理目标、Child 顺序与结果组装，不拥有 Website 恢复决定或 Provider session store。GPT 不替换指定模型，只在该模型当前页面滑杆下计算 min(要求值, 上限) 并精确读回；Runtime 只做当前 task/attempt 的 typed 转交；Website Bazi sender 唯一提供已入库且精确绑定的父报告材料，Browser 唯一拥有 WAL 与 FIFO。

`business_recovery_decision_owner_count = 1`，唯一 Owner 是 `Website.ai-acceptance`。未 admission 且未被 Website 持久终止的同一 job 必须由现役 worker 持续取得可执行或有界再检查的下一动作。Runtime 先核本地机械有效结果及 Outbox，存在时只交付原结果；无结果时向 Website 原 claim 提交各 Owner 的旧 first fact、结果候选与 Browser 全历史 typed 证据，Website 在原 job 行锁内核对后签旧 attempt 交付、新普通 attempt 或指定调用的新 revision 风险授权。风险授权须覆盖完整旧 WAL 中所有不可读回而需风险重提的稳定调用集合；Website 在同一 source/issued attempt、source seal、新 revision 和原 event/receipt 下，对每个 `product_step_id/call_id/child_capability_id` 及跨旧 attempt/revision 的完整 Provider effect 集合 hash 独立签一次 grant hash。Browser 原 WAL 在一次事务中核当前精确调用与该项旧集合；该项 grant 的现实 Provider 输入总数至多一次：PREPARED 崩溃后 FAILED/no/零输入只可重绑原 row，已终局 REJECTED/no/零输入可保留旧 proof 后在全 grant 零输入、无未决、同身份时写下一 command；其它已有行不得再插第二条，其他调用不能借用，旧全零输入的调用可正常首次执行。旧 Provider effect 默认零 submit 读回，只有原答案不可取得、旧 Target 可证物理缺席或旧 handler/CDP 输入可证静止且 Website 持久风险授权时才对新 effect 一次可能重复输入；除原 `provider_cooldown` 事故通知的精确事实例外，旧 fence 的 Provider、结果及其他业务 mutation 写请求继续拒绝；该例外不恢复旧执行权。

Outbox 中只有旧 `result_payload` intent 时，它的路径/body hash 仍计入不可变历史，但尚非完整结果候选；Runtime 先对原 effect 有限零输入读回，不把半截上传当作永久占槽。旧答案确证不可取得后，Website 原行锁核旧 envelope/terminal/admission 缺席才可签 source handoff；本地或 Website 已有完整 envelope/terminal 则只能继续同一结果的交付。

旧 payload 已接纳但同 effect 经新代码零输入读回生成不同 payload 时，原槽 409 必须触发原 source handoff 的可复用证明，而非重复 PUT。AGENT 原 Outbox Owner 核原已送达 payload intent/receipt、不同正文的精确 409 intent 和 Browser 全部调用 settled checkpoint，将旧/新请求身份、旧/新 payload hash 与旧 receipt hash 封入原 source evidence；Website 只能在原 job 行锁核 Website 自己持有的旧 staged payload、原 cloud write receipt 与摘要匹配，并核完整 envelope/terminal/admission 缺席，不声称直接读取 AGENT SQLite。仅满足该闭集才签新 revision 的零提交 grant，`calls=[]` 不授权任何 Provider 输入；GPT 只对该 seal 内逐调用已验证的 checkpoint 复用。新 attempt 仅从原 checkpoint 恢复各调用，在自己的对象槽交付；若新 attempt 再次中断，原 source seal 的全量零输入结算可沿同一已签 lineage 继续证明，不能降格为风险重提或永久停工。证据不齐仍停留在原 attempt 对账。

 Browser 精确识别已知ChatGPT限流弹窗时，Runtime必须在ack前经现役`production_outbox`持久化唯一`provider_cooldown` intent并同步关闭无关新claim与尚未发生的Provider submit；ack确认absent后按incident→clearance顺序向Website交付，ack失败、崩溃或未清除时也必须按同一顺序交付incident与幂等`not_cleared`；ack已确认 absent 但 `confirmed_absent` 交付失败时保留并重试该原 Outbox intent，绝不追加 `not_cleared`，不得让Website失去事故事实。该门覆盖acquisition、atomic phase与atomic success后的confirmed-effect selection，后一阶段发现exact blocker也必须进入同一cooldown closure并保留原CONFIRMED effect，不得绕过closure或退化为未发送事实。该门不复用shutdown abort，不终止任何在途job，并继续允许heartbeat/renew、同effect零submit读回、结果Outbox、Website领域consumer、admission receipt与持久化读回。进程重启只从同一Outbox/Website receipt重建门，不保存当前N或Website权威cohort，不新增表、worker、scheduler或第二Outbox。Website receipt到达前本地门不得按本地计时自行打开；送达后也只有最新clearance已是`confirmed_absent`，且不早于最新provider receipt `server_now`并不含`PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE`的Website claim receipt可以重新开放submit；`not_cleared`永久不能自行开门。

已在 AGENT 本地持久 stage+terminal Outbox 的 accepted attempt，Browser Authority 缺席与 Provider cooldown 均不得阻断原结果交付；原 claim request 携精确 job/attempt/本地候选 hash，Website 只对仍持有该 accepted attempt 的候选签 delivery-only 同 attempt lease/fence，且不得把该声明扩大为其它 job 的执行资格。AGENT 仅在本地已 stage 的原结果可精确读回时使用此 grant 交付或读回 Website 原对象，绝不进入 Product/Browser；Website 已 staged 的原结果也可沿相同 delivery-only 规则交付。

同一 accepted attempt 的风险授权已写 Browser 原 WAL 的 PREPARED 行、但尚未实际 dispatch 就崩溃时，Website 的同 attempt 重授不生成新风险 grant。Browser 只有证明原行在重启后为 FAILED/no/零输入且同 effect、grant、request/payload 不变，才可在原行以新 command/fence/Target 重绑后继续一次输入；已 DISPATCHED 或来源未知必须继续零输入读回。

风险授权当前 command 如获 Browser 精确 `REJECTED/no/physicalInputCount=0`，Website 在同一 accepted attempt 上有限退避重授原 grant；Browser 保留该 terminal/proof，并只在该 grant 全部历史 command 均可信零输入、身份相同且无未决行时，允许新 command 一次尝试。已输入或未知继续原 effect 读回，grant 的现实输入总数仍至多一次。

风险 revision 连续发生时，原 Browser WAL 与每个调用的 source effect set hash 始终覆盖完整旧历史。Runtime 必须从原已签 source handoff 和 Website 精确 result rejection 身份证明哪些旧 effect 已被拒绝结算；这些 effect 不在当前答案可复用集合，也不需要假造当次读回观察。此前已获 Website 精确风险授权的旧 effect 以原签事件、逐 effect 耗尽证明与完整 Browser WAL 对账，不重复读回或重新签 grant；其它尚未结算的历史 effect 无论属于哪个 revision 仍逐一读回或证明耗尽。Website 在原 job 事件/receipt 对账已拒绝与已授权的历史 effect；只凭 revision 编号较旧不足以豁免。

关闭Owner进入时先读同一`ProviderRateLimitControlPort` submit gate。若门已因首个incident关闭，后续并发/多Tab exact blocker只保持当前cooldown与accepted attempt，不新建incident、ack或Website write；Website的device锁内防御门也必须在receipt insert前拒绝活动窗口内不同`incident_request_id`，使其不得覆盖latest。若首个incident的Outbox enqueue在submit gate关闭前失败，向Runtime报告的closure failure必须保留已有confirmed provider-effect identity与Browser authority；Website恢复只能保留同attempt零submit读回，不得签新attempt。

同一cooldown request的锁前幂等查询若因并发事务尚未提交而未命中，Website取得exact device锁后必须再次用现役`worker_session_id + request_id + payload_hash`回读；命中即返回同一verified receipt，只有锁内仍未命中且`incident_request_id`确为不同值时才能触发活动窗口冲突。heartbeat必须消费同一`readProviderCooldownGate`并把reason写入signed receipt，但`claim_eligible`只表示session可否请求claim，不能等同“无关新grant开放”：活动窗口仍须允许cohort内accepted attempt regrant和同effect零submit读回，时间门后还须允许cohort内未发送job取得新attempt。AGENT只在incident尚未送达Website前关闭全部claim请求；送达后可请求claim，由Website claim transaction用同一gate把选择严格限制在cohort，绝不签发无关新grant。submit gate与claim-request资格不得混为一个布尔值。

Browser preflight返回`BROWSER_GPT_DIALOG_UNRECOGNIZED`时，Runtime在唯一accepted-boundary只更新本地task current reason并写现役Runtime Log authority ref/hash；该事实不是已知限流incident，也不是Website业务恢复输入，必须保持`provider_cooldown` Outbox、`attempt_failure_json`、`lease_release ATTEMPT_FAILED`与Website recovery decision增量为零。Runtime不得解释DOM机械fact、调用ack/cooldown closure或新建持久mismatch gate；只有后续Browser fresh同Target/current Document返回typed absent，Product调用链才可重新进入Provider访问。

同一`(job_id, attempt_id)`的普通attempt failure只允许一份本地`AttemptFailureFirstFact`，仍原位保存在现役`production_tasks.attempt_failure_json`，不新增表、Outbox kind、ledger或worker。不可变`failure_core`必须保留完整`SerializedTerminalFailure/FailureFactsV6`；唯一`release_descriptor`绑定`attempt_id/lease_version/request_id/body_payload_hash/write_request_payload_hash`。现役唯一lease-release builder一次产生request、两种hash与request_id；顺序必须是serialize完整failure → builder → 空槽CAS持久完整first fact → authority reader逐字节回读 → 才允许POST。200、回复不明和稳定409都必须GET device-status，严格读回同一`lease_release` receipt或Website原始`attempt_failure + next_action_code`；request、双hash、attempt、lease与response任一不等均失败关闭。原lease/session仍有效时只可重投同descriptor；进程重启或旧fence/session不可证明时只GET，不得重建旧请求或重跑Provider。

同 attempt regrant 与结果交付不得先清 first fact 或执行 Provider。Runtime 先核 Website admission/result/terminal 与原 task/Outbox；机械有效结果及必要 artifact receipt 闭合后，必须在同一 SQLite 事务写 stage + terminal intent，保留 first fact 原值供 `TerminalCasV6.terminal_source_first_fact` 运输。Website 原 terminal CAS 保存该原值及与既存旧 failure 的冲突诊断；冲突不否决机械合格结果。领域 admission receipt 与对象读回后，才以精确 CAS 从本地当前槽退休 first fact。若旧结果不存在，Website 对旧 failure 的任何不完整/矛盾事实只能禁止当前危险动作并继续有界对账；不能让 job 占槽而永不领取。新 attempt 的 source_evidence 必须在 Runtime 原 per-job Owner 停止旧 execution、以原 task current_attempt_id + current_reason + staged_result_json is null 及旧来源 hash 持久 CAS 封住旧 completion 入口（本地无持久 fence，Website 原行锁另核旧 fence）后出具；晚到旧上传回执不能 stage/terminal。旧 READY 已在封口前成立时必须交付原结果而不得换 attempt；新 accepted 后的旧字节仅是历史候选，不能用旧 fence 交付，当前 attempt 继续。

Website 已持久裁决 `WAIT_NEW_ATTEMPT` 且原 job 事件/claim receipt 已核 `source_evidence[]` 后，新 grant 必须是不同 attempt；旧 first fact 缺失、非法或矛盾仅作为原值/缺失证据留在该事件，不作新 attempt 资格门。device-status 在 runtime 没有当前 attempt 时只可投影历史 latest failure 供旧来源对账；存在当前 attempt 时只投影与 `runtime.attempt_id` 相同的 failure，合法新 attempt 尚无 failure 时返回 null，不把旧事实冒充新事实。Runtime 在原 per-job Owner 收束旧 executor 并以本地 `current_attempt_id + current_reason + staged_result_json is null` 及旧来源 hash 持久 CAS 封住旧完成端口后才出具 manifest；Website 原 job 行锁另核旧 fence/当前 attestation 并签 grant。Runtime 读回同一 receipt/event 后，只由 `acceptTaskAfterSourceHandoff` 对本地已封存 manifest、旧 first fact 原字节或明确缺失、source/issued attempt 与新 grant 作同一事务 CAS；旧 first fact 已保存在 Website 原事件，才可从本地当前槽退休，旧 Outbox/artifact/WAL 历史不删。封存的 Outbox history hash 只绑定不可变的 intent 身份、路径与 body hash，不绑定会随后落地的发送时间或回执；每轮 claim 复用原 SQLite 中同一封存 manifest，不因部分上传回执晚到而重算 seal。`acceptTaskAfterFailureReconciled` 只处理同 attempt regrant，不得跨 attempt。已接受 attempt 重授而本地 task 尚不存在时，Runtime 先核 Browser WAL、Outbox 与 Target 历史；完全空白才正常 durable accept，已有历史则先恢复本地 task 身份并在下一轮对账，不得凭本地缺席推断 Provider 零输入。无完整 first fact 的可能输入历史只禁当前危险动作；原 worker 定时核 Browser/Outbox 无结果事实并持久化有限观测，满足 Website 风险授权门后走原 source handoff，不得盲目重跑 Product。任一身份或 CAS 不等只禁本次危险动作并自动对账，不能永久冻结 demand；禁止把旧 failure 重绑/POST 到新 attempt，不新增中间状态、第二恢复器或兼容路径。

原 accepted attempt 的 Provider 输入可能已发生而结果未就绪时，Runtime 不得先释放仍可安全重绑的旧 Target。Website 原 claim 先重授同 attempt 的读回 lease；Product/GPT 在现役 Browser WAL 和旧 Target/Document 精确身份下逐调用执行零输入答案读回，真实尝试的调用键、旧 effect、Target、时间、读回结果或失败码与 Owner proof hash 写入原 `production_attempt_handoffs`。旧 Target 可安全重绑时先原位读回；原 claim 已经 Browser 按精确 Target 鉴权结算且当前无未释放 claim 时，允许在新独占 Target 凭同一 CONFIRMED WAL 的可信 canonical conversation URL/user turn 零提交读回，quiesced 在此只证明旧 handler 停稳，不能作为旧答案不可得或风险重提证明；仍未结算的旧实例确实不可绑时必须先取得该实例的 typed fact，随后才用新独占 Target 精确选择原会话读回。两条适用路径均失败才可证明旧答案不可取得；DISPATCHED 无可信锚点且 Browser 已出具逐 effect typed unaddressable 与旧输入停稳双事实时，只能声明答案无法机械归属，可由 Website 明确承担一次可能重复风险。读回成功继续原结果交付；定时重算 Browser/Outbox 历史哈希、等待或空证据不构成读回失败。仅各旧调用的适用零输入读回路径真实有界耗尽或根本无可信锚点，且旧 Target 物理缺席或旧 handler/CDP 输入已静止，才经原 `source_evidence[]` 交 Website 行锁作交付优先风险裁决；`quiesced` 单独只证明输入静止，不能冒充旧答案不可取得。若 Browser 逐旧 effect 从原 WAL 证明缺可信 canonical URL/user turn、现役 exact 路径无法机械归属答案，则另以 typed unaddressable fact 加旧输入停稳证明进入一次可能重复的 Website 风险授权；该分支不声称旧答案不存在。临时不可读仍保留未完成需求与有限下次检查，不开第二恢复链。 `production_attempt_handoffs` 是唯一 Runtime SQLite 的第三张现役表，只保存原 attempt 来源 seal、已签发身份与真实读回证明。历史旧表已在本机获授权单次 cutover 并逐行核对；普通启动只读校验当前精确三表，旧表、缺表及未知形状返回 migration-required，不重建、不补表、不清空旧 seal，也不以旧 seal 伪造读回。 原 `production_attempt_handoffs.readback_observations_json` 逐旧 effect 保存实际读回或 typed 不可绑事实；多旧 effect 时，成功读回的调用须在原 checkpoint 结果已写入且读回 Forensics 后，按原 effect/WAL、source attempt/revision、原 checkpoint 精确调用 hash 与 artifact ref/content hash 持久记为可复用事实；另一调用的耗尽不能把成功调用改判为可重提。来源 seal 覆盖全部旧可能输入调用及各自的可复用或耗尽结论，耗尽 hash 只覆盖真实耗尽子集。Website 只给耗尽调用签风险 grant；仅 Website 风险 revision 的原 Product 流程遇可复用调用时，GPT 只按原 WAL 与原 Forensics 产物返回原答案，零新页面准备与 Provider 输入，原定位/产物或稳定调用键不符时保持失败并自动对账，绝不转 fresh；`source_evidence[].readback_proofs` 与 `replay_calls` 一一对应，覆盖集合中每个可能输入的 `logical_mutation_id`、旧 Target 读回、可信会话锚点及适用的新 Target 精确会话读回。`readback_exhaustion_hash` 只对其中真实耗尽的调用证明规范化取 hash；空证据、计时或旧 Target 清理回执不能生成该 hash。 旧 Target 不可绑须由 Extension 对精确实例给出 typed fact；新 Target 的 exact user turn 负观察须保留 URL、Target/Document、时间和观察结果。普通错误码、quiescence 或读取超时均不能单独充当任一路径耗尽证明。现役 Provider exact call hash 已排除 attempt/fence；跨 result revision 读旧 effect 仍必须按旧 WAL 的 revision 和原调用集合精确定位。历史 first failure 的 `fail_closed` 只禁危险动作；Website 同 attempt 重授且原 first fact 精确对账、Browser 当前 WAL 证明同 attempt/revision 的 CONFIRMED 可信锚点 effect 时，Runtime 必须进入该 effect 的原键零提交读回。旧 effect 未成功读回前，Product 调用键漂移、WAL outcome 查询空值或页面准备均不得转 fresh；Browser 原 Target 可绑先原位读，精确不可绑事实成立后才释放旧 Target 并在新 Target 读同一 conversation。

`TOMBSTONE-RECOVERY-AUTHORITY-001` 继续固定 Website 是未删除需求的唯一业务恢复决策 Owner；八字新业务任务只消费 Website 已入库并精确绑定的父报告材料，且每次从 clean GPT chat 执行。同一SEO文章的五个翻译task由Website按严格locale顺序签发provider_continuation direct parent，zh-HK直连已接纳zh-CN生成task，后四个直连已接纳前序翻译task。固定catalog保持各locale/cohort独立task/result/admission，部分合格后仅失败ID进入下一张fresh补译任务；所有locale任务parent triple全空，不读取父会话。Runtime对已携带parent三元组的provider_continuation只机械读取exact parent job的本地completed任务，要求其`result_payload_ref + result_payload_hash`与Website parent triple精确相等，并把已验证的exact parent job及其`current_attempt_id`作为只读locator选择交给GPT；缺失、未完成、不等或current attempt缺失都在Browser输入前失败关闭。父任务`current_attempt_id`只选择该completed父结果所在WAL行，不跨仓、不持久化第二份，也永不进入跨attempt稳定的provider effect identity。所有固定catalog任务均fresh。Runtime不读取Provider URL、不选择父任务、不判断业务父资格，也不新增父关系或continuation持久化。已确认Provider effect跨进程只能读取同一结果且物理submit增量恒为零；continuation store/frontier/CAS、private base、fork、兼容桥及第二恢复链恒为零。

Runtime 对外只发布 Agent Route Capability Manifest。它从 Mediator 取得冻结、不可变、纯数据的 `product_id + action_id + task_contract_version + result_contract_version` 路由集合，随后在本域校验 Manifest schema/hash并用于当前 session attestation 与 claim 资格。Product Plugin 名称、版本、Skill hash 与 Catalog 实现身份不得进入 Website job、request、accepted attempt、grant、result、artifact、terminal 或 Browser effect；Runtime 源码不得直接或间接取得 `ProductPlugin` 实例、Product Skill 正文、`parseResult`、`assemblePayload` 或其它 Product 可执行回调；Product Plugin 也不得 import、re-export、dynamic import 或 side-effect import Runtime 私有模块。

Product、GPT、Browser、Forensics、Runtime Log、App Shell、Startup、Website 继续由各自 active law、blueprint、spec 与唯一 Manifest primary Owner 守住文件及接口边界。Runtime 文档只记录上表接口边，不复制其业务流程、DOM、模型策略、Provider 操作或发布裁决。

generated image 只使用 task-result v14 的现役唯一运输链。GPT Child 交付的已鉴权原始 Provider bytes 必须先以原字节与 hash 写入 task-owned Forensics evidence；Product 只在该 raw artifact 读回成功后，一次性生成仅应用 EXIF 方向且剥离 metadata 的 WebP，输出几何必须等于应用方向后的原图几何。Runtime 与 cloud client 只机械校验 Product 交付的媒体类型、字节、hash、integer 宽高和现役 V6 回执；Runtime 不自行解码图片，不增加 V6 宽高收据字段。任何层都不得 resize、crop、pad，不得以宽高、长宽比或像素总量拒绝交付。Website staging 独立解码出实际宽高，再与 v14 result payload 等值绑定；领域 consumer、对象存储和公开读取仍是同一原有闭环，不新增第二图片链、兼容分支、回退图或另一份原图上传。

GPT 页面 selector 的语义冻结只属于 GPT Child，Browser 只机械执行 typed query，Runtime 只消费 Child terminal。mutation 前是否自动选中精确 system Tab、激活后的 Target/Document 重验、输入前 activation generation 与 `BROWSER_TARGET_NOT_INTERACTIVE` 结算都只属于 Browser Authority；Runtime 不接收 tabId、不调用激活/窗口聚焦、不读取 Browser 私有状态，也不建立第二 precondition、WAL、恢复或重试。该变更不得进入 Runtime 配置、Manifest 字段或跨仓合同；Website 任务、Outbox、artifact receipt 与 business admission receipt 主链保持不变。

Website 已持久拒绝原结果 revision 且原 first failure 精确绑定 `RESULT_SETTLED_UNUSABLE` 或 `GPT_RESPONSE_STOPPED_EMPTY` 时，同一 `source_evidence[]` 以空风险集合提交 `attempt_handoff`。AGENT 先核 Browser WAL 全历史、旧 Target 结算与无 Outbox 结果候选；除本次被拒 effect 外，已由原 Website rejection 或原已签风险授权逐 effect 精确结算的旧输入保留原证据，其它未结算的旧可能输入 effect 须有 checkpoint/Forensics 正向结算证明；stopped-empty 的被拒 effect 用 Website 已核准的 observation fact，不伪造 checkpoint。Website 以原 rejection event、source attempt、effect 与独立结果/observation fact hash 行锁核验后签新普通 result revision，沿现役 `prior_result_rejection` 交 Product。原本地占槽、新 grant 分类及旧 attempt 的持久 CAS 必须随 handoff 同步闭合。

## 2. 真实调用方向与内部结构

公开知识文章的 research→article→image 是多调用 Product。普通 fresh attempt 不取得失败 attempt 半成品；唯有 Website 原 job 对 image 等指定调用已签逐调用风险授权，或旧 payload 对象槽精确冲突且完整结果缺席并核原 staged 对象/回执与全部 checkpoint 后签 `calls=[]` 零提交来源 grant 时，原 source proof 中 `settled_reusable` 的 research/article 调用从原 Forensics checkpoint 按 exact effect/ref/hash 零提交返回原答案，Product 仍由第一入口运行，image Prompt 完整携带本轮读回的 article。旧 Provider conversation、DOM 与未结算半成品不转入新 attempt；`replay_exhausted` 仅指定调用可一次受控输入。

调用方向以 caller/dependent 指向 provider：

```text
App Shell / Local App Shell / Startup ----------------> Runtime
Runtime --task-result + V6 contracts------------------> Website ai-acceptance
Runtime ----------------------------------------------> GPT public facade
Runtime ----------------------------------------------> Forensics public port
Runtime ----------------------------------------------> Browser typed effect receipt
Runtime ----------------------------------------------> Runtime Log single writer
Runtime --plain identity + opaque execution-----------> Architecture-owned Mediator
```

Agent Route Capability Manifest 是 Runtime 对外发布的 provider surface，不是 Runtime 自身的 dependency edge；它保留在本施工图 contractRefs，Website consumer 必须在 Website 所属施工图声明 ai-acceptance → Runtime 的消费边。AGENT 不伪造远端 consumer dependency，也不把 provider 发布方向误写为本地调用方向。Manifest publisher 只能消费 Mediator 返回的纯数据 route snapshot，不得 import Product 源码或通过 re-export、callback、plugin object 绕回 Product runtime authority。
Runtime 不得反向依赖 App Shell、Local App Shell 或 Startup。Browser 私有 store 不进入 Runtime；若 Runtime 需要 Browser 事实，只能消费 local-browser-session 对外公开的 typed authority/receipt。架构基础法案是治理约束，不伪装成运行 dependency edge。

Website 已持久决定 `WAIT_NEW_ATTEMPT` 后，Runtime 先核本地机械 READY/Outbox 与 Website 结果候选；存在可恢复结果时只走原结果 terminal/admission 对账，不释放本地 stage。确证旧结果不可恢复时先封旧执行完成端口并保留本地旧 attempt 投影；只有 Website 新 grant 的同一 receipt/event/manifest 精确读回后才以单一 CAS 切当前 attempt。`WAIT_NEW_ATTEMPT` 本身不清旧 first fact/stage；Browser Target 清理独立遵守原 WAL/旧 Target 安全门。该业务决定不触发Chrome窗口恢复，也不得越过未决Browser WAL。Chrome完整退出的恢复只由Browser已鉴权Authority WebSocket真实transport terminal触发：App Shell构造的现役零窗口宿主能力经Local App Shell装配注入Browser supervisor，已有Chrome窗口时零动作，零窗口时只打开一个现役Workbench窗口。Runtime production目录不取得该callback、不读取窗口、不重试、不建立第二生命周期、manager、queue、timer或恢复链。

新 attempt 的 Browser mutation 必须先经过原 WAL 全历史和旧 Target 安全门。Runtime 不直接读私有 WAL；Browser 公开 typed facade 在任何 Product 页面准备前按稳定业务调用键枚举旧 effect，只有全历史可证零物理输入时允许普通当前 Prompt/hash 首次提交。已可能输入时先原 effect 零输入读回；有界耗尽、原答案不可得且旧 DISPATCHED 物理输入未决时，Browser 在唯一 FIFO/lane 对精确归属的危险旧 system Tab 物理关闭并读回 Chrome Target 缺席，或对无法精确归属的旧 Target 证明旧 handler/CDP 输入静止并持久 typed proof、旧 fence 失效；此前同 job 新 attempt 与兄弟 job 的新 Target 页面 mutation 都禁止。正常已确认且仍绑定的轮询 Tab 依唯一 FIFO/lane 与全局观察节拍交错，不要求关闭。之后也只有 Website 原 claim/event/receipt 持久签发的指定调用新 revision 风险授权，才能对新 effect 输入一次。旧 WAL 与候选保留，socket 断线、park 或 detach 本身不能代替物理缺席或旧输入静止的 typed 证明。

附件链只增补这一条已有公开 dependency edge 的生产调用：Runtime 在 Website material 下载、SHA-256 和 bytes 校验完成后，仅把 `{artifactRef, localPath, sha256, bytes}` 作为 task-owned 临时材料绑定到当前 job/attempt/execution，并在同一 binding 上提供只能为该 artifact 建立/清理 Provider 上传别名的 Runtime-owned 窄化 materializer。GPT 仍是 `providerDisplayName` 算法的唯一语义 Owner；Browser 只机械验证其为安全 NFC basename，再调用该 materializer。Runtime 只在原 task-owned 材料目录以 hardlink 建立精确 basename 别名，不改变原 bytes/hash；同名已存在时只在与原材料同 inode、hash、bytes 时幂等复用，hardlink 不可用或任一身份不等均 typed fail-close，禁止 copy fallback。Browser 继续使用现有唯一 resolver 重验 exact basename、realpath、regular-file、hash 和 bytes 后签发 execution-scoped grant；settle/abort 由 Browser release 触发 Runtime 清理别名，过程不新增目录、表、registry、resolver 或 store。Product 只可在当前进程内单次 dispatch 的既有 `LocalProductionMaterial` 中读取本 Product 材料的 task-owned `local_path`，用于 Product 自有解析，不得拥有其生命周期、持久化/记录路径或把路径传入 GPT/Browser；GPT 永不获得 `localPath`，Product 也不得调用 Browser 附件绑定。同 attempt 已有唯一 verified `CONFIRMED` attach 时只读对账，不再 materialize 或上传。进程重启后 Browser 映射为空，由 Runtime 从 Website durable truth 重建；禁止 Browser 私有复制、持久 registry、第二 resolver/store、兼容桥或 dual path。

内部唯一分层：

```text
credential + contract preflight
  -> store foundation + read-only storage inventory
  -> cloud session + claim
  -> durable accept + execution binding
  -> Product identity resolution + mediator single dispatch
  -> Product 经产品中性 Runtime 上传端口取得 typed artifact receipt
  -> Product 自有 parser/assembly 形成 data-only final output
  -> reconciliation + single Outbox
  -> Website receipt verification
  -> local terminal transition
```

同一 worker session 的 heartbeat 换代与 claim 必须由现有 `ProductionWorkerSession` 在一条 session-authority 串行边界内闭合。Runtime 从读取新鲜 attestation、冻结与其同代的 credential/receipt hash，到 Website 返回该 claim 的持久回执之前，不得让另一次 heartbeat 推进 token generation 或 latest attestation；定时 heartbeat 与即时 freshness refresh 必须共用该边界。`activeHeartbeat` 只能合并同一 heartbeat，不能代替 claim 临界区。出现 `ATTESTATION_STALE_OR_MISMATCHED` 必须失败关闭并保留原生 reason，禁止接受 previous attestation、延长 TTL、blind retry、fallback、dual-read 或第二 session controller。

Runtime 自身代码保持 production 目录内的直接模块关系。不得新增 manager、facade、adapter、workflow engine、scheduler、recovery graph、第二 store 或通用 helper 层；拆分只允许把独立且有真实消费者的同一 Runtime 职责移到窄模块。credential、session、grant、fence、业务准入与 durable authorization 在进入 Mediator 前已由 Runtime 闭合；Mediator 只做 Product identity resolution 与完成本次 Owner 归位不可分割的单次 dispatch，不准备 transport、不保存业务恢复状态、不调用 Product parser/assembly，也不建立第二 registry、第二 executor 或通用工作流。Runtime 把现有产品中性 GPT 工具、materials、completion 与 artifact upload 端口作为本次单次 dispatch 的 context 传入；Product 在该调用内取得 typed receipt、完成自身解析和组装，再只把 data-only final output 交回 Runtime。任何 Product 专属类型、reason、Prompt 或 reconstruction 不得进入 startup、credential、schema、inventory 与 Runtime quality；GPT 不保存跨业务任务的 conversation、checkpoint、frontier 或其它 opaque state。

## 3. 鉴权与启动硬闸门

唯一启动顺序：

```text
本仓 active dependency schema/version
  -> SQLite WAL + exact schema/index/FK/data invariants
  -> task directory read-only inventory
  -> credential parent + file lstat
  -> owner-only permissions
  -> JSON parse + schema
  -> production origin
  -> Website session open exact control_contract_version equality
  -> claim eligibility
```

任一步失败都不得继续 session、claim 或 Provider mutation。credential 不存在、父目录权限错误、文件权限错误、符号链接、JSON 损坏、schema 不完整、origin 非法和 control contract version 不相等分别输出稳定 typed code；健康与诊断只显示 code、唯一 responsible domain、影响与恢复动作，不显示 token、credential JSON、路径内容或原生解析正文。

授权 enrollment 只建立或恢复长期 device identity 与 credential，不签发整份 manifest hash，不因合同升级重建 device。Runtime 只从本仓唯一 active consumer dependency 读取 `control_contract_version`，在 session open 时发送；Website 必须与自身当前 provider contract version 精确比较，并在 session、claim grant 与 execution fence 返回同一版本。版本不相等只产生 typed 409 并保持 Execution blocked；现役 Shell 可有限重试同一 session open 以等待 Website 恢复，但重试不得产生 claim、Provider 输入、fallback、第二 reader、自动 enrollment 或旧凭据回退。

同版本 AGENT 关闭或崩溃时若原 `production_outbox` 仍有未结清的 `provider_cooldown` 事故（包括已送达 incident 但尚无 `confirmed_absent` clearance），其不可变 body 中的 `worker_instance_id + session_open_request_id + worker_session_id/epoch + lease/fence` 是原事故事实；正常 shutdown 不得先 close 原 Website session。新进程只在原 device/build/contract 和 Website 原 session 均未被新 epoch 取代时，按同一个 open request 取得刷新后的短期 credential，承接 Website 返回的 `attestation_seq` 后先 fresh heartbeat；Website 在 device 行锁内复核该请求鉴权时的 token generation，拒绝轮换前已鉴权但轮换后才进入事务的旧 heartbeat；迟到 session close 也必须在同锁序复核当前 token generation，不得关闭已续用的原 session。heartbeat 提交结果不明或本地 seq 已 stale 时，AGENT 以原 open request 精确重同步原 session/seq/token 后自动发下一次 heartbeat，不永久重发旧 seq。每轮先按本地 Outbox 插入顺序交付所有已有冷却 intent，并确认原回执，再进入 Browser 恢复形成下一条 clearance；旧 `not_cleared` 发送失败时不得先发送新的 `confirmed_absent`。结清原事故后才尝试 claim。Website 的非终结 lease release/过期只清 token/expiry 撤销动作权，保留原 session/fence 作为迟到事故与已接受 cohort 的精确身份；来源交接只在 lease token/expiry 已清且旧 fence 被证明不可执行时才可覆写它，不能把非空历史 fence 误当活动动作权；任何旧 Browser/Provider/结果 mutation 仍需当前 lease/fence。closed、superseded、跨 build 或跨合同身份不得用这个同 session 恢复入口复活。RELEASE 前须精确盘点全部旧版本未结清的冷却 lineage（未送 intent，以及已送 incident/`not_cleared` 但无已送 `confirmed_absent` 的原 session/receipt）；本机已证的 3 条未送 intent 只是其中实例。逐条按原版本和原身份结清或经单独受控裁决，不能把 v43 READY 冒充生产已恢复。

## 4. 跨仓合同与业务完成

Website ai-acceptance 是唯一 provider。AGENT 三份 spec 的现役身份为：

- Agent Route Capability Manifest provider：version 4；只发布 current session 支持的 `product_id + action_id + task_contract_version + result_contract_version`；Product Profile、Skill、Prompt、Flow、实现名称、版本和 hash 均不得对外发布或参与任务身份；
- Website Agent Task Result consumer dependency：version 14；generated image 只接收 Product 格式化后的无 metadata WebP、绑定 hash/bytes 与实际解码整数宽高，不设固定尺寸、范围、长宽比或总像素门禁，V6 uploaded receipt 不扩展 width/height；文章翻译 primary route 仍以 provider_continuation 携带 Website 已验证的 direct-parent triple；固定catalog所有locale任务均fresh且parent triple全空，Provider URL仍不跨仓；Website逐字段机械接纳并将合格译文立即作为本地在用版本，失败ID单独补译；旧v13结果合同不兼容读取。
- Xuanxue AI Production V6 consumer dependency：version 43。保留 v39 的 `same_accepted_attempt` grant 语义，永久停止只消费 Website exact job absence，包含管理员未完成 Work Order 清除与获授权的隐私未完成质量反思清除。false 是 fresh attempt，true 必须同时命中 AGENT 本地同 attempt durable authority，否则在 Product 与任何 Website 写入前失败关闭。v43 切换须逐 job 在原 Website 行锁保全旧 accepted attempt、first fact、结果/Outbox/Browser 来源 manifest 与旧 session/fence，禁止把未完成 attempt 当清空条件；旧 session supersede 后，其旧 claim receipt 失去动作授权，新 session 只经 v43 同一 claim 的已鉴权 `source_evidence[]` 对账并取得原 attempt 的当前 lease/fence 或旧结果交付授权。旧 session/receipt 只作历史证据，不提供旧版兼容写入或第二撤权路径。Website 的`ai_production_devices.max_in_flight`仍是当前N的唯一持久Owner并唯一持有限流cohort；Runtime不保存或配置当前N/权威cohort。心跳只报告去重本地在途数，claim请求只按合同安全上限、本地in-flight和executor可用量提出，Website在设备事实行锁内收紧最终grant。Browser action capacity始终为1；Runtime只消费Website当前授权、有限`retry_not_before`、三个next action、typed effect outcome、provider_cooldown receipt与admission receipt。 v43 grant 校验中 `result_revision>0` 可由真实领域 `prior_result_rejection` 或同一 Website claim/event 的 exact `delivery_priority_replay_grant` 支撑；当前 grant 来源互斥：真实领域 rejection 对应 `prior_result_rejection`，风险 replay 对应 exact 风险 grant 且 `prior_result_rejection=null`；旧 rejection 只留原 Website job events，不下发为本轮 Product 修正指令。Product 风险 revision 从原入口执行；已完成的旧调用只按来源 seal 复用原 submit/checkpoint 产物，新的 revision promptHash 可变化，耗尽调用才用当前 prompt 与风险 grant fresh 输入；Website claim 与 provider cooldown notice 复用同一原 job revision reader。
- v43 风险 revision 的 target-local 恢复：既有 `delivery_priority_replay_grant` 精确绑定当前 attempt，若其 Provider 输入仍为零而页面准备失败，Website 继续重授同一 attempt/原 grant；Browser 先证旧 Target 已物理缺席或旧 handler/CDP 静止并结算，再以新 fence/Target 重做 target-local 准备。旧风险来源的全部 effect 仍按原 source seal 与 readback proof 核对；Provider 一旦有本轮输入则只按同 effect 零提交读回。此分支不签新 attempt、不复制 grant、不增加事件或恢复状态。
- v43 跨 revision 接力：`browser_input_state=zero` 只描述当前 `source_attempt_id` 的 Provider 输入；Browser 全历史仍须核验，旧 revision 的可能输入必须已由 Website 精确 rejection receipt 或原已签风险授权事件及签出当前 attempt 的 source handoff/event 逐 effect 结算。旧 effect 不因当前 attempt 的 target-local 失败重新进入本轮读回或重提集合。Website 验当前 accepted attempt、前次签发事件、旧 fence 与原结果/Outbox 缺席，才可签同 revision 新 attempt。每个历史 effect 的观察绑定其形成时不再漂移的 effect-set 前缀 hash；本次逐调用 proof 另绑定包含当前全体旧 effect 的集合 hash，新增 revision 不得使旧观察失效。
- v43 的 `source_evidence[].readback_proofs` 是新 claim 合同的必填逐旧 effect 证明，Website 已拒绝整个旧结果的分支允许 `attempt_handoff + possible`：恰有一条 rejected call 以原 first fact 与 Website rejection receipt 精确绑定，其余旧调用逐项已结算，旧 Target、WAL、Outbox 均须核清。风险重放仍由逐调用耗尽证明与 Website 独立 grant 授权。v42 旧 session、旧 claim receipt 不授权 v43 动作；切换先停止旧动作，再由 Website v43 与 AGENT v43 原 job 重新对账并开新 session，不删除 accepted attempt、WAL 或 Outbox。
- 连续 revision 的同一 rejected call 可同时含更早的已结算 effect：`source_evidence.rejected_call` 精确指出本次 first failure/Website rejection 对应调用及当前完整 effect-set hash；该调用的 readback proof 只覆盖旧 effect，本次被拒 effect 由原 failure/receipt 核，Browser 必须证明该调用除此之外没有遗漏的可能输入。旧 effect 可以由原 Website 精确 rejection receipt 结算，也可以由此前已签 `delivery_priority_replay_authorized_v6` event 的原 source seal、指定调用 grant hash 与逐 effect 耗尽证明结算；后者不冒充本次 rejection 或当前风险重提。旧风险授权结算不因观察证明超过 24 小时而失效，Website 须读回原已签事件，Browser 仍核完整 WAL/调用集合；普通未结算旧 effect 仍须当前逐 effect 证明。
- 调用级 `historical_settled` 只汇总 effect 级 `rejection_settled` 与 `risk_authorized`，既不复用旧答案，也不进入本次风险 grant；`settled_reusable` 只由未拒绝 checkpoint 决定，`replay_exhausted` 只由本次未结算 effect 的适用路径耗尽决定。所有调用仍留在完整 replay_calls 与历史 hash 中。
- 已持久接纳的旧 source handoff 只作为不可变历史证据解释：若旧 `attempt_handoff+possible` 缺 `rejected_call`，仅在原 seal/first fact 正确、恰一条 replay call 且原 readback proof 为空时，从原 first failure 的 effect/ref/hash、Browser 同 effect 的原前缀集合 hash 精确导出该调用；Website 还须沿当前 attempt 祖先核原 handoff event、原 failure ledger 与 exact rejection receipt。新 v43 source evidence 永远必填 `rejected_call`，旧记录不得作为旧协议 claim/写入授权。

consumer dependency 的 contract body 只能包含 contractId、version、providerRepo。普通启动只校验本仓最小 dependency，不读取未绑定 Website 工作树；跨仓 participant commit 只属于 RELEASE 证据。

唯一 route projection generator 必须机械得到并逐项校验：

- 40 routes；
- 48 parameter types；
- 33 result contracts；
- 0 条 reservation route；
- 每条 route 的 parameters、materials、relations、result_contract 与 Website provider 语义完全一致。

未知、缺失、额外、重复、顺序漂移或语义不等一律失败关闭。新增的唯一固定 catalog route 是 `localization_static_catalog + produce_locale_catalog`，仍由现有 `localization-production` Product Plugin 私有执行，不新增 Plugin、Runtime、队列、公开 candidate/selector action 或第二恢复链。不得手写 route allowlist、第二支持表、compatibility、alias、fallback、bridge 或 shadow projection。

`FROZEN-PUBLIC-KNOWLEDGE-PROVIDER-FORMAT-ONLY-001` 固定：Public Knowledge 的 Provider 可见输出格式只来自 Website 唯一 canonical `result_contract` 的机械投影，Product 只把当前 research/article 子合同原样写进 exact Prompt。research 顶层只要求 `schema_version,decision,topic_manifest,research_markdown,citations,research_claim_units` 六字段，article 顶层只要求 `schema_version,title,editor_note,article_markdown,safety_notes` 五字段；Provider 多余字段由 Website 唯一 parser 丢弃，不得拒收。该合同只约束交付结构、字段类型、枚举、引用 identity/marker 关系与 Markdown 语法，不得规定选题结论、分析方法、推理过程、观点立场、证据解释或图片创意；Product Skill 正文不得注入 Provider Prompt，AGENT 不得复制、扩写或另建格式/质量 validator，不得重塑 Provider 输出字段类型或追加第二 reception sidecar。改变或删除本冻结边界，必须由用户在未来任务中明确解冻并同步替换双仓施工图、合同、实现与唯一质检。

Website 在签发任务前唯一判断业务参数值是否合法。Runtime 先把 product_id/action_id 解析为有界字符串，再按 current route projection 与 Route Capability Manifest 精确解析；grant 不再冻结或比较任何 Product Plugin 身份。除此之外 Runtime 只校验 authenticated session/claim/grant/fence、task wire/schema/hash、当前 contract/projection/control contract version，以及 route/key/material/relation/result-contract 与当前 projection 的机械一致性；不得保存 `bazi_analysis_kind`、locale、localization resource kind、Product package/version 或 Bazi reusable candidate 的业务白名单，不得按 action 名推导 review/continuation，不得维护 `routeProducesGeneratedImage`、手写 Product/Action 支持表或硬编码 primary 数量。Product Plugin 通过 Product-facing execution contract 取得当前 task、materials、当前 Website route policy 与 GPT public facade，只校验完成自身执行所必需的局部 artifact、Skill 与 result 组装前置，不复判 Website 业务资格，也不读取 Runtime 私有 transport、store、lease、Outbox 或 recovery 模块。

本地化 task 不再跨仓携带 `resource_kind`；`localization_report_translation + report_translation` 与 `localization_article_translation + article_translation` 已是唯一业务类型身份。Website 内部领域 `resource_kind` 继续由 Website 自己消费，不投影给 AGENT，也不建立 alias、映射或兼容字段。

动态本地化 primary route 的 Provider payload 只使用 `terminal-localization-model-output.v2` 一份输出 schema，并只包含 `schema_version + source_resource_id + source_version + source_sha256 + target_locale + localized_structured_payload`。route 的 `product_id + action_id` 已由 task/result envelope 唯一携带，payload 禁止重复 `action_id`；Website `result_contract` 只以 `contract_version=3 + output_schema_version=terminal-localization-model-output.v2` 公开该格式，Product 原样写入 Prompt，AGENT 只机械核公开 schema 与 locked source/locale，Website staging 不复制本地化领域裁决，最终语义校验与 admission receipt 仍只属于 Website localization Domain Consumer。不保留 v1/v2 双读、fallback、compatibility、alias 或第二 parser。

Website business admission receipt 只有三种互斥结构：

```text
base:
  schema_version + job_id + result_payload_hash
  + consumer_ref + outcome + consumption_hash + consumed_at

Bazi primary:
  base + bazi_domain_admission_receipt_hash
  + delivery_manifest_id + delivery_manifest_hash

review:
  base + review_receipt_hash
```

Bazi 三字段必须全有或全无；Bazi 与 review 不得混合；额外字段不允许。Runtime 使用完整结构重算 canonical consumption hash，只验证 schema、identity、结构与 hash，不解释领域内容。staged result、Outbox delivered、terminal receipt 都不是完成；只有当前 job_id + result_hash 的 Website domain admission receipt 闭合后，本地任务才原子 completed。Website 领域接纳时将原 staged artifacts 原位转为 admitted，device-status 的 staged_artifact_receipts 此后可以为空；Runtime 已验证同 job/result hash 的 admission receipt 时不得再以待暂存附件数量否决接纳读回，未接纳且仍有 staged result 时才要求当前 attempt 的必要附件回执。

## 5. 工单、Provider effect 与唯一恢复决策

Website 永久保存同一 `job_id + request_hash + 冻结业务 task`。公开状态只有 `failed` 和 `completed`；未入库且未撤权时 `demand_active=true`。

一次 accepted attempt 只执行 Website 当前授权的精确 effect/result：

```text
Website 签发 attempt + lease + fence
-> Runtime durable accept
-> Product 从第一入口执行
-> Browser 对同一 provider_effect_identity 跨 attempt/进程最多 physical dispatch 一次
-> AGENT 得到完整结果或 typed failure
-> 完整结果只形成一个 payload identity，并经唯一 Outbox 幂等交付
-> Website 领域事务入库并签发 admission receipt，才 completed
```

执行失败后 Runtime 只报告 typed outcome 与可核的原 Owner 证据，Website 唯一裁决：存在机械有效结果则继续原身份交付；无结果且全历史零输入则同 job 新 attempt；已可能输入则旧 effect 零 submit 读回；原答案有界核验不可得且旧 Target 可证物理缺席或旧 handler/CDP 输入可证静止后才签指定调用的新 revision 风险授权。坏/缺/矛盾 failure fact 不再终止需求，当前危险动作失败关闭且有限再检查。Website 明确拒绝结果时仍按唯一 rejection receipt 签新 revision。

Browser provider effect identity 不含 Product Plugin 或 `attempt_id`，固定由 `job_id + result_revision + product_step_id + call_id + child_id + request_hash + payload_hash` 组成。AGENT 内部实现、attempt、进程、lease、fence、Target、Document 变化不得制造新 effect；同一 identity 的 physical dispatch 总数至多一。每次 mutation 与 Website 写请求仍校验当前 fence，旧 fence 的 Provider、结果及其他业务 mutation 迟到写请求全部拒绝；原 `provider_cooldown` 事故通知只按原身份交付事实，不恢复旧执行权。

`FROZEN-EXACT-TARGET-POLL-RESULT-REVISION-001` 已按本次授权精准解冻替换并重新冻结：Runtime只有在 Browser Authority为 PRESENT时才提出不超过合同安全上限、本地可用 executor与去重在途余量的有界 claim，Website才按当前设备 N签发新 grant。每个获 grant且需要 GPT的 job由 Browser懒建一个独占 system Target；submit后正常轮询保留绑定，第一次及后续observation前都释放唯一Browser lease/lane并立即进入唯一FIFO；GPT Child只计算至少70秒的最早资格，剩余deadline不足70秒时不重新acquisition，BrowserLaneCoordinator作为唯一计时Owner在每次真实observation终结时只抽取一次70—90秒全局间隔；随机值不按job、Tab、Product或Child生成和保存，真实相邻Provider observation至少70秒且总频率不随N增长。具备资格后只激活该 job精确绑定 Tab、重验 current Document并 fresh observe一次，正常轮询 Page.navigate=0。停止按钮存在时Runtime只运输pending；只有同一位点停止按钮连续消失且回答连续为空满20分钟时才运输 `GPT_RESPONSE_STOPPED_EMPTY` 及其Provider observation fact，任一次停止按钮出现、回答非空或身份失真均归零。只有进程重启、绑定 Target真正丢失或同等恢复现场，才先查同一 WAL effect，再以 `confirmed-readback`为该 job取得精确 system Target；不得回 GPT首页，只按 WAL canonical URL零次或最多一次精确导航并 fresh readback。唯一 Browser WAL的 `logical_mutation_id`仍直接作为公开 `provider_effect_identity_hash`，Runtime只运输 typed fact且不得读取 Browser私有 SQLite。Website只沿一条现役拒绝链处理两类事实：稳定不可用结果绑定独立settled result hash；停思考空回答绑定独立Provider observation fact hash。每个hash-bound事实只写一个rejection receipt并签发一个新revision，其他现实输入默认在同一accepted attempt零submit收敛；原答案有界不可得且旧 Target 可证物理缺席或旧 handler/CDP 输入可证静止后，仅Website持久风险grant的新revision/指定调用可一次受控风险输入。不得增加第二 WAL、queue、store、Owner、状态机、兼容桥或 fallback。

lease release 只使用一个由 `job_id + attempt_id + lease_version + payload_hash` 确定性生成的 `request_id`；不得再复制 `idempotency_key`。同一 attempt 的同 effect readback 失败只允许 Website 记录首条失败事实，后续 release 只验证相同 `provider_effect_identity_hash` 并释放当前 lease，不以新的墙钟时间制造第二失败身份。

AGENT 不建立通用 checkpoint、跨任务 Provider session state 或第二恢复状态机。Browser 唯一 WAL 的同一 provider-effect 行只提供 at-most-once 与同-effect confirmed readback 所需加密 locator；Runtime 唯一 Outbox 只幂等交付同一 result。Website 以自身 staging、领域入库与 admission receipt 为准，已完整 staging 的结果继续由 Domain Consumer 入库，不回退 AGENT。

`FROZEN-WORK-ORDER-UNFINISHED-PURGE-001` 已按本次明确授权精确解冻、替换并重新冻结：管理员清除只撤销 exact Work Order 中没有有效 Website 领域 admission receipt 的未完成 job。唯一删除请求只携确认时的 `completed_count + unfinished_count`；Website 在现役锁序内、任何写入或对象删除前按 receipt 四元组重算，任一漂移稳定返回 409 且删除增量为零。计数一致时，Website 先暂停 Work Order，保留全部完成闭包并物理删除未完成 job/run 及其独占记录和私有对象；有效完成量为零时同事务物理删除空 Work Order 根，有效完成量大于零时只保留 paused Work Order 根与完成闭包。明确回复的回执必须匹配确认计数；回复不明时，只能由匹配确认计数的 exact Website 终态读回自行闭合，禁止因回执丢失而重发。AGENT 对自身已接受 job 的 Website absence 仍只按 exact job_id 清除本地 task、Outbox、材料、结果、Browser WAL 与 Forensics artifact，停止该 job 的轮询、交付和外部结果复用，不得影响其它 job。已真实发送到 Provider 的消息及 Provider 自有日志、备份不在本系统可保证删除范围。未来改变仍须授权人明确解冻并同步替换双仓法案、施工图、合同、实现与唯一质检；AGENT 现役法案无需修改，因为其 exact Website-absence 清算职责保持不变。

付款、发布、删除、发货与正式业务记录修改不得放在可废弃 attempt 内；它们只在 Website 最终领域事务中按 `job_id` 幂等执行。禁止 recovery manager、planner、workflow、recovery queue、fallback、compatibility、legacy、bridge、shadow、第二 scheduler/store/state machine。

stopped-empty 的 lease-release typed fact 必须同时绑定 confirmed submit 的顶层 `evidence_ref/evidence_hash`、完整 Child proof 的独立 `child_proof_ref/child_proof_hash`，以及首次/终态 observation 时间、连续单调毫秒、observation 次数、位点 identity hash 与终态 observation revision hash；Website 在任一字段缺失、连续值少于 1,200,000ms、次数少于 2 或 Child 不是 `submit_exact_gpt_turn_once` 时失败关闭，不签发新 revision。终态 observation revision hash 只来自 stopped-empty proof，不得覆盖或冒充 submit evidence。

## 6. SQLite 与 task-owned storage

Runtime 唯一数据库只保留三表：

- production_tasks；
- production_outbox；
- production_attempt_handoffs，仅保全原 attempt 来源 seal、已签发 attempt 身份与逐旧 effect 的真实读回证明；Website 仍是唯一恢复裁决 Owner。

`production_tasks` 不保存 Product Plugin 名称、版本、Skill hash、Catalog hash、checkpoint schema 或执行位置；业务请求身份直接来自其 Website task 中的 job_id、product_id、action_id、task/result contract 与 request_hash。Browser WAL 只保存物理 mutation terminal、result_revision 与同一 effect 的加密 canonical conversation URL，且 plugin 字段数为零。Runtime、GPT 与 Browser 均不保存跨任务 consultation identity、source task、checkpoint、frontier 或 Provider conversation；Website 父子关系和已入库父报告只通过本轮业务 task/material 传入。

首次安装只有在零张 production_* 表时才可建立当前三表 schema 并设置 WAL。已有任一表后，普通构造与启动只读验证精确表、列、主键、唯一索引、外键、WAL、integrity_check、foreign_key_check 与数据不变量；旧表或缺表返回 migration-required，不在普通启动补表、重建或迁移。`production_leases` 与任何 Website lease/fence 镜像必须物理不存在；Runtime 只消费当前 Website grant/renew，并以进程内单调预算停止过期执行。Runtime 不保留普通启动迁移入口；Browser WAL 只做自身现役 schema 的单向扩展且不保留旧新双读写。数据库缺失、不可读、损坏、查询异常、记录缺失与 hash mismatch 必须分别保留。

普通启动对 Runtime DB、Outbox 和 task-owned plugin directory 做唯一 read-only inventory。输出稳定的目录总数、owned 数、orphan 数与 orphan bytes；读取失败、结构多义或 orphan 存在时阻断新 claim，但不复制 Website lease/fence，不自动移动、修复或删除，不建立目录台账、隐藏 tombstone、第二索引、第二表、maintenance worker 或删除协议。

普通启动不得模糊清理。Runtime 只在自己已经 durable accept 的 exact job 后续被 Website 权威读回为不存在时，取得该 job 的唯一删除授权；必须按 job_id 同步清除本地 task、Outbox、task-owned 目录、Browser WAL 与 Forensics artifact，并逐项证明目标缺席、其它 job 保持不变。仅旧 Forensics 字节先写而索引未落盘留下的无主 `.bin`，由原 Forensics Owner 在这次已授权清算中比对完整共享索引后同步删除并读回缺席；有索引的所有兄弟 artifact 保持不变，普通启动仍只读。不得保留永久撤销状态、删除队列、删除台账、归档或兼容路径。

## 7. 质量系统与发布边界

agent-production-runtime 只有全仓原生 quality:check 中的一份 Manifest、一套现役 inspector/acceptance、一条 Runtime proof route 和一个最终 verdict。Manifest 的 `ownedPaths` 只登记 Runtime 自身的 Manifest primary ownership；Product、GPT、Browser、Website、Runtime Log、App Shell、Startup 与历史项目方案不得由 Runtime primary-own，只能在确有接口消费时以精确 `observedPaths` 观察。

某一候选只有另获 AGENT 内相邻域原子归位明确授权后才可施工，且文字授权不等于已完成。法案、Inspector、测试、proof 与混合文件必须先在同一未提交 CHANGE 候选中准备完成；所有接收域与 Runtime 的 `ownedPaths` 在此期间保持原值。文件拆分完成后只允许一次原子修改：architecture-boundary 在已拥有的 Mediator/Product 边界内接收 `src/mediator/product-plugin-catalog.ts` 与 `src/mediator/product-plugin-contract.ts`，保留已归位的 `src/mediator/agent-production-route.ts`；agent-production-runtime 同时物理删除旧 Product-facing `plugin.ts` 和全部旧 import 边，而不是删除真实消费者。旧文件内容只按以下唯一映射归位：Product 类型、执行 context、产品中性 checkpoint/fault receipt 与结果校验 primitives 进入 `product-plugin-contract.ts`；12 个 Product 的唯一 composition、Skill 读取/hash、route identity 与单次 dispatch 进入 `product-plugin-catalog.ts`；artifact upload、Outbox、transport receipt 与 envelope 继续留在 Runtime；业务 parser/assembly 继续留在各 Product。现役 provider spec 已绑定的 `catalog.ts#agentPluginCapabilityManifest` 原位删除旧 Product imports、Plugin object、Skill text 与 route registry，只保留 Runtime 自有的 product-opaque Manifest publisher。不得再建立第三个 common/helper/adapter 层。其它相邻域只有在当前候选真实涉及其 Owner 路径时才参与。随后立即重建唯一 registry 并证明 `UNOWNED_PRODUCTION_FILE=0`、`MULTIPLE_PRIMARY_OWNERS=0` 与 Runtime manifest-owner-drift=0。不得先接收、先删除、建立临时第二 Manifest、兼容 re-export 或形成中间 READY/RELEASE 候选。

静态证据必须来自 Manifest Owner、AST、JSON、resolved import、实际 symbol consumer、合同或状态机结果；路径名、字符串包含、文件存在、fixture 数量、历史 report、self-check 或另一个裁决不得产生 PASS。检查器必须拒绝任一 Runtime-owned source 对 `src/plugins/**` 的 direct/re-export/dynamic/side-effect import、任一 Product source 对 Runtime 私有模块的反向 import，以及通过旧 Catalog、alias 或中转模块形成的同义边；不得再为 `src/lib/local-runtime/**` 或旧 Catalog 设置豁免。Runtime acceptance 不运行完整 Product Flow，不启动 GPT/Browser 业务动作，不裁决内容，不要求 40 个 Website job 全量入库。现有 Product/Runtime acceptance 必须用确定性 stub 证明 generated-image 的同一 artifact intent 只上传一次、Product 只在取得真实 typed receipt 后组装并执行 final parse、Runtime 收到的 final output 不含 `assemblePayload`、`parseResult` 或 Plugin object。现有 Architecture/Runtime acceptance 还必须从唯一 architecture Catalog snapshot 机械逐字段投影并证明 provider v4 Route Capability Manifest 的 schema、product/action route、task/result contract version 与 canonical route hash 精确一致，并证明跨仓及持久身份中的 Product Plugin 名称、版本与 Skill hash 为零。`architecture-boundary` 的 Exam 只能从 architecture-owned 唯一 Catalog、Runtime 发布的 Route Capability Manifest 与 `scripts/acceptance/product-plugins/**` 发现 route、证明一一对应、执行并汇总各 Product 自有测试；中央入口不得手写 Product Plugin 或 primary product/action 列表，不得保存任一 Product 的 Prompt、Child 顺序、checkpoint、分支、恢复规则或 expected result body，生产 `src/plugins/**` 不得 import 测试代码。

Runtime 唯一 dynamic proof 只声明：

- dynamic.service；
- dynamic.database；
- dynamic.storage；
- dynamic.authorization。

Runtime proof 不输出相邻 lawId assertion，不复制相邻能力权威的证明正文。GPT、local-browser-session、runtime-log-spine 与 agent-production-runtime 必须分别由原生 proof 独立启动、只声明自身 lawId、只读取自身持久真相或相邻域正式 typed receipt；不得读取另一 proof 的 assertion，不得要求共享 Website job、Chrome journey 或时间线，也不得建立 journey coordinator、proof bus、共享 scenario、共享 assertion map、适配层或第二 proof。动态路由未全部归位前 Runtime RELEASE 必须失败关闭。

CHANGE、READY、RELEASE 是不同候选阶段。Runtime 的静态或动态 PASS 不等于 Product/GPT/Browser 已生产接纳、Website 已完成业务入库、全系统 READY、RELEASE 或 SYSTEM_PROVEN。

## 8. 可重复验收不变量

每次候选都必须重新证明：

1. 八条 Runtime law、稳定 blueprintId、三份 active contractRef 与 Runtime 唯一 Manifest 的 lawIds 相互一致；Architecture Boundary law 与 Manifest 独立保持其现役一一对应；越界 `ownedPaths` 只在同一候选的一次原子修改中归位，并立即证明无无主、无重叠、无 Runtime manifest-owner-drift。
2. Website task-result v14、V6 v43 与 AGENT dependency 精确一致；generated image 保留原始 Provider bytes 作 task-owned evidence，交付的 WebP 只做方向应用与 metadata 剥离，无几何转换或尺寸门禁；grant 不携带 Provider locator/checkpoint 或 Product Plugin 身份，只绑定当前 task/attempt/lease/fence；attempt failure 必须同时运输 Browser 已持有的 `provider_effect_identity_hash + effect_scope + browser_outcome + mutation_outcome + lease_version + submit receipt/evidence` 与 stopped-empty 独立 observation proof。`provider_cooldown`只运输固定事故/ack hash与Website receipt，不运输DOM/URL/N。`RESULT_SETTLED_UNUSABLE + CONFIRMED + confirmed + effect hash + evidence + settled result hash` 只允许 Website 拒绝该结果并签发新 result revision；`GPT_RESPONSE_STOPPED_EMPTY` 只使用独立 observation proof 的终态 revision hash形成新拒绝事实，不覆盖提交回执。其它 provider_effect+DISPATCHED/CONFIRMED 默认按同 accepted attempt 零提交读回；原答案有界不可得且旧 Target 可证物理缺席或旧 handler/CDP 输入可证静止后，仅 Website 持久风险 grant 的新 revision/指定调用可一次受控风险输入。八字仅携带 consultation_root_ref 与 direct parent；文章翻译五个locale都携带Website签发的provider_continuation direct parent且链首指向zh-CN生成任务；固定catalog所有locale/cohort任务均fresh且parent triple全空；明确新result revision才可携带hash-bound rejection，其可选 `validation_failure` 只被 strict 机械接收并原样运输。
3. route projection 精确为 40 routes、48 parameter types、33 result contracts、0 reservation routes；bazi_private_base_input 与 result_contract.private_base 为零。
4. base、Bazi primary、review admission receipt 的互斥字段与完整 canonical hash 全部闭合，未闭合时本地 completed 增量为零。
5. credential 失败类别分别得到稳定脱敏 typed code，且 claim/Provider mutation 增量为零。
6. Runtime-owned source 对 Product Plugin 的 direct/re-export/dynamic/side-effect import 为零；Product source 对 Runtime 私有 production module 的 import 为零；唯一 architecture-owned Catalog 与 Runtime Manifest publisher 只以冻结纯数据 route snapshot 连接，provider v4 Route Capability Manifest 只含 product/action 与 task/result contract version，跨仓及持久身份的 Product Plugin 名称、版本、Skill hash 字段为零。
7. Runtime 三表、精确列/主键/唯一索引/外键、WAL、integrity_check、foreign_key_check 和数据不变量可重复读回；`production_leases`、`production_gpt_consultations`、旧 `production_continuations` 与任何 GPT continuation store 均不存在；Browser WAL 不含 consultation identity、source task、continuation checkpoint 或 frontier，只保留执行 fence、effect terminal 与同-effect加密 locator；private base、reservation、fork、第二 lane/store 与 Product checkpoint 消费者为零；Runtime 普通启动迁移与删除增量为零。
8. authority 数据库缺失、不可读、损坏/查询异常、记录缺失、hash mismatch 分别可观察并失败关闭。
9. storage inventory 在未变数据上重复得到同一目录/字节分母；dry-run 写入、移动与删除增量为零。
10. Website Work Order 管理员清除必须先保护领域 admission receipt 精确闭合的完成成果，物理清除全部未完成子图；完成量为零时 Work Order 根同事务缺席，完成量大于零时只保留 paused Work Order 与完成闭包。AGENT 对已接受 job 的 Website absence 必须清除本地 task/Outbox/material/result/Browser WAL/Forensics，并逐 target 证明缺席和其它 job 保持不变。
11. durable accept 后进程重启先核旧结果/候选，再由 Website 原 claim 裁决当前授权。全历史零物理输入且原结果不可恢复时可签普通新 attempt，新 attempt 按当前 Product 身份重建 fresh/profile/model/menu/附件/Composer 等 target-local 准备，批准附件集合允许为空。provider_effect+DISPATCHED/CONFIRMED 等已可能输入事实优先保留原 effect 且 submit 增量为零，在任何准备动作前按精确 WAL 事实进入只读结果收敛；有界耗尽、旧 Target 可证物理缺席或旧 handler/CDP 输入可证静止后，只有 Website 风险 grant 的新 revision/指定调用可一次可能重复输入。其它组合仅令当前危险 mutation 失败关闭并自动有界对账，不终止 demand。submit request hash 绑定当前 result revision 与 Child input hash；普通换 attempt 可使用当前 Prompt/hash，新风险 revision 由 Website 事件签发。
12. 当前完整结果只按 `job_id + attempt_id + result_hash` 经唯一 Outbox 幂等交付；回复不明先查询 Website staging、领域入库与 admission receipt，不重做 Provider，第二 Outbox 或 delivery flusher 为零。`FROZEN-SAME-ATTEMPT-RESULT-REDELIVERY-001`：Outbox 同一交付身份不含 execution fence，fence 只是当次发送授权；同一 accepted attempt 经 Website 续发 grant 后，同键同内容的未送达写入以当前 fence 重授权并清除上一 lease 记录的失败后发送，已送达写入只返回原回执，已被 Website 作废（`WEBSITE_ATTEMPT_REPLACED`）的写入不复活，同键内容不同仍 `PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT` 失败关闭；同一 lease 内已记录的失败不重放。本条冻结；改变、删除、弱化或绕过须授权人明确原文“解冻 FROZEN-SAME-ATTEMPT-RESULT-REDELIVERY-001”，并同步替换双仓施工图、实现与唯一质检。
13. 失败、失联、lease 失效、结果不明和领域拒绝均只产生 typed facts；Website 唯一选择未发送后的新 attempt、同 effect 只读收敛或明确拒绝后的新 result revision。旧 fence 的 renew、artifact、result、terminal、completion 全部被拒绝。
14. 单 task 损坏不污染其它 task，结构不合格或 orphan storage 阻断新 claim。
15. Runtime 生产文件遵守基础法案文件与函数预算，无 type-only Owner 环、Product object/callback 泄漏、Browser 私有 store import 或新增通用包装层。
16. Runtime Manifest 不取得相邻域或历史方案的 Manifest primary ownership；唯一一次原子归位不能产生无主或重叠 Manifest primary Owner；Runtime quality 只有一个 checker、proof route 与 verdict。
17. Runtime proof 只声明本域四种 dynamic mode；GPT、Browser、Runtime Log 的原生 proof 均可独立运行，Runtime 相邻 proof assertion 为零，任何未解耦 route 都阻断 RELEASE。
18. Runtime CHANGE/READY 不替 Website、Product、GPT、Browser 宣称业务完成；最终业务完成仍以 Website admission/storage 为准。
19. 各域现有唯一 inspector、acceptance 与适用 proof 分别覆盖本域 active law 的 summary、全部 forbidden 与全部 evidenceModes；Owner-bound import mutant 必须证明 Runtime→Plugin、Plugin→Runtime private 与旧 Catalog 豁免都会失败关闭，全部被替代路径的生产消费清零，不新增第二 checker、proof 或 verdict。
20. N=1..4下去重业务在途数不得超过 Website当前设备配置；每个 active execution或 admission pending job各占一个席位。Website admission receipt及领域对象已读回后先本地 completed 并释放业务席位，Browser Target 清理只作诊断且独立受 lane 安全门约束；Website 持久 WAIT_NEW_ATTEMPT 仅在旧 READY/Outbox/候选确证不可恢复、原证据交接完成后释放旧 attempt 席位；永久撤权或删除按原 Owner 精确清理。ACTIVE_ATTEMPT regrant不新增席位，CONSUME_CURRENT_RESULT继续占原席位，缩容不终止既有执行。任意时刻 Browser物理 lane与 active claim至多一个；每轮抽样计划值位于70—90秒，真实相邻Provider observation至少70秒且总频率不随N增长。八字另须证明 BZ05/BZ03/BZ04每个业务任务均 fresh且精确消费本轮Website父报告材料；同一SEO文章六个task按direct parent共享一个canonical conversation URL；固定catalog各locale/cohort及其失败ID补译任务均fresh，parent triple全空且不得共享父URL；每job仍独占Target、一次submit，错误parent或product step须在Provider输入前失败。continuation controller/store/frontier/CAS、fork与private base为零。

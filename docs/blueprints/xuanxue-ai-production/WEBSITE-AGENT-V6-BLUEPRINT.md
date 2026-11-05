# production-runtime 生产级施工图 V71

正常停止沿现役单链：App信号→Workbench停止接单→Runtime同步draining→原iteration与active任务收尾→原Store/网站status读回→原资源关闭。
停止意图约束新/恢复生产claim；下述W5仅允许已封存source运输，绝不abort在途Product；原claim在实际fetch前检查drain_state，停止前已经发送的合法grant仍由原worker执行。
结束对象是每张已领取Agent任务的独立成果步骤，完成资格仅引用 LAW-AGENT-PRODUCTION-RUNTIME-004-V1；不等待网站未领取后继任务。
真实失败核原first fact与同身份release receipt/attempt failure，业务需求及恢复记录保留；需要重新claim的恢复留给下一次原worker。
Browser未决、接收未确认成果、未结清冷却、关闭不明或资源失败只能异常收尾，禁止报告完整退出成功；冷却原Website session仍不得close。
不增加表、Outbox、恢复worker、派单合同或超时体系。Workbench等待迟到init/retry并保持资源引用，Browser和原HTTP关闭后才封producer。
原Runtime与Startup验收覆盖不abort任务、立即禁止物理claim、同身份失败、未决不改写、资源关闭顺序及重复close。
关闭的临时jobId分母仅由原active/未完成Store行及原已发送claim响应派生，原shutdown唯一读取；不持久化、不授权、不恢复。
领取后未落库不能因空Store算成功，须由现役网站status的精确absence证明删除，否则异常。claim发送前同步读原drain_state，不使用异步旧快照。
active结束后先由原接收对账函数核待确认结果，再通过原worker每轮结束通知等待有限次原cleanup/交付轮次（待清理及待接收确认的job并集数量，至少一轮）；停循环后的核验只读，不得新置cleanup。关闭日志使用原失败终态函数保留原cause、CONSEQUENTIAL及Owner，已确认任务失败引用原first fact与Store authority；不新建worker、timer或cleanup入口。
blocked实例在真实停机时由原Store关闭入口只读核未完成任务/Outbox/cleanup/冷却/Browser未决并非零；普通blocked换代关闭仍让原重试接续。迟到assembly和换代间隙携现役已abort stopSignal进入原startup，只组成原Store/blocked handle，在session门前停止，不建新读取/恢复入口。原claim fetch前预期未发送停止只正常封原准入周期span，不写未取得的Website claimDiagnostics，不制造Website失败根；真实Website回执的诊断完整保留。
原blocked retry的真实异常在停机阶段传给原shutdown等待者；session门前无工作早停正常封原启动span，不制造BLOCKING假根；真实依赖/凭据/session异常不豁免。

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "agent-production-runtime-v71",
  "status": "active",
  "owner": "agent-production-runtime",
  "lawIds": [
    "LAW-AGENT-PRODUCTION-RUNTIME-001-V1",
    "LAW-AGENT-PRODUCTION-RUNTIME-002-V1",
    "LAW-AGENT-PRODUCTION-RUNTIME-003-V1",
    "LAW-AGENT-PRODUCTION-RUNTIME-004-V1",
    "LAW-AGENT-PRODUCTION-RUNTIME-005-V1",
    "LAW-AGENT-PRODUCTION-RUNTIME-006-V1",
    "LAW-AGENT-PRODUCTION-RUNTIME-007-V1",
    "LAW-AGENT-PRODUCTION-RUNTIME-008-V1"
  ],
  "contractRefs": [
    "docs/specs/agent-production-runtime/agent-route-capability-manifest.provider.spec.json",
    "docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json",
    "docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json"
  ],
  "dependencyEdges": [
    {
      "contractRef": "docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json",
      "from": {
        "domain": "agent-production-runtime",
        "repo": "local"
      },
      "to": {
        "domain": "v6-transport",
        "repo": "ADVISION-X/AI-Paper-Factory"
      }
    },
    {
      "contractRef": "docs/specs/agent-production-runtime/xuanxue-ai-production-v6.dependency.spec.json",
      "from": {
        "domain": "agent-production-runtime",
        "repo": "local"
      },
      "to": {
        "domain": "v6-transport",
        "repo": "ADVISION-X/AI-Paper-Factory"
      }
    },
    {
      "contractRef": null,
      "from": {
        "domain": "agent-production-runtime",
        "repo": "local"
      },
      "to": {
        "domain": "architecture-boundary",
        "repo": "local"
      }
    },
    {
      "contractRef": null,
      "from": {
        "domain": "agent-production-runtime",
        "repo": "local"
      },
      "to": {
        "domain": "forensics-persistence-capability",
        "repo": "local"
      }
    },
    {
      "contractRef": null,
      "from": {
        "domain": "agent-production-runtime",
        "repo": "local"
      },
      "to": {
        "domain": "gpt",
        "repo": "local"
      }
    },
    {
      "contractRef": null,
      "from": {
        "domain": "agent-production-runtime",
        "repo": "local"
      },
      "to": {
        "domain": "local-browser-session",
        "repo": "local"
      }
    },
    {
      "contractRef": null,
      "from": {
        "domain": "agent-production-runtime",
        "repo": "local"
      },
      "to": {
        "domain": "runtime-log-spine",
        "repo": "local"
      }
    },
    {
      "contractRef": null,
      "from": {
        "domain": "agent-production-runtime",
        "repo": "local"
      },
      "to": {
        "domain": "system-security",
        "repo": "local"
      }
    },
    {
      "contractRef": null,
      "from": {
        "domain": "app-shell-ui",
        "repo": "local"
      },
      "to": {
        "domain": "agent-production-runtime",
        "repo": "local"
      }
    },
    {
      "contractRef": null,
      "from": {
        "domain": "local-app-shell",
        "repo": "local"
      },
      "to": {
        "domain": "agent-production-runtime",
        "repo": "local"
      }
    },
    {
      "contractRef": null,
      "from": {
        "domain": "startup-entrypoint",
        "repo": "local"
      },
      "to": {
        "domain": "agent-production-runtime",
        "repo": "local"
      }
    }
  ],
  "prohibitedDependencyEdges": [
    {
      "from": {
        "domain": "agent-production-runtime",
        "repo": "local"
      },
      "lawId": "LAW-AGENT-PRODUCTION-RUNTIME-001-V1",
      "to": {
        "domain": "app-shell-ui",
        "repo": "local"
      }
    },
    {
      "from": {
        "domain": "agent-production-runtime",
        "repo": "local"
      },
      "lawId": "LAW-AGENT-PRODUCTION-RUNTIME-001-V1",
      "to": {
        "domain": "local-app-shell",
        "repo": "local"
      }
    },
    {
      "from": {
        "domain": "agent-production-runtime",
        "repo": "local"
      },
      "lawId": "LAW-AGENT-PRODUCTION-RUNTIME-001-V1",
      "to": {
        "domain": "startup-entrypoint",
        "repo": "local"
      }
    }
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
  -> 当前 job 停止后续续租准入并等待真实在途续租收束
  -> 当前 grant/fence 下立即由原 Outbox 首次交付原 terminal body
  -> Website 完整结果接收回执（LAW-AGENT-PRODUCTION-RUNTIME-004-V1）
  -> Runtime 原请求/receipt/hash 核验并同身份 local completed
  -> 释放业务席位；原唯一 worker 按原标记收束 completed Target cleanup
```

原 heartbeat 在当前调用内启动唯一 executor，completed callback 完成同身份 stage + terminal intent 后，先同步关闭新续租并 await 原在途续租，再调用原 deliverTerminalProductionIntent；不在 completeClaim 再首发。停止动作不等待 executor 自身，不 abort 正常 Product；原 20 秒等待仅一个调用期 timer，停止、abort、executor settled 和超时均清 timer 与临时监听。真实在途续租继续原预算内重试、receipt/control/fence 校验；失败先结算续租，再由外层收束 executor，不自等待。失效或日志失败保留原 durable result/Outbox，实际发送仍核当前授权。Executor 错误/清理出口核同 request、accepted attempt 与 callback envelope/hash；同身份 staged_result 或 completed.result 保留，不凭 status 吞异身份故障，不重跑 Provider。

原 executor tracker 只承载该次执行唯一的 fulfilled/rejected 结算值及原异常（unknown），由原 settleTrackedExecution 唯一消费：fulfilled 返回原结果，rejected 抛出同一异常；原 settled-before-abort 和 Runtime boundary 转换保留。不得用旁路 catch 吞错、伪成功或第二结果观察器防止未处理拒绝；executor 提前失败时也由同一结算链等待在途续租真实收束，原错误身份、stage/Outbox 及 timer/listener 清理不丢失。

stop-and-join 在真实续租结算后还须核原 Product signal；已收到 control intent 或其它真实 abort 时，以原 Runtime boundary failure 退出当前首次发送，保留同身份 stage/Outbox，下一动作仍由 Website 原授权决定。取消不能由测试自带 guard 代替生产边界；验收须把真实 heartbeat 与 executeAndUpload 组合，证明在途 control receipt 后 terminal physical request 为零，不伪造结果或清槽。

原逐 job cleanup 只捕获 release 调用的公开 typedBrowserExecutionFailure；局部闭集为 V6_DEADLINE_BUDGET_EXHAUSTED、BROWSER_TARGET_ACQUISITION_TIMEOUT、BROWSER_EXTENSION_CHANNEL_UNAVAILABLE、BROWSER_BACKPRESSURE、BROWSER_TARGET_INVALID、BROWSER_TARGET_CLEANUP_FAILED。记录原诊断并续下一项；abort 退出快照。Store settle 在 catch 外，Store/sink/共享权威、认证矛盾及未知错误外抛，不用错误名前缀猜类别，不假 settle，不建第二错误 registry 或清理队列。


原 Outbox 的 regrant headers、markOutboxSent、hydrate 与 recordDeliveryFailure 四处写者仍写真实 receipt/response/sent；已 completed 的 BUSINESS_ADMITTED、BROWSER_CLEANUP_PENDING、BROWSER_CLEANUP_SETTLED 不被迟到运输事实覆盖，只有原 cleanup Owner 推进。真实未接纳的同 attempt 失败清除与 FROZEN-SAME-ATTEMPT-RESULT-REDELIVERY-001 保持。原接收对账函数完成本地交付后不 await Browser release；reconcileCompletedBrowserTargets 是唯一清理入口，当前 iteration 优先核可推进 terminal/接收对账 后最多一次清理，旧快照不能使新 stage 等清理。清理安全门、1—30秒未知结果再检查及业务完成权威不变；不新增 worker/store/表/列或完成 Owner。

| Runtime 运行职责 | 只通过 typed interface 消费 | 明确不拥有 |
|---|---|---|
| credential read、session、claim、durable accept、attempt、lease/fence | Website control intent、claim/grant/fence、完整结果接收回执 | Website 业务准入、任务创建、领域入库、公开状态 |
| Runtime 当前授权的运输、lease/fence 与 typed failure | Browser effect WAL、GPT 当前 Child 结果 | Product 静态 Flow、Prompt、各技能精确模型/0..5 推理目标、Child 顺序与结果组装；GPT 只作当前滑杆上限数值截断 |
| product-opaque failure、健康与诊断安全投影 | Runtime Log 的单写者接口 | Browser 私有 WAL、Target/Document、Runtime Log 事实正文 |
| 唯一 Runtime inspector、acceptance 与 Runtime-only proof | 相邻能力权威已签发的 typed receipt，不复制证明正文 | 第二 checker、proof、queue、store、receipt、verdict 或兼容链 |

Manifest primary Owner 只表示路径治理。Product runtime authority 只拥有静态 Flow、Prompt、每个技能的精确模型与 0..5 整数推理目标、Child 顺序与结果组装，不拥有 Website 恢复决定或 Provider session store。GPT 不替换指定模型，只在该模型当前页面滑杆下计算 min(要求值, 上限) 并精确读回；Runtime 只做当前 task/attempt 的 typed 转交；Website Bazi sender 唯一提供已入库且精确绑定的父报告材料，Browser 唯一拥有 WAL 与 FIFO。

现役 `runtime-loops.readHealth` 只作公开状态投影：Cloud 或 ledger 不 ready 时 execution=blocked；否则 draining 优先为 draining；其余仅 Authority present、logger 可写且 Browser lane 非 blocked 时为 ready。Target absent 不阻断就绪，busy 表示原串行工作能力；browserState 仍表示 Authority，claimAdmissionState 保持原义，health 不反向决定 claim、worker、Outbox 或恢复。`operations-snapshot.localRows` 的 execution 行一次生成现有 reason_code/completeness：非 blocked 为 null/COMPLETE；blocked 依当前 Authority absent、logSink 非 ready、lane blocked 分别用现有 BROWSER_AUTHORITY_ABSENT、RUNTIME_LOG_SINK_UNAVAILABLE、BROWSER_LANE_BLOCKED 和 COMPLETE；没有可证当前原因时用 null/DIAGNOSIS_INCOMPLETE，不把历史 lastError 当当前首因。其余正交行、引用、新鲜度和合同字段保持；COMPLETE 只表示该投影源可读。Local App Shell 消费同一公开 health，Browser 执行行要求 Authority ready 且 lane 非 blocked；缺席认证与未决页面输入分别表达，Execution 行消费原 executionState，Shell 诊断可用性不受其替代。原 Runtime/Shell Exam 调用真实 reader 和隔离原 Store 覆盖这些分支、读状态零写入及 blocked 下有效结果继续交付，不新增 checker、恢复状态或第二快照。

`business_recovery_decision_owner_count = 1`，唯一 Owner 是 `Website.ai-acceptance`。尚未完成交付且未被 Website 持久终止的同一 job 必须由现役 worker 持续取得可执行或有界再检查的下一动作。Runtime 先核本地机械有效结果及 Outbox，存在时只交付原结果；无结果时向 Website 原 claim 提交各 Owner 的旧 first fact、结果候选与 Browser 全历史 typed 证据，Website 在原 job 行锁内核对后签旧 attempt 交付、新普通 attempt 或指定调用的新 revision 风险授权。风险授权须覆盖完整旧 WAL 中所有不可读回而需风险重提的稳定调用集合；Website 在同一 source/issued attempt、source seal、新 revision 和原 event/receipt 下，对每个 `product_step_id/call_id/child_capability_id` 及跨旧 attempt/revision 的完整 Provider effect 集合 hash 独立签一次 grant hash。Browser 原 WAL 在一次事务中核当前精确调用与该项旧集合；该项 grant 的现实 Provider 输入总数至多一次：PREPARED 崩溃后 FAILED/no/零输入只可重绑原 row，已终局 REJECTED/no/零输入可保留旧 proof 后在全 grant 零输入、无未决、同身份时写下一 command；其它已有行不得再插第二条，其他调用不能借用，旧全零输入的调用可正常首次执行。旧 Provider effect 默认零 submit 读回，只有原答案不可取得、Browser 已核完整 WAL effect 历史及现役有界 exact readback 或 typed unaddressable且 Website 持久风险授权时才对新 effect 一次可能重复输入；除原 `provider_cooldown` 事故通知的精确事实例外，旧 fence 的 Provider、结果及其他业务 mutation 写请求继续拒绝；该例外不恢复旧执行权。

Outbox 中只有旧 `result_payload` intent 时，它的路径/body hash 仍计入不可变历史，但尚非完整结果候选；Runtime 先对原 effect 有限零输入读回，不把半截上传当作永久占槽。旧答案确证不可取得后，Website 原行锁核旧 envelope/terminal/admission 缺席才可签 source handoff；本地或 Website 已有完整 envelope/terminal 则只能继续同一结果的交付。

旧 payload 已接纳但同 effect 经新代码零输入读回生成不同 payload 时，原槽 409 必须触发原 source handoff 的可复用证明，而非重复 PUT。AGENT 原 Outbox Owner 核原已送达 payload intent/receipt、不同正文的精确 409 intent 和 Browser 全部调用 settled checkpoint，将旧/新请求身份、旧/新 payload hash 与旧 receipt hash 封入原 source evidence；Website 只能在原 job 行锁核 Website 自己持有的旧 staged payload、原 cloud write receipt 与摘要匹配，并核完整 envelope/terminal/admission 缺席，不声称直接读取 AGENT SQLite。仅满足该闭集才签新 revision 的零提交 grant，`calls=[]` 不授权任何 Provider 输入；GPT 只对该 seal 内逐调用已验证的 checkpoint 复用。新 attempt 仅从原 checkpoint 恢复各调用，在自己的对象槽交付；若新 attempt 再次中断，原 source seal 的全量零输入结算可沿同一已签 lineage 继续证明，不能降格为风险重提或永久停工。证据不齐仍停留在原 attempt 对账。

 Browser 精确识别已知ChatGPT限流弹窗时，跨仓清除凭证只从本地已精确核验的原 ack WAL terminal/job/attempt/revision/incident/输入数形成 targetless canonical hash；无原 terminal 时新页面 absent 不清算旧事故。Runtime必须在ack前经现役`production_outbox`持久化唯一`provider_cooldown` intent并关闭受新事故影响的尚未发生Provider submit，仍允许请求当前claim权威；ack确认absent后按incident→clearance顺序向Website交付，ack失败、崩溃或未清除时也必须按同一顺序交付incident与幂等`not_cleared`；ack已确认 absent 但 `confirmed_absent` 交付失败时保留并重试该原 Outbox intent，绝不追加 `not_cleared`，不得让Website失去事故事实。该门覆盖acquisition、atomic phase与atomic success后的confirmed-effect selection，后一阶段发现exact blocker也必须进入同一cooldown closure并保留原CONFIRMED effect，不得绕过closure或退化为未发送事实。该门不复用shutdown abort，不终止任何在途job，并继续允许heartbeat/renew、同effect零submit读回、结果Outbox、Website领域consumer、admission receipt与持久化读回。进程重启只从同一Outbox/Website receipt重建门，不保存当前N、Website权威cohort、旧Target/Document或含其信息的observation/incident身份；旧ack的1秒当前动作窗口不可跨重启复活；原ack可信CONFIRMED WAL terminal才可零输入读回并为同incident补confirmed_absent；新当前页面fresh absent不能清算原事故，缺原terminal时只交付真实not_cleared，不伪造absence；新incident尚未落账的危险输入门保留，历史clearance不再形成永久门，不新增表、worker、scheduler或第二Outbox。Website receipt到达前本地门不得按本地计时自行打开；送达后取不早于最新provider receipt `server_now`的本设备Website当前authority，按活动冷却、cohort及N裁决submit资格，不要求历史clearance为confirmed_absent；`not_cleared`不能由本地计时自行开门，也不能否决Website当前合法资格。

已在 AGENT 本地持久 stage+terminal Outbox 的 accepted attempt，Browser Authority 缺席与 Provider cooldown 均不得阻断原结果交付；原 claim request 携精确 job/attempt/本地候选 hash，Website 只对仍持有该 accepted attempt 的候选签 delivery-only 同 attempt lease/fence，且不得把该声明扩大为其它 job 的执行资格。AGENT 仅在本地已 stage 的原结果可精确读回时使用此 grant 交付或读回 Website 原对象，绝不进入 Product/Browser；Website 已 staged 的原结果也可沿相同 delivery-only 规则交付。

同一 accepted attempt 的风险授权已写 Browser 原 WAL 的 PREPARED 行、但尚未实际 dispatch 就崩溃时，Website 的同 attempt 重授不生成新风险 grant。Browser 只有证明原行在重启后为 FAILED/no/零输入且同 effect、grant、request/payload 不变，才可在原行以新 command/fence/Target 重绑后继续一次输入；已 DISPATCHED 或来源未知必须继续零输入读回。

风险授权当前 command 如获 Browser 精确 `REJECTED/no/physicalInputCount=0`，Website 在同一 accepted attempt 上有限退避重授原 grant；Browser 保留该 terminal/proof，并只在该 grant 全部历史 command 均可信零输入、身份相同且无未决行时，允许新 command 一次尝试。已输入或未知继续原 effect 读回，grant 的现实输入总数仍至多一次。

风险 revision 连续发生时，原 Browser WAL 与每个调用的 source effect set hash 始终覆盖完整旧历史。V44 first_fact_raw_hash 只封原失败的 targetless 稳定字段，完整 raw first fact 与 Browser evidence_hash 仅在原 Owner 内部核真。V44 跨仓 Browser history、source-effect-set、WAL authority 与 anchor proof hash 只取 Target/Document/request/payload/grant-free 的当前 WAL 状态及本地验真 locator 投影；原始 WAL authority、完整 recovery payload 与 V43 旧签名只留各自原版本鉴权，不作为新 Target 身份或跨版本等值比较。Runtime 必须从原已签 source handoff 和 Website 精确 result rejection 身份证明哪些旧 effect 已被拒绝结算；这些 effect 不在当前答案可复用集合，也不需要假造当次读回观察。此前已获 Website 精确风险授权的旧 effect 以原签事件、逐 effect 耗尽证明与完整 Browser WAL 对账，不重复读回或重新签 grant；其它尚未结算的历史 effect 无论属于哪个 revision 仍逐一读回或证明耗尽。Website 在原 job 事件/receipt 对账已拒绝与已授权的历史 effect；只凭 revision 编号较旧不足以豁免。

关闭Owner进入时先读同一`ProviderRateLimitControlPort` submit gate。若门已因首个incident关闭，后续并发/多Tab exact blocker只保持当前cooldown与accepted attempt，不新建incident、ack或Website write；Website的device锁内防御门也必须在receipt insert前拒绝活动窗口内不同`incident_request_id`，使其不得覆盖latest。若首个incident的Outbox enqueue在submit gate关闭前失败，向Runtime报告的closure failure必须保留已有confirmed provider-effect identity与Browser authority；Website恢复只能保留同attempt零submit读回，不得签新attempt。

同一cooldown request的锁前幂等查询若因并发事务尚未提交而未命中，Website取得exact device锁后必须再次用现役`worker_session_id + request_id + payload_hash`回读；命中即返回同一verified receipt，只有锁内仍未命中且`incident_request_id`确为不同值时才能触发活动窗口冲突。heartbeat必须消费同一`readProviderCooldownGate`并把reason写入signed receipt，但`claim_eligible`只表示session可否请求claim，不能等同“无关新grant开放”：活动窗口仍须允许cohort内accepted attempt regrant和同effect零submit读回，时间门后还须允许cohort内未发送job取得新attempt。新incident尚未落账时仅关闭受其影响的危险Provider输入，仍允许请求当前claim/session/heartbeat权威及零输入读回和结果交付；原notice同identity续交获strict receipt后，由Website服务器时钟、当前device及cohort决定资格，旧clearance ACK缺失不能永久关闭claim或submit。submit gate与claim-request资格不得混为一个布尔值。

Browser preflight返回`BROWSER_GPT_DIALOG_UNRECOGNIZED`时，Runtime在唯一accepted-boundary只更新本地task current reason并写现役Runtime Log authority ref/hash；该事实不是已知限流incident，也不是Website业务恢复输入，必须保持`provider_cooldown` Outbox、`attempt_failure_json`、`lease_release ATTEMPT_FAILED`与Website recovery decision增量为零。Runtime不得解释DOM机械fact、调用ack/cooldown closure或新建持久mismatch gate；只有后续Browser fresh同Target/current Document返回typed absent，Product调用链才可重新进入Provider访问。

同一`(job_id, attempt_id)`的普通attempt failure只允许一份本地`AttemptFailureFirstFact`，仍原位保存在现役`production_tasks.attempt_failure_json`，不新增表、Outbox kind、ledger或worker。不可变`failure_core`必须保留完整`SerializedTerminalFailure/FailureFactsV6`；唯一`release_descriptor`绑定`attempt_id/lease_version/request_id/body_payload_hash/write_request_payload_hash`。现役唯一lease-release builder一次产生request、两种hash与request_id；顺序必须是serialize完整failure → builder → 空槽CAS持久完整first fact → authority reader逐字节回读 → 才允许POST。200、回复不明和稳定409都必须GET device-status，严格读回同一`lease_release` receipt或Website原始`attempt_failure + next_action_code`；request、双hash、attempt、lease与response任一不等均失败关闭。原lease/session仍有效时只可重投同descriptor；进程重启或旧fence/session不可证明时只GET，不得重建旧请求或重跑Provider。

同 attempt regrant 与结果交付不得先清 first fact 或执行 Provider。Runtime 先核 Website admission/result/terminal 与原 task/Outbox；机械有效结果及必要 artifact receipt 闭合后，必须在同一 SQLite 事务写 stage + terminal intent，保留 first fact 原值供 `TerminalCasV6.terminal_source_first_fact` 运输。Website 原 terminal CAS 保存该原值及与既存旧 failure 的冲突诊断；冲突不否决机械合格结果。按唯一接收完成法条核验回执与对象读回后，以原精确 CAS 从本地当前槽退休 first fact。若旧结果不存在，Website 对旧 failure 的任何不完整/矛盾事实只能禁止当前危险动作并继续有界对账；不能让 job 占槽而永不领取。新 attempt 的 source_evidence 必须在 Runtime 原 per-job Owner 停止旧 execution、以原 task 精确 current_attempt_id、staged_result_json is null、旧来源 hash 与 production_attempt_handoffs 中 exact source_attempt_id 的 typed seal 在同一 SQLite 事务封住旧 completion 入口（本地无持久 fence，Website 原行锁另核旧 fence）后出具；晚到旧上传回执不能 stage/terminal。旧 READY 已在封口前成立时必须交付原结果而不得换 attempt；新 accepted 后的旧字节仅是历史候选，不能用旧 fence 交付，当前 attempt 继续。

Website 已持久裁决 `WAIT_NEW_ATTEMPT` 且原 job 事件/claim receipt 已核 `source_evidence[]` 后，新 grant 必须是不同 attempt；旧 first fact 缺失、非法或矛盾仅作为原值/缺失证据留在该事件，不作新 attempt 资格门。device-status 在 runtime 没有当前 attempt 时只可投影历史 latest failure 供旧来源对账；存在当前 attempt 时只投影与 `runtime.attempt_id` 相同的 failure，合法新 attempt 尚无 failure 时返回 null，不把旧事实冒充新事实。Runtime 在原 per-job Owner 收束旧 executor 并以本地精确 `current_attempt_id`、`staged_result_json is null`、旧来源 hash 与 `production_attempt_handoffs` 中 exact source_attempt_id 的 typed seal 在同一 SQLite 事务封住旧完成端口后才出具 manifest；Website 原 job 行锁另核旧 fence/当前 attestation 并签 grant。Runtime 读回同一 receipt/event 后，只由 `acceptTaskAfterSourceHandoff` 对本地已封存 manifest、旧 first fact 原字节或明确缺失、source/issued attempt 与新 grant 作同一事务 CAS；旧 first fact 已保存在 Website 原事件，才可从本地当前槽退休，旧 Outbox/artifact/WAL 历史不删。封存的 Outbox history hash 只绑定不可变的 intent 身份、路径与 body hash，不绑定会随后落地的发送时间或回执；每轮 claim 复用原 SQLite 中同一封存 manifest，不因部分上传回执晚到而重算 seal。`acceptTaskAfterFailureReconciled` 只处理同 attempt regrant，不得跨 attempt。已接受 attempt 重授而本地 task 尚不存在时，Runtime 先核 Browser WAL、Outbox 与 Website staged result/artifact receipt；完全空白才正常 durable accept，已有历史则先恢复本地 task 身份并在下一轮对账，不得凭本地缺席推断 Provider 零输入。无完整 first fact 的可能输入历史只禁当前危险动作；原 worker 定时核 Browser/Outbox 无结果事实并持久化有限观测，满足 Website 风险授权门后走原 source handoff，不得盲目重跑 Product。任一身份或 CAS 不等只禁本次危险动作并自动对账，不能永久冻结 demand；禁止把旧 failure 重绑/POST 到新 attempt，不新增中间状态、第二恢复器或兼容路径。

原 accepted attempt 的 Provider 输入可能已发生而结果未就绪时，Runtime 先保留旧 effect/WAL 与机械有效结果，Website 原 claim 重授同 attempt 的零输入读回 lease。Browser 对每个旧 effect 只从唯一 WAL 取得 canonical conversation URL + 提交时 exact userTurnId；文本回答由原 Product turnMarker 在当前 Document 定位，图片仍以原 exact userTurnId 定位；live Target 可复用则同 URL 零导航，Target 已丢失则当前 lease 直接创建当前 system Target 并最多一次精确导航，不先报 old-target failure。可信 locator 的真实有界 exact negative observation 才证明原答案不可机械取得；WAL 无可信 locator 时出具 typed unaddressable，明确保留旧答案可能存在，不扫描旧 Tab/标题/侧栏。读回成功优先沿原身份 stage/Outbox/Website admission；时间等待、空证据和旧 Target 缺席均不构成负读回。原 `production_attempt_handoffs` 仅按 source effect/call、原 WAL authority、checkpoint/Forensics artifact、exact readback 或 unaddressable 的 typed proof 保存来源 seal，不持久 Target 身份；完整 replay_calls 与逐 effect readback_proofs 一一对应，settled_reusable 调用仅归还原答案，replay_exhausted 子集才进入 Website 风险 grant，rejection_settled/risk_authorized/historical_settled 保留原事件血缘。`readback_exhaustion_hash` 只覆盖真实耗尽子集。历史DISPATCHED只保留未知事实，input_quiescence_proof在原真实terminal_wal完整时可附带，否则为null，不作当前资格门，也不证明答案不存在或授Provider输入。Website 仍在原 job 行锁核旧结果/Outbox/admission 缺席、完整 source seal、风险授权调用集合与旧 fence 后持久签发新 revision；Browser 在真实输入前再核 current Target/Document/permit/原 WAL。本次已撤销未完成 V43 job 的来源不得进入 V44；已完成 job 的旧签事件仅作原值历史取证，不进入活动 claim。

`TOMBSTONE-RECOVERY-AUTHORITY-001` 继续固定 Website 是未删除需求的唯一业务恢复决策 Owner；八字新业务任务只消费 Website 已入库并精确绑定的父报告材料，且每次从 clean GPT chat 执行。同一SEO文章的五个翻译task由Website按严格locale顺序签发provider_continuation direct parent，zh-HK直连已接纳zh-CN生成task，后四个直连已接纳前序翻译task。固定catalog保持各locale/cohort独立task/result/admission，同cohort仅派当前最早未闭合locale；部分合格后仅失败ID进入下一张后继任务。首任务fresh且parent triple全空，后继只携Website已接纳的直接前驱三元组，Browser只从父WAL唯一URL续聊。Runtime只在Website已签provider_continuation且父结果ref/hash与本地completed父结果精确相等后，读取该结果实际采纳的全部原checkpoint来源证据，并按原父job、来源attempt、result revision、product step、实际call、submit或已验真附属retry Child及原WAL authority/hash整体验真；完成attempt和child当前step不得代替原来源。跨attempt复用须核既有accepted source settlement及reused_checkpoint，同attempt正常live/cache不新增grant门。Browser逐项沿原exact source reader只读CONFIRMED且可信的原effect locator，全部采纳来源的canonical URL非空且全等后才为当前job独占Target精确导航；缺失、未决、篡改、矛盾或URL冲突均零Provider输入失败关闭，不得任选来源或fallback。来源只作locator选择，不跨仓、不新持久化且永不进入child provider effect identity或业务恢复裁决。仅为核图片采用关系，GPT原Owner可按精确parent job/source attempt/checkpoint identity读取既有gpt-image-source-binding.v1身份描述，核原ref/integrity hash及conversation/user hash后只向Runtime回传originalArtifactRef；这是封闭身份元数据，不得读取父文本、父原图bytes、Prompt或旧页面，描述不进入Product，也不新增Forensics端口、schema或存储。异步来源验证在原dispatchPlugin进入Mediator同步context工厂前完成；原readSourceReadbackObservations、readAcceptedSourceSettlements和Browser公开全历史typed reader是唯一来源。固定catalog首任务fresh，后继顺序续聊。Runtime不读取Provider URL、不选择父任务、不判断业务父资格，也不新增父关系或continuation持久化。已确认Provider effect跨进程只能读取同一结果且物理submit增量恒为零；continuation store/frontier/CAS、private base、fork、兼容桥及第二恢复链恒为零。

Runtime 对外只发布 Agent Route Capability Manifest。它从 Mediator 取得冻结、不可变、纯数据的 `product_id + action_id + task_contract_version + result_contract_version` 路由集合，随后在本域校验 Manifest schema/hash并用于当前 session attestation 与 claim 资格。Product Plugin 名称、版本、Skill hash 与 Catalog 实现身份不得进入 Website job、request、accepted attempt、grant、result、artifact、terminal 或 Browser effect；Runtime 源码不得直接或间接取得 `ProductPlugin` 实例、Product Skill 正文、`parseResult`、`assemblePayload` 或其它 Product 可执行回调；Product Plugin 也不得 import、re-export、dynamic import 或 side-effect import Runtime 私有模块。

Product、GPT、Browser、Forensics、Runtime Log、App Shell、Startup、Website 继续由各自 active law、blueprint、spec 与唯一 Manifest primary Owner 守住文件及接口边界。Runtime 文档只记录上表接口边，不复制其业务流程、DOM、模型策略、Provider 操作或发布裁决。

保留的现役 V6 公共媒体能力不因旧产品退休改变机械边界。GPT 取得的已鉴权原始 Provider bytes 先由 Forensics 按原字节/hash封存并读回；Product 只作 EXIF 方向应用及去 metadata WebP 编码，保留方向应用后的原宽高。Runtime 不解码图片，只校验 WebP、hash/bytes、整数宽高并运输现役 V6 receipt。Website staging 独立解码宽高并绑定同一 result payload；任何层不得 resize/crop/pad 或设尺寸、比例、总像素拒收门，原图不上传，V6 receipt 不增加宽高字段，也不新增图片链。


GPT 页面 selector 的语义冻结只属于 GPT Child，Browser 只机械执行 typed query，Runtime 只消费 Child terminal。mutation 前是否自动选中精确 system Tab、激活后的 Target/Document 重验、输入前 activation generation 与 `BROWSER_TARGET_NOT_INTERACTIVE` 结算都只属于 Browser Authority；Runtime 不接收 tabId、不调用激活/窗口聚焦、不读取 Browser 私有状态，也不建立第二 precondition、WAL、恢复或重试。该变更不得进入 Runtime 配置、Manifest 字段或跨仓合同；Website 任务、Outbox、artifact receipt 与 business admission receipt 主链保持不变。

Website 已持久拒绝原结果 revision 且原 first failure 精确绑定 `RESULT_SETTLED_UNUSABLE` 或 `GPT_RESPONSE_STOPPED_EMPTY` 时，同一 `source_evidence[]` 以空风险集合提交 `attempt_handoff`。AGENT 先核 Browser WAL 全历史、完整原WAL effect历史与无Outbox结果候选；除本次被拒 effect 外，已由原 Website rejection 或原已签风险授权逐 effect 精确结算的旧输入保留原证据，其它未结算的旧可能输入 effect 须有 checkpoint/Forensics 正向结算证明；stopped-empty 的被拒 effect 用 Website 已核准的 observation fact，不伪造 checkpoint。Website 以原 rejection event、source attempt、effect 与独立结果/observation fact hash 行锁核验后签新普通 result revision，沿现役 `prior_result_rejection` 交 Product。原本地占槽、新 grant 分类及旧 attempt 的持久 CAS 必须随 handoff 同步闭合。

`current_reason` 仅作可变诊断投影，不得决定 source handoff、stage、regrant、capacity、cooldown、删除或完成。旧 source attempt 的 typed seal 与 stage + terminal 在同一 SQLite 中互斥；stage 先成立则 seal 失败，seal 先成立则旧 attempt 的 late stage、first-failure、release-descriptor rebind 和普通同 attempt regrant 失败。旧 attempt 关闭不终止 Website 对同一 job 的未完成需求。Website claim envelope 的 `LEASE_GRANTED` 保留精确 wire 字节，但 grant、lease、fence、session、attempt、request 与 contract version 才构成实际执行授权。

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

Website 已持久决定 `WAIT_NEW_ATTEMPT` 后，Runtime 先核本地机械 READY/Outbox 与 Website 结果候选；存在可恢复结果时只走原结果 terminal/接收对账，不释放本地 stage。确证旧结果不可恢复时先封旧执行完成端口并保留本地旧 attempt 投影；只有 Website 新 grant 的同一 receipt/event/manifest 精确读回后才以单一 CAS 切当前 attempt。`WAIT_NEW_ATTEMPT` 本身不清旧 first fact/stage；Browser 当前 live Target 清理只核当前 handler/native 与该 job 本身的完成资格。该业务决定不触发Chrome窗口恢复，不把历史未决WAL作为其它合法job的资格门。Chrome完整退出的恢复只由Browser已鉴权Authority WebSocket真实transport terminal触发：App Shell构造的现役零窗口宿主能力经Local App Shell装配注入Browser supervisor，已有Chrome窗口时零动作，零窗口时只打开一个现役Workbench窗口。Runtime production目录不取得该callback、不读取窗口、不重试、不建立第二生命周期、manager、queue、timer或恢复链。

新attempt的Browser mutation先核完整原WAL effect历史与Website当前精确授权；同一已输入/未知effect不得重发，结果先exact读回，有界耗尽或typed unaddressable不证明zero。历史DISPATCHED不阻断其它合法job/current action；真正当前native仍唯一lane串行并逐次有效guard。V45 source的input_quiescence_proof保持required nullable，possible/unknown允许null，真实非null terminal_wal仍严格验原hash/完整历史，不能伪造空未决或新静止证明。原source seal与stage竞争、原风险grant/newrevision/不同effect去重不变。

原readback_only_calls是恢复执行中的零Provider输入限制：若已签risk的当前attempt为zero、旧source绑定变化而需重新授权，在Runtime原failure reconciliation按完整验真WAL及原issued source指定call筛出未获当前读回证明的trusted effect，传递其精确source attempt/revision/effect/WAL身份给原GPT readConfirmedSubmit入口。该入口只能调用原Browser readSourceConfirmedProviderEffect验真旧CONFIRMED terminal和canonical锚点；禁止将未知terminal改成CONFIRMED。原当前lease/Target/Document控制有限exact checkpoint，原Source Reader每次重验旧WAL身份；只读input不能转为新的submit。原checkpoint/negative观察按真实旧source身份写当前attempt原observation；下一轮原preflight封source，仍先Website指定新revision才可重放。没有trusted可验terminal的effect只走原unaddressable或保留局部来源错误，不添加Child、Writer、外部字段、兼容decoder或第二恢复链。 同call多旧effect保留现役完整分母，每批按原WAL顺序选择一个尚无当前有效证明的精确effect；negative写入后下批推进，合法结果优先交付，不以effect数量当作身份多义。有限checkpoint沿原Forensics按旧source attempt命名空间追加当前唯一checkpoint exact hash的新artifact，保持source45中source_attempt_id与原Source Artifact Reader一致，不覆盖任何旧artifact；执行租约、Target、日志仍属于当前attempt。 未sealed的原source_checkpoint观察，仅当同effect的原source attempt/revision不变且WAL/source effect set绑定变化，才可沿原SourceReader/Forensics重新验真后替换原观察；相同绑定不同proof仍拒绝，旧artifact、WAL与已sealed source逐字节保持。

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

原 Session request 的 CLOUD_REQUEST_TIMEOUT_MS=30秒覆盖 fetch 与 response body 解析，不被传入 Product signal 替代；调用期同时消费调用方 abort，结算后清原 timer/listener。超时保留 CLOUD_TRANSPORT_UNAVAILABLE/结果未知，不证明服务端停止，不放行完成 terminal。续租保留原lease预算内重试及4xx/schema拒绝；周期与重试等待各结束即清本调用监听，不修改全局 wait，不增加另一个请求/计时 Owner。

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

授权 enrollment 以 Website 核准的原请求 ID 首次建立长期设备凭据，或在明确撤销后沿同一设备恢复。网站服务为 https://127.0.0.1:4343，Agent 身份为 http://127.0.0.1:4174。Runtime 只从本仓唯一 active consumer dependency 读取 control_contract_version，Website 在 session open 精确核对，并在 session、claim grant 与 execution fence 返回同一版本。版本不相等只返回一次 typed 409，保留诊断 Shell 并阻断执行。核对两侧绑定后沿原入口启动，合同或 build 升级沿原设备开新会话。

同版本 AGENT 关闭或崩溃时若原 `production_outbox` 仍有未结清的 `provider_cooldown` 事故（包括已送达 incident 但尚无 `confirmed_absent` clearance），其不可变 body 中的 `worker_instance_id + session_open_request_id + worker_session_id/epoch + lease/fence` 是原事故事实；正常 shutdown 不得先 close 原 Website session。新进程只在原 device/build/contract 和 Website 原 session 均未被新 epoch 取代时，按同一个 open request 取得刷新后的短期 credential，承接 Website 返回的 `attestation_seq` 后先 fresh heartbeat；Website 在 device 行锁内复核该请求鉴权时的 token generation，拒绝轮换前已鉴权但轮换后才进入事务的旧 heartbeat；迟到 session close 也必须在同锁序复核当前 token generation，不得关闭已续用的原 session。heartbeat 提交结果不明或本地 seq 已 stale 时，AGENT 以原 open request 精确重同步原 session/seq/token 后自动发下一次 heartbeat，不永久重发旧 seq。每轮沿原Outbox按incident有限快照续交已有intent并保留typed失败，再消费当前Website authority及当前Browser preflight；旧 `not_cleared` 发送失败时不得先发送新的 `confirmed_absent`。逐incident原pending快照各一次续交；旧clearance确认缺失或一项失败不阻当前authority查询/其它job，新的真实incident必须先Website精确落账再危险输入。Website 的非终结 lease release/过期只清 token/expiry 撤销动作权，保留原 session/fence 作为迟到事故与已接受 cohort 的精确身份；来源交接只在 lease token/expiry 已清且旧 fence 被证明不可执行时才可覆写它，不能把非空历史 fence 误当活动动作权；任何旧 Browser/Provider/结果 mutation 仍需当前 lease/fence。closed、superseded、跨 build 或跨合同身份不得用这个同 session 恢复入口复活。RELEASE 前须精确盘点全部旧版本未结清的冷却 lineage（未送 intent，以及已送 incident/`not_cleared` 但无已送 `confirmed_absent` 的原 session/receipt）；本机已证的 3 条未送 intent 只是其中实例。逐条按原版本和原身份结清或经单独受控裁决，不能把 v43 READY 冒充生产已恢复。

## 4. 跨仓合同与业务完成

跨仓 task/result 的唯一来源为 ADVISION-X/AI-Paper-Factory 的 astra.website-agent-task-result v4；V6 仍为该仓 astra.production-control-v6 初版1。Route Capability Manifest 唯一来源为 ADVISION-X/ASTRA-AGENT 的 astra-agent.route-capability-manifest v2，authority 为本仓 production/catalog.ts 的纯数据投影。consumer dependency 只含 contractId、version、providerRepo，普通启动不读取未绑定提供方工作树。

唯一投影生成器读取提供方 exact bytes，核完整 routes、parameter_types、result_contracts 及材料顺序、repeatable、min_count、信任与 owner scope。提供方公开集合与本仓唯一 Catalog 必须双向一致；未知、缺失、重复、额外或语义漂移失败关闭。旧命理、SEO、本地化公开路由和 v24 投影退出，不保留兼容入口或第二支持表。

论文生产工厂是唯一研究产品。S00 在产品内持有固定跨技能 Flow；C01、S01—S10 各持独立 Skill、提示词、内部 Flow 和结果合同。Catalog 只接入 S00 与沿用付款观察插件；叶工序由 S00 单向静态调用，不能互调、调 Runtime 私有实现或各自完成外部任务。付款观察保留原 Chat、材料和原结果链，核准及到账主权不进入插件。

独立 `user_dialogue` 由 S00 调用原 C01 Chat。只传网站冻结的安全上下文及原问题，核对材料字节和问答、项目、输入、订单、上下文身份后沿原完成入口回传。S01 缺项仍走 C01 内部交接；独立问答不读 Work，不改变网站业务授权。

Website v4 通过原任务和材料交付论文写作与本单沟通约定。C01、S01 按本单沟通语言输出，S07 用所选语种原创，S08 在原独立上下文对照实际稿件核验。Runtime 只验证投影形状和原身份。旧合同在途在切换前收束，旧双空语种仅容许 Website 已裁定的原非内容维护与同稿恢复。原 session 携现有部署指纹接受 Website 核准。

当前研究业务动作分别承接售前提纲、工作区准备、证据研究、全文写作复核、文件准备、归档及原资产维护；S00 在每次授权内执行固定技能段，不按 Skill 编号新建持久任务。各段只回必要决定、问题、版本、实际读取覆盖及产物引用；完整正文、原件和过程文件留本单 Work。原件使用本单限定读取权；付款附件及控制 JSON 仍沿原材料链。

六条正式结果在原 S00 组装 `next_business_action` 与 `public_updates`。内容方向来自当前投影允许值和原未决问题。`prepare_delivery` 的未决纯装配故障保留原问题并返回 `blocked/null`，交网站现有机械修复入口。无已核可公开的 Work 观察时动态为空，网站接纳与签发权保持在网站。

Runtime 只注入当前产生执行身份和限定对象 Work-access 端口，不暴露 lease/session、签业务授权或保存 Product 步骤。S00 在一个业务任务结束时沿原 complete/Outbox 返回一次同身份结果；同结果重投保留原 producing attempt/fence。AGENT 完成仅依 LAW-AGENT-PRODUCTION-RUNTIME-004-V1 的同完整结果回执；网站领域接纳、发布及客户可领取分别认定。

S06/S08 在独立 Work 上下文实际核读本单同版原件。S10 实际装配可编辑 DOCX 与可解包 ZIP，核许可与保密后由 Work 固定脚本按精确授权条件直传 R2，并完整 GET 核字节/hash；AGENT 不取回完整生产文件中转。上传未知先读原对象，不重生成论文、不盲重传；脚本报告及原清单沿原结果链交付。

以下旧 Public Knowledge 冻结专业合同作为独立保留边界，不产生旧产品登记或论文产品资格，不改动其冻结文本：

`FROZEN-PUBLIC-KNOWLEDGE-PROVIDER-FORMAT-ONLY-001` 固定：Public Knowledge 的 Provider 可见输出格式只来自 Website 唯一 canonical `result_contract` 的机械投影，Product 只把当前 research/article 子合同原样写进 exact Prompt。research 顶层只要求 `schema_version,decision,topic_manifest,research_markdown,citations,research_claim_units` 六字段，article 顶层只要求 `schema_version,title,editor_note,article_markdown,safety_notes,verbatim_quotes` 六字段（article-output.v4），由原同一写作回合提供 `verbatim_quotes:[{text,citation_ids}]`，显式空集仍可表达；Provider 多余字段由 Website 唯一 parser 丢弃，不得拒收；Product 继续按公开 schema 接收完整原对象并沿原 package 交付，新增直引字段的原字节/原 citation 机械核验及同 admission 事务存储只属于 Website，不增加 AGENT validator。该合同只约束交付结构、字段类型、枚举、引用 identity/marker 关系与 Markdown 语法，不得规定选题结论、分析方法、推理过程、观点立场、证据解释或图片创意；Product Skill 正文不得注入 Provider Prompt，AGENT 不得复制、扩写或另建格式/质量 validator，不得重塑 Provider 输出字段类型或追加第二 reception sidecar。改变或删除本冻结边界，必须由用户在未来任务中明确解冻并同步替换双仓施工图、合同、实现与唯一质检。

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
-> Website 接收节点引用 LAW-AGENT-PRODUCTION-RUNTIME-004-V1；网站领域事务另行完成业务入库
```

执行失败后 Runtime 先核原 first fact/release；Website 已确认并签当前 ACTIVE_ATTEMPT 时按原 CAS durable accept，不再以本地失败分类重复否决，原 Browser WAL/当前 grant 仍唯一裁决现实输入。Website 唯一裁决：存在机械有效结果则继续原身份交付；无结果且全历史零输入则同 job 新 attempt；已可能输入则旧 effect 零 submit 读回；原答案有界核验不可得且Browser 已核完整 WAL effect 历史及现役有界 exact readback 或 typed unaddressable后才签指定调用的新 revision 风险授权。坏/缺/矛盾 failure fact 不再终止需求，当前危险动作失败关闭且有限再检查。接收前的原结果不可得或原 effect 结算仍按原 rejection/source 授权；成功接收后的领域失败只由 Website 消费原结果。

Browser provider effect identity 不含 Product Plugin 或 `attempt_id`，固定由 `job_id + result_revision + product_step_id + call_id + child_id + request_hash + payload_hash` 组成。AGENT 内部实现、attempt、进程、lease、fence、Target、Document 变化不得制造新 effect；同一 identity 的 physical dispatch 总数至多一。每次 mutation 与 Website 写请求仍校验当前 fence，旧 fence 的 Provider、结果及其他业务 mutation 迟到写请求全部拒绝；原 `provider_cooldown` 事故通知只按原身份交付事实，不恢复旧执行权。


lease release 只使用一个由 `job_id + attempt_id + lease_version + payload_hash` 确定性生成的 `request_id`；不得再复制 `idempotency_key`。同一 attempt 的同 effect readback 失败只允许 Website 记录首条失败事实，后续 release 只验证相同 `provider_effect_identity_hash` 并释放当前 lease，不以新的墙钟时间制造第二失败身份。

AGENT 不建立通用 checkpoint、跨任务 Provider session state 或第二恢复状态机。Browser 唯一 WAL 的同一 provider-effect 行只提供 at-most-once 与同-effect confirmed readback 所需加密 locator；Runtime 唯一 Outbox 只幂等交付同一 result。Website 以自身 staging、领域入库与 admission receipt 为准，已完整 staging 的结果继续由 Domain Consumer 入库，不回退 AGENT。

管理员退役唯一消费Website现役FROZEN-ADMIN-AI-WORK-ORDER-REPLACEMENT-001（AA004及provider49）：原业务需求/Work Order根、已交付权益和保护集合由网站原Owner保留并决定T1/T2/新G。旧count确认→暂停→零完成量删除Work Order根的管理合同已由该获批替换合同退出，不再是AGENT施工依据。Runtime不裁D/P、计数、是否删除需求根或是否接续；只消费当前exact控制并保全/运输原source，认证exact job absence后按W5清本地及读回缺席。Provider自有消息、日志与备份不属本地删除范围。

付款、发布、删除、发货与正式业务记录修改不得放在可废弃 attempt 内；它们只在 Website 最终领域事务中按 `job_id` 幂等执行。禁止 recovery manager、planner、workflow、recovery queue、fallback、compatibility、legacy、bridge、shadow、第二 scheduler/store/state machine。

stopped-empty 的 lease-release typed fact 必须同时绑定 confirmed submit 的顶层 `evidence_ref/evidence_hash`、完整 Child proof 的独立 `child_proof_ref/child_proof_hash`，以及首次/终态 observation 时间、连续单调毫秒、observation 次数、位点 identity hash 与终态 observation revision hash；Website 在任一字段缺失、连续值少于 1,200,000ms、次数少于 2 或 Child 不是 `submit_exact_gpt_turn_once` 时失败关闭，不签发新 revision。终态 observation revision hash 只来自 stopped-empty proof，不得覆盖或冒充 submit evidence。

## 6. SQLite 与 task-owned storage

Runtime 唯一数据库只保留三表：

- production_tasks；
- production_outbox；
- production_attempt_handoffs，仅保全原 attempt 来源 seal、已签发 attempt 身份与逐旧 effect 的真实读回证明；Website 仍是唯一恢复裁决 Owner。

`production_tasks` 不保存 Product Plugin 名称、版本、Skill hash、Catalog hash、checkpoint schema 或执行位置；业务请求身份直接来自其 Website task 中的 job_id、product_id、action_id、task/result contract 与 request_hash。Browser WAL 只保存物理 mutation terminal、result_revision 与同一 effect 的加密 canonical conversation URL，且 plugin 字段数为零。Runtime、GPT 与 Browser 均不保存跨任务 consultation identity、source task、checkpoint、frontier 或 Provider conversation；Website 父子关系和已入库父报告只通过本轮业务 task/material 传入。

首次安装只有在零张 production_* 表时才可建立当前三表 schema 并设置 WAL。已有任一表后，普通构造与启动只读验证精确表、列、主键、唯一索引、外键、WAL、integrity_check、foreign_key_check 与数据不变量；旧表或缺表返回 migration-required，不在普通启动补表、重建或迁移。`production_leases` 与任何 Website lease/fence 镜像必须物理不存在；Runtime 只消费当前 Website grant/renew，并以进程内单调预算停止过期执行。Runtime 不保留普通启动迁移入口。Browser WAL 只在全新空库建立现役 schema；已存在但 sqlite_master 零对象的库按未初始化处理，仍由 accepted task provenance 门阻止历史丢失。已有 Browser 持久对象时，普通启动先只读验证唯一 `browser_mutations` WAL 表、现役索引、约束及全部持久对象清单；`browser_target_claims` 及其索引必须不存在，旧结构、额外旧表或缺表返回 `BROWSER_REPAIR_REQUIRED`，拒绝前不改 journal mode、不写 key、不执行崩溃恢复；验证通过后才可执行现役 PREPARED 崩溃恢复。普通启动不做 ALTER、复制、重建或补表。历史 `legacy_wal` claim 行只作原 WAL 证据，不重新抬升为活动 claim。数据库缺失、不可读、损坏、查询异常、记录缺失与 hash mismatch 必须分别保留。

普通启动对Runtime DB、Outbox和task-owned directory作唯一read-only inventory，保留owned/orphan分母及bytes。孤儿目录只诊断、不阻原worker启动；该task文件损坏/不可读仅约束所属读取，正常Store与凭证下其它job继续。真正共享Store坏或凭证无效仍停危险输入；普通启动不移动/修复/删除、不镜像lease/fence，不建台账/tombstone/索引/表/worker/删除协议。 原root盘点错误仍是共享失败；原task树递归错误仅由inventory自身携jobId的typed局部错误交接到startup，原码和cause保留，startup记录该局部诊断继续原worker。原maintenance完整dry-run仍严格失败，不补造bytes或完整DTO，不新增inventory模式/真相。

普通启动不得模糊清理。Runtime 只在自己已经 durable accept 的 exact job 后续被 Website 权威读回为不存在时，取得该 job 的唯一删除授权；必须按 job_id 同步清除本地 task、Outbox、task-owned 目录、Browser WAL 与 Forensics artifact，并逐项证明目标缺席、其它 job 保持不变。仅旧 Forensics 字节先写而索引未落盘留下的无主 `.bin`，由原 Forensics Owner 在这次已授权清算中比对完整共享索引后同步删除并读回缺席；有索引的所有兄弟 artifact 保持不变，普通启动仍只读。不得保留永久撤销状态、删除队列、删除台账、归档或兼容路径。

## 7. 质量系统与发布边界

agent-production-runtime 只有全仓原生 quality:check 中的一份 Manifest、一套现役 inspector/acceptance、一条 Runtime proof route 和一个最终 verdict。Manifest 的 `ownedPaths` 只登记 Runtime 自身的 Manifest primary ownership；Product、GPT、Browser、Website、Runtime Log、App Shell、Startup 与历史项目方案不得由 Runtime primary-own，只能在确有接口消费时以精确 `observedPaths` 观察。

某一候选只有另获 AGENT 内相邻域原子归位明确授权后才可施工，且文字授权不等于已完成。法案、Inspector、测试、proof 与混合文件必须先在同一未提交 CHANGE 候选中准备完成；所有接收域与 Runtime 的 `ownedPaths` 在此期间保持原值。文件拆分完成后只允许一次原子修改：architecture-boundary 在已拥有的 Mediator/Product 边界内接收 `src/mediator/product-plugin-catalog.ts` 与 `src/mediator/product-plugin-contract.ts`，保留已归位的 `src/mediator/agent-production-route.ts`；agent-production-runtime 同时物理删除旧 Product-facing `plugin.ts` 和全部旧 import 边，而不是删除真实消费者。旧文件内容只按以下唯一映射归位：Product 类型、执行 context、产品中性 checkpoint/fault receipt 与结果校验 primitives 进入 `product-plugin-contract.ts`；12 个 Product 的唯一 composition、Skill 读取/hash、route identity 与单次 dispatch 进入 `product-plugin-catalog.ts`；artifact upload、Outbox、transport receipt 与 envelope 继续留在 Runtime；业务 parser/assembly 继续留在各 Product。现役 provider spec 已绑定的 `catalog.ts#agentPluginCapabilityManifest` 原位删除旧 Product imports、Plugin object、Skill text 与 route registry，只保留 Runtime 自有的 product-opaque Manifest publisher。不得再建立第三个 common/helper/adapter 层。其它相邻域只有在当前候选真实涉及其 Owner 路径时才参与。随后立即重建唯一 registry 并证明 `UNOWNED_PRODUCTION_FILE=0`、`MULTIPLE_PRIMARY_OWNERS=0` 与 Runtime manifest-owner-drift=0。不得先接收、先删除、建立临时第二 Manifest、兼容 re-export 或形成中间 READY/RELEASE 候选。

静态证据必须来自 Manifest Owner、AST、JSON、resolved import、实际 symbol consumer、合同或状态机结果；路径名、字符串包含、文件存在、fixture 数量、历史 report、self-check 或另一个裁决不得产生 PASS。检查器必须拒绝任一 Runtime-owned source 对 `src/plugins/**` 的 direct/re-export/dynamic/side-effect import、任一 Product source 对 Runtime 私有模块的反向 import，以及通过旧 Catalog、alias 或中转模块形成的同义边；不得再为 `src/lib/local-runtime/**` 或旧 Catalog 设置豁免。Runtime acceptance 不运行完整 Product Flow，不启动 GPT/Browser 业务动作，不裁决内容，不要求 40 个 Website job 全量入库。现有 Product/Runtime acceptance 必须用确定性 stub 证明 generated-image 的同一 artifact intent 只上传一次、Product 只在取得真实 typed receipt 后组装并执行 final parse、Runtime 收到的 final output 不含 `assemblePayload`、`parseResult` 或 Plugin object。现有 Architecture/Runtime acceptance 还必须从唯一 architecture Catalog snapshot 机械逐字段投影并证明 astra-agent.route-capability-manifest v2 的 schema、product/action route、task/result contract version 与 canonical route hash 精确一致，并证明跨仓及持久身份中的 Product Plugin 名称、版本与 Skill hash 为零。`architecture-boundary` 的 Exam 只能从 architecture-owned 唯一 Catalog、Runtime 发布的 Route Capability Manifest 与 `scripts/acceptance/product-plugins/**` 发现 route、证明一一对应、执行并汇总各 Product 自有测试；中央入口不得手写 Product Plugin 或 primary product/action 列表，不得保存任一 Product 的 Prompt、Child 顺序、checkpoint、分支、恢复规则或 expected result body，生产 `src/plugins/**` 不得 import 测试代码。

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
2. task-result provider/dependency/projection精确为4，V6为ASTRA独立初版1、capability provider/dependency为2、task/result envelope为1；9条route的参数键、材料role/media/trust/owner/顺序/基数、relation及result_contract逐项核对，未知、缺失、额外、重复、错序或错身份失败关闭。九专业使用完整冻结资料，商业零八字；图片原链、Website领域receipt、原effect/WAL、限流和来源seal/rejection/risk授权全部保持原合同。
3. route projection 与当前唯一 ASTRA task/result 提供方逐路由、参数、材料、关系及结果合同双向一致，旧业务路由与兼容投影为零。
4. 所有 AI 产品按 LAW-AGENT-PRODUCTION-RUNTIME-004-V1 验收接收完成边界；旧 base/Bazi/review admission 完成门退出 Runtime。
5. credential 失败类别分别得到稳定脱敏 typed code，且 claim/Provider mutation 增量为零。
6. Runtime-owned source 对 Product Plugin 的 direct/re-export/dynamic/side-effect import 为零；Product source 对 Runtime 私有 production module 的 import 为零；唯一 architecture-owned Catalog 与 Runtime Manifest publisher 只以冻结纯数据 route snapshot 连接，astra-agent.route-capability-manifest v2 只含 product/action 与 task/result contract version，跨仓及持久身份的 Product Plugin 名称、版本、Skill hash 字段为零。
7. Runtime 三表、精确列/主键/唯一索引/外键、WAL、integrity_check、foreign_key_check 和数据不变量可重复读回；`production_leases`、`production_gpt_consultations`、旧 `production_continuations` 与任何 GPT continuation store 均不存在；Browser WAL 不含 consultation identity、source task、continuation checkpoint 或 frontier，只保留执行 fence、effect terminal 与同-effect加密 locator；private base、reservation、fork、第二 lane/store 与 Product checkpoint 消费者为零；Runtime 普通启动迁移与删除增量为零。
8. authority 数据库缺失、不可读、损坏/查询异常、记录缺失、hash mismatch 分别可观察并失败关闭。
9. storage inventory 在未变数据上重复得到同一目录/字节分母；dry-run 写入、移动与删除增量为零。
10. Website Work Order 管理员清除必须先保护领域 admission receipt 精确闭合的完成成果，物理清除全部未完成子图；完成量为零时 Work Order 根同事务缺席，完成量大于零时只保留 paused Work Order 与完成闭包。AGENT 对已接受 job 的 Website absence 必须清除本地 task/Outbox/material/result/Browser WAL/Forensics，并逐 target 证明缺席和其它 job 保持不变。
11. durable accept 后进程重启先核旧结果/候选，再由 Website 原 claim 裁决当前授权。全历史零物理输入且原结果不可恢复时可签普通新 attempt，新 attempt 按当前 Product 身份重建 fresh/profile/model/menu/附件/Composer 等 target-local 准备，批准附件集合允许为空。provider_effect+DISPATCHED/CONFIRMED 等已可能输入事实优先保留原 effect 且 submit 增量为零，在任何准备动作前按精确 WAL 事实进入只读结果收敛；有界耗尽、Browser 已核完整 WAL effect 历史及现役有界 exact readback 或 typed unaddressable后，只有 Website 风险 grant 的新 revision/指定调用可一次可能重复输入。其它组合仅令当前危险 mutation 失败关闭并自动有界对账，不终止 demand。submit request hash 绑定当前 result revision 与 Child input hash；普通换 attempt 可使用当前 Prompt/hash，新风险 revision 由 Website 事件签发。
12. 当前完整结果只按 `job_id + attempt_id + result_hash` 经唯一 Outbox 幂等交付；回复不明按唯一接收法条查询原请求回执，不重做 Provider，第二 Outbox 或 delivery flusher 为零。`FROZEN-SAME-ATTEMPT-RESULT-REDELIVERY-001`：Outbox 同一交付身份不含 execution fence，fence 只是当次发送授权；同一 accepted attempt 经 Website 续发 grant 后，同键同内容的未送达写入以当前 fence 重授权并清除上一 lease 记录的失败后发送，已送达写入只返回原回执，已被 Website 作废（`WEBSITE_ATTEMPT_REPLACED`）的写入不复活，同键内容不同仍 `PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT` 失败关闭；同一 lease 内已记录的失败不重放。本条冻结；改变、删除、弱化或绕过须授权人明确原文“解冻 FROZEN-SAME-ATTEMPT-RESULT-REDELIVERY-001”，并同步替换双仓施工图、实现与唯一质检。
13. 接收前失败、失联、lease 失效与结果不明仍只产生 typed facts；Website 唯一选择未发送后的新 attempt、同 effect 只读收敛或原授权的新 result revision。旧 fence 的 renew、artifact、result、terminal、completion 全部被拒绝。
14. 单task损坏或orphan目录不污染其它task，不以目录计数阻原worker；共享Store结构坏及凭证无效仍停相应危险输入。
15. Runtime 生产文件遵守基础法案文件与函数预算，无 type-only Owner 环、Product object/callback 泄漏、Browser 私有 store import 或新增通用包装层。
16. Runtime Manifest 不取得相邻域或历史方案的 Manifest primary ownership；唯一一次原子归位不能产生无主或重叠 Manifest primary Owner；Runtime quality 只有一个 checker、proof route 与 verdict。
17. Runtime proof 只声明本域四种 dynamic mode；GPT、Browser、Runtime Log 的原生 proof 均可独立运行，Runtime 相邻 proof assertion 为零，任何未解耦 route 都阻断 RELEASE。
18. Runtime CHANGE/READY 不替 Website、Product、GPT、Browser 宣称业务完成；最终业务完成仍以 Website admission/storage 为准。
19. 各域现有唯一 inspector、acceptance 与适用 proof 分别覆盖本域 active law 的 summary、全部 forbidden 与全部 evidenceModes；Owner-bound import mutant 必须证明 Runtime→Plugin、Plugin→Runtime private 与旧 Catalog 豁免都会失败关闭，全部被替代路径的生产消费清零，不新增第二 checker、proof 或 verdict。
20. N=1..6下去重业务在途数不得超过 Website当前设备配置；每个 active execution或 admission pending job各占一个席位。AGENT 本地完成仅引用 LAW-AGENT-PRODUCTION-RUNTIME-004-V1，Website 业务容量仍按原领域事实计算，Browser Target 清理只作诊断且独立受 lane 安全门约束；Website 持久 WAIT_NEW_ATTEMPT 仅在旧 READY/Outbox/候选确证不可恢复、原证据交接完成后释放旧 attempt 席位；永久撤权或删除按原 Owner 精确清理。ACTIVE_ATTEMPT regrant不新增席位，CONSUME_CURRENT_RESULT继续占原席位，缩容不终止既有执行。任意时刻 Browser物理 lane与 active claim至多一个；每个正常观察请求首次/后续资格至少70秒；跨任务已具资格观察可连续串行，填写/上传/结算占用中不能抢占。八字另须证明 BZ05/BZ03/BZ04每个业务任务均 fresh且精确消费本轮Website父报告材料；同一SEO文章六个task按direct parent共享一个canonical conversation URL；固定catalog同cohort首任务fresh、后继及失败ID补译任务携已接纳直接前驱三元组并共享父WAL唯一URL；每job仍独占Target、一次submit，错误parent或篡改已采纳来源的product step须在Provider输入前失败。continuation controller/store/frontier/CAS、fork与private base为零。

付款 primary 的唯一公开输出请求来自 Website canonical route 的 `result_contract`，Product 原样投影到 Prompt，基础接收不复制其中枚举或领域拒收规则；付款领域 Consumer 在原 prepare 中机械校验该格式，原 no_payment_change 与同 client admission 保持。GPT acquisition/观察早退的真实调用身份复用原 childSpan 的 gpt-call typedIdentity（job/attempt/step/callId:Child），不增加 metadata。V6 的 Child 属于原 Browser fact：无 Browser effect 时 scope/Child/outcome/provider_effect_identity_hash 均为空，已有 effect 时其来源 Child 与 evidence 对始终优先，不能以当前 GPT 调用身份替代。历史 first fact 不回填。

恢复调度保持原worker/三表/Outbox：有限job快照单项远端失败保typed原因并继续其它项；cleanup只核自身Outbox且逐pending各一次，首项失败不饥饿后续；日志坏时已SENT/admitted只读确认仍完成，新claim/mutation/未发云写仍停止。N满仍走原independent recoverable入口接回samejob原seat，不增release API/状态/容量表。原sealed source时间不设滚动24小时下限，未来/倒序time仍拒，seal/body/hash不刷新。 限流有限批次只有单incident已记录typed失败可续下一项；共享401/403或raw立即外抛，不被更早firstFailure掩盖。worker在已有admission确认后核sink，坏sink本轮不进入尚未发送的恢复writer/claim，原finally清理保持。 单job隔离覆盖成功GET后的完整disposition、Target清理和admission读回；现有Runtime-owned限流port由Runtime唯一判局部故障，GPT仅调用。独立heartbeat和原WorkerSession在实际fetch前消费必填sink许可，坏sink拒未发云写、保原凭证与sequence；GET/已发响应及原精确session close清理继续，无绕过参数。

V6.46仅将同一协议容量支持上限扩到6；当前N仍由Website设备行独占。原executor、claim有界计算和batch去重直接使用同一支持常量；版本切换沿原draining、结果收尾和新session，不重新enrollment，不改变accepted attempt/WAL/Outbox。原3→4→3容量动态断言扩到3→6→3；真实N6证据缺失时不声明生产安全或RELEASE。

## W5：取消退役的唯一机械交接（2026-11-02授权施工）

V6 control provider/consumer固定为ASTRA独立初版1，当前 task/result v4、Capability provider v2 与 9 条现役路由保持。Website原T1 Owner决定退役、保护集合、T2与新G；AGENT仅消费当前exact签控制并保全/运输真实机械事实，不追读GPT答案，不裁业务风险。普通未取消需求的完整来源验证、Provider防重和风险授权不变。

完整Product输出先于首个结果JSON网络请求，由原Store在task-owned results/<既有attempt hash>/complete-output.json同步保全原JSON.stringify(payload) UTF-8文本、evidence_refs、generated-image typed receipts、原身份及execution_receipt_hash；SQLite immediate写锁内验当前attempt/未seal、fsync/rename/目录fsync/readback，seal同锁核原件。损坏或异身份保持局部unknown，不能误封口、覆盖或重做Provider。同attempt delivery_only只用该原件走原Outbox，不进入Product。candidate_hash沿既有execution_receipt_hash，不用envelope hash。

普通未取消恢复保留Runtime001既有的精确payload槽409来源：原Outbox reader核旧接纳receipt、不同新bytes的精确拒绝，新完整原件hash等于该冲突new_payload_hash，全部调用checkpoint均settled_reusable、无待交envelope/terminal且source携同一真实冲突，才在原封口事务内按原Website calls=[]链交接。文件/Outbox/receipt全部保留；已sealed当前attempt只运原seal，不同时作为delivery_candidate。cancel退役或原件损坏/未知仍无此例外，不新增恢复入口或Provider输入。

原worker对所有durable状态按job_id分页，单轮status GET至多32且不重复：完整输出优先至多6，余至少26公平轮转；单项失败推进游标。执行前沿原status及renew验证job/fence/control/单调epoch，renew当前时钟进入同一lease预算。认证typed AI_V6_JOB_NOT_FOUND/AI_PRODUCTION_JOB_NOT_FOUND才可清理；其它404/401/403/网络/坏JSON/foreign identity不授权。active内部只abort并退出；原worker捕获并等待原active Promise含finally/续租和Outbox尾部后，依Browser→Forensics→task目录→Store顺序清理并逐项缺席回读，Store最后保留中断接续依据。普通Ctrl+C不abort Product。

取消封口仅消费同job/attempt、当前control_epoch及reason_code=ADMIN_AI_WORK_ORDER_REPLACEMENT的cancel_requested。待交完整结果优先；原receiving完整结算的completed可封来源而不改result/status/receipt。全部call/effect身份和完整历史须保留，真实已有settled/rejection/risk/negative/unaddressable沿原事实运输；无已结算答案观察的effect用原readback_proofs.effects的unresolved分支、call disposition=unresolved。字段为原source_attempt_id/source_result_revision/effect_identity_hash/source_effect_set_hash/wal_authority_hash/anchor_state/anchor_proof_hash及公开Browser reader原state/mutationOutcome/physicalInputCount映射的wal_state/mutation_outcome/physical_input_count，并携本次WAL读取时刻observed_at及本次封口读取新增Provider输入provider_input_delta=0，不新增terminal_at。readback_exhaustion_hash仅真实exhausted子集，unknown不省略、不伪zero/耗尽。普通source/祖先/风险verifier仍拒绝unresolved及未issued退役seal；原T1 reader只验退役用途，删除其调用普通恢复verifySourceHandoff的耦合，完整事实进入原audit.source_evidence/sealed_lease，无新存储或恢复Owner。

已封存source与待交完整候选由原Store派生，按job_id环形每包合计至多6，二数组不重叠、同job完整结果优先；独立非持久运输游标在失败后也推进。旧source运输不依赖新生产Browser/executor/fresh slot/cooldown资格，仍核原session/attestation/ledger/日志。draining物理发送前核当前真实draining，只允许非空合法sealed source且delivery_candidates=[]的原claim，Website先接source后返回DRAINING零jobs，禁止新/恢复生产grant；关闭原有限pass仅纳入已观察取消/已seal来源，不无限等待未知T2。没有新API/ACK/表/队列/worker/状态机/兼容桥，Browser/GPT/专业Flow不改。未取得同版两仓原生质量及实际联验前不得启用或声称全状态删除闭环完成。

## 同一SEO文章获准修订的原会话定位

同一SEO文章已由Website授权的新result revision当前turn，Browser可从当前job既有WAL的全部可信CONFIRMED locator候选核出非空且唯一的canonical URL，经原confirmed-readback在该U重建当前准备并执行；这只确定执行位置，不复用旧正文、旧准备、旧输入授权或执行进度。指定effect必须沿原exact reader核验，缺失不得改选历史；未指定effect时不得取latest或第一条，缺失、损坏或URL冲突零危险输入失败关闭。旧unknown及无锚点事实原样保留，不视为零输入或可复用来源，也不成为其它精确effect或兄弟job的全局门。新Provider输入仍只取Website当前精确grant与Browser完整WAL防重裁决；其它产品的fresh、业务恢复唯一Owner及URL不跨仓不新持久化边界保持。

## 原回答空结束的五次机械重试

普通回答观察为零输入：保留exact job—system Target唯一绑定，40秒静默、GPT只给至少70秒eligibleAt，BrowserLaneCoordinator为唯一计时Owner，在唯一FIFO依原到期/取消及原lane空闲放行；不足70秒不acquire，填写/上传/结算不被抢占，不新增timer或账号随机等待。每轮先核同effect WAL，以confirmed-readback取当前Target并核current Document；canonical URL相同零导航，否则最多一次Browser-owned Page.navigate并经2500ms fresh readback，不回首页。文本以原Product marker唯一user及真实紧邻唯一assistant，图片沿原exact userTurnId。文本未挂载时只在原observation预算内按实时容器几何/进展物化、无固定步数，图片最多48步，均命令截止前3秒结束；命中立即原子读取，零CDP输入/点击/搜索/展开/WAL。stop存在不得按时长、空文本或deadline判停；观察使用原execution单调预算/abort，不保留20分钟空等或替代计时窗。五次耗尽proof唯一为gpt-stopped-empty-after-five-retries.v1，精确七顶层schema_version/original_effect_identity_hash/original_wal_authority_ref/original_wal_authority_hash/retries/terminal_observation_revision_hash/terminal_observed_at；retries恰好五项严格ordinal1..5，各含ordinal/effect_identity_hash/wal_authority_ref/wal_authority_hash/pre_empty_observation_revision_hash，effect互异、原Browser authority可验。retry i+1前置空观察结算i，最后空观察在原first fact；顶层failure为retry5真实CONFIRMED/confirmed/evidence。Website沿原job事务唯一rejection绑定terminal observation及整链，拒收集合仅为真实根submit+retry1..5六effect；rejected_call主项retry5，仅该情形附original_submit及prior_retries恰好ordinal1..4，各用原call/effect字段验同一receipt。其它历史逐项原证明，普通RESULT_SETTLED_UNUSABLE仍单effect。原Store/Outbox/source seal及accepted历史字节不迁移、不重签，不设第二reader/队列/表；历史已签原raw只经原seal及原first-fact绑定回读，不成为新current proof。本条已依用户本轮原文授权定点替换并重新冻结；未来改变仍须用户明确解冻并同步现役法案、施工图、合同、实现及唯一原生质检；普通修复或CI不隐含解冻。

# GrassEye 执法系统施工图

版本：2026-07-24
状态：active

## 统一身份与冻结边界

- 本文件是当前质检系统的建设级落地映射，不新增 lawId，不修改冻结法案。
- CI-FULL 是唯一完整质检入口。
- CI-FULL 只证明：当前真实代码是否符合当前法案文件和当前施工图。
- OWNER 只检查自己负责的真实代码。
- Code Purity 必须常开，覆盖 `src/**` 和 `scripts/**`。
- 除以上链路外，不允许恢复第二完整质检入口。

## 唯一链路

```txt
package.json ci:full
-> codex-entry-gate
-> law files
-> explicit clause bindings in owner manifests
-> blueprints
-> generated registry / matrix / plan
-> CI-FULL generated-plan runner
-> exact executed-check receipts
-> owner reports
-> typecheck
-> acceptance smoke
-> ci-full-summary
```

CI-FULL 是尺子，不是机器。它不制造问题，不修改文件，不证明自己聪明，只输出 PASS / FAIL / 问题清单。

当前唯一入口只存在于本地 `package.json`。`.github/workflows` 必须保持无 workflow 文件；在未来 active 法案和本施工图明确接纳 GitHub Actions 之前，任何 workflow 都按第二完整入口风险 FAIL。质检只核对该目录的文件系统事实，不解析 YAML 文本，不建立 workflow allowlist 或第二 registry。

二元裁决补充：运行态没有第三种颜色，不存在 warning pass、advisory pass、partial pass。
任一 owner report 只要发出 finding，执行态就是 FAIL。

## 主矩阵

`hybrid` 法条的 manifest binding 通过
`primaryEvidence: { engine, sourceEvidenceIndex }` 把唯一主裁引擎和实际可达的
`sourceEvidence` 绑定在一起；builder、generated plan 与 audit-system 元质检共同拒绝缺失或越界声明。

| 对象 | 当前路径 | 维护方式 |
| --- | --- | --- |
| law 文件 | `.github/instructions/agent-rules/modules` | 人工维护 |
| owner manifest | `scripts/audit/domains/<domain>/manifest.json` | 人工维护 |
| owner inspector | `scripts/audit/domains/<domain>/inspector.ts` | 人工维护 |
| artifact generator | `scripts/audit/build-audit-artifacts.ts` | 仅由 CI-FULL 第一阶段调用 |
| generated registry / matrix / plan / conflicts / coverage | `scripts/audit/generated/*.generated.*` | CI-FULL 生成 |
| generated-plan runner | `scripts/audit/core/run-generated-plan.ts` | CI-FULL 调用 |
| CI-FULL summary | `scripts/audit/generated/ci-full-summary.generated.json` | CI-FULL 生成 |

## CI-FULL 应该做

1. codex-entry-gate：先验证 law、audit、blueprint 入口可发现；`ci-full.ts` 的 `main()` 只允许在前面建立空执行账本、默认失败摘要状态与 fail-fast 闭包，第一项物理工作必须是通过真实 symbol 解析到 `runCommandStepOrFail(..., codexEntryGateStep, ...)` 的 entry gate。package acceptance 展开、generated authority 读取、审计或验收若出现在 entry gate 前都必须 FAIL。
2. build audit artifacts：读取法案、manifest、施工图，验证每条 active clause 的显式 `clauseId + checkIds + sourceEvidence` 绑定，生成 registry、matrix、plan、coverage。
3. run generated plan：只运行一次未过滤的完整 plan，按 executionGroup 调度 foundation、domain、meta inspectors。
4. 为每个 owner inspector 写入独立 report。
5. runner 为当前 owner 创建唯一 `InspectorCheckSession`；每个 owner 必须只有一个命名为 `inspectDomainEvaluation` 的完整 assertion-set 入口，且 `inspectDomain` 只能在一个 `checks.runAll()` 签名窗口内通过真实 symbol 恰好调用它一次；该命名入口本体返回的 findings 必须沿真实 source declaration/dataflow 追溯到 finding 构造、finding collection 写入或继续调用的真实 assertion，直接返回空 findings、任意 evidence、`Boolean(findings)` 等 declaration-file/decoy call 均须 FAIL；owner 目录内任意无关或 hollow helper 不得冒充完整 evaluation。runner 只为 manifest-owned `<capabilityDomain>/owner-assertion-set` 签发一份 `runId/checkRunId/status/durationMs/evidenceRefs/findingCount`。细粒度 finding ID 只负责定位失败，不是物理回执。
6. 校验每个物理 `checkRunId` 无缺失、无重复、无越权；同一 check 映射多个相关法条时复用同一个 `checkRunId`，不得复制执行或重复整域扫描。
7. generated coverage 对全部 active clauses 证明 100% 精确绑定；只对 `static` / `acceptance` 机器条款证明 executed，`real-chrome` 条款必须明确保持 deferred。
8. `InspectorCheckSession` 生成 owner report、runner 计算 expected mappings 时，都先排除 `evidenceMode=real-chrome`；不得把真实 Chrome 条款暂时写成 executed 后再在汇总层洗掉。
9. typecheck，物理步骤明确绑定 `APEX-CODE-PURITY-008-V1`，不得保留空 lawId。
10. 全部 `acceptance:*` package group（包括真实 Chrome 与真实 proof verifier）必须先递归展开成去重后的直接物理叶，并逐叶通过同一份显式 file-to-law binding 闭合；随后只按 rebuilt generated plan 中命中 clause 的 `evidenceMode` 分层：`static` / `acceptance` 进入 CI 并拥有独立 owner/deadline/时间/结果回执，`real-chrome` 明确 deferred。不得按脚本名、文件名、`real-proof` 字样或其他启发式提前排除，`&&` group 只可作为人工入口，不是 CI 执行单位。禁止从 owner `lawIds[0]` 批量抄写叶级 lawId。
11. 外部命令超时必须 `SIGTERM -> 等待 -> SIGKILL -> 等待完整进程组终止证明`，不得用 `unref` 清理定时器或只等 leader 退出；无法证明终态时必须记录 cleanup failure 并 fail closed，禁止声称已终止或继续下一步；generated-plan worker 超时也必须等待 `terminate()` 回执。
12. fail-fast summary 必须先收录本次真实失败步骤的完整 `FAIL` receipt，再把后续未启动步骤逐项登记为 `SKIPPED`；失败步骤不得从两本账同时消失。
13. owner inspector 与域内 helper 只返回 `reportJson/reportMarkdown` payload，不得调用 filesystem mutation API 或写 generated 文件；唯一 generated-plan runner 是 owner report 的唯一落盘者，旧私有 writer 与独立 inventory generated 文件必须物理删除，inventory 进入 owner report payload。
14. 需要验证 Downloads 交付的 acceptance 只能把 `tmpdir() -> mkdtemp()` 根目录派生出的本次临时交付目录注入现有生产函数；临时根和交付目录必须分别由全文件唯一 `const` declaration 持有，禁止嵌套同名 shadow 和重赋值。临时根创建后的下一条语句必须是包围全部交付调用和准备步骤的 `try`，同一个 `finally` 必须保证对同一个根执行 `rm(..., { recursive: true, force: true })`。元质检必须同时按 callee type 的 call-signature declaration 和 acceptance 对精确仓库模块的直接 named-import symbol 识别生产调用；用 `typeof realHandler` 标注的运行时 wrapper、re-export 或 decoy import 不得冒充真实生产导出。任何生产函数引用都只能充当直接 call callee，禁止 `.call/.apply/.bind`、高阶传递或 wrapper 逃逸。生产调用不得位于任意延后执行的函数作用域；唯一例外是由 `node:http` 精确 `createServer` 调用直接持有的内联 request callback，此时同一 outer try 内必须由唯一 `const server = createServer(...)` declaration 直接接收结果，其下一条语句必须是管理 server 使用期的 inner `try`，并在 inner `finally` 保证链中经 `server.listening` 守卫和 awaited `server.close(error => error ? reject(error) : resolve())` 关闭；空 Promise executor、未把 close callback 联结到同一 Promise 的 resolve/reject，或只调用 close 而无 completion 均不得算终态。无论 close 成功或失败，outer `finally` 仍必须到达 `rm`。通过变量 declaration 和真实 AST 包围关系证明数据流与控制流后，清理只能是无条件直接 `await rm`，或只经一条 `try -> finally` 保证链最终到达它；cleanup options 必须恰好只有 `recursive: true` 和 `force: true` 两项，边界后只允许固定 PASS 输出。不得用函数名文本、文件名后缀、任意同名 import、合法调用诱饵、任意后代 `finally`、条件分支、未调用函数、不可达语句、object spread、`Downloads` 字符串扫描或无关 `rm` 冒充证明。
15. 对上述隔离门保留反逃逸攻击：假清理、错误或条件式 `finally`、真实 home/Downloads 根、root shadow、root/delivery/server 的 `let` 重赋、server 未关闭、关闭不同 receiver、未等待 close completion、close Promise 未联结 resolve/reject、额外未证明 path segment、同文件名诱饵模块、typed runtime wrapper/re-export laundering、import alias 加本地 shadow callee、边界外 alias/namespace 真实调用、闭包 wrapper 在清理后执行、`.call/.apply/.bind`、高阶传递、`recursive:false`、`force:false`、后置 object spread 覆盖任一出现都必须 FAIL；这些 audit-system 攻击只归现有 `APEX-AUDIT-005-V1` acceptance 叶执行，不得塞入其他 owner/law 叶或新增第二 runner。媒体异步结果只保留 `downloadsPaths[]` 唯一交付真相，禁止恢复无独立法案和退休机制的 legacy `downloadsPath` 兼容字段。不得写操作者真实 `~/Downloads`，也不得让 CI 重跑累积测试产物。
15a. `createServer` callback 例外必须与同一文件内唯一受治理 `const server = createServer(...)` initializer 是同一个 CallExpression，第二个未治理 server 或诱饵 callback 不得借用另一份 server lifecycle 证明；close completion 使用的 `Promise` 必须解析到 TypeScript 全局 declaration，局部 `Promise` shadow 必须 FAIL。
15b. `media-processing-task-persistence` acceptance 只能创建一个全局临时根，四个子场景的数据目录、outside artifact 与注入的 delivery 目录都从该根派生；每个一跳 helper 调用必须把同一 root symbol 传入。唯一 `withServer` 必须把真实 route handler 绑定到唯一 `const server = createServer(...)`，并在紧邻的 `try/finally` 中以同一 server 的 `listening` guard 等待全局 Promise 包装的 error-aware close 完成；最终 outer `finally` 必须全文件唯一一次对同一根执行递归强制清理，清理后只能输出精确的 persistence acceptance PASS。删注入目录、任一 dataDir/outside artifact 脱根、增加第二 `mkdtemp`、使用 resolve-only close、删 listening guard、删 server close、重复/删除 root cleanup 或伪造终端表达式都必须 FAIL。
16. 输出 summary。

## CI-FULL 禁止做

- 手工维护 lawId 列表。
- 手工维护 owner 执行顺序真相。
- 绕过 generated plan 直接调用 owner inspector。
- 排除某个 owner 后再单独补跑。
- 接受缺失、重复、越权或 manifest 未声明的 executed-check receipt。
- 把普通 owner/acceptance receipt 当成 `real-chrome` 已执行证明。
- 为 K 个 check 重复执行 K 次整域 evaluation。
- 制造平行 audit 结论。
- 恢复第二完整质检入口。
- 在没有 active 权威接纳的情况下新增 `.github/workflows` workflow。

## OWNER 边界

### local-browser-session owner

```txt
scripts/audit/domains/local-browser-session/manifest.json
scripts/audit/domains/local-browser-session/inspector.ts
scripts/audit/domains/local-browser-session/inspector-old-path-zero.ts
```

该 owner 使用 ts-morph AST/symbol 执法三个 active Browser law：唯一 Controller、opaque target/document、四跳私有插件 transport、物理焦点与 OS 文件动作归零、Startup no-change，以及 active-tab/URL-first/first-page/AppleScript-JXA 页面旁路的物理归零。真实 Chrome 条款在 generated truth 中明确标记 deferred，不得用静态 PASS 冒充。

每个 OWNER 只允许：

- 读自己的 lawIds。
- 读自己的 manifest。
- 读自己的施工图。
- 检查自己负责的真实代码。
- 输出 PASS / FAIL 与失败原因。
- 通过 runner 注入的唯一 `checks.runAll()` 窗口一次执行完整 assertion set；manifest 每个 owner 只登记一个 `owner-assertion-set`，owner 无权自行构造 `executedChecks`，诊断 finding ID 无权进入物理回执。
- 只返回当前 session 的 `checks.output()`；旧 run、对象 spread/copy、空 evidence 和 plan-derived receipt 全部 fail closed。

每个 OWNER 禁止：

- 跑 CI-FULL。
- 跑其它 OWNER。
- 重建 generated artifacts。
- 修改文件。
- 建立第二套质检链。

## audit-system 边界

audit-system 只做最小连接检查：

- generated registry、matrix、plan、coverage 是否存在且非空。
- `package.json` 的 `ci:full` 是否先经过 `codex:entry-gate`。
- generated plan 是否唯一连接 capabilityDomain -> owner inspector。
- blueprint anchor 是否存在。
- runner 是否仍硬编码 law truth 或 owner ordering truth。
- code-purity report 是否在 audit-system 前已生成。
- `static-clause-coverage.generated.json` 是否证明 active clause 100% 已绑定、机器条款 100% 已执行，并把 real-Chrome 条款明确留在独立浏览器证据层。
- owner-boundary / zombie graph 是否把 import 与 re-export 一并纳入主裁。

audit-system 不证明业务 owner 的业务正确性，不恢复第二主链，不代替 code-purity 或能力域 owner。

## Code Purity 边界

- Code Purity 是 CI-FULL foundation-layer 常开检查。
- 扫描范围覆盖 `src/**` 和 `scripts/**`。
- 数字门是统一红线，不按文件角色区分 target / hard / disaster；任一红线超限即 FAIL。
- 当前数字红线：文件 500 行、函数 75 行、参数 7、return 8、嵌套 5、圈复杂度 16、await 10、import declarations 28、import sources 24、named exports 24、class/object members 30。
- `scripts/audit/**` 必须使用 ts-morph AST / symbol / anti-evasion 检查。
- zombie 检测必须 machine-blocking，至少覆盖 zombie-file、zombie-export、orphan top-level declaration、literal-dead branch。
- 活性必须从 lawful roots reachability 判定，不得把 zombie 文件的入边当作活性证明。
- 合法豁免只允许来自 `package.json` 脚本入口、generated-plan owner inspector 动态装载、或现役 law 明确授权的外部入口。
- 现役 law 授权的活性面只能由 apex-law `codePurityLiveness` 结构字段进入 generated law registry，再由 Code Purity 读取；inspector 源码不得保存第二份手工豁免表。
- 不允许按 `index.ts`、`contract.ts`、`schema.ts`、type-contract 等文件类别整类豁免。
- owner-boundary 检查必须覆盖 import、re-export、dynamic import、side-effect import；barrel laundering 视为同级违法。
- Code Purity 当前运行态只有 PASS / FAIL；不存在 warning inventory 作为第三态。
- 一条 code-purity finding 就是 FAIL；finding 里可以携带整改建议，但不会改变二元裁决。

## Code Purity 僵尸面深度执法链路

1. 收集 governed files。
2. 收集 lawful live entry surfaces。
3. 建立 AST module graph。
4. 建立 symbol usage graph。
5. 区分 type/runtime symbol。
6. 从 entrypoints 做 reachability。
7. 从 reachable graph 做 export live proof。
8. 检测 namespace property-level usage。
9. 检测 re-export barrel laundering。
10. 检测 orphan declarations。
11. 检测 const-folded dead branches。
12. 检测 commented-out executable code。
13. 检测 anti-evasion surfaces。
14. 输出 fail inventory。
15. 接入 ci-full。

补充约束：

- 正则不属于僵尸结构判断工具。
- 若某个活性无法通过 AST / symbol / manifest 证明，则必须 FAIL。
- namespace import 只能证明被访问 property 对应的 export 活；整文件豁免无效。
- re-export 或 barrel forwarding 本身不构成最终消费证明。
- dynamic import、side-effect import、manifest load、generated-plan owner load 只允许走显式 lawful entry manifest 或 owner contract。
- non-literal dynamic import 不是可接受柔性写法；在 governed source 中必须直接 FAIL。唯一例外是 generated-plan runner 中由 `planEntry.ownerInspectorPath` 经 `resolveFromRepo` 与 `pathToFileURL` 形成的 owner contract，且必须逐节点通过 AST 与 symbol 证明，不能按变量名或源码文字放行。
- side-effect import 不得作为隐形 keepalive 或 owner-boundary 逃逸边。
- commented-out old implementation 不是可接受备份；一旦能从 comment trivia 解析出可执行或声明结构，就必须 FAIL。

## READY 标准

- `package.json` 只公开 `ci:full` 作为完整质检入口。
- `package.json` 的 `ci:full` 必须显式先经过 `codex:entry-gate`。
- law -> manifest -> generated artifacts -> runner -> reports -> summary 一条链完成完整质检。
- active capabilityDomain 都有唯一 owner manifest 与 owner inspector。
- audit-system 只做最小连接检查。
- Code Purity 常开，并覆盖 `src/**` 和 `scripts/**`。
- `static-clause-coverage.generated.json` 对 active laws 保持 100%。
- Code Purity 对僵尸代码、僵尸文件、僵尸段落保持零容忍；任一 zombie finding 直接阻断 READY。
- 最终 summary 只回答：当前真实代码是否符合当前法案和当前施工图。

## CI 真绿硬边界链路

1. audit-system 负责 law / manifest / generated artifact / runner 主链完整性。
2. audit-truth 负责 owner inspector 的 AST-first 执法真值与 generated-plan owner coverage 真值。
3. code-purity 负责 active source 的结构真值。
4. runtime-truth 负责 completed evidence contract 真值。
5. ci-full-summary 只汇报已真实执行的步骤与结果，不制造第二真相。

补充要求：

- owner inspector 不使用 `context.project` 视为执法真值缺失。
- generated plan 漏接真实 owner inspector 视为 CI 真绿硬边界失效。
- 旧 summary、旧 report、旧 generated artifact 不得被当作当前 run 的通过证明。
- ci-full-summary 的每个 step 必须记录 `command`、`startedAt`、`endedAt`、`durationMs`，否则不构成当前 run 的可审计执行证据。

## Runtime Evidence Truth 链路

1. completed 结果必须由 runtime contract 本身携带证据字段，而不是依赖调用者脑补。
2. Deep Research completed 至少要绑定最终报告证据与 record hash 证据。
3. 若 schema / result contract 在结构上允许 completed 但没有证据字段，runtime-truth 必须直接 FAIL。

## Code Purity 生产级终局肃清链路

1. 文件级 reachability 只回答“文件有没有接上线”，不回答“文件里的每个声明是不是活着”。
2. declaration liveness 必须从 runtime-rooted / type-rooted roots 出发，而不是从“同文件有人提过它”出发。
3. exported bag / registry / handler map 的整体存活，不等于内部每个 property / entry 存活。
4. dynamic import、side-effect import、dynamic registry access 默认危险；没有 manifest 主权就直接 FAIL。
5. Code Purity 的 machine verdict 可以比法条文字更严；法条缺一句，不等于明显腐烂面就合法。

## Runtime-rooted Declaration Graph

1. lawful package entry、manifest entry、final live export consumer、lawful type consumer 才能成为 declaration roots。
2. 从 dead export 指向的 helper chain 不能反向证明 helper 活着。
3. reachable file 内部如果存在只在 dead internal chain 里互相引用的 declaration subgraph，必须照样 FAIL。
4. symbol resolution 一旦失效，不允许退回 identifier count 或 source text 搜索；结论只能是 liveness unproven。

## Registry/Object Bag Property-level Liveness

1. `handlers.newFlow` 只能证明 `newFlow` 活，不得顺带证明 `oldFlow` 也活。
2. `Object.keys/values/entries`、computed indexing、for-in、spread 等 bag-level 动态访问默认按 laundering 处理。
3. lawful dynamic registry consumer 必须同时绑定 consumer file、registry file、registry export，不能做宽泛豁免。
4. handler map、registry bag、普通 object bag 都属于 property-level liveness 主裁范围。

## Audit Truth 全链路覆盖

1. active law 没进入 generated registry / matrix / plan，不算执法成立。
2. owner inspector 不进入 runner、不写 report、不进 ci-full summary，都不算执行闭环。
3. 旧 summary、旧 report、旧 generated artifact 不能作为当前 run 的通过证据。
4. `scripts/audit/domains/**` 与 `scripts/audit/shared/**` 中的结构判断，不得靠 regex 或 `getText/getFullText + includes/match/search/test` 充当主裁。

## Physical Check Receipt Truth

1. `scripts/audit/core/run-generated-plan.ts` 是唯一 session 创建者和回执签发边界；owner 私有 runner 必须删除。
2. `InspectorContext.checks` 是强制依赖，不存在 optional、legacy output 或普通 `executedChecks` fallback。
3. manifest 是唯一物理 check binding 真相；每个 owner 只能登记 `<capabilityDomain>/owner-assertion-set`，不得再维护 `owned-check-ids` 第二列表，也不得把失败诊断类别复制为物理 check。
4. 每个当前 run 必须有唯一 `runId`；每个物理 check 必须有唯一 `checkRunId`、terminal status、duration、evidence refs 和 finding count。
5. 所有现役 owner 复用同一冻结候选的只读 AST/文件快照；每个 owner 只能在自己的 `checks.runAll()` 签名窗口内执行一次完整 assertion set，并且只获得一个独立 checkRunId。不得硬编码 owner 数量，不得为已删除栏目保留占位 owner，也不得为诊断类别签发回执或重复执行整域 evaluation。
6. `checks.run()` 循环、窗口外预计算后过滤、plan-derived receipt、缓存 verdict 再抄账、诊断类别冒充物理检查和空心 assertion set 必须物理删除；不得以兼容 API 保留。
7. 任何漏跑、重复跑、未声明 check、空心回调、跨 run 回执、复制/spread 输出、空 evidence、回执与 finding 不一致，均由 runner fail closed。
8. `audit-system` 使用 ts-morph AST/symbol 核对唯一 owner-assertion-set 身份、唯一 runAll 窗口、session output、唯一入口和旧 helper/API 复活；攻击样例由现有 `audit-truth-coverage` acceptance 执法。
9. `ci-full.ts` 对外部命令使用可终止进程组 deadline，对 generated-plan 使用可终止 worker deadline；`ci-full-phase-plan.ts` 只把与显式 law/clause binding 双向一一对应的当前直接叶送入 CI，owner 由该 clause 在 generated plan 中的唯一归属反解，summary 逐叶记录 owner、lawId、timeout 和 skipped 状态。

## Runtime Evidence Truth

1. completed 必须绑定 evidence chain，而不是只绑定状态名。
2. required raw response、parsed report、artifact/export 缺失时，completed 不成立。
3. 可容忍的缺失项必须写清 reason；没有 reason 的缺失不属于 lawful completion。

## PR Zombie Delta Gate

1. 新增 zombie finding、object bag dynamic usage、runtime evidence gap、audit uncovered law，都不能进入主线。
2. delta gate 负责挡新增垃圾，不负责豁免旧垃圾。
3. 主线允许修旧债，但不允许在修旧债时再引入新的死面或假绿链路。

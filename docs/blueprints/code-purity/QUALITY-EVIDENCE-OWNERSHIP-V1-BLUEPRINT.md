# Quality Evidence Ownership V1 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "quality-evidence-ownership-v1",
  "status": "active",
  "owner": "code-purity",
  "lawIds": [
    "LAW-CODE-PURITY-001-V6",
    "LAW-CODE-PURITY-002-V2",
    "LAW-CODE-PURITY-003-V3"
  ],
  "contractRefs": [],
  "dependencyEdges": [
    {"contractRef":null,"from":{"domain":"code-purity","repo":"local"},"to":{"domain":"agent-production-runtime","repo":"local"}},
    {"contractRef":null,"from":{"domain":"code-purity","repo":"local"},"to":{"domain":"app-shell-ui","repo":"local"}},
    {"contractRef":null,"from":{"domain":"code-purity","repo":"local"},"to":{"domain":"architecture-boundary","repo":"local"}},
    {"contractRef":null,"from":{"domain":"code-purity","repo":"local"},"to":{"domain":"capability-governance","repo":"local"}},
    {"contractRef":null,"from":{"domain":"code-purity","repo":"local"},"to":{"domain":"forensics-persistence-capability","repo":"local"}},
    {"contractRef":null,"from":{"domain":"code-purity","repo":"local"},"to":{"domain":"gpt","repo":"local"}},
    {"contractRef":null,"from":{"domain":"code-purity","repo":"local"},"to":{"domain":"local-app-shell","repo":"local"}},
    {"contractRef":null,"from":{"domain":"code-purity","repo":"local"},"to":{"domain":"local-browser-session","repo":"local"}},
    {"contractRef":null,"from":{"domain":"code-purity","repo":"local"},"to":{"domain":"runtime-log-spine","repo":"local"}},
    {"contractRef":null,"from":{"domain":"code-purity","repo":"local"},"to":{"domain":"startup-entrypoint","repo":"local"}},
    {"contractRef":null,"from":{"domain":"code-purity","repo":"local"},"to":{"domain":"system-security","repo":"local"}},
    {"contractRef":null,"from":{"domain":"code-purity","repo":"local"},"to":{"domain":"workbench-api-boundary","repo":"local"}}
  ],
  "prohibitedDependencyEdges": []
}
```

## 唯一终态拓扑

```text
active law + Manifest + active blueprint/spec
-> 唯一 generated law registry
-> 每个 Manifest primary Owner 的 inspector / Exam / Dynamic Proof 产生者
-> 生产者直接返回 lawId、evidenceMode、clauses、模式原生 refs、passed/findings
-> code-purity 共享 quality core 只校验分母、类型、非空性、候选身份与 outcome
-> 唯一逐法条 quality report
-> 唯一终态 verdict
```

Manifest primary Owner 只表示文件治理、结构检查与变更准入，不表示运行决策权。Product runtime authority 只属于对应 Product Plugin，决定该 Product 的 Prompt、模型、Child 顺序、分支、checkpoint、恢复与结果组装，不进入 Manifest、registry 或 quality core。`code-purity` 作为自身文件的 Manifest primary Owner，拥有共享合同、runner、registry builder 与最终分母校验，不取得其他 domain 生产路径或业务决策的主权。每个 domain 只修改自己 Manifest `ownedPaths` 命中的 inspector、Exam 和 Dynamic Proof 生产者。

## 模式原生证据

| evidenceMode | 生产者必须返回的事实 |
|---|---|
| `static.filesystem` | 存在、缺失、唯一性、物理行或查询范围 |
| `static.ast` | AST 节点类型、路径与稳定 selector |
| `static.types` | TypeChecker symbol/type relation 或当前 tsc diagnostic 回执 |
| `static.contract` | 已解析 contractId、version、字段与 selector |
| `static.dependency` | from/to module edge 或 symbol consumer edge |
| `static.config` | 已解析配置字段与 selector |
| `static.json` | JSON pointer 与 schema 结果 |
| `static.yaml` | YAML path 与 schema/值结果 |
| `exam.*` | 命令、用例、输入/seed、timeout 与输出 |
| `dynamic.*` | 真实 locator、观察值、native receipt 与当前 candidate 绑定 |

生产者只声明自己实际观察的 clauses。共享 quality core 只核对 required `lawId/evidenceMode`、clauses 并集、ref kind/非空性、finding/outcome 和候选身份；不给生产者补 clauses、locator 或 PASS。

## Product 验收聚合边界

`architecture-boundary` 是 `src/plugins/**`、薄 Mediator、与生产 import surface 分离的 Product 验收和精确关联项目文档的唯一 Manifest primary Owner；每个 Product Plugin 仍是自身唯一 Product runtime authority。唯一 `acceptance:architecture-boundary` 中央入口只能从现役 Catalog/Capability Manifest 与 `scripts/acceptance/product-plugins/**` 发现 Plugin/test identity、证明一一对应、执行测试并汇总 exit/result。

每个 Product 测试只保存自身 Prompt、Child 顺序、checkpoint、分支、恢复与 expected result 断言。中央入口不得手写 12 个 Plugin、13 个 primary product/action 或任一 Product expected Flow，不得建立跨 Product 业务 helper；`src/plugins/**` 不得 import `scripts/acceptance/**`。真正产品中性的测试原语只有在至少两个现役严格同义消费者存在时才可共享。

## Dynamic Proof 独立性

GPT、local-browser-session、runtime-log-spine 与 agent-production-runtime 的原生 proof 必须可分别独立启动，只声明自身 lawId，只读取自身持久真相或相邻域正式 typed receipt。proof 不得读取另一 proof 的 assertion，不得要求共享 Website job、Chrome journey 或时间线；不得建立 journey coordinator、proof bus、共享 scenario、共享 assertion map 或 proof adapter。事实恰好来自同一生产事件不构成 proof 间依赖合同。

## Manifest 原子归位

法案、Inspector、测试、proof 与混合文件拆分完成前，所有接收域和 Runtime 的 `ownedPaths` 保持原值。最终候选只允许一次原子修改：接收域增加精确路径、Runtime 同时删除越界路径、历史记录同时进入 `docs/history/**`，随后立即重建唯一 registry 并证明 `UNOWNED_PRODUCTION_FILE=0`、`MULTIPLE_PRIMARY_OWNERS=0` 与 Runtime manifest-owner-drift=0。不得先接收、先删除、建立临时第二 Manifest 或形成中间质量结论。

## 六个施工片区的唯一终态

1. **中央条款主权退役**：`quality-routes.ts` 只可保留 domain 到现役执行脚本的内部注册；逐 law/mode clause route、exact locator 与 `clausesForEvidenceMode` 中央分配必须物理删除。
2. **手工活性主权退役**：物理删除 `liveness-authority.json`、`zombie-exemption-manifest.ts`、`isLawful*` 和全部消费分支；Chrome entry、CLI、side-effect import、registry consumer 与 browser payload 只从原生 manifest/package/module/symbol/lookup 事实证明活性。
3. **模式虚标退役**：物理删除 `entire-governed-object`、`static.types -> ast` 替代、summary-only assertion 和 law-wide 共用 `passed`；每个 mode 独立观察、独立 refs、独立 passed/finding。
4. **结构红线内联深化**：`local-browser-session/inspector.ts` 按现有六个风险面在原 Manifest primary Owner 内拆分；`websocket-actor.ts` 只把 target-claim awaiter 与 diagnostics 移入同一 Manifest primary Owner 的精确模块。不新增 domain、Manifest、protocol、state、facade、wrapper 或 bridge。通用 import 红线仍为 28 个 declaration / 24 个 source；仅当现役合同不可分割地要求一份 25..28 Child 的单一穷举 handler registry 时，允许该精确文件最多 30/30。执法器必须从 AST 同时证明 exact `children/<id>/handler.js` 导入一对一、其它导入全为 type-only、唯一 exported object map 的 key/value 与 handler 导入完全相等；任一条件不成立即回到通用红线失败，不得藉此容纳第二表或流程。
5. **高影响差异检测垂直深化**：现有 CHANGE 门内的唯一 typed detector 精确识别 API、CLI、事件、队列、表、列、环境变量、依赖、监听器、外连主机、浏览器权限和跨仓合同，输出 category/path/selector；它不读取用户原始请求，不裁决授权。
6. **唯一 READY 门**：在本地 clean commit 上，只执行现有 `npm run quality:check -- READY`；READY 不要求真实浏览器发布身份，`dynamic.*` 只列为 deferred；不新增云端 workflow、第二 CI 入口或第二 verdict，自动事件不运行 RELEASE。

RELEASE participant 路径只能从现有通用 `GRASSEYE_PROVIDER_REPOSITORIES` canonical repo 映射取得；不得在 spec、registry、report、代码默认值或专用 env 中保留个人机器路径。任何中间候选不得合并到 main；只有同一 clean commit 的 READY 通过后，才可以显式 provider 映射运行 RELEASE。

## 不得恢复的旧主权

- 不得在 quality core 中保留或换名重建逐 `lawId + evidenceMode` clause route、exact locator table 或 audit plan。
- 不得保留或换名重建手工活性 allowlist、entrypoint authority 或 `isLawful*` 豁免链。
- 不得新增第二 quality 命令、第二 report、第二 verdict、兼容桥、dual-read/write 或 shadow path。
- 不得让 Static、Exam 或 Dynamic 互相代替；一个 mode 失败只能先击穿该 mode，再由唯一 quality core 汇总 law 与顶层 FAIL。

正文闭环：共享 quality core 的 Manifest primary Owner 是 `code-purity`；输入为 active law、Manifest、适用 blueprint/spec 与当前候选，输出为
逐 domain evidence 和唯一 report verdict。状态只持久化到 generated registry 与唯一 quality report，调用方向
固定为 authority -> registry -> inspector/proof -> quality core。失败恢复必须修复原证据产生域后全量重跑，安全
边界禁止第二报告、虚构 PASS 与模式冒充；验收必须证明分母漂移、错误 ref、僵尸链和第二入口均精确 FAIL。

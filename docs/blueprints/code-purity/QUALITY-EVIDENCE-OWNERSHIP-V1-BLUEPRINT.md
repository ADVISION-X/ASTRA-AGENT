# Quality Evidence Ownership V1 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "quality-evidence-ownership-v1",
  "status": "active",
  "owner": "code-purity",
  "lawIds": [
    "LAW-CODE-PURITY-001-V1",
    "LAW-CODE-PURITY-002-V1",
    "LAW-CODE-PURITY-003-V1"
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

## 唯一证据链与权属

```text
active law + Manifest + active blueprint/spec
-> 唯一 generated law registry
-> 各 Manifest primary Owner 的 inspector / Exam / Dynamic Proof
-> lawId、evidenceMode、实际 clauses、模式原生 refs、passed/findings
-> code-purity 共享 quality core 的分母、类型、非空性、候选与 outcome 校验
-> 唯一逐法条 quality report 与最终 verdict
```

Manifest primary Owner 只负责路径治理、结构检查与变更准入。Product Plugin 的 runtime authority 只拥有当前 Product 的静态 Flow、Prompt、模型与推理目标、Child 顺序、分支和结果组装；业务恢复与风险重放授权只属于 `Website.ai-acceptance`。Product 不拥有 checkpoint 存储、Provider session store 或恢复状态机。Browser 是 effect WAL 与 FIFO 的唯一 Owner，GPT 只提供当前 turn 和同 effect 读回原子能力；Runtime 只按 Website 的精确授权运输。

`code-purity` 拥有自身路径中的共享合同、runner、registry builder 与最终分母校验，不取得其他域的生产路径或业务决策。每个域只修改自己 Manifest `ownedPaths` 命中的 inspector、Exam 和 Dynamic Proof 生产者。

## 模式原生证据

| evidenceMode | 实际观察事实 |
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

生产者只返回实际观察的 clauses。共享 core 校验 required `lawId/evidenceMode`、clauses 并集、ref kind/非空性、finding/outcome 与候选身份，不补 clauses、locator 或 PASS。

## Product 验收边界

论文生产工厂由 S00 固定 Flow 单向调用 C01、S01—S10 独立执行单元。各单元正文必须进入其实际提示词；内部单元不登记为外部产品，不以目录数量冒充公开路由数量。旧 astra-research-project 十二正文先行例外已经退休，不新增内容豁免。代码活性按实际生产入口、调用图、符号消费者及执行验证认定；目录、测试或登记不能单独证明研究能力。

`architecture-boundary` 是 `src/plugins/**`、薄 Mediator、与生产 import surface 分离的 Product 验收和精确关联项目文档的唯一 Manifest primary Owner。中央 `acceptance:architecture-boundary` 只从现役 Catalog/Capability Manifest 和 `scripts/acceptance/product-plugins/**` 发现 Plugin/test identity、核对一一对应、运行并汇总结果。

各 Product 测试断言自己的 Prompt、Child 顺序、分支、Website 授权消费、同 effect 零 submit 读回与 expected result；测试不授予 Product 恢复或 checkpoint 主权。中央入口不得手写 Plugin、primary product/action 分母或 Product expected Flow，不建跨 Product 业务 helper；生产 Plugin 不得 import 验收实现。共享测试原语必须有至少两个现役严格同义消费者。

## Dynamic Proof 独立性

GPT、local-browser-session、runtime-log-spine、agent-production-runtime 的原生 proof 分别独立启动，只声明自身 lawId，只读自身持久事实或相邻域正式 typed receipt。不读取兄弟 proof 的 assertion，不要求共享 Website job、Chrome journey 或时间线，不建 coordinator、proof bus、共享 scenario/assertion map 或 adapter。同一生产事件不授予 proof 间依赖合同。

## 原子归位与六个施工片区

法案、Inspector、测试、proof 与混合文件拆分完成前，Manifest `ownedPaths` 保持原值。最终只做一次原子归位：接收域增加精确路径、Runtime 删除越界路径、历史进入 `docs/history/**`，随即重建唯一 registry，证明无无主、无多 Owner、无 Runtime manifest-owner-drift。不先接收、先删除或建立临时第二 Manifest。

1. `quality-routes.ts` 只登记域的现役内部执行脚本；逐 law/mode clause route、exact locator 和中央 `clausesForEvidenceMode` 物理退出。
2. `liveness-authority.json`、`zombie-exemption-manifest.ts`、`isLawful*` 及消费者物理退出。活性只来自原生 manifest/package/module/symbol/lookup 事实，不由手工豁免取得。
3. `entire-governed-object`、types 冒充 ast、summary-only assertion、law-wide 共用 passed 物理退出；每个 mode 独立观察、refs 与 finding。
4. local-browser-session 原 inspector 在自身 Owner 中按六个风险面拆分；websocket actor 的 target-claim awaiter 与 diagnostics 留在同一 Owner。通用 import 上限为 28 declaration/24 source。只有 AST 证明一份 25..28 Child 的不可分割穷举 registry、exact `children/<id>/handler.js` 一一对应、其他 import 全 type-only、唯一 exported object map 与 handler 完全相等时，该精确文件才适用 30/30；任何条件不满足立即回到通用红线。不新增域、Manifest、protocol、state、facade、wrapper 或 bridge。
5. CHANGE 内唯一 typed detector 检测 API、CLI、事件、队列、表、列、环境变量、依赖、监听器、外连主机、浏览器权限、跨仓合同，返回 category/path/selector；它不解释用户原话或裁决授权。
6. READY 只对本地 clean commit 运行 `npm run quality:check -- READY`；真实 Browser 发布身份不作为 READY 要求，dynamic 只 deferred，不建云端 workflow、第二入口或 verdict，自动事件不执行 RELEASE。

RELEASE participant 只从 `GRASSEYE_PROVIDER_REPOSITORIES` canonical 映射取得；spec、registry、report、代码默认值和专用 env 不保留个人路径。任何中间候选不得合并到 main；只有同一 clean commit 的 READY 通过后，才以显式 provider 映射执行 RELEASE。

## 验收与禁止面

共享 core 只接收各域原生证据，输入按 authority → registry → inspector/proof → core 流动。状态只在唯一 generated registry 和 quality report，不另存恢复结论。故障回到实际证据产生域修复后重跑。

中央逐法 clause/locator 表、手工活性 allowlist 或 alias 不得恢复；不得新增第二 quality 命令、report、verdict、兼容桥、双读写或 shadow。Static、Exam、Dynamic 不互代，任一必需 mode 失败必须汇总为 FAIL。治理反例必须证明分母漂移、错误 ref、僵尸链和第二入口精确失败，不能固定 PASS。

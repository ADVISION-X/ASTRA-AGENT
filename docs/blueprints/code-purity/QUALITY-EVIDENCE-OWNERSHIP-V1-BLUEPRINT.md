# Quality Evidence Ownership V1 施工图

```blueprint-record
{
  "schemaVersion": 1,
  "blueprintId": "quality-evidence-ownership-v1",
  "status": "active",
  "owner": "code-purity",
  "lawIds": [
    "LAW-CODE-PURITY-002-V2",
    "LAW-CODE-PURITY-003-V2"
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
-> 每个 primary Owner 的 inspector / Exam / Dynamic Proof 产生者
-> 生产者直接返回 lawId、evidenceMode、clauses、模式原生 refs、passed/findings
-> code-purity 共享 quality core 只校验分母、类型、非空性、候选身份与 outcome
-> 唯一逐法条 quality report
-> 唯一终态 verdict
```

`code-purity` 拥有共享合同、runner、registry builder 与最终分母校验，不取得其他 domain 生产路径的写主权。每个 domain 只修改自己 Manifest `ownedPaths` 命中的 inspector、Exam 和 Dynamic Proof 生产者。

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

## 六个施工片区的唯一终态

1. **中央条款主权退役**：`quality-routes.ts` 只可保留 domain 到现役执行脚本的内部注册；逐 law/mode clause route、exact locator 与 `clausesForEvidenceMode` 中央分配必须物理删除。
2. **手工活性主权退役**：物理删除 `liveness-authority.json`、`zombie-exemption-manifest.ts`、`isLawful*` 和全部消费分支；Chrome entry、CLI、side-effect import、registry consumer 与 browser payload 只从原生 manifest/package/module/symbol/lookup 事实证明活性。
3. **模式虚标退役**：物理删除 `entire-governed-object`、`static.types -> ast` 替代、summary-only assertion 和 law-wide 共用 `passed`；每个 mode 独立观察、独立 refs、独立 passed/finding。
4. **结构红线内联深化**：`local-browser-session/inspector.ts` 按现有六个风险面在原 Owner 内拆分；`websocket-actor.ts` 只把 target-claim awaiter 与 diagnostics 移入同 Owner 精确模块。不新增 domain、Owner、protocol、state、facade、wrapper 或 bridge。
5. **高影响差异检测垂直深化**：现有 CHANGE 门内的唯一 typed detector 精确识别 API、CLI、事件、队列、表、列、环境变量、依赖、监听器、外连主机、浏览器权限和跨仓合同，输出 category/path/selector；它不读取用户原始请求，不裁决授权。
6. **唯一 READY 门**：在本地高配置、具备真实浏览器发布身份的 clean commit 上，只执行现有 `npm run quality:check -- READY`；不新增云端 workflow、第二 CI 入口或第二 verdict，自动事件不运行 RELEASE。

RELEASE participant 路径只能从现有通用 `GRASSEYE_PROVIDER_REPOSITORIES` canonical repo 映射取得；不得在 spec、registry、report、代码默认值或专用 env 中保留个人机器路径。任何中间候选不得合并到 main；只有同一 clean commit 的 READY 通过后，才可以显式 provider 映射运行 RELEASE。

## 不得恢复的旧主权

- 不得在 quality core 中保留或换名重建逐 `lawId + evidenceMode` clause route、exact locator table 或 audit plan。
- 不得保留或换名重建手工活性 allowlist、entrypoint authority 或 `isLawful*` 豁免链。
- 不得新增第二 quality 命令、第二 report、第二 verdict、兼容桥、dual-read/write 或 shadow path。
- 不得让 Static、Exam 或 Dynamic 互相代替；一个 mode 失败只能先击穿该 mode，再由唯一 quality core 汇总 law 与顶层 FAIL。

正文闭环：终态 Owner 是 `code-purity`；输入为 active law、Manifest、适用 blueprint/spec 与当前候选，输出为
逐 Owner evidence 和唯一 report verdict。状态只持久化到 generated registry 与唯一 quality report，调用方向
固定为 authority -> registry -> inspector/proof -> quality core。失败恢复必须修复原 Owner 后全量重跑，安全
边界禁止第二报告、虚构 PASS 与模式冒充；验收必须证明分母漂移、错误 ref、僵尸链和第二入口均精确 FAIL。

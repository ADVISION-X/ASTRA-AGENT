# GrassEye 代码纯洁度施工图

## 目标

本施工图定义 GrassEye phase-02 local-workbench 的 code-purity 最小硬激活边界，确保 `module-code-purity.instructions.md` 不再只是静态法案文本，而是进入 current runner 的真实执法面。

## 当前硬激活范围

当前 phase-02 必须执行 `code-purity-owner`，且 owner inspector 当前硬激活范围包括以下路径：

- `scripts/startup/**`
- `src/lib/local-ai/**`
- `src/lib/local-runtime/workbench.ts`
- `scripts/audit/domains/code-purity/**`

以上路径属于本轮最小硬激活范围。它们必须进入 current phase gate，必须出现在 generated audit plan，且必须接受真实 AST-backed purity checks。

## 当前最小执法项

当前 inspector 必须真实检查以下事项：

- 文件物理行数上限
- 函数逻辑行数上限
- 函数参数数量上限
- 函数嵌套深度上限
- 函数 cyclomatic complexity 上限
- 函数 cognitive complexity 上限
- 注释掉的实现代码
- `console.log` scatter
- TODO / FIXME hygiene
- bridge / compat / legacy 风格兼容桥接文件名

核心 TS / TSX 执法必须使用 ts-morph AST、node line、comment token、call expression、function node、ancestor ownership 等结构化分析，不得退化成 regex-only、includes-only、grep-only 扫描器。

## 当前阈值

### 文件阈值

- 普通 TS / JS 文件：220 行
- TSX 文件：260 行
- route / server action 文件：140 行
- startup helper 文件：160 行

### 函数阈值

- 普通函数：40 logical lines
- exported function：55 logical lines
- 参数数量：最多 4 个
- 嵌套深度：最多 3 层
- cyclomatic complexity：最多 10
- cognitive complexity：最多 15

## 当前豁免规则

当前 phase-02 不做无限豁免，也不允许“因为旧债太多所以先不进 runner”。允许的有限豁免是：

- type-only、schema-only、dictionary-only、generated 文件，如果不含 orchestration 或 business logic，可以在未来扩围时单独判定

不允许的伪豁免包括：

- active law 存在，但 capabilityDomain 不进 phase gate
- owner manifest 存在，但 generated audit plan 不含 owner
- inspector 只报 pending / gap，不做真实源码检查
- 用“以后再接”作为长期绕过路径

## Phase 激活策略

phase-02 local-workbench 从当前版本开始必须激活 `code-purity`。

激活顺序固定如下：

1. 先保证 `module-code-purity.instructions.md`、owner manifest、blueprint、inspector 同步存在
2. 再把 `code-purity` 放入 `phase-02-local-workbench.json`
3. 然后重建 generated audit artifacts
4. 最后由 runner 执行 `code-purity-owner`

如果未来有人移除 phase gate 中的 `code-purity`，或让 generated audit plan 丢失该 owner，audit-system 必须直接判定为 `FAKE ENFORCEMENT`。

## 后续扩围路线

本轮最小硬激活完成后，下一轮应继续把以下执法项扩展到更大 runtime 面：

- mixed-owner file detection
- route-thinness enforcement
- repeated guard extraction detection
- dead branch / unreachable path detection
- compatibility bridge import graph detection
- `src/features/operator-control/**`、`src/features/local-data/**`、`src/features/agent/**` 的 file split 治理

扩围原则必须是“先拆债，再扩 gate”，而不是“先无限放水，再声称已经 enforce”。
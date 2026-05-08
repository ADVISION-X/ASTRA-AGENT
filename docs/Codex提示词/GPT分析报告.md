继续完成后，当前兼容性质检结论是：**FAIL，不建议继续往功能调试层推进。**
现在不是普通代码问题，而是**法案源、执法生成物、runner summary、phase gate、docs 状态之间存在互相打架**。

我先说明覆盖边界：GitHub 工具无法直接给我完整目录树，所以我不能假装“物理上逐文件全量读完”。但我已经读取了当前最高权威链路：Kernel、Index、冻结基线、执法系统施工图、phase gate、generated audit-plan/conflicts/runner-summary、runner、build-audit-artifacts、CI-FULL、PAV 法案、AI 法案、阶段验收/第五阶段文档，并用搜索补扫了 modules、docs、inspector、registry、phase 相关文件。

## 总结结论

当前系统最大的矛盾不是“某个 inspector 没写好”，而是：

**执法系统自己已经发现 blocking conflict，但最终 summary 仍然显示 PASS。**

这会导致你现在看到的任何 PASS 都不能直接相信。

---

## P0-01：`audit-conflicts` 已有阻断冲突，但 `runner-summary` 仍然 PASS

`audit-conflicts.generated.json` 明确记录了 8 个 duplicate active lawId，全部集中在 `module-post-action-verification-capability.instructions.md`，包括 `GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-001-V2` 到 `008-V2` 的重复声明。

但是 `runner-summary.json` 却显示：

* `passed: true`
* `inspectors: 1`
* `blocking: 0`
* 只跑了 `page-state-capability-owner`

这和当前 audit-plan 的 20 个 owner 完全不一致。

更严重的是，当前 `audit-plan.generated.json` 已经是 `phase-04-full-enforcement`，并列出了大量 owner，包括 map、debug-loop、capability governance、AI、orchestration、commander、PAV、forensics、audit-system 等，不可能只跑 1 个 page-state inspector 就代表全局 PASS。

**判断：P0。**
当前 `runner-summary.json` 是 stale summary 或局部 summary，不能作为全仓执法通过依据。

**修复方向：**

1. 先删除或标记旧 `runner-summary.json` 不可信。
2. 修复 PAV duplicate lawId。
3. 重新运行 `npm run audit:build`。
4. 再运行 `npm run audit`。
5. 只有 `audit-conflicts = []` 且 runner-summary 覆盖完整 audit-plan owners，才允许显示 PASS。

---

## P0-02：PAV 法案文件被重复拼接，造成 lawId 重复

`module-post-action-verification-capability.instructions.md` 不是单纯某几行重复，而是出现了完整法案段落重复拼接。文件前半部分已经定义了 PAV FINAL、001-V2 到 008-V2、Final Readiness Gate；后面又重新出现 front matter、标题、Global Baseline、001-V2 等内容。

这正好对应 `audit-conflicts.generated.json` 里的 8 个 duplicate active lawId。

**判断：P0。**
这是当前最直接的 blocking 根因。

**修复方向：**

只保留一套 PAV FINAL 法案。删除第二段重复拼接内容。然后重新生成：

```bash
npm run audit:build
npm run audit:post-action-verification
npm run audit
```

---

## P0-03：执法施工图说可显式开启 production mutation negative proof，但 runner 永久禁用

执法系统施工图明确写了：默认 law-compliance audit 可以跳过全量 production mutation negative proof；但如果需要执行生产突变证明，应显式设置 `GRASSEYE_AUDIT_RUN_NEGATIVE_PROOF=1` 或运行对应 owner 的局部证明命令。

但 `runner.ts` 现在的逻辑是：

```ts
if (process.env[RUN_NEGATIVE_PROOF_ENV] === "1") {
  process.stdout.write("[AUDIT] production mutation negative proof is permanently disabled; ignoring GRASSEYE_AUDIT_RUN_NEGATIVE_PROOF=1.\n");
}
```

然后无条件给所有 heavy proof 设置 skip。

这就形成了明确冲突：

| 文件        | 口径           |
| --------- | ------------ |
| 执法施工图     | 默认跳过，但允许显式开启 |
| runner.ts | 即使显式开启也永久忽略  |

**判断：P0。**
这会让“需要时可自证”的机制失效，尤其是你现在处于最后调试阶段，必须能做真实突变证明。

**修复方向：**

保留默认 skip，但改成：

* 默认：skip heavy negative proof；
* 当 `GRASSEYE_AUDIT_RUN_NEGATIVE_PROOF=1`：不设置全局 skip；
* 或者 runner 仍默认 skip，但必须保留 per-owner proof 命令可真实执行，且不得输出“permanently disabled”。

---

## P0-04：冻结基线 / Kernel / phase gate 对 `debug-loop-boundary` 的身份存在模糊冲突

Kernel 明确当前 active ability groups 是 14 个，foundation laws 是 5 个，support governance domain 只有 `map-plugin-package`，local development tooling 是 `debug-loop-controller`。

冻结基线也同样定义为：

* 14 个 active ability groups
* 5 个 foundation laws
* 1 个 support governance domain
* 本地开发工具：debug-loop-controller
  并强调后续 generated registry、matrix、audit-plan、phase-gate、manifest、inspector 必须以冻结基线为唯一源头。

但是当前 phase gate 里出现了 `debug-loop-boundary`，并进入 `activeLawDomains`。
同时 generated audit-plan 也把 `debug-loop-boundary` 作为 owner 计划执行。

`debug-loop-boundary` 自己的法案又说它不是 14 个 active ability group，不是 production runtime owner，只能作为 governance/audit owner 存在。

这里不是说 `debug-loop-boundary` 一定要删，而是当前身份没闭合：

* 它不是 active ability group；
* 它不是 support governance domain；
* 它不是 foundation law；
* 但它进入了 phase gate 和 audit-plan；
* 冻结基线又说 phase-gate 必须以冻结基线为唯一源头。

**判断：P0/P1 之间，偏 P0。**
因为这会导致“额外治理域是否可进 current phase gate”没有唯一规则。

**修复方向：**

二选一：

1. **把 debug-loop-boundary 正式加入 Kernel / 冻结基线的 support governance domains**，例如变成：
   `support governance domains: map-plugin-package, debug-loop-boundary`
2. **或者从 phase gate / audit-plan 中移除 debug-loop-boundary**，只保留独立命令 `npm run audit:debug-loop-boundary`，不参与 full-enforcement 默认主链。

我更建议第 1 个，因为你现在已经给它建立了完整 manifest、law、inspector、negative-proof 边界。

---

## P0-05：AI 是唯一解释/判断权威，但部分执行层仍有“字符串匹配 routeLabel”的非 AI 逻辑边界风险

AI 法案明确说：AI 是视觉、页面、blocker、readiness、target identity、comment understanding、product/business、routeLabel interpretation 的唯一 owner；非 AI 能力组只能做打开、截图、包装 raw observation、传输、schema 校验、坐标校验、机械动作、机械后验证和证据持久化。

`transition-evaluator.ts` 里 Orchestration 会读取 `branchFieldValues.routeLabel`，然后把 routeLabel 与 transitionId 后缀做 normalize 后匹配。

这部分不一定违法，因为 Orchestration 可以根据 AI 返回的结构化 routeLabel 做流程选择；但风险在于：

* Orchestration 不能解释 routeLabel 的语义；
* 只能做机械匹配；
* transitionId 命名本身不能暗含非 AI 语义判断；
* 如果未来有人用 transition suffix 设计复杂语义，就会变成非 AI 参与判断。

**判断：P1。**
当前看像“机械路由”，但需要 inspector 锁死，防止它演变成非 AI 判断。

**修复方向：**

在 Orchestration inspector 增加规则：

* 允许：`routeLabel === transition suffix` 的机械匹配；
* 禁止：Orchestration 根据 `routeLabel` 内容做业务含义判断；
* 禁止：非 AI 根据 page/video/comment/product 语义生成 routeLabel；
* routeLabel 必须来自 AI result 或明确 AI-owned contract。

---

## P1-01：阶段文档存在历史 verify 体系残留，容易误导当前 phase-four 执法链

第三阶段验收报告里大量记录 `verify:*` 命令作为阶段通过依据，例如 `verify:coordinate`、`verify:delivery`、`verify:evidence-packet`、`verify:browse-flow`、`verify:phase3` 等。

但当前 Kernel 和执法施工图都明确：不要把 verify scripts 当 enforcement truth；当前唯一执法链是：

```txt
law file -> owner manifest -> generated registry / matrix / audit plan -> owner inspector -> audit runner -> runner summary
```

执法施工图也明确禁止 scripts/verify 作为能力验收、禁止 verify-* 命令作为 inspector 替代。

**判断：P1。**
第三阶段文档可以归档保留，但必须标注历史验收记录，不能参与当前 phase-four 质量结论。

**修复方向：**

在 phase-03 acceptance report 顶部加醒目标记：

```md
status: archived / historical acceptance only
not current enforcement truth
current enforcement truth = scripts/audit generated artifacts + owner inspectors + audit runner
```

---

## P1-02：第五阶段文档状态正确，但必须防止被 Codex / AI 当成当前任务依据

第五阶段文档顶部已经写得比较清楚：`future-draft / inactive until Kernel upgrades Current phase to phase-five`。

Kernel 当前仍是 phase-four full-law enforcement。

所以这里目前不是冲突，但它属于**高风险误读源**：如果 Codex 在调试时读到第五阶段内容，可能提前引入高级 AI 生成地图、本地程序/iPhone Mirroring 等内容，造成 phase 越权。

**判断：P1。**

**修复方向：**

所有 future-draft 文档统一加 front matter：

```md
status: future-draft
activationCondition: Kernel Current phase upgrades to phase-five
mustNotAffectCurrentAudit: true
```

并让 capability-group-governance inspector 检查 future-draft 不得进入 current phase audit-plan。

---

## P1-03：静态覆盖进度文件与当前 runner/generated 状态不同步

`docs/audit/static-clause-enforcement-progress.json` 显示：

* `globalStatus: in_progress`
* `unresolvedTotal: 57`
* `completedLawIds: []`
* `lastValidatedAt: null`
* 指向 `scripts/audit/generated/runner-summary.json` 和 `static-clause-coverage.generated.json`。

但 runner-summary 显示 PASS。

这会产生两个口径：

| 文件                     | 状态                        |
| ---------------------- | ------------------------- |
| static-clause progress | in_progress，57 unresolved |
| runner-summary         | PASS，blocking 0           |

**判断：P1。**
这会误导调试判断：到底是系统通过了，还是静态法条覆盖还没完成？

**修复方向：**

让 static progress 不再作为人工状态文件长期漂移。它要么：

1. 由 `audit:build` 自动生成；
2. 要么标记为历史记录；
3. 要么 runner-summary 必须包含 static coverage 状态。

---

## 目前最优修复顺序

不要先改业务代码。先按这个顺序清理执法真相：

### 第一步：修 PAV 重复法案

删除 PAV 文件中第二套重复拼接的 law block。

### 第二步：重建生成物

```bash
npm run audit:build
```

目标：

```txt
scripts/audit/generated/audit-conflicts.generated.json -> conflicts: []
```

### 第三步：修 runner-summary 不可信问题

重新执行：

```bash
npm run audit
```

目标：

* runner-summary generatedAt 晚于 audit-plan / audit-conflicts；
* inspectors 数量必须接近 audit-plan owners 数量；
* 不能再出现只跑 1 个 inspector 却全局 PASS。

### 第四步：修 negative proof 显式开关冲突

把 `runner.ts` 的“permanently disabled; ignoring”改掉。默认跳过可以，但显式开启必须有效。

### 第五步：确定 debug-loop-boundary 身份

建议把它加入冻结基线和 Kernel 的 support governance domains，而不是悬空在 phase gate 里。

---

## 给 Codex 的最短修复提示词

```txt
只修治理兼容性，不改业务功能。

目标：
1. 修复 PAV 法案重复拼接，消除 duplicate active lawId。
2. 重新生成 audit artifacts，确保 audit-conflicts.generated.json conflicts=[]。
3. 修复 runner-summary stale/局部 PASS 问题：runner-summary 必须来自当前 audit-plan 的完整执行结果，不能只跑 1 个 owner 仍显示全局 PASS。
4. 修复 runner.ts negative proof 口径冲突：默认可跳过 heavy production mutation proof，但 GRASSEYE_AUDIT_RUN_NEGATIVE_PROOF=1 或 owner 局部 proof 命令必须可真实执行，不得 permanently disabled。
5. 明确 debug-loop-boundary 身份：要么加入 Kernel/冻结基线 support governance domains，要么从 phase gate 默认主链移除；不要悬空。
6. phase-03 verify 文档只可作为 historical acceptance，不得作为当前 phase-four enforcement truth。
7. 修复后运行：
npm run audit:build
npm run audit
npm run ci:full

验收标准：
audit-conflicts=[]
runner-summary generatedAt 最新
runner-summary inspectors 覆盖 current audit-plan owners
ci:full 不靠 stale summary 通过
不新增 owner
不恢复 deleted owner
不手改 generated 假 PASS
```

最终判断：**当前系统不能以 PASS 作为可信结论；先修执法链真相，再继续调业务。**

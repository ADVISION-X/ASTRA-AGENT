# GrassEye Code Purity 僵尸零容忍施工图

版本：2026-05-22
状态：active

## 目标

- 本施工图把 code-purity 的僵尸治理提升到 99/100 严苛度。
- active source 里不允许保留“以后可能用”的文件、导出、顶层声明或硬编码死分支。
- zombie finding 一旦出现，CI-FULL 必须给出 `FAIL`。
- 数字执法只作为最后一道体积红线；owner、boundary、zombie、fake runtime、AI planner、generated truth、runtime log spine 仍然一票否决。

## 数字红线

Code Purity 的数字门只允许二元裁决：

```txt
PASS = 不超过红线
FAIL = 超过红线
```

不得恢复 target / hard / disaster 梯次。
不得输出 warning、partial pass、soft pass、remediation-only 或 pass-with-findings。

当前红线：

| 指标 | 红线 |
| --- | ---: |
| active executable source file physical lines | 500 |
| function physical lines | 75 |
| function parameters | 7 |
| function return branches | 8 |
| function nesting depth | 5 |
| function cyclomatic complexity | 16 |
| function await points | 10 |
| import declarations | 28 |
| import sources | 24 |
| named exports | 24 |
| class/object total members | 30 |

500 行以内的文件如果破坏 owner、boundary、zombie、fake runtime、AI planner、generated truth 或 runtime log spine，仍然必须 FAIL。
超过 500 行的文件 FAIL 的原因是它已经大到不适合 Codex 安全编辑，而不是因为行数可以替代结构法案。

## 僵尸定义

当前现役 zombie 分四类：

1. zombie-file：活跃源码文件不从任何合法 live entry surface reachable。
2. zombie-export：导出面没有任何现役 importer 或 lawful namespace consumer。
3. zombie-top-level-declaration：未导出的顶层声明在同文件内没有任何活跃标识符使用。
4. zombie-dead-branch：`if`、`else`、三元表达式、`while`、`for` 的分支被字面量布尔值硬编码成永不执行。

## 合法存活证明

一个 surface 只有在以下任一证据成立时才算活：

- 从 `package.json` 脚本入口、generated-plan owner inspector 动态入口、或 law 明确授权的外部入口出发，经现役源码 import / re-export reachability 图可达。
- 被 `package.json` 的现役脚本入口直接启动。
- 被 generated audit plan 动态装载为 owner inspector。
- 导出面被 reachable importer 的 namespace import 合法消费。
- 被现役 law 明确授权为外部入口面。

来自 zombie 文件的入边不算活性证明。
`index.ts`、`contract.ts`、`schema.ts`、type-contract 不是天然豁免。

不在以上清单里的“先留着”“备份一下”“以后可能回滚”都算 zombie 候选。

## 执法形态

code-purity inspector 必须：

1. 收集 active source。
2. 构建以合法根为起点的 import / re-export reachability 图。
3. 提取 package script entrypoints、generated-plan owner exemptions、以及 law 明示的动态 export 豁免。
4. 产出 zombie-file / zombie-export / zombie-top-level-declaration / zombie-dead-branch findings。
5. 把整改动作写入 code-purity inventory，并保持执行态二元裁决。

## 豁免边界

- 豁免必须由 law、package script、或 generated plan 给出。
- 不允许手工白名单文件。
- 不允许按 `index.ts`、`contract.ts`、`schema.ts`、type-contract 等文件类别整类豁免。
- 合法入口文件里未被消费的 export 仍然是 zombie-export，除非该动态 export 合同被 generated plan 或 law 明示。
- 不允许临时跳过某个 zombie check 让 CI 先绿。
- 不允许以 wrapper、facade、bridge、注释掉旧逻辑的方式假装“已删除”。

## 证据要求

每条 zombie finding 至少包含：

- filePath
- owner
- role
- reason
- remediation
- verification command

## READY 标准

- `npm run ci:full` 下 zero zombie findings。
- 没有任何 active file 只能解释为“历史残留”。
- 没有任何 export 只能解释为“备用 API”。
- 没有任何 dead branch 只能解释为“未来开关”。
- 僵尸清理必须优先删除，而不是隐藏。

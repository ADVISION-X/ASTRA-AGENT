# GrassEye Code Purity 僵尸零容忍施工图

版本：2026-05-22
状态：active

## 目标

- 本施工图把 code-purity 的僵尸治理提升到 99/100 严苛度。
- active source 里不允许保留“以后可能用”的文件、导出、顶层声明或硬编码死分支。
- zombie finding 一旦出现，CI-FULL 必须给出 `FAIL`。

## 僵尸定义

当前现役 zombie 分四类：

1. zombie-file：活跃源码文件没有任何合法入边，也不是合法入口。
2. zombie-export：导出面没有任何现役 importer 或 lawful namespace consumer。
3. zombie-top-level-declaration：未导出的顶层声明在同文件内没有任何活跃标识符使用。
4. zombie-dead-branch：`if`、`else`、三元表达式、`while`、`for` 的分支被字面量布尔值硬编码成永不执行。

## 合法存活证明

一个 surface 只有在以下任一证据成立时才算活：

- 被 `src/**` 或 `scripts/**` 的现役源码静态 import / re-export 引用。
- 被 `package.json` 的现役脚本入口直接启动。
- 被 generated audit plan 动态装载为 owner inspector。
- 导出面被 namespace import 合法消费。
- 被现役 law 明确授权为外部入口面。

不在以上清单里的“先留着”“备份一下”“以后可能回滚”都算 zombie 候选。

## 执法形态

code-purity inspector 必须：

1. 收集 active source。
2. 构建 import / re-export 引用图。
3. 提取 package script entrypoints 与 generated-plan owner exemptions。
4. 产出 zombie-file / zombie-export / zombie-top-level-declaration / zombie-dead-branch findings。
5. 把整改动作写入 code-purity inventory，并保持执行态二元裁决。

## 豁免边界

- 豁免必须由 law、package script、或 generated plan 给出。
- 不允许手工白名单文件。
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
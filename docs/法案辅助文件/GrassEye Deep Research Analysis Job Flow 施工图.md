# GrassEye Deep Research Analysis Job Flow 施工图

version: 2026-05-25
status: blueprint
targetLaw: `GrassEye Deep Research Analysis Job Flow 法案`
capabilityDomain: `deep-research-analysis`

## 唯一流程

```txt
USER QUESTION
-> DECOMPOSE_SEND
-> DECOMPOSE_CAPTURE
-> DECOMPOSE_RAW_PERSIST
-> DECOMPOSE_PARSE
-> RESEARCH_PLAN_PERSIST:
   - subQuestions[]
   - subQuestions[].promptBundle
   - finalAdjudicationPromptBundle
   - htmlReportPromptBundle

-> ANALYSIS_SEND for each sub-question:
   runtime shell + subQuestion.promptBundle + user question + subQuestion
-> ANALYSIS_CAPTURE
-> ANALYSIS_RAW_PERSIST
-> ANALYSIS_PARSE_OR_RAW_PRESERVE
-> ANALYSIS_PERSIST

-> FULL_CASE_FILE_BUILD
-> FULL_CASE_FILE_EXPORT_JSON
-> FULL_CASE_FILE_EXPORT_MD

-> FINAL_ADJUDICATION_SEND:
   runtime shell + finalAdjudicationPromptBundle + fullCaseFile
-> FINAL_ADJUDICATION_CAPTURE
-> FINAL_ADJUDICATION_RAW_PERSIST
-> FINAL_REPORT_PERSIST

-> HTML_REPORT_SEND:
   runtime shell + htmlReportPromptBundle + finalReport + fullCaseFile
-> HTML_REPORT_CAPTURE
-> HTML_REPORT_RAW_PERSIST
-> HTML_REPORT_PERSIST_AS_BUSINESS_REPORT_HTML

-> EXPORT
-> COMPLETE
```

## HTML 最后一段重入

当同一个 job 已经持久化 `FULL_CASE_FILE` 和 `FINAL_ADJUDICATION`，但最后的 `business-report.html` 因 provider、artifact 捕获或保存失败没有落盘时，允许从同一条主链的 `HTML_REPORT_SEND` 重新进入：

```txt
persisted full case file + latest final report
-> HTML_REPORT_SEND
-> HTML_REPORT_CAPTURE
-> HTML_REPORT_RAW_PERSIST
-> HTML_REPORT_PERSIST_AS_BUSINESS_REPORT_HTML
-> EXPORT
-> COMPLETE
```

该能力只能复用 Deep Research 主权代码里的 HTML report stage、HTML prompt、HTML parser/export kind。APP 只能触发该能力和刷新结果，不得拥有 HTML 生成、保存、改写或业务裁决逻辑。

## 固定产物

```txt
business-report.html
full-case-file.json
full-case-file.md
research-plan.json
prompt-bundles.json
decision-package.json
final-report.md
evidence-index.json
```

## 硬边界

```txt
不存在 legacy。
不存在 fallback。
不存在 optional deck。
不存在 PPT。
不存在 compact/lite package。
不存在多模式。
```

## Full Case File

`FULL_CASE_FILE` 是最终裁决案卷。所有 AI prompt、所有 AI raw response、parse status、结构化索引、record hashes、provider proof 都必须进入案卷。结构化解析只是索引，不得替代 raw response。

最终裁决必须接收 `finalAdjudicationPromptBundle + fullCaseFile`。HTML report 必须接收 `htmlReportPromptBundle + finalReport + fullCaseFile`。

## Prompt 主权

系统外壳不等于业务提示词。

系统外壳只管：

```txt
安全边界
格式边界
发送
捕获
保存
全量案卷
导出
```

业务提示词只来自第一轮 AI 生成的 `promptBundle`。

禁止保留：

```txt
fixed sub-question business prompt
fixed final adjudication business prompt
fixed HTML business report structure
default business prompt fallback
```

## 已删除历史，不在系统内保留

```txt
1+N+N+1 正反证流程
PPT artifact generation
Business deck outline
Local PPT generator
Optional Presentation Deck
fallback / compatibility
```

## HTML 商业报告

HTML shell 只能要求完整自包含 HTML、inline CSS、no external JS、no external CSS、no external images、no markdown fence。

系统只检查 HTML 非空、包含 html/body、文件保存成功、hash 保存成功。系统不得重裁决内容。

最后一段重入只解决 `business-report.html` 缺失，不重跑拆解、子问题分析或最终裁决，不创建第二产物名。

## Deleted Path Inventory

deleted files
- scripts/audit/domains/deep-research-analysis/components/scan-no-presentation-artifacts.ts
- src/plugins/deep-research-analysis/deep-research-analysis.decomposition-phase.ts
- src/plugins/deep-research-analysis/deep-research-analysis.prompt-quality.ts
- src/plugins/deep-research-analysis/deep-research-analysis.prompt-regression.ts

deleted functions
- acceptance-surface compatibility alias: buildDeepResearchFinalPackage
- migrateResearchExportKindsSingleFlow
- runDeepResearchDecompositionPhase wrapper export
- migrateResearchInteractionParseStatusSingleFlow
- migrateResearchFinalReportsSingleFlowJson
- buildDeepResearchPromptHash

deleted export kinds
- structured-final-package.json compatibility migration path

deleted inspector checks
- presentation alias forwarding through scan-no-presentation-artifacts.ts

deleted acceptance tests
- none in this round; active acceptance set stays single-chain only

deleted UI sections
- primary delivery action: Open decision package

deleted phase names
- FINAL_PACKAGE_BUILD

## 验收

完整验收入口只有：

```bash
npm run ci:full
```

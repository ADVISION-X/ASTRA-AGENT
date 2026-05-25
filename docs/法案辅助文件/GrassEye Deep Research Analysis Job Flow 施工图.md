# GrassEye Deep Research Analysis Job Flow 施工图

version: 2026-05-25
status: blueprint
targetLaw: `GrassEye Deep Research Analysis Job Flow 法案`
capabilityDomain: `deep-research-analysis`

## 唯一流程

```txt
INTAKE
-> DECOMPOSE_SEND
-> DECOMPOSE_CAPTURE
-> DECOMPOSE_RAW_PERSIST
-> DECOMPOSE_PARSE_INDEX
-> ANALYSIS_SEND_N
-> ANALYSIS_CAPTURE_N
-> ANALYSIS_RAW_PERSIST_N
-> ANALYSIS_PARSE_INDEX_N
-> FULL_CASE_FILE_BUILD
-> FULL_CASE_FILE_EXPORT
-> FINAL_ADJUDICATION_SEND
-> FINAL_ADJUDICATION_CAPTURE
-> FINAL_ADJUDICATION_RAW_PERSIST
-> FINAL_REPORT_PERSIST
-> HTML_REPORT_SEND
-> HTML_REPORT_CAPTURE
-> HTML_REPORT_RAW_PERSIST
-> BUSINESS_REPORT_HTML_PERSIST
-> EXPORT
-> COMPLETE
```

`RAW_PERSIST` 保存完整 prompt 和完整 raw response。`PARSE_INDEX` 只建立索引。`FULL_CASE_FILE` 是最终裁决案卷。

## 固定产物

```txt
business-report.html
full-case-file.json
full-case-file.md
structured-final-package.json
final-report.md
evidence-index.json
```

## Full Case File

必须包含用户原始问题、拆解 prompt、拆解 raw response、拆解 parseStatus、N 个问题文本、每个 N 的 prompt、每个 N 的 raw response、每个 N 的 parseStatus、结构化解析结果、最终裁决 prompt、最终裁决 raw response、HTML prompt、HTML raw response、recordHashes、providerProofJson。

最终裁决 prompt 必须包含：

```txt
structuredFinalPackage
fullCaseFile
The full case file is the complete source of truth.
The structured package is only an index.
Do not ignore any non-empty raw AI response.
```

## HTML 商业报告

HTML prompt 必须要求完整自包含 HTML、inline CSS、no script、no external resource、business decision report，并禁止改变最终裁决、新增事实或遗漏 raw case material meaning。HTML 缺失时 job 不能进入 completed。

## UI

UI 只展示 Primary Business Report、Full Case File、Final Report、Structured Final Package 与 Evidence Index 的打开和下载入口。

## 验收

完整验收入口只有：

```bash
npm run ci:full
```

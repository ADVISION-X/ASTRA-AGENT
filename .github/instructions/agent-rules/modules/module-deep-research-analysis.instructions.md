---
name: "GrassEye Deep Research Analysis Job Flow"
description: "Governs the Deep Research Analysis job flow: one 1+N+1+1 chain, full raw case file, final adjudication, and HTML business report."
applyTo: "src/plugins/deep-research-analysis/**, src/app/workbench-deep-research**, scripts/acceptance/**, scripts/audit/domains/deep-research-analysis/**, .github/instructions/agent-rules/**"
---

# GrassEye Deep Research Analysis Job Flow 法案

status: active
version: 2026-05-25
capabilityDomain: deep-research-analysis
tier: P0
enforcementMode: machine-blocking
evidenceMode: law + schema + fs + ast + persisted-record

## 0. 身份定义

Deep Research Analysis 是 GrassEye 的固定业务 Job Flow。它只执行：

```txt
用户问题 -> AI 拆解 N 个问题
N 个问题 -> AI 逐个回答，全量保存
全量案卷 -> AI 最终裁决
最终裁决 + 全量案卷 -> AI 生成 HTML 商业报告
```

程序只负责发送、捕获、保存、组装全量案卷、投喂全量案卷、保存 HTML、导出和展示。AI 原文是主权记录；结构化解析只是索引。

## 1. 法条

### [GRASSEYE-DEEP-RESEARCH-001-V1] 独立 Job Flow 主权

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Deep Research Analysis must live as one explicit job flow under src/plugins/deep-research-analysis and must not become a universal agent, planner, or mission loop."
}
```

### [GRASSEYE-DEEP-RESEARCH-038-V1] Single Chain Sovereignty

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-038-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+fs+acceptance",
  "summary": "Deep Research has exactly one valid execution chain: decompose -> analyze N -> build full case file -> final adjudication -> business HTML report -> export. No legacy, fallback, optional, parallel, or compatibility execution chain may remain in the primary system."
}
```

Deep Research has exactly one valid execution chain:

```txt
decompose
-> analyze N
-> build full case file
-> final adjudication
-> business HTML report
-> export
```

No legacy, fallback, optional, parallel, or compatibility execution chain may remain in the primary system.

If the chain has already persisted the full case file inputs and final adjudication but the business HTML report did not persist, the system may re-enter the same chain at `HTML_REPORT_SEND` for the same job. This re-entry must use the persisted full case file and latest final report, must call the same HTML report stage and prompt, and must continue through export. It must not introduce a second HTML generator, second artifact kind, or app-owned report writer.

### [GRASSEYE-DEEP-RESEARCH-039-V1] Delete Non-Primary Path

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-039-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Any file, function, type, inspector, acceptance, UI section, export kind, or prompt that exists only for a non-primary Deep Research path must be physically deleted."
}
```

Non-primary path includes PPT primary flow, deck outline flow, local PPT generator, AI PPT artifact flow, legacy positive/falsification flow, compact/lite package flow, and optional deck completion logic.

### [GRASSEYE-DEEP-RESEARCH-040-V1] Full Case File as Sole Adjudication Material

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-040-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+fs+acceptance",
  "summary": "Final adjudication must receive the full case file. Structured records may exist only as navigation and index data; they must not replace raw AI prompts and raw AI responses."
}
```

Final adjudication must receive the full case file.

Structured records may exist only as navigation and index data.
They must not replace raw AI prompts and raw AI responses.

If raw AI text exists, it must be included in the full case file and made available to the final AI adjudicator.

### [GRASSEYE-DEEP-RESEARCH-041-V1] Business HTML as Sole Final Presentation Artifact

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-041-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "prompt+ast+export",
  "summary": "The only final presentation artifact of Deep Research is business-report.html. PPT, deck outline, local PPT, and AI PPT artifacts are not part of the primary Deep Research system."
}
```

The only final presentation artifact of Deep Research is `business-report.html`.

PPT, deck outline, local PPT, and AI PPT artifacts are not part of the primary Deep Research system.

### [GRASSEYE-DEEP-RESEARCH-042-V1] No Compatibility Vocabulary

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-042-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast+ui",
  "summary": "Deep Research implementation must not introduce or retain compatibility vocabulary for execution branching: legacy, fallback, optional, degrade, localFallback, compat, oldFlow, v1/v2 dual flow, lite, compact. If a concept is not part of the unique chain, it must not exist."
}
```

Deep Research implementation must not introduce or retain compatibility vocabulary for execution branching:

```txt
legacy
fallback
optional
degrade
localFallback
compat
oldFlow
v1/v2 dual flow
lite
compact
```

If a concept is not part of the unique chain, it must not exist.

### [GRASSEYE-DEEP-RESEARCH-043-V1] Per-SubQuestion PromptBundle Sovereignty

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-043-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "schema+ast",
  "summary": "The decomposition AI must generate one question-specific promptBundle for every sub-question, and N-stage runtime must use the promptBundle attached to that exact sub-question."
}
```

The decomposition AI must generate a ResearchPlan that contains one question-specific promptBundle for every sub-question.

Runtime must not use a generic universal analysis prompt for N-stage analysis.

Each sub-question promptBundle must be generated by the decomposition AI and must be persisted with the sub-question.

### [GRASSEYE-DEEP-RESEARCH-044-V1] Runtime Shell Only

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-044-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+prompt",
  "summary": "Runtime may add only transport, persistence, safety, and formatting shell constraints. Runtime must not hard-code domain-specific business analysis instructions, final adjudication logic, or HTML report content strategy."
}
```

Runtime may add only transport, persistence, safety, and formatting shell constraints.

Runtime must not hard-code domain-specific business analysis instructions, final adjudication logic, or HTML report content strategy.

Business prompt sovereignty belongs to the AI-generated promptBundle.

### [GRASSEYE-DEEP-RESEARCH-045-V1] PromptBundle As Sole Business Prompt Source

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-045-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "schema+ast",
  "summary": "N-stage analysis must render from subQuestion.promptBundle, final adjudication must render from finalAdjudicationPromptBundle, and HTML report generation must render from htmlReportPromptBundle. Any hard-coded prompt that replaces promptBundle business instructions is forbidden."
}
```

N-stage analysis must render from `subQuestion.promptBundle`.

Final adjudication must render from `finalAdjudicationPromptBundle`.

HTML report generation must render from `htmlReportPromptBundle`.

Any hard-coded prompt that replaces promptBundle business instructions is forbidden.

### [GRASSEYE-DEEP-RESEARCH-046-V1] FullCaseFile + PromptBundle Input Sovereignty

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-046-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+prompt+acceptance",
  "summary": "Final adjudication must receive structuredIndex, fullCaseFile, fullCaseFileMarkdown, and finalAdjudicationPromptBundle. HTML report must receive rawFinalAnswerText, fullCaseFile, fullCaseFileMarkdown, and htmlReportPromptBundle. Runtime must not reduce inputs to structured summaries."
}
```

Final adjudication must receive:

```txt
structuredIndex
fullCaseFile
fullCaseFileMarkdown
finalAdjudicationPromptBundle
```

HTML report must receive:

```txt
rawFinalAnswerText
fullCaseFile
fullCaseFileMarkdown
htmlReportPromptBundle
```

Runtime must not reduce inputs to structured summaries.

### [GRASSEYE-DEEP-RESEARCH-047-V1] Delete Previous Modes

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-047-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast+acceptance",
  "summary": "All previous Deep Research modes not matching the promptBundle-driven 1+N+1+1 chain must be physically deleted. No compatibility, fallback, optional, legacy, local fallback, compact, lite, or dual-path implementation may remain."
}
```

All previous Deep Research modes not matching the promptBundle-driven 1+N+1+1 chain must be physically deleted.

No compatibility, fallback, optional, legacy, local fallback, compact, lite, or dual-path implementation may remain.

Only the unique ResearchPlan -> PromptBundle -> FullCaseFile -> FinalAdjudication -> HTMLReport chain may remain.

### [GRASSEYE-DEEP-RESEARCH-048-V1] AI PromptBundle + Runtime Format Shell Sovereignty

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-048-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+prompt+ui",
  "summary": "Deep Research business prompts must be generated by the first AI ResearchPlan. Runtime may append only minimal format, persistence, safety, and transport shell constraints. Runtime must not hard-code domain-specific analysis, final adjudication, or report content instructions."
}
```

Deep Research business prompts must be generated by the first AI ResearchPlan.

Runtime may append only minimal format, persistence, safety, and transport shell constraints.

Runtime must not hard-code domain-specific analysis, final adjudication, or report content instructions.

### [GRASSEYE-DEEP-RESEARCH-049-V1] Format Shell Is Not Business Schema

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-049-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+prompt+acceptance",
  "summary": "Runtime format shell may define storage envelopes and artifact requirements. Runtime format shell must not define business conclusion fields such as confidence, finalVerdict, rankedConclusions, directAnswer, investmentThesis, trainingFramework, or other domain-specific structures. If such structures are needed, they must come from AI-generated promptBundle."
}
```

Runtime format shell may define storage envelopes and artifact requirements.

Runtime format shell must not define business conclusion fields such as `confidence`, `finalVerdict`, `rankedConclusions`, `directAnswer`, `investmentThesis`, `trainingFramework`, or other domain-specific structures.

If such structures are needed, they must come from AI-generated promptBundle.

### [GRASSEYE-DEEP-RESEARCH-050-V1] Final Adjudication Raw Sovereignty

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-050-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "schema+ast+export",
  "summary": "Final adjudication primary artifact is rawFinalAnswerText. Runtime must not convert final adjudication into a fixed summary/confidence schema. Runtime must not invent confidence, summary, verdict, ranking, or references. Parsed JSON may exist only as a secondary index and must never replace rawFinalAnswerText."
}
```

Final adjudication primary artifact is `rawFinalAnswerText`.

Runtime must not convert final adjudication into a fixed summary/confidence schema.

Runtime must not invent confidence, summary, verdict, ranking, or references.

Parsed JSON may exist only as a secondary index and must never replace `rawFinalAnswerText`.

### [GRASSEYE-DEEP-RESEARCH-051-V1] PromptBundle Field Consistency

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-051-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "schema+ast+prompt",
  "summary": "PromptBundle schema and decomposition prompt must use one field name for supplemental guidance. The canonical field is supplementalContent. optionalContent is forbidden and must be physically removed."
}
```

PromptBundle schema and decomposition prompt must use one field name for supplemental guidance.

The canonical field is `supplementalContent`.

`optionalContent` is forbidden and must be physically removed.

### [GRASSEYE-DEEP-RESEARCH-052-V1] No Compatibility or Fallback Formats

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-052-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast+acceptance",
  "summary": "Deep Research must not retain parallel old prompt formats, finalReport schemas, fallback parsers, optional content aliases, or compatibility input paths. The system is binary: the current chain exists; old modes do not exist."
}
```

Deep Research must not retain parallel old prompt formats, finalReport schemas, fallback parsers, optional content aliases, or compatibility input paths.

```txt
the current chain exists;
old modes do not exist.
```

### [GRASSEYE-DEEP-RESEARCH-053-V1] App Case Reader Sovereignty

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-053-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+ui+acceptance",
  "summary": "The Deep Research App page must be a case reader, not only a final report viewer. It must expose ResearchPlan, per-subQuestion promptBundle, rendered prompt, clean answer, index view, raw AI response, full case file, final raw adjudication, and primary HTML report delivery."
}
```

The Deep Research App page must be a case reader, not only a final report viewer.

It must expose:

```txt
ResearchPlan
per-subQuestion promptBundle
rendered prompt
clean answer
index view
raw AI response
full case file
final raw adjudication
primary HTML report delivery
```

### [GRASSEYE-DEEP-RESEARCH-054-V1] PromptBundle Visibility

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-054-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "schema+ui+acceptance",
  "summary": "Every persisted subQuestion promptBundle must be visible in the App report reader. The UI must not hide promptBundle behind only full-case-file downloads."
}
```

Every persisted `subQuestion.promptBundle` must be visible in the App report reader.

The UI must not hide promptBundle behind only full-case-file downloads.

### [GRASSEYE-DEEP-RESEARCH-055-V1] Clean / Raw / Index Separation

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-055-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+ui+acceptance",
  "summary": "The App UI must display clean answer, raw AI response, and parsed/index data as separate views. The UI must not label answerText as Summary. The UI must not merge raw response and parsed index into one business-looking answer."
}
```

The App UI must display `clean answer`, `raw AI response`, and `parsed/index data` as separate views.

The UI must not label `answerText` as `Summary`.

The UI must not merge raw response and parsed index into one business-looking answer.

### [GRASSEYE-DEEP-RESEARCH-056-V1] HTML Delivery Status Visibility

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-056-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ui+export+acceptance",
  "summary": "The App UI must show primary business HTML report delivery status, sourceKind, fileHash, fileSize, and failure/review reason when missing. HTML generation failure must be visible as a delivery failure, not hidden behind a generic report missing message."
}
```

The App UI must show primary business HTML report delivery status, `sourceKind`, `fileHash`, `fileSize`, and failure/review reason when missing.

HTML generation failure must be visible as a delivery failure, not hidden behind a generic report missing message.

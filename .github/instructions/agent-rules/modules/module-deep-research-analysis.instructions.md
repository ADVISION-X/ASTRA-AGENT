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

### [GRASSEYE-DEEP-RESEARCH-043-V1] PromptBundle Sovereignty

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-043-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+prompt",
  "summary": "Business prompt sovereignty belongs to the first AI ResearchPlan response. Runtime may define only transport, safety, persistence, and format-shell constraints."
}
```

Business prompt sovereignty belongs to the first AI ResearchPlan response.

Runtime must not hard-code domain-specific business analysis prompts for N-stage analysis, final adjudication, or HTML report publishing.

Runtime may only add transport, safety, persistence, and format-shell constraints.

### [GRASSEYE-DEEP-RESEARCH-044-V1] Per-SubQuestion PromptBundle Sovereignty

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-044-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "schema+ast",
  "summary": "Every sub-question generated by the first AI planning response must contain its own distinct promptBundle, and N-stage analysis must use the promptBundle attached to that exact sub-question."
}
```

Every sub-question generated by the first AI planning response must contain its own distinct promptBundle.

N-stage analysis must use the promptBundle attached to that exact sub-question.

A generic universal N-stage prompt is forbidden.

### [GRASSEYE-DEEP-RESEARCH-045-V1] AI-generated Final And HTML PromptBundle Sovereignty

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-045-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "schema+ast",
  "summary": "The final adjudication promptBundle and html report promptBundle must be generated by the first AI planning response. Runtime must not replace them with hard-coded business prompts."
}
```

The final adjudication promptBundle and html report promptBundle must be generated by the first AI planning response.

Runtime must not replace them with hard-coded business prompts.

Runtime may wrap them with fixed shell constraints only:

```txt
raw preservation
safety
forbidden control fields
preferred output format
transport constraints
```

### [GRASSEYE-DEEP-RESEARCH-046-V1] Physical Deletion Of Replaced Modes

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-046-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast+acceptance",
  "summary": "When Deep Research changes mode, replaced modes must be physically deleted. Compatibility, fallback, optional, legacy, local fallback, compact, lite, or dual-path retention is forbidden."
}
```

When Deep Research changes mode, replaced modes must be physically deleted.

Compatibility, fallback, optional, legacy, local fallback, compact, lite, or dual-path retention is forbidden.

Only the unique ResearchPlan -> PromptBundle -> FullCaseFile -> FinalAdjudication -> HTMLReport chain may remain.

### [GRASSEYE-DEEP-RESEARCH-047-V1] Runtime Shell Boundary

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-047-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+prompt+ui",
  "summary": "The runtime shell may define forbidden control fields, safety boundaries, raw preservation reminders, preferred format, and artifact delivery constraints, but it must not define domain-specific conclusion fields, question-specific report sections, final judgment criteria, or business analysis categories."
}
```

The runtime shell may define:

```txt
forbidden control fields
safety boundaries
raw persistence reminders
preferred format
artifact delivery constraints
```

The runtime shell must not define:

```txt
domain-specific conclusion fields
question-specific report sections
final judgment criteria
business analysis categories
training/investment/event-specific answer structures
```

Those belong to the AI-generated promptBundles.

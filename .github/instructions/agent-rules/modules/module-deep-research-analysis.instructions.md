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

### [GRASSEYE-DEEP-RESEARCH-038-V1] Single Flow Sovereignty

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-038-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+fs+acceptance",
  "summary": "Deep Research must have exactly one active production flow: user question, AI decomposition into N sub-questions, N independent AI analyses with full raw persistence, full case file construction, final AI adjudication using the full case file, then AI-generated business HTML report using final adjudication and the full case file."
}
```

Deep Research must have exactly one active production flow:

```txt
User question
-> AI decomposition into N sub-questions
-> N independent AI analyses with full raw persistence
-> full case file construction
-> final AI adjudication using the full case file
-> AI-generated business HTML report using final adjudication and the full case file
```

No legacy, optional, fallback, compatibility, demotion, or alternative production flow may remain active.

### [GRASSEYE-DEEP-RESEARCH-039-V1] Delete Legacy and Optional Paths

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-039-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Any Deep Research code path related to legacy positive/falsification mode, PPT deck generation, local PPT generation, deck outline JSON, optional presentation deck, fallback generation, compact package, lite package, or compatibility mode must be physically deleted unless transformed into the single active HTML full-case-file flow."
}
```

Deprecation is not enough. Disabling is not enough. Commenting out is not enough. Only physical deletion or full conversion into the single active flow is acceptable.

### [GRASSEYE-DEEP-RESEARCH-040-V1] Binary Existence Rule

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-040-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+fs+acceptance",
  "summary": "Every Deep Research module, function, export kind, status, UI section, inspector, acceptance, and prompt must be classified as either ACTIVE_SINGLE_FLOW or DELETE."
}
```

Every Deep Research module, function, export kind, status, UI section, inspector, acceptance, and prompt must be classified as either `ACTIVE_SINGLE_FLOW` or `DELETE`. No `OPTIONAL`, `LEGACY`, `FALLBACK`, `COMPATIBILITY`, `SOFT_DEPRECATED`, or `DEMOTED` state is allowed.

### [GRASSEYE-DEEP-RESEARCH-041-V1] Full Case File Is Mandatory

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-041-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "prompt+ast+export",
  "summary": "Final adjudication and business HTML report generation must receive the full case file; if the full case file is missing, the job must fail before final adjudication."
}
```

Final adjudication and business HTML report generation must receive the full case file. A structured final package alone is not sufficient. A decision package alone is not sufficient. A summary package alone is not sufficient. If the full case file is missing, the job must fail before final adjudication.

### [GRASSEYE-DEEP-RESEARCH-042-V1] HTML Report Is the Only Final Artifact

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-042-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast+ui",
  "summary": "The only final presentation artifact of Deep Research is business-report.html; PPTX, deck outline JSON, local deck generation, AI PPT artifact, or optional presentation deck must not exist in the active production flow."
}
```

The only final presentation artifact of Deep Research is `business-report.html`. PPTX, deck outline JSON, local deck generation, AI PPT artifact, or optional presentation deck must not exist in the active Deep Research production flow.

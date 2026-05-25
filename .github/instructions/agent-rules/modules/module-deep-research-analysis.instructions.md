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
  "summary": "Deep Research must have exactly one runtime flow: user question to AI decomposition, N sub-question AI answers with full raw persistence, full case file to final AI adjudication, then final report plus full case file to AI-generated business HTML report."
}
```

Deep Research must have exactly one runtime flow:

1. user question to AI decomposition,
2. N sub-question AI answers with full raw persistence,
3. full case file to final AI adjudication,
4. final report plus full case file to AI-generated business HTML report.

No other flow mode may exist.

### [GRASSEYE-DEEP-RESEARCH-039-V1] Deletion First Governance

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-039-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "Any Deep Research iteration that introduces a replacement capability must physically delete the replaced path in the same iteration."
}
```

Retired paths must not remain as hidden code, compatibility surfaces, or alternate runtime branches.

### [GRASSEYE-DEEP-RESEARCH-040-V1] Full Raw Case File As Final Adjudication Input

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-040-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "prompt+ast+export",
  "summary": "Final adjudication must receive the full case file containing all prompts and all raw AI responses from decomposition and sub-question analysis."
}
```

Final adjudication must receive `structuredFinalPackage` and `fullCaseFile`. The full case file is the complete source of truth; the structured package is only an index.

### [GRASSEYE-DEEP-RESEARCH-041-V1] HTML Only Final Artifact

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-041-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast+ui",
  "summary": "The only final business report artifact for Deep Research is business-report.html."
}
```

The only final business report artifact for Deep Research is `business-report.html`.

### [GRASSEYE-DEEP-RESEARCH-042-V1] No Runtime Content Judgment

```apex-law
{
  "lawId": "GRASSEYE-DEEP-RESEARCH-042-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "deep-research-analysis",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+case-file",
  "summary": "The runtime must not judge, filter, rank, summarize, compact, or omit non-empty AI content for final adjudication."
}
```

The runtime may record parse status and transport status only. All non-empty raw AI responses must be present in the full case file.

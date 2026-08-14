---
name: "GrassEye Structured Logging"
description: "Governs structured logging as a support law under the Runtime Log Spine."
applyTo: ".github/instructions/agent-rules/modules/module-structured-logging.instructions.md, src/lib/runtime-logs/**"
---

# GrassEye Structured Logging

status: active
version: 2026-05-21
capabilityDomain: runtime-logs

## Law GRASSEYE-STRUCTURED-LOGGING-001-V1

```apex-law
{
  "lawId": "GRASSEYE-STRUCTURED-LOGGING-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance",
  "summary": "Structured logging is subordinate to the single Runtime Log Spine and must preserve FLOW, DEBUG, TRACE structure and sink-before-output redaction without a second logging authority.",
  "clauses": [
    {
      "clauseId": "grasseye-structured-logging-001-requirement",
      "statement": "All structured log events must use the single Runtime Log Spine, remain redacted and subordinate to evidence and result truth, and never create a compatibility or parallel logging chain.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

Structured logging is a support law under Runtime Log Spine.

Required:
- FLOW / DEBUG / TRACE events remain structured.
- Log payloads are redacted before output.
- Logs are subordinate to evidence and result records.
- Logging law must not become a second runtime-log constitution.

Forbidden:
- redirect-only compatibility shells;
- split logging authority;
- warning-only runtime-log failures;
- logging secrets, cookies, tokens, raw provider prompts, or browser storage.

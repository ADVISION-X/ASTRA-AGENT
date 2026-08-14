---
name: "GrassEye Evidence Store"
description: "Governs evidence persistence for flow steps, artifacts, DOM snapshots, screenshots, results, and failure reasons."
applyTo: "src/capabilities/forensics-persistence/**, src/plugins/**"
---

# GrassEye Evidence Store

status: active
version: 2026-05-21

## Boundary

Forensics Persistence is the evidence store for every lawful job flow.

It owns:
- step trace records;
- DOM snapshot references;
- screenshot references;
- job result records;
- failure reasons;
- stable artifact references.

It does not own:
- business workflow control;
- owner universe matrices;
- audit truth;
- AI judgment;
- browser actions.

## Law GRASSEYE-EVIDENCE-001-V2

```apex-law
{
  "lawId": "GRASSEYE-EVIDENCE-001-V2",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "forensics-persistence-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance",
  "summary": "Forensics Persistence is the single append-first evidence owner for step traces, artifact references, result records, and failure reasons, and it never owns workflow decisions.",
  "clauses": [
    {
      "clauseId": "grasseye-evidence-001-v2-requirement",
      "statement": "Every persisted business result must remain traceable through append-first record or artifact references with success and failure truth, while the evidence owner never decides the next workflow step.",
      "evidenceMode": "acceptance",
      "ownerDomain": "forensics-persistence-capability"
    }
  ]
}
```

Required:
- Every business step may append a concise trace.
- Success and failure both include enough evidence to inspect what happened.
- Sensitive values are redacted before logs or evidence where required.
- Every job result records status, reached step, reason, and artifact refs.

Forbidden:
- evidence store deciding next workflow step;
- multi-layer owner evidence universes;
- silent success or silent failure.

---
name: "GrassEye Security Privacy"
description: "Governs credentials, browser session data, screenshots, PDFs, and logs."
applyTo: "src/**, scripts/**"
---

# GrassEye Security Privacy

status: active
version: 2026-05-21

## Law GRASSEYE-SECURITY-PRIVACY-LOG-001-V1

```apex-law
{
  "lawId": "GRASSEYE-SECURITY-PRIVACY-LOG-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "runtime-log-spine",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance",
  "summary": "Runtime logs and public evidence must never disclose credentials, browser storage, secret-bearing URLs, full HTML, or private artifact bodies.",
  "clauses": [
    {
      "clauseId": "grasseye-security-privacy-log-001-requirement",
      "statement": "All runtime sinks must redact credentials, cookies, tokens, browser storage, signed queries, full HTML, and private artifact bodies before output.",
      "evidenceMode": "acceptance",
      "ownerDomain": "runtime-log-spine"
    }
  ]
}
```

## Law GRASSEYE-SECURITY-PRIVACY-BROWSER-001-V1

```apex-law
{
  "lawId": "GRASSEYE-SECURITY-PRIVACY-BROWSER-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "local-browser-session",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+real-chrome",
  "summary": "Browser session infrastructure must keep cookies, local storage, session storage, passwords, and tokens opaque and outside evidence persistence.",
  "clauses": [
    {
      "clauseId": "grasseye-security-privacy-browser-001-requirement",
      "statement": "Browser control must not read or persist cookies, localStorage, sessionStorage, passwords, or tokens and must keep session profiles separate from evidence storage.",
      "evidenceMode": "acceptance",
      "ownerDomain": "local-browser-session"
    }
  ]
}
```

## Law GRASSEYE-SECURITY-PRIVACY-AI-001-V1

```apex-law
{
  "lawId": "GRASSEYE-SECURITY-PRIVACY-AI-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "ai-input-gateway",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance",
  "summary": "AI transport must accept only caller-approved input references and may never choose files or control payment, refund, deletion, or sensitive submission.",
  "clauses": [
    {
      "clauseId": "grasseye-security-privacy-ai-001-requirement",
      "statement": "AI transport may deliver only governed caller-approved input references and must never choose arbitrary files or control sensitive final actions.",
      "evidenceMode": "acceptance",
      "ownerDomain": "ai-input-gateway"
    }
  ]
}
```

Required:
- Credentials, cookies, tokens, and secrets are never logged.
- Screenshots and DOM snapshots are evidence refs, not public telemetry.
- Approved invoice PDFs are selected by the caller and stored under local task evidence.
- Sensitive final submit can require human review.

Forbidden:
- AI choosing arbitrary files;
- AI controlling payment, refund, delete, or sensitive final submit decisions;
- leaking browser storage or full HTML into logs.

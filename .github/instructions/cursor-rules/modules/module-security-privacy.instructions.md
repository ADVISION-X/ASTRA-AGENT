---
name: "GrassEye Security Privacy"
description: "Use when defining credential handling, cookie or session boundaries, sensitive screenshot minimization, or privacy red lines for GrassEye."
applyTo: ".github/instructions/cursor-rules/modules/module-security-privacy.instructions.md, src/lib/browser/**, src/lib/local-ai/**"
---

# GrassEye Security Privacy

Scope: governs account authorization, credential secrecy, privacy minimization, and platform security boundaries.
Boundary: this module governs sensitive data handling and anti-bypass red lines only.
Excludes: product scoring, comment semantics, and general file topology.
Authority: this file is authoritative only for the security-privacy capability domain.

---

## Law GRASSEYE-SECURITY-PRIVACY-001-V1

status: active
tier: P0
capabilityDomain: security-privacy
enforcementMode: manual-first
evidenceMode: law

summary: GrassEye must operate only with user-authorized local accounts while minimizing sensitive capture and never bypassing platform security.

### 主题

本地凭据安全与隐私最小化

### 法条

GrassEye may use only user-authorized local platform sessions and must minimize sensitive capture, storage, and exposure.

Required direction:
- Credentials, cookies, sessions, and tokens must remain local and undisclosed.
- Login persistence must rely on a local Chrome profile, not cookie export or session dumps.
- AI execution must not transmit screenshots, OCR text, comments, session data, or product evidence to unauthorized external AI services.
- Local consoles, local agent services, browser sessions, screenshots, and evidence stores must bind to the local authorized environment by default.
- Screenshots must exclude unrelated sensitive regions wherever possible.
- Logs must avoid passwords, tokens, sessions, cookies, and unnecessary identity data.
- Account use must stay inside the user's authorized local environment.

### 禁止

FORBIDDEN:
- Reading browser passwords.
- Reading or exporting cookies for platform login persistence.
- Exporting cookies or sessions.
- Injecting cookies or sessions into browser contexts.
- Hidden paid API or cloud AI calls that move local evidence outside the authorized local environment.
- Public internet exposure of the local console, agent runtime, browser session, screenshots, cookies, sessions, or evidence store by default.
- Remote hosting of user browser sessions or cookies as a phase-one default.
- Collecting tokens, private messages, or non-public pages.
- Writing cookie, session, or token values into logs, evidence packets, browse ledgers, or runtime reports.
- Bypassing login, CAPTCHA, risk control, or uploading sensitive screenshots to unauthorized external services.

---

## 模块边界声明

This law file does not govern:
- Whether a product signal is promising.
- How audit ownership is assigned across domains.

## Law GRASSEYE-SECURITY-PRIVACY-002-V1

status: active
tier: P0
capabilityDomain: security-privacy
enforcementMode: manual-first
evidenceMode: law

summary: Prompt contracts and AI-generated maps must never request sensitive secrets or hidden bypass channels.

### 主题

提示词与生成地图的隐私红线

### 法条

Prompt contracts and AI-generated maps must not request credentials, cookies, hidden tokens, security bypass, unauthorized personal-data extraction, or hidden API use without explicit connector governance.

## Law GRASSEYE-SECURITY-PRIVACY-003-V1

status: active
tier: P0
capabilityDomain: security-privacy
enforcementMode: manual-first
evidenceMode: law

summary: Sensitive tasks require review gates before mutating user data or high-risk platform state.

### 主题

敏感任务必须人工闸门

### 法条

Sensitive tasks must require review gates before sending, deleting, purchasing, submitting, or modifying user data.
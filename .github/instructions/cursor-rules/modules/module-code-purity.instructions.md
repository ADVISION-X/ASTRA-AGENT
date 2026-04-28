---
name: "GrassEye Code Purity"
description: "Use when governing source-file atomicity, function size, complexity, nesting depth, module purity, dead code, and refactor boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-code-purity.instructions.md, src/**/*.{ts,tsx,js,jsx}, scripts/**/*.{ts,tsx,js,jsx}"
---

# GrassEye Code Purity

Scope: governs dead code removal, fake or mock production leakage, and compatibility-bridge red lines only.
Boundary: this module governs repository red lines that must not survive inside active source truth as an audit-system child sub-contract, not as an independent owner.
Excludes: line-count thresholds, function-shape thresholds, stylistic refactors, and general maintainability preferences.
Authority: this file is authoritative only for the audit-system capability domain as the purity red-line sub-contract.

---

## Law GRASSEYE-CODE-PURITY-003-V1

status: active
tier: P0
capabilityDomain: audit-system
enforcementMode: manual-first
evidenceMode: law

summary: code-purity is an audit-system red-line child sub-contract, not an active owner.

### 主题

死代码、调试残留与临时绕路清理

### 法条

GrassEye source truth must stay clean and must not preserve abandoned implementation paths inside active code.

Required direction:
- Dead code must be deleted rather than preserved.
- Commented-out implementation code must be deleted.
- Temporary debug logs must be removed or routed through a governed logging boundary.
- TODO comments are allowed only when they include owner, reason, and target phase or removal condition.
- Deprecated paths must be physically removed unless explicitly archived outside active source truth.
- Mock, fake, or placeholder execution must not be presented as real runtime behavior.
- Old deleted-owner paths must be physically removed from active source truth rather than hidden behind neutral naming.

### 禁止

FORBIDDEN:
- Commented-out old implementations.
- console.log debug scatter in governed runtime paths.
- TODO comments without owner or removal condition.
- FIXME later as permanent source truth.
- Temporary bypasses that survive phase acceptance.
- Fake PASS, fake AI result, fake storage result, or fake platform action result.

---

## Law GRASSEYE-CODE-PURITY-004-V1

status: active
tier: P0
capabilityDomain: audit-system
enforcementMode: manual-first
evidenceMode: law

summary: refactors must simplify ownership instead of creating compatibility bridges, duplicate paths, or second systems.

### 主题

重构方向与兼容桥接禁止

### 法条

GrassEye refactors must reduce file size, reduce owner mixing, and remove obsolete paths rather than adding compatibility layers.

Required direction:
- When a file violates size, owner, or complexity limits, split by capability owner.
- Prefer physical deletion over compatibility bridges when a path is no longer part of the approved route.
- New extraction must create narrow files with clear names and clear owner boundaries.
- Shared helpers must prove cross-domain reuse before entering src/lib.
- Domain-private helpers should stay inside the owning feature domain.
- Refactor reports must state which files were split, deleted, simplified, or left as debt.

### 禁止

FORBIDDEN:
- Adding adapters only to preserve obsolete architecture.
- Keeping old path and new path both active.
- Creating bridge files that hide unresolved ownership conflict.
- Moving messy code into src/lib to make feature files look clean.
- Creating abstraction layers before two real call sites prove the need.
- Refactoring by renaming only while preserving the same mixed responsibility.

---

## 模块边界声明

This law file does not govern:
- Where files belong in the repository.
- Which runtime actions are allowed.
- Which AI model is selected.
- How product signals are scored.
- How evidence is retained or exported.
- File length or function-length thresholds.
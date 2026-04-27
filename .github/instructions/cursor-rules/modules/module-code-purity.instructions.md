---
name: "GrassEye Code Purity"
description: "Use when governing source-file atomicity, function size, complexity, nesting depth, module purity, dead code, and refactor boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-code-purity.instructions.md, src/**/*.{ts,tsx,js,jsx}, scripts/**/*.{ts,tsx,js,jsx}"
---

# GrassEye Code Purity

Scope: governs source-file atomicity, function size, complexity, nesting depth, module purity, dead code, and refactor boundaries.
Boundary: this module governs code internal purity and maintainability only.
Excludes: path ownership, runtime policy, AI behavior, browser action policy, storage schema design, and business scoring rules.
Authority: this file is authoritative only for the code-purity capability domain.

---

## Law GRASSEYE-CODE-PURITY-001-V1

status: active
tier: P0
capabilityDomain: code-purity
enforcementMode: manual-first
evidenceMode: law

summary: source files must stay small, single-purpose, and reviewable so later phases do not collapse into unmaintainable mixed files.

### 主题

文件原子化与单一职责

### 法条

GrassEye source files must remain small, single-purpose, and owned by one clear capability concern.

Required direction:
- A normal source file should stay under 220 physical lines.
- A TSX page or UI component file should stay under 260 physical lines unless it is split immediately after layout stabilization.
- A route handler or server action file should stay under 140 physical lines.
- A startup helper file should stay under 160 physical lines.
- A type-only, schema-only, dictionary-only, or generated file may exceed the normal line limit only when it contains no orchestration or business logic.
- One source file must have one primary responsibility and one primary owner boundary.
- Files that mix UI, browser control, AI calls, storage writes, and product scoring must be split.
- Route files must stay thin and delegate business logic to the correct domain owner.
- index.ts files may re-export only; they must not contain business logic.

### 禁止

FORBIDDEN:
- God files.
- Mixed owner files.
- Route files owning browser automation, AI reasoning, product scoring, or evidence persistence.
- Generic dumping buckets such as utils.ts, helpers.ts, service.ts, manager.ts, or common.ts when they contain unrelated logic.
- Business orchestration hidden inside dictionaries, schema files, type files, or startup scripts.
- Expanding an oversized file instead of splitting it.

---

## Law GRASSEYE-CODE-PURITY-002-V1

status: active
tier: P0
capabilityDomain: code-purity
enforcementMode: manual-first
evidenceMode: law

summary: functions must remain short, explicit, and extractable so execution logic can be audited by humans and future inspectors.

### 主题

函数长度、复杂度与嵌套深度

### 法条

GrassEye functions must remain small enough to review, inspect, and refactor safely.

Required direction:
- A normal function should stay under 40 logical lines.
- An exported function should stay under 55 logical lines.
- A React component render body should stay under 80 logical lines before extraction is required.
- A function should have no more than 4 parameters; use a named input object when more data is needed.
- Nesting depth should not exceed 3 levels.
- Cyclomatic complexity should not exceed 10.
- Cognitive complexity should not exceed 15.
- Condition-heavy code must extract named guard functions.
- Repeated condition blocks must become named predicates.
- Long switch statements must be replaced by typed strategy maps when they grow beyond one capability concern.

### 禁止

FORBIDDEN:
- Giant functions.
- Anonymous callback pyramids.
- Deeply nested if/else chains.
- Boolean parameter soup.
- Repeated copy-paste guard logic.
- Functions that both decide, execute, persist, and render.
- Silent catch blocks or catch blocks that hide failed runtime state.

---

## Law GRASSEYE-CODE-PURITY-003-V1

status: active
tier: P0
capabilityDomain: code-purity
enforcementMode: manual-first
evidenceMode: law

summary: dead code, commented-out code, debug leftovers, and temporary bypasses must not become source truth.

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
capabilityDomain: code-purity
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
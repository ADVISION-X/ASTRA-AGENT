---
name: "GrassEye Localization"
description: "Use when defining UI language switching, localization dictionaries, UI copy ownership, or English/Chinese operator-facing text."
applyTo: ".github/instructions/cursor-rules/modules/module-localization.instructions.md, src/lib/localization/**, src/features/operator-control/**, src/app/**"
---

# GrassEye Localization

Scope: governs operator-facing UI localization, manual language switching, localization dictionaries, and UI copy ownership.
Boundary: this module governs only interface text and language selection for the local workbench.
Excludes: AI translation, comment translation, product data translation, OCR translation, platform content translation, and external translation services.
Authority: this file is authoritative only for the localization capability domain.

---

## Law GRASSEYE-LOCALIZATION-001-V1

status: active
tier: P0
capabilityDomain: localization
enforcementMode: manual-first
evidenceMode: law

summary: GrassEye operator-facing UI must support manual English and Chinese switching through governed localization dictionaries.

### 主题

中英文手动切换主权

### 法条

GrassEye operator-facing UI must support a governed manual language switch between English and Chinese without relying on cloud translation or hidden automatic translation.

Required direction:
- The local workbench must expose a visible English / 中文 language switch.
- Supported phase-two locales are `en` and `zh`.
- Language selection must be manual and reviewable.
- UI text must come from governed localization dictionaries or a governed localization helper.
- The selected language must apply to page titles, section headings, buttons, labels, status text, empty states, and operator action text.

### 禁止

FORBIDDEN:
- Cloud translation API as the default localization path.
- AI-generated translation at runtime for operator UI.
- Hidden automatic translation that changes UI language without operator selection.
- English-only operator UI after localization is enabled.
- Chinese-only operator UI that removes English mode.

---

## Law GRASSEYE-LOCALIZATION-002-V1

status: active
tier: P0
capabilityDomain: localization
enforcementMode: manual-first
evidenceMode: law

summary: UI copy must not be scattered as hardcoded strings across route, server, and operator-control files.

### 主题

UI 文案字典与硬编码边界

### 法条

Operator-facing UI copy must be centralized through localization contracts so future pages do not scatter English and Chinese text across unrelated files.

Required direction:
- Localization keys must have both English and Chinese values.
- UI rendering code must request text by key rather than duplicating translated strings inline.
- Missing localization keys must fail clearly or fall back visibly, not silently disappear.
- Data values, IDs, evidence summaries, model outputs, and platform content are not UI copy and must not be forcibly translated by localization.

### 禁止

FORBIDDEN:
- Hardcoded operator-facing UI labels inside server route handlers.
- Duplicate English and Chinese text blocks scattered in unrelated files.
- Missing Chinese or English value for a localization key.
- Treating product evidence, comments, AI raw outputs, IDs, timestamps, or file paths as UI translation strings.
- Creating a CMS, remote translation platform, or AI translation workflow for phase two.

---

## 模块边界声明

This law file does not govern:
- AI model prompt language.
- OCR output language.
- User comments or platform content.
- Product candidate data values.
- Browser automation.
- Database schema.
import type { PurityPhaseSummary } from "./purity-types.js";

export const CODE_PURITY_LAW_IDS = [
  "GRASSEYE-QUALITY-GATE-SIMPLE-GUARDRAIL-V1",
  "GRASSEYE-CODE-PURITY-001-V1",
  "GRASSEYE-CODE-PURITY-002-V1",
  "GRASSEYE-CODE-PURITY-003-V1",
  "GRASSEYE-CODE-PURITY-004-V1",
  "GRASSEYE-CODE-PURITY-005-V1",
  "GRASSEYE-CODE-PURITY-006-V1",
  "GRASSEYE-CODE-PURITY-007-V1",
  "GRASSEYE-CODE-PURITY-008-V1",
  "GRASSEYE-CODE-PURITY-009-V1",
  "GRASSEYE-CODE-PURITY-010-V1",
  "GRASSEYE-CODE-PURITY-011-V1",
  "GRASSEYE-CODE-PURITY-012-V1",
  "GRASSEYE-CODE-PURITY-013-V1",
  "GRASSEYE-CODE-PURITY-014-V1",
  "GRASSEYE-RETIRED-AUTHORITY-NO-REGRESSION-V1",
] as const;

export const LAW_PHASE_SUMMARIES: PurityPhaseSummary[] = [
  {
    lawId: "GRASSEYE-QUALITY-GATE-SIMPLE-GUARDRAIL-V1",
    name: "quality-gate-simple-guardrail",
    okSummary: "Quality inspection stays small, blocking, and mainline-protective.",
    failedSummary: "Quality inspection still behaves like a second runtime, architecture model, or report universe.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-001-V1",
    name: "file-size-limits",
    okSummary: "Active source files stay within category hard limits.",
    failedSummary: "Active source files still exceed code-purity file-size hard limits.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-002-V1",
    name: "touched-file-rule",
    okSummary: "Touched active files stay within hard limits.",
    failedSummary: "Touched active files still exceed their hard limits.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-003-V1",
    name: "function-shape-limits",
    okSummary: "Functions stay small, shallow, and single-purpose.",
    failedSummary: "One or more functions exceed line, parameter, nesting, or complexity limits.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-004-V1",
    name: "class-object-limits",
    okSummary: "Classes and objects stay under god-object limits.",
    failedSummary: "One or more classes or objects exceed member or constructor limits.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-005-V1",
    name: "owner-boundary-limits",
    okSummary: "Owner-boundary counting stays at real capability granularity.",
    failedSummary: "Cross-owner imports or owner boundaries still exceed code-purity limits.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-006-V1",
    name: "import-export-purity",
    okSummary: "Import/export structures stay narrow and barrel-free.",
    failedSummary: "Import/export structures still exceed limits or hide coupling through barrels.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-007-V1",
    name: "single-role-files",
    okSummary: "Files stay role-local without schema/runtime bucket mixing.",
    failedSummary: "One or more files still mix broad roles behind neutral structure.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-008-V1",
    name: "dead-code-cleanup",
    okSummary: "Active source truth is free of fake paths, debug scatter, and dead-code leftovers.",
    failedSummary: "Fake paths, debug scatter, placeholder success, or dead code still exist in active source truth.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-009-V1",
    name: "refactor-direction",
    okSummary: "Refactor direction avoids compatibility bridges and duplicate active paths.",
    failedSummary: "Compatibility bridges or legacy duplicate routes still exist in active source truth.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-010-V1",
    name: "disaster-file-queue",
    okSummary: "Disaster files are identified and queued for physical split.",
    failedSummary: "Disaster files still exist without a blocking finding and concrete split direction.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-011-V1",
    name: "real-enforcement-coverage",
    okSummary: "All active code-purity laws have inspector coverage and CI-FULL execution.",
    failedSummary: "One or more active code-purity laws lack real-code coverage or CI-FULL execution.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-012-V1",
    name: "anti-escape",
    okSummary: "Type escapes, directives, dynamic imports, and wrapper laundering are blocked.",
    failedSummary: "Type escapes, directives, dynamic imports, or laundering patterns still exist.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-013-V1",
    name: "support-evidence-output",
    okSummary: "Code-purity emits minimal violation-driven support evidence when needed.",
    failedSummary: "Code-purity still depends on default inventories or non-actionable report output.",
  },
  {
    lawId: "GRASSEYE-CODE-PURITY-014-V1",
    name: "physical-split-direction",
    okSummary: "Remediation direction prefers physical deletion and physical splitting.",
    failedSummary: "Active source still relies on bridges, wrappers, or cosmetic refactor direction.",
  },
  {
    lawId: "GRASSEYE-RETIRED-AUTHORITY-NO-REGRESSION-V1",
    name: "retired-authority-no-regression",
    okSummary: "Active source truth contains no retired authority vocabulary as positive runtime shapes.",
    failedSummary: "Retired authority vocabulary still appears as positive runtime shapes in active source truth.",
  },
];

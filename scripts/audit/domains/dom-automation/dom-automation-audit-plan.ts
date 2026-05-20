export type DomAutomationAuditClause = {
  lawId: string;
  clauseId: string;
  source: "law" | "blueprint";
  requirement: string;
  enforcementLevel: "fs" | "ast" | "symbol" | "anti_escape" | "runtime_smoke";
  inspectorPhase: string;
  status: "active";
};

export const DOM_AUTOMATION_LAW_IDS = [
  "GRASSEYE-DOM-001-V1",
  "GRASSEYE-DOM-002-V1",
  "GRASSEYE-DOM-003-V1",
  "GRASSEYE-DOM-004-V1",
  "GRASSEYE-DOM-005-V1",
  "GRASSEYE-DOM-006-V1",
  "GRASSEYE-DOM-007-V1",
  "GRASSEYE-DOM-008-V1",
  "GRASSEYE-DOM-009-V1",
  "GRASSEYE-DOM-010-V1",
] as const;

export const DOM_AUTOMATION_BLUEPRINT_SECTION_IDS = [
  "BLUEPRINT-01",
  "BLUEPRINT-02",
  "BLUEPRINT-03",
  "BLUEPRINT-04",
  "BLUEPRINT-05",
  "BLUEPRINT-06",
  "BLUEPRINT-07",
  "BLUEPRINT-08",
  "BLUEPRINT-09",
  "BLUEPRINT-10",
  "BLUEPRINT-11",
  "BLUEPRINT-12",
] as const;

const lawClause = (
  lawId: (typeof DOM_AUTOMATION_LAW_IDS)[number],
  requirement: string,
  enforcementLevel: DomAutomationAuditClause["enforcementLevel"],
  inspectorPhase: string,
): DomAutomationAuditClause => ({
  lawId,
  clauseId: lawId,
  source: "law",
  requirement,
  enforcementLevel,
  inspectorPhase,
  status: "active",
});

const blueprintClause = (...input: readonly [
  clauseId: (typeof DOM_AUTOMATION_BLUEPRINT_SECTION_IDS)[number],
  lawId: (typeof DOM_AUTOMATION_LAW_IDS)[number],
  requirement: string,
  enforcementLevel: DomAutomationAuditClause["enforcementLevel"],
  inspectorPhase: string,
]): DomAutomationAuditClause => {
  const [clauseId, lawId, requirement, enforcementLevel, inspectorPhase] = input;
  return ({
  lawId,
  clauseId,
  source: "blueprint",
  requirement,
  enforcementLevel,
  inspectorPhase,
  status: "active",
  });
};

export const DOM_AUTOMATION_AUDIT_PLAN: readonly DomAutomationAuditClause[] = [
  lawClause("GRASSEYE-DOM-001-V1", "DOM automation stays a standalone pluggable capability group and reuses the governed BrowserController owner.", "symbol", "import-boundaries"),
  lawClause("GRASSEYE-DOM-002-V1", "DOM snapshot emits structural summaries only and blocks cookie, storage, password, hidden-value, and full-HTML leakage.", "anti_escape", "sensitive-data-anti-escape"),
  lawClause("GRASSEYE-DOM-003-V1", "Locator stays semantic-first, confidence-backed, and returns governed DomElementRef outputs.", "ast", "runtime-contracts"),
  lawClause("GRASSEYE-DOM-004-V1", "DOM fill types approved task text only and never invents business values or types passwords.", "ast", "runtime-contracts"),
  lawClause("GRASSEYE-DOM-005-V1", "DOM click operates only on located, visible, enabled elements and preserves before/after evidence.", "ast", "runtime-contracts"),
  lawClause("GRASSEYE-DOM-006-V1", "Upload validates approved files, file type, file existence, and target kind before phase-gated upload behavior.", "ast", "runtime-contracts"),
  lawClause("GRASSEYE-DOM-007-V1", "DOM verify and wait return evidence-backed success, failure, review-required, login, and captcha results.", "ast", "runtime-contracts"),
  lawClause("GRASSEYE-DOM-008-V1", "Business plugins orchestrate DOM abilities without polluting DOM core or bypassing facade boundaries.", "symbol", "symbol-boundaries"),
  lawClause("GRASSEYE-DOM-009-V1", "Login, captcha, ambiguity, dangerous actions, and unconfirmed upload states stop in review-required mode.", "ast", "phase-coverage"),
  lawClause("GRASSEYE-DOM-010-V1", "DOM automation emits evidence-backed structured outcomes without leaking sensitive data into logs or reports.", "anti_escape", "sensitive-data-anti-escape"),
  blueprintClause("BLUEPRINT-01", "GRASSEYE-DOM-001-V1", "DOM automation fills the missing page-structure capability without coupling to visual mission runtime.", "symbol", "import-boundaries"),
  blueprintClause("BLUEPRINT-02", "GRASSEYE-DOM-001-V1", "Architecture stays plugin -> DOM facade -> BrowserController with no private bypasses.", "symbol", "symbol-boundaries"),
  blueprintClause("BLUEPRINT-03", "GRASSEYE-DOM-001-V1", "Directory plan includes DOM runtime, contracts, fixtures or equivalent acceptance fixtures, plugin files, and smoke scripts.", "fs", "structure"),
  blueprintClause("BLUEPRINT-04", "GRASSEYE-DOM-003-V1", "Atomic ability surface exposes the seven governed DOM abilities and enforces their runtime contracts.", "ast", "runtime-contracts"),
  blueprintClause("BLUEPRINT-05", "GRASSEYE-DOM-008-V1", "Amazon plugin remains a plugin owner with hints, result detector, and no private browser or DOM runtime implementation.", "symbol", "import-boundaries"),
  blueprintClause("BLUEPRINT-06", "GRASSEYE-DOM-001-V1", "BrowserController exposes evaluateActiveTab and keeps DOM logic out of browser primitives.", "symbol", "symbol-boundaries"),
  blueprintClause("BLUEPRINT-07", "GRASSEYE-DOM-001-V1", "MuscleMemory catalog joins DOM entries through source registry merge with duplicate guards and no generated stuffing.", "symbol", "catalog-registry"),
  blueprintClause("BLUEPRINT-08", "GRASSEYE-DOM-010-V1", "Runtime outputs keep evidence refs and reject sensitive log fields or HTML dumps.", "anti_escape", "sensitive-data-anti-escape"),
  blueprintClause("BLUEPRINT-09", "GRASSEYE-DOM-009-V1", "Phase 1-3 are active and Phase 4-5 stay governed pending until upload and final-submit are real and review-safe.", "ast", "phase-coverage"),
  blueprintClause("BLUEPRINT-10", "GRASSEYE-DOM-010-V1", "Acceptance commands exist, stay auxiliary, and are validated under the single CI-FULL chain.", "runtime_smoke", "acceptance-runtime"),
  blueprintClause("BLUEPRINT-11", "GRASSEYE-DOM-009-V1", "Risk boundaries stop on login, captcha, ambiguity, sensitive submit, and unverified upload states.", "anti_escape", "phase-coverage"),
  blueprintClause("BLUEPRINT-12", "GRASSEYE-DOM-001-V1", "DOM capability closes as reusable page-structure automation, not as an Amazon-only script or second agent runtime.", "symbol", "ci-entry"),
] as const;
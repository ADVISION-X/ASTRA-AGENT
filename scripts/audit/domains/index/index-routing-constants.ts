import { indexInspectionConstants } from "./inspection-constants.js";

export type ModuleTarget = {
  triggerText: string;
  moduleFile: string;
  noteText: string;
  lineNumber: number;
};

export type ParsedIndexLawDocument = {
  lines: string[];
  frontmatter: Record<string, string>;
  bodyLines: string[];
  roleLineNumber: number;
  roleLine: string | null;
  authorityLineNumber: number;
  authorityLine: string | null;
  moduleTargets: ModuleTarget[];
};

type RouteRowRequirement = {
  requirementId: string;
  triggerText: string;
  moduleFile: string;
  noteText: string;
};

export const indexRoutingRuleConstants = {
  ...indexInspectionConstants,
  EXPECTED_APPLY_TO: ".github/instructions/cursor-rules/**",
  EXPECTED_ROLE_LINE: "Role: locate active GrassEye laws for the current repository only.",
  EXPECTED_AUTHORITY_LINE: "Authority: this file is authoritative only for GrassEye law routing.",
  EXPECTED_NARROWEST_LINE: "Index only locates the narrowest current authority.",
  EXPECTED_MATCH_RULE: "- Match the narrowest domain by path and task keywords.",
  EXPECTED_TIE_BREAK_RULE: "- When two modules appear close, choose the one that directly owns the decision or record boundary.",
  EXPECTED_ALLOWED_ROUTE_LINE: "- Index may route only to the current execution owners, support evidence surfaces, and foundation laws declared by Kernel.",
  EXPECTED_HISTORICAL_REMAP_LINE: "- Deleted historical owner names may appear only as remap triggers to a current owner; they must never route to absent modules.",
  EXPECTED_ABSENT_HISTORICAL_PATH_LINE: "- Do not activate absent historical paths.",
  EXPECTED_FUTURE_PATTERN_LINE: "- Do not use broad patterns to revive future capabilities.",
  EXPECTED_DEBUG_LOOP_LINE: "- local-development-tooling stays outside active law routing and must not be revived as an active ability group.",
  EXPECTED_DELETED_OWNER_CATALOG_LINE: "- Deleted owner names such as agent-runtime, agent-mechanical-skills, agent-browse-flow, evidence-packet, vision-boundary, visual-only-runtime, visual-action-capability, comment-intelligence, product-signal, and operator-control.",
  MODULE_LAW_ROOT: ".github/instructions/cursor-rules/modules",
  APPLY_TO_NEEDLE: "Index routing law must scope applyTo to the local GrassEye instruction tree.",
  ROLE_NEEDLE: "Index routing law must restrict its role to the current repository only.",
  AUTHORITY_NEEDLE: "Index routing law must declare authority only for GrassEye law routing.",
  MODULE_PATH_NEEDLE: "Index routing table must resolve only to existing GrassEye module law files.",
  NARROWEST_NEEDLE: "Index routing law must keep the narrowest-current-authority statement intact.",
  NARROWEST_RULE_NEEDLE: "Index routing rules must require choosing the narrowest direct authority.",
  ALLOWED_ROUTE_NEEDLE: "Index routing law must keep the current-domain-only route boundary intact.",
  ALLOWED_ROUTE_SET_NEEDLE: "Index routing table must stay within active ability-group and foundation-law routes only.",
  HISTORICAL_REMAP_NEEDLE: "Index routing law must keep the deleted-historical-owner remap boundary intact.",
  HISTORICAL_REMAP_TARGET_NEEDLE: "Deleted historical owner remap must resolve only to an existing current module law file.",
  ABSENT_HISTORICAL_PATH_NEEDLE: "Index routing law must keep the absent-historical-path ban intact.",
  ABSENT_HISTORICAL_PATH_TARGET_NEEDLE: "Index routing file must not activate absent historical paths.",
  FUTURE_PATTERN_NEEDLE: "Index routing law must keep the anti-future-capability broad-pattern ban intact.",
  FUTURE_PATTERN_TARGET_NEEDLE: "Index route triggers must not use broad future-capability revival patterns.",
  DEBUG_LOOP_NEEDLE: "Index routing law must keep local-development-tooling outside active law routing.",
  DEBUG_LOOP_TARGET_NEEDLE: "Index routing table must not revive local-development-tooling as an active routed trigger.",
  DELETED_OWNER_CATALOG_NEEDLE: "Index routing law must keep the deleted-owner catalog line intact.",
} as const;

export const indexRoutingRouteCatalog = {
  allowedRouteModules: new Set([
    "module-commander-console-capability.instructions.md",
    "module-capability-group-governance.instructions.md",
    "module-orchestration-capability.instructions.md",
    "module-nerve-bus-capability.instructions.md",
    "module-ai-capability.instructions.md",
    "module-open-capability.instructions.md",
    "module-screenshot-capability.instructions.md",
    "module-visual-target-capability.instructions.md",
    "module-geometry-guard-capability.instructions.md",
    "module-mouse-click-capability.instructions.md",
    "module-text-input-capability.instructions.md",
    "module-mouse-scroll-capability.instructions.md",
    "module-post-action-verification-capability.instructions.md",
    "module-forensics-persistence-capability.instructions.md",
    "module-security-privacy.instructions.md",
    "module-code-purity.instructions.md",
    "module-type-safety.instructions.md",
    "module-audit-system.instructions.md",
  ]),
  historicalOwnerTokens: [
    "agent-runtime",
    "agent-mechanical-skills",
    "agent-browse-flow",
    "evidence-packet",
    "vision-boundary",
    "visual-only-runtime",
    "visual-action-capability",
    "comment-intelligence",
    "product-signal",
    "operator-control",
  ] as const,
  absentHistoricalModuleFiles: new Set([
    "module-agent-runtime.instructions.md",
    "module-agent-mechanical-skills.instructions.md",
    "module-agent-browse-flow.instructions.md",
    "module-evidence-packet.instructions.md",
    "module-vision-boundary.instructions.md",
    "module-visual-only-runtime.instructions.md",
    "module-visual-action-capability.instructions.md",
    "module-comment-intelligence.instructions.md",
    "module-product-signal.instructions.md",
    "module-operator-control.instructions.md",
  ]),
  forbiddenFuturePatternTokens: [
    "future capability",
    "future capabilities",
    "inactive capability",
    "inactive capabilities",
    "any capability",
    "any module",
    "future module",
  ] as const,
  routeRowRequirements: [
    {
      requirementId: "K02-ROUTE-REQ-009",
      triggerText: "commander console, human command, mission dashboard, owner evidence timeline, review queue, audit summary, manual override, candidate pool, operator review",
      moduleFile: "module-commander-console-capability.instructions.md",
      noteText: "Human entry and console reads only",
    },
    {
      requirementId: "K02-ROUTE-REQ-010",
      triggerText: "ability group, child ability, atomic action, muscle memory, capability registry, shared ability contract, currentStrength, debug proof contract, forbidden responsibilities, orchestration matrix, capability catalog, catalog generated from abilities",
      moduleFile: "module-capability-group-governance.instructions.md",
      noteText: "Shared ability-group governance and registry definition only",
    },
    {
      requirementId: "K02-ROUTE-REQ-011",
      triggerText: "nerve bus, command transport, command envelope, result envelope, ai request envelope, ai response envelope, transfer proof, channel routing",
      moduleFile: "module-nerve-bus-capability.instructions.md",
      noteText: "Governed transport authority only",
    },
    {
      requirementId: "K02-ROUTE-REQ-012",
      triggerText: "ai ability group, first AI question, visual mission judge, visual mission action plan, current page meaning, blocker judgment, target identity, prompt registry, prompt contract, prompt content, output schema ref, ability manual, compose registered capabilities, local model, OCR provider, provider routing",
      moduleFile: "module-ai-capability.instructions.md",
      noteText: "AI owns judgment; load Forensics or Commander only when persistence or review is the real boundary",
    },
    {
      requirementId: "K02-ROUTE-REQ-013",
      triggerText: "src/capabilities/open, open ability group, open capability, open-tiktok, open-facebook, open-local-workbench, open result, capability-check, open proof",
      moduleFile: "module-open-capability.instructions.md",
      noteText: "Open capability authority only",
    },
    {
      requirementId: "K02-ROUTE-REQ-014",
      triggerText: "src/capabilities/screenshot, screenshot ability group, screenshot capability, imageKind, coordinateSpace, scaleMapping, ai_input, evidence_original, evidence_optimized, capture-region, optimize-lossless, prepare-ai-input",
      moduleFile: "module-screenshot-capability.instructions.md",
      noteText: "Screenshot capability authority only",
    },
    {
      requirementId: "K02-ROUTE-REQ-015",
      triggerText: "visual target, target bbox, target confidence, target catalog, candidate selection, clickPoint",
      moduleFile: "module-visual-target-capability.instructions.md",
      noteText: "Visual target authority only",
    },
    {
      requirementId: "K02-ROUTE-REQ-016",
      triggerText: "src/capabilities/mouse-click, mouse click, click capability, primitive click, browser click, screen click",
      moduleFile: "module-mouse-click-capability.instructions.md",
      noteText: "Mouse click primitive authority only",
    },
    {
      requirementId: "K02-ROUTE-REQ-017",
      triggerText: "src/capabilities/text-input, text input, type text, paste text, clear input, replace input, press key, commit input, keyboard input, input target",
      moduleFile: "module-text-input-capability.instructions.md",
      noteText: "Text input write authority only",
    },
    {
      requirementId: "K02-ROUTE-REQ-018",
      triggerText: "src/capabilities/mouse-scroll, mouse scroll ability group, scroll capability, wheel scroll, scroll magnitude, region-wheel-scroll, browser-viewport-scroll, desktop-screen-scroll",
      moduleFile: "module-mouse-scroll-capability.instructions.md",
      noteText: "Mouse scroll capability authority only",
    },
    {
      requirementId: "K02-ROUTE-REQ-019",
      triggerText: "post-action verification, action result verification, verification packaging, result proof, after-click verification, after-scroll verification",
      moduleFile: "module-post-action-verification-capability.instructions.md",
      noteText: "Observation packaging and proof packaging only",
    },
    {
      requirementId: "K02-ROUTE-REQ-021",
      triggerText: "evidence packet, browse ledger, failed record, runtime snapshot, forensics handoff, record envelope, record ref, artifact ref, packet schema, operator snapshot, review record",
      moduleFile: "module-forensics-persistence-capability.instructions.md",
      noteText: "Forensics record ownership only",
    },
    {
      requirementId: "K02-ROUTE-REQ-022",
      triggerText: "credentials, cookies, session, token, privacy, sensitive screenshot, authorized account, privacy prompt boundary",
      moduleFile: "module-security-privacy.instructions.md",
      noteText: "Security and privacy only",
    },
    {
      requirementId: "K02-ROUTE-REQ-023",
      triggerText: "file length, function length, code purity, atomicity, nesting depth, complexity, dead code, commented-out code, debug leftovers, TODO hygiene, compatibility bridge, god function, giant function, god file, owner mixing",
      moduleFile: "module-code-purity.instructions.md",
      noteText: "Code Purity foundation law; audit-system only owns runner and enforcement plumbing",
    },
    {
      requirementId: "K02-ROUTE-REQ-024",
      triggerText: "src/types, strict mode, unknown, schema validation, action payload, no any",
      moduleFile: "module-type-safety.instructions.md",
      noteText: "Type boundary only",
    },
    {
      requirementId: "K02-ROUTE-REQ-025",
      triggerText: "test file, tests directory, npm test, mock gate, quality gate authority",
      moduleFile: "module-audit-system.instructions.md",
      noteText: "Audit authority over quality gates only",
    },
    {
      requirementId: "K02-ROUTE-REQ-026",
      triggerText: "scripts/audit, owner boundary, report format, generated artifacts, inspector, enforcement",
      moduleFile: "module-audit-system.instructions.md",
      noteText: "Audit governance only; generated artifacts are support evidence, not authority truth",
    },
  ] as RouteRowRequirement[],
} as const;

export const buildRouteRowNeedle = (requirementId: string): string =>
  `Index routing row ${requirementId} must keep its exact trigger, target module, and routing note.`;

export const buildRouteRowPhaseName = (requirementId: string): string =>
  `route-row-${requirementId.toLowerCase()}`;
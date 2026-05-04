import { fileExists, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { indexInspectionConstants } from "./inspection-constants.js";

type FrontmatterRecord = Record<string, string>;

type ParsedIndexLawDocument = {
  lines: string[];
  frontmatter: FrontmatterRecord;
  bodyLines: string[];
  roleLineNumber: number;
  roleLine: string | null;
  authorityLineNumber: number;
  authorityLine: string | null;
  moduleTargets: Array<{ triggerText: string; moduleFile: string; noteText: string; lineNumber: number }>;
};

type RouteRowRequirement = {
  requirementId: string;
  triggerText: string;
  moduleFile: string;
  noteText: string;
};

const {
  INDEX_FILE,
  REQUIREMENT_ID_001,
  REQUIREMENT_ID_002,
} = indexInspectionConstants;

const EXPECTED_APPLY_TO = ".github/instructions/cursor-rules/**";
const EXPECTED_ROLE_LINE = "Role: locate active GrassEye laws for the current repository only.";
const EXPECTED_AUTHORITY_LINE = "Authority: this file is authoritative only for GrassEye law routing.";
const EXPECTED_NARROWEST_LINE = "Index only locates the narrowest current authority.";
const EXPECTED_MATCH_RULE = "- Match the narrowest domain by path and task keywords.";
const EXPECTED_TIE_BREAK_RULE = "- When two modules appear close, choose the one that directly owns the decision or record boundary.";
const EXPECTED_ALLOWED_ROUTE_LINE = "- Index may route only to the 14 active ability groups, foundation laws, and explicit support-governance domains.";
const EXPECTED_HISTORICAL_REMAP_LINE = "- Deleted historical owner names may appear only as remap triggers to a current owner; they must never route to absent modules.";
const EXPECTED_ABSENT_HISTORICAL_PATH_LINE = "- Do not activate absent historical paths.";
const EXPECTED_FUTURE_PATTERN_LINE = "- Do not use broad patterns to revive future capabilities.";
const EXPECTED_DEBUG_LOOP_LINE = "- debug-loop-controller stays outside active law routing and must not be revived as an active ability group.";
const EXPECTED_DELETED_OWNER_CATALOG_LINE = "- Deleted owner names such as agent-runtime, agent-mechanical-skills, agent-browse-flow, evidence-packet, vision-boundary, visual-only-runtime, visual-action-capability, comment-intelligence, product-signal, and operator-control.";
const MODULE_LAW_ROOT = ".github/instructions/cursor-rules/modules";
const ALLOWED_ROUTE_MODULES = new Set([
  "module-commander-console-capability.instructions.md",
  "module-capability-group-governance.instructions.md",
  "module-orchestration-capability.instructions.md",
  "module-map-plugin-package.instructions.md",
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
  "module-page-state-capability.instructions.md",
  "module-forensics-persistence-capability.instructions.md",
  "module-security-privacy.instructions.md",
  "module-code-purity.instructions.md",
  "module-type-safety.instructions.md",
  "module-audit-system.instructions.md",
]);
const HISTORICAL_OWNER_TOKENS = [
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
] as const;
const ABSENT_HISTORICAL_MODULE_FILES = new Set([
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
]);
const FORBIDDEN_FUTURE_PATTERN_TOKENS = [
  "future capability",
  "future capabilities",
  "inactive capability",
  "inactive capabilities",
  "any capability",
  "any module",
  "future module",
] as const;
const APPLY_TO_NEEDLE = "Index routing law must scope applyTo to the local GrassEye instruction tree.";
const ROLE_NEEDLE = "Index routing law must restrict its role to the current repository only.";
const AUTHORITY_NEEDLE = "Index routing law must declare authority only for GrassEye law routing.";
const MODULE_PATH_NEEDLE = "Index routing table must resolve only to existing GrassEye module law files.";
const NARROWEST_NEEDLE = "Index routing law must keep the narrowest-current-authority statement intact.";
const NARROWEST_RULE_NEEDLE = "Index routing rules must require choosing the narrowest direct authority.";
const ALLOWED_ROUTE_NEEDLE = "Index routing law must keep the current-domain-only route boundary intact.";
const ALLOWED_ROUTE_SET_NEEDLE = "Index routing table must stay within active ability-group, foundation-law, and explicit support-governance routes only.";
const HISTORICAL_REMAP_NEEDLE = "Index routing law must keep the deleted-historical-owner remap boundary intact.";
const HISTORICAL_REMAP_TARGET_NEEDLE = "Deleted historical owner remap must resolve only to an existing current module law file.";
const ABSENT_HISTORICAL_PATH_NEEDLE = "Index routing law must keep the absent-historical-path ban intact.";
const ABSENT_HISTORICAL_PATH_TARGET_NEEDLE = "Index routing file must not activate absent historical paths.";
const FUTURE_PATTERN_NEEDLE = "Index routing law must keep the anti-future-capability broad-pattern ban intact.";
const FUTURE_PATTERN_TARGET_NEEDLE = "Index route triggers must not use broad future-capability revival patterns.";
const DEBUG_LOOP_NEEDLE = "Index routing law must keep debug-loop-controller outside active law routing.";
const DEBUG_LOOP_TARGET_NEEDLE = "Index routing table must not revive debug-loop-controller as an active routed trigger.";
const DELETED_OWNER_CATALOG_NEEDLE = "Index routing law must keep the deleted-owner catalog line intact.";

const ROUTE_ROW_REQUIREMENTS: RouteRowRequirement[] = [
  {
    requirementId: "K02-ROUTE-REQ-009",
    triggerText: "commander console, human command, mission dashboard, runtime proof timeline, review queue, audit summary, manual override, candidate pool, operator review",
    moduleFile: "module-commander-console-capability.instructions.md",
    noteText: "Human entry and console reads only",
  },
  {
    requirementId: "K02-ROUTE-REQ-010",
    triggerText: "ability group, child ability, shared ability contract, currentStrength, debug proof contract, forbidden responsibilities, orchestration matrix, capability catalog, catalog generated from abilities",
    moduleFile: "module-capability-group-governance.instructions.md",
    noteText: "Shared ability-group governance only",
  },
  {
    requirementId: "K02-ROUTE-REQ-011",
    triggerText: "nerve bus, command transport, command envelope, result envelope, ai request envelope, ai response envelope, transfer proof, channel routing",
    moduleFile: "module-nerve-bus-capability.instructions.md",
    noteText: "Governed transport authority only",
  },
  {
    requirementId: "K02-ROUTE-REQ-012",
    triggerText: "ai ability group, first AI question, product presence judgment, comments OCR, intent analysis, pain point, complaint signal, opportunity synthesis, product signal, score, local model, prompt registry, prompt contract, prompt content, output schema ref",
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
    triggerText: "post-action verification, action result verification, verification decision, result proof, after-click verification, after-scroll verification",
    moduleFile: "module-post-action-verification-capability.instructions.md",
    noteText: "Verification truth only",
  },
  {
    requirementId: "K02-ROUTE-REQ-020",
    triggerText: "page state, page readiness, login wall, modal overlay, platform page kind, comment panel state, safety page",
    moduleFile: "module-page-state-capability.instructions.md",
    noteText: "Page-state truth only",
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
    noteText: "Audit governance only",
  },
];

const stripQuotedValue = (value: string): string => {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const isMarkdownSeparatorRow = (cells: string[]): boolean =>
  cells.every((cell) => /^-+$/.test(cell.replace(/ /g, "")));

const parseActiveModuleTargets = (lines: string[]): Array<{ triggerText: string; moduleFile: string; noteText: string; lineNumber: number }> => {
  const headingIndex = lines.findIndex((line) => line.trim() === "## Active Module Routes");
  if (headingIndex === -1) {
    return [];
  }

  const moduleTargets: Array<{ triggerText: string; moduleFile: string; noteText: string; lineNumber: number }> = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const rawLine = lines[index]?.trim() ?? "";
    if (!rawLine) {
      if (moduleTargets.length > 0) {
        break;
      }
      continue;
    }

    if (!rawLine.startsWith("|")) {
      if (moduleTargets.length > 0) {
        break;
      }
      continue;
    }

    const cells = rawLine.split("|").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length !== 3 || cells[0] === "Path or trigger" || isMarkdownSeparatorRow(cells)) {
      continue;
    }

    const [triggerText = "", moduleFile = "", noteText = ""] = cells;
    if (!triggerText || !moduleFile || !noteText) {
      continue;
    }

    moduleTargets.push({
      triggerText,
      moduleFile,
      noteText,
      lineNumber: index + 1,
    });
  }

  return moduleTargets;
};

const extractSectionLines = (lines: string[], heading: string): string[] => {
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex === -1) {
    return [];
  }

  const sectionLines: string[] = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.startsWith("## ")) {
      break;
    }
    sectionLines.push(line.trim());
  }

  return sectionLines;
};

const buildRouteRowNeedle = (requirementId: string): string =>
  `Index routing row ${requirementId} must keep its exact trigger, target module, and routing note.`;

const buildRouteRowPhaseName = (requirementId: string): string =>
  `route-row-${requirementId.toLowerCase()}`;

const parseIndexLawDocument = (content: string): ParsedIndexLawDocument | null => {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") {
    return null;
  }

  const frontmatter: FrontmatterRecord = {};
  let cursor = 1;
  for (; cursor < lines.length; cursor += 1) {
    const rawLine = lines[cursor] ?? "";
    if (rawLine.trim() === "---") {
      cursor += 1;
      break;
    }

    const separatorIndex = rawLine.indexOf(":");
    if (separatorIndex <= 0) {
      return null;
    }

    const key = rawLine.slice(0, separatorIndex).trim();
    const value = stripQuotedValue(rawLine.slice(separatorIndex + 1));
    if (!key) {
      return null;
    }

    frontmatter[key] = value;
  }

  if (cursor > lines.length) {
    return null;
  }

  const bodyLines = lines.slice(cursor);
  const roleIndex = bodyLines.findIndex((line) => line.startsWith("Role:"));
  const authorityIndex = bodyLines.findIndex((line) => line.startsWith("Authority:"));
  return {
    lines,
    frontmatter,
    bodyLines,
    roleLineNumber: roleIndex === -1 ? 1 : cursor + roleIndex + 1,
    roleLine: roleIndex === -1 ? null : (bodyLines[roleIndex] ?? "").trim(),
    authorityLineNumber: authorityIndex === -1 ? 1 : cursor + authorityIndex + 1,
    authorityLine: authorityIndex === -1 ? null : (bodyLines[authorityIndex] ?? "").trim(),
    moduleTargets: parseActiveModuleTargets(lines),
  };
};

export async function runIndexRoutingChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const repoLocalScopeFindings: Finding[] = [];
  const routingAuthorityFindings: Finding[] = [];
  const narrowestAuthorityFindings: Finding[] = [];
  const allowedRouteFindings: Finding[] = [];
  const historicalRemapFindings: Finding[] = [];
  const absentHistoricalPathFindings: Finding[] = [];
  const futurePatternFindings: Finding[] = [];
  const debugLoopFindings: Finding[] = [];
  const routeRowFindings: Finding[] = [];
  const deletedOwnerCatalogFindings: Finding[] = [];
  const content = await readTextFile(pathFromRepoRoot(INDEX_FILE));
  const parsed = parseIndexLawDocument(content);

  if (!parsed) {
    repoLocalScopeFindings.push(createFinding({
      lawId: REQUIREMENT_ID_001,
      file: INDEX_FILE,
      line: 1,
      severity: "fatal",
      message: "Index routing law must keep a parseable frontmatter schema and markdown body.",
    }));
    routingAuthorityFindings.push(createFinding({
      lawId: REQUIREMENT_ID_002,
      file: INDEX_FILE,
      line: 1,
      severity: "fatal",
      message: "Index routing law must stay parseable before authority-routing checks can run.",
    }));
    narrowestAuthorityFindings.push(createFinding({
      lawId: indexInspectionConstants.REQUIREMENT_ID_003,
      file: INDEX_FILE,
      line: 1,
      severity: "fatal",
      message: "Index routing law must stay parseable before narrowest-authority checks can run.",
    }));
    allowedRouteFindings.push(createFinding({
      lawId: indexInspectionConstants.REQUIREMENT_ID_004,
      file: INDEX_FILE,
      line: 1,
      severity: "fatal",
      message: "Index routing law must stay parseable before current-route-domain checks can run.",
    }));
    historicalRemapFindings.push(createFinding({
      lawId: indexInspectionConstants.REQUIREMENT_ID_005,
      file: INDEX_FILE,
      line: 1,
      severity: "fatal",
      message: "Index routing law must stay parseable before historical-remap checks can run.",
    }));
    absentHistoricalPathFindings.push(createFinding({
      lawId: indexInspectionConstants.REQUIREMENT_ID_006,
      file: INDEX_FILE,
      line: 1,
      severity: "fatal",
      message: "Index routing law must stay parseable before absent-historical-path checks can run.",
    }));
    futurePatternFindings.push(createFinding({
      lawId: indexInspectionConstants.REQUIREMENT_ID_007,
      file: INDEX_FILE,
      line: 1,
      severity: "fatal",
      message: "Index routing law must stay parseable before future-pattern checks can run.",
    }));
    debugLoopFindings.push(createFinding({
      lawId: indexInspectionConstants.REQUIREMENT_ID_008,
      file: INDEX_FILE,
      line: 1,
      severity: "fatal",
      message: "Index routing law must stay parseable before debug-loop-controller checks can run.",
    }));
    routeRowFindings.push(...ROUTE_ROW_REQUIREMENTS.map((requirement) => createFinding({
      lawId: requirement.requirementId,
      file: INDEX_FILE,
      line: 1,
      severity: "fatal",
      message: `Index routing law must stay parseable before ${requirement.requirementId} row checks can run.`,
    })));
    deletedOwnerCatalogFindings.push(createFinding({
      lawId: "K02-ROUTE-REQ-027",
      file: INDEX_FILE,
      line: 1,
      severity: "fatal",
      message: "Index routing law must stay parseable before deleted-owner catalog checks can run.",
    }));
  } else {
    const alwaysLoadedSection = extractSectionLines(parsed.lines, "## Always Loaded Files");
    const routingRulesSection = extractSectionLines(parsed.lines, "## Routing Rules");

    if (parsed.frontmatter.applyTo !== EXPECTED_APPLY_TO) {
      repoLocalScopeFindings.push(createFinding({
        lawId: REQUIREMENT_ID_001,
        file: INDEX_FILE,
        line: 1,
        severity: "fatal",
        message: APPLY_TO_NEEDLE,
        detail: `actual applyTo: ${parsed.frontmatter.applyTo ?? "<missing>"}`,
      }));
    }

    if (parsed.roleLine !== EXPECTED_ROLE_LINE) {
      repoLocalScopeFindings.push(createFinding({
        lawId: REQUIREMENT_ID_001,
        file: INDEX_FILE,
        line: parsed.roleLineNumber,
        severity: "fatal",
        message: ROLE_NEEDLE,
        detail: `actual role: ${parsed.roleLine ?? "<missing>"}`,
      }));
    }

    if (parsed.authorityLine !== EXPECTED_AUTHORITY_LINE) {
      routingAuthorityFindings.push(createFinding({
        lawId: REQUIREMENT_ID_002,
        file: INDEX_FILE,
        line: parsed.authorityLineNumber,
        severity: "fatal",
        message: AUTHORITY_NEEDLE,
        detail: `actual authority: ${parsed.authorityLine ?? "<missing>"}`,
      }));
    }

    if (parsed.moduleTargets.length === 0) {
      routingAuthorityFindings.push(createFinding({
        lawId: REQUIREMENT_ID_002,
        file: INDEX_FILE,
        line: 1,
        severity: "fatal",
        message: MODULE_PATH_NEEDLE,
        detail: "Missing or unreadable Active Module Routes table.",
      }));
    }

    for (const moduleTarget of parsed.moduleTargets) {
      const modulePath = `${MODULE_LAW_ROOT}/${moduleTarget.moduleFile}`;
      const looksLikeModuleLaw = moduleTarget.moduleFile.startsWith("module-")
        && moduleTarget.moduleFile.endsWith(".instructions.md")
        && !moduleTarget.moduleFile.includes("/");
      if (!looksLikeModuleLaw || !(await fileExists(pathFromRepoRoot(modulePath)))) {
        routingAuthorityFindings.push(createFinding({
          lawId: REQUIREMENT_ID_002,
          file: INDEX_FILE,
          line: moduleTarget.lineNumber,
          severity: "fatal",
          message: MODULE_PATH_NEEDLE,
          detail: `invalid module target: ${moduleTarget.moduleFile}`,
        }));
      }
    }

    if (!alwaysLoadedSection.includes(EXPECTED_NARROWEST_LINE)) {
      narrowestAuthorityFindings.push(createFinding({
        lawId: indexInspectionConstants.REQUIREMENT_ID_003,
        file: INDEX_FILE,
        line: 1,
        severity: "fatal",
        message: NARROWEST_NEEDLE,
      }));
    }

    if (!routingRulesSection.includes(EXPECTED_MATCH_RULE) || !routingRulesSection.includes(EXPECTED_TIE_BREAK_RULE)) {
      narrowestAuthorityFindings.push(createFinding({
        lawId: indexInspectionConstants.REQUIREMENT_ID_003,
        file: INDEX_FILE,
        line: 1,
        severity: "fatal",
        message: NARROWEST_RULE_NEEDLE,
      }));
    }

    if (!routingRulesSection.includes(EXPECTED_ALLOWED_ROUTE_LINE)) {
      allowedRouteFindings.push(createFinding({
        lawId: indexInspectionConstants.REQUIREMENT_ID_004,
        file: INDEX_FILE,
        line: 1,
        severity: "fatal",
        message: ALLOWED_ROUTE_NEEDLE,
      }));
    }

    for (const moduleTarget of parsed.moduleTargets) {
      if (!ALLOWED_ROUTE_MODULES.has(moduleTarget.moduleFile)) {
        allowedRouteFindings.push(createFinding({
          lawId: indexInspectionConstants.REQUIREMENT_ID_004,
          file: INDEX_FILE,
          line: moduleTarget.lineNumber,
          severity: "fatal",
          message: ALLOWED_ROUTE_SET_NEEDLE,
          detail: `unexpected route target: ${moduleTarget.moduleFile}`,
        }));
      }
    }

    if (!routingRulesSection.includes(EXPECTED_HISTORICAL_REMAP_LINE)) {
      historicalRemapFindings.push(createFinding({
        lawId: indexInspectionConstants.REQUIREMENT_ID_005,
        file: INDEX_FILE,
        line: 1,
        severity: "fatal",
        message: HISTORICAL_REMAP_NEEDLE,
      }));
    }

    for (const moduleTarget of parsed.moduleTargets) {
      const mentionsHistoricalOwner = HISTORICAL_OWNER_TOKENS.some((token) => moduleTarget.triggerText.includes(token));
      const pointsToHistoricalModule = HISTORICAL_OWNER_TOKENS.some((token) => moduleTarget.moduleFile.includes(token));
      if (!mentionsHistoricalOwner && !pointsToHistoricalModule) {
        continue;
      }

      const modulePath = `${MODULE_LAW_ROOT}/${moduleTarget.moduleFile}`;
      const targetExists = await fileExists(pathFromRepoRoot(modulePath));
      const isCurrentModule = ALLOWED_ROUTE_MODULES.has(moduleTarget.moduleFile) && targetExists;
      if (!isCurrentModule) {
        historicalRemapFindings.push(createFinding({
          lawId: indexInspectionConstants.REQUIREMENT_ID_005,
          file: INDEX_FILE,
          line: moduleTarget.lineNumber,
          severity: "fatal",
          message: HISTORICAL_REMAP_TARGET_NEEDLE,
          detail: `${moduleTarget.triggerText} -> ${moduleTarget.moduleFile}`,
        }));
      }
    }

    if (!routingRulesSection.includes(EXPECTED_ABSENT_HISTORICAL_PATH_LINE)) {
      absentHistoricalPathFindings.push(createFinding({
        lawId: indexInspectionConstants.REQUIREMENT_ID_006,
        file: INDEX_FILE,
        line: 1,
        severity: "fatal",
        message: ABSENT_HISTORICAL_PATH_NEEDLE,
      }));
    }

    for (const moduleTarget of parsed.moduleTargets) {
      if (!ABSENT_HISTORICAL_MODULE_FILES.has(moduleTarget.moduleFile)) {
        continue;
      }

      absentHistoricalPathFindings.push(createFinding({
        lawId: indexInspectionConstants.REQUIREMENT_ID_006,
        file: INDEX_FILE,
        line: moduleTarget.lineNumber,
        severity: "fatal",
        message: ABSENT_HISTORICAL_PATH_TARGET_NEEDLE,
        detail: moduleTarget.moduleFile,
      }));
    }

    if (!routingRulesSection.includes(EXPECTED_FUTURE_PATTERN_LINE)) {
      futurePatternFindings.push(createFinding({
        lawId: indexInspectionConstants.REQUIREMENT_ID_007,
        file: INDEX_FILE,
        line: 1,
        severity: "fatal",
        message: FUTURE_PATTERN_NEEDLE,
      }));
    }

    for (const moduleTarget of parsed.moduleTargets) {
      const normalizedTriggerText = moduleTarget.triggerText.toLowerCase();
      if (!FORBIDDEN_FUTURE_PATTERN_TOKENS.some((token) => normalizedTriggerText.includes(token))) {
        continue;
      }

      futurePatternFindings.push(createFinding({
        lawId: indexInspectionConstants.REQUIREMENT_ID_007,
        file: INDEX_FILE,
        line: moduleTarget.lineNumber,
        severity: "fatal",
        message: FUTURE_PATTERN_TARGET_NEEDLE,
        detail: moduleTarget.triggerText,
      }));
    }

    if (!routingRulesSection.includes(EXPECTED_DEBUG_LOOP_LINE)) {
      debugLoopFindings.push(createFinding({
        lawId: indexInspectionConstants.REQUIREMENT_ID_008,
        file: INDEX_FILE,
        line: 1,
        severity: "fatal",
        message: DEBUG_LOOP_NEEDLE,
      }));
    }

    for (const moduleTarget of parsed.moduleTargets) {
      if (!moduleTarget.triggerText.toLowerCase().includes("debug-loop-controller")) {
        continue;
      }

      debugLoopFindings.push(createFinding({
        lawId: indexInspectionConstants.REQUIREMENT_ID_008,
        file: INDEX_FILE,
        line: moduleTarget.lineNumber,
        severity: "fatal",
        message: DEBUG_LOOP_TARGET_NEEDLE,
        detail: moduleTarget.triggerText,
      }));
    }

    for (const requirement of ROUTE_ROW_REQUIREMENTS) {
      const matchedRow = parsed.moduleTargets.find((moduleTarget) =>
        moduleTarget.triggerText === requirement.triggerText
        && moduleTarget.moduleFile === requirement.moduleFile
        && moduleTarget.noteText === requirement.noteText,
      );
      if (!matchedRow) {
        routeRowFindings.push(createFinding({
          lawId: requirement.requirementId,
          file: INDEX_FILE,
          line: 1,
          severity: "fatal",
          message: buildRouteRowNeedle(requirement.requirementId),
        }));
      }
    }

    const routingBoundarySection = extractSectionLines(parsed.lines, "## Routing Boundary Statement");
    if (!routingBoundarySection.includes(EXPECTED_DELETED_OWNER_CATALOG_LINE)) {
      deletedOwnerCatalogFindings.push(createFinding({
        lawId: "K02-ROUTE-REQ-027",
        file: INDEX_FILE,
        line: 1,
        severity: "fatal",
        message: DELETED_OWNER_CATALOG_NEEDLE,
      }));
    }
  }

  const findings = [
    ...repoLocalScopeFindings,
    ...routingAuthorityFindings,
    ...narrowestAuthorityFindings,
    ...allowedRouteFindings,
    ...historicalRemapFindings,
    ...absentHistoricalPathFindings,
    ...futurePatternFindings,
    ...debugLoopFindings,
    ...routeRowFindings,
    ...deletedOwnerCatalogFindings,
  ];

  const routeRowPhases = ROUTE_ROW_REQUIREMENTS.map((requirement) => {
    const requirementFindings = routeRowFindings.filter((finding) => finding.lawId === requirement.requirementId);
    return createPhase(
      buildRouteRowPhaseName(requirement.requirementId),
      requirementFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
      requirementFindings.length === 0,
      requirementFindings.length === 0
        ? `Index routing row ${requirement.requirementId} remains exact.`
        : `Index routing row ${requirement.requirementId} drifted away from the governed table row.`,
    );
  });

  return {
    findings,
    phases: [
      createPhase(
        "repo-local-routing-scope",
        findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
        findings.length === 0,
        findings.length === 0
          ? "Index routing law stays scoped to the current repository and local instruction tree."
          : "Index routing law drifted away from repo-local routing scope.",
      ),
      createPhase(
        "routing-authority-boundary",
        routingAuthorityFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
        routingAuthorityFindings.length === 0,
        routingAuthorityFindings.length === 0
          ? "Index routing file remains authoritative only for routing to existing GrassEye module laws."
          : "Index routing file drifted beyond routing-only authority or now points outside module law files.",
      ),
      createPhase(
        "narrowest-current-authority",
        narrowestAuthorityFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
        narrowestAuthorityFindings.length === 0,
        narrowestAuthorityFindings.length === 0
          ? "Index routing law keeps narrowest-authority selection explicit in its always-loaded and routing-rule sections."
          : "Index routing law drifted away from narrowest-current-authority routing.",
      ),
      createPhase(
        "allowed-current-route-domains",
        allowedRouteFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
        allowedRouteFindings.length === 0,
        allowedRouteFindings.length === 0
          ? "Index routing file only points to active ability-group, foundation-law, and explicit support-governance routes."
          : "Index routing file now points outside the current allowed route domains.",
      ),
      createPhase(
        "historical-remap-only",
        historicalRemapFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
        historicalRemapFindings.length === 0,
        historicalRemapFindings.length === 0
          ? "Deleted historical owner names stay constrained to remap-only routing toward current module laws."
          : "Deleted historical owner names drifted into absent-module routing or lost the remap-only boundary.",
      ),
      createPhase(
        "absent-historical-path-ban",
        absentHistoricalPathFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
        absentHistoricalPathFindings.length === 0,
        absentHistoricalPathFindings.length === 0
          ? "Index routing law does not activate absent historical paths."
          : "Index routing law drifted into activating absent historical paths.",
      ),
      createPhase(
        "future-capability-broad-pattern-ban",
        futurePatternFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
        futurePatternFindings.length === 0,
        futurePatternFindings.length === 0
          ? "Index routing law does not use broad patterns to revive future capabilities."
          : "Index routing law drifted into broad future-capability revival patterns.",
      ),
      createPhase(
        "debug-loop-outside-routing",
        debugLoopFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
        debugLoopFindings.length === 0,
        debugLoopFindings.length === 0
          ? "debug-loop-controller remains outside active law routing."
          : "debug-loop-controller drifted back into active law routing.",
      ),
      ...routeRowPhases,
      createPhase(
        "deleted-owner-catalog",
        deletedOwnerCatalogFindings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
        deletedOwnerCatalogFindings.length === 0,
        deletedOwnerCatalogFindings.length === 0
          ? "Index routing boundary statement keeps the deleted-owner catalog exact."
          : "Index routing boundary statement drifted away from the deleted-owner catalog.",
      ),
    ],
  };
}
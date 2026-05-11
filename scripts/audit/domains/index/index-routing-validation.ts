import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { extractSectionLines } from "./index-routing-parser.js";
import {
  buildRouteRowNeedle,
  buildRouteRowPhaseName,
  indexRoutingRouteCatalog,
  indexRoutingRuleConstants,
  type ParsedIndexLawDocument,
} from "./index-routing-constants.js";

const {
  INDEX_FILE,
  MODULE_LAW_ROOT,
  REQUIREMENT_ID_001,
  REQUIREMENT_ID_002,
  REQUIREMENT_ID_003,
  REQUIREMENT_ID_004,
  REQUIREMENT_ID_005,
  REQUIREMENT_ID_006,
  REQUIREMENT_ID_007,
  REQUIREMENT_ID_008,
  APPLY_TO_NEEDLE,
  AUTHORITY_NEEDLE,
  DEBUG_LOOP_NEEDLE,
  DEBUG_LOOP_TARGET_NEEDLE,
  DELETED_OWNER_CATALOG_NEEDLE,
  EXPECTED_ABSENT_HISTORICAL_PATH_LINE,
  EXPECTED_ALLOWED_ROUTE_LINE,
  EXPECTED_APPLY_TO,
  EXPECTED_AUTHORITY_LINE,
  EXPECTED_DEBUG_LOOP_LINE,
  EXPECTED_DELETED_OWNER_CATALOG_LINE,
  EXPECTED_FUTURE_PATTERN_LINE,
  EXPECTED_HISTORICAL_REMAP_LINE,
  EXPECTED_MATCH_RULE,
  EXPECTED_NARROWEST_LINE,
  ROLE_NEEDLE,
  EXPECTED_ROLE_LINE,
  EXPECTED_TIE_BREAK_RULE,
  FUTURE_PATTERN_NEEDLE,
  FUTURE_PATTERN_TARGET_NEEDLE,
  HISTORICAL_REMAP_NEEDLE,
  HISTORICAL_REMAP_TARGET_NEEDLE,
  MODULE_PATH_NEEDLE,
  NARROWEST_NEEDLE,
  NARROWEST_RULE_NEEDLE,
  ALLOWED_ROUTE_NEEDLE,
  ALLOWED_ROUTE_SET_NEEDLE,
  ABSENT_HISTORICAL_PATH_NEEDLE,
  ABSENT_HISTORICAL_PATH_TARGET_NEEDLE,
} = indexRoutingRuleConstants;

const {
  allowedRouteModules: ALLOWED_ROUTE_MODULES,
  historicalOwnerTokens: HISTORICAL_OWNER_TOKENS,
  absentHistoricalModuleFiles: ABSENT_HISTORICAL_MODULE_FILES,
  forbiddenFuturePatternTokens: FORBIDDEN_FUTURE_PATTERN_TOKENS,
  routeRowRequirements: ROUTE_ROW_REQUIREMENTS,
} = indexRoutingRouteCatalog;

type IndexRoutingFindingGroups = {
  repoLocalScopeFindings: Finding[];
  routingAuthorityFindings: Finding[];
  narrowestAuthorityFindings: Finding[];
  allowedRouteFindings: Finding[];
  historicalRemapFindings: Finding[];
  absentHistoricalPathFindings: Finding[];
  futurePatternFindings: Finding[];
  debugLoopFindings: Finding[];
  routeRowFindings: Finding[];
  deletedOwnerCatalogFindings: Finding[];
};

const createIndexRoutingFinding = (input: {
  lawId: string;
  line: number;
  message: string;
  detail?: string;
}): Finding => createFinding({
  lawId: input.lawId,
  file: INDEX_FILE,
  line: input.line,
  severity: "fatal",
  message: input.message,
  ...(input.detail ? { detail: input.detail } : {}),
});

const createRoutingPhase = (name: string, findings: Finding[], passMessage: string, failMessage: string): InspectorPhase => createPhase(
  name,
  findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
  findings.length === 0,
  findings.length === 0 ? passMessage : failMessage,
);

export const buildParseFailureRoutingFindings = (): IndexRoutingFindingGroups => ({
  repoLocalScopeFindings: [createIndexRoutingFinding({ lawId: REQUIREMENT_ID_001, line: 1, message: "Index routing law must keep a parseable frontmatter schema and markdown body." })],
  routingAuthorityFindings: [createIndexRoutingFinding({ lawId: REQUIREMENT_ID_002, line: 1, message: "Index routing law must stay parseable before authority-routing checks can run." })],
  narrowestAuthorityFindings: [createIndexRoutingFinding({ lawId: REQUIREMENT_ID_003, line: 1, message: "Index routing law must stay parseable before narrowest-authority checks can run." })],
  allowedRouteFindings: [createIndexRoutingFinding({ lawId: REQUIREMENT_ID_004, line: 1, message: "Index routing law must stay parseable before current-route-domain checks can run." })],
  historicalRemapFindings: [createIndexRoutingFinding({ lawId: REQUIREMENT_ID_005, line: 1, message: "Index routing law must stay parseable before historical-remap checks can run." })],
  absentHistoricalPathFindings: [createIndexRoutingFinding({ lawId: REQUIREMENT_ID_006, line: 1, message: "Index routing law must stay parseable before absent-historical-path checks can run." })],
  futurePatternFindings: [createIndexRoutingFinding({ lawId: REQUIREMENT_ID_007, line: 1, message: "Index routing law must stay parseable before future-pattern checks can run." })],
  debugLoopFindings: [createIndexRoutingFinding({ lawId: REQUIREMENT_ID_008, line: 1, message: "Index routing law must stay parseable before local-development-tooling checks can run." })],
  routeRowFindings: ROUTE_ROW_REQUIREMENTS.map((requirement) => createIndexRoutingFinding({ lawId: requirement.requirementId, line: 1, message: `Index routing law must stay parseable before ${requirement.requirementId} row checks can run.` })),
  deletedOwnerCatalogFindings: [createIndexRoutingFinding({ lawId: "K02-ROUTE-REQ-027", line: 1, message: "Index routing law must stay parseable before deleted-owner catalog checks can run." })],
});

const validateRepoLocalRoutingScope = (parsed: ParsedIndexLawDocument): Finding[] => {
  const findings: Finding[] = [];
  if (parsed.frontmatter.applyTo !== EXPECTED_APPLY_TO) {
    findings.push(createIndexRoutingFinding({ lawId: REQUIREMENT_ID_001, line: 1, message: APPLY_TO_NEEDLE, detail: `actual applyTo: ${parsed.frontmatter.applyTo ?? "<missing>"}` }));
  }
  if (parsed.roleLine !== EXPECTED_ROLE_LINE) {
    findings.push(createIndexRoutingFinding({ lawId: REQUIREMENT_ID_001, line: parsed.roleLineNumber, message: ROLE_NEEDLE, detail: `actual role: ${parsed.roleLine ?? "<missing>"}` }));
  }
  return findings;
};

const validateRoutingAuthority = async (parsed: ParsedIndexLawDocument): Promise<Finding[]> => {
  const findings: Finding[] = [];
  if (parsed.authorityLine !== EXPECTED_AUTHORITY_LINE) {
    findings.push(createIndexRoutingFinding({ lawId: REQUIREMENT_ID_002, line: parsed.authorityLineNumber, message: AUTHORITY_NEEDLE, detail: `actual authority: ${parsed.authorityLine ?? "<missing>"}` }));
  }
  if (parsed.moduleTargets.length === 0) {
    findings.push(createIndexRoutingFinding({ lawId: REQUIREMENT_ID_002, line: 1, message: MODULE_PATH_NEEDLE, detail: "Missing or unreadable Active Module Routes table." }));
  }

  for (const moduleTarget of parsed.moduleTargets) {
    const modulePath = `${MODULE_LAW_ROOT}/${moduleTarget.moduleFile}`;
    const looksLikeModuleLaw = moduleTarget.moduleFile.startsWith("module-") && moduleTarget.moduleFile.endsWith(".instructions.md") && !moduleTarget.moduleFile.includes("/");
    if (!looksLikeModuleLaw || !(await fileExists(pathFromRepoRoot(modulePath)))) {
      findings.push(createIndexRoutingFinding({ lawId: REQUIREMENT_ID_002, line: moduleTarget.lineNumber, message: MODULE_PATH_NEEDLE, detail: `invalid module target: ${moduleTarget.moduleFile}` }));
    }
  }

  return findings;
};

const validateNarrowestAuthority = (parsed: ParsedIndexLawDocument): Finding[] => {
  const findings: Finding[] = [];
  const alwaysLoadedSection = extractSectionLines(parsed.lines, "## Always Loaded Files");
  const routingRulesSection = extractSectionLines(parsed.lines, "## Routing Rules");

  if (!alwaysLoadedSection.includes(EXPECTED_NARROWEST_LINE)) {
    findings.push(createIndexRoutingFinding({ lawId: REQUIREMENT_ID_003, line: 1, message: NARROWEST_NEEDLE }));
  }
  if (!routingRulesSection.includes(EXPECTED_MATCH_RULE) || !routingRulesSection.includes(EXPECTED_TIE_BREAK_RULE)) {
    findings.push(createIndexRoutingFinding({ lawId: REQUIREMENT_ID_003, line: 1, message: NARROWEST_RULE_NEEDLE }));
  }

  return findings;
};

const validateAllowedRoutes = (parsed: ParsedIndexLawDocument): Finding[] => {
  const findings: Finding[] = [];
  const routingRulesSection = extractSectionLines(parsed.lines, "## Routing Rules");

  if (!routingRulesSection.includes(EXPECTED_ALLOWED_ROUTE_LINE)) {
    findings.push(createIndexRoutingFinding({ lawId: REQUIREMENT_ID_004, line: 1, message: ALLOWED_ROUTE_NEEDLE }));
  }
  for (const moduleTarget of parsed.moduleTargets) {
    if (!ALLOWED_ROUTE_MODULES.has(moduleTarget.moduleFile)) {
      findings.push(createIndexRoutingFinding({ lawId: REQUIREMENT_ID_004, line: moduleTarget.lineNumber, message: ALLOWED_ROUTE_SET_NEEDLE, detail: `unexpected route target: ${moduleTarget.moduleFile}` }));
    }
  }

  return findings;
};

const validateHistoricalRemap = async (parsed: ParsedIndexLawDocument): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const routingRulesSection = extractSectionLines(parsed.lines, "## Routing Rules");

  if (!routingRulesSection.includes(EXPECTED_HISTORICAL_REMAP_LINE)) {
    findings.push(createIndexRoutingFinding({ lawId: REQUIREMENT_ID_005, line: 1, message: HISTORICAL_REMAP_NEEDLE }));
  }
  for (const moduleTarget of parsed.moduleTargets) {
    const mentionsHistoricalOwner = HISTORICAL_OWNER_TOKENS.some((token) => moduleTarget.triggerText.includes(token));
    const pointsToHistoricalModule = HISTORICAL_OWNER_TOKENS.some((token) => moduleTarget.moduleFile.includes(token));
    if (!mentionsHistoricalOwner && !pointsToHistoricalModule) {
      continue;
    }

    const modulePath = `${MODULE_LAW_ROOT}/${moduleTarget.moduleFile}`;
    const isCurrentModule = ALLOWED_ROUTE_MODULES.has(moduleTarget.moduleFile) && await fileExists(pathFromRepoRoot(modulePath));
    if (!isCurrentModule) {
      findings.push(createIndexRoutingFinding({ lawId: REQUIREMENT_ID_005, line: moduleTarget.lineNumber, message: HISTORICAL_REMAP_TARGET_NEEDLE, detail: `${moduleTarget.triggerText} -> ${moduleTarget.moduleFile}` }));
    }
  }

  return findings;
};

const validateAbsentHistoricalPaths = (parsed: ParsedIndexLawDocument): Finding[] => {
  const findings: Finding[] = [];
  const routingRulesSection = extractSectionLines(parsed.lines, "## Routing Rules");

  if (!routingRulesSection.includes(EXPECTED_ABSENT_HISTORICAL_PATH_LINE)) {
    findings.push(createIndexRoutingFinding({ lawId: REQUIREMENT_ID_006, line: 1, message: ABSENT_HISTORICAL_PATH_NEEDLE }));
  }
  for (const moduleTarget of parsed.moduleTargets) {
    if (ABSENT_HISTORICAL_MODULE_FILES.has(moduleTarget.moduleFile)) {
      findings.push(createIndexRoutingFinding({ lawId: REQUIREMENT_ID_006, line: moduleTarget.lineNumber, message: ABSENT_HISTORICAL_PATH_TARGET_NEEDLE, detail: moduleTarget.moduleFile }));
    }
  }

  return findings;
};

const validateFuturePatterns = (parsed: ParsedIndexLawDocument): Finding[] => {
  const findings: Finding[] = [];
  const routingRulesSection = extractSectionLines(parsed.lines, "## Routing Rules");

  if (!routingRulesSection.includes(EXPECTED_FUTURE_PATTERN_LINE)) {
    findings.push(createIndexRoutingFinding({ lawId: REQUIREMENT_ID_007, line: 1, message: FUTURE_PATTERN_NEEDLE }));
  }
  for (const moduleTarget of parsed.moduleTargets) {
    const normalizedTriggerText = moduleTarget.triggerText.toLowerCase();
    if (FORBIDDEN_FUTURE_PATTERN_TOKENS.some((token) => normalizedTriggerText.includes(token))) {
      findings.push(createIndexRoutingFinding({ lawId: REQUIREMENT_ID_007, line: moduleTarget.lineNumber, message: FUTURE_PATTERN_TARGET_NEEDLE, detail: moduleTarget.triggerText }));
    }
  }

  return findings;
};

const validateDebugLoopRoutes = (parsed: ParsedIndexLawDocument): Finding[] => {
  const findings: Finding[] = [];
  const routingRulesSection = extractSectionLines(parsed.lines, "## Routing Rules");

  if (!routingRulesSection.includes(EXPECTED_DEBUG_LOOP_LINE)) {
    findings.push(createIndexRoutingFinding({ lawId: REQUIREMENT_ID_008, line: 1, message: DEBUG_LOOP_NEEDLE }));
  }
  for (const moduleTarget of parsed.moduleTargets) {
    if (moduleTarget.triggerText.toLowerCase().includes("local-development-tooling")) {
      findings.push(createIndexRoutingFinding({ lawId: REQUIREMENT_ID_008, line: moduleTarget.lineNumber, message: DEBUG_LOOP_TARGET_NEEDLE, detail: moduleTarget.triggerText }));
    }
  }

  return findings;
};

const validateRouteRows = (parsed: ParsedIndexLawDocument): Finding[] => {
  return ROUTE_ROW_REQUIREMENTS.flatMap((requirement) => {
    const matchedRow = parsed.moduleTargets.find((moduleTarget) => moduleTarget.triggerText === requirement.triggerText && moduleTarget.moduleFile === requirement.moduleFile && moduleTarget.noteText === requirement.noteText);
    return matchedRow ? [] : [createIndexRoutingFinding({ lawId: requirement.requirementId, line: 1, message: buildRouteRowNeedle(requirement.requirementId) })];
  });
};

const validateDeletedOwnerCatalog = (parsed: ParsedIndexLawDocument): Finding[] => {
  const routingBoundarySection = extractSectionLines(parsed.lines, "## Routing Boundary Statement");
  return routingBoundarySection.includes(EXPECTED_DELETED_OWNER_CATALOG_LINE)
    ? []
    : [createIndexRoutingFinding({ lawId: "K02-ROUTE-REQ-027", line: 1, message: DELETED_OWNER_CATALOG_NEEDLE })];
};

export const collectParsedRoutingFindings = async (parsed: ParsedIndexLawDocument): Promise<IndexRoutingFindingGroups> => ({
  repoLocalScopeFindings: validateRepoLocalRoutingScope(parsed),
  routingAuthorityFindings: await validateRoutingAuthority(parsed),
  narrowestAuthorityFindings: validateNarrowestAuthority(parsed),
  allowedRouteFindings: validateAllowedRoutes(parsed),
  historicalRemapFindings: await validateHistoricalRemap(parsed),
  absentHistoricalPathFindings: validateAbsentHistoricalPaths(parsed),
  futurePatternFindings: validateFuturePatterns(parsed),
  debugLoopFindings: validateDebugLoopRoutes(parsed),
  routeRowFindings: validateRouteRows(parsed),
  deletedOwnerCatalogFindings: validateDeletedOwnerCatalog(parsed),
});

export const collectIndexRoutingFindings = (groups: IndexRoutingFindingGroups): Finding[] => [
  ...groups.repoLocalScopeFindings,
  ...groups.routingAuthorityFindings,
  ...groups.narrowestAuthorityFindings,
  ...groups.allowedRouteFindings,
  ...groups.historicalRemapFindings,
  ...groups.absentHistoricalPathFindings,
  ...groups.futurePatternFindings,
  ...groups.debugLoopFindings,
  ...groups.routeRowFindings,
  ...groups.deletedOwnerCatalogFindings,
];

export const buildIndexRoutingPhases = (input: {
  findings: Finding[];
  groups: IndexRoutingFindingGroups;
}): InspectorPhase[] => {
  const routeRowPhases = ROUTE_ROW_REQUIREMENTS.map((requirement) => {
    const requirementFindings = input.groups.routeRowFindings.filter((finding) => finding.lawId === requirement.requirementId);
    return createRoutingPhase(
      buildRouteRowPhaseName(requirement.requirementId),
      requirementFindings,
      `Index routing row ${requirement.requirementId} remains exact.`,
      `Index routing row ${requirement.requirementId} drifted away from the governed table row.`,
    );
  });

  return [
    createRoutingPhase("repo-local-routing-scope", input.findings, "Index routing law stays scoped to the current repository and local instruction tree.", "Index routing law drifted away from repo-local routing scope."),
    createRoutingPhase("routing-authority-boundary", input.groups.routingAuthorityFindings, "Index routing file remains authoritative only for routing to existing GrassEye module laws.", "Index routing file drifted beyond routing-only authority or now points outside module law files."),
    createRoutingPhase("narrowest-current-authority", input.groups.narrowestAuthorityFindings, "Index routing law keeps narrowest-authority selection explicit in its always-loaded and routing-rule sections.", "Index routing law drifted away from narrowest-current-authority routing."),
    createRoutingPhase("allowed-current-route-domains", input.groups.allowedRouteFindings, "Index routing file only points to active ability-group, foundation-law, and explicit support-governance routes.", "Index routing file now points outside the current allowed route domains."),
    createRoutingPhase("historical-remap-only", input.groups.historicalRemapFindings, "Deleted historical owner names stay constrained to remap-only routing toward current module laws.", "Deleted historical owner names drifted into absent-module routing or lost the remap-only boundary."),
    createRoutingPhase("absent-historical-path-ban", input.groups.absentHistoricalPathFindings, "Index routing law does not activate absent historical paths.", "Index routing law drifted into activating absent historical paths."),
    createRoutingPhase("future-capability-broad-pattern-ban", input.groups.futurePatternFindings, "Index routing law does not use broad patterns to revive future capabilities.", "Index routing law drifted into broad future-capability revival patterns."),
    createRoutingPhase("local-development-tooling-outside-routing", input.groups.debugLoopFindings, "local-development-tooling remains outside active law routing.", "local-development-tooling drifted back into active law routing."),
    ...routeRowPhases,
    createRoutingPhase("deleted-owner-catalog", input.groups.deletedOwnerCatalogFindings, "Index routing boundary statement keeps the deleted-owner catalog exact.", "Index routing boundary statement drifted away from the deleted-owner catalog."),
  ];
};
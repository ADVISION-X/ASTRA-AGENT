import { readFile } from "node:fs/promises";

import { listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { loadBuiltinPackageRecords } from "./builtin-package-records.js";
import { MAP_PLUGIN_LAWS } from "./constants.js";
import { collectAdvanceNextItemRuntimeFindings } from "./muscle-memory-governance-next-item-runtime.js";
import { collectNonAiNextSemanticFindings, collectPreviousVideoOwnerFindings } from "./muscle-memory-governance-next-semantic.js";
import { collectRoutePlanMetadataFindings } from "./muscle-memory-governance-route-plan-metadata.js";

const ROUTE_PLAN_ROOT = "src/map-plugins/route-plans";
const ROUTE_PLAN_SCHEMA_PATH = `${ROUTE_PLAN_ROOT}/route-plan.schema.ts`;
const PRODUCT_DISCOVERY_ROUTE_PLAN_PATH = `${ROUTE_PLAN_ROOT}/product-discovery-route-plan.v1.ts`;
const MACOS_LOCAL_PROGRAM_OPEN_SMOKE_PATH = "src/map-plugins/builtins/macos-local-program-open-smoke.meta.map-package.json";
const CORE_MUSCLES = new Set(["visible-state", "target-action", "evidence-analysis", "advance-next-item"]);
const PLATFORM_SPECIFIC_MUSCLE_TOKENS = [
  "tiktok-muscle",
  "facebook-muscle",
  "youtube-muscle",
  "instagram-muscle",
  "mac-muscle",
  "local-window-muscle",
  "comment-muscle",
  "video-sampling-muscle",
] as const;
const ROUTE_PLAN_FORBIDDEN_TEXT = [
  "semanticDecision",
  "isProductVideo",
  "isCorrectPage",
  "isLoginPage",
  "isSafetyWall",
  "isCaptcha",
  "product_yes derived",
  "page_ready derived",
  "feed_ready derived",
  "semanticDecision outside AI",
] as const;
const ROUTE_PLAN_FORBIDDEN_IMPORT_TEXT = [
  "document.",
  "window.",
  "navigator.",
  "localStorage",
  "sessionStorage",
  "cookie",
  "browser-controller",
  "runtime-adapters",
  "provider",
] as const;
const PROFILE_SECOND_MAP_TOKENS = [
  "steps:",
  "\"steps\"",
  "transitions:",
  "\"transitions\"",
  "routeLabel",
  "promptText",
  "actionFallback",
] as const;
const MAC_SMOKE_FORBIDDEN_TOKENS = [
  "mouse-click",
  "mouse-scroll",
  "text-input",
  "visual-target",
  "geometry-guard",
  "\"targetAbilityGroupId\": \"ai\"",
  "\"childCapabilityId\": \"capture-region\"",
  "\"promptContractId\": \"vision.",
] as const;
const ABILITY_SEMANTIC_ASSIGNMENT_NAMES = [
  "isProductVideo",
  "isCorrectPage",
  "isLoginPage",
  "isSafetyWall",
  "isCaptcha",
  "pageReady",
  "feedReady",
] as const;
const ABILITY_SEMANTIC_ROOTS = [
  "src/capabilities/open",
  "src/capabilities/screenshot",
  "src/capabilities/visual-target",
  "src/capabilities/post-action-verification",
  "src/capabilities/mouse-click",
  "src/capabilities/mouse-scroll",
  "src/capabilities/text-input",
  "src/capabilities/geometry-guard",
  "src/capabilities/forensics-persistence",
] as const;

const toFinding = (file: string, message: string, detail?: string): Finding =>
  createFinding({
    lawId: MAP_PLUGIN_LAWS.MUSCLE_MEMORY_GOVERNANCE,
    file,
    line: 1,
    severity: "fatal",
    message,
    ...(detail ? { detail } : {}),
  });

const readRepoFile = async (file: string): Promise<string> => readFile(pathFromRepoRoot(file), "utf8");

async function collectRoutePlanSourceFindings(): Promise<Finding[]> {
  const files = (await listFilesRecursive(pathFromRepoRoot(ROUTE_PLAN_ROOT)))
    .filter((file) => file.endsWith(".ts"))
    .map((file) => file.slice(pathFromRepoRoot(".").length + 1));
  const findings: Finding[] = [];
  for (const file of files) {
    const text = await readRepoFile(file);
    const platformMuscles = PLATFORM_SPECIFIC_MUSCLE_TOKENS.filter((token) => text.includes(token));
    if (platformMuscles.length > 0) {
      findings.push(toFinding(file, "Route Plan must not declare platform-specific or fifth first-level muscles.", platformMuscles.join(", ")));
    }
    const semanticTokens = ROUTE_PLAN_FORBIDDEN_TEXT.filter((token) => text.includes(token));
    if (semanticTokens.length > 0) {
      findings.push(toFinding(file, "Route Plan source must not hardcode semantic judgment outside AI handoff.", semanticTokens.join(", ")));
    }
    const forbiddenImports = ROUTE_PLAN_FORBIDDEN_IMPORT_TEXT.filter((token) => text.includes(token));
    if (forbiddenImports.length > 0) {
      findings.push(toFinding(file, "Route Plan must not import or reference DOM/BOM/browser/provider internals.", forbiddenImports.join(", ")));
    }
  }
  return findings;
}

async function collectMapMuscleOwnershipFindings(): Promise<Finding[]> {
  const records = await loadBuiltinPackageRecords();
  return records.flatMap((record) =>
    record.text.includes("muscleSegments")
      ? [toFinding(record.file, "Map packages must not declare muscleSegments; maps may only bind routePlanId.")]
      : [],
  );
}

async function collectProfileBoundaryFindings(): Promise<Finding[]> {
  const allFiles = await listFilesRecursive(pathFromRepoRoot("src"));
  const profileFiles = allFiles
    .map((file) => file.slice(pathFromRepoRoot(".").length + 1))
    .filter((file) => /profile/i.test(file))
    .filter((file) => !file.endsWith("map-platform-profile-validator.ts"));
  const findings: Finding[] = [];
  for (const file of profileFiles) {
    const text = await readRepoFile(file);
    const leaked = PROFILE_SECOND_MAP_TOKENS.filter((token) => text.includes(token));
    if (leaked.length > 0) {
      findings.push(toFinding(file, "Profile files must not become second maps with steps, transitions, routeLabel mappings, prompt text, or action fallback chains.", leaked.join(", ")));
    }
  }
  return findings;
}

async function collectMacSmokeFindings(): Promise<Finding[]> {
  const text = await readRepoFile(MACOS_LOCAL_PROGRAM_OPEN_SMOKE_PATH);
  const leaked = MAC_SMOKE_FORBIDDEN_TOKENS.filter((token) => text.includes(token));
  if (leaked.length > 0) {
    return [toFinding(MACOS_LOCAL_PROGRAM_OPEN_SMOKE_PATH, "macOS local-program open smoke must remain diagnostic handoff only and must not grow workflow/action/AI chains.", leaked.join(", "))];
  }
  return [];
}

async function collectAbilitySemanticFindings(): Promise<Finding[]> {
  const allFiles = await listFilesRecursive(pathFromRepoRoot("src/capabilities"));
  const inspected = allFiles
    .map((file) => file.slice(pathFromRepoRoot(".").length + 1))
    .filter((file) => file.endsWith(".ts"))
    .filter((file) => ABILITY_SEMANTIC_ROOTS.some((root) => file.startsWith(`${root}/`)));
  const assignmentRegex = new RegExp(`\\b(?:const|let|var)\\s+(${ABILITY_SEMANTIC_ASSIGNMENT_NAMES.join("|")})\\b|\\b(?:${ABILITY_SEMANTIC_ASSIGNMENT_NAMES.join("|")})\\s*=\\s*[^;]*(?:currentUrl|url|title)\\.includes`, "i");
  const findings: Finding[] = [];
  for (const file of inspected) {
    const text = await readRepoFile(file);
    const match = text.match(assignmentRegex);
    if (match) {
      findings.push(toFinding(file, "Ability Groups must not create semantic page/product/comment judgment variables or URL/title heuristics.", match[0]));
    }
  }
  return findings;
}

async function collectProductDiscoveryRequiredFindings(): Promise<Finding[]> {
  const text = await readRepoFile(PRODUCT_DISCOVERY_ROUTE_PLAN_PATH);
  const required = [
    "muscleModelVersion: \"1.0.0\"",
    "supportedSurfaceKinds: [\"video-feed-surface\", \"comment-surface\"]",
    "surfaceAgnostic: true",
    "visible-state",
    "target-action",
    "evidence-analysis",
    "advance-next-item",
  ];
  const missing = required.filter((snippet) => !text.includes(snippet));
  return missing.length > 0
    ? [toFinding(PRODUCT_DISCOVERY_ROUTE_PLAN_PATH, "product-discovery-route-plan.v1 must declare four-core-muscle governance metadata.", missing.join(", "))]
    : [];
}

async function collectCoreMuscleSchemaFindings(): Promise<Finding[]> {
  const text = await readRepoFile(ROUTE_PLAN_SCHEMA_PATH);
  const declaredCoreMuscles = [...text.matchAll(/"([a-z-]+)"/g)]
    .map((match) => match[1] ?? "")
    .filter((value) => value.length > 0)
    .filter((value) => value.endsWith("-state") || value.endsWith("-action") || value.endsWith("-analysis") || value.endsWith("-item") || value.endsWith("-control") || value.endsWith("-muscle"));
  const illegal = declaredCoreMuscles.filter((value) => !CORE_MUSCLES.has(value));
  return illegal.length > 0
    ? [toFinding(ROUTE_PLAN_SCHEMA_PATH, "Route Plan schema must not define a fifth first-level core muscle.", illegal.join(", "))]
    : [];
}

export async function runMuscleMemoryGovernance(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...await collectCoreMuscleSchemaFindings(),
    ...collectRoutePlanMetadataFindings(),
    ...await collectRoutePlanSourceFindings(),
    ...await collectMapMuscleOwnershipFindings(),
    ...await collectProfileBoundaryFindings(),
    ...await collectMacSmokeFindings(),
    ...await collectAbilitySemanticFindings(),
    ...await collectProductDiscoveryRequiredFindings(),
    ...await collectAdvanceNextItemRuntimeFindings(),
    ...await collectPreviousVideoOwnerFindings(),
    ...await collectNonAiNextSemanticFindings(),
  ];
  return {
    findings,
    phase: createPhase(
      "muscle-memory-governance",
      findings.length === 0 ? "PASS" : "CODE VIOLATION",
      findings.length === 0,
      findings.length === 0
        ? "Muscle Memory remains constrained to four core muscles; maps, profiles, Route Plans, Ability Groups, and Mac smoke stay inside their boundaries."
        : "Muscle Memory boundary drift was detected.",
    ),
  };
}

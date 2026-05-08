import { readFile } from "node:fs/promises";

import { listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { listRoutePlans } from "../../../../src/map-plugins/route-plans/index.js";
import { loadBuiltinPackageRecords } from "./builtin-package-records.js";
import { MAP_PLUGIN_LAWS } from "./constants.js";
import { collectNonAiNextSemanticFindings, collectPreviousVideoOwnerFindings } from "./muscle-memory-governance-next-semantic.js";

const ROUTE_PLAN_ROOT = "src/map-plugins/route-plans";
const ROUTE_PLAN_SCHEMA_PATH = `${ROUTE_PLAN_ROOT}/route-plan.schema.ts`;
const PRODUCT_DISCOVERY_ROUTE_PLAN_PATH = `${ROUTE_PLAN_ROOT}/product-discovery-route-plan.v1.ts`;
const WORKBENCH_VISUAL_DISPATCH_PATH = "src/lib/local-runtime/workbench-visual-dispatch-input.ts";
const WORKBENCH_NEXT_ITEM_DISPATCH_PATH = "src/lib/local-runtime/workbench-visual-dispatch-input-next-item.ts";
const LOOP_GUARD_PATH = "src/capabilities/orchestration/runtime/loop-guard.ts";
const LOOP_GUARD_PROOF_PATH = "src/capabilities/orchestration/runtime/orchestration-loop-proof-builders.ts";
const PRODUCT_DISCOVERY_ROUTE_PLAN_STEPS_PATH = `${ROUTE_PLAN_ROOT}/product-discovery-route-plan.steps.ts`;
const PRODUCT_DISCOVERY_ROUTE_PLAN_TRANSITIONS_PATH = `${ROUTE_PLAN_ROOT}/product-discovery-route-plan.transitions.ts`;
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

const collectRoutePlanMetadataFindings = (): Finding[] => {
  const findings: Finding[] = [];
  for (const routePlan of listRoutePlans()) {
    if (routePlan.routePlanKind !== "muscle-memory") {
      findings.push(toFinding(ROUTE_PLAN_ROOT, "Route Plan must declare routePlanKind=muscle-memory.", routePlan.routePlanId));
    }
    for (const segment of routePlan.muscleSegments ?? []) {
      if (!CORE_MUSCLES.has(segment.coreMuscle)) {
        findings.push(toFinding(ROUTE_PLAN_ROOT, "Route Plan muscleSegments may only use the four core muscles.", `${routePlan.routePlanId}:${segment.segmentId}:${segment.coreMuscle}`));
      }
      if (segment.allowedAbilityGroups.includes("map-plugin-package")) {
        findings.push(toFinding(ROUTE_PLAN_ROOT, "Muscle segments must not list map-plugin-package as an allowed ability group.", `${routePlan.routePlanId}:${segment.segmentId}`));
      }
      if (!segment.aiRequired && segment.producesRefs.some((ref) => ref.toLowerCase().includes("routelabel"))) {
        findings.push(toFinding(ROUTE_PLAN_ROOT, "Non-AI muscle segments must not produce routeLabel refs.", `${routePlan.routePlanId}:${segment.segmentId}`));
      }
      if (segment.aiRequired && segment.semanticOwner !== "ai") {
        findings.push(toFinding(ROUTE_PLAN_ROOT, "Semantic muscle segments must declare semanticOwner=ai.", `${routePlan.routePlanId}:${segment.segmentId}`));
      }
    }
  }
  return findings;
};

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

async function collectAdvanceNextItemRuntimeFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const routePlanText = await readRepoFile(PRODUCT_DISCOVERY_ROUTE_PLAN_PATH);
  const routePlanStepsText = await readRepoFile(PRODUCT_DISCOVERY_ROUTE_PLAN_STEPS_PATH);
  const routePlanTransitionsText = await readRepoFile(PRODUCT_DISCOVERY_ROUTE_PLAN_TRANSITIONS_PATH);
  const routePlanRuntimeText = `${routePlanText}\n${routePlanStepsText}\n${routePlanTransitionsText}`;
  const visualDispatchText = await readRepoFile(WORKBENCH_VISUAL_DISPATCH_PATH);
  const nextItemDispatchText = await readRepoFile(WORKBENCH_NEXT_ITEM_DISPATCH_PATH);
  const visualRuntimeText = `${visualDispatchText}\n${nextItemDispatchText}`;
  const loopGuardText = await readRepoFile(LOOP_GUARD_PATH);
  const loopGuardProofText = await readRepoFile(LOOP_GUARD_PROOF_PATH);
  const normalizeNextBlock = routePlanRuntimeText.match(/stepId: "normalize-next-video-arrow"[\s\S]*?promptContractId: null,\n  }/)?.[0] ?? "";

  if (normalizeNextBlock.includes('inputRefs: ["screenshotEvidenceRef"]')) {
    findings.push(toFinding(PRODUCT_DISCOVERY_ROUTE_PLAN_STEPS_PATH, "normalize-next-video-arrow must not consume only screenshotEvidenceRef; it needs AI target/source evidence for Advance Next Item."));
  }
  if (!routePlanRuntimeText.includes('"sourceAiResultRef"') || !routePlanRuntimeText.includes('"sourceTargetRef"')) {
    findings.push(toFinding(PRODUCT_DISCOVERY_ROUTE_PLAN_STEPS_PATH, "click-next-video-arrow must preserve sourceAiResultRef and sourceTargetRef evidence chain."));
  }
  if (!routePlanText.includes("requiresTargetCandidateRef: true") || !routePlanText.includes("requiresPostActionAiVerification: true")) {
    findings.push(toFinding(PRODUCT_DISCOVERY_ROUTE_PLAN_PATH, "Advance Next Item muscle must require a target candidate ref and post-action AI verification."));
  }
  if (!routePlanText.includes('fallbackPolicy: "fallback-only-with-ai-verification"')) {
    findings.push(toFinding(PRODUCT_DISCOVERY_ROUTE_PLAN_PATH, "Advance Next Item deterministic geometry fallback must be policy-marked fallback-only-with-ai-verification."));
  }
  if (routePlanTransitionsText.includes('fromStepId: "click-next-video-arrow",\n    onStatus: "success",\n    toStepId: "capture-video-viewport"')) {
    findings.push(toFinding(PRODUCT_DISCOVERY_ROUTE_PLAN_TRANSITIONS_PATH, "click-next-video-arrow:success must not jump directly to capture-video-viewport; it must pass through next-item verification."));
  }
  if (!routePlanRuntimeText.includes('stepId: "observe-comments-entry-page-state"')
    || !routePlanRuntimeText.includes('stepId: "analyze-comments-entry-target-candidate"')
    || !routePlanRuntimeText.includes('stepId: "locate-comments-entry-target"')
    || !routePlanRuntimeText.includes('promptContractId: "vision.commentsEntryTargetCandidate.v1"')) {
    findings.push(toFinding(PRODUCT_DISCOVERY_ROUTE_PLAN_STEPS_PATH, "Product-yes must be governed by the comments-entry AI candidate chain and bind vision.commentsEntryTargetCandidate.v1."));
  }
  if (!routePlanRuntimeText.includes('stepId: "verify-next-item-advanced"') || !routePlanRuntimeText.includes('toStepId: "verify-next-item-advanced"')) {
    findings.push(toFinding(PRODUCT_DISCOVERY_ROUTE_PLAN_STEPS_PATH, "Route Plan must include verify-next-item-advanced or an equivalent post-click verification step."));
  }
  if (!routePlanRuntimeText.includes('promptContractId: "vision.nextItemAdvanced.v1"')
    || !routePlanTransitionsText.includes("NEXT_ITEM_ADVANCED_ROUTE_LABEL")
    || !routePlanTransitionsText.includes("NEXT_ITEM_NOT_ADVANCED_ROUTE_LABEL")) {
    findings.push(toFinding(PRODUCT_DISCOVERY_ROUTE_PLAN_TRANSITIONS_PATH, "verify-next-item-advanced must use the dedicated vision.nextItemAdvanced.v1 contract and dedicated next-item route labels."));
  }
  if (!visualRuntimeText.includes("buildCommentsEntryVisualTargetCommand") || visualRuntimeText.includes("Math.round(geometry.viewportWidth / 2)") || visualRuntimeText.includes("Math.round(geometry.viewportHeight / 2)")) {
    findings.push(toFinding(WORKBENCH_VISUAL_DISPATCH_PATH, "Comments-entry visual dispatch must consume governed AI candidate geometry and must not fall back to center-screen geometry."));
  }
  if (visualRuntimeText.includes('dataQualityFlags: ["deterministic_next_video_arrow_geometry"]')) {
    findings.push(toFinding(WORKBENCH_NEXT_ITEM_DISPATCH_PATH, "Deterministic next-video geometry must not be emitted as normal-quality target truth."));
  }
  if (visualRuntimeText.includes('return buildDeterministicNextVideoArrowCommand(runtime, envelope, inputPayload);')
    && !visualRuntimeText.includes("deterministic_next_video_arrow_geometry_fallback")) {
    findings.push(toFinding(WORKBENCH_NEXT_ITEM_DISPATCH_PATH, "Deterministic next-video geometry may only appear as explicit fallback with fallback data-quality flag."));
  }
  if (visualRuntimeText.includes("buildDeterministicNextVideoArrowCommand")) {
    findings.push(toFinding(WORKBENCH_NEXT_ITEM_DISPATCH_PATH, "Deterministic next-video helper must be named fallback-only, not normal command."));
  }
  if (!visualRuntimeText.includes('riskLevel: "high"') || !visualRuntimeText.includes("requiresPostClickAiVerification: true") || !visualRuntimeText.includes('fallbackReason: "missing_governed_next_item_target_candidate"')) {
    findings.push(toFinding(WORKBENCH_NEXT_ITEM_DISPATCH_PATH, "Deterministic next-video fallback must be high risk and require post-click AI verification."));
  }
  if (!visualRuntimeText.includes("GRASSEYE_ALLOW_NEXT_VIDEO_DETERMINISTIC_FALLBACK")) {
    findings.push(toFinding(WORKBENCH_NEXT_ITEM_DISPATCH_PATH, "Deterministic next-video fallback must be gated by explicit runtime policy."));
  }
  if (!loopGuardText.includes("completed_by_run_limit") || !loopGuardText.includes("blocked_by_loop_guard")) {
    findings.push(toFinding(LOOP_GUARD_PATH, "Loop guard must distinguish run-limit completion from blocked loop-guard failures."));
  }
  if (loopGuardProofText.includes('failureReason: input.failureReason ?? "loop_guard_triggered"')) {
    findings.push(toFinding(LOOP_GUARD_PROOF_PATH, "Loop guard proof must not collapse completed_by_run_limit/blocked_by_loop_guard into generic loop_guard_triggered."));
  }
  return findings;
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

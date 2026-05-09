import { readFile } from "node:fs/promises";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { MAP_PLUGIN_LAWS } from "./constants.js";

const PRODUCT_DISCOVERY_ROUTE_PLAN_PATH = "src/map-plugins/route-plans/product-discovery-route-plan.v1.ts";
const PRODUCT_DISCOVERY_ROUTE_PLAN_NEXT_ITEM_TRANSITIONS_PATH = "src/map-plugins/route-plans/product-discovery-route-plan.transitions.next-item.ts";
const WORKBENCH_TEXT_INPUT_DISPATCH_PATH = "src/lib/local-runtime/workbench-text-input-dispatch-input.ts";
const WORKBENCH_VISUAL_DISPATCH_PATH = "src/lib/local-runtime/workbench-visual-dispatch-input.ts";
const WORKBENCH_NEXT_ITEM_DISPATCH_PATH = "src/lib/local-runtime/workbench-visual-dispatch-input-next-item.ts";
const LOOP_GUARD_PATH = "src/capabilities/orchestration/runtime/loop-guard.ts";
const LOOP_GUARD_PROOF_PATH = "src/capabilities/orchestration/runtime/orchestration-loop-proof-builders.ts";
const PRODUCT_DISCOVERY_ROUTE_PLAN_STEPS_PATH = "src/map-plugins/route-plans/product-discovery-route-plan.steps.ts";
const PRODUCT_DISCOVERY_ROUTE_PLAN_TRANSITIONS_PATH = "src/map-plugins/route-plans/product-discovery-route-plan.transitions.ts";
const FORBIDDEN_LEGACY_NEXT_ITEM_TOKENS = [
  'stepId: "analyze-next-item-target-candidate"',
  'stepId: "locate-next-item-target"',
  'stepId: "normalize-next-video-arrow"',
  'stepId: "click-next-video-arrow"',
  'promptContractId: "vision.nextItemTargetCandidate.v1"',
] as const;

type NextItemRuntimeTexts = {
  routePlanText: string;
  routePlanRuntimeText: string;
  routePlanAllTransitionsText: string;
  textInputDispatchText: string;
  visualRuntimeText: string;
  loopGuardText: string;
  loopGuardProofText: string;
};

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

const readAdvanceNextItemRuntimeTexts = async (): Promise<NextItemRuntimeTexts> => {
  const routePlanText = await readRepoFile(PRODUCT_DISCOVERY_ROUTE_PLAN_PATH);
  const routePlanStepsText = await readRepoFile(PRODUCT_DISCOVERY_ROUTE_PLAN_STEPS_PATH);
  const routePlanTransitionsText = await readRepoFile(PRODUCT_DISCOVERY_ROUTE_PLAN_TRANSITIONS_PATH);
  const routePlanNextItemTransitionsText = await readRepoFile(PRODUCT_DISCOVERY_ROUTE_PLAN_NEXT_ITEM_TRANSITIONS_PATH);
  const textInputDispatchText = await readRepoFile(WORKBENCH_TEXT_INPUT_DISPATCH_PATH);
  const visualDispatchText = await readRepoFile(WORKBENCH_VISUAL_DISPATCH_PATH);
  const nextItemDispatchText = await readRepoFile(WORKBENCH_NEXT_ITEM_DISPATCH_PATH);
  const loopGuardText = await readRepoFile(LOOP_GUARD_PATH);
  const loopGuardProofText = await readRepoFile(LOOP_GUARD_PROOF_PATH);

  return {
    routePlanText,
    routePlanRuntimeText: `${routePlanText}\n${routePlanStepsText}\n${routePlanTransitionsText}\n${routePlanNextItemTransitionsText}`,
    routePlanAllTransitionsText: `${routePlanTransitionsText}\n${routePlanNextItemTransitionsText}`,
    textInputDispatchText,
    visualRuntimeText: `${visualDispatchText}\n${nextItemDispatchText}`,
    loopGuardText,
    loopGuardProofText,
  };
};

const collectLegacyNextItemChainFindings = (texts: NextItemRuntimeTexts): Finding[] =>
  FORBIDDEN_LEGACY_NEXT_ITEM_TOKENS.some((token) => texts.routePlanRuntimeText.includes(token))
    ? [toFinding(PRODUCT_DISCOVERY_ROUTE_PLAN_STEPS_PATH, "Advance Next Item main route must no longer include the legacy AI/Visual Target/Geometry/Click chain.")]
    : [];

const collectPressNavigationStepFindings = (texts: NextItemRuntimeTexts): Finding[] =>
  !texts.routePlanRuntimeText.includes('stepId: "press-next-video-key"')
  || !texts.routePlanRuntimeText.includes('childCapabilityId: "press-navigation-key"')
  || !texts.routePlanRuntimeText.includes('targetAbilityGroupId: "text-input"')
    ? [toFinding(PRODUCT_DISCOVERY_ROUTE_PLAN_STEPS_PATH, "Advance Next Item must declare press-next-video-key as a text-input/press-navigation-key muscle step.")]
    : [];

const collectPressNavigationTransitionFindings = (texts: NextItemRuntimeTexts): Finding[] =>
  !texts.routePlanAllTransitionsText.includes('fromStepId: "observe-next-item-page-state",\n    onStatus: "success",\n    toStepId: "press-next-video-key"')
  || !texts.routePlanAllTransitionsText.includes('fromStepId: "press-next-video-key",\n    onStatus: "success",\n    toStepId: "capture-next-item-verification-viewport"')
    ? [toFinding(PRODUCT_DISCOVERY_ROUTE_PLAN_TRANSITIONS_PATH, "Advance Next Item transitions must route observe-next-item-page-state -> press-next-video-key -> capture-next-item-verification-viewport.")]
    : [];

const collectMuscleMetadataFindings = (texts: NextItemRuntimeTexts): Finding[] =>
  !texts.routePlanText.includes('allowedAbilityGroups: ["page-state", "text-input", "screenshot", "ai"]')
  || !texts.routePlanText.includes("requiresTargetCandidateRef: false")
  || !texts.routePlanText.includes('fallbackPolicy: "fallback-only-with-post-click-observation"')
    ? [toFinding(PRODUCT_DISCOVERY_ROUTE_PLAN_PATH, "Advance Next Item muscle metadata must reflect page-state + text-input ownership and mandatory post-action observation.")]
    : [];

const collectTextInputDispatchFindings = (texts: NextItemRuntimeTexts): Finding[] =>
  !texts.textInputDispatchText.includes('childCapabilityId: "press-navigation-key"')
  || !texts.textInputDispatchText.includes('targetProofOwner: "page-state"')
  || !texts.textInputDispatchText.includes('focusProofOwner: "page-state"')
  || !texts.textInputDispatchText.includes('return "ArrowDown"')
    ? [toFinding(WORKBENCH_TEXT_INPUT_DISPATCH_PATH, "press-navigation-key dispatch must bind page-state proof/focus and emit ArrowDown for press-next-video-key.")]
    : [];

const collectCommentsEntryChainFindings = (texts: NextItemRuntimeTexts): Finding[] =>
  !texts.routePlanRuntimeText.includes('stepId: "observe-comments-entry-page-state"')
  || !texts.routePlanRuntimeText.includes('stepId: "analyze-comments-entry-target-candidate"')
  || !texts.routePlanRuntimeText.includes('stepId: "observe-comments-button"')
  || !texts.routePlanRuntimeText.includes('promptContractId: "vision.commentsEntryTargetCandidate.v1"')
    ? [toFinding(PRODUCT_DISCOVERY_ROUTE_PLAN_STEPS_PATH, "Product-yes must be governed by the comments-entry AI candidate chain and bind vision.commentsEntryTargetCandidate.v1.")]
    : [];

const collectVerificationChainFindings = (texts: NextItemRuntimeTexts): Finding[] =>
  !texts.routePlanRuntimeText.includes('stepId: "verify-next-item-advanced"')
  || !texts.routePlanAllTransitionsText.includes('toStepId: "verify-next-item-advanced"')
    ? [toFinding(PRODUCT_DISCOVERY_ROUTE_PLAN_STEPS_PATH, "Route Plan must include verify-next-item-advanced so AI judges whether a new video is visible after press-navigation-key.")]
    : [];

const collectVerificationContractFindings = (texts: NextItemRuntimeTexts): Finding[] =>
  !texts.routePlanRuntimeText.includes('promptContractId: "vision.nextItemAdvanced.v1"')
  || !texts.routePlanAllTransitionsText.includes("NEXT_ITEM_ADVANCED_ROUTE_LABEL")
  || !texts.routePlanAllTransitionsText.includes("NEXT_ITEM_NOT_ADVANCED_ROUTE_LABEL")
    ? [toFinding(PRODUCT_DISCOVERY_ROUTE_PLAN_TRANSITIONS_PATH, "verify-next-item-advanced must use the dedicated vision.nextItemAdvanced.v1 contract and dedicated next-item route labels.")]
    : [];

const collectVisualDispatchFindings = (texts: NextItemRuntimeTexts): Finding[] =>
  !texts.visualRuntimeText.includes("buildCommentsEntryVisualTargetCommand")
  || texts.visualRuntimeText.includes("Math.round(geometry.viewportWidth / 2)")
  || texts.visualRuntimeText.includes("Math.round(geometry.viewportHeight / 2)")
    ? [toFinding(WORKBENCH_VISUAL_DISPATCH_PATH, "Comments-entry visual dispatch must consume governed AI candidate geometry and must not fall back to center-screen geometry.")]
    : [];

const collectNextItemDispatchFindings = (texts: NextItemRuntimeTexts): Finding[] =>
  texts.visualRuntimeText.includes('return buildDeterministicNextVideoArrowCommand(runtime, envelope, inputPayload);')
    ? [toFinding(WORKBENCH_NEXT_ITEM_DISPATCH_PATH, "Legacy normalize-next-video-arrow deterministic path must not be reinstated as the active next-item route.")]
    : [];

const collectLoopGuardFindings = (texts: NextItemRuntimeTexts): Finding[] => [
  ...(!texts.loopGuardText.includes("completed_by_run_limit") || !texts.loopGuardText.includes("blocked_by_loop_guard")
    ? [toFinding(LOOP_GUARD_PATH, "Loop guard must distinguish run-limit completion from blocked loop-guard failures.")]
    : []),
  ...(texts.loopGuardProofText.includes('failureReason: input.failureReason ?? "loop_guard_triggered"')
    ? [toFinding(LOOP_GUARD_PROOF_PATH, "Loop guard proof must not collapse completed_by_run_limit/blocked_by_loop_guard into generic loop_guard_triggered.")]
    : []),
];

const NEXT_ITEM_RUNTIME_FINDING_COLLECTORS = [
  collectLegacyNextItemChainFindings,
  collectPressNavigationStepFindings,
  collectPressNavigationTransitionFindings,
  collectMuscleMetadataFindings,
  collectTextInputDispatchFindings,
  collectCommentsEntryChainFindings,
  collectVerificationChainFindings,
  collectVerificationContractFindings,
  collectVisualDispatchFindings,
  collectNextItemDispatchFindings,
  collectLoopGuardFindings,
] as const;

export async function collectAdvanceNextItemRuntimeFindings(): Promise<Finding[]> {
  const texts = await readAdvanceNextItemRuntimeTexts();
  return NEXT_ITEM_RUNTIME_FINDING_COLLECTORS.flatMap((collectFindings) => collectFindings(texts));
}
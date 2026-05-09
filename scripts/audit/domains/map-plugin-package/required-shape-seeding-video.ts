import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { findRoutePlanById } from "../../../../src/map-plugins/route-plans/index.js";
import { loadBuiltinPackageRecords } from "./builtin-package-records.js";
import { MAP_PLUGIN_LAWS } from "./constants.js";
import {
  hasCaptureCommentsPanelStep,
  hasCommentsCleanupStep,
  hasCommentsClickStep,
  hasCommentsOpenVerificationStep,
  hasCommentsObservationPageStateStep,
  hasCommentsPersistenceSteps,
  hasCommentsTargetCandidateSteps,
} from "./required-shape-seeding-video-comments.js";

type BuiltinPackageRecord = Awaited<ReturnType<typeof loadBuiltinPackageRecords>>[number];
type MapPackage = NonNullable<BuiltinPackageRecord["mapPackage"]>;
type MapStep = MapPackage["operationalMap"]["steps"][number];
type MapTransition = MapPackage["operationalMap"]["transitions"][number];
type PromptBinding = MapPackage["promptBindings"]["bindings"][number];
type InputRefKey = MapStep["inputRefs"][number];
type OutputRefKey = MapStep["outputRefPolicy"]["storeAs"][number];

type SeedingVideoContext = {
  mapPackage: MapPackage;
  mapStepIds: Set<string>;
  promptBinding: PromptBinding | undefined;
  record: BuiltinPackageRecord;
  requiredCapabilities: string[];
  requiredChildCapabilities: string[];
  routePlanOwnedStepIds: Set<string>;
  routePlanTransitionIds: Set<string>;
  routePlanTransitions: MapTransition[];
  steps: MapStep[];
  transitions: MapTransition[];
};

type TransitionQuery = {
  fromStepId: string;
  onStatus?: string;
  toStepId: string;
  transitionId?: string;
};

const SUPPORTED_SEEDING_VIDEO_PLATFORMS = ["facebook-web", "tiktok-web"] as const;

const buildFrameSpecificMapTokens = (): string[] =>
  ["3s", "6s", "10s"].flatMap((framePoint) => [
    `capture-video-frame-${framePoint}`,
    `prepare-ai-input-frame-${framePoint}`,
  ]).concat(
    ["Frame3s", "Frame6s", "Frame10s"].flatMap((frameRef) => [
      `screenshotEvidenceRef${frameRef}`,
      `promptInputRef${frameRef}`,
    ]),
  );

const createPromptContractFinding = (record: BuiltinPackageRecord, message: string): Finding =>
  createFinding({
    lawId: MAP_PLUGIN_LAWS.PROMPT_CONTRACT,
    file: record.file,
    line: 1,
    severity: "fatal",
    message,
  });

const isApplicableSeedingVideoRecord = (
  record: BuiltinPackageRecord,
): record is BuiltinPackageRecord & { mapPackage: MapPackage } => {
  const mapPackage = record.mapPackage;
  if (!mapPackage) {
    return false;
  }

  const requestedPlatformId = mapPackage.taskTemplate.requestedPlatformId;
  return true
    && SUPPORTED_SEEDING_VIDEO_PLATFORMS.some((platformId) => platformId === requestedPlatformId)
    && mapPackage.manifest.packageId.includes("seeding-video-discovery");
};

const buildSeedingVideoContext = (record: BuiltinPackageRecord): SeedingVideoContext | null => {
  if (!isApplicableSeedingVideoRecord(record)) {
    return null;
  }

  const mapPackage = record.mapPackage;
  const routePlan = findRoutePlanById(mapPackage.operationalMap.routePlanId);
  const routePlanTransitions = routePlan?.transitions ?? [];
  return {
    mapPackage,
    mapStepIds: new Set(mapPackage.operationalMap.steps.map((step) => step.stepId)),
    promptBinding: mapPackage.promptBindings.bindings.find((binding) => binding.stepId === "judge-seeding-video"),
    record,
    requiredCapabilities: mapPackage.dependencies?.requiredCapabilities ?? [],
    requiredChildCapabilities: mapPackage.dependencies?.requiredChildCapabilities ?? [],
    routePlanOwnedStepIds: new Set((routePlan?.steps ?? []).map((step) => step.stepId)),
    routePlanTransitionIds: new Set(routePlanTransitions.map((transition) => transition.transitionId)),
    routePlanTransitions,
    steps: routePlan ? [...mapPackage.operationalMap.steps, ...routePlan.steps] : mapPackage.operationalMap.steps,
    transitions: routePlan ? [...mapPackage.operationalMap.transitions, ...routePlanTransitions] : mapPackage.operationalMap.transitions,
  };
};

const getStep = (context: SeedingVideoContext, stepId: string): MapStep | undefined =>
  context.steps.find((step) => step.stepId === stepId);

const hasInputRefs = (step: MapStep | undefined, refs: readonly InputRefKey[]): boolean =>
  refs.every((ref) => step?.inputRefs.includes(ref) === true);

const hasOutputRef = (step: MapStep | undefined, ref: OutputRefKey): boolean =>
  step?.outputRefPolicy.storeAs.includes(ref) === true;

const hasOutputRefs = (step: MapStep | undefined, refs: readonly OutputRefKey[]): boolean =>
  refs.every((ref) => hasOutputRef(step, ref));

const hasTransition = (transitions: readonly MapTransition[], query: TransitionQuery): boolean =>
  transitions.some((transition) =>
    transition.fromStepId === query.fromStepId
    && transition.onStatus === (query.onStatus ?? "success")
    && transition.toStepId === query.toStepId
    && (query.transitionId ? transition.transitionId === query.transitionId : true),
  );

const hasForbiddenHumanReviewHandoff = (context: SeedingVideoContext): boolean =>
  context.steps.some((step) => step.stepId === "request-human-review" || step.childCapabilityId === "request-human-review")
  || context.transitions.some((transition) =>
    transition.fromStepId === "request-human-review"
    || transition.toStepId === "request-human-review",
  )
  || context.requiredChildCapabilities.includes("request-human-review");

const hasForbiddenVideoChangePav = (context: SeedingVideoContext): boolean =>
  context.steps.some((step) => step.stepId.includes("verify-video-changed") || step.childCapabilityId === "verify-video-changed-after-scroll")
  || context.transitions.some((transition) =>
    transition.transitionId.includes("verify-video-changed")
    || transition.fromStepId.includes("verify-video-changed")
    || (transition.toStepId ?? "").includes("verify-video-changed"),
  )
  || context.requiredChildCapabilities.includes("verify-video-changed-after-scroll");

const duplicatesRoutePlanOwnedSteps = (context: SeedingVideoContext): boolean =>
  [...context.routePlanOwnedStepIds].some((stepId) => context.mapStepIds.has(stepId));

const duplicatesRoutePlanOwnedTransitions = (context: SeedingVideoContext): boolean =>
  context.mapPackage.operationalMap.transitions.some((transition) => context.routePlanTransitionIds.has(transition.transitionId));

const mapOwnsAiSuccessRouting = (context: SeedingVideoContext): boolean =>
  context.mapPackage.operationalMap.transitions.some((transition) =>
    (transition.fromStepId === "startup-preparation" || transition.fromStepId === "judge-seeding-video")
    && transition.onStatus === "success",
  );

const judgeLeaksNextTargetCandidate = (context: SeedingVideoContext): boolean => {
  const judge = getStep(context, "judge-seeding-video");
  return hasOutputRef(judge, "aiTargetCandidateRef")
    || hasOutputRef(judge, "nextItemTargetCandidateRef")
    || context.promptBinding?.outputSchemaRef === "ai.visual_target_candidate_analysis.v1";
};

const routePlanOwnsProductYesNoRouting = (context: SeedingVideoContext): boolean =>
  hasTransition(context.routePlanTransitions, {
    fromStepId: "judge-seeding-video",
    toStepId: "observe-comments-entry-page-state",
    transitionId: "judge-seeding-video:read-comments-and-save-evidence",
  })
  && hasTransition(context.routePlanTransitions, {
    fromStepId: "judge-seeding-video",
    toStepId: "observe-next-item-page-state",
    transitionId: "judge-seeding-video:skip-current-video",
  });

const hasCommentsObservationTransitions = (context: SeedingVideoContext): boolean =>
  hasTransition(context.routePlanTransitions, { fromStepId: "judge-seeding-video", toStepId: "observe-comments-entry-page-state" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "observe-comments-entry-page-state", toStepId: "analyze-comments-entry-target-candidate" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "analyze-comments-entry-target-candidate", toStepId: "locate-comments-entry-target" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "locate-comments-entry-target", toStepId: "normalize-comments-target" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "normalize-comments-target", toStepId: "click-comments-button" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "click-comments-button", toStepId: "verify-comments-open" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "verify-comments-open", toStepId: "capture-comments-panel" });

const hasCommentsObservationChain = (context: SeedingVideoContext): boolean => {
  const observeCommentsState = getStep(context, "observe-comments-entry-page-state");
  const analyzeComments = getStep(context, "analyze-comments-entry-target-candidate");
  const locateComments = getStep(context, "locate-comments-entry-target");
  const normalizeComments = getStep(context, "normalize-comments-target");
  const clickComments = getStep(context, "click-comments-button");
  const verifyCommentsOpen = getStep(context, "verify-comments-open");
  return hasCommentsObservationTransitions(context)
    && hasCommentsObservationPageStateStep(observeCommentsState)
    && hasCommentsTargetCandidateSteps({ analyzeComments, locateComments, normalizeComments })
    && hasCommentsClickStep(clickComments)
    && hasCommentsOpenVerificationStep(verifyCommentsOpen);
};

const hasCommentsEvidenceTransitions = (context: SeedingVideoContext): boolean =>
  hasTransition(context.routePlanTransitions, { fromStepId: "capture-comments-panel", toStepId: "extract-visible-comments" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "extract-visible-comments", toStepId: "write-seeding-evidence-record" })
  && hasTransition(context.routePlanTransitions, {
    fromStepId: "extract-visible-comments",
    onStatus: "failed",
    toStepId: "write-seeding-evidence-record",
  })
  && hasTransition(context.routePlanTransitions, { fromStepId: "write-seeding-evidence-record", toStepId: "finalize-seeding-evidence-packet" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "finalize-seeding-evidence-packet", toStepId: "finalize-seeding-browse-ledger" });

const hasCommentsEvidenceChain = (context: SeedingVideoContext): boolean => {
  const captureCommentsPanel = getStep(context, "capture-comments-panel");
  const extractVisibleComments = getStep(context, "extract-visible-comments");
  const writeSeedingEvidence = getStep(context, "write-seeding-evidence-record");
  const finalizeSeedingPacket = getStep(context, "finalize-seeding-evidence-packet");
  const finalizeSeedingBrowseLedger = getStep(context, "finalize-seeding-browse-ledger");
  return hasCommentsEvidenceTransitions(context)
    && hasCaptureCommentsPanelStep(captureCommentsPanel)
    && hasCommentsCleanupStep(extractVisibleComments)
    && hasCommentsPersistenceSteps({ writeSeedingEvidence, finalizeSeedingPacket, finalizeSeedingBrowseLedger });
};

const hasNoCommentIntentLeak = (context: SeedingVideoContext): boolean =>
  !context.steps.some((step) => step.stepId === "analyze-comment-intent" || step.childCapabilityId === "comment-intent-analysis")
  && !context.routePlanTransitions.some((transition) => transition.fromStepId === "analyze-comment-intent" || transition.toStepId === "analyze-comment-intent")
  && !context.requiredChildCapabilities.includes("comment-intent-analysis")
  && !context.mapPackage.dependencies.requiredPromptContracts.includes("comments.intent_analysis.v1");

const hasGovernedPositiveCommentsPath = (context: SeedingVideoContext): boolean =>
  hasCommentsObservationChain(context)
  && hasCommentsEvidenceChain(context)
  && hasNoCommentIntentLeak(context);

const hasForbiddenUncertainBranch = (context: SeedingVideoContext): boolean =>
  context.transitions
    .filter((transition) => transition.fromStepId === "judge-seeding-video")
    .some((transition) => transition.transitionId.includes("uncertain") || transition.toStepId === "request-human-review");

const usesLegacyNextVideoScrollPath = (context: SeedingVideoContext): boolean =>
  context.requiredCapabilities.includes("mouse-scroll")
  || context.requiredChildCapabilities.includes("observe-next-video-region")
  || context.requiredChildCapabilities.includes("scroll-browser-viewport");

const hasForbiddenMapSamplingInternals = (context: SeedingVideoContext): boolean =>
  buildFrameSpecificMapTokens().some((token) => context.record.text.includes(token));

const hasAutomaticNonProductAdvanceTransitions = (context: SeedingVideoContext): boolean =>
  hasTransition(context.routePlanTransitions, { fromStepId: "judge-seeding-video", toStepId: "observe-next-item-page-state" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "finalize-seeding-browse-ledger", toStepId: "observe-next-item-page-state" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "observe-next-item-page-state", toStepId: "press-next-video-key" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "press-next-video-key", toStepId: "capture-next-item-verification-viewport" })
  && hasTransition(context.routePlanTransitions, {
    fromStepId: "verify-next-item-advanced",
    toStepId: "judge-seeding-video",
    transitionId: "verify-next-item-advanced:next-item-advanced",
  })
  && hasTransition(context.routePlanTransitions, {
    fromStepId: "verify-next-item-advanced",
    toStepId: "capture-current-video-viewport",
    transitionId: "verify-next-item-advanced:next-item-not-advanced",
  });

const hasAutomaticNonProductAdvanceStepShapes = (context: SeedingVideoContext): boolean => {
  const pressNext = getStep(context, "press-next-video-key");
  const verifyNext = getStep(context, "verify-next-item-advanced");
  return pressNext?.targetAbilityGroupId === "text-input"
    && pressNext.childCapabilityId === "press-navigation-key"
    && hasInputRefs(pressNext, ["pageStateRef", "screenshotEvidenceRef"])
    && hasOutputRefs(pressNext, ["abilityResultRef", "nextItemAdvanceProofRef"])
    && verifyNext?.stepKind === "ai"
    && verifyNext.promptContractId === "vision.nextItemAdvanced.v1";
};

const hasAutomaticNonProductAdvancePath = (context: SeedingVideoContext): boolean =>
  context.mapPackage.operationalMap.routePlanId === "product-discovery-route-plan.v1"
  && context.mapPackage.operationalMap.mapKind === "routePlanBoundMap"
  && hasAutomaticNonProductAdvanceTransitions(context)
  && hasAutomaticNonProductAdvanceStepShapes(context)
  && !hasForbiddenVideoChangePav(context)
  && !usesLegacyNextVideoScrollPath(context);

const hasStartupAndCurrentCaptureShapes = (context: SeedingVideoContext): boolean => {
  const startupCapture = getStep(context, "capture-startup-video-viewport");
  const startupPrepare = getStep(context, "prepare-startup-ai-input");
  const startupPreparation = getStep(context, "startup-preparation");
  const currentCapture = getStep(context, "capture-current-video-viewport");
  const currentPrepare = getStep(context, "prepare-current-video-ai-input");
  return hasOutputRef(startupCapture, "screenshotEvidenceRef")
    && hasInputRefs(startupPrepare, ["screenshotEvidenceRef"])
    && hasOutputRef(startupPrepare, "promptInputRef")
    && hasInputRefs(startupPreparation, ["promptInputRef"])
    && hasOutputRef(currentCapture, "screenshotEvidenceRef")
    && hasInputRefs(currentPrepare, ["screenshotEvidenceRef"])
    && hasOutputRef(currentPrepare, "promptInputRef");
};

const hasStartupAndCurrentCaptureTransitions = (context: SeedingVideoContext): boolean =>
  hasTransition(context.routePlanTransitions, { fromStepId: "capture-startup-video-viewport", toStepId: "prepare-startup-ai-input" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "prepare-startup-ai-input", toStepId: "startup-preparation" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "startup-preparation", toStepId: "judge-seeding-video" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "capture-current-video-viewport", toStepId: "prepare-current-video-ai-input" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "prepare-current-video-ai-input", toStepId: "judge-seeding-video" });

const hasRoutePlanOwnedStartupGate = (context: SeedingVideoContext): boolean =>
  hasStartupAndCurrentCaptureTransitions(context) && hasStartupAndCurrentCaptureShapes(context);

const hasJudgePromptContractGate = (context: SeedingVideoContext): boolean => {
  const judge = getStep(context, "judge-seeding-video");
  return judge?.stepKind === "ai"
    && hasInputRefs(judge, ["promptInputRef"])
    && judge.promptContractId === "vision.productPresence.v1"
    && context.promptBinding?.requiredInputRefs.includes("promptInputRef") === true
    && context.promptBinding?.outputSchemaRef === "ai.product_presence_judgment.v1"
    && !judgeLeaksNextTargetCandidate(context);
};

const hasSeedingVideoBoundaryGuards = (context: SeedingVideoContext): boolean =>
  !hasForbiddenMapSamplingInternals(context)
  && !hasForbiddenUncertainBranch(context)
  && !hasForbiddenHumanReviewHandoff(context)
  && !duplicatesRoutePlanOwnedSteps(context)
  && !duplicatesRoutePlanOwnedTransitions(context)
  && !mapOwnsAiSuccessRouting(context);

const hasSeedingVideoRoutePlanChains = (context: SeedingVideoContext): boolean =>
  routePlanOwnsProductYesNoRouting(context)
  && hasGovernedPositiveCommentsPath(context)
  && hasAutomaticNonProductAdvancePath(context);

const hasSeedingVideoAiInputChain = (context: SeedingVideoContext): boolean => {
  return hasRoutePlanOwnedStartupGate(context)
    && hasJudgePromptContractGate(context)
    && hasSeedingVideoBoundaryGuards(context)
    && hasSeedingVideoRoutePlanChains(context);
};

export const inspectSeedingVideoAiInputChain = (record: BuiltinPackageRecord): Finding[] => {
  const context = buildSeedingVideoContext(record);
  if (!context) {
    return [];
  }

  return hasSeedingVideoAiInputChain(context)
    ? []
    : [createPromptContractFinding(
      context.record,
      "Seeding video map packages must keep only the open entry local while Route Plan owns capture-startup-video-viewport -> prepare-startup-ai-input -> startup-preparation -> judge-seeding-video and capture-current-video-viewport -> prepare-current-video-ai-input -> judge-seeding-video. ProductPresence must stay binary route-only and must not leak target candidate ownership. Product-yes must pass observe-comments-entry-page-state -> analyze-comments-entry-target-candidate -> locate-comments-entry-target -> normalize-comments-target -> click-comments-button -> capture-comments-panel -> extract-visible-comments -> write-seeding-evidence-record -> finalize-seeding-evidence-packet -> finalize-seeding-browse-ledger with vision.commentsEntryTargetCandidate.v1 plus comments.ocr_cleanup.v1. analyze-comment-intent, comment-intent-analysis, comments.intent_analysis.v1, and commentIntentAiResultRef are forbidden in the governed product-yes chain. Advance-next-item must pass observe-next-item-page-state -> press-next-video-key -> capture-next-item-verification-viewport -> prepare-next-item-verification-ai-input -> verify-next-item-advanced, then reuse the verified prompt input by routing next-item-advanced directly to judge-seeding-video while next-item-not-advanced falls back to capture-current-video-viewport. press-next-video-key must use text-input/press-navigation-key with pageStateRef. Non-AI video-changed PAV, product_uncertain/review_required/request-human-review handoff is forbidden.",
    )];
};
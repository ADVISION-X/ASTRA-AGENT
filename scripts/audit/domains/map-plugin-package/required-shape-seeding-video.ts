import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { findRoutePlanById } from "../../../../src/map-plugins/route-plans/index.js";
import { loadBuiltinPackageRecords } from "./builtin-package-records.js";
import { MAP_PLUGIN_LAWS } from "./constants.js";
import {
  PRODUCT_PRESENCE_OBSERVE_STEP_ID,
  FORBIDDEN_PRODUCT_PRESENCE_FRAME_TOKENS,
  PRODUCT_PRESENCE_CAPTURE_STEP_ID,
  PRODUCT_PRESENCE_PREPARE_STEP_ID,
  PRODUCT_PRESENCE_PROMPT_INPUT_REFS,
  SEEDING_VIDEO_ROUTE_PLAN_REQUIREMENT_MESSAGE,
} from "./product-presence-route-plan-governance.js";

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
    toStepId: "write-product-lead-record",
    transitionId: "judge-seeding-video:read-comments-and-save-evidence",
  })
  && hasTransition(context.routePlanTransitions, {
    fromStepId: "judge-seeding-video",
    toStepId: "observe-next-item-page-state",
    transitionId: "judge-seeding-video:skip-current-video",
  });

const hasProductLeadTransitionChain = (context: SeedingVideoContext): boolean =>
  hasTransition(context.routePlanTransitions, {
    fromStepId: "judge-seeding-video",
    toStepId: "write-product-lead-record",
    transitionId: "judge-seeding-video:read-comments-and-save-evidence",
  })
  && hasTransition(context.routePlanTransitions, { fromStepId: "write-product-lead-record", toStepId: "observe-next-item-page-state" })
  && !hasTransition(context.routePlanTransitions, { fromStepId: "judge-seeding-video", toStepId: "observe-comments-entry-page-state" });

const hasProductLeadStepShape = (context: SeedingVideoContext): boolean => {
  const writeProductLeadRecord = getStep(context, "write-product-lead-record");
  return writeProductLeadRecord?.targetAbilityGroupId === "forensics-persistence"
    && writeProductLeadRecord.childCapabilityId === "write-product-lead-record"
    && hasInputRefs(writeProductLeadRecord, ["requestedPlatformId", "targetUrl", "targetTitle", "screenshotEvidenceRef", "productPresenceAiResultRef"])
    && hasOutputRefs(writeProductLeadRecord, ["abilityResultRef", "productLeadRecordRef"]);
};

const hasFrozenCommentsDependencies = (context: SeedingVideoContext): boolean =>
  !context.requiredCapabilities.some((capabilityId) => capabilityId === "visual-target" || capabilityId === "geometry-guard" || capabilityId === "mouse-click")
  && context.requiredChildCapabilities.includes("write-product-lead-record")
  && !context.requiredChildCapabilities.some((childCapabilityId) =>
    childCapabilityId === "observe-comments-button"
    || childCapabilityId === "normalize-coordinate-geometry"
    || childCapabilityId === "click-browser-coordinate"
    || childCapabilityId === "capture-region"
    || childCapabilityId === "comment-text-cleanup"
    || childCapabilityId === "write-evidence-record",
  )
  && context.mapPackage.dependencies.requiredForensicsRecords.includes("product_lead_record")
  && !context.mapPackage.dependencies.requiredPromptContracts.includes("comments.ocr_cleanup.v1");

const hasGovernedPositiveLeadPath = (context: SeedingVideoContext): boolean =>
  hasProductLeadTransitionChain(context)
  && hasProductLeadStepShape(context)
  && hasFrozenCommentsDependencies(context);

const hasForbiddenUncertainBranch = (context: SeedingVideoContext): boolean =>
  context.transitions
    .filter((transition) => transition.fromStepId === "judge-seeding-video")
    .some((transition) => transition.transitionId.includes("uncertain") || transition.toStepId === "request-human-review");

const usesLegacyNextVideoScrollPath = (context: SeedingVideoContext): boolean =>
  context.requiredCapabilities.includes("mouse-scroll")
  || context.requiredChildCapabilities.includes("observe-next-video-region")
  || context.requiredChildCapabilities.includes("scroll-browser-viewport");

const hasForbiddenMapSamplingInternals = (context: SeedingVideoContext): boolean =>
  FORBIDDEN_PRODUCT_PRESENCE_FRAME_TOKENS.some((token) => context.record.text.includes(token));

const hasAutomaticNonProductAdvanceTransitions = (context: SeedingVideoContext): boolean =>
  hasTransition(context.routePlanTransitions, { fromStepId: "judge-seeding-video", toStepId: "observe-next-item-page-state" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "finalize-seeding-browse-ledger", toStepId: "observe-next-item-page-state" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "observe-next-item-page-state", toStepId: "press-next-video-key" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "press-next-video-key", toStepId: "capture-next-item-verification-viewport" })
  && hasTransition(context.routePlanTransitions, {
    fromStepId: "verify-next-item-advanced",
    toStepId: PRODUCT_PRESENCE_OBSERVE_STEP_ID,
    transitionId: "verify-next-item-advanced:next-item-advanced",
  })
  && hasTransition(context.routePlanTransitions, {
    fromStepId: "verify-next-item-advanced",
    toStepId: PRODUCT_PRESENCE_OBSERVE_STEP_ID,
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
  const currentCapture = getStep(context, PRODUCT_PRESENCE_CAPTURE_STEP_ID);
  const currentPrepare = getStep(context, PRODUCT_PRESENCE_PREPARE_STEP_ID);
  return hasOutputRef(startupCapture, "screenshotEvidenceRef")
    && hasInputRefs(startupPrepare, ["screenshotEvidenceRef"])
    && hasOutputRef(startupPrepare, "promptInputRef")
    && hasInputRefs(startupPreparation, ["promptInputRef"])
    && hasInputRefs(currentCapture, ["targetUrl", "targetTitle"])
    && hasOutputRef(currentCapture, "screenshotEvidenceRef")
    && hasInputRefs(currentPrepare, ["screenshotEvidenceRef"])
    && hasOutputRef(currentPrepare, "promptInputRef");
};

const hasStartupAndCurrentCaptureTransitions = (context: SeedingVideoContext): boolean =>
  hasTransition(context.routePlanTransitions, { fromStepId: "capture-startup-video-viewport", toStepId: "prepare-startup-ai-input" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "prepare-startup-ai-input", toStepId: "startup-preparation" })
  && hasTransition(context.routePlanTransitions, { fromStepId: "startup-preparation", toStepId: PRODUCT_PRESENCE_OBSERVE_STEP_ID })
  && hasTransition(context.routePlanTransitions, { fromStepId: PRODUCT_PRESENCE_OBSERVE_STEP_ID, toStepId: PRODUCT_PRESENCE_CAPTURE_STEP_ID })
  && hasTransition(context.routePlanTransitions, { fromStepId: PRODUCT_PRESENCE_CAPTURE_STEP_ID, toStepId: PRODUCT_PRESENCE_PREPARE_STEP_ID })
  && hasTransition(context.routePlanTransitions, { fromStepId: PRODUCT_PRESENCE_PREPARE_STEP_ID, toStepId: "judge-seeding-video" });

const hasRoutePlanOwnedStartupGate = (context: SeedingVideoContext): boolean =>
  hasStartupAndCurrentCaptureTransitions(context) && hasStartupAndCurrentCaptureShapes(context);

const hasJudgePromptContractGate = (context: SeedingVideoContext): boolean => {
  const judge = getStep(context, "judge-seeding-video");
  return judge?.stepKind === "ai"
    && hasInputRefs(judge, PRODUCT_PRESENCE_PROMPT_INPUT_REFS)
    && judge.promptContractId === "vision.productPresence.v1"
    && context.promptBinding?.requiredInputRefs.includes("promptInputRef") === true
    && context.promptBinding?.requiredInputRefs.some((ref) => ref.includes("Frame")) !== true
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
  && hasGovernedPositiveLeadPath(context)
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
      SEEDING_VIDEO_ROUTE_PLAN_REQUIREMENT_MESSAGE,
    )];
};
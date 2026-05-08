type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
};

export const ROUTE_PLAN_REQUIRED_MUTATION_NAMES = [
  "platform-specific muscle mutation",
  "mac muscle mutation",
  "route plan semantic judgment mutation",
  "fifth core muscle mutation",
  "next arrow deterministic normal path mutation",
  "locate next item target removal mutation",
  "locate next item target missing candidate output mutation",
  "normalize next arrow screenshot-only input mutation",
  "click next arrow missing source chain mutation",
  "click success direct capture mutation",
  "next arrow fallback verification flag removal mutation",
  "loop guard generic completed mutation",
  "previous-video hidden owner mutation",
  "missing geometry proof mutation",
  "facebook non-product click path skips geometry mutation",
] as const;

export const ROUTE_PLAN_NEGATIVE_PROOF_MUTATIONS: Mutation[] = [
  {
    name: "platform-specific muscle mutation",
    file: "src/map-plugins/route-plans/product-discovery-route-plan.v1.ts",
    search: '      coreMuscle: "visible-state",\n',
    replace: '      coreMuscle: "tiktok-muscle",\n',
  },
  {
    name: "mac muscle mutation",
    file: "src/map-plugins/route-plans/product-discovery-route-plan.v1.ts",
    search: '      coreMuscle: "target-action",\n',
    replace: '      coreMuscle: "mac-muscle",\n',
  },
  {
    name: "route plan semantic judgment mutation",
    file: "src/map-plugins/route-plans/product-discovery-route-plan.steps.ts",
    search: '    stepId: "observe-comments-button",\n',
    replace: '    stepId: "observe-comments-button",\n    semanticDecision: "product_yes",\n',
  },
  {
    name: "fifth core muscle mutation",
    file: "src/map-plugins/route-plans/route-plan.schema.ts",
    search: '  "advance-next-item",\n]);\n',
    replace: '  "advance-next-item",\n  "workflow-control",\n]);\n',
  },
  {
    name: "next arrow deterministic normal path mutation",
    file: "src/lib/local-runtime/workbench-visual-dispatch-input-next-item.ts",
    search: '      "deterministic_next_video_arrow_geometry_fallback",\n',
    replace: '      "deterministic_next_video_arrow_geometry",\n',
  },
  {
    name: "locate next item target removal mutation",
    file: "src/map-plugins/route-plans/product-discovery-route-plan.steps.ts",
    search: '    stepId: "locate-next-item-target",\n',
    replace: '    stepId: "locate-next-item-target-removed",\n',
  },
  {
    name: "locate next item target missing candidate output mutation",
    file: "src/map-plugins/route-plans/product-discovery-route-plan.steps.ts",
    search: '    outputRefPolicy: { storeAs: ["visualTargetRef", "nextItemTargetCandidateRef"] },\n',
    replace: '    outputRefPolicy: { storeAs: ["visualTargetRef"] },\n',
  },
  {
    name: "normalize next arrow screenshot-only input mutation",
    file: "src/map-plugins/route-plans/product-discovery-route-plan.steps.ts",
    search: '    inputRefs: ["screenshotEvidenceRef", "sourceAiResultRef", "nextItemTargetCandidateRef"],\n',
    replace: '    inputRefs: ["screenshotEvidenceRef"],\n',
  },
  {
    name: "click next arrow missing source chain mutation",
    file: "src/map-plugins/route-plans/product-discovery-route-plan.steps.ts",
    search: '    inputRefs: ["geometryProofRef", "sourceTargetRef", "sourceAiResultRef"],\n',
    replace: '    inputRefs: ["geometryProofRef"],\n',
  },
  {
    name: "click success direct capture mutation",
    file: "src/map-plugins/route-plans/product-discovery-route-plan.transitions.ts",
    search: '    transitionId: "click-next-video-arrow:success",\n    fromStepId: "click-next-video-arrow",\n    onStatus: "success",\n    toStepId: "capture-next-item-verification-viewport",',
    replace: '    transitionId: "click-next-video-arrow:success",\n    fromStepId: "click-next-video-arrow",\n    onStatus: "success",\n    toStepId: "capture-video-viewport",',
  },
  {
    name: "next arrow fallback verification flag removal mutation",
    file: "src/lib/local-runtime/workbench-visual-dispatch-input-next-item.ts",
    search: '    requiresPostClickAiVerification: true,\n',
    replace: '    requiresPostClickAiVerification: false,\n',
  },
  {
    name: "loop guard generic completed mutation",
    file: "src/capabilities/orchestration/runtime/orchestration-loop-proof-builders.ts",
    search: 'failureReason: input.failureReason ?? (input.loopDecision === "stop_failed" ? "blocked_by_loop_guard" : "completed_by_run_limit"), loopDecision: input.loopDecision',
    replace: 'failureReason: input.failureReason ?? "loop_guard_triggered", loopDecision: input.loopDecision',
  },
  {
    name: "previous-video hidden owner mutation",
    file: "src/map-plugins/route-plans/product-discovery-route-plan.steps.ts",
    search: '    stepId: "click-next-video-arrow",\n',
    replace: '    stepId: "click-previous-video-arrow",\n',
  },
  {
    name: "missing geometry proof mutation",
    file: "src/map-plugins/route-plans/product-discovery-route-plan.steps.ts",
    search: '    inputRefs: ["geometryProofRef", "sourceTargetRef", "sourceAiResultRef"],\n',
    replace: '    inputRefs: ["sourceTargetRef", "sourceAiResultRef"],\n',
  },
  {
    name: "facebook non-product click path skips geometry mutation",
    file: "src/map-plugins/route-plans/product-discovery-route-plan.transitions.ts",
    search: '    transitionId: "normalize-next-video-arrow:success",\n    fromStepId: "normalize-next-video-arrow",\n    onStatus: "success",\n    toStepId: "click-next-video-arrow",',
    replace: '    transitionId: "normalize-next-video-arrow:success",\n    fromStepId: "normalize-next-video-arrow",\n    onStatus: "success",\n    toStepId: "capture-video-viewport",',
  },
];
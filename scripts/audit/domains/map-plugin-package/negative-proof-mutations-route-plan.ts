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
  "press next video key removal mutation",
  "press next video key wrong child mutation",
  "press next video key missing page-state input mutation",
  "press next video key success direct capture mutation",
  "advanced success redundant recapture mutation",
  "loop guard generic completed mutation",
  "previous-video hidden owner mutation",
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
    search: '    stepId: "observe-comments-entry-page-state",\n',
    replace: '    stepId: "observe-comments-entry-page-state",\n    semanticDecision: "product_yes",\n',
  },
  {
    name: "fifth core muscle mutation",
    file: "src/map-plugins/route-plans/route-plan.schema.ts",
    search: '  "advance-next-item",\n]);\n',
    replace: '  "advance-next-item",\n  "workflow-control",\n]);\n',
  },
  {
    name: "press next video key removal mutation",
    file: "src/map-plugins/route-plans/product-discovery-route-plan.steps.ts",
    search: '    stepId: "press-next-video-key",\n',
    replace: '    stepId: "press-next-video-key-removed",\n',
  },
  {
    name: "press next video key wrong child mutation",
    file: "src/map-plugins/route-plans/product-discovery-route-plan.steps.ts",
    search: '    childCapabilityId: "press-navigation-key",\n',
    replace: '    childCapabilityId: "press-key",\n',
  },
  {
    name: "press next video key missing page-state input mutation",
    file: "src/map-plugins/route-plans/product-discovery-route-plan.steps.ts",
    search: '    inputRefs: ["pageStateRef", "screenshotEvidenceRef"],\n',
    replace: '    inputRefs: ["screenshotEvidenceRef"],\n',
  },
  {
    name: "press next video key success direct capture mutation",
    file: "src/map-plugins/route-plans/product-discovery-route-plan.transitions.next-item.ts",
    search: '    transitionId: "press-next-video-key:success",\n    fromStepId: "press-next-video-key",\n    onStatus: "success",\n    toStepId: "capture-next-item-verification-viewport",',
    replace: '    transitionId: "press-next-video-key:success",\n    fromStepId: "press-next-video-key",\n    onStatus: "success",\n    toStepId: "capture-current-video-viewport",',
  },
  {
    name: "advanced success redundant recapture mutation",
    file: "src/map-plugins/route-plans/product-discovery-route-plan.transitions.next-item.ts",
    search: '    transitionId: `verify-next-item-advanced:${NEXT_ITEM_ADVANCED_ROUTE_LABEL}`,\n    fromStepId: "verify-next-item-advanced",\n    onStatus: "success",\n    toStepId: "judge-seeding-video",',
    replace: '    transitionId: `verify-next-item-advanced:${NEXT_ITEM_ADVANCED_ROUTE_LABEL}`,\n    fromStepId: "verify-next-item-advanced",\n    onStatus: "success",\n    toStepId: "capture-current-video-viewport",',
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
    search: '    stepId: "press-next-video-key",\n',
    replace: '    stepId: "press-previous-video-key",\n',
  },
];
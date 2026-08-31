import type { BrowserDomIntent, BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";

export const EXPECTED_GPT_CHILD_IDS = Object.freeze([
  "acquire_gpt_continuation_lane", "advance_gpt_continuation_lane",
  "attach_approved_gpt_files_once", "checkpoint_gpt_generated_image",
  "checkpoint_gpt_text_response", "close_gpt_execution_profile",
  "ensure_exact_gpt_reasoning_tier",
  "focus_exact_gpt_conversation", "open_gpt_attachment_control",
  "open_gpt_execution_profile", "open_gpt_model_selector_v2",
  "persist_gpt_continuation", "prepare_clean_gpt_chat",
  "reconcile_gpt_attachment_set", "reconcile_gpt_draft", "reconcile_gpt_turn_submission",
  "release_gpt_continuation_lane", "select_exact_gpt_model_v2", "submit_exact_gpt_turn_once",
  "verify_gpt_conversation_identity", "wait_for_stable_gpt_image",
  "wait_for_stable_gpt_text", "write_exact_gpt_prompt",
].sort());

type DomResponder = (intent: BrowserDomIntent, callNumber: number) => unknown | Promise<unknown>;
type FakeBrowserOptions = Readonly<{
  initialPending?: number;
  initialUrl?: string;
  authenticatedMedia?: Awaited<ReturnType<BrowserTargetLease["downloadAuthenticatedMedia"]>>;
  onWait?: (durationMs: number) => void;
}>;
type FakeBrowserState = {
  pending: number;
  documentRef: string;
  navigationEpoch: number;
  url: string;
  domCalls: number;
  physicalMutations: number;
  waitDurations: number[];
};

const createFakeBrowserLease = (
  responder: DomResponder,
  state: FakeBrowserState,
  options: FakeBrowserOptions,
): BrowserTargetLease => ({
  leaseRef: "lease:1",
  authorityRef: "authority:1",
  authorityEpoch: 1,
  executionBindingHash: `sha256:${"a".repeat(64)}`,
  ownerId: "gpt-acceptance",
  agentJobRefHash: `sha256:${"b".repeat(64)}`,
  agentExecutionRefHash: `sha256:${"c".repeat(64)}`,
  writerLeaseEpoch: 1,
  writerFenceHash: `sha256:${"d".repeat(64)}`,
  target: { targetRef: "target:1", authorityEpoch: 1, executionBindingHash: `sha256:${"a".repeat(64)}` },
  get document() {
    return { documentRef: state.documentRef, targetRef: "target:1", navigationEpoch: state.navigationEpoch };
  },
  async runAtomicStep(_identity, action) { return action(); },
  readAtomicStepRecovery: () => null,
  requiresMutationRecovery: () => state.pending > 0,
  async navigate(navigation: Readonly<{ url: string }>) {
    state.physicalMutations += 1;
    state.url = navigation.url;
    state.navigationEpoch += 1;
    state.documentRef = `document:${state.navigationEpoch}`;
    return { documentRef: state.documentRef, targetRef: "target:1", navigationEpoch: state.navigationEpoch };
  },
  async executeDomIntent(intent: BrowserDomIntent) {
    state.domCalls += 1;
    if (["click", "hover", "doubleClick", "keypress", "fill"].includes(intent.kind)) state.physicalMutations += 1;
    const value = await responder(intent, state.domCalls);
    if (intent.kind === "document" && value && typeof value === "object" && !Array.isArray(value)) {
      const nextUrl = Reflect.get(value, "url");
      if (typeof nextUrl === "string" && nextUrl !== state.url) {
        state.url = nextUrl;
        state.navigationEpoch += 1;
        state.documentRef = `document:${state.navigationEpoch}`;
      }
    }
    return value;
  },
  async observeCapability() { return {}; },
  async captureScreenshot() { return { artifactRef: "screenshot:1", contentHash: `sha256:${"e".repeat(64)}` }; },
  async attachFile() { state.physicalMutations += 1; },
  async downloadAuthenticatedMedia() {
    if (!options.authenticatedMedia) throw new Error("FIXTURE_AUTHENTICATED_MEDIA_MISSING");
    return options.authenticatedMedia;
  },
  async registerFileArtifact() {},
  async issueFileArtifactGrant() { throw new Error("UNUSED"); },
  async wait(input) {
    state.waitDurations.push(input.durationMs);
    options.onWait?.(input.durationMs);
  },
  async park() { state.physicalMutations += 1; },
  async close() { state.physicalMutations += 1; },
  async resolvePendingMutation() {
    if (state.pending !== 1) throw new Error("BROWSER_MUTATION_UNSETTLED");
    state.pending = 0;
    return 1;
  },
  pendingMutationCount: () => state.pending,
  assertNoPendingMutations() {
    if (state.pending !== 0) throw new Error("BROWSER_MUTATION_UNSETTLED");
  },
});

export const fakeBrowser = (responder: DomResponder, input: FakeBrowserOptions = {}) => {
  const state: FakeBrowserState = {
    pending: input.initialPending ?? 0,
    documentRef: "document:1",
    navigationEpoch: 1,
    url: input.initialUrl ?? "https://chatgpt.com/",
    domCalls: 0,
    physicalMutations: 0,
    waitDurations: [],
  };
  return {
    browser: createFakeBrowserLease(responder, state, input),
    physicalMutations: () => state.physicalMutations,
    documentCalls: () => state.domCalls,
    waitDurations: () => [...state.waitDurations],
  };
};

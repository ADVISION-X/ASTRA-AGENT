import type { BrowserDomIntent, BrowserTargetLease } from "../../src/lib/browser/browser-authority-api.js";

export const EXPECTED_GPT_CHILD_IDS = Object.freeze([
  "acknowledge_known_gpt_rate_limit", "acquire_gpt_continuation_lane", "advance_gpt_continuation_lane",
  "attach_approved_gpt_files_once", "bind_exact_gpt_target", "capture_gpt_response_artifact",
  "checkpoint_gpt_generated_image", "checkpoint_gpt_text_response", "cleanup_owned_gpt_transient_ui",
  "commit_gpt_checkpoint_fork", "commit_gpt_title", "dismiss_known_gpt_search_dialog",
  "focus_exact_gpt_composer", "focus_exact_gpt_conversation", "observe_exact_gpt_assistant_turn",
  "observe_gpt_document", "observe_gpt_execution_profile", "open_gpt_attachment_control",
  "open_gpt_conversation_search", "open_gpt_fork_control", "open_gpt_model_selector",
  "open_gpt_reasoning_selector", "open_gpt_title_control", "persist_gpt_continuation",
  "recover_gpt_response_checkpoint", "release_gpt_continuation_lane", "restore_gpt_operator_source",
  "select_exact_gpt_conversation_result", "select_exact_gpt_model", "select_exact_gpt_reasoning_tier",
  "submit_exact_gpt_turn", "verify_clean_gpt_chat", "verify_exact_gpt_prompt", "verify_exact_gpt_title",
  "verify_gpt_attachment_set", "verify_gpt_conversation_identity", "verify_gpt_execution_profile",
  "verify_gpt_turn_submission", "verify_gpt_workspace", "wait_for_stable_gpt_response",
  "write_exact_gpt_prompt", "write_exact_gpt_title", "write_gpt_conversation_search_key",
].sort());

type DomResponder = (intent: BrowserDomIntent, callNumber: number) => unknown | Promise<unknown>;
type FakeBrowserOptions = Readonly<{ initialPending?: number; initialUrl?: string }>;
type FakeBrowserState = {
  pending: number;
  documentRef: string;
  navigationEpoch: number;
  url: string;
  domCalls: number;
  physicalMutations: number;
};

const createFakeBrowserLease = (
  responder: DomResponder,
  state: FakeBrowserState,
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
  async registerFileArtifact() {},
  async issueFileArtifactGrant() { throw new Error("UNUSED"); },
  async wait() {},
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
  };
  return {
    browser: createFakeBrowserLease(responder, state),
    physicalMutations: () => state.physicalMutations,
    documentCalls: () => state.domCalls,
  };
};

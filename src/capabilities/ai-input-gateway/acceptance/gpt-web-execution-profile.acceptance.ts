import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type {
  BrowserDomIntent,
  BrowserTargetLease,
} from "../../../lib/browser/browser-authority-api.js";
import type {
  AiProviderAdapterContext,
  ProviderExecutionProfileProof,
  WebChatPageActionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import { buildGptWebProviderExecutionProfile, type AiFeedInput } from "../schema.js";
import { enforceGptWebExecutionProfile } from "../providers/gpt-web-execution-profile.js";
import { readPreSubmitConversationState } from "../providers/web-chat-pre-submit-state.js";
import { prepareWebChatSessionForSubmission } from "../providers/web-chat-session-controller.js";
import {
  LEGACY_PROFILE_READBACK_STATE_CORRECTION,
  startOrResumeWebChatExecution,
  updateWebChatExecution,
} from "../runtime/web-chat-execution-state.js";

const trigger = "main button[aria-haspopup='menu']:not([aria-label])";
const advancedClosed = "[role='menuitem'][aria-label='显示高级选项']";
const advancedOpen = "[role='menuitem'][aria-label='显示精简选项']";
const submenus = "[role='menuitem'][aria-haspopup='menu']";
const choices = "[role='menuitemradio']";
const surfaceSelector = [trigger, advancedClosed, advancedOpen, submenus, choices].join(",");

type SurfaceNode = Readonly<{
  tagName: string;
  role: string;
  ariaLabel: string;
  ariaExpanded: string;
  ariaChecked: string;
  text: string;
}>;

class ProfileBrowserFixture {
  public readonly actions: string[] = [];
  public readonly choiceClickTexts: string[] = [];
  public readonly triggerFindCounts: number[] = [];
  public snapshotReadCount = 0;
  public resolvedMutations = 0;
  public readonly target: BrowserTargetLease["target"] = {
    targetRef: "target-profile-acceptance",
    authorityEpoch: 1,
    executionBindingHash: "sha256:profile-acceptance-binding",
  };
  public readonly document: BrowserTargetLease["document"] = {
    documentRef: "document-profile-acceptance",
    targetRef: this.target.targetRef,
    navigationEpoch: 1,
  };
  private expanded = false;
  private advanced = false;
  private submenu: "模型" | "推理强度" | null = null;
  private advancedMarkerReadsRemaining = 0;
  private pendingMutation = false;

  public constructor(
    public model: string,
    public reasoning: string,
    private readonly duplicateModel = false,
    private readonly advancedMarkerDelayReads = 0,
    private readonly outcomeUnknownAfterChoice: string | null = null,
    private triggerDelayReads = 0,
    private readonly ignoredChoiceAfterClick: string | null = null,
    private readonly modelChoiceDomText = "GPT-5.6 Sol",
  ) {}

  public readonly wait = async (): Promise<void> => {};

  public readonly executeDomIntent = async (intent: BrowserDomIntent): Promise<unknown> => {
    if (intent.kind === "document") return { url: "https://chatgpt.com/", title: "ChatGPT" };
    if (intent.kind === "find") {
      if (intent.selector !== surfaceSelector || !intent.fields) {
        throw new Error(`unexpected find ${intent.selector ?? ""}`);
      }
      const matches = this.surfaceNodes();
      this.snapshotReadCount += 1;
      this.triggerFindCounts.push(matches.some((node) => node.tagName === "BUTTON") ? 1 : 0);
      return { count: matches.length, matches };
    }
    if (intent.kind !== "click") throw new Error(`unexpected intent ${intent.kind}`);
    if (this.pendingMutation) throw new Error("BROWSER_OUTCOME_UNKNOWN");
    const expectedText = intent.expectedTextEquals ?? intent.expectedText;
    this.click(intent.selector, expectedText);
    this.pendingMutation = true;
    if (intent.selector === choices && expectedText === this.outcomeUnknownAfterChoice) {
      throw new Error("BROWSER_OUTCOME_UNKNOWN");
    }
    return {
      clicked: true,
      candidateCount: 1,
      identityRevalidated: true,
      mutationCount: 1,
      ...(intent.postClickAttribute ? { postconditionVerified: true } : {}),
    };
  };

  public asLease(): BrowserTargetLease {
    return {
      leaseRef: "lease-profile-acceptance",
      authorityRef: "authority-profile-acceptance",
      authorityEpoch: 1,
      executionBindingHash: "sha256:profile-acceptance-binding",
      ownerId: "ai-input-gateway-acceptance",
      agentJobRefHash: "sha256:profile-acceptance-job",
      agentExecutionRefHash: "sha256:profile-acceptance-execution",
      writerLeaseEpoch: 1,
      writerFenceHash: "sha256:profile-acceptance-fence",
      target: this.target,
      document: this.document,
      navigate: async () => this.document,
      executeDomIntent: this.executeDomIntent,
      observeCapability: async () => ({}),
      captureScreenshot: async () => ({
        artifactRef: "profile-acceptance-screenshot",
        contentHash: "sha256:profile-acceptance-screenshot",
      }),
      attachFile: async () => {},
      registerFileArtifact: async () => {},
      issueFileArtifactGrant: async () => {
        throw new Error("unused profile acceptance operation");
      },
      wait: this.wait,
      close: async () => {},
      resolvePendingMutation: async () => {
        if (!this.pendingMutation) throw new Error("BROWSER_OUTCOME_UNKNOWN");
        this.pendingMutation = false;
        this.resolvedMutations += 1;
        return 1;
      },
      pendingMutationCount: () => this.pendingMutation ? 1 : 0,
      assertNoPendingMutations: () => {
        if (this.pendingMutation) throw new Error("BROWSER_OUTCOME_UNKNOWN");
      },
    };
  }

  private candidates(): string[] {
    if (this.submenu === "模型") {
      return this.duplicateModel
        ? ["GPT-5.6 Sol", "GPT-5.6 Sol", "GPT-5.5", "o3"]
        : ["GPT-5.6 Sol", "GPT-5.5", "o3"];
    }
    if (this.submenu === "推理强度") return ["极速", "中", "高", "极高", "Pro"];
    return [];
  }

  private selected(): string | null {
    if (this.submenu === "模型") return this.model;
    if (this.submenu === "推理强度") return this.reasoning;
    return null;
  }

  private surfaceNodes(): SurfaceNode[] {
    const nodes: SurfaceNode[] = [];
    if (this.triggerDelayReads > 0) {
      this.triggerDelayReads -= 1;
      return nodes;
    }
    nodes.push({
      tagName: "BUTTON",
      role: "",
      ariaLabel: "",
      ariaExpanded: this.expanded ? "true" : "false",
      ariaChecked: "",
      text: `${this.model.replace(/^GPT-/u, "")} ${this.reasoning}`,
    });
    if (!this.expanded) return nodes;
    if (this.advancedMarkerReadsRemaining > 0) {
      this.advancedMarkerReadsRemaining -= 1;
      return nodes;
    }
    nodes.push({
      tagName: "DIV",
      role: "menuitem",
      ariaLabel: this.advanced ? "显示精简选项" : "显示高级选项",
      ariaExpanded: "",
      ariaChecked: "",
      text: "高级",
    });
    if (!this.advanced) return nodes;
    for (const value of [`模型${this.model}`, `推理强度${this.reasoning}`]) {
      nodes.push({
        tagName: "DIV",
        role: "menuitem",
        ariaLabel: "",
        ariaExpanded: "",
        ariaChecked: "",
        text: value,
      });
    }
    const selected = this.selected();
    for (const value of this.candidates()) {
      nodes.push({
        tagName: "DIV",
        role: "menuitemradio",
        ariaLabel: "",
        ariaExpanded: "",
        ariaChecked: value === selected ? "true" : "false",
        text: value === "GPT-5.6 Sol" ? this.modelChoiceDomText : value,
      });
    }
    return nodes;
  }

  private click(selector: string, expectedText?: string): void {
    if (selector === trigger) {
      this.expanded = !this.expanded;
      this.advanced = false;
      this.submenu = null;
      this.advancedMarkerReadsRemaining = this.advancedMarkerDelayReads;
      this.actions.push("模型选择下拉");
      return;
    }
    if (selector === advancedClosed) {
      this.advanced = true;
      this.actions.push("高级");
      return;
    }
    if (selector === submenus && (expectedText === "模型" || expectedText === "推理强度")) {
      this.submenu = expectedText;
      this.actions.push(expectedText);
      return;
    }
    const semanticChoice = expectedText === this.modelChoiceDomText
      ? "GPT-5.6 Sol"
      : expectedText;
    if (selector === choices && semanticChoice && this.candidates().includes(semanticChoice)) {
      this.choiceClickTexts.push(expectedText!);
      if (semanticChoice !== this.ignoredChoiceAfterClick) {
        if (this.submenu === "模型") this.model = semanticChoice;
        if (this.submenu === "推理强度") this.reasoning = semanticChoice;
      }
      this.actions.push(`选择:${semanticChoice}`);
      this.expanded = false;
      this.advanced = false;
      this.submenu = null;
      return;
    }
    throw new Error(`unexpected click ${selector}:${expectedText ?? ""}`);
  }
}

const request = (reasoningTier: "high" | "extra_high" | "pro_standard"): AiFeedInput => ({
  providerKind: "gpt-web-chat",
  taskIdentity: {
    labelKey: "generic_ai",
    sourceProject: "xuanxue-web",
    taskKind: "localization_static_review_candidate",
    sourceTaskId: "execution-profile-acceptance",
  },
  promptPackageId: "profile-acceptance-package",
  promptContractId: "profile-acceptance-contract",
  expectedOutputSchemaRef: null,
  expectedOutputKind: "text",
  textPrompt: "profile acceptance",
  inputRefs: [],
  modelName: null,
  providerExecutionProfile: buildGptWebProviderExecutionProfile({
    profileRef: `acceptance:${reasoningTier}`,
    accountCapabilityRef: "acceptance:account",
    modelDisplayName: "GPT-5.6 Sol",
    modelFamily: "gpt-5.6",
    reasoningTier,
    executorIdentityRef: "acceptance",
    acceptanceRef: "APEX-AI-INPUT-GATEWAY-005-V4",
    acceptanceVersion: "2026-08-22.4",
  }),
  timeoutMs: 30_000,
  maxFileCount: 0,
  requestedBy: "ai-capability",
  missionId: "profile-acceptance-mission",
  runId: "profile-acceptance-run",
  roundId: "profile-acceptance-round",
  conversationScopeRef: "profile-acceptance-scope",
});

const context = (receipts: {
  actions: WebChatPageActionProof[];
  profile: ProviderExecutionProfileProof | null;
}, browser?: ProfileBrowserFixture): AiProviderAdapterContext => ({
  dataDir: "/tmp/gpt-web-execution-profile-acceptance",
  webChatExecution: {
    executionId: "profile-acceptance-execution",
    attemptId: "profile-acceptance-attempt",
    providerKind: "gpt-web-chat",
    requestTextPrompt: "profile acceptance",
    turnMarker: "profile-acceptance-turn",
    submittedPromptHash: "sha256:profile-acceptance-prompt",
    providerExecutionProfileBinding: null,
    providerExecutionProfileProof: null,
    providerExecutionProfileCheckpointCurrent: true,
    conversationTitle: null,
    resumeSubmission: null,
    resumeUploadedFiles: [],
    resumeAttachmentUploadProof: null,
    resumeResponseCheckpoint: null,
    resumeForkActionProof: null,
    globalBrowser: null,
    runExclusivePatrol: async () => {
      throw new Error("unused profile acceptance operation");
    },
    onPageActionCommitted: async (proof: WebChatPageActionProof) => {
      receipts.actions.push(proof);
      if (browser && proof.actionId === "apply_execution_profile" && proof.result === "committed") {
        await browser.asLease().resolvePendingMutation({
          schemaVersion: "grasseye.browser.outcome-resolution.v1",
          ownerPluginId: "xuanxue-ai-production",
          outcome: "TERMINAL_SUCCESS",
          positiveEvidenceRef: `${proof.evidenceRef}:target-state-confirmed`,
          negativeEvidenceRef: `${proof.evidenceRef}:adjacent-states-excluded`,
          uniqueTargetRef: browser.target.targetRef,
          boundedAt: proof.endedAt,
        });
      }
    },
    onProviderExecutionProfileVerified: async (proof: ProviderExecutionProfileProof) => { receipts.profile = proof; },
    onConversationTitleFinalizationStarted: async () => {},
    onConversationTitleVerified: async () => {},
    onSubmissionObserved: async () => {},
    onSubmitted: async () => {},
    onConversationCanonicalized: async () => {},
    onForkActionObserved: async () => {},
    onResponseCaptured: async () => {
      throw new Error("unused profile acceptance operation");
    },
    onGeneratedImageCheckpointed: async () => {},
  },
});

const acceptExactMutationAndReadback = async (): Promise<void> => {
  const browser = new ProfileBrowserFixture("GPT-5.5", "高");
  const receipts = { actions: [] as WebChatPageActionProof[], profile: null as ProviderExecutionProfileProof | null };
  const proof = await enforceGptWebExecutionProfile({
    browser: browser.asLease(),
    context: context(receipts, browser),
    request: request("extra_high"),
  });
  assert.equal(browser.model, "GPT-5.6 Sol");
  assert.equal(browser.reasoning, "极高");
  assert.equal(proof?.reasoningUiLabel, "极高");
  assert.equal(proof?.noOp, false);
  assert.equal(receipts.profile?.profileHash, proof?.profileHash);
  assert.equal(receipts.actions.at(-1)?.actionId, "verify_execution_profile");
  assert.ok(receipts.actions.slice(0, -1).every(
    (entry) => entry.actionId === "apply_execution_profile" && entry.candidateCount === 1,
  ));
  assert.ok(browser.actions.indexOf("高级") < browser.actions.indexOf("模型"));
  assert.ok(browser.actions.indexOf("选择:GPT-5.6 Sol") < browser.actions.indexOf("选择:极高"));
  assert.deepEqual(browser.actions, [
    "模型选择下拉",
    "高级",
    "模型",
    "选择:GPT-5.6 Sol",
    "模型选择下拉",
    "高级",
    "推理强度",
    "选择:极高",
    "模型选择下拉",
    "高级",
    "模型选择下拉",
  ]);
  assert.equal(browser.resolvedMutations, browser.actions.length);
  assert.ok(
    browser.snapshotReadCount <= 30,
    `one complete profile change must stay bounded, observed ${browser.snapshotReadCount} surface snapshots`,
  );
};

const acceptObservedExactDomTextForStructuredModelLabel = async (): Promise<void> => {
  const browser = new ProfileBrowserFixture(
    "GPT-5.5",
    "高",
    false,
    0,
    null,
    0,
    null,
    "GPT-5.6\n Sol",
  );
  const proof = await enforceGptWebExecutionProfile({
    browser: browser.asLease(),
    context: context({ actions: [], profile: null }, browser),
    request: request("high"),
  });
  assert.equal(proof?.modelDisplayName, "GPT-5.6 Sol");
  assert.equal(browser.model, "GPT-5.6 Sol");
  assert.ok(browser.choiceClickTexts.includes("GPT-5.6\n Sol"));
  assert.equal(browser.choiceClickTexts.includes("GPT-5.6 Sol"), false);
};

const acceptNoOpAndExclusion = async (): Promise<void> => {
  const browser = new ProfileBrowserFixture("GPT-5.6 Sol", "Pro");
  const receipts = { actions: [] as WebChatPageActionProof[], profile: null as ProviderExecutionProfileProof | null };
  const proof = await enforceGptWebExecutionProfile({
    browser: browser.asLease(),
    context: context(receipts, browser),
    request: request("pro_standard"),
  });
  assert.equal(proof?.noOp, true);
  assert.equal(browser.actions.some((action) => action.startsWith("选择:")), false);
  assert.deepEqual(browser.actions, ["模型选择下拉", "高级", "模型选择下拉"]);
  assert.equal(receipts.actions.at(-1)?.actionId, "verify_execution_profile");
  assert.ok(receipts.actions.slice(0, -1).every(
    (entry) => entry.actionId === "apply_execution_profile" && entry.candidateCount === 1,
  ));

  const ambiguous = new ProfileBrowserFixture("GPT-5.5", "高", true);
  await assert.rejects(
    enforceGptWebExecutionProfile({
      browser: ambiguous.asLease(),
      context: context({ actions: [], profile: null }, ambiguous),
      request: request("high"),
    }),
    /GPT_WEB_EXECUTION_PROFILE_MODEL_AMBIGUOUS/u,
  );
};

const acceptDelayedAdvancedMenuMount = async (): Promise<void> => {
  const browser = new ProfileBrowserFixture("GPT-5.6 Sol", "极高", false, 2);
  const proof = await enforceGptWebExecutionProfile({
    browser: browser.asLease(),
    context: context({ actions: [], profile: null }, browser),
    request: request("extra_high"),
  });
  assert.equal(proof?.noOp, true);
  assert.equal(browser.actions.filter((action) => action === "模型选择下拉").length, 2);
  assert.equal(browser.actions.includes("模型"), false);
  assert.equal(browser.actions.includes("推理强度"), false);
};

const acceptDelayedUniqueProfileTriggerMount = async (): Promise<void> => {
  const browser = new ProfileBrowserFixture("GPT-5.6 Sol", "极高", false, 0, null, 2);
  const proof = await enforceGptWebExecutionProfile({
    browser: browser.asLease(),
    context: context({ actions: [], profile: null }, browser),
    request: request("extra_high"),
  });
  assert.equal(proof?.noOp, true);
  assert.deepEqual(browser.triggerFindCounts.slice(0, 3), [0, 0, 1]);
  assert.equal(browser.actions.filter((action) => action === "模型选择下拉").length, 2);
};

const rejectModelMenuClosureWithoutExactModelReadback = async (): Promise<void> => {
  const browser = new ProfileBrowserFixture(
    "GPT-5.5",
    "高",
    false,
    0,
    null,
    0,
    "GPT-5.6 Sol",
  );
  await assert.rejects(
    enforceGptWebExecutionProfile({
      browser: browser.asLease(),
      context: context({ actions: [], profile: null }, browser),
      request: request("extra_high"),
    }),
    /GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH/u,
  );
  assert.equal(browser.model, "GPT-5.5");
  assert.equal(browser.actions.includes("推理强度"), false);
  assert.equal(browser.actions.includes("选择:极高"), false);
};

const acceptNoBacktrackingForReasoningOnlyChange = async (): Promise<void> => {
  const browser = new ProfileBrowserFixture("GPT-5.6 Sol", "高");
  const proof = await enforceGptWebExecutionProfile({
    browser: browser.asLease(),
    context: context({ actions: [], profile: null }, browser),
    request: request("extra_high"),
  });
  assert.equal(proof?.reasoningUiLabel, "极高");
  assert.deepEqual(browser.actions, [
    "模型选择下拉",
    "高级",
    "推理强度",
    "选择:极高",
    "模型选择下拉",
    "高级",
    "模型选择下拉",
  ]);
};

const acceptCommittedOutcomeUnknownWithoutReplay = async (): Promise<void> => {
  const browser = new ProfileBrowserFixture("GPT-5.6 Sol", "高", false, 0, "极高");
  const receipts = {
    actions: [] as WebChatPageActionProof[],
    profile: null as ProviderExecutionProfileProof | null,
  };
  const proof = await enforceGptWebExecutionProfile({
    browser: browser.asLease(),
    context: context(receipts, browser),
    request: request("extra_high"),
  });
  assert.equal(proof?.reasoningUiLabel, "极高");
  assert.equal(browser.reasoning, "极高");
  assert.equal(browser.actions.filter((action) => action === "选择:极高").length, 1);
  assert.equal(browser.resolvedMutations, browser.actions.length);
  assert.equal(receipts.actions.at(-1)?.actionId, "verify_execution_profile");
};

const acceptCurrentDocumentProfileCheckpointWithoutMenuReplay = async (): Promise<void> => {
  const browser = new ProfileBrowserFixture("GPT-5.6 Sol", "极高");
  const receipts = {
    actions: [] as WebChatPageActionProof[],
    profile: null as ProviderExecutionProfileProof | null,
  };
  const requestInput = request("extra_high");
  const executionContext = context(receipts, browser);
  const proof = await enforceGptWebExecutionProfile({
    browser: browser.asLease(),
    context: executionContext,
    request: requestInput,
  });
  assert.ok(proof);
  executionContext.webChatExecution!.providerExecutionProfileProof = proof;
  const actionCount = browser.actions.length;
  const snapshotCount = browser.snapshotReadCount;
  const resumed = await prepareWebChatSessionForSubmission({
    browser: browser.asLease(),
    context: executionContext,
    request: requestInput,
    providerUrl: "https://chatgpt.com/",
  });
  assert.equal(resumed?.profileHash, proof.profileHash);
  assert.equal(browser.actions.length, actionCount);
  assert.equal(browser.snapshotReadCount, snapshotCount);
};

const acceptZeroTurnCountWithoutSyntheticMatches = async (): Promise<void> => {
  const browser = new ProfileBrowserFixture("GPT-5.6 Sol", "极高");
  const lease: BrowserTargetLease = {
    ...browser.asLease(),
    executeDomIntent: async (intent) => {
      if (intent.kind === "document") return { url: "https://chatgpt.com/", title: "ChatGPT" };
      if (intent.kind === "find") return { count: 0 };
      throw new Error(`unexpected intent ${intent.kind}`);
    },
  };
  const state = await readPreSubmitConversationState({
    browser: lease,
    request: request("extra_high"),
    context: context({ actions: [], profile: null }),
    providerUrl: "https://chatgpt.com/",
  });
  assert.deepEqual(state, {
    previousAssistantCount: 0,
    previousUserMessageCount: 0,
    previousAnswerText: null,
  });
};

const acceptExactHighDoesNotMatchExtraHigh = async (): Promise<void> => {
  const browser = new ProfileBrowserFixture("GPT-5.6 Sol", "极高");
  const proof = await enforceGptWebExecutionProfile({
    browser: browser.asLease(),
    context: context({ actions: [], profile: null }, browser),
    request: request("high"),
  });
  assert.equal(proof?.reasoningUiLabel, "高");
  assert.equal(browser.reasoning, "高");
  assert.equal(browser.actions.filter((action) => action === "选择:高").length, 1);
  assert.equal(browser.actions.filter((action) => action === "选择:极高").length, 0);
};

const acceptOneTimeProofEmptyProfileStateCorrection = async (): Promise<void> => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "gpt-profile-state-correction-"));
  const profileRequest = request("high");
  const input = {
    dataDir,
    executionId: "profile-state-correction-execution",
    providerKind: "gpt-web-chat" as const,
    inputHash: "sha256:profile-state-correction-input",
    textPrompt: profileRequest.textPrompt,
    providerExecutionProfileBinding: profileRequest.providerExecutionProfile!,
  };
  const legacyReason =
    "review_required: NOT_PRODUCTION_VERIFIED: GPT pre-submit model and reasoning controls have no exact verified readback; GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH";
  try {
    const created = await startOrResumeWebChatExecution(input);
    const legacy = await updateWebChatExecution({
      dataDir,
      record: created.record,
      patch: {
        status: "review_required",
        failures: [{
          occurredAt: "2026-08-22T00:00:00.000Z",
          attemptId: created.record.attemptId,
          phase: "submitting",
          classification: "review_required",
          recoverable: false,
          reason: legacyReason,
        }],
      },
    });
    const corrected = await startOrResumeWebChatExecution(input);
    assert.equal(corrected.resume, false);
    assert.equal(corrected.record.status, "recovery_pending");
    assert.notEqual(corrected.record.attemptId, legacy.attemptId);
    assert.ok(corrected.record.failures.some(
      (failure) => failure.reason === LEGACY_PROFILE_READBACK_STATE_CORRECTION,
    ));
    const repeatedLegacy = await updateWebChatExecution({
      dataDir,
      record: corrected.record,
      patch: { status: "review_required" },
    });
    assert.equal(repeatedLegacy.submission, null);
    await assert.rejects(
      startOrResumeWebChatExecution(input),
      /submitted web-chat execution is missing its durable submission proof/u,
      "the exact legacy correction marker must prevent a live review-task reset loop",
    );
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
};

await acceptExactMutationAndReadback();
await acceptObservedExactDomTextForStructuredModelLabel();
await acceptNoOpAndExclusion();
await acceptDelayedAdvancedMenuMount();
await acceptDelayedUniqueProfileTriggerMount();
await rejectModelMenuClosureWithoutExactModelReadback();
await acceptNoBacktrackingForReasoningOnlyChange();
await acceptCommittedOutcomeUnknownWithoutReplay();
await acceptCurrentDocumentProfileCheckpointWithoutMenuReplay();
await acceptZeroTurnCountWithoutSyntheticMatches();
await acceptExactHighDoesNotMatchExtraHigh();
await acceptOneTimeProofEmptyProfileStateCorrection();
process.stdout.write("[gpt-web-execution-profile] PASS current-surface snapshots, observed exact DOM choice text, one-action transitions, bounded waiting, committed UNKNOWN adjudication without replay, exact terminal model/reasoning readback, no-op, ambiguity exclusion and one-time proof-empty state correction\n");

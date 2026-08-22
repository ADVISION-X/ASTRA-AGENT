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
import {
  LEGACY_PROFILE_READBACK_STATE_CORRECTION,
  startOrResumeWebChatExecution,
  updateWebChatExecution,
} from "../runtime/web-chat-execution-state.js";

const trigger = "form button[aria-haspopup='menu'][data-tone='neutral']";
const advancedClosed = "[role='menuitem'][aria-label='显示高级选项']";
const advancedOpen = "[role='menuitem'][aria-label='显示精简选项']";
const submenus = "[role='menuitem'][data-has-submenu]";
const choices = "[role='menuitemradio']";
const checkedChoices = "[role='menuitemradio'][aria-checked='true']";

class ProfileBrowserFixture {
  public readonly actions: string[] = [];
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

  public constructor(
    public model: string,
    public reasoning: string,
    private readonly duplicateModel = false,
  ) {}

  public readonly wait = async (): Promise<void> => {};

  public readonly executeDomIntent = async (intent: BrowserDomIntent): Promise<unknown> => {
    if (intent.kind === "document") return { url: "https://chatgpt.com/", title: "ChatGPT" };
    if (intent.kind === "readAttribute") {
      if (intent.selector !== trigger || intent.name !== "aria-expanded") {
        throw new Error("unexpected readAttribute");
      }
      return this.expanded ? "true" : "false";
    }
    if (intent.kind === "find") return { count: this.find(intent.selector!, intent.textContains) };
    if (intent.kind !== "click") throw new Error(`unexpected intent ${intent.kind}`);
    this.click(intent.selector, intent.expectedText);
    return { clicked: true };
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
      resolvePendingMutations: async () => 0,
      assertNoPendingMutations: () => {},
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

  private valuesForSelector(selector: string): string[] {
    const lookups: Record<string, () => string[]> = {
      [trigger]: () => [this.reasoning],
      [advancedClosed]: () => this.expanded && !this.advanced ? ["高级"] : [],
      [advancedOpen]: () => this.expanded && this.advanced ? ["高级"] : [],
      [submenus]: () => this.expanded && this.advanced
        ? [`模型${this.model}`, `推理强度${this.reasoning}`] : [],
      [choices]: () => this.candidates(),
      [checkedChoices]: () => this.selected() ? [this.selected()!] : [],
    };
    const lookup = lookups[selector];
    if (!lookup) throw new Error(`unexpected selector ${selector}`);
    return lookup();
  }

  private find(selector: string, textContains?: string): number {
    const values = this.valuesForSelector(selector);
    return textContains === undefined
      ? values.length
      : values.filter((value) => value.includes(textContains)).length;
  }

  private click(selector: string, expectedText?: string): void {
    if (selector === trigger) {
      this.expanded = !this.expanded;
      this.advanced = false;
      this.submenu = null;
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
    if (selector === choices && expectedText && this.candidates().includes(expectedText)) {
      if (this.submenu === "模型") this.model = expectedText;
      if (this.submenu === "推理强度") this.reasoning = expectedText;
      this.actions.push(`选择:${expectedText}`);
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
    acceptanceRef: "APEX-AI-INPUT-GATEWAY-005-V3",
    acceptanceVersion: "2026-08-22.3",
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
}): AiProviderAdapterContext => ({
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
    onPageActionCommitted: async (proof: WebChatPageActionProof) => { receipts.actions.push(proof); },
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
    context: context(receipts),
    request: request("extra_high"),
  });
  assert.equal(browser.model, "GPT-5.6 Sol");
  assert.equal(browser.reasoning, "极高");
  assert.equal(proof?.reasoningUiLabel, "极高");
  assert.equal(proof?.noOp, false);
  assert.equal(receipts.profile?.profileHash, proof?.profileHash);
  assert.deepEqual(receipts.actions.map((entry) => entry.actionId), [
    "apply_execution_profile",
    "verify_execution_profile",
  ]);
  assert.ok(browser.actions.indexOf("高级") < browser.actions.indexOf("模型"));
  assert.ok(browser.actions.indexOf("选择:GPT-5.6 Sol") < browser.actions.indexOf("选择:极高"));
};

const acceptNoOpAndExclusion = async (): Promise<void> => {
  const browser = new ProfileBrowserFixture("GPT-5.6 Sol", "Pro");
  const receipts = { actions: [] as WebChatPageActionProof[], profile: null as ProviderExecutionProfileProof | null };
  const proof = await enforceGptWebExecutionProfile({
    browser: browser.asLease(),
    context: context(receipts),
    request: request("pro_standard"),
  });
  assert.equal(proof?.noOp, true);
  assert.equal(browser.actions.some((action) => action.startsWith("选择:")), false);
  assert.deepEqual(receipts.actions.map((entry) => entry.actionId), ["verify_execution_profile"]);

  const ambiguous = new ProfileBrowserFixture("GPT-5.5", "高", true);
  await assert.rejects(
    enforceGptWebExecutionProfile({
      browser: ambiguous.asLease(),
      context: context({ actions: [], profile: null }),
      request: request("high"),
    }),
    /GPT_WEB_EXECUTION_PROFILE_模型_AMBIGUOUS/u,
  );
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
await acceptNoOpAndExclusion();
await acceptOneTimeProofEmptyProfileStateCorrection();
process.stdout.write("[gpt-web-execution-profile] PASS exact advanced model/reasoning selection, readback, no-op, ambiguity exclusion and one-time proof-empty state correction\n");

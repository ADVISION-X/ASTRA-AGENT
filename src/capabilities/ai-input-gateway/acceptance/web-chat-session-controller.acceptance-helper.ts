import assert from "node:assert/strict";

import {
  assertProviderExecutionProfileIntegrity,
  governProductionGptExecutionProfileInput,
} from "../provider-execution-profile.js";
import {
  buildGptWebProviderExecutionProfile,
  normalizeGptWebReasoningTier,
  type AiFeedInput,
} from "../schema.js";
import {
  buildConversationTitleState,
  buildExpectedConversationTitle,
  titleProofFromState,
} from "../runtime/web-chat-conversation-title-policy.js";

const productionRequest = (overrides: Partial<AiFeedInput> = {}): AiFeedInput => ({
  providerKind: "gpt-web-chat",
  taskIdentity: {
    labelKey: "bazi_analysis",
    sourceProject: "xuanxue-web",
    taskKind: "bazi_chart_interpretation",
    sourceTaskId: "person-secret-order-123",
  },
  promptPackageId: "prompt-package",
  promptContractId: "bazi-production",
  expectedOutputSchemaRef: null,
  expectedOutputKind: "text",
  textPrompt: "姓名=不应进入标题; 生辰=1990-01-01; 手机=13800000000",
  inputRefs: [],
  modelName: null,
  providerExecutionProfile: buildGptWebProviderExecutionProfile({
    profileRef: "acceptance:gpt-web:v1",
    accountCapabilityRef: "acceptance:account",
    reasoningTier: "high",
    executorIdentityRef: "acceptance",
    acceptanceRef: "APEX-AI-INPUT-GATEWAY-005-V3",
    acceptanceVersion: "2026-08-19.1",
  }),
  timeoutMs: 180_000,
  maxFileCount: 0,
  requestedBy: "ai-capability",
  missionId: "mission",
  runId: "run",
  roundId: "round",
  conversationScopeRef: "scope",
  ...overrides,
});

const assertSemanticProfile = (): void => {
  assert.equal(normalizeGptWebReasoningTier("xhigh"), "extra_high");
  assert.equal(normalizeGptWebReasoningTier("pro"), "pro_standard");
  const profile = productionRequest().providerExecutionProfile!;
  assert.doesNotThrow(() => assertProviderExecutionProfileIntegrity(profile));
  assert.throws(
    () => assertProviderExecutionProfileIntegrity({
      ...profile,
      profileHash: `sha256:${"0".repeat(64)}`,
    }),
    /PROVIDER_EXECUTION_PROFILE_HASH_MISMATCH/u,
  );
};

const assertGatewayAdmissionFreezesProfile = (): void => {
  const raw = {
    ...productionRequest(),
    providerExecutionProfile: undefined,
  };
  const governed = governProductionGptExecutionProfileInput(raw) as AiFeedInput;
  assert.equal(governed.providerExecutionProfile?.schemaVersion, "gpt-web-execution-profile.v1");
  assert.equal(governed.providerExecutionProfile?.modelDisplayName, "GPT-5.6 Sol");
  assert.throws(
    () => governProductionGptExecutionProfileInput({
      ...raw,
      requestedReasoningEffort: "high",
    }),
    /GPT_SPLIT_PROFILE_FORBIDDEN/u,
  );
};

const assertPrivacySafeTitle = (): void => {
  const request = productionRequest();
  const built = buildExpectedConversationTitle({
    request,
    executionId: "xuanxue-ai-production:secret-person-order",
    createdAt: "2026-08-19T08:45:00.000Z",
  });
  assert.match(built.title, /^玄学·八字｜命盘解读｜\d{4}-\d{4}｜[A-Z2-9]{6}$/u);
  for (const forbidden of [
    request.textPrompt,
    request.taskIdentity.sourceTaskId,
    "13800000000",
    "1990-01-01",
    "姓名",
  ]) assert.equal(built.title.includes(forbidden), false);
};

const assertContinuationDoesNotFakeLegacyTitleProof = (): void => {
  const request = productionRequest({
    providerContinuationRef: {
      priorTaskId: "legacy-parent",
      priorRawOutputHash: `sha256:${"1".repeat(64)}`,
      providerPageUrl: "https://chatgpt.com/c/legacy-parent",
      priorTurnMarker: "GRASSEYE_TURN_LEGACY",
    },
  });
  assert.equal(buildConversationTitleState({
    request,
    executionId: "child",
    createdAt: "2026-08-19T08:45:00.000Z",
  }), null);
};

const assertVerifiedTitleProofIsExact = (): void => {
  const request = productionRequest();
  const state = buildConversationTitleState({
    request,
    executionId: "fresh-execution",
    createdAt: "2026-08-19T08:45:00.000Z",
  })!;
  assert.equal(titleProofFromState(state), null);
  const verified = {
    ...state,
    status: "verified" as const,
    previousObservedTitle: "Automatic title",
    observedTitle: state.expectedTitle,
    canonicalConversationUrl: "https://chatgpt.com/c/fresh-execution",
    verifiedAt: "2026-08-19T08:46:00.000Z",
    evidenceRef: "web-chat-title:proof",
    evidenceHash: `sha256:${"2".repeat(64)}` as const,
  };
  assert.equal(titleProofFromState(verified)?.expectedTitle, state.expectedTitle);
};

export const assertGptWebSessionControllerContracts = (): void => {
  assertSemanticProfile();
  assertGatewayAdmissionFreezesProfile();
  assertPrivacySafeTitle();
  assertContinuationDoesNotFakeLegacyTitleProof();
  assertVerifiedTitleProofIsExact();
};

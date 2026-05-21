import type { GrassEyeWorkbenchHandle } from "../../src/lib/local-runtime/workbench-handle.js";
import type { UserRequirementHistoryEntry } from "../../src/lib/local-runtime/settings-types.js";
import type { WorkbenchPreflightResult } from "../../src/lib/local-runtime/workbench-status-types.js";
import {
  listProductVideoEvidenceRecords,
  runProductVideoDomRoundRuntime,
} from "../../src/plugins/product-video-dom-runtime/index.js";
import { PlaywrightDomBrowserAdapter } from "./dom-smoke-browser.js";
import { fixtureJudge } from "./product-video-dom-smoke-judge.js";
export { writeProductVideoDomFixture } from "./product-video-dom-smoke-fixture.js";

export type ProductVideoDomSmokeState = {
  capturedStartInput: Record<string, unknown> | null;
  roundsCompleted: number;
  savedRecordCount: number;
  sawNonProductContinue: boolean;
};

type SmokeCommandPayload = Record<string, unknown>;

type SmokeMissionConfig = {
  maxRounds: number;
  platformId: string;
  productVideoPageUrl: string;
  userRequirementText: string;
};

type SmokeRoundResult = Awaited<ReturnType<typeof runProductVideoDomRoundRuntime>>;

const buildHistoryEntry = (): UserRequirementHistoryEntry => ({
  id: "history-1",
  title: "DOM smoke history",
  userRequirementText: "Find product-seeding videos.",
  selectedPlatforms: ["facebook-web"],
  maxRounds: 5,
  maxMinutes: 5,
  createdAt: new Date().toISOString(),
  lastUsedAt: new Date().toISOString(),
  useCount: 1,
});

const createUnusedAsync = (message = "unused") => async (): Promise<never> => {
  throw new Error(message);
};

const resolveSmokeMissionConfig = (payload: SmokeCommandPayload): SmokeMissionConfig | null => {
  const initialPayload = payload.initialPayload as Record<string, unknown> | null;
  const missionMode = initialPayload?.missionMode;
  const productVideoPageUrl = typeof initialPayload?.productVideoPageUrl === "string"
    ? initialPayload.productVideoPageUrl
    : typeof initialPayload?.targetUrl === "string"
      ? initialPayload.targetUrl
      : null;
  if (missionMode !== "dom_product_video" || !productVideoPageUrl) {
    return null;
  }
  return {
    maxRounds: typeof payload.maxRounds === "number" ? payload.maxRounds : 5,
    platformId: typeof payload.requestedPlatformId === "string" ? payload.requestedPlatformId : "facebook-web",
    productVideoPageUrl,
    userRequirementText: String(payload.userRequirementText ?? "Find product-seeding videos."),
  };
};

const buildSmokeRoundInput = (input: {
  tmp: string;
  browser: PlaywrightDomBrowserAdapter;
  config: SmokeMissionConfig;
  roundIndex: number;
  consecutiveAdvanceFailures: number;
}) => ({
  browser: input.browser,
  dataDir: input.tmp,
  missionId: "smoke-mission",
  runId: "smoke-run",
  roundId: `round-${input.roundIndex + 1}`,
  roundIndex: input.roundIndex,
  platformId: input.config.platformId,
  productVideoPageUrl: input.config.productVideoPageUrl,
  userRequirementText: input.config.userRequirementText,
  consecutiveAdvanceFailures: input.consecutiveAdvanceFailures,
  judgeOverride: fixtureJudge,
});

const applySmokeRoundState = (state: ProductVideoDomSmokeState, result: SmokeRoundResult): void => {
  state.roundsCompleted += 1;
  if (result.savedRecord) {
    state.savedRecordCount += 1;
    return;
  }
  if (result.roundResult.status === "continue") {
    state.sawNonProductContinue = true;
  }
};

const buildSmokePayloadFailure = () => ({
  status: "failed" as const,
  output: null,
  runtimeProof: null,
  failureReason: "DOM start payload was not forwarded correctly.",
  reviewRequiredReason: null,
});

const buildSmokeTerminalResponse = (
  state: ProductVideoDomSmokeState,
  result: SmokeRoundResult,
) => ({
  status: result.roundResult.status === "review_required" ? "review_required" as const : "failed" as const,
  output: {
    roundsCompleted: state.roundsCompleted,
    savedRecordCount: state.savedRecordCount,
  },
  runtimeProof: null,
  failureReason: result.roundResult.status === "stop" ? result.roundResult.reason : null,
  reviewRequiredReason: result.roundResult.status === "review_required" ? result.roundResult.reason : null,
});

const buildSmokeSuccessResponse = (state: ProductVideoDomSmokeState) => ({
  status: "success" as const,
  output: {
    roundsCompleted: state.roundsCompleted,
    savedRecordCount: state.savedRecordCount,
    sawNonProductContinue: state.sawNonProductContinue,
  },
  runtimeProof: null,
  failureReason: null,
  reviewRequiredReason: null,
});

const runSmokeRounds = async (input: {
  tmp: string;
  browser: PlaywrightDomBrowserAdapter;
  state: ProductVideoDomSmokeState;
  config: SmokeMissionConfig;
}) => {
  let consecutiveAdvanceFailures = 0;
  for (let roundIndex = 0; roundIndex < input.config.maxRounds; roundIndex += 1) {
    const result = await runProductVideoDomRoundRuntime(buildSmokeRoundInput({
      tmp: input.tmp,
      browser: input.browser,
      config: input.config,
      roundIndex,
      consecutiveAdvanceFailures,
    }));
    applySmokeRoundState(input.state, result);
    consecutiveAdvanceFailures = result.advanceFailureCount;
    if (result.roundResult.status !== "continue") {
      return buildSmokeTerminalResponse(input.state, result);
    }
  }
  return buildSmokeSuccessResponse(input.state);
};

const executeSmokeCommand = async (input: {
  tmp: string;
  browser: PlaywrightDomBrowserAdapter;
  state: ProductVideoDomSmokeState;
}, command: { childCapabilityId: string; input: unknown }) => {
  if (command.childCapabilityId !== "issue-human-command") {
    throw new Error("unexpected child capability in smoke commander");
  }
  const payload = command.input as SmokeCommandPayload;
  input.state.capturedStartInput = payload;
  const config = resolveSmokeMissionConfig(payload);
  return config ? runSmokeRounds({ ...input, config }) : buildSmokePayloadFailure();
};

const createCommanderConsole = (input: {
  tmp: string;
  browser: PlaywrightDomBrowserAdapter;
  state: ProductVideoDomSmokeState;
}) => ({
  abilityGroupId: "commander-console" as const,
  listChildCapabilityIds() {
    return ["issue-human-command"] as const;
  },
  execute(command: { childCapabilityId: string; input: unknown }) {
    return executeSmokeCommand(input, command);
  },
});

const createWorkbenchCoreApis = () => ({
  init: async () => {},
  getHealthReport: createUnusedAsync(),
  getMissionReadinessReport: createUnusedAsync(),
  getCommanderConsoleSnapshot: createUnusedAsync(),
  getOnlineAiProviderSettings: createUnusedAsync(),
  saveOnlineAiProviderSettings: createUnusedAsync(),
});

const createWorkbenchSettingsApis = (tmp: string) => ({
  async getMissionStartPreflight(): Promise<WorkbenchPreflightResult> {
    return {
      status: "ready",
      actionableMessage: "fixture ready",
      failureReason: null,
      nextAction: "start",
      ownerResponsible: "product-video-dom-smoke",
      components: [{ name: "localAi", ok: true, detail: "fixture judge", actionableMessage: null, ownerResponsible: "smoke" }],
    };
  },
  async getAppRunLimitSettings() {
    return { defaultMaxRounds: 5, defaultMaxMinutes: 5, updatedAt: null };
  },
  async saveAppRunLimitSettings() {
    return { defaultMaxRounds: 5, defaultMaxMinutes: 5, updatedAt: null };
  },
  getDataDir() { return tmp; },
  getModeInfo() { return {}; },
});

const createWorkbenchHistoryApis = () => ({
  getUserRequirementHistory: async () => [],
  async upsertUserRequirementHistory() { return buildHistoryEntry(); },
  deleteUserRequirementHistory: createUnusedAsync(),
  reuseUserRequirementHistory: async () => null,
});

const createWorkbenchAmazonStubs = () => ({
  openAdminInvoicePage: createUnusedAsync(),
  startAmazonInvoiceUploadMission: createUnusedAsync(),
  startAmazonInvoiceUploadTask: createUnusedAsync(),
  resumeAmazonInvoiceUploadTask: createUnusedAsync(),
  getAmazonInvoiceUploadTaskStatus: createUnusedAsync(),
  getLatestAmazonInvoiceUploadTaskForInvoice: async () => null,
});

const createWorkbenchProductVideoApis = (tmp: string) => ({
  startProductVideoDomMiningTask: createUnusedAsync(),
  getProductVideoDomTaskStatus: createUnusedAsync(),
  async listProductVideoEvidenceRecords(limit?: number) {
    return listProductVideoEvidenceRecords({
      dataDir: tmp,
      ...(limit !== undefined ? { limit } : {}),
    });
  },
});

export const createProductVideoDomSmokeWorkbench = (input: {
  tmp: string;
  browser: PlaywrightDomBrowserAdapter;
  state: ProductVideoDomSmokeState;
}): GrassEyeWorkbenchHandle => ({
  commanderConsole: createCommanderConsole(input),
  ...createWorkbenchCoreApis(),
  ...createWorkbenchSettingsApis(input.tmp),
  ...createWorkbenchHistoryApis(),
  ...createWorkbenchAmazonStubs(),
  ...createWorkbenchProductVideoApis(input.tmp),
});

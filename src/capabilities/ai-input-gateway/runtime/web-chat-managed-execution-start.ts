import {
  acquireWebChatBrowserMutationLease,
  acquireWebChatCapacityLease,
  registerPendingWebChatSubmission,
  type WebChatRuntimeLease,
} from "./web-chat-concurrency-lease.js";
import {
  startOrResumeWebChatExecution,
  updateWebChatExecution,
  type WebChatExecutionRecord,
} from "./web-chat-execution-state.js";
import {
  createSingleTabWebChatBrowser,
  type SingleTabWebChatBrowser,
} from "./web-chat-single-tab-browser.js";
import type {
  ManagedWebChatInput,
} from "./web-chat-managed-execution.js";

export interface ActiveExecutionState {
  record: WebChatExecutionRecord;
  capacityLease: WebChatRuntimeLease;
  initialMutationLease: WebChatRuntimeLease | null;
  singleTabBrowser: SingleTabWebChatBrowser | null;
  resume: boolean;
  releasePendingSubmission: (() => void) | null;
}

const resolveWebChatProviderKind = (
  input: ManagedWebChatInput,
): "gpt-web-chat" | "gemini-web-chat" => {
  if (input.request.providerKind === "gpt-web-chat") return "gpt-web-chat";
  if (input.request.providerKind === "gemini-web-chat") {
    return "gemini-web-chat";
  }
  throw new Error(
    `review_required: provider ${input.request.providerKind} `
    + "is not a managed web-chat provider.",
  );
};

export const managedExecutionIdFor = (
  input: ManagedWebChatInput,
  inputHash: string,
): string => input.executionId ?? [
  input.request.providerKind,
  input.request.missionId ?? "mission",
  input.request.runId ?? input.request.roundId ?? inputHash,
  input.request.promptPackageId,
].join(":");

const prepareActiveBrowser = async (input: {
  source: ManagedWebChatInput;
  record: WebChatExecutionRecord;
  resume: boolean;
  reportProgress: (phase: string) => Promise<void>;
}): Promise<{
  record: WebChatExecutionRecord;
  initialMutationLease: WebChatRuntimeLease | null;
  singleTabBrowser: SingleTabWebChatBrowser | null;
}> => {
  if (!input.source.browser) {
    return {
      record: input.record,
      initialMutationLease: null,
      singleTabBrowser: null,
    };
  }
  let record = input.record;
  let initialMutationLease: WebChatRuntimeLease | null = null;
  try {
    if (!input.resume) {
      initialMutationLease = await acquireWebChatBrowserMutationLease({
        dataDir: input.source.dataDir,
        timeoutMs: input.source.request.timeoutMs,
        ...(input.source.signal ? { signal: input.source.signal } : {}),
      });
      record = await updateWebChatExecution({
        dataDir: input.source.dataDir,
        record,
        patch: { status: "submitting" },
      });
      await input.reportProgress("submitting");
    }
    const singleTabBrowser = createSingleTabWebChatBrowser({
      base: input.source.browser,
      dataDir: input.source.dataDir,
      executionId: record.executionId,
      providerKind: record.providerKind,
      turnMarker: record.turnMarker,
      timeoutMs: input.source.request.timeoutMs,
      initialMutationLease,
      resumeSubmission: input.resume ? record.submission : null,
      ...(input.source.signal ? { signal: input.source.signal } : {}),
    });
    return { record, initialMutationLease: null, singleTabBrowser };
  } catch (error) {
    await initialMutationLease?.release();
    throw error;
  }
};

export const startActiveExecution = async (input: {
  source: ManagedWebChatInput;
  inputHash: string;
  reportProgress: (phase: string) => Promise<void>;
}): Promise<ActiveExecutionState> => {
  const executionId = managedExecutionIdFor(input.source, input.inputHash);
  const started = await startOrResumeWebChatExecution({
    dataDir: input.source.dataDir,
    executionId,
    turnIdentitySeed: [
      executionId,
      input.source.request.providerKind,
      input.source.request.taskIdentity.sourceProject,
      input.source.request.taskIdentity.taskKind,
      input.source.request.taskIdentity.sourceTaskId,
      input.source.request.promptPackageId,
      input.source.request.promptContractId,
      input.inputHash,
    ].join("\u0000"),
    providerKind: resolveWebChatProviderKind(input.source),
    inputHash: input.inputHash,
    textPrompt: input.source.request.textPrompt,
  });
  let record = started.record;
  await input.reportProgress("waiting_for_capacity");
  const capacityLease = await acquireWebChatCapacityLease({
    dataDir: input.source.dataDir,
    timeoutMs: input.source.request.timeoutMs,
    ...(input.source.signal ? { signal: input.source.signal } : {}),
  });
  let releasePendingSubmission = started.resume
    ? null
    : registerPendingWebChatSubmission(input.source.dataDir, record.executionId);
  try {
    record = await updateWebChatExecution({
      dataDir: input.source.dataDir,
      record,
      patch: {
        capacitySlot: capacityLease.slot,
        providerLeaseId: capacityLease.leaseId,
        status: started.resume
          ? "waiting_provider"
          : "waiting_for_submit_slot",
      },
    });
    await input.reportProgress(
      started.resume ? "waiting_provider" : "waiting_for_submit_slot",
    );
    const browserState = await prepareActiveBrowser({
      source: input.source,
      record,
      resume: started.resume,
      reportProgress: input.reportProgress,
    });
    return {
      record: browserState.record,
      capacityLease,
      initialMutationLease: browserState.initialMutationLease,
      singleTabBrowser: browserState.singleTabBrowser,
      resume: started.resume,
      releasePendingSubmission,
    };
  } catch (error) {
    releasePendingSubmission?.();
    releasePendingSubmission = null;
    await capacityLease.release();
    throw error;
  }
};

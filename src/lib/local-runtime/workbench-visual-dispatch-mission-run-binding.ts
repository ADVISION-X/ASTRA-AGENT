type MissionRunBinding = {
  missionId: string | null;
  runId: string | null;
};

const failBinding = (dispatchLabel: string, detail: string): never => {
  throw new Error(`Visual Target ${dispatchLabel} ${detail}`);
};

export const requireVisualDispatchMissionRunBinding = (input: {
  dispatchLabel: string;
  requestMissionId: string;
  requestRunId: string;
  screenshot: MissionRunBinding;
  ai: MissionRunBinding;
  pageState: { missionId: string; runId: string };
}) => {
  if (
    !input.screenshot.missionId
    || !input.screenshot.runId
    || !input.ai.missionId
    || !input.ai.runId
    || !input.pageState.missionId
    || !input.pageState.runId
  ) {
    failBinding(input.dispatchLabel, "requires governed screenshot, AI, and page-state mission/run identity.");
  }

  if (input.screenshot.missionId !== input.requestMissionId) {
    failBinding(input.dispatchLabel, "missionId mismatch between request and screenshot proof.");
  }
  if (input.screenshot.runId !== input.requestRunId) {
    failBinding(input.dispatchLabel, "runId mismatch between request and screenshot proof.");
  }
  if (input.ai.missionId !== input.requestMissionId) {
    failBinding(input.dispatchLabel, "missionId mismatch between request and AI proof.");
  }
  if (input.ai.runId !== input.requestRunId) {
    failBinding(input.dispatchLabel, "runId mismatch between request and AI proof.");
  }
  if (input.pageState.missionId !== input.requestMissionId) {
    failBinding(input.dispatchLabel, "missionId mismatch between request and page-state proof.");
  }
  if (input.pageState.runId !== input.requestRunId) {
    failBinding(input.dispatchLabel, "runId mismatch between request and page-state proof.");
  }

  return {
    screenshotMissionId: input.screenshot.missionId,
    screenshotRunId: input.screenshot.runId,
    aiMissionId: input.ai.missionId,
    aiRunId: input.ai.runId,
  };
};
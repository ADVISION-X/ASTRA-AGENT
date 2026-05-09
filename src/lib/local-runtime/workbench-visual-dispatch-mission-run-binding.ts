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
  const bindings = [
    { sourceLabel: "screenshot", missionId: input.screenshot.missionId, runId: input.screenshot.runId },
    { sourceLabel: "AI", missionId: input.ai.missionId, runId: input.ai.runId },
    { sourceLabel: "page-state", missionId: input.pageState.missionId, runId: input.pageState.runId },
  ] as const;

  if (bindings.some((binding) => !binding.missionId || !binding.runId)) {
    failBinding(input.dispatchLabel, "requires governed screenshot, AI, and page-state mission/run identity.");
  }

  for (const binding of bindings) {
    if (binding.missionId !== input.requestMissionId) {
      failBinding(input.dispatchLabel, `missionId mismatch between request and ${binding.sourceLabel} proof.`);
    }
    if (binding.runId !== input.requestRunId) {
      failBinding(input.dispatchLabel, `runId mismatch between request and ${binding.sourceLabel} proof.`);
    }
  }

  return {
    screenshotMissionId: input.screenshot.missionId,
    screenshotRunId: input.screenshot.runId,
    aiMissionId: input.ai.missionId,
    aiRunId: input.ai.runId,
  };
};
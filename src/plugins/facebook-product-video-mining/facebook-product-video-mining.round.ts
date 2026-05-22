import type { FacebookMiningRoundOutcome } from "./facebook-product-video-mining.navigation.js";
import { buildFacebookMiningRoundState } from "./facebook-product-video-mining.result.js";
import {
  FacebookMiningRoundRuntime,
  type FacebookMiningRoundContext,
  type FacebookMiningRoundInput,
} from "./facebook-product-video-mining.round-runtime.js";
import {
  downloadFacebookMiningRoundArtifacts,
  judgeFacebookMiningRound,
} from "./facebook-product-video-mining.round-execution.js";
import { downloadCurrentFacebookVideo } from "./facebook-product-video-mining.video.js";
import { judgeFacebookProductVideo } from "./facebook-product-video-mining.ai-judge.js";

export const runFacebookMiningRound = async (
  input: FacebookMiningRoundInput,
): Promise<FacebookMiningRoundOutcome> => {
  const context: FacebookMiningRoundContext = {
    input,
    round: buildFacebookMiningRoundState({ run: input.run, roundIndex: input.roundIndex }),
  };
  FacebookMiningRoundRuntime.startFacebookMiningRound(context);
  const probe = await FacebookMiningRoundRuntime.probeFacebookMiningRound(context);
  if (!probe.ok) {
    return probe.outcome;
  }
  const artifacts = await downloadFacebookMiningRoundArtifacts({
    ...context,
    probe: probe.value,
    downloadCurrentFacebookVideo,
  });
  if (!artifacts.ok) {
    return artifacts.outcome;
  }
  const resolution = await judgeFacebookMiningRound({
    ...context,
    artifacts: artifacts.value,
    judgeFacebookProductVideo,
    timeoutMs: 90_000,
  });
  if (!resolution.ok) {
    return resolution.outcome;
  }
  await FacebookMiningRoundRuntime.applyFacebookMiningRoundDecision({
    context,
    resolution: resolution.value,
  });
  return FacebookMiningRoundRuntime.completeFacebookMiningRound(context);
};

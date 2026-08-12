import {
  FacebookProductVideoMiningMissionInputSchema,
  startFacebookProductVideoMiningMission,
} from "../plugins/facebook-product-video-mining/index.js";

export const runFacebookProductVideoMiningRoute = (
  rawInput: unknown,
  context: Parameters<typeof startFacebookProductVideoMiningMission>[1],
) => startFacebookProductVideoMiningMission(
  FacebookProductVideoMiningMissionInputSchema.parse(rawInput),
  context,
);

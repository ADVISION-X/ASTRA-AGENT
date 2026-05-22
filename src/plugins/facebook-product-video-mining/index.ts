import {
  runFacebookProductVideoMiningMission,
  type FacebookProductVideoMiningContext,
} from "./facebook-product-video-mining.flow.js";
import { buildFacebookMiningRunConfig } from "./facebook-product-video-mining.result.js";
import {
  FacebookProductVideoMiningSchemas,
  type FacebookProductVideoMiningContracts,
} from "./facebook-product-video-mining.schema.js";
import {
  exportFacebookProductVideoMiningSelectionRecords,
  listFacebookProductVideoMiningSavedRecords,
} from "./facebook-product-video-mining.records.js";
import { createFacebookProductVideoMiningStorage } from "./facebook-product-video-mining.storage.js";

type FacebookProductVideoMiningMissionInput = FacebookProductVideoMiningContracts["FacebookProductVideoMiningMissionInput"];
type FacebookProductVideoMiningRunStatus = FacebookProductVideoMiningContracts["FacebookProductVideoMiningRunStatus"];

const ACTIVE_FACEBOOK_PRODUCT_VIDEO_MINING_RUNS = new Map<string, Promise<FacebookProductVideoMiningRunStatus>>();

export const startFacebookProductVideoMiningMission = async (
  rawInput: FacebookProductVideoMiningMissionInput,
  context: FacebookProductVideoMiningContext,
): Promise<FacebookProductVideoMiningRunStatus> => {
  const mission = FacebookProductVideoMiningSchemas.FacebookProductVideoMiningMissionInputSchema.parse(rawInput);
  const run = buildFacebookMiningRunConfig(mission);
  const storage = createFacebookProductVideoMiningStorage(context.dataDir);
  try {
    const createdRun = storage.createRun(run);
    const backgroundRun = runFacebookProductVideoMiningMission(run, context).finally(() => {
      ACTIVE_FACEBOOK_PRODUCT_VIDEO_MINING_RUNS.delete(run.runId);
    });
    backgroundRun.catch(() => undefined);
    ACTIVE_FACEBOOK_PRODUCT_VIDEO_MINING_RUNS.set(run.runId, backgroundRun);
    return createdRun;
  } finally {
    storage.close();
  }
};

export const getFacebookProductVideoMiningRunStatus = (input: {
  dataDir: string;
  runId: string;
}): FacebookProductVideoMiningRunStatus | null => {
  const storage = createFacebookProductVideoMiningStorage(input.dataDir);
  try {
    return storage.getRunStatus(input.runId);
  } finally {
    storage.close();
  }
};

export const getLatestFacebookProductVideoMiningRun = (input: {
  dataDir: string;
}): FacebookProductVideoMiningRunStatus | null => {
  const storage = createFacebookProductVideoMiningStorage(input.dataDir);
  try {
    return storage.getLatestRun();
  } finally {
    storage.close();
  }
};

export {
  exportFacebookProductVideoMiningSelectionRecords,
  listFacebookProductVideoMiningSavedRecords,
  createFacebookProductVideoMiningStorage,
  FacebookProductVideoMiningSchemas,
  runFacebookProductVideoMiningMission,
};
export type {
  FacebookProductVideoMiningContracts,
  FacebookProductVideoMiningContext,
  FacebookProductVideoMiningMissionInput,
  FacebookProductVideoMiningRunStatus,
};

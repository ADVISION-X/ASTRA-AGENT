import {
  type FacebookProductVideoMiningContracts,
} from "./facebook-product-video-mining.schema.js";
import { createFacebookProductVideoMiningStorage } from "./facebook-product-video-mining.storage.js";

type FacebookProductVideoMiningSelectionExport = FacebookProductVideoMiningContracts["FacebookProductVideoMiningSelectionExport"];
type FacebookProductVideoMiningSelectionExportItem = FacebookProductVideoMiningContracts["FacebookProductVideoMiningSelectionExportItem"];

export const listFacebookProductVideoMiningSavedRecords = (input: {
  dataDir: string;
  runId: string;
}): FacebookProductVideoMiningSelectionExportItem[] => {
  const storage = createFacebookProductVideoMiningStorage(input.dataDir);
  try {
    return storage.listSavedSelectionRecords(input.runId);
  } finally {
    storage.close();
  }
};

export const exportFacebookProductVideoMiningSelectionRecords = (input: {
  dataDir: string;
  runId: string;
}): FacebookProductVideoMiningSelectionExport | null => {
  const storage = createFacebookProductVideoMiningStorage(input.dataDir);
  try {
    const run = storage.getRunStatus(input.runId);
    return run ? storage.buildSelectionExport(run) : null;
  } finally {
    storage.close();
  }
};

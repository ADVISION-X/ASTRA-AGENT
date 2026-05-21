import type { BrowserController } from "../../lib/browser/browser-controller.js";
import { ProductVideoDomMissionInputSchema } from "./product-video-dom.schema.js";
import type {
  ProductVideoDomMissionInput,
  ProductVideoDomTaskRecord,
  ProductVideoEvidenceRecord,
} from "./product-video-dom.schema.js";
import { startProductVideoDomTask } from "./product-video-dom.flow.js";
import { loadProductVideoTaskRecord } from "./product-video-task-storage.js";
import { listProductVideoEvidenceRecords as listStoredProductVideoEvidenceRecords } from "./product-video-store.js";

export const startProductVideoDomMiningTask = async (input: {
  browser: BrowserController;
  dataDir: string;
  mission: ProductVideoDomMissionInput;
}): Promise<ProductVideoDomTaskRecord> => {
  const mission = ProductVideoDomMissionInputSchema.parse(input.mission);
  return startProductVideoDomTask({ ...input, mission });
};

export const getProductVideoDomTaskStatus = (input: {
  dataDir: string;
  taskId: string;
}): ProductVideoDomTaskRecord => {
  const record = loadProductVideoTaskRecord(input.dataDir, input.taskId);
  if (!record) {
    throw new Error(`Product video DOM task not found: ${input.taskId}`);
  }
  return record;
};

export const listProductVideoEvidenceRecords = (input: {
  dataDir: string;
  limit?: number;
}): ProductVideoEvidenceRecord[] => listStoredProductVideoEvidenceRecords(input);

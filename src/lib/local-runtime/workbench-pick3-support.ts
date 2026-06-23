import {
  deletePick3HumanReviewTask,
  getLatestPick3IsBlindEvalTask,
  getPick3IsBlindEvalTaskStatus,
  getPick3HumanReviewInteraction,
  getPick3HumanReviewTask,
  listPick3TrendSnapshot,
  listPick3HumanReviewHistory,
  resumePick3IsBlindEvalTask,
  reviewPick3PlaybookLessonManually,
  startPick3IsBlindEvalTask,
  type Pick3TaskRecord,
  type RunPick3Context,
} from "../../plugins/pick3-is-blind-eval/index.js";
import type { WorkbenchAssembly } from "./workbench-assembly.js";

const buildPick3GatewayContext = (
  assembly: WorkbenchAssembly,
  dataDir: string,
): RunPick3Context => ({
  dataDir,
  browser: assembly.browserController,
  pick3GatewaySender: (input) => assembly.aiInputGateway.execute(input),
  runtimeLogger: assembly.runtimeLogger,
});

const buildPick3TaskHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  async startPick3IsBlindEvalTask(rawInput: unknown): Promise<Pick3TaskRecord> {
    return startPick3IsBlindEvalTask(rawInput, buildPick3GatewayContext(assembly, dataDir));
  },
  async resumePick3IsBlindEvalTask(rawInput: unknown): Promise<Pick3TaskRecord> {
    return resumePick3IsBlindEvalTask(rawInput, buildPick3GatewayContext(assembly, dataDir));
  },
  async getPick3IsBlindEvalTaskStatus(taskId: string): Promise<Pick3TaskRecord | null> {
    return getPick3IsBlindEvalTaskStatus(dataDir, taskId);
  },
});

const buildPick3ReadHandle = (dataDir: string) => ({
  async getLatestPick3IsBlindEvalTask(): Promise<Pick3TaskRecord | null> {
    return getLatestPick3IsBlindEvalTask(dataDir);
  },
  async listPick3TrendSnapshot() {
    return listPick3TrendSnapshot(dataDir);
  },
  async listPick3HumanReviewHistory() {
    return listPick3HumanReviewHistory(dataDir);
  },
  async getPick3HumanReviewTask(taskId: string) {
    return getPick3HumanReviewTask(dataDir, taskId);
  },
  async getPick3HumanReviewInteraction(input: { interactionId: string; taskId: string }) {
    return getPick3HumanReviewInteraction(dataDir, input);
  },
  async deletePick3HumanReviewTask(taskId: string) {
    return deletePick3HumanReviewTask(dataDir, taskId);
  },
});

const buildPick3ReviewHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  async reviewPick3PlaybookLessonManually(input: { phase: string; position: string; taskId: string }) {
    return reviewPick3PlaybookLessonManually(dataDir, {
      ...input,
      sender: (feedInput) => assembly.aiInputGateway.execute(feedInput),
    });
  },
});

export const buildPick3IsBlindEvalHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  ...buildPick3TaskHandle(assembly, dataDir),
  ...buildPick3ReadHandle(dataDir),
  ...buildPick3ReviewHandle(assembly, dataDir),
});

import {
  deletePick3HumanReviewTask,
  getLatestPick3IsBlindEvalTask,
  getPick3HumanReviewInteraction,
  getPick3HumanReviewTask,
  listPick3TrendSnapshot,
  listPick3HumanReviewHistory,
  runPick3IsBlindEvalFlow,
  type Pick3TaskRecord,
} from "../../plugins/pick3-is-blind-eval/index.js";
import type { WorkbenchAssembly } from "./workbench-assembly.js";

export const buildPick3IsBlindEvalHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  async startPick3IsBlindEvalTask(rawInput: unknown): Promise<Pick3TaskRecord> {
    return runPick3IsBlindEvalFlow(rawInput, {
      dataDir,
      browser: assembly.browserController,
      pick3GatewaySender: (input) => assembly.aiInputGateway.execute(input),
      runtimeLogger: assembly.runtimeLogger,
    });
  },
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

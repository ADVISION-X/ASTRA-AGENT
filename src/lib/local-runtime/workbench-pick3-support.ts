import {
  getLatestPick3IsBlindEvalTask,
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
    });
  },
  async getLatestPick3IsBlindEvalTask(): Promise<Pick3TaskRecord | null> {
    return getLatestPick3IsBlindEvalTask(dataDir);
  },
});

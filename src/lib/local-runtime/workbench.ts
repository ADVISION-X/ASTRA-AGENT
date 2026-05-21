import {
  loadAppRunLimitSettings,
  saveAppRunLimitSettings,
} from "./settings.js";
import {
  getHealthReport,
  getMissionReadinessReport,
  getMissionStartPreflight,
  getModeInfo,
} from "./workbench-status.js";
import {
  loadOnlineAiProviderPublicStatus,
  saveOnlineAiProviderConfig,
} from "../online-ai/index.js";
import {
  createWorkbenchAssembly,
  type WorkbenchAssembly,
} from "./workbench-assembly.js";
import type { GrassEyeWorkbenchOptions } from "./contract.js";
import type { GrassEyeWorkbenchHandle } from "./workbench-handle.js";
import {
  getLatestAmazonInvoiceUploadTaskForInvoice,
  getAmazonInvoiceUploadTaskStatus,
  openAmazonInvoiceAdminPage,
  resumeAmazonInvoiceUploadTask,
  startAmazonInvoiceUploadTask,
  startAmazonInvoiceUploadMission,
} from "../../plugins/local-workbench-plugin-tasks.js";

const buildSettingsHandle = (dataDir: string) => ({
  async getAppRunLimitSettings() {
    return loadAppRunLimitSettings(dataDir);
  },
  async saveAppRunLimitSettings(input: Parameters<typeof saveAppRunLimitSettings>[1]) {
    return saveAppRunLimitSettings(dataDir, input);
  },
  async getOnlineAiProviderSettings() {
    return loadOnlineAiProviderPublicStatus(dataDir);
  },
  async saveOnlineAiProviderSettings(input: Parameters<typeof saveOnlineAiProviderConfig>[1]) {
    return saveOnlineAiProviderConfig(dataDir, input);
  },
});

const buildAmazonInvoiceHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  ...buildAmazonInvoiceMissionHandle(assembly),
  ...buildAmazonInvoiceTaskHandle(assembly, dataDir),
});

const buildAmazonInvoiceMissionHandle = (assembly: WorkbenchAssembly) => ({
  async openAdminInvoicePage(input: Parameters<typeof openAmazonInvoiceAdminPage>[1]) {
    return openAmazonInvoiceAdminPage(assembly.browserController, input);
  },
  async startAmazonInvoiceUploadMission(
    input: Parameters<typeof startAmazonInvoiceUploadMission>[2],
  ) {
    return startAmazonInvoiceUploadMission(assembly.browserController, assembly.runtimeLogger, input);
  },
});

const buildAmazonInvoiceTaskHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  async startAmazonInvoiceUploadTask(input: Parameters<typeof startAmazonInvoiceUploadTask>[0]["task"]) {
    return startAmazonInvoiceUploadTask({
      browser: assembly.browserController,
      runtimeLogger: assembly.runtimeLogger,
      dataDir,
      task: input,
    });
  },
  async resumeAmazonInvoiceUploadTask(input: { taskId: string }) {
    return resumeAmazonInvoiceUploadTask({
      browser: assembly.browserController,
      runtimeLogger: assembly.runtimeLogger,
      dataDir,
      taskId: input.taskId,
    });
  },
  async getAmazonInvoiceUploadTaskStatus(taskId: string) {
    return getAmazonInvoiceUploadTaskStatus({ dataDir, taskId });
  },
  async getLatestAmazonInvoiceUploadTaskForInvoice(input: { amazonOrderId: string; invoiceNo?: string }) {
    return getLatestAmazonInvoiceUploadTaskForInvoice({ dataDir, ...input });
  },
});

const buildWorkbenchHandle = (
  assembly: WorkbenchAssembly,
  init: () => Promise<void>,
): GrassEyeWorkbenchHandle => {
  const dataDir = assembly.dataDir;
  return {
    init,
    getHealthReport: async () => getHealthReport(assembly),
    getMissionReadinessReport: async () =>
      getMissionReadinessReport(assembly, assembly.options),
    getMissionStartPreflight: async (input) =>
      getMissionStartPreflight(assembly, assembly.options, input),
    getDataDir: () => dataDir,
    getModeInfo: () => getModeInfo(assembly.options),
    ...buildSettingsHandle(dataDir),
    ...buildAmazonInvoiceHandle(assembly, dataDir),
  };
};

export class GrassEyeWorkbench {
  private readonly assembly: WorkbenchAssembly;

  constructor(options: GrassEyeWorkbenchOptions) {
    this.assembly = createWorkbenchAssembly(options);
  }

  async init(): Promise<void> {
    // Storage is created lazily by the first evidence or task write.
  }

  createHandle(): GrassEyeWorkbenchHandle {
    return buildWorkbenchHandle(this.assembly, () => this.init());
  }
}

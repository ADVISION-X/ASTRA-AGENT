import {
  getAmazonInvoiceUploadTaskStatus,
  getAmazonTaxInvoiceDownloadArtifact as getAmazonTaxInvoiceDownloadArtifactFromPlugin,
  getAmazonTaxInvoiceDownloadTaskStatus as getAmazonTaxInvoiceDownloadTaskStatusFromPlugin,
  getLatestAmazonInvoiceUploadTaskForInvoice,
  getLatestAmazonTaxInvoiceDownloadTask as getLatestAmazonTaxInvoiceDownloadTaskFromPlugin,
  listAmazonInvoiceUploadLedger,
  openAmazonInvoiceAdminPage,
  resumeAmazonInvoiceUploadTask,
  startAmazonInvoiceUploadMission,
  startAmazonInvoiceUploadTask,
  startAmazonTaxInvoiceDownloadTask as startAmazonTaxInvoiceDownloadTaskFromPlugin,
} from "../../plugins/amazon-invoice-upload/index.js";
import type { WorkbenchAssembly } from "./workbench-assembly.js";

export const buildAmazonInvoiceHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  ...buildAmazonInvoiceMissionHandle(assembly),
  ...buildAmazonInvoiceTaskHandle(assembly, dataDir),
  ...buildAmazonInvoiceDownloadHandle(assembly, dataDir),
});

const buildAmazonInvoiceMissionHandle = (assembly: WorkbenchAssembly) => ({
  async openAdminInvoicePage(input: Parameters<typeof openAmazonInvoiceAdminPage>[1]) {
    return openAmazonInvoiceAdminPage(assembly.browserController, input);
  },
  async startAmazonInvoiceUploadMission(input: Parameters<typeof startAmazonInvoiceUploadMission>[2]) {
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
  async listAmazonInvoiceUploadLedger() {
    return listAmazonInvoiceUploadLedger({ dataDir });
  },
});

const buildAmazonInvoiceDownloadHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  async startAmazonTaxInvoiceDownloadTask(input: Parameters<typeof startAmazonTaxInvoiceDownloadTaskFromPlugin>[0]["mission"]) {
    return startAmazonTaxInvoiceDownloadTaskFromPlugin({
      browser: assembly.browserController,
      runtimeLogger: assembly.runtimeLogger,
      dataDir,
      mission: input,
    });
  },
  async getAmazonTaxInvoiceDownloadTaskStatus(taskId: string) {
    return getAmazonTaxInvoiceDownloadTaskStatusFromPlugin({ dataDir, taskId });
  },
  async getLatestAmazonTaxInvoiceDownloadTask(input?: { marketplace?: string; requestId?: string }) {
    return getLatestAmazonTaxInvoiceDownloadTaskFromPlugin({ dataDir, ...(input ?? {}) });
  },
  async getAmazonTaxInvoiceDownloadArtifact(taskId: string) {
    return getAmazonTaxInvoiceDownloadArtifactFromPlugin({ dataDir, taskId });
  },
});

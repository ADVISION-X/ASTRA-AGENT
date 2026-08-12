import {
  getAmazonInvoiceUploadTaskStatus,
  getAmazonTaxInvoiceDownloadArtifact as getAmazonTaxInvoiceDownloadArtifactFromPlugin,
  getAmazonTaxInvoiceDownloadTaskStatus as getAmazonTaxInvoiceDownloadTaskStatusFromPlugin,
  getLatestAmazonInvoiceUploadTaskForInvoice,
  getLatestAmazonTaxInvoiceDownloadTask as getLatestAmazonTaxInvoiceDownloadTaskFromPlugin,
  listAmazonInvoiceUploadLedger,
  startAmazonInvoiceAdminOpenTask,
} from "../../plugins/amazon-invoice-upload/index.js";
import {
  runAmazonInvoiceAdminOpenRoute,
  runAmazonInvoiceUploadMissionRoute,
  runAmazonInvoiceUploadResumeRoute,
  runAmazonInvoiceUploadTaskRoute,
  runAmazonTaxInvoiceDownloadRoute,
} from "../../mediator/amazon-invoice-upload-route.js";
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
  async openAdminInvoicePage(input: Parameters<typeof startAmazonInvoiceAdminOpenTask>[1]) {
    return runAmazonInvoiceAdminOpenRoute(input, assembly.browserController);
  },
  async startAmazonInvoiceUploadMission(input: Parameters<typeof runAmazonInvoiceUploadMissionRoute>[0]) {
    return runAmazonInvoiceUploadMissionRoute(input, [
      assembly.browserController,
      assembly.runtimeLogger,
      assembly.evidenceStore,
    ]);
  },
});

const buildAmazonInvoiceTaskHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  async startAmazonInvoiceUploadTask(input: Parameters<typeof runAmazonInvoiceUploadTaskRoute>[0]) {
    return runAmazonInvoiceUploadTaskRoute(input, {
      browser: assembly.browserController,
      runtimeLogger: assembly.runtimeLogger,
      evidenceStore: assembly.evidenceStore,
      dataDir,
    });
  },
  async resumeAmazonInvoiceUploadTask(input: { taskId: string }) {
    return runAmazonInvoiceUploadResumeRoute(input, {
      browser: assembly.browserController,
      runtimeLogger: assembly.runtimeLogger,
      evidenceStore: assembly.evidenceStore,
      dataDir,
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
  async startAmazonTaxInvoiceDownloadTask(input: Parameters<typeof runAmazonTaxInvoiceDownloadRoute>[0]) {
    return runAmazonTaxInvoiceDownloadRoute(input, {
      browser: assembly.browserController,
      runtimeLogger: assembly.runtimeLogger,
      dataDir,
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

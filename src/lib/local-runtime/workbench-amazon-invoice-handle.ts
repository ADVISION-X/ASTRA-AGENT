import {
  getAmazonInvoiceUploadTaskStatus,
  getAmazonTaxInvoiceDownloadArtifact as getAmazonTaxInvoiceDownloadArtifactFromPlugin,
  getAmazonTaxInvoiceDownloadTaskStatus as getAmazonTaxInvoiceDownloadTaskStatusFromPlugin,
  getLatestAmazonInvoiceUploadTaskForInvoice,
  getLatestAmazonTaxInvoiceDownloadTask as getLatestAmazonTaxInvoiceDownloadTaskFromPlugin,
  listAmazonInvoiceUploadLedger,
  readAmazonInvoiceUploadIntervention,
  startAmazonInvoiceAdminOpenTask,
} from "../../plugins/amazon-invoice-upload/index.js";
import {
  runCancelAmazonInvoiceUploadRoute,
  runAmazonInvoiceAdminOpenRoute,
  runAmazonInvoiceUploadMissionRoute,
  runAmazonInvoiceUploadResumeRoute,
  runAmazonInvoiceUploadTaskRoute,
  runAmazonTaxInvoiceDownloadRoute,
  runPauseAmazonInvoiceUploadRoute,
  runResumeAmazonInvoiceUploadInterventionRoute,
  runTakeoverAmazonInvoiceUploadRoute,
} from "../../mediator/amazon-invoice-upload-route.js";
import type { WorkbenchAssembly } from "./workbench-assembly.js";

export const buildAmazonInvoiceHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  ...buildAmazonInvoiceMissionHandle(assembly),
  ...buildAmazonInvoiceTaskHandle(assembly, dataDir),
  ...buildAmazonInvoiceInterventionHandle(dataDir),
  ...buildAmazonInvoiceDownloadHandle(assembly, dataDir),
});

const buildAmazonInvoiceMissionHandle = (assembly: WorkbenchAssembly) => ({
  async openAdminInvoicePage(input: Parameters<typeof startAmazonInvoiceAdminOpenTask>[1]) {
    return runAmazonInvoiceAdminOpenRoute(input, await assembly.browserAuthority.acquireTargetLease("amazon-invoice-upload"));
  },
  async startAmazonInvoiceUploadMission(input: Parameters<typeof runAmazonInvoiceUploadMissionRoute>[0]) {
    return runAmazonInvoiceUploadMissionRoute(input, [
      await assembly.browserAuthority.acquireTargetLease("amazon-invoice-upload"),
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
      browser: await assembly.browserAuthority.acquireTargetLease("amazon-invoice-upload"),
      runtimeLogger: assembly.runtimeLogger,
      evidenceStore: assembly.evidenceStore,
      dataDir,
    });
  },
  async resumeAmazonInvoiceUploadTask(input: { taskId: string }) {
    return runAmazonInvoiceUploadResumeRoute(input, {
      browser: await assembly.browserAuthority.acquireTargetLease("amazon-invoice-upload"),
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

const buildAmazonInvoiceInterventionHandle = (dataDir: string) => ({
  async readAmazonInvoiceUploadIntervention(taskId: string) {
    return readAmazonInvoiceUploadIntervention(dataDir, taskId);
  },
  async pauseAmazonInvoiceUpload(input: Parameters<typeof runPauseAmazonInvoiceUploadRoute>[0]) {
    return runPauseAmazonInvoiceUploadRoute(input, dataDir);
  },
  async cancelAmazonInvoiceUpload(input: Parameters<typeof runCancelAmazonInvoiceUploadRoute>[0]) {
    return runCancelAmazonInvoiceUploadRoute(input, dataDir);
  },
  async takeoverAmazonInvoiceUpload(input: Parameters<typeof runTakeoverAmazonInvoiceUploadRoute>[0]) {
    return runTakeoverAmazonInvoiceUploadRoute(input, dataDir);
  },
  async resumeAmazonInvoiceUpload(input: Parameters<typeof runResumeAmazonInvoiceUploadInterventionRoute>[0]) {
    return runResumeAmazonInvoiceUploadInterventionRoute(input, dataDir);
  },
});

const buildAmazonInvoiceDownloadHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  async startAmazonTaxInvoiceDownloadTask(input: Parameters<typeof runAmazonTaxInvoiceDownloadRoute>[0]) {
    return runAmazonTaxInvoiceDownloadRoute(input, {
      browser: await assembly.browserAuthority.acquireTargetLease("amazon-invoice-upload"),
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

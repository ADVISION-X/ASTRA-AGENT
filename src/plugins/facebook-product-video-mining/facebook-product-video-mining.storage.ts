import type {
  FacebookProductVideoMiningContracts,
} from "./facebook-product-video-mining.schema.js";
import { createFacebookMiningCandidateStore } from "./facebook-product-video-mining.storage-candidates.js";
import { createFacebookMiningSelectionExportStore } from "./facebook-product-video-mining.selection-export.js";
import {
  createFacebookMiningRunCounterUpdater,
  createFacebookMiningRunStore,
} from "./facebook-product-video-mining.storage-runs.js";
import {
  createFacebookMiningDatabase,
  resolveFacebookMiningDbPath,
} from "./facebook-product-video-mining.storage-support.js";

type FacebookCommentRecord = FacebookProductVideoMiningContracts["FacebookCommentRecord"];
type FacebookProductVideoCandidateRecord = FacebookProductVideoMiningContracts["FacebookProductVideoCandidateRecord"];
type FacebookProductVideoMiningRunConfig = FacebookProductVideoMiningContracts["FacebookProductVideoMiningRunConfig"];
type FacebookProductVideoMiningRunStatus = FacebookProductVideoMiningContracts["FacebookProductVideoMiningRunStatus"];
type FacebookVideoAiJudgment = FacebookProductVideoMiningContracts["FacebookVideoAiJudgment"];
type FacebookProductVideoMiningSelectionExport = FacebookProductVideoMiningContracts["FacebookProductVideoMiningSelectionExport"];
type FacebookProductVideoMiningSelectionExportItem = FacebookProductVideoMiningContracts["FacebookProductVideoMiningSelectionExportItem"];

export type FacebookProductVideoMiningStorage = {
  dbPath: string;
  createRun(run: FacebookProductVideoMiningRunConfig): FacebookProductVideoMiningRunStatus;
  updateRunProgress(input: {
    runId: string;
    status: FacebookProductVideoMiningRunStatus["status"];
    failureReason?: string | null;
    endedAt?: string | null;
    currentRoundId?: string | null;
    currentRoundIndex?: number | null;
  }): FacebookProductVideoMiningRunStatus;
  saveCandidate(input: {
    candidate: FacebookProductVideoCandidateRecord;
    rawDomProbeJson?: string | null;
  }): FacebookProductVideoCandidateRecord;
  saveComments(candidateId: string, comments: readonly FacebookCommentRecord[]): void;
  saveAiJudgment(input: {
    id: string;
    candidateId: string;
    promptContractId: string;
    judgment: FacebookVideoAiJudgment;
  }): void;
  getRunStatus(runId: string): FacebookProductVideoMiningRunStatus | null;
  getLatestRun(): FacebookProductVideoMiningRunStatus | null;
  listCandidates(runId: string): FacebookProductVideoCandidateRecord[];
  listSavedSelectionRecords(runId: string): FacebookProductVideoMiningSelectionExportItem[];
  buildSelectionExport(run: FacebookProductVideoMiningRunStatus): FacebookProductVideoMiningSelectionExport;
  close(): void;
};

export const createFacebookProductVideoMiningStorage = (
  dataDir: string,
): FacebookProductVideoMiningStorage => {
  const db = createFacebookMiningDatabase(dataDir);
  const updateRunCounters = createFacebookMiningRunCounterUpdater(db);
  const runStore = createFacebookMiningRunStore({ db, updateRunCounters });
  const candidateStore = createFacebookMiningCandidateStore({ db, updateRunCounters });
  const selectionExportStore = createFacebookMiningSelectionExportStore(db);

  return {
    dbPath: resolveFacebookMiningDbPath(dataDir),
    ...runStore,
    ...candidateStore,
    ...selectionExportStore,
    close() {
      db.close();
    },
  };
};

import {
  runDeepResearchAnalysis,
  type DeepResearchAnalysisContext,
} from "./deep-research-analysis.flow.js";
import {
  type DeepResearchInput,
} from "./deep-research-analysis.schema.js";
import {
  getDeepResearchAnalysisJob,
  getDeepResearchAnalysisReport,
  getDeepResearchAnalysisTimeline,
  getDeepResearchExportArtifact,
  getLatestDeepResearchAnalysisJob,
  listDeepResearchAnalysisHistory,
  deleteDeepResearchAnalysisJob,
} from "./deep-research-analysis.public-queries.js";
export type {
  DeepResearchHistorySnapshot,
  DeepResearchJobSnapshot,
  DeepResearchReportViewModel,
  DeepResearchTimelineSnapshot,
} from "./deep-research-analysis.public-contracts.js";
export type { DeepResearchExportArtifactPayload } from "./deep-research-analysis.public-queries.js";

export const deepResearchAnalysisPublicFacade = {
  runDeepResearchAnalysis,
  getDeepResearchAnalysisJob,
  listDeepResearchAnalysisHistory,
  getDeepResearchAnalysisReport,
  getLatestDeepResearchAnalysisJob,
  getDeepResearchAnalysisTimeline,
  getDeepResearchExportArtifact,
  deleteDeepResearchAnalysisJob,
} as const;
export type DeepResearchAnalysisStartInput = DeepResearchInput & {
  providerKind: DeepResearchAnalysisContext["providerKind"];
};

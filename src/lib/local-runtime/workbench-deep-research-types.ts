import type { DeepResearchJobSnapshot } from "../../plugins/deep-research-analysis/deep-research-analysis.public.js";

export type DeepResearchExecutionState = {
  status: DeepResearchJobSnapshot["job"]["status"];
  phase: DeepResearchJobSnapshot["job"]["phase"];
  failureReason: string | null;
  reviewReason: string | null;
};

export type DeepResearchExecutionJobLike = {
  id: string;
  status: DeepResearchJobSnapshot["job"]["status"];
  phase: DeepResearchJobSnapshot["job"]["phase"];
  failureReason?: string | null;
  reviewReason?: string | null;
};

export type DeepResearchExecutionSnapshotLike = {
  job: DeepResearchExecutionJobLike;
  overview?: { currentPhase: DeepResearchJobSnapshot["overview"]["currentPhase"] };
};

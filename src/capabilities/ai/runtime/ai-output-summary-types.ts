import type {
  AiCommentSignalSummaryOutput,
  AiOcrCleanupOutput,
  AiPagePreparationOutput,
  AiVisualOutput,
  AiVisualTargetCandidateOutput,
  CommentSignalSummaryInput,
  OcrCleanupInput,
  PagePreparationJudgmentInput,
  ProductPresenceJudgmentInput,
} from "../contract.js";
import type {
  VisualMissionActionPlanRequestInput,
  VisualMissionActionPlanOutput,
} from "../../../types/visual-mission-action-plan.js";

export type AiOutputSummaryBase = {
  aiResultRef: string;
  rawAiResultRef: string;
  aiProofRef: string;
  promptContractId: string;
  promptContractVersion: string;
  promptCatalogVersion: string;
  outputSchemaRef: string;
  aiInputArtifactRef: string | null;
  aiInputHash: string;
  outputPayloadHash: string;
  capturedAt: string;
  missionId: string | null;
  runId: string | null;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  confidence: number;
  modelRole: string;
  modelProvider: string;
  modelName: string;
};

export type AiVisualTargetCandidateOutputSummary = AiOutputSummaryBase & {
  taskType: "visual_target_candidate_analysis";
  targetCandidates: AiVisualTargetCandidateOutput["targetCandidates"];
};

export type AiPagePreparationOutputSummary = AiOutputSummaryBase & {
  taskType: "page_preparation_judgment";
  input: PagePreparationJudgmentInput["input"];
  output: AiPagePreparationOutput;
};

export type AiOcrCleanupOutputSummary = AiOutputSummaryBase & {
  taskType: "ocr_cleanup";
  input: OcrCleanupInput["input"];
  output: AiOcrCleanupOutput;
};

export type AiProductPresenceOutputSummary = AiOutputSummaryBase & {
  taskType: "product_presence_judgment";
  input: ProductPresenceJudgmentInput["input"];
  output: AiVisualOutput;
};

export type AiVisualMissionActionPlanOutputSummary = AiOutputSummaryBase & {
  taskType: "visual_mission_action_plan";
  input: VisualMissionActionPlanRequestInput;
  output: VisualMissionActionPlanOutput;
};

export type AiCommentSignalOutputSummary = AiOutputSummaryBase & {
  taskType: "comment_signal_summary";
  input: CommentSignalSummaryInput["input"];
  output: AiCommentSignalSummaryOutput;
};

export type RecordedAiOutputSummary =
  | AiVisualTargetCandidateOutputSummary
  | AiPagePreparationOutputSummary
  | AiOcrCleanupOutputSummary
  | AiProductPresenceOutputSummary
  | AiVisualMissionActionPlanOutputSummary
  | AiCommentSignalOutputSummary;
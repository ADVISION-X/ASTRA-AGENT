import {
  AgentRoundSchema as ExternalAgentRoundSchema,
  TaskRunSchema as ExternalTaskRunSchema,
  type AgentRound as ExternalAgentRound,
  type ReviewDisposition as ExternalReviewDisposition,
  type RuntimeStatus as ExternalRuntimeStatus,
  type TaskRun as ExternalTaskRun,
} from "../../../types/task-run.js";

const AgentRoundSchema = ExternalAgentRoundSchema;
const TaskRunSchema = ExternalTaskRunSchema;

type AgentRound = ExternalAgentRound;
type ReviewDisposition = ExternalReviewDisposition;
type RuntimeStatus = ExternalRuntimeStatus;
type TaskRun = ExternalTaskRun;

export {
  AgentRoundSchema,
  TaskRunSchema,
};

export type {
  AgentRound,
  ReviewDisposition,
  RuntimeStatus,
  TaskRun,
};
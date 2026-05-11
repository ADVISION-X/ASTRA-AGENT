// Public API for the Local AI module.
// Local AI = AI Ability Group's internal local model call boundary.
// Responsibilities: receive prompt, call local model, return raw text.
// Not responsible for: prompt building, JSON extraction, schema validation,
// action planning, provider routing, task handlers, or forensics write.

export { callLocalModel } from "./call-local-model.js";
export { checkLocalAiReadiness } from "./readiness.js";
export { loadLocalAiConfig } from "./config.js";
export type {
  LocalAiConfig,
  LocalModelCallInput,
  LocalModelCallResult,
  LocalAiReadinessResult,
} from "./contract.js";

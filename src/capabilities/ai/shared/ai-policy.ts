import type { z } from "zod";

import {
  AI_CHILD_CAPABILITY_IDS,
  AI_COST_POLICY_DECISIONS,
  AI_DATA_POLICY_DECISIONS,
  AI_DISABLED_PROVIDER_DECISIONS,
  AI_OUTPUT_BOUNDARY_DECISIONS,
  AI_PROVIDER_POLICY_DECISIONS,
  AI_QUALITY_DECISIONS,
  AI_SAFETY_POLICY_DECISIONS,
  AI_SCHEMA_DECISIONS,
} from "./ai-types.js";

const AI_FORBIDDEN_ACTION_TERMS = [
  "click",
  "scroll",
  "open",
  "mousemove",
  "mouse click",
  "screenshot",
  "page state",
  "geometry",
  "forensics",
  "press key",
  "type text",
  "paste",
  "hover",
  "drag",
  "navigate",
  "open url",
  "open page",
  "dispatch envelope",
  "nerve bus",
  "persist evidence",
  "platform action",
];

const DEFAULT_AI_PROVIDER_POLICY = {
  requireLocalOnly: true,
  allowPaidProvider: false,
  providerAllowlist: ["local-vision-ai", "local-text-ai", "local-ocr-ai", "internal-schema-validator"] as const,
  operatorApprovalRef: null,
  providerConfigRef: null,
  secretRef: null,
};

const DEFAULT_AI_COST_POLICY = {
  maxEstimatedCost: 0,
};

const DEFAULT_AI_DATA_POLICY = {
  allowExternalTransmission: false,
  redactSensitiveData: true,
};

const DEFAULT_AI_QUALITY_POLICY = {
  minimumConfidence: 0.6,
  requireSchemaValidation: true,
};

const DEFAULT_AI_SAFETY_POLICY = {
  reviewOnLowConfidence: true,
  reviewOnSchemaFailure: true,
  reviewOnPolicyViolation: true,
};

type AiProviderPolicyDecision = (typeof AI_PROVIDER_POLICY_DECISIONS)[number];
type AiDataPolicyDecision = (typeof AI_DATA_POLICY_DECISIONS)[number];
type AiCostPolicyDecision = (typeof AI_COST_POLICY_DECISIONS)[number];
type AiSafetyPolicyDecision = (typeof AI_SAFETY_POLICY_DECISIONS)[number];
type AiSchemaDecision = (typeof AI_SCHEMA_DECISIONS)[number];
type AiQualityDecision = (typeof AI_QUALITY_DECISIONS)[number];
type AiOutputBoundaryDecision = (typeof AI_OUTPUT_BOUNDARY_DECISIONS)[number];
type AiDisabledProviderDecision = (typeof AI_DISABLED_PROVIDER_DECISIONS)[number];

function isKnownAiChildCapabilityId(value: string): value is (typeof AI_CHILD_CAPABILITY_IDS)[number] {
  return AI_CHILD_CAPABILITY_IDS.includes(value as (typeof AI_CHILD_CAPABILITY_IDS)[number]);
}

function collectStringTerms(matches: Set<string>, value: string) {
  const lower = value.toLowerCase();
  for (const term of AI_FORBIDDEN_ACTION_TERMS) {
    if (lower.includes(term)) {
      matches.add(term);
    }
  }
}

function collectObjectTerms(matches: Set<string>, value: object) {
  for (const [key, nested] of Object.entries(value)) {
    collectStringTerms(matches, key);
    visitForbiddenActionTerms(matches, nested);
  }
}

function visitForbiddenActionTerms(matches: Set<string>, current: unknown) {
  if (typeof current === "string") {
    collectStringTerms(matches, current);
    return;
  }

  if (Array.isArray(current)) {
    for (const item of current) {
      visitForbiddenActionTerms(matches, item);
    }
    return;
  }

  if (current && typeof current === "object") {
    collectObjectTerms(matches, current);
  }
}

function collectForbiddenActionTerms(value: unknown): string[] {
  const matches = new Set<string>();
  visitForbiddenActionTerms(matches, value);
  return [...matches];
}

export {
  AI_FORBIDDEN_ACTION_TERMS,
  DEFAULT_AI_PROVIDER_POLICY,
  DEFAULT_AI_COST_POLICY,
  DEFAULT_AI_DATA_POLICY,
  DEFAULT_AI_QUALITY_POLICY,
  DEFAULT_AI_SAFETY_POLICY,
  isKnownAiChildCapabilityId,
  collectForbiddenActionTerms,
};

export type {
  AiProviderPolicyDecision,
  AiDataPolicyDecision,
  AiCostPolicyDecision,
  AiSafetyPolicyDecision,
  AiSchemaDecision,
  AiQualityDecision,
  AiOutputBoundaryDecision,
  AiDisabledProviderDecision,
};

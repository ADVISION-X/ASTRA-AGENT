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

export const AI_FORBIDDEN_ACTION_TERMS = [
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
  "platform action",
];

export const DEFAULT_AI_PROVIDER_POLICY = {
  requireLocalOnly: true,
  allowPaidProvider: false,
  providerAllowlist: ["local-vision-ai", "local-text-ai", "local-ocr-ai", "internal-schema-validator"] as const,
  operatorApprovalRef: null,
};

export const DEFAULT_AI_COST_POLICY = {
  maxEstimatedCost: 0,
};

export const DEFAULT_AI_DATA_POLICY = {
  allowExternalTransmission: false,
  redactSensitiveData: true,
};

export const DEFAULT_AI_QUALITY_POLICY = {
  minimumConfidence: 0.6,
  requireSchemaValidation: true,
};

export const DEFAULT_AI_SAFETY_POLICY = {
  reviewOnLowConfidence: true,
  reviewOnSchemaFailure: true,
  reviewOnPolicyViolation: true,
};

export type AiProviderPolicyDecision = (typeof AI_PROVIDER_POLICY_DECISIONS)[number];
export type AiDataPolicyDecision = (typeof AI_DATA_POLICY_DECISIONS)[number];
export type AiCostPolicyDecision = (typeof AI_COST_POLICY_DECISIONS)[number];
export type AiSafetyPolicyDecision = (typeof AI_SAFETY_POLICY_DECISIONS)[number];
export type AiSchemaDecision = (typeof AI_SCHEMA_DECISIONS)[number];
export type AiQualityDecision = (typeof AI_QUALITY_DECISIONS)[number];
export type AiOutputBoundaryDecision = (typeof AI_OUTPUT_BOUNDARY_DECISIONS)[number];
export type AiDisabledProviderDecision = (typeof AI_DISABLED_PROVIDER_DECISIONS)[number];

export function isKnownAiChildCapabilityId(value: string): value is (typeof AI_CHILD_CAPABILITY_IDS)[number] {
  return AI_CHILD_CAPABILITY_IDS.includes(value as (typeof AI_CHILD_CAPABILITY_IDS)[number]);
}

export function collectForbiddenActionTerms(value: unknown): string[] {
  const matches = new Set<string>();

  const visit = (current: unknown) => {
    if (typeof current === "string") {
      const lower = current.toLowerCase();
      for (const term of AI_FORBIDDEN_ACTION_TERMS) {
        if (lower.includes(term)) {
          matches.add(term);
        }
      }
      return;
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item);
      }
      return;
    }

    if (current && typeof current === "object") {
      for (const [key, nested] of Object.entries(current)) {
        const lowerKey = key.toLowerCase();
        for (const term of AI_FORBIDDEN_ACTION_TERMS) {
          if (lowerKey.includes(term)) {
            matches.add(term);
          }
        }
        visit(nested);
      }
    }
  };

  visit(value);
  return [...matches];
}

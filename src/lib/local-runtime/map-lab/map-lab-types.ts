import type { z } from "zod";

import type { MapPackage } from "../../../map-plugins/shared/map-package-types.js";
import { MapAuthoringRequestSchema } from "../../../map-plugins/authoring/map-authoring-request.schema.js";

export type MapLabProviderConfigInput = {
  displayName?: string | null;
  providerKind?: string | null;
  providerCompany?: "openai" | "deepseek" | "openrouter" | null;
  baseUrl: string;
  model: string;
  apiKey: string;
  allowPaidProvider?: boolean;
  providerAllowlist?: string[];
  dataPolicy?: { allowExternalTransmission?: boolean };
  costPolicy?: { maxEstimatedCost?: number };
  operatorApprovalRef?: string | null;
  approvalReason?: string | null;
};

export type MapLabProviderState = {
  providerId: string;
  displayName: string | null;
  providerKind: string | null;
  providerCompany: "openai" | "deepseek" | "openrouter" | null;
  configured: boolean;
  enabled: boolean;
  configRef: string | null;
  secretRef: string | null;
  hasSecret: boolean;
  secretLast4: string | null;
  model: string | null;
  allowPaidProvider: boolean;
  allowExternalTransmission: boolean;
  maxEstimatedCost: number | null;
  operatorApprovalRef: string | null;
  missingReason: string | null;
  updatedAt: string | null;
};

export type MapLabAuthoringRequest = z.output<typeof MapAuthoringRequestSchema>;

export type MapLabGenerateDraftResult = {
  status: "success" | "failed" | "review_required" | "dry_run_captured";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  dryRunCaptured?: boolean;
  wouldSendToProvider?: boolean;
  externalHttpSent?: boolean;
  realAiCalled?: boolean;
  packageId: string | null;
  packageVersion: string | null;
  mapPackage: MapPackage | null;
  humanReadableExplanation: string | null;
  requiredClarifications: string[];
  riskWarnings: string[];
  validationHints: string[];
  validationIssues: string[];
  needsCapabilityExpansion: boolean;
  draftStatus: "draft_ready" | "needs_clarification" | null;
};

export type MapLabAutomationGateResult = {
  status: "success" | "failed";
  reason: string | null;
  packageId: string | null;
  packageVersion: string | null;
};

export type MapLabActivationResult = {
  status: "success" | "failed";
  reason: string | null;
  packageId: string | null;
  packageVersion: string | null;
  activationId: string | null;
};

export type MapLabSnapshot = {
  provider: MapLabProviderState;
  developerCatalog: Array<{
    packageId: string;
    packageVersion: string;
    mapId: string;
    title: string;
    lifecycleStatus: string;
    activationGateStatus: string;
    summary: string;
    chain: string[];
    validationIssues: Array<{ code: string; message: string; path?: string; severity: string }>;
    activationId: string | null;
    draftOnly: boolean;
  }>;
};

import { z } from "zod";

import { MapDependenciesSchema } from "../schema/map-dependencies.schema.js";
import {
  MapPluginOperationalMapStepSchema,
  MapPluginTransitionSchema,
} from "../schema/operational-map-core.schema.js";
import { MapPluginMissionTerminalStatusSchema } from "../schema/operational-map-payload.schema.js";
import { PromptBindingsSchema } from "../schema/prompt-bindings.schema.js";
import { MapAuthoringChainSchema } from "./map-authoring-proof-chain.js";

export const MapAuthoringDraftPackageSchema = z.object({
  displayName: z.string().min(1),
  description: z.string().min(1),
  taskCategory: z.string().min(1),
  defaultHumanGoal: z.string().min(1),
  recommended: z.boolean().default(false),
  safetyLevel: z.string().min(1),
  userVisibleCapabilities: z.array(z.string().min(1)).min(1),
  humanGoal: z.string().min(1),
  initialStepId: z.string().min(1),
  steps: z.array(MapPluginOperationalMapStepSchema).min(1),
  transitions: z.array(MapPluginTransitionSchema).min(1),
  finalStates: z.array(MapPluginMissionTerminalStatusSchema).min(1),
  forbiddenDirectCalls: z.array(z.string().min(1)).default(["PlatformAdapter", "EvidenceStoreService", "direct-ability-call"]),
  dependencies: MapDependenciesSchema,
  promptBindings: PromptBindingsSchema,
}).strict();

export const MapAuthoringAiOutputSchema = z.object({
  draftPackage: MapAuthoringDraftPackageSchema,
  humanReadableExplanation: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.75),
  requiredClarifications: z.array(z.string().min(1)).default([]),
  riskWarnings: z.array(z.string().min(1)).default([]),
  validationHints: z.array(z.string().min(1)).default([]),
  needsCapabilityExpansion: z.boolean().default(false),
  draftStatus: z.enum(["draft_ready", "needs_clarification"]).default("draft_ready"),
  authoringChain: MapAuthoringChainSchema.partial().default({}),
}).strict();

export type MapAuthoringDraftPackage = z.output<typeof MapAuthoringDraftPackageSchema>;
export type MapAuthoringAiOutput = z.output<typeof MapAuthoringAiOutputSchema>;

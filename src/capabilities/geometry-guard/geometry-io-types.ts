import type { z } from "zod";

import { GeometryGuardAbilityInputSchema } from "./schema-input.js";
import {
  GeometryGuardAbilityResultSchema,
  GeometryGuardOutputSchema,
  GeometryGuardRuntimeProofSchema,
} from "./schema-output.js";

export type GeometryGuardOutput = z.output<typeof GeometryGuardOutputSchema>;
export type GeometryGuardRuntimeProof = z.output<
  typeof GeometryGuardRuntimeProofSchema
>;
export type GeometryGuardAbilityInput = z.input<
  typeof GeometryGuardAbilityInputSchema
>;
export type ParsedGeometryGuardAbilityInput = z.output<
  typeof GeometryGuardAbilityInputSchema
>;
export type GeometryGuardAbilityResult = z.output<
  typeof GeometryGuardAbilityResultSchema
>;


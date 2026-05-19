import type { z } from "zod";

import {
  GeometryGuardBoundingBoxSchema,
  GeometryGuardChildCapabilityIdSchema,
  GeometryGuardPointSchema,
  GeometryGuardSafetyPolicySchema,
  GeometryGuardSizeSchema,
} from "./schema-primitives.js";

export type GeometryGuardChildCapabilityId = z.output<
  typeof GeometryGuardChildCapabilityIdSchema
>;
export type GeometryGuardPoint = z.output<typeof GeometryGuardPointSchema>;
export type GeometryGuardBoundingBox = z.output<
  typeof GeometryGuardBoundingBoxSchema
>;
export type GeometryGuardSize = z.output<typeof GeometryGuardSizeSchema>;
export type GeometryGuardSafetyPolicy = z.output<
  typeof GeometryGuardSafetyPolicySchema
>;

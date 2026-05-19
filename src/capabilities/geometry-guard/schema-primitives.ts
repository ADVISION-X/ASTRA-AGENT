import { z } from "zod";

import { GEOMETRY_GUARD_CHILD_CAPABILITY_IDS } from "./schema-constants.js";

const finiteNumber = z.number().finite();
const positiveFiniteNumber = z.number().finite().positive();

export const GeometryGuardPointSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
});

export const GeometryGuardBoundingBoxSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  width: positiveFiniteNumber,
  height: positiveFiniteNumber,
});

export const GeometryGuardSizeSchema = z.object({
  width: positiveFiniteNumber,
  height: positiveFiniteNumber,
});

export const GeometryGuardChildCapabilityIdSchema = z.enum(
  GEOMETRY_GUARD_CHILD_CAPABILITY_IDS,
);

export const GeometryGuardSafetyPolicySchema = z.object({
  minDistanceFromViewportEdge: z
    .number()
    .finite()
    .nonnegative()
    .optional()
    .default(4),
  maxBboxAreaRatio: z.number().min(0).max(1).optional().default(1),
  allowOffscreen: z.literal(false).optional().default(false),
  allowZeroSize: z.literal(false).optional().default(false),
});


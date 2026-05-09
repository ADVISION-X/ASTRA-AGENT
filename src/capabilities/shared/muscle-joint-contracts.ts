import { z } from "zod";

const ResultRefSchema = z.string().min(1);
const NullableResultRefSchema = ResultRefSchema.nullable().default(null);
const JointPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
}).strict();
const JointBboxSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
}).strict();
const DataQualityFlagsSchema = z.array(z.string().min(1)).max(30).default([]);

const VisualTargetGeometryGuardHandoffSchema = z.object({
  handoffRef: ResultRefSchema,
  sourceVisualTargetResultRef: ResultRefSchema,
  sourceTargetRef: ResultRefSchema,
  sourceScreenshotEvidenceRef: ResultRefSchema,
  sourceAiResultRef: NullableResultRefSchema,
  sourcePageStateProofRef: ResultRefSchema,
  bbox: JointBboxSchema,
  clickPoint: JointPointSchema,
  coordinateSpace: z.string().min(1),
  targetType: z.string().min(1),
  targetNature: z.string().min(1),
  confidence: z.number().min(0).max(1),
  dataQualityFlags: DataQualityFlagsSchema,
}).strict();

const GeometryGuardMouseClickHandoffSchema = z.object({
  childCapabilityId: z.string().min(1),
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: NullableResultRefSchema,
  geometryGuardRef: ResultRefSchema,
  geometryGuardInputRef: ResultRefSchema,
  geometryGuardProofRef: ResultRefSchema,
  geometryGuardOutputRef: ResultRefSchema,
  geometryGuardRuntimeProofRef: ResultRefSchema,
  sourceRef: NullableResultRefSchema,
  sourceVisualTargetResultRef: NullableResultRefSchema,
  sourceTargetRef: ResultRefSchema,
  sourceScreenshotEvidenceRef: NullableResultRefSchema,
  sourceAiResultRef: NullableResultRefSchema,
  sourcePageStateProofRef: NullableResultRefSchema,
  normalizedCoordinateSpace: z.string().min(1),
  normalizedClickPoint: JointPointSchema,
  normalizedBbox: JointBboxSchema,
  guardDecision: z.literal("allow"),
}).strict();

const MouseClickPostVerificationHandoffSchema = z.object({
  clickResultRef: ResultRefSchema,
  postActionVerificationHandoffRef: ResultRefSchema,
  actionExecutionRef: ResultRefSchema,
  primitiveExecutionRef: ResultRefSchema,
  actionStartedAt: z.string().min(1),
  actionEndedAt: z.string().min(1),
  sourceActionRuntimeProofRef: ResultRefSchema,
  sourceActionAbilityGroupId: z.string().min(1),
  sourceActionChildCapabilityId: z.string().min(1),
  geometryGuardRef: ResultRefSchema,
  geometryGuardProofRef: ResultRefSchema,
  sourceCoordinateProofRef: ResultRefSchema,
  sourceTargetRef: ResultRefSchema,
  sourceVisualTargetResultRef: NullableResultRefSchema,
  normalizedClickPoint: JointPointSchema,
  coordinateSpace: z.string().min(1),
  button: z.string().min(1),
  clickCount: z.number().int().positive(),
}).strict();

type AiCandidateResultRef = z.output<typeof ResultRefSchema>;
type VisualTargetResultRef = z.output<typeof ResultRefSchema>;
type GeometryGuardResultRef = z.output<typeof ResultRefSchema>;
type MouseClickResultRef = z.output<typeof ResultRefSchema>;
type PostActionVerificationResultRef = z.output<typeof ResultRefSchema>;
type VisualTargetGeometryGuardHandoff = z.output<typeof VisualTargetGeometryGuardHandoffSchema>;
type GeometryGuardMouseClickHandoff = z.output<typeof GeometryGuardMouseClickHandoffSchema>;
type MouseClickPostVerificationHandoff = z.output<typeof MouseClickPostVerificationHandoffSchema>;

const parseVisualTargetGeometryGuardHandoff = (value: unknown): VisualTargetGeometryGuardHandoff =>
  VisualTargetGeometryGuardHandoffSchema.parse(value);

const parseGeometryGuardMouseClickHandoff = (value: unknown): GeometryGuardMouseClickHandoff =>
  GeometryGuardMouseClickHandoffSchema.parse(value);

const parseMouseClickPostVerificationHandoff = (value: unknown): MouseClickPostVerificationHandoff =>
  MouseClickPostVerificationHandoffSchema.parse(value);

export {
  DataQualityFlagsSchema,
  GeometryGuardMouseClickHandoffSchema,
  JointBboxSchema,
  JointPointSchema,
  MouseClickPostVerificationHandoffSchema,
  NullableResultRefSchema,
  ResultRefSchema,
  VisualTargetGeometryGuardHandoffSchema,
  parseGeometryGuardMouseClickHandoff,
  parseMouseClickPostVerificationHandoff,
  parseVisualTargetGeometryGuardHandoff,
};
export type {
  AiCandidateResultRef,
  GeometryGuardMouseClickHandoff,
  GeometryGuardResultRef,
  MouseClickPostVerificationHandoff,
  MouseClickResultRef,
  PostActionVerificationResultRef,
  VisualTargetGeometryGuardHandoff,
  VisualTargetResultRef,
};
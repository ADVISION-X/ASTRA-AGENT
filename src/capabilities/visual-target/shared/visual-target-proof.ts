export const VISUAL_TARGET_CLOCK_KIND = "system-monotonic-clock" as const;
export const VISUAL_TARGET_GEOMETRY_HANDOFF_POLICY = "geometry-guard-public-contract-only" as const;
export const VISUAL_TARGET_NON_EXECUTABLE_COORDINATE_POLICY = "not-executable-until-geometry-guard" as const;
export const VISUAL_TARGET_TRACE_FIELDS = [
	"candidateScoreTrace",
	"selectionTrace",
	"ambiguityTrace",
	"coordinateTransformTrace",
] as const;
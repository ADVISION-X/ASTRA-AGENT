import type {
  GeometryGuardAbilityContext,
  GeometryGuardAbilityResult,
  ParsedGeometryGuardAbilityInput,
} from "../contract.js";
import { evaluateBounds } from "./bounds-gate.js";
import { evaluateClickSafety } from "./click-safety-gate.js";
import { evaluateCoordinateSpace } from "./coordinate-space-gate.js";
import { buildGeometryGuardResult } from "./geometry-result-builder.js";
import { evaluateScaleMapping } from "./scale-mapping-gate.js";
import { transformGeometry } from "./geometry-transformer.js";

type GeometryClockReading = ReturnType<GeometryGuardAbilityContext["clock"]["now"]>;
type GeometryExecutionInput = {
  request: ParsedGeometryGuardAbilityInput;
  context: GeometryGuardAbilityContext;
  started: GeometryClockReading;
};
type GeometryStageFailure = {
  status: Parameters<typeof buildGeometryGuardResult>[0]["status"];
  guardDecision: Parameters<typeof buildGeometryGuardResult>[0]["guardDecision"];
  failureReason: Parameters<typeof buildGeometryGuardResult>[0]["failureReason"];
  reviewRequiredReason: Parameters<typeof buildGeometryGuardResult>[0]["reviewRequiredReason"];
  statusMessage: string;
  policyDecision: Parameters<typeof buildGeometryGuardResult>[0]["policyDecision"];
  boundsDecision: Parameters<typeof buildGeometryGuardResult>[0]["boundsDecision"];
  scaleDecision: Parameters<typeof buildGeometryGuardResult>[0]["scaleDecision"];
  transformDecision: Parameters<typeof buildGeometryGuardResult>[0]["transformDecision"];
  sourceBounds: Parameters<typeof buildGeometryGuardResult>[0]["sourceBounds"];
  targetBounds: Parameters<typeof buildGeometryGuardResult>[0]["targetBounds"];
  appliedScaleMapping: Parameters<typeof buildGeometryGuardResult>[0]["appliedScaleMapping"];
  dataQualityFlags: string[];
};
type GeometryValidationState = {
  coordinateGate: ReturnType<typeof evaluateCoordinateSpace>;
  boundsGate: ReturnType<typeof evaluateBounds>;
  scaleGate: ReturnType<typeof evaluateScaleMapping>;
  clickSafety: ReturnType<typeof evaluateClickSafety>;
};
type GeometryResolvedState = GeometryValidationState & {
  transform: ReturnType<typeof transformGeometry>;
};
type GeometryStageResult<TState> =
  | { ok: true; state: TState }
  | { ok: false; result: GeometryGuardAbilityResult };

export type {
  GeometryClockReading,
  GeometryExecutionInput,
  GeometryResolvedState,
  GeometryStageFailure,
  GeometryStageResult,
  GeometryValidationState,
};
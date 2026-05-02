import { Node, SyntaxKind } from "ts-morph";

import { geometryGuardInspectionCallQueries as callQueries } from "./inspection-call-queries.js";
import { geometryGuardInspectionConfig as config } from "./inspection-constants.js";
import { geometryGuardInspectionModuleQueries as moduleQueries } from "./inspection-module-queries.js";
import { geometryGuardInspectionSchemaQueries as schemaQueries } from "./inspection-schema-queries.js";
import type { GeometryPresenceState, GeometryRequiredShapeState, GeometrySourceState, PresenceEntry } from "./inspection-types.js";
import { geometryGuardInspectionUtils as support } from "./inspection-utils.js";
import { loadGeometryPresenceState } from "./presence-state.js";

export { loadGeometryPresenceState, type GeometryPresenceState };

const emptySet = (): Set<string> => new Set<string>();

const getSchemaPropertyNames = (sourceFile: GeometrySourceState["schemaSource"], schemaName: string): Set<string> => {
  return sourceFile ? schemaQueries.getZodObjectPropertyNames(sourceFile, schemaName) : emptySet();
};

const getStringSet = (sourceFile: GeometrySourceState["schemaSource"]): Set<string> => {
  return sourceFile ? support.getStringLiterals(sourceFile) : emptySet();
};

const getObjectLiteralPropertyNames = (sourceFile: GeometrySourceState["schemaSource"], declarationName: string): Set<string> => {
  const declaration = sourceFile?.getVariableDeclaration(declarationName);
  const initializer = declaration?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
  if (!initializer) {
    return emptySet();
  }

  return new Set(
    initializer.getProperties().flatMap((property) => {
      return Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)
        ? [property.getName()]
        : [];
    }),
  );
};

const hasEveryValue = (values: Set<string>, requiredValues: readonly string[]): boolean => {
  return requiredValues.every((value) => values.has(value));
};

const hasSchemaExportSurface = (state: GeometrySourceState): boolean => {
  if (!state.schemaSource) {
    return false;
  }

  const exported = state.schemaSource.getExportedDeclarations();
  return [
    "GeometryGuardAbilityInputSchema",
    "GeometryGuardSafetyPolicySchema",
    "GeometryGuardAbilityResultSchema",
    "GeometryGuardRuntimeProofSchema",
    "GeometryGuardChildCapabilityIdSchema",
    "GeometryGuardFailureReasonSchema",
  ].every((name) => exported.has(name));
};

const hasSchemaFieldCoverage = (state: GeometrySourceState): boolean => {
  return hasEveryValue(state.inputFields, config.REQUIRED_INPUT_FIELDS)
    && hasEveryValue(state.safetyPolicyFields, config.REQUIRED_SAFETY_POLICY_FIELDS)
    && hasEveryValue(state.resultFields, config.REQUIRED_RESULT_FIELDS)
    && hasEveryValue(state.runtimeProofFields, config.REQUIRED_RUNTIME_PROOF_FIELDS);
};

const hasSchemaLiteralCoverage = (state: GeometrySourceState): boolean => {
  return hasEveryValue(state.schemaStrings, config.REQUIRED_CHILDREN)
    && hasEveryValue(state.typeStrings, config.REQUIRED_CHILDREN)
    && hasEveryValue(state.typeStrings, config.REQUIRED_COORDINATE_SPACES)
    && hasEveryValue(state.typeStrings, config.REQUIRED_FAILURE_REASONS);
};

const hasSchemaSurface = (state: GeometrySourceState): boolean => {
  return Boolean(state.schemaSource)
    && Boolean(state.schemaFoundationSource)
    && Boolean(state.schemaInputSource)
    && Boolean(state.schemaResultSource)
    && Boolean(state.schemaRuntimeProofSource)
    && hasSchemaExportSurface(state)
    && hasSchemaFieldCoverage(state)
    && hasSchemaLiteralCoverage(state);
};

const hasContractSurface = (state: GeometrySourceState): boolean => {
  return state.contractSource !== null
    && schemaQueries.hasInterfaceMethod(state.contractSource, "GeometryGuardAbilityGroup", "execute")
    && schemaQueries.hasInterfaceMethod(state.contractSource, "GeometryGuardAbilityGroup", "listChildCapabilityIds")
    && schemaQueries.hasInterfaceMethod(state.contractSource, "GeometryGuardChildCapability", "execute")
    && !support.hasExportStar(state.contractSource);
};

const hasAbilityGroupSurface = (state: GeometrySourceState): boolean => {
  return state.abilityGroupSource !== null
    && callQueries.hasCallExpressionPath(state.abilityGroupSource, ["GeometryGuardAbilityInputSchema", "safeParse"])
    && callQueries.hasCallExpression(state.abilityGroupSource, "dispatchGeometryGuardFailure")
    && !support.hasThrowStatement(state.abilityGroupSource);
};

const hasRegistrySurface = (state: GeometrySourceState): boolean => {
  return Boolean(state.registrySource) && hasEveryValue(state.registryStrings, config.REQUIRED_CHILDREN);
};

const hasIndexSurface = (state: GeometrySourceState): boolean => {
  return state.indexSource !== null
    && !support.hasExportStar(state.indexSource)
    && !state.indexSource.getExportDeclarations().some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("/children/"));
};

const hasResultProofWiring = (state: GeometrySourceState): boolean => {
  return state.resultBuilderSource !== null
    && state.proofBuilderSource !== null
    && callQueries.hasCallExpression(state.resultBuilderSource, "buildGeometryRuntimeProof")
    && callQueries.hasCallExpressionPath(state.resultBuilderSource, ["GeometryGuardAbilityResultSchema", "parse"])
    && callQueries.hasCallExpressionPath(state.proofBuilderSource, ["GeometryGuardRuntimeProofSchema", "parse"]);
};

const getExecutorRouteSources = (state: GeometrySourceState) => {
  return [state.executorSource, state.executionPlanSource, state.inputStagesSource, state.transformStageSource].filter(
    (sourceFile): sourceFile is NonNullable<typeof sourceFile> => sourceFile !== null,
  );
};

const hasRouteCall = (state: GeometrySourceState, calleeName: string): boolean => {
  return getExecutorRouteSources(state).some((sourceFile) => callQueries.hasCallExpression(sourceFile, calleeName));
};

const hasExecutorEntry = (state: GeometrySourceState): boolean => {
  return state.executorSource !== null
    && callQueries.hasCallExpression(state.executorSource, "runGeometryExecutionPlan")
    && callQueries.hasCallExpression(state.executorSource, "dispatchGeometryGuardFailure");
};

const hasExecutorPolicyCalls = (state: GeometrySourceState): boolean => {
  return [
    "evaluateGeometryInputPolicy",
    "evaluateCoordinateSpace",
    "evaluateBounds",
    "evaluateScaleMapping",
    "evaluateClickSafety",
  ].every((calleeName) => hasRouteCall(state, calleeName));
};

const hasExecutorResultCalls = (state: GeometrySourceState): boolean => {
  return [
    "runGeometryInputStages",
    "runGeometryTransformStage",
    "buildGeometrySuccessResult",
    "transformGeometry",
    "buildGeometryGuardResult",
  ].every((calleeName) => hasRouteCall(state, calleeName));
};

const hasExecutorWiring = (state: GeometrySourceState): boolean => {
  return state.executorSource !== null
    && state.executionPlanSource !== null
    && state.inputStagesSource !== null
    && state.transformStageSource !== null
    && hasExecutorEntry(state)
    && hasExecutorPolicyCalls(state)
    && hasExecutorResultCalls(state);
};

const getCoordinateGateStrings = (state: GeometrySourceState): Set<string> => {
  return state.coordinateGateSource ? support.getStringLiterals(state.coordinateGateSource) : emptySet();
};

const hasCoordinateGateWiring = (state: GeometrySourceState): boolean => {
  return state.coordinateGateSource !== null
    && hasEveryValue(getCoordinateGateStrings(state), [
      "contactSheet",
      "contact_sheet_coordinate_not_executable",
      "device_scale_factor_missing",
    ]);
};

const hasDispatchFailureWiring = (state: GeometrySourceState): boolean => {
  return state.dispatchFailureSource !== null
    && state.dispatchFailureSource.getFullText().includes("normalizedCoordinateSpace: null")
    && state.dispatchFailureSource.getFullText().includes("normalizedClickPoint: null")
    && state.dispatchFailureSource.getFullText().includes("normalizedBbox: null")
    && state.dispatchFailureSource.getFullText().includes("appliedScaleMapping: null");
};

const getRuntimeWiring = (
  state: GeometrySourceState,
): Pick<GeometryRequiredShapeState, "childFactoryPassed" | "resultProofWiringPassed" | "executorWiringPassed" | "coordinateGatePassed" | "dispatchFailurePassed"> => {
  return {
    childFactoryPassed: state.childFactorySource !== null && callQueries.hasCallExpression(state.childFactorySource, "executeGeometryGuardChild"),
    resultProofWiringPassed: hasResultProofWiring(state),
    executorWiringPassed: hasExecutorWiring(state),
    coordinateGatePassed: hasCoordinateGateWiring(state),
    dispatchFailurePassed: hasDispatchFailureWiring(state),
  };
};

type GeometryRequiredShapePassedInput = {
  requiredPresence: PresenceEntry[];
  childImplementationViolations: string[];
  surfaceState: Omit<GeometryRequiredShapeState, "childFactoryPassed" | "resultProofWiringPassed" | "executorWiringPassed" | "coordinateGatePassed" | "dispatchFailurePassed" | "requiredShapePassed">;
  runtimeWiring: Pick<GeometryRequiredShapeState, "childFactoryPassed" | "resultProofWiringPassed" | "executorWiringPassed" | "coordinateGatePassed" | "dispatchFailurePassed">;
};

const hasSurfaceStatePassed = (surfaceState: GeometryRequiredShapePassedInput["surfaceState"]): boolean => {
  return surfaceState.schemaSurfacePassed
    && surfaceState.contractSurfacePassed
    && surfaceState.abilityGroupPassed
    && surfaceState.registryPassed
    && surfaceState.indexPassed;
};

const hasRuntimeWiringPassed = (runtimeWiring: GeometryRequiredShapePassedInput["runtimeWiring"]): boolean => {
  return runtimeWiring.childFactoryPassed
    && runtimeWiring.resultProofWiringPassed
    && runtimeWiring.executorWiringPassed
    && runtimeWiring.coordinateGatePassed
    && runtimeWiring.dispatchFailurePassed;
};

const getRequiredShapePassed = (input: GeometryRequiredShapePassedInput): boolean => {
  return input.requiredPresence.every((entry) => entry.exists)
    && input.childImplementationViolations.length === 0
    && hasSurfaceStatePassed(input.surfaceState)
    && hasRuntimeWiringPassed(input.runtimeWiring);
};

const getChildImplementationViolation = (
  project: Parameters<typeof support.getSourceFile>[0],
  childId: (typeof config.REQUIRED_CHILDREN)[number],
): string | null => {
  const implementationPath = support.childImplementationPath(childId);
  const sourceFile = support.getSourceFile(project, implementationPath);
  if (!sourceFile) {
    return implementationPath;
  }

  const importSpecifiers = sourceFile.getImportDeclarations().map((declaration) => declaration.getModuleSpecifierValue() ?? "");
  const hasForbiddenImport = importSpecifiers.some((specifier) => specifier.includes("/shared/") || specifier.includes("geometry-guard-executor") || specifier.includes("guard-result") || specifier.includes("failure"));
  const hasFactoryCall = moduleQueries.hasCallExpressionWithStringLiteralArgument(sourceFile, ["createGeometryGuardChildCapability"], childId);
  return hasForbiddenImport || !hasFactoryCall ? implementationPath : null;
};

export function createGeometrySourceState(project: Parameters<typeof support.getSourceFile>[0]): GeometrySourceState {
  const getSource = (filePath: string) => support.getSourceFile(project, filePath);
  const schemaSource = getSource(config.SCHEMA_PATH);
  const schemaFoundationSource = getSource(config.SCHEMA_FOUNDATION_PATH);
  const schemaInputSource = getSource(config.SCHEMA_INPUT_PATH);
  const schemaResultSource = getSource(config.SCHEMA_RESULT_PATH);
  const schemaRuntimeProofSource = getSource(config.SCHEMA_RUNTIME_PROOF_PATH);
  const registrySource = getSource(config.REGISTRY_PATH);
  const typesSource = getSource(config.TYPES_PATH);

  return {
    contractSource: getSource(config.CONTRACT_PATH),
    schemaSource,
    schemaFoundationSource,
    schemaInputSource,
    schemaResultSource,
    schemaRuntimeProofSource,
    abilityGroupSource: getSource(config.ABILITY_GROUP_PATH),
    registrySource,
    indexSource: getSource(config.INDEX_PATH),
    typesSource,
    childFactorySource: getSource(config.CHILD_FACTORY_PATH),
    executorSource: getSource(config.EXECUTOR_PATH),
    executionPlanSource: getSource(config.EXECUTION_PLAN_PATH),
    inputStagesSource: getSource(config.INPUT_STAGES_PATH),
    transformStageSource: getSource(config.TRANSFORM_STAGE_PATH),
    resultBuilderSource: getSource(config.RESULT_BUILDER_PATH),
    proofBuilderSource: getSource(config.PROOF_BUILDER_PATH),
    coordinateGateSource: getSource(`${config.ROOT}/runtime/coordinate-space-gate.ts`),
    dispatchFailureSource: getSource(`${config.ROOT}/runtime/geometry-dispatch-failure.ts`),
    clockSource: getSource(config.CLOCK_PATH),
    inputFields: getSchemaPropertyNames(schemaInputSource, "GeometryGuardBaseInputSchema"),
    safetyPolicyFields: getSchemaPropertyNames(schemaFoundationSource, "GeometryGuardSafetyPolicySchema"),
    resultFields: getSchemaPropertyNames(schemaResultSource, "GeometryGuardBaseResultSchema"),
    runtimeProofFields: getObjectLiteralPropertyNames(schemaRuntimeProofSource, "GeometryGuardRuntimeProofFieldSchemas"),
    schemaStrings: getStringSet(schemaInputSource),
    typeStrings: getStringSet(typesSource),
    registryStrings: getStringSet(registrySource),
  };
}

export function getGeometryChildImplementationViolations(project: Parameters<typeof support.getSourceFile>[0]): string[] {
  return config.REQUIRED_CHILDREN.flatMap((childId) => {
    const violation = getChildImplementationViolation(project, childId);
    return violation ? [violation] : [];
  });
}

export function getGeometryRequiredShapeState(
  state: GeometrySourceState,
  requiredPresence: PresenceEntry[],
  childImplementationViolations: string[],
): GeometryRequiredShapeState {
  const surfaceState = {
    schemaSurfacePassed: hasSchemaSurface(state),
    contractSurfacePassed: hasContractSurface(state),
    abilityGroupPassed: hasAbilityGroupSurface(state),
    registryPassed: hasRegistrySurface(state),
    indexPassed: hasIndexSurface(state),
  };
  const runtimeWiring = getRuntimeWiring(state);

  return {
    ...surfaceState,
    ...runtimeWiring,
    requiredShapePassed: getRequiredShapePassed({ requiredPresence, childImplementationViolations, surfaceState, runtimeWiring }),
  };
}

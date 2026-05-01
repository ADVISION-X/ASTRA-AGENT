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

const hasEveryValue = (values: Set<string>, requiredValues: readonly string[]): boolean => {
  return requiredValues.every((value) => values.has(value));
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

const hasExecutorPolicyCalls = (state: GeometrySourceState): boolean => {
  return callQueries.hasCallExpression(state.executorSource!, "evaluateGeometryInputPolicy")
    && callQueries.hasCallExpression(state.executorSource!, "evaluateCoordinateSpace")
    && callQueries.hasCallExpression(state.executorSource!, "evaluateBounds")
    && callQueries.hasCallExpression(state.executorSource!, "evaluateScaleMapping");
};

const hasExecutorResultCalls = (state: GeometrySourceState): boolean => {
  return callQueries.hasCallExpression(state.executorSource!, "evaluateClickSafety")
    && callQueries.hasCallExpression(state.executorSource!, "transformGeometry")
    && callQueries.hasCallExpression(state.executorSource!, "buildGeometryGuardResult")
    && callQueries.hasCallExpression(state.executorSource!, "dispatchGeometryGuardFailure");
};

const hasExecutorWiring = (state: GeometrySourceState): boolean => {
  return state.executorSource !== null
    && hasExecutorPolicyCalls(state)
    && hasExecutorResultCalls(state);
};

const hasCoordinateGateWiring = (state: GeometrySourceState): boolean => {
  return state.coordinateGateSource !== null
    && state.coordinateGateSource.getFullText().includes('input.sourceCoordinateSpace === "contactSheet"')
    && state.coordinateGateSource.getFullText().includes("device_scale_factor_missing");
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
  const registrySource = getSource(config.REGISTRY_PATH);
  const typesSource = getSource(config.TYPES_PATH);

  return {
    contractSource: getSource(config.CONTRACT_PATH),
    schemaSource,
    abilityGroupSource: getSource(config.ABILITY_GROUP_PATH),
    registrySource,
    indexSource: getSource(config.INDEX_PATH),
    typesSource,
    childFactorySource: getSource(config.CHILD_FACTORY_PATH),
    executorSource: getSource(config.EXECUTOR_PATH),
    resultBuilderSource: getSource(config.RESULT_BUILDER_PATH),
    proofBuilderSource: getSource(config.PROOF_BUILDER_PATH),
    coordinateGateSource: getSource(`${config.ROOT}/runtime/coordinate-space-gate.ts`),
    dispatchFailureSource: getSource(`${config.ROOT}/runtime/geometry-dispatch-failure.ts`),
    clockSource: getSource(config.CLOCK_PATH),
    inputFields: getSchemaPropertyNames(schemaSource, "GeometryGuardBaseInputSchema"),
    safetyPolicyFields: getSchemaPropertyNames(schemaSource, "GeometryGuardSafetyPolicySchema"),
    resultFields: getSchemaPropertyNames(schemaSource, "GeometryGuardBaseResultSchema"),
    runtimeProofFields: getSchemaPropertyNames(schemaSource, "GeometryGuardRuntimeProofSchema"),
    schemaStrings: getStringSet(schemaSource),
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

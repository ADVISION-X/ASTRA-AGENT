import { Node, type Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { inspectScreenshotDispatchAdapter } from "../_shared/screenshot-dispatch-adapter-check.js";

import { CHILDREN, LAW_IDS, PATHS } from "./config.js";
import { getRegistryChildIds, getSource, missingCanonicalFiles } from "./project-access.js";
import { getZodEnumValues, hasInterfaceMethod, hasCallExpression, hasCallExpressionPath } from "./required-shape-ast-support.js";
import { collectLifecycleTruthFindings } from "./required-shape-lifecycle-findings.js";
import { inspectScreenshotRuntimeProofParity } from "./runtime-proof-parity-check.js";
import { isThinAbilityGroup } from "./source-rules.js";

const EXECUTOR_ROUTE_SOURCES = [
  PATHS.EXECUTOR,
  PATHS.EXECUTION_FLOW,
  PATHS.EXECUTION_PHASES,
  PATHS.EXECUTION_SUCCESS,
  PATHS.EXECUTION_SUCCESS_RESULT,
] as const;

const STRICT_GOVERNANCE_SNIPPETS = [
  "missionId: limitedString(200)",
  "runId: limitedString(200)",
  "stepId: limitedString(200)",
  "mapPackageId: limitedString(200)",
  "mapPackageVersion: limitedString(120)",
  "selectedMapId: limitedString(200)",
  "selectedMapVersion: limitedString(120)",
  "activationSnapshotRef: limitedString(200)",
  "capabilityCallId: limitedString(200)",
  "nerveBusEnvelopeId: limitedString(200)",
  "inputRef: limitedString(200)",
  "idempotencyKey: limitedString(200)",
] as const;

const V2_SCHEMA_SNIPPETS = [
  "ScreenshotInputGovernanceShape",
  "ScreenshotProofGovernanceShape",
  "ScreenshotResultGovernanceShape",
  "timeoutDecision",
  "abortDecision",
  "regionDecision",
  "scaleMappingDecision",
  "diagnosticPayloadRef",
  "dataQualityFlags",
  "SCREENSHOT_PROOF_CHAIN_FIELD_NAMES",
  "SCREENSHOT_RESULT_CHAIN_FIELD_NAMES",
] as const;


const LIFECYCLE_RUNTIME_SNIPPETS = [
  "resolveScreenshotArtifactLifecyclePlan",
  "evaluateScreenshotArtifactBudget",
  "promotionStatus: \"not_promoted\"",
  "maxPendingTransientBytes",
] as const;

const LIFECYCLE_GATE_SNIPPETS = [
  "ScreenshotArtifactLifecycleManifestSchema.parse",
  "self_promotion_forbidden",
  "artifact_lifecycle_manifest_mismatch",
] as const;

const V2_TYPE_SNIPPETS = [
  "\"region_crop_pixels\"",
  "\"optimized_equivalent_pixels\"",
  "\"contact_sheet_pixels\"",
  "\"region_crop\"",
  "\"contact_sheet\"",
] as const;

const TRANSFORM_REGISTRY_SNIPPETS = [
  "childCapabilityId: \"capture-region\"",
  "outputImageKind: \"region_crop\"",
  "coordinateSpacePolicy: \"region_crop_pixels\"",
  "childCapabilityId: \"optimize-lossless\"",
  "coordinateSpacePolicy: \"derived\"",
] as const;

const TRANSFORM_SUCCESS_SNIPPETS = [
  'resolveDerivedTransformScaleMapping(input, "region_crop_pixels")',
  "return \"region_crop_pixels\";",
  "sourceCoordinateSpace: input.sourceProof.coordinateSpace ?? \"source_image_pixels\"",
  "resolveTransformScaleMapping",
] as const;

const STRICT_GOVERNANCE_COUNT_RULES = [
  { snippet: "activationSnapshotRef: limitedString(200),", expected: 3 },
  { snippet: "capabilityCallId: limitedString(200),", expected: 3 },
  { snippet: "nerveBusEnvelopeId: limitedString(200),", expected: 3 },
] as const;

async function collectMissingFileFindings(findings: Finding[]): Promise<void> {
  for (const filePath of await missingCanonicalFiles()) {
    findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: filePath, line: 1, severity: "fatal", message: "Screenshot required canonical file is missing." }));
  }
}

function collectAbilityGroupAndContractFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const abilityGroupSource = getSource(project, PATHS.ABILITY_GROUP);
  if (!isThinAbilityGroup(abilityGroupSource)) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.ABILITY_GROUP, line: 1, severity: "fatal", message: "Screenshot ability-group must stay a thin execute-only entrypoint." }));
  }
  const contractSource = getSource(project, PATHS.CONTRACT);
  if (!hasInterfaceMethod(contractSource, "ScreenshotAbilityGroup", "execute") || !hasInterfaceMethod(contractSource, "ScreenshotAbilityGroup", "listChildCapabilityIds")) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.CONTRACT, line: 1, severity: "fatal", message: "Screenshot public contract must expose execute and listChildCapabilityIds." }));
  }
  const publicMethods = contractSource.getInterface("ScreenshotAbilityGroup")?.getMethods().map((method) => method.getName()) ?? [];
  return publicMethods.length !== 2 || publicMethods.some((methodName) => !["execute", "listChildCapabilityIds"].includes(methodName))
    ? findings.concat(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.CONTRACT, line: 1, severity: "fatal", message: "Screenshot ability-group contract must not expose extra public methods." }))
    : findings;
}

function collectSchemaAndRegistryFindings(project: Project): Finding[] {
  const schemaSource = getSource(project, PATHS.SCHEMA);
  const schemaChildIds = getZodEnumValues(schemaSource, "ScreenshotChildCapabilityIdSchema");
  const registryChildIds = getRegistryChildIds(getSource(project, PATHS.REGISTRY));
  return schemaChildIds.sort().join(",") !== [...CHILDREN].sort().join(",") || registryChildIds.sort().join(",") !== [...CHILDREN].sort().join(",")
    ? [createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Screenshot schema and registry child ids must match the frozen child set." })]
    : [];
}

function collectExecutorFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const routeSources = EXECUTOR_ROUTE_SOURCES.map((path) => getSource(project, path));
  for (const calleeName of ["runScreenshotInputGate", "runScreenshotPayloadBudgetGate", "runScreenshotSourceGate", "runBrowserSessionGate", "runPageStateHandoffGate", "runPrivacyPolicyGate", "runRegionProofGate", "runArtifactStorageGate", "runScreenshotOutputBoundaryGate", "buildScreenshotRuntimeProof", "buildScreenshotResult"]) {
    if (!routeSources.some((sourceFile) => hasCallExpression(sourceFile, calleeName))) {
      findings.push(createFinding({ lawId: LAW_IDS.BOUNDARY, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: `Screenshot executor must route through ${calleeName}.` }));
    }
  }
  return findings;
}

function collectBuilderFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  if (!hasCallExpressionPath(getSource(project, PATHS.PROOF_BUILDER), ["ScreenshotRuntimeProofSchema", "parse"])) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Screenshot proof builder must parse the governed runtime proof schema." }));
  }
  const resultBuilderSource = getSource(project, PATHS.RESULT_BUILDER);
  if (!hasCallExpressionPath(resultBuilderSource, ["ScreenshotExecutionOutputSchema", "parse"]) || !hasCallExpressionPath(resultBuilderSource, ["ScreenshotResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Screenshot result builder must parse governed execution output and public result schemas." }));
  }
  const dispatchFailureSource = getSource(project, PATHS.DISPATCH_FAILURE);
  return !hasCallExpression(dispatchFailureSource, "buildScreenshotRuntimeProof") || !hasCallExpression(dispatchFailureSource, "buildScreenshotResult")
    ? findings.concat(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.DISPATCH_FAILURE, line: 1, severity: "fatal", message: "Screenshot invalid-input handling must terminate through governed proof and result builders." }))
    : findings;
}

function collectGovernanceTruthFindings(project: Project): Finding[] {
  return sourceContainsAll(PATHS.GOVERNANCE, project, STRICT_GOVERNANCE_SNIPPETS)
    ? []
    : [createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.GOVERNANCE, line: 1, severity: "fatal", message: "Screenshot V2 chain fields must stay hard-required in governance shapes, not nullable-by-default." })];
}

function collectGovernanceCountFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  for (const rule of STRICT_GOVERNANCE_COUNT_RULES) {
    if (countSnippetOccurrences(PATHS.GOVERNANCE, project, rule.snippet) !== rule.expected) {
      findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.GOVERNANCE, line: 1, severity: "fatal", message: `Screenshot governance must preserve all ${rule.expected} required occurrences of ${rule.snippet}.` }));
    }
  }
  return findings;
}

function collectSchemaTruthFindings(project: Project): Finding[] {
  return sourceContainsAll(PATHS.SCHEMA, project, V2_SCHEMA_SNIPPETS)
    ? []
    : [createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Screenshot schema must enforce V2 chain fields, proof decisions, diagnostic payload ref, and result/proof parity." })];
}

function collectInputGateTruthFindings(project: Project): Finding[] {
  return sourceContainsAll(PATHS.INPUT_GATE, project, [
    "SCREENSHOT_REQUIRED_INPUT_FIELDS",
    "timeout_policy_required",
    "Screenshot request requires timeoutMs or capturePolicy.maxDurationMs.",
  ])
    ? []
    : [createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.INPUT_GATE, line: 1, severity: "fatal", message: "Screenshot input gate must fail closed on missing V2 chain fields and missing timeout policy." })];
}

function collectChainHelperFindings(project: Project): Finding[] {
  const hasChainHelper = sourceContainsAll(PATHS.CHAIN, project, [
    "const resolveScreenshotChain",
    "const resolveScreenshotTimeoutMs",
  ]);
  const proofBuilderUsesChain = hasCallExpression(getSource(project, PATHS.PROOF_BUILDER), "resolveScreenshotChain");
  return hasChainHelper && proofBuilderUsesChain
    ? []
    : [createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.CHAIN, line: 1, severity: "fatal", message: "Screenshot V2 chain truth must resolve through shared chain helpers." })];
}

function collectProofBuilderTruthFindings(project: Project): Finding[] {
  return sourceContainsAll(PATHS.PROOF_BUILDER, project, [
    "diagnosticPayloadRef",
    "buildScreenshotTimeoutDecision",
    "buildScreenshotAbortDecision",
    "buildScreenshotRegionDecision",
    "buildScreenshotScaleMappingDecision",
  ])
    ? []
    : [createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Screenshot proof builder must emit diagnosticPayloadRef and the V2 timeout/abort/region/scaleMapping decisions." })];
}

function collectResultBuilderTruthFindings(project: Project): Finding[] {
  return sourceContainsAll(PATHS.RESULT_BUILDER, project, [
    "resolveScreenshotChain",
    "artifactLifecycleManifestRef: input.artifactLifecycleManifestRef",
    "diagnosticPayloadRef: input.runtimeProof.diagnosticPayloadRef",
    "dataQualityFlags: input.runtimeProof.dataQualityFlags",
  ])
    ? []
    : [createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Screenshot result builder must project chain truth, diagnostic payload ref, and dataQualityFlags from runtime proof." })];
}

function collectPhaseHelperFindings(project: Project): Finding[] {
  return countSnippetOccurrences(PATHS.PHASE_HELPERS, project, "timeoutMs: resolveScreenshotTimeoutMs(input.request, input.registryEntry.maxDurationMs)") === 2
    ? []
    : [createFinding({ lawId: LAW_IDS.TIMEOUT, file: PATHS.PHASE_HELPERS, line: 1, severity: "fatal", message: "Screenshot phase helpers must route runtime timeout through resolveScreenshotTimeoutMs." })];
}

function collectIdempotencyFindings(project: Project): Finding[] {
  return sourceContainsAll(PATHS.IDEMPOTENCY, project, [
    "resolveScreenshotChain",
    "inputRef:",
    "timeoutMs:",
  ])
    ? []
    : [createFinding({ lawId: LAW_IDS.TIMEOUT, file: PATHS.IDEMPOTENCY, line: 1, severity: "fatal", message: "Screenshot idempotency truth must include V2 chain, inputRef, and timeoutMs." })];
}

function collectTransformTruthFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  if (!sourceContainsAll(PATHS.TYPES, project, V2_TYPE_SNIPPETS)) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.TYPES, line: 1, severity: "fatal", message: "Screenshot type truth must include region_crop/contact_sheet image kinds and region/optimized/contact-sheet coordinate spaces." }));
  }
  if (!sourceContainsAll(PATHS.REGISTRY, project, TRANSFORM_REGISTRY_SNIPPETS)) {
    findings.push(createFinding({ lawId: LAW_IDS.TRANSFORM, file: PATHS.REGISTRY, line: 1, severity: "fatal", message: "Screenshot registry must keep capture-region as region_crop/region_crop_pixels and optimize-lossless as derived coordinate truth." }));
  }
  return sourceContainsAll(PATHS.SUCCESS_HELPERS, project, ["resolveTransformScaleMapping({", "resolveTransformCoordinateSpace({"])
    && sourceContainsAll("src/capabilities/screenshot/runtime/screenshot-transform-truth.ts", project, TRANSFORM_SUCCESS_SNIPPETS)
    ? findings
    : findings.concat(createFinding({ lawId: LAW_IDS.TRANSFORM, file: PATHS.SUCCESS_HELPERS, line: 1, severity: "fatal", message: "Screenshot success helpers must preserve region-crop coordinate truth and transformed scaleMapping lineage." }));
}

function collectBrowserViewportScaleGapFindings(project: Project): Finding[] {
  const outputBoundarySource = getSource(project, PATHS.OUTPUT_BOUNDARY_GATE);
  const callsScaleGapHelper = outputBoundarySource.getDescendants().some((node) =>
    Node.isCallExpression(node) && node.getExpression().getText() === "isBrowserViewportScaleMappedCapture",
  );
  return callsScaleGapHelper && sourceContainsAll(PATHS.OUTPUT_BOUNDARY_GATE, project, [
    "isBrowserViewportScaleMappedCapture",
    "input.registryEntry.childCapabilityId === \"capture-browser-viewport\"",
    "input.output.coordinateSpace === \"source_image_pixels\"",
    "mapping.sourceCoordinateSpace === \"browser_viewport_pixels\"",
    "mapping.targetCoordinateSpace === \"source_image_pixels\"",
  ])
    ? []
    : [createFinding({ lawId: LAW_IDS.TRANSFORM, file: PATHS.OUTPUT_BOUNDARY_GATE, line: 1, severity: "fatal", message: "Screenshot output boundary gate must allow browser viewport captures with explicit browser_viewport_pixels -> source_image_pixels scaleMapping." })];
}

function sourceContainsAll(path: string, project: Project, snippets: readonly string[]): boolean {
  const text = getSource(project, path).getFullText();
  return snippets.every((snippet) => text.includes(snippet));
}

function countSnippetOccurrences(path: string, project: Project, snippet: string): number {
  return getSource(project, path).getFullText().split(snippet).length - 1;
}

function collectV2ChainTruthFindings(project: Project): Finding[] {
  return [
    ...collectGovernanceTruthFindings(project),
    ...collectGovernanceCountFindings(project),
    ...collectSchemaTruthFindings(project),
    ...collectInputGateTruthFindings(project),
    ...collectChainHelperFindings(project),
    ...collectProofBuilderTruthFindings(project),
    ...collectResultBuilderTruthFindings(project),
    ...collectPhaseHelperFindings(project),
    ...collectIdempotencyFindings(project),
    ...collectTransformTruthFindings(project),
    ...collectBrowserViewportScaleGapFindings(project),
    ...collectLifecycleTruthFindings(project),
    ...inspectScreenshotRuntimeProofParity(project),
    ...inspectScreenshotDispatchAdapter(project, LAW_IDS.SHAPE),
  ];
}

export async function runRequiredShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  await collectMissingFileFindings(findings);
  findings.push(...collectAbilityGroupAndContractFindings(project));
  findings.push(...collectSchemaAndRegistryFindings(project));
  findings.push(...collectExecutorFindings(project));
  findings.push(...collectBuilderFindings(project));
  findings.push(...collectV2ChainTruthFindings(project));

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "required-shape",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Screenshot canonical package, thin entrypoint, and governed runtime chain are present."
        : "Screenshot canonical package or governed runtime chain is incomplete.",
    ),
  };
}

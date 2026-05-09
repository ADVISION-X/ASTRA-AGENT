import { Node, SyntaxKind, type Project } from "ts-morph";

import { flattenPropertyAccess, getSourceFileOrThrow } from "./inspection-ast-helpers.js";
import { visualTargetInspectionConstants as config } from "./inspection-constants.js";
import { createAttackPhase, createViolation, toLine, type AttackOutcome } from "./inspection-helpers.js";

const EXPECTED_STAGE_ORDER = [
  "runPayloadBudgetStage",
  "runScreenshotStage",
  "runAiStage",
  "runPageStateStage",
  "runCandidateSourceStage",
  "runCoordinateSpaceStage",
  "runTargetTypeStage",
  "runSelectionStage",
  "runAmbiguityStage",
  "runOutputBoundaryStage",
] as const;

const OUTPUT_BOUNDARY_PATH = `${config.ROOT}/runtime/visual-target-output-boundary-gate.ts`;
const PROOF_BUILDER_PATH = `${config.ROOT}/runtime/visual-target-proof-builder.ts`;
const RESULT_BUILDER_PATH = `${config.ROOT}/runtime/visual-target-result-builder.ts`;
const STAGE_RUNNER_PATH = `${config.ROOT}/runtime/visual-target-execution-stage-runners.ts`;
const CANDIDATE_SOURCE_PATH = `${config.ROOT}/runtime/candidate-source-gate.ts`;
const SCREENSHOT_PATH = `${config.ROOT}/runtime/screenshot-proof-gate.ts`;
const AI_BINDING_PATH = `${config.ROOT}/runtime/ai-result-proof-gate-binding.ts`;
const PAGE_STATE_PATH = `${config.ROOT}/runtime/page-state-consistency-gate.ts`;
const COORDINATE_SPACE_PATH = `${config.ROOT}/runtime/coordinate-space-gate.ts`;
const TARGET_SELECTION_PATH = `${config.ROOT}/runtime/target-selection-gate.ts`;

const getArrayLiteralExpression = (sourceFile: import("ts-morph").SourceFile, declarationName: string) => {
  const initializer = sourceFile.getVariableDeclaration(declarationName)?.getInitializer();
  return initializer && Node.isArrayLiteralExpression(initializer) ? initializer : null;
};

const collectStageOrderFindings = (stageRunnerSource: import("ts-morph").SourceFile) => {
  const findings = [];
  const runnerArray = getArrayLiteralExpression(stageRunnerSource, "VISUAL_TARGET_STAGE_RUNNERS");
  const actualOrder = runnerArray?.getElements().flatMap((element) => Node.isIdentifier(element) ? [element.getText()] : []) ?? [];
  if (actualOrder.join(",") !== EXPECTED_STAGE_ORDER.join(",")) {
    findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[4], file: STAGE_RUNNER_PATH, message: `Visual Target stage runner order must remain fixed: ${EXPECTED_STAGE_ORDER.join(" -> ")}.` }));
  }
  return findings;
};

const hasImportedName = (sourceFile: import("ts-morph").SourceFile, name: string): boolean => {
  return sourceFile.getImportDeclarations().some((declaration) => declaration.getNamedImports().some((specifier) => specifier.getName() === name));
};

const objectLiteralHasTrueProperty = (sourceFile: import("ts-morph").SourceFile, functionName: string, propertyName: string) => {
  const declaration = sourceFile.getFunction(functionName);
  if (!declaration) {
    return false;
  }
  return declaration.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((objectLiteral) => {
    const property = objectLiteral.getProperty(propertyName);
    return property && Node.isPropertyAssignment(property) && property.getInitializer()?.getText() === "true";
  });
};

const collectChainTruthFindings = (proofSource: import("ts-morph").SourceFile, resultSource: import("ts-morph").SourceFile) => {
  const findings = [];
  if (!hasImportedName(proofSource, "resolveVisualTargetChain")) {
    findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[5], file: PROOF_BUILDER_PATH, message: "Runtime proof builder must import resolveVisualTargetChain()." }));
  }
  if (!hasImportedName(resultSource, "resolveVisualTargetChain")) {
    findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[5], file: RESULT_BUILDER_PATH, message: "Result builder must import resolveVisualTargetChain()." }));
  }
  if (proofSource.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const path = flattenPropertyAccess(callExpression.getExpression());
    const [firstArgument] = callExpression.getArguments();
    return path.length === 1
      && path[0] === "buildStableVisualTargetRef"
      && firstArgument
      && Node.isStringLiteral(firstArgument)
      && firstArgument.getLiteralText() === "visual-target-run";
  })) {
    findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[5], file: PROOF_BUILDER_PATH, line: 1, message: "Runtime proof must not fabricate runId from local stable refs." }));
  }
  return findings;
};

const collectOutputBoundaryFindings = (sourceFile: import("ts-morph").SourceFile) => {
  const findings = [];
  if (!objectLiteralHasTrueProperty(sourceFile, "buildActionOutput", "notExecutableUntilGeometryGuard")) {
    findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[3], file: OUTPUT_BOUNDARY_PATH, message: "Action output must keep notExecutableUntilGeometryGuard=true." }));
  }
  if (!objectLiteralHasTrueProperty(sourceFile, "buildActionOutput", "geometryGuardHandoffRequired")) {
    findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[3], file: OUTPUT_BOUNDARY_PATH, message: "Action output must keep geometryGuardHandoffRequired=true." }));
  }
  const forbiddenProperty = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).find((property) => {
    const name = property.getName();
    return name === "safeToClick" || name === "clickAllowed" || name === "executionAllowed" || name === "geometryVerified";
  });
  if (forbiddenProperty) {
    findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[3], file: OUTPUT_BOUNDARY_PATH, line: toLine(forbiddenProperty), severity: "fatal", message: `Visual Target action output must not expose ${forbiddenProperty.getName()}.` }));
  }
  const criticalFlags = sourceFile.getVariableDeclaration("CRITICAL_FLAGS")?.getInitializer();
  const hasCriticalDataQuality = criticalFlags
    && Node.isNewExpression(criticalFlags)
    && criticalFlags.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === "critical_data_quality");
  if (!hasCriticalDataQuality) {
    findings.push(createViolation({ lawId: config.ACTIVE_LAW_IDS[4], file: OUTPUT_BOUNDARY_PATH, message: "Output boundary must fail closed on critical_data_quality." }));
  }
  return findings;
};

const collectSnippetFindings = (input: {
  sourceFile: import("ts-morph").SourceFile;
  filePath: string;
  snippets: Array<{ needle: string; message: string }>;
}) => {
  const sourceText = input.sourceFile.getFullText();
  return input.snippets.flatMap((snippet) => sourceText.includes(snippet.needle)
    ? []
    : [createViolation({ lawId: config.ACTIVE_LAW_IDS[4], file: input.filePath, message: snippet.message })]);
};

const collectScreenshotBindingFindings = (sourceFile: import("ts-morph").SourceFile) => collectSnippetFindings({
  sourceFile,
  filePath: SCREENSHOT_PATH,
  snippets: [
    {
      needle: 'screenshotProof.missionId !== input.request.missionId',
      message: 'Screenshot proof gate must enforce request missionId alignment.',
    },
    {
      needle: 'screenshotProof.runId !== input.request.runId',
      message: 'Screenshot proof gate must enforce request runId alignment.',
    },
  ],
});

const collectCandidateSourceBindingFindings = (sourceFile: import("ts-morph").SourceFile) => collectSnippetFindings({
  sourceFile,
  filePath: CANDIDATE_SOURCE_PATH,
  snippets: [
    {
      needle: 'requiredObservationKinds.includes(input.candidate.targetType)',
      message: 'Candidate source gate must enforce requiredObservationKinds against candidate targetType.',
    },
    {
      needle: '"candidate_source_binding_mismatch"',
      message: 'Candidate source gate must fail closed when candidate proof binding diverges from governed evidence.',
    },
  ],
});

const collectAiBindingGateFindings = (sourceFile: import("ts-morph").SourceFile) => collectSnippetFindings({
  sourceFile,
  filePath: AI_BINDING_PATH,
  snippets: [
    {
      needle: 'aiProof.missionId !== input.request.missionId',
      message: 'AI proof binding must enforce request missionId alignment.',
    },
    {
      needle: 'aiProof.runId !== input.request.runId',
      message: 'AI proof binding must enforce request runId alignment.',
    },
    {
      needle: 'matchesRequestedBinding(input.request.roundId, aiProof.roundId)',
      message: 'AI proof binding must enforce request roundId alignment.',
    },
    {
      needle: 'matchesRequestedBinding(input.request.videoVisitId, aiProof.videoVisitId)',
      message: 'AI proof binding must enforce request videoVisitId alignment.',
    },
    {
      needle: 'hasSharedBindingConflict(screenshotProof.missionId, aiProof.missionId)',
      message: 'AI proof binding must enforce screenshot and AI missionId alignment.',
    },
    {
      needle: 'hasSharedBindingConflict(screenshotProof.runId, aiProof.runId)',
      message: 'AI proof binding must enforce screenshot and AI runId alignment.',
    },
    {
      needle: 'hasSharedBindingConflict(screenshotProof.roundId, aiProof.roundId)',
      message: 'AI proof binding must enforce screenshot and AI roundId alignment.',
    },
  ],
});

const collectPageStateBindingFindings = (sourceFile: import("ts-morph").SourceFile) => collectSnippetFindings({
  sourceFile,
  filePath: PAGE_STATE_PATH,
  snippets: [
    {
      needle: 'pageStateProof.missionId !== input.request.missionId',
      message: 'Page State gate must enforce request missionId alignment.',
    },
    {
      needle: 'pageStateProof.runId !== input.request.runId',
      message: 'Page State gate must enforce request runId alignment.',
    },
    {
      needle: 'matchesRequestedBinding(input.request.roundId, pageStateProof.roundId)',
      message: 'Page State gate must enforce request roundId alignment.',
    },
    {
      needle: 'matchesRequestedBinding(input.request.videoVisitId, pageStateProof.videoVisitId)',
      message: 'Page State gate must enforce request videoVisitId alignment.',
    },
    {
      needle: 'hasSharedBindingConflict(screenshotProof.missionId, pageStateProof.missionId)',
      message: 'Page State gate must enforce screenshot and Page State missionId alignment.',
    },
    {
      needle: 'hasSharedBindingConflict(screenshotProof.runId, pageStateProof.runId)',
      message: 'Page State gate must enforce screenshot and Page State runId alignment.',
    },
    {
      needle: 'hasSharedBindingConflict(screenshotProof.roundId, pageStateProof.roundId)',
      message: 'Page State gate must enforce screenshot and Page State roundId alignment.',
    },
    {
      needle: 'hasSharedBindingConflict(aiProof.missionId, pageStateProof.missionId)',
      message: 'Page State gate must enforce AI and Page State missionId alignment.',
    },
    {
      needle: 'hasSharedBindingConflict(aiProof.runId, pageStateProof.runId)',
      message: 'Page State gate must enforce AI and Page State runId alignment.',
    },
  ],
});

const collectCoordinateSpaceBindingFindings = (sourceFile: import("ts-morph").SourceFile) => collectSnippetFindings({
  sourceFile,
  filePath: COORDINATE_SPACE_PATH,
  snippets: [
    {
      needle: 'isPointInsideBoundingBox(input.acceptedCandidate.executableClickPoint, input.acceptedCandidate.executableBoundingBox)',
      message: 'Coordinate space gate must keep clickPoint-inside-bbox enforcement after executable mapping.',
    },
    {
      needle: 'candidate_bbox_out_of_bounds',
      message: 'Coordinate space gate must fail closed when executable bbox or clickPoint leaves governed bounds.',
    },
  ],
});

const collectTargetSelectionBindingFindings = (sourceFile: import("ts-morph").SourceFile) => collectSnippetFindings({
  sourceFile,
  filePath: TARGET_SELECTION_PATH,
  snippets: [
    {
      needle: 'candidate.confidence - stalePenalty - dataQualityPenalty - sourcePenalty',
      message: 'Target selection must keep score-based ranking instead of regressing to raw input order.',
    },
    {
      needle: 'right.finalScore !== left.finalScore',
      message: 'Target selection ranking must stay ordered by governed finalScore.',
    },
    {
      needle: 'scoreGap < input.profile.selectionWindow',
      message: 'Target selection must keep governed selectionWindow ambiguity handling.',
    },
  ],
});

const collectBindingGateFindings = (input: {
  screenshot: import("ts-morph").SourceFile;
  candidateSource: import("ts-morph").SourceFile;
  aiBinding: import("ts-morph").SourceFile;
  pageState: import("ts-morph").SourceFile;
  coordinateSpace: import("ts-morph").SourceFile;
  targetSelection: import("ts-morph").SourceFile;
}): ReturnType<typeof collectSnippetFindings> => [
  ...collectScreenshotBindingFindings(input.screenshot),
  ...collectCandidateSourceBindingFindings(input.candidateSource),
  ...collectAiBindingGateFindings(input.aiBinding),
  ...collectPageStateBindingFindings(input.pageState),
  ...collectCoordinateSpaceBindingFindings(input.coordinateSpace),
  ...collectTargetSelectionBindingFindings(input.targetSelection),
];

export async function runPipelineTruthAttack(project: Project): Promise<AttackOutcome> {
  const stageRunnerSource = getSourceFileOrThrow(project, STAGE_RUNNER_PATH);
  const proofSource = getSourceFileOrThrow(project, PROOF_BUILDER_PATH);
  const resultSource = getSourceFileOrThrow(project, RESULT_BUILDER_PATH);
  const outputBoundarySource = getSourceFileOrThrow(project, OUTPUT_BOUNDARY_PATH);
  const screenshotSource = getSourceFileOrThrow(project, SCREENSHOT_PATH);
  const candidateSource = getSourceFileOrThrow(project, CANDIDATE_SOURCE_PATH);
  const aiBindingSource = getSourceFileOrThrow(project, AI_BINDING_PATH);
  const pageStateSource = getSourceFileOrThrow(project, PAGE_STATE_PATH);
  const coordinateSpaceSource = getSourceFileOrThrow(project, COORDINATE_SPACE_PATH);
  const targetSelectionSource = getSourceFileOrThrow(project, TARGET_SELECTION_PATH);
  const findings = [
    ...collectStageOrderFindings(stageRunnerSource),
    ...collectChainTruthFindings(proofSource, resultSource),
    ...collectOutputBoundaryFindings(outputBoundarySource),
    ...collectBindingGateFindings({
      screenshot: screenshotSource,
      candidateSource,
      aiBinding: aiBindingSource,
      pageState: pageStateSource,
      coordinateSpace: coordinateSpaceSource,
      targetSelection: targetSelectionSource,
    }),
  ];

  return { findings, phase: createAttackPhase("pipeline-truth-attack", findings, "Visual Target runtime keeps the fixed gate pipeline, real chain propagation, and non-executable Geometry Guard handoff truth.", "Visual Target runtime pipeline or chain/proof truth drifted away from the governed V2 contract.") };
}
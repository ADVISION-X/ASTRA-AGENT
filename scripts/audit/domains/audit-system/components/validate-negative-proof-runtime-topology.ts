import { Node, Project, SyntaxKind, type CallExpression, type SourceFile } from "ts-morph";

import { listFilesRecursive } from "../../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../../core/paths.js";
import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";

const LAW_ID = "GRASSEYE-AUDIT-SYSTEM-001-V1";
const AUDIT_DOMAINS_ROOT = "scripts/audit/domains";
const NEGATIVE_PROOF_FILE_NAME = "negative-proof-harness.ts";
const DEBUG_ENV = "GRASSEYE_AUDIT_NEGATIVE_PROOF_TOPOLOGY_DEBUG";

const debug = (message: string): void => {
  if (process.env[DEBUG_ENV] === "1") {
    process.stdout.write(`[audit:negative-proof-topology] ${message}\n`);
  }
};

const createProject = (): Project =>
  new Project({
    tsConfigFilePath: pathFromRepoRoot("tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });

const isIdentifierCall = (callExpression: CallExpression, name: string): boolean => {
  const expression = callExpression.getExpression();
  return Node.isIdentifier(expression) && expression.getText() === name;
};

const hasCallNamed = (node: Node, name: string): boolean =>
  node.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => isIdentifierCall(callExpression, name));

const hasSpawnSync = (sourceFile: SourceFile): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => isIdentifierCall(callExpression, "spawnSync"));

const hasRunInspectorProcess = (node: Node): boolean => hasCallNamed(node, "runInspectorProcess");

const hasGroupedMutationFunction = (sourceFile: SourceFile): boolean =>
  Boolean(sourceFile.getFunction("createMutationGroups"));

const hasTargetedPhaseEnvironment = (sourceFile: SourceFile): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((objectLiteral) =>
    objectLiteral.getProperties().some((property) =>
      Node.isSpreadAssignment(property)
        ? property.getExpression().getText().includes("phase")
        : Node.isPropertyAssignment(property) && property.getName().includes("PHASE"),
    ),
  );

const spawnCommandUsesSkipBuild = (callExpression: CallExpression): boolean =>
  callExpression.getArguments().some((argument) =>
    argument.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === "--skip-build"),
  );

const everySpawnedInspectorCanSkipBuild = (sourceFile: SourceFile): boolean => {
  const spawnCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((callExpression) => isIdentifierCall(callExpression, "spawnSync"));
  return spawnCalls.length === 0 || spawnCalls.every(spawnCommandUsesSkipBuild);
};

const collectForOfMutationLoops = (sourceFile: SourceFile) =>
  sourceFile.getDescendantsOfKind(SyntaxKind.ForOfStatement).filter((statement) => {
    const initializerText = statement.getInitializer().getText().toLowerCase();
    const expressionText = statement.getExpression().getText().toLowerCase();
    return initializerText.includes("mutation") || expressionText.includes("mutation");
  });

const loopCallsMutationVerifier = (loop: import("ts-morph").ForOfStatement): boolean =>
  loop.getStatement().getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression)
      && (expression.getText().toLowerCase().includes("mutate") || expression.getText() === "runInspectorProcess");
  });

const hasUnboundedMutationInspectorReplay = (sourceFile: SourceFile): boolean => {
  const mutateFunctions = sourceFile.getFunctions().filter((fn) => fn.getName()?.toLowerCase().includes("mutate"));
  const mutationVerifierRunsInspector = mutateFunctions.some((fn) => hasRunInspectorProcess(fn));
  return mutationVerifierRunsInspector && collectForOfMutationLoops(sourceFile).some(loopCallsMutationVerifier);
};

const hasPerMutationRollbackInspector = (sourceFile: SourceFile): boolean =>
  sourceFile.getFunctions().some((fn) => {
    if (!fn.getName()?.toLowerCase().includes("mutate")) {
      return false;
    }

    return fn.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((callExpression) => isIdentifierCall(callExpression, "runInspectorProcess"))
      .length > 1;
  });

const mutationObjects = (sourceFile: SourceFile) =>
  sourceFile.getVariableDeclarations()
    .map((declaration) => declaration.getInitializer())
    .filter((initializer): initializer is import("ts-morph").ArrayLiteralExpression => Boolean(initializer && Node.isArrayLiteralExpression(initializer)))
    .flatMap((arrayLiteral) => arrayLiteral.getElements())
    .filter((element): element is import("ts-morph").ObjectLiteralExpression => Node.isObjectLiteralExpression(element))
    .filter((objectLiteral) => objectLiteral.getProperty("expectedNeedle") || objectLiteral.getProperty("search") || objectLiteral.getProperty("oldText"));

const hasManyMutations = (sourceFile: SourceFile): boolean => mutationObjects(sourceFile).length > 4;

const hasSpawnedFullInspectorRisk = (sourceFile: SourceFile): boolean =>
  hasSpawnSync(sourceFile) && hasManyMutations(sourceFile) && hasUnboundedMutationInspectorReplay(sourceFile);

const createTopologyFinding = (file: string, message: string): Finding =>
  createFinding({ lawId: LAW_ID, file, line: 1, severity: "fatal", message });

const collectGroupedReplayFindings = (sourceFile: SourceFile, file: string, spawnRisk: boolean): Finding[] => {
  if (!spawnRisk || hasGroupedMutationFunction(sourceFile)) {
    return [];
  }

  return [
    createTopologyFinding(file, "Negative-proof harness with many mutations must group mutations instead of spawning a full inspector per mutation."),
    ...(hasTargetedPhaseEnvironment(sourceFile)
      ? []
      : [createTopologyFinding(file, "Spawned negative-proof harness with many mutations must pass targeted phase selection to nested inspector execution.")]),
  ];
};

const collectSpawnExecutionFindings = (sourceFile: SourceFile, file: string): Finding[] => [
  ...(hasSpawnSync(sourceFile) && !everySpawnedInspectorCanSkipBuild(sourceFile)
    ? [createTopologyFinding(file, "Spawned negative-proof inspector process must support --skip-build for non-law metadata mutations.")]
    : []),
  ...(hasSpawnSync(sourceFile) && hasPerMutationRollbackInspector(sourceFile) && hasManyMutations(sourceFile)
    ? [createTopologyFinding(file, "Negative-proof harness must not run rollback PASS after every mutation when one final rollback PASS can prove restoration.")]
    : []),
];

const collectHarnessFindings = (sourceFile: SourceFile): Finding[] => {
  const file = toRepoRelativePath(sourceFile.getFilePath());
  const spawnRisk = hasSpawnedFullInspectorRisk(sourceFile);
  debug(`${file} spawn=${hasSpawnSync(sourceFile)} mutations=${mutationObjects(sourceFile).length} grouped=${hasGroupedMutationFunction(sourceFile)} targeted=${hasTargetedPhaseEnvironment(sourceFile)} skipBuild=${everySpawnedInspectorCanSkipBuild(sourceFile)} replay=${hasUnboundedMutationInspectorReplay(sourceFile)} rollbackReplay=${hasPerMutationRollbackInspector(sourceFile)}`);
  return [
    ...collectGroupedReplayFindings(sourceFile, file, spawnRisk),
    ...collectSpawnExecutionFindings(sourceFile, file),
  ];
};

const createTopologyPhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "negative-proof-runtime-topology",
    findings.length === 0 ? "PASS" : "FAKE ENFORCEMENT",
    findings.length === 0,
    findings.length === 0
      ? "All spawned negative-proof harnesses avoid unbounded full-inspector replay."
      : "One or more negative-proof harnesses can replay full inspectors per mutation.",
  );

export const validateNegativeProofRuntimeTopology = async (
  _context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const project = createProject();
  const harnessPaths = (await listFilesRecursive(pathFromRepoRoot(AUDIT_DOMAINS_ROOT), { extensions: [NEGATIVE_PROOF_FILE_NAME] }))
    .filter((filePath) => filePath.endsWith(`/${NEGATIVE_PROOF_FILE_NAME}`));
  const sourceFiles = harnessPaths
    .map((filePath) => project.addSourceFileAtPathIfExists(filePath))
    .filter((sourceFile): sourceFile is SourceFile => Boolean(sourceFile));
  const findings = sourceFiles.flatMap(collectHarnessFindings);

  return {
    findings,
    phases: [createTopologyPhase(findings)],
  };
};

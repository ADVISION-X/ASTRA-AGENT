import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
  getZodEnumValues,
  hasCallExpression,
  hasCallExpressionPath,
  hasImportModuleSpecifier,
  hasInterfaceMethod,
  hasLiteralTextFragment,
  hasPropertyNamed,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const ROOT = "src/capabilities/nerve-bus";
const SCHEMA_PATH = `${ROOT}/schema.ts`;
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const EXECUTOR_PATH = `${ROOT}/runtime/nerve-bus-executor.ts`;
const INPUT_GATE_PATH = `${ROOT}/runtime/envelope-input-gate.ts`;
const POLICY_GATE_PATH = `${ROOT}/runtime/channel-policy-gate.ts`;
const INTEGRITY_GATE_PATH = `${ROOT}/runtime/envelope-integrity-gate.ts`;
const IDEMPOTENCY_GATE_PATH = `${ROOT}/runtime/transport-idempotency-gate.ts`;
const TIMEOUT_GATE_PATH = `${ROOT}/runtime/transport-timeout-gate.ts`;
const RUNNER_PATH = `${ROOT}/runtime/transport-runner.ts`;
const RESULT_BUILDER_PATH = `${ROOT}/runtime/transport-result-builder.ts`;
const PROOF_BUILDER_PATH = `${ROOT}/runtime/transport-proof-builder.ts`;
const DISPATCH_FAILURE_PATH = `${ROOT}/runtime/transport-dispatch-failure.ts`;
const CLOCK_PORT_PATH = `${ROOT}/ports/nerve-bus-clock-port.ts`;
const TRANSPORT_PORT_PATH = `${ROOT}/ports/nerve-bus-transport-port.ts`;
const IDEMPOTENCY_PORT_PATH = `${ROOT}/ports/nerve-bus-idempotency-port.ts`;
const QUEUE_PORT_PATH = `${ROOT}/ports/nerve-bus-queue-port.ts`;
const HANDLER_PORT_PATH = `${ROOT}/ports/nerve-bus-handler-port.ts`;
const INDEX_PATH = `${ROOT}/index.ts`;

const CHILDREN = [
  "commander-to-orchestration",
  "orchestration-to-commander",
  "orchestration-to-ability",
  "ability-to-orchestration",
  "orchestration-to-ai",
  "ai-to-orchestration",
] as const;

const REQUIRED_FILES = [
  SCHEMA_PATH,
  CONTRACT_PATH,
  REGISTRY_PATH,
  ABILITY_GROUP_PATH,
  EXECUTOR_PATH,
  INPUT_GATE_PATH,
  POLICY_GATE_PATH,
  INTEGRITY_GATE_PATH,
  IDEMPOTENCY_GATE_PATH,
  TIMEOUT_GATE_PATH,
  RUNNER_PATH,
  RESULT_BUILDER_PATH,
  PROOF_BUILDER_PATH,
  DISPATCH_FAILURE_PATH,
  CLOCK_PORT_PATH,
  TRANSPORT_PORT_PATH,
  IDEMPOTENCY_PORT_PATH,
  QUEUE_PORT_PATH,
  HANDLER_PORT_PATH,
  INDEX_PATH,
] as const;

function hasExportStar(sourceFile: SourceFile): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.isNamespaceExport());
}

function hasDynamicImport(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword);
}

function hasRequireCall(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => Node.isIdentifier(callExpression.getExpression()) && callExpression.getExpression().getText() === "require");
}

function hasAsAny(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).some((expression) => expression.getTypeNode()?.getText() === "any");
}

function hasUnknownAs(sourceFile: SourceFile): boolean {
  return sourceFile.getFullText().includes("as unknown as");
}

function hasNewDateOutsideClock(sourceFile: SourceFile): boolean {
  const relative = toRepoRelativePath(sourceFile.getFilePath());
  if (relative === CLOCK_PORT_PATH) {
    return false;
  }

  return sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "Date");
}

function hasDateParse(sourceFile: SourceFile): boolean {
  const relative = toRepoRelativePath(sourceFile.getFilePath());
  if (relative === CLOCK_PORT_PATH) {
    return false;
  }

  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getExpression().getText() === "Date"
      && expression.getName() === "parse";
  });
}

export default createPendingDomainInspector({
  inspector: "GrassEye Nerve Bus Capability Owner Inspector",
  inspectorId: "nerve-bus-capability-owner",
  capabilityDomain: "nerve-bus-capability",
  inspectorEntry: "scripts/audit/domains/nerve-bus-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "nerve-bus-capability law exists but the governed transport executor is not fully established yet",
  implementedSummary: "nerve-bus-capability is implemented as the governed transport spine with runtime gates, child channels, and proof generation",
  extraChecks: async () => {
    const project = createAuditProject();
    const schemaSource = getSourceFileOrThrow(project, SCHEMA_PATH);
    const contractSource = getSourceFileOrThrow(project, CONTRACT_PATH);
    const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
    const registrySource = getSourceFileOrThrow(project, REGISTRY_PATH);
    const executorSource = getSourceFileOrThrow(project, EXECUTOR_PATH);
    const indexSource = getSourceFileOrThrow(project, INDEX_PATH);
    const nerveBusFiles = project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${ROOT}/`));
    const findings: Finding[] = [];

    const requiredPresence = await Promise.all(REQUIRED_FILES.map(async (file) => ({ file, exists: await fileExists(pathFromRepoRoot(file)) })));
    for (const requiredFile of requiredPresence) {
      if (!requiredFile.exists) {
        findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: requiredFile.file, line: 1, severity: "fatal", message: "Required Nerve Bus canonical file is missing." }));
      }
    }

    for (const childId of CHILDREN) {
      for (const childFile of ["contract.ts", "schema.ts", "implementation.ts"]) {
        const file = `${ROOT}/children/${childId}/${childFile}`;
        if (!await fileExists(pathFromRepoRoot(file))) {
          findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file, line: 1, severity: "fatal", message: "Each Nerve Bus child must carry contract/schema/implementation." }));
        }
      }
    }

    const schemaChannels = getZodEnumValues(schemaSource, "NerveBusChannelIdSchema");
    const registryChannelsPresent = CHILDREN.every((childId) => hasLiteralTextFragment(registrySource, childId));
    const requiredShapePassed = schemaChannels.length === CHILDREN.length
      && CHILDREN.every((childId) => schemaChannels.includes(childId))
      && hasInterfaceMethod(contractSource, "NerveBusAbilityGroup", "dispatchAbilityCommand")
      && hasInterfaceMethod(contractSource, "NerveBusAbilityGroup", "dispatchHumanCommand")
      && hasInterfaceMethod(contractSource, "NerveBusAbilityGroup", "requestAi")
      && hasCallExpressionPath(abilityGroupSource, ["HumanCommandDispatchInputSchema", "parse"])
      && hasCallExpressionPath(abilityGroupSource, ["AbilityCommandDispatchInputSchema", "parse"])
      && hasCallExpressionPath(abilityGroupSource, ["AiRequestDispatchInputSchema", "parse"])
      && hasCallExpression(executorSource, "buildTransportProof")
      && hasCallExpression(executorSource, "buildGovernedFailureResult")
      && hasCallExpression(executorSource, "buildSuccessTransportResult")
      && hasCallExpression(executorSource, "enforceEnvelopeInputGate")
      && hasCallExpression(executorSource, "enforceChannelPolicyGate")
      && hasCallExpression(executorSource, "enforceEnvelopeIntegrityGate")
      && hasCallExpression(executorSource, "enforceTransportIdempotencyGate")
      && hasCallExpression(executorSource, "resolveTransportTimeoutGate")
      && hasCallExpression(executorSource, "enforceTransportSequencePolicy")
      && registryChannelsPresent;
    if (!requiredShapePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: ROOT, line: 1, severity: "fatal", message: "Nerve Bus required runtime shape is incomplete." }));
    }

    const forbiddenShapePassed = nerveBusFiles.every((sourceFile) => {
      return !hasLiteralTextFragment(sourceFile, "local-ai-decision")
        && !hasLiteralTextFragment(sourceFile, "Record<string, unknown>")
        && !hasDateParse(sourceFile)
        && !hasNewDateOutsideClock(sourceFile)
        && !hasExportStar(sourceFile)
        && !hasLiteralTextFragment(sourceFile, "channel-check.ts")
        && !hasRequireCall(sourceFile);
    });
    if (!forbiddenShapePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-002-V1", file: ROOT, line: 1, severity: "fatal", message: "Nerve Bus still contains forbidden legacy transport shapes." }));
    }

    const antiEscapePassed = nerveBusFiles.every((sourceFile) => {
      const text = sourceFile.getFullText();
      return !hasAsAny(sourceFile)
        && !hasUnknownAs(sourceFile)
        && !hasDynamicImport(sourceFile)
        && !text.includes("@ts-ignore")
        && !text.includes("@ts-expect-error")
        && !text.includes("eslint-disable");
    });
    if (!antiEscapePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: ROOT, line: 1, severity: "fatal", message: "Nerve Bus contains anti-escape violations." }));
    }

    const forbiddenImportsPresent = nerveBusFiles.some((sourceFile) => {
      return [
        "capabilities/ai/",
        "capabilities/mouse-click/",
        "capabilities/mouse-scroll/",
        "capabilities/screenshot/",
        "capabilities/geometry-guard/",
        "capabilities/forensics-persistence/",
        "capabilities/open/",
      ].some((marker) => hasImportModuleSpecifier(sourceFile, marker));
    });
    const boundaryPassed = !forbiddenImportsPresent
      && hasPropertyNamed(registrySource, "allowedFrom")
      && hasPropertyNamed(registrySource, "allowedTo")
      && hasLiteralTextFragment(registrySource, "commander-to-orchestration")
      && !hasLiteralTextFragment(registrySource, "commander-to-governed")
      && !hasLiteralTextFragment(registrySource, "governed-to-commander");
    if (!boundaryPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-002-V1", file: REGISTRY_PATH, line: 1, severity: "fatal", message: "Nerve Bus channel boundary enforcement is incomplete." }));
    }

    if (hasExportStar(indexSource)) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: INDEX_PATH, line: 1, severity: "fatal", message: "Nerve Bus index must use explicit exports only." }));
    }

    return {
      findings,
      phases: [
        createPhase("nerve-bus-required-shape", requiredShapePassed ? "PASS" : "CODE VIOLATION", requiredShapePassed, requiredShapePassed ? "Nerve Bus exposes the required executor, gates, ports, schemas, registry, and child folders." : "Nerve Bus required shape is incomplete."),
        createPhase("nerve-bus-forbidden-shape", forbiddenShapePassed ? "PASS" : "CODE VIOLATION", forbiddenShapePassed, forbiddenShapePassed ? "Nerve Bus legacy transfer patterns have been removed." : "Nerve Bus still contains forbidden legacy transfer patterns."),
        createPhase("nerve-bus-boundary", boundaryPassed ? "PASS" : "CODE VIOLATION", boundaryPassed, boundaryPassed ? "Nerve Bus channel policy boundaries are enforced in the canonical root." : "Nerve Bus channel policy boundaries are incomplete."),
        createPhase("nerve-bus-anti-escape", antiEscapePassed ? "PASS" : "CODE VIOLATION", antiEscapePassed, antiEscapePassed ? "Nerve Bus avoids anti-escape patterns." : "Nerve Bus still uses anti-escape patterns."),
      ],
    };
  },
});

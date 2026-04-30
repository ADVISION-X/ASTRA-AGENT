import { SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { hasInterfaceMethod } from "../_shared/ast-schema-queries.js";
import {
  ABILITY_GROUP_PATH,
  CHANNEL_IDS,
  CONTRACT_PATH,
  CONTEXT_PATH,
  EXECUTOR_PATH,
  getSchemaChannelIds,
  getSourceFile,
  INDEX_PATH,
  makeProject,
  missingRequiredFiles,
  PROOF_BUILDER_PATH,
  REGISTRY_PATH,
  RESULT_BUILDER_PATH,
  RUNNER_PATH,
  SCHEMA_PATH,
} from "./ast-utils.js";

export async function runRequiredShapeAttack(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const missingFiles = await missingRequiredFiles();
  for (const filePath of missingFiles) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: filePath, line: 1, severity: "fatal", message: "Nerve Bus required production file is missing." }));
  }

  const project = makeProject();
  const abilityGroupSource = getSourceFile(project, ABILITY_GROUP_PATH);
  const contractSource = getSourceFile(project, CONTRACT_PATH);
  const contextSource = getSourceFile(project, CONTEXT_PATH);
  const schemaSource = getSourceFile(project, SCHEMA_PATH);
  const registrySource = getSourceFile(project, REGISTRY_PATH);
  const executorSource = getSourceFile(project, EXECUTOR_PATH);
  const proofBuilderSource = getSourceFile(project, PROOF_BUILDER_PATH);
  const resultBuilderSource = getSourceFile(project, RESULT_BUILDER_PATH);
  const runnerSource = getSourceFile(project, RUNNER_PATH);
  const indexSource = getSourceFile(project, INDEX_PATH);

  if (!contractSource || !hasInterfaceMethod(contractSource, "NerveBusAbilityGroup", "dispatchHumanCommand") || !hasInterfaceMethod(contractSource, "NerveBusAbilityGroup", "dispatchAbilityCommand") || !hasInterfaceMethod(contractSource, "NerveBusAbilityGroup", "requestAi")) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: CONTRACT_PATH, line: 1, severity: "fatal", message: "Nerve Bus must expose stable public dispatch methods in contract.ts." }));
  }

  if (!abilityGroupSource || !hasCallExpressionPath(abilityGroupSource, ["HumanCommandDispatchInputSchema", "parse"]) || !hasCallExpressionPath(abilityGroupSource, ["AbilityCommandDispatchInputSchema", "parse"]) || !hasCallExpressionPath(abilityGroupSource, ["AiRequestDispatchInputSchema", "parse"]) || !hasCallExpression(abilityGroupSource, "createNerveBusRuntimeContext") || !hasCallExpression(abilityGroupSource, "executeNerveBusChild")) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Nerve Bus ability-group must stay schema-first and route through the executor." }));
  }

  if (abilityGroupSource) {
    for (const forbidden of ["createSystemNerveBusClockPort", "createInMemoryNerveBusTransportPort", "createInMemoryNerveBusIdempotencyPort", "createInMemoryNerveBusQueuePort"]) {
      if (hasCallExpression(abilityGroupSource, forbidden)) {
        findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: `Nerve Bus ability-group must not construct ${forbidden}.` }));
      }
    }
  }

  if (!contextSource || !hasCallExpression(contextSource, "createSystemNerveBusClockPort") || !hasCallExpression(contextSource, "createInMemoryNerveBusTransportPort") || !hasCallExpression(contextSource, "createInMemoryNerveBusIdempotencyPort") || !hasCallExpression(contextSource, "createInMemoryNerveBusQueuePort")) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: CONTEXT_PATH, line: 1, severity: "fatal", message: "Nerve Bus runtime context must own default transport composition." }));
  }

  if (!schemaSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Nerve Bus schema file is missing." }));
  } else {
    for (const declaration of ["NerveBusChannelIdSchema", "HandlerDecisionSchema", "QueueDecisionSchema", "SequenceDecisionSchema", "CircuitBreakerStateSchema", "NerveBusTransportProofSchema"]) {
      if (!schemaSource.getVariableDeclaration(declaration)) {
        findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: `Nerve Bus schema must declare ${declaration}.` }));
      }
    }
  }

  const schemaChannelIds = getSchemaChannelIds(project);
  if (schemaChannelIds.length !== CHANNEL_IDS.length || CHANNEL_IDS.some((channelId) => !schemaChannelIds.includes(channelId))) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Nerve Bus schema channel ids must match the canonical six-channel registry." }));
  }

  if (!registrySource || !registrySource.getVariableDeclaration("NERVE_BUS_CHANNEL_REGISTRY")) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: REGISTRY_PATH, line: 1, severity: "fatal", message: "Nerve Bus registry must declare the canonical channel registry." }));
  } else {
    for (const channelId of CHANNEL_IDS) {
      if (!registrySource.getFullText().includes(`"${channelId}"`)) {
        findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: REGISTRY_PATH, line: 1, severity: "fatal", message: `Nerve Bus registry is missing channel ${channelId}.` }));
      }
    }
  }

  if (!executorSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Nerve Bus executor file is missing." }));
  } else {
    for (const callee of ["enforceEnvelopeInputGate", "enforceChannelPolicyGate", "enforceEnvelopeIntegrityGate", "enforceTransportIdempotencyGate", "resolveTransportTimeoutGate", "enforceTransportSequencePolicy", "buildTransportProof", "buildGovernedFailureResult", "buildSuccessTransportResult"]) {
      if (!hasCallExpression(executorSource, callee)) {
        findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: `Nerve Bus executor must call ${callee}.` }));
      }
    }

    const executeBranch = executorSource.getDescendantsOfKind(SyntaxKind.IfStatement).some((statement) => statement.getExpression().getText().includes('outcome.kind === "handler_failed"'));
    if (!executeBranch) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Nerve Bus executor must branch on the runner outcome kind." }));
    }
  }

  if (!runnerSource || !runnerSource.getTypeAlias("NerveBusRunnerOutcome") || !hasCallExpression(runnerSource, "raceWithTimeout")) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Nerve Bus runner must expose a discriminated outcome and timeout race handling." }));
  }

  if (!proofBuilderSource || !hasCallExpressionPath(proofBuilderSource, ["NerveBusTransportProofSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: PROOF_BUILDER_PATH, line: 1, severity: "fatal", message: "Nerve Bus proof builder must parse governed proof output." }));
  }

  if (!resultBuilderSource || !hasCallExpressionPath(resultBuilderSource, ["AbilityTransportResultSchema", "parse"]) || !hasCallExpressionPath(resultBuilderSource, ["AiTransportResultSchema", "parse"]) || !hasCallExpressionPath(resultBuilderSource, ["HumanCommandTransportResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Nerve Bus result builder must parse governed transport results." }));
  }

  if (!indexSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-001-V1", file: INDEX_PATH, line: 1, severity: "fatal", message: "Nerve Bus public index is missing." }));
  }

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "required-shape",
      phasePassed ? "PASS" : "CODE VIOLATION",
      phasePassed,
      phasePassed
        ? "Nerve Bus required package, thin entry, executor chain, and governed builders are present."
        : "Nerve Bus required package or governed execution shape is incomplete.",
    ),
  };
}
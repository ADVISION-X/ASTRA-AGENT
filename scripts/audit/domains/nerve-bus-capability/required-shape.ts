import { SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { hasInterfaceMethod } from "../_shared/ast-schema-queries.js";
import { CHANNEL_IDS, LAW_IDS, PATHS } from "./config.js";
import { getSchemaChannelIds, getSourceFile, makeProject, missingRequiredFiles } from "./project-access.js";

async function collectMissingFileFindings(findings: Finding[]): Promise<void> {
  for (const filePath of await missingRequiredFiles()) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: filePath, line: 1, severity: "fatal", message: "Nerve Bus required production file is missing." }));
  }
}

function collectContractFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const contractSource = getSourceFile(project, PATHS.CONTRACT);
  if (!contractSource || !hasInterfaceMethod(contractSource, "NerveBusAbilityGroup", "dispatchHumanCommand") || !hasInterfaceMethod(contractSource, "NerveBusAbilityGroup", "dispatchAbilityCommand") || !hasInterfaceMethod(contractSource, "NerveBusAbilityGroup", "requestAi")) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.CONTRACT, line: 1, severity: "fatal", message: "Nerve Bus must expose stable public dispatch methods in contract.ts." }));
  }
  return findings;
}

function collectAbilityGroupFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const abilityGroupSource = getSourceFile(project, PATHS.ABILITY_GROUP);
  if (!abilityGroupSource || !hasCallExpressionPath(abilityGroupSource, ["HumanCommandDispatchInputSchema", "parse"]) || !hasCallExpressionPath(abilityGroupSource, ["AbilityCommandDispatchInputSchema", "parse"]) || !hasCallExpressionPath(abilityGroupSource, ["AiRequestDispatchInputSchema", "parse"]) || !hasCallExpression(abilityGroupSource, "createNerveBusRuntimeContext") || !hasCallExpression(abilityGroupSource, "executeNerveBusChild")) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.ABILITY_GROUP, line: 1, severity: "fatal", message: "Nerve Bus ability-group must stay schema-first and route through the executor." }));
  }
  return abilityGroupSource ? findings.concat(collectAbilityGroupFactoryFindings(abilityGroupSource)) : findings;
}

function collectAbilityGroupFactoryFindings(abilityGroupSource: NonNullable<ReturnType<typeof getSourceFile>>): Finding[] {
  return ["createSystemNerveBusClockPort", "createInMemoryNerveBusTransportPort", "createInMemoryNerveBusIdempotencyPort", "createInMemoryNerveBusQueuePort"]
    .filter((forbidden) => hasCallExpression(abilityGroupSource, forbidden))
    .map((forbidden) => createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.ABILITY_GROUP, line: 1, severity: "fatal", message: `Nerve Bus ability-group must not construct ${forbidden}.` }));
}

function collectContextFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const contextSource = getSourceFile(project, PATHS.CONTEXT);
  if (!contextSource || !hasCallExpression(contextSource, "createSystemNerveBusClockPort") || !hasCallExpression(contextSource, "createInMemoryNerveBusTransportPort") || !hasCallExpression(contextSource, "createInMemoryNerveBusIdempotencyPort") || !hasCallExpression(contextSource, "createInMemoryNerveBusQueuePort")) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.CONTEXT, line: 1, severity: "fatal", message: "Nerve Bus runtime context must own default transport composition." }));
  }
  return findings;
}

function collectSchemaDeclarationFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const schemaSource = getSourceFile(project, PATHS.SCHEMA);
  if (!schemaSource) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Nerve Bus schema file is missing." }));
  } else {
    for (const declaration of ["NerveBusChannelIdSchema", "HandlerDecisionSchema", "QueueDecisionSchema", "SequenceDecisionSchema", "CircuitBreakerStateSchema", "NerveBusTransportProofSchema"]) {
      if (!schemaSource.getVariableDeclaration(declaration)) {
        findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: `Nerve Bus schema must declare ${declaration}.` }));
      }
    }
  }
  return findings;
}

function collectChannelAndRegistryFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const schemaChannelIds = getSchemaChannelIds(project);
  if (schemaChannelIds.length !== CHANNEL_IDS.length || CHANNEL_IDS.some((channelId) => !schemaChannelIds.includes(channelId))) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Nerve Bus schema channel ids must match the canonical six-channel registry." }));
  }
  const registrySource = getSourceFile(project, PATHS.REGISTRY);
  if (!registrySource || !registrySource.getVariableDeclaration("NERVE_BUS_CHANNEL_REGISTRY")) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.REGISTRY, line: 1, severity: "fatal", message: "Nerve Bus registry must declare the canonical channel registry." }));
  } else {
    for (const channelId of CHANNEL_IDS) {
      if (!registrySource.getFullText().includes(`"${channelId}"`)) {
        findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.REGISTRY, line: 1, severity: "fatal", message: `Nerve Bus registry is missing channel ${channelId}.` }));
      }
    }
  }
  return findings;
}

function collectExecutorAndBuilderFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const executorSource = getSourceFile(project, PATHS.EXECUTOR);
  if (!executorSource) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Nerve Bus executor file is missing." }));
  } else {
    for (const callee of ["enforceEnvelopeInputGate", "enforceChannelPolicyGate", "enforceEnvelopeIntegrityGate", "enforceTransportIdempotencyGate", "resolveTransportTimeoutGate", "enforceTransportSequencePolicy", "buildTransportProof", "buildGovernedFailureResult", "buildSuccessTransportResult"]) {
      if (!hasCallExpression(executorSource, callee)) {
        findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: `Nerve Bus executor must call ${callee}.` }));
      }
    }
    const executeBranch = executorSource.getDescendantsOfKind(SyntaxKind.IfStatement).some((statement) => statement.getExpression().getText().includes('outcome.kind === "handler_failed"'));
    if (!executeBranch) {
      findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Nerve Bus executor must branch on the runner outcome kind." }));
    }
  }
  return findings;
}

function collectRunnerFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const runnerSource = getSourceFile(project, PATHS.RUNNER);
  if (!runnerSource || !runnerSource.getTypeAlias("NerveBusRunnerOutcome") || !hasCallExpression(runnerSource, "raceWithTimeout")) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Nerve Bus runner must expose a discriminated outcome and timeout race handling." }));
  }
  return findings;
}

function collectProofBuilderFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const proofBuilderSource = getSourceFile(project, PATHS.PROOF_BUILDER);
  return !proofBuilderSource || !hasCallExpressionPath(proofBuilderSource, ["NerveBusTransportProofSchema", "parse"])
    ? [createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Nerve Bus proof builder must parse governed proof output." })]
    : [];
}

function collectResultBuilderFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const resultBuilderSource = getSourceFile(project, PATHS.RESULT_BUILDER);
  return !resultBuilderSource || !hasCallExpressionPath(resultBuilderSource, ["AbilityTransportResultSchema", "parse"]) || !hasCallExpressionPath(resultBuilderSource, ["AiTransportResultSchema", "parse"]) || !hasCallExpressionPath(resultBuilderSource, ["HumanCommandTransportResultSchema", "parse"])
    ? [createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Nerve Bus result builder must parse governed transport results." })]
    : [];
}

function collectIndexFindings(project: ReturnType<typeof makeProject>): Finding[] {
  return !getSourceFile(project, PATHS.INDEX)
    ? [createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.INDEX, line: 1, severity: "fatal", message: "Nerve Bus public index is missing." })]
    : [];
}

function collectRunnerAndBuilderFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings = [
    ...collectRunnerFindings(project),
    ...collectProofBuilderFindings(project),
    ...collectResultBuilderFindings(project),
  ];
  return findings.concat(collectIndexFindings(project));
}

export async function runRequiredShapeAttack(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const project = makeProject();
  const findings: Finding[] = [];
  await collectMissingFileFindings(findings);
  findings.push(...collectContractFindings(project));
  findings.push(...collectAbilityGroupFindings(project));
  findings.push(...collectContextFindings(project));
  findings.push(...collectSchemaDeclarationFindings(project));
  findings.push(...collectChannelAndRegistryFindings(project));
  findings.push(...collectExecutorAndBuilderFindings(project));
  findings.push(...collectRunnerAndBuilderFindings(project));

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
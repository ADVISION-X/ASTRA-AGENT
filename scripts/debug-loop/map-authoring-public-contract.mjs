import { createHash } from "node:crypto";
import path from "node:path";

import { buildMapAuthoringPublicContract } from "../../src/map-plugins/authoring/map-authoring-public-contract.ts";
import { writeJsonFile, writeTextFile } from "./json-utils.mjs";

function parseCliArgs(argv) {
  const scenarioIndex = argv.indexOf("--scenario");
  const artifactDirIndex = argv.indexOf("--artifactDir");
  return {
    scenario: scenarioIndex === -1 ? null : JSON.parse(argv[scenarioIndex + 1] ?? "null"),
    artifactDir: artifactDirIndex === -1 ? null : argv[artifactDirIndex + 1] ?? null,
  };
}

function staticHash(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function collectDelimitedContextLine(label, value, separator) {
  return Array.isArray(value) && value.length > 0
    ? `${label}: ${value.join(separator)}`
    : null;
}

function collectOptionalRequirementLines(context) {
  return [
    context.mapName ? `mapName: ${context.mapName}` : null,
    context.taskTemplateId ? `taskTemplateId: ${context.taskTemplateId}` : null,
    context.generatedMapPath ? `generatedMapPath: ${context.generatedMapPath}` : null,
    context.commentDraftText ? `commentDraftText: ${context.commentDraftText}` : null,
    collectDelimitedContextLine("requiredAbilityGroups", context.requiredAbilityGroups, ", "),
    collectDelimitedContextLine("requiredSteps", context.requiredSteps, ", "),
    collectDelimitedContextLine("redLines", context.redLines, " | "),
    context.rawRequirement ? `rawRequirement:\n${context.rawRequirement}` : null,
    context.safeExecutableRequirement ? `safeExecutableRequirement:\n${context.safeExecutableRequirement}` : null,
  ];
}

function buildRequirementNotes(scenario) {
  const context = scenario.mapRequirement?.authoringContext ?? {};
  const lines = [
    `scenarioId: ${scenario.scenarioId}`,
    `platformId: ${scenario.platformId}`,
    ...collectOptionalRequirementLines(context),
  ];

  return lines.filter(Boolean).join("\n\n");
}

function buildUserRequirementMarkdown(scenario, inputPackage) {
  const context = scenario.mapRequirement?.authoringContext ?? {};
  const lines = [
    "# User Requirement",
    "",
    `- scenarioId: ${scenario.scenarioId}`,
    `- platformId: ${scenario.platformId}`,
    `- goal: ${inputPackage.userRequirement.goal}`,
    "",
    "## Raw Requirement",
    context.rawRequirement ?? scenario.humanGoal ?? "missing",
    "",
    "## Safe Executable Requirement",
    context.safeExecutableRequirement ?? scenario.humanGoal ?? "missing",
    "",
    "## Red Lines",
    ...(Array.isArray(context.redLines) && context.redLines.length > 0 ? context.redLines.map((line) => `- ${line}`) : ["- none"]),
  ];

  return lines.join("\n");
}

function buildAuthoringRequest(scenario) {
  const context = scenario.mapRequirement?.authoringContext ?? {};
  return {
    missionId: `debug-loop:${scenario.scenarioId}`,
    objective: context.safeExecutableRequirement ?? scenario.humanGoal ?? "",
    targetPlatform: scenario.platformId,
    operatorNotes: buildRequirementNotes(scenario),
    outputLanguage: context.outputLanguage ?? "zh-CN",
  };
}

function buildArtifactPaths(artifactDir) {
  return {
    inputPackagePath: path.join(artifactDir, "map-authoring-input-package.json"),
    promptPath: path.join(artifactDir, "map-authoring-prompt.md"),
    promptResponsePath: path.join(artifactDir, "map-authoring-prompt-response.json"),
    userRequirementPath: path.join(artifactDir, "user-requirement.md"),
  };
}

function normalizeFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    status: "blocked",
    decision: /BLOCKED_CAPABILITY_CATALOG_STALE/.test(message)
      ? "BLOCKED_CAPABILITY_CATALOG_STALE"
      : "BLOCKED_AUTHORING_INPUT_INCOMPLETE",
    reason: message,
  };
}

function createMissingArgsResult() {
  return {
    status: "blocked",
    decision: "BLOCKED_AUTHORING_INPUT_INCOMPLETE",
    reason: "scenario and artifactDir are required",
  };
}

async function writeAuthoringArtifacts(paths, scenario, inputPackage, promptResponse) {
  await Promise.all([
    writeJsonFile(paths.inputPackagePath, inputPackage),
    writeTextFile(paths.promptPath, promptResponse.authoringPrompt),
    writeJsonFile(paths.promptResponsePath, promptResponse),
    writeTextFile(paths.userRequirementPath, buildUserRequirementMarkdown(scenario, inputPackage)),
  ]);
}

function buildReadyResult(paths, scenario, inputPackage, promptResponse) {
  return {
    status: "ready",
    inputPackagePath: paths.inputPackagePath,
    promptPath: paths.promptPath,
    promptResponsePath: paths.promptResponsePath,
    userRequirementPath: paths.userRequirementPath,
    promptContractId: promptResponse.promptContractId,
    promptContractVersion: promptResponse.promptContractVersion,
    capabilityCatalogVersion: promptResponse.capabilityCatalogVersion,
    promptCatalogVersion: promptResponse.promptCatalogVersion,
    outputSchemaCatalogVersion: promptResponse.outputSchemaCatalogVersion,
    mapPackageSchemaVersion: promptResponse.mapPackageSchemaVersion,
    outputFormatVersion: promptResponse.outputFormatVersion,
    requiredClarifications: promptResponse.requiredClarifications,
    inputPackageId: inputPackage.inputPackageId,
    sourceRequirementHash: inputPackage.sourceRequirementHash,
    requiredMapPackageSchema: inputPackage.mapPackageSchema,
    safetyPolicyRef: inputPackage.safetyPolicy.policyRef,
    requirementHash: staticHash({
      rawRequirement: scenario.mapRequirement?.authoringContext?.rawRequirement ?? null,
      safeExecutableRequirement: scenario.mapRequirement?.authoringContext?.safeExecutableRequirement ?? scenario.humanGoal ?? null,
    }),
  };
}

async function runMapAuthoringPublicContract(args) {
  const { inputPackage, promptResponse } = buildMapAuthoringPublicContract({
    request: buildAuthoringRequest(args.scenario),
    requesterRef: `debug-loop:${args.scenario.scenarioId}`,
  });
  const paths = buildArtifactPaths(args.artifactDir);

  await writeAuthoringArtifacts(paths, args.scenario, inputPackage, promptResponse);
  return buildReadyResult(paths, args.scenario, inputPackage, promptResponse);
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (!args.scenario || !args.artifactDir) {
    process.stdout.write(`${JSON.stringify(createMissingArgsResult())}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    process.stdout.write(`${JSON.stringify(await runMapAuthoringPublicContract(args))}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify(normalizeFailure(error))}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  await main();
}
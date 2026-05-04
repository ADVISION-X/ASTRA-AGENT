import { createHash } from "node:crypto";
import path from "node:path";

import { buildMapAuthoringInputPackage } from "../../src/map-plugins/authoring/map-authoring-input-package-builder.ts";
import { MapAuthoringRequestSchema } from "../../src/map-plugins/authoring/map-authoring-request.schema.ts";
import { buildMapAuthoringPrompt } from "../../src/map-plugins/authoring/map-authoring-prompt-builder.ts";
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

function buildRequirementNotes(scenario) {
  const context = scenario.mapRequirement?.authoringContext ?? {};
  const lines = [
    `scenarioId: ${scenario.scenarioId}`,
    `platformId: ${scenario.platformId}`,
    context.mapName ? `mapName: ${context.mapName}` : null,
    context.taskTemplateId ? `taskTemplateId: ${context.taskTemplateId}` : null,
    context.generatedMapPath ? `generatedMapPath: ${context.generatedMapPath}` : null,
    context.commentDraftText ? `commentDraftText: ${context.commentDraftText}` : null,
    Array.isArray(context.requiredAbilityGroups) && context.requiredAbilityGroups.length > 0
      ? `requiredAbilityGroups: ${context.requiredAbilityGroups.join(", ")}`
      : null,
    Array.isArray(context.requiredSteps) && context.requiredSteps.length > 0
      ? `requiredSteps: ${context.requiredSteps.join(", ")}`
      : null,
    Array.isArray(context.redLines) && context.redLines.length > 0
      ? `redLines: ${context.redLines.join(" | ")}`
      : null,
    context.rawRequirement ? `rawRequirement:\n${context.rawRequirement}` : null,
    context.safeExecutableRequirement ? `safeExecutableRequirement:\n${context.safeExecutableRequirement}` : null,
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
  return MapAuthoringRequestSchema.parse({
    missionId: `debug-loop:${scenario.scenarioId}`,
    objective: context.safeExecutableRequirement ?? scenario.humanGoal ?? "",
    targetPlatform: scenario.platformId,
    operatorNotes: buildRequirementNotes(scenario),
    outputLanguage: context.outputLanguage ?? "zh-CN",
  });
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

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (!args.scenario || !args.artifactDir) {
    process.stdout.write(`${JSON.stringify({ status: "blocked", decision: "BLOCKED_AUTHORING_INPUT_INCOMPLETE", reason: "scenario and artifactDir are required" })}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    const request = buildAuthoringRequest(args.scenario);
    const inputPackage = buildMapAuthoringInputPackage(request, {
      requesterRef: `debug-loop:${args.scenario.scenarioId}`,
    });
    const promptResponse = buildMapAuthoringPrompt(inputPackage);
    const paths = buildArtifactPaths(args.artifactDir);

    await Promise.all([
      writeJsonFile(paths.inputPackagePath, inputPackage),
      writeTextFile(paths.promptPath, promptResponse.authoringPrompt),
      writeJsonFile(paths.promptResponsePath, promptResponse),
      writeTextFile(paths.userRequirementPath, buildUserRequirementMarkdown(args.scenario, inputPackage)),
    ]);

    process.stdout.write(`${JSON.stringify({
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
        rawRequirement: args.scenario.mapRequirement?.authoringContext?.rawRequirement ?? null,
        safeExecutableRequirement: args.scenario.mapRequirement?.authoringContext?.safeExecutableRequirement ?? args.scenario.humanGoal ?? null,
      }),
    })}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify(normalizeFailure(error))}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  await main();
}
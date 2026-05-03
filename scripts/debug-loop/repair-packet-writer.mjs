import path from "node:path";

import { writeJsonFile, writeTextFile } from "./json-utils.mjs";

const DEFAULT_FORBIDDEN_ACTIONS = [
  "Only modify allowedModify paths.",
  "Do not modify forbiddenModify paths.",
  "Do not downgrade laws.",
  "Do not disable inspectors.",
  "Do not remove negative proof.",
  "Do not hand-edit generated files to fake PASS.",
];

function buildRepairPacket(input) {
  return {
    debugSessionId: input.debugSessionId,
    iteration: input.iteration,
    scenarioId: input.scenarioId,
    failureCategory: input.classification.failureCategory,
    owner: input.route.owner,
    severity: input.classification.severity,
    firstFatal: input.classification.firstFatal,
    evidenceRefs: input.classification.evidenceRefs,
    rootCause: input.classification.rootCause,
    allowedModify: input.route.allowedModify,
    forbiddenModify: input.route.forbiddenModify,
    requiredFix: input.requiredFix ?? [input.classification.rootCause],
    requiredCommands: input.requiredCommands ?? [],
    stopRule: input.stopRule ?? "debug:loop PASS + CI FULL PASS",
  };
}

function renderSection(title, values) {
  if (Array.isArray(values)) {
    const lines = values.length === 0 ? ["- none"] : values.map((value) => `- ${value}`);
    return [`## ${title}`, ...lines].join("\n");
  }

  return [`## ${title}`, values ?? "- none"].join("\n");
}

function buildRepairPacketMarkdown(packet) {
  return [
    "# Repair Packet",
    renderSection("Debug Session", `${packet.debugSessionId} / iteration ${packet.iteration}`),
    renderSection("Scenario", packet.scenarioId),
    renderSection("Failure Category", packet.failureCategory),
    renderSection("Owner", packet.owner),
    renderSection("Evidence", packet.evidenceRefs),
    renderSection("Root Cause", packet.rootCause),
    renderSection("Allowed Modify", packet.allowedModify),
    renderSection("Forbidden Modify", packet.forbiddenModify),
    renderSection("Required Fix", packet.requiredFix),
    renderSection("Required Commands", packet.requiredCommands),
    renderSection("Stop Rule", packet.stopRule),
    renderSection("Forbidden Actions", DEFAULT_FORBIDDEN_ACTIONS),
    "",
  ].join("\n\n");
}

export async function writeRepairPacket(input) {
  const packet = buildRepairPacket(input);
  const jsonPath = path.join(input.iterationDir, "repair-packet.json");
  const markdownPath = path.join(input.iterationDir, "repair-packet.md");

  await writeJsonFile(jsonPath, packet);
  await writeTextFile(markdownPath, buildRepairPacketMarkdown(packet));

  return {
    packet,
    jsonPath,
    markdownPath,
  };
}
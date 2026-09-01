import { createHash } from "node:crypto";

import type { ForensicsPersistenceAbilityGroup } from "../../../capabilities/forensics-persistence/index.js";
import { executionFailure } from "../../typed-failure.js";
import { gptSubmissionLocatorArtifact } from "./gpt-artifact-contract.js";
import {
  readGeneratedImageArtifacts,
  type GeneratedImageCheckpointArtifacts,
} from "./gpt-generated-image-artifact-reader.js";

const objectRecord = (value: unknown): Readonly<Record<string, unknown>> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>> : null;

const hash = (content: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(content).digest("hex")}`;

const readJsonArtifact = async (
  evidenceStore: ForensicsPersistenceAbilityGroup,
  artifactRef: string,
  readbackCode: string,
  invalidCode: string,
): Promise<Readonly<Record<string, unknown>>> => {
  const readback = await evidenceStore.readArtifactRef({
    childCapabilityId: "read-artifact-ref", artifactRef,
  });
  if (readback.status !== "success" || !readback.artifact?.content
    || readback.artifact.mimeType !== "application/json") {
    throw executionFailure("failed", readbackCode);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(readback.artifact.content)) as unknown; }
  catch (cause) { throw executionFailure("failed", invalidCode, { cause }); }
  const value = objectRecord(parsed);
  if (!value) throw executionFailure("failed", invalidCode);
  return value;
};

export const readTextCheckpointArtifact = async (
  evidenceStore: ForensicsPersistenceAbilityGroup,
  artifactRef: string,
): Promise<Readonly<Record<string, unknown>>> => {
  const row = await readJsonArtifact(
    evidenceStore, artifactRef,
    "GPT_TEXT_TASK_ARTIFACT_READBACK_FAILED", "GPT_TEXT_TASK_ARTIFACT_INVALID",
  );
  const rawDomHtml = row.rawDomHtml;
  const rawDomHash = row.rawDomHash;
  const semanticText = row.semanticText;
  const semanticTextHash = row.semanticTextHash;
  if (row.schemaVersion !== "agent-observed-response-artifact.v1"
    || typeof row.assistantTurnId !== "string" || !row.assistantTurnId
    || typeof rawDomHtml !== "string" || !rawDomHtml
    || typeof rawDomHash !== "string" || hash(rawDomHtml) !== rawDomHash
    || typeof semanticText !== "string" || !semanticText.trim()
    || typeof semanticTextHash !== "string" || hash(semanticText) !== semanticTextHash) {
    throw executionFailure("failed", "GPT_TEXT_TASK_ARTIFACT_INVALID");
  }
  return Object.freeze({
    assistantTurnId: row.assistantTurnId, rawDomHtml, rawDomHash, semanticText, semanticTextHash,
  });
};

export const readSubmissionLocatorArtifact = async (
  evidenceStore: ForensicsPersistenceAbilityGroup,
  artifactRef: string,
): Promise<Readonly<Record<string, unknown>>> => {
  const row = await readJsonArtifact(
    evidenceStore, artifactRef,
    "GPT_SUBMISSION_LOCATOR_TASK_ARTIFACT_READBACK_FAILED",
    "GPT_SUBMISSION_LOCATOR_TASK_ARTIFACT_INVALID",
  );
  const locator = gptSubmissionLocatorArtifact(row, hash);
  if (!locator) {
    throw executionFailure("failed", "GPT_SUBMISSION_LOCATOR_TASK_ARTIFACT_INVALID");
  }
  return locator;
};

export const readGeneratedImageCheckpointArtifacts = async (
  evidenceStore: ForensicsPersistenceAbilityGroup,
  artifactRefs: readonly string[],
): Promise<GeneratedImageCheckpointArtifacts> => {
  if (artifactRefs.length !== 3) {
    throw executionFailure("failed", "GPT_GENERATED_IMAGE_TASK_ARTIFACT_MISSING");
  }
  const exactArtifactRefs: readonly [string, string, string] = [
    artifactRefs[0]!, artifactRefs[1]!, artifactRefs[2]!,
  ];
  return readGeneratedImageArtifacts({
    evidenceStore,
    artifactRefs: exactArtifactRefs,
    receipt: await readJsonArtifact(
      evidenceStore, exactArtifactRefs[2],
      "GPT_GENERATED_IMAGE_RECEIPT_READBACK_FAILED", "GPT_GENERATED_IMAGE_RECEIPT_INVALID",
    ),
  });
};

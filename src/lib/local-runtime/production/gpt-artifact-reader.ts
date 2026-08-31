import { createHash } from "node:crypto";

import type { ForensicsPersistenceAbilityGroup } from "../../../capabilities/forensics-persistence/index.js";
import { executionFailure } from "../../typed-failure.js";

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
  try {
    const value = objectRecord(JSON.parse(new TextDecoder().decode(readback.artifact.content)) as unknown);
    if (value) return value;
  } catch { /* normalized below */ }
  throw executionFailure("failed", invalidCode);
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
  const canonicalConversationUrl = row.canonicalConversationUrl;
  const turnMarker = row.turnMarker;
  const userTurnId = row.userTurnId;
  const promptHash = row.promptHash;
  const conversationIdentityHash = row.conversationIdentityHash;
  let canonicalUrl = false;
  try {
    const parsed = new URL(String(canonicalConversationUrl));
    canonicalUrl = parsed.origin === "https://chatgpt.com"
      && /^\/c\/[A-Za-z0-9_-]+$/u.test(parsed.pathname)
      && !parsed.search && !parsed.hash && parsed.toString() === canonicalConversationUrl;
  } catch { canonicalUrl = false; }
  if (row.schemaVersion !== "agent-gpt-submission-locator.v1" || !canonicalUrl
    || typeof turnMarker !== "string" || !turnMarker
    || typeof userTurnId !== "string" || !/^conversation-turn-[1-9][0-9]*$/u.test(userTurnId)
    || typeof promptHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(promptHash)
    || typeof conversationIdentityHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(conversationIdentityHash)
    || hash(`${canonicalConversationUrl}\n${turnMarker}\n${userTurnId}\n${promptHash}`) !== conversationIdentityHash) {
    throw executionFailure("failed", "GPT_SUBMISSION_LOCATOR_TASK_ARTIFACT_INVALID");
  }
  return Object.freeze({ canonicalConversationUrl, turnMarker, userTurnId, promptHash, conversationIdentityHash });
};

import { createHash } from "node:crypto";

import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  ProviderExecutionProfileProof,
} from "../contracts/ai-provider-adapter.contract.js";
import {
  assertProviderExecutionProfileIntegrity,
  legacyReasoningEffortForProof,
} from "../provider-execution-profile.js";
import type { AiFeedInput, GptWebReasoningTier } from "../schema.js";
import {
  assertStableWebChatDocument,
  recordWebChatPageAction,
} from "./web-chat-page-action-contract.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const reasoningLabels: Readonly<Record<GptWebReasoningTier, readonly string[]>> = {
  medium: ["中", "Medium"],
  high: ["高", "High"],
  extra_high: ["极高", "Extra high", "Extra High", "xhigh"],
  pro_standard: ["Pro", "Pro Standard"],
  pro_extended: ["Pro Extended", "Extended Pro"],
};

export const GPT_WEB_MODEL_MENU_CONTROL_SCRIPT = `
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none"
    && style.visibility !== "hidden" && Number(style.opacity || "1") > 0;
};
const normalize = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const knownReasoning = ${JSON.stringify(Object.values(reasoningLabels).flat().map((value) => value.toLowerCase()))};
const candidates = Array.from(document.querySelectorAll("main button"))
  .filter(visible)
  .filter((node) => {
    const text = normalize(node.textContent).toLowerCase();
    const testId = normalize(node.getAttribute("data-testid")).toLowerCase();
    const aria = normalize(node.getAttribute("aria-label")).toLowerCase();
    return testId.includes("model") || aria.includes("model") || aria.includes("reasoning")
      || knownReasoning.includes(text);
  });
if (candidates.length !== 1) return {
  status: candidates.length === 0 ? "pending" : "review_required",
  count: candidates.length,
  semantics: candidates.map((node) => normalize(node.textContent || node.getAttribute("aria-label"))).slice(0, 8),
};
const rect = candidates[0].getBoundingClientRect();
return {
  status: "success",
  count: 1,
  semantics: [normalize(candidates[0].textContent || candidates[0].getAttribute("aria-label"))],
  point: {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2},
};
`;

type MenuControl = {
  status: "success" | "pending" | "review_required";
  count: number;
  semantics: string[];
  point?: { x: number; y: number };
};

type ProfileObservation = {
  pageUrl: string;
  modelSelected: string | null;
  reasoningSelected: string | null;
  modelCandidateCount: number;
  reasoningCandidateCount: number;
  modelTargetPoint?: { x: number; y: number };
  reasoningTargetPoint?: { x: number; y: number };
  semantics: string[];
};

type ExecutionProfileInput = {
  browser: BrowserTargetSession;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  providerUrl: string;
};
type RequiredProfile = NonNullable<AiFeedInput["providerExecutionProfile"]>;

const buildProfileObservationScript = (input: {
  modelDisplayName: string;
  reasoningTier: GptWebReasoningTier;
}): string => `
const expectedModel = ${JSON.stringify(input.modelDisplayName)};
const expectedReasoningLabels = ${JSON.stringify(reasoningLabels[input.reasoningTier])};
const allReasoningLabels = ${JSON.stringify(reasoningLabels)};
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none"
    && style.visibility !== "hidden" && Number(style.opacity || "1") > 0;
};
const normalized = (value) => String(value || "").replace(/\\s+/gu, " ").trim();
const equalsAny = (value, labels) => labels.some((label) => normalized(value).toLowerCase() === label.toLowerCase());
const candidates = Array.from(document.querySelectorAll("[role='menuitem'],[role='option'],[role='menuitemradio'],button"))
  .filter(visible);
const selected = (node) => node.getAttribute("aria-checked") === "true"
  || node.getAttribute("aria-selected") === "true"
  || node.getAttribute("data-state") === "checked"
  || node.getAttribute("data-selected") === "true";
const modelNodes = candidates.filter((node) => normalized(node.textContent) === expectedModel);
const reasoningNodes = candidates.filter((node) => equalsAny(node.textContent, expectedReasoningLabels));
const selectedModel = candidates.find((node) => selected(node) && normalized(node.textContent) === expectedModel)
  || Array.from(document.querySelectorAll("main button")).filter(visible)
    .find((node) => normalized(node.textContent).includes(expectedModel));
let selectedReasoning = null;
for (const [tier, labels] of Object.entries(allReasoningLabels)) {
  const node = candidates.find((candidate) => selected(candidate) && equalsAny(candidate.textContent, labels))
    || Array.from(document.querySelectorAll("main button")).filter(visible)
      .find((candidate) => equalsAny(candidate.textContent, labels));
  if (node) { selectedReasoning = tier; break; }
}
const point = (node) => {
  if (!node) return undefined;
  const rect = node.getBoundingClientRect();
  return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2};
};
return {
  pageUrl: location.href,
  modelSelected: selectedModel ? expectedModel : null,
  reasoningSelected: selectedReasoning,
  modelCandidateCount: modelNodes.length,
  reasoningCandidateCount: reasoningNodes.length,
  modelTargetPoint: point(modelNodes[0]),
  reasoningTargetPoint: point(reasoningNodes[0]),
  semantics: candidates.map((node) => normalized(node.textContent)).filter(Boolean).slice(0, 30),
};
`;

const openProfileMenu = async (input: {
  browser: BrowserTargetSession;
  context: AiProviderAdapterContext;
}): Promise<void> => {
  const observed = await input.browser.evaluate<MenuControl>({
    description: "locate unique ChatGPT execution-profile menu control",
    script: GPT_WEB_MODEL_MENU_CONTROL_SCRIPT,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  if (observed.status === "review_required") {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_MENU_AMBIGUOUS");
  }
  if (observed.status !== "success" || !observed.point) {
    throw new Error("GPT_WEB_EXECUTION_PROFILE_MENU_NOT_READY");
  }
  const clicked = await input.browser.click({
    targetLabel: "open ChatGPT execution-profile menu",
    point: observed.point,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  if (!clicked.ok) throw new Error("GPT_WEB_EXECUTION_PROFILE_MENU_NOT_READY");
  await input.browser.wait(200);
};

const closeProfileMenu = async (
  browser: BrowserTargetSession,
  context: AiProviderAdapterContext,
): Promise<void> => {
  await browser.textInput({
    targetLabel: "close ChatGPT execution-profile menu",
    action: "press-key",
    key: "Escape",
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });
};

const observeProfile = (
  browser: BrowserTargetSession,
  context: AiProviderAdapterContext,
  request: AiFeedInput,
): Promise<ProfileObservation> => browser.evaluate<ProfileObservation>({
  description: "observe semantic ChatGPT model and reasoning profile",
  script: buildProfileObservationScript({
    modelDisplayName: request.providerExecutionProfile!.modelDisplayName,
    reasoningTier: request.providerExecutionProfile!.reasoningTier,
  }),
  ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
});

const clickProfileTarget = async (input: {
  browser: BrowserTargetSession;
  point: { x: number; y: number } | undefined;
  label: string;
}): Promise<void> => {
  if (!input.point) throw new Error(`review_required: ${input.label} is unavailable`);
  const result = await input.browser.click({
    targetLabel: input.label,
    point: input.point,
  });
  if (!result.ok) throw new Error(`review_required: ${input.label} could not be selected`);
  await input.browser.wait(200);
};

const applyRequiredProfile = async (
  input: ExecutionProfileInput,
  profile: RequiredProfile,
  initial: ProfileObservation,
): Promise<{ changed: boolean; observation: ProfileObservation }> => {
  let observation = initial;
  let changed = false;
  if (observation.modelSelected !== profile.modelDisplayName) {
    if (observation.modelCandidateCount !== 1) {
      throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_MODEL_UNAVAILABLE_OR_AMBIGUOUS");
    }
    await clickProfileTarget({ browser: input.browser, point: observation.modelTargetPoint,
      label: `select exact ChatGPT model ${profile.modelDisplayName}` });
    changed = true;
    await closeProfileMenu(input.browser, input.context);
    await openProfileMenu(input);
    observation = await observeProfile(input.browser, input.context, input.request);
  }
  if (observation.reasoningSelected !== profile.reasoningTier) {
    if (observation.reasoningCandidateCount !== 1) {
      throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_REASONING_UNAVAILABLE_OR_AMBIGUOUS");
    }
    await clickProfileTarget({ browser: input.browser, point: observation.reasoningTargetPoint,
      label: `select exact ChatGPT reasoning tier ${profile.reasoningTier}` });
    changed = true;
    await closeProfileMenu(input.browser, input.context);
    await openProfileMenu(input);
    observation = await observeProfile(input.browser, input.context, input.request);
  }
  return { changed, observation };
};

const buildExecutionProfileProof = (
  profile: RequiredProfile,
  observation: ProfileObservation,
  changed: boolean,
): ProviderExecutionProfileProof => {
  const observedAt = new Date().toISOString();
  const evidenceHash = hash(JSON.stringify({
    profileRef: profile.profileRef, profileHash: profile.profileHash,
    provider: profile.provider, transport: profile.transport,
    modelDisplayName: profile.modelDisplayName, modelFamily: profile.modelFamily,
    reasoningTier: profile.reasoningTier, pageUrl: observation.pageUrl, changed, observedAt,
  }));
  return {
    proofStatus: "verified", profileRef: profile.profileRef, profileHash: profile.profileHash,
    provider: profile.provider, transport: profile.transport, modelDisplayName: profile.modelDisplayName,
    modelFamily: profile.modelFamily, reasoningTier: profile.reasoningTier,
    legacyReasoningEffort: legacyReasoningEffortForProof(profile.reasoningTier), observedAt,
    sourceKind: "provider_ui_observation", noOp: !changed,
    evidenceRef: `provider-execution-profile:${evidenceHash.slice(7)}`, evidenceHash,
  };
};

const persistProfileProof = async (input: {
  source: ExecutionProfileInput;
  profile: RequiredProfile;
  proof: ProviderExecutionProfileProof;
  observation: ProfileObservation;
  changed: boolean;
  startedAt: string;
  beforeUrl: string;
}): Promise<void> => {
  await input.source.context.webChatExecution?.onProviderExecutionProfileVerified(input.proof);
  await recordWebChatPageAction({
    browser: input.source.browser, context: input.source.context,
    actionId: input.changed ? "apply_execution_profile" : "observe_execution_profile",
    startedAt: input.startedAt, beforeUrl: input.beforeUrl, afterUrl: input.observation.pageUrl,
    result: input.changed ? "committed" : "no_op",
    candidateCount: input.observation.modelCandidateCount + input.observation.reasoningCandidateCount,
    semantics: [input.profile.modelDisplayName, input.profile.reasoningTier],
  });
};

export const enforceGptWebExecutionProfile = async (input: ExecutionProfileInput): Promise<ProviderExecutionProfileProof | null> => {
  const profile = input.request.providerExecutionProfile;
  if (input.request.providerKind !== "gpt-web-chat" || !profile) return null;
  assertProviderExecutionProfileIntegrity(profile);
  const providerOrigin = new URL(input.providerUrl).origin;
  const start = new Date().toISOString();
  const beforeUrl = input.browser.getTarget?.()?.url ?? input.providerUrl;
  const documentRef = input.browser.getTarget?.()?.documentRef ?? null;
  await openProfileMenu(input);
  const initialObservation = await observeProfile(input.browser, input.context, input.request);
  if (new URL(initialObservation.pageUrl).origin !== providerOrigin) {
    throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_WRONG_PROVIDER_PAGE");
  }
  try {
    const { changed, observation } = await applyRequiredProfile(input, profile, initialObservation);
    if (
      observation.modelSelected !== profile.modelDisplayName
      || observation.reasoningSelected !== profile.reasoningTier
    ) {
      throw new Error("review_required: GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH");
    }
    assertStableWebChatDocument({
      browser: input.browser,
      expectedDocumentRef: documentRef,
      actionId: "verify_execution_profile",
    });
    const proof = buildExecutionProfileProof(profile, observation, changed);
    await persistProfileProof({ source: input, profile, proof, observation, changed, startedAt: start, beforeUrl });
    return proof;
  } finally {
    await closeProfileMenu(input.browser, input.context).catch(() => undefined);
  }
};

import { createHash } from "node:crypto";

import type {
  AiProviderRawResponse,
} from "../contracts/ai-provider-adapter.contract.js";
import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";

type ModelIdentityObservation = {
  readonly modelFamily: string;
  readonly modelDisplayName: string;
  readonly reasoningEffort: string;
  readonly controls: readonly {
    readonly kind: "model" | "reasoning";
    readonly text: string;
    readonly selector: string;
  }[];
  readonly pageUrl: string;
};

type RequestedReasoningEffort = "high" | "xhigh" | "pro";

const reasoningSliderIndex: Readonly<Record<RequestedReasoningEffort, number>> = {
  high: 2,
  xhigh: 3,
  pro: 4,
};

const EXPECTED_MODEL_DISPLAY_NAME = "GPT-5.6 Sol";
const OBSERVED_REASONING_LABELS = ["极速", "中", "高", "极高", "Pro"] as const;
const MODEL_SLIDER_SELECTOR = "data-model-reasoning-effort-slider";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const observeProviderControls = async (
  browser: BrowserTargetSession,
): Promise<ModelIdentityObservation> => browser.evaluate<ModelIdentityObservation>({
  description: "observe visible provider model and reasoning controls",
  script: `
const visible = (element) => {
  const style = window.getComputedStyle(element);
  const box = element.getBoundingClientRect();
  return style.visibility !== "hidden" && style.display !== "none" && box.width > 0 && box.height > 0;
};
const controls = Array.from(document.querySelectorAll("button,[role='button'],[role='menuitem']"))
  .filter(visible)
  .map((element) => {
    const text = (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim();
    const testId = element.getAttribute("data-testid") || "";
    const aria = element.getAttribute("aria-label") || "";
    return { element, text, attributes: (testId + " " + aria).toLowerCase(), selector: testId || aria || element.tagName.toLowerCase() };
  })
  .filter((entry) => entry.text.length > 0);
const modelControls = controls.filter((entry) =>
  /\\bgpt-\\d+(?:\\.\\d+){0,2}\\b/i.test(entry.text)
  || /model|model-switcher|model_selector/i.test(entry.attributes));
const reasoningControls = controls.filter((entry) =>
  /reasoning|thinking|effort/i.test(entry.attributes)
  || /\\b(?:xhigh|extra high|high|medium|low|pro)\\b/i.test(entry.text)
  || /(?:极速|中|高|极高)/u.test(entry.text));
const model = modelControls.find((entry) => /\\bgpt-\\d+/i.test(entry.text));
const modelFamily = model?.text.match(/\\bgpt-\\d+(?:\\.\\d+){0,2}\\b/i)?.[0]?.toLowerCase() || "";
const modelDisplayName = model?.text.match(/\\bgpt-\\d+(?:\\.\\d+){0,2}(?:\\s+[A-Za-z0-9.+-]+)+/i)?.[0] || "";
const reasoning = reasoningControls.find((entry) =>
  /\\b(?:xhigh|extra high|high|medium|low|pro)\\b/i.test(entry.text)
  || /(?:极速|中|高|极高)/u.test(entry.text));
const rawReasoning = reasoning?.text.match(/\\b(?:xhigh|extra high|high|medium|low|pro)\\b/i)?.[0]?.toLowerCase()
  || reasoning?.text.match(/极速|中|高|极高/u)?.[0]
  || "";
const reasoningEffort = ({ 极速: "fast", 中: "medium", 高: "high", 极高: "xhigh", pro: "pro", xhigh: "xhigh", high: "high", medium: "medium", low: "low", "extra high": "xhigh" })[rawReasoning] || rawReasoning;
return {
  modelFamily,
  modelDisplayName,
  reasoningEffort,
  controls: [
    ...(model ? [{ kind: "model", text: model.text, selector: model.selector }] : []),
    ...(reasoning ? [{ kind: "reasoning", text: reasoning.text, selector: reasoning.selector }] : []),
  ],
  pageUrl: location.href,
};
`,
});

const openModelMenu = async (browser: BrowserTargetSession): Promise<void> => {
  const target = await browser.evaluate<{ x: number; y: number } | null>({
    description: "locate the visible GPT model menu control",
    script: `
const button = Array.from(document.querySelectorAll("main button"))
  .find((element) => /^(?:Pro|极速|中|高|极高)$/u.test((element.innerText || element.textContent || "").trim()));
if (!button) return null;
const box = button.getBoundingClientRect();
return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
`,
  });
  if (!target) throw new Error("review_required: provider model menu control is not visible");
  const clicked = await browser.click({
    targetLabel: "GPT model menu control",
    point: target,
  });
  if (!clicked.ok) throw new Error("review_required: provider model menu could not be opened");
  await browser.wait(250);
};

const selectWebChatModel = async (
  browser: BrowserTargetSession,
): Promise<void> => {
  const target = await browser.evaluate<{ x: number; y: number } | null>({
    description: "locate the visible GPT-5.6 Sol model option",
    script: `
const option = Array.from(document.querySelectorAll("[role='menuitem'],button,[role='option']"))
  .find((element) => {
    const style = window.getComputedStyle(element);
    const box = element.getBoundingClientRect();
    const text = (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim();
    return style.visibility !== "hidden" && style.display !== "none" && box.width > 0 && box.height > 0
      && text.includes("GPT-5.6 Sol");
  });
if (!option) return null;
const box = option.getBoundingClientRect();
return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
`,
  });
  if (!target) throw new Error("review_required: GPT-5.6 Sol model option is not visible");
  const clicked = await browser.click({
    targetLabel: "select GPT-5.6 Sol model option",
    point: target,
  });
  if (!clicked.ok) throw new Error("review_required: GPT-5.6 Sol model option could not be selected");
  await browser.wait(250);
  const selected = await observeProviderControls(browser);
  if (selected.modelDisplayName !== EXPECTED_MODEL_DISPLAY_NAME) {
    throw new Error("review_required: GPT-5.6 Sol selection was not visibly confirmed");
  }
};

export const selectWebChatModelAndReasoning = async (input: {
  readonly browser: BrowserTargetSession;
  readonly providerUrl: string;
  readonly requestedReasoningEffort: RequestedReasoningEffort;
}): Promise<NonNullable<AiProviderRawResponse["modelIdentityProof"]>> => {
  await openModelMenu(input.browser);
  try {
    await selectWebChatModel(input.browser);
  } finally {
    await input.browser.textInput({
      targetLabel: "close GPT model menu after model selection",
      action: "press-key",
      key: "Escape",
    });
  }
  await selectWebChatReasoningEffort(input);
  const proof = await captureWebChatModelIdentity({
    browser: input.browser,
    providerUrl: input.providerUrl,
  });
  if (proof.modelDisplayName !== EXPECTED_MODEL_DISPLAY_NAME
    || proof.reasoningEffort !== input.requestedReasoningEffort) {
    throw new Error("review_required: GPT Web model and reasoning read-back did not match before submit");
  }
  return proof;
};

export const selectWebChatReasoningEffort = async (input: {
  readonly browser: BrowserTargetSession;
  readonly requestedReasoningEffort: RequestedReasoningEffort;
}): Promise<void> => {
  await openModelMenu(input.browser);
  try {
    const slider = await input.browser.evaluate<{ left: number; width: number; top: number; height: number } | null>({
      description: "locate the GPT reasoning strength slider",
      script: `
const slider = document.querySelector('[${MODEL_SLIDER_SELECTOR}]');
if (!slider) return null;
const box = slider.getBoundingClientRect();
return { left: box.left, width: box.width, top: box.top, height: box.height };
`,
    });
    if (!slider) throw new Error("review_required: GPT reasoning strength slider is not visible");
    const targetIndex = reasoningSliderIndex[input.requestedReasoningEffort];
    const clicked = await input.browser.click({
      targetLabel: `set GPT reasoning strength to ${input.requestedReasoningEffort}`,
      point: {
        x: slider.left + (slider.width * targetIndex) / 4,
        y: slider.top + slider.height / 2,
      },
    });
    if (!clicked.ok) throw new Error("review_required: GPT reasoning strength could not be selected");
    await input.browser.wait(250);
    const selected = await observeProviderControls(input.browser);
    if (selected.reasoningEffort !== input.requestedReasoningEffort) {
      throw new Error("review_required: GPT reasoning strength selection was not visibly confirmed");
    }
  } finally {
    await input.browser.textInput({
      targetLabel: "close GPT model menu after reasoning selection",
      action: "press-key",
      key: "Escape",
    });
  }
};

export const captureWebChatModelIdentity = async (input: {
  readonly browser: BrowserTargetSession;
  readonly providerUrl: string;
}): Promise<NonNullable<AiProviderRawResponse["modelIdentityProof"]>> => {
  let observed = await observeProviderControls(input.browser);
  if (!observed.modelFamily || !observed.reasoningEffort) {
    await openModelMenu(input.browser);
    try {
      observed = await observeProviderControls(input.browser);
    } finally {
      await input.browser.textInput({
        targetLabel: "close GPT model menu after identity observation",
        action: "press-key",
        key: "Escape",
      });
    }
  }
  const providerOrigin = new URL(input.providerUrl).origin;
  if (new URL(observed.pageUrl).origin !== providerOrigin) {
    throw new Error("review_required: provider model identity was observed on the wrong page");
  }
  if (!observed.modelFamily || !observed.modelDisplayName || !observed.reasoningEffort) {
    throw new Error("review_required: provider UI did not expose an unambiguous model identity and reasoning control");
  }
  if (observed.modelDisplayName !== EXPECTED_MODEL_DISPLAY_NAME
    || !OBSERVED_REASONING_LABELS.some((label) => observed.controls.some((control) => control.text.includes(label)))) {
    throw new Error("review_required: provider UI model or reasoning label does not match the frozen GPT Web contract");
  }
  const evidence = JSON.stringify({
    sourceKind: "provider_ui_observation",
    pageUrl: observed.pageUrl,
    modelFamily: observed.modelFamily,
    modelDisplayName: observed.modelDisplayName,
    reasoningEffort: observed.reasoningEffort,
    controls: observed.controls,
  });
  const evidenceHash = hash(evidence);
  return {
    proofStatus: "verified",
    modelFamily: observed.modelFamily,
    modelDisplayName: observed.modelDisplayName,
    modelIdentityStatus: "verified",
    reasoningEffort: observed.reasoningEffort,
    observedAt: new Date().toISOString(),
    sourceKind: "provider_ui_observation",
    evidenceRef: `provider-ui-observation:${evidenceHash.slice(7)}`,
    evidenceHash,
  };
};

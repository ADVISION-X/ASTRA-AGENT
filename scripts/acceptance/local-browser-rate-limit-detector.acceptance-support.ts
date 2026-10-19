import { createHash, webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";

import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { KNOWN_GPT_RATE_LIMIT_DETECTOR } from
  "../../src/lib/browser/chrome-extension/gpt-rate-limit-dialog.js";
import {
  KNOWN_GPT_RATE_LIMIT_ACK,
  KNOWN_GPT_RATE_LIMIT_ACK_HASH,
  KNOWN_GPT_RATE_LIMIT_BODY,
  KNOWN_GPT_RATE_LIMIT_BODY_HASH,
  KNOWN_GPT_RATE_LIMIT_DIALOG_HASH,
  KNOWN_GPT_RATE_LIMIT_TITLE,
  KNOWN_GPT_RATE_LIMIT_TITLE_HASH,
  type KnownGptRateLimitPreflightFact,
} from "../../src/lib/browser/exact-target/browser-gpt-rate-limit-preflight.js";
import { knownGptRateLimitPreflightFactValid } from
  "../../src/lib/browser/exact-target/browser-special-mutation-receipt.js";

export const rateLimitDetectorCdpResult = (
  parameters: Readonly<Record<string, unknown>> | undefined,
  detectorState: Readonly<Record<string, unknown>>,
  startedAt: number[],
) => {
  startedAt.push(performance.now());
  const expression = String(parameters?.expression);
  const start = expression.lastIndexOf(").call(document, ") + ").call(document, ".length;
  const expected = JSON.parse(expression.slice(start, expression.indexOf(") }; }", start))) as Record<string, unknown>;
  const state = detectorState.state;
  const exact = state === "exact_present";
  const mismatch = state === "mismatch";
  const unsigned = {
    schemaVersion: "grasseye.browser.known-gpt-rate-limit-preflight.v2", state,
    dialogHash: expected.dialogHash, titleHash: expected.titleHash, bodyHash: expected.bodyHash,
    acknowledgementHash: expected.acknowledgementHash,
    exactCallIdentityHash: expected.exactCallIdentityHash,
    targetRefHash: expected.targetRefHash, documentRefHash: expected.documentRefHash,
    observedAt: typeof detectorState.observedAt === "string"
      ? detectorState.observedAt : new Date().toISOString(),
    dialogRawCount: exact || mismatch ? 1 : 0,
    dialogEligibleCount: exact || mismatch ? 1 : 0,
    dialogActionableCount: exact ? 1 : 0,
    acknowledgementButtonRawCount: exact || mismatch ? 1 : 0,
    acknowledgementButtonEligibleCount: exact || mismatch ? 1 : 0,
    acknowledgementButtonActionableCount: exact || mismatch ? 1 : 0,
  };
  const hashInput = [unsigned.schemaVersion, unsigned.state, unsigned.dialogHash,
    unsigned.titleHash, unsigned.bodyHash, unsigned.acknowledgementHash,
    unsigned.exactCallIdentityHash, unsigned.targetRefHash, unsigned.documentRefHash,
    unsigned.observedAt, unsigned.dialogRawCount, unsigned.dialogEligibleCount,
    unsigned.dialogActionableCount, unsigned.acknowledgementButtonRawCount,
    unsigned.acknowledgementButtonEligibleCount,
    unsigned.acknowledgementButtonActionableCount];
  return { result: { value: { kind: "value", value: { ...unsigned,
    observationHash: `sha256:${createHash("sha256").update(JSON.stringify(hashInput)).digest("hex")}` } } } };
};

class FakeNode {}

class FakeElement extends FakeNode {
  public isConnected = true;
  public hidden = false;
  public disabled = false;
  public textContent: string;
  public readonly attributes = new Map<string, string>();
  public readonly style = {
    display: "block", visibility: "visible", opacity: "1", pointerEvents: "auto",
  };

  public constructor(
    public innerText: string,
    public readonly buttons: FakeElement[] = [],
  ) {
    super();
    this.textContent = innerText;
  }

  public getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  public closest(selector: string): FakeElement | null {
    return selector === "[inert]" && this.attributes.has("inert") ? this : null;
  }
  public getClientRects(): readonly object[] { return [{}]; }
  public getBoundingClientRect() {
    return { left: 10, top: 10, right: 30, bottom: 30, width: 20, height: 20 };
  }
  public querySelectorAll(selector: string): readonly FakeElement[] {
    return selector === "button" ? this.buttons : [];
  }
  public contains(node: FakeNode): boolean { return this === node || this.buttons.includes(node as FakeElement); }
}

const expected = Object.freeze({
  dialogSelector: "[role='dialog']",
  title: KNOWN_GPT_RATE_LIMIT_TITLE,
  body: KNOWN_GPT_RATE_LIMIT_BODY,
  ack: KNOWN_GPT_RATE_LIMIT_ACK,
  dialogHash: KNOWN_GPT_RATE_LIMIT_DIALOG_HASH,
  titleHash: KNOWN_GPT_RATE_LIMIT_TITLE_HASH,
  bodyHash: KNOWN_GPT_RATE_LIMIT_BODY_HASH,
  acknowledgementHash: KNOWN_GPT_RATE_LIMIT_ACK_HASH,
  exactCallIdentityHash: `sha256:${"1".repeat(64)}`,
  targetRefHash: `sha256:${"2".repeat(64)}`,
  documentRefHash: `sha256:${"3".repeat(64)}`,
});

const exactDialog = (buttonOverrides: Readonly<{
  disabled?: boolean;
  ariaDisabled?: boolean;
  duplicate?: boolean;
}> = {}): FakeElement => {
  const button = new FakeElement(KNOWN_GPT_RATE_LIMIT_ACK);
  button.disabled = buttonOverrides.disabled ?? false;
  if (buttonOverrides.ariaDisabled) button.attributes.set("aria-disabled", "true");
  const buttons = buttonOverrides.duplicate
    ? [button, new FakeElement(KNOWN_GPT_RATE_LIMIT_ACK)] : [button];
  return new FakeElement(
    [KNOWN_GPT_RATE_LIMIT_TITLE, ...KNOWN_GPT_RATE_LIMIT_BODY, KNOWN_GPT_RATE_LIMIT_ACK].join("\n"),
    buttons,
  );
};

const detect = async (dialogs: readonly FakeElement[]) => {
  const firstButton = dialogs.flatMap((dialog) => dialog.buttons)[0] ?? null;
  const fact = await runInNewContext(`(${KNOWN_GPT_RATE_LIMIT_DETECTOR})(expected)`, {
    expected,
    document: {
      querySelectorAll: (selector: string) => selector === expected.dialogSelector ? dialogs : [],
      elementFromPoint: () => firstButton,
    },
    HTMLElement: FakeElement,
    Node: FakeNode,
    getComputedStyle: (node: FakeElement) => node.style,
    innerWidth: 1280,
    innerHeight: 720,
    crypto: webcrypto,
    TextEncoder,
    Uint8Array,
    Array,
    String,
    Number,
    Math,
    Date,
  });
  assert.equal(knownGptRateLimitPreflightFactValid(fact), true);
  return fact as Readonly<Record<string, unknown>>;
};

export const detectedKnownGptRateLimitMismatchFact = async (
): Promise<KnownGptRateLimitPreflightFact> => {
  const wrongBody = exactDialog();
  wrongBody.innerText = [KNOWN_GPT_RATE_LIMIT_TITLE, "changed body", KNOWN_GPT_RATE_LIMIT_ACK]
    .join("\n");
  return await detect([wrongBody]) as KnownGptRateLimitPreflightFact;
};

export const detectedKnownGptRateLimitExactFact = async (
): Promise<KnownGptRateLimitPreflightFact> =>
  await detect([exactDialog()]) as KnownGptRateLimitPreflightFact;

export const verifyKnownGptRateLimitDetector = async (): Promise<void> => {
  const absent = await detect([]);
  assert.equal(absent.state, "absent");
  assert.deepEqual([absent.dialogRawCount, absent.dialogEligibleCount], [0, 0]);

  const exact = exactDialog();
  exact.textContent = `${exact.innerText} hidden injected text`;
  const exactFact = await detect([exact]);
  assert.equal(exactFact.state, "exact_present",
    "hidden textContent pollution must not override the exact visible innerText fact");
  assert.deepEqual([
    exactFact.dialogRawCount, exactFact.dialogEligibleCount, exactFact.dialogActionableCount,
    exactFact.acknowledgementButtonRawCount, exactFact.acknowledgementButtonEligibleCount,
    exactFact.acknowledgementButtonActionableCount,
  ], [1, 1, 1, 1, 1, 1]);

  const hidden = exactDialog();
  hidden.hidden = true;
  const hiddenFact = await detect([hidden]);
  assert.equal(hiddenFact.state, "absent");
  assert.deepEqual([hiddenFact.dialogRawCount, hiddenFact.dialogEligibleCount], [1, 0]);

  const wrongBody = exactDialog();
  wrongBody.innerText = [KNOWN_GPT_RATE_LIMIT_TITLE, "changed body", KNOWN_GPT_RATE_LIMIT_ACK].join("\n");
  const flatText = exactDialog();
  flatText.innerText = [KNOWN_GPT_RATE_LIMIT_TITLE, ...KNOWN_GPT_RATE_LIMIT_BODY,
    KNOWN_GPT_RATE_LIMIT_ACK].join(" ");
  const missingParagraph = exactDialog();
  missingParagraph.innerText = [KNOWN_GPT_RATE_LIMIT_TITLE, KNOWN_GPT_RATE_LIMIT_BODY[0],
    KNOWN_GPT_RATE_LIMIT_ACK].join("\n");
  const swappedParagraphs = exactDialog();
  swappedParagraphs.innerText = [KNOWN_GPT_RATE_LIMIT_TITLE, ...[...KNOWN_GPT_RATE_LIMIT_BODY].reverse(),
    KNOWN_GPT_RATE_LIMIT_ACK].join("\n");
  const titleSpoof = exactDialog();
  titleSpoof.innerText = [KNOWN_GPT_RATE_LIMIT_BODY[0], KNOWN_GPT_RATE_LIMIT_TITLE,
    KNOWN_GPT_RATE_LIMIT_BODY[1], KNOWN_GPT_RATE_LIMIT_ACK].join("\n");
  for (const candidate of [
    [wrongBody],
    [flatText],
    [missingParagraph],
    [swappedParagraphs],
    [titleSpoof],
    [exactDialog(), exactDialog()],
    [exactDialog({ duplicate: true })],
    [exactDialog({ disabled: true })],
    [exactDialog({ ariaDisabled: true })],
  ]) {
    const mismatch = await detect(candidate);
    assert.equal(mismatch.state, "mismatch");
  }
};

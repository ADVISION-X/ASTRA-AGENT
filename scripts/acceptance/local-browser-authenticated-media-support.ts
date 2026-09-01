import assert from "../audit/shared/governance-exam-assert.js";
import { createHash, webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";

import type { ExtensionTargetAuthority } from "../../src/lib/browser/chrome-extension/extension-target-authority.js";

type Runtime = (expression: string) => Promise<unknown>;
class TestElement { public isConnected = true; }
class TestImage extends TestElement {
  public complete = true;
  public naturalWidth = 1672;
  public naturalHeight = 941;
  public src: string;
  public currentSrc: string;
  public constructor(
    public alt: string,
    source: string,
    public display = "block",
    public visibility = "visible",
    public opacity = "1",
  ) { super(); this.src = source; this.currentSrc = source; }
  public getBoundingClientRect() { return { width: 800, height: 450 }; }
}

const command = {
  kind: "authenticated-media" as const,
  assistantTurnId: "conversation-turn-6",
  semanticMediaId: "gpt-generated-image-main" as const,
};

const runtime = (input: Readonly<{
  turns: readonly TestElement[];
  bytes?: Uint8Array;
  bytesForSource?: (source: string) => Uint8Array;
  mediaType?: string;
  rejectFetch?: boolean;
  fetchCount?: { value: number };
}>): Runtime => async (expression) => runInNewContext(expression, {
  document: { querySelectorAll: () => input.turns },
  HTMLElement: TestElement,
  HTMLImageElement: TestImage,
  getComputedStyle: (node: TestImage) => ({
    display: node.display, visibility: node.visibility, opacity: node.opacity,
  }),
  fetch: async (source: string) => {
    if (input.fetchCount) input.fetchCount.value += 1;
    if (input.rejectFetch) throw new Error("network rejected");
    const body = input.bytesForSource?.(source) ?? input.bytes ?? new Uint8Array([137, 80, 78, 71]);
    return new Response(Buffer.from(body), {
      status: 200, headers: { "content-type": input.mediaType ?? "image/png" },
    });
  },
  crypto: webcrypto,
  btoa: (value: string) => Buffer.from(value, "binary").toString("base64"),
  Uint8Array, String, Number, Map, Error,
});

const turn = (images: readonly TestImage[]): TestElement => Object.assign(new TestElement(), {
  querySelectorAll: (selector: string) => selector === "img[alt]" ? images : [],
});

export const exerciseAuthenticatedMedia = async (input: Readonly<{
  authority: Pick<ExtensionTargetAuthority, "executeRegisteredCommand" | "resolve">;
  targetRef: string;
  documentRef: string;
  setRuntime(value: Runtime | null): void;
}>): Promise<void> => {
  const authority = input.authority.resolve(input.targetRef, input.documentRef);
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const images = [
    new TestImage("generated primary image", "https://chatgpt.com/content/a"),
    new TestImage("same semantic image", "https://chatgpt.com/content/b"),
    new TestImage("hidden unrelated image", "https://chatgpt.com/content/c", "block", "visible", "0"),
  ];
  input.setRuntime(runtime({ turns: [turn(images)], bytes }));
  const authenticated = await input.authority.executeRegisteredCommand(command, authority) as Record<string, unknown>;
  assert.equal(authenticated.sha256, `sha256:${createHash("sha256").update(bytes).digest("hex")}`);
  assert.equal(authenticated.authorityTargetHash,
    `sha256:${createHash("sha256").update(input.targetRef).digest("hex")}`);
  assert.equal(authenticated.authorityDocumentHash,
    `sha256:${createHash("sha256").update(input.documentRef).digest("hex")}`);
  assert.equal(authenticated.width, 1672);
  assert.equal(authenticated.height, 941);
  input.setRuntime(runtime({
    turns: [turn(images.slice(0, 2))],
    bytesForSource: (source) => source.endsWith("/a") ? bytes : new Uint8Array([1, 2, 3, 4]),
  }));
  await assert.rejects(input.authority.executeRegisteredCommand(command, authority),
    /BROWSER_AUTHENTICATED_MEDIA_MULTIPLE/u);

  input.setRuntime(runtime({ turns: [] }));
  await assert.rejects(input.authority.executeRegisteredCommand(command, authority),
    /BROWSER_AUTHENTICATED_MEDIA_ABSENT/u);
  input.setRuntime(runtime({ turns: [turn(images), turn(images)] }));
  await assert.rejects(input.authority.executeRegisteredCommand(command, authority),
    /BROWSER_AUTHENTICATED_MEDIA_MULTIPLE/u);

  for (const hidden of [
    new TestImage("hidden", "https://chatgpt.com/h1", "none"),
    new TestImage("hidden", "https://chatgpt.com/h2", "block", "hidden"),
    new TestImage("hidden", "https://chatgpt.com/h3", "block", "collapse"),
  ]) {
    input.setRuntime(runtime({ turns: [turn([hidden])] }));
    await assert.rejects(input.authority.executeRegisteredCommand(command, authority),
      /BROWSER_AUTHENTICATED_MEDIA_ABSENT/u);
  }

  const fetchCount = { value: 0 };
  const duplicateSource = "https://chatgpt.com/content/same";
  input.setRuntime(runtime({
    turns: [turn([new TestImage("one", duplicateSource), new TestImage("two", duplicateSource)])],
    bytes, fetchCount,
  }));
  await input.authority.executeRegisteredCommand(command, authority);
  assert.equal(fetchCount.value, 1, "the same authenticated resource URL must be fetched once");

  input.setRuntime(runtime({ turns: [turn([images[0]!])], rejectFetch: true }));
  await assert.rejects(input.authority.executeRegisteredCommand(command, authority),
    /BROWSER_AUTHENTICATED_MEDIA_FETCH_FAILED/u);
  for (const invalid of [
    { bytes, mediaType: "text/plain" },
    { bytes: new Uint8Array(0), mediaType: "image/png" },
    { bytes: new Uint8Array(25 * 1024 * 1024 + 1), mediaType: "image/png" },
  ]) {
    input.setRuntime(runtime({ turns: [turn([images[0]!])], ...invalid }));
    await assert.rejects(input.authority.executeRegisteredCommand(command, authority),
      /BROWSER_AUTHENTICATED_MEDIA_BYTES_INVALID/u);
  }
  input.setRuntime(null);
};

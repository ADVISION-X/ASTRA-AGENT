import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { createHash, webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";

import type { ExtensionTargetAuthority } from "../../src/lib/browser/chrome-extension/extension-target-authority.js";
import { GPT_WEB_ORIGIN } from "../../src/lib/browser/exact-target/browser-site-policy-registry.js";

type Runtime = (expression: string) => Promise<unknown>;
class TestImage {
  public readonly currentSrc: string;
  public constructor(public readonly src: string) { this.currentSrc = src; }
}
class TestTurn {
  public constructor(
    private readonly id: string,
    private readonly isUser: boolean,
    private readonly images: readonly TestImage[] = [],
  ) {}
  public getAttribute(name: string) { return name === "data-testid" ? this.id : null; }
  public querySelectorAll(selector: string): readonly unknown[] {
    if (selector === "[data-message-author-role='user']") return this.isUser ? [{}] : [];
    return selector === "img" ? this.images : [];
  }
}

const command = {
  kind: "authenticated-media" as const,
  canonicalConversationUrl: `${GPT_WEB_ORIGIN}/c/authenticated-media`,
  userTurnId: "conversation-turn-5",
  semanticMediaId: "gpt-generated-image-main" as const,
};
const user = () => new TestTurn(command.userTurnId, true);
const response = (images: readonly TestImage[]) =>
  new TestTurn("conversation-turn-6", false, images);

const runtime = (input: Readonly<{
  turns: readonly TestTurn[];
  bytes?: Uint8Array;
  bytesForSource?: (source: string) => Uint8Array;
  mediaType?: string;
  currentUrl?: string;
  rejectFetch?: boolean;
  responseStatus?: number;
  fetchCount?: { value: number };
  turnsAfterObserve?: readonly TestTurn[];
  observationCount?: { value: number };
}>): Runtime => {
  let currentTurns = input.turns;
  return async (expression) => runInNewContext(expression, {
  document: {
    documentElement: {},
    querySelectorAll: () => currentTurns,
  },
  location: { href: input.currentUrl ?? command.canonicalConversationUrl },
  URL,
  fetch: async (source: string) => {
    if (input.fetchCount) input.fetchCount.value += 1;
    if (input.rejectFetch) throw new Error("network rejected");
    const body = input.bytesForSource?.(source) ?? input.bytes ?? new Uint8Array([137, 80, 78, 71]);
    return new Response(Buffer.from(body), {
      status: input.responseStatus ?? 200, headers: { "content-type": input.mediaType ?? "image/png" },
    });
  },
  crypto: webcrypto,
  btoa: (value: string) => Buffer.from(value, "binary").toString("base64"),
  MutationObserver: class {
    public constructor(private readonly callback: () => void) {}
    public observe() {
      if (input.observationCount) input.observationCount.value += 1;
      if (input.turnsAfterObserve) {
        currentTurns = input.turnsAfterObserve;
        queueMicrotask(this.callback);
      }
    }
    public disconnect() {}
  },
  setTimeout: (callback: () => void) => { queueMicrotask(callback); return 1; },
  clearTimeout: () => undefined,
  Uint8Array, String, Map, Error,
  });
};

type MediaExerciseInput = Readonly<{
  authority: Pick<ExtensionTargetAuthority, "executeRegisteredCommand" | "resolve">;
  targetRef: string;
  documentRef: string;
  setRuntime(value: Runtime | null): void;
}>;

const exerciseMediaSuccess = async (
  input: MediaExerciseInput,
  authority: ReturnType<MediaExerciseInput["authority"]["resolve"]>,
  bytes: Uint8Array,
  first: TestImage,
  second: TestImage,
): Promise<void> => {
  input.setRuntime(runtime({ turns: [user(), response([first, second])], bytes }));
  const authenticated = await input.authority.executeRegisteredCommand(
    command, authority, "observation",
  ) as Record<string, unknown>;
  assert.equal(authenticated.sha256, `sha256:${createHash("sha256").update(bytes).digest("hex")}`);
  assert.equal(authenticated.assistantTurnId, "conversation-turn-6");
  assert.equal(authenticated.precedingUserTurnId, command.userTurnId);
  assert.equal(authenticated.currentUrl, command.canonicalConversationUrl);
  assert.equal(authenticated.authorityTargetHash,
    `sha256:${createHash("sha256").update(input.targetRef).digest("hex")}`);
  assert.equal(authenticated.authorityDocumentHash,
    `sha256:${createHash("sha256").update(input.documentRef).digest("hex")}`);
  const observationCount = { value: 0 };
  input.setRuntime(runtime({ turns: [user(), response([])],
    turnsAfterObserve: [user(), response([first])], observationCount, bytes }));
  const hydrated = await input.authority.executeRegisteredCommand(
    command, authority, "observation",
  ) as Record<string, unknown>;
  assert.equal(hydrated.assistantTurnId, "conversation-turn-6");
  assert.equal(observationCount.value, 1,
    "authenticated media must wait on source hydration inside the same Browser observation");
};

const exerciseMediaFailures = async (
  input: MediaExerciseInput,
  authority: ReturnType<MediaExerciseInput["authority"]["resolve"]>,
  bytes: Uint8Array,
  first: TestImage,
  second: TestImage,
): Promise<void> => {
  input.setRuntime(runtime({ turns: [user(), response([first, second])],
    bytesForSource: (source) => source.endsWith("/a") ? bytes : new Uint8Array([1, 2, 3, 4]) }));
  await assert.rejects(input.authority.executeRegisteredCommand(command, authority, "observation"),
    /BROWSER_AUTHENTICATED_MEDIA_CONTENT_MULTIPLE/u);
  const afterNextUser = new TestTurn("conversation-turn-8", false, [first]);
  for (const turns of [[] as readonly TestTurn[], [user(), response([])],
    [user(), new TestTurn("conversation-turn-7", true), afterNextUser]]) {
    input.setRuntime(runtime({ turns }));
    await assert.rejects(input.authority.executeRegisteredCommand(command, authority, "observation"),
      /BROWSER_AUTHENTICATED_MEDIA_(?:USER_TURN|IMAGE_SOURCE)_ABSENT/u);
  }
  input.setRuntime(runtime({ turns: [user(), user(), response([first])] }));
  await assert.rejects(input.authority.executeRegisteredCommand(command, authority, "observation"),
    /BROWSER_AUTHENTICATED_MEDIA_USER_TURN_MULTIPLE/u);
  input.setRuntime(runtime({ turns: [user(), response([first])], currentUrl: `${GPT_WEB_ORIGIN}/c/wrong` }));
  await assert.rejects(input.authority.executeRegisteredCommand(command, authority, "observation"),
    /BROWSER_AUTHENTICATED_MEDIA_WRONG_DOCUMENT/u);
};

const exerciseMediaFetchFailures = async (
  input: MediaExerciseInput,
  authority: ReturnType<MediaExerciseInput["authority"]["resolve"]>,
  bytes: Uint8Array,
  first: TestImage,
): Promise<void> => {
  const fetchCount = { value: 0 };
  const duplicate = new TestImage(`${GPT_WEB_ORIGIN}/content/same`);
  input.setRuntime(runtime({ turns: [user(), response([duplicate, duplicate])], bytes, fetchCount }));
  await input.authority.executeRegisteredCommand(command, authority, "observation");
  assert.equal(fetchCount.value, 1, "the same authenticated resource URL must be fetched once");
  for (const failure of [
    { input: { rejectFetch: true }, expected: /BROWSER_AUTHENTICATED_MEDIA_FETCH_FAILED/u },
    { input: { responseStatus: 403 }, expected: /BROWSER_AUTHENTICATED_MEDIA_FETCH_REJECTED/u },
  ]) {
    input.setRuntime(runtime({ turns: [user(), response([first])], ...failure.input }));
    await assert.rejects(input.authority.executeRegisteredCommand(command, authority, "observation"), failure.expected);
  }
  for (const invalid of [
    { bytes, mediaType: "text/plain", failure: /BROWSER_AUTHENTICATED_MEDIA_TYPE_INVALID/u },
    { bytes: new Uint8Array(0), mediaType: "image/png", failure: /BROWSER_AUTHENTICATED_MEDIA_BYTES_EMPTY/u },
    { bytes: new Uint8Array(25 * 1024 * 1024 + 1), mediaType: "image/png",
      failure: /BROWSER_AUTHENTICATED_MEDIA_BYTES_TOO_LARGE/u },
  ]) {
    input.setRuntime(runtime({ turns: [user(), response([first])],
      bytes: invalid.bytes, mediaType: invalid.mediaType }));
    await assert.rejects(input.authority.executeRegisteredCommand(command, authority, "observation"), invalid.failure);
  }
};

export const exerciseAuthenticatedMedia = async (input: MediaExerciseInput): Promise<void> => {
  const authority = input.authority.resolve(input.targetRef, input.documentRef);
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const first = new TestImage(`${GPT_WEB_ORIGIN}/content/a`);
  const second = new TestImage(`${GPT_WEB_ORIGIN}/content/b`);
  await exerciseMediaSuccess(input, authority, bytes, first, second);
  await exerciseMediaFailures(input, authority, bytes, first, second);
  await exerciseMediaFetchFailures(input, authority, bytes, first);
  input.setRuntime(null);
};

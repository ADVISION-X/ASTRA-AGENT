import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { createHash, webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";

import type { ExtensionTargetAuthority } from "../../src/lib/browser/chrome-extension/extension-target-authority.js";
import { GPT_WEB_ORIGIN } from "../../src/lib/browser/exact-target/browser-site-policy-registry.js";

type Runtime = (expression: string) => Promise<unknown>;
const assistantMessageId = "00000000-0000-4000-8000-000000000006";
class TestImage {
  public readonly currentSrc: string;
  public constructor(public readonly src: string, private readonly owner: string | null = assistantMessageId) {
    this.currentSrc = src;
  }
  public closest(selector: string) {
    return selector === "[data-chatgpt-search-message-ids]" && this.owner !== null
      ? { getAttribute: () => this.owner } : null;
  }
}
class TestTurn {
  public constructor(
    private readonly id: string,
    private readonly isUser: boolean,
    private readonly images: readonly TestImage[] = [],
  ) {}
  public getAttribute(name: string) { return name === "data-turn-key" ? this.id : null; }
  public querySelectorAll(selector: string): readonly unknown[] {
    if (selector === "[data-chatgpt-search-unit-key$=':user']") return this.isUser
      ? [{ getAttribute: () => this.id }] : [];
    return selector === "img" ? this.images : [];
  }
}

const command = {
  kind: "authenticated-media" as const,
  canonicalConversationUrl: `${GPT_WEB_ORIGIN}/c/authenticated-media`,
  userTurnId: "00000000-0000-4000-8000-000000000005",
  semanticMediaId: "gpt-generated-image-main" as const,
};
const user = () => new TestTurn(command.userTurnId, true);
const response = (images: readonly TestImage[]) =>
  new TestTurn("00000000-0000-4000-8000-000000000006", false, images);
/** Real ChatGPT DOM: the generated image lives inside the same turn container as the user unit. */
const sameTurn = (images: readonly TestImage[]) => new TestTurn(command.userTurnId, true, images);

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

const acceptanceExactCallIdentityHash = `sha256:${"e".repeat(64)}` as const;
const execute = async (
  input: MediaExerciseInput,
  authority: ReturnType<MediaExerciseInput["authority"]["resolve"]>,
): Promise<unknown> => {
  const result = await input.authority.executeRegisteredCommand(
    command, authority, "observation", acceptanceExactCallIdentityHash,
  );
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  const record = result as Readonly<Record<string, unknown>>;
  return record.schemaVersion === "grasseye.browser.command-preflight.v1"
    ? record.commandResult : result;
};

const exerciseMediaSuccess = async (
  input: MediaExerciseInput,
  authority: ReturnType<MediaExerciseInput["authority"]["resolve"]>,
  bytes: Uint8Array,
  first: TestImage,
  second: TestImage,
): Promise<void> => {
  input.setRuntime(runtime({ turns: [user(), response([first, second])], bytes }));
  const authenticated = await execute(input, authority) as Record<string, unknown>;
  assert.equal(authenticated.sha256, `sha256:${createHash("sha256").update(bytes).digest("hex")}`);
  assert.equal(authenticated.assistantTurnId, "00000000-0000-4000-8000-000000000006");
  assert.equal(authenticated.precedingUserTurnId, command.userTurnId);
  assert.equal(authenticated.currentUrl, command.canonicalConversationUrl);
  assert.equal(authenticated.authorityTargetHash,
    `sha256:${createHash("sha256").update(input.targetRef).digest("hex")}`);
  assert.equal(authenticated.authorityDocumentHash,
    `sha256:${createHash("sha256").update(input.documentRef).digest("hex")}`);
  input.setRuntime(runtime({ turns: [sameTurn([first, second])], bytes }));
  const sameContainer = await execute(input, authority) as Record<string, unknown>;
  assert.equal(sameContainer.assistantTurnId, assistantMessageId,
    "an image inside the user's turn container takes its assistant id from data-chatgpt-search-message-ids");
  const observationCount = { value: 0 };
  input.setRuntime(runtime({ turns: [user(), response([])],
    turnsAfterObserve: [user(), response([first])], observationCount, bytes }));
  const hydrated = await execute(input, authority) as Record<string, unknown>;
  assert.equal(hydrated.assistantTurnId, "00000000-0000-4000-8000-000000000006");
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
  await assert.rejects(execute(input, authority),
    /BROWSER_AUTHENTICATED_MEDIA_CONTENT_MULTIPLE/u);
  const afterNextUser = new TestTurn("00000000-0000-4000-8000-000000000008", false, [first]);
  for (const turns of [[] as readonly TestTurn[], [user(), response([])],
    [user(), new TestTurn("00000000-0000-4000-8000-000000000007", true), afterNextUser]]) {
    input.setRuntime(runtime({ turns }));
    await assert.rejects(execute(input, authority),
      /BROWSER_AUTHENTICATED_MEDIA_(?:USER_TURN|IMAGE_SOURCE)_ABSENT/u);
  }
  input.setRuntime(runtime({ turns: [sameTurn([new TestImage(`${GPT_WEB_ORIGIN}/content/a`, null)])] }));
  await assert.rejects(execute(input, authority), /BROWSER_AUTHENTICATED_MEDIA_IMAGE_SOURCE_ABSENT/u,
    "an image without an assistant message id owner is not a generated-image source");
  input.setRuntime(runtime({ turns: [user(), user(), response([first])] }));
  await assert.rejects(execute(input, authority),
    /BROWSER_AUTHENTICATED_MEDIA_USER_TURN_MULTIPLE/u);
  input.setRuntime(runtime({ turns: [user(), response([first])], currentUrl: `${GPT_WEB_ORIGIN}/c/wrong` }));
  await assert.rejects(execute(input, authority),
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
  await execute(input, authority);
  assert.equal(fetchCount.value, 1, "the same authenticated resource URL must be fetched once");
  for (const failure of [
    { input: { rejectFetch: true }, expected: /BROWSER_AUTHENTICATED_MEDIA_FETCH_FAILED/u },
    { input: { responseStatus: 403 }, expected: /BROWSER_AUTHENTICATED_MEDIA_FETCH_REJECTED/u },
  ]) {
    input.setRuntime(runtime({ turns: [user(), response([first])], ...failure.input }));
    await assert.rejects(execute(input, authority), failure.expected);
  }
  for (const invalid of [
    { bytes, mediaType: "text/plain", failure: /BROWSER_AUTHENTICATED_MEDIA_TYPE_INVALID/u },
    { bytes: new Uint8Array(0), mediaType: "image/png", failure: /BROWSER_AUTHENTICATED_MEDIA_BYTES_EMPTY/u },
    { bytes: new Uint8Array(25 * 1024 * 1024 + 1), mediaType: "image/png",
      failure: /BROWSER_AUTHENTICATED_MEDIA_BYTES_TOO_LARGE/u },
  ]) {
    input.setRuntime(runtime({ turns: [user(), response([first])],
      bytes: invalid.bytes, mediaType: invalid.mediaType }));
    await assert.rejects(execute(input, authority), invalid.failure);
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

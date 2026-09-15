import Database from "better-sqlite3";
import { join } from "node:path";

import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { assertBrowserDomIntent } from "../../src/lib/browser/exact-target/browser-dom-intent.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import type { ExtensionDebuggerRuntime } from
  "../../src/lib/browser/chrome-extension/debugger-runtime.js";
import { executeGptConversationRename } from
  "../../src/lib/browser/chrome-extension/gpt-conversation-rename-runtime.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { createBrowserActorFactory, permit } from "./local-browser-terminal-fixture.js";
import { browserDomFacts } from "./local-browser-dom-runtime-fixture.js";
import { exactHash, hash } from "./local-browser-mutation-store-support.js";

const command = Object.freeze({
  kind: "dom-intent" as const,
  intent: Object.freeze({
    kind: "renameExactGptConversation" as const,
    canonicalConversationUrl: "https://chatgpt.com/c/12345678-1234-4123-8123-123456789012",
    targetTitle: "0915·八字分析·aiprod_12345678",
    timeoutMs: 10000,
  }),
});

const renamePermit = (commandId: string) => Object.freeze({
  ...permit(commandId),
  childCapabilityId: "rename_settled_gpt_conversation",
  commandTtlMs: 15_000,
});

const physicalInputCount = (dataDir: string, commandId: string): number => {
  const database = new Database(join(dataDir, "browser", "browser-mutations.sqlite"), {
    readonly: true,
  });
  try {
    const row = database.prepare(
      "select physical_input_count from browser_mutations where command_id=?",
    ).get(commandId) as { physical_input_count: number };
    return row.physical_input_count;
  } finally { database.close(); }
};

type RenameRuntimeState = Readonly<{
  runtime: ExtensionDebuggerRuntime;
  title(): string;
  semanticInputs(): readonly string[];
  inputsAfterCancellation(): number;
  assertCurrent(): void;
}>;

const statefulRenameRuntime = (input: Readonly<{
  initialTitle: string;
  cancelAfterSemanticInputs?: number;
}>): RenameRuntimeState => {
  let title = input.initialTitle;
  let editorValue = title;
  let menuOpen = false;
  let editorOpen = false;
  let clickOrdinal = 0;
  let cancelled = false;
  let inputsAfterCancellation = 0;
  const semanticInputs: string[] = [];
  const nodeForSelector = (selector: string): number[] => {
    if (selector.includes("data-conversation-options-trigger")) return [11];
    if (selector === "[role='menuitem']") return menuOpen ? [12] : [];
    if (selector === "input[aria-label='聊天标题'][name='title-editor']") {
      return editorOpen ? [13] : [];
    }
    if (selector.includes("data-sidebar-item='true'") && selector.includes("aria-label=")) {
      return title === command.intent.targetTitle ? [10] : [];
    }
    if (selector.includes("data-sidebar-item='true'")) return [10];
    throw new Error(`UNEXPECTED_RENAME_SELECTOR:${selector}`);
  };
  const startSemanticInput = (name: string): void => {
    if (cancelled) inputsAfterCancellation += 1;
    semanticInputs.push(name);
    if (semanticInputs.length === input.cancelAfterSemanticInputs) cancelled = true;
  };
  const runtime = {
    async awaitPageReadPermission(): Promise<void> { return undefined; },
    async send(_tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>) {
      if (method.startsWith("Input.") && cancelled) inputsAfterCancellation += 1;
      if (method === "Page.getNavigationHistory") return {
        currentIndex: 0,
        entries: [{ url: command.intent.canonicalConversationUrl, title: "ChatGPT" }],
      };
      if (method === "Page.getFrameTree") {
        return { frameTree: { frame: { loaderId: "rename-loader" } } };
      }
      if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
      if (method === "DOM.querySelectorAll") {
        return { nodeIds: nodeForSelector(String(parameters?.selector ?? "")) };
      }
      if (method === "DOM.resolveNode") {
        return { object: { objectId: parameters?.nodeId === 1
          ? "rename-root" : `rename-node-${parameters?.nodeId}` } };
      }
      if (method === "Runtime.callFunctionOn") {
        const objectId = String(parameters?.objectId ?? "");
        if (objectId.startsWith("rename-node-")) {
          const nodeId = Number(objectId.slice("rename-node-".length));
          return { result: { value: browserDomFacts({
            value: nodeId === 13 ? editorValue : "",
            name: nodeId === 13 ? "title-editor" : "",
            label: nodeId === 13 ? "聊天标题" : "",
            type: nodeId === 13 ? "text" : "",
          }) } };
        }
        if (objectId === "rename-root") {
          const request = (parameters?.arguments as readonly Readonly<{ value?: Readonly<{
            selector?: string; output?: string;
          }> }>[])?.[0]?.value;
          const nodeId = nodeForSelector(String(request?.selector ?? ""))[0];
          if (nodeId === undefined) return { result: { type: "string", value: "BROWSER_DOM_CANDIDATE_MISSING" } };
          return parameters?.returnByValue === false
            ? { result: { type: "object", subtype: "node", objectId: `rename-candidate-${nodeId}` } }
            : { result: { value: { x: 5, y: 5 } } };
        }
      }
      if (method === "DOM.requestNode") {
        const match = /rename-candidate-(\d+)/u.exec(String(parameters?.objectId ?? ""));
        return { nodeId: Number(match?.[1] ?? 0) };
      }
      if (method === "Runtime.releaseObject" || method === "DOM.focus") return {};
      if (method === "DOM.describeNode") {
        const nodeId = Number(parameters?.nodeId);
        if (nodeId === 10) return { node: {
          nodeName: "A", attributes: ["aria-label", title], children: [],
        } };
        if (nodeId === 12) return { node: {
          nodeName: "DIV", attributes: ["role", "menuitem"],
          children: [{ nodeName: "#text", nodeValue: "重命名" }],
        } };
        if (nodeId === 13) return { node: {
          nodeName: "INPUT", attributes: ["aria-label", "聊天标题", "name", "title-editor"],
          children: [],
        } };
      }
      if (method === "Input.dispatchMouseEvent") {
        const type = String(parameters?.type ?? "");
        if (type === "mousePressed") {
          clickOrdinal += 1;
          startSemanticInput(clickOrdinal === 1 ? "open-menu" : "open-editor");
        }
        if (type === "mouseReleased" && clickOrdinal === 1) menuOpen = true;
        if (type === "mouseReleased" && clickOrdinal === 2) {
          menuOpen = false;
          editorOpen = true;
          editorValue = title;
        }
        return {};
      }
      if (method === "Input.dispatchKeyEvent") {
        const type = String(parameters?.type ?? "");
        const key = String(parameters?.key ?? "");
        if (type === "rawKeyDown" && key === "a") startSemanticInput("fill-title");
        if (type === "rawKeyDown" && key === "Backspace") editorValue = "";
        if (type === "rawKeyDown" && key === "Enter") {
          startSemanticInput("save-title");
          title = editorValue;
          editorOpen = false;
        }
        return {};
      }
      if (method === "Input.insertText") {
        editorValue = String(parameters?.text ?? "");
        return {};
      }
      throw new Error(`UNEXPECTED_RENAME_RUNTIME_METHOD:${method}`);
    },
  } as ExtensionDebuggerRuntime;
  return {
    runtime,
    title: () => title,
    semanticInputs: () => semanticInputs,
    inputsAfterCancellation: () => inputsAfterCancellation,
    assertCurrent: () => {
      if (cancelled) throw new Error("BROWSER_COMMAND_PERMIT_EXPIRED");
    },
  };
};

const exerciseRenameRuntime = async (): Promise<void> => {
  const target = { tabId: 170 } as never;
  const success = statefulRenameRuntime({ initialTitle: "旧标题" });
  assert.deepEqual(await executeGptConversationRename(
    success.runtime, target, command.intent, success.assertCurrent,
  ), {
    renameState: "renamed", candidateCount: 1, identityRevalidated: true,
    mutationCount: 4, postconditionVerified: true,
  });
  assert.equal(success.title(), command.intent.targetTitle);
  assert.deepEqual(success.semanticInputs(), [
    "open-menu", "open-editor", "fill-title", "save-title",
  ]);

  const exact = statefulRenameRuntime({ initialTitle: command.intent.targetTitle });
  assert.equal((await executeGptConversationRename(
    exact.runtime, target, command.intent, exact.assertCurrent,
  ) as Readonly<Record<string, unknown>>).mutationCount, 0);
  assert.deepEqual(exact.semanticInputs(), []);

  for (const count of [1, 2, 3] as const) {
    const cancelled = statefulRenameRuntime({ initialTitle: "旧标题", cancelAfterSemanticInputs: count });
    const receipt = await executeGptConversationRename(
      cancelled.runtime, target, command.intent, cancelled.assertCurrent,
    ) as Readonly<Record<string, unknown>>;
    assert.equal(receipt.renameState, "failed");
    assert.equal(receipt.mutationCount, count);
    assert.equal(receipt.failureCode, "BROWSER_COMMAND_PERMIT_EXPIRED");
    assert.equal(cancelled.inputsAfterCancellation(), 0,
      "deadline or channel revocation must prevent every later physical input");
  }
};

const exerciseActor = async (root: string): Promise<void> => {
  assert.doesNotThrow(() => assertBrowserDomIntent(command.intent));
  assert.throws(() => assertBrowserDomIntent({
    ...command.intent, targetTitle: "bad\nname",
  }), /BROWSER_COMMAND_PERMIT_INVALID/u);
  assert.throws(() => assertBrowserDomIntent({
    ...command.intent, timeoutMs: 2501,
  }), /BROWSER_COMMAND_PERMIT_INVALID/u);
  for (const extra of [
    { selector: "button" }, { x: 1, y: 1 }, { script: "return true" }, { steps: ["click"] },
  ]) {
    assert.throws(() => assertBrowserDomIntent({
      ...command.intent, ...extra,
    } as never), /BROWSER_COMMAND_PERMIT_INVALID/u);
  }

  const dataDir = join(root, "settled-rename-actor");
  const store = new BrowserMutationStore(dataDir);
  const logger = createRuntimeLogger({
    producer: "browser-settled-rename-acceptance",
    owner: "browser-session",
    component: "browser-command",
    terminalEnabled: false,
    fileSink: { directoryPath: join(root, "settled-rename-logs") },
  });
  const actorFor = createBrowserActorFactory(store, logger);
  for (const count of [0, 4] as const) {
    const candidate = renamePermit(`settled-rename-${count}`);
    await actorFor(async (permitValue, _command, onDispatched) => {
      onDispatched?.();
      return {
        replyChannelToken: permitValue.replyChannelToken,
        transportSequence: 1,
        permitSequence: permitValue.sequence,
        result: count === 0
          ? { renameState: "already-exact", candidateCount: 1, identityRevalidated: true,
            mutationCount: 0, postconditionVerified: true }
          : { renameState: "renamed", candidateCount: 1, identityRevalidated: true,
            mutationCount: 4, postconditionVerified: true },
      };
    }).execute(candidate, command);
    assert.equal(store.readState(candidate.commandId), "CONFIRMED");
    assert.equal(physicalInputCount(dataDir, candidate.commandId), count);
  }

  for (const count of [1, 2, 3] as const) {
    const partial = renamePermit(`settled-rename-partial-${count}`);
    await assert.rejects(actorFor(async (candidate, _command, onDispatched) => {
      onDispatched?.();
      return {
        replyChannelToken: candidate.replyChannelToken,
        transportSequence: 1,
        permitSequence: candidate.sequence,
        result: { renameState: "failed", candidateCount: 1, identityRevalidated: false,
          mutationCount: count, postconditionVerified: false,
          failureCode: "BROWSER_POSTCONDITION_FAILED", nativeCauseCode: null },
      };
    }).execute(partial, command), /BROWSER_POSTCONDITION_FAILED/u);
    assert.equal(store.readState(partial.commandId), "REJECTED");
    assert.equal(physicalInputCount(dataDir, partial.commandId), count);
  }

  const extraField = renamePermit("settled-rename-extra-reply-field");
  await assert.rejects(actorFor(async (candidate, _command, onDispatched) => {
    onDispatched?.();
    return {
      replyChannelToken: candidate.replyChannelToken,
      transportSequence: 1,
      permitSequence: candidate.sequence,
      result: { renameState: "renamed", candidateCount: 1, identityRevalidated: true,
        mutationCount: 4, postconditionVerified: true, targetTitle: command.intent.targetTitle },
    };
  }).execute(extraField, command), /BROWSER_AUTH_TRANSCRIPT_INVALID/u);
  assert.equal(store.readState(extraField.commandId), "REJECTED");

  const missing = renamePermit("settled-rename-missing-reply");
  await assert.rejects(actorFor(async (_candidate, _command, onDispatched) => {
    onDispatched?.();
    throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
  }).execute(missing, command), /BROWSER_COMMAND_RECEIPT_MISSING/u);
  assert.equal(store.readState(missing.commandId), "REJECTED");
  assert.equal(store.readMutationOutcome(missing.commandId), "dispatched");
  assert.equal(store.countDispatched(), 0,
    "the exact cleanup missing-reply exception must leave no pending Browser mutation");
  store.close();
};

const identity = (commandId: string) => Object.freeze({
  commandId,
  exactCallIdentityHash: exactHash(commandId),
  jobId: "job:rename-schema",
  resultRevision: 0,
  attemptId: "attempt:rename-schema",
  leaseVersion: 1,
  executionFenceHash: hash,
  productStepId: "gpt-settled-conversation-cleanup",
  callId: "rename-current-conversation",
  childCapabilityId: "rename_settled_gpt_conversation",
  effectScope: "target_local" as const,
  actionOrdinal: 1,
  targetRef: "target:rename-schema",
  documentRef: "document:rename-schema",
  actionId: "browser.dom.click.v1",
  positivePostconditionHash: hash,
  negativePostconditionHash: exactHash("negative"),
  requestHash: hash,
  payloadHash: exactHash("payload"),
});

const rebuildAsLegacyConstraint = (dataDir: string): void => {
  const database = new Database(join(dataDir, "browser", "browser-mutations.sqlite"));
  try {
    const table = database.prepare(
      "select sql from sqlite_master where type='table' and name='browser_mutations'",
    ).get() as { sql: string };
    const columnRows = database.prepare("pragma table_info(browser_mutations)").all() as Array<{
      name: string;
    }>;
    const columns = columnRows.map((column) => column.name).join(",");
    database.transaction(() => {
      database.exec("drop index browser_mutations_unresolved");
      database.exec("drop index browser_mutations_logical_identity");
      database.exec("drop index browser_mutations_exact_call_identity");
      database.exec("alter table browser_mutations rename to browser_mutations_fixture_source");
      database.exec(table.sql.replace(
        "physical_input_count between 0 and 4",
        "physical_input_count between 0 and 2",
      ));
      database.exec(`insert into browser_mutations(${columns}) select ${columns}
        from browser_mutations_fixture_source`);
      database.exec("drop table browser_mutations_fixture_source");
      database.exec("create index browser_mutations_unresolved on browser_mutations(job_id,attempt_id,lease_version,execution_fence_hash,state)");
      database.exec("create index browser_mutations_logical_identity on browser_mutations(job_id,logical_mutation_id,state)");
      database.exec("create index browser_mutations_exact_call_identity on browser_mutations(job_id,exact_call_identity_hash,state)");
    })();
  } finally { database.close(); }
};

const exerciseSchemaMigration = (root: string): void => {
  const dataDir = join(root, "settled-rename-schema");
  const initial = new BrowserMutationStore(dataDir);
  initial.prepare(identity("rename-schema-row"));
  initial.markDispatched("rename-schema-row");
  initial.markConfirmed("rename-schema-row", hash, "confirmed", null, 2);
  initial.close();
  rebuildAsLegacyConstraint(dataDir);

  const migrated = new BrowserMutationStore(dataDir);
  migrated.close();
  const database = new Database(join(dataDir, "browser", "browser-mutations.sqlite"), {
    readonly: true,
  });
  try {
    const table = database.prepare(
      "select sql from sqlite_master where type='table' and name='browser_mutations'",
    ).get() as { sql: string };
    assert.match(table.sql, /physical_input_count between 0 and 4/u);
    assert.equal(database.prepare(
      "select physical_input_count from browser_mutations where command_id='rename-schema-row'",
    ).pluck().get(), 2);
    assert.equal(database.prepare(
      "select count(*) from sqlite_master where type='table' and name='browser_mutations_physical_input_v2'",
    ).pluck().get(), 0);
  } finally { database.close(); }
};

export const exerciseSettledConversationRename = async (root: string): Promise<void> => {
  await exerciseRenameRuntime();
  await exerciseActor(root);
  exerciseSchemaMigration(root);
};

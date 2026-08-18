import assert from "node:assert/strict";

import { BrowserAuthorityIssuer } from "../../src/lib/browser/authority/browser-authority-issuer.js";

type ModelState =
  | Readonly<{ state: "ABSENT" }>
  | Readonly<{ state: "PENDING"; generation: number; portEpoch: number }>
  | Readonly<{ state: "PRESENT"; generation: number; portEpoch: number }>;

type Event =
  | Readonly<{ type: "challenge_verified"; generation: number; portEpoch: number }>
  | Readonly<{ type: "grant_ack_verified"; generation: number; portEpoch: number }>
  | Readonly<{ type: "disconnect"; generation: number; portEpoch: number }>
  | Readonly<{ type: "heartbeat"; generation: number; portEpoch: number }>
  | Readonly<{ type: "command"; generation: number; portEpoch: number }>;

const reduce = (state: ModelState, event: Event): ModelState => {
  if (event.type === "disconnect") {
    if (state.state === "ABSENT") return state;
    if (state.generation !== event.generation || state.portEpoch !== event.portEpoch) return state;
    return { state: "ABSENT" };
  }
  if (event.type === "challenge_verified") {
    if (state.state !== "ABSENT") return state;
    return { state: "PENDING", generation: event.generation, portEpoch: event.portEpoch };
  }
  if (event.type === "grant_ack_verified") {
    if (state.state !== "PENDING") return state;
    if (state.generation !== event.generation || state.portEpoch !== event.portEpoch) return state;
    return { state: "PRESENT", generation: event.generation, portEpoch: event.portEpoch };
  }
  if (event.type === "heartbeat") return state;
  if (event.type === "command") return state;
  return state;
};

const assertCommandAdmitted = (state: ModelState, event: Extract<Event, { type: "command" }>): void => {
  assert.equal(state.state, "PRESENT", "command must be impossible while authority is absent or pending");
  if (state.state === "PRESENT") {
    assert.equal(state.generation, event.generation);
    assert.equal(state.portEpoch, event.portEpoch);
  }
};

const runModelMutants = (): void => {
  let state: ModelState = { state: "ABSENT" };
  state = reduce(state, { type: "challenge_verified", generation: 1, portEpoch: 1 });
  assert.equal(state.state, "PENDING");
  assert.throws(
    () => assertCommandAdmitted(state, { type: "command", generation: 1, portEpoch: 1 }),
    /command must be impossible/u,
  );

  // Wrong/stale grant ACK must not commit authority.
  state = reduce(state, { type: "grant_ack_verified", generation: 1, portEpoch: 2 });
  assert.equal(state.state, "PENDING");
  state = reduce(state, { type: "grant_ack_verified", generation: 1, portEpoch: 1 });
  assert.equal(state.state, "PRESENT");
  assertCommandAdmitted(state, { type: "command", generation: 1, portEpoch: 1 });

  // Late disconnect from a retired port cannot revoke the current generation.
  state = reduce(state, { type: "disconnect", generation: 0, portEpoch: 99 });
  assert.equal(state.state, "PRESENT");

  // Current disconnect revokes before any next command can be admitted.
  state = reduce(state, { type: "disconnect", generation: 1, portEpoch: 1 });
  assert.equal(state.state, "ABSENT");
  assert.throws(
    () => assertCommandAdmitted(state, { type: "command", generation: 1, portEpoch: 1 }),
    /command must be impossible/u,
  );

  // Heartbeat is never an authentication transition.
  state = reduce(state, { type: "heartbeat", generation: 2, portEpoch: 2 });
  assert.equal(state.state, "ABSENT");
};

const runIssuerMutants = (): void => {
  const issuer = new BrowserAuthorityIssuer();
  assert.equal(issuer.snapshot().state, "AUTHORITY_ABSENT");
  const candidate = issuer.prepare({
    controllerSessionId: "controller-model",
    connectionGeneration: 1,
    nativePortEpoch: 1,
    extensionInstanceId: "extension-model",
    releaseIdentity: "grasseye-browser-runtime-2026-08-18-v2",
    profileEnrollmentId: "profile-model",
    protocolVersion: "grasseye-browser-v2",
  });
  assert.equal(issuer.snapshot().state, "AUTHORITY_ABSENT", "pending grant must never be exposed as authority");
  assert.throws(
    () => issuer.heartbeat({ authorityId: candidate.certificate.authorityId, connectionGeneration: 1, nativePortEpoch: 1 }),
    /authenticated browser authority is absent/u,
  );
  issuer.commit(candidate);
  assert.equal(issuer.snapshot().state, "AUTHENTICATED_AUTHORITY_PRESENT");
  issuer.revoke("model disconnect");
  assert.equal(issuer.snapshot().state, "AUTHORITY_ABSENT");
};

runModelMutants();
runIssuerMutants();
process.stdout.write("local-browser-authority-model PASS\n");

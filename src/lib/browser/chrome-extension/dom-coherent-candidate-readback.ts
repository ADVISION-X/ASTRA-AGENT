import type { BrowserDomPostconditionQuery } from "../exact-target/browser-dom-intent.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import {
  bindCoherentObservationResult,
  type BrowserCoherentObservationResult,
} from "./dom-coherent-observation.js";
import type {
  BrowserPointerAction,
  CoherentObservationPointerPreparation,
} from "./dom-coherent-candidate.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";

type BrowserRecord = Record<string, unknown>;

const pointerActionCode = (value: unknown): value is string => typeof value === "string"
  && /^BROWSER_DOM_ACTION_(?:NODE_DISCONNECTED|NO_LAYOUT_BOX|NOT_VISIBLE|ARIA_HIDDEN|INERT|DISABLED|ARIA_DISABLED|OUTSIDE_VIEWPORT|POINTER_EVENTS_NONE|HIT_TEST_FAILED)$/u.test(value);

export const coherentCandidateRecord = (value: unknown): BrowserRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return value as BrowserRecord;
};

export const coherentCandidateMachineError = (error: unknown): Error => {
  if (error instanceof Error && /^BROWSER_[A-Z_]+$/u.test(error.message)) return error;
  const stale = error instanceof Error
    && /(?:could not find node|no node with given id|node.*(?:detached|does not exist|not found))/iu.test(error.message);
  return new Error(stale ? "BROWSER_DOM_NODE_STALE" : "BROWSER_DOM_READ_INVALID", { cause: error });
};

export const readCoherentCandidate = async <T>(operation: () => Promise<T>): Promise<T> => {
  try { return await operation(); }
  catch (error) { throw coherentCandidateMachineError(error); }
};

export const coherentCandidateMainFrameLoaderId = async (
  runtime: ExtensionDebuggerRuntime,
  tabId: number,
): Promise<string> => {
  const tree = coherentCandidateRecord(await readCoherentCandidate(() => runtime.send(tabId, "Page.getFrameTree")));
  const frame = coherentCandidateRecord(coherentCandidateRecord(tree.frameTree).frame);
  if (typeof frame.loaderId !== "string" || frame.loaderId.length === 0) {
    throw new Error("BROWSER_DOCUMENT_INVALID");
  }
  return frame.loaderId;
};

export const coherentPointerFromValue = (value: unknown): BrowserPointerAction => {
  if (typeof value === "string" && (/^BROWSER_DOM_(?:CANDIDATE_MISSING|CANDIDATE_AMBIGUOUS|READ_INVALID)$/u.test(value)
    || pointerActionCode(value))) throw new Error(value);
  const point = coherentCandidateRecord(value);
  if (typeof point.x !== "number" || !Number.isFinite(point.x)
    || typeof point.y !== "number" || !Number.isFinite(point.y)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  return Object.freeze({ x: point.x, y: point.y });
};

const bindSatisfiedObservation = async (
  value: unknown,
  target: ExtensionExactTarget,
  postcondition: Readonly<{ queries: readonly BrowserDomPostconditionQuery[] }>,
): Promise<BrowserCoherentObservationResult> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  const specs = postcondition.queries.map(({ expectedEligibleCount: _expected, ...query }) => query);
  const observation = await bindCoherentObservationResult(value, target, specs);
  const satisfied = observation.queries.every((query, index) =>
    query.eligibleCount === postcondition.queries[index]!.expectedEligibleCount);
  if (!satisfied) throw new Error("BROWSER_DOM_READ_INVALID");
  return observation;
};

export const decodeObservationPointerPreparation = async (
  value: unknown,
  target: ExtensionExactTarget,
  postcondition: Readonly<{ queries: readonly BrowserDomPostconditionQuery[] }>,
): Promise<CoherentObservationPointerPreparation> => {
  if (typeof value === "string" && (/^BROWSER_DOM_(?:CANDIDATE_MISSING|CANDIDATE_AMBIGUOUS|READ_INVALID)$/u.test(value)
    || pointerActionCode(value))) throw new Error(value);
  const reply = coherentCandidateRecord(value);
  if ((reply.kind !== "postcondition" && reply.kind !== "pointer") || Object.keys(reply).length !== 2) {
    throw new Error("BROWSER_DOM_READ_INVALID");
  }
  if (reply.kind === "postcondition") return Object.freeze({
    kind: "postcondition",
    observation: await bindSatisfiedObservation(reply.observation, target, postcondition),
  });
  return Object.freeze({ kind: "pointer", point: coherentPointerFromValue(reply.point) });
};

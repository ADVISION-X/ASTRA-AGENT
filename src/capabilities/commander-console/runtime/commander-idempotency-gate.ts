type CommanderIdempotencyPolicy = "idempotent-read" | "dedupe-command" | "hard-stop-non-dedupe";
type CommanderIdempotencyDecision =
  | "not-applicable"
  | "first-execution"
  | "reused-inflight-result"
  | "reused-cached-result"
  | "emergency-bypass";

export type CommanderIdempotencyState = {
  inflight: Map<string, Promise<unknown>>;
  completed: Map<string, unknown>;
};

export function createCommanderIdempotencyState(): CommanderIdempotencyState {
  return {
    inflight: new Map(),
    completed: new Map(),
  };
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function buildIdempotencyKey(input: {
  childCapabilityId: string;
  operatorRef: string;
  payload: unknown;
}): string {
  return `${input.childCapabilityId}:${input.operatorRef}:${stableSerialize(input.payload)}`;
}

export function runCommanderIdempotencyGate<T>(input: {
  state: CommanderIdempotencyState;
  childCapabilityId: string;
  operatorRef: string;
  policy: CommanderIdempotencyPolicy;
  payload: unknown;
  execute: () => Promise<T>;
}): {
  idempotencyDecision: CommanderIdempotencyDecision;
  resultPromise: Promise<T>;
} {
  if (input.policy === "hard-stop-non-dedupe") {
    return {
      idempotencyDecision: "emergency-bypass",
      resultPromise: input.execute(),
    };
  }

  const gateKey = buildIdempotencyKey({
    childCapabilityId: input.childCapabilityId,
    operatorRef: input.operatorRef,
    payload: input.payload,
  });

  if (input.state.completed.has(gateKey)) {
    return {
      idempotencyDecision: "reused-cached-result",
      resultPromise: Promise.resolve(input.state.completed.get(gateKey) as T),
    };
  }

  const inflight = input.state.inflight.get(gateKey);
  if (inflight) {
    return {
      idempotencyDecision: "reused-inflight-result",
      resultPromise: inflight as Promise<T>,
    };
  }

  const resultPromise = input.execute()
    .then((value) => {
      input.state.completed.set(gateKey, value);
      input.state.inflight.delete(gateKey);
      return value;
    })
    .catch((error: unknown) => {
      input.state.inflight.delete(gateKey);
      throw error;
    });

  input.state.inflight.set(gateKey, resultPromise as Promise<unknown>);
  return {
    idempotencyDecision: "first-execution",
    resultPromise,
  };
}
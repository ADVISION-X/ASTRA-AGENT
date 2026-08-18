export const GRASSEYE_BROWSER_PROTOCOL_VERSION = "grasseye-browser-v2" as const;
export const GRASSEYE_BROWSER_RELEASE_IDENTITY = "grasseye-browser-runtime-2026-08-18-v2" as const;
export const GRASSEYE_BROWSER_EXTENSION_ID = "mepfnlhndaiihhfejbbhfehegpbdnipl" as const;
export const GRASSEYE_BROWSER_EXTENSION_VERSION = "2.0.0" as const;
export const GRASSEYE_NATIVE_HOST_NAME = "com.grasseye.browser" as const;

export const GRASSEYE_BROWSER_HOST_TO_EXTENSION_MAX_BYTES = 256 * 1024;
export const GRASSEYE_BROWSER_EXTENSION_TO_HOST_MAX_BYTES = 48 * 1024 * 1024;

export type BrowserWireMutationClass =
  | "observation"
  | "idempotent_mutation"
  | "non_idempotent_mutation";

export type BrowserWireDomElementIdentity = {
  tagName?: string | undefined;
  type?: string | undefined;
  role?: string | undefined;
  ariaLabel?: string | undefined;
  labelText?: string | undefined;
  placeholder?: string | undefined;
  name?: string | undefined;
  id?: string | undefined;
  visibleText?: string | undefined;
  testId?: string | undefined;
};

export type BrowserWireFileGrant = Readonly<{
  grantId: string;
  resolvedPath: string;
  size: number;
  sha256: string;
}>;

export type BrowserWireCommand =
  | {
      kind: "acquire_target";
      url: string;
      reusePolicy:
        | "reuse-exact-url"
        | "bind-existing-exact-url"
        | "bind-existing-exact-origin"
        | "open-new-tab";
      excludedTabIds: readonly number[];
    }
  | { kind: "inspect_target"; tabId: number }
  | { kind: "navigate_target"; tabId: number; url: string }
  | { kind: "evaluate_target"; tabId: number; expression: string }
  | {
      kind: "click_target";
      tabId: number;
      x: number;
      y: number;
      button: "left" | "right" | "middle";
      clickCount: 1 | 2;
    }
  | {
      kind: "click_dom_target";
      tabId: number;
      selector: string;
      identity: BrowserWireDomElementIdentity;
      expectedText?: string;
    }
  | {
      kind: "fill_dom_target";
      tabId: number;
      selector: string;
      identity: BrowserWireDomElementIdentity;
      approvedText: string;
      clearBeforeType: boolean;
    }
  | { kind: "move_target"; tabId: number; x: number; y: number }
  | {
      kind: "scroll_target";
      tabId: number;
      x: number;
      y: number;
      deltaX: number;
      deltaY: number;
    }
  | {
      kind: "text_target";
      tabId: number;
      action: "type-text" | "clear-input" | "press-key";
      text?: string;
      key?: string;
    }
  | { kind: "screenshot_target"; tabId: number }
  | {
      kind: "set_file_input_files";
      tabId: number;
      selector: string;
      fileGrant: BrowserWireFileGrant;
    }
  | { kind: "release_target"; tabId: number }
  | { kind: "close_target"; tabId: number };

export interface BrowserWireTargetDescriptor {
  readonly tabId: number;
  readonly windowId: number;
  readonly url: string;
  readonly title: string;
  readonly frameId: string;
  readonly loaderId: string;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly deviceScaleFactor: number;
  readonly active: boolean;
  readonly windowFocused: boolean;
}

export type BrowserWireCommandPermit = Readonly<{
  authorityId: string;
  authorityCertificateHash: string;
  connectionGeneration: number;
  nativePortEpoch: number;
  commandId: string;
  sequence: number;
  deadlineAt: number;
  permitHash: string;
}>;

export type BrowserWireCommandPayload = Readonly<{
  commandId: string;
  mutationClass: BrowserWireMutationClass;
  expectedLoaderId?: string;
  command: BrowserWireCommand;
}>;

export type BrowserWireResponsePayload = Readonly<{
  commandId: string;
  ok: boolean;
  result?: unknown;
  errorCode?: string;
  errorMessage?: string;
}>;

export type BrowserWireMessage =
  | {
      protocolVersion: typeof GRASSEYE_BROWSER_PROTOCOL_VERSION;
      releaseIdentity: typeof GRASSEYE_BROWSER_RELEASE_IDENTITY;
      type: "extension_hello";
      extensionId: typeof GRASSEYE_BROWSER_EXTENSION_ID;
      extensionVersion: typeof GRASSEYE_BROWSER_EXTENSION_VERSION;
      extensionInstanceId: string;
      nativePortEpoch: number;
    }
  | {
      protocolVersion: typeof GRASSEYE_BROWSER_PROTOCOL_VERSION;
      releaseIdentity: typeof GRASSEYE_BROWSER_RELEASE_IDENTITY;
      type: "controller_challenge";
      controllerSessionId: string;
      connectionGeneration: number;
      nativePortEpoch: number;
      challengeId: string;
      nonce: string;
      controllerPublicKey: string;
    }
  | {
      protocolVersion: typeof GRASSEYE_BROWSER_PROTOCOL_VERSION;
      releaseIdentity: typeof GRASSEYE_BROWSER_RELEASE_IDENTITY;
      type: "extension_authenticated";
      extensionInstanceId: string;
      nativePortEpoch: number;
      challengeId: string;
      nonce: string;
      extensionPublicKey: string;
      transcriptProof: string;
    }
  | {
      protocolVersion: typeof GRASSEYE_BROWSER_PROTOCOL_VERSION;
      releaseIdentity: typeof GRASSEYE_BROWSER_RELEASE_IDENTITY;
      type: "authority_grant";
      authorityId: string;
      authorityCertificateHash: string;
      connectionGeneration: number;
      nativePortEpoch: number;
      grantProof: string;
    }
  | {
      protocolVersion: typeof GRASSEYE_BROWSER_PROTOCOL_VERSION;
      releaseIdentity: typeof GRASSEYE_BROWSER_RELEASE_IDENTITY;
      type: "heartbeat";
      authorityId: string;
      connectionGeneration: number;
      nativePortEpoch: number;
      monotonicMs: number;
      proof: string;
    }
  | {
      protocolVersion: typeof GRASSEYE_BROWSER_PROTOCOL_VERSION;
      releaseIdentity: typeof GRASSEYE_BROWSER_RELEASE_IDENTITY;
      type: "command_frame";
      permit: BrowserWireCommandPermit;
      iv: string;
      ciphertext: string;
    }
  | {
      protocolVersion: typeof GRASSEYE_BROWSER_PROTOCOL_VERSION;
      releaseIdentity: typeof GRASSEYE_BROWSER_RELEASE_IDENTITY;
      type: "response_frame";
      permitHash: string;
      authorityId: string;
      connectionGeneration: number;
      nativePortEpoch: number;
      sequence: number;
      iv: string;
      ciphertext: string;
    };

const isNonEmptyString = (value: unknown, max = 8_192): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isPositiveSafeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;

const isBase64 = (value: unknown, max = GRASSEYE_BROWSER_EXTENSION_TO_HOST_MAX_BYTES * 2): value is string =>
  isNonEmptyString(value, max) && /^[A-Za-z0-9+/]+={0,2}$/u.test(value);

const hasWireIdentity = (record: Record<string, unknown>): boolean =>
  record.protocolVersion === GRASSEYE_BROWSER_PROTOCOL_VERSION
  && record.releaseIdentity === GRASSEYE_BROWSER_RELEASE_IDENTITY;

const isBrowserWireCommandPermit = (value: unknown): value is BrowserWireCommandPermit => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.authorityId)
    && isNonEmptyString(record.authorityCertificateHash)
    && isPositiveSafeInteger(record.connectionGeneration)
    && isPositiveSafeInteger(record.nativePortEpoch)
    && isNonEmptyString(record.commandId)
    && isPositiveSafeInteger(record.sequence)
    && isFiniteNumber(record.deadlineAt)
    && isNonEmptyString(record.permitHash);
};

export const isBrowserWireMessage = (value: unknown): value is BrowserWireMessage => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (!hasWireIdentity(record) || typeof record.type !== "string") return false;
  if (record.type === "extension_hello") {
    return record.extensionId === GRASSEYE_BROWSER_EXTENSION_ID
      && record.extensionVersion === GRASSEYE_BROWSER_EXTENSION_VERSION
      && isNonEmptyString(record.extensionInstanceId)
      && isPositiveSafeInteger(record.nativePortEpoch);
  }
  if (record.type === "controller_challenge") {
    return isNonEmptyString(record.controllerSessionId)
      && isPositiveSafeInteger(record.connectionGeneration)
      && isPositiveSafeInteger(record.nativePortEpoch)
      && isNonEmptyString(record.challengeId)
      && isBase64(record.nonce, 256)
      && isBase64(record.controllerPublicKey, 512);
  }
  if (record.type === "extension_authenticated") {
    return isNonEmptyString(record.extensionInstanceId)
      && isPositiveSafeInteger(record.nativePortEpoch)
      && isNonEmptyString(record.challengeId)
      && isBase64(record.nonce, 256)
      && isBase64(record.extensionPublicKey, 512)
      && isBase64(record.transcriptProof, 512);
  }
  if (record.type === "authority_grant") {
    return isNonEmptyString(record.authorityId)
      && isNonEmptyString(record.authorityCertificateHash)
      && isPositiveSafeInteger(record.connectionGeneration)
      && isPositiveSafeInteger(record.nativePortEpoch)
      && isBase64(record.grantProof, 512);
  }
  if (record.type === "heartbeat") {
    return isNonEmptyString(record.authorityId)
      && isPositiveSafeInteger(record.connectionGeneration)
      && isPositiveSafeInteger(record.nativePortEpoch)
      && isFiniteNumber(record.monotonicMs)
      && isBase64(record.proof, 512);
  }
  if (record.type === "command_frame") {
    return isBrowserWireCommandPermit(record.permit)
      && isBase64(record.iv, 128)
      && isBase64(record.ciphertext, GRASSEYE_BROWSER_HOST_TO_EXTENSION_MAX_BYTES * 2);
  }
  if (record.type === "response_frame") {
    return isNonEmptyString(record.permitHash)
      && isNonEmptyString(record.authorityId)
      && isPositiveSafeInteger(record.connectionGeneration)
      && isPositiveSafeInteger(record.nativePortEpoch)
      && isPositiveSafeInteger(record.sequence)
      && isBase64(record.iv, 128)
      && isBase64(record.ciphertext, GRASSEYE_BROWSER_EXTENSION_TO_HOST_MAX_BYTES * 2);
  }
  return false;
};

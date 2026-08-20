export const GRASSEYE_BROWSER_PROTOCOL_VERSION = "grasseye-browser-v3" as const;
export const GRASSEYE_BROWSER_PROTOCOL_REVISION = 3 as const;
export const GRASSEYE_BROWSER_RELEASE_IDENTITY =
  "grasseye-browser-runtime-2026-08-20-v3" as const;
export const GRASSEYE_BROWSER_EXTENSION_ID =
  "mepfnlhndaiihhfejbbhfehegpbdnipl" as const;
export const GRASSEYE_BROWSER_EXTENSION_VERSION = "3.0.0" as const;
const GRASSEYE_NATIVE_HOST_NAME = "com.grasseye.browser" as const;
export const GRASSEYE_BROWSER_HOST_TO_EXTENSION_CONTROL_MAX_BYTES = 256 * 1024;
const GRASSEYE_BROWSER_EXTENSION_TO_HOST_CONTROL_MAX_BYTES = 256 * 1024;
export const GRASSEYE_BROWSER_ARTIFACT_CHUNK_MAX_BYTES = 4 * 1024 * 1024;
export const GRASSEYE_BROWSER_CONTROLLER_HOST_CONTROL_MAX_BYTES = 256 * 1024;
export const GRASSEYE_BROWSER_CAPABILITY_SET_HASH =
  "sha256:90c585d70a7128486ead1b6dbffabb7b938b2fbf4ca844382d0fdabe1117f8e6" as const;
export const GRASSEYE_BROWSER_PERMISSION_POLICY_HASH =
  "sha256:4b0dfc4e4f3d6a702215cec35be9466cba053244d73059ade2a7aadf4dbd7a10" as const;
export const GRASSEYE_BROWSER_ORIGIN_POLICY_HASH =
  "sha256:60d573e4c4f97964cf977139388e4a234d7c1524b3e40dff3d8548f28a15217d" as const;
export const GRASSEYE_BROWSER_LIVENESS_POLICY_HASH =
  "sha256:37f4b7b50901bc8a4350454202c61592df17a2c12dac27e5cdcac24bb7404b06" as const;
const GRASSEYE_BROWSER_COMMAND_ADMISSION_BUDGET_HASH =
  "sha256:9a774268a8fa77235a17bbd065da3587bc89c56c05dab08248d1c862f548b162" as const;
const GRASSEYE_BROWSER_ARTIFACT_STREAM_BUDGET_HASH =
  "sha256:f2137e38dbb0f8fd0f98a964310ac6417e457114db174211a97a7013feab9255" as const;
type Hash = `sha256:${string}`;
export type BrowserWireMutationClass =
  "observation" | "idempotent_mutation" | "non_idempotent_mutation";
export type BrowserCapabilityId =
  | "target.acquire.v1"
  | "target.inspect.v1"
  | "target.navigate.v1"
  | "dom.click.v1"
  | "dom.fill.v1"
  | "dom.snapshot.structural.v1"
  | "input.pointer.v1"
  | "input.scroll.v1"
  | "input.text.v1"
  | "page.screenshot.v1"
  | "file.set-input.v1"
  | "file.artifact-chunk.v1"
  | "target.release.v1"
  | "target.close.v1"
  | "video.media-probe.universal.v1"
  | "video.media-probe.tiktok.v1"
  | "video.media-probe.facebook.v1";
type BrowserObservationCapabilityId = Extract<
  BrowserCapabilityId,
  `video.${string}` | "dom.snapshot.structural.v1"
>;
export type BrowserWireTargetDescriptor = Readonly<{
  tabId: number;
  windowId: number;
  loaderId: string;
  url: string;
  title: string;
  viewportWidth: number;
  viewportHeight: number;
  deviceScaleFactor: number;
}>;
type BrowserWireDomElementIdentity = Readonly<{
  tagName?: string;
  type?: string;
  role?: string;
  ariaLabel?: string;
  labelText?: string;
  placeholder?: string;
  name?: string;
  id?: string;
  visibleText?: string;
  testId?: string;
}>;
type BrowserWireFileGrant = Readonly<{
  grantRef: string;
  artifactRef: string;
  fileName: string;
  authorityEpoch: number;
  executionFenceHash: Hash;
  approvedRootHash: Hash;
  canonicalRealpathHash: Hash;
  deviceIdHash: Hash;
  inodeHash: Hash;
  byteLength: number;
  contentHash: Hash;
  expiresAtMonotonicMs: number;
}>;
export type BrowserWireCommand =
  | Readonly<{
      kind: "acquire_target";
      url: string;
      reusePolicy:
        | "reuse-exact-url"
        | "bind-existing-exact-url"
        | "bind-existing-exact-origin"
        | "open-new-tab";
      excludedTabIds: number[];
    }>
  | Readonly<{ kind: "inspect_target"; tabId: number }>
  | Readonly<{ kind: "navigate_target"; tabId: number; url: string }>
  | Readonly<{
      kind: "observe_capability";
      tabId: number;
      capabilityId: BrowserObservationCapabilityId;
    }>
  | Readonly<{
      kind: "click_target";
      tabId: number;
      x: number;
      y: number;
      button: "left" | "right" | "middle";
      clickCount: 1 | 2;
    }>
  | Readonly<{ kind: "move_target"; tabId: number; x: number; y: number }>
  | Readonly<{
      kind: "scroll_target";
      tabId: number;
      x: number;
      y: number;
      deltaX: number;
      deltaY: number;
    }>
  | Readonly<{
      kind: "click_dom_target";
      tabId: number;
      selector: string;
      identity: BrowserWireDomElementIdentity;
      expectedText?: string;
    }>
  | Readonly<{
      kind: "fill_dom_target";
      tabId: number;
      selector: string;
      identity: BrowserWireDomElementIdentity;
      approvedText: string;
      clearBeforeType: boolean;
    }>
  | Readonly<{
      kind: "text_target";
      tabId: number;
      action: "type-text" | "clear-input" | "press-key";
      text?: string;
      key?: string;
    }>
  | Readonly<{ kind: "screenshot_target"; tabId: number }>
  | Readonly<{
      kind: "stage_file_artifact_chunk";
      tabId: number;
      grantRef: string;
      artifactRef: string;
      fileName: string;
      contentHash: Hash;
      byteLength: number;
      chunkIndex: number;
      chunkCount: number;
      dataBase64: string;
    }>
  | Readonly<{
      kind: "set_file_input_artifact";
      tabId: number;
      selector: string;
      fileGrant: BrowserWireFileGrant;
    }>
  | Readonly<{ kind: "release_target"; tabId: number }>
  | Readonly<{ kind: "close_target"; tabId: number }>;
export { capabilityIdForCommand } from "./browser-protocol-capability-map.js";
export type BrowserCommandPermit = Readonly<{
  authorityRef: string;
  authorityEpoch: number;
  authorityCertificateHash: Hash;
  activationTupleHash: Hash;
  replyChannelToken: string;
  capabilityId: BrowserCapabilityId;
  executionBindingHash: Hash;
  writerFenceHash: Hash;
  targetLeaseRef: string;
  documentRef: string;
  commandId: string;
  sequence: number;
  deadlineMonotonicMs: number;
  mutationClass: BrowserWireMutationClass;
  permitHash: Hash;
}>;
type BrowserWireCommandPayload = Readonly<{
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
type Base = Readonly<{
  protocolVersion: typeof GRASSEYE_BROWSER_PROTOCOL_VERSION;
  releaseIdentity: typeof GRASSEYE_BROWSER_RELEASE_IDENTITY;
}>;
export type BrowserWireMessage =
  | (Base &
      Readonly<{
        type: "extension_hello";
        extensionId: string;
        extensionVersion: string;
        extensionInstanceId: string;
        extensionArtifactDigest: Hash;
        nativePortEpoch: number;
        supportedActivationTupleIds: string[];
        capabilitySetHash: Hash;
        permissionPolicyHash: Hash;
        originPolicyHash: Hash;
      }>)
  | (Base &
      Readonly<{
        type: "controller_challenge";
        controllerIncarnationHash: Hash;
        connectionGeneration: number;
        nativePortEpoch: number;
        challengeId: string;
        controllerNonce: string;
        controllerPublicKey: string;
        activationTupleId: string;
        activationTupleHash: Hash;
        transcriptPrefixHash: Hash;
      }>)
  | (Base &
      Readonly<{
        type: "extension_authenticated";
        extensionInstanceId: string;
        nativePortEpoch: number;
        challengeId: string;
        extensionNonce: string;
        extensionPublicKey: string;
        transcriptProof: string;
      }>)
  | (Base &
      Readonly<{
        type: "capability_probe";
        probeId: string;
        nativePortEpoch: number;
        activationTupleHash: Hash;
        capabilitySetHash: Hash;
        permissionPolicyHash: Hash;
        originPolicyHash: Hash;
        maxControlFrameBytes: number;
        proof: string;
      }>)
  | (Base &
      Readonly<{
        type: "capability_probe_ack";
        probeId: string;
        nativePortEpoch: number;
        capabilitySetHash: Hash;
        permissionPolicyHash: Hash;
        originPolicyHash: Hash;
        debuggerAvailable: true;
        maxControlFrameBytes: number;
        proof: string;
      }>)
  | (Base &
      Readonly<{
        type: "authority_grant";
        authorityRef: string;
        authorityEpoch: number;
        authorityCertificateHash: Hash;
        connectionGeneration: number;
        nativePortEpoch: number;
        challengeId: string;
        livenessLeaseEpoch: number;
        grantProof: string;
      }>)
  | (Base &
      Readonly<{
        type: "authority_grant_ack";
        authorityRef: string;
        authorityEpoch: number;
        authorityCertificateHash: Hash;
        connectionGeneration: number;
        nativePortEpoch: number;
        challengeId: string;
        livenessLeaseEpoch: number;
        ackProof: string;
      }>)
  | (Base &
      Readonly<{
        type: "heartbeat_probe";
        authorityRef: string;
        authorityEpoch: number;
        livenessLeaseEpoch: number;
        connectionGeneration: number;
        nativePortEpoch: number;
        heartbeatSequence: number;
        monotonicMs: number;
        proof: string;
      }>)
  | (Base &
      Readonly<{
        type: "heartbeat";
        authorityRef: string;
        authorityEpoch: number;
        livenessLeaseEpoch: number;
        connectionGeneration: number;
        nativePortEpoch: number;
        heartbeatSequence: number;
        monotonicMs: number;
        proof: string;
      }>)
  | (Base &
      Readonly<{
        type: "command_frame";
        permit: BrowserCommandPermit;
        iv: string;
        ciphertext: string;
      }>)
  | (Base &
      Readonly<{
        type: "response_frame";
        replyChannelToken: string;
        permitHash: Hash;
        authorityRef: string;
        authorityEpoch: number;
        sequence: number;
        iv: string;
        ciphertext: string;
      }>);
export { isBrowserWireMessage } from "./browser-protocol-message-validator.js";

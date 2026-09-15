import { createHash, randomUUID } from "node:crypto";
import type { BrowserAuthorityCertificateV1 } from "../infrastructure/browser-authority-certificate.js";
import { hashBrowserAuthorityCertificate } from "../infrastructure/browser-authority-certificate.js";
import type { BrowserCommandActor } from "./browser-command-actor.js";
import type { BrowserCapabilityId } from "../protocol/generated/browser-protocol.generated.js";
import type { BrowserCommandPermit, BrowserUnsignedCommandPermit } from "../transport/command-permit.js";
import {
  assertBrowserAtomicStepIdentity,
  type BrowserApprovedArtifactRef,
  type BrowserTargetLease,
} from "./browser-target-lease.js";
import type { BrowserControlledTarget, BrowserDocumentRef } from "./browser-target-ref.js";
import type { BrowserDomIntent } from "./browser-dom-intent.js";
import type { BrowserFileArtifactGrantV1 } from "./browser-file-artifact-grant.js";
import type { BrowserExecutionBinding } from "../infrastructure/browser-authority-broker.js";
import type { BrowserSessionWorkspace } from "./browser-session-workspace.js";
import type { BrowserOutcomeResolutionReceipt } from "./browser-outcome-resolver.js";
import { browserExecutionFailure } from "../browser-failure.js";
import { requireCanonicalGptConversationUrl } from "./browser-site-policy-registry.js";
export type { SessionWorkspaceBindingV6 } from "./browser-session-workspace.js";

export type BrowserExactTargetAcquisition = Readonly<{
  target: BrowserControlledTarget;
  ownerId: string;
}>;

export type BrowserCommandPermitSigner = Readonly<{
  signCurrentCommandPermit(permit: BrowserUnsignedCommandPermit): `sha256:${string}`;
}>;

type LeaseState = {
  current: BrowserControlledTarget;
  closed: boolean;
  commandInFlight: boolean;
  sequence: number;
  pendingMutationCommandIds: string[];
  atomicStep: Parameters<BrowserTargetLease["runAtomicStep"]>[0] | null;
};

type LeaseCommand = (
  capabilityId: BrowserCapabilityId,
  value: Parameters<BrowserCommandActor["execute"]>[1],
) => Promise<unknown>;

type AuthenticatedMedia = Awaited<ReturnType<BrowserTargetLease["readAuthenticatedMedia"]>>;
type BrowserArtifactOperations = Readonly<{
  resolveGrantPaths: (grants: readonly BrowserFileArtifactGrantV1[]) => Promise<readonly string[]>;
  issueApprovedArtifactGrants: (
    artifacts: readonly BrowserApprovedArtifactRef[],
  ) => Promise<readonly BrowserFileArtifactGrantV1[]>;
}>;

const hashText = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const authenticatedMediaBytesValid = (value: Readonly<Record<string, unknown>>): boolean =>
  typeof value.bytesBase64 === "string"
  && typeof value.sha256 === "string"
  && /^sha256:[a-f0-9]{64}$/u.test(value.sha256)
  && typeof value.sizeBytes === "number"
  && Number.isSafeInteger(value.sizeBytes)
  && value.sizeBytes >= 1
  && value.sizeBytes <= 25 * 1024 * 1024;

const authenticatedMediaShapeValid = (value: Readonly<Record<string, unknown>>): boolean =>
  typeof value.authorityTargetHash === "string"
  && /^sha256:[a-f0-9]{64}$/u.test(value.authorityTargetHash)
  && typeof value.authorityDocumentHash === "string"
  && /^sha256:[a-f0-9]{64}$/u.test(value.authorityDocumentHash)
  && typeof value.assistantTurnId === "string"
  && /^conversation-turn-[1-9][0-9]*$/u.test(value.assistantTurnId)
  && typeof value.precedingUserTurnId === "string"
  && /^conversation-turn-[1-9][0-9]*$/u.test(value.precedingUserTurnId)
  && typeof value.currentUrl === "string"
  && value.semanticMediaId === "gpt-generated-image-main"
  && typeof value.mediaType === "string"
  && /^image\/[a-z0-9.+-]+$/u.test(value.mediaType);

const parseAuthenticatedMedia = (raw: unknown): AuthenticatedMedia => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  const value = raw as Readonly<Record<string, unknown>>;
  if (!authenticatedMediaBytesValid(value) || !authenticatedMediaShapeValid(value)) {
    throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  }
  return value as AuthenticatedMedia;
};

export class BrowserTargetLeaseManager {
  public constructor(
    private readonly certificate: BrowserAuthorityCertificateV1,
    private readonly executionBinding: BrowserExecutionBinding,
    private readonly commandActor: BrowserCommandActor,
    private readonly permitSigner: BrowserCommandPermitSigner,
    private readonly workspace: BrowserSessionWorkspace | undefined,
    private readonly resolveCurrentTarget: () => BrowserControlledTarget | null,
    private readonly artifactOperations: BrowserArtifactOperations,
  ) {}

  public acquire(input: BrowserExactTargetAcquisition): BrowserTargetLease {
    this.assertAcquisition(input);
    const state: LeaseState = {
      current: input.target,
      closed: false,
      commandInFlight: false,
      sequence: 0,
      pendingMutationCommandIds: [...this.commandActor.pendingMutationCommandIds(this.executionBinding)],
      atomicStep: null,
    };
    const leaseRef = `target-lease-${randomUUID()}`;
    const command = this.createLeaseCommand(input, state, leaseRef);
    return this.createTargetLease(input, state, leaseRef, command);
  }

  private assertAcquisition(input: BrowserExactTargetAcquisition): void {
    if (!this.workspace) throw new Error("BROWSER_SESSION_WORKSPACE_REQUIRED");
    this.workspace.assertCurrent();
    if (!Number.isInteger(this.executionBinding.commandTtlMs)
      || this.executionBinding.commandTtlMs < 1
      || this.executionBinding.commandTtlMs > 3_600_000) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
    if (
      input.target.target.authorityEpoch !== this.certificate.authorityEpoch
      || input.target.target.executionBindingHash !== this.executionBinding.executionRefHash
      || input.target.document.targetRef !== input.target.target.targetRef
    ) {
      throw new Error("BROWSER_TARGET_INVALID");
    }
  }

  private assertCommandAdmission(
    state: LeaseState,
    value: Parameters<BrowserCommandActor["execute"]>[1],
  ): void {
    if (state.closed) throw new Error("BROWSER_TARGET_INVALID");
    if (state.commandInFlight) throw new Error("BROWSER_BACKPRESSURE");
    const mutationClass = this.mutationClass(value);
    if (mutationClass !== "observation" && value.kind !== "park-target"
      && state.pendingMutationCommandIds.length > 0) {
      throw new Error("BROWSER_MUTATION_UNSETTLED");
    }
    if (mutationClass === "mutation" && state.atomicStep === null) {
      throw new Error("BROWSER_ATOMIC_STEP_IDENTITY_REQUIRED");
    }
  }

  private currentCommandTarget(input: BrowserExactTargetAcquisition, state: LeaseState): BrowserControlledTarget {
    this.workspace?.assertCurrent();
    const current = this.resolveCurrentTarget();
    if (!current || current.target.targetRef !== input.target.target.targetRef
      || current.target.authorityEpoch !== input.target.target.authorityEpoch
      || current.target.executionBindingHash !== this.executionBinding.executionRefHash
      || current.document.targetRef !== current.target.targetRef
      || current.document.navigationEpoch < state.current.document.navigationEpoch) {
      throw new Error("BROWSER_DOCUMENT_INVALID");
    }
    return current;
  }

  private createLeaseCommand(
    input: BrowserExactTargetAcquisition,
    state: LeaseState,
    leaseRef: string,
  ): LeaseCommand {
    return async (capabilityId, value) => {
      this.assertCommandAdmission(state, value);
      state.commandInFlight = true;
      let permit: BrowserCommandPermit | null = null;
      try {
        await this.commandActor.awaitPostSubmitQuiet();
        state.current = this.currentCommandTarget(input, state);
        const sequence = ++state.sequence;
        const step = state.atomicStep ?? {
          productStepId: "browser-lifecycle",
          callId: `lifecycle:${sequence}`,
          childCapabilityId: capabilityId,
          inputHash: hashText(this.executionBinding.executionRef),
          actionOrdinal: sequence,
          replayPolicy: "observation-only" as const,
        };
        permit = this.permit({
          leaseRef,
          sequence,
          targetRef: input.target.target.targetRef,
          documentRef: state.current.document.documentRef,
          productStepId: step.productStepId,
          callId: step.callId,
          childCapabilityId: step.childCapabilityId,
          inputHash: step.inputHash,
          replayPolicy: step.replayPolicy,
          actionOrdinal: step.actionOrdinal,
          capabilityId,
          mutationClass: this.mutationClass(value),
        });
        const result = await this.commandActor.execute(permit, value);
        if (value.kind === "dom-intent" && value.intent.kind === "selectExactGptConversation") {
          const document = result as BrowserDocumentRef | null;
          if (typeof document?.documentRef !== "string" || document.targetRef !== state.current.target.targetRef
            || !Number.isInteger(document.navigationEpoch)
            || document.navigationEpoch < state.current.document.navigationEpoch) throw new Error("BROWSER_DOCUMENT_INVALID");
          state.current = { ...state.current, document };
        }
        return result;
      } catch (error) {
        if (!permit) throw browserExecutionFailure(error);
        const mutationOutcome = this.commandActor.mutationOutcome(permit.commandId);
        const browserOutcome = this.commandActor.browserOutcome(permit.commandId);
        if (browserOutcome === "DISPATCHED") state.pendingMutationCommandIds.push(permit.commandId);
        throw browserExecutionFailure(error, mutationOutcome, browserOutcome ? {
          effectScope: permit.replayPolicy === "provider-effect-once" ? "provider_effect" : "target_local",
          childCapabilityId: permit.childCapabilityId,
          browserOutcome,
        } : null);
      } finally {
        state.commandInFlight = false;
      }
    };
  }

  private createTargetLease(
    input: BrowserExactTargetAcquisition,
    state: LeaseState,
    leaseRef: string,
    command: LeaseCommand,
  ): BrowserTargetLease {
    return {
      leaseRef,
      authorityRef: this.certificate.authorityRef,
      authorityEpoch: this.certificate.authorityEpoch,
      executionBindingHash: this.executionBinding.executionRefHash,
      ownerId: input.ownerId,
      agentJobRefHash: this.executionBinding.jobRefHash,
      agentExecutionRefHash: this.executionBinding.executionRefHash,
      writerLeaseEpoch: this.executionBinding.writerLeaseEpoch,
      writerFenceHash: this.executionBinding.writerFenceHash,
      target: input.target.target,
      get document() { return state.current.document; },
      runAtomicStep: async (identity, action) => {
        assertBrowserAtomicStepIdentity(identity);
        if (state.atomicStep !== null) {
          throw new Error("BROWSER_ATOMIC_STEP_IDENTITY_INVALID");
        }
        state.atomicStep = Object.freeze({ ...identity });
        try {
          return await action();
        } finally {
          state.atomicStep = null;
        }
      },
      readAtomicStepOutcome: (identity) =>
        this.commandActor.readAtomicStepOutcome(this.executionBinding, input.target.target.targetRef, identity),
      executeDomIntent: async (intent: BrowserDomIntent) => command(this.capabilityForIntent(intent), { kind: "dom-intent", intent }),
      observeCapability: async ({ capabilityId }) => command(capabilityId, { kind: "observe", capabilityId }),
      captureScreenshot: ({ regionLabel }) => this.captureScreenshot(command, regionLabel),
      attachFile: async ({ selector, activation, approvedArtifacts }) => this.attachFile(
        command, selector, activation,
        await this.artifactOperations.issueApprovedArtifactGrants(approvedArtifacts),
      ),
      readAuthenticatedMedia: (media) => this.readAuthenticatedMedia(state, command, media),
      wait: async ({ durationMs }) => { await command("browser.wait.v1", { kind: "wait", durationMs }); },
      park: async ({ reason, mode }) => {
        if (mode !== "product-call-settlement") {
          throw new Error("BROWSER_PARK_MODE_INVALID");
        }
        await command("browser.park-target.v1", { kind: "park-target", reason });
        state.closed = true;
      },
      resolvePendingMutation: (receipt) => this.resolvePendingMutation(state, receipt),
      pendingMutationCount: () => state.pendingMutationCommandIds.length,
    };
  }

  private async captureScreenshot(command: LeaseCommand, regionLabel: string): Promise<Readonly<{
    artifactRef: string;
    contentHash: `sha256:${string}`;
  }>> {
    const result = await command("browser.screenshot.v1", { kind: "screenshot", regionLabel });
    const artifact = result as { artifactRef?: unknown; contentHash?: unknown };
    if (typeof artifact.artifactRef !== "string" || typeof artifact.contentHash !== "string") {
      throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    }
    return { artifactRef: artifact.artifactRef, contentHash: artifact.contentHash as `sha256:${string}` };
  }

  private async attachFile(
    command: LeaseCommand,
    selector: string,
    activation: Parameters<BrowserTargetLease["attachFile"]>[0]["activation"],
    grants: readonly BrowserFileArtifactGrantV1[],
  ): Promise<void> {
    if (grants.length === 0 || grants.length > 20 || new Set(grants.map((grant) => grant.grantRef)).size !== grants.length) {
      throw new Error("BROWSER_FILE_GRANT_INVALID");
    }
    if (grants.some((grant) => grant.authorityEpoch !== this.certificate.authorityEpoch
      || grant.executionBindingHash !== this.executionBinding.executionRefHash)) {
      throw new Error("BROWSER_FILE_GRANT_INVALID");
    }
    const resolvedFilePaths = await this.artifactOperations.resolveGrantPaths(grants);
    await command("browser.file-input.v1", {
      kind: "file-input",
      selector,
      activation,
      approvedFiles: grants.map(({ grantRef, contentHash, maxBytes }) => ({
        grantRef,
        contentHash,
        maxBytes,
      })),
      resolvedFilePaths,
    });
  }

  private async readAuthenticatedMedia(
    state: LeaseState,
    command: LeaseCommand,
    input: Readonly<{
      canonicalConversationUrl: string;
      userTurnId: string;
      semanticMediaId: "gpt-generated-image-main";
    }>,
  ): Promise<AuthenticatedMedia> {
    try {
      if (requireCanonicalGptConversationUrl(input.canonicalConversationUrl)
        !== input.canonicalConversationUrl
        || !/^conversation-turn-[1-9][0-9]*$/u.test(input.userTurnId)
        || input.semanticMediaId !== "gpt-generated-image-main") throw new Error();
    } catch {
      throw new Error("BROWSER_TARGET_INVALID");
    }
    const raw = await command("browser.authenticated-media.v1", {
      kind: "authenticated-media",
      canonicalConversationUrl: input.canonicalConversationUrl,
      userTurnId: input.userTurnId,
      semanticMediaId: input.semanticMediaId,
    });
    const value = parseAuthenticatedMedia(raw);
    if (value.precedingUserTurnId !== input.userTurnId
      || value.currentUrl !== input.canonicalConversationUrl
      || value.semanticMediaId !== input.semanticMediaId
      || value.authorityTargetHash !== hashText(state.current.target.targetRef)
      || value.authorityDocumentHash !== hashText(state.current.document.documentRef)) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    const bytes = Buffer.from(value.bytesBase64, "base64");
    const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    if (bytes.byteLength !== value.sizeBytes || digest !== value.sha256) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    return value;
  }

  private async resolvePendingMutation(
    state: LeaseState,
    receipt: Omit<BrowserOutcomeResolutionReceipt, "commandId">,
  ): Promise<number> {
    const commandIds = [...state.pendingMutationCommandIds];
    const commandId = commandIds[0];
    if (commandIds.length !== 1 || commandId === undefined) throw new Error("BROWSER_MUTATION_UNSETTLED");
    await this.commandActor.resolveDispatchedMutation({ ...receipt, commandId });
    state.pendingMutationCommandIds.splice(state.pendingMutationCommandIds.indexOf(commandId), 1);
    return 1;
  }

  private permit(input: Readonly<{
    leaseRef: string;
    sequence: number;
    targetRef: string;
    documentRef: string;
    productStepId: string;
    callId: string;
    childCapabilityId: string;
    inputHash: `sha256:${string}`;
    replayPolicy: BrowserCommandPermit["replayPolicy"];
    actionOrdinal: number;
    capabilityId: BrowserCapabilityId;
    mutationClass: BrowserCommandPermit["mutationClass"];
  }>): BrowserCommandPermit {
    const commandId = randomUUID();
    const replyChannelToken = randomUUID();
    const certificateHash = hashBrowserAuthorityCertificate(this.certificate);
    const authorityPermit = {
      permitRef: randomUUID(),
      authorityRef: this.certificate.authorityRef,
      authorityEpoch: this.certificate.authorityEpoch,
      certificateHash,
      channelSessionHash: this.certificate.channelSessionHash,
      executionBindingHash: this.executionBinding.executionRefHash,
      writerFenceHash: this.executionBinding.writerFenceHash,
      candidateHash: this.executionBinding.candidateHash,
      contractManifestHash: this.executionBinding.contractManifestHash,
    };
    const executionPermit = {
      jobId: this.executionBinding.jobId,
      resultRevision: this.executionBinding.resultRevision,
      attemptId: this.executionBinding.attemptId,
      deviceId: this.executionBinding.deviceId,
      leaseVersion: this.executionBinding.leaseVersion,
      localOrderId: this.executionBinding.localOrderId,
      targetLeaseRef: input.leaseRef,
      targetRef: input.targetRef,
      documentRef: input.documentRef,
      productStepId: input.productStepId,
      callId: input.callId,
      childCapabilityId: input.childCapabilityId,
      inputHash: input.inputHash,
      replayPolicy: input.replayPolicy,
      actionOrdinal: input.actionOrdinal,
      capabilityId: input.capabilityId,
      commandId,
      sequence: input.sequence,
      mutationClass: input.mutationClass,
      workspaceRef: this.workspace?.ref() ?? "",
      commandTtlMs: this.executionBinding.commandTtlMs,
      replyChannelToken,
    };
    const unsigned: BrowserUnsignedCommandPermit = { ...authorityPermit, ...executionPermit };
    return {
      ...unsigned,
      commandFrameMac: this.permitSigner.signCurrentCommandPermit(unsigned),
    };
  }

  private mutationClass(command: Parameters<BrowserCommandActor["execute"]>[1]): BrowserCommandPermit["mutationClass"] {
    if ((command.kind === "dom-intent" && command.intent.kind === "selectExactGptConversation")
      || command.kind === "park-target") return "lifecycle";
    if (command.kind === "file-input") return "mutation";
    if (command.kind === "dom-intent" && (command.intent.kind === "click" || command.intent.kind === "hover"
      || command.intent.kind === "doubleClick" || command.intent.kind === "keypress" || command.intent.kind === "fill"
      || command.intent.kind === "renameExactGptConversation"
      || command.intent.kind === "acknowledgeKnownGptRateLimit")) return "mutation";
    return "observation";
  }

  private capabilityForIntent(intent: BrowserDomIntent): BrowserCapabilityId {
    const capabilities: Readonly<Record<BrowserDomIntent["kind"], BrowserCapabilityId>> = {
      document: "browser.dom.inspect.v1",
      observe: "browser.dom.inspect.v1",
      readExactAssistantTurn: "browser.dom.inspect.v1",
      inspect: "browser.dom.inspect.v1",
      find: "browser.dom.find.v1",
      readText: "browser.dom.read-text.v1",
      readAttribute: "browser.dom.read-attribute.v1",
      selectExactGptConversation: "browser.dom.click.v1",
      renameExactGptConversation: "browser.dom.click.v1",
      acknowledgeKnownGptRateLimit: "browser.dom.click.v1",
      readKnownGptRateLimitClearance: "browser.dom.inspect.v1",
      click: "browser.dom.click.v1",
      hover: "browser.dom.hover.v1",
      doubleClick: "browser.dom.double-click.v1",
      keypress: "browser.dom.keypress.v1",
      fill: "browser.dom.fill.v1",
    };
    return capabilities[intent.kind];
  }
}

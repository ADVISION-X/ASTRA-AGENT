import type net from "node:net";

import type { BrowserOwnerLock } from "../infrastructure/browser-owner-lock.js";
import type { AuthenticatedControllerHostChannel } from "./authenticated-controller-host-channel.js";
import type { RawControllerHostChannel } from "./raw-controller-host-channel.js";
import type { ReplyChannelToken } from "./reply-channel-token.js";
import {
  initialBrowserTransportReducerState,
  type BrowserTransportReducerState,
} from "./transport-reducer.js";
import type { BrowserAuthenticatedTransportContext } from "./transport-authenticator.js";

export type TransportHostCandidate = {
  raw: RawControllerHostChannel;
  channel: AuthenticatedControllerHostChannel | null;
  context: BrowserAuthenticatedTransportContext | null;
  buffer: string;
  generation: number;
  sourceChannelToken: string;
};

export type TransportActorRuntime = {
  state: BrowserTransportReducerState;
  ownerLock: BrowserOwnerLock | null;
  server: net.Server | null;
  candidate: TransportHostCandidate | null;
  mailbox: Promise<void>;
  generation: number;
  replyChannel: ReplyChannelToken | null;
  watchdog: NodeJS.Timeout | null;
  lastHeartbeatProbeAt: number;
};

export const monotonicEpochMs = (): number =>
  performance.timeOrigin + performance.now();

export const createTransportActorRuntime = (): TransportActorRuntime => ({
  state: initialBrowserTransportReducerState(),
  ownerLock: null,
  server: null,
  candidate: null,
  mailbox: Promise.resolve(),
  generation: 0,
  replyChannel: null,
  watchdog: null,
  lastHeartbeatProbeAt: 0,
});

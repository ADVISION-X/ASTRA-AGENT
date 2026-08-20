import type net from "node:net";

import type { BrowserWireMessage } from "../protocol/generated/browser-protocol.js";
import type { AuthenticatedControllerHostIdentity } from "./raw-controller-host-channel.js";

export class AuthenticatedControllerHostChannel {
  private closed = false;

  constructor(
    readonly socket: net.Socket,
    readonly identity: AuthenticatedControllerHostIdentity,
    readonly sourceChannelToken: string,
  ) {}

  send(message: BrowserWireMessage): void {
    if (this.closed || this.socket.destroyed) {
      throw new Error("BROWSER_INFRASTRUCTURE_UNAVAILABLE");
    }
    this.socket.write(`${JSON.stringify(message)}\n`);
  }

  isOpen(): boolean {
    return !this.closed && !this.socket.destroyed;
  }

  close(reason = "browser authenticated host channel closed"): void {
    if (this.closed) return;
    this.closed = true;
    this.socket.destroy(new Error(reason));
  }
}

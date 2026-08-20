import { lstat, mkdir, open, unlink } from "node:fs/promises";
import { dirname } from "node:path";

const EEXIST = "EEXIST";
const ENOENT = "ENOENT";
const OWNER_LOCK_MODE = 0o600;

export class BrowserOwnerLock {
  private handle: Awaited<ReturnType<typeof open>> | null = null;

  public constructor(private readonly lockPath: string) {}

  public async acquire(): Promise<void> {
    await mkdir(dirname(this.lockPath), { recursive: true });
    try {
      this.handle = await open(this.lockPath, "wx", OWNER_LOCK_MODE);
      await this.handle.writeFile(`${process.pid}\n`, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === EEXIST) throw new Error("BROWSER_DUAL_ACTIVE_WORKER");
      throw error;
    }
  }

  /**
   * A stale endpoint may be removed only by the process that already owns the
   * controller lock.  This deliberately refuses regular files, foreign users
   * and group/world-readable sockets; those states require operator repair.
   */
  public async removeProvenStaleSocket(socketPath: string): Promise<void> {
    if (!this.handle) throw new Error("BROWSER_CONTROLLER_ALREADY_OWNED");
    let stat: Awaited<ReturnType<typeof lstat>>;
    try {
      stat = await lstat(socketPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === ENOENT) return;
      throw error;
    }
    const ownerUid = typeof process.getuid === "function" ? process.getuid() : null;
    const secureMode = (stat.mode & 0o077) === 0;
    if (!stat.isSocket() || !secureMode || (ownerUid !== null && stat.uid !== ownerUid)) {
      throw new Error("BROWSER_REPAIR_REQUIRED");
    }
    await unlink(socketPath);
  }

  public async release(): Promise<void> {
    await this.handle?.close();
    this.handle = null;
    await unlink(this.lockPath).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== ENOENT) throw error;
    });
  }
}

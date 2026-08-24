import { lstat, mkdir, open, unlink } from "node:fs/promises";
import { dirname } from "node:path";

const EEXIST = "EEXIST";
const ENOENT = "ENOENT";
const OWNER_LOCK_MODE = 0o600;

export class BrowserOwnerLock {
  private handle: Awaited<ReturnType<typeof open>> | null = null;

  public constructor(private readonly lockPath: string) {}

  public assertHeld(): void {
    if (!this.handle) throw new Error("BROWSER_CONTROLLER_ALREADY_OWNED");
  }

  public async acquire(): Promise<void> {
    await mkdir(dirname(this.lockPath), { recursive: true });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        this.handle = await open(this.lockPath, "wx", OWNER_LOCK_MODE);
        await this.handle.writeFile(`${process.pid}\n`, "utf8");
        return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== EEXIST) throw error;
        if (attempt === 0 && await this.removeProvenDeadOwnerLock()) continue;
        throw new Error("BROWSER_DUAL_ACTIVE_WORKER");
      }
    }
  }

  private async removeProvenDeadOwnerLock(): Promise<boolean> {
    const candidate = await open(this.lockPath, "r");
    try {
      const stat = await candidate.stat();
      const ownerUid = typeof process.getuid === "function" ? process.getuid() : null;
      if (!stat.isFile() || (stat.mode & 0o077) !== 0 || (ownerUid !== null && stat.uid !== ownerUid)) {
        throw new Error("BROWSER_REPAIR_REQUIRED");
      }
      const rawPid = (await candidate.readFile("utf8")).trim();
      if (!/^[1-9][0-9]*$/u.test(rawPid)) throw new Error("BROWSER_REPAIR_REQUIRED");
      try {
        process.kill(Number(rawPid), 0);
        return false;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") return false;
      }
      const current = await lstat(this.lockPath);
      if (current.dev !== stat.dev || current.ino !== stat.ino) return false;
      await unlink(this.lockPath);
      return true;
    } finally {
      await candidate.close();
    }
  }

  /**
   * A stale endpoint may be removed only by the process that already owns the
   * controller lock.  This deliberately refuses regular files, foreign users
   * and group/world-readable sockets; those states require operator repair.
   */
  public async removeProvenStaleSocket(socketPath: string): Promise<void> {
    this.assertHeld();
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

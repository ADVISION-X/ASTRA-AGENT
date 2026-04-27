import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export class JsonStateStore<TState> {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly createInitialState: () => TState,
  ) {}

  async init(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await readFile(this.filePath, "utf8");
    } catch {
      await this.write(this.createInitialState());
    }
  }

  async read(): Promise<TState> {
    await this.writeQueue;
    const raw = await readFile(this.filePath, "utf8");
    return JSON.parse(raw) as TState;
  }

  async write(state: TState): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const tempFilePath = `${this.filePath}.tmp`;
      await writeFile(tempFilePath, JSON.stringify(state, null, 2), "utf8");
      await rename(tempFilePath, this.filePath);
    });

    await this.writeQueue;
  }
}
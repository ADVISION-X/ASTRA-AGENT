export function clearPortListeners(input: {
  host?: string;
  port: number;
  rootDir: string;
  allowedCommandFragments: string[];
  attempts?: number;
  waitMs?: number;
  logger?(message: string): void;
}): Promise<void>;

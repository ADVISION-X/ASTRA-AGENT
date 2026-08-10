import { createHash } from "node:crypto";
import {
  cpSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

const protectedTables = [
  "production_orders",
  "production_stages",
  "production_events",
  "production_parent_conversation_rebuilds",
  "production_protocol_migrations",
] as const;

type TableSnapshot = {
  readonly rowCount: number;
  readonly rowsSha256: string;
};

type DatabaseSnapshot = {
  readonly schemaSha256: string;
  readonly snapshotSha256: string;
  readonly tables: Record<string, TableSnapshot>;
};

type FileReceipt = {
  readonly byteSize: number;
  readonly relativePath: string;
  readonly sha256: string;
};

export type VerifiedProtocolCutoverBackup = {
  readonly backupRef: string;
  readonly backupSha256: string;
  readonly restoredSnapshotSha256: string;
};

const digest = (value: string | Buffer): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const readRows = (
  database: Database.Database,
  table: string,
): readonly Record<string, unknown>[] => database.prepare(
  `select * from ${table} order by rowid`,
).all() as readonly Record<string, unknown>[];

const snapshotDatabase = (
  database: Database.Database,
): DatabaseSnapshot => {
  const quickCheck = database.pragma("quick_check", { simple: true });
  const foreignKeyFailures = database.pragma(
    "foreign_key_check",
  ) as readonly Record<string, unknown>[];
  if (quickCheck !== "ok" || foreignKeyFailures.length > 0) {
    throw new Error("XUANXUE_AI_PRODUCTION_LEGACY_BACKUP_SOURCE_INVALID");
  }
  const schemaRows = database.prepare(`
    select type,name,tbl_name,sql from sqlite_master
    where name not like 'sqlite_%' order by type,name
  `).all() as readonly Record<string, unknown>[];
  const tables = Object.fromEntries(protectedTables.map((table) => {
    const rows = readRows(database, table);
    return [table, {
      rowCount: rows.length,
      rowsSha256: digest(JSON.stringify(rows)),
    } satisfies TableSnapshot];
  }));
  const schemaSha256 = digest(JSON.stringify(schemaRows));
  return {
    schemaSha256,
    tables,
    snapshotSha256: digest(JSON.stringify({ schemaSha256, tables })),
  };
};

const listFiles = (
  root: string,
  relativeRoot = "",
): string[] => {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = path.join(relativeRoot, entry.name);
      const absolutePath = path.join(root, entry.name);
      if (entry.isDirectory()) return listFiles(absolutePath, relativePath);
      return entry.isFile() ? [relativePath] : [];
    })
    .sort();
};

const makeBackupTreePrivate = (root: string): void => {
  chmodSync(root, 0o700);
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      makeBackupTreePrivate(entryPath);
    } else if (entry.isFile()) {
      chmodSync(entryPath, 0o600);
    }
  }
};

const copyAndReceiptFiles = (
  pluginRoot: string,
  backupRoot: string,
): FileReceipt[] => {
  const receipts: FileReceipt[] = [];
  for (const directory of ["cloud-staging", "generated-inputs"] as const) {
    const sourceRoot = path.join(pluginRoot, directory);
    const targetRoot = path.join(backupRoot, "objects", directory);
    if (!existsSync(sourceRoot)) continue;
    cpSync(sourceRoot, targetRoot, { recursive: true, force: false });
    makeBackupTreePrivate(targetRoot);
    for (const relativePath of listFiles(sourceRoot)) {
      const sourcePath = path.join(sourceRoot, relativePath);
      const targetPath = path.join(targetRoot, relativePath);
      const sourceBytes = readFileSync(sourcePath);
      const targetBytes = readFileSync(targetPath);
      const receipt: FileReceipt = {
        relativePath: path.join(directory, relativePath),
        byteSize: statSync(sourcePath).size,
        sha256: digest(sourceBytes),
      };
      if (
        targetBytes.byteLength !== receipt.byteSize
        || digest(targetBytes) !== receipt.sha256
      ) {
        throw new Error(
          "XUANXUE_AI_PRODUCTION_LEGACY_BACKUP_OBJECT_MISMATCH",
        );
      }
      receipts.push(receipt);
    }
  }
  return receipts;
};

const verifyRestoredBackup = (
  backupDatabasePath: string,
  expected: DatabaseSnapshot,
): DatabaseSnapshot => {
  const restoreRoot = mkdtempSync(path.join(
    tmpdir(),
    "xuanxue-ai-legacy-cutover-restore-",
  ));
  try {
    const restoredPath = path.join(restoreRoot, "restored.sqlite");
    cpSync(backupDatabasePath, restoredPath, { force: false });
    const restored = new Database(restoredPath, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      const actual = snapshotDatabase(restored);
      if (actual.snapshotSha256 !== expected.snapshotSha256) {
        throw new Error(
          "XUANXUE_AI_PRODUCTION_LEGACY_BACKUP_RESTORE_MISMATCH",
        );
      }
      return actual;
    } finally {
      restored.close();
    }
  } finally {
    rmSync(restoreRoot, { recursive: true, force: true });
  }
};

export const createVerifiedLegacyCutoverBackup = (
  database: Database.Database,
  dataDir: string,
): VerifiedProtocolCutoverBackup => {
  const sourceSnapshot = snapshotDatabase(database);
  const pluginRoot = path.join(
    dataDir,
    "plugin-tasks",
    "xuanxue-ai-production",
  );
  const cutoverId = `${new Date().toISOString().replaceAll(":", "-")}-`
    + sourceSnapshot.snapshotSha256.slice(-12);
  const backupsRoot = path.join(
    pluginRoot,
    "migration-backups",
  );
  mkdirSync(backupsRoot, { recursive: true });
  chmodSync(backupsRoot, 0o700);
  const backupRoot = path.join(
    backupsRoot,
    `legacy-cutover-${cutoverId}`,
  );
  mkdirSync(backupRoot, { recursive: false, mode: 0o700 });
  const backupDatabasePath = path.join(
    backupRoot,
    "xuanxue_ai_production.pre-cutover.sqlite",
  );
  database.prepare("vacuum into ?").run(backupDatabasePath);
  chmodSync(backupDatabasePath, 0o600);
  const restoredSnapshot = verifyRestoredBackup(
    backupDatabasePath,
    sourceSnapshot,
  );
  const files = copyAndReceiptFiles(pluginRoot, backupRoot);
  const backupSha256 = digest(readFileSync(backupDatabasePath));
  const backupRef = path.relative(dataDir, backupRoot);
  writeFileSync(path.join(backupRoot, "restore-verification.json"), `${JSON.stringify({
    backupRef,
    backupSha256,
    sourceSnapshot,
    restoredSnapshot,
    objectFiles: files,
    objectManifestSha256: digest(JSON.stringify(files)),
    verifiedAt: new Date().toISOString(),
  }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  return {
    backupRef,
    backupSha256,
    restoredSnapshotSha256: restoredSnapshot.snapshotSha256,
  };
};

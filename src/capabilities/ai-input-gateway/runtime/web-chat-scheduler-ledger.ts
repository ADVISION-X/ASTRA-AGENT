import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

type WaiterKind = "submission" | "patrol";

interface WaiterRow {
  waiter_id: string;
  execution_id: string;
  pid: number;
  ticket: number;
}

const ledgerPath = (dataDir: string): string => path.join(
  dataDir,
  "runtime-data",
  "ai-input-gateway",
  "web-chat-scheduler.sqlite",
);

const processAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const withDatabase = <T>(
  dataDir: string,
  run: (database: Database.Database) => T,
): T => {
  const filePath = ledgerPath(dataDir);
  mkdirSync(path.dirname(filePath), { recursive: true });
  const database = new Database(filePath);
  try {
    database.pragma("busy_timeout = 10000");
    database.pragma("journal_mode = WAL");
    database.pragma("synchronous = NORMAL");
    database.exec(`
      create table if not exists scheduler_waiters (
        waiter_id text primary key,
        execution_id text not null,
        kind text not null check(kind in ('submission','patrol')),
        pid integer not null,
        ticket integer not null,
        created_at text not null,
        unique(execution_id,kind)
      );
      create table if not exists scheduler_sequence (
        singleton integer primary key check(singleton=1),
        next_ticket integer not null
      );
      insert into scheduler_sequence(singleton,next_ticket)
      values(1,1) on conflict(singleton) do nothing;
    `);
    const stale = database.prepare(
      "select distinct pid from scheduler_waiters",
    ).all() as { pid: number }[];
    const remove = database.prepare(
      "delete from scheduler_waiters where pid=?",
    );
    for (const candidate of stale) {
      if (!processAlive(candidate.pid)) remove.run(candidate.pid);
    }
    return run(database);
  } finally {
    database.close();
  }
};

export interface WebChatSchedulerWaiter {
  readonly waiterId: string;
  readonly executionId: string;
  readonly ticket: number;
  release(): void;
}

export const registerWebChatSchedulerWaiter = (
  dataDir: string,
  kind: WaiterKind,
  executionId: string,
): WebChatSchedulerWaiter => withDatabase(dataDir, (database) => {
  const existing = database.prepare(`
    select waiter_id,execution_id,pid,ticket from scheduler_waiters
    where execution_id=? and kind=?
  `).get(executionId, kind) as WaiterRow | undefined;
  const row = existing ?? database.transaction(() => {
    const sequence = database.prepare(`
      select next_ticket from scheduler_sequence where singleton=1
    `).get() as { next_ticket: number };
    database.prepare(`
      update scheduler_sequence set next_ticket=next_ticket+1
      where singleton=1
    `).run();
    const created: WaiterRow = {
      waiter_id: `web-chat-${kind}:${randomUUID()}`,
      execution_id: executionId,
      pid: process.pid,
      ticket: sequence.next_ticket,
    };
    database.prepare(`
      insert into scheduler_waiters(
        waiter_id,execution_id,kind,pid,ticket,created_at
      ) values(?,?,?,?,?,?)
    `).run(
      created.waiter_id,
      created.execution_id,
      kind,
      created.pid,
      created.ticket,
      new Date().toISOString(),
    );
    return created;
  }).immediate();
  let released = false;
  return {
    waiterId: row.waiter_id,
    executionId: row.execution_id,
    ticket: row.ticket,
    release() {
      if (released) return;
      released = true;
      withDatabase(dataDir, (releaseDatabase) => {
        releaseDatabase.prepare(`
          delete from scheduler_waiters where waiter_id=? and pid=?
        `).run(row.waiter_id, process.pid);
      });
    },
  };
});

export const countWebChatSchedulerWaiters = (
  dataDir: string,
  kind: WaiterKind,
): number => withDatabase(dataDir, (database) => {
  const row = database.prepare(`
    select count(*) as count from scheduler_waiters where kind=?
  `).get(kind) as { count: number };
  return row.count;
});

export const isNextWebChatPatrolWaiter = (
  dataDir: string,
  waiterId: string,
): boolean => withDatabase(dataDir, (database) => {
  const row = database.prepare(`
    select waiter_id from scheduler_waiters
    where kind='patrol' order by ticket,waiter_id limit 1
  `).get() as { waiter_id: string } | undefined;
  return row?.waiter_id === waiterId;
});

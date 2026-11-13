import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { getEmbeddedStores } from "./embedded";
import * as schema from "./sqlite-schema";

let database: ReturnType<typeof createDatabase> | undefined;
const transactionOwner = new AsyncLocalStorage<boolean>();
let pending: Promise<void> = Promise.resolve();

async function exclusive<T>(work: () => Promise<T>): Promise<T> {
  const previous = pending;
  let release!: () => void;
  pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await work();
  } finally {
    release();
  }
}

function createDatabase() {
  const sqlite = getEmbeddedStores().sqlite;
  const db = drizzle(
    async (statement, params, method) => {
      const execute = async () => {
        const prepared = sqlite.prepare(statement);
        if (method === "run") {
          const result = prepared.run(...params);
          return { rows: [], changes: result.changes };
        }
        const raw = prepared.raw(true);
        return { rows: (method === "get" ? raw.get(...params) : raw.all(...params)) as unknown[] };
      };
      return transactionOwner.getStore() ? execute() : exclusive(execute);
    },
    { schema },
  );
  const transaction = db.transaction.bind(db);
  return new Proxy(db, {
    get(target, property, receiver) {
      if (property === "transaction") {
        return <T>(work: Parameters<typeof transaction>[0]) =>
          exclusive(() => transactionOwner.run(true, () => transaction(work))) as Promise<T>;
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

export function getSqliteDb() {
  database ??= createDatabase();
  return database;
}

export function resetSqliteDb() {
  database = undefined;
}

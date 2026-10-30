import mysql from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "./schema";
import { getAppConfig } from "../utils/config";

let db: MySql2Database<typeof schema> | undefined;
let pool: mysql.Pool | undefined;

export function getDb(): MySql2Database<typeof schema> {
  if (!db) {
    pool = mysql.createPool(getAppConfig().databaseUrl);
    db = drizzle({ client: pool, schema, mode: "default" });
  }
  return db;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  db = undefined;
  pool = undefined;
}

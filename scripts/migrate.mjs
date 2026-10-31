import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error("Missing required environment variable: DATABASE_URL");
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await migrate(drizzle(connection), { migrationsFolder: "./drizzle" });
    console.log("Database migrations complete");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
});

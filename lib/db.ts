import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export function getPool() {
  if (pool) {
    return pool;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not defined.");
  }

  pool = mysql.createPool({
    uri: databaseUrl,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 10),
    queueLimit: 0,
  });

  return pool;
}

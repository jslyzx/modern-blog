import mysql, {
  type Pool,
  type PoolOptions,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

import { databaseEnv } from "@/lib/env";

type QueryParams = ReadonlyArray<unknown> | Record<string, unknown>;

type GlobalMysql = {
  mysqlPool?: Pool;
};

const globalForMysql = globalThis as typeof globalThis & GlobalMysql;

const buildPoolOptions = (): PoolOptions => {
  const options: PoolOptions = {
    host: databaseEnv.host,
    port: databaseEnv.port,
    user: databaseEnv.user,
    password: databaseEnv.password,
    database: databaseEnv.database,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60_000,
    queueLimit: 0,
  };

  const { ssl } = databaseEnv;

  if (typeof ssl === "string") {
    options.ssl = ssl;
  } else if (ssl === true) {
    options.ssl = {
      rejectUnauthorized: true,
    };
  }

  return options;
};

export const getPool = (): Pool => {
  if (!globalForMysql.mysqlPool) {
    globalForMysql.mysqlPool = mysql.createPool(buildPoolOptions());
  }

  return globalForMysql.mysqlPool;
};

export const query = async <T = RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params: QueryParams = [],
): Promise<T> => {
  try {
    const [rows] = await getPool().query(sql, params as unknown);
    return rows as T;
  } catch (error) {
    console.error("Database query failed", {
      sql,
      params,
      error,
    });
    throw error;
  }
};

export const pingDatabase = async (): Promise<void> => {
  await query("SELECT 1");
};

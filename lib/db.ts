import mysql, {
  type Pool,
  type PoolConnection,
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
  const connectionLimit = Number(process.env.DB_CONNECTION_LIMIT ?? 10);

  const options: PoolOptions = {
    host: databaseEnv.host,
    port: databaseEnv.port,
    user: databaseEnv.user,
    password: databaseEnv.password,
    database: databaseEnv.database,
    waitForConnections: true,
    connectionLimit: Number.isFinite(connectionLimit) ? connectionLimit : 10,
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

export const queryWithConnection = async <T = RowDataPacket[] | ResultSetHeader>(
  connection: PoolConnection,
  sql: string,
  params: QueryParams = [],
): Promise<T> => {
  try {
    const [rows] = await connection.query(sql, params as unknown);

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

export const withTransaction = async <T>(callback: (connection: PoolConnection) => Promise<T>): Promise<T> => {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("Failed to rollback transaction", { rollbackError });
    }

    throw error;
  } finally {
    connection.release();
  }
};

export const pingDatabase = async (): Promise<void> => {
  await query("SELECT 1");
};

import { loadEnvConfig } from "@next/env";
import bcrypt from "bcrypt";
import type { RowDataPacket } from "mysql2/promise";
import { z } from "zod";

import { getPool, query } from "@/lib/db";

const SALT_ROUNDS = 12;

const adminEnvSchema = z.object({
  ADMIN_USERNAME: z.string().min(1, "ADMIN_USERNAME is required"),
  ADMIN_PASSWORD: z.string().min(1, "ADMIN_PASSWORD is required"),
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL must be a valid email"),
  ADMIN_TABLE_NAME: z
    .string()
    .regex(/^[A-Za-z0-9_]+$/, "ADMIN_TABLE_NAME must contain only letters, numbers, or underscores")
    .default("admins"),
});

type AdminEnv = z.infer<typeof adminEnvSchema>;

type AdminRow = RowDataPacket & {
  id: number;
  username: string;
  email: string;
  password_hash: string;
};

const inferPasswordNeedsUpdate = async (
  plainPassword: string,
  existingHash: string,
): Promise<boolean> => {
  try {
    const matches = await bcrypt.compare(plainPassword, existingHash);
    return !matches;
  } catch (error) {
    console.warn("Existing password hash could not be verified. A new hash will be generated.", {
      error,
    });
    return true;
  }
};

const insertAdmin = async (env: AdminEnv, passwordHash: string) => {
  const sql = `INSERT INTO ${env.ADMIN_TABLE_NAME} (username, email, password_hash) VALUES (?, ?, ?)`;

  await query(sql, [env.ADMIN_USERNAME, env.ADMIN_EMAIL, passwordHash]);
};

const updateAdmin = async (
  env: AdminEnv,
  admin: AdminRow,
  opts: { passwordHash?: string; email?: string },
) => {
  const assignments: string[] = [];
  const params: unknown[] = [];

  if (typeof opts.email === "string") {
    assignments.push("email = ?");
    params.push(opts.email);
  }

  if (typeof opts.passwordHash === "string") {
    assignments.push("password_hash = ?");
    params.push(opts.passwordHash);
  }

  if (assignments.length === 0) {
    return;
  }

  params.push(admin.id);

  const sql = `UPDATE ${env.ADMIN_TABLE_NAME} SET ${assignments.join(", ")} WHERE id = ?`;

  await query(sql, params);
};

const ensureAdmin = async (env: AdminEnv) => {
  const existingAdmins = await query<AdminRow[]>(
    `SELECT id, username, email, password_hash FROM ${env.ADMIN_TABLE_NAME} WHERE username = ? LIMIT 1`,
    [env.ADMIN_USERNAME],
  );

  const admin = existingAdmins[0];

  if (!admin) {
    const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, SALT_ROUNDS);
    await insertAdmin(env, passwordHash);
    console.info(`Created admin user "${env.ADMIN_USERNAME}" in table ${env.ADMIN_TABLE_NAME}.`);
    return;
  }

  const emailNeedsUpdate = admin.email !== env.ADMIN_EMAIL;
  const passwordNeedsUpdate = await inferPasswordNeedsUpdate(env.ADMIN_PASSWORD, admin.password_hash);

  if (!emailNeedsUpdate && !passwordNeedsUpdate) {
    console.info(
      `Admin user "${env.ADMIN_USERNAME}" is already up to date in table ${env.ADMIN_TABLE_NAME}.`,
    );
    return;
  }

  const nextPasswordHash = passwordNeedsUpdate
    ? await bcrypt.hash(env.ADMIN_PASSWORD, SALT_ROUNDS)
    : undefined;

  await updateAdmin(env, admin, {
    email: emailNeedsUpdate ? env.ADMIN_EMAIL : undefined,
    passwordHash: nextPasswordHash,
  });

  console.info(`Updated admin user "${env.ADMIN_USERNAME}" in table ${env.ADMIN_TABLE_NAME}.`);
};

const main = async () => {
  loadEnvConfig(process.cwd());

  const adminEnvResult = adminEnvSchema.safeParse(process.env);

  if (!adminEnvResult.success) {
    const message = adminEnvResult.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid admin environment configuration:\n${message}`);
  }

  const adminEnv = adminEnvResult.data;

  const pool = getPool();

  try {
    await ensureAdmin(adminEnv);
  } finally {
    await pool.end();
  }
};

main().catch((error) => {
  console.error("Failed to seed admin user.", error);
  process.exitCode = 1;
});

import { z } from "zod";

const envSchema = z.object({
  BLOG_DB_HOST: z.string().min(1, "BLOG_DB_HOST is required"),
  BLOG_DB_PORT: z
    .coerce.number({ invalid_type_error: "BLOG_DB_PORT must be a number" })
    .int("BLOG_DB_PORT must be an integer")
    .positive("BLOG_DB_PORT must be greater than zero"),
  BLOG_DB_USER: z.string().min(1, "BLOG_DB_USER is required"),
  BLOG_DB_PASSWORD: z.string().min(1, "BLOG_DB_PASSWORD is required"),
  BLOG_DB_NAME: z.string().min(1, "BLOG_DB_NAME is required"),
  BLOG_DB_SSL: z.string().optional(),
  ADMIN_USERNAME: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  ADMIN_EMAIL: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formattedErrors = parsedEnv.error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "environment";
      return `${path}: ${issue.message}`;
    })
    .join("\n");

  throw new Error(`Invalid environment variables:\n${formattedErrors}`);
}

const rawEnv = parsedEnv.data;

const normalizeSsl = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed.toLowerCase();

  if (["1", "true", "yes"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no"].includes(normalized)) {
    return false;
  }

  return trimmed;
};

const normalizeOptional = (value?: string) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed;
};

export const databaseEnv = {
  host: rawEnv.BLOG_DB_HOST,
  port: rawEnv.BLOG_DB_PORT,
  user: rawEnv.BLOG_DB_USER,
  password: rawEnv.BLOG_DB_PASSWORD,
  database: rawEnv.BLOG_DB_NAME,
  ssl: normalizeSsl(rawEnv.BLOG_DB_SSL),
} as const;

export type DatabaseEnv = typeof databaseEnv;

const adminUsername = normalizeOptional(rawEnv.ADMIN_USERNAME);
const adminPassword = normalizeOptional(rawEnv.ADMIN_PASSWORD);
const adminEmail = normalizeOptional(rawEnv.ADMIN_EMAIL);

export const env = {
  ADMIN_USERNAME: adminUsername ?? "admin",
  ADMIN_PASSWORD: adminPassword ?? "123456",
  ADMIN_EMAIL: adminEmail ?? null,
} as const;

export type Env = typeof env;
